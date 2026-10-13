// node museums2-review.mjs <id> [gameBearing=0] [zoom=18.6] [pitch=55]
// Gallery angles (4) plus an in-game shot of the installed model, into artifacts/landmark-lanes/<id>/.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const id=process.argv[2],bearing=Number(process.argv[3]??0),zoom=Number(process.argv[4]??18.6),pitch=Number(process.argv[5]??55);
const spec=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`));
const BASE=process.env.LANDMARK_REVIEW_BASE??'http://127.0.0.1:4396';const OUT=`artifacts/landmark-lanes/${id}`;fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}});
 await page.goto(BASE+'/canal-drive/manual-landmarks.html?only='+id);await page.waitForFunction(()=>window.review?.done,null,{timeout:120000});
 console.log('gallery errors',JSON.stringify(await page.evaluate(()=>review.errors)));
 await page.evaluate(i=>{main.style.display='block';for(const e of entries){e.view.closest('article').style.display=e.spec.id===i?'block':'none';if(e.spec.id===i){e.view.style.width='800px';e.view.style.height='600px';e.view.closest('article').style.width='802px';}}},id);
 const art=page.locator('article').filter({has:page.getByRole('heading',{name:spec.name,exact:true})});
 const phi=Number(process.env.PHI??1.25);
 const views=(process.env.VIEWS??'front=3.5,threeq=2.7').split(',').map(v=>v.split('='));
 for(const [name,angle] of views){await page.evaluate(({i,angle,phi})=>{const e=entries.find(e=>e.spec.id===i);e.theta=angle;e.phi=phi;frame(e)},{i:id,angle:Number(angle),phi});await art.screenshot({path:`${OUT}/gallery-${name}.png`})}
 if(process.env.NOGAME){console.log('skip game');}else{
 await page.goto(BASE+'/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
 await page.waitForFunction(l=>canalRecallGame.routePois.some(p=>p.id===l),'lm-'+spec.landmarkId);
 await page.locator('#poi-destination').selectOption('lm-'+spec.landmarkId);
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 await page.evaluate(({s,bearing,zoom,pitch})=>{const g=canalRecallGame,v=g.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom,pitch,bearing});v._completeCity.setSuspended(false);v._completeCity.followCamera();},{s:spec,bearing,zoom,pitch});
 await page.waitForFunction(i=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(i),id,{timeout:180000});await page.waitForTimeout(8500);
 await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:180000});
 await page.evaluate(()=>canalRecallGame.vectorMap.setActiveLandmark(null));await page.waitForTimeout(300);
 await page.screenshot({path:`${OUT}/game-${bearing}.png`});
 const hidden=await page.evaluate(s=>{const b=canalRecallGame.vectorMap._threeBuildings;return s.suppressOsmIds.map(i=>({id:i,hidden:b.hidden.has(i)}))},spec);console.log('suppressed',JSON.stringify(hidden));}
 console.log('page errors',JSON.stringify(errors));
}finally{await browser.close()}
