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
import { isLeaf } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { blurRgb, storeyLines } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { wallPoint, type FramePose, type WallQuad } from './pose.ts';
import { rectifyFromFrame, type Rgb8 } from './photo.ts';

/** Search half-width around a projected edge, % of the image width; edges further off than this are not found. */
export const EDGE_SEARCH_PCT = 6;
/** An edge reads as found when its consistent gradient is this many times the search window's median. */
export const EDGE_MIN_CONTRAST = 1.8;
/** Roof offset: the game's skyline over the wall sits this far (m, on the wall plane) from the crown line the photo confirms. */
export const ROOF_OFFSET_M = 1;
/** Blank wall: the game's wall reads at most this many openings (a slab's edge strip reads as one) where the photo reads at least BLANK_PHOTO_MIN. */
export const BLANK_MAX_OPENINGS = 1;
export const BLANK_PHOTO_MIN = 3;

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

/** Sky-like at the top of a column: bright and not warm (brick and roof tiles are red-dominant; sky is blue or grey). */
const skyLike = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b > 120 && b >= r - 6;

/**
 * Per column over the wall (7 columns, 10-90 %): the height on the wall plane (m) where the sky ends, scanning down from
 * the top of the frame with a running sky colour (the gradient of a sky drifts); null where the column does not start in
 * sky. Read on the wall plane, so a ridge set back from the front reads lower than its true height, alike in both halves.
 */
export function skyline(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad): SkyCol[] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), out: SkyCol[] = [];
  for (let i = 0; i < 7; i++) {
    const u = len * (0.1 + 0.8 * i / 6);
    const base = wallPoint(frame, pose, wall, u, 0), hi = wallPoint(frame, pose, wall, u, wall.heightM * 3);
    const x = Math.round(base.x);
    if (base.depth <= 0 || x < 0 || x >= img.width) { out.push({ u, topM: null }); continue; }
    const px = (y: number) => { const o = (y * img.width + x) * 3; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
    const p0 = px(0);
    if (!skyLike(p0[0], p0[1], p0[2])) { out.push({ u, topM: null }); continue; }
    const ref = [...p0];
    let y = 1, run = 0;
    for (; y < Math.min(img.height, base.y); y++) {
      const p = px(y), d = Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]);
      if (d < 40) { run = 0; for (let c = 0; c < 3; c++) ref[c] = ref[c] * 0.9 + p[c] * 0.1; } else if (++run >= 4) break;
    }
    y -= run - 1;
    if (y >= base.y) { out.push({ u, topM: 0 }); continue; }
    if (hi.depth > 0 && hi.y > y) { out.push({ u, topM: null }); continue; }
    // Height on the wall plane at that row: bisect v (the projection is monotonic in v along a vertical wall line).
    let lo = 0, top = wall.heightM * 3;
    for (let k = 0; k < 30; k++) { const v = (lo + top) / 2, s = wallPoint(frame, pose, wall, u, v); if (s.y > y) lo = v; else top = v; }
    out.push({ u, topM: +((lo + top) / 2).toFixed(2) });
  }
  return out;
}

/** Median skyline height (m on the wall plane) over the columns a half reads; null under 3 columns. */
export function skylineMedian(cols: SkyCol[]): { medianM: number | null; n: number } {
  const d = cols.map(c => c.topM).filter((v): v is number => v != null).sort((a, b) => a - b);
  return { medianM: d.length >= 3 ? +d[d.length >> 1].toFixed(2) : null, n: d.length };
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

// ---- relative wall colour (the H9 rule: "darker or lighter than its neighbours", which cancels exposure) ---------------
/** Wall colour flag: |ln(rel game / rel photo)| over this, rel = the pand's wall L / the mean of its neighbours' wall L in the same half. */
export const COLOUR_REL_MAX = 0.35;
/** The band a wall's L is read from: clear of the ground storey (shopfronts, cars) and of a shorter neighbour's sky. */
export const COLOUR_BAND_M = [3, 12] as const;

export type BandL = { L: number; n: number; sky: number };
/**
 * A wall's lightness in one half: HSL L of the pixels on the wall plane inside COLOUR_BAND_M (inner 80 % of the length),
 * leaves dropped (and, for a neighbour strip, sky-like pixels: `sky` is their share), trimmed to the 30-70 % quantiles
 * (windows and shadow below, white frames and glints above).
 */
export function wallBandL(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad, topM = wall.heightM, dropSky = false): BandL | null {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), v0 = Math.min(COLOUR_BAND_M[0], topM * 0.3), v1 = Math.min(COLOUR_BAND_M[1], topM * 0.85);
  if (v1 <= v0 || len < 1) return null;
  const ls: number[] = [];
  let sky = 0, seen = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 16; j++) {
    const s = wallPoint(frame, pose, wall, len * (0.1 + 0.8 * (i + 0.5) / 24), v0 + (v1 - v0) * (j + 0.5) / 16);
    if (s.depth <= 0 || s.x < 0 || s.y < 0 || s.x >= img.width || s.y >= img.height) continue;
    const o = (Math.floor(s.y) * img.width + Math.floor(s.x)) * 3, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    seen++;
    if (isLeaf(r, g, b)) continue;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (y > 120 && (b > r + 8 || y > 205)) { sky++; if (dropSky) continue; }
    ls.push((Math.max(r, g, b) + Math.min(r, g, b)) / 510);
  }
  if (ls.length < 40) return null;
  ls.sort((a, b) => a - b);
  const part = ls.slice(Math.floor(ls.length * 0.3), Math.ceil(ls.length * 0.7));
  return { L: +(part.reduce((s, x) => s + x, 0) / part.length).toFixed(3), n: ls.length, sky: +(sky / Math.max(1, seen)).toFixed(2) };
}

