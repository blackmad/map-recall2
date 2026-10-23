import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { bridgesFromExtract, type Bridge } from './ownGroundBridges';

// Phones free the ground's vertex arrays after upload; layersAt() walks them.
test.beforeEach(({ page }) => page.addInitScript(() => { (window as any).__canalRecallKeepGroundArrays = true; }));

// Bridge decks on the own ground (`?ownGround=1`), lane bridges-elevation
// 2026-10-13 (docs/handoffs/lane-bridges-elevation-20261013.md). Opt-in, needs
// the GPU and the network basemap:
//   OWN_GROUND=1 PW_PORT=4449 npx playwright test own-ground-bridges --project=desktop
//   SHOT_TAG=before …   names the shots artifacts/own-ground-bridges/<project>-<tag>-<id>-<eye|air>.png
// Named regressions: the user's Westerkerk bridge (Nieuwe-Wercksbrug,
// Rozengracht over the Prinsengracht, screenshot 2026-10-13), Raampoort,
// Rijckerbrug, BRU0166, BRU0044, BRU0067, the Magere Brug, the Blauwbrug. Each
// is checked in the game for its deck height (crown vs approach), and its
// attachment: the deck top fills the footprint out to the railings, so the
// rider never sees water between the road and the parapet.
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-bridges';
const TAG = process.env.SHOT_TAG ?? 'after';

const NAMED = ['BRU0063', 'BRU0165', 'BRU0167', 'BRU0166', 'BRU0044', 'BRU0067', 'BRU0242', 'BRU0236'];
// Lane bridge-kit 2026-10-13: the user's two spots (shot 1: a Prinsengracht-class bridge, Reesluis BRU0064 taken as the
// representative; shot 2: the Brouwersgracht/Herengracht junction, the West-Indische Huisbrug BRU0017 with the
// Melkmeisjesbrug footbridge BRU0016 beside it), the Magere Brug, the Blauwbrug and the Torensluis (BRU0009).
//   BRIDGES=KIT … uses this list.
const KIT = ['BRU0064', 'BRU0017', 'BRU0016', 'BRU0242', 'BRU0236', 'BRU0009'];
// Railings that stood across the road at the abutments (user 2026-10-16, "why do the gates dip into the road?";
// railingRuns.ts railRuns): the Nieuwe-Wercksbrug, BRU0166 by the Bilderdijkgracht mouth, the Angenietje Swarthofbrug.
//   BRIDGES=RAILINGS … uses this list; BUNDLES_DIR=<dir> serves *.bundle.js from <dir> (a staged build, the after).
const RAILINGS = ['BRU0063', 'BRU0166', 'BRU0067'];
const ONLY = process.env.BRIDGES === 'KIT' ? KIT : process.env.BRIDGES === 'RAILINGS' ? RAILINGS : process.env.BRIDGES?.split(',');
/** Fallback footprints whose long axis is not the road (the bridge is wider than long): the crossing bearing. */
const BEARING_OVERRIDE: Record<string, number> = { BRU0165: 96, BRU0009: 104 };
/** Half-widths past the default 22 m water-view offset (the Torensluis is ~42 m wide). */
const SIDE_OFFSET: Record<string, number> = { BRU0009: 45 };

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  const dir = process.env.BUNDLES_DIR;
  if (dir) await page.context().route(/\/js\/[^/?]+\.bundle\.js/, route => {
    const file = `${dir}/${new URL(route.request().url()).pathname.split('/').pop()}`;
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }) : route.continue();
  });
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const vm = g.vectorMap;
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

