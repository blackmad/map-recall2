/**
 * City look: one material system for every building mesh (`?cityLook=1`).
 *
 * Before this, three parallel systems dressed buildings (docs/plans/
 * digital-twin-direction-20261013.md §2 "Look"):
 *  - the streamed city's `DataArrayTexture` bay cells (bayTextures.ts via
 *    threeBuildingsBrowser.ts `buildLookTextures`, unlit RawShaderMaterial or
 *    the lit `litFacadeMaterial.ts`);
 *  - recipe houses (buildingRecipe/recipeLook.ts: one CanvasTexture per slot,
 *    their own unlit shader or Lambert);
 *  - building types (buildingTypes/runtime.ts `mergedShaders`: recipe look
 *    with per-vertex sampler index);
 * and landmark GLBs carried their own flat materials. A landmark, a recipe
 * house and a generic extrusion never sampled the same brick under the same
 * light.
 *
 * Here there is one texture array whose layers are the bay cells followed by
 * the slot table (`SLOT_LAYERS`: brick, stucco, stone, white, door, glass,
 * pantile, slate, flat roof), one set of vertex attributes on every building
 * mesh (`layer`, `tint`, `accent`, `hidden`), and one shader in two variants:
 *  - unlit: the city's baked shade (default frame; `tint.a` on facade chunks,
 *    the same fixed light computed from the normal on GLB meshes);
 *  - lit: Lambert under the shared frame's one rig (rendererShared/lightRig.ts),
 *    diffuse only (docs/LOOK.md §Light).
 *
 * Facade chunks index the bay layers directly (`layer` = absolute layer, as
 * the chunk builder writes it). Slot meshes (recipe, landmark and building-type
 * GLBs) write the slot ordinal and the shader adds `slotBase`, because the
 * bay part of the array differs in length per Building look (196 layers for
 * photo, 256 for procedural) and the slot layers follow it.
 *
 * Inside the shared frame (one renderer) slot meshes sample the facades' own
 * array (`bindAtlas`), so it is literally one texture. In the legacy layers
 * each layer owns a WebGLRenderer, so a texture would upload once per
 * renderer; there slot meshes use a small array holding only the slot layers
 * (painted by the same code, same pixels).
 *
 * Flag off, nothing here runs: every adapter keeps its previous code path.
 */
import { PHOTO_WALL_CELL_MEAN, SLOT_CELL, SLOT_TILE_M, cityTint, hexToRgb, type MaterialSlot, type SlotCell } from './palette.ts';
import { inferMaterialSlot, isMaterialSlot, INFERRED_SLOT_SOURCE } from './materialSlotInference.ts';
import { paintBrickCanvas, paintDoorCanvas, paintGlassCanvas, paintStoneCanvas, paintStuccoCanvas, paintWhiteCanvas, roofCanvas } from './slotCells.ts';

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

export const CITY_LOOK_PARAM = 'cityLook';

