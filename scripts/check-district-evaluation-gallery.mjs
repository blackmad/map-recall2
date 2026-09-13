import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const base=process.env.NEIGHBOURHOOD_BASE_URL??'http://127.0.0.1:5195',manifest=await(await fetch(base+'/data/city-expansion/current.json')).json(),root=`public/data/city-expansion/evaluations/${manifest.releaseId}`,artifacts=JSON.parse(await fs.readFile(root+'/artifacts.json'));
for(const artifact of artifacts.artifacts)assert.equal(crypto.createHash('sha256').update(await fs.readFile(root+'/'+artifact.file)).digest('hex'),artifact.sha256,artifact.file);
const browser=await chromium.launch({headless:true});try{
  for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/canal-drive/district-evaluation.html?release='+manifest.releaseId);await page.waitForFunction(()=>document.querySelectorAll('.case').length===30);
    assert.match(await page.locator('#status').textContent(),/remain unmeasured/);assert.equal(await page.locator('.case iframe').count(),0,'captured comparisons do not allocate thirty live WebGL scenes');assert.equal(await page.locator('.case img').count(),60);const report=JSON.parse(await fs.readFile(root+'/evaluation.json'));assert.ok((await page.locator('#coverage').textContent()).includes((report.coverage.processedEligibleFrontageRatio*100).toLocaleString(undefined,{maximumFractionDigits:2})+'%'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    for(const href of await page.locator('.case a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))))if(href.includes('city-appearance.html'))assert.ok(href.includes('release='+manifest.releaseId)&&href.includes('frontage='),'case render links retain release and observation identity');
    await page.screenshot({path:root+`/gallery-${width}.png`,fullPage:false});await page.close();
  }
}finally{await browser.close();}
console.log('Evaluation gallery: 30 source/render pairs, immutable artifact hashes, pinned links, responsive layouts and separate pending human review passed.');
