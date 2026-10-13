import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes';
import {CANALHOUSE_MIN_POLYGON_AREA_M2} from './canalhouseRecipes';
import {canalhouseRaisedFlatRoofInserts,type CanalhouseRaisedFlatRoofInsert} from './canalhouseRoofInsert';
type Roof=CanalHouseRecipe['roof']['value'][number];
/** Separate source-observed roof volumes retain independent heights and fits.
 * Selection domains are disjoint; unselected native parts remain unchanged. */
export function canalhouseRoofAssemblies(roofs:Roof[],owners:string[],front:Parameters<typeof canalhouseSymmetricRoof>[2],selections:SymmetricRoofSelection[]):Roof[]{
 if(!selections.length||selections.length>16||owners.length!==roofs.length)throw Error('Invalid roof assemblies');
 const claimed=new Map<string,number>();
 selections.forEach((s,i)=>s.surfaceIds.forEach(id=>{
  if(claimed.has(id))throw Error('Roof assemblies overlap source surfaces');
  claimed.set(id,i);
 }));
 const compiled=selections.map(s=>{
  const indices=owners.map((id,i)=>s.surfaceIds.includes(id)?i:-1).filter(i=>i>=0);
  return canalhouseSymmetricRoof(indices.map(i=>roofs[i]),indices.map(i=>owners[i]),front,s);
 });
 const emitted=new Set<number>(),result:Roof[]=[];
 for(const [i,r] of roofs.entries()){
  const selection=claimed.get(owners[i]);
  if(selection===undefined)result.push(r);
  else if(!emitted.has(selection)){result.push(...compiled[selection]);emitted.add(selection);}
 }
 return result;
}
export interface SymmetricRoofSelection {
 template:'symmetric-front-hip'|'symmetric-gable'|'front-slope';surfaceIds:string[];eavesM:number;ridgeM:number;hipDepthM?:number;
 /** A continuous front band need not end at a cadastral side boundary. */
 frontRunM?:number;
 /** Shorter side runs produce a truncated hip with a flat upper cap. */
 sideRunM?:number;
 /** Fit construction bounds to selected native coverage in the chosen front
  * basis. Domains/holes stay unchanged; this supplies no roof-profile evidence. */
 fit?:'native-envelope';
 raisedFlatInserts?:CanalhouseRaisedFlatRoofInsert[];
}
/** Regularize only explicitly selected native partitions. Analytic envelopes
 * retain exact plan coverage; excluded annexes and courtyards stay intact.
 * Side hips are optional because owner boundaries need not be roof ends. */
