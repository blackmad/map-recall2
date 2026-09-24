/** Preview-only entrance access assemblies. These give a dated, inspected door
 * a readable landing, steps, or recess without claiming a registered building
 * placement or changing the source wall. */
import type { FacadeRecipePatch } from './cityAppearanceFacadeRecipes.js';

export type EntranceAssemblyFrame={a:number[];u:number[];n:number[];width:number;bottom:number;top:number};
export type EntranceAccess={kind:'stairs'|'landing';pavementY:number;landingDepthM:number;stepCount?:number;riseM?:number;treadM?:number};
export type Recess={depthM:number};
export type EntranceAssembly={id:string;featureId:string;t:number;y:number;width:number;height:number;colour?:`#${string}`;access:EntranceAccess;recess?:Recess};
export type EntranceAssemblyPatch=FacadeRecipePatch&{previewOnly:true;inferredDimensions:true;assembly:'entrance-access'|'entrance-recess'};
/** The host preview must cut this opening from its support wall before adding
 * a recessed assembly, otherwise the original wall occludes the rear planes. */
export type EntranceOpeningVoid={mode:'preview-opening-void';t:number;bottom:number;width:number;height:number;depthM:number;inferredDimensions:true};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const point=(frame:EntranceAssemblyFrame,t:number,y:number,depth:number)=>[frame.a[0]+frame.u[0]*t+frame.n[0]*depth,y,frame.a[1]+frame.u[1]*t+frame.n[1]*depth];
const face=(points:number[][])=>[0,1,2,0,2,3].flatMap(index=>points[index]);
const quad=(frame:EntranceAssemblyFrame,t0:number,t1:number,y0:number,y1:number,d0:number,d1=d0)=>face([point(frame,t0,y0,d0),point(frame,t1,y0,d0),point(frame,t1,y1,d1),point(frame,t0,y1,d1)]);
function validate(frame:EntranceAssemblyFrame,item:EntranceAssembly){
  if(!frame||!item||![frame.width,frame.bottom,frame.top,item.t,item.y,item.width,item.height,item.access?.pavementY,item.access?.landingDepthM].every(finite)||item.width<=.2||item.height<=.3||item.access.landingDepthM<0||item.t-item.width/2<0||item.t+item.width/2>frame.width||item.y-item.height/2<frame.bottom-.02||item.y+item.height/2>frame.top+.02)throw Error('Invalid entrance assembly');
  if(item.recess&&(!finite(item.recess.depthM)||item.recess.depthM<0||item.recess.depthM>2))throw Error('Invalid entrance recess');
  const steps=item.access.stepCount??NaN;
  if(item.access.kind==='stairs'&&(!Number.isInteger(steps)||steps<1||steps>12||!finite(item.access.riseM)||!finite(item.access.treadM)||item.access.riseM<=0||item.access.treadM<=0||Math.abs(item.access.pavementY+steps*item.access.riseM-(item.y-item.height/2))>.05))throw Error('Invalid entrance stairs');
}
export function entranceOpeningVoid(item:EntranceAssembly):EntranceOpeningVoid|null{return item.recess?.depthM?{mode:'preview-opening-void',t:item.t,bottom:item.y-item.height/2,width:item.width,height:item.height,depthM:item.recess.depthM,inferredDimensions:true}:null;}
/** Returns side/rear planes for a recess plus horizontal treads and vertical
 * risers. Every dimension is caller-supplied preview inference. */
export function compileEntranceAssembly(frame:EntranceAssemblyFrame,item:EntranceAssembly):EntranceAssemblyPatch[]{
  validate(frame,item);const out:EntranceAssemblyPatch[]=[];
  const colour=item.colour??'#394746',left=item.t-item.width/2,right=item.t+item.width/2,bottom=item.y-item.height/2,top=item.y+item.height/2;
  const add=(triangles:number[],paint:EntranceAssemblyPatch['colour'],assembly:EntranceAssemblyPatch['assembly'])=>out.push({triangles,colour:paint,observationId:null,featureId:item.featureId,featureKind:'observed-door',styleSource:'agent-inspected',previewOnly:true,inferredDimensions:true,assembly});
  const depth=item.recess?.depthM??0;
  if(depth>0){
    add(quad(frame,left,right,bottom,top,-depth),colour,'entrance-recess');
    add(face([point(frame,left,bottom,0),point(frame,left,bottom,-depth),point(frame,left,top,-depth),point(frame,left,top,0)]),'windowFrameDark','entrance-recess');
    add(face([point(frame,right,bottom,-depth),point(frame,right,bottom,0),point(frame,right,top,0),point(frame,right,top,-depth)]),'windowFrameDark','entrance-recess');
    add(face([point(frame,left,top,0),point(frame,left,top,-depth),point(frame,right,top,-depth),point(frame,right,top,0)]),'windowFrameDark','entrance-recess');
  }else add(quad(frame,left,right,bottom,top,.035),colour,'entrance-access');
  const count=item.access.kind==='stairs'?item.access.stepCount!:1,rise=item.access.kind==='stairs'?item.access.riseM!:0,tread=item.access.kind==='stairs'?item.access.treadM!:item.access.landingDepthM;
  // Step zero meets pavement; later steps move toward the facade and up.
  for(let step=0;step<count;step++){
    const y=item.access.kind==='stairs'?item.access.pavementY+rise*(step+1):item.access.pavementY;
    const outer=item.access.landingDepthM+tread*(count-step),inner=item.access.landingDepthM+tread*(count-step-1);
    add(quad(frame,left,right,y,y,outer,inner),'facadeTrimLight','entrance-access');
    if(item.access.kind==='stairs')add(quad(frame,left,right,y-rise,y,outer,outer),'facadeTrimDark','entrance-access');
  }
  if(item.access.landingDepthM>0)add(quad(frame,left,right,item.access.kind==='stairs'?item.access.pavementY+rise*count:item.access.pavementY,item.access.kind==='stairs'?item.access.pavementY+rise*count:item.access.pavementY,0,item.access.landingDepthM),'facadeTrimLight','entrance-access');
  return out;
}
