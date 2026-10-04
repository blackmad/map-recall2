import assert from 'node:assert/strict';
import * as T from 'three';
import {buildRijksmuseum} from './rijksmuseum-builder';
import spec from './rijksmuseum-spec.json';
import source from './rijksmuseum-footprints.json';
import type {BuildingTools} from './cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildRijksmuseum(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}
const counts:Record<string,number>={};for(const g of geometries)counts[g.type]=(counts[g.type]||0)+(g.index?.count||g.getAttribute('position').count)/3;console.log({triangles,counts});assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y<=56&&bounds.max.y>=54);assert.ok(bounds.max.x-bounds.min.x<145&&bounds.max.z-bounds.min.z<125);
const theta=(spec.footprint.headingDegrees+180)*Math.PI/180,anchor=spec.footprint.centre;
const local=([lng,lat]:number[])=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*111320;return[e*Math.sin(theta)+n*Math.cos(theta),e*Math.cos(theta)-n*Math.sin(theta)];};
const ray=new T.Raycaster(),checks=[];
for(const f of source.passage.sourceLines.filter(f=>['w219327099','w310324474','w310324477'].includes(f.id))){const points=f.geometry.coordinates.map(local);let checked=0;for(let i=0;i<points.length-1;i++)for(let t=0.04;t<1;t+=.04){const a=points[i],b=points[i+1],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;ray.set(new T.Vector3(x,4.5,z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(group,true).length,0,`actual mapped passage ${f.id} remains clear at ${x},${z}`);checked++;}checks.push({id:f.id,checked});}
for(const part of source.parts.filter(p=>p.tags['roof:material']==='glass')){const [x0,z0,x1,z1]=part.bounds;ray.set(new T.Vector3((x0+x1)/2,15,(z0+z1)/2),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(group,true).length,0,`roofed atrium ${part.osmId} is hollow below its glazing`);ray.ray.direction.set(0,1,0);assert.ok(ray.intersectObject(group,true).length>0,`mapped glass roof ${part.osmId} retained`);}
assert.equal(source.parts.length,30);assert.equal(source.parts.filter(p=>p.tags['roof:material']==='glass').length,2);assert.ok(source.parts.filter(p=>p.tags.height==='54').length===2);
console.log(JSON.stringify({triangles,geometryParts:geometries.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},passageChecks:checks,sourceParts:source.parts.length}));
