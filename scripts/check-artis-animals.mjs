import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {chromium} from '@playwright/test';

const root='public/canal-drive/models/artis-animals', index=JSON.parse(await fs.readFile(`${root}/index.json`));
const animalCount=index.animals.length;
assert.equal(animalCount,39);assert.equal(new Set(index.animals.map(a=>a.osmId)).size,33);
assert.equal(index.animals.filter(a=>a.original).length,28);
assert(index.unmatched.every(a=>a.reason==='Deliberately omitted small-animal detail'));
assert(!index.animals.some(a=>['Meerkat','Asian small-clawed otter','Patagonian mara','Indian crested porcupine'].includes(a.name)));
assert.equal(new Set(index.animals.map(a=>a.id)).size,index.animals.length);
assert(index.animals.some(a=>a.name==='Nile lechwe'));assert(!index.animals.some(a=>a.name==='Nyala'));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
let bytes=0,triangles=0;
for(const file of new Set(index.animals.map(a=>a.file))) {
 const spec=index.animals.find(a=>a.file===file),data=await fs.readFile(`${root}/${file}`);bytes+=data.length;
 assert.equal(crypto.createHash('sha256').update(data).digest('hex').slice(0,12),spec.version);
 const doc=await io.readBinary(data);assert(doc.getRoot().listScenes().length);
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()) {
  const position=p.getAttribute('POSITION');assert(position.getCount()>0);
  assert(Array.from(position.getArray()).every(Number.isFinite));
  triangles+=(p.getIndices()?.getCount()||position.getCount())/3;
 }
}
assert(bytes<1_300_000,'compressed zoo should stay small');
for(const a of index.animals){assert.match(a.osmId,/^n\d+$/);assert(a.anchor[0]>4.910&&a.anchor[0]<4.920&&a.anchor[1]>52.362&&a.anchor[1]<52.369);assert(Math.hypot(...a.offsetMetres)<3.02);}
const evidence='artifacts/artis-animals';await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),report={animals:animalCount,mappedLocations:33,bytes,triangles,runtime:[]};
const origin=process.env.CANAL_REVIEW_URL||'http://127.0.0.1:5196';
try {
 for(const touch of (process.env.ARTIS_REVIEW_TOUCH_ONLY?[true]:[false,true])) {
  const page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1400,height:1000},hasTouch:touch,isMobile:touch}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/models/artis-animals/'))requests.push(r.url());});
  let failed=false;
  if(!touch)await page.route('**/original-anteater.glb?*',async route=>{if(!failed){failed=true;await route.fulfill({status:503,body:'Temporary model failure'});}else await route.continue();});
  await page.goto(origin+'/canal-drive/');
  await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length>1&&canalRecallGame.vectorMap.ready,null,{timeout:60000});
  assert.equal(requests.length,0,'no animal bytes during startup away from zoo');
  await page.locator('#route-card').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera?.introOverview===0,null,{timeout:60000});
  console.log(`Reviewing ${touch?'touch':'desktop'} game scene`);
  await page.evaluate(()=>{canalRecallGame.vectorMap.sync=()=>{};canalRecallGame.vectorMap._cameraClearanceRequest=null;canalRecallGame.vectorMap.map.jumpTo({center:[4.915,52.366],zoom:16,pitch:0,bearing:0});});
  if(touch)for(const center of [[4.914,52.366],[4.918,52.366],[4.919,52.365]]) {
   await page.evaluate(center=>canalRecallGame.vectorMap.map.jumpTo({center,zoom:16,pitch:0}),center);
   await page.waitForFunction(()=>{const a=canalRecallGame.vectorMap._artisAnimals;return a.index&&!a.indexPending&&a.pending.size===0;},null,{timeout:30000});
  }
  await page.waitForFunction(count=>{const a=canalRecallGame.vectorMap._artisAnimals;return a.index&&a.pending.size===0&&a.entries.length>=count-1;},animalCount,{timeout:60000});
  if(!touch){assert(failed);assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._artisAnimals.failures.size),1);await page.evaluate(()=>{const a=canalRecallGame.vectorMap._artisAnimals;a.failures.clear();a.update();});}
  await page.waitForFunction(count=>canalRecallGame.vectorMap._artisAnimals.entries.length===count,animalCount,{timeout:30000});
  const heights=await page.evaluate(()=>{const a=canalRecallGame.vectorMap._artisAnimals,T=CanalRecallThree.THREE;return a.entries.map(e=>({name:e.spec.name,height:new T.Box3().setFromObject(e.group).getSize(new T.Vector3()).y,expected:e.spec.heightMetres}));});
  for(const h of heights)assert(Math.abs(h.height-h.expected)<.01,`${h.name} normalized to adult size`);
  const stations=touch?[
   ['touch-savannah',[4.918055,52.36642],20.5,25],['touch-lemurs',[4.9156665,52.3670347],21,160],['touch-penguin',[4.9182319,52.3647412],21,220]
  ]:[
   ['savannah',[4.918055,52.36642],20,25],['south-america',[4.91467,52.36598],21,80],['jaguar',[4.91547,52.365757],21,100],['lemurs',[4.9156665,52.3670347],21,160]
  ];
  for(const [name,center,zoom,bearing] of stations){
   await page.evaluate(({center,zoom,bearing})=>canalRecallGame.vectorMap.map.jumpTo({center,zoom,pitch:55,bearing}),{center,zoom,bearing});
   await page.waitForTimeout(1200);
   const state=await page.evaluate(async()=>{
    const a=canalRecallGame.vectorMap._artisAnimals,times=[];await new Promise(resolve=>{let last;function step(t){if(last)times.push(t-last);last=t;if(times.length<60)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});times.sort((x,y)=>x-y);
    return {visible:a.entries.filter(e=>e.group.visible).map(e=>e.spec.name),draws:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,frameIntervalMedianMs:times[30],failures:[...a.failures.keys()],center:canalRecallGame.vectorMap.map.getCenter(),zoom:canalRecallGame.vectorMap.map.getZoom()};
   });
   await page.screenshot({path:`${evidence}/${name}.png`});report.runtime.push({name,touch,...state});
   await fs.writeFile(`${evidence}/report.json`,JSON.stringify(report,null,2)+'\n');
   assert(state.visible.length>0);assert(state.draws>0,JSON.stringify(state));
  }
  const before=requests.length;
  await page.evaluate(()=>canalRecallGame.vectorMap.map.jumpTo({center:[4.88,52.375],zoom:18,pitch:50}));
  assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._artisAnimals.entries.filter(e=>e.group.visible).length),0);
  await page.evaluate(()=>{const a=canalRecallGame.vectorMap._artisAnimals;a.setExtractRoot('../data/extracts/utrecht');canalRecallGame.vectorMap.map.jumpTo({center:[4.915,52.366],zoom:16,pitch:0});});
  assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._artisAnimals.entries.filter(e=>e.group.visible).length),0);
  await page.evaluate(()=>canalRecallGame.vectorMap._artisAnimals.setExtractRoot('../data/extracts/amsterdam'));
  assert(await page.evaluate(()=>canalRecallGame.vectorMap._artisAnimals.entries.some(e=>e.group.visible)));
  assert.equal(requests.length,before,'returning to zoo reuses loaded models');assert.deepEqual(errors,[]);
  report.runtime.push({touch,startupAnimalRequests:0,retryVerified:!touch,returnReusesAssets:true,otherCityHidden:true,errors});
  await page.close();
 }
 const gallery=await browser.newPage({viewport:{width:1600,height:1850}});await gallery.goto(origin+'/canal-drive/artis-animals.html');
 await gallery.waitForFunction(()=>window.animalReview?.done,null,{timeout:60000});assert.deepEqual(await gallery.evaluate(()=>animalReview.errors),[]);
 await gallery.screenshot({path:`${evidence}/gallery.png`});
 await gallery.close();await fs.writeFile(`${evidence}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
