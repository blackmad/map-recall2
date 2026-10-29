/**
 * The modern side of the generic generator (GitHub #117).
 *
 * Before this module every pand built from 1945 on drew the same two presets (`BAY_STYLES.modern` 4 and 5:
 * smooth beige render with balanced or wide punched holes), whatever its era or use. The 12-spot sheet
 * (`docs/images/look/modern-generic-12spot-20261029.jpg`) shows what the city actually built:
 *   - 1945-64 reconstruction housing: brown, buff and red brick with larger windows; offices in pale concrete
 *     with ribbon windows;
 *   - 1965-79: pale concrete or render offices with continuous window bands and spandrels; housing slabs with
 *     open galleries and balcony stacks;
 *   - 1980-99 urban-renewal infill: brick, overwhelmingly (red-brown, purple-brown, yellow), large square windows
 *     with dark frames;
 *   - 2000 on: dark brown, anthracite and red brick, white or grey render with balconies, glass bands and curtain
 *     fronts on offices.
 *
 * The rule picks one of the presets that already sit in the texture array (no new layers, no new triangles), and a
 * wall colour family, by era x use x size. Deterministic per id. Pre-1945 buildings never reach it (`null`), so they
 * stay byte-identical; `check-modern-facades` / `modernFacades.test.ts` pin both.
 */
import { unitDraw } from './buurtProfiles/profiles.js';

/**
 * A/B: `?modernFacades=0` (passed to the chunk worker) draws every post-1945 building as before. A test can set
 * `globalThis.__canalRecallModernFacades = false`.
 */
export function modernFacadesEnabled(): boolean {
  const g = globalThis as { __canalRecallModernFacades?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallModernFacades === 'boolean') return g.__canalRecallModernFacades;
  try { return new URLSearchParams(g.location?.search ?? '').get('modernFacades') !== '0'; } catch { return true; }
}

/** Indices into `BAY_STYLES.modern` (bayLook.ts). Pinned by modernFacades.test.ts. */
export const MODERN_STYLE = {
  brick: 0, brickDark: 1, smooth: 2, smoothDark: 3, balanced: 4, wideDark: 5, ribbon: 6, curtain: 7, gallery: 8,
} as const;
export type ModernStyle = keyof typeof MODERN_STYLE;

export type ModernEra = 'reconstruction' | 'late-modern' | 'renewal' | 'contemporary';
export type ModernUse = 'housing' | 'office' | 'shop' | 'industrial';
export type WallFamily = 'brick-buff' | 'brick-red' | 'brick-dark' | 'concrete' | 'render';

export const modernEraFor = (year: number): ModernEra | null =>
  year < 1945 ? null : year < 1965 ? 'reconstruction' : year < 1980 ? 'late-modern' : year < 2000 ? 'renewal' : 'contemporary';

/** OSM building types (building-facts tiles) that say the pand is not housing. */
const OFFICE_TYPES = new Set(['office', 'commercial', 'government', 'civic', 'public', 'hotel', 'university', 'college', 'hospital', 'school']);
const SHOP_TYPES = new Set(['retail']);
const INDUSTRIAL_TYPES = new Set(['industrial', 'warehouse']);

export type ModernFacts = { id: string; year: number | null; heightM: number; footprintM2?: number; buildingType?: string | null };

/**
 * Use from the OSM type when tagged; otherwise a size proxy: a deep, tall post-war footprint (>= 1,500 m2 and
 * >= 15 m, built before 1980) is an office block far more often than housing on the sheet's streets.
 */
export function modernUseFor(f: ModernFacts): ModernUse {
  const t = f.buildingType ?? '';
  if (OFFICE_TYPES.has(t)) return 'office';
  if (SHOP_TYPES.has(t)) return 'shop';
  if (INDUSTRIAL_TYPES.has(t)) return 'industrial';
  if ((f.footprintM2 ?? 0) >= 1500 && f.heightM >= 15 && (f.year ?? 0) < 1980) return 'office';
  return 'housing';
}

/**
 * Wall colours per family, photo look. Brick is kept to the city palette's brightness band (L* <= 72, as the
 * buurt profiles calibrate), concrete and render to the existing modern swatches.
 */
