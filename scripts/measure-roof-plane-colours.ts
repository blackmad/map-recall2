/** Measure unaccepted roof-plane colours from pinned PDOK imagery and 3DBAG LoD2.2 geometry. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import proj4 from 'proj4';
import type { RoofPlane } from '../src/canalRecall/building/facadePointCloud.ts';

type Point = readonly [number, number];
type Sample = { red: number[]; green: number[]; blue: number[]; total: number; shadow: number; vegetation: number; glare: number; tiles: Set<string> };
const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment');
const input = path.resolve(arg('surfaces') || path.join(root, 'panorama/facade-wall-planes.json'));
const output = path.resolve(arg('output') || path.join(root, 'roof-plane-colour-proposals.json'));
const imageryYear = Number(arg('imagery-year') || 2025);
if (!Number.isInteger(imageryYear) || imageryYear < 2021 || imageryYear > 2026) throw new Error('--imagery-year must name an available final high-resolution layer (2021–2026).');
const layer = `${imageryYear}_orthoHR`;
const tileDirectory = path.join(root, `pdok-roof-plane-tiles/${layer}`);
await mkdir(tileDirectory, { recursive: true });
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725');
const toMercator = (point: Point) => proj4('EPSG:28992', 'EPSG:3857', point) as [number, number];
const manifest = JSON.parse(await readFile(input, 'utf8')) as { buildings: Array<{ buildingId: string; roofs: RoofPlane[] }> };
const roofs = manifest.buildings.flatMap((building) => building.roofs || []);
const TILE_METRES = 128; const TILE_PIXELS = 1024; const METRES_PER_PIXEL = TILE_METRES / TILE_PIXELS; const EDGE_INSET_PIXELS = Math.ceil(0.375 / METRES_PER_PIXEL);
const projected = roofs.map((roof) => roof.vertices.map(([x, y]) => toMercator([x, y])));
const tileMembers = new Map<string, number[]>();
projected.forEach((polygon, roofIndex) => {
  const minX = Math.min(...polygon.map((point) => point[0])); const maxX = Math.max(...polygon.map((point) => point[0]));
  const minY = Math.min(...polygon.map((point) => point[1])); const maxY = Math.max(...polygon.map((point) => point[1]));
  for (let ty = Math.floor(minY / TILE_METRES); ty <= Math.floor(maxY / TILE_METRES); ty += 1) for (let tx = Math.floor(minX / TILE_METRES); tx <= Math.floor(maxX / TILE_METRES); tx += 1) {
    const key = `${tx},${ty}`; const members = tileMembers.get(key) || []; members.push(roofIndex); tileMembers.set(key, members);
  }
});
const inside = ([x, y]: Point, polygon: readonly Point[]) => {
  let result = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index]; const [x2, y2] = polygon[previous];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) result = !result;
  }
  return result;
};
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function loadTile(tx: number, ty: number) {
  const file = path.join(tileDirectory, `${tx}_${ty}.jpg`); let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const minX = tx * TILE_METRES; const minY = ty * TILE_METRES;
    const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: layer, STYLES: '', CRS: 'EPSG:3857', BBOX: `${minX},${minY},${minX + TILE_METRES},${minY + TILE_METRES}`, WIDTH: String(TILE_PIXELS), HEIGHT: String(TILE_PIXELS), FORMAT: 'image/jpeg' }).toString();
    let error: unknown;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try { const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallBuildingEnrichment/1.0' }, signal: AbortSignal.timeout(30_000) }); if (response.ok) { bytes = Buffer.from(await response.arrayBuffer()); await writeFile(`${file}.tmp`, bytes); await rename(`${file}.tmp`, file); return jpeg.decode(bytes, { useTArray: true }); } error = new Error(`HTTP ${response.status}`); } catch (caught) { error = caught; }
      await wait(300 * 2 ** attempt);
    }
    throw error;
  }
  return jpeg.decode(bytes, { useTArray: true });
}
const samples = roofs.map((): Sample => ({ red: [], green: [], blue: [], total: 0, shadow: 0, vegetation: 0, glare: 0, tiles: new Set() }));
const tileKeys = [...tileMembers.keys()]; let downloadCursor = 0; let downloaded = 0;
await Promise.all(Array.from({ length: Math.min(4, tileKeys.length) }, async () => {
  while (downloadCursor < tileKeys.length) {
    const key = tileKeys[downloadCursor]; downloadCursor += 1;
    const [tx, ty] = key.split(',').map(Number); await loadTile(tx, ty); downloaded += 1;
    if (downloaded % 10 === 0 || downloaded === tileKeys.length) process.stdout.write(`Cached ${downloaded}/${tileKeys.length} roof imagery tiles.\n`);
  }
}));
for (const [key, members] of tileMembers) {
  const [tx, ty] = key.split(',').map(Number); const image = await loadTile(tx, ty); const originX = tx * TILE_METRES; const originY = ty * TILE_METRES;
  for (const roofIndex of members) {
    const polygon = projected[roofIndex].map(([x, y]): Point => [(x - originX) / METRES_PER_PIXEL, TILE_PIXELS - (y - originY) / METRES_PER_PIXEL]);
    const minX = Math.max(EDGE_INSET_PIXELS, Math.floor(Math.min(...polygon.map((point) => point[0])))); const maxX = Math.min(TILE_PIXELS - EDGE_INSET_PIXELS - 1, Math.ceil(Math.max(...polygon.map((point) => point[0]))));
    const minY = Math.max(EDGE_INSET_PIXELS, Math.floor(Math.min(...polygon.map((point) => point[1])))); const maxY = Math.min(TILE_PIXELS - EDGE_INSET_PIXELS - 1, Math.ceil(Math.max(...polygon.map((point) => point[1]))));
    const sample = samples[roofIndex]; sample.tiles.add(key);
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      if (!inside([x + 0.5, y + 0.5], polygon) || !inside([x - EDGE_INSET_PIXELS, y + 0.5], polygon) || !inside([x + EDGE_INSET_PIXELS, y + 0.5], polygon) || !inside([x + 0.5, y - EDGE_INSET_PIXELS], polygon) || !inside([x + 0.5, y + EDGE_INSET_PIXELS], polygon)) continue;
      sample.total += 1; const offset = (y * image.width + x) * 4; const red = image.data[offset]; const green = image.data[offset + 1]; const blue = image.data[offset + 2]; const light = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      if (light < 38) { sample.shadow += 1; continue; }
      if (red > 247 && green > 247 && blue > 247) { sample.glare += 1; continue; }
      if (green > red * 1.10 && green > blue * 1.08 && green - Math.min(red, blue) > 16) { sample.vegetation += 1; continue; }
      sample.red.push(red); sample.green.push(green); sample.blue.push(blue);
    }
  }
}
const percentile = (values: readonly number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))];
const proposals = roofs.map((roof, index) => {
  const sample = samples[index]; const valid = sample.red.length; const validRatio = valid / Math.max(1, sample.total);
  if (sample.total < 40 || valid < 30) return { buildingId: roof.buildingId, surfaceId: roof.surfaceId, status: 'rejected', reason: 'too-few-valid-pixels', totalPixels: sample.total, validPixels: valid, reviewStatus: 'machine-proposal', acceptedForNow: false };
  const rgb = [percentile(sample.red, 0.5), percentile(sample.green, 0.5), percentile(sample.blue, 0.5)];
  const iqr = Math.max(percentile(sample.red, 0.75) - percentile(sample.red, 0.25), percentile(sample.green, 0.75) - percentile(sample.green, 0.25), percentile(sample.blue, 0.75) - percentile(sample.blue, 0.25));
  const reason = validRatio < 0.45 ? 'mostly-filtered' : iqr > 85 ? 'mixed-colours' : null;
  return { schemaVersion: 1, buildingId: roof.buildingId, surfaceId: roof.surfaceId, status: reason ? 'rejected' : 'proposed', reason, measuredColour: `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`, confidence: Number((validRatio * (1 - Math.min(iqr, 100) / 125) * Math.min(1, valid / 200)).toFixed(3)), slopeDegrees: roof.slopeDegrees, azimuthDegrees: roof.azimuthDegrees, areaSquareMetres: roof.areaSquareMetres, diagnostics: { totalPixels: sample.total, validPixels: valid, validRatio, channelIqr: iqr, rejectedShadow: sample.shadow, rejectedVegetation: sample.vegetation, rejectedGlare: sample.glare, tileKeys: [...sample.tiles] }, reviewStatus: 'machine-proposal', acceptedForNow: false };
});
const result = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: { geometry: '3DBAG LoD2.2 RoofSurface EPSG:7415', imageryService: 'PDOK luchtfoto RGB WMS', imageryLayer: layer, imageryVintage: imageryYear, requestedResolutionMetres: METRES_PER_PIXEL }, policy: { edgeInsetMetres: EDGE_INSET_PIXELS * METRES_PER_PIXEL, minimumTotalPixels: 40, minimumValidPixels: 30, allOutputsRequireHumanReview: true }, proposals };
await writeFile(`${output}.tmp`, `${JSON.stringify(result, null, 2)}\n`); await rename(`${output}.tmp`, output);
process.stdout.write(`Measured ${proposals.filter((proposal) => proposal.status === 'proposed').length}/${proposals.length} roof planes from ${tileMembers.size} pinned ${imageryYear} tiles.\n`);
