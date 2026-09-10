/** Compact serial A/B capture; coordinate with other GPU browser checks before running. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root='.cache/da-costa-neighbourhood',base='http://127.0.0.1:5195';
const data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const sterk=data.records.find(r=>r.address==='De Clercqstraat 7'&&r.proposal?.visibleSignText?.includes('STERK'));
const browser=await chromium.launch({headless:true}),metrics=[],errors=[];
try{
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    for(const [view,query] of [['canal','&view=canal'],['sterk','&frontage='+sterk.id]])for(const mode of ['legacy','inventory']){
      await page.goto(base+'/canal-drive/da-costa-block.html?neighbourhood=1'+query+(mode==='legacy'?'&trees=legacy':''));
      await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const value=await page.evaluate(()=>{const s=window.daCostaDemo.status(),trees=window.daCostaDemo.data().trees;return{drawCalls:s.drawCalls,triangles:s.triangles,camera:s.camera,trees:trees.length,proxies:trees.filter(t=>t.renderedTree).length,positionsPreserved:trees.filter(t=>t.renderedTree).every(t=>JSON.stringify(t.position)===JSON.stringify(t.renderedTree.position)&&t.height===t.renderedTree.height)};});
      assert.equal(value.positionsPreserved,true);assert.equal(value.trees,94);
      if(mode==='inventory'){assert.ok(value.proxies>0);assert.match(await page.locator('#tree-provenance').textContent(),/not measured crowns/);}
      else assert.equal(value.proxies,0);
      metrics.push({device,view,mode,...value});
      await page.locator('.stage').screenshot({path:`${root}/trees-${device}-${view}-${mode}.png`,timeout:90000});
      console.log('Captured '+device+'/'+view+'/'+mode+' ('+value.drawCalls+' calls, '+value.triangles+' triangles).');
    }
    await page.close();
  }
  for(let i=0;i<metrics.length;i+=2){assert.deepEqual(metrics[i].camera,metrics[i+1].camera);assert.equal(metrics[i].drawCalls,metrics[i+1].drawCalls,'tree typology must not add draw calls in matched views');}
  assert.deepEqual(errors,[]);
  await fs.writeFile(root+'/tree-render-metrics.json',JSON.stringify({at:new Date().toISOString(),metrics,errors},null,2)+'\n');
  console.log('Passed: compact desktop/mobile tree A/B, inventory preservation, unchanged draw calls, provenance and no browser errors.');
}finally{await browser.close();}
