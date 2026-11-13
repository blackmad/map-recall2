/**
 * Openings-on-walls gate over every catalogue GLB (lane R2-C, 2026-11-13; feedback 2ba72090 De Hallen, 88ea3991 and
 * 417e542f Haparandaweg: "do we have a rule/check for floating windows?").
 *
 *   node --import tsx scripts/landmarks/check-glb-openings.ts                 # all catalogue GLBs, exit 1 on a regression
 *   node --import tsx scripts/landmarks/check-glb-openings.ts --id=de-hallen  # one or more ids (comma list); prints offenders
 *   node --import tsx scripts/landmarks/check-glb-openings.ts --report        # per-model table, builders and worst offenders
 *   node --import tsx scripts/landmarks/check-glb-openings.ts --write         # LOWER the allow-list to today's counts (never raises)
 *   flags: --no-cache  --out=<report.json>  --top=25  --shard=<k>/<n> (CI matrix: every n-th model)  --verbose
 *
 * It reuses the landmark geometry audit (src/canalRecall/landmarks/geometryAudit.ts: auditOpenings, openingsWithinWalls) and
 * differs from audit:glb in what it gates. audit:glb counted a floating assembly as a failure only when a host wall plane was in
 * reach and kept the rest as warnings recorded in a baseline, so a model whose panes stood 0.6 m off the brick (De Hallen) passed.
 * Here every opening assembly is measured against the nearest wall or trim, independent of host detection:
 *
 *   float    assemblies whose gap to every other surface exceeds FLOAT_M (10 cm: the layered window sheets stand 4.5/9/13.5 cm
 *            proud on purpose, so up to 10 cm is mounted, more is a pane that came off its wall)
 *   proud    wall-hosted assemblies standing more than PROUD_M (30 cm) in front of the host wall without touching trim that
 *            reaches it (reported as float with the host's gap; counted once)
 *   poke     assemblies sunk behind the wall surface (`buried`, over half hidden) or hanging past the wall edge (`overhang-fail`)
 *   outside  opening parts past their wall's silhouette or through a roof plane (`openingsWithinWalls.failing`)
 *
 * Allow-list: scripts/landmarks/opening-wall-allowlist.json, per model, per gated count. It may only shrink: a count above its
 * entry fails (new exports have no entry, so they must be 0), and a count BELOW its entry fails as stale until `--write`
 * lowers the entry (the file can only move down; `--write` refuses to raise). Fix the builder, then run --write.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {auditOpenings, GEOMETRY_THRESHOLDS, openingsWithinWalls, partsOf, type OpeningIssue} from '../../src/canalRecall/landmarks/geometryAudit';
import {LAYERED_SHEET_IDS, listTargets} from '../audit-glb-quality';
import type {MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';
import {loadMaterialSoup} from './material-soup';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ALLOW = path.join(ROOT, 'scripts/landmarks/opening-wall-allowlist.json');
const CACHE_DIR = path.join(ROOT, '.cache/glb-openings');
const CHECK_VERSION = 3; // bump when the measurement changes (invalidates the cache)

export const GATED = ['float', 'poke', 'outside'] as const;
export type Counts = Record<(typeof GATED)[number], number>;
export const FLOAT_M = GEOMETRY_THRESHOLDS.floatFail;

export interface Offender {kind: 'float' | 'poke' | 'outside'; gapM: number; at: [number, number, number]; materials: string[]; note: string}
export interface ModelResult {id: string; counts: Counts; worstGapM: number; assemblies: number; offenders: Offender[]}

export async function measureModel(id: string, file: string): Promise<ModelResult> {
  return measureSoup(id, await loadMaterialSoup(file));
}

export function measureSoup(id: string, soup: MaterialSoup): ModelResult {
  const th = {...GEOMETRY_THRESHOLDS, ...(LAYERED_SHEET_IDS.has(id) ? {floatTol: 0.10, joinTol: 0.10} : {})};
  const part = partsOf(soup, th.weld);
  const op = auditOpenings(soup, th, part);
  const within = openingsWithinWalls(soup, th);
  const at = (i: {centre: number[]}) => i.centre.map(v => +v.toFixed(2)) as [number, number, number];
  const offenders: Offender[] = [];
  const float = op.issues.filter((i: OpeningIssue) => i.kind === 'floating' && i.gap > FLOAT_M);
  for (const i of float) offenders.push({kind: 'float', gapM: +i.gap.toFixed(2), at: at(i), materials: i.materials, note: i.wallBearing === undefined ? 'no host wall plane in reach' : `host wall bearing ${Math.round(i.wallBearing)}`});
  const poke = op.issues.filter(i => i.kind === 'buried' || (i.kind === 'overhang' && i.severity === 'fail'));
  for (const i of poke) offenders.push({kind: 'poke', gapM: +(i.kind === 'buried' ? (i.clearance ?? 0) : 0).toFixed(2), at: at(i), materials: i.materials, note: i.kind === 'buried' ? `${Math.round(i.buried * 100)}% hidden behind the wall` : `${Math.round(i.outside * 100)}% of the face past the wall edge`});
  for (const o of within.failing) offenders.push({kind: 'outside', gapM: 0, at: at(o), materials: o.materials, note: `${o.outsideM2} m2 past the wall silhouette${o.piercesRoof ? ', pierces a roof' : ''}`});
  offenders.sort((a, b) => b.gapM - a.gapM);
  return {id, counts: {float: float.length, poke: poke.length, outside: within.failing.length}, worstGapM: float.reduce((m, i) => Math.max(m, i.gap), 0), assemblies: op.assemblies, offenders};
}

type Allow = {generated: string; note: string; models: Record<string, Partial<Counts>>};
const readAllow = (): Allow => fs.existsSync(ALLOW) ? JSON.parse(fs.readFileSync(ALLOW, 'utf8')) : {generated: '', note: '', models: {}};

/** Pure verdict, unit-tested: over the entry fails, under the entry is stale (the entry must be lowered), absent entry means zero. */
export function verdict(counts: Counts, entry: Partial<Counts> | undefined): {over: string[]; stale: string[]} {
  const over: string[] = [], stale: string[] = [];
  for (const k of GATED) {
    const allowed = entry?.[k] ?? 0;
    if (counts[k] > allowed) over.push(`${k} ${counts[k]} > allowed ${allowed}`);
    else if (counts[k] < allowed) stale.push(`${k} ${counts[k]} < allowed ${allowed}`);
  }
  return {over, stale};
}

