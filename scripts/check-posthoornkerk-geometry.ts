import * as T from 'three';import assert from 'node:assert/strict';import fs from 'node:fs';import{NodeIO}from '@gltf-transform/core';import{ALL_EXTENSIONS}from '@gltf-transform/extensions';import{MeshoptDecoder}from 'meshoptimizer';
import {buildPosthoornkerk} from './landmarks/posthoornkerk-builder';import type {BuildingTools} from './landmarks/cultural-builders';import source from './landmarks/posthoornkerk-footprints.json';import spec from './landmarks/posthoornkerk-spec.json';
const group=new T.Group();let triangles=0;const b={add(g:T.BufferGeometry,c:string){group.add(new T.Mesh(g,new T.MeshBasicMaterial({name:c,side:T.DoubleSide})));triangles+=(g.index?.count??g.attributes.position.count)/3;}} as BuildingTools;
buildPosthoornkerk(1,1,b);group.updateMatrixWorld(true);function verify(phase:string){const bounds=new T.Box3().setFromObject(group);assert(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));assert(triangles<40000);assert(bounds.max.y>63&&bounds.max.y<65,'Front iron cross native height');
const r=new T.Matrix4().makeRotationY(source.localRotationDegrees*Math.PI/180),p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(r);
function hit(x:number,y:number,z:number,dx:number,dz:number){return new T.Raycaster(p(x,y,z),new T.Vector3(dx,0,dz).transformDirection(r)).intersectObjects(group.children)[0];}
const name=(h:ReturnType<typeof hit>)=>(h?.object as T.Mesh)?.material instanceof T.Material?((h!.object as T.Mesh).material as T.Material).name:undefined;
// Across actual aperture fractions: masonry must not bury any large pane edge.
for(const [x,y,w,h] of [[-7.71,9.65,1.55,9.8],[3.92,9.65,1.55,9.8],[-3.52,9.3,1.18,8.35],[-1.77,9.3,1.18,10.3],[-.02,9.3,1.18,8.35]])for(const fx of [-.32,.14,.32])for(const fy of [.23,.37,.68])assert(['glass','frame'].includes(name(hit(x+fx*w,y+fy*h,32,0,-1))??''),JSON.stringify({x,y,fx,fy,hit:name(hit(x+fx*w,y+fy*h,32,0,-1))}));
for(const [x,dx] of [[-18,1],[18,-1]])for(const z of [-3.8,.4])for(const f of [-.27,.27])assert.equal(name(hit(x,7.3,z+f*1.5,dx,0)),'glass','Side aisle glazing first hit');
for(const [x,dx] of [[-20,1],[20,-1]])for(const [z,y] of [[-12.3,12.0],[5.9,7.1]])assert(['glass','frame'].includes(name(hit(x,y,z+.28,dx,0))??''),JSON.stringify({x,z,y,name:name(hit(x,y,z+.28,dx,0))}));
for(const [x,y,z] of [[-2.4,12.5,-24.30],[-8.62,4.7,-22.835],[4.35,4.7,-23.063]])for(const f of [-.28,.28])assert(['glass','frame'].includes(name(hit(x+f*(x===-2.4?1.15:.8),y,-35,0,1))??''),'Trefoil rear glazing first hit');
assert.equal(name(hit(-2.7,1.8,32,0,-1)),'ochre','Real paired timber entrance');
assert.equal(name(hit(-1.4,3.2,31,0,-1)),'dark','Portal recess/transom remains exposed');
// Front forecourt is not an opaque building footprint. Fence ends before probe.
for(const [x,z] of [[-1.77,32.5],[0,30.3],[-4.8,33.5]])assert(!new T.Raycaster(p(x,80,z),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0],'Forecourt must remain open overhead');
// Source-specific crown recognition: clock tower has open pointed framing,
// non-clock tower has four opaque gable shoulders close to its upper needle.
let pointedArchHits=0,openClockHeadHits=0,gabledShoulderHits=0;
for(let i=0;i<8;i++){const a=i*Math.PI/4,t=a+Math.PI/8,nx=Math.sin(t),nz=Math.cos(t),px=-7.71+Math.sin(a)*1.31,qx=-7.71+Math.sin(a+Math.PI/4)*1.31,pz=22.66+Math.cos(a)*1.31,qz=22.66+Math.cos(a+Math.PI/4)*1.31,peakX=(px+qx)/2,peakZ=(pz+qz)/2;
 const h=hit((px+peakX)/2+nx*2,53.55,(pz+peakZ)/2+nz*2,-nx,-nz);assert.equal(name(h),'stone','Clock crown pointed arch frame exposed above old flat cage');assert(h!.distance<2.1);pointedArchHits++;
 const gap=hit(-7.71+nx*4,53.05,22.66+nz*4,-nx,-nz);assert.equal(name(gap),'slate','Clock arch opening reaches recessed needle, not opaque shoulder');assert(gap!.distance>2.87,'Clock crown gap must remain open in front of recessed needle');openClockHeadHits++;
}
for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const u of [-.58,.58]){const nx=Math.sin(a),nz=Math.cos(a),tx=Math.cos(a),tz=-Math.sin(a),h=hit(3.92+nx*4+tx*u,53.0,22.66+nz*4+tz*u,-nx,-nz);assert.equal(name(h),'slate','Non-clock source gabled shoulder exposed');assert(Math.abs(h!.distance-3.00)<.02,'Non-clock gable field stands outside upper needle');gabledShoulderHits++;}
// Post bases must touch the existing lower octagonal ledge, not a distant roof.
let supportedPosts=0;const previousSides=(group.children as T.Mesh[]).map(m=>(m.material as T.Material).side);
for(const m of group.children as T.Mesh[])(m.material as T.Material).side=T.FrontSide;
for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const u of [-.96,.96]){const x=3.92+Math.sin(a)*1.00+Math.cos(a)*u,z=22.66+Math.cos(a)*1.00-Math.sin(a)*u,h=new T.Raycaster(p(x,50.04,z),new T.Vector3(0,-1,0),0,.05).intersectObjects(group.children)[0];assert(h,'Non-clock stanchion has adjacent ledge support');assert.equal(name(h),'stone','Support must be actual stone ledge');assert(Math.abs(h!.point.y-50.02)<.01,'Support is lower ledge top, not distant roof');assert(h!.face!.normal.y>.99,'Support face is upward ledge plane');supportedPosts++;}
for(const [i,m] of (group.children as T.Mesh[]).entries())(m.material as T.Material).side=previousSides[i];
console.log(JSON.stringify({phase,nonClockLedgeSupports:supportedPosts}));
// Solid non-clock short body reaches its ledge; clock lower band stays open.
let connectedBodyProbes=0,clockBandProbes=0;
for(const m of group.children as T.Mesh[])(m.material as T.Material).side=T.FrontSide;
for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8,nx=Math.sin(a),nz=Math.cos(a);for(const y of [50.25,50.9,51.6]){const h=hit(3.92+nx*4,y,22.66+nz*4,-nx,-nz);assert.equal(name(h),'slate','Non-clock connected body exposed');assert(h!.distance>2.70&&h!.distance<3.12,'Short body owns intended recessed face');connectedBodyProbes++;const gap=new T.Raycaster(p(-7.71+nx*4,y,22.66+nz*4),new T.Vector3(-nx,0,-nz).transformDirection(r),0,8).intersectObjects(group.children)[0];assert(!gap,'Clock lower crown band remains open');clockBandProbes++;}}
for(const [i,m] of (group.children as T.Mesh[]).entries())(m.material as T.Material).side=previousSides[i];
console.log(JSON.stringify({phase,connectedBodyProbes,clockBandProbes}));

