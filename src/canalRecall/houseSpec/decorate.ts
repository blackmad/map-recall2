/**
 * The generic streamed path reads HouseSpecs (house line H1 step 5, docs/house-line.md §1 "The generic path").
 *
 * Runtime half, pure and light (no intent schema, no fs): the tile enricher stamps each pand's runtime view
 * (`p.houseSpec`, built by scripts/house-specs/build-house-specs.ts from the resolved spec) onto the raw feature, and
 * two decorator steps turn it into properties the chain already honours:
 *   withHouseSpec      (before decorateFacade, right after the register step) constructionYear, registerFinish and one
 *                      new `specRecipe` {period, crownShape, wallHex, bays} that meshBuildingFor carries to the mesher
 *   withHouseSpecCrown (after withMonumentGable) monumentGable, when the spec's gable comes from a stronger source than
 *                      the register text or nothing else named one
 * A feature without `houseSpec` is returned as the same object, so `?houseSpecs=0` (or HOUSE_SPECS=0 in Node, or no
 * extract) is byte-identical to the chain before.
 */
import type { GableShape } from '../roofMesh.js';
import type { ArchitecturalRecipe } from '../streetAppearance.js';
import { eraOfYear } from '../facade/registerRecipe.js';
import { SOURCE_STRENGTH } from '../facade/evidence.js';

/** Rank on the evidence ladder (spec.ts specStrength without the intent schema import): `author` = `reviewed`. */
const rank = (s: string | undefined) => (SOURCE_STRENGTH as readonly string[]).indexOf(s === 'author' ? 'reviewed' : s ?? '');

/** The runtime view of a resolved spec: only what the generic path reads, each with its winning source. */
export interface HouseSpecView {
  /** Street front crown, intent vocabulary (buildingRecipe/intent.ts GABLES). */
  gable?: string;
  /** The year the street front dates to. */
  year?: number;
  /** palette.wallMaterial. */
  wallMaterial?: 'brick' | 'stucco' | 'painted-brick';
  /** palette.brick as #rrggbb (a swatch name resolved at build time). */
  wallHex?: string;
  /** Window bays across the street front above the ground storey. */
  bays?: number;
  /** Winning source per key above. */
  src: Partial<Record<'gable' | 'year' | 'wallMaterial' | 'wallHex' | 'bays', string>>;
}

/** What the spec adds to the generic mesher: an ArchitecturalRecipe subset plus the bay count. */
export type SpecRecipe = Partial<Pick<ArchitecturalRecipe, 'crownShape' | 'period' | 'wallHex' | 'bays'>>;

/** Default on; `?houseSpecs=0` in the page or HOUSE_SPECS=0 in Node turns the enricher (and so every step) off. */
export const HOUSE_SPECS_DEFAULT = true;
export function houseSpecsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]houseSpecs=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? HOUSE_SPECS_DEFAULT : v === '1';
}

/** Intent gable -> the roof planner's gable (roofMesh GABLE_SHAPES); `flat` and `shouldered` have none. */
export const GABLE_TO_ROOF: Readonly<Record<string, GableShape>> = {
  step: 'step', neck: 'neck', 'raised-neck': 'raisedNeck', bell: 'bell', spout: 'spout', point: 'plain', cornice: 'cornice',
};
/** Intent gable -> ArchitecturalRecipe.crownShape. */
const GABLE_TO_CROWN: Readonly<Record<string, NonNullable<ArchitecturalRecipe['crownShape']>>> = {
  neck: 'neck', 'raised-neck': 'neck', bell: 'bell', cornice: 'cornice', step: 'plain', spout: 'plain', point: 'plain',
};
const ERA_PERIOD = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' } as const;

const PRIOR_SOURCE = 'citywide-identity-palette-v3-not-measured';
type Props = Record<string, unknown>;
const viewOf = (p: Props): HouseSpecView | null => {
  const v = p.houseSpec as HouseSpecView | undefined;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
};
/** The same exclusions as the register step (registerRecipe.ts registerPatch): measured fronts, kits, large tier. */
const excluded = (p: Props) => (p.appearanceStyleSource !== undefined && p.appearanceStyleSource !== PRIOR_SOURCE) || !!p.kitWall || !!p.largeTier;

