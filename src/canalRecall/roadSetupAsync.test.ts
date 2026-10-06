import type {BuildScheduling} from './buildScheduling.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRoadSegments,buildRoadSegmentsAsync,RoadSnapIndex,snapToRoad,type OsmWay} from './osm/roadProjection.ts';
import {buildRoadSpatialIndex,buildRoadSpatialIndexAsync,roadsNear,contactsAt,classifySurface,ROAD_GRID_CELL} from './routing/roadSurface.ts';

const centre={lat:52.37,lon:4.89};
const ways:OsmWay[]=Array.from({length:320},(_,i)=>({highway:i%2?'residential':'cycleway',tags:{name:`Street ${i}`,oneway:i%3?'no':'yes'},nodes:[{lat:centre.lat+i*.00002,lon:centre.lon},{lat:centre.lat+i*.00002,lon:centre.lon+.004}]}));
const options={simplificationToleranceDegrees:.00003,roadWidths:{residential:20,cycleway:12},defaultRoadWidth:30};

test('batched road projection preserves every coordinate, tag, width and offset',async()=>{
 let yields=0;
 const built=await buildRoadSegmentsAsync(ways,centre,options,{budgetMs:0,yieldToBrowser:async()=>{yields++}});
 assert.deepEqual(built,buildRoadSegments(ways,centre,options));
 assert(yields>1);
 const index=await RoadSnapIndex.create(built.segments,{budgetMs:0,yieldToBrowser:async()=>{yields++}});
 for(let i=0;i<40;i++)for(const limit of [false,0,240,800] as const){
  const point={lat:centre.lat+i*.00018,lon:centre.lon+i*.0001};
  assert.deepEqual(snapToRoad(point,centre,built.offset,built.segments,limit,index),snapToRoad(point,centre,built.offset,built.segments,limit));
 }
});

test('batched surface grid preserves span order, connectors and driving classification',async()=>{
 const {segments}=buildRoadSegments(ways,centre,options);
 const connectors=[{a:segments[0].points[0],b:segments[1].points[0],segmentIndex:0}];
 let yields=0;
 const grid=await buildRoadSpatialIndexAsync(segments,ROAD_GRID_CELL,connectors,{budgetMs:0,yieldToBrowser:async()=>{yields++}}),old=buildRoadSpatialIndex(segments,ROAD_GRID_CELL,connectors);
 assert.deepEqual(grid,old);assert(yields>1);
 for(const segment of segments.slice(0,20))for(const p of segment.points)for(const dx of [0,18,25,50]){
  assert.deepEqual(roadsNear(grid,p.x+dx,p.y),roadsNear(old,p.x+dx,p.y));
  const classify=(index: ReturnType<typeof buildRoadSpatialIndex>)=>contactsAt(roadsNear(index,p.x+dx,p.y),p.x+dx,p.y).map(c=>classifySurface(c.dist,c.width));
  assert.deepEqual(classify(grid),classify(old));
 }
});

test('projection, nearest-road index and surface stages stop when loading is cancelled',async()=>{
 const builders: Array<(s:BuildScheduling)=>Promise<unknown>>=[s=>buildRoadSegmentsAsync(ways,centre,options,s),s=>RoadSnapIndex.create(buildRoadSegments(ways,centre,options).segments,s),s=>buildRoadSpatialIndexAsync(buildRoadSegments(ways,centre,options).segments,100,[],s)];
 for(const build of builders){
  let cancelled=false;
  await assert.rejects(build({budgetMs:0,cancelled:()=>cancelled,yieldToBrowser:async()=>{cancelled=true}}),{name:'AbortError'});
 }
});
