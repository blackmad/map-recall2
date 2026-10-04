import assert from 'node:assert/strict';
import * as T from 'three';
import {buildNieuweKerk} from './landmarks/nieuwe-kerk-builder';
import spec from './landmarks/nieuwe-kerk-spec.json';
import source from './landmarks/nieuwe-kerk-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=_c;group.add(m);};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildNieuweKerk(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(Math.abs(bounds.max.y-46)<.01);assert.ok(bounds.max.x-bounds.min.x<99&&bounds.max.z-bounds.min.z<69);
const vertices=geometries.flatMap(g=>{const p=g.getAttribute('position');return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);});for(const part of source.parts){const base=Number((part.properties as Record<string,string>).min_height||0);for(const poly of part.localPolygons)for(const [x,z] of poly[0])assert.ok(vertices.some(p=>Math.abs(p[0]-x)<1e-4&&Math.abs(p[1]-base)<1e-4&&Math.abs(p[2]-z)<1e-4),'native mapped part base '+part.osmId);}
assert.equal(source.parts.length,19);assert.equal(spec.spatialSuppression,false);assert.ok(!spec.suppressOsmIds.includes('w747924620'),'neighbor-owned old roof part not masked');assert.ok(!spec.suppressOsmIds.includes('w266639534'),'actual neighboring parent retained');assert.ok(spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012169079'));for(const id of ['w748997143','w748997144'])assert.ok(spec.suppressOsmIds.includes(id),'newly mapped actual tourelle '+id);
console.log({triangles,bounds,parts:source.parts.length});
// Signature entrance must be physically visible on the WEST facade between
// the two mapped tourelles, with lower doors on the projecting source aisle.
const [ex,ez]=source.westEntrance.point,[vx,vz]=source.westEntrance.normal,ux=vz,uz=-vx;
const doorHits=new T.Raycaster(new T.Vector3(ex+ux*.5+vx*5,2,ez+uz*.5+vz*5),new T.Vector3(-vx,0,-vz),0,6).intersectObject(group,true);assert.equal(doorHits[0]?.object.userData.colour,'dark','lower western entrance is visible ahead of native walls');
const facade=source.parts.find(p=>p.osmId==='w747911441')!,cx=(facade.bounds[0]+facade.bounds[2])/2,cz=(facade.bounds[1]+facade.bounds[3])/2,shift=Math.max(...facade.localPolygons[0][0].map(p=>p[0]*vx+p[1]*vz))-cx*vx-cz*vz,fx=cx+vx*shift,fz=cz+vz*shift;
const windowHits=new T.Raycaster(new T.Vector3(fx+ux*.9+vx*5,16.7,fz+uz*.9+vz*5),new T.Vector3(-vx,0,-vz),0,6).intersectObject(group,true);assert.equal(windowHits[0]?.object.userData.colour,'dark','primary western tracery window is visible ahead of native walls');
console.log('Actual western portal and large tracery pane are drawable');
