/** Capture a packet-selected source-to-owner preview with a source-first protocol. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('.');
const auditRoot = process.env.SOURCE_TO_OWNER_AUDIT_ROOT;
const outputName = process.env.SOURCE_TO_OWNER_AUDIT_OUTPUT;
const packetPath = process.env.SOURCE_TO_OWNER_PACKET ?? 'public/canal-drive/data/case22-gable-city-preview.json';
const previewPath = process.env.SOURCE_TO_OWNER_PREVIEW_URL ?? '/canal-drive/source-to-owner-city-preview.html';
if (!auditRoot || !/^review-data\/visual-audits\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(auditRoot)) throw Error('Set SOURCE_TO_OWNER_AUDIT_ROOT under review-data/visual-audits');
if (!outputName || !/^iteration[0-9]+(?:-[a-z0-9]+)*$/.test(outputName)) throw Error('Set SOURCE_TO_OWNER_AUDIT_OUTPUT to a new immutable iteration directory');
if (!/^\/canal-drive\/[A-Za-z0-9._/-]+\.html(?:\?[A-Za-z0-9._~%=&/-]*)?$/.test(previewPath)) throw Error('SOURCE_TO_OWNER_PREVIEW_URL must be a local canal-drive HTML URL');
const output = path.join(root, auditRoot, outputName);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const packetUrlPath = (() => {
  const dataRoot = 'public/canal-drive/data/';
  if (!packetPath.startsWith(dataRoot) || !packetPath.endsWith('.json') || packetPath.split(/[\\/]/).includes('..')) throw Error('SOURCE_TO_OWNER_PACKET must be a local public/canal-drive/data JSON packet');
  return `./data/${packetPath.slice(dataRoot.length)}`;
})();
try { await fs.access(path.join(output, 'manifest.json')); throw Error(`Immutable capture manifest already exists: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.mkdir(output, { recursive: true });
const packet = JSON.parse(await fs.readFile(path.join(root, packetPath), 'utf8'));
const packetUrl = new URL(`http://localhost:5195${previewPath}`);
packetUrl.searchParams.set('packet', packetUrlPath);
const sourceUrl = packet?.provenance?.source?.publicCropUrl;
if (typeof sourceUrl !== 'string' || !/^\/data\/city-expansion\/evidence\/[a-f0-9]{64}\.jpg$/.test(sourceUrl)) throw Error('Packet must bind a local hashed source crop');
const sourcePath = path.join(root, 'public', sourceUrl.slice(1));
const bundlePath = 'public/canal-drive/js/source-to-owner-city-preview.bundle.js';
const htmlPath = `public${new URL(previewPath, 'http://localhost:5195').pathname}`;
// Pin and retain the bytes before browser loading. A hash alone cannot restore
// a prior candidate after a generator overwrites its mutable public path.
const inputs = await Promise.all([packetPath, bundlePath, htmlPath, path.relative(root, sourcePath)].map(async file => {
  const bytes = await fs.readFile(path.join(root, file)), sha256 = digest(bytes);
  const snapshot = path.join(output, 'inputs', sha256, path.basename(file));
  await fs.mkdir(path.dirname(snapshot), { recursive: true });
  await fs.writeFile(snapshot, bytes, { flag: 'wx' });
  return { path: file, sha256, snapshot: path.relative(root, snapshot) };
}));
if (inputs.find(input => input.path === path.relative(root, sourcePath)).sha256 !== packet.provenance.source.cropSha256) throw Error('Source bytes differ from packet binding');
const startedAt = new Date();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 }); page.setDefaultTimeout(10000);
  await page.goto(packetUrl.href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('active-release neighbours'));
  const capture = async name => { const file = path.join(output, name); await page.locator('#stage').screenshot({ path: file }); return { path: path.relative(root, file), sha256: digest(await fs.readFile(file)) }; };
  // The pinned source is recorded before model-facing output.
  await page.getByRole('button', { name: 'Source 100%' }).click(); await page.getByRole('button', { name: 'Source-camera side' }).click(); await page.waitForTimeout(100);
  const source100 = await capture('source-aligned-source-100.png');
  await page.getByRole('button', { name: 'Model 0% source' }).click(); await page.getByRole('button', { name: 'Baseline' }).click(); await page.waitForTimeout(200);
  const baseline0 = await capture('source-aligned-baseline-source-0.png');
  await page.getByRole('button', { name: packet.target.candidateLabel ?? 'Candidate' }).click(); await page.waitForTimeout(200);
  const candidate0 = await capture('source-aligned-candidate-source-0.png');
  await page.getByRole('button', { name: 'Source 50%' }).click(); await page.waitForTimeout(100); const candidate50 = await capture('source-aligned-candidate-source-50.png');
  const setContext = async visible => { const button = page.getByRole('button', { name: 'Street context' }); if ((await button.getAttribute('aria-pressed')) !== String(visible)) await button.click(); };
  await setContext(false); await page.getByRole('button', { name: 'Oblique' }).click(); await page.waitForTimeout(150); const oblique = await capture('candidate-oblique-no-context.png');
  await setContext(true); await page.getByRole('button', { name: 'Baseline' }).click(); await page.getByRole('button', { name: 'Wide street-eye' }).click(); await page.waitForTimeout(200); const wideBaseline = await capture('wide-street-baseline-source-0.png');
  const baselineRuntime = JSON.parse(await page.locator('#stage').getAttribute('data-runtime-stats'));
  await page.getByRole('button', { name: packet.target.candidateLabel ?? 'Candidate' }).click(); await page.waitForTimeout(200); const wideCandidate = await capture('wide-street-candidate-source-0.png');
  const candidateRuntime = JSON.parse(await page.locator('#stage').getAttribute('data-runtime-stats'));
  for (const input of inputs) if (digest(await fs.readFile(path.join(root, input.path))) !== input.sha256) throw Error(`Input changed during capture: ${input.path}`);
  const manifest = { version: 1, kind: 'source-to-owner-city-preview-review', createdAt: new Date().toISOString(), captureUrl: packetUrl.href, captureDurationMs: Date.now() - startedAt.getTime(), caseId: packet.target.caseId, source: packet.provenance.source, inputs, captures: [source100, baseline0, candidate0, candidate50, oblique, wideBaseline, wideCandidate], runtime: { baseline: baselineRuntime, candidate: candidateRuntime, scope: 'renderer.info calls/triangles plus adapter target/context stats; not full-game performance' }, reviewProtocol: { order: 'source100, same-frame baseline0, candidate0, candidate50, oblique, equal-wide baseline/candidate', releaseActivation: 'none', unresolved: packet.provenance.unresolved } };
  await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, captures: 7, runtime: { baseline: baselineRuntime, candidate: candidateRuntime } }));
} finally { await browser.close(); }
