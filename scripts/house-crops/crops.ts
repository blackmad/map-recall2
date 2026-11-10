/**
 * House line station 4a: rectified, quality-flagged, resumable facade crops for every street-facing pand of one buurt.
 * See docs/house-line.md section 4a. `--help` prints HELP.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { http, neighbourhood, type Footprint } from '../pand-reference/core.ts';
import { listPanos, pickWall, rankPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall, foliageFraction, washedOutFraction, wallHeight } from '../pand-reference/rectify.ts';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { medianFuse, planStrip, type FrontSpan, type PanoRecord } from '../../src/canalRecall/blockFace/strip.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { loadBuurt, pandsInBuurt, centroid, type Buurt } from './buurt.ts';
import { manifestPath, type Entry, type Manifest, type Session } from './manifest.ts';
import { THRESHOLDS, usability, penalty, voidShare, occluderShare, spanPixels, cutSpan, groupFaces, type CropFlags, type WallRef } from './flags.ts';

export const HELP = `house:crops - rectified, quality-flagged facade crops for one buurt (house line station 4a)

  npm run house:crops -- --buurt <code|cbs|name> [--pand <id>] [--resume] [--dry-run] [--rate-ms 500]
                         [--archive <dir>] [--limit <n>] [--restart] [--report] [--help]

  --buurt <key>     CBS buurt: 4-letter code (AB07), CBS code (BU0363AB07) or name (Bloemgrachtbuurt). Required.
  --pand <id>       process only this pand (16-digit BAG id, with or without NL.IMBAG.Pand.); it must lie in the buurt.
  --resume          continue from scripts/house-crops/manifests/<code>.json: pands with status ok / no-wall / no-pano are
                    skipped, status error is retried. Without --resume an existing manifest stops the run (see --restart).
  --restart         discard the existing manifest and start over (cached API responses are still reused, so this repeats no requests).
  --dry-run         list pands, walls, strategy and the estimated request count and wall time; no network, no writes.
  --rate-ms <ms>    minimum gap between the STARTS of two network requests (default 500; cache hits are free).
  --archive <dir>   root of the map-recall2-source-data checkout (or its worktree); crops go to <dir>/pand-crops/<pandId>/.
                    Default: env HOUSE_CROPS_ARCHIVE. Required unless --dry-run.
  --limit <n>       stop after n pands (smoke runs); the manifest stays resumable.
  --report          print the coverage table and write the contact sheet (artifacts/house-crops/<code>-sheet.png), no crops.

Per pand: the street-facing BAG wall (pand-reference/select.ts pickWall) is rectified from the best panorama
(rankPanos, rectifyWall, 50 px/m); a wall under ${THRESHOLDS.narrowWallM} m, or a best view over 35 deg oblique, uses the block-face
planStrip route instead (one capture day, up to 3 panoramas median-fused, 40 px/m) and cuts the pand's span out of the strip.
A crop that misses a quality cap gets one second try from another capture day (leaf-off preferred); the better one is kept.
Flags: foliage, washedOut, missing, voidShare, occluderShare (a dark-blob PROXY for vans/scaffold), obliquity, cameraDistance.
usable = voidShare <= ${THRESHOLDS.voidShare}, foliage <= ${THRESHOLDS.foliage}, washedOut <= ${THRESHOLDS.washedOut}, occluderShare <= ${THRESHOLDS.occluderShare},
obliquity <= ${THRESHOLDS.obliquityDeg} deg, camera ${THRESHOLDS.cameraDistanceM[0]}-${THRESHOLDS.cameraDistanceM[1]} m (scripts/house-crops/flags.ts THRESHOLDS).
Panorama API: one request start per --rate-ms, exponential backoff on 429/5xx (Retry-After honoured), identifying User-Agent.
Panorama bytes are cached in PAND_REFERENCE_CACHE (default .cache/pand-reference; point it at the shared cache).`;

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(`--${n}`);
const round = (v: number, d = 3) => +v.toFixed(d);
const idOf = (fpId: string) => fpId.replace('NL.IMBAG.Pand.', '');
const day = (t: string) => t.slice(0, 10);
const leafOff = (t: string) => { const m = Number(t.slice(5, 7)); return m <= 4 || m >= 11; };
const USER_AGENT = 'MapRecall-HouseCrops/1.0 (+https://github.com/blackmad/map-recall2; Gemeente Amsterdam panoramas CC BY 4.0)';
const ATTRIBUTION = 'Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher)';

async function readManifest(code: string): Promise<Manifest | null> { return fs.readFile(manifestPath(code), 'utf8').then(JSON.parse).catch(() => null); }
async function writeManifest(m: Manifest) {
  const file = manifestPath(m.buurt.code);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file + '.tmp', JSON.stringify(m, null, 1) + '\n');
  await fs.rename(file + '.tmp', file);
}

// ---- panorama lists, one request set per 30 m cell -----------------------------------------------------
const cellCache = new Map<string, any[]>();
const CELL = 30, CELL_RADIUS = Math.ceil(CELL * Math.SQRT1_2 + 35 + 1);
async function panosNear(p: { x: number; y: number }): Promise<any[]> {
  const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), key = `${cx}/${cy}`;
  if (!cellCache.has(key)) cellCache.set(key, await listPanos({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL }, CELL_RADIUS));
  if (cellCache.size > 60) cellCache.delete(cellCache.keys().next().value!);
  return cellCache.get(key)!;
}

// ---- the two crop routes -------------------------------------------------------------------------------
type Made = { jpeg: Buffer; width: number; height: number; ppm: number; flags: CropFlags; method: 'wall' | 'strip'; picks: PanoPick[]; wallWidthM: number; wallHeightM: number; baseZ: number; groundSource: string };

function decodeFlags(jpegBuf: Buffer, alpha: Uint8Array, crop: { width: number; height: number; foliage: number; washedOut: number; missingFraction: number }, pick: { distM: number; obliquityDeg: number }): CropFlags {
  const d = jpeg.decode(jpegBuf, { useTArray: true });
  return { foliage: round(crop.foliage), washedOut: round(crop.washedOut), missing: round(crop.missingFraction), voidShare: round(voidShare(alpha, crop.width, crop.height)),
    occluderShare: round(occluderShare(d.data, alpha, crop.width, crop.height)), obliquity: round(pick.obliquityDeg, 1), cameraDistance: round(pick.distM, 1) };
}

async function wallCrop(fp: Footprint, wall: Wall, pick: PanoPick): Promise<Made | null> {
  const pano = await loadPano(pick);
  if (!pano) return null;
  const crop = rectifyWall(pano.img, pick, wall, fp.height, 50);
  if (!crop) return null;
  return { jpeg: crop.jpeg, width: crop.width, height: crop.height, ppm: round(crop.ppm, 1), flags: decodeFlags(crop.jpeg, crop.alpha, crop, pick), method: 'wall', picks: [pick],
    wallWidthM: round(crop.wallWidthM, 2), wallHeightM: round(crop.wallHeightM, 2), baseZ: round(crop.baseZ), groundSource: crop.groundSource };
}

/** planStrip route: plan the face's spans on one capture day, median-fuse up to 3 panoramas over the pand's span (+1 m each side), cut the span out. */
async function stripCrop(fp: Footprint, wall: Wall, face: WallRef[], panos: any[]): Promise<Made | 'no-pano' | null> {
  const near = face.filter(w => Math.hypot((w.a.x + w.b.x) / 2 - wall.mid.x, (w.a.y + w.b.y) / 2 - wall.mid.y) < 28);
  const spans: FrontSpan[] = near.map(w => ({ pandId: w.id, a: [w.a.x, w.a.y], b: [w.b.x, w.b.y], normal: [w.nx, w.ny] }));
  const records: PanoRecord[] = panos.map(p => { const r = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]); return { panoId: p.pano_id, timestamp: p.timestamp, rd: [r.x, r.y], record: p }; });
  const plan = planStrip(spans, records), mine = plan.spans[spans.findIndex(s => s.pandId === fp.id)];
  if (!mine?.panos.length) return 'no-pano';
  const MARGIN = 1, ppm = 40, h = wallHeight(fp.height), byId = new Map(records.map(r => [r.panoId, r.record as any]));
  const ux = (wall.b.x - wall.a.x) / wall.len, uy = (wall.b.y - wall.a.y) / wall.len;
  const start = { x: wall.a.x - ux * MARGIN, y: wall.a.y - uy * MARGIN }, end = { x: wall.b.x + ux * MARGIN, y: wall.b.y + uy * MARGIN };
  const grounds = mine.panos.map(c => { const l = lensFor(byId.get(c.panoId), undefined); const g = l ? l.pose.z - 2.44 : NaN; return g > -2.5 && g < 3 ? g : 0.4; }).sort((a, b) => a - b);
  const ground = grounds[grounds.length >> 1];
  const crops: Uint8ClampedArray[] = [], used: PanoPick[] = [];
  let dims = { width: 0, height: 0, ppm }, fused = 0;
  for (const c of mine.panos) {
    const rec = byId.get(c.panoId), pick = { panoId: c.panoId, timestamp: c.timestamp, record: rec, distM: c.distanceM, obliquityDeg: c.obliquityDeg } as unknown as PanoPick;
    const pano = await loadPano(pick); if (!pano) continue;
    const lens = lensFor(rec, ground); if (!lens) continue;
    const out = rectifyFacade(pano.img, { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 }, { start, end, baseZ: ground, topZ: ground + h }, { pixelsPerMetre: ppm, camera: AMSTERDAM_WORLD_ALIGNED, maxPixels: 1_800_000 });
    dims = { width: out.width, height: out.height, ppm: out.pixelsPerMetre }; crops.push(out.data); used.push(pick); fused++;
  }
  if (!fused) return null;
  const strip = medianFuse(crops, dims.width, dims.height);
  const cut = cutSpan(strip, dims.width, dims.height, spanPixels(0, wall.len, -MARGIN, dims.ppm));
  const alpha = new Uint8Array(cut.width * cut.height);
  let miss = 0; for (let i = 0; i < alpha.length; i++) { alpha[i] = cut.data[i * 4 + 3] === 255 ? 255 : 0; if (!alpha[i]) miss++; }
  const enc = jpeg.encode({ data: Buffer.from(cut.data.buffer), width: cut.width, height: cut.height }, 80);
  const best = [...used].sort((a, b) => a.obliquityDeg - b.obliquityDeg)[0];
  const flags: CropFlags = { foliage: round(foliageFraction(cut.data, cut.width, cut.height)), washedOut: round(washedOutFraction(cut.data, cut.width, cut.height)), missing: round(miss / alpha.length),
    voidShare: round(voidShare(alpha, cut.width, cut.height)), occluderShare: round(occluderShare(cut.data, alpha, cut.width, cut.height)), obliquity: round(best.obliquityDeg, 1), cameraDistance: round(best.distM, 1) };
  return { jpeg: enc.data, width: cut.width, height: cut.height, ppm: round(dims.ppm, 1), flags, method: 'strip', picks: used, wallWidthM: round(wall.len, 2), wallHeightM: round(h, 2), baseZ: round(ground), groundSource: `median of ${grounds.length} panoramas' camera height - 2.44 m` };
}

