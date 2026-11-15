/**
 * Buurt generator, staging run (docs/handoffs/buurt-generators-20261115.md): a district's undescribed street-side rows
 * as house-rows records, from local data only. Stages; never publishes.
 *
 *   node --import tsx scripts/buurt-generators/generate.ts --district=rivierenbuurt [--out=artifacts/buurt-generators/<district>] [--specs] [--check] [--stage-data]
 *
 * Reads the district library (src/canalRecall/buurtGenerator/districts/<district>.json), the buurt polygons
 * (coverage-v1/buurten.json), BAG pands with year and 3DBAG eaves/ridge (bag-tiles/14), named OSM ways
 * (streets-routing.json) and what already describes a pand (published HouseSpecs, published row fronts, models and
 * building-type instances in models/covers.json). Writes:
 *   row-front.json   `{records}`: the renderer's front records (ROW_FRONT=1 ROW_FRONT_RECORDS=<file>)
 *   fronts.json      `{fronts}`: each drawn front's line in lng/lat (the sheet's photo plane)
 *   rows.json        `{rows}`: lane D RowRecords (check:rows reads `<row>.row-check.json`, written with --check)
 *   report.json/.md  pands, rows, series and pands per family, skipped by reason
 *   specs/<pand>.json  (--specs) one HouseSpec per drawn pand (houseSpec/row/emit.ts rowSpec)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeRoofFactTile } from '../../src/canalRecall/roofs/roofSlots.ts';
import { generateDistrict, type DistrictLibrary } from '../../src/canalRecall/buurtGenerator/generate.ts';
import type { GenPand, GenStreet, LngLat } from '../../src/canalRecall/buurtGenerator/rows.ts';
import { rowSpec } from '../../src/canalRecall/houseSpec/row/emit.ts';
import { toRowCheck } from '../../src/canalRecall/houseSpec/row/check.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const STREET_CLASSES = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'pedestrian', 'busway', 'trunk']);

/** The district library, with its round-9 measurements (`districts/measured/<district>.json`) unless BUURT_MEASURED=0. */
export function loadLibrary(district: string): DistrictLibrary {
  const lib: DistrictLibrary = JSON.parse(fs.readFileSync(`src/canalRecall/buurtGenerator/districts/${district}.json`, 'utf8'));
  const m = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`;
  if (process.env.BUURT_MEASURED !== '0' && fs.existsSync(m)) { const { walls, roofs, rowRoofs } = JSON.parse(fs.readFileSync(m, 'utf8')); lib.measured = { walls, roofs, rowRoofs }; }
  return lib;
}

type Ring = LngLat[];
function inside(rings: Ring[], x: number, y: number): boolean {
  let hit = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** BAG pands (with a year) whose ring centroid lies in one of the district's buurten. */
export function districtPands(lib: DistrictLibrary): GenPand[] {
  const fc = JSON.parse(fs.readFileSync(`${EXTRACT}/coverage-v1/buurten.json`, 'utf8'));
  const polys = fc.features.filter((f: any) => lib.buurten.includes(f.properties.code)).map((f: any) => {
    const g = f.geometry, rings: Ring[] = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat();
    const xs = rings.flat().map(c => c[0]), ys = rings.flat().map(c => c[1]);
    return { rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
  const box = [Math.min(...polys.map((p: any) => p.box[0])), Math.min(...polys.map((p: any) => p.box[1])), Math.max(...polys.map((p: any) => p.box[2])), Math.max(...polys.map((p: any) => p.box[3]))];
  const tx = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** 14), ty = (lat: number) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** 14); };
  const out = new Map<string, GenPand>();
  for (let x = tx(box[0]); x <= tx(box[2]); x++) for (let y = ty(box[3]); y <= ty(box[1]); y++) {
    const file = `${EXTRACT}/bag-tiles/14/${x}/${y}.geojson.gz`;
    if (!fs.existsSync(file)) continue;
    // The orthophoto roof reading per pand (roof-facts sidecar): the series' roof material and its eaves type follow it.
    const factsFile = `${EXTRACT}/roof-facts/14/${x}/${y}.json.gz`;
    const facts = fs.existsSync(factsFile) ? decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(factsFile)).toString('utf8'))) : new Map();
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')).features) {
      const p = f.properties, id = String(p.id ?? '');
      if (!/Pand\.\d{16}$|^\d{16}$/.test(id) || out.has(id)) continue;
      const ring: Ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      const cx = ring.reduce((t, c) => t + c[0], 0) / ring.length, cy = ring.reduce((t, c) => t + c[1], 0) / ring.length;
      if (!polys.some((q: any) => cx >= q.box[0] && cx <= q.box[2] && cy >= q.box[1] && cy <= q.box[3] && inside(q.rings, cx, cy))) continue;
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
      const fact = facts.get(id.replace(/^NL\.IMBAG\.Pand\./, '')) ?? facts.get(id);
      out.set(id, { id, ring: ring.map(c => [c[0], c[1]] as const), year: num(p.year), eavesM: num(p.eaves), ridgeM: num(p.ridge), heightM: num(p.height), roofSlot: fact?.slot ?? null, roofCode: num(p.roof) });
    }
  }
  return [...out.values()].sort((a, b) => a.id < b.id ? -1 : 1);
}

export function namedStreets(): GenStreet[] {
  const ways = JSON.parse(fs.readFileSync(`${EXTRACT}/streets-routing.json`, 'utf8')) as Array<{ name?: string; highway?: string; path?: number[][]; paths?: number[][][] }>;
  return ways.filter(w => w.name && STREET_CLASSES.has(w.highway ?? '')).flatMap(w => (w.paths ?? [w.path!]).filter(Boolean).map(p => ({ name: w.name!, path: p.map(q => [q[1], q[0]] as const) })));
}

/** Pands something already describes: a published HouseSpec, a published row front, a model or a building-type instance. */
export function describedPands(): Set<string> {
  const ids = new Set<string>();
  const norm = (s: string) => s.replace(/^NL\.IMBAG\.Pand\./, '');
  const specDir = `${EXTRACT}/house-specs/14`;
  for (const x of fs.readdirSync(specDir)) for (const f of fs.readdirSync(path.join(specDir, x))) {
    const buf = fs.readFileSync(path.join(specDir, x, f));
    const json = JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8'));
    for (const id of Object.keys(json.buildings ?? {})) ids.add(norm(id));
  }
  const rf = JSON.parse(fs.readFileSync('public/data/front-records/row-front.json', 'utf8'));
  // The generator's own published records (`buurtKit`) do not describe a pand: a re-run regenerates them.
  for (const r of rf.records ?? []) if (!r.buurtKit) ids.add(norm(String(r.pandId)));
  const covers = JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8'));
  for (const m of Object.values(covers.models ?? {}) as Array<{ p?: string[] }>) for (const id of m.p ?? []) ids.add(norm(id));
  for (const id of covers.buildingTypes ?? []) ids.add(norm(id));
  return ids;
}

async function main() {
  const district = arg('district') ?? 'rivierenbuurt';
  const out = arg('out') ?? `artifacts/buurt-generators/${district}`;
  const at = new Date().toISOString().slice(0, 10);
  const lib = loadLibrary(district);
  const pands = districtPands(lib), streets = namedStreets(), described = describedPands();
  const t0 = Date.now();
  const res = generateDistrict(lib, pands, streets, described, at);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'row-front.json'), JSON.stringify({ version: 1, district, generatedAt: at, records: res.records }));
  // --stage-data: the reviewed copy the integrator publishes from (scripts/buurt-generators/publish.ts).
  if (process.argv.includes('--stage-data')) { fs.mkdirSync(`data/buurt-generators/${district}`, { recursive: true }); fs.copyFileSync(path.join(out, 'row-front.json'), `data/buurt-generators/${district}/row-front.json`); }
  fs.writeFileSync(path.join(out, 'rows.json'), JSON.stringify({ district, rows: res.rows }));
  fs.writeFileSync(path.join(out, 'fronts.json'), JSON.stringify({ district, fronts: res.fronts }));
  if (process.argv.includes('--check')) {
    fs.mkdirSync(path.join(out, 'check'), { recursive: true });
    for (const r of res.rows) fs.writeFileSync(path.join(out, 'check', `${r.id}.row-check.json`), JSON.stringify(toRowCheck(r, {}, new Set())));
  }
  if (process.argv.includes('--specs')) {
    fs.mkdirSync(path.join(out, 'specs'), { recursive: true });
    for (const r of res.rows) for (const m of r.members) fs.writeFileSync(path.join(out, 'specs', `${m.pandId}.json`), JSON.stringify(rowSpec(r, m.pandId, undefined, at), null, 1));
  }
  const bySkip: Record<string, number> = {};
  for (const s of res.skipped) bySkip[s.reason] = (bySkip[s.reason] ?? 0) + 1;
  const drawn = res.rows.reduce((t, r) => t + r.members.length, 0);
  const report = { district, at, pands: pands.length, drawn, rows: res.rows.length, series: res.rows.reduce((t, r) => t + r.series.length, 0), families: res.families, skipped: bySkip, ms: Date.now() - t0,
    skippedList: res.skipped };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const md = [`# Buurt generator: ${lib.title} (${at})`, '', `Pands in the district: ${pands.length}. Drawn by the generator: ${drawn} in ${report.rows} rows, ${report.series} series.`, '',
    '| family | series | pands |', '|---|---:|---:|', ...Object.entries(res.families).map(([k, v]) => `| ${k} | ${v.series} | ${v.pands} |`), '',
    '| not drawn, reason | pands |', '|---|---:|', ...Object.entries(bySkip).map(([k, v]) => `| ${k} | ${v} |`), ''].join('\n');
  fs.writeFileSync(path.join(out, 'report.md'), md);
  console.log(md);
  console.log(`staged ${out}/row-front.json (${res.records.length} records), rows.json (${res.rows.length} rows)`);
}
if (process.argv[1]?.endsWith('buurt-generators/generate.ts')) await main();
