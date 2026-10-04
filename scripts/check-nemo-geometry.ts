import assert from 'node:assert/strict';
import * as T from 'three';
import {buildNemo} from './landmarks/nemo-builder';
import spec from './landmarks/nemo-spec.json';
import source from './landmarks/nemo-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildNemo(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}
assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(Math.abs(bounds.max.y-32.57)<.01);assert.ok(bounds.max.x-bounds.min.x<46&&bounds.max.z-bounds.min.z<119);
const vertices=geometries.flatMap(g=>{const p=g.getAttribute('position');return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);});
// Every actual part outline reaches its original mapped maximum at its
// northern edge; the public piazza is separate from the 32.57m shell.
for(const part of source.parts){const z0=part.bounds[1],top=Number(part.properties.height),north=part.localPolygons.flatMap(poly=>poly[0].filter(p=>Math.abs(p[1]-z0)<1e-5));for(const [x,z] of north)assert.ok(vertices.some(p=>Math.abs(p[0]-x)<1e-4&&Math.abs(p[1]-top)<1e-4&&Math.abs(p[2]-z)<1e-4),'native northern outline/recorded maximum '+part.osmId);}
const stairs=source.parts.find(p=>p.osmId==='w1390692772')!;
const heights=new Set(vertices.filter(p=>p[1]>=2.49&&p[1]<=21.71&&p[2]>=stairs.bounds[1]&&p[2]<=stairs.bounds[3]).map(p=>p[1].toFixed(4)));assert.ok(heights.size>100,'visible stepped piazza has individual height levels');
const hit=(x:number,z:number)=>new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0)).intersectObject(group,true);
assert.equal(hit(50,0).length,0,'adjacent bridge/harbor outside mapped building not capped');assert.equal(hit(0,65).length,0,'southern tunnel approach not capped');assert.equal(hit(0,-65).length,0,'northern approach not capped');
const greenRoof=hit(-.015,-38.25)[0];assert.ok(greenRoof&&greenRoof.point.y>26&&greenRoof.point.y<27.5,'inner green roof remains visible below the curved outer copper rim');
const stairLow=hit(-.165,40)[0],stairHigh=hit(-.165,0)[0];assert.ok(stairLow&&stairHigh&&stairHigh.point.y>stairLow.point.y+8,'public roof actually ascends northward rather than becoming a flat box');
assert.equal(source.parts.length,10);assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,12);
console.log({triangles,bounds,nativeParts:source.parts.length,stairLevels:heights.size});

// Inspect actual generated roof boundary edges against actual wall triangles.
// Endpoint-only wall chords leave a measurable gap beneath curved roofs.
const wallTriangles:T.Triangle[]=[];
for(const g of geometries.filter(g=>g.type==='BufferGeometry')){const p=g.getAttribute('position'),idx=g.index;for(let i=0;i<(idx?.count||p.count);i+=3)wallTriangles.push(new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j)) as [T.Vector3,T.Vector3,T.Vector3]));}
const outlines=source.parts.flatMap(p=>p.localPolygons.flatMap(poly=>poly.flatMap(r=>r.slice(0,-1).map((a,i)=>[new T.Vector2(...a as [number,number]),new T.Vector2(...r[i+1] as [number,number])]))));
function onSegment(v:T.Vector3,a:T.Vector2,b:T.Vector2){const p=new T.Vector2(v.x,v.z),ab=b.clone().sub(a),t=p.clone().sub(a).dot(ab)/ab.lengthSq();return t>=-1e-5&&t<=1.00001&&p.distanceTo(a.clone().addScaledVector(ab,t))<1e-4;}
let seamSamples=0,worstSeam=0;const scratch=new T.Vector3();
for(const g of geometries.filter(g=>g.type==='ShapeGeometry')){const p=g.getAttribute('position'),idx=g.index;for(let i=0;i<(idx?.count||p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j));for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];if(a.distanceTo(b)<1e-5||!outlines.some(([q,r])=>onSegment(a,q,r)&&onSegment(b,q,r)))continue;for(const t of [.25,.5,.75]){const point=a.clone().lerp(b,t);let distance=Infinity;for(const tri of wallTriangles){tri.closestPointToPoint(point,scratch);distance=Math.min(distance,scratch.distanceTo(point));if(distance<1e-5)break;}worstSeam=Math.max(worstSeam,distance);seamSamples++;}}}}
assert.ok(seamSamples>1000);assert.ok(worstSeam<.001,`actual roof-to-wall perimeter gap ${worstSeam}m`);console.log({seamSamples,worstSeam});
