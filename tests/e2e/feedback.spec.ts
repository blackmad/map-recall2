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

test('landmark image note keeps draft on failure, anchor and build context on retry', async ({page}) => {
  await mockCloud(page, true);
  await page.goto('/canal-drive/manual-landmarks.html?only=allard-pierson&token=private');
  await expect(page.locator('.cf-note')).toHaveCount(1);
  await page.waitForFunction(() => (window as any).review.done);
  await page.locator('.cf-note').click();
  await expect(page.locator('.cf-preview')).toBeVisible();
  await page.locator('.cf-preview').click({position:{x:40,y:40}});
  await page.locator('#cf-text').fill('The window grouping needs work.');
  await page.locator('.cf-save').click();
  await expect(page.locator('.cf-dialog [role=status]')).toContainText('Not saved');
  await page.locator('.cf-close').click();
  await page.locator('.cf-note').click();
  await expect(page.locator('#cf-text')).toHaveValue('The window grouping needs work.');
  await page.locator('.cf-preview').click({position:{x:40,y:40}});
  await page.locator('.cf-save').click();
  await expect(page.locator('.cf-dialog [role=status]')).toHaveText('Saved to the feedback queue.');
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
  await page.locator('.cf-close').click();
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
  await expect(page.locator('.cf-dialog [role=status]')).toHaveText('Saved to the feedback queue.');
  const saved = await page.evaluate(() => (window as any).savedFeedback);
  expect(saved.payload.context.city).toBe('amsterdam');
  expect(saved.payload.context.travelMode).toBeTruthy();
  expect(saved.payload.screenshot).toMatch(/^data:image\/jpeg;base64,/);
  await page.screenshot({path:`artifacts/feedback/game-${test.info().project.name}.png`});
  await page.locator('.cf-close').click();
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._feedbackOpen)).toBe(false);
});
