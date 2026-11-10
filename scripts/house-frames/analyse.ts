/**
 * house:frames checks (lane H10, #358): the alignment check that makes a pair trustworthy and the advisory flags printed
 * on its caption. Pure functions over the two halves (pose.ts frames, photo.ts images) and the game's picks.
 *
 * Alignment: the BAG wall outline is projected into both halves with the one pose; on the photo, a vertical-edge search
 * along each projected wall end (and a horizontal one along the crown line) says how far the facade's real edge sits
 * from the outline, in % of the image width. The same search on the game half checks the camera hand-over.
 */
import type { CameraFrame } from '../../src/canalRecall/ownMap/mapCamera.ts';
import { measureFacade, MEASURE_PROFILES } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { blurRgb, storeyLines } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { wallPoint, type FramePose, type WallQuad } from './pose.ts';
import { rectifyFromFrame, type Rgb8 } from './photo.ts';

/** Search half-width around a projected edge, % of the image width; edges further off than this are not found. */
export const EDGE_SEARCH_PCT = 6;
/** An edge reads as found when its consistent gradient is this many times the search window's median. */
export const EDGE_MIN_CONTRAST = 1.8;
/** Roof offset: the game's skyline over the wall sits this far (m, on the wall plane) from the photo's. */
export const ROOF_OFFSET_M = 1;

const luma = (img: Rgb8, x: number, y: number) => {
  const xi = Math.max(0, Math.min(img.width - 1, Math.round(x))), yi = Math.max(0, Math.min(img.height - 1, Math.round(y))), o = (yi * img.width + xi) * 3;
  return 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2];
};

export type EdgeRead = { side: 'left' | 'right' | 'crown'; offsetPx: number; offsetPct: number; contrast: number; found: boolean };

/**
 * Edge offset along a projected segment p0 -> p1: shift the segment by `d` px along its normal (x for the vertical wall
 * ends, y for the crown) and score |mean signed gradient across it|. A real facade edge keeps its sign along its length;
 * brick texture and window rows do not. The best shift is the offset; contrast = best / median over the window.
 */
function edgeAlong(img: Rgb8, p0: { x: number; y: number }, p1: { x: number; y: number }, axis: 'x' | 'y', side: EdgeRead['side']): EdgeRead {
  const R = Math.round(img.width * EDGE_SEARCH_PCT / 100), steps = 48, scores: number[] = [];
  let best = -1, bestD = 0;
  for (let d = -R; d <= R; d++) {
    let sum = 0, n = 0;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t;
      const cx = axis === 'x' ? x + d : x, cy = axis === 'y' ? y + d : y;
      if (cx < 2 || cy < 2 || cx > img.width - 3 || cy > img.height - 3) continue;
      const g = axis === 'x' ? luma(img, cx + 1.5, cy) - luma(img, cx - 1.5, cy) : luma(img, cx, cy + 1.5) - luma(img, cx, cy - 1.5);
      sum += g; n++;
    }
    const s = n > steps / 3 ? Math.abs(sum / n) : 0;
    scores.push(s);
    if (s > best) { best = s; bestD = d; }
  }
  const sorted = [...scores].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 1e-6;
  const contrast = best / Math.max(med, 0.5);
  return { side, offsetPx: bestD, offsetPct: +(bestD / img.width * 100).toFixed(2), contrast: +contrast.toFixed(2), found: contrast >= EDGE_MIN_CONTRAST && Math.abs(bestD) < R };
}

/**
 * The three edge reads of a half: the wall's two ends (from 35 % of the wall height to its top, clear of cars and street
 * furniture) and the crown line (the wall top, inner 80 %). Ends that fall off frame are skipped.
 */
export function edgeOffsets(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad): EdgeRead[] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), out: EdgeRead[] = [];
  const inFrame = (p: { x: number; y: number; depth: number }) => p.depth > 0 && p.x >= 0 && p.x <= img.width && p.y >= 0 && p.y <= img.height;
  const ends: Array<[number, 'left' | 'right']> = [[0, 'left'], [len, 'right']];
  for (const [u, s] of ends) {
    const p0 = wallPoint(frame, pose, wall, u, wall.heightM * 0.35), p1 = wallPoint(frame, pose, wall, u, wall.heightM);
    if (!inFrame(p0) || !inFrame(p1)) continue;
    // Which end is on the left of the image depends on the wall's winding: name them by screen side.
    const other = wallPoint(frame, pose, wall, len - u, wall.heightM * 0.5);
    out.push(edgeAlong(img, p0, p1, 'x', p0.x < other.x ? 'left' : 'right'));
    void s;
  }
  const c0 = wallPoint(frame, pose, wall, len * 0.1, wall.heightM), c1 = wallPoint(frame, pose, wall, len * 0.9, wall.heightM);
  if (inFrame(c0) && inFrame(c1)) out.push(edgeAlong(img, c0, c1, 'y', 'crown'));
  return out;
}

