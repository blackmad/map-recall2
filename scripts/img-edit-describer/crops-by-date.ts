/**
 * Image-edit describer pilot (lane img-edit-describer-20261115): one rectified crop of the same front per capture date.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference \
 *   node --import tsx scripts/img-edit-describer/crops-by-date.ts --ids=0363...,0363... --out=<dir> [--max-dates=6] [--span=14]
 *
 * Per pand: the street wall (`pickWall`), cut to a window of at most `--span` metres around its middle so every date
 * frames exactly the same piece of wall; then the straightest panorama per capture day (`rankPanos`), rectified at
 * 40 px/m. Writes <out>/<pandId>/<date>.jpg and <out>/<pandId>/meta.json (date, month, leaf-off, foliage, missing,
 * obliquity, distance, panorama id). Panoramas this run downloads are purged afterwards (house:crops disk rule);
 * panoramas already in the shared cache are left alone.
 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { findPands, neighbourhood, http, purgeFiles, CACHE_DIR } from '../pand-reference/core.ts';
import { pickWall, listPanos, rankPanos, type Wall, type PanoPick } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ids = arg('ids').split(',').filter(Boolean);
const out = path.resolve(arg('out', 'artifacts/img-edit-describer/crops'));
const maxDates = Number(arg('max-dates', '6')), span = Number(arg('span', '14')), ppm = 40;
http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
http.minGapMs = 500;

function subWall(w: Wall, len: number): Wall {
  if (w.len <= len) return w;
  const ux = (w.b.x - w.a.x) / w.len, uy = (w.b.y - w.a.y) / w.len, h = len / 2;
  const a = { x: w.mid.x - ux * h, y: w.mid.y - uy * h }, b = { x: w.mid.x + ux * h, y: w.mid.y + uy * h };
  return { ...w, a, b, len };
}
const leafOff = (month: number) => month >= 11 || month <= 3;

const downloaded = new Set<string>();
async function main() {
  const fps = await findPands(ids);
  for (const raw of ids) {
    const id = raw.replace('NL.IMBAG.Pand.', ''), fp = fps.get(`NL.IMBAG.Pand.${id}`);
    if (!fp) { console.log(id, 'not found'); continue; }
    const dir = path.join(out, id);
    if (fss.existsSync(path.join(dir, 'meta.json'))) { console.log(id, 'done already'); continue; }
    const c = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
    const { wall } = await pickWall(fp, await neighbourhood(c));
    if (!wall) { console.log(id, 'no wall'); continue; }
    const w = subWall(wall, span);
    const ranked = rankPanos(w, await listPanos(w.mid, 40));
    const byDate = new Map<string, PanoPick>();
    for (const p of ranked) { const d = String(p.timestamp).slice(0, 10); if (!byDate.has(d)) byDate.set(d, p); }
    // Up to half the dates leaf-off (Nov-Mar, the ground-truth candidates) and half leaf-on, newest first within each.
    const all = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const off = all.filter(([d]) => leafOff(Number(d.slice(5, 7)))), on = all.filter(([d]) => !leafOff(Number(d.slice(5, 7))));
    const half = Math.ceil(maxDates / 2);
    const picks = [...off.slice(0, Math.max(half, maxDates - on.length)), ...on.slice(0, Math.max(half, maxDates - off.length))].slice(0, maxDates);
    await fs.mkdir(dir, { recursive: true });
    const meta: any = { pandId: id, wallLenM: wall.len, spanM: w.len, tileHeightM: fp.height, dates: [] };
    for (const [date, pick] of picks) {
      for (const k of ['equirectangular_full', 'equirectangular_medium']) {
        const href = pick.record._links?.[k]?.href; if (!href) continue;
        const f = path.join(CACHE_DIR, crypto.createHash('sha1').update(href).digest('hex') + '.jpg');
        if (!fss.existsSync(f)) downloaded.add(f);
        break;
      }
      const pano = await loadPano(pick);
      if (!pano) { meta.dates.push({ date, error: 'no pano' }); continue; }
      const crop = rectifyWall(pano.img, pick, w, fp.height, ppm);
      if (!crop) { meta.dates.push({ date, error: 'no lens' }); continue; }
      await fs.writeFile(path.join(dir, `${date}.jpg`), crop.jpeg);
      meta.dates.push({ date, month: Number(date.slice(5, 7)), leafOff: leafOff(Number(date.slice(5, 7))), panoId: pick.panoId, foliage: +crop.foliage.toFixed(3), missing: +crop.missingFraction.toFixed(3), obliquityDeg: +pick.obliquityDeg.toFixed(1), distM: +pick.distM.toFixed(1), width: crop.width, height: crop.height, ppm: crop.ppm });
    }
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
    console.log(id, meta.dates.map((d: any) => `${d.date}${d.leafOff ? '*' : ''} f${d.foliage}`).join('  '));
  }
  const p = await purgeFiles(downloaded);
  console.log(`requests ${http.requests}, ${(http.bytes / 1e6).toFixed(0)} MB; purged ${p.files} new panoramas (${(p.bytes / 1e6).toFixed(0)} MB)`);
}
main().catch(e => { console.error(e); process.exit(1); });
