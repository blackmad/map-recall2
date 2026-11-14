/**
 * Footprint + 3DBAG facts for the centre venues lane (2026-11-14): Arti et Amicitiae, the Industrieele Groote Club,
 * Splendor, De Uitkijk, Escape and Bitterzoet. One BAG pand each (the whole pand: a landmark suppresses its pand, so
 * every house inside it is modelled too). Writes scripts/landmarks/<id>-footprints.json in the morgan-mees format
 * (nativeRing, ringRD, 3DBAG LoD2.2 roof pieces, neighbours) and artifacts/landmark-briefs/<id>/plan.png (roof pieces
 * coloured by height, ring vertex numbers).
 *
 *   node --import tsx scripts/landmarks/venue-prepare.ts --id=<id>
 *
 * BAG ring from the PDOK BAG WFS (CC0), 3DBAG item (CC BY 4.0), both cached under .cache/. Native frame: x east,
 * z south, y up from the pavement (3DBAG maaiveld), metres from the anchor (the ring's vertex average).
 * Requests name the repository as contact.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createCanvas} from '@napi-rs/canvas';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

type Src = {what: string; url: string; retrieved: string; licence: string};
type Venue = {pand: string; label: string; address: string; sources: Src[]};
const D = '2026-11-14';
const wiki = (t: string, what = t.replace(/_/g, ' ')): Src => ({what, url: `https://nl.wikipedia.org/wiki/${t}`, retrieved: D, licence: 'CC BY-SA 4.0'});
const rce = (n: number, what: string): Src => ({what: `Rijksmonument ${n}: ${what}`, url: `https://monumentenregister.cultureelerfgoed.nl/monumenten/${n}`, retrieved: D, licence: 'CC0'});
export const VENUES: Record<string, Venue> = {
  'arti-et-amicitiae': {pand: '0363100012165109', label: 'Rokin 112 (Arti et Amicitiae) with the Spui wall and the Kalverstraat houses of the same BAG pand',
    address: 'Rokin 112 at the Spui, Amsterdam (Arti et Amicitiae; the BAG pand runs through to the Kalverstraat)',
    sources: [wiki('Arti_et_Amicitiae'), {what: 'Arti et Amicitiae', url: 'https://en.wikipedia.org/wiki/Arti_et_Amicitiae', retrieved: D, licence: 'CC BY-SA 4.0'}, wiki('Lijst_van_rijksmonumenten_aan_het_Rokin')]},
  'industrieele-groote-club': {pand: '0363100012165129', label: 'Dam 27 (Koninklijke Industrieele Groote Club, 1913-1916)',
    address: 'Dam 27, Amsterdam (Koninklijke Industrieele Groote Club)', sources: [wiki('De_Industrieele_Groote_Club')]},
  'splendor': {pand: '0363100012171998', label: 'Nieuwe Uilenburgerstraat 116 (former municipal bathhouse, 1937; Splendor)',
    address: 'Nieuwe Uilenburgerstraat 116, Amsterdam (Splendor, the former bathhouse)', sources: [wiki('Splendor_(muziekgebouw)')]},
  'de-uitkijk': {pand: '0363100012169642', label: 'Prinsengracht 452 (Filmtheater De Uitkijk)',
    address: 'Prinsengracht 452, Amsterdam (Filmtheater De Uitkijk)', sources: [wiki('Filmtheater_de_Uitkijk')]},
  'escape-rembrandtplein': {pand: '0363100012171128', label: 'Rembrandtplein 11 (Escape, the former Rembrandtpleintheater)',
    address: 'Rembrandtplein 11, Amsterdam (Escape)', sources: [wiki('Rembrandtplein_(Amsterdam)')]},
  'bitterzoet': {pand: '0363100012171035', label: 'Spuistraat 2 (Bitterzoet)',
    address: 'Spuistraat 2, Amsterdam (Bitterzoet)', sources: [wiki('Bitterzoet_(poppodium)')]},
};
const id = process.argv.find(a => a.startsWith('--id='))?.slice(5) ?? '';
const V = VENUES[id];
if (!V) { console.error('--id=', Object.keys(VENUES).join('|')); process.exit(2); }
const UA = {'User-Agent': 'map-recall2 landmark lane (+https://github.com/blackmad/map-recall2)'};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
async function cached(file: string, url: string) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(url, {headers: UA});
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j;
}
const bagUrl = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;
const g = await cached(path.join('.cache', 'bag-wfs', `${V.pand}.json`), bagUrl(V.pand));
const item = await cached(path.join('.cache', '3dbag', `${V.pand}.json`), `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${V.pand}`);
const attrs = Object.values(item.feature.CityObjects as Record<string, {type: string; attributes: Record<string, number>}>).find(o => o.type === 'Building')!.attributes;
const ring: number[][] = g.features[0].geometry.coordinates[0].slice(0, -1);
const year = Number(g.features[0].properties.bouwjaar);
const ax = ring.reduce((s, q) => s + q[0], 0) / ring.length, ay = ring.reduce((s, q) => s + q[1], 0) / ring.length;
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const N = (q: number[]) => [r3(q[0] - ax), r3(-(q[1] - ay))];
const ground = attrs.b3_h_maaiveld;
const tr = item.metadata.transform;
const verts = (item.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(q[2] - ground), r3(-(q[1] - ay))]; });
const parts = Object.keys(item.feature.CityObjects).filter(k => k.startsWith(`NL.IMBAG.Pand.${V.pand}-`)).sort();
const roofs = parts.flatMap(k => {
  const gg = item.feature.CityObjects[k].geometry.find((x: {lod: string}) => x.lod === '2.2');
  return (gg.boundaries[0] as number[][][]).flatMap((sf, i) => gg.semantics.surfaces[gg.semantics.values[0][i]].type === 'RoofSurface' ? [sf[0].map(kk => verts[kk])] : []);
});
/** Every LoD2.2 surface (walls, roofs, ground) for builders that keep the 3DBAG shell behind their drawn fronts. */
const surfaces = parts.flatMap(k => {
  const gg = item.feature.CityObjects[k].geometry.find((x: {lod: string}) => x.lod === '2.2');
  return (gg.boundaries[0] as number[][][]).map((sf, i) => ({type: gg.semantics.surfaces[gg.semantics.values[0][i]].type as string, rings: sf.map(r => r.map(kk => verts[kk]))}));
});
const nativeRing = ring.map(N);
const near = (r: number[][], ours: number[][]) => r.some(p => ours.some((q, i) => { const c = ours[(i + 1) % ours.length], dx = c[0] - q[0], dz = c[1] - q[1], L2 = dx * dx + dz * dz || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / L2)); return Math.hypot(p[0] - q[0] - u * dx, p[1] - q[1] - u * dz) < 3; }));
const neighbours: {id: string; height: number; ring: number[][]}[] = [];
{
  const n = 2 ** 14, tx = Math.floor((anchor[0] + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(anchor[1] * Math.PI / 180) + 1 / Math.cos(anchor[1] * Math.PI / 180)) / Math.PI) / 2 * n);
  const seen = new Set<string>();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx + dx}/${ty + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
      const pid = String(ft.properties.id);
      if (seen.has(pid) || pid.endsWith(V.pand) || ft.properties.tier !== 3) continue;
      seen.add(pid);
      const gm = ft.geometry, rr = (gm.type === 'Polygon' ? gm.coordinates[0] : gm.coordinates[0][0]).map((p: number[]) => N(lngLatToRd(p[0], p[1]) as number[]));
      if (near(rr, nativeRing) || near(nativeRing, rr)) neighbours.push({id: pid, height: ft.properties.height, ring: rr});
    }
  }
}
const json = {
  id, pands: [V.pand], pandLabels: {[V.pand]: V.label}, address: V.address,
  sources: [
    {what: 'BAG pand ring', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (typeName bag:pand, srsName EPSG:28992)', retrieved: D, licence: 'CC0'},
    {what: '3DBAG LoD2.2 roof pieces and heights', url: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${V.pand}`, retrieved: D, licence: 'CC BY 4.0'},
    ...V.sources,
  ],
  anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: r3(ground),
  pandHeights: [{id: V.pand, label: V.label, year, groundNAP: r3(ground), eavesM: r3(attrs.b3_h_dak_min - ground), roof50M: r3(attrs.b3_h_dak_50p - ground), roof70M: r3(attrs.b3_h_dak_70p - ground), roofMaxM: r3(attrs.b3_h_dak_max - ground)}],
  pandNative: {[V.pand]: nativeRing},
  roofs: {[V.pand]: roofs},
  surfaces,
  ringRD: ring.map(q => q.map(r3)),
  nativeRing,
  buildingFootprint: {type: 'Polygon', coordinates: [[...ring, ring[0]].map(q => rdToLngLat(q[0], q[1]).map(v => +v.toFixed(8)))]},
  neighbours,
};
fs.writeFileSync(`scripts/landmarks/${id}-footprints.json`, JSON.stringify(json, null, 1));
console.log(id, 'year', year, 'anchor', anchor, 'ground', r3(ground), 'verts', ring.length, 'roof pieces', roofs.length, 'neighbours', neighbours.length);
console.log('heights', json.pandHeights[0]);

// plan.png: roof pieces by height, ring and vertex numbers, neighbours grey
const xs = nativeRing.map(p => p[0]), zs = nativeRing.map(p => p[1]);
const pad = 6, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;
const S = Math.min(24, 1400 / Math.max(x1 - x0, z1 - z0));
const cv = createCanvas(Math.ceil((x1 - x0) * S), Math.ceil((z1 - z0) * S)), cx = cv.getContext('2d');
const X = (p: number[]) => [(p[0] - x0) * S, (p[1] - z0) * S] as const;
cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
cx.strokeStyle = '#aaa';
for (const nb of neighbours) { cx.beginPath(); nb.ring.forEach((p, i) => { const [u, v] = X(p); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); }); cx.closePath(); cx.stroke(); }
const hmax = Math.max(...roofs.flat().map(p => p[1]), 1);
for (const r of [...roofs].sort((a, b) => Math.max(...a.map(p => p[1])) - Math.max(...b.map(p => p[1])))) {
  const h = r.reduce((s, p) => s + p[1], 0) / r.length, t = h / hmax;
  cx.fillStyle = `hsl(${240 - 240 * t},70%,${45 + 20 * t}%)`; cx.beginPath();
  r.forEach((p, i) => { const [u, v] = X([p[0], p[2]]); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); }); cx.closePath(); cx.fill(); cx.strokeStyle = '#0006'; cx.stroke();
  const c = r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[2] / r.length], [0, 0]);
  const [u, v] = X(c); cx.fillStyle = '#000'; cx.font = '11px sans-serif'; cx.fillText(`${Math.min(...r.map(p => p[1])).toFixed(1)}-${Math.max(...r.map(p => p[1])).toFixed(1)}`, u - 14, v);
}
cx.strokeStyle = '#d00'; cx.lineWidth = 2; cx.beginPath();
nativeRing.forEach((p, i) => { const [u, v] = X(p); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); }); cx.closePath(); cx.stroke();
cx.fillStyle = '#b00'; cx.font = 'bold 12px sans-serif';
nativeRing.forEach((p, i) => { const q = nativeRing[(i + 1) % nativeRing.length]; if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.5 || i % 4 === 0) { const [u, v] = X(p); cx.fillText(String(i), u + 2, v - 2); } });
cx.fillStyle = '#000'; cx.font = '14px sans-serif'; cx.fillText(`${id}  N up, ${S.toFixed(1)} px/m`, 8, 18);
fs.mkdirSync(`artifacts/landmark-briefs/${id}`, {recursive: true});
fs.writeFileSync(`artifacts/landmark-briefs/${id}/plan.png`, cv.toBuffer('image/png'));
