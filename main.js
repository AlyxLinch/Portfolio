import { createWaveRenderer } from "./shared/wave-renderer.js";
import {
  cloneSettings,
  getSpiralCameraPose,
  settings as defaultSettings
} from "./shared/wave-config.js";

const container = document.getElementById("mesh-bg");
const controlList = document.getElementById("control-list");
const saveButton = document.getElementById("save-defaults");
const saveStatus = document.getElementById("save-status");

if (!container) {
  throw new Error('No element found with id="mesh-bg"');
}

const wave = createWaveRenderer(container, {
  settings: cloneSettings(defaultSettings)
});
const settings = wave.settings;

let pathPreview = 0;
let animationFrame = null;
let latestTime = 0;

const controls = [
  { type: "section", label: "Camera" },
  { key: "cameraFov", label: "FOV", min: 10, max: 80, step: 1 },
  { key: "cameraX", label: "Camera X", min: -18, max: 18, step: 0.1 },
  { key: "cameraY", label: "Camera Y", min: 1, max: 18, step: 0.1 },
  { key: "cameraZ", label: "Camera Z", min: 1, max: 22, step: 0.1 },
  { key: "lookAtX", label: "Look X", min: -12, max: 12, step: 0.1 },
  { key: "lookAtY", label: "Look Y", min: -8, max: 8, step: 0.1 },
  { key: "lookAtZ", label: "Look Z", min: -12, max: 12, step: 0.1 },

  { type: "section", label: "Scroll Path" },
  { key: "pathPreview", label: "Path scrub", min: 0, max: 1, step: 0.001, precision: 3, virtual: true },
  { key: "pathTurns", label: "Turns", min: -3, max: 3, step: 0.01, precision: 2 },
  { key: "pathRadiusGrowth", label: "Radius +", min: -12, max: 18, step: 0.1 },
  { key: "pathLift", label: "Lift", min: -8, max: 12, step: 0.1 },
  { key: "pathArch", label: "Arch", min: -8, max: 8, step: 0.1 },
  { key: "pathSideDrift", label: "Side drift", min: -8, max: 8, step: 0.1 },

  { type: "section", label: "Mesh" },
  { key: "meshWidth", label: "Width", min: 6, max: 80, step: 1, rebuild: true },
  { key: "meshDepth", label: "Depth", min: 6, max: 80, step: 1, rebuild: true },
  { key: "meshSegments", label: "Segments", min: 40, max: 900, step: 10, rebuild: true, integer: true },
  { key: "pixelRatioLimit", label: "Pixel ratio", min: 0.5, max: 3, step: 0.05, precision: 2 },

  { type: "section", label: "Motion" },
  { key: "animationSpeed", label: "Speed", min: 0, max: 0.001, step: 0.00001, precision: 5 },
  { key: "rotationAmount", label: "Tilt", min: 0, max: 0.5, step: 0.001, precision: 3 },
  { key: "rotationSpeed", label: "Tilt speed", min: -2, max: 2, step: 0.01, precision: 2 },
  { key: "phase", label: "Phase", min: 0, max: Math.PI * 2, step: 0.01, precision: 2 },

  { type: "section", label: "Wave" },
  {
    key: "waveMode",
    label: "Mode",
    type: "select",
    options: ["asymmetricFold", "radialInterference", "spiralInterference", "diagonalShear"]
  },
  { key: "frequency", label: "Frequency", min: 0.2, max: 5, step: 0.01, precision: 2 },
  { key: "heightScale", label: "Height", min: 0, max: 8, step: 0.05, precision: 2 },
  { key: "damping", label: "Damping", min: 0, max: 3, step: 0.01, precision: 2 },
  { key: "asymmetry", label: "Asymmetry", min: -4, max: 4, step: 0.01, precision: 2 },
  { key: "twist", label: "Twist", min: -5, max: 5, step: 0.01, precision: 2 },
  { key: "sourceOne.amplitude", label: "Source 1", min: -20, max: 20, step: 0.1 },
  { key: "sourceTwo.amplitude", label: "Source 2", min: -20, max: 20, step: 0.1 },
  { key: "sourceOne.x", label: "S1 X", min: -8, max: 8, step: 0.05, precision: 2 },
  { key: "sourceOne.y", label: "S1 Y", min: -8, max: 8, step: 0.05, precision: 2 },
  { key: "sourceTwo.x", label: "S2 X", min: -8, max: 8, step: 0.05, precision: 2 },
  { key: "sourceTwo.y", label: "S2 Y", min: -8, max: 8, step: 0.05, precision: 2 },

  { type: "section", label: "Color" },
  { key: "colorLow", label: "Low", type: "color" },
  { key: "colorMid", label: "Mid", type: "color" },
  { key: "colorHigh", label: "High", type: "color" },
  { key: "colorLowThreshold", label: "Low stop", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "colorMidThreshold", label: "Mid stop", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "colorHighThreshold", label: "High stop", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "colorLowMidBlend", label: "Blend L/M", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "colorMidHighBlend", label: "Blend M/H", min: 0, max: 1, step: 0.01, precision: 2 },

  { type: "section", label: "Grain" },
  {
    key: "grainType",
    label: "Type",
    type: "select",
    options: ["none", "cameraAirbrush", "referenceMapped", "surfaceMapped", "referenceFine", "fine", "coarse", "cloud"]
  },
  { key: "grainIntensity", label: "Intensity", min: 0, max: 8, step: 0.05, precision: 2 },
  { key: "grainContrast", label: "Contrast", min: 0.5, max: 8, step: 0.05, precision: 2 },
  { key: "grainColorLow", label: "Low color", type: "color" },
  { key: "grainColorMid", label: "Mid color", type: "color" },
  { key: "grainColorHigh", label: "High color", type: "color" },
  { key: "grainColorIntensity", label: "Color strength", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "grainColorOnly", label: "Color only", type: "toggle" },
  { key: "grainPaletteSpread", label: "Palette spread", min: 0, max: 0.75, step: 0.005, precision: 3 },
  { key: "grainEdgeRange", label: "Edge range", min: 0.01, max: 0.5, step: 0.005, precision: 3 },
  { key: "grainMidChance", label: "Mid flecks", min: 0, max: 0.6, step: 0.01, precision: 2 },
  { key: "surfaceGrainScale", label: "Surface scale", min: 20, max: 900, step: 5, integer: true },
  { key: "cameraGrainIntensity", label: "Filter amount", min: 0, max: 1, step: 0.01, precision: 2 },
  { key: "cameraGrainScale", label: "Filter grain size", min: 0.25, max: 4, step: 0.05, precision: 2 },
  { key: "cameraGrainBleed", label: "Color bleed", min: 0, max: 2.5, step: 0.05, precision: 2 },
  { key: "cameraGrainSoftness", label: "Airbrush softness", min: 0, max: 1, step: 0.01, precision: 2 },

  { type: "section", label: "Camera Effects" },
  { key: "chromaticAberrationEnabled", label: "Chromatic aberration", type: "toggle" },
  { key: "chromaticAberration", label: "Chromatic amount", min: 0, max: 6, step: 0.1, precision: 1 },
  { key: "diffusionEnabled", label: "Soft diffusion", type: "toggle" },
  { key: "diffusionAmount", label: "Diffusion mix", min: 0, max: 0.75, step: 0.01, precision: 2 },
  { key: "diffusionRadius", label: "Diffusion radius", min: 0.5, max: 10, step: 0.1, precision: 1 },
  { key: "halationEnabled", label: "Light halation", type: "toggle" },
  { key: "halationAmount", label: "Halation amount", min: 0, max: 0.75, step: 0.01, precision: 2 },
  { key: "halationRadius", label: "Halation radius", min: 1, max: 16, step: 0.5, precision: 1 },
  { key: "motionAberrationEnabled", label: "Scroll aberration", type: "toggle" },
  { key: "motionAberrationAmount", label: "Motion amount", min: 0, max: 6, step: 0.1, precision: 1 }
];

