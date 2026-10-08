import {chromium,devices} from 'playwright';
import fs from 'node:fs';
const label=process.argv[2]||'after';const out=`artifacts/fatih-side-texture/${label}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={date:new Date().toISOString(),scope:'actual scene diagnostic camera, stationary rider; desktop/emulated touch',views:[],errors:[]};
try{
for(const device of ['desktop','touch']){
 const context=await browser.newContext(device==='touch'?devices['iPhone 13']:{viewport:{width:1440,height:900}}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push({device,error:e.message}));
 if(label==='before'){await page.route('**/three-buildings.bundle.js*',r=>r.fulfill({path:'artifacts/fatih-side-texture/baseline-three.js',contentType:'application/javascript'}));await page.route('**/three-buildings-worker.bundle.js*',r=>r.fulfill({path:'artifacts/fatih-side-texture/baseline-worker.js',contentType:'application/javascript'}));}
 await page.goto('http://127.0.0.1:5227/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.routePois?.some(p=>/fatih/i.test(p.name)),null,{timeout:180000});
 const poi=await page.evaluate(()=>canalRecallGame.routePois.find(p=>/fatih/i.test(p.name)));
 if(!poi)throw Error('Fatih selectable destination missing');
 await page.locator('#poi-destination').selectOption(poi.id);
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 await page.evaluate(()=>canalRecallGame.vectorMap.setBuildingLook('photo'));
 await page.waitForFunction(()=>canalRecallGame.vectorMap._completeCity&&canalRecallGame.vectorMap._threeBuildings,null,{timeout:120000});
 await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap;g.state=6;g._renderPaused=()=>{};g.player.vx=g.player.vy=g.player.speed=0;v.sync=()=>{};v._completeCity?.setSuspended(false);v.setActiveLandmark(null);});
 for(const [look,bearing] of [['photo',68],['photo',248],['untextured',68],['photo',68]]){
  await page.evaluate(async({look,bearing})=>{const v=canalRecallGame.vectorMap;await v._threeBuildings.setLook(look);v.map.jumpTo({center:[4.87849,52.37322],zoom:18.5,pitch:60,bearing});v._completeCity?.followCamera();},{look,bearing});
  await page.waitForTimeout(2500);
  await page.waitForFunction(()=>{const b=canalRecallGame.vectorMap._threeBuildings;return b.ready&&!b.pending.length&&!b.inflight.size&&b.lastFeatures.some(f=>f.properties.id==='NL.IMBAG.Pand.0363100012167944')},null,{timeout:120000});
  const frames=await page.evaluate(async()=>{const out=[];let prev=performance.now();for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const now=performance.now();out.push(now-prev);prev=now}return out});
  const proof=await page.evaluate(()=>{const g=canalRecallGame,b=g.vectorMap._threeBuildings;return{look:b.look,stats:b.stats(),resident:b.lastFeatures.length,fatih:b.lastFeatures.find(f=>f.properties.id==='NL.IMBAG.Pand.0363100012167944'),rider:[g.player.x,g.player.y],neighbours:b.lastFeatures.filter(f=>f.properties.id!=='NL.IMBAG.Pand.0363100012167944').map(f=>f.properties.id).slice(0,20)}});
  const path=`${out}/${device}-${report.views.length}-${look}-${bearing}.png`;await page.screenshot({path});report.views.push({device,bearing,path,proof,frames});
 }
 await context.close();
}
report.completed=true;
}catch(e){report.errors.push(e.stack);console.error(e)}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({completed:report.completed,views:report.views.length,errors:report.errors}));}
