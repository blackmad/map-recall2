// Which bay textures the in-game layer uses for the `cartoon` and `photo`
// looks (the per-bay drawing lives in `bayTextures.ts`, from the standalone
// rendering spike). The spike builds one mesh per variant; here the variants
// are a small fixed set so they fit one texture array and one draw per tile:
// Bounded opening/trim presets plus one set of shopfronts per period.

import { SHOP_KINDS, archetypeFor, paletteFor, type Archetype, type BayKind, type BayVariant, type Look, type ShopKind } from './bayTextures.js';
import { GROUND_PAINTS, PERIOD_WALLS, lookHex } from './look/palette.js';
import { brickLiftOn, brickLiftV2ProfileWall, periodWallList } from './look/brickLift.js';
import { measuredPoolDraw } from './look/measuredWallPool.js';
import { hashSeed } from './wallBays.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
import type { FacadeStyle } from './genericFacades.js';
import { profileTraits, unitDraw, type BuurtProfile, type ProfileTraits } from './buurtProfiles/profiles.js';
import { modernPandWall } from './buurtProfiles/modernPandWalls.js';
import { shopGrammarEnabled, shopGroundHex } from './shopGrammar.js';
import { modernFacadesEnabled, modernUseFor, modernVocabulary, type ModernFacts, type ModernVocabulary } from './modernFacades.js';
import { contemporaryLookFor, newbuildFamilyEnabled, type ContemporaryLook } from './contemporaryFamily.js';

/**
 * The contemporary family's tall preset (contemporaryFamily.ts, `?newbuildFamily=1`): two tall windows to the floor per
 * bay in dark frames, a French-balcony rail across each, on brick. Only in the array with the flag on, so the layer
 * table (and the baked shells' layer hash) is byte-identical without it.
 */
export const TALL_FRENCH_BALCONY = { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .46, openingHeight: .80, sash: 'plain', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark', wallMaterial: 'brick', facadeAssembly: 'french-balcony' } as const;
/**
 * The contemporary family's balcony-band preset (`?newbuildFamily=1`, BAY_STYLES.modern[10]): wide windows in dark
 * frames behind a pale balustrade band across every upper storey, for the fronts the panorama sheet shows banded
 * (contemporary-walls.json `bands`).
 */
export const BALCONY_BAND = { windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'punched', openingOccupancy: .74, openingHeight: .78, sash: 'plain', trimDensity: 'restrained', lintel: 'none', frameTone: 'dark', wallMaterial: 'brick', facadeAssembly: 'balcony-band' } as const;

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
    ...([2, 3] as const).flatMap(windows => ([undefined, 'tall-side-entry', 'tall-commercial'] as const).flatMap(groundAssembly => (['rect', 'segmental'] as const).map(shape => ({
      windows, shape, shutters: false, paintedFrames: false,
      family: 'masonry' as const, openingOccupancy: .62, openingHeight: .70,
      sash: 'paired-transom' as const, trimDensity: 'restrained' as const, lintel: 'none' as const,
      openingGroup: windows === 2 ? 'canal-two' as const : 'canal-three' as const, groundAssembly,
    })))),
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
    ...(newbuildFamilyEnabled() ? [TALL_FRENCH_BALCONY, BALCONY_BAND] : []),
  ],
};
const ARCHETYPES = Object.keys(BAY_STYLES) as Archetype[];

type Entry = { archetype: Archetype; style: number; kind: (typeof BAY_KINDS)[number]; layer: number; restrainedShop?: boolean; originalMasonry?: boolean; smooth?: boolean };
/**
 * A restrained shopfront (bayTextures.ts `quietShopAt`) reads its kind twice: the bar's fascia ink and the valance of
 * the mapped cafe/restaurant kinds. Every other kind paints the same pixels, colour and mask, in every look (pinned by
 * contemporaryFamilyOn.test.ts), so with the contemporary family on the seven restrained kinds share three cells per
 * archetype, each named by the kind that owns it (shopCafe, shopBar, shopWindow): 16 layers freed for the family's 6.
 * The procedural array is CELL_LAYER_COUNT cells, four roofs, the bay cells and the glass-block cell, and stood at
 * exactly 256 byte layers before (paintLookAtlas.ts lookAtlasLayers). Flag off: one cell per kind, the layer table and
 * the baked shells' hash (world/shellLayers.ts) as before.
 */
