import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { openRoute, setHiddenSelect } from './helpers';

// What one ride downloads, default tile path against `?world=v1` (P2 bytes gate, issue #130: per-ride target
// <= 2 MB of building data), and world-v1 cell decode ms at 4x CPU. Opt-in measurement:
//   WORLD_BYTES=1 [WORLD_BYTES_RIDES=seeded,free,tour] [WORLD_BYTES_VARIANTS=default,world,world-main]
//     [WORLD_DIR=artifacts/world/staging] [BUNDLES_DIR=dir] PW_PORT=4543 \
//     /tmp/canal-pw.sh perl -e 'alarm 1200; exec @ARGV' npx playwright test world-v1-bytes --project=desktop --workers=1 --trace off
// WORLD_DIR serves cells at /data/extracts/amsterdam/world-v1/ (default: staging; pass the published directory
// to measure what is live). BUNDLES_DIR serves *.bundle.js built from this checkout (a new cell format needs a
// decoder that reads it). Rides: `seeded` is the seeded default route replayed along routePath at 8 m/s for up to
// 90 s; `free` is Free Ride, throttle held 90 s with a turn tapped whenever the rider stands at a junction; `tour` parks and settles at the world-compiler
// sentinels in order (Westerkerk, Bloemgracht 80, Nassaukade, the Leidsegracht courtyard, IJburg's edge).
// Variants: `world-main` is `?world=v1&worldWorker=0`: cells decode on the main thread, which the CPU throttle
// reaches (Playwright cannot throttle a dedicated worker's target), so its decode ms are the 4x-CPU decode cost;
// `world` decodes in the worker pool, unthrottled.
// Bytes are what a static host sends for every /data/extracts/ request the page and its workers made: a file
// already gzipped (.gz, world-v1 .bin) at its size, any other file at its gzip -6 size. Output: artifacts/world/bytes/.
test.skip(!process.env.WORLD_BYTES, 'set WORLD_BYTES=1 to measure');

const OUT = process.env.BYTES_DIR || 'artifacts/world/bytes';
const WORLD_DIR = path.resolve(process.env.WORLD_DIR || 'artifacts/world/staging');
const PUBLIC = path.resolve('public');
const CPU = Number(process.env.WORLD_BYTES_CPU ?? 4);
const SPOTS = [
  { name: 'westerkerk', at: [4.8826, 52.3741], face: [4.8843, 52.3746] },
  { name: 'bloemgracht-80', at: [4.8798, 52.3752], face: [4.8809, 52.3750] },
  { name: 'nassaukade', at: [4.8722, 52.3712], face: [4.8732, 52.3722] },
  { name: 'leidsegracht-courtyard', at: [4.8868, 52.3676], face: [4.8884, 52.3686] },
  { name: 'ijburg-edge', at: [5.0185, 52.3512], face: [5.0203, 52.3521] },
] as const;
// WORLD_BYTES_QS='&ringFollow=0' is appended to every variant (an A/B of a streaming flag against the same ride).
const QS = (process.env.WORLD_BYTES_QS ?? '').replace(/^[?&]/, '');
const withQs = (q: string) => (QS ? `${q}&${QS}` : q);
const ALL_VARIANTS = [{ name: 'default', query: withQs('?world=live') }, { name: 'world', query: withQs('?world=v1') }, { name: 'world-main', query: withQs('?world=v1&worldWorker=0') }];
const pick = (env: string | undefined, all: string[]) => (env ?? '').split(',').filter(Boolean).filter(x => all.includes(x));
const VARIANTS = ALL_VARIANTS.filter(v => (pick(process.env.WORLD_BYTES_VARIANTS, ALL_VARIANTS.map(x => x.name)).length ? pick(process.env.WORLD_BYTES_VARIANTS, ALL_VARIANTS.map(x => x.name)) : ['default', 'world']).includes(v.name));
const RIDES = pick(process.env.WORLD_BYTES_RIDES, ['seeded', 'free', 'tour']).length ? pick(process.env.WORLD_BYTES_RIDES, ['seeded', 'free', 'tour']) : ['seeded', 'free'];
const RIDE_MS = Number(process.env.WORLD_BYTES_RIDE_MS ?? 90_000);
/** Seeded-ride replay speed, m/s (a brisk cyclist / town car). */
const RIDE_SPEED = Number(process.env.WORLD_BYTES_RIDE_SPEED ?? 8);

