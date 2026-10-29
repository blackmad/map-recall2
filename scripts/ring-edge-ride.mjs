import {chromium, devices} from 'playwright';
// Ride the touch ring's edge (CANAL-RECALL-7, residency.ts): an iPad-profile rider moved at the vehicle's cap speed in
// straight runs and turns, sampling every 100 ms whether the ground the screen shows (points along the top edge and
// the sides, unprojected) lies in a resident own-ground cell. A sample on a covered cell that is not resident is
// empty ground at the far edge. Prints the count and the longest gap per run.
//   PORT=4631 node scripts/ring-edge-ride.mjs            (QS='?groundRing=steps' for the desktop rule as control)
const port = process.env.PORT || 4471;
const runs = JSON.parse(process.env.RUNS || JSON.stringify([
  // [lng, lat, bearing°, seconds, turn° per second (0 = straight)]
  [4.88385, 52.37450, 180, 12, 0],
  [4.89440, 52.37560, 190, 10, 0],
  [4.88385, 52.37450, 90, 10, 30],
  [4.90000, 52.36500, 270, 10, -45],
]));
const speedScale = Number(process.env.SPEED_SCALE || 1);
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${port}/canal-drive/` + (process.env.QS || ''));
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
let worst = 0;
for (const [lng, lat, bearing, seconds, turn] of runs) {
  // Settle at the start (as a ride would: the ring around a standing rider), then ride.
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)("PIXELS_PER_METER"), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
  }, { lng, lat, bearing });
  await page.waitForTimeout(15000);
  const r = await page.evaluate(({ seconds, turn, speedScale }) => new Promise(done => {
    const g = canalRecallGame, vm = g.vectorMap, og = vm._ownGround, m = vm.map, ppm = (0, eval)("PIXELS_PER_METER");
    const speed = g.player.maxSpeed * speedScale; // px/s
    const t0 = performance.now(); let last = t0, samples = 0, missing = 0, gapStart = null, longest = 0, lastSample = 0, maxAhead = 0;
    const cos = Math.cos(m.getCenter().lat * Math.PI / 180);
    function frame(now) {
      const dt = (now - last) / 1000; last = now;
      g.player.angle += turn * Math.PI / 180 * dt;
      g.player.x += Math.cos(g.player.angle) * speed * dt; g.player.y += Math.sin(g.player.angle) * speed * dt;
      Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      if (now - lastSample >= 100) {
        lastSample = now;
        const st = og.status(), resident = new Set(Object.keys(st.cells || {}));
        maxAhead = Math.max(maxAhead, st.aheadM || 0);
        const c = m.getCenter(), cv = m.getCanvas(), w = cv.clientWidth, h = cv.clientHeight, [cx, cy] = og.centre;
        let gap = false;
        const pts = [];
        for (let i = 0; i <= 10; i++) pts.push([w * i / 10, 0]);
        for (let j = 1; j <= 5; j++) { pts.push([0, h * j / 5]); pts.push([w, h * j / 5]); }
        for (const [px, py] of pts) {
          const ll = m.unproject([px, py]);
          const x = cx + (ll.lng - c.lng) * 111320 * cos, y = cy + (ll.lat - c.lat) * 111320;
          const key = og.store.cellAt(x, y);
          samples++;
          if (og.store.covers(key) && !resident.has(key)) { missing++; gap = true; }
        }
        if (gap && gapStart === null) gapStart = now;
        if (!gap && gapStart !== null) { longest = Math.max(longest, now - gapStart); gapStart = null; }
      }
      if (now - t0 < seconds * 1000) requestAnimationFrame(frame);
      else { if (gapStart !== null) longest = Math.max(longest, now - gapStart); done({ samples, missing, longestGapMs: Math.round(longest), speedMps: +(speed / ppm).toFixed(1), aheadM: maxAhead, ring: og.status().radiusM, cells: Object.keys(og.status().cells).length, pitch: Math.round(m.getPitch()) }); }
    }
    requestAnimationFrame(frame);
  }), { seconds, turn, speedScale });
  worst = Math.max(worst, r.missing);
  console.log(`${lng},${lat} bearing ${bearing} ${seconds}s turn ${turn}°/s:`, JSON.stringify(r));
}
console.log(worst ? `EMPTY GROUND samples: ${worst} (worst run)` : 'no empty ground at the edge');
await browser.close();
