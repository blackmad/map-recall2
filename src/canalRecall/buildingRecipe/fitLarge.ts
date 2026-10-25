/**
 * `kind: large` fit: intent + facts → `LargeBuildingRecipe` (a block-kit surface set and spec plus per-wall-group
 * component placements). Deterministic; every metre comes from the facts:
 *
 * - massing: the 3DBAG LoD2.2 walls and roofs verbatim (local metres, X east, Z south, Y up from `b3_h_maaiveld`);
 * - wall groups: the intent lists 3DBAG wall-surface indices; a block-kit panel (coplanar, edge-connected surfaces)
 *   takes the group holding most of its surfaces, unlisted panels take `otherWalls` (default blank);
 * - storeys: the group's widest ground-touching panel sets the eaves (highest line where the wall still spans 85% of
 *   its width); storey count from the intent, else the civic default (4.2 m before 1945, 3.6 m after); a shop or
 *   glazed ground floor is 1.25 storeys, a pre-1945 one 1.15; flat-topped walls keep 0.5 m of parapet;
 * - bays: `baysPerStorey` across the widest panel, else the system's default pitch; other panels share that pitch;
 * - entrance on the widest panel's middle bay (or `entrance.bay`), garage doors from its right end;
 * - roof plant: a lift overrun and a plant box at the most interior points of the largest flat roof.
 */
import {ROOF_COLOURS} from './fit.ts';
import type {BuildingFacts} from './facts.ts';
import {swatch, type LargeBuildingIntent, type LargeWallIntent, type RoofMaterial} from './intent.ts';
import {buildHost, insidePanel, pointInRing, type Panel} from '../blockBuilding/panels.ts';
import {MeshBuilder} from '../blockBuilding/mesh.ts';
import type {P3, SurfaceSet} from '../blockBuilding/types.ts';
import type {BlockSpec, System} from '../blockBuilding/spec.ts';
import {ARCADE_PROPORTIONS, DEFAULT_PITCH_M, largeSystem, LOGGIA, PLINTH, SOUTERRAIN, type ArcadeFit, type LargeGround, type LargeSystemName} from '../blockBuilding/systems.ts';
import {panelRuns, runBayAxes} from '../blockBuilding/curve.ts';
import type {Lantern} from '../blockBuilding/components.ts';
import {MESH_SCREEN} from '../blockBuilding/components.ts';
import {CLADDING, PANEL_ROW_M, claddingHeights, type CladdingFit} from '../blockBuilding/cladding.ts';
import {fitArcadePiers, type ArcadePiersFit} from '../blockBuilding/arcadePiers.ts';
import {fitWindowBox, type WindowBoxFit} from '../blockBuilding/windowBox.ts';
import type {SignBoardFit} from '../blockBuilding/signBoards.ts';
import {fitGallery, type GalleryFit} from '../blockBuilding/gallery.ts';
import type {StoneDressings} from '../blockBuilding/dressings.ts';
import {roofHeightAt} from './facts.ts';
import {prepareShell, strictMergeClasses, type ShellRepairReport} from './shellRepair.ts';
import {levelRoofAbove, rooftopLevel, type RoofLevelReport} from './roofLevel.ts';
import {houseCuts, rowCoherence, spanEaves, spanTop} from './rowSplit.ts';

/** The kit's dark glass, when the intent has no (measured) `palette.glass`. */
export const KIT_GLASS = '#2a3a42';

/** A split fraction of a panel snapped to the nearest bay boundary (bays of ~`pitchM` filling the panel; never the ends). */
export function splitAtBay(uMin: number, uMax: number, pitchM: number, at: number): number {
  const W = uMax - uMin, n = Math.max(2, Math.round(W / Math.max(0.5, pitchM))), k = Math.max(1, Math.min(n - 1, Math.round(at * n)));
  return r3(uMin + k / n * W);
}
/** Window reveal depth (m) for the large tier. */
export const LARGE_RECESS_M = 0.18;
export const CROSS_SIZE_M = {small: 1.4, medium: 2.2, large: 3.2} as const;
export const CIVIC_STOREY_M = {pre1945: 4.2, post1945: 3.6};
/** Default tint of a `render` wall group without its own palette colour. */
export const RENDER_WHITE = '#f1eee6';

