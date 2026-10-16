import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Own-ground prototype (docs/research/own-ground-20261009.md). Opt-in:
//   OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground --project=desktop
//   OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground --project=iphone
// "ride cost" measures the prototype's autopilot ride the way ride-perf
// measures the game (12 s, iphone 4x CPU throttle).
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground';
// Leidsegracht (way 7372771, one-way south-west) toward the Abel Weetnietbrug (BRU0044, masonry arch).
const RIDER_B = { lng: 4.88557, lat: 52.36728, bearing: 240 };

const pick = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), p99: +pick(v, 0.99).toFixed(2), over50: v.filter(f => f > 50).length });

async function openProto(page: Page, query: string): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`/canal-drive/own-ground.html?${query}`);
  await page.waitForFunction(() => (window as any).__ownGround?.ready || (window as any).__ownGround?.status?.error, null, { timeout: 180_000 });
  const status = await page.evaluate(() => (window as any).__ownGround.status);
  expect(status.error, String(status.error)).toBeUndefined();
  expect(errors).toEqual([]);
  return status;
}

test('canal belt: Herengracht / Leidsegracht', async ({ page }, info) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const rider = `rider=${RIDER_B.lng},${RIDER_B.lat},${RIDER_B.bearing}`;
  const status = await openProto(page, `box=leidsegracht&auto=0&hud=0&${rider}&cam=chase&prefer=Leidsegracht&highlight=Herengracht`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-5-leidsegracht-chase.png` });
  await openProto(page, `box=leidsegracht&auto=0&hud=0&${rider}&cam=map&mapcam=${RIDER_B.lng},${RIDER_B.lat},18.6,60,${RIDER_B.bearing},36.87&prefer=Leidsegracht&highlight=Herengracht`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-6-leidsegracht-map.png` });
  // The arch bridge from the water: deck, parapets and vault meeting the quay walls.
  await openProto(page, `box=leidsegracht&auto=0&hud=0&${rider}&cam=free&eye=4.88432,52.36668,-0.9&look=4.88458,52.36679,0.0`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-7-arch-from-water.png` });
  writeFileSync(`${OUT}/${info.project.name}-leidsegracht.json`, JSON.stringify(status, null, 2));
});

const variants = [
  { label: 'nassaukade chase, all effects', query: 'box=nassaukade&cam=chase' },
  { label: 'nassaukade chase, no effects', query: 'box=nassaukade&cam=chase&fx=0' },
  { label: 'nassaukade chase, ground only (no buildings)', query: 'box=nassaukade&cam=chase&buildings=0' },
  { label: 'leidsegracht chase, all effects', query: 'box=leidsegracht&cam=chase' },
];
const results: unknown[] = [];
for (const v of variants) {
  test(`ride cost: ${v.label}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const status = await openProto(page, `auto=1&hud=0&${v.query}`);
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    const throttle = info.project.name === 'iphone' ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(() => { const s = (window as any).__ownGround; s.frames.length = 0; s.renderMs.length = 0; });
    await page.waitForTimeout(12_000);
    const raw = await page.evaluate(() => {
      const s = (window as any).__ownGround, mem = (performance as any).memory;
      return { frames: s.frames.slice(5), renderMs: s.renderMs.slice(5), info: s.info, dpr: s.opts.dpr, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, build: s.build, groundBuildMs: s.groundBuildMs, groundHeapMB: s.groundHeapMB, stats: s.stats };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sample = { label: v.label, project: info.project.name, throttle, dpr: raw.dpr, frames: summary(raw.frames), renderCpu: summary(raw.renderMs), drawCalls: raw.info.calls, trianglesDrawn: raw.info.triangles, heapMB: raw.heapMB, ground: status.ground, build: raw.build, groundBuildMs: raw.groundBuildMs, loadMs: status.loadMs };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/perf-${info.project.name}.json`, JSON.stringify(results, null, 2));
    expect(raw.frames.length).toBeGreaterThan(20);
  });
}

// Ground build under the throttle (the ride-cost runs throttle only after loading).
test('build cost: ground under CPU throttle', async ({ page }, info) => {
  test.setTimeout(300_000);
  const throttle = info.project.name === 'iphone' ? 4 : 1;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const out: Record<string, unknown>[] = [];
  for (const box of ['nassaukade', 'leidsegracht']) {
    const status = await openProto(page, `box=${box}&auto=0&hud=0&buildings=0`);
    const build = await page.evaluate(() => ({ build: (window as any).__ownGround.build, groundBuildMs: (window as any).__ownGround.groundBuildMs, groundHeapMB: (window as any).__ownGround.groundHeapMB }));
    out.push({ box, throttle, ...build, ground: status.ground, relief: status.relief });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(JSON.stringify(out));
  writeFileSync(`${OUT}/build-${info.project.name}.json`, JSON.stringify(out, null, 2));
});
