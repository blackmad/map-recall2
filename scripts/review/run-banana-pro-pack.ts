/** Five bounded Nano Banana Pro facade-pack trials. Dry-run unless --run is explicit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import sharp from 'sharp';
import {globalBudget} from '../da-costa-block/global-budget.mjs';

const root = path.resolve('.cache/facade-assessment/banana-pro-pack-v1');
const inputRoot = path.join(root, 'inputs');
const model = 'google/gemini-3-pro-image';
const provider = 'google-ai-studio/global';
const jobs = ['single0', 'single80', 'sheet1k', 'sheet2k', 'panorama1k'] as const;
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const save = async (file: string, value: unknown) => {
  await fs.writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(`${file}.tmp`, file);
};
const oldUnknown = 'request:068099f48543ee8fad1e83e3db344e72d3c28aeec9c35cb0f3e2410e38121068';
const basePrompt = 'Transform the supplied photograph into a flat-colour architectural drawing in the same framing. Preserve only the photographed architecture: exact visible opening count, ordering, relative positions and proportions, entrance location, roof outline, wall colour families, and material bands. Keep lintels, arches, openings and doors distinct. Remove transient cars, people, wires and vegetation only where the wall behind them is unambiguous; leave uncertain hidden areas as plain neutral shapes. Use clean flat colour fills and simple outlines without texture, stylization, beautification, extra floors, invented windows, invented doors, invented balconies, or invented text. No labels or explanatory marks.';
const promptFor = (job: typeof jobs[number]) => `${basePrompt}\n${job.startsWith('single')
  ? 'Place this one complete front-facing facade on a white-padded 9:16 canvas. Do not crop or stretch the facade to fill the canvas.'
  : job.startsWith('sheet')
    ? 'The input is a contact sheet. Preserve every cell independently in exactly the same grid, order, cell bounds, white gutters and margins. Transform each cell without joining or swapping buildings. Keep the output as one contact sheet.'
    : 'The input is a panorama/context image. Preserve its existing camera perspective, receding street, roof and wall boundaries, and relative positions of visible facades. Do not rearrange them into an ideal front-on building strip or one invented building. The construction-fence/occluded area must remain plain and unknown rather than becoming an invented shopfront.'}`;

if (process.argv.slice(2).some(arg => arg !== '--run')) throw Error('Only --run is supported');
const run = process.argv.includes('--run');
const manifestBytes = await fs.readFile(path.join(inputRoot, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString());
if (manifest.version !== 1 || !manifest.inputs || Object.keys(manifest.inputs).sort().join(',') !== [...jobs].sort().join(','))
  throw Error('Expected exactly five version-1 input jobs');
const sourceManifestPath = path.resolve(manifest.sourceManifestPath);
if (sha(await fs.readFile(sourceManifestPath)) !== manifest.sourceManifestSha256)
  throw Error('Source manifest hash mismatch');
const prepared = [];
for (const job of jobs) {
  const item = manifest.inputs[job];
  if (!item || typeof item.path !== 'string' || item.path.includes('..') || path.isAbsolute(item.path) ||
      !Number.isSafeInteger(item.width) || !Number.isSafeInteger(item.height) ||
      !Array.isArray(item.sourceBindings) ||
      (job !== 'panorama1k' && item.sourceBindings.length === 0) ||
      !['1:1', '9:16', '16:9', '3:2', '2:3', '4:3', '3:4'].includes(item.aspectRatio) ||
      item.resolution !== (job === 'sheet2k' ? '2K' : '1K') ||
      (job.startsWith('single') && item.aspectRatio !== '9:16') ||
      (job.startsWith('sheet') && item.aspectRatio !== '1:1')) throw Error(`Invalid ${job} input contract`);
  const bytes = await fs.readFile(path.join(inputRoot, item.path));
  const info = await sharp(bytes).metadata();
  if (sha(bytes) !== item.sha256 || info.width !== item.width || info.height !== item.height ||
      !['png', 'jpeg'].includes(info.format ?? '')) throw Error(`${job} image changed`);
  for (const binding of item.sourceBindings) {
    if (!Number.isSafeInteger(binding.index) || typeof binding.buildingId !== 'string' ||
        typeof binding.sourcePath !== 'string' || typeof binding.sourceSha256 !== 'string' ||
        sha(await fs.readFile(path.resolve(binding.sourcePath))) !== binding.sourceSha256)
      throw Error(`${job} source binding changed`);
  }
  if (job === 'panorama1k') {
    const binding = item.panoramaBinding;
    if (item.sourceBindings.length !== 0 || !binding ||
        typeof binding.sourcePath !== 'string' || typeof binding.sourceSha256 !== 'string' ||
        typeof binding.sourceManifestPath !== 'string' ||
        sha(await fs.readFile(path.resolve(binding.sourcePath))) !== binding.sourceSha256 ||
        sha(await fs.readFile(path.resolve(binding.sourceManifestPath))) !== binding.sourceManifestSha256 ||
        binding.sourceManifestSha256 !== manifest.panoramaSourceManifestSha256 ||
        path.resolve(binding.sourceManifestPath) !== path.resolve(manifest.panoramaSourceManifestPath))
      throw Error('Panorama source binding changed');
  }
  const prompt = promptFor(job);
  prepared.push({job, item, bytes, mime: info.format === 'png' ? 'image/png' : 'image/jpeg', prompt,
    promptSha256: sha(prompt), inputSha256: sha(bytes)});
}
const sheet1k = prepared.find(entry => entry.job === 'sheet1k')!;
const sheet2k = prepared.find(entry => entry.job === 'sheet2k')!;
if (sheet1k.inputSha256 !== sheet2k.inputSha256 ||
    JSON.stringify(sheet1k.item.sourceBindings) !== JSON.stringify(sheet2k.item.sourceBindings))
  throw Error('Sheet 1K and 2K must have identical input pixels and source bindings');
const oldAuth = JSON.parse(await fs.readFile('.cache/facade-assessment/vector-pilot/authorization.json', 'utf8'));
const authorization = {...oldAuth, scopedContinuation: {
  id: 'nano-pro-pack-five-2026-09-27',
  source: 'User requested Nano Banana Pro single-facade, packed-sheet and panorama trials.',
  maxNewReservationsUsd: 1.10, maxRequests: 5, acknowledgedUnknownIds: [oldUnknown],
}};
const experiment = {version: 1, model, provider, endpoint: 'https://openrouter.ai/api/v1/images',
  manifestSha256: sha(manifestBytes), sourceManifestSha256: manifest.sourceManifestSha256,
  runnerSha256: sha(await fs.readFile(new URL(import.meta.url))),
  unitReservationUsd: 0.22, maxRequests: 5, maxNewReservationsUsd: 1.10, imagesPerRequest: 1,
  jobs: prepared.map(({job, item, inputSha256, promptSha256}) => ({job, inputSha256, promptSha256,
    aspectRatio: item.aspectRatio, resolution: item.resolution, sourceBindings: item.sourceBindings,
    panoramaBinding: item.panoramaBinding ?? null})),
  note: 'Generic architectural prompt across jobs, with framing suffix only. Pro aspect/output differ from prior Lite. Five calls maximum, no retries. Old unknown charge remains reserved.'};
const experimentHash = sha(JSON.stringify(experiment));
if (!run) {
  console.log(JSON.stringify({experimentHash, experiment, mode: 'plan-no-paid-call'}, null, 2));
  process.exit(0);
}
dotenv.config({path: '.cache/facade-rebuild/openrouter-private.env', quiet: true});
if (!process.env.OPENROUTER_API_KEY) throw Error('Missing OpenRouter credential');
const budget = globalBudget({ceiling: oldAuth.maxCeilingUsd, authorization, acknowledgedUnknownIds: [oldUnknown]});
const response = await fetch(`https://openrouter.ai/api/v1/images/models/${model}/endpoints`, {signal: AbortSignal.timeout(20000)});
if (!response.ok) throw Error('Cannot verify Pro model endpoints');
const catalog = await response.json();
const selected = catalog.endpoints?.find((endpoint: {provider_tag: string}) => endpoint.provider_tag === provider);
if (!selected || selected.supported_parameters?.n?.max !== 1 ||
    !prepared.every(({item}) => selected.supported_parameters?.resolution?.values?.includes(item.resolution) &&
      selected.supported_parameters?.aspect_ratio?.values?.includes(item.aspectRatio)) ||
    !selected.pricing?.some((price: {billable: string; unit: string; cost_usd: number}) =>
      price.billable === 'output_image' && price.unit === 'token' && price.cost_usd <= 0.00012))
  throw Error('Pro provider capability or price changed');
await fs.mkdir(root, {recursive: true});
await save(path.join(root, 'endpoints.json'), catalog);
try {
  const old = JSON.parse(await fs.readFile(path.join(root, 'experiment.json'), 'utf8'));
  if (old.experimentHash !== experimentHash) throw Error('Experiment changed; preserve receipts and use a new version');
} catch (error: any) {
  if (error.code !== 'ENOENT') throw error;
  await save(path.join(root, 'experiment.json'), {experimentHash, experiment, authorization});
}
for (const {job, item, bytes, mime, prompt, promptSha256, inputSha256} of prepared) {
  const file = path.join(root, `${job}.json`);
  try {
    const old = JSON.parse(await fs.readFile(file, 'utf8'));
    if (old.experimentHash !== experimentHash || old.status !== 'ok' ||
        sha(await fs.readFile(path.join(root, old.pngPath))) !== old.pngSha256)
      throw Error(`${job} has unfinished/changed request; inspect instead of retrying`);
    console.log(JSON.stringify({job, status: 'reused', costUsd: old.actualCostUsd}));
    continue;
  } catch (error: any) {if (error.code !== 'ENOENT') throw error;}
  const key = sha(JSON.stringify({experimentHash, job}));
  const reservation = await budget.reserve({key, sourceLedger: file, reservedUsd: 0.22,
    metadata: {model, job, experiment: 'banana-pro-pack-v1'}});
  const receipt: any = {job, model, provider, experimentHash, key, reservation, inputSha256, promptSha256,
    prompt, aspectRatio: item.aspectRatio, resolution: item.resolution, sourceBindings: item.sourceBindings,
    panoramaBinding: item.panoramaBinding ?? null,
    status: 'requesting', startedAt: new Date().toISOString()};
  await save(file, receipt);
  const start = performance.now();
  try {
    const result = await fetch(experiment.endpoint, {
      method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`},
      signal: AbortSignal.timeout(240000),
      body: JSON.stringify({model, prompt, n: 1, resolution: item.resolution, aspect_ratio: item.aspectRatio,
        provider: {only: [provider], allow_fallbacks: false},
        input_references: [{type: 'image_url', image_url: {url: `data:${mime};base64,${bytes.toString('base64')}`}}]}),
    });
    receipt.httpStatus = result.status;
    receipt.requestId = result.headers.get('x-request-id');
    await save(file, receipt);
    const raw = await result.text();
    await fs.writeFile(path.join(root, `${job}-response.json`), raw);
    receipt.rawResponseSha256 = sha(raw);
    const data = JSON.parse(raw);
    receipt.clientLatencyMs = Math.round(performance.now() - start);
    receipt.usage = data.usage;
    receipt.generationId = data.id ?? null;
    let cost = data.usage?.cost;
    if (!result.ok && !data.id && [400, 401, 402, 403, 404, 422, 429].includes(result.status)) cost = 0;
    receipt.settlement = await budget.settle(reservation, cost, {generationId: receipt.generationId});
    receipt.actualCostUsd = cost;
    await save(file, receipt);
    if (!result.ok) throw Error(`Image API HTTP ${result.status}: ${JSON.stringify(data.error)}`);
    if (!Number.isFinite(cost) || cost > 0.22 || receipt.settlement.exceededCeiling || receipt.settlement.exceededContinuation)
      throw Error('Unknown or excessive charge; stop');
    if (data.data?.length !== 1 || !data.data[0]?.b64_json) throw Error('Expected exactly one generated image');
    const image = Buffer.from(data.data[0].b64_json, 'base64');
    const info = await sharp(image).metadata();
    if (!info.width || !info.height || info.width * info.height > 9_000_000) throw Error('Unexpected image dimensions');
    const png = await sharp(image).png().toBuffer();
    receipt.pngPath = `${job}.png`;
    await fs.writeFile(path.join(root, receipt.pngPath), png);
    receipt.pngSha256 = sha(png);
    receipt.width = info.width;
    receipt.height = info.height;
    receipt.status = 'ok';
  } catch (error: any) {
    receipt.status = 'failed';
    receipt.error = error.message;
    receipt.clientLatencyMs ??= Math.round(performance.now() - start);
    if (!receipt.settlement) receipt.settlement = await budget.settle(reservation, undefined, {generationId: receipt.generationId});
    await save(file, receipt);
    throw Error(`${job} failed; no automatic retry: ${receipt.error}`);
  }
  await save(file, receipt);
  console.log(JSON.stringify({job, status: receipt.status, actualCostUsd: receipt.actualCostUsd,
    clientLatencyMs: receipt.clientLatencyMs, width: receipt.width, height: receipt.height}));
}
