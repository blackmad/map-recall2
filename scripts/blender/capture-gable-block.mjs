import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/gable-block';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto((process.env.BUILDING_PREVIEW_ORIGIN || 'http://127.0.0.1:3000') + '/canal-drive/gable-block.html');
  await page.waitForFunction(() => window.gableBlockPreview?.loaded);
  const ids = await page.locator('#building option').evaluateAll(options => options.map(option => option.value));
  assert(ids.length >= 7, 'At least six architectural examples plus whole block');
  for (const id of ids) {
    await page.selectOption('#building', id);
    await page.waitForFunction(id => window.gableBlockPreview.id === id, id);
    for (const view of ['oblique', 'front', 'roof']) {
      await page.click(`[data-view="${view}"]`);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `${output}/${id}-browser-${view}.png` });
    }
  }
  await page.selectOption('#building', 'all');
  await page.click('[data-view="oblique"]');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/browser-mobile.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  const result = { passed: true, buildings: ids.length - 1, views: ['oblique', 'front', 'roof'], errors, mobileOverflow: false };
  await fs.writeFile(`${output}/browser-checks.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
