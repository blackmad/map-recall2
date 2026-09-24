/** Conservative, explicitly synthetic facade rhythm. These recipes never write
 * extracted opening counts, roof shapes, commercial identities or review labels.
 * Evidence selects a physical interval and ground-floor class; geometry supplies
 * a restrained display prior within that interval, including source holes.
 */
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { wallAxis, wallObservationIntervals, intervalFaceFrame } from '../../public/canal-drive/da-costa-block/wall-intervals.js';
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { rectangleFitsFace } from '../../public/canal-drive/da-costa-block/face-containment.js';
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { mayRenderReviewedAwning } from '../../public/canal-drive/da-costa-block/awning-evidence.js';
import type { BlockAppearanceGeometry } from './cityAppearanceThree.js';
import type { AppearanceTile } from './cityAppearanceTiles.js';
import { regularizeDoor, type DoorAdjustment } from './facadeDoorHeuristics.js';
import { napToSourceHeight } from './appearanceHeight.js';
import { boundFacadeSource, previewFacadeSource, fitFacadeFeature } from './facadeDescription.js';
import { openingProfile, profileHorizontalSpans, profileVerticalSpan } from './facadeOpeningLayout.js';

type Owner = AppearanceTile<BlockAppearanceGeometry, any>['owners'][number];
type Surface = BlockAppearanceGeometry['building']['surfaces'][number];
type Frame = { a: number[]; u: number[]; n: number[]; width: number; bottom: number; top: number; polygon: number[][]; holes: number[][][]; intervalBounded?: boolean };
export type FacadeRecipePatch = {
  triangles: number[];
  heuristics?: DoorAdjustment[];
  colour: 'windowGlass' | 'windowGlassBlue' | 'windowGlassWarm' | 'windowFrame' | 'windowFrameDark' | 'doorWood' | 'shopGlass' | 'awningFabric' | 'facadeTrimLight' | 'facadeTrimDark' | `#${string}`;
  observationId: string | null;
  featureId: string;
  featureKind: 'window-prior' | 'contextual-window-prior' | 'contextual-door-prior' | 'contextual-trim-prior' | 'shopfront-prior' | 'reviewed-awning-prior' | 'observed-window' | 'observed-door' | 'observed-material' | 'observed-awning' | 'observed-fascia';
  styleSource: 'procedural-prior-not-measured' | 'machine-observed-unreviewed' | 'agent-inspected' | 'human-reviewed';
  material?: 'brick';
  /** Candidate-plane inspection only. These patches are excluded unless the
   * caller explicitly asks for them and cannot represent accepted evidence. */
  previewOnly?: true;
  /** The source assembly crosses a published coplanar wall seam. Present only
   * in local candidate preview, never as a full registered feature. */
  partialAtFace?: true;
  sign?: {text:string;background:string;colour:string;font?:string;physicalSignId:string;aspectRatio?:number;uv:number[]};
  /** Internal source-space mapping removed before a patch leaves compilation. */
  signMapping?: {left:number;right:number;bottom:number;top:number;sourceXForward:boolean};
};
export const FACADE_PATCH_COLOURS:Record<FacadeRecipePatch['colour'],string>={windowGlass:'#526a6b',windowGlassBlue:'#4b6268',windowGlassWarm:'#62685d',windowFrame:'#ddd8c7',windowFrameDark:'#676963',doorWood:'#3f342d',shopGlass:'#354a4b',awningFabric:'#807765',facadeTrimLight:'#b9ad96',facadeTrimDark:'#61584e'};

function inside(point: number[], ring: number[][]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function insideBuilding(point: number[], geometry: BlockAppearanceGeometry['building']['footprint']): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => inside(point, polygon[0]) && !polygon.slice(1).some(hole => inside(point, hole)));
}
// Cache a world-coordinate spatial index per immutable owner list. This keeps
// district compilation and viewport recipes local without changing containment.
const neighbourIndexes=new WeakMap<object,Map<string,Owner[]>>();
function indexedNeighbours(point:number[],owner:Owner,neighbours:Owner[]){
  let grid=neighbourIndexes.get(neighbours);if(!grid){grid=new Map();for(const other of neighbours){const g=other.geometry.building.footprint,polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates,points=polygons.flat(2),origin=other.geometry.frame.originRD,xs=points.map(p=>p[0]+origin.x),ys=points.map(p=>origin.y-p[1]);for(let x=Math.floor(Math.min(...xs)/32);x<=Math.floor(Math.max(...xs)/32);x++)for(let y=Math.floor(Math.min(...ys)/32);y<=Math.floor(Math.max(...ys)/32);y++){const key=`${x},${y}`,bucket=grid.get(key)??[];bucket.push(other);grid.set(key,bucket);}}neighbourIndexes.set(neighbours,grid);}
  const origin=owner.geometry.frame.originRD;return grid.get(`${Math.floor((point[0]+origin.x)/32)},${Math.floor((origin.y-point[1])/32)}`)??[];
}
function neighbourAt(point: number[], owner: Owner, neighbours: Owner[]): boolean {
  const origin = owner.geometry.frame.originRD;
  return indexedNeighbours(point,owner,neighbours).some(other => {
    if (other.id === owner.id) return false;
    const otherOrigin = other.geometry.frame.originRD;
    return insideBuilding([point[0] + origin.x - otherOrigin.x, point[1] + otherOrigin.y - origin.y], other.geometry.building.footprint);
  });
}
function rectangleClear(frame: Frame, t: number, width: number, owner: Owner, neighbours: Owner[]): boolean {
  return [-.5, 0, .5].every(fraction => {
    const along = t + width * fraction;
    return !neighbourAt([frame.a[0] + frame.u[0] * along + frame.n[0] * .08, frame.a[1] + frame.u[1] * along + frame.n[1] * .08], owner, neighbours);
  });
}

export function facadeWallFrame(surface: Surface, owner: Owner, neighbours: Owner[]): Frame | null {
  const axis = wallAxis(surface);
  if (!axis || axis.length < 1.5) return null;
  if (surface.rings.flat().some(point => Math.abs((point[0] - axis.origin[0]) * axis.u[1] - (point[2] - axis.origin[1]) * axis.u[0]) > .1)) return null;
  const a = axis.origin, u = axis.u, midpoint = [a[0] + u[0] * axis.length / 2, a[1] + u[1] * axis.length / 2];
  let n = [-u[1], u[0]];
  const offset = (direction: number[], depth: number) => [midpoint[0] + direction[0] * depth, midpoint[1] + direction[1] * depth];
  if (insideBuilding(offset(n, .25), owner.geometry.building.footprint)) n = n.map(value => -value);
  if (insideBuilding(offset(n, .25), owner.geometry.building.footprint)) return null;
  // Context owners may use another local RD origin. Compare in each neighbour's
  // own coordinate frame, never assume a city-wide tile-local origin.
  if (neighbourAt(offset(n, .25), owner, neighbours)) return null;
  const project = (point: number[]) => [(point[0] - a[0]) * u[0] + (point[2] - a[1]) * u[1], point[1]];
  const rings = surface.rings.map(ring => ring.map(project));
  return { a, u, n, width: axis.length, bottom: Math.min(...rings[0].map(point => point[1])), top: Math.max(...rings[0].map(point => point[1])), polygon: rings[0], holes: rings.slice(1) };
}
const contextualPrimaryWall=new WeakMap<object,number>();
function primaryExteriorWall(owner:Owner,neighbours:Owner[]):number{const cached=contextualPrimaryWall.get(owner);if(cached!==undefined)return cached;let primary=-1,width=0;owner.geometry.building.surfaces.forEach((surface,index)=>{if(surface.type!=='wall')return;const frame=facadeWallFrame(surface,owner,neighbours);if(frame&&frame.width>width){width=frame.width;primary=index;}});contextualPrimaryWall.set(owner,primary);return primary;}

const usableSource = (record: any, kind: string) => {
  const image = record.images?.[kind];
  return !!image && /^[a-f0-9]{64}$/i.test(image.sha256 ?? '') && /^[a-f0-9]{64}$/i.test(image.panoramaSha256 ?? '');
};
const validPlacement = (record: any) => !['rejected', 'uncertain', 'crop-repair'].includes(record.review?.placement);

/** Envelope/source binding is separate from individual field eligibility. */
export function facadeRecipeRecords(owners: Owner[]): any[] {
  return owners.flatMap(owner => owner.observations.filter(observation => {
    const record = observation.payload;
    return observation.buildingId === owner.id && observation.geometryRevision === owner.geometryRevision
      && observation.evidenceKey && record?.evidenceKey === observation.evidenceKey && record?.derivationKey
      && record.renderBuildingId === owner.id && !record.machineRevocation?.revoked && validPlacement(record);
  }).map(observation => observation.payload));
}