function getSettingValue(key) {
  return key.split(".").reduce((value, part) => value?.[part], settings);
}

function setSettingValue(key, value) {
  const parts = key.split(".");
  const last = parts.pop();
  const target = parts.reduce((entry, part) => entry[part], settings);

  target[last] = value;
}

function formatControlValue(control) {
  const value = control.virtual ? pathPreview : getSettingValue(control.key);

  if (control.type === "color" || control.type === "select") {
    return value;
  }

  if (control.type === "toggle") {
    return value ? "On" : "Off";
  }

  if (control.integer) {
    return Math.round(value).toString();
  }

  if (typeof control.precision === "number") {
    return Number(value).toFixed(control.precision);
  }

  return Number.isInteger(value) ? value.toString() : Number(value).toFixed(2);
}

function applyCameraPreview() {
  wave.setCameraView(getSpiralCameraPose(pathPreview, settings));
}

function applyControlValue(control, rawValue) {
  if (control.virtual) {
    pathPreview = Number(rawValue);
    applyCameraPreview();
    return;
  }

  const value = control.integer ? Math.round(Number(rawValue)) : rawValue;
  const normalizedValue =
    control.type === "color" || control.type === "select" || control.type === "toggle"
      ? value
      : Number(value);

  setSettingValue(control.key, normalizedValue);
  wave.setSettings(settings, { rebuild: control.rebuild });
  applyCameraPreview();

  if (control.key === "pixelRatioLimit") {
    wave.setSize(window.innerWidth, window.innerHeight);
  }
}

