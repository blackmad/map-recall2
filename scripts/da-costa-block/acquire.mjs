import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadAreaConfig } from './area-config.mjs';
import { projectedBounds } from './projected-bounds.mjs';
import { createSourceCache, acquirePages } from './source-acquisition.mjs';
import { runPipeline } from './pipeline-runner.mjs';
import { atomicJson } from './pipeline-state.mjs';

const area = await loadAreaConfig();
const eland = area.referencePreset === 'elandsgracht';
export const bbox = area.bbox;
const cache = area.cacheRoot;
const rdBbox = projectedBounds(bbox, { legacyDiagonal: Boolean(area.referencePreset) });
const rdBoundsMethod = area.referencePreset ? 'legacy-diagonal' : 'four-corners';
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ area, rdBbox, rdBoundsMethod, stages: ['source-inventory'], sourceFamilies: ['BGT', 'BAG', 'trees', 'panoramas', '3DBAG', 'addresses', 'moorings'], imageryDownloads: Boolean(area.referencePreset) && !process.argv.includes('--inventory-only') }, null, 2));
  process.exit(0);
}
await mkdir(cache, { recursive: true });
const get = await createSourceCache({ root: cache, offline: process.argv.includes('--offline') });
const collectionSource = await get('bgt-collections', 'https://api.pdok.nl/lv/bgt/ogc/v1/collections?f=json');
const bgt = collectionSource.data;
console.log('BGT layers:', bgt.collections.map(c => c.id).join(', '));
const collections = ['wegdeel', 'ondersteunendwegdeel', 'waterdeel', 'begroeidterreindeel', 'onbegroeidterreindeel', 'scheiding_lijn', 'overbruggingsdeel', 'spoor', 'vegetatieobject_punt', 'paal', 'straatmeubilair'];
const jobs = [];
function addSource(name, url, options = {}) {
  jobs.push({ id: name, version: 'source-pages-v2', input: { area: area.configHash, url, ...options }, run: async () => {
    const result = await acquirePages({ name, url, get, ...options });
    const aggregate = `${cache}/${name}.json`;
    await atomicJson(aggregate, result.features);
    console.log(`${name}: ${result.features.length} (${result.completeness.method})`);
    return { output: { sources: result.sources, completeness: result.completeness }, artifacts: [...result.artifacts, aggregate] };
  } });
}
for (const id of collections.filter(id => bgt.collections.some(c => c.id === id))) addSource(`bgt-${id}`, `https://api.pdok.nl/lv/bgt/ogc/v1/collections/${id}/items?bbox=${bbox}&limit=1000&f=json`);
addSource('bag', `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bbox}&limit=1000&f=json`);
addSource('trees', `https://api.data.amsterdam.nl/v1/wfs/bomen/v1?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=app:stamgegevens&COUNT=1000&OUTPUTFORMAT=application/json&BBOX=${bbox},urn:ogc:def:crs:OGC::CRS84&SRSNAME=urn:ogc:def:crs:OGC::CRS84`, { wfs: true });
addSource('panoramas', `https://api.data.amsterdam.nl/panorama/panoramas/?near=${area.panorama.center}&radius=${area.panorama.radiusM}&srid=4326&page_size=500&timestamp_after=${area.panorama.after}`, { embedded: true });
addSource('3dbag', `https://api.3dbag.nl/collections/pand/items?bbox=${rdBbox}&limit=100`, { countUnit: 'cityobjects' });
addSource('addresses', `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${bbox}&limit=1000&f=json`);
addSource('moorings', `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/ligplaats/items?bbox=${bbox}&limit=1000&f=json`);
// Failures remain in acquisition-jobs.json; do not replace the last complete inventory.
const results = await runPipeline({ file: `${cache}/acquisition-jobs.json`, areaId: area.id, jobs, concurrency: area.concurrency });
await atomicJson(`${cache}/acquisition.json`, { version: 2, assembledAt: new Date().toISOString(), areaId: area.id, areaConfigHash: area.configHash, bbox, rdBbox, rdBoundsMethod, sources: [collectionSource.source, ...Object.values(results).flatMap(result => result.output.sources)], completeness: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, result.output.completeness])), errors: [] });
// Reference imagery is a legacy demo fixture, never part of custom-area discovery.
if (!area.referencePreset || process.argv.includes('--inventory-only')) process.exit(0);
const panoramas = JSON.parse(await readFile(`${cache}/panoramas.json`));
const views = [];
const frontageViews = [];
if (eland) {
  const addresses = JSON.parse(await readFile(`${cache}/addresses.json`));
  for (const n of [140,122,108,113,16,64]) {
    const a = addresses.find(a => a.properties.openbare_ruimte_naam === 'Elandsgracht' && a.properties.huisnummer === n);
    if (!a) throw new Error(`Missing reference address ${n}`);
    const ll = a.geometry.coordinates;
    frontageViews.push([`front-${n}`, [ll[0]+(n%2?.00004:-.00004), ll[1]+(n%2?.0001:-.0001)], '2025']);
  }
}
for (const [name, point, year] of eland ? [
  ['engels', [4.87948,52.36916], '2025'],
  ['eland-west', [4.8785,52.36892], '2025'],
  ['eland-middle', [4.8805,52.36943], '2025'],
  ['eland-east', [4.8819,52.36986], '2025'],
  ['eland-prinsengracht', [4.88215,52.37007], '2025'],
  ...frontageViews,
] : [
  ['shopping', [4.87335, 52.37168], '2025'],
  ['da-costa', [4.8731, 52.37245], '2025'],
  ['north', [4.874, 52.37294], '2025'],
  ['nassau', [4.87395, 52.37235], '2025'],
  ['shopping-2023', [4.87335, 52.37168], '2023'],
  ['da-costa-2023', [4.8731, 52.37245], '2023'],
  ['amsta', [4.87355,52.37285], '2023'],
]) {
  const distance = p => Math.hypot((p.geometry.coordinates[0] - point[0]) * 68000, (p.geometry.coordinates[1] - point[1]) * 111320);
  const p = panoramas.filter(p => p.timestamp.startsWith(year) && p.surface_type === 'L').sort((a, b) => distance(a) - distance(b))[0];
  if (!p) continue;
  const url = p._links.equirectangular_medium.href;
  const file = `${cache}/${p.pano_id}.jpg`;
  try { await readFile(file); } catch {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`Panorama image ${name}: ${r.status}`);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
  }
  await writeFile(`${cache}/${name}.jpg`, await readFile(file));
  views.push({ name, id: p.pano_id, url, timestamp: p.timestamp, position: p.geometry.coordinates, heading: p.heading, distanceM: Math.round(distance(p)) });
}
await writeFile(`${cache}/reference-views.json`, JSON.stringify(views, null, 2));
console.log('Reference views:', views.map(p => `${p.name} (${p.distanceM} m)`).join(', '));
