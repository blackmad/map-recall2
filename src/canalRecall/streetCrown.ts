/** Street facade continuity on existing roof plates. Surveyed roof vertices stay authoritative. */
import type { ArchitecturalRecipe } from './streetAppearance.js';
import type { RoofTri } from './roofMesh.js';
export type StreetCrownFront = { start: [number,number]; end: [number,number]; normal: [number,number]; tint: [number,number,number]; plainLayer?:number; recipe:ArchitecturalRecipe; frameHex:string; glassHex:string };
export type StreetCrownTri = RoofTri & { facadeTint?:[number,number,number]; facadeLayer?:number };
type Point = [number,number];

function projection(front:StreetCrownFront) {
  const dx=front.end[0]-front.start[0],dy=front.end[1]-front.start[1],width=Math.hypot(dx,dy);
  return {width,ux:dx/width,uy:dy/width};
}
function matches(t:RoofTri,front:StreetCrownFront) {
  if(t.part!=='plate'||t.hex||Math.abs(t.n[2])>.1)return false;
  const n=Math.hypot(t.n[0],t.n[1]);if(!n||(t.n[0]*front.normal[0]+t.n[1]*front.normal[1])/n<.9)return false;
  const p=projection(front);if(p.width<2)return false;
  const cx=t.p.reduce((s,v)=>s+v[0],0)/3-front.start[0],cy=t.p.reduce((s,v)=>s+v[1],0)/3-front.start[1];
  const along=cx*p.ux+cy*p.uy,depth=cx*front.normal[0]+cy*front.normal[1];
  return Math.abs(depth)<.85&&along>=-.4&&along<=p.width+.4;
}
/** Horizontal intervals covered by actual plate triangles, including stepped crowns. */
function spans(triangles:Point[][],z:number):Point[] {
  const intervals:Point[]=[];
  for(const triangle of triangles){const xs:number[]=[];
    for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3];if(z<Math.min(a[1],b[1])-1e-7||z>Math.max(a[1],b[1])+1e-7)continue;
      if(Math.abs(a[1]-b[1])<1e-8)xs.push(a[0],b[0]);else xs.push(a[0]+(z-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
    if(xs.length>=2)intervals.push([Math.min(...xs),Math.max(...xs)]);
  }
  const merged:Point[]=[];
  for(const interval of intervals.sort((a,b)=>a[0]-b[0])){const previous=merged[merged.length-1];if(previous&&interval[0]<=previous[1]+1e-6)previous[1]=Math.max(previous[1],interval[1]);else merged.push([...interval]);}
  return merged;
}
function contained(triangles:Point[][],x0:number,x1:number,z0:number,z1:number):boolean {
  const heights=[z0,z1,(z0+z1)/2,...triangles.flatMap(t=>t.map(v=>v[1])).filter(z=>z>z0&&z<z1)];
  // Shape breaks, not just four corners: an inward step cannot cut a window.
  return heights.every(z=>spans(triangles,z).some(([a,b])=>x0>=a+.08&&x1<=b-.08));
}
function atticWindows(roof:readonly RoofTri[],front:StreetCrownFront,wallTop:number):RoofTri[] {
  if(!front.recipe.atticWindows||!['canal','c19'].includes(front.recipe.period))return [];
  const plates=roof.filter(t=>matches(t,front));if(!plates.length)return [];
  const p=projection(front),local=plates.map(t=>t.p.map(v=>[(v[0]-front.start[0])*p.ux+(v[1]-front.start[1])*p.uy,v[2]] as Point));
  const maxZ=Math.max(...local.flat().map(v=>v[1]));if(maxZ-wallTop<1.65)return [];
  const depths=plates.map(t=>t.p.reduce((s,v)=>s+(v[0]-front.start[0])*front.normal[0]+(v[1]-front.start[1])*front.normal[1],0)/3).sort((a,b)=>a-b);
  const depth=depths[Math.floor(depths.length/2)];
  const out:RoofTri[]=[],normal:[number,number,number]=[...front.normal,0];
  const rectangle=(x0:number,x1:number,z0:number,z1:number,hex:string,proud:number)=>{
    const point=(x:number,z:number):[number,number,number]=>[front.start[0]+p.ux*x+front.normal[0]*(depth+proud),front.start[1]+p.uy*x+front.normal[1]*(depth+proud),z];
    const a=point(x0,z0),b=point(x1,z0),c=point(x1,z1),d=point(x0,z1);
    out.push({p:[a,b,c],uv:[[0,0],[0,0],[0,0]],part:'decal',n:normal,hex},{p:[a,c,d],uv:[[0,0],[0,0],[0,0]],part:'decal',n:normal,hex});
  };
  const window=(x:number,z0:number,z1:number,width:number)=>{
    const x0=x-width/2,x1=x+width/2;if(!contained(local,x0,x1,z0,z1))return false;
    rectangle(x0,x1,z0,z1,front.frameHex,.016);
    rectangle(x0+.045,x1-.045,z0+.045,z1-.045,front.glassHex,.023);
    const transom=z0+(z1-z0)*.72;rectangle(x0+.045,x1-.045,transom-.018,transom+.018,front.frameHex,.029);return true;
  };
  const z0=wallTop+.35,z1=Math.min(wallTop+1.52,maxZ-.24),width=Math.min(.92,p.width*.17);
  const centers=p.width>=5.5?[p.width*.35,p.width*.65]:[p.width*.5];
  let placed=0;for(const center of centers)if(window(center,z0,z1,width))placed++;
  if(!placed)window(p.width*.5,z0,z1,Math.min(.82,width));
  // A sufficiently tall crown tapers to a single smaller attic opening.
  if(maxZ-wallTop>3.6)window(p.width*.5,wallTop+2.05,Math.min(wallTop+2.95,maxZ-.28),Math.min(.68,p.width*.12));
  return out;
}
/** Recolour only matching masonry faces; append contained, flat-colour attic glazing. */
export function streetCrown(roof:readonly RoofTri[],fronts:readonly StreetCrownFront[],wallTop:number,windowsAllowed:boolean):StreetCrownTri[] {
  if(!fronts.length)return [...roof];
  const result:StreetCrownTri[]=roof.map(t=>{const front=fronts.find(f=>matches(t,f));return front?{...t,facadeTint:front.tint,facadeLayer:front.plainLayer}:t;});
  if(windowsAllowed)for(const front of fronts)result.push(...atticWindows(roof,front,wallTop));
  return result;
}
