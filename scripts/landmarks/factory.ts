/**
 * Landmark factory (plan `docs/plans/thousand-buildings-20261023.md`, lane F): chains the existing large-recipe CLIs
 * over the queue, unattended, one pand at a time, and writes each step's outcome back into the queue. No LLM call
 * anywhere; the review turn reads the strip afterwards.
 *
 *   node --import tsx scripts/landmarks/factory.ts [--ids=20 | --pands=0363...,0363...] [--stage=crops|facts|draft|measure|compile|all]
 *        [--queue=public/canal-drive/landmark-factory-queue.json] [--owner=<lane>] [--force] [--no-render] [--dry]
 *
 * Stages, each skipped when its output exists (--force redoes them):
 *   crops    pand-reference/all-walls.ts --pand --archive --min-len=8 --max=12   -> $MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/walls.json
 *   facts    building-recipes/facts.ts --house --pand --large [--street=A|B]      -> houses/<house>/facts.json (streets: routing paths within 30 m)
 *   draft    draftLargeIntent()                                                   -> houses/<house>/intent.json (a hand-authored intent is never overwritten)
 *   measure  building-recipes/measure.ts --house --write                          -> measured wall/glass colour, system, window shape, bays
 *   compile  building-recipes/large.ts --house --strict                           -> GLB, gates, likeness, contact sheets under artifacts/building-recipes/<house>/
 * Statuses: queued -> crops -> facts -> drafted -> measured -> compiled | no-evidence | error. After the review turn
 * (status reviewed-pass) the lane installs with `install-large.ts --house=<house> --install`; `reviewed-fix` items
 * come back through `--stage=compile` once the intent edit is applied.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {draftLargeIntent, factoryMayWrite, factoryMeasureArgs, isDraftIntent} from '../../src/canalRecall/buildingRecipe/draftLarge.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {QUEUE_FILE, type Queue, type QueueItem, type QueueStatus} from './factory-queue.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const has = (f: string) => process.argv.includes(f);
const HOUSES = 'scripts/building-recipes/houses', ARTIFACTS = 'artifacts/building-recipes';
const STAGES = ['crops', 'facts', 'draft', 'measure', 'compile'] as const;
type Stage = typeof STAGES[number];
const AFTER: Record<Stage, QueueStatus> = {crops: 'crops', facts: 'facts', draft: 'drafted', measure: 'measured', compile: 'compiled'};
const ORDER: QueueStatus[] = ['queued', 'crops', 'facts', 'drafted', 'measured', 'compiled'];
const TIMEOUT_S: Record<Stage, number> = {crops: 900, facts: 600, draft: 60, measure: 1500, compile: 1500};
// --source=pdok goes to the facts step only (skips the 3DBAG API, which waits before falling back); every other step is unchanged
const FACTS_SOURCE: string[] = process.argv.some(a => a === '--source=pdok') ? ['--source=pdok'] : [];

const sourceData = process.env.MAP_RECALL_SOURCE_DATA ?? (fs.existsSync('/Users/blackmad/Code/map-recall2-source-data') ? '/Users/blackmad/Code/map-recall2-source-data' : '');
if (!sourceData) throw Error('MAP_RECALL_SOURCE_DATA is not set and the default checkout is missing: crops and likeness need the source-data archive');
const env = {...process.env, MAP_RECALL_SOURCE_DATA: sourceData};
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const exists = (f: string) => fs.existsSync(f);
const slug = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);

/** Run a repo CLI under tsx; the tail of its output comes back for the queue notes. */
const STALE_CLAIM_H = Number(process.env.FACTORY_STALE_CLAIM_H ?? 6);

function run(script: string, args: string[], timeoutS: number): {ok: boolean; tail: string; ms: number} {
  const t0 = Date.now();
  if (has('--dry')) { console.log(`    dry: node --import tsx ${script} ${args.join(' ')}`); return {ok: true, tail: 'dry', ms: 0}; }
  let result = {ok: false, tail: '', ms: 0};
  // one retry on a network failure (the 3DBAG and panorama APIs time out now and then; a second try usually lands)
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync('node', ['--import', 'tsx', script, ...args], {env, encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 64 * 1024 * 1024});
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').filter(l => l.trim() && !/^\s+at /.test(l));
    const tail = out.slice(-6).join(' | ').slice(0, 900);
    result = {ok: r.status === 0 && !r.error, tail: r.error ? `${r.error.message}: ${tail}` : tail, ms: Date.now() - t0};
    if (result.ok || !/UND_ERR|ECONNRESET|ETIMEDOUT|fetch failed|EAI_AGAIN|503|502/.test(result.tail)) break;
    console.log(`    network error, retrying once: ${result.tail.slice(0, 120)}`);
    spawnSync('sleep', ['8']);
  }
  return result;
}

