/**
 * Belt review page smoke (desktop 1440x900 and phone 390x844): index, stage-1 photo pick by keyboard, confirm, compare
 * round flip and verdict. Serves its own express app on PW_PORT (default 4330) over a temporary copy of the fixture face,
 * so it never writes the committed review-data. Run through the browser queue:
 *
 *   /tmp/canal-pw.sh env PW_PORT=4330 BELT_REVIEW_IMAGE_ROOT=<archive> node --import tsx scripts/belt-review/page-smoke.ts [--shots <dir>]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { chromium, type Page } from 'playwright';
import { beltReviewRouter } from './server/router.ts';

const FIXTURE = '_fixture-prinsengracht-130-150';
const port = Number(process.env.PW_PORT || 4330);
const shotsArg = process.argv.indexOf('--shots');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'belt-review-smoke-'));
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : tmp;
await fs.mkdir(shots, { recursive: true });
const data = path.join(tmp, 'data');
await fs.cp(path.join('review-data/belt-review', FIXTURE), path.join(data, FIXTURE), { recursive: true });
for (const f of ['picks', 'edits', 'grouping', 'pins', 'state', 'ledger']) await fs.rm(path.join(data, FIXTURE, `${f}.json`), { force: true });
await fs.copyFile('review-data/belt-review/rounds.json', path.join(data, 'rounds.json'));

const app = express();
app.use(express.json());
app.use('/api/belt-review', beltReviewRouter({ dataRoot: data }));
app.use('/canal-drive', express.static('public/canal-drive'));
const server = app.listen(port, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.on('listening', () => resolve()); server.on('error', reject); });
const base = `http://127.0.0.1:${port}/canal-drive/belt-review.html`;

const launch: Parameters<typeof chromium.launch>[0] = { headless: true };
try { await fs.access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'); launch.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; } catch { /* bundled chromium */ }
const browser = await chromium.launch(launch);
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const readJson = async (f: string) => JSON.parse(await fs.readFile(path.join(data, FIXTURE, f), 'utf8'));
try {
  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    const page = await browser.newPage({ viewport }), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });

    await page.goto(base);
    await page.waitForSelector('table a');
    assert.ok(await noOverflow(page), `${label}: index overflows`);
    await page.screenshot({ path: path.join(shots, `belt-review-index-${label}.png`) });

    await page.goto(`${base}?face=${FIXTURE}&stage=1`);
    await page.waitForSelector('.cand img');
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.cand img')].every(i => i.complete && i.naturalWidth > 0));
    assert.ok(await noOverflow(page), `${label}: face overflows`);
    // The first house's photo is at least 40% of the viewport tall (big, not a strip).
    const imgBox = await page.locator('.cand img').first().boundingBox();
    assert.ok(imgBox && imgBox.height >= viewport.height * 0.4, `${label}: photo too small (${imgBox?.height})`);
    await page.screenshot({ path: path.join(shots, `belt-review-pick-${label}.png`) });

    if (label === 'desktop') {
      // Pick every house by keyboard: 1 on each, 0 on the one without an auto pick; the page advances itself.
      const pands = (await readJson('face.json')).pands.length;
      for (let i = 0; i < pands; i++) {
        const key = i === 4 ? '0' : '1';
        await page.keyboard.press(key);
        await page.waitForFunction(n => document.querySelectorAll('.pand:not(.open)').length >= n, i + 1);
      }
      const picks = await readJson('picks.json');
      assert.equal(Object.keys(picks.picks).length, pands);
      assert.equal(Object.values(picks.picks).filter((p: any) => p.candidateId === null).length, 1);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.step.done b')?.textContent === '1');
      assert.equal((await readJson('state.json')).stage, 2);
      await page.locator('.step', { hasText: 'Crop' }).click();
      await page.waitForSelector('.locked');
      await page.screenshot({ path: path.join(shots, 'belt-review-confirmed-desktop.png') });
    }

    await page.goto(`${base}?round=ring-r2`);
    await page.waitForSelector('.layers button, .empty');
    if (await page.locator('.layers button').count()) {
      await page.keyboard.press('w');
      assert.equal(await page.locator('.layers button.on').first().textContent(), 'W today');
      await page.keyboard.press('q');
      if (label === 'desktop') {
        await page.keyboard.press('2');
        await page.waitForFunction(() => document.querySelector('.vb.same.on'));
        const v = JSON.parse(await fs.readFile(path.join(data, 'rounds', 'ring-r2', 'verdicts.json'), 'utf8'));
        assert.equal(Object.values(v.verdicts as Record<string, { verdict: string }>)[0].verdict, 'same');
      }
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.stage img')].every(i => i.complete));
    }
    assert.ok(await noOverflow(page), `${label}: compare overflows`);
    await page.screenshot({ path: path.join(shots, `belt-review-compare-${label}.png`) });
    assert.deepEqual(errors, [], `${label}: page errors`);
    await page.close();
  }
  console.log(`belt-review page smoke passed (desktop + phone). Screenshots: ${shots}`);
} finally {
  await browser.close();
  await new Promise<void>(r => server.close(() => r()));
}
