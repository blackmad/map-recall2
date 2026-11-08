import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settleWorld, useBundlesDir } from './helpers';

// Lane R5-C2 (issue #263): tunnel wall edges and junction slivers from the air, own engine, the world camera held.
// The user's Rapenburg × IJtunnel shot of 2026-11-08 (screenshots repo engine/2026-11-08-user-shots/
// roads-rapenburg-ijtunnel-portal-junction.png), its ramps close up, Muntplein and Prins Hendrikkade by Arcam. Opt-in:
//   ROADS_AERIAL=1 [ROADS_AERIAL_QUERY='portalClip=0&roadSlivers=0'] [ROADS_STAGING=artifacts/roads-v1-staging] [BUNDLES_DIR=dir] ROADS_SHOTS_OUT=dir PW_PORT=4683 \
//     /tmp/canal-pw.sh npx playwright test tests/e2e/roads-junctions-aerial.spec.ts --project=desktop
test.skip(!process.env.ROADS_AERIAL, 'set ROADS_AERIAL=1');

const OUT = process.env.ROADS_SHOTS_OUT || 'artifacts/r5c2/aerial';
/** Poses (map zoom, pitch, bearing, look-at centre); the first is fitted to the user's frame (R5-C1's pose). */
export const JUNCTION_AERIAL_POSES = [
  { name: 'rapenburg-ijtunnel-user', center: [4.9110, 52.3719] as [number, number], zoom: 19.2, pitch: 50, bearing: 300 },
  { name: 'ij-tunnel-ramp-walls', center: [4.91150, 52.37235] as [number, number], zoom: 19.6, pitch: 55, bearing: 20 },
  { name: 'muntplein', center: [4.89361, 52.36707] as [number, number], zoom: 19.4, pitch: 50, bearing: 0 },
  { name: 'prins-hendrikkade-arcam', center: [4.91290, 52.37095] as [number, number], zoom: 19.4, pitch: 50, bearing: 300 },
];

async function shoot(page: Page, pose: (typeof JUNCTION_AERIAL_POSES)[number], path: string): Promise<void> {
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

test('tunnel walls and junctions from the air', async ({ page }, info) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  // ROADS_STAGING=<dir>: the staged roads-v1 manifest and version-3 cells stand in for the published ones (worker fetches too).
  const staging = process.env.ROADS_STAGING;
  if (staging) await page.context().route(/\/data\/extracts\/amsterdam\/roads-v1\/(cells\.json|cells-v3\/[\w.-]+)(\?.*)?$/, route => {
    const file = join(staging, /\/roads-v1\/(cells\.json|cells-v3\/[\w.-]+)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: file.endsWith('.json') ? 'application/json' : 'application/gzip' }) : route.continue();
  });
  const q = (process.env.ROADS_AERIAL_QUERY ?? '').replace(/^[?&]/, '');
  await page.goto(`/canal-drive/?ride=free&engine=own${q ? `&${q}` : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.ROADS_ONLY?.split(',');
  for (const pose of JUNCTION_AERIAL_POSES) {
    if (only && !only.includes(pose.name)) continue;
    await shoot(page, pose, `${OUT}/${info.project.name}-${pose.name}.png`);
  }
});
