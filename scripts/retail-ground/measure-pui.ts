/**
 * Lane retail-look round 4: the pui's measured paint per shop pand, from the open-data Amsterdam panoramas
 * (data.amsterdam.nl, CC BY 4.0; the house line's pand-reference cache and selection). For each pand with a template
 * front (data/retail-ground/shop-templates.json), plus the plain shop pands named with --also:
 *   1. the exposed wall nearest the shop's node (select.ts exposedWalls), within 6 m;
 *   2. the best two panoramas facing it (select.ts rankPanos: 5-35 m, obliquity <= 55 deg), small (2000 px) equirects;
 *   3. the wall rectified out of each (house-frames photo.ts) at 20 px/m, and its ground-storey band (1.2-3.3 m over the
 *      street, the inner 84 % of the wall: above most parked cars, below the first floor);
 *   4. the band's pixels clustered in OKLab (k = 4). The paint is a pale cluster (L >= 0.66, C <= 0.06) holding at least
 *      12 % of the band, else a coloured one (C >= 0.07, 0.22 <= L <= 0.85) holding 12 %, else dark (the band's two
 *      largest clusters under L 0.42): pale and coloured are what the frames are painted, dark is glass and dark paint
 *      together, which the dark default draws anyway.
 * A reading counts only when the band is unoccluded (>= 85 % of it projects into the cut, foliage <= 8 %) and no second
 * panorama reads a different clear class (an unclear second neither confirms nor vetoes; `agree` counts the clear reads). Receipts: pano id, date, distance, obliquity, crop box (metres
 * along the wall and over the street), cluster share.
 *
 * Stages data/retail-ground/pui-paint.json; build-templates.ts folds it into the template extract's `paint` map. Never
 * publishes.
 *   node --import tsx scripts/retail-ground/measure-pui.ts [--limit=N] [--only=id,id] [--also=id,id] [--offline]
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { CACHE_DIR, findPands, http, lngLatToRd, panoTracker, purgeFiles, neighbourhood, normId, nearestOnSeg, type Footprint } from '../pand-reference/core.ts';
import { exposedWalls, listPanos, rankPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { isLeaf } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { aimPose, frameFor, gridConvergenceDeg, type WallQuad } from '../house-frames/pose.ts';
import { cutPerspective, loadEquirect, rectifyFromFrame } from '../house-frames/photo.ts';
import { PUI_BAND, PUI_GATE, clusters, drawnPaint, oklab, paintOf, vehicleBand, type Lab, type Verdict } from '../../src/canalRecall/retailPuiPaint.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (process.argv.includes('--offline')) http.offline = true;
const OUT = arg('out') ?? 'data/retail-ground/pui-paint.json';
const DEBUG = arg('debug');
/** --refresh: re-measure the listed pands even when the output already holds them (round 5b's vehicle gate). */
const REFRESH = process.argv.includes('--refresh');
/** --max-mb: stop once this much has been downloaded (default 1850). */
const MAX_MB = Number(arg('max-mb') ?? 1850);
type Read = { verdict: Verdict; vehicle?: { aniso: number; smooth: number; kind?: string }; pano: string; date: string; distM: number; obliquityDeg: number; valid: number; leaf: number; crop: { a0: number; a1: number; z0: number; z1: number } };
async function readPano(pick: PanoPick, wall: Wall, heightM: number): Promise<Read | { skip: string }> {
  const img = await loadEquirect(pick.record, 'small');
  if (!img) return { skip: `pano ${pick.panoId} did not load` };
  const ll: [number, number] = [pick.record.geometry.coordinates[0], pick.record.geometry.coordinates[1]];
  const published = Number(pick.record.geometry.coordinates[2]);
  const quad: WallQuad = { a: wall.a, b: wall.b, heightM: Math.max(4, Math.min(heightM || 10, 25)) };
  const pose = aimPose({ lngLat: ll, cameraNap: published > 0 ? published - 43.5 : null }, quad, { width: 900, height: 560 }), frame = frameFor(pose);
  const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
  const topM = PUI_BAND.z1 + 0.2, rect = rectifyFromFrame(cut, frame, pose, quad, PUI_BAND.ppm, topM);
  const px: Lab[] = []; let n = 0, valid = 0, leaf = 0;
  const i0 = Math.floor(rect.width * PUI_BAND.inset), i1 = Math.ceil(rect.width * (1 - PUI_BAND.inset));
  const luma: number[] = []; let rows = 0;
  for (let j = 0; j < rect.height; j++) {
    const z = topM - (j + 0.5) / rect.ppm;
    if (z < PUI_BAND.z0 || z > PUI_BAND.z1) continue;
    rows++;
    for (let i = i0; i < i1; i++) {
      const q = (j * rect.width + i) * 3; luma.push(0.299 * rect.rgb[q] + 0.587 * rect.rgb[q + 1] + 0.114 * rect.rgb[q + 2]);
      n++; const k = j * rect.width + i;
      if (!rect.valid[k]) continue;
      valid++; const r = rect.rgb[k * 3], g = rect.rgb[k * 3 + 1], b = rect.rgb[k * 3 + 2];
      if (isLeaf(r, g, b)) { leaf++; continue; }
      px.push(oklab(r, g, b));
    }
  }
  if (DEBUG) await sharp(Buffer.from(rect.rgb), { raw: { width: rect.width, height: rect.height, channels: 3 } }).resize(rect.width * 4, rect.height * 4, { kernel: 'nearest' }).png().toFile(`${DEBUG}/${pick.panoId}-${Math.round(wall.mid.x)}.png`);
  const crop = { a0: +(wall.len * PUI_BAND.inset).toFixed(2), a1: +(wall.len * (1 - PUI_BAND.inset)).toFixed(2), z0: PUI_BAND.z0, z1: PUI_BAND.z1 };
  const base = { pano: pick.panoId, date: String(pick.timestamp).slice(0, 10), distM: +pick.distM.toFixed(1), obliquityDeg: +pick.obliquityDeg.toFixed(1), valid: n ? +(valid / n).toFixed(3) : 0, leaf: valid ? +(leaf / valid).toFixed(3) : 1, crop };
  if (!n || valid / n < PUI_GATE.valid) return { skip: `band ${(100 * valid / Math.max(1, n)).toFixed(0)} % in the cut (${pick.panoId})` };
  if (leaf / valid > PUI_GATE.leaf) return { skip: `foliage ${(100 * leaf / valid).toFixed(0)} % (${pick.panoId})` };
  // Round 5b: a band that is mostly a vehicle (a passing tram's smear, a van's flat side) reads as unclear.
  const v = vehicleBand(luma, i1 - i0, rows);
  if (v.vehicle) return { verdict: null, vehicle: { aniso: v.aniso, smooth: v.smooth, kind: v.vehicle }, ...base };
  return { verdict: paintOf(clusters(px)), vehicle: { aniso: v.aniso, smooth: v.smooth }, ...base };
}

