import {
  cloneSettings,
  getSpiralCameraPose,
  initDecision,
  settings as defaultSettings
} from "/shared/wave-config.js";
import { createWaveRenderer } from "/shared/wave-renderer.js";

const liveContainer = document.getElementById("live-bg");
const status = document.getElementById("bg-status");
const settings = cloneSettings(defaultSettings);

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const wave = createWaveRenderer(liveContainer, {
  settings,
  width: window.innerWidth,
  height: window.innerHeight,
  powerPreference: "high-performance"
});

let animationFrame = null;
let lastFrameAt = performance.now();
let lastStatusAt = 0;
let qualityAdjustedAt = 0;
let frameCounter = 0;
let averageFrameMs = 16.7;
let averageRenderMs = 0;
let currentPixelRatioLimit = settings.pixelRatioLimit;
let currentMeshSegments = settings.meshSegments;
let qualityMessage = "Live renderer active.";
let smoothedScrollProgress = null;
let versionFrameResizeTimer = null;
const scrollEaseMs = 115;
const qualityStepMs = 2200;

const versionPalettes = {
  radial: ["#153d73", "#e8f5ff", "#2445ac"],
  fold: ["#0b8068", "#960b65", "#ffa617"],
  grain: ["#00e2cc", "#ff1d92", "#ff5927"]
};

function mixColor(from, to, amount) {
  const fromRgb = from.match(/\w\w/g).map((value) => parseInt(value, 16));
  const toRgb = to.match(/\w\w/g).map((value) => parseInt(value, 16));
  const channels = fromRgb.map((value, index) =>
    Math.round(value + (toRgb[index] - value) * amount)
  );

  return `rgb(${channels.join(",")})`;
}

function getRampColor(palette, value) {
  const normalized = Math.max(0, Math.min(1, value));

  if (normalized < 0.5) {
    return mixColor(palette[0], palette[1], normalized * 2);
  }

  return mixColor(palette[1], palette[2], (normalized - 0.5) * 2);
}

function renderVersionFrame(canvas, version) {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(480, Math.round(rect.width * pixelRatio));
  const height = Math.max(300, Math.round(rect.height * pixelRatio));
  const context = canvas.getContext("2d");
  const palette = versionPalettes[version];
  const image = context.createImageData(width, height);

  canvas.width = width;
  canvas.height = height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x / width - 0.5) * 10;
      const ny = (y / height - 0.5) * 7;
      const d1 = Math.hypot(nx + 2.8, ny + 1.2);
      const d2 = Math.hypot(nx - 2.1, ny - 0.6);
      let wave;

      if (version === "radial") {
        wave = Math.cos(d1 * 2.1 - 1) + Math.cos(d2 * 2.1 - 1);
      } else {
        const foldedX = nx + 1.25 * Math.sin(ny * 0.55 + 0.7) + ny * 0.1;
        const foldedY = ny + 0.7 * Math.sin(nx * 0.38 - 0.35);
        wave =
          Math.cos(Math.hypot(foldedX + 2.8, foldedY + 1.2) * 1.51 - 1) +
          Math.cos(Math.hypot(nx * 0.88 - 2.1, ny * 1.12 - 0.6) * 1.51 - 1) +
          Math.cos((foldedX * 0.48 + foldedY * 0.18) * 1.51 - 1) * 0.36;
      }

      let normalized = wave / 4 + 0.5;

      if (version === "grain") {
        const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const random = (noise - Math.floor(noise)) - 0.5;
        normalized += random * 0.24;
      }

      const color = getRampColor(palette, normalized);
      const channels = color.match(/\d+/g).map(Number);
      const offset = (y * width + x) * 4;

      image.data[offset] = channels[0];
      image.data[offset + 1] = channels[1];
      image.data[offset + 2] = channels[2];
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

function renderVersionFrames() {
  document.querySelectorAll("[data-wave-version]").forEach((canvas) => {
    renderVersionFrame(canvas, canvas.dataset.waveVersion);
  });
}

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function getScrollProgress() {
  const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

  return Math.max(0, Math.min(1, window.scrollY / scrollable));
}

function updateSmoothedScrollProgress(frameMs) {
  const targetProgress = getScrollProgress();

  if (smoothedScrollProgress === null) {
    smoothedScrollProgress = targetProgress;
    return smoothedScrollProgress;
  }

  const blend = 1 - Math.exp(-Math.max(frameMs, 0) / scrollEaseMs);
  smoothedScrollProgress += (targetProgress - smoothedScrollProgress) * blend;

  if (Math.abs(targetProgress - smoothedScrollProgress) < 0.0004) {
    smoothedScrollProgress = targetProgress;
  }

  return smoothedScrollProgress;
}

function applyScrollCamera() {
  const progress = smoothedScrollProgress ?? getScrollProgress();

  wave.setCameraView(getSpiralCameraPose(progress, settings));
}

