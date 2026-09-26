/** Spatial source studies are illustrative: pixel-scaled depths are not metric registrations. */
import {compileEntranceAssembly,entranceOpeningVoid} from '../../src/canalRecall/facadeEntranceAssemblies';
import {FACADE_PATCH_COLOURS} from '../../src/canalRecall/cityAppearanceFacadeRecipes';
type P=number[];
function clip(poly:P[],axis:number,bound:number,keepGreater:boolean){const out:P[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],insideA=keepGreater?a[axis]>=bound:a[axis]<=bound,insideB=keepGreater?b[axis]>=bound:b[axis]<=bound;if(insideA)out.push(a);if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;}
function subtract(poly:P[],rect:number[]){let remaining=poly;const out:P[][]=[];for(const[axis,bound,greater]of [[0,rect[0],true],[0,rect[2],false],[1,rect[1],true],[1,rect[3],false]] as [number,number,boolean][]){const outside=clip(remaining,axis,bound,!greater);if(outside.length>2)out.push(outside);remaining=clip(remaining,axis,bound,greater);if(remaining.length<3)break;}return out;}
function cutTriangles(triangles:number[],rect:number[]){const out:number[]=[];for(let i=0;i<triangles.length;i+=9){const poly=[triangles.slice(i,i+3),triangles.slice(i+3,i+6),triangles.slice(i+6,i+9)];for(const piece of subtract(poly,rect))for(let j=1;j<piece.length-1;j++)out.push(...piece[0],...piece[j],...piece[j+1]);}return out;}
function warpObservedFeature(study:any,frame:any,H:number,W:number,margin:number,id:string,bounds:number[],leftDepth:number,rightDepth:number){
 const matching=study.patches.filter((p:any)=>p.featureId.endsWith(id)); if(!matching.length)return 0;
 const t=(x:number)=>W+margin-x*.01, left=t(bounds[2]),right=t(bounds[0]);
 for(const patch of matching){
  for(let offset=0;offset<patch.triangles.length;offset+=3){
   const x=patch.triangles[offset],z=patch.triangles[offset+2],dx=x-frame.a[0],dz=z-frame.a[1];
   const sourceT=dx*frame.u[0]+dz*frame.u[1], sourceDepth=-(dx*frame.n[0]+dz*frame.n[1]);
   const fraction=Math.max(0,Math.min(1,(sourceT-left)/(right-left))),depth=leftDepth+(rightDepth-leftDepth)*fraction+sourceDepth;
   patch.triangles[offset]=frame.a[0]+frame.u[0]*sourceT-frame.n[0]*depth;
   patch.triangles[offset+2]=frame.a[1]+frame.u[1]*sourceT-frame.n[1]*depth;
  }
  // White pixels around this shop are painted timber surround. The detailed
  // observed panel remains, but its infill is dark glazing rather than trim.
  if(patch.colour==='#ffffff'||patch.colour==='#fff')patch.colour='#24453d';
  patch.perspectiveWarped=true;patch.previewOnly=true;patch.inferredDimensions=true;patch.accessEvidence='visible-recess-perspective-inferred-depth';patch.contactCertified=false;
 }
 return matching.length;
}
/** A photo-specific perspective study. Pixel bounds establish only the visible
 * faces; depth is deliberately a preview inference and never a registration. */
