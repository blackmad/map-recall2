// Geometric ownership, shared by the mesh builder and the offline conflict audit.
// Remove only the intersecting area; offsets cannot reliably separate shared walls.
import { SegmentGrid } from './streetFronts.js';
export type WallFace = {x0:number;y0:number;x1:number;y1:number;len:number;nx:number;ny:number};
export type WallOwner = {id:string;minHeightM:number;heightM:number};
export type WallCut = {a0:number;a1:number;z0:number;z1:number;other:string};
const EPS = .002; // 2 mm: floating point noise, not a facade inset.
export function sharedWallCuts(groups: readonly {b:WallOwner;edges:readonly WallFace[]}[]): Map<WallFace,WallCut[]> {
  const faces=groups.flatMap(({b,edges})=>edges.map(e=>({b,e})));
  const grid=new SegmentGrid(faces.flatMap(({e})=>[e.x0,e.y0,e.x1,e.y1]));
  const out=new Map<WallFace,WallCut[]>();
  for(const [ownIndex,{b,e}] of faces.entries()){
    const ux=(e.x1-e.x0)/e.len,uy=(e.y1-e.y0)/e.len;
    for(const index of grid.near(Math.min(e.x0,e.x1)-EPS,Math.min(e.y0,e.y1)-EPS,Math.max(e.x0,e.x1)+EPS,Math.max(e.y0,e.y1)+EPS)){
      const {b:o,e:f}=faces[index];if(index===ownIndex)continue;
      const z0=Math.max(b.minHeightM,o.minHeightM),z1=Math.min(b.heightM,o.heightM);if(z1-z0<=EPS)continue;
      const dot=e.nx*f.nx+e.ny*f.ny;if(Math.abs(dot)<.999999)continue;
      if(Math.max(Math.abs((f.x0-e.x0)*e.nx+(f.y0-e.y0)*e.ny),Math.abs((f.x1-e.x0)*e.nx+(f.y1-e.y0)*e.ny))>EPS)continue;
      // Opposite facing party walls are internal. Same facing walls keep the taller
      // owner, then the lexical id, independent of tile/worker arrival order.
      if(dot>0 && (b.heightM>o.heightM || b.heightM===o.heightM&&(b.id<o.id || b.id===o.id&&ownIndex<index)))continue;
      const t0=((f.x0-e.x0)*ux+(f.y0-e.y0)*uy)/e.len,t1=((f.x1-e.x0)*ux+(f.y1-e.y0)*uy)/e.len;
      const a0=Math.max(0,Math.min(t0,t1)),a1=Math.min(1,Math.max(t0,t1));if((a1-a0)*e.len<=EPS)continue;
      const cuts=out.get(e)??[];cuts.push({a0,a1,z0,z1,other:o.id});out.set(e,cuts);
    }
  }
  return out;
}
export type WallRect={along0:number;along1:number;z0:number;z1:number};
export function subtractWallCuts<T extends WallRect>(q:T,cuts:readonly WallCut[],slice:(q:T,r:WallRect)=>T):T[]{
  let pieces=[q];
  for(const c of cuts){
    pieces=pieces.flatMap(p=>{
      const a0=Math.max(p.along0,c.a0),a1=Math.min(p.along1,c.a1),z0=Math.max(p.z0,c.z0),z1=Math.min(p.z1,c.z1);
      if(a1-a0<1e-8||z1-z0<EPS)return[p];
      const out:T[]=[];
      const add=(l:number,r:number,b:number,t:number)=>{if(r-l>1e-8&&t-b>EPS)out.push(slice(p,{along0:l,along1:r,z0:b,z1:t}));};
      add(p.along0,a0,p.z0,p.z1);add(a1,p.along1,p.z0,p.z1);add(a0,a1,p.z0,z0);add(a0,a1,z1,p.z1);return out;
    });
  }
  return pieces;
}
export type Point2=[number,number];
export function polygonArea(p:readonly Point2[]):number {return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;}
// Convex difference: each outside half-plane is retained once; the surviving
// inside polygon continues to the next edge. Both polygons must be CCW.
export function subtractConvex(subject:Point2[],clip:readonly Point2[]):Point2[][]{
  // Do not fragment a face merely because it crosses an extension of a clip
  // edge. Adjacent roof triangles routinely have overlapping bounding boxes.
  let intersection=subject;
  for(let i=0;i<clip.length && intersection.length>=3;i++) {
    const a=clip[i],b=clip[(i+1)%clip.length],out:Point2[]=[];
    const side=(p:Point2)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    for(let j=0;j<intersection.length;j++) {
      const p=intersection[j],q=intersection[(j+1)%intersection.length],dp=side(p),dq=side(q);
      if(dp>=0)out.push(p);
      if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    intersection=out;
  }
  if(intersection.length<3 || polygonArea(intersection)<1e-6)return [subject];
  let inside=subject;const kept:Point2[][]=[];
  for(let i=0;i<clip.length&&inside.length>=3;i++){
    const a=clip[i],b=clip[(i+1)%clip.length];
    const side=(p:Point2)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    const split=(positive:boolean)=>{
      const out:Point2[]=[];
      for(let j=0;j<inside.length;j++){
        const p=inside[j],q=inside[(j+1)%inside.length],dp=side(p),dq=side(q),pin=positive?dp>=-1e-8:dp<=1e-8,qin=positive?dq>=-1e-8:dq<=1e-8;
        if(pin)out.push(p);if(pin!==qin){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
      }return out;
    };
    const outside=split(false),next=split(true);if(outside.length>=3&&polygonArea(outside)>1e-6)kept.push(outside);inside=next;
  }
  return kept;
}