/** `?cityLook=1` (or `window.__canalRecallCityLook = true` before the bundles run). */
export function cityLookEnabled(search?: string): boolean {
  try {
    const g = globalThis as any;
    if (search === undefined && g.__canalRecallCityLook === true) return true;
    return new URLSearchParams(search ?? g.location?.search ?? '').get(CITY_LOOK_PARAM) === '1';
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// The slot table: which layer each slot samples, at what scale and gain
// ---------------------------------------------------------------------------

export type SlotLayer = {
  cell: SlotCell | 'white';
  /** Texture repeat in metres (glass: 0..1 per pane on authored UVs). */
  tileM: number;
  /** Clamp authored UVs to one tile (glass panes); box-projected UVs repeat. */
  clampUv: boolean;
  /**
   * Lit variant only: gain on the cell so its mean is ~1 and the lit wall
   * shows its tint (the brick cell is lifted to 225/255 for the baked shade;
   * look/palette.ts `litWallGain` does the same for the bay cells).
   */
  litGain: number;
  /** Lit variant only: constant sky tint added to glazing (view-independent "reflection", landmarkShading.ts). */
  skyTint: boolean;
};

/** Layer order after the bay cells. Append only: the ordinal is written into slot meshes. */
export const SLOT_LAYERS: readonly SlotLayer[] = [
  { cell: 'brick', tileM: SLOT_TILE_M.brick, clampUv: false, litGain: 255 / 225, skyTint: false },
  { cell: 'stucco', tileM: SLOT_TILE_M.stucco, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'stone', tileM: SLOT_TILE_M.stone, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'white', tileM: 1, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'door', tileM: SLOT_TILE_M.door, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'glass', tileM: SLOT_TILE_M.glass, clampUv: true, litGain: 1, skyTint: true },
  { cell: 'tile', tileM: SLOT_TILE_M.roofTile, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'slate', tileM: SLOT_TILE_M.slate, clampUv: false, litGain: 1, skyTint: false },
  { cell: 'flat', tileM: SLOT_TILE_M.bitumen, clampUv: false, litGain: 1, skyTint: false },
];
export const SLOT_LAYER_COUNT = SLOT_LAYERS.length;

const CELL_ORDINAL: Readonly<Record<SlotCell | 'white', number>> = Object.fromEntries(SLOT_LAYERS.map((l, i) => [l.cell, i])) as any;

/** The slot layer (ordinal after the bay cells) a material slot samples. Frame and paint read plain white. */
export function slotLayerOf(slot: MaterialSlot): number {
  const cell = SLOT_CELL[slot];
  return cell === 'frame' ? CELL_ORDINAL.white : CELL_ORDINAL[cell];
}

/** Shader parameters per slot layer: x = 1 / tile metres, y = clamp UVs, z = lit gain, w = sky tint. */
export function slotParams(): [number, number, number, number][] {
  return SLOT_LAYERS.map(l => [1 / l.tileM, l.clampUv ? 1 : 0, l.litGain, l.skyTint ? 1 : 0]);
}

/** Bytes of the slot layers in a colour (RGBA) + mask (RG) array pair, with mipmaps. */
export function slotLayerBytes(size: number): number {
  return Math.round(SLOT_LAYER_COUNT * size * size * 6 * 4 / 3);
}

/** A slot mesh's `tint` attribute value: the slot colour mapped into the city range, sRGB bytes. */
export function slotTintBytes(slot: MaterialSlot, hex: string): [number, number, number, number] {
  const [r, g, b] = hexToRgb(cityTint(slot, hex));
  return [r, g, b, 255];
}

// ---------------------------------------------------------------------------
// Painting the slot layers (browser: canvases)
// ---------------------------------------------------------------------------

function slotCanvas(doc: Document, cell: SlotLayer['cell'], brick: CanvasImageSource | null): HTMLCanvasElement {
  switch (cell) {
    case 'brick': return paintBrickCanvas(doc, brick);
    case 'stucco': return paintStuccoCanvas(doc);
    case 'stone': return paintStoneCanvas(doc);
    case 'white': case 'frame': return paintWhiteCanvas(doc);
    case 'door': return paintDoorCanvas(doc);
    case 'glass': return paintGlassCanvas(doc);
    case 'tile': return roofCanvas(doc, 'tile');
    case 'slate': return roofCanvas(doc, 'slate');
    case 'flat': return roofCanvas(doc, 'flat');
  }
}

/**
 * The slot layers as texture-array pixels (`size` square, rows bottom-up like
 * `buildLookTextures`): colour RGBA and mask RG (r = 255: the whole cell takes
 * the tint; g = 0: no accent).
 */
export function paintSlotLayers(doc: Document, brick: CanvasImageSource | null, size: number): { colour: Uint8Array; mask: Uint8Array } {
  const px = size * size, colour = new Uint8Array(px * 4 * SLOT_LAYER_COUNT), mask = new Uint8Array(px * 2 * SLOT_LAYER_COUNT);
  const scratch = doc.createElement('canvas'); scratch.width = scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  SLOT_LAYERS.forEach((layer, i) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(slotCanvas(doc, layer.cell, brick), 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const from = ((size - 1 - y) * size + x) * 4, at = i * px + y * size + x;
      colour[at * 4] = pixels[from]; colour[at * 4 + 1] = pixels[from + 1]; colour[at * 4 + 2] = pixels[from + 2]; colour[at * 4 + 3] = 255;
      mask[at * 2] = 255; mask[at * 2 + 1] = 0;
    }
  });
  return { colour, mask };
}

/** Decode the city's brick photo (Bricks057); null keeps the drawn bond. */
export async function loadCityBrick(doc: Document = document): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', doc.baseURI).href;
  try { await image.decode(); return image; } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

/** What a material draws. */
export type CityVariant = {
  /** Lit under the shared rig (Lambert) or the city's baked shade. */
  lit: boolean;
  /** `chunk`: streamed facade chunks (absolute layer, shade in tint.a, no normals). `slot`: GLB meshes. */
  kind: 'chunk' | 'slot';
  /** Slot meshes: `uv` = authored UVs in metres; `box` = box projection from object position (landmark GLBs have no UVs). */
  uv?: 'uv' | 'box';
  /** Drawn in highlight yellow (the active landmark); a variant, because slot materials are shared. */
  highlight?: boolean;
  /** three.js side (FrontSide 0, BackSide 1, DoubleSide 2). */
  side?: number;
};

export const variantKey = (v: CityVariant) => `${v.lit ? 'lit' : 'unlit'}|${v.kind}|${v.kind === 'slot' ? v.uv ?? 'uv' : '-'}|${v.highlight ? 'hl' : '-'}|${v.side ?? 0}`;

/** Shader defines for a variant (also what the program cache key is built from). */
export function variantDefines(v: CityVariant): Record<string, string> {
  const d: Record<string, string> = { CITY_SLOT_COUNT: String(SLOT_LAYER_COUNT) };
  if (v.kind === 'slot') d.CITY_SLOT = '';
  if (v.kind === 'slot' && v.uv === 'box') d.CITY_BOX_UV = '';
  if (v.highlight) d.CITY_HIGHLIGHT = '';
  return d;
}

const HIGHLIGHT_SRGB = 'vec3(1.0, 0.824, 0.122)';
const HIGHLIGHT_LINEAR = 'vec3(1.0, 0.637, 0.0137)';
const SKY_TINT = 'vec3(0.035, 0.05, 0.07)';

/**
 * The highlight keeps the light and the grain (review 2026-10-13: the first
 * variant drew a flat yellow, while the default highlight keeps each model's
 * own shading and adds a yellow glow). The yellow replaces the tint, not the
 * cell: brick courses, stucco, glazing (dark: windows stay readable) show
 * through at `HIGHLIGHT_GRAIN`, and the light does the rest.
 *  - lit: yellow albedo at `HIGHLIGHT_ALBEDO`
 *    plus a small glow `HIGHLIGHT_GLOW` (was 0.45, which flattened the shade side);
 *  - unlit: the baked shade's contrast is widened (`HIGHLIGHT_SHADE_GAIN`:
 *    walls 0.8–1.0 become 0.64–1.0, roofs floor at 0.6), so the faces of a yellow model separate.
 */
export const HIGHLIGHT_ALBEDO = 1.0;
export const HIGHLIGHT_GLOW = 0.2;
export const HIGHLIGHT_GRAIN = 0.75;
export const HIGHLIGHT_SHADE_GAIN = 1.8;
const glslFloat = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** Grain of the highlighted cell: the cell's own luminance against the lifted brick mean, softened. */
const HIGHLIGHT_GRAIN_GLSL = /* glsl */ `
float cityGrain(vec3 cell) {
  float g = clamp(dot(cell, vec3(0.299, 0.587, 0.114)) / ${glslFloat(PHOTO_WALL_CELL_MEAN / 255)}, 0.45, 1.1);
  return mix(1.0, g, ${glslFloat(HIGHLIGHT_GRAIN)});
}`;

/** Shared vertex declarations (both variants). */
const VERTEX_DECLS = /* glsl */ `
attribute float layer;
attribute vec4 tint;
attribute vec4 accent;
attribute float hidden;
uniform float slotBase;
uniform vec4 slotParams[CITY_SLOT_COUNT];
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;`;

/**
 * Shared vertex body: layer, UVs, tint, highlight. Box projection works in the
 * mesh's own frame (glTF: Y up, metres) scaled by the model matrix, so courses
 * stay horizontal and the brick keeps its metre scale on any placement.
 */
const VERTEX_BODY = /* glsl */ `
vTint = tint.rgb; vAccent = accent.rgb;
vHighlight = hidden > 1.5 ? 1.0 : 0.0;
#ifdef CITY_HIGHLIGHT
vHighlight = 1.0;
#endif
#ifdef CITY_SLOT
  int cityS = int(clamp(layer + 0.5, 0.0, float(CITY_SLOT_COUNT - 1)));
  vSlot = slotParams[cityS];
  vLayer = slotBase + float(cityS);
  #ifdef CITY_BOX_UV
    vec3 cityN = abs(normal);
    vec3 cityQ = position * length(modelMatrix[0].xyz);
    vec2 cityUv = cityN.y > max(cityN.x, cityN.z) ? cityQ.xz : (cityN.x > cityN.z ? cityQ.zy : cityQ.xy);
    vFacUv = cityUv * vSlot.x;
    vSlot.y = 0.0;
  #else
    vFacUv = vSlot.y > 0.5 ? uv : uv * vSlot.x;
  #endif
#else
  vSlot = vec4(1.0, 0.0, 1.0, 0.0);
  vLayer = layer;
  vFacUv = uv;
#endif`;

/** Suppressed vertex (hidden = 1: a landmark replaces this facade) leaves the clip volume. */
const VERTEX_HIDE = /* glsl */ `
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`;

const FRAGMENT_DECLS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float bands;
uniform float flatColour;
uniform float cityFade;
uniform float wallGain;
varying vec2 vFacUv;
flat varying float vLayer;
flat varying vec4 vSlot;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
${HIGHLIGHT_GRAIN_GLSL}`;

const FRAGMENT_FADE = /* glsl */ `
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`;

/** Cell × tint × accent, the same arithmetic as the facade shader of 2026-10-02. */
const FRAGMENT_CELL = /* glsl */ `
vec2 cityUv = vSlot.y > 0.5 ? clamp(vFacUv, 0.0, 1.0) : vFacUv;
vec3 cityP = vec3(cityUv, vLayer);
vec3 cityC = texture(cells, cityP).rgb;
vec2 cityM = texture(masks, cityP).rg;
float cityG = cityGrain(cityC);
cityC *= mix(vec3(1.0), vTint, cityM.r) * mix(vec3(1.0), vAccent, cityM.g);`;

const UNLIT_VERTEX = /* glsl */ `
uniform mat3 enuFromWorld;
${VERTEX_DECLS}
varying float vShade;
void main() {
${VERTEX_BODY}
#ifdef USE_INSTANCING
  mat4 cityModel = modelMatrix * instanceMatrix;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
#else
  mat4 cityModel = modelMatrix;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#endif
#ifdef CITY_SLOT
  // The city's fixed light (threeBuildingMesh.ts wallShade and the roof formula), from the ENU normal.
  vec3 n = normalize(enuFromWorld * (mat3(cityModel) * normal));
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = 0.8 + 0.2 * (0.5 + 0.5 * (h.x * -0.45 + h.y * 0.89)); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, n.x * -0.35 + n.y * 0.5 + n.z * 0.8), 0.5, 1.0);
  vShade = shade;
