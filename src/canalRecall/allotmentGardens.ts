/** Approximate gardens on pre-screened OSM clear ground. No inferred cadastral boundaries. */
import patches from './allotmentGardenPatches.json';
import { ExtraSink, hash01, type FlatTri, type V3, type WallFrame } from './facadeExtraCore.js';
const planting=patches as Record<string,number[][]>;
const LAWNS=['#91a674','#9bab7d','#879d6c','#a5b78a','#94aa79'];
const LEAVES=['#526d3d','#6c8249','#3f603e','#7c8d52'];
export function allotmentGardenTriangles(id:string,origin:{lng:number;lat:number},coarse=false):FlatTri[]{
 const sink=new ExtraSink(3000),kx=111320*Math.cos(origin.lat*Math.PI/180),tone=Math.floor(hash01(`${id}:lawn`)*LAWNS.length);
 for(const [lng,lat,angle,kind,seed] of planting[id]??[]){
  const a=angle*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),x=(lng-origin.lng)*kx,y=(lat-origin.lat)*110540;
  const f:WallFrame={x0:x,y0:y,ux,uy,nx:-uy,ny:ux,len:4};
  const P=(u:number,v:number,z:number):V3=>[x+ux*u-uy*v,y+uy*u+ux*v,z];
  // Horizontal plates have their own upward normal (wallQuad is vertical).
  const ground=(u0:number,u1:number,v0:number,v1:number,z:number,hex:string)=>{
   const p=[P(u0,v0,z),P(u1,v0,z),P(u1,v1,z),P(u0,v1,z)];sink.tris.push({p:[p[0],p[1],p[2]],hex,n:[0,0,1]},{p:[p[0],p[2],p[3]],hex,n:[0,0,1]});
  };
  ground(-2,2,-2,2,.035,LAWNS[tone]);
  const leaf=LEAVES[seed%LEAVES.length];
  const bush=(u:number,v:number,r:number,h:number)=>{
   const top=P(u,v,h),base=P(u,v,.12);const ring=Array.from({length:6},(_,i)=>P(u+Math.cos(i*Math.PI/3)*r,v+Math.sin(i*Math.PI/3)*r,h*.5));
   const emit=(p:V3[])=>{const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),n:V3=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);sink.tris.push({p,hex:leaf,n:n.map(q=>q/l) as V3});};
   for(let i=0;i<6;i++){const j=(i+1)%6;emit([ring[i],ring[j],top]);if(!coarse)emit([ring[j],ring[i],base]);}
  };
  if(kind===1){bush(-.7,-.5,.95,1.5+seed/1600);bush(.8,.65,.75,1.1);}
  else if(kind===2){
   ground(-1.5,1.5,-1.35,1.35,.055,'#766748');
   for(let v=-.95;v<=1;v+=.65)sink.box(f,-1.35,1.35,v-.13,v+.13,.07,.24,'#607b43',false,true);
  }else if(kind===3){
   ground(-1.45,1.45,-1.3,1.3,.055,'#6e8150');bush(.6,.5,.85,.7);
   for(const [u,v] of [[-.85,-.65],[-.75,.55],[.75,-.8]])sink.box(f,u-.24,u+.24,v-.24,v+.24,.14,.38,['#bdab74','#a17a8d','#c7b5a0'][seed%3],false,true);
  }else if(kind===4){
   sink.box(f,-1.7,1.7,-1.5,-.8,.05,.9,leaf,false,true);bush(.8,.7,.8,1.45);
  }
  // Keep each coarse garden recognisable while reducing hidden canopy faces.
 }
 return sink.tris;
}
