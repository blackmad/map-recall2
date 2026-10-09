/** First-hit probes across pane faces reproduce the lower masonry occlusion.
 * Inspect decoded GLB geometry rather than assumed builder coordinates. */
import assert from 'node:assert/strict';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import specs from './landmarks/retail-cinema-specs.json';
import footprints from './landmarks/retail-cinema-footprints.json';
const spec=specs.find(s=>s.id==='kriterion')!, source=footprints.find(f=>f.id==='kriterion')!;
const h=(spec.footprint.headingDegrees+180)*Math.PI/180;
const local=([lng,lat]:number[])=>{const e=(lng-spec.footprint.centre[0])*111320*Math.cos(spec.footprint.centre[1]*Math.PI/180),n=(lat-spec.footprint.centre[1])*111320;return new T.Vector3(e*Math.sin(h)+n*Math.cos(h),0,e*Math.cos(h)-n*Math.sin(h));};
const p=local(source.ring[11]),q=local(source.ring[13]),streetNormal=new T.Vector3(-(q.z-p.z),0,q.x-p.x).normalize(),streetPlane=p.dot(streetNormal);

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const path=process.argv[2]??'public/canal-drive/models/kriterion.glb';
const doc=await io.read(path),meshes:T.Mesh[]=[];
for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
 const position=primitive.getAttribute('POSITION')!,values:number[]=[];
 for(let i=0;i<position.getCount();i++)values.push(...position.getElement(i,[]));
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));
 if(primitive.getIndices())geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));
 mesh.name=primitive.getMaterial()!.getName();mesh.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));mesh.updateMatrixWorld();meshes.push(mesh);
}
const faces=new Map<string,{normal:T.Vector3,tangent:T.Vector3,plane:number,u0:number,u1:number,y0:number,y1:number}>();
for(const mesh of meshes.filter(m=>m.name==='dark')){
 const position=mesh.geometry.getAttribute('position'),indices=mesh.geometry.getIndex();
 for(let i=0;i<(indices?.count??position.count);i+=3){
  const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,indices?indices.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
  const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  // Rear balcony side faces can share this normal; require the surveyed street plane too.
  if(normal.dot(streetNormal)<.98||Math.min(...points.map(p=>p.y))<5||Math.abs(points[0].dot(streetNormal)-streetPlane)>1)continue;
  const tangent=new T.Vector3(normal.z,0,-normal.x),us=points.map(p=>p.dot(tangent));
  const face={normal,tangent,plane:points[0].dot(normal),u0:Math.min(...us),u1:Math.max(...us),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y))};
  const key=[face.u0,face.u1,face.y0,face.y1,face.plane].map(v=>v.toFixed(3)).join(',');faces.set(key,face);
 }
}
assert.equal(faces.size,12,'Twelve street-facing glazed windows');
// Unequal horizontal/vertical fractions avoid exact shared triangle diagonals,
// where floating-point ray/triangle edge tests can miss both adjoining faces.
let samples=0;const failures:object[]=[];
for(const face of faces.values())for(const u of [.08,.25,.4,.6,.75,.92])for(const y of [.09,.21,.44,.56,.79,.91])for(const angle of [-Math.PI/6,0,Math.PI/6]){
 const target=face.normal.clone().multiplyScalar(face.plane).addScaledVector(face.tangent,face.u0+u*(face.u1-face.u0));target.y=face.y0+y*(face.y1-face.y0);
 const outward=face.normal.clone().applyAxisAngle(new T.Vector3(0,1,0),angle);
 const hit=new T.Raycaster(target.clone().addScaledVector(outward,50),outward.clone().negate()).intersectObjects(meshes)[0];samples++;
 if(!['dark','white'].includes(hit?.object.name??''))failures.push({target:target.toArray(),angleDegrees:angle*180/Math.PI,firstMaterial:hit?.object.name});
}
console.log(JSON.stringify({model:path,windows:faces.size,samples,masonryFailures:failures.length,firstFailures:failures.slice(0,6)},null,2));
assert.equal(failures.length,0,'Every sampled pane point must first hit glazing or its intentional white mullions');
