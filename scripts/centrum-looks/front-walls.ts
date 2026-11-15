/**
 * Centrum looks round 2: each drawn front's wall from the open Amsterdam street panoramas (data.amsterdam.nl, CC BY 4.0),
 * per front rather than per row (measure-walls.ts reads a whole buurt row; the Jordaan's rows mix brick, paint and buff
 * front to front, and the round-1 judges called the one-tone rows "too dark and uniform").
 *   1. the front a→b (fronts.json), its outward normal away from the pand's centroid;
 *   2. the panoramas 5-35 m off it within 55 deg of square on (pand-reference rankPanos), newest capture date first,
 *      at most 4 tried, stop at 3 clear reads;
 *   3. each rectified onto the front (pand-reference/rectify.ts) at 20 px/m and read from 2.6 m (over the shop or ground
 *      storey, whose paint and glass are not the wall) to 0.3 m under the front top, the front's inner 84 %;
 *   4. the measure-walls gates: only the columns the camera sees (no other footprint on the ray), at least 2.5 m of them,
 *      85 % of the band in the cut, foliage dropped and at most 30 % of it;
 *   5. white-balanced on the band's own white trim (measure.ts wallBrickOf), the reads voted (voteWall: two distinct
 *      panoramas within 0.06 OKLab).
 * Writes data/buurt-generators/<district>/front-walls.json ({ walls: {pandId: vote}, skipped: {pandId: why} }), merged on
 * write so a stopped run resumes. Downloads: the repo URL as contact, 500 ms apart, --max-mb (default 2500), a 15 GB disk
 * floor; panoramas this run downloaded are purged every 40 fronts (the shared cache's stay).
 *
 * Round-2 trial (2026-11-16, Boomstraat 169234, 172664, 172663, 169233): 0 of 4 fronts voted; the balanced reads of one front
 * spread #443630 to #cececc across captures (a 3-4 m street, shade, scaffold), at ~25 s and ~9 MB a front (11 h, 15 GB for
 * the Jordaan's 1,638 fronts). Not run district-wide; the Jordaan brick is drawn (beltLook/wallDraw.ts) instead.
 *
 *   node --import tsx scripts/centrum-looks/front-walls.ts --district=jordaan [--first=<pandId,...>] [--max-mb=2500] [--limit=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jpeg from 'jpeg-js';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { CACHE_DIR, http, neighbourhood, normId, panoTracker, purgeFiles } from '../pand-reference/core.ts';
import { listPanos, rankPanos, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';
import { WALL_GATE, isFoliage, labOf, visibleAlong, voteWall, wallBrickOf, VIEW_GATE, type WallRead } from '../../src/canalRecall/buurtGenerator/measure.ts';
import { districtPands } from '../buurt-generators/generate.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'jordaan', stage = `artifacts/buurt-generators/${district}`;
const OUT = `data/buurt-generators/${district}/front-walls.json`;
const MAX_MB = Number(arg('max-mb') ?? 2500), LIMIT = Number(arg('limit') ?? Infinity);
const first = (arg('first') ?? '').split(',').filter(Boolean);
/** The band: from over the ground storey to under the front top; the front's inner share; min seen run; leaf cap. */
export const FRONT_BAND = { z0: 2.6, topGapM: 0.3, inset: 0.08, ppm: 20, minSeenM: 2.5, leaf: 0.3, tries: 4, reads: 3 } as const;
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const look = JSON.parse(fs.readFileSync(`src/canalRecall/beltLook/districts/${district}.json`, 'utf8'));
const fronts = JSON.parse(fs.readFileSync(`${stage}/fronts.json`, 'utf8')).fronts as Record<string, { a: [number, number]; b: [number, number]; lengthM: number }>;
const recs = new Map((JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).map(r => [r.pandId as string, r]));
const rings = new Map(districtPands({ buurten: look.buurten } as never).map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), p.ring as [number, number][]]));
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const walls: Record<string, unknown> = { ...(prior.walls ?? {}) }, skipped: Record<string, string> = { ...(prior.skipped ?? {}) };
const save = () => fs.writeFileSync(OUT, JSON.stringify({ version: 1, district, source: 'Amsterdam panoramas (data.amsterdam.nl, CC BY 4.0) via scripts/centrum-looks/front-walls.ts', walls, skipped }, null, 1) + '\n');
const cachedBefore = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const mine = new Set<string>();
const track = () => { for (const f of panoTracker.touched!) if (!cachedBefore.has(path.basename(f))) mine.add(f); panoTracker.touched!.clear(); };

