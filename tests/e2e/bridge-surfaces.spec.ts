import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';

test('bridge demo combines the collection, Jordaan evidence and game',async({page},testInfo)=>{
  await page.goto('/canal-drive/bridge-demo.html');
  await expect(page.locator('#ready')).toHaveText(/\d+/);
  const gallery=page.frameLocator('#demo-content');
  await expect(gallery.locator('#status')).toHaveText('Native scale · measured deck profile');
  await page.locator('[data-gallery="BRU0065"]').click();
  await expect(gallery.locator('#bridge option:checked')).toContainText('Berensluis');
  await page.screenshot({path:testInfo.outputPath('bridge-demo-gallery.png')});
  await page.locator('[data-matching="BRU0102"]').click();
  await expect(gallery.locator('#title')).toContainText('102');
  await expect(gallery.locator('#diagnosis')).toContainText('matched');
  await page.screenshot({path:testInfo.outputPath('bridge-demo-matching.png')});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#tab-game')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('bridge-demo-mobile.png')});
  await page.locator('#tab-game').click();
  await expect(page.locator('#demo-content')).toHaveAttribute('src','index.html');
  await expect(page.locator('#open-view')).toHaveAttribute('href','index.html');
});

test('unmatched Jordaan map separates routing and bridge catalogue evidence',async({page},testInfo)=>{
  await page.goto('/canal-drive/unmatched-bridges.html');
  await page.waitForFunction(()=>(window as any).unmatchedReviewReady);
  await page.waitForTimeout(900);
  await expect(page.locator('#title')).toContainText('130');
  await expect(page.locator('#diagnosis')).not.toBeEmpty();
  await expect(page.locator('#facts')).toContainText('Current status');
  await page.screenshot({path:testInfo.outputPath('trapjesbrug-unmatched.png')});
  for(const[id,file]of [['BRU0102','looiersgracht-unmatched.png'],['BRU0155','kattensloot-unmatched.png']]){
    await page.locator(`#cards button[data-id="${id}"]`).click();
    await page.waitForTimeout(700);
    await page.screenshot({path:testInfo.outputPath(file)});
  }
  await page.locator('#overview').click();await page.waitForTimeout(700);
  await page.screenshot({path:testInfo.outputPath('jordaan-unmatched-overview.png')});
  await page.locator('#catalog').uncheck();
  expect(await page.evaluate(()=>(window as any).unmatchedReview.map.getLayoutProperty('catalog-lines','visibility'))).toBe('none');
});

