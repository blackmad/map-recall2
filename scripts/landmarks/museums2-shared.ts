import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
type Colour=Parameters<BuildingTools['add']>[1];
export interface SurveyFace{id:string;rings:number[][][]}
export interface SurveyData{ring:number[][][];roofs:SurveyFace[]}

/** Native metres: X east, Y up (above ground), Z south. Roof polygons are 3DBAG LoD2.2
 * RoofSurface faces; walls are skirted from each roof edge to the ground (or to the lower
 * neighbouring roof where two roofs share an edge). */
export function surveyShell(b:BuildingTools,data:SurveyData,wall:Colour,roof:Colour,opts:{ground?:number;skipRoof?:(i:number)=>boolean;skipWall?:(p:number[],q:number[])=>boolean}={}){
 const {add}=b,ground=opts.ground??0,key=(p:number[])=>`${Math.round(p[0]*20)},${Math.round(p[2]*20)}`;
 const faces=data.roofs.map(f=>f.rings[0].slice(0,-1));
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
 for(const [positions,colour] of [[wallPositions,wall],[roofPositions,roof]] as const){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(g,colour)}
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
