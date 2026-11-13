/**
 * Describer D1 image inputs (lane D1, 2026-11-13): plain pinhole cuts from Amsterdam street panoramas for a vision
 * describer, with no browser. Three modes:
 *
 *   cut    --ids <file> --out <dir>                    one cut per pand: the front centred, ~30 % of the wall height above
 *                                                      the 3DBAG wall top (crowns, mansards, dormers), the street below,
 *                                                      one house either side, the BAG wall outlined in cyan; <dir>/cuts.json
 *   pano   --ids <file> --out <dir> [--cuts cuts.json] one image per chosen panorama (and street side): every BAG front
 *                                                      within +-25 deg of a square-on view centre, outlined and numbered
 *                                                      1..N left to right; <dir>/<panoId>.json maps number -> pandId
 *   window --ids <file> --answers <dir> --out <dir> [--cuts cuts.json]
 *                                                      one upper-storey window per pand (first storey above the ground,
 *                                                      middle axis, 25 % margin) from the FULL panorama, using the pose
 *                                                      and wall of a `cut` run and the describer answer's storeys/bays
 *                                                      (--ground-ratio: ground floor / upper storey height, default 1.25)
 *
 *   w1     --ids <file> --out <dir> [--cuts cuts.json] lane W1's wall sample on the game-lens photo of each cut's pinned
 *                                                      capture (cached panoramas), stored as `w1` in cuts.json; stage.ts
 *                                                      takes the wall colour from it (D1-fix 3)
 *
 * Shared flags: --max-new-gb <n> (default 2): the run estimates new panorama bytes first (captures not in the shared
 * cache x the mean cached size of that kind) and stops above it; --estimate-only prints the estimate and exits.
 *
 * The pick is house:frames' F4 rule (frames.ts pickPose: --season winter, --prefer-obliquity 30, --max-dist 60, the
 * glare/washed/foliage pre-pass). The camera here is NOT the game camera: it may look up (frames.ts frameFor clamps to
 * 5 deg down), so poses in cuts.json are re-framed with `cutFrame(pose)`, never frames.ts frameFor. The wall colour is
 * lane W1's analyse.ts wallLab (COLOUR_BAND_M on the wall plane, inner 80 %, 30-70 % lightness trim) on the cut itself.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference node --import tsx scripts/house-specs/describer-d1/describe-cut.ts cut --ids ids.txt --out out/
 */
import '../../house-frames/env.ts';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CACHE_DIR, findPands, http, lngLatToRd, loadRoads, neighbourhood, normId, pointInRing, type Footprint } from '../../pand-reference/core.ts';
import { exposedWalls } from '../../pand-reference/select.ts';
import { pickPose, rankCandidates, type Args, type Candidates, type Entry, type Skipped } from '../../house-frames/frames.ts';
import { aimPose, bearingTo, frameFor, gridConvergenceDeg, rdToLocal, PANO_EYE_HEIGHT_M, type FramePose, type Rd, type WallQuad } from '../../house-frames/pose.ts';
import { cutPerspective, loadEquirect, type Rgb8 } from '../../house-frames/photo.ts';
import { wallLab } from '../../house-frames/analyse.ts';
import type { CameraFrame } from '../../../src/canalRecall/ownMap/mapCamera.ts';
import { project } from '../../../src/canalRecall/ownMap/mapCamera.ts';
import crypto from 'node:crypto';

type V3 = [number, number, number];
const D = Math.PI / 180;

// ---- pure helpers (describe-cut.test.ts) ----------------------------------------------------------------------------

/** A pinhole frame at the camera (local metres, z up from its ground) with any pitch: `lookDownDeg` < 0 looks up. */
export function cutFrame(pose: Pick<FramePose, 'eyeHeightM' | 'headingDeg' | 'lookDownDeg' | 'vfovDeg' | 'width' | 'height'>): CameraFrame {
  const h = pose.headingDeg * D, p = -pose.lookDownDeg * D;
  const forward: V3 = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const right: V3 = [Math.cos(h), -Math.sin(h), 0];
  const up: V3 = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
  const eye: V3 = [0, 0, pose.eyeHeightM];
  const focal = (pose.height / 2) / Math.tan(pose.vfovDeg * D / 2);
  return { eye, target: [eye[0] + forward[0] * 10, eye[1] + forward[1] * 10, eye[2] + forward[2] * 10], forward, right, up, focal, distance: 10, mpp: 0, viewport: { width: pose.width, height: pose.height } };
}

/** Normalised image-plane coordinates of local points for a heading/pitch (points behind or > 80 deg off-axis dropped). */
function planeCoords(pts: V3[], eye: number, headingDeg: number, pitchDeg: number): Array<[number, number]> {
  const f = cutFrame({ eyeHeightM: eye, headingDeg, lookDownDeg: -pitchDeg, vfovDeg: 90, width: 2, height: 2 });
  const out: Array<[number, number]> = [];
  for (const q of pts) {
    const d: V3 = [q[0] - f.eye[0], q[1] - f.eye[1], q[2] - f.eye[2]];
    const z = d[0] * f.forward[0] + d[1] * f.forward[1] + d[2] * f.forward[2];
    if (z <= Math.cos(80 * D) * Math.hypot(...d)) continue;
    out.push([(d[0] * f.right[0] + d[1] * f.right[1] + d[2] * f.right[2]) / z, (d[0] * f.up[0] + d[1] * f.up[1] + d[2] * f.up[2]) / z]);
  }
  return out;
}

