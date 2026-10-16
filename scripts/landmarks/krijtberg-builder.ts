import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * De Krijtberg (H. Franciscus Xaveriuskerk), Singel 448 (BAG 0363100012185920; Alfred Tepe, 1881-83): a neo-Gothic cross basilica of brick whose
 * front on the Singel is a pair of buttressed towers with octagonal spires either side of a gabled centre bay.
 *
 * Massing from the BAG/3DBAG footprint and wall surfaces of krijtberg-footprints.json (native east/south metres from the BAG anchor): nave
 * ridge 33.5 m over 25.8 m clerestory walls, aisles at 15 m, transepts with gables at +/-10 m, a polygonal apse, the presbytery wings and annexes
 * as low blocks. 3DBAG cuts the spires off, so their height (56 and 53 m) and the tower stages are read from the Commons photographs (Zairon,
 * CC BY-SA 4.0; Alf van Beem, CC0; RCE 20369642, CC BY-SA 4.0) and a 2025 panorama of the portal. The own frame (u, v) has u along bearing 50 deg
 * (toward the Singel front) and v along bearing 140 deg; the viewer facing the front has v increasing to the left.
 * See krijtberg-inventory.json for every ornament with its plan.
 */
type Colour = Parameters<BuildingTools['add']>[1];
const BEAR = 50 * Math.PI / 180;
const E1 = [Math.sin(BEAR), -Math.cos(BEAR)], E2 = [-E1[1], E1[0]];
const xz = (u: number, v: number): [number, number] => [u * E1[0] + v * E2[0], u * E1[1] + v * E2[1]];

const CU = -3.7, CV = -0.6, HW = 4.75, EAVE = 25.8, RIDGE = 33.5, AISLE = 15.0, AISLE_IN = 18.5;
/** Roof arms from the crossing: outward direction in (u, v), distance to the gable plane, gable (true) or hip (false). */
const ARMS: {n: [number, number]; R: number; gable: boolean}[] = [
  {n: [1, 0], R: 34.5, gable: true}, {n: [0, 1], R: 10.7, gable: true}, {n: [-1, 0], R: 13.7, gable: false}, {n: [0, -1], R: 9.4, gable: true},
];

/** `dropped`: windows that would not fit under their wall's top profile even shortened (fitWindow). */
export interface KrijtbergStats {portals: number; windows: number; spires: number; dropped: number}

