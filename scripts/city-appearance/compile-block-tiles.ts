/** Offline snapshot adapter: no imagery fetch, classification or publication.
 * Default prints an inventory. --out=<new directory under .cache> stages tiles;
 * an existing output is never overwritten. Model labels retain their original
 * evidence/review status and are not automatically approved by compilation.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { compileAppearanceTiles } from '../../src/canalRecall/cityAppearanceTiles.js';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.js';
import type { FootprintGeometry } from '../../src/canalRecall/buildingGeometry.js';

type BlockBuilding = { id: string; footprint: FootprintGeometry; surfaces: unknown[]; [key: string]: unknown };
type Block = { origin: { x: number; y: number }; buildings: BlockBuilding[] };
type Record = { id: string; buildingId: string; renderBuildingId?: string; evidenceKey: string; roofPlan?: { buildingSurfacesSha256?: string }; [key: string]: unknown };
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export function compileBlockAppearance(block: Block, neighbourhood: { records: Record[] }, options: { zoom?: number; halo?: number } = {}) {
  if (!Number.isFinite(block.origin.x) || !Number.isFinite(block.origin.y)) throw new Error('Missing RD origin');
  const buildings = block.buildings.map(building => {
    const geometryRevision = sha256(JSON.stringify({ origin: block.origin, footprint: building.footprint, surfaces: building.surfaces }));
    const polygons = building.footprint.type === 'Polygon' ? [building.footprint.coordinates] : building.footprint.coordinates;
    const footprint: FootprintGeometry = { type: 'MultiPolygon', coordinates: polygons.map(polygon => polygon.map(ring =>
      ring.map(([x, z]) => rdToLngLat({ x: block.origin.x + x, y: block.origin.y - z })))) };
    return { id: building.id, geometryRevision, footprint, geometry: {
      frame: { originRD: block.origin, axes: 'x=east,y=up,z=south', heightDatum: 'legacy-block-NAP-minus-0.65m' },
      building,
    } };
  });
  const revisions = new Map(buildings.map(building => [building.id, building.geometryRevision]));
  const surfaceHashes = new Map(block.buildings.map(building => [building.id, sha256(JSON.stringify(building.surfaces))]));
  const observations = neighbourhood.records.map(record => {
    // Do not silently attach an old geometry diagnostic to a newly loaded mesh.
    // This guard is separate from source-image verification, which must happen
    // upstream before publication; staging alone cannot certify a review.
    if (record.roofPlan?.buildingSurfacesSha256 && record.roofPlan.buildingSurfacesSha256 !== surfaceHashes.get(record.buildingId)) {
      throw new Error(`Stale source geometry for ${record.id}`);
    }
    const buildingId = record.renderBuildingId ?? record.buildingId;
    const geometryRevision = revisions.get(buildingId);
    if (!geometryRevision) throw new Error(`No render building for ${record.id}: ${buildingId}`);
    return { id: record.id, buildingId, geometryRevision, evidenceKey: record.evidenceKey, payload: record };
  });
  return compileAppearanceTiles(buildings, observations, options);
}

async function main() {
  const flag = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const blockPath = flag('block') ?? 'public/data/da-costa-block/block.json';
  const evidencePath = flag('evidence') ?? 'public/data/da-costa-block/neighbourhood.json';
  const [blockBytes, evidenceBytes] = await Promise.all([readFile(blockPath), readFile(evidencePath)]);
  const compiled = compileBlockAppearance(JSON.parse(blockBytes.toString()), JSON.parse(evidenceBytes.toString()));
  const encoded = compiled.tiles.map(tile => ({ tile, bytes: gzipSync(JSON.stringify(tile)) }));
  const manifest = {
    version: 1, zoom: compiled.zoom, publication: 'experimental-staging-only',
    sourceHashes: { block: sha256(blockBytes), evidence: sha256(evidenceBytes) },
    buildings: compiled.buildings, observations: compiled.observations,
    tileList: compiled.tiles.map(tile => tile.key),
    tiles: encoded.map(({ tile, bytes }) => ({ key: tile.key, owners: tile.owners.length, haloReferences: tile.halo.length, gzipBytes: bytes.length, sha256: sha256(bytes) })),
    totalGzipBytes: encoded.reduce((sum, entry) => sum + entry.bytes.length, 0),
    warning: 'Transport snapshot only. Does not validate source images, approve evidence, or enable live city appearance.',
  };
  const out = flag('out');
  if (out) {
    const root = await realpath('.cache');
    const destination = path.resolve(out);
    // Resolve the parent to reject symlinks escaping staging as well as ../.
    const parent = await realpath(path.dirname(destination));
    if (parent !== root && !parent.startsWith(root + path.sep)) throw new Error('--out must have an existing parent inside .cache');
    await mkdir(destination); // EEXIST is intentional: never overwrite a previous run.
    for (const { tile, bytes } of encoded) {
      const file = path.join(destination, `${tile.key}.json.gz`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' });
    }
    await writeFile(path.join(destination, 'index.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  }
  process.stdout.write(JSON.stringify({ ...manifest, mode: out ? 'staged' : 'dry-run', output: out ?? null }, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
