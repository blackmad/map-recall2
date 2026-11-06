import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {Acc, ccw, roof, soffit, tube, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {holedWall, type HoledOpening} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Het Boekhuis, Kingsfordweg 1 (BAG pand 0363100012107557, bouwjaar 1994; OSM w57864988 "Belastingdienst", alt_name
 * Boekhuis, wikidata Q55362268). Abe Bonnema for Reed Elsevier; let on completion in 1994 to the Belastingdienst and the
 * Douane (nl.wikipedia "Boekhuis", CC BY-SA 4.0). The report's name is the occupant; the building is the Boekhuis.
 * One BAG pand: the 82 m open-book tower, the long voorbouw on the Kingsfordweg, the car park on the north, the low
 * east wing, the 59 m slab at the south end with its 26 m link blocks, and the low car park along the Ringweg.
 *
 * Native east/south metres from the BAG ring vertex average (belastingdienst-amsterdam-footprints.json), y above the
 * 3DBAG ground 0.91 m NAP. Plans follow the BAG ring and the 3DBAG LoD2.2 roof parts (heights in the footprints file).
 *
 * Evidence (belastingdienst-amsterdam-inventory.json):
 *  - recording_2025-07-01_11-45-33_00562 (voorbouw north section, w03, rectified 32.5 px/m): dark polished granite on a
 *    square panel grid, three rows of eleven white-framed ribbon windows (6.0 x 1.3 m, eight panes) on a 7.26 m pitch,
 *    a 3.9 m ground storey glazed 1.6 m behind square dark piers on a 7.2 m pitch, the glazed hall at the south end.
 *  - recording_2024-09-09_08-42-32_05540 (voorbouw middle section, w02, 32 px/m): the same front, the glazed hall at its
 *    north end under the first window row, the lattice mast at its south end, the car-park entrance under it.
 *  - TMX7316010203-001710_pano_0000_000705 (voorbouw south section, w04, 2020, 34.7 px/m): light grey granite with thin
 *    pale storey lines, three rows of eighteen square punched windows (1.75 m, 3.63 m pitch), a 6.5 m colonnade of round
 *    columns on a 7.15 m pitch in front of glazing 2.2 m back, the open passage through to the south court.
 *  - recording_2025-07-01_11-45-33_00512 (north car park, w09): dark cladding panels, blank but for a few slits, the
 *    open deck bay with railings and the gate at its west end.
 *  - Commons 'Kingsfordweg 1 Amsterdam.jpg' and 'Boekhuis in 2016.jpg' (Choinowski 2016, CC BY-SA 4.0), 'Kingsfordweg.JPG'
 *    (Ilonamay 2015, CC BY-SA 4.0): the two tower leaves opened towards the Kingsfordweg, silver-grey panels with a
 *    ribbon window every storey, four dark vertical stripes on each broad face, full-height glazed leaf ends, the row of
 *    grilles under the roof; '2020 Wiel van Henneman, vooraanzicht/zijaanzicht.jpg' (Ceescamel 2020, CC BY-SA 4.0): Jeroen
 *    Henneman's wheel on the south leaf by the spine, the car park's grey base with slit grilles under a white band, the
 *    south slab's light panels and ribbons.
 *  - PDOK orthophoto (CC BY 4.0): the chevron plan, the courts, the slanted south slab.
 */

type V3 = [number, number, number];
type Op = HoledOpening & {back?: C | null; rev?: C};
/** A wall face on the ring edge a->b, seen from outside: t from the viewer's left end (b) to the right end (a). */
type Face = {L: number; P: (t: number, y: number, o: number) => V3};
function face(a: PlanPoint, b: PlanPoint): Face {
  const L = Math.hypot(a[0] - b[0], a[1] - b[1]), u = [(a[0] - b[0]) / L, (a[1] - b[1]) / L], n = edgeNormal(a, b);
  return {L, P: (t, y, o) => [b[0] + u[0] * t + n[0] * o, y, b[1] + u[1] * t + n[1] * o]};
}
function quad(acc: Acc, c: C, p: V3, q: V3, r: V3, s: V3) { acc.tri(c, p, q, r); acc.tri(c, p, r, s); }
function rect(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o = 0) {
  quad(acc, c, f.P(t0, y0, o), f.P(t1, y0, o), f.P(t1, y1, o), f.P(t0, y1, o));
}
/** A bar standing out of the face from o0 to o1: front, top, bottom, both ends. */
function bar(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number) {
  rect(acc, c, f, t0, t1, y0, y1, o1);
  quad(acc, c, f.P(t0, y1, o1), f.P(t1, y1, o1), f.P(t1, y1, o0), f.P(t0, y1, o0));
  quad(acc, c, f.P(t0, y0, o0), f.P(t1, y0, o0), f.P(t1, y0, o1), f.P(t0, y0, o1));
  quad(acc, c, f.P(t0, y0, o0), f.P(t0, y0, o1), f.P(t0, y1, o1), f.P(t0, y1, o0));
  quad(acc, c, f.P(t1, y0, o1), f.P(t1, y0, o0), f.P(t1, y1, o0), f.P(t1, y1, o1));
}
/** The wall from y0 to y1 with its openings cut: face, reveals, recessed backs (none where back is null: a through hole). */
function wall(acc: Acc, f: Face, y0: number, y1: number, c: C, ops: Op[]) {
  const ok = ops.filter(o => o.t1 > o.t0 + 0.05 && o.y1 > o.y0 + 0.05);
  const w = holedWall(f.L, y0, y1, ok);
  const em = (cc: C, q: {pts: V3[]}) => { const [a, b, d, e] = q.pts.map(([t, y, o]) => f.P(t, y, o)); quad(acc, cc, a, b, d, e); };
  for (const q of w.face) em(c, q);
  w.reveals.forEach((rs, i) => rs.forEach(q => em(ok[i].rev ?? c, q)));
  w.backs.forEach((q, i) => { const bk = ok[i].back; if (bk !== null) em(bk ?? 'glass', q); });
}
/** Mullions (vertical) and transoms inside a recessed opening, `gap` m in front of its back. */
function glazing(acc: Acc, f: Face, o: Op, c: C, cols: number, rows: number, gap = 0.09) {
  const oo = -o.depth + gap;
  for (let i = 1; i < cols; i++) { const t = o.t0 + (o.t1 - o.t0) * i / cols; rect(acc, c, f, t - 0.045, t + 0.045, o.y0, o.y1, oo); }
  for (let j = 1; j < rows; j++) { const y = o.y0 + (o.y1 - o.y0) * j / rows; rect(acc, c, f, o.t0, o.t1, y - 0.045, y + 0.045, oo + 0.01); }
}
/** A curtain wall: one recessed opening per mullion bay over the whole face, storey transoms across each bay. */
function curtain(acc: Acc, f: Face, y0: number, y1: number, frame: C, pitch: number, storey: number, glass: C = 'glass') {
  const n = Math.max(1, Math.round(f.L / pitch)), m = 0.06, ops: Op[] = [];
  for (let i = 0; i < n; i++) ops.push({t0: f.L * i / n + m, t1: f.L * (i + 1) / n - m, y0: y0 + 0.15, y1: y1 - 0.15, depth: 0.17, back: glass, rev: frame});
  wall(acc, f, y0, y1, frame, ops);
  const k = Math.max(1, Math.round((y1 - y0) / storey));
  for (const o of ops) for (let j = 1; j < k; j++) { const y = y0 + (y1 - y0) * j / k; rect(acc, frame, f, o.t0, o.t1, y - 0.06, y + 0.06, -0.06); }
}
/** Edges of a ring as faces (ring made counter-clockwise first). */
function edges(r: PlanPoint[]) { const c = ccw(r); return c.map((a, i) => ({a, b: c[(i + 1) % c.length], f: face(a, c[(i + 1) % c.length]), n: edgeNormal(a, c[(i + 1) % c.length])})); }
const shape = (r: PlanPoint[]) => [[ccw(r)]];

// ---- plans (BAG ring and 3DBAG roof parts; see the footprints file) ---------------------------------------------------
const WSN: PlanPoint[] = [[-35.303, -142.841], [-34.969, -63.483], [-31.667, -63.495], [-31.653, -60.198], [-34.955, -60.184], [-34.613, 21.354], [-20.0, 21.354], [-20.0, -20.3], [-20.0, -101.0], [-20.0, -103.6], [-20.317, -103.59], [-20.522, -147.45], [-31.719, -143.958]];
const WSS: PlanPoint[] = [[-31.108, 21.05], [-31.079, 26.817], [-34.609, 26.838], [-34.323, 96.423], [-21.117, 96.355], [-21.235, 70.922], [-21.273, 56.406], [-21.381, 26.805], [-26.329, 26.811], [-26.335, 21.05]];
const GARAGE: PlanPoint[] = [[-3.151, -152.864], [29.635, -163.098], [29.954, -79.692], [21.614, -79.659], [-2.921, -103.624]];
const TOWER: PlanPoint[] = [[-23.5, -101.0], [-12.0, -101.0], [18.8, -70.9], [26.449, -70.929], [26.52, -53.227], [18.5, -53.9], [-11.1, -22.9], [-23.1, -23.0], [-23.8, -29.3], [-21.0, -32.8], [7.65, -61.55], [-23.4, -92.6]];
const INNER: PlanPoint[] = [[-20.2, -89.4], [7.65, -61.55], [-20.2, -33.7]];
const HOLE_CURVE: PlanPoint[] = [[13.611, -15.627], [12.011, -14.426], [10.349, -13.313], [8.63, -12.292], [6.858, -11.364], [5.039, -10.532], [3.178, -9.8], [1.28, -9.169], [-0.649, -8.64], [-2.603, -8.216], [-4.578, -7.898], [-6.575, -7.995], [-8.528, -8.426], [-10.381, -9.179], [-12.082, -10.232], [-13.595, -11.54], [-14.837, -13.107], [-15.816, -14.851], [-16.489, -16.735], [-16.836, -18.704], [-16.875, -20.245], [-19.976, -20.233]];
const HALL: PlanPoint[] = [[-20.3, -23.3], [-11.1, -23.3], [18.5, -54.3], [22.0, -53.6], [22.0, -44.2], [14.0, -44.2], [14.0, -15.3], ...HOLE_CURVE, [-20.3, -20.23]];
const EAST: PlanPoint[] = [[13.65, -44.46], [30.094, -44.492], [30.361, 21.079], [25.683, 21.101], [25.68, 21.4], [14.27, 21.4], [14.262, 21.152], [13.756, 21.153], [13.611, -15.627]];
const LINK5: PlanPoint[] = [[14.2, 21.1], [25.6, 21.1], [25.6, 26.9], [14.2, 26.9]];
const LINK54: PlanPoint[] = [[-20.3, -103.62], [-2.6, -103.62], [-2.6, -100.7], [-20.3, -100.7]];
const PARK: PlanPoint[] = [[14.277, 26.6], [30.404, 26.575], [30.653, 93.763], [23.8, 93.774], [23.6, 77.6], [17.9, 71.6], [17.9, 56.3], [14.111, 56.276]];
const LINK25: PlanPoint[] = [[-27.2, 56.4], [-21.1, 56.4], [-9.0, 56.4], [-9.0, 64.8], [-5.373, 70.853], [-21.1, 70.85], [-27.2, 70.85]];
const SLAB: PlanPoint[] = [[-9.6, 45.4], [-8.2, 44.9], [24.0, 77.6], [24.2, 98.0], [20.015, 93.79], [14.267, 93.812], [14.222, 88.168], [-6.1, 68.2], [-9.6, 64.6]];
const B26: PlanPoint[] = [[2.4, 56.3], [18.4, 56.3], [18.4, 71.2], [17.2, 71.2]];
const H = {link54: 5.4, wsn: 18.1, wss: 19.1, garage: 18.8, core: 23.1, tower: 82.0, inner: 9.7, hall: 9.3, east: 15.5, link5: 5.5, park: 8.2, link25: 25.6, slab: 58.7, slabTop: 62.1, b26: 26.4};

/** Generic ribbons on an inferred wall: rows at the given heights, windows `w` wide on `pitch`, centred. */
function ribbonOps(L: number, rows: [number, number][], w: number, pitch: number, rev: C): Op[] {
  const n = Math.floor((L - 1.2 + (pitch - w)) / pitch);
  if (n < 1) return [];
  const span = n * pitch - (pitch - w), s = (L - span) / 2, out: Op[] = [];
  for (const [y0, y1] of rows) for (let k = 0; k < n; k++) out.push({t0: s + k * pitch, t1: s + k * pitch + w, y0, y1, depth: 0.2, rev});
  return out;
}
/** The passage through the south section (w04: 44.2-52.8 m from its north end). */
const PZ0 = 71.04, PZ1 = 79.64;
const DARK_ROWS: [number, number][] = [[5.65, 6.95], [9.85, 11.15], [13.85, 15.15]];

// ---- the voorbouw on the Kingsfordweg ---------------------------------------------------------------------------------
/** Dark granite front, north and middle sections (w03, w02). */
function darkFront(acc: Acc, b: BuildingTools, f: Face, top: number, spec: {wins: [number, number][]; piers: number[]; lobby: [number, number, number]; lowSkip: [number, number]; garageGate?: [number, number]; mast?: number}) {
  const ops: Op[] = [];
  const [l0, l1, lTop] = spec.lobby;
  // ground storey: glazing 1.6 m behind the piers (0.9 m), except where the hall's glass rises in the wall plane
  const cuts = [0, ...spec.piers.flatMap(p => [p - 0.45, p + 0.45]), f.L];
  for (let i = 0; i + 1 < cuts.length; i += 2) {
    let a = cuts[i], e = cuts[i + 1];
    if (e <= a) continue;
    if (a < l1 && e > l0) { if (a < l0) ops.push({t0: a, t1: l0 - 0.3, y0: 0, y1: 3.9, depth: 1.6, back: 'canopyGlass', rev: 'stone'}); if (e > l1) ops.push({t0: l1 + 0.3, t1: e, y0: 0, y1: 3.9, depth: 1.6, back: 'canopyGlass', rev: 'stone'}); continue; }
    if (spec.garageGate && a < spec.garageGate[1] && e > spec.garageGate[0]) { ops.push({t0: Math.max(a, spec.garageGate[0]), t1: Math.min(e, spec.garageGate[1]), y0: 0, y1: 2.9, depth: 3, back: 'dark', rev: 'stone'}); continue; }
    ops.push({t0: a, t1: e, y0: 0, y1: 3.9, depth: 1.6, back: 'canopyGlass', rev: 'stone'});
  }
  for (const o of ops) { o.t0 = Math.max(o.t0, 0.4); o.t1 = Math.min(o.t1, f.L - 0.4); }
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].t1 - ops[i].t0 < 1) ops.splice(i, 1);
  // the hall's glass in two tiers on the floor-slab line at 3.9-4.3 m (the transom band level with the colonnade soffit)
  const lobby: Op = {t0: l0, t1: l1, y0: 0, y1: 3.9, depth: 0.35, back: 'glass', rev: 'frame'};
  const lobbyUp: Op = {t0: l0, t1: l1, y0: 4.3, y1: lTop, depth: 0.35, back: 'glass', rev: 'frame'};
  ops.push(lobby, lobbyUp);
  const wins: Op[] = [];
  for (const [y0, y1] of DARK_ROWS) for (const [t0, t1] of spec.wins) {
    if (y0 < lTop + 0.3 && t1 > l0 && t0 < l1) continue;
    if (y0 < 7 && t1 > spec.lowSkip[0] && t0 < spec.lowSkip[1]) continue;
    wins.push({t0, t1, y0, y1, depth: 0.22, back: 'glass', rev: 'frame'});
  }
  ops.push(...wins);
  wall(acc, f, 0, top, 'stone', ops);
  for (const w of wins) glazing(acc, f, w, 'frame', Math.round((w.t1 - w.t0) / 0.75), 2);
  glazing(acc, f, lobby, 'frame', Math.round((l1 - l0) / 1.5), 2);
  glazing(acc, f, lobbyUp, 'frame', Math.round((l1 - l0) / 1.5), Math.max(1, Math.round((lTop - 4.3) / 2.1)));
  if (spec.mast !== undefined) {
    // the lattice mast at the south end of the middle section: two posts 0.5 m off the granite, rungs every metre
    const t = spec.mast;
    for (const s of [t - 0.55, t + 0.55]) b.add(tube(pl(f, s, 0.55), 4.6, pl(f, s, 0.55), 20.1, 0.07, 4), 'frame');
    for (let y = 5.2; y < 20; y += 1.0) b.add(tube(pl(f, t - 0.55, 0.55), y, pl(f, t + 0.55, 0.55), y + 0.5, 0.035, 4), 'frame');
    for (const y of [5.0, 11.0, 17.0]) for (const s of [t - 0.55, t + 0.55]) b.add(tube(pl(f, s, -0.05), y, pl(f, s, 0.55), y, 0.05, 4), 'frame');
  }
}
const pl = (f: Face, t: number, o: number): PlanPoint => { const p = f.P(t, 0, o); return [p[0], p[2]]; };