const sizeCache = new Map<string, { raw: number; sent: number }>();
function bytesOf(file: string): { raw: number; sent: number } {
  let hit = sizeCache.get(file);
  if (!hit) {
    if (!existsSync(file) || !statSync(file).isFile()) hit = { raw: 0, sent: 0 };
    else { const b = readFileSync(file); const zipped = b.length > 1 && b[0] === 0x1f && b[1] === 0x8b; hit = { raw: zipped ? zlib.gunzipSync(b).length : b.length, sent: zipped ? b.length : zlib.gzipSync(b, { level: 6 }).length }; }
    sizeCache.set(file, hit);
  }
  return hit;
}
/** The extract directory a request belongs to (world-v1 split into cells and indexes). */
const category = (rel: string) => rel.startsWith('world-v1/cells/') ? 'world-v1 cells' : rel.startsWith('world-v1/') ? 'world-v1 index' : rel.split('/')[0].replace(/\?.*$/, '');

async function park(page: Page, at: readonly number[], face: readonly number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at as number[]), b = toWorld(face as number[]);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
  }, { at, face });
}
async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings?.stats?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks, t?.vertices, vm._threeBuildings?.pending?.length ?? 0]);
    });
    const ok = now === last && JSON.parse(now)[0] === 0 && JSON.parse(now)[1] === 0;
    last = now;
    return ok;
  }, { timeout: 240_000, intervals: [2000] }).toBe(true);
}

