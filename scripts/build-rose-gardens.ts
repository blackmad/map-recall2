/**
 * Plant mapped Amsterdam rose gardens with instanced rose bushes.
 *
 *   npx tsx scripts/build-rose-gardens.ts [source.osm.pbf] [--publish]
 *
 * Without --publish it writes the staging file .cache/rose-gardens/rose-garden-data.js
 * and prints coverage (beds, bushes, area) per garden; --publish writes the
 * reviewed result into public/canal-drive/js/rose-garden-data.js (bundled into
 * inventory-trees.bundle.js).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {isRoseGarden, planRoseGarden, type LngLat, type Polygon, type RoseObstacles} from '../src/canalRecall/roseBeds.ts';

const args = process.argv.slice(2);
const publish = args.includes('--publish');
const source = args.find(a => !a.startsWith('--')) || '.cache/osm-source/Amsterdam.osm.pbf';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'amsterdam-roses-'));
const run = (a: string[]) => execFileSync('osmium', a, {stdio: ['ignore', 'ignore', 'inherit']});
type Feature = {id: string; geometry: {type: string; coordinates: any}; properties: Record<string, string>};
const read = (file: string): Feature[] => JSON.parse(fs.readFileSync(file, 'utf8')).features;

run(['extract', source, '-b', '4.75,52.28,5.03,52.44', '-o', `${work}/area.pbf`]);
run(['tags-filter', `${work}/area.pbf`, 'wr/leisure=garden', 'wr/landuse=flowerbed', '-o', `${work}/gardens.pbf`]);
run(['export', `${work}/gardens.pbf`, '-u', 'type_id', '-o', `${work}/gardens.geojson`]);
const polygons = (g: Feature['geometry']): Polygon[] => g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
const gardens = read(`${work}/gardens.geojson`).filter(f => f.id.startsWith('a') && polygons(f.geometry).length && isRoseGarden(f.properties));

const ringArea = (r: number[][], lat: number) => Math.abs(r.reduce((a, p, i) => {
  const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2 * 111320 * Math.cos(lat * Math.PI / 180) * 110540;
const PATH_WIDTH: Record<string, number> = {footway: 2.2, path: 2.2, pedestrian: 2.2, steps: 2, cycleway: 3, bridleway: 2.5,
  track: 3, service: 4, living_street: 5, residential: 6, unclassified: 6};
const POINT_RADIUS: Record<string, number> = {bench: 1, fountain: 2, waste_basket: .5, tree: 1, artwork: 1, information: .5, drinking_water: .6};
const BLOCKING = (p: Record<string, string>) => Boolean(p.highway || p['area:highway'] || p.building || p.amenity
  || p.natural === 'water' || p.natural === 'wood' || p.waterway || p.leisure === 'playground' || p.man_made
  || ['grass', 'forest', 'meadow'].includes(p.landuse) || p.place === 'square' || p.tourism === 'artwork' || p.historic);

// Municipal tree inventory: keep bushes clear of every surveyed trunk.
const treeIndex = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/municipal-trees/index.json', 'utf8'));
const tileKey = (lng: number, lat: number) => `15/${Math.floor((lng + 180) / 360 * 32768)}/${Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 32768)}`;
function municipalTrees(box: number[]): LngLat[] {
  const keys = new Set([tileKey(box[0], box[1]), tileKey(box[2], box[3]), tileKey(box[0], box[3]), tileKey(box[2], box[1])]);
  return treeIndex.tiles.filter((t: any) => keys.has(t.key)).flatMap((t: any) => {
    const raw = fs.readFileSync(path.join('public/data/extracts/amsterdam/municipal-trees', t.url));
    return JSON.parse((raw[0] === 0x1f ? gunzipSync(raw) : raw).toString()).trees;
  }).filter((t: any) => t.lng >= box[0] && t.lng <= box[2] && t.lat >= box[1] && t.lat <= box[3]).map((t: any) => [t.lng, t.lat]);
}

const plans = [], report = [];
for (const garden of gardens) {
  const polys = polygons(garden.geometry), pts = polys.flat(2);
  const lat = pts[0][1], pad = 0.0002;
  const box = [Math.min(...pts.map(p => p[0])) - pad, Math.min(...pts.map(p => p[1])) - pad,
    Math.max(...pts.map(p => p[0])) + pad, Math.max(...pts.map(p => p[1])) + pad];
  const gardenArea = polys.reduce((s, p) => s + ringArea(p[0], lat) - p.slice(1).reduce((h, r) => h + ringArea(r, lat), 0), 0);
  const slug = garden.id;
  run(['extract', `${work}/area.pbf`, '-b', box.join(','), '-s', 'complete_ways', '-o', `${work}/${slug}.pbf`]);
  run(['export', `${work}/${slug}.pbf`, '-u', 'type_id', '-o', `${work}/${slug}.geojson`]);
  const local = read(`${work}/${slug}.geojson`);
  const obstacles: RoseObstacles = {lines: [], polygons: [], points: []};
  for (const f of local) {
    const p = f.properties, g = f.geometry;
    if (f.id === garden.id) continue;
    if (g.type === 'LineString' && p.highway && PATH_WIDTH[p.highway] && p.area !== 'yes' && !p.tunnel) {
      const width = Math.min(6, Math.max(1, Number.parseFloat(p.width) || PATH_WIDTH[p.highway]));
      // Match park-landscape.js: the casing is width + 0.5 m wide.
      obstacles.lines.push({coordinates: g.coordinates, halfWidth: (width + .5) / 2});
    } else if (g.type === 'LineString' && ['hedge', 'fence', 'wall'].includes(p.barrier)) {
      obstacles.lines.push({coordinates: g.coordinates, halfWidth: p.barrier === 'hedge' ? .5 : .15});
    } else if (f.id.startsWith('a') && BLOCKING(p) && !isRoseGarden(p)) {
      for (const poly of polygons(g)) if (ringArea(poly[0], lat) < gardenArea * .8) obstacles.polygons.push(poly);
    } else if (g.type === 'Point') {
      const kind = p.amenity || p.natural || p.tourism;
      if (kind && POINT_RADIUS[kind]) obstacles.points.push({coordinates: g.coordinates, radius: POINT_RADIUS[kind]});
    }
  }
  for (const t of municipalTrees(box)) obstacles.points.push({coordinates: t, radius: 1.2});
  const name = garden.properties.name || garden.properties.description || 'Rose garden';
  const plan = planRoseGarden({id: garden.id, name, polygons: polys, obstacles});
  plans.push({...plan, osm: garden.id, tags: Object.fromEntries(Object.entries(garden.properties)
    .filter(([k]) => ['name', 'leisure', 'landuse', 'garden:type', 'description'].includes(k)))});
  const bedArea = plan.beds.reduce((s, b) => s + b.area, 0);
  report.push({id: garden.id, name, centre: plan.origin, gardenAreaM2: Math.round(gardenArea), beds: plan.beds.length,
    bedAreaM2: Math.round(bedArea), bushes: plan.bushes.length / 4,
    obstacles: {lines: obstacles.lines.length, polygons: obstacles.polygons.length, points: obstacles.points.length}});
}
const data = {version: 1, approximate: true,
  meaning: 'Rose bushes planted on derived beds inside OSM-mapped rose gardens. Garden outlines, paths and furniture are mapped; bed shapes are the clear space between them; individual bush positions, colours and density are deterministic presentation, not survey.',
  attribution: '© OpenStreetMap contributors, ODbL; tree trunks © Gemeente Amsterdam',
  gardens: plans};
const body = `// Generated by scripts/build-rose-gardens.ts; derived beds, presentational bush placement.\nexport default ${JSON.stringify(data)};\n`;
const out = publish ? 'public/canal-drive/js/rose-garden-data.js' : '.cache/rose-gardens/rose-garden-data.js';
fs.mkdirSync(path.dirname(out), {recursive: true});
if (publish && fs.existsSync(out)) {
  const previous = (await import(path.resolve(out) + `?t=${Date.now()}`)).default;
  console.log('Previous bushes per garden:', Object.fromEntries(previous.gardens.map((g: any) => [g.id, g.bushes.length / 4])));
}
fs.writeFileSync(out, body);
console.log(JSON.stringify({out, bytes: body.length, gardens: report}, null, 2));
