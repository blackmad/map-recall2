/**
 * Fetch every OSM `landuse=allotments` polygon in the game's bounding box (Overpass, ODbL) into
 * review-data/allotment-houses/allotment-areas-osm.geojson, then count the buildings inside each one that the two
 * existing parks (park-boundaries.geojson) do not cover. These are the volkstuinen the garden-hut rendering
 * (allotmentHouses.ts) would take over once scripts/build-allotment-houses.ts / build-lod1-city.ts re-run with the
 * wider boundary list. The same polygons are the ground lane's source for garden (not pavement) ground colour.
 *
 * Usage: tsx scripts/fetch-allotment-areas.ts [--offline]   (offline: only recount from the saved file)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const OUT = 'review-data/allotment-houses/allotment-areas-osm.geojson';
const BASE = 'public/data/extracts/amsterdam';
const BBOX = '52.27,4.72,52.43,5.11';

type Ring = Array<[number, number]>;
if (!process.argv.includes('--offline') || !existsSync(OUT)) {
  const query = `[out:json][timeout:60];(way["landuse"="allotments"](${BBOX});relation["landuse"="allotments"](${BBOX}););out geom tags;`;
  let response!: Response;
  for (const host of ['https://overpass-api.de', 'https://overpass.kumi.systems', 'https://lz4.overpass-api.de']) {
    response = await fetch(`${host}/api/interpreter`, { method: 'POST', headers: { 'User-Agent': 'map-recall2-research/1.0 (whizziwig@gmail.com)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
    if (response.ok) break;
  }
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  const data = await response.json() as { osm3s: { timestamp_osm_base: string }; elements: any[] };
  const features = data.elements.flatMap(e => {
    const rings: Ring[] = e.type === 'way' ? [e.geometry.map((p: any) => [p.lon, p.lat])] : (e.members ?? []).filter((m: any) => m.role === 'outer' && m.geometry).map((m: any) => m.geometry.map((p: any) => [p.lon, p.lat]));
    return rings.filter(r => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1])
      .map(r => ({ type: 'Feature', properties: { '@type': e.type, '@id': e.id, landuse: 'allotments', name: e.tags?.name ?? null }, geometry: { type: 'Polygon', coordinates: [r] } }));
  });
  writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', source: 'OpenStreetMap contributors (ODbL), Overpass landuse=allotments', fetchedAtOsmBase: data.osm3s.timestamp_osm_base, bbox: BBOX, features }));
  console.log(`saved ${features.length} allotment polygons`);
}

const areas = JSON.parse(readFileSync(OUT, 'utf8')).features as Array<{ properties: { '@id': number; name: string | null }; geometry: { coordinates: Ring[] } }>;
const existing = new Set((JSON.parse(readFileSync('review-data/allotment-houses/park-boundaries.geojson', 'utf8')).features as any[]).map(f => f.properties['@id']));
const inRing = (x: number, y: number, ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const bbox = (r: Ring) => r.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const boxes = areas.map(a => bbox(a.geometry.coordinates[0]));
const counts = areas.map(() => ({ buildings: 0, small: 0, bag: 0 }));
for (const x of readdirSync(`${BASE}/building-tiles/14`)) for (const file of readdirSync(`${BASE}/building-tiles/14/${x}`)) {
  const features = JSON.parse(gunzipSync(readFileSync(`${BASE}/building-tiles/14/${x}/${file}`)).toString()).features as any[];
  for (const f of features) {
    const ring: Ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    areas.forEach((a, i) => {
      const b = boxes[i];
      if (cx < b[0] || cx > b[2] || cy < b[1] || cy > b[3] || !inRing(cx, cy, a.geometry.coordinates[0])) return;
      counts[i].buildings++;
      if (f.properties.allotmentHouse) counts[i].small++;
      else if (String(f.properties.id).startsWith('NL.IMBAG')) counts[i].bag++;
    });
  }
}
let uncovered = 0, uncoveredBag = 0;
const rows = areas.map((a, i) => ({ id: a.properties['@id'], name: a.properties.name ?? '(unnamed)', covered: existing.has(a.properties['@id']), ...counts[i] })).filter(r => r.buildings > 0).sort((p, q) => q.buildings - p.buildings);
for (const r of rows) { if (!r.covered) { uncovered += r.buildings; uncoveredBag += r.bag; } console.log(`${r.covered ? 'covered ' : 'NOT yet '} way ${r.id} ${r.name.padEnd(34)} buildings ${String(r.buildings).padStart(4)}  already garden-house ${String(r.small).padStart(4)}  BAG pands ${r.bag}`);
}
console.log(`allotment polygons ${areas.length}, with buildings ${rows.length}; buildings in polygons the hut rendering does not cover yet: ${uncovered} (${uncoveredBag} are BAG pands, which the shed rule already draws as sheds)`);
