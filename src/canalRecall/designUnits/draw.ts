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
import { designUnitOf, eraWindows, ERA_YEARS, PLOT_EAVES_M, type DesignUnitDraw } from './drawProps.js';
import { plotPlan, plotWhite, plotHeads, plotDormers, plotLook, PLOT_GABLE_SHAPE, POINT_GABLE_RISE_PER_M, type PlotPlan } from './plotPlan.js';
import { rowCrownRoofRise, type RowCrown } from '../houseLine/crownProfile.js';
import type { RowCorniceDress, RowDoorcase } from '../houseSpec/row/types.js';
import type { GroundDoorRead } from './soloGround.ts';
import { roofPlanForFeature } from '../roofMesh.js';

export { designUnitOf, seedIdOf, segmentBayM, sliceBays, eraWindows, ERA_YEARS, PLOT_EAVES_M, PLOT_TONE_DL, type DesignUnitDraw } from './drawProps.js';

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
  const r = segment.reads, read = segment.plots?.[pandId]?.bays ?? r?.bays?.[pandId];
  // Era fronts: tall sashes under a transom light in light frames (the photographed rows; 85 % of the D1 ring reads say
  // white frames). An era front stays light even where the D1 reads say dark: Roemer Visscherstraat 164845's three reads
  // said dark and the photo shows cream frames (gate, 2026-11-19); the reads still set pale and arch.
  const look = era || r ? { tall: true, sash: 'transom' as const, dark: era ? false : r?.whiteFrames === undefined ? false : !r.whiteFrames, ...(r?.pale !== undefined ? { pale: r.pale } : {}), ...(r?.arch !== undefined ? { arch: r.arch } : {}) } : undefined;
  // One window pitch per segment (its module split by the era count), so the columns keep their spacing across party
  // walls: a plot twice the module draws twice the windows, not wider ones.
  // A single plot (up to 1.5 modules) takes the era count for its own width (2 under 4.8 m, 3 to 7.5 m): a 4.3 m plot drew
  // 3 columns at the segment pitch where the prior says 2. A multi-plot member keeps the segment pitch.
  const sliceM = main.toM - main.fromM, segPitch = moduleM / eraWindows(moduleM);
  const bays = typeof read === 'number' && read > 0 ? read : era ? (sliceM <= moduleM * 1.5 ? eraWindows(sliceM) : Math.max(1, Math.round(sliceM / segPitch))) : undefined;
  const pitch = bays && sliceM <= moduleM * 1.5 ? sliceM / bays : segPitch;
  const bayPitchM = era && pitch > 0 ? +pitch.toFixed(3) : undefined;
  // Round 2 (#399): each plot is its own house in the family. Its one-facade group (photo evidence) is its plot; the
  // breaks fall where the street neighbour is another plot, and at the segment's two ends.
  const groupOf = (id: string) => segment.plotGroups?.find(g => g.includes(id))?.slice().sort()[0] ?? id;
  const plot = groupOf(pandId), at = onStreet.indexOf(main);
  const plotBreak = { left: at <= 0 || groupOf(onStreet[at - 1].pandId) !== plot, right: at < 0 || at >= onStreet.length - 1 || groupOf(onStreet[at + 1].pandId) !== plot };
  const own = segment.plotEavesM?.[pandId], line = segment.eavesM;
  const plotEavesM = line === null ? undefined : +(typeof own === 'number' ? Math.min(line + PLOT_EAVES_M, Math.max(line - PLOT_EAVES_M, own)) : line).toFixed(2);
  // Round 3 (Ruyschstraat: "they're all basically identical"): a plot read like an earlier one on the street takes its
  // seed, so its tone, door and dice draw the same; unread plots keep their own.
  const plotKey = plotLook(segment.plots?.[pandId]), twin = plotKey ? onStreet.find(s => plotLook(segment.plots?.[s.pandId]) === plotKey)?.pandId : undefined;
  return { seed: segment.seed, plotSeed: `${segment.seed}:plot:${twin ? groupOf(twin) : plot}`, plotBreak, ...(plotEavesM !== undefined ? { plotEavesM } : {}), segment: segment.id, eavesM: segment.eavesM, street: main.street, fromM: main.fromM, toM: main.toM, moduleM,
    k: onStreet.findIndex(s => s === main), n: onStreet.length, ...(isLngLat(segment.at) ? { at: [segment.at[0], segment.at[1]] as const } : {}), ...(exception ? { exception: true as const } : {}),
    ...(bays ? { bays } : {}), ...(bayPitchM ? { bayPitchM } : {}), ...(look ? { look } : {}), ...(typeof segment.roofRiseM === 'number' ? { roofRiseM: segment.roofRiseM } : {}), ...(segment.roofEvidence ? { roofEvidence: segment.roofEvidence } : {}),
    ...(segment.plots?.[pandId] ? { plot: segment.plots[pandId] } : {}), ...(typeof segment.year === 'number' ? { year: segment.year } : {}) };
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
  if (line !== null && line > 2) out.height = draw.plotEavesM ?? line;
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

