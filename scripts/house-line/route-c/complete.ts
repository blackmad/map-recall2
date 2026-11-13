/**
 * Route C, staged only (lane C-completer, 2026-11-13; docs/house-line.md §15): complete a row of described houses into
 * canal-house intents (src/canalRecall/houseSpec/complete.ts), compile them with the recipe compiler, drop or clamp a part
 * that fails a gate and compile the rest, share twins' meshes, and measure triangles, meshopt bytes and minutes per house.
 * Never installs a GLB, never publishes: the scratch house directories (scripts/building-recipes/houses/rc-<pand>) are
 * removed at the end unless --keep (house:preview --recipe reads them), and everything else goes to --out.
 *
 *   node --import tsx scripts/house-line/route-c/complete.ts --row <row.json> --out artifacts/route-c/<label>
 *        [--staged artifacts/describer-d1/staged-ah07] [--answers <dir,dir...>] [--twins <dir>] [--probes <probe.json>]
 *        [--cuts <cuts.json>] [--street <name>] [--keep] [--preview] [--clean]
 *
 * row.json: [{pandId, street, key?}] (the bake-off list-row8.json shape). --answers: the D1 answer directories, first hit
 * wins (crown hint, gaps). --twins: twin re-reads ({sameAs, mirrored}); a twin needs both answers to name each other and
 * PR1's `similar` on the probes. --preview: house:preview --recipe --threeq per house into <out>/preview/<key>.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { completeSpec, cOnlyFields, type Completion, type Drop } from '../../../src/canalRecall/houseSpec/complete.ts';
import type { HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { rdToLngLat } from '../../../src/canalRecall/facade/rdNew.ts';
import { prepareFacts } from '../../building-recipes/facts.ts';
import { compileHouse, shareMeshes, HOUSES } from '../../building-recipes/compile.ts';
import { similar, type Probe } from '../../house-specs/describer-d1/partyPairs.ts';
import { wallOf } from '../../house-specs/describer-d1/stage.ts';
import { sideOf, adjacent } from '../../house-specs/describer-d1/twins.ts';
import { pandScale } from './scale.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const rowFile = opt('row'), OUT = opt('out');
if (!rowFile || !OUT) { console.error('complete.ts --row <row.json> --out <dir> [--staged dir] [--answers dirs] [--twins dir] [--probes json] [--cuts json] [--keep] [--preview]'); process.exit(2); }
const STAGED = opt('staged') ?? 'artifacts/describer-d1/staged-ah07';
const ANSWERS = (opt('answers') ?? [1, 2, 3, 4, 5, 6].map(i => `artifacts/describer-d1/answers-ah07-s${i}`).join(',')).split(',');
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const row: { pandId: string; street: string; key?: string }[] = readJson(rowFile).map((r: any) => ({ ...r, street: r.street ?? opt('street') }));
const probes: Record<string, Probe & { drawn?: any }> = readJson(opt('probes') ?? 'artifacts/describer-d1/ah07-probe.json');
const cuts = new Map<string, any>((readJson(opt('cuts') ?? 'artifacts/describer-d1/cuts-ah07/cuts.json').rows ?? []).map((r: any) => [r.pandId, r]));
const answerOf = (id: string) => { for (const d of ANSWERS) { const f = path.join(d, `${id}.json`); if (fs.existsSync(f)) return readJson(f); } return null; };
const twinRead = (id: string) => { const d = opt('twins'); const f = d && path.join(d, `${id.slice(-6)}.json`); return f && fs.existsSync(f) ? readJson(f) : null; };
const houseId = (pandId: string) => `rc-${pandId}`;
fs.mkdirSync(OUT, { recursive: true });

if (argv.includes('--clean')) { for (const r of row) fs.rmSync(path.join(HOUSES, houseId(r.pandId)), { recursive: true, force: true }); process.exit(0); }

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
async function meshoptBytes(file: string) {
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(file)));
  await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  return (await io.writeBinary(doc)).byteLength;
}

/** Mutual twins: both reads name the other's side, PR1 `similar` holds, the walls touch. */
function twinOf(id: string, specs: Map<string, HouseSpec>): { pandId: string; spec: HouseSpec; mirrored: boolean } | null {
  const me = twinRead(id) ?? answerOf(id), w = wallOf(cuts.get(id));
  if (!me?.sameAs || me.sameAs === 'none' || me.sameAs === 'not-visible' || !w) return null;
  for (const [nid, nspec] of specs) {
    if (nid === id) continue;
    const nw = wallOf(cuts.get(nid)), other = twinRead(nid) ?? answerOf(nid);
    if (!nw || !adjacent(w, nw) || !other?.sameAs) continue;
    const side = sideOf(w, nw), back = sideOf(nw, w);
    const names = (s: string, x: string) => s === x || s === 'both';
    if (names(me.sameAs, side) && names(other.sameAs, back) && probes[id] && probes[nid] && similar(probes[id], probes[nid])) return { pandId: nid, spec: nspec, mirrored: me.mirrored === true };
  }
  return null;
}

