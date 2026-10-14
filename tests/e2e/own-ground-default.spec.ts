import { test, expect, type Page } from '@playwright/test';

// Own ground is on by default since 2026-10-14 (user). `?ownGround=0` (or
// window.__canalRecallOwnGround = false) opts out, `?ownGround=1` still works,
// and an explicit `?sharedFrame=0` without `?ownGround=1` turns it off too,
// since the own ground draws through the shared frame.
async function flags(page: Page, query: string) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto(`/canal-drive/${query}`);
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.vectorMap);
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { ownGround: !!vm._ownGroundEnabled, sharedFrame: !!vm._sharedFrameEnabled, status: vm.ownGroundStatus().enabled };
  });
}

const cases: Array<[string, { ownGround: boolean; sharedFrame: boolean }]> = [
  ['', { ownGround: true, sharedFrame: true }],
  ['?ownGround=1', { ownGround: true, sharedFrame: true }],
  ['?ownGround=0', { ownGround: false, sharedFrame: false }],
  ['?ownGround=0&sharedFrame=1', { ownGround: false, sharedFrame: true }],
  ['?sharedFrame=0', { ownGround: false, sharedFrame: false }],
  ['?sharedFrame=0&ownGround=1', { ownGround: true, sharedFrame: true }],
];
for (const [query, want] of cases) {
  test(`own ground flags for "${query || '(default)'}"`, async ({ page }) => {
    const got = await flags(page, query);
    expect({ ownGround: got.ownGround, sharedFrame: got.sharedFrame }).toEqual(want);
    expect(got.status).toBe(want.ownGround);
  });
}

test('the window global still overrides the URL default', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = false; });
  const got = await flags(page, '');
  expect(got.ownGround).toBe(false);
});