const RESTRAINED_SHOP_CELL: Record<ShopKind, ShopKind> = { groundShop: 'shopCafe', shopCafe: 'shopCafe', shopBar: 'shopBar', shopWindow: 'shopWindow', shopDeli: 'shopWindow', shopFlorist: 'shopWindow', shopBike: 'shopWindow' };
const sharedRestrainedShops = newbuildFamilyEnabled();
// Shop cells are shared by period and art direction, not every opening preset.
// Share only cells whose painter output is identical. Upper cells do not draw
// ground assemblies; side-entry ground and groundDoor both paint the same door.
function cellKey(archetype: Archetype, style: number, kind: BayKind, restrainedShop = false): string {
  const variant = { ...BAY_STYLES[archetype][style] };
  if (kind === 'plain') return `${archetype}|plain|${variant.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick')}`;
  if (isShopKind(kind)) return `${archetype}|${restrainedShop && sharedRestrainedShops ? RESTRAINED_SHOP_CELL[kind as ShopKind] : kind}|${restrainedShop}`;
  if (kind === 'upper') delete variant.groundAssembly;
  if (kind === 'groundDoor' && variant.groundAssembly === 'tall-side-entry') kind = 'ground';
  return `${archetype}|${kind}|${JSON.stringify(variant)}`;
}
const entries: Omit<Entry, 'layer'>[] = [];
const cellLayers = new Map<string, number>();
for (const archetype of ARCHETYPES) for (const [style] of BAY_STYLES[archetype].entries()) for (const kind of BAY_KINDS) {
  if (isShopKind(kind) && style !== 0) continue;
  const key = cellKey(archetype, style, kind);
  if (!cellLayers.has(key)) { cellLayers.set(key, entries.length); entries.push({ archetype, style, kind }); }
}
for (const archetype of ARCHETYPES) for (const kind of SHOP_KINDS) {
  const key = cellKey(archetype, 0, kind, true);
  if (cellLayers.has(key)) continue;
  cellLayers.set(key, entries.length);
  entries.push({ archetype, style: 0, kind: sharedRestrainedShops ? RESTRAINED_SHOP_CELL[kind] : kind, restrainedShop: true });
}
// A source-supported brick wall must not inherit the smooth modern fallback
// from an absent construction year. This cell contains original generated pixels.
export const FATIH_MASONRY_LAYER = entries.length;
entries.push({ archetype: 'school', style: 0, kind: 'plain', originalMasonry: true });
/**
 * Painted fronts (lane W2, 2026-11-12): smooth render cells for an unmeasured canal or c19 pand whose measured-pool draw is
 * a painted wall (look/measuredWallPool.ts; white, cream or pale-grey stucco). The kit drew every pre-1945 bay in brick, so
 * a painted front could only be a pale tint on brick courses, which reads as dirty brick. One preset per archetype (plain
 * transom sashes, no trim) in smooth wall: upper, ground, door and plain, appended after the masonry cell so no earlier
 * layer moves. The procedural array has 10 spare byte layers with newbuildFamily on (64 + 181 + 1 = 246 of 256); these take 8. The school
 * archetype has no painted cell (no room): its pale draws stay a tint on brick.
 */
export const PAINTED_BASE_STYLE: Partial<Record<Archetype, number>> = { canal: 1, c19: 1 };
const PAINTED_KINDS = ['upper', 'ground', 'groundDoor', 'plain'] as const;
const paintedLayerIndex = new Map<string, number>();
// Only with the shared restrained shop cells (newbuildFamily, default on), which free 16 layers: `?newbuildFamily=0` keeps 191
// bay cells and exactly 256 procedural layers, so it has no painted cells (a painted draw stays a tint on brick).
if (sharedRestrainedShops) for (const archetype of ['canal', 'c19'] as const) for (const kind of PAINTED_KINDS) {
  paintedLayerIndex.set(`${archetype}|${kind}`, entries.length);
  entries.push({ archetype, style: PAINTED_BASE_STYLE[archetype]!, kind, smooth: true });
}
/** The painted (smooth render) cells of an archetype, or null when the kit has none for it. */
export function paintedLayers(archetype: Archetype): Record<(typeof PAINTED_KINDS)[number], number> | null {
  if (PAINTED_BASE_STYLE[archetype] === undefined || !paintedLayerIndex.size) return null;
  return Object.fromEntries(PAINTED_KINDS.map(k => [k, paintedLayerIndex.get(`${archetype}|${k}`)!])) as Record<(typeof PAINTED_KINDS)[number], number>;
}
export const BAY_ENTRIES: readonly Entry[] = entries.map((e, layer) => ({ ...e, layer }));
export const BAY_LAYER_COUNT = BAY_ENTRIES.length;

