// End-to-end contract: choose a formerly missing POI, ride, click its actual
// pitched facade, see the sourced card, then click an ordinary neighbouring
// drawable surface without receiving a construction-year card/highlight.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CANAL_REVIEW_URL || 'http://127.0.0.1:5196/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.routePois?.some(p=>p.id==='lm-osm_theatre_2724220323'),{timeout:60000});
 const inventory=await page.evaluate(()=>{const g=canalRecallGame;return {choices:g.routePois.length,missing:['lm-osm_theatre_2724220323','lm-osm_shop_266934444','lm-olvg-west','lm-pontsteiger'].filter(id=>!g.routePois.some(p=>p.id===id)),options:[...g._routeTo.options].filter(o=>/Frascati|Scheltema|OLVG West|Pontsteiger/.test(o.text)).map(o=>[o.value,o.text])}});
 assert.deepEqual(inventory.missing,[]);console.log('DESTINATION INVENTORY',JSON.stringify(inventory));
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.getByRole('radiogroup',{name:'View',exact:true}).getByRole('button',{name:/Chase/}).click();
 await page.selectOption('#poi-destination','lm-osm_theatre_2724220323');
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:90000});
 await page.evaluate(()=>{const g=canalRecallGame,v=g.vectorMap;v.sync=()=>{};g._landmarkNotice=null;v.map.jumpTo({center:[4.893913835356087,52.37036795599974],zoom:18.5,pitch:60,bearing:95});v._completeCity.setSuspended(false);v._completeCity.followCamera();});
 await page.waitForTimeout(8500);
 await page.waitForFunction(()=>{const v=canalRecallGame.vectorMap,b=v._threeBuildings;return v._signatureLandmarks.shown.has('frascati')&&b?.ready&&b.chunks.size&&!b.pending.length&&!b.inflight.size},null,{timeout:90000});
 const result=await page.evaluate(async()=>{
  const g=canalRecallGame,v=g.vectorMap,layer=v._signatureLandmarks,b=v._threeBuildings,T=CanalRecallThree.THREE;
  const lm=g.landmarks.find(l=>l.id==='osm_theatre_2724220323'),pin=(await v.map.getSource('amsterdam-pois').getData()).features.find(f=>f.properties.id===lm.id),finish=g._finishLandmark();
  const e=layer._entries.find(e=>e.spec.id==='frascati'),c=v.map.getCanvas();let target=null;
  e.group.updateWorldMatrix(true,true);
  e.group.traverse(o=>{if(target||!o.isMesh)return;const a=o.geometry.getAttribute('position');for(let i=0;i<Math.min(a.count,36);i+=3){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).applyMatrix4(e.pickProjection),x=(p.x+1)/2*c.clientWidth,y=(1-p.y)/2*c.clientHeight;if(x<0||y<0||x>c.clientWidth||y>c.clientHeight)continue;const hit=v.inspectBuilding(x,y,{width:c.clientWidth,height:c.clientHeight});if(hit?.landmarkId===lm.id){target={x,y,hit};break;}}});
  if(!target)return {error:'No actual Frascati visible mesh sample picked',pin:!!pin,card:lm,finish:finish?.id};
  const rect=g.canvas.getBoundingClientRect();target.clientX=rect.left+target.x/c.clientWidth*rect.width;target.clientY=rect.top+target.y/c.clientHeight*rect.height;
  g.quizFeedback='Follow your route';g._showLandmarkNotice(lm,{kind:'sticky'},'click');v.setActiveLandmark(lm);
  const picked={id:g._landmarkNotice?.id,body:g._landmarkNotice?.detail,source:g._landmarkNotice?.sourceUrl,active:layer.activeLandmarkId};
  const researchLink=g._landmarkNotice.sourceUrl;
  let ordinary=null;
  const beforePick=performance.now();
  for(const f of b.lastFeatures){
   const id=String(f.properties.id),r=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates[0][0];
   if(b.hidden.has(id)||g.landmarks.some(l=>l.buildingIds?.includes(id))||!r.some(p=>Math.abs(p[0]-4.893913835356087)<.001&&Math.abs(p[1]-52.37036795599974)<.001))continue;
   const lng=r.reduce((n,p)=>n+p[0],0)/r.length,lat=r.reduce((n,p)=>n+p[1],0)/r.length;
   const point=new T.Vector3((lng-4.9)*111320*Math.cos(52.37*Math.PI/180),(lat-52.37)*110540,(Number(f.properties.height)||12)*.65).applyMatrix4(b.camera.projectionMatrix),x=(point.x+1)/2*c.clientWidth,y=(1-point.y)/2*c.clientHeight;
   if(x<100||y<100||x>c.clientWidth-100||y>c.clientHeight-100)continue;
   const hit=v.inspectBuilding(x,y,{width:c.clientWidth,height:c.clientHeight});
   if(hit?.id===id&&!hit.landmarkId&&!g._cardForClickedBuilding(hit)){ordinary={x,y,id,clientX:rect.left+x/c.clientWidth*rect.width,clientY:rect.top+y/c.clientHeight*rect.height};break;}
  }
  const diagnosticPickMs=performance.now()-beforePick;

  return {state:g.state,diagnosticPickMs,pin:!!pin,finish:finish?.id,picked,researchLink,ordinary,target,visible:b.chunks.size,manualCount:g.landmarks.filter(l=>l.sourceUrl).length};
 });
 console.log('LIVE PROOF',JSON.stringify(result));assert.equal(result.error,undefined);assert.equal(result.pin,true);assert.equal(result.finish,'osm_theatre_2724220323');assert.equal(result.picked.id,result.finish);assert.match(result.picked.body,/Frascati/);assert.match(result.researchLink,/frascatitheater/);assert(result.ordinary,'real ordinary neighboring surface sampled');assert.equal(result.picked.active,result.picked.id);
 await page.waitForTimeout(300);
 const reproduced=await page.evaluate(()=>({card:canalRecallGame._landmarkCardBounds,notice:canalRecallGame._landmarkNotice?.id,yellow:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId,feedback:!!canalRecallGame.quizFeedback}));assert.equal(reproduced.card,null);assert.equal(reproduced.notice,reproduced.yellow);assert(reproduced.feedback);console.log('REPRODUCED SUPPRESSED CARD',JSON.stringify(reproduced));
 await page.mouse.click(result.target.clientX,result.target.clientY);await page.waitForTimeout(700);
 const visible=await page.evaluate(()=>({card:canalRecallGame._landmarkCardBounds,alpha:canalRecallGame._landmarkNoticeAlpha,gate:canalRecallGame._teachingGate()}));console.log('VISIBLE CARD',JSON.stringify(visible));assert(visible.card,'card actually drawn above game UI');assert(visible.alpha>=.9,'deliberate clicked card immediately readable');
 await page.screenshot({path:'/tmp/manual-poi-contract-live.png'});
 const cardClick=await page.evaluate(()=>{const g=canalRecallGame,r=g.canvas.getBoundingClientRect(),b=g._landmarkCardBounds;return{x:r.left+(b.x+b.w/2)/CANVAS_W*r.width,y:r.top+(b.y+b.h/2)/CANVAS_H*r.height}});await page.mouse.click(cardClick.x,cardClick.y);await page.waitForTimeout(200);
 assert.match(await page.locator('#landmark-panel-title').innerText(),/Frascati/i);assert.match(await page.locator('#landmark-panel-body').innerText(),/Frascati/i);assert.match(await page.locator('#landmark-panel-link').getAttribute('href'),/frascatitheater/);assert(await page.locator('#landmark-panel-body').isVisible());
 await page.screenshot({path:'/tmp/manual-poi-contract-expanded.png'});
 await page.locator('#landmark-panel .utility-close').click();
 await page.mouse.click(result.ordinary.clientX,result.ordinary.clientY);await page.waitForTimeout(1000);
 const empty=await page.evaluate(()=>({card:canalRecallGame._landmarkNotice?.id||null,active:canalRecallGame.vectorMap._signatureLandmarks.activeLandmarkId,cooldown:canalRecallGame.raceTime-canalRecallGame._lastDriveByAt}));assert(empty.cooldown<3,'automatic teaching respects explicit deselection');assert.equal(empty.card,null);assert.equal(empty.active,null);assert.deepEqual(errors,[]);console.log('ORDINARY CLICK',JSON.stringify(empty));console.log('POI CONTRACT BROWSER PASSED',JSON.stringify(errors));
} finally {await browser.close();console.log('CHROMIUM CLOSED');}
