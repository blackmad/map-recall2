import * as T from 'three';
import fs from 'node:fs';
import {buildKesbekeShop,buildKesbeke} from './kesbeke-builder.ts';
const data:Record<string,unknown>={};
for(const[id,build]of[['shop',buildKesbekeShop],['factory',buildKesbeke]]as const){
 const meshes:{g:T.BufferGeometry;c:string}[]=[];const tools={add(g:T.BufferGeometry,c:string){meshes.push({g,c})},box(){},prism(){},window(){},gableRoof(){},hip(){},clock(){},sign(){}};build(1,1,tools);
 const faces=meshes.filter(m=>m.g.userData.signage);const checks=[];
 for(const{g}of faces){const printed=g.userData.signage.surface==='printed',n=new T.Vector3(g.userData.normal[0],0,g.userData.normal[1]),p=g.getAttribute('position');let lo=Infinity,hi=-Infinity;
  for(let i=0;i<p.count;i++){const d=new T.Vector3().fromBufferAttribute(p,i).dot(n);lo=Math.min(lo,d);hi=Math.max(hi,d);}
  if(!printed){checks.push({text:g.userData.signage.text,surface:'raised',actualDepthM:hi-lo});continue;}
  const board=g.boundingBox!.min.y>3;
  // Find the actual backing geometry in this generated native facade,
  // rather than accepting the decal's nominal offset constant as proof.
  const backing=meshes.find(m=>{m.g.computeBoundingBox();const box=m.g.boundingBox!;return board?m.c==='dark'&&Math.abs(box.min.y-3.66)<1e-5&&Math.abs(box.max.y-5.96)<1e-5:m.c==='glass'&&Math.abs(box.min.y-.2)<1e-5&&Math.abs(box.max.y-2.84)<1e-5;});if(!backing)throw Error('Missing decal backing');
  let backingFront=-Infinity;const bp=backing.g.getAttribute('position');for(let i=0;i<bp.count;i++)backingFront=Math.max(backingFront,new T.Vector3().fromBufferAttribute(bp,i).dot(n));
  const clearance=lo-backingFront,depth=hi-lo;let reversed=0;const ix=g.index;for(let i=0;i<(ix?.count??p.count);i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i),b=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1),c=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2);if(b.sub(a).cross(c.sub(a)).dot(n)<-1e-9)reversed++;}
  if(clearance<.003||clearance>.005||depth>1e-5||reversed)throw Error(`Printed decal plane failure ${g.userData.signage.text}`);
  checks.push({text:g.userData.signage.text,surface:board?'board-print':'glass-sticker',actualClearanceM:clearance,actualDepthM:depth,reversedTriangles:reversed});
 }
 data[id]={checks,printedWords:checks.filter(c=>c.surface!=='raised').length,raisedWords:checks.filter(c=>c.surface==='raised').length};
}
fs.writeFileSync('docs/references/kesbeke/printed-decal-plane-review.json',JSON.stringify({status:'actual-geometry-plane-clearance-pass',data,limits:'Uncompressed generated mesh; decodedGLB/material/reference and scene review remain coordinator tasks.'},null,2)+'\n');console.log(JSON.stringify(data));
