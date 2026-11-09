// G5 (issue #275): the Knowledge screen's paper map and the passport stamp
// album. The map must draw in under 100 ms from seeded localStorage (geometry
// warm, as after any ride), the album must count the stamps from both the quiz
// passport and Free Ride's collection, and a tap on a buurt filters the queue.

import { existsSync, readFileSync } from 'node:fs';
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

type Seed = Array<[string, string, [number, number], number, number]>;
const OUTER: Seed = [
  ['Buikslotermeerplein', 'street', [52.3935, 4.9390], 3, 4],
  ['Mosplein', 'street', [52.3870, 4.9150], 2, 2],
  ['IJburglaan', 'street', [52.3560, 5.0050], 3, 6],
  ['Pampuslaan', 'street', [52.3610, 4.9990], 1, 1],
  ['Burgemeester Röellstraat', 'street', [52.3790, 4.8000], 3, 5],
  ['Sloterplas', 'street', [52.3500, 4.8300], 2, 3],
  ['Bijlmerdreef', 'street', [52.3150, 4.9700], 3, 7],
];
const SEEDS: Record<string, Seed> = {
  centre: NAMES,
  outer: OUTER,
  everything: [...NAMES, ...OUTER],
};
// Cold first open of the map may load at most this much extract JSON (#297).
const FIRST_OPEN_BUDGET = 150_000;
// The files the map itself may fetch on first open; the ride's own background
// loads (streets, trees, parks ...) are not the map's and are ignored.
const MAP_FILES = /\/(knowledge-map-outline|boundaries|water)\.json$/;
const OUTLINE_PUBLISHED = 'public/data/extracts/amsterdam/knowledge-map-outline.json';
const OUTLINE_STAGED = 'public/data/extracts/amsterdam/staging/knowledge-map-outline.json';

async function seed(page: Page, names: Seed = NAMES): Promise<void> {
  await page.addInitScript(({ names, now, day }) => {
    const states = Object.fromEntries(names.map(([name, type, center, repetitions, dueDays], index) => [`g5-${index}_guess_name`, {
      featureKey: `g5-${index}`, mode: 'guess_name', dueAt: now + dueDays * day, intervalDays: 4, ease: 2.3, repetitions, lapses: 0,
      lastReviewedAt: now - day, lastEventId: `e${index}`, schedulerVersion: 1,
      featureSnapshot: { name, type, cityId: 'amsterdam', center },
    }]));
    localStorage.setItem('mapRecall_reviewStates_v1', JSON.stringify(states));
    localStorage.setItem('canalRecall.neighborhoodPassport.v1', JSON.stringify({ stamped: ['Grachtengordel', 'Oude Pijp'], dates: { Grachtengordel: '2026-11-07' } }));
    localStorage.setItem('canalRecall.freeRideCollection.v1', JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }] }));
  }, { names, now: NOW, day: DAY });
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

for (const [label, names] of Object.entries(SEEDS)) {
  test(`knowledge map frame holds every known buurt, cold first open is slim: ${label} seed`, async ({ page }, info) => {
    await seed(page, names);
    // Until the integrator publishes the outline, serve the staged build at its published path.
    if (!existsSync(OUTLINE_PUBLISHED) && existsSync(OUTLINE_STAGED)) {
      await page.route('**/data/extracts/amsterdam/knowledge-map-outline.json', route => route.fulfill({ contentType: 'application/json', body: readFileSync(OUTLINE_STAGED) }));
    }
    await page.goto('/canal-drive/');
    await expect(page.locator('#knowledge-button')).toBeVisible({ timeout: 60_000 });
    // Let the ride's own background loads settle first (it loads boundaries and
    // water for itself): only what the click itself fetches is the map's cost.
    let lastLoad = Date.now();
    const noteLoad = () => { lastLoad = Date.now(); };
    page.on('response', noteLoad);
    for (let i = 0; i < 60 && Date.now() - lastLoad < 3000; i += 1) await page.waitForTimeout(1000);
    page.off('response', noteLoad);
    const loaded: Array<{ url: string; bytes: number }> = [];
    page.on('response', async response => {
      if (!MAP_FILES.test(new URL(response.url()).pathname)) return;
      const body = await response.body().catch(() => Buffer.alloc(0));
      loaded.push({ url: new URL(response.url()).pathname.replace('/data/extracts/amsterdam/', ''), bytes: body.length });
    });
    await page.locator('#knowledge-button').click();
    const map = page.getByTestId('knowledge-map');
    await expect(map).toHaveAttribute('data-render-ms', /\d/, { timeout: 30_000 });
    const report = await page.evaluate(() => (document.querySelector('[data-testid=knowledge-map] canvas') as HTMLCanvasElement & { knowledgeMapReport: () => {
      width: number; height: number; outsideDefault: string[];
      frame: Record<string, number>; defaultFrame: Record<string, number>;
      known: Array<{ name: string; tracked: number; x0: number; y0: number; x1: number; y1: number }>;
    } }).knowledgeMapReport());
    const total = loaded.reduce((sum, entry) => sum + entry.bytes, 0);
    const inside = report.known.filter(b => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= report.width && b.y1 <= report.height);
    const km = (f: Record<string, number>) => `${((f.maxLng - f.minLng) * 111.32 * Math.cos(52.37 * Math.PI / 180)).toFixed(1)} x ${((f.maxLat - f.minLat) * 111.32).toFixed(1)} km`;
    console.log(`[${info.project.name}] ${label}: panel ${Math.round(report.width)}x${Math.round(report.height)}, frame ${km(report.frame)} (default ${km(report.defaultFrame)}); `
      + `known buurts ${report.known.length}, inside ${inside.length}, outside the OLD frame: ${report.outsideDefault.join(', ') || 'none'}; `
      + `first-open extracts ${total} B in ${loaded.length} files (${loaded.map(l => `${l.url} ${l.bytes}`).join(', ')})`);
    if (process.env.KMAP_SHOTS) await map.screenshot({ path: `${process.env.KMAP_SHOTS}/${label}-${info.project.name}.png` });
    expect(report.known.length).toBeGreaterThan(0);
    expect(inside.length, `outside: ${report.known.filter(b => !inside.includes(b)).map(b => b.name)}`).toBe(report.known.length);
    if (label === 'centre') expect(report.frame.maxLat - report.frame.minLat).toBeGreaterThan(0.027); // >= ~3 km tall
    expect(total, JSON.stringify(loaded)).toBeLessThanOrEqual(FIRST_OPEN_BUDGET);
  });
}
