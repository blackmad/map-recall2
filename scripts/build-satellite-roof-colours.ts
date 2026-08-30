/**
 * Sample real roof colours from aerial imagery.
 *
 * OSM tags a roof colour for almost nobody: of the 10,578 Amsterdam buildings
 * that carry any appearance tag at all, the roof colour shipped today is
 * simply a copy of the wall colour, so from above the city reads as one flat
 * material. The Netherlands publishes 8 cm open aerial imagery through PDOK,
 * which is more than enough to read the colour of an individual roof, so the
 * colour can be measured instead of guessed.
 *
 * Method, per building:
 *   1. project the footprint into Web Mercator metres;
 *   2. fetch the imagery tile covering it (tiles are shared between buildings
 *      and cached on disk, so a dense block costs one request);
 *   3. sample the pixels strictly inside the footprint, shrunk by one pixel so
 *      gutters, shadows on neighbouring walls and street furniture stay out;
 *   4. take the per-channel median — robust against a skylight, a tree
 *      overhanging a corner, or a car parked on a courtyard roof;
 *   5. reject the reading if there are too few pixels to be meaningful, or if
 *      the spread is so wide that the "roof" is probably a garden or a car
 *      park rather than a surface with a colour.
 *
 * Imagery: PDOK "Actueel_orthoHR", open data, no key. Sentinel-2 is the
 * Europe-wide fallback for other cities, but at 10 m per pixel it can only
 * colour a city block, not a roof — the resolution is the reason this is
 * worth doing here first.
 *
 * Usage:
 *   npm run build:roof-colours -- [--limit=500] [--dry-run] [--cache=DIR]
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';

type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
type Building = {
  type: 'Feature';
  properties: Record<string, string | number | undefined>;
  geometry: Geometry;
};

const directory = path.resolve('public/data/extracts/amsterdam');
const buildingsFile = path.join(directory, 'buildings-colored.geojson');
const argument = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const dryRun = process.argv.includes('--dry-run');
const limit = Number(argument('limit') || Infinity);
const cacheDirectory = argument('cache') || path.resolve('.cache/pdok-ortho');

// Web Mercator metres — the imagery service speaks EPSG:3857 and so does the
// tile grid below, so nothing has to be reprojected per pixel.
const EARTH_RADIUS = 6378137;
const toMercator = ([lon, lat]: [number, number]): [number, number] => [
  (lon * Math.PI / 180) * EARTH_RADIUS,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * EARTH_RADIUS,
];

// 128 m of ground across 512 pixels: 25 cm per pixel, which is coarser than
// the imagery and fine for a colour, while keeping one tile per city block.
const TILE_METRES = 128;
const TILE_PIXELS = 512;
const METRES_PER_PIXEL = TILE_METRES / TILE_PIXELS;
const MIN_SAMPLES = 12;          // fewer pixels than this is not a measurement
const MAX_CHANNEL_SPREAD = 74;   // inter-quartile spread that means "not one surface"

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchTile(tileX: number, tileY: number): Promise<{ data: Uint8Array; width: number; height: number }> {
  const file = path.join(cacheDirectory, `${tileX}_${tileY}.jpg`);
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    const minX = tileX * TILE_METRES, minY = tileY * TILE_METRES;
    const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_orthoHR', STYLES: '',
      CRS: 'EPSG:3857', BBOX: `${minX},${minY},${minX + TILE_METRES},${minY + TILE_METRES}`,
      WIDTH: String(TILE_PIXELS), HEIGHT: String(TILE_PIXELS), FORMAT: 'image/jpeg',
    }).toString();
    let response: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(url, { headers: { 'User-Agent': 'MapRecallRoofSampler/1.0' } });
      if (response.ok) break;
      await wait(500 * (attempt + 1));
    }
    if (!response || !response.ok) throw new Error(`PDOK tile ${tileX},${tileY}: HTTP ${response?.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(file, bytes);
    await wait(60); // be a considerate client of a free public service
  }
  const image = jpeg.decode(bytes, { useTArray: true });
  return { data: image.data, width: image.width, height: image.height };
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};
const spread = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)];
};
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const outerRings = (geometry: Geometry): Ring[] =>
  geometry.type === 'Polygon' ? geometry.coordinates.slice(0, 1) : geometry.coordinates.map(polygon => polygon[0]);

const source = JSON.parse(await readFile(buildingsFile, 'utf8')) as { type: string; features: Building[] };
const buildings = source.features.slice(0, Number.isFinite(limit) ? limit : undefined);

// Group by tile so each image is fetched, decoded and dropped once.
const byTile = new Map<string, Building[]>();
for (const building of buildings) {
  const ring = outerRings(building.geometry)[0];
  if (!ring || ring.length < 4) continue;
  const points = ring.map(toMercator);
  const centreX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const centreY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const key = `${Math.floor(centreX / TILE_METRES)},${Math.floor(centreY / TILE_METRES)}`;
  (byTile.get(key) || byTile.set(key, []).get(key)!).push(building);
}

let sampled = 0, tooSmall = 0, tooMixed = 0, failedTiles = 0, keptOsm = 0;
const tiles = [...byTile.entries()];
for (let index = 0; index < tiles.length; index++) {
  const [key, members] = tiles[index];
  const [tileX, tileY] = key.split(',').map(Number);
  let tile: Awaited<ReturnType<typeof fetchTile>>;
  try {
    tile = await fetchTile(tileX, tileY);
  } catch (error) {
    failedTiles++;
    continue;
  }
  const originX = tileX * TILE_METRES, originY = tileY * TILE_METRES;
  for (const building of members) {
    const ring = outerRings(building.geometry)[0].map(toMercator);
    // Footprint in tile pixel space; y is flipped because images run downward.
    const pixels = ring.map(([x, y]) => [
      (x - originX) / METRES_PER_PIXEL,
      TILE_PIXELS - (y - originY) / METRES_PER_PIXEL,
    ] as [number, number]);
    const minX = Math.max(1, Math.floor(Math.min(...pixels.map(point => point[0]))));
    const maxX = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...pixels.map(point => point[0]))));
    const minY = Math.max(1, Math.floor(Math.min(...pixels.map(point => point[1]))));
    const maxY = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...pixels.map(point => point[1]))));
    const reds: number[] = [], greens: number[] = [], blues: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Half-pixel centre, and require the four neighbours to be inside too,
        // which is a cheap one-pixel erosion of the footprint.
        if (!pointInRing(x + 0.5, y + 0.5, pixels)) continue;
        if (!pointInRing(x - 0.5, y + 0.5, pixels) || !pointInRing(x + 1.5, y + 0.5, pixels)
          || !pointInRing(x + 0.5, y - 0.5, pixels) || !pointInRing(x + 0.5, y + 1.5, pixels)) continue;
        const offset = (y * tile.width + x) * 4;
        reds.push(tile.data[offset]);
        greens.push(tile.data[offset + 1]);
        blues.push(tile.data[offset + 2]);
      }
    }
    if (reds.length < MIN_SAMPLES) { tooSmall++; continue; }
    if (Math.max(spread(reds), spread(greens), spread(blues)) > MAX_CHANNEL_SPREAD) { tooMixed++; continue; }
    // A roof colour that differs from the wall colour was tagged by a mapper
    // who looked at the building; that beats a measurement taken through
    // whatever the weather was doing on the day of the flight.
    if (building.properties.roofColour && building.properties.roofColour !== building.properties.colour) {
      keptOsm++;
      continue;
    }
    building.properties.roofColour = toHex(median(reds), median(greens), median(blues));
    building.properties.roofSource = 'aerial';
    sampled++;
  }
  if ((index + 1) % 50 === 0) {
    process.stdout.write(`  ${index + 1}/${tiles.length} tiles — ${sampled} roofs sampled\n`);
  }
}

process.stdout.write(`tiles: ${tiles.length} (${failedTiles} failed)\n`);
process.stdout.write(`roofs sampled: ${sampled}\n`);
process.stdout.write(`skipped — too few pixels: ${tooSmall}, too mixed to be one surface: ${tooMixed}, OSM roof colour kept: ${keptOsm}\n`);
if (dryRun) {
  process.stdout.write('DRY RUN — nothing written\n');
} else {
  await writeFile(buildingsFile, JSON.stringify(source));
  const bytes = (await stat(buildingsFile)).size;
  process.stdout.write(`wrote ${path.relative(process.cwd(), buildingsFile)} (${(bytes / 1e6).toFixed(1)} MB)\n`);
}
