/** Actual game startup, stationary pan and wide-camera review. Run serially. */
import {chromium,devices} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const label=process.argv[2]||'baseline',device=process.argv[3]||'desktop';
const output=`artifacts/city-performance/${label}/${device}`;fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage(device==='touch'?devices['iPhone 13']:{viewport:{width:1440,height:900}});
const profiler=process.env.CITY_CPU_PROFILE?await page.context().newCDPSession(page):null;
if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start')}
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const p=window.__cityPerf={frame:0,longTasks:[],calls:{},posts:[],renders:[],gpu:[],stage:'startup'};
 const frame=t=>{p.frame=t;requestAnimationFrame(frame)};requestAnimationFrame(frame);
 new PerformanceObserver(list=>{for(const e of list.getEntries())p.longTasks.push({at:e.startTime,ms:e.duration,stage:p.stage})}).observe({type:'longtask',buffered:true});
 const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(data,...args){const t=performance.now();const r=post.call(this,data,...args);if(data?.key)p.posts.push({key:data.key,ms:performance.now()-t,features:data.features?.length,stage:p.stage});return r};
 const timer=setInterval(()=>{
  const Type=window.CanalRecallThreeBuildings?.ThreeBuildings;if(!Type)return;clearInterval(timer);
  for(const name of ['setFeatures','contextFor','install','rebuild']){const fn=Type.prototype[name];Type.prototype[name]=function(...args){const t=performance.now();try{return fn.apply(this,args)}finally{(p.calls[name]??=[]).push({ms:performance.now()-t,stage:p.stage,key:typeof args[0]==='string'?args[0]:undefined})}}}
 },10);
});
try{
 const started=Date.now();await page.goto(process.env.CITY_REVIEW_URL||'http://127.0.0.1:4403/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length);
 await page.locator('#travel-mode').selectOption('car',{force:true});await page.locator('#view-mode').selectOption('chase',{force:true});
 // A fixed origin and destination avoid asynchronous texture draws consuming
 // seeded randomness and silently comparing different neighborhoods.
 await page.waitForFunction(()=>canalRecallGame.routePois.some(p=>p.id==='anne-frank')&&canalRecallGame.routePois.some(p=>p.id==='rijksmuseum'));
 await page.locator('#poi-destination').selectOption('rijksmuseum');
 await page.evaluate(()=>{const g=canalRecallGame;g._pickDestinationNear=()=>g.routePois.find(p=>p.id==='anne-frank')});
 await page.locator('#route-card').evaluate(form=>form.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.player?.x&&canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 const bootMs=Date.now()-started;
 await page.waitForFunction(()=>{const t=canalRecallGame.vectorMap._threeBuildings;return t?.ready&&t.chunks.size&&!t.pending.length&&!t.inflight.size},null,{timeout:180000});
 const readyMs=Date.now()-started;
 if(profiler){const {profile}=await profiler.send('Profiler.stop');fs.writeFileSync(`${output}/startup.cpuprofile`,JSON.stringify(profile));}
 const initial=await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap,t=v._threeBuildings;g.input.keys={};g.input.justPressed={};const rider={...g.player};
  const render=t.renderer.render.bind(t.renderer),gl=t.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  t.renderer.render=(...args)=>{const p=__cityPerf;while(pending.length&&gl.getQueryParameter(pending[0].q,gl.QUERY_RESULT_AVAILABLE)){const held=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))p.gpu.push({ms:gl.getQueryParameter(held.q,gl.QUERY_RESULT)/1e6,stage:held.stage,frame:held.frame});gl.deleteQuery(held.q)}const measure=ext&&pending.length<6&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY),q=measure?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const time=performance.now();render(...args);p.renders.push({ms:performance.now()-time,stage:p.stage,frame:p.frame,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles});if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({q,stage:p.stage,frame:p.frame})}};
  const dbg=gl.getExtension('WEBGL_debug_renderer_info');return {rider,mapZoom:v.map.getZoom(),cameraZoom:g.camera.zoom,minZoom:g.camera.minZoom,maxZoom:g.camera.maxZoom,stats:t.stats(),gpuTimer:!!ext,gpu:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null,pixelRatio:v.map.getPixelRatio()};
 });
 const snapshots=[], cullingAB=[];
 for(const [name,zoom,pan] of [['street',null,0],['pan',null,650],['wide',16,0],['minimum','minimum',0],['overview',14.8,0]]){
  await page.evaluate(({name,zoom,pan})=>{__cityPerf.stage=name;const g=canalRecallGame;if(zoom==='minimum')g.camera.zoom=g.camera.minZoom;else if(zoom!=null)g.camera.zoom*=2**(zoom-g.vectorMap.map.getZoom());if(pan)g.camera.pan(pan,-160)},{name,zoom,pan});
  await page.waitForTimeout(1200);
  await page.waitForFunction(()=>{const t=canalRecallGame.vectorMap._threeBuildings,s=canalRecallGame.vectorMap._completeCity;return t?.ready&&!t.pending.length&&!t.inflight.size&&!s.inFlight&&!s.queue.length},null,{timeout:180000});
  const sample=await page.evaluate(async()=>{let last=0,frames=[];await new Promise(resolve=>{const frame=now=>{if(last)frames.push(now-last);last=now;if(frames.length>=90)resolve();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});const g=canalRecallGame,v=g.vectorMap,t=v._threeBuildings;return {stage:__cityPerf.stage,zoom:v.map.getZoom(),pitch:v.map.getPitch(),center:v.map.getCenter().toArray(),rider:{x:g.player.x,y:g.player.y},frames,stats:t.stats(),resident:t.lastFeatures.length,chunks:[...t.chunks].map(([key,c])=>({key,buildings:c.info.buildingCount,vertices:c.info.vertexCount,visible:c.mesh?.visible}))};});
  await page.screenshot({path:`${output}/${name}.png`});snapshots.push(sample);console.log(JSON.stringify({label,device,stage:name,zoom:sample.zoom,resident:sample.resident,...sample.stats}));
 }
 if(process.env.CITY_CULLING_AB) for(const enabled of [false,true,false,true]){
  const stage=`culling-${enabled}-${cullingAB.length}`;
  await page.evaluate(({enabled,stage})=>{__cityPerf.stage=stage;for(const c of canalRecallGame.vectorMap._threeBuildings.chunks.values())if(c.mesh)c.mesh.frustumCulled=enabled},{enabled,stage});
  await page.waitForTimeout(500);
  await page.evaluate(()=>new Promise(resolve=>{let n=0;const f=()=>++n===120?resolve():requestAnimationFrame(f);requestAnimationFrame(f)}));
  cullingAB.push({stage,enabled,stats:await page.evaluate(()=>canalRecallGame.vectorMap._threeBuildings.stats())});
  await page.screenshot({path:`${output}/${stage}.png`});
 }
 if(cullingAB.length){
  const unchanged=async(name)=>{const path=`${output}/${name}.png`,{width,height}=await sharp(path).metadata();return sharp(path).extract({left:0,top:Math.floor(height*.25),width,height:Math.floor(height*.4)}).raw().toBuffer()};
  const a=await unchanged(cullingAB[0].stage),b=await unchanged(cullingAB[1].stage);let changed=0;for(let n=0;n<a.length;n+=3)if(a[n]!==b[n]||a[n+1]!==b[n+1]||a[n+2]!==b[n+2])changed++;
  console.log(JSON.stringify({cullingChangedPixels:changed,scenePixels:a.length/3}));
  assert(changed/(a.length/3)<.00001,'culling retains the visible scene (allows tiny rider/label drift)');
 }
 if(process.env.CITY_GESTURE_REVIEW){
  await page.evaluate(()=>{const g=canalRecallGame;g.camera.zoom=.65;g.camera.resetPan();__cityPerf.stage='gesture'});
  await page.waitForTimeout(1000);
  if(device==='touch'){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:310,y:320}]});
   for(let n=1;n<=16;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:310-n*12,y:320+n*3}]});await page.waitForTimeout(20)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.move(1100,400);await page.mouse.down();await page.mouse.move(450,560,{steps:30});await page.mouse.up();
  }
  await page.waitForTimeout(2000);
  assert(await page.evaluate(()=>canalRecallGame.camera.detached),'actual input detaches the camera');
  const rider=await page.evaluate(()=>({x:canalRecallGame.player.x,y:canalRecallGame.player.y}));
  assert(Math.hypot(rider.x-initial.rider.x,rider.y-initial.rider.y)<.1,'input pan retains stationary rider');
  await page.screenshot({path:`${output}/gesture.png`});
 }
 assert(snapshots.every(s=>Math.hypot(s.rider.x-initial.rider.x,s.rider.y-initial.rider.y)<.1),'camera pan retains stationary rider');
 const instrumentation=await page.evaluate(()=>__cityPerf);
 const percentile=(values,p)=>{const a=values.slice().sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null};
 const gpuFrames=stage=>{const totals=new Map();for(const g of instrumentation.gpu)if(g.stage===stage)totals.set(g.frame,(totals.get(g.frame)||0)+g.ms);return [...totals.values()]};
 const summary={cullingAB:cullingAB.map(s=>({...s,gpuMedian:percentile(instrumentation.gpu.filter(r=>r.stage===s.stage).map(r=>r.ms),.5)})),label,device,bootMs,readyMs,initial,errors,stages:snapshots.map(s=>({...s,frames:undefined,chunks:undefined,gpuFrameMedian:percentile(gpuFrames(s.stage),.5),frameMedian:percentile(s.frames,.5),frameP95:percentile(s.frames,.95),renderMedian:percentile(instrumentation.renders.filter(r=>r.stage===s.stage).map(r=>r.ms),.5),gpuMedian:percentile(instrumentation.gpu.filter(r=>r.stage===s.stage).map(r=>r.ms),.5)})),calls:Object.fromEntries(Object.entries(instrumentation.calls).map(([name,x])=>[name,{count:x.length,totalMs:x.reduce((n,e)=>n+e.ms,0),p95Ms:percentile(x.map(e=>e.ms),.95),maxMs:Math.max(...x.map(e=>e.ms))}])),workerPosts:instrumentation.posts.length,longTasks:instrumentation.longTasks.length};
 fs.writeFileSync(`${output}/raw.json`,JSON.stringify({snapshots,instrumentation},null,2));fs.writeFileSync(`${output}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));assert.deepEqual(errors,[]);
}finally{await browser.close();}
