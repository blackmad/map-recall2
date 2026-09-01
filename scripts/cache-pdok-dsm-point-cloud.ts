/** Discover and cache pinned PDOK 2025 photogrammetric RGB DSM tiles for pilot roof planes. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import proj4 from 'proj4';
import type { RoofPlane } from '../src/canalRecall/building/facadePointCloud.ts';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment'); const limit = Number(arg('limit') || 5); const resolution = arg('resolution') || '20cm';
if (!['8cm', '20cm'].includes(resolution)) throw new Error('--resolution must be 8cm or 20cm.');
const collection = `digitaaloppervlaktemodel_${resolution}`; const directory = path.join(root, `pdok-dsm-point-cloud/2025-${resolution}`); await mkdir(directory, { recursive: true });
const surfaceManifest = JSON.parse(await readFile(path.join(root, 'panorama/facade-wall-planes.json'), 'utf8')) as { buildings: Array<{ buildingId: string; roofs: RoofPlane[] }> };
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725');
type Tile = { id: string; bladnr: string; downloadUrl: string; expectedBytes: number; imageryYear: number; observedFrom: string; observedThrough: string; buildingIds: string[]; file: string; sha256?: string; actualBytes?: number };
const tiles = new Map<string, Tile>(); const rejections: Array<{ buildingId: string; reason: string }> = [];
async function fetchWithRetry(url: string, timeout: number, attempts = 4): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      last = new Error(`HTTP ${response.status}`);
    } catch (error) { last = error; }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw last instanceof Error ? last : new Error('request failed');
}
for (const building of surfaceManifest.buildings.slice(0, limit)) {
  const points = building.roofs.flatMap((roof) => roof.vertices); if (!points.length) { rejections.push({ buildingId: building.buildingId, reason: 'no-roof-planes' }); continue; }
  const wgs = points.map(([x, y]) => proj4('EPSG:28992', 'EPSG:4326', [x, y]));
  const bbox = [Math.min(...wgs.map((point) => point[0])), Math.min(...wgs.map((point) => point[1])), Math.max(...wgs.map((point) => point[0])), Math.max(...wgs.map((point) => point[1]))];
  const endpoint = `https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1/collections/${collection}/items?bbox=${bbox.join(',')}&limit=20&f=json`;
  let response: Response;
  try { response = await fetchWithRetry(endpoint, 30_000); }
  catch { rejections.push({ buildingId: building.buildingId, reason: 'catalog-network-or-timeout' }); continue; }
  if (!response.ok) { rejections.push({ buildingId: building.buildingId, reason: `catalog-http-${response.status}` }); continue; }
  const result = await response.json(); const features = result.features || [];
  if (!features.length) { rejections.push({ buildingId: building.buildingId, reason: 'no-intersecting-dsm-tile' }); continue; }
  for (const feature of features) {
    const properties = feature.properties; const old = tiles.get(feature.id);
    tiles.set(feature.id, { id: feature.id, bladnr: properties.bladnr, downloadUrl: properties.download_link, expectedBytes: properties.download_size_bytes, imageryYear: properties.jaargang_luchtfoto, observedFrom: properties.startdatum, observedThrough: properties.einddatum, buildingIds: [...new Set([...(old?.buildingIds || []), building.buildingId])], file: `${properties.bladnr}.laz`, sha256: old?.sha256, actualBytes: old?.actualBytes });
  }
}
for (const tile of tiles.values()) {
  const file = path.join(directory, tile.file); let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const response = await fetchWithRetry(tile.downloadUrl, 120_000); if (!response.ok) throw new Error(`DSM ${tile.bladnr}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer()); if (bytes.subarray(0, 4).toString() !== 'LASF') throw new Error(`DSM ${tile.bladnr}: response is not LAS/LAZ`);
    await writeFile(`${file}.tmp`, bytes); await rename(`${file}.tmp`, file);
  }
  tile.actualBytes = bytes.length; tile.sha256 = createHash('sha256').update(bytes).digest('hex');
}
const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: { name: 'PDOK 3D Basisvoorziening', collection, license: 'CC BY 4.0', imageryYear: 2025, crs: 'EPSG:7415', catalog: `https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1/collections/${collection}` }, selection: { buildingLimit: limit, buildingCount: surfaceManifest.buildings.slice(0, limit).length }, tiles: [...tiles.values()], rejections };
const manifestFile = path.join(directory, 'manifest.json'); await writeFile(`${manifestFile}.tmp`, `${JSON.stringify(output, null, 2)}\n`); await rename(`${manifestFile}.tmp`, manifestFile);
process.stdout.write(`Cached ${tiles.size} pinned 2025 DSM ${resolution} RGB tiles for ${limit} buildings; ${rejections.length} rejected.\n`);
