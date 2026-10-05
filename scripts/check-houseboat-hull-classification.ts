import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyHouseboatHull,houseboatGeometry,type Houseboat} from '../src/canalRecall/houseboats.ts';
import {fitRect} from '../src/canalRecall/roofMesh.ts';
const rectangle:[number,number][]=[[-10,-2],[10,-2],[10,2],[-10,2]];
const densify=(ring:[number,number][])=>ring.flatMap((p,i)=>{const q=ring[(i+1)%ring.length];return Array.from({length:8},(_,j)=>[p[0]+(q[0]-p[0])*j/8,p[1]+(q[1]-p[1])*j/8] as [number,number]);});
assert.equal(classifyHouseboatHull(rectangle,20,4),'ark');
assert.equal(classifyHouseboatHull(densify(rectangle),20,4),'ark','extra traced vertices do not turn a pontoon into a ship');
const pointed:[number,number][]=[[-10,-2],[6,-2],[10,0],[6,2],[-10,2]];
assert.equal(classifyHouseboatHull(pointed,20,4),'barge','a simply mapped genuine bow does not require nine vertices');
assert.equal(classifyHouseboatHull(densify(pointed),20,4),'barge');
assert.equal(classifyHouseboatHull([...pointed].reverse(),20,4),'barge','winding does not select boat type');
const {boats}:{boats:Houseboat[]}=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json','utf8'));
let counts={ark:0,barge:0,changedFromVertexRule:0,skippedDegenerate:0};
for(const boat of boats){
 const origin={lng:boat.ring[0][0],lat:boat.ring[0][1]},kx=111320*Math.cos(origin.lat*Math.PI/180);
 const points=boat.ring.map(([lng,lat])=>[(lng-origin.lng)*kx,(lat-origin.lat)*110540] as [number,number]);
 if(points.length>1&&points[0][0]===points.at(-1)![0]&&points[0][1]===points.at(-1)![1])points.pop();
 const rect=fitRect([...points,points[0]],64);if(!rect){counts.skippedDegenerate++;continue;}
 let {ux,uy,len:length,wid:width,cx,cy}=rect;if(width>length){[ux,uy]=[-uy,ux];[length,width]=[width,length];}
 const local=points.map(([x,y])=>[(x-cx)*ux+(y-cy)*uy,-(x-cx)*uy+(y-cy)*ux] as [number,number]);
 const form=classifyHouseboatHull(local,length,width);counts[form]++;
 if(form!==(points.length>8?'barge':'ark'))counts.changedFromVertexRule++;
 if(boat.id==='w174999382')assert.equal(form,'barge','Hendrika Maria retains its ship hull');
 const geometry=houseboatGeometry(boat,origin);assert(geometry||points.length<3);
 if(boat.id==='w96706553'&&geometry){
  const hullVertices=geometry.tris.flatMap(t=>t.p).filter(p=>Math.abs(p[2]+.1)<1e-8);
  assert(hullVertices.length>0);
  assert(hullVertices.every(p=>points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8)),'pontoon waterline preserves mapped notch vertices rather than fitted rectangle');
 }
 if(boat.id==='w57863486')assert.equal(form,'ark','densely traced rectangular pontoon stays residential');
}
console.log('Footprint classification checks passed',counts);
