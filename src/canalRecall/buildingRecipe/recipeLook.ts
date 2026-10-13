/**
 * City look for recipe-built houses (buildings pipeline GLBs).
 *
 * The streamed city (threeBuildingsBrowser.ts, 'photo' look) draws walls as
 * `cell texture x vertex tint x baked shade`: unlit, sRGB values straight to
 * the framebuffer, brick = the Bricks057 photo neutralised to luminance and
 * lifted (calmBayLayers), white-cream frames, lifted blue-grey glass, roof
 * cells (pantile/slate/flat) tinted by the palette's roof tones (look/palette.ts),
 * and a fixed light baked as
 * `wallShade` / the roof shading formula. Recipe GLBs are lit meshes with flat
 * photo-sampled colours, so next to procedural neighbours they read as dark,
 * untextured blocks.
 *
 * This module makes them share that look: GLB materials carrying a
 * `materialSlot` extra (brick, stucco, accent, stone, frame, door, glass, roofTile,
 * slate, bitumen) are replaced by one small shader that samples the same kind
 * of cell texture, multiplies by the slot tint mapped into the city palette
 * range (`cityTint`, look/palette.ts), and applies the city's fixed-light
 * shade from the ENU normal.
 *
 * Pure colour/shade helpers are exported for tests; the material factory takes
 * the page's three.js namespace so the game (shared CanalRecallThree) and the
 * headless sheet renderer use the identical code path.
 */
import {paintRoofCell} from '../roofCells.ts';
import {MATERIAL_SLOTS, SLOT_CELL, SLOT_TILE_M, cityTint, hexToRgb, type MaterialSlot} from '../look/palette.ts';

/** A GLB material's `materialSlot` extra (look/palette.ts owns the slot → cell/tint mapping). */
export type RecipeSlot = MaterialSlot;
export const RECIPE_SLOTS = MATERIAL_SLOTS;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
type RGB = [number, number, number];

/** The city's fixed light (threeBuildingMesh.ts `wallShade` and roof formula), for an ENU unit normal. */
export function cityShade([e, n, u]: RGB): number {
  if (Math.abs(u) < 0.5) {
    const len = Math.hypot(e, n) || 1;
    return 0.8 + 0.2 * (0.5 + 0.5 * ((e / len) * -0.45 + (n / len) * 0.89));
  }
  if (u < 0) return 0.5;
  return clamp(0.58 + 0.42 * Math.max(0, e * -0.35 + n * 0.5 + u * 0.8), 0.5, 1);
}

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
/** Plaster: near-white fine grain with a few darker specks and faint trowel streaks (no mortar courses, no brick photo). */
export function paintStuccoCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 128; y++) {
    const streak = (rnd() - 0.5) * 3;
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, speck = rnd() < 0.012 ? -14 : 0, v = 243 + (rnd() - 0.5) * 8 + streak + speck;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
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
  /** Shared normal frame: maps world (model scene) directions to east/north/up. Set before rendering each model. Unused when lit. */
  readonly enuFromWorld: {value: any};
  /** True when the slots are lit by the scene's lights (the shared frame's rig) instead of the baked city shade. */
  readonly lit: boolean;
  /** Replace slot-tagged materials under `root`; returns how many meshes changed. */
  apply(root: any): number;
}

export type RecipeLookOptions = {
  document?: Document;
  brick?: CanvasImageSource | null;
  anisotropy?: number;
  /**
   * `?sharedFrame=1`: diffuse-only lit materials (MeshLambertMaterial, like the
   * landmarks; landmarks/landmarkShading.ts) with the same cell textures and
   * the same slot tints, so the one light rig shades recipe houses exactly as
   * it shades the lit facades and the landmark GLBs beside them. Default
   * (false) keeps the unlit material with the city's baked shade.
   */
  lit?: boolean;
};

/**
 * One look per page. `brick` is the decoded Bricks057 photo (the city's own
 * brick source); without it a drawn bond is used.
 */
export function createRecipeLook(THREE: any, options: RecipeLookOptions = {}): RecipeLook {
  const lit = !!options.lit;
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
    switch (SLOT_CELL[slot]) {
      case 'brick': return texture('brick', () => paintBrickCanvas(doc, options.brick));
      case 'glass': { const t = texture('glass', () => paintGlassCanvas(doc)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
      case 'stucco': return texture('stucco', () => paintStuccoCanvas(doc));
      case 'door': return texture('door', () => paintDoorCanvas(doc));
      case 'stone': return texture('stone', () => paintStoneCanvas(doc));
      case 'frame': return texture('flat-white', () => { const c = doc.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); return c; });
      case 'tile': return texture('tile', () => roofCanvas(doc, 'tile'));
      case 'slate': return texture('slate', () => roofCanvas(doc, 'slate'));
      case 'flat': return texture('flat', () => roofCanvas(doc, 'flat'));
    }
  };
  const materials = new Map<string, any>();
  const materialFor = (slot: RecipeSlot, tintHex: string, side: number) => {
    const tint = cityTint(slot, tintHex), key = `${slot}|${tint}|${side}`;
    let m = materials.get(key);
    if (!m && lit) {
      // Same cell, same tint, same metre scale; the texture is decoded from
      // sRGB and the tint is linearised, so cell × tint matches the facades'
      // `pow(cell * tint, 2.2)` before the rig lights it.
      const map = slotTexture(slot);
      map.colorSpace = THREE.SRGBColorSpace;
      if (SLOT_CELL[slot] !== 'glass') map.repeat.set(1 / SLOT_TILE_M[slot], 1 / SLOT_TILE_M[slot]);
      m = new THREE.MeshLambertMaterial({map, color: new THREE.Color(tint), side});
      m.name = `recipe-look-lit/${slot}`;
      m.userData = {[RECIPE_LOOK_SHARED]: true, materialSlot: slot, tint};
      materials.set(key, m);
    }
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
    lit,
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