/**
 * A roof storey seen in photos inside the measured top (2026-11-20, David on Rustenburgerstraat: "why do r1 and r2 both
 * lose the mansards"). AHN's DSM is flat at the eaves line from 0.5 m behind the front to the back on these rows: the
 * front mansard and its dormers stand inside that top, so no AHN rise can see them. With photo evidence the top storey is
 * a slate roof storey of this rise, the cornice that far under the measured top, one dormer per plot.
 */
export const EVIDENCE_ROOF_RISE_M = 2.6;
/** A hoist-dormer row (Rustenburgerstraat, Blasiusstraat, Nassaukade): a short slate slope behind the cornice, the dormers
 *  standing above the flat top (narrow enough that AHN's 0.5 m cells miss them). Photo-row registration, 2026-11-20:
 *  the cornice stands about 1.2-1.5 m under the DSM top. */
export const EVIDENCE_HOIST_RISE_M = 1.4;
/** One dormer per house front: a plot wider than this many metres per dormer draws more (a 9 m pand with two doors). */
export const DORMER_FRONT_M = 5.5;

/** The segment years the plot plan draws (inclusive): the 1860-1939 Ring rows. */
export const PLOT_PLAN_YEARS = { from: 1860, to: 1939 } as const;

/**
 * A plot plan onto the mesher's properties: the storey count and ground height (`designStoreys`, laid out by the design
 * branch of threeBuildingMesh priorBays; a stated HouseSpec count still wins), the ground use (`specShop`, unless a spec
 * states it), balconies and a souterrain's stoop (`registerForce`), and the plot's roof element: a slate roof storey with
 * its dormers on or inside the top, a gable the roof planner draws on the cornice line, or the flat top.
 */
