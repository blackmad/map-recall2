import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRoadGraph } from '../routing/roadGraph';
import { ferrySegments, connectFerryGraph, connectedTerminals, type Segment } from './network';
import type { TransitNetwork } from '../transit/network';
const net = JSON.parse(readFileSync('public/data/extracts/amsterdam/transit-network.json','utf8')) as TransitNetwork;
const project = (lat:number,lng:number) => ({x:(lng-4.9)*200000,y:(52.38-lat)*333960});
const piers = Object.values(net.stops).filter(s=>s.center && net.lines.some(l=>l.mode==='ferry' && l.stopIds.includes(s.stopId)));
const land:Segment[] = piers.filter(s=>s.inAmsterdamBbox).map(s=>{const p=project(...s.center!);return {points:[{x:p.x-40,y:p.y+25},{x:p.x+40,y:p.y+25}],width:12,type:'cycleway',name:s.name};});
const added=ferrySegments(net,land,project), links=added.flatMap(s=>s.ferryLink?[s.ferryLink]:[]);
assert.equal(links.length,8,'Amsterdam-bbox ferry connections');
const f3=links.find(l=>l.ref==='F3')!;
assert.deepEqual(connectedTerminals(f3.from.id,links).map(t=>t.name),['Buiksloterweg']);
assert.ok(!connectedTerminals(f3.from.id,links).some(t=>t.name==='NDSM-werf'),'parent Centraal station does not merge piers');
const segments=[...land,...added], graph=connectFerryGraph(buildRoadGraph(segments.filter(s=>s.type!=='ferry').map(s=>({points:s.points,width:s.width})),{mergeSize:2,junctionStitchRadius:8}),segments);
assert.ok(graph.allNodes.some(n=>n.edges.some(e=>(e.segmentMetadata[0] as any)?.ferryId===f3.id)));
// At an interior crossing, service nodes must remain distinct even at identical coordinates.
const crossing:Segment[] = [
  {points:[{x:-100,y:0},{x:0,y:0},{x:100,y:0}],width:5,type:'ferry',name:'A',ferryLink:{id:'A',ref:'A',from:{} as any,to:{} as any,points:[]}},
  {points:[{x:0,y:-100},{x:0,y:0},{x:0,y:100}],width:5,type:'ferry',name:'B',ferryLink:{id:'B',ref:'B',from:{} as any,to:{} as any,points:[]}},
];
const ends=crossing.flatMap(s=>[s.points[0],s.points[s.points.length-1]]).map(p=>({points:[p,{x:p.x+1,y:p.y+1}],width:1}));
const isolated=connectFerryGraph(buildRoadGraph(ends,{mergeSize:.1,junctionStitchRadius:.1}),crossing);
const start=isolated.allNodes.find(n=>n.x===-100&&n.y===0)!, other=isolated.allNodes.find(n=>n.x===0&&n.y===100)!;
// Inspect reachability without relying on nearest-point route snapping.
const reached=new Set([start]), queue=[start];for(let i=0;i<queue.length;i++)for(const e of queue[i].edges)if(!reached.has(e.node)){reached.add(e.node);queue.push(e.node);}
assert.ok(!reached.has(other),'crossing ferry services cannot transfer at sea');
console.log('Ferry topology and GTFS terminal restrictions passed');
