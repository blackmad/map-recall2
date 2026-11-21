/**
 * Belt review page smoke (desktop 1440x900 and phone 390x844): index; stage 1 photo pick by keyboard; stage 2 marks on
 * the photo-over-render row, W opens the focus view and a pin; stage 3 join + identical-to; stage 4 resolve, accept; compare round flip and verdict;
 * every stage at phone width. Serves its own express app on PW_PORT (default 4330) over a temporary copy of the fixture face,
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

      // Stage 2: the face as photo-over-render rows; G on every house but one, W on that one opens the focus view,
      // where a click on the render pins what is wrong (tag key 1 = roof).
      await page.locator('.step', { hasText: 'Likeness' }).click();
      const loaded = (sel: string) => page.waitForFunction(q => [...document.querySelectorAll<HTMLImageElement>(q)].length > 0 && [...document.querySelectorAll<HTMLImageElement>(q)].every(i => i.complete && i.naturalWidth > 0), sel, { timeout: 120_000 });
      await loaded('.rowbox img');
      const houses = (await readJson('face.json')).pands.length;
      assert.equal(await page.locator('.markcell').count(), houses);
      await page.keyboard.press('w');
      await page.waitForSelector('.focus');
      await loaded('.focus img.render');
      const rr = await page.locator('.focus img.render').boundingBox();
      await page.mouse.click(rr!.x + rr!.width / 2, rr!.y + rr!.height * 0.1);
      await page.waitForFunction(() => document.activeElement?.id === 'pin-note');
      await page.keyboard.press('1');
      await page.waitForFunction(() => document.querySelectorAll('.focus .pinrow').length === 1);
      const pin0 = Object.values((await readJson('pins.json')).pins)[0] as { tag: string; target: string };
      assert.equal(pin0.tag, 'roof'); assert.equal(pin0.target, 'render');
      await page.screenshot({ path: path.join(shots, 'belt-review-stage2-focus-desktop.png') });
      await page.keyboard.press('Escape');
      // Off the wrong house, then G marks each house and moves on to the next unmarked one in review order.
      await page.keyboard.press('ArrowRight');
      for (let i = 1; i < houses; i++) { await page.keyboard.press('g'); await page.waitForFunction(n => document.querySelectorAll('.cell .mk').length >= n, i + 1); }
      const marks = (await readJson('marks.json')).marks;
      assert.equal(Object.keys(marks).length, houses);
      assert.equal(Object.values(marks).filter((m: any) => m.mark === 'wrong').length, 1);
      await loaded('.rowbox img');
      await page.screenshot({ path: path.join(shots, 'belt-review-stage2-desktop.png') });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => [...document.querySelectorAll('.step.done')].length >= 2);

      // Stage 3: join two houses into a unit, mark a third identical to the second.
      await page.waitForSelector('.cell', { timeout: 120_000 });
      await loaded('.rowbox img');
      const cells = page.locator('.cell');
      await cells.nth(0).click(); await cells.nth(1).click(); await page.keyboard.press('g');
      await page.waitForFunction(() => document.querySelector('.status')?.textContent === 'Grouping saved');
      await page.locator('.cell').nth(2).click(); await page.keyboard.press('i'); await page.locator('.cell').nth(1).click();
      await page.waitForFunction(() => document.querySelectorAll('.links li').length === 1);
      const g = await readJson('grouping.json');
      assert.equal(g.units.find((u: { source: string }) => u.source === 'david').pandIds.length, 2); assert.equal(g.links[0].kind, 'sameAs');
      await loaded('.rowbox img');
      await page.screenshot({ path: path.join(shots, 'belt-review-stage3-desktop.png') });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => [...document.querySelectorAll('.step.done')].length >= 3);

      // Stage 4: resolve the pin, accept the block.
      await page.waitForSelector('.pinrow');
      await page.screenshot({ path: path.join(shots, 'belt-review-stage4-desktop.png') });
      await page.locator('.pinrow button', { hasText: 'Resolve' }).click();
      await page.waitForFunction(() => document.querySelector('.pinrow.resolved'));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.pill.accepted'));
      assert.equal((await readJson('state.json')).status, 'accepted');
      const ledger = await readJson('ledger.json');
      assert.equal(ledger.pins.total, 1); assert.equal(ledger.marks.now.wrong, 1); assert.equal(ledger.marks.now.good, houses - 1);
    } else {
      // Phone: each stage of the (now accepted) block, read-only.
      for (const st of [2, 3, 4]) {
        await page.goto(`${base}?face=${FIXTURE}&stage=${st}`);
        await page.waitForSelector(st === 4 ? '.pinrow' : '.rowbox img', { timeout: 120_000 });
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].every(i => i.complete), undefined, { timeout: 120_000 });
        assert.ok(await noOverflow(page), `${label}: stage ${st} overflows`);
        await page.screenshot({ path: path.join(shots, `belt-review-stage${st}-${label}.png`) });
      }
    }

    await page.goto(`${base}?round=ring-r2`);
    await page.waitForSelector('.layers button, .empty');
    if (await page.locator('.layers button').count()) {
      // Stack (default): every layer visible at once, at one width, fitting the viewport height on desktop.
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.band img')].every(i => i.complete && i.style.width));
      const bands = await page.locator('.band img').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ w: r.width, bottom: r.bottom })));
      const layers = await page.locator('.layers button[data-i]').count();
      assert.equal(bands.length, layers, `${label}: stack shows every layer`);
      assert.ok(Math.max(...bands.map(b => b.w)) - Math.min(...bands.map(b => b.w)) < 12, `${label}: bands differ in width`);
      if (label === 'desktop') assert.ok(Math.max(...bands.map(b => b.bottom)) <= viewport.height + 1, 'desktop: stack does not fit the viewport');
      const box = await page.locator('.band img').nth(1).boundingBox();
      await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height / 2);
      assert.equal(await page.locator('.band .cursor:not([hidden])').count(), layers, `${label}: cursor line on every band`);
      await page.screenshot({ path: path.join(shots, `belt-review-compare-stack-${label}.png`) });
      if (label === 'desktop') {
        await page.locator('.band').nth(2).click();
        await page.waitForFunction(() => document.querySelectorAll('.band.big').length === 2);
        await page.screenshot({ path: path.join(shots, 'belt-review-compare-enlarged-desktop.png') });
        await page.keyboard.press('p');
        await page.waitForFunction(() => document.querySelectorAll('.stage.pair .band').length === 2 && [...document.querySelectorAll<HTMLImageElement>('.band img')].every(i => i.complete && i.style.width));
        await page.screenshot({ path: path.join(shots, 'belt-review-compare-pair-desktop.png') });
      }
      await page.keyboard.press('s');
      await page.waitForSelector('.stage.single');
      await page.keyboard.press('w');
      assert.equal(await page.locator('.layers button[data-i].on').first().textContent(), 'W today');
      await page.keyboard.press('q');
      if (label === 'desktop') {
        await page.keyboard.press('2');
        await page.waitForFunction(() => document.querySelector('.vb.same.on'));
        const v = JSON.parse(await fs.readFile(path.join(data, 'rounds', 'ring-r2', 'verdicts.json'), 'utf8'));
        assert.equal(Object.values(v.verdicts as Record<string, { verdict: string }>)[0].verdict, 'same');
      }
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.stage img')].every(i => i.complete));
      await page.keyboard.press('s');
      await page.waitForSelector('.stage.stack');
      await page.locator('.photos').scrollIntoViewIfNeeded();
      // Photos are lazy and scroll sideways: only the first must have loaded.
      await page.waitForFunction(() => { const i = document.querySelector<HTMLImageElement>('.photos img'); return !i || (i.complete && i.naturalWidth > 0); });
      await page.screenshot({ path: path.join(shots, `belt-review-compare-photos-${label}.png`) });
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
