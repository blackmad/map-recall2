// house:publish (house line H3, docs/house-line.md section 3): the integrator's command. Takes every spec in
// artifacts/house-specs/staging/ through one batch: merge into the tiled extract, (recipe route) install and rebuild covers,
// recompile only the touched cells, re-record the goldens for the batch's houses only, run the suppression guard and
// check:canal once, then record what landed. Lanes never run it (they stop at house:stage).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { allowIdsFor, BATCH_BUDGET_MS, blockFaceFactsFor, cellsOfTiles, coversDelta, defaultBatchName, describeViolation, classifyExtras, diffTiles, formatExtraTable, mergeRecipeIntent, MIN_BLANK_WALL_M, suppressionViolations, withHold, type AuditWall, type ClassifiedExtra, type PandDiff, type SuppressionAudit, type TileFile } from '../../src/canalRecall/houseSpec/publishPlan.ts';
import { describeStaged, parseStaged, type StagedSpec } from '../../src/canalRecall/houseSpec/staged.ts';
import { pandIdsIn } from '../../src/canalRecall/houseSpec/allow.ts';
import { changedCoversTiles } from '../../src/canalRecall/world/tileCovers.ts';

export const HELP = `house:publish: publish the staged HouseSpecs as one batch (the integrator's command; lanes stop at house:stage).

  npm run house:publish -- [--dry-run [--compile]] [--batch <name>] [--allow-extra <pandIds>]
                           [--world-out <dir>] [--full-bake] [--goldens] [--archive <dir>]
                           [--verbose] [--skip-check-canal "<reason>"] [--skip-suppression "<reason>"]
  --help                   this text

  --dry-run [--compile]     step 1 only (with --compile also a rehearsal of step 4 in a scratch copy of --world-out, compiled
                           against the staged extract; nothing under public/ changes): merge the staged specs into a STAGED extract (public/data/extracts/amsterdam/staging/
                           house-specs), print the per-pand field diff, the touched z14 tiles and the cells they rebuild, and
                           the commands a real run would use. Nothing is published, installed or compiled.
  --batch <name>           the batch name (default batch-YYYYMMDD-HHMM); names artifacts/house-specs/{published,logs}/<name>*
  --allow-extra <ids>      OVERRIDE: pand ids whose extract record may change although nothing explains it. Every changed record
                           no staged spec names is classified: face-drawn (a scripts/block-face/faces/*/intent.json draws the
                           pand), same-as-main (equal to origin/main's record after sorting keys and dropping stamps), or
                           unexplained. The first two are allowed and logged (console table, published/<batch>.json
                           extraRecords); only unexplained refuses the batch, with the classified table printed.
  --world-out <dir>        the world:compile staging directory (default artifacts/world/staging); needs a previous
                           index.json there for --changed
  --full-bake              when the shell code changed since that compile (world:compile --shell --changed refuses), run a full
                           world:compile --shell instead of stopping
  --goldens                run the four goldens even for a generic-route-only batch (default: only when a spec has route recipe)
  --archive <dir>          the map-recall2-source-data checkout (default $MAP_RECALL_SOURCE_DATA): specs + receipts are copied
                           to <dir>/house-specs/<batch>/ (the integrator commits and pushes that worktree)
  --verbose                list every staged spec and every field of the diff (default: the first eight)
  --skip-check-canal "<r>" do not run check:canal (a rehearsal only; the reason is recorded in published/<batch>.json)
  --skip-suppression "<r>" do not run the suppression guard (same)

Steps, in order (each timed in published/<batch>.json; logs in artifacts/house-specs/logs/<batch>-<step>.log):
  1 merge      build-house-specs --extra-specs <batch dir>: staged tiles, diff vs the published extract, unstaged-record classification (refuses only unexplained)
  2 write      copy the specs to scripts/house-specs/specs/, build-house-specs --publish (the published extract changes here)
  3 recipe     only if a spec has route recipe: toRecipe -> houses/<id>/intent.json, facts, install.ts, build-covers,
               copy covers.json, check:covers (covers.json changes here)
  4 compile    world:compile --changed --shell (touched cells only; each tile hashes its own slice of covers.json); the cell
               files that changed must all belong to a touched tile
  5 goldens    fit-golden, large-mesh-hashes, roof-golden, block-kit-installed with --allow=<batch ids>; check:stale-installs
  6 suppress   the #341 audit (house:audit) for every pand the batch's covers newly hide, plus recipe-route pands: a street wall
               of ${MIN_BLANK_WALL_M} m or more left blank refuses the batch
  7 check      check:canal once
  8 record     published/<batch>.json, staged files moved to published/<batch>/, archive copy, the HISTORY/What's New paragraph,
               and the commands that copy the compiled world into public/data/extracts/amsterdam/world-v1
Exit code is non-zero on any gate failure; the working tree is left as it is for the integrator to inspect (git status).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const HS = path.join(ROOT, 'artifacts/house-specs');
const STAGING = path.join(HS, 'staging'), PUBLISHED = path.join(HS, 'published'), LOGS = path.join(HS, 'logs'), WORK = path.join(HS, 'work');
const SPEC_TILES_STAGED = path.join(EXTRACT, 'staging/house-specs/14'), SPEC_TILES = path.join(EXTRACT, 'house-specs/14');
const COVERS = path.join(ROOT, 'public/canal-drive/models/covers.json');
const HOUSES = path.join(ROOT, 'scripts/building-recipes/houses');
const HELD = path.join(ROOT, 'scripts/building-recipes/held-installs.json');
const rel = (p: string) => path.relative(ROOT, p);
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const NODE = process.execPath;
const tsx = (script: string, ...args: string[]) => ({ cmd: NODE, args: ['--max-old-space-size=8192', '--import', 'tsx', script, ...args] });
const npmRun = (script: string, ...args: string[]) => ({ cmd: process.env.npm_execpath?.endsWith('npm-cli.js') ? NODE : (existsSync('/opt/homebrew/bin/npm') ? '/opt/homebrew/bin/npm' : 'npm'), args: [...(process.env.npm_execpath?.endsWith('npm-cli.js') ? [process.env.npm_execpath] : []), 'run', script, ...(args.length ? ['--', ...args] : [])] });

type StepRec = { step: string; status: 'ok' | 'skipped' | 'failed'; ms: number; note?: string };

class Run {
  readonly steps: StepRec[] = [];
  readonly t0 = Date.now();
  constructor(readonly batch: string) {}
  log(step: string) { mkdirSync(LOGS, { recursive: true }); return path.join(LOGS, `${this.batch}-${step}.log`); }
  /** Runs a command with its output in the step log; returns the exit code and the last lines of output. */
  sh(step: string, c: { cmd: string; args: string[] }, env: NodeJS.ProcessEnv = {}): { code: number; tail: string } {
    const file = this.log(step), fd = openSync(file, 'a');
    const r = spawnSync(c.cmd, c.args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] });
    closeSync(fd);
    const text = readFileSync(file, 'utf8');
    return { code: r.status ?? 1, tail: text.split('\n').slice(-25).join('\n') };
  }
  async step<T>(name: string, fn: () => Promise<{ value: T; note?: string; skipped?: boolean }> | { value: T; note?: string; skipped?: boolean }): Promise<T> {
    const t = Date.now();
    try {
      const r = await fn();
      this.steps.push({ step: name, status: r.skipped ? 'skipped' : 'ok', ms: Date.now() - t, ...(r.note ? { note: r.note } : {}) });
      console.log(`[${name}] ${r.skipped ? 'skipped' : 'ok'} in ${((Date.now() - t) / 1000).toFixed(1)} s${r.note ? `: ${r.note}` : ''}`);
      return r.value;
    } catch (e) {
      this.steps.push({ step: name, status: 'failed', ms: Date.now() - t, note: (e as Error).message });
      console.error(`[${name}] FAILED after ${((Date.now() - t) / 1000).toFixed(1)} s: ${(e as Error).message}`);
      throw e;
    }
  }
  must(step: string, c: { cmd: string; args: string[] }, env: NodeJS.ProcessEnv = {}) {
    const r = this.sh(step, c, env);
    if (r.code !== 0) throw Error(`${step}: ${c.args.slice(-3).join(' ')} exited ${r.code}; log ${rel(this.log(step))}\n${r.tail}`);
    return r;
  }
}

function flag(args: string[], name: string): string | undefined {
  const i = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].slice(name.length + 3) : args[i + 1];
}
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

function readTiles(dir: string): Map<string, TileFile> {
  const out = new Map<string, TileFile>();
  if (!existsSync(dir)) return out;
  for (const x of readdirSync(dir)) for (const f of readdirSync(path.join(dir, x)).filter(f => f.endsWith('.json.gz'))) out.set(`${x}/${f.replace(/\.json\.gz$/, '')}`, JSON.parse(gunzipSync(readFileSync(path.join(dir, x, f))).toString('utf8')));
  return out;
}

/** Pand ids drawn by a block-face intent (scripts/block-face/faces/<face>/intent.json). */
function faceDrawnPands(): Set<string> {
  const dir = path.join(ROOT, 'scripts/block-face/faces'), out = new Set<string>();
  if (existsSync(dir)) for (const d of readdirSync(dir)) { const f = path.join(dir, d, 'intent.json'); if (existsSync(f)) for (const id of pandIdsIn([readFileSync(f, 'utf8')])) out.add(id); }
  return out;
}

/** main's tile file for `tile` ("x/y") from git (origin/main, else main); null when git cannot say. Read-only. */
function mainTile(tile: string, cache: Map<string, TileFile | null>): TileFile | null {
  if (cache.has(tile)) return cache.get(tile)!;
  let out: TileFile | null = null;
  for (const ref of ['origin/main', 'main']) {
    const r = spawnSync('/usr/bin/git', ['-C', ROOT, 'show', `${ref}:${rel(SPEC_TILES)}/${tile}.json.gz`], { maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) { try { out = JSON.parse(gunzipSync(r.stdout).toString('utf8')); break; } catch { /* try the next ref */ } }
  }
  cache.set(tile, out);
  return out;
}

/** The mention index the golden allow-list needs: house dirs, block faces and block-kit specs -> the pand ids in them. */
function mentions(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const scan = (dir: string, file: (d: string) => string, idOf: (d: string) => string) => {
    if (!existsSync(dir)) return;
    for (const d of readdirSync(dir)) { const f = file(d); if (existsSync(f)) { const ids = pandIdsIn([readFileSync(f, 'utf8')]); if (ids.length) out.set(idOf(d), ids); } }
  };
  scan(HOUSES, d => path.join(HOUSES, d, 'intent.json'), d => d);
  scan(path.join(ROOT, 'scripts/block-face/faces'), d => path.join(ROOT, 'scripts/block-face/faces', d, 'intent.json'), d => d);
  const kit = path.join(ROOT, 'scripts/haparandaweg/specs');
  if (existsSync(kit)) for (const f of readdirSync(kit).filter(f => f.endsWith('.json'))) { const ids = pandIdsIn([readFileSync(path.join(kit, f), 'utf8')]); if (ids.length) out.set(f.replace(/\.json$/, ''), ids); }
  return out;
}

/** The #341 audit as a SuppressionAudit: runs scripts/house-audit/suppressed-faces.ts on this checkout (its covers.json) and
 *  reads the walls from its JSON. Fails closed when the script is not on this branch (the audit branch must merge first). */
export function auditViaScript(run: Run): SuppressionAudit {
  return {
    async run(): Promise<AuditWall[]> {
      const script = path.join(ROOT, 'scripts/house-audit/suppressed-faces.ts'), out = path.join(HS, 'audit');
      if (!existsSync(script)) throw Error('the suppression guard needs scripts/house-audit/suppressed-faces.ts (lane A1, issue #341); merge that branch first, or pass --skip-suppression "<reason>"');
      run.must('suppress', tsx(rel(script), '--min-len', String(MIN_BLANK_WALL_M), '--out', out));
      const report = readJson(path.join(out, 'suppressed-faces.json')) as { walls?: AuditWall[] };
      if (!Array.isArray(report.walls)) throw Error('suppressed-faces.json has no walls[]: the audit output changed shape');
      return report.walls;
    },
  };
}

/** world:compile --changed --shell into `out` (a full --shell bake when there is no index yet, or when the shell code changed
 *  and `fullBake` is set), then checks that every cell/shell/far file that differs from the previous index belongs to a cell of
 *  a touched tile or of a tile whose covers slice moved. Throws with the log tail on any failure. */
function compileTouched(run: Run, out: string, env: NodeJS.ProcessEnv, touchedTiles: readonly string[], fullBake: boolean): { changed: string[]; full: boolean; note: string } {
  const before = existsSync(path.join(out, 'index.json')) ? readJson(path.join(out, 'index.json')) : null;
  const compile = (changed: boolean) => run.sh('compile', { cmd: NODE, args: ['--max-old-space-size=12000', '--import', 'tsx', 'scripts/world/compile.ts', ...(changed && before ? ['--changed'] : []), '--shell', `--out=${out}`] }, env);
  let r = compile(true), full = !before;
  if (r.code !== 0 && /--shell --changed: the shell code changed/.test(r.tail)) {
    if (!fullBake) throw Error(`the shell code changed since the last compile; run: npm run world:compile -- --shell   (or pass --full-bake)\n${r.tail}`);
    r = compile(false); full = true;
  }
  if (r.code !== 0) throw Error(`world:compile exited ${r.code}; log ${rel(run.log('compile'))}\n${r.tail}`);
  const after = readJson(path.join(out, 'index.json'));
  const files = (e: any) => ({ cell: e?.sha256, shell: e?.shell?.sha256, far: e?.far?.sha256 });
  const changed = Object.keys(after.cells).filter(k => JSON.stringify(files(after.cells[k])) !== JSON.stringify(files(before?.cells?.[k]))).sort();
  if (before && !full) {
    const coversTiles = changedCoversTiles(Object.keys(after.tileCovers ?? {}), before.tileCovers, new Map(Object.entries(after.tileCovers ?? {})));
    const expected = new Set(cellsOfTiles({ ...before.tileCells, ...after.tileCells }, [...touchedTiles, ...coversTiles]));
    const outside = changed.filter(k => !expected.has(k));
    if (outside.length) throw Error(`${outside.length} cells changed outside the touched tiles' cells (${outside.slice(0, 10).join(' ')}); expected only ${expected.size} cells`);
  }
  return { changed, full, note: `${full ? 'FULL bake, ' : ''}${changed.length} cell/shell/far files changed of ${Object.keys(after.cells).length} cells${changed.length ? `: ${changed.slice(0, 40).join(' ')}${changed.length > 40 ? ' ...' : ''}` : ''}` };
}

