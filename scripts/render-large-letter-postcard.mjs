/**
 * Render large-letter postcard canvases to PNG for vision critique loops.
 * Usage: npx playwright test scripts/render-large-letter-postcard.mjs  (or node via playwright)
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = path.join(root, '.tmp/large-letter-harness.html');
const outDir = path.join(root, '.tmp');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`file://${harness}`);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
const canvases = page.locator('canvas');
const n = await canvases.count();
for (let i = 0; i < n; i++) {
  const name = await canvases.nth(i).getAttribute('data-name');
  const file = path.join(outDir, `postcard-iter-${String(name || i).toLowerCase().replace(/\s+/g, '-')}.png`);
  await canvases.nth(i).screenshot({ path: file });
  console.log('wrote', file);
}
await browser.close();
