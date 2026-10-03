import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'@playwright/test';
const species=["Tilia europaea 'Zwarte Linde'","Ulmus 'Rebona'","Ulmus minor 'Sarniensis'",'Prunus avium',"Acer pseudoplatanus 'Negenia'",'Tilia tomentosa','Corylus colurna',"Acer campestre 'Elsrijk'"];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tree-models.html',route=>{const html=fs.readFileSync('public/canal-drive/tree-models.html','utf8').replace(/const examples=\[[\s\S]*?\n\];/,`const examples=${JSON.stringify(species.map(s=>[s,s,'Boom']))};`);return route.fulfill({contentType:'text/html',body:html});});
 await page.goto('http://127.0.0.1:5196/canal-drive/tree-models.html');await page.waitForFunction(()=>window.treeReview?.done);
 const models=await page.evaluate(()=>treeReview.entries.map(e=>({species:e.species,form:e.proxy.archetype,height:e.proxy.height,reference:e.proxy.provenance.reference,draws:e.trees.meshes.length,geometry:e.proxy.crownGeometry})));
 assert.equal(models.length,8);assert.ok(models.every(m=>m.height===15&&m.reference?.startsWith('https://')&&m.draws<=7));assert.equal(new Set(models.map(m=>m.form)).size,3);assert.deepEqual(errors,[]);
 fs.mkdirSync('artifacts/tree-models',{recursive:true});await page.screenshot({path:'artifacts/tree-models/common-species.png',fullPage:true});
 await page.locator('#angle').evaluate(e=>{e.value='90';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:'artifacts/tree-models/common-species-side.png',fullPage:true});
 console.log(JSON.stringify(models,null,2));
}finally{await browser.close();}