function groundSupported(record: any): boolean {
  if (!usableSource(record, 'ground') || !['yes', 'no'].includes(record.effectiveProposal?.shopfront)) return false;
  const human = record.review?.placement === 'accepted' && record.proposalSources?.shopfront === 'human-review';
  if (human) return true;
  if (record.visualReview?.fieldEligibility?.shopfront === false) return false;
  return record.visualReview?.fieldEligibility?.shopfront === true || record.effectiveProposal?.groundUsable === 'yes';
}
function upperSupported(record: any): boolean {
  return usableSource(record, 'full') && record.effectiveProposal?.wholeUsable === 'yes'
    && record.visualReview?.appearanceEligible !== false;
}
const onFace = (frame: Frame, t: number, y: number, depth: number): number[] => [frame.a[0] + frame.u[0] * t + frame.n[0] * depth, y, frame.a[1] + frame.u[1] * t + frame.n[1] * depth];
function quad(frame: Frame, t: number, y: number, width: number, height: number, depth: number): number[] {
  const points = [[t - width / 2, y - height / 2], [t + width / 2, y - height / 2], [t + width / 2, y + height / 2], [t - width / 2, y + height / 2]].map(([x, z]) => onFace(frame, x, z, depth));
  const indices = -frame.u[1] * frame.n[0] + frame.u[0] * frame.n[1] >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  return indices.flatMap(index => points[index]);
}
type FacePoint=[number,number];
const signedArea=(points:FacePoint[])=>points.reduce((sum,p,index)=>{const q=points[(index+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
function convex(ring:FacePoint[]):boolean{
  let direction=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length],turn=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(turn)<1e-9)continue;
    const next=Math.sign(turn);if(direction&&next!==direction)return false;direction=next;
  }
  return direction!==0;
}
/** Clip a polygon at one convex wall piece. Concave wall rings are first
 * triangulated, so this routine never receives a concave clip boundary. */
function clipToFace(subject:FacePoint[],face:FacePoint[]):FacePoint[]{
  if(face.length<3||Math.abs(signedArea(face))<1e-8)return[];
  const sign=Math.sign(signedArea(face));let output=subject;
  for(let i=0;i<face.length;i++){
    const a=face[i],b=face[(i+1)%face.length],input=output;output=[];
    const side=(p:FacePoint)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q),pin=sign*sp>=-1e-8,qin=sign*sq>=-1e-8;
      if(pin)output.push(p);
      if(pin!==qin){const ratio=sp/(sp-sq);output.push([p[0]+(q[0]-p[0])*ratio,p[1]+(q[1]-p[1])*ratio]);}
    }
  }
  return output;
}
const cross=(a:FacePoint,b:FacePoint,c:FacePoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onBoundary=(point:FacePoint,ring:FacePoint[])=>ring.some((a,index)=>{const b=ring[(index+1)%ring.length];return Math.abs(cross(a,b,point))<1e-8&&point[0]>=Math.min(a[0],b[0])-1e-8&&point[0]<=Math.max(a[0],b[0])+1e-8&&point[1]>=Math.min(a[1],b[1])-1e-8&&point[1]<=Math.max(a[1],b[1])+1e-8;});
const insideInclusive=(point:FacePoint,ring:FacePoint[])=>onBoundary(point,ring)||inside(point,ring);
const pointInTriangle=(point:FacePoint,a:FacePoint,b:FacePoint,c:FacePoint)=>{
  const winding=Math.sign(cross(a,b,c));
  return winding*cross(a,b,point)>=-1e-8&&winding*cross(b,c,point)>=-1e-8&&winding*cross(c,a,point)>=-1e-8;
};
function segmentContained(a:FacePoint,b:FacePoint,ring:FacePoint[]):boolean{
  const direction:FacePoint=[b[0]-a[0],b[1]-a[1]],length2=direction[0]*direction[0]+direction[1]*direction[1];
  if(length2<1e-16)return insideInclusive(a,ring);
  const parameters=[0,1];
  for(let index=0;index<ring.length;index++){
    const c=ring[index] as FacePoint,d=ring[(index+1)%ring.length] as FacePoint,edge:FacePoint=[d[0]-c[0],d[1]-c[1]],offset:FacePoint=[c[0]-a[0],c[1]-a[1]],denominator=direction[0]*edge[1]-direction[1]*edge[0];
    if(Math.abs(denominator)<1e-12){
      if(Math.abs(offset[0]*direction[1]-offset[1]*direction[0])<1e-10)for(const point of [c,d])parameters.push(Math.max(0,Math.min(1,((point[0]-a[0])*direction[0]+(point[1]-a[1])*direction[1])/length2)));
      continue;
    }
    const t=(offset[0]*edge[1]-offset[1]*edge[0])/denominator,u=(offset[0]*direction[1]-offset[1]*direction[0])/denominator;
    if(t>=-1e-10&&t<=1+1e-10&&u>=-1e-10&&u<=1+1e-10)parameters.push(Math.max(0,Math.min(1,t)));
  }
  parameters.sort((left,right)=>left-right);
  return parameters.every((value,index)=>index===parameters.length-1||insideInclusive([a[0]+direction[0]*(value+parameters[index+1])/2,a[1]+direction[1]*(value+parameters[index+1])/2],ring));
}
const triangleContained=(triangle:FacePoint[],ring:FacePoint[])=>triangle.every((point,index)=>insideInclusive(point,ring)&&segmentContained(point,triangle[(index+1)%3],ring));
/** Ear clipping retains the exact wall boundary while producing only convex
 * targets. It fails closed if a malformed/self-intersecting ring has no ear. */
function triangulateFace(ring:FacePoint[]):FacePoint[][]{
  const points=ring.filter((point,index)=>index===0||Math.abs(point[0]-ring[index-1][0])>1e-10||Math.abs(point[1]-ring[index-1][1])>1e-10);
  if(points.length>2&&Math.abs(points[0][0]-points.at(-1)![0])<1e-10&&Math.abs(points[0][1]-points.at(-1)![1])<1e-10)points.pop();
  const winding=Math.sign(signedArea(points));if(points.length<3||!winding)return[];
  const remaining=points.map((_,index)=>index),triangles:FacePoint[][]=[];
  while(remaining.length>3){let ear=-1;
    for(let i=0;i<remaining.length;i++){
      const previous=remaining[(i+remaining.length-1)%remaining.length],current=remaining[i],next=remaining[(i+1)%remaining.length],a=points[previous],b=points[current],c=points[next];
      if(winding*cross(a,b,c)<=1e-10)continue;
      if(remaining.some(index=>index!==previous&&index!==current&&index!==next&&pointInTriangle(points[index],a,b,c)))continue;
      ear=i;triangles.push([a,b,c]);break;
    }
    if(ear<0)return[];remaining.splice(ear,1);
  }
  triangles.push(remaining.map(index=>points[index]));return triangles;
}
const faceTriangulations=new WeakMap<object,FacePoint[][]>();
function clipToPolygon(subject:FacePoint[],face:FacePoint[]):FacePoint[][]{
  if(convex(face)){const clipped=clipToFace(subject,face);return clipped.length>=3&&Math.abs(signedArea(clipped))>1e-10?[clipped]:[];}
  let pieces=faceTriangulations.get(face);if(!pieces){pieces=triangulateFace(face);faceTriangulations.set(face,pieces);}
  return pieces.map(piece=>clipToFace(subject,piece)).filter(piece=>piece.length>=3&&Math.abs(signedArea(piece))>1e-10);
}
function materialRegion(frame:Frame,t:number,y:number,width:number,height:number,depth:number):number[]{
  const triangles:number[]=[];
  for(const clipped of clipToPolygon([[t-width/2,y-height/2],[t+width/2,y-height/2],[t+width/2,y+height/2],[t-width/2,y+height/2]],frame.polygon as FacePoint[])){
    for(let i=1;i<clipped.length-1;i++){
      const tri=[clipped[0],clipped[i],clipped[i+1]],centroid:FacePoint=[tri.reduce((sum,p)=>sum+p[0],0)/3,tri.reduce((sum,p)=>sum+p[1],0)/3];
      if(frame.holes.some(hole=>insideInclusive(centroid,hole as FacePoint[])))continue;
      triangles.push(...tri.flatMap(([x,z])=>onFace(frame,x,z,depth)));
    }
  }
  return triangles;
}
function signUv(triangles:number[],frame:Frame,mapping:NonNullable<FacadeRecipePatch['signMapping']>):number[]{
  return triangles.flatMap((_,index)=>{if(index%3!==0)return[];const t=(triangles[index]-frame.a[0])*frame.u[0]+(triangles[index+2]-frame.a[1])*frame.u[1],y=triangles[index+1];let u=(t-mapping.left)/(mapping.right-mapping.left);if(!mapping.sourceXForward)u=1-u;return [Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,(y-mapping.bottom)/(mapping.top-mapping.bottom)))]});
}
export function clipTrianglesToFace(triangles:number[],frame:Frame):number[]{
  const clipped:number[]=[];
  for(let i=0;i<triangles.length;i+=9){
    const world=[0,1,2].map(index=>triangles.slice(i+index*3,i+index*3+3));
    const local=world.map(point=>[(point[0]-frame.a[0])*frame.u[0]+(point[2]-frame.a[1])*frame.u[1],point[1]] as FacePoint);
    // Preserve depth-varying canopy triangles (including edge-on triangles)
    // without projecting them flat when they already fit the wall silhouette.
    // Keep contained depth-varying and edge-on canopy faces byte-identical.
    // Checking every edge interval prevents three inside vertices from
    // bridging a concave notch. Faces with holes retain the established
    // downstream centroid behavior rather than taking this shortcut.
    if(!frame.holes.length&&triangleContained(local,frame.polygon as FacePoint[])){clipped.push(...world.flat());continue;}
    const depths=world.map(p=>(p[0]-frame.a[0])*frame.n[0]+(p[2]-frame.a[1])*frame.n[1]);
    const det=(local[1][1]-local[2][1])*(local[0][0]-local[2][0])+(local[2][0]-local[1][0])*(local[0][1]-local[2][1]);
    const atDepth=(t:number,y:number)=>{if(Math.abs(det)<1e-12)return depths[0];const a=((local[1][1]-local[2][1])*(t-local[2][0])+(local[2][0]-local[1][0])*(y-local[2][1]))/det,b=((local[2][1]-local[0][1])*(t-local[2][0])+(local[0][0]-local[2][0])*(y-local[2][1]))/det;return a*depths[0]+b*depths[1]+(1-a-b)*depths[2];};
    for(const polygon of clipToPolygon(local,frame.polygon as FacePoint[]))for(let j=1;j<polygon.length-1;j++){
      const tri=[polygon[0],polygon[j],polygon[j+1]],centroid:FacePoint=[tri.reduce((sum,p)=>sum+p[0],0)/3,tri.reduce((sum,p)=>sum+p[1],0)/3];
      if(frame.holes.some(hole=>insideInclusive(centroid,hole as FacePoint[])))continue;
      clipped.push(...tri.flatMap(([t,y])=>onFace(frame,t,y,atDepth(t,y))));
    }
  }
  return clipped;
}

