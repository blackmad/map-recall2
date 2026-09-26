/** Small, renderer-neutral appearance presets for a game preview. These are
 * reusable illustrative finishes, not measured textures or material evidence.
 * MapLibre's extrusion pattern uses sprite pixels, not metres; the dimensions
 * below describe the intended masonry, while the game must visually verify
 * apparent scale at its supported zooms and pixel ratios. */
export type WallPatternKind = 'brick-courses' | 'stone-blocks' | 'smooth';
export type WallMaterialId =
  | 'redbrick' | 'brownbrick' | 'darkbrick' | 'buffbrick' | 'greybrick'
  | 'paintedcreambrick' | 'paintedwhitebrick' | 'creamrender' | 'whiterender'
  | 'greystone' | 'concrete' | 'unknownneutral';

export interface WallMaterialPreset {
  id: WallMaterialId;
  label: string;
  materialFamily: 'brick' | 'painted-brick' | 'render' | 'stone' | 'concrete' | 'unknown';
  baseColour: string;
  mortarColour: string | null;
  courseWidthM: number | null;
  courseHeightM: number | null;
  patternKind: WallPatternKind;
  seed: number;
}

const brick = (id: WallMaterialId, label:string, family: WallMaterialPreset['materialFamily'], baseColour: string, mortarColour: string, seed: number): WallMaterialPreset =>
  ({ id, label, materialFamily: family, baseColour, mortarColour, courseWidthM: .24, courseHeightM: .06, patternKind: 'brick-courses', seed });
const smooth = (id: WallMaterialId, label:string, family: WallMaterialPreset['materialFamily'], baseColour: string, seed: number): WallMaterialPreset =>
  ({ id, label, materialFamily: family, baseColour, mortarColour: null, courseWidthM: null, courseHeightM: null, patternKind: 'smooth', seed });

export const WALL_MATERIALS: readonly WallMaterialPreset[] = Object.freeze([
  brick('redbrick', 'Red brick', 'brick', '#8c6252', '#836458', 101),
  brick('brownbrick', 'Brown brick', 'brick', '#6b554a', '#6b584e', 103),
  brick('darkbrick', 'Dark brick', 'brick', '#514641', '#514a45', 107),
  brick('buffbrick', 'Buff brick', 'brick', '#b8996f', '#a9997e', 109),
  brick('greybrick', 'Grey brick', 'brick', '#827d76', '#807d77', 113),
  brick('paintedcreambrick', 'Cream painted brick', 'painted-brick', '#c9bea5', '#c3bba9', 127),
  brick('paintedwhitebrick', 'White painted brick', 'painted-brick', '#d9d8ce', '#d0d0ca', 131),
  smooth('creamrender', 'Cream render', 'render', '#dfd2b6', 137),
  smooth('whiterender', 'White render', 'render', '#dbd9ce', 139),
  { id: 'greystone', label:'Grey stone', materialFamily: 'stone', baseColour: '#99968e', mortarColour: '#89877f', courseWidthM: .48, courseHeightM: .24, patternKind: 'stone-blocks', seed: 149 },
  smooth('concrete', 'Concrete', 'concrete', '#aaa9a2', 151),
  smooth('unknownneutral', 'Neutral unknown', 'unknown', '#aaa49a', 157),
]);
const MATERIAL_BY_ID = new Map(WALL_MATERIALS.map(preset => [preset.id, preset]));

export const WALL_MATERIAL_SPRITE_SIZE = 128;
/** Pass as MapLibre `addImage(name, image, {pixelRatio: 1})`. Pixel ratio is
 * deliberately fixed; it is not a metre-per-pixel conversion. */
export const WALL_MATERIAL_PIXEL_RATIO = 1;
export type WallMaterialSprite = { width: number; height: number; data: Uint8Array };

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
const hash = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x + 0x51ed, 0x45d9f3b) ^ Math.imul(y + 0x9e37, 0x119de1f3) ^ seed;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return value >>> 0;
};
const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** Generate an opaque 128px power-of-two sprite with stable running bond.
 * The edge periods are integral (brick 64x16px, stone 64x32px), so the sprite
 * repeats without a broken course. At distance, the <=3 RGB step variation
 * becomes a quiet colour field rather than a high-contrast checkerboard. */
export function createWallMaterialSprite(id: WallMaterialId): WallMaterialSprite {
  const preset = MATERIAL_BY_ID.get(id);
  if (!preset) throw Error(`Unknown wall material: ${id}`);
  const size = WALL_MATERIAL_SPRITE_SIZE, data = new Uint8Array(size * size * 4);
  const base = rgb(preset.baseColour), mortar = preset.mortarColour ? rgb(preset.mortarColour) : null;
  const rowHeight = preset.patternKind === 'stone-blocks' ? 32 : 16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / rowHeight), shift = (row & 1) * 32;
    const courseX = (x + shift) % 64, courseY = y % rowHeight;
    const isJoint = preset.patternKind !== 'smooth' && (courseX < 2 || courseY < 2);
    const cell = hash(Math.floor((x + shift) / 64) % 2, row, preset.seed);
    const fine = hash(x & 127, y & 127, preset.seed) % 3 - 1;
    const variation = preset.patternKind === 'smooth' ? fine : cell % 7 - 3 + fine;
    const colour = isJoint ? mortar! : base, index = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) data[index + c] = channel(colour[c] + (isJoint ? 0 : variation));
    data[index + 3] = 255;
  }
  return { width: size, height: size, data };
}
