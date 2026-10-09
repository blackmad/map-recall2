/** Project the complete decoded mesh using the runtime's actual placement matrix.
 * The companion Python polygon audit distinguishes masonry from roof/trim overhangs. */
import * as T from 'three';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {placementFor,type SignatureModelSpec} from '../src/canalRecall/landmarks/signaturePlacement';
import catalogue from '../src/canalRecall/landmarks/manualCatalogue.json';
await MeshoptDecoder.ready;
const spec=catalogue.find(s=>s.id==='kriterion')! as unknown as SignatureModelSpec;
const placement=placementFor(spec,{min:[0,0,0],max:[0,0,0]});
const matrix=new T.Matrix4().makeScale(1,-1,1)
 .multiply(new T.Matrix4().makeRotationZ((90-placement.modelRotationDegrees)*Math.PI/180))
 .multiply(new T.Matrix4().makeRotationX(Math.PI/2));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const model=process.argv[2]??'public/canal-drive/models/kriterion.glb';
const doc=await io.read(model),triangles:{material:string;points:number[][]}[]=[];
for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
 const position=primitive.getAttribute('POSITION')!,indices=primitive.getIndices(),world=new T.Matrix4().fromArray(node.getWorldMatrix());
 for(let i=0;i<(indices?.getCount()??position.getCount());i+=3){
  const points=[0,1,2].map(k=>{
   const local=new T.Vector3(...position.getElement(indices?indices.getScalar(i+k):i+k,[])).applyMatrix4(world);
   const mercator=local.clone().applyMatrix4(matrix);
   return [mercator.x,-mercator.y,local.y]; // East, north, elevation in metres.
  });triangles.push({material:primitive.getMaterial()!.getName(),points});
 }
}
const out=process.argv[3]??'artifacts/kriterion-feedback-oct7/runtime-projected-mesh.json';
fs.writeFileSync(out,JSON.stringify({model,placement,triangles}));
console.log(JSON.stringify({model,modelRotationDegrees:placement.modelRotationDegrees,triangles:triangles.length,out}));
