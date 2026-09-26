import fs from 'node:fs/promises';
import path from 'node:path';
import { digest } from '../da-costa-block/pipeline-state.mjs';
import { validateAreaConfig } from '../da-costa-block/area-config.mjs';

const ring = value => Array.isArray(value) && value.length >= 4 && value.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));

export function validateDistrictConfig(value) {
  if (value?.version !== 1 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.id ?? '')) throw Error('District config needs version 1 and a stable lowercase ID');
  if (!Array.isArray(value.areas) || value.areas.length < 1) throw Error('District config needs at least one area');
  const seen = new Set();
  const areas = value.areas.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.config !== 'string' || !entry.config) throw Error(`District area ${index + 1} needs a config path`);
    if (seen.has(entry.id ?? entry.config)) throw Error(`Duplicate district area ${entry.id ?? entry.config}`);
    seen.add(entry.id ?? entry.config);
    if (entry.boundary !== undefined && (!Array.isArray(entry.boundary.sourceFeatureIds) || !entry.boundary.sourceFeatureIds.length || !/^[a-f0-9]{64}$/.test(entry.boundary.geometryHash ?? ''))) throw Error(`District area ${entry.id ?? index + 1} has invalid municipal boundary pin`);
    return { id: entry.id ?? path.basename(entry.config, path.extname(entry.config)), district: entry.district ?? null, config: entry.config, priority: Number.isFinite(entry.priority) ? entry.priority : index, boundary: entry.boundary ?? null };
  });
  if (!Array.isArray(value.boundary) || value.boundary.length < 1 || !value.boundary.every(ring)) throw Error('District boundary needs one or more WGS84 rings');
  const source = value.boundarySource;
  if (!source || typeof source !== 'object' || typeof source.name !== 'string' || typeof source.retrievedAt !== 'string' || typeof source.revision !== 'string') throw Error('District boundary needs name, revision and retrieval date provenance');
  if (!Number.isFinite(Date.parse(source.retrievedAt))) throw Error('District boundary retrieval date is invalid');
  if (value.route !== undefined && value.route !== null && (typeof value.route !== 'string' || !value.route)) throw Error('District route must be a relative JSON path');
  const budgets = value.budgets ?? {};
  if (!Number.isInteger(budgets.buildingTiles) || budgets.buildingTiles < 1 || budgets.buildingTiles > 12) throw Error('District building tile budget must be 1–12');
  if (!Number.isInteger(budgets.contextTiles) || budgets.contextTiles < 1 || budgets.contextTiles > 16) throw Error('District context tile budget must be 1–16');
  if (!Number.isFinite(budgets.detailBufferMB) || budgets.detailBufferMB <= 0 || budgets.detailBufferMB > 11) throw Error('District detail buffer must be positive and at most 11 MB');
  return { version: 1, id: value.id, name: value.name ?? value.id, areas, boundary: value.boundary, boundarySource: source, route: value.route ?? null, budgets: { buildingTiles: budgets.buildingTiles, contextTiles: budgets.contextTiles, detailBufferMB: budgets.detailBufferMB }, spendLimitUsd: Number.isFinite(value.spendLimitUsd) && value.spendLimitUsd >= 0 ? value.spendLimitUsd : 0 };
}

export async function loadDistrictConfig(file) {
  const absolute = path.resolve(file);
  let config = validateDistrictConfig(JSON.parse(await fs.readFile(absolute, 'utf8')));
  const base = path.dirname(absolute);
  // The config keeps a small operational outline for human inspection.  Runs
  // receive the exact frozen municipal feature rings and verify their bytes.
  if (config.boundarySource.snapshot) {
    const snapshotFile = path.resolve(base, config.boundarySource.snapshot);
    const snapshotBytes = await fs.readFile(snapshotFile);
    if (config.boundarySource.snapshotSha256 !== digest(snapshotBytes)) throw Error('Municipal boundary snapshot hash mismatch');
    const snapshot = JSON.parse(snapshotBytes);
    if (snapshot?.type !== 'FeatureCollection' || !Array.isArray(snapshot.features) || !snapshot.features.every(feature => feature.geometry?.type === 'Polygon' && ring(feature.geometry.coordinates?.[0]))) throw Error('Municipal boundary snapshot lacks polygon features');
    const requestedIds = new Set(config.areas.flatMap(entry => entry.boundary?.sourceFeatureIds ?? []));
    const actualIds = snapshot.features.map(feature => feature.properties?.identificatie);
    if (requestedIds.size && (requestedIds.size !== actualIds.length || actualIds.some(id => !requestedIds.has(id)))) throw Error('Municipal boundary snapshot features do not match district membership pins');
    for (const entry of config.areas) for (const [index, id] of (entry.boundary?.sourceFeatureIds ?? []).entries()) {
      const feature = snapshot.features.find(candidate => candidate.properties?.identificatie === id);
      if (!feature || entry.boundary.sourceFeatureHashes?.[index] !== digest(feature)) throw Error(`Municipal boundary feature hash mismatch: ${id}`);
    }
    config = { ...config, boundary: snapshot.features.map(feature => feature.geometry.coordinates[0]), boundarySource: { ...config.boundarySource, snapshotFile } };
  }
  const areas = await Promise.all(config.areas.map(async entry => {
    const areaFile = path.resolve(base, entry.config);
    const area = validateAreaConfig(JSON.parse(await fs.readFile(areaFile, 'utf8')));
    return { ...entry, config: areaFile, area, configHash: digest(area) };
  }));
  let route = null;
  if (config.route) {
    const routeFile = path.resolve(base, config.route), value = JSON.parse(await fs.readFile(routeFile, 'utf8'));
    route = { file: routeFile, sha256: digest(value), value };
  }
  // Release identity is portable: resolved local paths are runtime details, while
  // the frozen bytes, area configurations and route bytes are the inputs.
  const identity = { version: config.version, id: config.id, name: config.name, boundary: config.boundary,
    boundarySource: { ...config.boundarySource, snapshotFile: undefined }, budgets: config.budgets, spendLimitUsd: config.spendLimitUsd,
    areas: areas.map(entry => ({ id: entry.id, district: entry.district, priority: entry.priority, boundary: entry.boundary, configHash: entry.configHash })),
    routeSha256: route?.sha256 ?? null };
  return { ...config, file: absolute, areas, route, configHash: digest(identity) };
}