/** Lowered entries for `--write`: min(today, entry); a model at zero everywhere drops out. */
export function lowered(counts: Counts, entry: Partial<Counts> | undefined): Partial<Counts> | undefined {
  const out: Partial<Counts> = {};
  for (const k of GATED) { const v = Math.min(counts[k], entry?.[k] ?? 0); if (v > 0) out[k] = v; }
  return Object.keys(out).length ? out : undefined;
}

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const flag = (n: string) => process.argv.includes(`--${n}`);

/** Builders per model, for the report: the builder or generator that produced the offending GLB. */
export function builderOf(id: string): string {
  if (id.startsWith('haparandaweg-')) return 'scripts/haparandaweg/build.ts (block kit, src/canalRecall/blockBuilding)';
  if (id === 'de-hallen' || id === 'huis-bartolotti') return 'scripts/landmarks/hallen-house-builders.ts';
  for (const f of [`${id}-builder.ts`, `${id}-builders.ts`]) if (fs.existsSync(path.join(ROOT, 'scripts/landmarks', f))) return `scripts/landmarks/${f}`;
  const hit = fs.readdirSync(path.join(ROOT, 'scripts/landmarks')).find(f => /builders?\.ts$/.test(f) && id.startsWith(f.replace(/-builders?\.ts$/, '')));
  return hit ? `scripts/landmarks/${hit}` : 'scripts/landmarks/build-manual-landmarks.ts (inline builder)';
}

