// Which bay textures the in-game layer uses for the `cartoon` and `photo`
// looks (the per-bay drawing lives in `bayTextures.ts`, from the standalone
// rendering spike). The spike builds one mesh per variant; here the variants
// are a small fixed set so they fit one texture array and one draw per tile:
// Bounded opening/trim presets plus one set of shopfronts per period.

import { SHOP_KINDS, archetypeFor, paletteFor, type Archetype, type BayKind, type BayVariant, type Look, type ShopKind } from './bayTextures.js';
import { lookHex } from './landmarkFronts.js';
import { hashSeed } from './wallBays.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
import type { FacadeStyle } from './genericFacades.js';

export const BAY_KINDS = ['upper', 'ground', 'groundDoor', ...SHOP_KINDS, 'plain'] as const satisfies readonly BayKind[];
const isShopKind = (kind: string) => (SHOP_KINDS as readonly string[]).includes(kind);
type BayStyle = Omit<BayVariant, 'kind' | 'archetype'>;

/** Curated building styles per archetype (window count, head shape, shutters, painted frames). */
export const BAY_STYLES: Record<Archetype, readonly BayStyle[]> = {
  // Canal houses: tall white-framed sashes under flat lintels; shutters only beside ground-floor windows.
  canal: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .62, sash: 'plain', trimDensity: 'restrained', lintel: 'none' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .62, sash: 'transom', trimDensity: 'restrained', lintel: 'none' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .62, sash: 'transom', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: true, paintedFrames: false },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: true },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: true },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'tall', frameTone: 'dark', lintel: 'flat' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'tall', paleAccents: true, lintel: 'flat' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .68, sash: 'paired-transom', trimDensity: 'restrained', lintel: 'none' },
      { windows: 1, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .56, openingHeight: .70, sash: 'paired-transom', trimDensity: 'restrained', lintel: 'none', openingGroup: 'canal-return', groundAssembly: 'tall-commercial' },
    ...([2, 3] as const).flatMap(windows => ([undefined, 'tall-side-entry', 'tall-commercial'] as const).map(groundAssembly => ({
      windows, shape: 'rect' as const, shutters: false, paintedFrames: false,
      family: 'masonry' as const, openingOccupancy: .62, openingHeight: .70,
      sash: 'paired-transom' as const, trimDensity: 'restrained' as const, lintel: 'none' as const,
      openingGroup: windows === 2 ? 'canal-two' as const : 'canal-three' as const, groundAssembly,
    }))),
  ],
  // 1860-1914: rectangular sashes under flat or segmental masonry heads.
  c19: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .70, sash: 'plain', trimDensity: 'restrained', lintel: 'flat' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'flat' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'flat', paleAccents: true },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'arch', paleAccents: true },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .55, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, lintel: 'arch' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'tall', paleAccents: true, lintel: 'arch' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'balanced', paleAccents: true, lintel: 'flat' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'tall', frameTone: 'dark', lintel: 'flat' },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .615, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'arch', paleAccents: true, frameTone: 'dark', entranceAssembly: 'raised-pilaster' },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .615, openingHeight: .70, sash: 'transom', trimDensity: 'restrained', lintel: 'flat', paleAccents: false, frameTone: 'dark', entranceAssembly: 'raised-plain' },
    { windows: 1, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', openingOccupancy: .32, openingHeight: .78, sash: 'paired-transom', trimDensity: 'restrained', lintel: 'flat', paleAccents: false, facadeAssembly: 'stacked-iron-balcony' },
  ],
  school: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: true },
  ],
  modern: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .65, openingHeight: .52, sash: 'plain', trimDensity: 'restrained', lintel: 'none', wallMaterial: 'brick' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .65, openingHeight: .52, sash: 'plain', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark', wallMaterial: 'brick' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .65, openingHeight: .52, sash: 'plain', trimDensity: 'restrained', lintel: 'none' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .65, openingHeight: .52, sash: 'plain', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', proportions: 'balanced', lintel: 'none' },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', proportions: 'wide', lintel: 'none', frameTone: 'dark' },
    { windows: 1, shape: 'rect', shutters: false, paintedFrames: false, family: 'ribbon' },
    { windows: 1, shape: 'rect', shutters: false, paintedFrames: false, family: 'curtain' },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .57, openingHeight: .70, sash: 'paired-transom', trimDensity: 'restrained', lintel: 'none', wallMaterial: 'smooth', facadeAssembly: 'stacked-open-balcony' },
  ],
};
const ARCHETYPES = Object.keys(BAY_STYLES) as Archetype[];