// ---- one pand --------------------------------------------------------------------------------------------
export function pickSecond(ranked: PanoPick[], first: PanoPick): PanoPick | null {
  const others = ranked.filter(c => day(c.timestamp) !== day(first.timestamp) && c.obliquityDeg <= 45);
  return others.sort((a, b) => Number(leafOff(b.timestamp)) - Number(leafOff(a.timestamp)) || a.obliquityDeg - b.obliquityDeg)[0] ?? null;
}
export const needsStrip = (wall: Wall, ranked: PanoPick[]) => wall.len < THRESHOLDS.narrowWallM || (ranked.length > 0 && ranked[0].obliquityDeg > 35);

async function processPand(fp: Footprint, wall: Wall, face: WallRef[], archiveRoot: string): Promise<Entry> {
  const panos = await panosNear(wall.mid), ranked = rankPanos(wall, panos);
  if (!ranked.length) return { status: 'no-pano', note: `no panorama 5-35 m from the wall within ${THRESHOLDS.obliquityDeg} deg (${panos.length} listed)` };
  let best: Made | null = null, attempts = 0;
  const route = needsStrip(wall, ranked) ? 'strip' : 'wall';
  const tries: Array<() => Promise<Made | 'no-pano' | null>> = route === 'strip'
    ? [() => stripCrop(fp, wall, face, panos)]
    : [() => wallCrop(fp, wall, ranked[0]), async () => { const second = pickSecond(ranked, ranked[0]); return second ? wallCrop(fp, wall, second) : null; }];
  for (const attempt of tries) {
    const made = await attempt(); attempts++;
    if (made === 'no-pano') return { status: 'no-pano', note: 'planStrip found no panorama for the span', method: 'strip' };
    if (made && (!best || penalty(made.flags) < penalty(best.flags))) best = made;
    if (best && usability(best.flags).usable) break;
  }
  if (!best) return { status: 'error', note: 'no panorama could be decoded or rectified', attempts };
  const u = usability(best.flags), id = idOf(fp.id), rel = `pand-crops/${id}`, dir = path.join(archiveRoot, rel);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'front.jpg'), best.jpeg);
  const date = best.picks[0].timestamp.slice(0, 10);
  await fs.writeFile(path.join(dir, 'front.json'), JSON.stringify({
    pandId: fp.id, method: best.method, panoramas: best.picks.map(p => ({ panoId: p.panoId, timestamp: p.timestamp, missionYear: p.missionYear, missionType: p.missionType, surface: p.surface, cameraDistM: round(p.distM, 1), obliquityDeg: round(p.obliquityDeg, 1), sourceUrl: `https://api.data.amsterdam.nl/panorama/panoramas/${p.panoId}/` })),
    missionDate: date, wall: { a: [round(wall.a.x, 2), round(wall.a.y, 2)], b: [round(wall.b.x, 2), round(wall.b.y, 2)], lenM: round(wall.len, 2), normal: [round(wall.nx, 3), round(wall.ny, 3)], roadDistM: round(wall.roadDistM, 1), crs: 'EPSG:28992' },
    crop: { width: best.width, height: best.height, pixelsPerMetre: best.ppm, wallWidthM: best.wallWidthM, wallHeightM: best.wallHeightM, groundNapM: best.baseZ, groundSource: best.groundSource, tileHeightM: round(fp.height, 1) },
    flags: best.flags, usable: u.usable, rejectedBecause: u.reasons, thresholds: THRESHOLDS, attempts, attribution: ATTRIBUTION, createdAt: new Date().toISOString(),
  }, null, 1) + '\n');
  return { status: 'ok', method: best.method, usable: u.usable, reasons: u.reasons, flags: best.flags, archive: rel, panoIds: best.picks.map(p => p.panoId), date, ppm: best.ppm, widthM: best.wallWidthM, attempts };
}

