/**
 * The one palette for Canal Recall's buildings (docs/LOOK.md).
 *
 * Before 2026-10-13 colour lived in six places with three era schemes
 * (`cityAppearancePalette.ts` <1925/<1965, `buildingAppearance.ts`
 * 1800/1900/1945/1975/2000 with no runtime consumer, `bayLook.ts` /
 * `bayTextures.ts` 1860/1915/1945), plus roof tones in
 * `threeBuildingFeatures.ts`, the per-look front transform in
 * `landmarkFronts.ts` and the recipe-house clamps in
 * `buildingRecipe/recipeLook.ts`. This module now holds all of it:
 *
 *  - one era scheme (1860 / 1915 / 1945: the one the renderer draws);
 *  - the wall palettes per look and period, ground-floor paints, accents;
 *  - the contextual (unmeasured) display priors for the streamed city;
 *  - one roof-tone table and the flat-roof greys;
 *  - the `materialSlot` → texture cell / tint mapping that recipe GLBs and
 *    landmark GLBs carry;
 *  - the Building looks (photo / procedural / storybook / cartoon /
 *    untextured) as parameter sets, not as branches scattered through the
 *    renderer.
 *
 * Every value here is a display prior, never evidence about a building.
 * Values were moved verbatim: the default render path is pixel-identical to
 * the six modules it replaces (proved by the before/after look shots and the
 * palette golden dump, see the lane report of 2026-10-13).
 */

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------

/** The looks whose bay cells are painted from drawings (bayTextures.ts). */
export type TexturedLook = 'photo' | 'storybook' | 'cartoon';
/** The Building-look setting. */
export type BuildingLook = 'procedural' | 'untextured' | TexturedLook;
export const BUILDING_LOOKS: readonly BuildingLook[] = ['photo', 'procedural', 'storybook', 'cartoon', 'untextured'];

/** How authored (photo-natural) colours shift into a look; identity when undefined. */
export type ToneShift = {
  /** Degrees added to the hue. */
  hueShift: number;
  satMul: number;
  satAdd: number;
  /** Lightness at or above this is transformed; darker colours (glass, iron) keep theirs. */
  keepDarkBelow: number;
  lightMul: number;
  lightAdd: number;
  lightMax: number;
};

export type LookVariant = {
  /** Which texture-array cell set the facade shader samples. */
  cells: 'procedural' | TexturedLook;
  /** Quantised shade steps in the unlit facade shader (0 = smooth). */
  shadeBands: number;
  /** Vertex colour only: no brick, tile or grain from any cell. */
  flatColour: boolean;
  /** calmBayLayers: how far wall pixels are pulled toward their mean (brick reads as colour, not speckle). */
  wallPull: number;
  /** calmBayLayers: how much the darkest glass is lifted toward mid grey. */
  glassLift: number;
  /** calmBayLayers: neutralise the brick photo and lift its mean to ~0.88 (photo only). */
  liftBrick: boolean;
  /** Cartoon roof cells are drawn as flat illustrated tiles. */
  cartoonRoofCells: boolean;
  /** Painted cells are drawn as outlined, flat-filled shapes (bayTextures.ts; cartoon is the bolder). */
  outline: boolean;
  /** Landmark fronts and kits: authored colour → this look (landmarkFronts.ts lookHex). */
  tone?: ToneShift;
  /**
   * Shared frame only (lit facades): gain on the wall cell so its mean is 1,
   * i.e. the wall shows its tint, as a recipe house's or landmark's brick slot
   * does. The photo cells are lifted to a mean of 225/255 by calmBayLayers
   * (it was tuned for the unlit baked shade); under the rig that left generic
   * walls ~12 % darker than the same brick on a landmark (look parity, 2026-10-13).
   */
  litWallGain: number;
};

/** calmBayLayers lifts the photo look's wall cells to this mean (0..255). */
export const PHOTO_WALL_CELL_MEAN = 225;

/** Ink colour for the illustrated looks' outlines. */
export const OUTLINE_INK = '#3b2a2a';

const PHOTO_CALM = { wallPull: 0.7, glassLift: 0.5, liftBrick: true } as const;
const DRAWN_CALM = { wallPull: 0.35, glassLift: 0.25, liftBrick: false } as const;

