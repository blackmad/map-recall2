import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Own-ground defect spots (lane own-ground-defects 2026-10-13): junction cycle-lane smear,
// De Clercqstraat area:highway, the own-ground edge from the air (Da Costakade 13).
// Chase shot, a 300 m shot and a 40 m shot per spot; SHOT_TAG=before|after. Opt-in:
//   OWN_GROUND=1 PW_PORT=4460 SHOT_TAG=before npx playwright test own-ground-defects --project=desktop
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-defects';
const TAG = process.env.SHOT_TAG ?? 'after';
type Place = { lng: number; lat: number; bearing: number };

export const DEFECT_SPOTS: [string, Place][] = [
  ['rozengracht-marnixstraat', { lng: 4.8748, lat: 52.37195, bearing: 70 }],
  ['rozengracht-junction', { lng: 4.874103, lat: 52.371797, bearing: 250 }],
  ['de-clercqstraat-22', { lng: 4.8696, lat: 52.37077, bearing: 250 }],
  ['bilderdijk-crossing', { lng: 4.870286, lat: 52.370936, bearing: 70 }],
];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

async function teleport(page: Page, p: Place): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const status = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());

async function settle(page: Page, ms = 4000): Promise<Record<string, any>> {
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 180_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

/** Freeze the camera `dist` m behind the spot along its bearing, `up` m above, looking at it. */
async function look(page: Page, p: Place, dist: number, up: number): Promise<void> {
  await page.evaluate(({ p, dist, up }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    const rad = p.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    const from: [number, number] = [p.lng - ux * dist / (111320 * Math.cos(p.lat * Math.PI / 180)), p.lat - uy * dist / 111320];
    const to: [number, number] = [p.lng, p.lat];
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, ground.heightAt(from) + up, to, ground.heightAt(to)));
    map.triggerRepaint();
  }, { p, dist, up });
  await page.waitForTimeout(2500);
}

/**
 * The user's aerial shot (2026-10-13): the Da Costakade 13 destination seen from ~300 m above Nieuw-West / Bos en Lommer,
 * looking east. The own ground used to end in a hard edge at the resident cells (flat basemap beyond, white streets and
 * light-blue water). AERIAL_RADII (default "1400,2000,2600,3400") sweeps the resident radius for the cost table; the
 * first entry is the "before" (no growth), SHOT_TAG=before also restores the basemap's own colours.
 */
/** Rider (screen centre) over Bos en Lommer; zoom 15.8 / pitch 76 puts the camera ~285 m up, ~1.1 km west of it, the top of the screen ~2.9 km east. */
const AERIAL = { lng: 4.845, lat: 52.3745, bearing: 90, zoom: 15.8, pitch: 76 };

