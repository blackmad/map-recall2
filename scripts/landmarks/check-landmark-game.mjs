/** Real game: delayed replacement, linked POIs, exact suppression and view toggles. */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
let release;
const delayed=new Promise(resolve=>{release=resolve;});
try {
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.includes('/models/')&&r.url().endsWith('.glb'))requests.push(r.url());});
 await page.route('**/models/embassy-free-mind.glb',async route=>{await delayed;await route.continue();});
 await page.goto('http://127.0.0.1:5196/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?._signatureLandmarks,{timeout:60000});
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._signatureLandmarks.loadVisibleOnly),true);
 await page.locator('#route-card').evaluate(form=>form.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.player?.x&&canalRecallGame.state===4,{timeout:60000});
 await page.evaluate(()=>{
  const v=canalRecallGame.vectorMap;
  // Hold the review camera independently of the rider, while keeping the game running.
  v.sync=()=>{};
  v.map.jumpTo({center:[4.88745646,52.37638238],zoom:19,pitch:45,bearing:30});
 });
 await page.waitForFunction(()=>canalRecallGame.vectorMap._signatureLandmarks._pending.has('embassy-free-mind'),{timeout:60000});
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._signatureSuppressOsmIds().includes('w266604553')),false,'generic building remains while its GLB is delayed');
 release();
 await page.waitForFunction(()=>canalRecallGame.vectorMap._signatureLandmarks.shown.has('embassy-free-mind')&&canalRecallGame.vectorMap._completeCityHasBuildings,{timeout:60000});
 const result=await page.evaluate(()=>{
  const v=canalRecallGame.vectorMap,s=v._signatureLandmarks,e=s.describe().find(m=>m.id==='embassy-free-mind');
  return {loaded:s.describe().length,total:s.models.length,placement:e.placement,
   depthBiasEnabled:s.depthBiasEnabled,basemapVisibility:v.map.getLayoutProperty('building-3d','visibility'),
   museumHighlight:s.highlights({id:'extract_landmarks_740511540'}),
   houseHighlight:s.highlights({id:'extract_landmarks_554373448'}),
   exactSuppression:v._signatureSuppressOsmIds().includes('w266604553'),
   broadSuppression:s.shownFootprints().includes(s.models.find(m=>m.id==='embassy-free-mind').footprint)};
 });
 assert.ok(result.museumHighlight&&result.houseHighlight&&result.exactSuppression);
 assert.equal(result.depthBiasEnabled,false);
 assert.equal(result.basemapVisibility,'none');
 assert.equal(result.broadSuppression,false,'neighboring canal houses retain their own geometry');
 await page.evaluate(()=>canalRecallGame.vectorMap.setMeasuredColoursOnly(true));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._signatureLandmarks.shownSuppressOsmIds().length),0);
 await page.evaluate(()=>canalRecallGame.vectorMap.setMeasuredColoursOnly(false));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._signatureLandmarks.shownSuppressOsmIds().includes('w266604553')),true);
 assert.equal(new Set(requests).size,requests.length,'one GLB request per visited model');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/manual-landmarks/embassy-live.png'});
 console.log(JSON.stringify({result,uniqueRequests:requests.length,errors},null,2));
} finally {release();await browser.close();}
