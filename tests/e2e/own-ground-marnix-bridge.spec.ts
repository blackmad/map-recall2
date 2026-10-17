import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Frames of the Marnixstraat bridge over the Bullebakssluis mouth (BRU0160, user 2026-10-16 "no idea what this bridge
// is trying to be"): the chase angle along Marnixstraat and both sides over the water. Opt-in, needs the GPU:
//   OWN_GROUND=1 PW_PORT=4558 npx playwright test own-ground-marnix-bridge --project=desktop
//   ROADS=bgt …   the roads-v1 survey; SHOT_DIR=… where the frames land (default artifacts/own-ground-marnix-bridge)
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = process.env.SHOT_DIR ?? 'artifacts/own-ground-marnix-bridge';
// SHOT_AT=lng,lat aims the same views at another bridge (SHOT_NAME prefixes the files); ROADS=0 the OSM bands.
// SHOT_LIST=name:lng,lat;name:lng,lat shoots several places in one boot.
const PLACES: [string, [number, number]][] = process.env.SHOT_LIST
  ? process.env.SHOT_LIST.split(';').map(e => { const [n, c] = e.split(':'); return [n, c.split(',').map(Number) as [number, number]]; })
  : [[process.env.SHOT_NAME ?? '', (process.env.SHOT_AT?.split(',').map(Number) as [number, number] | undefined) ?? [4.87615, 52.37375]]];
const offset = (p: [number, number], east: number, north: number): [number, number] =>
  [p[0] + east / (111320 * Math.cos(p[1] * Math.PI / 180)), p[1] + north / 111320];

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  if (process.env.ROADS) { const on = process.env.ROADS === 'bgt'; await page.addInitScript(on => { (window as any).__canalRecallRoads = on; }, on); }
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

async function lookFrom(page: Page, from: [number, number], up: number, to: [number, number], toUp: number, onWater: boolean): Promise<void> {
  await page.evaluate(({ to, from }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    const me = (from[0] - to[0]) * Math.cos(from[1] * Math.PI / 180), mn = from[1] - to[1], b = Math.atan2(-me, -mn);
    g.player.x = l._lastOffsetX + (to[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (to[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { to, from });
  await expect.poll(async () => {
    const s = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(3000);
  await page.evaluate(({ from, up, to, toUp, onWater }) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, (onWater ? ground.waterLevelAt(from) : ground.heightAt(from)) + up, to, ground.heightAt(to) + toUp));
    map.triggerRepaint();
  }, { from, up, to, toUp, onWater });
  await page.waitForTimeout(2000);
}

// SHOT_CAMS=name:fromLng,fromLat,up,toLng,toLat,toUp;… absolute cameras (up/toUp over the riding surface) instead of
// the views around SHOT_LIST's places: a panorama's own standpoint, side by side with it.
const CAMS: [string, [number, number], number, [number, number], number][] = (process.env.SHOT_CAMS ?? '').split(';').filter(Boolean).map(e => {
  const [n, c] = e.split(':'), v = c.split(',').map(Number);
  return [n, [v[0], v[1]], v[2], [v[3], v[4]], v[5]];
});

test('Marnixstraat bridge frames', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  await boot(page);
  if (CAMS.length) {
    for (const [name, from, up, to, toUp] of CAMS) {
      await lookFrom(page, from, up, to, toUp, false);
      await page.screenshot({ path: `${OUT}/${name}-${info.project.name}${process.env.ROADS ? `-roads${process.env.ROADS}` : ''}.png` });
    }
    return;
  }
  for (const [place, C] of PLACES) {
  const P = `${place ? `${place}-` : ''}${info.project.name}${process.env.ROADS ? `-roads${process.env.ROADS}` : ''}`;
  // The chase angle: riding south down Marnixstraat (bearing ~190), the Nassaukade over the Singelgracht to the right.
  const views: [string, [number, number], number, [number, number], number, boolean][] = [
    ['chase-south', offset(C, 1, 30), 3.2, offset(C, -1, -8), 0.5, false],
    ['chase-north', offset(C, -5, -30), 3.2, offset(C, 1, 8), 0.5, false],
    ['side-west', offset(C, -28, 3), 1.4, C, -0.6, true],
    ['side-east', offset(C, 30, -3), 1.4, C, -0.6, true],
    ['above', offset(C, 26, -22), 12, C, 0, false],
    ['overhead', offset(C, 0, -3), 42, C, 0, false],
  ];
  for (const [name, from, up, to, toUp, water] of views) {
    await lookFrom(page, from, up, to, toUp, water);
    await page.screenshot({ path: `${OUT}/${P}-${name}.png` });
  }
  }
});
