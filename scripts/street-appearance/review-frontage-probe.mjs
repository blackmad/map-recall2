import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root='artifacts/street-appearance';
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5196/canal-drive/');
 await page.waitForFunction(()=>Boolean(window.canalRecallGame?.ctx));
 await page.locator('#route-card').waitFor({state:'visible'});
 await page.evaluate(()=>{const g=window.canalRecallGame;const nearest=(lng,lat)=>g.routePois.slice().sort((a,b)=>Math.hypot((a.lng-lng)*.61,a.lat-lat)-Math.hypot((b.lng-lng)*.61,b.lat-lat))[0];g._pickReviewRide=()=>({from:nearest(4.8687372,52.3608814),to:nearest(4.8979412,52.3713544),dueNear:[],alternatives:[]});});
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?.ready===true,null,{timeout:120000});
 await page.waitForFunction(()=>Boolean(window.canalRecallGame.vectorMap._threeBuildings?.appearanceRevision));
 await page.evaluate(async()=>{const v=window.canalRecallGame.vectorMap;v.sync=()=>{};v.setBuildingLook('photo');await v.setBuildingsLook('photo');v.map.jumpTo({center:[4.8979412,52.3713544],zoom:20.5,bearing:116,pitch:80});v._threeBuildings.setDetailCentre(4.8979412,52.3713544);v._completeCity.followCamera();});
 await page.waitForTimeout(3000);
 await page.waitForFunction(()=>{const v=window.canalRecallGame.vectorMap,t=v._threeBuildings;return t.chunks.size&&!t.pending.length&&!t.inflight.size&&!v._completeCity.status().inFlight;},null,{timeout:120000});
 const audit=await page.evaluate(()=>{
  const v=window.canalRecallGame.vectorMap,t=v._threeBuildings,unique=new Map();for(const f of [...v._tileFeatures,...[...t.sourceGroups.values()].flat()])unique.set(f.id??f.properties.id,f);
  const near=[...unique.values()].filter(f=>{const points=f.geometry?.type==='Polygon'?f.geometry.coordinates.flat():f.geometry?.type==='MultiPolygon'?f.geometry.coordinates.flat(2):[];return points.some(([lng,lat])=>Math.hypot((lng-4.8979412)*111320*.61,(lat-52.3713544)*110540)<50);});
  const feature=near.find(f=>JSON.stringify(f).includes('0363100012178210'));
  return {feature,near,profiles:t.appearanceProfiles,revision:t.appearanceRevision,freeCameraSupported:typeof v.map.getFreeCameraOptions==='function',features:unique.size};
 });
 await fs.writeFile(`${root}/samrat-feature.json`,JSON.stringify(audit.feature,null,2)+'\n');
 await fs.writeFile(`${root}/source-feature-audit.json`,JSON.stringify(audit,null,2)+'\n');
 console.log('source audit',audit.feature?.id,audit.feature?.properties,audit.freeCameraSupported);
 if(!audit.feature)throw Error('Samrat BAG not resident');
 const captures=[];
 await page.evaluate(()=>window.canalRecallGame.vectorMap._threeBuildings.setHighlighted(['NL.IMBAG.Pand.0363100012178210']));
 for(const bearing of [116,296,26,206]){
  const camera={center:[4.8979412,52.3713544],bearing,zoom:21.5,pitch:80};
  await page.evaluate(camera=>{const v=window.canalRecallGame.vectorMap;v.map.jumpTo(camera);v._completeCity.followCamera();v.map.triggerRepaint();},camera);
  await page.waitForTimeout(1000);
  const file=`samrat-highlight-${bearing}.png`;
  await page.locator('#vector-map').screenshot({path:`${root}/${file}`});captures.push({file,camera});
 }
 const mapCameraSupported=await page.evaluate(()=>typeof window.canalRecallGame.vectorMap.map.calculateCameraOptionsFromTo==='function');
 if(mapCameraSupported){
  for(const offsetM of [12,20,28]){
   const result=await page.evaluate(offsetM=>{
    const v=window.canalRecallGame.vectorMap,m=v.map,angle=26*Math.PI/180;
    const target={lng:4.897909,lat:52.371358};
    const camera={lng:target.lng-Math.cos(angle)*offsetM/(111320*.61),lat:target.lat+Math.sin(angle)*offsetM/110540};
    m.setMaxPitch(85);m.setMaxZoom(26);const options=m.calculateCameraOptionsFromTo(camera,18,target,8);m.setCenterElevation(8);m.jumpTo(options);v._completeCity.followCamera();m.triggerRepaint();return {position:camera,altitude:18,target,targetAltitude:8,options,zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing()};
   },offsetM);
   await page.waitForTimeout(1000);const file=`samrat-street-${offsetM}.png`;await page.locator('#vector-map').screenshot({path:`${root}/${file}`});captures.push({file,result});
  }
 }
 if(audit.freeCameraSupported){
  for(const offsetM of [10,18]){
   const result=await page.evaluate(offsetM=>{
    const v=window.canalRecallGame.vectorMap,m=v.map,angle=26*Math.PI/180;
    const camera={lng:4.8979412-Math.cos(angle)*offsetM/(111320*.61),lat:52.3713544+Math.sin(angle)*offsetM/110540};
    const options=m.getFreeCameraOptions();options.position=window.maplibregl.MercatorCoordinate.fromLngLat(camera,6);options.lookAtPoint({lng:4.8979412,lat:52.3713544});m.setFreeCameraOptions(options);v._completeCity.followCamera();m.triggerRepaint();return {position:camera,altitude:6,zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing()};
   },offsetM);
   await page.waitForTimeout(1000);const file=`samrat-free-${offsetM}.png`;await page.locator('#vector-map').screenshot({path:`${root}/${file}`});captures.push({file,result});
  }
 }
 await fs.writeFile(`${root}/frontage-probe.json`,JSON.stringify({captures,revision:audit.revision},null,2)+'\n');
}finally{await browser.close();}
