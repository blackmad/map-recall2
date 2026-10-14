// Frozen map frames for perf before/after pixel checks (a perf fix must change nothing on screen).
//   PORT=4488 node scripts/perf-frozen-frames.mjs <outdir> "<query>"
//   node scripts/perf-frozen-frames.mjs --compare <dirA> [<dirB>]
// Starts the fixed ride (Anne Frank Huis -> Rijksmuseum, car, chase, seeded Math.random), then teleports the
// stopped rider to each spot below (landmark models in view; one aerial hold), waits until streaming is idle and
// grabs MapLibre's canvas inside its `render` event (the map and every three.js layer, no HUD or DOM).
// BUNDLES_DIR=<dir> serves *.bundle.js from a local build (as ride-perf-owners.mjs). SPOTS=dam,westerkerk picks spots.
// AB_ON='<js>' AB_OFF='<js>': per spot, frames on / off / on again in the same page (e.g. a runtime switch).
// --compare prints, per frame, the pixels whose |dR|+|dG|+|dB| exceeds 0 and 30 (of 765).
import fs from 'node:fs';
import path from 'node:path';

const SPOTS = [
  { name: 'dam', lng: 4.8925, lat: 52.3727, bearing: 300 },
  { name: 'westerkerk', lng: 4.8853, lat: 52.3740, bearing: 270 },
  { name: 'munt', lng: 4.8945, lat: 52.3668, bearing: 200 },
  { name: 'rijksmuseum', lng: 4.8850, lat: 52.3616, bearing: 180 },
  // The rider inside the Royal Palace's block: the bike's x-ray shows through the building.
  { name: 'in-block', lng: 4.8906, lat: 52.3729, bearing: 0 },
  { name: 'in-block-2', lng: 4.8909, lat: 52.3733, bearing: 0 },
  { name: 'dam-aerial', lng: 4.8925, lat: 52.3727, bearing: 300, aerial: true },
];

if (process.argv[2] === '--compare') {
  const sharp = (await import('sharp')).default;
  const [, , , a, b] = process.argv;
  // One directory: the A/B frames (<spot>-on vs -off, and -on vs -on2 for the noise floor).
  const pairs = b
    ? fs.readdirSync(a).filter(f => f.endsWith('.png') && fs.existsSync(path.join(b, f))).sort().map(f => [f, path.join(a, f), path.join(b, f)])
    : fs.readdirSync(a).filter(f => f.endsWith('-on.png')).sort().flatMap(f => ['off', 'on2'].map(k => [f.replace('-on.png', ` on vs ${k}`), path.join(a, f), path.join(a, f.replace('-on.png', `-${k}.png`))]));
  const rows = [];
  for (const [file, pa, pb] of pairs) {
    const [x, y] = await Promise.all([pa, pb].map(p => sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (x.info.width !== y.info.width || x.info.height !== y.info.height) { rows.push({ file, error: 'size' }); continue; }
    let any = 0, over30 = 0, max = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      const d = Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]);
      if (d > 0) any++;
      if (d > 30) over30++;
      if (d > max) max = d;
    }
    rows.push({ file, pixels: x.info.width * x.info.height, differ: any, over30, maxDiff: max });
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(0);
}

const { chromium } = await import('playwright');
const [outdir = 'artifacts/frozen', qs = ''] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: (process.env.CHROME_ARGS || '').split(' ').filter(Boolean) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4465}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
const baseZoom = await page.evaluate(() => canalRecallGame.camera.zoom);

const only = (process.env.SPOTS || '').split(',').filter(Boolean);
const summary = [];
for (const spot of SPOTS.filter(s => !only.length || only.includes(s.name))) {
  await page.evaluate(({ lng, lat, bearing, aerial, baseZoom }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g._zoomTouchedByPlayer = true;
    g.camera.zoom = aerial ? Math.max(g.camera.minZoom, baseZoom * 0.18) : baseZoom;
  }, { ...spot, baseZoom });
  await page.evaluate(() => { window.__frozenIdle = 0; });
  await page.waitForFunction(() => {
    const vm = canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || ((!l._pending || !l._pending.size) && !(l._lodLoads > 0));
    const key = `${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}|${(l?._entries || []).map(e => e.level).join('')}|${vm.map.areTilesLoaded()}`;
    window.__frozenIdle = idle && landmarksIdle && vm.map.areTilesLoaded() && key === window.__frozenKey ? window.__frozenIdle + 1 : 0;
    window.__frozenKey = key;
    return window.__frozenIdle >= 5;
  }, null, { timeout: 180000, polling: 1000 });
  await page.waitForTimeout(1500);
  // Freeze MapLibre's camera (the game's per-frame sync jumps it by sub-pixels while the chase camera settles).
  await page.evaluate(() => { const vm = canalRecallGame.vectorMap; vm.__sync = vm.sync; vm.sync = () => {}; });
  await page.waitForTimeout(300);
  const grab = async (name, before) => {
    if (before) { await page.evaluate(before); await page.waitForTimeout(300); }
    const shot = await page.evaluate(() => new Promise(resolve => {
      const map = canalRecallGame.vectorMap.map, l = canalRecallGame.vectorMap._signatureLandmarks;
      map.once('render', () => resolve({ url: map.getCanvas().toDataURL('image/png'), drawn: (l?._entries || []).filter(e => e.pickProjection).length, resident: l?._entries?.length ?? 0 }));
      map.triggerRepaint();
    }));
    fs.writeFileSync(path.join(outdir, `${name}.png`), Buffer.from(shot.url.split(',')[1], 'base64'));
    return shot;
  };
  // AB_ON / AB_OFF='<js>': in-page A/B of the same frozen frame: on, off, on again (on vs on2 is the noise floor).
  if (process.env.AB_ON && process.env.AB_OFF) {
    const shot = await grab(`${spot.name}-on`, process.env.AB_ON);
    await grab(`${spot.name}-off`, process.env.AB_OFF);
    await grab(`${spot.name}-on2`, process.env.AB_ON);
    summary.push({ spot: spot.name, landmarksDrawn: shot.drawn, landmarksResident: shot.resident });
  } else {
    const shot = await grab(spot.name);
    summary.push({ spot: spot.name, landmarksDrawn: shot.drawn, landmarksResident: shot.resident });
  }
  await page.evaluate(() => { const vm = canalRecallGame.vectorMap; vm.sync = vm.__sync; delete vm.__sync; });
}
console.log(JSON.stringify({ outdir, qs, summary, errors }, null, 1));
await browser.close();
