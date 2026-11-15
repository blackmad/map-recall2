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
 *   4. gates: only the columns the camera sees (measure.ts visibleAlong: no other footprint on the view ray, within
 *      55 deg of square on), at least 4 m of them; the band at least 85 % in the cut; foliage (measure.ts isFoliage) dropped and at most WALL_LEAF of it;
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
import { CACHE_DIR, http, neighbourhood, normId, panoTracker, purgeFiles } from '../pand-reference/core.ts';
import { listPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';
import { vehicleBand } from '../../src/canalRecall/retailPuiPaint.ts';
import { ERKER_WHITE, VIEW_GATE, WALL_BAND, WALL_GATE, erkerFinishOf, isFoliage, labOf, localFront, rowErkerFinish, visibleAlong, voteWall, wallBrickOf, whiteRefOf, whiteShareOf, brickShareOf, type ErkerRead, type WallRead } from '../../src/canalRecall/buurtGenerator/measure.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'rivierenbuurt', stage = `artifacts/buurt-generators/${district}`;
const only = (arg('only') ?? '').split(',').filter(Boolean);
const MAX_MB = Number(arg('max-mb') ?? 1500), DEBUG = arg('debug');
/** A wall band is 20-30 m of street front: a street tree in it is the rule, so its foliage is dropped and the read stands
 *  while at most this share of the band is leaves (measure-pui's 8 % is for a 2 m shop band). */
const WALL_LEAF = 0.3;
const OUT = arg('out') ?? `src/canalRecall/buurtGenerator/districts/measured/${district}.json`;
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const genRowOf = (recordId: string) => recordId.replace(/-\d{6}$/, '');
const records = (JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]);
const frontRecs = (JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).filter(r => r.buurtKit?.frontLine);
const kit = new Map(frontRecs.map(r => [r.pandId, r.buurtKit.frontLine as [[number, number], [number, number]]]));
/** Round 10: each member's erkers (BAG's, frontKit.ts erkersOf), read for their finish on the same crops. */
const kitErkers = new Map(frontRecs.map(r => [r.pandId, (r.buurtKit.erkers ?? []) as { a0: number; a1: number }[]]));
type Span = { key: string; t0: number; t1: number };
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
const save = (extra: Record<string, unknown> = {}) => { const now = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}; fs.writeFileSync(OUT, JSON.stringify({ ...now, version: 1, district, ...extra, walls, wallSkipped: skipped, erkers: erkerOut }, null, 2) + '\n'); };
const erkerOut: Record<string, unknown> = { ...(prior.erkers ?? {}) };
const walls: Record<string, unknown> = { ...(prior.walls ?? {}) }, skipped: Record<string, string> = { ...(prior.wallSkipped ?? {}) };
const cachedBefore = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const mine = new Set<string>();
let purgedFiles = 0, purgedBytes = 0;
const track = () => { for (const f of panoTracker.touched!) if (!cachedBefore.has(path.basename(f))) mine.add(f); panoTracker.touched!.clear(); };