export type Fit = { lookDownDeg: number; halfX: number; halfY: number; clipped: string[] };
/**
 * Pitch and half-extents (tan of the half field of view) that hold every point, centred horizontally on `headingDeg`
 * (symmetric: the subject stays in the middle) and vertically on the points' span. `margin` is a share added on each axis;
 * the half-extents are capped at `maxHalfDeg` (listed in `clipped`: 'sides', or 'bottom' when a span too tall keeps its
 * top in frame and loses the street).
 */
export function fitView(pts: V3[], eye: number, headingDeg: number, margin = 0.04, maxHalfDeg = { x: 62, y: 58 }): Fit {
  const el = pts.map(q => Math.atan2(q[2] - eye, Math.hypot(q[0], q[1])) / D);
  let pitch = (Math.max(...el) + Math.min(...el)) / 2;
  for (let i = 0; i < 6; i++) {
    const c = planeCoords(pts, eye, headingDeg, pitch);
    if (!c.length) break;
    const y0 = Math.min(...c.map(v => v[1])), y1 = Math.max(...c.map(v => v[1]));
    pitch += (Math.atan(y0) + Math.atan(y1)) / 2 / D; // centre by angle: tangents overshoot near 60 deg
  }
  const c = planeCoords(pts, eye, headingDeg, pitch), dropped = pts.length - c.length;
  let halfX = Math.max(0.05, ...c.map(v => Math.abs(v[0]))) * (1 + margin);
  let halfY = Math.max(0.05, ...c.map(v => Math.abs(v[1]))) * (1 + margin);
  const clipped: string[] = [];
  if (halfX > Math.tan(maxHalfDeg.x * D) || dropped) { halfX = Math.tan(maxHalfDeg.x * D); clipped.push('sides'); }
  if (halfY > Math.tan(maxHalfDeg.y * D)) {
    // Too tall for the lens (a narrow street): keep the top (crown, dormers) and lose the street, not both halves.
    halfY = Math.tan(maxHalfDeg.y * D); clipped.push('bottom');
    const want = maxHalfDeg.y - Math.atan(margin) / D;
    for (let i = 0; i < 6; i++) {
      const cc = planeCoords(pts, eye, headingDeg, pitch);
      if (!cc.length) break;
      pitch += Math.atan(Math.max(...cc.map(v => v[1]))) / D - want;
    }
  }
  return { lookDownDeg: -pitch, halfX, halfY, clipped };
}

/** Pixel size for a fit: the long side `longSide`, the aspect clamped to [1/maxAspect, maxAspect] by widening the short axis. */
export function sizeFor(fit: Fit, longSide: number, maxAspect = 2): { width: number; height: number; vfovDeg: number; halfX: number; halfY: number } {
  let { halfX, halfY } = fit;
  if (halfX / halfY > maxAspect) halfY = halfX / maxAspect;
  if (halfY / halfX > maxAspect) halfX = halfY / maxAspect;
  const focal = longSide / 2 / Math.max(halfX, halfY);
  const width = Math.round(2 * halfX * focal), height = Math.round(2 * halfY * focal);
  return { width, height, vfovDeg: 2 * Math.atan(height / 2 / focal) / D, halfX, halfY };
}

/** A point `u` m along the wall from `a`, offset `out` m along its outward side (toward `towards`), RD. */
function along(w: WallQuad, u: number, out = 0, towards?: Rd): Rd {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1, tx = (w.b.x - w.a.x) / len, ty = (w.b.y - w.a.y) / len;
  let nx = ty, ny = -tx;
  if (towards) { const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2; if ((towards.x - mx) * nx + (towards.y - my) * ny < 0) { nx = -nx; ny = -ny; } }
  return { x: w.a.x + tx * u + nx * out, y: w.a.y + ty * u + ny * out };
}

/** Neighbour allowance either side of a front: one ordinary house (the front's own width, 5-9 m). */
export const neighbourWidthM = (lenM: number) => Math.max(5, Math.min(9, lenM));
/** Margin above the wall top for the describer cut (crowns, mansards, dormers): 30 % of the wall height, at least 3 m. */
export const crownMarginM = (heightM: number) => Math.max(3, 0.3 * heightM);

/** Local points the describer cut must hold: the wall extended one house either side, from the street to wall top + margin. */
export function cutPoints(w: WallQuad, camRd: Rd, toLocal: (p: Rd) => [number, number]): V3[] {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), ext = neighbourWidthM(len), top = w.heightM + crownMarginM(w.heightM);
  const standoff = Math.hypot((w.a.x + w.b.x) / 2 - camRd.x, (w.a.y + w.b.y) / 2 - camRd.y);
  const street = Math.min(4, 0.3 * standoff);
  const pts: V3[] = [];
  for (let k = 0; k <= 8; k++) {
    const u = -ext + (len + 2 * ext) * k / 8;
    const [x, y] = toLocal(along(w, u)), [gx, gy] = toLocal(along(w, Math.max(0, Math.min(len, u)), street, camRd));
    pts.push([x, y, 0], [x, y, top], [gx, gy, 0]);
  }
  return pts;
}

/**
 * The window region on the wall plane (u along from `a`, v up): the first storey above the ground, the middle axis (the
 * left of the two middle ones for an even count). Storey height = wall height / (storeys - 1 + groundRatio): the ground
 * floor is `groundRatio` times an upper storey (1.25 default: Amsterdam ground floors run tall; 1 is the plain
 * wall height / storeys). `margin` is a share of the storey cell added each side; the cell already holds the window with
 * its pier and spandrel, so a small margin (0.1) gives about 25 % around the window itself.
 */
