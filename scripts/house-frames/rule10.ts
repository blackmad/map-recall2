/**
 * house:frames rule 10 (lane TF, 2026-11-13): acceptance frames at the detail a player sees.
 *
 * The pair frames house:frames has always made shoot at the panorama's lens (aimPose: the narrowest vertical FOV in
 * 45-120 deg that holds the front, typically 100-120 deg, 900 px buffer, so a focal of ~290 px) at a pixel ratio of 1.
 * Players see far more: the default chase camera is 36.87 deg (focal ~1,350 px at 900 px), first person 72 deg
 * (~620 px), and the user's Mac renders at dpr 2. Thin trim (14 cm speklagen, cornice lines) that a player sees can sit
 * under the thin fade's 1-2 px ramp (look/thinFade.ts) in a pano-lens frame, and the frame reads darker and plainer
 * than the game. Rule 10: accept on
 *
 * - the likeness frame: the photo pose, first person at FPS_FOV_DEG (72), pitched to hold the whole front and its crown,
 *   1440 x 900 css at dpr 2, beside the panorama cut to the same window at the same resolution. A front that does not
 *   fit at 72 deg is framed from a capture further back along the street (never a wider lens);
 * - the as-played frame: one per row sheet, the default engine and the default chase camera at dpr 2, the rider on the
 *   street before the row, riding along it;
 *
 * and keep the wide pano-lens frames for the tool's advisory flags only ("flags only, not for acceptance").
 *
 * Everything here is opt-in: without --rule10 / --likeness / --as-played house:frames writes what it wrote before.
 */
import { MAX_PITCH_DEG } from '../../src/canalRecall/ownMap/mapCamera.ts';
import { FPS_FOV_DEG } from '../../src/canalRecall/engine/fpsCamera.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { bearingTo, frameFor, projectRd, rdToLocal, CROWN_EXTRA_M, FIT_MARGIN_PX, FRAME_H, FRAME_W, PANO_EYE_HEIGHT_M, type FramePose, type Rd, type WallQuad } from './pose.ts';

/** The chase camera's vertical FOV (ownMap/mapCamera.ts DEFAULT_FOV_DEG, MapLibre's default). */
export const CHASE_FOV_DEG = 36.86989764584402;
/** Likeness: the first-person lens, never widened. */
export const LIKENESS_VFOV_DEG = FPS_FOV_DEG;
/** The pixel ratio of acceptance frames (the user's Mac). */
export const ACCEPT_DPR = 2;
/** How far the likeness search reaches for a capture that holds the front at 72 deg (m from the wall's middle). */
export const LIKENESS_MAX_DIST_M = 70;
/** The as-played rider stands this far before the row's near end, riding along it. */
export const AS_PLAYED_BACK_M = 15;
/** Shown on every wide pano-lens frame of a rule-10 run. */
export const FLAGS_ONLY = 'flags only, not for acceptance';

export type Rule10 = {
  /** Likeness frames (first person 72 deg, dpr `dpr`). */
  likeness: boolean;
  /** One as-played frame per list (default engine, chase camera, dpr `dpr`). */
  asPlayed: boolean;
  /** Pixel ratio of the likeness and as-played frames. */
  dpr: number;
  /** Metres before the row's near end for the as-played rider. */
  asPlayedBackM: number;
  /** How far the likeness search reaches (m). */
  likenessMaxDistM: number;
  /** Likeness frames draw without trees (`?trees3d=0`): game trees stand where the photo's are bare. Never as-played. */
  likenessTrees: 'hide' | 'show';
  /** Likeness: a capture across the water (the far bank) first when one holds the front. */
  farBank: boolean;
};

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) return argv[i + 1];
  return argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

/**
 * `--rule10` (both frames), `--likeness`, `--as-played`, `--dpr <n>` (default 2), `--as-played-back <m>` (default 15),
 * `--likeness-max-dist <m>` (default 70), `--likeness-trees hide|show` (default hide), `--no-far-bank`. Null when none
 * of the frame flags is given: the run is the old run.
 */
