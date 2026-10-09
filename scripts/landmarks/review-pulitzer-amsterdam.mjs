/** Coordinator-only GPU evidence acquisition. This script does not certify
 * route destination, geographic label or physical card clicking. Those are
 * required acceptance checks in the handoff, independent of these views. */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const origin=process.env.LANDMARK_REVIEW_ORIGIN||'http://127.0.0.1:5196';
const output=process.env.LANDMARK_REVIEW_OUTPUT||'artifacts/pulitzer-amsterdam-review';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 const gallery=await browser.newPage({viewport:{width:1700,height:1000}});
 gallery.on('pageerror',e=>errors.push(String(e)));
 await gallery.goto(origin+'/canal-drive/manual-landmarks.html?only=pulitzer-amsterdam');
 await gallery.waitForFunction(()=>window.review?.done,undefined,{timeout:60000});
 await gallery.screenshot({path:output+'/gallery-default.png',fullPage:true});
 const galleryResult=await gallery.evaluate(()=>window.review);
 await gallery.close();
 const page=await browser.newPage({viewport:{width:1450,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame);
 await page.locator('#travel-mode').selectOption('car',{force:true});
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.player&&Number.isFinite(window.canalRecallGame.player.x),undefined,{timeout:90000});
 await page.evaluate(()=>{const g=window.canalRecallGame;g.state=4;g.vectorMap.sync=()=>{};g.vectorMap.map.stop();});
 await page.waitForFunction(()=>window.canalRecallGame.vectorMap._completeCityHasBuildings,undefined,{timeout:60000});
 const results=[];
 for(const [name,bearing,zoom,pitch]of [['prinsengracht',90,18.2,58],['keizersgracht',270,18.2,58],['reestraat',0,18.3,60],['courtyard-context',15,17.7,55]]){
  await page.evaluate(([bearing,zoom,pitch])=>window.canalRecallGame.vectorMap.map.jumpTo({center:[4.8839,52.3727],bearing,zoom,pitch}),[bearing,zoom,pitch]);
  await page.waitForTimeout(name==='prinsengracht'?8000:3500);
  await page.screenshot({path:`${output}/${name}.png`});
  results.push(await page.evaluate(name=>{
   const vm=window.canalRecallGame.vectorMap,t=vm._threeBuildings,entry=vm._signatureLandmarks._entries.find(e=>e.spec.id==='pulitzer-amsterdam');
   const ids=['0363100012174140','0363100012169365','0363100012173672','0363100012173673','0363100012173677','0363100012173676','0363100012173675','0363100012173679','0363100012173678','0363100012173680','0363100012173681','0363100012173682'];
   return {name,entry:entry?{loaded:!!entry.group?.children?.length,scale:entry.placement.scale,exact:entry.spec.suppressOsmIds.every(id=>t.hidden.has(id)),broad:entry.spec.spatialSuppression}:null,neighbors:ids.map(p=>{const id='NL.IMBAG.Pand.'+p;return {id,hidden:t.hidden.has(id),resident:[...t.chunks.values()].some(c=>c.ranges.has(id)&&c.mesh)};}),stats:t.stats()};
  },name));
 }
 const report={modelId:'pulitzer-amsterdam',gallery:galleryResult,views:results,errors,requiredRemaining:['Root photo/render comparison and independent failure-seeking review','Four lower gallery rotations and close lower-tier / entrance comparison','Actual chosen hotel destination and finish, map pin and physical POI-card click','Compressed-export winding/support check and gameplay frame timings, desktop/touch pan']};
 fs.writeFileSync(output+'/acquired-evidence.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(errors.length)throw Error(errors.join('\n'));
 if(results.some(r=>!r.entry?.loaded||r.entry.scale!==1||!r.entry.exact||r.entry.broad))throw Error('Current native model / exact suppression evidence failed');
 if(results.some(r=>r.neighbors.some(n=>n.resident&&n.hidden)))throw Error('Retained neighbor hidden');
}finally{await browser.close();}
