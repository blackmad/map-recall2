/**
 * Panorama wall samples for the buurt profiles (derive.ts source "thumb"; GitHub #102).
 *
 *   node --import tsx scripts/buurt-profiles/sample-panos.ts [--radius-km=3.5] [--per-buurt=20] [--modern]
 *     -> staging/buurt-profiles/pano-samples.json (--modern: pano-samples-modern.json)
 *
 * `--modern` (GitHub #117): BAG year >= 1945, 7-45 m high, 40-5,000 m2, so the profiles carry a measured post-war era.
 *
 * For each Gemeente Amsterdam buurt whose centre is within --radius-km of the Dam, up to --per-buurt pre-1945 pands of
 * ordinary size (7-30 m high, 40-600 m2), taken in a pand-id hash order (deterministic, spread over the buurt). Per
 * pand: the footprint edge with a municipal panorama (CC BY 4.0) 4-25 m in front of it, the most recent capture first;
 * the panorama thumbnail service renders the view from that panorama at the edge's middle, pitched to the upper
 * storeys (no cars, fewer shopfronts), and the centre box is measured with the same brick-tone classifier as the
 * rectified crops (look/brickTone.ts): brick (or wall) colour, masonry family (cropWallColour.ts), and the share of
 * pale low-chroma pixels (white accents). Leaf-dominated views are dropped. Thumbnails are cached under .cache/.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';
import { measureBrickTone, pixelKind } from '../../src/canalRecall/look/brickTone.ts';
import { isOliveShade, leafDominated, lch, masonryFamily } from '../../src/canalRecall/facade/cropWallColour.ts';

const arg = (k: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const RADIUS_KM = arg('radius-km', 3.5), PER = arg('per-buurt', 20), DAM = [4.8936, 52.3731];
const MODERN = process.argv.includes('--modern');
const OUT = path.resolve(MODERN ? 'staging/buurt-profiles/pano-samples-modern.json' : 'staging/buurt-profiles/pano-samples.json');
const MAX_H = MODERN ? 45 : 30, MAX_AREA = MODERN ? 5000 : 600;
const eraOk = (year: number) => MODERN ? year >= 1945 && year < 2100 : year > 1300 && year < 1945;
const buurten = JSON.parse(fs.readFileSync('.cache/buurt-profiles/buurten.geojson', 'utf8')).features as any[];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const inRing = (x: number, y: number, ring: number[][]) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const kmFromDam = (lng: number, lat: number) => Math.hypot((lng - DAM[0]) * 67.9, (lat - DAM[1]) * 110.5);

type P = { id: string; ring: number[][]; height: number; year: number; lng: number; lat: number; area: number };
const targets = buurten.map(b => { const polys = b.geometry.type === 'Polygon' ? [b.geometry.coordinates] : b.geometry.coordinates; const ring = polys[0][0]; const c = [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length]; return { code: b.properties.code, name: b.properties.naam, polys, c }; })
  .filter(b => kmFromDam(b.c[0], b.c[1]) <= RADIUS_KM);
console.log('target buurten', targets.length);
const byBuurt = new Map<string, P[]>();
const root = 'public/data/extracts/amsterdam/bag-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  if (!f.endsWith('.gz')) continue;
  for (const feat of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f))).toString()).features ?? []) {
    const pr = feat.properties ?? {}, year = Number(pr.year), height = Number(pr.height);
    if (!eraOk(year) || !(height >= 7 && height <= MAX_H) || feat.geometry?.type !== 'Polygon') continue;
    const ring = feat.geometry.coordinates[0] as number[][], lng = ring.reduce((s, p) => s + p[0], 0) / ring.length, lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    if (kmFromDam(lng, lat) > RADIUS_KM + 1) continue;
    const rd = ring.map(p => lngLatToRd([p[0], p[1]]));
    let area = 0; for (let i = 0, j = rd.length - 1; i < rd.length; j = i++) area += rd[j].x * rd[i].y - rd[i].x * rd[j].y;
    area = Math.abs(area) / 2;
    if (area < 40 || area > MAX_AREA) continue;
    const b = targets.find(t => t.polys.some((p: number[][][]) => inRing(lng, lat, p[0])));
    if (!b) continue;
    const list = byBuurt.get(b.code) ?? []; list.push({ id: String(pr.id).replace('NL.IMBAG.Pand.', ''), ring, height, year, lng, lat, area }); byBuurt.set(b.code, list);
  }
}
const prior: Record<string, unknown> = fs.existsSync(OUT) ? Object.fromEntries((JSON.parse(fs.readFileSync(OUT, 'utf8')).samples as any[]).map(s => [s.pand, s])) : {};
const jobs: { code: string; p: P }[] = [];
for (const [code, list] of byBuurt) for (const p of [...list].sort((a, b) => hash(a.id) - hash(b.id)).slice(0, PER * 2)) jobs.push({ code, p });
console.log('candidate pands', jobs.length);

async function sample(code: string, p: P): Promise<Record<string, unknown> | null> {
  const rd = p.ring.map(q => lngLatToRd([q[0], q[1]]));
  const c = { x: rd.reduce((s, q) => s + q.x, 0) / rd.length, y: rd.reduce((s, q) => s + q.y, 0) / rd.length };
  const panos = await listPanos(c, 30);
  let best: { pano: any; d: number; heading: number; w: number; year: string } | null = null;
  for (let i = 0; i + 1 < rd.length; i++) {
    const a = rd[i], b = rd[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 3) continue;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let n = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    if ((m.x - c.x) * n.x + (m.y - c.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    for (const pano of panos) {
      const q = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]), dx = q.x - m.x, dy = q.y - m.y;
      const s = dx * n.x + dy * n.y, lat = Math.abs(dx * n.y - dy * n.x), year = String(pano.timestamp).slice(0, 4);
      if (s < 4 || s > 25 || lat > 0.5 * s || year < '2019') continue;
      const d = Math.hypot(dx, dy);
      if (!best || year > best.year || (year === best.year && d < best.d)) best = { pano, d, heading: (Math.atan2(-dx, -dy) * 180 / Math.PI + 360) % 360, w: len, year };
    }
  }
  if (!best) return null;
  const pitch = Math.max(5, Math.min(45, Math.atan2(p.height * 0.62 - 2.5, best.d) * 180 / Math.PI));
  const fov = Math.max(30, Math.min(70, 2 * Math.atan2(best.w / 2, best.d) * 180 / Math.PI));
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${best.pano.pano_id}/?width=320&aspect=1&fov=${Math.round(fov)}&heading=${Math.round(best.heading)}&pitch=${Math.round(pitch)}`;
  const bytes = await cachedBytes(url, '.jpg');
  const { data, info } = await sharp(bytes).extract({ left: 64, top: 48, width: 192, height: 192 }).raw().toBuffer({ resolveWithObject: true });
  const px: number[] = []; let leaf = 0, band = 0, pale = 0, valid = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], k = pixelKind(r, g, b);
    if (k === 'sky' || k === 'burnt') continue;
    band++;
    if (k === 'leaf' || isOliveShade(r, g, b)) { leaf++; continue; }
    px.push(r, g, b);
    const l = lch([r, g, b]); if (l.L > 20) { valid++; if (l.L > 72 && l.C < 12) pale++; }
  }
  if (leafDominated(leaf, band) || leaf / Math.max(1, band) > 0.35) return { pand: p.id, buurt: code, skipped: 'leaves', url };
  const tone = measureBrickTone(px, 3);
  if (!tone) return { pand: p.id, buurt: code, skipped: 'no wall', url };
  const family = masonryFamily(tone.wall);
  return { pand: p.id, buurt: code, year: p.year, pano: best.pano.pano_id, captured: String(best.pano.timestamp).slice(0, 10), distM: +best.d.toFixed(1), url,
    brick: tone.brick, wall: tone.wall, lightTrim: tone.lightTrim, family, paleShare: +(pale / Math.max(1, valid)).toFixed(3), leafShare: +(leaf / Math.max(1, band)).toFixed(3) };
}

const results: any[] = [];
const done = new Map<string, number>(), inflight = new Map<string, number>();
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { code, p } = jobs[next++];
    if ((done.get(code) ?? 0) + (inflight.get(code) ?? 0) >= PER) continue;
    inflight.set(code, (inflight.get(code) ?? 0) + 1);
    try {
      const r = (prior[p.id] as any) ?? await sample(code, p);
      if (r) { results.push(r); if (!r.skipped) done.set(code, (done.get(code) ?? 0) + 1); }
    } catch (e) { results.push({ pand: p.id, buurt: code, skipped: `error ${(e as Error).message.slice(0, 80)}` }); }
    inflight.set(code, inflight.get(code)! - 1);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ licence: 'Gemeente Amsterdam panorama, CC BY 4.0', radiusKm: RADIUS_KM, perBuurt: PER, samples: results }, null, 0));
const ok = results.filter(r => !r.skipped);
console.log('sampled', ok.length, 'skipped', results.length - ok.length, 'buurten with samples', new Set(ok.map(r => r.buurt)).size,
  'families', JSON.stringify(ok.reduce((m, r) => (m[r.family ?? 'none'] = (m[r.family ?? 'none'] ?? 0) + 1, m), {})));
