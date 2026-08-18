const READY_ATTRIBUTE = "data-reactive-ready";
const PINNED_CLASS = "reactive-color--pinned";

function isVisible(element, verticalMargin = 0) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) > 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > -verticalMargin &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight + verticalMargin
  );
}

function getCanvasFont(style) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function transformText(text, transform) {
  if (transform === "uppercase") {
    return text.toUpperCase();
  }

  if (transform === "lowercase") {
    return text.toLowerCase();
  }

  if (transform === "capitalize") {
    return text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }

  return text;
}

function collectTextLines(node) {
  const text = node.textContent || "";
  const lines = [];
  let currentLine = null;

  for (let index = 0; index < text.length; index += 1) {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rect = range.getBoundingClientRect();
    range.detach();

    if (!rect.width && !rect.height) {
      continue;
    }

    if (!currentLine || Math.abs(rect.top - currentLine.top) > 1) {
      currentLine = {
        bottom: rect.bottom,
        left: rect.left,
        text: text[index],
        top: rect.top
      };
      lines.push(currentLine);
    } else {
      currentLine.text += text[index];
      currentLine.bottom = Math.max(currentLine.bottom, rect.bottom);
    }
  }

  return lines;
}

function drawTextMask(context, element, offsetX = 0, offsetY = 0) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let drewText = false;
  let node = walker.nextNode();

  while (node) {
    if (node.textContent.trim()) {
      const parent = node.parentElement || element;
      const style = getComputedStyle(parent);
      const lines = collectTextLines(node);

      context.save();
      context.fillStyle = "white";
      context.font = getCanvasFont(style);
      context.fontKerning = style.fontKerning;
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.globalAlpha = Number(style.opacity) || 1;

      if ("letterSpacing" in context) {
        context.letterSpacing = style.letterSpacing;
      }

      const metrics = context.measureText("Mg");
      const ascent = metrics.actualBoundingBoxAscent || parseFloat(style.fontSize) * 0.8;
      const descent = metrics.actualBoundingBoxDescent || parseFloat(style.fontSize) * 0.2;

      for (const line of lines) {
        const lineHeight = line.bottom - line.top;
        const baseline = line.top + (lineHeight + ascent - descent) / 2;
        const renderedText = transformText(line.text, style.textTransform);

        context.fillText(renderedText, line.left - offsetX, baseline - offsetY);
        drewText = true;
      }

      context.restore();
    }

    node = walker.nextNode();
  }

  return drewText;
}

function drawRoundedShape(context, element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const radius = Math.max(
    parseFloat(style.borderTopLeftRadius) || 0,
    parseFloat(style.borderTopRightRadius) || 0,
    parseFloat(style.borderBottomRightRadius) || 0,
    parseFloat(style.borderBottomLeftRadius) || 0
  );

  context.save();
  context.fillStyle = "white";
  context.globalAlpha = Number(style.opacity) || 1;
  context.beginPath();

  if (typeof context.roundRect === "function") {
    context.roundRect(rect.left, rect.top, rect.width, rect.height, radius);
  } else {
    context.rect(rect.left, rect.top, rect.width, rect.height);
  }

  context.fill();
  context.restore();
}

function prepareSvgMask(element, cache, markDirty) {
  const cached = cache.get(element);

  if (cached) {
    return cached;
  }

  const entry = { bitmap: null, loading: true };
  const clone = element.cloneNode(true);
  const sourceNodes = [element, ...element.querySelectorAll("*")];
  const cloneNodes = [clone, ...clone.querySelectorAll("*")];

  clone.removeAttribute("class");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  for (let index = 0; index < cloneNodes.length; index += 1) {
    const sourceNode = sourceNodes[index];
    const cloneNode = cloneNodes[index];
    const style = getComputedStyle(sourceNode);
    const hasFill = style.fill !== "none" && style.fill !== "transparent";
    const hasStroke = style.stroke !== "none" && style.stroke !== "transparent";

    cloneNode.setAttribute("fill", hasFill ? "white" : "none");
    cloneNode.setAttribute("stroke", hasStroke ? "white" : "none");
    cloneNode.setAttribute("stroke-width", style.strokeWidth);
    cloneNode.setAttribute("stroke-linecap", style.strokeLinecap);
    cloneNode.setAttribute("stroke-linejoin", style.strokeLinejoin);
    cloneNode.setAttribute("fill-rule", style.fillRule);
    cloneNode.removeAttribute("filter");
    cloneNode.removeAttribute("mask");
  }

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml"
  });

  createImageBitmap(blob)
    .then((bitmap) => {
      entry.bitmap = bitmap;
      entry.loading = false;
      markDirty();
    })
    .catch(() => {
      entry.loading = false;
    });

  cache.set(element, entry);
  return entry;
}

