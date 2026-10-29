import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {edgeBox, edgesOf, hipRoof, gableRoofQuad, flatRoof, surface, p3, type Col, type Edge} from './civic-kit';
import {lathe, octagon} from './church-kit';
import {exposedRuns, exposedWalls, mansardRoof, ogeeProfile, wallQuad, type Part, type Run, type V2} from './pavilion-kit';
import source from './stationsplein-paviljoens-footprints.json';

/**
 * Noord-Zuid Hollandsch Koffiehuis and its GVB and Loetje pavilions on the Stationsplein island (BAG pand
 * 0363100012182895, Stationsplein 4-16). J.H.W. Leliman's 1911 timber koffiehuis, after the stolp farmhouse and the
 * Paalhuis, rebuilt in 1980 with the GVB aanbouw and torentjes (2003). Cream-painted timber walls with white trim,
 * red-tile hips and mansards, two lead-capped turrets.
 *
 * Masses are the OSM building:part rings (local metres, x east, z south) with AHN4 heights above the 3.2 m NAP
 * plaza. The Loetje block is one authored ring (OSM 0327/0331/0333/0334/0335 joined, south façade moved onto the BAG
 * line, where AHN puts the eaves 1.5-2 m south of the OSM ring). The plaza storey only: the water side has a lower
 * deck storey about 2.3 m below the plaza that the flat game ground cannot show.
 */
const R = source.parts as unknown as Record<string, V2[]>;
const ring = (id: string): V2[] => R[id].map(p => [p[0], p[1]] as V2);

// Heights above the plaza (AHN4 DSM minus 3.2 m NAP; see footprints `sources`).
export const H = {
  hall: 4.4, west: {eave: 5.0, ridge: 7.8}, block: 6.2, stolp: {eave: 5.0, apex: 10.4}, wing: {eave: 5.0, ridge: 8.4},
  loetje: {eave: 4.6, top: 7.3, inset: 2.6}, kiosk: {eave: 3.9, ridge: 7.3},
};
/**
 * Loetje block ring: 0327 north edge, 0331 NW edge, 0334 NE edge, BAG south line; west side on the stolp's east wall;
 * south-west edge on the hall's south-strip line, so the strip owns that plaza storey (no sliver between them).
 */
export const LOETJE: V2[] = [[-1.7, -0.2], [-3.4, 7.6], [2.4, 8.95], [19.9, 14.7], [25.6, 7.6], [9.8, -4.2], [4.7, 2.3]];
/** Inset per LOETJE edge: the edge on the stolp's wall gets no slope. */
export const LOETJE_INSETS = [0, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6];

/**
 * OSM 0329 with its south edge moved 0.3 m inside the hall's south strip line: the two walls were 2.5 cm apart and both
 * glazed. The strip owns the plaza storey there; the wing's wall shows above the strip roof.
 */
export function wingRing(): V2[] {
  const w = ring('w752700329'), a: V2 = [-17.9, 7.5], c: V2 = [2.0, 11.7];
  const u: V2 = [c[0] - a[0], c[1] - a[1]], L = Math.hypot(u[0], u[1]), n: V2 = [u[1] / L, -u[0] / L]; // n points north (inside)
  const snap = (p: V2): V2 => { const t = ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) / L / L; return [a[0] + u[0] * t + n[0] * .3, a[1] + u[1] * t + n[1] * .3]; };
  return [snap(w[0]), snap(w[1]), w[2], w[3]];
}
export function islandParts(): Record<string, Part> {
  return {
    hall: {ring: ring('w752700326'), top: H.hall},
    west: {ring: ring('w752700325'), top: H.west.eave},
    block: {ring: ring('w752713621'), top: H.block},
    stolp: {ring: ring('w752700330'), top: H.stolp.eave},
    wing: {ring: wingRing(), top: H.wing.eave},
    loetje: {ring: LOETJE, top: H.loetje.eave},
    kiosk: {ring: ring('w57864041'), top: H.kiosk.eave},
  };
}

