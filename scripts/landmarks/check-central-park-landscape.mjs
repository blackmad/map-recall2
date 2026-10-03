import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'@playwright/test';
const data=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson'));
const positions=[['Wertheimpark',4.9089,52.3678,19],['Park Frankendael',4.9300,52.3505,17],['Martin Luther Kingpark',4.9073,52.3392,17],['Rembrandtplein',4.8966,52.3660,19]];
for(const [name]of positions){const subset=data.features.filter(f=>f.properties.park===name);assert.ok(subset.length>20);assert.ok(subset.some(f=>f.properties.role==='path'));for(const f of subset)assert.match(f.id,/^a\d+(?:-[anw]\d+(?:-\d+|-seat|-back)?)?$/);}
assert.equal(data.features.filter(f=>f.properties.park==='Martin Luther Kingpark'&&f.properties.role==='park').length,2,'both mapped sections retained');
assert.ok(!data.features.some(f=>f.properties.park==='Rembrandtplein'&&f.properties.role==='park'),'keep plaza paving intact');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,data.features.length);
 const report=[];
 for(const [name,lng,lat,zoom]of positions){
  await page.evaluate(([lng,lat,zoom])=>parkReview.map.jumpTo({center:[lng,lat],zoom,pitch:50,bearing:15}),[lng,lat,zoom]);
  await page.waitForFunction(name=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path']}).some(f=>f.properties.park===name),name);
  await page.waitForTimeout(250);const rendered=await page.evaluate(name=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path']}).filter(f=>f.properties.park===name).length,name);assert.ok(rendered>5);
  report.push({name,rendered});fs.mkdirSync('artifacts/parks',{recursive:true});await page.screenshot({path:`artifacts/parks/${name.toLowerCase().replaceAll(' ','-')}.png`});
 }
 await page.uncheck('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'none');await page.check('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'visible');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>parkReview.errors),[]);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