export const MODERN_WALLS: Record<WallFamily, readonly string[]> = {
  // Buff and yellow brick, desaturated: the first pass (#b08a62, #c09a6c) read ochre-yellow beside the photos' brown.
  'brick-buff': ['#a08a70', '#968068', '#ab9478', '#8e7a66'],
  'brick-red': ['#9a5240', '#8c4a38', '#a85a44', '#7e4636'],
  'brick-dark': ['#6e4a3c', '#5e4a42', '#4e4642', '#7a5646'],
  concrete: ['#cfcabf', '#bdb8ad', '#d8d4ca', '#aca79d'],
  render: ['#e6e2d8', '#dcdcd6', '#ece6d8', '#c8ccce'],
};

type Weighted<T> = readonly (readonly [T, number])[];
const pick = <T>(id: string, salt: string, options: Weighted<T>): T => {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = unitDraw(id, salt) * total;
  for (const [v, w] of options) { if ((r -= w) < 0) return v; }
  return options[options.length - 1][0];
};

/** Preset weights per era x use. A preset's wall material decides which colour families fit it. */
const STYLES: Record<ModernEra, Record<'housing' | 'office', Weighted<ModernStyle>>> = {
  reconstruction: {
    housing: [['brick', 4], ['brickDark', 3], ['smooth', 1], ['gallery', 1]],
    office: [['ribbon', 5], ['smooth', 2], ['brick', 2]],
  },
  'late-modern': {
    housing: [['gallery', 3], ['brickDark', 3], ['brick', 2], ['smooth', 1], ['ribbon', 1]],
    office: [['ribbon', 6], ['smoothDark', 2], ['curtain', 1], ['brickDark', 1]],
  },
  renewal: {
    housing: [['brickDark', 5], ['brick', 4], ['smoothDark', 1]],
    office: [['brickDark', 3], ['ribbon', 3], ['curtain', 2], ['smoothDark', 2]],
  },
  contemporary: {
    housing: [['brickDark', 4], ['brick', 2], ['smoothDark', 2], ['gallery', 2]],
    office: [['curtain', 4], ['ribbon', 3], ['brickDark', 3]],
  },
};
const BRICK: ReadonlySet<ModernStyle> = new Set(['brick', 'brickDark']);
const WALLS: Record<ModernEra, { brick: Weighted<WallFamily>; smooth: Weighted<WallFamily> }> = {
  reconstruction: { brick: [['brick-buff', 4], ['brick-red', 3], ['brick-dark', 2]], smooth: [['concrete', 2], ['render', 1]] },
  'late-modern': { brick: [['brick-dark', 4], ['brick-buff', 3], ['brick-red', 2]], smooth: [['concrete', 3], ['render', 1]] },
  renewal: { brick: [['brick-red', 5], ['brick-dark', 3], ['brick-buff', 2]], smooth: [['render', 2], ['concrete', 1]] },
  contemporary: { brick: [['brick-dark', 5], ['brick-red', 2], ['brick-buff', 2]], smooth: [['render', 3], ['concrete', 1]] },
};

/** Spandrel panels under ribbon and curtain bands: pale concrete or enamel, never the period's red or teal accents. */
export const SPANDREL_ACCENTS: readonly string[] = ['#e4e1da', '#d2d0ca', '#c4c6c4'];

export type ModernVocabulary = { era: ModernEra; use: ModernUse; style: ModernStyle; styleIndex: number; family: WallFamily; wall: string; accent?: string };

/**
 * The modern vocabulary for a dated post-1945 building, or null (no year, or before 1945: callers keep their old
 * picks). Curtain fronts only on blocks of at least 15 m; galleries only on housing of at least four storeys.
 */
export function modernVocabulary(f: ModernFacts): ModernVocabulary | null {
  if (f.year === null || !Number.isFinite(f.year)) return null;
  const era = modernEraFor(f.year);
  if (!era) return null;
  const use = modernUseFor(f);
  const options = STYLES[era][use === 'housing' ? 'housing' : 'office']
    .filter(([s]) => (s !== 'curtain' || f.heightM >= 15) && (s !== 'gallery' || f.heightM >= 11));
  const style = pick(f.id, 'modern-style', options);
  const walls = WALLS[era][BRICK.has(style) ? 'brick' : 'smooth'];
  const family = pick(f.id, 'modern-wall', walls);
  const swatches = MODERN_WALLS[family];
  const wall = swatches[Math.floor(unitDraw(f.id, 'modern-swatch') * swatches.length)];
  const banded = style === 'ribbon' || style === 'curtain';
  return { era, use, style, styleIndex: MODERN_STYLE[style], family, wall, ...(banded ? { accent: SPANDREL_ACCENTS[Math.floor(unitDraw(f.id, 'modern-spandrel') * SPANDREL_ACCENTS.length)] } : {}) };
}
