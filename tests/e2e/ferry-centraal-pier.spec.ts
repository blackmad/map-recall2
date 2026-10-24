import { test, expect } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Feedback 05a7d02a (build d4b76e2, 2026-10-23): riding from De Ruijterkade to
// OBA Van der Pek, the rider followed the planned line to the tip of the
// Centraal ferry pier and stayed a bike. Ride the planned line headlessly and
// require boarding the F3 ferry at Centraal.
test('a route from De Ruijterkade to OBA Van der Pek boards the F3 ferry at the Centraal pier', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  test.setTimeout(300000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame),{timeout:90000}).toBe(true);
  await setHiddenSelect(page,'travel-mode','car');
  await setHiddenSelect(page,'view-mode','chase');
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    g._launchPoiRoute({id:'ferry-test-ruijterkade',name:'De Ruijterkade test',lat:52.3807,lng:4.8995},
      {id:'lm-extract_landmarks_132707368',name:'OBA Van der Pek',lat:52.3909375,lng:4.9117961},{explicitDestination:true});
  });
  await expect.poll(()=>page.evaluate(()=>{
    const g=(window as any).canalRecallGame; return !!(g.player && g.routePath && g.routePath.length>1);
  }),{timeout:120000}).toBe(true);
  const plan = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    g.state=4; g._updateCanalQuiz=()=>{}; g._updateBridgeQuiz=()=>{};
    const stop=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink.from;
    const path=g.routePath, i=path.findIndex((p:any)=>Math.hypot(p.x-stop.x,p.y-stop.y)<1);
    return {stop:stop.name, throughStop:i>=0, next:i>=0&&path[i+1]?{x:+path[i+1].x.toFixed(1),y:+path[i+1].y.toFixed(1),
      metres:+(Math.hypot(path[i+1].x-stop.x,path[i+1].y-stop.y)/3).toFixed(1)}:null};
  });
  console.log('PLAN', JSON.stringify(plan));
  // The planned crossing leaves from the stop itself and heads out over the
  // water, not along the pier (the GTFS berth manoeuvre).
  expect(plan.throughStop, 'planned route passes through the Centraal F3 stop').toBe(true);
  expect(plan.next!.metres).toBeGreaterThan(30);
  // Ride the planned line: hold forward and pure-pursue a point 5 m ahead on it.
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, W=window as any, F=W.CanalRecallFerry;
    const stop=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink.from;
    let along=0;
    const steer=()=>{
      const p=g.player, path=g.routePath;
      if (!p||!path||p.ferryOrigin) return;
      let acc=0, best=Infinity, bestAlong=along;
      for (let i=1;i<path.length;i++) {
        const a=path[i-1], b=path[i], dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1;
        if (acc+len>=along-5&&acc<=along+60) {
          const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(len*len)));
          const d=Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
          if (d<best) { best=d; bestAlong=acc+u*len; }
        }
        acc+=len;
      }
      along=Math.max(along,bestAlong);
      let target=path[path.length-1], acc2=0;
      for (let i=1;i<path.length;i++) {
        const a=path[i-1], b=path[i], len=Math.hypot(b.x-a.x,b.y-a.y)||1;
        if (acc2+len>=along+15) { const u=(along+15-acc2)/len; target={x:a.x+u*(b.x-a.x),y:a.y+u*(b.y-a.y)}; break; }
        acc2+=len;
      }
      p.angle=Math.atan2(target.y-p.y,target.x-p.x);
      // Diagnostics at the closest approach to the stop.
      const d=Math.hypot(p.x-stop.x,p.y-stop.y);
      if (d<(W.__pierClosest?.metres??Infinity)*3) {
        const road=g.track.getNearestRoad(p.x,p.y,p.angle), seg=road?g.track.segments[road.segIdx]:null;
        const shore=F.nearestWater(stop,(x:number,y:number)=>g.vectorMap.isWater(x,y,g.osmLoader));
        const delta=shore?.angle==null?null:Math.abs(Math.atan2(Math.sin(p.angle-shore.angle),Math.cos(p.angle-shore.angle)));
        W.__pierClosest={metres:+(d/3).toFixed(2),segment:seg?.type,shoreMetres:shore?shore.distance/3:null,
          headingDeltaDeg:delta==null?null:+(delta*180/Math.PI).toFixed(1),speed:+p.speed.toFixed(1)};
      }
    };
    const handle=g.player.handleInput.bind(g.player);
    g.player.handleInput=(input:any)=>{ steer(); return handle(input); };
  });
  await page.keyboard.down('ArrowUp');
  const boarded = await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame.player.ferryOrigin),{timeout:150000})
    .toBe(true).then(()=>true,()=>false);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    return {isBoat:!!p.isBoat,origin:p.ferryOrigin?.name??null,destinations:p.ferryDestinations,closest:(window as any).__pierClosest};
  });
  console.log('BOARDING', JSON.stringify(after));
  await page.screenshot({path:testInfo.outputPath('centraal-pier.png')});
  expect(boarded, `rider boarded at the Centraal pier ${JSON.stringify(after.closest)}`).toBe(true);
  expect(after).toMatchObject({isBoat:true,origin:'Centraal Station',destinations:'Buiksloterweg'});
});