/** Light granite front, south section (w04): colonnade, recessed glazing, the passage, punched windows. */
function lightFront(acc: Acc, b: BuildingTools, f: Face, top: number, passage: [number, number], cols: number[]) {
  const G = 6.5, REC = 2.2;
  const ops: Op[] = [
    {t0: 0, t1: passage[0], y0: 0, y1: G, depth: REC, back: 'canopyGlass', rev: 'concrete'},
    {t0: passage[1], t1: f.L, y0: 0, y1: G, depth: REC, back: 'canopyGlass', rev: 'concrete'},
    {t0: passage[0], t1: passage[1], y0: 0, y1: G, depth: REC, back: null, rev: 'concrete'},
  ];
  const wins: Op[] = [];
  for (const yc of [9.2, 12.8, 16.4]) for (let k = 0; k < 18; k++) { const t0 = 1.0 + k * 3.63; if (t0 + 1.75 < f.L - 0.4) wins.push({t0, t1: t0 + 1.75, y0: yc - 0.875, y1: yc + 0.875, depth: 0.25, back: 'glass', rev: 'frame'}); }
  ops.push(...wins);
  wall(acc, f, 0, top, 'concrete', ops);
  for (const w of wins) glazing(acc, f, w, 'frame', 1, 2);
  for (const y of [7.4, 11.0, 14.6, 18.2]) bar(acc, 'white', f, 0, f.L, y, y + 0.12, 0, 0.1);
  for (const t of cols) { const g = new T.CylinderGeometry(0.42, 0.42, G, 10, 1, true); const p = pl(f, t, -0.9); g.translate(p[0], G / 2, p[1]); b.add(g, 'blue'); }
}