export function buildKrijtberg(_w: number, _d: number, b: BuildingTools, stats: KrijtbergStats = {portals: 0, windows: 0, spires: 0, dropped: 0}) {
  const add = (g: T.BufferGeometry, c: Colour) => b.add(g, c);
  const prism = (pts: [number, number][], y0: number, y1: number, c: Colour) => {
    const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), {depth: y1 - y0, bevelEnabled: false});
    g.rotateX(Math.PI / 2); g.translate(0, y1, 0); add(g, c);
  };
  const uvPrism = (pts: [number, number][], y0: number, y1: number, c: Colour) => prism(pts.map(p => xz(p[0], p[1])), y0, y1, c);
  const rectUV = (u0: number, u1: number, v0: number, v1: number): [number, number][] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const sheet = (pts: [number, number, number][], c: Colour) => {
    const P = pts.map(([u, v, y]) => { const [x, z] = xz(u, v); return new T.Vector3(x, y, z); });
    const pos: number[] = [];
    for (let i = 1; i + 1 < P.length; i++) {
      const n = new T.Vector3().subVectors(P[i], P[0]).cross(new T.Vector3().subVectors(P[i + 1], P[0]));
      const tri = n.y >= 0 ? [P[0], P[i], P[i + 1]] : [P[0], P[i + 1], P[i]];
      tri.forEach(p => pos.push(p.x, p.y, p.z));
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); add(g, c);
  };
  /** A wall frame: origin (u, v) on the wall plane, outward normal n in (u, v); put(geometry with x along the wall, z out of it). */
  const frame = (u: number, v: number, nu: number, nv: number) => {
    const nx = nu * E1[0] + nv * E2[0], nz = nu * E1[1] + nv * E2[1], tx = nz, tz = -nx, ang = Math.atan2(-tz, tx), [ox, oz] = xz(u, v);
    const put = (g: T.BufferGeometry, t: number, y: number, d: number, c: Colour) => { g.rotateY(ang); g.translate(ox + tx * t + nx * d, y, oz + tz * t + nz * d); add(g, c); };
    const box = (t: number, y0: number, d0: number, w: number, h: number, dep: number, c: Colour) => put(new T.BoxGeometry(w, h, dep), t, y0 + h / 2, d0 + dep / 2, c);
    const ext = (shape: T.Shape, d0: number, dep: number, c: Colour) => put(new T.ExtrudeGeometry(shape, {depth: dep, bevelEnabled: false}), 0, 0, d0, c);
    return {put, box, ext};
  };
  /** Pointed outline (two straight rakes) of width w from y0 to the springing y1, apex rise = 0.7 w. */
  const pointed = (t0: number, w: number, y0: number, y1: number): [number, number][] => [[t0 - w / 2, y0], [t0 + w / 2, y0], [t0 + w / 2, y1], [t0, y1 + w * 0.75], [t0 - w / 2, y1]];
  const shapeOf = (p: [number, number][]) => new T.Shape(p.map(q => new T.Vector2(q[0], q[1])));
  type F = ReturnType<typeof frame>;
  /** The hosting wall's top profile at frame offset t (m): a flat eaves line, or a gable rake; `top` is where the wall ends. */
  type TopProfile = (t: number) => number;
  const flatTop = (y: number): TopProfile => () => y;
  /** A gable of half-width hw between eaves and ridge, apex at t = 0 (the plate sits 5 cm inside the rakes). */
  const gableTop = (hw: number, eaves: number, ridge: number): TopProfile => t => Math.abs(t) >= hw ? eaves : eaves + (ridge - eaves) * (1 - Math.abs(t) / hw) - 0.05;
  const WINDOW_CLEAR = 0.15;
  /**
   * Fit a pointed window under its wall's top profile (openingsWithinWalls gate, 2026-10-16: the transept lancets rose past the
   * gable rakes into the roof planes). The stone ring's outline (width w + 0.5, apex 0.75 of that above the springing) must stay
   * WINDOW_CLEAR under `top` at every t it spans; the springing drops until it does. A window shortened below 1.2 x its width
   * is dropped (returns null). Returns the fitted height.
   */
  const fitWindow = (t: number, y0: number, w: number, h: number, top: TopProfile): number | null => {
    const wo = w + 0.5, half = wo / 2;
    let spring = y0 + h;
    for (let k = 0; k <= 16; k++) {
      const x = t - half + (wo * k) / 16, rise = 0.75 * wo * (1 - Math.abs(x - t) / half);
      spring = Math.min(spring, top(x) - WINDOW_CLEAR - rise);
    }
    const fitted = spring - y0;
    return fitted >= 1.2 * w ? Math.min(h, fitted) : null;
  };
  /** Pointed window: stone ring, glass, mullions and transoms. With `top`, fitted under the wall's top profile (or dropped). */
  const window = (f: F, t: number, y0: number, w: number, h: number, lights = 3, top?: TopProfile) => {
    if (top) { const fitted = fitWindow(t, y0, w, h, top); if (fitted === null) { stats.dropped++; return; } h = fitted; }
    stats.windows++;
    const spring = y0 + h, outer = pointed(t, w + 0.5, y0 - 0.25, spring), inner = pointed(t, w, y0, spring);
    const ring = shapeOf(outer); ring.holes.push(new T.Path(inner.map(q => new T.Vector2(q[0], q[1]))));
    f.ext(ring, 0, 0.14, 'stone'); f.ext(shapeOf(inner), 0, 0.08, 'glass');
    for (let k = 1; k < lights; k++) { const o = -w / 2 + w * k / lights, allowed = spring + 0.75 * w * (1 - 2 * Math.abs(o) / w) - 0.25; f.box(t + o, y0 + 0.05, 0.05, 0.07, Math.max(0.5, allowed - y0 - 0.05), 0.09, 'white'); }
    for (let y = y0 + 0.9; y < spring - 0.2; y += 0.9) f.box(t, y, 0.05, w - 0.1, 0.05, 0.09, 'white');
  };
  /** Deep pointed portal: three stepped arch rings, plank leaves behind an iron gate and a gilt cross. */
  const portal = (f: F, t: number, w: number, h: number) => {
    stats.portals++;
    for (const [out, dep, c, yb] of [[0.9, 0.12, 'stone', -0.4], [0.6, 0.2, 'brick', -0.2], [0.3, 0.3, 'stone', 0]] as [number, number, Colour, number][]) {
      const o = pointed(t, w + 2 * out, yb, h), i = pointed(t, w + 2 * (out - 0.3), yb, h);
      const ring = shapeOf(o); ring.holes.push(new T.Path(i.map(q => new T.Vector2(q[0], q[1]))));
      f.ext(ring, 0, dep, c);
    }
    f.ext(shapeOf(pointed(t, w, 0, h)), 0, 0.14, 'dark');
    for (let k = -2; k <= 2; k++) f.box(t + k * (w - 0.3) / 4, 0, 0.12, 0.05, h + 0.5, 0.05, 'dark');
    f.box(t, 1.2, 0.12, w - 0.2, 0.06, 0.05, 'dark'); f.box(t, 3.0, 0.12, w - 0.2, 0.06, 0.05, 'dark');
    f.box(t, h + w * 0.75 + 0.2, 0.0, 0.09, 1.1, 0.09, 'gold'); f.box(t, h + w * 0.75 + 0.65, 0.0, 0.5, 0.09, 0.09, 'gold');
  };

  // ---- Walls: nave + transepts + choir as one cross prism to the eaves; aisles, tower bases, annexes, apse as their own prisms.
  // Explicit cross polygon (u, v), counter-clockwise: nave front (u 30.8), +v transept (v 10.1), choir end (u -17.4), -v transept (v -10.0).
  const nv0 = CV - HW, nv1 = CV + HW, tu0 = CU - HW, tu1 = CU + HW;
  uvPrism([[30.8, nv0], [30.8, nv1], [tu1, nv1], [tu1, 10.1], [tu0, 10.1], [tu0, nv1], [-17.4, nv1], [-17.4, nv0], [tu0, nv0], [tu0, -10.0], [tu1, -10.0], [tu1, nv0]], 0, EAVE, 'brick');

  // Roofs: ridged arms clipped on the valley diagonals; gable ends get plates, the choir a hip.
  const roofPt = (a: typeof ARMS[number], s: number, w: number, y: number): [number, number, number] => {
    const t: [number, number] = [-a.n[1], a.n[0]];
    return [CU + a.n[0] * s + t[0] * w, CV + a.n[1] * s + t[1] * w, y];
  };
  for (const a of ARMS) {
    for (const side of [-1, 1]) sheet([roofPt(a, 0, 0, RIDGE), roofPt(a, a.R, 0, RIDGE), roofPt(a, a.R, side * HW, EAVE), roofPt(a, HW, side * HW, EAVE)], 'slate');
    if (!a.gable) sheet([roofPt(a, a.R, -HW, EAVE), roofPt(a, a.R, HW, EAVE), roofPt(a, a.R + 0, 0, RIDGE)], 'slate');
  }
  // Gable plates (transepts and the nave's front bay), a little inside the roof planes.
  for (const a of ARMS.filter(x => x.gable)) {
    const f = frame(...(xzInv(a)), a.n[0], a.n[1]);
    f.ext(shapeOf([[-HW + 0.05, EAVE], [HW - 0.05, EAVE], [0, RIDGE - 0.05]]), -0.5, 0.5, 'brick');
    // stone coping on both rakes and a cross finial
    const len = Math.hypot(HW, RIDGE - EAVE), th = Math.atan2(RIDGE - EAVE, HW);
    for (const s of [-1, 1]) { const g = new T.BoxGeometry(len, 0.3, 0.3); g.rotateZ(s > 0 ? -th : th); f.put(g, s * HW / 2, (EAVE + RIDGE) / 2 + 0.15, 0.1, 'stone'); }
    f.box(0, RIDGE, 0, 0.5, 1.2, 0.5, 'stone');
    f.box(0, RIDGE + 1.2, 0, 0.1, 1.6, 0.1, 'gold'); f.box(0, RIDGE + 2.0, 0, 0.8, 0.1, 0.1, 'gold');
  }
  function xzInv(a: typeof ARMS[number]): [number, number] { return [CU + a.n[0] * a.R, CV + a.n[1] * a.R]; }

  // Transept gables: a three-light pointed window over two-light pair and a rose-like round, plinth and string courses.
  for (const a of [ARMS[1], ARMS[3]]) {
    const f = frame(...xzInv(a), a.n[0], a.n[1]), rake = gableTop(HW, EAVE, RIDGE);
    window(f, 0, 13.0, 3.0, 8.0, 4, rake);
    f.box(0, 21.2, 0, 2 * HW + 0.5, 0.3, 0.25, 'stone'); f.box(0, 11.5, 0, 2 * HW + 0.5, 0.3, 0.25, 'stone');
    // Flanking lancets in the gable, fitted under the rakes (at t = 2.2 / w 1.2 they rose 1.5 m past the rake; now t = 1.9 / w 1.0, shortened to fit).
    for (const t of [-1.9, 1.9]) window(f, t, 26.6, 1.0, 2.6, 2, rake);
    { const c = 31.0, r = new T.Shape(); r.absarc(0, c, 1.0, 0, Math.PI * 2, false); const h = new T.Path(); h.absarc(0, c, 0.7, 0, Math.PI * 2, true); r.holes.push(h);
      f.ext(r, 0, 0.14, 'stone'); const d = new T.Shape(); d.absarc(0, c, 0.7, 0, Math.PI * 2, false); f.ext(d, 0, 0.08, 'glass'); }
    for (const s of [-1, 1]) { f.box(s * (HW - 0.15), 0, 0, 0.9, 20, 0.5, 'stone'); f.box(s * (HW - 0.15), 20, 0, 0.7, 0.4, 0.4, 'stone'); }
  }

  // Nave clerestory: lancet windows on both sides (frame t = side * (u - 8)).
  // Under the eaves (flat top); the bay inside the tower bases (u > 26.9, both sides) has no exposed wall and gets no window.
  for (const side of [-1, 1]) {
    const f = frame(8, side > 0 ? CV + HW : CV - HW, 0, side);
    for (let u = 4.5; u < 29; u += 3.8) { if (u + 0.95 > 26.9) continue; window(f, side * (u - 8), 19.8, 1.4, 3.6, 2, flatTop(EAVE)); }
  }
  // South and north aisles (lean-to roofs) and their windows.
  const aisleS: [number, number] = [-9.0, -5.35], aisleN: [number, number] = [4.15, 7.5];
  uvPrism(rectUV(1.05, 26.9, aisleS[0], aisleS[1]), 0, AISLE, 'brick');
  sheet([[1.05, aisleS[0], AISLE], [26.9, aisleS[0], AISLE], [26.9, aisleS[1], AISLE_IN], [1.05, aisleS[1], AISLE_IN]], 'slate');
  sheet([[26.9, aisleS[0], AISLE], [26.9, aisleS[1], AISLE_IN], [26.9, aisleS[1], AISLE]], 'slate');
  uvPrism(rectUV(1.05, 26.9, aisleN[0], aisleN[1]), 0, AISLE, 'brick');
  sheet([[1.05, aisleN[1], AISLE], [26.9, aisleN[1], AISLE], [26.9, aisleN[0], AISLE_IN], [1.05, aisleN[0], AISLE_IN]], 'slate');
  for (const [vw, nvs] of [[aisleS[0], -1], [aisleN[1], 1]] as [number, number][]) {
    const f = frame(0, vw, 0, nvs);
    for (let u = 4.0; u < 26.5; u += 3.8) window(f, nvs * u, 5.0, 1.3, 5.0, 2, flatTop(AISLE));
  }

  // Choir and apse: polygonal apse beyond the choir, chapels either side, transept annexes, presbytery wings.
  const apse: [number, number][] = [[-17.4, nv0], [-17.4, nv1], [-20.8, nv1 - 1.2], [-22.2, CV], [-20.8, nv0 + 1.2]];
  uvPrism(apse, 0, 24, 'brick');
    {
    const apex: [number, number, number] = [-17.4, CV, RIDGE];
    for (const [p, q] of [[apse[1], apse[2]], [apse[2], apse[3]], [apse[3], apse[4]], [apse[4], apse[0]]] as [number, number][][]) sheet([apex, [p[0], p[1], 24], [q[0], q[1], 24]], 'slate');
  }
  uvPrism(rectUV(-17.4, tu0, -10.4, nv0), 0, 14.7, 'brick');
  sheet([[-17.4, -10.4, 14.7], [tu0, -10.4, 14.7], [tu0, nv0, 19.0], [-17.4, nv0, 19.0]], 'slate');
  uvPrism(rectUV(-14.2, tu0, nv1, 11.2), 0, 15.1, 'brick');
  sheet([[-14.2, 11.2, 15.1], [tu0, 11.2, 15.1], [tu0, nv1, 19.0], [-14.2, nv1, 19.0]], 'slate');
  // Sacristy and presbytery wings round the transepts (BAG: low blocks at 3.6 to 14 m).
  uvPrism(rectUV(tu0, 2.5, -11.7, -10.0), 0, 8.4, 'brick');
  uvPrism(rectUV(2.5, 8.3, -11.7, -9.0), 0, 3.7, 'brick');
  uvPrism(rectUV(4.0, 13.2, aisleN[1], 11.5), 0, 3.9, 'brick');
  uvPrism(rectUV(-8.8, 13.2, 11.5, 19.8), 0, 10.5, 'brick');
  sheet([[-8.8, 11.5, 10.5], [13.2, 11.5, 10.5], [13.2, 15.65, 14.4], [-8.8, 15.65, 14.4]], 'slate');
  sheet([[-8.8, 19.8, 10.5], [13.2, 19.8, 10.5], [13.2, 15.65, 14.4], [-8.8, 15.65, 14.4]], 'slate');
  sheet([[-8.8, 11.5, 10.5], [-8.8, 19.8, 10.5], [-8.8, 15.65, 14.4]], 'brick');
  sheet([[13.2, 11.5, 10.5], [13.2, 19.8, 10.5], [13.2, 15.65, 14.4]], 'brick');

  // ---- The Singel front: two towers either side of the centre bay.
  const FRONT = 31.2, CENTRE_PLANE = 30.8;
  const towers = [{v0: 3.3, v1: 7.5, apex: 53, name: 'left'}, {v0: -9.4, v1: -5.2, apex: 56, name: 'right'}];
  for (const tw of towers) {
    stats.spires++;
    uvPrism(rectUV(26.9, FRONT, tw.v0, tw.v1), 0, 33, 'brick');
    const vc = (tw.v0 + tw.v1) / 2, uc = (26.9 + FRONT) / 2, [cx, cz] = xz(uc, vc);
    // string courses at 8, 15 and 24.5 m
    for (const y of [8.0, 15.0, 24.5, 33.0]) b.box(cx, y, cz, 4.7, 0.3, 4.8, 'stone', Math.PI / 2 - BEAR);
    // front and side faces: lancet openings and belfry louvres
    for (const [nu, nv, dist] of [[1, 0, FRONT], tw.name === 'left' ? [0, 1, tw.v1] : [0, -1, tw.v0]] as [number, number, number][]) {
      const f = nu ? frame(dist, vc, 1, 0) : frame(uc, dist, 0, nv), wide = nu ? tw.v1 - tw.v0 : 4.3;
      // corner buttresses: slim stepped piers on the front faces
      if (nu) for (const s of [-1, 1]) { f.box(s * (wide / 2 - 0.15), 0, 0, 0.7, 15, 0.45, 'stone'); f.box(s * (wide / 2 - 0.15), 15, 0, 0.55, 18, 0.3, 'stone'); }
      window(f, 0, 16.0, 1.1, 4.8, 1, flatTop(33));
      for (const dt of [-0.7, 0.7]) { const o = pointed(dt, 0.7, 25.2, 29.5), s = shapeOf(o); f.ext(s, 0, 0.09, 'dark'); void o; }
      f.box(0, 31.0, 0, 3.0, 0.3, 0.3, 'stone');
    }
    // gablets (one per face), corner pinnacles and the octagonal spire
    for (const k of [0, 1, 2, 3]) {
      const a = BEAR + k * Math.PI / 2, off = 1.55, px = cx + Math.sin(a) * off + Math.cos(a) * off, pz = cz + Math.cos(a) * off - Math.sin(a) * off;
      const g = new T.ConeGeometry(0.32, 2.4, 4); b.add(g, 'stone', px, 33.3 + 1.3, pz);
      b.box(px, 33.0, pz, 0.6, 0.3, 0.6, 'stone');
    }
    for (const k of [0, 1, 2, 3]) {
      const a = BEAR + k * Math.PI / 2, gx = cx + Math.sin(a) * 1.7, gz = cz + Math.cos(a) * 1.7;
      const sh = new T.Shape(); sh.moveTo(-1.0, 0); sh.lineTo(1.0, 0); sh.lineTo(0, 3.2); sh.closePath();
      const g = new T.ExtrudeGeometry(sh, {depth: 0.25, bevelEnabled: false}); g.rotateY(a); g.translate(gx - Math.sin(a) * 0.12, 33.3, gz - Math.cos(a) * 0.12); b.add(g, 'brick');
    }
    const spire = new T.CylinderGeometry(0.0, 2.0, tw.apex - 34.5, 8); spire.rotateY(Math.PI / 8 + BEAR); b.add(spire, 'slate', cx, 34.5 + (tw.apex - 34.5) / 2, cz);
    b.box(cx, tw.apex, cz, 0.12, 1.8, 0.12, 'gold', BEAR); b.box(cx, tw.apex + 1.1, cz, 0.9, 0.1, 0.1, 'gold', BEAR + Math.PI / 2);
  }
  // Tower base portals (smaller) and the centre bay: two tall pointed windows over two portals, small gable with louvres.
  {
    const f = frame(CENTRE_PLANE, 0, 1, 0);
    const tCentre = (t: number) => -t; // frame t runs to the viewer's right = -v
    void tCentre;
    for (const t of [-1.2, 3.1]) { window(f, t, 10.5, 2.4, 7.8, 3, flatTop(EAVE)); portal(f, t, 2.2, 3.6); }
    f.box(0.95, 9.2, 0, 8.4, 0.3, 0.25, 'stone'); f.box(0.95, 22.0, 0, 8.4, 0.3, 0.25, 'stone'); f.box(0.95, 7.0, 0, 8.4, 0.35, 0.25, 'stone');
    // centre gable: brick triangle between the towers with three louvre lancets and a cross
    const gb = frame(CENTRE_PLANE, 0, 1, 0);
    gb.ext(shapeOf([[-3.25, 25.0], [5.15, 25.0], [0.95, 36.0]]), -0.45, 0.45, 'brick');
    for (const t of [-0.25, 0.95, 2.15]) gb.ext(shapeOf(pointed(t, 0.7, 26.5, 28.5)), 0, 0.09, 'dark');
    const len = Math.hypot(4.2, 11.0), th = Math.atan2(11.0, 4.2);
    for (const s of [-1, 1]) { const g = new T.BoxGeometry(len, 0.3, 0.3); g.rotateZ(s > 0 ? -th : th); gb.put(g, 0.95 + s * 2.1, 30.5 + 0.15, 0.1, 'stone'); }
    gb.box(0.95, 36.0, 0, 0.5, 1.0, 0.5, 'stone'); gb.box(0.95, 37.0, 0, 0.1, 2.0, 0.1, 'gold'); gb.box(0.95, 38.0, 0, 0.9, 0.1, 0.1, 'gold');
  }
  for (const [vv] of [[5.4], [-7.3]] as number[][]) {
    const f = frame(FRONT, vv, 1, 0);
    portal(f, 0, 1.5, 3.0);
  }
}
