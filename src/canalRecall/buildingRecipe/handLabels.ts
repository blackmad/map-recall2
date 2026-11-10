/**
 * Hand labels for the labelled fronts (lane H2d, docs/house-line.md "Openings and a stable wall").
 *
 * A glazing label is not a number read off by eye but the window openings drawn by hand on a metric grid over the crop
 * (rectangles in box metres: u along the wall, v above the ground): the share of the upper storeys' area (v >= the
 * ground band, up to the wall's top) that the drawn openings (glass and its frame, not the lintel, sill or surround)
 * take. Rectangles come as lattices (columns x rows of equal windows) and loose rects. Pure, no I/O.
 */
import type {FacadeBox} from './measureFacade.ts';

export interface OpeningsLabel {
  /** top of the wall in the crop (m): sky or roof above it is not facade */
  wallTopV: number;
  /** lowest v counted (default the ground band, 2.5 m); a pilotis storey under a slab is left out */
  vMin?: number;
  lattices: {u: [number, number][]; v: [number, number][]}[];
  rects: [number, number, number, number][];
  /** a patch of bare wall [u0, v0, u1, v1] the wall colour label is the median of */
  wallPatch?: [number, number, number, number];
}

const clip = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Hand glazing: drawn opening area over the area of the counted band of the box. */
export function handGlazing(label: OpeningsLabel, box: FacadeBox, groundBandM = 2.5): number {
  const v0 = Math.max(label.vMin ?? groundBandM, box.v0), v1 = Math.min(label.wallTopV, box.v1);
  const area = (v1 - v0) * (box.u1 - box.u0);
  if (area <= 0) return 0;
  const rects: [number, number, number, number][] = [...label.rects];
  for (const l of label.lattices) for (const [ua, ub] of l.u) for (const [va, vb] of l.v) rects.push([ua, va, ub, vb]);
  let open = 0;
  for (const [ua, va, ub, vb] of rects) open += clip(ua, ub, box.u0, box.u1) * clip(va, vb, v0, v1);
  return open / area;
}

/** The box moved by +-`d` m on each edge, one edge at a time and every combination of the three free edges (u0, u1, v1), base box first. */
export function jitterBoxes(box: FacadeBox, d = 0.1): FacadeBox[] {
  const out: FacadeBox[] = [box], seen = new Set<string>([JSON.stringify(box)]);
  const add = (b: FacadeBox) => { const k = JSON.stringify(b); if (!seen.has(k)) { seen.add(k); out.push(b); } };
  const r = (x: number) => +x.toFixed(3);
  for (const s of [-1, 1]) {
    add({...box, u0: r(box.u0 + s * d)}); add({...box, u1: r(box.u1 + s * d)}); add({...box, v1: r(box.v1 + s * d)});
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) add({...box, u0: r(box.u0 + a * d), u1: r(box.u1 + b * d), v1: r(box.v1 + c * d)});
  return out;
}

/** HSL lightness of a hex colour: the lightness the likeness gate's wall dL is taken in. */
export function hslLightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}
