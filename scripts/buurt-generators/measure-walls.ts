/**
 * Buurt generator round 9: every drawn row's brick from the open Amsterdam street panoramas (data.amsterdam.nl,
 * CC BY 4.0), the retail lane's measure-pui approach (scripts/retail-ground/measure-pui.ts) on the row's whole
 * ground-to-eaves band:
 *   1. the row's front line (first member's left corner to the last member's right, the staged buurtKit lines) and its
 *      series line;
 *   2. the panoramas 5-30 m off the front with their foot on the row, one per capture date (newest first), then more of
 *      one date 15 m apart, at most 4; medium equirects only;
 *   3. each rectified onto the line (pand-reference/rectify.ts) at 20 px/m, and read over 0.4 m to 0.3 m under the
 *      series line, within 12 m either side of the camera's foot and the row's inner 84 %;
 *   4. gates: the band at least 85 % in the cut; foliage (measure.ts isFoliage) dropped and at most WALL_LEAF of it;
 *      the 0.4-2.4 m strip dropped when retailPuiPaint's vehicle gate calls it a van, a tram or parked cars;
 *   5. white-balanced on the band's own white trim (measure.ts wallBrickOf: cast removed, lightness over the white's),
 *      its brick the median of its warm pixels, else the largest OKLab cluster that is not glass, trim or sky;
 *   6. the reads voted (measure.ts voteWall): two or more distinct panoramas within 0.06 OKLab of one another, else the
 *      district pool stands.
 * Writes the `walls` and `wallSkipped` keys of src/canalRecall/buurtGenerator/districts/measured/<district>.json.
 * Downloads: the repo User-Agent, 500 ms apart, a byte cap (--max-mb, default 1500) and a 15 GB disk floor; the
 * panoramas this run downloaded are purged every 20 rows and at the end (the ones the shared cache held stay).
 *
 *   node --import tsx scripts/buurt-generators/measure-walls.ts --district=apollo-stadion [--only=<row prefix>,...] [--max-mb=1500] [--debug=<dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jpeg from 'jpeg-js';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { CACHE_DIR, http, panoTracker, purgeFiles } from '../pand-reference/core.ts';
import { listPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';
import { vehicleBand } from '../../src/canalRecall/retailPuiPaint.ts';
import { WALL_BAND, WALL_GATE, isFoliage, labOf, voteWall, wallBrickOf, type WallRead } from '../../src/canalRecall/buurtGenerator/measure.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'rivierenbuurt', stage = `artifacts/buurt-generators/${district}`;
const only = (arg('only') ?? '').split(',').filter(Boolean);
const MAX_MB = Number(arg('max-mb') ?? 1500), DEBUG = arg('debug');
/** A wall band is 20-30 m of street front: a street tree in it is the rule, so its foliage is dropped and the read stands
 *  while at most this share of the band is leaves (measure-pui's 8 % is for a 2 m shop band). */
