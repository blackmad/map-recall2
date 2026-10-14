import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {anchorIron, archRing, FRAME, IRON, GLASS, KitStats, opening, solid, STONE} from './tropenmuseum-kit';
import facades from './tropenmuseum-facades.json';

/**
 * The museum's three-bay pavilion faces, drawn from the measured rhythm in tropenmuseum-facades.json (read off 50 px/m rectified panorama
 * crops, see its `measuredBy`): raised souterrain with round-arched barred windows, string course, per floor two side windows with
 * corniced hoods and a centre triple window in two tiers, relief slabs under dentil cornices, wrought-iron anchors, the round-arched
 * head over the top triple and the dentil cornice. The kit's own cells are skipped below the measured height (`skipFloors`).
 */
type Pair = [number, number];
interface Floor {sideLower: Pair; sideUpper: Pair; cLower: Pair; cUpper: Pair; relief?: {y: Pair; cornice: Pair; ledge: Pair}; arch?: {spring: number; top: number; ring: number}}
export interface PavilionWall {
  what: string; panel: number; surfaces: number[]; sToU: number; faceS: Pair;
  plinth: {y: Pair; out: number}; souterrain: {s: number[]; w: number; y: Pair};
  side: {s: Pair[]; pad: number}; centre: {lights: Pair[]; surround: Pair};
  floors: Floor[]; anchors: {s: number[]; y0: number[]; h: number}; cornice?: {y: Pair; s: Pair};
}
export const PAVILION_WALLS = Object.values((facades as unknown as {walls: Record<string, PavilionWall>}).walls);
/** the kit floors (4.4 m pitch) a measured wall replaces: those whose cells start below the measured top */
export const skipFloors = (w: PavilionWall) => w.cornice ? 5 : 2;
export const pavilionWallOf = (surfaces: number[]) => PAVILION_WALLS.find(w => w.surfaces.some(s => surfaces.includes(s)));

const WIN = {frame: FRAME, glass: GLASS, frameW: 0.05, sillOnWall: true};

/** Debug switches (formerly TROP_ONLY / TROP_SKIP): draw one panel only, or leave out relief slabs, anchors or the cornice. */
export interface PavilionOptions {only?: number; skip?: ('relief' | 'anchors' | 'cornice')[]}

