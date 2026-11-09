// Lane S1 (#313): what tier draws the city in the first frame the player sees, and how long until no runtime coarse
// shell is left within 600 m of the view centre.
//   PORT=4730 node scripts/start-tier-probe.mjs <out.json> [--device desktop|iphone] [--runs 1] [--qs '?engine=own&ride=free']
//     [--hash '#race=…'] [--watch 15000] [--stills <dir>] [--label name]
// Each run is a fresh context (cold HTTP cache). From racing, every 500 ms (and at the first racing frame) the page
// samples the world canvas on a 32 × 24 grid, unprojects each point to the ground, and asks which building tier owns
// that ground: `facade` (an installed `near:` detail chunk for its detail tile), `baked` (a drawn baked coarse cell,
// coloured), `coarse` (an installed runtime `coarse:` z14 shell, no detail) or `none` (far prisms / nothing yet).
// Grid points are bucketed by distance from the view centre: ≤ 300, ≤ 600, ≤ 1000 m. The JSON keeps per sample the
// counts and the distinct detail tiles per tier; Node derives the seconds until no `coarse` point is left ≤ 600 m.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/start-tier-probe.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const runs = Number(opt('runs', '1'));
const qs = opt('qs', '?engine=own&ride=free');
const hash = opt('hash', '');
const label = opt('label', 'start');
const watchMs = Number(opt('watch', '15000'));
const throttle = Number(opt('throttle', device === 'iphone' ? '4' : '1'));
const stills = opt('stills', null);
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4730}`;

const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });

async function run(i) {
  const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });
  if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  if (process.env.GAME_ROUTE) await context.route(/\/canal-drive\/js\/game-route\.js(\?.*)?$/, route => route.fulfill({ path: process.env.GAME_ROUTE, contentType: 'application/javascript' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.addInitScript(() => {
    const S = window.__tierProbe = { samples: [], still: null };
    const tile = (lng, lat, z) => { const n = 2 ** z; return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)]; };
    const census = () => {
      const g = window.canalRecallGame, vm = g?.vectorMap, cam = vm?.camera, tb = vm?._threeBuildings, bc = vm?._bakedCoarse;
      const canvas = vm?.frameCanvas?.();
      if (!cam || !canvas) return null;
      const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
      const c = cam.center(), kx = 111320 * Math.cos(c.lat * Math.PI / 180), ky = 110574;
      const chunks = tb?.chunks instanceof Map ? tb.chunks : new Map();
      const has = k => !!chunks.get(k)?.mesh;
      const dz = tb?.detailZoom ?? 16;
      const baked = new Set(bc?.drawnCells?.() ?? []);
      const cellOf = (lng, lat) => `${Math.floor((lng - 4.9) * 67967.53053174692 / 1000)}_${Math.floor((lat - 52.37) * 111320 / 1000)}`;
      const buckets = { 300: {}, 600: {}, 1000: {}, 1200: {} }, tiles = { 300: {}, 600: {}, 1000: {}, 1200: {} }, band = {};
      for (let gy = 0; gy < 24; gy++) for (let gx = 0; gx < 32; gx++) {
        const ll = cam.unproject([(gx + 0.5) / 32 * W, (gy + 0.5) / 24 * H]);
        if (!ll) continue;
        const d = Math.hypot((ll.lng - c.lng) * kx, (ll.lat - c.lat) * ky);
        const [nx, ny] = tile(ll.lng, ll.lat, dz), [cx, cy] = tile(ll.lng, ll.lat, 14);
        const tier = has(`near:${nx}/${ny}`) || has(`near:${dz}/${nx}/${ny}`) ? 'facade' : baked.has(cellOf(ll.lng, ll.lat)) ? 'baked' : has(`coarse:${cx}/${cy}`) || has(`coarse:14/${cx}/${cy}`) ? 'coarse' : bc?.covers?.(cellOf(ll.lng, ll.lat)) ? 'farPending' : 'none';
        if (d > 600 && d <= 1200) band[tier] = (band[tier] ?? 0) + 1;
        for (const r of [300, 600, 1000, 1200]) if (d <= r) {
          buckets[r][tier] = (buckets[r][tier] ?? 0) + 1;
          (tiles[r][tier] ??= new Set()).add(`${nx}/${ny}`);
        }
      }
      const t = {};
      for (const r of [300, 600, 1000, 1200]) t[r] = Object.fromEntries(Object.entries(tiles[r]).map(([k, v]) => [k, v.size]));
      const bs = bc?.stats?.();
      return {
        centre: [+c.lng.toFixed(5), +c.lat.toFixed(5)], zoom: +cam.zoom().toFixed(2), pitch: +cam.pitch().toFixed(1), bearing: +cam.bearing().toFixed(1),
        points: buckets, band600to1200: band, tiles: t, engineCensus: vm.lastStartCensus ?? null, nearChunks: [...chunks.keys()].filter(k => k.startsWith('near:') && has(k)).length,
        coarseChunks: [...chunks.keys()].filter(k => k.startsWith('coarse:') && has(k)).length,
        baked: bs ? { enabled: bs.enabled, covered: bs.covered, cells: bs.cells, drawn: bs.drawn, pending: bs.pending, released: bs.released } : null,
        tbPending: tb?.pending?.length ?? null, atlasReady: tb ? !!tb.ready : null,
      };
    };
    let raceAt = null, lastAt = 0;
    const tick = () => {
      const g = window.canalRecallGame, vm = g?.vectorMap;
      if (!g || g.state !== 4 || !vm?.cameraMap) return;
      const now = performance.now();
      if (raceAt == null) {
        raceAt = now; S.raceAt = Math.round(now); S.hold = g._lastMapSettle ? { ...g._lastMapSettle } : null;
        S.startHold = g._startHold ? JSON.parse(JSON.stringify(g._startHold)) : null;
        // The first racing frame: census and a still, from the frame right after the reveal.
        vm.cameraMap.on('render', function first() {
          if (S.still) return;
          const src = vm.frameCanvas();
          try { const big = document.createElement('canvas'); big.width = Math.min(1280, src.width); big.height = Math.round(big.width * src.height / src.width); big.getContext('2d').drawImage(src, 0, 0, big.width, big.height); S.still = big.toDataURL('image/jpeg', 0.8); } catch (_) { S.still = 'x'; }
          try { S.samples.push({ ms: Math.round(performance.now() - raceAt), first: true, ...census() }); } catch (e) { S.err = String(e); }
        });
      }
      if (now - lastAt < 500) return;
      lastAt = now;
      try { const c = census(); if (c) S.samples.push({ ms: Math.round(now - raceAt), ...c }); } catch (e) { S.err = String(e); }
    };
    setInterval(tick, 50);
  });
  const t0 = Date.now();
  await page.goto(`${origin}/canal-drive/${qs}${hash}`, { waitUntil: 'load' });
  if (throttle > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 180_000 });
  await page.waitForTimeout(watchMs);
  // The settled frame at the end of the watch, for the strip (same pose unless the ride moved).
  const late = await page.evaluate(() => { const src = window.canalRecallGame?.vectorMap?.frameCanvas?.(); if (!src) return null; const big = document.createElement('canvas'); big.width = Math.min(1280, src.width); big.height = Math.round(big.width * src.height / src.width); big.getContext('2d').drawImage(src, 0, 0, big.width, big.height); return big.toDataURL('image/jpeg', 0.8); }).catch(() => null);
  const S = await page.evaluate(() => window.__tierProbe);
  if (stills && late) { fs.mkdirSync(stills, { recursive: true }); fs.writeFileSync(path.join(stills, `${label}-${device}-run${i + 1}-late-${watchMs}ms.jpg`), Buffer.from(late.split(',')[1], 'base64')); }
  await context.close();
  if (stills && S.still && S.still.startsWith('data:')) {
    fs.mkdirSync(stills, { recursive: true });
    fs.writeFileSync(path.join(stills, `${label}-${device}-run${i + 1}-first-frame.jpg`), Buffer.from(S.still.split(',')[1], 'base64'));
  }
  const first = S.samples.find(s => s.first) ?? S.samples[0];
  const coarse600 = s => (s?.points?.[600]?.coarse ?? 0) + (s?.points?.[600]?.farPending ?? 0);
  const clear = S.samples.filter(s => !s.first).find(s => coarse600(s) === 0);
  return {
    label, device, navToRaceMs: S.raceAt, wallToRaceMs: null, hold: S.hold, startHold: S.startHold, first,
    msUntilNoCoarseWithin600: clear ? clear.ms : null,
    timeline: S.samples.filter(s => !s.first).map(s => ({ ms: s.ms, p300: s.points[300], p600: s.points[600], p1000: s.points[1000], t600: s.tiles[600], near: s.nearChunks, coarse: s.coarseChunks, baked: s.baked })),
    errors: errors.slice(0, 3), err: S.err ?? null, wallMs: Date.now() - t0,
  };
}

const results = [];
for (let i = 0; i < runs; i++) {
  const r = await run(i);
  results.push(r);
  const f = r.first;
  console.log(`${label} ${device} run ${i + 1}: nav->racing ${r.navToRaceMs} ms, hold ${JSON.stringify(r.hold && { ms: r.hold.ms, timedOut: r.hold.timedOut, pending: r.hold.pending })}`);
  console.log(`  first frame centre ${f?.centre} z${f?.zoom} p${f?.pitch} b${f?.bearing}; pts300 ${JSON.stringify(f?.points?.[300])} pts600 ${JSON.stringify(f?.points?.[600])} pts1000 ${JSON.stringify(f?.points?.[1000])}; band600-1200 ${JSON.stringify(f?.band600to1200)}; startHold ${JSON.stringify(r.startHold)}; tiles600 ${JSON.stringify(f?.tiles?.[600])}; baked ${JSON.stringify(f?.baked)}; no coarse/farPending <=600 m after ${r.msUntilNoCoarseWithin600 ?? 'never'} ms`);
}
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ origin, qs, hash, device, runs: results }, null, 1));
console.log(`wrote ${out}`);