/** The two neighbour strips: the wall's line carried 3-5 m past each end, at the pand's height. */
export function neighbourWalls(wall: WallQuad): WallQuad[] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), dx = (wall.b.x - wall.a.x) / len, dy = (wall.b.y - wall.a.y) / len, w = Math.min(5, Math.max(3, len * 0.5));
  return [{ a: { x: wall.a.x - dx * w, y: wall.a.y - dy * w }, b: wall.a, heightM: wall.heightM }, { a: wall.b, b: { x: wall.b.x + dx * w, y: wall.b.y + dy * w }, heightM: wall.heightM }];
}

export type RelHalf = { pand: number | null; neighbours: (number | null)[]; rel: number | null };
export type RelColour = { photo: RelHalf; game: RelHalf; used: number; score: number | null };
/** A neighbour strip counts when it reads in both halves with under this share of sky (a gap, a corner, a lower neighbour). */
export const NEIGHBOUR_MAX_SKY = 0.25;
/**
 * The pand's wall against its neighbours, photo vs game; rel = pand L / mean neighbour L over the strips that read in
 * both halves (the same strips on both sides), score = ln(rel game / rel photo), null when no strip reads.
 */
export function relativeColour(photo: Rgb8, game: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad): RelColour {
  const read = (img: Rgb8) => ({ pand: wallBandL(img, frame, pose, wall), nb: neighbourWalls(wall).map(q => wallBandL(img, frame, pose, q, wall.heightM, true)) });
  const p = read(photo), g = read(game);
  const ok = (b: BandL | null): b is BandL => b != null && b.sky < NEIGHBOUR_MAX_SKY && b.L > 0.02;
  const use = p.nb.map((b, i) => ok(b) && ok(g.nb[i]));
  const half = (h: typeof p): RelHalf => {
    const nb = h.nb.filter((_, i) => use[i]).map(b => b!.L);
    return { pand: h.pand?.L ?? null, neighbours: h.nb.map(b => b?.L ?? null), rel: h.pand && nb.length ? +(h.pand.L / (nb.reduce((s, x) => s + x, 0) / nb.length)).toFixed(3) : null };
  };
  const ph = half(p), gh = half(g);
  return { photo: ph, game: gh, used: use.filter(Boolean).length, score: ph.rel != null && gh.rel != null ? +Math.log(gh.rel / ph.rel).toFixed(3) : null };
}

/** Opening counts, advisory only: a note (never a flag) where the game's wall reads <= 1 opening and the photo's >= 3. */
export function openingsNote(game: HalfMeasure, photo: HalfMeasure, missing: boolean): string | null {
  return !missing && game.openings != null && game.openings <= BLANK_MAX_OPENINGS && (photo.openings ?? 0) >= BLANK_PHOTO_MIN ? `possible blank wall (game ${game.openings}, photo ${photo.openings} openings)` : null;
}

// ---- flags -----------------------------------------------------------------------------------------------------------
export type Flags = { missing: boolean; otherBuilding: string | null; roofOffset: string | null; wallColour: string | null };

/**
 * Advisory flags. Opening counts fire no flag (`openingsNote`) until they are checked against hand counts. missing: half or more of the
 * wall samples hit sky or ground in the game. otherBuilding: half or more hit another building or model (a cover that
 * does not draw this wall, a neighbour drawn over it). roof offset: the game's median skyline over the wall (`skyline`,
 * on the wall plane, >= 3 columns) sits more than ROOF_OFFSET_M from the projected crown line (tile height) while the
 * photo's sits within it (the photo confirms the crown); or a model's picked surface stands >= 1.2 m over the crown line
 * on 2 of 7 columns (generic picks are prisms: no roofs).
 * wall colour: the pand's wall L over its neighbours' (`relativeColour`), photo vs game, |ln ratio| > COLOUR_REL_MAX, read
 * only with both neighbour strips (one strip measures the neighbour as much as the pand: 116526 on H7's set) and only when
 * the picks say the wall is this pand's.
 */
export function flagsFor(picks: PickRead, game: HalfMeasure, photo: HalfMeasure, roof: { crownM: number; game: number | null; photo: number | null; above: number }, colour?: RelColour): Flags {
  const f: Flags = { missing: false, otherBuilding: null, roofOffset: null, wallColour: null };
  if (picks.wall.n >= 6) {
    if (picks.wall.none / picks.wall.n >= 0.5) f.missing = true;
    if (picks.wall.other / picks.wall.n >= 0.5) f.otherBuilding = Object.entries(picks.wall.others).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?';
  }
  if (roof.game != null && roof.photo != null && Math.abs(roof.game - roof.crownM) > ROOF_OFFSET_M && Math.abs(roof.photo - roof.crownM) <= ROOF_OFFSET_M)
    f.roofOffset = `game skyline ${roof.game} m vs crown ${roof.crownM} m (photo ${roof.photo} m)`;
  else if (roof.above >= 2) f.roofOffset = `model drawn over the crown line on ${roof.above}/7 columns`;
  if (colour?.score != null && colour.used === 2 && !f.missing && !f.otherBuilding && Math.abs(colour.score) > COLOUR_REL_MAX)
    f.wallColour = `${colour.score < 0 ? 'darker' : 'lighter'} than its neighbours in the game: rel game ${colour.game.rel} vs photo ${colour.photo.rel}`;
  return f;
}