const runEdge = (r: Run, off = 0): Edge => {
  const p = new T.Vector2(r.a[0] + r.out[0] * off, r.a[1] + r.out[1] * off), q = new T.Vector2(r.b[0] + r.out[0] * off, r.b[1] + r.out[1] * off);
  const u = q.clone().sub(p), len = u.length(); u.divideScalar(len || 1);
  const out = new T.Vector2(r.out[0], r.out[1]);
  return {p, q, u, out, len, angle: Math.atan2(out.x, out.y), mid: p.clone().lerp(q, .5)};
};

/**
 * Multi-pane timber window: a white frame of four bars standing 9 cm out, glass 4 cm out inside the opening, glazing bars
 * 8 cm out and a sill. Same-facing faces of different materials stay at least 4 cm apart (z-fight band).
 */
function pane(b: BuildingTools, e: Edge, t: number, y: number, w: number, h: number, o: {cols?: number; rows?: number; glass?: Col; bar?: Col} = {}) {
  const cols = o.cols ?? 3, rows = o.rows ?? 2, bar = o.bar ?? 'white', f = .09;
  edgeBox(b, e, t, y + h, w + 2 * f, f, f, f / 2, 'white');
  edgeBox(b, e, t, y - f, w + 2 * f, f, f, f / 2, 'white');
  for (const s of [-1, 1]) edgeBox(b, e, t + s * (w + f) / 2, y, f, h, f, f / 2, 'white');
  edgeBox(b, e, t, y, w, h, .04, .02, o.glass ?? 'glass');
  for (let i = 1; i < cols; i++) edgeBox(b, e, t - w / 2 + (w * i) / cols, y, .05, h, .04, .06, bar);
  for (let j = 1; j < rows; j++) edgeBox(b, e, t, y + (h * j) / rows, w, .05, .04, .06, bar);
  edgeBox(b, e, t, y - f - .07, w + .34, .07, .18, .09, 'white');
}
/** Window row along a run: evenly spaced, `pitch` apart, kept `margin` from the run ends. Returns the centres. */
function windowRow(b: BuildingTools, r: Run, y: number, w: number, h: number, pitch: number, o: Parameters<typeof pane>[6] = {}, margin = .5): number[] {
  const e = runEdge(r), L = e.len, n = Math.floor((L - 2 * margin + (pitch - w)) / pitch);
  if (n < 1 || h < .8) return [];
  const span = (n - 1) * pitch, ts = Array.from({length: n}, (_, k) => L / 2 - span / 2 + k * pitch);
  for (const t of ts) pane(b, e, t, y, w, h, o);
  return ts;
}
/**
 * Cornice band over a ground run, 20 cm short of each run end so no box end stands past a corner or into a neighbour
 * (the audit's opening-outside rule). Upper bands above a lower neighbour's roof carry one only when at least 1 m tall
 * and 1.5 m long.
 */
function cornice(b: BuildingTools, r: Run, y: number, h = .3, d = .35, c: Col = 'white') {
  const e = runEdge(r), y0 = Math.max(y, r.from + .02), hh = y + h - y0;
  if (hh < .08 || e.len < (r.from > 0 ? 1.5 : .8) || (r.from > 0 && y + h - r.from < 1.0)) return;
  edgeBox(b, e, e.len / 2, y0, e.len - .4, hh, d, d / 2, c);
}

