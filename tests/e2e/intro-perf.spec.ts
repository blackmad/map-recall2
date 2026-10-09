import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// What does the start flight (route overview → rider) cost? Opt-in:
//   PERF_INTRO=1 PW_PORT=4388 npx playwright test intro-perf --project=iphone
// Compares the forced intro with the webdriver default (no intro): time from
// route submit until the rider is in control, long tasks, worst frames during
// that window, and bytes fetched. Results: artifacts/perf/intro-perf-<project>.json
test.skip(!process.env.PERF_INTRO, 'set PERF_INTRO=1 to measure');

const results: Record<string, unknown>[] = [];
for (const [run, intro] of [true, false, true, false].entries()) {
  test(`start ${intro ? "with" : "without"} intro flight #${run}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const cdp = await page.context().newCDPSession(page);
    if (info.project.name === 'iphone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript((force) => {
      const w = window as any;
      if (force) w.__canalRecallForceIntro = true;
      w.__long = [];
      new PerformanceObserver(list => { for (const e of list.getEntries()) w.__long.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true });
      w.__frames = []; let last = performance.now();
      const tick = (now: number) => { w.__frames.push({ t: now, d: now - last }); last = now; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      // Phase marks: when the flight object appears and when it is cleared.
      w.__phase = {};
      const poll = () => { const g = w.canalRecallGame; if (g) { if (g._intro && !w.__phase.flightStart) w.__phase.flightStart = performance.now(); if (w.__phase.flightStart && !g._intro && !w.__phase.flightEnd) w.__phase.flightEnd = performance.now(); } requestAnimationFrame(poll); };
      requestAnimationFrame(poll);
    }, intro);
    let bytes = 0;
    page.on('response', async r => { const len = Number(r.headers()['content-length'] || 0); bytes += len; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
    const submitted = await page.evaluate(() => performance.now());
    const bytesAtSubmit = bytes;
    await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 180_000, polling: 100 });
    const inControl = await page.evaluate(() => performance.now());
    await page.waitForTimeout(3000); // the first seconds of riding stream the neighbourhood
    const raw = await page.evaluate(([from, to]) => {
      const w = window as any;
      const inWin = (t: number) => t >= from && t <= to + 3000;
      const longs = w.__long.filter((e: any) => inWin(e.t));
      const frames = w.__frames.filter((f: any) => inWin(f.t)).map((f: any) => f.d).sort((a: number, b: number) => b - a);
      const ph = w.__phase;
      const phase = { toFlight: ph.flightStart ? Math.round(ph.flightStart - from) : null, flight: ph.flightStart && ph.flightEnd ? Math.round(ph.flightEnd - ph.flightStart) : null,
        longBeforeFlight: Math.round(longs.filter((e: any) => !ph.flightStart || e.t < ph.flightStart).reduce((s: number, e: any) => s + e.d, 0)),
        longInFlight: Math.round(longs.filter((e: any) => ph.flightStart && e.t >= ph.flightStart && (!ph.flightEnd || e.t < ph.flightEnd)).reduce((s: number, e: any) => s + e.d, 0)) };
      return { phase, longCount: longs.length, longTotal: Math.round(longs.reduce((s: number, e: any) => s + e.d, 0)), worstFrames: frames.slice(0, 5).map(Math.round), over100: frames.filter((d: number) => d > 100).length };
    }, [submitted, inControl]);
    const sample = { project: info.project.name, intro, msToControl: Math.round(inControl - submitted), ...raw, mbAfterSubmit: +((bytes - bytesAtSubmit) / 1048576).toFixed(1) };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync('artifacts/perf', { recursive: true });
    writeFileSync(`artifacts/perf/intro-perf-${info.project.name}.json`, JSON.stringify(results, null, 2));
    expect(inControl).toBeGreaterThan(submitted);
  });
}
