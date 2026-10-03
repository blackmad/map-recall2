import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'@playwright/test';
const data=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson'));
for(const [name,id]of [['Artis','a8733446'],['Hortus Botanicus','a63054158']]){
 const subset=data.features.filter(f=>f.properties.park===name);assert.ok(subset.length>30);
 assert.ok(!subset.some(f=>f.id===id||f.properties.role==='park'),'do not fill the entire grounds boundary');
 assert.ok(subset.some(f=>f.properties.role==='water'));assert.ok(subset.some(f=>f.properties.role==='path'));
 for(const f of subset)assert.match(f.id,new RegExp(`^${id}-[anw]\\d+-?(?:\\d+|seat|back)?$`),'actual OSM feature identity retained');
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');await page.waitForFunction(()=>window.parkReview?.grounds?.debugFeatures>5000);
 const report=[];
 for(const [name,lng,lat]of [['Artis',4.9144,52.366],['Hortus Botanicus',4.908,52.3669]]){
  await page.evaluate(([lng,lat])=>parkReview.map.jumpTo({center:[lng,lat],zoom:18,pitch:50,bearing:15}),[lng,lat]);
  await page.waitForFunction(name=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path']}).some(f=>f.properties.park===name),name);
  await page.waitForTimeout(400);
  const count=await page.evaluate(name=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path']}).filter(f=>f.properties.park===name).length,name);assert.ok(count>5);report.push({name,rendered:count});
  fs.mkdirSync('artifacts/parks',{recursive:true});await page.screenshot({path:`artifacts/parks/${name==='Artis'?'artis':'hortus'}.png`});
 }
 await page.uncheck('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'none');
 await page.check('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'visible');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>parkReview.errors),[]);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
