import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'artifacts/jordaan-pois';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto((process.env.JORDAAN_PREVIEW_ORIGIN || 'http://127.0.0.1:3000') + '/canal-drive/jordaan-poi-models.html');
  await page.waitForFunction(() => window.jordaanPreview?.loaded);
  const ids = await page.locator('#building option').evaluateAll(options => options.map(o => o.value));
  const results = [];
  for (const id of ids) {
    await page.selectOption('#building', id);
    await page.waitForFunction(id => window.jordaanPreview?.id === id, id);
    const result = await page.evaluate(() => window.jordaanPreview);
    assert(result.bounds[1] > 10 && result.bounds[2] > 8);
    results.push(result);
    for (const view of ['front', 'roof']) {
      await page.click('#' + view);
      await page.screenshot({ path: `${output}/${id}-browser-${view}.png` });
    }
  }
  await page.selectOption('#building', ids[0]);
  await page.waitForFunction(id => window.jordaanPreview?.id === id, ids[0]);
  await page.click('#orbit');
  await page.screenshot({ path: `${output}/browser-preview.png` });
  const specs = await page.evaluate(async () => {
    const { loadJordaanPoiSpecs } = await import('/canal-drive/js/jordaan-poi-models.js');
    return await loadJordaanPoiSpecs();
  });
  assert.equal(specs.length, 5);
  assert(specs.every(s => s.suppressBuildingIds.length === 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/browser-mobile.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/browser-checks.json`, JSON.stringify({ results, errors, specs: specs.length, mobileOverflow: false }, null, 2) + '\n');
  console.log(JSON.stringify({ models: results, errors, mobileOverflow: false }));
} finally {
  await browser.close();
}
