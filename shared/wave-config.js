export const settings = {
  cameraFov: 26,
  cameraX: -3.1,
  cameraY: 4.8,
  cameraZ: 8.4,
  lookAtX: -2.7,
  lookAtY: -0.6,
  lookAtZ: -1.1,
  meshWidth: 24,
  meshDepth: 27,
  meshSegments: 400,
  animationSpeed: 0.00015,
  rotationAmount: 0.136,
  rotationSpeed: 0.333333333333,
  sourceOne: {
    x: -4.05,
    y: -2,
    amplitude: 10
  },
  sourceTwo: {
    x: 2.1,
    y: 0.8,
    amplitude: 10
  },
  waveMode: "asymmetricFold",
  frequency: 1.51,
  phase: 1,
  heightScale: 2.4,
  damping: 0.55,
  asymmetry: 1.25,
  twist: 0.85,
  colorLow: "#0B8068",
  colorMid: "#960B65",
  colorHigh: "#FFA617",
  colorLowThreshold: 0.05,
  colorMidThreshold: 0.57,
  colorHighThreshold: 0.93,
  colorLowMidBlend: 1,
  colorMidHighBlend: 1,
  grainIntensity: 7.8,
  grainType: "none",
  grainContrast: 4.8,
  grainColorLow: "#00E2CC",
  grainColorMid: "#FF1D92",
  grainColorHigh: "#FF5927",
  grainColorIntensity: 1,
  grainColorOnly: true,
  grainPaletteSpread: 0.18,
  grainEdgeRange: 0.16,
  grainMidChance: 0.14,
  surfaceGrainScale: 230,
  cameraGrainIntensity: 0.42,
  cameraGrainScale: 1.15,
  cameraGrainBleed: 0.7,
  cameraGrainSoftness: 0.34,
  chromaticAberrationEnabled: true,
  chromaticAberration: 10,
  diffusionEnabled: false,
  diffusionAmount: 0.45,
  diffusionRadius: 20,
  halationEnabled: false,
  halationAmount: 0.75,
  halationRadius: 4,
  motionAberrationEnabled: true,
  motionAberrationAmount: 3.5,
  wireframe: false,
  pixelRatioLimit: 2,
  pathTurns: 0.21,
  pathRadiusGrowth: 7.4,
  pathLift: 8.4,
  pathArch: 0.4,
  pathSideDrift: 0
};

export const asymmetricFoldPhase = {
  xDrift: 1 / 3,
  yDrift: 1 / 3,
  secondarySource: 1
};

export const initDecision = {
  maxDecisionMs: 2500,
  benchmarkFrames: 45,
  targetAverageFrameMs: 33.3,
  sustainTargetFrameMs: 33.3,
  upgradeFrameMs: 26,
  upgradeRenderMs: 13,
  minMeshSegments: 300,
  maxMeshSegments: 700,
  minPixelRatio: 1.5,
  maxPixelRatio: 2.5
};

export function cloneSettings(source = settings) {
  return JSON.parse(JSON.stringify(source));
}

export function getSpiralCameraPose(scrollProgress, waveSettings = settings) {
  const t = Math.max(0, Math.min(1, scrollProgress));
  const eased = t * t * (3 - 2 * t);
  const startRadius = Math.hypot(waveSettings.cameraX, waveSettings.cameraZ);
  const startAngle = Math.atan2(waveSettings.cameraZ, waveSettings.cameraX);
  const turns = waveSettings.pathTurns ?? 1.35;
  const radius = startRadius + eased * (waveSettings.pathRadiusGrowth ?? 8.5);
  const angle = startAngle + eased * Math.PI * 2 * turns;
  const verticalLift =
    Math.sin(eased * Math.PI) * (waveSettings.pathArch ?? 1.4) +
    eased * (waveSettings.pathLift ?? 2.6);
  const sideDrift = Math.sin(eased * Math.PI * 2) * (waveSettings.pathSideDrift ?? 0);

  return {
    cameraX: Math.cos(angle) * radius + sideDrift,
    cameraY: waveSettings.cameraY + verticalLift,
    cameraZ: Math.sin(angle) * radius,
    lookAtX: waveSettings.lookAtX,
    lookAtY: waveSettings.lookAtY,
    lookAtZ: waveSettings.lookAtZ
  };
}
