import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?._inventoryTrees?.ready,{timeout:60000});
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.player?.x,{timeout:60000});
 await page.evaluate(()=>canalRecallGame.vectorMap.setTreesVisible(true));
 await page.waitForFunction(()=>canalRecallGame.vectorMap._inventoryTrees.debugTrees>10,{timeout:60000});
 console.log(await page.evaluate(()=>{const v=canalRecallGame.vectorMap;return{player:canalRecallGame.player.x,trees:v._inventoryTrees.debugTrees,draws:v._inventoryTrees.debugDraws,oldTrees:v.map.getLayoutProperty('tree-crowns','visibility'),parkFeatures:v._parkLandscape.debugFeatures};}));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap.map.getLayoutProperty('tree-crowns','visibility')),'none');
 await page.evaluate(()=>canalRecallGame.vectorMap.setTreesVisible(false));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.enabled),false);
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.meshes.length),0);
 await page.evaluate(()=>canalRecallGame.vectorMap.setExtractRoot('../data/extracts/utrecht'));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._inventoryTrees.ready),false);
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._parkLandscape.debugFeatures),0);
 assert.deepEqual(errors,[]);console.log('Game route, municipal tree toggle, duplicate suppression and city-change clearing passed.');
}finally{await browser.close();}
