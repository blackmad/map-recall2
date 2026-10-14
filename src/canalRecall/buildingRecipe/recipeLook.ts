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
import {paintBrickCanvas, paintDoorCanvas, paintGlassCanvas, paintStoneCanvas, paintStuccoCanvas, paintWhiteCanvas, roofCanvas} from '../look/slotCells.ts';
import {BAKED_SHADE_GLSL, bakedFaceShade, bakedWallShade} from '../rendererShared/lightRig.ts';
export {paintBrickCanvas, paintGlassCanvas, paintStuccoCanvas};
import {cityLookEnabled, getCityLook, type CityLook} from '../look/cityLook.ts';
import {INFERRED_SLOT_SOURCE} from '../look/materialSlotInference.ts';
import {MATERIAL_SLOTS, SLOT_CELL, SLOT_TILE_M, cityTint, hexToRgb, type MaterialSlot, type TintSource} from '../look/palette.ts';

/** A GLB material's `materialSlot` extra (look/palette.ts owns the slot → cell/tint mapping). */
export type RecipeSlot = MaterialSlot;
export const RECIPE_SLOTS = MATERIAL_SLOTS;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
type RGB = [number, number, number];

/** The city's fixed light (threeBuildingMesh.ts `wallShade` and roof formula), for an ENU unit normal. */
export function cityShade([e, n, u]: RGB): number {
  if (Math.abs(u) < 0.5) {
    const len = Math.hypot(e, n) || 1;
    return bakedWallShade(e / len, n / len);
  }
  if (u < 0) return 0.5;
  return bakedFaceShade([e, n, u]);
}

const VERTEX = /* glsl */ `
uniform mat3 enuFromWorld;
uniform float uvScale;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv * uvScale;
  vec3 n = normalize(enuFromWorld * (mat3(modelMatrix) * normal));
${BAKED_SHADE_GLSL}
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

/** Marks resources the look owns, so per-model disposal leaves them for other houses. */
export const RECIPE_LOOK_SHARED = 'recipeLookShared';

export interface RecipeLook {
  /** Shared normal frame: maps world (model scene) directions to east/north/up. Set before rendering each model. Unused when lit. */
  readonly enuFromWorld: {value: any};
  /** True when the slots are lit by the scene's lights (the shared frame's rig) instead of the baked city shade. */
  readonly lit: boolean;
  /**
   * Replace slot-tagged materials under `root`; returns how many meshes changed.
   * `context.year` (BAG construction year, `?cityLook=1` only) picks the city look's era brick; the legacy path ignores it.
   */
  apply(root: any, context?: {year?: number | null}): number;
  /** `?cityLook=1`: the shared city look behind this adapter (look/cityLook.ts); absent on the legacy path. */
  readonly city?: CityLook;
  /** `?cityLook=1`: resolves when its atlas is painted (apply before this and the slots would draw black for a frame). */
  readonly ready?: Promise<void>;
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
  /**
   * `?cityLook=1` (default: the page URL): slot materials become the city
   * look's (look/cityLook.ts): one texture array shared with the streamed
   * facades, one shader, attributes instead of per-material uniforms.
   */
  cityLook?: boolean;
  /** City look only: untagged materials take the slot their name and colour say (landmark GLBs; look/materialSlotInference.ts). */
  inferSlots?: boolean;
};

/**
 * One look per page. `brick` is the decoded Bricks057 photo (the city's own
 * brick source); without it a drawn bond is used.
 */
export function createRecipeLook(THREE: any, options: RecipeLookOptions = {}): RecipeLook {
  const lit = !!options.lit;
  if (options.cityLook ?? cityLookEnabled()) {
    // Thin adapter: callers keep `apply` / `enuFromWorld`; the city look does the work.
    const city = getCityLook(THREE, {document: options.document, brick: options.brick, anisotropy: options.anisotropy});
    return {enuFromWorld: city.uniforms.enuFromWorld, lit, city, ready: city.ready, apply: (root, context) => city.dress(root, {lit, infer: !!options.inferSlots, year: context?.year ?? null})};
  }
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
      case 'frame': return texture('flat-white', () => paintWhiteCanvas(doc));
      case 'tile': return texture('tile', () => roofCanvas(doc, 'tile'));
      case 'slate': return texture('slate', () => roofCanvas(doc, 'slate'));
      case 'flat': return texture('flat', () => roofCanvas(doc, 'flat'));
    }
  };
  const materials = new Map<string, any>();
  const materialFor = (slot: RecipeSlot, tintHex: string, side: number, source?: TintSource | null) => {
    const tint = cityTint(slot, tintHex, source), key = `${slot}|${tint}|${side}`;
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
        // Slots inferred into a legacy GLB (look/materialSlotInference.ts) only take part in the city look (`?cityLook=1`).
        if (o.material.userData.materialSlotSource === INFERRED_SLOT_SOURCE) return;
        const previous = o.material;
        o.material = materialFor(slot, tint, previous.side, previous.userData?.tintSource === 'measured' ? 'measured' : null);
        if (!previous.userData?.[RECIPE_LOOK_SHARED]) previous.dispose();
        changed++;
      });
      return changed;
    },
  };
}

/** ENU-from-world for a scene whose +X is east, +Y up, +Z south (the sheet renderer's model frame). */
export const SOUTH_Z_ENU = [1, 0, 0, 0, 0, -1, 0, 1, 0] as const;
