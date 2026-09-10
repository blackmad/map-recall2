/** Real browser regression; source data and human decisions are read-only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {overlapsOpening} from '../src/canalRecall/facadeOpeningLayout.ts';
const base=process.env.NEIGHBOURHOOD_BASE_URL||'http://127.0.0.1:5195';
const history=await(await fetch(base+'/api/neighbourhood/export')).text();
const browser=await chromium.launch({headless:true}),errors=[],metrics=[];
await fs.mkdir('.cache/da-costa-neighbourhood/opening-regression',{recursive:true});
try{
  for(const [mode,query] of [['original',''],['neighbourhood','?neighbourhood=1'],['eland','?study=elandsgracht']]){
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/canal-drive/da-costa-block.html'+query);await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
    const layouts=await page.evaluate(()=>window.daCostaDemo.openingLayouts());assert.ok(layouts.length>10);
    const doors=layouts.flatMap(l=>l.openings).filter(o=>o.isDoor);assert.ok(doors.length>10,mode+' has visible door assemblies');
    for(const l of layouts){if(l.belt)assert.equal(overlapsOpening(l.belt,l.openings),false);for(const o of l.openings.filter(o=>o.isDoor))assert.ok(o.rect.y-o.rect.height/2>=l.base-1e-7);}
    if(mode!=='eland')await page.evaluate(()=>window.daCostaDemo.view('shops'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:'.cache/da-costa-neighbourhood/opening-regression/'+mode+'.png',fullPage:true});
    metrics.push({mode,facades:layouts.length,doors:doors.length,belts:layouts.filter(l=>l.belt).length});await page.close();
  }
  assert.deepEqual(errors,[]);assert.equal(await(await fetch(base+'/api/neighbourhood/export')).text(),history);
  console.log(JSON.stringify({passed:true,metrics,humanWrites:0}));
}finally{await browser.close();}
