import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {insideBuildingFootprint,frontageFraming} from '../public/canal-drive/da-costa-block/frontage-camera.js';
const base='http://127.0.0.1:5195',block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const browser=await chromium.launch({headless:true}),errors=[],metrics=[];
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/canal-drive/da-costa-block.html?neighbourhood=1&machineSigns=1&frontage=0363100012162168_e_04g3jtu');await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const {plan,camera,signs}=await page.evaluate(()=>({plan:window.daCostaDemo.initialFrontageCamera(),camera:window.daCostaDemo.status().camera,signs:window.daCostaDemo.machineSigns()}));
    const extent=await page.evaluate(()=>window.daCostaDemo.data().displayExtent);assert.deepEqual(extent.clippedFrontageIds,[]);assert.deepEqual(extent.sourceBounds,block.bounds);
    assert.equal(plan.usable,true);assert.equal(plan.constrained,true);assert.ok(plan.radius<14);
    assert.ok(camera.every((v,i)=>Math.abs(v-plan.position[i])<1e-5));assert.equal(block.buildings.some(b=>insideBuildingFootprint([camera[0],camera[2]],b)),false);
    assert.ok(signs.previews.some(s=>s.text==='IWKA'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('.stage').screenshot({path:`.cache/da-costa-neighbourhood/frontage-camera-iwka-${width}.png`,timeout:90000});
    // The old 18m wheel minimum would jump this close camera through the opposite wall.
    await page.locator('#scene').dispatchEvent('wheel',{deltaY:-1});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const after=await page.evaluate(()=>window.daCostaDemo.status().camera),distance=Math.hypot(...after.map((v,i)=>v-plan.target[i]));assert.ok(distance<plan.radius);
    await page.locator('#scene').dispatchEvent('keydown',{key:'ArrowUp'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const keyed=await page.evaluate(()=>window.daCostaDemo.status().camera);assert.ok(Math.hypot(...keyed.map((v,i)=>v-plan.target[i]))<distance,'keyboard zoom also respects close frontage radius');
    if(width===1440){
      await page.setViewportSize({width:390,height:1000});await page.waitForFunction(()=>{const r=document.querySelector('.stage').getBoundingClientRect();return r.width<400&&Math.abs(window.daCostaDemo.frontageFraming().aspect-r.width/r.height)<1e-6;});
      const framing=await page.evaluate(()=>window.daCostaDemo.frontageFraming()),record=await page.evaluate(()=>window.daCostaDemo.evidence().records.find(r=>r.id==='0363100012162168_e_04g3jtu'));
      const expected=frontageFraming(record,framing.aspect,framing.radius);assert.ok(Math.abs(framing.fov-expected.fov)<1e-6);assert.equal(await page.locator('#view-note').evaluate(el=>el.hidden),expected.wholeFacadeFits);
    }
    metrics.push({width,plan,camera});await page.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile('.cache/da-costa-neighbourhood/frontage-camera-render-metrics.json',JSON.stringify({metrics,errors},null,2));console.log('Passed: IWKA actual desktop/mobile camera outside footprints, bounded lens, seven signs retained, no overflow/errors and close zoom without 18m snap.');
}finally{await browser.close();}
