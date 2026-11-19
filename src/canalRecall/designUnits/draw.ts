/**
 * Design units, the renderer (T2; docs/handoffs/design-units-plan-20261119.md phase 1). Behind `?designUnits=1`
 * (DESIGN_UNITS=1 in Node, `globalThis.__canalRecallDesignUnits` in tests), default off.
 *
 * A segment (designUnits/segments.ts) is one building as designed: one elevation, one eaves line, one roof. Two main-thread
 * decoration steps make the generic renderer draw it so:
 *
 *   - `withDesignUnits`, first in the chain (before the register facts and the facade): stamps `designUnit` (the segment's
 *     seed, eaves line and the member's slice; drawProps.ts), puts the front at the segment's eaves line, gives the member
 *     the segment's style year when the segment states one, and re-keys the citywide colour priors by the segment seed.
 *     Every per-pand hash downstream (wall family, bay preset, palette, tone, layout scale, extras, flat roof tone) reads
 *     the seed through `seedIdOf`.
 *   - `withDesignUnitRoof`, after withRowFront and before decorateRoof: one roof per segment, ridge along the street, as a
 *     house-row roof storey (`rowRoof`, roofMesh.ts): kind, rise, material, tone and dormer pitch from the segment seed, the
 *     party walls inside the segment joined (no hip), its two ends hipped.
 *
 * Precedence: anything explicit wins. A pand with a published row-front record is left alone; a measured gable
 * (`monumentGable`), a roof another step planned, or a stated HouseSpec bay count keep theirs. The flag off, a one-pand
 * segment or a pand in no segment: both steps return the same object.
 *
 * Exceptions: a member the segment lists as an exception is drawn at the line (clamped). A member NOT listed whose tile
 * height stands more than STALE_MEMBER_M off the line is taken as stale membership (the 2015 ordekaart predates demolition
 * and infill; BAG wins) and draws as today.
 */
import { citywideBuildingRoofPrior, citywideBuildingWallPrior } from '../look/palette.js';
import { rowFrontFor, rowFrontOn } from '../houseLine/rowFront.js';
import { segmentLookup, SEGMENTS_SCHEMA, type Segment, type SegmentsExtract, type SegmentSlice } from './segments.js';
import { designUnitOf, eraWindows, ERA_YEARS, type DesignUnitDraw } from './drawProps.js';

export { designUnitOf, seedIdOf, segmentBayM, sliceBays, eraWindows, ERA_YEARS, type DesignUnitDraw } from './drawProps.js';

/** The flag, read at call time (never at module load: the structure gate evaluates bundles in Node). */
export function designUnitsOn(): boolean {
  const g = globalThis as { __canalRecallDesignUnits?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallDesignUnits === 'boolean') return g.__canalRecallDesignUnits;
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('designUnits');
    if (q !== null) return q === '1';
  } catch { /* no location */ }
  return g.process?.env?.DESIGN_UNITS === '1';
}

/** The renderer's segment: the extract's, plus what the integrator may add: the style year (median member BAG year) and
 *  an anchor (lng, lat; the members' footprint centroid) for the measured wall pool. */
/** A segment's D1 read consensus (build-segments --reads): how many members were read, and the majority traits. */
export interface SegmentReads { n: number; whiteFrames?: boolean; pale?: boolean; arch?: boolean; finish?: string; bays?: Record<string, number> }
export type DrawSegment = Segment & { year?: number | null; at?: readonly [number, number]; reads?: SegmentReads };
type Hit = { segment: DrawSegment; slices: SegmentSlice[]; exception?: Segment['exceptions'][number] };

let lookup: Map<string, Hit> | null = null;
const key = (id: unknown) => String(id ?? '').replace(/^NL\.IMBAG\.Pand\./, '').slice(-16);

/** Install the segments (Node: tests and scripts; browser: loadDesignSegments). Null clears them. */
export function setDesignSegments(x: SegmentsExtract | null): void { lookup = x ? segmentLookup(x) as Map<string, Hit> : null; }
export function designSegmentFor(id: unknown): Hit | null { return lookup?.get(key(id)) ?? null; }

/** Where the integrator publishes the extract, under the site root. */
export const DESIGN_UNITS_BROWSER_PATH = 'data/extracts/amsterdam/design-units-v1/segments.json';
let loading: Promise<boolean> | null = null;
/** Browser wiring: fetch the extract once, only with the flag on; resolves true when segments are installed. */
export function loadDesignSegments(base = '', fetchFn: typeof fetch | undefined = (globalThis as { fetch?: typeof fetch }).fetch): Promise<boolean> {
  if (!designUnitsOn() || !fetchFn) return Promise.resolve(false);
  return loading ??= fetchFn(`${base}${DESIGN_UNITS_BROWSER_PATH}`).then(r => r.ok ? r.json() : null).then((json: SegmentsExtract | null) => {
    if (!json || json.schema !== SEGMENTS_SCHEMA || !Array.isArray(json.segments)) return false;
    setDesignSegments(json);
    return json.segments.length > 0;
  }).catch(() => false);
}

