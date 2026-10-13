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
import type {BuildingFacts} from './facts.ts';
import {swatch, type LargeBuildingIntent, type LargeWallIntent} from './intent.ts';
import {buildHost, insidePanel, pointInRing, type Panel} from '../blockBuilding/panels.ts';
import {MeshBuilder} from '../blockBuilding/mesh.ts';
import type {P3, SurfaceSet} from '../blockBuilding/types.ts';
import type {BlockSpec, System} from '../blockBuilding/spec.ts';
import {DEFAULT_PITCH_M, largeSystem, type LargeGround, type LargeSystemName} from '../blockBuilding/systems.ts';
import {panelRuns, runBayAxes} from '../blockBuilding/curve.ts';
import type {Lantern} from '../blockBuilding/components.ts';
import {roofHeightAt} from './facts.ts';

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
  /** perforated-brick screen lattice over the group's walls */
  screen?: boolean;
  entrance: {panel: number; bay: number; storeys: number; canopy: boolean; portal?: boolean} | null;
  /** storeys faced in stone, banded end pilasters (with the darker band slot) */
  stoneStoreys?: number[]; pilasters?: string;
  garage: {panel: number; bays: number[]} | null;
  signage: {text: string; colour: string; mount: 'fascia' | 'wall' | 'glazing' | 'canopy' | 'cornice'} | null;
  police: {stripe: boolean; lamp: boolean} | null;
  /** loading-door axis (bay % every === first) and the name boards over its ground portals on the main panel */
  hoist?: {every: number; first: number} | {bays: number[]};
  nameBoards?: string[];
  /** St Andrew's crosses stacked down a top corner of the main panel (slot `cross@g<index>`) */
  crosses?: {count: number; sizeM: number; side: 'left' | 'right'};
  /** `curve`: the linked facet runs carrying one bay rhythm (panel indices left to right, arc length, turn, bays) */
  curve?: {panels: number[]; lengthM: number; turnDeg: number; bays: number}[];
  slots: {wall: string; frame: string; stone: string; glass: string; door: string; curtain: string; sign: string};
}
export interface LargeBuildingRecipe {
  id: string; pandId: string; anchorRD: [number, number]; set: SurfaceSet; spec: BlockSpec;
  /** group index per panel (`-1` = otherWalls) */
  panelGroup: number[];
  /** group index per `set.walls` entry: the compose `mergeKey`, so panels never span two groups */
  wallGroup: number[];
  groups: LargeGroupFit[]; other: {system: LargeSystemName; specSystem: string};
  roofPlant: PlantBox[]; recessM: number;
  roof: {material: NonNullable<LargeBuildingIntent['roof']>['material']};
  wallMaterial: 'brick' | 'stucco';
  /** per-panel spec system replacing the group's (curved runs: bay axes along the arc); only present when a group opts in */
  panelSystem?: Record<number, string>;
  /** roof lanterns (`walls[].lantern`), local metres; only present when a group asks for one */
  lanterns?: Lantern[];
  /** recipe material slot per block-kit wall slot of a group with its own `wallMaterial` (only present when a group sets one) */
  slotMaterial?: Record<string, string>;
}
export interface LargeFitReport {
  groups: {index: number; system: string; panels: number; surfaces: number; widthM: number; eavesM: number; storeys: number; storeyHeightsM: number[]; bays: number; pitchM: number; entrance: boolean; garageDoors: number}[];
  panels: {index: number; group: number; system: string; widthM: number; heightM: number; bearingDeg: number; surfaces: number[]}[];
  unlistedSurfaces: number[];
  warnings: string[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** #rrggbb scaled by k (k < 1 darker). */
const shade = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
export const bearingOfNormal = (n: number[]) => (Math.atan2(n[0], -n[2]) * 180 / Math.PI + 360) % 360;

/** 3DBAG facts → block-kit surface set in local metres around the BAG footprint centroid. */
export function largeSurfaceSet(facts: BuildingFacts): {set: SurfaceSet; anchorRD: [number, number]} {
  if (!facts.wallsRD?.length) throw Error(`${facts.pandId}: facts have no wallsRD; rerun facts.ts with --large`);
  const all = facts.bagFootprintRD.flat(), g = facts.heights.groundNAP;
  const anchorRD: [number, number] = [Math.round(all.reduce((s, p) => s + p[0], 0) / all.length * 100) / 100, Math.round(all.reduce((s, p) => s + p[1], 0) / all.length * 100) / 100];
  const [ax, ay] = anchorRD, loc = (p: number[]): P3 => [r3(p[0] - ax), r3(p[2] - g), r3(ay - p[1])];
  const set: SurfaceSet = {
    pandId: facts.pandId, anchor: anchorRD, groundNap: g, heightMax: facts.heights.roofMaxM, constructionYear: facts.heights.builtYear,
    walls: facts.wallsRD.map(w => ({rings: w.ringsRD.map(r => r.map(loc)), onFootprintEdge: w.onFootprintEdge, surface: w.surface})),
    roofs: facts.roofsRD.map(r => ({rings: r.ringsRD.map(ring => ring.map(loc)), slopeDeg: r.slopeDeg})),
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
export function storeyLines(eaves: number, flatTop: boolean, storeys: number | undefined, civicM: number, gw: number, maxTop: number) {
  const parapet = flatTop ? 0.5 : 0.15, usable = Math.max(2.5, eaves - parapet);
  const n = storeys ?? Math.max(1, Math.round(usable / civicM - (gw - 1)));
  const unit = usable / (n - 1 + gw), ground = unit * gw;
  const lines = [0, ground];
  for (let k = 1; k < n; k++) lines.push(ground + unit * k);
  // The last entry is the wall top (compose drops it and closes the top floor at the panel's own top).
  while (lines[lines.length - 1] + unit < maxTop - 1.0) lines.push(lines[lines.length - 1] + unit);
  lines.push(Math.max(maxTop, lines[lines.length - 1] + 0.01));
  return {lines: lines.map(r3), storeys: n, heights: [ground, ...Array(n - 1).fill(unit)].map(r3)};
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

export function fitLarge(intent: LargeBuildingIntent, facts: BuildingFacts): {recipe: LargeBuildingRecipe; report: LargeFitReport} {
  const warnings: string[] = [];
  const {set, anchorRD} = largeSurfaceSet(facts);
  const known = new Set(set.walls.map(w => w.surface!));
  const groupOfSurface = new Map<number, number>();
  intent.walls.forEach((w, gi) => w.wallSurfaces.forEach(s => {
    if (!known.has(s)) throw Error(`${intent.id}: walls[${gi}] lists surface ${s}, which is not a LoD2.2 wall of pand ${facts.pandId} (see scripts/building-recipes/walls.ts)`);
    groupOfSurface.set(s, gi);
  }));
  // Group per surface-set wall; coplanar walls of different groups stay separate panels.
  const wallGroup = set.walls.map(w => groupOfSurface.get(w.surface!) ?? -1);
  const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true, mergeKey: wi => wallGroup[wi]});
  // Panel -> group: the group holding most of its surfaces (by area), ties to the lower group.
  const panelGroup = panels.map(p => {
    const votes = new Map<number, number>();
    for (const wi of p.walls) {
      const s = set.walls[wi].surface!, g = groupOfSurface.get(s);
      if (g === undefined) continue;
      const area = facts.wallsRD!.find(w => w.surface === s)!.areaM2;
      votes.set(g, (votes.get(g) ?? 0) + area);
    }
    let best = -1, top = 0;
    for (const [g, a] of [...votes].sort((x, y) => x[0] - y[0])) if (a > top + 1e-9) { best = g; top = a; }
    const listed = p.walls.filter(wi => groupOfSurface.has(set.walls[wi].surface!)).length;
    if (best >= 0 && listed < p.walls.length && p.uMax - p.uMin > 2) warnings.push(`panel ${p.index}: ${p.walls.length - listed} of ${p.walls.length} surfaces unlisted, panel follows walls[${best}]`);
    return best;
  });
  const year = facts.heights.builtYear, civicM = year !== null && year < 1945 ? CIVIC_STOREY_M.pre1945 : CIVIC_STOREY_M.post1945;
  const pal = intent.palette, groups: LargeGroupFit[] = [], systems: Record<string, System> = {};
  const palette: Record<string, string> = {
    wall: swatch(pal.brick), frame: swatch(pal.frame), door: swatch(pal.door), stone: swatch(pal.stone ?? 'sandstone'), glass: '#2a3a42',
    roof: '#555555', 'police-blue': '#1d3f8f', 'police-white': '#eeeeea', plant: '#8d8c88', sign: swatch(pal.frame),
  };
  if (intent.walls.some(w => w.nameBoards?.length)) Object.assign(palette, {board: '#ecebe4', 'board-text': '#1c1c1c'});
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
    if (w.palette?.frame) { slots.frame = `frame@g${gi}`; palette[slots.frame] = swatch(w.palette.frame); }
    if (w.palette?.stone) { slots.stone = `stone@g${gi}`; palette[slots.stone] = swatch(w.palette.stone); }
    palette[slots.curtain] = palette[slots.frame];
    // Flush brick arch bands (arches / hoist): a shade darker than the group's brick.
    const arch = (w.arches || w.hoist) && (w.arches?.band ?? 'brick') === 'brick' ? `arch@g${gi}` : undefined;
    if (arch) palette[arch] = shade(palette[slots.wall], 0.82);
    if (arch && slotMaterial[slots.wall]) slotMaterial[arch] = slotMaterial[slots.wall];
    const sign = w.signage === undefined ? null : typeof w.signage === 'string' ? {text: w.signage, colour: undefined, mount: undefined} : w.signage;
    if (w.crosses) palette[`cross@g${gi}`] = swatch(w.crosses.colour ?? '#d9534f');
    palette[slots.sign] = swatch(sign?.colour ?? (w.police ? '#1d3f8f' : pal.frame));
    // Widest panel that reaches the ground carries the entrance, garage doors and the bay count.
    const main = [...own].sort((a, b) => Number(b.vMin < 0.6) - Number(a.vMin < 0.6) || (b.uMax - b.uMin) - (a.uMax - a.uMin) || a.index - b.index)[0];
    if (!main) warnings.push(`walls[${gi}]: no panel takes this group (its surfaces are minorities of other panels)`);
    const widthM = main ? main.uMax - main.uMin : 0, eaves = main ? panelEaves(main) : 0, flatTop = main ? main.vMax - eaves < 0.5 : true;
    const gw = ground === 'plinth-shopfronts' || ground === 'glazed' ? 1.25 : year !== null && year < 1945 ? 1.15 : 1;
    const maxTop = Math.max(eaves, ...own.map(p => p.vMax));
    // alignWith: share another group's storey lines (wings whose windows line up with the centre block), extended to this group's top.
    const ref = w.alignWith !== undefined ? aligned.get(w.alignWith) : undefined;
    if (w.alignWith !== undefined && !ref) throw Error(`${intent.id}: walls[${gi}].alignWith ${w.alignWith} must name an earlier group without alignWith`);
    const st = ref ? alignLines(ref, maxTop) : storeyLines(eaves, flatTop, w.storeys, civicM, gw, maxTop);
    if (w.alignWith === undefined) aligned.set(gi, st);
    const uppers = st.heights.slice(1);
    if (main && uppers.some(h => h < 2.3 || h > 6.2)) warnings.push(`walls[${gi}]: upper storeys ${uppers[0]} m (storeys ${st.storeys} under ${eaves.toFixed(2)} m eaves)`);
    const bays = w.baysPerStorey ?? Math.max(1, Math.round(widthM / DEFAULT_PITCH_M[w.system]));
    const pitchM = widthM > 0 ? widthM / bays : DEFAULT_PITCH_M[w.system];
    const e = w.entrance === undefined || w.entrance === false ? null : w.entrance === true ? {} : w.entrance;
    const entrance = e && main ? {panel: main.index, bay: Math.min(bays - 1, e.bay ?? Math.floor((bays - 1) / 2)), storeys: Math.min(e.storeys ?? 1, st.storeys), canopy: !!e.canopy, ...(e.portal ? {portal: true} : {})} : null;
    // Banded pilasters: their darker course slot.
    let pilasters: string | undefined;
    if (w.pilasters) { pilasters = `band@g${gi}`; palette[pilasters] = shade(palette[slots.stone] ?? palette.stone, 0.7); }
    // A portal's crest: carved in the group's stone a shade darker, so it reads against the tympanum.
    if (entrance?.portal) palette[`crest@g${gi}`] = shade(palette[slots.stone] ?? palette.stone, 0.68);
    if (w.lantern && main) { const l = placeLantern(facts, anchorRD, main); if (l) lanterns.push(l); else warnings.push(`walls[${gi}].lantern: no roof behind the main panel`); }
    let garage: LargeGroupFit['garage'] = null;
    if (w.garageDoors && main) {
      const list: number[] = [];
      for (let b = bays - 1; b >= 0 && list.length < w.garageDoors; b--) if (b !== entrance?.bay) list.push(b);
      if (list.length < w.garageDoors) warnings.push(`walls[${gi}]: ${w.garageDoors} garage doors but only ${list.length} free bays`);
      garage = {panel: main.index, bays: list.sort((a, b) => a - b)};
    }
    const specSystem = SYSTEM_SLOT(gi);
    systems[specSystem] = largeSystem(w.system, {pitchM, lines: st.lines, ground, windows: w.windows, stringCourses: w.stringCourses, piers: w.piers, balconyStoreys: w.balconies?.storeys, balconyRail: w.balconies?.rail, blankStoreys: w.blankStoreys, slots: {...slots, ...(arch ? {arch} : {})},
      ...(w.arches ? {arches: w.arches} : {}), ...(w.hoist ? {hoist: w.hoist, bays} : {}), ...(w.sills === false ? {sills: false} : {}), ...(w.frames === false ? {frames: false} : {}), ...(w.deepBars ? {deepBars: true} : {}), ...(w.tiltedBays ? {tilted: w.tiltedBays, bays} : {}), ...(w.screen ? {screen: true} : {})});
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
      ...(w.deepBars ? {deepBars: true} : {}), ...(w.screen ? {screen: true} : {}), ...(w.stoneStoreys ? {stoneStoreys: [...w.stoneStoreys]} : {}), ...(pilasters ? {pilasters} : {}), entrance, garage, signage: sign ? {text: sign.text, colour: palette[slots.sign], mount: sign.mount ?? 'fascia'} : null, police: w.police ? {stripe: !!w.police.stripe, lamp: !!w.police.lamp} : null,
      ...(w.hoist ? {hoist: w.hoist.bays ? {bays: [...w.hoist.bays]} : {every: w.hoist.every!, first: w.hoist.first ?? 0}} : {}), ...(w.nameBoards?.length ? {nameBoards: w.nameBoards} : {}), ...(curve ? {curve} : {}), ...(w.crosses ? {crosses: {count: w.crosses.count, sizeM: CROSS_SIZE_M[w.crosses.size ?? 'medium'], side: w.crosses.side ?? 'left'}} : {}), slots});
  });
  // Unlisted walls: one system at the civic storey height and the system's default pitch.
  const otherName = intent.otherWalls ?? 'blank', otherTop = Math.max(0, ...panels.map(p => p.vMax));
  const otherLines = storeyLines(otherTop, true, undefined, civicM, year !== null && year < 1945 ? 1.15 : 1, otherTop);
  systems.other = largeSystem(otherName, {pitchM: DEFAULT_PITCH_M[otherName], lines: otherLines.lines, ground: 'system', slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}});
  const unlistedSurfaces = set.walls.map(w => w.surface!).filter(s => !groupOfSurface.has(s));
  const spec: BlockSpec = {id: intent.id, pandId: intent.pandId, name: intent.address, palette, levels: {groundM: civicM, storeyM: civicM}, systems, default: 'other', roofSlot: 'roof', wallSlot: 'wall'};
  const roofPlant = intent.roofPlant ? placeRoofPlant(set) : [];
  if (intent.roofPlant && !roofPlant.length) warnings.push('roofPlant: no flat roof of 40 m² with room for a lift overrun');
  const recipe: LargeBuildingRecipe = {id: intent.id, pandId: intent.pandId, anchorRD, set, spec, panelGroup, wallGroup, groups, other: {system: otherName, specSystem: 'other'}, roofPlant, recessM: LARGE_RECESS_M,
    roof: {material: intent.roof?.material ?? 'bitumen'}, wallMaterial: pal.wallMaterial ?? 'brick', ...(Object.keys(panelSystem).length ? {panelSystem} : {}), ...(Object.keys(slotMaterial).length ? {slotMaterial} : {}), ...(lanterns.length ? {lanterns} : {})};
  const report: LargeFitReport = {
    groups: groups.map(g => ({index: g.index, system: g.system, panels: g.panels.length, surfaces: g.surfaces.length, widthM: g.widthM, eavesM: g.eavesM, storeys: g.storeys, storeyHeightsM: g.storeyHeightsM, bays: g.bays, pitchM: g.pitchM, entrance: !!g.entrance, garageDoors: g.garage?.bays.length ?? 0})),
    panels: panels.map(p => ({index: p.index, group: panelGroup[p.index], system: panelGroup[p.index] >= 0 ? groups[panelGroup[p.index]].system : otherName, widthM: r3(p.uMax - p.uMin), heightM: r3(p.vMax), bearingDeg: Math.round(bearingOfNormal(p.n)), surfaces: p.walls.map(wi => set.walls[wi].surface!)})),
    unlistedSurfaces, warnings,
  };
  return {recipe, report};
}