export const bayVariant = (e: Entry): BayVariant => {
  const v = { archetype: e.archetype, kind: e.kind, ...BAY_STYLES[e.archetype][e.style] };
  if (e.smooth) return { ...v, wallMaterial: 'smooth' };
  if (isShopKind(e.kind)) return { ...v, trimDensity: e.restrainedShop ? 'restrained' : undefined };
  return v;
};
export const bayLayer = (archetype: Archetype, style: number, kind: (typeof BAY_KINDS)[number], restrainedShop = false): number =>
  cellLayers.get(cellKey(archetype, isShopKind(kind) ? 0 : style, kind, restrainedShop))!;

/** The layout style (cell dimensions) each archetype uses. */
export const ARCHETYPE_LAYOUT: Record<Archetype, FacadeStyle> = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' };

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
  const key = `${recipe.openingGroup ?? 'none'}|${recipe.groundAssembly ?? 'none'}|${recipe.windowHead ?? 'flat'}|${archetype}|${recipe.facadeAssembly ?? 'none'}|${recipe.entranceAssembly ?? 'none'}|${material}|${recipe.family}|${proportion}|${dark}|${pale}|${lintel}|${sash}|${trim}`;
  const cached = recipeStyles.get(key);
  if (cached) return cached[(h >>> 4) % cached.length];
  const scored = styles.map((v, i) => ({ i, score: ((v.shape === 'segmental') === (recipe.windowHead === 'segmental') ? 8000 : 0) + ((v.openingGroup ?? 'none') === (recipe.openingGroup ?? 'none') ? 4000 : 0) + ((v.groundAssembly ?? 'none') === (recipe.groundAssembly ?? 'none') ? 2000 : 0) + ((v.entranceAssembly ?? 'none') === (recipe.entranceAssembly ?? 'none') ? 1000 : 0) + ((v.facadeAssembly ?? 'none') === (recipe.facadeAssembly ?? 'none') ? 1000 : 0) + ((v.wallMaterial ?? (archetype === 'modern' ? 'smooth' : 'brick')) === material ? 25 : 0) + ((v.sash ?? 'six-over-six') === sash ? 50 : 0) + (v.trimDensity === trim ? 40 : 0) + ((v.family ?? 'masonry') === recipe.family ? 100 : 0) +
    ((v.proportions ?? 'tall') === proportion ? 8 : 0) + (!!v.paleAccents === pale ? 12 : 0) +
    ((v.frameTone === 'dark') === dark ? 10 : 0) + ((v.lintel ?? 'flat') === lintel ? 6 : 0) }));
  const max = Math.max(...scored.map(v => v.score)), ties = scored.filter(v => v.score === max);
  const indices = ties.map(v => v.i);
  recipeStyles.set(key, indices);
  return indices[(h >>> 4) % indices.length];
}

/**
 * The presets a buurt profile chooses among (GitHub #102): every plain masonry (or, for modern, punched) preset, i.e.
 * the defaults plus the measured-proportion presets, but none tied to an observed assembly (opening groups, ground,
 * entrance and facade assemblies), which only a street survey may claim.
 */
const PROFILE_STYLE_INDICES = Object.fromEntries(ARCHETYPES.map(archetype => [archetype, BAY_STYLES[archetype].flatMap((v, i) =>
  !v.openingGroup && !v.groundAssembly && !v.entranceAssembly && !v.facadeAssembly && (archetype === 'modern' ? v.family === 'punched' : !v.family || v.family === 'masonry') ? [i] : [])])) as Record<Archetype, number[]>;
const traitStyles = new Map<string, number[]>();
/** The presets that best match a profiled building's drawn traits (white accents, dark frames, arched heads, tall sashes). */
/** `bays` (a HouseSpec's stated window columns, lane H11): only presets whose window count divides it, when any does, so the
 *  look never forces a 3-window cell on a 2-bay front (or 2-window cells on 3 bays). Absent = every plain preset, as before. */
