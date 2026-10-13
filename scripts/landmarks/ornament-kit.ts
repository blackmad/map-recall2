/**
 * Small geometry kit for the signature ornaments the ornament-inventory lane adds to existing builders (2026-10-13):
 * raised stroke-font lettering (signage.ts glyphs, so landmark and shop lettering share one face) and clock hands.
 * Every part is built facing +z with its back embedded 1 cm behind z = 0, so it touches the wall it is placed on
 * (no floating-opening findings) and never shares a plane with it (no z-fighting). Place it with
 * `b.add(geometry, colour, x, y, z, angle)` where the builder's angle turns local +z to the wall's outward normal.
 */
import * as T from 'three';
import {letteringGeometry, type LetteringOptions} from '../../src/canalRecall/buildingRecipe/signage';

const EMBED = 0.01;

/**
 * Raised letters: each stroke quad becomes a front face `depthM` proud plus its four sides (10 triangles per stroke).
 * `sides: false` keeps only the front faces (2 triangles per stroke) for long texts read square-on; keep `depthM` above
 * 3 cm then (the geometry audit reports faces 1-3 cm apart as near z-fighting) and use a colour outside the opening
 * materials (white, dark, glass, frame, door), whose detached parts the audit reports as floating.
 */
export function raisedLettering(o: LetteringOptions & {depthM?: number; sides?: boolean}): {geometry: T.BufferGeometry; widthM: number; heightM: number} {
  const flat = letteringGeometry(o), depth = o.depthM ?? 0.035, p = flat.positions, out: number[] = [];
  const push = (a: number[], b: number[], c: number[]) => out.push(...a, ...b, ...c);
  for (let q = 0; q + 18 <= p.length; q += 18) {
    const pts: [number, number][] = [];
    for (let v = 0; v < 6; v++) {
      const x = p[q + v * 3], y = p[q + v * 3 + 1];
      if (!pts.some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6)) pts.push([x, y]);
    }
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, v) => s + v[0], 0) / pts.length, cy = pts.reduce((s, v) => s + v[1], 0) / pts.length;
    pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)); // counter-clockwise seen from +z
    const F = pts.map(([x, y]) => [x, y, depth]), B = pts.map(([x, y]) => [x, y, -EMBED]);
    for (let i = 1; i + 1 < F.length; i++) push(F[0], F[i], F[i + 1]);
    if (o.sides !== false) for (let i = 0; i < F.length; i++) { const j = (i + 1) % F.length; push(B[i], B[j], F[j]); push(B[i], F[j], F[i]); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return {geometry: g, widthM: flat.widthM, heightM: flat.heightM};
}

/** Hour and minute hands for a clock face of radius `r`, pivot at the origin, lying on z in [-EMBED, depth]. */
export function clockHands(r: number, hours = 10, minutes = 10, depthM = 0.04): T.BufferGeometry[] {
  const hand = (len: number, width: number, turns: number) => {
    const g = new T.BoxGeometry(width, len, depthM + EMBED).translate(0, len / 2 - width / 2, (depthM - EMBED) / 2);
    return g.rotateZ(-turns * Math.PI * 2);
  };
  return [hand(r * 0.55, r * 0.09, (hours % 12 + minutes / 60) / 12), hand(r * 0.85, r * 0.06, minutes / 60)];
}
