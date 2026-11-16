import { expect, test } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const shots = process.env.SHOPFRONT_SHOTS ?? path.join(os.tmpdir(), 'shopfront-shots');
// Replaces the feedback bundle: no Firebase, no Firestore write. The second note fails, to exercise the failure path.
const stub = `window.__saved = [];
window.CanalFeedback = { attach(){}, open(){}, userLabel: async () => 'Tester', signIn: async () => 'Tester',
  saveMany: async notes => { window.__saved.push(...notes); const failed = notes.slice(1, 2).map(n => ({ targetId: n.targetId, error: 'stub failure' })); return { saved: notes.filter(n => !failed.some(f => f.targetId === n.targetId)).map(n => n.targetId), failed }; } };`;

for (const [name, size] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`shopfront batch feedback at ${name} width`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.route('**/js/feedback/browser.js*', route => route.fulfill({ contentType: 'text/javascript', body: stub }));
    await page.goto('/canal-drive/shopfronts.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { shopfrontsPage: { ready: boolean } }).shopfrontsPage.ready);
    const boxes = page.locator('article textarea');
    await expect(page.locator('#ready')).toHaveText('0 notes ready');
    await expect(page.locator('#saveall')).toBeDisabled();
    await boxes.nth(0).fill('Sign is too big');
    await boxes.nth(1).fill('Wrong door colour');
    await expect(page.locator('#ready')).toHaveText('2 notes ready');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(shots, `shopfronts-feedback-${name}.jpg`), type: 'jpeg', quality: 80 });
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { shopfrontsPage: { ready: boolean } }).shopfrontsPage.ready);
    await expect(page.locator('#ready')).toHaveText('2 notes ready');
    await expect(boxes.nth(0)).toHaveValue('Sign is too big');
    await page.locator('#saveall').click();
    await expect(page.locator('#bar-msg')).toContainText('1 saved, 1 failed');
    await expect(page.locator('#ready')).toHaveText('1 note ready');
    await expect(boxes.nth(0)).toHaveValue('');
    await expect(boxes.nth(1)).toHaveValue('Wrong door colour');
    await expect(page.locator('.fb .st.err')).toContainText('stub failure');
    const sent = await page.evaluate(() => (window as unknown as { __saved: any[] }).__saved);
    expect(sent).toHaveLength(2);
    expect(sent[0].targetId).toMatch(/^shopfront:(chain|template):/);
    expect(sent[0].category).toBe('building');
    expect(sent[0].context).toHaveProperty('pands');
  });
}