export interface PlantBox { centre: [number, number]; baseY: number; size: [number, number, number]; angleRad: number; kind: 'lift-overrun' | 'plant' }
export interface LargeGroupFit {
  index: number; system: LargeSystemName; specSystem: string;
  panels: number[]; surfaces: number[]; mainPanel: number | null; bearingDeg: number | null;
  widthM: number; eavesM: number; flatTop: boolean; storeys: number; storeyHeightsM: number[]; lines: number[];
  bays: number; pitchM: number; ground: LargeGround; cornice: boolean; deepBars?: boolean;
  /** second wall colour right of `uM` on the main panel (intent `wallSplit`, at a bay boundary; slot `wall@g<i>/r`) */
  split?: {panel: number; uM: number; slot: string};
  /** perforated-brick screen lattice over the group's walls */
  screen?: boolean;
  /** layered curtain wall: opaque spandrel panels (fractions of an upper storey over each floor line and under the next) in `slot` */
  spandrels?: {sill: number; head: number; slot: string};
  /** layered screen panels over the wall on `storeys` (intent `meshScreen`): `from`..`to` of each storey, panels `joint` m apart, in `slot` */
  meshScreen?: {storeys: number[]; from: number; to: number; joint: number; slot: string};
  /** mesh plinth panel slot when the group colours it (palette.plinth); default the door slot */
  plinthSlot?: string;
  entrance: {panel: number; bay: number; storeys: number; canopy: boolean; portal?: boolean} | null;
  /** storeys faced in stone, banded end pilasters (with the darker band slot) */
  stoneStoreys?: number[]; pilasters?: string;
  /** storeys faced in another brick colour (`painted@g<i>s<k>` slots, the brick texture) */
  brickStoreys?: {storeys: number[]; slot: string}[];
  /** stone dressings (intent `dressings`, drawn by blockBuilding/dressings.ts) and their slot: the group's stone, or `dress@g<i>` in `dressings.colour` */
  dressings?: StoneDressings & {slot: string};
  garage: {panel: number; bays: number[]} | null;
  signage: {text: string; colour: string; mount: 'fascia' | 'wall' | 'glazing' | 'canopy' | 'cornice'; along?: [number, number]} | null;
  police: {stripe: boolean; lamp: boolean} | null;
  /** loading-door axis (bay % every === first) and the name boards over its ground portals on the main panel */
  hoist?: {every: number; first: number} | {bays: number[]};
  nameBoards?: string[];
  /** St Andrew's crosses stacked down a top corner of the main panel (slot `cross@g<index>`) */
  crosses?: {count: number; sizeM: number; side: 'left' | 'right'};
  /** `curve`: the linked facet runs carrying one bay rhythm (panel indices left to right, arc length, turn, bays) */
  curve?: {panels: number[]; lengthM: number; turnDeg: number; bays: number}[];
  slots: {wall: string; frame: string; stone: string; glass: string; door: string; curtain: string; sign: string};
  /** glazed-hall: brick base top (m) and the mullion grid (lights per bay, rows) */
  hall?: {baseM: number; lights: number; rows: number};
  /** glazed-columns: glass stripes over these bays (cycling per `bays`) from storey `from` */
  columns?: {bays: number[]; share: number; from: number; slabs: boolean; glass?: string};
  /** ground `arcade`: the fitted opening measures and whether the lintel band and pier facings are drawn */
  arcade?: ArcadeFit & {facing: boolean};
  /** loggias: the deepest loggia's back plane behind the wall face (m), so the likeness elevation sees its glazing */
  loggiaDepthM?: number;
  /** row split (intent `houses`): the main panel cut into houses, each with its own spec system, wall slot, eaves and crown */
  houses?: {panel: number; segs: LargeHouseFit[]};
  /** facade cladding (intent `cladding`, blockBuilding/cladding.ts): heights, profile and its sheet and line slots */
  cladding?: CladdingFit;
  /** free-standing piers and beam over a storey band on their own pitch (intent `arcadePiers`, blockBuilding/arcadePiers.ts), in the group's stone */
  arcadePiers?: ArcadePiersFit;
  /** a projecting glazed window box over a span of bays on one storey (intent `windowBox`, blockBuilding/windowBox.ts) */
  windowBox?: WindowBoxFit;
  /** flat sign boards on the main panel (intent `signBoards`, blockBuilding/signBoards.ts) */
  signBoards?: SignBoardFit[];
  /** a false front over the panels whose top rises above their eaves (intent `falseFront`), in this slot */
  falseFront?: {slot: string};
  /** open galleries (verandas) over a span of bays of the main panel (intent `gallery`, blockBuilding/gallery.ts), one entry per gallery */
  gallery?: GalleryFit[];
  /** mansard storeys and their slate-textured slot */
  mansard?: {storeys: number[]; slot: string};
}
/** One house of a row split on the main panel (u in panel metres; bays numbered from `bayOffset` across the row). */
export interface LargeHouseFit {
  u0: number; u1: number; system: string; slot: string; eavesM: number; topM: number; storeys: number; lines: number[]; bays: number; bayOffset: number; pitchM: number;
  crown: 'cornice' | 'flat' | 'gable';
  /** the 3DBAG eaves when row coherence clamped it to the row line */
  clampedFromM?: number;
}
export interface LargeBuildingRecipe {
  id: string; pandId: string; anchorRD: [number, number]; set: SurfaceSet; spec: BlockSpec;
  /** group index per panel (`-1` = otherWalls) */
  panelGroup: number[];
  /** group index per `set.walls` entry: the compose `mergeKey`, so panels never span two groups (with `shellRepair`, (group + 1) * 100000 + strict coplanar class) */
  wallGroup: number[];
  groups: LargeGroupFit[]; other: {system: LargeSystemName; specSystem: string};
  roofPlant: PlantBox[]; recessM: number;
  roof: LargeRoofFit;
  wallMaterial: 'brick' | 'stucco';
  /** per-panel spec system replacing the group's (curved runs: bay axes along the arc); only present when a group opts in */
  panelSystem?: Record<number, string>;
  /** roof lanterns (`walls[].lantern`), local metres; only present when a group asks for one */
  lanterns?: Lantern[];
  /** recipe material slot per block-kit wall slot of a group with its own `wallMaterial` (only present when a group sets one) */
  slotMaterial?: Record<string, string>;
  /**
   * block-kit slots whose colour was measured from the photo (intent `measured.groups`: the group's own wall, glass,
   * wall-split and arch-ring slots): exported with `tintSource: "measured"` so the city look draws them as is; only present
   * when the intent is measured
   */
  measuredSlots?: string[];
}
export interface LargeFitReport {
  groups: {index: number; system: string; panels: number; surfaces: number; widthM: number; eavesM: number; storeys: number; storeyHeightsM: number[]; bays: number; pitchM: number; entrance: boolean; garageDoors: number}[];
  panels: {index: number; group: number; system: string; widthM: number; heightM: number; bearingDeg: number; surfaces: number[]}[];
  unlistedSurfaces: number[];
  warnings: string[];
  /** only with `shellRepair` / `footprint: "bag"` (shellRepair.ts) */
  shellRepair?: ShellRepairReport;
  /** only with `roof.levelRooftop` (roofLevel.ts) */
  roofLevel?: RoofLevelReport;
}

/**
 * The roof's materials: `material` by default; `flat` for the default's flat class; `regions` = the intent's
 * `roof.surfaces`, each 3DBAG roof plane as its local plan rings (X east, Z south) and height range, so a roof triangle
 * is matched to the plane it was cut from (largeCompile `roofMaterialOf`). `flat` and `regions` only when the intent sets them.
 */
export interface LargeRoofFit {
  material: RoofMaterial;
  flat?: RoofMaterial;
  /** measured colour of the flat class outside `regions` (intent `roof.flatHex`), lower case */
  flatHex?: string;
  /** measured colour of the default material's steep and low classes (intent `roof.pitchedHex`), lower case */
  pitchedHex?: string;
  regions?: {material: RoofMaterial; surface: number; rings: [number, number][][]; yMin: number; yMax: number}[];
}

