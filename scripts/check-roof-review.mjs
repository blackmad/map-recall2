/** Read-only roof review integration: no API writes, no duplicate GPU render work. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {roofPlanSvg} from '../public/canal-drive/da-costa-block/roof-diagram.js';
const base='http://127.0.0.1:5195',before=await(await fetch(base+'/api/neighbourhood/export')).text();
const data=await(await fetch(base+'/api/neighbourhood')).json(),block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
for(const r of data.records){
  const b=block.buildings.find(b=>b.id===r.buildingId);
  assert.equal(r.roofPlan.buildingSurfacesSha256,createHash('sha256').update(JSON.stringify(b.surfaces)).digest('hex'));
  assert.deepEqual(r.roofPlan.wall,[r.localStart,r.localEnd]);
  for(const f of r.roofPlan.faces)assert.deepEqual(f.rings,b.surfaces[f.surfaceIndex].rings.map(ring=>ring.map(p=>[p[0],p[2]])));
  assert.equal(r.roofComponents.authoritativeRoofClass,null);assert.equal(r.roofAssessment.authoritativeShape,null);
  assert.equal(r.roofConflict,r.roofAssessment.imageDisagreement);
}
assert.equal(roofPlanSvg({faces:[{rings:[[[NaN,1]]]}],wall:[[0,0],[1,1]]},null),'');
const browser=await chromium.launch({headless:true}),errors=[],posts=[];
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().method()==='POST'){posts.push(route.request().url());return route.abort();}return route.continue();});
  await page.route('**/canal-drive/da-costa-block.html?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Roof review preview fixture</title>'}));
  const target=data.records.find(r=>r.address==='Da Costakade 4');assert.ok(target);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await page.goto(base+'/canal-drive/neighbourhood-review.html?viewport='+width+'#'+target.id);await page.waitForFunction(()=>window.neighbourhoodReview?.state().ready);
    assert.equal(await page.locator('.roof-comparison').isVisible(),false,'photo-first default hides geometry until explicitly requested');
    await page.locator('#hide-suggestions').uncheck();
    const detail=page.locator('.roof-comparison');assert.equal(await detail.getAttribute('open'),null);
    await detail.locator('summary').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.neighbourhoodReview.state().stage),'placement','Enter opens details, not placement confirmation');
    assert.equal(await detail.evaluate(d=>d.open),true);
    assert.match(await detail.textContent(),/North ↑/);assert.match(await detail.textContent(),/not the main roof/);assert.match(await detail.textContent(),/3D roof is unchanged/);
    assert.equal(await page.locator('.roof-plan path').count(),target.roofPlan.faces.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await detail.screenshot({path:`.cache/da-costa-neighbourhood/roof-review-${width}.png`});
    await page.locator('#hide-suggestions').check();assert.equal(await detail.isVisible(),false);
    await page.locator('#confirm').click();assert.equal(await page.locator('#roofShape').inputValue(),'unknown');
    await page.locator('#hide-suggestions').uncheck();assert.equal(await detail.isVisible(),true);
    await page.locator('#filter').selectOption('roof-gap');await page.waitForFunction(()=>window.neighbourhoodReview.state().ready);
    const id=await page.evaluate(()=>window.neighbourhoodReview.state().id),r=data.records.find(r=>r.id===id);
    assert.equal(r.roofConflict,false);assert.equal(r.roofAssessment.needsReview,true);
    await page.locator('#filter').selectOption('roof');await page.waitForFunction(()=>window.neighbourhoodReview.state().ready);
    const conflictId=await page.evaluate(()=>window.neighbourhoodReview.state().id);assert.equal(data.records.find(r=>r.id===conflictId).roofAssessment.imageDisagreement,true);
  }
  assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);assert.equal(await(await fetch(base+'/api/neighbourhood/export')).text(),before);
  console.log('Passed: all source roof polygons/hashes, separate question queues, desktop/mobile diagrams, keyboard disclosure, blind-mode hiding and zero real review writes.');
}finally{await browser.close();}
