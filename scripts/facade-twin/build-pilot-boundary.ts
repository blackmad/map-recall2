/**
 * Fix the pilot boundary and publish it to staging with its diagnostics.
 *
 * Staging, not the versioned extract: per the working agreement the generator
 * reports coverage and diffs first and only publishes after review.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPilotBoundary, type CanalCentreline } from '../../src/canalRecall/facade/pilotBoundary.ts';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { loadBoundaryCanals } from './fetch-boundary-canals.ts';

const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin');

const ways = await loadBoundaryCanals({ refresh: process.argv.includes('--refresh') });
const centrelines: CanalCentreline[] = ways.map(way => ({ name: way.name, points: way.points }));
const boundary = buildPilotBoundary(centrelines);

console.log('Pilot boundary — De Negen Straatjes / Grachtengordel-West\n');
for (const { edge, vertexCount, lengthM } of boundary.edges) {
  console.log(`  ${edge.canal.padEnd(15)} ${String(Math.round(lengthM)).padStart(5)} m  ${String(vertexCount).padStart(3)} vertices  offset ${edge.outwardOffsetM} m`);
}
console.log('\n  junctions');
for (const j of boundary.junctions) {
  console.log(`    ${j.name.padEnd(38)} ${j.lngLat[0].toFixed(6)}, ${j.lngLat[1].toFixed(6)}  gap ${j.gapM.toFixed(2)} m`);
}
const [west, south, east, north] = boundary.bboxLngLat;
const widthM = Math.max(...boundary.ringRd.map(p => p.x)) - Math.min(...boundary.ringRd.map(p => p.x));
const heightM = Math.max(...boundary.ringRd.map(p => p.y)) - Math.min(...boundary.ringRd.map(p => p.y));
console.log(`\n  centreline ring   ${boundary.centrelineRd.length} vertices, ${boundary.centrelineAreaKm2.toFixed(3)} km²`);
console.log(`  offset boundary   ${boundary.ringRd.length} vertices, ${boundary.areaKm2.toFixed(3)} km²`);
console.log(`  extent            ${(widthM / 1000).toFixed(2)} km × ${(heightM / 1000).toFixed(2)} km`);
console.log(`  bbox (wgs84)      ${west.toFixed(6)},${south.toFixed(6)},${east.toFixed(6)},${north.toFixed(6)}`);

const geojson = {
  type: 'FeatureCollection' as const,
  metadata: {
    name: 'Amsterdam façade twin — pilot boundary',
    description: 'De Negen Straatjes and Grachtengordel-West. Canal centrelines from OSM, offset outward per edge to reach the far-bank building row. Membership is by BAG footprint intersection.',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-pilot-boundary.ts',
    areaKm2: Number(boundary.areaKm2.toFixed(4)),
    edges: boundary.edges.map(({ edge, lengthM }) => ({ ...edge, lengthM: Math.round(lengthM) })),
    junctions: boundary.junctions,
    localOriginRd: { x: 120700, y: 487500 },
    localOriginLngLat: rdToLngLat({ x: 120700, y: 487500 }),
  },
  features: [
    { type: 'Feature' as const, properties: { role: 'boundary' }, geometry: { type: 'Polygon' as const, coordinates: [[...boundary.ringLngLat, boundary.ringLngLat[0]]] } },
    { type: 'Feature' as const, properties: { role: 'canal-centreline-ring' }, geometry: { type: 'LineString' as const, coordinates: [...boundary.centrelineRd.map(rdToLngLat), rdToLngLat(boundary.centrelineRd[0])] } },
  ],
};

await mkdir(STAGING, { recursive: true });
await writeFile(path.join(STAGING, 'pilot-boundary.geojson'), JSON.stringify(geojson, null, 2) + '\n');
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'pilot-boundary.geojson'))}`);
