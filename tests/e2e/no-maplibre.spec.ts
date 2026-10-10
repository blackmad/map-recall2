import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// No-MapLibre proof page (docs/research/drop-maplibre-20261010.md). Opt-in:
//   NO_MAPLIBRE=1 PW_PORT=4419 npx playwright test no-maplibre --project=desktop
//   NO_MAPLIBRE=1 PW_PORT=4419 npx playwright test no-maplibre --project=iphone
// "game screens" runs the game (MapLibre), holds its start flight at city,
// district and route-preview zoom, teleports the bike onto Nassaukade for the
// street view, records each MapLibre camera and the route, then renders the
// own page with exactly those cameras: artifacts/own-map/<project>-<view>-*.png.
// "fixed camera path" times the own page over a deterministic city → route →
// street (handover) → orbit path, desktop and iPhone 4× CPU throttle.
test.skip(!process.env.NO_MAPLIBRE, 'set NO_MAPLIBRE=1');

const OUT = 'artifacts/own-map';
// One per project: the seeded route differs between the desktop and iPhone runs.
const fixture = (project: string) => `public/canal-drive/own-map-fixtures/route-game-${project}.json`;
// Nassaukade (way 1194778589), as in own-ground.spec.ts: inside an own-ground box, so the near field exists.
const RIDER = { lng: 4.87445, lat: 52.37286, bearing: 40 };
const pick = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), p99: +pick(v, 0.99).toFixed(2), max: +Math.max(0, ...v).toFixed(1), over50: v.filter(f => f > 50).length });

type MapCam = { lng: number; lat: number; zoom: number; pitch: number; bearing: number; fov: number };
const camParam = (c: MapCam) => `cam=${c.lng},${c.lat},${c.zoom},${c.pitch},${c.bearing},${c.fov}`;

type Probe = { lng: number; lat: number; x: number; y: number };
async function readCam(page: Page): Promise<MapCam & { probes: Probe[]; padding: unknown; canvas: { w: number; h: number; left: number; top: number } }> {
  return page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map, c = map.getCenter();
    const r = map.getCanvas().getBoundingClientRect();
    // Ground points where MapLibre itself says they are, to check the own camera against.
    const probes = [[0.25, 0.3], [0.75, 0.3], [0.5, 0.5], [0.25, 0.8], [0.75, 0.8]].map(([fx, fy]) => {
      const ll = map.unproject([r.width * fx, r.height * fy]);
      const p = map.project(ll);
      return { lng: ll.lng, lat: ll.lat, x: p.x, y: p.y };
    });
    return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), fov: map.transform?.fov ?? 36.87,
      probes, padding: map.getPadding?.(), canvas: { w: r.width, h: r.height, left: r.left, top: r.top } };
  });
}
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded()), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1200);
}

async function openOwn(page: Page, query: string): Promise<any> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`/canal-drive/no-maplibre.html?${query}`);
  await page.waitForFunction(() => (window as any).__ownMap?.status?.loaded || (window as any).__ownMap?.status?.error, null, { timeout: 90_000 });
  const status = await page.evaluate(() => (window as any).__ownMap.status);
  expect(status.error, String(status.error)).toBeUndefined();
  expect(errors).toEqual([]);
  return status;
}

/** Two screenshots side by side with captions, via a throwaway page. */
async function sideBySide(page: Page, left: string, right: string, out: string, caption: [string, string]): Promise<void> {
  const b64 = (p: string) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  const vp = page.viewportSize()!;
  const w = vp.width < 600 ? vp.width : Math.round(vp.width / 2);
  await page.setViewportSize({ width: w * 2 + 12, height: Math.round(vp.height * (w / vp.width)) + 34 });
  await page.setContent(`<body style="margin:0;background:#0f172a;font:600 14px Helvetica,Arial;color:#e2e8f0;display:flex;gap:12px">
    ${[left, right].map((p, i) => `<figure style="margin:0;width:${w}px"><figcaption style="padding:8px 6px">${caption[i]}</figcaption><img src="${b64(p)}" style="width:${w}px;display:block"></figure>`).join('')}</body>`);
  await page.screenshot({ path: out });
  await page.setViewportSize(vp);
}