export function windowRegion(lenM: number, heightM: number, storeys: number, bays: number, margin = 0.1, groundRatio = 1.25): { u0: number; u1: number; v0: number; v1: number } {
  const s = Math.max(1, Math.round(storeys)), b = Math.max(1, Math.round(bays)), bw = lenM / b;
  const sh = s >= 2 ? heightM / (s - 1 + groundRatio) : heightM;
  const bay = Math.floor((b - 1) / 2);
  const u0 = bay * bw, u1 = u0 + bw, v0 = s >= 2 ? groundRatio * sh : 0, v1 = v0 + sh;
  const mu = (u1 - u0) * margin, mv = (v1 - v0) * margin;
  return { u0: Math.max(0, u0 - mu), u1: Math.min(lenM, u1 + mu), v0: Math.max(0, v0 - mv), v1: Math.min(heightM + 1, v1 + mv) };
}

/** New download bytes: per kind, captures not cached x the mean cached size of that kind (else the default). */
export function estimateBytes(missing: Record<string, number>, sizes: Record<string, number[]>, defaults: Record<string, number>): { bytes: number; perKind: Record<string, { n: number; mean: number }> } {
  let bytes = 0; const perKind: Record<string, { n: number; mean: number }> = {};
  for (const [k, n] of Object.entries(missing)) {
    const s = sizes[k] ?? [], mean = s.length >= 3 ? s.reduce((a, b) => a + b, 0) / s.length : defaults[k] ?? 3e6;
    perKind[k] = { n, mean: Math.round(mean) }; bytes += n * mean;
  }
  return { bytes, perKind };
}

/** Front order and labels: left to right by the projected wall-mid x, numbered 1..N. */
export function numberFronts<T extends { x: number }>(fronts: T[]): Array<T & { n: number }> {
  return [...fronts].sort((a, b) => a.x - b.x).map((f, i) => ({ ...f, n: i + 1 }));
}

/** Clusters of directions (unit 2D normals) within `maxDeg` of the cluster's first member; indices per cluster. */
export function clusterNormals(ns: Array<{ nx: number; ny: number }>, maxDeg = 60): number[][] {
  const out: number[][] = [];
  ns.forEach((n, i) => {
    const c = out.find(g => ns[g[0]].nx * n.nx + ns[g[0]].ny * n.ny > Math.cos(maxDeg * D));
    if (c) c.push(i); else out.push([i]);
  });
  return out;
}

/** A capture good enough to describe a front from in the cover: squarish and not far (the F4 limits, tighter on distance). */
export const COVER_OK = { maxObliquityDeg: 30, maxDistM: 40 } as const;
export const coverOk = (c: { obliquityDeg: number; distM: number }) => c.obliquityDeg <= COVER_OK.maxObliquityDeg && c.distM <= COVER_OK.maxDistM;

/** Greedy set cover: target -> chosen option. Each round takes the option covering the most uncovered targets, `preferred` options first on ties. */
export function greedyCover(options: Map<string, string[]>, preferred: Set<string> = new Set()): Map<string, string> {
  const out = new Map<string, string>(), left = new Set(options.keys());
  while (left.size) {
    const count = new Map<string, number>();
    for (const t of left) for (const o of options.get(t) ?? []) count.set(o, (count.get(o) ?? 0) + 1);
    if (!count.size) break;
    const best = [...count].sort((a, b) => b[1] - a[1] || Number(preferred.has(b[0])) - Number(preferred.has(a[0])) || (a[0] < b[0] ? -1 : 1))[0][0];
    for (const t of [...left]) if ((options.get(t) ?? []).includes(best)) { out.set(t, best); left.delete(t); }
  }
  return out;
}

// ---- IO helpers ---------------------------------------------------------------------------------------------------

const F4_ARGS: Args = { pands: [], season: 'winter', preferObliquityDeg: 30, maxDistM: 60, query: '', label: 'run', out: '', panoSize: 'medium', max: Infinity, reopenEvery: 40, prepOnly: true, postOnly: false, reusePhotos: false, inputName: 'describer-d1' };
const WINTER = new Set([11, 12, 1, 2, 3]);
const cacheFile = (url: string) => path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.jpg');
const SIZE_DEFAULTS = { small: 0.7e6, medium: 2.6e6, full: 9e6 };
const KIND = { small: 'equirectangular_small', medium: 'equirectangular_medium', full: 'equirectangular_full' } as const;

function readIds(file: string): string[] {
  return [...new Set(fs.readFileSync(file, 'utf8').split(/\s+/).map(s => s.replace(/^NL\.IMBAG\.Pand\./, '').trim()).filter(s => /^\d{16}$/.test(s)))];
}
const argOf = (argv: string[], k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
function saveRgb(img: Rgb8, svg: string | null, file: string, quality = 88) {
  const s = sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } });
  return (svg ? s.composite([{ input: Buffer.from(svg) }]) : s).jpeg({ quality, mozjpeg: true }).toFile(file);
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A pose for the panorama at `ll` from a fit (FramePose shape; reframe it with cutFrame). */
function poseFrom(ll: [number, number], cameraNap: number | null, headingDeg: number, fit: Fit, longSide: number): FramePose {
  const sz = sizeFor(fit, longSide);
  return { rd: lngLatToRd(ll), lngLat: ll, eyeHeightM: PANO_EYE_HEIGHT_M, cameraNap, headingDeg: +headingDeg.toFixed(3), lookDownDeg: +fit.lookDownDeg.toFixed(3), vfovDeg: +sz.vfovDeg.toFixed(3), width: sz.width, height: sz.height, clipped: fit.clipped };
}
const recordLL = (rec: any): [number, number] => [rec.geometry.coordinates[0], rec.geometry.coordinates[1]];
const recordNap = (rec: any) => { const p = Number(rec.geometry.coordinates[2]); return p > 0 ? p - 43.5 : null; };

