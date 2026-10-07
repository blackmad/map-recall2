import * as T from 'three';import fs from 'node:fs';import assert from 'node:assert/strict';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';import data from './landmarks/haparandaweg-2-4-footprints.json';
await MeshoptDecoder.ready;const file=process.argv[2]??'artifacts/landmark-next-batch/haparandaweg-2-4.glb',doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file),meshes:T.Mesh[]=[],bounds=new T.Box3();let tris=0,downRoof=0,roofFaces=0;
for(const node of doc.getRoot().listNodes()){const m=node.getMesh();if(!m)continue;for(const p of m.listPrimitives()){const a=p.getAttribute('POSITION')!,position:number[]=[];for(let i=0;i<a.getCount();i++)position.push(...a.getElement(i,[]));const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));const ix=p.getIndices();if(ix)g.setIndex(Array.from(ix.getArray()!));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=p.getMaterial()!.getName();mesh.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));mesh.updateMatrixWorld(true);meshes.push(mesh);bounds.expandByObject(mesh);const flat=g.index?g.toNonIndexed():g,pa=flat.getAttribute('position');tris+=pa.count/3;
 if(mesh.name==='slate'){for(let i=0;i<pa.count;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pa,i+k).applyMatrix4(mesh.matrixWorld)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));roofFaces++;if(n.y<-.0001){downRoof++;console.log("DOWN",n.length()/2,v.map(p=>p.toArray()));}}}
}}
assert(tris<40000);assert(fs.statSync(file).size<500000);assert.equal(downRoof,0);assert(bounds.min.y>=-.05&&bounds.max.y<24);for(const v of [...bounds.min.toArray(),...bounds.max.toArray()])assert(Number.isFinite(v));
const out=data.outline[0],faces=[{name:'south',a:out[15],z:out[17],bays:14},{name:'east',a:out[17],z:out[0],bays:20},{name:'north',a:out[0],z:out[3],bays:14},{name:'west',a:out[3],z:out[15],bays:20}],probes:any[]=[];
for(const f of faces){const dx=f.z[0]-f.a[0],dz=f.z[1]-f.a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux,pitch=L/f.bays;
 for(const k of[2,5,8]){const wide=f.name==='west'&&k>=10&&k<15,red=(f.name==='west'&&k<10)||(f.name==='east'&&k>=8&&k<15)||(f.name==='north'&&k>=9),cw=wide?pitch*.59:pitch*.32,w=pitch-cw-.15,u=(k+.5)*pitch-cw/2;
  for(const frac of[-.3,0,.3]){const s=u+frac*w,origin=new T.Vector3(f.a[0]+ux*s+nx*3,5.6,f.a[1]+uz*s+nz*3),ray=new T.Raycaster(origin,new T.Vector3(-nx,0,-nz));const hit=ray.intersectObjects(meshes)[0],result={face:f.name,bay:k,fraction:frac,hit:hit?.object.name??null,distance:hit?.distance};probes.push(result);assert.equal(result.hit,'glass',JSON.stringify(result));}
 }
}
// Measure decoded source-derived horizontal slat triangles against their actual
// backing surfaces. This diagnoses native precision risk without a shader claim.
const louvers:any[]=[];const triangleKeys=new Set<string>();let duplicateSlatTriangles=0;
for(const mesh of meshes.filter(m=>['concrete','white'].includes(m.name))){const flat=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,pa=flat.getAttribute('position');for(let i=0;i<pa.count;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pa,i+k).applyMatrix4(mesh.matrixWorld)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize(),ys=v.map(p=>p.y),span=Math.max(...ys)-Math.min(...ys),width=Math.max(...v.map(a=>Math.max(...v.map(b=>Math.hypot(a.x-b.x,a.z-b.z)))));if(span<.020||span>.070||width<1.8||Math.abs(n.y)>.06)continue;
 const key=v.map(p=>p.toArray().map(x=>x.toFixed(5)).join(',')).sort().join(';');if(triangleKeys.has(key))duplicateSlatTriangles++;triangleKeys.add(key);
 const center=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3),backings=meshes.filter(m=>mesh.name==='white'?m.name==='glass':m.name==='white'),distances=[n,n.clone().negate()].map(direction=>new T.Raycaster(center,direction,.001,1).intersectObjects(backings)[0]?.distance).filter((v):v is number=>v!==undefined),gap=distances.length?Math.min(...distances):null;
 louvers.push({material:mesh.name,center:center.toArray(),normal:n.toArray(),span,width,gap});
}}
const minSlatGap=Math.min(...louvers.filter(v=>v.gap!==null).map(v=>v.gap)),louverDiagnosis={file,sampledSlatTriangles:louvers.length,duplicateSlatTriangles,minSlatGap,normalMaxVertical:Math.max(...louvers.map(v=>Math.abs(v.normal[1]))),triangles:louvers};
if(process.argv.includes('--diagnose-louvers')){console.log(JSON.stringify({...louverDiagnosis,triangles:undefined}));fs.writeFileSync('artifacts/haparandaweg-2-4/louver-diagnosis.json',JSON.stringify(louverDiagnosis,null,2)+'\n');process.exit(0);}
assert(louvers.length>300);assert.equal(duplicateSlatTriangles,0);assert(minSlatGap>.14,JSON.stringify({minSlatGap}));assert(louverDiagnosis.normalMaxVertical<.01);
const repairProbes:any[]=[];
function probe(label:string,origin:number[],direction:number[],expected:string|string[],minimumDistance=0,maximumDistance=Infinity){const hit=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction).normalize()).intersectObjects(meshes)[0];const r={label,origin,direction,first:hit?.object.name??null,distance:hit?.distance,point:hit?.point.toArray()};repairProbes.push(r);assert((Array.isArray(expected)?expected:[expected]).includes(r.first!),JSON.stringify(r));assert(r.distance!>=minimumDistance&&r.distance!<=maximumDistance,JSON.stringify(r));return r;}
for(const x of[-4,4])for(const y of[13.4,15,17.1])probe('atrium south '+x+'/'+y,[x,y,16.8],[0,0,-1],'glass',1.5,2.5);
for(const y of[18.5,19,20.3])probe('inner west hall '+y,[-9.3,y,7.8],[1,0,0],['white','concrete'],1.7,2.2);
for(const x of[-12,0,12]){probe('south guard above deck '+x,[x,14.15,31],[0,0,-1],'glass',2,4);probe('open terrace deck '+x,[x,17,23],[0,-1,0],'slate',4,4.4);}
const west=faces[3],dx=west.z[0]-west.a[0],dz=west.z[1]-west.a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux;
const at=(u:number,out:number,y:number)=>[west.a[0]+ux*u+nx*out,y,west.a[1]+uz*u+nz*out];
// Read actual top tread heights at four public approach distances. This catches
// buried treads, collapsed runs, and a discontinuous arrival at the door.
const samples=[3.20,2.55,1.90,1.25,.35],actual=samples.map(o=>probe('west approach tread '+o,at(L*.68,o,2),[0,-1,0],'concrete').point![1]);
for(let i=1;i<actual.length;i++){assert(actual[i]>=actual[i-1]-.02);assert(actual[i]-actual[i-1]<.20);}assert(actual[actual.length-1]>.60&&actual[actual.length-1]<.68);
for(const off of[-.55,.55])probe('west door clear '+off,at(L*.68+off,3.9,1.7),[-nx,0,-nz],'glass',3.3,4);
const n=faces[2],ndx=n.z[0]-n.a[0],ndz=n.z[1]-n.a[1],nl=Math.hypot(ndx,ndz),nux=ndx/nl,nuz=ndz/nl;
for(const k of[2,10]){const pitch=nl/n.bays,u=(k+.5)*pitch+pitch*.29;probe('north ground coloured strip '+k,[n.a[0]+nux*u-nuz*3,1.7,n.a[1]+nuz*u+nux*3],[nuz,0,-nux],k===2?'gold':'copper',2.5,3.2);}
// Scan the decoded upper north facade independently of builder bay constants.
// Broad and narrow silver modules must produce fewer frames than the14 lower
// classroom bays, and two substantially different observed spacing groups.
const frameBands:number[]=[];let previous=false;for(let x=-18;x<=18;x+=.1){const h=new T.Raycaster(new T.Vector3(x,18,-33),new T.Vector3(0,0,1)).intersectObjects(meshes)[0],now=h?.object.name==='bronze';if(now&&!previous)frameBands.push(x);previous=now;}const spacings=frameBands.slice(1).map((v,i)=>v-frameBands[i]);assert(frameBands.length>=5&&frameBands.length<=9,JSON.stringify(frameBands));assert(Math.max(...spacings)>Math.min(...spacings)*1.5,JSON.stringify(spacings));
const report={status:'CPU geometry only; native gallery/game acceptance pending',file,bytes:fs.statSync(file).size,triangles:tris,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},roofFaces,downwardRoofFaces:downRoof,firstHitGlazing:probes,repairProbes,upperNorthDecodedFrameBands:frameBands,louverDiagnosis,exactSuppressionIds:['NL.IMBAG.Pand.0363100012244095'],sourceNeighborIds:data.mustRetain.map(v=>v.id)};fs.writeFileSync('scripts/landmarks/haparandaweg-2-4-geometry-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({bytes:report.bytes,triangles:tris,roofFaces,downRoof,glazing:probes.length,status:report.status}));
