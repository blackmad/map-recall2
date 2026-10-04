import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import{chromium}from'@playwright/test';
const chunk=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape-bos.geojson'));
const base=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson'));
const work=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('amsterdam-parks-')).map(n=>path.join(os.tmpdir(),n)).filter(n=>fs.existsSync(path.join(n,'detail.geojson'))).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
const raw=new Map(JSON.parse(fs.readFileSync(path.join(work,'detail.geojson'))).features.map(f=>[f.id,f]));
const polys=g=>g.type==='MultiPolygon'?g.coordinates:g.type==='Polygon'?[g.coordinates]:[];
for(const f of chunk.features){
 const match=f.id.match(/^a53034066-([anwr]\d+)/),source=raw.get(match?.[1]||f.id);assert.ok(source,`source identity ${f.id}`);
 if(f.properties.role==='bench'){assert.equal(source.properties.amenity,'bench');assert.equal(source.geometry.type,'Point');continue;}
 if(f.geometry.type==='LineString'){
  const coords=source.geometry.coordinates.map(p=>JSON.stringify(p));const wanted=f.geometry.coordinates.map(p=>JSON.stringify(p));assert.ok(coords.some((_,i)=>wanted.every((p,j)=>coords[i+j]===p)),`unaltered source path ${f.id}`);
 }else for(const polygon of polys(f.geometry))assert.ok(polys(source.geometry).some(p=>JSON.stringify(p)===JSON.stringify(polygon)),`exact source polygon ${f.id}`);
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('park-landscape-bos.geojson'))requests.push(r.url());});
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,base.features.length);assert.equal(requests.length,0);
 await page.evaluate(()=>parkReview.map.jumpTo({center:[4.832,52.311],zoom:13,pitch:0}));await page.waitForTimeout(300);assert.equal(requests.length,0);
 await page.evaluate(()=>parkReview.map.jumpTo({center:[4.834,52.317],zoom:17,pitch:45,bearing:15}));await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,base.features.length+chunk.features.length);
 await page.waitForFunction(()=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path','park-landscape-benches']}).some(f=>f.properties.park==='Amsterdamse Bos'));
 const visible=await page.evaluate(()=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground','park-landscape-path','park-landscape-benches']}).filter(f=>f.properties.park==='Amsterdamse Bos').length);assert.ok(visible>10);
 fs.mkdirSync('artifacts/parks',{recursive:true});await page.screenshot({path:'artifacts/parks/amsterdamse-bos.png'});
 await page.uncheck('#grounds');await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,base.features.length);await page.check('#grounds');await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,base.features.length+chunk.features.length);assert.equal(requests.length,1);
 await page.evaluate(()=>parkReview.map.jumpTo({center:[4.89,52.37],zoom:17}));await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,base.features.length);
 await page.evaluate(()=>parkReview.grounds.load('/data/extracts/utrecht'));assert.equal(await page.evaluate(()=>parkReview.grounds.debugFeatures),0);assert.equal(await page.evaluate(()=>parkReview.grounds.cache.size),0);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>parkReview.errors),[]);console.log(JSON.stringify({sourceFeatures:chunk.features.length,visible,bosRequests:requests.length,errors}));
}finally{await browser.close();}