export function parseRule10(argv: string[]): Rule10 | null {
  const all = argv.includes('--rule10'), likeness = all || argv.includes('--likeness'), asPlayed = all || argv.includes('--as-played');
  if (!likeness && !asPlayed) return null;
  const num = (name: string, dflt: number, min: number, max: number) => {
    const raw = flag(argv, name);
    if (raw === undefined) return dflt;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`--${name} ${raw}: want a number in ${min}-${max}`);
    return v;
  };
  const trees = flag(argv, 'likeness-trees') ?? 'hide';
  if (trees !== 'hide' && trees !== 'show') throw new Error(`--likeness-trees ${trees}: want hide or show`);
  return { likeness, asPlayed, dpr: num('dpr', ACCEPT_DPR, 1, 4), asPlayedBackM: num('as-played-back', AS_PLAYED_BACK_M, 0, 200), likenessMaxDistM: num('likeness-max-dist', LIKENESS_MAX_DIST_M, 10, 150), likenessTrees: trees, farBank: !argv.includes('--no-far-bank') };
}

/** Wall ends, a quarter and the middle, at the base and with the crown allowance: what a likeness frame must hold. */
function fitPoints(wall: WallQuad): Array<{ p: Rd; z: number }> {
  const out: Array<{ p: Rd; z: number }> = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const p = { x: wall.a.x + (wall.b.x - wall.a.x) * t, y: wall.a.y + (wall.b.y - wall.a.y) * t };
    out.push({ p, z: 0 }, { p, z: wall.heightM + CROWN_EXTRA_M });
  }
  return out;
}

/** What a pose cuts off of the wall and its crown allowance ('top', 'bottom', 'sides'). */
export function misses(pose: FramePose, wall: WallQuad, margin = FIT_MARGIN_PX): string[] {
  const f = frameFor(pose), bad = new Set<string>();
  for (const q of fitPoints(wall)) {
    const s = projectRd(f, pose, q.p, q.z);
    if (s.depth <= 0) { bad.add('sides'); continue; }
    if (s.x < margin || s.x > pose.width - margin) bad.add('sides');
    if (s.y < margin) bad.add('top');
    if (s.y > pose.height - margin) bad.add('bottom');
  }
  return [...bad];
}

/**
 * A fixed-lens pose: at `cam`, heading at the wall centre, the vertical FOV `vfovDeg` (never widened), looking down
 * as little as the game allows (5 deg, MAX_PITCH_DEG) up to 30 deg: the look-down that centres the wall's vertical span
 * when that fits, else the first in 5..30 that holds the front and crown, else the centring one with `clipped` listing
 * what is cut off. Same aim as pose.ts aimPose; only the lens is held.
 */
export function fixedLensPose(cam: { lngLat: [number, number]; cameraNap?: number | null; eyeHeightM?: number }, wall: WallQuad, vfovDeg = LIKENESS_VFOV_DEG, size = { width: FRAME_W, height: FRAME_H }): FramePose {
  const lngLat = cam.lngLat, eye = cam.eyeHeightM ?? PANO_EYE_HEIGHT_M;
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const [mx, my] = rdToLocal(mid, lngLat), d = Math.max(1, Math.hypot(mx, my));
  const top = Math.atan2(wall.heightM + CROWN_EXTRA_M - eye, d) * 180 / Math.PI, bot = Math.atan2(-eye, d) * 180 / Math.PI;
  const minDown = 90 - MAX_PITCH_DEG, maxDown = 30;
  const centred = Math.min(maxDown, Math.max(minDown, -(top + bot) / 2));
  const base: FramePose = { rd: lngLatToRd(lngLat), lngLat, eyeHeightM: eye, cameraNap: cam.cameraNap ?? null, headingDeg: bearingTo(lngLat, mid), lookDownDeg: centred, vfovDeg, width: size.width, height: size.height, clipped: [] };
  if (!misses(base, wall).length) return base;
  for (let down = minDown; down <= maxDown + 1e-9; down += 0.5) {
    const p = { ...base, lookDownDeg: down };
    if (!misses(p, wall).length) return p;
  }
  return { ...base, clipped: misses(base, wall) };
}

