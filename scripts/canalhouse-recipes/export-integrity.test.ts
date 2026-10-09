import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {canalhouseGroupToGlb} from './export-glb.ts';

test('compact shared-owner GLB preserves every colored triangle position and bounded shading normals',async()=>{
 const pack=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/rough-chunk-recipes.json','utf8'));
 const entry=pack.entries.find((e:any)=>e.recipe.id==='herengracht-507-509');
 const built=compileCanalHouseRecipe(entry.recipe);built.group.updateMatrixWorld(true);
 const expected=new Map<string,number[][][]>();
 const key=(color:number[],points:number[][])=>{
  const signatures=points.map(p=>p.join(','));
  return color.join(',')+'|'+[0,1,2].map(i=>[...signatures.slice(i),...signatures.slice(0,i)].join(';')).sort()[0];
 };
 built.group.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  const g=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrixWorld);
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=(object.material as T.MeshStandardMaterial).color;
  for(let i=0;i<p.count;i+=3){
   const order=object.matrixWorld.determinant()<0?[i,i+2,i+1]:[i,i+1,i+2];
   const point=order.map(j=>[p.getX(j),p.getY(j),p.getZ(j)]),normal=order.map(j=>[n.getX(j),n.getY(j),n.getZ(j)]);
   const k=key([c.r,c.g,c.b],point),values=expected.get(k)??[];
   values.push(normal);expected.set(k,values);
  }
  g.dispose();
 });
 // Export a fresh compile rather than reading a checked-in asset dump.
 const {bytes}=await canalhouseGroupToGlb(entry.recipe.id,compileCanalHouseRecipe(entry.recipe).group,{roofPreset:entry.roofMaterial?.preset});
 assert.ok(bytes.length<=500000);
 const doc=await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(bytes);
 let triangles=0,maxAngle=0;
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  const p=primitive.getAttribute('POSITION')!,n=primitive.getAttribute('NORMAL')!,indices=primitive.getIndices();
  assert.equal(p.getComponentType(),5126,'Survey positions remain Float32');
  const color=primitive.getMaterial()!.getBaseColorFactor().slice(0,3);
  for(let i=0;i<(indices?.getCount()??p.getCount());i+=3){
   const ids=[0,1,2].map(j=>indices?indices.getScalar(i+j):i+j),points=ids.map(j=>p.getElement(j,[]));
   const values=expected.get(key(color,points));assert.ok(values?.length,'Export must retain exact position, color and winding');
   const before=values.pop()!;
   // Winding is exact, but cyclic starts may differ. Compare the normal sets.
   for(const j of ids){const after=new T.Vector3(...n.getElement(j,[]) as [number,number,number]).normalize();
    const angle=Math.min(...before.filter(v=>Math.hypot(...v)>0).map(v=>after.angleTo(new T.Vector3(...v as [number,number,number]).normalize())));
    if(Number.isFinite(angle))maxAngle=Math.max(maxAngle,angle);
   }
   triangles++;
  }
 }
 assert.equal(triangles,built.stats.triangles);
 assert.ok([...expected.values()].every(v=>v.length===0));
 assert.ok(maxAngle<Math.PI/180,'Normal encoding deviation stays below one degree');
});
