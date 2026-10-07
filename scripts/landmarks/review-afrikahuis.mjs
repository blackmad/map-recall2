/** Shared real-route/native-placement acceptance. Visual screenshots still require human/agent inspection.
 * node scripts/landmarks/review-manual-pois.mjs <plan.json> [...plans]
 * Plan: {specPath, neighbors:[[exactAliases]], zoom?, bearing?, clickLocal?:[number,number,number], sourceReadyChecks?:string[]}.
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
const browser=await chromium.launch({headless:true,...(process.env.LANDMARK_REVIEW_CHROME?{executablePath:process.env.LANDMARK_REVIEW_CHROME}:{})});
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
  await page.goto(`${base}/canal-drive/`, {waitUntil: 'domcontentloaded', timeout: 60000});
  await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
  await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
  await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
  await page.waitForFunction(id=>canalRecallGame.routePois.some(p=>p.id==='lm-'+id),s.landmarkId);
  await page.locator('#poi-destination').selectOption('lm-'+s.landmarkId);
  await page.locator('#route-card').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
  assert.equal(await page.evaluate(()=>canalRecallGame._finishLandmark()?.id),s.landmarkId,'actual chosen route finish must not change');
  await page.evaluate(({s,plan})=>{const v=canalRecallGame.vectorMap;v.sync=()=>{};const camera=plan.sourceCamera;if(camera)v.map.setCenterClampedToGround(false);v.map.jumpTo(camera?v.map.calculateCameraOptionsFromTo(camera.from,camera.fromAltitude,camera.to,camera.toAltitude):{center:plan.cameraCenter??s.surveyed.anchor,zoom:plan.zoom??18.2,pitch:plan.pitch??55,bearing:plan.bearing??s.surveyed.northOffsetDegrees,elevation:plan.elevation??0});v._completeCity.setSuspended(false);v._completeCity.followCamera();},{s,plan});
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(id),s.id,{timeout:180000});
  await page.waitForTimeout(8500);
  await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});
  await page.evaluate(({s,plan})=>{const v=canalRecallGame.vectorMap;const camera=plan.sourceCamera;if(camera)v.map.setCenterClampedToGround(false);v.map.jumpTo(camera?v.map.calculateCameraOptionsFromTo(camera.from,camera.fromAltitude,camera.to,camera.toAltitude):{center:plan.cameraCenter??s.surveyed.anchor,zoom:plan.zoom??18.2,pitch:plan.pitch??55,bearing:plan.bearing??s.surveyed.northOffsetDegrees,elevation:plan.elevation??0});v.map.triggerRepaint();},{s,plan});
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks._entries.find(e=>e.spec.id===id)?.pickProjection,s.id,{timeout:30000});
  await page.screenshot({path:path.join(out,'before-pointer-check.png')});
  console.log(`Review ${s.id}: route/residency ready; testing physical selection`);
  const proof=await page.evaluate(async({s,neighbors,clickLocal})=>{
   const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks,T=CanalRecallThree.THREE;
   const e=l._entries.find(e=>e.spec.id===s.id),lm=g.landmarks.find(lm=>lm.id===s.landmarkId),canvas=v.map.getCanvas(),rect=g.canvas.getBoundingClientRect();let click=null;
   e.group.updateWorldMatrix(true,true);
   // Bound expensive whole-scene raycasts. Collect cheap projected samples first,
   // then prefer the source-backed frontage point when the plan supplies one.
   const candidates=[],preferred=clickLocal?new T.Vector3(...clickLocal):null;
   e.group.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.getAttribute('position'),ix=o.geometry.getIndex(),triangles=Math.floor((ix?.count??p.count)/3);for(let sample=0,total=Math.min(triangles,48);sample<total;sample++){const i=Math.floor(sample*triangles/total)*3;const local=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).add(new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1)).add(new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2)).multiplyScalar(1/3),q=local.clone().applyMatrix4(o.matrixWorld).applyMatrix4(e.pickProjection),x=(q.x+1)/2*canvas.clientWidth,y=(1-q.y)/2*canvas.clientHeight;if(x<100||y<120||x>canvas.clientWidth-100||y>canvas.clientHeight-160)continue;candidates.push({x,y,priority:preferred?local.distanceToSquared(preferred):q.x*q.x+q.y*q.y});}});
   candidates.sort((a,b)=>a.priority-b.priority);const tried=new Set();let attempts=0;
   for(const candidate of candidates){const {x,y}=candidate,key=Math.round(x/4)+','+Math.round(y/4);if(tried.has(key))continue;tried.add(key);if(attempts++>=64)break;const nativeHit=l.inspectAtScreen(x,y,canvas.clientWidth,canvas.clientHeight);if(nativeHit?.landmarkId!==s.landmarkId)continue;const hit=v.inspectBuilding(x,y,{width:canvas.clientWidth,height:canvas.clientHeight});if(hit?.landmarkId===s.landmarkId){click={x:rect.left+x/canvas.clientWidth*rect.width,y:rect.top+y/canvas.clientHeight*rect.height};break;}}

   return {id:s.id,actualCamera:{center:v.map.getCenter().toArray(),zoom:v.map.getZoom(),pitch:v.map.getPitch(),bearing:v.map.getBearing(),elevation:v.map.getCenterElevation()},assetVersion:CanalRecallSignatureLandmarks.MODEL_ASSET_VERSIONS[s.id],scale:l.describe().find(m=>m.id===s.id).placement.scale,bias:l.depthBiasEnabled,broad:l.shownFootprints().includes(l.models.find(m=>m.id===s.id).footprint),routeArrival:[g.routeTo.lat,g.routeTo.lng],pinCoordinates:(await v.map.getSource('amsterdam-pois').getData()).features.find(f=>f.properties.id===s.landmarkId)?.geometry.coordinates,pin:(await v.map.getSource('amsterdam-pois').getData()).features.some(f=>f.properties.id===s.landmarkId),destination:g.routePois.some(p=>p.id==='lm-'+s.landmarkId),source:lm?.sourceUrl,click,aliases:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id)})),oldPyramidIds:(v._pyramidalRoofs?._entries??[]).filter(p=>p.mesh.visible&&s.suppressOsmIds.includes(String(p.id))).map(p=>p.id),neighbors:neighbors.map(ids=>({ids,resident:ids.some(id=>b.lastFeatures.some(f=>String(f.properties.id)===id)),hidden:ids.some(id=>b.hidden.has(id)),drawable:ids.some(id=>[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id)))})),features:b.lastFeatures.length,buildings:b.stats().buildings};
  },{s,neighbors:plan.neighbors,clickLocal:plan.clickLocal});
  fs.writeFileSync(path.join(out,'placement-proof.json'),JSON.stringify(proof,null,2)+'\n');
  console.log('NATIVE POI PROOF',JSON.stringify(proof));
  if (proof.neighbors.some(neighbor => !neighbor.resident || !neighbor.drawable)) {
    const residentContext = await page.evaluate(anchor => {
      const b = canalRecallGame.vectorMap._threeBuildings;
      const nearby = [];
      for (const feature of b.lastFeatures) {
        const points = [];
        const collect = value => { if (!Array.isArray(value)) return; if (typeof value[0] === 'number') points.push(value); else value.forEach(collect); };
        collect(feature.geometry?.coordinates);
        if (!points.some(point => Math.abs(point[0] - anchor[0]) < .003 && Math.abs(point[1] - anchor[1]) < .002)) continue;
        const id = String(feature.properties.id);
        nearby.push({ id, properties: feature.properties, geometry: feature.geometry, hidden: b.hidden.has(id), drawable: [...b.chunks.values()].some(chunk => chunk.mesh && chunk.ranges.has(id)) });
      }
      return nearby;
    }, s.surveyed.anchor);
    fs.writeFileSync(path.join(out, 'resident-neighbor-diagnostic.json'), JSON.stringify(residentContext, null, 2) + '\n');
    await page.screenshot({path: path.join(out, 'failed-neighbor-view.png')});
  }
  if(plan.expectedRouteCenter)assert.deepEqual(proof.routeArrival,plan.expectedRouteCenter,'actual route arrival follows sourced public access');
  if(plan.expectedPin)assert.deepEqual(proof.pinCoordinates,plan.expectedPin,'map pin stays at actual artwork/building');
  assert.equal(proof.scale,1);assert.equal(proof.bias,false);assert.equal(proof.broad,false);assert(proof.pin&&proof.destination&&proof.source&&proof.click);assert(proof.aliases.every(a=>a.hidden));assert.deepEqual(proof.oldPyramidIds,[]);
  for(const n of proof.neighbors){assert(n.resident&&n.drawable,'neighbor must actually be resident/drawable');assert.equal(n.hidden,false);}
  await page.mouse.click(proof.click.x,proof.click.y);await page.waitForTimeout(200);
  const card=await page.evaluate(()=>({notice:canalRecallGame._landmarkNotice?.id,source:canalRecallGame._landmarkNotice?.sourceUrl,alpha:canalRecallGame._landmarkNoticeAlpha,drawn:!!canalRecallGame._landmarkCardBounds,active:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId}));
  assert.equal(card.notice,s.landmarkId);assert.equal(card.active,s.landmarkId);assert(card.alpha>=.9&&card.drawn&&card.source);
  fs.writeFileSync(path.join(out,'physical-card-proof.json'),JSON.stringify(card,null,2)+'\n');
  await page.screenshot({path:path.join(out,'live-front.png')});
  await page.evaluate(()=>canalRecallGame.vectorMap.setActiveLandmark(null));await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'neutral-front.png')});
  await page.evaluate(({plan,s})=>{const v=canalRecallGame.vectorMap;v.map.setCenterClampedToGround(true);v.map.jumpTo({center:plan.oppositeCameraCenter??plan.cameraCenter??s.surveyed.anchor,zoom:plan.oppositeZoom??plan.zoom??18.2,pitch:plan.oppositePitch??plan.pitch??55,bearing:plan.oppositeBearing??((plan.bearing??s.surveyed.northOffsetDegrees)+180)%360,elevation:plan.oppositeElevation??plan.elevation??0});v._completeCity.followCamera();},{plan,s});
  await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});await page.screenshot({path:path.join(out,'live-rear.png')});

  const extension={version:proof.assetVersion,views:[],performance:[],fallback:[],note:'Actual native game scene; source-facing cameras use metre coordinates. Paused overlay hidden for readability; ordinary geometry untouched.'};
  await page.evaluate(()=>{const g=canalRecallGame;g.state=6;g.player.vx=g.player.vy=g.player.speed=0;g._renderPaused=()=>{};g._landmarkNoticeAlpha=0;const m=g.vectorMap.map;m.setMaxPitch(89);m.setMaxZoom(26);m.setCenterClampedToGround(false);});
  for(const view of [
   {name:'corner-source',from:[-22,7,-20],to:[4,4,7]},
   {name:'street-source',from:[14,5,-24],to:[15,4,3]},
   {name:'opposite-source',from:[40,9,43],to:[18,4,6]},
   {name:'undercroft-low',from:[-15,2.2,-8],to:[-2,2,6]},
   {name:'presbytery-entry-low',from:[24,2.5,-23],to:[32.8,2.8,-7.9]}
  ]){
   const info=await page.evaluate(({view,anchor})=>{const g=canalRecallGame,v=g.vectorMap,m=v.map,lon=111320*Math.cos(anchor[1]*Math.PI/180),coord=p=>[anchor[0]+p[0]/lon,anchor[1]-p[2]/110540],options=m.calculateCameraOptionsFromTo(coord(view.from),view.from[1],coord(view.to),view.to[1]);m.jumpTo(options);v._completeCity.followCamera();return{...view,requested:options};},{view,anchor:s.surveyed.anchor});
   await page.waitForTimeout(2600);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return !b.pending.length&&!b.inflight.size;},null,{timeout:180000});
   info.actual=await page.evaluate(()=>{const g=canalRecallGame,m=g.vectorMap.map;return{center:m.getCenter().toArray(),zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing(),eye:{lngLat:m.transform.getCameraLngLat().toArray(),altitude:m.transform.getCameraAltitude()},rider:[g.player.x,g.player.y]};});
   await page.screenshot({path:path.join(out,view.name+'.png')});extension.views.push(info);
  }
  await page.evaluate(anchor=>{const v=canalRecallGame.vectorMap;v.map.setMaxPitch(60);v.map.setCenterClampedToGround(true);v.map.jumpTo({center:anchor,zoom:18.4,pitch:55,bearing:150});v._completeCity.followCamera();},s.surveyed.anchor);await page.waitForTimeout(2500);
  for(const enabled of [true,false,true]){
   const state=await page.evaluate(({id,enabled,aliases})=>{const v=canalRecallGame.vectorMap,l=v._signatureLandmarks;l.setEnabled(enabled);v._refreshBuildingSuppression();v._pyramidalRoofs?.setHidden(v._signatureSuppressOsmIds());return{enabled,shown:l.shown.has(id),suppression:v._signatureSuppressOsmIds().filter(x=>aliases.includes(x)),hidden:aliases.map(x=>({id:x,hidden:v._threeBuildings.hidden.has(x)})),pyramids:(v._pyramidalRoofs?._entries??[]).filter(x=>aliases.includes(String(x.id))).map(x=>({id:x.id,visible:x.mesh.visible}))};},{id:s.id,enabled,aliases:s.suppressOsmIds});
   assert(state.hidden.every(x=>x.hidden===enabled));extension.fallback.push(state);
   const perf=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last;function frame(t){if(last)frames.push(t-last);last=t;canalRecallGame.vectorMap.map.triggerRepaint();if(frames.length<90)requestAnimationFrame(frame);else{frames.sort((a,b)=>a-b);resolve({medianMs:frames[45],p95Ms:frames[85],frames:frames.length,stats:canalRecallGame.vectorMap._threeBuildings.stats()});}}requestAnimationFrame(frame);}));extension.performance.push({enabled,...perf});await page.screenshot({path:path.join(out,enabled?'restored-native.png':'fallback-native.png')});
  }
  fs.writeFileSync(path.join(out,'extended-game-proof.json'),JSON.stringify(extension,null,2)+'\n');
  console.log(`PASS ${s.id}: route, native placement, pin, physical sourced card, exact suppression and resident neighbors. Screenshots await visual acceptance.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