test('game screens (MapLibre) vs own map, same cameras', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const P = info.project.name;
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._intro), { timeout: 60_000 }).toBe(true);
  // Hold the flight's overview.
  await page.evaluate(() => { (window as any).canalRecallGame._intro.plan.hold = 1e9; });
  await settle(page);
  const route = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, l = g.osmLoader;
    const path = (g._liveRoutePath || g.routePath || []).map((p: any) => vm.worldToLngLat(p.x, p.y, l));
    return { path, start: vm.worldToLngLat(g.player.x, g.player.y, l), finish: vm.worldToLngLat(g.track.finishPoint.x, g.track.finishPoint.y, l) };
  });
  const cams: Record<string, Awaited<ReturnType<typeof readCam>>> = {};
  cams.route = await readCam(page);
  await page.screenshot({ path: `${OUT}/${P}-route-maplibre.png` });
  // City and district: the same held overview, rescaled to a target MapLibre zoom.
  for (const [view, target] of [['city', 11.6], ['district', 14.5]] as const) {
    await page.evaluate(({ target, zoom }) => { const i = (window as any).canalRecallGame._intro; i.plan.from.zoom *= 2 ** (target - zoom); }, { target, zoom: (await readCam(page)).zoom });
    await settle(page);
    cams[view] = await readCam(page);
    await page.screenshot({ path: `${OUT}/${P}-${view}-maplibre.png` });
  }
  // Street: land, then put the bike on Nassaukade (inside an own-ground box).
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._intro.elapsed = 1e9; g._intro.plan.hold = 0; });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && !(window as any).canalRecallGame._intro, null, { timeout: 30_000 });
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, RIDER);
  await page.waitForTimeout(8000);
  await settle(page);
  cams.street = await readCam(page);
  await page.screenshot({ path: `${OUT}/${P}-street-maplibre.png` });

  mkdirSync('public/canal-drive/own-map-fixtures', { recursive: true });
  writeFileSync(fixture(P), JSON.stringify({ note: 'Captured from the game by tests/e2e/no-maplibre.spec.ts (seeded default route).', ...route, rider: [RIDER.lng, RIDER.lat, RIDER.bearing] }, null, 1));
  const statuses: Record<string, unknown> = {};
  for (const view of ['city', 'district', 'route', 'street'] as const) {
    const rider = view === 'street' ? `&rider=${RIDER.lng},${RIDER.lat},${RIDER.bearing}` : `&rider=${route.start[0]},${route.start[1]},0`;
    statuses[view] = await openOwn(page, `${camParam(cams[view])}&route=game-${P}${rider}`);
    await page.waitForTimeout(view === 'street' || view === 'district' ? 6000 : 2500);
    // Same camera, same pixels: every MapLibre probe must land where the own camera projects it.
    const misfit = await page.evaluate((probes) => Math.max(...probes.map(p => { const o = (window as any).__ownMap.project(p.lng, p.lat); return Math.hypot(o.x - p.x, o.y - p.y); })), cams[view].probes);
    statuses[view] = { misfitPx: misfit, status: await page.evaluate(() => (window as any).__ownMap.status), labels: await page.evaluate(() => (window as any).__ownMap.placed), info: await page.evaluate(() => (window as any).__ownMap.info) };
    console.log(view, 'probe misfit px', misfit.toFixed(2), JSON.stringify(cams[view].padding), JSON.stringify(cams[view].canvas));
    await page.screenshot({ path: `${OUT}/${P}-${view}-own.png` });
    await sideBySide(page, `${OUT}/${P}-${view}-maplibre.png`, `${OUT}/${P}-${view}-own.png`, `${OUT}/${P}-${view}-side-by-side.png`, [`Game today (MapLibre) · z ${cams[view].zoom.toFixed(2)} · pitch ${cams[view].pitch.toFixed(0)}°`, 'Own map (three.js + canvas labels, own extracts)']);
  }
  writeFileSync(`${OUT}/${P}-cameras.json`, JSON.stringify({ cams, route: { points: route.path.length, start: route.start, finish: route.finish }, statuses }, null, 2));
});

test('labels: the street under question is never drawn', async ({ page }) => {
  test.setTimeout(180_000);
  // Every name is "earned" (labels=all) except the one being asked; ride the whole camera path.
  await openOwn(page, `path=1&labels=all&ask=Nassaukade&rider=${RIDER.lng},${RIDER.lat},${RIDER.bearing}`);
  await page.waitForTimeout(22_000);
  const r = await page.evaluate(() => { const s = (window as any).__ownMap; return { ever: [...s.everPlaced], status: s.status }; });
  expect(r.ever.length, 'labels were drawn at all').toBeGreaterThan(20);
  expect(r.ever.filter((t: string) => /nassaukade/i.test(t)), 'question name never placed').toEqual([]);
  expect(r.status.labels.withheld).toBeGreaterThan(0);
});

const results: unknown[] = [];
for (const variant of [{ label: 'fixed camera path (labels as game: earned only)', query: '' }, { label: 'fixed camera path, every name labelled (worst case)', query: '&labels=all' }]) {
  test(`perf: ${variant.label}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const status = await openOwn(page, `route=game-desktop&rider=${RIDER.lng},${RIDER.lat},${RIDER.bearing}&hud=0${variant.query}`);
    // Warm the near field, POIs and the footprints along the path once, then measure a full pass.
    await page.evaluate(() => { const s = (window as any).__ownMap; s.opts.path = true; });
    await page.waitForTimeout(21_000);
    const cdp = await page.context().newCDPSession(page);
    const throttle = info.project.name === 'iphone' ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(() => { const s = (window as any).__ownMap; s.setView('city'); s.opts.path = true; s.frames.length = 0; s.renderMs.length = 0; s.labelMs.length = 0; s.labelCounts.length = 0; });
    await page.waitForTimeout(20_000);
    const raw = await page.evaluate(() => {
      const s = (window as any).__ownMap, mem = (performance as any).memory;
      return { labelWorst: s.labelWorst, frames: s.frames.slice(3), renderMs: s.renderMs.slice(3), labelMs: s.labelMs.slice(3), labelCounts: s.labelCounts.slice(3), info: s.info, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, status: s.status, dpr: s.opts.dpr };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sample = {
      label: variant.label, project: info.project.name, throttle, dpr: raw.dpr,
      frames: summary(raw.frames), frameCpu: summary(raw.renderMs), labelCpu: summary(raw.labelMs),
      labels: { median: pick(raw.labelCounts, 0.5), max: Math.max(...raw.labelCounts) }, labelWorst: raw.labelWorst,
      drawCallsEnd: raw.info.calls, trianglesEnd: raw.info.triangles, heapMB: raw.heapMB, bytes: raw.status.bytes, loadMs: status.ms, nearField: raw.status.nearField,
    };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/perf-${info.project.name}.json`, JSON.stringify(results, null, 2));
    expect(raw.frames.length).toBeGreaterThan(50);
  });
}
