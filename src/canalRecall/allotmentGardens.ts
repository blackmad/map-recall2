/** Approximate lush planting on pre-screened OSM clear ground.
 * Four-metre source-screening cells are placement bounds, never visible garden tiles.
 */
import patches from './allotmentGardenPatches.json';
import { hash01, type FlatTri, type V3 } from './facadeExtraCore.js';
const planting=patches as Record<string,number[][]>;
const LEAVES=['#628747','#78984f','#4e7c42','#85a55e','#698f50'];
const BLOOMS=['#ddb1cb','#d9cc83','#e5ddd0','#aa9ac7'];
export function allotmentGardenTriangles(id:string,origin:{lng:number;lat:number},coarse=false):FlatTri[]{
 const tris:FlatTri[]=[],kx=111320*Math.cos(origin.lat*Math.PI/180);
 for(const [lng,lat,angle,kind,seed] of planting[id]??[]){
  const a=angle*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),x=(lng-origin.lng)*kx,y=(lat-origin.lat)*110540;
  const P=(u:number,v:number,z:number):V3=>[x+ux*u-uy*v,y+uy*u+ux*v,z];
  const emit=(p:V3[],hex:string)=>{const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),n:V3=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);if(l>1e-8)tris.push({p,hex,n:n.map(q=>q/l) as V3});};
  const leaf=LEAVES[Math.floor(hash01(`${id}:${seed}:leaves`)*LEAVES.length)];
  // Broad, rounded crowns. No pointed cones, brown soil tiles, or exposed grid floors.
  const bush=(u:number,v:number,r:number,h:number,colour=leaf)=>{
   const sides=coarse?4:5,phase=seed/1000,levels=[[.06,.82],[h*.48,1],[h*.83,.72]];
   const rings=levels.map(([z,scale])=>Array.from({length:sides},(_,i)=>P(u+Math.cos(i*Math.PI*2/sides+phase)*r*scale,v+Math.sin(i*Math.PI*2/sides+phase)*r*scale,z)));
   for(let k=0;k<2;k++)for(let i=0;i<sides;i++){const j=(i+1)%sides;emit([rings[k][i],rings[k][j],rings[k+1][j]],colour);emit([rings[k][i],rings[k+1][j],rings[k+1][i]],colour);}
   for(let i=0;i<sides;i++)emit([rings[2][i],rings[2][(i+1)%sides],P(u,v,h)],colour);
  };
  const jitter=(seed%11-5)*.035;
  if(kind===0){
   // Some open lawn between denser borders keeps the gardens from becoming a forest.
   if(seed%3) bush(jitter,0,1.85,1.1);
  }else if(kind===4){
   // Joined hedge crowns, rather than a rectangular dark slab.
   for(const u of [-.8,0,.8])bush(u,-.75,1.15,1.25);
   bush(.75,.9,1.05,1.35);
  }else{
   bush(-.15+jitter,-.2,1.65,kind===1?1.95:1.3);
   bush(.85,.8,1.1,kind===1?1.6:.9,LEAVES[(seed+2)%LEAVES.length]);
   if(kind===3||kind===2&&seed%3===0){
    // Small blossom clusters sit inside the leaf mass; planting remains predominantly green.
    for(const [u,v] of (coarse?[[.85,.8]]:[[.35,.65],[1.1,.8]]))bush(u,v,.3,.85,BLOOMS[seed%BLOOMS.length]);
   }
  }
 }
 return tris;
}
