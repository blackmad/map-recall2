/** Cache-only area pipeline. Default is a read-only plan; --run creates only
 * hash-versioned .cache artifacts. No acquisition, image download or paid model
 * stage is reachable here. Existing public study files are never overwritten.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { runPipeline } from '../da-costa-block/pipeline-runner.mjs';
import { compileBlockAppearance, sha256 } from './compile-block-tiles.js';
import { compileContextTiles } from '../../src/canalRecall/cityAppearanceContextTiles.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const flag = (args: string[], name: string) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
type FilePin = { path: string; sha256: string };
type AreaPlan = Awaited<ReturnType<typeof planAreaPipeline>>;

/** Fingerprint actual local imports, including TS counterparts of .js imports.
 * The package lock and installed loader package versions pin external tooling. */
async function codePins(entrypoints: string[]): Promise<FilePin[]> {
  const files = new Map<string, string>();
  const visit = async (file: string) => {
    file = path.resolve(file);
    if (files.has(file)) return;
    const bytes = await fs.readFile(file); files.set(file, sha256(bytes));
    const imports = [...bytes.toString().matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]).filter(name => name.startsWith('.'));
    for (const name of imports) {
      const target = path.resolve(path.dirname(file), name);
      let existing = target;
      try { await fs.access(existing); }
      catch (error: any) {
        if (error.code !== 'ENOENT' || !target.endsWith('.js')) throw error;
        existing = target.slice(0, -3) + '.ts';
      }
      await visit(existing);
    }
  };
  for (const entrypoint of entrypoints) await visit(entrypoint);
  const packages = ['package-lock.json'];
  for (const name of ['tsx', 'sharp', 'jpeg-js']) {
    let directory = path.dirname(require.resolve(name));
    while (true) {
      const file = path.join(directory, 'package.json');
      let metadata;
      try { metadata = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      if (metadata?.name === name) { packages.push(file); break; }
      if (path.dirname(directory) === directory) throw new Error(`Missing installed package metadata: ${name}`);
      directory = path.dirname(directory);
    }
  }
  for (const file of packages) {
    files.set(path.resolve(file), sha256(await fs.readFile(file)));
  }
  return [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, hash]) => ({ path: file, sha256: hash }));
}

export async function planAreaPipeline(args: string[] = []) {
  const area = await loadAreaConfig(args);
  const sourceFiles = (await fs.readdir(area.cacheRoot)).filter(file => file.endsWith('.json')).sort();
  if (!sourceFiles.includes('acquisition.json') || !sourceFiles.includes('bag.json') || !sourceFiles.includes('panoramas.json')) throw new Error('Area cache is incomplete; acquire it separately before this offline pipeline');
  const acquisition = await readJson(path.join(area.cacheRoot, 'acquisition.json'));
  if (acquisition.errors?.length) throw new Error('Acquisition manifest reports incomplete sources');
  if (!area.referencePreset && acquisition.areaConfigHash !== area.configHash) throw new Error('Acquisition area config hash mismatch');
  const rawPins: FilePin[] = await Promise.all(sourceFiles.map(async file => ({ path: path.resolve(area.cacheRoot, file), sha256: sha256(await fs.readFile(path.join(area.cacheRoot, file))) })));
  const explicitEvidence = flag(args, 'evidence');
  let evidencePath: string | null = path.resolve(explicitEvidence ?? path.join(area.outputRoot, 'neighbourhood.json'));
  let evidenceBytes: Buffer | null = null;
  try { evidenceBytes = await fs.readFile(evidencePath); }
  catch (error: any) { if (error.code !== 'ENOENT' || explicitEvidence) throw error; evidencePath = null; }
  const configFile = flag(args, 'area-config');
  const areaArgs = configFile ? [`--area-config=${path.resolve(configFile)}`] : [`--area=${area.referencePreset}`];
  if (configFile) rawPins.push({ path: path.resolve(configFile), sha256: sha256(await fs.readFile(configFile)) });
  if (evidencePath && evidenceBytes) rawPins.push({ path: evidencePath, sha256: sha256(evidenceBytes) });
  const code = await codePins([
    'scripts/city-appearance/run-area-pipeline.ts', 'scripts/da-costa-block/compile.mjs',
    'scripts/da-costa-block/prepare-neighbourhood.ts',
    ...(area.referencePreset === 'elandsgracht' ? ['scripts/da-costa-block/eland-frontages.json'] : []),
  ]);
  const limit = Number(flag(args, 'limit') ?? 100000);
  if (!Number.isInteger(limit) || limit < 0 || limit > 100000) throw new Error('Inventory limit must be 0–100000');
  const input = { version: 1, area, rawPins, code, nodeVersion: process.version, limit, evidenceMode: evidencePath ? 'existing-source-bound-proposals' : 'geometry-only' };
  const runHash = sha256(JSON.stringify(input));
  const runRoot = path.resolve('.cache/city-appearance/areas', area.id, 'runs', runHash);
  return { ...input, runHash, runRoot, areaArgs, evidencePath, downloads: 0, paidCalls: 0, stages: ['compile', 'inventory', 'tiles', 'context-tiles'] };
}