/** Estimate the new bytes of a pick run (the pre-pass reads up to 3 smalls, 8 at worst, then one `kind`); throws over budget. */
/** rankCandidates results kept from the estimate for the pick (the ranking at 60 m is the slow half of a pick). */
const ranks = new Map<string, Candidates | Skipped>();
async function budget(ids: string[], fps: Map<string, Footprint>, kind: 'medium' | 'full', maxGb: number, records?: Map<string, any>): Promise<void> {
  const missing: Record<string, number> = { small: 0, medium: 0, full: 0 }, worst = { small: 0 }, sizes: Record<string, number[]> = {};
  const seen = new Set<string>();
  const look = (rec: any, k: 'small' | 'medium' | 'full', count = true) => {
    const href = rec._links?.[KIND[k]]?.href; if (!href || seen.has(href)) return; seen.add(href);
    const f = cacheFile(href);
    if (fs.existsSync(f)) (sizes[k] ??= []).push(fs.statSync(f).size); else if (count) missing[k]++; else if (k === 'small') worst.small++;
  };
  for (const id of ids) {
    if (records?.has(id)) { look(records.get(id), kind); continue; }
    const c = await rankCandidates({ id }, fps.get(normId(id)), F4_ARGS);
    ranks.set(id, c);
    if ('skip' in c) continue;
    c.order.slice(0, 3).forEach(o => look(o.c.record, 'small'));
    c.order.slice(3, 8).forEach(o => look(o.c.record, 'small', false));
    if (c.order[0]) look(c.order[0].c.record, kind);
  }
  const est = estimateBytes(missing, sizes, SIZE_DEFAULTS), worstB = est.bytes + worst.small * (est.perKind.small?.mean ?? SIZE_DEFAULTS.small);
  console.log(`fetch estimate: ${(est.bytes / 1e9).toFixed(2)} GB new (worst case ${(worstB / 1e9).toFixed(2)} GB) ${JSON.stringify(est.perKind)}`);
  if (est.bytes > maxGb * 1e9) throw new Error(`STOP: estimated ${(est.bytes / 1e9).toFixed(2)} GB of new panoramas exceeds --max-new-gb ${maxGb}`);
}

// ---- mode 1: cut -----------------------------------------------------------------------------------------------------
export type CutRow = {
  pandId: string; panoId: string; captured: string; distM: number; obliquityDeg: number; pose: FramePose; wall: WallQuad; wallLenM: number;
  wallHex: string | null; wallLab: { L: number; C: number; h: number; n: number } | null; panoHref: string; fullHref: string | null;
  /** `w1` mode: lane W1's wall sample on the house:frames photo of the same pinned capture (game lens, aimPose/frameFor). */
  w1?: { hex: string; L: number; C: number; h: number; n: number } | null;
  fallback: { notWinter: boolean; oblique: boolean; clipped: string[]; gameLensClipped: string[] }; candidates: number; file: string;
};

async function modeCut(ids: string[], out: string, maxGb: number, estimateOnly: boolean) {
  fs.mkdirSync(out, { recursive: true });
  const manifestFile = path.join(out, 'cuts.json');
  const done: { rows: CutRow[]; skipped: Array<{ pandId: string; skip: string }> } = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { rows: [], skipped: [] };
  const have = new Set(done.rows.filter(r => fs.existsSync(path.join(out, r.file))).map(r => r.pandId));
  const todo = ids.filter(id => !have.has(id));
  await loadRoads();
  const fps = await findPands(todo);
  await budget(todo, fps, 'medium', maxGb);
  if (estimateOnly) return;
  const t0 = Date.now();
  let made = 0;
  for (const id of todo) {
    done.skipped = done.skipped.filter(s => s.pandId !== id);
    try {
      const p = await pickPose({ id } as Entry, fps.get(normId(id)), F4_ARGS, ranks.get(id));
      if ('skip' in p) { done.skipped.push({ pandId: id, skip: p.skip }); console.log(`${id}: skipped (${p.skip})`); continue; }
      const rec = p.pick.record, ll = recordLL(rec), camRd = lngLatToRd(ll);
      const toLocal = (q: Rd) => rdToLocal(q, ll);
      const mid = { x: (p.quad.a.x + p.quad.b.x) / 2, y: (p.quad.a.y + p.quad.b.y) / 2 };
      const heading = bearingTo(ll, mid);
      const fit = fitView(cutPoints(p.quad, camRd, toLocal), PANO_EYE_HEIGHT_M, heading);
      const pose = poseFrom(ll, recordNap(rec), heading, fit, 1400), frame = cutFrame(pose);
      const img = await loadEquirect(rec, 'medium');
      if (!img) { done.skipped.push({ pandId: id, skip: `panorama ${p.pick.panoId} did not load` }); continue; }
      const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
      const lab = wallLab(cut, frame, pose, p.quad);
      const file = `${id}.jpg`;
      await saveRgb(cut, outlineSvg(frame, pose, [p.quad]), path.join(out, file));
      const row: CutRow = {
        pandId: id, panoId: p.pick.panoId, captured: p.pick.timestamp, distM: +p.pick.distM.toFixed(2), obliquityDeg: +p.pick.obliquityDeg.toFixed(1), pose, wall: p.quad,
        wallLenM: +p.wall.len.toFixed(2), wallHex: lab?.hex ?? null, wallLab: lab ? { L: lab.L, C: lab.C, h: lab.h, n: lab.n } : null,
        panoHref: rec._links?.equirectangular_medium?.href ?? '', fullHref: rec._links?.equirectangular_full?.href ?? null,
        fallback: { notWinter: !WINTER.has(Number(String(p.pick.timestamp).slice(5, 7))), oblique: p.pick.obliquityDeg > 30, clipped: fit.clipped, gameLensClipped: p.pose.clipped }, candidates: p.candidates, file,
      };
      done.rows = done.rows.filter(r => r.pandId !== id).concat(row); made++;
      console.log(`${id}: pano ${p.pick.timestamp.slice(0, 10)} ${row.distM} m obl ${row.obliquityDeg} ${pose.width}x${pose.height} vfov ${pose.vfovDeg.toFixed(0)} wall ${row.wallHex}${fit.clipped.length ? ' clipped ' + fit.clipped.join('+') : ''}`);
      if (made % 10 === 0) fs.writeFileSync(manifestFile, JSON.stringify(done, null, 1));
    } catch (e) { done.skipped.push({ pandId: id, skip: `error: ${(e as Error).message}` }); console.log(`${id}: error ${(e as Error).message}`); }
  }
  fs.writeFileSync(manifestFile, JSON.stringify(done, null, 1));
  const secs = (Date.now() - t0) / 1000;
  console.log(`cut: ${made} made, ${have.size} already there, ${done.skipped.length} skipped; ${(http.bytes / 1e9).toFixed(3)} GB fetched in ${http.requests} requests; ${secs.toFixed(0)} s (${(secs / Math.max(1, made)).toFixed(1)} s/pand)`);
}

