import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const option=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const output=option('output','artifacts/sloterdijkermeer-review/game'),base=option('base-url','http://127.0.0.1:5196');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={views:[],errors:[],limits:'Headless Chrome touch emulation; frame interval includes vsync. GPU timer only if supported and non-disjoint. Heights/colours/openings are approximate.'};
try {
 if(process.argv.includes('--demo')){
  const stress=process.argv.includes('--intro-stress');
  const page=await browser.newPage({viewport:stress?{width:2048,height:1080}:{width:1440,height:1000},deviceScaleFactor:stress?2:1});
  if(stress)await page.route('**/allotment-houses-demo.html',async route=>{const response=await route.fetch();const html=await response.text();await route.fulfill({response,body:html.replace('await show(true);status.textContent=', 'game.vectorMap._completeCity.setSuspended(true);game.vectorMap._facadesOutOfZoom=true;game.vectorMap._applyFacadeState();await show(true);status.textContent=')});});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/canal-drive/allotment-houses-demo.html`);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('376 mapped'),null,{timeout:120000});
  await page.screenshot({path:`${output}/interactive-demo.png`});
  await page.locator('[data-place="nut"]').click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('iframe').contentWindow.canalRecallGame.vectorMap.map.getCenter().lng-4.8603)<.0001);
  await page.locator('#look').selectOption('cartoon');
  await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.canalRecallGame.vectorMap._threeBuildings.look==='cartoon');
  report.demo=await page.evaluate(()=>{const v=document.querySelector('iframe').contentWindow.canalRecallGame.vectorMap;return{pass:true,parkButton:true,lookSwitch:true,status:document.querySelector('#status').textContent,gardenResident:v._threeBuildings.lastFeatures.filter(f=>f.properties.allotmentHouse).length,chunks:v._threeBuildings.chunks.size,suspended:v._completeCity.suspended,facadesOutOfZoom:v._facadesOutOfZoom};});
  report.demo.forcedIntroSuspension=stress;
  if(!report.demo.gardenResident||!report.demo.chunks||report.demo.suspended||report.demo.facadesOutOfZoom)throw Error('Demo building streaming did not resume');
  console.log('Interactive demo boots, park selector and look switch pass.');
 } else for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:430,height:850}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/canal-drive/`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.canalRecallGame?.ctx,null,{timeout:90000});
  await page.locator('#route-card').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?._threeBuildings?.ready,null,{timeout:120000});
  await page.evaluate(()=>{
   const g=window.canalRecallGame;
   if(g._intro)g._updateIntro(60);g.camera.introOverview=0;g.vectorMap.sync(g.camera,g.osmLoader,g.canvas);
   g.vectorMap.setMeasuredColoursOnly(false);g.vectorMap._completeCity.setSuspended(false);
   g.vectorMap.sync=()=>{};
   g.player.speed=0;g.player.vx=0;g.player.vy=0;g.player.update=()=>{};
  });
  const idle=async()=>{await page.waitForFunction(()=>{const v=window.canalRecallGame.vectorMap,t=v._threeBuildings,c=v._completeCity.status();return t.chunks.size>0&&!t.pending.length&&!t.inflight.size&&!t.pumping&&!c.queued&&!c.inFlight;},null,{timeout:120000});await page.waitForTimeout(800);};
  const targets=[{id:'sloterdijkermeer-wide',center:[4.853,52.38725],zoom:16.8,pitch:50,bearing:-25},{id:'sloterdijkermeer-south-heldout',center:[4.8508,52.38665],zoom:18.5,pitch:60,bearing:35},{id:'nut-en-genoegen-heldout',center:[4.8603,52.3872],zoom:18.3,pitch:60,bearing:-25},{id:'railway-transition',center:[4.8557,52.38825],zoom:18.4,pitch:58,bearing:155}];
  for(const camera of targets){
   const riderBefore=await page.evaluate(()=>({x:canalRecallGame.player.x,y:canalRecallGame.player.y}));
   await page.evaluate(async camera=>{const v=canalRecallGame.vectorMap;v.setBuildingLook('photo');await v.setBuildingsLook('photo');v.map.jumpTo(camera);v._facadesOutOfZoom=false;v._applyFacadeState();v._syncFacadeZoom(camera.zoom);v._completeCity.setSuspended(false);v._threeBuildings.setDetailCentre(...camera.center);v._completeCity.followCamera();v.map.triggerRepaint();},camera);
   await idle();
   const data=await page.evaluate(async()=>{
    const v=canalRecallGame.vectorMap,t=v._threeBuildings,intervals=[];let last=performance.now();
    await new Promise(resolve=>{const frame=now=>{intervals.push(now-last);last=now;if(intervals.length<61){v.map.triggerRepaint();requestAnimationFrame(frame);}else resolve();};requestAnimationFrame(frame);});
    intervals.shift();intervals.sort((a,b)=>a-b);
    const garden=[...new Set(t.lastFeatures.filter(f=>f.properties.allotmentHouse).map(f=>f.properties.id))];
    const gardenOwnership={coarseRanges:0,hiddenBehindDetail:0,wrongFlags:0};
    for(const [key,entry] of t.chunks)if(key.startsWith('coarse:')&&entry.mesh)for(const [id,r] of entry.ranges)if(id.startsWith('allotment-garden:')){gardenOwnership.coarseRanges++;const hidden=entry.mesh.geometry.getAttribute('hidden').array,expected=t.installedDetailIds.has(id)?1:0;if(expected)gardenOwnership.hiddenBehindDetail++;for(let i=r.start;i<r.start+r.count;i++)if(hidden[i]!==expected)gardenOwnership.wrongFlags++;}
    return{gardenOwnership,gardenResident: garden.length,detailZoom:t.detailZoom,stats:t.stats(),frameMedianMs:intervals[Math.floor(intervals.length*.5)],frameP95Ms:intervals[Math.floor(intervals.length*.95)],rider:{x:canalRecallGame.player.x,y:canalRecallGame.player.y}};
   });
   const image=`${mobile?'touch':'desktop'}-${camera.id}.png`;
   await page.locator('#vector-map').screenshot({path:`${output}/${image}`,timeout:90000});
   report.views.push({mobile,camera,image,...data,stationaryRider:riderBefore.x===data.rider.x&&riderBefore.y===data.rider.y});
   console.log(`${image}: ${data.gardenResident} resident houses, ${data.frameMedianMs.toFixed(1)}ms median`);
  }
  // Compare actual scene on/off at the same camera, with identical runtime and neighbors.
  const perf=await page.evaluate(async()=>{
   const v=canalRecallGame.vectorMap,t=v._threeBuildings,map=v.map,original=[...t.lastFeatures];
   const idle=async()=>{while(t.pending.length||t.inflight.size||t.pumping)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,500));};
   const measure=async()=>{
    const frame=[],cpu=[],gpu=[],gl=t.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const queries=[],render=map._render,originalRender=render.bind(map);
    map._render=function(...args){const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();const value=originalRender(...args);gl.finish();cpu.push(performance.now()-start);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}return value;};
    try{let last=performance.now();await new Promise(resolve=>{const tick=now=>{frame.push(now-last);last=now;if(frame.length<41){map.triggerRepaint();requestAnimationFrame(tick);}else resolve();};requestAnimationFrame(tick);});await new Promise(r=>setTimeout(r,250));for(const q of queries){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}}finally{map._render=render;}
    const summary=a=>{a=a.slice(3).sort((x,y)=>x-y);return{samples:a.length,medianMs:a[Math.floor(a.length*.5)]??null,p95Ms:a[Math.floor(a.length*.95)]??null};};
    return{frame:summary(frame),completedFullSceneCpu:summary(cpu),gpu:summary(gpu),stats:t.stats()};
   };
   const withHouses=await measure();t.setFeatures(original.filter(f=>!f.properties.allotmentHouse));await idle();const withoutHouses=await measure();t.setFeatures(original);await idle();const repeatWithHouses=await measure();
   return{withHouses,withoutHouses,repeatWithHouses};
  });
  report[mobile?'touchPerformance':'desktopPerformance']=perf;
  await page.close();
 }
}finally{await browser.close();await fs.writeFile(`${output}/${process.argv.includes('--demo')?'demo-report':'report'}.json`,JSON.stringify(report,null,2)+'\n');}
if(report.errors.length||report.views.some(v=>!v.stationaryRider||!v.gardenResident||v.gardenOwnership?.wrongFlags))throw Error('Gameplay verification failed');
