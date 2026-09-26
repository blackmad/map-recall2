/** Bounded metadata inventory, not imagery acquisition or appearance publication.
 * Run with node --import tsx. --offline replays byte-pinned provider responses.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { createSourceCache, acquirePages } from '../da-costa-block/source-acquisition.mjs';
import { projectedBounds } from '../da-costa-block/projected-bounds.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';

export const DEFAULT_CONFIG = 'scripts/city-appearance/areas/da-costa-expansion-550m-v1.json';
const countBy = (items, key) => Object.fromEntries([...items.reduce((map, item) => {
  const name = String(key(item) ?? 'unknown'); map.set(name, (map.get(name) ?? 0) + 1); return map;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));
const liveBuilding = item => ['Pand in gebruik', 'Pand in gebruik (niet ingemeten)', 'Verbouwing pand'].includes(item.properties?.status);
const inBounds = (point, bbox) => Array.isArray(point) && point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];

export function metadataSources(area) {
  return [
    { name: 'bag', url: `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${area.bbox}&limit=1000&f=json` },
    { name: 'addresses', url: `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${area.bbox}&limit=1000&f=json` },
    { name: 'panoramas', url: `https://api.data.amsterdam.nl/panorama/panoramas/?near=${area.panorama.center}&radius=${area.panorama.radiusM}&srid=4326&page_size=500&timestamp_after=${area.panorama.after}`, embedded: true },
    { name: 'trees', url: `https://api.data.amsterdam.nl/v1/wfs/bomen/v1?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=app:stamgegevens&COUNT=1000&OUTPUTFORMAT=application/json&BBOX=${area.bbox},urn:ogc:def:crs:OGC::CRS84&SRSNAME=urn:ogc:def:crs:OGC::CRS84`, wfs: true },
  ];
}

export function summarizeMetadata(area, results) {
  const bag = results.bag?.features ?? [], addresses = results.addresses?.features ?? [];
  const panoramas = results.panoramas?.features ?? [];
  const inside = panoramas.filter(item => inBounds(item.geometry?.coordinates, area.bbox));
  const land = inside.filter(item => item.surface_type === 'L');
  const issuedAddresses = addresses.filter(item => item.properties?.hoofdadres_status === 'Naamgeving uitgegeven' && ['Verblijfsobject in gebruik', 'Verblijfsobject in gebruik (niet ingemeten)', 'Verbouwing verblijfsobject'].includes(item.properties?.status));
  return {
    buildings: { features: bag.length, operational: bag.filter(liveBuilding).length, byStatus: countBy(bag, item => item.properties?.status), uniqueStableIds: new Set(bag.map(item => item.properties?.identificatie).filter(Boolean)).size },
    addresses: { verblijfsobjectFeatures: addresses.length, currentlyIssuedOperational: issuedAddresses.length, byStatus: countBy(addresses, item => item.properties?.status), streets: countBy(issuedAddresses, item => item.properties?.openbare_ruimte_naam) },
    panoramas: { radiusResults: panoramas.length, insideBbox: inside.length, landInsideBbox: land.length, landYearsInsideBbox: countBy(land, item => item.timestamp?.slice(0, 4)), radiusYears: countBy(panoramas, item => item.timestamp?.slice(0, 4)) },
    trees: { features: results.trees?.features.length ?? null },
  };
}

/** Measure only bytes referenced by the current extraction manifest, not screenshots,
 * old experiment copies, backups or unrelated cache contents. Never reads reviews. */
export async function measureBaseline(root = '.cache/da-costa-neighbourhood') {
  const manifestPath = path.join(root, 'manifest.json'), bytes = await fs.readFile(manifestPath);
  const manifest = JSON.parse(bytes), cropFiles = new Set(), panoramas = new Set();
  for (const record of manifest.records) for (const image of Object.values(record.images ?? {})) {
    if (image?.file) cropFiles.add(path.join(root, 'images', image.file));
    if (image?.panoramaId) panoramas.add(path.join(root, 'panoramas', `${image.panoramaId}.jpg`));
  }
  const measure = async files => {
    const pins = await Promise.all([...files].sort().map(async file => {
      const data = await fs.readFile(file); return { path: file, bytes: data.length, sha256: digest(data) };
    }));
    return { count: pins.length, bytes: pins.reduce((sum, pin) => sum + pin.bytes, 0), pinsHash: digest(pins), pins };
  };
  return { manifestPath, manifestSha256: digest(bytes), frontages: manifest.records.length, buildings: new Set(manifest.records.map(record => record.buildingId)).size,
    crops: await measure(cropFiles), panoramas: await measure(panoramas) };
}

