/**
 * F3 round 3: one buurt, start to finish, within a disk budget.
 *   thumbs (aimed thumbnails of the best years and second bearings) -> pixel-rank pick -> cut the top pick (medium panorama) -> gate on the cut crop
 *   (Jev, then Gemini on Jev passers) -> up to 2 re-cuts of the next candidate for crops that fail -> describe -> stage -> archive to the
 *   source-data worktree (committed, not pushed) -> delete the buurt's cache and work files.
 * Never --keep-panoramas. Stops (exit 4) when free space is under 25 GB. Resumable: a buurt with <archive>/<code>/summary.json is skipped.
 *
 *   node --import tsx scripts/house-crops/f3/centrum-one.ts <buurtCode> --work <dir> --archive <source-data worktree> [--tag f3-centrum-20261112]
 * Gate and describe run under `zsh -lic` so the API keys come from the login env (never printed, logged or stored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import { usability } from '../flags.ts';
import { makeStaged } from '../../../src/canalRecall/houseSpec/staged.ts';
import { specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const code = process.argv[2], work = path.resolve(arg('work')!), srcData = path.resolve(arg('archive')!), tag = arg('tag', 'f3-centrum-20261112')!;
if (!code || !arg('work') || !arg('archive')) { console.error('usage: centrum-one.ts <buurt> --work <dir> --archive <source-data worktree>'); process.exit(2); }
const W = path.join(work, code), A = path.join(W, 'archive'), CACHE = path.join(W, 'cache'), OUTROOT = path.join(srcData, 'experiments', tag, code);
const FLOOR = 25 * 1024 ** 3;
const freeBytes = () => { const s = statfsSync('/'); return s.bavail * s.bsize; };
const log = (m: string) => console.log(`[${code} ${new Date().toISOString().slice(11, 19)}] ${m}`);
const rj = <T>(f: string, d: T): T => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const t0 = Date.now();

if (fs.existsSync(path.join(OUTROOT, 'summary.json'))) { log('already done'); process.exit(0); }
if (fs.existsSync(path.join(work, 'STOP'))) { log('STOP file present'); process.exit(4); }
if (freeBytes() < FLOOR) { fs.writeFileSync(path.join(work, 'STOP'), `free ${freeBytes()} under floor at ${code}\n`); log(`free space ${(freeBytes() / 1024 ** 3).toFixed(1)} GB under the 25 GB floor: stopping`); process.exit(4); }
// load: wait while the machine is above 40 (the run is niced; a busy machine is not ours to slow further)
for (let i = 0; i < 240 && os.loadavg()[0] > 40; i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000);

fs.rmSync(W, { recursive: true, force: true });
for (const d of ['archive', 'cache', 'manifests', 'generated', 'judge']) fs.mkdirSync(path.join(W, d), { recursive: true });
const env = (extra: Record<string, string> = {}) => ({ ...process.env, PAND_REFERENCE_CACHE: CACHE, HOUSE_CROPS_ARCHIVE: A, HOUSE_CROPS_JUDGE_DIR: path.join(W, 'judge'), F3_GEMINI_TPM: '13000', F3_GEMINI_RPM: '45', ...extra });
function run(cmd: string[], opts: { manifest?: string; keys?: boolean; extraEnv?: Record<string, string> } = {}) {
  const e = env({ HOUSE_CROPS_MANIFEST_DIR: path.join(W, 'manifests', opts.manifest ?? 'x'), ...(opts.extraEnv ?? {}) });
  const line = ['nice', '-n', '10', 'node', '--import', 'tsx', ...cmd].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
  const r = opts.keys ? spawnSync('zsh', ['-lic', `cd '${REPO}' && ${line}`], { env: e, encoding: 'utf8', maxBuffer: 1 << 28 }) : spawnSync('sh', ['-c', line], { env: e, cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.appendFileSync(path.join(W, 'log.txt'), `$ ${cmd.join(' ')}\n${r.stdout}\n${r.stderr}\n`);
  return r;
}
const CROPS = 'scripts/house-crops/crops.ts', F3 = 'scripts/house-crops/f3';
const common = ['--headroom', '1.3', '--facing-first', '--archive', A, '--restart'];

// 1 thumbs
log('thumbs');
run([CROPS, '--buurt', code, '--thumbs', '--all-years', '--bearings', '--years', '3', '--thumb-px', '400', ...common], { manifest: 'thumbs' });
const thumbM = rj<any>(path.join(W, 'manifests/thumbs', `${code}.json`), { pands: {}, sessions: [] });
// 2 pick + 3 cut
run([`${F3}/pick.ts`, '--archive', A, '--out', path.join(W, 'pick0.json')]);
const pick0 = rj<Record<string, { chosen: string; order: string[] }>>(path.join(W, 'pick0.json'), {});
log(`cut ${Object.keys(pick0).length} picks`);
run([CROPS, '--buurt', code, '--cut-from', path.join(W, 'pick0.json'), '--medium-pano', ...common], { manifest: 'cut0' });

// 4 gate on the cut crop, <= 2 re-cuts
type Att = { k: number; pass: boolean | null; reasons: string[]; quality: number | null };
const attempts: Record<string, Att[]> = {};
const snap = (id: string, k: number) => { const d = path.join(A, 'pand-crops', id); for (const [from, to] of [['front.jpg', `front.a${k}.jpg`], ['front.json', `front.a${k}.json`], ['front.gate.json', `front.a${k}.gate.json`]]) if (fs.existsSync(path.join(d, from))) fs.copyFileSync(path.join(d, from), path.join(d, to)); };
function gate(ids: string[], k: number) {
  const out = path.join(W, `gate${k}.json`);
  run([`${F3}/gate-final.ts`, '--archive', A, '--ids', ids.join(','), '--out', out, '--concurrency', '3'], { keys: true });
  const g = rj<Record<string, { pass: boolean | null; reasons: string[]; quality: number | null }>>(out, {});
  for (const id of ids) { if (!fs.existsSync(path.join(A, 'pand-crops', id, 'front.jpg'))) continue; const r = g[id]; (attempts[id] ??= []).push({ k, pass: r?.pass ?? null, reasons: r?.reasons ?? ['not gated'], quality: r?.quality ?? null }); snap(id, k); }
  return g;
}
const withCrop = () => Object.keys(pick0).filter(id => fs.existsSync(path.join(A, 'pand-crops', id, 'front.jpg')));
let todo = withCrop();
log(`gate ${todo.length}`);
let g = gate(todo, 0);
for (let k = 1; k <= 2; k++) {
  const failed = todo.filter(id => g[id] && g[id].pass !== true && pick0[id].order[k]);
  if (!failed.length) break;
  log(`re-cut ${k}: ${failed.length}`);
  run([`${F3}/pick.ts`, '--next', path.join(W, 'pick0.json'), '--k', String(k), '--ids', failed.join(','), '--out', path.join(W, `pick${k}.json`)]);
  run([CROPS, '--buurt', code, '--pand', failed.join(','), '--cut-from', path.join(W, `pick${k}.json`), '--medium-pano', ...common], { manifest: `cut${k}` });
  todo = failed.filter(id => fs.existsSync(path.join(A, 'pand-crops', id, 'front.jpg')));
  g = gate(todo, k);
}
// final pick per pand: a gate pass, else the highest Jev quality
const final: Record<string, { k: number; pass: boolean | null; quality: number | null; reasons: string[] }> = {};
for (const [id, list] of Object.entries(attempts)) {
  const best = [...list].sort((a, b) => Number(b.pass === true) - Number(a.pass === true) || (b.quality ?? -1) - (a.quality ?? -1) || a.k - b.k)[0];
  const d = path.join(A, 'pand-crops', id);
  for (const [to, from] of [['front.jpg', `front.a${best.k}.jpg`], ['front.json', `front.a${best.k}.json`], ['front.gate.json', `front.a${best.k}.gate.json`]]) if (fs.existsSync(path.join(d, from))) fs.copyFileSync(path.join(d, from), path.join(d, to));
  final[id] = { k: best.k, pass: best.pass, quality: best.quality, reasons: best.reasons };
}

// 5 manifest + judge store for describe
const man: any = { version: 1, rulesVersion: 4, buurt: { code }, archive: 'pand-crops', createdAt: new Date().toISOString(), sessions: [], pands: {} };
const jstore: Record<string, any> = {};
const cutStatus: Record<string, string> = {};
for (const [id, e] of Object.entries<any>(thumbM.pands)) cutStatus[id] = e.status;
for (const id of Object.keys(final)) {
  const fj = rj<any>(path.join(A, 'pand-crops', id, 'front.json'), null); if (!fj) continue;
  const u = usability(fj.flags);
  man.pands[id] = { status: 'ok', method: fj.method, usable: u.usable, reasons: u.reasons, flags: fj.flags, archive: `pand-crops/${id}`, panoIds: (fj.panoramas ?? []).map((p: any) => p.panoId), date: fj.missionDate, ppm: fj.crop?.pixelsPerMetre, widthM: fj.crop?.wallWidthM, chosenYear: fj.chosenYear };
  const gr = rj<any>(path.join(A, 'pand-crops', id, 'front.gate.json'), null);
  if (gr?.jev) jstore[id] = { panoIds: man.pands[id].panoIds, score: gr.jev.score, occluded: gr.jev.occluded, closeUp: gr.jev.closeUp, tokens: gr.jev.tokens, model: 'jev-1.14.0', at: new Date().toISOString() };
}
fs.mkdirSync(path.join(W, 'manifests/final'), { recursive: true });
fs.writeFileSync(path.join(W, 'manifests/final', `${code}.json`), JSON.stringify(man));
fs.writeFileSync(path.join(W, 'judge', `${code}.json`), JSON.stringify(jstore));

// 6 describe
log('describe');
run(['scripts/house-specs/describe.ts', '--buurt', code, '--archive', A, '--out', path.join(W, 'generated'), '--jev-budget-usd', '1', '--jev-buurt-budget-usd', '1'], { manifest: 'final', keys: true });

// 7 stage (house:stage's own makeStaged + the same spec validation, in-process; staged files go to artifacts/house-specs/staging)
const STAGING = path.join(REPO, 'artifacts/house-specs/staging'); fs.mkdirSync(STAGING, { recursive: true });
const fieldCount: Record<string, number> = {}; let staged = 0, specs = 0, tiers: Record<string, number> = {};
const leaves = (o: any, pre: string, acc: string[]) => { for (const [k, v] of Object.entries<any>(o ?? {})) { if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, `${pre}${k}.`, acc); else acc.push(pre + k); } };
const genDir = path.join(W, 'generated', code), stagedOut = path.join(W, 'staging'); fs.mkdirSync(stagedOut, { recursive: true });
if (fs.existsSync(genDir)) for (const f of fs.readdirSync(genDir)) {
  const env_ = rj<any>(path.join(genDir, f), null); if (!env_?.spec) continue;
  specs++; tiers[env_.crop?.tier ?? 'none'] = (tiers[env_.crop?.tier ?? 'none'] ?? 0) + 1;
  const l: string[] = []; leaves(env_.spec.design, 'design.', l); leaves(env_.spec.facts, 'facts.', l);
  for (const k of l) { const kk = k.replace(/\.\d+/g, '').replace(/^design\.fronts\.[^.]*/, 'design.fronts'); fieldCount[kk] = (fieldCount[kk] ?? 0) + 1; }
  const prov = Object.values<any>(env_.spec.provenance ?? {}).map(p => p.source);
  if (!prov.some(s => s === 'streetlevel-measured' || s === 'vision-judge')) continue; // register / BAG only: nothing new to stage
  if (specProblems(env_.spec).length) continue;
  const st = makeStaged({ spec: env_.spec, by: 'F3 lane (#381)', note: `F3 Centrum ${code}: crop-measured spec, crop tier ${env_.crop?.tier}`, receipt: { kind: 'none', reason: 'F3 describe from a gated street crop; no house:preview was run for this spec' } });
  const txt = JSON.stringify(st, null, 1) + '\n';
  fs.writeFileSync(path.join(STAGING, `${env_.pandId}.json`), txt); fs.writeFileSync(path.join(stagedOut, `${env_.pandId}.json`), txt); staged++;
}

