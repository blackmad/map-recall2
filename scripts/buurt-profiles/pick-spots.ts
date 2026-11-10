/**
 * Spots for the buurt-profile before/after sheet (lane profiles-citywide): buurten with no profile in the BEFORE set and
 * their own profile in the AFTER set, the ride-ring ones first (docs/reports/ride-ring-buurten-*.md), then by pand count.
 *
 *   node --import tsx scripts/buurt-profiles/pick-spots.ts --cov-before=<cov.json> --after=<buurt-profiles.json> \
 *     --ring=docs/reports/ride-ring-buurten-20261107.md --out=<spots.json> [--count=6] [--pano-dir=<dir>]
 *
 * cov-before.json comes from coverage.mts (buurt code -> own | wijk | none). For each chosen buurt: the pre-1945 pand of
 * ordinary size nearest the buurt's pand centroid with a Gemeente Amsterdam panorama 5-25 m in front (CC BY 4.0), the
 * heading toward the pand. spots.json: [{ name, slug, code, lng, lat, bearing }] in the generic-gap-spots.json shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const covBefore = JSON.parse(fs.readFileSync(arg('cov-before')!, 'utf8')) as Record<string, string>;
const after = JSON.parse(fs.readFileSync(arg('after')!, 'utf8'));
const count = Number(arg('count') ?? 6);
const ringCodes = [...fs.readFileSync(arg('ring') ?? 'docs/reports/ride-ring-buurten-20261107.md', 'utf8').matchAll(/\| \d+ \| [^|]+\| ([A-Z]{2}\d{2}) \|/g)].map(m => m[1]);
const feats = JSON.parse(fs.readFileSync('.cache/buurt-profiles/buurten.geojson', 'utf8')).features as any[];
const inRing = (x: number, y: number, r: number[][]) => { let i2 = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) i2 = !i2; } return i2; };
const ownAfter = new Set((after.profiles as any[]).filter(p => p.level === 'buurt').map(p => p.code));
const wanted = feats.filter(f => covBefore[f.properties.code] === 'none' && ownAfter.has(f.properties.code));
type P = { id: string; lng: number; lat: number; ring: number[][]; year: number; height: number };
const byBuurt = new Map<string, P[]>();
const root = 'public/data/extracts/amsterdam/bag-tiles/14';
const polysOf = (f: any) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  if (!f.endsWith('.gz')) continue;
  for (const feat of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f))).toString()).features ?? []) {
    const pr = feat.properties ?? {}, year = Number(pr.year), height = Number(pr.height);
    if (feat.geometry?.type !== 'Polygon') continue;
    const ring = feat.geometry.coordinates[0] as number[][], lng = ring.reduce((s, p) => s + p[0], 0) / ring.length, lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const b = wanted.find(w => polysOf(w).some((p: number[][][]) => inRing(lng, lat, p[0])));
    if (!b) continue;
    const list = byBuurt.get(b.properties.code) ?? []; list.push({ id: String(pr.id).replace('NL.IMBAG.Pand.', ''), lng, lat, ring, year, height }); byBuurt.set(b.properties.code, list);
  }
}
const rank = (code: string) => { const i = ringCodes.indexOf(code); return i < 0 ? 1e6 - (byBuurt.get(code)?.length ?? 0) : i; };
const order = [...byBuurt.keys()].sort((a, b) => rank(a) - rank(b));
console.log('newly own-profiled buurten with pands', order.length, 'in the ride ring', order.filter(c => ringCodes.includes(c)).length);
const spots: any[] = [], usedWijk = new Map<string, number>();
for (const code of order) {
  if (spots.length >= count) break;
  const name = wanted.find(w => w.properties.code === code).properties.naam, list = byBuurt.get(code)!;
  const wijk = code.slice(0, 2); if ((usedWijk.get(wijk) ?? 0) >= 2) continue;
  const cx = list.reduce((s, p) => s + p.lng, 0) / list.length, cy = list.reduce((s, p) => s + p.lat, 0) / list.length;
  const cands = list.filter(p => p.year > 1300 && p.year < 1945 && p.height >= 7 && p.height <= 30).sort((a, b) => Math.hypot(a.lng - cx, a.lat - cy) - Math.hypot(b.lng - cx, b.lat - cy)).slice(0, 25);
  for (const p of cands) {
    const c = lngLatToRd([p.lng, p.lat]), panos = await listPanos(c, 30);
    let best: { d: number; heading: number; year: string; id: string } | null = null;
    for (const pano of panos) {
      const q = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]), d = Math.hypot(q.x - c.x, q.y - c.y), year = String(pano.timestamp).slice(0, 4);
      if (d < 7 || d > 25 || year < '2019') continue;
      if (!best || year > best.year || (year === best.year && d < best.d)) best = { d, year, heading: (Math.atan2(c.x - q.x, c.y - q.y) * 180 / Math.PI + 360) % 360, id: pano.pano_id };
    }
    if (!best) continue;
    const photoDir = arg('pano-dir');
    if (photoDir) { fs.mkdirSync(photoDir, { recursive: true }); fs.writeFileSync(path.join(photoDir, `new-${code.toLowerCase()}.jpg`), await cachedBytes(`https://api.data.amsterdam.nl/panorama/thumbnail/${best.id}/?width=1000&aspect=1.6&fov=60&heading=${Math.round(best.heading)}&pitch=10`, '.jpg')); }
    spots.push({ name: `${name} (${code})`, slug: `new-${code.toLowerCase()}`, code, lng: +p.lng.toFixed(6), lat: +p.lat.toFixed(6), bearing: Math.round(best.heading), pand: p.id, year: p.year });
    usedWijk.set(wijk, (usedWijk.get(wijk) ?? 0) + 1);
    break;
  }
}
fs.writeFileSync(arg('out')!, JSON.stringify(spots, null, 1));
console.log(spots.map(s => `${s.code} ${s.name} pand ${s.pand} ${s.year}`).join('\n'));
