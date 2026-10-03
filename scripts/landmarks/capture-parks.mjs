import {chromium} from '@playwright/test';
import fs from 'node:fs';
fs.mkdirSync('artifacts/parks',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');
await page.waitForFunction(()=>window.parkReview?.trees?.debugTrees>200,{timeout:120000});
for(const [id,name] of [['0','vondelpark'],['1','oosterpark'],['2','sarphatipark']]){
  await page.selectOption('#park',id);
  await page.waitForFunction(()=>window.parkReview.trees.pending.size===0&&window.parkReview.trees.debugTrees>30,{timeout:60000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:`artifacts/parks/${name}.png`});
  console.log(name,await page.evaluate(()=>({trees:parkReview.trees.debugTrees,tiles:parkReview.trees.debugTiles,meshes:parkReview.trees.meshes.length,errors:parkReview.errors})));
}
if(errors.length)throw Error(errors.join('\n'));
await browser.close();
