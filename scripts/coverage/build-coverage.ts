/**
 * Build the buurt coverage map: per Amsterdam buurt, the share of BAG pands each
 * drawing tier owns, a repetition score, the dominant build decade, and whether a
 * street survey / block-face type library reaches it (src/canalRecall/coverage/coverage.ts).
 *
 * Sources (open data / repo only):
 *   - buurt, wijk, ggw-gebied and stadsdeel registers: api.data.amsterdam.nl/v1/gebieden (CC0),
 *     cached raw under artifacts/coverage/raw/ (downloaded on first run, `--refresh` re-downloads);
 *   - BAG pands, heights and build years: the game's base tiles public/data/extracts/amsterdam/bag-tiles/14;
 *   - tiers, read the way the game loads them:
 *       bespoke / large recipe / per-house recipe / hand-built ordinary: scripts/lib/placedFootprints `allSpecs()`
 *         (= PLACED_MODELS + MANUAL_LANDMARKS + chunk specs), classed by ordinary-buildings-data/catalogue.json
 *         `source`/`category`; pands from public/canal-drive/models/covers.json (the footprint join) plus each
 *         spec's own suppress ids resolved through the BAG index;
 *       block-face chunks: ordinary-buildings-data/chunks.json (via allSpecs, ids `chunk-*`);
 *       building types: public/canal-drive/building-types/instances.json;
 *       landmark kits: src/canalRecall/landmarkKits.ts KITS part ids resolved through the BAG index;
 *   - flags: scripts/street-surveys/streets/*.json, scripts/block-face/types/<district>/*.json evidence pands,
 *     scripts/block-face/faces/<face>/pands/.
 *
 * Writes staging artifacts/coverage/out/buurten.json(.gz); `--publish` also writes
 * public/data/extracts/amsterdam/coverage-v1/buurten.json(.gz).
 *
 *   node --import tsx scripts/coverage/build-coverage.ts [--publish] [--refresh]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { allSpecs } from '../lib/placedFootprints';
import { addFeatures, emptyIndex, resolveSuppressed } from '../../src/canalRecall/bagPandIndex';
import { fullPandId } from '../../src/canalRecall/bagTiles';
import { KITS, kitIds } from '../../src/canalRecall/landmarkKits';
import {
  TIERS, TIER_IDS, aggregate, bboxOf, buurtLocator, claim, polygonsOf, rankForGenerators, simplifyRing,
  type Buurt, type BuurtMeta, type PandRecord, type Ring, type TierId,
} from '../../src/canalRecall/coverage/coverage';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RAW = path.join(ROOT, 'artifacts/coverage/raw');
const STAGING = path.join(ROOT, 'artifacts/coverage/out');
const PUBLISH = path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1');
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
const API = 'https://api.data.amsterdam.nl/v1/gebieden';
const arg = (f: string) => process.argv.includes(`--${f}`);
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ringMean = (ring: Ring): [number, number] => {
  const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
  let x = 0, y = 0; for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
};

// --- gebieden -----------------------------------------------------------------
const RAW_FILES: Record<string, string> = {
  'buurten.geojson': `${API}/buurten/?_format=geojson&_pageSize=2000&eindGeldigheid[isnull]=true`,
  'wijken.json': `${API}/wijken/?_format=json&_pageSize=2000&eindGeldigheid[isnull]=true&_fields=identificatie,naam,code,ligtInStadsdeelId`,
  'ggwgebieden.json': `${API}/ggwgebieden/?_format=json&_pageSize=200&eindGeldigheid[isnull]=true&_fields=identificatie,naam,code,ligtInStadsdeelId`,
  'stadsdelen.json': `${API}/stadsdelen/?_format=json&_pageSize=200&eindGeldigheid[isnull]=true&_fields=identificatie,naam,code`,
};
fs.mkdirSync(RAW, { recursive: true });
for (const [file, url] of Object.entries(RAW_FILES)) {
  const out = path.join(RAW, file);
  if (fs.existsSync(out) && !arg('refresh')) continue;
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: ${response.status}`);
  fs.writeFileSync(out, await response.text());
  console.log(`downloaded ${file}`);
}
type Named = { identificatie: string; naam: string; code: string; ligtInStadsdeelId?: string };
const embedded = (file: string, key: string): Named[] => readJson(path.join(RAW, file))._embedded[key];
const wijken = new Map(embedded('wijken.json', 'wijken').map(w => [w.identificatie, w]));
const gebieden = new Map(embedded('ggwgebieden.json', 'ggwgebieden').map(g => [g.identificatie, g]));
const stadsdelen = new Map(embedded('stadsdelen.json', 'stadsdelen').map(s => [s.identificatie, s]));
type BuurtFeature = { geometry: { type: string; coordinates: unknown }; properties: { identificatie: string; naam: string; code: string; cbsCode?: string; ligtInWijkId?: string; ligtInGgwgebiedId?: string } };
const buurtFeatures = (readJson(path.join(RAW, 'buurten.geojson')).features as BuurtFeature[]).filter(f => f.geometry);
const buurten: Buurt[] = buurtFeatures.map(f => { const polygons = polygonsOf(f.geometry); return { code: f.properties.code, name: f.properties.naam, polygons, bbox: bboxOf(polygons) }; });
const meta: BuurtMeta[] = buurtFeatures.map(f => {
  const p = f.properties, w = p.ligtInWijkId ? wijken.get(p.ligtInWijkId) : undefined;
  const g = p.ligtInGgwgebiedId ? gebieden.get(p.ligtInGgwgebiedId) : undefined;
  const sd = w?.ligtInStadsdeelId ? stadsdelen.get(w.ligtInStadsdeelId) : undefined;
  return { code: p.code, name: p.naam, wijk: w?.naam, wijkCode: w?.code, gebied: g?.naam, stadsdeel: sd?.naam, cbsCode: p.cbsCode };
});
console.log(`buurten: ${buurten.length}`);

// --- BAG pands ------------------------------------------------------------------
const index = emptyIndex();
const pands = new Map<string, PandRecord>();
/** OSM-only outlines (tier 2 building:part where a landmark's parts replace its pand; tier 4 sheds/kiosks BAG lacks): centroid + tier. */
const osmOnly = new Map<string, { centroid: [number, number]; tier: number }>();
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) {
  for (const file of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const features = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, file))).toString('utf8')).features;
    addFeatures(index, features);
    for (const f of features) {
      const id = String(f.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.')) {
        const ring = polygonsOf(f.geometry ?? { type: '', coordinates: [] })[0]?.[0];
        if (ring?.length && !osmOnly.has(id)) osmOnly.set(id, { centroid: ringMean(ring), tier: Number(f.properties?.tier) });
        continue;
      }
      if (pands.has(id)) continue;
      const indexed = index.pands.get(id);
      if (!indexed) continue;
      pands.set(id, { id, centroid: indexed.centroid, ring: indexed.rings[0], height: Number(f.properties.height) || undefined, year: Number(f.properties.year) || undefined });
    }
  }
}
console.log(`BAG pands in base tiles: ${pands.size}`);

