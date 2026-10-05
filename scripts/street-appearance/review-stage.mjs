/** Native-meter street-level review using production meshes and shaders, with all local neighbors.
 * node scripts/street-appearance/review-stage.mjs --cycle=0 [--collect]
 * Camera geometry is independent of MapLibre pitch limits; original footprint geometry is retained.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const opt=(n,d)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const cycle=opt('cycle','0'),base=opt('base-url','http://127.0.0.1:5196');
if(!/^\d+$/.test(cycle))throw Error('Invalid cycle');
const output=opt('output',`artifacts/street-appearance/cycles/${cycle}`);await fs.mkdir(output,{recursive:true});
const inputsRoot='artifacts/street-appearance/stage-inputs';await fs.mkdir(inputsRoot,{recursive:true});
const catalogCycle=opt('catalog-cycle',null);
const catalogBytes=await fs.readFile(opt('catalog-path',null)??(catalogCycle?`artifacts/street-appearance/cycles/${catalogCycle}/profiles.json`:'public/data/street-appearance/profiles.json')),catalog=JSON.parse(catalogBytes);
await fs.writeFile(`${output}/profiles.json`,catalogBytes);
let manifest=JSON.parse(await fs.readFile('public/data/street-appearance/evidence-manifest.json'));
let allTargets=[
 {id:'overtoom',center:[4.8687372,52.3608814],profileId:'overtoom-gerard-brandt-anna-vondel-right'},
 {id:'overtoom-left-13',inputId:'overtoom',reviewOnly:true,center:[4.8687372,52.3608814],profileId:'overtoom-gerard-brandt-anna-vondel-left',referenceId:'overtoom-gerard-brandt-anna-vondel-left-13'},
 {id:'overtoom-left-38',inputId:'overtoom',reviewOnly:true,center:[4.8687372,52.3608814],profileId:'overtoom-gerard-brandt-anna-vondel-left',referenceId:'overtoom-gerard-brandt-anna-vondel-left-38'},
 {id:'de-wallen',center:[4.8979412,52.3713544],profileId:'bethaniendwarsstraat-right'},
 {id:'de-wallen-right-38',inputId:'de-wallen',reviewOnly:true,center:[4.8979412,52.3713544],profileId:'bethaniendwarsstraat-right',referenceId:'bethaniendwarsstraat-right-38'},
 {id:'modern-control',center:[4.86853,52.37534],profileId:'control-marcantilaan-right'},
 {id:'overtoom-holdout',center:[4.87047,52.361485],profileId:'overtoom-holdout-1'},
 {id:'de-wallen-holdout',center:[4.898569,52.37164],profileId:'bethanienstraat-holdout-1'},
];
const sourceManifestPath=opt('source-manifest',null);
if(sourceManifestPath){
 const source=JSON.parse(await fs.readFile(sourceManifestPath));
 manifest={images:source.evidence.map(e=>({...e,id:e.id,profileId:'bethanienstraat-holdout-1',heading:e.perspective.headingDeg,file:e.cropFile,perspective:e.perspective}))};
 allTargets=manifest.images.map(e=>({id:e.id,inputId:'de-wallen-holdout',center:[4.898569,52.37164],profileId:e.profileId,referenceId:e.id,retreatM:0}));
}
const selected=opt('targets','main');const targets=allTargets.filter(t=>selected==='all'||(selected==='main'?!t.id.includes('holdout')&&!t.reviewOnly:selected==='heldouts'?t.id.includes('holdout'):selected.split(',').includes(t.id)));
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
try{
 if(process.argv.includes('--collect')){
  for(const name of ['three-buildings.bundle.js','three-buildings-worker.bundle.js','vector-map.js'])await page.route(`**/canal-drive/js/${name}*`,route=>route.fulfill({status:200,contentType:'application/javascript',path:`artifacts/street-appearance/final/bundles/${name}`}));
  await page.route('**/data/street-appearance/profiles.json*',route=>route.fulfill({status:200,contentType:'application/json',body:catalogBytes}));
  await page.goto(`${base}/canal-drive/`);await page.waitForFunction(()=>Boolean(window.canalRecallGame?.ctx));await page.locator('#route-card').waitFor({state:'visible'});
  await page.evaluate(()=>{const g=window.canalRecallGame;const nearest=(lng,lat)=>g.routePois.slice().sort((a,b)=>Math.hypot((a.lng-lng)*.61,a.lat-lat)-Math.hypot((b.lng-lng)*.61,b.lat-lat))[0];g._pickReviewRide=()=>({from:nearest(4.8687372,52.3608814),to:nearest(4.8979412,52.3713544),dueNear:[],alternatives:[]});});
  await page.locator('#route-card').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?.ready,null,{timeout:120000});await page.evaluate(()=>window.canalRecallGame.vectorMap.sync=()=>{});
  for(const target of targets){
   await page.evaluate(target=>{const v=window.canalRecallGame.vectorMap;v.map.jumpTo({center:target.center,zoom:19,bearing:0,pitch:50});v._threeBuildings.setDetailCentre(...target.center);v._completeCity.followCamera();},target);
   await page.waitForTimeout(2000);await page.waitForFunction(()=>{const v=window.canalRecallGame.vectorMap,t=v._threeBuildings;return !v._completeCity.status().inFlight&&!t.pending.length&&!t.inflight.size;},null,{timeout:120000});
   const input=await page.evaluate(target=>{const v=window.canalRecallGame.vectorMap,t=v._threeBuildings;
    const features=v._tileFeatures.filter(f=>{const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return polys.some(p=>p[0].some(([lng,lat])=>Math.hypot((lng-target.center[0])*111320*.61,(lat-target.center[1])*110540)<160));});
    return {target,features,streets:Array.from(t.streetsFor(features)??[]),profileRevision:t.appearanceRevision,limits:'All surveyed buildings intersecting160m radius retained; no footprint deleted for camera visibility. Curated landmark GLBs, trees and cars are outside this ordinary-building stage.'};
   },target);
   await fs.writeFile(`${inputsRoot}/${target.id}.json`,JSON.stringify(input)+'\n');console.log(`collected ${target.id}: ${input.features.length} native footprints, ${input.streets.length/4} street segments`);
  }
  await page.unrouteAll();
 }
 const entry=`import * as THREE from 'three';import {buildFeatureChunk,ORIGIN} from './src/canalRecall/threeBuildingFeatures.ts';import {buildLookTextures,VERTEX,FRAGMENT} from './src/canalRecall/threeBuildingsBrowser.ts';import {streetSegments} from './src/canalRecall/streetFronts.ts';export {THREE,buildFeatureChunk,ORIGIN,buildLookTextures,VERTEX,FRAGMENT,streetSegments};`;
 const bundleCycle=opt('bundle-cycle',null);
 const bundlePath=opt('bundle-path',bundleCycle?`artifacts/street-appearance/cycles/${bundleCycle}/stage.bundle.js`:null);
 const built=bundlePath?{outputFiles:[{contents:await fs.readFile(bundlePath),get text(){return this.contents.toString();}}]}:await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',globalName:'StreetStage'});
 const sourceSha256=crypto.createHash('sha256').update(built.outputFiles[0].contents).digest('hex');await fs.writeFile(`${output}/stage.bundle.js`,built.outputFiles[0].contents);
 const results=[];
 await page.goto(`${base}/canal-drive/`,{waitUntil:'domcontentloaded'});
 await page.setContent(`<html><head><base href="${base}/canal-drive/"><style>html,body{margin:0;overflow:hidden;background:#b9d9e8}canvas{display:block}</style></head><body></body></html>`);
 await page.addScriptTag({content:built.outputFiles[0].text});
 for(const target of targets){
  const input=JSON.parse(await fs.readFile(`${inputsRoot}/${target.inputId??target.id}.json`));
  const refs=manifest.images.filter(i=>i.profileId===target.profileId);const reference=target.referenceId?refs.find(r=>r.id===target.referenceId):refs[0];if(!reference)throw Error(`Missingreference:${target.referenceId}`);
  const heading=reference.heading;
  const cameraPoint=reference.camera.coordinates.slice(0,2);
  const retreatM=target.retreatM??(target.id==='de-wallen-holdout'?2:0);
  if(retreatM){const away=(heading+180)*Math.PI/180;cameraPoint[0]+=Math.sin(away)*retreatM/(111320*Math.cos(cameraPoint[1]*Math.PI/180));cameraPoint[1]+=Math.cos(away)*retreatM/110540;}
  const cameras=[
   {id:'block',lngLat:cameraPoint,retreatFromReferenceM:retreatM,eyeM:2.5,bearing:heading-55,pitchUp:12,vfov:62},
   {id:'front',lngLat:cameraPoint,retreatFromReferenceM:retreatM,eyeM:2.5,bearing:heading,pitchUp:40,vfov:90},
  ];
  if(sourceManifestPath){const p=reference.perspective;cameras.push({id:'source-row',lngLat:cameraPoint,retreatFromReferenceM:retreatM,eyeM:2.5,bearing:heading,pitchUp:p.pitchDeg,vfov:2*Math.atan(Math.tan(p.fovDeg*Math.PI/360)*p.height/p.width)*180/Math.PI,viewport:{width:p.width,height:p.height},notes:'Original station retained: a two-metre retreat intersects the opposite surveyed wall in this narrow alley. Composition comparison, no exact registration.'});cameras.push({...cameras[0],id:'opposite-oblique',bearing:heading+55});}
  if(opt('camera-set','default')==='retry'&&target.id==='de-wallen-holdout'){const p=reference.perspective;cameras.push({id:'source-front',lngLat:reference.camera.coordinates.slice(0,2),retreatFromReferenceM:0,eyeM:2.5,bearing:heading,pitchUp:p.pitchDeg,vfov:2*Math.atan(Math.tan(p.fovDeg*Math.PI/360)*p.height/p.width)*180/Math.PI,viewport:{width:p.width,height:p.height},referenceProjection:true});}
  if(opt('camera-set','default')==='overtoom'&&target.id.startsWith('overtoom')){
   const p=reference.perspective;
   cameras.push({id:'source-ground',lngLat:reference.camera.coordinates.slice(0,2),retreatFromReferenceM:0,eyeM:2.5,bearing:heading,pitchUp:p.pitchDeg,vfov:2*Math.atan(Math.tan(p.fovDeg*Math.PI/360)*p.height/p.width)*180/Math.PI,viewport:{width:p.width,height:p.height},referenceProjection:true});
   const distance=4,away=(heading+180)*Math.PI/180,station=reference.camera.coordinates.slice(0,2);
   station[0]+=Math.sin(away)*distance/(111320*Math.cos(station[1]*Math.PI/180));station[1]+=Math.cos(away)*distance/110540;
   cameras.push({id:'entrance-row',lngLat:station,retreatFromReferenceM:distance,eyeM:2.5,bearing:heading,pitchUp:14,vfov:80,notes:'Move four meters away across the street to include entry base and upper trim; exact reference registration is not asserted. All native neighbors retained; solid-footprint collision check below.'});
  }
  const looks=opt('looks','photo').split(',');
  const pointInside=(point,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [x,y]=ring[i],[xj,yj]=ring[j];if((y>point[1])!==(yj>point[1])&&point[0]<(xj-x)*(point[1]-y)/(yj-y)+x)inside=!inside;}return inside;};
  for(const camera of cameras){camera.insideBuildingIds=input.features.filter(f=>{const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return polygons.some(p=>pointInside(camera.lngLat,p[0])&&!p.slice(1).some(h=>pointInside(camera.lngLat,h)));}).map(f=>f.properties.id);if(camera.insideBuildingIds.length)throw Error(`Camera inside surveyed footprint:${camera.insideBuildingIds.join(',')}`);}
  for(const look of looks){
   const data=await page.evaluate(async({input,catalog,look})=>{
    const {THREE,buildFeatureChunk,ORIGIN,buildLookTextures,VERTEX,FRAGMENT}=window.StreetStage;
    if(window.stage){window.stage.renderer.dispose();window.stage.renderer.domElement.remove();for(const g of window.stage.geometries)g.dispose();window.stage.material.dispose();}
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#bfd9e6');
    const set=await buildLookTextures(THREE,look,renderer.capabilities.getMaxAnisotropy());
    const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{cells:{value:set.colour},masks:{value:set.mask},bands:{value:look==='cartoon'?3:0},flatColour:{value:0},cityFade:{value:1}},side:THREE.FrontSide});
    const architectureStreets=catalog.streetFrontPaths?.length ? window.StreetStage.streetSegments(catalog.streetFrontPaths,ORIGIN) : [];
    const allStreets=Float32Array.from([...input.streets,...architectureStreets]);
    const geometries=[],stats=[];
    for(const mode of ['walls','extras']){
     const chunk=buildFeatureChunk(input.features,look,mode,allStreets,catalog.profiles),geometry=new THREE.BufferGeometry();
     geometry.setAttribute('position',new THREE.BufferAttribute(chunk.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(chunk.uvs,2));geometry.setAttribute('layer',new THREE.BufferAttribute(chunk.layers,1));geometry.setAttribute('tint',new THREE.BufferAttribute(chunk.tints,4,true));geometry.setAttribute('accent',new THREE.BufferAttribute(chunk.accents,4,true));geometry.setAttribute('hidden',new THREE.BufferAttribute(new Uint8Array(chunk.vertexCount),1));geometry.setIndex(new THREE.BufferAttribute(chunk.indices,1));
     geometry.computeBoundingSphere();geometries.push(geometry);scene.add(new THREE.Mesh(geometry,material));stats.push({mode,vertices:chunk.vertexCount,triangles:chunk.indices.length/3});
    }
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshBasicMaterial({color:'#d6d2c8'}));floor.position.z=-.06;scene.add(floor);
    const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,1200);camera.up.set(0,0,1);
    window.stage={renderer,scene,camera,material,geometries,origin:ORIGIN};return {stats,features:input.features.length,routeStreetSegments:input.streets.length/4,architecturalStreetSegments:architectureStreets.length/4};
   },{input,catalog,look});
   for(const camera of cameras){
    await page.setViewportSize(camera.viewport??{width:1440,height:1000});
    const diagnostics=await page.evaluate(camera=>{const s=window.stage,THREE=window.StreetStage.THREE,kx=111320*Math.cos(s.origin.lat*Math.PI/180);const x=(camera.lngLat[0]-s.origin.lng)*kx,y=(camera.lngLat[1]-s.origin.lat)*110540;const bearing=camera.bearing*Math.PI/180,pitch=camera.pitchUp*Math.PI/180;s.renderer.setSize(innerWidth,innerHeight);s.camera.aspect=innerWidth/innerHeight;s.camera.fov=camera.vfov;s.camera.updateProjectionMatrix();s.camera.position.set(x,y,camera.eyeM);s.camera.lookAt(new THREE.Vector3(x+Math.sin(bearing)*Math.cos(pitch)*50,y+Math.cos(bearing)*Math.cos(pitch)*50,camera.eyeM+Math.sin(pitch)*50));s.renderer.render(s.scene,s.camera);return {viewport:[innerWidth,innerHeight],eye:s.camera.position.toArray(),camera:s.camera.matrixWorld.toArray(),drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles};},camera);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const image=`${target.id}-${look}-${camera.id}.png`;await page.screenshot({path:path.join(output,image)});results.push({target:target.id,look,view:camera.id,camera,image,reference:reference.file,referenceId:reference.id,diagnostics,...data});console.log(`cycle${cycle} ${target.id} ${look} ${camera.id}`);
   }
  }
 }
 const report={version:1,cycle,createdAt:new Date().toISOString(),stageBundleSha256:sourceSha256,catalogRevision:catalog.revision,catalogSha256:crypto.createHash('sha256').update(catalogBytes).digest('hex'),results,errors,limits:'Native footprint and height ground-camera stage. Ordinary geometry and production material pipeline; neighbors retained. No cars, trees or curated landmark GLBs. Camera uses municipal panorama coordinates but image registration is not asserted.'};
 await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
 const cards=results.map(r=>`<section><h2>${r.target} · ${r.look} · ${r.view}</h2><div><figure><img src="${path.relative(output,sourceManifestPath?r.reference:`artifacts/street-appearance/source-evidence/${path.basename(r.reference)}`)}"><figcaption>Municipal street-side reference</figcaption></figure><figure><img src="${r.image}"><figcaption>Native-meter generator; all ordinary neighbors retained</figcaption></figure></div></section>`).join('');
 await fs.writeFile(`${output}/index.html`,`<!doctype html><meta charset="utf-8"><title>Street-level review cycle${cycle}</title><style>body{font:16px sans-serif;background:#efeee8}section div{display:grid;grid-template-columns:1fr 1fr;gap:10px}img{width:100%}figure{margin:0}</style><h1>Street-level self-review cycle${cycle}</h1><p>${report.limits}</p><p>Catalog ${catalog.revision}; ${results.length} views; source bundle SHA256 ${sourceSha256}. <a href="report.json">Camera matrices and source counts</a></p>${cards}`);
 if(errors.length)throw Error(`Stage browser errors:${errors.join('; ')}`);
}finally{await browser.close();}
