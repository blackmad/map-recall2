// node --import tsx scripts/check-facade-attachment.ts [--max-gap=0.05] [--quiet] <id...>
// For every mesh part that is not part of the survey shell (geometry tagged
// `userData.shell` by surveyShell), the minimum distance from the part to the shell's
// surfaces, or to a part already attached to the shell (a pane on its frame, a bay on the
// wall), must stay below the tolerance (default 5 cm). A part that penetrates the shell
// has distance 0. Reports the worst gap per model and lists each offending part.
// Works for any builder registered in scripts/landmarks/museums2-registry.ts.
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {museums2Builders} from './landmarks/museums2-registry';

const args=process.argv.slice(2),flag=(n:string)=>args.find(a=>a.startsWith(`--${n}=`))?.split('=')[1];
const tol=Number(flag('max-gap')??.05),ids=args.filter(a=>!a.startsWith('--'));
const targets=ids.length?ids:Object.keys(museums2Builders);

function triangles(g:T.BufferGeometry){
 const p=g.getAttribute('position'),idx=g.index,out:T.Triangle[]=[];const v=(i:number)=>new T.Vector3().fromBufferAttribute(p,i);
 const n=idx?idx.count:p.count;for(let i=0;i<n;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;out.push(new T.Triangle(v(a),v(b),v(c)))}
 return out.filter(t=>t.getArea()>1e-9);
}
const tmp=new T.Vector3();
const pointTri=(p:T.Vector3,t:T.Triangle)=>t.closestPointToPoint(p,tmp).distanceTo(p);
/** Segment/triangle intersection (Moller-Trumbore on the segment). */
function segHits(a:T.Vector3,b:T.Vector3,t:T.Triangle){
 const d=b.clone().sub(a),len=d.length();if(len<1e-9)return false;d.divideScalar(len);
 const e1=t.b.clone().sub(t.a),e2=t.c.clone().sub(t.a),h=d.clone().cross(e2),det=e1.dot(h);if(Math.abs(det)<1e-12)return false;
 const f=1/det,s=a.clone().sub(t.a),u=f*s.dot(h);if(u<0||u>1)return false;
 const q=s.clone().cross(e1),v=f*d.dot(q);if(v<0||u+v>1)return false;const x=f*e2.dot(q);return x>=0&&x<=len;
}
/** Distance from a part to the shell: 0 when any part edge crosses the shell, otherwise the
 * smaller of part-vertex-to-shell and shell-vertex-to-part distances. */
function partDistance(part:T.Triangle[],shell:T.Triangle[]){
 let best=Infinity;
 for(const pt of part){
  const vs=[pt.a,pt.b,pt.c];
  for(const st of shell){
   for(const v of vs)best=Math.min(best,pointTri(v,st));
   if(best===0)return 0;
   for(let i=0;i<3;i++)if(segHits(vs[i],vs[(i+1)%3],st))return 0;
  }
 }
 for(const st of shell)for(const v of [st.a,st.b,st.c])for(const pt of part)best=Math.min(best,pointTri(v,pt));
 return best;
}

let failed=false;
for(const id of targets){
 const build=museums2Builders[id];assert(build,`no builder registered for ${id}`);
 const gs:T.BufferGeometry[]=[];
 const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);gs.push(g)};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const unused=()=>{throw Error('unused primitive')};
 build(0,0,{add,box,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused});
 const shellGs=gs.filter(g=>g.userData.shell),parts=gs.filter(g=>!g.userData.shell);
 assert(shellGs.length,`${id}: no geometry tagged userData.shell`);
 const shell=shellGs.flatMap(triangles);
 // A part is attached when it is within `tol` of the shell or of any part already attached
 // (a window pane sits on its frame, the frame on a bay, the bay on the wall). Attachment is
 // resolved transitively; `gap` is the distance at which the part joined the attached set.
 const tris=parts.map(triangles),boxes=parts.map(g=>{g.computeBoundingBox();return g.boundingBox!.clone().expandByScalar(tol)});
 const attached:T.Triangle[][]=[shell],attachedBoxes:T.Box3[]=[new T.Box3().setFromPoints(shell.flatMap(t=>[t.a,t.b,t.c]))];
 const gap=new Array<number>(parts.length).fill(Infinity),done=new Array<boolean>(parts.length).fill(false);
 let progress=true;
 while(progress){
  progress=false;
  parts.forEach((_g,i)=>{
   if(done[i])return;
   let best=Infinity;
   attached.forEach((set,k)=>{if(!attachedBoxes[k].intersectsBox(boxes[i]))return;best=Math.min(best,partDistance(tris[i],set))});
   if(best<tol){done[i]=true;gap[i]=best;attached.push(tris[i]);attachedBoxes.push(boxes[i].clone().expandByScalar(-tol));progress=true}
  });
 }
 // direct gap to the shell, for information
 const direct=parts.map((_g,i)=>partDistance(tris[i],shell));
 let max=0;const bad:{index:number;gapToNearestAttached:number;gapToShell:number;centre:number[]}[]=[];
 parts.forEach((g,i)=>{
  if(done[i]){max=Math.max(max,gap[i]);return}
  g.computeBoundingBox();const c=g.boundingBox!.getCenter(new T.Vector3());
  bad.push({index:i,gapToNearestAttached:+attached.reduce((m,set)=>Math.min(m,partDistance(tris[i],set)),Infinity).toFixed(3),gapToShell:+direct[i].toFixed(3),centre:[c.x,c.y,c.z].map(v=>+v.toFixed(2))});
 });
 const unattached=bad.length;if(unattached)max=Math.max(max,...bad.map(b=>b.gapToNearestAttached));
 const maxDirect=Math.max(0,...direct.filter((_d,i)=>done[i]));
 console.log(JSON.stringify({id,parts:parts.length,shellTriangles:shell.length,maxGapMetres:+max.toFixed(3),maxGapToShellMetres:+maxDirect.toFixed(3),floating:bad.length}));
 if(bad.length&&!args.includes('--quiet'))for(const b of bad.slice(0,40))console.log('  floating part',JSON.stringify(b));
 if(bad.length){failed=true;console.error(`${id}: ${bad.length} part(s) are >= ${tol} m from the shell (max ${max.toFixed(3)} m)`)}
}
if(failed)process.exit(1);
