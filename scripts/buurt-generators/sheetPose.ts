/**
 * Sheet pose check (lane D round 16): a panorama a row sheet is rectified from must stand on the row's street side and see
 * every member front unblocked. Integrator report 2026-11-16 on the Centrum sheets: Sleperssteeg 182789-182780 was cut from a
 * camera 17.5 m behind the fronts (in the street behind the block), Binnen Bantammerstraat 181775-182980 from one 23 m out
 * across another block; both sheets showed the wrong walls close up. The fronts' street side is their left (a->b, the
 * normal (dy, -dx) points to the street: +4 to +18 m on every accepted belt pick of rounds 14-15).
 */
export interface Pt { x: number; y: number }
export interface PoseMember { id: string; a: Pt; b: Pt }
export interface PoseVerdict { id: string; distM: number; footM: number; behind: boolean; blockedBy: string | null }
/** A camera this close to a front line counts as on it (GPS jitter), not behind it. */
export const POSE_BEHIND_TOL_M = 0.5;
const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
/** Proper crossing of segments p1-p2 and q1-q2 (shared end points do not count). */
export function segmentsCross(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2), d3 = cross(p1, p2, q1), d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** Each member's distance from the camera (+ on the street side), the camera foot along it, whether the camera stands
 *  behind it, and the first other front line crossing the sight line from the camera to its middle. */
export function poseCheck(cam: Pt, members: readonly PoseMember[], others: ReadonlyArray<{ id: string; a: Pt; b: Pt }>): PoseVerdict[] {
  const ids = new Set(members.map(m => m.id));
  return members.map(m => {
    const l = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) || 1, ux = (m.b.x - m.a.x) / l, uy = (m.b.y - m.a.y) / l;
    const distM = (cam.x - m.a.x) * uy - (cam.y - m.a.y) * ux, footM = (cam.x - m.a.x) * ux + (cam.y - m.a.y) * uy;
    const mid = { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 };
    const block = others.find(o => !ids.has(o.id) && segmentsCross(cam, mid, o.a, o.b));
    return { id: m.id, distM: +distM.toFixed(2), footM: +footM.toFixed(2), behind: distM < -POSE_BEHIND_TOL_M, blockedBy: block?.id ?? null };
  });
}
/** Why a pose cannot cut this row (empty: it can). */
export function poseFaults(v: readonly PoseVerdict[]): string[] {
  return v.flatMap(x => [...(x.behind ? [`${x.id}: camera ${(-x.distM).toFixed(1)} m behind the front`] : []), ...(x.blockedBy ? [`${x.id}: sight line crosses ${x.blockedBy}'s front`] : [])]);
}
