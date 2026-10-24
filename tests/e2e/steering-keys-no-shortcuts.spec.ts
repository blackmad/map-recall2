import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Issue #24 (player report 2026-10-24): steering with WASD, pressing W also
// opened the Wikipedia page of a nearby monument ("like getting flashbanged
// by information"), and D toggled the road-name labels. Steering keys must
// never trigger a card or link action during a ride; the article moved to E
// and the labels to T.
test('W/A/S/D steer and open nothing; E opens the landmark article', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await page.evaluate(() => {
    const w = window as any; const g = w.canalRecallGame;
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    w.__opened = []; w.__articleCalls = 0;
    const open = g._openLandmarkArticle.bind(g);
    g._openLandmarkArticle = () => { w.__articleCalls++; open(); };
    w.open = (url: string) => { w.__opened.push(String(url)); return null; };
    g._landmarkNotice = { ...(g._landmarkNotice || {}), name: 'Test monument', wikipediaUrl: 'https://en.wikipedia.org/wiki/Test_monument' };
    w.__labels = g.vectorMap._labelsVisible;
  });
  await page.locator('#gameCanvas').focus().catch(() => {});
  const start = await page.evaluate(() => { const p = (window as any).canalRecallGame.player; return { x: p.x, y: p.y }; });
  for (const key of ['w', 'a', 's', 'd']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(key === 'w' ? 1200 : 300);
    await page.keyboard.up(key);
  }
  const after = await page.evaluate(() => {
    const w = window as any; const g = w.canalRecallGame;
    return { opened: w.__opened as string[], calls: w.__articleCalls as number, labels: g.vectorMap._labelsVisible, labelsBefore: w.__labels, x: g.player.x, y: g.player.y, state: g.state };
  });
  expect(after.opened, 'steering keys opened a page').toEqual([]);
  expect(after.calls, 'steering keys asked for the landmark article').toBe(0);
  expect(after.labels, 'D toggled the road-name labels').toBe(after.labelsBefore);
  expect(Math.hypot(after.x - start.x, after.y - start.y), 'W rode the bike forward').toBeGreaterThan(5);
  // The drive-by card may have come down meanwhile; put one back up.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._landmarkNotice = { ...(g._landmarkNotice || {}), name: 'Test monument', wikipediaUrl: 'https://en.wikipedia.org/wiki/Test_monument' };
  });
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => (window as any).__opened.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__opened[0])).toContain('wikipedia.org');
});
