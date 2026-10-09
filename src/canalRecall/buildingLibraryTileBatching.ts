/** Batch texture-free opaque reviewed GLBs by compatible PBR state, preserving owner ranges. */
import * as THREE from 'three';
export function materialState(material:any){
 if(material.type!=='MeshStandardMaterial')throw new Error('Unsupported PBR material '+material.type);
 if(material.wireframe||material.clippingPlanes?.length||material.stencilWrite)throw new Error('Unsupported wireframe/clipping/stencil state');
 if(Object.values(material).some((v:any)=>v?.isTexture))throw new Error('Textured materials require a separate atlas contract');
 if(material.transparent||material.opacity!==1||material.alphaTest!==0)throw new Error('Nonopaque sorting/alpha materials remain unbatched in this prototype');
 return {type:material.type,roughness:material.roughness,metalness:material.metalness,side:material.side,opacity:material.opacity,transparent:material.transparent,alphaTest:material.alphaTest,alphaHash:material.alphaHash,depthTest:material.depthTest,depthWrite:material.depthWrite,flatShading:material.flatShading,emissive:material.emissive.toArray(),emissiveIntensity:material.emissiveIntensity,blending:material.blending,premultipliedAlpha:material.premultipliedAlpha,polygonOffset:material.polygonOffset,polygonOffsetFactor:material.polygonOffsetFactor,polygonOffsetUnits:material.polygonOffsetUnits,visible:material.visible,colorWrite:material.colorWrite,toneMapped:material.toneMapped,fog:material.fog,dithering:material.dithering,blendSrc:material.blendSrc,blendDst:material.blendDst,blendEquation:material.blendEquation,blendSrcAlpha:material.blendSrcAlpha,blendDstAlpha:material.blendDstAlpha,blendEquationAlpha:material.blendEquationAlpha};
}
export const stateKey=(material:any)=>JSON.stringify(materialState(material));
export function compatibleMaterial(state:any){const {type,emissive,...options}=state;return new THREE.MeshStandardMaterial({...options,color:0xffffff,vertexColors:true,emissive:new THREE.Color(...emissive)});}
export type Part={owner:any;mesh:THREE.Mesh;matrix:THREE.Matrix4};
export function batchParts(parts:Part[]){
 const groups=new Map<string,any>();let triangles=0,sourceVertices=0,positionErrorM=0,normalError=0,colourError=0;
 for(const part of parts){
  const geometry=part.mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index;
  if(!normal)throw new Error('Original normals required');sourceVertices+=position.count;
  const materials=Array.isArray(part.mesh.material)?part.mesh.material:[part.mesh.material];
  const ranges=geometry.groups.length?geometry.groups:[{start:0,count:index?.count??position.count,materialIndex:0}];
  const nmatrix=new THREE.Matrix3().getNormalMatrix(part.matrix),reflected=part.matrix.determinant()<0;
  for(const range of ranges){
   const material:any=materials[range.materialIndex??0],key=stateKey(material);let batch=groups.get(key);
   if(!batch){batch={key,state:materialState(material),positions:[],normals:[],colours:[],indices:[],ownerRanges:[]};groups.set(key,batch);}
   const startTriangle=batch.indices.length/3,vertices=new Map<number,number>();
   const vertex=(i:number)=>{
    if(vertices.has(i))return vertices.get(i)!;
    const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(part.matrix),n=new THREE.Vector3().fromBufferAttribute(normal,i).applyNormalMatrix(nmatrix);
    const c=material.color.clone();if(material.vertexColors&&geometry.attributes.color){const a=geometry.attributes.color;c.multiply(new THREE.Color(a.getX(i),a.getY(i),a.getZ(i)));}
    const offset=batch.positions.length/3;batch.positions.push(...p.toArray());batch.normals.push(...n.toArray());batch.colours.push(...c.toArray());vertices.set(i,offset);return offset;
   };
   const last=Math.min(range.start+range.count,index?.count??position.count);
   if((last-range.start)%3)throw new Error('Incomplete source triangles');
   for(let i=range.start;i<last;i+=3){const source=[0,1,2].map(j=>index?index.getX(i+j):i+j),tri=source.map(vertex);if(reflected)[tri[1],tri[2]]=[tri[2],tri[1]];batch.indices.push(...tri);triangles++;}
   batch.ownerRanges.push({firstTriangle:startTriangle,triangleCount:batch.indices.length/3-startTriangle,ownerId:part.owner.id,buildingId:part.owner.buildingId,geometryRevision:part.owner.geometryRevision,sourceModelHash:part.owner.sourceModelHash,sourceMesh:part.mesh.name,sourceIndexStart:range.start,sourceIndexCount:last-range.start});
  }
 }
 const batches=[...groups.values()];for(const b of batches){
  const position=new Float32Array(b.positions),normal=new Float32Array(b.normals),colour=new Float32Array(b.colours),index=b.positions.length/3<=65536?new Uint16Array(b.indices):new Uint32Array(b.indices);
  for(let i=0;i<position.length;i++)positionErrorM=Math.max(positionErrorM,Math.abs(position[i]-b.positions[i]));
  for(let i=0;i<normal.length;i++)normalError=Math.max(normalError,Math.abs(normal[i]-b.normals[i]));
  for(let i=0;i<colour.length;i++)colourError=Math.max(colourError,Math.abs(colour[i]-b.colours[i]));
  Object.assign(b,{position,normal,colour,index});delete b.positions;delete b.normals;delete b.colours;delete b.indices;
 }
 return {batches,triangles,sourceVertices,positionErrorM,normalError,colourError};
}
export function makeBatchMesh(batch:any){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(batch.position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(batch.normal,3));geometry.setAttribute('color',new THREE.BufferAttribute(batch.colour,3));geometry.setIndex(new THREE.BufferAttribute(batch.index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,compatibleMaterial(batch.state));mesh.userData.ownerRanges=batch.ownerRanges;return mesh;}
export function pickOwner(mesh:THREE.Mesh,faceIndex:number){const ranges=mesh.userData.ownerRanges as any[];return ranges.find(r=>faceIndex>=r.firstTriangle&&faceIndex<r.firstTriangle+r.triangleCount)??null;}
