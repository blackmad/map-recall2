/**
 * The explorer's "buurt look" view (explore.html?buurt=<slug>): which municipal buurten the game draws from kit made
 * for that district, and the recipes behind it. Data: `extracts/amsterdam/explorer-looks.json`, written by
 * `scripts/explorer/build-looks.ts` from the coverage extract (coverage-v1: the own-look tier per buurt and its
 * catalogue), the block-face house-type libraries (scripts/block-face/types/<district>/), the measured faces' intents,
 * the Nieuw-West building-type designs and the installed chunks.
 *
 * A "look" is one of three recipe kinds, all compiled offline into GLBs the explorer already knows how to show:
 *   type    a block-face house type of a district library (measured palette, window kind, crown, kit components),
 *           shown on a run of its houses inside the installed street chunk that draws it;
 *   design  a Nieuw-West building-type design variant (one instanced unit GLB per variant);
 *   face    a block face measured house by house (no shared type), shown as its whole chunk.
 * Everywhere else the city draws generic extrusions with the era facade grammar: the `defaultLook`.
 *
 * Pure: no DOM, no fetch. browser.ts renders it; the build script fills it.
 */
import type { FeedbackOptions } from './panel';
import type { LngLat } from './types';

export type Swatch = { name: string; colors: [role: string, hex: string][] };
export type LookThumb = { src: string; label: string; credit?: string };
export type LookKind = 'type' | 'design' | 'face';
export type Box3 = { min: [number, number, number]; max: [number, number, number] };

/** Shared description of one recipe, keyed `type:<id>`, `design:<unit>` or `face:<id>`. */
export interface LookRecipe {
  kind: LookKind;
  title: string;
  /** "Rivierenbuurt house type", "Nieuw-West building type", "Measured block face". */
  source: string;
  description?: string;
  /** BAG build years of the evidence pands. */
  era?: [number, number];
  swatches: Swatch[];
  /** Kit components the recipe uses: `windows:casement-toplight`, `gable:flat`, `roof:bitumen`, `eavesOverhang`... */
  kitKeys: string[];
  /** Page-relative GLB of the chunk (type, face) or unit (design) that draws it. */
  glbUrl?: string;
  bytes?: number;
  /** Explorer model id of that GLB when the explorer lists it (block-face chunks). */
  modelId?: string;
  /** Offline kit render and archived photo crop (coverage-v1/look), page-relative. */
  render?: LookThumb;
  photo?: LookThumb;
}

/** One recipe as it draws in one buurt: how many pands, and where to frame it in its GLB. */
export interface LookUse {
  key: string;
  /** Pands it draws in this buurt (0: authored here, drawn elsewhere or not yet). */
  pands: number;
  /** Chunk GLB to load when it differs from the recipe's (the chunk in this buurt that draws most houses of the type). */
  glbUrl?: string;
  bytes?: number;
  modelId?: string;
  /** GLB-local box of a run of this type's houses; absent: frame the whole GLB. */
  focus?: Box3;
  houses?: number;
}

export type LookStatus = 'drawn' | 'authored';

export interface LookBuurt {
  slug: string;
  /** Municipal buurt code (CBS), e.g. KM04. */
  code: string;
  name: string;
  wijk?: string;
  /** The explorer neighbourhood (OSM outline in explorer-index.json) that holds this buurt's centre. */
  explorerBuurt?: string;
  lngLat: LngLat;
  /** [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Outer rings of the municipal outline, [lng, lat] at 5 decimals. */
  outline: number[][][];
  status: LookStatus;
  /** All BAG pands of the buurt, and those drawn from its own kit. */
  pands: number;
  lookPands: number;
  share: number;
  /** Which kits draw here, most pands first ("Rivierenbuurt house types", "measured street faces"). */
  districts: string[];
  uses: LookUse[];
  /** Explorer models (landmarks, buildings, street frontages) standing in this buurt, ids for `?model=`. */
  models: string[];
}

export interface ExplorerLooks {
  version: 1;
  generatedAt: string;
  defaultLook: { title: string; description: string; swatches: Swatch[] };
  recipes: Record<string, LookRecipe>;
  buurten: LookBuurt[];
  /** Municipal buurten without an own look, [slug, name, code], so their deep links can say so. */
  none: [string, string, string][];
}

/** "Rijnbuurt-Oost" -> "rijnbuurt-oost"; "Van Galenbuurt e.o." -> "van-galenbuurt-e-o". */
export const slugify = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export type LookMatch = { look: LookBuurt } | { none: { slug: string; name: string; code: string } } | undefined;

/** A `?buurt=` value against the looks: slug, CBS code or name, any case. */
export function findLook(looks: Pick<ExplorerLooks, 'buurten' | 'none'>, value: string | null | undefined): LookMatch {
  if (!value) return undefined;
  const slug = slugify(value), code = value.trim().toUpperCase();
  const look = looks.buurten.find(b => b.slug === slug || b.code === code);
  if (look) return { look };
  const n = looks.none.find(([s, , c]) => s === slug || c === code);
  return n ? { none: { slug: n[0], name: n[1], code: n[2] } } : undefined;
}

/**
 * Whether a `?buurt=` value names a look rather than the explorer's neighbourhood filter. The filter keeps its
 * display names (`?buurt=Jordaan`); a look is asked for by its slug or code (`?buurt=rijnbuurt-oost`, `?buurt=KM04`),
 * or by a name that is not an explorer neighbourhood.
 */