function outlineSvg(frame: CameraFrame, pose: FramePose, walls: WallQuad[], labels: Array<{ n: number; x: number; y: number; target: boolean }> = []): string {
  const polys = walls.map(w => {
    const pts = ([[w.a, 0], [w.b, 0], [w.b, w.heightM], [w.a, w.heightM]] as Array<[Rd, number]>).map(([q, z]) => { const [x, y] = rdToLocal(q, pose.lngLat); return project(frame, [x, y, z]); });
    if (pts.some(s => s.depth <= 0)) return '';
    return `<polygon points="${pts.map(s => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#00e5ff" stroke-width="2" stroke-opacity="0.9"/>`;
  }).join('');
  const fs_ = Math.round(Math.max(40, Math.min(pose.width, pose.height) / 14));
  const texts = labels.map(l => `<text x="${l.x.toFixed(0)}" y="${l.y.toFixed(0)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${fs_}" fill="#ffe600" stroke="#000" stroke-width="${(fs_ / 12).toFixed(1)}" paint-order="stroke">${esc(String(l.n))}</text>`).join('');
  return `<svg width="${pose.width}" height="${pose.height}" xmlns="http://www.w3.org/2000/svg">${polys}${texts}</svg>`;
}

// ---- mode 1b: w1 -----------------------------------------------------------------------------------------------------
/**
 * The wall colour source for staging (D1-fix 3, item B): lane W1's wall sample on the house:frames photo of the pinned
 * capture, i.e. the game lens (aimPose + frameFor on the cut's capture and wall), not the describer cut, whose wider
 * looking-up frame puts the band on different pixels. Reads the cached medium panorama; writes `w1` into cuts.json.
 */
async function modeW1(ids: string[], cutsFile: string) {
  const done = JSON.parse(fs.readFileSync(cutsFile, 'utf8')) as { rows: CutRow[] };
  const want = new Set(ids.map(normId));
  let n = 0, miss = 0;
  for (const r of done.rows) {
    if (!want.has(normId(r.pandId))) continue;
    const ll = r.pose.lngLat as [number, number];
    const record = { pano_id: r.panoId, timestamp: r.captured, geometry: { coordinates: [ll[0], ll[1], r.pose.cameraNap == null ? 0 : r.pose.cameraNap + 43.5] }, _links: { equirectangular_medium: { href: r.panoHref } } };
    const pose = aimPose({ lngLat: ll, cameraNap: r.pose.cameraNap ?? null }, r.wall), frame = frameFor(pose);
    const img = await loadEquirect(record, 'medium');
    if (!img) { r.w1 = null; miss++; continue; }
    const lab = wallLab(cutPerspective(img, frame, gridConvergenceDeg(ll)), frame, pose, r.wall);
    r.w1 = lab ? { hex: lab.hex, L: lab.L, C: lab.C, h: lab.h, n: lab.n } : null;
    if (!lab) miss++;
    n++;
  }
  fs.writeFileSync(cutsFile, JSON.stringify(done, null, 1));
  console.log(`w1: ${n} sampled, ${miss} without a wall sample; ${(http.bytes / 1e9).toFixed(3)} GB fetched in ${http.requests} requests`);
}

// ---- mode 2: pano ----------------------------------------------------------------------------------------------------
type Target = { pandId: string; record: any; wall: WallQuad; panoId: string };

async function picksFor(ids: string[], cutsFile: string | undefined, maxGb: number): Promise<{ targets: Target[]; skipped: Array<{ pandId: string; skip: string }> }> {
  const targets: Target[] = [], skipped: Array<{ pandId: string; skip: string }> = [];
  const rows = new Map<string, CutRow>();
  if (cutsFile && fs.existsSync(cutsFile)) for (const r of JSON.parse(fs.readFileSync(cutsFile, 'utf8')).rows as CutRow[]) rows.set(r.pandId, r);
  const rest = ids.filter(id => !rows.has(id));
  await loadRoads();
  const fps = rest.length ? await findPands(rest) : new Map<string, Footprint>();
  if (rest.length) await budget(rest, fps, 'medium', maxGb);
  for (const id of ids) {
    const r = rows.get(id);
    if (r) { targets.push({ pandId: id, panoId: r.panoId, wall: r.wall, record: { pano_id: r.panoId, timestamp: r.captured, geometry: { coordinates: [r.pose.lngLat[0], r.pose.lngLat[1], r.pose.cameraNap == null ? 0 : r.pose.cameraNap + 43.5] }, _links: { equirectangular_medium: { href: r.panoHref }, ...(r.fullHref ? { equirectangular_full: { href: r.fullHref } } : {}) } } }); continue; }
    const p = await pickPose({ id } as Entry, fps.get(normId(id)), F4_ARGS, ranks.get(id));
    if ('skip' in p) { skipped.push({ pandId: id, skip: p.skip }); continue; }
    targets.push({ pandId: id, panoId: p.pick.panoId, wall: p.quad, record: p.pick.record });
  }
  return { targets, skipped };
}

