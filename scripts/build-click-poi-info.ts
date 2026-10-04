// Preserve mapped place details discarded by the compact orientation labels.
// No network enrichment or invented addresses: all fields come from the same
// cached OSM export as the city's own POI layer.
import { createReadStream } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { ShapeUtils, Vector2 } from 'three';
import { classifyPoi } from '../src/canalRecall/poiCatalog';
import { poiInsideBuilding, validPoiWebsite, type ClickPoiFile, type ClickPoiRow, type PolygonGeometry } from '../src/canalRecall/clickPoiInfo';

const base = 'public/data/extracts/amsterdam';
const tiles = new Set<string>();
for (const x of await readdir(`${base}/building-tiles/14`)) {
  for (const file of await readdir(`${base}/building-tiles/14/${x}`)) {
    if (file.endsWith('.geojson.gz')) tiles.add(`${x}/${file.split('.')[0]}`);
  }
}
function covered(lng: number, lat: number): boolean {
  const n = 2 ** 14;
  return tiles.has(`${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`);
}

// For a mapped area choose a point inside an actual triangulated surface,
// never a bounding-box/centroid that can fall into a courtyard.
function areaPoint(geometry: PolygonGeometry): [number, number] | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let chosen: [number, number] | null = null, largest = 0;
  for (const rings of polygons) {
    if (!rings[0]?.length) continue;
    const [ox, oy] = rings[0][0];
    const vectors = rings.map(ring => {
      const points = ring.map(p => new Vector2(p[0] - ox, p[1] - oy));
      if (points.length > 1 && points[0].equals(points[points.length - 1])) points.pop();
      return points;
    });
    const all = vectors.flat();
    for (const [a, b, c] of ShapeUtils.triangulateShape(vectors[0], vectors.slice(1))) {
      const p = all[a], q = all[b], r = all[c];
      const area = Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
      const point: [number, number] = [ox + (p.x + q.x + r.x) / 3, oy + (p.y + q.y + r.y) / 3];
      if (area > largest && poiInsideBuilding(point, geometry)) { chosen = point; largest = area; }
    }
  }
  return chosen;
}

const labels: Record<string, string> = {
  restaurant: 'a restaurant', cafe: 'a café', pub: 'a pub', bar: 'a bar', fast_food: 'a fast-food restaurant', ice_cream: 'an ice-cream shop',
  books: 'a bookshop', clothes: 'a clothing shop', shoes: 'a shoe shop', cheese: 'a cheese shop', bakery: 'a bakery',
  supermarket: 'a supermarket', convenience: 'a convenience store', department_store: 'a department store',
  bicycle: 'a bicycle shop', bicycle_rental: 'a bicycle rental', place_of_worship: 'a place of worship',
  museum: 'a museum', gallery: 'a gallery', theatre: 'a theatre', cinema: 'a cinema', arts_centre: 'an arts centre',
  library: 'a library', hotel: 'a hotel', hostel: 'a hostel', guest_house: 'a guest house', attraction: 'an attraction',
  university: 'a university', school: 'a school', college: 'a college', kindergarten: 'a kindergarten',
  clinic: 'a clinic', hospital: 'a hospital', pharmacy: 'a pharmacy', community_centre: 'a community centre',
};
const points: ClickPoiRow[] = [];
const counts = { point: 0, area: 0, website: 0, address: 0, englishDescription: 0 };
for await (const line of createInterface({ input: createReadStream('.cache/osm-source/derived/amsterdam-places.geojsonseq') })) {
  if (!line.trim()) continue;
  const f = JSON.parse(line.replace(/^\x1e/, '')), tags = f.properties ?? {};
  const cls = classifyPoi(tags);
  if (!cls) continue;
  const id = `${String(tags['@type'])[0]}${tags['@id']}`;
  if (!/^[nwr]\d+$/.test(id)) continue;
  const g = f.geometry;
  // A park/campus/zoo area can cover many unrelated buildings. Only turn a
  // mapped area into an indoor point when OSM explicitly maps it as a building.
  if (g.type !== 'Point' && !tags.building && !tags['building:part']) continue;
  const at: [number, number] | null = g.type === 'Point' ? g.coordinates
    : g.type === 'Polygon' || g.type === 'MultiPolygon' ? areaPoint(g) : null;
  if (!at || !covered(...at)) continue;
  const kindKey = ['tourism','amenity','shop','leisure'].find(key => classifyPoi({ name: tags.name, [key]: tags[key] }));
  const kind = kindKey ? tags[kindKey] : cls.category;
  const website = validPoiWebsite(tags.website || tags['contact:website']);
  const street = tags['addr:street'] || '', number = tags['addr:housenumber'] || '';
  const address = [street, number].filter(Boolean).join(' ');
  const description = typeof tags['description:en'] === 'string' ? tags['description:en'].trim().slice(0, 800) : '';
  points.push([id, tags.name, at[0], at[1], cls.category, labels[kind] || `a ${kind.replaceAll('_', ' ')}`, address, website, description]);
  counts[g.type === 'Point' ? 'point' : 'area']++;
  if (website) counts.website++;
  if (address) counts.address++;
  if (description) counts.englishDescription++;
}
points.sort((a, b) => a[0].localeCompare(b[0]));
const file: ClickPoiFile = { version: 1, source: '© OpenStreetMap contributors (ODbL); cached Amsterdam extract', points };
await mkdir(base, { recursive: true });
await writeFile(`${base}/click-poi-info.json`, JSON.stringify(file));
console.log('Click POI info', JSON.stringify({ places: points.length, ...counts, bytes: JSON.stringify(file).length }));
