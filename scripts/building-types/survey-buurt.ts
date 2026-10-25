/**
 * Building-type survey input for one coverage buurt (public/data/extracts/amsterdam/coverage-v1/buurten.json): every BAG pand
 * of the game's base tiles whose centroid lies in the buurt, with its coverage cluster key (width x height x year, the same
 * `clusterKey` the coverage map ranks buurten by), footprint rectangle (frontage = short side, depth = long side) and minor flag.
 *
 *   node --import tsx scripts/building-types/survey-buurt.ts --buurt="Gein 3" --slug=gein-3 [--top=3]
 *
 * Writes staging/building-types/<slug>-survey/{pands.json, clusters.json, raw/bag-panden.json}: clusters.json and raw/ have the
 * shape survey-terraces.ts reads (`--nw=<dir> --pool=top --rank=<k>`), so the terrace photo survey runs unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {bboxOf, clusterKey, inPolygon, isMinor, polygonsOf, rectSides, type PandRecord, type Ring} from '../../src/canalRecall/coverage/coverage.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const name = arg('buurt'), slug = arg('slug'), TOP = Number(arg('top', '3'));
if (!name || !slug) throw new Error('--buurt=<name> --slug=<slug> required');
const TILES = 'public/data/extracts/amsterdam/bag-tiles/14';
const cov = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/coverage-v1/buurten.json', 'utf8'));
const feat = cov.features.find((f: any) => f.properties.name === name || f.properties.code === name);
if (!feat) throw new Error(`buurt ${name} not in buurten.json`);
const polys = polygonsOf(feat.geometry), [w, s, e, n] = bboxOf(polys);
const lng2x = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** 14);
const lat2y = (lat: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** 14);
const seen = new Map<string, {p: PandRecord; geometry: any}>();
for (let x = lng2x(w); x <= lng2x(e); x++) for (let y = lat2y(n); y <= lat2y(s); y++) {
  const file = path.join(TILES, String(x), `${y}.geojson.gz`);
  if (!fs.existsSync(file)) continue;
  for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')).features) {
    const id = String(f.properties?.id ?? '');
    if (!id.startsWith('NL.IMBAG.Pand.') || seen.has(id)) continue;
    const ring = polygonsOf(f.geometry)[0]?.[0] as Ring | undefined;
    if (!ring?.length) continue;
    const k = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.length - 1 : ring.length;
    const c: [number, number] = [ring.slice(0, k).reduce((t, q) => t + q[0], 0) / k, ring.slice(0, k).reduce((t, q) => t + q[1], 0) / k];
    seen.set(id, {p: {id, centroid: c, ring, height: Number(f.properties.height) || undefined, year: Number(f.properties.year) || undefined}, geometry: f.geometry});
  }
}
const inside = [...seen.values()].filter(({p}) => polys.some(poly => inPolygon(p.centroid, poly)));
const pands = inside.map(({p}) => { const [a, b] = rectSides(p.ring); return {id: p.id.replace('NL.IMBAG.Pand.', ''), key: clusterKey(p), minor: isMinor(p), frontageM: +Math.min(a, b).toFixed(2), depthM: +Math.max(a, b).toFixed(2), heightM: p.height ?? null, year: p.year ?? null, lngLat: p.centroid.map(v => +v.toFixed(7))}; });
const counts = new Map<string, number>();
for (const p of pands) if (!p.minor && p.key) counts.set(p.key, (counts.get(p.key) ?? 0) + 1);
const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, TOP);
const out = path.join('staging/building-types', `${slug}-survey`);
fs.mkdirSync(path.join(out, 'raw'), {recursive: true});
fs.writeFileSync(path.join(out, 'pands.json'), JSON.stringify({buurt: name, code: feat.properties.code, pands}, null, 0) + '\n');
fs.writeFileSync(path.join(out, 'clusters.json'), JSON.stringify({top: top.map(([key, nn]) => ({key, n: nn, pandIds: pands.filter(p => !p.minor && p.key === key).map(p => ({id: p.id, bj: p.year, lon: p.lngLat[0], lat: p.lngLat[1]}))}))}) + '\n');
// raw/bag-panden.json: every pand near the buurt (party-wall neighbours outside it too), in the PDOK shape survey-terraces.ts reads.
const near = [...seen.values()].filter(({p}) => p.centroid[0] > w - 0.003 && p.centroid[0] < e + 0.003 && p.centroid[1] > s - 0.002 && p.centroid[1] < n + 0.002);
fs.writeFileSync(path.join(out, 'raw/bag-panden.json'), JSON.stringify(near.map(({p, geometry}) => ({type: 'Feature', properties: {identificatie: p.id.replace('NL.IMBAG.Pand.', ''), status: 'Pand in gebruik', bouwjaar: p.year ?? null}, geometry}))) + '\n');
console.log(`${name}: ${pands.length} pands (${pands.filter(p => p.minor).length} minor); top clusters`, top.map(([k, c]) => `${k} x${c}`).join(', '));
