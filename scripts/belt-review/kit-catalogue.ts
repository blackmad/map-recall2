/**
 * belt-review:kit-catalogue (R5 data, lane C, 2026-11-20): for every kit enum value, the canal-belt houses that use it,
 * so the catalogue page (drawn later on lane A's render service) can show each option on real belt houses. Data only.
 *
 *   node --import tsx scripts/belt-review/kit-catalogue.ts [--check] [--examples 3]
 *
 * Houses come from the published HouseSpecs of pands in the belt buurten (Grachtengordel AC01-AC04, AG01-AG06; BAG
 * footprint centroid in coverage-v1 buurten) and from every review-data/belt-review/<face>/description.json. Examples
 * prefer the strongest source (reviewed, then face intent, then own read). Values a house states that the kit enum lacks
 * are listed under `outsideKit` (the spec-level reads, a read's own words): candidates for the gap list.
 * Writes review-data/belt-review/kit-catalogue.json, sorted, no timestamps (a rerun on the same inputs is byte-stable).
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BALCONY_STYLES, BASEMENTS, CORNICES, DORMER_STYLES, GABLES, ROOF_MATERIALS, WALL_MATERIALS, WINDOW_HEADS, WINDOW_SURROUNDS, WINDOWS } from '../../src/canalRecall/buildingRecipe/intent.ts';
import { STOOP_FLIGHTS } from '../../src/canalRecall/buildingRecipe/stoop.ts';
import { buurtLocator, bboxOf, polygonsOf, type Buurt } from '../../src/canalRecall/coverage/coverage.ts';
import { descSourceOfSpec, DESC_SOURCES, type DescSource } from '../../src/canalRecall/beltReview/description.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const EXTRACT = path.join(REPO, 'public/data/extracts/amsterdam');
const OUT = path.join(REPO, 'review-data/belt-review/kit-catalogue.json');
const BELT_BUURTEN = new Set(['AC01', 'AC02', 'AC03', 'AC04', 'AG01', 'AG02', 'AG03', 'AG04', 'AG05', 'AG06']);
const i = process.argv.indexOf('--examples'), EXAMPLES = i >= 0 ? Number(process.argv[i + 1]) : 3;
const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** The kit enums the catalogue covers: name -> the values, and where a spec and a description state it. */
const ENUMS: Record<string, { values: readonly string[]; path: string; spec: (d: any) => unknown; desc?: string }> = {
  gable: { path: 'fronts/0/gable', values: GABLES, spec: d => d.fronts?.[0]?.gable, desc: 'crown' },
  cornice: { path: 'fronts/0/cornice', values: CORNICES, spec: d => d.fronts?.[0]?.cornice, desc: 'cornice' },
  windowHead: { path: 'fronts/0/windowHead', values: WINDOW_HEADS, spec: d => d.fronts?.[0]?.windowHead?.kind, desc: 'heads' },
  windowSurround: { path: 'fronts/0/windowSurround', values: WINDOW_SURROUNDS, spec: d => d.fronts?.[0]?.windowSurround, desc: 'windowSurround' },
  windows: { path: 'fronts/0/windows', values: WINDOWS, spec: d => d.fronts?.[0]?.windows, desc: 'windows' },
  dormerStyle: { path: 'fronts/0/dormerStyle', values: DORMER_STYLES, spec: d => d.fronts?.[0]?.dormerStyle },
  balconyStyle: { path: 'fronts/0/balconies', values: BALCONY_STYLES, spec: d => (Array.isArray(d.fronts?.[0]?.balconies) ? d.fronts[0].balconies.map((b: any) => b?.style).filter(Boolean) : undefined) },
  basement: { path: 'fronts/0/basement', values: BASEMENTS, spec: d => d.fronts?.[0]?.basement, desc: 'stoop' },
  stoopFlight: { path: 'fronts/0/stoop', values: STOOP_FLIGHTS, spec: d => d.fronts?.[0]?.stoop?.flight },
  roofMaterial: { path: 'roof/material', values: ROOF_MATERIALS, spec: d => d.roof?.material },
  wallMaterial: { path: 'palette/wallMaterial', values: WALL_MATERIALS, spec: d => d.palette?.wallMaterial, desc: 'wallFinish' },
};

