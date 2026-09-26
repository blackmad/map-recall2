/** Read-only browser check for the expansion evidence gallery. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.NEIGHBOURHOOD_BASE_URL||'http://127.0.0.1:5195',browser=await chromium.launch({headless:true}),errors=[];
await fs.mkdir('.cache/city-appearance/panorama-audit-check',{recursive:true});
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/canal-drive/panorama-audit.html');await page.waitForSelector('.card:nth-child(24)');
    assert.equal(await page.locator('.card').count(),24);assert.equal(await page.locator('.card.usable').count(),20);assert.equal(await page.locator('.card.partial').count(),4);
    assert.match(await page.locator('#summary').textContent(),/257\.27 m usable/);assert.match(await page.locator('#summary').textContent(),/not human gold/);
    assert.match(await page.locator('#summary').textContent(),/20 machine suggestions quarantined/);assert.equal(await page.locator('.proposal').count(),20);
    await page.locator('button[data-filter="partial"]').click();assert.equal(await page.locator('.card:visible').count(),4);
    const image=page.locator('.card:visible img').first();await image.scrollIntoViewIfNeeded();await image.waitFor({state:'visible'});await page.waitForFunction(element=>element.complete&&element.naturalWidth>0,await image.elementHandle());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`.cache/city-appearance/panorama-audit-check/gallery-${width}.png`,fullPage:true});await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Panorama audit demo: 24 source-bound cards, 20 quarantined routes, status filtering, desktop/mobile layout and evidence loading passed.');
}finally{await browser.close();}
