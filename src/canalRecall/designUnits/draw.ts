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
  // Era fronts: tall sashes under a transom light in light frames (the photographed rows; 85 % of the D1 ring reads say
  // white frames), unless the reads say otherwise.
  const look = era || r ? { tall: true, sash: 'transom' as const, dark: r?.whiteFrames === undefined ? false : !r.whiteFrames, ...(r?.pale !== undefined ? { pale: r.pale } : {}), ...(r?.arch !== undefined ? { arch: r.arch } : {}) } : undefined;
  // One window pitch per segment (its module split by the era count), so the columns keep their spacing across party
  // walls: a plot twice the module draws twice the windows, not wider ones.
  // A single plot (up to 1.5 modules) takes the era count for its own width (2 under 4.8 m, 3 to 7.5 m): a 4.3 m plot drew
  // 3 columns at the segment pitch where the prior says 2. A multi-plot member keeps the segment pitch.
  const sliceM = main.toM - main.fromM, segPitch = moduleM / eraWindows(moduleM);
  const bays = typeof read === 'number' && read > 0 ? read : era ? (sliceM <= moduleM * 1.5 ? eraWindows(sliceM) : Math.max(1, Math.round(sliceM / segPitch))) : undefined;
  const pitch = bays && sliceM <= moduleM * 1.5 ? sliceM / bays : segPitch;
  const bayPitchM = era && pitch > 0 ? +pitch.toFixed(3) : undefined;
  return { seed: segment.seed, segment: segment.id, eavesM: segment.eavesM, street: main.street, fromM: main.fromM, toM: main.toM, moduleM,
    k: onStreet.findIndex(s => s === main), n: onStreet.length, ...(isLngLat(segment.at) ? { at: [segment.at[0], segment.at[1]] as const } : {}), ...(exception ? { exception: true as const } : {}),
    ...(bays ? { bays } : {}), ...(bayPitchM ? { bayPitchM } : {}), ...(look ? { look } : {}), ...(typeof segment.roofRiseM === 'number' ? { roofRiseM: segment.roofRiseM } : {}) };
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

export type SegmentRoofKind = 'flat' | 'mansardHip';
export interface SegmentRoof { kind: SegmentRoofKind; riseM: number; material: 'slate'; tone: number; dormerPitchM: number | null; dormerKind: 'plain' | 'gabled' | 'pediment' }
/** AHN roof mass this far over the eaves line (m) is a roof storey; less is a flat top behind the cornice. */
export const ROOF_STOREY_MIN_M = 1.8;
/**
 * The segment's one roof (the De Pijp rule): a slate roof storey with dormers only where AHN shows roof mass over the eaves
 * line (`roofRiseM` >= ROOF_STOREY_MIN_M), its rise the measured one (2.4-4 m); a flat top behind the cornice otherwise,
 * unmeasured included. Ridge along the street, closed at the segment's ends (no hips or pyramids), one covering, a slate
 * tone from the darker half. Post-war styles stay flat. Seed choices: tone, dormer pitch and kind only.
 */
export function segmentRoof(seed: string, style: string, roofRiseM: number | null | undefined): SegmentRoof {
  const storey = !(style === 'postwar' || style === 'modern' || style === 'tower') && typeof roofRiseM === 'number' && roofRiseM >= ROOF_STOREY_MIN_M;
  const kind: SegmentRoofKind = storey ? 'mansardHip' : 'flat';
  const riseM = storey ? Math.min(4, Math.max(2.4, roofRiseM!)) : 0;
  return { kind, riseM: +riseM.toFixed(2), material: 'slate', tone: +(hash01(`${seed}:tone2`) * 0.5).toFixed(3),
    dormerPitchM: storey ? +(3.4 + hash01(`${seed}:dpitch`) * 1.4).toFixed(2) : null,
    dormerKind: pick(hash01(`${seed}:dkind`), [['plain', 0.5], ['gabled', 0.3], ['pediment', 0.2]] as Array<[SegmentRoof['dormerKind'], number]>) };
}

/** Step 2 (after withRowFront, before decorateRoof): the segment's one roof on this member, its front at the line. */
export function withDesignUnitRoof<T extends Feature>(feature: T): T {
  const p = feature.properties, d = designUnitOf(p);
  if (!d || d.eavesM === null || !(d.eavesM > 4) || !designUnitsOn()) return feature;
  if (!p.facade || p.rowFront || p.roofPlanned || typeof p.monumentGable === 'string' || p.kitRoof) return feature;
  const roof = segmentRoof(d.seed, String(p.facadeStyle ?? ''), d.roofRiseM), top = d.eavesM;
  const { roofDormer: _dice, roofShapeTag: _tag, ...rest } = p;
  // A flat top behind the cornice: the flat lid (no roof box; threeBuildingFeatures applyFlatRoof). The measured eaves keep
  // decorateRoof off it.
  if (roof.kind === 'flat') return { ...feature, properties: { ...rest, height: top, roofEavesHeightM: top, roofPlanned: false, roofShape: 'flat' } };
  const w = d.toM - d.fromM, n = roof.dormerPitchM ? Math.max(1, Math.round(w / roof.dormerPitchM)) : 0;
  const dormers = Array.from({ length: n }, (_, i) => ({ a: +((i + 0.5) / n).toFixed(3), kind: roof.dormerKind }));
  // Closed at every end (a plate closes the profile): no hips or pyramids on a row segment, the ridge along the street.
  const joins = { left: true, right: true };
  return { ...feature, properties: { ...rest, height: +(top + roof.riseM).toFixed(3), roofEavesHeightM: top, roofPlanned: true, roofShape: 'mansardHip', roofDormer: n > 0,
    rowRoof: { riseM: roof.riseM, material: roof.material, dormers, series: d.seed, tone: roof.tone, joins } } };
}