/** Pediment gable dormer standing on a wall: body with windows, raked white cornices, crest and finial. */
function pedimentDormer(b: BuildingTools, e: Edge, t: number, base: number, o: {w: number; body: number; rise: number; depth: number; finial: number; crest?: boolean; glass?: Col; front?: number}) {
  const {w, body, rise, depth} = o, top = base + body, f0 = o.front ?? .38;
  // stand the dormer in front of the main roof's 30 cm eave overhang, on the cornice, so the hip never covers it
  e = {...e, p: e.p.clone().addScaledVector(e.out, f0 - .05)};
  const at = e.p.clone().addScaledVector(e.u, t);
  // body, set 5 cm proud of the wall below so its front never sits in the wall plane
  edgeBox(b, e, t, base, w, body, depth, -depth / 2 + .05, 'stone');
  pane(b, {...e, p: e.p.clone().addScaledVector(e.out, .05)}, t - w * .22, base + .3, w * .34, body - .6, {cols: 2, rows: 3, glass: o.glass});
  pane(b, {...e, p: e.p.clone().addScaledVector(e.out, .05)}, t + w * .22, base + .3, w * .34, body - .6, {cols: 2, rows: 3, glass: o.glass});
  edgeBox(b, e, t, top, w + .4, .25, depth + .2, -depth / 2 + .15, 'white'); // entablature
  // pediment: a triangular slab with a small gable roof running back into the main roof
  const sh = new T.Shape([new T.Vector2(-w / 2 - .2, 0), new T.Vector2(w / 2 + .2, 0), new T.Vector2(0, rise)]);
  const tri = new T.ExtrudeGeometry(sh, {depth: .4, bevelEnabled: false}); // back face 15 cm inside the body, not in its front plane
  tri.translate(0, 0, -.25); tri.rotateY(e.angle);
  b.add(tri, 'stone', at.x + e.out.x * .1, top + .25, at.y + e.out.y * .1);
  const half = w / 2 + .3, ridge = top + .25 + rise, P = (s: number, d: number, y: number) => {
    const p = at.clone().addScaledVector(e.u, s).addScaledVector(e.out, d); return new T.Vector3(p.x, y, p.y);
  };
  surface(b, [P(-half, .3, top + .25), P(0, .3, ridge + .05), P(0, -depth, ridge + .05), P(-half, -depth, top + .25)], 'red', true);
  surface(b, [P(half, .3, top + .25), P(half, -depth, top + .25), P(0, -depth, ridge + .05), P(0, .3, ridge + .05)], 'red', true);
  // raked white cornices, kept inside the tympanum's silhouette (top edge on the rake)
  const hw = w / 2 + .2, Lr = Math.hypot(hw, rise), slope = Math.atan2(rise, hw);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(Lr - .25, .16, .2);
    g.rotateZ(s * -slope); g.translate(s * hw / 2 - s * .08 * rise / Lr, rise / 2 - .08 * hw / Lr, 0); g.rotateY(e.angle);
    b.add(g, 'white', at.x + e.out.x * .3, top + .25, at.y + e.out.y * .3);
  }
  if (o.crest) { // coat of arms in the tympanum (gold shield on red mantling)
    edgeBox(b, e, t, top + .45, w * .42, rise * .45, .08, .3, 'red');
    edgeBox(b, e, t, top + .52, w * .24, rise * .36, .08, .38, 'gold');
  }
  // pedestal and finial
  edgeBox(b, e, t, ridge - .15, .55, .7, .55, .05, 'stone');
  edgeBox(b, e, t, ridge + .55, .7, .12, .7, .05, 'stone');
  const fin = new T.CylinderGeometry(.08, .22, o.finial, 8); fin.translate(0, o.finial / 2, 0);
  b.add(fin, o.crest ? 'gold' : 'white', at.x + e.out.x * .05, ridge + .67, at.y + e.out.y * .05);
}

