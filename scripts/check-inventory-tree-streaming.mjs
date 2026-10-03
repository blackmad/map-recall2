import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window={CanalRecallThree:{THREE}};
globalThis.location={href:'http://localhost/canal-drive/'};
const {InventoryTrees}=await import('../public/canal-drive/js/inventory-trees-source.js');
const tileKey=(lng,lat)=>`15/${Math.floor((lng+180)/360*32768)}/${Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*32768)}`;
const key=tileKey(4.9,52.37),ready=[];
const map={addLayer(){},on(){},off(){},triggerRepaint(){},getZoom:()=>17,getCenter:()=>({lng:4.9,lat:52.37}),getBounds:()=>({getWest:()=>4.895,getEast:()=>4.905,getSouth:()=>52.365,getNorth:()=>52.375})};
const projection={MercatorCoordinate:{fromLngLat:([lng,lat])=>({x:lng,y:lat,z:0,meterInMercatorCoordinateUnits:()=>1})}};
const index={version:1,zoom:15,sourceUrl:'https://maps.amsterdam.nl/bomen/',tiles:[{key,url:'tiles/test.json.gz'}]};
let tileRequests=[];
globalThis.fetch=async(url,{signal}={})=>{
 if(String(url).endsWith('index.json'))return {ok:true,json:async()=>index};
 return await new Promise((resolve,reject)=>{
  const record={resolve,signal};tileRequests.push(record);
  signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
 });
};
const layer=new InventoryTrees(map,projection,v=>ready.push(v));
layer.setEnabled(true);await layer.load('/data/extracts/amsterdam');
assert.equal(layer.ready,true);assert.equal(layer.pending.size,1);
layer.setEnabled(false);assert.equal(tileRequests[0].signal.aborted,true);assert.equal(layer.pending.size,0);assert.equal(layer.meshes.length,0);
await new Promise(resolve=>setTimeout(resolve,0));
layer.setEnabled(true);assert.equal(layer.pending.size,1);
// A city change aborts in-flight tile requests and keeps the existing OSM fallback active.
await layer.load('/data/extracts/utrecht');
assert.equal(tileRequests[1].signal.aborted,true);assert.equal(layer.ready,false);assert.equal(ready.at(-1),false);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(layer.tiles.size,0);assert.equal(layer.pending.size,0);
// Render mixed actual inventory kinds in a bounded number of instanced draws.
layer.ready=true;
layer.tiles.set(key,[['Picea abies','Boom'],['Betula pendula','Boom'],['Quercus robur','Boom'],['Salix alba','Knotboom']].map(([species,type],i)=>({id:i,lng:4.9,lat:52.37,height:12,heightClass:'12 m',species,type})));
layer.rebuild();assert.equal(layer.debugTrees,4);assert.ok(layer.meshes.length<=7);assert.equal(layer.debugArchetypes.length,4);
assert.ok(layer.meshes.some(m=>m.geometry.type==='ConeGeometry'));
assert.ok(layer.meshes.every(m=>m.instanceColor&&m.material.flatShading));
for(const mesh of layer.meshes)assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
const geometries=[...layer.geometries.values()],materials=[...layer.materials.values()];
layer.rebuild();assert.deepEqual([...layer.geometries.values()],geometries,'rebuild reuses shared GPU geometry');assert.deepEqual([...layer.materials.values()],materials,'rebuild reuses shader materials');
assert.equal(layer.geometries.size,3);assert.equal(layer.materials.size,2);
// A nearby crown stays in the streamed envelope even when its trunk is just outside.
layer.tiles.set(key,[{id:'edge',lng:4.89495,lat:52.37,height:20,heightClass:'20m',species:'Quercus robur'},{id:'far',lng:4.89,lat:52.37,height:20,heightClass:'20m',species:'Quercus robur'}]);
layer.rebuild();assert.equal(layer.debugTrees,1,'retain the edge crown without retaining distant trees');
layer.clear();assert.equal(layer.meshes.length,0);
// Removal must invalidate an in-flight index response, not revive the dead layer.
let finishIndex;globalThis.fetch=()=>new Promise(resolve=>{finishIndex=resolve;});
const removed=new InventoryTrees(map,projection);removed.setEnabled(true);const loading=removed.load('/data/extracts/amsterdam');
removed.layer.onRemove();finishIndex({ok:true,json:async()=>index});await loading;
assert.equal(removed.ready,false);assert.equal(removed.enabled,false);assert.equal(removed.pending.size,0);
console.log('Passed: city changes and toggle abort in-flight tiles, preserve fallback, and render mixed species in bounded instanced draws.');