/** Parts the compile loop may drop, in order, when a gate fails (the gate's own part first). */
const GATE_PART: Record<string, string> = { 'storey-height': 'storeys', 'eaves-vs-3dbag': 'gable', 'ridge-vs-3dbag': 'gable', 'roof-cleanup': 'gable', 'triangle-budget': 'shopfront' };
const DROP_ORDER = ['shopfront', 'speklagen', 'windowHead', 'souterrain', 'gable', 'storeys'];
function dropPart(intent: any, part: string): Drop | null {
  const f = intent.fronts[0];
  switch (part) {
    case 'shopfront': if (!f.shopfront) return null; { const v = f.shopfront; delete f.shopfront; return { path: 'fronts/0/shopfront', value: v, gate: '', why: '' }; }
    case 'speklagen': if (!f.bands) return null; { const v = f.bands; delete f.bands; delete f.speklagen; return { path: 'fronts/0/bands', value: v, gate: '', why: '' }; }
    case 'windowHead': if (!f.windowHead) return null; { const v = f.windowHead; delete f.windowHead; return { path: 'fronts/0/windowHead', value: v, gate: '', why: '' }; }
    case 'souterrain': if (!f.souterrain) return null; { delete f.souterrain; return { path: 'fronts/0/souterrain', value: true, gate: '', why: '' }; }
    case 'gable': if (f.gable === 'cornice' || f.gable === 'flat') return null; { const v = f.gable; f.gable = 'cornice'; f.cornice ??= 'simple'; return { path: 'fronts/0/gable', value: v, gate: '', why: '', to: 'cornice' }; }
    case 'storeys': if (f.storeys <= 2) return null; { const v = f.storeys; f.storeys = v - 1; return { path: 'fronts/0/storeys', value: v, gate: '', why: '', to: v - 1 }; }
  }
  return null;
}

type Row = { key: string; pandId: string; street: string; ok: boolean; hold: string | null; family?: string; cOnly: string[]; eligible: boolean;
  fills: Completion['fills']; drops: Drop[]; limits: Completion['limits']; gates?: { id: string; pass: boolean; advisory?: boolean }[];
  triangles?: number; bytes?: number; meshoptBytes?: number; ms: Record<string, number>; geometry?: Record<string, unknown>; intent?: unknown };