const WALL_LEAF = 0.3;
const OUT = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`;
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const genRowOf = (recordId: string) => recordId.replace(/-\d{6}$/, '');
const records = (JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]);
const kit = new Map((JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).filter(r => r.buurtKit?.frontLine).map(r => [r.pandId, r.buurtKit.frontLine as [[number, number], [number, number]]]));
const rows = new Map<string, { members: string[]; lineM: number }>();
for (const r of records) {
  const id = genRowOf(r.id); if (only.length && !only.some(o => id.startsWith(o))) continue;
  const g = rows.get(id) ?? { members: [], lineM: 0 };
  g.members.push(...r.members.map((m: any) => m.pandId));
  g.lineM = Math.max(g.lineM, ...r.series.map((s: any) => s.design.corniceTopM.value ?? 0));
  rows.set(id, g);
}
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
/** Merge-on-write: measure-roofs.ts writes the same file's other keys. */
const save = (extra: Record<string, unknown> = {}) => { const now = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}; fs.writeFileSync(OUT, JSON.stringify({ ...now, version: 1, district, ...extra, walls, wallSkipped: skipped }, null, 2) + '\n'); };
const walls: Record<string, unknown> = { ...(prior.walls ?? {}) }, skipped: Record<string, string> = { ...(prior.wallSkipped ?? {}) };
const cachedBefore = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const mine = new Set<string>();
let purgedFiles = 0, purgedBytes = 0;
const track = () => { for (const f of panoTracker.touched!) if (!cachedBefore.has(path.basename(f))) mine.add(f); panoTracker.touched!.clear(); };

async function readOne(p: any, wall: Wall, lineM: number): Promise<WallRead> {
  const date = String(p.timestamp).slice(0, 10), base = { pano: p.pano_id as string, date };
  const record = { ...p, _links: { ...p._links } }; delete record._links.equirectangular_full;
  const pick: PanoPick = { panoId: p.pano_id, timestamp: p.timestamp, missionYear: Number(p.mission_year), missionType: p.mission_type ?? '', surface: p.surface_type ?? '', distM: 0, obliquityDeg: 0, relaxed: false, record };
  const pano = await loadPano(pick); track();
  if (!pano) return { ...base, verdict: null, why: 'did not load' };
  const crop = rectifyWall(pano.img, pick, wall, lineM, WALL_BAND.ppm);
  if (!crop) return { ...base, verdict: null, why: 'no camera pose' };
  const img = jpeg.decode(crop.jpeg, { useTArray: true });
  const W = crop.width, ppm = crop.ppm, topZ = crop.wallHeightM;
  const cam = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
  const tc = (cam.x - wall.a.x) * (wall.b.x - wall.a.x) / wall.len + (cam.y - wall.a.y) * (wall.b.y - wall.a.y) / wall.len;
  const t0 = Math.max(wall.len * WALL_BAND.inset, tc - WALL_BAND.halfWindowM), t1 = Math.min(wall.len * (1 - WALL_BAND.inset), tc + WALL_BAND.halfWindowM);
  if (t1 - t0 < 4) return { ...base, verdict: null, why: `window ${(t1 - t0).toFixed(1)} m` };
  const i0 = Math.floor(t0 * ppm), i1 = Math.min(W, Math.ceil(t1 * ppm)), z1 = lineM - WALL_BAND.eavesGapM;
  const upper: [number, number, number][] = [], lower: [number, number, number][] = [], luma: number[] = [];
  let n = 0, valid = 0, leaf = 0, lowRows = 0;
  for (let j = 0; j < crop.height; j++) {
    const z = topZ - (j + 0.5) / ppm; if (z < WALL_BAND.z0 || z > z1) continue;
    const low = z < WALL_BAND.vehicleTopM; if (low) lowRows++;
    for (let i = i0; i < i1; i++) {
      const k = j * W + i, q = k * 4, r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (low) luma.push(0.299 * r + 0.587 * g + 0.114 * b);
      n++; if (!crop.alpha[k]) continue; valid++;
      if (isFoliage(r, g, b)) { leaf++; continue; }
      (low ? lower : upper).push([r, g, b]);
    }
  }
  if (DEBUG) fs.writeFileSync(`${DEBUG}/${p.pano_id}-${Math.round(wall.mid.x)}.jpg`, crop.jpeg);
  if (!n || valid / n < WALL_GATE.valid) return { ...base, verdict: null, why: `band ${(100 * valid / Math.max(1, n)).toFixed(0)} % in the cut` };
  if (leaf / valid > WALL_LEAF) return { ...base, verdict: null, why: `foliage ${(100 * leaf / valid).toFixed(0)} %` };
  const v = lowRows ? vehicleBand(luma, i1 - i0, lowRows) : { vehicle: null };
  const px = (v.vehicle ? upper : [...upper, ...lower]).map(([r, g, b]) => labOf(r, g, b));
  const verdict = wallBrickOf(px);
  return { ...base, verdict, why: verdict ? (v.vehicle ? `vehicle (${v.vehicle}) under 2.4 m dropped` : undefined) : 'no brick cluster' };
}

let done = 0;
const t0 = Date.now();
for (const [id, row] of rows) {
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1048576) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  if (++done % 20 === 0) { track(); const pg = await purgeFiles(mine); purgedFiles += pg.files; purgedBytes += pg.bytes; mine.clear(); save(); console.log(`${done}/${rows.size} rows, ${Object.keys(walls).length} measured, ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${freeGb().toFixed(1)} GB free`); }
  if (walls[id] || skipped[id]) continue;
  const l0 = kit.get(row.members[0]), l1 = kit.get(row.members[row.members.length - 1]);
  if (!l0 || !l1 || !row.lineM) { skipped[id] = 'no front line'; continue; }
  const A = lngLatToRd(l0[0]), B = lngLatToRd(l1[1]), len = Math.hypot(B.x - A.x, B.y - A.y);
  if (len < 6) { skipped[id] = `front ${len.toFixed(1)} m`; continue; }
  const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len, nx = uy, ny = -ux;
  const wall: Wall = { a: A, b: B, len, nx, ny, mid: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, roadDistM: 0, facing: 0 };
  let list: any[];
  try { list = await listPanos({ x: wall.mid.x + nx * 12, y: wall.mid.y + ny * 12 }, Math.max(25, len / 2 + 10)); } catch (e) { skipped[id] = `pano list: ${(e as Error).message}`; continue; }
  const cands = list.flatMap(p => {
    if (!p._links?.equirectangular_medium?.href) return [];
    const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]), t = (q.x - A.x) * ux + (q.y - A.y) * uy, d = (q.x - A.x) * nx + (q.y - A.y) * ny;
    return t > len * 0.05 && t < len * 0.95 && d >= 5 && d <= 30 ? [{ p, t, date: String(p.timestamp).slice(0, 10) }] : [];
  });
  // One per capture date (nearest the middle), newest first; then more of a date, 15 m along from the ones taken.
  const byDate = new Map<string, typeof cands>();
  for (const c of cands) { const l = byDate.get(c.date) ?? []; l.push(c); byDate.set(c.date, l); }
  for (const l of byDate.values()) l.sort((a, b) => Math.abs(a.t - len / 2) - Math.abs(b.t - len / 2));
  const dates = [...byDate.keys()].sort().reverse(), picks: typeof cands = [];
  for (const d of dates) if (picks.length < 4) picks.push(byDate.get(d)![0]);
  for (const d of dates) for (const c of byDate.get(d)!) if (picks.length < 4 && picks.every(x => x.p.pano_id !== c.p.pano_id && (x.date !== c.date || Math.abs(x.t - c.t) >= 15))) picks.push(c);
  if (!picks.length) { skipped[id] = 'no panorama faces the row'; continue; }
  const reads: WallRead[] = [];
  for (const c of picks) {
    if (reads.filter(r => r.verdict).length >= 3) break;
    try { reads.push(await readOne(c.p, wall, row.lineM)); } catch (e) { reads.push({ pano: c.p.pano_id, date: c.date, verdict: null, why: (e as Error).message }); }
  }
  const vote = voteWall(reads);
  if ('skip' in vote) skipped[id] = `${vote.skip}; ${reads.map(r => `${r.pano} ${r.date}: ${r.verdict?.hex ?? r.why}`).join('; ')}`;
  else walls[id] = vote;
}
track();
const last = await purgeFiles(mine), purged = { files: purgedFiles + last.files, bytes: purgedBytes + last.bytes };
save({ wallSource: 'Amsterdam panoramas (data.amsterdam.nl, CC BY 4.0) via scripts/buurt-generators/measure-walls.ts' });
const mem = (ids: string[]) => ids.reduce((s, id) => s + (rows.get(id)?.members.length ?? 0), 0);
const got = [...rows.keys()].filter(id => walls[id]), pool = [...rows.keys()].filter(id => !walls[id]);
console.log(`${district}: ${got.length} of ${rows.size} rows measured (${mem(got)} pands), ${pool.length} on the district pool (${mem(pool)} pands); ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB, purged ${purged.files} files ${(purged.bytes / 1048576).toFixed(0)} MB -> ${OUT}`);