/** A generic punched or ribbon wall on an inferred side. */
function inferredDark(acc: Acc, f: Face, top: number) {
  if (f.L < 3) { wall(acc, f, 0, top, 'stone', []); return; }
  const ops = ribbonOps(f.L, [[1.1, 2.7], ...DARK_ROWS.filter(r => r[1] < top - 1)], Math.min(5.9, f.L - 1.4), 7.2, 'frame');
  wall(acc, f, 0, top, 'stone', ops);
}
function inferredLight(acc: Acc, f: Face, y0: number, top: number) {
  const rows: [number, number][] = [];
  for (let y = y0 + 1.6; y + 1.9 < top; y += 3.6) rows.push([y, y + 1.75]);
  wall(acc, f, y0, top, 'concrete', f.L > 3 ? ribbonOps(f.L, rows, 1.75, 3.63, 'frame') : []);
}

function voorbouw(acc: Acc, b: BuildingTools) {
  for (const {a, b: e, f, n} of edges(WSN)) {
    const west = n[0] < -0.9, xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    if (west && xm < -34 && zm < -62) {
      // north section (w03): 79.4 m; t from the north end
      const wins: [number, number][] = [[1.1, 4.7], ...Array.from({length: 10}, (_, k) => [5.9 + 7.26 * k, 11.9 + 7.26 * k] as [number, number])];
      darkFront(acc, b, f, H.wsn, {wins, piers: Array.from({length: 9}, (_, k) => 5.75 + 7.2 * k), lobby: [63.5, 75.5, 8.2], lowSkip: [63, 80]});
    } else if (west && xm < -34) {
      // middle section (w02): 81.5 m
      const wins: [number, number][] = Array.from({length: 11}, (_, k) => [2.8 + 7.05 * k, 8.6 + 7.05 * k] as [number, number]);
      darkFront(acc, b, f, H.wsn, {wins, piers: Array.from({length: 9}, (_, k) => 16.1 + 7.0 * k), lobby: [0.6, 15.6, 6.5], lowSkip: [0, 16.5], garageGate: [74.6, 79.4], mast: 73.3});
    } else if (west) curtain(acc, f, 0, H.wsn, 'white', 1.6, 3.6);            // the entrance notch between the sections
    else if (Math.abs(n[1]) > 0.9 && Math.abs(zm + 61.8) < 2) curtain(acc, f, 0, H.wsn, 'white', 1.6, 3.6);
    else if (n[0] > 0.9 && zm > -20.3 && zm < 21.4) inferredDark(acc, f, H.wsn);   // the court side
    else if (n[0] > 0.9 && zm > -101 && zm < -20.3) wall(acc, f, 0, H.wsn, 'stone', ribbonOps(f.L, DARK_ROWS.slice(1), 5.9, 7.2, 'frame').filter(o => o.t0 > 12.3 && o.t1 < 66.6));   // over the roof between the leaves (t from the north end)
    else inferredDark(acc, f, H.wsn);
  }
  roof(b, shape(WSN), H.wsn, 'slate');
  for (const {f, n, a, b: e} of edges(WSS)) {
    const zm = (a[1] + e[1]) / 2;
    if (n[0] < -0.9 && f.L > 60) lightFront(acc, b, f, H.wss, [PZ0 - 26.838, PZ1 - 26.838], [7.6, 14.8, 22.2, 29.4, 36.5, 43.7, 52.9, 60.0, 67.0]);
    else if (Math.abs(zm - 21.05) < 0.01) wall(acc, f, 0, H.wss, 'concrete', []);                                         // inside the north section
    else if (n[0] < -0.9 || (Math.abs(n[1]) > 0.9 && zm < 27 && f.L < 6)) curtain(acc, f, 0, H.wss, 'white', 1.6, 3.6);     // the glazed entrance hall (w27)
    else if (n[1] > 0.9 && zm > 96) curtain(acc, f, 0, H.wss, 'concrete', 1.6, 3.6);                                     // the glazed south end (w15)
    else if (n[0] > 0.9 && zm > 70.9) {
      // the south court side (w10): the passage comes through at 71.0-79.6 under the same 6.5 m soffit
      const t0 = 96.355 - PZ1, t1 = 96.355 - PZ0;   // t runs from the south end
      const ops: Op[] = [{t0, t1, y0: 0, y1: 6.5, depth: 0.3, back: null, rev: 'concrete'}, {t0: 0.5, t1: t0 - 0.9, y0: 0, y1: 4.2, depth: 0.25, back: 'canopyGlass', rev: 'frame'}];
      for (const yc of [9.2, 12.8, 16.4]) for (let k = 0; k < 6; k++) { const a0 = 1.2 + k * 3.63; if (a0 + 1.75 < f.L - 0.4) ops.push({t0: a0, t1: a0 + 1.75, y0: yc - 0.875, y1: yc + 0.875, depth: 0.25, back: 'glass', rev: 'frame'}); }
      wall(acc, f, 0, H.wss, 'concrete', ops);
    } else inferredLight(acc, f, 0, H.wss);
  }
  roof(b, shape(WSS), H.wss, 'slate');
  // the passage (z 71.0-79.6) through the south section: side walls and the soffit
  {
    const x0 = -34.45 + 2.2, x1 = -21.5, z0 = PZ0, z1 = PZ1, G = 6.5;
    wall(acc, face([x1, z0], [x0, z0]), 0, G, 'concrete', []);   // the passage's north wall, facing south
    wall(acc, face([x0, z1], [x1, z1]), 0, G, 'concrete', []);   // its south wall, facing north
    soffit(b, [[ccw([[x0, z0], [x1, z0], [x1, z1], [x0, z1]])]], G, 'concrete');
  }
}

