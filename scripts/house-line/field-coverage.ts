/**
 * F1 field coverage (#380, plan P2 of the 2026-11-13 house review): for every HouseSpec field, does the record shader draw
 * it, and does a spec change change pixels?
 *
 *   npx tsx scripts/house-line/field-coverage.ts [--out <file.json>] [--md <file.md>] [--inject 8]
 *
 * Rows: every key of FrontIntent (as fronts/0/<key>), RoofIntent (roof/), PaletteIntent (palette/) and SpecFacts (facts/),
 * parsed from the types, plus any other key the house-specs extract carries.
 *
 * For each benchmark-v2 pand that has the field, the field is changed to another value seen in the extract (else a
 * mutation). The pand then goes through the whole default path with the changed spec: view, decoration (decorate.ts:
 * wall colour, bays, crown), the mesher in record mode and the packer. Its front is rastered by the CPU twin
 * (facadeTwin.ts facadePixel, the shader's parity copy) at 10 px/m.
 *   - `record`: the record bytes changed. The field reaches the record shader.
 *   - `pixels`: the twin raster changed. A spec change changes pixels.
 * A field no benchmark pand has is injected into `--inject` benchmark pands (most common extract value, source
 * streetlevel-measured), marked `injected`.
 * Limit: the twin covers the record shader's wall only. Geometry the mesher builds from a field (roof, crown, extras) is
 * not counted here.
 */
import '../world/useBrowserMath.js';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { gameChain, loadTile, type Feature } from '../world/pipeline.ts';
import { specView } from '../../src/canalRecall/houseSpec/view.ts';
import type { HouseSpec } from '../../src/canalRecall/houseSpec/spec.ts';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { facadeRecordFor, packFacadeRecordFor, type FacadeRecordInput, type FacadeSpecInput } from '../../src/canalRecall/look/facadeRecord.ts';
import { facadePixel } from '../../src/canalRecall/look/facadeTwin.ts';
import { loadHouseSpecTable } from '../world/shellBake.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), EX = path.join(ROOT, 'public/data/extracts/amsterdam');
const args = process.argv.slice(2), value = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const INJECT = Number(value('inject') ?? 8);

/** Top-level keys of an exported interface, from its source text (2-space-indented members). */
export function interfaceKeys(src: string, name: string): string[] {
  const at = src.indexOf(`export interface ${name} {`);
  if (at < 0) throw Error(`interface ${name} not found`);
  const body = src.slice(at, src.indexOf('\n}\n', at));
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map(m => m[1]);
}
const intent = fs.readFileSync(path.join(ROOT, 'src/canalRecall/buildingRecipe/intent.ts'), 'utf8');
const specTs = fs.readFileSync(path.join(ROOT, 'src/canalRecall/houseSpec/spec.ts'), 'utf8');
const rows = new Set<string>([
  ...interfaceKeys(intent, 'FrontIntent').map(k => `fronts/0/${k}`), ...interfaceKeys(intent, 'RoofIntent').map(k => `roof/${k}`),
  ...interfaceKeys(intent, 'PaletteIntent').map(k => `palette/${k}`), ...interfaceKeys(specTs, 'SpecFacts').map(k => `facts/${k}`),
]);

// Observed values per field across the whole extract (perturbation pool).
const table = loadHouseSpecTable(EX, 'house-specs'), seen = new Map<string, Map<string, unknown>>();
const fieldsOf = (s: FacadeSpecInput): Array<[string, unknown]> => {
  const out: Array<[string, unknown]> = [], d = (s.d ?? {}) as Record<string, any>;
  (d.fronts ?? []).forEach((f: Record<string, unknown>, i: number) => { if (i === 0) for (const [k, v] of Object.entries(f ?? {})) out.push([`fronts/0/${k}`, v]); });
  for (const sec of ['roof', 'palette']) for (const [k, v] of Object.entries(d[sec] ?? {})) out.push([`${sec}/${k}`, v]);
  for (const [k, v] of Object.entries(s.x ?? {})) out.push([`facts/${k}`, v]);
  return out;
};
for (const s of table.values()) for (const [p, v] of fieldsOf(s)) { rows.add(p); const m = seen.get(p) ?? new Map(); m.set(JSON.stringify(v), v); seen.set(p, m); }

const setField = (s: FacadeSpecInput, p: string, v: unknown): FacadeSpecInput => {
  const out = JSON.parse(JSON.stringify(s ?? {})) as { d: Record<string, any>; x?: Record<string, any>; s?: Record<string, string> };
  out.d ??= {}; out.s ??= {};
  const [head, a, b] = p.split('/');
  if (head === 'fronts') { out.d.fronts ??= [{}]; out.d.fronts[0] ??= {}; out.d.fronts[0][b] = v; }
  else if (head === 'facts') { out.x ??= {}; out.x[a] = v; }
  else { out.d[head] ??= {}; out.d[head][a] = v; }
  out.s[p] ??= 'streetlevel-measured';
  return out as FacadeSpecInput;
};
const mutate = (v: unknown): unknown => typeof v === 'number' ? v * 1.5 + 1 : typeof v === 'boolean' ? !v : typeof v === 'string' ? (v === 'none' ? 'plain' : 'none') : Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : 1;
const alternative = (p: string, v: unknown): unknown => {
  const pool = [...(seen.get(p)?.values() ?? [])].filter(x => JSON.stringify(x) !== JSON.stringify(v));
  return pool.length ? pool[0] : mutate(v);
};
const commonest = (p: string): unknown => { const m = seen.get(p); return m && m.size ? [...m.values()][0] : undefined; };

