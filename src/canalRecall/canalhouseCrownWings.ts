import type {CanalhousePoint} from './canalhouseRecipes';

/** Coarse paired wing masses follow the observed crown edge, without custom contours. */
export interface CanalhouseCrownWings {
 leftM:number;widthM:number;thicknessM:number;segments:number;gapM:number;
 bulgeM?:number;depthM:number;surface:'trim'|'stone';
}
export function canalhouseCrownWingProfiles(profile:CanalhousePoint[],facadeWidthM:number,w:CanalhouseCrownWings){
 const bulge=w.bulgeM??0;
 if(![facadeWidthM,w.leftM,w.widthM,w.thicknessM,w.gapM,w.depthM,bulge].every(Number.isFinite)||facadeWidthM<=0||w.leftM<0||w.widthM<=0||w.leftM+w.widthM>=facadeWidthM/2||w.thicknessM<=0||w.thicknessM>1||w.depthM<=0||w.depthM>.2||bulge<0||bulge>.6||!Number.isInteger(w.segments)||w.segments<1||w.segments>6||w.gapM<0||w.gapM*(w.segments-1)>=w.widthM||!['trim','stone'].includes(w.surface))throw Error('Invalid crown wing assembly');
 const height=(x:number)=>{
  const edge=profile.findIndex((p,i)=>i>0&&p[0]>profile[i-1][0]&&x>=profile[i-1][0]&&x<=p[0]);
  if(edge<0)throw Error('Crown wing escapes observed profile');
  const [a,b]=[profile[edge-1],profile[edge]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
 };
 const span=(w.widthM-w.gapM*(w.segments-1))/w.segments,result:{id:string;profile:CanalhousePoint[]}[]=[];
 for(let i=0;i<w.segments;i++){
  const left=w.leftM+i*(span+w.gapM),upper:CanalhousePoint[]=[],lower:CanalhousePoint[]=[];
  for(let j=0;j<=12;j++){
   const t=j/12,x=left+t*span,y=height(x),round=Math.sin(Math.PI*t);
   upper.push([x,y+bulge*round]);lower.push([x,y-w.thicknessM*round]);
  }
  const points=[...upper,...lower.reverse().slice(1,-1)];
  result.push({id:`left-${i}`,profile:points},{id:`right-${i}`,profile:points.map(([x,y])=>[facadeWidthM-x,y] as CanalhousePoint).reverse()});
 }
 return result;
}
