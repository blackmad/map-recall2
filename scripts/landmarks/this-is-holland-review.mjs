/** Prepared for root serial GPU ownership; worker has NOT run this acceptance harness. */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const specs=[JSON.parse(fs.readFileSync('scripts/landmarks/this-is-holland-spec.json'))];
const out='artifacts/this-is-holland-review';fs.mkdirSync(out,{recursive:true});const origin=process.env.LANDMARK_REVIEW_ORIGIN??'http://127.0.0.1:5196';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}});
 await page.goto(origin+'/canal-drive/manual-landmarks.html?only='+specs.map(s=>s.id).join(','));await page.waitForFunction(()=>window.review?.done,null,{timeout:120000});assert.deepEqual(await page.evaluate(()=>review.errors),[]);
 for(const s of specs)await page.locator('article').filter({has:page.getByRole('heading',{name:s.name,exact:true})}).screenshot({path:out+'/' +s.id+'-gallery.png'});
 // Four lower gallery rotations are captured for root source comparison.
 const canvas=page.locator('article canvas'),r=await canvas.boundingBox();assert(r);
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height/2+12,{steps:5});await page.mouse.up();
 for(let i=0;i<4;i++){await page.locator('article').screenshot({path:out+'/this-is-holland-gallery-low-'+i+'.png'});await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-157,r.y+r.height/2,{steps:12});await page.mouse.up();await page.waitForTimeout(150);}
 await page.goto(origin+'/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
 await page.waitForFunction(()=>canalRecallGame.routePois.some(p=>p.id==='lm-extract_landmarks_1851417932'));
 await page.locator('#poi-destination').selectOption('lm-'+specs[0].landmarkId);
 console.log('BEFORE START',JSON.stringify(await page.evaluate(()=>({selected:canalRecallGame._overlay.store.getState().destinationId,selectedDom:document.getElementById('poi-destination').value,mode:canalRecallGame.travelMode,prefs:canalRecallGame._prefs()}))));
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 await page.waitForFunction(specs=>specs.every(s=>canalRecallGame.landmarks.some(l=>l.id===s.landmarkId&&l.sourceUrl)),specs,{timeout:180000});
 console.log('REQUESTED FINISH',specs[0].landmarkId);
 assert.equal(await page.evaluate(()=>canalRecallGame._finishLandmark()?.id),specs[0].landmarkId,'selected This is Holland must remain actual finish');
 console.log('AFTER START',JSON.stringify(await page.evaluate(()=>({finish:canalRecallGame._finishLandmark()?.id,routeTo:canalRecallGame.routeTo,selected:canalRecallGame._overlay.store.getState().destinationId,mode:canalRecallGame.travelMode,routeError:canalRecallGame._overlay.store.getState().routeError}))));
 for(const s of specs){
  await page.evaluate(s=>{const g=canalRecallGame,v=g.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom:18.2,pitch:55,bearing:-45});v._completeCity.setSuspended(false);v._completeCity.followCamera();},s);
  await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(id),s.id,{timeout:180000});await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:180000});
  const proof=await page.evaluate(async s=>{
   const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks,T=CanalRecallThree.THREE;
   const neighbors=[['NL.IMBAG.Pand.0363100012237838'],['w593068474'],['w44824383']];
   const lm=g.landmarks.find(lm=>lm.id===s.landmarkId),e=l._entries.find(e=>e.spec.id===s.id),c=v.map.getCanvas(),rect=g.canvas.getBoundingClientRect();let click=null;e.group.updateWorldMatrix(true,true);
   e.group.traverse(o=>{if(click||!o.isMesh)return;const p=o.geometry.getAttribute('position');for(let i=0;i<Math.min(p.count,96);i+=3){const q=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(e.pickProjection),x=(q.x+1)/2*c.clientWidth,y=(1-q.y)/2*c.clientHeight;if(x<100||y<120||x>c.clientWidth-100||y>c.clientHeight-160)continue;const hit=v.inspectBuilding(x,y,{width:c.clientWidth,height:c.clientHeight});if(hit?.landmarkId===s.landmarkId){click={x:rect.left+x/c.clientWidth*rect.width,y:rect.top+y/c.clientHeight*rect.height,id:hit.landmarkId};break}}});
   
   return{id:s.id,oldPyramidIds:(v._pyramidalRoofs?._entries??[]).filter(p=>p.mesh.visible&&s.suppressOsmIds.includes(String(p.id))).map(p=>p.id),scale:l.describe().find(m=>m.id===s.id).placement.scale,bias:l.depthBiasEnabled,highlight:l.highlights({id:s.landmarkId}),broad:l.shownFootprints().includes(l.models.find(m=>m.id===s.id).footprint),pin:(await v.map.getSource('amsterdam-pois').getData()).features.some(f=>f.properties.id===s.landmarkId),destination:g.routePois.some(p=>p.id==='lm-'+s.landmarkId),source:lm?.sourceUrl,click,aliases:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id)})),neighbors:neighbors.map(ids=>{const replacement=ids.includes('NL.IMBAG.Pand.0363100012237838')?l._entries.find(e=>e.spec.id==='eye-filmmuseum'):null;let visibleMeshes=0;if(replacement?.group?.visible)replacement.group.traverse(o=>{if(o.isMesh&&o.visible)visibleMeshes++});return{ids,resident:ids.some(id=>b.lastFeatures.some(f=>String(f.properties.id)===id)),hidden:ids.some(id=>b.hidden.has(id)),drawable:ids.some(id=>[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id))),signatureReplacement:replacement?.spec.id??null,signatureDrawable:!!replacement&&l.shown.has('eye-filmmuseum')&&visibleMeshes>0}}),features:b.lastFeatures.length,buildings:b.stats().buildings};
  },s);
  fs.writeFileSync(out+'/native-proof.json',JSON.stringify(proof,null,2));console.log('NATIVE THIS IS HOLLAND PROOF',JSON.stringify(proof));assert.equal(proof.scale,1);assert.equal(proof.bias,false);assert.equal(proof.highlight,true);assert.equal(proof.broad,false);assert(proof.pin&&proof.destination&&proof.source);assert(proof.click);assert(proof.aliases.every(a=>a.hidden));assert.deepEqual(proof.oldPyramidIds,[],'loaded native asset also masks separate pyramidal caps');for(const n of proof.neighbors){assert(n.signatureDrawable||(n.resident&&n.drawable&&!n.hidden),'Retained neighbor must be drawn through original geometry or its existing EYE signature replacement')}
  await page.mouse.click(proof.click.x,proof.click.y);await page.waitForTimeout(200);const card=await page.evaluate(()=>({notice:canalRecallGame._landmarkNotice?.id,source:canalRecallGame._landmarkNotice?.sourceUrl,alpha:canalRecallGame._landmarkNoticeAlpha,drawn:!!canalRecallGame._landmarkCardBounds,active:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId}));assert.equal(card.notice,s.landmarkId);assert.equal(card.active,s.landmarkId);assert(card.alpha>=.9&&card.drawn&&card.source);console.log('PHYSICAL CARD',JSON.stringify(card));
  await page.screenshot({path:out+'/' +s.id+'-live-front.png'});await page.evaluate(()=>canalRecallGame.vectorMap.setActiveLandmark(null));await page.waitForTimeout(200);await page.screenshot({path:out+'/' +s.id+'-neutral-front.png'});
  await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({bearing:135});v._completeCity.followCamera()});await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:180000});await page.screenshot({path:out+'/' +s.id+'-live-rear.png'});
 }
 assert.deepEqual(errors,[]);console.log('THIS IS HOLLAND PASSED',errors);
}finally{await browser.close();console.log('CHROMIUM CLOSED')}
