import {isCanalhouseComponentId} from './canalhouseComponentIds.ts';
import {canalhouseHoistGeometry,type CanalhouseHoist} from './canalhouseHoist.ts';
import {canalhouseEntranceCheeks,type CanalhouseEntranceCheeks} from './canalhouseEntranceCheeks.ts';
/** Original, texture-free native-scale assemblies. Vocabulary never supplies observations. */
import * as T from 'three';
import {canalhouseGlazedBay,type CanalhouseGlazedBay} from './canalhouseGlazedBay';
import {cutNativeFacadeAperture} from './canalhouseNativeAperture';
import {canalhouseOpeningRecess} from './canalhouseOpeningRecess';
import {compactContour} from './canalhouseContour';
import {canalhouseCrownWingProfiles,type CanalhouseCrownWings} from './canalhouseCrownWings';
import { openTopPrism, upwardRoofPlane } from '../../scripts/landmarks/house-geometry.ts';
import { auditHouse, type CanalHouse, type GableType } from './facade/houseRecord.ts';
import { auditFields, type Measured, type Observation } from './facade/evidence.ts';

export const CANALHOUSE_COMPONENT_VERSIONS = Object.freeze({ shell: '3', roof: '11', frontage: '4', opening: '18', glazedBay: '1', facadeDetail: '10', ornament: '1', dormer: '6', nativeAperture: '1', cornice: '6', crown: '5', entrance: '9', hoist: '1' });
export type CanalhousePoint = [number, number];
export interface CanalhousePolygon { outer: CanalhousePoint[]; holes: CanalhousePoint[][] }
export interface CanalhouseDoorPanel {
  /** Observed [left, bottom, width, height], normalized to the leaf inside its opening trim. */
  rect: [number, number, number, number];
  /** Slim hollow frame; both reliefs are measured outward from the existing leaf face. */
  frameWidthM: number; reliefM: number; fieldReliefM: number;
  frameSurface: 'door' | 'trim';
  /** Omit only source-hidden/absent strokes; unspecified retains the complete ring. */
  frameEdges?: ('left' | 'right' | 'top' | 'bottom')[];
}
export interface CanalhouseOpening {
  id: string; kind: 'window' | 'door'; leftM: number; bottomM: number; widthM: number; heightM: number;
  trimWidthM: number; head?: 'segmental' | 'oval'; headRiseM?: number; verticalBars?: number[]; horizontalBars?: number[];
  /** Outer joinery and sash/grille materials independently reuse semantic palette slots. */
  frameSurface?: 'trim' | 'door' | 'joinery'; barSurface?: 'trim' | 'door' | 'joinery';
  /** Glazed or opaque leaf; trim selects pale painted panels. Omission preserves defaults. */
  paneSurface?: 'glass' | 'door' | 'trim';
 /** Source-selected frosted/leaded glass tone, restricted to glazed panes. */
 paneTint?:string;
  /** Observed horizontal rail widths, in the same order as horizontalBars. */
  horizontalBarWidthsM?: number[];
  /** Observed shallow projection, e.g. openings carried by a facade risalit. */
  projectionM?: number;
  /** Restrained drawing depth for real frame returns around recessed glazing. */
  frameDepthM?: number;
  /** Explicit shallow glazing setback; must remain in front of the native shell. */
  paneOffsetM?: number;
  /** Rectangular portal: translate complete joinery inward. Must exceed
   * frameDepthM+.015 and be <=1.5m; excludes shaped heads and projections. */
  recessM?:number;
  /** Source-observed loggia glazing on lateral cavity faces and ceiling finish. */
  recessReturns?:{glazedSides:('left'|'right')[];soffitSurface?:'wall'|'door'|'trim'};
  /** Source-selected narrow sash bars can differ from the outer jamb width. */
  mullionWidthM?: number;
  /** Explicit observed grille segments in opening-relative coordinates. */
  diagonalBars?: [CanalhousePoint, CanalhousePoint][];
  /** Source-selected door-leaf layout only; absent/empty never invents panels. */
  panels?: CanalhouseDoorPanel[];
}
export interface CanalhouseDormer {
 wallSurface?:'wall'|'trim'|'stone';roofSurface?:'roof'|'trim'|'wall';
  /** Source-observed distance behind the main facade plane. Default preserves legacy placement. */
  setbackM?:number;
  /** Explicit source-visible opening in a native wall covering this dormer. */
  hostAperture?:{depthM:number}; id: string; leftM: number; widthM: number; bottomM: number; heightM: number; depthM: number; roofRiseM: number; frontOverhangM?: number; trimWidthM?: number; verticalBars?: number[]; horizontalBars?: number[] }
export interface CanalhouseFacadeBlock { id: string; leftM: number; bottomM: number; widthM: number; heightM: number; depthM: number; surface?: 'wall' | 'trim' | 'stone' }
export interface CanalhouseBalcony {
 id:string;openingId:string;heightM:number;depthM:number;barWidthM:number;posts:number;
 /** Explicit source-observed guard in front of this opening; checks still require exposed panes. */
 occludesOpening?:true;
 /** Source-observed rail may span a neighboring opaque panel or opening. */
 span?:{leftM:number;widthM:number};
 /** Additional horizontal strokes as fractions of the guard height. */
 horizontalBars?:number[];
 infill?:{template:'cross';panels:number};
 projection?:{widthM:number;slabThicknessM:number;pierWidthM:number;supportHeightM?:number};
}
export interface CanalhouseOrnament { id: string; profile: CanalhousePoint[]; depthM: number; fill?: 'trim' | 'wall'; rimWidthM?: number }
/** One reusable lateral flight, including its independently observed open rail. */
export interface CanalhouseApproach {
  topProfile:CanalhousePoint[]|null; groundM:number; backM:number; depthM:number;
  railProfile:CanalhousePoint[]; posts:{xM:number;bottomM:number;topM:number}[];
  railWidthM:number; postWidthM:number; occludedOpeningIds?:string[];
}
export interface CanalhouseElevation {
  id: string; polygonIndex: number; edgeIndex: number;
  /** Separate observed fronts may share one physical shell and roof owner. */
  bodyEavesM?: Measured<number>;
  palette?: CanalHouseRecipe['palette'];
  /** End vertex for a contiguous straight surveyed frontage split by roof intersections. */
  endEdgeIndex?: number;
  /** Explicit observed facade-plane approximation; exact shell rings remain unchanged. */
  frontageToleranceM?: Measured<number>;
  /** Source-supported principal facade plane spanning shallow native returns.
   * Keeps original footprint/roofs and places details outside the outermost segment. */
  frontagePlan?:Measured<{maxInsetM:number;maxOutsetM?:number}>;
  openings: Measured<CanalhouseOpening[]>;
  glazedBays?:Measured<CanalhouseGlazedBay[]>;
  /** Source-selected shallow window-sill rails; no inferred balcony floors. */
  balconies?: Measured<CanalhouseBalcony[]>;
  cornice?: Measured<{ bottomM: number; heightM: number; depthM: number; brackets: number;
    /** Explicit course spans around observed raised heads or openings. */
    spans?:{leftM:number;widthM:number}[];
    layers?: { bottomM: number; heightM: number; depthM: number; underside?:{riseM:number;insetM:number} }[];
    accents?: (CanalhouseFacadeBlock & { profile?: 'console' | 'triglyph' })[] }>;
  dormers?: Measured<CanalhouseDormer[]>;
  hoists?:Measured<CanalhouseHoist[]>;
  /** Source-observed continuous attic front around grouped dormers. This shallow
   * field does not replace surveyed roof slopes or infer hidden roof depth. */
  dormerFront?: Measured<{profile:CanalhousePoint[];depthM:number;surface:'wall'|'roof';trimWidthM:number}>;
  bands?: Measured<CanalhouseFacadeBlock[]>;
  blocks?: Measured<CanalhouseFacadeBlock[]>;
  ornaments?: Measured<CanalhouseOrnament[]>;
  /** Measured top outline, left-to-right in facade metres and height above ground. */
  crown?: Measured<{ profile: CanalhousePoint[]; depthM: number; trimWidthM: number; surface?: 'wall' | 'trim' | 'stone';
    /** A localized facing follows the shared head profile above this height. */
    capFacing?:{bottomM:number;depthM:number;surface:'wall'|'trim'|'stone'};wings?:CanalhouseCrownWings }>;
  entrance?: Measured<{ leftM: number; widthM: number; riseM: number; runM: number; steps?: number;
    /** Coarse visualization spacing, explicitly not an observed tread count. */
    approximateRiserM?:number; attachToLanding?:boolean; surface?:'trim'|'stone';
    cheeks?:CanalhouseEntranceCheeks;
    rails?:{heightM:number;widthM:number;sides:('left'|'right')[]} }>;
  /** Source-supported projecting landing; an unresolved stair flight stays absent. */
  landing?: Measured<{leftM:number; widthM:number; topM:number; depthM:number; thicknessM:number;
    /** Explicit source-supported masonry body; may not close a lower aperture. */
    supportToGround?:boolean;
    /** Coarse source-obscured short transition; no hidden tread count asserted. */
    thresholdConnector?:{riseM:number;depthM:number}}>;
  /** Source-authored lateral contour in native facade x/height metres. Vertical
   * edges are allowed; contour vertices do not imply an exact tread count.
   * Null preserves an unresolved flight while admitting observed rails. */
  approach?: Measured<CanalhouseApproach>;
  /** Single or opposing flights reuse the same component and landing. Every
   * flight retains its own evidence and source-visible aperture occlusions.
   * Use this collection OR the legacy single approach, never both. */
  approaches?: {id:string; assembly:Measured<CanalhouseApproach>}[];
}
export interface CanalHouseRecipe {
  schemaVersion: 1; id: string; house: CanalHouse; observations: Observation[];
  /** Surveyed lowest shell top for multi-part roofs; does not redefine the main body's eaves. */
  shellTopM?: Measured<number>;
  /** Local east/south metres; Y is vertical in the compiled Three group. */
  footprint: Measured<CanalhousePolygon[]>;
  palette: Measured<{ wall: string; roof: string; trim: string; glass: string; door: string; stone?: string; joinery?: string }>;
  /** Explicit surveyed roof partition. Planes are heightM + x*slopeX + z*slopeZ. */
  roof: Measured<{ polygon: CanalhousePolygon; plane: { heightM: number; slopeX: number; slopeZ: number }; generatedFragment?:'symmetric-roof'|'roof-envelope' }[]>;
  elevations: CanalhouseElevation[]; simplifications: string[];
}
export interface CompiledCanalHouseRecipe {
  group: T.Group; componentVersions: typeof CANALHOUSE_COMPONENT_VERSIONS; inputKey: string;
  stats: { triangles: number; meshes: number; bounds: { min: number[]; max: number[] } };
}
const EPS = 1e-5;
/** Minimum projected polygon area admitted by the geometry compiler. Survey
 * converters must report fragments beneath this threshold, never silently fit
 * their unstable plane or change the source footprint to make them compile. */
