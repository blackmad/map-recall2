import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes';
type Roof=CanalHouseRecipe['roof']['value'][number];
export interface RoofJunctionSelection {surfaceIds:string[];maxAdjustmentM:number}

/** Explicitly selected continuous roof parts only. Genuine volume steps must
 * remain excluded. Identical surveyed XY vertices share one height; plan
 * domains are never snapped, expanded or filled. This is an inference. */
export function canalhouseRoofJunctions(roofs:Roof[],owners:string[],selection:RoofJunctionSelection):Roof[]{
 const ids=selection.surfaceIds;
 if(owners.length!==roofs.length||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!owners.includes(id))||!Number.isFinite(selection.maxAdjustmentM)||selection.maxAdjustmentM<=0||selection.maxAdjustmentM>2)throw Error('Invalid native roof junction selection');
 const selected=new Set(ids),key=(p:CanalhousePoint)=>`${p[0]},${p[1]}`;
 const height=(r:Roof,p:CanalhousePoint)=>r.plane.heightM+r.plane.slopeX*p[0]+r.plane.slopeZ*p[1];
 const nodes=new Map<string,{point:CanalhousePoint;surfaces:Map<string,number[]>}>();
 for(const [i,r] of roofs.entries())if(selected.has(owners[i])){
  if(r.polygon.holes.length||r.polygon.outer.length!==3)throw Error('Native roof junctions require triangular domains');
  for(const p of r.polygon.outer){
   if(p.length!==2||!p.every(Number.isFinite))throw Error('Invalid roof junction vertex');
   const h=height(r,p);if(!Number.isFinite(h))throw Error('Invalid roof junction height');
   const node=nodes.get(key(p))??{point:p,surfaces:new Map<string,number[]>()};
   const values=node.surfaces.get(owners[i])??[];values.push(h);node.surfaces.set(owners[i],values);nodes.set(key(p),node);
  }
 }
 // A vertex landing inside an un-noded edge needs a different triangulation.
 // Reject it instead of claiming endpoint averaging produced a continuous seam.
 for(const [i,r] of roofs.entries())if(selected.has(owners[i]))for(let j=0;j<3;j++){
  const a=r.polygon.outer[j],b=r.polygon.outer[(j+1)%3],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(length<1e-8)throw Error('Degenerate native roof junction edge');
  for(const {point:p} of nodes.values()){
   const along=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length;
   if(along>1e-8&&along<length-1e-8&&Math.abs(dx*(p[1]-a[1])-dz*(p[0]-a[0]))/length<1e-8)throw Error('Native roof junction requires noded triangle edges');
  }
 }
 const target=new Map<string,number>();
 for(const [k,node] of nodes){
  // Each semantic source surface votes once, regardless of triangulation count.
  const means=[...node.surfaces.values()].map(v=>v.reduce((a,b)=>a+b,0)/v.length);
  target.set(k,means.reduce((a,b)=>a+b,0)/means.length);
 }
 return roofs.map((r,i)=>{
  if(!selected.has(owners[i]))return r;
  const [a,b,c]=r.polygon.outer,ha=target.get(key(a))!,hb=target.get(key(b))!,hc=target.get(key(c))!;
  for(const p of r.polygon.outer){const adjustment=Math.abs(target.get(key(p))!-height(r,p));if(adjustment>selection.maxAdjustmentM+1e-8)throw Error(`Native roof junction exceeds selected adjustment bound: ${owners[i]} at ${key(p)}, ${adjustment}m > ${selection.maxAdjustmentM}m`);}
  const x1=b[0]-a[0],z1=b[1]-a[1],x2=c[0]-a[0],z2=c[1]-a[1],den=x1*z2-x2*z1;
  if(Math.abs(den)<1e-10)throw Error('Degenerate native roof junction triangle');
  const slopeX=((hb-ha)*z2-(hc-ha)*z1)/den,slopeZ=(x1*(hc-ha)-x2*(hb-ha))/den;
  const plane={heightM:ha-a[0]*slopeX-a[1]*slopeZ,slopeX,slopeZ};
  if(!Object.values(plane).every(Number.isFinite))throw Error('Invalid joined native roof plane');
  return {...r,plane};
 });
}