/** Named routing streets within 30 m of the footprint, nearest first (at most three), for `facts.ts --street`. streets-routing.json paths are [lat, lng]. */
let streetsCache: {name: string; pathsRD: [number, number][][]}[] | null = null;
function nearbyStreets(ringRD: [number, number][]): string[] {
  streetsCache ??= (read('public/data/extracts/amsterdam/streets-routing.json') as any[]).filter(s => s.name).map(s => ({name: s.name, pathsRD: (s.paths ?? [s.path]).map((p: [number, number][]) => p.map(q => { const r = lngLatToRd([q[1], q[0]]); return [r.x, r.y] as [number, number]; }))}));
  const xs = ringRD.map(p => p[0]), ys = ringRD.map(p => p[1]);
  const box = {w: Math.min(...xs) - 40, e: Math.max(...xs) + 40, s: Math.min(...ys) - 40, n: Math.max(...ys) + 40};
  const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const best = new Map<string, number>();
  for (const s of streetsCache) for (const path of s.pathsRD) {
    if (!path.some(q => q[0] > box.w && q[0] < box.e && q[1] > box.s && q[1] < box.n)) continue;
    let d = Infinity;
    for (const v of ringRD) for (let i = 1; i < path.length; i++) d = Math.min(d, segDist(v, path[i - 1], path[i]));
    if (d <= 30 && d < (best.get(s.name) ?? Infinity)) best.set(s.name, d);
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).map(e => e[0]);
}

function wallsJson(pand: string): {walls: any[]} | null {
  const f = path.join(sourceData, 'pand-reference-walls', pand, 'walls.json');
  return exists(f) ? read(f) : null;
}

function note(item: QueueItem, text: string) { (item.notes ??= []).push(`${new Date().toISOString().slice(0, 16)} ${text}`); if (item.notes.length > 12) item.notes = item.notes.slice(-12); }

async function stageCrops(item: QueueItem, force: boolean): Promise<boolean> {
  if (!force && wallsJson(item.pand)) return true;
  const r = run('scripts/pand-reference/all-walls.ts', [`--pand=${item.pand}`, '--archive', '--min-len=8', '--max=12'], TIMEOUT_S.crops);
  if (!r.ok) {
    // a pand the building tiles never drew (3DBAG hole, demolished, a wrong id in the backlog) is a data gap, not a factory fault
    item.status = /pand not in building tiles/.test(r.tail) ? 'no-evidence' : 'error';
    note(item, `crops failed: ${r.tail.replace(/\s*\|\s*at <anonymous>.*$/, '').slice(0, 400)}`); return false;
  }
  const w = wallsJson(item.pand);
  const usable = (w?.walls ?? []).filter(x => x.crop !== false && (x.missingFraction ?? 0) < 0.6).length;
  if (!has('--dry') && !usable) { item.status = 'no-evidence'; note(item, `no usable panorama crop for any exposed wall (${w?.walls?.length ?? 0} walls listed)`); return false; }
  note(item, `crops: ${usable} usable walls in ${Math.round(r.ms / 1000)} s`);
  return true;
}

async function stageFacts(item: QueueItem, force: boolean): Promise<boolean> {
  const house = item.house!, dir = path.join(HOUSES, house), factsFile = path.join(dir, 'facts.json');
  // a hand-authored house's facts are its author's (factoryMayWrite): never refetched, even with --force
  if (exists(factsFile) && (!force || !factoryMayWrite(exists(path.join(dir, 'intent.json')) ? read(path.join(dir, 'intent.json')) : null))) return true;
  // pass 1: the shell and the BAG footprint; pass 2 names the streets found within 30 m so facts.fronts exist
  let r = run('scripts/building-recipes/facts.ts', [`--house=${house}`, `--pand=${item.pand}`, '--large', '--no-photo', ...FACTS_SOURCE], TIMEOUT_S.facts);
  if (!r.ok) { item.status = 'error'; note(item, `facts failed: ${r.tail}`); return false; }
  if (has('--dry')) return true;
  const facts = read(factsFile), streets = nearbyStreets(facts.bagFootprintRD.flat());
  if (streets.length) {
    r = run('scripts/building-recipes/facts.ts', [`--house=${house}`, `--pand=${item.pand}`, '--large', `--street=${streets.join('|')}`, ...FACTS_SOURCE], TIMEOUT_S.facts);
    if (!r.ok) note(item, `facts with streets ${streets.join('|')} failed (${r.tail.slice(0, 200)}); kept the street-less facts`);
    else note(item, `facts: fronts on ${read(factsFile).fronts.map((f: any) => f.street).join(', ') || 'no street'}`);
  } else note(item, 'facts: no routing street within 30 m; groups will be unnamed');
  return true;
}

