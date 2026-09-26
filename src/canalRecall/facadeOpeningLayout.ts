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

/** Clockwise outline, shared by glazing and curved joinery. A masonry lintel
 * is separate evidence and must not turn rectangular glass into an arch. */
export function openingProfile(width:number,height:number,head='rectangular',archRise?:number,topCornerRadius?:number):number[][] {
  const w=width/2,b=-height/2,top=height/2;
  if(head==='rectangular'&&Number.isFinite(topCornerRadius)&&topCornerRadius!>0){
    const radius=Math.min(width,height)*topCornerRadius!,right=Array.from({length:5},(_,i)=>{const a=i*Math.PI/8;return [w-radius+Math.cos(a)*radius,top-radius+Math.sin(a)*radius];}),left=Array.from({length:5},(_,i)=>{const a=Math.PI/2+i*Math.PI/8;return [-w+radius+Math.cos(a)*radius,top-radius+Math.sin(a)*radius];});
    return [[-w,b],[w,b],[w,top-radius],...right.slice(1),...left.slice(1),[-w,top-radius]];
  }
  if (!['rounded','segmental'].includes(head)) return [[-w,b],[w,b],[w,top],[-w,top]];
  // The photographed rise is optional for legacy records. When present it is
  // a fraction of opening height, which distinguishes shallow segmental heads
  // from tall round arches without changing a rectangular glazed opening.
  const measured=Number.isFinite(archRise)&&archRise!>0&&archRise!<=.5 ? height*archRise! : undefined;
  const rise=Math.min(measured??(head==='rounded'?w:width*.2),height*.5),spring=top-rise;
  const arc=Array.from({length:13},(_,i)=>{const a=i*Math.PI/12;return [Math.cos(a)*w,spring+Math.sin(a)*rise];});
  return [[-w,b],[w,b],...arc];
}

/** Horizontal material bars are clipped to the actual glazed profile. */
export function profileHorizontalSpans(profile:number[][],y:number):[number,number][] {
  const hits:number[]=[];
  for(let i=0;i<profile.length;i++){
    const a=profile[i],b=profile[(i+1)%profile.length];
    if((a[1]<=y&&y<b[1])||(b[1]<=y&&y<a[1])) hits.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
  }
  hits.sort((a,b)=>a-b);const spans:[number,number][]=[];
  for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>.001)spans.push([hits[i],hits[i+1]]);
  return spans;
}
/** Vertical material bars are clipped at the curved head rather than running
 * through its exterior masonry. */
export function profileVerticalSpan(profile:number[][],x:number):[number,number]|null {
  const hits:number[]=[];
  for(let i=0;i<profile.length;i++){
    const a=profile[i],b=profile[(i+1)%profile.length];
    if((a[0]<=x&&x<b[0])||(b[0]<=x&&x<a[0])) hits.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
  }
  if(hits.length<2)return null;hits.sort((a,b)=>a-b);return [hits[0],hits[hits.length-1]];
}

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