// ---- the north car park -----------------------------------------------------------------------------------------------
function garage(acc: Acc, b: BuildingTools) {
  for (const {f, n} of edges(GARAGE)) {
    const north = n[1] < -0.9;
    const ops: Op[] = north ? [{t0: 5.9, t1: 11.6, y0: 0, y1: 6.3, depth: 3.0, back: 'dark', rev: 'concrete'}] : [];
    wall(acc, f, 0, H.garage, 'copper', ops);
    for (let y = 2.45; y < H.garage - 0.5; y += 2.45) bar(acc, 'bronze', f, 0, f.L, y, y + 0.08, 0, 0.1);
    if (north) {
      for (const y of [3.1, 5.4]) {
        bar(acc, 'concrete', f, 5.9, 11.6, y - 0.35, y, -3.0, -0.05);
        b.add(tube(pl(f, 5.95, -0.15), y + 1.0, pl(f, 11.55, -0.15), y + 1.0, 0.04, 4), 'pink');
        for (const t of [6.0, 7.4, 8.75, 10.1, 11.5]) b.add(tube(pl(f, t, -0.15), y - 0.02, pl(f, t, -0.15), y + 1.0, 0.03, 4), 'pink');
      }
    }
  }
  roof(b, shape(GARAGE), H.garage, 'slate');
  // the stair core on the roof (3DBAG 23.1 m)
  const core: PlanPoint[] = [[-2.9, -114.0], [2.8, -114.1], [2.2, -104.4], [-2.9, -104.2]];
  for (const {f} of edges(core)) wall(acc, f, H.garage - 0.3, H.core, 'copper', []);
  // the low link between the car park and the voorbouw, north of the tower (3DBAG 5.4 m)
  for (const {f} of edges(LINK54)) wall(acc, f, 0, H.link54, 'stone', []);
  roof(b, shape(LINK54), H.link54, 'slate');
  roof(b, shape(core), H.core, 'slate');
}