async function stageDraft(item: QueueItem, force: boolean): Promise<boolean> {
  const house = item.house!, dir = path.join(HOUSES, house), intentFile = path.join(dir, 'intent.json');
  if (exists(intentFile)) {
    const intent = read(intentFile);
    // only an intent the factory drafted is ever redrafted (with --force); a hand-authored one is read-only
    if (!factoryMayWrite(intent)) { if (!item.notes?.some(n => n.includes('hand-authored intent kept'))) note(item, 'draft: hand-authored intent kept'); return true; }
    if (!force) return true;
  }
  if (has('--dry')) { console.log('    dry: draftLargeIntent'); return true; }
  try {
    const facts = read(path.join(dir, 'facts.json')), crops = wallsJson(item.pand)?.walls ?? [];
    const {intent, groups, skipped} = draftLargeIntent(facts, {id: house, pandId: item.pand, address: item.name ? `${item.name} (BAG pand ${item.pand})` : undefined, crops});
    fs.writeFileSync(intentFile, JSON.stringify(intent, null, 1) + '\n');
    fs.writeFileSync(path.join(dir, 'draft.json'), JSON.stringify({date: new Date().toISOString().slice(0, 10), groups, skipped}, null, 1) + '\n');
    note(item, `draft: ${groups.length} groups (${groups.filter(g => g.street).length} on a street), ${skipped.length} panels blank`);
    return true;
  } catch (e) { item.status = 'error'; note(item, `draft failed: ${(e as Error).message.slice(0, 300)}`); return false; }
}

async function stageMeasure(item: QueueItem, force: boolean): Promise<boolean> {
  const house = item.house!, intentFile = path.join(HOUSES, house, 'intent.json');
  // a hand-authored house is measured read-only: no --write, and measured.json goes to artifacts/, not houses/
  const intentNow = exists(intentFile) ? read(intentFile) : null;
  if (!isDraftIntent(intentNow)) {
    const r = run('scripts/building-recipes/measure.ts', factoryMeasureArgs(house, intentNow, ARTIFACTS), TIMEOUT_S.measure);
    if (!r.ok) { item.status = 'error'; note(item, `measure (read-only, hand-authored) failed: ${r.tail}`); return false; }
    note(item, `measured read-only (hand-authored intent): ${path.join(ARTIFACTS, house, 'measured.json')}`);
    return true;
  }
  if (!force && read(intentFile).measured) return true;
  const r = run('scripts/building-recipes/measure.ts', factoryMeasureArgs(house, intentNow, ARTIFACTS), TIMEOUT_S.measure);
  if (!r.ok) { item.status = 'error'; note(item, `measure failed: ${r.tail}`); return false; }
  const measured = has('--dry') ? null : read(intentFile).measured;
  note(item, measured ? `measured groups ${measured.groups.join(',')} in ${Math.round(r.ms / 1000)} s` : `measure wrote nothing (no group matched a crop): ${r.tail.slice(0, 200)}`);
  if (!has('--dry') && !measured) { item.status = 'no-evidence'; return false; }
  return true;
}

async function stageCompile(item: QueueItem): Promise<boolean> {
  const house = item.house!;
  const r = run('scripts/building-recipes/large.ts', [`--house=${house}`, '--strict', ...(has('--no-render') ? ['--no-render'] : [])], TIMEOUT_S.compile);
  const reportFile = path.join(ARTIFACTS, house, 'report.json');
  if (has('--dry')) return true;
  if (!exists(reportFile)) { item.status = 'error'; note(item, `compile failed: ${r.tail}`); return false; }
  const report = read(reportFile);
  const gates = (report.gates ?? []).filter((g: any) => !g.pass && !g.advisory).map((g: any) => g.id);
  // report.likeness rows carry the verdict at the top level (large.ts `likenessSummary`); no-photo groups have none
  const likeness = (report.likeness ?? []).map((g: any) => ({group: g.group, verdict: g.verdict ?? g.likeness?.verdict ?? (g.status === 'no-photo' ? 'NO PHOTO' : '-'), reasons: (g.reasons ?? g.likeness?.reasons ?? []).slice(0, 3)}));
  // wall sheets first (the review judges fronts), the aerial pair last
  const sheets = fs.readdirSync(path.join(ARTIFACTS, house)).filter(f => /^contact.*\.png$/.test(f)).sort((a, b) => Number(a.includes('aerial')) - Number(b.includes('aerial')) || a.localeCompare(b)).map(f => path.join(ARTIFACTS, house, f));
  item.report = {triangles: report.triangles, bytes: report.bytes, gatesFailing: gates, passed: report.passed, likeness, compiledAt: new Date().toISOString().slice(0, 16)};
  item.sheets = sheets;
  note(item, `compiled: ${report.triangles} tris, gates ${gates.length ? 'FAIL ' + gates.join(',') : 'pass'}, likeness ${likeness.map((l: any) => `g${l.group}:${l.verdict}`).join(' ') || 'none'}${r.ok ? '' : ' (large.ts exited non-zero: ' + r.tail.slice(0, 160) + ')'}`);
  return true;
}

