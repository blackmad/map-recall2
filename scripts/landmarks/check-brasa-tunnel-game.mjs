import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const expectedFeatures=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson')).features.length;
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/');
 await page.waitForFunction(n=>window.canalRecallGame?.vectorMap?._parkLandscape?.debugFeatures===n,expectedFeatures,{timeout:60000});
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,{timeout:60000});
 await page.evaluate(()=>canalRecallGame.vectorMap.sync=()=>{});
 fs.mkdirSync('artifacts/parks',{recursive:true});const report=[];
 for(const [name,center,zoom,pitch,mobile]of [
  ['brasa-south',[4.96528,52.30527],18.34,48,false],
  ['brasa-north',[4.9775,52.3102],18.34,48,false],
  ['brasa-overview',[4.9714,52.3077],13.5,0,false],
  ['brasa-mobile',[4.96528,52.30527],18.34,48,true]]) {
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.evaluate(({center,zoom,pitch})=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({center,zoom,pitch,bearing:0});v._completeCity?.followCamera();v._parkLandscape.updateViewport();},{center,zoom,pitch});
  await page.waitForTimeout(4500);
  const before=await page.evaluate(()=>{const v=canalRecallGame.vectorMap,m=v.map,g=v._parkLandscape;const ids=[...g.tunnelFilters.keys()];for(const [id,r]of g.tunnelFilters)m.setFilter(id,r.original);return {ids,originals:Object.fromEntries([...g.tunnelFilters].map(([id,r])=>[id,r.original]))};});
  assert.equal(before.ids.length,6);await page.waitForTimeout(400);
  const oldRendered=await page.evaluate(ids=>canalRecallGame.vectorMap.map.queryRenderedFeatures({layers:ids}).length,before.ids);
  await page.screenshot({path:`artifacts/parks/${name}-tunnels-before.png`});
  await page.evaluate(()=>{const g=canalRecallGame.vectorMap._parkLandscape;g.tunnelFilters.clear();g.updateTunnelFilters();});
  await page.waitForTimeout(400);
  const after=await page.evaluate(ids=>{const v=canalRecallGame.vectorMap,m=v.map;return {rendered:m.queryRenderedFeatures({layers:ids}).length,filters:Object.fromEntries(ids.map(id=>[id,m.getFilter(id)])),features:v._parkLandscape.debugFeatures,trees:v._inventoryTrees.debugTrees,draws:v._inventoryTrees.meshes.length,tiles:v._inventoryTrees.tiles.size};},before.ids);
  assert.equal(after.features,expectedFeatures);assert.ok(after.rendered<=oldRendered);assert.ok(after.draws<=7&&after.tiles<=12);
  assert.ok(before.ids.every(id=>JSON.stringify(after.filters[id])!==JSON.stringify(before.originals[id])));
  await page.screenshot({path:`artifacts/parks/${name}-tunnels-after.png`});
  await page.evaluate(()=>canalRecallGame.vectorMap._parkLandscape.setEnabled(false));
  assert.deepEqual(await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,canalRecallGame.vectorMap.map.getFilter(id)])),before.ids),before.originals);
  await page.evaluate(()=>canalRecallGame.vectorMap._parkLandscape.setEnabled(true));
  report.push({name,oldRendered,newRendered:after.rendered,features:after.features,trees:after.trees,draws:after.draws,tiles:after.tiles});
 }
 assert.ok(report.some(r=>r.oldRendered>r.newRendered),'actual rendered underground lines must disappear');
 await page.evaluate(()=>canalRecallGame.vectorMap._parkLandscape.load('/data/extracts/utrecht'));
 assert.equal(await page.evaluate(()=>canalRecallGame.vectorMap._parkLandscape.tunnelFilters.size),0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('artifacts/parks/brasa-tunnel-game-report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors}));
} finally {await browser.close();}
