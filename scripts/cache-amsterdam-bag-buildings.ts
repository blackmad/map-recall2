/** Cache active BAG buildings inside Amsterdam's municipal boundary.
 * Usage: npm run cache:amsterdam-bag [-- --output=.cache/building-enrichment/bag-buildings.geojson]
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type Boundary = { name: string; kind: string; geometry: MultiPolygon; bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number } };
type BagFeature = { type: 'Feature'; id: string; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: Polygon } };
type BagPage = { features: BagFeature[]; links?: Array<{ rel: string; href: string }>; numberReturned?: number; timeStamp?: string };

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const boundaryFile = path.resolve(arg('boundary') || 'public/data/extracts/amsterdam/boundaries.json');
const outputFile = path.resolve(arg('output') || '.cache/building-enrichment/bag-buildings.geojson');
const refresh = process.argv.includes('--refresh');
const activeStatuses = new Set(['Pand in gebruik', 'Pand in gebruik (niet ingemeten)', 'Bouw gestart', 'Bouwvergunning verleend']);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchPage(url: string): Promise<BagPage> {
  let error: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/geo+json', 'User-Agent': 'MapRecallBuildingEnrichment/1.0' } });
      if (response.ok) return await response.json() as BagPage;
      error = new Error(`BAG HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (caught) { error = caught; }
    await wait(500 * 2 ** attempt);
  }
  throw error;
}

function ringContains([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContains(point: Point, polygon: Polygon): boolean {
  return ringContains(point, polygon[0]) && !polygon.slice(1).some(hole => ringContains(point, hole));
}

function boundaryContains([lon, lat]: Point, boundary: MultiPolygon): boolean {
  // Project boundary extracts predate our GeoJSON pipeline and store [lat, lon].
  return boundary.some(polygon => polygonContains([lat, lon], polygon));
}

function centroid(feature: BagFeature): Point {
  const ring = feature.geometry.coordinates[0];
  let area = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(area) < 1e-12) return ring[0];
  return [x / (3 * area), y / (3 * area)];
}

if (!refresh) {
  try {
    const existing = JSON.parse(await readFile(outputFile, 'utf8')) as { features?: unknown[] };
    if (existing.features?.length) {
      process.stdout.write(`Using ${existing.features.length} cached BAG buildings at ${path.relative(process.cwd(), outputFile)} (pass --refresh to update)\n`);
      process.exit(0);
    }
  } catch { /* cache miss */ }
}

const boundaries = JSON.parse(await readFile(boundaryFile, 'utf8')) as Boundary[];
const amsterdam = boundaries.find(item => item.name === 'Amsterdam' && item.kind === 'municipality');
if (!amsterdam) throw new Error(`Amsterdam municipality missing from ${boundaryFile}`);
const { minlon, minlat, maxlon, maxlat } = amsterdam.bounds;
let next: string | undefined = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${minlon},${minlat},${maxlon},${maxlat}&limit=1000&f=json`;
const features: BagFeature[] = [];
let fetched = 0, inactive = 0, outside = 0, pageNumber = 0, sourceTimestamp: string | undefined;
while (next) {
  const page = await fetchPage(next);
  sourceTimestamp ||= page.timeStamp;
  fetched += page.features.length;
  for (const feature of page.features) {
    if (!activeStatuses.has(String(feature.properties.status))) { inactive++; continue; }
    if (!boundaryContains(centroid(feature), amsterdam.geometry)) { outside++; continue; }
    feature.properties = { ...feature.properties, buildingId: `bag:${feature.properties.identificatie}`, source: 'BAG' };
    features.push(feature);
  }
  next = page.links?.find(link => link.rel === 'next')?.href;
  pageNumber++;
  process.stdout.write(`BAG page ${pageNumber}: ${fetched} fetched, ${features.length} active Amsterdam buildings\n`);
}

if (features.length < 10_000) {
  throw new Error(`BAG sanity check failed: only ${features.length} active buildings remained from ${fetched} bbox results`);
}

const collection = {
  type: 'FeatureCollection',
  metadata: {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceTimestamp,
    source: 'BAG OGC API v2 / pand',
    sourceUrl: 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand',
    license: 'Public Domain Mark 1.0',
    filter: { boundary: 'Amsterdam municipality', activeStatuses: [...activeStatuses], fetched, inactive, outside },
  },
  features,
};
await mkdir(path.dirname(outputFile), { recursive: true });
const temporary = `${outputFile}.tmp`;
await writeFile(temporary, JSON.stringify(collection));
await rename(temporary, outputFile);
process.stdout.write(`Wrote ${features.length} BAG buildings to ${path.relative(process.cwd(), outputFile)}\n`);
