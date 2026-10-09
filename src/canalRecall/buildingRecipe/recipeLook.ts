/**
 * City look for recipe-built houses (buildings pipeline GLBs).
 *
 * The streamed city (threeBuildingsBrowser.ts, 'photo' look) draws walls as
 * `cell texture x vertex tint x baked shade`: unlit, sRGB values straight to
 * the framebuffer, brick = the Bricks057 photo neutralised to luminance and
 * lifted (calmBayLayers), white-cream frames, lifted blue-grey glass, roof
 * cells (pantile/slate/flat) tinted by ROOF_TONES, and a fixed light baked as
 * `wallShade` / the roof shading formula. Recipe GLBs are lit meshes with flat
 * photo-sampled colours, so next to procedural neighbours they read as dark,
 * untextured blocks.
 *
 * This module makes them share that look: GLB materials carrying a
 * `materialSlot` extra (brick, accent, stone, frame, door, glass, roofTile,
 * slate, bitumen) are replaced by one small shader that samples the same kind
 * of cell texture, multiplies by the slot tint mapped into the city palette
 * range, and applies the city's fixed-light shade from the ENU normal.
 *
 * Pure colour/shade helpers are exported for tests; the material factory takes
 * the page's three.js namespace so the game (shared CanalRecallThree) and the
 * headless sheet renderer use the identical code path.
 */
import {paintRoofCell} from '../roofCells.ts';

export type RecipeSlot = 'brick' | 'accent' | 'stone' | 'frame' | 'door' | 'glass' | 'roofTile' | 'slate' | 'bitumen';
export const RECIPE_SLOTS: readonly RecipeSlot[] = ['brick', 'accent', 'stone', 'frame', 'door', 'glass', 'roofTile', 'slate', 'bitumen'];

