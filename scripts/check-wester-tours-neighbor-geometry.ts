import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {buildWesterToursNeighbor} from './landmarks/wester-tours-neighbor-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/wester-tours-neighbor-spec.json';
const meshes:T.Mesh[]=[],bounds=new T.Box3();
const b={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial());m.userData.colour=c;m.updateMatrixWorld();g.computeBoundingBox();bounds.union(g.boundingBox!);meshes.push(m);}} as BuildingTools;
b.box=(x,y,z,w,h,d,c,a=0)=>b.add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildWesterToursNeighbor(0,0,b);
assert(bounds.min.y>=-.001);assert(bounds.max.y>8.8&&bounds.max.y<9.2);assert.deepEqual(spec.suppressOsmIds,['w266616392','NL.IMBAG.Pand.0363100012174413']);assert(!spec.spatialSuppression);
const ex=.878900381,ez=.477005367,at=(u:number,y:number,v:number)=>new T.Vector3(u*ex-v*ez,y,u*ez+v*ex);
let exposed=0;const failures:any[]=[];
function check(point:T.Vector3,normal:T.Vector3,name:string){const hits=new T.Raycaster(point.clone().addScaledVector(normal,3),normal.clone().negate()).intersectObjects(meshes);if(hits[0]?.object.userData.colour!=='glass'&&hits[0]?.object.userData.colour!=='white')failures.push({name,point:point.toArray(),hit:hits[0]?.object.userData.colour});exposed++;}
for(const u of [-15.4,-11.4,-7.4,-3.4,.6,4.6])for(const delta of [-.73,.73])for(const f of [-.42,-.18,.18,.42])for(const y of [1.3,1.8,2.2,2.9])check(at(u+delta+f,y,-5.96),new T.Vector3(ez,0,-ex),'north-pane');
for(let i=0;i<8;i++)for(const f of [-.45,-.2,.2,.45])for(const y of [1.1,1.6,2.1,2.5])check(at(14.9,y,-4.95+i*1.47+f),new T.Vector3(ex,0,ez),'front-pane');
for(const v of [-2.25,-1.15])for(const y of [6.2,7])check(at(9.65,y,v),new T.Vector3(ex,0,ez),'round-gable');
assert.equal(failures.length,0,JSON.stringify(failures));
await MeshoptDecoder.ready;const file='artifacts/wester-tours-neighbor-cpu/wester-tours-neighbor-compressed.glb',bytes=fs.readFileSync(file),doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file);let triangles=0,roofTriangles=0,roofMinNormal=1;
for(const m of doc.getRoot().listMaterials())assert.equal(m.getMetallicFactor(),0,'Metallic architectural material');
for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());for(const prim of mesh.listPrimitives()){const p=prim.getAttribute('POSITION')!,ix=prim.getIndices()?.getArray();for(let i=0;i<(ix?.length??p.getCount());i+=3){const pts=[0,1,2].map(k=>new T.Vector3(...p.getElement(ix?ix[i+k]:i+k,[])).applyMatrix4(matrix));assert(pts.every(p=>p.toArray().every(Number.isFinite)));triangles++;if(String(prim.getExtras().role).startsWith('survey-roof-')){const cross=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));assert(cross.length()>1e-5);const ny=cross.normalize().y;assert(ny>.3,'Downward decoded roof');roofMinNormal=Math.min(roofMinNormal,ny);roofTriangles++;}}}}
assert.equal(doc.getRoot().listTextures().length,0);assert(bytes.length<500000);assert(triangles<40000);assert(roofTriangles>10);
const result={ok:true,triangles,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},glazingFirstHitSamples:exposed,failedGlazingSamples:failures,roofTriangles,roofMinNormal,metallicFactor:0,scope:'CPU mesh and glazing only; native game/gallery/neighbor/fallback acceptance pending'};fs.writeFileSync('artifacts/wester-tours-neighbor-cpu/geometry-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
