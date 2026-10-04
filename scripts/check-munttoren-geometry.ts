import assert from 'node:assert/strict';
import * as T from 'three';
import {buildMunttoren} from './landmarks/munttoren-builder';
import spec from './landmarks/munttoren-spec.json';
import source from './landmarks/munttoren-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildMunttoren(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}
const counts:Record<string,number>={};for(const g of geometries)counts[g.type]=(counts[g.type]||0)+(g.index?.count||g.getAttribute('position').count)/3;console.log({triangles,counts});assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y<=41.01&&bounds.max.y>=40.99);assert.ok(bounds.max.x-bounds.min.x<32&&bounds.max.z-bounds.min.z<12);

assert.equal(source.parts.length,8);assert.equal(spec.spatialSuppression,false);console.log(bounds);

const link=source.parts.find(p=>p.osmId==='w751683818')!,ring=link.localPolygons[0][0];const centre=ring.slice(0,-1).reduce((s,p)=>[s[0]+p[0]/(ring.length-1),s[1]+p[1]/(ring.length-1)],[0,0]);
for(let y=.2;y<2.8;y+=.4){const hits=new T.Raycaster(new T.Vector3(centre[0],y,centre[1]),new T.Vector3(0,1,0),0,2.99-y).intersectObject(group,true);assert.equal(hits.length,0,'mapped 3m covered connector remains open');}
assert.ok(new T.Raycaster(new T.Vector3(centre[0],.1,centre[1]),new T.Vector3(0,1,0),0,10).intersectObject(group,true).some(hit=>hit.point.y>=2.99&&hit.point.y<=6.01),'connector roof is present above the clear passage');
console.log('3m covered connector preserved with source roof above');
