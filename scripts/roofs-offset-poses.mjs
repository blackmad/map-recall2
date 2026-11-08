// Repro for #257 (roofs offset from their walls): the user's two poses (2026-11-08), camera detached in Free Ride as
// scripts/aerial-pan.mjs detaches it, the rider parked at the Free Ride start (Marineterrein).
//   node scripts/roofs-offset-poses.mjs [--port 4672] [--out dir] [--poses singelgracht,geldersekade]
//     [--variants 'main=;nobaked=bakedCoarse=0;old=@/path/to/bundles|qs']   (tag=qs, or tag=@bundlesDir|qs)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const port = arg('port', process.env.PW_PORT ?? '4672'), out = arg('out', 'artifacts/roofs-offset');
export const POSES = {
  singelgracht: { at: [4.8862, 52.3608], zoom: 0.5, tilt: 50, bearing: 135 },
  geldersekade: { at: [4.9005, 52.3757], zoom: 1.2, tilt: 55, bearing: 30 },
};
const custom = arg('pose', null);
const want = custom ? { custom: JSON.parse(custom) } : Object.fromEntries((arg('poses', Object.keys(POSES).join(','))).split(',').map(k => [k, POSES[k]]));
const variants = arg('variants', 'main=').split(';').filter(Boolean).map(v => {
  const [tag, rest = ''] = v.split(/=(.*)/s);
  const m = /^@([^|]*)\|?([^|]*)\|?(.*)$/.exec(rest);
  return m ? { tag, bundles: m[1] || null, qs: m[2], world: m[3] || null } : { tag, bundles: null, qs: rest, world: null };
});
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const v of variants) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
  if (v.bundles) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(v.bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // tag=@bundles|qs|worldDir: serve world-v1 files (shells, index) from a staged compile.
  if (v.world) await context.route(/\/data\/extracts\/amsterdam\/world-v1\/(.*?)(\?.*)?$/, route => {
    const file = path.join(v.world, /world-v1\/([^?]*)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => console.log(v.tag, 'pageerror', String(e).slice(0, 200)));
  await page.goto(`http://localhost:${port}/canal-drive/?ride=free&engine=own${v.qs ? '&' + v.qs : ''}`);
  await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = canalRecallGame; g.camera.viewMode = 'chase'; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await page.waitForTimeout(3000);
  for (const [name, sp] of Object.entries(want)) {
    await page.evaluate(sp => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
      const x = l._lastOffsetX + (sp.at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (sp.at[1] - l._lastCenterLat) * 111320 * ppm;
      cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.zoom = sp.zoom; cam.rotation = sp.bearing * Math.PI / 180;
      g.vectorMap.setCameraTilt?.(sp.tilt); g.vectorMap._cameraTilt = sp.tilt;
    }, sp);
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { const cam = canalRecallGame.vectorMap.camera; await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]); });
    await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 8000));
    const file = path.join(out, `${name}-${v.tag}.png`);
    await page.screenshot({ path: file });
    const stats = await page.evaluate(() => { try { return JSON.stringify(window.__canalRecallWorldView?.bakedCoarse?.stats?.() ?? null); } catch { return null; } });
    console.log('shot', file, stats ?? '');
  }
  await context.close();
}
await browser.close();
