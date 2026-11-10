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
import { specWallDisplay, specWallSource, specWallsOn, type WallFamily } from './wallColour.js';

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
  /** Full storeys below the crown, ground included (FrontIntent.storeys; lane H9). */
  storeys?: number;
  /** facts.wallFamily: a reader's colour family for the wall (H5h hand set), the truth a pixel reading is checked against. */
  wallFamily?: WallFamily;
  /** Winning source per key above. */
  src: Partial<Record<'gable' | 'year' | 'wallMaterial' | 'wallHex' | 'bays' | 'storeys' | 'wallFamily', string>>;
}

/** What the spec adds to the generic mesher: an ArchitecturalRecipe subset plus the bay count. */
export type SpecRecipe = Partial<Pick<ArchitecturalRecipe, 'crownShape' | 'period' | 'wallHex' | 'bays'>> & { storeys?: number };

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

/**
 * Was held (2026-11-10, H1 frames): a strip-measured wall colour is the overcast panorama reading and drew Kinkerstraat
 * 244-332 darker than the generic palette, against the user's brighter-palette priority (2026-10-16). Released by lane
 * H9 (2026-11-10) through the wall-colour rule (wallColour.ts specWallDisplay: measured hue and chroma, one lightness
 * lift), behind `?specWalls=0` / SPEC_WALLS=0. `false` = the rule is live.
 */
export const SPEC_WALLS_HELD = false;
/**
 * Per-pand wall holds (the judgement session's ruling on #345: a pand whose drawn wall is still the wrong family after the
 * trim-misread rule keeps its period colour). Bare pand numbers (the NL.IMBAG.Pand. suffix). Empty = no pand held.
 */
export const SPEC_WALL_HOLD: ReadonlySet<string> = new Set<string>();
const pandNumber = (id: unknown) => String(id ?? '').replace(/^NL\.IMBAG\.Pand\./, '');

/**
 * Released 2026-11-10 (H1c #350): odd stated counts on two-window cells draw as half-cell axis units
 * (streetFacadeRendering.ts axisUnitPlan), and the #348 gate passes (closer on 12 of 19 scorable pands, further on none).
 * Auto-placed type bays the strip did not confirm are a 'default' and never written. Roll back by holding it again (a
 * world-v1 recompile carries it). docs/house-line.md §1 "Odd bays".
 */
export const SPEC_BAYS_HELD = false;

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
    // Painted brick with a measured wall colour keeps the brick cells (its courses show; the colour is the measured
    // paint, lane H9): a near-black painted front drawn in plaster cells read as render. Without a measured colour the
    // register's rule stands (painted = a light finish).
    const measuredPaint = view.wallMaterial === 'painted-brick' && !!view.wallHex && specWallsOn();
    const finish = view.wallMaterial === 'brick' || measuredPaint ? 'brick' : 'light';
    if (p.registerFinish !== finish) patch.registerFinish = finish;
  }
  const recipe: SpecRecipe = {};
  if (!SPEC_BAYS_HELD && view.bays && view.bays > 0 && view.src?.bays !== 'default') recipe.bays = view.bays;
  // The measured wall, through the wall-colour rule (lifted lightness, measured hue); `?specWalls=0` keeps the period colour.
  // A reading lighter than its family's usual tone on a brick front, or against a reader's family, is a trim misread and
  // draws the family tone (wallColour.ts specWallSource).
  if (!SPEC_WALLS_HELD && specWallsOn() && view.wallHex && /^#[0-9a-f]{6}$/i.test(view.wallHex) && !SPEC_WALL_HOLD.has(pandNumber(p.id))) {
    const brick = view.wallMaterial ? view.wallMaterial === 'brick' : p.registerFinish === 'brick';
    const src = specWallSource(view.wallHex.toLowerCase(), { family: view.wallFamily ?? null, brick });
    recipe.wallHex = specWallDisplay(src.hex, { fromPixel: src.fromPixel });
  }
  // A spec recipe only when it carries something the mesher reads (bays, storeys, a wall colour); crown and period ride along.
  if (view.storeys && view.storeys >= 2) recipe.storeys = view.storeys;
  if (recipe.bays || recipe.wallHex || recipe.storeys) {
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
  if (view.gable === 'flat') {
    // A street source or an author saw a flat-topped front (a parapet or a straight cornice line; lane H9, the
    // Raadhuisstraat arcade, whose register names a point gable on another front). Over a register gable the front
    // takes the cornice crown (the generic path's straight top over the roof behind it); without one nothing changes,
    // so a flat front never gains a pitched roof here (H1: cornice words gave 681 flat 1890s pands a canal roof).
    if (rank(view.src.gable) <= rank('monument-text') || p.monumentGable === undefined || p.monumentGable === 'cornice') return feature;
    return { ...feature, properties: { ...p, monumentGable: 'cornice' } };
  }
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