/** A member whose tile height stands this far off its segment line, and is not a listed exception, draws as today (m). */
export const STALE_MEMBER_M = 6;

type Feature = { type?: string; properties: Record<string, unknown>; geometry: unknown };
const CITYWIDE_WALL = 'citywide-identity-palette-v3-not-measured';
const CITYWIDE_ROOF = 'citywide-flat-cap-palette-v3-not-measured';

const isLngLat = (v: unknown): v is readonly [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n));

/** The member's draw: its longest slice, and its place among the members on that street. */
export function memberDraw(segment: DrawSegment, pandId: string, exception: boolean): DesignUnitDraw | null {
  const mine = segment.slices.filter(s => s.pandId === pandId);
  if (!mine.length) return null;
  const main = mine.reduce((a, b) => (b.toM - b.fromM > a.toM - a.fromM ? b : a));
  const onStreet = segment.slices.filter(s => s.street === main.street).sort((a, b) => a.fromM - b.fromM || (a.pandId < b.pandId ? -1 : 1));
  const widths = onStreet.map(s => s.toM - s.fromM).sort((a, b) => a - b), moduleM = +widths[Math.floor((widths.length - 1) / 2)].toFixed(2);
  // The era rules (pre-1920 segments): the plot is the bay module, light frames and tall sashes unless the reads say otherwise.
  const era = typeof segment.year === 'number' && segment.year >= ERA_YEARS.from && segment.year <= ERA_YEARS.to;
  const r = segment.reads, read = r?.bays?.[pandId];
  const look = era || r ? { tall: true, dark: r?.whiteFrames === undefined ? false : !r.whiteFrames, ...(r?.pale !== undefined ? { pale: r.pale } : {}), ...(r?.arch !== undefined ? { arch: r.arch } : {}) } : undefined;
  // One window pitch per segment (its module split by the era count), so the columns keep their spacing across party
  // walls: a plot twice the module draws twice the windows, not wider ones.
  const pitch = moduleM / eraWindows(moduleM);
  const bays = typeof read === 'number' && read > 0 ? read : era ? Math.max(1, Math.round((main.toM - main.fromM) / pitch)) : undefined;
  const bayPitchM = era && pitch > 0 ? +pitch.toFixed(3) : undefined;
  return { seed: segment.seed, segment: segment.id, eavesM: segment.eavesM, street: main.street, fromM: main.fromM, toM: main.toM, moduleM,
    k: onStreet.findIndex(s => s === main), n: onStreet.length, ...(isLngLat(segment.at) ? { at: [segment.at[0], segment.at[1]] as const } : {}), ...(exception ? { exception: true as const } : {}),
    ...(bays ? { bays } : {}), ...(bayPitchM ? { bayPitchM } : {}), ...(look ? { look } : {}) };
}

/** Step 1 (first in the chain): stamp the segment draw, the segment's line and year, and re-key the colour priors. */
export function withDesignUnits<T extends Feature>(feature: T): T {
  if (!lookup || !designUnitsOn()) return feature;
  const p = feature.properties, hit = lookup.get(key(p.id));
  if (!hit || hit.segment.members.length < 2) return feature;
  // A published row-front record is explicit: the pand draws its record (houseLine/rowFront.ts).
  if (rowFrontOn() && rowFrontFor(p.id)) return feature;
  if (p.kitWall || p.kitRoof || p.largeTier || p.frontCarrier || p.gardenShed) return feature;
  const s = hit.segment, line = s.eavesM, h = Number(p.height);
  if (line !== null && !hit.exception && Number.isFinite(h) && Math.abs(h - line) > STALE_MEMBER_M) return feature;
  const draw = memberDraw(s, key(p.id), !!hit.exception);
  if (!draw) return feature;
  const out: Record<string, unknown> = { ...p, designUnit: draw };
  if (line !== null && line > 2) out.height = line;
  if (typeof s.year === 'number' && Number.isFinite(s.year) && s.year !== p.constructionYear) {
    out.constructionYear = s.year;
    if (p.constructionYear !== undefined) out.bagConstructionYear = p.constructionYear;
  }
  // The citywide identity priors (buildingTilesBrowser decorateBuildingFeature) hash the pand id: one per segment instead.
  if (p.appearanceStyleSource === CITYWIDE_WALL && typeof p.sideColour === 'string') { out.sideColour = citywideBuildingWallPrior(s.seed); out.groundColour = out.sideColour; }
  if (p.roofAppearanceStyleSource === CITYWIDE_ROOF && typeof p.roofColour === 'string') out.roofColour = citywideBuildingRoofPrior(s.seed);
  return { ...feature, properties: out };
}

