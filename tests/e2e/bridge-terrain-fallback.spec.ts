import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setHiddenSelect} from './helpers';
const profiles=JSON.parse(readFileSync('public/data/extracts/amsterdam/measured-bridges/index.json','utf8')).bridges;
test.use({ignoreHTTPSErrors:true});
test('native bridge roads retain surveyed height without a detailed bridge model',async({page},info)=>{
 test.setTimeout(150000);
 await page.route(/unpkg\.com\/maplibre-gl@5(?:\.24\.0)?\/dist\/maplibre-gl\.js/,r=>r.fulfill({path:resolve('node_modules/maplibre-gl/dist/maplibre-gl.js'),contentType:'application/javascript'}));
 await page.goto('/canal-drive/?terrain=1&bridges3d=0');
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).canalRecallGame?.vectorMap?._elevation?.ready)),{timeout:90000}).toBe(true);
 await setHiddenSelect(page,'travel-mode','car');
 await setHiddenSelect(page,'view-mode','chase');
 await page.locator('#route-card').evaluate((form:HTMLFormElement)=>form.requestSubmit());
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).canalRecallGame?.player?.x)),{timeout:90000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).canalRecallGame;g.state=4;g._updateRacing=()=>{};g.vectorMap.sync=()=>{};g.vectorMap.setPlayerBike=()=>{if(g.vectorMap._playerBike)g.vectorMap._playerBike.visible=false;};});
 const output=resolve('artifacts/elevation/fallback',info.project.name);mkdirSync(output,{recursive:true});
 const reports:any[]=[];
 for(const b of profiles){
  const s=b.samples.reduce((a:any,c:any)=>Math.abs(c.s-(b.deckRangeM[0]+b.deckRangeM[1])/2)<Math.abs(a.s-(b.deckRangeM[0]+b.deckRangeM[1])/2)?c:a);
  const at:[number,number]=[b.origin[0]+s.point[0]/(111320*Math.cos(b.origin[1]*Math.PI/180)),b.origin[1]+s.point[1]/111320];
  await page.evaluate(at=>{const vm=(window as any).canalRecallGame.vectorMap;vm.sync=()=>{};vm.map.jumpTo({center:at,zoom:20,pitch:60,bearing:120});},at);
  await expect.poll(()=>page.evaluate(at=>(window as any).canalRecallGame.vectorMap._elevation.sample(at).quality,at),{timeout:30000}).toBe('bridge');
  await expect.poll(()=>page.evaluate(at=>{const m=(window as any).canalRecallGame.vectorMap.map;const h=m.queryTerrainElevation({lng:at[0],lat:at[1]});return typeof h==='number'&&Math.abs(h)>0.1;},at),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>{const s=(window as any).canalRecallGame.vectorMap._elevation.surfaces.status();return s.geometryReady&&s.visibleMeshes>0&&s.errors.length===0;}),{timeout:60000}).toBe(true);
  await page.waitForTimeout(500);
  const result=await page.evaluate(at=>{const vm=(window as any).canalRecallGame.vectorMap;return {sample:vm._elevation.sample(at),rendered:vm.map.queryTerrainElevation({lng:at[0],lat:at[1]}),modelActive:Boolean(vm._measuredBridges?.activeIds?.size)};},at);
  reports.push({id:b.id,expected:s.surfaceNAP,...result});
  expect(result.modelActive).toBe(false);
  expect(Math.abs(result.rendered-s.surfaceNAP)).toBeLessThan(.5);
  await page.screenshot({path:resolve(output,b.id+'.png')});
 }
 writeFileSync(resolve(output,'report.json'),JSON.stringify(reports,null,2));
});
