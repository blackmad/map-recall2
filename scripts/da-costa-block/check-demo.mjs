import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.DA_COSTA_DEMO_URL || 'http://127.0.0.1:5192';
const eland = process.argv.includes('--elandsgracht');
const output = eland ? '.cache/elandsgracht/captures' : '.cache/da-costa-block/captures';
await mkdir(output,{recursive:true});
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,...(existsSync(chrome)?{executablePath:chrome}:{})});
const report={errors:[],failedRequests:[],views:[]};
try{
  const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1});
  page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);});
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),reason:r.failure()?.errorText}));
  await page.goto(`${base}/canal-drive/da-costa-block.html${eland?'?study=elandsgracht':''}`);
  await page.waitForFunction(()=>window.daCostaDemo?.status().ready,{},{timeout:45000});
  const capture=async name=>{await page.screenshot({path:`${output}/${name}.png`});const s=await page.evaluate(()=>window.daCostaDemo.status());report.views.push({name,...s});console.log(`${name}: ${s.drawCalls} draw calls, ${s.triangles} triangles`);};
  await capture('overview');
  await page.locator('#compare').click();
  assert.equal(await page.evaluate(()=>window.daCostaDemo.status().facades),false);
  assert.equal(await page.locator('#street').isChecked(),false);
  await capture('plain');
  await page.locator('#compare').click();
  assert.equal(await page.evaluate(()=>window.daCostaDemo.status().facades),true);
  for(const layer of ['street','anchors','facades']){
    await page.locator(`#${layer}`).uncheck();
    assert.equal(await page.evaluate(k=>window.daCostaDemo.status()[k],layer),false);
    await page.locator(`#${layer}`).check();
  }
  for(const view of eland?['engels','awnings','west','east','coffee','antiek']:['shops','canal','nassau','north','amsta']){
    await page.evaluate(v=>window.daCostaDemo.view(v),view);
    await page.waitForTimeout(100);await capture(view);
  }
  await page.evaluate(id=>window.daCostaDemo.select(window.daCostaDemo.data().anchors.find(a=>a.id===id).buildingId),eland?'engels':'amsta');
  assert.match(await page.locator('#selection-body').innerText(),eland?/Engels Verf/:/Amsta/);
  await page.locator('#anchor-photo').click();
  assert.equal(await page.locator('#photo-dialog').isVisible(),true);
  assert.match(await page.locator('#photo-title').innerText(),eland?/Engels/:/Amsta/);
  await page.locator('#photo-dialog .dialog-close').click();
  await capture('landmark-inspector');
  await page.locator('#selection-close').click();
  await page.locator('#sources-open').click();
  assert.equal(await page.locator('#sources-dialog').isVisible(),true);
  await page.locator('#sources-dialog .dialog-close').click();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.daCostaDemo.view('overview'));
  await page.waitForTimeout(100);await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow');
  const data=await page.evaluate(()=>window.daCostaDemo.data());
  assert.equal(new Set(data.buildings.map(b=>b.id)).size,data.buildings.length,'Unique building IDs');
  assert(data.buildings.filter(b=>b.focus&&b.surfaces.length).length>=(eland?85:45),'3DBAG coverage of target block');
  assert.equal(data.trees.some(t=>t.type==='Stobbe'),false,'No stump canopies');
  assert(data.anchors.every(a=>data.buildings.some(b=>b.id===a.buildingId)),'Anchor BAG joins');
  const faces=await page.evaluate(()=>window.daCostaDemo.status().anchorFaces);
  if(eland){
    const engels=data.anchors.find(a=>a.id==='engels');
    assert.deepEqual(engels.frontages.map(f=>f.number),[93,95,97]);
    assert.equal(new Set(engels.frontages.map(f=>f.buildingId)).size,2,'Three Engels addresses join two BAG buildings');
    assert.equal(faces.filter(f=>f.id==='engels').length,3,'All three fascia sections render');
    assert.equal(data.anchors.filter(a=>a.awning).length,5,'Five observed canopy frontages');
    assert(faces.every(f=>f.normal[1]*(data.anchors.find(a=>a.id===f.id).number%2?-1:1)>.8),'Storefronts face the right street side');
    for(const a of data.anchors){
      assert(data.references.some(r=>r.name===a.view),'Each cue links a dated reference');
      assert(a.frontages.every(f=>data.buildings.some(b=>b.id===f.buildingId)),'Every frontage joins a building');
    }
    // Two segments in one building must not overlap: regression for range joins.
    const shared=faces.filter(f=>f.id==='engels'&&f.buildingId===engels.frontages[0].buildingId);
    assert(Math.hypot(shared[0].mid[0]-shared[1].mid[0],shared[0].mid[1]-shared[1].mid[1]) >= (shared[0].width+shared[1].width)/2-.05,'Adjacent fascia intervals do not overlap');
  }else{
    assert(faces.find(a=>a.id==='fuoco').normal[1]>.8,'Fuoco Vivo faces south toward De Clercqstraat');
    assert(faces.find(a=>a.id==='sterk').normal[1]<-.8,'Sterk faces north from the opposite side');
    assert(faces.find(a=>a.id==='groot').normal.every(n=>n>.5),'Groot sign uses the southeast chamfer');
    const amsta=data.buildings.find(b=>b.id===data.anchors.find(a=>a.id==='amsta').buildingId);
    assert.equal(amsta.family,'institutional-bands');assert.equal(amsta.appearance.brick,false);
    assert.equal(amsta.focus,false,'De Poort stays neighbouring context');
    assert(data.buildings.filter(b=>b.focus&&!b.surfaces.length).every(b=>b.height<=3),'Conservative courtyard heights');
  }
  assert(report.views.find(v=>v.name==='overview').drawCalls<200,'Miniature renderer draw-call budget');
  assert.equal(report.errors.length,0,'No browser exceptions');
  assert.equal(report.failedRequests.filter(r=>r.url.startsWith(base)).length,0,'No failed local asset requests');
  report.result='passed';
}catch(e){report.result='failed';report.failure=String(e);process.exitCode=1;console.error(e);}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(`Report and screenshots: ${output}`);
