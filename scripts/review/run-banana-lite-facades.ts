/** Three explicitly requested Nano Banana Lite reference-photo trials; no game writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { globalBudget } from '../da-costa-block/global-budget.mjs';

const root = path.resolve('.cache/facade-assessment/banana-lite-v1');
const sourceRoot = path.resolve('.cache/facade-assessment/vector-inputs-v1');
const model = 'google/gemini-3.1-flash-lite-image';
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const save = async (file: string, value: unknown) => {
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  await fs.rename(file + '.tmp', file);
};
if (process.argv.slice(2).some(x => x !== '--run')) throw Error('Only --run is supported');
await fs.mkdir(root, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(sourceRoot, 'manifest.json'), 'utf8'));
const oldAuth = JSON.parse(await fs.readFile('.cache/facade-assessment/vector-pilot/authorization.json', 'utf8'));
const oldUnknown = 'request:068099f48543ee8fad1e83e3db344e72d3c28aeec9c35cb0f3e2410e38121068';
const authorization = {
  ...oldAuth,
  scopedContinuation: {
    id: 'nano-lite-3-source-2026-09-27', source: "User: let's see how lite does",
    maxNewReservationsUsd: 0.60, maxRequests: 3, acknowledgedUnknownIds: [oldUnknown],
  },
};
const provider = 'google-ai-studio';
const entries = [];
for (const index of [0, 17, 80]) {
  const id = String(index).padStart(3, '0');
  const entry = manifest.entries.find((x: {index: number}) => x.index === index);
  const photo = await fs.readFile(path.join(sourceRoot, entry.imagePath));
  if (sha(photo) !== entry.imageSha256) throw Error('Source hash mismatch');
  // Preserve exact prior prompt bytes (including its trailing newline).
  const prompt = await fs.readFile(path.join('.cache/facade-assessment/raster-vector-v1', index === 0 ? 'prompt.txt' : `${id}-prompt.txt`), 'utf8');
  entries.push({ index, id, photo, prompt, sourceSha256: sha(photo), promptSha256: sha(prompt), aspectRatio: index === 17 ? '1:1' : '1:4' });
}
const experiment = {
  version: 1, model, endpoint: 'https://openrouter.ai/api/v1/images', provider,
  resolution: '1K', imagesPerRequest: 1, unitReservationUsd: 0.20,
  maxRequests: 3, maxNewReservationsUsd: 0.60,
  sourceAndPromptHashes: entries.map(({index, sourceSha256, promptSha256, aspectRatio}) => ({index, sourceSha256, promptSha256, aspectRatio})),
  runnerSha256: sha(await fs.readFile(new URL(import.meta.url))),
  note: 'Identical photo/prompt to built-in raster trial; explicit Lite 1K/allowed aspect ratio differs from earlier opaque tool output size. Old unknown charge remains unknown and reserved. No automatic retries.',
};
const experimentHash = sha(JSON.stringify(experiment));
if (!process.argv.includes('--run')) {
  console.log(JSON.stringify({ ...experiment, experimentHash, mode: 'plan-no-paid-call' }, null, 2));
  process.exit(0);
}
dotenv.config({ path: '.cache/facade-rebuild/openrouter-private.env', quiet: true });
if (!process.env.OPENROUTER_API_KEY) throw Error('Missing OpenRouter credential');
const budget = globalBudget({ ceiling: oldAuth.maxCeilingUsd, authorization, acknowledgedUnknownIds: [oldUnknown] });
// Re-read public provider capabilities immediately before the experiment.
const catalogResponse = await fetch(`https://openrouter.ai/api/v1/images/models/${model}/endpoints`, {signal: AbortSignal.timeout(20000)});
if (!catalogResponse.ok) throw Error('Cannot verify model endpoints');
const catalog = await catalogResponse.json();
const selected = catalog.endpoints?.find((x: {provider_tag: string}) => x.provider_tag === provider);
if (!selected?.supported_parameters?.resolution?.values?.includes('1K') || selected.supported_parameters?.n?.max !== 1 ||
    !selected.pricing?.some((p: {billable:string;unit:string;cost_usd:number}) => p.billable === 'output_image' && p.unit === 'token' && p.cost_usd <= 0.00003))
  throw Error('Provider image limits/pricing changed');
await save(root + '/endpoints.json', catalog);
try {
  const old = JSON.parse(await fs.readFile(root + '/experiment.json', 'utf8'));
  if (old.experimentHash !== experimentHash) throw Error('Experiment changed; preserve receipts and use a reviewed new version');
} catch (e: any) {
  if (e.code !== 'ENOENT') throw e;
  await save(root + '/experiment.json', { experimentHash, experiment, authorization });
}
for (const e of entries) {
  const file = root + `/${e.id}.json`;
  try {
    const old = JSON.parse(await fs.readFile(file, 'utf8'));
    if (old.experimentHash !== experimentHash || old.status !== 'ok') throw Error('Unfinished/changed request; inspect instead of retrying');
    if (sha(await fs.readFile(path.join(root, old.pngPath))) !== old.pngSha256) throw Error('Saved image changed');
    console.log(JSON.stringify({ index: e.index, status: 'reused', cost: old.actualCostUsd }));
    continue;
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const key = sha(JSON.stringify({ experimentHash, index: e.index }));
  const reservation = await budget.reserve({ key, sourceLedger: file, reservedUsd: 0.20, metadata: { model, index: e.index, experiment: 'banana-lite-v1' } });
  const receipt: any = { index: e.index, model, experimentHash, key, reservation, sourceSha256: e.sourceSha256, promptSha256: e.promptSha256,
    prompt: e.prompt, aspectRatio: e.aspectRatio, resolution: '1K', provider, status: 'requesting', startedAt: new Date().toISOString() };
  await save(file, receipt);
  const start = performance.now();
  try {
    const response = await fetch(experiment.endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(240000),
      body: JSON.stringify({ model, prompt: e.prompt, n: 1, resolution: '1K', aspect_ratio: e.aspectRatio,
        provider: { only: [provider], allow_fallbacks: false },
        input_references: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${e.photo.toString('base64')}` } }] }),
    });
    receipt.httpStatus = response.status;
    receipt.requestId = response.headers.get('x-request-id');
    await save(file, receipt);
    const raw = await response.text();
    await fs.writeFile(root + `/${e.id}-response.json`, raw);
    receipt.rawResponseSha256 = sha(raw);
    const result = JSON.parse(raw);
    receipt.clientLatencyMs = Math.round(performance.now() - start);
    receipt.usage = result.usage;
    receipt.generationId = result.id ?? null;
    let cost = result.usage?.cost;
    if (!response.ok && !result.id && [400,401,402,403,404,422,429].includes(response.status)) cost = 0;
    receipt.settlement = await budget.settle(reservation, cost, {generationId: receipt.generationId});
    receipt.actualCostUsd = cost;
    await save(file, receipt);
    if (!response.ok) throw Error(`Image API HTTP ${response.status}: ${JSON.stringify(result.error)}`);
    if (!Number.isFinite(cost) || receipt.settlement.exceededCeiling || receipt.settlement.exceededContinuation || cost > 0.20) throw Error('Unknown or excessive charge; stop');
    if (result.data?.length !== 1 || !result.data[0]?.b64_json) throw Error('Expected exactly one image');
    const bytes = Buffer.from(result.data[0].b64_json, 'base64');
    const info = await sharp(bytes).metadata();
    if (!info.width || !info.height || info.width * info.height > 5_000_000) throw Error('Unexpected image dimensions');
    const png = await sharp(bytes).png().toBuffer();
    receipt.pngPath = `${e.id}.png`;
    await fs.writeFile(path.join(root, receipt.pngPath), png);
    receipt.pngSha256 = sha(png); receipt.width = info.width; receipt.height = info.height; receipt.status = 'ok';
  } catch (error: any) {
    receipt.status = 'failed'; receipt.error = error.message;
    receipt.clientLatencyMs ??= Math.round(performance.now() - start);
    if (!receipt.settlement) receipt.settlement = await budget.settle(reservation, undefined, {generationId: receipt.generationId});
    await save(file, receipt);
    throw Error(`Source ${e.index} failed; no automatic retry: ${receipt.error}`);
  }
  await save(file, receipt);
  console.log(JSON.stringify({index: e.index, status: receipt.status, costUsd: receipt.actualCostUsd, ms: receipt.clientLatencyMs, width: receipt.width, height: receipt.height}));
}
