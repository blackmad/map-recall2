/**
 * House line station 4a: rectified, quality-flagged, resumable facade crops for every street-facing pand of one buurt.
 * See docs/house-line.md section 4a. `--help` prints HELP.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { http, neighbourhood, CACHE_DIR, panoTracker, purgeFiles, type Footprint } from '../pand-reference/core.ts';
import { listPanos, pickWall, rankPanos, options as selectOptions, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall, wallHeight, aimedThumbnail, panoSize, headroom } from '../pand-reference/rectify.ts';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { medianFuse, planStrip, type FrontSpan, type PanoRecord } from '../../src/canalRecall/blockFace/strip.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { defaultPick } from './f3/rank.ts';
import { bearingOf, secondBearings, isLeafOff } from './f3/bearings.ts';
import { loadBuurt, pandsInBuurt, centroid, type Buurt } from './buurt.ts';
import { RULES_VERSION, manifestPath, type Entry, type Manifest, type Session } from './manifest.ts';
import { measureCrop } from './measure.ts';
import { DISK_FLOOR_BYTES, diskGate, THRESHOLDS, usability, penalty, rayBlocked, spanPixels, cutSpan, groupFaces, type CropFlags, type WallRef } from './flags.ts';

export const HELP = `house:crops - rectified, quality-flagged facade crops for one buurt (house line station 4a)

  npm run house:crops -- --buurt <code|cbs|name> [--pand <id>] [--resume] [--dry-run] [--rate-ms 500]
                         [--archive <dir>] [--limit <n>] [--years <n>] [--all-years] [--offline] [--keep-panoramas] [--bearings] [--thumbs [--thumb-px 500]] [--cut-from <gate.json>] [--medium-pano] [--headroom 1.3] [--facing-first] [--restart] [--report] [--prefer-bearing <deg>] [--help]

  --buurt <key>     CBS buurt: 4-letter code (AB07), CBS code (BU0363AB07) or name (Bloemgrachtbuurt). Required.
  --pand <id,id>   process only these pands (16-digit BAG ids, with or without NL.IMBAG.Pand.); they must lie in the buurt.
  --rejudge         recompute usable/reasons for every manifest entry from its stored flags (no network); use after a THRESHOLDS-only change.
  --resume          continue from scripts/house-crops/manifests/<code>.json: pands with status ok / no-wall / no-pano are
                    skipped, status error is retried. Without --resume an existing manifest stops the run (see --restart).
  --restart         discard the existing manifest and start over (cached API responses are still reused, so this repeats no requests).
  --dry-run         list pands, walls, strategy and the estimated request count and wall time; no network, no writes.
  --rate-ms <ms>    minimum gap between the STARTS of two network requests (default 500; cache hits are free).
  --archive <dir>   root of the map-recall2-source-data checkout (or its worktree); crops go to <dir>/pand-crops/<pandId>/.
                    Default: env HOUSE_CROPS_ARCHIVE. Required unless --dry-run.
  --years <n>       best of up to n mission years per pand (default 6): the years are tried in order (clear straight view, leaf-off, newer) and
                    the first crop that passes every check wins; otherwise the best-scoring one is kept. --years 1 is the single-year baseline.
  --all-years       judge-picker mode: try every year, archive each crop as <pand>/years/<year>.jpg (pick.ts then judges and chooses).
  --keep-panoramas  keep the source panoramas in the cache; by default a finished run purges the panoramas it touched (the crops and their panorama ids are archived).
  --bearings        F3 (#381): also try, per mission year, a second panorama seen from another side of the wall normal (>= 10 deg apart, clear ray, leaf-off first); with --all-years they are archived as years/<year>-b.jpg. The default pick ignores them.
  --thumbs          F3 thumbnail phase: only the aimed thumbnail of each candidate panorama (about 35 KB each) is fetched; archives thumbs/*.jpg and front.json candidates, no front.jpg. Use with --all-years --bearings --years N.
  --cut-from <f>    F3 cut phase: <f> is f3/gate.ts's gate-*.json; rectifies only the gate's pick per pand (the one panorama fetch), keeping the thumbnail candidates in front.json as thumbCandidates.
  --medium-pano     read the 4000 px panorama (0.8 MB, about 40 px/m at 15 m) instead of the 8000 px one (2.8 MB).
  --headroom <f>    F3: crop height = f x the 3DBAG height + 1.5 m (1.3 puts the crown in the picture; default 1, the old crop).
  --facing-first    F3: among the walls on the nearest road, the one facing it most squarely wins (the longest only breaks ties).
  --offline         a panorama or list that is not in the cache is skipped, never downloaded (re-rectification costs no requests).
  --limit <n>       stop after n pands (smoke runs); the manifest stays resumable.
  --report          print the coverage table and write the contact sheet (artifacts/house-crops/<code>-sheet.png), no crops.
  --prefer-bearing <deg>  pick the street wall whose outward normal is within 50 deg of this bearing (pand-reference/select.ts
                    options.preferBearingDeg, as pand-reference/run.ts): a row on a square, whose front the road rule misses, e.g. 293 for
                    Nieuwmarkt 6-22 (lane H7); use it with --pand, it applies to every pand of the run.

Per pand: the street-facing BAG wall (pand-reference/select.ts pickWall) is rectified from the best panorama
(rankPanos, rectifyWall, 50 px/m); a wall under ${THRESHOLDS.narrowWallM} m, or a best view over 35 deg oblique, uses the block-face
planStrip route instead (one capture day, up to 3 panoramas median-fused, 40 px/m) and cuts the pand's span out of the strip.
The panorama is chosen per mission year (up to --years, 2016-2025): clear straight views first, then leaf-off months, then newer years;
front.json records the chosen year and every candidate tried.
Flags: foliage, washedOut, missing, voidShare, occluderShare (a dark-blob PROXY for vans/scaffold), obliquity, cameraDistance.
usable = voidShare <= ${THRESHOLDS.voidShare}, foliage <= ${THRESHOLDS.foliage}, washedOut <= ${THRESHOLDS.washedOut}, occluderShare <= ${THRESHOLDS.occluderShare},
obliquity <= ${THRESHOLDS.obliquityDeg} deg (35-${THRESHOLDS.fallbackObliquityDeg} is a fallback: made, not usable), camera ${THRESHOLDS.cameraDistanceM[0]}-${THRESHOLDS.cameraDistanceM[1]} m,
ray to the wall not through another footprint, wall >= ${THRESHOLDS.minWallM} m, height cover >= ${THRESHOLDS.minHeightCover}, edge density >= ${THRESHOLDS.minEdgeDensity},
(scripts/house-crops/flags.ts THRESHOLDS; seamStep is recorded, not gated). Foliage is measured after a1's white balance (stripWhiteBalance.ts).
A manifest of an older rules version cannot be --resumed: use --restart (cached responses, no repeated requests).
Panorama API: one request start per --rate-ms, exponential backoff on 429/5xx (Retry-After honoured), identifying User-Agent.
Disk rule: a run first checks free space and refuses to start if it would leave under 15 GB (exit 4); a finished run purges its source panoramas.
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

const r3 = (v: number) => round(v, 3);
/** All flags of one crop from its decoded pixels plus the pick's geometry. */
function flagsFor(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, pick: { distM: number; obliquityDeg: number }, o: { blocked: boolean; wallWidthM: number; strip: boolean; ppm?: number }): CropFlags {
  const m = measureCrop(rgba, alpha, width, height, o.ppm ?? (o.strip ? 40 : 50));
  return { foliage: r3(m.foliage), foliagePlain: r3(m.foliagePlain), wbApplied: m.wbApplied, washedOut: r3(m.washedOut), missing: r3(m.missing), voidShare: r3(m.voidShare), occluderShare: r3(m.occluderShare), maskedShare: r3(m.maskedShare), trunkShare: r3(m.trunkShare), vehicleShare: r3(m.vehicleShare),
    obliquity: round(pick.obliquityDeg, 1), cameraDistance: round(pick.distM, 1), rayBlocked: o.blocked, wallWidthM: round(o.wallWidthM, 2), heightCover: r3(m.heightCover), edgeDensity: r3(m.edgeDensity), seamStep: round(m.seamStep, 1), strip: o.strip };
}

