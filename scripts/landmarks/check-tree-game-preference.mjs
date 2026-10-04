import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs';
const browser=await chromium.launch({headless:true}),reports=[];fs.mkdirSync('artifacts/tree-models',{recursive:true});
try{
 for(const {name,width,height,savedOff}of [{name:'fresh-north',width:1400,height:900},{name:'saved-off',width:1400,height:900,savedOff:true},{name:'fresh-mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(savedOff)await context.addInitScript(()=>localStorage.setItem('canalRecall.preferences.v1',JSON.stringify({trees:false,viewMode:'north'})));
  await page.goto('http://127.0.0.1:5196/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?._inventoryTrees?.ready,{timeout:60000});
  assert.equal(await page.evaluate(()=>canalRecallGame._prefs().trees),!savedOff);assert.equal(await page.evaluate(()=>canalRecallGame.viewMode),'north');
  await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,{timeout:60000});await page.waitForTimeout(2000);
  if(savedOff)assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.meshes.length),0);else await page.waitForFunction(()=>canalRecallGame.vectorMap._inventoryTrees.debugTrees>10,{timeout:60000});
  await page.evaluate(()=>canalRecallGame._overlay.store.setSettingsOpen(true));await page.waitForSelector('#live-trees');const toggle=page.locator('label').filter({has:page.locator('#live-trees')});assert.equal(await toggle.isVisible(),true);assert.match((await toggle.innerText()).trim(),/^Trees$/i);assert.equal(await page.locator('#live-trees').isChecked(),!savedOff);
  for(const mode of ['north','heading','chase','cockpit']){
   await page.locator('[data-choice="live-view:'+mode+'"]').click();await page.waitForFunction(mode=>canalRecallGame.viewMode===mode,mode);
   if(await page.locator('#live-trees').isChecked())await toggle.click();assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.enabled),false);assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.meshes.length),0);
   await toggle.click();await page.waitForFunction(()=>canalRecallGame.vectorMap._inventoryTrees.enabled&&canalRecallGame.vectorMap._inventoryTrees.debugTrees>0,{timeout:60000});
   const stats=await page.evaluate(()=>{const g=canalRecallGame,t=g.vectorMap._inventoryTrees;return{mode:g.viewMode,prefs:g._prefs().trees,trees:t.debugTrees,draws:t.meshes.length,geometry:t.geometries.size,materials:t.materials.size,zoom:g.vectorMap.map.getZoom(),pitch:g.vectorMap.map.getPitch()};});assert.ok(stats.draws<=7);assert.ok(stats.geometry<=4);assert.equal(stats.materials,2);assert.equal(stats.prefs,true);reports.push({name,...stats});
  }
  if(name==='fresh-mobile')await page.screenshot({path:'artifacts/tree-models/game-mobile-tree-settings.png'});
  await page.evaluate(()=>canalRecallGame._overlay.store.setSettingsOpen(false));await page.screenshot({path:`artifacts/tree-models/game-${name}-trees.png`});
  await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.sync=()=>{};v.map.jumpTo({zoom:14});v._inventoryTrees.update();});assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.meshes.length),0,'existing low-zoom cutoff retained');
  await page.evaluate(()=>canalRecallGame.vectorMap.setExtractRoot('../data/extracts/utrecht'));assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.ready),false);assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.meshes.length),0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({reports,errors:[]}));
}finally{await browser.close();}
