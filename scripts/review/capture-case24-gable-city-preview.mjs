/** Capture the isolated, non-release Case 24 city candidate review packet. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('.');
const outputName = process.env.CASE24_CITY_AUDIT_OUTPUT;
const auditRoot = process.env.CASE24_CITY_AUDIT_ROOT;
if (!outputName || !/^iteration[0-9]+(?:-[a-z0-9]+)*$/.test(outputName)) throw Error('Set CASE24_CITY_AUDIT_OUTPUT to a new immutable iteration directory name');
if (!auditRoot || !/^review-data\/visual-audits\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(auditRoot)) throw Error('Set CASE24_CITY_AUDIT_ROOT to an immutable review-data/visual-audits run root');
const output = path.join(root, auditRoot, outputName);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const url = 'http://localhost:5195/canal-drive/case24-gable-city-preview.html';

async function capture(page, name) {
  const file = path.join(output, name);
  await page.locator('#stage').screenshot({ path: file });
  return { path: path.relative(root, file), sha256: digest(await fs.readFile(file)) };
}
async function capturePage(page, name) {
  const file = path.join(output, name);
  await page.screenshot({ path: file, fullPage: true, timeout: 10000 });
  return { path: path.relative(root, file), sha256: digest(await fs.readFile(file)) };
}

try { await fs.access(path.join(output, 'manifest.json')); throw Error(`Immutable capture manifest already exists: ${output}`); }
catch (error) { if ((error).code !== 'ENOENT') throw error; }
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(10000);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('active-release neighbours'));
  // Preserve a source-only reference before any model-facing screenshot. The
  // renderer may initialise behind this overlay, but the review sequence begins
  // with the pinned source and only then exposes a model or baseline.
  await page.getByRole('button', { name: 'Source 100%' }).click();
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  await page.waitForTimeout(100);
  const source100 = await capture(page, 'source-aligned-source-100.png');
  const pageCapture = await capturePage(page, 'source-aligned-source-100-page.png');
  await page.getByRole('button', { name: 'Street context' }).click();
  await page.getByRole('button', { name: 'Baseline' }).click();
  await page.getByRole('button', { name: 'Wide street-eye' }).click();
  await page.waitForTimeout(250);
  const wideBaseline = await capture(page, 'wide-street-baseline-source-0.png');
  await page.getByRole('button', { name: 'Gable candidate' }).click();
  await page.waitForTimeout(250);
  const wideCandidate = await capture(page, 'wide-street-candidate-source-0.png');
  await page.getByRole('button', { name: 'Baseline' }).click();
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  await page.waitForTimeout(250);
  const baseline = await capture(page, 'street-baseline-eye-height-source-0.png');
  await page.getByRole('button', { name: 'Gable candidate' }).click();
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  await page.waitForTimeout(250);
  const candidateStreet = await capture(page, 'street-candidate-eye-height-source-0.png');
  await page.getByRole('button', { name: 'Street context' }).click();
  await page.getByRole('button', { name: 'Oblique' }).click();
  await page.waitForTimeout(150);
  const candidateOblique = await capture(page, 'candidate-oblique-no-context.png');
  await page.getByRole('button', { name: 'Street context' }).click();
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  await page.getByRole('button', { name: 'Model 0% source' }).click();
  await page.waitForTimeout(250);
  const candidate0 = await capture(page, 'source-aligned-candidate-source-0.png');
  await page.getByRole('button', { name: 'Source 50%' }).click();
  await page.waitForTimeout(100);
  const candidate50 = await capture(page, 'source-aligned-candidate-source-50.png');
  const packetPath = 'public/canal-drive/data/case24-gable-city-preview.json';
  const comparisonPath = 'review-data/building-source-comparison/case-24.json';
  const bundlePath = 'public/canal-drive/js/case24-gable-city-preview.bundle.js';
  const inputs = await Promise.all([packetPath, comparisonPath, bundlePath].map(async file => ({ path: file, sha256: digest(await fs.readFile(path.join(root, file))) })));
  const packet = JSON.parse(await fs.readFile(path.join(root, packetPath), 'utf8'));
  const manifest = {
    version: 1,
    kind: 'case-24-isolated-real-owner-gable-city-preview-review',
    createdAt: new Date().toISOString(),
    source: { cropSha256: 'd41fbad9b2cab955a11725296c74f17d65e9e36907763f86eaf1396467186ebb', captureDate: '2023-01-10T10:49:47.057940Z', dimensions: { width: 213, height: 721 } },
    inputs,
    captures: [wideBaseline, wideCandidate, baseline, candidateStreet, candidateOblique, candidate0, candidate50, source100, pageCapture],
    reviewProtocol: {
      wideStreet: 'same inferred source-side inspection eye (20 m from the sampled front-wall midpoint; retained source local y 1.717 m) and fixed observed front-wall target for baseline and candidate, with active-release context and occlusion retained. It is not the recorded photo camera and walking-ground validity is unverified. The 54° vertical FOV is assumed for a normal-perspective wide context frame, not inferred or registered from the portrait crop.',
      sourceCameraSide: 'same stored camera eye (1.717 m in local render datum) and off-axis source-plane projection, baseline and candidate with active-release context enabled; occlusion is retained',
      sourceOverlay: '213×721 shared viewport; off-axis projection through cached sampling-plane rays; 0%, 50%, and 100% source opacity; visual comparison only, not registration',
      candidateStatus: `${packet.provenance.status}; cloned source-window observation stays ambiguous and preview-only`,
      unresolved: [...packet.provenance.unresolved, 'wide inspection position and FOV assumed', 'walking-ground validity unverified', 'source-camera overlay is not a camera fit'],
      releaseActivation: 'none',
    },
  };
  await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, captures: manifest.captures.map(item => item.path) }));
} finally {
  await browser.close();
}