const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const staged = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8')) as { buildings: Record<string, [number, number, number, string?, 1?]> };
const also = (arg('also') ?? '').split(',').filter(Boolean).map(normId);
let ids = [...Object.keys(staged.buildings), ...also.filter(id => !staged.buildings[id])];
const only = (arg('only') ?? '').split(',').filter(Boolean).map(normId);
if (only.length) ids = ids.filter(id => only.includes(id));
const limit = Number(arg('limit') ?? 0); if (limit) ids = ids.slice(0, limit);
const prior: { buildings: Record<string, unknown>; skipped: Record<string, string> } = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { buildings: {}, skipped: {} };
const out = { version: 1, source: 'Amsterdam panoramas (data.amsterdam.nl, CC BY 4.0) via scripts/retail-ground/measure-pui.ts', band: PUI_BAND, gate: PUI_GATE, buildings: { ...prior.buildings } as Record<string, unknown>, skipped: { ...prior.skipped } as Record<string, string> };
const fps = await findPands(ids);
const t0 = Date.now(); let done = 0;
// Disk rule (the house:crops one): the panoramas this run downloads are purged once their pand is read; the ones the
// shared cache already held stay.
const cachedBefore = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
let purgedMb = 0;
const purgeNew = async () => { const mine = [...panoTracker.touched!].filter(f => !cachedBefore.has(f.slice(CACHE_DIR.length + 1))); panoTracker.touched!.clear(); purgedMb += (await purgeFiles(mine)).bytes / 1048576; };
for (const id of ids) {
  await purgeNew();
  if (++done % 50 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    const gb = freeGb();
    console.log(`${done}/${ids.length} ${((Date.now() - t0) / 1000).toFixed(0)} s, ${Object.keys(out.buildings).length} measured, ${http.requests} requests ${(http.bytes / 1048576).toFixed(0)} MB (purged ${purgedMb.toFixed(0)} MB), ${gb.toFixed(1)} GB free`);
  }
  // Every pand: the disk floor and the byte cap.
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1024 ** 2) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  if (!REFRESH && (out.buildings[id] || out.skipped[id])) continue;
  delete out.buildings[id]; delete out.skipped[id];
  const fp = fps.get(id); if (!fp) { out.skipped[id] = 'no footprint'; continue; }
  const row = staged.buildings[id];
  const centre = fp.ring.reduce((s, p) => ({ x: s.x + p.x / fp.ring.length, y: s.y + p.y / fp.ring.length }), { x: 0, y: 0 });
  const node = row ? lngLatToRd([row[1], row[2]]) : centre;
  const others: Footprint[] = await neighbourhood(centre);
  const walls = exposedWalls(fp, others).map(w => ({ w, d: nearestOnSeg(node, { a: w.a, b: w.b }).d })).sort((p, q) => p.d - q.d);
  const wall = row ? walls.find(x => x.d <= 6)?.w : walls.sort((p, q) => q.w.len - p.w.len)[0]?.w;
  if (!wall) { out.skipped[id] = 'no exposed wall within 6 m of the node'; continue; }
  let picks: PanoPick[];
  try { picks = rankPanos(wall, await listPanos(wall.mid, 35)).slice(0, 4); } catch (e) { out.skipped[id] = `pano list: ${(e as Error).message}`; continue; }
  const reads: Read[] = []; const why: string[] = [];
  for (const p of picks) {
    if (reads.filter(r => r.verdict).length === 3) break;
    try { const r = await readPano(p, wall, fp.height); if ('skip' in r) why.push(r.skip); else reads.push(r); } catch (e) { why.push(`${p.panoId}: ${(e as Error).message}`); }
  }
  if (!reads.length) { out.skipped[id] = why.join('; ') || 'no panorama faces the wall'; continue; }
  // A clear reading stands unless the other panorama reads a different clear class (an unclear second, a van or a
  // shutter in it, neither confirms nor vetoes).
  // Round 5b: up to three clear reads vote; the class with the most votes stands, a tie between classes skips. A vehicle
  // rarely stands in front in two captures, so the vote outlasts one.
  const clearAll = reads.filter(r => r.verdict), votes = new Map<string, Read[]>();
  for (const r of clearAll) { const l = votes.get(r.verdict!.cls) ?? []; l.push(r); votes.set(r.verdict!.cls, l); }
  const ranked = [...votes.values()].sort((p, q) => q.length - p.length);
  const tie = ranked.length > 1 && ranked[0].length === ranked[1].length;
  const clear = tie ? clearAll : ranked[0] ?? [], a = clear[0], b = tie ? clear.find(r => r.verdict!.cls !== a?.verdict?.cls) : clear[1];
  if (!a?.verdict) { out.skipped[id] = `no clear paint (${reads.map(r => r.pano + (r.vehicle && !r.verdict ? ` (${r.vehicle.kind ?? 'muddle'}: aniso ${r.vehicle.aniso} smooth ${r.vehicle.smooth} obl ${r.obliquityDeg})` : '')).join(', ')})`; continue; }
  if (b && b.verdict!.cls !== a.verdict.cls) { out.skipped[id] = `panoramas disagree: ${a.verdict.cls} (${a.pano}) vs ${b.verdict!.cls} (${b.pano})`; continue; }
  out.buildings[id] = { paint: drawnPaint(a.verdict.cls, a.verdict.hex), hex: a.verdict.hex, cls: a.verdict.cls, share: a.verdict.share, agree: clear.length, of: clearAll.length, receipt: { pano: a.pano, date: a.date, distM: a.distM, obliquityDeg: a.obliquityDeg, crop: a.crop, valid: a.valid, leaf: a.leaf, ...(a.vehicle ? { vehicle: a.vehicle } : {}), ...(reads.some(r => r.vehicle?.kind) ? { vehicleSkipped: reads.filter(r => r.vehicle?.kind).map(r => r.pano) } : {}), ...(b ? { second: { pano: b.pano, date: b.date, hex: b.verdict!.hex } } : {}) } };
}
await purgeNew();
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const all = Object.values(out.buildings) as Array<{ cls: string }>, tpl = Object.keys(staged.buildings);
const on = (cls: string) => tpl.filter(id => (out.buildings[id] as { cls?: string } | undefined)?.cls === cls).length;
console.log(`measured ${all.length} (${tpl.filter(id => out.buildings[id]).length} of ${tpl.length} template pands: pale ${on('pale')}, colour ${on('colour')}, dark ${on('dark')}); skipped ${Object.keys(out.skipped).length}; ${http.requests} requests, ${(http.bytes / 1048576).toFixed(0)} MB -> ${OUT}`);
