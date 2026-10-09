import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
type Colour=Parameters<BuildingTools['add']>[1];
export interface SurveyFace{id:string;rings:number[][][]}
export interface SurveyData{ring:number[][][];roofs:SurveyFace[];grounds?:SurveyFace[]}

/** Native metres: X east, Y up (above ground), Z south. Roof polygons are 3DBAG LoD2.2
 * RoofSurface faces; walls are skirted from each roof edge to the ground (or to the lower
 * neighbouring roof where two roofs share an edge). */
export function surveyShell(b:BuildingTools,data:SurveyData,wall:Colour,roof:Colour,opts:{ground?:number;skipRoof?:(i:number)=>boolean;skipWall?:(p:number[],q:number[])=>boolean}={}){
 const {add}=b,ground=opts.ground??0,key=(p:number[])=>`${Math.round(p[0]*20)},${Math.round(p[2]*20)}`;
 // 3DBAG rings are usually NOT closed (the extract does not repeat the first vertex), so only
 // drop a trailing vertex when it really duplicates the first; slicing blindly deletes a corner.
 const open=(r:number[][])=>{const f=r[0],l=r[r.length-1];return f[0]===l[0]&&f[1]===l[1]&&f[2]===l[2]?r.slice(0,-1):r};
 const faces=data.roofs.map(f=>open(f.rings[0]));
 const edgeMap=new Map<string,{face:number;a:number[];b:number[]}[]>();
 faces.forEach((ring,fi)=>ring.forEach((a,i)=>{const c=ring[(i+1)%ring.length],k=key(a)+'>'+key(c);const list=edgeMap.get(k)??[];list.push({face:fi,a,b:c});edgeMap.set(k,list)}));
 const roofPositions:number[]=[],wallPositions:number[]=[];
 faces.forEach((ring,fi)=>{
  if(opts.skipRoof?.(fi))return;
  // Roof plane, triangulated in plan, wound upward.
  const contour=ring.map(p=>new T.Vector2(p[0],p[2])),tris=T.ShapeUtils.triangulateShape(contour,[]);
  for(const [i,j,k] of tris){const q=[ring[i],ring[j],ring[k]].map(p=>new T.Vector3(p[0],p[1],p[2])),n=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));
   const order=n.y>=0?[0,1,2]:[0,2,1];for(const o of order)roofPositions.push(q[o].x,q[o].y,q[o].z)}
  // Walls, outward by plan orientation of this face.
  let area=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];area+=p[0]*q[2]-q[0]*p[2]}
  const sign=area>=0?1:-1;
  ring.forEach((p,i)=>{
   const q=ring[(i+1)%ring.length],dx=q[0]-p[0],dz=q[2]-p[2];if(Math.hypot(dx,dz)<.02||opts.skipWall?.(p,q))return;
   const out=new T.Vector3(dz*sign,0,-dx*sign).normalize();
   let lowP=ground,lowQ=ground;
   const other=edgeMap.get(key(q)+'>'+key(p))?.find(e=>e.face!==fi);
   if(other){lowP=Math.max(ground,other.b[1]);lowQ=Math.max(ground,other.a[1]);if(p[1]<=lowP+.01&&q[1]<=lowQ+.01)return}
   const a=new T.Vector3(p[0],lowP,p[2]),c=new T.Vector3(q[0],lowQ,q[2]),d=new T.Vector3(q[0],q[1],q[2]),e=new T.Vector3(p[0],p[1],p[2]);
   for(const tri of [[a,c,d],[a,d,e]]){if(tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).dot(out)<0)tri.reverse();
    const cr=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));if(cr.length()<1e-6)continue;for(const v of tri)wallPositions.push(v.x,v.y,v.z)}
  });
 });
 for(const [positions,colour] of [[wallPositions,wall],[roofPositions,roof]] as const){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData.shell=true;add(g,colour)}
}

/** Facade frame on a footprint edge a->b whose outward normal is given by `outward`
 * (+1 or -1 side). u runs along the wall from its midpoint; o runs out of the wall. */
