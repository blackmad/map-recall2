/** Jan pilot: frozen actual game, scoped profile ablation, true full-frame GPU queries
 * and trusted desktop/touch camera gestures away from a stationary rider.
 * Run only after root signals the production bundles are frozen and ready. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const option=(n,d)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const output=option('output','artifacts/jan-evertsen-pilot/production-desktop'),base=option('base-url','http://127.0.0.1:5196');
await fs.mkdir(path.join(output,'bundles'),{recursive:true});
const names=['three-buildings.bundle.js','three-buildings-worker.bundle.js','pyramidal-roofs.bundle.js','vector-map.js','game-route.js'];const hashes={};
for(const n of names){const input=option('bundle-dir',null)?path.join(option('bundle-dir',null),n):`public/canal-drive/js/${n}`;const b=await fs.readFile(input);hashes[n]=crypto.createHash('sha256').update(b).digest('hex');await fs.writeFile(path.join(output,'bundles',n),b);}
const catalogBytes=await fs.readFile(option('catalog-path','public/data/street-appearance/profiles.json')),catalog=JSON.parse(catalogBytes);await fs.writeFile(path.join(output,'profiles.json'),catalogBytes);
const envelopePath=option('surveyed-envelope-path',null);
const envelopeBytes=envelopePath?await fs.readFile(envelopePath):null;
const envelopePayload=envelopeBytes?JSON.parse(envelopeBytes):null;
if(envelopeBytes)await fs.writeFile(path.join(output,'surveyed-envelopes.json'),envelopeBytes);
const envelopeHash=envelopeBytes?crypto.createHash('sha256').update(envelopeBytes).digest('hex'):null;
let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({createdAt:new Date().toISOString(),stage:'browser-launch',device:option('device','desktop'),message:String(error),immutableBundles:hashes,catalogRevision:catalog.revision,decision:'failed/incomplete; no actual scene, pan or GPU measurement acquired; retry on later working browser pass'},null,2));throw error;}
const ctx=await browser.newContext(option('device','desktop')==='phone'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1440,height:1000}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await ctx.addInitScript(()=>localStorage.setItem('canalRecall.preferences.v1',JSON.stringify({travelMode:'car',viewMode:'chase',buildingLook:'photo',reducedMotion:false})));
for(const n of names)await page.route(`**/js/${n}*`,r=>r.fulfill({status:200,contentType:'application/javascript',path:path.join(output,'bundles',n)}));
await page.route('**/data/street-appearance/profiles.json*',r=>r.fulfill({status:200,contentType:'application/json',body:catalogBytes}));
const ready=async()=>{await page.waitForFunction(()=>{const v=window.canalRecallGame?.vectorMap,t=v?._threeBuildings,c=v?._completeCity?.status?.();return window.canalRecallGame.state===4&&t?.ready&&t.chunks.size&&!t.pending.length&&!t.inflight.size&&!t.pumping&&!c?.inFlight&&!c?.queued},null,{timeout:120000});await page.waitForTimeout(750)};
const diagnostic=()=>page.evaluate(()=>{const g=window.canalRecallGame,v=g.vectorMap,t=v._threeBuildings,ll=v.worldToLngLat(g.player.x,g.player.y,g.osmLoader),n=2**t.detailZoom,r=ll[1]*Math.PI/180,tile=`${Math.floor((ll[0]+180)/360*n)}/${Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)}`;let digest=2166136261;const mix=a=>{if(!a)return;for(let i=0;i<a.length;i+=Math.max(1,Math.floor(a.length/2000)))digest=Math.imul(digest^(a[i]*997|0),16777619)};const geometryByMode={};let triangles=0;for(const [key,c]of t.chunks){if(!c.mesh)continue;const mode=key.startsWith('extras:')?'extras':key.startsWith('coarse:')?'coarse':key.startsWith('near:')?'near-walls':'other';const bucket=geometryByMode[mode]??(geometryByMode[mode]={triangles:0,chunks:0,features:0});bucket.triangles+=(c.mesh.geometry.index?.count??c.mesh.geometry.attributes.position.count)/3;bucket.chunks++;bucket.features+=c.source?.length??0;mix(c.mesh.geometry.attributes.position.array);if(c.mesh.geometry.attributes.tint)mix(c.mesh.geometry.attributes.tint.array);triangles+=(c.mesh.geometry.index?.count??c.mesh.geometry.attributes.position.count)/3;digest=Math.imul(digest^(c.mesh.geometry.index?.count??c.mesh.geometry.attributes.position.count),16777619);}const admitted=new Set(t.appearanceProfiles.flatMap(p=>(p.frontages??[]).map(f=>f.buildingId)));const rowFeatures=[...new Map([...t.chunks.values()].flatMap(c=>(c.source??[]).filter(f=>admitted.has(String(f.properties.id))).map(f=>[String(f.properties.id),f.properties]))).values()];return{rowFeatures,revision:t.appearanceRevision,profiles:t.appearanceProfiles.length,look:t.look,requested:t.requestedLook,player:ll,subject:v.worldToLngLat(g.camera.targetX,g.camera.targetY,g.osmLoader),playerTile:tile,detailZoom:t.detailZoom,detailTiles:[...t.detailTiles],playerTileSelected:t.detailTiles.has(tile),camera:{center:v.map.getCenter().toArray(),zoom:v.map.getZoom(),pitch:v.map.getPitch(),bearing:v.map.getBearing(),detached:g.camera.detached},chunks:t.chunks.size,coarseChunks:[...t.chunks.values()].filter(c=>c.mesh.userData.coarse).length,triangles,geometryByMode,geometryCountDigest:(digest>>>0).toString(16),mismatches:[...t.chunks.values()].filter(c=>c.mesh.userData.appearanceRevision!==undefined&&(c.mesh.userData.installedLook!==t.look||c.mesh.userData.appearanceRevision!==t.appearanceRevision)).map(c=>c.mesh.userData)}});
const profileId=option('profile-id','jan-evertsen-canopy-candidate-native-pair');
if(!catalog.profiles.some(p=>p.id===profileId))throw Error('Scoped Jan profile missing');
const offCatalog={...catalog,revision:catalog.revision+'-without-jan-production',profiles:catalog.profiles.filter(p=>p.id!==profileId)};
const modes=[],timings=[],ablate=option('ablate','true')==='true',rounds=Number(option('rounds','3')),looks=option('looks','photo,storybook,cartoon,procedural').split(',');
try{
 await page.goto(`${base}${option('game-path','/canal-drive/')}#race=${option('race','52.3735,4.8954,52.3608814,4.8687372,52.3713544,4.8979412')}`);await page.waitForFunction(()=>window.canalRecallGame?.player,null,{timeout:120000});await page.evaluate(()=>window.canalRecallGame._overlay.store.setSetupOpen(false));await ready();
 if(envelopePayload){
  const accepted=await page.evaluate(payload=>window.canalRecallGame.vectorMap._threeBuildings.setDiagnosticSurveyedEnvelopes(payload),envelopePayload);
  if(!accepted)throw Error('Diagnostic surveyed-envelope transport rejected');
  await ready();
  const owners=await page.evaluate(()=>window.canalRecallGame.vectorMap.map._surveyedEnvelopeRoofIds??[]);
  const expected=envelopePayload.envelopes.map(e=>e.nativeParentId);
  if(!expected.length||expected.some(id=>!owners.includes(id)))throw Error('Diagnostic envelope did not acquire an installed drawing owner');
  await fs.writeFile(path.join(output,'surveyed-envelope-installation.json'),JSON.stringify({sha256:envelopeHash,owners,expected,scope:'Explicit diagnostic opt-in; not public source admission'},null,2));
 }
 const reviewPosition=option('review-position','4.85209,52.37042');
 if(reviewPosition){
  const point=reviewPosition.split(',').map(Number);if(point.length!==2||!point.every(Number.isFinite))throw Error('Invalid review position');
  await page.evaluate(([lng,lat])=>{const g=window.canalRecallGame,l=g.osmLoader,x=l._lastOffsetX+(lng-l._lastCenterLng)*111320*Math.cos(l._lastCenterLat*Math.PI/180)*3,y=l._lastOffsetY-(lat-l._lastCenterLat)*111320*3;g.player.x=x;g.player.y=y;g.player.speed=0;g.camera.x=x;g.camera.y=y;g.camera.targetX=x;g.camera.targetY=y;g.camera.resetPan();},point);await ready();
 }
 for(const look of looks){await page.evaluate(async look=>{const v=window.canalRecallGame.vectorMap;v.setBuildingLook(look);await v.setBuildingsLook(look)},look);await page.waitForFunction(look=>window.canalRecallGame.vectorMap._threeBuildings.look===look&&window.canalRecallGame.vectorMap._threeBuildings.requestedLook===look,look,{timeout:120000});await ready();const d=await diagnostic();await fs.writeFile(path.join(output,`diagnostic-${look}.json`),JSON.stringify(d,null,2));console.log('mode',look,'detailZoom',d.detailZoom,'riderDetail',d.playerTileSelected,'chunks',d.chunks);if(!d.playerTileSelected||d.look!==look||d.requested!==look||d.revision!==catalog.revision||d.mismatches.length)throw Error('Normal gameplay mode/detail/revision regression');await page.screenshot({path:path.join(output,`overtoom-bike-${look}.png`)});modes.push(d);console.log('actual bike',look,d.revision,d.playerTileSelected);}
 await page.evaluate(async()=>{const v=window.canalRecallGame.vectorMap;v.setBuildingLook('photo');await v.setBuildingsLook('photo')});await page.waitForFunction(()=>window.canalRecallGame.vectorMap._threeBuildings.look==='photo',null,{timeout:120000});await ready();
 for(let round=0;round<rounds;round++)for(const on of ablate?(round%2?[false,true]:[true,false]):[true]){
  await page.evaluate(c=>window.canalRecallGame.vectorMap._threeBuildings.setStreetAppearance(c),on?catalog:offCatalog);await ready();const d=await diagnostic();
  const timing=await page.evaluate(async()=>{const v=window.canalRecallGame.vectorMap,map=v.map,gl=v._threeBuildings.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),original=map._render;const pending=[],gpu=[],cpu=[],frames=[];let warm=30,count=0,previous=null,disjoint=false;
   if(typeof original!=='function')return{unsupported:'MapLibre _render unavailable'};
   await new Promise(resolve=>{map._render=function(...args){const query=ext&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);const start=performance.now();let result;try{result=original.apply(this,args)}finally{if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,keep:warm<=0})}const end=performance.now();if(warm>0)warm--;else{cpu.push(end-start);if(previous!==null)frames.push(start-previous);previous=start;count++;}if(ext&&gl.getParameter(ext.GPU_DISJOINT_EXT))disjoint=true;while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){const q=pending.shift();if(q.keep)gpu.push(gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q.query);}if(count>=90){map._render=original;resolve();}else map.triggerRepaint();}return result};map.triggerRepaint();});
   if(ext){await new Promise(r=>setTimeout(r,50));for(const q of pending){if(gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE)&&q.keep)gpu.push(gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q.query);}}
   const stats=a=>{a.sort((a,b)=>a-b);return{count:a.length,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null}};return{gpuRenderer:gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gpuExtension:!!ext,gpuDisjoint:disjoint,fullMapGpuMs:stats(gpu),fullMapCpuSubmissionMs:stats(cpu),frameIntervalsMs:stats(frames),method:'EXT_disjoint_timer_query_webgl2 around full MapLibre _render on shared context, all background/custom layers included. Steady actual bike follow;30warm then90measured frames. No gl.finish proxy.'};});timings.push({round,profilesOn:on,diagnostics:d,timing});console.log('fullframe',round,on,JSON.stringify(timing.fullMapGpuMs??timing));
 }
 await page.evaluate(c=>window.canalRecallGame.vectorMap._threeBuildings.setStreetAppearance(c),catalog);await ready();
 const rowInspection=[];
 const rowView=option('row-view',null);
 let rowCameraSyncRestored=true;
 if(rowView){
  const [lng,lat,bearing,zoom,pitch]=rowView.split(',').map(Number);if(![lng,lat,bearing,zoom,pitch].every(Number.isFinite))throw Error('Invalid row-view');
  await page.evaluate(([lng,lat,bearing,zoom,pitch])=>{const v=window.canalRecallGame.vectorMap,original=v.sync;if(typeof original!=='function')throw Error('Actual game camera sync unavailable');window.__janReviewRestoreSync=()=>{v.sync=original;delete window.__janReviewRestoreSync;return v.sync===original};v.sync=()=>{};v.map.jumpTo({center:[lng,lat],bearing,zoom,pitch});},[lng,lat,bearing,zoom,pitch]);
  for(const look of looks){await page.evaluate(async look=>{const v=window.canalRecallGame.vectorMap;v.setBuildingLook(look);await v.setBuildingsLook(look)},look);await ready();const data=await diagnostic();await page.screenshot({path:path.join(output,`row-inspection-${look}.png`)});rowInspection.push(data);}
  rowCameraSyncRestored=await page.evaluate(()=>window.__janReviewRestoreSync());
  if(!rowCameraSyncRestored)throw Error('Row review did not restore actual game camera sync');
  await page.evaluate(async()=>{const v=window.canalRecallGame.vectorMap;v.setBuildingLook('photo');await v.setBuildingsLook('photo')});await ready();
 }
 const beforePan=await diagnostic();
 const gestureLogs=[];const touch=option('device','desktop')==='phone',cdp=touch?await ctx.newCDPSession(page):null;
 const distance=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*110540);
 const centreTile=d=>{const [lng,lat]=d.camera.center,n=2**d.detailZoom,r=lat*Math.PI/180;return `${Math.floor((lng+180)/360*n)}/${Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)}`};
 for(let step=0;step<32;step++){
  const d=await diagnostic();
  if(step>0&&!d.detailTiles.includes(centreTile(d))&&distance(d.camera.center,d.player)>500)break;
  const canvas=await page.locator('#gameCanvas').boundingBox();if(!canvas)throw Error('Actual game canvas unavailable');
  const rotation=await page.evaluate(()=>window.canalRecallGame.camera.rotation);
  const travel=Math.min(canvas.width*.62,canvas.height*.42),dx=-Math.cos(rotation)*travel,dy=Math.sin(rotation)*travel;
  const x=canvas.x+canvas.width*.5-dx*.5,y=canvas.y+canvas.height*.43-dy*.5;
  if(touch){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,id:1}]});await page.waitForTimeout(25);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();}
  await ready();const after=await diagnostic();
  gestureLogs.push({step,method:touch?'trusted CDP touchStart/touchMove/touchEnd':'trusted Playwright mouse drag',camera:after.camera,player:after.player,centreTile:centreTile(after),cameraOutsideRiderDetail:!after.detailTiles.includes(centreTile(after)),cameraDistanceFromRiderM:distance(after.camera.center,after.player),detailTiles:after.detailTiles});
  console.log('camera pan',touch?'touch':'desktop',step,Math.round(distance(after.camera.center,after.player))+'m',!after.detailTiles.includes(centreTile(after)));
 }
 const coarsePan=await diagnostic();
 await page.screenshot({path:path.join(output,'coarse-pan-photo.png')});
 const panModes=[];
 for(const look of ['storybook','procedural']){await page.evaluate(async look=>{const v=window.canalRecallGame.vectorMap;v.setBuildingLook(look);await v.setBuildingsLook(look)},look);await ready();const d=await diagnostic();await page.screenshot({path:path.join(output,`coarse-pan-${look}.png`)});panModes.push({look,diagnostics:d});}
 const stationaryRider=distance(beforePan.player,coarsePan.player)<.05;
 const cameraOutsideRiderDetail=!coarsePan.detailTiles.includes(centreTile(coarsePan));

 const on=timings.filter(t=>t.profilesOn).map(t=>t.timing.fullMapGpuMs?.median).filter(Number.isFinite),off=timings.filter(t=>!t.profilesOn).map(t=>t.timing.fullMapGpuMs?.median).filter(Number.isFinite);const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];const gpuRatio=on.length===3&&off.length===3?median(on)/median(off):null;
 const report={version:1,device:option('device','desktop'),race:option('race','52.3735,4.8954,52.3608814,4.8687372,52.3713544,4.8979412'),reviewPosition,bundleDir:option('bundle-dir','production-snapshot'),profileAblation:ablate,profileAblationScope:profileId,offCatalogRevision:offCatalog.revision,catalogRevision:catalog.revision,immutableBundles:hashes,modes,timings,rowInspection,rowCameraSyncRestored,beforePan,coarsePan,gestureLogs,panModes,stationaryRider,cameraOutsideRiderDetail,panDistanceM:distance(coarsePan.camera.center,coarsePan.player),coarseOwnershipUnchanged:JSON.stringify(beforePan.detailTiles)===JSON.stringify(coarsePan.detailTiles),geometryOnOffChanged:timings.some(t=>t.profilesOn&&timings.some(o=>!o.profilesOn&&o.diagnostics.geometryCountDigest!==t.diagnostics.geometryCountDigest)),fullMapGpuMedianRatio:gpuRatio,errors,limits:['Normal gameplay four modes use actual bike hash and camera sync; setup presentation overlay dismissed to reveal running ride.','Optional review-position moves the stationary rider in the running game for a scene test; this is not evidence of route reachability.','Coarse pan uses real desktop mouse or CDP touch gestures through the game canvas; rider remains stationary and detail-tile ownership must stay fixed. Touch emulation uses this same computer/GPU, not separate phone hardware.','Only Jan pilot profile is removed for ablation; other profiles, current bundles and street-front paths remain fixed. Already extracted feature attributes may retain source roof decisions; this measures runtime recipe ablation, not re-extraction.','Headless local Chrome GPU timing is this hardware/browser only; report query support/disjoint and variability before asserting budget.','Production checks do not accept full Jan facade, portico fidelity, heldout transfer or newly discovered identities. Saved panned images require actual visual inspection of ordinary windows/doors.']};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('complete',JSON.stringify({gpuRatio,errors,geometryOnOffChanged:report.geometryOnOffChanged,stationaryRider,cameraOutsideRiderDetail,panDistanceM:report.panDistanceM}));
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({createdAt:new Date().toISOString(),message:String(error),errors,immutableBundles:hashes,catalogRevision:catalog.revision,modes,timings,decision:'failed/incomplete; no production acceptance'},null,2));throw error;}finally{await browser.close()}
