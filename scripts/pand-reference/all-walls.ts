/**
 * One street-level reference per exposed wall of a pand (the stock run.ts keeps only the front).
 *
 *   npx tsx scripts/pand-reference/all-walls.ts --pand=0363100012186086 [--min-len=14] [--max=8] [--out=staging/pand-reference-walls]
 *
 * For each exposed (non-party) wall >= min-len metres: the best panorama within 35 m (same ranking as run.ts), a
 * rectified straight-on crop and an aimed thumbnail, written to <out>/<pand>/w<NN>-<bearing>.{jpg,thumb.jpg} and
 * <out>/<pand>/walls.json (bearing, length, centre, panorama id, date, camera distance, obliquity). Panoramas:
 * Gemeente Amsterdam, CC BY 4.0. Cached in .cache/pand-reference.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { findPands, neighbourhood, normId, rdToLngLat } from './core.ts';
import { exposedWalls, listPanos, rankPanos } from './select.ts';
import { loadPano, rectifyWall, aimedThumbnail } from './rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const pand = normId(arg('pand')), minLen = Number(arg('min-len', '14')), max = Number(arg('max', '8'));
const out = path.resolve(arg('out', 'staging/pand-reference-walls'), pand.replace('NL.IMBAG.Pand.', ''));
await fs.mkdir(out, { recursive: true });
const fp = (await findPands([pand])).get(pand);
if (!fp) throw new Error(`pand not in building tiles: ${pand}`);
const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
const walls = exposedWalls(fp, await neighbourhood(centre)).filter(w => w.len >= minLen).sort((a, b) => b.len - a.len).slice(0, max);
const rows: any[] = [];
let i = 0;
for (const w of walls) {
  const bearing = Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
  const tag = `w${String(++i).padStart(2, '0')}-${bearing}`;
  const ranked = rankPanos(w, await listPanos(w.mid));
  const pick = ranked[0];
  const [lng, lat] = rdToLngLat(w.mid);
  const row: any = { tag, bearing, lengthM: Math.round(w.len * 10) / 10, centre: [lng, lat], height: fp.height, candidates: ranked.length };
  if (pick) {
    const pano = await loadPano(pick);
    const crop = pano ? rectifyWall(pano.img, pick, w, fp.height, 50) : null;
    if (crop) await fs.writeFile(path.join(out, `${tag}.jpg`), crop.jpeg);
    const thumb = await aimedThumbnail(pick, w, fp.height);
    if (thumb) await fs.writeFile(path.join(out, `${tag}.thumb.jpg`), thumb.jpeg);
    Object.assign(row, { panoId: pick.panoId, capturedAt: pick.timestamp.slice(0, 10), cameraDistM: Math.round(pick.distM * 10) / 10, obliquityDeg: Math.round(pick.obliquityDeg * 10) / 10, crop: !!crop, thumb: thumb?.url, washedOut: crop?.washedOut });
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
await fs.writeFile(path.join(out, 'walls.json'), JSON.stringify({ pand, licence: 'Gemeente Amsterdam panorama, CC BY 4.0', walls: rows }, null, 1));
