/**
 * Give every building in the city a colour, a measured height and a BAG name.
 *
 * Staging only. This writes nothing into `public/data/extracts/`; it publishes
 * into `.cache/3dbag-appearance/` and reports coverage so the result can be
 * reviewed before anything renders it.
 *
 * Why this source. The game currently colours 10,578 Amsterdam buildings from
 * OSM appearance tags and an aerial roof sample, and paints every other
 * building with a four-stop grey ramp keyed on height. 3DBAG is the one open
 * source that covers all of them: it is BAG-keyed, CC BY 4.0, and carries the
 * construction year plus roof and ground levels derived from AHN laser
 * altimetry. So one download supplies both the identity to join on and the two
 * things the renderer is currently inventing — height and era.
 *
 * Why tiles and not the API. `api.3dbag.nl` caps a page at 50 features and
 * took 39 seconds to answer for a single square kilometre holding 5,531
 * buildings; that is about 72 minutes per km², against roughly 220 km² of
 * Amsterdam. The tile index gives versioned, checksummed CityJSON downloads
 * instead, so this uses those and verifies what it got.
 *
 * Usage:
 *   tsx scripts/build-3dbag-appearance.ts --bbox=<minLon,minLat,maxLon,maxLat>
 *                                         [--city=amsterdam] [--limit-tiles=N]
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import {
  type AppearanceSource, measuredHeight, resolveAppearance,
} from '../src/canalRecall/buildingAppearance.ts';

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const city = argument('city') || 'amsterdam';
// Central Amsterdam by default: enough to include the canal ring, the Jordaan
// and the Pijp, which is where the game's routes actually are.
const bbox = (argument('bbox') || '4.870,52.360,4.920,52.385').split(',').map(Number);
const tileLimit = Number(argument('limit-tiles') || 12);
const cacheDirectory = path.resolve('.cache/3dbag-tiles');
const outputDirectory = path.resolve('.cache/3dbag-appearance');

if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
  process.stderr.write('--bbox needs minLon,minLat,maxLon,maxLat\n');
  process.exit(2);
}

/** WGS84 to RD (EPSG:28992), which is the only CRS the tile index speaks.
 *  The approximation is the standard Kadaster polynomial, good to centimetres
 *  over the Netherlands — far below the size of a tile. */
function toRd(lon: number, lat: number): [number, number] {
  const dLat = 0.36 * (lat - 52.15517440);
  const dLon = 0.36 * (lon - 5.38720621);
  const x = 155000
    + 190094.945 * dLon - 11832.228 * dLat * dLon - 114.221 * dLon * dLat ** 2
    - 32.391 * dLon ** 3 - 2.340 * dLat ** 3 * dLon - 0.608 * dLat * dLon ** 3
    + 0.148 * dLon ** 5 - 0.916 * dLat ** 2 * dLon ** 3;
  const y = 463000
    + 309056.544 * dLat + 3638.893 * dLon ** 2 + 73.077 * dLat ** 2
    - 157.984 * dLat * dLon ** 2 + 59.788 * dLat ** 3 + 0.433 * dLon
    - 6.439 * dLon ** 4 - 0.032 * dLat * dLon ** 4 + 0.092 * dLon ** 6;
  return [x, y];
}

const [minX, minY] = toRd(bbox[0], bbox[1]);
const [maxX, maxY] = toRd(bbox[2], bbox[3]);

interface TileRow {
  tile_id: string;
  cj_download: string;
  cj_sha256: string;
  cj_nr_building: number;
}

process.stdout.write(`3DBAG tiles over RD ${minX.toFixed(0)},${minY.toFixed(0)} ${maxX.toFixed(0)},${maxY.toFixed(0)}\n`);
const indexUrl = new URL('https://data.3dbag.nl/api/BAG3D/wfs');
indexUrl.search = new URLSearchParams({
  service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: 'BAG3D:tiles',
  outputFormat: 'json', bbox: `${minX},${minY},${maxX},${maxY}`,
}).toString();
const index = await fetch(indexUrl).then((response) => {
  if (!response.ok) throw new Error(`tile index HTTP ${response.status}`);
  return response.json() as Promise<{ features: { properties: TileRow }[] }>;
});
const tiles = index.features.map((feature) => feature.properties)
  .filter((tile) => tile.cj_download)
  .sort((a, b) => b.cj_nr_building - a.cj_nr_building)
  .slice(0, tileLimit);
process.stdout.write(`${index.features.length} tiles intersect; taking ${tiles.length}\n`);

