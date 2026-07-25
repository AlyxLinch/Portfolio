const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const scaleSlider = document.getElementById("scale-slider");
const coefficientSlider = document.getElementById("coefficient-slider");
const scaleOutput = document.getElementById("scale-output");
const coefficientOutput = document.getElementById("coefficient-output");
const quadrantOutput = document.getElementById("quadrant-output");
const functionLabel = document.getElementById("function-label");
const quadrantButtons = Array.from(document.querySelectorAll(".quadrant-button"));

const graph = {
  padding: 58,
  axisColor: "#251605",
  curveColor: "#5d0e41",
  curveGlow: "#ff1d92",
  pointColor: "#00e2cc",
  labelColor: "rgba(37, 22, 5, 0.58)"
};

let selectedQuadrant = 4;

const quadrantSettings = {
  1: { label: "QI", xSign: 1, ySign: 1, formulaSign: "" },
  2: { label: "QII", xSign: -1, ySign: 1, formulaSign: "-" },
  3: { label: "QIII", xSign: -1, ySign: -1, formulaSign: "" },
  4: { label: "QIV", xSign: 1, ySign: -1, formulaSign: "-" }
};

function formatNumber(value, places = 2) {
  return Number(value).toFixed(places);
}

function getValues() {
  return {
    scale: Number(scaleSlider.value),
    coefficient: Number(coefficientSlider.value),
    quadrant: selectedQuadrant
  };
}

function getQuadrantRange(quadrant, scale) {
  const { xSign, ySign } = quadrantSettings[quadrant];

  return {
    xMin: xSign < 0 ? -scale : 0,
    xMax: xSign < 0 ? 0 : scale,
    yMin: ySign < 0 ? -scale : 0,
    yMax: ySign < 0 ? 0 : scale
  };
}

function functionPoint(distanceFromAxis, coefficient, quadrant) {
  const { xSign, ySign } = quadrantSettings[quadrant];

  return {
    x: xSign * distanceFromAxis,
    y: ySign * (coefficient / distanceFromAxis)
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function getPlotBox() {
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
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

function createMapper(box, scale, quadrant) {
  const range = getQuadrantRange(quadrant, scale);

  return {
    xToPx: (x) => box.left + ((x - range.xMin) / (range.xMax - range.xMin)) * box.width,
    yToPx: (y) => box.bottom - ((y - range.yMin) / (range.yMax - range.yMin)) * box.height
  };
}

function drawLabels(box, mapper, scale, quadrant) {
  const tickStep = scale <= 8 ? 2 : scale <= 16 ? 4 : 6;
  const range = getQuadrantRange(quadrant, scale);

  context.fillStyle = graph.labelColor;
  context.font = "11px Syne, sans-serif";
  context.textAlign = "center";
  context.textBaseline = range.yMin < 0 ? "bottom" : "top";

  for (let x = range.xMin; x <= range.xMax + 0.001; x += tickStep) {
    const px = mapper.xToPx(x);

    context.fillText(String(Math.round(x)), px, range.yMin < 0 ? box.top - 8 : box.bottom + 8);
  }

  context.textAlign = range.xMin < 0 ? "left" : "right";
  context.textBaseline = "middle";

  for (let y = range.yMin; y <= range.yMax + 0.001; y += tickStep) {
    const py = mapper.yToPx(y);

    context.fillText(String(Math.round(y)), range.xMin < 0 ? box.right + 8 : box.left - 8, py);
  }
}

function drawAxes(box, mapper, scale, quadrant) {
  const compact = box.width < 520;
  const range = getQuadrantRange(quadrant, scale);
  const xAxisY = mapper.yToPx(0);
  const yAxisX = mapper.xToPx(0);

  context.strokeStyle = graph.axisColor;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(box.left, xAxisY);
  context.lineTo(box.right, xAxisY);
  context.moveTo(yAxisX, box.top);
  context.lineTo(yAxisX, box.bottom);
  context.stroke();

  context.fillStyle = graph.axisColor;
  context.font = "700 12px Syne, sans-serif";
  context.textAlign = range.xMin < 0 ? "left" : "right";
  context.textBaseline = range.yMin < 0 ? "bottom" : "top";
  context.fillText("x", range.xMin < 0 ? box.left + 8 : box.right - 8, range.yMin < 0 ? xAxisY - 12 : xAxisY + 12);

  context.textAlign = range.xMin < 0 ? "left" : "right";
  context.textBaseline = range.yMin < 0 ? "top" : "bottom";
  context.fillText("y", range.xMin < 0 ? yAxisX + 12 : yAxisX - 12, range.yMin < 0 ? box.bottom - 18 : box.top + 18);

  if (!compact) {
    context.textAlign = range.xMin < 0 ? "left" : "right";
    context.textBaseline = range.yMin < 0 ? "top" : "bottom";
    context.fillText(quadrantSettings[quadrant].label, range.xMin < 0 ? box.left + 14 : box.right - 14, range.yMin < 0 ? box.bottom - 28 : box.top + 28);
  }
}

function drawCurve(box, mapper, scale, coefficient, quadrant) {
  const samples = 420;
  const start = Math.max(0.08, scale * 0.04);

  context.save();
  context.beginPath();
  context.rect(box.left, box.top, box.width, box.height);
  context.clip();

  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = graph.curveGlow;
  context.shadowBlur = 18;
  context.strokeStyle = graph.curveColor;
  context.lineWidth = 4;
  context.beginPath();

  for (let index = 0; index <= samples; index += 1) {
    const distance = start + (index / samples) * (scale - start);
    const { x, y } = functionPoint(distance, coefficient, quadrant);
    const px = mapper.xToPx(x);
    const py = mapper.yToPx(y);

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }

  context.stroke();
  context.restore();
}

function drawReferencePoint(mapper, coefficient, quadrant) {
  const { x, y } = functionPoint(1, coefficient, quadrant);

  context.fillStyle = graph.pointColor;
  context.beginPath();
  context.arc(mapper.xToPx(x), mapper.yToPx(y), 5, 0, Math.PI * 2);
  context.fill();
}

function render() {
  const { scale, coefficient, quadrant } = getValues();
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
  const box = getPlotBox();
  const mapper = createMapper(box, scale, quadrant);

  context.clearRect(0, 0, width, height);
  drawLabels(box, mapper, scale, quadrant);
  drawAxes(box, mapper, scale, quadrant);
  drawCurve(box, mapper, scale, coefficient, quadrant);
  drawReferencePoint(mapper, coefficient, quadrant);

  const { label, formulaSign } = quadrantSettings[quadrant];
  scaleOutput.value = formatNumber(scale, 1);
  coefficientOutput.value = formatNumber(coefficient);
  quadrantOutput.value = label;
  functionLabel.textContent = `${label} · y = ${formulaSign}${formatNumber(coefficient)} / x`;
}

function updateGraph() {
  resizeCanvas();
  render();
}

scaleSlider.addEventListener("input", render);
coefficientSlider.addEventListener("input", render);
quadrantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedQuadrant = Number(button.dataset.quadrant);

    quadrantButtons.forEach((currentButton) => {
      const isActive = currentButton === button;

      currentButton.classList.toggle("is-active", isActive);
      currentButton.setAttribute("aria-pressed", String(isActive));
    });

    render();
  });
});
window.addEventListener("resize", updateGraph);

updateGraph();