export function storageScenarios(summary, baseline) {
  const buildings = summary.buildings.operational;
  const perFrontage = { panoramas: baseline.panoramas.count / baseline.frontages, panoramaBytes: baseline.panoramas.bytes / baseline.frontages, cropBytes: baseline.crops.bytes / baseline.frontages };
  return {
    method: 'Illustrative 1–2 street frontages per operational BAG building; existing source reuse and inaccessible courtyards not predicted.',
    baseline: { frontages: baseline.frontages, buildings: baseline.buildings, cropCount: baseline.crops.count, cropBytes: baseline.crops.bytes, panoramaCount: baseline.panoramas.count, panoramaBytes: baseline.panoramas.bytes },
    scenarios: [1, 2].map(frontagesPerBuilding => ({ frontagesPerBuilding, frontages: buildings * frontagesPerBuilding,
      panoramaCount: Math.ceil(buildings * frontagesPerBuilding * perFrontage.panoramas), panoramaBytes: Math.ceil(buildings * frontagesPerBuilding * perFrontage.panoramaBytes), cropBytes: Math.ceil(buildings * frontagesPerBuilding * perFrontage.cropBytes) })),
    excludes: ['Aerial imagery', '3D geometry', 'Historical experiments and backups', 'GPU memory', 'New imagery deduplication against existing cache'],
    inferenceCostForecastUsd: null,
    costWarning: 'No model requests priced or authorized here; historical research spend is not a production unit price. Current global $5 ceiling is unchanged.',
  };
}

export async function inventoryExpansion(area, { offline = false, fetchImpl = fetch, baselineRoot, maxPages = 40 } = {}) {
  const root = path.join(area.cacheRoot, 'metadata-inventory-v1');
  const get = await createSourceCache({ root, offline, fetchImpl });
  const results = {}, errors = [];
  // Sequential source families bound service load; individual requests are cached.
  for (const source of metadataSources(area)) {
    try { results[source.name] = await acquirePages({ ...source, get, maxPages }); }
    catch (error) { errors.push({ source: source.name, message: error.message }); }
  }
  const summary = summarizeMetadata(area, results);
  const baseline = await measureBaseline(baselineRoot);
  const sourcePins = Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.sources]));
  const codePins = await Promise.all(['./inventory-expansion.mjs', '../da-costa-block/area-config.mjs', '../da-costa-block/source-acquisition.mjs', '../da-costa-block/projected-bounds.mjs', '../da-costa-block/pipeline-state.mjs', '../../src/canalRecall/facade/rdNew.ts'].map(async name => ({ path: name, sha256: digest(await fs.readFile(new URL(name, import.meta.url))) })));
  const identity = { version: 'expansion-inventory/1', areaId: area.id, areaConfigHash: area.configHash, sourcePins,
    baselineManifestHash: baseline.manifestSha256, baselineCropPinsHash: baseline.crops.pinsHash, baselinePanoramaPinsHash: baseline.panoramas.pinsHash,
    codePins, errors };
  const report = { ...identity, inventoryHash: digest(identity), bbox: area.bbox, origin: area.origin,
    rdBbox: projectedBounds(area.bbox), rdBoundsMethod: 'four-corners',
    boundaryDescription: 'Approximately 550 m square candidate around Da Costa. Not a measured count of street blocks.',
    complete: errors.length === 0, errors, summary, completeness: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.completeness])),
    storage: storageScenarios(summary, baseline), imageryDownloads: 0, paidCalls: 0,
    limitations: ['BAG query returns intersecting footprints, including edge-crossing buildings.', 'Verblijfsobject features are units, not a complete enumeration of every address.', 'Panorama radius includes a halo; in-bbox land results are counted separately.', 'No 3DBAG geometry or BGT ground acquisition; inventory is not a compilable area cache.'],
  };
  const destination = path.join(area.cacheRoot, '..', 'inventory', report.inventoryHash);
  await atomicJson(path.join(destination, 'inventory.json'), report);
  await atomicJson(path.join(destination, 'baseline-pins.json'), baseline);
  // A small source-pinned geometry inventory is usable by maps without importing
  // VBO/unit data or treating this incomplete source family set as an area build.
  await atomicJson(path.join(destination, 'candidate-footprints.geojson'), {
    type: 'FeatureCollection', areaId: area.id, inventoryHash: report.inventoryHash,
    features: (results.bag?.features ?? []).filter(liveBuilding).map(feature => ({
      type: 'Feature', id: feature.properties.identificatie, geometry: feature.geometry,
      properties: { buildingId: feature.properties.identificatie, status: feature.properties.status, constructionYear: feature.properties.bouwjaar, appearance: 'not-acquired' },
    })),
  });
  return { report, reportPath: path.join(destination, 'inventory.json') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const area = await loadAreaConfig(args.some(arg => arg.startsWith('--area-config=') || arg.startsWith('--area=')) ? args : [`--area-config=${DEFAULT_CONFIG}`]);
  if (args.includes('--dry-run')) console.log(JSON.stringify({ area, rdBbox: projectedBounds(area.bbox), sources: metadataSources(area), maxPagesPerFamily: 40, imageryDownloads: 0, paidCalls: 0 }, null, 2));
  else {
    const result = await inventoryExpansion(area, { offline: args.includes('--offline') });
    console.log(JSON.stringify({ reportPath: result.reportPath, ...result.report }, null, 2));
    if (!result.report.complete) process.exitCode = 1;
  }
}
