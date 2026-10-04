import assert from 'node:assert/strict';
import * as T from 'three';
import {buildBeursBerlage} from './landmarks/beurs-berlage-builder';
import spec from './landmarks/beurs-berlage-spec.json';
import source from './landmarks/beurs-berlage-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],brickGeometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);if(_c==='brick')brickGeometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildBeursBerlage(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}
const counts:Record<string,number>={};for(const g of geometries)counts[g.type]=(counts[g.type]||0)+(g.index?.count||g.getAttribute('position').count)/3;console.log({triangles,counts});assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y<=40.01&&bounds.max.y>=39.99);assert.ok(bounds.max.x-bounds.min.x<133&&bounds.max.z-bounds.min.z<140);

assert.equal(source.parts.length,40);assert.equal(spec.spatialSuppression,false);console.log(bounds);


const hasVertex=(x:number,y:number,z:number)=>geometries.some(g=>{const p=g.getAttribute('position');for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<1e-4&&Math.abs(p.getY(i)-y)<1e-4&&Math.abs(p.getZ(i)-z)<1e-4)return true;return false;});
for(const part of source.parts){const tags=part.properties as Record<string,string>,base=Number(tags.min_height||0),top=Number(tags.height),eaves=top-Number(tags['roof:height']||0),glass=tags['roof:material']==='glass';if(!glass)for(const poly of part.localPolygons)for(const [x,z] of poly[0])assert.ok(hasVertex(x,base,z),'source part base/recorded minimum preserved '+part.osmId);if(top===3||top===7)for(const poly of part.localPolygons)for(const [x,z] of poly[0])assert.ok(hasVertex(x,top,z),'low source court remains at mapped height '+part.osmId);}
const glass=source.parts.find(p=>p.properties['roof:material']==='glass')!,pts=glass.localPolygons[0][0].slice(0,-1),centre=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0]);
assert.equal(new T.Raycaster(new T.Vector3(centre[0],6.9,centre[1]),new T.Vector3(0,-1,0)).intersectObject(group,true).length,0,'mapped glazed inner court remains open below its roof');
assert.ok(new T.Raycaster(new T.Vector3(centre[0],20,centre[1]),new T.Vector3(0,-1,0)).intersectObject(group,true).some(hit=>hit.point.y>=7&&hit.point.y<=10.01),'mapped glass roof delivered');
assert.ok(spec.suppressOsmIds.includes('w57858502'));assert.equal(spec.suppressOsmIds.length,42);console.log('Forty native parts, low courts, recorded minimums and hollow glazed court passed');

// Flat gray roof planes must not compete with the brick extrusion's top cap.
// This checks actual triangle surfaces, not an implementation helper flag.
for(const g of brickGeometries){const p=g.getAttribute('position'),idx=g.index;for(let i=0;i<(idx?.count||p.count);i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;const A=new T.Vector3().fromBufferAttribute(p,a),B=new T.Vector3().fromBufferAttribute(p,b),C=new T.Vector3().fromBufferAttribute(p,c),normal=B.clone().sub(A).cross(C.clone().sub(A));assert.ok(!(Math.abs(A.y-B.y)<1e-5&&Math.abs(A.y-C.y)<1e-5&&normal.y>1e-6),'no upward horizontal brick cap coplanar with the roof');}}
console.log('Flat roof surfaces have no duplicate brick top caps');
