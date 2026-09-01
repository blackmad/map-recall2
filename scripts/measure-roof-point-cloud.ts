/** Join PDOK photogrammetric RGB DSM points to exact 3DBAG LoD2.2 roof planes. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LASLoader } from '@loaders.gl/las';
import { measureSurfaceColour, type RgbPoint, type RoofPlane } from '../src/canalRecall/building/facadePointCloud.ts';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment');
const resolution = arg('resolution') || '20cm';
if (!['8cm', '20cm'].includes(resolution)) throw new Error('--resolution must be 8cm or 20cm.');
const dsmRoot = path.join(root, `pdok-dsm-point-cloud/2025-${resolution}`);
const manifest = JSON.parse(await readFile(path.join(dsmRoot, 'manifest.json'), 'utf8')) as { source: Record<string, unknown>; tiles: Array<{ file: string; sha256: string; buildingIds: string[]; bladnr: string }> };
const surfaces = JSON.parse(await readFile(path.join(root, 'panorama/facade-wall-planes.json'), 'utf8')) as { buildings: Array<{ buildingId: string; roofs: RoofPlane[] }> };
const orthophoto = JSON.parse(await readFile(path.join(root, 'roof-plane-colour-proposals.json'), 'utf8')) as { proposals: Array<{ surfaceId: string; measuredColour?: string }> };
const orthophotoBySurface = new Map(orthophoto.proposals.map((proposal) => [proposal.surfaceId, proposal]));
const buildingById = new Map(surfaces.buildings.map((building) => [building.buildingId, building])); const pointsBySurface = new Map<string, RgbPoint[]>();
for (const tile of manifest.tiles) {
  const bytes = await readFile(path.join(dsmRoot, tile.file)); const mesh = await LASLoader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { las: { fp64: true, colorDepth: 'auto', skip: 1 } });
  const positions = mesh.attributes.POSITION?.value as Float64Array; const colours = mesh.attributes.COLOR_0?.value as Uint8Array;
  if (!positions || !colours) throw new Error(`DSM ${tile.bladnr} lacks XYZ or RGB.`);
  for (const buildingId of tile.buildingIds) for (const roof of buildingById.get(buildingId)?.roofs || []) {
    const minX = Math.min(...roof.vertices.map((point) => point[0])) - 1; const maxX = Math.max(...roof.vertices.map((point) => point[0])) + 1; const minY = Math.min(...roof.vertices.map((point) => point[1])) - 1; const maxY = Math.max(...roof.vertices.map((point) => point[1])) + 1;
    const selected = pointsBySurface.get(roof.surfaceId) || [];
    for (let index = 0; index < positions.length / 3; index += 1) { const x = positions[index * 3]; const y = positions[index * 3 + 1]; if (x < minX || x > maxX || y < minY || y > maxY) continue; selected.push({ x, y, z: positions[index * 3 + 2], red: colours[index * 4], green: colours[index * 4 + 1], blue: colours[index * 4 + 2] }); }
    pointsBySurface.set(roof.surfaceId, selected);
  }
}
const parseHex = (value: string) => [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
const selectedBuildings = new Set(manifest.tiles.flatMap((tile) => tile.buildingIds)); const proposals = surfaces.buildings.filter((building) => selectedBuildings.has(building.buildingId)).flatMap((building) => building.roofs.map((roof) => {
  const measurement = measureSurfaceColour(roof, pointsBySurface.get(roof.surfaceId) || [], { maximumPlaneDistance: 0.12, maximumOffsetSearch: 1, minimumPoints: 30, gridSize: 0.5 });
  const aerialColour = orthophotoBySurface.get(roof.surfaceId)?.measuredColour; const pointColour = measurement.hex;
  const crossSourceRgbDistance = aerialColour && pointColour ? Math.hypot(...parseHex(aerialColour).map((value, index) => value - parseHex(pointColour)[index])) : null;
  const crossSourceAgrees = crossSourceRgbDistance !== null && crossSourceRgbDistance <= 20;
  const reason = measurement.status !== 'accepted' ? measurement.reason : !aerialColour ? 'missing-independent-orthophoto-observation' : !crossSourceAgrees ? 'cross-source-colour-disagreement' : null;
  return { schemaVersion: 1, buildingId: roof.buildingId, surfaceId: roof.surfaceId, status: reason ? 'rejected' : 'proposed', reason, pointCloudMeasurement: measurement, orthophotoColour: aerialColour || null, crossSourceRgbDistance: crossSourceRgbDistance === null ? null : Number(crossSourceRgbDistance.toFixed(2)), reviewStatus: 'machine-proposal', acceptedForNow: false };
}));
const result = { schemaVersion: 1, generatedAt: new Date().toISOString(), source: manifest.source, tileHashes: manifest.tiles.map(({ bladnr, sha256 }) => ({ bladnr, sha256 })), policy: { planeBandMetres: 0.12, maximumModalOffsetSearchMetres: 1, minimumPoints: 30, minimumGridCoverage: 0.18, cellSizeMetres: 0.5, maximumCrossSourceRgbDistance: 20, allOutputsRequireHumanReview: true }, proposals };
const output = path.join(root, 'roof-point-cloud-colour-proposals.json'); await writeFile(`${output}.tmp`, `${JSON.stringify(result, null, 2)}\n`); await rename(`${output}.tmp`, output);
process.stdout.write(`Proposed ${proposals.filter((proposal) => proposal.status === 'proposed').length}/${proposals.length} roof planes after independent RGB agreement; none accepted for production.\n`);
