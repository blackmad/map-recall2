import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

async function mockCloud(page: any, failFirst = false) {
  await page.route('**/js/feedback/cloud.js', (route: any) => route.fulfill({ contentType: 'text/javascript', body: `
    let count = 0;
    export function userLabel() { return 'Reviewer'; }
    export async function signIn() {}
    export async function list() { return []; }
    export async function save(id, payload) {
      window.feedbackAttempt = {id, payload};
      if (${failFirst} && ++count === 1) throw new Error('Simulated network failure');
      window.savedFeedback = {id, payload};
    }` }));
  await page.route('**/deployment.json', (route: any) => route.fulfill({ json: {sha:'test-revision',builtAt:'2026-10-05T12:00:00Z'} }));
}


/** Mean luma and its standard deviation of the dialog's preview image. */
async function previewStats(page: any) {
  await expect(page.locator('.cf-preview')).toBeVisible();
  return page.evaluate(async () => {
    const img = document.querySelector('.cf-preview') as HTMLImageElement;
    await img.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 100;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let s = 0, s2 = 0;
    for (let i = 0; i < d.length; i += 4) { const l = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; s += l; s2 += l * l; }
    const n = d.length / 4, mean = s / n;
    return { mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
  });
}

test('landmark image note keeps draft on failure, anchor and build context on retry', async ({page}) => {
  await mockCloud(page, true);
  await page.goto('/canal-drive/manual-landmarks.html?only=allard-pierson&token=private');
  await expect(page.locator('.cf-note')).toHaveCount(1);
  await page.waitForFunction(() => (window as any).review.done);
  await page.locator('.cf-note').click();
  const gallery = await previewStats(page);
  expect(gallery.mean, 'gallery capture is not black').toBeGreaterThan(25);
  expect(gallery.sd, 'gallery capture is not uniform').toBeGreaterThan(8);
  await page.locator('.cf-preview').click({position:{x:40,y:40}});
  await page.locator('#cf-text').fill('The window grouping needs work.');
  await page.locator('#cf-text').press('Control+Enter');
  await expect(page.locator('.cf-dialog [role=status]')).toContainText('Not saved');
  await expect(page.locator('.cf-dialog')).toBeVisible();
  await page.locator('.cf-close').click();
  await page.locator('.cf-note').click();
  await expect(page.locator('#cf-text')).toHaveValue('The window grouping needs work.');
  await page.locator('.cf-preview').click({position:{x:40,y:40}});
  await page.locator('#cf-text').press('Meta+Enter');
  await expect(page.locator('.cf-dialog')).not.toBeVisible();
  await expect(page.locator('.cf-note')).toBeFocused();
  const saved = await page.evaluate(() => (window as any).savedFeedback);
  expect(saved.payload.target.id).toBe('allard-pierson');
  expect(saved.payload.target.anchor.x).toBeGreaterThan(0);
  expect(saved.payload.screenshot).toMatch(/^data:image\/jpeg;base64,/);
  expect(saved.payload.context.camera.distance).toBeGreaterThan(0);
  expect(saved.payload.environment.build.sha).toBe('test-revision');
  expect(saved.payload.environment.host).toContain('127.0.0.1');
  expect(saved.payload.environment.page).not.toContain('private');
  expect(saved.payload.environment.viewport.width).toBeGreaterThan(0);
  await page.screenshot({path:`artifacts/feedback/gallery-${test.info().project.name}.png`});
  await page.locator('.cf-note').click();
  await expect(page.locator('#cf-text')).toHaveValue('');
});

test('game feedback freezes updates and releases controls when closed', async ({page}) => {
  await mockCloud(page);
  await openRoute(page, {travelMode:'car'});
  await page.waitForFunction(() => !!(window as any).canalRecallGame.vectorMap?.map?.isStyleLoaded?.());
  await page.locator('.cf-launch').click();
  expect(await page.evaluate(() => (window as any).canalRecallGame._feedbackOpen)).toBe(true);
  const position = await page.evaluate(() => { const g=(window as any).canalRecallGame; g._update(1); return {x:g.player.x,y:g.player.y}; });
  await page.locator('#cf-text').fill('Rendering feedback from the game');
  expect(await page.evaluate(() => { const g=(window as any).canalRecallGame; return {x:g.player.x,y:g.player.y}; })).toEqual(position);
  await page.locator('.cf-save').click();
  await expect(page.locator('.cf-dialog')).not.toBeVisible();
  const saved = await page.evaluate(() => (window as any).savedFeedback);
  expect(saved.payload.context.city).toBe('amsterdam');
  expect(saved.payload.context.travelMode).toBeTruthy();
  expect(saved.payload.screenshot).toMatch(/^data:image\/jpeg;base64,/);
  await page.screenshot({path:`artifacts/feedback/game-${test.info().project.name}.png`});
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._feedbackOpen)).toBe(false);
});

// User 2026-10-16 "why black screen on this popup?": the default target picked
// MapLibre's canvas (first in document order), read it outside the render
// callback and encoded a cleared, transparent buffer as a black JPEG.
test('game feedback preview shows the map and HUD, not a black frame', async ({page}) => {
  await mockCloud(page);
  await openRoute(page, {travelMode:'car'});
  await page.waitForFunction(() => !!(window as any).canalRecallGame.vectorMap?.map?.isStyleLoaded?.());
  await page.waitForTimeout(3000);
  await page.locator('.cf-launch').evaluate((b: HTMLElement) => b.click());
  const stats = await previewStats(page);
  expect(stats.mean, 'game capture is not black').toBeGreaterThan(40);
  expect(stats.sd, 'game capture is not uniform').toBeGreaterThan(12);
  await page.screenshot({path:`artifacts/feedback/game-preview-${test.info().project.name}.png`});
  await page.locator('.cf-close').click();
});