async function wallCrop(fp: Footprint, wall: Wall, pick: PanoPick, blocked: boolean): Promise<Made | null> {
  const pano = await loadPano(pick);
  if (!pano) return null;
  const crop = rectifyWall(pano.img, pick, wall, fp.height, 50);
  if (!crop) return null;
  return { jpeg: crop.jpeg, width: crop.width, height: crop.height, ppm: round(crop.ppm, 1), flags: (() => { const d = jpeg.decode(crop.jpeg, { useTArray: true }); return flagsFor(d.data, crop.alpha, crop.width, crop.height, pick, { blocked, wallWidthM: wall.len, strip: false }); })(), method: 'wall', picks: [pick],
    wallWidthM: round(crop.wallWidthM, 2), wallHeightM: round(crop.wallHeightM, 2), baseZ: round(crop.baseZ), groundSource: crop.groundSource };
}

/** planStrip route: plan the face's spans on one capture day, median-fuse up to 3 panoramas over the pand's span (+1 m each side), cut the span out. */
async function stripCrop(fp: Footprint, wall: Wall, face: WallRef[], panos: any[], isBlocked: (p: any) => boolean): Promise<Made | 'no-pano' | null> {
  const near = face.filter(w => Math.hypot((w.a.x + w.b.x) / 2 - wall.mid.x, (w.a.y + w.b.y) / 2 - wall.mid.y) < 28);
  const spans: FrontSpan[] = near.map(w => ({ pandId: w.id, a: [w.a.x, w.a.y], b: [w.b.x, w.b.y], normal: [w.nx, w.ny] }));
  const records: PanoRecord[] = panos.filter(p => !isBlocked(p)).map(p => { const r = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]); return { panoId: p.pano_id, timestamp: p.timestamp, rd: [r.x, r.y], record: p }; });
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
  const flags = flagsFor(cut.data, alpha, cut.width, cut.height, best, { blocked: false, wallWidthM: wall.len, strip: true });
  return { jpeg: enc.data, width: cut.width, height: cut.height, ppm: round(dims.ppm, 1), flags, method: 'strip', picks: used, wallWidthM: round(wall.len, 2), wallHeightM: round(h, 2), baseZ: round(ground), groundSource: `median of ${grounds.length} panoramas' camera height - 2.44 m` };
}

