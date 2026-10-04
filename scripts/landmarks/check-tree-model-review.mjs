import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('artifacts/tree-models',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5196/canal-drive/tree-models.html');
await page.waitForFunction(()=>window.treeReview?.done);
const models=await page.evaluate(()=>treeReview.entries.map(e=>({species:e.species,archetype:e.proxy.archetype,draws:e.trees.meshes.length})));
assert.equal(models.length,16);assert.equal(new Set(models.map(m=>m.archetype)).size,16);
await page.screenshot({path:'artifacts/tree-models/gallery.png',fullPage:true});
await page.locator('#angle').evaluate(e=>{e.value='90';e.dispatchEvent(new Event('input',{bubbles:true}));});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/tree-models/gallery-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'gallery fits mobile width');
await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');
await page.waitForFunction(()=>window.parkReview?.trees?.debugTrees>100);
const positions=[['Vondelpark',4.8688,52.3581],['Oosterpark',4.9202,52.3606],['Sarphatipark',4.8957,52.3544],['Flevopark',4.95,52.3615],['Vondelpark return',4.8688,52.3581]];
const report=[];
for(const [name,lng,lat] of positions){
 await page.evaluate(([lng,lat])=>parkReview.map.jumpTo({center:[lng,lat],zoom:18,pitch:76,bearing:20}),[lng,lat]);
 await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>30);
 await page.waitForTimeout(400);
 const stats=await page.evaluate(()=>{
  const t=parkReview.trees,samples=[];
  for(let i=0;i<3;i++){const before=performance.now();t.rebuild();samples.push(performance.now()-before);}
  return {trees:t.debugTrees,tiles:t.tiles.size,pending:t.pending.size,draws:t.meshes.length,geometries:t.geometries.size,materials:t.materials.size,instances:t.meshes.reduce((n,m)=>n+m.count,0),rebuildMs:samples,errors:parkReview.errors};
 });
 assert.ok(stats.tiles<=12);assert.ok(stats.draws<=7);assert.ok(stats.geometries<=4);assert.equal(stats.materials,2);assert.equal(stats.pending,0);assert.deepEqual(stats.errors,[]);
 report.push({name,...stats});
}
await page.screenshot({path:'artifacts/tree-models/mobile-low-camera.png'});
await page.uncheck('#trees');
assert.equal(await page.evaluate(()=>parkReview.trees.meshes.length),0);assert.equal(await page.evaluate(()=>parkReview.trees.tiles.size),0);
await page.check('#trees');await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>30);
assert.deepEqual(errors,[]);
fs.writeFileSync('artifacts/tree-models/mobile-report.json',JSON.stringify({viewport:{width:390,height:844},pitch:76,models,parks:report,errors},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
