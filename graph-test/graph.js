const startExponentInput = document.getElementById("start-exponent");
const startExponentOutput = document.getElementById("start-exponent-output");
const endExponentOutput = document.getElementById("end-exponent-output");
const durationInput = document.getElementById("duration-input");
const functionLabel = document.getElementById("function-label");
const interpolationDropdown = document.getElementById("interpolation-dropdown");
const interpolationTrigger = interpolationDropdown.querySelector(".ds-dropdown__trigger");
const interpolationValue = interpolationDropdown.querySelector("[data-dropdown-value]");
const interpolationOptions = Array.from(interpolationDropdown.querySelectorAll(".ds-dropdown__option"));

const EXPONENT_MIN = 2;
const EXPONENT_MAX = 20;
const FRAME_RATE = 60;
const FRAME_INTERVAL = 1000 / FRAME_RATE;
const PATH_SAMPLES = 180;
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

const buttonStates = Array.from(document.querySelectorAll(".shape-button")).map((button) => ({
  button,
  path: button.querySelector(".shape-button__surface"),
  svg: button.querySelector(".shape-button__graphic"),
  borderWidth: Number(button.dataset.borderWidth) || 0,
  width: 0,
  height: 0,
  endExponent: 12,
  progress: 0,
  targetProgress: 0,
  stepAccumulator: 0
}));

let interpolationStyle = "linear";
let animationFrameId = null;
let previousTimestamp = null;
let activeButtonState = null;