const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

async function modePano(ids: string[], out: string, cutsFile: string | undefined, maxGb: number, estimateOnly: boolean) {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now(), fetched0 = http.bytes;
  const { targets, skipped } = await picksFor(ids, cutsFile, maxGb);
  if (estimateOnly) return;
  // Fewer panoramas: a greedy set cover over each target's acceptable captures (its own F4 pick, or a ranked capture
  // within COVER_OK that fits the whole wall), a capture that is some target's F4 pick (it passed the glare/foliage
  // pre-pass) winning ties.
  const fpsAll = await findPands(targets.map(t => t.pandId));
  const options = new Map<string, Set<string>>(), recs = new Map<string, any>(), f4 = new Set(targets.map(t => t.panoId));
  for (const t of targets) {
    recs.set(t.panoId, t.record);
    const set = new Set([t.panoId]);
    const c = await rankCandidates({ id: t.pandId }, fpsAll.get(normId(t.pandId)), F4_ARGS);
    if (!('skip' in c)) for (const o of c.ranked) if (coverOk(o) && c.clipKey(o) === 0) { set.add(o.panoId); if (!recs.has(o.panoId)) recs.set(o.panoId, o.record); }
    options.set(t.pandId, set);
  }
  const chosen = greedyCover(new Map([...options].map(([k, v]) => [k, [...v]])), f4);
  const extra = [...new Set(chosen.values())].filter(p => !f4.has(p)).map(p => recs.get(p)?._links?.equirectangular_medium?.href).filter((h): h is string => !!h && !fs.existsSync(cacheFile(h)));
  const est = estimateBytes({ medium: extra.length }, {}, SIZE_DEFAULTS);
  console.log(`cover: ${new Set(chosen.values()).size} panoramas for ${targets.length} targets (${f4.size} F4 picks); ${extra.length} new medium(s), ~${(est.bytes / 1e9).toFixed(2)} GB`);
  if (est.bytes > maxGb * 1e9) throw new Error(`STOP: the cover needs ~${(est.bytes / 1e9).toFixed(2)} GB new`);
  const byPano = new Map<string, Target[]>();
  for (const t0 of targets) { const pid = chosen.get(t0.pandId) ?? t0.panoId, t = { ...t0, panoId: pid, record: recs.get(pid) ?? t0.record }; byPano.set(pid, [...(byPano.get(pid) ?? []), t]); }
  const index: any[] = [];
  for (const [panoId, group] of byPano) {
    const rec = group[0].record, ll = recordLL(rec), camRd = lngLatToRd(ll);
    // Outward normals of the target walls (pointing at the camera), clustered by street side.
    const normals = group.map(t => { const dx = t.wall.b.x - t.wall.a.x, dy = t.wall.b.y - t.wall.a.y, l = Math.hypot(dx, dy) || 1; let nx = dy / l, ny = -dx / l; const mx = (t.wall.a.x + t.wall.b.x) / 2, my = (t.wall.a.y + t.wall.b.y) / 2; if ((camRd.x - mx) * nx + (camRd.y - my) * ny < 0) { nx = -nx; ny = -ny; } return { nx, ny }; });
    const near = (await neighbourhood(camRd)).filter(f => f.ring.length && f.ring.some(q => Math.hypot(q.x - camRd.x, q.y - camRd.y) < 110));
    const boxes = near.map(o => ({ o, x0: Math.min(...o.ring.map(q => q.x)), x1: Math.max(...o.ring.map(q => q.x)), y0: Math.min(...o.ring.map(q => q.y)), y1: Math.max(...o.ring.map(q => q.y)) }));
    const sees = (w: { a: Rd; b: Rd }, selfId: string) => {
      let ok = 0;
      for (const t of [0.25, 0.5, 0.75]) {
        const tx = w.a.x + (w.b.x - w.a.x) * t, ty = w.a.y + (w.b.y - w.a.y) * t, dx = camRd.x - tx, dy = camRd.y - ty, L = Math.hypot(dx, dy) || 1;
        const wp = { x: tx + dx / L * 0.6, y: ty + dy / L * 0.6 }, n = Math.ceil(Math.hypot(wp.x - camRd.x, wp.y - camRd.y) / 0.75);
        let hit = false;
        for (let i = 1; i < n && !hit; i++) { const q = { x: camRd.x + (wp.x - camRd.x) * i / n, y: camRd.y + (wp.y - camRd.y) * i / n }; hit = boxes.some(b => b.o.id !== selfId && q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1 && pointInRing(q, b.o.ring)); }
        if (!hit) ok++;
      }
      return ok >= 2;
    };
    const clusters = clusterNormals(normals);
    for (let ci = 0; ci < clusters.length; ci++) {
      const tg = clusters[ci].map(i => group[i]);
      const nm = clusters[ci].reduce((s, i) => ({ nx: s.nx + normals[i].nx, ny: s.ny + normals[i].ny }), { nx: 0, ny: 0 });
      // Square-on: look against the fronts' outward normal; shift toward the targets when one falls outside +-25 deg.
      let heading = bearingTo(ll, { x: camRd.x - nm.nx * 10, y: camRd.y - nm.ny * 10 });
      const tb = tg.flatMap(t => [t.wall.a, t.wall.b].map(q => angDiff(bearingTo(ll, q), heading)));
      if (Math.min(...tb) < -25 || Math.max(...tb) > 25) heading = (heading + (Math.min(...tb) + Math.max(...tb)) / 2 + 360) % 360;
      // Every BAG front within +-25 deg facing the camera, one per pand (the squarest), plus the targets' own walls.
      const fronts = new Map<string, { pandId: string; wall: WallQuad; off: number; target: boolean }>();
      for (const t of tg) fronts.set(t.pandId, { pandId: t.pandId, wall: t.wall, off: angDiff(bearingTo(ll, { x: (t.wall.a.x + t.wall.b.x) / 2, y: (t.wall.a.y + t.wall.b.y) / 2 }), heading), target: true });
      const cands: Array<{ pandId: string; wall: WallQuad; off: number; target: boolean; obl: number }> = [];
      for (const fp of near) {
        if (!fp.id.startsWith('NL.IMBAG.Pand.')) continue;
        const pid = fp.id.replace('NL.IMBAG.Pand.', '');
        if (fronts.has(pid)) continue;
        const local = boxes.filter(b => b.x1 > Math.min(...fp.ring.map(q => q.x)) - 5 && b.x0 < Math.max(...fp.ring.map(q => q.x)) + 5 && b.y1 > Math.min(...fp.ring.map(q => q.y)) - 5 && b.y0 < Math.max(...fp.ring.map(q => q.y)) + 5).map(b => b.o);
        for (const w of exposedWalls(fp, local)) {
          const vx = camRd.x - w.mid.x, vy = camRd.y - w.mid.y, d = Math.hypot(vx, vy), standoff = vx * w.nx + vy * w.ny;
          if (standoff <= 2 || d > 70 || w.len < 3) continue;
          const obl = Math.acos(Math.min(1, standoff / d)) / D, off = angDiff(bearingTo(ll, w.mid), heading);
          if (obl > 60 || Math.abs(off) > 25 || !sees(w, fp.id)) continue;
          cands.push({ pandId: pid, wall: { a: w.a, b: w.b, heightM: fp.height || 10 }, off, target: false, obl });
        }
      }
      cands.sort((a, b) => a.obl - b.obl);
      for (const c of cands) if (!fronts.has(c.pandId)) fronts.set(c.pandId, c);
      // Keep the targets and the fronts nearest the view centre, at most max(5, targets).
      const cap = Math.max(5, tg.length);
      const kept = [...fronts.values()].sort((a, b) => Number(b.target) - Number(a.target) || Math.abs(a.off) - Math.abs(b.off)).slice(0, cap);
      const pts: V3[] = [];
      for (const f of kept) for (const q of [f.wall.a, f.wall.b]) { const [x, y] = rdToLocal(q, ll); pts.push([x, y, 0], [x, y, f.wall.heightM + crownMarginM(f.wall.heightM) * 0.8]); }
      const fit = fitView(pts, PANO_EYE_HEIGHT_M, heading, 0.08);
      const pose = poseFrom(ll, recordNap(rec), heading, fit, 1600), frame = cutFrame(pose);
      const labelled = numberFronts(kept.map(f => {
        const m = { x: (f.wall.a.x + f.wall.b.x) / 2, y: (f.wall.a.y + f.wall.b.y) / 2 }, [x, y] = rdToLocal(m, ll), s = project(frame, [x, y, 0]), top = project(frame, [x, y, f.wall.heightM]);
        return { ...f, x: s.x, y: top.y };
      }));
      const img = await loadEquirect(rec, 'medium');
      if (!img) { skipped.push(...tg.map(t => ({ pandId: t.pandId, skip: `panorama ${panoId} did not load` }))); continue; }
      const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
      const fsz = Math.max(40, Math.min(pose.width, pose.height) / 14);
      const labels = labelled.map(l => ({ n: l.n, x: Math.max(fsz, Math.min(pose.width - fsz, l.x)), y: Math.max(fsz * 1.05, Math.min(pose.height - 8, l.y - fsz * 0.35)), target: l.target }));
      const name = clusters.length > 1 && ci > 0 ? `${panoId}_${ci + 1}` : panoId;
      await saveRgb(cut, outlineSvg(frame, pose, labelled.map(l => l.wall), labels), path.join(out, `${name}.jpg`));
      const map = Object.fromEntries(labelled.map(l => [String(l.n), l.pandId]));
      fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ panoId, image: `${name}.jpg`, captured: rec.timestamp, fronts: map, targets: tg.map(t => t.pandId), pose }, null, 1));
      index.push({ image: `${name}.jpg`, panoId, fronts: labelled.length, targets: tg.map(t => t.pandId) });
      console.log(`${name}: ${labelled.length} fronts (${tg.length} targets) ${pose.width}x${pose.height}`);
    }
  }
  const covered = new Set(index.flatMap(i => i.targets));
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ targets: ids.length, covered: covered.size, panoramas: byPano.size, images: index.length, skipped, index }, null, 1));
  const secs = (Date.now() - t0) / 1000;
  console.log(`pano: ${covered.size} of ${ids.length} targets on ${index.length} images from ${byPano.size} panoramas; ${((http.bytes - fetched0) / 1e9).toFixed(3)} GB fetched; ${secs.toFixed(0)} s`);
}

