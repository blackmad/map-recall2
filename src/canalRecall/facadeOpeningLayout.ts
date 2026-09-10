/** Provisional opening layout. Heights share the source wall datum, not world zero. */
// @ts-expect-error Existing browser containment module has no separate declarations.
import { rectangleFitsFace } from '../../public/canal-drive/da-costa-block/face-containment.js';

export interface OpeningFrame {
  width:number; bottom:number; top:number; intervalBounded?:boolean;
  polygon:number[][]; holes?:number[][][];
}
export interface OpeningRectangle {t:number;y:number;width:number;height:number}
export interface FacadeOpening extends OpeningRectangle {
  floor:number;bay:number;isDoor:boolean;rect:OpeningRectangle;
}
export interface OpeningLayout {
  base:number;floorHeight:number;openings:FacadeOpening[];belt:OpeningRectangle|null;
}
export interface OpeningRhythm {floors:number;bays:number;windowWidth:number;windowHeight:number}

export function facadeOpeningLayout(frame:OpeningFrame,{floors,bays,windowWidth,windowHeight}:OpeningRhythm):OpeningLayout{
  if(![frame.width,frame.bottom,frame.top,windowWidth,windowHeight].every(Number.isFinite)||frame.width<=0||frame.top<=Math.max(.2,frame.bottom)||windowWidth<=0||windowHeight<=0||![floors,bays].every(n=>Number.isInteger(n)&&n>0&&n<=100))throw Error('Invalid facade opening dimensions');
  const base=Math.max(.2,frame.bottom),floorHeight=(frame.top-base)/floors;
  const openings:FacadeOpening[]=[];
  for(let floor=0;floor<floors;floor++)for(let bay=0;bay<bays;bay++){
    const isDoor=floor===0&&(bay===0||bays>3&&bay===bays-1);
    const width=isDoor?Math.min(1.05,windowWidth):windowWidth,height=isDoor?2.6:windowHeight;
    const t=(bay+.5)*frame.width/bays,y=isDoor?base+1.42:base+.05+(floor+.48)*floorHeight;
    // Reserve the outer frame, and the sill on windows. No orphan handles/frames.
    const rect={t,y:isDoor?y:y-.045,width:width+(isDoor ? .20 : .35),height:height+(isDoor ? .19 : .28)};
    if(!rectangleFitsFace(frame,rect.t,rect.y,rect.width,rect.height))continue;
    openings.push({floor,bay,isDoor,t,y,width,height,rect});
  }
  const ground=openings.filter(o=>o.floor===0),upper=openings.filter(o=>o.floor>0);
  const low=Math.max(base,...ground.map(o=>o.rect.y+o.rect.height/2))+.12;
  const high=Math.min(frame.top-.5,...upper.map(o=>o.rect.y-o.rect.height/2))-.12;
  const height=.18,y=(low+high)/2;
  const belt=ground.length&&high-low>=height&&rectangleFitsFace(frame,frame.width/2,y,frame.width,height)
    ?{t:frame.width/2,y,width:frame.width,height}:null;
  return {base,floorHeight,openings,belt};
}

export function overlapsOpening(rect:OpeningRectangle,openings:readonly FacadeOpening[]):boolean{
  return openings.some(({rect:o})=>Math.abs(rect.t-o.t)<(rect.width+o.width)/2-1e-7&&Math.abs(rect.y-o.y)<(rect.height+o.height)/2-1e-7);
}
