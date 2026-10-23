import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRoadGraph } from '../routing/roadGraph';
import { BERTH_RADIUS, ferrySegments, connectFerryGraph, connectedTerminals, type Segment } from './network';
import type { TransitNetwork } from '../transit/network';
const net = JSON.parse(readFileSync('public/data/extracts/amsterdam/transit-network.json','utf8')) as TransitNetwork;
const project = (lat:number,lng:number) => ({x:(lng-4.9)*200000,y:(52.38-lat)*333960});
const piers = Object.values(net.stops).filter(s=>s.center && net.lines.some(l=>l.mode==='ferry' && l.stopIds.includes(s.stopId)));
const land:Segment[] = piers.filter(s=>s.inAmsterdamBbox).map(s=>{const p=project(...s.center!);return {points:[{x:p.x-40,y:p.y+25},{x:p.x+40,y:p.y+25}],width:12,type:'cycleway',name:s.name};});
const added=ferrySegments(net,land,project), links=added.flatMap(s=>s.ferryLink?[s.ferryLink]:[]);
assert.equal(links.length,8,'Amsterdam-bbox ferry connections');
const f3=links.find(l=>l.ref==='F3')!;
// A named ferry or access segment would become a street question, distractor and router novelty target.
assert.deepEqual(added.filter(s=>s.name).map(s=>s.label),[],'ferry segments carry no street name');
assert.ok(added.every(s=>s.label),'ferry segments keep a display label');
// Feedback 05a7d02a (2026-10-23): the F3 shape's berth manoeuvre runs 27 m west
// along the Centraal pier, so the drawn route led riders to the pier tip
// instead of out over the water. No crossing point may sit inside a berth, and
// F3 must leave Centraal towards the water: the rendered shore normal measured
// at that stop is -0.88 rad (north-east), and boarding needs the heading within 60 degrees.
for (const l of links) for (const p of l.points.slice(1, -1))
  assert.ok(Math.hypot(p.x-l.from.x,p.y-l.from.y)>BERTH_RADIUS && Math.hypot(p.x-l.to.x,p.y-l.to.y)>BERTH_RADIUS, `${l.ref} has no shape point inside a berth`);
const f3Leg=Math.atan2(f3.points[1].y-f3.from.y,f3.points[1].x-f3.from.x);
assert.ok(Math.abs(Math.atan2(Math.sin(f3Leg+0.88),Math.cos(f3Leg+0.88)))<Math.PI/3, `F3 leaves Centraal towards the water (${f3Leg.toFixed(2)} rad)`);
assert.deepEqual(connectedTerminals(f3.from.id,links).map(t=>t.name),['Buiksloterweg']);
assert.ok(!connectedTerminals(f3.from.id,links).some(t=>t.name==='NDSM-werf'),'parent Centraal station does not merge piers');
const segments=[...land,...added], graph=connectFerryGraph(buildRoadGraph(segments.filter(s=>s.type!=='ferry').map(s=>({points:s.points,width:s.width})),{mergeSize:2,junctionStitchRadius:8}),segments);
assert.ok(graph.allNodes.some(n=>n.edges.some(e=>(e.segmentMetadata[0] as any)?.ferryId===f3.id)));
// Feedback 05a7d02a: Centraal F3's access is 9.2 px long and the game's 18 px
// junction grid folds it into its land node. The planned crossing must still
// pass through the stop itself, where boarding happens.
{
  const stop = { id: 'S', name: 'Stop', x: 29.3, y: -8263.9, land: { x: 36.4, y: -8258 } };
  const far = { id: 'T', name: 'Far', x: 700, y: -8780, land: { x: 700, y: -8800 } };
  const ferry: Segment = { points: [stop, { x: 243.6, y: -8478.6 }, far], type: 'ferry', width: 45, name: '',
    ferryLink: { id: 'X', ref: 'X', from: stop, to: far, points: [stop, { x: 243.6, y: -8478.6 }, far] } };
  const pier: Segment[] = [
    { points: [{ x: 36.4, y: -8400 }, stop.land], type: 'cycleway', width: 12, name: 'Quay' },
    { points: [stop.land, stop], type: 'ferry-access', width: 18, name: '', ferryTerminal: stop },
    { points: [far, far.land], type: 'ferry-access', width: 18, name: '', ferryTerminal: far },
  ];
  const folded = buildRoadGraph(pier.map(s => ({ points: s.points, width: s.width })), { mergeSize: 18, junctionStitchRadius: 8 });
  assert.ok(!folded.allNodes.some(n => Math.hypot(n.x - stop.x, n.y - stop.y) < 0.5), 'fixture: the access folds into its land node');
  const joined = connectFerryGraph(folded, [...pier, ferry]);
  const quay = joined.allNodes.find(n => !n.key.startsWith('ferry:') && Math.hypot(n.x - stop.x, n.y - stop.y) < 24
    && n.edges.some(e => (e.segmentMetadata[0] as any)?.ferryId === 'X'))!;
  const first = quay.edges.find(e => (e.segmentMetadata[0] as any)?.ferryId === 'X')!.node;
  assert.deepEqual([first.x, first.y], [stop.x, stop.y], 'the crossing leaves from the stop, not the folded land node');
}
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
