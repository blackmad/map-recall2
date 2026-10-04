import assert from 'node:assert/strict';
import * as T from 'three';
import {buildPalaceDam} from './landmarks/palace-dam-builder';
import spec from './landmarks/palace-dam-spec.json';
import source from './landmarks/palace-dam-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=_c;group.add(m);};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildPalaceDam(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(Math.abs(bounds.max.y-55)<.01);assert.ok(bounds.max.x-bounds.min.x<69&&bounds.max.z-bounds.min.z<85);
const hit=(x:number,z:number)=>new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0)).intersectObject(group,true);
assert.equal(source.parent.localPolygons[0].length,3);for(const ring of source.parent.localPolygons[0].slice(1)){const pts=ring.slice(0,-1),centre=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0]);assert.equal(hit(centre[0],centre[1]).length,0,'actual mapped inner courtyard remains open to the sky');}
assert.equal(hit(40,0).length,0,'Dam square outside source building not filled');assert.equal(hit(-40,0).length,0,'Nieuwezijds street outside source building not filled');
assert.ok(Math.abs(source.towerHeightEvidence.maximumAboveGround-55)<.3,'official tower top corroborated independently by current measured3DBAG maximum');
assert.equal(source.parts.length,18);assert.equal(spec.spatialSuppression,false);assert.ok(!spec.suppressOsmIds.includes('w220749328'),'neighboring Nieuwe Kerk not suppressed');
console.log({triangles,bounds,courtyards:2,measuredMaximumAboveGround:source.towerHeightEvidence.maximumAboveGround});

const vertices=geometries.flatMap(g=>{const p=g.getAttribute('position');return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);});
for(const part of source.parts){const base=Number((part.properties as Record<string,string>).min_height||0);for(const poly of part.localPolygons)for(const [x,z] of poly[0])assert.ok(vertices.some(p=>Math.abs(p[0]-x)<1e-4&&Math.abs(p[1]-base)<1e-4&&Math.abs(p[2]-z)<1e-4),'native mapped part base '+part.osmId);}
console.log('All eighteen exact mapped part base outlines retained, including30m tower minimum');

// The north/south centre windows must be in front of the mapped part walls,
// including parts whose edge extends beyond the parent outline.
const facade=source.facadePolygons[0][0],winding=Math.sign(facade.slice(0,-1).reduce((s,p,i)=>s+p[0]*facade[i+1][1]-facade[i+1][0]*p[1],0))||1;let visibleSideWindows=0;
for(let i=0;i<facade.length-1;i++){const p=facade[i],q=facade[i+1],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<15||Math.abs((p[1]+q[1])/2)<30)continue;const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),count=Math.max(1,Math.round(length/4.25)),t=.5/count,x=p[0]+dx*t+Math.cos(a)*.35,z=p[1]+dz*t-Math.sin(a)*.35;const hits=new T.Raycaster(new T.Vector3(x+nx*5,8.6,z+nz*5),new T.Vector3(-nx,0,-nz),0,6).intersectObject(group,true);assert.equal(hits[0]?.object.userData.colour,'glass','side facade window sits in front of native source wall');visibleSideWindows++;}assert.equal(visibleSideWindows,2);console.log({visibleSideWindows});
