import assert from 'node:assert/strict';
import * as T from 'three';
import {buildWesterkerk} from './landmarks/westerkerk-builder';
import source from './landmarks/westerkerk-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group(),lowRoofs=new T.Group();
const roofPlanes:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);if(_c==='slate'&&g instanceof T.ShapeGeometry){roofPlanes.push(g);g.computeBoundingBox();if(g.boundingBox!.min.y>4&&g.boundingBox!.max.y<4.5)lowRoofs.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));}group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildWesterkerk(1,1,tools);group.updateMatrixWorld(true);lowRoofs.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}assert.ok(triangles<40000);
for(const g of roofPlanes){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.01,'explicit church roof faces upward');}
const bounds=new T.Box3().setFromObject(group);assert.ok(Math.abs(bounds.max.y-87)<.01,'main tower remains87m');
const ray=(g:T.Group,x:number,z:number,y=100,far=101)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,-1,0),0,far).intersectObject(g,true);
for(const [x,z] of source.annexRepair.courtyardProbes)assert.equal(ray(group,x,z).length,0,`courtyard open at ${x},${z}`);
for(const [x,z] of [[-26,-14],[-25,-17]])assert.equal(ray(group,x,z,9,9).length,0,'independent neighbor2174222 interior contains no church shell');
assert.equal(lowRoofs.children.length,4,'all four exact survey roof surfaces retained');
function inside(x:number,z:number,r:number[][]){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])yes=!yes;}return yes;}
const aisleRing=source.parts.find(p=>p.osmId==='w749268115')!.localPolygons[0][0];
function distanceToAisleWall(x:number,z:number){return Math.min(...aisleRing.slice(0,-1).map((a,i)=>{const b=aisleRing[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}));}
let samples=0,misses=0,blockedInFullModel=0,maxVertexDelta=0,exposedRoofSamples=0,exposedRoofMisses=0,maxBlockedWallDistance=0;
const planeReports=[];
for(const plane of source.annexRepair.lowChurchRoofPlanes){let count=0;const vs=plane.vertices,minX=Math.min(...vs.map(v=>v[0])),maxX=Math.max(...vs.map(v=>v[0])),minZ=Math.min(...vs.map(v=>v[2])),maxZ=Math.max(...vs.map(v=>v[2]));
 for(let x=minX+.08;x<maxX;x+=.15)for(let z=minZ+.08;z<maxZ;z+=.15)if(inside(x,z,vs)){samples++;count++;const roof=ray(lowRoofs,x,z,4.6,.7);if(!roof.length)misses++;else{assert.ok(roof[0].face!.normal.y>.8,'low roof upward');assert.ok(roof[0].point.y>4.13&&roof[0].point.y<4.39,'bounded low roof height');const full=ray(group,x,z);const distance=distanceToAisleWall(x,z),blocked=full.length&&Math.abs(full[0].point.y-roof[0].point.y)>.01;if(blocked){blockedInFullModel++;maxBlockedWallDistance=Math.max(maxBlockedWallDistance,distance);}if(distance>.6){exposedRoofSamples++;if(blocked||!full.length)exposedRoofMisses++;}}}
 const allPositions=lowRoofs.children.flatMap(o=>{const p=(o as T.Mesh).geometry.getAttribute('position');return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);});
 for(const v of vs){const delta=Math.min(...allPositions.map(p=>Math.hypot(p[0]-v[0],p[1]-v[1],p[2]-v[2])));maxVertexDelta=Math.max(maxVertexDelta,delta);assert.ok(delta<.00001,'recovered survey vertex preserved within Float32 tolerance');}
 planeReports.push({surfaceIndex:plane.surveySurfaceIndex,vertices:vs.length,interiorSamples:count});
}
assert.ok(samples>1000,'dense interior roof sample');assert.equal(misses,0,'decoded roof polygon interior has complete roof coverage');assert.ok(exposedRoofSamples>1000,'broad exterior roof coverage beyond facade relief');assert.equal(exposedRoofMisses,0,'full-scene exposed roof samples first hit actual low roofs');
console.log(JSON.stringify({triangles,bounds,courtyardOpen:true,independentNeighborNotDuplicated:true,roofOnlySamples:samples,roofCoverageMisses:misses,surveyVertexMaxDelta:maxVertexDelta,blockedInFullModel,maxBlockedWallDistance,exposedRoofSamples,exposedRoofMisses,planeReports,acceptance:'CPU checkpoint only; native gallery/game and boundary-neighbor visual review pending'},null,2));
