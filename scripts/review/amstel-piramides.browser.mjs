import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const specs=[...JSON.parse(fs.readFileSync('scripts/landmarks/amstel-towers-specs.json')),JSON.parse(fs.readFileSync('scripts/landmarks/piramides-spec.json'))];
const browser=await chromium.launch({headless:true});
try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5196/canal-drive/manual-landmarks.html?only='+specs.map(s=>s.id).join(','));await page.waitForFunction(()=>window.review?.done,null,{timeout:120000});assert.deepEqual(await page.evaluate(()=>review.errors),[]);
for(const s of specs)await page.locator('article').filter({has:page.getByRole('heading',{name:s.name,exact:true})}).screenshot({path:'/tmp/'+s.id+'-gallery.png'});
await page.goto('http://127.0.0.1:5196/canal-drive/');await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:90000});
await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:90000});
await page.waitForFunction(specs=>specs.every(s=>canalRecallGame.landmarks.some(l=>l.id===s.landmarkId&&l.sourceUrl)),specs,{timeout:90000});
const contract=await page.evaluate(specs=>{const g=canalRecallGame;return specs.map(s=>({id:s.id,landmark:g.landmarks.find(l=>l.id===s.landmarkId),destination:g.routePois.some(p=>p.id==='lm-'+s.landmarkId),option:[...g._routeTo.options].some(o=>o.value==='lm-'+s.landmarkId)}))},specs);
for(const p of contract){assert(p.landmark?.sourceUrl);assert(p.landmark.detail||p.landmark.longDetail);assert(p.destination);assert(p.option)}
for(const s of specs){
 await page.evaluate(s=>{const v=canalRecallGame.vectorMap;v.sync=()=>{};v.map.jumpTo({center:s.surveyed.anchor,zoom:s.id==='de-piramides'?18.0:16.7,pitch:55,bearing:s.id==='de-piramides'?171.5:159.7});v._completeCity.setSuspended(false);v._completeCity.followCamera();},s);
 await page.waitForFunction(id=>canalRecallGame.vectorMap._signatureLandmarks.shown.has(id),s.id,{timeout:90000});await page.waitForTimeout(8500);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:90000});
 const proof=await page.evaluate(async s=>{const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks;const retain=s.id==='de-piramides'?['NL.IMBAG.Pand.0363100012067047','w276273289','w1080810805','w1080810813']:['NL.IMBAG.Pand.0363100012092758','NL.IMBAG.Pand.0363100012085009'];const pin=(await v.map.getSource('amsterdam-pois').getData()).features.some(f=>f.properties.id===s.landmarkId);return{id:s.id,scale:l.describe().find(m=>m.id===s.id).placement.scale,bias:l.depthBiasEnabled,highlight:l.highlights({id:s.landmarkId}),broad:l.shownFootprints().includes(l.models.find(m=>m.id===s.id).footprint),pin,features:b.lastFeatures.length,buildings:b.stats().buildings,aliases:s.suppressOsmIds.map(id=>({id,resident:b.lastFeatures.some(f=>String(f.properties.id)===id),hidden:b.hidden.has(id)})),neighbors:retain.map(id=>({id,resident:b.lastFeatures.some(f=>String(f.properties.id)===id),hidden:b.hidden.has(id),drawable:[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id))}))}},s);
 console.log('PREASSERT',JSON.stringify(proof));
 assert.equal(proof.scale,1);assert.equal(proof.bias,false);assert.equal(proof.highlight,true);assert.equal(proof.broad,false);assert.equal(proof.pin,true);assert(proof.aliases.every(a=>a.hidden));for(const n of proof.neighbors)assert.equal(n.hidden,false);assert(proof.neighbors.some(n=>n.resident&&n.drawable),'actual neighboring mass drawable');if(s.id!=='de-piramides')assert(proof.neighbors.every(n=>n.resident&&n.drawable));
 await page.screenshot({path:'/tmp/'+s.id+'-live-front.png'});
 await page.evaluate(s=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({bearing:(s.id==='de-piramides'?171.5:159.7)+180});v._completeCity.followCamera();},s);await page.waitForTimeout(700);await page.screenshot({path:'/tmp/'+s.id+'-live-rear.png'});console.log('NATIVE PLACEMENT',JSON.stringify(proof));
}
assert.deepEqual(errors,[]);console.log('POI CONTRACT',JSON.stringify(contract.map(p=>({id:p.id,destination:p.destination,option:p.option,source:p.landmark.sourceUrl}))));console.log('ALL FOUR PASSED',errors);
}finally{await browser.close();console.log('CHROMIUM CLOSED')}