// ---- one pand --------------------------------------------------------------------------------------------
export const needsStrip = (wall: Wall, pick: PanoPick) => wall.len < THRESHOLDS.narrowWallM || pick.obliquityDeg > THRESHOLDS.straightDeg;

/**
 * One representative panorama per mission year, in the order they are tried: clear straight views first, then leaf-off
 * months (Nov-Apr), then newer years; at most `maxYears`. Inside a year the best tier (clear ray, <= 35 deg), then leaf-off,
 * then rankPanos order decides.
 */
export function yearCandidates(ranked: PanoPick[], tier: (c: PanoPick) => number, maxYears: number): PanoPick[] {
  const byYear = new Map<number, PanoPick>();
  const order = ranked.map((c, i) => ({ c, i, t: tier(c) })).sort((x, y) => x.t - y.t || Number(leafOff(y.c.timestamp)) - Number(leafOff(x.c.timestamp)) || x.i - y.i);
  for (const { c } of order) if (!byYear.has(c.missionYear)) byYear.set(c.missionYear, c);
  return [...byYear.values()].sort((a, b) => tier(a) - tier(b) || Number(leafOff(b.timestamp)) - Number(leafOff(a.timestamp)) || b.missionYear - a.missionYear).slice(0, maxYears);
}

/** allYears (H4c --all-years): keep going after a usable crop and archive every year's crop as years/<year>.jpg for the judge picker; offline: a year whose panorama is not in the cache is skipped, not fetched. */
export const options = { maxYears: 6, allYears: false, offline: false, bearings: false, thumbs: false, thumbPx: 500, cutFrom: null as Record<string, { chosen: string | null; best: string | null }> | null };
type Tried = { second?: boolean; bearingDeg?: number; leafOff?: boolean; year: number; panoId: string; date: string; usable: boolean; reasons: string[]; method: 'wall' | 'strip'; obliquity: number; foliage: number; flags?: CropFlags; file?: string };


const secondsOf = (ranked: PanoPick[], years: PanoPick[], wall: Wall, tier: (c: PanoPick) => number): PanoPick[] => (options.bearings ? secondBearings(ranked, years, c => bearingOf(c, wall), tier) : []);

