// On-screen width of the highlight outline (look/highlight.ts, style a) at the spots of the highlight sheets.
//   PORT=4459 node scripts/highlight-outline-width.mjs [default|shared] [spots] [outlinePx]
// Per spot and view (chase, saddle): parked as in tests/e2e/highlight-shots.spec.ts, the building highlighted, one
// frame with the outline and one with `window.__canalRecallHighlightOutlinePx = 0` (ring and beacon unchanged); the
// pixels that changed and sit near the accent are the outline. Its local width at each pixel is the shorter of the
// horizontal and vertical accent runs through it (a diagonal edge reads up to √2 wide). Reports CSS px: the mean,
// median and quartiles, the outline's pixel count, and the camera distance to the building.
// `outlinePx` pins the width (the old fixed 2 px: `2`), else the page's own rule. BUNDLES_DIR serves *.bundle.js
// from there. Appends to artifacts/highlight-redesign/outline-width.jsonl.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [frame = 'default', spotsArg = 'oudwest-terrace,westermarkt', pinned = ''] = process.argv.slice(2);
const PORT = process.env.PORT || 4459, BUNDLES = process.env.BUNDLES_DIR, SHOTS = process.env.SHOTS_DIR;
const SPOTS = {
  westermarkt: { landmarkId: 'extract_landmarks_614625734', standDeg: 115, standM: 75, saddleM: 45 },
  westerkerk: { landmarkId: 'extract_landmarks_1692085215', standDeg: 140, standM: 90, saddleM: 60 },
  // A 6 m-wide 1890s house on the Bilderdijkstraat, the "building you tapped" path.
  'oudwest-terrace': { pand: 'NL.IMBAG.Pand.0363100012236453', pick: [4.87177, 52.36696], standDeg: 7, standM: 60, saddleM: 35 },
};
const CORAL = [255, 128, 51];
const OUT = 'artifacts/highlight-redesign/outline-width.jsonl';
fs.mkdirSync('artifacts/highlight-redesign', { recursive: true });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

async function outlineWidth(onPng, offPng, dpr) {
  const read = async png => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const on = await read(onPng), off = await read(offPng), w = on.info.width, h = on.info.height;
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += 3) {
    const near = Math.hypot(on.data[i] - CORAL[0], on.data[i + 1] - CORAL[1], on.data[i + 2] - CORAL[2]) < 70;
    const changed = Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2]) > 30;
    if (near && changed) { mask[p] = 1; n++; }
  }
  const widths = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    let l = x, r = x, t = y, b = y;
    while (l > 0 && mask[y * w + l - 1]) l--;
    while (r < w - 1 && mask[y * w + r + 1]) r++;
    while (t > 0 && mask[(t - 1) * w + x]) t--;
    while (b < h - 1 && mask[(b + 1) * w + x]) b++;
    widths.push(Math.min(r - l + 1, b - t + 1) / dpr);
  }
  const mean = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
  return { pixels: Math.round(n / dpr / dpr), mean: +mean.toFixed(2), median: +q(widths, 0.5).toFixed(2), p25: +q(widths, 0.25).toFixed(2), p75: +q(widths, 0.75).toFixed(2) };
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
if (BUNDLES) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = join(BUNDLES, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const query = ['highlight=a', frame === 'shared' ? 'sharedFrame=1' : ''].filter(Boolean).join('&');
await page.goto(`http://127.0.0.1:${PORT}/canal-drive/?${query}`);
await page.waitForFunction(() => !!window.canalRecallGame, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true });
await page.locator('#view-mode').selectOption('chase', { force: true });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => window.canalRecallGame?.player?.x, null, { timeout: 120000 });
await page.evaluate(() => { window.canalRecallGame.state = 4; });
if (pinned !== '') await page.evaluate(px => { window.__canalRecallHighlightOutlinePx = px; }, Number(pinned));

const rows = [];
for (const name of spotsArg.split(',')) for (const view of ['chase', 'saddle']) {
  const spot = SPOTS[name];
  const centre = spot.pick ?? await page.evaluate(id => window.canalRecallGame.landmarks.find(l => l.id === id)?.lngLat, spot.landmarkId);
  const m = view === 'saddle' ? spot.saddleM : spot.standM, b = spot.standDeg * Math.PI / 180;
  const p = { lng: centre[0] + m * Math.sin(b) / (111320 * Math.cos(centre[1] * Math.PI / 180)), lat: centre[1] + m * Math.cos(b) / 111320, bearing: (spot.standDeg + 180) % 360 };
  await page.evaluate(mode => { const g = window.canalRecallGame; g.viewMode = mode; g.camera.viewMode = mode; }, view === 'saddle' ? 'cockpit' : 'chase');
  const teleport = () => page.evaluate(({ lng, lat, bearing }) => {
    const g = window.canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), r = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(r), Math.sin(r));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 }); g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
  await teleport(); await page.waitForTimeout(4000); await teleport();
  await page.waitForFunction(() => { const t = window.canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const landmark = spot.pand
    ? { id: `tapped-${spot.pand}`, name: 'Terrace house', lngLat: spot.pick, buildingIds: [spot.pand], featureTarget: { source: 'osm-building-appearance', id: spot.pand } }
    : await page.evaluate(id => window.canalRecallGame.landmarks.find(l => l.id === id), spot.landmarkId);
  const state = await page.evaluate(l => {
    const vm = window.canalRecallGame.vectorMap, map = vm.map;
    vm.setActiveLandmark(l);
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    const canvas = map.getCanvas();
    for (const e of document.body.querySelectorAll('*')) if (e !== canvas && !e.contains(canvas)) e.style.visibility = 'hidden';
    return { marker: vm._highlightMarker?.status?.() ?? null };
  }, landmark);
  await page.waitForTimeout(2000);
  // The camera's distance to the beacon's base (the roof + 2 m), as the marker measured it last frame.
  state.distanceM = await page.evaluate(() => Math.round(window.canalRecallGame.vectorMap._highlightMarker?.status?.().distanceM ?? NaN));
  const canvas = page.locator('canvas.maplibregl-canvas').first();
  const onPng = await canvas.screenshot();
  const before = await page.evaluate(() => { const v = window.__canalRecallHighlightOutlinePx; window.__canalRecallHighlightOutlinePx = 0; window.canalRecallGame.vectorMap.map.triggerRepaint(); return v; });
  await page.waitForTimeout(1200);
  const offPng = await canvas.screenshot();
  await page.evaluate(v => { window.__canalRecallHighlightOutlinePx = v; window.canalRecallGame.vectorMap.setActiveLandmark(null); for (const e of document.body.querySelectorAll('*')) e.style.visibility = ''; }, before);
  if (SHOTS) { fs.writeFileSync(`${SHOTS}/${frame}-${name}-${view}-on.png`, onPng); fs.writeFileSync(`${SHOTS}/${frame}-${name}-${view}-off.png`, offPng); }
  const width = await outlineWidth(onPng, offPng, 1);
  const row = { frame, spot: name, view, pinnedPx: pinned === '' ? null : Number(pinned), ...state, ...width, at: new Date().toISOString() };
  delete row.marker;
  rows.push(row);
  fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
}
await browser.close();
