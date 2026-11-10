/**
 * Survey BAG pands built since the AHN flight (bouwjaar >= 2020) that the city tiles do not draw,
 * and stage prisms for them (src/canalRecall/newPandPrisms.ts). Live PDOK BAG WFS (CC0), tiles from
 * bag-tiles/14. Heights: median of drawn neighbours, else an area default; the source is on each feature.
 *
 * Staging only (integrator publishes with publish-bag-gaps.ts --supplement=...):
 *   scripts/data/bag-gaps/new-pands-supplement.geojson
 *   scripts/data/bag-gaps/new-pands.report.json   counts / m2 by buurt, bouwjaar and height source
 *
 * Usage: node --max-old-space-size=8192 --import tsx scripts/survey-new-pands.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { findBagGaps, pandAreaM2, type RegisterPand } from '../src/canalRecall/bagGaps';
import { isNewPandGap, newPandFeature, newPandHeight, NEIGHBOUR_RADIUS_M } from '../src/canalRecall/newPandPrisms';
import { outerRings, pointInRing, ringBounds, type LngLat, type Ring, type TileBuilding } from '../src/canalRecall/landmarks/osmUnderModels';

const ROOT = path.resolve(import.meta.dirname, '..');
const EX = path.join(ROOT, 'public/data/extracts/amsterdam');
const OUT = path.join(ROOT, 'scripts/data/bag-gaps');
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const CELL = 0.001;

type Wfs = { properties: { identificatie: string; status: string; bouwjaar?: number }; geometry: { type: string; coordinates: unknown } };
const filter = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><fes:And><fes:PropertyIsGreaterThanOrEqualTo><fes:ValueReference>bouwjaar</fes:ValueReference><fes:Literal>2020</fes:Literal></fes:PropertyIsGreaterThanOrEqualTo><fes:BBOX><fes:ValueReference>geometrie</fes:ValueReference><gml:Envelope srsName="urn:ogc:def:crs:EPSG::4326"><gml:lowerCorner>52.27 4.72</gml:lowerCorner><gml:upperCorner>52.44 5.08</gml:upperCorner></gml:Envelope></fes:BBOX></fes:And></fes:Filter>`;
const live: Wfs[] = [];
for (let start = 0; ; start += 1000) {
  const url = `${WFS}?` + new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: 'bag:pand', outputFormat: 'application/json', srsName: 'EPSG:4326', count: '1000', startIndex: String(start), sortBy: 'identificatie', filter });
  const page = (await (await fetch(url)).json()) as { features: Wfs[] };
  live.push(...page.features);
  if (page.features.length < 1000) break;
}
console.log(`live BAG pands bouwjaar>=2020: ${live.length}`);

const index = JSON.parse(fs.readFileSync(path.join(EX, 'bag-tiles/index-z14.json'), 'utf8')) as { tileList: string[] };
const tileIds = new Set<string>();
const grid = new Map<string, TileBuilding[]>();
const heights: { c: LngLat; h: number }[] = [];
for (const key of index.tileList) {
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EX, `bag-tiles/${key}.geojson.gz`))).toString()) as { features: { properties: { id?: string; pand?: string; height?: number; tier?: number }; geometry: { type: string; coordinates: unknown } }[] };
  for (const f of fc.features) {
    const id = String(f.properties.id ?? f.properties.pand ?? ''); if (id) tileIds.add(id);
    const rings = outerRings(f.geometry as never); if (!rings.length) continue;
    const bb = rings.map(ringBounds), w = Math.min(...bb.map(q => q.w)), e = Math.max(...bb.map(q => q.e)), s = Math.min(...bb.map(q => q.s)), n = Math.max(...bb.map(q => q.n));
    const b: TileBuilding = { id, height: undefined, rings };
    for (let x = Math.floor(w / CELL); x <= Math.floor(e / CELL); x++) for (let y = Math.floor(s / CELL); y <= Math.floor(n / CELL); y++) { const k = `${x},${y}`; const l = grid.get(k); if (l) l.push(b); else grid.set(k, [b]); }
    // Measured neighbours only: tier 1-3 (3DBAG/AHN), never the 9 m OSM default (tier 4).
    if (typeof f.properties.height === 'number' && (f.properties.tier ?? 3) <= 3) heights.push({ c: [(w + e) / 2, (s + n) / 2], h: f.properties.height });
  }
}
const hGrid = new Map<string, { c: LngLat; h: number }[]>();
for (const p of heights) { const k = `${Math.floor(p.c[0] / 0.002)},${Math.floor(p.c[1] / 0.002)}`; const l = hGrid.get(k); if (l) l.push(p); else hGrid.set(k, [p]); }
const mPerLng = 111320 * Math.cos(52.37 * Math.PI / 180), mPerLat = 110540;
const neighbourHeights = (c: LngLat): number[] => {
  const out: number[] = [], kx = Math.floor(c[0] / 0.002), ky = Math.floor(c[1] / 0.002);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const p of hGrid.get(`${kx + dx},${ky + dy}`) ?? [])
    if (Math.hypot((p.c[0] - c[0]) * mPerLng, (p.c[1] - c[1]) * mPerLat) <= NEIGHBOUR_RADIUS_M) out.push(p.h);
  return out;
};
const tilesNear = (rings: readonly Ring[]): TileBuilding[] => {
  const seen = new Set<TileBuilding>();
  for (const r of rings) { const b = ringBounds(r); for (let x = Math.floor(b.w / CELL); x <= Math.floor(b.e / CELL); x++) for (let y = Math.floor(b.s / CELL); y <= Math.floor(b.n / CELL); y++) for (const t of grid.get(`${x},${y}`) ?? []) seen.add(t); }
  return [...seen];
};

const pands = new Map<string, RegisterPand>();
for (const f of live) pands.set(f.properties.identificatie, { id: f.properties.identificatie, status: f.properties.status, year: f.properties.bouwjaar ?? null, rings: outerRings(f.geometry as never) });
// Only inside the surveyed z14 tiles (the drivable city), like survey-bag-gaps.ts.
const inTiles = (c: LngLat) => index.tileList.some(k => { const [z, x, y] = k.split('/').map(Number); const n = 2 ** z; const w = x / n * 360 - 180, e = (x + 1) / n * 360 - 180; const lat = (t: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI; return c[0] >= w && c[0] < e && c[1] >= lat(y + 1) && c[1] < lat(y); });
const gaps = findBagGaps(pands.values(), tileIds, tilesNear).filter(g => isNewPandGap(g) && inTiles(g.centre));

const boundaries = (JSON.parse(fs.readFileSync(path.join(EX, 'boundaries.json'), 'utf8')) as { name: string; kind: string; geometry: unknown }[]).filter(b => b.kind === 'neighbourhood' || b.kind === 'neighborhood' || b.kind === 'quarter' || b.kind === 'suburb').map(b => ({ name: b.name, kind: b.kind, rings: (b.geometry as unknown as [number, number][][][]).map(poly => poly[0].map(([lat, lng]) => [lng, lat] as LngLat)) as Ring[] }));
const buurtOf = (c: LngLat) => boundaries.find(b => b.kind !== 'quarter' && b.kind !== 'suburb' && b.rings.some(r => pointInRing(c, r)))?.name ?? boundaries.find(b => b.rings.some(r => pointInRing(c, r)))?.name ?? '(outside boundaries)';

const features = [], byBuurt: Record<string, { n: number; m2: number }> = {}, byYear: Record<string, { n: number; m2: number }> = {}, bySource: Record<string, { n: number; m2: number }> = {};
const bump = (o: Record<string, { n: number; m2: number }>, k: string, m2: number) => { (o[k] ??= { n: 0, m2: 0 }).n++; o[k].m2 += m2; };
for (const g of gaps) {
  const rings = pands.get(g.id.replace('NL.IMBAG.Pand.', ''))!.rings;
  const h = newPandHeight(g.areaM2, neighbourHeights(g.centre));
  features.push(newPandFeature(g, rings, h));
  bump(byBuurt, buurtOf(g.centre), g.areaM2); bump(byYear, String(g.year), g.areaM2); bump(bySource, h.source, g.areaM2);
}
const round = (o: Record<string, { n: number; m2: number }>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1].m2 - a[1].m2).map(([k, v]) => [k, { n: v.n, m2: Math.round(v.m2) }]));
features.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'new-pands-supplement.geojson'), `${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
const report = {
  generatedAt: new Date().toISOString().slice(0, 10), source: `${WFS} (BAG pand, bouwjaar >= 2020, live)`, livePands2020plus: live.length, undrawnInTiles: gaps.length,
  totalM2: Math.round(gaps.reduce((a, g) => a + g.areaM2, 0)), byYear: round(byYear), bySource: round(bySource), byBuurt: round(byBuurt),
};
fs.writeFileSync(path.join(OUT, 'new-pands.report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, byBuurt: undefined }, null, 1));
void pandAreaM2;
