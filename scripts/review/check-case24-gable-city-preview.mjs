/** Focused browser assertions for the isolated Case 24 city-preview packet. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('.');
const outputName = process.env.CASE24_CITY_AUDIT_OUTPUT;
const auditRoot = process.env.CASE24_CITY_AUDIT_ROOT;
if (!outputName || !/^iteration[0-9]+(?:-[a-z0-9]+)*$/.test(outputName)) throw Error('Set CASE24_CITY_AUDIT_OUTPUT to the captured immutable iteration directory');
if (!auditRoot || !/^review-data\/visual-audits\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(auditRoot)) throw Error('Set CASE24_CITY_AUDIT_ROOT to an immutable review-data/visual-audits run root');
const output = path.join(root, auditRoot, outputName, 'browser-check.json');
const errors = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(`pageerror: ${error.message}`)); page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto('http://localhost:5195/canal-drive/case24-gable-city-preview.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('active-release neighbours'));
  await page.getByRole('button', { name: 'Source 100%' }).click();
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  const state = async () => page.locator('#source-overlay').evaluate(image => ({ src: image.getAttribute('src'), opacity: getComputedStyle(image).opacity, rect: image.getBoundingClientRect().toJSON(), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }));
  const source100 = await state();
  await page.getByRole('button', { name: 'Model 0% source' }).click();
  const source0 = await state();
  await page.getByRole('button', { name: 'Source 50%' }).click(); const source50 = await state();
  await page.getByRole('button', { name: 'Street context' }).click();
  await page.getByRole('button', { name: 'Baseline' }).click();
  await page.getByRole('button', { name: 'Wide street-eye' }).click();
  const wideBaseline = await page.locator('#stage').evaluate(stage => ({ width: stage.clientWidth, height: stage.clientHeight, label: stage.querySelector('#mode')?.textContent, cameraState: stage.dataset.cameraState }));
  await page.getByRole('button', { name: 'Gable candidate' }).click();
  const wideCandidate = await page.locator('#stage').evaluate(stage => ({ width: stage.clientWidth, height: stage.clientHeight, label: stage.querySelector('#mode')?.textContent, cameraState: stage.dataset.cameraState }));
  await page.getByRole('button', { name: 'Source-camera side' }).click();
  const candidate = await page.locator('#stage').evaluate(stage => ({ width: stage.clientWidth, height: stage.clientHeight, label: stage.querySelector('#mode')?.textContent }));
  await page.getByRole('button', { name: 'Baseline' }).click(); await page.getByRole('button', { name: 'Source-camera side' }).click();
  const baseline = await page.locator('#stage').evaluate(stage => ({ width: stage.clientWidth, height: stage.clientHeight, label: stage.querySelector('#mode')?.textContent }));
  const valid = source0.opacity === '0' && source50.opacity === '0.5' && source100.opacity === '1' && source100.naturalWidth === 213 && source100.naturalHeight === 721 && source0.src === source100.src && baseline.width === candidate.width && baseline.height === candidate.height && wideBaseline.width === wideCandidate.width && wideBaseline.height === wideCandidate.height && wideBaseline.cameraState === wideCandidate.cameraState && /^Wide inspection context/.test(wideBaseline.label || '') && /^Wide inspection context/.test(wideCandidate.label || '') && errors.length === 0;
  const report = { valid, pageErrors: errors, overlay: { source0, source50, source100 }, sameSourceCameraViewport: { baseline, candidate }, sameWideStreetCameraState: { baseline: wideBaseline, candidate: wideCandidate }, checkScope: 'CSS overlay opacity, pinned source-image dimensions, equal source-mode viewport, and identical read-only wide-street eye/target/FOV/aspect state after the direct baseline-to-candidate toggle. It does not compare screenshot pixels or inspect private Three camera matrices.', cameraContract: 'The packet pins one sourceCameraLocal and samplingPlaneLocal for both baseline and candidate. Wide street-eye derives an inferred 20 m source-side inspection eye, retains the stored local y, and uses an assumed normal-perspective FOV with a fixed observed-front-wall target; the renderer does not expose mutable camera matrices to page scripts.', contextTargetIdentity: 'Target owner is selected separately from mesh-only active-release context; candidate facade opt-in is target-only.' };
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  if (!valid) throw Error('Case 24 city-preview browser assertions failed');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