function buildControlCard() {
  if (!controlList) {
    return;
  }

  for (const control of controls) {
    if (control.type === "section") {
      const heading = document.createElement("h2");
      heading.className = "control-section";
      heading.textContent = control.label;
      controlList.append(heading);
      continue;
    }

    const row = document.createElement("div");
    const label = document.createElement("label");
    const output = document.createElement("output");
    let input;

    row.className = `control control--${control.type || "range"}`;
    label.textContent = control.label;
    label.htmlFor = `control-${control.key.replaceAll(".", "-")}`;
    output.value = formatControlValue(control);

    if (control.type === "select") {
      input = document.createElement("select");
      for (const optionValue of control.options) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        input.append(option);
      }
      input.value = getSettingValue(control.key);
    } else {
      input = document.createElement("input");
      input.type =
        control.type === "color" ? "color" :
        control.type === "toggle" ? "checkbox" :
        "range";

      if (input.type === "checkbox") {
        input.checked = Boolean(getSettingValue(control.key));
      } else {
        input.value = control.virtual ? pathPreview : getSettingValue(control.key);
      }

      if (input.type === "range") {
        input.min = control.min;
        input.max = control.max;
        input.step = control.step;
      }
    }

    input.id = `control-${control.key.replaceAll(".", "-")}`;
    input.addEventListener("input", () => {
      const nextValue =
        input.type === "range" ? input.valueAsNumber :
        input.type === "checkbox" ? input.checked :
        input.value;

      applyControlValue(control, nextValue);
      output.value = formatControlValue(control);

      if (saveStatus) {
        saveStatus.textContent = "";
      }
    });

    row.append(label, input, output);
    controlList.append(row);
  }
}

function serializeValue(value, indentLevel = 1) {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => `${nextIndent}${key}: ${serializeValue(entryValue, indentLevel + 1)}`)
      .join(",\n");

    return `{\n${entries}\n${indent}}`;
  }

  return "null";
}

function serializeSettings() {
  const entries = Object.entries(settings)
    .map(([key, value]) => `  ${key}: ${serializeValue(value)}`)
    .join(",\n");

  return `export const settings = {\n${entries}\n};`;
}

async function saveSettingsToConfig() {
  if (!saveButton || !saveStatus) {
    return;
  }

  saveButton.disabled = true;
  saveStatus.textContent = "Saving...";

  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, settingsSource: serializeSettings() })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Could not save settings.");
    }

    saveStatus.textContent = "Settings saved to shared/wave-config.js.";
  } catch (error) {
    saveStatus.textContent = `Save failed: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
}

function animate(time) {
  latestTime = time;
  const phase = settings.phase + time * settings.animationSpeed;

  applyCameraPreview();
  wave.renderAtPhase(phase);
  animationFrame = requestAnimationFrame(animate);
}

buildControlCard();
saveButton?.addEventListener("click", saveSettingsToConfig);
window.addEventListener("resize", () => {
  wave.setSize(window.innerWidth, window.innerHeight);
  applyCameraPreview();
  wave.renderAtPhase(settings.phase + latestTime * settings.animationSpeed);
});

window.waveTuner = {
  wave,
  settings,
  get pathPreview() {
    return pathPreview;
  },
  setPathPreview(value) {
    pathPreview = Math.max(0, Math.min(1, Number(value)));
    applyCameraPreview();
  }
};

animationFrame = requestAnimationFrame(animate);
