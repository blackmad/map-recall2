import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const baseUrl = arg('base-url') ?? 'http://127.0.0.1:5187';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(arg('output') ?? `.cache/facade-rebuild/reports/recipe-renders-${runId}`);
await mkdir(path.dirname(output), { recursive: true }); await mkdir(output);
const browser = await chromium.launch({ headless: true });
const viewport = { width: 1440, height: 1050 };
const report: any = { schemaVersion: 1, runId, viewport, inputs: {}, views: [], errors: [],
  scope: 'Authored recipe/compiler diagnostics. No image registration, real appearance or hardware performance acceptance.' };
for (const file of ['public/canal-drive/facade-recipe-lab.html', 'public/canal-drive/js/facade-recipe.bundle.js',
  'public/canal-drive/js/three.bundle.js', 'src/canalRecall/facade/fixtures/recipe-pilot-source.json'])
  report.inputs[file] = createHash('sha256').update(await readFile(file)).digest('hex');
try {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${baseUrl}/canal-drive/facade-recipe-lab.html`);
  await page.waitForFunction(() => (window as any).canalRecallRecipeLab?.status().map?.shown
    && (window as any).canalRecallRecipeLab.status().streaming?.tiles > 0, {}, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const capture = async (name: string) => {
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    report.views.push({ name, status: await page.evaluate(() => (window as any).canalRecallRecipeLab.status()) });
  };
  await capture('bag-footprint-authored-facade');
  await page.locator('#evict').click(); await capture('fallback-after-eviction');
  await page.locator('#reload').click();
  await page.waitForFunction(() => (window as any).canalRecallRecipeLab.status().map.shown);
  await capture('proposal-reloaded');
  for (const fixture of ['1', '2']) {
    await page.locator('#fixture').selectOption(fixture);
    await page.waitForFunction(() => (window as any).canalRecallRecipeLab.status().buildingId.startsWith('fixture:'));
    await page.locator('#view').selectOption(fixture === '1' ? 'facade' : 'roof');
    await page.waitForTimeout(150);
    await capture(fixture === '1' ? 'synthetic-stepped-gable' : 'synthetic-courtyard-passage');
    await page.locator('#mode').selectOption('surfaces');
    await capture(`surface-classes-${fixture}`);
    await page.locator('#mode').selectOption('palette');
  }
  const original = await page.evaluate(() => (window as any).canalRecallRecipeLab.recipe());
  const before = await page.evaluate(() => (window as any).canalRecallRecipeLab.status().assetHash);
  original.elevations[0].openings.value[0].leftM = 999;
  await page.evaluate(r => (window as any).canalRecallRecipeLab.compile(r), original);
  const after = await page.evaluate(() => (window as any).canalRecallRecipeLab.status());
  if (after.assetHash !== before || !after.error.includes('escapes')) throw new Error('Invalid edit lost previous asset');
  report.invalidEditRetainedAsset = true;
  if (report.errors.length) throw new Error(report.errors.join('; '));
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error); throw error; }
finally { await browser.close(); await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(`Recipe renders: ${output}`);
