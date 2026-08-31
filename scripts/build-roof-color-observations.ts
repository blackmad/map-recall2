/** Measure roof colours from cached PDOK orthophotos without mutating BAG data. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
type Point = [number, number];
type Geometry = { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] };
type Building = { properties: Record<string, unknown>; geometry: Geometry };
type Samples = { r: number[]; g: number[]; b: number[]; footprintPixels: number; shadow: number; vegetation: number; glare: number; tiles: Set<string> };
const arg = (name: string) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/roof-enrichment'), inputFile = path.resolve(arg('input') || path.join(root, 'a10-bag-buildings.geojson'));
const outputFile = path.resolve(arg('output') || path.join(root, 'roof-color-observations.json'));
const limit = Math.max(1, Number(arg('limit') || 500)), fresh = process.argv.includes('--fresh');
const tileDirectory = path.join(root, 'pdok-ortho-tiles'); await mkdir(tileDirectory, { recursive: true });
const EARTH_RADIUS = 6378137, TILE_METRES = 128, TILE_PIXELS = 1024, METRES_PER_PIXEL = TILE_METRES / TILE_PIXELS;
const toMercator = ([lon, lat]: Point): Point => [(lon * Math.PI / 180) * EARTH_RADIUS, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * EARTH_RADIUS];
const polygons = (geometry: Geometry): Point[][][] => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
const insideRing = (x: number, y: number, ring: Point[]) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const insideGeometry = (x: number, y: number, geometry: Point[][][]) => geometry.some(polygon => insideRing(x, y, polygon[0]) && !polygon.slice(1).some(hole => insideRing(x, y, hole)));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function tile(tileX: number, tileY: number) {
  const file = path.join(tileDirectory, `${tileX}_${tileY}.jpg`); let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const minX = tileX * TILE_METRES, minY = tileY * TILE_METRES, url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_orthoHR', STYLES: '', CRS: 'EPSG:3857', BBOX: `${minX},${minY},${minX + TILE_METRES},${minY + TILE_METRES}`, WIDTH: String(TILE_PIXELS), HEIGHT: String(TILE_PIXELS), FORMAT: 'image/jpeg' }).toString();
    let error: unknown;
    for (let attempt = 0; attempt < 5; attempt++) { try { const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallRoofEnrichment/1.0' } }); if (response.ok) { bytes = Buffer.from(await response.arrayBuffer()); await writeFile(file, bytes); return jpeg.decode(bytes, { useTArray: true }); } error = new Error(`HTTP ${response.status}`); } catch (caught) { error = caught; } await wait(400 * 2 ** attempt); }
    throw error;
  }
  return jpeg.decode(bytes, { useTArray: true });
}
const source = JSON.parse(await readFile(inputFile, 'utf8')) as { metadata?: unknown; features: Building[] };
let old: { observations?: Array<Record<string, unknown>>; rejections?: Array<Record<string, unknown>> } = {};
if (!fresh) { try { old = JSON.parse(await readFile(outputFile, 'utf8')); } catch { /* first run */ } }
const observations = old.observations || [], rejections = old.rejections || [], processed = new Set([...observations, ...rejections].map(x => String(x.buildingId)));
const dam: Point = [4.8936, 52.3728];
const centre = (b: Building) => { const p = polygons(b.geometry)[0][0]; return [p.reduce((s, x) => s + x[0], 0) / p.length, p.reduce((s, x) => s + x[1], 0) / p.length] as Point; };
const candidates = source.features.filter(x => !processed.has(String(x.properties.buildingId))).sort((a, b) => { const pa = centre(a), pb = centre(b); return Math.hypot(pa[0] - dam[0], pa[1] - dam[1]) - Math.hypot(pb[0] - dam[0], pb[1] - dam[1]); }).slice(0, limit);
const byTile = new Map<string, number[]>(), projected = candidates.map(x => polygons(x.geometry).map(p => p.map(r => r.map(toMercator))));
for (let i = 0; i < projected.length; i++) { const points = projected[i].flat(2), minX = Math.min(...points.map(x => x[0])), maxX = Math.max(...points.map(x => x[0])), minY = Math.min(...points.map(x => x[1])), maxY = Math.max(...points.map(x => x[1])); for (let ty = Math.floor(minY / TILE_METRES); ty <= Math.floor(maxY / TILE_METRES); ty++) for (let tx = Math.floor(minX / TILE_METRES); tx <= Math.floor(maxX / TILE_METRES); tx++) { const key = `${tx},${ty}`; (byTile.get(key) || byTile.set(key, []).get(key)!).push(i); } }
const samples = candidates.map((): Samples => ({ r: [], g: [], b: [], footprintPixels: 0, shadow: 0, vegetation: 0, glare: 0, tiles: new Set() }));
let tileIndex = 0;
for (const [key, members] of byTile) {
  const [tx, ty] = key.split(',').map(Number), image = await tile(tx, ty), originX = tx * TILE_METRES, originY = ty * TILE_METRES; tileIndex++;
  for (const index of members) {
    const geometry = projected[index].map(p => p.map(r => r.map(([x, y]) => [(x - originX) / METRES_PER_PIXEL, TILE_PIXELS - (y - originY) / METRES_PER_PIXEL] as Point)));
    const points = geometry.flat(2), minX = Math.max(1, Math.floor(Math.min(...points.map(x => x[0])))), maxX = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...points.map(x => x[0])))), minY = Math.max(1, Math.floor(Math.min(...points.map(x => x[1])))), maxY = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...points.map(x => x[1]))));
    const sample = samples[index]; sample.tiles.add(key);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (!insideGeometry(x + .5, y + .5, geometry)) continue;
      if (!insideGeometry(x - .5, y + .5, geometry) || !insideGeometry(x + 1.5, y + .5, geometry) || !insideGeometry(x + .5, y - .5, geometry) || !insideGeometry(x + .5, y + 1.5, geometry)) continue;
      sample.footprintPixels++; const offset = (y * image.width + x) * 4, r = image.data[offset], g = image.data[offset + 1], b = image.data[offset + 2], light = .2126 * r + .7152 * g + .0722 * b;
      if (light < 38) { sample.shadow++; continue; }
      if (r > 247 && g > 247 && b > 247) { sample.glare++; continue; }
      if (g > r * 1.10 && g > b * 1.08 && g - Math.min(r, b) > 16) { sample.vegetation++; continue; }
      sample.r.push(r); sample.g.push(g); sample.b.push(b);
    }
  }
  if (tileIndex % 25 === 0) process.stdout.write(`${tileIndex}/${byTile.size} orthophoto tiles\n`);
}
const percentile = (a: number[], p: number) => { const sorted = [...a].sort((x, y) => x - y); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; };
const hex = (rgb: number[]) => `#${rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
const palette = ['#2f2925','#4b3a32','#67483a','#805748','#9a6652','#ad7963','#be8e76','#c5a38c','#d0b8a2','#8a8177','#a39b91','#bbb5ac','#d3cec5','#4c5155','#687077','#858d92','#a3aaad','#bcc1c2','#d4d6d4','#6f3028','#8f4334','#ad5943','#c7775d'];
const rgb = (value: string) => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
const nearest = (value: number[]) => palette.reduce((best, p) => { const c = rgb(p), distance = c.reduce((s, x, i) => s + (x - value[i]) ** 2, 0); return distance < best.distance ? { value: p, distance } : best; }, { value: palette[0], distance: Infinity }).value;
for (let i = 0; i < candidates.length; i++) {
  const building = candidates[i], id = String(building.properties.buildingId), s = samples[i], accepted = s.r.length, rejected = s.shadow + s.vegetation + s.glare;
  if (s.footprintPixels < 20 || accepted < 12) { rejections.push({ buildingId: id, reason: 'too-few-valid-pixels', footprintPixels: s.footprintPixels, acceptedPixels: accepted }); continue; }
  const measured = [percentile(s.r, .5), percentile(s.g, .5), percentile(s.b, .5)], iqr = Math.max(percentile(s.r, .75) - percentile(s.r, .25), percentile(s.g, .75) - percentile(s.g, .25), percentile(s.b, .75) - percentile(s.b, .25));
  const validRatio = accepted / Math.max(1, accepted + rejected), confidence = Math.max(.05, Math.min(.99, validRatio * (1 - Math.min(iqr, 100) / 125) * Math.min(1, accepted / 150)));
  observations.push({ schemaVersion: 1, buildingId: id, bagId: building.properties.identificatie, surface: 'roof', attribute: 'colour', measuredColour: hex(measured), quantizedColour: nearest(measured), confidence: Number(confidence.toFixed(3)), source: 'pdok-orthophoto', imageryProduct: 'Actueel_orthoHR', observedAt: null, method: 'eroded-bag-footprint-rgb-median-v1', diagnostics: { footprintPixels: s.footprintPixels, acceptedPixels: accepted, rejectedShadow: s.shadow, rejectedVegetation: s.vegetation, rejectedGlare: s.glare, channelIqr: iqr, tileKeys: [...s.tiles] }, reviewStatus: 'machine-accepted-for-now' });
}
const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), input: path.relative(process.cwd(), inputFile), imagery: { service: 'PDOK luchtfoto RGB WMS', layer: 'Actueel_orthoHR', requestedResolutionMetres: METRES_PER_PIXEL }, selection: { region: 'inside-a10', ordering: 'distance-from-Dam', attemptedThisRun: candidates.length }, observations, rejections };
await writeFile(outputFile, JSON.stringify(output, null, 2));
process.stdout.write(`Wrote ${observations.length} observations; ${rejections.length} rejections; ${byTile.size} tiles used\n`);
