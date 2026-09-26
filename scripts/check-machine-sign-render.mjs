/** Compact opt-in sign A/B. No paid calls or human decisions. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base='http://127.0.0.1:5195',root='.cache/da-costa-neighbourhood';
const data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const ice=data.records.find(r=>r.address==='Da Costakade 28'&&r.effectiveProposal?.visibleSignText?.includes('IJscuypje'));
const michel=data.records.find(r=>r.effectiveProposal?.visibleSignText==='michel de letter');
const browser=await chromium.launch({headless:true}),metrics=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  const load=async query=>{await page.goto(base+'/canal-drive/da-costa-block.html'+query);await page.waitForFunction(()=>window.daCostaDemo?.status().ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.evaluate(()=>({status:window.daCostaDemo.status(),signs:window.daCostaDemo.machineSigns()}));};
  for(const mode of ['off','on']){
    const snapshot=await load('?neighbourhood=1&frontage='+ice.id+(mode==='on'?'&machineSigns=1':''));
    if(mode==='off'){assert.equal(snapshot.signs.enabled,false);assert.equal(snapshot.signs.previews.length,0);assert.equal(await page.locator('#machine-sign-provenance').count(),0);}
    else{
      assert.equal(snapshot.signs.previews.length,2);assert.ok(snapshot.signs.previews.some(s=>s.text==='IJscuypje; ICE CREAM'));
      assert.equal(snapshot.signs.previews.some(s=>/sterk|scooter/i.test(s.text)),false);
      assert.equal(await page.locator('#machine-sign-provenance').textContent(),'Agent-extracted sign preview — unreviewed');
      const matched=await page.evaluate(()=>{const d=window.daCostaDemo;return d.machineSigns().previews.every(p=>d.data().buildings.find(b=>b.id===p.buildingId).surfaces.some(s=>s.observation?.id===p.id));});assert.equal(matched,true);
    }
    metrics.push({view:'IJscuypje',device:'desktop',mode,drawCalls:snapshot.status.drawCalls,triangles:snapshot.status.triangles,camera:snapshot.status.camera,signs:snapshot.signs});
    await page.locator('.stage').screenshot({path:`${root}/machine-signs-ice-desktop-${mode}.png`,timeout:90000});
  }
  assert.deepEqual(metrics[0].camera,metrics[1].camera);
  assert.ok(metrics[1].drawCalls-metrics[0].drawCalls<=2);assert.ok(metrics[1].triangles-metrics[0].triangles<=4);
  await page.locator('#anchors').uncheck({force:true});assert.equal(await page.evaluate(()=>window.daCostaDemo.machineSigns().visible),false);assert.equal(await page.locator('#machine-sign-provenance').isVisible(),false);
  await page.locator('#anchors').check({force:true});assert.equal(await page.evaluate(()=>window.daCostaDemo.machineSigns().visible),true);
  const other=await load('?neighbourhood=1&machineSigns=1&frontage='+michel.id);
  metrics.push({view:'Michel',device:'desktop',drawCalls:other.status.drawCalls,triangles:other.status.triangles});
  await page.locator('.stage').screenshot({path:`${root}/machine-signs-michel-desktop-on.png`,timeout:90000});
  await page.setViewportSize({width:390,height:844});
  const mobile=await load('?neighbourhood=1&machineSigns=1&frontage='+ice.id);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  metrics.push({view:'IJscuypje',device:'mobile',drawCalls:mobile.status.drawCalls,triangles:mobile.status.triangles});
  await page.locator('.stage').screenshot({path:`${root}/machine-signs-ice-mobile-on.png`,timeout:90000});
  const original=await load('?machineSigns=1');assert.equal(original.signs.enabled,false);assert.equal(original.signs.previews.length,0,'query alone does not change original scene');
  assert.deepEqual(errors,[]);
  await fs.writeFile(root+'/machine-sign-render-metrics.json',JSON.stringify({at:new Date().toISOString(),metrics,errors},null,2)+'\n');
  console.log(JSON.stringify(metrics.map(({signs,camera,...rest})=>rest),null,2));
  console.log('Passed: default-off/original compatibility, exactly matched direct-agent sign bands, authored deduplication, visibility toggle, mobile layout and bounded render cost.');
}finally{await browser.close();}
