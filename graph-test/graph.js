const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const startExponentInput = document.getElementById("start-exponent");
const startExponentOutput = document.getElementById("start-exponent-output");
const endExponentOutput = document.getElementById("end-exponent-output");
const durationInput = document.getElementById("duration-input");
const playToggle = document.getElementById("play-toggle");
const playToggleIcon = playToggle.querySelector(".play-toggle__icon");
const playToggleLabel = playToggle.querySelector(".play-toggle__label");
const animationStatus = document.getElementById("animation-status");
const functionLabel = document.getElementById("function-label");
const interpolationDropdown = document.getElementById("interpolation-dropdown");
const interpolationTrigger = interpolationDropdown.querySelector(".ds-dropdown__trigger");
const interpolationValue = interpolationDropdown.querySelector("[data-dropdown-value]");
const interpolationOptions = Array.from(interpolationDropdown.querySelectorAll(".ds-dropdown__option"));

const graph = {
  padding: 52,
  fillColor: "#5d0e41"
};

const EXPONENT_MIN = 2;
const EXPONENT_MAX = 20;
const FRAME_RATE = 60;
const FRAME_INTERVAL = 1000 / FRAME_RATE;
const ENDPOINT_HOLD_DURATION = 2000;
const interpolationCurves = {
  linear: (progress) => progress,
  "ease-in": (progress) => progress ** 3,
  "ease-out": (progress) => 1 - (1 - progress) ** 3,
  "ease-in-out": (progress) => (
    progress < 0.5
      ? 4 * progress ** 3
      : 1 - ((-2 * progress + 2) ** 3) / 2
  )
};

let currentExponent = Number(startExponentInput.value);
let animationFrameId = null;
let animationElapsed = 0;
let previousTimestamp = null;
let previousFrameKey = "";
let isPlaying = false;
let calculatedEndExponent = 12;
let canvasPixelRatio = 1;
let canvasSignature = "";
let interpolationStyle = "linear";
let renderPerfectEndpoint = false;

