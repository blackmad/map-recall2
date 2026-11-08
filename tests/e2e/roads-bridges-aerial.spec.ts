import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';

// Lane R5-C1 (issue #262): the user's three aerial road shots of 2026-11-08 (screenshots repo
// engine/2026-11-08-user-shots/roads-*.png) at their poses, own engine, the world camera held. Opt-in:
//   ROADS_AERIAL=1 [ROADS_AERIAL_QUERY='bridgeCarry=0&redDedupe=0'] [BUNDLES_DIR=dir] ROADS_SHOTS_OUT=dir PW_PORT=4682 \
//     /tmp/canal-pw.sh npx playwright test tests/e2e/roads-bridges-aerial.spec.ts --project=desktop
test.skip(!process.env.ROADS_AERIAL, 'set ROADS_AERIAL=1');

const OUT = process.env.ROADS_SHOTS_OUT || 'artifacts/r5c1/aerial';
/** Poses fitted to the user's frames (map zoom, pitch, bearing, look-at centre). */
export const ROAD_AERIAL_POSES = [
  { name: 'kattenburgerbrug-user', center: [4.9137, 52.3713] as [number, number], zoom: 18.3, pitch: 58, bearing: 330 },
  { name: 'rapenburg-ijtunnel-user', center: [4.9110, 52.3719] as [number, number], zoom: 19.2, pitch: 50, bearing: 300 },
  { name: 'schippersgracht-brug-user', center: [4.9127, 52.3711] as [number, number], zoom: 19.4, pitch: 52, bearing: 285 },
];

async function shoot(page: Page, pose: (typeof ROAD_AERIAL_POSES)[number], path: string): Promise<void> {
  await page.evaluate((p) => {
    const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
    vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
    vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 });
  }, pose);
  await settleWorld(page, `${pose.name} first jump`);
  await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.centre && g.ready) { g.residencyAt = null; g.updateResidency(); } });
  await settleWorld(page, `${pose.name} re-planned`);
  await page.evaluate((p) => { const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround; vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 }); }, pose);
  await settleWorld(page, `${pose.name} second jump`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path });
}

test('roads from the air at the user poses', async ({ page }, info) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  const q = (process.env.ROADS_AERIAL_QUERY ?? '').replace(/^[?&]/, '');
  await page.goto(`/canal-drive/?ride=free&engine=own${q ? `&${q}` : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.ROADS_ONLY?.split(',');
  for (const pose of ROAD_AERIAL_POSES) {
    if (only && !only.includes(pose.name)) continue;
    await shoot(page, pose, `${OUT}/${info.project.name}-${pose.name}.png`);
  }
});