/** Raised joinery surrounds an open centre, so recessed glazing stays visible. */
function frameBorder(frame:Frame,t:number,y:number,width:number,height:number,border:number,depth:number):number[]{
  return [...quad(frame,t,y-height/2-border/2,width+2*border,border,depth),...quad(frame,t,y+height/2+border/2,width+2*border,border,depth),...quad(frame,t-width/2-border/2,y,border,height,depth),...quad(frame,t+width/2+border/2,y,border,height,depth)];
}
/** Nearest same-row opening's glazing gap in source pixels, or Infinity.
 * Two openings belong to the same row when their vertical spans overlap by at
 * least half of the smaller opening; stacked openings are skipped. */
function sameRowOpeningGapPx(features:any[],feature:any):number{
  const bounds=feature?.bounds;
  if(!Array.isArray(bounds)||bounds.length!==4)return Infinity;
  const[x0,y0,x1,y1]=bounds;let gap=Infinity;
  for(const other of features??[]){
    if(other===feature||!['window','door'].includes(other.kind))continue;
    const o=other.bounds;if(!Array.isArray(o)||o.length!==4)continue;
    const vertical=Math.min(y1,o[3])-Math.max(y0,o[1]);
    if(vertical<=0||vertical<.5*Math.min(y1-y0,o[3]-o[1]))continue;
    let horizontal:number;
    if(o[2]<=x0)horizontal=x0-o[2];else if(x1<=o[0])horizontal=o[0]-x1;else continue;
    if(horizontal<gap)gap=horizontal;
  }
  return gap;
}