// 8 archive to source-data, commit
let bytes = 0, reqs = 0; for (const s of thumbM.sessions ?? []) { bytes += s.bytes; reqs += s.requests; }
for (const ph of ['cut0', 'cut1', 'cut2']) for (const s of rj<any>(path.join(W, 'manifests', ph, `${code}.json`), { sessions: [] }).sessions) { bytes += s.bytes; reqs += s.requests; }
const statuses: Record<string, number> = {}; for (const e of Object.values<any>(thumbM.pands)) statuses[e.status] = (statuses[e.status] ?? 0) + 1;
const gatePass = Object.values(final).filter(f => f.pass === true).length, gateFail = Object.values(final).filter(f => f.pass === false).length;
const summary = { code, buurtPands: Object.keys(thumbM.pands).length, statuses, crops: Object.keys(final).length, gatePass, gateFail, notGated: Object.values(final).filter(f => f.pass === null).length, recuts: Object.values(final).filter(f => f.k > 0).length, specs, tiers, staged, fields: fieldCount, bytes, requests: reqs, seconds: Math.round((Date.now() - t0) / 1000), at: new Date().toISOString() };
fs.mkdirSync(path.join(OUTROOT, 'pand-crops'), { recursive: true });
for (const id of Object.keys(final)) { const d = path.join(OUTROOT, 'pand-crops', id); fs.mkdirSync(d, { recursive: true }); for (const f of ['front.jpg', 'front.json', 'front.gate.json']) if (fs.existsSync(path.join(A, 'pand-crops', id, f))) fs.copyFileSync(path.join(A, 'pand-crops', id, f), path.join(d, f)); }
fs.cpSync(genDir, path.join(OUTROOT, 'generated'), { recursive: true }); fs.cpSync(stagedOut, path.join(OUTROOT, 'staging'), { recursive: true });
fs.writeFileSync(path.join(OUTROOT, 'attempts.json'), JSON.stringify({ final, attempts }));
fs.writeFileSync(path.join(OUTROOT, 'summary.json'), JSON.stringify(summary, null, 1));
// commit under a lock (workers share the source-data worktree's index)
const lock = path.join(srcData, '.f3-commit-lock');
for (let i = 0; i < 600; i++) { try { fs.mkdirSync(lock); break; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); } }
try { spawnSync('/usr/bin/git', ['-C', srcData, 'add', `experiments/${tag}/${code}`]); spawnSync('/usr/bin/git', ['-C', srcData, 'commit', '-q', '-m', `F3 Centrum ${code}: ${summary.crops} gated crops, ${specs} specs, ${staged} staged`]); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
// 9 cleanup: this buurt's panoramas, thumbnails and lists
fs.mkdirSync(path.join(work, 'logs'), { recursive: true }); fs.copyFileSync(path.join(W, 'log.txt'), path.join(work, 'logs', `${code}.log`));
fs.rmSync(W, { recursive: true, force: true });
log(`done: ${JSON.stringify({ crops: summary.crops, gatePass, gateFail, specs, staged, MB: Math.round(bytes / 1e6), s: summary.seconds })}; free ${(freeBytes() / 1024 ** 3).toFixed(1)} GB`);