// ---- skyline: where each half's sky starts over the wall ------------------------------------------------------------
export type SkyCol = { u: number; topM: number | null };

/** Sky reference of a half: the median colour of its top 2 % rows, when at least half of them agree with it. */
function skyRef(img: Rgb8): [number, number, number] | null {
  const rows = Math.max(2, Math.round(img.height * 0.02)), px: number[][] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < img.width; x += 4) { const o = (y * img.width + x) * 3; px.push([img.data[o], img.data[o + 1], img.data[o + 2]]); }
  const med = [0, 1, 2].map(c => px.map(p => p[c]).sort((a, b) => a - b)[px.length >> 1]) as [number, number, number];
  const agree = px.filter(p => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]) < 45).length / px.length;
  const bright = med[0] + med[1] + med[2] > 300 || med[2] > med[0] + 15;
  return agree >= 0.5 && bright ? med : null;
}

/**
 * Per column over the wall (7 columns, 10-90 %): the height on the wall plane (m) where the sky ends, scanning down from
 * the top of the frame; null where the column starts in something that is not sky or the half has no clear sky. Read on
 * the wall plane, so a ridge set back from the front reads lower than its true height, alike in both halves.
 */
export function skyline(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad): SkyCol[] {
  const ref = skyRef(img), len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), out: SkyCol[] = [];
  for (let i = 0; i < 7; i++) {
    const u = len * (0.1 + 0.8 * i / 6);
    if (!ref) { out.push({ u, topM: null }); continue; }
    const base = wallPoint(frame, pose, wall, u, 0), hi = wallPoint(frame, pose, wall, u, wall.heightM * 3);
    const x = Math.round(base.x);
    if (base.depth <= 0 || x < 0 || x >= img.width) { out.push({ u, topM: null }); continue; }
    const isSky = (y: number) => { const o = (y * img.width + x) * 3; return Math.abs(img.data[o] - ref[0]) + Math.abs(img.data[o + 1] - ref[1]) + Math.abs(img.data[o + 2] - ref[2]) < 45; };
    if (!isSky(0)) { out.push({ u, topM: null }); continue; }
    let y = 0, run = 0;
    for (; y < Math.min(img.height, base.y); y++) { if (!isSky(y)) { if (++run >= 4) break; } else run = 0; }
    y -= run - 1;
    if (y >= base.y) { out.push({ u, topM: 0 }); continue; }
    // Height on the wall plane at that row: bisect v (the projection is monotonic in v along a vertical wall line).
    let lo = 0, top = wall.heightM * 3;
    if (hi.depth > 0 && hi.y > y) { out.push({ u, topM: null }); continue; }
    for (let k = 0; k < 30; k++) { const v = (lo + top) / 2, s = wallPoint(frame, pose, wall, u, v); if (s.y > y) lo = v; else top = v; }
    out.push({ u, topM: +((lo + top) / 2).toFixed(2) });
  }
  return out;
}

/** Median of game - photo skyline heights over the columns both halves read (m), with the count. */
export function skylineOffset(game: SkyCol[], photo: SkyCol[]): { medianM: number | null; n: number } {
  const d = game.map((g, i) => g.topM != null && photo[i]?.topM != null ? g.topM - photo[i].topM! : null).filter((v): v is number => v != null).sort((a, b) => a - b);
  return { medianM: d.length ? +d[d.length >> 1].toFixed(2) : null, n: d.length };
}

// ---- the game's picks ----------------------------------------------------------------------------------------------
export type Hit = { id: string; kind: string; model: string; depth: number } | null;
export type PickSample = { u: number; v: number; x: number; y: number; zone: 'wall' | 'above' };
/** Bare BAG number: '0363100012116526' from 'NL.IMBAG.Pand.0363100012116526'. */
export const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');

/** Pick grid: 7 x 5 points inside the wall (10-90 %), and a row of 7 between 1 and 3 m over the tile height. */
export function pickSamples(frame: CameraFrame, pose: FramePose, wall: WallQuad): PickSample[] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), out: PickSample[] = [];
  for (let i = 0; i < 7; i++) {
    const u = len * (0.1 + 0.8 * i / 6);
    for (let j = 0; j < 5; j++) {
      const v = wall.heightM * (0.12 + 0.76 * j / 4), s = wallPoint(frame, pose, wall, u, v);
      if (s.depth > 0 && s.x >= 0 && s.y >= 0 && s.x < pose.width && s.y < pose.height) out.push({ u, v, x: s.x, y: s.y, zone: 'wall' });
    }
    for (const dv of [1.2, 2.5]) {
      const s = wallPoint(frame, pose, wall, u, wall.heightM + dv);
      if (s.depth > 0 && s.x >= 0 && s.y >= 0 && s.x < pose.width && s.y < pose.height) out.push({ u, v: wall.heightM + dv, x: s.x, y: s.y, zone: 'above' });
    }
  }
  return out;
}

