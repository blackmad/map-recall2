// G5 (issue #275): the Knowledge screen's paper map and the passport stamp
// album. The map must draw in under 100 ms from seeded localStorage (geometry
// warm, as after any ride), the album must count the stamps from both the quiz
// passport and Free Ride's collection, and a tap on a buurt filters the queue.

import { expect, test, type Page } from '@playwright/test';

const NOW = Date.now();
const DAY = 86_400_000;
const NAMES: Array<[string, string, [number, number], number, number]> = [
  ['Prinsengracht', 'canal', [52.3725, 4.8845], 3, 5],
  ['Keizersgracht', 'canal', [52.3705, 4.886], 3, 3],
  ['Herengracht', 'canal', [52.369, 4.889], 3, -1],
  ['Albert Cuypstraat', 'street', [52.356, 4.893], 3, 8],
  ['Ferdinand Bolstraat', 'street', [52.3545, 4.8925], 2, -2],
  ['Overtoom', 'street', [52.3615, 4.8723], 3, 9],
];

async function seed(page: Page): Promise<void> {
  await page.addInitScript(({ names, now, day }) => {
    const states = Object.fromEntries(names.map(([name, type, center, repetitions, dueDays], index) => [`g5-${index}_guess_name`, {
      featureKey: `g5-${index}`, mode: 'guess_name', dueAt: now + dueDays * day, intervalDays: 4, ease: 2.3, repetitions, lapses: 0,
      lastReviewedAt: now - day, lastEventId: `e${index}`, schedulerVersion: 1,
      featureSnapshot: { name, type, cityId: 'amsterdam', center },
    }]));
    localStorage.setItem('mapRecall_reviewStates_v1', JSON.stringify(states));
    localStorage.setItem('canalRecall.neighborhoodPassport.v1', JSON.stringify({ stamped: ['Grachtengordel', 'Oude Pijp'], dates: { Grachtengordel: '2026-11-07' } }));
    localStorage.setItem('canalRecall.freeRideCollection.v1', JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }] }));
  }, { names: NAMES, now: NOW, day: DAY });
}

test('knowledge map draws under 100 ms from localStorage; album counts stamps; a tap filters the queue', async ({ page }) => {
  await seed(page);
  await page.goto('/canal-drive/');
  await expect(page.locator('#knowledge-button')).toBeVisible({ timeout: 60_000 });

  // First open fetches the geometry (boundaries + water, HTTP-cached after a ride).
  await page.locator('#knowledge-button').click();
  const map = page.getByTestId('knowledge-map');
  await expect(map).toHaveAttribute('data-render-ms', /\d/, { timeout: 30_000 });
  await page.locator('.knowledge-back').click();

  // Second open: localStorage → knowledge items → buurt mastery → pixels.
  const timing = await page.evaluate(() => new Promise<{ wall: number; draw: number }>((resolve) => {
    const started = performance.now();
    (document.getElementById('knowledge-button') as HTMLButtonElement).click();
    const poll = () => {
      const frame = document.querySelector('[data-testid=knowledge-map]');
      const draw = frame?.getAttribute('data-render-ms');
      if (draw) resolve({ wall: performance.now() - started, draw: Number(draw) });
      else requestAnimationFrame(poll);
    };
    poll();
  }));
  console.log(`knowledge map: draw ${timing.draw.toFixed(1)} ms, click to drawn ${timing.wall.toFixed(1)} ms`);
  expect(timing.draw).toBeLessThan(100);
  expect(timing.wall).toBeLessThan(100);

  const album = page.getByTestId('stamp-album');
  await expect(album).toHaveAttribute('data-earned', '3');
  expect(Number(await album.getAttribute('data-total'))).toBeGreaterThanOrEqual(80);
  await expect(album.locator('.stamp[data-earned="true"]')).toHaveCount(3);
  await expect(album.locator('.stamp[data-earned="true"]').first()).toContainText('Marineterrein');
  await expect(album.locator('.stamp[data-earned="true"]').first()).toContainText('8 Nov 2026');
  await expect(album.locator('.stamp[data-earned="false"]').first()).toContainText('Not yet');

  // The map draws no names: the canvas is the only thing in its frame.
  await expect(map.locator('canvas')).toHaveCount(1);

  // Tap the Grachtengordel (Keizersgracht's place): the queue narrows to its two canals (Herengracht's place is the Gouden Bocht, a finer buurt).
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=knowledge-map] canvas') as HTMLCanvasElement & { knowledgeMapProject: (lat: number, lng: number) => [number, number] };
    const [x, y] = canvas.knowledgeMapProject(52.3705, 4.886);
    return { x, y };
  });
  await map.locator('canvas').click({ position: point });
  await expect(page.locator('.kmap-filter')).toContainText('Grachtengordel · 2 names');
  await page.locator('.knowledge-tabs [role=tab]').last().click();
  await expect(page.locator('.knowledge-item')).toHaveCount(2);
  await page.locator('.kmap-filter button').click();
  await expect(page.locator('.knowledge-item')).toHaveCount(NAMES.length);
});
