/**
 * Bargeboards of a rendered gable (`FrontIntent.renderedGable`, Zaanhof 1919): a painted board along each raking edge
 * of the crown, drawn as a facade ornament lying just inside the edge (so it never reaches past the wall's silhouette or
 * through the roof), `bargeboard` metres deep measured square to the edge. Filled as wall (an opening-class trim fill
 * is judged as a window part against the nearest wall); oudWest.ts `paintStoreys` gives it the trim colour. The foot of each board is cut
 * level at the eaves and clear of the front's ends. Horizontal and vertical crown edges get none. Pure.
 */
import type {CanalhouseOrnament, CanalhousePoint} from '../canalhouseRecipes.ts';

const r = (v: number) => Math.round(v * 1000) / 1000;
/** Boards stop this far inside the front's ends (the fitted width can run a few cm past the facade's own length). */
const END_M = 0.06;

export function bargeboardOrnaments(profile: CanalhousePoint[], eaves: number, bargeboard: number, width: number): CanalhouseOrnament[] {
  const out: CanalhouseOrnament[] = [];
  for (let i = 1; i < profile.length; i++) {
    const [ax, ay] = profile[i - 1], [bx, by] = profile[i], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    // Raking edges only: rise and run both at least 0.2 m (step and neck shoulders are left alone).
    if (Math.abs(dx) < 0.2 || Math.abs(dy) < 0.2) continue;
    const drop = bargeboard * len / Math.abs(dx);
    // The lower edge of the board, cut at the eaves where it would run below them.
    const lower = (x: number, y: number): CanalhousePoint => [x, y - drop];
    let la = lower(ax, ay), lb = lower(bx, by);
    const atEaves = (p: CanalhousePoint, q: CanalhousePoint): CanalhousePoint => { const t = (eaves - p[1]) / (q[1] - p[1]); return [p[0] + t * (q[0] - p[0]), eaves]; };
    if (la[1] < eaves && lb[1] < eaves) continue;
    if (la[1] < eaves) la = atEaves(la, lb);
    if (lb[1] < eaves) lb = atEaves(lb, la);
    const ring: CanalhousePoint[] = [[ax, Math.max(ay, eaves)], [bx, Math.max(by, eaves)], lb, la].map(([x, y]) => [r(Math.min(Math.max(x, END_M), width - END_M)), r(y)] as CanalhousePoint);
    out.push({id: `bargeboard-${out.length}`, profile: ring, depthM: 0.04, fill: 'wall'});
  }
  return out;
}
