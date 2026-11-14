/**
 * Lane d1-wall-colour (2026-11-14): the same front in several captures, with the references `houseSpec/wallSample.ts`
 * needs. Like wall-exposure/captures.ts (lane WC), but it may fetch medium panoramas (bounded by --max-new-gb), keeps up
 * to --max-per captures on distinct days (the pinned one first), and records per capture:
 *   w1     W1's wall sample (analyse.ts wallLab on the game-lens cut: OKLab of the 30-70 % lightness pixels, 3-12 m band);
 *   ref    WC's exposure references (white / p80 / scene linear Y);
 *   refs   wallSample.ts SampleRefs: linear RGB of the wall's bright parts (the 90-97 % Y band of the wall grid: white
 *          frames, sills, stone dressings) and of the scene median (sky-like pixels left out).
 *
 *   node --import tsx scripts/house-specs/wall-sample/captures.ts --cuts <cuts.json> --out <file> [--ids <file>]
 *        [--max-per 4] [--max-dist 40] [--max-new-gb 1.5]
 */
import fs from 'node:fs';
import { findPands, http, normId } from '../../pand-reference/core.ts';
import { rankCandidates, type Args } from '../../house-frames/frames.ts';
import { aimPose, frameFor, gridConvergenceDeg, wallPoint, type FramePose, type WallQuad } from '../../house-frames/pose.ts';
import { cutPerspective, loadEquirect } from '../../house-frames/photo.ts';
import { wallExposureRef, wallLab } from '../../house-frames/analyse.ts';
import type { Rgb8 } from '../../house-frames/photo.ts';
import { isLeaf } from '../../../src/canalRecall/buildingRecipe/measureFacade.ts';
import type { SampleRefs } from '../../../src/canalRecall/houseSpec/wallSample.ts';

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lumY = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** wallSample.ts references on one cut (see the header). Null with fewer than 40 wall points in frame. */
export function sampleRefs(img: Rgb8, frame: ReturnType<typeof frameFor>, pose: FramePose, wall: WallQuad): SampleRefs | null {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), pts: Array<[number, number, number, number]> = [];
  if (len < 1) return null;
  for (let i = 0; i < 32; i++) for (let j = 0; j < 24; j++) {
    const s = wallPoint(frame, pose, wall, len * (0.05 + 0.9 * (i + 0.5) / 32), 0.3 + (wall.heightM * 0.95 - 0.3) * (j + 0.5) / 24);
    if (s.depth <= 0 || s.x < 0 || s.y < 0 || s.x >= img.width || s.y >= img.height) continue;
    const o = (Math.floor(s.y) * img.width + Math.floor(s.x)) * 3, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    if (isLeaf(r, g, b)) continue;
    const R = lin(r), G = lin(g), B = lin(b);
    pts.push([R, G, B, lumY(R, G, B)]);
  }
  if (pts.length < 40) return null;
  pts.sort((x, y) => x[3] - y[3]);
  const band = pts.slice(Math.floor(pts.length * 0.9), Math.ceil(pts.length * 0.97));
  const avg = (xs: Array<[number, number, number, number]>) => [0, 1, 2].map(k => +(xs.reduce((s, p) => s + p[k], 0) / xs.length).toFixed(4)) as [number, number, number];
  return { white: avg(band), scene: sceneRef(img), n: pts.length };
}
/** The scene reference of a frame: mean linear RGB of the 40-60 % luminance band of every 4th pixel, sky-like pixels
 *  (bright and bluish, or near white, as wallLab drops them) left out. */
