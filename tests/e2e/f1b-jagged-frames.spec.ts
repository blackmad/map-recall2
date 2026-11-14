import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';

// Lane f1b-jagged 2026-11-14: in-game frames at the user's F1b follow-up shots, own engine, one browser job for every
// variant. JAGGED_VARIANTS="name=query;name=query" (query without '?', '' for the default); JAGGED_ONLY=spot,spot.
//   JAGGED_FRAMES=1 JAGGED_OUT=dir PW_PORT=4447 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/f1b-jagged-frames.spec.ts --project=desktop --workers=1
test.skip(!process.env.JAGGED_FRAMES, 'set JAGGED_FRAMES=1');

const OUT = process.env.JAGGED_OUT || 'artifacts/own-ground/f1b-jagged-frames';
const VARIANTS = (process.env.JAGGED_VARIANTS ?? 'after=').split(';').map(v => { const i = v.indexOf('='); return { name: v.slice(0, i), query: v.slice(i + 1) }; });

/** Oblique aerial poses: the user's two shots (david-20261114-bridge-jagged.png, david-20261114-roads-dip.png). */
const SPOTS: readonly { name: string; lng: number; lat: number; bearing: number; zoom: number; pitch: number }[] = [
  { name: 'ringweg-noord-7376770', lng: 4.89915, lat: 52.42368, bearing: 50, zoom: 19.2, pitch: 55 },
  { name: 'ringweg-noord-7376548', lng: 4.90766, lat: 52.42084, bearing: 140, zoom: 19.2, pitch: 55 },
  ...(process.env.JAGGED_EXTRA ? JSON.parse(process.env.JAGGED_EXTRA) : []),
];

test('f1b jagged: frames per variant', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  const only = process.env.JAGGED_ONLY?.split(',');
  for (const v of VARIANTS) {
    await page.goto(`/canal-drive/?ride=free&engine=own${v.query ? `&${v.query}` : ''}`);
    await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
    for (const spot of SPOTS) {
      if (only && !only.includes(spot.name)) continue;
      await page.evaluate(({ lng, lat, bearing }) => {
        const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
        const b = bearing * Math.PI / 180;
        g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
        g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
        g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
        Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      }, spot);
      const pose = { center: [spot.lng, spot.lat], zoom: spot.zoom, pitch: spot.pitch, bearing: spot.bearing };
      const jump = () => page.evaluate((p) => {
        const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
        vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
        vm.sync = () => {}; vm.aimAtWorld = () => {};
        vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 });
      }, pose);
      await jump();
      await settleWorld(page, `${spot.name} ${v.name}`);
      await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
      await jump();
      await settleWorld(page, `${spot.name} ${v.name} again`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.name}-${v.name}.png` });
      await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__held) { vm.sync = vm.__held.sync; vm.aimAtWorld = vm.__held.aimAtWorld; vm.__held = null; } });
    }
  }
});
