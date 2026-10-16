/**
 * Photo triage sheets for the landmark abutter survey (open data only).
 *
 *   tsx scripts/landmarks/abutter-photos.ts [--top=25] [--gate] [--churches=3] [model-id ...]
 *
 * Picks candidates from scripts/landmarks/landmark-abutters-report.json: the top N by score, every notch
 * candidate at or above the gate score (--gate), and the best K per church/chapel/synagogue/mosque/temple.
 * For each: a PDOK luchtfoto crop (Actueel_ortho25, CC BY 4.0) with the model hull (cyan), the candidate
 * (red) and the other candidates (yellow) drawn on it, and two aimed views from the nearest Amsterdam
 * panoramas (api.data.amsterdam.nl/panorama, CC BY 4.0). Writes artifacts/landmark-abutters/<model>.jpg,
 * per-candidate crops under artifacts/landmark-abutters/crops/ and artifacts/landmark-abutters/evidence.json.
 * Downloads are cached in .cache/pand-reference (shared with pand-reference).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT, readJson, indexAround, byIdIndex} from '../lib/placedFootprints';
import {landmarkModels} from '../lib/landmarkAbutterCandidates';
import {cachedBytes, cachedJson} from '../pand-reference/core';
import {lngLatToRd} from '../../src/canalRecall/rdCoordinates';
import {NOTCH_GATE_SCORE} from '../../src/canalRecall/landmarks/landmarkAbutters';
import type {LngLat, Ring} from '../../src/canalRecall/landmarks/osmUnderModels';

const OUT = `${ROOT}/artifacts/landmark-abutters`;
const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--'));
const num = (k: string, d: number) => Number(args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const top = num('top', 25), perChurch = num('churches', 3), useGate = args.includes('--gate');
const RELIGIOUS = /kerk|church|kapel|chapel|synagog|moskee|mosque|temple|begijnhof|westermoskee/i;

type Cand = {id: string; score: number; categories: string[]; centre: LngLat; pands: string[]; year: number | null; terms: string[]};
type ModelRow = {model: string; name: string; candidates: Cand[]};
const report = readJson(`${ROOT}/scripts/landmarks/landmark-abutters-report.json`) as {models: ModelRow[]};

const picked = new Map<string, Set<string>>();
const pick = (m: string, id: string) => { if (!picked.has(m)) picked.set(m, new Set()); picked.get(m)!.add(id); };
const flat = report.models.flatMap(m => m.candidates.map(c => ({m, c})));
if (only.length) for (const m of report.models.filter(m => only.includes(m.model))) m.candidates.filter(c => c.score >= 2).forEach(c => pick(m.model, c.id));
else {
  flat.sort((a, b) => b.c.score - a.c.score).slice(0, top).forEach(({m, c}) => pick(m.model, c.id));
  if (useGate) flat.filter(({c}) => c.categories.includes('notch') && c.score >= NOTCH_GATE_SCORE).forEach(({m, c}) => pick(m.model, c.id));
  for (const m of report.models.filter(m => RELIGIOUS.test(`${m.model} ${m.name}`))) m.candidates.filter(c => c.score >= 4).slice(0, perChurch).forEach(c => pick(m.model, c.id));
}

const mPerDegLat = 111_320;
const metres = (a: LngLat, b: LngLat) => Math.hypot((b[0] - a[0]) * mPerDegLat * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * mPerDegLat);
const bearing = (from: LngLat, to: LngLat) => (Math.atan2((to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180), to[1] - from[1]) * 180 / Math.PI + 360) % 360;

async function panos(c: LngLat, radius: number): Promise<any[]> {
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${c[0].toFixed(6)},${c[1].toFixed(6)}&radius=${radius}&srid=4326&page_size=500`;
  const json: any = await cachedJson(url);
  return json._embedded?.panoramas ?? [];
}

/** Two views: the nearest recent panorama, and a second one at least 12 m from it (another angle). */
async function views(c: LngLat, sizeM: number) {
  let list: any[] = [];
  for (const r of [30, 55, 90]) { list = await panos(c, r); if (list.length) break; }
  const scored = list.map(p => { const at = p.geometry.coordinates as LngLat, d = metres(c, at), year = Number(p.mission_year ?? String(p.timestamp).slice(0, 4)); return {p, at, d, year, rank: d - Math.min(6, Math.max(0, year - 2016)) * 2}; })
    .filter(x => x.d >= 6).sort((a, b) => a.rank - b.rank);
  const first = scored[0], second = first ? scored.find(x => metres(x.at, first.at) >= 12) : undefined;
  const out: {panoId: string; year: number; distM: number; headingDeg: number; url: string; jpeg: Buffer}[] = [];
  for (const v of [first, second].filter(Boolean) as typeof scored) {
    const heading = Math.round(bearing(v.at, c)), fov = Math.round(Math.min(100, Math.max(45, 2 * Math.atan((sizeM / 2 + 6) / v.d) * 180 / Math.PI)));
    const pitch = Math.round(Math.min(25, Math.atan(6 / v.d) * 180 / Math.PI));
    const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${v.p.pano_id}/?width=800&aspect=1&fov=${fov}&heading=${heading}&pitch=${pitch}`;
    try { out.push({panoId: v.p.pano_id, year: v.year, distM: Math.round(v.d), headingDeg: heading, url, jpeg: await cachedBytes(url, '.jpg')}); } catch { /* missing thumbnail */ }
  }
  return out;
}

async function ortho(c: LngLat, halfM: number, rings: {ring: Ring; colour: string; width: number}[], px = 420) {
  const {x, y} = (() => { const [rx, ry] = lngLatToRd(c[0], c[1]); return {x: rx, y: ry}; })();
  const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
  url.search = new URLSearchParams({SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_ortho25', STYLES: '', CRS: 'EPSG:28992', BBOX: `${x - halfM},${y - halfM},${x + halfM},${y + halfM}`, WIDTH: String(px), HEIGHT: String(px), FORMAT: 'image/jpeg'}).toString();
  const bytes = await cachedBytes(url.toString(), '.jpg');
  const toPx = ([lng, lat]: LngLat) => { const [rx, ry] = lngLatToRd(lng, lat); return [((rx - (x - halfM)) / (2 * halfM)) * px, ((y + halfM - ry) / (2 * halfM)) * px]; };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}">${rings.map(r => `<polygon points="${r.ring.map(p => toPx(p).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${r.colour}" stroke-width="${r.width}"/>`).join('')}</svg>`;
  return {url: url.toString(), jpeg: await sharp(bytes).composite([{input: Buffer.from(svg)}]).jpeg({quality: 82}).toBuffer()};
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (text: string[], w: number, h: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111"/>${text.map((t, i) => `<text x="8" y="${18 + i * 17}" font-family="Helvetica" font-size="${i ? 13 : 15}" fill="${i ? '#ccc' : '#fff'}">${esc(t)}</text>`).join('')}</svg>`);

async function main() {
  fs.mkdirSync(`${OUT}/crops`, {recursive: true});
  const evidenceFile = `${OUT}/evidence.json`;
  const evidence: Record<string, Record<string, unknown>> = fs.existsSync(evidenceFile) ? readJson(evidenceFile) : {};
  const {models} = await landmarkModels([...picked.keys()]);
  const T = 360;
  for (const model of models) {
    const row = report.models.find(m => m.model === model.id)!;
    const ids = [...picked.get(model.id)!];
    indexAround(model.centre);
    const tiles = row.candidates.map(c => byIdIndex.get(c.id)).filter(Boolean);
    const rows: Buffer[] = [];
    for (const id of ids) {
      const c = row.candidates.find(x => x.id === id)!, tile = byIdIndex.get(id);
      if (!tile) continue;
      const sizeM = Math.sqrt(Math.max(20, tile.rings.reduce((a, r) => a + r.length, 0) * 10));
      const rings = [{ring: model.hull, colour: '#00e5ff', width: 2}, ...tiles.filter(t => t!.id !== id).flatMap(t => t!.rings.map(ring => ({ring, colour: '#ffd400', width: 1}))), ...tile.rings.map(ring => ({ring, colour: '#ff2a2a', width: 3}))];
      const o = await ortho(c.centre, 40, rings);
      const v = await views(c.centre, sizeM);
      const slug = `${model.id}__${id.replace(/[^\w]/g, '_')}`;
      fs.writeFileSync(`${OUT}/crops/${slug}__ortho.jpg`, o.jpeg);
      v.forEach((x, i) => fs.writeFileSync(`${OUT}/crops/${slug}__pano${i + 1}.jpg`, x.jpeg));
      (evidence[model.id] ??= {})[id] = {ortho: `artifacts/landmark-abutters/crops/${slug}__ortho.jpg`, panos: v.map((x, i) => ({panoId: x.panoId, year: x.year, distM: x.distM, headingDeg: x.headingDeg, url: x.url, crop: `artifacts/landmark-abutters/crops/${slug}__pano${i + 1}.jpg`}))};
      const tilesImg = [o.jpeg, ...v.map(x => x.jpeg)].slice(0, 3);
      const composite = await Promise.all(tilesImg.map(async (b, i) => ({input: await sharp(b).resize(T, T, {fit: 'cover'}).toBuffer(), left: i * T, top: 52})));
      composite.push({input: label([`${id}  score ${c.score}  [${c.categories.join(',')}]  pands ${c.pands.slice(0, 2).join(',')}  year ${c.year ?? '?'}`, `${c.terms.map(t => t.split(':')[0]).join(', ')}  |  ${v.map(x => `${x.panoId} ${x.year} ${x.distM}m h${x.headingDeg}`).join('  ')}`], 3 * T, 52), left: 0, top: 0} as never);
      rows.push(await sharp({create: {width: 3 * T, height: T + 52, channels: 3, background: '#222'}}).composite(composite).jpeg({quality: 80}).toBuffer());
      console.log(`${model.id} ${id}: ${v.length} pano views`);
    }
    if (!rows.length) continue;
    const head = label([`${row.name} (${model.id})`, 'ortho: cyan = model convex hull, red = candidate, yellow = other candidates; then two panorama views'], 3 * T, 44);
    const sheet = sharp({create: {width: 3 * T, height: 44 + rows.length * (T + 52), channels: 3, background: '#222'}})
      .composite([{input: head, left: 0, top: 0}, ...rows.map((r, i) => ({input: r, left: 0, top: 44 + i * (T + 52)}))]);
    await sheet.jpeg({quality: 78}).toFile(`${OUT}/${model.id}.jpg`);
  }
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 1) + '\n');
  console.log(`sheets for ${models.length} models, ${[...picked.values()].reduce((a, s) => a + s.size, 0)} candidates -> ${path.relative(ROOT, OUT)}`);
}
await main();