export const LOOK_VARIANTS: Record<BuildingLook, LookVariant> = {
  photo: { cells: 'photo', shadeBands: 0, flatColour: false, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 255 / PHOTO_WALL_CELL_MEAN },
  procedural: { cells: 'procedural', shadeBands: 0, flatColour: false, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 1 },
  untextured: { cells: 'procedural', shadeBands: 0, flatColour: true, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 1 },
  // Storybook warms and lifts the natural palette a little, as an illustrator would.
  storybook: { cells: 'storybook', shadeBands: 0, flatColour: false, ...DRAWN_CALM, cartoonRoofCells: false, outline: true, litWallGain: 1,
    tone: { hueShift: -4, satMul: 1.15, satAdd: 0, keepDarkBelow: 0, lightMul: 1, lightAdd: 0.03, lightMax: 0.9 } },
  // Cartoon: punchy but not neon; darks (glass, iron) stay dark so windows still read.
  cartoon: { cells: 'cartoon', shadeBands: 3, flatColour: false, ...DRAWN_CALM, cartoonRoofCells: true, outline: true, litWallGain: 1,
    tone: { hueShift: 0, satMul: 1.7, satAdd: 0.08, keepDarkBelow: 0.35, lightMul: 1.08, lightAdd: 0, lightMax: 0.85 } },
};

/** The texture-cell set a look samples (`untextured` reuses procedural cells for layer indices). */
export const cellSetOf = (look: BuildingLook): 'procedural' | TexturedLook => LOOK_VARIANTS[look].cells;

// ---------------------------------------------------------------------------
// Colour utilities
// ---------------------------------------------------------------------------

