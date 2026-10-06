import * as T from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildKesbekeShop} from './kesbeke-builder.ts';
import source from './kesbeke-footprints.json';
const rows:{text:string;depth:number;left:number;right:number;bottom:number;top:number;height:number;width:number}[]=[];
const meshes:{g:T.BufferGeometry;c:string}[]=[];
const tools={add(g:T.BufferGeometry,c:string){meshes.push({g,c})},box(){},prism(){},window(){},gableRoof(){},hip(){},clock(){},sign(){}};
buildKesbekeShop(1,1,tools);
// Resolve the facade origin from surveyed native vertices, then project the
// actual transformed glyph vertices into the facade tangent coordinates.
const east=[...source.parts.shop.outline[0]].sort((a,b)=>b[0]-a[0]).slice(0,2);
const origin=new T.Vector2((east[0][0]+east[1][0])/2,(east[0][1]+east[1][1])/2);
for(const{g,c}of meshes){if(c!=='gold'||!g.userData.signage)continue;const info=g.userData.signage,bb=g.boundingBox!;const n=g.userData.normal,t=new T.Vector2(n[1],-n[0]),p=g.getAttribute('position');let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const u=t.x*p.getX(i)+t.y*p.getZ(i);lo=Math.min(lo,u);hi=Math.max(hi,u);}rows.push({text:info.text,depth:0,left:lo-origin.dot(t),right:hi-origin.dot(t),bottom:bb.min.y,top:bb.max.y,height:bb.max.y-bb.min.y,width:hi-lo});}
const board=rows.filter(r=>r.bottom>3),glass=rows.filter(r=>r.bottom<3),results=[];
for(const [name,lines,bounds]of [['board',board,{left:-3.33,right:3.57,bottom:3.66,top:5.96}],['glass',glass,{left:-5.135,right:4.435,bottom:.2,top:2.84}]] as const){
 if(lines.length!==3)throw Error(`Expected three actual lettering meshes for ${name}`);
 const sorted=[...lines].sort((a,b)=>a.bottom-b.bottom);const inside=sorted.every(r=>r.left>=bounds.left-1e-5&&r.right<=bounds.right+1e-5&&r.bottom>=bounds.bottom-1e-5&&r.top<=bounds.top+1e-5);const gaps=sorted.slice(1).map((r,i)=>r.bottom-sorted[i].top),clear=gaps.every(g=>g>=.10);if(!inside||!clear)throw Error(`Lettering overflow/overlap ${name}`);results.push({surface:name,inside,nonoverlap:clear,gapsM:gaps,sourceWordsExact:sorted.map(r=>r.text),actualGeometryBounds:sorted});
}
const output={builderSha256:crypto.createHash('sha256').update(fs.readFileSync('scripts/landmarks/kesbeke-builder.ts')).digest('hex'),status:'actual-generated-glyph-vertex-bounds-pass',results,limits:'Pre-export geometry bounds, not decoded GLB or visual readability acceptance; shape rounded-corner containment is conservative because rows stay in central right board zone.'};fs.writeFileSync('docs/references/kesbeke/signage-line-fit-review.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(results));