async function readOne(p: any, wall: Wall, lineM: number, occluders: { x: number; y: number }[][], spans: Span[] = []): Promise<WallRead & { erkers?: Record<string, ErkerRead> }> {
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
  // Round 9b: only the columns the camera sees (no other building in the way, not edge-on).
  const bx0 = Math.min(cam.x, wall.a.x, wall.b.x), bx1 = Math.max(cam.x, wall.a.x, wall.b.x), by0 = Math.min(cam.y, wall.a.y, wall.b.y), by1 = Math.max(cam.y, wall.a.y, wall.b.y);
  const near = occluders.filter(r => r.some(q => q.x >= bx0 && q.x <= bx1 && q.y >= by0 && q.y <= by1) || (Math.min(...r.map(q => q.x)) <= bx1 && Math.max(...r.map(q => q.x)) >= bx0 && Math.min(...r.map(q => q.y)) <= by1 && Math.max(...r.map(q => q.y)) >= by0));
  const seen = visibleAlong(cam, wall.a, wall.b, near), seenAt = (i: number) => seen[Math.min(seen.length - 1, Math.round(i / ppm / VIEW_GATE.stepM))];
  const seenM = [...Array(i1 - i0).keys()].filter(k => seenAt(i0 + k)).length / ppm;
  if (seenM < 4) return { ...base, verdict: null, why: `${seenM.toFixed(1)} m of the window seen (occluded or edge-on)` };
  const upper: [number, number, number][] = [], lower: [number, number, number][] = [], luma: number[] = [];
  // Erker faces and the wall beside them, from 3 m up (over the ground storey) to under the line.
  const ePx = new Map<string, [number, number, number][]>(spans.map(sp => [sp.key, []])), wPx: [number, number, number][] = [];
  const spanAt = (i: number) => { const t = i / ppm; return spans.find(sp => t >= sp.t0 - 0.3 && t <= sp.t1 + 0.3); };
  let n = 0, valid = 0, leaf = 0, lowRows = 0;
  for (let j = 0; j < crop.height; j++) {
    const z = topZ - (j + 0.5) / ppm; if (z < WALL_BAND.z0 || z > z1) continue;
    const low = z < WALL_BAND.vehicleTopM; if (low) lowRows++;
    for (let i = i0; i < i1; i++) {
      if (!seenAt(i)) continue;
      const k = j * W + i, q = k * 4, r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      if (low) luma.push(0.299 * r + 0.587 * g + 0.114 * b);
      n++; if (!crop.alpha[k]) continue; valid++;
      if (isFoliage(r, g, b)) { leaf++; continue; }
      (low ? lower : upper).push([r, g, b]);
      if (spans.length && z >= 3 && z <= z1 - 0.2) { const sp = spanAt(i), t = i / ppm; if (!sp) wPx.push([r, g, b]); else if (t >= sp.t0 + 0.15 * (sp.t1 - sp.t0) && t <= sp.t1 - 0.15 * (sp.t1 - sp.t0)) ePx.get(sp.key)!.push([r, g, b]); }
    }
  }
  if (DEBUG) fs.writeFileSync(`${DEBUG}/${p.pano_id}-${Math.round(wall.mid.x)}.jpg`, crop.jpeg);
  if (!n || valid / n < WALL_GATE.valid) return { ...base, verdict: null, why: `band ${(100 * valid / Math.max(1, n)).toFixed(0)} % in the cut` };
  if (leaf / valid > WALL_LEAF) return { ...base, verdict: null, why: `foliage ${(100 * leaf / valid).toFixed(0)} %` };
  const seenCols = [...Array(i1 - i0).keys()].filter(k => seenAt(i0 + k)).length;
  const v = lowRows && seenCols ? vehicleBand(luma, seenCols, lowRows) : { vehicle: null };
  const px = (v.vehicle ? upper : [...upper, ...lower]).map(([r, g, b]) => labOf(r, g, b));
  const verdict = wallBrickOf(px);
  let erkers: Record<string, ErkerRead> | undefined;
  if (spans.length) {
    const ref = whiteRefOf(px), lab = (q: [number, number, number][]) => q.map(([r, g, b]) => labOf(r, g, b)), wl = lab(wPx), wall = whiteShareOf(wl, ref), wallBrick = brickShareOf(wl, ref);
    for (const [k, q] of ePx) if (q.length >= ERKER_WHITE.minPx) { const el = lab(q); (erkers ??= {})[k] = { share: +whiteShareOf(el, ref).toFixed(3), wall: +wall.toFixed(3), brick: +brickShareOf(el, ref).toFixed(3), wallBrick: +wallBrick.toFixed(3) }; }
  }
  return { ...base, verdict, ...(erkers ? { erkers } : {}), why: verdict ? (v.vehicle ? `vehicle (${v.vehicle}) under 2.4 m dropped` : undefined) : 'no brick cluster' };
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
  const own = new Set(row.members.map(normId));
  // Buildings within 60 m of the row's middle that are not its members (the view rays stay inside that).
  const occluders = (await neighbourhood(wall.mid)).filter(f => !own.has(normId(f.id)) && f.ring.some(q => Math.hypot(q.x - wall.mid.x, q.y - wall.mid.y) < len / 2 + 60)).map(f => f.ring);
  let list: any[];
  try { list = await listPanos({ x: wall.mid.x + nx * 12, y: wall.mid.y + ny * 12 }, Math.max(25, len / 2 + 10)); } catch (e) { skipped[id] = `pano list: ${(e as Error).message}`; continue; }
  // Round 10: each camera reads the straight run of members nearest it (measure.ts localFront), not the row's chord.
  const segMembers = row.members.filter(m => kit.has(m));
  const segs = segMembers.map(m => kit.get(m)!).map(l => [lngLatToRd(l[0]), lngLatToRd(l[1])] as const);
  const cands = list.flatMap(p => {
    if (!p._links?.equirectangular_medium?.href) return [];
    const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]), t = (q.x - A.x) * ux + (q.y - A.y) * uy;
    const lf = localFront(segs, q);
    if (!lf) return [];
    const lx = lf.b.x - lf.a.x, ly = lf.b.y - lf.a.y, ll = Math.hypot(lx, ly), lt = ((q.x - lf.a.x) * lx + (q.y - lf.a.y) * ly) / ll;
    if (ll < 6 || lt < 0 || lt > ll || lf.offM < 5 || lf.offM > 30) return [];
    const local: Wall = { a: lf.a, b: lf.b, len: ll, nx: ly / ll, ny: -lx / ll, mid: { x: (lf.a.x + lf.b.x) / 2, y: (lf.a.y + lf.b.y) / 2 }, roadDistM: 0, facing: 0 };
    const spans: Span[] = [];
    for (let m = lf.lo; m <= lf.hi; m++) (kitErkers.get(segMembers[m]) ?? []).forEach((er, k) => {
      const [sa, sb] = segs[m], at = (f: number) => ((sa.x + (sb.x - sa.x) * f - lf.a.x) * lx + (sa.y + (sb.y - sa.y) * f - lf.a.y) * ly) / ll;
      const u0 = at(er.a0), u1 = at(er.a1);
      spans.push({ key: `${segMembers[m]}:${k}`, t0: Math.min(u0, u1), t1: Math.max(u0, u1) });
    });
    return t > len * 0.05 && t < len * 0.95 ? [{ p, t, date: String(p.timestamp).slice(0, 10), local, spans }] : [];
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
    try { reads.push(await readOne(c.p, c.local, row.lineM, occluders, c.spans)); } catch (e) { reads.push({ pano: c.p.pano_id, date: c.date, verdict: null, why: (e as Error).message }); }
  }
  const vote = voteWall(reads);
  // Round 10: the erkers' finish over the same reads (distinct panoramas), then the row's consensus for unread ones.
  const eKeys = row.members.flatMap(m => (kitErkers.get(m) ?? []).map((_, k) => `${m}:${k}`));
  if (eKeys.length) {
    const fin = rowErkerFinish(eKeys.map(k => erkerFinishOf(reads.flatMap(r => (r as any).erkers?.[k] ? [(r as any).erkers[k] as ErkerRead] : []))));
    const own = eKeys.map(k => erkerFinishOf(reads.flatMap(r => (r as any).erkers?.[k] ? [(r as any).erkers[k] as ErkerRead] : [])));
    erkerOut[id] = Object.fromEntries(eKeys.map((k, i) => [k, { finish: fin[i], read: own[i] !== null, reads: reads.flatMap(r => (r as any).erkers?.[k] ? [`${r.pano} ${r.date} w${(r as any).erkers[k].share}/${(r as any).erkers[k].wall} b${(r as any).erkers[k].brick}/${(r as any).erkers[k].wallBrick}`] : []) }]));
  }
  if ('skip' in vote) skipped[id] = `${vote.skip}; ${reads.map(r => `${r.pano} ${r.date}: ${r.verdict?.hex ?? r.why}`).join('; ')}`;
  else walls[id] = vote;
}
track();
const last = await purgeFiles(mine), purged = { files: purgedFiles + last.files, bytes: purgedBytes + last.bytes };
save({ wallSource: 'Amsterdam panoramas (data.amsterdam.nl, CC BY 4.0) via scripts/buurt-generators/measure-walls.ts' });
const mem = (ids: string[]) => ids.reduce((s, id) => s + (rows.get(id)?.members.length ?? 0), 0);
const got = [...rows.keys()].filter(id => walls[id]), pool = [...rows.keys()].filter(id => !walls[id]);
console.log(`${district}: ${got.length} of ${rows.size} rows measured (${mem(got)} pands), ${pool.length} on the district pool (${mem(pool)} pands); ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB, purged ${purged.files} files ${(purged.bytes / 1048576).toFixed(0)} MB -> ${OUT}`);