// ---- the open-book tower ------------------------------------------------------------------------------------------------
const FLOOR0 = 4.2, STOREY = 3.75, STOREYS = 20, TOPBAND = 78.6;
function towerPanel(acc: Acc, f: Face, yLow: number) {
  const stripes = f.L > 30 ? [1, 2, 3, 4].map(i => f.L * i / 5) : [];
  const bays: [number, number][] = [];
  const cuts = [0.9, ...stripes.flatMap(s => [s - 1.25, s + 1.25]), f.L - 0.9];
  for (let i = 0; i + 1 < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 1) bays.push([cuts[i], cuts[i + 1]]);
  const ops: Op[] = [];
  for (let k = 0; k < STOREYS - 1; k++) {
    const y0 = FLOOR0 + k * STOREY + 1.0, y1 = y0 + 1.45;
    if (y0 < yLow || y1 > TOPBAND - 0.6) continue;
    for (const [t0, t1] of bays) ops.push({t0, t1, y0, y1, depth: 0.2, back: 'glass', rev: 'white'});
  }
  // the row of grilles under the roof
  const g = Math.max(2, Math.round(f.L / 5.5));
  for (let i = 0; i < g; i++) { const tc = f.L * (i + 0.5) / g; ops.push({t0: tc - 1.2, t1: tc + 1.2, y0: 79.3, y1: 79.9, depth: 0.15, back: 'dark', rev: 'white'}); }
  wall(acc, f, 0, H.tower, 'white', ops);
  for (const s of stripes) bar(acc, 'bronze', f, s - 0.75, s + 0.75, Math.max(yLow, 0), 75.6, 0, 0.3);
}
function tower(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(TOWER)) {
    const xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    const end = f.L < 16 && xm < -10;            // the leaf ends towards the Kingsfordweg: glazed full height
    const apex = xm > 20 && f.L < 20;            // the spine block's faces
    const inner = Math.hypot(xm - 7.65, zm + 61.55) < 35 && f.L > 30 && (n[0] < 0);
    if (end) { wall(acc, f, 0, H.wsn + 0.3, 'white', []); curtain(acc, f, H.wsn + 0.3, H.tower, 'white', 1.45, STOREY, 'glass'); }
    else if (apex) towerPanel(acc, f, 9.6);
    else towerPanel(acc, f, inner ? H.inner + 0.3 : (zm > -60 ? H.hall + 0.3 : 4.0));
  }
  roof(b, shape(TOWER), H.tower, 'slate');
  // parapet cap and the plant rooms (3DBAG 82.8-84.7 m pieces)
  for (const [x, z, w, d, h] of [[-0.5, -79.5, 7, 5, 1.6], [-0.5, -42.5, 7, 5, 1.6], [16, -62, 5, 6, 2.4]] as const) {
    const r: PlanPoint[] = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]];
    for (const {f} of edges(r)) wall(acc, f, H.tower - 0.2, H.tower + h, 'white', []);
    roof(b, shape(r), H.tower + h, 'slate');
  }
  // Jeroen Henneman's wheel on the south leaf by the spine, its plane along the leaf (Commons 2020 Wiel van Henneman)
  {
    const c: PlanPoint = [13.6, -54.6], R = 3.0, along = Math.atan2(-1, 1);
    const ring = new T.TorusGeometry(R, 0.2, 6, 28);
    ring.rotateY(-along); ring.translate(c[0], H.tower + 1.3 + R, c[1]);
    b.add(ring, 'copper');
    b.add(tube(c, H.tower - 0.1, c, H.tower + 1.4, 0.18, 6), 'copper');
    // the short arm on the rim (the 'handle' seen at its left in the photos)
    const ax = Math.cos(along), az = Math.sin(along);
    b.add(tube([c[0] - ax * R, c[1] - az * R], H.tower + 1.3 + R, [c[0] - ax * (R + 1.1), c[1] - az * (R + 1.1)], H.tower + 1.3 + R + 0.6, 0.12, 4), 'copper');
  }
  // the roof between the leaves
  roof(b, shape(INNER), H.inner, 'slate');
}

