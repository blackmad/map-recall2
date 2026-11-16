/**
 * Buurt generator round 18 (lane R): every drawn member's window axes counted on the open Amsterdam street panoramas
 * (data.amsterdam.nl, CC BY 4.0), so a series draws the bays its fronts show (baysRead.ts) instead of one per axis of
 * width. Panorama choice as measure-walls.ts (round 10: each camera reads the straight run of members nearest it, 5-30 m
 * off, one per capture date, newest first), at most `--per-row` captures a row (default 2):
 *   1. the local front rectified (pand-reference/rectify.ts) at 40 px/m from the pavement to the series line;
 *   2. each member on it the camera sees whole (measure.ts visibleAlong, VIEW_GATE) and whose span is at least 85 % in
 *      the cut, cut out at its own span less 0.1 m a side;
 *   3. measured as the pixel writer measures a crop (houseSpec/writers/pixel.ts measureCrop: measureFacade with the
 *      houseLine profile under the series line), its count taken only when the writer's bays gate passes (baysRead.ts
 *      baysOfMeasure).
 * Writes the `bays` key of src/canalRecall/buurtGenerator/districts/measured/<district>.json (merge-on-write), per pand
 * `{ bays, reads }`: `bays` the one count its captures state, null when none passes or they differ.
 * Downloads: the repo User-Agent, 500 ms apart, a byte cap (--max-mb, default 1500) and a 15 GB disk floor; the
 * panoramas this run downloaded are purged every 20 rows and at the end (the ones the shared cache held stay).
 *
 *   node --import tsx scripts/buurt-generators/measure-bays.ts --district=rivierenbuurt [--only=<row prefix>,...] [--per-row=2] [--max-mb=1500] [--debug=<dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jpeg from 'jpeg-js';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { CACHE_DIR, http, neighbourhood, normId, panoTracker, purgeFiles } from '../pand-reference/core.ts';
import { listPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';
import { VIEW_GATE, localFront, visibleAlong } from '../../src/canalRecall/buurtGenerator/measure.ts';
import { measureCrop } from '../../src/canalRecall/houseSpec/writers/pixel.ts';
import { baysOfMeasure, memberBaysOf, type BaysCapture, type MemberBays } from '../../src/canalRecall/buurtGenerator/baysRead.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'rivierenbuurt', stage = `artifacts/buurt-generators/${district}`;
const only = (arg('only') ?? '').split(',').filter(Boolean);
const MAX_MB = Number(arg('max-mb') ?? 1500), PER_ROW = Number(arg('per-row') ?? 2), DEBUG = arg('debug');
const PPM = 40, SPAN_IN = 0.85, SIDE_M = 0.1;
const OUT = arg('out') ?? `src/canalRecall/buurtGenerator/districts/measured/${district}.json`;
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const genRowOf = (recordId: string) => recordId.replace(/-\d{6}$/, '');
const records = (JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]);
const frontRecs = (JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).filter(r => r.buurtKit?.frontLine);
const kit = new Map(frontRecs.map(r => [r.pandId as string, r.buurtKit.frontLine as [[number, number], [number, number]]]));
const rows = new Map<string, { members: string[]; lineM: number }>();
for (const r of records) {
  const id = genRowOf(r.id); if (only.length && !only.some(o => id.startsWith(o))) continue;
  const g = rows.get(id) ?? { members: [], lineM: 0 };
  g.members.push(...r.members.map((m: any) => m.pandId));
  g.lineM = Math.max(g.lineM, ...r.series.map((s: any) => s.design.corniceTopM.value ?? 0));
  rows.set(id, g);
}
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const bays: Record<string, MemberBays> = { ...(prior.bays ?? {}) };
const done = new Set<string>(prior.baysRows ?? []);
const save = () => { const now = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}; fs.writeFileSync(OUT, JSON.stringify({ ...now, version: 1, district, baysSource: 'Amsterdam panoramas (data.amsterdam.nl, CC BY 4.0) via scripts/buurt-generators/measure-bays.ts', bays, baysRows: [...done].sort() }, null, 2) + '\n'); };
const cachedBefore = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const mine = new Set<string>();
const track = () => { for (const f of panoTracker.touched!) if (!cachedBefore.has(path.basename(f))) mine.add(f); panoTracker.touched!.clear(); };

type Seg = readonly [{ x: number; y: number }, { x: number; y: number }];
/** One capture: each whole-seen member of the local front, its count (or why not). */
async function readOne(p: any, local: Wall, lineM: number, members: Array<{ id: string; seg: Seg }>, occluders: { x: number; y: number }[][]): Promise<Map<string, BaysCapture>> {
  const out = new Map<string, BaysCapture>(), date = String(p.timestamp).slice(0, 10), pano = p.pano_id as string;
  const record = { ...p, _links: { ...p._links } }; delete record._links.equirectangular_full;
  const pick: PanoPick = { panoId: p.pano_id, timestamp: p.timestamp, missionYear: Number(p.mission_year), missionType: p.mission_type ?? '', surface: p.surface_type ?? '', distM: 0, obliquityDeg: 0, relaxed: false, record };
  const loaded = await loadPano(pick); track();
  if (!loaded) return out;
  const crop = rectifyWall(loaded.img, pick, local, lineM, PPM);
  if (!crop) return out;
  const img = jpeg.decode(crop.jpeg, { useTArray: true }), W = crop.width, H = crop.height, ppm = crop.ppm;
  const cam = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
  const bx0 = Math.min(cam.x, local.a.x, local.b.x), bx1 = Math.max(cam.x, local.a.x, local.b.x), by0 = Math.min(cam.y, local.a.y, local.b.y), by1 = Math.max(cam.y, local.a.y, local.b.y);
  const near = occluders.filter(r => Math.min(...r.map(q => q.x)) <= bx1 && Math.max(...r.map(q => q.x)) >= bx0 && Math.min(...r.map(q => q.y)) <= by1 && Math.max(...r.map(q => q.y)) >= by0);
  const seen = visibleAlong(cam, local.a, local.b, near), seenAt = (t: number) => seen[Math.max(0, Math.min(seen.length - 1, Math.round(t / VIEW_GATE.stepM)))];
  const lx = local.b.x - local.a.x, ly = local.b.y - local.a.y, ll = Math.hypot(lx, ly);
  const along = (q: { x: number; y: number }) => ((q.x - local.a.x) * lx + (q.y - local.a.y) * ly) / ll;
  if (DEBUG) fs.writeFileSync(`${DEBUG}/${pano}-${Math.round(local.mid.x)}.jpg`, crop.jpeg);
  for (const m of members) {
    const u0 = Math.min(along(m.seg[0]), along(m.seg[1])) + SIDE_M, u1 = Math.max(along(m.seg[0]), along(m.seg[1])) - SIDE_M;
    if (u1 - u0 < 2.4) { out.set(m.id, { pano, date, cols: null, why: `span ${(u1 - u0).toFixed(1)} m` }); continue; }
    let all = true; for (let t = u0; t <= u1; t += VIEW_GATE.stepM) if (!seenAt(t)) { all = false; break; }
    if (!all) { out.set(m.id, { pano, date, cols: null, why: 'not seen whole' }); continue; }
    const i0 = Math.max(0, Math.floor(u0 * ppm)), i1 = Math.min(W, Math.ceil(u1 * ppm)), w = i1 - i0;
    if (w < 2.4 * ppm) { out.set(m.id, { pano, date, cols: null, why: 'outside the cut' }); continue; }
    const rgb = new Uint8Array(w * H * 3); let valid = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) {
      const k = j * W + i0 + i, q = k * 4, o = (j * w + i) * 3;
      rgb[o] = img.data[q]; rgb[o + 1] = img.data[q + 1]; rgb[o + 2] = img.data[q + 2]; if (crop.alpha[k]) valid++;
    }
    if (valid / (w * H) < SPAN_IN) { out.set(m.id, { pano, date, cols: null, why: `${(100 * valid / (w * H)).toFixed(0)} % in the cut` }); continue; }
    const measured = measureCrop({ pandId: m.id, image: { rgb, width: w, height: H, ppm }, tier: 'good', wallTopM: lineM, ref: pano, at: date });
    const cols = measured ? baysOfMeasure(measured.m) : null;
    out.set(m.id, { pano, date, cols, ...(cols === null ? { why: measured ? `gate: ${measured.m.frontClass}, columns ${measured.m.columns}/${measured.m.windowColumns ?? '-'}, pitch ${measured.m.pitchScore.toFixed(2)}` : 'unmeasurable' } : {}) });
  }
  return out;
}

