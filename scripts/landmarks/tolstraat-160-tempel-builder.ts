import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {roofHeightAt} from './nearbar-kit';
import {chordJunctions, curvedFront, sweepProfile, type CurvedFront, type ProfilePoint, type XZ} from '../../src/canalRecall/landmarks/curvedFront';
import source from './tolstraat-160-tempel-footprints.json';

/**
 * TOLSTRAAT 160, the former theosophical temple (BAG pand 0363100012155412, bouwjaar 1929, rijksmonument 5737), later
 * the Cinétol cinema and library, now an arts venue (nl.wikipedia Tolstraat 160). Not the 1983 Cinetol building at
 * Tolstraat 182 (0363100012233667). A fan-shaped hall: a quarter-circle auditorium whose curved white front faces the
 * square to the north-west, a low curved foyer wrapped round its foot, and a pale green fan roof rising to a stage
 * block at the apex. Massing is the 3DBAG LoD2.2 shell (tolstraat-160-tempel-footprints.json, native east/south metres);
 * detail from the Gemeente Amsterdam panoramas (CC BY 4.0) and the PDOK orthophoto, tolstraat-160-tempel-inventory.json:
 *  - foyer front (TMX7316010203-002112_pano_0001_000114/115, 2021-04-21; TMX7316010203-002800_pano_0005_000009, 2022):
 *    white render, a dark ribbon of windows under a thin projecting white fascia, the recessed blue entrance in the
 *    notch of the BAG outline.
 *  - drum (same captures): a low ribbon just over the foyer roof, a white band with a blue rail line, the tall upper
 *    ribbon of blue-framed glazing and a white fascia under the roof edge. The 2021 letters "... CLOSER, FURTHER AWAY"
 *    in the upper ribbon are gone by 2022 (temporary artwork, not modelled).
 *  - roof: pale green fan with radiating seams (orthophoto, panoramas), two white vent boxes at its crown.
 *  - the south-west and east sides stand in gardens with no usable capture: plain white render, inferred.
 */
