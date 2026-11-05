import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { openRoute, setHiddenSelect, useEngine } from './helpers';
import { summariseSwaps, swapSummaryMarkdown, type SwapRecord } from '../../src/canalRecall/engine/swapProbe';

// The pop-in gate (#217, lane E4, 2026-11-05): what changes on buildings that are already there while riding.
//   PERF_SWAPS=1 PW_PORT=4623 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test swap-gate \
//     --project=desktop --workers=1 --trace off --reporter=line          (and --project=iphone)
// The pinned ride (RACE below) under `?engine=own`, settled at the spawn, then replayed along the game's routePath at
// SWAP_SPEED m/s (40: 120 px/s, scripts/pop-in.mjs's ride; the game's top speed is 260 px/s, 87 m/s) for SWAP_RIDE_S
// seconds (60). src/canalRecall/engine/swapProbe.ts logs every swap (shell → detail, detail rebuilds, buildings a
// rebuilt chunk gains or loses, extras, detail → shell, ground lifts, landmark arrivals/LODs, tree rebuilds) per object
// with its distance from the rider and its visible on-screen area (CSS px², occlusion included) right after the frame
// that shows it. Gate: no swapped object ≥ 400 px² within 120 m. SWAP_QS adds query flags (A/B, the pre-#217 swaps:
// `&swapFade=0&routeAhead=0&ringFollow=0&detailLinger=0`), SWAP_REPORT_ONLY=1 reports without failing, SWAP_TRACE=1
// adds the buildings layer's install/drop/fade steps to the JSON, BUNDLES_DIR serves bundles built from this checkout.
// Output: artifacts/perf/swaps/<project><label>.{json,md}.
test.skip(!process.env.PERF_SWAPS, 'set PERF_SWAPS=1 to measure');

const RIDE_S = Number(process.env.SWAP_RIDE_S ?? 60);
const SPEED = Number(process.env.SWAP_SPEED ?? 40);
const QS = process.env.SWAP_QS ?? '';
const LABEL = process.env.SWAP_LABEL ? `-${process.env.SWAP_LABEL}` : '';
// The ride, pinned (a share link's `#race=`): the seeded default route is not stable from run to run (the seeded
// Math.random is consumed by loading as well), and a gate needs the same streets every time. Regression location:
// Willemspark (Koninginneweg) to the Van Gogh Museum, the default route the first measurements (#217) rode.
// SWAP_RACE=lat,lng,startLat,startLng,finishLat,finishLng rides another; SWAP_RACE=seeded rides the seeded default.
const RACE = process.env.SWAP_RACE ?? '52.354358,4.855467,52.354358,4.855467,52.358400,4.881100';

async function openRide(page: Page) {
  if (RACE === 'seeded') return openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?engine=own&glCounters=1${QS}` });
  await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await useEngine(page);
  await page.goto(`/canal-drive/?engine=own&glCounters=1&travel=car${QS}#race=${RACE}`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await setHiddenSelect(page, 'view-mode', 'chase');
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
}

async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings;
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks?.size, t?.pending?.length ?? 0, t?.inflight?.size ?? 0, t?.staged?.length ?? 0]);
    });
    const v = JSON.parse(now), ok = now === last && v[0] === 0 && v[1] === 0 && v[5] === 0 && v[6] === 0 && v[7] === 0;
    last = now;
    return ok;
  }, { timeout: 240_000, intervals: [2000] }).toBe(true);
}

