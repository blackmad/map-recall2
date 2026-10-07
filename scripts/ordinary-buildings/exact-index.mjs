/** Exact IEEE-bit tuple indexing. No welding tolerance, quantization, triangle reorder or material change. */
import crypto from 'node:crypto';
function bytes(a){return Buffer.from(a.buffer,a.byteOffset,a.byteLength);}
function expandedAttribute(primitive,semantic){const acc=primitive.getAttribute(semantic),array=acc.getArray(),size=acc.getElementSize(),indices=primitive.getIndices()?.getArray();if(!indices)return bytes(array);const expanded=new array.constructor(indices.length*size);for(let i=0;i<indices.length;i++)expanded.set(array.subarray(indices[i]*size,(indices[i]+1)*size),i*size);return bytes(expanded);}
export function expandedProof(primitive){return Object.fromEntries(primitive.listSemantics().map(name=>[name,{bytes:expandedAttribute(primitive,name).length,sha256:crypto.createHash('sha256').update(expandedAttribute(primitive,name)).digest('hex')} ]));}
export function exactIndexDocument(doc){const buffer=doc.getRoot().listBuffers()[0],proof=[];
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  if(primitive.getIndices())throw Error('Exact index stage requires expanded triangle input');
  const before=expandedProof(primitive),semantics=primitive.listSemantics(),attrs=semantics.map(name=>primitive.getAttribute(name)),arrays=attrs.map(a=>a.getArray()),sizes=attrs.map(a=>a.getElementSize()),count=attrs[0].getCount();if(!attrs.every(a=>a.getCount()===count))throw Error('Mismatched attribute counts');
  const seen=new Map(),unique=[],indices=[];for(let i=0;i<count;i++){const key=arrays.map((a,j)=>bytes(a.subarray(i*sizes[j],(i+1)*sizes[j])).toString('hex')).join('/');let index=seen.get(key);if(index===undefined){index=unique.length;seen.set(key,index);unique.push(i);}indices.push(index);}
  for(let j=0;j<semantics.length;j++){const out=new arrays[j].constructor(unique.length*sizes[j]);for(let i=0;i<unique.length;i++)out.set(arrays[j].subarray(unique[i]*sizes[j],(unique[i]+1)*sizes[j]),i*sizes[j]);primitive.setAttribute(semantics[j],doc.createAccessor().setType(attrs[j].getType()).setNormalized(attrs[j].getNormalized()).setArray(out).setBuffer(buffer));}
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(unique.length<=65536?new Uint16Array(indices):new Uint32Array(indices)).setBuffer(buffer));const after=expandedProof(primitive);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Expanded attribute bit equality failed');proof.push({material:primitive.getMaterial()?.getName(),triangleCount:count/3,expandedVertices:count,indexedVertices:unique.length,before,after,exactExpandedAttributeEquality:true});
 }
 const used=new Set(doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().flatMap(p=>[...p.listAttributes(),p.getIndices()].filter(Boolean))));for(const a of doc.getRoot().listAccessors())if(!used.has(a))a.dispose();return proof;
}
