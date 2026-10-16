import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';

// Road paint under own ground (user 2026-10-14, live play: "road painting in
// ownground still not there"). Named regression: the Nassaukade /
// Frederik Hendrikplantsoen junction by the Marnixplein bridge over the
// Singelgracht, OSM node n2306196651 (4.8776303, 52.3785795; ways 1319606706,
// 1214420927 Nassaukade, 532325875 and 1319606707 Frederik Hendrikplantsoen),
// signalised (crossing nodes n12522331485, n12522331489 carry
// crossing:signals=yes; the extract has the matching crossing ways
// 1352089473 crossing=traffic_signals). The camera looks at the junction
// from the cockpit; the white paint pixels inside a box around the node's
// screen position are counted.
//
//   OWN_GROUND=1 PW_PORT=4515 npx playwright test own-ground-paint --project=desktop
//   BUNDLES_DIR=<dir> serves *.bundle.js from <dir> (the before measurement).
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = process.env.PAINT_SHOTS_OUT || 'artifacts/own-ground-paint';
const JUNCTION = { lng: 4.8776303, lat: 52.3785795 };
/** The rider sits on the Nassaukade ~35 m south of the junction, facing it (cockpit view: the chase camera's trees hide the mouth). */
const APPROACH = { lng: 4.87746, lat: 52.37828, bearing: 20 };
/** Measured 2026-10-14 (desktop 1440×900, cockpit, 640×320 box): 0.99 % without the junction markings (stop lines, cycle lanes and
 * crossings carried through, wider lines), 1.46 % with them. The bound sits between, nearer the after. */
const MIN_WHITE_SHARE = 0.0125;

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  const dir = process.env.BUNDLES_DIR;
  if (dir) await page.context().route(/\/js\/[^/?]+\.bundle\.js/, route => {
    const file = `${dir}/${new URL(route.request().url()).pathname.split('/').pop()}`;
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }) : route.continue();
  });
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  // ROADS=bgt: the roads-v1 BGT road partition (phase 1 opt-in, `?roads=bgt`); shots land in a separate directory for before/after.
  if (process.env.ROADS === 'bgt') await page.addInitScript(() => { (window as any).__canalRecallRoads = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'cockpit', abortHeavyTiles: false, enterRacing: false, query: '?ownGround=1' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

test('paint: the Nassaukade / Frederik Hendrikplantsoen junction carries its road markings', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, b = bearing * Math.PI / 180;
    const pose = {
      x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm,
      y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm,
      angle: Math.atan2(-Math.cos(b), Math.sin(b)),
    };
    const hold = () => { Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 }); requestAnimationFrame(hold); };
    hold();
  }, APPROACH);
  await expect.poll(async () => {
    const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length;
  }, { timeout: 180_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(5000);
  const at = await page.evaluate(({ lng, lat }) => (window as any).canalRecallGame.vectorMap.map.project([lng, lat]), JUNCTION);
  const vw = page.viewportSize()!, w = Math.min(640, vw.width), h = Math.min(320, vw.height);
  const box = { left: Math.round(Math.min(vw.width - w, Math.max(0, at.x - w / 2))), top: Math.round(Math.min(vw.height - h, Math.max(0, at.y - h / 2))), width: w, height: h };
  const png = await page.screenshot({ path: `${OUT}/${info.project.name}-junction.png` });
  const { data, info: meta } = await sharp(png).extract(box).raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let i = 0; i < data.length; i += meta.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) >= 205 && Math.max(r, g, b) - Math.min(r, g, b) <= 28) white++;
  }
  const share = white / (box.width * box.height);
  writeFileSync(`${OUT}/${info.project.name}-junction.json`, JSON.stringify({ junction: JUNCTION, screen: at, box, white, share, bundles: process.env.BUNDLES_DIR ?? null }, null, 1));
  expect(errors).toEqual([]);
  expect(share, `white paint share ${(100 * share).toFixed(2)} % of the junction box`).toBeGreaterThanOrEqual(MIN_WHITE_SHARE);
});
