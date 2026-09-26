/**
 * Smoke-captures an immutable candidate in the MapLibre study-facade game view.
 *
 * Usage:
 *   node scripts/review/capture-thousand-building-game.mjs --release=<sha256>
 *   node scripts/review/capture-thousand-building-game.mjs --release=<sha256> --require-physical-sign
 *
 * The MapLibre study-facade layer follows the active area pointer. This test-only
 * harness intercepts that request and serves immutable release bytes; it never
 * changes the active pointer or production release-selection behavior.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';

const option = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const releaseId = option('release');
const suffix = (option('suffix') ?? '').replace(/[^a-z0-9-]/gi, '');
const requirePhysicalSign = process.argv.includes('--require-physical-sign');
const baseUrl = option('base-url') ?? process.env.NEIGHBOURHOOD_BASE_URL ?? 'http://127.0.0.1:5195';
if (!/^[a-f0-9]{64}$/.test(releaseId ?? '')) throw Error('Pass an immutable SHA-256 release with --release=<sha256>.');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const releaseRoot = `public/data/city-expansion/releases/${releaseId}`;
const output = `.cache/city-appearance/thousand-building-game-smoke/${releaseId}${suffix ? `-${suffix}` : ''}`;
const manifestBytes = await fs.readFile(`${releaseRoot}/manifest.json`);
const manifest = JSON.parse(manifestBytes);
if (manifest.releaseId !== releaseId || manifest.developmentCandidate !== true) throw Error('Release is not the requested immutable development candidate.');
const [cityBundle, studyBundle, vectorMapBundle] = await Promise.all([
  fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js'),
  fs.readFile('public/canal-drive/js/study-facades.bundle.js'),
  fs.readFile('public/canal-drive/js/vector-map.js'),
]);
const bundles = {cityAppearanceViewerSha256: sha256(cityBundle), studyFacadesSha256: sha256(studyBundle), vectorMapSha256: sha256(vectorMapBundle)};

const signs = {tiles: 0, total: 0, observedPhysical: [], machine: 0, invalidObserved: []};
for (const tile of manifest.studyFacades?.tiles ?? []) {
  const file = `public${tile.url}`;
  const compressed = await fs.readFile(file);
  if (sha256(compressed) !== tile.sha256) throw Error(`Study facade compressed hash mismatch: ${tile.key}`);
  const raw = gunzipSync(compressed);
  if (sha256(raw) !== tile.contentSha256) throw Error(`Study facade content hash mismatch: ${tile.key}`);
  const payload = JSON.parse(raw);
  signs.tiles++;
  for (const sign of payload.signs ?? []) {
    signs.total++;
    if (sign.kind !== 'observed-physical-sign') { signs.machine++; continue; }
    const valid = typeof sign.text === 'string' && !!sign.text.trim() && typeof sign.physicalSignId === 'string' && !!sign.physicalSignId.trim()
      && /^[a-f0-9]{64}$/.test(sign.sourceSha256 ?? '') && typeof sign.captureDate === 'string' && !!sign.captureDate
      && Array.isArray(sign.triangles) && sign.triangles.length > 0 && sign.triangles.length % 9 === 0
      && Array.isArray(sign.uv) && sign.uv.length === sign.triangles.length / 3 * 2
      && [...sign.triangles, ...sign.uv].every(Number.isFinite);
    const entry = {tile: tile.key, physicalSignId: sign.physicalSignId, text: sign.text, observationId: sign.observationId, sourceSha256: sign.sourceSha256, captureDate: sign.captureDate, triangles: sign.triangles?.length / 9};
    if (valid) signs.observedPhysical.push(entry); else signs.invalidObserved.push(entry);
  }
}
if (requirePhysicalSign && !signs.observedPhysical.length) throw Error('No valid observed physical sign payload exists in this immutable release.');
if (signs.invalidObserved.length) throw Error(`Invalid observed physical sign payloads: ${signs.invalidObserved.length}`);
const studyTileCenter = tile => {
  const [zoom, x, y] = String(tile).split('/').map(Number), scale = 2 ** zoom;
  if (![zoom, x, y].every(Number.isFinite) || zoom < 0) return null;
  const longitude = (x + .5) / scale * 360 - 180, radians = Math.PI - 2 * Math.PI * (y + .5) / scale;
  return {lng: longitude, lat: Math.atan(Math.sinh(radians)) * 180 / Math.PI};
};
const signTarget = signs.observedPhysical.length ? studyTileCenter(signs.observedPhysical[0].tile) : null;
const smokeTarget = signTarget ?? manifest.studyFacades.origin;

await fs.mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true});
const errors = [], consoleErrors = [], intercepted = [];
let capture, diagnostics = null, failure = null, page;
try {
  page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  // Test-only substitution: the catalog continues to name /current.json, but
  // this route serves the immutable candidate bytes without touching its pointer.
  await page.route('**/data/city-expansion/current.json', async route => {
    intercepted.push({requestUrl: route.request().url(), fulfilledWith: `${releaseRoot}/manifest.json`, manifestSha256: sha256(manifestBytes)});
    await route.fulfill({status: 200, contentType: 'application/json', body: manifestBytes});
  });
  await page.goto(`${baseUrl}/canal-drive/index.html`, {waitUntil: 'load', timeout: 90000});
  await page.waitForFunction(() => Boolean(window.canalRecallGame?.ctx), null, {timeout: 90000});
  // Starting the study route makes the MapLibre canvas visible and drives the
  // production camera synchronizer at least once.  A bare landing page never
  // enters the game loop, so its custom Three layers cannot paint.
  await page.locator('#route-card').waitFor({state: 'visible', timeout: 90000});
  await page.locator('[data-choice="route:study"]').click();
  await page.locator('#route-card').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => window.canalRecallGame?.vectorMap?.ready === true, null, {timeout: 120000});
  // Let the first visible game frame complete its production camera sync.
  await page.waitForTimeout(500);
  await page.evaluate(origin => {
    const game = window.canalRecallGame, vectorMap = game.vectorMap;
    // Freeze only after the real game has synchronized.  The smoke camera is
    // now deterministic while still exercising the production setup path.
    if (!window.__candidateSmokeOriginalSync) {
      window.__candidateSmokeOriginalSync = vectorMap.sync.bind(vectorMap);
      vectorMap.sync = () => undefined;
    }
    const view = {center: [origin.lng, origin.lat], zoom: 19.55, bearing: -20, pitch: 65};
    vectorMap.map.jumpTo(view);
    vectorMap._clearCameraFromBuildingFootprints(view.center, view);
    // The game loop normally makes this call from sync(); after freezing sync
    // for a deterministic smoke camera, keep the complete-city streamer on
    // that same production camera contract.
    vectorMap._completeCity?.followCamera?.();
    vectorMap.map.triggerRepaint();
  }, smokeTarget);
  const status = await page.evaluate(async () => {
    const vectorMap = window.canalRecallGame.vectorMap;
    let render, renderError = null;
    try { render = await vectorMap.whenAppearanceRenderReady(90000); }
    catch (error) { renderError = String(error); render = vectorMap.appearanceRenderStatus(); }
    const facade = vectorMap._studyFacades;
    const meshes = [...(facade?.resources?.values?.() ?? [])].flat();
    return {
      render, renderError,
      activeAreaId: vectorMap._activeAppearanceAreaId,
      studyFacade: {
        ready: facade?.ready === true,
        residentTiles: facade?.debugResident ?? 0,
        declaredSigns: facade?.debugSigns ?? 0,
        renderedObservedPhysicalSigns: meshes.filter(mesh => mesh.userData?.sourceSign === true).map(mesh => ({physicalSignId: mesh.userData.physicalSignId, observationId: mesh.userData.observationId, sourceSha256: mesh.userData.sourceSha256})),
        renderedMachineSigns: meshes.filter(mesh => mesh.userData?.machineSign === true).length,
        renderPaints: facade?.debugPaints ?? 0,
      },
    };
  });
  if (status.renderError) throw Error(`Appearance render readiness failed: ${status.renderError}`);
  diagnostics = status;
  if (status.activeAreaId !== manifest.areaId || !status.studyFacade.ready || status.studyFacade.residentTiles < 1 || status.studyFacade.renderPaints < 1) throw Error(`Study facade layer did not render the intercepted candidate: ${JSON.stringify(status)}`);
  if (requirePhysicalSign && !status.studyFacade.renderedObservedPhysicalSigns.length) throw Error('Study game rendered no source-bound physical sign for the requested release.');
  await page.locator('#vector-map').screenshot({path: path.join(output, 'game-map.png'), animations: 'disabled', timeout: 90000});
  capture = {image: path.join(output, 'game-map.png'), status};
} catch (error) {
  const gameState = page ? await page.evaluate(() => ({
    hasGame: Boolean(window.canalRecallGame), player: window.canalRecallGame?.player ? {x: window.canalRecallGame.player.x, y: window.canalRecallGame.player.y} : null,
    routePattern: window.canalRecallGame?.routePattern ?? null, state: window.canalRecallGame?.state ?? null,
    vectorReady: window.canalRecallGame?.vectorMap?.ready ?? false,
    mapLoaded: window.canalRecallGame?.vectorMap?.map?.loaded?.() ?? false,
  })).catch(() => null) : null;
  failure = {error: String(error), intercepted, pageErrors: errors, consoleErrors, diagnostics, gameState};
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify(failure, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
const stableBundles = {
  cityAppearanceViewerSha256: sha256(await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js')),
  studyFacadesSha256: sha256(await fs.readFile('public/canal-drive/js/study-facades.bundle.js')),
  vectorMapSha256: sha256(await fs.readFile('public/canal-drive/js/vector-map.js')),
};
if (JSON.stringify(bundles) !== JSON.stringify(stableBundles)) throw Error('Viewer bundles changed during smoke capture.');
if (errors.length || consoleErrors.length) throw Error(`Browser errors: ${[...errors, ...consoleErrors].join('; ')}`);
if (!intercepted.length) throw Error('The test did not intercept the active candidate pointer.');
const report = {
  version: 2,
  scope: 'immutable candidate MapLibre study-facade game smoke only; not a release acceptance artifact',
  releaseId,
  manifestSha256: sha256(manifestBytes),
  createdAt: new Date().toISOString(),
  baseUrl,
  bundles,
  target: {center: smokeTarget, physicalSignTile: signs.observedPhysical[0]?.tile ?? null},
  interception: {testOnly: true, activePointerUnchanged: true, requests: intercepted},
  capture,
  studyFacadeSignPayload: {
    ...signs,
    physicalSignsRenderable: signs.observedPhysical.length > 0,
    asserted: requirePhysicalSign,
    note: signs.observedPhysical.length ? 'Validated source-bound physical sign payloads and their MapLibre game rendering.' : 'No source-bound physical sign payload in this historical candidate; no sign acceptance claimed.',
  },
};
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({releaseId, output, intercepted, capture: {image: capture.image, residentTiles: capture.status.studyFacade.residentTiles, renderedObservedPhysicalSigns: capture.status.studyFacade.renderedObservedPhysicalSigns.length, renderedMachineSigns: capture.status.studyFacade.renderedMachineSigns}, physicalSigns: signs.observedPhysical.length, bundleHashes: bundles}, null, 2));