test('aerial edge: Da Costakade 13 from 300 m above Nieuw-West, resident radius sweep', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const radii = (process.env.AERIAL_RADII ?? (TAG === 'before' ? '1400' : '1400,2000,2600,3400')).split(',').map(Number);
  await teleport(page, AERIAL);
  await settle(page);
  const rows: Record<string, unknown>[] = [];
  for (const radius of radii) {
    const zoom = await page.evaluate(({ AERIAL, radius, before }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map, ground = vm._ownGround;
      vm.__syncOriginal = vm.__syncOriginal || vm.sync;
      vm.sync = () => {};
      ground.opts.aerialRadiusM = radius;
      if (before) vm._setBasemapGroundHidden(false);
      map.setMaxPitch?.(85);
      map.jumpTo({ center: [AERIAL.lng, AERIAL.lat], zoom: AERIAL.zoom, pitch: AERIAL.pitch, bearing: AERIAL.bearing });
      ground.update([AERIAL.lng, AERIAL.lat], AERIAL.zoom, AERIAL.pitch);
      map.triggerRepaint();
      return AERIAL.zoom;
    }, { AERIAL, radius, before: TAG === 'before' });
    await expect.poll(async () => { const s = await status(page); return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length; }, { timeout: 240_000, intervals: [1000] }).toBe(true);
    await page.waitForTimeout(3000);
    // Frame cost with the camera held: rAF cadence and the map's own render time over 180 frames.
    const perf = await page.evaluate(async () => {
      const map = (window as any).canalRecallGame.vectorMap.map, times: number[] = [];
      let last = performance.now();
      for (let i = 0; i < 180; i++) { map.triggerRepaint(); await new Promise<void>(r => requestAnimationFrame(() => r())); const t = performance.now(); times.push(t - last); last = t; }
      times.sort((a, b) => a - b);
      return { medianMs: +times[90].toFixed(1), p95Ms: +times[171].toFixed(1) };
    });
    const s = await status(page);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-aerial-da-costakade-r${radius}.png` });
    rows.push({ radius, zoom: +zoom.toFixed(2), residentRadius: s.radiusM, cells: Object.keys(s.cells).length, lod0: Object.values(s.cells).filter(v => v === 0).length, triangles: s.triangles, geometryMB: s.geometryMB, ...perf, buildMsMedian: s.buildMsMedian, latencyMsMedian: s.latencyMsMedian });
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  writeFileSync(`${OUT}/${info.project.name}-${TAG}-aerial-radius-sweep.json`, JSON.stringify(rows, null, 1));
  expect(errors).toEqual([]);
});

/**
 * Far-ring cell arrival: a straight ride east over Bos en Lommer / Oud-West at 20 m/s (cells arrive every few seconds), once
 * with the arrival dissolve off (fadeMs 0) and once on (400 ms). Reports rAF deltas and how many frames had a cell dissolving.
 *   PERF_RIDE=1 OWN_GROUND=1 PW_PORT=4460 SHOT_TAG=after npx playwright test own-ground-defects -g fade --project=desktop
 */
test('far-ring cells dissolve in: ride frame cost with and without the fade', async ({ page }, info) => {
  test.skip(!process.env.PERF_RIDE, 'set PERF_RIDE=1');
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const start = { lng: 4.835, lat: 52.3745, bearing: 90 };
  const out: Record<string, unknown> = {};
  for (const fadeMs of [0, 400, 0, 400]) {
    await teleport(page, start);
    await settle(page, 3000);
    await page.evaluate(ms => { (window as any).canalRecallGame.vectorMap._ownGround.opts.fadeMs = ms; }, fadeMs);
    const r = await page.evaluate(({ start }) => new Promise<{ dts: number[]; fadingFrames: number; arrived: number }>(resolve => {
      const g = (window as any).canalRecallGame, l = g.osmLoader, ground = g.vectorMap._ownGround, ppm = (0, eval)('PIXELS_PER_METER') as number;
      const x0 = l._lastOffsetX + (start.lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      const y0 = l._lastOffsetY - (start.lat - l._lastCenterLat) * 111320 * ppm;
      const before = new Set(Object.keys(ground.status().cells));
      const t0 = performance.now(), dts: number[] = [], total = 1200;
      let last = t0, fadingFrames = 0;
      const step = (now: number) => {
        dts.push(now - last); last = now;
        if (ground.fading.size) fadingFrames++;
        const d = Math.min(total, (now - t0) / 1000 * 20);
        g.player.x = x0 + d * ppm; g.player.y = y0;
        Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
        if (d < total) requestAnimationFrame(step);
        else resolve({ dts: dts.slice(3), fadingFrames, arrived: Object.keys(ground.status().cells).filter(k => !before.has(k)).length });
      };
      requestAnimationFrame(step);
    }), { start });
    const sorted = [...r.dts].sort((a, b) => a - b), q = (k: number) => +sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length))].toFixed(2);
    const row = { fadeMs, frames: r.dts.length, median: q(0.5), p95: q(0.95), p99: q(0.99), over33: r.dts.filter(f => f > 33.4).length, fadingFrames: r.fadingFrames, cellsArrived: r.arrived };
    (out[`fade${fadeMs}`] ??= [] as unknown[]) as unknown[];
    (out[`fade${fadeMs}`] as unknown[]).push(row);
    console.log(JSON.stringify(row));
  }
  writeFileSync(`${OUT}/${info.project.name}-${TAG}-fade-perf.json`, JSON.stringify(out, null, 1));
  expect(errors).toEqual([]);
});

/** A cell mid-dissolve (the dissolve slowed to 12 s so a shot lands in it), and no shader errors in the console. */
test('far-ring cells dissolve in: mid-dissolve shot, no shader errors', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const logs: string[] = [];
  page.on('console', m => { if (/shader|webgl|glsl|program/i.test(m.text())) logs.push(m.text().slice(0, 300)); });
  const errors = await boot(page);
  await teleport(page, AERIAL);
  await settle(page, 2000);
  await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, ground = vm._ownGround;
    ground.opts.fadeMs = 12000;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    // Jump the ring 1.6 km east: a column of cells arrives.
    const east: [number, number] = [4.8685, 52.3745];
    ground.update(east, 15.8, 76);
    vm.map.jumpTo({ center: east, zoom: 15.8, pitch: 76, bearing: 90 });
  });
  await expect.poll(async () => { const s = await status(page); return Object.keys(s.pending ?? {}).length === 0 && !s.queued; }, { timeout: 240_000, intervals: [500] }).toBe(true);
  await page.waitForTimeout(4000);
  const fading = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._ownGround.fading.size);
  await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-fade-mid-dissolve.png` });
  console.log(JSON.stringify({ fadingCells: fading, consoleErrors: logs }));
  expect(logs).toEqual([]);
  expect(errors).toEqual([]);
});

test('defect spots: chase, 300 m and 40 m shots', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const only = process.env.SPOTS?.split(',');
  for (const [name, place] of DEFECT_SPOTS) {
    if (only && !only.includes(name)) continue;
    await teleport(page, place);
    await settle(page);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-chase.png` });
    await look(page, place, 300, 120);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-300m.png` });
    await look(page, place, 40, 25);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-40m.png` });
    await look(page, place, 3, 55);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-top.png` });
  }
  expect(errors).toEqual([]);
});