export const CANALHOUSE_MIN_POLYGON_AREA_M2=EPS;
/** Float32 mesh coordinates may differ from double-precision surveyed topology by at most 1 cm. */
const SHAPE_EPS = .01;
const finite = (...v: number[]) => { if (!v.every(Number.isFinite)) throw new Error('Non-finite assembly dimension'); };
const positive = (...v: number[]) => { finite(...v); if (v.some(n => n <= 0)) throw new Error('Assembly dimension must be positive'); };
const area = (ring: CanalhousePoint[]) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0]*q[1]-q[0]*p[1]; }, 0) / 2;
const cross = (a:CanalhousePoint,b:CanalhousePoint,c:CanalhousePoint) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
/** Clip a masonry head corner to one rectangular surviving detail cell. */
function clipDetailPolygon(points:CanalhousePoint[],rect:{x:number;y:number;w:number;h:number}):CanalhousePoint[]{
 let result=points;
 for(const [axis,limit,sign]of [[0,rect.x,1],[0,rect.x+rect.w,-1],[1,rect.y,1],[1,rect.y+rect.h,-1]] as const){
  const input=result;result=[];
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],insideA=(a[axis]-limit)*sign>=0,insideB=(b[axis]-limit)*sign>=0;
   if(insideA)result.push(a);
   if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
 }
 return result.filter((p,i)=>Math.hypot(p[0]-result[(i+1)%result.length][0],p[1]-result[(i+1)%result.length][1])>EPS);
}
const onSegment = (p:CanalhousePoint,a:CanalhousePoint,b:CanalhousePoint,tolerance=EPS) => Math.abs(cross(a,b,p))<tolerance*Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1])) && p[0]>=Math.min(a[0],b[0])-tolerance && p[0]<=Math.max(a[0],b[0])+tolerance && p[1]>=Math.min(a[1],b[1])-tolerance && p[1]<=Math.max(a[1],b[1])+tolerance;
function inRing(p:CanalhousePoint,ring:CanalhousePoint[],strict=false,tolerance=EPS):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];if(onSegment(p,a,b,tolerance))return !strict;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
function shape(polygon: CanalhousePolygon,minimumArea=CANALHOUSE_MIN_POLYGON_AREA_M2): T.Shape {
  const make = (ring: CanalhousePoint[]) => {
    if (ring.length < 3 || Math.abs(area(ring)) < minimumArea) throw new Error('Degenerate footprint ring');
    ring.forEach(p => finite(...p));
    const path = new T.Shape(ring.map(([x,z]) => new T.Vector2(x,z))); path.closePath(); return path;
  };
  const result = make(polygon.outer); result.holes = polygon.holes.map(make); return result;
}
/** Stable canonical JSON, kept as a collision-free input key rather than a short lossy hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Optional vocabulary helper: all dimensions/counts must be supplied by an observation. */
export interface CanalhouseCrownOptions {
  /** Independent cap width, bounded by neck width for a single-valued outline. */
  crestWidthM?: number;
  cap?: 'flat' | 'rounded' | 'pediment';
  capRiseM?: number;
  /** Clock shoulder power: 1 straight, >1 concave, <1 convex. Omit for legacy sine. */
  shoulderCurve?: number;
}
export function canalhouseCrownProfile(type: GableType, widthM: number, eavesM: number, topM: number,
  neckWidthM: number, shoulderM: number, steps: number, options: CanalhouseCrownOptions = {}): CanalhousePoint[] {
  positive(widthM, eavesM); finite(topM, neckWidthM, shoulderM, steps);
  if (topM < eavesM || neckWidthM < 0 || neckWidthM > widthM || shoulderM < eavesM || shoulderM > topM) throw new Error('Invalid crown profile dimensions');
  const crest=options.crestWidthM??neckWidthM, cap=options.cap??'flat', rise=options.capRiseM??0;
  finite(crest,rise,options.shoulderCurve??1);
  if(crest<0||crest>neckWidthM||rise<0||rise>topM-shoulderM+EPS||
    !['flat','rounded','pediment'].includes(cap)||(cap==='flat'&&rise!==0)||
    (cap!=='flat'&&(crest===0||rise===0))||
    (options.shoulderCurve!==undefined&&(options.shoulderCurve<.25||options.shoulderCurve>8)))throw new Error('Invalid crown cap or shoulder dimensions');
  if(Object.keys(options).length&&!['klok','hals','lijst'].includes(type))throw new Error('Cap controls require a clock, neck or list crown');
  const mid = widthM/2, left = (widthM-neckWidthM)/2, right = widthM-left;
  if (type === 'lijst' && !Object.keys(options).length) return [[0,eavesM],[widthM,eavesM]];
  if (type === 'punt') return [[0,eavesM],[mid,topM],[widthM,eavesM]];
  if (type === 'trap') {
    if (!Number.isInteger(steps) || steps < 1 || steps > 20) throw new Error('Invalid observed step count');
    const out: CanalhousePoint[] = [[0,eavesM]];
    for (let i=1;i<=steps;i++) { const x=left*i/steps, y=eavesM+(topM-eavesM)*i/steps; out.push([x,out.at(-1)![1]],[x,y]); }
    out.push([right,topM]);
    for(let i=steps;i>=1;i--) { const x=widthM-left*(i-1)/steps,y=eavesM+(topM-eavesM)*(i-1)/steps; out.push([x,out.at(-1)![1]],[x,y]); } return out;
  }
  const capBase=topM-rise,capLeft=mid-crest/2,capRight=mid+crest/2;
  const capPoints:CanalhousePoint[]=[[left,capBase],[capLeft,capBase]];
  if(cap==='rounded')for(let i=1;i<=12;i++){const angle=Math.PI*(1-i/12);capPoints.push([mid+crest/2*Math.cos(angle),capBase+rise*Math.sin(angle)]);}
  else if(cap==='pediment')capPoints.push([mid,topM],[capRight,capBase]);
  else capPoints.push([capRight,topM]);
  capPoints.push([right,capBase]);
  const compact=(points:CanalhousePoint[])=>points.filter((p,i)=>i===0||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>EPS);
  if (type === 'lijst') return compact([[0,eavesM],[left,eavesM],...capPoints,[right,eavesM],[widthM,eavesM]]);
  if (type === 'klok') {
    const out: CanalhousePoint[] = [];
    // Smooth reusable silhouette; width, shoulder and crest remain measured inputs.
    const shoulder=(f:number)=>options.shoulderCurve===undefined?Math.sin(f*Math.PI/2):f**options.shoulderCurve;
    for(let i=0;i<=8;i++){ const f=i/8; out.push([left*f,eavesM+(shoulderM-eavesM)*shoulder(f)]); }
    // Preserve the exact legacy profile when no controls are selected.
    out.push(...(Object.keys(options).length?capPoints:[[left,topM],[right,topM]] as CanalhousePoint[]));
    for(let i=8;i>=0;i--){ const f=i/8; out.push([widthM-left*f,eavesM+(shoulderM-eavesM)*shoulder(f)]); } return Object.keys(options).length?compact(out):out;
  }
  if(type==='hals'&&options.shoulderCurve!==undefined){
    const out:CanalhousePoint[]=[];
    for(let i=0;i<=8;i++){const f=i/8;out.push([left*f,eavesM+(shoulderM-eavesM)*f**options.shoulderCurve]);}
    out.push(...capPoints);
    for(let i=8;i>=0;i--){const f=i/8;out.push([widthM-left*f,eavesM+(shoulderM-eavesM)*f**options.shoulderCurve]);}
    return compact(out);
  }
  if(Object.keys(options).length)return compact([[0,eavesM],[left,shoulderM],...capPoints,[right,shoulderM],[widthM,eavesM]]);
  return [[0,eavesM],[left,shoulderM],[left,topM],[right,topM],[right,shoulderM],[widthM,eavesM]];
}

