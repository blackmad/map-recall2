/** Diagnostic only: compare image routing cost/latency; never publish appearance records. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import dotenv from 'dotenv';

const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
dotenv.config({ path: arg('env-file', '.env'), quiet: true });
const provider = arg('provider', 'ollama');
const source = path.resolve(arg('source', 'public/canal-drive/facade-photo-review/local/dino-base-city-variety-raw-01'));
const out = path.resolve(arg('out', `.cache/facade-rebuild/appearance-routing-benchmark/${provider}`));
const models = arg('models', provider === 'ollama' ? 'qwen2.5vl:7b,gemma3:4b' : 'qwen/qwen3-vl-8b-instruct,google/gemini-2.5-flash-lite,google/gemini-3.1-flash-lite').split(',');
const sizes = arg('sizes', '512,1024').split(',').map(Number);
const limit = Number(arg('limit', '10'));
const indices = arg('indices', '').split(',').filter(Boolean).map(Number);
const ceiling = Math.min(1, Number(arg('budget-usd', '1')), Number(process.env.OPENROUTER_SPEND_LIMIT_USD || 1));
const dryRun = process.argv.includes('--dry-run');
const promptVersion = arg('prompt-version', 'v1');
const maxOutputTokens = Number(arg('max-output-tokens', '350'));
const reasoningEffort = arg('reasoning-effort', 'none');
if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 100 || maxOutputTokens > 4096 || !['none', 'minimal', 'low', 'medium'].includes(reasoningEffort)) throw Error('Invalid output or reasoning budget');
if (!['v1', 'v2'].includes(promptVersion)) throw Error('Invalid prompt version');
if (!['ollama', 'openrouter'].includes(provider) || !Number.isFinite(ceiling) || ceiling <= 0 || !Number.isInteger(limit) || limit < 1 || sizes.some(s => !Number.isInteger(s) || s < 128 || s > 1024)) throw Error('Invalid provider, budget, limit or image size');
if (!dryRun && provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) throw Error('OPENROUTER_API_KEY unavailable; use --env-file=PATH (never put a token in CLI arguments)');
const fields = {
  family: ['historic-narrow', 'apartment-row', 'institutional', 'modern', 'warehouse-workshop', 'other', 'unknown'],
  wallMaterial: ['brick', 'plaster', 'stone', 'concrete', 'panels', 'glass', 'mixed', 'unknown'],
  wallColour: ['brown', 'red', 'buff', 'grey', 'white', 'black', 'other', 'unknown'],
  openingLayout: ['regular', 'irregular', 'sparse', 'unknown'],
  shopfront: ['yes', 'no', 'unknown'], sign: ['yes', 'no', 'unknown'], awning: ['yes', 'no', 'unknown'],
  occlusion: ['low', 'partial', 'severe', 'unknown'],
};
const schema = { type: 'object', additionalProperties: false, required: Object.keys(fields), properties: Object.fromEntries(Object.entries(fields).map(([k, values]) => [k, { type: 'string', enum: values }])) };
const basePrompt = 'Inspect only the central facade in this Amsterdam street-photo crop. Return the required JSON. Architectural family and commercial ground floor are independent: a historic house may contain a shop. Describe dominant upper-wall material/colour, not window glass or shop paint. A sign means mounted readable-looking lettering, not proof of tenant identity; do not transcribe. An awning means a projecting fabric canopy, not a cornice. Use unknown if the relevant region is cropped, too dark or occluded; no means visibly absent. Judge visible opening regularity without inventing hidden windows. No explanation or confidence score.';
const prompt = basePrompt + (promptVersion === 'v2' ? ' Family definitions: historic-narrow is a narrow traditional house, not any brick building; warehouse-workshop includes broad garages and industrial glazing; modern includes contemporary flat cladding; institutional includes monumental church-like facades. For occlusion assess the SHOWN wall only: low = mostly unobstructed; partial = some blocked by vehicles, trees or stalls; severe = most blocked; unknown = cannot judge. Cropping off a roof does not itself make occlusion unknown. Shopfront means a commercial display/entrance at street level, even when the tenant name cannot be read. Registry dimensions below describe the selected wall, not necessarily the whole architectural complex; use as a check, never as proof of style.' : '');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await fs.readFile(path.join(source, 'manifest.json'));
const allRecords = JSON.parse(manifestBytes).records;
if (indices.some(i => !Number.isInteger(i) || i < 0 || i >= allRecords.length)) throw Error('Invalid source index');
const records = (indices.length ? indices.map(i => allRecords[i]) : allRecords).slice(0, limit);
const config = { provider, models, sizes, limit, indices, promptVersion, source, sourceManifestSha256: hash(manifestBytes), prompt, schema, imageEncoding: 'sharp-fit-inside-no-upscale-jpeg-quality85', maxOutputTokens, reasoningEffort, budgetUsd: ceiling };
await fs.mkdir(out, { recursive: true });
const configHash = hash(JSON.stringify(config));
const reportPath = path.join(out, 'report.json');
let report = { schemaVersion: 1, config, configHash, startedAt: new Date().toISOString(), results: [], policy: 'Development proposals only. No identity certification, ground truth, calibrated confidence, or production acceptance.' };
try { const prior = JSON.parse(await fs.readFile(reportPath)); if (prior.configHash !== configHash) throw Error('Output directory has a different experiment; choose a new --out'); report = prior; } catch (e) { if (e.code !== 'ENOENT') throw e; }
const save = async () => { report.updatedAt = new Date().toISOString(); await fs.writeFile(`${reportPath}.tmp`, JSON.stringify(report, null, 2) + '\n'); await fs.rename(`${reportPath}.tmp`, reportPath); };
let catalog;
if (provider === 'openrouter' && !dryRun) {
  const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw Error(`Model catalog HTTP ${response.status}`);
  catalog = (await response.json()).data;
  report.pricesCheckedAt = new Date().toISOString();
  report.modelPrices = Object.fromEntries(models.map(id => { const m = catalog.find(m => m.id === id); if (!m?.architecture?.input_modalities?.includes('image')) throw Error(`Unavailable vision model: ${id}`); return [id, m.pricing]; }));
}
let spent = report.results.reduce((sum, r) => sum + (r.usage?.cost ?? r.reservedUsd ?? 0), 0);
// Keep a local model loaded across its whole sample, avoiding model swaps per image.
for (const model of models) {
 for (const record of records) {
  const bytes = await fs.readFile(path.join(source, record.image));
  if (hash(bytes) !== record.sourceSha256) throw Error(`Source changed: ${record.image}`);
  for (const size of sizes) {
    const { data: image, info } = await sharp(bytes).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      const id = `${record.id}:${size}:${model}`;
      if (report.results.some(r => r.id === id)) continue;
      const result = { id, target: record.source.pandId, sourceSha256: record.sourceSha256, cropSha256: hash(image), requestedSize: size, width: info.width, height: info.height, bytes: image.length, model };
      if (dryRun) { console.log(JSON.stringify({ ...result, dryRun: true })); continue; }
      if (provider === 'openrouter') {
        const prices = report.modelPrices[model];
        // 32K input reservation greatly exceeds a <=1024px crop and this small schema.
        // Stop after unknown charges instead of treating absent usage as free.
        const tiers = [prices, ...(prices.overrides || []).filter(p => p.min_prompt_tokens <= 32768)];
        const inputPrice = Math.max(...tiers.map(p => Number(p.prompt || prices.prompt)));
        const outputPrice = Math.max(...tiers.map(p => Number(p.completion || prices.completion)));
        result.reservedUsd = inputPrice * 32768 + outputPrice * maxOutputTokens + Number(prices.request || 0) + Number(prices.image || 0);
        if (!Number.isFinite(result.reservedUsd) || result.reservedUsd <= 0 || spent + result.reservedUsd > ceiling) throw Error('Local budget reservation would exceed spend ceiling');
        result.status = 'pending'; report.results.push(result); await save();
      }
      const started = performance.now();
      try {
        const modelInfo = catalog?.find(m => m.id === model);
        // Mandatory-thinking models cannot disable reasoning. Give teacher runs an
        // explicit output budget (including thinking) and record the setting.
        const reasoning = reasoningEffort === 'none'
          ? (modelInfo?.reasoning?.mandatory ? { effort: 'low' } : { enabled: false })
          : { effort: reasoningEffort };
        const inputPrompt = prompt + (promptVersion === 'v2' ? ` Registry: ${JSON.stringify({ selectedWallWidthM: record.source.wallWidthM, selectedWallHeightM: Number((record.source.topZ - record.source.groundZ).toFixed(2)), constructionYear: record.source.constructionYear })}` : '');
        const body = provider === 'ollama'
          ? { model, stream: false, format: schema, keep_alive: '10m', options: { temperature: 0, num_predict: maxOutputTokens, num_ctx: 2048 }, messages: [{ role: 'user', content: inputPrompt, images: [image.toString('base64')] }] }
          : { model, temperature: 0, max_tokens: maxOutputTokens, ...(modelInfo.supported_parameters.includes('reasoning') ? { reasoning } : {}), provider: { require_parameters: true, sort: 'price', max_price: { prompt: Number(report.modelPrices[model].prompt) * 1e6, completion: Number(report.modelPrices[model].completion) * 1e6, request: Number(report.modelPrices[model].request || 0), image: Number(report.modelPrices[model].image || 0) } }, response_format: { type: 'json_schema', json_schema: { name: 'appearance_routing', strict: true, schema } }, messages: [{ role: 'user', content: [{ type: 'text', text: inputPrompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } }] }] };
        const response = await fetch(provider === 'ollama' ? 'http://127.0.0.1:11434/api/chat' : 'https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', signal: AbortSignal.timeout(90_000), headers: { 'content-type': 'application/json', ...(provider === 'openrouter' ? { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } : {}) }, body: JSON.stringify(body),
        });
        const value = await response.json();
        if (!response.ok) throw Error(`HTTP ${response.status}`); // Do not echo provider errors that could contain input.
        result.usage = provider === 'ollama' ? { promptTokens: value.prompt_eval_count, completionTokens: value.eval_count, loadSeconds: value.load_duration / 1e9, promptSeconds: value.prompt_eval_duration / 1e9, outputSeconds: value.eval_duration / 1e9, cost: 0 } : value.usage;
        result.finishReason = value.done_reason ?? value.choices?.[0]?.finish_reason;
        result.raw = value.message?.content ?? value.choices?.[0]?.message?.content ?? '';
        result.label = JSON.parse(result.raw);
        if (Object.keys(result.label).length !== Object.keys(fields).length || Object.entries(fields).some(([k, values]) => !values.includes(result.label[k]))) throw Error('Invalid routing schema');
        result.status = 'ok';
      } catch (e) { result.status = 'error'; result.error = e.name === 'TimeoutError' ? 'Timeout after 90 seconds' : e.message; }
      result.elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
      if (provider === 'ollama') report.results.push(result);
      spent += result.usage?.cost ?? result.reservedUsd ?? 0;
      report.observedOrReservedCostUsd = spent;
      await save();
      console.log(JSON.stringify({ target: result.target, size, model, status: result.status, seconds: result.elapsedSeconds, usage: result.usage, label: result.label }));
      if (provider === 'openrouter' && !Number.isFinite(result.usage?.cost)) throw Error('Provider charge unknown; stopped with reservation retained');
    }
  }
}
if (!dryRun) { report.completedAt = new Date().toISOString(); await save(); }