export function asksForLook(value: string, explorerNames: readonly string[], looks: Pick<ExplorerLooks, 'buurten' | 'none'>): boolean {
  const match = findLook(looks, value);
  if (!match) return false;
  const slug = 'look' in match ? match.look.slug : match.none.slug, code = 'look' in match ? match.look.code : match.none.code;
  if (value === slug || value.toUpperCase() === code && value === value.toUpperCase()) return true;
  return !explorerNames.some(n => n.toLowerCase() === value.trim().toLowerCase());
}

/** Looks whose centre lies in an explorer neighbourhood, most own-look pands first. */
export const looksIn = (looks: readonly LookBuurt[], explorerBuurt: string | undefined): LookBuurt[] =>
  looks.filter(b => !explorerBuurt || b.explorerBuurt === explorerBuurt)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'drawn' ? -1 : 1) || b.lookPands - a.lookPands || a.name.localeCompare(b.name, 'nl'));

/** The nearest other buurt with a drawn look, to compare recipes side by side. */
export function nearestLook(looks: readonly LookBuurt[], of: LookBuurt): LookBuurt | undefined {
  const k = Math.cos((of.lngLat[1] * Math.PI) / 180);
  const d = (b: LookBuurt) => Math.hypot((b.lngLat[0] - of.lngLat[0]) * k, b.lngLat[1] - of.lngLat[1]);
  return looks.filter(b => b.slug !== of.slug && b.status === 'drawn').sort((a, b) => d(a) - d(b))[0];
}

/** `windows:casement-toplight` -> "Windows: casement toplight"; `eavesOverhang` -> "Eaves overhang". */
export function kitKeyLabel(key: string): string {
  const [k, v] = key.split(':');
  const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase();
  const head = words(k);
  return (head.charAt(0).toUpperCase() + head.slice(1)) + (v ? `: ${words(v)}` : '');
}

/** Kit keys grouped for the panel: window, gable/crown and roof kinds first, other components after. */
export function groupKitKeys(keys: readonly string[]): { kinds: string[]; components: string[] } {
  const KIND = /^(windows|storeyWindows|gable|cornice|roof|windowHead|windowSurround|ground)\b/;
  return { kinds: keys.filter(k => KIND.test(k)), components: keys.filter(k => !KIND.test(k)) };
}

/** "Report a problem with this look": a building report on the buurt centre (the feedback rules have no buurt kind). */
export const lookReportOptions = (b: Pick<LookBuurt, 'name' | 'code' | 'lngLat'>): FeedbackOptions => ({
  category: 'building',
  subject: { kind: 'point', id: `buurt:${b.code}`, lngLat: b.lngLat },
  label: `Look of ${b.name} (${b.code})`,
  id: `explore:look:${b.code}`,
});

/** What the look panel says about a buurt's status. */
export function lookSummary(b: LookBuurt): string {
  const pct = (s: number) => `${s < 0.01 && s > 0 ? '<1' : Math.round(s * 100)} %`;
  if (b.status === 'authored') return `House types or block faces are authored here, but no installed chunk draws a pand in ${b.name} yet; the recipes below are shown where they are drawn.`;
  return `${b.lookPands.toLocaleString('en-GB')} of ${b.pands.toLocaleString('en-GB')} pands (${pct(b.share)}) are drawn from ${b.districts.join(', ')}; the rest use the city's generic look.`;
}

// ---------- build-time helpers (pure, used by scripts/explorer/build-looks.ts) ----------

export type ChunkPand = { pandId: string; frontage?: { x0: number; x1: number }; bounds?: { min: number[]; max: number[] } };

/**
 * A run of neighbouring houses of one type inside a chunk, up to `maxM` of frontage, starting at the first of them
 * along the frontage (or at `start`): the box the look view frames. Null when the chunk has none of them.
 */
export function typeRun(pands: readonly ChunkPand[], isType: (pand: string) => boolean, maxM = 22, start?: string): { focus: Box3; houses: number } | null {
  const order = pands.filter(p => p.frontage && p.bounds).sort((a, b) => a.frontage!.x0 - b.frontage!.x0);
  let first = start ? order.findIndex(p => p.pandId === start && isType(p.pandId)) : -1;
  if (first < 0) first = order.findIndex(p => isType(p.pandId));
  if (first < 0) return null;
  const run = [order[first]];
  for (let i = first + 1; i < order.length && isType(order[i].pandId) && order[i].frontage!.x1 - run[0].frontage!.x0 <= maxM; i++) run.push(order[i]);
  const r = (v: number) => Math.round(v * 100) / 100;
  const min = [0, 1, 2].map(k => r(Math.min(...run.map(p => p.bounds!.min[k])))) as [number, number, number];
  const max = [0, 1, 2].map(k => r(Math.max(...run.map(p => p.bounds!.max[k])))) as [number, number, number];
  return { focus: { min, max }, houses: run.length };
}

/** A design variant's palette (`{wall: {slot, tint}, frame: '#..'}`) as one swatch of hex colours. */
export function paletteSwatch(name: string, palette: Record<string, unknown> | undefined, named: Record<string, string> = {}): Swatch | null {
  const colors: [string, string][] = [];
  for (const [role, v] of Object.entries(palette ?? {})) {
    const raw = typeof v === 'string' ? v : v && typeof v === 'object' ? (v as { tint?: unknown }).tint : undefined;
    const hex = typeof raw === 'string' ? (/^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : named[raw]) : undefined;
    if (hex) colors.push([role, hex]);
  }
  return colors.length ? { name, colors } : null;
}

/** Point in a GeoJSON Polygon / MultiPolygon ([lng, lat]). */
export function inGeometry([x, y]: LngLat, g: { type: string; coordinates: unknown }): boolean {
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  return polys.some(p => p.length > 0 && inRing(p[0]) && !p.slice(1).some(inRing));
}
