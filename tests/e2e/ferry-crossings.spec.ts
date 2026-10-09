import { test, expect } from '@playwright/test';
import { setHiddenSelect } from './helpers';

test('cycling boards an IJ ferry, rejects another pier, and docks at its connected terminal', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame)).toBe(true);
  if (process.env.PW_REQUIRE_SWIFTSHADER) {
    const renderer = await page.evaluate(()=>{
      const map=(window as any).canalRecallGame.vectorMap.map;
      const gl=map.getCanvas().getContext('webgl2');
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    console.log(`Renderer: ${renderer}`);
    expect(renderer).toContain('SwiftShader');
  }
  await setHiddenSelect(page,'travel-mode','car');
  await setHiddenSelect(page,'view-mode','chase');
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    g._launchPoiRoute({id:'ferry-test-south',name:'South test',lat:52.3741,lng:4.8950},
      {id:'ferry-test-noord',name:'Noord test',lat:52.3836,lng:4.9033},{explicitDestination:true});
  });
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame.player),{timeout:90000}).toBe(true);
  await page.evaluate(()=>{(window as any).canalRecallGame.state=4;});
  const touch = testInfo.project.name === 'iphone' ? await page.context().newCDPSession(page) : null;
  const forward = async (held: boolean) => {
    if (!touch) { if (held) await page.keyboard.down('ArrowUp'); else await page.keyboard.up('ArrowUp'); return; }
    if (!held) { await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); return; }
    const c = await page.evaluate(()=>{
      const g=(window as any).canalRecallGame, d=g.input._dpad, v=g.input._viewport, r=g.canvas.getBoundingClientRect();
      g.player.controlMode='relative';
      return {x:r.left+d.cx*r.width/v.width,y:r.top+d.cy*r.height/v.height,delta:(window as any).CanalRecallUi.stickRadius(d)*r.height/v.height};
    });
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x,y:c.y}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x,y:c.y-c.delta}]});
  };
  const inventory = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const links = g.track.segments.filter((s:any)=>s.ferryLink).map((s:any)=>s.ferryLink);
    const f3 = links.find((l:any)=>l.ref==='F3');
    if (!f3) return { refs: links.map((l:any)=>l.ref), boarded: false };
    g.quizPromptName = ''; g._prompt.style.display = 'none'; g.quizCurrentName = '';
    const p = g.player, t = f3.from;
    p.x=t.x; p.y=t.y; p.angle=Math.atan2(t.y-t.land.y,t.x-t.land.x);
    p.speed=20; p.vx=Math.cos(p.angle)*20; p.vy=Math.sin(p.angle)*20;
    g._updateCanalQuiz=()=>{}; g._updateBridgeQuiz=()=>{};
    return {refs:links.map((l:any)=>l.ref), boarded:true, accessLength:Math.hypot(t.x-t.land.x,t.y-t.land.y)};
  });
  expect(inventory.boarded, JSON.stringify(inventory)).toBe(true);
  await forward(true);
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame.player.ferryOrigin)).toBe(true);
  await forward(false);
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame.vectorMap._playerFerry?.ready)).toBe(true);
  // Put the vessel in the middle of its real GTFS crossing for visual review.
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    const link=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink;
    p.x=(link.from.x+link.to.x)/2; p.y=(link.from.y+link.to.y)/2;
    p.angle=Math.atan2(link.to.y-link.from.y,link.to.x-link.from.x);
    p.speed=0;p.vx=0;p.vy=0; p.ferryDeparted=true;
    g.camera.x=p.x;g.camera.y=p.y;
  });
  await page.waitForTimeout(700);
  const state=await page.evaluate(()=>{
    const g=(window as any).canalRecallGame;
    return {ferry:g.vectorMap._playerFerry.visible,bike:g.vectorMap._playerBike.visible,mode:g.travelMode};
  });
  expect(state).toEqual({ferry:true,bike:false,mode:'car'});
  await page.screenshot({path:testInfo.outputPath('ferry-live-crossing.png')});
  // Sail the remaining crossing using the actual controller and keyboard.
  await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    const target=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink.to;
    p.angle=Math.atan2(target.y-p.y,target.x-p.x);
  });
  await forward(true);
  await expect.poll(()=>page.evaluate(()=>!(window as any).canalRecallGame.player.ferryOrigin),{timeout:18000}).toBe(true);
  await forward(false);
  const sailing = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    const link=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink;
    const distance=Math.hypot(p.x-link.to.x,p.y-link.to.y);
    return {distance,dockedOnBike:!g.vectorMap._playerFerry.visible};
  });
  expect(sailing.distance).toBeLessThan(60);
  const result = await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    const runtime=(window as any).CanalRecallFerryTravel;
    const links=g.track.segments.filter((s:any)=>s.ferryLink).map((s:any)=>s.ferryLink);
    const f3=links.find((l:any)=>l.ref==='F3'), unrelated=links.find((l:any)=>l.ref==='F2').to;
    p.ferryOrigin=f3.from;p.ferryDeparted=true;p.isBoat=true;
    // Force an attempted landing at the wrong pier, with a land mask supplied
    // only for this constraint probe. The crossing screenshot uses real water.
    const water=g.vectorMap.isWater;g.vectorMap.isWater=()=>false;
    p.x=unrelated.x;p.y=unrelated.y;
    const previous={x:p.x-8,y:p.y-8};runtime.afterMove(g,previous);
    const rejected=p.x===previous.x&&p.y===previous.y&&!!p.ferryOrigin;
    g.vectorMap.isWater=water;
    const t=f3.to, dx=t.land.x-t.x,dy=t.land.y-t.y;
    p.x=t.x;p.y=t.y;
    runtime.afterMove(g,{x:t.x-dx*.1,y:t.y-dy*.1});
    const docked=!p.ferryOrigin&&!p.isBoat;
    const onLand=Math.hypot(p.x-t.land.x,p.y-t.land.y)<.01;
    const route=g.track.findRoute(f3.from.land,f3.to.land);
    return {rejected,docked,onLand,routePoints:route.length,accessLengths:links.map((l:any)=>({ref:l.ref,from:Math.hypot(l.from.x-l.from.land.x,l.from.y-l.from.land.y),to:Math.hypot(l.to.x-l.to.land.x,l.to.y-l.to.land.y)}))};
  });
  expect(result.rejected).toBe(true);
  expect(result.docked).toBe(true);
  expect(result.onLand).toBe(true);
  expect(result.routePoints).toBeGreaterThan(2);
  await page.waitForTimeout(300);
  await page.screenshot({path:testInfo.outputPath('ferry-live-docked.png')});
  console.log(JSON.stringify({project:testInfo.project.name,...inventory,...result}));
});

test('deterministic ferry link starts at the Centraal F3 land access facing the water', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?ferry=F3');
  await expect.poll(()=>page.evaluate(()=>!!(window as any).canalRecallGame?.player),{timeout:90000}).toBe(true);
  const state=await page.evaluate(()=>{
    const g=(window as any).canalRecallGame, p=g.player;
    const link=g.track.segments.find((s:any)=>s.ferryLink?.ref==='F3').ferryLink;
    return {mode:g.travelMode,view:g.viewMode,destination:g.routeTo.name,
      from:g.routeFrom.name,distance:Math.hypot(p.x-link.from.land.x,p.y-link.from.land.y),
      facingWater:Math.cos(p.angle)*(link.from.x-link.from.land.x)+Math.sin(p.angle)*(link.from.y-link.from.land.y)>0};
  });
  expect(state).toMatchObject({mode:'car',view:'chase',destination:'Buiksloterweg ferry terminal',from:'Centraal Station ferry terminal',facingWater:true});
  expect(state.distance).toBeLessThan(1);
  console.log(JSON.stringify(state));
});