#else
  vShade = tint.a;
#endif
${VERTEX_HIDE}
}`;

const UNLIT_FRAGMENT = /* glsl */ `
precision highp float;
${FRAGMENT_DECLS}
varying float vShade;
void main() {
${FRAGMENT_FADE}
${FRAGMENT_CELL}
  if (vHighlight > 0.5) {
    float hlShade = clamp(1.0 - (1.0 - vShade) * ${glslFloat(HIGHLIGHT_SHADE_GAIN)}, 0.6, 1.0);
    gl_FragColor = vec4(${HIGHLIGHT_SRGB} * (flatColour > 0.5 ? 1.0 : cityG) * hlShade, 1.0);
    return;
  }
  if (flatColour > 0.5) cityC = vTint;
  float shade = bands > 0.5 ? floor(vShade * bands + 0.5) / bands : vShade;
  gl_FragColor = vec4(cityC * shade, 1.0);
}`;

/** The uniforms every city-look material reads (shared objects: rebinding one updates every material using it). */
export type CityLookUniforms = {
  cells: { value: any };
  masks: { value: any };
  slotBase: { value: number };
  slotParams: { value: any[] };
  bands: { value: number };
  flatColour: { value: number };
  cityFade: { value: number };
  /** Lit chunks: gain on wall-masked bay texels (look/palette.ts `litWallGain`). */
  wallGain: { value: number };
  /** Unlit slot meshes: world → east/north/up for the baked shade (set per model in the legacy layers). */
  enuFromWorld: { value: any };
};

export function createCityUniforms(THREE: any, init: Partial<CityLookUniforms> = {}): CityLookUniforms {
  return {
    cells: init.cells ?? { value: null },
    masks: init.masks ?? { value: null },
    slotBase: init.slotBase ?? { value: 0 },
    slotParams: init.slotParams ?? { value: slotParams().map(p => new THREE.Vector4(...p)) },
    bands: init.bands ?? { value: 0 },
    flatColour: init.flatColour ?? { value: 0 },
    cityFade: init.cityFade ?? { value: 1 },
    wallGain: init.wallGain ?? { value: 1 },
    enuFromWorld: init.enuFromWorld ?? { value: new THREE.Matrix3() },
  };
}

/** Attribute values used when a mesh does not carry the attribute (GLB meshes: no accent, never hidden). */
const DEFAULT_ATTRIBUTES = { accent: [1, 1, 1, 1], hidden: [0], color: [1, 1, 1], uv: [0, 0], uv1: [0, 0] };

/** Mark shared by every city-look material (and the recipe look's, so landmark disposal leaves them). */
export const CITY_LOOK_SHARED = 'recipeLookShared';

/**
 * A city-look material. `uniforms` are shared objects (pass the same ones to
 * make materials follow one atlas). Facade chunks get flat shading (no normal
 * attribute); slot meshes use their normals.
 */
export function createCityLookMaterial(THREE: any, variant: CityVariant, uniforms: CityLookUniforms): any {
  const defines = variantDefines(variant);
  const side = variant.side ?? THREE.FrontSide;
  let material: any;
  if (!variant.lit) {
    material = new THREE.ShaderMaterial({ uniforms, defines, vertexShader: UNLIT_VERTEX, fragmentShader: UNLIT_FRAGMENT, side });
  } else {
    material = new THREE.MeshLambertMaterial({ side, flatShading: variant.kind === 'chunk' });
    material.defines = { ...(material.defines ?? {}), ...defines };
    material.onBeforeCompile = (shader: any) => {
      for (const key of Object.keys(uniforms) as (keyof CityLookUniforms)[]) shader.uniforms[key] = uniforms[key];
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>${VERTEX_DECLS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>${VERTEX_BODY}`)
        .replace('#include <project_vertex>', `#include <project_vertex>${VERTEX_HIDE}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>${FRAGMENT_DECLS}
float cityLuma;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${FRAGMENT_FADE}`)
        .replace('#include <map_fragment>', `${FRAGMENT_CELL}
#ifdef CITY_SLOT
cityC *= vSlot.z;
#else
cityC *= mix(1.0, wallGain, cityM.r);
#endif
if (flatColour > 0.5) cityC = vTint;
cityLuma = dot(cityC, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= vHighlight > 0.5 ? ${HIGHLIGHT_LINEAR} * ${glslFloat(HIGHLIGHT_ALBEDO)} * pow(flatColour > 0.5 ? 1.0 : cityG, 2.2) : pow(cityC, vec3(2.2));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vHighlight > 0.5) totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * ${glslFloat(HIGHLIGHT_GLOW)};
#ifdef CITY_SLOT
else totalEmissiveRadiance += ${SKY_TINT} * vSlot.w;
#else
// Bay glazing (dark, untinted texels): the same constant sky tint as landmark glass, never a hotspot.
else totalEmissiveRadiance += ${SKY_TINT} * (1.0 - smoothstep(0.06, 0.2, cityLuma)) * (1.0 - cityM.r);
#endif`);
    };
    material.customProgramCacheKey = () => `city-look-v2|${variantKey({ ...variant, side: 0 })}`;
    // ThreeBuildings reads and writes these like a ShaderMaterial's uniforms.
    material.uniforms = uniforms;
  }
  material.defaultAttributeValues = { ...DEFAULT_ATTRIBUTES };
  material.name = `city-look/${variantKey(variant)}`;
  material.userData = { cityLook: true, cityVariant: { ...variant }, [CITY_LOOK_SHARED]: true };
  return material;
}