// Belt pands: BAG footprint centroid in a belt buurt.
const cov = json(path.join(EXTRACT, 'coverage-v1/buurten.json')) as { features: Array<{ properties: { code: string; name: string }; geometry: any }> };
const buurten: Buurt[] = cov.features.map(f => { const polygons = polygonsOf(f.geometry); return { code: f.properties.code, name: f.properties.name, polygons, bbox: bboxOf(polygons) }; });
const locate = buurtLocator(buurten);
const belt = new Set<string>();
const BAG = path.join(EXTRACT, 'bag-tiles/14');
for (const x of fs.readdirSync(BAG).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(BAG, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const ft of JSON.parse(gunzipSync(fs.readFileSync(path.join(BAG, x, f))).toString('utf8')).features ?? []) {
    if (!ft.geometry) continue;
    const ring: number[][] = ft.geometry.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry.coordinates[0][0];
    const n = ring.length - 1 || 1, c: [number, number] = [ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n, ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n];
    const code = locate(c);
    if (code && BELT_BUURTEN.has(code)) belt.add(String(ft.properties.id).slice(-16));
  }
}

type Use = { pandId: string; source: DescSource; from: string };
const uses = new Map<string, Map<string, Map<string, Use>>>(); // enum -> value -> pand -> use
const RANK = new Map(DESC_SOURCES.map((s, k) => [s, k]));
function add(name: string, value: unknown, use: Use) {
  for (const v of Array.isArray(value) ? value : [value]) {
    if (typeof v !== 'string' || !v) continue;
    const byValue = uses.get(name) ?? uses.set(name, new Map()).get(name)!;
    const byPand = byValue.get(v) ?? byValue.set(v, new Map()).get(v)!;
    const cur = byPand.get(use.pandId);
    if (!cur || RANK.get(use.source)! < RANK.get(cur.source)!) byPand.set(use.pandId, use);
  }
}

// Published specs of belt pands.
const SPEC_TILES = path.join(EXTRACT, 'house-specs/14');
let specPands = 0;
for (const x of fs.readdirSync(SPEC_TILES)) for (const y of fs.readdirSync(path.join(SPEC_TILES, x))) {
  for (const [k, r] of Object.entries<any>(JSON.parse(gunzipSync(fs.readFileSync(path.join(SPEC_TILES, x, y))).toString('utf8')).buildings ?? {})) {
    const id = k.slice(-16);
    if (!belt.has(id)) continue;
    specPands++;
    for (const [name, e] of Object.entries(ENUMS)) {
      const v = e.spec(r.d ?? {});
      if (v === undefined) continue;
      add(name, v, { pandId: id, source: descSourceOfSpec(r.s?.[e.path]), from: 'published spec' });
    }
  }
}

// Belt review descriptions.
const REVIEW = path.join(REPO, 'review-data/belt-review');
let descPands = 0;
for (const face of fs.existsSync(REVIEW) ? fs.readdirSync(REVIEW).sort() : []) {
  const f = path.join(REVIEW, face, 'description.json');
  if (!fs.existsSync(f)) continue;
  for (const p of json(f).pands ?? []) {
    descPands++;
    for (const [name, e] of Object.entries(ENUMS)) {
      const fv = e.desc ? p.fields?.[e.desc] : undefined;
      if (fv && fv.source !== 'donor' && fv.source !== 'period-default') add(name, fv.value, { pandId: p.pandId, source: fv.source, from: `description ${face}` });
    }
  }
}

const enums: Record<string, unknown> = {};
for (const [name, e] of Object.entries(ENUMS)) {
  const byValue = uses.get(name) ?? new Map();
  const entry = (v: string) => {
    const list = [...(byValue.get(v)?.values() ?? [])].sort((a, b) => RANK.get(a.source)! - RANK.get(b.source)! || (a.pandId < b.pandId ? -1 : 1));
    return { houses: list.length, examples: list.slice(0, EXAMPLES) };
  };
  enums[name] = {
    values: Object.fromEntries(e.values.map(v => [v, entry(v)])),
    unused: e.values.filter(v => !byValue.get(v)?.size),
    outsideKit: Object.fromEntries([...byValue.keys()].filter(v => !e.values.includes(v)).sort().map(v => [v, entry(v)])),
  };
}
const file = { version: 1, about: 'Belt review R5 data: per kit enum value, the canal-belt houses that use it (published specs of belt-buurt pands, belt review descriptions; examples strongest source first). Rendering waits for the R2 render service. Built by scripts/belt-review/kit-catalogue.ts.', inputs: { beltPands: belt.size, specPands, descPands }, enums };
console.log(JSON.stringify({ ...file.inputs, perEnum: Object.fromEntries(Object.entries(enums).map(([k, v]: [string, any]) => [k, `${Object.values(v.values).filter((x: any) => x.houses).length}/${Object.keys(v.values).length} used, ${Object.keys(v.outsideKit).length} outside`])) }, null, 1));
if (!process.argv.includes('--check')) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n'); console.log(`wrote ${path.relative(REPO, OUT)}`); }