export function compileCanalHouseRecipe(recipe: CanalHouseRecipe): CompiledCanalHouseRecipe {
  if(recipe.schemaVersion !== 1 || !recipe.id.trim() || !/^\d{16}$/.test(recipe.house.pandId)) throw new Error('Invalid canalhouse recipe identity');
  const observations = new Map(recipe.observations.map(o => [o.id,o]));
  if(observations.size !== recipe.observations.length) throw new Error('Duplicate observations');
  const violations = auditHouse(recipe.house,observations);
  if(violations.length) throw new Error(`House evidence violation: ${violations[0].field}: ${violations[0].code}`);
  const read = <V>(field: Measured<V>, name: string): V => {
    if(field.source === 'default') throw new Error(`${name} is unobserved`);
    const category=name.split('/').at(-1)!;
    const sources=category==='footprint'?['bag','3dbag','reviewed']:['roof','shellTopM'].includes(category)?['3dbag','ahn','reviewed']:
      // Survey-derived frontage datums (body eaves, plane tolerance) may come from 3DBAG/AHN.
      ['bodyEavesM','frontageToleranceM','frontagePlan'].includes(category)?['3dbag','ahn','streetlevel-measured','reviewed']:['streetlevel-measured','reviewed'];
    // CanalHouse semantic fields retain their own authoritative competence audit.
    if(!['eavesHeightM','gable'].includes(category)&&!sources.includes(field.source))throw new Error(`${name} evidence violation: incompetent-source`);
    const issues = auditFields(recipe.house.pandId,{[name]:field},observations);
    if(issues.length) throw new Error(`${name} evidence violation: ${issues[0].code}`);
    return field.value;
  };
  const polygons=read(recipe.footprint,'footprint'), palette=read(recipe.palette,'palette');
  const eaves=read(recipe.house.eavesHeightM,'eavesHeightM'); positive(eaves);
  const shellTop=recipe.shellTopM?read(recipe.shellTopM,'shellTopM'):eaves;finite(shellTop);
  // Survey heights are signed relative to street grade. A low rear surface can
  // straddle that datum; retain it rather than raising or discarding its roof.
  // Positive shells keep their established base; low shells get a 1mm backing.
  const shellBase=Math.min(0,shellTop-.001);
  if(shellTop>eaves+EPS)throw new Error('Shell top exceeds measured main-body eaves');
  if(!polygons.length) throw new Error('Missing surveyed footprint');
  if(Object.values(palette).some(c=>!/^#[\da-f]{6}$/i.test(c))) throw new Error('Invalid flat palette');
  const group=new T.Group(); group.name=recipe.id;
  const materials=Object.fromEntries(Object.entries({...palette,stone:palette.stone??palette.trim,joinery:palette.joinery??palette.trim}).map(([k,c])=>[k,new T.MeshStandardMaterial({color:c,roughness:1})])) as Record<keyof typeof palette,T.MeshStandardMaterial>;
  const facadeMaterials=new WeakMap<T.Group,typeof materials>();
  const add = (geometry:T.BufferGeometry,surface:keyof typeof palette,name:string,parent:T.Group=group) => {
    const mesh=new T.Mesh(geometry,(facadeMaterials.get(parent)??materials)[surface]); mesh.name=name; mesh.userData={component:name.split('/')[0],surface,pandId:recipe.house.pandId}; parent.add(mesh); return mesh;
  };
  for(const [i,p] of polygons.entries()) add(openTopPrism(shape(p),shellBase,shellTop),'wall',`shell/${i}`);
  const roofs=read(recipe.roof,'roof'); if(!roofs.length) throw new Error('Missing explicit roof planes');
  const netArea=(p:CanalhousePolygon)=>Math.abs(area(p.outer))-p.holes.reduce((sum,h)=>sum+Math.abs(area(h)),0);
  const roofArea=roofs.reduce((sum,r)=>sum+netArea(r.polygon),0),footprintArea=polygons.reduce((sum,p)=>sum+netArea(p),0);
  if(Math.abs(roofArea-footprintArea)>Math.max(.001,footprintArea*1e-6))throw new Error('Roof partition must preserve surveyed footprint and courtyard area');
  const boundaries=polygons.flatMap(p=>[p.outer,...p.holes].flatMap((ring,ringIndex)=>ring.map((a,i)=>({a,b:ring[(i+1)%ring.length],sign:(area(ring)>0?1:-1)*(ringIndex===0?1:-1)}))));
  const contains=(p:CanalhousePoint,tolerance=EPS)=>polygons.some(poly=>inRing(p,poly.outer,false,tolerance)&&!poly.holes.some(h=>inRing(p,h,true,tolerance)));
  for(const [i,r] of roofs.entries()){
    finite(r.plane.heightM,r.plane.slopeX,r.plane.slopeZ);
    for(const ring of [r.polygon.outer,...r.polygon.holes])for(const point of ring)if(!contains(point))throw new Error('Roof partition lies outside surveyed footprint');
    // Analytic envelope clipping can leave tiny nonzero pieces. Their planes
    // are already known: retain coverage instead of fitting or deleting them.
    if(r.generatedFragment!==undefined&&(!['symmetric-roof','roof-envelope'].includes(r.generatedFragment)||netArea(r.polygon)>=CANALHOUSE_MIN_POLYGON_AREA_M2||r.polygon.holes.length))throw Error('Invalid generated roof fragment');
    const g=upwardRoofPlane(shape(r.polygon,r.generatedFragment?1e-10:CANALHOUSE_MIN_POLYGON_AREA_M2)); const p=g.getAttribute('position');
    for(let j=0;j<p.count;j++)if(!contains([p.getX(j),p.getZ(j)],SHAPE_EPS))throw new Error('Roof partition lies outside surveyed footprint');
    const index=g.index!;
    for(let j=0;j<index.count;j+=3){
      const tri=[0,1,2].map(k=>{const v=index.getX(j+k);return [p.getX(v),p.getZ(v)] as CanalhousePoint;});
      const center:CanalhousePoint=[tri.reduce((sum,v)=>sum+v[0],0)/3,tri.reduce((sum,v)=>sum+v[1],0)/3];
      if(!contains(center,SHAPE_EPS))throw new Error('Roof triangle escapes surveyed footprint or courtyard');
      for(let k=0;k<3;k++)for(const edge of boundaries){
        const a=tri[k],b=tri[(k+1)%3];
        const toleranceAB=SHAPE_EPS*Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1])),toleranceEdge=SHAPE_EPS*Math.max(1,Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]));
        const ca=cross(a,b,edge.a),cb=cross(a,b,edge.b),cc=cross(edge.a,edge.b,a),cd=cross(edge.a,edge.b,b);
        if(((ca>toleranceAB&&cb<-toleranceAB)||(ca<-toleranceAB&&cb>toleranceAB))&&((cc>toleranceEdge&&cd<-toleranceEdge)||(cc<-toleranceEdge&&cd>toleranceEdge)))throw new Error('Roof triangle crosses surveyed boundary');
      }
      for(const poly of polygons)for(const hole of poly.holes)for(const v of hole){
        const signs=tri.map((a,k)=>cross(a,tri[(k+1)%3],v));
        if(signs.every(n=>n>EPS)||signs.every(n=>n<-EPS))throw new Error('Roof triangle fills surveyed courtyard');
      }
    }
    for(let j=0;j<p.count;j++){const y=r.plane.heightM+p.getX(j)*r.plane.slopeX+p.getZ(j)*r.plane.slopeZ; if(y<shellTop-EPS)throw new Error('Roof falls below surveyed shell top');p.setY(j,y);}
    g.computeVertexNormals(); add(g,'roof',`roof/${i}`);
    // Close only surveyed exterior/courtyard boundary edges, never partition seams.
    for(const ring of [r.polygon.outer,...r.polygon.holes])for(let j=0;j<ring.length;j++){
      let a=ring[j],b=ring[(j+1)%ring.length];
      const boundary=boundaries.find(edge=>onSegment(a,edge.a,edge.b)&&onSegment(b,edge.a,edge.b));
      if(!boundary)continue;
      const alignment=(b[0]-a[0])*(boundary.b[0]-boundary.a[0])+(b[1]-a[1])*(boundary.b[1]-boundary.a[1]);
      if(alignment*boundary.sign<0)[a,b]=[b,a];
      const height=(v:CanalhousePoint)=>r.plane.heightM+v[0]*r.plane.slopeX+v[1]*r.plane.slopeZ;
      const ha=height(a),hb=height(b);if(Math.max(ha,hb)<=shellTop+EPS)continue;
      const values:number[]=[];
      if(ha>shellTop+EPS)values.push(a[0],shellTop,a[1],a[0],ha,a[1],b[0],hb,b[1]);
      if(hb>shellTop+EPS)values.push(a[0],shellTop,a[1],b[0],hb,b[1],b[0],shellTop,b[1]);
      const closure=new T.BufferGeometry();closure.setAttribute('position',new T.Float32BufferAttribute(values,3));closure.computeVertexNormals();add(closure,'wall',`shell/roof-closure-${i}-${j}`);
    }
  }
  // Adjacent surveyed roof partitions can be different-height volumes. Close their
  // exposed step only, never extrude an internal wall down to the common shell.
  const roofEdges=roofs.flatMap((roof,roofIndex)=>[roof.polygon.outer,...roof.polygon.holes].flatMap((ring,ringIndex)=>ring.map((a,i)=>({a,b:ring[(i+1)%ring.length],roofIndex,plane:roof.plane,sign:(area(ring)>0?1:-1)*(ringIndex===0?1:-1)}))));
  const planeHeight=(plane:typeof roofs[number]['plane'],p:CanalhousePoint)=>plane.heightM+p[0]*plane.slopeX+p[1]*plane.slopeZ;
  for(let i=0;i<roofEdges.length;i++)for(let j=i+1;j<roofEdges.length;j++){
    const a=roofEdges[i],b=roofEdges[j];if(a.roofIndex===b.roofIndex)continue;
    const dx=a.b[0]-a.a[0],dz=a.b[1]-a.a[1],length=Math.hypot(dx,dz);if(length<EPS)continue;
    // Source topology has tight metric tolerance; no padded footprint ownership.
    if(Math.abs(cross(a.a,a.b,b.a))/length>EPS||Math.abs(cross(a.a,a.b,b.b))/length>EPS)continue;
    const project=(p:CanalhousePoint)=>((p[0]-a.a[0])*dx+(p[1]-a.a[1])*dz)/length;
    const lo=Math.max(0,Math.min(project(b.a),project(b.b))),hi=Math.min(length,Math.max(project(b.a),project(b.b)));
    if(hi-lo<EPS)continue;
    const alignment=(b.b[0]-b.a[0])*dx+(b.b[1]-b.a[1])*dz;
    // Coincident edges on the same side are overlapping coverage, not a step.
    if(a.sign===b.sign*(alignment>=0?1:-1))continue;
    const point=(t:number):CanalhousePoint=>[a.a[0]+dx*t/length,a.a[1]+dz*t/length];
    const midpoint=point((lo+hi)/2);
    if(boundaries.some(edge=>onSegment(midpoint,edge.a,edge.b)))continue;
    const delta=(t:number)=>planeHeight(a.plane,point(t))-planeHeight(b.plane,point(t));
    const d0=delta(lo),d1=delta(hi);if(Math.max(Math.abs(d0),Math.abs(d1))<EPS)continue;
    const cuts=d0*d1<0?[lo,lo+(hi-lo)*d0/(d0-d1),hi]:[lo,hi];
    for(let k=1;k<cuts.length;k++){
      let p=point(cuts[k-1]),q=point(cuts[k]);
      const aHigh=delta((cuts[k-1]+cuts[k])/2)>0;
      const high=aHigh?a.plane:b.plane,low=aHigh?b.plane:a.plane;
      // Outward normal faces the adjacent lower roof, with source ring winding.
      if((aHigh?a.sign:b.sign*(alignment>=0?1:-1))<0)[p,q]=[q,p];
      const hp=planeHeight(high,p),hq=planeHeight(high,q),lp=planeHeight(low,p),lq=planeHeight(low,q),values:number[]=[];
      if(hp-lp>EPS)values.push(p[0],lp,p[1],p[0],hp,p[1],q[0],hq,q[1]);
      if(hq-lq>EPS)values.push(p[0],lp,p[1],q[0],hq,q[1],q[0],lq,q[1]);
      if(!values.length)continue;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,'wall',`roof/step-wall-${i}-${j}-${k}`);
    }
  }
  const elevationIds=new Set<string>(), openingIds=new Set<string>();
  const recessed:{facade:T.Group;opening:CanalhouseOpening;depthM:number}[]=[];
  for(const elevation of recipe.elevations){
    const eaves=elevation.bodyEavesM?read(elevation.bodyEavesM,`${elevation.id}/bodyEavesM`):recipe.house.eavesHeightM.value;
    positive(eaves);if(shellTop>eaves+EPS)throw new Error('Shell top exceeds observed frontage body');
    if(elevationIds.has(elevation.id))throw new Error('Duplicate elevation');elevationIds.add(elevation.id);
    const polygon=polygons[elevation.polygonIndex], ring=polygon?.outer;
    if(!ring || !Number.isInteger(elevation.edgeIndex)||elevation.edgeIndex<0||elevation.edgeIndex>=ring.length)throw new Error('Elevation edge absent from surveyed footprint');
    const end=elevation.endEdgeIndex??(elevation.edgeIndex+1)%ring.length;
    if(!Number.isInteger(end)||end<0||end>=ring.length||end===elevation.edgeIndex)throw new Error('Invalid frontage end vertex');
    const a=ring[elevation.edgeIndex], b=ring[end], dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);positive(length);
    const ux=dx/length,uz=dz/length,sign=area(ring)>0?1:-1,nx=sign*uz,nz=-sign*ux;
    const plan=elevation.frontagePlan?read(elevation.frontagePlan,`${elevation.id}/frontagePlan`):null;
    if(plan&&(!Number.isFinite(plan.maxInsetM)||plan.maxInsetM<=0||plan.maxInsetM>1||elevation.endEdgeIndex===undefined))throw Error('Unsupported principal facade inset');
    if(plan?.maxOutsetM!==undefined&&(!Number.isFinite(plan.maxOutsetM)||plan.maxOutsetM<0||plan.maxOutsetM>.5))throw Error('Unsupported principal facade outset');
    if(elevation.endEdgeIndex!==undefined){
      const tolerance=elevation.frontageToleranceM?read(elevation.frontageToleranceM,`${elevation.id}/frontageToleranceM`):.03;
      if(!Number.isFinite(tolerance)||tolerance<0||tolerance>.3)throw new Error('Unsupported facade-plane approximation');
      for(let i=(elevation.edgeIndex+1)%ring.length;i!==end;i=(i+1)%ring.length){
        const p=ring[i],distance=Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)/length;
        const outwardDistance=(p[0]-a[0])*nx+(p[1]-a[1])*nz;
        if(distance>tolerance&&(!plan||outwardDistance>Math.max(tolerance,plan.maxOutsetM??0)+EPS||-outwardDistance>plan.maxInsetM+EPS))throw new Error('Grouped frontage is not a straight surveyed wall');
      }
    }
    // Details on a grouped frontage must sit outside every surveyed segment,
    // rather than disappear inside a small source risalit or entrance return.
    let outward=0;
    for(let i=elevation.edgeIndex;i!==end;i=(i+1)%ring.length)outward=Math.max(outward,(ring[i][0]-a[0])*nx+(ring[i][1]-a[1])*nz);
    const facade=new T.Group();facade.name=`elevation/${elevation.id}`;
    if(elevation.palette){
      const colors=read(elevation.palette,`${elevation.id}/palette`);
      if(Object.values(colors).some(c=>!/^#[\da-f]{6}$/i.test(c)))throw new Error('Invalid frontage palette');
      facadeMaterials.set(facade,Object.fromEntries(Object.entries({...colors,stone:colors.stone??colors.trim,joinery:colors.joinery??colors.trim}).map(([k,c])=>[k,new T.MeshStandardMaterial({color:c,roughness:1})])) as typeof materials);
    }
    facade.matrix.set(ux,0,nx,a[0]+nx*outward, 0,1,0,0, uz,0,nz,a[1]+nz*outward, 0,0,0,1);facade.matrixAutoUpdate=false;group.add(facade);
    const box=(x:number,y:number,w:number,h:number,d:number,depth:number,s:keyof typeof palette,name:string)=>{
      positive(w,h,d);finite(x,y,depth);const g=new T.BoxGeometry(w,h,d);g.translate(x+w/2,y+h/2,depth);add(g,s,name,facade);
    };
    if(elevation.hoists){
      const seen=new Set<string>();
      for(const beam of read(elevation.hoists,`${elevation.id}/hoists`)){
        if(seen.has(beam.id))throw Error('Duplicate observed hoist beam');
        seen.add(beam.id);add(canalhouseHoistGeometry(beam,length),beam.surface,`hoist/${beam.id}`,facade);
      }
    }
    const crown=elevation.crown?read(elevation.crown,`${elevation.id}/crown`):null;
    if(crown){
      read(recipe.house.gable,'gable');positive(crown.depthM);finite(crown.trimWidthM);
      if(crown.surface!==undefined&&!['wall','trim','stone'].includes(crown.surface))throw new Error('Unsupported crown surface');
      const p=crown.profile;
      if(p.length<2||Math.abs(p[0][0])>EPS||Math.abs(p.at(-1)![0]-length)>EPS||p.some(([x,y],i)=>!Number.isFinite(x)||!Number.isFinite(y)||y<eaves-EPS||x<0||x>length+EPS||(i>0&&x<p[i-1][0])))throw new Error('Crown profile must span its facade above eaves');
    }
    const roofSegments=roofs.flatMap(r=>[r.polygon.outer,...r.polygon.holes].flatMap(points=>points.map((p,i)=>({a:p,b:points[(i+1)%points.length],plane:r.plane}))))
      .filter(edge=>onSegment(edge.a,a,b)&&onSegment(edge.b,a,b));
    const offset=(p:CanalhousePoint)=>(p[0]-a[0])*ux+(p[1]-a[1])*uz;
    const supportedHeight=(x:number)=>{
      const point:CanalhousePoint=[a[0]+ux*x,a[1]+uz*x];let height=shellTop;
      for(const edge of roofSegments)if(onSegment(point,edge.a,edge.b))height=Math.max(height,edge.plane.heightM+point[0]*edge.plane.slopeX+point[1]*edge.plane.slopeZ);
      if(crown)for(let i=1;i<crown.profile.length;i++){
        const [left,low]=crown.profile[i-1],[right,high]=crown.profile[i];
        if(right>left&&x>=left-EPS&&x<=right+EPS)height=Math.max(height,low+(high-low)*(x-left)/(right-left));
      }return height;
    };
    const withinWall=(left:number,width:number,top:number)=>{
      const samples=[left,left+width,...roofSegments.flatMap(edge=>[offset(edge.a),offset(edge.b)]),...(crown?.profile.map(p=>p[0])??[])].filter(x=>x>=left&&x<=left+width);
      return samples.every(x=>top<=supportedHeight(x)+EPS);
    };
    const openings=read(elevation.openings,`${elevation.id}/openings`);
    for(const o of openings){
      positive(o.widthM,o.heightM,o.trimWidthM);finite(o.leftM,o.bottomM);
      const projection=o.projectionM??0;finite(projection);if(projection<0||projection>.3)throw new Error('Unsupported opening projection');
      if(openingIds.has(o.id)||!o.id.trim())throw new Error('Duplicate opening');openingIds.add(o.id);
      if(o.kind!=='window'&&o.kind!=='door')throw new Error('Unsupported opening');
      if(o.leftM<0||o.bottomM<0||o.leftM+o.widthM>length+EPS||!withinWall(o.leftM,o.widthM,o.bottomM+o.heightM)||o.trimWidthM*2>=Math.min(o.widthM,o.heightM))throw new Error('Opening escapes its wall');
      const recess=canalhouseOpeningRecess(o),firstOpeningChild=facade.children.length;
      if(recess){
        // The tunnel must not punch through a rear wall, return or courtyard.
        // Work in the facade plane, honoring bounded existing frontage returns.
        const inverse=facade.matrix.clone().invert(),start=outward+(plan?.maxInsetM??0)+EPS,back=recess.cutDepthM;
        if(back<=start)throw Error('Opening recess does not reach its native host');
        for(const x of [o.leftM,o.leftM+o.widthM/2,o.leftM+o.widthM])for(const depth of [start,back]){
          const p=new T.Vector3(x,0,-depth).applyMatrix4(facade.matrix);
          if(!contains([p.x,p.z]))throw Error('Opening recess escapes native footprint or courtyard');
        }
        for(const edge of boundaries){
          const p=new T.Vector3(edge.a[0],0,edge.a[1]).applyMatrix4(inverse),q=new T.Vector3(edge.b[0],0,edge.b[1]).applyMatrix4(inverse);
          // Clip boundary segments against the strict cavity interior. This
          // also catches small courtyards missed by corner-only containment.
          let lo=0,hi=1;
          for(const [v,d,min,max] of [[p.x,q.x-p.x,o.leftM+EPS,o.leftM+o.widthM-EPS],[p.z,q.z-p.z,-back+EPS,-start-EPS]]){
            if(Math.abs(d)<EPS){if(v<min||v>max){hi=-1;break;}}
            else{const a=(min-v)/d,b=(max-v)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
          }
          if(hi-lo>EPS)throw Error('Opening recess crosses native footprint or courtyard boundary');
        }
      }
      const t=o.trimWidthM,name=`opening/${o.id}`;
      for(const surface of [o.frameSurface,o.barSurface])if(surface!==undefined&&surface!=='trim'&&surface!=='door'&&surface!=='joinery')throw new Error('Unsupported opening joinery surface');
      const frameSurface=o.frameSurface??'trim',barSurface=o.barSurface??'trim';
      const paneSurface=o.paneSurface??(o.kind==='door'?'door':'glass');
      if(o.paneTint!==undefined&&(paneSurface!=='glass'||!/^#[\da-f]{6}$/i.test(o.paneTint)))throw Error('Pane tint requires a valid glazed color');
      if(paneSurface!=='glass'&&paneSurface!=='door'&&paneSurface!=='trim')throw new Error('Unsupported opening pane surface');
      if(o.horizontalBarWidthsM!==undefined){
        if(!Array.isArray(o.horizontalBarWidthsM)||o.horizontalBarWidthsM.length!==(o.horizontalBars??[]).length)throw new Error('Horizontal bar widths must match horizontal bars');
        for(const width of o.horizontalBarWidthsM)if(!Number.isFinite(width)||width<.008||width>Math.min(.15,o.heightM/4))throw new Error('Unsupported horizontal bar width');
      }
      const frameDepth=o.frameDepthM??.12;finite(frameDepth);if(frameDepth<.08||frameDepth>.25)throw new Error('Unsupported opening frame depth');
      const paneOffset=o.paneOffsetM??.065;finite(paneOffset);if(paneOffset<.025||paneOffset>.065)throw new Error('Unsupported glazing setback');
      const barDepth=Math.min(.095,.015+frameDepth-.025);
      const openingShape=(x:number,y:number,w:number,h:number,rise=0,oval=false)=>{
        if(oval){
          const s=new T.Shape();
          for(let i=0;i<=32;i++){const angle=2*Math.PI*i/32,px=x+w*(1+Math.cos(angle))/2,py=y+h*(1+Math.sin(angle))/2;if(i===0)s.moveTo(px,py);else s.lineTo(px,py);}
          s.closePath();return s;
        }
        const s=new T.Shape();s.moveTo(x,y);s.lineTo(x+w,y);
        if(rise){const radius=w*w/(8*rise)+rise/2,center=h-radius;s.lineTo(x+w,y+h-rise);for(let i=1;i<=16;i++){const u=w/2-w*i/16;s.lineTo(x+w/2+u,y+center+Math.sqrt(Math.max(0,radius*radius-u*u)));}}
        else{s.lineTo(x+w,y+h);s.lineTo(x,y+h);}
        s.closePath();return s;
      };
      const frame=(rise=0)=>{
        const oval=o.head==='oval';
        const outer=openingShape(o.leftM,o.bottomM,o.widthM,o.heightM,rise,oval),inner=openingShape(o.leftM+t,o.bottomM+t,o.widthM-2*t,o.heightM-2*t,Math.min(rise,(o.widthM-2*t)/2),oval);
        outer.holes.push(new T.Path(inner.getPoints()));const g=new T.ExtrudeGeometry(outer,{depth:frameDepth,bevelEnabled:false});g.translate(0,0,.015+projection);add(g,frameSurface,`${name}/frame`,facade);
      };
      if(o.head==='oval'){
        if(o.kind!=='window'||o.headRiseM!==undefined||paneSurface!=='glass')throw new Error('Oval window requires glass and cannot have a segmental rise or door leaf');
        frame();
        const g=new T.ExtrudeGeometry(openingShape(o.leftM+t,o.bottomM+t,o.widthM-2*t,o.heightM-2*t,0,true),{depth:.03,bevelEnabled:false});
        g.translate(0,0,paneOffset+projection-.015);add(g,'glass',`${name}/pane`,facade);
      }else if(o.head){
        if(o.head!=='segmental'||o.headRiseM===undefined)throw new Error('Segmental head requires an observed rise');
        positive(o.headRiseM);if(o.headRiseM>Math.min(o.heightM,o.widthM/2))throw new Error('Invalid segmental head rise');
        const arch=(x:number,y:number,w:number,h:number,rise:number,d:number,depth:number,surface:keyof typeof palette,label:string)=>{
          const radius=w*w/(8*rise)+rise/2,center=h-radius,outline=new T.Shape();outline.moveTo(x,y);outline.lineTo(x+w,y);outline.lineTo(x+w,y+h-rise);
          for(let i=1;i<=16;i++){const u=w/2-w*i/16;outline.lineTo(x+w/2+u,y+center+Math.sqrt(Math.max(0,radius*radius-u*u)));}
          outline.closePath();const g=new T.ExtrudeGeometry(outline,{depth:d,bevelEnabled:false});g.translate(0,0,depth-d/2);add(g,surface,label,facade);
        };
        frame(o.headRiseM);
        arch(o.leftM+t,o.bottomM+t,o.widthM-2*t,o.heightM-2*t,Math.min(o.headRiseM,(o.widthM-2*t)/2),.03,paneOffset+projection,paneSurface,`${name}/pane`);
      }else{
        if(o.headRiseM!==undefined)throw new Error('Head rise requires a supported opening head');
        frame();
        box(o.leftM+t,o.bottomM+t,o.widthM-2*t,o.heightM-2*t,.03,paneOffset+projection,paneSurface,`${name}/pane`);
      }
      if(o.paneTint){const pane=facade.children.find(child=>child.name===`${name}/pane`) as T.Mesh;const material=(pane.material as T.MeshStandardMaterial).clone();material.color.set(o.paneTint);pane.material=material;}
      const paneWidth=o.widthM-2*t,paneHeight=o.heightM-2*t;
      const barWidth=o.mullionWidthM??t;
      if(o.mullionWidthM!==undefined&&(!Number.isFinite(barWidth)||barWidth<.008||barWidth>Math.min(t,.08)))throw new Error('Unsupported opening mullion width');
      const paneRise=o.head==='segmental'?Math.min(o.headRiseM!,paneWidth/2):0;
      const paneRadius=paneRise?paneWidth*paneWidth/(8*paneRise)+paneRise/2:0;
      const ovalHalfHeight=(x:number)=>paneHeight/2*Math.sqrt(Math.max(0,1-((x-paneWidth/2)/(paneWidth/2))**2));
      const paneTop=(relativeX:number)=>o.head==='oval'?paneHeight/2+ovalHalfHeight(relativeX):paneRise?paneHeight-paneRadius+Math.sqrt(Math.max(0,paneRadius*paneRadius-(relativeX-paneWidth/2)**2)):paneHeight;
      const paneBottom=(relativeX:number)=>o.head==='oval'?paneHeight/2-ovalHalfHeight(relativeX):0;
      const panels=o.panels??[];
      if(panels.length>16||panels.length&&o.kind!=='door')throw new Error('Door panels require a door and at most 16 observed fields');
      for(const [i,p] of panels.entries()){
        if(!Array.isArray(p.rect)||p.rect.length!==4)throw new Error('Invalid door panel rectangle');
        const [left,bottom,width,height]=p.rect;finite(left,bottom,width,height);positive(width,height,p.frameWidthM,p.reliefM,p.fieldReliefM);
        const x=left*paneWidth,y=bottom*paneHeight,w=width*paneWidth,h=height*paneHeight;
        if(left<=0||bottom<=0||left+width>=1||bottom+height>=1||y+h>=Math.min(paneTop(x),paneTop(x+w)))throw new Error('Door panel escapes its leaf or head');
        if(p.frameWidthM>.06||p.frameWidthM*2>=Math.min(w,h)||p.reliefM>.035||p.fieldReliefM>.02||p.reliefM-p.fieldReliefM<.001)throw new Error('Unsupported door panel frame or relief');
        if(p.frameSurface!=='door'&&p.frameSurface!=='trim')throw new Error('Unsupported door panel frame surface');
        const edges=p.frameEdges??['left','right','top','bottom'];
        if(!Array.isArray(edges)||!edges.length||new Set(edges).size!==edges.length||edges.some(edge=>!['left','right','top','bottom'].includes(edge)))throw new Error('Invalid door panel frame edges');
        if(panels.slice(0,i).some(q=>left<q.rect[0]+q.rect[2]&&left+width>q.rect[0]&&bottom<q.rect[1]+q.rect[3]&&bottom+height>q.rect[1]))throw new Error('Door panels overlap');
        const px=o.leftM+t+x,py=o.bottomM+t+y,f=p.frameWidthM,leafFace=paneOffset+projection+.015;
        const insetLeft=edges.includes('left')?f:0,insetRight=edges.includes('right')?f:0,insetTop=edges.includes('top')?f:0,insetBottom=edges.includes('bottom')?f:0;
        if(edges.length===4){
          const outer=openingShape(px,py,w,h),inner=openingShape(px+f,py+f,w-2*f,h-2*f);
          outer.holes.push(new T.Path(inner.getPoints()));
          const ring=new T.ExtrudeGeometry(outer,{depth:p.reliefM,bevelEnabled:false});ring.translate(0,0,leafFace);
          add(ring,p.frameSurface,`${name}/panel/${i}/frame`,facade);
        }else for(const edge of edges){
          const horizontal=edge==='top'||edge==='bottom';
          box(px+(edge==='right'?w-f:0),py+(edge==='top'?h-f:horizontal?0:insetBottom),horizontal?w:f,horizontal?f:h-insetBottom-insetTop,p.reliefM,leafFace+p.reliefM/2,p.frameSurface,`${name}/panel/${i}/frame/${edge}`);
        }
        box(px+insetLeft,py+insetBottom,w-insetLeft-insetRight,h-insetBottom-insetTop,p.fieldReliefM,leafFace+p.fieldReliefM/2,'door',`${name}/panel/${i}/field`);
      }
      for(const [a,b]of o.diagonalBars??[]){
        for(const [x,y]of[a,b])if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||x>=1||y<=0||y>=1||x*o.widthM<t||x*o.widthM>o.widthM-t||y*o.heightM-t<paneBottom(x*o.widthM-t)||y*o.heightM-t>paneTop(x*o.widthM-t))throw new Error('Grille segment escapes pane');
        const x=a[0]*o.widthM,y=a[1]*o.heightM,xx=b[0]*o.widthM,yy=b[1]*o.heightM,distance=Math.hypot(xx-x,yy-y);positive(distance);
        const g=new T.BoxGeometry(distance,barWidth*.7,.03);g.rotateZ(Math.atan2(yy-y,xx-x));g.translate(o.leftM+(x+xx)/2,o.bottomM+(y+yy)/2,barDepth+projection);add(g,barSurface,`${name}/grille`,facade);
      }
      for(const [axis,values] of [['vertical',o.verticalBars??[]],['horizontal',o.horizontalBars??[]]] as const)for(const [i,f] of values.entries()){
        if(!(f>0&&f<1))throw new Error('Invalid opening bar fraction');
        if(axis==='vertical'){
          const x=o.widthM*f-barWidth/2,bottom=Math.max(paneBottom(x-t),paneBottom(x+barWidth-t)),height=Math.min(paneTop(x-t),paneTop(x+barWidth-t))-bottom;
          if(x<t||x+barWidth>o.widthM-t)throw new Error('Opening bar escapes pane');
          box(o.leftM+x,o.bottomM+t+bottom,barWidth,height,.03,barDepth+projection,barSurface,`${name}/bar`);
        }else{
          const width=o.horizontalBarWidthsM?.[i]??barWidth,y=o.heightM*f-width/2,upper=y+width-t;
          if(y<t||y+width>o.heightM-t)throw new Error('Opening bar escapes pane');
          const ovalHalfWidth=(py:number)=>paneWidth/2*Math.sqrt(Math.max(0,1-((py-paneHeight/2)/(paneHeight/2))**2));
          const span=o.head==='oval'?Math.min(ovalHalfWidth(y-t),ovalHalfWidth(upper)):paneRise&&upper>paneHeight-paneRise?Math.sqrt(Math.max(0,paneRadius*paneRadius-(upper-(paneHeight-paneRadius))**2)):paneWidth/2;
          box(o.leftM+o.widthM/2-span,o.bottomM+y,span*2,width,.03,barDepth+projection,barSurface,`${name}/bar`);
        }
      }
      if(recess){
        for(const child of facade.children.slice(firstOpeningChild))if(child instanceof T.Mesh)child.geometry.translate(0,0,-recess.depthM);
        for(const r of recess.returns){
          box(r.x,r.y,r.w,r.h,recess.depthM,-recess.depthM/2,r.surface,`${name}/recess/${r.id}`);
          if(r.surface==='glass'){
            const f=Math.min(o.trimWidthM,.07),d=recess.depthM;
            for(const y of [r.y,r.y+r.h-f])box(r.x,y,r.w,f,d,-d/2,frameSurface,`${name}/recess/${r.id}/horizontal-frame`);
            for(const z of [-d+f/2,-f/2])box(r.x,r.y+f,r.w,r.h-2*f,f,z,frameSurface,`${name}/recess/${r.id}/vertical-frame`);
          }
        }
        recessed.push({facade,opening:o,depthM:recess.cutDepthM});
      }
    }
    if(elevation.glazedBays){
      const ids=new Set<string>();
      for(const bay of read(elevation.glazedBays,`${elevation.id}/glazedBays`)){
        const left=bay.leftM??0,bottom=bay.bottomM??0;
        if(ids.has(bay.id)||left<0||bottom<0||left+bay.widthM>length+EPS||!withinWall(left,bay.widthM,bottom+bay.heightM))throw Error('Glazed bay escapes its observed host facade');
        ids.add(bay.id);
        const m=facadeMaterials.get(facade)??materials;
        const module=canalhouseGlazedBay({...bay,outwardM:bay.outwardM??.015},{wall:m.wall,frame:m.trim,glass:m.glass});
        module.traverse(o=>{if(o instanceof T.Mesh)o.userData={...o.userData,component:'glazedBay',pandId:recipe.house.pandId};});
        facade.add(module);
      }
    }
    if(elevation.cornice){
      const c=read(elevation.cornice,`${elevation.id}/cornice`);positive(c.heightM,c.depthM);finite(c.bottomM);
      if(!Number.isInteger(c.brackets)||c.brackets<0||c.brackets>100)throw new Error('Invalid bracket count');
      const spans=c.spans??[{leftM:0,widthM:length}];
      if(!spans.length||spans.length>16||spans.some(s=>![s.leftM,s.widthM].every(Number.isFinite)||s.leftM<0||s.widthM<=0||s.leftM+s.widthM>length+EPS)||spans.some((s,i)=>spans.slice(0,i).some(p=>Math.min(s.leftM+s.widthM,p.leftM+p.widthM)>Math.max(s.leftM,p.leftM)+EPS)))throw Error('Invalid cornice spans');
      if(c.layers){
        if(!c.layers.length)throw new Error('Empty cornice profile');
        for(const [i,layer]of c.layers.entries()){
          positive(layer.heightM,layer.depthM);finite(layer.bottomM);
          if(layer.bottomM<c.bottomM-EPS||layer.bottomM+layer.heightM>c.bottomM+c.heightM+EPS)throw new Error('Cornice layer escapes its observed band');
          for(const [spanIndex,span] of spans.entries())if(layer.underside){
            const u=layer.underside;positive(u.riseM,u.insetM);
            if(u.riseM>=layer.heightM||u.insetM>=layer.depthM)throw Error('Cornice underside escapes its course');
            const shape=new T.Shape();shape.moveTo(0,layer.bottomM);shape.lineTo(-(layer.depthM-u.insetM),layer.bottomM);
            shape.lineTo(-layer.depthM,layer.bottomM+u.riseM);shape.lineTo(-layer.depthM,layer.bottomM+layer.heightM);shape.lineTo(0,layer.bottomM+layer.heightM);shape.closePath();
            const geometry=new T.ExtrudeGeometry(shape,{depth:span.widthM,bevelEnabled:false,steps:1});geometry.rotateY(Math.PI/2);if(span.leftM)geometry.translate(span.leftM,0,0);
            add(geometry,'trim',`cornice/layer-${i}${spanIndex?'/span-'+spanIndex:''}`,facade);
          }else box(span.leftM,layer.bottomM,span.widthM,layer.heightM,layer.depthM,layer.depthM/2,'trim',`cornice/layer-${i}${spanIndex?'/span-'+spanIndex:''}`);
        }
      }else for(const [i,span]of spans.entries())box(span.leftM,c.bottomM,span.widthM,c.heightM,c.depthM,c.depthM/2,'trim',`cornice/band${i?'/span-'+i:''}`);
      const accentIds=new Set<string>();
      for(const accent of c.accents??[]){
        if(typeof accent.id!=='string'||!accent.id.trim()||accentIds.has(accent.id))throw new Error('Invalid or duplicate cornice accent ID');accentIds.add(accent.id);
        positive(accent.widthM,accent.heightM,accent.depthM);finite(accent.leftM,accent.bottomM);
        if(accent.leftM<0||accent.leftM+accent.widthM>length+EPS||accent.bottomM<c.bottomM-EPS||accent.bottomM+accent.heightM>c.bottomM+c.heightM+EPS)throw new Error('Cornice accent escapes its observed band');
        if(accent.profile==='triglyph'){
          // Three shallow vertical channels retain a solid panel behind them.
          // Section proportions are a restrained construction pattern, not a
          // claim that the depth of photographed carving has been measured.
          const w=accent.widthM,h=accent.heightM,d=accent.depthM,grooveDepth=Math.min(.025,d*.12),lip=h*.08;
          box(accent.leftM,accent.bottomM,w,h,d-grooveDepth,(d-grooveDepth)/2+.02,'trim',`cornice/triglyph-${accent.id}/base`);
          box(accent.leftM,accent.bottomM,w,lip,grooveDepth,d-grooveDepth/2+.02,'trim',`cornice/triglyph-${accent.id}/bottom`);
          box(accent.leftM,accent.bottomM+h-lip,w,lip,grooveDepth,d-grooveDepth/2+.02,'trim',`cornice/triglyph-${accent.id}/top`);
          const grooveWidth=w*.09,grooves=[.2,.5,.8].map(center=>[w*center-grooveWidth/2,w*center+grooveWidth/2]);
          const strips=[[0,grooves[0][0]],[grooves[0][1],grooves[1][0]],[grooves[1][1],grooves[2][0]],[grooves[2][1],w]];
          for(const [i,[left,right]]of strips.entries())box(accent.leftM+left,accent.bottomM+lip,right-left,h-2*lip,grooveDepth,d-grooveDepth/2+.02,'trim',`cornice/triglyph-${accent.id}/rib-${i}`);
          // Sloped shoulders make the carved channels visible in the flat-color
          // daylight style without painting dark lines onto the front face.
          for(const [i,[left,right]]of grooves.entries())for(const [side,points]of [
            [[left,d],[left+grooveWidth*.25,d-grooveDepth],[left,d-grooveDepth]],
            [[right-grooveWidth*.25,d-grooveDepth],[right,d],[right,d-grooveDepth]],
          ].entries()){
            const section=new T.Shape(points.map(([x,z])=>new T.Vector2(x,z)));
            const geometry=new T.ExtrudeGeometry(section,{depth:h-2*lip,bevelEnabled:false});
            geometry.rotateX(Math.PI/2);geometry.translate(accent.leftM,accent.bottomM+h-lip,.02);
            add(geometry,'trim',`cornice/triglyph-${accent.id}/channel-${i}/shoulder-${side}`,facade);
          }
        }else if(accent.profile){
          if(accent.profile!=='console')throw new Error('Unsupported cornice accent profile');
          // A pendant support has a curved/tapered vertical section: a flat
          // rectangle disappears into the same-colour frieze in normal views.
          const d=accent.depthM,h=accent.heightM,s=new T.Shape();s.moveTo(0,0);
          for(const [depth,height]of [[.35,0],[.55,.16],[.78,.42],[.94,.72],[1,1],[0,1]])s.lineTo(depth*d,height*h);
          s.closePath();const g=new T.ExtrudeGeometry(s,{depth:accent.widthM,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(accent.leftM+accent.widthM,accent.bottomM,.025);add(g,'trim',`cornice/console-${accent.id}`,facade);
          box(accent.leftM,accent.bottomM,accent.widthM,h*.12,d*.6,d*.35+.025,'trim',`cornice/console-foot-${accent.id}`);
        }else box(accent.leftM,accent.bottomM,accent.widthM,accent.heightM,accent.depthM,accent.depthM/2+.02,'trim',`cornice/accent-${accent.id}`);
      }
      for(let i=0;i<c.brackets;i++)box(length*(i+.5)/c.brackets-c.heightM/4,c.bottomM-c.heightM,c.heightM/2,c.heightM,c.depthM*.8,c.depthM*.4,'trim','cornice/bracket');
    }
    if(crown){
      const c=crown,p=c.profile;
      if(p.some(v=>v[1]>eaves+EPS)){
        const s=new T.Shape();s.moveTo(0,eaves);for(const [x,y] of p)s.lineTo(x,y);s.lineTo(length,eaves);s.closePath();
        const g=new T.ExtrudeGeometry(s,{depth:c.depthM,bevelEnabled:false});g.translate(0,0,-c.depthM+.02);add(g,c.surface??'wall',`crown/${recipe.house.gable.value}`,facade);
      }
      if(c.capFacing){
        const f=c.capFacing,top=Math.max(...p.map(v=>v[1]));
        if(![f.bottomM,f.depthM].every(Number.isFinite)||f.bottomM<eaves||f.bottomM>=top-EPS||f.depthM<=0||f.depthM>.2||!['wall','trim','stone'].includes(f.surface))throw Error('Invalid crown cap facing');
        const upper=p.map((v,i)=>v[1]>f.bottomM+EPS?i:-1).filter(i=>i>=0);
        if(p.slice(upper[0],upper.at(-1)!+1).some(v=>v[1]<f.bottomM-EPS))throw Error('Crown cap facing requires one connected head');
        // Clip the existing crown silhouette; never author another crest polygon.
        const polygon:CanalhousePoint[]=[[0,eaves],...p,[length,eaves]],ring:CanalhousePoint[]=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[1]-f.bottomM,db=b[1]-f.bottomM;
          if(da>=0)ring.push(a);
          if(da<0&&db>0||da>0&&db<0){const t=da/(da-db);ring.push([a[0]+t*(b[0]-a[0]),f.bottomM]);}
        }
        const left=Math.min(...ring.map(v=>v[0])),right=Math.max(...ring.map(v=>v[0]));
        if(openings.some(o=>Math.min(right,o.leftM+o.widthM)-Math.max(left,o.leftM)>EPS&&Math.min(top,o.bottomM+o.heightM)-Math.max(f.bottomM,o.bottomM)>EPS))throw Error('Crown cap facing overlaps an opening');
        if(ring.length<3||Math.abs(area(ring))<EPS)throw Error('Empty crown cap facing');
        const s=new T.Shape(ring.map(v=>new T.Vector2(...v))),g=new T.ExtrudeGeometry(s,{depth:f.depthM,bevelEnabled:false});
        g.translate(0,0,.02);add(g,f.surface,'crown/cap-facing',facade);
      }
      if(c.wings)for(const wing of canalhouseCrownWingProfiles(p,length,c.wings)){
        const xs=wing.profile.map(v=>v[0]),ys=wing.profile.map(v=>v[1]),left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
        if(openings.some(o=>Math.min(right,o.leftM+o.widthM)-Math.max(left,o.leftM)>EPS&&Math.min(top,o.bottomM+o.heightM)-Math.max(bottom,o.bottomM)>EPS))throw Error('Crown wing overlaps an opening');
        const s=new T.Shape(wing.profile.map(v=>new T.Vector2(...v))),g=new T.ExtrudeGeometry(s,{depth:c.wings.depthM,bevelEnabled:false});
        g.translate(0,0,.02);add(g,c.wings.surface,`crown/wing-${wing.id}`,facade);
      }
      if(c.trimWidthM>0)for(let i=1;i<p.length;i++){
        const [x,y]=p[i-1],[xx,yy]=p[i],distance=Math.hypot(xx-x,yy-y);if(distance<EPS)continue;
        const g=new T.BoxGeometry(distance,c.trimWidthM,.04);g.rotateZ(Math.atan2(yy-y,xx-x));g.translate((x+xx)/2,(y+yy)/2,.065);add(g,'trim','crown/edge',facade);
      }
    }
    if(elevation.dormerFront&&!elevation.dormers)throw new Error('Attic front requires observed dormers');
    if(elevation.dormers){
      const dormers=read(elevation.dormers,`${elevation.id}/dormers`),ids=new Set<string>();
      for(const d of dormers){
        positive(d.widthM,d.heightM,d.depthM);finite(d.leftM,d.bottomM,d.roofRiseM);
        if(!d.id.trim()||ids.has(d.id))throw new Error('Duplicate dormer');ids.add(d.id);
        if(d.leftM<0||d.leftM+d.widthM>length+EPS||d.bottomM<shellTop-EPS||d.roofRiseM<0)throw new Error('Invalid observed dormer extent');
        const setback=d.setbackM??0;finite(setback);if(setback<0||setback>2)throw Error('Unsupported dormer setback');
        if(setback&&elevation.dormerFront)throw Error('Set-back dormer requires independently observed attic-front placement');
        const firstChild=facade.children.length;
        const localPoint=(x:number,z:number):CanalhousePoint=>[a[0]+ux*x+nx*z,a[1]+uz*x+nz*z];
        const x0=d.leftM,x1=d.leftM+d.widthM,z0=-setback,z1=-d.depthM-setback;
        const footprint=[localPoint(x0,z0),localPoint(x1,z0),localPoint(x1,z1),localPoint(x0,z1)];
        // Source dormer depth never authorizes extension over a neighbor or open court.
        for(let edge=0;edge<4;edge++){
          const p=footprint[edge],q=footprint[(edge+1)%4];
          if(!contains(p)||!contains([(p[0]+q[0])/2,(p[1]+q[1])/2]))throw new Error('Dormer escapes surveyed footprint');
          for(const boundary of boundaries){
            const ca=cross(p,q,boundary.a),cb=cross(p,q,boundary.b),cc=cross(boundary.a,boundary.b,p),cd=cross(boundary.a,boundary.b,q);
            if(ca*cb<-EPS&&cc*cd<-EPS)throw new Error('Dormer crosses courtyard or footprint boundary');
          }
        }
        if(!contains(localPoint((x0+x1)/2,-d.depthM/2-setback)))throw new Error('Dormer covers surveyed courtyard');
        for(const poly of polygons)for(const hole of poly.holes)if(hole.some(v=>inRing(v,footprint,true)))throw new Error('Dormer covers surveyed courtyard');
        const label=`dormer/${d.id}`,t=d.trimWidthM??.06,wall=.08,wallSurface=d.wallSurface??'wall',roofSurface=d.roofSurface??'roof';
        if(!['wall','trim','stone'].includes(wallSurface)||!['roof','trim','wall'].includes(roofSurface))throw Error('Invalid dormer surface');
        positive(t);if(t*2>=Math.min(d.widthM,d.heightM))throw new Error('Dormer frame consumes its opening');
        const top=d.bottomM+d.heightM;
        // Thin side/back walls with a genuinely open front; no solid parent behind glazing.
        box(x0,d.bottomM,wall,d.heightM,d.depthM,-d.depthM/2,wallSurface,`${label}/left-wall`);
        box(x1-wall,d.bottomM,wall,d.heightM,d.depthM,-d.depthM/2,wallSurface,`${label}/right-wall`);
        box(x0,d.bottomM,d.widthM,d.heightM,wall,-d.depthM+wall/2,wallSurface,`${label}/back-wall`);
        box(x0,d.bottomM,t,d.heightM,.04,.03,'trim',`${label}/frame-left`);
        box(x1-t,d.bottomM,t,d.heightM,.04,.03,'trim',`${label}/frame-right`);
        box(x0,d.bottomM,d.widthM,t,.04,.03,'trim',`${label}/frame-bottom`);
        box(x0,top-t,d.widthM,t,.04,.03,'trim',`${label}/frame-top`);
        box(x0+t,d.bottomM+t,d.widthM-2*t,d.heightM-2*t,.03,.065,'glass',`${label}/pane`);
        for(const f of d.verticalBars??[]){if(!(f>0&&f<1)||d.widthM*f-t/2<t||d.widthM*f+t/2>d.widthM-t)throw new Error('Dormer bar escapes pane');box(x0+d.widthM*f-t/2,d.bottomM+t,t,d.heightM-2*t,.03,.095,'trim',`${label}/bar`);}
        for(const f of d.horizontalBars??[]){if(!(f>0&&f<1)||d.heightM*f-t/2<t||d.heightM*f+t/2>d.heightM-t)throw new Error('Dormer bar escapes pane');box(x0+t,d.bottomM+d.heightM*f-t/2,d.widthM-2*t,t,.03,.095,'trim',`${label}/bar`);}
        const overhang=d.frontOverhangM??0;finite(overhang);if(overhang<0||overhang>.3)throw Error('Unsupported dormer front overhang');
        const roofValues:number[]=[],mid=(x0+x1)/2;
        const quad=(p:number[],q:number[],r:number[],s:number[])=>roofValues.push(...p,...q,...r,...p,...r,...s);
        if(d.roofRiseM>0){
          quad([x0,top,overhang],[mid,top+d.roofRiseM,overhang],[mid,top+d.roofRiseM,-d.depthM],[x0,top,-d.depthM]);
          quad([mid,top+d.roofRiseM,overhang],[x1,top,overhang],[x1,top,-d.depthM],[mid,top+d.roofRiseM,-d.depthM]);
          // Roof owns the top: solid gable ends sit just below its planes,
          // avoiding coplanar pale wedges at the rear cap join.
          const capClearance=.005;
          const gable=new T.Shape([new T.Vector2(x0,top-capClearance),new T.Vector2(x1,top-capClearance),new T.Vector2(mid,top+d.roofRiseM-capClearance)]);
          const g=new T.ExtrudeGeometry(gable,{depth:wall,bevelEnabled:false});g.translate(0,0,overhang-wall);add(g,wallSurface,`${label}/front-gable`,facade);
          const back=g.clone();back.translate(0,0,-d.depthM+wall-overhang);add(back,wallSurface,`${label}/back-gable`,facade);
        }else quad([x0,top,overhang],[x1,top,overhang],[x1,top,-d.depthM],[x0,top,-d.depthM]);
        const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(roofValues,3));roof.computeVertexNormals();add(roof,roofSurface,`${label}/roof`,facade);
        if(setback)for(const child of facade.children.slice(firstChild))if(child instanceof T.Mesh)child.geometry.translate(0,0,-setback);
        if(d.hostAperture){
          const depth=d.hostAperture.depthM;positive(depth);
          if(depth<setback+.08||depth>2)throw Error('Native aperture must cover its observed dormer setback');
          let removed=0;const inverse=facade.matrix.clone().invert();
          for(const native of group.children)if(native instanceof T.Mesh&&native.userData.surface==='wall'&&(native.name.startsWith('shell/')||native.name.startsWith('roof/step-wall'))){
            const cut=cutNativeFacadeAperture(native.geometry,inverse,{leftM:x0,bottomM:d.bottomM,widthM:d.widthM,heightM:d.heightM,depthM:depth});
            if(cut.geometry!==native.geometry){native.geometry.dispose();native.geometry=cut.geometry;}removed+=cut.removedAreaM2;
          }
          if(removed<.001)throw Error('Declared native aperture has no matching host wall');
          if(setback){
            const reveal=.04;
            for(const x of [x0,x1-reveal])box(x,d.bottomM,reveal,d.heightM,setback,-setback/2,'wall',`${label}/host-reveal`);
            for(const y of [d.bottomM,top-reveal])box(x0,y,d.widthM,reveal,setback,-setback/2,'wall',`${label}/host-reveal`);
          }
          facade.userData.nativeApertures=[...(facade.userData.nativeApertures??[]),{id:d.id,removedAreaM2:removed}];
        }
      }
      if(elevation.dormerFront){
        const aPoint=a;
        const front=read(elevation.dormerFront,`${elevation.id}/dormerFront`),p=front.profile;
        positive(front.depthM);finite(front.trimWidthM);
        if(!dormers.length||front.depthM>.25||front.trimWidthM<0||front.trimWidthM>.15||!['wall','roof'].includes(front.surface)||p.length<2)throw new Error('Invalid attic front section');
        for(let i=0;i<p.length;i++){
          finite(...p[i]);
          if(p[i][0]<0||p[i][0]>length+EPS||p[i][1]<eaves||i&&p[i][0]<p[i-1][0])throw new Error('Invalid attic front profile');
        }
        for(const d of dormers)for(const x of [d.leftM,...p.map(v=>v[0]).filter(x=>x>d.leftM&&x<d.leftM+d.widthM),d.leftM+d.widthM]){
          const heights=p.slice(1).flatMap((v,i)=>p[i][0]<=x&&v[0]>=x&&v[0]>p[i][0]?[p[i][1]+(v[1]-p[i][1])*(x-p[i][0])/(v[0]-p[i][0])]:[]);
          if(!heights.length||Math.max(...heights)<d.bottomM+d.heightM-EPS)throw new Error('Attic front does not support observed dormer');
        }
        const xs=[...new Set([...p.map(v=>v[0]),...dormers.flatMap(d=>[d.leftM,d.leftM+d.widthM])])].sort((a,b)=>a-b);
        let panel=0;
        for(let i=1;i<xs.length;i++){
          const left=xs[i-1],right=xs[i],mid=(left+right)/2;
          const segment=p.slice(1).findIndex((v,j)=>p[j][0]<=mid&&v[0]>=mid&&v[0]>p[j][0]);
          if(segment<0)continue;
          const a=p[segment],b=p[segment+1],top=(x:number)=>a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
          const footprint=[left,right].flatMap(x=>[0,-front.depthM].map(z=>[aPoint[0]+ux*x+nx*z,aPoint[1]+uz*x+nz*z] as CanalhousePoint));
          // Check the shallow front strip, including courts and boundaries.
          const ring=[footprint[0],footprint[2],footprint[3],footprint[1]];
          for(let edge=0;edge<4;edge++){
            const v=ring[edge],w=ring[(edge+1)%4];
            if(!contains(v)||!contains([(v[0]+w[0])/2,(v[1]+w[1])/2]))throw new Error('Attic front escapes surveyed footprint');
            for(const boundary of boundaries)if(cross(v,w,boundary.a)*cross(v,w,boundary.b)<-EPS&&cross(boundary.a,boundary.b,v)*cross(boundary.a,boundary.b,w)<-EPS)throw new Error('Attic front crosses courtyard');
          }
          for(const poly of polygons)for(const hole of poly.holes)if(hole.some(v=>inRing(v,ring,true)))throw new Error('Attic front covers courtyard');
          let intervals:[number,number][]=[[eaves,Math.max(top(left),top(right))]];
          for(const d of dormers.filter(d=>d.leftM<mid&&d.leftM+d.widthM>mid))intervals=intervals.flatMap(([lo,hi])=>[[lo,Math.min(hi,d.bottomM)],[Math.max(lo,d.bottomM+d.heightM),hi]] as [number,number][]).filter(([lo,hi])=>hi-lo>EPS);
          for(const [lo,hi]of intervals){
            const upperLeft=Math.min(hi,top(left)),upperRight=Math.min(hi,top(right));
            if(Math.max(upperLeft,upperRight)<=lo+EPS)continue;
            const shape=new T.Shape([new T.Vector2(left,lo),new T.Vector2(right,lo),new T.Vector2(right,upperRight),new T.Vector2(left,upperLeft)]);
            const geometry=new T.ExtrudeGeometry(shape,{depth:front.depthM,bevelEnabled:false});geometry.translate(0,0,-front.depthM);
            add(geometry,front.surface,`attic-front/panel-${panel++}`,facade);
          }
        }
        if(front.trimWidthM)for(let i=1;i<p.length;i++){
          const [x,y]=p[i-1],[xx,yy]=p[i],distance=Math.hypot(xx-x,yy-y);if(distance<EPS)continue;
          const geometry=new T.BoxGeometry(distance,front.trimWidthM,.035);geometry.rotateZ(Math.atan2(yy-y,xx-x));geometry.translate((x+xx)/2,(y+yy)/2,.035);
          add(geometry,'trim','attic-front/cap',facade);
        }
      }
    }
    if(elevation.ornaments){
      const ids=new Set<string>();
      for(const o of read(elevation.ornaments,`${elevation.id}/ornaments`)){
        positive(o.depthM);if(o.depthM>.3||!o.id.trim()||ids.has(o.id))throw new Error('Invalid facade ornament');ids.add(o.id);
        if(o.profile.length<3||Math.abs(area(o.profile))<EPS||o.profile.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>length+EPS||y<0))throw new Error('Ornament escapes its facade');
        if(o.fill!==undefined&&o.fill!=='trim'&&o.fill!=='wall')throw new Error('Unsupported ornament fill');
        if(o.fill){const s=new T.Shape(o.profile.map(([x,y])=>new T.Vector2(x,y)));const g=new T.ExtrudeGeometry(s,{depth:o.depthM,bevelEnabled:false});g.translate(0,0,.09);add(g,o.fill,`ornament/${o.id}/field`,facade);}
        if(o.rimWidthM!==undefined){positive(o.rimWidthM);for(let i=0;i<o.profile.length;i++){
          const [x,y]=o.profile[i],[xx,yy]=o.profile[(i+1)%o.profile.length],distance=Math.hypot(xx-x,yy-y);if(distance<EPS)continue;
          const g=new T.BoxGeometry(distance,o.rimWidthM,o.depthM);g.rotateZ(Math.atan2(yy-y,xx-x));g.translate((x+xx)/2,(y+yy)/2,.1+o.depthM);add(g,'trim',`ornament/${o.id}/rim`,facade);
        }}
      }
    }
    for(const [component,field] of [['bands',elevation.bands],['blocks',elevation.blocks]] as const)if(field){
      const details=read(field,`${elevation.id}/${component}`),ids=new Set<string>();
      for(const d of details){
        positive(d.widthM,d.heightM,d.depthM);finite(d.leftM,d.bottomM);
        if(!d.id.trim()||ids.has(d.id))throw new Error('Duplicate facade detail');ids.add(d.id);
        if(d.leftM<0||d.bottomM<0||d.leftM+d.widthM>length+EPS||!withinWall(d.leftM,d.widthM,d.bottomM+d.heightM))throw new Error('Facade detail escapes its supported wall');
        if(d.surface!==undefined&&d.surface!=='wall'&&d.surface!=='trim'&&d.surface!=='stone')throw new Error('Unsupported facade detail surface');
        // A projected plinth/risalit is masonry around apertures, not an opaque
        // plate across them. Subtract opening rectangles into disjoint piers
        // and lintels; the separately authored frames own the aperture edges.
        let pieces=[{x:d.leftM,y:d.bottomM,w:d.widthM,h:d.heightM}];
        for(const o of openings){
          pieces=pieces.flatMap(p=>{
            const l=Math.max(p.x,o.leftM),r=Math.min(p.x+p.w,o.leftM+o.widthM);
            const bottom=Math.max(p.y,o.bottomM),top=Math.min(p.y+p.h,o.bottomM+o.heightM);
            if(r-l<EPS||top-bottom<EPS)return[p];
            return [{x:p.x,y:p.y,w:l-p.x,h:p.h},{x:r,y:p.y,w:p.x+p.w-r,h:p.h},
              {x:l,y:p.y,w:r-l,h:bottom-p.y},{x:l,y:top,w:r-l,h:p.y+p.h-top}].filter(v=>v.w>EPS&&v.h>EPS);
          });
        }
        for(const [i,p]of pieces.entries())box(p.x,p.y,p.w,p.h,d.depthM,d.depthM/2+.015,d.surface??'trim',`facadeDetail/${component}/${d.id}/piece-${i}`);
        // Rectangular subtraction leaves the upper corners of a shaped head
        // empty. Restore only the masonry outside its exact sampled outer arch,
        // clipped to this detail and cut around every other opening.
        for(const o of openings.filter(o=>o.head==='segmental'||o.head==='oval')){
          const rise=o.headRiseM??o.heightM,radius=o.widthM*o.widthM/(8*rise)+rise/2,top=o.bottomM+o.heightM;
          if(d.leftM+d.widthM<=o.leftM||d.leftM>=o.leftM+o.widthM||d.bottomM+d.heightM<=top-rise||d.bottomM>=top)continue;
          const left:CanalhousePoint[]=[[o.leftM,top],[o.leftM+o.widthM/2,top]];
          for(let i=1;i<=8;i++){const x=o.widthM/2*(1-i/8);left.push([o.leftM+x,top-radius+Math.sqrt(Math.max(0,radius*radius-(x-o.widthM/2)**2))]);}
          const corners=o.head==='oval'?Array.from({length:4},(_,quadrant)=>{
            const points:CanalhousePoint[]=[[1,1],[0,1],...Array.from({length:9},(_,i)=>{const theta=Math.PI/2*(1-i/8);return[Math.cos(theta),Math.sin(theta)] as CanalhousePoint;})];
            return points.map(([x,y])=>{for(let i=0;i<quadrant;i++)[x,y]=[-y,x];return[o.leftM+o.widthM*(1+x)/2,o.bottomM+o.heightM*(1+y)/2] as CanalhousePoint;});
          }):[left,left.map(([x,y])=>[2*o.leftM+o.widthM-x,y] as CanalhousePoint).reverse()];
          let cells=[{x:d.leftM,y:d.bottomM,w:d.widthM,h:d.heightM}];
          for(const other of openings.filter(other=>other!==o))cells=cells.flatMap(p=>{
            const l=Math.max(p.x,other.leftM),r=Math.min(p.x+p.w,other.leftM+other.widthM),bottom=Math.max(p.y,other.bottomM),top=Math.min(p.y+p.h,other.bottomM+other.heightM);
            if(r-l<EPS||top-bottom<EPS)return[p];
            return [{x:p.x,y:p.y,w:l-p.x,h:p.h},{x:r,y:p.y,w:p.x+p.w-r,h:p.h},{x:l,y:p.y,w:r-l,h:bottom-p.y},{x:l,y:top,w:r-l,h:p.y+p.h-top}].filter(v=>v.w>EPS&&v.h>EPS);
          });
          for(const [side,corner]of corners.entries())for(const [cellIndex,cell]of cells.entries()){
            const profile=clipDetailPolygon(corner,cell);if(profile.length<3||Math.abs(area(profile))<EPS)continue;
            const geometry=new T.ExtrudeGeometry(new T.Shape(profile.map(([x,y])=>new T.Vector2(x,y))),{depth:d.depthM,bevelEnabled:false});geometry.translate(0,0,.015);
            add(geometry,d.surface??'trim',`facadeDetail/${component}/${d.id}/head-${o.id}-${side}-${cellIndex}`,facade);
          }
        }
      }
    }
    const balconyIds=new Set<string>();
    for(const rail of elevation.balconies?read(elevation.balconies,`${elevation.id}/balconies`):[]){
      const opening=openings.find(o=>o.id===rail.openingId&&o.kind==='window');
      if(!rail.id||balconyIds.has(rail.id)||!opening)throw new Error('Balcony rail requires a unique ID and supported window');
      balconyIds.add(rail.id);positive(rail.heightM,rail.depthM,rail.barWidthM);
      if(rail.heightM<.3||rail.heightM>Math.min(.95,opening.heightM)||rail.depthM<.08||rail.depthM>(rail.projection?1.2:.4)||rail.barWidthM<.01||rail.barWidthM>.05||!Number.isInteger(rail.posts)||rail.posts<2||rail.posts>16)throw new Error('Unsupported shallow balcony rail dimensions');
      if(rail.occludesOpening!==undefined&&rail.occludesOpening!==true)throw Error('Invalid source rail occlusion');
      const railLeft=rail.span?.leftM??opening.leftM,railWidth=rail.span?.widthM??opening.widthM;
      if(!Number.isFinite(railLeft)||!Number.isFinite(railWidth)||railWidth<=0||railLeft<0||railLeft+railWidth>length+EPS||railLeft>opening.leftM+EPS||railLeft+railWidth<opening.leftM+opening.widthM-EPS)throw Error('Unsupported balcony rail span');
      if(rail.span&&(rail.projection||rail.infill))throw Error('Independent rail span requires a plain open guard');
      if(rail.horizontalBars&&(rail.horizontalBars.length>4||new Set(rail.horizontalBars).size!==rail.horizontalBars.length||rail.horizontalBars.some(f=>!Number.isFinite(f)||f<=0||f>=1)))throw Error('Unsupported balcony horizontal bars');
      if(rail.infill&&(rail.infill.template!=='cross'||!Number.isInteger(rail.infill.panels)||rail.infill.panels<1||rail.infill.panels>6||opening.widthM/rail.infill.panels<rail.barWidthM*4))throw Error('Unsupported balcony cross infill');
      const z=.015+(opening.projectionM??0)+rail.depthM,y=opening.bottomM;
      if(rail.projection){
        const p=rail.projection;positive(p.widthM,p.slabThicknessM,p.pierWidthM);
        const left=opening.leftM+(opening.widthM-p.widthM)/2;
        if(p.widthM<opening.widthM||p.widthM>opening.widthM+2||left<0||left+p.widthM>length||p.slabThicknessM>.3||p.pierWidthM>.4||2*p.pierWidthM>=p.widthM||y<p.slabThicknessM)throw new Error('Unsupported projecting balcony platform');
        box(left,y-p.slabThicknessM,p.widthM,p.slabThicknessM,rail.depthM,z-rail.depthM/2,'stone',`balcony/${rail.id}/platform`);
        for(const x of [left,left+p.widthM-p.pierWidthM]){
          box(x,y,p.pierWidthM,rail.heightM,p.pierWidthM,z,'stone',`balcony/${rail.id}/pier`);
          if(p.supportHeightM!==undefined){
            positive(p.supportHeightM);if(p.supportHeightM>1||y-p.slabThicknessM<p.supportHeightM)throw new Error('Unsupported balcony support');
            box(x,y-p.slabThicknessM-p.supportHeightM,p.pierWidthM,p.supportHeightM,rail.depthM*.6,.015+rail.depthM*.3,'stone',`balcony/${rail.id}/support`);
          }
        }
      }
      box(railLeft,y+rail.heightM-rail.barWidthM,railWidth,rail.barWidthM,rail.barWidthM,z,'door',`balcony/${rail.id}/top`);
      for(const [i,f]of (rail.horizontalBars??[]).entries())box(railLeft,y+rail.heightM*f-rail.barWidthM/2,railWidth,rail.barWidthM,rail.barWidthM,z,'door',`balcony/${rail.id}/horizontal-${i}`);
      for(let i=0;i<rail.posts;i++)box(railLeft+i*(railWidth-rail.barWidthM)/(rail.posts-1),y,rail.barWidthM,rail.heightM,rail.barWidthM,z,'door',`balcony/${rail.id}/post-${i}`);
      if(rail.infill){
        const t=rail.barWidthM,panels=rail.infill.panels;
        box(opening.leftM,y,opening.widthM,t,t,z,'door',`balcony/${rail.id}/bottom`);
        for(let i=0;i<panels;i++){
          const x0=opening.leftM+opening.widthM*i/panels+t,x1=opening.leftM+opening.widthM*(i+1)/panels-t;
          for(const rising of [true,false]){
            const y0=y+(rising?t:rail.heightM-t),y1=y+(rising?rail.heightM-t:t);
            const geometry=new T.BoxGeometry(Math.hypot(x1-x0,y1-y0),t,t);
            geometry.rotateZ(Math.atan2(y1-y0,x1-x0));geometry.translate((x0+x1)/2,(y0+y1)/2,z);
            add(geometry,'door',`balcony/${rail.id}/cross-${i}-${rising?'rising':'falling'}`,facade);
          }
        }
      }
      for(const x of [railLeft,railLeft+railWidth-rail.barWidthM])box(x,y+rail.heightM-rail.barWidthM,rail.barWidthM,rail.barWidthM,rail.depthM,z-rail.depthM/2,'door',`balcony/${rail.id}/return`);
    }
    if(elevation.entrance){
      const s=read(elevation.entrance,`${elevation.id}/entrance`);positive(s.widthM,s.riseM,s.runM);finite(s.leftM);
      if((s.steps===undefined)===(s.approximateRiserM===undefined))throw new Error('Entrance requires an observed count or approximate riser spacing');
      if(s.approximateRiserM!==undefined){positive(s.approximateRiserM);if(s.approximateRiserM<.1||s.approximateRiserM>.3)throw new Error('Unsupported approximate entrance riser');}
      const steps=s.steps??Math.ceil(s.riseM/s.approximateRiserM!);
      if(!Number.isInteger(steps)||steps<1||steps>40||s.leftM<0||s.leftM+s.widthM>length+EPS)throw new Error('Invalid measured entrance');
      if(s.attachToLanding!==undefined&&typeof s.attachToLanding!=='boolean')throw new Error('Invalid entrance landing attachment');
      const landing=s.attachToLanding&&elevation.landing?read(elevation.landing,`${elevation.id}/landing`):null;
      if(s.attachToLanding&&(!landing||Math.abs(landing.topM-s.riseM)>.01||s.leftM<landing.leftM-EPS||s.leftM+s.widthM>landing.leftM+landing.widthM+EPS))throw new Error('Front flight must meet its observed landing');
      if(s.surface!==undefined&&s.surface!=='trim'&&s.surface!=='stone')throw new Error('Unsupported entrance surface');
      const back=landing?landing.depthM+.015:0;
      if(s.attachToLanding&&openings.some(o=>Math.min(s.leftM+s.widthM,o.leftM+o.widthM)-Math.max(s.leftM,o.leftM)>EPS&&o.bottomM<s.riseM-EPS))throw new Error('Front flight blocks a source opening');
      for(let i=0;i<steps;i++)box(s.leftM,0,s.widthM,s.riseM*(i+1)/steps,s.runM/steps,back+s.runM*(steps-i-.5)/steps,s.surface??'trim','entrance/step');
      if(s.cheeks)for(const panel of canalhouseEntranceCheeks({...s,backM:back},s.cheeks,length)){
        if(openings.some(o=>Math.min(panel.leftM+panel.widthM,o.leftM+o.widthM-o.trimWidthM)-Math.max(panel.leftM,o.leftM+o.trimWidthM)>EPS&&o.bottomM+o.trimWidthM<panel.topM-EPS))throw Error('Entrance cheek blocks an opening pane');
        add(panel.geometry,s.cheeks.surface,`entrance/cheek/${panel.side}`,facade);
      }
      if(s.rails){
        const r=s.rails;positive(r.heightM,r.widthM);
        if(r.heightM>1.5||r.widthM>.1||!r.sides.length||new Set(r.sides).size!==r.sides.length||r.sides.some(side=>side!=='left'&&side!=='right'))throw new Error('Unsupported front flight rails');
        const distance=Math.hypot(s.runM,s.riseM);
        for(const side of r.sides){
          const x=side==='left'?s.leftM+r.widthM/2:s.leftM+s.widthM-r.widthM/2;
          const g=new T.BoxGeometry(r.widthM,r.widthM,distance);g.rotateX(Math.atan2(s.riseM,s.runM));g.translate(x,s.riseM/2+r.heightM,back+s.runM/2);add(g,'door',`entrance/front-rail/${side}`,facade);
          for(const [end,y,z]of [['upper',s.riseM,back],['lower',0,back+s.runM]] as const)box(x-r.widthM/2,y,r.widthM,r.heightM,r.widthM,z,'door',`entrance/front-post/${side}/${end}`);
        }
      }
    }
    if(elevation.landing){
      const s=read(elevation.landing,`${elevation.id}/landing`);positive(s.widthM,s.topM,s.depthM,s.thicknessM);finite(s.leftM);
      const connector=s.thresholdConnector;
      if(connector){positive(connector.riseM,connector.depthM);if(connector.riseM>.5||connector.depthM>.5||connector.depthM>s.depthM)throw new Error('Unsupported threshold connector');}
      const door=openings.find(o=>o.kind==='door'&&Math.abs(o.bottomM-s.topM-(connector?.riseM??0))<.01&&s.leftM<=o.leftM+EPS&&s.leftM+s.widthM>=o.leftM+o.widthM-EPS);
      if(s.depthM>1.5||s.thicknessM>.15||s.leftM<0||s.leftM+s.widthM>length+EPS||s.topM<s.thicknessM||!door)throw new Error('Landing must meet its observed raised doorway');
      if(s.supportToGround!==undefined&&typeof s.supportToGround!=='boolean')throw new Error('Invalid landing support admission');
      if(s.supportToGround){
        if(openings.some(o=>Math.min(s.leftM+s.widthM,o.leftM+o.widthM)-Math.max(s.leftM,o.leftM)>EPS&&o.bottomM<s.topM-s.thicknessM-EPS))throw new Error('Landing masonry body blocks a source opening');
        box(s.leftM,0,s.widthM,s.topM-s.thicknessM,s.depthM,s.depthM/2+.015,'stone','entrance/landing-body');
      }
      box(s.leftM,s.topM-s.thicknessM,s.widthM,s.thicknessM,s.depthM,s.depthM/2+.015,'stone','entrance/landing');
      if(connector)box(door.leftM,s.topM,door.widthM,connector.riseM,connector.depthM,connector.depthM/2+.015,'stone','entrance/threshold-connector');
    }
    if(elevation.approach&&elevation.approaches)throw new Error('Use approach or approaches, not both');
    const approachIds=new Set<string>();
    const solidFlightSpans:{left:number;right:number}[]=[];
    const flights=elevation.approaches??(elevation.approach?[{id:'',assembly:elevation.approach}]:[]);
    for(const flight of flights){
      if(elevation.approaches){
        if(!isCanalhouseComponentId(flight.id)||approachIds.has(flight.id))throw new Error('Invalid or duplicate approach component ID');
        approachIds.add(flight.id);
      }
      const componentName=flight.id?`entrance/approach/${flight.id}`:'entrance/approach';
      const s=read(flight.assembly,`${elevation.id}/${flight.id?`${flight.id}/`:''}approach`);
      finite(s.groundM,s.backM);positive(s.depthM,s.railWidthM,s.postWidthM);
      if(s.groundM<0||s.backM<0||s.backM>.3||s.depthM>1.5||s.railWidthM>.1||s.postWidthM>.1)throw new Error('Unsupported approach dimensions');
      const validPoint=([x,y]:CanalhousePoint)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=length+EPS&&y>=s.groundM&&y<=eaves;
      const allowed=new Set(s.occludedOpeningIds??[]);
      if(allowed.size!==(s.occludedOpeningIds??[]).length||[...allowed].some(id=>!openings.some(o=>o.id===id)))throw new Error('Unknown or duplicate approach occluded opening ID');
      if(s.topProfile){
        const p=s.topProfile;
        if(p.length<2||!p.every(validPoint)||p.at(-1)![0]-p[0][0]<=EPS)throw new Error('Invalid approach contour');
        const direction=Math.sign(p.at(-1)![1]-p[0][1]);
        if(!direction||p.slice(1).some(([x,y],i)=>x<p[i][0]||direction*(y-p[i][1])<0||Math.abs(y-p[i][1])>.3+EPS||Math.hypot(x-p[i][0],y-p[i][1])<EPS))throw new Error('Approach contour must be monotone with bounded risers');
        const high=direction>0?p.at(-1)!:p[0],low=direction>0?p[0]:p.at(-1)!;
        const landing=elevation.landing?read(elevation.landing,`${elevation.id}/landing`):null;
        const edge=landing?(direction>0?landing.leftM:landing.leftM+landing.widthM):NaN;
        if(!landing||Math.abs(high[0]-edge)>.01||Math.abs(high[1]-landing.topM)>.01||Math.abs(low[1]-s.groundM)>.01||s.backM>landing.depthM+.015)throw new Error('Approach must join its source landing edge and ground');
        const span={left:p[0][0],right:p.at(-1)![0]};
        if(solidFlightSpans.some(other=>Math.min(span.right,other.right)-Math.max(span.left,other.left)>EPS))throw new Error('Overlapping solid approach components');
        solidFlightSpans.push(span);
        const outline:CanalhousePoint[]=[...p,[p.at(-1)![0],s.groundM],[p[0][0],s.groundM]];
        // Clip the actual polygon, not its bounds: the empty space above a
        // descending flight must remain available to low doors and windows.
        const clip=(poly:CanalhousePoint[],axis:0|1,bound:number,above:boolean):CanalhousePoint[]=>{
          const result:CanalhousePoint[]=[];
          for(let i=0;i<poly.length;i++){
            const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[axis]>=bound:a[axis]<=bound,bi=above?b[axis]>=bound:b[axis]<=bound;
            if(ai)result.push(a);
            if(ai!==bi){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
          }
          return result;
        };
        for(const o of openings){
          let overlap=clip(outline,0,o.leftM,true);overlap=clip(overlap,0,o.leftM+o.widthM,false);
          overlap=clip(overlap,1,o.bottomM,true);overlap=clip(overlap,1,o.bottomM+o.heightM,false);
          if(Math.abs(area(overlap))>1e-8&&!allowed.has(o.id))throw new Error(`Approach occlusion requires source acknowledgement: ${o.id}`);
        }
        const shape=new T.Shape(compactContour(outline).map(([x,y])=>new T.Vector2(x,y)));
        const g=new T.ExtrudeGeometry(shape,{depth:s.depthM,bevelEnabled:false});g.translate(0,0,s.backM);add(g,'stone',componentName,facade);
      }else if(allowed.size)throw new Error('Rail-only approach has no solid opening occlusion');
      if((s.railProfile.length>0&&s.railProfile.length<2)||!s.railProfile.every(validPoint))throw new Error('Invalid approach rail profile');
      const front=s.backM+s.depthM;
      for(let i=1;i<s.railProfile.length;i++){
        const [x,y]=s.railProfile[i-1],[xx,yy]=s.railProfile[i],distance=Math.hypot(xx-x,yy-y);
        if(distance<EPS||xx<x)throw new Error('Invalid approach rail segment');
        const g=new T.BoxGeometry(distance,s.railWidthM,s.railWidthM);g.rotateZ(Math.atan2(yy-y,xx-x));g.translate((x+xx)/2,(y+yy)/2,front);add(g,'door',`${componentName}/rail-${i-1}`,facade);
      }
      for(const [i,p]of s.posts.entries()){
        if(!validPoint([p.xM,p.bottomM])||!validPoint([p.xM,p.topM])||p.topM<=p.bottomM)throw new Error('Invalid approach post');
        box(p.xM-s.postWidthM/2,p.bottomM,s.postWidthM,p.topM-p.bottomM,s.postWidthM,front,'door',`${componentName}/post-${i}`);
      }
    }
  }
  // Crown fields and roof closures are created after openings. Cut only native
  // wall hosts once they all exist; roofs, neighbors, ornaments and returns stay.
  if(recessed.length){
    group.updateMatrixWorld(true);
    for(const {facade,opening:o,depthM} of recessed){
      const inverse=facade.matrixWorld.clone().invert();let removed=0;
      group.traverse(child=>{
        if(!(child instanceof T.Mesh))return;
        const native=child.parent===group&&child.userData.surface==='wall'&&(child.name.startsWith('shell/')||child.name.startsWith('roof/step-wall'));
        const crown=child.parent===facade&&child.name===`crown/${recipe.house.gable.value}`;
        if(!native&&!crown)return;
        const cut=cutNativeFacadeAperture(child.geometry,inverse.clone().multiply(child.matrixWorld),{leftM:o.leftM,bottomM:o.bottomM,widthM:o.widthM,heightM:o.heightM,depthM});
        if(cut.geometry!==child.geometry){child.geometry.dispose();child.geometry=cut.geometry;}removed+=cut.removedAreaM2;
      });
      if(removed<.001)throw Error('Declared opening recess has no matching native host wall');
      facade.userData.nativeApertures=[...(facade.userData.nativeApertures??[]),{id:o.id,kind:'opening-recess',removedAreaM2:removed}];
    }
  }
  group.updateMatrixWorld(true);let triangles=0,meshes=0;
  group.traverse((o:T.Object3D)=>{if(o instanceof T.Mesh){meshes++;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)finite(p.getX(i),p.getY(i),p.getZ(i));triangles+=(o.geometry.index?.count??p.count)/3;}});
  const bounds=new T.Box3().setFromObject(group);
  const inputKey=canonical({recipe,componentVersions:CANALHOUSE_COMPONENT_VERSIONS});
  group.userData={recipeId:recipe.id,pandId:recipe.house.pandId,componentVersions:CANALHOUSE_COMPONENT_VERSIONS,simplifications:recipe.simplifications};
  return {group,componentVersions:CANALHOUSE_COMPONENT_VERSIONS,inputKey,stats:{triangles,meshes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}}};
}
