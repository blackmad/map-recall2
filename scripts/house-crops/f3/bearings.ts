/** F3 (#381): the second bearing per wall. A wall photographed from two sides of its normal sees past a tree, a van or a street lamp that hides the other view. */
import { lngLatToRd } from '../../../src/canalRecall/facade/rdNew.ts';
import type { PanoPick, Wall } from '../../pand-reference/select.ts';

/** Signed angle (deg) between the wall normal and the wall-centre-to-camera ray: negative = camera to the left of the wall's normal looking at it, positive = right. */
export function signedBearingDeg(camRd: { x: number; y: number }, wall: Pick<Wall, 'a' | 'b' | 'len' | 'nx' | 'ny' | 'mid'>): number {
  const ux = (wall.b.x - wall.a.x) / wall.len, uy = (wall.b.y - wall.a.y) / wall.len;
  const vx = camRd.x - wall.mid.x, vy = camRd.y - wall.mid.y;
  return Math.atan2(vx * ux + vy * uy, vx * wall.nx + vy * wall.ny) * 180 / Math.PI;
}
export const bearingOf = (p: PanoPick, wall: Wall): number => signedBearingDeg(lngLatToRd([p.record.geometry.coordinates[0], p.record.geometry.coordinates[1]]), wall);
export const isLeafOff = (timestamp: string): boolean => { const m = Number(timestamp.slice(5, 7)); return m <= 4 || m >= 11; };

/**
 * For each representative (one per mission year), the best other panorama of the SAME year whose bearing differs by at least
 * `minSepDeg`: clear ray first (`tier`), then leaf-off, then the straighter view. Returns at most one per representative.
 */
export function secondBearings(ranked: PanoPick[], reps: PanoPick[], bearing: (p: PanoPick) => number, tier: (p: PanoPick) => number, minSepDeg = 10): PanoPick[] {
  const out: PanoPick[] = [];
  for (const rep of reps) {
    const b0 = bearing(rep);
    const others = ranked.filter(c => c.missionYear === rep.missionYear && c.panoId !== rep.panoId && Math.abs(bearing(c) - b0) >= minSepDeg);
    others.sort((x, y) => tier(x) - tier(y) || Number(isLeafOff(y.timestamp)) - Number(isLeafOff(x.timestamp)) || x.obliquityDeg - y.obliquityDeg);
    if (others[0]) out.push(others[0]);
  }
  return out;
}