export function pavilionFace(c: PanelCtx, stats: KitStats, w: PavilionWall, opt: PavilionOptions = {}) {
  if (opt.only !== undefined && opt.only !== w.panel) return;
  const U = (s: number) => s + w.sToU, part = c.part(), what = `pavilion ${w.what}`;
  const lo = (s: number) => Math.max(U(s), c.p.uMin + 0.04), hi = (s: number) => Math.min(U(s), c.p.uMax - 0.04);
  const slab = (s0: number, s1: number, y0: number, y1: number, out: number) => solid(c, STONE, lo(s0), hi(s1), y0, y1, 0, out, part);
  const dentils = (s0: number, s1: number, y0: number, y1: number, out: number) => {
    const pitch = s1 - s0 > 5 ? 0.6 : 0.4, wd = pitch / 2; // coarser than the real ~0.2 m dentils: one block per ~3 gallery pixels at riding distance
    for (let s = s0 + 0.05; s + wd < s1; s += pitch) solid(c, STONE, U(s), U(s + wd), y0, y1, 0, out, part);
  };
  // ---- string course, souterrain arches ------------------------------------------------------------------------------------------------
  slab(w.faceS[0], w.faceS[1], w.plinth.y[0], w.plinth.y[1], w.plinth.out);
  for (const s of w.souterrain.s) {
    const a = s - w.souterrain.w / 2, b = s + w.souterrain.w / 2;
    opening(c, stats, `${what} souterrain arch`, U(a), U(b), w.souterrain.y[0], w.souterrain.y[1], {
      frame: IRON, glass: GLASS, frameW: 0.05, sillOnWall: true, mullAt: [0.5],
      arch: {kind: 'round', segments: 4, band: {slot: STONE, t: 0.07, out: 0.05, imposts: STONE, keystone: STONE}},
    });
  }
  // ---- floors ----------------------------------------------------------------------------------------------------------------------------
  const [cs0, cs1] = w.centre.surround;
  w.floors.forEach(f => {
    for (const [a, b] of w.side.s) {
      opening(c, stats, `${what} side window`, U(a), U(b), f.sideLower[0], f.sideLower[1], {...WIN, mullAt: [0.5], rowsAt: [0.5]});
      opening(c, stats, `${what} side window`, U(a), U(b), f.sideUpper[0], f.sideUpper[1], {...WIN, mullAt: [0.5], rowsAt: [0.5]});
      const p = w.side.pad;
      slab(a - p - 0.04, b + p + 0.04, f.sideLower[0] - 0.14, f.sideLower[0] - 0.02, 0.1);                                   // sill ledge
      slab(a - p, b + p, f.sideLower[1] + 0.05, f.sideUpper[0] - 0.05, 0.1);                                                 // transom ledge
      slab(a - p - 0.04, b + p + 0.04, f.sideUpper[1] + 0.18, f.sideUpper[1] + 0.42, 0.1);                                    // hood cornice
      archRing(c, STONE, U(a - 0.02), U(b + 0.02), f.sideUpper[1] + 0.42, 0.22, 0.06, 0.05, 0, 4);                           // blind arch over the hood
    }
    const arch = f.arch;
    const cTop = arch ? f.cUpper[1] : f.cUpper[1];
    {
      // one cut per tier across the three lights; the stone piers (below) stand in the plane of the wall over the glass
      const L0 = w.centre.lights[0][0], L1 = w.centre.lights[w.centre.lights.length - 1][1], span = L1 - L0;
      const bars: number[] = [];
      w.centre.lights.forEach(([a, b]) => bars.push(((a + b) / 2 - L0) / span)); // sash bars at the light centres only: the piers stand over the rest
      for (const [y0, y1] of [f.cLower, f.cUpper]) opening(c, stats, `${what} centre triple`, U(L0), U(L1), y0, y1, {...WIN, rowsAt: [0.5], mullAt: bars});
    }
    // stone surround: jambs, piers, sill, transom, head
    const lights = w.centre.lights, parts: Pair[] = [[cs0, lights[0][0] - 0.03]];
    for (let i = 0; i < lights.length - 1; i++) parts.push([lights[i][1] + 0.03, lights[i + 1][0] - 0.03]);
    parts.push([lights[lights.length - 1][1] + 0.03, cs1]);
    for (const [a, b] of parts) solid(c, STONE, lo(a), hi(b), f.cLower[0] - 0.12, f.cUpper[1] + 0.05, 0, 0.08, part);
    slab(cs0 - 0.05, cs1 + 0.05, f.cLower[0] - 0.16, f.cLower[0] - 0.02, 0.12);
    slab(cs0, cs1, f.cLower[1] + 0.02, f.cUpper[0] - 0.02, 0.1);
    void cTop;
    if (f.arch) {
      // round-arched head over the top triple: one arched glass opening above the upper tier, a stone ring with springing and apex blocks
      const spring = f.arch.spring, t = 0.13, a = lights[0][0], b = lights[lights.length - 1][1];
      slab(cs0, cs1, f.cUpper[1] + 0.02, spring, 0.1);
      opening(c, stats, `${what} arched head`, U(a), U(b), spring, f.arch.top, {...WIN, mullAt: [0.333, 0.667], arch: {kind: 'round', segments: 8, band: {slot: STONE, t, out: 0.08, imposts: STONE, keystone: STONE}}});
    } else slab(cs0, cs1, f.cUpper[1] + 0.02, f.cUpper[1] + 0.12, 0.1);
    // relief slab under a dentil cornice and a ledge: the carved field has no iconography modelled
    if (f.relief && !opt.skip?.includes('relief')) {
      const r = f.relief, a = cs0 + 0.05, b = cs1 - 0.05;
      slab(cs0 - 0.05, cs1 + 0.05, r.ledge[0], r.ledge[1], 0.12);
      slab(a + 0.1, b - 0.1, r.y[0], r.y[1], 0.1);
      slab(cs0 - 0.05, cs1 + 0.05, r.cornice[1] - 0.12, r.cornice[1], 0.14);
      slab(cs0, cs1, r.cornice[0], r.cornice[1] - 0.12, 0.1);
      dentils(cs0 + 0.1, cs1 - 0.1, r.cornice[0] + 0.02, r.cornice[1] - 0.12, 0.1);
    }
  });
  if (!opt.skip?.includes('anchors')) w.anchors.s.forEach(s => w.anchors.y0.forEach(y => anchorIron(c, U(s), y, w.anchors.h, part)));
  // ---- the cornice under the stage above ---------------------------------------------------------------------------------------------
  if (w.cornice && !opt.skip?.includes('cornice')) {
    const [y0, y1] = w.cornice.y, [s0, s1] = w.cornice.s;
    slab(s0, s1, y0, y0 + (y1 - y0) * 0.35, 0.2);
    dentils(s0 + 0.1, s1 - 0.1, y0 + (y1 - y0) * 0.35, y0 + (y1 - y0) * 0.65, 0.28);
    slab(s0 - 0.05, s1 + 0.05, y0 + (y1 - y0) * 0.65, y1, 0.34);
    for (const [a, b] of [[cs0, cs0 + 0.8], [cs1 - 0.8, cs1]] as Pair[]) slab(a, b, y0, y1 + 0.1, 0.4);   // console blocks (the lion masks are not modelled)
  }
  stats.drawn.push(`${what}: souterrain, string course, ${w.floors.length} floors, reliefs, anchors${w.cornice ? ', dentil cornice' : ''}`);
}
