import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import data from './pathe-de-munt-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
export type Decal=(g:T.BufferGeometry,hex:string)=>void;
export type PatheRole='shell'|'facade'|'detail'|'sign';

/** Pathé de Munt (Vijzelstraat 15, 2001), BAG pand 0363100012179384.
 *
 * Massing behind the street wall is the 3DBAG LoD2.2 roof set skirted to the ground. The
 * Vijzelstraat (west) frontage, 20.1 m between the two neighbours, is authored as folded planes
 * measured off the rectified 2022 municipal panorama (50 px/m):
 *  - three proud grey-brick blocks with sloping tops that step down towards the south
 *    (left block 14.3 -> 10.5 m, middle fin 9.2 -> 7.1 m, low fin 5.9 -> 4.9 m);
 *  - behind them a recessed back wall, and above them big triangular facets that fold from
 *    the 17.3 m street-line parapet down and inward to the recess (the dark, shadowed area
 *    in every photo). The facets stay below the 3DBAG parapet slope (17.3 m at the street
 *    line, 15.2 m 2.5 m in), so nothing pokes through the surveyed roof;
 *  - a deeper, tall glazed entrance slot between the middle fin and the full-height south
 *    block, lit warm, with an angled glass screen at its foot;
 *  - the full-height south block carrying the freestanding vertical PATHÉ blade sign on
 *    brackets, rising above the parapet;
 *  - poster cases either side, doors, and diagonal rows of small point lights that follow
 *    the facet slopes.
 * Facade coordinates: U metres along the wall from its north end (left as seen from the
 * street), y up, d metres inward from the street line.
 */