function resizeLiveRenderer() {
  wave.setSize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  applyScrollCamera();
}

function updateQualityIfNeeded(now) {
  if (now - qualityAdjustedAt < qualityStepMs) {
    return;
  }

  const struggling =
    averageFrameMs > initDecision.sustainTargetFrameMs ||
    averageRenderMs > initDecision.sustainTargetFrameMs * 0.78;
  const hasHeadroom =
    averageFrameMs < initDecision.upgradeFrameMs &&
    averageRenderMs < initDecision.upgradeRenderMs;

  if (struggling && currentMeshSegments > initDecision.minMeshSegments) {
    currentMeshSegments = Math.max(
      initDecision.minMeshSegments,
      Math.round(currentMeshSegments * 0.82 / 10) * 10
    );
    settings.meshSegments = currentMeshSegments;
    wave.setSettings(settings, { rebuild: true });
    qualityMessage = `Adjusted quality: mesh lowered to ${currentMeshSegments} segments.`;
    qualityAdjustedAt = now;
    return;
  }

  if (struggling && currentPixelRatioLimit > initDecision.minPixelRatio) {
    currentPixelRatioLimit = Math.max(
      initDecision.minPixelRatio,
      Number((currentPixelRatioLimit - 0.25).toFixed(2))
    );
    settings.pixelRatioLimit = currentPixelRatioLimit;
    wave.setSettings(settings);
    resizeLiveRenderer();
    qualityMessage = `Adjusted quality: pixel ratio capped at ${currentPixelRatioLimit.toFixed(2)}.`;
    qualityAdjustedAt = now;
    return;
  }

  if (!hasHeadroom) {
    return;
  }

  if (currentMeshSegments < initDecision.maxMeshSegments) {
    currentMeshSegments = Math.min(
      initDecision.maxMeshSegments,
      Math.round((currentMeshSegments + 50) / 10) * 10
    );
    settings.meshSegments = currentMeshSegments;
    wave.setSettings(settings, { rebuild: true });
    qualityMessage = `Adjusted quality: mesh raised to ${currentMeshSegments} segments.`;
    qualityAdjustedAt = now;
    return;
  }

  if (currentPixelRatioLimit < initDecision.maxPixelRatio) {
    currentPixelRatioLimit = Math.min(
      initDecision.maxPixelRatio,
      Number((currentPixelRatioLimit + 0.25).toFixed(2))
    );
    settings.pixelRatioLimit = currentPixelRatioLimit;
    wave.setSettings(settings);
    resizeLiveRenderer();
    qualityMessage = `Adjusted quality: pixel ratio raised to ${currentPixelRatioLimit.toFixed(2)}.`;
    qualityAdjustedAt = now;
  }
}

function updateStatus(now) {
  if (now - lastStatusAt < 250) {
    return;
  }

  lastStatusAt = now;

  const fps = 1000 / Math.max(averageFrameMs, 1);
  const phase = settings.phase + now * settings.animationSpeed;
  const loopFrame = Math.floor(((phase / (Math.PI * 2)) % 1) * 60);
  const scroll = Math.round(getScrollProgress() * 100);
  const cameraScroll = Math.round((smoothedScrollProgress ?? getScrollProgress()) * 100);

  setStatus(
    `${qualityMessage} ${fps.toFixed(0)}fps, render ${averageRenderMs.toFixed(1)}ms, ` +
      `${currentMeshSegments} segments, ${currentPixelRatioLimit.toFixed(2)} DPR cap, ` +
      `scroll ${scroll}% -> camera ${cameraScroll}%, loop frame ${loopFrame}/60.`
  );
}

function animate(now) {
  const frameMs = now - lastFrameAt;
  lastFrameAt = now;
  frameCounter += 1;
  averageFrameMs = averageFrameMs * 0.94 + frameMs * 0.06;

  updateSmoothedScrollProgress(frameMs);
  if (frameCounter > 90) {
    updateQualityIfNeeded(now);
  }

  applyScrollCamera();

  const renderStarted = performance.now();
  wave.renderAtPhase(settings.phase + now * settings.animationSpeed);
  averageRenderMs = averageRenderMs * 0.92 + (performance.now() - renderStarted) * 0.08;

  updateStatus(now);

  animationFrame = requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeLiveRenderer);
window.addEventListener("resize", () => {
  window.clearTimeout(versionFrameResizeTimer);
  versionFrameResizeTimer = window.setTimeout(renderVersionFrames, 160);
});
window.addEventListener("beforeunload", () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  wave.dispose();
});

setStatus("Starting live renderer...");
if (!window.location.hash) {
  window.scrollTo(0, 0);
}
resizeLiveRenderer();
renderVersionFrames();
animationFrame = requestAnimationFrame(animate);