export function bayStyleForTraits(id: string, archetype: Archetype, traits: ProfileTraits, bays?: number): number {
  const fitting = bays ? PROFILE_STYLE_INDICES[archetype].filter(i => bays % (BAY_STYLES[archetype][i].windows || 1) === 0) : [];
  const pool = fitting.length ? fitting : PROFILE_STYLE_INDICES[archetype];
  const key = `${archetype}|${traits.pale}|${traits.dark}|${traits.arch}|${traits.tall}${fitting.length ? `|w${bays}` : ''}`;
  let indices = traitStyles.get(key);
  if (!indices) {
    const scored = pool.map(i => {
      const v = BAY_STYLES[archetype][i];
      const arch = v.shape === 'segmental' || v.lintel === 'arch', tall = (v.proportions ?? 'tall') === 'tall';
      return { i, score: (traits.pale === null ? 0 : (!!v.paleAccents === traits.pale ? 12 : 0)) + (traits.dark === null ? 0 : ((v.frameTone === 'dark') === traits.dark ? 10 : 0))
        + (traits.tall === null ? 0 : (tall === traits.tall ? 8 : 0)) + (traits.arch === null ? 0 : (arch === traits.arch ? 6 : 0)) };
    });
    const max = Math.max(...scored.map(v => v.score));
    indices = scored.filter(v => v.score === max).map(v => v.i);
    traitStyles.set(key, indices);
  }
  return indices[(hashSeed(id) >>> 4) % indices.length];
}

/** Everything the mesh builder needs from a feature for a bay look. */
/** `periodWall`: the measured period wall the `?walls=measured` enricher stamped (photo look only; look/measuredWalls.ts). */
/**
 * `profile`: the buurt profile at the building (buurtProfiles/profiles.ts), photo look only and never over a recipe:
 * its era's measured wall colours, white-accent, frame, head and proportion shares pick the wall and the preset; with
 * no construction year its dominant era picks the archetype; its shop share replaces the one-in-three guess when the
 * shopfront extract is absent. Without a profile (or for another look) every pick is as before.
 */
/**
 * `modern`: the facts the modern vocabulary (modernFacades.ts) reads beyond year and height. Photo look, no recipe, a
 * dated post-1945 building: the era x use rule picks the preset and the wall instead of the hash and the buurt
 * profile (whose eras were measured on pre-1945 fronts). Absent, or `?modernFacades=0`: every pick is as before.
 */
/**
 * `spec`: a HouseSpec's stated window look (houseSpec/decorate.ts SpecLook, lane H11): each stated trait replaces the buurt
 * profile's draw for it and the preset is picked by bayStyleForTraits among the plain presets, as a profile's would be. Never
 * over a recipe or the modern vocabularies; absent (or no trait stated) = every pick as before.
 */
/**
 * `at` (lng, lat): where the building stands, for the measured wall pool (look/measuredWallPool.ts, lane W1, `?wallPool=0`):
 * photo look, no recipe or modern vocabulary, a pre-1945 archetype with enough measured neighbours: their wall replaces
 * the profile's and the period palette's swatch (and outranks a material prior as a profile wall does). Absent = as before.
 */
