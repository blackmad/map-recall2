import { expect, test } from '@playwright/test';
import { gameListsModel, routeFreshSignatureBundle } from '../../scripts/landmarks/fresh-signature-bundle';

// Guard for review-sheet.ts's IN GAME column (#139): the same ride setup, then the wait it relies on,
// `vectorMap._signatureLandmarks.shown.has(id)`, must fill within 30 s for a known landmark.
// PW_PORT=4484 npx playwright test review-sheet-ingame --project=desktop --workers=1
const ID = 'de-roos';
const ANCHOR = [4.8754121, 52.35861];

test('review sheet: a jumped-to landmark is shown within 30 s', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser run is enough');
  test.setTimeout(240_000);
  await routeFreshSignatureBundle(page);
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._signatureLandmarks, null, { timeout: 90_000 });
  expect(await gameListsModel(page, ID)).toBe(true);
  const poi = await page.evaluate(() => (window as any).canalRecallGame.routePois[0]?.id);
  await page.selectOption('#poi-destination', poi);
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera?.introOverview === 0, null, { timeout: 90_000 });
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = () => {}; });
  await page.evaluate(c => (window as any).canalRecallGame.vectorMap.map.jumpTo({ center: c, zoom: 19.2, pitch: 70, bearing: 157 }), ANCHOR);
  await page.waitForFunction(i => (window as any).canalRecallGame.vectorMap._signatureLandmarks.shown.has(i), ID, { timeout: 30_000 });
});
