import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'@playwright/test';import{inBoundary}from'../osm-tree-supplement.mjs';
const data=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson')),paving=data.features.find(f=>f.id==='a26263809');
assert.equal(paving.properties.role,'paved-area');assert.equal(paving.properties.surface,'sett');assert.equal(paving.properties.sourceOsmId,'r13131904');assert.equal(paving.geometry.coordinates[0].length,6,'five mapped holes preserved');
assert.equal(inBoundary([4.88389,52.37448],paving.geometry),false,'Westerkerk stays outside the paving');
assert.equal(inBoundary([4.88456,52.3745],paving.geometry),true,'mapped pedestrian square is paved');
assert.equal(inBoundary([4.8829,52.3741],paving.geometry),false,'surrounding roads stay outside');
for(const hole of paving.geometry.coordinates[0].slice(1)){const r=hole.slice(0,-1),p=[r.reduce((s,p)=>s+p[0],0)/r.length,r.reduce((s,p)=>s+p[1],0)/r.length];assert.equal(inBoundary(p,paving.geometry),false,'mapped building exclusion remains a hole');}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');await page.waitForFunction(n=>window.parkReview?.grounds?.debugFeatures===n,data.features.length);
 await page.evaluate(()=>parkReview.map.jumpTo({center:[4.8842,52.37455],zoom:19,pitch:50,bearing:35}));
 await page.waitForFunction(()=>parkReview.map.queryRenderedFeatures({layers:['park-landscape-ground']}).some(f=>f.properties.role==='paved-area'));
 fs.mkdirSync('artifacts/parks',{recursive:true});await page.screenshot({path:'artifacts/parks/westermarkt.png'});
 for(const theme of['clean','psx','cyberpunk']){await page.evaluate(t=>parkReview.grounds.setTheme(t),theme);const paint=await page.evaluate(()=>parkReview.map.getPaintProperty('park-landscape-ground','fill-color'));assert.ok(paint.includes('paved-area'));}
 await page.uncheck('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'none');await page.check('#grounds');assert.equal(await page.evaluate(()=>parkReview.map.getLayoutProperty('park-landscape-ground','visibility')),'visible');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>parkReview.errors),[]);console.log('Westermarkt: exact paving, five holes, church/street exclusions, themes, browser delivery and toggle passed.');
}finally{await browser.close();}