for (const ride of RIDES) for (const variant of VARIANTS) {
  test(`world bytes: ${ride} ${variant.name}`, async ({ page }) => {
    test.setTimeout(1_200_000);
    const seen: string[] = [];
    // On the context, so the workers' cell fetches are seen (and served) too.
    await page.context().route(/\/data\/extracts\/amsterdam\/(.+)$/, route => {
      const rel = decodeURIComponent(/\/data\/extracts\/amsterdam\/([^?#]+)/.exec(route.request().url())![1]);
      seen.push(rel);
      if (!rel.startsWith('world-v1/')) return route.continue();
      const file = path.join(WORLD_DIR, rel.slice('world-v1/'.length));
      if (!file.startsWith(WORLD_DIR) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: readFileSync(file), contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    });
    if (process.env.BUNDLES_DIR) await page.context().route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = path.join(process.env.BUNDLES_DIR!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
    });
    // 4x CPU on the page (the main thread; see world-main above for the decode cost under it).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.addInitScript(() => { (window as any).__canalRecallTrees3d = false; (window as any).__canalRecallChunkFade = false; });
    if (ride === 'free') {
      await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
      await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
      await page.goto(`/canal-drive/${variant.query}`);
      await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
      await setHiddenSelect(page, 'travel-mode', 'car');
      await setHiddenSelect(page, 'view-mode', 'chase');
      await page.locator('[data-choice="route:free"]').click();
      await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
      await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
    } else await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: variant.query, abortHeavyTiles: true });
    await settle(page);
    const tally = () => {
      const by: Record<string, { requests: number; raw: number; sent: number }> = {};
      for (const rel of new Set(seen)) {
        const file = rel.startsWith('world-v1/') ? path.join(WORLD_DIR, rel.slice('world-v1/'.length)) : path.join(PUBLIC, 'data/extracts/amsterdam', rel);
        const b = bytesOf(file), c = by[category(rel)] ??= { requests: 0, raw: 0, sent: 0 };
        c.requests++; c.raw += b.raw; c.sent += b.sent;
      }
      return by;
    };
    const steps: Record<string, any> = { spawn: tally() };
    let metres = 0;
    if (ride === 'tour') for (const spot of SPOTS) {
      await park(page, spot.at, spot.face); await page.waitForTimeout(3000);
      await park(page, spot.at, spot.face); await settle(page);
      steps[spot.name] = tally();
    } else if (ride === 'seeded') {
      // The seeded route, replayed at RIDE_SPEED along the game's own routePath (4 steps a second), so the streamer
      // sees a rider's progress without the autopilot: a held throttle stops at the first T-junction.
      const t0 = Date.now();
      while (Date.now() - t0 < RIDE_MS) {
        const step = await page.evaluate((m: number) => {
          const g = (window as any).canalRecallGame, path = (g.routePath ?? []).map((q: any) => Array.isArray(q) ? q : [q.x, q.y]);
          const ppm = (window as any).PIXELS_PER_METER || 1;
          if (path.length < 2) return { done: true, moved: 0 };
          g._rideAt ??= 0; let left = m * ppm, at = g._rideAt, moved = 0;
          let x = g.player.x, y = g.player.y, angle = g.player.angle;
          while (left > 0 && at < path.length - 1) {
            const [ax, ay] = path[at], [bx, by] = path[at + 1], seg = Math.hypot(bx - ax, by - ay), from = Math.hypot(x - ax, y - ay);
            const go = Math.min(left, Math.max(0, seg - from));
            angle = Math.atan2(by - ay, bx - ax);
            if (go <= 0 || seg === 0) { at++; x = bx; y = by; continue; }
            x += Math.cos(angle) * go; y += Math.sin(angle) * go; left -= go; moved += go;
            if (seg - from - go <= 1e-6) at++;
          }
          g._rideAt = at; g.player.x = x; g.player.y = y; g.player.angle = angle; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
          return { done: at >= path.length - 1, moved: moved / ppm };
        }, RIDE_SPEED / 4);
        metres += step.moved;
        if (step.done) break;
        await page.waitForTimeout(250);
      }
      await settle(page);
      steps.ride = tally();
    } else {
      // Free Ride: hold the throttle; when the rider stands still (a junction waiting for a choice), tap a turn,
      // alternating right and left. Distance is the player's path length.
      await page.locator('#gameCanvas').focus();
      const t0 = Date.now(); let last = await page.evaluate(() => { const p = (window as any).canalRecallGame.player; return [p.x, p.y]; }), turn = 0;
      await page.keyboard.down('ArrowUp');
      while (Date.now() - t0 < RIDE_MS) {
        await page.waitForTimeout(1500);
        const now = await page.evaluate(() => { const p = (window as any).canalRecallGame.player; return [p.x, p.y, (window as any).PIXELS_PER_METER]; });
        const d = Math.hypot(now[0] - last[0], now[1] - last[1]) / (now[2] || 1); if (d < 60) metres += d; last = now; // a jump is a respawn, not riding
        if (d < 2) { const key = turn++ % 2 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(key); await page.waitForTimeout(400); await page.keyboard.up(key); }
      }
      await page.keyboard.up('ArrowUp');
      await settle(page);
      steps.ride = tally();
    }
    const world = await page.evaluate(() => {
      const city = (window as any).canalRecallGame.vectorMap._completeCity;
      return { usingWorldCells: !!city.usingWorldCells, decodeThread: city.world?.decodeThread ?? null, workers: city.world?.workerCount ?? null,
        decodeMs: city.world ? Object.fromEntries(city.world.decodeMs) : null, longestMessageMs: city.world?.longestMessageMs ?? null };
    });
    mkdirSync(OUT, { recursive: true });
    const final = steps[ride === 'tour' ? SPOTS[SPOTS.length - 1].name : 'ride'];
    const BUILDINGS = ['building-tiles', 'building-facts', 'roof-facts', 'building-overview', 'world-v1 cells', 'world-v1 index'];
    const buildingBytes = Object.fromEntries(Object.entries<any>(final).filter(([k]) => BUILDINGS.includes(k)).map(([k, c]) => [k, c.sent]));
    const stringsSent = seen.includes('world-v1/strings.bin') ? bytesOf(path.join(WORLD_DIR, 'strings.bin')).sent : 0;
    const dms = Object.values<number>(world.decodeMs ?? {}).sort((a, b) => a - b);
    const result = { ride, variant: variant.name, query: variant.query, worldDir: path.relative(process.cwd(), WORLD_DIR), cpuThrottle: CPU, rideMs: ride === 'tour' ? null : RIDE_MS, metres: Math.round(metres),
      buildingBytes, buildingTotal: Object.values<number>(buildingBytes).reduce((s, n) => s + n, 0), stringsSent,
      decode: dms.length ? { cells: dms.length, median: dms[dms.length >> 1], p95: dms[Math.min(dms.length - 1, Math.floor(dms.length * 0.95))], max: dms[dms.length - 1], thread: world.decodeThread } : null,
      steps, world, uniqueRequests: new Set(seen).size };
    writeFileSync(`${OUT}/${ride}-${variant.name}.json`, JSON.stringify(result, null, 2));
    const total = (by: Record<string, { sent: number }>) => Object.values(by).reduce((s, c) => s + c.sent, 0);
    console.log(`${ride} ${variant.name}`, JSON.stringify({ allData: total(final), buildingTotal: result.buildingTotal, buildingBytes, metres: result.metres, decode: result.decode }));
    if (variant.name.startsWith('world')) expect(world.usingWorldCells, 'world-v1 index served').toBe(true);
    // The fetch ring must not quietly grow back (#130 b74955c7c; #129 round 21 made a camera looking away from the
    // rider read its own view): Free Ride read 27 cells (2.0 MB) before the ring, about 13 cells (1.2 MB) with it, and
    // 11 cells (0.79 MB) on 2026-11-01 with and without the round-21 fix. Bound: 16 cells, 1.5 MB of cells.
    if (ride === 'free' && variant.name.startsWith('world')) {
      expect(result.decode?.cells ?? 0, 'Free Ride: world-v1 cells read (fetch ring)').toBeLessThanOrEqual(16);
      expect(buildingBytes['world-v1 cells'] ?? 0, 'Free Ride: world-v1 cell bytes (fetch ring)').toBeLessThanOrEqual(1.5e6);
    }
  });
}
