import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out='artifacts/homomonument-ground-source',prefix=process.argv[2]??'before';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/canal-drive/');
 await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?.ready,null,{timeout:180000});
 await page.getByRole('radiogroup',{name:'Travel',exact:true}).getByRole('button',{name:/Bike/}).click();
 await page.locator('#poi-destination').selectOption('lm-extract_landmarks_7630368');
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>canalRecallGame.state===4&&canalRecallGame.camera.introOverview===0,null,{timeout:180000});
 await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.sync=()=>{};v.map.jumpTo({center:[4.8846925,52.37443243333333],zoom:20,pitch:0,bearing:0});v._completeCity?.setSuspended(false);v._completeCity?.followCamera();});
 await page.waitForTimeout(18000);
 const proof=await page.evaluate(()=>{const v=canalRecallGame.vectorMap,m=v.map,points={north:[4.8846151,52.3746131],east:[4.8849867,52.3743914],south:[4.8844757,52.3742928],plaza:[4.88467,52.37444]};return{models:v._signatureLandmarks?.describe(),style:m.getStyle(),points:Object.fromEntries(Object.entries(points).map(([k,p])=>[k,m.queryRenderedFeatures(m.project(p)).map(f=>({layer:f.layer.id,source:f.source,sourceLayer:f.sourceLayer,properties:f.properties,geometry:f.geometry}))]))}});
 fs.writeFileSync(out+'/'+prefix+'-installed-basemap.json',JSON.stringify(proof,null,2));
 await page.screenshot({path:out+'/'+prefix+'-overhead.png'});
 await page.evaluate(()=>canalRecallGame.vectorMap.map.jumpTo({zoom:19,pitch:55,bearing:145}));await page.waitForTimeout(5000);await page.screenshot({path:out+'/'+prefix+'-oblique.png'});
 await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({center:[4.8846925,52.37443243333333],zoom:18.8,pitch:45,bearing:325});});await page.waitForTimeout(2500);await page.screenshot({path:out+'/'+prefix+'-opposite.png'});
 await page.evaluate(()=>{const v=canalRecallGame.vectorMap;v.map.jumpTo({center:[4.8851,52.37455],zoom:18.8,pitch:45,bearing:325});});await page.waitForTimeout(2500);await page.screenshot({path:out+'/'+prefix+'-stationary-pan.png'});
 console.log(JSON.stringify({errors,points:Object.fromEntries(Object.entries(proof.points).map(([k,fs])=>[k,fs.map(f=>f.layer)])),model:proof.models?.find(x=>x.id==='homomonument')},null,2));
}finally{await browser.close();}