// ---- mode 3: window --------------------------------------------------------------------------------------------------
async function modeWindow(ids: string[], answers: string, out: string, cutsFile: string, maxGb: number, estimateOnly: boolean, groundRatio = 1.25) {
  fs.mkdirSync(out, { recursive: true });
  const rows = new Map<string, CutRow>((JSON.parse(fs.readFileSync(cutsFile, 'utf8')).rows as CutRow[]).map(r => [r.pandId, r]));
  const missing = { full: 0 }, sizes: Record<string, number[]> = {};
  for (const id of ids) { const r = rows.get(id); if (r?.fullHref) { const f = cacheFile(r.fullHref); if (fs.existsSync(f)) (sizes.full ??= []).push(fs.statSync(f).size); else missing.full++; } }
  const est = estimateBytes(missing, sizes, SIZE_DEFAULTS);
  console.log(`fetch estimate: ${(est.bytes / 1e9).toFixed(2)} GB new ${JSON.stringify(est.perKind)}`);
  if (est.bytes > maxGb * 1e9) throw new Error(`STOP: estimated ${(est.bytes / 1e9).toFixed(2)} GB exceeds --max-new-gb ${maxGb}`);
  if (estimateOnly) return;
  const t0 = Date.now(), skipped: Array<{ pandId: string; skip: string }> = [], made: any[] = [];
  for (const id of ids) {
    const r = rows.get(id), aFile = path.join(answers, `${id}.json`);
    if (!r) { skipped.push({ pandId: id, skip: 'no cut row (run `cut` first)' }); continue; }
    if (!fs.existsSync(aFile)) { skipped.push({ pandId: id, skip: 'no describer answer' }); continue; }
    const a = JSON.parse(fs.readFileSync(aFile, 'utf8'));
    if (!(a.storeys > 0) || !(a.bays > 0)) { skipped.push({ pandId: id, skip: `answer has no storeys/bays (${a.storeys}/${a.bays})` }); continue; }
    const w = r.wall, len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), reg = windowRegion(len, w.heightM, a.storeys, a.bays, 0.1, groundRatio);
    const ll = r.pose.lngLat, uMid = (reg.u0 + reg.u1) / 2;
    const [cx, cy] = rdToLocal(along(w, uMid), ll);
    const heading = Math.atan2(cx, cy) / D;
    const pts: V3[] = [];
    for (const u of [reg.u0, reg.u1]) for (const v of [reg.v0, reg.v1]) { const [x, y] = rdToLocal(along(w, u), ll); pts.push([x, y, v]); }
    const rec = { _links: { equirectangular_full: r.fullHref ? { href: r.fullHref } : undefined, equirectangular_medium: { href: r.panoHref } } };
    const img = await loadEquirect(rec, 'full');
    if (!img) { skipped.push({ pandId: id, skip: 'panorama did not load' }); continue; }
    const fit = fitView(pts, PANO_EYE_HEIGHT_M, (heading + 360) % 360, 0, { x: 60, y: 60 });
    // Native resolution: the equirect's px per radian, long side 320-1200.
    const native = (img.width / (2 * Math.PI)) * 2 * Math.max(fit.halfX, fit.halfY);
    const pose = poseFrom(ll, r.pose.cameraNap, (heading + 360) % 360, fit, Math.round(Math.max(320, Math.min(1200, native))));
    const cut = cutPerspective(img, cutFrame(pose), gridConvergenceDeg(ll));
    await saveRgb(cut, null, path.join(out, `${id}.jpg`), 90);
    made.push({ pandId: id, storeys: a.storeys, bays: a.bays, region: reg, size: [pose.width, pose.height], nativeLongSide: Math.round(native), source: img.width >= 6000 ? 'full' : 'medium' });
  }
  fs.writeFileSync(path.join(out, 'windows.json'), JSON.stringify({ made, skipped }, null, 1));
  const secs = (Date.now() - t0) / 1000;
  console.log(`window: ${made.length} made, ${skipped.length} skipped ${JSON.stringify(skipped)}; ${(http.bytes / 1e9).toFixed(3)} GB fetched; ${secs.toFixed(0)} s (${(secs / Math.max(1, made.length)).toFixed(1)} s/pand)`);
}