function formatNumber(value, places = 1) {
  return Number(value).toFixed(places);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getStartExponent() {
  return clamp(Number(startExponentInput.value) || EXPONENT_MIN, EXPONENT_MIN, EXPONENT_MAX);
}

function getDurationMilliseconds() {
  return clamp(Number(durationInput.value) || 4, 0.25, 30) * 1000;
}

function getInterpolatedProgress(progress) {
  return interpolationCurves[interpolationStyle](progress);
}

function calculateTerminalExponent(radiusInPixels) {
  const cornerPixelCenter = Math.max(0.5, radiusInPixels - 0.5);
  const diagonalRatio = cornerPixelCenter / radiusInPixels;
  const exponent = -Math.LN2 / Math.log(diagonalRatio);

  return Math.ceil(exponent * 10) / 10;
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

function getGeometry(state) {
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const edgeInset = Math.max(state.borderWidth / 2, 0.5 / pixelRatio);

  return {
    pixelRatio,
    edgeInset,
    centerX: state.width / 2,
    centerY: state.height / 2,
    xRadius: Math.max(1, state.width / 2 - edgeInset),
    yRadius: Math.max(1, state.height / 2 - edgeInset)
  };
}

function createRectanglePath(state) {
  const { pixelRatio, edgeInset } = getGeometry(state);
  const left = Math.round(edgeInset * pixelRatio) / pixelRatio;
  const top = Math.round(edgeInset * pixelRatio) / pixelRatio;
  const right = Math.round((state.width - edgeInset) * pixelRatio) / pixelRatio;
  const bottom = Math.round((state.height - edgeInset) * pixelRatio) / pixelRatio;

  return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
}

function createSquirclePath(state, exponent) {
  const geometry = getGeometry(state);
  const commands = [];

  for (let index = 0; index <= PATH_SAMPLES; index += 1) {
    const angle = (index / PATH_SAMPLES) * Math.PI * 2;
    const point = squirclePoint(
      angle,
      geometry.xRadius,
      geometry.yRadius,
      exponent
    );
    const x = geometry.centerX + point.x;
    const y = geometry.centerY - point.y;

    commands.push(`${index === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

function getCurrentExponent(state) {
  const startExponent = getStartExponent();
  const easedProgress = getInterpolatedProgress(state.progress);

  return startExponent * Math.pow(state.endExponent / startExponent, easedProgress);
}

function drawButton(state) {
  const isPerfectRectangle = state.progress >= 1;
  const exponent = isPerfectRectangle ? state.endExponent : getCurrentExponent(state);

  state.path.setAttribute(
    "d",
    isPerfectRectangle
      ? createRectanglePath(state)
      : createSquirclePath(state, exponent)
  );

  if (activeButtonState === state) {
    functionLabel.textContent = isPerfectRectangle
      ? "Perfect rectangle · n → ∞"
      : `|x/a|ⁿ + |y/b|ⁿ = 1 · n = ${formatNumber(exponent)}`;
  }
}

function updateEndpointOutput() {
  const endpoints = buttonStates
    .filter((state) => state.width > 0 && state.height > 0)
    .map((state) => state.endExponent);

  startExponentOutput.value = formatNumber(getStartExponent());

  if (endpoints.length === 0) {
    endExponentOutput.value = "Calculating...";
    return;
  }

  const minimum = Math.min(...endpoints);
  const maximum = Math.max(...endpoints);
  endExponentOutput.value = `${formatNumber(minimum)}–${formatNumber(maximum)}`;
}

function updateButtonGeometry(state) {
  const rect = state.button.getBoundingClientRect();
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);

  state.width = rect.width;
  state.height = rect.height;
  state.svg.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
  state.endExponent = calculateTerminalExponent(
    Math.max(state.width, state.height) * 0.5 * pixelRatio
  );

  drawButton(state);
  updateEndpointOutput();
}

function resetButtons() {
  buttonStates.forEach((state) => {
    state.progress = 0;
    state.targetProgress = 0;
    state.stepAccumulator = 0;
    drawButton(state);
  });

  activeButtonState = null;
  functionLabel.textContent = `Hover-driven squircles · n = ${formatNumber(getStartExponent())}`;
  updateEndpointOutput();
}

function hasActiveAnimations() {
  return buttonStates.some((state) => state.progress !== state.targetProgress);
}

function animate(timestamp) {
  if (previousTimestamp === null) {
    previousTimestamp = timestamp;
  }

  const delta = timestamp - previousTimestamp;
  previousTimestamp = timestamp;
  const progressPerStep = FRAME_INTERVAL / getDurationMilliseconds();

  buttonStates.forEach((state) => {
    if (state.progress === state.targetProgress) {
      return;
    }

    state.stepAccumulator += delta;

    while (state.stepAccumulator >= FRAME_INTERVAL) {
      const direction = Math.sign(state.targetProgress - state.progress);
      const remainingProgress = Math.abs(state.targetProgress - state.progress);

      state.progress = remainingProgress <= progressPerStep
        ? state.targetProgress
        : clamp(state.progress + direction * progressPerStep, 0, 1);
      state.stepAccumulator -= FRAME_INTERVAL;

      if (
        (direction > 0 && state.progress >= state.targetProgress)
        || (direction < 0 && state.progress <= state.targetProgress)
      ) {
        state.progress = state.targetProgress;
        state.stepAccumulator = 0;
        break;
      }
    }

    drawButton(state);
  });

  if (hasActiveAnimations()) {
    animationFrameId = requestAnimationFrame(animate);
  } else {
    animationFrameId = null;
    previousTimestamp = null;
  }
}

function startAnimationLoop() {
  if (animationFrameId === null) {
    previousTimestamp = null;
    animationFrameId = requestAnimationFrame(animate);
  }
}

function setButtonTarget(state, targetProgress) {
  state.targetProgress = targetProgress;
  activeButtonState = state;
  startAnimationLoop();
}

buttonStates.forEach((state) => {
  state.button.addEventListener("pointerenter", () => setButtonTarget(state, 1));
  state.button.addEventListener("pointerleave", () => setButtonTarget(state, 0));
  state.button.addEventListener("focus", () => setButtonTarget(state, 1));
  state.button.addEventListener("blur", () => setButtonTarget(state, 0));
});

const resizeObserver = new ResizeObserver((entries) => {
  entries.forEach((entry) => {
    const state = buttonStates.find((candidate) => candidate.button === entry.target);

    if (state) {
      updateButtonGeometry(state);
    }
  });
});

buttonStates.forEach((state) => resizeObserver.observe(state.button));

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
    resetButtons();
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

startExponentInput.addEventListener("input", resetButtons);

durationInput.addEventListener("change", () => {
  durationInput.value = formatNumber(
    getDurationMilliseconds() / 1000,
    2
  ).replace(/\.00$/, "");
  resetButtons();
});

resetButtons();
