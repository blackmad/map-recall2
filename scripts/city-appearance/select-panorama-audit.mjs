/** Deterministically select a capped, new-area panorama audit sample.
 * Selection is geometry/coverage based and does not use appearance proposals.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';

export const DEFAULT_AREA = 'scripts/city-appearance/areas/da-costa-tranche-400m-v1.json';
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const era = year => year < 1900 ? 'pre-1900' : year < 1945 ? '1900-1944' : year < 1990 ? '1945-1989' : '1990+';

async function currentRun(area) {
  const root = path.resolve('.cache/city-appearance/areas', area.id, 'runs'), candidates = [];
  for (const name of await fs.readdir(root)) {
    if (!/^[0-9a-f]{64}$/.test(name)) continue;
    const file = path.join(root, name, 'pipeline.json');
    try {
      const pipeline = await readJson(file);
      if (['compile', 'inventory', 'tiles'].every(id => pipeline.jobs?.[id]?.status === 'complete')) candidates.push({ name, pipeline });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!candidates.length) throw Error(`No complete staged pipeline for ${area.id}`);
  candidates.sort((a, b) => a.name.localeCompare(b.name)); return candidates.at(-1);
}

export function chooseAuditRecords(records, buildings, excludedBuildingIds, cap = 24) {
  if (!Number.isInteger(cap) || cap < 1 || cap > 48) throw Error('Audit cap must be 1–48');
  const byId = new Map(buildings.map(building => [building.id, building]));
  const eligible = records.map(record => ({ ...record, building: byId.get(record.buildingId) }))
    .filter(record => record.building && !excludedBuildingIds.has(record.buildingId));
  const selected = [], used = new Set();
  const add = (record, reason) => { if (record && selected.length < cap && !used.has(record.id)) { used.add(record.id); selected.push({ ...record, stratum: reason }); } };
  // One median-width ordinary control per street maximizes geographic coverage.
  const streets = [...new Set(eligible.map(record => record.street))].sort();
  for (const street of streets) {
    const group = eligible.filter(record => record.street === street).sort((a, b) => a.wallWidthM - b.wallWidthM || a.id.localeCompare(b.id));
    add(group[Math.floor((group.length - 1) / 2)], 'street-median-control');
  }
  // Then cover underrepresented construction eras with geometrically distinctive wide walls.
  for (const name of ['1945-1989', '1990+', 'pre-1900', '1900-1944']) {
    const group = eligible.filter(record => era(record.building.year) === name).sort((a, b) => b.wallWidthM - a.wallWidthM || a.id.localeCompare(b.id));
    for (const record of group) add(record, `wide-${name}`);
  }
  // A low-cap caller still receives deterministic coverage; fill any residual slots globally.
  for (const record of eligible.sort((a, b) => b.wallWidthM - a.wallWidthM || a.id.localeCompare(b.id))) add(record, 'wide-global');
  return selected.slice(0, cap).map(({ building, ...record }) => ({ ...record, constructionYear: building.year, era: era(building.year) }));
}

export function chooseCoverageRecords(records, buildings, { streets, excludeBuildingIds = new Set(), cap = 1000 } = {}) {
  if (!Number.isInteger(cap) || cap < 1 || cap > 1000) throw Error('Coverage cap must be 1–1000');
  const byId = new Map(buildings.map(building => [building.id, building]));
  const requestedStreets = streets?.length ? new Set(streets) : null;
  return records
    .map(record => ({ ...record, building: byId.get(record.buildingId) }))
    .filter(record => record.building && !excludeBuildingIds.has(record.buildingId) && (!requestedStreets || requestedStreets.has(record.street)))
    .sort((a, b) => a.street.localeCompare(b.street) || a.id.localeCompare(b.id))
    .slice(0, cap)
    .map(({ building, ...record }) => ({ ...record, constructionYear: building.year, era: era(building.year) }));
}

export async function selectPanoramaAudit(area, { cap = 24, baselineBlock = 'public/data/da-costa-block/block.json' } = {}) {
  const run = await currentRun(area), compile = run.pipeline.jobs.compile.output.blockPath, inventory = run.pipeline.jobs.inventory.output.inventoryPath;
  const [blockBytes, inventoryBytes, baselineBytes] = await Promise.all([fs.readFile(compile), fs.readFile(inventory), fs.readFile(baselineBlock)]);
  const block = JSON.parse(blockBytes), source = JSON.parse(inventoryBytes), baseline = JSON.parse(baselineBytes);
  if (block.areaConfigHash !== area.configHash || source.areaConfigHash !== area.configHash) throw Error('Pipeline artifacts do not match audit area configuration');
  const records = chooseAuditRecords(source.records, block.buildings, new Set(baseline.buildings.map(building => building.id)), cap);
  if (records.length !== cap) throw Error(`Only ${records.length}/${cap} new-area audit records available`);
  const identity = { version: 'panorama-source-audit-selection/1', areaId: area.id, areaConfigHash: area.configHash, runHash: run.name,
    blockSha256: digest(blockBytes), inventorySha256: digest(inventoryBytes), excludedBaselineSha256: digest(baselineBytes), cap,
    elevationIds: records.map(record => record.id) };
  const report = { ...identity, selectionHash: digest(identity), records,
    streets: [...new Set(records.map(record => record.street))].sort(), facadeLengthM: records.reduce((sum, record) => sum + record.wallWidthM, 0),
    uniqueProposedPanoramas: new Set(records.flatMap(record => [record.fullPanorama, record.groundPanorama])).size,
    imageryStatus: 'not-downloaded', paidCalls: 0,
    warning: 'Selection is not source approval. Distinctive means geometric width/era coverage, not inferred facade appearance.' };
  const destination = path.resolve(area.cacheRoot, '..', 'panorama-audit', report.selectionHash);
  await atomicJson(path.join(destination, 'selection.json'), report);
  return { report, destination };
}

export async function selectPanoramaCoverage(area, { streets, cap = 1000, includeBaseline = false, baselineBlock = 'public/data/da-costa-block/block.json' } = {}) {
  const run = await currentRun(area), compile = run.pipeline.jobs.compile.output.blockPath, inventory = run.pipeline.jobs.inventory.output.inventoryPath;
  const [blockBytes, inventoryBytes, baselineBytes] = await Promise.all([fs.readFile(compile), fs.readFile(inventory), fs.readFile(baselineBlock)]);
  const block = JSON.parse(blockBytes), source = JSON.parse(inventoryBytes), baseline = JSON.parse(baselineBytes);
  if (block.areaConfigHash !== area.configHash || source.areaConfigHash !== area.configHash) throw Error('Pipeline artifacts do not match coverage area configuration');
  const excludedBuildingIds = new Set(includeBaseline ? [] : baseline.buildings.map(building => building.id));
  const normalizedStreets = streets?.length ? [...new Set(streets.map(value => value.trim()).filter(Boolean))].sort() : [];
  const matching = source.records.filter(record => (!normalizedStreets.length || normalizedStreets.includes(record.street)));
  const excludedBaselineRecords = matching.filter(record => excludedBuildingIds.has(record.buildingId)).length;
  const eligibleRecords = matching.length - excludedBaselineRecords;
  const records = chooseCoverageRecords(source.records, block.buildings, { streets: normalizedStreets, excludeBuildingIds: excludedBuildingIds, cap });
  const identity = { version: 'panorama-source-coverage-selection/1', mode: 'coverage', areaId: area.id, areaConfigHash: area.configHash, runHash: run.name,
    blockSha256: digest(blockBytes), inventorySha256: digest(inventoryBytes), excludedBaselineSha256: digest(baselineBytes), streets: normalizedStreets, cap,
    ...(includeBaseline?{includeBaseline:true}:{}),excludedBaselineRecords, eligibleRecords, elevationIds: records.map(record => record.id) };
  const report = { ...identity, selectionHash: digest(identity), records,
    facadeLengthM: records.reduce((sum, record) => sum + record.wallWidthM, 0),
    uniqueProposedPanoramas: new Set(records.flatMap(record => [record.fullPanorama, record.groundPanorama])).size,
    omittedByCap: Math.max(0, eligibleRecords - records.length), imageryStatus: 'not-downloaded', paidCalls: 0,
    warning: 'Coverage selection is not source approval. Baseline-block buildings are excluded because they already have richer evidence.' };
  const destination = path.resolve(area.cacheRoot, '..', 'panorama-audit', report.selectionHash);
  await atomicJson(path.join(destination, 'selection.json'), report);
  return { report, destination };
}

async function main() {
  const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const area = await loadAreaConfig([`--area-config=${path.resolve(flag('area-config') ?? DEFAULT_AREA)}`]);
  const mode = flag('mode') ?? 'audit';
  if (!['audit', 'coverage'].includes(mode)) throw Error('Mode must be audit or coverage');
  const streets = flag('streets')?.split(',').map(value => value.trim()).filter(Boolean);
  const result = mode === 'coverage'
    ? await selectPanoramaCoverage(area, { streets, includeBaseline:process.argv.includes('--include-baseline'),cap: Number(flag('cap') ?? 1000) })
    : await selectPanoramaAudit(area, { cap: Number(flag('cap') ?? 24) });
  console.log(JSON.stringify({ destination: result.destination, ...result.report }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