export function sceneRef(img: Rgb8): [number, number, number] {
  const sc: Array<[number, number, number, number]> = [];
  for (let y = 0; y < img.height; y += 4) for (let x = 0; x < img.width; x += 4) {
    const o = (y * img.width + x) * 3, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2], y8 = 0.299 * r + 0.587 * g + 0.114 * b;
    if (y8 > 120 && (b > r + 8 || y8 > 235)) continue;
    const R = lin(r), G = lin(g), B = lin(b);
    sc.push([R, G, B, lumY(R, G, B)]);
  }
  sc.sort((x, y) => x[3] - y[3]);
  const mid = sc.slice(Math.floor(sc.length * 0.4), Math.ceil(sc.length * 0.6));
  return mid.length ? [0, 1, 2].map(k => +(mid.reduce((s, p) => s + p[k], 0) / mid.length).toFixed(4)) as [number, number, number] : [0, 0, 0];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const cutsFile = opt('cuts'), out = opt('out'), maxPer = Number(opt('max-per') ?? 4), maxDist = Number(opt('max-dist') ?? 40), maxGb = Number(opt('max-new-gb') ?? 1.5);
  if (!cutsFile || !out) { console.error('captures.ts --cuts <cuts.json> --out <file> [--ids <file>] [--max-per 4] [--max-dist 40] [--max-new-gb 1.5]'); process.exit(2); }
  const want = opt('ids') ? new Set(fs.readFileSync(opt('ids')!, 'utf8').split(/\s+/).filter(Boolean).map(normId)) : null;
  const ARGS: Args = { pands: [], season: 'any', preferObliquityDeg: 30, maxDistM: maxDist, query: '', label: 'run', out: '', panoSize: 'medium', max: Infinity, reopenEvery: 40, prepOnly: true, postOnly: false, reusePhotos: false, inputName: 'wall-sample' };
  const rows = ((JSON.parse(fs.readFileSync(cutsFile, 'utf8')).rows ?? []) as any[]).filter(r => r.wall && (!want || want.has(normId(r.pandId))));
  const prev = fs.existsSync(out) ? new Map<string, any>((JSON.parse(fs.readFileSync(out, 'utf8')).rows as any[]).map(r => [r.pandId, r])) : new Map();
  const fps = await findPands(rows.map(r => r.pandId));
  const result: any[] = [];
  let extra = 0;
  const sampleAt = async (record: any, wall: WallQuad) => {
    const ll: [number, number] = [record.geometry.coordinates[0], record.geometry.coordinates[1]];
    const z = Number(record.geometry.coordinates[2]), cameraNap = z > 0 ? z - 43.5 : null;
    const pose = aimPose({ lngLat: ll, cameraNap }, wall), frame = frameFor(pose);
    const img = await loadEquirect(record, 'medium');
    if (!img) return null;
    const cut = cutPerspective(img, frame, gridConvergenceDeg(ll)), lab = wallLab(cut, frame, pose, wall);
    if (!lab) return null;
    return { w1: { hex: lab.hex, L: lab.L, C: lab.C, h: lab.h }, ref: wallExposureRef(cut, frame, pose, wall), refs: sampleRefs(cut, frame, pose, wall) };
  };
  for (const r of rows) {
    if (prev.has(r.pandId)) { result.push(prev.get(r.pandId)); continue; }
    if (http.bytes / 1e9 > maxGb) { console.log(`stopping: ${maxGb} GB fetched`); break; }
    const caps: any[] = [];
    const ll = r.pose.lngLat as [number, number];
    const pinnedRec = { pano_id: r.panoId, timestamp: r.captured, geometry: { coordinates: [ll[0], ll[1], r.pose.cameraNap == null ? 0 : r.pose.cameraNap + 43.5] }, _links: { equirectangular_medium: { href: r.panoHref } } };
    const s0 = await sampleAt(pinnedRec, r.wall);
    if (s0) caps.push({ panoId: r.panoId, captured: r.captured, distM: r.distM, obliquityDeg: r.obliquityDeg, pinned: true, ...s0 });
    const c = await rankCandidates({ id: normId(r.pandId) }, fps.get(normId(r.pandId)), ARGS);
    if (!('skip' in c)) {
      const day = (t: string) => String(t).slice(0, 10), seen = new Set([day(r.captured)]);
      for (const p of c.ranked) {
        if (caps.length >= maxPer) break;
        if (p.obliquityDeg > 35 || p.distM > maxDist || seen.has(day(p.timestamp))) continue;
        const s = await sampleAt(p.record, r.wall);
        if (!s) continue;
        seen.add(day(p.timestamp));
        caps.push({ panoId: p.panoId, captured: p.timestamp, distM: +p.distM.toFixed(1), obliquityDeg: +p.obliquityDeg.toFixed(1), ...s });
      }
    }
    extra += Math.max(0, caps.length - 1);
    result.push({ pandId: r.pandId, captures: caps });
    if (result.length % 20 === 0) { fs.writeFileSync(out, JSON.stringify({ rows: result })); console.log(`${result.length}/${rows.length} pands, ${(http.bytes / 1e9).toFixed(2)} GB fetched`); }
  }
  fs.writeFileSync(out, JSON.stringify({ rows: result }));
  console.log(`captures: ${result.length} pands, ${result.filter(x => x.captures.length > 1).length} with a second capture, ${extra} extra captures; ${(http.bytes / 1e9).toFixed(3)} GB fetched -> ${out}`);
}