/**
 * F3 thumbnail phase: for every candidate panorama (best years + second bearings) fetch only the aimed perspective thumbnail (public
 * endpoint, ~35 KB at 500 px against 0.8-2.8 MB for the panorama), measure the same flags on it, archive it as thumbs/<year>[-b].jpg and
 * write front.json (candidates, no front.jpg). The gate (f3/gate.ts) ranks them; `--cut-from <gate.json>` then rectifies the one pick.
 */
async function thumbPand(fp: Footprint, wall: Wall, years: PanoPick[], seconds: PanoPick[], isBlocked: (rec: any) => boolean, ranked: PanoPick[], archiveRoot: string): Promise<Entry> {
  const id = idOf(fp.id), dir = path.join(archiveRoot, 'pand-crops', id), td = path.join(dir, 'thumbs'), tried: any[] = [];
  await fs.mkdir(td, { recursive: true });
  for (const pick of [...years, ...seconds]) {
    const isSecond = !years.includes(pick), t = await aimedThumbnail(pick, wall, fp.height, undefined, options.thumbPx).catch(() => null);
    if (!t) continue;
    const d = jpeg.decode(t.jpeg, { useTArray: true }), alpha = new Uint8Array(d.width * d.height).fill(255);
    const ppm = d.width / (2 * Math.max(pick.distM, 4) * Math.tan(t.fovDeg / 2 * Math.PI / 180));
    const flags = flagsFor(d.data, alpha, d.width, d.height, pick, { blocked: isBlocked(pick.record), wallWidthM: wall.len, strip: false, ppm });
    const u = usability(flags), file = `thumbs/${pick.missionYear}${isSecond ? '-b' : ''}.jpg`;
    await fs.writeFile(path.join(dir, file), t.jpeg);
    tried.push({ year: pick.missionYear, panoId: pick.panoId, panoIds: [pick.panoId], date: pick.timestamp.slice(0, 10), usable: u.usable, reasons: u.reasons, method: 'wall', obliquity: flags.obliquity, foliage: flags.foliage, flags, file, second: isSecond, bearingDeg: +bearingOf(pick, wall).toFixed(1), leafOff: isLeafOff(pick.timestamp), thumb: { fovDeg: t.fovDeg, headingDeg: t.headingDeg, px: d.width, ppm: +ppm.toFixed(1) } });
  }
  if (!tried.length) return { status: 'error', note: 'no thumbnail could be fetched' };
  const first = tried[0];
  await fs.writeFile(path.join(dir, 'front.json'), JSON.stringify({ pandId: fp.id, thumbOnly: true, wall: { a: [round(wall.a.x, 2), round(wall.a.y, 2)], b: [round(wall.b.x, 2), round(wall.b.y, 2)], lenM: round(wall.len, 2), normal: [round(wall.nx, 3), round(wall.ny, 3)], roadDistM: round(wall.roadDistM, 1), crs: 'EPSG:28992' }, candidates: tried, missionYearsAvailable: [...new Set(ranked.map(c => c.missionYear))].sort(), attribution: ATTRIBUTION, createdAt: new Date().toISOString() }, null, 1) + '\n');
  return { status: 'ok', method: 'wall', usable: first.usable, reasons: first.reasons, flags: first.flags, archive: `pand-crops/${id}`, panoIds: [first.panoId], date: first.date, attempts: tried.length, yearsTried: tried.length };
}

