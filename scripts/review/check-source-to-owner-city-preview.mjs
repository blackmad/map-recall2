/** Structural browser check for the generic packet-selected source-to-owner viewer. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const packet = JSON.parse(await fs.readFile(process.env.SOURCE_TO_OWNER_PACKET ?? 'public/canal-drive/data/case22-gable-city-preview.json', 'utf8'));
const previewPath = process.env.SOURCE_TO_OWNER_PREVIEW_URL ?? '/canal-drive/source-to-owner-city-preview.html';
if (!/^\/canal-drive\/[A-Za-z0-9._/-]+\.html(?:\?[A-Za-z0-9._~%=&/-]*)?$/.test(previewPath)) throw Error('SOURCE_TO_OWNER_PREVIEW_URL must be a local canal-drive HTML URL');
const packetPath = process.env.SOURCE_TO_OWNER_PACKET ?? 'public/canal-drive/data/case22-gable-city-preview.json';
const packetUrlPath = (() => {
  const dataRoot = 'public/canal-drive/data/';
  if (!packetPath.startsWith(dataRoot) || !packetPath.endsWith('.json') || packetPath.split(/[\\/]/).includes('..')) throw Error('SOURCE_TO_OWNER_PACKET must be a local public/canal-drive/data JSON packet');
  return `./data/${packetPath.slice(dataRoot.length)}`;
})();
const expectedBySource = packet.provenance.featureIdsBySource;
const preservedRecord = packet.target.candidate.observations.find(entry => entry.payload?.facadeDescription)?.payload.facadeDescription;
assert.ok(preservedRecord, 'candidate must retain a source-facade observation');
const openingCount = source => source.features.filter(feature => ['window', 'door'].includes(feature.kind)).length;
const fullOpeningCount = openingCount(preservedRecord.sources.full);
const groundOpeningCount = openingCount(preservedRecord.sources.ground);
const errors = []; const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } }); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  const url = new URL(`http://localhost:5195${previewPath}`); url.searchParams.set('packet', packetUrlPath);
  await page.goto(url.href, { waitUntil: 'networkidle' }); await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('active-release neighbours'));
  assert.equal(await page.locator('#preview-address').textContent(), packet.target.address);
  assert.equal(new URL(await page.locator('#source-overlay').getAttribute('src'), url).pathname, packet.provenance.source.publicCropUrl);
  if (packet.target.scopeNote) assert.equal(await page.locator('#candidate-scope').textContent(), packet.target.scopeNote);
  await page.getByRole('button', { name: 'Source 100%' }).click(); await page.getByRole('button', { name: 'Source-camera side' }).click();
  const source = await page.locator('#source-overlay').evaluate(image => ({ opacity: getComputedStyle(image).opacity, width: image.naturalWidth, height: image.naturalHeight }));
  assert.deepEqual(source, { opacity: '1', width: packet.provenance.source.dimensions.width, height: packet.provenance.source.dimensions.height });
  const sourceFrame = await page.locator('#stage').evaluate(stage => ({ sourceFrame: document.body.classList.contains('source-frame'), rect: stage.getBoundingClientRect().toJSON(), cameraState: JSON.parse(stage.dataset.cameraState) }));
  assert.equal(sourceFrame.sourceFrame, true); assert.equal(sourceFrame.cameraState.kind, 'source-camera-side');
  await page.getByRole('button', { name: 'Model 0% source' }).click(); const zero = await page.locator('#source-overlay').evaluate(image => getComputedStyle(image).opacity); assert.equal(zero, '0');
  await page.getByRole('button', { name: 'Baseline' }).click(); const baselineSource = await page.locator('#stage').evaluate(stage => ({ sourceFrame: document.body.classList.contains('source-frame'), cameraState: JSON.parse(stage.dataset.cameraState) }));
  await page.getByRole('button', { name: packet.target.candidateLabel ?? 'Candidate' }).click(); const candidateSource = await page.locator('#stage').evaluate(stage => ({ sourceFrame: document.body.classList.contains('source-frame'), cameraState: JSON.parse(stage.dataset.cameraState) }));
  assert.equal(baselineSource.sourceFrame, true); assert.equal(candidateSource.sourceFrame, true); assert.deepEqual(baselineSource.cameraState.projectionMatrix, candidateSource.cameraState.projectionMatrix);
  await page.getByRole('button', { name: 'Source 50%' }).click(); const half = await page.locator('#source-overlay').evaluate(image => getComputedStyle(image).opacity); assert.equal(half, '0.5');
  const halfCamera = JSON.parse(await page.locator('#stage').getAttribute('data-camera-state'));
  assert.deepEqual(halfCamera, candidateSource.cameraState, 'overlay must retain the exact candidate camera and viewport');
  const contextButton = page.getByRole('button', { name: 'Street context' }); if ((await contextButton.getAttribute('aria-pressed')) !== 'true') await contextButton.click(); await page.getByRole('button', { name: 'Baseline' }).click(); await page.getByRole('button', { name: 'Wide street-eye' }).click(); const baseline = JSON.parse(await page.locator('#stage').getAttribute('data-runtime-stats'));
  await page.getByRole('button', { name: packet.target.candidateLabel ?? 'Candidate' }).click(); const candidate = JSON.parse(await page.locator('#stage').getAttribute('data-runtime-stats'));
  assert.equal(baseline.cameraMode, 'wide-street'); assert.equal(candidate.cameraMode, 'wide-street'); assert.equal(baseline.contextVisible, true); assert.equal(candidate.contextVisible, true); assert.ok(candidate.renderer.triangles > 0); assert.ok(candidate.target.triangles > 0);
  const record = preservedRecord;
  for (const [sourceName, featureIds] of Object.entries(expectedBySource)) assert.deepEqual(record.sources[sourceName].features.map(feature => feature.id), featureIds, `${sourceName} features must remain byte-order preserved`);
  const candidateFeatures = candidate.target.windows + candidate.target.doors;
  assert.ok(candidateFeatures >= fullOpeningCount, `candidate runtime has ${candidateFeatures} openings for ${fullOpeningCount} full-source openings`);
  assert.ok(groundOpeningCount > 0, 'candidate preserves a separate ground-source opening record even where temporal tier precedence selects a newer ground view');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ url: url.href, source, baseline, candidate, preservedOpeningCount: fullOpeningCount + groundOpeningCount }));
} finally { await browser.close(); }
