import { test, expect, type Page } from '@playwright/test';

// Own ground is on by default since 2026-10-14 (user). `?ownGround=0` (or
// window.__canalRecallOwnGround = false) opts out and `?ownGround=1` still works.
// The shared frame it draws through is unconditional (2026-10-30).
async function flags(page: Page, query: string) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto(`/canal-drive/${query}`);
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.vectorMap);
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { ownGround: !!vm._ownGroundEnabled, status: vm.ownGroundStatus().enabled };
  });
}

const cases: Array<[string, { ownGround: boolean }]> = [
  ['', { ownGround: true }],
  ['?ownGround=1', { ownGround: true }],
  ['?ownGround=0', { ownGround: false }],
];
for (const [query, want] of cases) {
  test(`own ground flags for "${query || '(default)'}"`, async ({ page }) => {
    const got = await flags(page, query);
    expect({ ownGround: got.ownGround }).toEqual(want);
    expect(got.status).toBe(want.ownGround);
  });
}

test('the window global still overrides the URL default', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = false; });
  const got = await flags(page, '');
  expect(got.ownGround).toBe(false);
});
