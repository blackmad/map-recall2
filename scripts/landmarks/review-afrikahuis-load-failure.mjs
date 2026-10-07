import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out='artifacts/afrikahuis-review/load-failure', id='afrikahuis';
const spec=JSON.parse(fs.readFileSync('scripts/landmarks/afrikahuis-spec.json'));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={browser:browser.version(),executable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',asset:'09ff3adba973233b03ab2f7a1dddd4b6a21b85e9fd603658c66273c1042a0fc7',date:new Date().toISOString(),views:[],errors:[],scope:'Actual game native scale; headless desktop and emulated touch; diagnostic cameras separately marked. No physical mobile guarantee.'};
try {
const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(()=>{let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
await page.route('**/afrikahuis.glb*',route=>route.abort('failed'));
await page.goto('http://127.0.0.1:5213/canal-drive/');
await page.waitForFunction(()=>window.canalRecallGame?.routePois?.length,null,{timeout:180000});
await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
await page.locator('#poi-destination').selectOption('lm-'+spec.landmarkId);
await page.locator('#route-card').evaluate(f=>f.requestSubmit());
await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap;g.state=6;g.player.vx=g.player.vy=g.player.speed=0;g.camera.projector=(x,y)=>v.projectWorld(x,y,g.osmLoader,g.canvas);v.sync=()=>{};v._completeCity.setSuspended(false);v.setActiveLandmark(null);});

await page.evaluate(anchor=>{const v=canalRecallGame.vectorMap,m=v.map;m.jumpTo({center:anchor,zoom:18.7,pitch:55,bearing:150});v._completeCity.followCamera();},spec.surveyed.anchor);
await page.waitForFunction(()=>canalRecallGame.vectorMap._signatureLandmarks._failed.has('afrikahuis'),null,{timeout:180000});
await page.waitForTimeout(3000);await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return !b.pending.length&&!b.inflight.size;},null,{timeout:180000});
report.proof=await page.evaluate(s=>{const g=canalRecallGame,v=g.vectorMap,b=v._threeBuildings,l=v._signatureLandmarks;return{failed:l._failed.has(s.id),shown:l.shown.has(s.id),entry:l._entries.some(e=>e.spec.id===s.id),finish:g._finishLandmark()?.id,aliases:s.suppressOsmIds.map(id=>({id,hidden:b.hidden.has(id),drawable:[...b.chunks.values()].some(c=>c.mesh&&c.ranges.has(id)),resident:b.lastFeatures.some(f=>String(f.properties.id)===id)})),pyramids:(v._pyramidalRoofs?._entries??[]).filter(p=>s.suppressOsmIds.includes(String(p.id))).map(p=>({id:p.id,visible:p.mesh.visible}))};},spec);
if(!report.proof.failed||report.proof.shown||report.proof.entry||report.proof.aliases.some(x=>x.hidden)||!report.proof.aliases.some(x=>x.drawable))throw Error('Missing GLB must restore exact ordinary fallback');
await page.screenshot({path:out+'/ordinary-fallback.png'});report.completed=true;
}catch(e){report.errors.push(e.stack);console.error(e);}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log('browser closed');}