export function facadeFrame(b:BuildingTools,a:number[],c:number[],flip=false){
 const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);let tx=dx/len,tz=dz/len;
 // local +x = (cos ang, -sin ang) ; local +z = (sin ang, cos ang). Outward is local +z.
 let ang=Math.atan2(-tz,tx);if(flip){ang=Math.atan2(tz,-tx)}
 const cx=(a[0]+c[0])/2,cz=(a[1]+c[1])/2,s=Math.sin(ang),k=Math.cos(ang);
 const at=(u:number,o:number)=>[cx+k*u+s*o,cz-s*u+k*o];
 const box=(u:number,y:number,o:number,w:number,h:number,d:number,colour:Colour)=>{const [x,z]=at(u,o);b.box(x,y,z,w,h,d,colour,ang)};
 const geo=(g:T.BufferGeometry,colour:Colour,u:number,y:number,o:number)=>{const [x,z]=at(u,o);b.add(g,colour,x,y,z,ang)};
 return {ang,len,at,box,geo,normal:[s,k] as [number,number]};
}

/** Facade frame that sits exactly on the surveyed wall. The BAG footprint (`data.ring`) and the
 * 3DBAG shell disagree by 0.1-0.7 m (different survey dates, simplified vs. detailed edges), so
 * a frame built on the BAG edge floats in front of, or sinks into, the shell. This takes the BAG
 * edge `ringEdge` -> `ringEdge+1` only to *choose* the wall, then merges the 3DBAG ground-ring
 * edges that run along it (within `angleDeg` and `reach` metres) into one straight street wall,
 * fits its line, and returns a frame whose origin plane IS that wall (o=0 on the brick, o>0 out
 * into the street). u runs along the wall in the BAG edge's direction, from the wall's midpoint. */
export function wallFrame(b:BuildingTools,data:SurveyData,ringEdge:number,opts:{angleDeg?:number;reach?:number}={}){
 const ring=data.ring[0],a=ring[ringEdge],c=ring[(ringEdge+1)%ring.length];
 const ground=data.grounds?.[0]?.rings[0];if(!ground)throw Error('wallFrame: footprints JSON has no 3DBAG ground ring');
 const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len,nx=-tz,nz=tx;
 const sinMax=Math.sin((opts.angleDeg??10)*Math.PI/180),reach=opts.reach??1.2;
 const along=(p:number[])=>(p[0]-a[0])*tx+(p[2]-a[1])*tz,off=(p:number[])=>(p[0]-a[0])*nx+(p[2]-a[1])*nz;
 const used:number[][][]=[];let wSum=0,dxSum=0,dzSum=0,mxSum=0,mzSum=0;
 for(let i=0;i<ground.length;i++){
  const p=ground[i],q=ground[(i+1)%ground.length],ex=q[0]-p[0],ez=q[2]-p[2],el=Math.hypot(ex,ez);if(el<.3)continue;
  if(Math.abs(ex*tz-ez*tx)/el>sinMax)continue;
  const mid=[(p[0]+q[0])/2,0,(p[2]+q[2])/2];if(Math.abs(off(mid))>reach)continue;
  const sp=along(p),sq=along(q);if(Math.max(sp,sq)<0||Math.min(sp,sq)>len)continue;
  const sgn=ex*tx+ez*tz>=0?1:-1;used.push([p,q]);wSum+=el;dxSum+=sgn*ex;dzSum+=sgn*ez;mxSum+=el*mid[0];mzSum+=el*mid[2];
 }
 if(!(wSum>0))throw Error(`wallFrame: no 3DBAG wall along ring edge ${ringEdge}`);
 // least-squares-ish line: length-weighted direction through the length-weighted centroid
 const dl=Math.hypot(dxSum,dzSum),wx=dxSum/dl,wz=dzSum/dl,cx=mxSum/wSum,cz=mzSum/wSum;
 let s0=Infinity,s1=-Infinity;for(const [p,q] of used)for(const v of [p,q]){const s=(v[0]-cx)*wx+(v[2]-cz)*wz;s0=Math.min(s0,s);s1=Math.max(s1,s)}
 const pa=[cx+wx*s0,cz+wz*s0],pc=[cx+wx*s1,cz+wz*s1],nx2=-wz,nz2=wx;
 const mx=(pa[0]+pc[0])/2+nx2*.3,mz=(pa[1]+pc[1])/2+nz2*.3;
 // the outward side must be outside the 3DBAG ground ring; otherwise walk the wall the other way
 let inside=false;for(let i=0,j=ground.length-1;i<ground.length;j=i++){const p=ground[i],q=ground[j];if((p[2]>mz)!==(q[2]>mz)&&mx<(q[0]-p[0])*(mz-p[2])/(q[2]-p[2])+p[0])inside=!inside}
 return inside?facadeFrame(b,pc,pa):facadeFrame(b,pa,pc);
}