await mkdir(cacheDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

const sha256 = async (file: string) => {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
};

/**
 * One tile on disk, verified.
 *
 * The index publishes a sha256 per tile, so a truncated or half-written
 * download is caught here rather than surfacing later as a tile of missing
 * buildings. A cached file whose digest no longer matches the index is a new
 * dataset version, not a corruption, and is re-fetched.
 */
async function fetchTile(tile: TileRow): Promise<string | undefined> {
  const gzPath = path.join(cacheDirectory, `${tile.tile_id.replace(/\//g, '-')}.city.json.gz`);
  const jsonPath = gzPath.replace(/\.gz$/, '');
  const cached = await stat(gzPath).then((info) => info.size > 0, () => false);
  if (!cached) {
    const response = await fetch(tile.cj_download);
    if (!response.ok) {
      process.stdout.write(`  ${tile.tile_id}: HTTP ${response.status}\n`);
      return undefined;
    }
    await writeFile(`${gzPath}.part`, Buffer.from(await response.arrayBuffer()));
    const { rename } = await import('node:fs/promises');
    await rename(`${gzPath}.part`, gzPath);
  }
  const digest = await sha256(gzPath);
  if (tile.cj_sha256 && digest !== tile.cj_sha256) {
    process.stdout.write(`  ${tile.tile_id}: checksum mismatch, refetching once\n`);
    const response = await fetch(tile.cj_download);
    if (!response.ok) return undefined;
    await writeFile(gzPath, Buffer.from(await response.arrayBuffer()));
    if (await sha256(gzPath) !== tile.cj_sha256) {
      process.stdout.write(`  ${tile.tile_id}: still mismatched, skipped\n`);
      return undefined;
    }
  }
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(jsonPath));
  return jsonPath;
}

interface CityJson {
  CityObjects: Record<string, {
    type: string;
    attributes?: Record<string, unknown>;
    geometry?: { type: string; lod?: string; boundaries: unknown }[];
    parents?: string[];
  }>;
  vertices: [number, number, number][];
  transform: { scale: [number, number, number]; translate: [number, number, number] };
}

/** RD back to WGS84, the inverse of `toRd` at the same accuracy. */
function toWgs(x: number, y: number): [number, number] {
  const dX = (x - 155000) / 100000;
  const dY = (y - 463000) / 100000;
  const lat = 52.15517440
    + (3235.65389 * dY - 32.58297 * dX ** 2 - 0.24750 * dY ** 2 - 0.84978 * dX ** 2 * dY
      - 0.06550 * dY ** 3 - 0.01709 * dX ** 2 * dY ** 2 - 0.00738 * dX
      + 0.00530 * dX ** 4 - 0.00039 * dX ** 2 * dY ** 3 + 0.00033 * dX ** 4 * dY
      - 0.00012 * dX * dY) / 3600;
  const lon = 5.38720621
    + (5260.52916 * dX + 105.94684 * dX * dY + 2.45656 * dX * dY ** 2
      - 0.81885 * dX ** 3 + 0.05594 * dX * dY ** 3 - 0.05607 * dX ** 3 * dY
      + 0.01199 * dY + 0.00256 * dX ** 3 * dY ** 2 + 0.00128 * dX * dY ** 4
      + 0.00022 * dY ** 2 - 0.00022 * dX ** 2 * dY + 0.00026 * dX ** 5) / 3600;
  return [lon, lat];
}

interface BuildingRecord {
  bagId: string;
  constructionYear?: number;
  height?: number;
  roofType?: string;
  wallColour: string;
  roofColour: string;
  wallSource: AppearanceSource;
  roofSource: AppearanceSource;
  era?: string;
  footprint: [number, number][];
}

const records: BuildingRecord[] = [];
const counts = {
  objects: 0, buildings: 0, withYear: 0, withHeight: 0, withFootprint: 0,
  heightRejected: 0, yearRejected: 0,
};
const bySource: Record<string, number> = {};
const byEra: Record<string, number> = {};

