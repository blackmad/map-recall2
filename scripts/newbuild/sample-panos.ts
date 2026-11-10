/**
 * Panorama wall samples of 2005+ new builds in the lane's areas (Houthaven, IJburg, Zeeburgereiland, Sluisbuurt,
 * Overhoeks): the measurement behind the contemporary family (src/canalRecall/contemporaryFamily.ts).
 *
 *   node --import tsx scripts/newbuild/sample-panos.ts [--per-area=40] [--out=staging/newbuild/pano-samples.json]
 *
 * Same view and classifier as scripts/buurt-profiles/sample-panos.ts (the footprint edge with a 2019+ municipal
 * panorama, CC BY 4.0, 4-25 m in front; the thumbnail pitched to the upper storeys; look/brickTone.ts on the centre
 * box), plus a glazing proxy: the share of dark low-chroma pixels (L* < 30, C < 14) in the wall box, which is glass and
 * deep reveals on a lit front. Writes a contact sheet (<out>.jpg) so window shapes can be counted by eye.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';
import { measureBrickTone, pixelKind } from '../../src/canalRecall/look/brickTone.ts';
import { isOliveShade, leafDominated, lch, masonryFamily } from '../../src/canalRecall/facade/cropWallColour.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const PER = Number(arg('per-area', '40'));
const OUT = path.resolve(arg('out', 'staging/newbuild/pano-samples.json'));
const AREAS: Record<string, RegExp> = {
  Houthaven: /^Houthavens/,
  IJburg: /^(Steigereiland|Rieteiland|Rieteilanden|Centrumeiland|Havenkwartier IJburg|Haveneiland|Strandeiland|IJburg)/,
  Zeeburgereiland: /^(Oostpunt Zeeburgereiland|Zeeburgereiland|Sportheldenbuurt)/,
  Sluisbuurt: /^Sluisbuurt/,
  Overhoeks: /^Overhoeks/,
};
const EX = 'public/data/extracts/amsterdam';
const buurten = (JSON.parse(fs.readFileSync(`${EX}/coverage-v1/buurten.json`, 'utf8')).features as any[]).filter(f => f.geometry?.type === 'Polygon')
  .flatMap(f => { const area = Object.keys(AREAS).find(k => AREAS[k].test(f.properties.name)); return area ? [{ area, name: f.properties.name as string, ring: f.geometry.coordinates[0] as number[][] }] : []; });
const inRing = (x: number, y: number, r: number[][]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

type P = { id: string; ring: number[][]; height: number; year: number; area: string; buurt: string };
const byArea = new Map<string, P[]>();
const root = `${EX}/bag-tiles/14`;
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  if (!f.endsWith('.gz')) continue;
  for (const feat of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f))).toString()).features ?? []) {
    const pr = feat.properties ?? {}, year = Number(pr.year), height = Number(pr.height);
    if (!(year >= 2005 && year < 2100) || !(height >= 7 && height <= 45) || feat.geometry?.type !== 'Polygon') continue;
    const ring = feat.geometry.coordinates[0] as number[][], lng = ring.reduce((s, p) => s + p[0], 0) / ring.length, lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const b = buurten.find(t => inRing(lng, lat, t.ring));
    if (!b) continue;
    const list = byArea.get(b.area) ?? []; list.push({ id: String(pr.id).replace('NL.IMBAG.Pand.', ''), ring, height, year, area: b.area, buurt: b.name }); byArea.set(b.area, list);
  }
}
for (const [a, l] of byArea) console.log(a, l.length, 'pands 2005+');

async function sample(p: P): Promise<Record<string, unknown> | null> {
  const rd = p.ring.map(q => lngLatToRd([q[0], q[1]]));
  const c = { x: rd.reduce((s, q) => s + q.x, 0) / rd.length, y: rd.reduce((s, q) => s + q.y, 0) / rd.length };
  const panos = await listPanos(c, 40);
  let best: { pano: any; d: number; heading: number; w: number; year: string } | null = null;
  for (let i = 0; i + 1 < rd.length; i++) {
    const a = rd[i], b = rd[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 4) continue;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let n = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    if ((m.x - c.x) * n.x + (m.y - c.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    for (const pano of panos) {
      const q = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]), dx = q.x - m.x, dy = q.y - m.y;
      const s = dx * n.x + dy * n.y, lat = Math.abs(dx * n.y - dy * n.x), year = String(pano.timestamp).slice(0, 4);
      if (s < 5 || s > 28 || lat > 0.5 * s || year < '2019') continue;
      const d = Math.hypot(dx, dy);
      if (!best || year > best.year || (year === best.year && d < best.d)) best = { pano, d, heading: (Math.atan2(-dx, -dy) * 180 / Math.PI + 360) % 360, w: len, year };
    }
  }
  if (!best) return null;
  const pitch = Math.max(5, Math.min(40, Math.atan2(p.height * 0.55 - 2.5, best.d) * 180 / Math.PI));
  const fov = Math.max(40, Math.min(80, 2 * Math.atan2(best.w / 2, best.d) * 180 / Math.PI));
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${best.pano.pano_id}/?width=320&aspect=1&fov=${Math.round(fov)}&heading=${Math.round(best.heading)}&pitch=${Math.round(pitch)}`;
  const bytes = await cachedBytes(url, '.jpg');
  const { data, info } = await sharp(bytes).extract({ left: 64, top: 48, width: 192, height: 192 }).raw().toBuffer({ resolveWithObject: true });
  const px: number[] = []; let leaf = 0, band = 0, pale = 0, dark = 0, valid = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], k = pixelKind(r, g, b);
    if (k === 'sky' || k === 'burnt') continue;
    band++;
    if (k === 'leaf' || isOliveShade(r, g, b)) { leaf++; continue; }
    px.push(r, g, b);
    const l = lch([r, g, b]); valid++;
    if (l.L < 30 && l.C < 14) dark++;
    if (l.L > 72 && l.C < 12) pale++;
  }
  if (leafDominated(leaf, band) || leaf / Math.max(1, band) > 0.35) return { pand: p.id, area: p.area, skipped: 'leaves', url };
  const tone = measureBrickTone(px, 3);
  if (!tone) return { pand: p.id, area: p.area, skipped: 'no wall', url };
  return { pand: p.id, area: p.area, buurt: p.buurt, year: p.year, heightM: p.height, pano: best.pano.pano_id, captured: String(best.pano.timestamp).slice(0, 10), distM: +best.d.toFixed(1), url,
    wall: tone.wall, brick: tone.brick, family: masonryFamily(tone.wall), paleShare: +(pale / Math.max(1, valid)).toFixed(3), darkShare: +(dark / Math.max(1, valid)).toFixed(3) };
}

const jobs = [...byArea.values()].flatMap(list => [...list].sort((a, b) => hash(a.id) - hash(b.id)).slice(0, PER * 3));
const results: any[] = [];
const done = new Map<string, number>();
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const p = jobs[next++];
    if ((done.get(p.area) ?? 0) >= PER) continue;
    try {
      const r = await sample(p);
      if (r) { results.push(r); if (!r.skipped) done.set(p.area, (done.get(p.area) ?? 0) + 1); }
    } catch (e) { results.push({ pand: p.id, area: p.area, skipped: `error ${(e as Error).message.slice(0, 80)}` }); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const ok = results.filter(r => !r.skipped).sort((a, b) => a.area.localeCompare(b.area) || a.pand.localeCompare(b.pand));
fs.writeFileSync(OUT, JSON.stringify({ licence: 'Gemeente Amsterdam panorama, CC BY 4.0', perArea: PER, samples: ok, skipped: results.length - ok.length }, null, 1));
console.log('sampled', ok.length, 'skipped', results.length - ok.length);
// Contact sheet: 8 across, each thumbnail labelled by area and the measured wall swatch underneath.
const tiles = await Promise.all(ok.map(async r => {
  const img = await sharp(await cachedBytes(r.url, '.jpg')).resize(200, 200).toBuffer();
  const sw = Buffer.from(`<svg width="200" height="230"><rect y="200" width="200" height="30" fill="${r.wall}"/><text x="4" y="222" font-size="13" font-family="sans-serif" fill="${parseInt(r.wall.slice(1, 3), 16) > 140 ? '#000' : '#fff'}">${r.area.slice(0, 10)} ${r.year} ${r.wall} g${Math.round(r.darkShare * 100)}</text></svg>`);
  return sharp({ create: { width: 200, height: 230, channels: 3, background: '#fff' } }).composite([{ input: img, top: 0, left: 0 }, { input: sw, top: 0, left: 0 }]).png().toBuffer();
}));
const cols = 8, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * 200, height: rows * 230, channels: 3, background: '#fff' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 200, top: Math.floor(i / cols) * 230 }))).jpeg({ quality: 85 }).toFile(OUT.replace(/\.json$/, '.jpg'));