test('measured bridge pilot renders and the live bike follows its surface',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','shared rendering and pose code');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'&&/layers\.|within|filter/.test(msg.text()))errors.push(msg.text());});
  await page.addInitScript(() => { history.replaceState(null, '', location.pathname + '?bridges3d=1'); });
  await openRoute(page,{travelMode:'car',viewMode:'chase'});
  await page.waitForFunction(()=>{
    const vm=(window as any).canalRecallGame.vectorMap;
    return vm._bridgeSurfaces?.ready&&vm._playerBike?.ready;
  });
  const report=await page.evaluate(()=>{
    const game=(window as any).canalRecallGame,vm=game.vectorMap,layer=vm._bridgeSurfaces;
    game.state=6; // isolate the render/pose integration from simulated motion
    const loader=game.osmLoader;
    const pose=(ll:number[],angle:number)=>{
      game.player.x=loader._lastOffsetX+(ll[0]-loader._lastCenterLng)*111320*Math.cos(loader._lastCenterLat*Math.PI/180)*3;
      game.player.y=loader._lastOffsetY-(ll[1]-loader._lastCenterLat)*111320*3;
      game.player.angle=angle;
      vm.setPlayerBike(game.player,loader,true,1);
      return{height:vm._playerBike.altitudeM,pitch:vm._playerBike.surfacePitch};
    };
    const rows=layer.bridges.filter((b:any)=>['BRU0057','BRU0059','BRU0065','BRU0005','BRU0035'].includes(b.id)).map((b:any)=>{
      const crest=b.samples.reduce((a:any,c:any)=>c.heightM>a.heightM?c:a);
      const ll=[b.origin[0]+crest.point[0]/(111320*Math.cos(b.origin[1]*Math.PI/180)),b.origin[1]+crest.point[1]/111320];
      vm.map.jumpTo({center:ll,zoom:19.3});
      const p=pose(ll,Math.atan2(-b.deckAxis[1],b.deckAxis[0]));
      const angle=Math.atan2(-b.deckAxis[1],b.deckAxis[0]);
      const expected=layer.sample(ll,angle,vm._playerBike.surfaceContactOffsets()).heightM+.22;
      return{id:b.id,expected,...p};
    });
    const ground=pose([4.9,52.37],0);
    const b=layer.bridges[0],station=b.samples.find((p:any)=>p.s>b.roadwayRangeM[0]+3);
    const ll=[b.origin[0]+station.point[0]/(111320*Math.cos(b.origin[1]*Math.PI/180)),b.origin[1]+station.point[1]/111320];
    const angle=Math.atan2(-b.deckAxis[1],b.deckAxis[0]);
    vm.map.jumpTo({center:ll,zoom:19.3});
    const forward=pose(ll,angle),reverse=pose(ll,angle+Math.PI);
    layer.setEnabled(false);const disabled=pose(ll,angle);layer.setEnabled(true);
    vm.setPlayerBoat(game.player,loader,true);const boatAltitude=vm._playerBoat.altitudeM;
    return{rows,ground,forward,reverse,disabled,boatAltitude,triangles:layer.debugTriangles,bytes:layer.debugGeometryBytes,cached:layer.cached.size,active:layer.activeIds.size};
  });
  expect(report.rows).toHaveLength(5);
  for(const row of report.rows){expect(row.height,row.id).toBeCloseTo(row.expected,2);expect(row.height,row.id).toBeGreaterThan(.5);}
  expect(report.ground.height).toBe(.22);expect(report.ground.pitch).toBe(0);
  expect(report.forward.pitch).toBeGreaterThan(.015);
  expect(report.reverse.pitch).toBeLessThan(-.015);
  expect(report.disabled.height).toBe(.22);expect(report.boatAltitude).toBe(.22);
  expect(report.triangles).toBeLessThan(350000);expect(report.bytes).toBeLessThan(16000000);
  expect(report.cached).toBeLessThanOrEqual(24);expect(report.active).toBeLessThanOrEqual(12);
  for(const id of ['BRU0057','BRU0059','BRU0065']){
    await page.evaluate(id=>{
      const g=(window as any).canalRecallGame,vm=g.vectorMap,b=vm._bridgeSurfaces.bridges.find((b:any)=>b.id===id);
      const crest=b.samples.reduce((a:any,c:any)=>c.heightM>a.heightM?c:a);
      const ll=[b.origin[0]+crest.point[0]/(111320*Math.cos(b.origin[1]*Math.PI/180)),b.origin[1]+crest.point[1]/111320];
      // Keep the game loop from replacing the review camera while paused.
      vm.sync=()=>{};
      vm.setPlayerBike=()=>{};
      vm.setPlayerBoat=()=>{};
      vm.map.jumpTo({center:ll,zoom:19.3,pitch:65,bearing:Math.atan2(b.deckAxis[0],b.deckAxis[1])*180/Math.PI+70});
      vm._playerBike.update(ll,Math.atan2(-b.deckAxis[1],b.deckAxis[0]),false);
      vm._playerBoat.update(ll,0,false);
      vm.map.triggerRepaint();
    },id);
    await expect.poll(()=>page.evaluate(()=> (window as any).canalRecallGame.vectorMap._bridgeSurfaces.debugPaints)).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    await page.screenshot({path:testInfo.outputPath(`${id}.png`)});
    const basemap=await page.evaluate(()=>{
      const map=(window as any).canalRecallGame.vectorMap.map,center=map.getCenter();
      return map.queryRenderedFeatures().filter((f:any)=>f.sourceLayer==='transportation'&&
        JSON.stringify(f.geometry).includes(String(center.lng).slice(0,5)))
        .map((f:any)=>({layer:f.layer.id,id:f.id,properties:f.properties,geometry:f.geometry}));
    });
    const evidence=testInfo.outputPath(`${id}-basemap.json`);writeFileSync(evidence,JSON.stringify(basemap,null,2));
    await testInfo.attach(`${id}-basemap`,{path:evidence,contentType:'application/json'});
  }
  const distant=await page.evaluate(()=>{
    const layer=(window as any).canalRecallGame.vectorMap._bridgeSurfaces;
    (window as any).canalRecallGame.vectorMap.map.jumpTo({center:[4.7,52.5],zoom:19.3});
    return{active:layer.activeIds.size,filters:layer.filters.size,height:layer.sample([4.7,52.5]).heightM,cached:layer.cached.size,bytes:layer.debugGeometryBytes};
  });
  expect(distant.active).toBe(0);expect(distant.filters).toBe(0);expect(distant.height).toBe(0);
  expect(distant.cached).toBeLessThanOrEqual(24);expect(distant.bytes).toBeLessThan(16000000);
  const reset=await page.evaluate(async()=>{
    const layer=(window as any).canalRecallGame.vectorMap._bridgeSurfaces;
    await layer.load('../data/extracts/utrecht');return{ready:layer.ready,bridges:layer.bridges.length,meshes:layer.meshes.length,filters:layer.filters.size};
  });
  expect(reset).toEqual({ready:false,bridges:0,meshes:0,filters:0});
  expect(errors).toEqual([]);
});