function formatNumber(value, places = 1) {
  return Number(value).toFixed(places);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getStartExponent() {
  return clamp(Number(startExponentInput.value) || EXPONENT_MIN, EXPONENT_MIN, EXPONENT_MAX);
}

function getEndExponent() {
  return calculatedEndExponent;
}

function getDurationMilliseconds() {
  return clamp(Number(durationInput.value) || 4, 0.25, 30) * 1000;
}

function getInterpolatedProgress(progress) {
  return interpolationCurves[interpolationStyle](progress);
}

function getLoopFrame(elapsed, duration) {
  const totalSteps = Math.max(1, Math.round(duration / FRAME_INTERVAL));
  const cycleDuration = duration * 2 + ENDPOINT_HOLD_DURATION * 2;
  const cycleElapsed = elapsed % cycleDuration;
  const forwardStart = ENDPOINT_HOLD_DURATION;
  const endHoldStart = forwardStart + duration;
  const reverseStart = endHoldStart + ENDPOINT_HOLD_DURATION;

  if (cycleElapsed < forwardStart) {
    return {
      key: "hold-start",
      exponentProgress: 0,
      usePerfectGeometry: false,
      status: "Holding start"
    };
  }

  if (cycleElapsed < endHoldStart) {
    const step = Math.min(
      totalSteps,
      Math.floor((cycleElapsed - forwardStart) / FRAME_INTERVAL)
    );
    const progress = step / totalSteps;

    return {
      key: `forward-${step}`,
      exponentProgress: progress,
      usePerfectGeometry: false,
      status: `Forward ${Math.round(progress * 100)}%`
    };
  }

  if (cycleElapsed < reverseStart) {
    return {
      key: "hold-end",
      exponentProgress: 1,
      usePerfectGeometry: true,
      status: "Holding end"
    };
  }

  const step = Math.min(
    totalSteps,
    Math.floor((cycleElapsed - reverseStart) / FRAME_INTERVAL)
  );
  const progress = step / totalSteps;

  return {
    key: `reverse-${step}`,
    exponentProgress: 1 - progress,
    usePerfectGeometry: false,
    status: `Reverse ${Math.round(progress * 100)}%`
  };
}

function squirclePoint(angle, xRadius, yRadius, exponent) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const power = 2 / exponent;

  return {
    x: xRadius * Math.sign(cosine) * Math.pow(Math.abs(cosine), power),
    y: yRadius * Math.sign(sine) * Math.pow(Math.abs(sine), power)
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const nextSignature = `${rect.width}x${rect.height}@${pixelRatio}`;

  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  canvasPixelRatio = pixelRatio;

  if (nextSignature === canvasSignature) {
    return false;
  }

  canvasSignature = nextSignature;
  return true;
}

function getPlotBox() {
  const width = canvas.width / canvasPixelRatio;
  const height = canvas.height / canvasPixelRatio;
  const padding = width < 520 ? 34 : graph.padding;
  const size = Math.max(0, Math.min(width, height) - padding * 2);
  const left = (width - size) / 2;
  const top = (height - size) / 2;

  return {
    left,
    right: left + size,
    top,
    bottom: top + size,
    width: size,
    height: size
  };
}

function getShapeLayout(box) {
  const gutter = box.width * 0.08;
  const cellWidth = (box.width - gutter) / 2;
  const cellHeight = (box.height - gutter) / 2;
  const leftCenter = box.left + cellWidth / 2;
  const rightCenter = box.right - cellWidth / 2;
  const topCenter = box.top + cellHeight / 2;
  const bottomCenter = box.bottom - cellHeight / 2;
  const squareRadius = Math.min(cellWidth, cellHeight) * 0.34;
  const landscapeRadius = cellWidth * 0.4;
  const wideRadius = cellWidth * 0.43;
  const portraitRadius = cellHeight * 0.4;

  return [
    {
      centerX: leftCenter,
      centerY: topCenter,
      xRadius: squareRadius,
      yRadius: squareRadius
    },
    {
      centerX: rightCenter,
      centerY: topCenter,
      xRadius: landscapeRadius,
      yRadius: landscapeRadius * 0.75
    },
    {
      centerX: leftCenter,
      centerY: bottomCenter,
      xRadius: wideRadius,
      yRadius: wideRadius * 0.5625
    },
    {
      centerX: rightCenter,
      centerY: bottomCenter,
      xRadius: portraitRadius * 0.75,
      yRadius: portraitRadius
    }
  ];
}

function calculateTerminalExponent(box) {
  const shapes = getShapeLayout(box);
  const largestRadius = Math.max(
    ...shapes.flatMap((shape) => [shape.xRadius, shape.yRadius])
  );
  const radiusInPixels = largestRadius * canvasPixelRatio;
  const cornerPixelCenter = Math.max(0.5, radiusInPixels - 0.5);
  const diagonalRatio = cornerPixelCenter / radiusInPixels;
  const exponent = -Math.LN2 / Math.log(diagonalRatio);

  return Math.ceil(exponent * 10) / 10;
}

function drawSquircle(shape, exponent) {
  const samples = 360;

  context.beginPath();

  for (let index = 0; index <= samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    const point = squirclePoint(angle, shape.xRadius, shape.yRadius, exponent);
    const px = shape.centerX + point.x;
    const py = shape.centerY - point.y;

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }

  context.closePath();
  context.fill();
}

function drawPerfectRectangle(shape) {
  const left = Math.round((shape.centerX - shape.xRadius) * canvasPixelRatio) / canvasPixelRatio;
  const top = Math.round((shape.centerY - shape.yRadius) * canvasPixelRatio) / canvasPixelRatio;
  const right = Math.round((shape.centerX + shape.xRadius) * canvasPixelRatio) / canvasPixelRatio;
  const bottom = Math.round((shape.centerY + shape.yRadius) * canvasPixelRatio) / canvasPixelRatio;

  context.fillRect(
    left,
    top,
    right - left,
    bottom - top
  );
}

function drawShapes(box, exponent, usePerfectGeometry) {
  const shapes = getShapeLayout(box);

  context.save();
  context.fillStyle = graph.fillColor;

  shapes.forEach((shape) => {
    if (usePerfectGeometry) {
      drawPerfectRectangle(shape);
    } else {
      drawSquircle(shape, exponent);
    }
  });

  context.restore();
}

function render() {
  const width = canvas.width / canvasPixelRatio;
  const height = canvas.height / canvasPixelRatio;
  const box = getPlotBox();

  context.clearRect(0, 0, width, height);
  drawShapes(box, currentExponent, renderPerfectEndpoint);

  startExponentOutput.value = formatNumber(getStartExponent());
  endExponentOutput.value = formatNumber(getEndExponent());
  functionLabel.textContent = renderPerfectEndpoint
    ? "Perfect rectangles · n → ∞"
    : `|x/a|ⁿ + |y/b|ⁿ = 1 · n = ${formatNumber(currentExponent)}`;
}

function updateGraph() {
  const dimensionsChanged = resizeCanvas();

  if (dimensionsChanged) {
    calculatedEndExponent = calculateTerminalExponent(getPlotBox());
    resetAnimation();
  } else {
    render();
  }
}

function setPlaying(nextIsPlaying) {
  isPlaying = nextIsPlaying;
  playToggle.setAttribute("aria-pressed", String(isPlaying));
  playToggleIcon.textContent = isPlaying ? "Ⅱ" : "▶";
  playToggleLabel.textContent = isPlaying ? "Pause" : "Play";

  if (!isPlaying && animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function resetAnimation() {
  setPlaying(false);
  animationElapsed = 0;
  previousTimestamp = null;
  previousFrameKey = "";
  currentExponent = getStartExponent();
  renderPerfectEndpoint = false;
  animationStatus.value = `Ready · ${formatNumber(currentExponent)}`;
  render();
}

function animate(timestamp) {
  if (!isPlaying) {
    return;
  }

  if (previousTimestamp === null) {
    previousTimestamp = timestamp;
  } else {
    animationElapsed += timestamp - previousTimestamp;
    previousTimestamp = timestamp;
  }

  const loopFrame = getLoopFrame(animationElapsed, getDurationMilliseconds());

  if (loopFrame.key !== previousFrameKey) {
    const interpolatedProgress = getInterpolatedProgress(loopFrame.exponentProgress);
    const startExponent = getStartExponent();
    currentExponent = startExponent * Math.pow(getEndExponent() / startExponent, interpolatedProgress);
    renderPerfectEndpoint = loopFrame.usePerfectGeometry;
    previousFrameKey = loopFrame.key;
    animationStatus.value = `${loopFrame.status} · ${formatNumber(currentExponent)}`;
    render();
  }

  animationFrameId = requestAnimationFrame(animate);
}

function toggleAnimation() {
  if (isPlaying) {
    setPlaying(false);
    previousTimestamp = null;
    animationStatus.value = `Paused · ${formatNumber(currentExponent)}`;
    return;
  }

  setPlaying(true);
  previousTimestamp = null;
  animationStatus.value = `Playing · ${formatNumber(currentExponent)}`;
  animationFrameId = requestAnimationFrame(animate);
}

startExponentInput.addEventListener("input", () => {
  resetAnimation();
});

function closeInterpolationDropdown() {
  interpolationDropdown.classList.remove("is-open");
  interpolationTrigger.setAttribute("aria-expanded", "false");
}

interpolationTrigger.addEventListener("click", () => {
  const shouldOpen = !interpolationDropdown.classList.contains("is-open");

  interpolationDropdown.classList.toggle("is-open", shouldOpen);
  interpolationTrigger.setAttribute("aria-expanded", String(shouldOpen));

  if (shouldOpen) {
    interpolationOptions
      .find((option) => option.getAttribute("aria-selected") === "true")
      ?.focus();
  }
});

interpolationOptions.forEach((option) => {
  option.addEventListener("click", () => {
    interpolationStyle = option.dataset.style;
    interpolationValue.textContent = option.textContent;

    interpolationOptions.forEach((entry) => {
      entry.setAttribute("aria-selected", String(entry === option));
    });

    closeInterpolationDropdown();
    interpolationTrigger.focus();
    resetAnimation();
  });

  option.addEventListener("keydown", (event) => {
    const currentIndex = interpolationOptions.indexOf(option);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      interpolationOptions[
        (currentIndex + direction + interpolationOptions.length) % interpolationOptions.length
      ].focus();
    } else if (event.key === "Escape") {
      closeInterpolationDropdown();
      interpolationTrigger.focus();
    }
  });
});

document.addEventListener("click", (event) => {
  if (!interpolationDropdown.contains(event.target)) {
    closeInterpolationDropdown();
  }
});

durationInput.addEventListener("change", () => {
  durationInput.value = formatNumber(getDurationMilliseconds() / 1000, 2).replace(/\.00$/, "");
  resetAnimation();
});

playToggle.addEventListener("click", toggleAnimation);
window.addEventListener("resize", updateGraph);

updateGraph();
