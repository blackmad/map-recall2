import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/tree-models.html?alder-birch');await page.waitForFunction(()=>window.treeReview?.done);
 const models=await page.evaluate(()=>treeReview.entries.map(e=>({species:e.species,before:e.before,archetype:e.proxy.archetype,height:e.proxy.height,bark:e.proxy.bark,lobes:e.proxy.lobes,draws:e.trees.meshes.length,geometries:e.trees.geometries.size,materials:e.trees.materials.size})));
 assert.equal(models.length,14);const expected=['pyramidal','columnar','columnar','upright-oval','upright-oval','upright-oval','rounded'];
 for(let i=0;i<7;i++){const a=models[i*2],b=models[i*2+1];assert.equal(a.archetype,'rounded');assert.equal(b.archetype,expected[i]);assert.equal(a.height,b.height);assert.equal(a.draws,4);assert.equal(b.draws,4);assert.ok(a.geometries<=4&&b.geometries<=4);assert.equal(a.materials,2);assert.equal(b.materials,2);if(i<6)assert.notDeepEqual(a.lobes,b.lobes);else{assert.deepEqual(a.lobes,b.lobes);assert.equal(a.bark,'#d8d9c5');assert.equal(b.bark,'#805b46');}}
 fs.mkdirSync('artifacts/tree-models',{recursive:true});await page.screenshot({path:'artifacts/tree-models/alder-birch-before-after.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.locator('#angle').fill('100');await page.waitForTimeout(100);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({models:models.map(({lobes,...m})=>m),errors}));
}finally{await browser.close();}