export function canalhouseSymmetricRoof(roofs:Roof[],owners:string[],front:{a:CanalhousePoint;b:CanalhousePoint;normal:CanalhousePoint},selection:SymmetricRoofSelection):Roof[]{
 const {eavesM,ridgeM,hipDepthM}=selection;
 if(!['symmetric-front-hip','symmetric-gable','front-slope'].includes(selection.template)||owners.length!==roofs.length||!selection.surfaceIds.length||new Set(selection.surfaceIds).size!==selection.surfaceIds.length||![eavesM,ridgeM].every(Number.isFinite)||eavesM<=0||ridgeM<=eavesM||(selection.template==='symmetric-front-hip'&&(!Number.isFinite(hipDepthM)||hipDepthM!<=0)))throw Error('Invalid symmetric roof selection');
 const continuous=selection.template==='front-slope';
 if(continuous&&(!Number.isFinite(selection.frontRunM)||selection.frontRunM!<=0||selection.sideRunM!==undefined||selection.hipDepthM!==undefined))throw Error('Invalid continuous front slope selection');
 for(const id of selection.surfaceIds)if(!owners.includes(id))throw Error('Unknown symmetric roof source surface');
 const dx=front.b[0]-front.a[0],dz=front.b[1]-front.a[1],frontWidth=Math.hypot(dx,dz),rise=ridgeM-eavesM;
 let width=frontWidth,origin=front.a;
 if(width<=0)throw Error('Invalid symmetric roof frontage');
 const ux=dx/frontWidth,uz=dz/frontWidth,bx=-front.normal[0],bz=-front.normal[1];
 if(selection.fit!==undefined){
  if(selection.fit!=='native-envelope')throw Error('Unsupported symmetric roof fit');
  if(![...front.a,...front.b,...front.normal].every(Number.isFinite)||!Number.isFinite(frontWidth)||Math.abs(Math.hypot(bx,bz)-1)>1e-6||Math.abs(ux*bx+uz*bz)>1e-6)throw Error('Native envelope requires an orthonormal frontage basis');
  let minX=Infinity,maxX=-Infinity,minDepth=Infinity,maxDepth=-Infinity;
  const selected=new Set(selection.surfaceIds);
  for(const [i,roof] of roofs.entries())if(selected.has(owners[i])){
   const p=roof.polygon.outer;
   if(roof.polygon.holes.length||p.length!==3)throw Error('Symmetric roof expects native triangular partitions');
   if(p.some(v=>v.length!==2||!v.every(Number.isFinite))||Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))<2e-10)throw Error('Degenerate native roof envelope coverage');
   for(const v of p){const x=(v[0]-front.a[0])*ux+(v[1]-front.a[1])*uz,depth=(v[0]-front.a[0])*bx+(v[1]-front.a[1])*bz;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minDepth=Math.min(minDepth,depth);maxDepth=Math.max(maxDepth,depth);}
  }
  width=maxX-minX;
  if(!Number.isFinite(width)||width<=1e-8||maxDepth-minDepth<=1e-8)throw Error('Degenerate native roof envelope');
  origin=[front.a[0]+ux*minX+bx*minDepth,front.a[1]+uz*minX+bz*minDepth];
 }
 const sideRun=selection.sideRunM??width/2;if(!Number.isFinite(sideRun)||sideRun<=0||sideRun>width/2)throw Error('Invalid symmetric roof side run');
 const plane=(sx:number,sd:number,base:number):Roof['plane']=>({slopeX:sx*ux+sd*bx,slopeZ:sx*uz+sd*bz,heightM:base-(sx*ux+sd*bx)*origin[0]-(sx*uz+sd*bz)*origin[1]});
 const planes=continuous?[plane(0,rise/selection.frontRunM!,eavesM),plane(0,0,ridgeM)]:[plane(rise/sideRun,0,eavesM),plane(-rise/sideRun,0,eavesM+rise*width/sideRun),...(selection.template==='symmetric-front-hip'?[plane(0,rise/hipDepthM!,eavesM)]:[]),...(sideRun<width/2?[plane(0,0,ridgeM)]:[])];
 const height=(p:Roof['plane'],v:CanalhousePoint)=>p.heightM+p.slopeX*v[0]+p.slopeZ*v[1];
 const clip=(ring:CanalhousePoint[],p:Roof['plane'],q:Roof['plane'])=>{
  const result:CanalhousePoint[]=[];
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],da=height(p,a)-height(q,a),db=height(p,b)-height(q,b);
   if(da<=0)result.push(a);
   if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return result;
 };
 const selected=new Set(selection.surfaceIds),result:Roof[]=[],generated:Roof[]=[];
 roofs.forEach((roof,i)=>{
  if(!selected.has(owners[i])){result.push(roof);return;}
  // surveyRecipe triangulates native rings, including courtyard exclusions.
  if(roof.polygon.holes.length||roof.polygon.outer.length!==3)throw Error('Symmetric roof expects native triangular partitions');
  for(const p of planes){let ring=roof.polygon.outer;for(const q of planes)if(q!==p)ring=clip(ring,p,q);
   const area=Math.abs(ring.reduce((s,a,j)=>{const b=ring[(j+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
   if(area>1e-10)(selection.raisedFlatInserts?generated:result).push({polygon:{outer:ring,holes:[]},plane:p,...(area<CANALHOUSE_MIN_POLYGON_AREA_M2?{generatedFragment:continuous?'roof-envelope' as const:'symmetric-roof' as const}:{})});
  }
 });
 if(selection.raisedFlatInserts)result.push(...canalhouseRaisedFlatRoofInserts(generated,{origin,u:[ux,uz],back:[bx,bz]},selection.raisedFlatInserts));
 return result;
}
