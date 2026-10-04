import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/tree-models.html?elm-ash');await page.waitForFunction(()=>window.treeReview?.done);
 const models=await page.evaluate(()=>treeReview.entries.map(e=>({species:e.species,before:e.before,archetype:e.proxy.archetype,height:e.proxy.height,bark:e.proxy.bark,lobes:e.proxy.lobes,draws:e.trees.meshes.length,geometries:e.trees.geometries.size,materials:e.trees.materials.size})));
 assert.equal(models.length,10);const expected=['pyramidal','upright-oval','airy-oval','pyramidal','airy-oval'];
 for(let i=0;i<5;i++){const a=models[i*2],b=models[i*2+1];assert.equal(a.archetype,'rounded');assert.equal(b.archetype,expected[i]);assert.equal(a.height,b.height);assert.equal(a.bark,b.bark);assert.equal(a.draws,4);assert.equal(b.draws,4);assert.ok(a.geometries<=4&&b.geometries<=4);assert.equal(a.materials,2);assert.equal(b.materials,2);assert.notDeepEqual(a.lobes,b.lobes);}
 fs.mkdirSync('artifacts/tree-models',{recursive:true});await page.screenshot({path:'artifacts/tree-models/elm-ash-before-after.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.locator('#angle').fill('100');await page.waitForTimeout(100);
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');
 await page.waitForFunction(()=>window.parkReview?.trees?.debugTrees>100);
 const parks=[];
 for(const [name,lng,lat]of [['Vondelpark',4.8688,52.3581],['Sarphatipark',4.8957,52.3544],['Vondelpark return',4.8688,52.3581]]){
  await page.evaluate(([lng,lat])=>parkReview.map.jumpTo({center:[lng,lat],zoom:18,pitch:76,bearing:20}),[lng,lat]);
  await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>30);
  const stats=await page.evaluate(()=>{const t=parkReview.trees;return{trees:t.debugTrees,tiles:t.tiles.size,draws:t.meshes.length,geometries:t.geometries.size,materials:t.materials.size,errors:parkReview.errors};});
  assert.ok(stats.tiles<=12&&stats.draws<=7&&stats.geometries<=4);assert.equal(stats.materials,2);assert.deepEqual(stats.errors,[]);parks.push({name,...stats});
 }
 await page.uncheck('#trees');assert.equal(await page.evaluate(()=>parkReview.trees.meshes.length),0);assert.equal(await page.evaluate(()=>parkReview.trees.tiles.size),0);
 await page.check('#trees');await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>30);
 await page.screenshot({path:'artifacts/tree-models/elm-ash-mobile-park.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({parks,models:models.map(({lobes,...m})=>m),errors}));
}finally{await browser.close();}
