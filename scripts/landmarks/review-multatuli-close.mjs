/** Native installed-scene close camera evidence; no scale/depth/suppression changes. */
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=JSON.parse(fs.readFileSync('scripts/landmarks/multatuli-spec.json','utf8'));
const out='artifacts/multatuli-review';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto('http://127.0.0.1:5196/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
 await page.waitForFunction(id=>canalRecallGame.routePois.some(p=>p.id==='lm-'+id),s.landmarkId,{timeout:120000});await page.locator('#poi-destination').selectOption('lm-'+s.landmarkId);await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>canalRecallGame._finishLandmark()?.id),s.landmarkId);
 await page.evaluate(s=>{const g=canalRecallGame,v=g.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom:20.7,pitch:72,bearing:33.295});v._completeCity.setSuspended(false);v._completeCity.followCamera();v.setActiveLandmark(null);g._landmarkNotice=null;g._landmarkNoticeAlpha=0;},s);
 await page.waitForFunction(()=>canalRecallGame.vectorMap._signatureLandmarks.shown.has('multatuli'),null,{timeout:180000});
 await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});
 const views=[{id:'conventional-overhead',targetLocal:[0,-4.8],zoom:19.7,pitch:0,bearing:33.295}];
 const proofs=[];
 for(const view of views){await page.evaluate(view=>{const v=canalRecallGame.vectorMap;const anchor=v._signatureLandmarks.models.find(x=>x.id==='multatuli').surveyed.anchor;const h=33.29545565140216*Math.PI/180,mx=111320*Math.cos(anchor[1]*Math.PI/180);const geo=p=>[anchor[0]+(p[0]*Math.cos(h)-p[1]*Math.sin(h))/mx,anchor[1]-(p[0]*Math.sin(h)+p[1]*Math.cos(h))/111320];const options={center:geo(view.targetLocal),zoom:view.zoom,pitch:view.pitch,bearing:view.bearing,elevation:0};v.map.jumpTo(options);v.map.triggerRepaint();},view);await page.waitForTimeout(3500);await page.waitForFunction(()=>{const e=canalRecallGame.vectorMap._signatureLandmarks._entries.find(e=>e.spec.id==='multatuli');return !!e?.pickProjection;});await page.screenshot({path:`${out}/${view.id}.png`});
  proofs.push(await page.evaluate(({s,view})=>{const v=canalRecallGame.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks;return{view,actualCamera:{center:v.map.getCenter().toArray(),zoom:v.map.getZoom(),pitch:v.map.getPitch(),bearing:v.map.getBearing()},placement:l.describe().find(x=>x.id==='multatuli').placement,depthBias:l.depthBiasEnabled,suppressed:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id)})),neighbors:['NL.IMBAG.Pand.0363100012167929','NL.IMBAG.Pand.0363100012167938','NL.IMBAG.Pand.0363100012179680'].map(id=>({id,resident:b.lastFeatures.some(f=>f.properties.id===id),hidden:b.hidden.has(id),drawable:[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id))})),buildingStats:b.stats()};},{s,view}));
 }
 assert.deepEqual(errors,[]);for(const p of proofs){assert.equal(p.placement.scale,1);assert.equal(p.depthBias,false);assert.ok(p.suppressed.every(x=>x.hidden));assert.ok(p.neighbors.every(x=>x.resident&&x.drawable&&!x.hidden));}
 fs.writeFileSync(`${out}/conventional-overhead-proof.json`,JSON.stringify({modelUnmodified:true,proofs,errors},null,2)+'\n');console.log(JSON.stringify({screenshots:views.map(v=>`${out}/${v.id}.png`),scale:1,errors}));
}finally{await browser.close();}
