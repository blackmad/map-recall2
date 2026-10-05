/** Shared real-route/native-placement acceptance. Visual screenshots still require human/agent inspection.
 * node scripts/landmarks/review-manual-pois.mjs <plan.json> [...plans]
 * Plan: {specPath, neighbors:[[exactAliases]], zoom?, bearing?, sourceReadyChecks?:string[]}.
 */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const plans=process.argv.slice(2).map(file=>JSON.parse(fs.readFileSync(file,'utf8')));
assert(plans.length,'Supply a review plan');
for(const p of plans){assert(p.specPath);assert(p.neighbors?.length,'Record a real neighboring building');assert(p.neighbors.every(ids=>ids.length));}
const targets=plans.map(p=>({...p,spec:JSON.parse(fs.readFileSync(p.specPath,'utf8'))}));
const base=process.env.LANDMARK_REVIEW_URL||'http://127.0.0.1:5196';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(`${base}/canal-drive/manual-landmarks.html?only=${targets.map(t=>t.spec.id).join(',')}`);
 await page.waitForFunction(()=>window.review?.done,null,{timeout:120000});
 assert.deepEqual(await page.evaluate(()=>review.errors),[]);
 for(const {spec:s} of targets){fs.mkdirSync(`artifacts/${s.id}-review`,{recursive:true});await page.locator('article').filter({has:page.getByRole('heading',{name:s.name,exact:true})}).screenshot({path:`artifacts/${s.id}-review/gallery.png`});}
 // A single accepted angle missed roof fins and misplaced side windows. Keep
 // four lower-angle views plus the original higher gallery view for each asset.
 await page.evaluate(()=>{main.style.display='block';});
 for(const {spec:s} of targets){
  await page.evaluate(id=>{for(const e of entries){e.view.closest('article').style.display=e.spec.id===id?'block':'none';if(e.spec.id===id){e.view.style.width='1000px';e.view.style.height='650px';e.view.closest('article').style.width='1002px';}}},s.id);
  for(let angle=0;angle<4;angle++){
   await page.evaluate(({id,angle})=>{const e=entries.find(e=>e.spec.id===id);e.theta=.55+angle*Math.PI/2;e.phi=1.30;frame(e);},{id:s.id,angle});
   await page.locator('article').filter({has:page.getByRole('heading',{name:s.name,exact:true})}).screenshot({path:`artifacts/${s.id}-review/gallery-angle-${angle}.png`});
  }
 }
 for(const plan of targets){const s=plan.spec,out=`artifacts/${s.id}-review`;
  await page.goto(`${base}/canal-drive/`);
  await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
  await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
  await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
  await page.waitForFunction(id=>canalRecallGame.routePois.some(p=>p.id==='lm-'+id),s.landmarkId);
  await page.locator('#poi-destination').selectOption('lm-'+s.landmarkId);
  await page.locator('#route-card').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
  assert.equal(await page.evaluate(()=>canalRecallGame._finishLandmark()?.id),s.landmarkId,'actual chosen route finish must not change');
  await page.evaluate(({s,plan})=>{const v=canalRecallGame.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom:plan.zoom??18.2,pitch:55,bearing:plan.bearing??s.surveyed.northOffsetDegrees});v._completeCity.setSuspended(false);v._completeCity.followCamera();},{s,plan});
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(id),s.id,{timeout:180000});
  await page.waitForTimeout(8500);
  await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});
  await page.evaluate(({s,plan})=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({center:s.surveyed.anchor,zoom:plan.zoom??18.2,pitch:55,bearing:plan.bearing??s.surveyed.northOffsetDegrees});v.map.triggerRepaint();},{s,plan});
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks._entries.find(e=>e.spec.id===id)?.pickProjection,s.id,{timeout:30000});
  const proof=await page.evaluate(async({s,neighbors})=>{
   const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks,T=CanalRecallThree.THREE;
   const e=l._entries.find(e=>e.spec.id===s.id),lm=g.landmarks.find(lm=>lm.id===s.landmarkId),canvas=v.map.getCanvas(),rect=g.canvas.getBoundingClientRect();let click=null;
   e.group.updateWorldMatrix(true,true);
   e.group.traverse(o=>{if(click||!o.isMesh)return;const p=o.geometry.getAttribute('position'),ix=o.geometry.getIndex(),triangles=Math.floor((ix?.count??p.count)/3);for(let sample=0,total=Math.min(triangles,512);sample<total;sample++){const i=Math.floor(sample*triangles/total)*3;const q=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).add(new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1)).add(new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2)).multiplyScalar(1/3).applyMatrix4(o.matrixWorld).applyMatrix4(e.pickProjection),x=(q.x+1)/2*canvas.clientWidth,y=(1-q.y)/2*canvas.clientHeight;if(x<100||y<120||x>canvas.clientWidth-100||y>canvas.clientHeight-160)continue;const nativeHit=l.inspectAtScreen(x,y,canvas.clientWidth,canvas.clientHeight);if(nativeHit?.landmarkId!==s.landmarkId)continue;const hit=v.inspectBuilding(x,y,{width:canvas.clientWidth,height:canvas.clientHeight});if(hit?.landmarkId===s.landmarkId){click={x:rect.left+x/canvas.clientWidth*rect.width,y:rect.top+y/canvas.clientHeight*rect.height};break;}}});
   return {id:s.id,scale:l.describe().find(m=>m.id===s.id).placement.scale,bias:l.depthBiasEnabled,broad:l.shownFootprints().includes(l.models.find(m=>m.id===s.id).footprint),pin:(await v.map.getSource('amsterdam-pois').getData()).features.some(f=>f.properties.id===s.landmarkId),destination:g.routePois.some(p=>p.id==='lm-'+s.landmarkId),source:lm?.sourceUrl,click,aliases:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id)})),oldPyramidIds:(v._pyramidalRoofs?._entries??[]).filter(p=>p.mesh.visible&&s.suppressOsmIds.includes(String(p.id))).map(p=>p.id),neighbors:neighbors.map(ids=>({ids,resident:ids.some(id=>b.lastFeatures.some(f=>String(f.properties.id)===id)),hidden:ids.some(id=>b.hidden.has(id)),drawable:ids.some(id=>[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id)))})),features:b.lastFeatures.length,buildings:b.stats().buildings};
  },{s,neighbors:plan.neighbors});
  fs.writeFileSync(path.join(out,'placement-proof.json'),JSON.stringify(proof,null,2)+'\n');
  console.log('NATIVE POI PROOF',JSON.stringify(proof));
  assert.equal(proof.scale,1);assert.equal(proof.bias,false);assert.equal(proof.broad,false);assert(proof.pin&&proof.destination&&proof.source&&proof.click);assert(proof.aliases.every(a=>a.hidden));assert.deepEqual(proof.oldPyramidIds,[]);
  for(const n of proof.neighbors){assert(n.resident&&n.drawable,'neighbor must actually be resident/drawable');assert.equal(n.hidden,false);}
  await page.mouse.click(proof.click.x,proof.click.y);await page.waitForTimeout(200);
  const card=await page.evaluate(()=>({notice:canalRecallGame._landmarkNotice?.id,source:canalRecallGame._landmarkNotice?.sourceUrl,alpha:canalRecallGame._landmarkNoticeAlpha,drawn:!!canalRecallGame._landmarkCardBounds,active:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId}));
  assert.equal(card.notice,s.landmarkId);assert.equal(card.active,s.landmarkId);assert(card.alpha>=.9&&card.drawn&&card.source);
  fs.writeFileSync(path.join(out,'physical-card-proof.json'),JSON.stringify(card,null,2)+'\n');
  await page.screenshot({path:path.join(out,'live-front.png')});
  await page.evaluate(()=>canalRecallGame.vectorMap.setActiveLandmark(null));await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'neutral-front.png')});
  await page.evaluate(bearing=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({bearing:(bearing+180)%360});v._completeCity.followCamera();},plan.bearing??s.surveyed.northOffsetDegrees);
  await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});await page.screenshot({path:path.join(out,'live-rear.png')});
  console.log(`PASS ${s.id}: route, native placement, pin, physical sourced card, exact suppression and resident neighbors. Screenshots await visual acceptance.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
