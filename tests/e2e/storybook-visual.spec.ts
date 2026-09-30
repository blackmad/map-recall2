import { test, expect } from '@playwright/test';

// TODO item 14: the Storybook card states compiled but nothing looked at them
// after they were written. This compares the card states against committed
// screenshots. It reads the production build (`npm run build-storybook`,
// part of `check:canal`), served from the repository root by the dev server.
//
// Update the baselines after an intended change:
//   npm run build-storybook && PW_PORT=4388 npx playwright test tests/e2e/storybook-visual.spec.ts --update-snapshots
// [story id, viewport]: the size each story declares (Storybook's mobile1 is
// 320×568, mobile2 414×896). The desktop briefing screens are left out: their
// photo backdrop makes each baseline 1.5 MB, and the phone briefing states
// cover the same form.
const STORIES: Array<[string, number, number]> = [
  ['canal-recall-route-setup--knowledge-review', 1280, 800],
  ['canal-recall-route-setup--mobile', 320, 568],
  ['canal-recall-route-setup--transit-briefing-phone', 320, 568],
  ['canal-recall-route-setup--live-hud', 1280, 800],
  ['canal-recall-route-setup--finish-card', 1280, 800],
  ['canal-recall-route-setup--finish-card-calm-mode', 1280, 800],
  ['canal-recall-route-setup--finish-card-calm-bare', 1280, 800],
  ['canal-recall-route-setup--finish-card-bike', 1280, 800],
  ['canal-recall-route-setup--finish-card-transit', 1280, 800],
  ['canal-recall-route-setup--neighborhood-photo-card', 1280, 800],
  ['canal-recall-route-setup--neighborhood-fallback-card', 1280, 800],
  ['canal-recall-route-setup--stacked-notices', 1280, 800],
  ['canal-recall-route-setup--landmark-card', 1280, 800],
  ['canal-recall-route-setup--landmark-card-bare', 1280, 800],
  ['canal-recall-route-setup--landmark-panel', 1280, 800],
  ['canal-recall-route-setup--landmark-panel-untranslated', 1280, 800],
  ['canal-recall-route-setup--landmark-panel-mobile', 320, 568],
  ['canal-recall-route-setup--bridge-origin-card', 1280, 800],
  ['canal-recall-route-setup--building-facts-card', 1280, 800],
  ['canal-recall-route-setup--bridge-register-card', 1280, 800],
  ['canal-recall-route-setup--portrait-bridge-register-card', 414, 896],
  ['canal-recall-route-setup--portrait-bridge-origin-card', 414, 896],
  ['canal-recall-route-setup--portrait-building-facts-card', 414, 896],
  ['canal-recall-route-setup--landmark-card-mobile', 320, 568],
  ['canal-recall-route-setup--portrait-hud', 414, 896],
  ['canal-recall-route-setup--portrait-hud-steering', 414, 896],
  ['canal-recall-route-setup--portrait-hud-asking', 414, 896],
  ['canal-recall-route-setup--portrait-hud-long-names', 414, 896],
  ['canal-recall-route-setup--portrait-hud-small-phone', 320, 568],
  ['canal-recall-route-setup--landscape-hud', 896, 414],
  ['canal-recall-route-setup--portrait-recall-prompt', 414, 896],
  ['canal-recall-route-setup--portrait-finish-card', 414, 896],
  ['canal-recall-route-setup--portrait-finish-card-calm-bare', 414, 896],
  ['canal-recall-route-setup--portrait-stacked-notices', 414, 896],
  ['canal-recall-route-setup--portrait-neighborhood-fallback', 414, 896],
  ['canal-recall-route-setup--portrait-settings-panel', 414, 896],
  ['canal-recall-route-setup--portrait-article-panel', 414, 896],
  ['canal-recall-route-setup--portrait-route-setup', 414, 896],
  ['canal-recall-route-setup--portrait-route-setup-here', 414, 896],
  ['canal-recall-route-setup--portrait-knowledge-review', 414, 896],
];

for (const [id, width, height] of STORIES) {
  test(`storybook: ${id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the portrait stories set their own viewport');
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    const response = await page.goto(`/storybook-static/iframe.html?id=${id}&viewMode=story`);
    const body = await response?.text();
    test.skip(!body?.includes('storybook'), 'no Storybook build; run npm run build-storybook');
    // The story loads the game in a frame and paints the card on its canvas.
    const frame = page.frameLocator('iframe').first();
    await expect(frame.locator('#gameCanvas')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(4000);
    await expect(page).toHaveScreenshot(`${id}.png`, { maxDiffPixelRatio: 0.01, animations: 'disabled' });
  });
}