export function buildPatheDeMunt(_w:number,_d:number,b:BuildingTools,decal?:Decal,tag?:(g:T.BufferGeometry,role:PatheRole)=>void){
 const ring=data.ring[0],A=ring[1],C=ring[2];
 const L=Math.hypot(C[0]-A[0],C[1]-A[1]),t=[(C[0]-A[0])/L,(C[1]-A[1])/L],inward=[t[1],-t[0]];
 // inward must point away from Vijzelstraat (east); the front edge runs north -> south.
 if(inward[0]<0)throw Error('Pathé facade frame: unexpected wall orientation');
 const P=(U:number,y:number,d:number)=>new T.Vector3(A[0]+t[0]*U+inward[0]*d,y,A[1]+t[1]*U+inward[1]*d);
 const role=(g:T.BufferGeometry,r:PatheRole)=>{g.userData.role=r;tag?.(g,r);return g};
 const fromTris=(tris:T.Vector3[][],hint:T.Vector3)=>{const pos:number[]=[];
  for(const tr of tris){const n=tr[1].clone().sub(tr[0]).cross(tr[2].clone().sub(tr[0]));if(n.lengthSq()<1e-10)continue;const o=n.dot(hint)<0?[tr[0],tr[2],tr[1]]:tr;for(const v of o)pos.push(v.x,v.y,v.z)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g};
 // Convex polygon in facade coords, fan-triangulated; hint is a facade-space direction the face should look toward.
 const dirOf=(dU:number,dy:number,dd:number)=>P(dU,dy,dd).sub(P(0,0,0));
 const poly=(pts:number[][],c:Colour,hint:number[],r:PatheRole='facade')=>{const v=pts.map(p=>P(p[0],p[1],p[2]));const tris=[] as T.Vector3[][];for(let i=1;i+1<v.length;i++)tris.push([v[0],v[i],v[i+1]]);b.add(role(fromTris(tris,dirOf(hint[0],hint[1],hint[2])),r),c)};
 // Axis-aligned box in facade space: U0..U1, y0..y1, d0..d1 (d negative = in front of the street line).
 const fbox=(U0:number,U1:number,y0:number,y1:number,d0:number,d1:number,c:Colour,r:PatheRole='detail')=>{
  const g=new T.BoxGeometry(U1-U0,y1-y0,d1-d0);g.translate((U0+U1)/2,(y0+y1)/2,(d0+d1)/2);
  const m=new T.Matrix4().makeBasis(dirOf(1,0,0),new T.Vector3(0,1,0),dirOf(0,0,1)).setPosition(P(0,0,0));g.applyMatrix4(m);
  // the basis is left-handed (U south, d east): flip winding back so normals face out
  const idx=g.index!.array as Uint16Array;for(let i=0;i<idx.length;i+=3){const k=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=k}
  g.computeVertexNormals();b.add(role(g,r),c)};
 // Flat quad lying on a facade-space plane (corner + two edge vectors), lifted `lift` along the normal toward hint.
 const quadOn=(o:T.Vector3,e1:T.Vector3,e2:T.Vector3,hint:T.Vector3,lift=.02)=>{const n=e1.clone().cross(e2).normalize();if(n.dot(hint)<0)n.negate();const q=o.clone().addScaledVector(n,lift);
  const v=[q,q.clone().add(e1),q.clone().add(e1).add(e2),q.clone().add(e2)];return fromTris([[v[0],v[1],v[2]],[v[0],v[2],v[3]]],hint)};
 const light=(g:T.BufferGeometry,hex:string,fallback:Colour)=>{role(g,'detail');if(decal)decal(g,hex);else b.add(g,fallback)};

 // ---- 3DBAG massing; the street-line walls are replaced by the authored folded frontage.
 const onFront=(p:number[])=>{const dx=p[0]-A[0],dz=p[2]-A[1];return Math.abs(dx*inward[0]+dz*inward[1])<.6&&dx*t[0]+dz*t[1]>-.6&&dx*t[0]+dz*t[1]<L+.6};
 const shellTools={...b,add:(g:T.BufferGeometry,c:Colour,...rest:number[])=>b.add(role(g,'shell'),c,...rest)} as BuildingTools;
 surveyShell(shellTools,data,'greyBrick','slate',{skipWall:(p,q)=>onFront(p)&&onFront(q)});

 // ---- Folded street frontage.
 const U0=.85,U1=L-.02,TOP=17.3,D=3.5,DS=6,SPLIT=14;
 const W=[0,0,-1],UP=[0,1,0];
 const G0=[U0,12.8,D],G1=[5.9,9.0,D],G2=[7.6,8.0,D],G3=[10.8,5.9,D],SL=[10.8,11,DS],SR=[SPLIT,11,DS];
 const T0=[U0,TOP,0],Ta=[4.5,TOP,0],Tb=[9.0,TOP,0],T1=[SPLIT,TOP,0];
 const leftTop=(U:number)=>14.3+(U-U0)*(10.5-14.3)/(5.9-U0),midTop=(U:number)=>9.2+(U-7.6)*(7.1-9.2)/(10.8-7.6),lowTop=(U:number)=>5.9+(U-11.7)*(4.9-5.9)/(SPLIT-11.7);
 // Big folded facets from the parapet line down into the recess (face the street and down).
 const fold=(a:number[],c:number[],e:number[])=>poly([a,c,e],'greyBrick',[0,-.4,-1]);
 fold(T0,G0,G1);fold(T0,G1,Ta);fold(Ta,G1,G2);fold(Ta,G2,Tb);fold(Tb,G2,G3);fold(Tb,G3,SL);fold(Tb,SL,T1);fold(T1,SL,SR);
 // North end closure against the neighbour (party wall plane).
 poly([[U0,0,0],[U0,0,D],G0,T0],'greyBrick',[-1,0,0]);
 // Left block: front, sloping top (falls back to the fold), south side.
 poly([[U0,0,0],[5.9,0,0],[5.9,10.5,0],[U0,14.3,0]],'greyBrick',W);
 poly([[U0,14.3,0],[5.9,10.5,0],G1,G0],'greyBrick',[0,1,-.2]);
 poly([[5.9,0,0],[5.9,0,D],G1,[5.9,10.5,0]],'greyBrick',[1,0,0]);
 // Recessed back wall in the north entrance gap.
 poly([[5.9,0,D],[7.6,0,D],G2,G1],'greyBrick',W);
 // Middle fin.
 poly([[7.6,0,0],[10.8,0,0],[10.8,7.1,0],[7.6,9.2,0]],'greyBrick',W);
 poly([[7.6,0,0],[7.6,0,D],G2,[7.6,9.2,0]],'greyBrick',[-1,0,0]);
 poly([[10.8,0,0],[10.8,0,D],G3,[10.8,7.1,0]],'greyBrick',[1,0,0]);
 poly([[7.6,9.2,0],[10.8,7.1,0],G3,G2],'greyBrick',[0,1,-.2]);
 // Tall entrance slot: north side, back wall (behind the glazing), south side = south block flank.
 poly([[10.8,0,D],[10.8,0,DS],SL,G3],'greyBrick',[1,0,0]);
 poly([[10.8,0,DS],[SPLIT,0,DS],SR,SL],'dark',W);
 poly([[SPLIT,0,0],[SPLIT,0,DS],SR,T1],'greyBrick',[-1,0,0]);
 // Low fin in front of the slot, leaning on the south block flank.
 poly([[11.7,0,0],[SPLIT,0,0],[SPLIT,4.9,0],[11.7,5.9,0]],'greyBrick',W);
 poly([[11.7,0,0],[11.7,0,D],[11.7,5.9,D],[11.7,5.9,0]],'greyBrick',[-1,0,0]);
 poly([[11.7,5.9,0],[SPLIT,4.9,0],[SPLIT,4.9,D],[11.7,5.9,D]],'greyBrick',UP);
 poly([[11.7,0,D],[SPLIT,0,D],[SPLIT,4.9,D],[11.7,5.9,D]],'greyBrick',[0,0,1]);
 // Full-height south block.
 poly([[SPLIT,0,0],[U1,0,0],[U1,TOP,0],[SPLIT,TOP,0]],'greyBrick',W);
 // South end closure against the neighbour, under the surveyed parapet slope.
 poly([[U1,0,0],[U1,0,2.5],[U1,15.2,2.5],[U1,TOP,0]],'greyBrick',[1,0,0]);

 // ---- Glazing and doors.
 const warm='#f3c46a';
 // north gap: glass doors and the first-floor window on the back wall
 fbox(6.0,7.5,0,2.9,D-.06,D,'dark');fbox(6.1,7.4,.05,2.8,D-.09,D-.06,'glass');fbox(6.0,7.5,3.3,5.2,D-.06,D,'dark');fbox(6.1,7.4,3.4,5.1,D-.09,D-.06,'glass');
 // slot: warm lit glazing over the back wall and an angled glass screen at its foot
 light(quadOn(P(10.9,.05,DS),dirOf(SPLIT-.1-10.9,0,0),dirOf(0,10.6,0),dirOf(0,0,-1),.03),warm,'gold');
 b.add(role(quadOn(P(10.8,0,DS),dirOf(SPLIT-10.8,0,0),dirOf(0,3.6,-1.9),dirOf(0,.3,-1),.0),'detail'),'glass');
 for(const U of [11.6,12.6,13.6])fbox(U-.05,U+.05,0,3.6,DS-1.9,DS,'frame');
 // white-framed doors (left block, middle fin)
 for(const [a,c,h] of [[4.1,5.2,3.5],[9.4,10.4,2.4]]){fbox(a,c,0,h,-.06,0,'white');fbox(a+.12,c-.12,0,h-.12,-.08,-.06,'dark')}
 // poster cases: lit posters in dark frames, left of the north gap and right of the slot
 const posterHex=['#2f5e8c','#c9772e','#8c2f2f','#d8b23a','#3c6f4f','#6b3f86'];
 for(const [u0,u1] of [[1.0,3.0],[14.3,16.75]]){fbox(u0,u1,.8,3.15,-.12,0,'dark');const cw=(u1-u0-.2)/3;
  for(let r=0;r<2;r++)for(let k=0;k<3;k++)light(quadOn(P(u0+.1+k*cw+.04,.9+r*1.15,-.12),dirOf(cw-.08,0,0),dirOf(0,1.05,0),dirOf(0,0,-1),.01),posterHex[(r*3+k+(u0>10?2:0))%6],'gold')}
 for(const [U,y] of [[8.7,1.0],[13.1,1.0]])light(quadOn(P(U,y,0),dirOf(.6,0,0),dirOf(0,.85,0),dirOf(0,0,-1),.02),'#e8c43c','gold');

 // ---- Diagonal rows of point lights following the facet slopes.
 const dot=.14,lampHex='#fff2cc';
 const dotsOnFront=(Ua:number,Ub:number,top:(U:number)=>number,yMin:number)=>{
  for(let row=1;;row++){const drop=row*1.25;if(top(Ua)-drop<yMin&&top(Ub)-drop<yMin)break;
   for(let U=Ua+.45+(row%2)*.35;U<Ub-.3;U+=.7){const y=top(U)-drop;if(y<yMin)continue;light(quadOn(P(U,y,0),dirOf(dot,0,0),dirOf(0,dot,0),dirOf(0,0,-1),.02),lampHex,'white')}}};
 dotsOnFront(U0,5.9,leftTop,4.2);dotsOnFront(7.6,10.8,midTop,3.0);
 // and across the folded facets above, rows parallel to their lower edges
 const dotsOnFacet=(a:number[],c:number[],e:number[],rows:number)=>{const pa=P(a[0],a[1],a[2]),pc=P(c[0],c[1],c[2]),pe=P(e[0],e[1],e[2]);
  for(let r=1;r<=rows;r++){const s=r/(rows+1);const l0=pe.clone().lerp(pa,s),l1=pe.clone().lerp(pc,s),len=l0.distanceTo(l1),n=Math.floor(len/.8);
   for(let i=1;i<n;i++){const p=l0.clone().lerp(l1,i/n),e1=l1.clone().sub(l0).setLength(dot),e2=pe.clone().sub(p).setLength(dot);
    light(quadOn(p,e1,e2,dirOf(0,-.4,-1),.02),lampHex,'white')}}};
 // rows run parallel to the fold edge (G-side), stepping up toward the parapet apex
 dotsOnFacet(G1,G0,T0,3);dotsOnFacet(G2,G1,Ta,4);dotsOnFacet(G3,G2,Tb,4);dotsOnFacet(SL,G3,Tb,3);

 // ---- Vertical PATHÉ blade sign on brackets in front of the south block.
 const SU0=16.0,SU1=17.4,SY0=6.1,SY1=22.6,SD0=-.85,SD1=-.5;
 fbox(SU0,SU1,SY0,SY1,SD0,SD1,'white','sign');
 for(const y of [6.6,11.5,16.4])fbox(SU0+.45,SU1-.45,y,y+.35,SD1,0,'frame','sign');
 const glyph:Record<string,string[]>={P:['11110','10001','10001','11110','10000','10000','10000'],A:['01110','10001','10001','11111','10001','10001','10001'],T:['11111','00100','00100','00100','00100','00100','00100'],H:['10001','10001','10001','11111','10001','10001','10001'],E:['11111','10000','10000','11110','10000','10000','11111']};
 const px=.22,step=1.95,letterHex='#e8a51c';let top=19.6;
 for(const ch of 'PATHE'){const rows=glyph[ch];const Ul=(SU0+SU1)/2-2.5*px;
  for(let j=0;j<7;j++){let k=0;while(k<5){if(rows[j][k]!=='1'){k++;continue}let e=k;while(e<5&&rows[j][e]==='1')e++;
   const y=top-(j+1)*px;fbox(Ul+k*px,Ul+e*px,y,y+px,SD0-.05,SD0,'gold','sign');k=e}}
  if(ch==='E')fbox(Ul+2*px,Ul+4*px,top+.12,top+.12+px*.8,SD0-.05,SD0,'gold','sign'); // acute accent
  top-=step}
 // Pathé rooster-and-oval logo at the foot of the blade
 fbox(SU0+.25,SU1-.25,6.9,7.7,SD0-.04,SD0,'gold','sign');fbox(SU0+.4,SU1-.4,7.05,7.55,SD0-.07,SD0-.04,'dark','sign');
}