export function buildTolstraat160Tempel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const src = source as unknown as {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
  const fan = new Set([122, 125, 126]);
  addShell(b, src as never, {wall: 'concrete', roof: 'stone', roofFor: (_s, i) => (fan.has(i) ? 'copper' : 'stone')});
  b.mark?.('shell');

  const sweep = (F: CurvedFront, s0: number, s1: number, prof: ProfilePoint[], colour: string, step = 0.8) => {
    const pos = sweepProfile(F, s0, s1, prof, {maxStep: step, closed: true, caps: true});
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    b.add(g, colour as never);
  };
  const box = (o0: number, o1: number, y0: number, y1: number): ProfilePoint[] => [[o0, y0], [o1, y0], [o1, y1], [o0, y1]];
  /** Outward side chosen so the normal at mid-length points north (the square). */
  const front = (pts: XZ[]) => {
    for (const side of [1, -1] as const) {
      const F = curvedFront(pts, {side});
      if (F.at(F.length / 2).n[1] < 0) return F;
    }
    throw Error('tolstraat-160: no north-facing side');
  };
  /** Mullions every `pitch` metres between s0 and s1. */
  const mullions = (F: CurvedFront, s0: number, s1: number, y0: number, y1: number, pitch: number, out: number, colour: string) => {
    const n = Math.max(1, Math.round((s1 - s0) / pitch));
    for (let k = 1; k < n; k++) {
      const s = s0 + (s1 - s0) * k / n, p = F.at(s);
      const g = new T.BoxGeometry(0.07, y1 - y0, 0.08).rotateY(Math.atan2(p.n[0], p.n[1])).translate(p.p[0] + p.n[0] * (out + 0.06), (y0 + y1) / 2, p.p[1] + p.n[1] * (out + 0.06));
      b.add(g, colour as never);
    }
  };

  // ==== Foyer front: BAG outline vertices 0 .. 72 (north-east end to the west end) ====
  const ring = src.nativeRing as XZ[];
  const foyer = front(chordJunctions(ring.slice(0, 73) as XZ[], 0.8, 0.6));
  const sNotch0 = foyer.project([1.5, -1.9]), sNotch1 = foyer.project([-2.9, 0.0]);
  const [e0, e1] = [Math.min(sNotch0, sNotch1), Math.max(sNotch0, sNotch1)];
  const fEnd = foyer.project([-11.8, 5.2]) - 0.3;
  for (const [a, c] of [[0.3, e0 - 0.9], [e1 + 0.9, fEnd]]) {
    sweep(foyer, a, c, box(-0.2, 0.07, 2.87, 3.48), 'glass');
    mullions(foyer, a, c, 2.87, 3.48, 1.25, 0.07, 'blue');
    sweep(foyer, a, c, box(-0.2, 0.36, 3.48, 3.8), 'white');
    sweep(foyer, a, c, box(-0.2, 0.1, 0, 0.3), 'stone');
  }
  // entrance: blue glazed doors across the recessed notch, a white fascia bridging it
  sweep(foyer, e0, e1, box(0.15, 0.3, 0.3, 2.75), 'blue', 0.5);
  sweep(foyer, e0 + 0.12, e1 - 0.12, box(0.15, 0.36, 0.4, 2.6), 'glass', 0.5);
  mullions(foyer, e0, e1, 0.4, 2.6, 1.0, 0.36, 'blue');
  sweep(foyer, e0 - 0.3, e1 + 0.3, box(-0.2, 0.5, 2.77, 3.8), 'concrete', 0.5);

  // ==== Drum: 3DBAG wall chords at r 22.4 m round the fan apex, from the north-east (-75 deg) to the west (-146 deg) ====
  const A: XZ = [8.9, 22.9];
  const pts: {p: XZ; a: number}[] = [];
  src.surfaces.forEach(s => {
    if (s.type !== 'WallSurface') return;
    const ys = s.rings[0].map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    if (!(lo > 3.3 && lo < 5.5 && hi > 7 && hi < 7.8)) return;
    for (const p of s.rings[0]) {
      const r = Math.hypot(p[0] - A[0], p[2] - A[1]), a = Math.atan2(p[2] - A[1], p[0] - A[0]) * 180 / Math.PI;
      if (r > 21.5 && r < 23.5 && a < -74 && a > -147 && !pts.some(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[2]) < 0.3)) pts.push({p: [p[0], p[2]], a});
    }
  });
  pts.sort((p, q) => q.a - p.a);
  const drum = front(pts.map(q => q.p));
  const d0 = 0.2, d1 = drum.length - 0.2;
  sweep(drum, d0, d1, box(-0.2, 0.07, 3.85, 4.46), 'glass');
  mullions(drum, d0, d1, 3.85, 4.46, 1.2, 0.07, 'blue');
  sweep(drum, d0, d1, box(-0.2, 0.12, 5.3, 5.5), 'blue');
  sweep(drum, d0, d1, box(-0.2, 0.07, 5.55, 7.2), 'glass');
  mullions(drum, d0, d1, 5.55, 7.2, 1.2, 0.07, 'blue');
  sweep(drum, d0, d1, box(-0.2, 0.13, 6.25, 6.32), 'blue');
  sweep(drum, d0 - 0.15, d1 + 0.15, box(-0.2, 0.3, 7.2, 7.75), 'white');

  // ==== Fan roof: seams radiating from the apex, two white vent boxes at the crown ====
  const roofs = src.surfaces.filter((s, i) => s.type === 'RoofSurface' && fan.has(i)) as never;
  for (let ang = -78; ang >= -144; ang -= 11) {
    const a = ang * Math.PI / 180, samples: [number, number, number][] = [];
    for (let r = 3; r <= 22.5; r += 0.5) {
      const x = A[0] + Math.cos(a) * r, z = A[1] + Math.sin(a) * r, h = roofHeightAt(roofs, x, z);
      if (h !== null && h > 7.9) samples.push([x, h, z]);
    }
    for (let k = 0; k + 1 < samples.length; k += 2) {
      const p = samples[k], q = samples[Math.min(k + 2, samples.length - 1)];
      if (p === q) break;
      const L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      const g = new T.BoxGeometry(0.12, 0.1, L);
      g.lookAt(new T.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
      g.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.06, (p[2] + q[2]) / 2);
      b.add(g, 'concrete' as never);
    }
  }
  for (const ang of [-98, -122]) {
    const a = ang * Math.PI / 180, x = A[0] + Math.cos(a) * 6, z = A[1] + Math.sin(a) * 6, h = roofHeightAt(roofs, x, z) ?? 14;
    b.box(x, h - 0.4, z, 1.4, 1.7, 1.1, 'white', -a);
  }
}
