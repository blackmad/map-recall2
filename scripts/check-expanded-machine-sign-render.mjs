/** Seven source-bound sign previews; read-only browser QA, no human writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {machineSignCandidate} from '../public/canal-drive/da-costa-block/machine-signs.js';
import {mayRenderReviewedAwning,sourceBoundAwning} from '../public/canal-drive/da-costa-block/awning-evidence.js';
const base='http://127.0.0.1:5195',out='.cache/da-costa-neighbourhood';
const data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const expected=data.records.map(r=>machineSignCandidate(r,block.anchors)).filter(r=>r.eligible);
assert.equal(expected.length,7);
const targets=[['dorus','DORUS'],['chai','Chai kitchen'],['iwka','IWKA'],['wasserette','Wasserette; WASH PRATIC']].map(([key,text])=>({key,record:data.records.find(r=>r.effectiveProposal?.visibleSignText===text)}));
for(const {record:r} of targets){
  assert.ok(r);assert.equal(mayRenderReviewedAwning(r),false,'actual unreviewed records cannot add fabric');
  const hypothetical={...r,review:{placement:'accepted',targetId:r.id},effectiveProposal:{...r.effectiveProposal,awning:'yes'}};
  assert.equal(mayRenderReviewedAwning(hypothetical),r.effectiveProposal.visibleSignText==='DORUS','only deployed source may pass hypothetical same-target approval');
  hypothetical.review.targetId='wrong-wall';assert.equal(mayRenderReviewedAwning(hypothetical),false);
}
const browser=await chromium.launch({headless:true}),metrics=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  const load=async query=>{
    await page.goto(base+'/canal-drive/da-costa-block.html'+query,{timeout:45000});
    await page.waitForFunction(()=>window.daCostaDemo?.status().ready,{timeout:45000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    return page.evaluate(()=>({status:window.daCostaDemo.status(),signs:window.daCostaDemo.machineSigns()}));
  };
  const checkSeven=async snapshot=>{
    assert.deepEqual(snapshot.signs.previews.map(p=>[p.id,p.text]).sort(),expected.map(p=>[p.id,p.text]).sort());
    assert.equal(new Set(snapshot.signs.previews.map(p=>p.id)).size,7);
    assert.equal(snapshot.signs.previews.some(p=>/sterk|scooter/i.test(p.text)),false);
    assert.equal(await page.locator('#machine-sign-provenance').textContent(),'Agent-extracted sign preview — unreviewed');
    const associations=await page.evaluate(()=>{const d=window.daCostaDemo;return d.machineSigns().previews.map(p=>({id:p.id,matched:d.data().buildings.find(b=>b.id===p.buildingId)?.surfaces.some(s=>s.type==='wall'&&s.observation?.id===p.id),y:p.position[1]}));});
    assert.ok(associations.every(a=>a.matched));assert.ok(associations.every(a=>a.y===3.22));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  };
  const dorus=targets[0].record;
  const off=await load('?neighbourhood=1&frontage='+dorus.id);
  assert.equal(off.signs.enabled,false);assert.equal(off.signs.previews.length,0);assert.equal(await page.locator('#machine-sign-provenance').count(),0);
  await page.locator('.stage').screenshot({path:out+'/expanded-signs-dorus-desktop-off.png',timeout:45000});
  metrics.push({view:'dorus',device:'desktop',mode:'off',drawCalls:off.status.drawCalls,triangles:off.status.triangles,camera:off.status.camera});
  for(const device of ['desktop','mobile']){
    if(device==='mobile')await page.setViewportSize({width:390,height:844});
    for(const {key,record} of targets){
      const s=await load('?neighbourhood=1&machineSigns=1&frontage='+record.id);await checkSeven(s);
      if(device==='desktop'&&key==='dorus'){
        assert.deepEqual(s.status.camera,off.status.camera);
        assert.deepEqual(s.status.anchorFaces,off.status.anchorFaces,'authored anchors unchanged');
        assert.ok(s.status.drawCalls-off.status.drawCalls<=7);assert.ok(s.status.triangles-off.status.triangles<=14);
      }
      await page.locator('.stage').screenshot({path:`${out}/expanded-signs-${key}-${device}-on.png`,timeout:45000});
      metrics.push({view:key,device,mode:'on',drawCalls:s.status.drawCalls,triangles:s.status.triangles,camera:s.status.camera,selected:s.signs.previews.find(p=>p.id===record.id),awning:sourceBoundAwning(record)});
      console.log(JSON.stringify({completed:key,device,drawCalls:s.status.drawCalls,triangles:s.status.triangles}));
    }
  }
  await page.locator('#anchors').uncheck({force:true});assert.equal(await page.evaluate(()=>window.daCostaDemo.machineSigns().visible),false);assert.equal(await page.locator('#machine-sign-provenance').isVisible(),false);
  await page.locator('#anchors').check({force:true});assert.equal(await page.evaluate(()=>window.daCostaDemo.machineSigns().visible),true);
  const original=await load('?machineSigns=1');assert.equal(original.signs.enabled,false);assert.equal(original.signs.previews.length,0);
  assert.deepEqual(errors,[]);
  await fs.writeFile(out+'/expanded-machine-sign-render-metrics.json',JSON.stringify({at:new Date().toISOString(),publishedAt:data.generatedAt,stats:data.stats,expected,metrics,errors},null,2));
  console.log('PASS: all seven labels on matching observation walls; 9 desktop/mobile captures; default/original/anchors unchanged; no overflow/browser errors; source-aware awning guards.');
}finally{await browser.close();}