// Benchmark-v2 pands through the whole default path (scripts/world/pipeline.ts loadTile + gameChain, as the world compiler
// runs it): a trial re-derives the pand's HouseSpecView from the changed spec (view.ts specView, what the tile enricher
// stamps as `p.houseSpec`), re-decorates, re-meshes in record mode with the changed spec, and rasters the record.
const benchList: Array<{ pandId: string; at: [number, number] }> = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/house-line/benchmark/benchmark-v2.json'), 'utf8')).pands;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)}`; };
const chain = gameChain();
const raws = new Map<string, Feature>(), byTile = new Map<string, string[]>();
for (const p of benchList) { const t = tileOf(p.at[0], p.at[1]); byTile.set(t, [...(byTile.get(t) ?? []), `NL.IMBAG.Pand.${p.pandId}`]); }
for (const [tile, want] of byTile) for (const row of await loadTile(tile, chain)) if (want.includes(String(row.raw.properties.id))) raws.set(String(row.raw.properties.id), row.raw);
const asSpec = (id: string, s: FacadeSpecInput): HouseSpec => ({ schemaVersion: 1, pandId: id.slice(-16), design: (s.d ?? {}) as HouseSpec['design'], facts: (s.x ?? {}) as HouseSpec['facts'],
  provenance: Object.fromEntries(Object.entries(s.s ?? {}).map(([k, src]) => [k, { source: src as never, confidence: 1, ref: '', at: null }])) });
/** The record input for a pand under a spec, through view, decoration and the mesher (absent spec: the generic pand). */
const inputFor = (id: string, s: FacadeSpecInput | undefined): FacadeRecordInput | undefined => {
  const raw = raws.get(id)!, props = { ...raw.properties } as Record<string, unknown>;
  if (s && Object.keys(s.d ?? {}).length + Object.keys(s.x ?? {}).length) props.houseSpec = specView(asSpec(id, s)); else delete props.houseSpec;
  const styled = chain.decorate({ ...raw, properties: props } as Feature);
  const c = buildFeatureChunk([styled] as never, 'photo', 'walls', undefined, [], [], [], new Map(), { facadeRecord: true, ...(s ? { specFor: () => s } : {}) }) as { record?: { inputs: FacadeRecordInput[] } };
  return c.record?.inputs?.[0];
};
const ids = [...raws.keys()].filter(id => inputFor(id, table.get(id))).sort();
const raster = (input: FacadeRecordInput): Float64Array => {
  const r = facadeRecordFor(input), len = Math.max(3, Math.min(20, input.frontLengthM ?? 8)), h = r.wallHcm / 100, step = 0.1, out: number[] = [];
  for (let v = step / 2; v < h; v += step) for (let u = step / 2; u < len; u += step) { const px = facadePixel(r, [u, v, len], 0, [step, step]).rgb; out.push(px[0], px[1], px[2]); }
  return Float64Array.from(out);
};
const differs = (a: Float64Array, b: Float64Array) => a.length !== b.length || a.some((x, i) => Math.abs(x - b[i]) > 1e-3);
const bytesOf = (i: FacadeRecordInput) => Buffer.from(packFacadeRecordFor(i));

type Row = { field: string; benchmarkPands: number; injected: boolean; tried: number; recordChanged: number; pixelsChanged: number; observedValues: number };
const out: Row[] = [];
for (const field of [...rows].sort()) {
  const has = ids.filter(id => { const s = table.get(id); return s && fieldsOf(s).some(([p]) => p === field); });
  const injected = has.length === 0, trial = injected ? ids.slice(0, INJECT) : has;
  let rec = 0, pix = 0, tried = 0;
  for (const id of trial) {
    const spec = table.get(id) ?? { d: {} };
    const now = fieldsOf(spec).find(([p]) => p === field)?.[1];
    const next = injected ? commonest(field) : alternative(field, now);
    if (next === undefined) continue;
    tried++;
    const a = inputFor(id, spec), b = inputFor(id, setField(spec, field, next));
    if (!a || !b || Buffer.compare(bytesOf(a), bytesOf(b)) === 0) continue;
    rec++;
    if (differs(raster(a), raster(b))) pix++;
  }
  out.push({ field, benchmarkPands: has.length, injected, tried, recordChanged: rec, pixelsChanged: pix, observedValues: seen.get(field)?.size ?? 0 });
}
const yes = (n: number, t: number) => (t === 0 ? 'n/a' : n === 0 ? 'no' : n === t ? 'yes' : `partly ${n}/${t}`);
const md = ['| field | drawn by the record shader | a spec change changes pixels | benchmark pands with it | values in extract |', '|---|---|---|---|---|',
  ...out.map(r => `| ${r.field} | ${yes(r.recordChanged, r.tried)} | ${yes(r.pixelsChanged, r.tried)} | ${r.injected ? `0 (injected into ${r.tried})` : r.benchmarkPands} | ${r.observedValues} |`)].join('\n');
const summary = { fields: out.length, drawn: out.filter(r => r.recordChanged > 0).length, pixels: out.filter(r => r.pixelsChanged > 0).length, benchmarkInputs: ids.length };
if (value('out')) fs.writeFileSync(value('out')!, JSON.stringify({ summary, rows: out }, null, 1));
if (value('md')) fs.writeFileSync(value('md')!, md + '\n');
console.log(JSON.stringify(summary));