async function main(args: string[]): Promise<number> {
  if (args.includes('--help')) { console.log(HELP); return 0; }
  const dry = args.includes('--dry-run');
  const batch = flag(args, 'batch') ?? defaultBatchName();
  const allowExtra = new Set((flag(args, 'allow-extra') ?? '').split(',').filter(Boolean));
  const worldOut = path.resolve(flag(args, 'world-out') ?? path.join(ROOT, 'artifacts/world/staging'));
  const run = new Run(batch);
  const batchDir = path.join(WORK, batch);

  // ---- 1 merge -------------------------------------------------------------------------------------------------
  const merged = await run.step('merge', () => {
    const files = existsSync(STAGING) ? readdirSync(STAGING).filter(f => /^\d{16}\.json$/.test(f)).sort() : [];
    if (!files.length) throw Error(`nothing staged in ${rel(STAGING)} (house:stage puts specs there)`);
    const staged: StagedSpec[] = files.map(f => parseStaged(readJson(path.join(STAGING, f))));
    for (const s of staged) if (s.receipt.kind === 'preview') {
      for (const [file, want] of [[s.receipt.measurePath, s.receipt.measureSha256], [s.receipt.comparePath, s.receipt.compareSha256]] as const) {
        const abs = path.join(ROOT, file);
        if (!existsSync(abs)) throw Error(`${s.pandId}: receipt file ${file} is gone (re-run house:preview and house:stage)`);
        if (sha(readFileSync(abs)) !== want) throw Error(`${s.pandId}: receipt file ${file} changed since staging (re-stage it)`);
      }
    }
    rmSync(batchDir, { recursive: true, force: true });
    mkdirSync(path.join(batchDir, 'specs'), { recursive: true });
    for (const s of staged) writeFileSync(path.join(batchDir, 'specs', `${s.pandId}.json`), JSON.stringify(s.spec, null, 1) + '\n');
    run.must('merge', tsx('scripts/house-specs/build-house-specs.ts', '--extra-specs', path.join(batchDir, 'specs'), '--emit-intents', path.join(batchDir, 'intents'), '--for', staged.map(s => s.pandId).join(',')));
    const now = readTiles(SPEC_TILES_STAGED), before = readTiles(SPEC_TILES);
    const diff = diffTiles(before, now);
    const batchPands = new Set(staged.map(s => s.pandId));
    const nowTiles = now, mainCache = new Map<string, TileFile | null>();
    const classes = classifyExtras(diff.pands, batchPands, allowExtra, {
      faceDrawn: faceDrawnPands(),
      merged: (feature, tile) => nowTiles.get(tile)?.buildings[feature],
      main: (feature, tile) => { const t = mainTile(tile, mainCache); return t ? t.buildings[feature] : undefined; },
    });
    const extra = classes.blocking.map(c => c.diff);
    const missing = staged.filter(s => ![...now.values()].some(t => t.buildings[`NL.IMBAG.Pand.${s.pandId}`])).map(s => s.pandId);
    const noop = staged.filter(s => !diff.pands.some(d => d.pand === s.pandId)).map(s => s.pandId);
    const accepted = classes.classified.filter(c => c.cls !== 'unexplained');
    if (accepted.length || classes.allowed.length) console.log(`extra records accepted: ${accepted.filter(c => c.cls === 'face-drawn').length} face-drawn, ${accepted.filter(c => c.cls === 'same-as-main').length} same-as-main, ${classes.allowed.length} by --allow-extra`);
    return { value: { staged, diff, extra, missing, noop, batchPands, classes }, note: `${staged.length} specs, ${diff.pands.length} pand records change in ${diff.touchedTiles.length} tiles${classes.classified.length ? `; ${classes.classified.length} unstaged (${accepted.length} explained, ${classes.blocking.length} unexplained)` : ''}` };
  });

  // The table the integrator reads (and the dry run's whole output).
  const index = existsSync(path.join(worldOut, 'index.json')) ? readJson(path.join(worldOut, 'index.json')) : null;
  const touchedCells = index ? cellsOfTiles(index.tileCells ?? {}, merged.diff.touchedTiles) : [];
  console.log(`\nBatch ${batch}: ${merged.staged.length} staged specs`);
  const verbose = args.includes('--verbose'), rows = verbose ? merged.staged : merged.staged.slice(0, 8);
  for (const s of rows) console.log(`  ${describeStaged(s)}`);
  if (rows.length < merged.staged.length) console.log(`  ... ${merged.staged.length - rows.length} more (--verbose lists all)`);
  console.log(`  receipts: ${merged.staged.filter(s => s.receipt.kind === 'preview').length} preview, ${merged.staged.filter(s => s.receipt.kind === 'none').length} none; routes: ${merged.staged.filter(s => s.spec.route === 'recipe').length} recipe, ${merged.staged.filter(s => s.spec.route !== 'recipe').length} generic`);
  console.log(`\nField diff against ${rel(SPEC_TILES)} (${merged.diff.pands.length} pand records):`);
  const fieldRows = verbose ? merged.diff.pands : merged.diff.pands.slice(0, 8);
  for (const d of fieldRows) console.log(`  ${d.pand} [${d.change}, tile ${d.tile}] ${d.fields.length} fields${merged.batchPands.has(d.pand) ? '' : '  (NOT STAGED)'}\n${d.fields.slice(0, verbose ? 12 : 4).map(f => `      ${f}`).join('\n')}${d.fields.length > (verbose ? 12 : 4) ? `\n      ... ${d.fields.length - (verbose ? 12 : 4)} more` : ''}`);
  if (fieldRows.length < merged.diff.pands.length) console.log(`  ... ${merged.diff.pands.length - fieldRows.length} more pand records (--verbose lists all; the NOT STAGED ones always print)`);
  for (const d of merged.diff.pands.slice(fieldRows.length).filter(d => !merged.batchPands.has(d.pand))) console.log(`  ${d.pand} [${d.change}, tile ${d.tile}] ${d.fields.length} fields  (NOT STAGED)`);
  console.log(`\nTouched z14 tiles (${merged.diff.touchedTiles.length}): ${merged.diff.touchedTiles.join(' ')}`);
  console.log(index ? `Cells that list them (${touchedCells.length}): ${touchedCells.join(' ')}` : `(no ${rel(worldOut)}/index.json yet: run world:compile --shell once; --changed needs it)`);
  if (merged.missing.length) throw Error(`staged pands that are in no building tile (the extract would drop them): ${merged.missing.join(', ')}`);
  if (merged.classes.classified.length || merged.classes.allowed.length) console.log(`\nUnstaged record changes, classified:\n${formatExtraTable(merged.classes.classified, merged.classes.allowed)}`);
  if (merged.extra.length) throw Error(`${merged.extra.length} pand records change that no staged spec names and nothing explains (not face-drawn, not equal to main): ${merged.extra.map(e => e.pand).slice(0, 20).join(', ')}${merged.extra.length > 20 ? ' ...' : ''}\n  review the table above; pass --allow-extra <ids> to override`);
  if (merged.noop.length) console.log(`note: ${merged.noop.length} staged specs change nothing in the extract: ${merged.noop.join(', ')}`);
  const recipePands = merged.staged.filter(s => merged.diff.pands.some(d => d.pand === s.pandId) && existsSync(path.join(batchDir, 'intents', `${s.pandId}.json`))).map(s => s.pandId);

  const commands = [
    `npm run house:publish -- --batch ${batch}${allowExtra.size ? ` --allow-extra ${[...allowExtra].join(',')}` : ''}`,
    ...(index ? [] : ['npm run world:compile -- --shell   # once, to create the staging index']),
  ];
  if (dry && args.includes('--compile')) {
    // Rehearse the rebuild in a scratch copy of the compile directory, against the STAGED extract: nothing under public/ changes.
    if (!index) throw Error(`--compile needs a previous ${rel(worldOut)}/index.json (run world:compile --shell once)`);
    const scratch = path.join(ROOT, 'artifacts/world', `dry-run-${batch}`);
    rmSync(scratch, { recursive: true, force: true });
    cpSync(worldOut, scratch, { recursive: true });
    const idsCache = `${worldOut.replace(/\/$/, '')}.tile-ids.json`;
    if (existsSync(idsCache)) cpSync(idsCache, `${scratch}.tile-ids.json`);
    await run.step('compile', () => ({ value: null, note: compileTouched(run, scratch, { HOUSE_SPECS_DIR: 'staging/house-specs' }, merged.diff.touchedTiles, args.includes('--full-bake')).note }));
    console.log(`\nscratch output: ${rel(scratch)} (delete it when done)`);
  }
  if (dry) {
    console.log(`\n--dry-run: nothing published. Recipe-route specs in this batch: ${recipePands.length}.\nA real run: ${commands.join('\n          ')}`);
    return 0;
  }

  // ---- 2 write: the published extract changes ------------------------------------------------------------------------
  const coversBefore = existsSync(COVERS) ? readJson(COVERS) : { models: {} };
  await run.step('write', () => {
    const handDir = path.join(ROOT, 'scripts/house-specs/specs');
    mkdirSync(handDir, { recursive: true });
    for (const s of merged.staged) writeFileSync(path.join(handDir, `${s.pandId}.json`), JSON.stringify(s.spec, null, 1) + '\n');
    run.must('write', tsx('scripts/house-specs/build-house-specs.ts', '--publish'));
    return { value: null, note: `${merged.staged.length} specs copied to ${rel(handDir)}, extract published` };
  });

  // ---- 3 recipe: install, covers (only for route recipe) -----------------------------------------------------------
  const held: string[] = [];
  const installed: string[] = [];
  await run.step('recipe', () => {
    if (!recipePands.length) return { value: null, skipped: true, note: 'no spec has route recipe' };
    const byPand = new Map<string, string>();
    for (const d of readdirSync(HOUSES)) { const f = path.join(HOUSES, d, 'intent.json'); if (existsSync(f)) { const j = readJson(f); if (j.pandId && j.kind === 'canal-house') byPand.set(String(j.pandId), d); } }
    const ids: string[] = [];
    for (const pand of recipePands) {
      const generated = readJson(path.join(batchDir, 'intents', `${pand}.json`));
      const id = byPand.get(pand) ?? `spec-${pand}`, file = path.join(HOUSES, id, 'intent.json');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(mergeRecipeIntent(existsSync(file) ? readJson(file) : null, generated, id), null, 1) + '\n');
      if (!existsSync(path.join(HOUSES, id, 'facts.json'))) {
        // A pand on a block face starts from the face's facts (blockFaceFactsFor: the frontage chord over a BAG erker).
        const faces = path.join(ROOT, 'scripts/block-face/faces'), faceFacts = blockFaceFactsFor(pand, readdirSync(faces).sort().map(f => path.join(faces, f)), existsSync);
        if (faceFacts) cpSync(faceFacts, path.join(HOUSES, id, 'facts.json'));
        else {
          const street = /^(.*?)\s+\d/.exec(String(generated.address ?? ''))?.[1];
          run.must('recipe', tsx('scripts/building-recipes/facts.ts', `--house=${id}`, `--pand=${pand}`, ...(street ? [`--street=${street}`] : []), '--no-photo'));
        }
      }
      ids.push(id);
    }
    for (const id of ids) {
      const r = run.sh('recipe', tsx('scripts/building-recipes/install.ts', `--house=${id}`));
      if (r.code === 0) { installed.push(id); continue; }
      if (byPand.has(recipePands[ids.indexOf(id)])) {
        // A reinstall that fails its gates keeps the old GLB; the hold makes that explicit for check:stale-installs.
        writeFileSync(HELD, JSON.stringify(withHold(existsSync(HELD) ? readJson(HELD) : {}, id, new Date().toISOString().slice(0, 10)), null, 1) + '\n');
        held.push(id);
        console.log(`  held ${id}: reinstall failed its gates (${rel(run.log('recipe'))})`);
      } else throw Error(`install of the new recipe house ${id} failed; log ${rel(run.log('recipe'))}\n${r.tail}`);
    }
    const bagTiles = [path.join(ROOT, 'artifacts/bag-tiles/bag-tiles/14'), path.join(EXTRACT, 'bag-tiles/14')].find(existsSync)!;
    const coversStage = path.join(ROOT, 'artifacts/bag-tiles/covers.json');
    run.must('recipe', tsx('scripts/build-covers.ts', `--tiles=${bagTiles}`, `--out=${coversStage}`));
    cpSync(coversStage, COVERS);
    run.must('recipe', npmRun('check:covers'));
    return { value: null, note: `${installed.length} installed, ${held.length} held; covers.json rebuilt and copied` };
  });
  const coversAfter = existsSync(COVERS) ? readJson(COVERS) : { models: {} };
  const delta = coversDelta(coversBefore, coversAfter);

  // ---- 4 compile: touched cells only ---------------------------------------------------------------------------------
  const cellsChanged = await run.step('compile', () => {
    const r = compileTouched(run, worldOut, {}, merged.diff.touchedTiles, args.includes('--full-bake'));
    return { value: r.changed, note: r.note };
  });

  // ---- 5 goldens ---------------------------------------------------------------------------------------------------
  const allowIds = allowIdsFor(merged.batchPands, mentions());
  await run.step('goldens', () => {
    if (!recipePands.length && !args.includes('--goldens')) return { value: null, skipped: true, note: 'generic-route batch: the per-cell compare in step 4 is the guard' };
    const allow = `--allow=${allowIds.join(',')}`;
    const outside: string[] = [];
    for (const [name, c] of [
      ['fit-golden', tsx('scripts/building-recipes/fit-golden.ts', allow)],
      ['large-mesh-hashes', tsx('scripts/building-recipes/large-mesh-hashes.ts', allow)],
      ['roof-golden', tsx('scripts/block-face/roof-golden.ts', allow)],
      ['block-kit-installed', tsx('scripts/haparandaweg/check-installed.ts', allow)],
    ] as const) {
      const r = run.sh('goldens', c);
      if (r.code !== 0) outside.push(`${name}: ${r.tail.split('\n').filter(l => /CHANGED|OUTSIDE|DIFFERS|VIOLATION/.test(l)).join(' | ') || `exit ${r.code}`}`);
    }
    const stale = run.sh('goldens', npmRun('check:stale-installs'));
    if (stale.code !== 0) outside.push(`check:stale-installs: ${stale.tail.split('\n').slice(-6).join(' | ')}`);
    if (outside.length) throw Error(`golden changes outside the batch (pands: ${pandIdsIn(outside).join(', ') || 'see log'}):\n  ${outside.join('\n  ')}\n  log ${rel(run.log('goldens'))}`);
    return { value: null, note: `allow-list ${allowIds.length} ids` };
  });

  // ---- 6 suppression guard -----------------------------------------------------------------------------------------
  const suppressed = new Set([...delta.added, ...delta.moved, ...recipePands]);
  const skipSuppression = flag(args, 'skip-suppression');
  await run.step('suppress', async () => {
    if (skipSuppression) return { value: null, skipped: true, note: `skipped: ${skipSuppression}` };
    if (!suppressed.size) return { value: null, skipped: true, note: 'the batch hides no pand (covers.json unchanged)' };
    const walls = await auditViaScript(run).run();
    const bad = suppressionViolations(walls, suppressed);
    if (bad.length) throw Error(`the batch leaves ${bad.length} street walls of ${MIN_BLANK_WALL_M} m or more blank:\n  ${bad.map(describeViolation).join('\n  ')}`);
    return { value: null, note: `${suppressed.size} suppressed pands, no blank street wall >= ${MIN_BLANK_WALL_M} m` };
  });

  // ---- 7 check:canal -----------------------------------------------------------------------------------------------
  const skipCanal = flag(args, 'skip-check-canal');
  await run.step('check', () => {
    if (skipCanal) return { value: null, skipped: true, note: `skipped: ${skipCanal}` };
    run.must('check', npmRun('check:canal'));
    return { value: null, note: 'check:canal green' };
  });

  // ---- 8 record ----------------------------------------------------------------------------------------------------
  const wallMs = Date.now() - run.t0;
  const record = {
    batch, at: new Date().toISOString(), wallMs, budgetMs: BATCH_BUDGET_MS, underBudget: wallMs < BATCH_BUDGET_MS,
    specs: merged.staged.map(s => ({ pand: s.pandId, route: s.spec.route ?? 'generic', by: s.by, stagedAt: s.stagedAt, note: s.note, receipt: s.receipt.kind === 'preview' ? { verdict: s.receipt.verdict, measure: s.receipt.measurePath, compare: s.receipt.comparePath } : { none: s.receipt.reason } })),
    extraRecords: [...merged.classes.classified.map((c: ClassifiedExtra) => ({ pand: c.diff.pand, change: c.diff.change, tile: c.diff.tile, class: c.cls, why: c.why })), ...merged.classes.allowed.map((d: PandDiff) => ({ pand: d.pand, change: d.change, tile: d.tile, class: 'allow-extra', why: '--allow-extra override' }))],
    pandRecords: merged.diff.pands.map(d => ({ pand: d.pand, change: d.change, tile: d.tile, fields: d.fields.length })),
    touchedTiles: merged.diff.touchedTiles, touchedCells: touchedCells, cellFilesChanged: cellsChanged,
    covers: delta, installed, held, goldenAllow: allowIds,
    skipped: { checkCanal: skipCanal ?? null, suppression: skipSuppression ?? null },
    steps: run.steps,
  };
  const dest = path.join(PUBLISHED, batch);
  mkdirSync(dest, { recursive: true });
  for (const s of merged.staged) {
    mkdirSync(path.join(dest, s.pandId), { recursive: true });
    renameSync(path.join(STAGING, `${s.pandId}.json`), path.join(dest, s.pandId, 'staged.json'));
    if (s.receipt.kind === 'preview') for (const f of [s.receipt.measurePath, s.receipt.comparePath]) if (existsSync(path.join(ROOT, f))) cpSync(path.join(ROOT, f), path.join(dest, s.pandId, path.basename(f)));
  }
  writeFileSync(path.join(PUBLISHED, `${batch}.json`), JSON.stringify(record, null, 1) + '\n');
  const archive = flag(args, 'archive') ?? process.env.MAP_RECALL_SOURCE_DATA;
  if (archive && existsSync(archive)) { cpSync(dest, path.join(archive, 'house-specs', batch), { recursive: true }); console.log(`archived to ${path.join(archive, 'house-specs', batch)} (commit and push that worktree)`); }
  else console.log(`not archived (no --archive and no MAP_RECALL_SOURCE_DATA). Run: cp -R ${rel(dest)} <map-recall2-source-data>/house-specs/${batch}`);

  const generic = merged.staged.filter(s => (s.spec.route ?? 'generic') === 'generic').length;
  console.log(`\n=== ${batch} published in ${(wallMs / 60000).toFixed(1)} min (budget ${BATCH_BUDGET_MS / 60000}) -> ${rel(path.join(PUBLISHED, `${batch}.json`))}`);
  console.log(`\nIntegrator, next:
  1. copy the compiled world: for d in cells shells far; do rsync -a --delete ${rel(worldOut)}/$d/ public/data/extracts/amsterdam/world-v1/$d/; done; cp ${rel(worldOut)}/{index.json,tiles.json,strings.bin} public/data/extracts/amsterdam/world-v1/
  2. npm run world:verify -- --dir=${rel(worldOut)}   (globalFresh true, 0 stale, 0 differing), then npm run test:world-format
  3. covers.json${delta.added.length || delta.moved.length || delta.removed.length ? ' changed: rebuild the covers-dependent bundles/stamps your round needs, re-publish landmark cards if an extract regenerated' : ' unchanged'}
  4. commit scripts/house-specs/specs/*.json, the published extract (public/data/extracts/amsterdam/house-specs), world-v1${recipePands.length ? ', houses/*, ordinary-buildings GLBs + catalogue, covers.json, goldens' : ''}
  5. push the archive worktree, then HISTORY and What's New:\n`);
  console.log(`HISTORY: House line batch ${batch}: ${merged.staged.length} specs (${generic} generic, ${merged.staged.length - generic} recipe) published in ${(wallMs / 60000).toFixed(1)} min; ${merged.diff.pands.length} extract records changed in ${merged.diff.touchedTiles.length} tiles, ${touchedCells.length} cells rebuilt (${cellsChanged.length} files differ); ${merged.staged.filter(s => s.receipt.kind === 'preview').length} carry a preview receipt, ${merged.staged.filter(s => s.receipt.kind === 'none').length} none.`);
  console.log(`WHAT'S NEW: ${merged.staged.length} more houses now follow their photos: ${merged.diff.pands.filter(d => d.change !== 'removed').slice(0, 3).map(d => d.pand).join(', ')}${merged.staged.length > 3 ? ' and others' : ''} (add the street names, a before/after shot, and the images link from map-recall2-screenshots).`);
  return 0;
}

if (process.argv[1]?.endsWith('publish.ts')) main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(`\nhouse:publish stopped: ${(e as Error).message}`); process.exit(1); });