/**
 * A likeness pose: the first-person lens (72 deg) held, the front and its crown brought into the window by raising the
 * window, not by widening the lens. The game camera cannot look up (MAX_PITCH_DEG), so the window is raised as a shift
 * lens: the game renders a taller frame (`pose`: height H + 2 * shiftPx, the same focal, its vertical FOV grown to
 * match) and the window is its top H rows; the photo is cut from the same tall frame. Same focal and pixel density as
 * a pitched camera, and the front's verticals stay vertical (an architectural view). shiftPx 0 is fixedLensPose.
 */
export type LikenessPose = {
  /** The camera the game and the photo cut render (css px): `window.height + 2 * shiftPx` tall. */
  pose: FramePose;
  /** The acceptance window: the top `height` rows of `pose`'s frame. */
  window: { width: number; height: number };
  /** Rows the window sits above the frame's principal point (css px). */
  shiftPx: number;
  /** The lens the window sees (always LIKENESS_VFOV_DEG's focal). */
  focalPx: number;
  clipped: string[];
};
/** The tallest raise: a frame at most 3 windows tall (2 * shift <= 2 H). */
export const MAX_SHIFT_WINDOWS = 1;

export function likenessPose(cam: { lngLat: [number, number]; cameraNap?: number | null; eyeHeightM?: number }, wall: WallQuad, vfovDeg = LIKENESS_VFOV_DEG, size = { width: FRAME_W, height: FRAME_H }): LikenessPose {
  const H = size.height, f = 0.5 * H / Math.tan(vfovDeg * Math.PI / 360), m = FIT_MARGIN_PX;
  const base = fixedLensPose(cam, wall, vfovDeg, size);
  const shifted = (s: number, clipped: string[], at: FramePose): LikenessPose => {
    const tallH = H + 2 * s, vfov = 2 * Math.atan(tallH / 2 / f) * 180 / Math.PI;
    return { pose: { ...at, height: tallH, vfovDeg: vfov, clipped }, window: { width: size.width, height: H }, shiftPx: s, focalPx: f, clipped };
  };
  if (!base.clipped.length) return shifted(0, [], base);
  // Look down as little as the game allows; raise the window until the crown allowance is inside it.
  const low = { ...base, lookDownDeg: 90 - MAX_PITCH_DEG }, fr = frameFor(low);
  let umin = Infinity, umax = -Infinity, sides = false;
  for (const q of fitPoints(wall)) {
    const p = projectRd(fr, low, q.p, q.z);
    if (p.depth <= 0 || p.x < m || p.x > size.width - m) { sides = true; if (p.depth <= 0) continue; }
    umin = Math.min(umin, p.y - H / 2); umax = Math.max(umax, p.y - H / 2);
  }
  const need = Math.ceil(Math.max(0, -umin - H / 2 + m));
  const s = Math.min(need, MAX_SHIFT_WINDOWS * H);
  const clipped = [...(sides ? ['sides'] : []), ...(need > s ? ['top'] : []), ...(umax > -s + H / 2 - m ? ['bottom'] : [])];
  return shifted(s, clipped, low);
}

/** Where a window-frame point lands: the tall frame's px, less nothing (the window is the top rows). For tests. */
export function windowPoint(lp: LikenessPose, p: Rd, zM: number): { x: number; y: number; depth: number } {
  return projectRd(frameFor(lp.pose), lp.pose, p, zM);
}

export type LikenessCandidate = { lngLat: [number, number]; cameraNap?: number | null; distM: number; id: string; farBank?: boolean };
export type LikenessChoice = { lp: LikenessPose; index: number; steppedBackM: number; farBank: boolean; note: string };

