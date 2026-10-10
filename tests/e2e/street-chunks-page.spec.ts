import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Smoke test for public/canal-drive/street-chunks.html (no Storybook): every chunk renders both views, stats and
// fidelity gates are present, and the game link is a #race share link. Screenshots land in artifacts/street-chunks/page.
//   PW_PORT=4409 npx playwright test street-chunks-page
test('street chunks demo page draws individual vs chunk views with stats and a game link', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/canal-drive/street-chunks.html');
  await page.waitForFunction(() => (window as any).chunkDemo?.ready === true, undefined, { timeout: 90_000 });
  const demo = await page.evaluate(() => (window as any).chunkDemo);
  expect(demo.errors).toEqual([]);
  expect(demo.total).toBeGreaterThanOrEqual(4);
  expect(demo.loaded.length).toBe(demo.total);

  const cards = page.locator('article[data-chunk]');
  expect(await cards.count()).toBe(demo.total);
  // Both canvases of the first card painted something (not just the background).
  const painted = await cards.first().locator('canvas').evaluateAll((canvases: HTMLCanvasElement[]) => canvases.map(c => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const bg = [d[0], d[1], d[2]];
    let n = 0;
    for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) n++;
    return n;
  }));
  expect(painted.every(n => n > 500)).toBe(true);

  // Stats come from the build report.
  const rows = await cards.first().locator('[data-stats] tr').allTextContents();
  expect(rows.join('|')).toMatch(/Triangles.*Draw calls.*GLB requests.*Bytes/);
  await expect(cards.first().locator('details[data-gates]')).toHaveAttribute('data-gates', 'pass');

  const href = await cards.first().locator('a[data-link="game"]').getAttribute('href');
  expect(href).toMatch(/^\.\/index\.html#race=(-?\d+\.\d+,){5}-?\d+\.\d+$/);
  expect(await cards.first().locator('a[data-link="game-off"]').getAttribute('href')).toContain('?streetChunks=0#race=');

  // Dragging one view moves the other (synced camera): the pixels of the second canvas change.
  const canvases = cards.first().locator('canvas');
  const sig = () => canvases.nth(1).evaluate((c: HTMLCanvasElement) => { const u = c.toDataURL(); return u.length + ':' + u.slice(-300); });
  const before = await sig();
  await canvases.nth(0).scrollIntoViewIfNeeded();
  const box = (await canvases.nth(0).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  expect(await sig()).not.toBe(before);

  mkdirSync('artifacts/street-chunks/page', { recursive: true });
  await page.screenshot({ path: `artifacts/street-chunks/page/${info.project.name}.png` });
  await cards.first().screenshot({ path: `artifacts/street-chunks/page/${info.project.name}-first-card.png` });
  expect(errors).toEqual([]);
});
