// G4 (#369) repros at Cornelis Lelylaan. PORT=4462 MODE=orbit|cold|iphone [ZOOM=..] node scripts/g4-repro.mjs <tag>
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const tag = process.argv[2] || 'x', MODE = process.env.MODE || 'orbit', [lng, lat] = (process.env.AT || '4.8420,52.3588').split(',').map(Number);
fs.mkdirSync(`artifacts/g4/${tag}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await browser.newContext(MODE === 'iphone' ? { ...devices['iPhone 14'] } : { viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
if (MODE === 'iphone') { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = `${process.env.BUNDLES_DIR}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]}`;
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await page.goto(`http://127.0.0.1:${process.env.PORT || 4462}/canal-drive/?ride=free&engine=own${process.env.QS || ''}`);
await page.waitForFunction(() => { const g = window.canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.freeRide && g.vectorMap?._ownGround?.ready; }, null, { timeout: 240000 });
const t0 = Date.now();
await page.evaluate(({ lng, lat, MODE, ZOOM }) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
  g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
  g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
  if (MODE === 'orbit' || MODE === 'iphone') { const z = ZOOM; const step = () => { cam.detached = true; cam.anchorX = g.player.x; cam.anchorY = g.player.y; cam.zoom = z; requestAnimationFrame(step); }; if (z) requestAnimationFrame(step); }
}, { lng, lat, MODE, ZOOM: Number(process.env.ZOOM || 0) });
const rows = [];
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = canalRecallGame.vectorMap._ownGround, s = g.status(); return { cells: Object.keys(s.cells).length, pending: Object.keys(s.pending).length, queued: s.queued, nearRider: s.far.nearRider, nearCoarse: s.far.nearCoarse, farParts: s.far.partsShown, farR: s.far.radiusM, zoom: +s.zoom.toFixed(2), basemapHidden: s.basemapHidden }; });
  rows.push({ t: Date.now() - t0, ...r });
  if (i === 6 || i === 39) await page.screenshot({ path: `artifacts/g4/${tag}/${i}.png` });
}
fs.writeFileSync(`artifacts/g4/${tag}/rows.json`, JSON.stringify(rows));
const sum = a => JSON.stringify({ maxNearRider: Math.max(...a.map(r => r.nearRider.length)), maxNearCoarse: Math.max(...a.map(r => r.nearCoarse.length)), finalNearCoarse: a.at(-1).nearCoarse, lastPending: a.at(-1).pending, firstClean: a.find(r => !r.nearCoarse.length && !r.nearRider.length && r.pending === 0)?.t ?? null, zoom: a.at(-1).zoom, farR: a.at(-1).farR });
console.log(MODE, sum(rows));
await browser.close();
