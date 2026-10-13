import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes';
import {CANALHOUSE_MIN_POLYGON_AREA_M2} from './canalhouseRecipes';
import {isCanalhouseComponentId} from './canalhouseComponentIds';
type Roof=CanalHouseRecipe['roof']['value'][number];
export interface CanalhouseRaisedFlatRoofInsert {id:string;leftM:number;widthM:number;nearM:number;depthM:number;topM:number}
/** A local flat-topped addition raises the base roof; it cannot excavate a
 * notch into the ridge. Exact native plan domains and open courts remain. */
export function canalhouseRaisedFlatRoofInserts(roofs:Roof[],basis:{origin:CanalhousePoint;u:CanalhousePoint;back:CanalhousePoint},inserts:CanalhouseRaisedFlatRoofInsert[]):Roof[]{
 if(!inserts.length||inserts.length>8||![...basis.origin,...basis.u,...basis.back].every(Number.isFinite)||Math.abs(Math.hypot(...basis.u)-1)>1e-6||Math.abs(Math.hypot(...basis.back)-1)>1e-6||Math.abs(basis.u[0]*basis.back[0]+basis.u[1]*basis.back[1])>1e-6)throw Error('Invalid roof insert basis/selection');
 const seen=new Set<string>(),area=(ring:CanalhousePoint[])=>Math.abs(ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
 const clip=(ring:CanalhousePoint[],distance:(p:CanalhousePoint)=>number)=>{
  const out:CanalhousePoint[]=[];
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);
   if(da<=0)out.push(a);
   if(da<0&&db>0||da>0&&db<0){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return out;
 };
 const coord=(p:CanalhousePoint,v:CanalhousePoint)=>(p[0]-basis.origin[0])*v[0]+(p[1]-basis.origin[1])*v[1];
 let result=roofs;
 for(const insert of inserts){
  const {leftM:l,widthM:w,nearM:n,depthM:d,topM:h}=insert;
  if(!isCanalhouseComponentId(insert.id)||seen.has(insert.id)||![l,w,n,d,h].every(Number.isFinite)||l<0||n<0||w<=0||d<=0||h<=0)throw Error('Invalid raised flat roof insert');seen.add(insert.id);
  const cuts=[(p:CanalhousePoint)=>l-coord(p,basis.u),(p:CanalhousePoint)=>coord(p,basis.u)-l-w,(p:CanalhousePoint)=>n-coord(p,basis.back),(p:CanalhousePoint)=>coord(p,basis.back)-n-d];
  const next:Roof[]=[];let raisedArea=0;
  for(const roof of result){
   if(roof.polygon.holes.length||roof.polygon.outer.length<3||!roof.polygon.outer.every(p=>p.every(Number.isFinite))||!Object.values(roof.plane).every(Number.isFinite))throw Error('Roof inserts require finite convex native partitions');
   const turns=roof.polygon.outer.map((a,i)=>{const b=roof.polygon.outer[(i+1)%roof.polygon.outer.length],c=roof.polygon.outer[(i+2)%roof.polygon.outer.length];return(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
   if(turns.some(t=>t>1e-8)&&turns.some(t=>t<-1e-8))throw Error('Roof insert partition is not convex');
   let inside=roof.polygon.outer;
   const pieces:{ring:CanalhousePoint[];plane:Roof['plane']}[]=[];
   for(const cut of cuts){
    const outside=clip(inside,p=>-cut(p));if(outside.length>=3&&area(outside)>1e-10)pieces.push({ring:outside,plane:roof.plane});
    inside=clip(inside,cut);if(inside.length<3||area(inside)<=1e-10)break;
   }
   if(inside.length>=3&&area(inside)>1e-10){
    const delta=(p:CanalhousePoint)=>roof.plane.heightM+roof.plane.slopeX*p[0]+roof.plane.slopeZ*p[1]-h;
    if(inside.every(p=>Math.abs(delta(p))<1e-10)){
     pieces.push({ring:inside,plane:roof.plane});
    }else{
    const raised=clip(inside,delta),base=clip(inside,p=>-delta(p));
    if(raised.length>=3&&area(raised)>1e-10){raisedArea+=area(raised);pieces.push({ring:raised,plane:{heightM:h,slopeX:0,slopeZ:0}});}
    if(base.length>=3&&area(base)>1e-10)pieces.push({ring:base,plane:roof.plane});
    }
   }
   for(const p of pieces)next.push({polygon:{outer:p.ring,holes:[]},plane:p.plane,...(area(p.ring)<CANALHOUSE_MIN_POLYGON_AREA_M2?{generatedFragment:'roof-envelope' as const}:{})});
  }
  if(raisedArea<=1e-8)throw Error('Roof insert does not raise any selected roof domain');
  result=next;
 }
 return result;
}
