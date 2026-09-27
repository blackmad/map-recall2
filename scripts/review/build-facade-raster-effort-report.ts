/** Publish the isolated raster/vector and agent-effort trials; never changes game data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const base = path.resolve('.cache/facade-assessment');
const out = path.resolve('public/data/facade-review-galleries/raster-effort-v1');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const esc = (s: unknown) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const manifest = JSON.parse(await fs.readFile(path.join(base, 'vector-inputs-v1/manifest.json'), 'utf8'));
const summary: unknown[] = [];
const review = JSON.parse(await fs.readFile('review-data/facade-vector-pilot/raster-effort-review.json', 'utf8'));
await fs.mkdir(out, { recursive: true });
let html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facade raster and GPT effort trials</title><style>body{font:16px system-ui;background:#f7f4ec;color:#24322c;margin:24px}h1{font-size:28px}article{background:white;border-radius:12px;padding:20px;margin:28px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}figure{margin:0;min-width:0}img{width:100%;height:550px;object-fit:contain;background:#eeeae1}p,figcaption{overflow-wrap:anywhere}a{color:#285c48}small{display:block}details{margin:15px 0}@media(max-width:700px){body{margin:10px}.grid{grid-template-columns:1fr 1fr}article{padding:10px}img{height:330px}}@media(max-width:420px){.grid{grid-template-columns:1fr}img{height:500px}}</style><h1>Facade raster → SVG and GPT effort trials</h1><p>Three diagnostic photos, not an accuracy benchmark. All results are unaccepted source-space studies: building ownership and world registration remain unresolved.</p><p><strong>Raster arm:</strong> built-in image generation with photo-specific, visually informed prompts, then local VTracer with 32-colour quantization. Image generation model, token usage and dollar cost were not exposed by the tool. Tracing time below excludes generation and preprocessing.</p><p><strong>GPT arm:</strong> GPT-6 Luna agents at low, medium and high effort, same shared prompt and original photos, one initial SVG per image without revision. These are qualitative agent sessions, not isolated metered API calls; cost and per-image inference latency are unavailable. Separate native-pixel coordinates avoid the earlier anisotropic arch renderer bug. Three examples and one attempt per condition cannot establish an effort ranking.</p><p>Raster prompts contain building-specific observations; the GPT prompt is generic. This comparison explores workflows, not a controlled model-versus-model contest. Generated images may shift geometry or invent obscured features. Vector tracing preserves those mistakes and produces paths without window/door semantics.</p><p><a href="review.json">Visual review</a> · <a href="summary.json">Artifact receipts</a> · <a href="gpt-prompt.txt">Shared GPT prompt</a> · <a href="../vector-pilot-renderer-fix-v2/index.html">Earlier six-model comparison</a></p>`;
await fs.copyFile(path.join(base, 'gpt-effort-agent-v1/prompt.txt'), path.join(out, 'gpt-prompt.txt'));
for (const index of [0, 17, 80]) {
  const id = String(index).padStart(3, '0');
  const entry = manifest.entries.find((e: { index: number }) => e.index === index);
  const source = await fs.readFile(path.join(base, 'vector-inputs-v1', entry.imagePath));
  if (sha(source) !== entry.imageSha256) throw Error(`Source changed: ${index}`);
  await fs.writeFile(path.join(out, `${id}-source.jpg`), source);
  const raster = await fs.readFile(path.join(base, 'raster-vector-v1', `${id}-generated.png`));
  await fs.writeFile(path.join(out, `${id}-raster.png`), raster);
  await fs.copyFile(path.join(base, 'raster-vector-v1', index === 0 ? 'prompt.txt' : `${id}-prompt.txt`), path.join(out, `${id}-raster-prompt.txt`));
  const vectorRoot = path.join(base, 'raster-vector-v1', `${id}-vtracer-q32`);
  const receipt = JSON.parse(await fs.readFile(path.join(vectorRoot, 'receipt.json'), 'utf8'));
  if (receipt.source.sha256 !== sha(raster)) throw Error(`Raster changed: ${index}`);
  for (const [key, name] of [['svg', `${id}-trace.svg`], ['rendered', `${id}-trace.png`]] as const) {
    const data = await fs.readFile(path.join(vectorRoot, receipt[key].path));
    if (sha(data) !== receipt[key].sha256) throw Error(`Trace changed: ${index}`);
    await fs.writeFile(path.join(out, name), data);
  }
  const panels = [
    { file: `${id}-source.jpg`, label: 'Original photograph', link: '' },
    { file: `${id}-raster.png`, label: 'Generated raster · geometry may drift', link: `<a href="${id}-raster-prompt.txt">Prompt</a>` },
    { file: `${id}-trace.png`, label: `Traced SVG · ${receipt.svg.pathCount} paths · ${(receipt.svg.bytes / 1024).toFixed(0)} KiB · ${receipt.tool.elapsedSeconds.toFixed(2)}s tracing`, link: `<a href="${id}-trace.svg">SVG</a>` },
  ];
  const agents = [];
  for (const effort of ['low', 'medium', 'high']) {
    const svg = await fs.readFile(path.join(base, 'gpt-effort-agent-v1', effort, `${id}.svg`));
    // Publish inert PNG previews; do not embed model-generated SVG in the page DOM.
    const png = await sharp(svg).png().toBuffer();
    await fs.writeFile(path.join(out, `${id}-${effort}.png`), png);
    const notes = JSON.parse(await fs.readFile(path.join(base, 'gpt-effort-agent-v1', effort, 'notes.json'), 'utf8'));
    agents.push({ model: 'gpt-6-luna', effort, svgSha256: sha(svg), pngSha256: sha(png), notes, mode: 'agent-session', costUsd: null });
    panels.push({ file: `${id}-${effort}.png`, label: `GPT-6 Luna · ${effort} effort`, link: '' });
  }
  const finding = review.effortReview[`source${index}`];
  html += `<article><h2>Source ${index} · ${esc(entry.buildingId)}</h2><p><strong>Visual review:</strong> ${esc(finding?.finding ?? 'Pending review')}</p><div class="grid">${panels.map(p => `<figure><img src="${p.file}" alt="${esc(p.label)} for source ${index}" loading="lazy"><figcaption>${esc(p.label)}<small>${p.link}</small></figcaption></figure>`).join('')}</div></article>`;
  const contact = await Promise.all(panels.map(p => sharp(path.join(out, p.file)).resize(300, 500, { fit: 'contain', background: '#eeeae1' }).png().toBuffer()));
  await sharp({ create: { width: 1800, height: 500, channels: 3, background: '#fff' } }).composite(contact.map((input, i) => ({ input, left: i * 300, top: 0 }))).png().toFile(path.join(out, `${id}-contact.png`));
  summary.push({ index, sourceSha256: sha(source), rasterSha256: sha(raster), rasterMode: 'built-in-imagegen', rasterCostUsd: null, vectorReceipt: receipt, agents });
}
html += '</html>';
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
await fs.copyFile('review-data/facade-vector-pilot/raster-effort-review.json', path.join(out, 'review.json'));
console.log(JSON.stringify({ out, sources: summary.length }));