test('bridge review page shows all three native-scale models and profiles',async({page},testInfo)=>{
  test.setTimeout(240000); // Capture both banks of the entire masonry cohort.
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/canal-drive/bridge-pilot.html');
  await page.waitForFunction(()=>(window as any).bridgePilotReady);
  expect(await page.locator('#bridge option').count()).toBeGreaterThan(50);
  await expect(page.locator('#review-list li').first()).toBeVisible({visible:false});
  for(const index of ['0','1','2']){
    await page.locator('#bridge').selectOption(index);
    await expect(page.locator('#status')).toHaveText('Native scale · measured deck profile');
    await expect(page.locator('#profile polyline')).toHaveCount(1);
    await page.screenshot({path:testInfo.outputPath(`bridge-${index}-canal.png`)});
    if(index==='0'){
      await page.evaluate(()=>(window as any).bridgePilotReview.hideColour('#817b70'));
      await page.screenshot({path:testInfo.outputPath('bridge-0-without-aprons.png')});
    }
  }
  // Inspect the concave Berensluis joint where the support used to intersect
  // the approach apron. Keep a close view as visual regression evidence.
  const viewport=await page.locator('#viewport').boundingBox();
  await page.mouse.move(viewport!.x+viewport!.width/2,viewport!.y+viewport!.height/2);
  await page.mouse.down();
  await page.mouse.move(viewport!.x+viewport!.width/2+80,viewport!.y+viewport!.height/2+56,{steps:8});
  await page.mouse.up();
  await page.mouse.wheel(0,-350);
  await page.waitForTimeout(200);
  await page.screenshot({path:testInfo.outputPath('berensluis-joint.png')});
  await page.locator('[data-view="road"]').click();
  await page.screenshot({path:testInfo.outputPath('road.png')});
  await page.locator('#search').fill('Joes Kloppenburg');
  await expect(page.locator('#bridge option')).toHaveCount(1);
  await expect(page.locator('#bridge option')).toContainText('Joes Kloppenburg');
  await page.locator('#search').fill('2474');
  await expect(page.locator('#bridge option')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('concrete-deck.png')});
  await page.locator('#search').fill('');
  const reviewIds=await page.evaluate(()=>(window as any).bridgePilotReview.bridges.filter((b:any)=>b.family==='masonry-arch').map((b:any)=>b.id));
  const thumbnails:{input:Buffer;left:number;top:number}[]=[];
  for(const [index,id]of reviewIds.entries())for(const [viewIndex,view]of ['low','opposite'].entries()){
    await page.evaluate(({id,view})=>(window as any).bridgePilotReview.show(id,view),{id,view});
    await page.waitForTimeout(40);
    const capture=await page.locator('#viewport').screenshot();
    const tile=index*2+viewIndex;
    thumbnails.push({input:await sharp(capture).resize(300,180).png().toBuffer(),left:(tile%6)*300,top:Math.floor(tile/6)*200});
    thumbnails.push({input:Buffer.from(`<svg width="300" height="20"><text x="8" y="15" font-size="13">${id} · ${view}</text></svg>`),left:(tile%6)*300,top:Math.floor(tile/6)*200+180});
  }
  await sharp({create:{width:1800,height:Math.ceil(reviewIds.length*2/6)*200,channels:3,background:'#eef1ee'}}).composite(thumbnails).png().toFile(testInfo.outputPath('all-masonry-review.png'));
  const woodenIndex=await page.evaluate(async()=>{const response=await fetch('../data/extracts/amsterdam/bridge-surfaces.json');const data=await response.json();return data.bridges.findIndex((b:any)=>b.family==='wooden-deck');});
  expect(woodenIndex).toBeGreaterThanOrEqual(0);
  await page.locator('#bridge').selectOption(String(woodenIndex));
  await page.locator('[data-view="canal"]').click();
  await page.screenshot({path:testInfo.outputPath('wooden-deck.png')});
  await page.locator('summary').click();
  await expect(page.locator('#review-list li').first()).toBeVisible();
  expect(errors).toEqual([]);
});


test('normal game visits do not load the bridge experiment',async({page})=>{
  const requested:string[]=[];
  page.on('request',request=>{if(/bridge-surfaces\.(?:json|bundle\.js)/.test(request.url()))requested.push(request.url());});
  // A stored setting from an earlier pilot must not turn the experiment back on.
  await page.addInitScript(()=>localStorage.setItem('__canalRecallBridges3d','true'));
  await openRoute(page,{enterRacing:false});
  await page.waitForFunction(()=>(window as any).canalRecallGame.vectorMap.ready);
  expect(await page.evaluate(()=>({layer:(window as any).canalRecallGame.vectorMap._bridgeSurfaces,
    enabled:(window as any).canalRecallGame.vectorMap._bridges3dEnabled,
    loaded:Boolean((window as any).CanalRecallBridgeSurfaces)}))).toEqual({layer:null,enabled:false,loaded:false});
  expect(requested).toEqual([]);
});
