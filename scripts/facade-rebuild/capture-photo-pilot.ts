/** Reproduce a small, explicitly authored correction on one pinned development image.
 * These labels demonstrate the correction path; they are not a blind benchmark.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const run = 'public/canal-drive/facade-photo-review/local/pilot-01';
const input = JSON.parse(readFileSync(`${run}/manifest.json`, 'utf8'));
const sourceHash = '86c9496387692f2f252eed562a298b33a3e384a51cd85ce9aa1b2509f2b281f7';
const record = input.records.find((r: { sourceSha256: string }) => r.sourceSha256 === sourceHash);
if (!record || createHash('sha256').update(readFileSync(`${run}/${record.image}`)).digest('hex') !== sourceHash)
  throw new Error('Correction applies only to the reviewed Keizersgracht 136 development image');
const out = path.resolve(`.cache/facade-rebuild/reports/photo-pilot-${new Date().toISOString().replaceAll(':', '-')}`);
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${process.env.FACADE_BASE_URL || 'http://127.0.0.1:5187'}/canal-drive/facade-photo-lab.html?run=pilot-01`);
  await page.waitForFunction(() => (window as any).canalRecallPhotoLab?.status().ready);
  const before = await page.evaluate(() => (window as any).canalRecallPhotoLab.status());
  await page.screenshot({ path: `${out}/01-raw.png`, fullPage: true });
  await page.locator('#show-mask').check();
  await page.screenshot({ path: `${out}/02-mask.png`, fullPage: true });
  await page.locator('#show-mask').uncheck();
  let editCount = 0;
  const waitEdit = async () => {
    editCount++;
    await page.waitForFunction(n => (window as any).canalRecallPhotoLab.status().edits === n, editCount);
  };
  const fillBox = async (box: number[]) => {
    for (const [i, id] of ['x0', 'y0', 'x1', 'y1'].entries()) await page.locator(`#${id}`).fill(String(box[i]));
  };
  await page.locator('#opening').selectOption('window-2');
  await fillBox([177, 31, 233, 114]); await page.locator('#apply').click(); await waitEdit();
  await fillBox([177, 140, 233, 241]); await page.locator('#add').click(); await waitEdit();
  await page.locator('#opening').selectOption('window-9'); await page.locator('#omit').click(); await waitEdit();
  await page.locator('#wall-bottom').fill('405'); await page.locator('#crop').click(); await waitEdit();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/03-corrected.png`, fullPage: true });
  const downloading = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await downloading; await download.saveAs(`${out}/correction.json`);
  const after = await page.evaluate(() => (window as any).canalRecallPhotoLab.status());
  if (before.meshHash === after.meshHash || after.openings.length !== 9 || after.error) throw new Error('Correction did not produce the expected mesh');
  // Discoverable example, separate from the immutable raw extraction manifest.
  writeFileSync(`${run}/correction.json`, readFileSync(`${out}/correction.json`));
  writeFileSync(`${out}/report.json`, JSON.stringify({ sourceHash, before, after,
    review: 'Codex visual development correction. Unaccepted; single image, no independent registration.',
    changes: ['Split right-hand detection spanning two storeys into two boxes', 'Omit car-headlight detection', 'Exclude foreground rows below the visible wall'],
    remaining: ['Other boxes retain segmentation error', 'Bottom-left opening kind is unreviewed', 'Wall colour includes lighting and model-mask uncertainty', 'Roof, ground and registration remain unknown'],
  }, null, 2));
  console.log(out);
} finally { await browser.close(); }
