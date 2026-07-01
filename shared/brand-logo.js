const baseStops = [
  ["--logo-base-s1", 18.5],
  ["--logo-base-s2", 38],
  ["--logo-base-s3", 47.75],
  ["--logo-base-s4", 57.5],
  ["--logo-base-s5", 62.512],
  ["--logo-base-s6", 67.525],
  ["--logo-base-s7", 77.55],
  ["--logo-base-s8", 87.575],
  ["--logo-base-s9", 97.6]
];

const accentStops = [
  ["--logo-accent-s1", 18.5],
  ["--logo-accent-s2", 20.938],
  ["--logo-accent-s3", 23.375],
  ["--logo-accent-s4", 28.25],
  ["--logo-accent-s5", 33.125],
  ["--logo-accent-s6", 38],
  ["--logo-accent-s7", 42.875],
  ["--logo-accent-s8", 47.75],
  ["--logo-accent-s9", 52.625],
  ["--logo-accent-s10", 55.062],
  ["--logo-accent-s11", 57.5],
  ["--logo-accent-s12", 60.825],
  ["--logo-accent-s13", 64.15],
  ["--logo-accent-s14", 70.8],
  ["--logo-accent-s15", 77.45],
  ["--logo-accent-s16", 80.775],
  ["--logo-accent-s17", 84.1]
];

const stopGroups = [...baseStops, ...accentStops];
const driftMargin = 4.5;
const minGap = 0.65;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function makeTargetStops(stops) {
  let previous = 0;

  return stops.map(([property, original], index) => {
    const remaining = stops.length - index - 1;
    const max = Math.min(99 - remaining * minGap, original + driftMargin);
    const min = Math.max(previous + minGap, original - driftMargin);
    const next = clamp(original + (Math.random() * 2 - 1) * driftMargin, min, max);

    previous = next;
    return [property, next];
  });
}

function applyStops(logo, values) {
  for (const [property, value] of values) {
    logo.style.setProperty(property, `${value.toFixed(3)}%`);
  }
}

function animateLogo(logo) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    return;
  }

  let startTime = performance.now();
  let duration = 7200 + Math.random() * 2600;
  let fromStops = stopGroups.map(([property, original]) => [property, original]);
  let toStops = [...makeTargetStops(baseStops), ...makeTargetStops(accentStops)];

  function frame(now) {
    const progress = clamp((now - startTime) / duration, 0, 1);
    const eased = easeInOutCubic(progress);
    const currentStops = fromStops.map(([property, from], index) => [
      property,
      from + (toStops[index][1] - from) * eased
    ]);

    applyStops(logo, currentStops);

    if (progress >= 1) {
      startTime = now;
      duration = 7200 + Math.random() * 2600;
      fromStops = toStops;
      toStops = [...makeTargetStops(baseStops), ...makeTargetStops(accentStops)];
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export function initBrandLogos() {
  document.querySelectorAll(".brand-logo").forEach(animateLogo);
}