// ---- CLI -------------------------------------------------------------------------------------------------------------
export async function main(argv = process.argv.slice(2)) {
  const mode = argv[0], idsFile = argOf(argv, 'ids'), out = argOf(argv, 'out');
  const maxGb = Number(argOf(argv, 'max-new-gb') ?? 2), estimateOnly = argv.includes('--estimate-only');
  if (!mode || !idsFile || !out || !['cut', 'pano', 'window', 'w1'].includes(mode)) { console.log('describe-cut.ts cut|pano|window|w1 --ids <file> --out <dir> [--answers <dir>] [--cuts <cuts.json>] [--ground-ratio 1.25] [--max-new-gb 2] [--estimate-only] [--max n]'); process.exit(2); }
  const ids = readIds(idsFile).slice(0, Number(argOf(argv, 'max') ?? Infinity));
  console.log(`${mode}: ${ids.length} pands; panorama cache ${CACHE_DIR}`);
  try {
    if (mode === 'cut') await modeCut(ids, path.resolve(out), maxGb, estimateOnly);
    else if (mode === 'w1') await modeW1(ids, argOf(argv, 'cuts') ?? path.join(path.resolve(out), 'cuts.json'));
    else if (mode === 'pano') await modePano(ids, path.resolve(out), argOf(argv, 'cuts'), maxGb, estimateOnly);
    else {
      const answers = argOf(argv, 'answers');
      if (!answers) { console.error('window needs --answers <dir>'); process.exit(2); }
      await modeWindow(ids, answers, path.resolve(out), argOf(argv, 'cuts') ?? path.join(path.dirname(path.resolve(out)), 'cuts', 'cuts.json'), maxGb, estimateOnly, Number(argOf(argv, 'ground-ratio') ?? 1.25));
    }
  } catch (e) { console.error((e as Error).message); process.exit(3); }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('describer-d1', 'describe-cut.ts'))) main();