let n = 0;
const t0 = Date.now();
for (const [id, row] of rows) {
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1048576) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  if (++n % 20 === 0) { track(); await purgeFiles(mine); mine.clear(); save(); console.log(`${n}/${rows.size} rows, ${Object.values(bays).filter(b => b.bays !== null).length} members counted, ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  if (done.has(id)) continue;
  const segMembers = row.members.filter(m => kit.has(m));
  if (!segMembers.length || !row.lineM) { done.add(id); continue; }
  const segs = segMembers.map(m => kit.get(m)!).map(l => [lngLatToRd(l[0]), lngLatToRd(l[1])] as const);
  const A = segs[0][0], B = segs[segs.length - 1][1], len = Math.hypot(B.x - A.x, B.y - A.y);
  const ux = (B.x - A.x) / (len || 1), uy = (B.y - A.y) / (len || 1), nx = uy, ny = -ux, mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const own = new Set(row.members.map(normId));
  let occluders: { x: number; y: number }[][], list: any[];
  try {
    occluders = (await neighbourhood(mid)).filter(f => !own.has(normId(f.id)) && f.ring.some(q => Math.hypot(q.x - mid.x, q.y - mid.y) < len / 2 + 60)).map(f => f.ring);
    list = await listPanos({ x: mid.x + nx * 12, y: mid.y + ny * 12 }, Math.max(25, len / 2 + 10));
  } catch (e) { console.log(`${id}: ${(e as Error).message}`); continue; }
  const cands = list.flatMap(p => {
    if (!p._links?.equirectangular_medium?.href) return [];
    const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
    const lf = localFront(segs, q);
    if (!lf) return [];
    const lx = lf.b.x - lf.a.x, ly = lf.b.y - lf.a.y, ll = Math.hypot(lx, ly), lt = ((q.x - lf.a.x) * lx + (q.y - lf.a.y) * ly) / ll;
    if (ll < 4 || lt < 0 || lt > ll || lf.offM < 5 || lf.offM > 30) return [];
    const local: Wall = { a: lf.a, b: lf.b, len: ll, nx: ly / ll, ny: -lx / ll, mid: { x: (lf.a.x + lf.b.x) / 2, y: (lf.a.y + lf.b.y) / 2 }, roadDistM: 0, facing: 0 };
    const members = segMembers.slice(lf.lo, lf.hi + 1).map((m, k) => ({ id: m, seg: segs[lf.lo + k] as Seg }));
    return [{ p, date: String(p.timestamp).slice(0, 10), local, members, offM: lf.offM }];
  });
  // Newest capture date first, one per date (the nearest a frontal 10-20 m stand-off), at most PER_ROW.
  const byDate = new Map<string, typeof cands>();
  for (const c of cands) { const l = byDate.get(c.date) ?? []; l.push(c); byDate.set(c.date, l); }
  for (const l of byDate.values()) l.sort((a, b) => Math.abs(a.offM - 14) - Math.abs(b.offM - 14));
  const picks = [...byDate.keys()].sort().reverse().slice(0, PER_ROW).map(d => byDate.get(d)![0]);
  const reads = new Map<string, BaysCapture[]>();
  for (const c of picks) {
    try { for (const [m, r] of await readOne(c.p, c.local, row.lineM, c.members, occluders)) { const l = reads.get(m) ?? []; l.push(r); reads.set(m, l); } }
    catch (e) { console.log(`${id} ${c.p.pano_id}: ${(e as Error).message}`); }
  }
  for (const [m, l] of reads) bays[m] = { bays: memberBaysOf(l), reads: l };
  done.add(id);
}
track();
await purgeFiles(mine);
save();
const counted = Object.values(bays).filter(b => b.bays !== null).length;
console.log(`${district}: ${done.size} of ${rows.size} rows read, ${counted} of ${Object.keys(bays).length} members counted; ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB -> ${OUT}`);
