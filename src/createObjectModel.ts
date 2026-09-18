import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Warm Nordic Miniature Room
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createWarmNordicMiniatureRoomModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Warm Nordic Miniature Room";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": true, "fovDegrees": 31.0, "aspect": 1.0, "orientation": {"yaw": 38.0, "pitch": -28.0, "roll": 0.0}, "positionHint": [10.5, 8.2, 12.5], "note": "Manually solved to the weak-perspective elevated three-quarter miniature-product view. Camera looks toward [0, 2.7, 0] with verticals upright; direct texture projection is intentionally not used."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["wall-paint"] = createSculptMaterial(
    "wall-paint",
    {"id": "wall-paint", "name": "Warm off-white painted wall", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#F4E8D7", "color": "#F4E8D7", "albedo": {"dominant": "#F4E8D7", "secondary": ["#E2CCB7", "#FFF5E8"], "samplingNotes": "Use image-observed local color zones, not a single averaged color."}, "colorVariation": {"palette": ["#F4E8D7", "#E2CCB7", "#FFF5E8"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.689, "variation": 0.075, "map": "wall-paint_roughness.png", "localResponse": "higher roughness in cavities, lower roughness on worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.203, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "panel-groove-ao", "kind": "linework", "roughness": 0.78, "aoStrength": 0.22}, {"id": "trim-highlight", "kind": "gloss", "roughness": 0.48}], "referencePbr": {"version": "1", "sourceImage": ".img2threejs/detail-inventory/zone-r0c0.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image inference", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": ".img2threejs/material-evidence/wall/wall-paint_albedo.png", "channel": "albedo"}, "roughness": {"path": ".img2threejs/material-evidence/wall/wall-paint_roughness.png", "channel": "roughness"}, "height": {"path": ".img2threejs/material-evidence/wall/wall-paint_height.png", "channel": "height"}, "normal": {"path": ".img2threejs/material-evidence/wall/wall-paint_normal.png", "channel": "normal"}, "ao": {"path": ".img2threejs/material-evidence/wall/wall-paint_ao.png", "channel": "ao"}}}, "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-derived warm cream paint with shallow panel relief; extracted maps are evidence only and browser implementation uses lightweight procedural equivalents."},
    options
  );
  materialMap["oak"] = createSculptMaterial(
    "oak",
    {"id": "oak", "name": "Pale oak", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#D3B089", "color": "#D3B089", "albedo": {"dominant": "#D3B089", "secondary": ["#E9D2B5", "#A97B52"]}, "colorVariation": {"palette": ["#D3B089", "#E9D2B5", "#A97B52"], "pattern": "directional grain", "amplitude": 0.09, "heightCorrelation": 0.22}, "textureResolution": 1024, "textureProjection": {"mode": "object-space directional", "repeat": [2.5, 1.0], "anisotropy": 8, "texelDensityIntent": "grain follows the longest board axis"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.6, "amplitude": 0.08, "role": "board tone"}, {"id": "meso", "frequency": 10, "amplitude": 0.05, "role": "grain bands"}, {"id": "micro", "frequency": 52, "amplitude": 0.018, "role": "fiber highlight breakup"}], "roughness": {"base": 0.701, "variation": 0.088, "map": "oak_roughness.png", "localResponse": "slightly lower on beveled shelf fronts"}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "independent directional height field", "strength": 0.209, "scale": 28, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.32, "notes": "shelf corners and board seams"}, "localOverrides": [{"id": "directional-grain", "kind": "linework", "roughness": 0.64}, {"id": "shelf-edge-satin", "kind": "gloss", "roughness": 0.42}], "referencePbr": {"version": "1", "sourceImage": ".img2threejs/detail-inventory/zone-r0c1.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image inference", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": ".img2threejs/material-evidence/oak/oak_albedo.png"}, "roughness": {"path": ".img2threejs/material-evidence/oak/oak_roughness.png"}, "height": {"path": ".img2threejs/material-evidence/oak/oak_height.png"}, "normal": {"path": ".img2threejs/material-evidence/oak/oak_normal.png"}, "ao": {"path": ".img2threejs/material-evidence/oak/oak_ao.png"}}}, "shaderNotes": ["Use low-contrast generated canvas grain; never bake source shadows into the final material."]},
    options
  );
  materialMap["sofa-fabric"] = createSculptMaterial(
    "sofa-fabric",
    {"id": "sofa-fabric", "name": "Charcoal woven upholstery", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#302F2C", "color": "#302F2C", "albedo": {"dominant": "#302F2C", "secondary": ["#45413C", "#211F1D"]}, "colorVariation": {"palette": ["#302F2C", "#45413C", "#211F1D"], "pattern": "woven mottling", "amplitude": 0.06, "heightCorrelation": 0.15}, "textureResolution": 1024, "textureProjection": {"mode": "triplanar-like", "repeat": [6, 6], "anisotropy": 8, "texelDensityIntent": "consistent weave scale on every cushion"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.2, "amplitude": 0.04, "role": "cushion value shift"}, {"id": "meso", "frequency": 16, "amplitude": 0.035, "role": "woven loops"}, {"id": "micro", "frequency": 70, "amplitude": 0.014, "role": "fiber highlights"}], "roughness": {"base": 0.719, "variation": 0.127, "map": "sofa-fabric_roughness.png", "localResponse": "higher inside cushion seams"}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "independent woven height field", "strength": 0.236, "scale": 42, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.34, "contactShadowBias": 0.4, "notes": "cushion compression seams"}, "localOverrides": [{"id": "micro-weave", "kind": "ridge", "roughness": 0.76}, {"id": "cushion-seam-darkening", "kind": "seam", "roughness": 0.84}], "referencePbr": {"version": "1", "sourceImage": ".img2threejs/detail-inventory/zone-r1c0.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image inference", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": ".img2threejs/material-evidence/sofa/sofa-fabric_albedo.png"}, "roughness": {"path": ".img2threejs/material-evidence/sofa/sofa-fabric_roughness.png"}, "height": {"path": ".img2threejs/material-evidence/sofa/sofa-fabric_height.png"}, "normal": {"path": ".img2threejs/material-evidence/sofa/sofa-fabric_normal.png"}, "ao": {"path": ".img2threejs/material-evidence/sofa/sofa-fabric_ao.png"}}}, "shaderNotes": ["Use subtle procedural weave; silhouette softness comes from bevel geometry, not texture alone."]},
    options
  );
  materialMap["rug-fabric"] = createSculptMaterial(
    "rug-fabric",
    {"id": "rug-fabric", "name": "Cream loop-pile rug", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#EDDECA", "color": "#EDDECA", "albedo": {"dominant": "#EDDECA", "secondary": ["#D6BEA3", "#FFF0DC"]}, "colorVariation": {"palette": ["#EDDECA", "#D6BEA3", "#FFF0DC"], "pattern": "loop pile", "amplitude": 0.07, "heightCorrelation": 0.28}, "textureResolution": 1024, "textureProjection": {"mode": "planar", "repeat": [5, 4], "anisotropy": 8, "texelDensityIntent": "stable small pile across the rug"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.1, "amplitude": 0.04, "role": "broad pile direction"}, {"id": "meso", "frequency": 14, "amplitude": 0.045, "role": "loop clusters"}, {"id": "micro", "frequency": 64, "amplitude": 0.018, "role": "fiber breakup"}], "roughness": {"base": 0.708, "variation": 0.084, "map": "rug-fabric_roughness.png", "localResponse": "slightly higher in compressed center"}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "independent loop-pile field", "strength": 0.207, "scale": 38, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.26, "contactShadowBias": 0.38, "notes": "pile valleys and furniture contact"}, "localOverrides": [{"id": "pile-variation", "kind": "ridge", "roughness": 0.79}, {"id": "edge-pile", "kind": "contour", "roughness": 0.83}], "referencePbr": {"version": "1", "sourceImage": ".img2threejs/detail-inventory/zone-r2c1.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image inference", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": ".img2threejs/material-evidence/rug/rug-fabric_albedo.png"}, "roughness": {"path": ".img2threejs/material-evidence/rug/rug-fabric_roughness.png"}, "height": {"path": ".img2threejs/material-evidence/rug/rug-fabric_height.png"}, "normal": {"path": ".img2threejs/material-evidence/rug/rug-fabric_normal.png"}, "ao": {"path": ".img2threejs/material-evidence/rug/rug-fabric_ao.png"}}}, "shaderNotes": ["Keep pile subtle at overview distance; preserve the scalloped outline with geometry."]},
    options
  );
  materialMap["cream-fabric"] = createSculptMaterial(
    "cream-fabric",
    {"id": "cream-fabric", "name": "Cream knit textile", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#EDE0CF", "roughness": 0.9, "metalness": 0, "albedo": {"dominant": "#EDE0CF", "secondary": ["#DCC8B1"]}, "localOverrides": [{"id": "knit-rib-tone", "kind": "ridge"}]},
    options
  );
  materialMap["blue-fabric"] = createSculptMaterial(
    "blue-fabric",
    {"id": "blue-fabric", "name": "Muted ocean-blue accent", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#7592A4", "roughness": 0.82, "metalness": 0, "albedo": {"dominant": "#7592A4", "secondary": ["#9CB3BE"]}, "localOverrides": [{"id": "blue-stripes", "kind": "decal"}]},
    options
  );
  materialMap["black-metal"] = createSculptMaterial(
    "black-metal",
    {"id": "black-metal", "name": "Black coated metal", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#24211F", "roughness": 0.38, "metalness": 0.72, "albedo": {"dominant": "#24211F", "secondary": ["#45403A"]}, "localOverrides": [{"id": "edge-highlight", "kind": "gloss", "roughness": 0.24}]},
    options
  );
  materialMap["sage-enamel"] = createSculptMaterial(
    "sage-enamel",
    {"id": "sage-enamel", "name": "Sage appliance enamel", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#858D70", "roughness": 0.46, "metalness": 0.08, "clearcoat": 0.14, "clearcoatRoughness": 0.42, "albedo": {"dominant": "#858D70", "secondary": ["#A3A98C"]}, "localOverrides": []},
    options
  );
  materialMap["ceramic"] = createSculptMaterial(
    "ceramic",
    {"id": "ceramic", "name": "Warm white ceramic", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#F2EBDD", "roughness": 0.32, "metalness": 0, "clearcoat": 0.1, "clearcoatRoughness": 0.25, "albedo": {"dominant": "#F2EBDD", "secondary": ["#789EB6"]}, "localOverrides": []},
    options
  );
  materialMap["glass"] = createSculptMaterial(
    "glass",
    {"id": "glass", "name": "Clear pitcher and window glass", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#DDE8E8", "roughness": 0.18, "metalness": 0, "transmission": 0.72, "thickness": 0.08, "transparent": true, "opacity": 0.44, "albedo": {"dominant": "#DDE8E8", "secondary": ["#FFFFFF"]}, "localOverrides": []},
    options
  );
  materialMap["mauve-fabric"] = createSculptMaterial(
    "mauve-fabric",
    {"id": "mauve-fabric", "name": "Dusty mauve nylon", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#B18F92", "roughness": 0.78, "metalness": 0, "albedo": {"dominant": "#B18F92", "secondary": ["#927277"]}, "localOverrides": [{"id": "fabric-creases", "kind": "seam", "roughness": 0.86}]},
    options
  );
  materialMap["paper"] = createSculptMaterial(
    "paper",
    {"id": "paper", "name": "Muted paper and book covers", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#CDB79F", "roughness": 0.86, "metalness": 0, "albedo": {"dominant": "#CDB79F", "secondary": ["#738696", "#574F45"]}, "localOverrides": []},
    options
  );
  materialMap["curtain"] = createSculptMaterial(
    "curtain",
    {"id": "curtain", "name": "Semi-transparent lace curtain", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#F2E5D1", "roughness": 0.9, "metalness": 0, "transparent": true, "opacity": 0.58, "doubleSided": true, "albedo": {"dominant": "#F2E5D1", "secondary": ["#D9C7AE"]}, "localOverrides": [{"id": "lace-opacity-pattern", "kind": "linework", "alpha": 0.58}]},
    options
  );
  materialMap["ocean"] = createSculptMaterial(
    "ocean",
    {"id": "ocean", "name": "Ocean horizon backdrop", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#77A9C3", "roughness": 0.82, "metalness": 0, "albedo": {"dominant": "#77A9C3", "secondary": ["#EEDCC4", "#4F88A7"]}, "localOverrides": [{"id": "horizon-wave-bands", "kind": "linework"}]},
    options
  );
  materialMap["laptop-shell"] = createSculptMaterial(
    "laptop-shell",
    {"id": "laptop-shell", "name": "Matte gray laptop shell", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#8B8D8C", "roughness": 0.55, "metalness": 0.24, "albedo": {"dominant": "#8B8D8C", "secondary": ["#ECE7D9"]}, "localOverrides": [{"id": "circular-badge", "kind": "decal"}]},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Floor platform and root pivot__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.125, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Floor platform and root pivot", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.96, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The visible base is a rigid rectangular miniature platform with countable planar faces and softly beveled exposed edges.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface floor platform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 10.0, "height": 0.25, "depth": 8.0, "units": "world", "confidence": 0.96}, "transform": {"position": [0, 0.125, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "oak", "materialLayers": ["oak"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-plank-seams", "kind": "seam", "realization": "geometry-lines", "spacing": 0.72}, {"id": "trim-bevels", "kind": "bevel", "bevelRadius": 0.08, "segments": 3}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 176, 137, 1.0)", "secondaryAlbedo": "rgba(238, 215, 190, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.94}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["oak"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Floor platform and root pivot";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Floor platform and root pivot", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.96, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The visible base is a rigid rectangular miniature platform with countable planar faces and softly beveled exposed edges.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface floor platform", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.08, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 10.0, "height": 0.25, "depth": 8.0, "units": "world", "confidence": 0.96}, "transform": {"position": [0, 0.125, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "oak", "materialLayers": ["oak"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-plank-seams", "kind": "seam", "realization": "geometry-lines", "spacing": 0.72}, {"id": "trim-bevels", "kind": "bevel", "bevelRadius": 0.08, "segments": 3}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 176, 137, 1.0)", "secondaryAlbedo": "rgba(238, 215, 190, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.94}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_room_shell_1 = makeAttachmentEndpoint(null);
  const node_room_shell_1 = new THREE.Group();
  node_room_shell_1.name = "Room shell assembly__pivot";
  node_room_shell_1.scale.set(1, 1, 1);
  if (endpoint_room_shell_1) {
    node_room_shell_1.position.copy(endpoint_room_shell_1.start);
    node_room_shell_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_room_shell_1.position.set(0.0, 0.25, 0.0);
    node_room_shell_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_room_shell_1.userData.sculptComponent = {"id": "room-shell", "name": "Room shell assembly", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.97, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid planar wall and trim solids meet at a right-angle corner.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 2}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0.25, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "wall-paint", "materialLayers": ["wall-paint"], "localFeatures": [{"id": "wall-panel-grooves", "kind": "groove"}, {"id": "trim-bevels", "kind": "bevel"}], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 232, 215, 1.0)", "secondaryAlbedo": "rgba(224, 204, 182, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.92}};
  node_room_shell_1.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_room_shell_1);
  nodes["room-shell"] = node_room_shell_1;
  const mesh_room_shell_1Geometry = endpoint_room_shell_1
    ? new THREE.CylinderGeometry(endpoint_room_shell_1.endRadius, endpoint_room_shell_1.baseRadius, endpoint_room_shell_1.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_room_shell_1) {
    mesh_room_shell_1Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_room_shell_1 = new THREE.Mesh(
    mesh_room_shell_1Geometry,
    materialMap["wall-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_room_shell_1.name = "Room shell assembly";
  if (endpoint_room_shell_1) {
    mesh_room_shell_1.position.copy(endpoint_room_shell_1.midpoint);
    mesh_room_shell_1.quaternion.copy(endpoint_room_shell_1.quaternion);
  }
  mesh_room_shell_1.castShadow = options.castShadow ?? true;
  mesh_room_shell_1.receiveShadow = options.receiveShadow ?? true;
  mesh_room_shell_1.userData.sculptComponent = {"id": "room-shell", "name": "Room shell assembly", "level": "macro", "role": "assembly", "importance": 1.0, "confidence": 0.97, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid planar wall and trim solids meet at a right-angle corner.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.02, "segments": 2}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0.25, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "wall-paint", "materialLayers": ["wall-paint"], "localFeatures": [{"id": "wall-panel-grooves", "kind": "groove"}, {"id": "trim-bevels", "kind": "bevel"}], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 232, 215, 1.0)", "secondaryAlbedo": "rgba(224, 204, 182, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.92}};
  node_room_shell_1.add(mesh_room_shell_1);
  meshes["room-shell"] = mesh_room_shell_1;
  colliders["room-shell"] = {};

  const endpoint_seating_zone_2 = makeAttachmentEndpoint(null);
  const node_seating_zone_2 = new THREE.Group();
  node_seating_zone_2.name = "Seating zone assembly__pivot";
  node_seating_zone_2.scale.set(1, 1, 1);
  if (endpoint_seating_zone_2) {
    node_seating_zone_2.position.copy(endpoint_seating_zone_2.start);
    node_seating_zone_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_seating_zone_2.position.set(-2.45, 0.25, 1.15);
    node_seating_zone_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_seating_zone_2.userData.sculptComponent = {"id": "seating-zone", "name": "Seating zone assembly", "level": "macro", "role": "assembly", "importance": 0.98, "confidence": 0.96, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Semantic parent keeps the upholstered sofa, pillows, and throw as one selectable furnishing zone.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [-2.45, 0.25, 1.15], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "sofa-fabric", "materialLayers": ["sofa-fabric", "cream-fabric", "blue-fabric"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 47, 44, 1.0)", "secondaryAlbedo": "rgba(226, 213, 195, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.97}};
  node_seating_zone_2.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_seating_zone_2);
  nodes["seating-zone"] = node_seating_zone_2;
  const mesh_seating_zone_2Geometry = endpoint_seating_zone_2
    ? new THREE.CylinderGeometry(endpoint_seating_zone_2.endRadius, endpoint_seating_zone_2.baseRadius, endpoint_seating_zone_2.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_seating_zone_2) {
    mesh_seating_zone_2Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_seating_zone_2 = new THREE.Mesh(
    mesh_seating_zone_2Geometry,
    materialMap["sofa-fabric"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_seating_zone_2.name = "Seating zone assembly";
  if (endpoint_seating_zone_2) {
    mesh_seating_zone_2.position.copy(endpoint_seating_zone_2.midpoint);
    mesh_seating_zone_2.quaternion.copy(endpoint_seating_zone_2.quaternion);
  }
  mesh_seating_zone_2.castShadow = options.castShadow ?? true;
  mesh_seating_zone_2.receiveShadow = options.receiveShadow ?? true;
  mesh_seating_zone_2.userData.sculptComponent = {"id": "seating-zone", "name": "Seating zone assembly", "level": "macro", "role": "assembly", "importance": 0.98, "confidence": 0.96, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Semantic parent keeps the upholstered sofa, pillows, and throw as one selectable furnishing zone.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [-2.45, 0.25, 1.15], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "sofa-fabric", "materialLayers": ["sofa-fabric", "cream-fabric", "blue-fabric"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(48, 47, 44, 1.0)", "secondaryAlbedo": "rgba(226, 213, 195, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.97}};
  node_seating_zone_2.add(mesh_seating_zone_2);
  meshes["seating-zone"] = mesh_seating_zone_2;
  colliders["seating-zone"] = {};

  const endpoint_storage_zone_3 = makeAttachmentEndpoint(null);
  const node_storage_zone_3 = new THREE.Group();
  node_storage_zone_3.name = "Storage zone assembly__pivot";
  node_storage_zone_3.scale.set(1, 1, 1);
  if (endpoint_storage_zone_3) {
    node_storage_zone_3.position.copy(endpoint_storage_zone_3.start);
    node_storage_zone_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_storage_zone_3.position.set(-1.9, 0.25, -2.9);
    node_storage_zone_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_storage_zone_3.userData.sculptComponent = {"id": "storage-zone", "name": "Storage zone assembly", "level": "macro", "role": "assembly", "importance": 0.92, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid pale-oak storage volumes and layered wall frames form one selectable zone.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [-1.9, 0.25, -2.9], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "oak", "materialLayers": ["oak", "paper"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 171, 129, 1.0)", "secondaryAlbedo": "rgba(236, 211, 184, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.97}};
  node_storage_zone_3.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_storage_zone_3);
  nodes["storage-zone"] = node_storage_zone_3;
  const mesh_storage_zone_3Geometry = endpoint_storage_zone_3
    ? new THREE.CylinderGeometry(endpoint_storage_zone_3.endRadius, endpoint_storage_zone_3.baseRadius, endpoint_storage_zone_3.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_storage_zone_3) {
    mesh_storage_zone_3Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_storage_zone_3 = new THREE.Mesh(
    mesh_storage_zone_3Geometry,
    materialMap["oak"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_storage_zone_3.name = "Storage zone assembly";
  if (endpoint_storage_zone_3) {
    mesh_storage_zone_3.position.copy(endpoint_storage_zone_3.midpoint);
    mesh_storage_zone_3.quaternion.copy(endpoint_storage_zone_3.quaternion);
  }
  mesh_storage_zone_3.castShadow = options.castShadow ?? true;
  mesh_storage_zone_3.receiveShadow = options.receiveShadow ?? true;
  mesh_storage_zone_3.userData.sculptComponent = {"id": "storage-zone", "name": "Storage zone assembly", "level": "macro", "role": "assembly", "importance": 0.92, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid pale-oak storage volumes and layered wall frames form one selectable zone.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [-1.9, 0.25, -2.9], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "oak", "materialLayers": ["oak", "paper"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 171, 129, 1.0)", "secondaryAlbedo": "rgba(236, 211, 184, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.97}};
  node_storage_zone_3.add(mesh_storage_zone_3);
  meshes["storage-zone"] = mesh_storage_zone_3;
  colliders["storage-zone"] = {};

  const endpoint_decor_zone_4 = makeAttachmentEndpoint(null);
  const node_decor_zone_4 = new THREE.Group();
  node_decor_zone_4.name = "Beverage center and accent assembly__pivot";
  node_decor_zone_4.scale.set(1, 1, 1);
  if (endpoint_decor_zone_4) {
    node_decor_zone_4.position.copy(endpoint_decor_zone_4.start);
    node_decor_zone_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_decor_zone_4.position.set(1.2, 0.25, 0.0);
    node_decor_zone_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_decor_zone_4.userData.sculptComponent = {"id": "decor-zone", "name": "Beverage center and accent assembly", "level": "macro", "role": "assembly", "importance": 0.96, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The cabinet, center tables, lamp, rug, laptop, and backpack remain independent child solids under one interaction group.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [1.2, 0.25, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "oak", "materialLayers": ["oak", "rug-fabric", "black-metal", "mauve-fabric"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 176, 137, 1.0)", "secondaryAlbedo": "rgba(237, 222, 202, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.91}};
  node_decor_zone_4.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_decor_zone_4);
  nodes["decor-zone"] = node_decor_zone_4;
  const mesh_decor_zone_4Geometry = endpoint_decor_zone_4
    ? new THREE.CylinderGeometry(endpoint_decor_zone_4.endRadius, endpoint_decor_zone_4.baseRadius, endpoint_decor_zone_4.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_decor_zone_4) {
    mesh_decor_zone_4Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_decor_zone_4 = new THREE.Mesh(
    mesh_decor_zone_4Geometry,
    materialMap["oak"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_decor_zone_4.name = "Beverage center and accent assembly";
  if (endpoint_decor_zone_4) {
    mesh_decor_zone_4.position.copy(endpoint_decor_zone_4.midpoint);
    mesh_decor_zone_4.quaternion.copy(endpoint_decor_zone_4.quaternion);
  }
  mesh_decor_zone_4.castShadow = options.castShadow ?? true;
  mesh_decor_zone_4.receiveShadow = options.receiveShadow ?? true;
  mesh_decor_zone_4.userData.sculptComponent = {"id": "decor-zone", "name": "Beverage center and accent assembly", "level": "macro", "role": "assembly", "importance": 0.96, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The cabinet, center tables, lamp, rug, laptop, and backpack remain independent child solids under one interaction group.", "geometryDescriptor": {"topologyIntent": "semantic pivot marker", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals"}, "parent": "root", "dimensions": {"width": 0.02, "height": 0.02, "depth": 0.02, "units": "world", "confidence": 1.0}, "transform": {"position": [1.2, 0.25, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "material": "oak", "materialLayers": ["oak", "rug-fabric", "black-metal", "mauve-fabric"], "localFeatures": [], "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(211, 176, 137, 1.0)", "secondaryAlbedo": "rgba(237, 222, 202, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.91}};
  node_decor_zone_4.add(mesh_decor_zone_4);
  meshes["decor-zone"] = mesh_decor_zone_4;
  colliders["decor-zone"] = {};

  // Blockout correction 1: semantic pivot markers are intentionally non-visual.
  // The generated hierarchy stores authored world positions under nested parent nodes,
  // which compounded transforms and collapsed the first review render into a tiny cube.
  Object.values(meshes).forEach((mesh) => { mesh.visible = false; });

  const blockout = new THREE.Group();
  blockout.name = 'review-blockout';
  root.add(blockout);

  const addBlock = (
    id: string,
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    materialId: string,
    radius = 0.05,
  ) => {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2], 2, 2, 2);
    const mesh = new THREE.Mesh(geometry, materialMap[materialId] ?? materialMap['wall-paint']);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.sculptComponent = { id, name, pass: 'blockout' };
    blockout.add(mesh);
    meshes[id] = mesh;
    nodes[id] = mesh;
    return mesh;
  };

  addBlock('root', 'Floor platform', [10, 0.25, 8], [0, 0.125, 0], 'oak', 0.08);
  addBlock('left-wall', 'Left wall', [0.25, 7.2, 8], [-4.875, 3.85, 0], 'wall-paint', 0.04);
  addBlock('rear-wall', 'Rear wall', [10, 7.2, 0.25], [0, 3.85, -3.875], 'wall-paint', 0.04);
  addBlock('sofa', 'Sofa mass', [4.25, 2.2, 1.85], [-2.55, 1.35, 1.25], 'sofa-fabric', 0.18);
  addBlock('bookcase', 'Bookcase mass', [1.7, 5.85, 1.05], [-1.8, 3.18, -2.95], 'oak', 0.08);
  addBlock('media-cabinet', 'Media cabinet mass', [3.15, 2.65, 1.25], [2.45, 1.58, -2.6], 'oak', 0.08);
  addBlock('rug', 'Rug mass', [4.8, 0.12, 3.5], [0.55, 0.34, 1.25], 'rug-fabric', 0.15);
  addBlock('coffee-tables', 'Center tables mass', [3.4, 1.55, 1.7], [0.55, 1.1, 0.85], 'oak', 0.16);
  addBlock('window-curtains', 'Window opening mass', [4.8, 3.3, 0.14], [2.2, 4.5, -3.68], 'ocean', 0.03);
  addBlock('floor-lamp', 'Short floor lamp mass', [0.48, 4.35, 0.48], [0.15, 2.43, -2.05], 'black-metal', 0.12);
  addBlock('backpack', 'Slumped backpack mass', [1.35, 1.65, 0.48], [3.65, 1.12, 1.35], 'mauve-fabric', 0.18);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createWarmNordicMiniatureRoomLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Warm Nordic Miniature Room look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "warm-key", "type": "directional key light", "direction": [-0.55, -1.0, 0.65], "color": "#FFD9B8", "intensity": 2.4, "shadowSoftness": 0.72, "evidence": "soft warm highlights on upper-left wall trims and furniture"}, {"id": "window-fill", "type": "cool hemisphere fill light", "direction": [0.45, -0.25, -1.0], "color": "#DDEEFF", "intensity": 1.25, "evidence": "blue-ocean window lifts rear-right values without hard shadow"}, {"id": "environment-rim", "type": "warm neutral environment and rim light", "direction": [0.2, -0.8, -0.5], "color": "#FFF3E4", "intensity": 0.8, "evidence": "soft cream edge separation around sofa and backpack"}, {"id": "render-response", "type": "renderer exposure tone mapping and contact shadow", "exposure": 1.05, "toneMapping": "ACESFilmic", "background": "#F4F1EC", "contactShadow": "ambient occlusion plus soft shadow map under every floor-contact object"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createWarmNordicMiniatureRoomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameWarmNordicMiniatureRoomCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createWarmNordicMiniatureRoomPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureWarmNordicMiniatureRoomRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createWarmNordicMiniatureRoomInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