async function settle(page: Page, ms = 5000): Promise<Record<string, any>> {
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

/** Freeze the game's camera and look from `eye` (metres off the bridge centre along/across its axis, height above the surface there) at the centre. */
async function look(page: Page, b: Bridge, eye: { along: number; across: number; up: number; water?: boolean }, target: { along: number; up: number } = { along: 0, up: 0 }): Promise<void> {
  await page.evaluate(({ b, eye, target }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    const mLng = 111320 * Math.cos(b.lat * Math.PI / 180), mLat = 111320;
    const at = (along: number, across: number): [number, number] => [b.lng + (ux * along + uy * across) / mLng, b.lat + (uy * along - ux * across) / mLat];
    const from = at(eye.along, eye.across), to = at(target.along, 0);
    map.setMaxPitch?.(85);
    const opts = map.calculateCameraOptionsFromTo(from, (eye.water ? ground.waterLevelAt(from) : ground.heightAt(from)) + eye.up, to, ground.heightAt(to) + target.up);
    map.jumpTo(opts);
    map.triggerRepaint();
  }, { b, eye, target });
  await page.waitForTimeout(1500);
}

/** Numbers for one bridge: crown vs approaches, and what a top-down ray hits across the deck at the crown. */
async function measure(page: Page, b: Bridge): Promise<Record<string, any>> {
  return page.evaluate(({ b }) => {
    const vm = (window as any).canalRecallGame.vectorMap, ground = vm._ownGround, api = (window as any).CanalRecallOwnGround;
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    const mLng = 111320 * Math.cos(b.lat * Math.PI / 180), mLat = 111320;
    const at = (along: number, across: number): [number, number] => [b.lng + (ux * along + uy * across) / mLng, b.lat + (uy * along - ux * across) / mLat];
    const half = b.lengthM / 2;
    const profile: number[] = [];
    for (let s = -half - 10; s <= half + 10; s += 1) profile.push(+ground.heightAt(at(s, 0)).toFixed(2));
    const approach = Math.max(ground.heightAt(at(-half - 10, 0)), ground.heightAt(at(half + 10, 0)));
    const crown = Math.max(...profile);
    // Across the deck at its centre: what is on top every 0.5 m out to ±12 m.
    const across: { off: number; top: string | null; z: number | null }[] = [];
    for (let o = -12; o <= 12; o += 0.5) {
      const [x, y] = api.toLocal(...at(0, o));
      const hit = ground.layersAt(x, y);
      // Topmost uncut layer within 1.5 m of the deck (railings, frames and beams above it are not the deck).
      const first = hit.hits.filter((h: any) => !h.cut && h.z < ground.heightAt(at(0, o)) + 0.3)[0];
      across.push({ off: o, top: first ? first.layer : null, z: first ? +first.z.toFixed(2) : null });
    }
    return { crown: +crown.toFixed(2), approach: +approach.toFixed(2), rise: +(crown - approach).toFixed(2), profile, across, deck: ground.deckInfo ? ground.deckInfo(b.id) : null };
  }, { b });
}

test('named bridges: deck height, attachment, shots at 1.7 m and from the air', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const report: Record<string, unknown> = {};
  for (const b of bridgesFromExtract(ONLY ?? NAMED)) {
    if (BEARING_OVERRIDE[b.id] !== undefined) b.bearing = BEARING_OVERRIDE[b.id];
    const back = b.lengthM / 2 + 40;
    // Ride position: on the approach, facing the deck.
    await teleport(page, { lng: b.lng - Math.sin(b.bearing * Math.PI / 180) * back / (111320 * Math.cos(b.lat * Math.PI / 180)), lat: b.lat - Math.cos(b.bearing * Math.PI / 180) * back / 111320, bearing: b.bearing });
    const s = await settle(page);
    expect(s.errors ?? [], JSON.stringify(s.errors)).toEqual([]);
    const numbers = await measure(page, b);
    await look(page, b, { along: -(b.lengthM / 2 + 12), across: 0, up: 1.7 }, { along: 0, up: 1.0 });
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${b.id}-eye.png` });
    await look(page, b, { along: -b.lengthM * 0.5 - 8, across: 22 + b.lengthM * 0.3, up: 16 + b.lengthM * 0.2 });
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${b.id}-air.png` });
    const off = SIDE_OFFSET[b.id] ?? 22;
    await look(page, b, { along: 0, across: off, up: 1.0, water: true }, { along: 0, up: -0.8 });
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${b.id}-water.png` });
    // From the side, a canal-boat's view at 40 m, and the far ring at 300 m (lane bridge-kit).
    await look(page, b, { along: 6, across: off + 18, up: 2.5, water: true }, { along: 0, up: -0.5 });
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${b.id}-side.png` });
    await look(page, b, { along: -120, across: 150, up: 200 });
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${b.id}-far.png` });
    report[b.id] = { ...b, ...numbers };
  }
  writeFileSync(`${OUT}/${info.project.name}-${TAG}-report.json`, JSON.stringify(report, null, 1));
  expect(errors).toEqual([]);
});

// Frame cost riding over bridges (chase view, a fixed straight ride across
// BRU0063, BRU0236 and BRU0242 at 5.5 m/s; iPhone at 4× CPU throttle), for the lane's before/after:
//   PERF_RIDE=1 OWN_GROUND=1 SHOT_TAG=after PW_PORT=4449 npx playwright test own-ground-bridges -g "frame cost" --project=desktop
test('bridge ride frame cost', async ({ page }, info) => {
  test.skip(!process.env.PERF_RIDE, 'set PERF_RIDE=1');
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await boot(page);
  const out: Record<string, unknown> = {};
  for (const b of bridgesFromExtract(['BRU0063', 'BRU0236', 'BRU0242'])) {
    const rad = b.bearing * Math.PI / 180, mLng = 111320 * Math.cos(b.lat * Math.PI / 180), back = b.lengthM / 2 + 40;
    const start = { lng: b.lng - Math.sin(rad) * back / mLng, lat: b.lat - Math.cos(rad) * back / 111320, bearing: b.bearing };
    await teleport(page, start);
    await settle(page, 3000);
    // iPhone: 4× CPU throttle like ride-perf.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.name === 'iphone' ? 4 : 1 });
    const frames: number[] = await page.evaluate(({ start, rad, total }) => new Promise<number[]>(resolve => {
      const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
      const x0 = l._lastOffsetX + (start.lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      const y0 = l._lastOffsetY - (start.lat - l._lastCenterLat) * 111320 * ppm;
      const t0 = performance.now(), dts: number[] = [];
      let last = t0;
      const step = (now: number) => {
        dts.push(now - last); last = now;
        const d = Math.min(total, (now - t0) / 1000 * 5.5);
        g.player.x = x0 + Math.sin(rad) * d * ppm; g.player.y = y0 - Math.cos(rad) * d * ppm;
        Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
        if (d < total) requestAnimationFrame(step); else resolve(dts.slice(3));
      };
      requestAnimationFrame(step);
    }), { start, rad, total: back * 2 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = [...frames].sort((a, c) => a - c), q = (k: number) => +sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length))].toFixed(2);
    out[b.id] = { frames: frames.length, median: q(0.5), p95: q(0.95), p99: q(0.99), over33: frames.filter(f => f > 33.4).length, triangles: (await status(page)).triangles };
  }
  console.log(JSON.stringify(out));
  writeFileSync(`${OUT}/${info.project.name}-${TAG}-perf.json`, JSON.stringify(out, null, 1));
});
