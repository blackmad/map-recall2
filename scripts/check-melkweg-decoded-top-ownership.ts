import * as T from 'three';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const path=process.argv[2]??'artifacts/landmark-next-batch/melkweg.glb',doc=await io.read(path),triangles:any[]=[];
for(const node of doc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()??[]){const p=prim.getAttribute('POSITION')!,indices=prim.getIndices(),matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
 for(let i=0;i<(indices?.getCount()??p.getCount());i+=3){const vertices=[0,1,2].map(j=>new T.Vector3(...p.getElement(indices?indices.getScalar(i+j):i+j,[]) as [number,number,number]).applyMatrix4(matrix));
  for(const plane of [15,18.3])if(vertices.every(v=>Math.abs(v.y-plane)<.004)){const cross=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));if(Math.abs(cross.y)>1e-9)triangles.push({plane,material:prim.getMaterial()?.getName(),normalY:Math.sign(cross.y),ring:vertices.map(v=>[v.x,v.z])});}
 }}
fs.writeFileSync('artifacts/melkweg-coupled/decoded-top-ownership-triangles.json',JSON.stringify({path,triangles}));console.log({horizontalTriangles:triangles.length});
