/** Read-only live map regression; all POSTs blocked and preview GPU work stubbed. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.NEIGHBOURHOOD_URL||'http://127.0.0.1:5195';
const before=await (await fetch(base+'/api/neighbourhood/export')).text();
const data=await (await fetch(base+'/api/neighbourhood')).json();
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const first=data.records.filter(r=>r.priorityRank&&!r.review).sort((a,b)=>a.priorityRank-b.priorityRank)[0];assert.ok(first,'A first priority is required');
for(const r of data.records)assert.deepEqual(r.mapFootprint,block.buildings.find(b=>b.id===r.buildingId).footprint,'Publisher preserves actual local footprint');
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.route('**/*',route=>route.request().method()==='POST'?route.abort():route.continue());
  await page.route('**/canal-drive/da-costa-block.html?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Map test preview fixture</title>'}));
  const results=[];
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.goto(base+'/canal-drive/neighbourhood-review.html?queue=priority');await page.waitForFunction(()=>window.neighbourhoodReview?.state().ready);
    assert.equal(await page.evaluate(()=>window.neighbourhoodReview.state().id),first.id);
    for(let selection=0;selection<2;selection++){
      const targetId=await page.evaluate(()=>window.neighbourhoodReview.state().targetId),target=data.records.find(r=>r.id===targetId);
      const map=await page.locator('#map').evaluate(svg=>{
        const box=svg.viewBox.baseVal,camera=svg.querySelector('.photo-camera'),wall=svg.querySelector('.selected-wall');
        const fits=(x,y,pad=0)=>x-pad>=box.x-1e-6&&y-pad>=box.y-1e-6&&x+pad<=box.x+box.width+1e-6&&y+pad<=box.y+box.height+1e-6;
        return {camera:[camera.cx.baseVal.value,camera.cy.baseVal.value],cameraInside:fits(camera.cx.baseVal.value,camera.cy.baseVal.value,camera.r.baseVal.value),wall:[wall.x1.baseVal.value,wall.y1.baseVal.value,wall.x2.baseVal.value,wall.y2.baseVal.value],wallInside:fits(wall.x1.baseVal.value,wall.y1.baseVal.value)&&fits(wall.x2.baseVal.value,wall.y2.baseVal.value),outlines:svg.querySelectorAll('.building-outline').length,allOutlinesInside:[...svg.querySelectorAll('.building-outline')].every(p=>{const b=p.getBBox();return fits(b.x,b.y)&&fits(b.x+b.width,b.y+b.height);}),pageOverflow:document.documentElement.scrollWidth>innerWidth,svgOverflow:svg.getBoundingClientRect().right>innerWidth,viewBox:svg.getAttribute('viewBox')};
      });
      assert.equal(map.cameraInside,true,'Camera circle is inside auto-fit bounds');assert.equal(map.wallInside,true,'Selected wall is inside auto-fit bounds');assert.ok(map.outlines>0,'Actual building outline shown');assert.equal(map.allOutlinesInside,true,'Whole building outline fits');assert.equal(map.pageOverflow,false);assert.equal(map.svgOverflow,false);
      assert.ok(map.wall.every((n,i)=>Math.abs(n-[...target.localStart,...target.localEnd][i])<1e-4),'SVG float coordinates preserve selected wall');
      assert.ok(Math.abs(map.camera[0]-(first.images.full.pose.x-block.origin.x))<.03&&Math.abs(map.camera[1]-(block.origin.y-first.images.full.pose.y))<.03,'Camera location agrees with source RD origin');
      assert.match(await page.locator('#map-legend').textContent(),/Selected wall.*Full-photo camera.*Building footprint.*North/);
      results.push({viewport:viewport.width,targetId,viewBox:map.viewBox});
      if(selection===0){await page.locator('#map').screenshot({path:`.cache/da-costa-neighbourhood/placement-map-${viewport.width}.png`});await page.locator('#wall-right').click();}
    }
  }
  assert.deepEqual(errors,[]);assert.equal(await (await fetch(base+'/api/neighbourhood/export')).text(),before,'Read-only map test must not alter real reviews');
  console.log(JSON.stringify({passed:true,firstPriority:first.id,checks:results,realReviewWrites:0}));
}finally{await browser.close();}
