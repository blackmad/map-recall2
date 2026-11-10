// Lane V1 (#329): before/after frames for the D2 (#322) Javaplantsoen ride and the N1 (#323) Dutch landmark card.
//   node scripts/v1-d2-n1-shots.mjs --what d2|n1 --before-bundles DIR --before-data DIR --out DIR [--mobile] [--port 4752]
// Before = bundles and the data extract files of main at 6a901ba06; after = the dev server. Seeded Math.random on both sides.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const port = arg('port', '4752'), out = arg('out', 'artifacts/v1'), what = arg('what', 'd2'), mobile = process.argv.includes('--mobile');
const bb = arg('before-bundles'), bd = arg('before-data');
const size = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
fs.mkdirSync(out, { recursive: true });
const WAY = [[52.363102, 4.945394], [52.363075, 4.945679], [52.363027, 4.94601], [52.36298, 4.946239], [52.363094, 4.946273], [52.363179, 4.946304], [52.363236, 4.946215], [52.363816, 4.946449]];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const tag of ['before', 'after']) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
  await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
  await context.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    if (location.search.includes('lang=nl')) localStorage.setItem('canalRecall.language.v1', 'nl'); });
  if (tag === 'before') {
    await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const f = path.join(bb, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
      return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'application/javascript' }) : route.continue();
    });
    await context.route(/\/data\/extracts\/amsterdam\/(streets-routing\.json|manifest\.json|facts\.json|roads-v2\/[\w.-]+)(\?.*)?$/, route => {
      const f = path.join(bd, 'public/data/extracts/amsterdam', /amsterdam\/([^?]+)/.exec(route.request().url())[1]);
      return fs.existsSync(f) ? route.fulfill({ path: f }) : route.continue();
    });
  }
  const page = await context.newPage();
  page.on('pageerror', e => console.log(tag, 'pageerror', String(e).slice(0, 200)));
  await page.goto(`http://localhost:${port}/canal-drive/?ride=free&engine=own${what === 'n1' ? '&lang=nl' : ''}`);
  await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
  await page.waitForTimeout(3000);
  if (what === 'd2') {
    const res = await page.evaluate(async ({ WAY }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), p = g.player;
      const xy = ([lat, lng]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
      const ll = pt => [l._lastCenterLat - (pt.y - l._lastOffsetY) / (111320 * ppm), l._lastCenterLng + (pt.x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm)];
      const path = WAY.map(xy), s = path[0], d = Math.atan2(path[1].y - s.y, path[1].x - s.x);
      Object.assign(p, { x: s.x, y: s.y, angle: d, speed: 0, vx: 0, vy: 0 }); p.handleInput = () => {};
      g.camera.viewMode = 'chase';
      const STEP = 1 / 60, trace = []; let index = 1;
      for (let t = 0; t < 40; t += STEP) {
        let nd = 1e9; for (let i = Math.max(0, index - 3); i < Math.min(path.length, index + 12); i++) { const dd = Math.hypot(path[i].x - p.x, path[i].y - p.y); if (dd < nd) { nd = dd; index = i; } }
        let la = 0, ti = index; while (ti < path.length - 1 && la < 60) { la += Math.hypot(path[ti + 1].x - path[ti].x, path[ti + 1].y - path[ti].y); ti++; }
        const tg = path[ti]; let e = Math.atan2(tg.y - p.y, tg.x - p.x) - p.angle; e = Math.atan2(Math.sin(e), Math.cos(e));
        const cruise = Math.abs(e) > 0.5 ? 60 : 120;
        p.steerInput = Math.max(-1, Math.min(1, e * 2.5)); p.throttle = p.speed < cruise ? 1 : 0; p.brake = p.speed > cruise * 1.6 ? 1 : 0; p.handbrake = false;
        g.track.clearFrameCache(); g._updateRacing(STEP); g.track.clearFrameCache();
        if (Math.round(t / STEP) % 30 === 0) trace.push([+t.toFixed(1), ...ll(p).map(v => +v.toFixed(6)), +p.speed.toFixed(0)]);
        if (Math.round(t / STEP) === 60 * 6) window.__mid = true;
      }
      g._render();
      return { trace, far: Math.max(...path.map((q, i) => i)) };
    }, { WAY });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `d2-${tag}.png`) });
    fs.writeFileSync(path.join(out, `d2-${tag}-trace.json`), JSON.stringify(res.trace));
    const last = res.trace.at(-1), t6 = res.trace.find(r => r[0] >= 20);
    console.log(tag, 'final', last, 'at 20 s', t6);
  } else {
    const info = await page.evaluate(id => {
      const g = canalRecallGame, l = g.landmarks.find(x => x.featureId === id || x.id === id || x.sourceId === id);
      return l ? { id: l.id, name: l.name } : null;
    }, arg('feature', 'extract_landmarks_1692085215'));
    console.log(tag, 'landmark', JSON.stringify(info));
    if (info) await page.evaluate(id => { const g = canalRecallGame, l = g.landmarks.find(x => x.id === id); g._showLandmarkNotice(l, { kind: 'sticky' }, 'click'); }, info.id);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `n1-${tag}.png`) });
  }
  await context.close();
}
await browser.close();
