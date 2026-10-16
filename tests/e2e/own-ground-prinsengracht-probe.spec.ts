import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';
import { bridgesFromExtract } from './ownGroundBridges';

// Probe: frames of the Prinsengracht bridges from along the canal (~45° down), both directions.
//   OWN_GROUND=1 PW_PORT=4566 IDS=BRU0064,BRU0065 npx playwright test own-ground-prinsengracht-probe --project=desktop
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');
const OUT = process.env.OUT ?? 'artifacts/prinsengracht-probe';
const IDS = (process.env.IDS ?? 'BRU0060,BRU0061,BRU0063,BRU0064,BRU0065,BRU0066,BRU0067,BRU0068').split(',');

const offset = (b: { lng: number; lat: number }, east: number, north: number): [number, number] =>
  [b.lng + east / (111320 * Math.cos(b.lat * Math.PI / 180)), b.lat + north / 111320];

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #vector-map, #vector-map * { visibility: visible !important; }' });
  await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    for (const k of ['setPlayerBike', 'setPlayerBoat', 'setPlayerFerry', 'setPlayerTransit']) {
      const orig = vm[k]?.bind(vm);
      if (orig) vm[k] = (player: unknown, loader: unknown, _visible: boolean, ...rest: unknown[]) => orig(player, loader, false, ...rest);
    }
  });
}

async function look(page: Page, from: [number, number], up: number, to: [number, number]): Promise<void> {
  await page.evaluate(({ lng, lat }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng: to[0], lat: to[1] });
  await expect.poll(async () => {
    const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(3000);
  await page.evaluate(({ from, up, to }) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, ground.waterLevelAt(from) + up, to, ground.heightAt(to)));
    map.triggerRepaint();
  }, { from, up, to });
  await page.waitForTimeout(1500);
}

test('prinsengracht bridge probe', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  await boot(page);
  const P = info.project.name;
  const back = Number(process.env.BACK ?? 30), up = Number(process.env.UP ?? 24);
  for (const b of bridgesFromExtract(IDS)) {
    const rad = b.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    for (const [tag, s] of [['a', 1], ['b', -1]] as const) {
      await look(page, offset(b, uy * back * s, -ux * back * s), up, [b.lng, b.lat]);
      await page.screenshot({ path: `${OUT}/${P}-${b.id}-${tag}.png` });
    }
    if (process.env.BOAT) {
      await look(page, offset(b, uy * 25, -ux * 25), 1.2, [b.lng, b.lat]);
      await page.screenshot({ path: `${OUT}/${P}-${b.id}-boat.png` });
      await look(page, offset(b, -uy * 25, ux * 25), 1.2, [b.lng, b.lat]);
      await page.screenshot({ path: `${OUT}/${P}-${b.id}-boat2.png` });
    }
  }
});
