/** Publish a source-bound, four-panel raster comparison; no game-data changes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const base = path.resolve('.cache/facade-assessment');
const liteDir = path.join(base, 'banana-lite-v1');
const out = path.resolve('public/data/facade-review-galleries/banana-lite-v1');
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const escapeHtml = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const manifest = JSON.parse(await fs.readFile(path.join(base, 'vector-inputs-v1/manifest.json'), 'utf8'));
const summaries: unknown[] = [];
const articles: string[] = [];

await fs.mkdir(out, {recursive: true});
for (const index of [0, 17, 80]) {
  const id = String(index).padStart(3, '0');
  const entry = manifest.entries.find((row: {index: number}) => row.index === index);
  if (!entry || entry.imagePath !== `${id}-image.jpg`) throw Error(`Missing prepared source ${id}`);
  const source = await fs.readFile(path.join(base, 'vector-inputs-v1', entry.imagePath));
  if (sha(source) !== entry.imageSha256) throw Error(`Prepared source changed for ${id}`);
  const sourceName = `${id}-source.jpg`;
  await fs.writeFile(path.join(out, sourceName), source);

  const oldRaster = await fs.readFile(path.join(base, 'raster-vector-v1', `${id}-generated.png`));
  const oldName = `${id}-builtin.png`;
  await fs.writeFile(path.join(out, oldName), oldRaster);
  const prompt = await fs.readFile(path.join(base, 'raster-vector-v1', index === 0 ? 'prompt.txt' : `${id}-prompt.txt`), 'utf8');
  await fs.writeFile(path.join(out, `${id}-prompt.txt`), prompt);

  const receipt = JSON.parse(await fs.readFile(path.join(liteDir, `${id}.json`), 'utf8'));
  if (receipt.status !== 'ok' || receipt.index !== index || receipt.sourceSha256 !== entry.imageSha256 ||
      receipt.prompt !== prompt || receipt.pngPath !== `${id}.png` ||
      typeof receipt.model !== 'string' || !receipt.model ||
      typeof receipt.pngSha256 !== 'string' ||
      typeof receipt.actualCostUsd !== 'number' || !Number.isFinite(receipt.actualCostUsd) || receipt.actualCostUsd < 0 ||
      typeof receipt.clientLatencyMs !== 'number' || !Number.isFinite(receipt.clientLatencyMs) || receipt.clientLatencyMs < 0 ||
      !Number.isSafeInteger(receipt.width) || !Number.isSafeInteger(receipt.height)) {
    throw Error(`Invalid or unbound Lite receipt for ${id}`);
  }
  const lite = await fs.readFile(path.join(liteDir, `${id}.png`));
  const liteInfo = await sharp(lite).metadata();
  if (sha(lite) !== receipt.pngSha256 || liteInfo.format !== 'png' ||
      liteInfo.width !== receipt.width || liteInfo.height !== receipt.height) throw Error(`Lite PNG changed for ${id}`);
  const liteName = `${id}-lite.png`;
  await fs.writeFile(path.join(out, liteName), lite);

  const traceDir = path.join(liteDir, `${id}-trace`);
  const trace = JSON.parse(await fs.readFile(path.join(traceDir, 'receipt.json'), 'utf8'));
  if (trace.source?.sha256 !== receipt.pngSha256 || trace.tool?.name !== 'vtracer-python')
    throw Error(`Trace not bound to Lite raster for ${id}`);
  const tracePng = await fs.readFile(path.join(traceDir, 'render.png'));
  const traceSvg = await fs.readFile(path.join(traceDir, 'facade.svg'));
  if (sha(tracePng) !== trace.rendered?.sha256 || sha(traceSvg) !== trace.svg?.sha256)
    throw Error(`Lite trace changed for ${id}`);
  const traceName = `${id}-lite-trace.png`, svgName = `${id}-lite-trace.svg`;
  await fs.writeFile(path.join(out, traceName), tracePng);
  await fs.writeFile(path.join(out, svgName), traceSvg);

  const panels = [
    {image: sourceName, title: 'Original source photo', detail: 'Prepared full crop; owner association unresolved', link: ''},
    {image: oldName, title: 'Earlier built-in generated raster', detail: 'Model and cost not exposed; automatic output size', link: `<a href="${id}-prompt.txt">Prompt</a>`},
    {image: liteName, title: 'Nano Banana 2 Lite raster', detail: `${receipt.width} × ${receipt.height} · $${receipt.actualCostUsd.toFixed(5)} actual · ${(receipt.clientLatencyMs / 1000).toFixed(1)} s client latency`, link: `<a href="${id}-prompt.txt">Prompt</a>`},
    {image: traceName, title: 'Lite raster traced to SVG', detail: `${trace.svg.pathCount} paths · ${(trace.svg.bytes / 1024).toFixed(0)} KiB SVG · ${trace.tool.elapsedSeconds.toFixed(2)} s tracing`, link: `<a href="${svgName}">SVG</a>`},
  ];
  articles.push(`<article><h2>Source ${index} · ${escapeHtml(entry.buildingId)}</h2><div class="grid">${panels.map(panel => `<figure><img src="${panel.image}" alt="${escapeHtml(panel.title)} for source ${index}" loading="lazy"><figcaption><strong>${escapeHtml(panel.title)}</strong><small>${escapeHtml(panel.detail)} · ${panel.link}</small></figcaption></figure>`).join('')}</div></article>`);
  summaries.push({index, buildingId: entry.buildingId, sourceSha256: entry.imageSha256,
    originalSourceSha256: entry.sourceSha256, sourceIdentity: entry.sourceIdentity,
    oldRasterSha256: sha(oldRaster), oldRasterModel: 'unknown-built-in', oldRasterCostUsd: null,
    liteReceipt: receipt, traceReceipt: trace});
}
const reviewPath = path.join(liteDir, 'review.json');
let reviewLink = '', reviewSummary = '';
try {const review = await fs.readFile(reviewPath); await fs.writeFile(path.join(out, 'review.json'), review); reviewLink = '<a href="review.json">Visual review</a> · '; reviewSummary = `<p><strong>Review:</strong> ${escapeHtml(JSON.parse(review.toString()).summary)}</p>`;}
catch (error: any) {if (error.code !== 'ENOENT') throw error;}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nano Banana 2 Lite facade trial</title><style>body{font:16px system-ui;background:#f7f4ec;color:#24322c;margin:24px}h1{font-size:28px}article{background:white;border-radius:12px;padding:20px;margin:28px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}figure{margin:0;min-width:0}img{width:100%;height:570px;object-fit:contain;background:#eeeae1}figcaption{overflow-wrap:anywhere}small{display:block}a{color:#285c48}@media(max-width:700px){body{margin:10px}article{padding:10px}.grid{grid-template-columns:1fr}img{height:500px}}</style><h1>Nano Banana 2 Lite raster → SVG trial</h1><p>Three source-space studies, not accepted building geometry. The earlier built-in image generator's model and cost were not exposed. Both raster arms used the same source-specific prompts, but Lite requested 1K output at 1:4 for sources 0 and 80 and 1:1 for source 17; the built-in arm used automatic dimensions. Source ownership and world registration remain unresolved. Vector tracing follows generated pixels and cannot verify architectural shapes.</p>${reviewSummary}<p>${reviewLink}<a href="summary.json">Receipts and hashes</a></p>${articles.join('')}</html>`;
await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summaries, null, 2) + '\n');
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(JSON.stringify({out, sources: summaries.length, images: summaries.length * 4}));
