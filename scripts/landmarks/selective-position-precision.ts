import * as T from 'three';
import {Document, type Mesh, type Node} from '@gltf-transform/core';
import {copyToDocument, dedup, prune, quantize, unpartition} from '@gltf-transform/functions';

/** Conservative graphic support envelope; wider than the 4mm paint clearance
 * and the observed shallow folded cladding steps. No world-coordinate rules. */
export function graphicProtectionBounds(geometries:readonly T.BufferGeometry[],marginM=.15):T.Box3[]{
 if(!Number.isFinite(marginM)||marginM<=0)throw Error('Invalid graphic support margin');
 return geometries.map(g=>{g.computeBoundingBox();if(!g.boundingBox||g.boundingBox.isEmpty())throw Error('Missing graphic bounds');return g.boundingBox.clone().expandByScalar(marginM);});
}

/** Preserve complete original triangles crossing a protected graphic envelope;
 * splitting a stream never clips triangles or reduces the original contours. */
export function splitGraphicSupportGeometry(geometry:T.BufferGeometry,bounds:readonly T.Box3[]):{precise?:T.BufferGeometry;ordinary?:T.BufferGeometry}{
 const source=geometry.index?geometry.toNonIndexed():geometry,positions=source.getAttribute('position');
 if(positions.count%3!==0)throw Error('Graphic support geometry must contain complete triangles');
 const precise:number[]=[],ordinary:number[]=[],triBox=new T.Box3(),p=new T.Vector3();
 for(let i=0;i<positions.count;i+=3){
  triBox.makeEmpty();for(let k=0;k<3;k++)triBox.expandByPoint(p.fromBufferAttribute(positions,i+k));
  const target=bounds.some(b=>b.intersectsBox(triBox))?precise:ordinary;target.push(i,i+1,i+2);
 }
 const build=(indices:number[])=>{
  if(!indices.length)return undefined;
  const g=new T.BufferGeometry();g.userData={...geometry.userData};
  for(const [name,a]of Object.entries(source.attributes)){
   if(!(a instanceof T.BufferAttribute))throw Error('Interleaved support geometry is not supported');
   const values=new Float32Array(indices.length*a.itemSize);
   indices.forEach((src,dst)=>{for(let j=0;j<a.itemSize;j++)values[dst*a.itemSize+j]=a.array[src*a.itemSize+j];});
   g.setAttribute(name,new T.BufferAttribute(values,a.itemSize,a.normalized));
  }
  return g;
 };
 const result={precise:build(precise),ordinary:build(ordinary)};
 if(source!==geometry)source.dispose();return result;
}

/** Quantize only the ordinary mesh in an isolated document. Its corrective
 * node transform never touches the identity node carrying FLOAT32 graphics
 * and support positions. Copying the transformed node back preserves ordinary
 * world placement and avoids inverse-transform rounding of protected floats. */
export async function quantizeOrdinaryMesh(document:Document,mesh:Mesh,node:Node):Promise<void>{
 if(!mesh.listPrimitives().length)return;
 const temporary=new Document(),copied=copyToDocument(temporary,document,[mesh]);
 const temporaryMesh=copied.get(mesh) as Mesh,temporaryNode=temporary.createNode(node.getName()).setMesh(temporaryMesh).setMatrix(node.getMatrix());
 temporary.createScene('quantization-only').addChild(temporaryNode);
 await temporary.transform(quantize({quantizePosition:16}));
 const restored=copyToDocument(document,temporary,[temporaryNode]),restoredNode=restored.get(temporaryNode) as Node;
 node.setMesh(restoredNode.getMesh()).setMatrix(restoredNode.getMatrix());
 restoredNode.dispose();mesh.dispose();
 await document.transform(unpartition(),prune(),dedup());
}
