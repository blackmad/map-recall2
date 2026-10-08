import * as T from 'three';
import fs from 'node:fs/promises';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {buildKerk136,openingProbes} from './kerk136-builder';
import spec from './kerk136-spec.json';
const parts:{g:T.BufferGeometry;c:string}[]=[],b={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools;
buildKerk136(0,0,b);
const meshes=parts.map(p=>{const mesh=new T.Mesh(p.g,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.userData.colour=p.c;mesh.updateMatrixWorld();return mesh;});
const ray=new T.Raycaster(),failed=[];let tested=0;
for(const p of openingProbes.filter(p=>p.kind==='glass')){const n=new T.Vector3(...p.normal as[number,number,number]),origin=new T.Vector3(...p.point as[number,number,number]).addScaledVector(n,3);ray.set(origin,n.negate());const hit=ray.intersectObjects(meshes)[0];tested++;if(hit?.object.userData.colour!=='glass')failed.push({label:p.label,firstColour:hit?.object.userData.colour});}
// A large exact native exterior notch must stay empty even though no polygon hole.
const notchLonLat=[4.888057,52.363467],notch=[(notchLonLat[0]-spec.anchor[0])*111320*Math.cos(spec.anchor[1]*Math.PI/180),-(notchLonLat[1]-spec.anchor[1])*111320];ray.set(new T.Vector3(notch[0],30,notch[1]),new T.Vector3(0,-1,0));const notchHits=ray.intersectObjects(meshes);if(notchHits.length)failed.push({label:'native-exterior-notch',firstColour:notchHits[0].object.userData.colour});
let downwardRoofTriangles=0;for(const p of parts.filter(p=>p.c==='slate')){const q=p.g.index?p.g.toNonIndexed():p.g,v=q.getAttribute('position');for(let i=0;i<v.count;i+=3){const a=new T.Vector3().fromBufferAttribute(v,i),b=new T.Vector3().fromBufferAttribute(v,i+1),c=new T.Vector3().fromBufferAttribute(v,i+2),n=b.sub(a).cross(c.sub(a));if(n.y<-.01&&a.y>6.5)downwardRoofTriangles++;}}
if(downwardRoofTriangles)failed.push({label:'downward-roof',firstColour:String(downwardRoofTriangles)});
const result={id:spec.id,glassFirstHitProbes:tested,failed,notchLonLat,notchHits:notchHits.length,downwardRoofTriangles,nativeScope:spec.suppress,neighborsRetain:['NL.IMBAG.Pand.0363100012177090','NL.IMBAG.Pand.0363100012177103','NL.IMBAG.Pand.0363100012177268'],limitations:'CPU geometry only; independent gallery/live/performance acceptance required'};
await fs.writeFile('artifacts/ordinary-buildings/kerk136/geometry-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(failed.length)process.exitCode=1;
