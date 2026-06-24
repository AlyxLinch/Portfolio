import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { asymmetricFoldPhase, cloneSettings, settings as defaultSettings } from "./wave-config.js";

function createNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  let seed = 123456789;

  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;

    return seed / 4294967296;
  }

  for (let i = 0; i < size * size; i++) {
    const value = Math.floor(random() * 255);
    const offset = i * 4;

    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

function getBlendProgress(value, blendAmount) {
  const blendWidth = THREE.MathUtils.clamp(blendAmount, 0, 1);

  if (blendWidth <= 0.0001) {
    return value < 0.5 ? 0 : 1;
  }

  const blendStart = (1 - blendWidth) / 2;
  const blendEnd = 1 - blendStart;

  if (value <= blendStart) {
    return 0;
  }

  if (value >= blendEnd) {
    return 1;
  }

  return THREE.MathUtils.smoothstep(
    (value - blendStart) / (blendEnd - blendStart),
    0,
    1
  );
}

export function createWaveRenderer(container, options = {}) {
  if (!container) {
    throw new Error("Wave renderer requires a container element.");
  }

  const settings = cloneSettings(options.settings || defaultSettings);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    settings.cameraFov,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    100
  );
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: options.powerPreference || "high-performance"
  });
  const grainTexture = createNoiseTexture();
  const postScene = new THREE.Scene();
  const postCamera = new THREE.Camera();
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 4
  });
  renderTarget.texture.magFilter = THREE.LinearFilter;
  renderTarget.texture.minFilter = THREE.LinearFilter;
  renderTarget.texture.generateMipmaps = false;
  const postMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: false,
    uniforms: {
      uSceneTexture: { value: renderTarget.texture },
      uNoiseTexture: { value: grainTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uFrame: { value: 0 },
      uIntensity: { value: settings.cameraGrainIntensity ?? 0.42 },
      uGrainScale: { value: settings.cameraGrainScale ?? 1.15 },
      uBleed: { value: settings.cameraGrainBleed ?? 0.7 },
      uSoftness: { value: settings.cameraGrainSoftness ?? 0.34 },
      uAirbrushEnabled: { value: settings.grainType === "cameraAirbrush" },
      uChromaticEnabled: { value: Boolean(settings.chromaticAberrationEnabled) },
      uChromaticAmount: { value: settings.chromaticAberration ?? 1.5 },
      uDiffusionEnabled: { value: Boolean(settings.diffusionEnabled) },
      uDiffusionAmount: { value: settings.diffusionAmount ?? 0.18 },
      uDiffusionRadius: { value: settings.diffusionRadius ?? 2.5 },
      uHalationEnabled: { value: Boolean(settings.halationEnabled) },
      uHalationAmount: { value: settings.halationAmount ?? 0.16 },
      uHalationRadius: { value: settings.halationRadius ?? 4 },
      uMotionEnabled: { value: Boolean(settings.motionAberrationEnabled) },
      uMotionAmount: { value: settings.motionAberrationAmount ?? 1.4 },
      uCameraMotion: { value: new THREE.Vector2() }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D uSceneTexture;
      uniform sampler2D uNoiseTexture;
      uniform vec2 uResolution;
      uniform float uFrame;
      uniform float uIntensity;
      uniform float uGrainScale;
      uniform float uBleed;
      uniform float uSoftness;
      uniform bool uAirbrushEnabled;
      uniform bool uChromaticEnabled;
      uniform float uChromaticAmount;
      uniform bool uDiffusionEnabled;
      uniform float uDiffusionAmount;
      uniform float uDiffusionRadius;
      uniform bool uHalationEnabled;
      uniform float uHalationAmount;
      uniform float uHalationRadius;
      uniform bool uMotionEnabled;
      uniform float uMotionAmount;
      uniform vec2 uCameraMotion;

      varying vec2 vUv;

      float hash21(vec2 point) {
        vec3 p3 = fract(vec3(point.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);

        return fract((p3.x + p3.y) * p3.z);
      }

      float luminance(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
      }

      void main() {
        vec2 texel = 1.0 / max(uResolution, vec2(1.0));
        float grainSize = max(uGrainScale, 0.25);
        vec2 grainCell = floor(gl_FragCoord.xy / grainSize);
        vec2 frameSeed = vec2(uFrame * 17.17, uFrame * 31.73);
        float fineNoise = hash21(grainCell + frameSeed);
        float secondNoise = hash21(grainCell * 1.731 + frameSeed.yx + 19.41);
        float broadNoise = hash21(floor(grainCell * 0.13) + frameSeed * 0.07);
        float grain = fineNoise * 0.62 + secondNoise * 0.28 + broadNoise * 0.1;
        vec2 direction = normalize(vec2(fineNoise - 0.5, secondNoise - 0.5) + vec2(0.0001));
        vec2 bleedOffset = direction * texel * uBleed * 5.0;

        vec4 center = texture2D(uSceneTexture, vUv);
        vec3 filtered = center.rgb;
        vec2 edgeDirection = vUv - 0.5;
        vec2 chromaticOffset = edgeDirection * texel * uChromaticAmount;
        vec2 motionOffset = uCameraMotion * texel * uMotionAmount;
        vec2 totalAberration = vec2(0.0);

        if (uChromaticEnabled) {
          totalAberration += chromaticOffset;
        }

        if (uMotionEnabled) {
          totalAberration += motionOffset;
        }

        if (uChromaticEnabled || uMotionEnabled) {
          vec4 redChannel = texture2D(
            uSceneTexture,
            clamp(vUv + totalAberration, 0.0, 1.0)
          );
          vec4 blueChannel = texture2D(
            uSceneTexture,
            clamp(vUv - totalAberration, 0.0, 1.0)
          );
          filtered = vec3(redChannel.r, center.g, blueChannel.b);
        }

        vec2 softOffset = texel * uDiffusionRadius;
        vec4 softSample =
          texture2D(uSceneTexture, clamp(vUv + vec2(softOffset.x, 0.0), 0.0, 1.0)) +
          texture2D(uSceneTexture, clamp(vUv - vec2(softOffset.x, 0.0), 0.0, 1.0)) +
          texture2D(uSceneTexture, clamp(vUv + vec2(0.0, softOffset.y), 0.0, 1.0)) +
          texture2D(uSceneTexture, clamp(vUv - vec2(0.0, softOffset.y), 0.0, 1.0));
        softSample *= 0.25;

        if (uDiffusionEnabled) {
          filtered = mix(
            filtered,
            softSample.rgb,
            clamp(uDiffusionAmount, 0.0, 1.0)
          );
        }

        if (uHalationEnabled) {
          vec2 haloOffset = texel * uHalationRadius;
          vec3 halo =
            texture2D(uSceneTexture, clamp(vUv + vec2(haloOffset.x, 0.0), 0.0, 1.0)).rgb +
            texture2D(uSceneTexture, clamp(vUv - vec2(haloOffset.x, 0.0), 0.0, 1.0)).rgb +
            texture2D(uSceneTexture, clamp(vUv + vec2(0.0, haloOffset.y), 0.0, 1.0)).rgb +
            texture2D(uSceneTexture, clamp(vUv - vec2(0.0, haloOffset.y), 0.0, 1.0)).rgb;
          halo *= 0.25;
          float haloMask = smoothstep(0.38, 0.82, luminance(halo));
          filtered += max(halo - center.rgb, vec3(0.0)) *
            haloMask *
            clamp(uHalationAmount, 0.0, 1.0);
        }

        if (uAirbrushEnabled) {
          vec4 redSample = texture2D(uSceneTexture, clamp(vUv + bleedOffset, 0.0, 1.0));
          vec4 blueSample = texture2D(uSceneTexture, clamp(vUv - bleedOffset, 0.0, 1.0));
          vec3 colorBleed = vec3(redSample.r, center.g, blueSample.b);
          vec2 airbrushOffset = texel * (1.5 + uBleed * 2.5);
          vec4 airbrushSoft =
            texture2D(uSceneTexture, clamp(vUv + vec2(airbrushOffset.x, 0.0), 0.0, 1.0)) +
            texture2D(uSceneTexture, clamp(vUv - vec2(airbrushOffset.x, 0.0), 0.0, 1.0)) +
            texture2D(uSceneTexture, clamp(vUv + vec2(0.0, airbrushOffset.y), 0.0, 1.0)) +
            texture2D(uSceneTexture, clamp(vUv - vec2(0.0, airbrushOffset.y), 0.0, 1.0));
          airbrushSoft *= 0.25;
          float filterAmount = clamp(uIntensity, 0.0, 1.0);
          float grainSignal = (grain - 0.5) * 2.0;
          float grainMask = smoothstep(0.12, 0.82, abs(grainSignal));
          float bleedAmount = filterAmount * grainMask * clamp(uBleed * 0.32, 0.0, 0.8);
          filtered = mix(filtered, colorBleed, bleedAmount);
          filtered = mix(
            filtered,
            airbrushSoft.rgb,
            filterAmount * clamp(uSoftness, 0.0, 1.0) * grainMask * 0.42
          );

          vec3 chromaGrain = vec3(
            grainSignal,
            (secondNoise - 0.5) * 2.0,
            fineNoise - secondNoise
          );
          chromaGrain -= vec3(luminance(chromaGrain));
          filtered += chromaGrain * filterAmount * 0.16;
          filtered += vec3(luminance(center.rgb) - luminance(filtered));
        }

        float sourceLuminance = luminance(center.rgb);
        float effectLuminance = luminance(filtered);
        filtered += vec3(max(sourceLuminance - effectLuminance, 0.0));
        filtered = clamp(filtered, 0.0, 1.0);

        gl_FragColor = vec4(filtered, center.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const postQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    postMaterial
  );
  postScene.add(postQuad);
  let renderFrame = 0;
  let previousViewPosition = null;
  const material = new THREE.ShaderMaterial({
    vertexColors: true,
    wireframe: settings.wireframe,
    side: THREE.DoubleSide,
    uniforms: {
      uGrainTexture: { value: grainTexture },
      uUseSurfaceGrain: { value: false },
      uGrainIntensity: { value: 0 },
      uGrainContrast: { value: 1 },
      uSurfaceGrainScale: { value: settings.surfaceGrainScale },
      uSurfaceGrainMode: { value: 0 },
      uHeightMin: { value: -1 },
      uHeightMax: { value: 1 },
      uColorLow: { value: new THREE.Color(settings.colorLow) },
      uColorMid: { value: new THREE.Color(settings.colorMid) },
      uColorHigh: { value: new THREE.Color(settings.colorHigh) },
      uGrainColorLow: { value: new THREE.Color(settings.grainColorLow || "#00E2CC") },
      uGrainColorMid: { value: new THREE.Color(settings.grainColorMid || "#FF1D92") },
      uGrainColorHigh: { value: new THREE.Color(settings.grainColorHigh || "#FF5927") },
      uGrainColorIntensity: { value: settings.grainColorIntensity ?? 0.45 },
      uGrainColorOnly: { value: Boolean(settings.grainColorOnly) },
      uGrainPaletteSpread: { value: settings.grainPaletteSpread ?? 0.18 },
      uGrainEdgeRange: { value: settings.grainEdgeRange ?? 0.16 },
      uGrainMidChance: { value: settings.grainMidChance ?? 0.14 },
      uColorLowThreshold: { value: settings.colorLowThreshold },
      uColorMidThreshold: { value: settings.colorMidThreshold },
      uColorHighThreshold: { value: settings.colorHighThreshold },
      uColorLowMidBlend: { value: settings.colorLowMidBlend },
      uColorMidHighBlend: { value: settings.colorMidHighBlend }
    },
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vWorldPosition;

      void main() {
        vColor = color;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform bool uUseSurfaceGrain;
      uniform sampler2D uGrainTexture;
      uniform float uGrainIntensity;
      uniform float uGrainContrast;
      uniform float uSurfaceGrainScale;
      uniform float uSurfaceGrainMode;
      uniform float uHeightMin;
      uniform float uHeightMax;
      uniform vec3 uColorLow;
      uniform vec3 uColorMid;
      uniform vec3 uColorHigh;
      uniform vec3 uGrainColorLow;
      uniform vec3 uGrainColorMid;
      uniform vec3 uGrainColorHigh;
      uniform float uGrainColorIntensity;
      uniform bool uGrainColorOnly;
      uniform float uGrainPaletteSpread;
      uniform float uGrainEdgeRange;
      uniform float uGrainMidChance;
      uniform float uColorLowThreshold;
      uniform float uColorMidThreshold;
      uniform float uColorHighThreshold;
      uniform float uColorLowMidBlend;
      uniform float uColorMidHighBlend;

      varying vec3 vColor;
      varying vec3 vWorldPosition;

      vec2 rotate2d(vec2 point, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);

        return mat2(cosine, -sine, sine, cosine) * point;
      }

      float getBlendProgress(float value, float blendAmount) {
        float blendWidth = clamp(blendAmount, 0.0, 1.0);

        if (blendWidth <= 0.0001) {
          return value < 0.5 ? 0.0 : 1.0;
        }

        float blendStart = (1.0 - blendWidth) * 0.5;
        float blendEnd = 1.0 - blendStart;

        if (value <= blendStart) {
          return 0.0;
        }

        if (value >= blendEnd) {
          return 1.0;
        }

        return smoothstep(0.0, 1.0, (value - blendStart) / (blendEnd - blendStart));
      }

      vec3 getGrainColor(float normalizedHeight) {
        float lowStop = clamp(uColorLowThreshold, 0.0, 1.0);
        float midStop = clamp(uColorMidThreshold, 0.0, 1.0);
        float highStop = clamp(uColorHighThreshold, 0.0, 1.0);
        float lowToMid = max(midStop - lowStop, 0.0001);
        float midToHigh = max(highStop - midStop, 0.0001);

        if (normalizedHeight <= lowStop) {
          return uGrainColorLow;
        }

        if (normalizedHeight <= midStop) {
          float localT = (normalizedHeight - lowStop) / lowToMid;
          return mix(uGrainColorLow, uGrainColorMid, getBlendProgress(localT, uColorLowMidBlend));
        }

        if (normalizedHeight <= highStop) {
          float localT = (normalizedHeight - midStop) / midToHigh;
          return mix(uGrainColorMid, uGrainColorHigh, getBlendProgress(localT, uColorMidHighBlend));
        }

        return uGrainColorHigh;
      }

      vec3 getMeshColor(float normalizedHeight) {
        float lowStop = clamp(uColorLowThreshold, 0.0, 1.0);
        float midStop = clamp(uColorMidThreshold, 0.0, 1.0);
        float highStop = clamp(uColorHighThreshold, 0.0, 1.0);
        float lowToMid = max(midStop - lowStop, 0.0001);
        float midToHigh = max(highStop - midStop, 0.0001);

        if (normalizedHeight <= lowStop) {
          return uColorLow;
        }

        if (normalizedHeight <= midStop) {
          float localT = (normalizedHeight - lowStop) / lowToMid;
          return mix(uColorLow, uColorMid, getBlendProgress(localT, uColorLowMidBlend));
        }

        if (normalizedHeight <= highStop) {
          float localT = (normalizedHeight - midStop) / midToHigh;
          return mix(uColorMid, uColorHigh, getBlendProgress(localT, uColorMidHighBlend));
        }

        return uColorHigh;
      }

      vec3 getExpandedGrainColor(float palettePosition, float midNoise) {
        float edgeRange = max(uGrainEdgeRange, 0.0001);
        float lowStop = clamp(uColorLowThreshold, 0.0, 1.0);
        float midStop = clamp(uColorMidThreshold, 0.0, 1.0);
        float highStop = clamp(uColorHighThreshold, 0.0, 1.0);

        vec3 rampColor;

        if (palettePosition < 0.0) {
          rampColor = mix(
            uGrainColorLow,
            uColorLow,
            smoothstep(-edgeRange, 0.0, palettePosition)
          );
        } else if (palettePosition > 1.0) {
          rampColor = mix(
            uColorHigh,
            uGrainColorHigh,
            smoothstep(1.0, 1.0 + edgeRange, palettePosition)
          );
        } else {
          rampColor = getMeshColor(palettePosition);
        }

        float midBandWidth = max(
          min(midStop - lowStop, highStop - midStop) * 0.85,
          0.08
        );
        float midProximity =
          1.0 - smoothstep(midBandWidth * 0.35, midBandWidth, abs(palettePosition - midStop));
        float midFleck = step(
          1.0 - clamp(uGrainMidChance, 0.0, 1.0) * midProximity,
          midNoise
        );

        return mix(rampColor, uGrainColorMid, midFleck);
      }

      void main() {
        vec3 finalColor = vColor;

        if (uUseSurfaceGrain && uGrainIntensity > 0.0) {
          vec2 surfacePoint = vWorldPosition.xz * uSurfaceGrainScale * 0.003;
          float crispAmount = uSurfaceGrainMode < 0.5 ? 0.9 : 0.68;
          float fineA = texture2D(uGrainTexture, surfacePoint).r;
          float fineB = texture2D(uGrainTexture, rotate2d(surfacePoint * 1.73 + vec2(0.163, 0.719), 0.71)).r;
          float fineC = texture2D(uGrainTexture, rotate2d(surfacePoint * 2.31 + vec2(0.587, 0.271), -0.43)).r;
          float fineGrain = fineA * 0.5 + fineB * 0.3 + fineC * 0.2;
          float grain =
            fineGrain * crispAmount +
            texture2D(uGrainTexture, rotate2d(surfacePoint * 0.18 + vec2(0.372, 0.916), 0.29)).r * (1.0 - crispAmount);

          float centeredGrain = (grain - 0.5) * uGrainContrast;
          float variation = uSurfaceGrainMode < 0.5 ? 0.28 : 0.7;
          float grainSignal = centeredGrain * variation * uGrainIntensity;
          float multiplier = 1.0 + grainSignal * 0.42;
          float normalizedHeight = clamp((vWorldPosition.y - uHeightMin) / max(uHeightMax - uHeightMin, 0.0001), 0.0, 1.0);
          vec3 grainColor = getGrainColor(normalizedHeight);
          float grainStrength = smoothstep(0.5, 1.15, abs(centeredGrain));
          float grainColorAmount =
            grainStrength *
            clamp(uGrainIntensity * 0.2, 0.0, 1.0) *
            clamp(uGrainColorIntensity, 0.0, 1.0);

          if (uGrainColorOnly) {
            float paletteOffset =
              clamp(centeredGrain, -1.0, 1.0) *
              clamp(uGrainPaletteSpread, 0.0, 1.0) *
              clamp(uGrainIntensity * 0.25, 0.0, 1.0);
            float palettePosition = clamp(
              normalizedHeight + paletteOffset,
              -uGrainEdgeRange,
              1.0 + uGrainEdgeRange
            );
            vec3 paletteGrain = getExpandedGrainColor(palettePosition, fineC);
            finalColor = mix(finalColor, paletteGrain, clamp(uGrainColorIntensity, 0.0, 1.0));
          } else {
            finalColor = mix(
              clamp(finalColor * multiplier, 0.0, 1.0),
              grainColor,
              grainColorAmount
            );
          }
        }

        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  let geometry = createGeometry(settings);
  const mesh = new THREE.Mesh(geometry, material);
  const colors = {
    low: new THREE.Color(settings.colorLow),
    mid: new THREE.Color(settings.colorMid),
    high: new THREE.Color(settings.colorHigh)
  };

  scene.add(mesh);
  container.append(renderer.domElement);

  function createGeometry(waveSettings) {
    const nextGeometry = new THREE.PlaneGeometry(
      waveSettings.meshWidth,
      waveSettings.meshDepth,
      waveSettings.meshSegments,
      waveSettings.meshSegments
    );

    nextGeometry.rotateX(-Math.PI / 2);

    const colorValues = [];
    const position = nextGeometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      colorValues.push(1, 1, 1);
    }

    nextGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colorValues, 3)
    );

    return nextGeometry;
  }

  function updateCamera() {
    camera.fov = settings.cameraFov;
    camera.position.set(settings.cameraX, settings.cameraY, settings.cameraZ);
    camera.lookAt(settings.lookAtX, settings.lookAtY, settings.lookAtZ);
    camera.updateProjectionMatrix();
  }

  function updateColors() {
    colors.low.set(settings.colorLow);
    colors.mid.set(settings.colorMid);
    colors.high.set(settings.colorHigh);
    material.uniforms.uColorLow.value.copy(colors.low);
    material.uniforms.uColorMid.value.copy(colors.mid);
    material.uniforms.uColorHigh.value.copy(colors.high);
  }

  function getColorFromHeight(height, minHeight, maxHeight) {
    const heightRange = Math.max(maxHeight - minHeight, 0.0001);
    const normalized = THREE.MathUtils.clamp(
      (height - minHeight) / heightRange,
      0,
      1
    );
    const ramp = [
      {
        stop: THREE.MathUtils.clamp(settings.colorLowThreshold, 0, 1),
        color: colors.low
      },
      {
        stop: THREE.MathUtils.clamp(settings.colorMidThreshold, 0, 1),
        color: colors.mid
      },
      {
        stop: THREE.MathUtils.clamp(settings.colorHighThreshold, 0, 1),
        color: colors.high
      }
    ].sort((a, b) => a.stop - b.stop);

    if (normalized <= ramp[0].stop) {
      return ramp[0].color.clone();
    }

    for (let i = 1; i < ramp.length; i++) {
      const previous = ramp[i - 1];
      const next = ramp[i];

      if (normalized <= next.stop) {
        const stopRange = Math.max(next.stop - previous.stop, 0.0001);
        const localT = (normalized - previous.stop) / stopRange;
        const blendAmount =
          i === 1 ? settings.colorLowMidBlend : settings.colorMidHighBlend;
        const easedT = getBlendProgress(localT, blendAmount);

        return previous.color.clone().lerp(next.color, easedT);
      }
    }

    return ramp[ramp.length - 1].color.clone();
  }

  function sourceWave(x, y, source, phase) {
    const dx = x - source.x;
    const dy = y - source.y;
    const distance = Math.hypot(dx, dy);

    return source.amplitude * Math.cos(settings.frequency * distance - phase);
  }

  function radialInterference(x, y, phase) {
    const amplitudeRange =
      Math.max(Math.abs(settings.sourceOne.amplitude) + Math.abs(settings.sourceTwo.amplitude), 0.0001);
    const waveHeight =
      sourceWave(x, y, settings.sourceOne, phase) +
      sourceWave(x, y, settings.sourceTwo, phase);

    return (waveHeight / amplitudeRange) * settings.heightScale * settings.damping;
  }

  function asymmetricFold(x, y, phase) {
    const amplitudeRange =
      Math.max(Math.abs(settings.sourceOne.amplitude) + Math.abs(settings.sourceTwo.amplitude), 0.0001);
    const foldedX =
      x +
      settings.asymmetry * Math.sin(y * 0.34 + phase * asymmetricFoldPhase.xDrift) +
      y * settings.asymmetry * 0.08;
    const foldedY =
      y +
      settings.asymmetry * 0.55 * Math.sin(x * 0.22 - phase * asymmetricFoldPhase.yDrift);
    const directional =
      Math.cos(settings.frequency * (foldedX * 0.48 + foldedY * 0.18) - phase) *
      amplitudeRange *
      0.18;
    const waveHeight =
      sourceWave(foldedX, foldedY, settings.sourceOne, phase) +
      sourceWave(x * 0.88, y * 1.12, settings.sourceTwo, phase * asymmetricFoldPhase.secondarySource) +
      directional;

    return (waveHeight / (amplitudeRange * 1.18)) * settings.heightScale * settings.damping;
  }

  function spiralInterference(x, y, phase) {
    const amplitudeRange =
      Math.max(Math.abs(settings.sourceOne.amplitude) + Math.abs(settings.sourceTwo.amplitude), 0.0001);
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    const spiralPhase =
      settings.frequency * radius +
      angle * settings.twist +
      settings.asymmetry * Math.sin(x * 0.18) -
      phase;
    const sourcePhase =
      settings.frequency *
        Math.hypot(x - settings.sourceTwo.x * 0.5, y - settings.sourceTwo.y * 0.5) -
      phase * 0.82;
    const waveHeight =
      Math.cos(spiralPhase) * settings.sourceOne.amplitude +
      Math.cos(sourcePhase) * settings.sourceTwo.amplitude * 0.72;

    return (waveHeight / (amplitudeRange * 0.86)) * settings.heightScale * settings.damping;
  }

  function diagonalShear(x, y, phase) {
    const amplitudeRange =
      Math.max(Math.abs(settings.sourceOne.amplitude) + Math.abs(settings.sourceTwo.amplitude), 0.0001);
    const shearedX = x + y * settings.asymmetry * 0.18;
    const shearedY = y - x * settings.asymmetry * 0.05;
    const ridge =
      Math.sin((shearedX * 0.62 - shearedY * 0.26) * settings.frequency - phase) *
      settings.sourceOne.amplitude;
    const ripple =
      Math.cos(settings.frequency * Math.hypot(shearedX - 1.8, shearedY + 2.4) - phase * 1.4) *
      settings.sourceTwo.amplitude;

    return ((ridge + ripple) / amplitudeRange) * settings.heightScale * settings.damping;
  }

  function interferenceWave(x, y, phase) {
    if (settings.waveMode === "asymmetricFold") {
      return asymmetricFold(x, y, phase);
    }

    if (settings.waveMode === "spiralInterference") {
      return spiralInterference(x, y, phase);
    }

    if (settings.waveMode === "diagonalShear") {
      return diagonalShear(x, y, phase);
    }

    return radialInterference(x, y, phase);
  }

  function updateGrain() {
    const isSurfaceMapped =
      settings.grainType === "surfaceMapped" ||
      settings.grainType === "referenceMapped";

    material.uniforms.uUseSurfaceGrain.value = isSurfaceMapped;
    material.uniforms.uGrainIntensity.value = THREE.MathUtils.clamp(settings.grainIntensity, 0, 4);
    material.uniforms.uGrainContrast.value = THREE.MathUtils.clamp(settings.grainContrast, 0.5, 8);
    material.uniforms.uSurfaceGrainScale.value = settings.surfaceGrainScale;
    material.uniforms.uSurfaceGrainMode.value =
      settings.grainType === "referenceMapped" ? 0 : 1;
    material.uniforms.uGrainColorLow.value.set(settings.grainColorLow || "#00E2CC");
    material.uniforms.uGrainColorMid.value.set(settings.grainColorMid || "#FF1D92");
    material.uniforms.uGrainColorHigh.value.set(settings.grainColorHigh || "#FF5927");
    material.uniforms.uGrainColorIntensity.value = settings.grainColorIntensity ?? 0.45;
    material.uniforms.uGrainColorOnly.value = Boolean(settings.grainColorOnly);
    material.uniforms.uGrainPaletteSpread.value = settings.grainPaletteSpread ?? 0.18;
    material.uniforms.uGrainEdgeRange.value = settings.grainEdgeRange ?? 0.16;
    material.uniforms.uGrainMidChance.value = settings.grainMidChance ?? 0.14;
    material.uniforms.uColorLowThreshold.value = settings.colorLowThreshold;
    material.uniforms.uColorMidThreshold.value = settings.colorMidThreshold;
    material.uniforms.uColorHighThreshold.value = settings.colorHighThreshold;
    material.uniforms.uColorLowMidBlend.value = settings.colorLowMidBlend;
    material.uniforms.uColorMidHighBlend.value = settings.colorMidHighBlend;
    postMaterial.uniforms.uIntensity.value = settings.cameraGrainIntensity ?? 0.42;
    postMaterial.uniforms.uGrainScale.value = settings.cameraGrainScale ?? 1.15;
    postMaterial.uniforms.uBleed.value = settings.cameraGrainBleed ?? 0.7;
    postMaterial.uniforms.uSoftness.value = settings.cameraGrainSoftness ?? 0.34;
    postMaterial.uniforms.uAirbrushEnabled.value =
      settings.grainType === "cameraAirbrush";
    postMaterial.uniforms.uChromaticEnabled.value =
      Boolean(settings.chromaticAberrationEnabled);
    postMaterial.uniforms.uChromaticAmount.value =
      settings.chromaticAberration ?? 1.5;
    postMaterial.uniforms.uDiffusionEnabled.value =
      Boolean(settings.diffusionEnabled);
    postMaterial.uniforms.uDiffusionAmount.value =
      settings.diffusionAmount ?? 0.18;
    postMaterial.uniforms.uDiffusionRadius.value =
      settings.diffusionRadius ?? 2.5;
    postMaterial.uniforms.uHalationEnabled.value =
      Boolean(settings.halationEnabled);
    postMaterial.uniforms.uHalationAmount.value =
      settings.halationAmount ?? 0.16;
    postMaterial.uniforms.uHalationRadius.value =
      settings.halationRadius ?? 4;
    postMaterial.uniforms.uMotionEnabled.value =
      Boolean(settings.motionAberrationEnabled);
    postMaterial.uniforms.uMotionAmount.value =
      settings.motionAberrationAmount ?? 1.4;
  }

  function usesPostProcessing() {
    return (
      settings.grainType === "cameraAirbrush" ||
      settings.chromaticAberrationEnabled ||
      settings.diffusionEnabled ||
      settings.halationEnabled ||
      settings.motionAberrationEnabled
    );
  }

  function renderAtPhase(phase) {
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const zCoord = position.getZ(i);
      const height = interferenceWave(x, zCoord, phase);

      position.setY(i, height);
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }

    for (let i = 0; i < position.count; i++) {
      const height = position.getY(i);
      const c = getColorFromHeight(height, minHeight, maxHeight);
      color.setXYZ(i, c.r, c.g, c.b);
    }

    position.needsUpdate = true;
    color.needsUpdate = true;
    material.uniforms.uHeightMin.value = minHeight;
    material.uniforms.uHeightMax.value = maxHeight;

    mesh.rotation.z =
      Math.sin(phase * settings.rotationSpeed) * settings.rotationAmount;

    if (usesPostProcessing()) {
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      postMaterial.uniforms.uFrame.value = renderFrame;
      renderFrame += 1;
      renderer.render(postScene, postCamera);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  function setSize(width, height, pixelRatio = window.devicePixelRatio || 1) {
    camera.aspect = width / Math.max(height, 1);
    renderer.setPixelRatio(Math.min(pixelRatio, settings.pixelRatioLimit));
    renderer.setSize(width, height, false);
    const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    renderTarget.setSize(drawingBufferSize.x, drawingBufferSize.y);
    postMaterial.uniforms.uResolution.value.copy(drawingBufferSize);
    updateCamera();
  }

  function setCameraPose(pose) {
    Object.assign(settings, pose);
    updateCamera();
  }

  function setCameraView(pose) {
    const nextX = pose.cameraX ?? settings.cameraX;
    const nextY = pose.cameraY ?? settings.cameraY;
    const nextZ = pose.cameraZ ?? settings.cameraZ;

    if (previousViewPosition) {
      const deltaX = nextX - previousViewPosition.x;
      const deltaY = nextY - previousViewPosition.y;
      const deltaZ = nextZ - previousViewPosition.z;
      const targetMotion = new THREE.Vector2(
        THREE.MathUtils.clamp((deltaX - deltaZ * 0.35) * 140, -8, 8),
        THREE.MathUtils.clamp((deltaY + deltaZ * 0.18) * 140, -8, 8)
      );

      postMaterial.uniforms.uCameraMotion.value.lerp(targetMotion, 0.38);
    }

    previousViewPosition = new THREE.Vector3(nextX, nextY, nextZ);
    camera.fov = pose.cameraFov ?? settings.cameraFov;
    camera.position.set(nextX, nextY, nextZ);
    camera.lookAt(
      pose.lookAtX ?? settings.lookAtX,
      pose.lookAtY ?? settings.lookAtY,
      pose.lookAtZ ?? settings.lookAtZ
    );
    camera.updateProjectionMatrix();
  }

  function setMeshSegments(meshSegments) {
    settings.meshSegments = Math.round(meshSegments);
    rebuildGeometry();
  }

  function rebuildGeometry() {
    const oldGeometry = geometry;
    geometry = createGeometry(settings);
    mesh.geometry = geometry;
    oldGeometry.dispose();
  }

  function setSettings(nextSettings, options = {}) {
    Object.assign(settings, nextSettings);
    updateColors();
    updateGrain();
    updateCamera();
    material.wireframe = settings.wireframe;

    if (options.rebuild) {
      rebuildGeometry();
    }
  }

  function renderLoopProgress(progress) {
    renderAtPhase(settings.phase + progress * Math.PI * 2);
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    geometry.dispose();
    material.dispose();
    postQuad.geometry.dispose();
    postMaterial.dispose();
    renderTarget.dispose();
    grainTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  updateCamera();
  updateColors();
  updateGrain();
  setSize(
    options.width || container.clientWidth || window.innerWidth,
    options.height || container.clientHeight || window.innerHeight,
    options.pixelRatio || window.devicePixelRatio || 1
  );

  return {
    camera,
    renderer,
    scene,
    settings,
    dispose,
    renderAtPhase,
    renderLoopProgress,
    setCameraView,
    setCameraPose,
    setMeshSegments,
    setSettings,
    setSize
  };
}
