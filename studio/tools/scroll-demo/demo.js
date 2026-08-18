import {
  cloneSettings,
  getSpiralCameraPose,
  settings as defaultSettings
} from "/shared/wave-config.js";
import { createWaveRenderer } from "/shared/wave-renderer.js";

const container = document.getElementById("live-bg");
const settings = cloneSettings(defaultSettings);
const wave = createWaveRenderer(container, {
  settings,
  width: window.innerWidth,
  height: window.innerHeight,
  powerPreference: "high-performance"
});

let animationFrame = null;
let smoothedProgress = 0;
let lastFrameAt = performance.now();
const scrollEaseMs = 115;

function getScrollProgress() {
  const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

  return Math.max(0, Math.min(1, window.scrollY / scrollable));
}

function renderFrame(progress, elapsedMs) {
  const normalizedProgress = Math.max(0, Math.min(1, Number(progress)));
  const time = Math.max(0, Number(elapsedMs));

  wave.setCameraView(getSpiralCameraPose(normalizedProgress, settings));
  wave.renderAtPhase(settings.phase + time * settings.animationSpeed);
}

function animate(now) {
  const frameMs = Math.max(0, now - lastFrameAt);
  const targetProgress = getScrollProgress();
  const blend = 1 - Math.exp(-frameMs / scrollEaseMs);

  lastFrameAt = now;
  smoothedProgress += (targetProgress - smoothedProgress) * blend;
  renderFrame(smoothedProgress, now);
  animationFrame = requestAnimationFrame(animate);
}

function resize() {
  wave.setSize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  renderFrame(smoothedProgress, performance.now());
}

window.__scrollDemo = {
  renderFrame,
  stop() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }
};

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", () => {
  window.__scrollDemo.stop();
  wave.dispose();
});

resize();
animationFrame = requestAnimationFrame(animate);
