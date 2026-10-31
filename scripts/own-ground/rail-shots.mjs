// Railway tracks (rail-v1, railTracks.ts, issue #124): before/after screenshots and frame times at the rail spots,
// desktop and phone, the rider frozen at each spot (chase view). Before is `?rails=0` in the same build.
//   PORT=4734 node scripts/own-ground/rail-shots.mjs [outdir=artifacts/rail-20261030] [only,ids]
// Writes <outdir>/<device>-<rails|norails>-<spot>.png and <outdir>/frames.json (rAF interval mean / p50 / p95, ms,
// over FRAME_MS at each spot once the ground is idle).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const [out = 'artifacts/rail-20261030', only] = process.argv.slice(2);
const FRAME_MS = Number(process.env.FRAME_MS ?? 4000);
// [lng, lat, bearing]: the rider stands beside the corridor, looking along / across it.
const SPOTS = {
  // The user's report (2026-10-30): the raised corridor between Piet Heinkade and the Dijksgracht.
  'dijksgracht': [4.9180, 52.3757, 300],
  // Centraal's eastern approach, from the Piet Heinkade towards the station.
  'centraal-approach': [4.9075, 52.3782, 260],
  // Muiderpoort station: the Gooilijn viaducts over the street south of the station.
  'muiderpoort': [4.9300, 52.3598, 20],
  // Amstel station: the rail and metro viaducts on the embankment.
  'amstel': [4.9185, 52.3455, 330],
  // Issue #145 (user feedback 2026-10-30, build 04e3c88): the three spots the rider reported the tracks from.
  // 5d3fb497 'train tracks buried by surface': Piet Heinkade, looking east along the Dijksgracht corridor.
  'piet-heinkade-east': [4.919002, 52.376640, 100],
  // d49a15b0 'more bad train tracks': Panamalaan / Czaar Peterstraat, looking east along the corridor to the Zeeburg curve.
  'zeeburg-curve': [4.931068, 52.374300, 90],
  // 5d5b56c4 'ooof, these rails look really bad': Oostertoegang, Centraal's eastern throat over the Oosterdok mouth.
  'oostertoegang': [4.903754, 52.376897, 240],
};
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { ...devices['iPhone 13'], defaultBrowserType: undefined },
};
fs.mkdirSync(out, { recursive: true });
const frames = fs.existsSync(`${out}/frames.json`) ? JSON.parse(fs.readFileSync(`${out}/frames.json`, 'utf8')) : {};
// Uncapped frames (no vsync): the rAF interval is the frame's real cost, not the display's 16.7 ms.
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
for (const [device, ctxOpts] of Object.entries(process.env.DEVICES ? Object.fromEntries(Object.entries(DEVICES).filter(([k]) => process.env.DEVICES.split(',').includes(k))) : DEVICES)) {
  for (const rails of [false, true]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    // Busy time per frame: the main thread's work inside the rAF callbacks (the render submits its draw calls there).
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window), busy = new Map();
      window.__railBusy = busy;
      window.requestAnimationFrame = cb => raf(ts => { const t = performance.now(); try { cb(ts); } finally { busy.set(ts, (busy.get(ts) ?? 0) + performance.now() - t); } });
    });
    await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
    await page.goto(`http://127.0.0.1:${process.env.PORT || 4734}/canal-drive/?ownGround=1&sharedFrame=1${rails ? '' : '&rails=0'}`);
    await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
    await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
    await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
    await page.locator('#poi-destination').selectOption('rijksmuseum', { force: true });
    await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
    await page.locator('#route-card').evaluate(f => f.requestSubmit());
    await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
    for (const [id, [lng, lat, bearing]] of Object.entries(SPOTS)) {
      if (only && !only.split(',').includes(id)) continue;
      await page.evaluate(({ lng, lat, bearing }) => {
        const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
        g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
        g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
        g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
        g.player.handleInput = () => {};
      }, { lng, lat, bearing });
      await page.waitForFunction(() => !canalRecallGame.vectorMap._ownGround.status().basemapHidden, null, { timeout: 1500, polling: 16 }).catch(() => {});
      await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && s.basemapHidden && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 60000, polling: 50 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${out}/${device}-${rails ? 'rails' : 'norails'}-${id}.png` });
      const f = await page.evaluate(ms => new Promise(done => {
        const d = []; let last = performance.now(); const end = last + ms;
        window.__railBusy.clear();
        const stat = a => { a.sort((x, y) => x - y); return { mean: a.reduce((s, v) => s + v, 0) / a.length, p50: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)] }; };
        const tick = now => { d.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else { const b = stat([...window.__railBusy.values()]); const i = stat(d); done({ n: d.length, mean: i.mean, p50: i.p50, p95: i.p95, busyMean: b.mean, busyP95: b.p95 }); } };
        requestAnimationFrame(tick);
      }), FRAME_MS);
      (frames[device] ??= {})[`${rails ? 'rails' : 'norails'}:${id}`] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Math.round(v * 10) / 10]));
      console.log(device, rails ? 'rails' : 'norails', id, JSON.stringify(frames[device][`${rails ? 'rails' : 'norails'}:${id}`]));
    }
    await ctx.close();
  }
}
fs.writeFileSync(`${out}/frames.json`, JSON.stringify(frames, null, 1));
await browser.close();
