import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon} from './worship-shell';
import {wallsOf, wallTop, type Wall} from './worship-walls';
import {archSlab, frameOf, poly, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './victoria-hotel-footprints.json';

/**
 * Victoria Hotel (Park Plaza Victoria), Damrak 1-5 / Prins Hendrikkade (J.F. Henkenhaf, 1890): a neo-Renaissance natural-stone hotel with
 * a rusticated ground storey, three window storeys, a cornice, a slate mansard with two rows of arched dormers and, on the Damrak/
 * Prins Hendrikkade corner, a round three-stage tower under a lead dome with a lantern. A gold VICTORIA HOTEL sign stands on its roof.
 *
 * Massing: 3DBAG LoD2.2 shell of the BAG pand (native east/south metres from the BAG centroid), walls split at the eave (17.9 m): stone
 * below, slate above (3DBAG carries the mansard as a vertical wall to its 25.5 m ridge, so the dormers sit on that slate wall).
 * Window axes follow the 3DBAG wall segments: pitch 2.4 m, five regular bays plus a pavilion on the Damrak front. The two narrow old
 * houses the hotel was built around are separate BAG pands (not part of this model) and stay in the notch of the Prins Hendrikkade front.
 */
const EAVE = 17.9, DOME_Y = 21.8;
const TOWER: [number, number] = [11.2, 1.4], TR = 3.9;
const bearingOf = (w: Wall) => (Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360;
const inTower = (w: Wall) => Math.hypot(w.origin[0] + w.tangent[0] * w.length / 2 - TOWER[0], w.origin[1] + w.tangent[1] * w.length / 2 - TOWER[1]) < TR + 2.5;

const cut = (r: number[][], y: number, above: boolean) => {
  const ring = r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r;
  const out: number[][] = [];
  const keep = (p: number[]) => (above ? p[1] >= y : p[1] <= y);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    if (keep(a)) out.push(a);
    if (keep(a) !== keep(c)) { const k = (y - a[1]) / (c[1] - a[1]); out.push([a[0] + (c[0] - a[0]) * k, y, a[2] + (c[2] - a[2]) * k]); }
  }
  return out;
};

export function buildVictoriaHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.35);
  // ---- shell: stone walls below the eave, slate mansard walls above, slate roofs ----
  const walls = wallsOf(source as never);
  const towerIdx = new Set(walls.filter(inTower).map(w => w.index));
  const addPoly = (rings: number[][][], colour: string, role?: string) => {
    const g = planarPolygon(rings);
    if (!g) return;
    if (role) {
      g.userData.role = role;
      const pos = g.getAttribute('position'), idx = g.getIndex()!;
      const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
      for (let k = 0; k < idx.count; k += 3) {
        A.fromBufferAttribute(pos, idx.getX(k)); B.fromBufferAttribute(pos, idx.getX(k + 1)); C.fromBufferAttribute(pos, idx.getX(k + 2));
        if (B.sub(A).cross(C.sub(A)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
      }
      g.computeVertexNormals();
    }
    b.add(g, colour as never);
  };
  (source.surfaces as {type: string; rings: number[][][]}[]).forEach((s, i) => {
    if (s.type === 'GroundSurface') return;
    const cx = s.rings[0].reduce((a, p) => a + p[0], 0) / s.rings[0].length, cz = s.rings[0].reduce((a, p) => a + p[2], 0) / s.rings[0].length;
    const nearTower = Math.hypot(cx - TOWER[0], cz - TOWER[1]) < TR + 1.8;
    if (s.type === 'RoofSurface') { if (!(nearTower && Math.max(...s.rings[0].map(p => p[1])) > DOME_Y + 0.2)) addPoly(s.rings, 'slate', 'roof'); return; }   // 3DBAG's faceted dome is replaced by a lathe dome below
    if (towerIdx.has(i)) {
      // the tower shaft is a faceted round wall: run every facet from its base to the dome springing
      const xz = new Map<string, number[]>();
      for (const p of s.rings[0]) xz.set(`${p[0].toFixed(2)},${p[2].toFixed(2)}`, p);
      const ends = [...xz.values()], base = Math.min(...s.rings[0].map(p => p[1]));
      if (ends.length === 2 && base < DOME_Y - 0.01) addPoly([[[ends[0][0], base, ends[0][2]], [ends[1][0], base, ends[1][2]], [ends[1][0], DOME_Y, ends[1][2]], [ends[0][0], DOME_Y, ends[0][2]]]], 'stone');
      else { const lo = cut(s.rings[0], DOME_Y, false); if (lo.length >= 3 && base < DOME_Y - 0.01) addPoly([lo], 'stone'); }
      return;
    }
    const top = Math.max(...s.rings[0].map(p => p[1])), base = Math.min(...s.rings[0].map(p => p[1]));
    if (towerIdx.has(i) || top <= EAVE + 0.3 || base >= EAVE) { addPoly(s.rings, base >= EAVE && !towerIdx.has(i) ? 'slate' : 'stone'); return; }
    const lo = cut(s.rings[0], EAVE, false), hi = cut(s.rings[0], EAVE, true);
    if (lo.length >= 3) addPoly([lo], 'stone');
    if (hi.length >= 3) addPoly([hi], 'slate');
  });
  // lead dome (lathe profile), lantern and finial; 3DBAG roofMax 30.7 m NAP is 29.1 m above ground. Part of the shell so the dormers attach to it.
  const [tx, tz] = TOWER;
  const prof: [number, number][] = [[0.05, 29.0], [0.75, 28.2], [0.8, 27.6], [1.5, 26.9], [2.5, 25.9], [3.3, 24.5], [3.65, 23.2], [3.95, 22.3], [4.35, 22.05], [4.35, DOME_Y]];
  const domeY = (r: number) => { for (let k = 0; k < prof.length - 1; k++) { const [r0, y0] = prof[k], [r1, y1] = prof[k + 1]; if (r >= Math.min(r0, r1) && r <= Math.max(r0, r1) && r0 !== r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 29; };
  b.add(new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 24).translate(tx, 0, tz), 'slate' as never);
  b.add(new T.CylinderGeometry(0.7, 0.7, 1.1, 12).translate(tx, 28.2 + 0.55, tz), 'white' as never);
  b.add(new T.ConeGeometry(0.55, 1.0, 12).translate(tx, 29.3 + 0.35, tz), 'slate' as never);
  b.mark?.('shell');

  // ---- street fronts: every tall wall facing NE (Prins Hendrikkade, 43-44 deg) or SE (Damrak, 129-133 deg) ----
  const fronts = walls.filter(w => !towerIdx.has(w.index) && w.length >= 1.35 && w.poly.some(p => p[1] > EAVE + 1) && [[40, 47], [126, 136]].some(([a, c]) => bearingOf(w) >= a && bearingOf(w) <= c));
  const PITCH = 2.4;
  for (const w of fronts) {
    const f = frameOf(w), top = Math.max(...w.poly.map(p => p[1]));
    const n = Math.max(1, Math.floor((w.length - 2.0) / PITCH) + 1), start = w.length / 2 - (n - 1) * PITCH / 2;
    const room = (t: number, y: number, h: number) => wallTop(w, t - 0.7) >= y + h + 0.2 && wallTop(w, t + 0.7) >= y + h + 0.2 && y >= w.base - 0.01;
    // storey bands and cornice
    for (const [y, h, d] of [[4.5, 0.5, 0.14], [9.5, 0.3, 0.12], [13.9, 0.3, 0.12]] as const) if (top > y + h + 1 && y >= w.base - 0.01) slab(b, f, w.length / 2, y, w.length, h, d, 'sandstone');
    if (top > EAVE + 0.5 && w.base < EAVE - 0.8) { slab(b, f, w.length / 2, EAVE - 0.7, w.length, 0.7, 0.42, 'sandstone'); slab(b, f, w.length / 2, EAVE - 0.05, w.length, 0.16, 0.5, 'sandstone'); }
    if (w.base < 1) slab(b, f, w.length / 2, 0, w.length, 4.5, 0.1, 'sandstone');       // rusticated ground storey
    for (let k = 0; k < n; k++) {
      const t = start + k * PITCH;
      // ground storey: tall arched window or door
      if (room(t, 0.4, 3.2) && w.base < 1) { archSlab(b, f, t, 0.4, 1.3, 3.4, 0.1, 'white'); archSlab(b, f, t, 0.5, 1.05, 3.2, 0.14, 'glass'); }
      // bel-etage: tall window under a pediment, small balcony
      if (room(t, 5.4, 2.8)) {
        slab(b, f, t, 5.2, 1.6, 0.2, 0.3, 'white'); slab(b, f, t, 5.4, 1.1, 2.7, 0.1, 'white'); slab(b, f, t, 5.5, 0.9, 2.5, 0.14, 'glass');
        poly(b, f, t, 8.3, [[-0.85, 0], [0.85, 0], [0, 0.55]], 0.18, 'white');
        slab(b, f, t, 5.4, 1.5, 0.08, 0.5, 'dark');
      }
      // second and third storeys
      if (room(t, 10.4, 2.2)) { slab(b, f, t, 10.3, 1.2, 2.4, 0.1, 'white'); slab(b, f, t, 10.4, 0.95, 2.2, 0.14, 'glass'); }
      if (room(t, 14.7, 1.9)) { archSlab(b, f, t, 14.6, 1.2, 2.1, 0.1, 'white'); archSlab(b, f, t, 14.7, 0.95, 1.9, 0.14, 'glass'); }
      // mansard dormers: two staggered rows of arched windows on the slate wall
      if (top > EAVE + 3.5) {
        if (room(t, 19.2, 1.5)) { archSlab(b, f, t, 19.1, 1.25, 1.8, 0.12, 'white'); archSlab(b, f, t, 19.2, 0.95, 1.6, 0.16, 'glass'); }
        if (top > EAVE + 6.2 && room(t + PITCH / 2, 22.7, 1.6)) { archSlab(b, f, t + PITCH / 2, 22.6, 1.25, 1.8, 0.12, 'white'); archSlab(b, f, t + PITCH / 2, 22.7, 0.95, 1.6, 0.16, 'glass'); }
      }
    }
  }
  // Damrak pavilion: pilasters and a gabled dormer on the 4.3 m wall beside the tower
  for (const w of walls) {
    if (Math.abs(bearingOf(w) - 130) > 2 || w.length < 4 || w.length > 4.6 || towerIdx.has(w.index) || w.base > 1 || Math.max(...w.poly.map(p => p[1])) < 25) continue;
    const f = frameOf(w);
    for (const t of [0.3, w.length - 0.3]) slab(b, f, t, 4.6, 0.55, EAVE - 4.6, 0.3, 'sandstone');
    poly(b, f, w.length / 2, EAVE, [[-1.7, 0], [1.7, 0], [1.7, 1.2], [0.9, 2.3], [0, 2.8], [-0.9, 2.3], [-1.7, 1.2]], 0.5, 'white');
  }

  // ---- corner tower: pilastered shaft, balcony ring, cornice, oculi, lantern ----
  const cyl = (r: number, h: number, y: number, colour: string, seg = 20) => b.add(new T.CylinderGeometry(r, r, h, seg).translate(tx, y + h / 2, tz), colour as never);
  cyl(TR + 0.28, 0.6, 5.7, 'sandstone');                                   // cornice over the ground storey
  const ring = new T.Shape(); ring.absarc(0, 0, TR + 0.95, 0, Math.PI * 2, false);
  const hole = new T.Path(); hole.absarc(0, 0, TR + 0.75, 0, Math.PI * 2, true); ring.holes.push(hole);
  b.add(new T.ExtrudeGeometry(ring, {depth: 0.9, bevelEnabled: false, curveSegments: 24}).rotateX(-Math.PI / 2).translate(tx, 6.3, tz), 'dark' as never);   // ironwork balcony
  b.add(new T.CylinderGeometry(TR + 0.95, TR + 0.95, 0.14, 24).translate(tx, 6.2, tz), 'sandstone' as never);
  cyl(TR + 0.4, 0.7, EAVE - 0.4, 'sandstone');                             // main cornice
  cyl(TR + 0.2, 0.4, 13.2, 'sandstone');
  for (let k = 0; k < 10; k++) {                                           // pilasters round the shaft
    const a = (k / 10) * Math.PI * 2 + 0.31, r = TR + 0.05;
    b.add(new T.BoxGeometry(0.55, EAVE - 6.6, 0.5).rotateY(a).translate(tx + Math.sin(a) * r, 6.6 + (EAVE - 6.6) / 2, tz + Math.cos(a) * r), 'sandstone' as never);
  }
  for (const deg of [30, 85, 140, 195]) {                                  // windows on the street-facing sides, three storeys
    const a = deg * Math.PI / 180, nx = Math.sin(a), nz = -Math.cos(a);   // compass bearing -> native (x east, z south)
    for (const [y, h] of [[7.6, 2.5], [10.4, 2.1], [14.5, 2.0]]) {
      const g = new T.BoxGeometry(1.0, h, 0.3).translate(0, h / 2, 0).rotateY(Math.atan2(nx, nz)).translate(tx + nx * (TR - 0.05), y, tz + nz * (TR - 0.05));
      b.add(g, 'glass' as never);
      b.add(new T.BoxGeometry(1.4, 0.2, 0.45).rotateY(Math.atan2(nx, nz)).translate(tx + nx * (TR + 0.02), y + h + 0.05, tz + nz * (TR + 0.02)), 'white' as never);
    }
  }
  for (const deg of [20, 75, 130]) {                                       // round oculi in the upper stage and on the dome
    const a = deg * Math.PI / 180, nx = Math.sin(a), nz = -Math.cos(a);
    b.add(new T.CylinderGeometry(0.62, 0.62, 0.3, 14).rotateX(Math.PI / 2).rotateY(Math.atan2(nx, nz)).translate(tx + nx * (TR + 0.05), 19.4, tz + nz * (TR + 0.05)), 'glass' as never);
    const dr = domeY(2.6) - 0.15;
    b.add(new T.BoxGeometry(0.9, 0.9, 0.8).rotateY(Math.atan2(nx, nz)).translate(tx + nx * 2.6, dr, tz + nz * 2.6), 'slate' as never);
    b.add(new T.CylinderGeometry(0.34, 0.34, 0.3, 12).rotateX(Math.PI / 2).rotateY(Math.atan2(nx, nz)).translate(tx + nx * 3.02, dr, tz + nz * 3.02), 'glass' as never);
  }
  // ---- gold VICTORIA / HOTEL roof sign, facing east-north-east ----
  {
    const a = 70 * Math.PI / 180, n: [number, number] = [Math.sin(a), -Math.cos(a)], f: Frame = {origin: [3.2, 1.0], tangent: [n[1], -n[0]], n};
    const base = (roofHeightAt(source.surfaces as never, 3.2, 1.0) ?? 25.5) + 0.7;
    glyphs(b, f, 'VICTORIA', 0, base + 1.5, 0.1, 0.2, 0.18, 'gold');
    glyphs(b, f, 'HOTEL', 0, base, 0.1, 0.13, 0.15, 'gold');
    slab(b, f, 0, base + 1.5 + 0.55, 9.6, 0.14, 0.26, 'dark', 0.0);      // letter rails
    slab(b, f, 0, base + 0.35, 3.9, 0.12, 0.22, 'dark', 0.0);
    for (const t of [-4.4, 0, 4.4]) slab(b, f, t, base - 0.7, 0.14, 3.0, 0.12, 'dark', 0.0);
  }
  setSink(0);
}

const GL: Record<string, string[]> = {
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
};
function glyphs(b: BuildingTools, f: Frame, text: string, t: number, y: number, out: number, px: number, d: number, colour: string) {
  const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
  for (const ch of text) {
    const rows = GL[ch];
    if (rows) for (let j = 0; j < 7; j++) {
      const row = rows[j]; let k = 0;
      while (k < 5) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && row[e] === '1') e++;
        slab(b, f, u + (k + e) / 2 * px, y + (6 - j) * px, (e - k) * px, px, d, colour, out);
        k = e;
      }
    }
    u += 6 * px;
  }
}
