import type {CanalhouseOpeningGroup} from '../../src/canalRecall/canalhouseOpeningGroups.ts';
import type {CanalhouseOpeningTemplateSelection} from '../../src/canalRecall/canalhouseOpeningTemplates.ts';
import type {StoepPoint} from './stoep-profile.ts';

export type FrameDefinition=CanalhouseOpeningGroup['frame']|CanalhouseOpeningTemplateSelection;
export type FrameSelection=FrameDefinition|{use:string;overrides?:CanalhouseOpeningTemplateSelection['overrides']};
export function selectFrame(frame:FrameSelection,sets:Record<string,FrameDefinition>):FrameDefinition {
 if(!('use' in frame))return frame;
 if(!Object.prototype.hasOwnProperty.call(sets,frame.use))throw Error(`Unknown house frame: ${frame.use}`);
 const selected=structuredClone(sets[frame.use]);
 if(!frame.overrides)return selected;
 return 'template' in selected?{...selected,overrides:{...selected.overrides,...structuredClone(frame.overrides)}}:{...selected,...structuredClone(frame.overrides)};
}
/** Samples describe a coarse straight envelope, never a physical tread count. */
export interface LinearContour {from:StoepPoint;to:StoepPoint;segments:number;roundDigits?:number;mode?:'linear'|'steps'}
/** Subdivision preserves the observed polyline; samples never imply treads. */
export interface PolylineContour {points:readonly StoepPoint[];segmentsPerSpan:number}
export function expandContour(profile:readonly StoepPoint[]|LinearContour|PolylineContour|null):readonly StoepPoint[]|null {
 if(profile===null||Array.isArray(profile))return profile as readonly StoepPoint[]|null;
 if('points' in profile){
  const {points,segmentsPerSpan:n}=profile;
  if(points.length<2||points.length>128||!Number.isInteger(n)||n<1||n>128||points.some((p,i)=>p.length!==2||!p.every(Number.isFinite)||(i>0&&p[0]<=points[i-1][0])))throw Error('Invalid coarse polyline contour');
  return points.slice(0,-1).flatMap((a,i)=>Array.from({length:n},(_,j)=>[a[0]+(points[i+1][0]-a[0])*j/n,a[1]+(points[i+1][1]-a[1])*j/n] as StoepPoint)).concat([points.at(-1)!]);
 }
 const p=profile as LinearContour;
 if(![...p.from,...p.to].every(Number.isFinite)||p.from.length!==2||p.to.length!==2||p.from[0]>=p.to[0]||!Number.isInteger(p.segments)||p.segments<1||p.segments>128||p.roundDigits!==undefined&&(!Number.isInteger(p.roundDigits)||p.roundDigits<0||p.roundDigits>12))throw Error('Invalid coarse linear contour');
 const round=(v:number)=>p.roundDigits===undefined?v:Number(v.toFixed(p.roundDigits));
 if(p.mode!==undefined&&p.mode!=='linear'&&p.mode!=='steps')throw Error('Unknown coarse contour drawing mode');
 if(p.mode==='steps'){
  if(p.from[1]===p.to[1])throw Error('Stepped contour requires an observed rise or descent');
  const points:StoepPoint[]=[[round(p.from[0]),round(p.from[1])]];
  for(let i=1;i<=p.segments;i++){
   const x=round(p.from[0]+(p.to[0]-p.from[0])*i/p.segments);
   points.push([x,round(p.from[1]+(p.to[1]-p.from[1])*(i-1)/p.segments)],
               [x,round(p.from[1]+(p.to[1]-p.from[1])*i/p.segments)]);
  }
  return points;
 }
 return Array.from({length:p.segments+1},(_,i)=>[round(p.from[0]+(p.to[0]-p.from[0])*i/p.segments),round(p.from[1]+(p.to[1]-p.from[1])*i/p.segments)] as StoepPoint);
}
