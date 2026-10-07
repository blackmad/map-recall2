import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out='artifacts/afrikahuis-review/metal-source-final', id='afrikahuis';
const spec=JSON.parse(fs.readFileSync('scripts/landmarks/afrikahuis-spec.json'));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={browser:browser.version(),executable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',asset:'09ff3adba973233b03ab2f7a1dddd4b6a21b85e9fd603658c66273c1042a0fc7',date:new Date().toISOString(),views:[],errors:[],scope:'Actual game native scale; headless desktop and emulated touch; diagnostic cameras separately marked. No physical mobile guarantee.'};
try {
const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
await page.goto('http://127.0.0.1:5213/canal-drive/');
await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
await page.locator('#poi-destination').selectOption('lm-'+spec.landmarkId);
await page.locator('#route-card').evaluate(f=>f.requestSubmit());
await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap;g.state=6;g.player.vx=g.player.vy=g.player.speed=0;g.camera.projector=(x,y)=>v.projectWorld(x,y,g.osmLoader,g.canvas);v.sync=()=>{};v._completeCity.setSuspended(false);v.setActiveLandmark(null);});
async function capture(name,camera,diagnostic=false) {
 await page.evaluate(({camera,diagnostic})=>{const v=canalRecallGame.vectorMap,m=v.map;if(diagnostic){m.setMaxPitch(89);m.setMaxZoom(26);}else{m.setMaxPitch(85);m.setMaxZoom(26);}m.setCenterClampedToGround(false);m.jumpTo(camera.from?m.calculateCameraOptionsFromTo(camera.from,camera.alt,camera.to,camera.targetAlt):camera);v._completeCity.followCamera();m.triggerRepaint();},{camera,diagnostic});
 await page.waitForTimeout(3000);
 await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size;},null,{timeout:180000});
 await page.waitForFunction(()=>canalRecallGame.vectorMap._signatureLandmarks.shown.has('afrikahuis'),null,{timeout:180000});
 const proof=await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap,m=v.map;return{asset:CanalRecallSignatureLandmarks.MODEL_ASSET_VERSIONS['afrikahuis'],center:m.getCenter().toArray(),zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing(),elevation:m.getCenterElevation(),actualEye:{lngLat:m.transform.getCameraLngLat().toArray(),altitude:m.transform.getCameraAltitude()},maxPitch:m.getMaxPitch(),player:[g.player.x,g.player.y,g.player.vx,g.player.vy],state:g.state,buildings:v._threeBuildings.stats(),shown:[...v._signatureLandmarks.shown]};});
 await page.screenshot({path:out+'/'+name+'.png'});await page.evaluate(()=>canalRecallGame.canvas.style.visibility='hidden');await page.screenshot({path:out+'/'+name+'-HUD-only-hidden-diagnostic.png'});await page.evaluate(()=>canalRecallGame.canvas.style.visibility='');report.views.push({name,requested:camera,diagnostic,HUDVariant:'Only game HUD canvas hidden in separate diagnostic PNG; scene geometry, trees, neighbors and signatures untouched.',...proof});console.log(name,JSON.stringify(proof));fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
}