export type PickRead = { wall: { n: number; target: number; other: number; none: number; others: Record<string, number> }; above: { n: number; target: number }; drawnBy: string };

/** Who the game drew at the wall's samples: the pand itself, its cover model, another building, or nothing (sky/ground). */
export function readPicks(samples: PickSample[], hits: Hit[], pandId: string, coverKey: string | null): PickRead {
  const me = bare(pandId);
  const isTarget = (h: NonNullable<Hit>) => bare(h.id) === me || (!!coverKey && (h.id === coverKey || h.model === coverKey));
  const wall = { n: 0, target: 0, other: 0, none: 0, others: {} as Record<string, number> }, above = { n: 0, target: 0 };
  const by: Record<string, number> = {};
  samples.forEach((s, i) => {
    const h = hits[i] ?? null;
    if (s.zone === 'above') { above.n++; if (h && isTarget(h)) above.target++; return; }
    wall.n++;
    if (!h) { wall.none++; return; }
    if (isTarget(h)) { wall.target++; const k = h.model || (h.kind ? `${h.kind}` : 'generic'); by[k] = (by[k] ?? 0) + 1; return; }
    wall.other++; const k = h.model || bare(h.id) || h.kind || '?'; wall.others[k] = (wall.others[k] ?? 0) + 1;
  });
  const drawnBy = Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { wall, above, drawnBy };
}

// ---- facade measurement on both halves ----------------------------------------------------------------------------
export type HalfMeasure = { openings: number | null; wallHex: string | null; wallL: number | null; usable: number; columns: number | null };
const hexL = (hex: string) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; return (Math.max(r, g, b) + Math.min(r, g, b)) / 2; };

/** measureFacade (houseLine profile) on the wall rectified out of a half at 25 px/m; null fields when it cannot read. */
export function measureHalf(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad): HalfMeasure {
  try {
    const r = rectifyFromFrame(img, frame, pose, wall, 25, wall.heightM);
    const len = r.width / r.ppm, lines = storeyLines(Math.max(4, wall.heightM * 0.85));
    const m = measureFacade({ image: { width: r.width, height: r.height, rgb: blurRgb(r.rgb, r.width, r.height, 0.75), valid: r.valid, ppm: r.ppm, topM: r.topM }, box: { u0: 0, u1: len, v0: 0, v1: r.topM }, lines, openingSplit: MEASURE_PROFILES.houseLine });
    return { openings: m.openings?.count ?? null, wallHex: m.wall?.hex ?? null, wallL: m.wall?.hex ? +hexL(m.wall.hex).toFixed(3) : null, usable: +m.usableFraction.toFixed(2), columns: m.columns };
  } catch { return { openings: null, wallHex: null, wallL: null, usable: 0, columns: null }; }
}

// ---- flags -----------------------------------------------------------------------------------------------------------
export type Flags = { blankWall: boolean; missing: boolean; otherBuilding: string | null; roofOffset: string | null; wallColour: string | null };

/**
 * Advisory flags. blank wall: the game's wall reads no openings where the photo reads >= 2. missing: half or more of the
 * wall samples hit sky or ground in the game. otherBuilding: half or more hit another building or model (a cover that
 * does not draw this wall, a neighbour drawn over it). roof offset: the median game - photo skyline over the wall's
 * columns (`skyline`, on the wall plane) is more than ROOF_OFFSET_M off on >= 3 columns both read; or, failing a skyline,
 * a model's picked surface stands >= 1.2 m over the crown line on 2 of 7 columns (generic picks are prisms: no roofs).
 * wall colour: |dL| > 0.12 between the halves' measured wall colours (advisory until H2e and H9 round 3 land).
 */
export function flagsFor(picks: PickRead, game: HalfMeasure, photo: HalfMeasure, roof: { skyline: { medianM: number | null; n: number }; above: number }): Flags {
  const f: Flags = { blankWall: false, missing: false, otherBuilding: null, roofOffset: null, wallColour: null };
  if (picks.wall.n >= 6) {
    if (picks.wall.none / picks.wall.n >= 0.5) f.missing = true;
    if (picks.wall.other / picks.wall.n >= 0.5) f.otherBuilding = Object.entries(picks.wall.others).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?';
  }
  if (!f.missing && game.openings === 0 && (photo.openings ?? 0) >= 2) f.blankWall = true;
  if (roof.skyline.medianM != null && roof.skyline.n >= 3 && Math.abs(roof.skyline.medianM) > ROOF_OFFSET_M) f.roofOffset = `skyline ${roof.skyline.medianM > 0 ? '+' : ''}${roof.skyline.medianM} m vs photo (${roof.skyline.n} cols)`;
  else if (roof.above >= 2) f.roofOffset = `model drawn over the crown line on ${roof.above}/7 columns`;
  if (game.wallL != null && photo.wallL != null && Math.abs(game.wallL - photo.wallL) > 0.12) f.wallColour = `dL ${(game.wallL - photo.wallL).toFixed(2)}`;
  return f;
}
