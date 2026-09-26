/** Browsable streamed demo regression: no human decisions or inference calls. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.NEIGHBOURHOOD_BASE_URL||'http://127.0.0.1:5195';
const before=await (await fetch(base+'/api/neighbourhood/export')).text();
await fs.mkdir('.cache/city-appearance/viewer-check',{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],metrics=[];
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const live=new Set();window.appearanceLiveBuffers=()=>live.size;
      for(const ctor of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
        if(!ctor)continue;const p=ctor.prototype,create=p.createBuffer,remove=p.deleteBuffer;
        p.createBuffer=function(...args){const buffer=create.apply(this,args);if(buffer)live.add(buffer);return buffer;};
        p.deleteBuffer=function(buffer){live.delete(buffer);return remove.call(this,buffer);};
      }
    });
    await page.goto(base+'/canal-drive/city-appearance.html');await page.waitForFunction(()=>window.cityAppearanceDemo?.status().ready,{},{timeout:60000});
    await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    let s=await page.evaluate(()=>window.cityAppearanceDemo.status());assert.equal(s.buildings,171);assert.equal(s.observations,103);assert.ok(s.stream.resident<=12);assert.equal(s.stream.failed.length,0);assert.ok(s.drawCalls>0&&s.drawCalls<250);
    assert.deepEqual(s.displayExtent.clippedFrontageIds,[],'display bounds contain every evidenced frontage');
    assert.deepEqual(await page.evaluate(()=>window.cityAppearanceDemo.context().bounds),[-130,-147,130,131],'source bounds are not rewritten');
    await page.screenshot({path:`.cache/city-appearance/viewer-check/overview-${width}.png`,fullPage:true});
    await page.locator('[data-view="shops"]').click();await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    await page.screenshot({path:`.cache/city-appearance/viewer-check/shops-${width}.png`,fullPage:true});
    const amsta='0363100012237064_e_1hyy18v';await page.evaluate(id=>window.cityAppearanceDemo.frontage(id),amsta);await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    assert.equal(await page.locator('#inspector').isVisible(),true);assert.match(await page.locator('#review-link').getAttribute('href'),new RegExp(amsta));
    const rows=await page.evaluate(()=>window.cityAppearanceDemo.records()),row=rows.find(r=>r.id===amsta);
    if(row.review?.notes)assert.ok((await page.locator('#inspector-warning').textContent()).includes(row.review.notes),'human notes appear verbatim');
    await page.locator('#next-frontage').click();assert.notEqual(await page.evaluate(()=>window.cityAppearanceDemo.status().selectedId),amsta);
    const selected=await page.evaluate(()=>window.cityAppearanceDemo.status().selectedId),release=s.releaseId;
    await page.locator('#appearance').uncheck();await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing);assert.equal(await page.evaluate(()=>window.cityAppearanceDemo.status().selectedId),selected,'style toggle preserves selected frontage');
    await page.locator('#appearance').check();await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing);
    // Exercise the real local publication endpoint; it rebuilds derived data, not answers.
    await page.locator('#refresh').click();await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing,{},{timeout:60000});
    assert.equal(await page.locator('#release-status').evaluate(el=>el.classList.contains('error')),false,'saved-review refresh succeeds');
    assert.equal(await page.evaluate(()=>window.cityAppearanceDemo.status().selectedId),selected);
    await page.evaluate(()=>window.cityAppearanceDemo.view('shops'));await page.waitForTimeout(250);await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    await page.waitForTimeout(100);const memory=await page.evaluate(()=>({...window.cityAppearanceDemo.status(),liveBuffers:window.appearanceLiveBuffers()}));
    for(let cycle=0;cycle<8;cycle++){
      await page.evaluate(()=>window.cityAppearanceDemo.view('overview'));await page.waitForTimeout(150);
      await page.evaluate(()=>window.cityAppearanceDemo.refresh(false));
      await page.evaluate(()=>window.cityAppearanceDemo.view('shops'));await page.waitForTimeout(150);await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    }
    await page.waitForTimeout(100);const after=await page.evaluate(()=>({...window.cityAppearanceDemo.status(),liveBuffers:window.appearanceLiveBuffers()}));
    assert.ok(after.gpuGeometries<=memory.gpuGeometries+2,`geometry resources remain bounded: ${memory.gpuGeometries} → ${after.gpuGeometries}`);
    assert.ok(after.gpuTextures<=memory.gpuTextures,'release refresh does not leak textures');
    assert.ok(after.liveBuffers<=memory.liveBuffers+6,`actual GL buffers remain bounded (including tree instances): ${memory.liveBuffers} → ${after.liveBuffers}`);
    assert.equal(after.stream.failed.length,0);assert.ok(after.stream.resident<=12);
    // Hold a real tile fetch so a second style change lands after the first flags were captured.
    let unblock;const gate=new Promise(resolve=>{unblock=resolve;});let tileRequested;const requested=new Promise(resolve=>{tileRequested=resolve;});
    await page.route('**/data/city-appearance/releases/**/tiles/**',async route=>{tileRequested();await gate;await route.continue();});
    await page.locator('#appearance').uncheck();await requested;
    await page.locator('#patterns').uncheck();unblock();
    await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing,{},{timeout:60000});await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
    assert.equal(await page.evaluate(()=>window.cityAppearanceDemo.status().facadeWindows),0,'queued style changes match final controls');
    await page.unroute('**/data/city-appearance/releases/**/tiles/**');
    await page.locator('#patterns').check();await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing);
    await page.locator('#appearance').check();await page.waitForFunction(()=>!window.cityAppearanceDemo.status().refreshing);
    await page.route('**/data/city-appearance/current.json',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.evaluate(()=>window.cityAppearanceDemo.refresh(false));assert.equal(await page.evaluate(()=>window.cityAppearanceDemo.status().releaseId),release,'failed new release retains previous scene');assert.match(await page.locator('#release-status').textContent(),/previous scene is retained/);
    await page.unroute('**/data/city-appearance/current.json');
    s=await page.evaluate(()=>window.cityAppearanceDemo.status());metrics.push({width,...s,buffersBefore:memory.liveBuffers,buffersAfter:after.liveBuffers});await page.close();
  }
  assert.deepEqual(errors,[]);assert.equal(await (await fetch(base+'/api/neighbourhood/export')).text(),before,'browser checks never change human decisions');
  await fs.writeFile('.cache/city-appearance/viewer-check/metrics.json',JSON.stringify({metrics,errors},null,2));console.log(JSON.stringify({passed:true,metrics,errors,humanWrites:0},null,2));
}finally{await browser.close();}
