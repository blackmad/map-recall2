// Cold start of the Free Ride: when the rider is racing (the loading screen has gone), and when each world tier
// reports settled (vectorMap.worldSettled(), engine/ownWorldView.ts), round 5 lane R5-B (issue #261).
//   PORT=4681 node scripts/start-settle-cold.mjs <out.json> [--device desktop|iphone] [--runs 5] [--qs '?engine=own&ride=free']
//     [--chrome] [--headed] [--throttle 4] [--watch 8000]
// Each run is a fresh browser context (cold HTTP cache). A page-side sampler runs every 50 ms from navigation: the
// game state, loadingProgress, the game's own settle hold (_lastMapSettle: ms, timedOut, pending), and worldSettled()'s
// flags. Node derives, per run: navigation -> racing, the hold, and for each tier the time from racing until it first
// reads settled (0 when it already did at racing; null when it never did inside the watch window).
// Desktop: 1512x982 at DPR 2 (budgets.json _desktopPerfViewport). iPhone: devices['iPhone 13'] with CPU throttle 4x.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/start-settle-cold.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const runs = Number(opt('runs', '5'));
const qs = opt('qs', '?engine=own&ride=free');
const throttle = Number(opt('throttle', device === 'iphone' ? '4' : '1'));
const watchMs = Number(opt('watch', '8000'));
const headed = argv.includes('--headed');
const useChrome = argv.includes('--chrome');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4681}`;
const pagePath = process.env.PAGE || '/canal-drive/';
const TIERS = ['ground', 'city', 'buildings', 'far', 'baked', 'settled'];

const browser = await chromium.launch({
  headless: !headed,
  args: ['--enable-precise-memory-info', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});

async function run() {
  const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
  const context = await browser.newContext(device === 'iphone'
    ? { ...devices['iPhone 13'] }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
  // BUNDLES_DIR=<dir>: serve *.bundle.js from a scratch build (src changes without touching public/).
  // GAME_ROUTE=<file>: serve game-route.js from a patched copy (the start-hold cap call site, not yet applied).
  if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  if (process.env.GAME_ROUTE) await context.route(/\/canal-drive\/js\/game-route\.js(\?.*)?$/, route => route.fulfill({ path: process.env.GAME_ROUTE, contentType: 'application/javascript' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  if (process.env.STILLS_DIR) await page.addInitScript(() => { window.__coldStartStills = true; });
  await page.addInitScript(() => {
    const S = window.__coldStart = { samples: [] };
    const sample = () => {
      const t = Math.round(performance.now()), g = window.canalRecallGame, vm = g?.vectorMap;
      let w = null;
      try { w = vm && typeof vm.worldSettled === 'function' ? vm.worldSettled() : null; } catch (_) { w = null; }
      S.samples.push({
        t, state: g ? g.state : null, progress: g ? g.loadingProgress ?? null : null,
        hold: g && g._lastMapSettle ? { ...g._lastMapSettle } : null,
        ground: w ? w.ground : null, city: w ? w.city : null, buildings: w ? w.buildings : null,
        far: w ? w.far : null, baked: w ? w.baked : null, settled: w ? w.settled : null,
        detail: w ? w.detail : null, aerialZoom: vm?.camera?.zoom ?? null,
        groundReady: vm?._ownGround ? !!vm._ownGround.ready : null,
        groundLoadingCells: vm?._ownGround ? (vm._ownGround.loadingCells ?? null) : null,
        // No vm.pendingWork() here: it polls every idle check, the start hold's included (R5-B2).
        // R5-B2: the own camera's pose, the start tiers judged at it, the hold's last decision and the game camera.
        probe: (() => { try { return typeof vm?.startSettleProbe === 'function' ? vm.startSettleProbe() : null; } catch (_) { return null; } })(),
        status: (() => { try { return typeof vm?.startSettleStatus === 'function' ? vm.startSettleStatus() : null; } catch (_) { return null; } })(),
        gameCam: g?.camera ? { x: g.camera.x, y: g.camera.y, zoom: g.camera.zoom, rotation: g.camera.rotation } : null,
      });
      // First-visible-pop (R5-B2): from racing, every render at most every 50 ms, the world canvas downsampled to
      // 128 px wide; a frame whose pixels change (any channel > 40/255) on more than 2 % against the previous one.
      if (vm?.cameraMap && !S.popHooked) {
        S.popHooked = true; S.frames = []; S.keep = [];
        const W = 128, c = document.createElement('canvas'); let prev = null, last = 0, raceAt = null, prevUrl = null;
        vm.cameraMap.on('render', () => {
          const gg = window.canalRecallGame; if (!gg || gg.state !== 4) return;
          const now = performance.now(); raceAt ??= now;
          if (now - raceAt > 3500 || now - last < 50) return;
          last = now;
          const src = vm.frameCanvas(); if (!src?.width) return;
          const H = Math.max(1, Math.round(W * src.height / src.width)); c.width = W; c.height = H;
          const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, W, H);
          const d = cx.getImageData(0, 0, W, H).data;
          let changed = 0;
          if (prev) for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - prev[i]) > 40 || Math.abs(d[i + 1] - prev[i + 1]) > 40 || Math.abs(d[i + 2] - prev[i + 2]) > 40) changed++;
          const frac = prev ? changed / (W * H) : 0;
          const p = vm.startSettleProbe ? vm.startSettleProbe() : null;
          S.frames.push({ t: Math.round(now), frac: Math.round(frac * 10000) / 10000, cam: p ? [p.lng, p.lat, p.zoom, p.pitch, p.bearing] : null });
          // Keep a 384 px still of the first pop (and the frame before it) and of the first racing frame.
          if (window.__coldStartStills && S.keep.length < 3 && (S.frames.length === 1 || (frac > 0.02 && !S.popKept))) {
            const big = document.createElement('canvas'); big.width = 384; big.height = Math.round(384 * src.height / src.width);
            big.getContext('2d').drawImage(src, 0, 0, big.width, big.height);
            if (frac > 0.02) { S.popKept = true; if (prevUrl) S.keep.push({ t: Math.round(now), label: 'before-pop', url: prevUrl }); }
            S.keep.push({ t: Math.round(now), label: S.frames.length === 1 ? 'racing' : 'pop', url: big.toDataURL('image/png') });
          }
          if (window.__coldStartStills && !S.popKept) { const big = document.createElement('canvas'); big.width = 384; big.height = Math.round(384 * src.height / src.width); big.getContext('2d').drawImage(src, 0, 0, big.width, big.height); prevUrl = big.toDataURL('image/png'); }
          prev = d;
        });
      }
      if (S.samples.length > 3000) S.samples.splice(0, S.samples.length - 3000);
    };
    setInterval(sample, 50);
  });
  await page.goto(`${origin}${pagePath}${qs}`, { waitUntil: 'load' });
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // Racing is the end of the loading screen (game leaves GameState.LOADING, state 4 = RACING).
  await page.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 180_000 });
  const racedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(watchMs);
  const data = await page.evaluate(() => window.__coldStart.samples);
  const frames = await page.evaluate(() => window.__coldStart.frames || []);
  const keep = await page.evaluate(() => window.__coldStart.keep || []);
  const navSettle = await page.evaluate(() => window.canalRecallGame?._lastMapSettle ?? null);
  await context.close();
  // Racing time on the page clock: the first sample with state 4.
  const race = data.find(s => s.state === 4);
  const tRace = race ? race.t : Math.round(racedAt);
  const tiers = {};
  for (const k of TIERS) {
    const first = data.find(s => s.t >= tRace && s[k] === true);
    tiers[k] = first ? Math.max(0, first.t - tRace) : null;
  }
  const groundReadyAt = data.find(s => s.groundReady === true);
  const groundReadyMsAfterRacing = groundReadyAt ? groundReadyAt.t - tRace : null;
  const atRace = race ? Object.fromEntries(TIERS.map(k => [k, race[k]])) : null;
  // R5-B2: the pose at the hold (last held sample) against the racing pose (first sample with state 4, and 500 ms on).
  const held = [...data].reverse().find(s => s.t < tRace && s.probe);
  const later = data.find(s => s.t >= tRace + 500 && s.probe);
  const poseDelta = (a, b) => {
    if (!a?.probe || !b?.probe) return null;
    const A = a.probe, B = b.probe, k = 111320;
    const m = Math.hypot((B.lng - A.lng) * k * Math.cos(A.lat * Math.PI / 180), (B.lat - A.lat) * k);
    const db = Math.abs(((((B.bearing - A.bearing) + 180) % 360) + 360) % 360 - 180);
    const dc = A.detailCentre && B.detailCentre ? Math.hypot((B.detailCentre[0] - A.detailCentre[0]) * k * Math.cos(A.lat * Math.PI / 180), (B.detailCentre[1] - A.detailCentre[1]) * k) : null;
    return { centreM: Math.round(m), zoom: +(B.zoom - A.zoom).toFixed(2), pitch: +(B.pitch - A.pitch).toFixed(1), bearing: +db.toFixed(1), detailCentreM: dc == null ? null : Math.round(dc) };
  };
  const pose = { hold: held?.probe ?? null, racing: race?.probe ?? null, racing500: later?.probe ?? null, holdToRacing: poseDelta(held, race), holdToRacing500: poseDelta(held, later) };
  // Tiers that go pending (true -> false) after racing inside 3 s, with the time and the pose step at that sample.
  const goPending = [];
  for (const k of ['ground', 'city', 'buildings', 'far', 'baked']) {
    const win = data.filter(s => s.t >= tRace - 100 && s.t <= tRace + 3000);
    for (let i = 1; i < win.length; i++) if (win[i - 1][k] === true && win[i][k] === false) { goPending.push({ tier: k, msAfterRacing: win[i].t - tRace }); break; }
  }
  const pendingAtRaceList = race ? ['ground', 'city', 'buildings', 'far', 'baked'].filter(k => race[k] === false) : null;
  const landedAfter = Object.fromEntries(['ground', 'city', 'buildings', 'far', 'baked'].map(k => {
    const after = data.filter(s => s.t >= tRace && s.t <= tRace + 3000);
    const pendingAny = after.some(s => s[k] === false);
    const lastPending = [...after].reverse().find(s => s[k] === false);
    return [k, pendingAny ? (lastPending.t - tRace) : 0];
  }));
  const pop = frames.find(f => f.t >= tRace && f.frac > 0.02);
  const popStill = frames.find((f, i) => i > 0 && f.t >= tRace && f.frac > 0.02 && f.cam && frames[i - 1].cam && f.cam.every((v, j) => Math.abs(v - frames[i - 1].cam[j]) < 1e-6));
  const statusAtExit = held?.status ?? null;
  const groundWhy = { hold: held?.probe?.groundWhy ?? null, racing1500: data.find(s => s.t >= tRace + 1500 && s.probe)?.probe?.groundWhy ?? null };
  const groundCellAtHold = held?.probe ? held.probe.groundCentre : null, groundCellAtRace = race?.probe ? race.probe.groundCentre : null;
  return {
    device, throttle, navToRaceMs: tRace, hold: navSettle, holdTimedOut: navSettle ? navSettle.timedOut : null,
    atRacing: atRace, racingToTierMs: tiers, pendingAtRace: race?.hold?.pending ?? null,
    groundCellFirstMs: (data.find(s => s.probe?.groundCentre) ?? {}).t ?? null, groundCellTrueShareAfterRacing: (() => { const a = data.filter(s => s.t >= tRace && s.probe); return a.length ? +(a.filter(s => s.probe.groundCentre).length / a.length).toFixed(2) : null; })(),
    groundWhy, pose, goPendingAfterRacing: goPending, pendingAtRaceList, lastPendingMsAfterRacing: landedAfter,
    firstPopMs: pop ? pop.t - tRace : null, firstPopFrac: pop ? pop.frac : null, firstPopStillCameraMs: popStill ? popStill.t - tRace : null,
    frames: frames.map(f => ({ ms: f.t - tRace, frac: f.frac })), statusAtHoldExit: statusAtExit, groundCellAtHold, groundCellAtRace,
    keep: keep.map(k => ({ ...k, ms: k.t - tRace })),
    errors: errors.slice(0, 3), sampleCount: data.length, cameraZoomAtRace: race?.aerialZoom ?? null, groundReadyMsAfterRacing, groundReadyMsAfterNav: groundReadyAt ? groundReadyAt.t : null,
  };
}

const results = [];
for (let i = 0; i < runs; i++) {
  const r = await run();
  results.push(r);
  if (process.env.STILLS_DIR) {
    fs.mkdirSync(process.env.STILLS_DIR, { recursive: true });
    for (const k of r.keep) fs.writeFileSync(path.join(process.env.STILLS_DIR, `${device}-run${i + 1}-${k.label}-${k.ms}ms.png`), Buffer.from(k.url.split(',')[1], 'base64'));
  }
  r.keep = r.keep.map(k => ({ label: k.label, ms: k.ms }));
  console.log(`  pose hold->racing ${JSON.stringify(r.pose.holdToRacing)} (+500 ms ${JSON.stringify(r.pose.holdToRacing500)}); pending at racing ${r.pendingAtRaceList}; go pending ${JSON.stringify(r.goPendingAfterRacing)}; first pop ${r.firstPopMs} ms (still camera ${r.firstPopStillCameraMs})`);
  console.log(`${device} run ${i + 1}: nav->racing ${r.navToRaceMs} ms, hold timedOut ${r.holdTimedOut}, ` +
    `racing->settled ${r.racingToTierMs.settled ?? 'never'} ms (ground ${r.racingToTierMs.ground ?? 'never'}, buildings ${r.racingToTierMs.buildings ?? 'never'}, far ${r.racingToTierMs.far ?? 'never'}, baked ${r.racingToTierMs.baked ?? 'never'})`);
}
await browser.close();

const med = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
const summary = {
  nav_to_racing_ms: med(results.map(r => r.navToRaceMs)),
  hold_ms: med(results.map(r => r.hold?.ms ?? null)),
  hold_timed_out_runs: results.filter(r => r.holdTimedOut).length,
  racing_to_settled_ms: med(results.map(r => r.racingToTierMs.settled)),
  racing_to_ground_ms: med(results.map(r => r.racingToTierMs.ground)),
  racing_to_city_ms: med(results.map(r => r.racingToTierMs.city)),
  racing_to_buildings_ms: med(results.map(r => r.racingToTierMs.buildings)),
  racing_to_far_ms: med(results.map(r => r.racingToTierMs.far)),
  racing_to_baked_ms: med(results.map(r => r.racingToTierMs.baked)),
  never_settled_runs: results.filter(r => r.racingToTierMs.settled == null).length,
  first_pop_ms: med(results.map(r => r.firstPopMs)),
  pose_moved_runs: results.filter(r => r.pose.holdToRacing && (r.pose.holdToRacing.centreM > 5 || Math.abs(r.pose.holdToRacing.zoom) > 0.05 || r.pose.holdToRacing.bearing > 2 || Math.abs(r.pose.holdToRacing.pitch) > 1)).length,
  last_pending_after_racing_ms: Object.fromEntries(['ground', 'city', 'buildings', 'far', 'baked'].map(k => [k, med(results.map(r => r.lastPendingMsAfterRacing[k]))])),
};
fs.mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ qs, device, throttle, watchMs, summary, results }, null, 2));
console.log('summary', JSON.stringify(summary));
