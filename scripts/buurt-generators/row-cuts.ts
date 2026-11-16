/**
 * Row cuts for the photo colour reader (buurt generators round 14, De Pijp): one rectified panorama cut per staged row,
 * its middle member outlined in cyan, named by that member's pand id, so scripts/centrum-looks/photo-reads.ts (`ask`,
 * then opus readers with scripts/centrum-looks/photo-reader-prompt.md, then `assemble`) reads the row's wall family
 * instead of a pixel sample (the pixel reads of Sarphatipark and Eerste Jacob van Campenstraat were winter shade and
 * glare: #2e2d2c beside #cdcecc on one row).
 *
 *   node --import tsx scripts/buurt-generators/row-cuts.ts --district=de-pijp --out=<cutDir> [--min-members=2] [--ppm=25]
 *
 * The panorama is the most recent one facing the row (5-25 m off the front line, its foot within the middle 60 %),
 * as artifacts/buurt-generators/tools/heldout2.mts picks; medium images are cached (data.amsterdam.nl, the repo URL as
 * contact). Writes <cutDir>/<pandId>.jpg and <cutDir>/rows.json ({pandId: rowId}).
 *
 *   --retry=<photo-reads.json>  only the rows whose read is under 0.7 (trees, glare, blur), cut from another capture
 *   date, leafless months (November-March) first; the generator keeps the more confident read.
 *   --members  (round 16) every member's cut, each outlined in turn on the row's one rectified panorama, so a painted or
 *   plastered house among brick neighbours is read (Eerste van der Helststraat 166938: a white plastered house drawn
 *   brick); members already read (--skip=<photo-reads.json>...) are left out. With --retry and --members, every member of
 *   a row whose read is under 0.7 is cut from another capture date.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { http, cachedBytes } from '../pand-reference/core.ts';
import { listPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'de-pijp', outDir = arg('out'), minMembers = Number(arg('min-members') ?? 2), ppm = Number(arg('ppm') ?? 25);
if (!outDir) { console.error('row-cuts --district=<d> --out=<cutDir>'); process.exit(2); }
const stage = `artifacts/buurt-generators/${district}`;
const retry = arg('retry') ? (JSON.parse(fs.readFileSync(arg('retry')!, 'utf8')).reads as Record<string, { confidence: number }>) : null;
const perMember = process.argv.includes('--members');
const skip = new Set(process.argv.filter(a => a.startsWith('--skip=')).flatMap(a => Object.keys(JSON.parse(fs.readFileSync(a.slice(7), 'utf8')).reads ?? {})));
const kit = new Map<string, [[number, number], [number, number]]>((JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).filter(r => r.buurtKit?.frontLine).map(r => [r.pandId, r.buurtKit.frontLine]));
const rows = (JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]).filter(r => r.members.length >= minMembers);
fs.mkdirSync(outDir, { recursive: true });
const index: Record<string, string> = fs.existsSync(path.join(outDir, 'rows.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'rows.json'), 'utf8')) : {};
let done = 0, none = 0, fail = 0;
for (const row of rows) {
  const ids: string[] = row.members.map((m: any) => m.pandId), mid = ids[ids.length >> 1];
  if (retry && !(perMember ? ids.some(i => retry[i] && retry[i].confidence < 0.7) : retry[mid] && retry[mid].confidence < 0.7)) continue;
  const targets = perMember ? ids.filter(i => !skip.has(i) && (!retry || (!!retry[i] && retry[i].confidence < 0.7))) : [mid];
  if (!targets.length || targets.every(i => fs.existsSync(path.join(outDir, `${i}.jpg`)))) { done += targets.length; continue; }
  const l0 = kit.get(ids[0]), l1 = kit.get(ids[ids.length - 1]);
  if (!l0 || !l1) { fail++; continue; }
  const A = lngLatToRd(l0[0]), B = lngLatToRd(l1[1]), len = Math.hypot(B.x - A.x, B.y - A.y);
  if (len < 4) { fail++; continue; }
  const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len, nx = uy, ny = -ux;
  const center = { x: (A.x + B.x) / 2 + nx * 12, y: (A.y + B.y) / 2 + ny * 12 };
  const panos = (await listPanos(center as any, Math.max(25, len / 2 + 10))).flatMap((p: any) => {
    const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]), t = (q.x - A.x) * ux + (q.y - A.y) * uy, d = (q.x - A.x) * nx + (q.y - A.y) * ny;
    return t > len * 0.2 && t < len * 0.8 && d >= 5 && d <= 25 && p._links?.equirectangular_medium?.href ? [p] : [];
  }).sort((a: any, b: any) => (b.timestamp > a.timestamp ? 1 : -1));
  const leafless = (p: any) => { const mo = Number(String(p.timestamp).slice(5, 7)); return mo >= 11 || mo <= 3; };
  const alt = retry ? panos.filter((p: any) => String(p.timestamp).slice(0, 10) !== String(panos[0].timestamp).slice(0, 10)).sort((a: any, b: any) => Number(leafless(b)) - Number(leafless(a)) || (b.timestamp > a.timestamp ? 1 : -1)) : panos;
  if (!alt.length) { none++; continue; }
  const record = alt[0];
  delete record._links.equirectangular_full;
  await cachedBytes(record._links.equirectangular_medium.href, '.jpg');
  const pick: PanoPick = { panoId: record.pano_id, timestamp: record.timestamp, missionYear: Number(record.mission_year), missionType: record.mission_type ?? '', surface: record.surface_type ?? '', distM: 0, obliquityDeg: 0, relaxed: false, record };
  const pano = await loadPano(pick);
  const lineM = Math.max(...row.series.map((s: any) => s.design.corniceTopM.value as number));
  const wall: Wall = { a: A, b: B, len, nx, ny, mid: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, roadDistM: 0, facing: 0 };
  const crop = pano && rectifyWall(pano.img, pick, wall, lineM + 2, ppm);
  if (!crop) { fail++; continue; }
  const s = crop.ppm, along = (p: { x: number; y: number }) => (p.x - A.x) * ux + (p.y - A.y) * uy;
  for (const id of targets) {
    const lm = kit.get(id);
    if (!lm) { fail++; continue; }
    const x0 = Math.max(1, Math.round(Math.min(along(lngLatToRd(lm[0])), along(lngLatToRd(lm[1]))) * s)), x1 = Math.min(crop.width - 2, Math.round(Math.max(along(lngLatToRd(lm[0])), along(lngLatToRd(lm[1]))) * s));
    const y0 = Math.max(1, Math.round(crop.height - lineM * s)), y1 = crop.height - 2;
    const box = Buffer.from(`<svg width="${crop.width}" height="${crop.height}" xmlns="http://www.w3.org/2000/svg"><rect x="${x0}" y="${y0}" width="${Math.max(4, x1 - x0)}" height="${Math.max(4, y1 - y0)}" fill="none" stroke="#00ffff" stroke-width="3"/></svg>`);
    await sharp(crop.jpeg).composite([{ input: box, left: 0, top: 0 }]).jpeg({ quality: 85 }).toFile(path.join(outDir, `${id}.jpg`));
    index[id] = row.id; done++;
  }
  if (done % 20 === 0) { fs.writeFileSync(path.join(outDir, 'rows.json'), JSON.stringify(index, null, 1)); console.log(`${done} cuts, ${none} without a facing panorama, ${fail} failed; ${http.requests} requests ${(http.bytes / 1e6).toFixed(0)} MB`); }
}
fs.writeFileSync(path.join(outDir, 'rows.json'), JSON.stringify(index, null, 1));
console.log(`${district}: ${done} cuts of ${rows.length} rows, ${none} without a facing panorama, ${fail} failed; ${http.requests} requests ${(http.bytes / 1e6).toFixed(0)} MB -> ${outDir}`);

