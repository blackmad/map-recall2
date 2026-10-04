import{chromium}from'@playwright/test';import assert from'node:assert/strict';import fs from'node:fs';
const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5196/canal-drive/tree-models.html?orientation');await page.waitForFunction(()=>window.treeReview?.done);
 const models=await page.evaluate(()=>treeReview.entries.map(e=>({label:e.label,before:e.before,shape:e.proxy.archetype,position:e.proxy.position,lobes:e.proxy.lobes,rotation:e.proxy.rotation,wood:[...e.trees.meshes.find(m=>m.userData.wood).instanceMatrix.array],crowns:e.trees.meshes.filter(m=>!m.userData.wood).map(m=>[...m.instanceMatrix.array]),draws:e.trees.meshes.length})));
 assert.equal(models.length,6);for(let i=0;i<3;i++){const a=models[i*2],b=models[i*2+1];assert.deepEqual(a.lobes,b.lobes);assert.deepEqual(a.wood,b.wood);assert.equal(a.draws,4);assert.equal(b.draws,4);if(i===2)assert.deepEqual(a.crowns,b.crowns,'palms retain orientation');else assert.notDeepEqual(a.crowns,b.crowns);}
 fs.mkdirSync('artifacts/tree-models',{recursive:true});await page.screenshot({path:'artifacts/tree-models/orientation-before-after.png',fullPage:true});assert.deepEqual(errors,[]);console.log(JSON.stringify({pairs:3,draws:4,errors}));
}finally{await browser.close();}
