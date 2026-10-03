import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5196/canal-drive/park-landscape.html');
 await page.waitForFunction(()=>window.parkReview?.trees?.ready&&parkReview.trees.debugTrees>100);
 const report=[];
 for(const [name,lng,lat,zoom]of [['Artis',4.9145,52.3658,18],['Hortus',4.908,52.3669,19],['Vondelpark',4.8688,52.3581,18],['Artis return',4.9145,52.3658,18]]){
  await page.evaluate(([lng,lat,zoom])=>parkReview.map.jumpTo({center:[lng,lat],zoom,pitch:65,bearing:20}),[lng,lat,zoom]);
  await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>10);
  const data=await page.evaluate(()=>{const t=parkReview.trees,b=parkReview.map.getBounds();const visible=[...t.tiles.values()].flat().filter(p=>p.lng>=b.getWest()&&p.lng<=b.getEast()&&p.lat>=b.getSouth()&&p.lat<=b.getNorth());return{trees:t.debugTrees,osmVisible:visible.filter(p=>p.source==='osm').length,tiles:t.tiles.size,draws:t.meshes.length,geometries:t.geometries.size,materials:t.materials.size,hortusSpecimens:[...t.tiles.values()].flat().filter(p=>['osm-n3927109008','osm-n3927109009'].includes(p.id)).map(p=>({id:p.id,species:p.species})),errors:parkReview.errors};});
  assert.ok(data.tiles<=12);assert.ok(data.draws<=7);assert.ok(data.geometries<=4);assert.equal(data.materials,2);assert.deepEqual(data.errors,[]);
  if(name.startsWith('Artis'))assert.ok(data.osmVisible>40,'private zoo gains explicit mapped trunks');
  if(name==='Hortus'){assert.equal(data.hortusSpecimens.length,2);assert.ok(data.osmVisible>=2);}
  report.push({name,...data});
 }
 await page.uncheck('#trees');assert.equal(await page.evaluate(()=>parkReview.trees.meshes.length),0);assert.equal(await page.evaluate(()=>parkReview.trees.tiles.size),0);
 await page.check('#trees');await page.waitForFunction(()=>parkReview.trees.pending.size===0&&parkReview.trees.debugTrees>10);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