async function assertPins(pins: FilePin[]) {
  for (const pin of pins) if (sha256(await fs.readFile(pin.path)) !== pin.sha256) throw new Error(`Input changed during run: ${pin.path}`);
}

async function safeRunRoot(root: string) {
  const cache = await fs.realpath('.cache');
  const relative = path.relative(path.resolve('.cache'), root);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Run root must be inside .cache');
  let current = cache;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try { await fs.mkdir(current); } catch (error: any) { if (error.code !== 'EEXIST') throw error; }
    const resolved = await fs.realpath(current);
    if (resolved !== cache && !resolved.startsWith(cache + path.sep)) throw new Error('Staging symlink escapes .cache');
    current = resolved;
  }
  return current;
}

export async function executeAreaPipeline(plan: AreaPlan, options: { signal?: AbortSignal; onStage?: (id: string) => void } = {}) {
  await assertPins([...plan.rawPins, ...plan.code]);
  const root = await safeRunRoot(plan.runRoot);
  const stage = async (id: string, action: (directory: string) => Promise<{ output: any; artifacts: string[] }>) => {
    options.signal?.throwIfAborted();
    await assertPins([...plan.rawPins, ...plan.code]);
    const directory = await fs.mkdtemp(path.join(root, `${id}-`));
    const result = await action(directory);
    await assertPins([...plan.rawPins, ...plan.code]);
    options.onStage?.(id);
    return result;
  };
  const exec = async (script: string, args: string[]) => execFileAsync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: process.cwd(), signal: options.signal, maxBuffer: 64 * 1024 * 1024,
    // No shell, inherited secrets are never printed. These entrypoints are
    // compiler-only and --inventory is fixed below, not caller-controlled.
  });
  const jobs = [
    { id: 'compile', version: 'offline-area-compile/v1', input: { runHash: plan.runHash }, run: () => stage('compile', async directory => {
      await exec('scripts/da-costa-block/compile.mjs', [...plan.areaArgs, `--out=${directory}`]);
      const blockPath = path.join(directory, 'block.json'), sourcesPath = path.join(directory, 'sources.json');
      const block = await readJson(blockPath);
      return { output: { blockPath, buildings: block.buildings.length }, artifacts: [blockPath, sourcesPath] };
    }) },
    { id: 'inventory', version: 'offline-area-inventory/v1', dependsOn: ['compile'], input: { runHash: plan.runHash }, run: ({ dependencies }: any) => stage('inventory', async directory => {
      const result = await exec('scripts/da-costa-block/prepare-neighbourhood.ts', [...plan.areaArgs, '--inventory', '--downloads=0', `--limit=${plan.limit}`, `--block=${dependencies.compile.blockPath}`]);
      const inventory = JSON.parse(result.stdout);
      if (inventory.downloads !== 0 || inventory.paidCalls !== 0) throw new Error('Offline inventory reported unexpected external work');
      const inventoryPath = path.join(directory, 'inventory.json');
      await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2), { flag: 'wx' });
      return { output: { inventoryPath, candidateFrontages: inventory.candidateFrontages, selectedFrontages: inventory.selectedFrontages }, artifacts: [inventoryPath] };
    }) },
    { id: 'tiles', version: 'offline-area-tiles/v1', dependsOn: ['compile', 'inventory'], input: { runHash: plan.runHash }, run: ({ dependencies }: any) => stage('tiles', async directory => {
      const block = await readJson(dependencies.compile.blockPath);
      const evidence = plan.evidencePath ? await readJson(plan.evidencePath) : { records: [] };
      const compiled = compileBlockAppearance(block, evidence);
      const artifacts: string[] = [], tiles: any[] = [];
      for (const tile of compiled.tiles) {
        const bytes = gzipSync(JSON.stringify(tile));
        const file = path.join(directory, `${tile.key}.json.gz`);
        await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' });
        artifacts.push(file); tiles.push({ key: tile.key, owners: tile.owners.length, haloReferences: tile.halo.length, gzipBytes: bytes.length, sha256: sha256(bytes) });
      }
      const indexPath = path.join(directory, 'index.json');
      const manifest = {
        version: 1, zoom: compiled.zoom, areaId: plan.area.id, runHash: plan.runHash,
        publication: 'experimental-staging-only', evidenceMode: plan.evidenceMode,
        sourceHashes: { block: sha256(await fs.readFile(dependencies.compile.blockPath)), evidence: plan.evidencePath ? sha256(await fs.readFile(plan.evidencePath)) : null },
        buildings: compiled.buildings, observations: compiled.observations, tileList: compiled.tiles.map(tile => tile.key), tiles,
        totalGzipBytes: tiles.reduce((sum, tile) => sum + tile.gzipBytes, 0), downloads: 0, paidCalls: 0,
        warning: 'No publication or model approval. Existing review/unknown state is retained; absent evidence produces geometry only.',
      };
      await fs.writeFile(indexPath, JSON.stringify(manifest, null, 2), { flag: 'wx' }); artifacts.push(indexPath);
      return { output: { directory, indexPath, buildings: compiled.buildings, observations: compiled.observations, totalGzipBytes: manifest.totalGzipBytes }, artifacts };
    }) },
    { id: 'context-tiles', version: 'offline-context-tiles/v1', dependsOn: ['compile'], input: { runHash: plan.runHash, zoom: 16 }, run: ({ dependencies }: any) => stage('context-tiles', async directory => {
      const block = await readJson(dependencies.compile.blockPath), compiled = compileContextTiles(block, 16), artifacts: string[] = [], tiles: any[] = [];
      for (const tile of compiled.tiles) {
        const bytes = gzipSync(JSON.stringify(tile)), file = path.join(directory, `${tile.key}.json.gz`);
        await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' }); artifacts.push(file);
        tiles.push({ key: tile.key, owners: tile.owners.length, haloReferences: tile.halo.length, gzipBytes: bytes.length, sha256: sha256(bytes) });
      }
      const indexPath = path.join(directory, 'index.json'), manifest = { version: 1, zoom: compiled.zoom, areaId: plan.area.id, runHash: plan.runHash,
        publication: 'experimental-staging-only', features: compiled.buildings, tileList: compiled.tiles.map(tile => tile.key), tiles,
        totalGzipBytes: tiles.reduce((sum, tile) => sum + tile.gzipBytes, 0), downloads: 0, paidCalls: 0,
        warning: 'Owner-bound public context only. Staging does not approve appearance evidence or publish a scene.' };
      await fs.writeFile(indexPath, JSON.stringify(manifest, null, 2), { flag: 'wx' }); artifacts.push(indexPath);
      return { output: { directory, indexPath, features: compiled.buildings, totalGzipBytes: manifest.totalGzipBytes }, artifacts };
    }) },
  ];
  return runPipeline({ file: path.join(root, 'pipeline.json'), areaId: plan.area.id, jobs, concurrency: 2, signal: options.signal });
}

async function main() {
  const args = process.argv.slice(2), plan = await planAreaPipeline(args);
  const summary = { mode: args.includes('--run') ? 'staged' : 'dry-run', areaId: plan.area.id, runHash: plan.runHash, runRoot: plan.runRoot,
    stages: plan.stages, sourceFiles: plan.rawPins.length, codeFiles: plan.code.length, evidenceMode: plan.evidenceMode, downloads: 0, paidCalls: 0 };
  if (!args.includes('--run')) { console.log(JSON.stringify(summary, null, 2)); return; }
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('Area run interrupted'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try { console.log(JSON.stringify({ ...summary, jobs: await executeAreaPipeline(plan, { signal: controller.signal }) }, null, 2)); }
  finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