function observedAssemblyPatches(owner:Owner,wall:Frame,frame:Frame,record:any,source:NonNullable<ReturnType<typeof boundFacadeSource>>,neighbours:Owner[],include=(feature:any)=>true,clipOpeningsAtFace=false):FacadeRecipePatch[]{
  const patches:FacadeRecipePatch[]=[];
  // Source-shape previews use metres only as a pixel-space drawing scale
  // (one source pixel is .01 units). Inspected drawing widths stay with the
  // specific feature, leaving all other source studies and metric joinery as is.
  const sourceShapeStudy=owner.geometryRevision==='source-space-unregistered';
  const genericSourceFacadeCandidate=clipOpeningsAtFace&&record.facadeDescription?.extractionVersion==='source-facade-owner-candidate/v1';
  const metricSourceWindowCandidate=clipOpeningsAtFace&&['case24-source-facade-candidate/v4-doors-and-display','source-facade-owner-candidate/v1'].includes(record.facadeDescription?.extractionVersion)
    && source.registration?.status==='ambiguous'&&source.registration?.preview?.kind==='native-crop-plane';
  const partialFeatureIds=new Set<string>();
  const groundedFeatureIds=new Set<string>();
  const groundY=Number.isFinite(owner.geometry.building.groundNAP)&&["NAP","legacy-block-NAP-minus-0.65m"].includes(owner.geometry.frame.heightDatum)?napToSourceHeight(owner.geometry.building.groundNAP!,owner.geometry.frame.heightDatum)-wall.bottom:undefined;
  const colour=(value:string|undefined,fallback:FacadeRecipePatch['colour']):FacadeRecipePatch['colour']=>/^#[a-f0-9]{6}$/i.test(value??'')?value as `#${string}`:fallback;
  // A window's declared colour is the observed glass hex. The extractor
  // sometimes returns the near-white frame or curtain it sampled instead
  // (case-11 De Clercqstraat 26 declared #ffffff for every upper window), and
  // painting that as glazing turns each window into a blank white pane. Treat a
  // near-white window colour as undeclared and fall back to the neutral glass;
  // a genuine glass hex is kept. Door leaves are excluded — a white door is
  // real architecture, and the reviewed ground tier supplies its own colours.
  const glazingColour=(feature:any,fallback:FacadeRecipePatch['colour']):FacadeRecipePatch['colour']=>{
    if(feature.kind==='window'){
      const match=/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(feature.colour??'');
      if(match&&[1,2,3].every(index=>parseInt(match[index],16)>=235))return fallback;
    }
    return colour(feature.colour,fallback);
  };
  const shift=(frame.a[0]-wall.a[0])*wall.u[0]+(frame.a[1]-wall.a[1])*wall.u[1];
  for(const feature of source.features??[]){
    if(!include(feature))continue;
    // A trim region that spans the whole crop is not a localized accent. The
    // extraction returned exactly that on case-14 (region 'accent', #ffffff,
    // full bounds) over a red-brick upper wall, and painting it would repaint
    // the facade white. Skip the unusable trim and let the wall material stand.
    if(feature.kind==='material'&&feature.region&&['accent','band','surround','plinth'].includes(feature.region)
      &&Array.isArray(feature.bounds)&&feature.bounds.length===4&&feature.bounds.every(Number.isFinite)){
      const dimensions=source.imageDimensions;
      const area=Math.max(0,feature.bounds[2]-feature.bounds[0])*Math.max(0,feature.bounds[3]-feature.bounds[1]);
      if(dimensions&&area/(dimensions.width*dimensions.height)>=.6)continue;
    }
    // Concave material is opt-in and source/feature bound. This keeps existing
    // component candidates byte-stable until their finishes receive a separate
    // source-first review.
    const concaveMaterial=record.facadeDescription?.concaveMaterialPreview;
    const reviewedConcaveMaterial=concaveMaterial?.sourceCropSha256===source.cropSha256&&concaveMaterial?.featureIds?.includes(feature.id);
    if(genericSourceFacadeCandidate&&feature.kind==='material'&&!convex(frame.polygon as FacePoint[])&&!reviewedConcaveMaterial)continue;
    const fitted=fitFacadeFeature(feature,source,record);if(!fitted)continue;
    let regularized=regularizeDoor(fitted,groundY);
    if(regularized.adjustments.length){
      const proposed=regularized.feature,border=proposed.lintelHead||proposed.surroundColour?.length? .14:.07;
      if(!rectangleFitsFace(frame,proposed.t-shift,proposed.y+wall.bottom+border/2,proposed.width+border*2,proposed.height+border)||!rectangleClear(frame,proposed.t-shift,proposed.width+border*2,owner,neighbours))regularized={feature:fitted,adjustments:[]};
    }
    const f=regularized.feature;
    const sourcePixelScale=metricSourceWindowCandidate&&Array.isArray(f.bounds)?(()=>{
      const h=source.registration.imageToWall,[x0,y0,x1,y1]=f.bounds,cx=(x0+x1)/2,cy=(y0+y1)/2;
      const project=(x:number,y:number)=>{const d=h[6]*x+h[7]*y+h[8];return Math.abs(d)>1e-8?[(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d]:null;};
      const centre=project(cx,cy),right=project(cx+1,cy),down=project(cx,cy+1);if(!centre||!right||!down)return undefined;
      const horizontal=Math.hypot(right[0]-centre[0],right[1]-centre[1]),vertical=Math.hypot(down[0]-centre[0],down[1]-centre[1]);
      const scale=(horizontal+vertical)/2;return Number.isFinite(scale)&&scale>0&&scale<.1?scale:undefined;
    })():undefined;
    const drawingScale=sourceShapeStudy?.01:sourcePixelScale;
    const sourceFrameWidth=drawingScale&&Number.isFinite(f.sourceFrameWidthPx)&&f.sourceFrameWidthPx!>0&&f.sourceFrameWidthPx!<=12?f.sourceFrameWidthPx!*drawingScale:undefined;
    const sourceJoineryWidth=drawingScale&&Number.isFinite(f.sourceJoineryWidthPx)&&f.sourceJoineryWidthPx!>0&&f.sourceJoineryWidthPx!<=12?f.sourceJoineryWidthPx!*drawingScale:undefined;
    // A fixed frame border is wider than some genuine piers: the extraction can
    // place two openings a few pixels apart (case-05 Lauriergracht 67/69 has a
    // 1.9 px glazing gap), and each opening's frame then protrudes across its
    // neighbour so the pair reads as overlapping windows. `frameClearancePx` is
    // an opt-in, per-feature reviewed clearance measured from the source in
    // pixels; the frame is capped to it (and never past the nearest same-row
    // opening), so the two frames meet instead of crossing. Only a feature whose
    // reviewer declared the field is changed, so every other source study and
    // metric candidate is byte-stable. The clearance scale is the
    // source-pixel->wall scale and is separate from `drawingScale`, which also
    // scales declared frame/joinery widths.
    const clearanceScale=drawingScale??(()=>{
      const h=source.registration?.imageToWall;if(!Array.isArray(h)||h.length!==9)return undefined;
      const[x0,y0,x1,y1]=f.bounds,cx=(x0+x1)/2,cy=(y0+y1)/2;
      const project=(x:number,y:number)=>{const d=h[6]*x+h[7]*y+h[8];return Math.abs(d)>1e-8?[(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d]:null;};
      const centre=project(cx,cy),right=project(cx+1,cy);if(!centre||!right)return undefined;
      const scale=Math.hypot(right[0]-centre[0],right[1]-centre[1]);return Number.isFinite(scale)&&scale>0&&scale<.5?scale:undefined;
    })();
    let frameBorderWidth=sourceFrameWidth??.14;
    if(clearanceScale&&Number.isFinite(f.frameClearancePx)&&f.frameClearancePx!>0){
      const gapPx=sameRowOpeningGapPx(source.features??[],feature);
      const cappedPx=Number.isFinite(gapPx)?Math.min(f.frameClearancePx!,gapPx):f.frameClearancePx!;
      frameBorderWidth=Math.min(frameBorderWidth,Math.max(0,cappedPx*clearanceScale));
    }
    const joineryWidth=sourceJoineryWidth??.065;
    const joineryInset=sourceJoineryWidth ? .008 : .08;
    // The registration yields height above the canonical surface base. The
    // source mesh retains its own datum, so add its wall base only at this
    // renderer boundary; neither the source plane nor NAP geometry is changed.
    const t=f.t-shift,y=f.y+wall.bottom,opening=f.kind==='window'||f.kind==='door',border=opening ? (f.lintelHead||f.surroundColour?.length ? .14 : .07) : 0;
    const adjustedDoor=regularized.adjustments.length>0;
    // The leaf reaches pavement; clip the bottom frame to the existing wall.
    // Side and top clearance still apply, including neighbouring frontages.
    const fits=rectangleFitsFace(frame,t,y+(adjustedDoor?border/2:0),f.width+border*2,f.height+border*(adjustedDoor?1:2))&&rectangleClear(frame,t,f.width+border*2,owner,neighbours);
    const clippedOpening=opening&&!fits&&clipOpeningsAtFace;
    if((opening||f.kind==='awning')&&!fits&&!clippedOpening)continue;
    const kind:FacadeRecipePatch['featureKind']=f.kind==='door'?'observed-door':f.kind==='window'?'observed-window':f.kind==='awning'?'observed-awning':f.kind==='fascia'?'observed-fascia':'observed-material';
    const patchId=`${owner.id}:${record.id}:${f.id}`;
    if(clippedOpening)partialFeatureIds.add(patchId);
    if(adjustedDoor)groundedFeatureIds.add(patchId);
    const add=(triangles:number[],paint:FacadeRecipePatch['colour'])=>patches.push({triangles,colour:paint,observationId:record.id,featureId:patchId,featureKind:kind,styleSource:f.disposition as FacadeRecipePatch['styleSource'],...(adjustedDoor?{heuristics:regularized.adjustments}:{}),...(f.kind==='material'&&f.material==='brick'?{material:'brick' as const}:{})});
    const triangle=(a:number[],b:number[],c:number[],depth:number)=>[a,b,c].flatMap(([x,z])=>onFace(frame,t+x,y+z,depth));
    if(opening){
      if(!f.head||f.head==='unknown')continue;
      const inner=openingProfile(f.width,f.height,f.head,f.archRise,f.topCornerRadius),outer=openingProfile(f.width+frameBorderWidth,f.height+frameBorderWidth,f.head,f.archRise,f.topCornerRadius);
      for(let i=1;i<inner.length-1;i++)add(triangle(inner[0],inner[i],inner[i+1],.032),glazingColour(f,f.kind==='door'?'doorWood':'windowGlass'));
      for(let i=0;i<inner.length;i++){const j=(i+1)%inner.length;add([...triangle(inner[i],outer[i],outer[j],.072),...triangle(inner[i],outer[j],inner[j],.072)],colour(f.frameColour,'windowFrame'));}
      // Shallow reveal connects recessed infill to the frame, including arches.
      for(let i=0;i<inner.length;i++){const j=(i+1)%inner.length,a=onFace(frame,t+inner[i][0],y+inner[i][1],.032),b=onFace(frame,t+inner[j][0],y+inner[j][1],.032),c=onFace(frame,t+inner[j][0],y+inner[j][1],.072),d=onFace(frame,t+inner[i][0],y+inner[i][1],.072);add([...a,...b,...c,...a,...c,...d],colour(f.frameColour,'windowFrame'));}
      if(f.kind==='window')add(quad(frame,t,y-f.height/2-frameBorderWidth/4,f.width+frameBorderWidth,frameBorderWidth/2,.095),colour(f.frameColour,'windowFrame'));
      if(f.kind==='door'&&f.transom&&f.transom>0&&f.transom<.6){
        const cutoff=f.height*(.5-f.transom),glass:number[][]=[];
        for(let i=0;i<inner.length;i++){const a=inner[i],b=inner[(i+1)%inner.length];if(a[1]>=cutoff)glass.push(a);if((a[1]>=cutoff)!==(b[1]>=cutoff))glass.push([a[0]+(b[0]-a[0])*(cutoff-a[1])/(b[1]-a[1]),cutoff]);}
        for(let i=1;i<glass.length-1;i++)add(triangle(glass[0],glass[i],glass[i+1],.04),'windowGlass');
      }
      const transomY=f.transom&&f.transom>0&&f.transom<.6?f.height*(.5-f.transom):undefined;
      const opaqueHeadAboveTransom=(f as typeof f&{opaqueHeadAboveTransom?:boolean}).opaqueHeadAboveTransom;
      if(metricSourceWindowCandidate&&opaqueHeadAboveTransom===true&&f.kind==='window'&&f.head==='rectangular'&&transomY!==undefined){
        const headHeight=f.height/2-transomY;
        if(headHeight>0)add(quad(frame,t,y+transomY+headHeight/2,f.width,headHeight,.04),'windowFrameDark');
      }
      const vertical=(x:number)=>{const span=profileVerticalSpan(inner,x);if(!span)return;
        // Photographed source-study windows have an undivided upper light;
        // their mullion joins the transom and lower sill, never floats inside
        // the glass or pokes through the small upper pane.
        const top=(sourceShapeStudy||metricSourceWindowCandidate)&&f.mullionScope==='below-transom'&&f.kind==='window'&&transomY!==undefined?Math.min(span[1],transomY):span[1];
        const height=sourceJoineryWidth?top-span[0]-joineryInset:Math.max(.02,top-span[0]-.08);if(height>0)add(quad(frame,t+x,y+(span[0]+top)/2,joineryWidth,height,.078),colour(f.frameColour,'windowFrame'));};
      const horizontal=(localY:number)=>{for(const [left,right] of profileHorizontalSpans(inner,localY))add(quad(frame,t+(left+right)/2,y+localY,right-left,joineryWidth,.078),colour(f.frameColour,'windowFrame'));};
      if(f.paired)vertical(0);
      if(transomY!==undefined)horizontal(transomY);
      for(const at of f.mullions??[])if(at>0&&at<1)vertical(f.width*(at-.5));
      if(f.kind==='door'){
        // Inferred joinery and furniture give entrances a readable door grammar.
        // Keep all detail below the transom and inside the head's spring line.
        const style=f.doorStyle??'panelled',furniture=f.doorFurniture??'knob';
        const explicitGlazing=style==='glazed'&&f.doorGlazingRatio!==undefined;
        const bottom=-f.height/2,top=explicitGlazing&&!f.transom
          ?f.height*.5-(f.archRise??0)*f.height-.05
          :Math.min(f.height*(.5-(f.transom??.12)),f.height*.5-(f.archRise??0)*f.height)-.10;
        const leaves=f.paired?2:1,leafWidth=f.width/leaves,bodyHeight=top-bottom;
        const grammar=(triangles:number[],paint:FacadeRecipePatch['colour'],rule:DoorAdjustment)=>{
          add(triangles,paint);const patch=patches[patches.length-1];patch.styleSource='procedural-prior-not-measured';patch.heuristics=[...(patch.heuristics??[]),rule];
        };
        if(explicitGlazing&&bodyHeight>.65){
          const glassHeight=bodyHeight*f.doorGlazingRatio!,panelWidth=Math.max(.08,f.width-Math.min(.04,f.width*.1));
          add(quad(frame,t,y+top-glassHeight/2,panelWidth,glassHeight,.04),'windowGlass');
        }else if(bodyHeight>.65&&leafWidth>.36)for(let leaf=0;leaf<leaves;leaf++){
          const center=-f.width/2+leafWidth*(leaf+.5),panelWidth=leafWidth*.68;
          const panel=(cy:number,h:number,glass=false)=>{
            grammar(frameBorder(frame,t+center,y+cy,panelWidth,h,.025,.083),'#655e50','door-panel-grammar');
            grammar(quad(frame,t+center,y+cy,panelWidth,h,.081),glass?'windowGlass':colour(f.colour,'doorWood'),'door-panel-grammar');
          };
          if(style==='glazed'){
            panel(bottom+bodyHeight*.63,bodyHeight*.53,true);
            panel(bottom+bodyHeight*.19,bodyHeight*.19);
          }else if(style==='panelled'){
            panel(bottom+bodyHeight*.27,bodyHeight*.32);
            panel(bottom+bodyHeight*.70,bodyHeight*.36);
          }
          const handleX=center+(leaves===2?(leaf===0?1:-1):1)*leafWidth*.34;
          const handleY=bottom+Math.min(1.02,bodyHeight*.55);
          if(furniture==='knob'){
            const radius=Math.min(.035,leafWidth*.05),ring:number[][]=[];
            for(let j=0;j<10;j++){const a=j*Math.PI/5;ring.push(onFace(frame,t+handleX+Math.cos(a)*radius,y+handleY+Math.sin(a)*radius,.115));}
            const mid=onFace(frame,t+handleX,y+handleY,.135);
            grammar(ring.flatMap((v,j)=>[...mid,...v,...ring[(j+1)%ring.length]]),'#b4a17a','door-furniture-grammar');
          }else if(furniture==='pull'){
            grammar(quad(frame,t+handleX,y+handleY,.026,Math.min(.28,bodyHeight*.2),.12),'#b8b9b4','door-furniture-grammar');
          }
          if(style==='panelled'&&leaf===0){
            grammar(quad(frame,t+center,y+bottom+bodyHeight*.49,Math.min(.24,panelWidth*.65),.035,.11),'#aaa18a','door-furniture-grammar');
          }
        }
      }
      // Contrasting curved masonry stays outside the glazing silhouette.
      if(f.lintelHead||f.surroundColour){const lintel=openingProfile(f.width+.14,f.height+.14,f.lintelHead??f.head,f.lintelRise),arch=openingProfile(f.width+.28,f.height+.28,f.lintelHead??f.head,f.lintelRise);for(let i=2;i<arch.length-1;i++)add([...triangle(lintel[i],arch[i],arch[i+1],.06),...triangle(lintel[i],arch[i+1],lintel[i+1],.06)],colour(f.surroundColour,'facadeTrimLight'));}
    }else if(f.kind==='awning'){
      const signedAwningValance=(triangles:number[],paint:FacadeRecipePatch['colour'],bottom:number,top:number,depth:number)=>{
        if(!f.text?.trim()||!f.physicalSignId?.trim())return;
        // A physical tenant mark belongs on the photographed valance, not the
        // canopy stripes. Map it with the same signed source axis as fascia.
        const h=source.registration.imageToWall,x0=f.bounds[0],x1=f.bounds[2],sourceY=(f.bounds[1]+f.bounds[3])/2,denominator=(x:number)=>h[6]*x+h[7]*sourceY+h[8],project=(x:number)=>(h[0]*x+h[1]*sourceY+h[2])/denominator(x);
        const mapping={left:t-f.width/2,right:t+f.width/2,bottom,top,sourceXForward:project(x1)>project(x0)};
        add(triangles,paint);const patch=patches[patches.length-1];patch.sign={text:f.text.trim(),background:FACADE_PATCH_COLOURS[paint]??paint,colour:/^#[a-f0-9]{6}$/i.test(f.textColour??'')?f.textColour!:'#f4f1e8',...(f.signFont?.trim()?{font:f.signFont.trim()}:{}),physicalSignId:f.physicalSignId.trim(),aspectRatio:f.width/(top-bottom),uv:signUv(triangles,frame,mapping)};patch.signMapping=mapping;
      };
      if(f.state==='retracted'){
        const height=Math.min(.18,f.height),paint=colour(f.frameColour,colour(f.colour,'awningFabric'));
        add(quad(frame,t,y,f.width,height,.1),colour(f.colour,'awningFabric'));
        signedAwningValance(quad(frame,t,y,f.width,height,.104),paint,y-height/2,y+height/2,.104);
      }
      if(f.state==='extended'){
        // The photo bounds contain the canopy's vertical silhouette, not a
        // fixed-height fascia. The depth remains a display estimate.
        const top=y+f.height/2,bottom=y-f.height/2,valance=Math.min(.26,f.height*.22),drop=f.height-valance;
        const projection=Math.min(1.5,Math.max(.45,f.width*.22));
        const stripes=f.stripeColour?Math.max(2,Math.min(48,Math.round(f.stripeCount??20))):1,segments=f.awningProfile==='curved'?8:1;
        const profile=(a:number)=>[top-drop*(f.awningProfile==='curved'?1-Math.cos(a*Math.PI/2):a),.08+projection*(f.awningProfile==='curved'?Math.sin(a*Math.PI/2):a)];
        const face=(points:number[][],paint:FacadeRecipePatch['colour'])=>add([0,1,2,0,2,3].flatMap(i=>points[i]),paint);
        for(let strip=0;strip<stripes;strip++){
          const left=t-f.width/2+f.width*strip/stripes,right=t-f.width/2+f.width*(strip+1)/stripes,paint=colour(strip%2?f.stripeColour:f.colour,'awningFabric');
          for(let segment=0;segment<segments;segment++){
            const a=profile(segment/segments),b=profile((segment+1)/segments);
            face([onFace(frame,left,a[0],a[1]),onFace(frame,right,a[0],a[1]),onFace(frame,right,b[0],b[1]),onFace(frame,left,b[0],b[1])],paint);
          }
          const waves=f.valance==='scalloped'?Math.max(1,Math.round((right-left)/.16)):1;
          for(let wave=0;wave<waves;wave++)for(let part=0;part<(f.valance==='scalloped'?6:1);part++){
            const divisions=f.valance==='scalloped'?6:1,a=part/divisions,b=(part+1)/divisions;
            const x0=left+(right-left)*(wave+a)/waves,x1=left+(right-left)*(wave+b)/waves;
            const hem=(v:number)=>bottom+(f.valance==='scalloped'?Math.min(.06,valance*.3)*(1-Math.sin(v*Math.PI)):0);
            face([onFace(frame,x0,bottom+valance,.08+projection),onFace(frame,x1,bottom+valance,.08+projection),onFace(frame,x1,hem(b),.08+projection),onFace(frame,x0,hem(a),.08+projection)],paint);
          }
        }
        const valancePaint=colour(f.frameColour,colour(f.colour,'awningFabric'));
        // Keep text above the highest scallop edge so the photographed hem
        // remains readable instead of being covered by a flat sign plane.
        const scallopInset=f.valance==='scalloped'?Math.min(.06,valance*.3):0,signBottom=bottom+scallopInset,signHeight=valance-scallopInset;
        signedAwningValance(quad(frame,t,signBottom+signHeight/2,f.width,signHeight,.08+projection+.004),valancePaint,signBottom,bottom+valance,.08+projection+.004);
      }
    }else if(/^#[a-f0-9]{6}$/i.test(f.colour??'')){
      const reviewedGenericTrim=genericSourceFacadeCandidate&&['cornice','masonry-band','sill'].includes(f.region!);
      const triangles=materialRegion(frame,t,y,f.width,f.height,f.kind==='fascia' ? f.signMount==='glazing' ? .05 : .025 : f.region==='upper-wall' ? .008 : f.region==='ground-floor' ? .014 : f.region==='plinth' ? .018 : reviewedGenericTrim ? .026 : .022);
      if(triangles.length){
        const paint=colour(f.colour,'facadeTrimLight');add(triangles,paint);
        if(f.kind==='fascia'&&f.text?.trim()&&f.physicalSignId?.trim()){
          const h=source.registration.imageToWall,x0=f.bounds[0],x1=f.bounds[2],sourceY=(f.bounds[1]+f.bounds[3])/2,denominator=(x:number)=>h[6]*x+h[7]*sourceY+h[8],project=(x:number)=>(h[0]*x+h[1]*sourceY+h[2])/denominator(x);
          const sourceXForward=project(x1)>project(x0),mapping={left:t-f.width/2,right:t+f.width/2,bottom:y-f.height/2,top:y+f.height/2,sourceXForward};
          const patch=patches[patches.length-1];patch.sign={text:f.text.trim(),background:FACADE_PATCH_COLOURS[paint]??paint,colour:/^#[a-f0-9]{6}$/i.test(f.textColour??'')?f.textColour!:'#f4f1e8',...(f.signFont?.trim()?{font:f.signFont.trim()}:{}),physicalSignId:f.physicalSignId.trim(),aspectRatio:f.width/f.height,uv:signUv(triangles,frame,mapping)};patch.signMapping=mapping;
        }
      }
    }
  }
  // A clipped assembly preserves only the portion lying on this exact wall
  // polygon; another coplanar surface receives its own portion in the next
  // compiler call. This path is preview-only.
  return (clipOpeningsAtFace||groundedFeatureIds.size)?patches.map(patch=>{
    if(!clipOpeningsAtFace&&!groundedFeatureIds.has(patch.featureId))return patch;
    const triangles=clipTrianglesToFace(patch.triangles,frame);return triangles.length?{...patch,triangles,...(patch.sign&&patch.signMapping?{sign:{...patch.sign,uv:signUv(triangles,frame,patch.signMapping)}}:{}),signMapping:undefined,...(partialFeatureIds.has(patch.featureId)?{partialAtFace:true as const}:{})}:null;
  }).filter((patch):patch is FacadeRecipePatch=>patch!==null).map(patch=>{const {signMapping,...published}=patch;return published;}):patches.map(patch=>{const {signMapping,...published}=patch;return published;});
}

/** City-wide close-LOD display prior. Geometry and neighbour clearance choose
 * exterior walls; construction year only adjusts rhythm. It creates no
 * observation identity and is never an extracted facade fact. */
export function contextualFacadePatches(owner:Owner,surface:Surface,surfaceIndex:number,neighbours:Owner[]):FacadeRecipePatch[]{
  if(surface.type!=='wall')return[];const frame=facadeWallFrame(surface,owner,neighbours);if(!frame||frame.width<2.2||frame.top-frame.bottom<5)return[];
  const ground=Number.isFinite(owner.geometry.building.groundNAP)?napToSourceHeight(owner.geometry.building.groundNAP!,owner.geometry.frame.heightDatum):frame.bottom,usableTop=Math.min(frame.top,ground+42),height=usableTop-ground;if(height<5)return[];
  const year=Number(owner.geometry.building.year),floorHeight=Number.isFinite(year)&&year<1940?3.45:3.15,floors=Math.max(1,Math.min(10,Math.floor(height/floorHeight))),bayTarget=Number.isFinite(year)&&year<1940?2.45:3.05,bays=Math.max(1,Math.min(14,Math.round(frame.width/bayTarget))),bayWidth=frame.width/bays;
  const width=Math.min(Number.isFinite(year)&&year<1940?1.18:1.48,bayWidth*.55),windowHeight=Math.min(Number.isFinite(year)&&year<1940?1.85:1.55,floorHeight*.58),patches:FacadeRecipePatch[]=[];
  const identityTone=[...owner.id].reduce((sum,char)=>sum*31+char.charCodeAt(0),0)>>>0;
  const frameColour:FacadeRecipePatch['colour']=Number.isFinite(year)&&year>=1970||identityTone%11===0?'windowFrameDark':'windowFrame';
  const glassColour:FacadeRecipePatch['colour']=identityTone%3===0?'windowGlassBlue':identityTone%3===1?'windowGlassWarm':'windowGlass';
  const primary=primaryExteriorWall(owner,neighbours),doorBay=[...owner.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%bays,hasDoor=surfaceIndex===primary&&frame.bottom<=ground+.7;
  const historicMullion=Number.isFinite(year)&&year<1965;
  for(let floor=0;floor<floors;floor++)for(let bay=0;bay<bays;bay++){if(hasDoor&&floor===0&&bay===doorBay)continue;const t=(bay+.5)*bayWidth,y=ground+.55+(floor+.5)*floorHeight;if(!rectangleFitsFace(frame,t,y,width+.16,windowHeight+.16)||!rectangleClear(frame,t,width+.16,owner,neighbours))continue;const featureId=`${owner.id}:${surfaceIndex}:context-window:${floor}:${bay}`;patches.push({triangles:frameBorder(frame,t,y,width,windowHeight,.1,.05),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'},{triangles:quad(frame,t,y,width,windowHeight,.038),colour:glassColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'},{triangles:quad(frame,t,y+windowHeight*.12,width,.065,.058),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});if(historicMullion)patches.push({triangles:quad(frame,t,y,.055,windowHeight-.14,.058),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});patches.push({triangles:quad(frame,t,y-windowHeight/2-.045,width+.28,.09,.07),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});}
  if(hasDoor){const t=(doorBay+.5)*bayWidth,doorWidth=Math.min(1.15,bayWidth*.48),doorHeight=Math.min(2.45,floorHeight*.76),y=ground+.12+doorHeight/2;if(rectangleFitsFace(frame,t,y,doorWidth+.2,doorHeight+.16)&&rectangleClear(frame,t,doorWidth+.2,owner,neighbours)){const featureId=`${owner.id}:${surfaceIndex}:context-door`,door=(triangles:number[],colour:FacadeRecipePatch['colour'])=>patches.push({triangles,colour,observationId:null,featureId,featureKind:'contextual-door-prior',styleSource:'procedural-prior-not-measured'});door(quad(frame,t,y,doorWidth+.2,doorHeight+.16,.036),frameColour);door(quad(frame,t,y,doorWidth,doorHeight,.05),'doorWood');if(historicMullion){const transomHeight=Math.min(.42,doorHeight*.18),transomY=y+doorHeight/2-transomHeight/2-.1;door(quad(frame,t,transomY,doorWidth-.18,transomHeight,.062),glassColour);door(quad(frame,t,transomY-transomHeight/2-.045,doorWidth,.09,.068),frameColour);}door(quad(frame,t,ground+.1,doorWidth+.28,.1,.075),frameColour);}}
  const trimWidth=frame.width-.32,trimColour:FacadeRecipePatch['colour']=Number.isFinite(year)&&year>=1965?'facadeTrimDark':'facadeTrimLight';
  const addTrim=(name:string,y:number,trimHeight:number)=>{if(trimWidth<1.8||!rectangleFitsFace(frame,frame.width/2,y,trimWidth,trimHeight)||!rectangleClear(frame,frame.width/2,trimWidth,owner,neighbours))return;patches.push({triangles:quad(frame,frame.width/2,y,trimWidth,trimHeight,.072),colour:trimColour,observationId:null,featureId:`${owner.id}:${surfaceIndex}:context-trim:${name}`,featureKind:'contextual-trim-prior',styleSource:'procedural-prior-not-measured'});};
  if(floors>1)addTrim('street-datum',ground+floorHeight,.12);
  if(Number.isFinite(year)&&year<1965)addTrim('facade-top',usableTop-.18,.24);
  return patches;
}

export function facadeRecipePatches(owner: Owner, surface: Surface, surfaceIndex: number, records: any[], neighbours: Owner[], reviewedAwnings = false, candidateRegistrationPreview = false): FacadeRecipePatch[] {
  if (surface.type !== 'wall') return [];
  const frame = facadeWallFrame(surface, owner, neighbours);
  if (!frame || frame.top - frame.bottom < 2.5) return [];
  // The shared partitioner normally gates whole-wall appearance. Here it only
  // partitions placement: individual original fields are checked separately
  // below, so a bad full crop cannot erase independently usable ground evidence.
  const originals = new Map(records.map(record => [record.id, record]));
  const patches: FacadeRecipePatch[] = [];
  const wallYs = owner.geometry.building.surfaces.filter(face => face.type === 'wall').flatMap(face => face.rings[0].map(point => point[1]));
  const groundBase = Number.isFinite(owner.geometry.building.groundNAP) ? napToSourceHeight(owner.geometry.building.groundNAP!,owner.geometry.frame.heightDatum) : Math.min(...wallYs);
  // Resolve upper and ground candidates independently. An unknown ground field
  // cannot outvote a supported shopfront merely because its full crop is usable.
  const fieldIntervals = ['upper', 'ground'].flatMap(field => {
      const tier = field === 'upper' ? 'full' : 'ground';
      const placementViews = records.map(record => {
      const describedTier = record.facadeDescription?.sources?.[tier];
      const bound = boundFacadeSource(record, owner, surfaceIndex, tier);
      const preview = !bound && candidateRegistrationPreview ? previewFacadeSource(record, owner, surfaceIndex, tier) : null;
      // A verified ground crop establishes the frontage interval, but says
      // nothing about the unobserved upper floors.  Keep their contextual
      // rhythm when no full-tier description was supplied.  An explicitly
      // supplied full tier (including an incomplete/withheld one) continues
      // to reserve that interval and therefore never grows a guessed grid.
      const supportedGroundForUpper = field === 'upper' && (
        !!boundFacadeSource(record, owner, surfaceIndex, 'ground')
        || (candidateRegistrationPreview && !!previewFacadeSource(record, owner, surfaceIndex, 'ground'))
      );
      // A supplied description owns its tier even when its binding has gone
      // stale. Falling back to a generic rhythm would turn a rejected image
      // dimension, revocation or withheld result into invented architecture.
      const eligible = !!bound || !!preview || (!describedTier && (field === 'upper' ? upperSupported(record) || supportedGroundForUpper : groundSupported(record)));
      return { ...record, effectiveProposal: eligible ? { wholeUsable: 'unknown' } : null };
    });
    const partition = wallObservationIntervals(surface, surfaceIndex, owner.id, placementViews);
    return partition.intervals.map((interval: any) => ({ field, interval, axis: partition.axis }));
  });
  for (const { field, interval, axis } of fieldIntervals) {
    if (!interval.observation || interval.status === 'conflict') continue;
    const record = originals.get(interval.observation.id), f: Frame | null = intervalFaceFrame(frame, axis, interval);
    if (!record || !f || f.width < 1.5) continue;
    const add = (triangles: number[], colour: FacadeRecipePatch['colour'], featureId: string, featureKind: FacadeRecipePatch['featureKind']) => patches.push({ triangles, colour, observationId: record.id, featureId, featureKind, styleSource: 'procedural-prior-not-measured' });
    const window = (t: number, y: number, width: number, height: number, featureId: string) => {
      if (!rectangleFitsFace(f, t, y, width + .18, height + .18) || !rectangleClear(f, t, width + .18, owner, neighbours)) return;
      add(frameBorder(f,t,y,width,height,.09,.05), 'windowFrame', featureId, 'window-prior');
      add(quad(f, t, y, width, height, .038), 'windowGlass', featureId, 'window-prior');
      add(quad(f, t, y + height * .12, width, .065, .058), 'windowFrame', featureId, 'window-prior');
      add(quad(f, t, y, .055, height - .14, .058), 'windowFrame', featureId, 'window-prior');
    };
    const tier=field==='upper'?'full':'ground';
    const registered=boundFacadeSource(record,owner,surfaceIndex,tier);
    const preview=!registered&&candidateRegistrationPreview?previewFacadeSource(record,owner,surfaceIndex,tier):null;
    const source=registered??preview;
    if(source){
      const genericSourceFacadeCandidate=record.facadeDescription?.extractionVersion==='source-facade-owner-candidate/v1';
      const describedFull=record.facadeDescription?.sources?.full,describedGround=record.facadeDescription?.sources?.ground;
      const olderGroundCrop=genericSourceFacadeCandidate&&Number.isFinite(Date.parse(describedFull?.captureDate))&&Number.isFinite(Date.parse(describedGround?.captureDate))&&Date.parse(describedGround.captureDate)<Date.parse(describedFull.captureDate);
      const partialOlderGroundOpening=(feature:any)=>olderGroundCrop&&feature.kind==='window'&&Array.isArray(feature.bounds)&&feature.bounds[1]<=0;
      const groundRegistered=field==='upper'&&boundFacadeSource(record,owner,surfaceIndex,'ground');
      const groundPreview=field==='upper'&&!groundRegistered&&candidateRegistrationPreview?previewFacadeSource(record,owner,surfaceIndex,'ground'):null;
      const groundSource=groundRegistered??groundPreview;
      // Tier ownership is geometric, not a blanket "full means upper" rule.
      // Keep actual upper features from a full crop; suppress only an unlabeled
      // full feature that projects onto a ground-tier feature. This lets high
      // windows survive while avoiding duplicate lower openings.
      const groundCoverage=groundSource?(groundSource.features??[]).filter(feature=>!partialOlderGroundOpening(feature)&&(!genericSourceFacadeCandidate||feature.kind==='window'||feature.kind==='door')).map(feature=>fitFacadeFeature(feature,groundSource as NonNullable<ReturnType<typeof boundFacadeSource>>,record)).filter(Boolean) as any[]:[];
      const include=(feature:any)=>{
        if(field==='ground'&&partialOlderGroundOpening(feature))return false;
        if(!groundSource)return true;
        if(feature.region==='upper-wall')return true;
        if(record.facadeDescription?.extractionVersion==='source-facade-owner-candidate/v1'&&feature.kind==='material'&&['cornice','masonry-band','sill'].includes(feature.region))return true;
        const fitted=fitFacadeFeature(feature,source as NonNullable<ReturnType<typeof boundFacadeSource>>,record);if(!fitted)return false;
        return !groundCoverage.some(other=>Math.abs(fitted.t-other.t)<(fitted.width+other.width)/2&&Math.abs(fitted.y-other.y)<(fitted.height+other.height)/2);
      };
      const observed=observedAssemblyPatches(owner,frame,f,record,source as NonNullable<ReturnType<typeof boundFacadeSource>>,neighbours,include,candidateRegistrationPreview&&!!preview);
      patches.push(...(preview?observed.map(patch=>({...patch,previewOnly:true as const})):observed));
      // A registered description owns this image tier. Missing or revoked
      // features remain unknown, never replaced with an invented window grid.
      continue;
    }
    // A common 3.5 m display rhythm aligns stacked source surfaces. A high wall
    // component must never acquire another shop at its own elevated "bottom".
    const floorHeight = 3.5;
    const floorCount = Math.max(1, Math.min(12, Math.ceil((f.top - groundBase) / floorHeight)));
    const bays = Math.max(1, Math.min(16, Math.round(f.width / 2.7))), bayWidth = f.width / bays;
    const windowWidth = Math.min(1.25, bayWidth * .53), windowHeight = Math.min(1.9, floorHeight * .56);
    const baseId = `${owner.id}:${surfaceIndex}:${record.id}`;
    if (field === 'upper') {
      for (let floor = 1; floor < floorCount; floor++) for (let bay = 0; bay < bays; bay++) {
        window((bay + .5) * bayWidth, groundBase + (floor + .48) * floorHeight, windowWidth, windowHeight, `${baseId}:window:${floor}:${bay}`);
      }
      continue;
    }
    if (!groundSupported(record) || f.bottom > groundBase + 1.5) continue;
    const groundHeight = Math.min(2.35, floorHeight * .66), groundY = groundBase + .55 + groundHeight / 2;
    if (record.effectiveProposal.shopfront === 'no') {
      // A source-bound public residential frontage establishes an entrance
      // prior, not a measured position. Reserve its bay before adding windows.
      const doorT=bayWidth/2,doorWidth=Math.min(1.1,bayWidth*.48),doorHeight=2.35,doorY=groundBase+.12+doorHeight/2;
      const hasDoor=rectangleFitsFace(f,doorT,doorY,doorWidth+.18,doorHeight+.18)&&rectangleClear(f,doorT,doorWidth+.18,owner,neighbours);
      if(hasDoor){
        const id=`${baseId}:entrance-prior`;
        add(frameBorder(f,doorT,doorY,doorWidth,doorHeight,.09,.065),'windowFrame',id,'contextual-door-prior');
        add(quad(f,doorT,doorY,doorWidth,doorHeight,.038),'doorWood',id,'contextual-door-prior');
        add(quad(f,doorT,doorY+doorHeight/2-.25,doorWidth-.12,.36,.052),'windowGlass',id,'contextual-door-prior');
      }
      for (let bay = hasDoor?1:0; bay < bays; bay++) window((bay + .5) * bayWidth, groundY, windowWidth, Math.min(1.8, groundHeight), `${baseId}:window:0:${bay}`);
      continue;
    }
    const width = Math.min(f.width - .5, 12), t = f.width / 2;
    if (!rectangleFitsFace(f, t, groundY, width + .16, groundHeight + .16) || !rectangleClear(f, t, width + .16, owner, neighbours)) continue;
    const featureId = `${baseId}:shop`;
    add(frameBorder(f,t,groundY,width,groundHeight,.08,.05), 'windowFrame', featureId, 'shopfront-prior');
    add(quad(f, t, groundY, width, groundHeight, .038), 'shopGlass', featureId, 'shopfront-prior');
    // Generic mullions, not a guessed entrance or tenant partition.
    const panes = Math.max(2, Math.ceil(width / 1.7));
    for (let pane = 1; pane < panes; pane++) add(quad(f, t - width / 2 + width * pane / panes, groundY, .065, groundHeight, .058), 'windowFrame', featureId, 'shopfront-prior');
    if (reviewedAwnings && mayRenderReviewedAwning(record)) {
      const awningY = groundY + groundHeight / 2 + .3;
      if (!rectangleFitsFace(f, t, awningY, width, .2)) continue;
      const points = [onFace(f, t - width / 2, awningY, .07), onFace(f, t + width / 2, awningY, .07), onFace(f, t + width / 2, awningY - .24, .8), onFace(f, t - width / 2, awningY - .24, .8)];
      add([0, 1, 2, 0, 2, 3].flatMap(index => points[index]), 'awningFabric', `${baseId}:awning`, 'reviewed-awning-prior');
    }
  }
  return patches;
}

/** A source description owns only its actual frontage interval. Clip display
 * priors geometrically rather than withholding unrelated neighbour frontage. */
function claimedWallIntervals(owner:Owner,surface:Surface,index:number,records:any[]):[number,number][] {
  // `records` is already the selected precedence set. It includes described
  // records (also revoked descriptions, which still reserve their interval)
  // and legacy records that yielded a source-supported patch. Do not require
  // a description here or the latter will lose its claim and receive a second
  // contextual storefront/window layer.
  const claims=records.filter(record=>record.renderBuildingId===owner.id&&record.renderSurfaceIndices?.includes(index));
  if(!claims.length)return[];
  const partition=wallObservationIntervals(surface,index,owner.id,claims.map(record=>({...record,effectiveProposal:{wholeUsable:'unknown'}})));
  return partition.intervals.filter((interval:any)=>interval.observation||interval.status==='conflict')
    .map((interval:any)=>[Math.min(interval.startM,interval.endM),Math.max(interval.startM,interval.endM)] as [number,number])
    .filter(([start,end]:[number,number])=>Number.isFinite(start)&&Number.isFinite(end)&&end>start);
}
function clipPolygonAt(points:number[][],frame:Frame,bound:number,keepGreater:boolean):number[][] {
  const along=(point:number[])=>(point[0]-frame.a[0])*frame.u[0]+(point[2]-frame.a[1])*frame.u[1];
  const output:number[][]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],ta=along(a),tb=along(b),aInside=keepGreater?ta>=bound:ta<=bound,bInside=keepGreater?tb>=bound:tb<=bound;
    if(aInside)output.push(a);
    if(aInside!==bInside){const f=(bound-ta)/(tb-ta);output.push(a.map((value,axis)=>value+(b[axis]-value)*f));}
  }
  return output;
}
function clipPatchesToUnclaimedIntervals(patches:FacadeRecipePatch[],frame:Frame,claimed:[number,number][]):FacadeRecipePatch[]{
  if(!claimed.length)return patches;
  const ordered=claimed.slice().sort((a,b)=>a[0]-b[0]),unclaimed:[number,number][]=[];let cursor=0;
  for(const [start,end] of ordered){if(start>cursor)unclaimed.push([cursor,Math.min(frame.width,start)]);cursor=Math.max(cursor,end);}
  if(cursor<frame.width)unclaimed.push([cursor,frame.width]);
  return patches.flatMap(patch=>{
    const triangles:number[]=[];
    for(let offset=0;offset<patch.triangles.length;offset+=9){const triangle=[0,1,2].map(vertex=>patch.triangles.slice(offset+vertex*3,offset+vertex*3+3));
      for(const [start,end] of unclaimed){const clipped=clipPolygonAt(clipPolygonAt(triangle,frame,start,true),frame,end,false);for(let i=1;i<clipped.length-1;i++)triangles.push(...clipped[0],...clipped[i],...clipped[i+1]);}
    }
    return triangles.length?[{...patch,triangles}]:[];
  });
}

/** Both viewers use this precedence policy. Described frontages abstain only
 * inside their own intervals; independent wall intervals retain contextual
 * detail when requested. */
export function compileFacadePatches(owner:Owner,surface:Surface,index:number,records:any[],neighbours:Owner[],options:{procedural?:boolean;contextual?:boolean;reviewedAwnings?:boolean;observed?:boolean;candidateRegistrationPreview?:boolean}={}):FacadeRecipePatch[]{
  const described=records.filter(r=>r.renderBuildingId===owner.id&&r.renderSurfaceIndices?.includes(index)&&r.facadeDescription);
  const active=options.procedural?records:described;
  const supported=facadeRecipePatches(owner,surface,index,options.observed===false?active.filter(r=>!r.facadeDescription):active,neighbours,options.reviewedAwnings,options.candidateRegistrationPreview===true);
  if(!options.contextual)return supported;
  const frame=facadeWallFrame(surface,owner,neighbours);
  // Legacy source-supported priors have observation IDs too. They claim their
  // interval before contextual display detail is considered, so this newer
  // path cannot paint a second window/storefront assembly over them.
  const supportedIds=new Set(supported.map(patch=>patch.observationId).filter((id):id is string=>typeof id==='string'));
  const claims=records.filter(record=>described.includes(record)||supportedIds.has(record.id));
  if(!claims.length)return supported.length?supported:contextualFacadePatches(owner,surface,index,neighbours);
  const contextual=frame?clipPatchesToUnclaimedIntervals(contextualFacadePatches(owner,surface,index,neighbours),frame,claimedWallIntervals(owner,surface,index,claims)):[];
  return [...supported,...contextual];
}
