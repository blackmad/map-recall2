import { expect, Page, test } from '@playwright/test';

// iPhone Safari report (2026-10-02, IMG_0374): the Map Recall question card's
// "No idea" / "Place a pin first" row sat behind the browser toolbar, and the
// trivia card could not be scrolled to its end. The app shell was `h-screen`
// (100vh), which iOS sizes to the *large* viewport, so everything at the bottom
// was laid out under the toolbar. Chromium has no toolbar, so these tests shrink
// #root the way Safari's dynamic viewport does and require the overlays to fit.

const SAFARI_TOOLBAR_PX = 90;

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
}

async function emulateSafariToolbar(page: Page) {
  await page.addStyleTag({ content: `#root { height: calc(100dvh - ${SAFARI_TOOLBAR_PX}px) !important; }` });
}

/** Playwright scrolls clipped ancestors to reach a click target; a thumb cannot. Undo that before measuring. */
async function visibleBottom(page: Page) {
  return page.evaluate(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root')!, ...document.querySelectorAll('#root main')]) el.scrollTop = 0;
    return document.getElementById('root')!.getBoundingClientRect().bottom;
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone browser chrome only');
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await emulateSafariToolbar(page);
  await expect(page.locator('#target-feature-name')).toBeVisible();
});

test('question card actions sit above the browser toolbar', async ({ page }) => {
  const bottom = await visibleBottom(page);
  for (const name of ['No idea', 'Place a pin on the map first']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.y + box!.height, `${name} bottom vs visible viewport`).toBeLessThanOrEqual(bottom);
  }
  await page.screenshot({ path: test.info().outputPath('question-card.png') });
});

test('the answer card scrolls all the way to its last line', async ({ page }) => {
  await page.getByRole('button', { name: 'No idea' }).click();
  const card = page.locator('#pinpoint-feedback-card');
  await expect(card).toBeVisible();
  const scroller = card.locator('xpath=..');
  const bottom = await visibleBottom(page);
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const lastLine = card.locator(':scope > *').last();
  const [scrollerBox, lastBox] = await Promise.all([scroller.boundingBox(), lastLine.boundingBox()]);
  expect(scrollerBox!.y + scrollerBox!.height, 'scroll area ends above the toolbar').toBeLessThanOrEqual(bottom);
  // One scroll area only: scrolled to the end, the card's last line is inside it.
  expect(await card.evaluate((el) => el.scrollHeight - el.clientHeight), 'no nested scroller in the card').toBeLessThanOrEqual(1);
  expect(lastBox!.y + lastBox!.height, 'last line visible').toBeLessThanOrEqual(scrollerBox!.y + scrollerBox!.height + 1);
  await page.screenshot({ path: test.info().outputPath('answer-card-scrolled.png') });
});