/** Intent `roof` → `LargeRoofFit`; every listed surface must be a roof plane of the facts. */
export function largeRoofFit(roof: LargeBuildingIntent['roof'], facts: BuildingFacts, anchorRD: [number, number]): LargeRoofFit {
  const fit: LargeRoofFit = {material: roof?.material ?? 'bitumen'};
  if (roof?.flat) fit.flat = roof.flat;
  if (roof?.flatHex) fit.flatHex = roof.flatHex.toLowerCase();
  if (roof?.pitchedHex) fit.pitchedHex = roof.pitchedHex.toLowerCase();
  if (!roof?.surfaces?.length) return fit;
  const [ax, ay] = anchorRD, g = facts.heights.groundNAP;
  const byNumber = new Map(facts.roofsRD.map(r => [Number(r.surfaceId.split(':').at(-1)), r]));
  fit.regions = roof.surfaces.flatMap(s => s.roofSurfaces.map(n => {
    const r = byNumber.get(n);
    if (!r) throw Error(`${facts.pandId}: roof.surfaces lists ${n}, not a 3DBAG roof surface of this pand (roof-dump.ts --surfaces)`);
    const ys = r.ringsRD[0].map(p => p[2] - g);
    return {material: s.material, surface: n, rings: r.ringsRD.map(ring => ring.map(p => [r3(p[0] - ax), r3(ay - p[1])] as [number, number])), yMin: r3(Math.min(...ys)), yMax: r3(Math.max(...ys))};
  }));
  return fit;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** #rrggbb scaled by k (k < 1 darker). */
const shade = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
export const bearingOfNormal = (n: number[]) => (Math.atan2(n[0], -n[2]) * 180 / Math.PI + 360) % 360;

/**
 * 3DBAG facts → block-kit surface set in local metres around the BAG footprint centroid. `groundClamp` (intent opt-in):
 * wall and roof vertices under the 3DBAG ground are lifted to it and faces left lying on the ground dropped (De Hallen's
 * LoD2.2 has a sunken ramp, roofs and walls 0.4-0.8 m into the ground, which the GLB audit fails as below-ground).
 */
export function largeSurfaceSet(facts: BuildingFacts, opts: {groundClamp?: boolean} = {}): {set: SurfaceSet; anchorRD: [number, number]} {
  if (!facts.wallsRD?.length) throw Error(`${facts.pandId}: facts have no wallsRD; rerun facts.ts with --large`);
  const all = facts.bagFootprintRD.flat(), g = facts.heights.groundNAP;
  const anchorRD: [number, number] = [Math.round(all.reduce((s, p) => s + p[0], 0) / all.length * 100) / 100, Math.round(all.reduce((s, p) => s + p[1], 0) / all.length * 100) / 100];
  const [ax, ay] = anchorRD, loc = (p: number[]): P3 => [r3(p[0] - ax), r3(p[2] - g), r3(ay - p[1])];
  const set: SurfaceSet = {
    pandId: facts.pandId, anchor: anchorRD, groundNap: g, heightMax: facts.heights.roofMaxM, constructionYear: facts.heights.builtYear,
    walls: !opts.groundClamp ? facts.wallsRD.map(w => ({rings: w.ringsRD.map(r => r.map(loc)), onFootprintEdge: w.onFootprintEdge, surface: w.surface}))
      : facts.wallsRD.map(w => ({rings: w.ringsRD.map(r => r.map(loc).map(([x, y, z]): P3 => [x, Math.max(0, y), z])), onFootprintEdge: w.onFootprintEdge, surface: w.surface}))
        .filter(w => w.rings[0].some(p => p[1] > 0.01)),
    roofs: !opts.groundClamp ? facts.roofsRD.map(r => ({rings: r.ringsRD.map(ring => ring.map(loc)), slopeDeg: r.slopeDeg}))
      : facts.roofsRD.map(r => ({rings: r.ringsRD.map(ring => ring.map(loc).map(([x, y, z]): P3 => [x, Math.max(0, y), z])), slopeDeg: r.slopeDeg}))
        .filter(r => r.rings[0].some(p => p[1] > 0.01)),
    ground: facts.surveyFootprintPolygonsRD.map(poly => ({rings: poly.map(ring => ring.map(p => [r3(p[0] - ax), 0, r3(ay - p[1])] as P3))})),
    neighbours: (facts.neighboursRD ?? []).map(n => ({id: n.id, height: n.heightM, ring: n.ringRD.map(p => [r3(p[0] - ax), r3(ay - p[1])] as [number, number])})),
  };
  return {set, anchorRD};
}

/** Highest height at which the panel still spans 85% of its width (gable walls: the eaves, not the apex). */
export function panelEaves(p: Panel): number {
  const W = p.uMax - p.uMin;
  for (let v = p.vMax - 0.05; v > p.vMin + 0.5; v -= 0.1) {
    let hit = 0;
    for (let k = 0; k < 40; k++) if (insidePanel(p, [p.uMin + W * (k + 0.5) / 40, v])) hit++;
    if (hit >= 34) return Math.min(p.vMax, v + 0.05);
  }
  return p.vMax;
}

/** Storey lines: N storeys under `eaves` (ground storey `gw` units tall), then the same unit up to `maxTop`. */
export function storeyLines(eaves: number, flatTop: boolean, storeys: number | undefined, civicM: number, gw: number, maxTop: number, parapetM?: number, weights?: Record<number, number>) {
  const parapet = parapetM ?? (flatTop ? 0.5 : 0.15), usable = Math.max(2.5, eaves - parapet);
  if (weights && Object.keys(weights).length) return weightedLines(usable, storeys, civicM, gw, maxTop, weights);
  const n = storeys ?? Math.max(1, Math.round(usable / civicM - (gw - 1)));
  const unit = usable / (n - 1 + gw), ground = unit * gw;
  const lines = [0, ground];
  for (let k = 1; k < n; k++) lines.push(ground + unit * k);
  // The last entry is the wall top (compose drops it and closes the top floor at the panel's own top).
  while (lines[lines.length - 1] + unit < maxTop - 1.0) lines.push(lines[lines.length - 1] + unit);
  lines.push(Math.max(maxTop, lines[lines.length - 1] + 0.01));
  return {lines: lines.map(r3), storeys: n, heights: [ground, ...Array(n - 1).fill(unit)].map(r3)};
}

/**
 * Storey lines with some upper storeys `weights[k]` units tall (a glazed plinth storey over the ground, intent
 * `plinth.factor`): N storeys under the usable height, the ground `gw` units, storey k `weights[k]` (default 1).
 */
function weightedLines(usable: number, storeys: number | undefined, civicM: number, gw: number, maxTop: number, weights: Record<number, number>) {
  const extra = Object.entries(weights).reduce((a, [, v]) => a + (v - 1), 0);
  const n = storeys ?? Math.max(1, Math.round(usable / civicM - (gw - 1) - extra));
  const wt = (k: number) => (k === 0 ? gw : weights[k] ?? 1);
  let sum = 0;
  for (let k = 0; k < n; k++) sum += wt(k);
  const unit = usable / sum, heights = Array.from({length: n}, (_, k) => unit * wt(k)), lines = [0];
  for (const h of heights) lines.push(lines[lines.length - 1] + h);
  while (lines[lines.length - 1] + unit < maxTop - 1.0) lines.push(lines[lines.length - 1] + unit);
  lines.push(Math.max(maxTop, lines[lines.length - 1] + 0.01));
  return {lines: lines.map(r3), storeys: n, heights: heights.map(r3)};
}

/** Another group's storey lines, re-closed at this group's top (more storeys at the same height where it is taller). */
export function alignLines(ref: ReturnType<typeof storeyLines>, maxTop: number): ReturnType<typeof storeyLines> {
  const lines = ref.lines.slice(0, ref.storeys + 1), unit = ref.heights[ref.heights.length - 1] ?? ref.heights[0];
  while (lines[lines.length - 1] + unit < maxTop - 1.0) lines.push(r3(lines[lines.length - 1] + unit));
  lines.push(Math.max(maxTop, lines[lines.length - 1] + 0.01));
  return {lines: lines.map(r3), storeys: ref.storeys, heights: ref.heights};
}

function polyArea(ring: number[][]) { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function segDist(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Lift overrun at the most interior point of the largest flat roof, a plant box at the next one >= 4 m away. */
export function placeRoofPlant(set: SurfaceSet): PlantBox[] {
  const flats = set.roofs.map(r => ({r, ring: r.rings[0].map(p => [p[0], p[2]]), holes: r.rings.slice(1).map(h => h.map(p => [p[0], p[2]])), y: Math.max(...r.rings[0].map(p => p[1]))}))
    .filter(f => f.r.slopeDeg < 5 && polyArea(f.ring) >= 40).sort((a, b) => polyArea(b.ring) - polyArea(a.ring) || b.y - a.y);
  const best = flats[0]; if (!best) return [];
  const rings = [best.ring, ...best.holes];
  let longest = 0, angle = 0;
  best.ring.forEach((p, i) => { const q = best.ring[(i + 1) % best.ring.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > longest) { longest = l; angle = Math.atan2(q[1] - p[1], q[0] - p[0]); } });
  const xs = best.ring.map(p => p[0]), zs = best.ring.map(p => p[1]), cand: {p: [number, number]; d: number}[] = [];
  for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) for (let z = Math.min(...zs) + 0.25; z < Math.max(...zs); z += 0.5) {
    const p: [number, number] = [r3(x), r3(z)];
    if (!pointInRing(p, best.ring as [number, number][]) || best.holes.some(h => pointInRing(p, h as [number, number][]))) continue;
    cand.push({p, d: Math.min(...rings.flatMap(r => r.map((a, i) => segDist(p, a, r[(i + 1) % r.length]))))});
  }
  cand.sort((a, b) => b.d - a.d || a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  const out: PlantBox[] = [];
  const lift = cand.find(c => c.d >= 2.4);
  if (lift) out.push({centre: lift.p, baseY: best.y, size: [2.6, 2.4, 2.2], angleRad: angle, kind: 'lift-overrun'});
  const plant = cand.find(c => c.d >= 2.0 && (!lift || Math.hypot(c.p[0] - lift.p[0], c.p[1] - lift.p[1]) >= 4.5));
  if (plant) out.push({centre: plant.p, baseY: best.y, size: [3.2, 1.6, 1.3], angleRad: angle, kind: 'plant'});
  return out;
}

const SYSTEM_SLOT = (k: number | 'o') => `g${k}`;

/** Roof lantern size (m, square) and how far it rises over the highest roof point under it. */
export const LANTERN = {sizeM: 2.4, riseM: 3.0};
/**
 * Lantern behind a wall panel: walk inward from the panel's middle (0.25 m steps, up to 30 m) over the 3DBAG roofs and
 * centre the lantern on the highest roof point, on the panel's axes; its base at the lowest roof point under its
 * corners (so it sits in a pitched roof), its top `riseM` over the highest.
 */
export function placeLantern(facts: BuildingFacts, anchorRD: [number, number], p: Panel): Lantern | null {
  const [ax, ay] = anchorRD, g = facts.heights.groundNAP, um = (p.uMin + p.uMax) / 2;
  const at = (u: number, d: number): [number, number] => [p.o[0] + p.r[0] * u + p.n[0] * d, p.o[2] + p.r[2] * u + p.n[2] * d];
  const roof = ([x, z]: [number, number]) => roofHeightAt(facts.roofsRD, [ax + x, ay - z], g);
  let best: {d: number; h: number} | null = null;
  for (let d = -0.5; d >= -30; d -= 0.25) { const h = roof(at(um, d)); if (h !== null && (!best || h > best.h + 1e-6)) best = {d, h}; }
  if (!best) return null;
  const s = LANTERN.sizeM / 2, corners: [number, number][] = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([du, dd]) => at(um + du, best!.d + dd));
  const hs = corners.map(roof).filter((h): h is number => h !== null);
  if (hs.length < 4) return null;
  const c = at(um, best.d);
  return {centre: [r3(c[0]), r3(c[1])], baseY: r3(Math.min(...hs) - 0.1), topY: r3(Math.max(best.h, ...hs) + LANTERN.riseM), size: LANTERN.sizeM, angleRad: +Math.atan2(p.r[2], p.r[0]).toFixed(6)};
}

/** The facts the fit works on: the shell-repaired facts when the intent opts in (shellRepair.ts), else the input. */
export function largeShellFacts(intent: LargeBuildingIntent, facts: BuildingFacts): {facts: BuildingFacts; shell?: ShellRepairReport; roofLevel?: RoofLevelReport} {
  const shelled: {facts: BuildingFacts; shell?: ShellRepairReport} = !intent.shellRepair && intent.footprint !== 'bag' ? {facts}
    : (r => ({facts: r.facts, shell: r.report}))(prepareShell(facts, {repair: !!intent.shellRepair, footprint: intent.footprint ?? 'lod22'}));
  if (!intent.roof?.levelRooftop) return shelled;
  // roof.levelRooftop (roofLevel.ts): the rooftop above the photographed fronts becomes one flat level, after any shell repair
  const levelled = levelRoofAbove(shelled.facts, rooftopLevel(shelled.facts, intent.walls.flatMap(w => w.wallSurfaces)));
  return {...shelled, facts: levelled.facts, roofLevel: levelled.report};
}

export function fitLarge(intent: LargeBuildingIntent, inputFacts: BuildingFacts): {recipe: LargeBuildingRecipe; report: LargeFitReport; facts: BuildingFacts} {
  const {facts, shell, roofLevel} = largeShellFacts(intent, inputFacts);
  const warnings: string[] = [];
  const {set, anchorRD} = largeSurfaceSet(facts, intent.groundClamp ? {groundClamp: true} : {});
  const known = new Set(set.walls.map(w => w.surface!));
  const groupOfSurface = new Map<number, number>();
  intent.walls.forEach((w, gi) => w.wallSurfaces.forEach(s => {
    if (!known.has(s)) throw Error(`${intent.id}: walls[${gi}] lists surface ${s}, which is not a LoD2.2 wall of pand ${facts.pandId} (see scripts/building-recipes/walls.ts)`);
    groupOfSurface.set(s, gi);
  }));
  // Multi-shell pands number each 3DBAG shell's surfaces from 1 (facts order); a group with `shell` claims its surfaces in
  // that shell only. Without `shell` anywhere, every wall takes its surface's group as before (byte-identical).
  const byShell = intent.walls.some(w => w.shell !== undefined);
  if (byShell && set.walls.length !== facts.wallsRD!.length) throw Error(`${intent.id}: walls[].shell needs every LoD2.2 wall in the surface set (not with groundClamp dropping walls)`);
  const shellOf: number[] = [];
  set.walls.forEach((w, wi) => shellOf.push(wi === 0 ? 1 : shellOf[wi - 1] + (w.surface! <= set.walls[wi - 1].surface! ? 1 : 0)));
  const groupOfWall = set.walls.map((w, wi) => {
    if (!byShell) return groupOfSurface.get(w.surface!);
    let g: number | undefined;
    intent.walls.forEach((iw, gi) => { if (iw.wallSurfaces.includes(w.surface!) && (iw.shell === undefined || iw.shell === shellOf[wi])) g = gi; });
    return g;
  });
  if (byShell) intent.walls.forEach((w, gi) => { if (w.shell !== undefined) for (const s of w.wallSurfaces) if (!set.walls.some((x, wi) => x.surface === s && shellOf[wi] === w.shell)) throw Error(`${intent.id}: walls[${gi}] lists surface ${s} of shell ${w.shell}, which has no such LoD2.2 wall (shells: ${Math.max(...shellOf)})`); });
  // Group per surface-set wall; coplanar walls of different groups stay separate panels.
  // shellRepair: panels merge only truly coplanar walls (strictMergeClasses), so a dissolved face cannot stray off a roof edge
  const strict = intent.shellRepair || intent.footprint === 'bag' ? strictMergeClasses(set.walls) : null;
  const wallGroup = set.walls.map((w, wi) => strict ? ((groupOfWall[wi] ?? -1) + 1) * 100000 + strict[wi] : groupOfWall[wi] ?? -1);
  const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true, mergeKey: wi => wallGroup[wi]});
  // Panel -> group: the group holding most of its surfaces (by area), ties to the lower group.
  const panelGroup = panels.map(p => {
    const votes = new Map<number, number>();
    for (const wi of p.walls) {
      const s = set.walls[wi].surface!, g = groupOfWall[wi];
      if (g === undefined) continue;
      const area = byShell ? facts.wallsRD![wi].areaM2 : facts.wallsRD!.find(w => w.surface === s)!.areaM2;
      votes.set(g, (votes.get(g) ?? 0) + area);
    }
    let best = -1, top = 0;
    for (const [g, a] of [...votes].sort((x, y) => x[0] - y[0])) if (a > top + 1e-9) { best = g; top = a; }
    const listed = p.walls.filter(wi => groupOfWall[wi] !== undefined).length;
    if (best >= 0 && listed < p.walls.length && p.uMax - p.uMin > 2) warnings.push(`panel ${p.index}: ${p.walls.length - listed} of ${p.walls.length} surfaces unlisted, panel follows walls[${best}]`);
    return best;
  });
  const year = facts.heights.builtYear, civicM = year !== null && year < 1945 ? CIVIC_STOREY_M.pre1945 : CIVIC_STOREY_M.post1945;
  const pal = intent.palette, groups: LargeGroupFit[] = [], systems: Record<string, System> = {};
  const palette: Record<string, string> = {
    wall: swatch(pal.brick), frame: swatch(pal.frame), door: swatch(pal.door), stone: swatch(pal.stone ?? 'sandstone'), glass: pal.glass ? swatch(pal.glass) : KIT_GLASS,
    roof: '#555555', 'police-blue': '#1d3f8f', 'police-white': '#eeeeea', plant: '#8d8c88', sign: swatch(pal.frame),
  };
  if (intent.walls.some(w => w.nameBoards?.length)) Object.assign(palette, {board: '#ecebe4', 'board-text': '#1c1c1c'});
  const measuredSlots: string[] = [], measuredGroups = new Set(intent.measured?.groups ?? []);
  const aligned = new Map<number, ReturnType<typeof storeyLines>>(), panelSystem: Record<number, string> = {}, slotMaterial: Record<string, string> = {}, lanterns: Lantern[] = [];
  intent.walls.forEach((w: LargeWallIntent, gi) => {
    const own = panels.filter(p => panelGroup[p.index] === gi);
    const ground = w.ground ?? (w.system === 'plinth-shopfronts' ? 'plinth-shopfronts' : 'system');
    const slots = {wall: 'wall', frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: `curtain@g${gi}`, sign: `sign@g${gi}`};
    if (w.palette?.brick) { slots.wall = `wall@g${gi}`; palette[slots.wall] = swatch(w.palette.brick); }
    // Group wall material: its own wall slot, exported with that material slot (render: white unless the group says otherwise).
    if (w.wallMaterial) {
      if (slots.wall === 'wall') { slots.wall = `wall@g${gi}`; palette[slots.wall] = w.wallMaterial === 'render' ? RENDER_WHITE : palette.wall; }
      slotMaterial[slots.wall] = w.wallMaterial === 'render' ? 'stucco' : w.wallMaterial;
    }
    // Cladding (GitHub #49): the group's wall gets a slot of its own (its triangles move to the sheet slot after compose),
    // the sheet and its lines their own slots; an authored colour is a measured one.
    const clad = w.cladding, cladSlot = clad ? `${clad.kind === 'paint' ? 'painted' : 'clad'}@g${gi}` : undefined, cladLine = clad ? `cladline@g${gi}` : undefined;
    if (clad && cladSlot && cladLine) {
      if (slots.wall === 'wall') { slots.wall = `wall@g${gi}`; palette[slots.wall] = palette.wall; }
      palette[cladSlot] = clad.colour ? swatch(clad.colour) : palette[slots.wall];
      palette[cladLine] = clad.lines ? swatch(clad.lines) : shade(palette[cladSlot], clad.kind === 'louvres' ? 0.45 : 0.78);
      if (clad.colour) measuredSlots.push(cladSlot);
      if (clad.lines) measuredSlots.push(cladLine);
    }
    if (w.palette?.frame) { slots.frame = `frame@g${gi}`; palette[slots.frame] = swatch(w.palette.frame); }
    if (w.palette?.stone) { slots.stone = `stone@g${gi}`; palette[slots.stone] = swatch(w.palette.stone); }
    if (w.palette?.glass) { slots.glass = `glass@g${gi}`; palette[slots.glass] = swatch(w.palette.glass); }
    let splitSlot: string | undefined;
    if (w.wallSplit) {
      if (slots.wall === 'wall') { slots.wall = `wall@g${gi}`; palette[slots.wall] = palette.wall; }
      splitSlot = `${slots.wall}/r`; palette[splitSlot] = swatch(w.wallSplit.brick);
      if (slotMaterial[slots.wall]) slotMaterial[splitSlot] = slotMaterial[slots.wall];
    }
    if (measuredGroups.has(gi)) { if (w.palette?.brick) measuredSlots.push(slots.wall); if (w.palette?.glass) measuredSlots.push(slots.glass); if (splitSlot) measuredSlots.push(splitSlot); }
    // The glass columns' own glazing (columns.glass): a glass slot of its own beside the punched windows' glass.
    const colGlass = w.columns?.glass ? `glass@g${gi}c` : undefined;
    if (colGlass) { palette[colGlass] = swatch(w.columns!.glass!); if (measuredGroups.has(gi)) measuredSlots.push(colGlass); }
    palette[slots.curtain] = palette[slots.frame];
    // Spandrel panels of a layered curtain wall: their own slot, the measured colour or the group's frame colour.
    // A coloured mesh plinth (palette.plinth): a matte panel slot of its own instead of the door slot.
    const plinthSlot = w.palette?.plinth ? `plinth@g${gi}` : undefined;
    if (plinthSlot) { palette[plinthSlot] = swatch(w.palette!.plinth!); if (measuredGroups.has(gi)) measuredSlots.push(plinthSlot); }
    const spandrelSlot = w.spandrels ? `spandrel@g${gi}` : undefined;
    // A loggia balustrade in its own colour (loggias.colour): a rail slot (joinery) of its own; otherwise the frame slot.
    const railSlot = w.loggias?.colour ? `rail@g${gi}` : undefined;
    if (railSlot) palette[railSlot] = swatch(w.loggias!.colour!);
    // Balcony rails in their own colour (black iron): a slot of their own, `rail@bg<i>`.
    const balconyRail = w.balconies?.colour ? `rail@bg${gi}` : undefined;
    if (balconyRail) palette[balconyRail] = swatch(w.balconies!.colour!);
    // A window box in its own frame colour and its deck slab (windowBox.frame, windowBox.deck): slots of their own.
    const boxFrame = w.windowBox?.frame ? `frame@wb${gi}` : undefined;
    if (boxFrame) palette[boxFrame] = swatch(w.windowBox!.frame!);
    const boxDeck = w.windowBox?.deck ? (w.windowBox.deck.colour ? `slab@wb${gi}` : slots.stone) : undefined;
    if (boxDeck && w.windowBox!.deck!.colour) palette[boxDeck] = swatch(w.windowBox!.deck!.colour);
    const screenSlot = w.meshScreen ? `screen@g${gi}` : undefined;
    if (screenSlot) { palette[screenSlot] = swatch(w.meshScreen!.colour); if (measuredGroups.has(gi)) measuredSlots.push(screenSlot); }
    if (spandrelSlot) { palette[spandrelSlot] = w.spandrels!.colour ? swatch(w.spandrels!.colour) : palette[slots.frame]; if (measuredGroups.has(gi) && w.spandrels!.colour) measuredSlots.push(spandrelSlot); }
    // Flush brick arch bands (arches / hoist): a shade darker than the group's brick.
    const arch = (w.arches || w.hoist) && (w.arches?.band ?? 'brick') === 'brick' ? `arch@g${gi}` : undefined;
    if (arch) palette[arch] = w.palette?.arch ? swatch(w.palette.arch) : shade(palette[slots.wall], 0.82);
    if (arch && slotMaterial[slots.wall]) slotMaterial[arch] = slotMaterial[slots.wall];
    const sign = w.signage === undefined ? null : typeof w.signage === 'string' ? {text: w.signage, colour: undefined, mount: undefined} : w.signage;
    if (w.crosses) palette[`cross@g${gi}`] = swatch(w.crosses.colour ?? '#d9534f');
    palette[slots.sign] = swatch(sign?.colour ?? (w.police ? '#1d3f8f' : pal.frame));
    // Widest panel that reaches the ground carries the entrance, garage doors and the bay count.
    // `mainSurface` (opt-in): the panel holding that 3DBAG surface, when the widest one is a 3DBAG artefact.
    const named = w.mainSurface !== undefined ? own.find(p => p.walls.some(wi => set.walls[wi].surface === w.mainSurface)) : undefined;
    if (w.mainSurface !== undefined && !named) throw Error(`${intent.id}: walls[${gi}].mainSurface ${w.mainSurface} is not on a panel of this group`);
    const main = named ?? [...own].sort((a, b) => Number(b.vMin < 0.6) - Number(a.vMin < 0.6) || (b.uMax - b.uMin) - (a.uMax - a.uMin) || a.index - b.index)[0];
    if (!main) warnings.push(`walls[${gi}]: no panel takes this group (its surfaces are minorities of other panels)`);
    const widthM = main ? main.uMax - main.uMin : 0, eaves = main ? panelEaves(main) : 0, flatTop = main ? main.vMax - eaves < 0.5 : true;
    const plinthFactor = w.plinth?.factor, plinthStoreys = w.plinth ? w.plinth.storeys ?? [0] : [];
    const sf = w.storeyFactors;
    const gw = sf ? sf[0] : plinthFactor !== undefined && plinthStoreys.includes(0) ? plinthFactor : w.groundFactor !== undefined ? w.groundFactor : w.souterrain ? SOUTERRAIN.factor : ground === 'arcade' ? w.arcade?.storeyFactor ?? 1.6 : ground === 'plinth-shopfronts' || ground === 'glazed' ? 1.25 : year !== null && year < 1945 ? 1.15 : 1;
    const maxTop = Math.max(eaves, ...own.map(p => p.vMax));
    // alignWith: share another group's storey lines (wings whose windows line up with the centre block), extended to this group's top.
    const ref = w.alignWith !== undefined ? aligned.get(w.alignWith) : undefined;
    if (w.alignWith !== undefined && !ref) throw Error(`${intent.id}: walls[${gi}].alignWith ${w.alignWith} must name an earlier group without alignWith`);
    // A curtain wall with spandrels runs to the roof edge: its top storey's head spandrel covers the slab and parapet (no parapet allowance).
    const st = ref ? alignLines(ref, maxTop) : storeyLines(eaves, flatTop, w.storeys, civicM, gw, maxTop, w.spandrels ? 0 : undefined,
      sf ? Object.fromEntries(sf.slice(1).map((v, k) => [k + 1, v])) : plinthFactor !== undefined ? Object.fromEntries(plinthStoreys.filter(k => k > 0).map(k => [k, plinthFactor])) : undefined);
    if (w.alignWith === undefined) aligned.set(gi, st);
    // the upper storeys (window sills in metres): past any taller plinth storey
    const uppers = st.heights.slice(1).filter((_, k) => plinthFactor === undefined || !plinthStoreys.includes(k + 1));
    if (main && uppers.some(h => h < 2.3 || h > 6.2)) warnings.push(`walls[${gi}]: upper storeys ${uppers[0]} m (storeys ${st.storeys} under ${eaves.toFixed(2)} m eaves)`);
    // row split: each house's span and bays (default: the house width over the group's pitch); the row's bays are their sum
    const cuts = w.houses && main ? houseCuts(main.uMin, main.uMax, w.houses.map(h => h.w)) : null;
    const houseSpans = cuts && main ? w.houses!.map((_, k) => [k ? cuts[k - 1] : main.uMin, k < cuts.length ? cuts[k] : main.uMax] as [number, number]) : null;
    const housePitch = widthM / (w.baysPerStorey ?? Math.max(1, Math.round(widthM / DEFAULT_PITCH_M[w.system])));
    const houseBays = houseSpans ? w.houses!.map((h, k) => h.bays ?? Math.max(1, Math.round((houseSpans[k][1] - houseSpans[k][0]) / housePitch))) : null;
    const bays = houseBays ? houseBays.reduce((a, b) => a + b, 0) : w.baysPerStorey ?? Math.max(1, Math.round(widthM / DEFAULT_PITCH_M[w.system]));
    const pitchM = widthM > 0 ? widthM / bays : DEFAULT_PITCH_M[w.system];
    const e = w.entrance === undefined || w.entrance === false ? null : w.entrance === true ? {} : w.entrance;
    const entrance = e && main ? {panel: main.index, bay: Math.min(bays - 1, e.bay ?? Math.floor((bays - 1) / 2)), storeys: Math.min(e.storeys ?? 1, st.storeys), canopy: !!e.canopy, ...(e.portal ? {portal: true} : {})} : null;
    // Banded pilasters: their darker course slot.
    let pilasters: string | undefined;
    if (w.pilasters) { pilasters = `band@g${gi}`; palette[pilasters] = shade(palette[slots.stone] ?? palette.stone, 0.7); }
    // Stone dressings: the group's stone, or their own colour.
    let dressings: LargeGroupFit['dressings'];
    if (w.dressings) { const slot = w.dressings.colour ? `dress@g${gi}` : slots.stone; if (w.dressings.colour) palette[slot] = w.dressings.colour; dressings = {...w.dressings, slot}; }
    // A portal's crest: carved in the group's stone a shade darker, so it reads against the tympanum.
    if (entrance?.portal) palette[`crest@g${gi}`] = shade(palette[slots.stone] ?? palette.stone, 0.68);
    if (w.lantern && main) { const l = placeLantern(facts, anchorRD, main); if (l) lanterns.push(l); else warnings.push(`walls[${gi}].lantern: no roof behind the main panel`); }
    let garage: LargeGroupFit['garage'] = null;
    if (w.garageBays && main) garage = {panel: main.index, bays: w.garageBays.filter(b => b < bays && b !== entrance?.bay).sort((a, b) => a - b)};
    if (w.garageDoors && !w.garageBays && main) {
      const list: number[] = [];
      for (let b = bays - 1; b >= 0 && list.length < w.garageDoors; b--) if (b !== entrance?.bay) list.push(b);
      if (list.length < w.garageDoors) warnings.push(`walls[${gi}]: ${w.garageDoors} garage doors but only ${list.length} free bays`);
      garage = {panel: main.index, bays: list.sort((a, b) => a - b)};
    }
    const specSystem = SYSTEM_SLOT(gi);
    // Recessed arcade: the intent's measures over the kit defaults (Mercatorplein); the facing flag rides on the group fit.
    const ap = ground === 'arcade' ? {...ARCADE_PROPORTIONS, ...Object.fromEntries(Object.entries(w.arcade ?? {}).filter(([k, v]) => k in ARCADE_PROPORTIONS && v !== undefined))} as typeof ARCADE_PROPORTIONS : undefined;
    const arcade: ArcadeFit | undefined = ap ? {pierM: r3(ap.pier * pitchM), depthM: r3(ap.walk * st.heights[0]), head: ap.head, rise: ap.rise, chamfer: ap.chamfer} : undefined;
    const sysOpts: Parameters<typeof largeSystem>[1] = {pitchM, lines: st.lines, ground, windows: w.windows, stringCourses: w.stringCourses, piers: w.piers, balconyStoreys: w.balconies?.storeys, balconyRail: w.balconies?.rail, ...(w.balconies && (w.balconies.every !== undefined || w.balconies.bays) ? {balconyBays: {every: w.balconies.every, first: w.balconies.first, bays: w.balconies.bays}, bays} : {}), blankStoreys: w.blankStoreys, ...(w.glazedStoreys ? {glazedStoreys: w.glazedStoreys} : {}), slots: {...slots, ...(arch ? {arch} : {})},
      ...(w.columns ? {columnBays: w.columns.bays, bays} : {}),
      ...(w.windowShape ? {shape: {w: w.windowShape.w, h: w.windowShape.h, sillM: r3(w.windowShape.sill * (uppers[0] ?? st.heights[0]))}} : {}),
      ...(w.windowPattern ? {windowPattern: [...w.windowPattern]} : {}),
      ...(w.storeyShapes ? {storeyShapes: w.storeyShapes.flatMap(e => e.storeys.filter(q => q < st.heights.length).map(q => ({storey: q, w: e.w, h: e.h, sillM: r3(e.sill * st.heights[q])})))} : {}),
      ...(w.windowGroup ? {windowGroup: {count: w.windowGroup.count, gapM: r3((w.windowGroup.gap ?? 0.06) * pitchM), ...(w.windowGroup.storeys ? {storeys: [...w.windowGroup.storeys]} : {})}} : {}),
      ...(balconyRail ? {balconyRailSlot: balconyRail} : {}), ...(w.balconies?.deep !== undefined ? {balconyDeepM: r3(w.balconies.deep * (uppers[0] ?? st.heights[0]))} : {}), ...(w.balconies?.windows ? {balconyOnWindows: true} : {}), ...(w.balconies?.run ? {balconyRun: true} : {}),
      ...(w.arches ? {arches: w.arches} : {}), ...(w.hoist ? {hoist: w.hoist, bays} : {}), ...(w.gateways ? {gateways: w.gateways, bays} : {}), ...(w.hallDoors ? {hallDoors: w.hallDoors, bays} : {}), ...(w.sills === false ? {sills: false} : {}), ...(w.frames === false ? {frames: false} : {}), ...(w.deepBars ? {deepBars: true} : {}), ...(w.tiltedBays ? {tilted: w.tiltedBays, bays} : {}), ...(w.screen ? {screen: true} : {}), ...(intent.layeredKit !== false ? {layered: true} : {}), ...(arcade ? {arcade} : {}),
      ...(w.glazing === 'panes' ? {paneSplit: true} : {}), ...(w.courses ? {courses: [...w.courses]} : {}), ...(w.souterrain ? {souterrain: w.souterrain} : {}), ...(w.openBays ? {openBays: w.openBays, bays} : {}),
      ...(w.plinth ? {plinth: {storeys: [...plinthStoreys], ...(w.plinth.bays ? {bays: [...w.plinth.bays]} : {}), lights: w.plinth.lights, sill: w.plinth.sill ?? PLINTH.sill, h: w.plinth.h ?? PLINTH.h, pier: w.plinth.pier ?? PLINTH.pier, transom: w.plinth.transom ?? PLINTH.transom}, bays} : {}),
      ...(w.loggias ? {loggias: {storeys: [...w.loggias.storeys], ...(w.loggias.bays ? {bays: [...w.loggias.bays]} : {}), w: w.loggias.w ?? LOGGIA.w, h: w.loggias.h ?? LOGGIA.h, sill: w.loggias.sill ?? LOGGIA.sill, deep: w.loggias.deep ?? LOGGIA.deep, rail: w.loggias.rail ?? LOGGIA.rail, lights: w.loggias.lights ?? LOGGIA.lights, railSlot: railSlot ?? slots.frame}, bays} : {})};
    systems[specSystem] = largeSystem(w.system, sysOpts);
    // Row split: per house its own eaves (the 3DBAG wall over its span, row-coherent), storey lines, bays, window shape
    // and wall slot, as a spec system of its own whose bays sit in the house's span (compose `segmentsFor`).
    let houses: LargeGroupFit['houses'];
    if (w.houses && main && houseSpans && houseBays) {
      const raw = houseSpans.map(([a, b]) => spanEaves(main, a, b)), tops = houseSpans.map(([a, b]) => spanTop(main, a, b));
      const coh = rowCoherence(raw, w.houses.map(h => h.storeys !== undefined || !!h.ownEaves));
      for (const c of coh.clamps) warnings.push(`walls[${gi}].houses[${c.house}]: eaves ${c.fromM} m -> row line ${c.toM} m (row coherence)`);
      let bayOffset = 0;
      const segs = w.houses.map((h, k): LargeHouseFit => {
        const [u0, u1] = houseSpans[k], eavesK = coh.eaves[k], topK = Math.max(tops[k], eavesK);
        const storeysK = h.storeys ?? (Math.abs(eavesK - eaves) <= 0.8 ? st.storeys : undefined);
        const stK = storeyLines(eavesK, topK - eavesK < 0.5, storeysK, civicM, gw, topK, undefined,
          plinthFactor !== undefined ? Object.fromEntries(plinthStoreys.filter(q => q > 0).map(q => [q, plinthFactor])) : undefined);
        let slot = slots.wall;
        if (h.brick) {
          slot = `wall@g${gi}h${k}`; palette[slot] = swatch(h.brick);
          if (slotMaterial[slots.wall]) slotMaterial[slot] = slotMaterial[slots.wall];
          if (measuredGroups.has(gi)) measuredSlots.push(slot);
        }
        const nb = houseBays[k], pk = (u1 - u0) / nb, shape = h.windowShape ?? w.windowShape, upK = stK.heights.slice(1).filter((_, q) => plinthFactor === undefined || !plinthStoreys.includes(q + 1));
        const name = `${specSystem}h${k}`;
        systems[name] = {...largeSystem(w.system, {...sysOpts, pitchM: pk, lines: stK.lines, bays: nb,
          ...(shape ? {shape: {w: shape.w, h: shape.h, sillM: r3(shape.sill * (upK[0] ?? stK.heights[0]))}} : {})}), minWidth: 0.5, bays: {first: r3(u0 - main.uMin + pk / 2), pitch: r3(pk), count: nb}};
        const fit: LargeHouseFit = {u0: r3(u0), u1: r3(u1), system: name, slot, eavesM: eavesK, topM: r3(topK), storeys: stK.storeys, lines: stK.lines, bays: nb, bayOffset, pitchM: r3(pk),
          crown: h.crown ?? (w.cornice ? 'cornice' : 'flat'), ...(eavesK !== raw[k] ? {clampedFromM: raw[k]} : {})};
        bayOffset += nb;
        return fit;
      });
      houses = {panel: main.index, segs};
    }
    // Curved front: one bay rhythm along each run of linked facets (two or more panels of this group), at the group's pitch.
    let curve: LargeGroupFit['curve'];
    if (w.curve) {
      const sys = systems[specSystem], ww = sys.typical.win?.w ?? 0.5, halfWin = (ww <= 1 ? ww * pitchM : ww) / 2;
      curve = [];
      for (const run of panelRuns(panels, p => panelGroup[p.index] === gi)) {
        if (run.panels.length < 2) continue;
        const nb = Math.max(1, Math.round(run.lengthM / pitchM)), axes = runBayAxes(panels, run, nb, halfWin, 0.12);
        for (const [pi, centres] of axes) { const name = `${specSystem}c${pi}`; systems[name] = {...sys, minWidth: 0.5, bays: {first: 0, pitch: run.lengthM / nb, count: centres.length, centres}}; panelSystem[pi] = name; }
        curve.push({panels: run.panels, lengthM: r3(run.lengthM), turnDeg: Math.round(run.turnDeg), bays: nb});
      }
      if (!curve.length) warnings.push(`walls[${gi}].curve: no two panels of this group link end to end`);
    }
    groups.push({index: gi, system: w.system, specSystem, panels: own.map(p => p.index), surfaces: [...w.wallSurfaces], mainPanel: main?.index ?? null, bearingDeg: main ? Math.round(bearingOfNormal(main.n)) : null,
      widthM: r3(widthM), eavesM: r3(eaves), flatTop, storeys: st.storeys, storeyHeightsM: st.heights, lines: st.lines, bays, pitchM: r3(pitchM), ground, cornice: !!w.cornice,
      ...(w.deepBars ? {deepBars: true} : {}), ...(w.screen ? {screen: true} : {}), ...(plinthSlot ? {plinthSlot} : {}), ...(spandrelSlot ? {spandrels: {sill: w.spandrels!.sill ?? 0, head: w.spandrels!.head ?? 0, slot: spandrelSlot}} : {}), ...(screenSlot ? {meshScreen: {storeys: [...w.meshScreen!.storeys], from: w.meshScreen!.from ?? MESH_SCREEN.from, to: w.meshScreen!.to ?? MESH_SCREEN.to, joint: w.meshScreen!.joint ?? MESH_SCREEN.joint, slot: screenSlot}} : {}), ...(w.stoneStoreys ? {stoneStoreys: [...w.stoneStoreys]} : {}), ...(w.brickStoreys ? {brickStoreys: w.brickStoreys.map((b, k) => { const sl = `painted@g${gi}s${k}`; palette[sl] = swatch(b.brick); return {storeys: [...b.storeys], slot: sl}; })} : {}), ...(w.mansard ? {mansard: {storeys: [...w.mansard.storeys], slot: (palette[`mansard@g${gi}`] = swatch(w.mansard.colour ?? ROOF_COLOURS.slate.steep), `mansard@g${gi}`)}} : {}), ...(pilasters ? {pilasters} : {}), ...(dressings ? {dressings} : {}), entrance, garage, signage: sign ? {text: sign.text, colour: palette[slots.sign], mount: sign.mount ?? 'fascia', ...('along' in sign && sign.along ? {along: [sign.along[0], sign.along[1]] as [number, number]} : {})} : null, police: w.police ? {stripe: !!w.police.stripe, lamp: !!w.police.lamp} : null,
      ...(w.hall ? {hall: {baseM: r3(w.hall.base * eaves), lights: w.hall.lights, rows: w.hall.rows}} : {}),
      ...(w.columns ? {columns: {bays: [...w.columns.bays], share: w.columns.share ?? 0.9, from: w.columns.from ?? 1, slabs: !!w.columns.slabs, ...(colGlass ? {glass: colGlass} : {})}} : {}),
      ...(w.hoist ? {hoist: w.hoist.bays ? {bays: [...w.hoist.bays]} : {every: w.hoist.every!, first: w.hoist.first ?? 0}} : {}), ...(w.nameBoards?.length ? {nameBoards: w.nameBoards} : {}), ...(curve ? {curve} : {}), ...(w.crosses ? {crosses: {count: w.crosses.count, sizeM: CROSS_SIZE_M[w.crosses.size ?? 'medium'], side: w.crosses.side ?? 'left'}} : {}),
      ...(w.wallSplit && main && splitSlot ? {split: {panel: main.index, uM: splitAtBay(main.uMin, main.uMax, pitchM, w.wallSplit.at), slot: splitSlot}} : {}),
      ...(arcade ? {arcade: {...arcade, facing: w.arcade?.facing !== false}} : {}),
      ...(houses ? {houses} : {}),
      ...(w.arcadePiers ? {arcadePiers: fitArcadePiers(w.arcadePiers, slots.stone)} : {}),
      ...(w.windowBox ? {windowBox: fitWindowBox(w.windowBox, {frame: boxFrame ?? slots.frame, glass: slots.glass, ...(boxDeck ? {deck: boxDeck} : {})}, main ? main.uMax - main.uMin : undefined, bays)} : {}),
      ...(w.signBoards ? {signBoards: w.signBoards.map((b, k) => { const sl = `signboard@g${gi}k${k}`; palette[sl] = swatch(b.colour ?? pal.door); return {along: [b.along[0], b.along[1]] as [number, number], up: [b.up[0], b.up[1]] as [number, number], slot: sl}; })} : {}),
      ...(w.falseFront ? {falseFront: {slot: cladSlot ?? slots.wall}} : {}),
      ...(w.gallery ? {gallery: fitGallery(w.gallery, {stone: slots.stone, timber: (k, colour) => { if (!colour) return slots.frame; const sl = `rail@gal${gi}k${k}`; palette[sl] = swatch(colour); return sl; },
        rail: (k, colour) => { const sl = `rail@gal${gi}k${k}r`; palette[sl] = swatch(colour); return sl; }})} : {}),
      ...(clad && cladSlot && cladLine ? {cladding: {kind: clad.kind, ...claddingHeights(eaves, clad.from, clad.to), pitchM: clad.pitch ?? (clad.kind === 'paint' ? 0 : CLADDING[clad.kind].pitch), rowPitchM: clad.rowPitch ?? PANEL_ROW_M, slot: cladSlot, lineSlot: cladLine,
        ...(w.wallSplit && main && splitSlot ? {side: {panel: main.index, uM: splitAtBay(main.uMin, main.uMax, pitchM, w.wallSplit.at), right: clad.side === 'right', ...(clad.side === 'right' ? {source: splitSlot} : {})}} : {})}} : {}),
      ...(w.loggias ? {loggiaDepthM: r3(Math.max(...w.loggias.storeys.map(k => (st.lines[k + 1] ?? st.lines[k]) - st.lines[k])) * (w.loggias.deep ?? LOGGIA.deep))} : {}), slots});
  });
  // Unlisted walls: one system at the civic storey height and the system's default pitch.
  const otherName = intent.otherWalls ?? 'blank', otherTop = Math.max(0, ...panels.map(p => p.vMax));
  const otherLines = storeyLines(otherTop, true, undefined, civicM, year !== null && year < 1945 ? 1.15 : 1, otherTop);
  systems.other = largeSystem(otherName, {pitchM: DEFAULT_PITCH_M[otherName], lines: otherLines.lines, ground: 'system', slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}});
  // Measured groups (intent `measured`): their own wall, arch-ring and glass slots also carry the measured colour into the
  // look (with the wall, glass and split slots pushed above); deduplicated.
  for (const gi of intent.measured?.groups ?? []) { const g = groups[gi]; if (g) measuredSlots.push(...[g.slots.wall, `arch@g${gi}`, g.slots.glass, ...(g.brickStoreys?.map(b => b.slot) ?? [])].filter(sl => sl !== 'wall' && sl !== 'glass' && palette[sl] !== undefined)); }
  // `measured.otherWalls`: palette.brick was measured too (the rear and courtyard walls of the same brick as the fronts)
  if (intent.measured?.otherWalls) measuredSlots.push('wall');
  const unlistedSurfaces = byShell ? set.walls.filter((_, wi) => groupOfWall[wi] === undefined).map(w => w.surface!) : set.walls.map(w => w.surface!).filter(s => !groupOfSurface.has(s));
  const spec: BlockSpec = {id: intent.id, pandId: intent.pandId, name: intent.address, palette, levels: {groundM: civicM, storeyM: civicM}, systems, default: 'other', roofSlot: 'roof', wallSlot: 'wall'};
  const roofPlant = intent.roofPlant ? placeRoofPlant(set) : [];
  if (intent.roofPlant && !roofPlant.length) warnings.push('roofPlant: no flat roof of 40 m² with room for a lift overrun');
  const recipe: LargeBuildingRecipe = {id: intent.id, pandId: intent.pandId, anchorRD, set, spec, panelGroup, wallGroup, groups, other: {system: otherName, specSystem: 'other'}, roofPlant, recessM: LARGE_RECESS_M,
    roof: largeRoofFit(intent.roof, facts, anchorRD), wallMaterial: (pal.wallMaterial === 'painted-brick' ? 'brick' : pal.wallMaterial) ?? 'brick', ...(Object.keys(panelSystem).length ? {panelSystem} : {}), ...(Object.keys(slotMaterial).length ? {slotMaterial} : {}), ...(lanterns.length ? {lanterns} : {}), ...(measuredSlots.length ? {measuredSlots: [...new Set(measuredSlots)]} : {})};
  const report: LargeFitReport = {
    groups: groups.map(g => ({index: g.index, system: g.system, panels: g.panels.length, surfaces: g.surfaces.length, widthM: g.widthM, eavesM: g.eavesM, storeys: g.storeys, storeyHeightsM: g.storeyHeightsM, bays: g.bays, pitchM: g.pitchM, entrance: !!g.entrance, garageDoors: g.garage?.bays.length ?? 0})),
    panels: panels.map(p => ({index: p.index, group: panelGroup[p.index], system: panelGroup[p.index] >= 0 ? groups[panelGroup[p.index]].system : otherName, widthM: r3(p.uMax - p.uMin), heightM: r3(p.vMax), bearingDeg: Math.round(bearingOfNormal(p.n)), surfaces: p.walls.map(wi => set.walls[wi].surface!)})),
    unlistedSurfaces, warnings, ...(shell ? {shellRepair: shell} : {}), ...(roofLevel ? {roofLevel} : {}),
  };
  return {recipe, report, facts};
}