/**
 * The likeness capture, in this order:
 * 1. with `farBank`, the nearest capture across the water (its sight line crosses a canal) that holds the front: square
 *    frames with the whole front, crown and row (canal-side houses);
 * 2. the pair's own capture (`picked`) when it holds the front;
 * 3. stepping back: the nearest capture farther from the wall than the pair's that holds it;
 * 4. else the one that cuts off least (fewest clipped edges, the pair's own on a tie), listed as clipped.
 */
export function chooseLikeness(cands: LikenessCandidate[], picked: number, wall: WallQuad, opts: { farBank?: boolean; vfovDeg?: number; size?: { width: number; height: number } } = {}): LikenessChoice | null {
  if (!cands.length) return null;
  const vfov = opts.vfovDeg ?? LIKENESS_VFOV_DEG, size = opts.size ?? { width: FRAME_W, height: FRAME_H };
  const own = cands[Math.max(0, Math.min(cands.length - 1, picked))];
  const byDist = (a: LikenessCandidate, b: LikenessCandidate) => a.distM - b.distM;
  const far = opts.farBank ? cands.filter(c => c.farBank).sort(byDist) : [];
  const order = [...far, own, ...cands.filter(c => c !== own && c.distM > own.distM && !far.includes(c)).sort(byDist)];
  const seen = new Set<LikenessCandidate>();
  let best: { c: LikenessCandidate; lp: LikenessPose } | null = null;
  const done = (c: LikenessCandidate, lp: LikenessPose, note: string): LikenessChoice => ({ lp, index: cands.indexOf(c), steppedBackM: +(c.distM - own.distM).toFixed(1), farBank: !!c.farBank, note });
  for (const c of order) {
    if (seen.has(c)) continue;
    seen.add(c);
    const lp = likenessPose({ lngLat: c.lngLat, cameraNap: c.cameraNap }, wall, vfov, size);
    const raise = lp.shiftPx ? `, window raised ${lp.shiftPx} px` : '';
    if (!lp.clipped.length) {
      if (c.farBank) return done(c, lp, `across the water: ${c.id} (${c.distM.toFixed(1)} m)${raise}`);
      if (c === own) return done(c, lp, `the pair's capture holds the front at ${vfov.toFixed(0)} deg${raise}`);
      return done(c, lp, `stepped back ${(c.distM - own.distM).toFixed(1)} m to ${c.id} (${c.distM.toFixed(1)} m) to hold the front at ${vfov.toFixed(0)} deg${raise}`);
    }
    if (!best || lp.clipped.length < best.lp.clipped.length || (lp.clipped.length === best.lp.clipped.length && c === own)) best = { c, lp };
  }
  return done(best!.c, best!.lp, `no capture within reach holds the front at ${vfov.toFixed(0)} deg: clipped ${best!.lp.clipped.join('+')}`);
}

/** Segments (RD) of the water centrelines (public/data/extracts/amsterdam/water.json `paths`, [lat, lng] points). */
export type WaterSegs = Array<[Rd, Rd]>;
export function waterSegments(water: Array<{ paths?: number[][][]; path?: number[][] }>): WaterSegs {
  const out: WaterSegs = [];
  for (const w of water) for (const path of w.paths ?? (w.path ? [w.path] : [])) {
    for (let i = 1; i < path.length; i++) out.push([lngLatToRd([path[i - 1][1], path[i - 1][0]]), lngLatToRd([path[i][1], path[i][0]])]);
  }
  return out;
}
const crosses = (p: Rd, q: Rd, a: Rd, b: Rd) => {
  const o = (u: Rd, v: Rd, w: Rd) => Math.sign((v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x));
  return o(p, q, a) !== o(p, q, b) && o(a, b, p) !== o(a, b, q);
};
/** A capture across the water from the wall: the sight line to the wall's middle crosses a canal centreline. */
export function acrossWater(cam: Rd, wall: WallQuad, segs: WaterSegs): boolean {
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const x0 = Math.min(cam.x, mid.x), x1 = Math.max(cam.x, mid.x), y0 = Math.min(cam.y, mid.y), y1 = Math.max(cam.y, mid.y);
  return segs.some(([a, b]) => Math.max(a.x, b.x) >= x0 && Math.min(a.x, b.x) <= x1 && Math.max(a.y, b.y) >= y0 && Math.min(a.y, b.y) <= y1 && crosses(cam, mid, a, b));
}