type Entry = { archetype: Archetype; style: number; kind: (typeof BAY_KINDS)[number]; layer: number; restrainedShop?: boolean };
// Shop cells are shared by period and art direction, not every opening preset.
const entries: Omit<Entry, 'layer'>[] = ARCHETYPES.flatMap(archetype =>
  BAY_STYLES[archetype].flatMap((variant, style) => BAY_KINDS.filter(kind => kind === 'plain' ? BAY_STYLES[archetype].findIndex(v => (v.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick')) === (variant.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick'))) === style : !isShopKind(kind) || style === 0).map(kind => ({ archetype, style, kind }))));
entries.push(...ARCHETYPES.flatMap(archetype => SHOP_KINDS.map(kind => ({ archetype, style: 0, kind, restrainedShop: true }))));
export const BAY_ENTRIES: readonly Entry[] = entries.map((e, layer) => ({ ...e, layer }));
export const BAY_LAYER_COUNT = BAY_ENTRIES.length;

export const bayVariant = (e: Entry): BayVariant => {
  const v = { archetype: e.archetype, kind: e.kind, ...BAY_STYLES[e.archetype][e.style] };
  // The shared legacy shopset keeps its existing look, even if style0 is a street preset.
  if (isShopKind(e.kind)) return { ...v, trimDensity: e.restrainedShop ? 'restrained' : undefined };
  return v;
};
export const bayLayer = (archetype: Archetype, style: number, kind: (typeof BAY_KINDS)[number], restrainedShop = false): number =>
  BAY_ENTRIES.find(e => e.archetype === archetype && e.style === (isShopKind(kind) ? 0 : kind === 'plain' ? BAY_STYLES[archetype].findIndex(v => (v.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick')) === (BAY_STYLES[archetype][style].wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick'))) : style) && e.kind === kind && (!isShopKind(kind) || !!e.restrainedShop === restrainedShop))!.layer;

/** The layout style (cell dimensions) each archetype uses. */
export const ARCHETYPE_LAYOUT: Record<Archetype, FacadeStyle> = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' };

/**
 * Wall colours for the photo look: the real Amsterdam range (red and orange
 * brick, grey-brown, buff, a little limewash), with weights so reds dominate
 * the way they do on the streets. The spike's palette was pastel, which over
 * the dark brick photo came out as one chocolate wall.
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
 * buff, grey and concrete. null keeps the archetype palette (`paletteFor`).
 */