// ---- low east parts and the court hall --------------------------------------------------------------------------------
function low(acc: Acc, b: BuildingTools) {
  // the hall on the court: glass along the curve (the court views w10/w11/w13), flat roof
  const curveKeys = new Set(HOLE_CURVE.map(p => p.join(',')));
  for (const {f, a, b: e} of edges(HALL)) {
    if (curveKeys.has(a.join(',')) && curveKeys.has(e.join(','))) curtain(acc, f, 0, H.hall, 'white', 1.8, 4.6);
    else wall(acc, f, 0, H.hall, 'stone', []);   // inside the leaf, the voorbouw and the east wing
  }
  roof(b, shape(HALL), H.hall, 'slate');
  for (const {f, n, a, b: e} of edges(EAST)) {
    if (n[0] > 0.9 || (n[0] < -0.9 && f.L > 20 && (a[1] + e[1]) / 2 > -15)) inferredDark(acc, f, H.east);
    else wall(acc, f, 0, H.east, 'stone', []);
  }
  roof(b, shape(EAST), H.east, 'slate');
  // the glazed link to the car park (inferred: a door-height glass front between granite piers)
  for (const {f, n} of edges(LINK5)) wall(acc, f, 0, H.link5, 'stone', Math.abs(n[0]) > 0.9 ? [{t0: 0.8, t1: f.L - 0.8, y0: 0.3, y1: 4.4, depth: 0.25, back: 'glass', rev: 'white'}] : []);
  roof(b, shape(LINK5), H.link5, 'slate');
  // the small pavilion in the court over the underground car park (BAG 0363100012204651, OSM w268460654, 3.8 m from
  // 3DBAG; not photographed: inferred as granite with a glazed door)
  const PAV: PlanPoint[] = [[-14.92, 14.11], [-8.83, 14.04], [-8.89, 8.57], [-14.98, 8.64]];
  for (const {f, n} of edges(PAV)) wall(acc, f, 0, 3.8, 'stone', n[1] > 0.9 ? [{t0: f.L / 2 - 0.9, t1: f.L / 2 + 0.9, y0: 0, y1: 2.6, depth: 0.2, back: 'glass', rev: 'white'}] : []);
  roof(b, shape(PAV), 3.8, 'slate');
  // the car park along the Ringweg (Commons 2020 Wiel van Henneman, vooraanzicht): grey base with slit grilles, white band
  for (const {f, n} of edges(PARK)) {
    const out = n[0] > 0.9 || n[1] > 0.9;
    const ops: Op[] = [];
    if (out && f.L > 6) for (let t = 1.6; t + 0.9 < f.L - 1; t += 3.0) ops.push({t0: t, t1: t + 0.9, y0: 1.3, y1: 4.1, depth: 0.15, back: 'dark', rev: 'blue'});
    wall(acc, f, 0, 5.4, 'blue', ops);
    wall(acc, f, 5.4, H.park, 'pink', []);
  }
  roof(b, shape(PARK), H.park, 'slate');
}