/** The property patch a spec view makes before decorateFacade; empty when nothing changes. */
export function houseSpecPatch(view: HouseSpecView, p: Props): Props {
  const patch: Props = {};
  if (Number.isInteger(view.year)) {
    const year = view.year!, current = p.constructionYear === null || p.constructionYear === undefined ? NaN : Number(p.constructionYear);
    // As the register step: only an era change moves the year (the palette and layout key on the era, not the year).
    if (!Number.isFinite(current) || eraOfYear(year) !== eraOfYear(current)) {
      patch.constructionYear = year;
      if (p.bagConstructionYear === undefined) patch.bagConstructionYear = Number.isFinite(current) ? current : null;
    }
  }
  if (view.wallMaterial) {
    const finish = view.wallMaterial === 'brick' ? 'brick' : 'light';
    if (p.registerFinish !== finish) patch.registerFinish = finish;
  }
  const recipe: SpecRecipe = {};
  if (view.bays && view.bays > 0) recipe.bays = view.bays;
  if (view.wallHex && /^#[0-9a-f]{6}$/i.test(view.wallHex)) recipe.wallHex = view.wallHex.toLowerCase();
  // A spec recipe only when it carries something the mesher reads (bays, a wall colour); crown and period ride along.
  if (recipe.bays || recipe.wallHex) {
    const year = Number.isInteger(view.year) ? view.year! : Number(patch.constructionYear ?? p.constructionYear);
    if (Number.isFinite(year)) recipe.period = ERA_PERIOD[eraOfYear(year)];
    if (view.gable && GABLE_TO_CROWN[view.gable]) recipe.crownShape = GABLE_TO_CROWN[view.gable];
    patch.specRecipe = recipe;
  }
  return patch;
}

/** Decorator step (after the register step, before decorateFacade). Same object back when nothing applies. */
export function withHouseSpec<T extends { properties: Props }>(feature: T): T {
  const view = viewOf(feature.properties);
  if (!view || excluded(feature.properties)) return feature;
  const patch = houseSpecPatch(view, feature.properties);
  return Object.keys(patch).length ? { ...feature, properties: { ...feature.properties, ...patch } } : feature;
}

/** Decorator step after withMonumentGable: the spec's crown, when it outranks the register text (the gables extract
 *  is the register's own classification) or when no gable was named. */
export function withHouseSpecCrown<T extends { properties: Props }>(feature: T): T {
  const p = feature.properties, view = viewOf(p);
  if (!view?.gable || excluded(p)) return feature;
  const shape = GABLE_TO_ROOF[view.gable];
  if (!shape || p.monumentGable === shape) return feature;
  const stronger = rank(view.src.gable) > rank('monument-text');
  return p.monumentGable === undefined || stronger ? { ...feature, properties: { ...p, monumentGable: shape } } : feature;
}

// --- the tile enricher -------------------------------------------------------------------------------------------
/** One tile of the extract (`house-specs/14/<x>/<y>.json.gz`), keyed by feature id (`NL.IMBAG.Pand.<16>`). */
export interface HouseSpecTile {
  version: 1;
  buildings: Record<string, HouseSpecTileRecord>;
}
/** One pand: the resolved design and facts, the winning source per field, limits, route, and the runtime view. */
export interface HouseSpecTileRecord {
  /** Resolved design (DeepPartial<HouseDesign>). */
  d: Record<string, unknown>;
  /** Resolved facts (SpecFacts). */
  x?: Record<string, unknown>;
  /** Winning source per field path. */
  s: Record<string, string>;
  /** Kit limits (spec.ts SpecLimit). */
  l?: { component: string; what: string }[];
  r: 'generic' | 'recipe';
  /** The runtime view the enricher stamps as `p.houseSpec`. */
  v: HouseSpecView;
}
export const HOUSE_SPECS_ZOOM = 14;
/** Published extract directory, relative to the extract root. */
export const HOUSE_SPECS_DIR = 'house-specs';

async function readJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Stamps `p.houseSpec` (the runtime view) on each pand of a z14 tile the extract has; a missing tile is no specs. */
export function houseSpecEnricher(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args), dir: string = HOUSE_SPECS_DIR) {
  const root = baseUrl.replace(/\/$/, '');
  return async (tile: { z: number; x: number; y: number }, signal?: AbortSignal) => {
    if (tile.z !== HOUSE_SPECS_ZOOM) return undefined;
    let specs: HouseSpecTile['buildings'] | null = null;
    try {
      const response = await fetchImpl(`${root}/${dir}/${tile.z}/${tile.x}/${tile.y}.json.gz`, { signal });
      if (response.ok) specs = ((await readJson(response)) as HouseSpecTile)?.buildings ?? null;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    if (!specs) return undefined;
    return (features: Array<{ properties?: Props }>) => {
      for (const f of features) {
        const record = f.properties ? specs![String(f.properties.id ?? '')] : undefined;
        if (record?.v) f.properties!.houseSpec = record.v;
      }
    };
  };
}
