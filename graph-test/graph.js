const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const scaleSlider = document.getElementById("scale-slider");
const coefficientSlider = document.getElementById("coefficient-slider");
const scaleOutput = document.getElementById("scale-output");
const coefficientOutput = document.getElementById("coefficient-output");
const functionLabel = document.getElementById("function-label");

const graph = {
  padding: 58,
  axisColor: "#251605",
  gridColor: "rgba(37, 22, 5, 0.16)",
  curveColor: "#5d0e41",
  curveGlow: "#ff1d92",
  pointColor: "#00e2cc"
};

function formatNumber(value, places = 2) {
  return Number(value).toFixed(places);
}

function getValues() {
  return {
    scale: Number(scaleSlider.value),
    coefficient: Number(coefficientSlider.value)
  };
}

function functionValue(x, coefficient) {
  return -coefficient * Math.log(x + 1);
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

  return {
    left: padding,
    right: width - padding * 0.45,
    top: padding * 0.55,
    bottom: height - padding,
    width: width - padding * 1.45,
    height: height - padding * 1.55
  };
}

function createMapper(box, scale) {
  return {
    xToPx: (x) => box.left + (x / scale) * box.width,
    yToPx: (y) => box.bottom - ((y + scale) / scale) * box.height
  };
}

function drawGrid(box, mapper, scale) {
  const tickStep = scale <= 8 ? 1 : scale <= 16 ? 2 : 4;

  context.lineWidth = 1;
  context.strokeStyle = graph.gridColor;
  context.fillStyle = "rgba(37, 22, 5, 0.54)";
  context.font = "11px Syne, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";

  for (let x = 0; x <= scale; x += tickStep) {
    const px = mapper.xToPx(x);

    context.beginPath();
    context.moveTo(px, box.top);
    context.lineTo(px, box.bottom);
    context.stroke();

    context.fillText(String(x), px, box.bottom + 12);
  }

  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let y = -scale; y <= 0; y += tickStep) {
    const py = mapper.yToPx(y);

    context.beginPath();
    context.moveTo(box.left, py);
    context.lineTo(box.right, py);
    context.stroke();

    if (y !== 0) {
      context.fillText(String(y), box.left - 12, py);
    }
  }
}

function drawAxes(box, mapper, scale) {
  const compact = box.width < 520;

  context.strokeStyle = graph.axisColor;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(box.left, mapper.yToPx(0));
  context.lineTo(box.right, mapper.yToPx(0));
  context.moveTo(mapper.xToPx(0), box.top);
  context.lineTo(mapper.xToPx(0), box.bottom);
  context.stroke();

  context.fillStyle = graph.axisColor;
  context.font = "700 12px Syne, sans-serif";
  context.textAlign = "left";
  context.fillText("x", box.right - 8, mapper.yToPx(0) - 22);
  context.fillText("y", mapper.xToPx(0) + 12, box.top + 4);
  if (!compact) {
    context.fillText("Quadrant IV", box.right - 100, box.bottom - 26);
  }

  if (!compact) {
    context.fillText(`scale: ${scale.toFixed(1)}`, box.left + 12, box.top + 24);
  }
}

function drawCurve(box, mapper, scale, coefficient) {
  const samples = 420;

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
    const x = (index / samples) * scale;
    const y = functionValue(x, coefficient);
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

function drawReferencePoint(mapper, coefficient) {
  const x = 1;
  const y = functionValue(x, coefficient);

  context.fillStyle = graph.pointColor;
  context.beginPath();
  context.arc(mapper.xToPx(x), mapper.yToPx(y), 5, 0, Math.PI * 2);
  context.fill();
}

function render() {
  const { scale, coefficient } = getValues();
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
  const box = getPlotBox();
  const mapper = createMapper(box, scale);

  context.clearRect(0, 0, width, height);
  drawGrid(box, mapper, scale);
  drawAxes(box, mapper, scale);
  drawCurve(box, mapper, scale, coefficient);
  drawReferencePoint(mapper, coefficient);

  scaleOutput.value = formatNumber(scale, 1);
  coefficientOutput.value = formatNumber(coefficient);
  functionLabel.textContent = `y = -${formatNumber(coefficient)} · ln(x + 1)`;
}

function updateGraph() {
  resizeCanvas();
  render();
}

scaleSlider.addEventListener("input", render);
coefficientSlider.addEventListener("input", render);
window.addEventListener("resize", updateGraph);

updateGraph();