function compilePerspectiveRecess(frame:any,H:number,W:number,margin:number,source:any,featureId:string,depth:number){
 const t=(x:number)=>W+margin-x*.01,y=(py:number)=>H-py*.01;
 const point=(tx:number,ty:number,d:number)=>[frame.a[0]+frame.u[0]*tx-frame.n[0]*d,ty,frame.a[1]+frame.u[1]*tx-frame.n[1]*d];
 const quad=(corners:number[][],colour:string,assembly:string)=>({triangles:[...corners[0],...corners[1],...corners[2],...corners[0],...corners[2],...corners[3]],colour,observationId:null,featureId:`source-perspective:${featureId}`,featureKind:'observed-door',styleSource:'agent-inspected',previewOnly:true,inferredDimensions:true,sourceStudyOnly:true,assembly,accessEvidence:'visible-recess-perspective-inferred-depth',contactCertified:false});
 const aperture=source.apertureBounds,back=source.backDoorBounds,leftDoor=source.leftDoorBounds,rightReturn=source.rightGlazedReturnBounds,rightFront=source.rightFrontGlazingBounds;
 if(![aperture,back,leftDoor,rightReturn,rightFront].every((b:any)=>Array.isArray(b)&&b.length===4))return [];
 const [al,at,ar,ab]=aperture,[bl,bt,br,bb]=back;
 const outerL=t(ar),outerR=t(al),rearL=t(br),rearR=t(bl),floor=y(source.landingBottomPixelY??ab);
 // The side returns, rear lintel, and floor share the same aperture edges;
 // they describe one cavity instead of independent boxes on the wall plane.
 const shell=[
  quad([point(rearR,y(ab),depth+.04),point(outerR,y(ab),depth+.04),point(outerR,y(at),depth+.04),point(rearR,y(bt),depth+.04)],'#353b36','recess-left-return'),
  quad([point(outerL,y(at),0),point(rearL,y(bt),depth),point(rearR,y(bt),depth),point(outerR,y(at),0)],'#d6d4bc','recess-soffit'),
  quad([point(outerL,floor,0),point(outerR,floor,0),point(rearR,y(bb),depth),point(rearL,y(bb),depth)],'#b9ad96','recess-floor'),
 ];
 if(Array.isArray(source.corniceBounds)&&source.corniceBounds.length===4){const [l,top,r,bottom]=source.corniceBounds;shell.push(quad([point(t(r),y(bottom),-.012),point(t(l),y(bottom),-.012),point(t(l),y(top),-.012),point(t(r),y(top),-.012)],'#d6d4bc','recess-cornice'));}
 // Door and glazing detail is warped from the inspected source patches by the
 // caller. Only the physical cavity support is synthesized here.
 return shell;
}
export function applySourceAssemblies(study:any,input:any,annotations:any[]){
 const H=input.height*.01,W=input.width*.01,margin=.12,frame=study.frame,wall=study.owner.geometry.building.surfaces[0];
 study.omissions??=[];
 for(const a of annotations??[]){
  const opening=input.features.find((f:any)=>f.id===a.featureId);if(!opening){study.omissions.push(`${a.id}: opening feature unavailable`);continue;}
  const perspective=a.perspectiveRecess, b=perspective?.apertureBounds??a.visibleOpeningBounds??opening.bounds,access=a.sourceAccess??{},openingBottom=access.openingBottomPixelY??b[3],bottom=H-openingBottom*.01,top=H-b[1]*.01;
  // Source-space studies deliberately mirror image x; helper frame t includes
  // its .12m image margin, unlike the old direct pixel-to-wall schema.
  const left=W+margin-b[2]*.01,right=W+margin-b[0]*.01,pavementPx=access.pavementPixelY;
  if(top<=bottom||left<0||right>frame.width){study.omissions.push(`${a.id}: projected opening outside source study`);continue;}
  const visibleStairs=access.accessKind==='stairs'&&Number.isFinite(pavementPx)&&pavementPx>openingBottom;
  const visibleBounds=Array.isArray(access.visibleAccessBounds)&&access.visibleAccessBounds.length===4&&access.visibleAccessBounds.every(Number.isFinite)?access.visibleAccessBounds:null;
  // A photographed lower edge of a stair run is sufficient to render that
  // partial run. It is explicitly not a pavement/contact measurement.
  const partialRun=!visibleStairs&&access.accessKind==='stairs'&&!!visibleBounds&&visibleBounds[3]>openingBottom;
  const runBottomPx=visibleStairs?pavementPx:partialRun?visibleBounds![3]:openingBottom;
  const count=(visibleStairs||partialRun)?(Number.isInteger(access.visibleStepCount)&&access.visibleStepCount>0?access.visibleStepCount:Math.max(1,Math.min(12,Math.round((runBottomPx-openingBottom)/28)))):undefined;
  const pavement=(visibleStairs||partialRun)?H-runBottomPx*.01:bottom;
  const depth=a.projectionIntent?.recess&&a.projectionIntent?.inferMetricDepth?Math.min(.55,Math.max(.18,(right-left)*.22)):0;
  const cavityBottom=perspective?H-b[3]*.01:bottom;
  const item:any={id:a.id,featureId:a.featureId,t:(left+right)/2,y:(top+cavityBottom)/2,width:right-left,height:top-cavityBottom,colour:opening.colour,access:(visibleStairs||partialRun)?{kind:'stairs',pavementY:pavement,landingDepthM:.14,stepCount:count,riseM:(bottom-pavement)/count,treadM:.24}:{kind:'landing',pavementY:cavityBottom,landingDepthM:0},...(depth?{recess:{depthM:depth}}:{})};
  if(partialRun)study.omissions.push(`${a.id}: pavement unresolved; only visible portion rendered`);
  else if(!visibleStairs&&access.accessKind==='stairs')study.omissions.push(`${a.id}: pavement contact unresolved; stairs omitted`);
  const voidDescriptor=entranceOpeningVoid(item);
  if(voidDescriptor){
   const toWall=(t:number,y:number)=>[frame.a[0]+frame.u[0]*t, y, frame.a[1]+frame.u[1]*t];
   wall.rings.push([toWall(left,bottom),toWall(right,bottom),toWall(right,top),toWall(left,top)]);
   const x0=toWall(left,bottom)[0],x1=toWall(right,bottom)[0];
   for(const p of study.patches)if(p.featureKind==='observed-material'||(p.featureKind==='observed-fascia'&&!p.sign))p.triangles=cutTriangles(p.triangles,[Math.min(x0,x1),bottom,Math.max(x0,x1),top]);
   // Preserve the source door grammar (panels, glazing, transom and frames)
   // by moving its existing observed geometry to the rear recess plane.
   // This is a preview placement inference, never a new source feature.
   for(const p of study.patches)if(p.featureId.endsWith(a.featureId))for(let index=0;index<p.triangles.length;index+=3){p.triangles[index]-=frame.n[0]*depth;p.triangles[index+2]-=frame.n[1]*depth;}
  }
  if(perspective){
   const warped=[
    [perspective.leftDoorFeatureId??'ground:door-left',perspective.leftDoorBounds,Math.min(depth*.22,.14),depth*.7],
    [perspective.rightReturnFeatureId??'ground:window-display-left',perspective.rightGlazedReturnBounds,.12,depth],
    [perspective.rightFrontFeatureId??'ground:window-display-right',perspective.rightFrontGlazingBounds,.08,.08],
   ];
   for(const [id,bounds,leftDepth,rightDepth] of warped)if(Array.isArray(bounds))warpObservedFeature(study,frame,H,W,margin,id as string,bounds as number[],leftDepth as number,rightDepth as number);
  }
  let patches=perspective?compilePerspectiveRecess(frame,H,W,margin,perspective,a.featureId,depth):compileEntranceAssembly(frame,item);
  if(voidDescriptor){
   // The helper rear plane fills the recess behind the observed door. Drop it
   // only if a translated source patch lies on the same plane and would z-fight.
   const observedDepths=study.patches.filter((p:any)=>p.featureId.endsWith(a.featureId)).flatMap((p:any)=>{const depths:number[]=[];for(let offset=0;offset<p.triangles.length;offset+=3)depths.push((p.triangles[offset]-frame.a[0])*frame.n[0]+(p.triangles[offset+2]-frame.a[1])*frame.n[1]);return depths;});
   const overlapsRear=observedDepths.some((value:number)=>Math.abs(value+depth)<.008);
   if(overlapsRear)patches=patches.filter(p=>!(p.assembly==='entrance-recess'&&p.triangles.filter((_:number,index:number)=>index%3===0).every((_:number,vertex:number)=>{const offset=vertex*3;const value=(p.triangles[offset]-frame.a[0])*frame.n[0]+(p.triangles[offset+2]-frame.a[1])*frame.n[1];return Math.abs(value+depth)<.008;})));
  }
  patches=patches.map(p=>({...p,colour:FACADE_PATCH_COLOURS[p.colour]??p.colour,featureId:`source-assembly:${a.featureId}`,sourceStudyOnly:true,accessEvidence:p.accessEvidence??(visibleStairs?'visible-partial-or-inferred-steps':partialRun?'partial-visible-run-no-pavement':'pavement-unresolved-no-stairs'),contactCertified:false}));
  study.patches.push(...patches);
 }
 return study;
}
