// Frame cost of the highlight candidates (`?highlight=a|b|c`, look/highlight.ts) against today's yellow.
//   PORT=4451 node scripts/highlight-perf.mjs [desktop|touch] [frames] [styles] [frames-set]
// One page per (frame, style): the rider parked in chase view facing a spot, everything streamed, then
// `frames` forced redraws with no highlight and `frames` with the spot highlighted, in the same page.
// Per state: median / p95 of MapLibre's whole render (CPU), of the three.js layers, and WebGL draw calls per frame.
// Appends to artifacts/highlight-redesign/perf.jsonl and prints a table.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const [device = 'desktop', nArg = '240', stylesArg = 'yellow,a,b,c', framesArg = 'default,shared'] = process.argv.slice(2);
const N = Number(nArg), PORT = process.env.PORT || 4451;
const SPOTS = [
  { name: 'westermarkt', id: 'extract_landmarks_614625734', deg: 115, m: 75 },
  { name: 'westerkerk', id: 'extract_landmarks_1692085215', deg: 140, m: 90 },
];
const OUT = 'artifacts/highlight-redesign/perf.jsonl';
fs.mkdirSync('artifacts/highlight-redesign', { recursive: true });
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

const rows = [];
for (const frame of framesArg.split(',')) for (const style of stylesArg.split(',')) {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage(device === 'touch' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } });
  await page.route(/3dbag|cesium3dtiles/i, r => r.abort());
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  const query = [frame === 'shared' ? 'sharedFrame=1' : '', style === 'yellow' ? '' : `highlight=${style}`].filter(Boolean).join('&');
  await page.goto(`http://127.0.0.1:${PORT}/canal-drive/${query ? '?' + query : ''}`);
  await page.waitForFunction(() => !!window.canalRecallGame, null, { timeout: 60000 });
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => window.canalRecallGame?.player?.x, null, { timeout: 120000 });
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
  for (const spot of SPOTS) {
    const landmark = await page.evaluate(id => window.canalRecallGame.landmarks.find(l => l.id === id), spot.id);
    const b = spot.deg * Math.PI / 180, c = landmark.lngLat;
    const p = { lng: c[0] + spot.m * Math.sin(b) / (111320 * Math.cos(c[1] * Math.PI / 180)), lat: c[1] + spot.m * Math.cos(b) / 111320, bearing: (spot.deg + 180) % 360 };
    const teleport = () => page.evaluate(({ lng, lat, bearing }) => {
      const g = window.canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), r = bearing * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(r), Math.sin(r));
      Object.assign(g.player, { speed: 0, vx: 0, vy: 0 }); g.player.handleInput = () => {};
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    }, p);
    await teleport(); await page.waitForTimeout(4000); await teleport();
    await page.waitForFunction(() => { const t = window.canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120000 });
    await page.waitForTimeout(6000);
    if (device === 'touch') { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    const measure = (on) => page.evaluate(async ({ on, landmark, N }) => {
      const vm = window.canalRecallGame.vectorMap, map = vm.map;
      vm.setActiveLandmark(on ? landmark : null);
      const t = { render: [], three: [], calls: [] };
      const wrap = (obj, key, bucket) => { if (!obj?.[key] || obj[key].__hl) return; const o = obj[key].bind(obj); const f = (...a) => { const s = performance.now(); try { return o(...a); } finally { window.__hlBucket?.[bucket].push(performance.now() - s); } }; f.__hl = true; obj[key] = f; };
      wrap(map, '_render', 'render');
      const own = vm._sharedFrame ? [vm._sharedFrame.mainLayer, vm._sharedFrame.overlayLayer]
        : [vm._threeBuildings?.layer, vm._signatureLandmarks?.layer, vm._inventoryTrees?.layer, vm._pyramidalRoofs?.layer, vm._playerBike?.layer, map.getLayer('highlight-marker')?.implementation];
      for (const l of own) if (l?.render) wrap(l, 'render', 'three');
      const gl = map.painter.context.gl;
      if (!gl.__hlCount) { gl.__hlCount = { n: 0 }; for (const fn of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) { const o = gl[fn]?.bind(gl); if (o) gl[fn] = (...a) => { gl.__hlCount.n++; return o(...a); }; } }
      await new Promise(r => setTimeout(r, 1500));
      window.__hlBucket = t;
      for (let i = 0; i < N; i++) {
        gl.__hlCount.n = 0;
        map.triggerRepaint();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        t.calls.push(gl.__hlCount.n);
      }
      window.__hlBucket = null;
      return t;
    }, { on, landmark, N });
    for (const on of [false, true]) {
      const t = await measure(on);
      const row = { device, frame, style, spot: spot.name, highlight: on, n: t.render.length, renderMedian: +q(t.render, 0.5).toFixed(3), renderP95: +q(t.render, 0.95).toFixed(3),
        threeMedian: +q(t.three, 0.5).toFixed(3), callsMedian: q(t.calls, 0.5), at: new Date().toISOString() };
      rows.push(row);
      fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
      console.log(JSON.stringify(row));
    }
  }
  await browser.close();
}
console.log('\nframe   style spot         calls off→on   MapLibre render ms off→on (median)   three.js layers ms off→on');
for (let i = 0; i < rows.length; i += 2) {
  const [a, b] = [rows[i], rows[i + 1]];
  console.log(`${a.frame.padEnd(7)} ${a.style.padEnd(5)} ${a.spot.padEnd(12)} ${String(a.callsMedian).padStart(4)} → ${String(b.callsMedian).padEnd(5)}   ${a.renderMedian.toFixed(2)} → ${b.renderMedian.toFixed(2)}                     ${a.threeMedian.toFixed(2)} → ${b.threeMedian.toFixed(2)}`);
}
