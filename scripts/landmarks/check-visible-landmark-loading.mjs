import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.glb'))requests.push(r.url());});
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');
 await page.waitForFunction(()=>window.parkReview?.loaded);
 await page.addScriptTag({url:'http://127.0.0.1:5196/canal-drive/js/signature-placement.bundle.js'});
 await page.addScriptTag({url:'http://127.0.0.1:5196/canal-drive/js/signature-landmarks.bundle.js'});
 await page.evaluate(()=>{
  parkReview.trees.setEnabled(false);
  parkReview.map.jumpTo({center:[4.89975,52.37856],zoom:19,pitch:0});
  window.landmarkLoadingReview={shown:[],maxPending:0};
  landmarkLoadingReview.layer=new CanalRecallSignature3D.SignatureLandmarks(parkReview.map,maplibregl,{models:CanalRecallSignatureLandmarks.MANUAL_LANDMARKS,loadVisibleOnly:true,manageBasemapFilter:false,onModelShown:s=>landmarkLoadingReview.shown.push(s.id)});
  landmarkLoadingReview.timer=setInterval(()=>{landmarkLoadingReview.maxPending=Math.max(landmarkLoadingReview.maxPending,landmarkLoadingReview.layer._pending.size);},5);
 });
 await page.waitForFunction(()=>landmarkLoadingReview.shown.includes('centraal-station')&&landmarkLoadingReview.layer._pending.size===0);
 const first=await page.evaluate(()=>({loaded:landmarkLoadingReview.shown.slice(),total:CanalRecallSignatureLandmarks.MANUAL_LANDMARKS.length,pending:landmarkLoadingReview.maxPending}));
 assert.ok(first.loaded.length<first.total);assert.ok(first.pending<=2);assert.equal(new Set(requests).size,requests.length);
 await page.evaluate(()=>{
  landmarkLoadingReview.layer.setEnabled(false);
  parkReview.map.jumpTo({center:[4.8815,52.3584],zoom:19,pitch:0});
 });
 const paused=requests.length;await page.waitForTimeout(250);assert.equal(requests.length,paused,'disabled landmarks do not start requests');
 await page.evaluate(()=>landmarkLoadingReview.layer.setEnabled(true));
 await page.waitForFunction(()=>landmarkLoadingReview.shown.includes('van-gogh-museum')&&landmarkLoadingReview.layer._pending.size===0);
 assert.equal(new Set(requests).size,requests.length);
 const final=await page.evaluate(()=>({loaded:landmarkLoadingReview.shown.slice(),pending:landmarkLoadingReview.maxPending}));assert.ok(final.pending<=2);
 await page.evaluate(()=>{clearInterval(landmarkLoadingReview.timer);parkReview.map.removeLayer('signature-landmarks');});
 assert.equal(await page.evaluate(()=>landmarkLoadingReview.layer.describe().length),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({initial:first,afterMove:final,uniqueRequests:requests.length,errors},null,2));
} finally {await browser.close();}
