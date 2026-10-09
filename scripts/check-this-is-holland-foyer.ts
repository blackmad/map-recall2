import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildThisIsHolland} from './landmarks/this-is-holland-builder';
import spec from './landmarks/this-is-holland-spec.json';

// A glass first-hit is expected. Optical acceptance requires the first opaque
// assembly behind it to be the source-defining support/stair, with useful
// transmission. Single-sided raycasting does not let an inward face pass.
const opacity=spec.materialOpacity.glass;
assert(opacity>0&&opacity<=.22,'Foyer must retain subtle tint while exposing source-defining supports');
const authored=new T.Group();
buildThisIsHolland(29,29,{add(g,c,x=0,y=0,z=0,a=0){
 const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide,transparent:c==='glass',opacity:c==='glass'?opacity:1}));
 m.position.set(x,y,z);m.rotation.y=a;m.userData={role:g.userData.role,colour:c};authored.add(m);
}} as BuildingTools);
authored.updateMatrixWorld(true);
function opticalRay(group:T.Group,origin:T.Vector3,target:T.Vector3){
 const dir=target.clone().sub(origin).normalize(),hits=new T.Raycaster(origin,dir,0,origin.distanceTo(target)+2).intersectObject(group,true);
 let transmission=1,lastGlassDistance=-Infinity,layers=0;
 for(const hit of hits){const m=hit.object as T.Mesh,material=m.material as T.MeshBasicMaterial;
  if(material.transparent&&material.opacity<1){if(hit.distance-lastGlassDistance>.015){transmission*=1-material.opacity;layers++;lastGlassDistance=hit.distance;}continue;}
  return {firstOpaque:m.userData.role??m.name,colour:m.userData.colour??m.name,transmission,layers,distance:hit.distance};
 }
 return {firstOpaque:null,colour:null,transmission,layers,distance:null};
}
function run(group:T.Group,decoded=false){
 const columns=[];
 for(const angle of [.45,2.55,4.65])for(const y of [1.5,3,4.2]){
  const direction=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),origin=direction.clone().multiplyScalar(22);origin.y=y;
  const target=direction.clone().multiplyScalar(7.5);target.y=y;
  const hit=opticalRay(group,origin,target);
  assert.equal(hit.colour,'white',`Column ${angle} y${y} must be the first opaque support behind glazing`);
  if(!decoded)assert.equal(hit.firstOpaque,'foyer-column');
  assert.equal(hit.layers,1,'Exterior shaft view crosses one folded glass sheet, not an opaque band');
  assert(hit.transmission>=.75,'A source-defining shaft must retain useful transmission');columns.push({angle,y,...hit});
 }
 const caps=[];
 for(const angle of [.45,2.55,4.65]){
  const direction=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),origin=direction.clone().multiplyScalar(22);origin.y=5.4;
  const target=direction.clone().multiplyScalar(7.5);target.y=5.4;
  const hit=opticalRay(group,origin,target);assert.equal(hit.colour,'white','Mushroom heads must remain exposed through foyer');
  if(!decoded)assert.equal(hit.firstOpaque,'mushroom-cap');assert(hit.transmission>=.75);caps.push({angle,...hit});
 }
 const stair=[];
 // Fractional tread width samples retain narrow real mullions as blockers;
 // at least one exposed sample per selected tread must reach the stair.
 for(const i of [3,6,9,12,15,18]){
  const samples=[-.5,0,.5].map(offset=>{
   const target=new T.Vector3(-5+i*.32,.25+i*.27+.08,3+offset),origin=new T.Vector3(-16,2.4,16),hit=opticalRay(group,origin,target);
   const exposed=hit.colour==='dark'&&hit.layers===1&&hit.transmission>=.75&&
    (decoded?(hit.distance!==null&&Math.abs(hit.distance-origin.distanceTo(target))<2):hit.firstOpaque==='visible-stair');
   return {offset,exposed,...hit};
  });
  assert(samples.some(hit=>hit.exposed),`Source-facing stair tread${i} must have an exposed fractional-width sample`);
  stair.push({tread:i,samples});
 }
 return {columns,caps,stair};
}
const report:any={modelId:'this-is-holland',materialOpacity:opacity,side:'FrontSide',authored:run(authored),visualAcceptance:false,limitation:'Optical ray checks verify material/opaque assembly order, not blended pixels. Root must inspect source-facing gallery/runtime views.'};
const exportPath=process.argv.find(v=>v.startsWith('--export='))?.slice(9);
if(exportPath){
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions'),{MeshoptDecoder}=await import('meshoptimizer');await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(exportPath),decoded=new T.Group();
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
  const material=primitive.getMaterial()!,name=material.getName(),alpha=material.getBaseColorFactor()[3];
  if(name==='glass'){assert.equal(material.getAlphaMode(),'BLEND','Exact GLB must export foyer with alpha blending');assert(Math.abs(alpha-opacity)<1e-5,'Exact GLB must use specified scoped opacity');}
  else assert.equal(material.getAlphaMode(),'OPAQUE','Supporting/core/metal assemblies retain opaque materials');
  const pos=primitive.getAttribute('POSITION')!,ix=primitive.getIndices(),matrix=new T.Matrix4().fromArray(node.getWorldMatrix()),values:number[]=[];
  for(let i=0;i<(ix?.getCount()??pos.getCount());i++)values.push(...new T.Vector3(...pos.getElement(ix?ix.getScalar(i):i,[])).applyMatrix4(matrix).toArray());
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(values,3));geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.FrontSide,transparent:material.getAlphaMode()==='BLEND',opacity:alpha}));mesh.name=name;decoded.add(mesh);
 }
 decoded.updateMatrixWorld(true);report.export={path:exportPath,sha256:crypto.createHash('sha256').update(fs.readFileSync(exportPath)).digest('hex'),bytes:fs.statSync(exportPath).size,...run(decoded,true)};
}
fs.mkdirSync('artifacts/this-is-holland-foyer-repair',{recursive:true});fs.writeFileSync('artifacts/this-is-holland-foyer-repair/optical-check.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({model:report.modelId,authoredColumns:report.authored.columns.length,authoredCaps:report.authored.caps.length,stairSamples:report.authored.stair.length,export:report.export?.sha256??'pending',visualAcceptance:false}));
