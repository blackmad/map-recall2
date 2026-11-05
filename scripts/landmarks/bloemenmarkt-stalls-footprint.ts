/**
 * Bloemenmarkt (#227): writes scripts/landmarks/bloemenmarkt-stalls-footprints.json from the BAG ligplaatsen on the
 * Singel between the Koningsplein and the Vijzelstraat (Singel 600-630, 16 water plots, api.data.amsterdam.nl, CC0).
 *
 * Each plot's ring goes to native model metres (x east, z south) about the row's anchor (vertex average of all plots);
 * `rect` is its minimum-area rectangle with the front on the side facing the street (outward bearing nearest
 * `--front-near`, default 195). The stalls stand on the water plot and reach `--land` metres (default 3.2, measured on
 * the 2025 PDOK orthophoto at 0.1 m) onto the pavement on the street side, so `stall` is the rectangle grown by that
 * much towards the front.
 *
 *   node --import tsx scripts/landmarks/bloemenmarkt-stalls-footprint.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {minimumRectangle, type Pt} from '../../src/canalRecall/kiosks/kioskKit.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROOT = path.resolve(import.meta.dirname, '../..');
const URL = 'https://api.data.amsterdam.nl/v1/bag/ligplaatsen/?_format=json&_pageSize=100&geometrie%5Bintersects%5D=POLYGON((121100%20486600,121500%20486600,121500%20486800,121100%20486800,121100%20486600))';
const cache = path.join(ROOT, '.cache/kiosks/ligplaatsen-bloemenmarkt.json');
let body: any;
if (fs.existsSync(cache)) body = JSON.parse(fs.readFileSync(cache, 'utf8'));
else {
  const r = await fetch(URL, {headers: {'Accept-Crs': 'EPSG:28992', 'Content-Crs': 'EPSG:28992'}});
  if (!r.ok) throw Error(`${r.status} ${URL}`);
  body = await r.json();
  fs.mkdirSync(path.dirname(cache), {recursive: true});
  fs.writeFileSync(cache, JSON.stringify(body));
}
// house numbers from the hoofdadres (nummeraanduidingen), cached beside the plots
const addrCache = path.join(ROOT, '.cache/kiosks/ligplaatsen-bloemenmarkt-adressen.json');
const addr: Record<string, string> = fs.existsSync(addrCache) ? JSON.parse(fs.readFileSync(addrCache, 'utf8')) : {};
const plots = body._embedded.ligplaatsen as any[];
for (const l of plots) if (!addr[l.heeftHoofdadresId]) {
  const r = await fetch(`https://api.data.amsterdam.nl/v1/bag/nummeraanduidingen/${l.heeftHoofdadresId}/?_format=json`);
  const a = await r.json();
  addr[l.heeftHoofdadresId] = `${a.ligtAanNaam ?? 'Singel'} ${a.huisnummer}${a.huisletter ?? ''}`;
}
fs.writeFileSync(addrCache, JSON.stringify(addr));

const frontNear = Number(arg('front-near') ?? 195), land = Number(arg('land') ?? 3.2);
const rings = plots.map(l => {
  const c = l.geometrie.coordinates[0] as number[][];
  const open = c[0][0] === c.at(-1)![0] && c[0][1] === c.at(-1)![1] ? c.slice(0, -1) : c;
  return {l, lnglat: open.map(([x, y]) => rdToLngLat({x, y}))};
});
const all = rings.flatMap(r => r.lnglat);
const anchor: [number, number] = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
const kx = 111320 * Math.cos(anchor[1] * Math.PI / 180);
const toLocal = ([lng, lat]: number[]): Pt => [+((lng - anchor[0]) * kx).toFixed(3), +(-(lat - anchor[1]) * 111320).toFixed(3)];
const out = rings.map(({l, lnglat}) => {
  const local = lnglat.map(toLocal);
  const r = minimumRectangle(local, frontNear);
  const b = r.frontBearing * Math.PI / 180, n: Pt = [Math.sin(b), -Math.cos(b)];
  const area = Math.abs(local.reduce((s, p, i) => {const q = local[(i + 1) % local.length]; return s + p[0] * q[1] - q[0] * p[1];}, 0) / 2);
  return {
    ligplaats: l.identificatie, address: addr[l.heeftHoofdadresId], url: `https://api.data.amsterdam.nl/v1/bag/ligplaatsen/${l.identificatie}/`,
    status: l.statusOmschrijving, areaM2: +area.toFixed(1),
    ringLngLat: lnglat.map(p => [+p[0].toFixed(7), +p[1].toFixed(7)]), localEastSouthMetres: local,
    rect: {centre: r.centre.map(v => +v.toFixed(3)), widthM: +r.width.toFixed(3), depthM: +r.depth.toFixed(3), frontBearing: +r.frontBearing.toFixed(2)},
    stall: {centre: [+(r.centre[0] + n[0] * land / 2).toFixed(3), +(r.centre[1] + n[1] * land / 2).toFixed(3)], widthM: +r.width.toFixed(3), depthM: +(r.depth + land).toFixed(3), landDepthM: land, frontBearing: +r.frontBearing.toFixed(2)},
  };
}).sort((a, b) => a.rect.centre[0] - b.rect.centre[0]);
const file = path.join(ROOT, 'scripts/landmarks/bloemenmarkt-stalls-footprints.json');
const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
fs.writeFileSync(file, JSON.stringify({
  id: 'bloemenmarkt-stalls', generatedBy: `node --import tsx scripts/landmarks/bloemenmarkt-stalls-footprint.ts ${process.argv.slice(2).join(' ')}`.trim(),
  source: {kind: 'bag-ligplaatsen', url: URL.replace(/&/g, '&'), licence: 'CC0 (BAG)', landDepthEvidence: 'PDOK luchtfoto Actueel_orthoHR 2025 (CC BY 4.0): roofs reach 3.0-3.4 m south of the ligplaats edge along the row'},
  anchor: [+anchor[0].toFixed(7), +anchor[1].toFixed(7)], plots: out, notes: prior.notes ?? [],
}, null, 1) + '\n');
for (const p of out) console.log(p.ligplaats, p.address, p.areaM2, JSON.stringify(p.rect));