async function cached(id: string, file: string): Promise<ModelResult> {
  const key = crypto.createHash('sha1').update(fs.readFileSync(file)).update(String(CHECK_VERSION)).update(String(LAYERED_SHEET_IDS.has(id))).digest('hex');
  const cf = path.join(CACHE_DIR, `${id}.${key.slice(0, 16)}.json`);
  if (!flag('no-cache') && fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const r = await measureModel(id, file);
  fs.mkdirSync(CACHE_DIR, {recursive: true});
  for (const old of fs.readdirSync(CACHE_DIR)) if (old.startsWith(`${id}.`) && old !== path.basename(cf)) fs.rmSync(path.join(CACHE_DIR, old));
  fs.writeFileSync(cf, JSON.stringify(r));
  return r;
}

/** Landmark build hook (build-manual-landmarks.ts): judge the models just written; returns true when any is over its allow-list. */
export async function gateBuilt(models: {id: string; file: string}[]): Promise<boolean> {
  const allow = readAllow();
  let bad = false;
  for (const m of models) {
    const r = await measureModel(m.id, m.file);
    const v = verdict(r.counts, allow.models[m.id]);
    if (v.over.length) {
      bad = true;
      console.log(`OPENINGS GATE FAIL ${m.id}: ${v.over.join('; ')}  [${builderOf(m.id)}]`);
      for (const o of r.offenders.slice(0, 5)) console.log(`     ${o.kind} ${o.gapM ? `${o.gapM} m ` : ''}${o.materials.join('+')} at (${o.at.join(', ')}): ${o.note}`);
    } else if (v.stale.length) console.log(`openings gate: ${m.id} is under its allow-list entry (${v.stale.join('; ')}); run check-glb-openings.ts --write to lower it`);
  }
  return bad;
}

async function main() {
  const ids = arg('id')?.split(',');
  const shard = arg('shard')?.split('/').map(Number); // --shard=2/4: every 4th model starting at the 2nd (CI matrix)
  const targets = listTargets().filter(t => !ids || ids.includes(t.id)).filter((_, i) => !shard || i % shard[1] === shard[0] - 1);
  const allow = readAllow();
  const results: ModelResult[] = [];
  for (const t of targets) {
    const r = await cached(t.id, t.file);
    results.push(r);
    if (ids || flag('verbose')) {
      console.log(`${t.id}: float ${r.counts.float} poke ${r.counts.poke} outside ${r.counts.outside} (worst float gap ${r.worstGapM.toFixed(2)} m, ${r.assemblies} assemblies)`);
      for (const o of r.offenders.slice(0, Number(arg('top') ?? 8))) console.log(`   ${o.kind} ${o.gapM ? `${o.gapM} m ` : ''}${o.materials.join('+')} at (${o.at.join(', ')}): ${o.note}`);
    }
  }
  if (arg('out')) fs.writeFileSync(arg('out')!, JSON.stringify(results, null, 1));
  if (flag('report')) {
    const bad = results.filter(r => GATED.some(k => r.counts[k] > 0)).sort((a, b) => b.worstGapM - a.worstGapM || b.counts.float - a.counts.float);
    console.log(`\n${results.length} models, ${bad.length} with any float/poke/outside. Totals: ${GATED.map(k => `${k} ${results.reduce((s, r) => s + r.counts[k], 0)}`).join(', ')}`);
    const byBuilder = new Map<string, {models: number; float: number; poke: number; outside: number}>();
    for (const r of bad) { const b = builderOf(r.id), e = byBuilder.get(b) ?? {models: 0, float: 0, poke: 0, outside: 0}; e.models++; e.float += r.counts.float; e.poke += r.counts.poke; e.outside += r.counts.outside; byBuilder.set(b, e); }
    console.log('\nBy builder:'); for (const [b, e] of [...byBuilder].sort((a, b) => b[1].float - a[1].float).slice(0, 25)) console.log(`  ${b}: ${e.models} models, float ${e.float}, poke ${e.poke}, outside ${e.outside}`);
    console.log('\nTop offenders (worst floating gap):');
    for (const r of bad.slice(0, Number(arg('top') ?? 25))) console.log(`  ${r.id}: float ${r.counts.float} (worst ${r.worstGapM.toFixed(2)} m) poke ${r.counts.poke} outside ${r.counts.outside}  [${builderOf(r.id)}]`);
  }
  if (flag('write')) {
    const models: Allow['models'] = {...allow.models};
    for (const r of results) { const e = lowered(r.counts, allow.models[r.id]); if (e) models[r.id] = e; else delete models[r.id]; }
    // Models seeded for the first time (no entry yet) take today's counts: the one-off recording; later runs only lower.
    if (flag('seed')) for (const r of results) if (!allow.models[r.id] && GATED.some(k => r.counts[k] > 0)) models[r.id] = Object.fromEntries(GATED.filter(k => r.counts[k] > 0).map(k => [k, r.counts[k]]));
    const sorted = Object.fromEntries(Object.entries(models).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(ALLOW, JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: allow.note, models: sorted}, null, 1) + '\n');
    console.log(`Wrote ${path.relative(ROOT, ALLOW)} (${Object.keys(sorted).length} models)`);
    return;
  }
  let failed = 0, stale = 0;
  for (const r of results) {
    const v = verdict(r.counts, allow.models[r.id]);
    if (v.over.length) { failed++; console.log(`FAIL ${r.id}: ${v.over.join('; ')}  [${builderOf(r.id)}]`); for (const o of r.offenders.slice(0, 3)) console.log(`     ${o.kind} ${o.gapM ? `${o.gapM} m ` : ''}${o.materials.join('+')} at (${o.at.join(', ')}): ${o.note}`); }
    else if (v.stale.length) { stale++; console.log(`STALE ${r.id}: ${v.stale.join('; ')} (lower scripts/landmarks/opening-wall-allowlist.json with --write)`); }
  }
  const unknown = Object.keys(allow.models).filter(id => !ids && !shard && !results.some(r => r.id === id));
  for (const id of unknown) { stale++; console.log(`STALE ${id}: allow-list entry for a model that is not in the catalogue`); }
  console.log(`${results.length} models: ${results.length - failed - stale} ok, ${failed} over the allow-list, ${stale} stale entries`);
  if (failed || stale) process.exit(1);
}

if (process.argv[1]?.endsWith('check-glb-openings.ts')) await main();
