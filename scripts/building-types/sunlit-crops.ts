/**
 * Sunlit re-shoots of surveyed terraces (issue #77): for each terrace representative, every municipal panorama in front of
 * the photographed side whose capture time puts the sun on that facade (sun azimuth within --max-off degrees of the front
 * bearing, elevation >= --min-el), cropped facing the front. Overcast days are not detectable from the timestamp, so the
 * sheet is for picking the crops that really are sunlit before measuring brick, render or tile colours from them.
 *
 *   node --import tsx scripts/building-types/sunlit-crops.ts --survey=staging/building-types/k-buurt-zuidwest-survey --terraces=12,15,36 [--per=3] [--tag=kz]
 *
 * Reads <survey>/terraces-r0/terraces.json (survey-terraces.ts: rep pand, centre, front bearing). Writes crops to
 * .cache/building-types/sunlit/<pand>-<yyyymmddhh>.jpg and a contact sheet .cache/building-types/sunlit/<tag>-sheet.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {solarPosition} from './solar.ts';
import {lngLatToLocal, bearingDeg, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const survey = arg('survey'), want = arg('terraces') ? new Set(arg('terraces').split(',').map(Number)) : null;
const PER = Number(arg('per', '3')), MAX_OFF = Number(arg('max-off', '70')), MIN_EL = Number(arg('min-el', '12')), SCRATCH = '.cache/building-types';
if (!survey) throw new Error('--survey=<dir> required');
const t = JSON.parse(fs.readFileSync(path.join(survey, 'terraces-r0/terraces.json'), 'utf8')) as {anchor: Anchor; terraces: any[]};
const angleOff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

async function bytes(url: string, file: string): Promise<Buffer> {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!r.ok) throw new Error(String(r.status));
      const b = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, b);
      return b;
    } catch (e) { if (attempt >= 3) throw new Error(`${url}: ${(e as Error).message}`); await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
  }
}

const tiles: {img: Buffer; text: string}[] = [];
for (const tr of t.terraces) {
  if (!tr?.shot || (want && !want.has(tr.terrace))) continue;
  const front = tr.shot.frontBearing as number, rad = front * Math.PI / 180, n: Pt = [Math.sin(rad), -Math.cos(rad)];
  const c = lngLatToLocal(t.anchor, tr.centreLngLat[0], tr.centreLngLat[1]), mid: Pt = [c[0] + n[0] * 5, c[1] + n[1] * 5];
  // The listing near the survey camera's side of the street (cached apart from the survey listing: a wider radius, every year).
  const at: Pt = [mid[0] + n[0] * 14, mid[1] + n[1] * 14];
  const [lng, lat] = [t.anchor.lng + at[0] / (111320 * Math.cos(t.anchor.lat * Math.PI / 180)), t.anchor.lat - at[1] / 110540];
  const listing = JSON.parse((await bytes(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=35&page_size=250`, `${SCRATCH}/pano-list/sunlit-${tr.rep}.json`)).toString());
  const cands = (listing._embedded?.panoramas ?? []).map((p: any) => {
    const pc = lngLatToLocal(t.anchor, p.geometry.coordinates[0], p.geometry.coordinates[1]), dx = pc[0] - mid[0], dz = pc[1] - mid[1];
    const depth = dx * n[0] + dz * n[1], lateral = Math.abs(dx * n[1] - dz * n[0]);
    const [az, el] = solarPosition(new Date(p.timestamp), p.geometry.coordinates[1], p.geometry.coordinates[0]);
    return {p, pc, depth, lateral, az, el, off: angleOff(az, front)};
  }).filter((x: any) => x.depth > 5 && x.depth < 30 && x.lateral < 12 && x.el >= MIN_EL && x.off <= MAX_OFF)
    .sort((a: any, b: any) => a.off + a.lateral * 2 - (b.off + b.lateral * 2));
  // One panorama per capture day.
  const days = new Set<string>(), picked = cands.filter((x: any) => { const d = String(x.p.timestamp).slice(0, 10); if (days.has(d)) return false; days.add(d); return true; }).slice(0, PER);
  for (const x of picked) {
    const dist = Math.hypot(x.pc[0] - mid[0], x.pc[1] - mid[1]), heading = bearingDeg(mid[0] - x.pc[0], mid[1] - x.pc[1]);
    const file = `${SCRATCH}/sunlit/${tr.rep}-${String(x.p.timestamp).slice(0, 13).replace(/[-T]/g, '')}.jpg`;
    if (!fs.existsSync(file)) {
      const pano = await bytes(x.p._links.equirectangular_medium.href, `${SCRATCH}/pano/${x.p.pano_id}.jpg`);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, perspectiveCrop(pano, heading, 1000, 750, Math.min(100, Math.max(60, 2 * Math.atan(9 / dist) * 180 / Math.PI)), Math.atan(2.5 / dist) * 180 / Math.PI));
    }
    const text = `#${tr.terrace} ${tr.rep.slice(-7)} ${String(x.p.timestamp).slice(0, 16)} sun ${Math.round(x.az)}/${Math.round(x.el)} off ${Math.round(x.off)}`;
    console.log(file, text);
    tiles.push({img: await sharp(file).resize(400, 300).jpeg().toBuffer(), text});
  }
}
const COLS = 4, label = (s: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="22"><rect width="400" height="22" fill="#111"/><text x="6" y="16" font-family="Helvetica,Arial,sans-serif" font-size="12.5" fill="#fff">${s}</text></svg>`);
if (tiles.length) {
  const rows = Math.ceil(tiles.length / COLS), out = `${SCRATCH}/sunlit/${arg('tag', 'sunlit')}-sheet.jpg`;
  await sharp({create: {width: COLS * 400, height: rows * 322, channels: 3, background: '#000'}})
    .composite(tiles.flatMap((tl, i) => [{input: tl.img, left: (i % COLS) * 400, top: Math.floor(i / COLS) * 322}, {input: label(tl.text), left: (i % COLS) * 400, top: Math.floor(i / COLS) * 322 + 300}])).jpeg({quality: 82}).toFile(out);
  console.log('sheet', out, tiles.length);
}
