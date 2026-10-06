import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRoadGraph,buildRoadGraphAsync} from './roadGraph.ts';

test('batched graph matches synchronous topology and connectors and yields to input',async()=>{
 const segments=Array.from({length:1600},(_,i)=>({points:[{x:i%40*25,y:Math.floor(i/40)*25},{x:i%40*25+30,y:Math.floor(i/40)*25+10}],width:15,metadata:{segmentIndex:i}}));
 let yields=0;
 const compact=(g: ReturnType<typeof buildRoadGraph>)=>({nodes:[...g.nodes].map(([key,n])=>[key,n.x,n.y,n.edges.map(e=>[e.node.key,e.distance,e.kind,e.segmentIndexes])]),connectors:g.connectors});
 const graph=await buildRoadGraphAsync(segments,{}, {yieldToBrowser:async()=>{yields++}});
 assert.deepEqual(compact(graph),compact(buildRoadGraph(segments)));
 assert(yields>0,'graph batches give the browser a chance to process input');
});

test('a superseded loading request stops before it can publish a graph',async()=>{
 const segments=Array.from({length:1600},(_,i)=>({points:[{x:i*2,y:0},{x:i*2,y:100}],width:10}));
 let cancelled=false;
 await assert.rejects(buildRoadGraphAsync(segments,{}, {cancelled:()=>cancelled,yieldToBrowser:async()=>{cancelled=true}}),{name:'AbortError'});
});