export function bayLookFor(id: string, year: number | null, heightM: number, look: Look, shopfront?: ShopKind | 'quiet', recipe?: ArchitecturalRecipe, periodWall?: string, profile?: BuurtProfile | null, modern?: Pick<ModernFacts, 'footprintM2' | 'buildingType'> & { at?: readonly [number, number] }, spec?: { pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean; bays?: number; painted?: boolean }, at?: readonly [number, number]) {
  const buurt = !recipe && look === 'photo' && profile ? profile : null;
  const archetype: Archetype = recipe?.facadeAssembly === 'stacked-iron-balcony' ? 'c19' : recipe ? (recipe.family === 'masonry' ? (recipe.period === 'c19' || recipe.period === 'school' ? recipe.period : 'canal') : 'modern')
    : year === null && buurt?.dominantEra && heightM < 28 ? buurt.dominantEra : archetypeFor(id, year, heightM);
  // The contemporary family (`?newbuildFamily=1`): measured new-build walls and window shapes, every textured look.
  const contemporary: ContemporaryLook | null = modern && !recipe && archetype === 'modern' ? contemporaryLookFor({ id, year, heightM, use: modernUseFor({ id, year, heightM, ...modern }), at: modern.at }) : null;
  const vocab: ModernVocabulary | null = !contemporary && modern && !recipe && look === 'photo' && archetype === 'modern' && modernFacadesEnabled() ? modernVocabulary({ id, year, heightM, ...modern }, buurt?.eras.modern, modernPandWall(id)) : null;
  const era = vocab || contemporary ? undefined : buurt?.eras[archetype], drawn = era ? profileTraits(id, era) : null;
  const stated = !recipe && !vocab && !contemporary && spec && (spec.pale !== undefined || spec.dark !== undefined || spec.arch !== undefined || spec.tall !== undefined);
  const traits = stated ? { wall: drawn?.wall ?? null, pale: spec!.pale ?? drawn?.pale ?? null, dark: spec!.dark ?? drawn?.dark ?? null, arch: spec!.arch ?? drawn?.arch ?? null, tall: spec!.tall ?? drawn?.tall ?? null } : drawn;
  // The measured wall pool (lane W1) and its variety draw (lane W2): a painted draw takes the painted preset's smooth cells.
  const h = hashSeed(id);
  const draw = at && look === 'photo' && !recipe && !vocab && !contemporary ? measuredPoolDraw(at[0], at[1], archetype, h >>> 7) : null;
  // Lane WC (`?wallFinish=1`): a spec'd render, painted or stone front (spec.painted) takes the same smooth cells.
  const painted = draw?.painted || (spec?.painted && !recipe && !vocab && !contemporary) ? paintedLayers(archetype) : null;
  const style = painted ? PAINTED_BASE_STYLE[archetype]! : contemporary ? contemporary.styleIndex : vocab ? vocab.styleIndex : traits && (traits.pale !== null || traits.dark !== null || traits.arch !== null || traits.tall !== null) ? bayStyleForTraits(id, archetype, traits, stated ? spec!.bays : undefined) : bayStyleForRecipe(id, archetype, recipe);
  // Without the extract: a third of buildings (or the buurt's measured share), picking among the original four shopfronts.
  const shop = (recipe?.facadeAssembly || recipe?.entranceAssembly || recipe?.openingGroup) && !shopfront ? false : shopfront ? shopfront !== 'quiet'
    : (buurt?.shopfrontShare ?? buurt?.shopShare) !== undefined ? unitDraw(id, 'shop') < (buurt!.shopfrontShare ?? buurt!.shopShare!) : (h >>> 13) % 3 === 0;
  const shopKind = shopfront && shopfront !== 'quiet' ? shopfront : SHOP_KINDS[(h >>> 17) % 4];
  const palette = paletteFor(id, archetype, look);
  const walls = periodWallList(look, archetype, PERIOD_WALLS[look][archetype]);
  if (walls) palette.wall = walls[(hashSeed(id) >>> 7) % walls.length];
  if (traits?.wall) palette.wall = brickLiftOn() && look === 'photo' ? brickLiftV2ProfileWall(traits.wall) : traits.wall;
  const poolWall = draw?.hex ?? null;
  if (poolWall) palette.wall = poolWall;
  if (vocab) { palette.wall = vocab.wall; if (vocab.accent) palette.accent = vocab.accent; }
  if (contemporary) palette.wall = lookHex(contemporary.wall, look);
  if (periodWall && look === 'photo') palette.wall = periodWall;
  if (recipe?.wallHex) palette.wall = lookHex(recipe.wallHex, look);
  // A shop's ground floor is painted, and the paint is its own colour, not the brick's.
  const paints = GROUND_PAINTS[look];
  return {
    archetype, style, ...(vocab ? { modern: vocab } : {}), ...(contemporary ? { contemporary } : {}), variant: { archetype, ...BAY_STYLES[archetype][style] }, ...((poolWall ?? traits?.wall) && !periodWall && !recipe?.wallHex ? { profileWall: (poolWall ?? traits!.wall)! } : {}), layout: ARCHETYPE_LAYOUT[archetype], wallHex: palette.wall, accentHex: recipe?.openingGroup ? lookHex(recipe.frameHex ?? '#f1ede2', look) : palette.accent,
    groundHex: recipe?.groundWallHex ? lookHex(recipe.groundWallHex, look) : shop ? (shopfront && shopfront !== 'quiet' && shopGrammarEnabled() ? shopGroundHex(id, look) : paints[(h >>> 21) % paints.length]) : undefined,
    layers: painted
      ? { upper: painted.upper, ground: shop ? bayLayer(archetype, style, shopKind) : painted.ground, door: painted.groundDoor }
      : { upper: bayLayer(archetype, style, 'upper'), ground: bayLayer(archetype, style, shop && !recipe?.openingGroup && !(recipe?.facadeAssembly === 'stacked-open-balcony' && (shopKind === 'shopWindow' || shopKind === 'groundShop')) ? shopKind : 'ground', !!recipe && recipe.trimDensity !== 'ornate'), door: bayLayer(archetype, style, 'groundDoor') },
    plain: painted ? painted.plain : bayLayer(archetype, style, 'plain'),
    ...(painted ? { painted: true as const, quietGround: painted.ground } : {}),
  };
}
