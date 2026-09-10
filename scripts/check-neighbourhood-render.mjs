/** Read-only browser/render checks. No human decisions or paid requests. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { observationFor, surfaceMatches, roofPalette } from '../public/canal-drive/da-costa-block/evidence.js';
import { wallObservationIntervals } from '../public/canal-drive/da-costa-block/wall-intervals.js';

const root='.cache/da-costa-neighbourhood',base=process.env.NEIGHBOURHOOD_BASE_URL||'http://127.0.0.1:5195';
const source=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
for(const r of source.records){
  assert.deepEqual(r.surfaceIndices,surfaceMatches(block.buildings.find(b=>b.id===r.buildingId),r));
  for(const index of r.renderSurfaceIndices)assert.equal(block.buildings.find(b=>b.id===r.renderBuildingId).surfaces[index].type,'wall');
}
const first=source.records.find(r=>r.renderSurfaceIndices.length&&r.effectiveProposal?.wholeUsable==='yes');
const index=first.renderSurfaceIndices[0],accepted={...first,id:'accepted-fixture',review:{placement:'accepted'}};
assert.equal(observationFor([first,accepted],first.renderBuildingId,index).id,accepted.id);
assert.equal(observationFor([{...first,review:{placement:'uncertain'}}],first.renderBuildingId,index),undefined);
assert.equal(observationFor([{...first,review:{placement:'rejected'}}],first.renderBuildingId,index),undefined);
assert.equal(observationFor([{...first,effectiveProposal:{wholeUsable:'no'}}],first.renderBuildingId,index),undefined);
assert.equal(observationFor([first],'not-the-target',index),undefined);
assert.equal(roofPalette('not-a-colour'),null);
assert.ok(new Set(source.records.map(r=>roofPalette(r.images.aerial?.roofColour)).filter(Boolean)).size<=8);

const browser=await chromium.launch({headless:true}),metrics=[],errors=[];
try{
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(device+': '+e.message));
    for(const [mode,query] of [['original',''],['neighbourhood','?neighbourhood=1'],['elandsgracht','?study=elandsgracht']]){
      await page.goto(base+'/canal-drive/da-costa-block.html'+query);
      await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${device}/${mode}: horizontal overflow`);
      const status=await page.evaluate(()=>window.daCostaDemo.status());
      if(mode!=='elandsgracht')assert.deepEqual(status.anchorFaces.map(a=>[a.id,a.buildingId]).sort(),block.anchors.flatMap(a=>(a.frontages||[{buildingId:a.buildingId}]).map(f=>[a.id,f.buildingId])).sort(),`${mode}: preserve authored anchors`);
      metrics.push({device,mode,view:'overview',drawCalls:status.drawCalls,triangles:status.triangles,camera:status.camera});
      await page.screenshot({path:`${root}/render-${device}-${mode}-overview.png`,fullPage:true,timeout:90000});
      if(mode==='neighbourhood'){
        let materials=await page.evaluate(()=>window.daCostaDemo.materials());
        for(const m of materials)assert.equal(m.hasTexture,m.brick,'plain walls must not inherit another wall’s brick texture');
        await page.locator('#compare').click();
        materials=await page.evaluate(()=>window.daCostaDemo.materials());
        for(const m of materials)assert.equal(m.hasTexture,false,'plain comparison removes textures');
        await page.locator('#compare').click();
        materials=await page.evaluate(()=>window.daCostaDemo.materials());
        for(const m of materials)assert.equal(m.hasTexture,m.brick,'comparison restores texture per material');
        const association=await page.evaluate(()=>window.daCostaDemo.wallPatches().filter(p=>p.observationId));
        assert.ok(association.length>0);
        for(const a of association){const b=block.buildings.find(b=>b.id===a.buildingId),s=b.surfaces[a.sourceSurfaceIndex];assert.equal(s.type,'wall');const p=wallObservationIntervals(s,a.sourceSurfaceIndex,b.id,source.records).intervals.find(p=>p.startM===a.startM&&p.endM===a.endM);assert.equal(p?.observation?.id,a.observationId);}
        metrics.at(-1).observedSurfaces=association.length;
        metrics.at(-1).observedFrontages=new Set(association.map(a=>a.observationId)).size;
        assert.equal(metrics.at(-1).observedFrontages,101,'both Amsta intervals render; two unusable crops remain withheld');
        assert.equal(await page.evaluate(()=>window.daCostaDemo.data().buildings.some(b=>b.surfaces.some(s=>'observation' in s))),false,'runtime observations must not mutate canonical source surfaces');
        await page.evaluate(()=>window.daCostaDemo.view('shops'));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const shops=await page.evaluate(()=>window.daCostaDemo.status());
        metrics.push({device,mode,view:'shops',drawCalls:shops.drawCalls,triangles:shops.triangles});
        await page.screenshot({path:`${root}/render-${device}-neighbourhood-shops.png`,fullPage:true,timeout:90000});
        const sterk=source.records.find(r=>r.address==='De Clercqstraat 7'&&r.proposal?.visibleSignText?.includes('STERK'));
        assert.ok(sterk,'blind extraction includes Sterk');
        await page.goto(base+'/canal-drive/da-costa-block.html?neighbourhood=1&frontage='+sterk.id+'&building='+sterk.buildingId);
        await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.match(await page.locator('#selection-body').textContent(),/STERK/i);
        assert.equal(await page.evaluate(()=>{const panel=document.querySelector('#selection').getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect();return panel.bottom<=stage.bottom&&panel.top>=stage.top;}),true,'inspector stays inside the stage');
        assert.equal(await page.locator('#view-label').textContent(),sterk.address);
        await page.screenshot({path:`${root}/render-${device}-neighbourhood-sterk.png`,fullPage:true,timeout:90000});
        for(const [field,pattern] of [['roofGptProposal',/GPT alternative hypothesis:/],['roofOracleConflict',/Roof interpretations disagree across views/]]){
          const candidate=source.records.find(r=>r[field]);
          if(candidate){await page.evaluate(id=>window.daCostaDemo.select(id),candidate.renderBuildingId);assert.match(await page.locator('#selection-body').textContent(),pattern);}
        }
      }
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(root+'/render-metrics.json',JSON.stringify({at:new Date().toISOString(),metrics,errors},null,2)+'\n');
  console.log(JSON.stringify(metrics,null,2));
  console.log('Passed: desktop/mobile layout, original/Eland compatibility, authored landmarks, per-wall assignment, rejected/uncertain evidence and bounded roof palette.');
}finally{await browser.close();}