// ---------------------------------------------------------------------------
// Dressing GLB meshes: attributes + the shared material
// ---------------------------------------------------------------------------

/** Why a material is left as it is (inference skips it). */
export function slotIneligible(material: any): string | null {
  if (!material) return 'no material';
  if (material.isMeshBasicMaterial || material.userData?.unlit) return 'unlit (decal / emissive sign)';
  if (material.transparent || (material.opacity ?? 1) < 1) return 'transparent';
  if (material.vertexColors) return 'vertex colours';
  if (material.map) return 'own texture';
  return null;
}

/** Slot + tint a material declares, or (when `infer`) what its name and colour say. Null = leave it. */
export function slotForMaterial(material: any, infer: boolean): { slot: MaterialSlot; tint: string; inferred: boolean } | null {
  const ud = material?.userData ?? {};
  if (isMaterialSlot(ud.materialSlot) && typeof ud.tint === 'string') {
    // Inferred extras written into a GLB only take part under the flag (they are, here).
    return { slot: ud.materialSlot, tint: ud.tint, inferred: ud.materialSlotSource === INFERRED_SLOT_SOURCE };
  }
  if (!infer || slotIneligible(material) || !material.color) return null;
  const tint = '#' + material.color.getHexString();
  const inferred = inferMaterialSlot(material.name, tint);
  return { slot: inferred.slot, tint: inferred.tint, inferred: true };
}