export type RGB = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw Error(`Bad colour ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgbToHex = (c: RGB) => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** 0..255 RGB → [hue°, saturation, lightness]. */
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

// The front transform's own HSL pair (landmarkFronts.ts, kept bit-exact: it
// rounds differently from rgbToHsl/hslToRgb above, and fronts are authored
// against it).
const frontHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const frontHex = ([h, s, l]: [number, number, number]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('');
};

/**
 * An authored (natural, photo-look) colour in a Building look. Fronts and kits
 * are authored once in measured colours; each look's `tone` shifts them so a
 * landmark sits in the look like its neighbours do without per-look authoring.
 */
export function lookHex(hex: string, look: BuildingLook): string {
  const t = LOOK_VARIANTS[look].tone;
  if (!t) return hex;
  const [h, s, l] = frontHsl(hex);
  // Branches keep the original arithmetic bit-for-bit (no `+ 0`, no `% 360` without a shift).
  const hue = t.hueShift ? (h + 360 + t.hueShift) % 360 : h;
  const sat = Math.min(1, t.satAdd ? s * t.satMul + t.satAdd : s * t.satMul);
  const light = l < t.keepDarkBelow ? l : Math.min(t.lightMax, t.lightAdd ? l + t.lightAdd : l * t.lightMul);
  return frontHex([hue, sat, light]);
}

// ---------------------------------------------------------------------------
// Eras: one scheme, 1860 / 1915 / 1945
// ---------------------------------------------------------------------------

/** A building period, as the facade cells draw it. */
export type Period = 'canal' | 'c19' | 'school' | 'modern';
export const PERIODS: readonly Period[] = ['canal', 'c19', 'school', 'modern'];

/**
 * The first construction year of each period. These are the boundaries that
 * changed what Amsterdam built with: canal houses before 1860, the
 * 19th-century ring 1860–1914, the Amsterdamse School 1915–1944, post-war and
 * modern blocks from 1945.
 */
export const PERIOD_FROM: Readonly<Record<Period, number>> = { canal: -Infinity, c19: 1860, school: 1915, modern: 1945 };

/** The period a (validated) construction year falls in. Callers own their own validity window. */
export function periodForYear(year: number): Period {
  return year < PERIOD_FROM.c19 ? 'canal' : year < PERIOD_FROM.school ? 'c19' : year < PERIOD_FROM.modern ? 'school' : 'modern';
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

/** Roof colours per look: pantile and slate (a look's own tones, picked by the plan's `tone`). */
export const ROOF_TONES: Record<BuildingLook, { tile: readonly string[]; slate: readonly string[] }> = {
  procedural: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  untextured: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  photo: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  storybook: { tile: ['#b9553a', '#a94a33', '#c46a45'], slate: ['#556070', '#4a5666', '#657282'] },
  cartoon: { tile: ['#e85a3c', '#f08a2b', '#d94a3a'], slate: ['#3f5f8f', '#2f4a78', '#4f7bb0'] },
};
/**
 * Flat roofs: three kinds a reader can tell apart from 200 m, not one mid-grey
 * (user, Kinkerbuurt aerial 2026-10-13: "so much grey"). Warm buff gravel,
 * pale membrane (EPDM/PVC, light-coloured), dark cool bitumen. Index 0 is the
 * light default and index 2 the dark one (`cityRoofTint`'s bitumen slot); which
 * kind a roof is belongs to the roof-slot lane (orthophoto), not to this table.
 * Were #8f8a83 #9a958c #85817c #a09789 (one grey band, L 0.5–0.58).
 */
/** The photo look's roofs, as one table (recipe houses map onto it). */

/**
 * Measured roof slots (roof-facts sidecar, `roofs/roofSlots.ts`): the slot a roof gets is chosen
 * from the PDOK orthophoto; how a slot looks is this table. `hex` is the slot's display base,
 * `luma` its sRGB Rec.709 band (0-255): a measured tint is pulled into the band, never outside it
 * (LOOK §Palette, roof band check in `roofSlots.test.ts`). `cell` is the texture cell it draws on.
 */
export type RoofSlot = 'gravel' | 'bitumen-dark' | 'bitumen-light' | 'white-membrane' | 'pantile-red' | 'pantile-dark' | 'slate' | 'zinc' | 'sedum' | 'solar' | 'terrace' | 'glass';
export const ROOF_SLOTS: readonly RoofSlot[] = ['gravel', 'bitumen-dark', 'bitumen-light', 'white-membrane', 'pantile-red', 'pantile-dark', 'slate', 'zinc', 'sedum', 'solar', 'terrace', 'glass'];
export const ROOF_SLOT_TONES: Readonly<Record<RoofSlot, { hex: string; luma: readonly [number, number]; cell: 'tile' | 'slate' | 'flat' }>> = {
  'gravel': { hex: '#9e9281', luma: [112, 156], cell: 'flat' },
  'bitumen-dark': { hex: '#56585e', luma: [62, 96], cell: 'flat' },
  'bitumen-light': { hex: '#a99b84', luma: [150, 182], cell: 'flat' },
  'white-membrane': { hex: '#d9d9d3', luma: [196, 228], cell: 'flat' },
  'pantile-red': { hex: '#b5543a', luma: [84, 124], cell: 'tile' },
  'pantile-dark': { hex: '#6a5248', luma: [64, 98], cell: 'tile' },
  'slate': { hex: '#4b525c', luma: [62, 140], cell: 'slate' },
  'zinc': { hex: '#9aa1a6', luma: [138, 176], cell: 'slate' },
  'sedum': { hex: '#7a8350', luma: [96, 132], cell: 'flat' },
  'solar': { hex: '#2e3a52', luma: [44, 70], cell: 'flat' },
  'terrace': { hex: '#a38d74', luma: [124, 162], cell: 'flat' },
  'glass': { hex: '#8fa3ad', luma: [130, 170], cell: 'flat' },
};
/**
 * Flat roofs without a measurement (the mood pass's three kinds plus pebble)
 * take their colour from the slot table, so a measured and an unmeasured
 * gravel roof match side by side (one table, 2026-10-13).
 */
export const FLAT_ROOF_TONES = { gravel: ROOF_SLOT_TONES.gravel.hex, membrane: ROOF_SLOT_TONES['white-membrane'].hex, bitumen: ROOF_SLOT_TONES['bitumen-dark'].hex, pebble: ROOF_SLOT_TONES['bitumen-light'].hex } as const;
export const FLAT_ROOF_GREYS: readonly string[] = [FLAT_ROOF_TONES.gravel, FLAT_ROOF_TONES.membrane, FLAT_ROOF_TONES.bitumen, FLAT_ROOF_TONES.pebble];
export const CITY_ROOF = { tile: ROOF_TONES.photo.tile, slate: ROOF_TONES.photo.slate, flat: FLAT_ROOF_GREYS } as const;
/** sRGB Rec.709 luma, 0..255. */
export const lumaOf = ([r, g, b]: RGB): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A pitched roof's colour from its plan material and 0..1 tone. */
export function roofTone(look: BuildingLook, material: 'tile' | 'slate', tone: number): string {
  const set = ROOF_TONES[look][material];
  return set[Math.min(set.length - 1, Math.floor(tone * set.length))];
}

// ---------------------------------------------------------------------------
// Walls: bay-cell looks (photo / storybook / cartoon)
// ---------------------------------------------------------------------------

/** Wall colour for a building with no facade and no mapped colour (MapLibre's neutral building colour). */
export const BARE_WALL_HEX = '#c9bfae';
/** Wall colour when a generic-facade building carries no side colour. */
export const DEFAULT_FACADE_WALL_HEX = '#a4523b';
/** Shop signature colour when the extract names none. */
export const DEFAULT_SHOP_SIGN_HEX = '#1f4d3a';

const ILLUSTRATED_WALLS = ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2', '#c9714a', '#f2c14e', '#b9a1c9'];
const ILLUSTRATED_ACCENTS = ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c', '#7a3b6e', '#2f6b45', '#4aa3d9'];
const ILLUSTRATED: Record<Period, { walls: string[]; accents: string[] }> = {
  canal: { walls: ILLUSTRATED_WALLS, accents: ILLUSTRATED_ACCENTS },
  c19: { walls: ILLUSTRATED_WALLS, accents: ILLUSTRATED_ACCENTS },
  school: { walls: ['#9c5a42', '#8a4b3a', '#a8664c', '#7a4a40'], accents: ['#2c4a7c', '#2a8c8c', '#e0a526'] },
  modern: { walls: ['#f4efe6', '#dcdcd6', '#e9d9c0', '#b9c4cc', '#f0c9a9'], accents: ['#2a8c8c', '#d9453d', '#2c4a7c', '#e0a526'] },
};
const PHOTO_PASTEL = ['#ffffff', '#f2d9c8', '#d9b9a4', '#e6c9b0', '#c9a38c', '#f0e4d2', '#ffd9b0', '#e8c0b0', '#d0c8c0'];
const PHOTO_DARK_ACCENTS = ['#243a2f', '#1f2a3a', '#3a1f1c', '#222222', '#2f4a3c', '#6b2b2b', '#2c3e50'];

/** Archetype wall and accent palettes per look (the spike's palettes; `paletteFor`). */
export const PALETTES: Record<TexturedLook, Record<Period, { walls: string[]; accents: string[] }>> = {
  cartoon: ILLUSTRATED,
  storybook: ILLUSTRATED,
  photo: {
    canal: { walls: PHOTO_PASTEL, accents: PHOTO_DARK_ACCENTS },
    c19: { walls: PHOTO_PASTEL, accents: PHOTO_DARK_ACCENTS },
    school: { walls: ['#b89080', '#a88070', '#9c7868'], accents: ['#1f2a3a', '#243a2f', '#3a1f1c'] },
    modern: { walls: ['#f2f2ee', '#d8d8d2', '#e8dcc8', '#c8d0d4'], accents: ['#2c3e50', '#6b2b2b', '#243a2f'] },
  },
};

/**
 * Wall colours for the photo look: the real Amsterdam range (red and orange
 * brick, grey-brown, buff, a little limewash), with weights so reds dominate
 * the way they do on the streets.
 */
export const PHOTO_WALLS = ['#b05a40', '#b05a40', '#a24d38', '#bd6a45', '#9a5846', '#8c5a48', '#c58b5e', '#d3b184', '#a8766a', '#7f6258', '#d9c5a4'];
/** Storybook: the natural palette, slightly warmed and softened, as an illustrator would paint it. */
export const STORYBOOK_WALLS = ['#c8664a', '#c8664a', '#b9583f', '#d98b5f', '#e0b36a', '#ead9b0', '#c9a08c', '#b87a5c', '#9bb09a', '#8aa4b8', '#d9b995'];
/** Cartoon: a short sticker palette, saturated and similar in value, so the street reads as one bold design. */
export const CARTOON_WALLS = ['#e8573d', '#e8573d', '#ee7f2c', '#f2b92e', '#f2b92e', '#2a9d8f', '#4672b0', '#f3e6c8', '#d96a4d'];

/**
 * Wall colours by period (user 2026-10-02, from the real-vs-game sheet: "one brick palette"
 * everywhere). Unmeasured, so still hash-picked per building, but from the range each period
 * really has: canal houses in deep red-brown brick, often painted near-black, dark green or
 * grey, a few in white stucco; 1860-1914 rows in red and orange brick with buff and cream
 * stucco; Amsterdam School in dark purple-brown and orange brick; post-war and modern blocks in
 * buff, grey and concrete. null keeps the archetype palette (`PALETTES`).
 */
export const PERIOD_WALLS: Record<TexturedLook, Record<Period, readonly string[] | null>> = {
  photo: {
    canal: ['#7a3b2c', '#7a3b2c', '#6b3428', '#8c4632', '#9a5846', '#b05a40', '#4a2e26', '#2e2a27', '#3e4a40', '#5d605a', '#e4ddcd'],
    c19: ['#b05a40', '#b05a40', '#bd6a45', '#a24d38', '#c58b5e', '#d3b184', '#e2d5ba', '#e2d5ba', '#d9c5a4', '#9a5846'],
    school: ['#8c4a38', '#7a4535', '#9a5240', '#6e3d33', '#a85a3c', '#5e3a32', '#b0603f'],
    modern: ['#c9b79a', '#b9ad9a', '#a8a49c', '#d3c6ad', '#8f8a82', '#bfb3a0', '#9c7a62', '#b05a40'],
  },
  storybook: {
    canal: ['#b9583f', '#9a4a38', '#7a4a3c', '#4a5048', '#3f4a5a', '#ead9b0', '#c8664a'],
    c19: ['#c8664a', '#d98b5f', '#e0b36a', '#ead9b0', '#d9b995', '#c9a08c', '#c8664a'],
    school: ['#a8553f', '#9a5a48', '#b87a5c', '#c8664a', '#8a4e40'],
    modern: null,
  },
  cartoon: {
    canal: ['#d9453d', '#a8433a', '#3b3b4a', '#2a9d8f', '#4672b0', '#fffaf0', '#e8573d'],
    c19: ['#e8573d', '#ee7f2c', '#f2b92e', '#f3e6c8', '#d96a4d', '#f2b92e'],
    school: ['#d96a4d', '#e8573d', '#b9583f', '#ee7f2c'],
    modern: null,
  },
};

/**
 * Ground-floor paint for shopfronts, per look, weighted the way Amsterdam streets are: mostly
 * white and cream, then the dark greens, blacks, oxbloods and navies of older shopfronts.
 */
export const GROUND_PAINTS: Record<TexturedLook, readonly string[]> = {
  photo: ['#f1eee6', '#f1eee6', '#f1eee6', '#e8dfc9', '#e8dfc9', '#2b2d2c', '#2f4a3a', '#5a2a26', '#25344a', '#8b8f8c'],
  storybook: ['#f6f1e4', '#f6f1e4', '#f6f1e4', '#efe2c2', '#efe2c2', '#3a3d3c', '#3f6a52', '#8a3b33', '#3a527a', '#a3a8a4'],
  cartoon: ['#fffaf0', '#fffaf0', '#fffaf0', '#ffe9b8', '#ffe9b8', '#3b3b4a', '#2a9d8f', '#d9453d', '#4672b0', '#f2b92e'],
};

// ---------------------------------------------------------------------------
// Walls: contextual display priors for the streamed city (unmeasured)
// ---------------------------------------------------------------------------

/** Deterministic display priors shared by the Three study and MapLibre game.
 * These colours are contextual visualization, never observed facade evidence. */
export const CONTEXTUAL_BUILDING_COLOURS = {
  // Deliberately sit far enough below the clean theme's cream ground to keep
  // whole blocks legible after MapLibre's directional light is applied. V1's
  // plaster/light values bleached into the basemap in overview and mobile
  // captures, making otherwise decorated buildings look uncoloured.
  // V3 (user report 2026-09-29, "these fake colors are too drab"): V2's
  // grey-browns and grey flat caps read as one dun mass from the chase. Brick
  // is redder and richer, buff is ochre, grey is a blue slate, a rare canal
  // green joins, and flat caps mix bitumen, terracotta, slate and gravel.
  priorBrickRed: '#a4523b', priorBrickBrown: '#84503a', priorBrickDark: '#6a3b2e', priorBrickBuff: '#c49a5c',
  priorPlaster: '#d3c3a0', priorModernLight: '#c2bdb2', priorModernGrey: '#7a8a94', priorCanalGreen: '#557260',
  // Mood pass (2026-10-13, "the whole city is a little dark/dour"; were #7c8080, #56606a, #a59e8f):
  // seen from the chase the caps are most of the frame.
  // Later the same day ("so much grey"): the caps follow FLAT_ROOF_TONES' three kinds
  // (pale membrane, dark bitumen, warm gravel) instead of three greys.
  roof: '#c3c1bb', priorRoofWarm: '#9a5e48', priorRoofDark: '#56585e', priorRoofGravel: '#a99b84',
} as const;
export type ContextualBuildingColour = keyof typeof CONTEXTUAL_BUILDING_COLOURS;

function stableVariant(id: string, values: ContextualBuildingColour[]): ContextualBuildingColour {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return values[(hash >>> 0) % values.length];
}

/** City-scale fallback when the delivery tile has neither an observed OSM
 * material/colour nor a source-bound area prior. Identity gives adjacent BAG
 * buildings stable restrained variation without pretending an unknown build
 * year or facade material was observed. */
export function citywideBuildingWallPrior(id: string): string {
  return CONTEXTUAL_BUILDING_COLOURS[stableVariant(id, ['priorBrickRed', 'priorBrickRed', 'priorBrickBrown', 'priorBrickDark', 'priorBrickBuff', 'priorPlaster', 'priorModernLight', 'priorModernGrey', 'priorCanalGreen'])];
}
export function citywideBuildingRoofPrior(id: string): string {
  return CONTEXTUAL_BUILDING_COLOURS[stableVariant(`${id}:roof`, ['roof', 'priorRoofWarm', 'priorRoofDark', 'priorRoofGravel'])];
}
/** Without ground-floor evidence, continue the wall colour to street level. */
export function citywideBuildingGroundPrior(id: string): string { return citywideBuildingWallPrior(id); }

/** Contextual wall keys per period (the study pages' `contextualBuildingPalette`). */
const CONTEXTUAL_PERIOD_WALLS: Record<'old' | 'interwar' | 'modern', ContextualBuildingColour[]> = {
  old: ['priorBrickRed', 'priorBrickBrown', 'priorBrickDark', 'priorBrickBuff', 'priorPlaster', 'priorCanalGreen'],
  interwar: ['priorBrickRed', 'priorBrickBrown', 'priorBrickBuff', 'priorModernGrey'],
  modern: ['priorBrickBuff', 'priorModernLight', 'priorModernGrey', 'priorPlaster'],
};

/**
 * Study pages (cityAppearanceThree): a building's contextual wall/roof keys.
 * Uses the one era scheme: before 1915 → old, 1915–1944 → interwar, else
 * modern (was <1925 / <1965 before the palette merge, study pages only).
 */
export function contextualBuildingPalette(id: string, constructionYear?: number | null) {
  const year = Number(constructionYear);
  const band = Number.isFinite(year) && year < PERIOD_FROM.school ? 'old' : Number.isFinite(year) && year < PERIOD_FROM.modern ? 'interwar' : 'modern';
  const wall = stableVariant(id, CONTEXTUAL_PERIOD_WALLS[band]);
  const roof = stableVariant(id, ['roof', 'priorRoofWarm', 'priorRoofDark', 'priorRoofGravel']);
  // A separate base colour would invent a material change without evidence.
  const ground = wall;
  return { wallKey: wall, roofKey: roof, groundKey: ground, wall: CONTEXTUAL_BUILDING_COLOURS[wall], roof: CONTEXTUAL_BUILDING_COLOURS[roof], ground: CONTEXTUAL_BUILDING_COLOURS[ground] };
}

/** OSM `building:material` → display hue. A material family suggests a hue, never a measured wall colour. */
export const MATERIAL_WALL_COLOURS: Readonly<Record<string, string>> = { brick: '#9a5846', stone: '#bcb5a6', concrete: '#b9b8b2', plaster: '#ded8cb', stucco: '#ded8cb', wood: '#8c6f55', metal: '#999c9e', glass: '#8d9a9e' };
export function materialWallDisplayPrior(material: unknown): string | null {
  if (typeof material !== 'string') return null;
  const key = material.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MATERIAL_WALL_COLOURS, key) ? MATERIAL_WALL_COLOURS[key] : null;
}

/** Generic-facade styles (genericFacades.ts) → the contextual colours each may wear. */
export const FACADE_STYLE_COLOURS: Record<'canal' | 'c19' | 'school' | 'postwar' | 'modern' | 'tower', readonly ContextualBuildingColour[]> = {
  canal: ['priorBrickRed', 'priorBrickBrown', 'priorBrickDark', 'priorPlaster'],
  c19: ['priorBrickRed', 'priorBrickBrown', 'priorPlaster'],
  school: ['priorBrickRed', 'priorBrickBrown', 'priorBrickDark'],
  postwar: ['priorBrickBuff', 'priorBrickRed', 'priorModernGrey'],
  modern: ['priorModernLight', 'priorModernGrey', 'priorBrickBuff'],
  tower: ['priorModernGrey', 'priorModernLight'],
};

/**
 * One representative wall/roof per period, for appearance reports
 * (buildingAppearance.ts era prior). Drawn from the tables above so a report
 * and the renderer name the same colour for the same period.
 */
export const PERIOD_PRIORS: Readonly<Record<Period, { label: string; wall: string; roof: string }>> = {
  canal: { label: 'canal-house centre (before 1860)', wall: PERIOD_WALLS.photo.canal![0], roof: ROOF_TONES.photo.tile[0] },
  c19: { label: '19th-century ring (1860-1914)', wall: PERIOD_WALLS.photo.c19![0], roof: ROOF_TONES.photo.tile[1] },
  school: { label: 'Amsterdamse School (1915-1944)', wall: PERIOD_WALLS.photo.school![0], roof: ROOF_TONES.photo.slate[0] },
  modern: { label: 'post-war and contemporary (1945+)', wall: PERIOD_WALLS.photo.modern![0], roof: FLAT_ROOF_GREYS[0] },
};
/** Neutral fallbacks when nothing at all is known. */
export const UNKNOWN_WALL_HEX = '#B4ADA3';
export const UNKNOWN_ROOF_HEX = '#7A756E';

// ---------------------------------------------------------------------------
// Material slots (recipe GLBs, landmark GLBs, compiled tiles)
// ---------------------------------------------------------------------------

/**
 * `paint`: a flat authored colour with no grain (metals, signage, painted
 * trims, decals on landmark GLBs). Added 2026-10-13 for the legacy landmark
 * slot inference (look/materialSlotInference.ts): gold, bronze, copper and the
 * coloured paints have no brick/stone/roof cell, but should still answer to
 * the shared atlas and light instead of a private material.
 */
export type MaterialSlot = 'brick' | 'stucco' | 'accent' | 'stone' | 'frame' | 'door' | 'glass' | 'roofTile' | 'slate' | 'bitumen' | 'paint';
export const MATERIAL_SLOTS: readonly MaterialSlot[] = ['brick', 'stucco', 'accent', 'stone', 'frame', 'door', 'glass', 'roofTile', 'slate', 'bitumen', 'paint'];

/** Which painted texture cell a slot samples. */
export type SlotCell = 'brick' | 'stucco' | 'stone' | 'frame' | 'door' | 'glass' | 'tile' | 'slate' | 'flat';
export const SLOT_CELL: Readonly<Record<MaterialSlot, SlotCell>> = {
  brick: 'brick', accent: 'brick', stucco: 'stucco', stone: 'stone', frame: 'frame', door: 'door', glass: 'glass', roofTile: 'tile', slate: 'slate', bitumen: 'flat', paint: 'frame',
};
/** Texture repeat per slot in metres (UVs are metres; glass UVs are 0..1 per pane). */
export const SLOT_TILE_M: Readonly<Record<MaterialSlot, number>> = { brick: 3.36, stucco: 2.4, accent: 3.36, stone: 1.28, frame: 1, door: 1, glass: 1, roofTile: 1.2, slate: 1.2, bitumen: 1.2, paint: 1 };

/** Lightness range of the city's brick tints (priorBrickDark #6a3b2e .. buff #c49a5c). */
export const CITY_BRICK_LIGHTNESS = [0.3, 0.6] as const;
/** City frame woodwork (bay cells, photo look) and stone dressing. */
export const CITY_FRAME = '#f1ede2';
export const CITY_STONE = '#cfc8b8';

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
/**
 * Rendered/painted plaster (`stucco` slot, intent `palette.wallMaterial: 'stucco'`). The brick tint is wrong for it twice:
 * it clamps lightness to the city brick range (L <= 0.6, so a white wall lands at tan) and floors saturation at 0.12
 * (so any neutral gains a warm cast), and the brick texture is a mid-grey photo. Stucco keeps the authored hue and
 * saturation and only lifts lightness a little (the city multiplies tint x texture x shade, which darkens a pale
 * wall by about 10 %), so white stays white, cream cream and grey grey.
 */
export function cityStuccoTint(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, clamp(s, 0, 0.55), clamp(l * 1.06 + 0.03, 0.4, 0.97)]));
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
  if (l >= 0.17) return hex.startsWith('#') ? hex.toLowerCase() : '#' + hex.toLowerCase();
  // Near-neutral blacks lift to a neutral grey: an HSL lift would adopt the arbitrary hue of #1f2121 as a teal cast.
  return rgbToHex(hslToRgb([h, s < 0.15 ? 0 : s, 0.17]));
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
/** An authored slot colour mapped into the city palette range. */
export function cityTint(slot: MaterialSlot, hex: string): string {
  switch (slot) {
    case 'brick': case 'accent': return cityWallTint(hex);
    case 'stucco': return cityStuccoTint(hex);
    case 'stone': return cityStoneTint(hex);
    case 'frame': return cityFrameTint(hex);
    case 'door': return cityDoorTint(hex);
    case 'glass': return '#ffffff';
    // Metals, signage and coloured paint keep the authored colour (it is the identity of the thing).
    case 'paint': return hex.startsWith('#') ? hex.toLowerCase() : '#' + hex.toLowerCase();
    default: return cityRoofTint(slot, hex);
  }
}

// ---------------------------------------------------------------------------
// Street ground (own ground, `?ownGround=1`): the Amsterdam street vocabulary
// ---------------------------------------------------------------------------

/**
 * Display priors for the drawn street surfaces (not measured per street): red
 * asphalt cycle paths, brick-red klinker carriageways, grey-rose klinker
 * pavements with a pale granite kerb, steel tram rails, oxblood
 * Amsterdammertjes. Base RGB for the procedural textures; joints darker.
 */
export const STREET_GROUND = {
  asphalt: { base: [72, 74, 78] as RGB },
  cycle: { base: [150, 66, 58] as RGB },
  klinker: { base: [128, 82, 66] as RGB, joint: '#5a463d' },
  pavement: { base: [174, 162, 152] as RGB, joint: '#7f756b' },
  kerb: '#cfcac0',
  paint: '#f2f0ea',
  rail: '#6c6e72',
  bollard: '#5a2a26',
} as const;

// Highlight accents (look/highlight.ts; LOOK §Driving corridor readability)
// ---------------------------------------------------------------------------

/** Today's highlight: the answer / active landmark painted yellow (`?highlight` unset). */
export const HIGHLIGHT_YELLOW = '#ffd21f';
/** The candidates' accent: a saturated orange-coral. Of the orange-corals it keeps the widest margin from brick, pantile, street, canal, sky and trees in normal, protan, deutan and tritan vision (min ΔE 24; CSS coral #ff7f50 drops to 14 against trees for protans). highlight.test.ts. */
export const HIGHLIGHT_CORAL = '#ff8033';
/** The HUD accent (`--accent` in css/enamel.css), tested as the alternative accent (`?highlightAccent=hud`). */
export const HUD_ACCENT = '#b4682c';

// Map labels (docs/LOOK.md §Labels)
// ---------------------------------------------------------------------------

/**
 * POI labels speak the HUD's language: the plaque's warm near-black ink on
 * its paper, with copper kept for the destination (the HUD's one accent).
 * Values are the daylight HUD tokens (`hudTheme.ts` daylightTheme), repeated
 * here so a label never picks a colour the rest of the look does not use.
 * Before 2026-10-13 labels were white `#FFF7CC` / pale blue on a navy
 * `#071E2B` halo: a dark-mode skin over a daylight city.
 */
export const LABEL_INK = {
  ink: '#1f1c17',
  inkMuted: '#5f584d',
  paper: '#fbf8f2',
  paperSunk: '#ebe4d6',
  copper: '#b4682c',
  copperInk: '#8a4a18',
} as const;

/** `ink`: warm dark text on a thin paper halo (default). `paper`: paper text on an ink halo. */
export type LabelTone = 'ink' | 'paper';

export function labelTone(tone: LabelTone): { text: string; muted: string; halo: string; dot: string } {
  return tone === 'paper'
    ? { text: LABEL_INK.paper, muted: LABEL_INK.paperSunk, halo: 'rgba(31,28,23,0.82)', dot: LABEL_INK.paper }
    : { text: LABEL_INK.ink, muted: LABEL_INK.inkMuted, halo: 'rgba(251,248,242,0.94)', dot: LABEL_INK.ink };
}

/**
 * Foliage display tone (LOOK §Mood, 2026-10-13): the species priors in
 * tree-typology.js are photo-sampled summer greens that read olive under the
 * game's light. Yellow-greens (hue 60–125°) turn +8° toward green and gain
 * 10 % saturation; purple and red-leaved cultivars, blue-green evergreens and
 * bark keep their colour. A display prior, never evidence.
 */
export function foliageDisplayHex(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (h < 60 || h > 125 || s < 0.12) return hex;
  return rgbToHex(hslToRgb([Math.min(125, h + 8), Math.min(0.75, s * 1.1), l]));
}

/**
 * Own-ground surface albedos (ownGround/gameGround.ts), one table. Raised
 * 2026-10-13: the grey pavers read as wet concrete and the canal as
 * teal-black. RGB 0–255 for the canvas pavers/noise; hex for flat colours.
 */
export const GROUND_TONES = {
  land: { base: [168, 158, 142] as RGB, joint: '#857b6d' },
  paving: { base: [184, 174, 158] as RGB, joint: '#8f8577' },
  square: { base: [190, 179, 161] as RGB, joint: '#958a7c' },
  // Klinker warm grey-rose, asphalt darker and cooler than it ("so much grey": they shared one band).
  klinker: { base: [158, 124, 114] as RGB, joint: '#7a6660' },
  asphalt: [68, 72, 80] as RGB,
  cycle: [156, 76, 66] as RGB,
  gravel: [180, 166, 136] as RGB,
  park: [96, 140, 70] as RGB,
  wood: [70, 112, 58] as RGB,
  parking: [102, 102, 105] as RGB,
  kerb: '#aaa498',
  water: '#46707c',
} as const;