async function main() {
  const file = arg('queue', QUEUE_FILE), queue: Queue = read(file), force = has('--force'), owner = arg('owner', process.env.USER ?? 'factory');
  const stageArg = arg('stage', 'all'), stages: Stage[] = stageArg === 'all' ? [...STAGES] : stageArg.split(',').filter((s): s is Stage => (STAGES as readonly string[]).includes(s));
  if (!stages.length) throw Error(`--stage must be one of ${STAGES.join(', ')} or all`);
  const wanted = arg('pands') ? new Set(arg('pands').split(',')) : null;
  const n = Number(arg('ids', '20'));
  const progressable: QueueStatus[] = ['queued', 'crops', 'facts', 'drafted', 'measured', ...(stageArg === 'all' ? [] : ['compiled', 'reviewed-fix', 'error', 'no-evidence'] as QueueStatus[])];
  // an `error` row whose last note is a network failure (3DBAG or panorama API down) is picked up again by the next run
  const networkError = (i: QueueItem) => i.status === 'error' && /UND_ERR|Connect Timeout|ECONNRESET|ETIMEDOUT|fetch failed|EAI_AGAIN/.test(i.notes?.at(-1) ?? '');
  // A row is claimable when nobody owns it, the caller owns it, or its claim is stale: a lane that claimed it more
  // than STALE_CLAIM_H hours ago and left it at a stage boundary has finished (the crops lane leaves rows at `crops`).
  const staleBefore = Date.now() - STALE_CLAIM_H * 3600e3;
  const claimable = (i: QueueItem) => !i.owner || i.owner === owner || i.status === 'queued' || (i.claimedAt != null && Date.parse(i.claimedAt) < staleBefore);
  const items = queue.items.filter(i => i.pand && (wanted ? wanted.has(i.pand) : (progressable.includes(i.status) || networkError(i)) && claimable(i))).slice(0, wanted ? undefined : n);
  if (!items.length) { console.log('factory: nothing to do'); return; }
  const save = () => { if (!has('--dry')) { queue.generatedAt = queue.generatedAt; fs.writeFileSync(file + '.tmp', JSON.stringify(queue, null, 1) + '\n'); fs.renameSync(file + '.tmp', file); } };
  const tally: Record<string, number> = {};
  for (const item of items) {
    item.house ??= `${slug(item.name) || 'pand'}-${item.pand.slice(-6)}`;
    if (item.owner !== owner) item.claimedAt = new Date().toISOString(); item.owner = owner; item.claimedAt ??= new Date().toISOString();
    console.log(`${item.pand} ${item.house} [${item.status}]`);
    let ok = true;
    for (const stage of stages) {
      // a stage already passed (by status order) is skipped unless --force or named explicitly
      if (!force && stageArg === 'all' && ORDER.indexOf(item.status) >= ORDER.indexOf(AFTER[stage]) && item.status !== 'queued') continue;
      const t0 = Date.now();
      ok = stage === 'crops' ? await stageCrops(item, force) : stage === 'facts' ? await stageFacts(item, force) : stage === 'draft' ? await stageDraft(item, force) : stage === 'measure' ? await stageMeasure(item, force) : await stageCompile(item);
      console.log(`  ${stage.padEnd(8)} ${ok ? 'ok' : item.status} ${Math.round((Date.now() - t0) / 1000)} s`);
      if (!ok) break;
      item.status = AFTER[stage];
      item.updatedAt = new Date().toISOString();
      save();
    }
    item.updatedAt = new Date().toISOString();
    tally[item.status] = (tally[item.status] ?? 0) + 1;
    save();
  }
  console.log(`FACTORY ${owner}: ${items.length} items -> ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

await main();