const rows: Row[] = [];
const specs = new Map<string, HouseSpec>();
for (const r of row) { const f = path.join(STAGED, `${r.pandId}.json`); if (fs.existsSync(f)) specs.set(r.pandId, readJson(f)); }
const compiled: Awaited<ReturnType<typeof compileHouse>>[] = [];
// Family-draw groups (round 3 ruling): consecutive fronts of the row list joined while PR1 `similar` holds; one draw per group.
const groupOf = new Map<string, string>();
for (let i = 0; i < row.length; i++) {
  const prev = row[i - 1], pa = prev && probes[prev.pandId], pb = probes[row[i].pandId];
  groupOf.set(row[i].pandId, prev && pa && pb && similar(pa, pb) ? groupOf.get(prev.pandId)! : row[i].pandId);
}
const t00 = performance.now();
for (const r of row) {
  const key = r.key ?? r.pandId.slice(-6), id = houseId(r.pandId), ms: Record<string, number> = {};
  const spec = specs.get(r.pandId);
  if (!spec) { rows.push({ key, pandId: r.pandId, street: r.street, ok: false, hold: 'no staged spec', cOnly: [], eligible: false, fills: [], drops: [], limits: [], ms }); continue; }
  let t = performance.now();
  // Geometry from the recipe facts (3DBAG LoD2.2 + the street extract): eaves, width and crown over the eaves of the front.
  const dir = path.join(HOUSES, id);
  fs.mkdirSync(dir, { recursive: true });
  let facts;
  try { ({ facts } = await prepareFacts(id, { pand: r.pandId, streets: [r.street], photo: false })); } catch (e) {
    rows.push({ key, pandId: r.pandId, street: r.street, ok: false, hold: `facts: ${(e as Error).message.slice(0, 160)}`, cOnly: cOnlyFields(spec), eligible: false, fills: [], drops: [], limits: [], ms }); continue;
  }
  ms.facts = performance.now() - t; t = performance.now();
  const front = facts.fronts[0], ring = facts.bagFootprintRD[0];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const [lng, lat] = rdToLngLat({ x: cx, y: cy });
  const prof = front.topProfile.map(p => p.heightM), n6 = Math.max(1, Math.floor(prof.length / 6));
  const ends = (prof.slice(0, n6).reduce((a, b) => a + b, 0) + prof.slice(-n6).reduce((a, b) => a + b, 0)) / (2 * n6);
  const geometry = { year: facts.heights.builtYear ?? probes[r.pandId]?.year ?? null, lng, lat, eavesM: front.eavesM, widthM: front.widthM, crownRiseM: +(front.topM - front.eavesM).toFixed(2),
    crownPeaked: prof.length ? Math.max(...prof) - ends >= 1.5 : null };
  const answer = answerOf(r.pandId);
  const twin = twinOf(r.pandId, specs);
  const scale = pandScale(r.pandId, lng, lat);
  const c = completeSpec({ spec, street: r.street, geometry, scale, group: groupOf.get(r.pandId), answer: answer && { crown: answer.crown, bands: answer.bands, low: answer.low, gaps: answer.gaps }, twin, id });
  ms.complete = performance.now() - t; t = performance.now();
  const base: Row = { key, pandId: r.pandId, street: r.street, ok: false, hold: null, family: c.family, cOnly: c.cOnly, eligible: c.cOnly.length >= 2, fills: c.fills, drops: [...c.drops], limits: c.limits, ms, geometry: { ...geometry, scale, group: groupOf.get(r.pandId) }, ...(twin ? { twin: twin.pandId } : {}) };
  if (!c.intent) { rows.push({ ...base, hold: `intent: ${c.error?.split('\n').slice(0, 3).join(' | ')}` }); continue; }
  // Compile; a failing gate (or a throw) drops the part it names, else the next in DROP_ORDER, and the rest compiles.
  const intent: any = structuredClone(c.intent);
  let result: Awaited<ReturnType<typeof compileHouse>> | null = null, hold: string | null = null;
  const tried = new Set<string>();
  for (let round = 0; round < DROP_ORDER.length + 2; round++) {
    fs.writeFileSync(path.join(dir, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
    let failed: string[] = [], why = '';
    try {
      result = await compileHouse(id);
      failed = result.report.gates.filter((g: any) => !g.pass && !g.advisory).map((g: any) => g.id);
      why = result.report.gates.filter((g: any) => !g.pass && !g.advisory).map((g: any) => `${g.id}=${JSON.stringify(g.value)}`).join('; ');
    } catch (e) { failed = ['compile']; why = (e as Error).message.split('\n')[0].slice(0, 200); result = null; }
    if (!failed.length) { hold = null; break; }
    const want = failed.map(g => GATE_PART[g.split('/')[0]]).filter(Boolean);
    let d: Drop | null = null;
    for (const part of [...want, ...DROP_ORDER]) { if (tried.has(part)) continue; tried.add(part); d = dropPart(intent, part); if (d) break; }
    if (!d) { hold = `gates: ${why}`; break; }
    base.drops.push({ ...d, gate: failed.join(','), why });
    hold = `gates: ${why}`;
  }
  ms.compile = performance.now() - t;
  if (!result || hold) { rows.push({ ...base, hold: hold ?? 'compile', intent }); continue; }
  compiled.push(result);
  const glb = path.join('artifacts/building-recipes', id, 'model.glb');
  t = performance.now();
  const mo = await meshoptBytes(glb);
  ms.meshopt = performance.now() - t;
  const outDir = path.join(OUT, key);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
  fs.copyFileSync(path.join('artifacts/building-recipes', id, 'report.json'), path.join(outDir, 'report.json'));
  fs.copyFileSync(glb, path.join(outDir, 'model.glb'));
  rows.push({ ...base, ok: true, gates: result.report.gates.map((g: any) => ({ id: g.id, pass: g.pass, ...(g.advisory ? { advisory: true } : {}) })), triangles: result.report.triangles, bytes: result.report.bytes, meshoptBytes: mo, intent });
  console.log(`${key}: ${result.report.triangles} tris, ${(mo / 1024).toFixed(1)} kB meshopt, fills ${c.fills.filter(f => f.source !== 'stated').length}, drops ${base.drops.length}${twin ? `, twin ${twin.pandId.slice(-6)}` : ''}`);
}
const machineMs = performance.now() - t00;
// Twins share one compiled model, mirrored (compile.ts shareMeshes: equal design or its mirror, dimensions within 0.3 m).
const shared = compiled.length > 1 ? await shareMeshes(compiled) : null;
// Node renders of C (house:preview --recipe --threeq), timed separately.
let previewMs = 0;
if (argv.includes('--preview')) for (const r of rows.filter(x => x.ok)) {
  const t = performance.now();
  try {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/house-preview/preview.ts', r.pandId, '--recipe', houseId(r.pandId), '--threeq', '--out', path.join(OUT, 'preview', r.key)], { stdio: 'pipe', env: { ...process.env } });
  } catch (e) { console.error(`${r.key}: preview failed ${(e as Error).message.slice(0, 200)}`); }
  r.ms.preview = performance.now() - t; previewMs += r.ms.preview;
}
if (!argv.includes('--keep')) for (const r of row) fs.rmSync(path.join(HOUSES, houseId(r.pandId)), { recursive: true, force: true });

const ok = rows.filter(r => r.ok);
const sum = (f: (r: Row) => number) => ok.reduce((s, r) => s + f(r), 0);
const summary = {
  v: 1, row: rowFile, houses: rows.length, compiled: ok.length, noHoldShare: +(ok.length / Math.max(1, rows.length)).toFixed(3),
  eligible: rows.filter(r => r.eligible).length,
  minutesPerHouse: { machine: +(machineMs / 60000 / Math.max(1, rows.length)).toFixed(2), withPreview: +((machineMs + previewMs) / 60000 / Math.max(1, rows.length)).toFixed(2) },
  triangles: { mean: Math.round(sum(r => r.triangles!) / Math.max(1, ok.length)), max: Math.max(0, ...ok.map(r => r.triangles!)) },
  meshoptKB: { mean: +(sum(r => r.meshoptBytes!) / 1024 / Math.max(1, ok.length)).toFixed(1), total: +(sum(r => r.meshoptBytes!) / 1024).toFixed(1) },
  fillsBySource: ok.flatMap(r => r.fills).reduce((m: Record<string, number>, f) => (m[f.source] = (m[f.source] ?? 0) + 1, m), {}),
  drops: rows.flatMap(r => r.drops.map(d => ({ key: r.key, ...d }))),
  holds: rows.filter(r => !r.ok).map(r => ({ key: r.key, hold: r.hold })),
  shared: shared && { uniqueMeshes: shared.uniqueMeshes, groups: shared.sharedGroups, rejected: shared.rejected.length },
};
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify({ ...summary, drops: summary.drops.length }, null, 1));
