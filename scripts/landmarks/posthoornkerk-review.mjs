import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const specs=[JSON.parse(fs.readFileSync('scripts/landmarks/posthoornkerk-spec.json'))];
const output='artifacts/posthoornkerk-review';fs.mkdirSync(output,{recursive:true});const base=process.env.LANDMARK_REVIEW_BASE_URL??'http://127.0.0.1:5196';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}});
 await page.goto(base+'/canal-drive/manual-landmarks.html?only='+specs.map(s=>s.id).join(','));await page.waitForFunction(()=>window.review?.done,null,{timeout:120000});assert.deepEqual(await page.evaluate(()=>review.errors),[]);
 for(const s of specs){
  const article=page.locator('article').filter({has:page.getByRole('heading',{name:s.name,exact:true})});await article.screenshot({path:output+'/'+s.id+'-gallery-default.png'});
  for(let rotation=0;rotation<4;rotation++){await page.evaluate(({id,rotation})=>{const entry=entries.find(e=>e.spec.id===id);entry.theta=-44.025662664*Math.PI/180+rotation*Math.PI/2;entry.phi=1.40;frame(entry);},{id:s.id,rotation});await article.screenshot({path:output+'/'+s.id+'-gallery-low-'+rotation+'.png'});}
 }
 await page.goto(base+'/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
 await page.waitForFunction(()=>canalRecallGame.routePois.some(p=>p.id==='lm-extract_landmarks_213091641'));
 await page.locator('#poi-destination').selectOption('lm-'+specs[0].landmarkId);
 console.log('BEFORE START',JSON.stringify(await page.evaluate(()=>({selected:canalRecallGame._overlay.store.getState().destinationId,selectedDom:document.getElementById('poi-destination').value,mode:canalRecallGame.travelMode,prefs:canalRecallGame._prefs()}))));
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 await page.waitForFunction(specs=>specs.every(s=>canalRecallGame.landmarks.some(l=>l.id===s.landmarkId&&l.sourceUrl)),specs,{timeout:180000});
 console.log('REQUESTED FINISH',specs[0].landmarkId);
 assert.equal(await page.evaluate(()=>canalRecallGame._finishLandmark()?.id),specs[0].landmarkId,'selected Posthoornkerk must remain actual finish');
 console.log('AFTER START',JSON.stringify(await page.evaluate(()=>({finish:canalRecallGame._finishLandmark()?.id,routeTo:canalRecallGame.routeTo,selected:canalRecallGame._overlay.store.getState().destinationId,mode:canalRecallGame.travelMode,routeError:canalRecallGame._overlay.store.getState().routeError}))));
 for(const s of specs){
  await page.evaluate(s=>{const g=canalRecallGame,v=g.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom:17.8,pitch:55,bearing:44.02566});v._completeCity.setSuspended(false);v._completeCity.followCamera();},s);
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(id),s.id,{timeout:180000});await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:180000});
  const proof=await page.evaluate(async s=>{
   const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks,T=CanalRecallThree.THREE;
   const neighbors=[['NL.IMBAG.Pand.0363100012180345','w266625892'],['NL.IMBAG.Pand.0363100012168486','w266625951'],['NL.IMBAG.Pand.0363100012253921'],['NL.IMBAG.Pand.0363100012179738','w266626053']];
   const lm=g.landmarks.find(lm=>lm.id===s.landmarkId),e=l._entries.find(e=>e.spec.id===s.id),c=v.map.getCanvas(),rect=g.canvas.getBoundingClientRect();let click=null;e.group.updateWorldMatrix(true,true);
   e.group.traverse(o=>{if(click||!o.isMesh)return;const p=o.geometry.getAttribute('position');for(let i=0;i<Math.min(p.count,96);i+=3){const q=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(e.pickProjection),x=(q.x+1)/2*c.clientWidth,y=(1-q.y)/2*c.clientHeight;if(x<100||y<120||x>c.clientWidth-100||y>c.clientHeight-160)continue;const hit=v.inspectBuilding(x,y,{width:c.clientWidth,height:c.clientHeight});if(hit?.landmarkId===s.landmarkId){click={x:rect.left+x/c.clientWidth*rect.width,y:rect.top+y/c.clientHeight*rect.height,id:hit.landmarkId};break}}});
   const portalHits=new T.Raycaster(new T.Vector3(-1.77,80,32.5).applyAxisAngle(new T.Vector3(0,1,0),-44.025662664*Math.PI/180),new T.Vector3(0,-1,0)).intersectObject(e.group,true).length;
   return{id:s.id,portalHits,oldPyramidIds:(v._pyramidalRoofs?._entries??[]).filter(p=>p.mesh.visible&&s.suppressOsmIds.includes(String(p.id))).map(p=>p.id),scale:l.describe().find(m=>m.id===s.id).placement.scale,bias:l.depthBiasEnabled,highlight:l.highlights({id:s.landmarkId}),broad:l.shownFootprints().includes(l.models.find(m=>m.id===s.id).footprint),pin:(await v.map.getSource('amsterdam-pois').getData()).features.some(f=>f.properties.id===s.landmarkId),destination:g.routePois.some(p=>p.id==='lm-'+s.landmarkId),source:lm?.sourceUrl,click,aliases:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id)})),neighbors:neighbors.map(ids=>({ids,resident:ids.some(id=>b.lastFeatures.some(f=>String(f.properties.id)===id)),hidden:ids.some(id=>b.hidden.has(id)),drawable:ids.some(id=>[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id)))})),features:b.lastFeatures.length,buildings:b.stats().buildings};
  },s);
  fs.writeFileSync(output+'/native-proof.json',JSON.stringify(proof,null,2));console.log('NATIVE POSTHOORNKERK PROOF',JSON.stringify(proof));assert.equal(proof.scale,1);assert.equal(proof.bias,false);assert.equal(proof.highlight,true);assert.equal(proof.broad,false);assert(proof.pin&&proof.destination&&proof.source);assert(proof.click);assert(proof.aliases.every(a=>a.hidden));assert.deepEqual(proof.oldPyramidIds,[],'loaded native asset also masks separate pyramidal caps');assert.equal(proof.portalHits,0,'native church forecourt remains open overhead');for(const n of proof.neighbors){assert(n.resident&&n.drawable);assert.equal(n.hidden,false)}
  await page.mouse.click(proof.click.x,proof.click.y);await page.waitForTimeout(200);const card=await page.evaluate(()=>({notice:canalRecallGame._landmarkNotice?.id,source:canalRecallGame._landmarkNotice?.sourceUrl,alpha:canalRecallGame._landmarkNoticeAlpha,drawn:!!canalRecallGame._landmarkCardBounds,active:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId}));assert.equal(card.notice,s.landmarkId);assert.equal(card.active,s.landmarkId);assert(card.alpha>=.9&&card.drawn&&card.source);console.log('PHYSICAL CARD',JSON.stringify(card));
  await page.screenshot({path:output+'/'+s.id+'-live-front.png'});await page.evaluate(()=>canalRecallGame.vectorMap.setActiveLandmark(null));await page.waitForTimeout(200);await page.screenshot({path:output+'/'+s.id+'-neutral-front.png'});
  await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({bearing:224.02566});v._completeCity.followCamera()});await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:180000});await page.screenshot({path:output+'/'+s.id+'-live-rear.png'});
 }
 assert.deepEqual(errors,[]);console.log('POSTHOORNKERK PASSED',errors);
}finally{await browser.close();console.log('CHROMIUM CLOSED')}
