/**
 * Draw the BAG gaps held as `over-road` (a road runs through the outline) from
 * their 3DBAG LoD1.3 roof parts instead of one box: parts with no road under
 * them stand on the ground, parts over a road are decks above the clearance
 * (`overRoadPartFeatures` in src/canalRecall/bagGaps.ts). Only holds where AHN
 * sees a real mass (>= MIN_LARGE_FILL_HEIGHT_M); the low ones are car parks.
 *
 *   node --import tsx scripts/fill-over-road-holes.ts          # stage scripts/data/bag-gaps/over-road-parts.geojson, report
 *   node --import tsx scripts/fill-over-road-holes.ts --write  # also put the parts into building-tiles and bag-tiles
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { lod13RoofFaces, polygonAreaM2 } from '../src/canalRecall/towerPodium';
import { rdToLngLat } from '../src/canalRecall/rdCoordinates';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles';
import { DECK_ROAD_INSET_M, MIN_LARGE_FILL_HEIGHT_M, overRoadPartFeatures, type PartFace, type PartFeature } from '../src/canalRecall/bagGaps';
import { centrelineInsideM } from '../src/canalRecall/undergroundBuildings';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles';
import type { CityJson } from '../src/canalRecall/bag3dCityJson';

const write = process.argv.includes('--write');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const STAGED = path.join('scripts', 'data', 'bag-gaps', 'over-road-parts.geojson');
type LngLat = [number, number];

const survey = JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'bag-gaps', 'bag-gaps.json'), 'utf8')) as
  { rerun20261030?: { notFilledForReview: { id: string; why: string; height?: number }[] } };
const held = (survey.rerun20261030?.notFilledForReview ?? []).filter(h => h.why === 'over-road' && (h.height ?? 0) >= MIN_LARGE_FILL_HEIGHT_M);

// Same car-road classes as the survey's over-road measure.
const CAR = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link', 'busway']);
const streets = JSON.parse(fs.readFileSync(path.join(ROOT, 'streets-routing.json'), 'utf8')) as { highway?: string; path: [number, number][]; paths?: [number, number][][] }[];
const segments: [LngLat, LngLat][] = [];
for (const street of streets) if (CAR.has(street.highway ?? '')) for (const line of street.paths ?? [street.path]) for (let i = 1; i < line.length; i++) segments.push([[line[i - 1][1], line[i - 1][0]], [line[i][1], line[i][0]]]);

const cache = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
const parts: PartFeature[] = [];
const report: Record<string, unknown>[] = [];
for (const hold of held) {
  const file = fs.readdirSync(cache).find(name => name.endsWith('.city.json.gz') && zlib.gunzipSync(fs.readFileSync(path.join(cache, name))).includes(hold.id));
  if (!file) { report.push({ id: hold.id, skipped: 'not in the 3DBAG cache' }); continue; }
  const city = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cache, file))).toString('utf8')) as CityJson;
  const object = city.CityObjects[hold.id]!;
  const { scale, translate } = city.transform;
  const rd = (i: number): [number, number, number] | undefined => {
    const v = city.vertices[i];
    return v ? [v[0] * scale[0] + translate[0], v[1] * scale[1] + translate[1], v[2] * scale[2] + translate[2]] : undefined;
  };
  const ground = Number(object.attributes?.b3_h_maaiveld ?? 0);
  const faces: PartFace[] = lod13RoofFaces(city.CityObjects as never, object as never, rd, ground).map(face => {
    const rings = face.polygon.map(ring => ring.map(([x, y]) => rdToLngLat(x, y) as LngLat));
    return { rings, topM: face.topM, areaM2: polygonAreaM2(face.polygon), roadInsideM: centrelineInsideM([rings], segments, DECK_ROAD_INSET_M) };
  });
  const year = typeof object.attributes?.oorspronkelijkbouwjaar === 'number' ? object.attributes.oorspronkelijkbouwjaar : null;
  const drawn = overRoadPartFeatures(hold.id, faces, year);
  parts.push(...drawn);
  report.push({ id: hold.id, faces: faces.length, ground: drawn.filter(p => p.properties.minHeight === 0).length, decks: drawn.filter(p => p.properties.minHeight > 0).length, left: faces.length - drawn.length });
}
fs.writeFileSync(STAGED, `${JSON.stringify({ type: 'FeatureCollection', features: parts })}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);

if (write) {
  const pands = new Set(parts.map(p => p.properties.pand));
  for (const dir of ['building-tiles', 'bag-tiles']) {
    const byTile = new Map<string, PartFeature[]>();
    for (const part of parts) {
      const ring = part.geometry.coordinates[0], c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
      const key = tileKey(tileFor(c[0], c[1], 14));
      byTile.set(key, [...(byTile.get(key) ?? []), part]);
    }
    let delta = 0;
    for (const [key, added] of byTile) {
      const file = path.join(ROOT, dir, `${key}.geojson.gz`);
      const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as { features: { properties: Record<string, unknown> }[] };
      const kept = tile.features.filter(f => !pands.has(String(f.properties.pand ?? '')) || !String(f.properties.id).startsWith('part:'));
      delta += added.length - (tile.features.length - kept.length);
      const features = [...kept, ...added];
      fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
    }
    const indexFile = path.join(ROOT, dir, 'index-z14.json');
    const index = fs.readFileSync(indexFile, 'utf8');
    fs.writeFileSync(indexFile, index.replace(/"features": (\d+),/, (_, n) => `"features": ${Number(n) + delta},`));
    process.stdout.write(`${dir}: ${delta >= 0 ? '+' : ''}${delta} features in ${byTile.size} tiles\n`);
  }
}
