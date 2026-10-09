import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Riding frame cost along the recipe street (Bilderdijkstraat), same instrumentation and method as ride-perf.spec.ts:
// 4x CPU throttle on the iphone project, 12 s of ArrowUp from a parked start at the south end of the row.
// Baseline: same spec with the recipe GLBs blocked, so the layer keeps the generic host buildings:
//   PERF_STREET=1 PW_PORT=4413 npx playwright test recipe-street-perf --project=iphone     # recipe houses
//   PERF_STREET=1 PW_PORT=4413 STREET_BASELINE=1 npx playwright test recipe-street-perf --project=iphone   # recipe GLBs blocked
test.skip(!process.env.PERF_STREET, 'set PERF_STREET=1 to measure');

const catalogue = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8'));
const houses: any[] = catalogue.models.filter((m: any) => m.source === 'building-recipes');
const baseline = !!process.env.STREET_BASELINE;
const pick = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), totalMs: +v.reduce((a, b) => a + b, 0).toFixed(0) });
const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number) => { const r = bearingDeg * Math.PI / 180; return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320]; };

async function parkAt(page: Page, at: number[], face: number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

for (const rep of [1, 2]) test(`ride the recipe street ${baseline ? '(baseline)' : '(recipe houses)'} #${rep}`, async ({ page }, info) => {
  test.setTimeout(300_000);
  // Baseline = same server and code, recipe GLBs blocked: the layer keeps the generic host buildings (what the street was before).
  if (baseline) await page.route(/recipe-bilder-\d+\.glb/, route => route.abort());
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  const bearing = 90 + houses[0].instance.northOffsetDegrees, dir = [Math.sin(bearing * Math.PI / 180), Math.cos(bearing * Math.PI / 180)];
  const sorted = [...houses].sort((a, b) => (a.anchor[0] * dir[0] + a.anchor[1] * dir[1]) - (b.anchor[0] * dir[0] + b.anchor[1] * dir[1]));
  const outward = (bearing + 90) % 360, at = ahead(ahead(sorted[0].anchor, bearing, -25), outward, 9), face = ahead(at, bearing, 40);
  await parkAt(page, at, face);
  const ids = houses.map(h => h.id);
  if (!baseline) await page.waitForFunction((need: string[]) => {
    const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks, c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
    return l && need.filter(id => l.shown.has(id)).length >= 8;
  }, ids, { timeout: 120_000, polling: 1000 });
  else await page.waitForTimeout(25_000);
  await parkAt(page, at, face);
  await page.waitForTimeout(6000);
  const cdp = await page.context().newCDPSession(page);
  const throttle = info.project.name === 'iphone' ? 4 : 1;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map;
    const t: Record<string, number[]> = { frame: [], mapRender: [], landmarkRender: [] };
    w.__perf = t;
    const wrap = (obj: any, key: string, bucket: string) => { const o = obj[key].bind(obj); obj[key] = (...a: unknown[]) => { const s = performance.now(); try { return o(...a); } finally { t[bucket].push(performance.now() - s); } }; };
    wrap(map, '_render', 'mapRender');
    const layer = vm._signatureLandmarks?.layer;
    if (layer?.render) wrap(layer, 'render', 'landmarkRender');
    let last = performance.now();
    const tick = (now: number) => { t.frame.push(now - last); last = now; if (!w.__stopFrames) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(12_000);
  await page.keyboard.up('ArrowUp');
  const raw = await page.evaluate((ids: string[]) => {
    const w = window as any; w.__stopFrames = true;
    const l = w.canalRecallGame.vectorMap._signatureLandmarks, mem = (performance as any).memory;
    const p = w.canalRecallGame.player;
    return { t: w.__perf, shown: l ? ids.filter(id => l.shown.has(id)).length : 0, entries: l?._entries?.length ?? 0, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, endPlayer: { x: Math.round(p.x), y: Math.round(p.y) } };
  }, ids);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const frames = raw.t.frame.slice(5);
  const sample = { label: baseline ? 'baseline (main, no recipe houses)' : 'recipe houses', rep, project: info.project.name, throttle,
    frames: { ...summary(frames), p99: +pick(frames, 0.99).toFixed(2), over50: frames.filter((f: number) => f > 50).length, over100: frames.filter((f: number) => f > 100).length },
    mapRender: summary(raw.t.mapRender), landmarkRender: summary(raw.t.landmarkRender), recipeHousesShown: raw.shown, entries: raw.entries, heapMB: raw.heapMB, endPlayer: raw.endPlayer };
  console.log('street-perf', JSON.stringify(sample));
  mkdirSync('artifacts/recipe-street', { recursive: true });
  writeFileSync(`artifacts/recipe-street/perf-${baseline ? 'baseline' : 'recipe'}-${info.project.name}-${rep}.json`, JSON.stringify(sample, null, 1));
  expect(frames.length).toBeGreaterThan(20);
});
