import * as T from 'three';

export interface CanalhouseEntranceCheeks {
 heightM:number;streetHeightM?:number;thicknessM:number;sides:('left'|'right')[];
 surface:'door'|'trim'|'stone'|'wall';coverLanding?:boolean;
}
/** Solid side panels follow an explicit straight top, not an inferred tread pattern. */
export function canalhouseEntranceCheeks(flight:{leftM:number;widthM:number;riseM:number;runM:number;backM:number},spec:CanalhouseEntranceCheeks,frontageWidthM:number){
 const street=spec.streetHeightM??spec.heightM;
 if(![flight.leftM,flight.widthM,flight.riseM,flight.runM,flight.backM,frontageWidthM,spec.heightM,street,spec.thicknessM].every(Number.isFinite)||flight.widthM<=0||flight.riseM<=0||flight.runM<=0||flight.backM<0||spec.heightM<=0||spec.heightM>3||street<=0||street>3||spec.thicknessM<=0||spec.thicknessM>.4||!spec.sides.length||new Set(spec.sides).size!==spec.sides.length||spec.sides.some(s=>s!=='left'&&s!=='right')||!['door','trim','stone','wall'].includes(spec.surface)||(spec.coverLanding!==undefined&&typeof spec.coverLanding!=='boolean'))throw Error('Invalid observed entrance cheeks');
 const near=spec.coverLanding ? .015 : flight.backM,far=flight.backM+flight.runM,top=flight.riseM+spec.heightM;
 return spec.sides.map(side=>{
  const left=side==='left'?flight.leftM-spec.thicknessM:flight.leftM+flight.widthM;
  if(left<0||left+spec.thicknessM>frontageWidthM)throw Error('Entrance cheek escapes frontage');
  const outline=new T.Shape([new T.Vector2(-near,0),new T.Vector2(-far,0),new T.Vector2(-far,street),new T.Vector2(-near,top)]);
  const geometry=new T.ExtrudeGeometry(outline,{depth:spec.thicknessM,bevelEnabled:false});
  geometry.rotateY(Math.PI/2);geometry.translate(left,0,0);
  return {side,leftM:left,widthM:spec.thicknessM,topM:Math.max(top,street),geometry};
 });
}