function withPlotPlan<T extends Feature>(feature: T, rest: Record<string, unknown>, d: DesignUnitDraw, plan: PlotPlan, roof: SegmentRoof, gableShape?: string): T {
  const p = feature.properties;
  const extra: Record<string, unknown> = { designStoreys: { storeys: plan.storeys, groundM: plan.groundM, src: plan.storeysSrc }, designPlot: { rule: plan.rule, roof: plan.roof, roofSrc: plan.roofSrc, wallM: plan.wallM, riseM: plan.riseM } };
  if (plan.ground && p.specShop === undefined) extra.specShop = plan.ground === 'shop';
  const force = Array.isArray(p.registerForce) ? [...p.registerForce as string[]] : [];
  // Stated balconies, or a read that saw none (an empty list keeps the dice balconettes off the plot).
  if (plan.balconies.length || d.plot?.balconies) extra.designBalconies = plan.balconies;
  if (plan.souterrain && !force.includes('stoop')) force.push('stoop');
  // The white detailing (2026-11-21, Rustenburgerstraat): frames by era, the read heads and string courses, each a kit part.
  const white = plotWhite(d.year, d.plot);
  if (white.frames) { extra.designFrames = true; if (!force.includes('white-window-frames')) force.push('white-window-frames'); }
  const heads = plotHeads(d.plot);
  if (d.plot?.whiteHeads === 'none' && !heads) extra.designPlainHeads = true;
  if (heads) { extra.designHeads = heads; if (!force.includes('row-heads')) force.push('row-heads'); }
  if (white.courses && !force.includes('string-courses')) force.push('string-courses');
  // Round 3: the read stone, bands and pilasters, each through its kit part.
  const f = d.plot, dress: Record<string, string> = {};
  if (f?.stone === 'plinth' || f?.stone === 'ground') { dress.stone = f.stone; const id = f.stone === 'plinth' ? 'stone-plinth-band' : 'rusticated-plinth'; if (!force.includes(id)) force.push(id); }
  if (f?.bands === 'ground' || f?.bands === 'all') { dress.bands = f.bands; if (!force.includes('speklagen')) force.push('speklagen'); }
  if (f?.pilasters === 'corners' || f?.pilasters === 'centre') { dress.pilasters = f.pilasters; if (!force.includes('corner-pilasters')) force.push('corner-pilasters'); }
  if (Object.keys(dress).length) extra.designDress = dress;
  if (typeof f?.wallHex === 'string' && /^#[0-9a-f]{6}$/i.test(f.wallHex)) extra.designWallHex = f.wallHex;
  // Belt review: the read cornice (the house rows' row-cornice) and the read door place.
  // A simple or frieze cornice is the house rows' row-cornice; a heavy or attic-frieze one the deep moulded kroonlijst on
  // consoles, a bracketed one the console cornice (the row-cornice's heavy frieze is squeezed out under a tall top storey).
  if (f?.cornice) {
    const id = f.cornice === 'heavy' || f.cornice === 'attic-frieze' ? 'kroonlijst' : f.cornice === 'bracketed' ? 'console-cornice' : 'row-cornice';
    if (id === 'row-cornice') extra.designCornice = f.cornice;
    if (!force.includes(id)) force.push(id);
  }
  if (f?.door && Number.isInteger(f.door.index) && f.door.of > f.door.index) extra.designDoor = { index: f.door.index, of: f.door.of };
  if (f?.door?.surround && !force.includes('door-surround')) force.push('door-surround');
  for (const id of f?.parts ?? []) if (!force.includes(id)) force.push(id);
  if (force.length) extra.registerForce = force;
  const wall = plan.wallM;
  if (plan.roof === 'flat') return { ...feature, properties: { ...rest, ...extra, height: wall, roofEavesHeightM: wall, roofPlanned: false, roofShape: 'flat' } };
  const shape = gableShape ?? PLOT_GABLE_SHAPE[plan.roof];
  if (shape) {
    // The planner's gable on this plot, its foot on the cornice line: plan it on a probe height, then stand it there.
    const probe = { ...feature, properties: { ...rest, height: wall + 6, roofPlanned: false, monumentGable: shape } };
    const g = roofPlanForFeature(probe as never);
    // Round 3: a read gable (its rise, foot width, offset and light) is the kit's row crown on the planner's saddle; a
    // narrower crown keeps its saddle low (its share of the front), so the cheeks beside it stay low roof, not wall.
    const gr = d.plot?.gable, W = d.toM - d.fromM;
    if (g && g.kind === 'gable' && gr) {
      // Belt review: a crown read's form (its shape and the kit's RowCrown parts) over the shape's stock form.
      const { shape: formShape, ...formParts } = gr.form ?? {};
      const foot = gr.widthM && gr.widthM < W - 0.3 ? gr.widthM : undefined, crownShape = formShape ?? (shape === 'plain' ? 'point' : shape === 'raisedNeck' ? 'neck' : shape);
      const riseM = +(gr.riseM ?? (crownShape === 'point' ? Math.min(5, POINT_GABLE_RISE_PER_M * (foot ?? W)) : g.riseM)).toFixed(2);
      const crown: RowCrown = { shape: crownShape as RowCrown['shape'], riseM, ...(foot ? { footW: foot } : {}), ...(foot && gr.offsetM ? { offsetM: gr.offsetM } : {}),
        attic: gr.window === 'none' ? 0 : 1, ...(gr.window === 'round' || gr.window === 'segmental' ? { atticHead: gr.window } : {}), ...(gr.belt ? { dress: 'belt' as const } : {}), ...formParts };
      return { ...feature, properties: { ...rest, ...extra, monumentGable: shape, height: +(wall + riseM).toFixed(3), roofEavesHeightM: wall, roofPlanned: true, roofShape: g.kind,
        rowCrown: crown, rowCrownRoofRiseM: foot ? +Math.min(rowCrownRoofRise(crown, W), riseM * foot / W).toFixed(3) : rowCrownRoofRise(crown, W), designPlot: { ...extra.designPlot as object, riseM } } };
    }
    if (g && g.kind === 'gable') return { ...feature, properties: { ...rest, ...extra, monumentGable: shape, height: +(wall + g.riseM).toFixed(3), roofEavesHeightM: wall, roofPlanned: true, roofShape: g.kind, designPlot: { ...extra.designPlot as object, riseM: g.riseM } } };
    // A plot the planner cannot gable (too narrow or ragged) keeps the row's dormer roof.
  }
  const dormers = plotDormers(d.toM - d.fromM, DORMER_FRONT_M, d.plot, plan.dormer, plan.hoist);
  // Inside: wall + rise is the measured top; on top: the roof storey stands over it.
  const rise = plan.riseM > 0.5 ? plan.riseM : EVIDENCE_HOIST_RISE_M, height = +(wall + rise).toFixed(3);
  return { ...feature, properties: { ...rest, ...extra, height, roofEavesHeightM: wall, roofPlanned: true, roofShape: 'mansardHip', roofDormer: true,
    rowRoof: { riseM: rise, material: f?.roofMaterial ?? roof.material, dormers, series: d.seed, tone: roof.tone, joins: d.solo ? {} : { left: true, right: true }, ...(plan.hoist ? { hoistOut: true } : {}), ...(d.solo && plan.roof === 'dormers' ? { shape: 'hipped' } : {}) } } };
}

/**
 * Belt review (2026-11-21): a one-plot draw a reviewed description states (`solo`, beltReview/plotRead.ts). Its plot plan
 * runs whatever the flag and year: the measured eaves is the cornice (a roof storey stands on it), a stated gable
 * (monumentGable, other than the cornice front) stands on the cornice line in its own shape, the read roof covering, cornice,
 * door, white parts and stone go through the same kit parts as a segment plot.
 */
function withSoloPlot<T extends Feature>(feature: T, d: DesignUnitDraw): T {
  const p = feature.properties;
  if (!p.facade || p.kitRoof) return feature;
  const top = typeof d.eavesM === 'number' && d.eavesM > 4 ? d.eavesM : Number(p.height);
  if (!(top > 4)) return feature;
  // The described crown wins over the register's gable (withMonumentGable ran before this step).
  const stated = d.gable !== undefined ? d.gable : typeof p.monumentGable === 'string' ? p.monumentGable : null;
  const gable = stated && stated !== 'cornice' ? stated : undefined;
  const { roofDormer: _dice, roofShapeTag: _tag, monumentGable: _g, roofPlanned: _planned, ...rest } = p;
  const plan = plotPlan(top, gable ? { ...d.plot, src: d.plot?.src ?? 'photo', roof: 'pointedGable' } : d.plot, { topIsCornice: true });
  const drawn = withPlotPlan(feature, rest, d, plan, segmentRoof(d.seed, String(p.facadeStyle ?? ''), null), gable);
  return { ...drawn, properties: { ...drawn.properties, ...soloDress(drawn.properties, d.plot, plan, !!gable) } };
}

/** A timber cornice's parts by the read cornice kind (houseSpec/row/types.ts RowCorniceDress, drawn by `row-cornice`). */
export const SOLO_CORNICE_DRESS: Readonly<Record<string, RowCorniceDress>> = {
  // Sizes from self-check pass 2 (2026-11-21): 19 majors "deep cornice drawn as a thin band" at the 1800s timber size.
  'attic-frieze': { supports: 'consoles', frieze: 'attic-lights', scale: 1.25 },
  heavy: { supports: 'consoles', frieze: 'plain', scale: 1.6 },
  bracketed: { supports: 'consoles', scale: 1.4 },
  frieze: { supports: 'modillions', frieze: 'panels', scale: 1.4 },
};
/** A simple cornice drawn as the timber cornice when the crown read states its parts (a centre, consoles, a frieze). */
export const SOLO_SIMPLE_DRESS: RowCorniceDress = { scale: 1 };
/** The wall band a timber cornice takes off the top storey (m): corona, bed moulding, architrave and its frieze (the storeys
 *  stop under it, so the top windows keep their heads under the frieze). facadeOrnaments.ts ROW_TIMBER_CORNICE. */
export function soloCorniceBandM(dress: RowCorniceDress): number {
  // A measured deep cornice (cornice lane): its whole zone.
  if (dress.profile && dress.profile.depthM > 0) return +dress.profile.depthM.toFixed(2);
  const K = { corona: 0.2, bed: 0.16, architrave: 0.1, frieze: { plain: 0.55, panels: 0.65, 'attic-lights': 0.85, oculi: 0.85 } } as const;
  return +((dress.scale ?? 1) * (K.corona + K.bed + (dress.frieze ? K.architrave + K.frieze[dress.frieze] : dress.supports === 'consoles' ? 0.45 : 0))).toFixed(2);
}
/** A simple cornice measured at least this deep (m) has a frieze under it (Herengracht 24: "deep cream cornice with a tall
 *  plain frieze board", drawn as a thin band): the timber cornice with a plain frieze. */
export const SOLO_DEEP_SIMPLE_M = 0.9;
export const SOLO_DEEP_SIMPLE_DRESS: RowCorniceDress = { frieze: 'plain', scale: 1 };
/** The scale a measured cornice depth may set on the timber cornice (its stock depths run 0.36-1.31 m at scale 1). */
export const SOLO_CORNICE_SCALE = { min: 0.8, max: 3.2 } as const;
/**
 * A timber cornice at the measured depth (bar-fixes 2026-11-21: 14 majors "deep cornice drawn as a thin band", the crops'
 * cornice zones 0.09-0.21 of the front, 1.3-3.6 m, against 1.0-1.8 m drawn): the scale that makes its band the depth,
 * within SOLO_CORNICE_SCALE. Unmeasured: the dress as it was.
 */
export function soloDressAtDepth(dress: RowCorniceDress, depthM: number | undefined): RowCorniceDress {
  // A measured deep cornice (cornice lane) is drawn at the measured depth, else at the timber cornice's band; its timber
  // parts (the centre's mouldings) keep the scale the depth sets.
  if (dress.profile) {
    const { profile, ...timber } = dress, at = soloDressAtDepth(timber, depthM);
    const d = typeof depthM === 'number' && depthM > 0 ? depthM : soloCorniceBandM(at);
    return { ...at, profile: { ...profile, depthM: +d.toFixed(2) } };
  }
  if (!(typeof depthM === 'number' && depthM > 0)) return dress;
  const unit = soloCorniceBandM({ ...dress, scale: 1 });
  if (!(unit > 0)) return dress;
  const scale = +Math.min(SOLO_CORNICE_SCALE.max, Math.max(SOLO_CORNICE_SCALE.min, depthM / unit)).toFixed(2);
  return { ...dress, scale };
}
/** White frames as the belt read paints them (the sash bars and frames, the texture's accent channel); dark otherwise. */
export const SOLO_FRAME_HEX = { white: '#f1efe8', dark: '#2b302c' } as const;

/**
 * Belt review only (`solo`): the read parts the segment plot plan does not carry. The measured storey profile
 * (`designStoreys.shares`), the frame paint (`designFrameHex`: the bay texture's painted frames and bars take it, so a
 * read of white frames is not drawn with the dice's green sashes), and the read cornice as a timber cornice of the kit's
 * `row-cornice` (consoles, a plain or attic-light frieze) in place of the slim kroonlijst, with its band off the top
 * storey (`designCorniceDress`, `designCorniceBandM`). A gable front keeps its gable.
 */
function soloDress(props: Record<string, unknown>, f: DesignUnitDraw['plot'], plan: PlotPlan, gabled: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = { designSolo: true };
  const shares = f?.storeyShares;
  if (shares && shares.length === plan.storeys && shares.every(x => Number.isFinite(x) && x > 0)) out.designStoreys = { ...(props.designStoreys as object), shares: [...shares] };
  if (typeof f?.whiteFrames === 'boolean') out.designFrameHex = f.whiteFrames ? SOLO_FRAME_HEX.white : SOLO_FRAME_HEX.dark;
  const kind = f?.attic && f.cornice !== 'attic-frieze' ? 'attic-frieze' : f?.cornice;
  // A crown read's cornice parts over the kind's own (a simple cornice takes the timber cornice when it states any).
  const cform = f?.corniceForm && Object.keys(f.corniceForm).length ? f.corniceForm : undefined;
  // A measured cornice zone deep enough for a frieze draws a simple cornice as the timber cornice with a plain frieze.
  const deep = (f?.corniceDepthM ?? 0) >= SOLO_DEEP_SIMPLE_M;
  const base = kind ? SOLO_CORNICE_DRESS[kind] ?? (cform ? SOLO_SIMPLE_DRESS : deep ? SOLO_DEEP_SIMPLE_DRESS : undefined) : undefined;
  // A measured share of an unusable survey eaves is that share of the drawn top (cornice lane).
  const depthM = f?.corniceDepthM ?? (f?.corniceShare ? +(f.corniceShare * plan.wallM).toFixed(2) : undefined);
  const dress = !gabled && base ? soloDressAtDepth(cform ? { ...base, ...cform } : base, depthM) : undefined;
  // The ground openings as measured, and the street door in a doorcase (a stone case when read dressed, else the belt's
  // white timber frame; a fanlight when read; the belt's near-black leaf).
  if (f?.groundOpenings && plan.ground !== 'shop') out.designGround = { ...f.groundOpenings };
  const forcedB = (props.registerForce as string[] | undefined) ?? [];
  // A measured basement band draws as the solo basement (not the register's stone plinth band over it).
  const basementForce = out.designGround && (out.designGround as { basementRatio?: number }).basementRatio ? ['solo-basement'] : [];
  const forced = Array.isArray(props.registerForce) ? [...forcedB.filter(id => !basementForce.length || id !== 'stone-plinth-band'), ...basementForce] : [...basementForce];
  if (basementForce.length) out.registerForce = forced;
  // Kit-ground lane: the ground storey's own front as measured (its openings, facing, band, street tier, door) and a flat
  // crown in place of the cornice (soloGround.ts); absent, nothing below changes.
  const gf = plan.ground !== 'shop' ? f?.groundFront : undefined;
  if (gf?.openings?.length || (gf && out.designGround)) out.designGround = { ...(f?.groundOpenings ?? SOLO_FRONT_RATIOS), front: gf };
  if (gf?.face || gf?.band || gf?.tier) {
    // The facing is the ground's dress: the register's stucco plinth bands and full-height corner pilasters stay off it.
    // The read put its pilasters in the ground storey (12, 20, 70, 86), not up the front.
    const drop = gf.face ? ['rusticated-plinth', 'corner-pilasters'] : ['corner-pilasters'];
    const kept = forced.filter(id => !drop.includes(id));
    forced.length = 0; forced.push(...kept, ...(gf.face || gf.band ? ['solo-ground-face'] : []), ...(gf.tier ? ['solo-ground-tier'] : []));
    out.registerForce = forced;
  }
  if (f?.flatCrown) {
    out.designFlatCrown = f.flatCrown;
    const kept = forced.filter(id => id !== 'kroonlijst' && id !== 'console-cornice' && id !== 'row-cornice');
    forced.length = 0; forced.push(...kept, 'flat-crown');
    out.registerForce = forced;
  }
  // A read ground front whose openings hold no door (the doors are in its street tier): no doorcase over a window.
  const doorless = !!gf?.openings?.length && !gf.openings.some(o => o.kind === 'door');
  if (doorless) { const k = forced.indexOf('door-surround'); if (k >= 0) { forced.splice(k, 1); out.registerForce = forced; } }
  if (f?.door && plan.ground !== 'shop' && !doorless) {
    out.designDoorcase = { material: f.door.surround ? 'stone' : 'timber', fanlight: !!f.door.fanlight, door: 'black', ...(gf?.door ? soloDoorRead(gf.door) : {}) };
    if (!forced.includes('row-doorcase')) forced.push('row-doorcase');
    // The doorcase is the door's frame (the same group): the register's surround would draw first, with a white leaf.
    const k = forced.indexOf('door-surround'); if (k >= 0) forced.splice(k, 1);
    out.registerForce = forced;
  }
  if (dress) {
    out.designCorniceDress = dress;
    out.designCorniceBandM = soloCorniceBandM(dress);
    out.designCornice = 'heavy';
    const force = forced.filter(id => id !== 'kroonlijst' && id !== 'console-cornice');
    out.registerForce = force.includes('row-cornice') ? force : [...force, 'row-cornice'];
  }
  return out;
}

/** The ground ratios a read ground front stands on when the self-check measured none (only its openings are drawn). */
export const SOLO_FRONT_RATIOS = { windowRatio: 1.2, doorRatio: 0.8 } as const;
/** A read street door (soloGround.ts GroundDoorRead) as the doorcase's parts (houseSpec/row/types.ts RowDoorcase). */
export function soloDoorRead(d: GroundDoorRead): Partial<RowDoorcase> {
  return { ...(d.fanlight ? { fanlight: d.fanlight === 'none' ? false : d.fanlight === 'plain' ? true : d.fanlight } : {}), ...(d.leaves ? { leaves: d.leaves } : {}),
    ...(d.fanShare ? { fanShare: d.fanShare } : {}), ...(d.case === 'frame' ? { bare: true as const } : {}), ...(d.top ? { top: d.top } : {}), ...(d.leaf ? { door: d.leaf } : {}) };
}

/** Step 2 (after withRowFront, before decorateRoof): the segment's one roof on this member, its front at the line. */
export function withDesignUnitRoof<T extends Feature>(feature: T): T {
  const p = feature.properties, d = designUnitOf(p);
  if (d?.solo) return withSoloPlot(feature, d);
  if (!d || d.eavesM === null || !(d.eavesM > 4) || !designUnitsOn()) return feature;
  if (!p.facade || p.rowFront || p.roofPlanned || typeof p.monumentGable === 'string' || p.kitRoof) return feature;
  const roof = segmentRoof(d.seed, String(p.facadeStyle ?? ''), d.roofRiseM), top = d.plotEavesM ?? d.eavesM;
  const { roofDormer: _dice, roofShapeTag: _tag, ...rest } = p;
  // Photo evidence of a roof storey inside the measured top (EVIDENCE_ROOF_RISE_M): the cornice drops, the top stays.
  const ev = d.roofEvidence;
  // A short slope behind the cornice for a hoist-dormer row or a dormer-form read/default; a full mansard otherwise.
  const rise = ev?.hoist || ev?.form === 'dormers' ? EVIDENCE_HOIST_RISE_M : EVIDENCE_ROOF_RISE_M;
  const style = String(p.facadeStyle ?? ''), lateStyle = style === 'postwar' || style === 'modern' || style === 'tower';
  // 2026-11-21: a 1860-1939 plot draws its plot plan (plotPlan.ts): its storey count, its cornice, its own roof element.
  if (!lateStyle && typeof d.year === 'number' && d.year >= PLOT_PLAN_YEARS.from && d.year <= PLOT_PLAN_YEARS.to && top > 6) {
    const plan = plotPlan(top, d.plot, { ...(ev ? { storey: ev.storey, ...(ev.dormer ? { dormer: ev.dormer } : {}), ...(ev.hoist ? { hoist: true } : {}), ...(ev.form ? { form: ev.form } : {}), ...(ev.roofSource ? { roofSource: ev.roofSource } : {}) } : {}), ahnRiseM: d.roofRiseM ?? null });
    return withPlotPlan(feature, rest, d, plan, roof);
  }
  if (roof.kind === 'flat' && ev?.storey && !lateStyle && top - rise >= 6) {
    const n = Math.max(1, Math.round((d.toM - d.fromM) / DORMER_FRONT_M));
    const dormers = Array.from({ length: n }, (_, i) => ({ a: +((i + 0.5) / n).toFixed(3), kind: ev.dormer ?? 'pediment', ...(ev.hoist ? { hoist: true } : {}) }));
    return { ...feature, properties: { ...rest, height: top, roofEavesHeightM: +(top - rise).toFixed(3), roofPlanned: true, roofShape: 'mansardHip', roofDormer: true,
      rowRoof: { riseM: rise, material: roof.material, dormers, series: d.seed, tone: roof.tone, joins: { left: true, right: true } } } };
  }
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
