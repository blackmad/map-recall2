/**
 * One street-level reference per exposed wall of a pand (the stock run.ts keeps only the front).
 *
 *   npx tsx scripts/pand-reference/all-walls.ts --pand=0363100012186086 [--min-len=14] [--max=8] [--out=staging/pand-reference-walls] [--archive]
 *     [--date=2019,2022-05] [--exclude-date=2024-12-11] [--exclude-pano=<id>,...] [--segment=30] [--walls=1,4] [--suffix=d19] [--min-dist=5] [--max-dist=60] [--inset=0.6]
 *     [--max-height=60]
 *
 * For each exposed (non-party) wall >= min-len metres: the best panorama within 35 m (same ranking as run.ts), a
 * rectified straight-on crop and an aimed thumbnail, written to <out>/<pand>/w<NN>-<bearing>.{jpg,thumb.jpg} and
 * <out>/<pand>/walls.json (bearing, length, centre, panorama id, date, camera distance, obliquity). Panoramas:
 * Gemeente Amsterdam, CC BY 4.0. Cached in .cache/pand-reference (`PAND_REFERENCE_CACHE` overrides).
 *
 * `--archive` writes into `$MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/` instead (fails when the variable is
 * unset), adds `w<NN>-<bearing>.mask.png` (255 = sampled panorama pixel, 0 = missing) and records per crop what the
 * measurement needs to place it: wall endpoints and outward normal (RD), ppm, wall height, ground (baseZ), camera RD
 * position and heading, foliage / washed-out / missing fractions and the sha256 of the jpg. The crop's x runs from
 * `wallRD.a` (the viewer's left, facing the wall from outside) to `wallRD.b`; y runs down from `baseZ + wallHeightM`.
 *
 * Another capture day or a long wall (panoPick.ts): `--date=` keeps only panoramas whose timestamp starts with one of
 * the prefixes, `--exclude-date=` / `--exclude-pano=` drop them; `--segment=<m>` cuts walls longer than that into equal
 * pieces with a panorama each (tags `w01-67s1`, `s2`, ...); `--walls=` limits the run to those wall numbers (the NN of
 * the tag); `--suffix=` appends to every tag; `--min-dist=` lets a camera stand nearer than 5 m (a narrow street); `--max-dist=` lets it stand further than 35 m (a
 * front set back behind a lawn or a cycle park, the 1967 Rietveld building 45-55 m from Fred. Roeskestraat). Runs with any of `--segment`, `--walls`, `--suffix` merge into the
 * existing walls.json (rows of the same tag replaced, the rest kept); without them the output is as before.
 *
 * `--max-height=<m>` (4..120, default 32: every archived crop) raises the crop's height cap for a tower; the pixel
 * budget grows with it (rectify.ts `maxPixelsFor`, the resolution trade is in its header). Use it with `--suffix` so a
 * taller crop is merged beside the archived one instead of replacing it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { findPands, lngLatToRd, neighbourhood, normId, rdToLngLat } from './core.ts';
import { exposedWalls, FACADE_WINDOW, listPanos, rankPanos } from './select.ts';
import { loadPano, rectifyWall, aimedThumbnail, DEFAULT_MAX_WALL_HEIGHT_M } from './rectify.ts';
import { filterPanos, insetWall, mergeWallRows, parsePanoFilter, segmentTag, segmentWall } from '../../src/canalRecall/buildingRecipe/panoPick.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const archive = process.argv.includes('--archive');
if (archive && !process.env.MAP_RECALL_SOURCE_DATA) throw new Error('--archive needs MAP_RECALL_SOURCE_DATA (the map-recall2-source-data checkout)');
const pand = normId(arg('pand')), minLen = Number(arg('min-len', '14')), max = Number(arg('max', '8'));
const root = archive ? path.join(process.env.MAP_RECALL_SOURCE_DATA!, 'pand-reference-walls') : arg('out', 'staging/pand-reference-walls');
const out = path.resolve(root, pand.replace('NL.IMBAG.Pand.', ''));
await fs.mkdir(out, { recursive: true });
// `--footprint=w123`: walls from that tile feature instead (a pand the tiles draw as OSM parts; the crops still file
// under the pand). kit-sheets.ts passes the largest OSM part of a kit whose parts kit-pands.json joins to the pand.
// `--kit-pand`: the pand's own outline from public/data/extracts/amsterdam/kit-pands.json (a pand the tiles draw only as
// OSM parts, whose outlines are party walls of each other; build-kit-pands.ts writes it).
const footprintId = arg('footprint') || pand;
let fp = process.argv.includes('--kit-pand') ? null : (await findPands([footprintId])).get(/^[wr]\d+$/.test(footprintId) ? footprintId : normId(footprintId));
if (process.argv.includes('--kit-pand')) {
  const kitPand = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, '../../public/data/extracts/amsterdam/kit-pands.json'), 'utf8')).pands?.[pand.replace('NL.IMBAG.Pand.', '')];
  if (kitPand) fp = { id: pand, ring: kitPand.ring.map((p: [number, number]) => lngLatToRd(p)), height: kitPand.heightM };
}
if (!fp) throw new Error(`pand not in building tiles: ${footprintId}`);
const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
const walls = exposedWalls(fp, await neighbourhood(centre)).filter(w => w.len >= minLen).sort((a, b) => b.len - a.len).slice(0, max);
const panoFilter = parsePanoFilter(process.argv), segM = Number(arg('segment', '0')), suffix = arg('suffix');
const minDist = Number(arg('min-dist', '5')), maxDist = Number(arg('max-dist', '0'));
const onlyWalls = arg('walls').split(',').filter(Boolean).map(Number);
// `--inset=<m>`: cut the crop on a plane that many metres behind the footprint edge (a set-back front); needs --suffix
// and --walls so the shifted crop is merged beside the edge's own, never in its place.
const insetM = Number(arg('inset', '0'));
const maxHeightM = Number(arg('max-height', String(DEFAULT_MAX_WALL_HEIGHT_M)));
if (!(maxHeightM >= 4 && maxHeightM <= 120)) throw new Error('--max-height: 4..120 m');
if (insetM && (!suffix || !onlyWalls.length)) throw new Error('--inset needs --suffix and --walls');
if (!(insetM >= 0 && insetM <= 5)) throw new Error('--inset: 0..5 m');
const merging = segM > 0 || onlyWalls.length > 0 || suffix !== '';
if (maxHeightM !== DEFAULT_MAX_WALL_HEIGHT_M && !suffix) throw new Error('--max-height needs --suffix (the taller crop is merged beside the archived one)');
const rows: any[] = [], rerun: string[] = [];
const r2 = (v: number) => Math.round(v * 100) / 100, r4 = (v: number) => Math.round(v * 1e4) / 1e4;
let i = 0;
for (const whole of walls) {
  const bearing = Math.round((Math.atan2(whole.nx, whole.ny) * 180 / Math.PI + 360) % 360);
  const wallTag = `w${String(++i).padStart(2, '0')}-${bearing}`;
  if (onlyWalls.length && !onlyWalls.includes(i)) continue;
  rerun.push(wallTag);
  for (const w of segmentWall(insetWall(whole, insetM), segM)) {
  const tag = segmentTag(wallTag, w.segment, suffix);
  const ranked = filterPanos(rankPanos(w, await listPanos(w.mid, maxDist > 35 ? Math.ceil(maxDist) : 35), maxDist > 35 ? { ...FACADE_WINDOW, minD: minDist, maxD: maxDist } : minDist), panoFilter);
  const [lng, lat] = rdToLngLat(w.mid);
  const base: any = { bearing, lengthM: Math.round(w.len * 10) / 10, centre: [lng, lat], height: fp.height, candidates: ranked.length,
    wallRD: { a: [r2(w.a.x), r2(w.a.y)], b: [r2(w.b.x), r2(w.b.y)], normal: [r4(w.nx), r4(w.ny)] }, ...(insetM ? { insetM } : {}) };
  // --archive also keeps the best leaf-off panorama (November-March) when the best one is from the leaf season and
  // a leaf-off view is at most 15 degrees more oblique (tag suffix L): summer trees hide the lower storeys.
  const leafOff = (pk: any) => { const m = Number(pk.timestamp.slice(5, 7)); return m <= 3 || m >= 11; };
  const picks: [string, any][] = ranked[0] ? [[tag, ranked[0]]] : [];
  if (archive && ranked[0] && !leafOff(ranked[0])) {
    const alt = ranked.find(c => leafOff(c) && c.obliquityDeg <= ranked[0].obliquityDeg + 15 && !c.relaxed) ?? ranked.find(c => leafOff(c) && c.obliquityDeg <= ranked[0].obliquityDeg + 15);
    if (alt) picks.push([`${tag}L`, alt]);
  }
  if (!picks.length) rows.push({ tag, ...base });
  for (const [t, pick] of picks) {
    const row: any = { tag: t, ...base };
    const pano = await loadPano(pick);
    const crop = pano ? rectifyWall(pano.img, pick, w, fp.height, 50, undefined, maxHeightM) : null;
    if (crop) {
      await fs.writeFile(path.join(out, `${t}.jpg`), crop.jpeg);
      if (archive) await fs.writeFile(path.join(out, `${t}.mask.png`), await sharp(Buffer.from(crop.alpha), { raw: { width: crop.width, height: crop.height, channels: 1 } }).png({ compressionLevel: 9 }).toBuffer());
    }
    const thumb = await aimedThumbnail(pick, w, fp.height, maxHeightM);
    if (thumb) await fs.writeFile(path.join(out, `${t}.thumb.jpg`), thumb.jpeg);
    Object.assign(row, { panoId: pick.panoId, capturedAt: pick.timestamp.slice(0, 10), cameraDistM: Math.round(pick.distM * 10) / 10, obliquityDeg: Math.round(pick.obliquityDeg * 10) / 10, crop: !!crop, thumb: thumb?.url, washedOut: crop?.washedOut });
    if (crop) Object.assign(row, { ppm: crop.ppm, widthPx: crop.width, heightPx: crop.height, wallWidthM: r2(crop.wallWidthM), wallHeightM: r2(crop.wallHeightM), baseZ: r2(crop.baseZ), groundSource: crop.groundSource,
      foliage: r4(crop.foliage), missingFraction: r4(crop.missingFraction), washedOut: r4(crop.washedOut),
      cameraRD: [r2(crop.camera.x), r2(crop.camera.y), r2(crop.camera.z)], headingDeg: r2(crop.camera.headingDeg),
      sha256: crypto.createHash('sha256').update(crop.jpeg).digest('hex') });
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  }
}
const previous = merging ? await fs.readFile(path.join(out, 'walls.json'), 'utf8').then(t => JSON.parse(t).walls as any[], () => []) : [];
await fs.writeFile(path.join(out, 'walls.json'), JSON.stringify({ pand, licence: 'Gemeente Amsterdam panorama, CC BY 4.0', ...(archive ? { schema: 'pand-reference-walls/v2', minLenM: minLen, max } : {}), walls: merging ? mergeWallRows(previous, rows, rerun, suffix) : rows }, null, 1));
