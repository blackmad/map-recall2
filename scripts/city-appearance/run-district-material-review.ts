/** Local-only diagnostic review of completed native material-4000 district batches. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { runBenchmark, recordsFromEvidenceManifest } from './benchmark-local-materials.mjs';

const exec = promisify(execFile);
const sha = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const validSha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const basename = (value: string) => path.basename(value) === value && /^[a-zA-Z0-9_.-]+$/.test(value);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const POLICY = 'Local diagnostic proposals only; no visual acceptance, game publication, paid calls, or model downloads.';
const RESERVE_BYTES = 4 * 1024 ** 3;

export type Job = { areaId: string; batchIndex: number; selectionHash: string; manifest: string; manifestSha256: string };
type Output = { path: string; sha256: string };
type JobRow = { key: string; fingerprint: Record<string, string>; job: Job; status: 'running' | 'complete' | 'error';
  attempts: number; startedAt: string; completedAt?: string; error?: string; outputs: Record<string, Output>;
  proposalErrors?: string[]; previousFailures?: { at: string; error: string }[] };
type State = { version: 2; policy: string; jobs: Record<string, JobRow> };
export type Dependencies = {
  discover: () => Promise<Job[]>; fingerprint: (job: Job) => Promise<Record<string, string>>;
  execute: (job: Job, key: string, fingerprint: Record<string, string>) => Promise<{ outputs: Record<string, Output>; proposalErrors: string[] }>;
  verify: (row: JobRow) => Promise<boolean>; readState: () => Promise<State>; saveState: (state: State) => Promise<void>;
  sleep: (ms: number) => Promise<void>; clock: () => number;
};

async function atomicJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2)); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

async function readJson(file: string) { return JSON.parse(await fs.readFile(file, 'utf8')); }

export async function discoverJobs(sourceCache: string): Promise<Job[]> {
  const directory = path.join(sourceCache, 'districts/da-costa-jordaan-v1/rectification');
  let files: string[];
  try { files = await fs.readdir(directory); }
  catch (error: any) { if (error.code === 'ENOENT') return []; throw error; }
  const jobs = new Map<string, Job>();
  for (const name of files.filter(file => file.endsWith('-material-4000-batch-100.json')).sort()) {
    const report = await readJson(path.join(directory, name));
    if (report.sourceProfile !== 'material-4000' || report.batchSize !== 100 || !Array.isArray(report.batches))
      throw Error(`Invalid rectification report: ${name}`);
    for (const batch of report.batches) {
      if (!Number.isInteger(batch.rectifiedFrontages) || batch.rectifiedFrontages <= 0) continue;
      if (typeof batch.areaId !== 'string' || !/^[a-z0-9-]+$/.test(batch.areaId) ||
          !Number.isInteger(batch.batchIndex) || !validSha(batch.selectionHash)) throw Error(`Invalid completed batch in ${name}`);
      const manifest = path.join(sourceCache, 'areas', batch.areaId, 'panorama-audit', batch.selectionHash, 'evidence/manifest.json');
      let bytes: Buffer;
      try { bytes = await fs.readFile(manifest); }
      catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
      const parsed = JSON.parse(bytes.toString());
      recordsFromEvidenceManifest(parsed, manifest, 'full');
      const job = { areaId: batch.areaId, batchIndex: batch.batchIndex, selectionHash: batch.selectionHash,
        manifest, manifestSha256: sha(bytes) };
      jobs.set(`${job.areaId}:${job.batchIndex}:${job.selectionHash}`, job);
    }
  }
  return [...jobs.values()].sort((a, b) => a.areaId.localeCompare(b.areaId) || a.batchIndex - b.batchIndex);
}

export function jobKey(fingerprint: Record<string, string>) { return sha(JSON.stringify(fingerprint)); }

export function transient(error: any): boolean {
  const code = error?.code ?? error?.cause?.code;
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE'].includes(code)) return true;
  const message = String(error?.message ?? error);
  return /(?:local ollama .* HTTP |local Ollama chat HTTP )(?:429|5\d\d)\b/i.test(message) ||
    /(?:fetch failed|network error|socket hang up|timeout)/i.test(message);
}

export async function schedule(options: { run: boolean; watch: boolean; retryFailed: boolean; maxBatches: number;
  maxHours: number; pollMs?: number; retryMs?: number }, deps: Dependencies) {
  const state = await deps.readState(); // A malformed existing state is fatal.
  const deadline = deps.clock() + options.maxHours * 3600_000;
  let started = 0, completed = 0, skipped = 0;
  const attempted = new Set<string>();
  do {
    for (const job of await deps.discover()) {
      if (started >= options.maxBatches || deps.clock() >= deadline) break;
      const fingerprint = await deps.fingerprint(job);
      const key = jobKey(fingerprint);
      if (attempted.has(key)) continue;
      const previous = state.jobs[key];
      if (previous?.status === 'complete') {
        if (await deps.verify(previous)) { skipped++; continue; }
        // Changed or missing outputs invalidate a completed job and force a fresh attempt.
      } else if (previous?.status === 'error' && !options.retryFailed) { skipped++; continue; }
      if (!options.run) continue;
      started++;
      attempted.add(key);
      const failures = [...(previous?.previousFailures ?? [])];
      if (previous?.error && failures.at(-1)?.error !== previous.error)
        failures.push({ at: previous.completedAt ?? previous.startedAt, error: previous.error });
      for (let attempt = 1; attempt <= 3; attempt++) {
        const row: JobRow = { key, fingerprint, job, status: 'running', attempts: (previous?.attempts ?? 0) + attempt,
          startedAt: now(), outputs: previous?.outputs ?? {}, previousFailures: failures };
        state.jobs[key] = row;
        await deps.saveState(state);
        try {
          const result = await deps.execute(job, key, fingerprint);
          row.outputs = result.outputs;
          row.proposalErrors = result.proposalErrors;
          if (!Object.keys(row.outputs).length || !await deps.verify(row)) throw Error('Missing, invalid, or changed proposal output');
          row.status = 'complete';
          row.completedAt = now();
          completed++;
          await deps.saveState(state);
          break;
        } catch (error: any) {
          row.status = 'error'; row.error = String(error?.message ?? error); row.completedAt = now();
          row.previousFailures?.push({ at: row.completedAt, error: row.error });
          await deps.saveState(state);
          if (attempt === 3 || !transient(error) || deps.clock() >= deadline) break;
          await deps.sleep(options.retryMs ?? 30_000);
        }
      }
    }
    if (!options.run || !options.watch || started >= options.maxBatches || deps.clock() >= deadline) break;
    await deps.sleep(options.pollMs ?? 60_000);
  } while (true);
  return { mode: options.run ? 'run' : 'plan', started, completed, skipped, maxBatches: options.maxBatches, policy: POLICY };
}

async function freeBytes(directory: string) {
  const { stdout } = await exec('df', ['-k', directory]);
  const fields = stdout.trim().split('\n').at(-1)!.trim().split(/\s+/);
  const available = Number(fields[3]) * 1024;
  if (!Number.isFinite(available)) throw Error('Cannot determine free disk space');
  return available;
}

async function output(file: string): Promise<Output> { return { path: file, sha256: sha(await fs.readFile(file)) }; }
export async function verifyOutput(value?: Output) {
  if (!value || !validSha(value.sha256)) return false;
  try { return sha(await fs.readFile(value.path)) === value.sha256; }
  catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
}

async function verifyRow(row: JobRow) {
  if (!['strips', 'benchmark', 'segmentation', 'wallColours'].every(key => row.outputs[key])) return false;
  if (!(await Promise.all(Object.values(row.outputs).map(verifyOutput))).every(Boolean)) return false;
  const benchmark = await readJson(row.outputs.benchmark.path);
  const segmentation = await readJson(row.outputs.segmentation.path);
  const strips = await readJson(row.outputs.strips.path);
  if (benchmark.receipts?.length !== strips.strips?.length || segmentation.records?.length !== strips.strips?.length ||
      segmentation.sourceManifestSha256 !== row.outputs.strips.sha256) return false;
  for (const receipt of benchmark.receipts) {
    if (!receipt.key || !['ok', 'invalid-schema', 'error'].includes(receipt.status)) return false;
    const file = path.join(path.dirname(row.outputs.benchmark.path), 'receipts', `${receipt.key}.json`);
    const full = await readJson(file);
    if (full.key !== receipt.key || full.binding?.sourceManifestSha256 !== row.job.manifestSha256) return false;
  }
  for (const record of segmentation.records) {
    if (!validSha(record.maskSha256) || !basename(path.basename(record.mask))) return false;
    if (sha(await fs.readFile(path.join(path.dirname(row.outputs.segmentation.path), record.mask))) !== record.maskSha256) return false;
  }
  const colours = await readJson(row.outputs.wallColours.path);
  if (colours.kind !== 'source-photo-wall-colour-diagnostic' || !Array.isArray(colours.rows) ||
      colours.rows.length !== strips.strips.length || colours.provenanceSha256 !== row.outputs.segmentation.sha256 ||
      colours.counts?.sources !== colours.rows.length) return false;
  if (colours.rows.some((item: any) => item.sourceManifestSha256 !== row.job.manifestSha256 ||
      !['measured-provisional', 'needs-review', 'withheld'].includes(item.status))) return false;
  return true;
}

async function stageStrips(job: Job, directory: string) {
  if (await freeBytes(path.dirname(directory)) < RESERVE_BYTES) throw Error('Disk reserve below 4 GiB before strip staging');
  const manifestBytes = await fs.readFile(job.manifest);
  if (sha(manifestBytes) !== job.manifestSha256) throw Error('Source manifest changed after discovery');
  const manifest = JSON.parse(manifestBytes.toString());
  const records = recordsFromEvidenceManifest(manifest, job.manifest, 'full');
  if (records.length > 250) throw Error('Batch exceeds conservative benchmark limit of 250 sources');
  if (new Set(records.map(record => record.sourceSha256)).size !== records.length)
    throw Error('Duplicate source crop hash in batch; segmentation binding would be ambiguous');
  await fs.mkdir(directory, { recursive: true });
  const strips = [];
  for (const record of records) {
    const source = record.imagePath;
    const bytes = await fs.readFile(source);
    if (sha(bytes) !== record.sourceSha256) throw Error(`Source image hash mismatch: ${source}`);
    const file = `${record.sourceSha256}.jpg`, destination = path.join(directory, file);
    try { await fs.link(source, destination); }
    catch (error: any) { if (error.code !== 'EEXIST') throw error; if (sha(await fs.readFile(destination)) !== record.sourceSha256) throw error; }
    strips.push({ file, pandId: record.buildingId, sourceSha256: record.sourceSha256,
      sourcePixelsPerMetre: null, renderedPixelsPerMetre: null });
  }
  const file = path.join(directory, 'manifest.json');
  await atomicJson(file, { version: 1, metadata: { sourceManifest: job.manifest,
    sourceManifestSha256: job.manifestSha256, localOnly: true }, strips });
  return output(file);
}

function flag(args: string[], name: string, fallback?: string) {
  return args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}
function integer(args: string[], name: string, fallback: number, min: number, max: number) {
  const value = Number(flag(args, name, String(fallback)));
  if (!Number.isInteger(value) || value < min || value > max) throw Error(`${name} must be ${min}–${max}`);
  return value;
}

export async function main(args = process.argv.slice(2)) {
  const run = args.includes('--run'), watch = args.includes('--watch');
  if (watch && !run) throw Error('--watch requires --run');
  const sourceCache = path.resolve(flag(args, 'source-cache', '.cache/city-appearance')!);
  const workCache = path.resolve(flag(args, 'work-cache', '.cache/city-appearance/district-material-review')!);
  if (workCache === path.resolve('public') || workCache.startsWith(path.resolve('public') + path.sep))
    throw Error('Diagnostic worker output cannot be written under public/');
  const modelCache = path.resolve(flag(args, 'model-cache', '.cache/roofline-eval')!);
  const stateFile = path.join(workCache, 'progress.json');
  const readState = async (): Promise<State> => {
    try {
      const state = await readJson(stateFile);
      if (state.version !== 2 || typeof state.jobs !== 'object' || !state.jobs || Array.isArray(state.jobs))
        throw Error(`Invalid progress state: ${stateFile}`);
      return state;
    } catch (error: any) {
      if (error.code === 'ENOENT') return { version: 2, policy: POLICY, jobs: {} };
      throw error;
    }
  };
  if (!run) {
    const jobs = await discoverJobs(sourceCache);
    const state = await readState();
    return { mode: 'plan', discovered: jobs.length, recorded: Object.keys(state.jobs).length,
      maxBatches: integer(args, 'max-batches', 44, 1, 44), maxHours: integer(args, 'max-hours', 8, 1, 8), runRequired: true, policy: POLICY };
  }
  const script = 'scripts/city-appearance/measure-local-wall-colours.ts';
  const benchmarkCode = sha(await fs.readFile('scripts/city-appearance/benchmark-local-materials.mjs'));
  const measurementCode = sha(await fs.readFile(script));
  const maskCode = sha(await fs.readFile('scripts/roofline-eval/segment.py'));
  const modelDir = path.join(modelCache, 'models/mask2former-swin-large-mapillary-vistas-semantic');
  const maskModel = sha(await fs.readFile(path.join(modelDir, 'model.safetensors')));
  if (maskModel !== '72721afb6894c0b1239b9259c428996d9ca0aecbebc4efb4a2deaae0403e2ea7')
    throw Error('Pinned Mask2Former weights changed');
  const maskConfig = sha(await fs.readFile(path.join(modelDir, 'config.json')));
  const maskPreprocessor = sha(await fs.readFile(path.join(modelDir, 'preprocessor_config.json')));
  const tagsResponse = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(10000) });
  if (!tagsResponse.ok) throw Error(`Local Ollama model catalog HTTP ${tagsResponse.status}`);
  const tags: any = await tagsResponse.json();
  const qwen = tags.models?.find((model: any) => model.name === 'qwen3.5:9b' || model.model === 'qwen3.5:9b');
  if (!qwen?.digest) throw Error('Local Qwen model missing');
  const deps: Dependencies = {
    discover: () => discoverJobs(sourceCache), readState, saveState: state => atomicJson(stateFile, state),
    sleep: delay, clock: Date.now,
    fingerprint: async job => ({ areaId: job.areaId, batchIndex: String(job.batchIndex), selectionHash: job.selectionHash,
      sourceManifestSha256: job.manifestSha256, qwenDigest: qwen.digest,
      classifierCode: benchmarkCode, classifierConfig: 'qwen3.5:9b/conservative/think=false/768/limit=250',
      measurementCode, maskCode, maskModel, maskConfig, maskPreprocessor }),
    verify: verifyRow,
    execute: async (job, key) => {
      const base = path.join(workCache, key);
      await fs.mkdir(base, { recursive: true });
      const strips = await stageStrips(job, path.join(base, 'strips'));
      const sourceOutputs: Record<string, Output> = {};
      const stripManifest = await readJson(strips.path);
      for (const record of stripManifest.strips) {
        const source = await output(path.join(base, 'strips', record.file));
        if (source.sha256 !== record.sourceSha256) throw Error('Staged source hash mismatch');
        sourceOutputs[`source:${record.file}`] = source;
      }
      const benchmark = await runBenchmark([`--manifest=${job.manifest}`, '--limit=250', '--prompt-profile=conservative',
        '--think=false', '--image-size=768', `--out=${path.join(base, 'benchmark')}`]);
      if (benchmark.selectedCount !== benchmark.sourceCount) throw Error('Benchmark limit omitted source records');
      if (benchmark.experiment?.modelDigest !== qwen.digest) throw Error('Classifier model changed during job');
      const benchmarkReport = await output(path.join(benchmark.out, 'report.json'));
      const receiptOutputs: Record<string, Output> = {};
      const transientReceipts: string[] = [];
      for (const receipt of benchmark.receipts) {
        if (!receipt.key || !/^[a-f0-9]{64}$/.test(receipt.key)) throw Error('Benchmark receipt missing or invalid');
        const file = path.join(benchmark.out, 'receipts', `${receipt.key}.json`);
        receiptOutputs[`receipt:${receipt.key}`] = await output(file);
        const full = await readJson(file);
        if (receipt.status === 'error' && transient(Error(full.error?.message ?? `Local Ollama chat HTTP ${full.httpStatus}`)))
          transientReceipts.push(full.error?.message ?? `Local Ollama chat HTTP ${full.httpStatus}`);
      }
      if (transientReceipts.length) throw Error(`Transient classifier receipts: ${transientReceipts.join('; ')}`);
      const proposalErrors = benchmark.receipts.filter((receipt: any) => receipt.status !== 'ok' || !receipt.schema?.valid)
        .map((receipt: any) => `classifier:${receipt.elevationId}:${receipt.status}`);
      const segmentationDir = path.join(base, 'segmentation');
      await exec(path.join(modelCache, 'venv/bin/python'), ['scripts/roofline-eval/segment.py', '--method=s1',
        `--model-dir=${modelDir}`, `--strips=${path.join(base, 'strips')}`, `--out=${segmentationDir}`, '--long-side=768'],
      { maxBuffer: 8 * 1024 * 1024 });
      const segmentation = await output(path.join(segmentationDir, 's1.provenance.json'));
      const provenance = await readJson(segmentation.path);
      const maskOutputs: Record<string, Output> = {};
      for (const record of provenance.records ?? []) {
        if (!record.mask || !record.maskSha256 || !/^masks\/s1\/[a-f0-9]{64}\.mask\.png$/.test(record.mask))
          throw Error('Invalid segmentation mask receipt');
        const mask = await output(path.join(segmentationDir, record.mask));
        if (mask.sha256 !== record.maskSha256) throw Error('Segmentation mask hash mismatch');
        maskOutputs[`mask:${record.mask}`] = mask;
      }
      const wallColoursFile = path.join(base, 'wall-colours.json');
      await exec(process.execPath, ['--import', 'tsx', script, `--manifest=${job.manifest}`,
        `--masks=${path.join(segmentationDir, 'masks/s1')}`, `--out=${wallColoursFile}`], { maxBuffer: 8 * 1024 * 1024 });
      const wallColours = await output(wallColoursFile);
      return { outputs: { strips, benchmark: benchmarkReport, segmentation, wallColours,
        ...sourceOutputs, ...receiptOutputs, ...maskOutputs }, proposalErrors };
    }
  };
  return schedule({ run, watch, retryFailed: args.includes('--retry-failed'),
    maxBatches: integer(args, 'max-batches', 44, 1, 44), maxHours: integer(args, 'max-hours', 8, 1, 8) }, deps);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