/**
 * The as-played rider: on the street line through the captures, `backM` before the row's near end, heading along the
 * row with the fronts on the rider's right (Dutch traffic keeps right, so that side's fronts are the near ones).
 * `walls` carry their outward normal (from the wall toward the street).
 */
export function asPlayedPose(walls: Array<WallQuad & { nx: number; ny: number }>, captures: Rd[], backM = AS_PLAYED_BACK_M): { rd: Rd; lngLat: [number, number]; headingDeg: number } | null {
  if (!walls.length || !captures.length) return null;
  // The row's direction: the sum of the wall vectors, each turned to agree with the first.
  let dx = 0, dy = 0;
  for (const w of walls) {
    let vx = w.b.x - w.a.x, vy = w.b.y - w.a.y;
    if (vx * (walls[0].b.x - walls[0].a.x) + vy * (walls[0].b.y - walls[0].a.y) < 0) { vx = -vx; vy = -vy; }
    dx += vx; dy += vy;
  }
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  dx /= len; dy /= len;
  // Fronts on the right: right(h) = (hy, -hx); the street lies along +n from the wall, so the wall is at -n from the rider.
  const nx = walls.reduce((s, w) => s + w.nx, 0), ny = walls.reduce((s, w) => s + w.ny, 0);
  if (-(nx) * dy + -(ny) * -dx < 0) { dx = -dx; dy = -dy; }
  // The street line: through the captures' centroid along the row.
  const cx = captures.reduce((s, p) => s + p.x, 0) / captures.length, cy = captures.reduce((s, p) => s + p.y, 0) / captures.length;
  const along = (p: Rd) => (p.x - cx) * dx + (p.y - cy) * dy;
  const near = Math.min(...walls.flatMap(w => [along(w.a), along(w.b)]));
  const rd = { x: cx + dx * (near - backM), y: cy + dy * (near - backM) };
  const lngLat = rdToLngLat(rd) as [number, number];
  // RD grid bearing → true bearing (the grid sits ~0.4 deg off true north in the centre): bearingTo a point ahead.
  const ahead = { x: rd.x + dx * 50, y: rd.y + dy * 50 };
  return { rd, lngLat, headingDeg: bearingTo(lngLat, ahead) };
}

/** The world a query draws: live tiles (`?world=live`) or the baked world-v1 cells (the default), staged when WORLD_DIR. */
export function worldOf(query: string, worldDir = process.env.WORLD_DIR): string {
  const live = /(^|[?&])world=live(&|$)/.test(query);
  return `${live ? 'live tiles' : 'baked world-v1'}${worldDir && !live ? ' (staged WORLD_DIR)' : ''}`;
}
/** The engine a query runs: `own` when asked (house:frames' first-person frames always ask), else the default (MapLibre). */
export function engineOf(query: string, firstPerson: boolean): string {
  const m = /(^|[?&])engine=(\w+)/.exec(query);
  return m ? m[2] : firstPerson ? 'own' : 'default (maplibre)';
}

/** One caption line naming camera, FOV, pixel ratio, engine and world (rule 10: every acceptance frame says these). */
export function cameraCaption(o: { camera: 'first person' | 'chase'; vfovDeg: number; dpr: number; engine: string; world: string; wide?: boolean }): string {
  return `camera ${o.camera} ${o.vfovDeg.toFixed(o.vfovDeg % 1 ? 1 : 0)}° vfov  |  pixel ratio ${o.dpr}  |  engine ${o.engine}  |  world ${o.world}${o.wide ? `  |  ${FLAGS_ONLY}` : ''}`;
}

/** Sheet geometry: three columns (photo | today | candidate), panels at least 700 px wide, 16:10 like the frames. */
export const SHEET = { panelW: 720, panelH: 450, gap: 8, rowsPerSheet: 4, captionPx: 13 } as const;