type RGB = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw Error(`Bad colour ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgbToHex = (c: RGB) => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export function rgbToHsl([r, g, b]: RGB): RGB {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}
export function hslToRgb([h, s, l]: RGB): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Lightness range of the city's brick tints (priorBrickDark #6a3b2e .. buff #c49a5c, cityAppearancePalette.ts). */
export const CITY_BRICK_LIGHTNESS = [0.3, 0.6] as const;
/** City frame woodwork (bayTextures.ts photo look) and stone dressing. */
export const CITY_FRAME = '#f1ede2';
export const CITY_STONE = '#cfc8b8';
/** ROOF_TONES.photo (threeBuildingFeatures.ts) and the flat-roof greys. */
export const CITY_ROOF = {tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'], flat: ['#8f8a83', '#9a958c', '#85817c', '#a09789']} as const;

/**
 * Photo-sampled brick → city tint. Panorama samples are underexposed and hazy
 * (a dark-brown 1909 front samples #5e4033, L 0.28), while the city multiplies
 * its tint into a lifted brick texture. Keep the hue, lift lightness into the
 * city brick range preserving order (darker brick stays darker), restore some
 * saturation.
 */
export function cityWallTint(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const lifted = clamp(0.12 + l * 0.9, CITY_BRICK_LIGHTNESS[0], CITY_BRICK_LIGHTNESS[1]);
  return rgbToHex(hslToRgb([h, clamp(s, 0.12, 0.5), lifted]));
}
/** Light frames take the city's cream-white; dark painted frames stay dark but readable. */
export function cityFrameTint(hex: string): string {
  const rgb = hexToRgb(hex), [h, s, l] = rgbToHsl(rgb);
  if (l >= 0.5) return rgbToHex(mix(rgb, hexToRgb(CITY_FRAME), 0.75));
  return rgbToHex(hslToRgb([h, s, Math.max(l, 0.16)]));
}
export function cityStoneTint(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(mix(hslToRgb([h, s, Math.max(l, 0.62)]), hexToRgb(CITY_STONE), 0.45));
}
/** Doors and shopfront joinery: authored colour, never black holes. */
export function cityDoorTint(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, s, Math.max(l, 0.17)]));
}
/** Roof slots onto the city's roof tones; the authored steep/low/flat classes keep their order. */
export function cityRoofTint(slot: 'roofTile' | 'slate' | 'bitumen', hex: string): string {
  const l = rgbToHsl(hexToRgb(hex))[2];
  if (slot === 'roofTile') {
    const [h, s] = rgbToHsl(hexToRgb(hex));
    // Red/black tile intents: red keeps the city pantile, black tile reads as dark slate tone.
    if (s < 0.2) return CITY_ROOF.slate[1];
    return rgbToHex(hslToRgb([h, clamp(s * 1.1, 0.35, 0.6), clamp(0.2 + l * 0.85, 0.38, 0.5)]));
  }
  if (slot === 'slate') return l < 0.27 ? CITY_ROOF.slate[1] : l < 0.31 ? CITY_ROOF.slate[0] : CITY_ROOF.slate[2];
  return l < 0.4 ? CITY_ROOF.flat[2] : CITY_ROOF.flat[0];
}
export function cityTint(slot: RecipeSlot, hex: string): string {
  switch (slot) {
    case 'brick': case 'accent': return cityWallTint(hex);
    case 'stone': return cityStoneTint(hex);
    case 'frame': return cityFrameTint(hex);
    case 'door': return cityDoorTint(hex);
    case 'glass': return '#ffffff';
    default: return cityRoofTint(slot, hex);
  }
}

/** The city's fixed light (threeBuildingMesh.ts `wallShade` and roof formula), for an ENU unit normal. */
export function cityShade([e, n, u]: RGB): number {
  if (Math.abs(u) < 0.5) {
    const len = Math.hypot(e, n) || 1;
    return 0.8 + 0.2 * (0.5 + 0.5 * ((e / len) * -0.45 + (n / len) * 0.89));
  }
  if (u < 0) return 0.5;
  return clamp(0.58 + 0.42 * Math.max(0, e * -0.35 + n * 0.5 + u * 0.8), 0.5, 1);
}

/** Texture repeat per slot in metres (UVs are metres; glass UVs are 0..1 per pane). */
export const SLOT_TILE_M: Record<RecipeSlot, number> = {brick: 3.36, accent: 3.36, stone: 1.28, frame: 1, door: 1, glass: 1, roofTile: 1.2, slate: 1.2, bitumen: 1.2};

const VERTEX = /* glsl */ `
uniform mat3 enuFromWorld;
uniform float uvScale;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv * uvScale;
  vec3 n = normalize(enuFromWorld * (mat3(modelMatrix) * normal));
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = 0.8 + 0.2 * (0.5 + 0.5 * (h.x * -0.45 + h.y * 0.89)); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, n.x * -0.35 + n.y * 0.5 + n.z * 0.8), 0.5, 1.0);
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float highlight;
varying vec2 vUv;
varying float vShade;
void main() {
  vec3 c = texture2D(map, vUv).rgb * tint;
  c = mix(c, vec3(1.0, 0.824, 0.122), highlight);
  gl_FragColor = vec4(c * vShade, 1.0);
}`;

/** Brick cell: the city's bay-texture wall (Bricks057 photo + mortar coursing), neutralised and lifted like calmBayLayers('photo'). */
export function paintBrickCanvas(doc: Document, brick?: CanvasImageSource | null): HTMLCanvasElement {
  const size = 336, canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
  if (brick) for (let y = 0; y < size; y += 112) for (let x = 0; x < size; x += 112) ctx.drawImage(brick, x, y, 112, 112);
  else {
    // Fallback when the photo cannot load: stretcher bond with per-brick variation.
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0, y = 0; y < size; y += 14, row++) for (let x = -(row % 2) * 24; x < size; x += 48) { const v = 150 + rnd() * 50; ctx.fillStyle = `rgb(${v},${v * 0.92},${v * 0.86})`; ctx.fillRect(x, y, 48, 14); }
  }
  ctx.strokeStyle = 'rgba(235,223,205,0.18)'; ctx.lineWidth = 1.7;
  for (let row = 0, y = 6; y < size; y += 14, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    for (let x = (row % 2) * 24; x < size; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
  }
  const image = ctx.getImageData(0, 0, size, size), px = image.data;
  let mean = 0;
  for (let i = 0; i < px.length; i += 4) mean += (px[i] + px[i + 1] + px[i + 2]) / 3;
  mean /= px.length / 4;
  const lift = mean > 0 ? Math.min(2.4, 225 / mean) : 1;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 3, neutral = Math.min(255, (lum + (mean - lum) * 0.7) * lift);
    px[i] = px[i + 1] = px[i + 2] = neutral; px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Glass pane (UV 0..1 per pane): the city's lifted photo-look gradient plus a soft sky reflection. */
export function paintGlassCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Canvas y runs down; texture v runs up (flipY), so the top of the canvas is the top of the pane.
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#8aa1b0'); g.addColorStop(0.5, '#4d606c'); g.addColorStop(1, '#3c474e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(235,242,248,0.16)';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(34, 0); ctx.lineTo(4, 70); ctx.lineTo(-20, 70); ctx.closePath(); ctx.fill();
  return canvas;
}

function paintDoorCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 1.5, 128);
  return canvas;
}
function paintStoneCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < image.data.length; i += 4) { const v = 228 + (rnd() - 0.5) * 16; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
  ctx.fillStyle = 'rgba(80,70,60,0.18)'; ctx.fillRect(0, 0, 128, 1.5);
  return canvas;
}
function roofCanvas(doc: Document, kind: 'tile' | 'slate' | 'flat'): HTMLCanvasElement {
  const data = paintRoofCell(kind, false), size = Math.round(Math.sqrt(data.length / 4)), canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size);
  for (let i = 0; i < data.length; i += 4) { image.data[i] = data[i]; image.data[i + 1] = data[i + 1]; image.data[i + 2] = data[i + 2]; image.data[i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Marks resources the look owns, so per-model disposal leaves them for other houses. */
export const RECIPE_LOOK_SHARED = 'recipeLookShared';

export interface RecipeLook {
  /** Shared normal frame: maps world (model scene) directions to east/north/up. Set before rendering each model. */
  readonly enuFromWorld: {value: any};
  /** Replace slot-tagged materials under `root`; returns how many meshes changed. */
  apply(root: any): number;
}

/**
 * One look per page. `brick` is the decoded Bricks057 photo (the city's own
 * brick source); without it a drawn bond is used.
 */
export function createRecipeLook(THREE: any, options: {document?: Document; brick?: CanvasImageSource | null; anisotropy?: number} = {}): RecipeLook {
  const doc = options.document ?? document;
  const enuFromWorld = {value: new THREE.Matrix3()};
  const textures = new Map<string, any>();
  const texture = (key: string, paint: () => HTMLCanvasElement) => {
    let t = textures.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(paint());
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = options.anisotropy ?? 4;
      t.userData[RECIPE_LOOK_SHARED] = true;
      textures.set(key, t);
    }
    return t;
  };
  const slotTexture = (slot: RecipeSlot) => {
    switch (slot) {
      case 'brick': case 'accent': return texture('brick', () => paintBrickCanvas(doc, options.brick));
      case 'glass': { const t = texture('glass', () => paintGlassCanvas(doc)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
      case 'door': return texture('door', () => paintDoorCanvas(doc));
      case 'stone': return texture('stone', () => paintStoneCanvas(doc));
      case 'frame': return texture('flat-white', () => { const c = doc.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); return c; });
      case 'roofTile': return texture('tile', () => roofCanvas(doc, 'tile'));
      case 'slate': return texture('slate', () => roofCanvas(doc, 'slate'));
      case 'bitumen': return texture('flat', () => roofCanvas(doc, 'flat'));
    }
  };
  const materials = new Map<string, any>();
  const materialFor = (slot: RecipeSlot, tintHex: string, side: number) => {
    const tint = cityTint(slot, tintHex), key = `${slot}|${tint}|${side}`;
    let m = materials.get(key);
    if (!m) {
      const [r, g, b] = hexToRgb(tint).map(v => v / 255);
      m = new THREE.ShaderMaterial({
        uniforms: {map: {value: slotTexture(slot)}, tint: {value: new THREE.Vector3(r, g, b)}, uvScale: {value: 1 / SLOT_TILE_M[slot]}, highlight: {value: 0}, enuFromWorld},
        vertexShader: VERTEX, fragmentShader: FRAGMENT, side,
      });
      m.name = `recipe-look/${slot}`;
      m.userData = {[RECIPE_LOOK_SHARED]: true, materialSlot: slot, tint};
      materials.set(key, m);
    }
    return m;
  };
  return {
    enuFromWorld,
    apply(root: any) {
      let changed = 0;
      root.traverse((o: any) => {
        if (!o.isMesh || Array.isArray(o.material)) return;
        const slot = o.material?.userData?.materialSlot as RecipeSlot | undefined, tint = o.material?.userData?.tint as string | undefined;
        if (!slot || !RECIPE_SLOTS.includes(slot) || !tint || !o.geometry.getAttribute('uv')) return;
        const previous = o.material;
        o.material = materialFor(slot, tint, previous.side);
        if (!previous.userData?.[RECIPE_LOOK_SHARED]) previous.dispose();
        changed++;
      });
      return changed;
    },
  };
}

/** ENU-from-world for a scene whose +X is east, +Y up, +Z south (the sheet renderer's model frame). */
export const SOUTH_Z_ENU = [1, 0, 0, 0, 0, -1, 0, 1, 0] as const;