test('pop-in gate: no swap ≥ 400 px² within 120 m on the pinned ride', async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
  // The hooks catch their own failures (a probe bug must not break the ride) and warn: those are this spec's errors too.
  page.on('console', m => { if (m.text().startsWith('[swap-probe]')) errors.push(m.text().slice(0, 400)); });
  const probe = buildSync({ entryPoints: ['src/canalRecall/engine/swapProbe.ts'], bundle: true, format: 'iife', globalName: 'CanalSwapProbe', write: false, target: 'es2022' });
  await openRide(page);
  // Hooked as soon as the layers exist (before the buildings are ready: the spawn's chunks install on ready, and a chunk
  // the hooks never saw install cannot be diffed when it is rebuilt).
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._sharedFrame?.renderer && !!vm._threeBuildings && !!vm._inventoryTrees; }), { timeout: 180_000, intervals: [50] }).toBe(true);
  // Hold the rider at the spawn until the city there is built (the start cover hides that phase).
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await page.addScriptTag({ content: probe.outputFiles[0].text });
  const hooked = await page.evaluate(([traceOn]) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, sf = vm._sharedFrame, tb = vm._threeBuildings, P = (window as any).CanalSwapProbe;
    const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number; // a script-level const, not on window
    const lngLatOf = (x: number, y: number): [number, number] => [l._lastCenterLng + (x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm), l._lastCenterLat - (y - l._lastOffsetY) / (111320 * ppm)];
    const probe = new P.SwapProbe({ THREE: sf.THREE, scene: sf.scene, camera: sf.camera, renderer: sf.renderer });
    const hooked = P.installSwapHooks(vm, probe, () => tb.rider ?? lngLatOf(g.player.x, g.player.y));
    (window as any).__swapProbe = probe;
    // Installed before the spawn settles, not recording: the hooks learn each chunk's faces as it installs, so a chunk
    // rebuilt during the ride diffs against what it drew (else a rebuild counted every building it holds).
    probe.on = false;
    // SWAP_TRACE=1: the buildings layer's own steps (install/drop/fade end/detail ownership), for diagnosing a swap.
    const trace: any[] = (window as any).__swapTrace = [];
    if (traceOn) for (const name of ['install', 'dropChunk', 'endFade', 'refreshDetailOwnership']) {
      const original = tb[name];
      if (typeof original !== 'function') continue;
      tb[name] = function (this: any, ...args: any[]) {
        const result = original.apply(this, args);
        trace.push({ t: Math.round(performance.now()), step: name, key: typeof args[0] === 'string' ? args[0] : undefined, flag: args[1] === true || args[2] === true ? [args[1], args[2]] : undefined,
          owned: this.installedDetailIds?.size, fading: [...(this.fading?.keys?.() ?? [])].filter((k: string) => !k.startsWith('coarse:')), outgoing: [...(this.outgoing?.keys?.() ?? [])], detail: [...(this.detailTiles ?? [])] });
        return result;
      };
    }
    return hooked;
  }, [!!process.env.SWAP_TRACE] as const);
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame.vectorMap._threeBuildings?.ready), { timeout: 180_000 }).toBe(true);
  // Chunks that installed before the hooks (the engine builds the spawn as it starts) are rebuilt once while the rider
  // waits, so the hooks know what each draws; the probe is not recording yet.
  await page.evaluate(() => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
    for (const [key, entry] of tb.chunks) if (entry?.mesh && !String(key).startsWith('boats:')) tb.pending.push(key, () => tb.rebuild(key, entry.source));
    tb.pump();
  });
  await settle(page);
  const setup = await page.evaluate(([speed]) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, probe = (window as any).__swapProbe;
    const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const lngLatOf = (x: number, y: number): [number, number] => [l._lastCenterLng + (x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm), l._lastCenterLat - (y - l._lastOffsetY) / (111320 * ppm)];
    // Rails: the game's own routePath at `speed` m/s (no autopilot: a held throttle stops at junctions).
    const path: [number, number][] = (g.routePath ?? []).map((q: any) => Array.isArray(q) ? q : [q.x, q.y]);
    const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
    let at = 0, seg = 1, last = performance.now();
    // By the wall clock, not the game's (capped) step: a slow frame must not slow the ride the streamers see.
    g.player.update = function (dt: number) {
      const now = performance.now(), wall = Math.min(0.5, (now - last) / 1000); last = now;
      at = Math.min(cum[cum.length - 1], at + speed * ppm * wall);
      dt = wall;
      while (seg < path.length - 1 && cum[seg] < at) seg++;
      const a = path[seg - 1], b = path[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      let d = Math.atan2(b[1] - a[1], b[0] - a[0]) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.x = a[0] + (b[0] - a[0]) * f; this.y = a[1] + (b[1] - a[1]) * f; this.angle += d * Math.min(1, dt * 6);
      this.speed = at < cum[cum.length - 1] ? speed * ppm : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    };
    (window as any).__swapRide = () => at / ppm;
    probe.start();
    return { routeM: Math.round((cum[cum.length - 1] || 0) / ppm), detailZoom: tb.detailZoom, start: lngLatOf(g.player.x, g.player.y) };
  }, [SPEED] as const);
  console.log('swap probe', JSON.stringify({ hooked, ...setup }));
  for (const [k, ok] of Object.entries(hooked as Record<string, boolean>)) expect(ok, `hooked ${k}`).toBe(true);
  await page.evaluate(() => (window as any).__canalPerf?.gl?.markWarm?.());
  await page.waitForTimeout(RIDE_S * 1000);
  const raw = await page.evaluate(() => {
    const probe = (window as any).__swapProbe;
    probe.on = false;
    // Program links while riding (engine/glCounters.ts), the probe's own id materials left out: a swap fade must not link.
    const gl = (window as any).__canalPerf?.gl?.report?.();
    const links = (gl?.programs ?? []).filter((e: any) => e.kind === 'link' && !String(e.owner).includes('swap-probe')).map((e: any) => String(e.owner).slice(0, 160));
    return { rebuilds: probe.rebuilds, trace: (window as any).__swapTrace, records: probe.records, measured: probe.measured, measureMs: Math.round(probe.measureMs), rideM: Math.round((window as any).__swapRide()), links };
  });
  const records = raw.records as SwapRecord[];
  const summary = summariseSwaps(records);
  const title = `${info.project.name}${LABEL}: ${raw.rideM} m in ${RIDE_S} s at ${SPEED} m/s${QS ? ` (${QS})` : ''}, detail z${setup.detailZoom}; ${raw.measured} swaps measured in ${raw.measureMs} ms`;
  const md = swapSummaryMarkdown(summary, title);
  mkdirSync('artifacts/perf/swaps', { recursive: true });
  const base = `artifacts/perf/swaps/${info.project.name}${LABEL}`;
  writeFileSync(`${base}.json`, JSON.stringify({ when: new Date().toISOString(), qs: QS, speed: SPEED, rideS: RIDE_S, setup, rideM: raw.rideM, links: raw.links, summary, records, errors, rebuilds: raw.rebuilds, trace: raw.trace }, null, 1));
  writeFileSync(`${base}.md`, `${md}\n\nProgram links while riding (probe excluded): ${raw.links.length}\n${raw.links.map((l: string) => `- ${l}`).join('\n')}\n`);
  console.log(md);
  console.log(`program links while riding: ${raw.links.length}`, raw.links.slice(0, 8));
  expect(errors, 'page errors').toEqual([]);
  expect(raw.rideM, 'the rider rode').toBeGreaterThan(RIDE_S * SPEED * 0.5);
  if (!process.env.SWAP_REPORT_ONLY) expect(summary.gate.failures, `swapped objects ≥ ${summary.gate.minAreaPx} px² within ${summary.gate.nearM} m`).toBe(0);
});
