import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const basePath='public/data/extracts/amsterdam/park-landscape.geojson';
const chunkPath='public/data/extracts/amsterdam/park-landscape-bos.geojson';
const base=JSON.parse(fs.readFileSync(basePath));
const chunk=JSON.parse(fs.readFileSync(chunkPath));
const previous=JSON.parse(execFileSync('git',['show',`a1c6938c:${basePath}`],{maxBuffer:10e6}));
const baseCount=base.features.length;
assert.equal(baseCount,10533);
const priorIds=new Set(previous.features.map(f=>f.id));
assert.deepEqual(base.features.filter(f=>priorIds.has(f.id)),previous.features);
assert.equal(chunk.features.length,3254);
assert.equal(new Set([...base.features,...chunk.features].map(f=>f.id)).size,baseCount+3254);
assert.ok(chunk.features.every(f=>f.properties.park==='Amsterdamse Bos'));
assert.equal(chunk.features.find(f=>f.properties.role==='park-boundary').id,'a53034066');
const requests=[];
const fetch=(url,options)=>new Promise(resolve=>requests.push({url,signal:options.signal,resolve}));
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const reply=async(i,data)=>{requests[i].resolve({ok:true,json:async()=>data});await settle();};
class MapMock {
 constructor(){this.layers=[];this.events={};this.zoom=12;this.bounds=[4.7,52.2,5.1,52.5];this.source={setData:data=>this.data=data};}
 addSource(){} getSource(){return this.source;} getStyle(){return {layers:this.layers};}
 addLayer(l){this.layers.push(l);} getLayer(id){return this.layers.find(l=>l.id===id);} setPaintProperty(){}
 getLayoutProperty(id,k){return this.layers.find(l=>l.id===id)?.layout?.[k];}
 setLayoutProperty(id,k,v){const l=this.layers.find(l=>l.id===id);l.layout={...l.layout,[k]:v};}
 on(e,f){(this.events[e]??=new Set()).add(f);} off(e,f){this.events[e]?.delete(f);}
 getZoom(){return this.zoom;} getBounds(){const [w,s,e,n]=this.bounds;return {getWest:()=>w,getSouth:()=>s,getEast:()=>e,getNorth:()=>n};}
}
const context={window:{},AbortController,fetch};vm.runInNewContext(fs.readFileSync('public/canal-drive/js/park-landscape.js','utf8'),context);
const map=new MapMock(),grounds=new context.window.CanalRecallParks.ParkLandscape(map,'/data/extracts/amsterdam','clean');
await reply(0,base);assert.equal(requests.length,1,'whole-city view must not fetch Bos');
map.zoom=15;map.bounds=[4.81,52.30,4.85,52.33];grounds.updateViewport();assert.equal(requests.length,2);
grounds.updateViewport();assert.equal(requests.length,2,'no duplicate fetch');
grounds.setEnabled(false);assert.ok(requests[1].signal.aborted);
await reply(1,chunk);assert.equal(grounds.debugFeatures,baseCount,'aborted response must not attach');
grounds.setEnabled(true);assert.equal(requests.length,3);await reply(2,chunk);assert.equal(grounds.debugFeatures,baseCount+3254);assert.equal(grounds.cache.size,1);
map.bounds=[4.88,52.36,4.91,52.38];grounds.updateViewport();assert.equal(grounds.debugFeatures,baseCount);
map.bounds=[4.81,52.30,4.85,52.33];grounds.updateViewport();assert.equal(grounds.debugFeatures,baseCount+3254);assert.equal(requests.length,3,'reuse bounded cache');
grounds.load('/data/extracts/amsterdam');await reply(3,base);assert.equal(requests.length,5);
grounds.load('/data/extracts/utrecht');assert.ok(requests[4].signal.aborted);await reply(4,chunk);assert.equal(grounds.debugFeatures,0);assert.equal(grounds.cache.size,0);
grounds.load('/data/extracts/amsterdam');grounds.load('/data/extracts/utrecht');await reply(5,base);assert.equal(grounds.debugFeatures,0,'stale base response must not attach');
grounds.load('/data/extracts/amsterdam');await reply(6,base);grounds.destroy();assert.ok(requests[7].signal.aborted);await reply(7,chunk);assert.equal(grounds.cache.size,0);assert.equal(grounds.debugFeatures,0);
console.log(JSON.stringify({baseFeatures:base.features.length,bosFeatures:chunk.features.length,baseBytes:fs.statSync(basePath).size,bosBytes:fs.statSync(chunkPath).size,bosGzipBytes:gzipSync(fs.readFileSync(chunkPath)).length,lifecycle:'passed'}));