export function createReactiveColorSystem({
  wave,
  maxPixelRatio = 1.5,
  overscanViewport = 0.5
} = {}) {
  if (!wave?.setReactiveColorState) {
    return { dispose() {}, update() {} };
  }

  const maskCanvas = document.createElement("canvas");
  const context = maskCanvas.getContext("2d");

  if (!context) {
    return { dispose() {}, update() {} };
  }

  const svgCache = new WeakMap();
  const maskedFlowElements = new Set();
  const resizeObserver = new ResizeObserver(() => {
    maskDirty = true;
  });
  let reactiveElements = [];
  let flowElements = [];
  let pinnedElements = [];
  let maskDirty = true;
  let textureDirty = true;
  let disposed = false;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let maskCssHeight = window.innerHeight;
  let overscanY = 0;
  let anchorScrollX = window.scrollX;
  let anchorScrollY = window.scrollY;
  let anchorMaskBounds = null;

  function markDirty() {
    maskDirty = true;
  }

  function refreshElements() {
    for (const element of reactiveElements) {
      resizeObserver.unobserve(element);
    }

    reactiveElements = [...document.querySelectorAll(".reactive-color")];
    flowElements = reactiveElements.filter(
      (element) => !element.classList.contains(PINNED_CLASS)
    );
    pinnedElements = reactiveElements.filter(
      (element) => element.classList.contains(PINNED_CLASS)
    );

    for (const element of reactiveElements) {
      resizeObserver.observe(element);
    }

    for (const element of pinnedElements) {
      element.setAttribute(READY_ATTRIBUTE, "");
    }

    markDirty();
  }

  function resize() {
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const nextViewportWidth = Math.max(1, window.innerWidth);
    const nextViewportHeight = Math.max(1, window.innerHeight);
    const nextOverscanY = Math.round(
      nextViewportHeight * Math.max(0, overscanViewport)
    );
    const nextMaskCssHeight = nextViewportHeight + nextOverscanY * 2;
    const nextWidth = Math.max(1, Math.round(nextViewportWidth * nextPixelRatio));
    const nextHeight = Math.max(1, Math.round(nextMaskCssHeight * nextPixelRatio));

    if (
      nextWidth === width &&
      nextHeight === height &&
      nextPixelRatio === pixelRatio &&
      nextViewportWidth === viewportWidth &&
      nextViewportHeight === viewportHeight
    ) {
      return;
    }

    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextPixelRatio;
    viewportWidth = nextViewportWidth;
    viewportHeight = nextViewportHeight;
    maskCssHeight = nextMaskCssHeight;
    overscanY = nextOverscanY;
    maskCanvas.width = width;
    maskCanvas.height = height;
    markDirty();
  }

  function rebuildMask() {
    maskedFlowElements.clear();
    anchorMaskBounds = null;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      overscanY * pixelRatio
    );

    for (const element of flowElements) {
      const isSvg = element instanceof SVGSVGElement;
      const isShape = element.classList.contains("reactive-color--shape");

      if (!isVisible(element, overscanY)) {
        if (!isSvg) {
          element.setAttribute(READY_ATTRIBUTE, "");
        }
        continue;
      }

      if (isSvg) {
        const entry = prepareSvgMask(element, svgCache, markDirty);

        if (entry.bitmap) {
          const rect = element.getBoundingClientRect();
          context.drawImage(entry.bitmap, rect.left, rect.top, rect.width, rect.height);
          element.setAttribute(READY_ATTRIBUTE, "");
          maskedFlowElements.add(element);
        }
      } else if (isShape) {
        drawRoundedShape(context, element);
        element.setAttribute(READY_ATTRIBUTE, "");
        maskedFlowElements.add(element);
      } else if (drawTextMask(context, element)) {
        element.setAttribute(READY_ATTRIBUTE, "");
        maskedFlowElements.add(element);
      }

      if (maskedFlowElements.has(element)) {
        const rect = element.getBoundingClientRect();
        const bounds = {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top
        };

        if (!anchorMaskBounds) {
          anchorMaskBounds = bounds;
        } else {
          anchorMaskBounds.bottom = Math.max(anchorMaskBounds.bottom, bounds.bottom);
          anchorMaskBounds.left = Math.min(anchorMaskBounds.left, bounds.left);
          anchorMaskBounds.right = Math.max(anchorMaskBounds.right, bounds.right);
          anchorMaskBounds.top = Math.min(anchorMaskBounds.top, bounds.top);
        }
      }
    }

    anchorScrollX = window.scrollX;
    anchorScrollY = window.scrollY;
    maskDirty = false;
    textureDirty = true;
  }

  function visibleFlowElementNeedsMask() {
    return flowElements.some(
      (element) => isVisible(element, overscanY) && !maskedFlowElements.has(element)
    );
  }

  function getPinnedRectangles() {
    const rectangles = [];

    for (const element of pinnedElements) {
      if (!isVisible(element) || rectangles.length >= 16) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      rectangles.push([
        rect.left / window.innerWidth,
        (window.innerHeight - rect.bottom) / window.innerHeight,
        rect.width / window.innerWidth,
        rect.height / window.innerHeight
      ]);
    }

    return rectangles;
  }

  function update() {
    if (disposed) {
      return;
    }

    resize();

    if (!maskDirty && visibleFlowElementNeedsMask()) {
      maskDirty = true;
    }

    if (maskDirty) {
      rebuildMask();
    }

    const scrollDeltaX = window.scrollX - anchorScrollX;
    const scrollDeltaY = window.scrollY - anchorScrollY;
    const pinnedRects = getPinnedRectangles();
    const maskBounds = anchorMaskBounds
      ? [
          (anchorMaskBounds.left - scrollDeltaX) / Math.max(window.innerWidth, 1),
          (window.innerHeight - anchorMaskBounds.bottom + scrollDeltaY) /
            Math.max(window.innerHeight, 1),
          (anchorMaskBounds.right - anchorMaskBounds.left) /
            Math.max(window.innerWidth, 1),
          (anchorMaskBounds.bottom - anchorMaskBounds.top) /
            Math.max(window.innerHeight, 1)
        ]
      : [0, 0, 0, 0];

    wave.setReactiveColorState({
      enabled: maskedFlowElements.size > 0 || pinnedRects.length > 0,
      maskCanvas,
      maskDirty: textureDirty,
      maskScale: [
        1,
        viewportHeight / Math.max(maskCssHeight, 1)
      ],
      maskOffset: [
        scrollDeltaX / Math.max(viewportWidth, 1),
        (overscanY - scrollDeltaY) / Math.max(maskCssHeight, 1)
      ],
      maskBounds,
      pinnedRects
    });
    textureDirty = false;
  }

  const mutationObserver = new MutationObserver(refreshElements);
  mutationObserver.observe(document.body, {
    attributeFilter: ["class"],
    attributes: true,
    childList: true,
    subtree: true
  });
  window.addEventListener("resize", markDirty);
  document.fonts?.ready.then(markDirty);
  refreshElements();

  return {
    dispose() {
      disposed = true;
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", markDirty);

      for (const element of reactiveElements) {
        element.removeAttribute(READY_ATTRIBUTE);
      }

      wave.setReactiveColorState({ enabled: false });
    },
    update
  };
}
