const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const startExponentInput = document.getElementById("start-exponent");
const endExponentSlider = document.getElementById("end-exponent");
const endExponentOutput = document.getElementById("end-exponent-output");
const durationInput = document.getElementById("duration-input");
const playToggle = document.getElementById("play-toggle");
const playToggleIcon = playToggle.querySelector(".play-toggle__icon");
const playToggleLabel = playToggle.querySelector(".play-toggle__label");
const animationStatus = document.getElementById("animation-status");
const functionLabel = document.getElementById("function-label");

const graph = {
  padding: 52,
  curveColor: "#5d0e41",
  curveGlow: "#ff1d92"
};

const EXPONENT_MIN = 2;
const EXPONENT_MAX = 20;
const FRAME_RATE = 60;
const FRAME_INTERVAL = 1000 / FRAME_RATE;

let currentExponent = Number(startExponentInput.value);
let animationFrameId = null;
let animationElapsed = 0;
let previousTimestamp = null;
let previousStep = -1;
let isPlaying = false;

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
  return Number(endExponentSlider.value);
}

function getDurationMilliseconds() {
  return clamp(Number(durationInput.value) || 4, 0.25, 30) * 1000;
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

function drawCurve(box, exponent) {
  const samples = 360;
  const radius = box.width * 0.42;
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;

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
    const point = squirclePoint(angle, radius, exponent);
    const px = centerX + point.x;
    const py = centerY - point.y;

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
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
  const box = getPlotBox();

  context.clearRect(0, 0, width, height);
  drawCurve(box, currentExponent);

  endExponentOutput.value = formatNumber(getEndExponent());
  functionLabel.textContent = `|x|ⁿ + |y|ⁿ = 1 · n = ${formatNumber(currentExponent)}`;
}

function updateGraph() {
  resizeCanvas();
  render();
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
  previousStep = -1;
  currentExponent = getStartExponent();
  animationStatus.value = `Ready · ${formatNumber(currentExponent)}`;
  render();
}

function finishAnimation() {
  currentExponent = getEndExponent();
  animationElapsed = getDurationMilliseconds();
  previousTimestamp = null;
  render();
  setPlaying(false);
  animationStatus.value = `Complete · ${formatNumber(currentExponent)}`;
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

  const duration = getDurationMilliseconds();
  const totalSteps = Math.max(1, Math.round(duration / FRAME_INTERVAL));
  const currentStep = Math.min(totalSteps, Math.floor(animationElapsed / FRAME_INTERVAL));

  if (currentStep !== previousStep) {
    const progress = currentStep / totalSteps;
    currentExponent = getStartExponent() + (getEndExponent() - getStartExponent()) * progress;
    previousStep = currentStep;
    animationStatus.value = `${Math.round(progress * 100)}% · ${formatNumber(currentExponent)}`;
    render();
  }

  if (animationElapsed >= duration) {
    finishAnimation();
    return;
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

  if (animationElapsed >= getDurationMilliseconds()) {
    animationElapsed = 0;
    previousStep = -1;
    currentExponent = getStartExponent();
  }

  setPlaying(true);
  previousTimestamp = null;
  animationStatus.value = `Playing · ${formatNumber(currentExponent)}`;
  animationFrameId = requestAnimationFrame(animate);
}

startExponentInput.addEventListener("input", () => {
  if (startExponentInput.value !== "") {
    resetAnimation();
  }
});

startExponentInput.addEventListener("change", () => {
  startExponentInput.value = formatNumber(getStartExponent());
  resetAnimation();
});

endExponentSlider.addEventListener("input", () => {
  endExponentOutput.value = formatNumber(getEndExponent());

  if (!isPlaying && animationElapsed >= getDurationMilliseconds()) {
    currentExponent = getEndExponent();
    render();
  }
});

durationInput.addEventListener("change", () => {
  durationInput.value = formatNumber(getDurationMilliseconds() / 1000, 2).replace(/\.00$/, "");
  resetAnimation();
});

playToggle.addEventListener("click", toggleAnimation);
window.addEventListener("resize", updateGraph);

updateGraph();
