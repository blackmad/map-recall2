/** A superseded staged load must not publish its projection or snap index. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

let resolve!: (value:any)=>void;
const projection=new Promise(r=>resolve=r);
const index={name:'new index'};
const context=vm.createContext({window:{CanalRecallRoadProjection:{buildRoadSegmentsAsync:()=>projection,RoadSnapIndex:{create:async()=>index}}},DOMException,SIMPLIFICATION_TOLERANCE:.00003,ROAD_WIDTHS:{},DEFAULT_ROAD_WIDTH:30});
vm.runInContext(readFileSync('public/canal-drive/js/osm-loader.js','utf8')+'\nglobalThis.loader = new OSMLoader();',context);
const loader=context.loader;
const previous={_lastCenterLat:52,_lastCenterLng:4,_lastOffsetX:20,_lastOffsetY:30,_roadSnapSegments:[],_roadSnapIndex:{name:'previous index'}};
Object.assign(loader,previous);
let cancelled=false;
const aborted=loader.buildRoadSegmentsAsync([],53,5,()=>cancelled);
cancelled=true;resolve({segments:[],offset:{x:200,y:300}});
await assert.rejects(aborted,{name:'AbortError'});
for(const [key,value] of Object.entries(previous))assert.equal(loader[key],value,`cancelled load preserves ${key}`);
const segments=await loader.buildRoadSegmentsAsync([],53,5,()=>false);
assert.equal(loader._lastCenterLat,53);assert.equal(loader._lastCenterLng,5);
assert.equal(loader._lastOffsetX,200);assert.equal(loader._lastOffsetY,300);
assert.equal(loader._roadSnapSegments,segments);assert.equal(loader._roadSnapIndex,index);
console.log('Staged road loader publishes a matching projection/index atomically and preserves prior state on cancellation.');
