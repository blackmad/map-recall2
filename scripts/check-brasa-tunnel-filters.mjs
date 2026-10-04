import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {featureFilter} from '@maplibre/maplibre-gl-style-spec';
const fixture=JSON.parse(fs.readFileSync('scripts/landmarks/brasa-tunnel-vector-fixtures.json'));
const data=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson'));
const requests=[],context={window:{},AbortController,fetch:(url,{signal})=>new Promise(resolve=>requests.push({url,signal,resolve}))};
vm.runInNewContext(fs.readFileSync(process.argv[2]||'public/canal-drive/js/park-landscape.js','utf8'),context);
class MapMock {
 constructor(){this.layers=structuredClone(fixture.layers);this.events={};this.zoom=18;this.calls=[];this.source={setData:()=>{}};}
 on(e,f){(this.events[e]??=new Set()).add(f);}off(e,f){this.events[e]?.delete(f);}emit(e){for(const f of this.events[e]||[])f();}
 getStyle(){return {layers:this.layers};}getLayer(id){return this.layers.find(l=>l.id===id);}getSource(){return this.source;}addSource(){}
 addLayer(l){this.layers.push(l);this.emit('styledata');}setPaintProperty(){}
 getFilter(id){return this.getLayer(id)?.filter;}setFilter(id,f){assert.ok(this.getLayer(id));this.getLayer(id).filter=f;this.calls.push(id);this.emit('styledata');}
 getLayoutProperty(id,k){return this.getLayer(id)?.layout?.[k];}setLayoutProperty(id,k,v){const l=this.getLayer(id);l.layout={...l.layout,[k]:v};this.emit('styledata');}
 getZoom(){return this.zoom;}getBounds(){return {getWest:()=>4.96,getEast:()=>4.98,getSouth:()=>52.30,getNorth:()=>52.32};}
}
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};const reply=async(index)=>{requests[index].resolve({ok:true,json:async()=>data});await settle();};
const map=new MapMock(),grounds=new context.window.CanalRecallParks.ParkLandscape(map,'/data/extracts/amsterdam','clean');await reply(0);
const original=(id)=>fixture.layers.find(l=>l.id===id).filter;
const restored=()=>{for(const l of fixture.layers)assert.deepEqual(JSON.parse(JSON.stringify(map.getFilter(l.id))),l.filter);};
const amended=()=>{for(const l of fixture.layers)assert.notDeepEqual(JSON.parse(JSON.stringify(map.getFilter(l.id))),l.filter);};
amended();assert.equal(map.calls.length,6,'styledata recursion must not duplicate filters');
let hidden=0;
for(const f of fixture.records){let eligible=0;for(const l of fixture.layers){const old=featureFilter(original(l.id)),next=featureFilter(map.getFilter(l.id));if(old.filter({zoom:14},f,f.canonical)){eligible++;assert.equal(next.filter({zoom:14},f,f.canonical),false,'actual crossing underground A9 removed');}}
 assert.ok(eligible);hidden++;
 // Surface road and other classes must keep their original selection, even when crossing the same boundary.
 for(const properties of [{...f.properties,brunnel:'bridge'},{...f.properties,class:'primary'}])for(const l of fixture.layers){const altered={...f,properties};assert.equal(featureFilter(map.getFilter(l.id)).filter({zoom:14},altered,f.canonical),featureFilter(original(l.id)).filter({zoom:14},altered,f.canonical));}
 // Same underground classification well outside the park must preserve original selection.
 const outside={...f,geometry:f.geometry.map(r=>r.map(p=>({x:p.x+8192*4,y:p.y})))};
 for(const l of fixture.layers)assert.equal(featureFilter(map.getFilter(l.id)).filter({zoom:14},outside,f.canonical),featureFilter(original(l.id)).filter({zoom:14},outside,f.canonical));
}
assert.equal(hidden,25);assert.equal(new Set(fixture.records.map(f=>f.id)).size,13);
grounds.setEnabled(false);restored();grounds.setEnabled(true);amended();
map.setLayoutProperty('park-landscape-ground','visibility','none');assert.equal(grounds.enabled,false);restored();grounds.setEnabled(true);
map.zoom=12;grounds.updateViewport();restored();map.zoom=18;grounds.updateViewport();amended();
// Replacing the style must adopt the new style's originals, never restore old filters over it.
const replacement=structuredClone(fixture.layers);replacement.forEach(l=>l.filter=['all',l.filter,['!=',['get','surface'],'unpaved']]);
const replacementOriginals=structuredClone(replacement);
const restoredReplacement=()=>{for(const l of replacementOriginals)assert.deepEqual(JSON.parse(JSON.stringify(map.getFilter(l.id))),l.filter);};
map.layers=[...replacement,...map.layers.filter(l=>l.id.startsWith('park-landscape-'))];map.emit('styledata');amended();grounds.setEnabled(false);restoredReplacement();
grounds.setEnabled(true);grounds.load('/data/extracts/utrecht');restoredReplacement();
grounds.load('/data/extracts/amsterdam');grounds.load('/data/extracts/utrecht');await reply(1);assert.equal(grounds.brasaGeometry,null,'stale source cannot reapply local filters');
grounds.load('/data/extracts/amsterdam');await reply(2);grounds.destroy();assert.equal(grounds.tunnelFilters.size,0);assert.equal(grounds.brasaGeometry,null);restoredReplacement();
console.log(JSON.stringify({actualClippedA9Features:hidden,uniqueSourceWays:13,layers:6,surfaceOtherClassOutsideControls:'unchanged',toggleCityStyleDestroyStale:'passed'}));
