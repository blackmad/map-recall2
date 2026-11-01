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

test('surface index cell keys: neighbouring, negative and far-out-of-range cells stay distinct',()=>{
 const far=2**25*ROAD_GRID_CELL;
 const segs=[
  {points:[{x:-150,y:-150},{x:-120,y:-150}],width:4},
  {points:[{x:150,y:150},{x:180,y:150}],width:4},
  {points:[{x:far*3,y:5},{x:far*3+30,y:5}],width:4},
  {points:[{x:5,y:-far*3},{x:35,y:-far*3}],width:4},
 ];
 const index=buildRoadSpatialIndex(segs);
 const at=(x:number,y:number,ring=0)=>roadsNear(index,x,y,ring).map(s=>s.segIdx);
 assert.deepEqual(at(-140,-150),[0]);
 assert.deepEqual(at(160,150),[1]);
 assert.deepEqual(at(far*3+10,5),[2],'beyond the numeric key range the string key still finds its span');
 assert.deepEqual(at(20,-far*3),[3]);
 assert.deepEqual(at(0,0),[],'cell (0,0) is empty');
 assert.deepEqual(at(0,0,2).sort(),[0,1]);
});

test('packed road index: roadsNear gives the Map-of-arrays index\'s spans, in its order, for every ring', () => {
 // The index as it was before packing (#130): one RoadSpan object per span, pushed into a Map bucket per cell.
 const reference=(segments: {points:{x:number;y:number}[];width:number}[],cellSize: number,connectors: {a:{x:number;y:number};b:{x:number;y:number};segmentIndex:number}[])=>{
  const LIMIT=2**25,key=(gx:number,gy:number)=>Math.abs(gx)<LIMIT&&Math.abs(gy)<LIMIT?(gx+LIMIT)*2**26+(gy+LIMIT):`${gx},${gy}`;
  const cells=new Map<number|string,any[]>();
  const add=(span:any)=>{const pad=span.width+10;
   for(let gx=Math.floor((Math.min(span.a.x,span.b.x)-pad)/cellSize);gx<=Math.floor((Math.max(span.a.x,span.b.x)+pad)/cellSize);gx++)
    for(let gy=Math.floor((Math.min(span.a.y,span.b.y)-pad)/cellSize);gy<=Math.floor((Math.max(span.a.y,span.b.y)+pad)/cellSize);gy++){const k=key(gx,gy),b=cells.get(k);if(b)b.push(span);else cells.set(k,[span]);}};
  segments.forEach((s,segIdx)=>{for(let ptIdx=0;ptIdx<s.points.length-1;ptIdx++)add({a:s.points[ptIdx],b:s.points[ptIdx+1],segIdx,ptIdx,width:s.width});});
  for(const c of connectors){const s=segments[c.segmentIndex];if(s)add({a:c.a,b:c.b,segIdx:c.segmentIndex,ptIdx:-1,width:s.width});}
  return (x:number,y:number,ring=1)=>{const gx=Math.floor(x/cellSize),gy=Math.floor(y/cellSize),out:any[]=[];
   for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++){const b=cells.get(key(gx+dx,gy+dy));if(b)out.push(...b);}return out;};
 };
 let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2**31;return seed/2**31;};
 const segments=Array.from({length:240},()=>{let x=rnd()*6000-3000,y=rnd()*6000-3000;return{width:8+rnd()*40,points:Array.from({length:1+Math.floor(rnd()*6)},()=>({x:x+=rnd()*400-200,y:y+=rnd()*400-200}))};});
 // A way out of the numeric key range (string cells) and a degenerate one.
 segments.push({width:20,points:[{x:2**25*100+50,y:10},{x:2**25*100+400,y:30}]},{width:12,points:[{x:5,y:5}]});
 const connectors=Array.from({length:60},(_,i)=>({a:segments[i].points[0],b:segments[i+1].points.at(-1)!,segmentIndex:i}));
 connectors.push({a:{x:0,y:0},b:{x:1,y:1},segmentIndex:9999});
 const packed=buildRoadSpatialIndex(segments,100,connectors),near=reference(segments,100,connectors);
 const probes=[...Array.from({length:400},()=>({x:rnd()*7000-3500,y:rnd()*7000-3500})),{x:2**25*100+200,y:20}];
 let compared=0;
 for(const p of probes)for(const ring of [0,1,2,4]){const got=roadsNear(packed,p.x,p.y,ring),want=near(p.x,p.y,ring);
  assert.equal(got.length,want.length);
  for(let i=0;i<got.length;i++){assert.deepEqual(got[i],want[i]);assert.equal(got[i].a,want[i].a,'the way\'s own point objects');compared++;}}
 assert.ok(compared>10000,`compared ${compared}`);
 // One object per span across queries, as the shared bucket objects were.
 const p=probes[0];assert.equal(roadsNear(packed,p.x,p.y,4)[0],roadsNear(packed,p.x,p.y,4)[0]);
});
