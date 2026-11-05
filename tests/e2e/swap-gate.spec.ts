import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { openRoute } from './helpers';
import { summariseSwaps, swapSummaryMarkdown, type SwapRecord } from '../../src/canalRecall/engine/swapProbe';

// The pop-in gate (#217, lane E4, 2026-11-05): what changes on buildings that are already there while riding.
//   PERF_SWAPS=1 PW_PORT=4623 /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test swap-gate \
//     --project=desktop --workers=1 --trace off --reporter=line          (and --project=iphone)
// The seeded default route under `?engine=own`, settled at the spawn, then replayed along the game's routePath at
// SWAP_SPEED m/s (40: 120 px/s, scripts/pop-in.mjs's ride; the game's top speed is 260 px/s, 87 m/s) for SWAP_RIDE_S seconds (60). src/canalRecall/engine/swapProbe.ts logs every swap
// (shell → detail, detail rebuilds, extras, detail → shell, ground lifts, landmark arrivals/LODs, tree rebuilds) per
// object with its distance from the rider and its visible on-screen area (CSS px², occlusion included) right after the
// frame that shows it. Gate: no swapped object ≥ 400 px² within 120 m. SWAP_QS adds query flags (A/B: `&swapFade=0`),
// SWAP_REPORT_ONLY=1 reports without failing, BUNDLES_DIR serves bundles built from this checkout.
// Output: artifacts/perf/swaps/<project><label>.{json,md}.
test.skip(!process.env.PERF_SWAPS, 'set PERF_SWAPS=1 to measure');

const RIDE_S = Number(process.env.SWAP_RIDE_S ?? 60);
const SPEED = Number(process.env.SWAP_SPEED ?? 40);
const QS = process.env.SWAP_QS ?? '';
const LABEL = process.env.SWAP_LABEL ? `-${process.env.SWAP_LABEL}` : '';

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

test('pop-in gate: no swap ≥ 400 px² within 120 m on the seeded ride', async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?engine=own&glCounters=1${QS}` });
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._sharedFrame?.renderer && !!vm._threeBuildings?.ready; }), { timeout: 180_000 }).toBe(true);
  // Hold the rider at the spawn until the city there is built (the start cover hides that phase).
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await settle(page);
  const probe = buildSync({ entryPoints: ['src/canalRecall/engine/swapProbe.ts'], bundle: true, format: 'iife', globalName: 'CanalSwapProbe', write: false, target: 'es2022' });
  await page.addScriptTag({ content: probe.outputFiles[0].text });
  const setup = await page.evaluate(([speed]) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, sf = vm._sharedFrame, tb = vm._threeBuildings, P = (window as any).CanalSwapProbe;
    const l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number; // a script-level const, not on window
    const lngLatOf = (x: number, y: number): [number, number] => [l._lastCenterLng + (x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm), l._lastCenterLat - (y - l._lastOffsetY) / (111320 * ppm)];
    const probe = new P.SwapProbe({ THREE: sf.THREE, scene: sf.scene, camera: sf.camera, renderer: sf.renderer });
    const hooked = P.installSwapHooks(vm, probe, () => tb.rider ?? lngLatOf(g.player.x, g.player.y));
    (window as any).__swapProbe = probe;
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
    return { hooked, routeM: Math.round((cum[cum.length - 1] || 0) / ppm), detailZoom: tb.detailZoom, start: lngLatOf(g.player.x, g.player.y) };
  }, [SPEED]);
  console.log('swap probe', JSON.stringify(setup));
  for (const [k, ok] of Object.entries(setup.hooked)) expect(ok, `hooked ${k}`).toBe(true);
  await page.evaluate(() => (window as any).__canalPerf?.gl?.markWarm?.());
  await page.waitForTimeout(RIDE_S * 1000);
  const raw = await page.evaluate(() => {
    const probe = (window as any).__swapProbe;
    probe.on = false;
    // Program links while riding (engine/glCounters.ts), the probe's own id materials left out: a swap fade must not link.
    const gl = (window as any).__canalPerf?.gl?.report?.();
    const links = (gl?.programs ?? []).filter((e: any) => e.kind === 'link' && !String(e.owner).includes('swap-probe')).map((e: any) => String(e.owner).slice(0, 160));
    return { records: probe.records, measured: probe.measured, measureMs: Math.round(probe.measureMs), rideM: Math.round((window as any).__swapRide()), links };
  });
  const records = raw.records as SwapRecord[];
  const summary = summariseSwaps(records);
  const title = `${info.project.name}${LABEL}: ${raw.rideM} m in ${RIDE_S} s at ${SPEED} m/s${QS ? ` (${QS})` : ''}, detail z${setup.detailZoom}; ${raw.measured} swaps measured in ${raw.measureMs} ms`;
  const md = swapSummaryMarkdown(summary, title);
  mkdirSync('artifacts/perf/swaps', { recursive: true });
  const base = `artifacts/perf/swaps/${info.project.name}${LABEL}`;
  writeFileSync(`${base}.json`, JSON.stringify({ when: new Date().toISOString(), qs: QS, speed: SPEED, rideS: RIDE_S, setup, rideM: raw.rideM, links: raw.links, summary, records, errors }, null, 1));
  writeFileSync(`${base}.md`, `${md}\n\nProgram links while riding (probe excluded): ${raw.links.length}\n${raw.links.map((l: string) => `- ${l}`).join('\n')}\n`);
  console.log(md);
  console.log(`program links while riding: ${raw.links.length}`, raw.links.slice(0, 8));
  expect(errors, 'page errors').toEqual([]);
  expect(raw.rideM, 'the rider rode').toBeGreaterThan(RIDE_S * SPEED * 0.5);
  if (!process.env.SWAP_REPORT_ONLY) expect(summary.gate.failures, `swapped objects ≥ ${summary.gate.minAreaPx} px² within ${summary.gate.nearM} m`).toBe(0);
});