/** Write `layer` (slot ordinal) and `tint` on a geometry; false when it already carries different ones. */
export function setSlotAttributes(THREE: any, geometry: any, slot: MaterialSlot, hex: string): boolean {
  const n = geometry.getAttribute('position')?.count ?? 0;
  const layer = slotLayerOf(slot), tint = slotTintBytes(slot, hex);
  const prior = geometry.getAttribute('layer'), priorTint = geometry.getAttribute('tint');
  if (prior && priorTint) {
    const same = prior.getX(0) === layer && Math.round(priorTint.getX(0) * 255) === tint[0] && Math.round(priorTint.getY(0) * 255) === tint[1] && Math.round(priorTint.getZ(0) * 255) === tint[2];
    return same;
  }
  geometry.setAttribute('layer', new THREE.BufferAttribute(new Uint8Array(n).fill(layer), 1, false));
  const tints = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) tints.set(tint, i * 4);
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 4, true));
  return true;
}

export type CityLookOptions = {
  document?: Document;
  /** Decoded brick photo; undefined = load Bricks057, null = drawn bond. */
  brick?: CanvasImageSource | null;
  anisotropy?: number;
  /** Side of the slot-only array (default 256; 128 on touch devices). */
  size?: number;
};

export interface CityLook {
  /** Shared by every slot material: rebinding `cells`/`masks`/`slotBase` moves them all to another atlas. */
  readonly uniforms: CityLookUniforms;
  /** Resolves once the slot-only atlas is painted (slot meshes are never drawn black). */
  readonly ready: Promise<void>;
  /** One material per variant, cached. */
  material(variant: CityVariant): any;
  /**
   * Dress every slot-tagged mesh under `root` (with `infer`, untagged
   * landmark materials take the slot their name and colour say). Returns the
   * number of meshes changed.
   */
  dress(root: any, options: { lit: boolean; infer?: boolean }): number;
  /** The same mesh's material with the highlight on or off. */
  highlighted(material: any, on: boolean): any;
  /**
   * Shared frame: sample the facades' array (bay cells + slot layers starting
   * at `slotBase`) instead of the slot-only one. `null` returns to the own one.
   */
  bindAtlas(atlas: { colour: any; mask: any; slotBase: number } | null): void;
  /** Bytes of the textures this look itself holds (the slot-only atlas, until bound). */
  textureBytes(): number;
}

