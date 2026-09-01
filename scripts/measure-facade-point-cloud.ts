/** Measure unaccepted façade-colour proposals from an RGB LAS/LAZ tile and cached 3DBAG walls. */
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LASLoader } from '@loaders.gl/las';
import { measureFacadeColour, type FacadeWallPlane, type RgbPoint } from '../src/canalRecall/building/facadePointCloud.ts';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const lazFile = arg('laz');
if (!lazFile) throw new Error('Pass --laz=<Amsterdam RGB .las/.laz tile>.');
const wallFile = path.resolve(arg('walls') || '.cache/building-enrichment/panorama/facade-wall-planes.json');
const output = path.resolve(arg('output') || '.cache/building-enrichment/panorama/facade-colour-point-cloud-proposals.json');
const skip = Math.max(1, Number(arg('skip') || 1));
const bytes = await readFile(path.resolve(lazFile));
const mesh = await LASLoader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { las: { fp64: true, colorDepth: 'auto', skip } });
const positions = mesh.attributes.POSITION?.value as Float64Array | Float32Array | undefined;
const colours = mesh.attributes.COLOR_0?.value as Uint8Array | undefined;
if (!positions || !colours) throw new Error('The LAS/LAZ tile must contain XYZ and RGB attributes.');
const source = JSON.parse(await readFile(wallFile, 'utf8')) as { buildings: Array<{ buildingId: string; walls: FacadeWallPlane[] }> };
const walls = source.buildings.flatMap((building) => building.walls);
const bounds = walls.flatMap((wall) => wall.vertices);
const minX = Math.min(...bounds.map((point) => point[0])) - 0.2; const maxX = Math.max(...bounds.map((point) => point[0])) + 0.2;
const minY = Math.min(...bounds.map((point) => point[1])) - 0.2; const maxY = Math.max(...bounds.map((point) => point[1])) + 0.2;
const minZ = Math.min(...bounds.map((point) => point[2])) - 0.2; const maxZ = Math.max(...bounds.map((point) => point[2])) + 0.2;
const points: RgbPoint[] = [];
for (let index = 0; index < positions.length / 3; index += 1) {
  const x = positions[index * 3]; const y = positions[index * 3 + 1]; const z = positions[index * 3 + 2];
  if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) continue;
  points.push({ x, y, z, red: colours[index * 4], green: colours[index * 4 + 1], blue: colours[index * 4 + 2] });
}
if (!points.length) throw new Error('No LAZ points overlap the cached RD+NAP wall extent; verify the tile and CRS (EPSG:7415).');
const proposals = walls.map((wall) => ({
  schemaVersion: 1,
  buildingId: wall.buildingId,
  surfaceId: wall.surfaceId,
  ...measureFacadeColour(wall, points),
  reviewStatus: 'machine-proposal',
  acceptedForNow: false,
}));
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: { file: path.basename(lazFile), sha256: createHash('sha256').update(bytes).digest('hex'), crs: 'EPSG:7415', decodedPoints: positions.length / 3, retainedNearPilotBuildings: points.length, skip },
  wallManifest: path.relative(process.cwd(), wallFile),
  policy: { maximumPlaneDistanceMetres: 0.12, minimumPoints: 80, minimumGridCoverage: 0.18, allOutputsRequireHumanReview: true },
  proposals,
};
await writeFile(`${output}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
await rename(`${output}.tmp`, output);
process.stdout.write(`Measured ${proposals.length} wall proposals from ${points.length} nearby RGB points; none accepted automatically.\n`);
