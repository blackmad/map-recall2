import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Surface} from './worship-shell';
import {wallAwayFrom, frameFromBearing} from './modern-kit';
import {setSink, slab, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import type {Wall} from './worship-walls';
import source from './wolkenkrabber-footprints.json';

/**
 * De Wolkenkrabber / 12-verdiepingenhuis, Victorieplein 45 (J.F. Staal, 1930-32; Rijksmonument 532002; BAG pand
 * 0363100012127007). Native east/south metres from the BAG vertex average, y above local ground (3DBAG b3_h_maaiveld).
 *
 * Massing: one closed prism per 3DBAG LoD2.2 roof plane (flat roof 40.2 m, stair drum and lift housing to 44.6-47.4 m).
 * Register text (monument 532002): twelve storeys under a flat roof, 16.05 x 25.20 m, concrete frame filled with
 * yellow-brown brick, symmetric front to the Victorieplein with a round stoep at the central entrance, the broad
 * first-floor balcony over it, shops with large steel-framed windows at the front corners.
 * Panoramas (w03-78, w04-78 front; w05/w06-258 rear; w01-168, w02-348 sides): the glazed half-round stair drum with
 * gold mullions in the middle of the front, a stack of grey balconies against a grey-painted recess either side of it,
 * a column of tall white-framed windows at each outer corner, the grey canopy band over the ground-floor shops, white
 * framed windows in the brick sides and rear.
 */
type Pt = [number, number];
const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};
const topOf = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
const midOf = (s: Surface): Pt => {
  const r = s.rings[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
};
function inPoly(x: number, z: number, r: number[][]) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = [r[i][0], r[i][2]], [xj, zj] = [r[j][0], r[j][2]];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const roofs = src.surfaces.filter(s => s.type === 'RoofSurface').map(s => ({ring: s.rings[0], h: s.rings[0].reduce((a, p) => a + p[1], 0) / s.rings[0].length}));
const heightAt = (x: number, z: number) => roofs.reduce((h, r) => inPoly(x, z, r.ring) ? Math.max(h, r.h) : h, 0);

const FRONT = 78;                         // the Victorieplein front faces east-north-east
const F = frameFromBearing([0, 0], FRONT);
const DRUM: Pt = [3.3, -0.9], DRUM_R = 1.85, DRUM_TOP = 44.6;
const Y0 = 4.6, PITCH = 3.18, FLOORS = 11; // first floor at 4.6 m, eleven storeys above the shop floor, roof 40.2 m

/** One white-framed window: a white surround with the pane 4 cm proud of it. */
function windowAt(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  slab(b, f, t, y, w + 0.2, h + 0.2, 0.06, 'white');
  slab(b, f, t, y + 0.1, w, h, 0.1, 'glass');
}

export function buildWolkenkrabber(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  for (const s of src.surfaces) if (s.type === 'RoofSurface') roofPrism(b, s.rings, 'ochre', 'slate');
  b.mark?.('shell');

  // ---- the glazed stair drum (closed solids; the half inside the block is hidden): glass round to 44.6 m, gold mullions and a gold ring at every floor ----
  const facing = Math.atan2(F.n[0], F.n[1]);           // angle of the front normal in three.js Y rotation terms
  const arc = Math.PI * 1.1, a0 = facing - arc / 2;
  // the glass cap stands 12 cm over the 3DBAG drum roof (44.6 m) so the two tops never share a plane
  const glass = new T.CylinderGeometry(DRUM_R, DRUM_R, DRUM_TOP + 0.12 - 0.3, 24);
  b.add(glass, 'glass' as never, DRUM[0], 0.3 + (DRUM_TOP + 0.12 - 0.3) / 2, DRUM[1]);
  for (let k = 0; k <= 8; k++) {
    const a = a0 + arc * k / 8, fin = new T.BoxGeometry(0.1, DRUM_TOP - 0.4, 0.22);
    fin.rotateY(a);
    b.add(fin, 'gold' as never, DRUM[0] + Math.sin(a) * (DRUM_R + 0.07), 0.3 + (DRUM_TOP - 0.4) / 2, DRUM[1] + Math.cos(a) * (DRUM_R + 0.07));
  }
  for (let k = 0; k <= FLOORS; k++) {
    const ring = new T.CylinderGeometry(DRUM_R + 0.12, DRUM_R + 0.12, 0.18, 24);
    b.add(ring, 'gold' as never, DRUM[0], Y0 - 0.2 + k * PITCH, DRUM[1]);
  }
  // round stoep with steps at the entrance under the drum, and the two steel entrance columns
  b.add(new T.CylinderGeometry(DRUM_R + 1.0, DRUM_R + 1.0, 0.18, 24), 'stone' as never, DRUM[0], 0.09, DRUM[1]);
  b.add(new T.CylinderGeometry(DRUM_R + 0.5, DRUM_R + 0.5, 0.18, 24), 'stone' as never, DRUM[0], 0.27, DRUM[1]);

  // ---- facades from the 3DBAG walls, outward side = the lower neighbour ----
  setSink(0.08);
  const walls: {w: Wall; s: Surface}[] = [];
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const r = s.rings[0], lo = Math.min(...r.map(p => p[1])), hi = topOf(s);
    if (hi - lo < 6 || hi > 41) return;
    const [mx, mz] = midOf(s);
    const w0 = wallAwayFrom(s, i, [mx, mz + 1e-3]);
    if (!w0 || w0.length < 3) return;
    const hA = heightAt(mx + w0.n[0] * 0.6, mz + w0.n[1] * 0.6), hB = heightAt(mx - w0.n[0] * 0.6, mz - w0.n[1] * 0.6);
    if (Math.min(hA, hB) > 1 || Math.abs(hA - hB) < 5) return;
    const w = wallAwayFrom(s, i, hA < hB ? [mx - w0.n[0] * 4, mz - w0.n[1] * 4] : [mx + w0.n[0] * 4, mz + w0.n[1] * 4]);
    if (w) walls.push({w, s});
  });
  const dot = (w: Wall) => w.n[0] * F.n[0] + w.n[1] * F.n[1];
  // distance of a point across the front, from the drum axis (positive = viewer's right, to the north)
  const across = (p: Pt) => (p[0] - DRUM[0]) * F.tangent[0] + (p[1] - DRUM[1]) * F.tangent[1];
  const floorsY = Array.from({length: FLOORS}, (_, k) => Y0 + k * PITCH);

  for (const {w} of walls) {
    const L = w.length, f = w as unknown as Frame;
    const end0: Pt = w.origin, end1: Pt = [w.origin[0] + w.tangent[0] * L, w.origin[1] + w.tangent[1] * L];
    if (dot(w) > 0.9 && L > 7) {
      // front of a block: tall windows at the outer corner, a grey recess with a balcony stack towards the drum
      const outerAtEnd0 = Math.abs(across(end0)) > Math.abs(across(end1));
      const tOuter = outerAtEnd0 ? 1.5 : L - 1.5, recess0 = outerAtEnd0 ? 3.0 : 0.3, recess1 = outerAtEnd0 ? L - 0.3 : L - 3.0;
      const rw = recess1 - recess0, rc = (recess0 + recess1) / 2;
      slab(b, f, rc, Y0 - 0.3, rw, 40.2 - Y0 - 0.2, 0.05, 'concrete');
      // narrow balconies (2.6 m) hug the drum; the rest of the recess is a wide white-framed window band (w04-78)
      const bc = outerAtEnd0 ? recess1 - 1.45 : recess0 + 1.45;
      for (const y of floorsY) {
        windowAt(b, f, tOuter, y + 0.5, 1.1, 2.0);
        slab(b, f, rc, y + 0.45, rw - 0.8, 1.9, 0.1, 'glass', 0.05);
        for (let k = 1; k < 4; k++) slab(b, f, recess0 + 0.4 + (rw - 0.8) * k / 4, y + 0.45, 0.1, 1.9, 0.06, 'white', 0.15);
        slab(b, f, bc, y - 0.12, 2.6, 0.18, 1.35, 'concrete', 0.05);
        slab(b, f, bc, y + 0.06, 2.6, 1.0, 0.08, 'frame', 1.32);
      }
      // ground floor: shop windows under the grey canopy band (the broad first-floor balcony)
      // two white-framed windows by the entrance and the broad shop window at the corner (w04-78)
      const inner = (k: number) => outerAtEnd0 ? L - 1.2 - k * 1.7 : 1.2 + k * 1.7;
      for (const k of [0, 1]) windowAt(b, f, inner(k), 0.9, 1.2, 1.7);
      const shopC = outerAtEnd0 ? 2.4 : L - 2.4;
      slab(b, f, shopC, 0.55, 3.8, 2.6, 0.06, 'white');
      slab(b, f, shopC, 0.65, 3.6, 2.4, 0.1, 'glass');
      slab(b, f, L / 2, Y0 - 0.95, L, 0.85, 1.6, 'greyBrick');
    } else if (dot(w) < -0.9 && Math.abs(across(midOf2(w))) < 6 && L > 3.5) {
      // rear centre: balcony stacks against a grey recess
      slab(b, f, L / 2, Y0 - 0.3, L - 0.6, 40.2 - Y0 - 0.2, 0.05, 'concrete');
      for (const y of floorsY) {
        slab(b, f, L / 2, y + 0.2, L - 1.2, 2.3, 0.1, 'glass', 0.05);
        slab(b, f, L / 2, y - 0.12, L - 0.6, 0.18, 1.2, 'concrete', 0.05);
        slab(b, f, L / 2, y + 0.06, L - 0.6, 1.0, 0.08, 'frame', 1.17);
      }
    } else {
      // brick sides and rear blocks: white-framed windows, about one per 3.8 m, ground floor included
      const n = Math.max(1, Math.round((L - 1.2) / 3.8));
      for (let i = 0; i < n; i++) {
        const t = 0.6 + (L - 1.2) * (i + 0.5) / n;
        for (const y of [1.0, ...floorsY.map(v => v + 0.6)]) windowAt(b, f, t, y, 1.2, y < 3 ? 2.0 : 1.6);
      }
    }
  }
  setSink(0);
}
const midOf2 = (w: Wall): Pt => [w.origin[0] + w.tangent[0] * w.length / 2, w.origin[1] + w.tangent[1] * w.length / 2];
