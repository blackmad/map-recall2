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