const lon=111320*Math.cos(spec.surveyed.anchor[1]*Math.PI/180),coord=p=>[spec.surveyed.anchor[0]+p[0]/lon,spec.surveyed.anchor[1]-p[2]/110540];
for(const v of [
 {name:'corner-street-front',from:[-20,10,-8],to:[-1,4,7]},
 {name:'corner-street-west',from:[-25,10,4],to:[-2,4,7]},
 {name:'corner-street-southwest',from:[-18,8,16],to:[-2,4,7]}
])await capture(v.name,{from:coord(v.from),alt:v.from[1],to:coord(v.to),targetAlt:v.to[1]},true);
report.labelStateBefore=await page.evaluate(()=>({labels:canalRecallGame.vectorMap._labelsVisible,quiet:canalRecallGame.vectorMap._quizQuietMap,visibility:canalRecallGame.vectorMap.map.getLayoutProperty('poi-labels','visibility')}));
await page.keyboard.press('d');await page.waitForTimeout(1000);
await capture('map-label-geographic',{center:spec.surveyed.anchor,zoom:19,pitch:0,bearing:0});
report.labels=await page.evaluate(async id=>{const m=canalRecallGame.vectorMap.map,data=await m.getSource('amsterdam-pois').getData(),f=data.features.find(x=>x.properties.id===id),p=m.project(f.geometry.coordinates),rendered=m.queryRenderedFeatures({layers:['poi-labels']}).filter(x=>x.properties.id===id||/Avonturijn/.test(x.properties.name)),near=m.queryRenderedFeatures([[p.x-100,p.y-100],[p.x+100,p.y+100]]).filter(x=>/Avonturijn|Afrikahuis/.test(x.properties.name||'')||/Avonturijn|Afrikahuis/.test(x.properties['name:latin']||'')).map(x=>({source:x.source,layer:x.layer.id,properties:x.properties,geometry:x.geometry}));return{labelState:{labels:canalRecallGame.vectorMap._labelsVisible,quiet:canalRecallGame.vectorMap._quizQuietMap,visibility:m.getLayoutProperty('poi-labels','visibility')},genuineFeature:f,projected:p,rendered:rendered.map(x=>({source:x.source,layer:x.layer.id,properties:x.properties,geometry:x.geometry})),near};},spec.landmarkId);

report.environment=await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap,gl=v._threeBuildings.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,dpr:devicePixelRatio,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight]};});
await page.evaluate(anchor=>{const v=canalRecallGame.vectorMap,m=v.map;m.setMaxPitch(60);m.setCenterClampedToGround(true);m.jumpTo({center:anchor,zoom:18.4,pitch:55,bearing:150});v._completeCity.followCamera();},spec.surveyed.anchor);
await page.waitForTimeout(3000);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return !b.pending.length&&!b.inflight.size;},null,{timeout:180000});
await page.evaluate(id=>{const v=canalRecallGame.vectorMap,l=v._signatureLandmarks;window.__afrikaFrozenEntries=l._entries.slice();window.__afrikaRequest=l._requestModels;l._requestModels=()=>{};},id);
report.controlledPerformance=[];
for(const enabled of [true,false,true,false,true]){
 const invariant=await page.evaluate(({id,enabled})=>{const g=canalRecallGame,v=g.vectorMap,l=v._signatureLandmarks;l._entries=__afrikaFrozenEntries.filter(x=>enabled||x.spec.id!==id);enabled?l.shown.add(id):l.shown.delete(id);v._refreshBuildingSuppression();v._pyramidalRoofs?.setHidden(v._signatureSuppressOsmIds());return{enabled,player:[g.player.x,g.player.y,g.player.vx,g.player.vy],state:g.state,camera:{center:v.map.getCenter().toArray(),zoom:v.map.getZoom(),pitch:v.map.getPitch(),bearing:v.map.getBearing()},otherEntries:l._entries.filter(x=>x.spec.id!==id).map(x=>x.spec.id).sort(),chunks:[...v._threeBuildings.chunks.keys()].sort(),geometryMB:v._threeBuildings.stats().geometryMB,textureMB:v._threeBuildings.stats().textureMB,ownHidden:v._threeBuildings.hidden.has('NL.IMBAG.Pand.0363100012108180')};},{id,enabled});
 await page.waitForTimeout(500);
 const frames=await page.evaluate(()=>new Promise(resolve=>{let last,frames=[];function f(t){if(last)frames.push(t-last);last=t;canalRecallGame.vectorMap.map.triggerRepaint();if(frames.length<90)requestAnimationFrame(f);else{frames.sort((a,b)=>a-b);resolve({medianMs:frames[45],p95Ms:frames[85],samples:frames.length});}}requestAnimationFrame(f);}));report.controlledPerformance.push({...invariant,...frames});
}
await page.evaluate(()=>{const l=canalRecallGame.vectorMap._signatureLandmarks;l._entries=__afrikaFrozenEntries;l._requestModels=__afrikaRequest;});
report.completed=true;
}catch(e){report.errors.push(e.stack);console.error(e);}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log('browser closed');}
