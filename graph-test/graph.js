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
  curveColor: "#5d0e41",
  curveGlow: "#ff1d92",
  labelColor: "rgba(37, 22, 5, 0.58)"
};

function formatNumber(value, places = 2) {
  return Number(value).toFixed(places);
}

function getValues() {
  return {
    scale: Number(scaleSlider.value),
    exponent: Number(coefficientSlider.value)
  };
}

function squirclePoint(angle, radius, exponent) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const power = 2 / exponent;

  return {
    x: radius * Math.sign(cosine) * Math.pow(Math.abs(cosine), power),
    y: radius * Math.sign(sine) * Math.pow(Math.abs(sine), power)
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

function createMapper(box, scale) {
  return {
    xToPx: (x) => box.left + ((x + scale) / (scale * 2)) * box.width,
    yToPx: (y) => box.bottom - ((y + scale) / (scale * 2)) * box.height
  };
}

function drawLabels(box, mapper, scale) {
  const tickStep = scale <= 8 ? 2 : scale <= 16 ? 4 : 6;

  context.fillStyle = graph.labelColor;
  context.font = "11px Syne, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";

  for (let x = -scale; x <= scale + 0.001; x += tickStep) {
    const px = mapper.xToPx(x);

    context.fillText(String(Math.round(x)), px, mapper.yToPx(0) + 8);
  }

  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let y = -scale; y <= scale + 0.001; y += tickStep) {
    if (Math.abs(y) < 0.001) {
      continue;
    }

    const py = mapper.yToPx(y);

    context.fillText(String(Math.round(y)), mapper.xToPx(0) - 8, py);
  }
}

function drawAxes(box, mapper) {
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
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillText("x", box.right - 8, xAxisY - 10);
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText("y", yAxisX + 10, box.top + 8);
}

function drawCurve(box, mapper, scale, exponent) {
  const samples = 360;
  const radius = scale * 0.72;

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
    const angle = (index / samples) * Math.PI * 2;
    const { x, y } = squirclePoint(angle, radius, exponent);
    const px = mapper.xToPx(x);
    const py = mapper.yToPx(y);

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }

  context.closePath();
  context.stroke();
  context.restore();
}

function render() {
  const { scale, exponent } = getValues();
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
  const box = getPlotBox();
  const mapper = createMapper(box, scale);

  context.clearRect(0, 0, width, height);
  drawLabels(box, mapper, scale);
  drawAxes(box, mapper);
  drawCurve(box, mapper, scale, exponent);

  const radius = scale * 0.72;
  scaleOutput.value = formatNumber(scale, 1);
  coefficientOutput.value = formatNumber(exponent, 1);
  functionLabel.textContent = `|x / ${formatNumber(radius, 1)}|${formatExponent(exponent)} + |y / ${formatNumber(radius, 1)}|${formatExponent(exponent)} = 1`;
}

function formatExponent(exponent) {
  const superscriptDigits = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    ".": "·"
  };

  return formatNumber(exponent, 1)
    .replace(/\.0$/, "")
    .split("")
    .map((character) => superscriptDigits[character] || character)
    .join("");
}

function updateGraph() {
  resizeCanvas();
  render();
}

scaleSlider.addEventListener("input", render);
coefficientSlider.addEventListener("input", render);
window.addEventListener("resize", updateGraph);

updateGraph();