// --- tiers ----------------------------------------------------------------------
const tierOf = new Map<string, TierId>();
const unattributed: string[] = [];
const catalogue = new Map<string, { source?: string; category?: string }>(
  (readJson(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/catalogue.json')).models as { id: string; source?: string; category?: string }[]).map(m => [m.id, m]));
type Spec = ReturnType<typeof allSpecs>[number];
function specTier(spec: Spec): TierId {
  if (spec.id.startsWith('chunk-')) return 'chunk';
  const entry = catalogue.get(spec.id);
  if (spec.assetKind === 'ordinary-building' && entry) {
    if (entry.source === 'building-recipes-large') return 'largeRecipe';
    if (entry.category === 'street-survey' || entry.source === 'building-recipes') return 'houseRecipe';
    return 'ordinaryGlb';
  }
  return 'bespoke';
}
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json')) as { models: Record<string, { p: string[] }>; buildingTypes: string[] };
const specs = allSpecs();
const specIds = new Set(specs.map(s => s.id));
const perTierModels: Record<string, number> = {};
const missingPand = new Set<string>();
const claimedOsm = new Set<string>();
/**
 * One counting unit for a model or kit that covers no pand: the base tiles dropped the BAG pand for its OSM parts.
 * Placed at the mean of those parts' centroids; no ring/height/year, so it never joins a repetition cluster.
 */
function synthesiseUnit(id: string, osmIds: readonly string[], tier: TierId): boolean {
  const parts = osmIds.map(o => osmOnly.get(o)).filter(Boolean) as { centroid: [number, number] }[];
  osmIds.forEach(o => claimedOsm.add(o));
  if (!parts.length) return false;
  const centroid: [number, number] = [parts.reduce((a, p) => a + p.centroid[0], 0) / parts.length, parts.reduce((a, p) => a + p.centroid[1], 0) / parts.length];
  if (!pands.has(id)) pands.set(id, { id, centroid, ring: [] });
  claim(tierOf, id, tier);
  synthetic++;
  return true;
}
let synthetic = 0;
const take = (pand: string, tier: TierId) => { if (pands.has(pand)) claim(tierOf, pand, tier); else missingPand.add(pand); };
for (const spec of specs) {
  const tier = specTier(spec);
  perTierModels[tier] = (perTierModels[tier] ?? 0) + 1;
  const entry = covers.models[spec.id];
  const covered = entry?.p.map(fullPandId) ?? [];
  const resolved = resolveSuppressed(index, spec.suppressOsmIds.map(String));
  for (const pand of new Set([...covered, ...resolved.pands])) take(pand, tier);
  if (covered.length || resolved.pands.length) continue;
  // No pand: at landmarks the base tiles draw OSM building:parts instead of the BAG pand, so the model stands on OSM-only outlines.
  if (!synthesiseUnit(`model:${spec.id}`, [...(entry?.o ?? []), ...resolved.osmOnly], tier)) unattributed.push(`${tier}:${spec.id}`);
}
const staleCovers = Object.keys(covers.models).filter(id => !specIds.has(id));
const instances = readJson(path.join(ROOT, 'public/canal-drive/building-types/instances.json')) as { pand: string }[];
for (const i of instances) take(fullPandId(i.pand), 'buildingType');
perTierModels.buildingType = instances.length;
let kitParts = 0;
for (const kit of KITS) {
  const ids = kitIds(kit);
  kitParts += ids.length;
  const resolved = resolveSuppressed(index, ids);
  for (const pand of resolved.pands) take(pand, 'landmarkKit');
  // A kit on a landmark a model already draws adds no unit; the model wins (bespoke precedes landmarkKit).
  if (!resolved.pands.length) synthesiseUnit(`kit:${kit.name}`, resolved.osmOnly.filter(o => !claimedOsm.has(o)), 'landmarkKit');
  else resolved.osmOnly.forEach(o => claimedOsm.add(o));
}
perTierModels.landmarkKit = KITS.length;

// Unclaimed tier-2 OSM parts are buildings whose pand the base tiles replaced by OSM building:parts and no model or kit
// draws: generic extrusions. Parts whose centroids lie within GROUP_M of each other become one generic unit.
const GROUP_M = 15;
const loose = [...osmOnly].filter(([id, v]) => v.tier === 2 && !claimedOsm.has(id));
const parent = loose.map((_, i) => i);
const find = (i: number): number => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
{
  const kx = 111_320 * Math.cos(52.37 * Math.PI / 180), ky = 111_320, cell = new Map<string, number[]>();
  loose.forEach(([, v], i) => {
    const cx = Math.floor(v.centroid[0] * kx / GROUP_M), cy = Math.floor(v.centroid[1] * ky / GROUP_M);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of cell.get(`${cx + dx}:${cy + dy}`) ?? []) {
      const a = loose[j][1].centroid;
      if (Math.hypot((a[0] - v.centroid[0]) * kx, (a[1] - v.centroid[1]) * ky) <= GROUP_M) parent[find(i)] = find(j);
    }
    const k = `${cx}:${cy}`; const l = cell.get(k); if (l) l.push(i); else cell.set(k, [i]);
  });
}
const groups = new Map<number, [number, number][]>();
loose.forEach(([, v], i) => { const r = find(i); const g = groups.get(r); if (g) g.push(v.centroid); else groups.set(r, [v.centroid]); });
for (const [root, cs] of groups) {
  const id = `osm:${loose[root][0]}`;
  pands.set(id, { id, centroid: [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length], ring: [] });
}

// --- survey / type / face flags -------------------------------------------------
const addTo = (map: Map<string, string[]>, key: string, value: string) => { const l = map.get(key); if (!l) map.set(key, [value]); else if (!l.includes(value)) l.push(value); };
const survey = new Map<string, string[]>();
const surveyDir = path.join(ROOT, 'scripts/street-surveys/streets');
for (const file of fs.readdirSync(surveyDir).filter(f => f.endsWith('.json'))) {
  const s = readJson(path.join(surveyDir, file)) as { street: string; pands: { pandId: string }[] };
  for (const p of s.pands ?? []) addTo(survey, fullPandId(String(p.pandId)), s.street);
}
const types = new Map<string, string[]>();
const typesDir = path.join(ROOT, 'scripts/block-face/types');
const typeCounts: Record<string, number> = {};
for (const district of fs.readdirSync(typesDir).filter(d => fs.statSync(path.join(typesDir, d)).isDirectory())) {
  for (const file of fs.readdirSync(path.join(typesDir, district)).filter(f => f.endsWith('.json'))) {
    typeCounts[district] = (typeCounts[district] ?? 0) + 1;
    const t = readJson(path.join(typesDir, district, file)) as { evidence?: { pands?: string[] }[] };
    // Evidence cites the last six digits of a 0363100012…… pand id.
    for (const e of t.evidence ?? []) for (const short of e.pands ?? []) addTo(types, fullPandId(/^\d{6}$/.test(short) ? `0363100012${short}` : short), district);
  }
}
const faces = new Set<string>();
const facesDir = path.join(ROOT, 'scripts/block-face/faces');
for (const face of fs.readdirSync(facesDir)) {
  const dir = path.join(facesDir, face, 'pands');
  if (fs.existsSync(dir)) for (const p of fs.readdirSync(dir)) if (/^\d{16}$/.test(p)) faces.add(fullPandId(p));
}

// --- assign pands to buurten ---------------------------------------------------------
const locate = buurtLocator(buurten);
const byBuurt = new Map<string, PandRecord[]>();
const outside: PandRecord[] = [];
for (const p of pands.values()) {
  const code = locate(p.centroid);
  if (!code) { outside.push(p); continue; }
  const l = byBuurt.get(code); if (l) l.push(p); else byBuurt.set(code, [p]);
}
const rows = aggregate(meta, byBuurt, tierOf, { survey, types, faces });

// --- output ----------------------------------------------------------------------
const geometryOf = new Map(buurten.map(b => [b.code, b.polygons]));
const TOL = 0.00004; // ~3–4 m
const features = rows.map(r => {
  const polys = geometryOf.get(r.code)!.map(poly => poly.map(ring => simplifyRing(ring as Ring, TOL)));
  return { type: 'Feature', properties: r, geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } };
});
const totals = Object.fromEntries(TIER_IDS.map(t => [t, 0])) as Record<TierId, number>;
for (const r of rows) for (const t of TIER_IDS) totals[t] += r.tiers[t];
const outsideTiers: Partial<Record<TierId, number>> = {};
for (const p of outside) { const t = tierOf.get(p.id) ?? 'generic'; outsideTiers[t] = (outsideTiers[t] ?? 0) + 1; }
const file = {
  type: 'FeatureCollection',
  version: 1,
  generatedAt: new Date().toISOString(),
  sources: {
    buurten: `${API}/buurten (CC0), cached ${new Date(fs.statSync(path.join(RAW, 'buurten.geojson')).mtime).toISOString().slice(0, 10)}`,
    pands: 'public/data/extracts/amsterdam/bag-tiles/14 (BAG pand id, 3DBAG height, BAG year)',
    tiers: 'allSpecs() + models/covers.json, ordinary-buildings-data/catalogue.json + chunks.json, building-types/instances.json, landmarkKits.ts KITS',
    flags: 'scripts/street-surveys/streets, scripts/block-face/types/<district>, scripts/block-face/faces/*/pands',
  },
  method: 'pand → buurt by footprint centroid; a pand two tiers claim counts under the earlier tier; repetition = share of non-minor pands (≥3.5 m, ≥20 m²) in the top 3 width(1 m)×height(3 m)×year(5 y) clusters; priority = repetition × (1 − modelled share)',
  tiers: TIERS,
  totals: { pands: rows.reduce((a, r) => a + r.pands, 0), tiers: totals, outsideBuurten: { pands: outside.length, tiers: outsideTiers } },
  models: perTierModels,
  typeLibraries: typeCounts,
  features,
};
const json = JSON.stringify(file);
const write = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'buurten.json'), json);
  fs.writeFileSync(path.join(dir, 'buurten.json.gz'), zlib.gzipSync(json, { level: 9 }));
};
write(STAGING);
if (arg('publish')) write(PUBLISH);

