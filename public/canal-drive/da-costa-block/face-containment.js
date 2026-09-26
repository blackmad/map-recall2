/** Conservative containment for facade decorations, in facade-local metres. */
const EPS=1e-7;
function onSegment(point,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<EPS)return Math.hypot(point[0]-a[0],point[1]-a[1])<=EPS;
  return Math.abs((point[0]-a[0])*dy-(point[1]-a[1])*dx)<=EPS*length&&
    (point[0]-a[0])*dx+(point[1]-a[1])*dy>=-EPS*length&&
    (point[0]-b[0])*dx+(point[1]-b[1])*dy<=EPS*length;
}
function inRing(point,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];
    if(onSegment(point,a,b))return {inside:false,boundary:true};
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return {inside,boundary:false};
}
// Liang–Barsky against an inset rectangle: touching its perimeter is permitted,
// crossing its interior means a source boundary would pass through decoration.
function crossesInterior(a,b,rect){
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++){
    const min=rect[axis]+EPS,max=rect[axis+2]-EPS,delta=b[axis]-a[axis];
    if(min>=max)return false;
    if(Math.abs(delta)<EPS){if(a[axis]<=min||a[axis]>=max)return false;continue;}
    const first=(min-a[axis])/delta,last=(max-a[axis])/delta;
    lo=Math.max(lo,Math.min(first,last));hi=Math.min(hi,Math.max(first,last));
    if(lo>hi)return false;
  }
  return lo<=hi;
}
export function rectangleFitsFace(frame,t,y,width,height){
  if(![t,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  const rect=[t-width/2,y-height/2,t+width/2,y+height/2];
  if(frame.intervalBounded&&(rect[0]<-EPS||rect[2]>frame.width+EPS))return false;
  const rings=[frame.polygon,...(frame.holes||[])];
  if(rings.some(ring=>!Array.isArray(ring)||ring.length<3||ring.some(p=>!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite))))return false;
  const corners=[[rect[0],rect[1]],[rect[0],rect[3]],[rect[2],rect[1]],[rect[2],rect[3]]];
  if(corners.some(p=>{const hit=inRing(p,rings[0]);return !hit.inside&&!hit.boundary;}))return false;
  if(rings.slice(1).some(ring=>corners.some(p=>inRing(p,ring).inside)))return false;
  return !rings.some(ring=>ring.some((a,i)=>crossesInterior(a,ring[(i+1)%ring.length],rect)));
}
