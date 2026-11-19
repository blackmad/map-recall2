/**
 * Design units, phase 0 (T1; docs/handoffs/design-units-plan-20261119.md): join the ring's BAG pands to the ordekaart
 * layers, infer units where they are silent, order members along each street face, and stage the index plus the
 * numbers the phase 0 gate report reads.
 *
 *   node --import tsx scripts/design-units/build-index.ts [--fetch] [--source <dir>] [--publish]
 *
 * Inputs:
 *   - ordekaart layers: <dir>/<KAARTLAAG>.geojson(.gz) (default .cache/ordekaart-20261119; --fetch downloads them from
 *     maps.amsterdam.nl; the archived copy is map-recall2-source-data datasets/ordekaart-20261119);
 *   - the ring: buurten whose gebied is in RIDE_PRIORITY_GEBIEDEN (coverage-v1/buurten.json), pands by footprint centroid
 *     as coverage-v1 assigns them;
 *   - BAG pands, years, 3DBAG eaves/height/roof class: public/data/extracts/amsterdam/bag-tiles/14;
 *   - named streets: public/data/extracts/amsterdam/streets-routing.json (the buurt generator's street classes).
 *
 * Writes artifacts/design-units/staging/{design-units.json,stats.json}. --publish also copies design-units.json(.gz) to
 * public/data/extracts/amsterdam/design-units-v1/ (only after the report has been read).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buurtLocator, bboxOf, polygonsOf, type Buurt } from '../../src/canalRecall/coverage/coverage.ts';
import { RIDE_PRIORITY_GEBIEDEN } from '../../src/canalRecall/ridePriority.ts';
import { ASSIGN_SHARE, INFER_EAVES_M, LAYER_YEAR, PARTIAL_SHARE, STRADDLE_SHARE, isMinorPand, joinDesignUnits, parseOrdekaart, type NamedStreet } from '../../src/canalRecall/designUnits/join.ts';
import { ORDEKAART_LAYERS, ORDEKAART_SOURCES, type OrdekaartObject, type UnitPand } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const PUBLISH = path.join(EXTRACT, 'design-units-v1');
const arg = (f: string) => process.argv.includes(`--${f}`);
const opt = (f: string) => { const i = process.argv.indexOf(`--${f}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const SOURCE = path.resolve(ROOT, opt('source') ?? '.cache/ordekaart-20261119');
const UA = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const STREET_CLASSES = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'pedestrian', 'busway', 'trunk']);

// --- ordekaart ----------------------------------------------------------------------------------------------------
fs.mkdirSync(SOURCE, { recursive: true });
const objects: OrdekaartObject[] = [];
for (const layer of ORDEKAART_LAYERS) {
  const { kaartlaag, thema } = ORDEKAART_SOURCES[layer];
  const plain = path.join(SOURCE, `${kaartlaag}.geojson`), gz = `${plain}.gz`;
  if (!fs.existsSync(plain) && !fs.existsSync(gz)) {
    if (!arg('fetch')) throw Error(`${plain} missing: pass --fetch, or --source the archived copy`);
    const url = `https://maps.amsterdam.nl/open_geodata/geojson_lnglat.php?KAARTLAAG=${kaartlaag}&THEMA=${thema}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw Error(`${url}: ${r.status}`);
    fs.writeFileSync(plain, await r.text());
  }
  const raw = fs.existsSync(plain) ? fs.readFileSync(plain) : zlib.gunzipSync(fs.readFileSync(gz));
  const list = parseOrdekaart(layer, JSON.parse(raw.toString('utf8')));
  objects.push(...list);
  console.log(`ordekaart ${layer}: ${list.length} objects`);
}

// --- ring buurten ---------------------------------------------------------------------------------------------------
type BuurtProps = { code: string; name: string; gebied?: string; stadsdeel?: string };
const cov = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'coverage-v1/buurten.json'), 'utf8')) as { features: Array<{ properties: BuurtProps; geometry: { type: string; coordinates: unknown } }> };
const buurtMeta = new Map(cov.features.map(f => [f.properties.code, f.properties]));
const buurten: Buurt[] = cov.features.map(f => { const polygons = polygonsOf(f.geometry); return { code: f.properties.code, name: f.properties.name, polygons, bbox: bboxOf(polygons) }; });
const locate = buurtLocator(buurten);
const ringCodes = new Set(cov.features.filter(f => RIDE_PRIORITY_GEBIEDEN.has(f.properties.gebied ?? '')).map(f => f.properties.code));
console.log(`ring buurten: ${ringCodes.size}`);

// --- pands ----------------------------------------------------------------------------------------------------------
const TILES = path.join(EXTRACT, 'bag-tiles/14');
const allPands = new Map<string, UnitPand>();
const numOr = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, file))).toString('utf8'));
  for (const f of fc.features) {
    const full = String(f.properties?.id ?? '');
    if (!full.startsWith('NL.IMBAG.Pand.')) continue;
    const id = full.slice('NL.IMBAG.Pand.'.length);
    if (allPands.has(id) || !f.geometry) continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring || ring.length < 3) continue;
    const y = numOr(f.properties.year);
    allPands.set(id, { id, ring, year: y && y > 1000 && y < 2100 ? y : null, eavesM: numOr(f.properties.eaves), heightM: numOr(f.properties.height), roofCode: numOr(f.properties.roof) });
  }
}
const ringMean = (r: readonly (readonly [number, number])[]): [number, number] => {
  const n = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.length - 1 : r.length;
  let x = 0, y = 0; for (let i = 0; i < n; i++) { x += r[i][0]; y += r[i][1]; } return [x / n, y / n];
};
const buurtOf = new Map<string, string>();
const ring: UnitPand[] = [];
let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
for (const p of allPands.values()) {
  const c = ringMean(p.ring), code = locate(c);
  if (!code || !ringCodes.has(code)) continue;
  buurtOf.set(p.id, code); ring.push(p);
  w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
}
ring.sort((a, b) => (a.id < b.id ? -1 : 1));
const PAD = 0.002;
const context = [...allPands.values()].filter(p => !buurtOf.has(p.id) && (() => { const c = ringMean(p.ring); return c[0] > w - PAD && c[0] < e + PAD && c[1] > s - PAD && c[1] < n + PAD; })());
console.log(`BAG pands: ${allPands.size}; ring ${ring.length} (${ring.filter(isMinorPand).length} minor); context ${context.length}`);

// --- streets ----------------------------------------------------------------------------------------------------------
const ways = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'streets-routing.json'), 'utf8')) as Array<{ name?: string; highway?: string; path?: number[][]; paths?: number[][][] }>;
const streets: NamedStreet[] = ways.filter(x => x.name && STREET_CLASSES.has(x.highway ?? '')).flatMap(x => (x.paths ?? [x.path!]).filter(Boolean).map(p => ({ name: x.name!, path: p.map(q => [q[1], q[0]] as const) })));
console.log(`named streets: ${streets.length}`);

// --- join -----------------------------------------------------------------------------------------------------------
const t0 = Date.now();
const res = joinDesignUnits({ pands: ring, objects, streets, context });
console.log(`join: ${res.units.length} units in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// --- stage --------------------------------------------------------------------------------------------------------
fs.mkdirSync(STAGING, { recursive: true });
const index = {
  schema: 'design-units-v1',
  generatedAt: new Date().toISOString(),
  method: `pand → ordekaart object holding >= ${ASSIGN_SHARE} of its footprint (area overlap); straddle when a second holds >= ${STRADDLE_SHARE}; ` +
    `partial hold >= ${PARTIAL_SHARE}; pands built after ${LAYER_YEAR} never join (BAG wins); uncovered non-minor party-wall neighbours with the same BAG year, ` +
    `eaves within ${INFER_EAVES_M} m and the same 3DBAG roof class form an inferred unit; fronts by buurtGenerator/rows.ts frontEdgeOf. ` +
    'A single-pand unit seeds on its pand id.',
  sources: {
    ordekaart: 'Gemeente Amsterdam, Monumenten en Archeologie, ordekaart Centrum/Ring/Gordel/AUP gebouwen, maps.amsterdam.nl/open_geodata (fetched 2026-11-19). ' +
      'The original datasets are freely available from the Gemeente Amsterdam under its Maps Data Gebruiksvoorwaarden (https://maps.amsterdam.nl/open_geodata/terms.php), which also apply to this derived copy.',
    pands: 'public/data/extracts/amsterdam/bag-tiles/14 (BAG pand, BAG year, 3DBAG eaves/height/roof)',
    ring: 'coverage-v1/buurten.json, gebied in RIDE_PRIORITY_GEBIEDEN',
  },
  units: res.units,
};
const json = JSON.stringify(index);
fs.writeFileSync(path.join(STAGING, 'design-units.json'), json);

// Stats for the report.
const nonMinor = ring.filter(p => !isMinorPand(p));
const layerOf = (pid: string) => { const u = res.unitOf.get(pid); return u?.startsWith('du:') && !u.startsWith('du:inf:') ? u.split(':')[1] : null; };
const unitById = new Map(res.units.map(u => [u.id, u]));
// Share histogram of the best hit, non-minor.
const shareHist = new Array(11).fill(0);
for (const p of nonMinor) { const sh = res.overlaps.get(p.id)?.hits[0]?.share ?? 0; shareHist[Math.min(10, Math.floor(sh * 10))]++; }
const byGebied: Record<string, { pands: number; inObject: number; byLayer: Record<string, number> }> = {};
const byBuurt: Record<string, { name: string; gebied: string; pands: number; inObject: number; units: number; multi: number }> = {};
for (const p of nonMinor) {
  const m = buurtMeta.get(buurtOf.get(p.id)!)!;
  const g = (byGebied[m.gebied!] ??= { pands: 0, inObject: 0, byLayer: {} });
  const b = (byBuurt[m.code] ??= { name: m.name, gebied: m.gebied!, pands: 0, inObject: 0, units: 0, multi: 0 });
  g.pands++; b.pands++;
  const u = unitById.get(res.unitOf.get(p.id)!);
  if (u?.object) { g.inObject++; b.inObject++; const L = u.object.key.split(':')[0]; g.byLayer[L] = (g.byLayer[L] ?? 0) + 1; }
}
const unitsByBuurt = new Map<string, Set<string>>();
for (const p of nonMinor) { const c = buurtOf.get(p.id)!; const set = unitsByBuurt.get(c) ?? unitsByBuurt.set(c, new Set()).get(c)!; set.add(res.unitOf.get(p.id)!); }
for (const [c, set] of unitsByBuurt) { byBuurt[c].units = set.size; byBuurt[c].multi = [...set].filter(id => (unitById.get(id)?.members.length ?? 1) > 1).length; }

const byLayer: Record<string, number> = {};
for (const p of nonMinor) { const L = layerOf(p.id); if (L) byLayer[L] = (byLayer[L] ?? 0) + 1; }
// Units by source and size.
const sizeHist: Record<string, Record<string, number>> = {};
for (const u of res.units) { const k = u.members.length >= 10 ? '10+' : String(u.members.length); (sizeHist[u.source] ??= {})[k] = (sizeHist[u.source][k] ?? 0) + 1; }
// Objects by orde: footprint area and ring pands per object.
const ringAreaM2 = (o: OrdekaartObject) => {
  // Shoelace in the local frame on the outer rings minus holes.
  const kx = 111_320 * Math.cos(52.37 * Math.PI / 180), ky = 110_540;
  let a = 0;
  for (const poly of o.polygons) poly.forEach((r, i) => { let t = 0; for (let k = 0; k < r.length; k++) { const p = r[k], q = r[(k + 1) % r.length]; t += p[0] * kx * q[1] * ky - q[0] * kx * p[1] * ky; } a += (i === 0 ? 1 : -1) * Math.abs(t) / 2; });
  return a;
};
const pandsPerObject = new Map<string, number>();
for (const u of res.units) if (u.object) pandsPerObject.set(u.object.key, u.members.length);
const ordeStats: Record<string, { objects: number; inRing: number; medianAreaM2: number; p90AreaM2: number; medianPands: number; p90Pands: number; maxPands: number }> = {};
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
for (const layer of ORDEKAART_LAYERS) for (const orde of [...new Set(objects.filter(o => o.layer === layer).map(o => o.orde))].sort()) {
  const list = objects.filter(o => o.layer === layer && o.orde === orde);
  const areas = list.map(ringAreaM2), inRing = list.filter(o => pandsPerObject.has(o.key)), pp = inRing.map(o => pandsPerObject.get(o.key)!);
  ordeStats[`${layer}/${orde || '(blank)'}`] = { objects: list.length, inRing: inRing.length, medianAreaM2: Math.round(q(areas, 0.5)), p90AreaM2: Math.round(q(areas, 0.9)), medianPands: q(pp, 0.5), p90Pands: q(pp, 0.9), maxPands: Math.max(0, ...pp) };
}
// Year agreement: pand BAG year vs object year.
const yearDiff = { same: 0, within2: 0, within5: 0, within15: 0, over15: 0, objNoYear: 0, pandNoYear: 0 };
for (const p of nonMinor) {
  const u = unitById.get(res.unitOf.get(p.id)!); if (!u?.object) continue;
  if (u.object.year === null) { yearDiff.objNoYear++; continue; }
  if (p.year === null) { yearDiff.pandNoYear++; continue; }
  const d = Math.abs(p.year - u.object.year);
  if (d === 0) yearDiff.same++; else if (d <= 2) yearDiff.within2++; else if (d <= 5) yearDiff.within5++; else if (d <= 15) yearDiff.within15++; else yearDiff.over15++;
}
const stats = {
  generatedAt: index.generatedAt,
  thresholds: { ASSIGN_SHARE, STRADDLE_SHARE, PARTIAL_SHARE, LAYER_YEAR, INFER_EAVES_M },
  ring: { buurten: ringCodes.size, pands: ring.length, minor: ring.length - nonMinor.length, nonMinor: nonMinor.length },
  coverage: { inObject: nonMinor.filter(p => unitById.get(res.unitOf.get(p.id)!)?.object).length, byLayer, shareHist, afterLayer: res.afterLayer.length,
    anyTouch: nonMinor.filter(p => (res.overlaps.get(p.id)?.hits[0]?.share ?? 0) > 0).length },
  byGebied, byBuurt,
  units: { total: res.units.length, bySource: Object.fromEntries(['ordekaart', 'inferred', 'single'].map(k => [k, res.units.filter(u => u.source === k).length])), sizeHist,
    multiPand: res.units.filter(u => u.members.length > 1).length, pandsInMulti: res.units.filter(u => u.members.length > 1).reduce((t, u) => t + u.members.length, 0),
    corner: res.units.filter(u => u.flags.includes('corner')).length, withUnfronted: res.units.filter(u => u.unfronted.length).length,
    families: new Set(res.units.filter(u => u.members.length > 1 && u.family.architectNr).map(u => u.familyKey)).size },
  straddles: res.straddles.length, partial: res.partial.length, partialObjects: new Set(res.partial.map(x => x.key)).size,
  ordeStats, yearDiff,
};
fs.writeFileSync(path.join(STAGING, 'stats.json'), JSON.stringify(stats, null, 1));
fs.writeFileSync(path.join(STAGING, 'straddles.json'), JSON.stringify({ straddles: res.straddles, partial: res.partial, afterLayer: res.afterLayer }, null, 1));
fs.writeFileSync(path.join(STAGING, 'pand-buurt.json'), JSON.stringify(Object.fromEntries(buurtOf)));
console.log(JSON.stringify({ ...stats, byBuurt: undefined, byGebied: undefined }, null, 1));
console.log(`wrote ${STAGING}/design-units.json (${(json.length / 1e6).toFixed(1)} MB)`);
if (arg('publish')) {
  fs.mkdirSync(PUBLISH, { recursive: true });
  fs.writeFileSync(path.join(PUBLISH, 'design-units.json.gz'), zlib.gzipSync(json, { level: 9 }));
  console.log(`published ${PUBLISH}/design-units.json.gz`);
}