// ---- driver ----------------------------------------------------------------------------------------------
function estimate(n: number, cells: number, rateMs: number) {
  // lists: ~1.5 requests per cell (paged); panoramas: up to ~0.9 new downloads per wall pand, more for strips.
  const requests = Math.round(cells * 1.5 + n * 0.9);
  return { requests, networkMinutes: round(requests * rateMs / 60000, 1) };
}

async function main() {
  if (has('help') || has('h')) { console.log(HELP); return; }
  const key = arg('buurt');
  if (!key) { console.error('--buurt is required\n\n' + HELP); process.exit(2); }
  const buurt: Buurt = await loadBuurt(key);
  if (has('report')) { const { report } = await import('./report.ts'); await report(buurt.code, arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE); return; }
  const rateMs = Number(arg('rate-ms') ?? 500), dry = has('dry-run');
  const archiveRoot = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE;
  if (!archiveRoot && !dry) { console.error('--archive <source-data checkout> (or env HOUSE_CROPS_ARCHIVE) is required unless --dry-run'); process.exit(2); }
  http.minGapMs = rateMs; http.maxAttempts = 6; http.userAgent = USER_AGENT;

  let pands = await pandsInBuurt(buurt);
  console.log(`${buurt.code} ${buurt.name} (${buurt.gebied}): ${pands.length} BAG pands in the buurt`);
  const want = arg('pand') && `NL.IMBAG.Pand.${idOf(arg('pand')!)}`;
  if (want && !pands.some(p => p.id === want)) throw new Error(`${want} is not in ${buurt.code}`);

  // Walls first (no network): the street-facing wall of every pand, then block faces for the strip route.
  const walls = new Map<string, Wall>(), noWall = new Map<string, string>();
  for (const fp of pands) {
    const { wall, note } = await pickWall(fp, await neighbourhood(centroid(fp.ring)));
    if (wall) walls.set(fp.id, wall); else noWall.set(fp.id, note);
  }
  const refs: WallRef[] = [...walls].map(([id, w]) => ({ id, a: w.a, b: w.b, nx: w.nx, ny: w.ny }));
  const faceOf = new Map<string, WallRef[]>();
  for (const g of groupFaces(refs)) for (const w of g) faceOf.set(w.id, g);
  const narrow = [...walls.values()].filter(w => w.len < THRESHOLDS.narrowWallM).length;
  const cells = new Set([...walls.values()].map(w => `${Math.floor(w.mid.x / CELL)}/${Math.floor(w.mid.y / CELL)}`)).size;
  console.log(`walls: ${walls.size} street-facing, ${noWall.size} with no exposed wall; ${narrow} narrow (< ${THRESHOLDS.narrowWallM} m, strip route); ${cells} panorama-list cells`);
  const est = estimate(walls.size, cells, rateMs);
  console.log(`estimate: ~${est.requests} requests, ~${est.networkMinutes} min of paced network at ${rateMs} ms (plus ~1-2 s decode/rectify per pand)`);
  if (dry) return;

  const root = path.resolve(archiveRoot!);
  const prior = await readManifest(buurt.code);
  if (prior && !has('resume') && !has('restart')) { console.error(`${manifestPath(buurt.code)} exists: pass --resume to continue or --restart to start over`); process.exit(2); }
  const manifest: Manifest = prior && has('resume') ? prior : { version: 1, buurt: { code: buurt.code, cbsCode: buurt.cbsCode, name: buurt.name, gebied: buurt.gebied }, archive: 'pand-crops', thresholds: THRESHOLDS, createdAt: new Date().toISOString(), sessions: [], pands: {} };
  manifest.thresholds = THRESHOLDS;
  const session: Session = { startedAt: new Date().toISOString(), wallSeconds: 0, requests: 0, bytes: 0, retries: 0, status429: 0, status5xx: 0, failures: 0, pands: 0, rateMs };
  manifest.sessions.push(session);
  const t0 = Date.now(), snap = () => { Object.assign(session, { wallSeconds: Math.round((Date.now() - t0) / 1000), requests: http.requests, bytes: http.bytes, retries: http.retries, status429: http.status429, status5xx: http.status5xx, failures: http.failures, endedAt: new Date().toISOString() }); };
  let stop = false; process.on('SIGINT', () => { stop = true; console.log('\nstopping after this pand...'); });
  const limit = Number(arg('limit') ?? Infinity);

  // Work in spatial order so consecutive pands share panoramas (the decoded-panorama LRU holds two).
  const order = pands.filter(fp => !want || fp.id === want).sort((a, b) => { const p = centroid(a.ring), q = centroid(b.ring); return Math.floor(p.x / 90) - Math.floor(q.x / 90) || p.y - q.y; });
  for (const fp of order) {
    const id = idOf(fp.id);
    if (stop || session.pands >= limit) break;
    const prev = manifest.pands[id];
    if (has('resume') && prev && prev.status !== 'error') continue;
    // A kill between the archive write and the manifest write: rebuild the entry from the archived JSON, repeat nothing.
    const onDisk = await fs.readFile(path.join(root, 'pand-crops', id, 'front.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (has('resume') && onDisk && !prev) {
      manifest.pands[id] = { status: 'ok', method: onDisk.method, usable: onDisk.usable, reasons: onDisk.rejectedBecause, flags: onDisk.flags, archive: `pand-crops/${id}`, panoIds: onDisk.panoramas.map((p: any) => p.panoId), date: onDisk.missionDate, ppm: onDisk.crop.pixelsPerMetre, widthM: onDisk.crop.wallWidthM, attempts: onDisk.attempts };
      continue;
    }
    const wall = walls.get(fp.id);
    try {
      manifest.pands[id] = wall ? await processPand(fp, wall, faceOf.get(fp.id) ?? [], root) : { status: 'no-wall', note: noWall.get(fp.id) };
    } catch (e: any) {
      manifest.pands[id] = { status: 'error', note: String(e?.message ?? e).slice(0, 200) };
    }
    session.pands++; snap(); await writeManifest(manifest);
    const e = manifest.pands[id];
    console.log(`${String(session.pands).padStart(4)} ${id.slice(-8)} ${e.status}${e.status === 'ok' ? ` ${e.method} ${e.usable ? 'usable' : 'rejected:' + e.reasons!.join('+')} ${e.flags!.foliage}f ${e.flags!.voidShare}v` : e.note ? ' ' + e.note : ''} [${http.requests} req, ${http.status429} x429]`);
  }
  snap(); await writeManifest(manifest);
  const { report } = await import('./report.ts');
  await report(buurt.code, root);
}

if (process.argv[1]?.endsWith('house-crops/crops.ts')) await main();