async function readOne(pick: ReturnType<typeof rankPanos>[number], wall: Wall, topM: number, occluders: { x: number; y: number }[][]): Promise<WallRead> {
  const base = { pano: pick.panoId, date: String(pick.timestamp).slice(0, 10) };
  const pano = await loadPano(pick); track();
  if (!pano) return { ...base, verdict: null, why: 'did not load' };
  const crop = rectifyWall(pano.img, pick, wall, topM, FRONT_BAND.ppm);
  if (!crop) return { ...base, verdict: null, why: 'no camera pose' };
  const img = jpeg.decode(crop.jpeg, { useTArray: true });
  const W = crop.width, ppm = crop.ppm, topZ = crop.wallHeightM;
  const cam = lngLatToRd([pick.record.geometry.coordinates[0], pick.record.geometry.coordinates[1]]);
  const seen = visibleAlong(cam, wall.a, wall.b, occluders), seenAt = (i: number) => seen[Math.min(seen.length - 1, Math.round(i / ppm / VIEW_GATE.stepM))];
  const i0 = Math.floor(wall.len * FRONT_BAND.inset * ppm), i1 = Math.min(W, Math.ceil(wall.len * (1 - FRONT_BAND.inset) * ppm));
  const seenM = [...Array(Math.max(0, i1 - i0)).keys()].filter(k => seenAt(i0 + k)).length / ppm;
  if (seenM < FRONT_BAND.minSeenM) return { ...base, verdict: null, why: `${seenM.toFixed(1)} m seen` };
  const z1 = topM - FRONT_BAND.topGapM, px: ReturnType<typeof labOf>[] = [];
  let n = 0, valid = 0, leaf = 0;
  for (let j = 0; j < crop.height; j++) {
    const z = topZ - (j + 0.5) / ppm; if (z < FRONT_BAND.z0 || z > z1) continue;
    for (let i = i0; i < i1; i++) {
      if (!seenAt(i)) continue;
      const k = j * W + i, q = k * 4, r = img.data[q], g = img.data[q + 1], b = img.data[q + 2];
      n++; if (!crop.alpha[k]) continue; valid++;
      if (isFoliage(r, g, b)) { leaf++; continue; }
      px.push(labOf(r, g, b));
    }
  }
  if (!n || valid / n < WALL_GATE.valid) return { ...base, verdict: null, why: `band ${(100 * valid / Math.max(1, n)).toFixed(0)} % in the cut` };
  if (leaf / valid > FRONT_BAND.leaf) return { ...base, verdict: null, why: `foliage ${(100 * leaf / valid).toFixed(0)} %` };
  const verdict = wallBrickOf(px);
  return { ...base, verdict, ...(verdict ? {} : { why: 'no wall cluster' }) };
}

const ids = [...new Set([...first, ...Object.keys(fronts)])].filter(id => fronts[id] && recs.has(id));
let done = 0, tried = 0;
const t0 = Date.now();
for (const id of ids) {
  if (walls[id] || skipped[id]) continue;
  if (tried >= LIMIT) break;
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1048576) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  tried++;
  if (++done % 40 === 0) { track(); await purgeFiles(mine); mine.clear(); save(); console.log(`${done} fronts, ${Object.keys(walls).length} measured, ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${freeGb().toFixed(1)} GB free`); }
  const f = fronts[id], rec = recs.get(id), ring = rings.get(id);
  const topM = Number(rec.eavesM ?? rec.topM);
  const A = lngLatToRd(f.a), B = lngLatToRd(f.b), len = Math.hypot(B.x - A.x, B.y - A.y);
  if (len < 3 || !ring || !Number.isFinite(topM) || topM < 4) { skipped[id] = `front ${len.toFixed(1)} m, top ${topM}`; continue; }
  const c = ring.reduce((s, p) => { const q = lngLatToRd(p); return { x: s.x + q.x / ring.length, y: s.y + q.y / ring.length }; }, { x: 0, y: 0 });
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  let nx = (B.y - A.y) / len, ny = -(B.x - A.x) / len;
  if ((c.x - mid.x) * nx + (c.y - mid.y) * ny > 0) { nx = -nx; ny = -ny; }
  const wall: Wall = { a: A, b: B, len, nx, ny, mid, roadDistM: 0, facing: 0 };
  let picks;
  try { picks = rankPanos(wall, await listPanos({ x: mid.x + nx * 12, y: mid.y + ny * 12 }, 30)).filter(p => p.record?._links?.equirectangular_medium?.href); }
  catch (e) { skipped[id] = `pano list: ${(e as Error).message}`; continue; }
  // newest date first, one per date, then the rest
  const byDate = [...picks].sort((p, q) => String(q.timestamp).localeCompare(String(p.timestamp)));
  const seenDates = new Set<string>(), order = [...byDate.filter(p => { const d = String(p.timestamp).slice(0, 10); if (seenDates.has(d)) return false; seenDates.add(d); return true; }), ...byDate].filter((p, i, a) => a.indexOf(p) === i).slice(0, FRONT_BAND.tries);
  if (!order.length) { skipped[id] = 'no panorama faces the front'; continue; }
  const own = normId(id);
  const occluders = (await neighbourhood(mid)).filter(fp => normId(fp.id) !== own && fp.ring.some(q => Math.hypot(q.x - mid.x, q.y - mid.y) < len / 2 + 45)).map(fp => fp.ring);
  const reads: WallRead[] = [];
  for (const p of order) {
    if (reads.filter(r => r.verdict).length >= FRONT_BAND.reads) break;
    try { reads.push(await readOne(p, wall, topM, occluders)); } catch (e) { reads.push({ pano: p.panoId, date: String(p.timestamp).slice(0, 10), verdict: null, why: (e as Error).message }); }
  }
  const vote = voteWall(reads);
  if ('skip' in vote) skipped[id] = `${vote.skip}; ${reads.map(r => `${r.pano} ${r.date}: ${r.verdict ? `${r.verdict.hex}${r.verdict.balanced ? ' bal' : ''} ${r.verdict.kind}` : r.why}`).join('; ')}`;
  else walls[id] = { ...vote, kind: reads.find(r => r.verdict && vote.reads.some(v => v.pano === r.pano))?.verdict?.kind };
}
track(); await purgeFiles(mine); save();
console.log(`${district}: ${Object.keys(walls).length} fronts measured, ${Object.keys(skipped).length} skipped; ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB; ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${OUT}`);
console.log('front-walls-done');
