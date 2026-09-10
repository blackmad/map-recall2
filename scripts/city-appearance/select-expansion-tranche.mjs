/** Select a frozen, source-pinned geometry tranche from an expansion inventory.
 * This performs no network requests, image downloads, inference, or publication.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';

export const DEFAULT_PARENT = 'scripts/city-appearance/areas/da-costa-expansion-550m-v1.json';
export const DEFAULT_TRANCHE = 'scripts/city-appearance/areas/da-costa-tranche-400m-v1.json';

const contains = (outer, inner) => inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
const points = geometry => geometry?.type === 'Polygon' ? geometry.coordinates.flat() : geometry?.type === 'MultiPolygon' ? geometry.coordinates.flat(2) : [];
const intersects = (geometry, bbox) => points(geometry).some(([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]);

async function newestCompleteInventory(area) {
  const root = path.resolve(area.cacheRoot, '..', 'inventory');
  const candidates = [];
  for (const name of await fs.readdir(root)) {
    if (!/^[0-9a-f]{64}$/.test(name)) continue;
    const directory = path.join(root, name);
    try {
      const reportBytes = await fs.readFile(path.join(directory, 'inventory.json'));
      const report = JSON.parse(reportBytes);
      if (report.complete && report.areaConfigHash === area.configHash && report.inventoryHash === name) candidates.push({ directory, report, reportBytes });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!candidates.length) throw Error(`No complete source-current inventory for ${area.id}`);
  candidates.sort((a, b) => a.report.inventoryHash.localeCompare(b.report.inventoryHash));
  return candidates.at(-1);
}

export async function selectExpansionTranche(parent, tranche) {
  if (!contains(parent.bbox, tranche.bbox)) throw Error('Tranche bbox must be contained by parent inventory bbox');
  const current = await newestCompleteInventory(parent);
  const footprintPath = path.join(current.directory, 'candidate-footprints.geojson');
  const footprintBytes = await fs.readFile(footprintPath), collection = JSON.parse(footprintBytes);
  if (collection.areaId !== parent.id || collection.inventoryHash !== current.report.inventoryHash) throw Error('Candidate footprints do not match parent inventory');
  const selected = collection.features.filter(feature => intersects(feature.geometry, tranche.bbox));
  if (!selected.length) throw Error('Tranche contains no inventory footprints');
  const ids = selected.map(feature => feature.properties?.buildingId).filter(Boolean).sort();
  if (new Set(ids).size !== ids.length) throw Error('Tranche contains duplicate building identities');
  const identity = {
    version: 'expansion-tranche-selection/1', trancheAreaId: tranche.id, trancheAreaConfigHash: tranche.configHash,
    parentAreaId: parent.id, parentAreaConfigHash: parent.configHash, parentInventoryHash: current.report.inventoryHash,
    parentInventorySha256: digest(current.reportBytes), candidateFootprintsSha256: digest(footprintBytes), buildingIds: ids,
  };
  const report = { ...identity, selectionHash: digest(identity), bbox: tranche.bbox, buildings: ids.length,
    status: 'selected-not-acquired', imageryDownloads: 0, paidCalls: 0,
    warning: 'Inventory intersection only. BGT/3DBAG acquisition and public-face selection must succeed before this is compilable geometry.' };
  const destination = path.resolve(tranche.cacheRoot, '..', 'selection', report.selectionHash);
  await atomicJson(path.join(destination, 'selection.json'), report);
  await atomicJson(path.join(destination, 'candidate-footprints.geojson'), { ...collection, areaId: tranche.id, parentAreaId: parent.id, selectionHash: report.selectionHash, features: selected });
  return { report, destination };
}

async function main() {
  const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const parent = await loadAreaConfig([`--area-config=${path.resolve(arg('parent') ?? DEFAULT_PARENT)}`]);
  const tranche = await loadAreaConfig([`--area-config=${path.resolve(arg('area-config') ?? DEFAULT_TRANCHE)}`]);
  const result = await selectExpansionTranche(parent, tranche);
  console.log(JSON.stringify({ destination: result.destination, ...result.report }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