export async function processPand(fp: Footprint, wall: Wall, face: WallRef[], archiveRoot: string): Promise<Entry> {
  const panos = await panosNear(wall.mid);
  const others = (await neighbourhood(centroid(fp.ring))).filter(o => o.id !== fp.id).map(o => o.ring);
  const camRd = (rec: any) => lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
  const isBlocked = (rec: any) => rayBlocked(camRd(rec), wall.mid, [wall.nx, wall.ny], others);
  // Tiers: clear ray and <= 35 deg, clear and 35-55 (fallback), then blocked rays.
  const tier = (c: PanoPick) => (isBlocked(c.record) ? 2 : 0) + (c.obliquityDeg > THRESHOLDS.straightDeg ? 1 : 0);
  const ranked = rankPanos(wall, panos);
  if (!ranked.length) return { status: 'no-pano', note: `no panorama 5-35 m from the wall within ${THRESHOLDS.fallbackObliquityDeg} deg (${panos.length} listed)` };
  let years = yearCandidates(ranked, tier, options.maxYears);
  // F3 cut mode: the gate already chose a candidate on its thumbnail; rectify only that panorama (the one full-size fetch of the pand).
  const prior = options.cutFrom ? await fs.readFile(path.join(archiveRoot, 'pand-crops', idOf(fp.id), 'front.json'), 'utf8').then(JSON.parse).catch(() => null) : null;
  if (options.cutFrom) {
    const g = options.cutFrom[idOf(fp.id)], file = g?.chosen ?? g?.best, cands = (prior?.candidates as Tried[] | undefined) ?? [];
    // no candidate passed the hard flags (a narrow wall, a blocked ray): cut today's default pick anyway, as the pipeline always did, so the pand still has a (flagged) crop
    const cand = cands.find(t => t.file === file) ?? defaultPick(cands.filter(t => t.flags));
    const pick = cand && ranked.find(c => c.panoId === cand.panoId);
    if (!pick) return { status: 'no-pano', note: 'no gate pick to cut (no thumbnail candidate passed the hard flags)' };
    years = [pick];
  }
  let best: Made | null = null, attempts = 0, bestYear = 0;
  const tried: Tried[] = [];
  const better = (a: Made, b: Made) => { const ra = usability(a.flags).reasons.length, rb = usability(b.flags).reasons.length; return ra < rb || (ra === rb && penalty(a.flags) < penalty(b.flags)); };
  // Try the years in preference order and stop at the first crop that passes every check: extra panoramas are fetched only for fronts that need them.
  if (options.thumbs) return thumbPand(fp, wall, years, secondsOf(ranked, years, wall, tier), isBlocked, ranked, archiveRoot);
  // F3: with --bearings every year's representative is followed by the best other panorama of that year seen from another side of the wall normal (after all defaults, so the default order is unchanged).
  const seconds = options.bearings && !options.cutFrom ? secondBearings(ranked, years, c => bearingOf(c, wall), tier) : [];
  const secondIds = new Set(seconds.map(c => c.panoId));
  for (const pick of [...years, ...seconds]) {
    const isSecond = secondIds.has(pick.panoId) && !years.includes(pick);
    const strip = needsStrip(wall, pick);
    if (isSecond && strip) continue; // the strip route fuses the year's panoramas whatever the pick: a second bearing would repeat the crop
    const yearPanos = panos.filter(p => Number(p.mission_year ?? String(p.timestamp).slice(0, 4)) === pick.missionYear);
    let made: Made | 'no-pano' | null;
    try {
      made = strip ? await stripCrop(fp, wall, face, yearPanos, isBlocked) : await wallCrop(fp, wall, pick, isBlocked(pick.record));
      if (made === 'no-pano') made = await wallCrop(fp, wall, pick, isBlocked(pick.record));
    } catch (e) { if (options.offline) { attempts++; continue; } throw e; }
    attempts++;
    if (!made) continue;
    const u = usability(made.flags);
    const t: Tried = { year: pick.missionYear, panoId: made.picks[0].panoId, date: made.picks[0].timestamp.slice(0, 10), usable: u.usable, reasons: u.reasons, method: made.method, obliquity: made.flags.obliquity, foliage: made.flags.foliage, ...(options.bearings ? { second: isSecond, bearingDeg: +bearingOf(pick, wall).toFixed(1), leafOff: isLeafOff(pick.timestamp) } : {}) };
    if (options.allYears) {
      const yd = path.join(archiveRoot, 'pand-crops', idOf(fp.id), 'years'); await fs.mkdir(yd, { recursive: true });
      const fname = `${pick.missionYear}${isSecond ? '-b' : ''}.jpg`; t.file = `years/${fname}`; t.flags = made.flags; await fs.writeFile(path.join(yd, fname), made.jpeg);
      (t as any).panoIds = made.picks.map(p => p.panoId);
    }
    tried.push(t);
    if (!isSecond && (!best || better(made, best))) { best = made; bestYear = pick.missionYear; }
    if (u.usable && !options.allYears && !isSecond) break;
  }
  if (!best) return { status: 'error', note: 'no panorama could be decoded or rectified', attempts, yearsTried: attempts };
  const u = usability(best.flags), id = idOf(fp.id), rel = `pand-crops/${id}`, dir = path.join(archiveRoot, rel);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'front.jpg'), best.jpeg);
  const date = best.picks[0].timestamp.slice(0, 10);
  await fs.writeFile(path.join(dir, 'front.json'), JSON.stringify({
    pandId: fp.id, method: best.method, panoramas: best.picks.map(p => ({ panoId: p.panoId, timestamp: p.timestamp, missionYear: p.missionYear, missionType: p.missionType, surface: p.surface, cameraDistM: round(p.distM, 1), obliquityDeg: round(p.obliquityDeg, 1), sourceUrl: `https://api.data.amsterdam.nl/panorama/panoramas/${p.panoId}/` })),
    missionDate: date, chosenYear: bestYear, candidates: tried, missionYearsAvailable: [...new Set(ranked.map(c => c.missionYear))].sort(), wall: { a: [round(wall.a.x, 2), round(wall.a.y, 2)], b: [round(wall.b.x, 2), round(wall.b.y, 2)], lenM: round(wall.len, 2), normal: [round(wall.nx, 3), round(wall.ny, 3)], roadDistM: round(wall.roadDistM, 1), crs: 'EPSG:28992' },
    crop: { width: best.width, height: best.height, pixelsPerMetre: best.ppm, wallWidthM: best.wallWidthM, wallHeightM: best.wallHeightM, groundNapM: best.baseZ, groundSource: best.groundSource, tileHeightM: round(fp.height, 1) },
    flags: best.flags, usable: u.usable, rejectedBecause: u.reasons, thresholds: THRESHOLDS, attempts, attribution: ATTRIBUTION, createdAt: new Date().toISOString(),
  }, null, 1) + '\n');
  if (prior) { // keep the thumbnail candidates and say how the cut was chosen
    const fj = JSON.parse(await fs.readFile(path.join(dir, 'front.json'), 'utf8'));
    fj.thumbCandidates = prior.candidates; fj.f3 = { mode: 'thumb-gate-cut', gateFile: options.cutFrom?.[id]?.chosen ?? options.cutFrom?.[id]?.best ?? null, passedGate: !!options.cutFrom?.[id]?.chosen, panoSize: panoSize.prefer };
    await fs.writeFile(path.join(dir, 'front.json'), JSON.stringify(fj, null, 1) + '\n');
  }
  return { status: 'ok', method: best.method, usable: u.usable, reasons: u.reasons, flags: best.flags, archive: rel, panoIds: best.picks.map(p => p.panoId), date, ppm: best.ppm, widthM: best.wallWidthM, attempts, chosenYear: bestYear, yearsTried: tried.length };
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
  options.maxYears = Number(arg('years') ?? options.maxYears);
  if (arg('prefer-bearing') !== undefined) selectOptions.preferBearingDeg = Number(arg('prefer-bearing'));
  options.allYears = has('all-years'); options.bearings = has('bearings'); options.thumbs = has('thumbs'); if (arg('thumb-px')) options.thumbPx = Number(arg('thumb-px'));
  if (arg('headroom')) headroom.factor = Number(arg('headroom'));
  if (has('facing-first')) selectOptions.facingFirst = true;
  if (has('medium-pano')) panoSize.prefer = 'equirectangular_medium';
  if (arg('cut-from')) options.cutFrom = JSON.parse(await fs.readFile(arg('cut-from')!, 'utf8')); options.offline = has('offline'); http.offline = options.offline;
  const archiveRoot = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE;
  if (has('rejudge')) {
    const m = await readManifest(buurt.code); if (!m) throw new Error('no manifest');
    for (const [id, e] of Object.entries(m.pands)) if (e.status === 'ok') {
      const u = usability(e.flags!); e.usable = u.usable; e.reasons = u.reasons;
      const fj = path.join(archiveRoot ?? '', 'pand-crops', id, 'front.json');
      const j = archiveRoot ? await fs.readFile(fj, 'utf8').then(JSON.parse).catch(() => null) : null;
      if (j) { j.usable = u.usable; j.rejectedBecause = u.reasons; j.thresholds = THRESHOLDS; await fs.writeFile(fj, JSON.stringify(j, null, 1) + '\n'); }
    }
    m.thresholds = THRESHOLDS; await writeManifest(m); console.log('rejudged'); const { report } = await import('./report.ts'); await report(buurt.code, archiveRoot); return;
  }
  const rateMs = Number(arg('rate-ms') ?? 500), dry = has('dry-run');
  if (!archiveRoot && !dry) { console.error('--archive <source-data checkout> (or env HOUSE_CROPS_ARCHIVE) is required unless --dry-run'); process.exit(2); }
  http.minGapMs = rateMs; http.maxAttempts = 6; http.userAgent = USER_AGENT;

  let pands = await pandsInBuurt(buurt);
  console.log(`${buurt.code} ${buurt.name} (${buurt.gebied}): ${pands.length} BAG pands in the buurt`);
  const want = arg('pand') ? new Set(arg('pand')!.split(',').map(x => `NL.IMBAG.Pand.${idOf(x)}`)) : null;
  for (const w of want ?? []) if (!pands.some(p => p.id === w)) throw new Error(`${w} is not in ${buurt.code}`);

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
  // Disk rule: run df first and refuse to start a run that would leave less than 15 GB free.
  if (!options.offline) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const st = await fs.statfs(CACHE_DIR);
    const gate = diskGate(st.bavail * st.bsize, est.requests), GB = (b: number) => (b / 1024 ** 3).toFixed(1);
    console.log(`disk: ${GB(st.bavail * st.bsize)} GB free, run adds ~${GB(gate.estimatedBytes)} GB of panoramas, ${GB(gate.afterBytes)} GB would remain (floor ${GB(DISK_FLOOR_BYTES)} GB)`);
    if (!gate.ok) { console.error('refusing to start: this run would leave less than 15 GB free. Free space (purge old panoramas, prune worktrees) and re-run.'); process.exit(4); }
    if (!has('keep-panoramas')) panoTracker.touched = new Set();
  }

  const root = path.resolve(archiveRoot!);
  const prior = await readManifest(buurt.code);
  if (prior && !has('resume') && !has('restart')) { console.error(`${manifestPath(buurt.code)} exists: pass --resume to continue or --restart to start over`); process.exit(2); }
  if (prior && has('resume') && prior.rulesVersion !== RULES_VERSION) { console.error(`manifest rules version ${prior.rulesVersion ?? 1} != ${RULES_VERSION}: the usable rules changed, so old crops are stale; run with --restart (cached API responses make that repeat no requests)`); process.exit(2); }
  const manifest: Manifest = prior && has('resume') ? prior : { version: 1, rulesVersion: RULES_VERSION, buurt: { code: buurt.code, cbsCode: buurt.cbsCode, name: buurt.name, gebied: buurt.gebied }, archive: 'pand-crops', thresholds: THRESHOLDS, createdAt: new Date().toISOString(), sessions: [], pands: {} };
  manifest.thresholds = THRESHOLDS; manifest.rulesVersion = RULES_VERSION;
  const session: Session = { startedAt: new Date().toISOString(), wallSeconds: 0, requests: 0, bytes: 0, retries: 0, status429: 0, status5xx: 0, failures: 0, pands: 0, rateMs };
  manifest.sessions.push(session);
  const t0 = Date.now(), snap = () => { Object.assign(session, { wallSeconds: Math.round((Date.now() - t0) / 1000), requests: http.requests, bytes: http.bytes, retries: http.retries, status429: http.status429, status5xx: http.status5xx, failures: http.failures, endedAt: new Date().toISOString() }); };
  let stop = false; process.on('SIGINT', () => { stop = true; console.log('\nstopping after this pand...'); });
  const limit = Number(arg('limit') ?? Infinity);

  // Work in spatial order so consecutive pands share panoramas (the decoded-panorama LRU holds two).
  const order = pands.filter(fp => !want || want.has(fp.id)).sort((a, b) => { const p = centroid(a.ring), q = centroid(b.ring); return Math.floor(p.x / 90) - Math.floor(q.x / 90) || p.y - q.y; });
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
  // Disk rule: the crops and their panorama ids are the keepers; this run's source panoramas are purged once the buurt is rectified (not when stopped early: they are still needed to resume).
  if (panoTracker.touched && !stop && order.every(fp => manifest.pands[idOf(fp.id)])) { const r = await purgeFiles(panoTracker.touched); console.log(`purged ${r.files} source panoramas (${(r.bytes / 1024 ** 3).toFixed(2)} GB) from ${CACHE_DIR}; --keep-panoramas keeps them`); }
  if (options.thumbs) return; // no front.jpg yet: the contact sheet needs the cut phase
  const { report } = await import('./report.ts');
  await report(buurt.code, root);
}

if (process.argv[1]?.endsWith('house-crops/crops.ts')) await main();