// Issue #54 (2026-10-24): "this whole dock should let me turn into a boat".
// The Centraal F3 and F4 stops sit 41 m apart with two more berth ramps
// between them. Ride up a middle ramp, well away from both stops, towards the
// water and require boarding there.
test('riding to the Centraal pier edge between the F3 and F4 stops boards a ferry', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame),{timeout:90000}).toBe(true);
  await setHiddenSelect(page,'travel-mode','car');
  await setHiddenSelect(page,'view-mode','chase');
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    g._launchPoiRoute({id:'ferry-test-ruijterkade',name:'De Ruijterkade test',lat:52.3807,lng:4.8995},
      {id:'lm-extract_landmarks_132707368',name:'OBA Van der Pek',lat:52.3909375,lng:4.9117961},{explicitDestination:true});
  });
  await expect.poll(()=>page.evaluate(()=>{
    const g=(window as any).canalRecallGame; return !!(g.player && g.routePath && g.routePath.length>1);
  }),{timeout:120000}).toBe(true);
  // The ramp: a land segment ending on the quay line between the two stops,
  // in the middle 40% and at least 8 m from either stop.
  const setup = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    g.state=4; g._updateCanalQuiz=()=>{}; g._updateBridgeQuiz=()=>{};
    const f3=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink.from;
    const f4=g.track.segments.filter((s:any)=>s.type==='ferry-access').map((s:any)=>s.ferryTerminal)
      .find((t:any)=>t.id!==f3.id&&Math.hypot(t.x-f3.x,t.y-f3.y)<240);
    const dx=f3.x-f4.x, dy=f3.y-f4.y, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    const coords=(p:any)=>({u:((p.x-f4.x)*ux+(p.y-f4.y)*uy)/len, off:Math.abs((p.x-f4.x)*-uy+(p.y-f4.y)*ux)/3});
    let ramp:any=null;
    for (const s of g.track.segments) {
      if (s.type==='ferry'||s.type==='ferry-access'||!s.points||s.points.length<2) continue;
      for (const [end,from] of [[s.points[s.points.length-1],s.points[s.points.length-2]],[s.points[0],s.points[1]]]) {
        const c=coords(end), stopGap=Math.min(Math.hypot(end.x-f3.x,end.y-f3.y),Math.hypot(end.x-f4.x,end.y-f4.y))/3;
        if (c.u<0.3||c.u>0.7||c.off>4||stopGap<8) continue;
        const run=Math.hypot(end.x-from.x,end.y-from.y)/3;
        if (run<4) continue;
        if (!ramp||c.off<ramp.off) ramp={end:{x:end.x,y:end.y},from:{x:from.x,y:from.y},off:c.off,u:c.u,stopGap,type:s.type};
      }
    }
    if (ramp) {
      const p=g.player, a=Math.atan2(ramp.end.y-ramp.from.y,ramp.end.x-ramp.from.x);
      p.x=ramp.from.x; p.y=ramp.from.y; p.angle=a; p.speed=0; p.vx=0; p.vy=0;
      (window as any).__ramp={...ramp,angle:a,f3:{x:f3.x,y:f3.y},f4:{x:f4.x,y:f4.y},closest:Infinity};
      const handle=g.player.handleInput.bind(g.player);
      g.player.handleInput=(input:any)=>{
        const R=(window as any).__ramp, q=g.player;
        if (!q.ferryOrigin) {
          q.angle=R.angle;
          R.closest=Math.min(R.closest,Math.hypot(q.x-R.f3.x,q.y-R.f3.y)/3,Math.hypot(q.x-R.f4.x,q.y-R.f4.y)/3);
          R.last={x:+q.x.toFixed(1),y:+q.y.toFixed(1),speed:+q.speed.toFixed(1)};
        }
        return handle(input);
      };
    }
    return {stops:[f3.name,f4.name],gapMetres:+(len/3).toFixed(1),ramp};
  });
  console.log('RAMP', JSON.stringify(setup));
  expect(setup.ramp, 'a berth ramp ends on the quay between the stops').toBeTruthy();
  await page.keyboard.down('ArrowUp');
  const boarded = await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame.player.ferryOrigin),{timeout:30000})
    .toBe(true).then(()=>true,()=>false);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player, R=(window as any).__ramp;
    return {isBoat:!!p.isBoat,origin:p.ferryOrigin?.name??null,destinations:p.ferryDestinations,closestStopMetres:+R.closest.toFixed(1),last:R.last};
  });
  console.log('EDGE BOARDING', JSON.stringify(after));
  await page.screenshot({path:testInfo.outputPath('centraal-pier-edge.png')});
  expect(boarded, `rider boarded on the pier edge ${JSON.stringify(after)}`).toBe(true);
  expect(after).toMatchObject({isBoat:true,origin:'Centraal Station'});
  expect(after.closestStopMetres, 'boarded away from both stops').toBeGreaterThan(6);
});