export const PERIOD_WALLS: Record<Look, Record<Archetype, readonly string[] | null>> = {
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
export const GROUND_PAINTS: Record<Look, readonly string[]> = {
  photo: ['#f1eee6', '#f1eee6', '#f1eee6', '#e8dfc9', '#e8dfc9', '#2b2d2c', '#2f4a3a', '#5a2a26', '#25344a', '#8b8f8c'],
  storybook: ['#f6f1e4', '#f6f1e4', '#f6f1e4', '#efe2c2', '#efe2c2', '#3a3d3c', '#3f6a52', '#8a3b33', '#3a527a', '#a3a8a4'],
  cartoon: ['#fffaf0', '#fffaf0', '#fffaf0', '#ffe9b8', '#ffe9b8', '#3b3b4a', '#2a9d8f', '#d9453d', '#4672b0', '#f2b92e'],
};

const DEFAULT_STYLE_INDICES = Object.fromEntries(ARCHETYPES.map(archetype => [archetype, BAY_STYLES[archetype].flatMap((v, i) => v.openingOccupancy === undefined && (!v.family || v.family === 'masonry' || v.family === 'punched') ? [i] : [])])) as Record<Archetype, number[]>;
// Keys contain only finite preset decisions, never building ids or raw evidence.
const recipeStyles = new Map<string, number[]>();
/** Deterministic, bounded recipe compilation. No canvas or layer is allocated per building. */
export function bayStyleForRecipe(id: string, archetype: Archetype, recipe?: ArchitecturalRecipe): number {
  const styles = BAY_STYLES[archetype], h = hashSeed(id);
  if (!recipe) {
    // Construction date alone is not evidence for continuous ribbon glazing.
    const candidates = DEFAULT_STYLE_INDICES[archetype];
    return candidates[(h >>> 4) % candidates.length];
  }
  const proportion = recipe.windowProportions ?? (recipe.windowWidth && recipe.windowWidth > 0.3 ? 'wide' : recipe.windowHeight && recipe.windowHeight < 0.5 ? 'balanced' : 'tall');
  const dark = recipe.frameColor === 'dark' || !!recipe.frameHex && parseInt(recipe.frameHex.slice(1, 3), 16) < 100;
  const pale = recipe.paleAccents ?? ((recipe.trim?.lintels ?? 0) > 0.65 || (recipe.trim?.quoins ?? 0) > 0.5);
  const lintel = recipe.lintel ?? ((recipe.trim?.arches ?? 0) > 0.5 ? 'arch' : 'flat');
  const sash = recipe.sash ?? (recipe.family === 'punched' ? 'plain' : 'transom'), trim = recipe.trimDensity ?? 'restrained';
  const material = recipe.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick');
  const key = `${recipe.openingGroup ?? 'none'}|${recipe.groundAssembly ?? 'none'}|${archetype}|${recipe.facadeAssembly ?? 'none'}|${recipe.entranceAssembly ?? 'none'}|${material}|${recipe.family}|${proportion}|${dark}|${pale}|${lintel}|${sash}|${trim}`;
  const cached = recipeStyles.get(key);
  if (cached) return cached[(h >>> 4) % cached.length];
  const scored = styles.map((v, i) => ({ i, score: ((v.openingGroup ?? 'none') === (recipe.openingGroup ?? 'none') ? 4000 : 0) + ((v.groundAssembly ?? 'none') === (recipe.groundAssembly ?? 'none') ? 2000 : 0) + ((v.entranceAssembly ?? 'none') === (recipe.entranceAssembly ?? 'none') ? 1000 : 0) + ((v.facadeAssembly ?? 'none') === (recipe.facadeAssembly ?? 'none') ? 1000 : 0) + ((v.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick')) === material ? 25 : 0) + ((v.sash ?? 'six-over-six') === sash ? 50 : 0) + (v.trimDensity === trim ? 40 : 0) + ((v.family ?? 'masonry') === recipe.family ? 100 : 0) +
    ((v.proportions ?? 'tall') === proportion ? 8 : 0) + (!!v.paleAccents === pale ? 12 : 0) +
    ((v.frameTone === 'dark') === dark ? 10 : 0) + ((v.lintel ?? 'flat') === lintel ? 6 : 0) }));
  const max = Math.max(...scored.map(v => v.score)), ties = scored.filter(v => v.score === max);
  const indices = ties.map(v => v.i);
  recipeStyles.set(key, indices);
  return indices[(h >>> 4) % indices.length];
}

/** Everything the mesh builder needs from a feature for a bay look. */
export function bayLookFor(id: string, year: number | null, heightM: number, look: Look, shopfront?: ShopKind | 'quiet', recipe?: ArchitecturalRecipe) {
  const archetype: Archetype = recipe?.facadeAssembly === 'stacked-iron-balcony' ? 'c19' : recipe ? (recipe.family === 'masonry' ? (recipe.period === 'c19' || recipe.period === 'school' ? recipe.period : 'canal') : 'modern') : archetypeFor(id, year, heightM);
  const h = hashSeed(id), style = bayStyleForRecipe(id, archetype, recipe);
  // Without the extract: a third of buildings, picking among the original four shopfronts.
  const shop = (recipe?.facadeAssembly || recipe?.entranceAssembly || recipe?.openingGroup) && !shopfront ? false : shopfront ? shopfront !== 'quiet' : (h >>> 13) % 3 === 0;
  const shopKind = shopfront && shopfront !== 'quiet' ? shopfront : SHOP_KINDS[(h >>> 17) % 4];
  const palette = paletteFor(id, archetype, look);
  const walls = PERIOD_WALLS[look][archetype];
  if (walls) palette.wall = walls[(hashSeed(id) >>> 7) % walls.length];
  if (recipe?.wallHex) palette.wall = lookHex(recipe.wallHex, look);
  // A shop's ground floor is painted, and the paint is its own colour, not the brick's.
  const paints = GROUND_PAINTS[look];
  return {
    archetype, style, variant: { archetype, ...BAY_STYLES[archetype][style] }, layout: ARCHETYPE_LAYOUT[archetype], wallHex: palette.wall, accentHex: recipe?.openingGroup ? lookHex(recipe.frameHex ?? '#f1ede2', look) : palette.accent,
    groundHex: recipe?.groundWallHex ? lookHex(recipe.groundWallHex, look) : shop ? paints[(h >>> 21) % paints.length] : undefined,
    layers: { upper: bayLayer(archetype, style, 'upper'), ground: bayLayer(archetype, style, shop && !recipe?.openingGroup && !(recipe?.facadeAssembly === 'stacked-open-balcony' && (shopKind === 'shopWindow' || shopKind === 'groundShop')) ? shopKind : 'ground', !!recipe && recipe.trimDensity !== 'ornate'), door: bayLayer(archetype, style, 'groundDoor') },
    plain: bayLayer(archetype, style, 'plain'),
  };
}
