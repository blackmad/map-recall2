/**
 * Capture the development candidate in the real city-appearance viewer.
 *
 * This is bounded evidence collection only. It never changes the release pointer,
 * review state, cost ledger, or scene data. A release must be supplied explicitly
 * (or is read from the current pointer), and the page must identify it as a
 * development candidate before any image is written.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const currentPath = 'public/data/city-expansion/current.json';
const traversalConfigPath = 'scripts/city-appearance/fidelity/traversal-captures.json';
const baseUrl = process.env.NEIGHBOURHOOD_BASE_URL || 'http://127.0.0.1:5195';
const current = JSON.parse(await fs.readFile(currentPath, 'utf8'));
const traversal = JSON.parse(await fs.readFile(traversalConfigPath, 'utf8'));
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const releaseId = arg('--release') || process.env.NEIGHBOURHOOD_RELEASE_ID || current.releaseId;
const outputRoot = arg('--out') || `.cache/city-appearance/fidelity-neighborhood-candidate/${releaseId}`;
const output = path.resolve(outputRoot);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const viewerBundleSha256 = hash(await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js'));
const errors = [];
const captures = [];
const runtime = [];

assert.match(releaseId, /^[a-f0-9]{64}$/, 'release ID must be a 64-character SHA-256 identifier');
await fs.mkdir(output, { recursive: true });

// The preserved traversal file supplies the established fourteen-camera count,
// while the city viewer supplies the actual route distance. Its old image paths
// are not reused as candidate evidence.
const configuredCameraIds = [...new Set((traversal.captures || [])
  .map(item => String(item.file || '').match(/evaluation-(\d+)-(?:desktop|iphone)/)?.[1])
  .filter(Boolean))]
  .sort((a, b) => Number(a) - Number(b))
  .slice(0, 14)
  .map(value => `camera${value.padStart(2, '0')}`);
const cameraIds = configuredCameraIds.length === 14
  ? configuredCameraIds
  : Array.from({ length: 14 }, (_, index) => `camera${String(index + 1).padStart(2, '0')}`);
const cameraConfigSource = configuredCameraIds.length === 14 ? traversalConfigPath : 'bounded evenly spaced route fallback';

const browser = await chromium.launch({ headless: true });
try {
  for (const [layout, viewport, deviceScaleFactor] of [
    ['desktop', { width: 1440, height: 1000 }, 1],
    ['phone', { width: 390, height: 844 }, 1]
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ layout, phase: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') errors.push({ layout, phase: 'console', message: message.text() });
    });
    const url = `${baseUrl}/canal-drive/city-appearance.html?area=expansion&release=${encodeURIComponent(releaseId)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction(() => window.cityAppearanceDemo?.status?.().ready === true, null, { timeout: 90000 });
    const status = await page.evaluate(() => window.cityAppearanceDemo.status());
    assert.equal(status.releaseId, releaseId, `${layout}: viewer loaded a different release`);
    assert.equal(status.developmentCandidate, true, `${layout}: release is not marked developmentCandidate`);
    const routeDistance = await page.evaluate(() => window.cityAppearanceDemo.context?.()?.guidedRoute?.distanceM);
    assert.ok(Number.isFinite(routeDistance) && routeDistance > 0, `${layout}: guided route unavailable`);
    const cameraDistances = cameraIds.map((_, index) => routeDistance * (index / (cameraIds.length - 1)));
    for (let index = 0; index < cameraIds.length; index += 1) {
      const cameraId = cameraIds[index];
      await page.evaluate(distance => window.cityAppearanceDemo.routeAt(distance), cameraDistances[index]);
      // Hide the inspector defensively so captures cannot include a selected
      // frontage panel. It is not opened by the route camera itself.
      await page.evaluate(() => {
        const inspector = document.querySelector('#inspector');
        if (inspector) inspector.hidden = true;
      });
      await page.evaluate(() => window.cityAppearanceDemo.whenIdle?.());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const currentStatus = await page.evaluate(() => window.cityAppearanceDemo.status());
      assert.equal(currentStatus.developmentCandidate, true, `${layout}/${cameraId}: candidate marker lost`);
      const file = path.join(output, `${cameraId}-${layout}.png`);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled', timeout: 90000 });
      const bytes = await fs.readFile(file);
      const capture = {
        cameraId,
        layout,
        routeDistanceM: cameraDistances[index],
        path: path.relative(process.cwd(), file),
        sha256: hash(bytes),
        inspectorVisible: await page.locator('#inspector').isVisible().catch(() => false),
        status: currentStatus
      };
      assert.equal(capture.inspectorVisible, false, `${layout}/${cameraId}: inspector leaked into capture`);
      captures.push(capture);
      runtime.push({
        cameraId,
        layout,
        status: currentStatus,
        jsHeapBytes: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null),
        gpuGeometries: currentStatus.gpuGeometries ?? null,
        gpuTextures: currentStatus.gpuTextures ?? null,
        drawCalls: currentStatus.drawCalls ?? null,
        triangles: currentStatus.triangles ?? null,
        buildingGeometryBufferBytes: currentStatus.residentBuildingGeometryBufferBytes ?? null,
        buildingTextureBytesEstimate: currentStatus.residentBuildingTextureBytes ?? null,
        memoryMeasurement: 'browser heap plus resident building buffers and RGBA texture estimate'
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

assert.equal(hash(await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js')), viewerBundleSha256, 'viewer bundle changed during captures');
const memoryAvailable = runtime.every(item => item.jsHeapBytes !== null);
const artifact = {
  version: 1,
  scope: 'development-candidate neighbourhood visual/runtime evidence; not a release gate',
  createdAt: new Date().toISOString(),
  releaseId,
  viewerBundleSha256,
  viewerUrl: `${baseUrl}/canal-drive/city-appearance.html?area=expansion&release=${releaseId}`,
  candidateAssertion: 'every loaded page reported developmentCandidate:true and the requested release ID',
  cameraConfig: { count: 14, ids: cameraIds, source: cameraConfigSource, routeSampling: 'evenly spaced points over the live guided route' },
  layouts: ['desktop', 'phone'],
  captures,
  runtime,
  errors,
  memory: {
    available: memoryAvailable,
    maxResidentBuildingBufferAndTextureBytes: runtime.every(item => item.buildingGeometryBufferBytes !== null && item.buildingTextureBytesEstimate !== null)
      ? Math.max(...runtime.map(item => item.buildingGeometryBufferBytes + item.buildingTextureBytesEstimate)) : null,
    buildingMemoryScope: 'All resident building geometry buffers plus RGBA texture allocation estimate including mipmaps; excludes context, framebuffer and driver allocations; per-tile shared resources may be counted more than once.',
    metric: memoryAvailable ? 'browser performance.memory usedJSHeapSize; GPU counters from viewer status' : 'missing performance.memory; GPU counters retained when exposed',
    releaseGateClaim: false,
    reason: memoryAvailable ? 'This artifact is bounded evidence only; the required texture-inclusive 11 MB gate still needs its dedicated evaluator.' : 'performance.memory unavailable in this browser; no memory gate claim is possible.'
  },
  status: errors.length ? 'capture-errors' : 'captured; runtime gate incomplete',
  originalTwelveOutstanding: true
};
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ releaseId, captures: captures.length, errors: errors.length, memoryAvailable, output }, null, 2));
