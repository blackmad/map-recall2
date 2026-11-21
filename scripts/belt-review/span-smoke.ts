/**
 * Belt review stage 1 facade span + split smoke (desktop 1440x900): on a temporary copy of the fixture face where one wide
 * pand (Prinsengracht 136) gets lane B style candidates (`pandSpanPx` inside a margin) and two house numbers:
 *   dashed BAG lines on its candidates; the "2 addresses" chip; dragging the left facade edge saves facadeSpanPx/M; ] nudges
 *   the right edge 0.25 m; D splits at the cursor, labelled 136 / 138; the ledger counts both; stage 2 lists the two houses
 *   with a cropped photo; stage 3 shows them as separate cells; the panorama link resolves (no tab is opened).
 *
 *   /tmp/canal-pw.sh env PW_PORT=4330 BELT_REVIEW_IMAGE_ROOT=<archive> node --import tsx scripts/belt-review/span-smoke.ts [--shots <dir>]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { beltReviewRouter } from './server/router.ts';

const FIXTURE = '_fixture-prinsengracht-130-150', WIDE = '0363100012165018';
const port = Number(process.env.PW_PORT || 4330);
const shotsArg = process.argv.indexOf('--shots');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'belt-review-span-'));
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : tmp;
await fs.mkdir(shots, { recursive: true });
const data = path.join(tmp, 'data'), dir = path.join(data, FIXTURE);
await fs.cp(path.join('review-data/belt-review', FIXTURE), dir, { recursive: true });
for (const f of ['picks', 'edits', 'grouping', 'pins', 'state', 'ledger']) await fs.rm(path.join(dir, `${f}.json`), { force: true });
const readJson = async (f: string) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));

// The wide pand as lane B will write it: BAG span inside a margin, two house numbers.
const face = await readJson('face.json');
face.pands.find((p: { pandId: string }) => p.pandId === WIDE).numbers = [136, 138];
await fs.writeFile(path.join(dir, 'face.json'), JSON.stringify(face));
const cands = await readJson('candidates.json');
const imageRoot = process.env.BELT_REVIEW_IMAGE_ROOT ?? dir;
for (const c of cands.pands.find((p: { pandId: string }) => p.pandId === WIDE).candidates) {
  const w = c.widthPx ?? (await sharp(path.join(imageRoot, c.file)).metadata()).width;
  c.widthPx = w; c.pandSpanPx = [Math.round(w * 0.12), Math.round(w * 0.88)]; c.marginM = +(w * 0.12 / (c.pxPerM ?? 50)).toFixed(2);
}
await fs.writeFile(path.join(dir, 'candidates.json'), JSON.stringify(cands));

const app = express();
app.use(express.json());
app.use('/api/belt-review', beltReviewRouter({ dataRoot: data }));
app.use('/canal-drive', express.static('public/canal-drive'));
const server = app.listen(port, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.on('listening', () => resolve()); server.on('error', reject); });
const base = `http://127.0.0.1:${port}/canal-drive/belt-review.html?face=${FIXTURE}`;

const launch: Parameters<typeof chromium.launch>[0] = { headless: true };
try { await fs.access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'); launch.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; } catch { /* bundled chromium */ }
const browser = await chromium.launch(launch);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico') && !r.url().includes('/pano-link/')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}&stage=1`);
  await page.waitForSelector('.cand img');
  const order: string[] = face.pands.sort((a: { order: number }, b: { order: number }) => a.order - b.order).map((p: { pandId: string }) => p.pandId);
  const wideAt = order.indexOf(WIDE);
  assert.equal(await page.locator('.pand .addrs').count(), 1, '"2 addresses" chip on the wide pand');
  // Pick up to the wide pand, pick it, come back to it.
  for (let i = 0; i <= wideAt; i++) {
    await page.keyboard.press('1');
    await page.waitForFunction(n => document.querySelectorAll('.pand:not(.open)').length >= n, i + 1);
  }
  await page.keyboard.press('k');
  await page.waitForFunction(() => document.querySelector('.pand-head h2')?.textContent?.includes('136'));
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.cand img')].every(i => i.complete && i.naturalWidth > 0));
  const cards = await page.locator('.cand').count();
  assert.equal(await page.locator('.bagline').count(), 2 * cards, 'two dashed BAG lines on every candidate');

  // Drag the left facade edge 0.6 of the margin further left.
  const left = page.locator('.cand.chosen .edge').first(), box = (await left.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 12, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
  await page.waitForFunction(() => /Saved: facade/.test(document.querySelector('.status')?.textContent ?? '')).catch(async e => {
    await page.screenshot({ path: path.join(shots, 'belt-review-span-FAIL.png') });
    console.log('diag', JSON.stringify(await page.evaluate(() => ({ status: document.querySelector('.status')?.textContent, layer: document.querySelector<HTMLElement>('.cand.chosen .spanlayer')?.getAttribute('style'), cls: document.querySelector('.cand.chosen .spanlayer')?.className, edges: [...document.querySelectorAll('.cand.chosen .edge')].map(x => x.getAttribute('style')) }))), JSON.stringify(box), errors);
    throw e;
  });
  let pk = (await readJson('picks.json')).picks[WIDE];
  assert.ok(pk.facadeSpanM && pk.facadeSpanM[0] < 0, `facade starts left of the BAG span: ${JSON.stringify(pk)}`);
  const right0 = pk.facadeSpanM[1];
  // Select the right edge (a click is a zero-length drag) and nudge it 0.25 m.
  await page.locator('.cand.chosen .edge').nth(1).click();
  await page.keyboard.press(']');
  await page.waitForTimeout(1200); // the nudge saves after a 400 ms pause
  pk = (await readJson('picks.json')).picks[WIDE];
  assert.ok(Math.abs(pk.facadeSpanM[1] - right0 - 0.25) < 0.02, `] nudged ${right0} -> ${pk.facadeSpanM[1]}`);

  // D at the cursor splits the facade into two houses labelled 136 and 138.
  const img = (await page.locator('.cand.chosen .spanlayer').boundingBox())!;
  await page.mouse.move(img.x + img.width * 0.55, img.y + img.height * 0.5);
  await page.keyboard.press('d');
  await page.waitForFunction(() => /2 houses/.test(document.querySelector('.status')?.textContent ?? ''));
  pk = (await readJson('picks.json')).picks[WIDE];
  assert.deepEqual(pk.houses.map((x: { label?: string }) => x.label), ['136', '138']);
  assert.equal(pk.houses[0].fromM, pk.facadeSpanM[0]); assert.equal(pk.houses[1].toM, pk.facadeSpanM[1]);
  const ledger = await readJson('ledger.json');
  assert.equal(ledger.photos.spanCorrected, 1); assert.equal(ledger.photos.pandSplits, 1);
  assert.match(await page.locator('.ledger').textContent() ?? '', /facade span corrected 1 · BAG pand split 1/);
  await page.screenshot({ path: path.join(shots, 'belt-review-span-split-desktop.png') });

  // The panorama link resolves (camera when lane B adds one, else the front from the building tiles).
  const link = await page.request.get(`http://127.0.0.1:${port}/api/belt-review/faces/${FIXTURE}/pano-link/${WIDE}`);
  const linkBody = link.ok() ? await link.json() : await link.text();
  console.log('pano link:', link.status(), JSON.stringify(linkBody));
  if (link.ok()) assert.match(linkBody.url, /^https:\/\/data\.amsterdam\.nl\/data\/geozoek\?center=/);

  // Pick the rest, confirm stage 1; stage 2 lists two houses for the split pand, with a cropped photo.
  await page.keyboard.press('j');
  for (let i = wideAt + 1; i < order.length; i++) { await page.keyboard.press('1'); await page.waitForTimeout(150); }
  await page.waitForFunction(n => document.querySelectorAll('.pand:not(.open)').length >= n, order.length);
  await page.locator('.pand-head h2').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.step.done b')?.textContent === '1');
  await page.waitForSelector('.pand.split');
  assert.equal(await page.locator('.pand.split').count(), 2);
  await page.locator('.pand.split').first().click();
  await page.waitForFunction(() => document.querySelector('.pand-head h2')?.textContent?.includes('Prinsengracht 136'));
  await page.waitForFunction(() => { const i = document.querySelector<HTMLImageElement>('img.photo'); return !!i && i.complete && i.naturalWidth > 0; }, undefined, { timeout: 60_000 });
  await page.waitForFunction(() => { const i = document.querySelector<HTMLImageElement>('img.render'); return !!i && i.complete && i.naturalWidth > 0; }, undefined, { timeout: 120_000 });
  await page.screenshot({ path: path.join(shots, 'belt-review-split-stage2-desktop.png') });

  // Stage 3: the split houses are separate cells.
  await page.locator('.pand-head h2').click();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.cell', { timeout: 120_000 });
  assert.equal(await page.locator('.cell').count(), order.length + 1);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.rowbox img')].every(i => i.complete && i.naturalWidth > 0), undefined, { timeout: 120_000 });
  await page.screenshot({ path: path.join(shots, 'belt-review-split-stage3-desktop.png') });
  assert.deepEqual(errors, [], 'page errors');
  console.log(`belt-review span smoke passed. Screenshots: ${shots}`);
} finally {
  await browser.close();
  await new Promise<void>(r => server.close(() => r()));
}