for (const tile of tiles) {
  const file = await fetchTile(tile);
  if (!file) continue;
  const cityJson = JSON.parse(await readFile(file, 'utf8')) as CityJson;
  const { scale, translate } = cityJson.transform;
  const vertex = (index: number): [number, number] => {
    const [vx, vy] = cityJson.vertices[index];
    return toWgs(vx * scale[0] + translate[0], vy * scale[1] + translate[1]);
  };

  for (const [id, object] of Object.entries(cityJson.CityObjects)) {
    counts.objects++;
    if (object.type !== 'Building') continue;
    counts.buildings++;
    const attributes = object.attributes || {};
    const rawYear = attributes.oorspronkelijkbouwjaar;
    const constructionYear = typeof rawYear === 'number' ? rawYear
      : typeof rawYear === 'string' ? Number(rawYear) : undefined;
    const height = measuredHeight(
      attributes.b3_h_dak_50p as number | undefined,
      attributes.b3_h_maaiveld as number | undefined,
    );
    if (constructionYear !== undefined) counts.withYear++;
    if (height !== undefined) counts.withHeight++;
    else if (attributes.b3_h_dak_50p !== undefined) counts.heightRejected++;

    const appearance = resolveAppearance({ constructionYear });
    if (!appearance.era && constructionYear !== undefined) counts.yearRejected++;
    bySource[appearance.wallSource] = (bySource[appearance.wallSource] || 0) + 1;
    if (appearance.era) byEra[appearance.era] = (byEra[appearance.era] || 0) + 1;

    // The LoD0 surface is the footprint: one ring of ground-level vertices.
    const lod0 = object.geometry?.find((geometry) => geometry.lod === '0');
    let footprint: [number, number][] = [];
    if (lod0) {
      const rings = lod0.boundaries as number[][][] | number[][];
      const outer = Array.isArray(rings[0]) && Array.isArray((rings as number[][][])[0][0])
        ? (rings as number[][][])[0][0]
        : (rings as number[][])[0];
      if (Array.isArray(outer)) footprint = outer.map((index) => vertex(index as unknown as number));
    }
    if (footprint.length >= 3) counts.withFootprint++;

    records.push({
      bagId: id, constructionYear, height,
      roofType: attributes.b3_dak_type as string | undefined,
      wallColour: appearance.wallColour, roofColour: appearance.roofColour,
      wallSource: appearance.wallSource, roofSource: appearance.roofSource,
      era: appearance.era, footprint,
    });
  }
  process.stdout.write(`  ${tile.tile_id}: ${counts.buildings} buildings so far\n`);
}

// --- What the current extract covers, for the comparison that matters ------
const existingPath = path.resolve(`public/data/extracts/${city}/buildings-colored.geojson`);
const existing = await readFile(existingPath, 'utf8')
  .then((contents) => (JSON.parse(contents) as { features: unknown[] }).features.length)
  .catch(() => 0);

const geojson = {
  type: 'FeatureCollection',
  features: records.filter((record) => record.footprint.length >= 3).map((record) => ({
    type: 'Feature',
    // CityJSON does not repeat the first vertex to close a ring; GeoJSON
    // requires it. An unclosed ring is not a rendering nuisance, it is invalid
    // GeoJSON, and consumers differ on whether they repair it or drop it.
    geometry: { type: 'Polygon', coordinates: [[...record.footprint, record.footprint[0]]] },
    properties: {
      bagId: record.bagId, height: record.height, roofType: record.roofType,
      constructionYear: record.constructionYear, era: record.era,
      colour: record.wallColour, roofColour: record.roofColour,
      wallSource: record.wallSource, roofSource: record.roofSource,
    },
  })),
};
const stagingFile = path.join(outputDirectory, `${city}-buildings.staging.geojson`);
await writeFile(stagingFile, JSON.stringify(geojson));

const report = {
  generatedAt: new Date().toISOString(),
  city, bbox, tilesRequested: tiles.length,
  source: { name: '3DBAG', licence: 'CC BY 4.0', index: indexUrl.toString() },
  counts, bySource, byEra,
  existingExtractFeatures: existing,
};
await writeFile(path.join(outputDirectory, `${city}-coverage.json`), `${JSON.stringify(report, null, 2)}\n`);

process.stdout.write(`\nbuildings: ${counts.buildings}\n`);
process.stdout.write(`  with a usable construction year: ${counts.withYear - counts.yearRejected}\n`);
process.stdout.write(`  with a measured height: ${counts.withHeight} (${counts.heightRejected} rejected)\n`);
process.stdout.write(`  with a footprint: ${counts.withFootprint}\n`);
process.stdout.write(`  wall colour source: ${JSON.stringify(bySource)}\n`);
process.stdout.write(`  eras: ${JSON.stringify(byEra)}\n`);
process.stdout.write(`today's whole-city extract carries ${existing} appearance-backed buildings\n`);
process.stdout.write(`staged: ${stagingFile}\n`);