console.log(JSON.stringify({phase,sourceCrownChecks:{pointedArchHits,openClockHeadHits,gabledShoulderHits},unchangedTowerTop:bounds.max.y}));
for(const [x,z,y0,y1] of [[-2,0,26.5,27.3],[-4.5,0,23,26],[-8,0,14,16.7]]){const h=new T.Raycaster(p(x,80,z),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert.equal(name(h),'slate');assert(h!.point.y>y0&&h!.point.y<y1,'Distinct native nave/aisle roof heights');}
let crownGableFaces=0;for(const m of group.children as T.Mesh[])if((m.material as T.Material).name==='slate'){const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,pos=g.attributes.position,inverse=r.clone().invert();for(let i=0;i<pos.count;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,i+k)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize(),local=v.map(p=>p.clone().applyMatrix4(inverse)),center=local.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/3);const crownWall=local.every(p=>p.y>=52.19&&p.y<=55.36)&&Math.min(...local.map(p=>p.y))<52.22&&Math.max(...local.map(p=>p.y))>55.32&&Math.abs(center.x-3.92)<1.4&&Math.abs(center.z-22.66)<1.4;if(crownWall){const direction=new T.Vector3(center.x-3.92,0,center.z-22.66).normalize().transformDirection(r);assert(normal.dot(direction)>.99,'Source non-clock crown gable faces outward');crownGableFaces++;}else assert(normal.y>=-1e-6,JSON.stringify({phase,index:i,normal:normal.y,position:v[0].toArray()}));}}
assert.equal(crownGableFaces,4,'Four separate non-clock gable fields; all other slate faces still face upward');
assert.deepEqual(spec.suppressOsmIds,['w43040630','NL.IMBAG.Pand.0363100012167529']);assert.equal(spec.spatialSuppression,false);for(const n of source.preserveNeighbors)assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+n.bagId));
console.log(JSON.stringify({model:'posthoornkerk',phase,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['fractional exposed principal lights','side aisle/transept glazing','trefoil rear chapel glazing','real entrance first hit','open forecourt','distinct supported nave/aisle roofs','upward slate faces','exact single parent suppression'],visualAcceptance:'pending root gallery/live scene/physical card'}));

}
verify('builder');
const draft=process.argv[2]??'artifacts/posthoornkerk-draft/posthoornkerk.glb';
if(fs.existsSync(draft)){await MeshoptDecoder.ready;const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(draft);assert(fs.statSync(draft).size<500000);assert.equal(doc.getRoot().listTextures().length,0);group.clear();triangles=0;for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());for(const prim of mesh.listPrimitives()){const pos=prim.getAttribute('POSITION')!,ix=prim.getIndices()?.getArray(),values:number[]=[];for(let i=0;i<(ix?.length??pos.getCount());i++){const j=ix?ix[i]:i;values.push(...new T.Vector3(...pos.getElement(j,[])).applyMatrix4(matrix).toArray());}const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(values,3));geom.computeVertexNormals();b.add(geom,prim.getMaterial()!.getName() as any);}}group.updateMatrixWorld(true);verify('decoded compressed GLB');}
