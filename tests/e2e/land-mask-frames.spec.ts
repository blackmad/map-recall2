import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Land-mask lane 2026-11-09: own-ground proto frames at the Houthaven spots (Gevlebrug, Karlskrona-eiland) for before/after
// review beside the orthophoto (docs/reports/land-mask-gaps-20261109/).
//   LAND_MASK_FRAMES=<out-dir> PW_PORT=4748 npx playwright test land-mask-frames --project=desktop
const OUT = process.env.LAND_MASK_FRAMES;
test.skip(!OUT, 'set LAND_MASK_FRAMES=<out-dir>');

const FRAMES: Array<{ name: string; mapcam: string; at?: [number, number] }> = [
  // lng,lat,zoom,pitch,bearing,fov
  { name: 'gevlebrug-aerial', mapcam: '4.88440,52.39205,17.6,60,250,36.87' },
  { name: 'haparandadam-pand', mapcam: '4.88030,52.39680,18.3,58,320,36.87', at: [4.8803, 52.3968] },
  { name: 'gevlebrug-low', mapcam: '4.88440,52.39175,18.6,60,70,36.87' },
];

for (const frame of FRAMES) {
  test(`frame ${frame.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(OUT!, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`/canal-drive/own-ground.html?lat=${frame.at?.[1] ?? 52.3919}&lng=${frame.at?.[0] ?? 4.8838}&r=320&auto=0&hud=0&rider=${frame.at ? `${frame.at[0]},${frame.at[1]},70` : '4.88300,52.39200,70'}&cam=map&mapcam=${frame.mapcam}`);
    await page.waitForFunction(() => (window as any).__ownGround?.ready || (window as any).__ownGround?.status?.error, null, { timeout: 240_000 });
    expect(await page.evaluate(() => (window as any).__ownGround.status.error)).toBeUndefined();
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `${OUT}/${frame.name}.png` });
    expect(errors).toEqual([]);
  });
}
