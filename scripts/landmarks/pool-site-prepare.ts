/**
 * Site source for a pool landmark (2026-11-15, pools lane): a bath hall plus its outdoor basins, decks and pavilions.
 *
 *   node --import tsx scripts/landmarks/pool-site-prepare.ts <id> --main=<pand> [--pands=<pand>,...] [--basins=<osm area id>,...]
 *        [--site=<osm area id>] [--anchor=<lng>,<lat>]
 *
 * Like bag-shell-prepare.ts (same native frame: x east, z south, y up from the main pand's 3DBAG ground, metres, origin = vertex
 * average of the main BAG ring in RD), and in addition:
 *  - `pands`: every further BAG pand of the site (changing rooms, kiosks, a second hall) with its ring, its 3DBAG LoD2.2 shell and
 *    its ground offset against the main pand's ground;
 *  - `basins`: the OSM leisure=swimming_pool areas (ODbL) in native metres, read from artifacts/pools/pools.geojsonseq
 *    (pools-inventory.ts); confirm each against the orthophoto (pools-ortho.ts) before drawing it;
 *  - `site`: the facility outline (the bath's fence line in OSM), native metres.
 * `--main=none --anchor=lng,lat` gives a site without a hall (an outdoor bath whose pavilions are all small).
 * Sources: PDOK BAG WFS (CC0), 3DBAG (CC BY 4.0), OSM (ODbL). Cached in .cache/pand-reference.
 */
import fs from 'node:fs';
import {cachedJson, http} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const ID = process.argv[2];
const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MAIN = arg('main'), PANDS = arg('pands').split(',').filter(Boolean), BASINS = arg('basins').split(',').filter(Boolean), SITE = arg('site');
if (!ID || !MAIN) { console.error('usage: pool-site-prepare.ts <id> --main=<pand|none> [--pands=..] [--basins=..] [--site=..] [--anchor=lng,lat]'); process.exit(2); }
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);

const wfs = (pand: string) => cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${pand}</Literal></PropertyIsEqualTo></Filter>`)}`);
type Surface = {type: string; rings: number[][][]};
async function shell(pand: string, ax: number, ay: number, ground0: number | null) {
  const bag: any = (await wfs(pand)).features[0];
  const g = bag.geometry, ringRD = open(g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  let d: any = null;
  try { d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`); } catch { /* not in 3DBAG */ }
  const co = d?.feature?.CityObjects;
  const attrs = co?.[`NL.IMBAG.Pand.${pand}`]?.attributes ?? {};
  const ground = (attrs.b3_h_maaiveld as number | undefined) ?? ground0 ?? 0;
  const base = ground0 ?? ground;
  let surfaces: Surface[] = [];
  const geom = co?.[`NL.IMBAG.Pand.${pand}-0`]?.geometry?.find((x: {lod: string}) => x.lod === '2.2');
  if (geom) {
    const tr = d.metadata.transform;
    const verts = (d.feature.vertices as number[][]).map(v => { const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(p[0] - ax), r3(Math.max(0, p[2] - base)), r3(-(p[1] - ay))]; });
    surfaces = (geom.boundaries[0] as number[][][]).map((s, i) => ({type: geom.semantics.surfaces[geom.semantics.values[0][i]].type as string, rings: s.map(r => r.map(k => verts[k]))}));
  }
  return {
    id: pand, year: bag.properties.bouwjaar ?? null, groundNAP: ground, groundOffset: r3(ground - base),
    attributes: {roofMaxNAP: attrs.b3_h_dak_max ?? null, roofMinNAP: attrs.b3_h_dak_min ?? null, ridgeNAP: attrs.b3_h_nok ?? null, roof70pNAP: attrs.b3_h_dak_70p ?? null},
    ringRD, nativeRing: ringRD.map((p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))]), surfaces,
  };
}

// ---- anchor ----
let ax: number, ay: number, mainShell: Awaited<ReturnType<typeof shell>> | null = null;
if (MAIN !== 'none') {
  const bag: any = (await wfs(MAIN)).features[0];
  const g = bag.geometry, ringRD = open(g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length; ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
  mainShell = await shell(MAIN, ax, ay, null);
} else {
  const [lng, lat] = arg('anchor').split(',').map(Number);
  [ax, ay] = lngLatToRd(lng, lat);
}
const ground0 = mainShell?.groundNAP ?? Number(arg('ground', '0'));

// ---- OSM basins and site ----
const feats = new Map<string, any>();
for (const l of fs.readFileSync('artifacts/pools/pools.geojsonseq', 'utf8').split('\n')) if (l.trim()) { const f = JSON.parse(l.replace(/^\x1e/, '')); feats.set(f.id, f); }
const nativeOf = (lngLat: number[][]) => open(lngLat).map(([lng, lat]) => { const [x, y] = lngLatToRd(lng, lat); return [r3(x - ax), r3(-(y - ay))]; });
const outer = (g: any): number[][][] => g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p: number[][][]) => p[0]);
const basins = BASINS.map(id => { const f = feats.get(id); if (!f) throw new Error(`no OSM feature ${id} in artifacts/pools/pools.geojsonseq`); return {osm: id, name: f.properties.name ?? null, ring: nativeOf(outer(f.geometry)[0])}; });
const site = SITE ? nativeOf(outer(feats.get(SITE).geometry)[0]) : null;

const pands = [];
for (const p of PANDS) pands.push(await shell(p, ax, ay, ground0));
const strip = (s: any) => s && ({id: s.id, year: s.year, groundNAP: s.groundNAP, groundOffset: s.groundOffset, attributes: s.attributes, nativeRing: s.nativeRing, surfaces: s.surfaces});
const out = {
  id: ID, bagId: MAIN === 'none' ? null : MAIN, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), groundNAP: ground0,
  coordinateConvention: 'native east/south metres from anchor; y above the main pand\'s 3DBAG ground',
  sources: {
    bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${[MAIN, ...PANDS].filter(p => p !== 'none').join(',')} (BAG, CC0, fetched 2026-11-15)`,
    shell: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id> (3DBAG, CC BY 4.0, fetched 2026-11-15)',
    osm: `OpenStreetMap ${[...BASINS, SITE].filter(Boolean).join(',')} (ODbL, extract ${fs.statSync('.cache/osm-source/Amsterdam.osm.pbf').mtime.toISOString().slice(0, 10)})`,
  },
  attributes: mainShell?.attributes ?? null,
  nativeRing: mainShell?.nativeRing ?? null,
  surfaces: mainShell?.surfaces ?? [],
  pands: pands.map(strip),
  basins, site,
};
fs.writeFileSync(`scripts/landmarks/${ID}-footprints.json`, JSON.stringify(out) + '\n');
console.log(ID, out.anchor, 'main surfaces', out.surfaces.length, 'pands', pands.map(p => `${p.id}:${p.surfaces.length}`).join(' '), 'basins', basins.map(b => `${b.osm}:${b.ring.length}`).join(' '), 'site', site?.length ?? 0);
