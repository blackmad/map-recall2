import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { ROAD_SPOTS as DIAGNOSE_SPOTS, spotViewpoint } from '../../src/canalRecall/ownGround/roadRegressions';

// Roads under own ground (`?ownGround=1`): the user's three road spots, the
// De Clercqstraat block and the three named deck regressions, chase view,
// desktop and phone. Writes shots to ROADS_SHOTS_OUT (default
// artifacts/own-ground-roads/after) for before/after review. Opt-in:
//   OWN_GROUND=1 PW_PORT=4448 npx playwright test own-ground-roads --project=desktop
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = process.env.ROADS_SHOTS_OUT || (process.env.ROADS !== '0' ? 'artifacts/own-ground-roads/bgt' : 'artifacts/own-ground-roads/after');
type Place = { lng: number; lat: number; bearing: number };

export const ROAD_SPOTS: [string, Place][] = [
  ['de-clercqstraat-bilderdijk', { lng: 4.87335, lat: 52.37162, bearing: 250 }],
  ['de-clercqstraat-kostverloren', { lng: 4.8696, lat: 52.37077, bearing: 250 }],
  ['nassaukade-raampoort', { lng: 4.8749, lat: 52.3737, bearing: 75 }],
  ['rozengracht-marnixstraat', { lng: 4.8748, lat: 52.37195, bearing: 70 }],
  ['ryckerbrug', { lng: 4.8738, lat: 52.37178, bearing: 70 }],
  ['ryckerbrug-west', { lng: 4.8752, lat: 52.37215, bearing: 250 }],
  ['BRU0166', { lng: 4.87445, lat: 52.37286, bearing: 40 }],
  ['BRU0044', { lng: 4.8875, lat: 52.3665, bearing: 300 }],
  ['BRU0067', { lng: 4.882711, lat: 52.366289, bearing: 0 }],
  // roads-v1 (lane roads-runtime 2026-10-16): the Kinkerstraat over the Da Costagracht, looking east from the west quay;
  // the Marnixstraat busway crossing the red fietsstraat at the Frederik Hendrikplantsoen, looking north.
  ['kinkerstraat-dacostagracht', { lng: 4.87243, lat: 52.36731, bearing: 64 }],
  ['marnixstraat-plantsoen', { lng: 4.87643, lat: 52.37421, bearing: 20 }],
  // The road-diagnose spots (roadRegressions ROAD_SPOTS, 2026-10-23): judged beside the orthophoto.
  ...DIAGNOSE_SPOTS.map(s => [s.id, spotViewpoint(s)] as [string, Place]),
  // Ground divots (issue #53, 2026-10-24): Stationsplein in front of Centraal, looking north-north-east at the station
  // front over the metro and bike-garage stairwells; De Ruijterkade on the IJ side heading east into the Michiel de
  // Ruijtertunnel ramp beside the bus station.
  ['stationsplein', { lng: 4.8995, lat: 52.37765, bearing: 20 }],
  ['de-ruijterkade-busstation', { lng: 4.8968, lat: 52.38125, bearing: 118 }],
  ['de-ruijterkade-ramp', { lng: 4.89875, lat: 52.38074, bearing: 115 }],
];

async function boot(page: Page, viewMode = 'chase'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  // The BGT road partition is the default since 2026-10-16; ROADS=0 draws the OSM bands (before/after shots in separate directories).
  if (process.env.ROADS === '0') await page.addInitScript(() => { (window as any).__canalRecallRoads = false; });
  // COMPACT_GROUND=1|0: force the compact ground meshes on or off (compactMesh.ts; phones default on), for a like-for-like A/B.
  if (process.env.COMPACT_GROUND) await page.addInitScript((on: boolean) => { (window as any).__canalRecallCompactGround = on; }, process.env.COMPACT_GROUND === '1');
  await openRoute(page, { travelMode: 'car', viewMode, abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

async function teleport(page: Page, p: Place): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const status = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());

async function settle(page: Page, ms = 3500): Promise<Record<string, any>> {
  const settled = async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  };
  try {
    await expect.poll(settled, { timeout: 180_000, intervals: [1000] }).toBe(true);
  } catch (e) {
    const s = await status(page);
    throw new Error(`ground never settled: ${JSON.stringify({ ready: s.ready, queued: s.queued, pending: s.pending, cells: s.cells, errors: s.errors })}`);
  }
  await page.waitForTimeout(ms);
  return status(page);
}

test('roads: shots at the user spots and the deck regressions', async ({ page }, info) => {
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const only = process.env.ROADS_ONLY?.split(',');
  const report: Record<string, unknown> = {};
  for (const [name, place] of ROAD_SPOTS) {
    if (only && !only.includes(name)) continue;
    await teleport(page, place);
    const s = await settle(page);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${name}.png` });
    if (process.env.ROADS_TOPDOWN) {
      // Straight down over the rider (pitch 0, zoom 18.5), then back to the chase view.
      await page.evaluate(() => {
        const m = (window as any).canalRecallGame.vectorMap.map, jump = m.jumpTo.bind(m);
        (m as any).__chaseJump ??= jump;
        m.jumpTo = (o: any) => (m as any).__chaseJump({ ...o, pitch: 0, zoom: 18.5 });
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/${info.project.name}-${name}-top.png` });
      await page.evaluate(() => { const m = (window as any).canalRecallGame.vectorMap.map; m.jumpTo = (m as any).__chaseJump; });
    }
    report[name] = { place, cells: s.cells, triangles: s.triangles, geometryMB: s.geometryMB, errors: s.errors };
    expect(s.errors, `${name}: ${JSON.stringify(s.errors)}`).toEqual([]);
  }
  writeFileSync(`${OUT}/${info.project.name}-roads.json`, JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
});

/** Jan Evertsenstraat looking west past the Chassébuurt (user shot 2026-10-13): beyond the resident cells the ground was bare. */
const FAR_FIELD: Place = { lng: 4.8575, lat: 52.37125, bearing: 263 };

test('far field: shots with the basemap ground hidden and shown under own ground', async ({ page }, info) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  await teleport(page, FAR_FIELD);
  const s = await settle(page);
  // Look out toward the horizon from above the rider (pitch 76°, zoom 16.2), as in the user's shot:
  // the view then reaches past the resident cells (1.4 km).
  await page.evaluate(() => {
    const m = (window as any).canalRecallGame.vectorMap.map, jump = m.jumpTo.bind(m);
    m.jumpTo = (o: any) => jump({ ...o, pitch: 76, zoom: 16.2 });
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${info.project.name}-far-field.png` });
  const probe = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    const order = vm.map.getLayersOrder ? vm.map.getLayersOrder() : vm.map.getStyle().layers.map((l: any) => l.id);
    const style = vm.map.getStyle().layers;
    const first3d = style.findIndex((l: any) => l.type === 'fill-extrusion' || (l.type === 'custom' && l.renderingMode === '3d') || l.type === 'custom');
    return { basemapHidden: vm._basemapGroundHidden, first3d: style[first3d]?.id, first3dIndex: first3d, transport: style.findIndex((l: any) => l['source-layer'] === 'transportation'), count: order.length };
  });
  writeFileSync(`${OUT}/${info.project.name}-far-field.json`, JSON.stringify({ status: s, probe }, null, 2));
  if (process.env.FAR_FIELD_TOGGLE) {
    await page.evaluate(() => (window as any).canalRecallGame.vectorMap._setBasemapGroundHidden(false));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-far-field-shown.png` });
  }
  expect(errors).toEqual([]);
});
