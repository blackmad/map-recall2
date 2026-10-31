import { test, expect } from '@playwright/test';

// Every IJ ferry pier: board the way a player does (stand at the stop facing
// the water, roll forward), hold forward with the real controller for 12 s,
// and the vessel must get well clear of the pier. 2026-10-31: ferries
// dead-stopped 16 m out at Zamenhofstraat (bow into the inlet quay) and
// Pontsteiger (hull driven onto the quay) and against the Buiksloterweg point,
// with no way free (travel.ts openWaterHeading, wetterSide, the pier
// exemption). Keyboard (relative) and the phone's street-follow controls.
for (const mode of ['relative', 'street'] as const) {
  test(`ferry launch at every pier (${mode})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    test.setTimeout(600000);
    await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
    await page.goto('/canal-drive/?ferry=F3');
    await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame?.player),{timeout:90000}).toBe(true);
    await page.evaluate((mode)=>{
      const g=(window as any).canalRecallGame;
      g.state=4; g._updateCanalQuiz=()=>{}; g._updateBridgeQuiz=()=>{};
      g.track.getDistanceToFinish=()=>1e9;
      g.player.controlMode=mode; if (g.input.setPadMode) g.input.setPadMode(mode);
      const rt=(window as any).CanalRecallFerryTravel; const orig=rt.afterMove.bind(rt);
      (window as any).__lastMove=null;
      rt.afterMove=(game:any,prev:any)=>{ const r=orig(game,prev); (window as any).__lastMove=r; return r; };
    }, mode);
    const terminals: string[] = await page.evaluate(()=>{
      const g=(window as any).canalRecallGame; const seen=new Map();
      for (const s of g.track.segments) if (s.ferryLink) { seen.set(s.ferryLink.from.id,1); seen.set(s.ferryLink.to.id,1); }
      return [...seen.keys()];
    });
    const results:any[] = [];
    for (const id of terminals) {
      const placed = await page.evaluate(async (id)=>{
        const g=(window as any).canalRecallGame, p=g.player, F=(window as any).CanalRecallFerry;
        const t=g.track.segments.flatMap((s:any)=>s.ferryLink?[s.ferryLink.from,s.ferryLink.to]:[]).find((t:any)=>t.id===id);
        if (p.ferryOrigin) F.disembark(p, p.ferryOrigin);
        g.state=4;
        p.x=t.x; p.y=t.y; p.angle=Math.atan2(t.y-t.land.y,t.x-t.land.x); p.speed=0; p.vx=0; p.vy=0;
        g.camera.x=p.x; g.camera.y=p.y;
        const isWater=(x:number,y:number)=>g.vectorMap.isWater(x,y,g.osmLoader);
        let shore=null;
        for (let i=0;i<30 && !shore;i++){ await new Promise(r=>setTimeout(r,300)); shore=F.nearestWater(t,isWater); }
        if (!shore) return {id,name:t.name,shore:null};
        p.angle=shore.angle ?? p.angle; p.speed=20; p.vx=Math.cos(p.angle)*20; p.vy=Math.sin(p.angle)*20;
        return {id,name:t.name,shore:shore.distance,lngLat:g.vectorMap.worldToLngLat(t.x,t.y,g.osmLoader)};
      }, id);
      if (placed.shore===null) { results.push({...placed, boarded:false}); continue; }
      await page.keyboard.down('ArrowUp');
      const samples:any[]=[]; const t0=Date.now();
      while (Date.now()-t0 < 12000) {
        samples.push(await page.evaluate(()=>{
          const g=(window as any).canalRecallGame, p=g.player, o=p.ferryOrigin, F=(window as any).CanalRecallFerry;
          const isWater=(x:number,y:number)=>g.vectorMap.isWater(x,y,g.osmLoader);
          const hx=Math.cos(p.angle), hy=Math.sin(p.angle), L=(p.length||96)/2, W=0.8*(p.width||27)/2;
          const bow={x:p.x+hx*L,y:p.y+hy*L};
          const edge=[bow,{x:bow.x-hy*W,y:bow.y+hx*W},{x:bow.x+hy*W,y:bow.y-hx*W}].map(q=>isWater(q.x,q.y)?1:0);
          return {x:Math.round(p.x),y:Math.round(p.y),speed:Math.round(p.speed),boat:!!p.isBoat,dist:o?Math.round(Math.hypot(p.x-o.x,p.y-o.y)/3):null,
            unarmed:p.ferryUnarmed,nearest:p.ferryNearest?{n:p.ferryNearest.name,d:Math.round(p.ferryNearest.distance/3)}:null,
            water:isWater(p.x,p.y),edge,move:(window as any).__lastMove,state:g.state,
            lngLat:g.vectorMap.worldToLngLat(p.x,p.y,g.osmLoader).map((v:number)=>+v.toFixed(5))};
        }));
        await page.waitForTimeout(500);
      }
      await page.keyboard.up('ArrowUp');
      const last=samples[samples.length-1], prev=samples[samples.length-5]||samples[0];
      const boarded=samples.some(s=>s.boat);
      const stalled=boarded && last.boat && Math.hypot(last.x-prev.x,last.y-prev.y)<3;
      const maxDist=Math.max(...samples.map(s=>s.dist??0));
      await page.screenshot({path:testInfo.outputPath(`${stalled?'stall':'clear'}-${placed.name.replace(/\W+/g,'_')}-${id}.png`)});
      results.push({...placed,boarded,stalled,maxDist,last,trail:samples.map(s=>`${s.dist}/${s.speed}/${s.move}${s.water?'':'!'}${s.edge.join('')}`).join(' ')});
    }
    for (const r of results) console.log('PROBE '+JSON.stringify(r));
    const stuck = results.filter(r=>!r.boarded || r.stalled || r.maxDist < 100).map(r=>`${r.name} (${r.id}): boarded ${r.boarded}, stalled ${r.stalled}, ${r.maxDist} m`);
    expect(stuck, 'piers where the vessel did not get 100 m clear').toEqual([]);
  });
}
