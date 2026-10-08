import {test,expect} from '@playwright/test';
import {setHiddenSelect} from './helpers';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
async function waitForSurfaces(page:any){
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).canalRecallGame.vectorMap._elevation.surfaces?.status();return Boolean(s?.geometryReady&&s.visibleMeshes>0&&s.chunks>0&&s.errors.length===0);}),{timeout:60000}).toBe(true);
}

test.use({ignoreHTTPSErrors:true});
test('Amsterdam terrain and custom scene use NAP together',async({page},testInfo)=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
 // Keep actual basemap tiles. Use the installed, pinned MapLibre build.
 await page.route(/unpkg\.com\/maplibre-gl@5(?:\.24\.0)?\/dist\/maplibre-gl\.js/,r=>r.fulfill({path:resolve('node_modules/maplibre-gl/dist/maplibre-gl.js'),contentType:'application/javascript'}));
 await page.goto('/canal-drive/?terrain=1&bridges3d=1');
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).canalRecallGame?.vectorMap?.ready)),{timeout:90000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).canalRecallGame.vectorMap._elevation?.ready),{timeout:30000}).toBe(true);
 await setHiddenSelect(page,'travel-mode','car');
 await setHiddenSelect(page,'view-mode','chase');
 await page.locator('#route-card').evaluate((form:HTMLFormElement)=>form.requestSubmit());
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).canalRecallGame?.player?.x)),{timeout:120000}).toBe(true);
 await page.evaluate(()=>{(window as any).canalRecallGame.state=4;});
 const point:[number,number]=[4.891,52.379];
 await expect.poll(()=>page.evaluate(p=>(window as any).canalRecallGame.vectorMap._elevation.sample(p).ready,point),{timeout:30000}).toBe(true);
 const report=await page.evaluate(p=>{
  const vm=(window as any).canalRecallGame.vectorMap,map=vm.map,service=vm._elevation;
  const game=(window as any).canalRecallGame,loader=game.osmLoader;
  game.player.x=loader._lastOffsetX+(p[0]-loader._lastCenterLng)*111320*Math.cos(loader._lastCenterLat*Math.PI/180)*3;
  game.player.y=loader._lastOffsetY-(p[1]-loader._lastCenterLat)*111320*3;
  game.player.speed=0;game.player.vx=game.player.vy=0;
  vm.sync=()=>{};
  map.jumpTo({center:p,zoom:18,pitch:60,bearing:110});
  return {sample:service.sample(p),status:service.status(),terrain:map.getTerrain()};
 },point);
 expect(report.terrain.source).toBe('amsterdam-ground-dem');expect(report.status.datum).toBe('NAP');
 expect(report.sample.heightM).toBeGreaterThan(-10);expect(report.sample.heightM).toBeLessThan(10);
 await page.waitForTimeout(4000);
 await waitForSurfaces(page);
 const dir=resolve('artifacts/elevation',testInfo.project.name);mkdirSync(dir,{recursive:true});
 await page.screenshot({path:resolve(dir,'terrain-scene.png')});
 await expect.poll(()=>page.evaluate(()=>(window as any).canalRecallGame.vectorMap._measuredBridges?.ready),{timeout:30000}).toBe(true);
 const bridges=await page.evaluate(()=>(window as any).canalRecallGame.vectorMap._measuredBridges.bridges.map((b:any)=>({id:b.id,origin:b.origin,point:b.samples.find((s:any)=>s.s>(b.deckRangeM[0]+b.deckRangeM[1])/2).point})));
 for(const bridge of bridges){
  const center:[number,number]=[bridge.origin[0]+bridge.point[0]/(111320*Math.cos(bridge.origin[1]*Math.PI/180)),bridge.origin[1]+bridge.point[1]/111320];
  await page.evaluate(p=>{const map=(window as any).canalRecallGame.vectorMap.map;map.jumpTo({center:p.center,zoom:20,pitch:60,bearing:p.bearing});},{center,bearing:bridge.id==='BRU0065'?60:120});
  await expect.poll(()=>page.evaluate(id=>(window as any).canalRecallGame.vectorMap._measuredBridges.activeIds.has(id),bridge.id),{timeout:30000}).toBe(true);
  await page.waitForTimeout(2000);
  await waitForSurfaces(page);
  await page.screenshot({path:resolve(dir,bridge.id+'-bank-a.png')});
  await page.evaluate(bearing=>{(window as any).canalRecallGame.vectorMap.map.setBearing(bearing);},bridge.id==='BRU0065'?240:300);
  await page.waitForTimeout(1000);
  await waitForSurfaces(page);
  await page.screenshot({path:resolve(dir,bridge.id+'-bank-b.png')});
 }
 const riding=await page.evaluate(async()=>{
  const game=(window as any).canalRecallGame,vm=game.vectorMap,loader=game.osmLoader,reports:any[]=[];
  game.state=6;
  for(const bridge of vm._measuredBridges.bridges){
   vm.map.jumpTo({center:bridge.origin,zoom:19,pitch:60,bearing:120});
   await new Promise(r=>setTimeout(r,700));
   const points=bridge.samples.filter((_:any,i:number)=>i%3===0);
   const poses:any[]=[];
   for(const point of points){
    const p=[bridge.origin[0]+point.point[0]/(111320*Math.cos(bridge.origin[1]*Math.PI/180)),bridge.origin[1]+point.point[1]/111320];
    game.player.x=loader._lastOffsetX+(p[0]-loader._lastCenterLng)*111320*Math.cos(loader._lastCenterLat*Math.PI/180)*3;
    game.player.y=loader._lastOffsetY-(p[1]-loader._lastCenterLat)*111320*3;
    game.player.angle=Math.atan2(-bridge.deckAxis[1],bridge.deckAxis[0]);
    vm.setPlayerBike(game.player,loader,true,1);
    await new Promise(r=>requestAnimationFrame(r));
    poses.push({station:point.s,altitude:vm._playerBike.altitudeM,pitch:vm._playerBike.surfacePitch,bridgeHeight:vm._measuredBridges.heightAt(p),ground:vm._elevation.heightAt(p)});
   }
   reports.push({id:bridge.id,poses});
  }
  game.state=4;return reports;
 });
 writeFileSync(resolve(dir,'riding.json'),JSON.stringify(riding,null,2));
 for(const report of riding){expect(report.poses.every((p:any)=>Number.isFinite(p.altitude)&&Number.isFinite(p.pitch))).toBe(true);expect(report.poses.some((p:any)=>p.bridgeHeight!==null)).toBe(true);}
 const performanceReport=await page.evaluate(async()=>{
  const game=(window as any).canalRecallGame,vm=game.vectorMap,map=vm.map,phases:any[]=[];
  const frame=()=>new Promise<number>(r=>requestAnimationFrame(r));
  for(const enabled of [false,true,false,true]) {
   vm._measuredBridges.setEnabled(enabled);vm._elevation.setEnabled(enabled);
   await new Promise(r=>setTimeout(r,1800));
   if(enabled){const deadline=Date.now()+30000;while(!vm._elevation.surfaces.status().geometryReady){if(Date.now()>deadline)throw Error('Visible water/terrain geometry did not become ready');await new Promise(r=>setTimeout(r,50));}}
   const tasks:number[]=[];const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())tasks.push(entry.duration);});observer.observe({type:'longtask'});
   const samples:number[]=[];let before=await frame();
   // Actual gameplay scene, camera panning around a stationary rider.
   for(let i=0;i<150;i++){map.setBearing(120+i*.35);const now=await frame();samples.push(now-before);before=now;}
   observer.disconnect();samples.sort((a,b)=>a-b);
   phases.push({enabled,p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),longTasks:tasks});
  }
  return {phases,bridges:{active:[...vm._measuredBridges.activeIds],triangles:vm._measuredBridges.debugTriangles,bytes:vm._measuredBridges.debugGeometryBytes,errors:vm._measuredBridges.errors}};
 });
 writeFileSync(resolve(dir,'performance.json'),JSON.stringify(performanceReport,null,2));
 const baseline=performanceReport.phases.filter((p:any)=>!p.enabled).map((p:any)=>p.p95);
 const elevated=performanceReport.phases.filter((p:any)=>p.enabled).map((p:any)=>p.p95);
 expect(Math.max(...elevated)).toBeLessThanOrEqual(Math.max(...baseline)*1.1);
 expect(performanceReport.phases.filter((p:any)=>p.enabled).flatMap((p:any)=>p.longTasks).filter((ms:number)=>ms>50)).toEqual([]);
 await page.screenshot({path:resolve(dir,'stationary-rider-pan.png')});
 const grounding=await page.evaluate(()=>{
  const vm=(window as any).canalRecallGame.vectorMap,building=vm._threeBuildings;
  return building ? [...building.chunks.values()].filter((c:any)=>c.mesh).map((c:any)=>({vertices:c.mesh.geometry.getAttribute('ground')?.count,revision:c.mesh.userData.groundRevision})):[];
 });
 writeFileSync(resolve(dir,'scene-report.json'),JSON.stringify({report,grounding,errors},null,2));
 expect(errors.filter(e=>/ground-elevation|vector-map|three-buildings|pyramidal-roofs|inventory-trees|signature-landmarks/.test(e))).toEqual([]);
 const beforePan=await page.evaluate(()=>{
  const g=(window as any).canalRecallGame,vm=g.vectorMap;vm.map.dragPan.enable();vm.map.touchZoomRotate.enable();
  document.getElementById('gameCanvas')!.style.pointerEvents='none';document.getElementById('vector-map')!.style.pointerEvents='auto';
  return {center:vm.map.getCenter().toArray(),rider:[g.player.x,g.player.y]};
 });
 const size=page.viewportSize()!,start={x:size.width*.6,y:size.height*.55},end={x:size.width*.35,y:size.height*.5};
 if(testInfo.project.name==='iphone'){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}]});await page.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();}
 await expect.poll(()=>page.evaluate(before=>{const c=(window as any).canalRecallGame.vectorMap.map.getCenter();return Math.hypot(c.lng-before[0],c.lat-before[1]);},beforePan.center)).toBeGreaterThan(.00005);
 await waitForSurfaces(page);
 const afterPan=await page.evaluate(()=>{const g=(window as any).canalRecallGame;return {center:g.vectorMap.map.getCenter().toArray(),rider:[g.player.x,g.player.y],surfaces:g.vectorMap._elevation.surfaces.status()};});
 expect(Math.hypot(afterPan.rider[0]-beforePan.rider[0],afterPan.rider[1]-beforePan.rider[1])).toBeLessThan(.01);
 writeFileSync(resolve(dir,'input-pan.json'),JSON.stringify({beforePan,afterPan},null,2));
 await page.screenshot({path:resolve(dir,'input-pan.png')});
 await page.evaluate(()=>{const service=(window as any).canalRecallGame.vectorMap._elevation;service.setEnabled(false);});
 await expect.poll(()=>page.evaluate(()=>(window as any).canalRecallGame.vectorMap.map.getTerrain())).toBeNull();
 await page.evaluate(()=>{const service=(window as any).canalRecallGame.vectorMap._elevation;service.setEnabled(true);});
 await expect.poll(()=>page.evaluate(()=>(window as any).canalRecallGame.vectorMap.map.getTerrain()?.source)).toBe('amsterdam-ground-dem');
});
