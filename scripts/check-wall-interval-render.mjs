/** Browser response fixtures only: never save synthetic observations or human reviews. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const source=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const base=process.env.NEIGHBOURHOOD_BASE_URL||'http://127.0.0.1:5195',amsta='0363100012237064';
const ids=[amsta+'_e_1hyy18v',amsta+'_e_0aws3g3'];
const browser=await chromium.launch({headless:true}),errors=[];
try{
  for(const fixture of [false,true]){
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    if(fixture)await page.route('**/data/da-costa-block/neighbourhood.json',route=>{
      const data=structuredClone(source);
      for(const r of data.records)if(ids.includes(r.id))r.effectiveProposal={...r.effectiveProposal,wallColour:r.id===ids[0]?'red':'white',wallMaterial:'render'};
      return route.fulfill({json:data});
    });
    await page.goto(base+'/canal-drive/da-costa-block.html?neighbourhood=1&frontage='+ids[0]);
    await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
    const patches=await page.evaluate(id=>window.daCostaDemo.wallPatches().filter(p=>p.buildingId===id&&p.sourceSurfaceIndex===46),amsta);
    assert.deepEqual(patches.filter(p=>p.observationId).map(p=>p.observationId).sort(),ids.toSorted());
    assert.ok(patches.every(p=>p.triangles>0));
    if(fixture){assert.equal(patches.find(p=>p.observationId===ids[0]).colour,'#945c48');assert.equal(patches.find(p=>p.observationId===ids[1]).colour,'#d8d4c3');}
    await page.screenshot({path:'.cache/da-costa-neighbourhood/wall-interval-amsta-'+(fixture?'synthetic-colours':'actual')+'.png',fullPage:true,timeout:90000});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Passed actual Amsta + browser-only contrasting-colour regression: both frontage intervals rendered, canonical surface index retained, no saved review mutations.');
}finally{await browser.close();}
