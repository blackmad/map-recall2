import fs from 'node:fs/promises';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {buildPrinsen767,probes} from './prinsen767-builder';
import type {BuildingTools} from '../landmarks/cultural-builders';
import spec from './prinsen767-spec.json';
const meshes:T.Mesh[]=[];const parts:any[]=[];
buildPrinsen767(0,0,{add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.updateMatrixWorld();meshes.push(mesh);const flat=g.index?g.toNonIndexed():g,p=flat.getAttribute('position');parts.push({colour:c,source:g.userData,positions:Array.from(p.array)});}} as BuildingTools);
const checks=probes.filter(p=>p.kind==='glass').map(p=>{const normal=new T.Vector3(...p.normal),ray=new T.Raycaster(new T.Vector3(...p.point).addScaledVector(normal,10),normal.negate(),0,11),hit=ray.intersectObjects(meshes)[0];return{...p,firstHitErrorMetres:hit?hit.point.distanceTo(new T.Vector3(...p.point)):null};});
const failed=checks.filter(p=>p.firstHitErrorMetres===null||p.firstHitErrorMetres>.055);
// The unsupported source gap must remain a void in the actual original mesh.
const q=spec.unresolvedRoofCoverage[0].representativeLngLat,x=(q[0]-spec.anchor[0])*111320*Math.cos(spec.anchor[1]*Math.PI/180),z=-(q[1]-spec.anchor[1])*111320;
const voidHits=new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0),0,30).intersectObjects(meshes);
await MeshoptDecoder.ready;const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read('artifacts/ordinary-buildings/prinsen767/'+spec.digits+'.glb');
const decodedMeshes:T.Mesh[]=[];let bad=0;for(const m of doc.getRoot().listMeshes())for(const primitive of m.listPrimitives()){const p=primitive.getAttribute('POSITION')!.getArray()!,n=primitive.getAttribute('NORMAL')!.getArray()!;bad+=[...p,...n].filter(v=>!Number.isFinite(v)).length;const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p,3));const indices=primitive.getIndices()?.getArray();if(indices)g.setIndex(Array.from(indices));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.updateMatrixWorld();decodedMeshes.push(mesh);}
const decodedFailed=probes.filter(p=>p.kind==='glass').flatMap(p=>{const normal=new T.Vector3(...p.normal),hit=new T.Raycaster(new T.Vector3(...p.point).addScaledVector(normal,10),normal.negate(),0,11).intersectObjects(decodedMeshes)[0],error=hit?hit.point.distanceTo(new T.Vector3(...p.point)):null;return error===null||error>.065?[{label:p.label,error}]:[];});
const decodedVoidHits=new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0),0,30).intersectObjects(decodedMeshes).length;
const unresolvedDecodedHits=spec.unresolvedRoofCoverage.map(gap=>{const q=gap.representativeLngLat,x=(q[0]-spec.anchor[0])*111320*Math.cos(spec.anchor[1]*Math.PI/180),z=-(q[1]-spec.anchor[1])*111320;return{areaMetres2:gap.areaMetres2,hits:new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0),0,30).intersectObjects(decodedMeshes).length};});
const fringeHeightViolations=spec.roofs.filter(r=>'observedHeightRange'in r).flatMap(r=>r.ring.flatMap(p=>{const h=r.plane[0]*p[0]+r.plane[1]*p[1]+r.plane[2],range=(r as any).observedHeightRange;return h<range[0]-.03||h>range[1]+.03?[{surface:r.surface,height:h,range}]:[];}));
const frontEnvelopeViolations=parts.flatMap(p=>{const e=p.source?.nativeEnvelope;return e?.nativeEdge===6&&e.upperRoofMetres.some((h:number)=>h>15.57)?[e]:[];});
const report={unresolvedDecodedHits,fringeHeightViolations,frontEnvelopeViolations,decodedFailed,decodedVoidHits,scope:'CPU author checks only; independent/reference/gallery/live/performance pending',probes:checks.length,failed,voidHits:voidHits.length,decodedNonFinite:bad,textures:doc.getRoot().listTextures().length};
await fs.writeFile('artifacts/ordinary-buildings/prinsen767/author-checks.json',JSON.stringify(report,null,2)+'\n');await fs.writeFile('artifacts/ordinary-buildings/prinsen767/original-triangles.json',JSON.stringify(parts));console.log(JSON.stringify(report));if(failed.length||voidHits.length||bad||decodedFailed.length||decodedVoidHits||unresolvedDecodedHits.some(r=>r.hits)||fringeHeightViolations.length||frontEnvelopeViolations.length)process.exitCode=1;