/** Lead turret: white octagonal shaft, small windows, ogee cap, then a finial or an open iron crown, and a vane. */
function turret(b: BuildingTools, x: number, z: number, w: number, y0: number, y1: number, cap: number, crown: boolean, vane: number) {
  octagon(b, x, z, w, y0, y1, 'stone');
  octagon(b, x, z, w + .3, y1, y1 + .22, 'white');
  for (let k = 0; k < 4; k++) { // a window in every other face
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), r = w / 2;
    b.box(x + nx * (r + .02), y1 - 1.5, z + nz * (r + .02), w * .32, 1.0, .08, 'white', a);
    b.box(x + nx * (r + .07), y1 - 1.4, z + nz * (r + .07), w * .22, .8, .06, 'glass', a);
  }
  const k = {add: b.add} as BuildingTools;
  lathe(k, x, z, ogeeProfile(w / 2, y1 + .17, y1 + .22 + cap), 'frame', 8); // base sunk 5 cm into the cornice
  const yc = y1 + .22 + cap;
  if (crown) { // open iron crown: four ribs bowed out from a ring to the vane rod
    const ring = new T.TorusGeometry(w * .3, .04, 4, 12); ring.rotateX(Math.PI / 2); b.add(ring, 'dark', x, yc + .1, z);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, pts = [0, .25, .5, .75, 1].map(t => new T.Vector3(Math.cos(a) * w * .3 * (1 - t * t) * (1 + .6 * Math.sin(Math.PI * t)), yc + .1 + t * .9, Math.sin(a) * w * .3 * (1 - t * t) * (1 + .6 * Math.sin(Math.PI * t))));
      for (let j = 0; j < 4; j++) {
        const d = pts[j + 1].clone().sub(pts[j]), g = new T.CylinderGeometry(.035, .035, d.length(), 4);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
        const m = pts[j].clone().add(pts[j + 1]).multiplyScalar(.5); b.add(g, 'dark', x + m.x, m.y, z + m.z);
      }
    }
  } else {
    const ball = new T.SphereGeometry(.16, 8, 6); b.add(ball, 'gold', x, yc + .12, z);
  }
  const rod = new T.CylinderGeometry(.03, .03, vane - yc, 4); rod.translate(0, (vane - yc) / 2, 0); b.add(rod, 'dark', x, yc, z);
  b.box(x + .25, vane - .55, z, .7, .22, .03, 'gold'); // vane
  b.box(x, vane - .9, z, .5, .03, .03, 'dark'); b.box(x, vane - .9, z, .03, .03, .5, 'dark'); // compass arms
}

/** Neck gable (halsgevel) front: attic tier with claw scrolls, cornice, neck with claws and a curved cap. */
export function neckGableOutline(W: number, eave: number): V2[] {
  const h = W / 2, right: V2[] = [
    [h, eave], [h, eave + .4], [h - .3, eave + .45], [h - .6, eave + .75], [h - .85, eave + 1.15], [h - .95, eave + 1.6], [h - 1.0, eave + 2.1],
    [h - .75, eave + 2.1], [h - .75, eave + 2.3], [1.75, eave + 2.3], [1.55, eave + 2.5], [1.32, eave + 2.9], [1.2, eave + 3.3], [1.2, eave + 3.9],
    [1.32, eave + 3.9], [1.32, eave + 4.05], [.9, eave + 4.15], [0, eave + 4.25],
  ];
  return [...right, ...right.slice(0, -1).reverse().map(([x, y]) => [-x, y] as V2)];
}