// --- report -------------------------------------------------------------------------
const pct = (n: number, d: number) => `${(100 * n / Math.max(1, d)).toFixed(2)}%`;
console.log(`pands in a buurt: ${file.totals.pands}; outside every buurt: ${outside.length}`);
console.log('city-wide pands per tier (default-on marked *):');
for (const t of TIERS) console.log(`  ${t.defaultOn ? '*' : ' '} ${t.id.padEnd(13)} ${String(totals[t.id]).padStart(7)}  ${pct(totals[t.id], file.totals.pands)}  (${perTierModels[t.id] ?? '-'} models)`);
console.log(`models: ${specs.length} specs, ${unattributed.length} with no resolvable pand${unattributed.length ? `: ${unattributed.slice(0, 12).join(', ')}${unattributed.length > 12 ? ', …' : ''}` : ''}`);
console.log(`covers.json entries with no current spec: ${staleCovers.length}${staleCovers.length ? ` (${staleCovers.slice(0, 8).join(', ')})` : ''}`);
const parts2 = [...osmOnly].filter(([, v]) => v.tier === 2), unclaimed2 = loose;
console.log(`model/kit units on OSM-only outlines (no pand in the base tiles): ${synthetic}; tier-2 OSM parts ${parts2.length}, unclaimed by any model or kit ${unclaimed2.length}, counted as ${groups.size} generic units (parts within ${GROUP_M} m grouped)`);
console.log(`claimed pands missing from the base tiles: ${missingPand.size}; kit part ids: ${kitParts}`);
console.log(`flags: survey pands ${survey.size}, type-evidence pands ${types.size}, face pands ${faces.size}`);
console.log(`buurten with pands: ${rows.filter(r => r.pands).length}; json ${(json.length / 1024).toFixed(0)} KB raw, ${(zlib.gzipSync(json).length / 1024).toFixed(0)} KB gz`);
console.log('\ntop 25 generator to-do (≥80 pands): code name | pands | rep | modelled | priority | uncovered repetitive | decade | survey/types');
for (const [i, r] of rankForGenerators(rows).slice(0, 25).entries()) {
  console.log(`${String(i + 1).padStart(2)}. ${r.code} ${r.name} (${r.wijk}) | ${r.pands} | ${r.repetition} | ${r.share} | ${r.priority} | ${r.repetitiveGeneric} | ${r.decade}s ${Math.round(r.decadeShare * 100)}% | ${r.survey.streets.join('+') || '-'} / ${r.types.districts.join('+') || '-'}`);
}
console.log(`\nwrote ${STAGING}/buurten.json(.gz)${arg('publish') ? ` and ${PUBLISH}/buurten.json(.gz)` : ' (staging only; --publish to install)'}`);
