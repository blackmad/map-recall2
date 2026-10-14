/**
 * One street-level reference per exposed wall of a pand (the stock run.ts keeps only the front).
 *
 *   npx tsx scripts/pand-reference/all-walls.ts --pand=0363100012186086 [--min-len=14] [--max=8] [--out=staging/pand-reference-walls] [--archive]
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
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { findPands, neighbourhood, normId, rdToLngLat } from './core.ts';
import { exposedWalls, listPanos, rankPanos } from './select.ts';
import { loadPano, rectifyWall, aimedThumbnail } from './rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const archive = process.argv.includes('--archive');
if (archive && !process.env.MAP_RECALL_SOURCE_DATA) throw new Error('--archive needs MAP_RECALL_SOURCE_DATA (the map-recall2-source-data checkout)');
const pand = normId(arg('pand')), minLen = Number(arg('min-len', '14')), max = Number(arg('max', '8'));
const root = archive ? path.join(process.env.MAP_RECALL_SOURCE_DATA!, 'pand-reference-walls') : arg('out', 'staging/pand-reference-walls');
const out = path.resolve(root, pand.replace('NL.IMBAG.Pand.', ''));
await fs.mkdir(out, { recursive: true });
const fp = (await findPands([pand])).get(pand);
if (!fp) throw new Error(`pand not in building tiles: ${pand}`);
const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
const walls = exposedWalls(fp, await neighbourhood(centre)).filter(w => w.len >= minLen).sort((a, b) => b.len - a.len).slice(0, max);
const rows: any[] = [];
const r2 = (v: number) => Math.round(v * 100) / 100, r4 = (v: number) => Math.round(v * 1e4) / 1e4;
let i = 0;
for (const w of walls) {
  const bearing = Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
  const tag = `w${String(++i).padStart(2, '0')}-${bearing}`;
  const ranked = rankPanos(w, await listPanos(w.mid));
  const [lng, lat] = rdToLngLat(w.mid);
  const base: any = { bearing, lengthM: Math.round(w.len * 10) / 10, centre: [lng, lat], height: fp.height, candidates: ranked.length,
    wallRD: { a: [r2(w.a.x), r2(w.a.y)], b: [r2(w.b.x), r2(w.b.y)], normal: [r4(w.nx), r4(w.ny)] } };
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
    const crop = pano ? rectifyWall(pano.img, pick, w, fp.height, 50) : null;
    if (crop) {
      await fs.writeFile(path.join(out, `${t}.jpg`), crop.jpeg);
      if (archive) await fs.writeFile(path.join(out, `${t}.mask.png`), await sharp(Buffer.from(crop.alpha), { raw: { width: crop.width, height: crop.height, channels: 1 } }).png({ compressionLevel: 9 }).toBuffer());
    }
    const thumb = await aimedThumbnail(pick, w, fp.height);
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
await fs.writeFile(path.join(out, 'walls.json'), JSON.stringify({ pand, licence: 'Gemeente Amsterdam panorama, CC BY 4.0', ...(archive ? { schema: 'pand-reference-walls/v2', minLenM: minLen, max } : {}), walls: rows }, null, 1));