const hash01 = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };
const pick = <V>(r: number, w: Array<[V, number]>): V => { const t = w.reduce((a, [, x]) => a + x, 0); let acc = 0; for (const [v, x] of w) { acc += x / t; if (r < acc) return v; } return w[w.length - 1][0]; };

export type SegmentRoofKind = 'flat' | 'mansardHip' | 'pitched';
export interface SegmentRoof { kind: SegmentRoofKind; riseM: number; material: 'tile' | 'slate'; tone: number; dormerPitchM: number | null; dormerKind: 'plain' | 'gabled' | 'pediment' }
/**
 * The segment's one roof, from its seed alone (never a member's id or rect). The odds are the 19th-century ring's: about a
 * third flat behind the cornice, a third slate mansard, a third a pitched roof with its ridge along the street. The style
 * is the members' (the facade decorator's), so a post-war segment stays flat.
 */
export function segmentRoof(seed: string, style: string): SegmentRoof {
  const kind: SegmentRoofKind = style === 'postwar' || style === 'modern' || style === 'tower' ? 'flat'
    : pick(hash01(`${seed}:roof`), [['flat', 0.34], ['mansardHip', 0.36], ['pitched', 0.3]] as Array<[SegmentRoofKind, number]>);
  const riseM = kind === 'mansardHip' ? 2.6 + hash01(`${seed}:rise`) * 0.6 : kind === 'pitched' ? 2.8 + hash01(`${seed}:rise`) * 1.0 : 0;
  // c19 Ring fronts carry slate or dark tile, never the orange pantile of the pitched-roof dice.
  const material = kind === 'mansardHip' || style === 'c19' ? 'slate' : hash01(`${seed}:mat`) < 0.62 ? 'tile' : 'slate';
  const dormers = kind === 'mansardHip' || (kind === 'pitched' && hash01(`${seed}:dorm`) < 0.55);
  return { kind, riseM: +riseM.toFixed(2), material, tone: +hash01(`${seed}:tone2`).toFixed(3),
    dormerPitchM: dormers ? +(3.4 + hash01(`${seed}:dpitch`) * 1.4).toFixed(2) : null,
    dormerKind: pick(hash01(`${seed}:dkind`), [['plain', 0.5], ['gabled', 0.3], ['pediment', 0.2]] as Array<[SegmentRoof['dormerKind'], number]>) };
}

/** Step 2 (after withRowFront, before decorateRoof): the segment's one roof on this member, its front at the line. */
export function withDesignUnitRoof<T extends Feature>(feature: T): T {
  const p = feature.properties, d = designUnitOf(p);
  if (!d || d.eavesM === null || !(d.eavesM > 4) || !designUnitsOn()) return feature;
  if (!p.facade || p.rowFront || p.roofPlanned || typeof p.monumentGable === 'string' || p.kitRoof) return feature;
  const roof = segmentRoof(d.seed, String(p.facadeStyle ?? '')), top = d.eavesM;
  const { roofDormer: _dice, roofShapeTag: _tag, ...rest } = p;
  if (roof.kind === 'flat') return { ...feature, properties: { ...rest, height: top, roofEavesHeightM: top, roofPlanned: false, roofShape: 'flat' } };
  const w = d.toM - d.fromM, n = roof.dormerPitchM ? Math.max(1, Math.round(w / roof.dormerPitchM)) : 0;
  const dormers = Array.from({ length: n }, (_, i) => ({ a: +((i + 0.5) / n).toFixed(3), kind: roof.dormerKind }));
  // Joined at the party walls inside the segment (no hip, a plate closes the profile); the segment's two ends hip.
  const joins = { ...(d.k > 0 ? { left: true } : {}), ...(d.k < d.n - 1 ? { right: true } : {}) };
  const pitched = roof.kind === 'pitched';
  return { ...feature, properties: { ...rest, height: +(top + roof.riseM).toFixed(3), roofEavesHeightM: top, roofPlanned: true, roofShape: pitched ? 'hipped' : 'mansardHip', roofDormer: n > 0,
    rowRoof: { riseM: roof.riseM, material: roof.material, dormers, series: d.seed, tone: roof.tone, ...(joins.left || joins.right ? { joins } : {}), ...(pitched ? { shape: 'hipped' } : {}) } } };
}