// ---- the south slab and its links ---------------------------------------------------------------------------------------
function slabFace(acc: Acc, f: Face, y0: number, top: number, ground?: {cols: number[]}, winFrom = 7.2, hidden?: (p: V3, y: number) => boolean) {
  const ops: Op[] = [];
  // w11 (2024): a close grid of tall windows between light piers, one per 1.8 m panel, about 2.2 m of every 3.6 m storey
  const bays = Math.max(1, Math.round(f.L / 1.8)), bw = f.L / bays;
  for (let y = Math.max(y0, winFrom) + 0.7; y + 2.2 < top - 1.6; y += 3.6) for (let i = 0; i < bays; i++) if (bw > 1.2 && !(hidden && hidden(f.P((i + 0.5) * bw, 0, 0), y))) ops.push({t0: i * bw + 0.22, t1: (i + 1) * bw - 0.22, y0: y, y1: y + 2.2, depth: 0.18, back: 'glass', rev: 'ochre'});
  if (ground) ops.push({t0: 0.3, t1: f.L - 0.3, y0: 0, y1: 6.8, depth: 3.0, back: 'canopyGlass', rev: 'ochre'});
  else if (y0 === 0 && winFrom < 7.5 && f.L > 4) ops.push({t0: 0.5, t1: f.L - 0.5, y0: 0.4, y1: 5.6, depth: 0.3, back: 'canopyGlass', rev: 'frame'});
  wall(acc, f, y0, top, 'ochre', ops);
}
function south(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(SLAB)) {
    const sw = n[0] < -0.6 && n[1] > 0.6 && f.L > 15;     // the court face, standing on columns over the south court (w11)
    const end = (a[1] + e[1]) / 2 > 85;   // the south end faces over the car park and the Ringweg
    slabFace(acc, f, 0, H.slab, sw ? {cols: [f.L * 0.3, f.L * 0.7]} : undefined, sw ? 7.2 : end ? 8.4 : H.b26 + 0.2);
    if (sw) for (const s of [0.3, 0.7]) { const g = new T.CylinderGeometry(0.55, 0.55, 6.8, 12, 1, true); const p = pl(f, f.L * s, -1.6); g.translate(p[0], 3.4, p[1]); b.add(g, 'white'); }
  }
  roof(b, shape(SLAB), H.slab, 'slate');
  const top: PlanPoint[] = [[-7.6, 64.6], [-0.2, 57.8], [-7.0, 50.1], [-8.1, 53.7]];
  for (const {f} of edges(top)) wall(acc, f, H.slab - 0.2, H.slabTop, 'ochre', []);
  roof(b, shape(top), H.slabTop, 'slate');
  for (const {f, n, a, b: e} of edges(LINK25)) {
    const xm = (a[0] + e[0]) / 2, inWss = xm < -21.1;
    if (n[1] > 0.9 && !inWss) { curtain(acc, f, 0, 7.0, 'white', 1.8, 3.5); inferredLight(acc, f, 7.0, H.link25); }   // the court front (w13)
    else if (inWss || n[0] < -0.9) { wall(acc, f, 0, H.wss + 0.3, 'concrete', []); inferredLight(acc, f, H.wss + 0.3, H.link25); }
    else if (n[0] > 0.9) wall(acc, f, 0, H.link25, 'concrete', []);   // inside the slab
    else inferredLight(acc, f, 0, H.link25);
  }
  roof(b, shape(LINK25), H.link25, 'slate');
  for (const {f, n} of edges(B26)) slabFace(acc, f, n[1] < -0.9 ? 0 : H.park - 0.3, H.b26, undefined, n[1] < -0.9 ? 6.0 : 8.4, (p, y) => p[0] > 13.6 && y < H.park + 0.3);   // the car park's roof against its north face east of x 14.1
  roof(b, shape(B26), H.b26, 'slate');
}

export function buildBelastingdienstAmsterdam(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  voorbouw(acc, b);
  garage(acc, b);
  tower(acc, b);
  low(acc, b);
  south(acc, b);
  acc.flush();
}