const REGISTRY_KEY = '__canalRecallCityLookShared';

/**
 * The page's city look (one per three.js namespace; bundles each carry this
 * code, so the instance lives on a global and every bundle gets the same one).
 */
export function getCityLook(THREE: any, options: CityLookOptions = {}): CityLook {
  const g = globalThis as any;
  const registry: Map<any, CityLook> = g[REGISTRY_KEY] ??= new Map();
  let look = registry.get(THREE);
  if (!look) registry.set(THREE, look = createCityLook(THREE, options));
  return look;
}

/** A fresh city look (tests and headless pages; the game uses `getCityLook`). */
export function createCityLook(THREE: any, options: CityLookOptions = {}): CityLook {
  const doc = options.document ?? (globalThis as any).document as Document;
  // Touch devices draw the facades at half resolution (threeBuildingsBrowser.ts); the slot array follows.
  const size = options.size ?? ((globalThis as any).matchMedia?.('(pointer: coarse)').matches ? 128 : 256);
  const uniforms = createCityUniforms(THREE);
  const materials = new Map<string, any>();
  let own: { colour: any; mask: any } | null = null;
  let bound = false;
  const arrayTexture = (data: Uint8Array, format: any) => {
    const t = new THREE.DataArrayTexture(data, size, size, SLOT_LAYER_COUNT);
    t.format = format; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = options.anisotropy ?? 4; t.unpackAlignment = 1; t.needsUpdate = true;
    t.userData = { bytes: data.byteLength, [CITY_LOOK_SHARED]: true };
    return t;
  };
  const ready = (async () => {
    if (!doc) return; // node (tests): materials and attributes only, no atlas
    const brick = options.brick !== undefined ? options.brick : await loadCityBrick(doc);
    const { colour, mask } = paintSlotLayers(doc, brick, size);
    own = { colour: arrayTexture(colour, THREE.RGBAFormat), mask: arrayTexture(mask, THREE.RGFormat) };
    if (!bound) { uniforms.cells.value = own.colour; uniforms.masks.value = own.mask; uniforms.slotBase.value = 0; }
  })();
  const material = (variant: CityVariant) => {
    const key = variantKey(variant);
    let m = materials.get(key);
    if (!m) materials.set(key, m = createCityLookMaterial(THREE, variant, uniforms));
    return m;
  };
  return {
    uniforms,
    ready,
    material,
    dress(root, { lit, infer = false }) {
      let changed = 0;
      root.traverse((o: any) => {
        if (!o.isMesh || Array.isArray(o.material) || o.material?.userData?.cityLook) return;
        const found = slotForMaterial(o.material, infer);
        if (!found) return;
        let geometry = o.geometry;
        if (!geometry?.getAttribute('position')) return;
        const hasUv = !!geometry.getAttribute('uv');
        if (!hasUv && !geometry.getAttribute('normal')) geometry.computeVertexNormals();
        if (!setSlotAttributes(THREE, geometry, found.slot, found.tint)) {
          // A geometry shared with another material: give this mesh its own attributes.
          geometry = o.geometry = geometry.clone();
          geometry.deleteAttribute('layer'); geometry.deleteAttribute('tint');
          setSlotAttributes(THREE, geometry, found.slot, found.tint);
        }
        const previous = o.material;
        o.material = material({ lit, kind: 'slot', uv: hasUv ? 'uv' : 'box', side: previous.side });
        o.userData.citySlot = { slot: found.slot, tint: found.tint, inferred: found.inferred, from: previous.name };
        if (!previous.userData?.[CITY_LOOK_SHARED]) previous.dispose();
        changed++;
      });
      return changed;
    },
    highlighted(current, on) {
      const v = current?.userData?.cityVariant as CityVariant | undefined;
      if (!v) return current;
      return material({ ...v, highlight: on });
    },
    bindAtlas(atlas) {
      bound = !!atlas;
      if (atlas) {
        uniforms.cells.value = atlas.colour; uniforms.masks.value = atlas.mask; uniforms.slotBase.value = atlas.slotBase;
      } else if (own) {
        uniforms.cells.value = own.colour; uniforms.masks.value = own.mask; uniforms.slotBase.value = 0;
      }
    },
    textureBytes() {
      return own && !bound ? Math.round((own.colour.userData.bytes + own.mask.userData.bytes) * 4 / 3) : 0;
    },
  };
}