export function buildStationspleinPaviljoens(_w: number, _d: number, b: BuildingTools) {
  const P = islandParts(), list = Object.values(P), idx = (k: string) => Object.keys(P).indexOf(k);
  const V = (p: V2) => new T.Vector2(p[0], p[1]);

  // --- walls, exposed runs only (cream painted timber) ---
  const runs: Record<string, Run[]> = {};
  for (const k of Object.keys(P)) runs[k] = exposedWalls(b, list, idx(k), 'stone');

  // --- GVB hall (0326): flat roof behind a white cornice, a glazed bay rhythm with pilasters ---
  flatRoof(b, P.hall.ring.map(V), H.hall, 'slate');
  for (const r of runs.hall) {
    cornice(b, r, H.hall - .35, .35, .4);
    if (r.from > 0) continue;
    cornice(b, r, 3.25, .45, .14); // fascia band (the lettering band, left blank)
    const ts = windowRow(b, r, .55, 1.9, 2.45, 2.6, {cols: 3, rows: 3}), e = runEdge(r);
    const piers = ts.length ? [ts[0] - 1.3, ...ts.map(t => t + 1.3)] : [];
    for (const t of piers) if (t > .2 && t < e.len - .2) edgeBox(b, e, t, 0, .3, 3.25, .14, .07, 'white');
  }
  // --- west block (0325): hipped red roof, chimney, lead dormer ---
  hipRoof(b, P.west.ring.map(V), H.west.eave, H.west.ridge, 'red', {overhang: .3});
  for (const r of runs.west) { cornice(b, r, H.west.eave - .3, .3, .35); if (r.from === 0) windowRow(b, r, .55, 1.3, 2.9, 1.8, {cols: 2, rows: 3}); }
  b.box(-25.6, 6.0, -.9, .6, 3.0, .9, 'brick'); b.box(-25.6, 9.0, -.9, .8, .15, 1.1, 'brick');
  // --- 0713621: flat block with a cornice ---
  flatRoof(b, P.block.ring.map(V), H.block, 'slate');
  for (const r of runs.block) { cornice(b, r, H.block - .3, .3, .35); windowRow(b, r, r.from + .3, 1.3, H.block - r.from - 1.0, 2.0, {cols: 2, rows: 2}); }
  // --- the 1911 stolp (0330): pyramid roof, crest gable over four stained-glass lights, ornament frieze ---
  hipRoof(b, P.stolp.ring.map(V), H.stolp.eave, H.stolp.apex, 'red', {overhang: .3, ridgeHalf: 0});
  for (const r of runs.stolp) cornice(b, r, H.stolp.eave - .3, .3, .35);
  const north = runs.stolp.filter(r => r.from === 0).sort((a, c) => (a.t1 - a.t0) < (c.t1 - c.t0) ? 1 : -1)
    .find(r => r.out[1] < -.5);
  if (north) {
    const e = runEdge(north), mid = e.len / 2;
    for (const s of [-1.35, -.45, .45, 1.35]) pane(b, e, mid + s, 1.25, .72, 2.75, {cols: 2, rows: 4, glass: 'blue', bar: 'dark'});
    for (const s of [-1.35, -.45, .45, 1.35]) { // frieze panels: lead-grey recess with white lattice
      edgeBox(b, e, mid + s, 4.2, .8, .4, .05, .03, 'frame');
      edgeBox(b, e, mid + s, 4.38, .8, .05, .05, .09, 'white'); edgeBox(b, e, mid + s, 4.2, .05, .4, .05, .09, 'white');
    }
    edgeBox(b, e, mid, 4.12, 3.9, .06, .1, .05, 'white'); edgeBox(b, e, mid, 4.62, 3.9, .06, .1, .05, 'white');
    for (const s of [-1.9, 1.9]) edgeBox(b, e, mid + s, 0, .3, 4.7, .14, .07, 'white'); // pilasters framing the bay
    pedimentDormer(b, e, mid, H.stolp.eave, {w: 3.6, body: 1.7, rise: 1.75, depth: 2.6, finial: .8, crest: true, glass: 'blue'});
  }
  // --- south wing (0329): hipped, pediment gable on the water side with a finial figure ---
  hipRoof(b, P.wing.ring.map(V), H.wing.eave, H.wing.ridge, 'red', {overhang: .3});
  for (const r of runs.wing) {
    cornice(b, r, H.wing.eave - .3, .3, .35);
    if (r.out[1] > .5) {
      const e = runEdge(r);
      pedimentDormer(b, e, e.len / 2, H.wing.eave, {w: 3.1, body: 1.5, rise: 1.5, depth: 2.2, finial: .9, front: .68}); // on the strip's façade line
    } else if (r.from === 0) windowRow(b, r, .5, 1.2, 2.9, 1.6, {cols: 2, rows: 3});
  }
  // --- Loetje block: one storey of tall glazed bays under a red-tile mansard with a flat top and skylights ---
  mansardRoof(b, LOETJE, LOETJE_INSETS, H.loetje.eave, H.loetje.top, 'red', 'slate', .3);
  for (const r of runs.loetje) {
    cornice(b, r, H.loetje.eave - .35, .35, .4);
    if (r.from === 0) { windowRow(b, r, .55, 1.85, 2.9, 2.3, {cols: 3, rows: 3}); cornice(b, r, 3.6, .12, .12); }
  }
  for (const [x, z] of [[12.5, 3.5], [15.5, 5.5], [18.5, 7.5]] as V2[]) { b.box(x, H.loetje.top, z, 1.6, .5, 1.6, 'white'); b.box(x, H.loetje.top + .5, z, 1.4, .25, 1.4, 'glass'); }
  // dormers: three-light hipped dormer on the south slope (w02), two-light on the NW slope (w05)
  const loetjeEdges = edgesOf(LOETJE.map(V));
  for (const [ei, w, lights] of [[2, 3.6, 3], [5, 2.6, 2]] as [number, number, number][]) {
    const e = loetjeEdges[ei], t = e.len / 2, base = H.loetje.eave, dep = 2.2;
    edgeBox(b, e, t, base, w, 1.55, dep, -dep / 2 - .45, 'stone');
    const front = {...e, p: e.p.clone().addScaledVector(e.out, -.45)};
    for (let i = 0; i < lights; i++) pane(b, front, t - w / 2 + (i + .5) * w / lights, base + .25, w / lights - .3, 1.05, {cols: 2, rows: 2});
    const c = e.p.clone().addScaledVector(e.u, t), q = (s: number, d: number) => c.clone().addScaledVector(e.u, s).addScaledVector(e.out, d);
    hipRoof(b, [q(-w / 2 - .15, -.3), q(w / 2 + .15, -.3), q(w / 2 + .15, -.45 - dep), q(-w / 2 - .15, -.45 - dep)], base + 1.55, base + 2.4, 'red');
  }
  // --- turrets: Loetje corner (0328, iron crown) and the west tower (0324, ball finial) ---
  turret(b, 5.1, 1.45, 2.4, 0, 7.0, 2.0, true, 12.0);
  turret(b, -24.25, 2.15, 1.7, 0, 7.4, 1.8, false, 11.2); // AHN max 9.4 on the cap; panorama w09 shows the shaft well above the hall
  // --- east kiosk (w57864041): gabled, neck gable with a chimney up its middle facing the station ---
  const kq = P.kiosk.ring.map(V);
  gableRoofQuad(b, kq, H.kiosk.eave, H.kiosk.ridge, 'red', 'stone');
  const ke = edgesOf(kq), ne = ke.reduce((a, e) => (e.out.y < a.out.y ? e : a));
  for (const r of runs.kiosk) {
    cornice(b, r, H.kiosk.eave - .3, .3, .35);
    const e = runEdge(r);
    if (Math.abs(e.out.dot(ne.out)) > .9 && e.out.dot(ne.out) > 0) {
      for (const s of [-1.75, 1.75]) pane(b, e, e.len / 2 + s, .55, 1.9, 2.6, {cols: 3, rows: 4});
    } else windowRow(b, r, .6, 1.6, 2.4, 2.4, {cols: 3, rows: 3});
  }
  const sh = new T.Shape(neckGableOutline(ne.len, H.kiosk.eave).map(([x, y]) => new T.Vector2(x, y)));
  const neck = new T.ExtrudeGeometry(sh, {depth: .3, bevelEnabled: false});
  neck.translate(0, 0, -.12); neck.rotateY(ne.angle);
  b.add(neck, 'stone', ne.mid.x, 0, ne.mid.y);
  const nf = {...ne, p: ne.p.clone().addScaledVector(ne.out, .18)};
  for (const s of [-1.45, 1.45]) pane(b, nf, ne.len / 2 + s, H.kiosk.eave + .65, 1.0, 1.25, {cols: 2, rows: 2, glass: 'dark'});
  edgeBox(b, nf, ne.len / 2, H.kiosk.eave + 2.12, ne.len - 1.65, .16, .2, .1, 'white'); // tier cornice, inside the ledge
  edgeBox(b, ne, ne.len / 2, 0, 1.0, 8.9, .55, .3, 'brick'); // chimney stack
  edgeBox(b, ne, ne.len / 2, 8.9, 1.2, .14, .7, .3, 'brick');
  // SW gable end of the kiosk is plain (inferred)
  void wallQuad; void p3; void exposedRuns;
}
