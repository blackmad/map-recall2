// The landmark card is a glance; the panel behind it is the read. Cover for
// the canvas hit target, the panel it opens, and the pause it implies.
//
// Note on the phone project: Chromium's iPhone emulation gives this page a
// 613×1044 layout viewport inside a 390×664 device viewport, so Playwright's
// input cannot reach a fixed overlay's lower half and canvas coordinates do not
// map to tappable points. Narrow-viewport coverage is therefore done by
// resizing the desktop project, which is a true 390-wide layout.
import { test, expect } from '@playwright/test';

const NOTICE = {
  id: 'oude-kerk', name: 'Oude Kerk', type: 'church', extractLang: 'nl',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Oude_Kerk,_Amsterdam',
  longDetail: 'De Oude Kerk is het oudste gebouw en de oudste parochiekerk van Amsterdam, '
    + 'gesticht in 1213 en ingewijd in 1306 door de bisschop van Utrecht. De kerk staat aan '
    + 'het Oudekerksplein midden op De Wallen, en is sinds 2015 in gebruik als locatie voor '
    + 'hedendaagse kunst met een houten gewelf dat het grootste middeleeuwse houten gewelf van '
    + 'Europa is.',
};

/** Put the game where a card can appear — driving, with the setup form gone —
 *  without paying for a real route load. The frame loop is stubbed out so the
 *  card's own fade does not clear the hit target mid-test; how long a card
 *  lives is `landmarkNotice.ts`'s business, not this file's. */
async function driving(page: import('@playwright/test').Page) {
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.ctx);
  await page.evaluate((notice) => {
    const game = (window as any).canalRecallGame;
    game.state = 4; // GameState.RACING
    game._update = () => undefined;
    game._render = () => undefined;
    const setup = document.getElementById('route-setup');
    if (setup) setup.style.display = 'none';
    game.currentNeighborhood = 'De Wallen';
    game._landmarkNotice = notice;
    game._landmarkNoticeAlpha = 1;
    game._renderLandmarkNotice();
  }, NOTICE);
}

test('the drawn card is a hit target, and clicking it opens the panel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'canvas hit-testing needs a true layout viewport');

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await driving(page);

  const bounds = await page.evaluate(() => (window as any).canalRecallGame._landmarkCardBounds);
  expect(bounds).not.toBeNull();

  const box = (await page.locator('canvas').first().boundingBox())!;
  await page.mouse.click(
    box.x + (bounds.x + bounds.w / 2) * (box.width / 1280),
    box.y + (bounds.y + bounds.h / 2) * (box.height / 720));

  await expect(page.locator('#landmark-panel')).toBeVisible();
  expect(errors).toEqual([]);

  // Driving input is paused while it is open, and Close puts it away.
  expect(await page.evaluate(() => (window as any).canalRecallGame._utilityOpen)).toBe(true);
  await page.locator('#landmark-panel .utility-close').click();
  await expect(page.locator('#landmark-panel')).toBeHidden();
  expect(await page.evaluate(() => (window as any).canalRecallGame._utilityOpen)).toBe(false);

  // The target goes away with the card, so it stops swallowing clicks over open
  // map once the card has faded.
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game._clearLandmarkNotice();
    game._renderLandmarkNotice();
  });
  expect(await page.evaluate(() => (window as any).canalRecallGame._landmarkCardBounds)).toBeNull();
});

test("the panel holds the whole extract, not the card's two lines", async ({ page }) => {
  await driving(page);
  await page.evaluate(() => (window as any).canalRecallGame._expandLandmarkNotice());

  await expect(page.locator('#landmark-panel')).toBeVisible();
  await expect(page.locator('#landmark-panel-title')).toHaveText('Oude Kerk');
  await expect(page.locator('#landmark-panel-body')).toHaveText(NOTICE.longDetail);
  await expect(page.locator('#landmark-panel-link')).toHaveAttribute('href', NOTICE.wikipediaUrl);
  // A Dutch card says why it is Dutch rather than leaving the reader to guess.
  await expect(page.locator('#landmark-panel-badges')).toContainText('NOT TRANSLATED YET');
});

test('the panel fits a phone-width viewport, and scrolls inside it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'resized here to get a true 390-wide layout');
  await page.setViewportSize({ width: 390, height: 664 });
  await driving(page);
  await page.evaluate(() => (window as any).canalRecallGame._expandLandmarkNotice());

  const fit = await page.evaluate(() => {
    const panel = document.getElementById('landmark-panel') as HTMLElement;
    const card = panel.querySelector('.utility-card') as HTMLElement;
    const scroll = document.getElementById('landmark-panel-scroll') as HTMLElement;
    const box = card.getBoundingClientRect();
    return {
      width: box.width, top: box.top, bottom: box.bottom,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      overflowsX: panel.scrollWidth > panel.clientWidth + 1,
      overflowY: getComputedStyle(scroll).overflowY,
      // The body must be the part that scrolls, not the card, or Close leaves
      // the screen on a long article.
      bodyScrolls: scroll.scrollHeight > scroll.clientHeight,
    };
  });
  expect(fit.width).toBeLessThanOrEqual(fit.viewportWidth);
  expect(fit.top).toBeGreaterThanOrEqual(0);
  expect(fit.bottom).toBeLessThanOrEqual(fit.viewportHeight);
  expect(fit.overflowsX).toBe(false);
  expect(fit.overflowY).toBe('auto');

  // Close stays on screen and works at this width.
  await page.locator('#landmark-panel .utility-close').click();
  await expect(page.locator('#landmark-panel')).toBeHidden();
});
