import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Approximate the current rounded BOOM logo and compact bold sans CHICAGO.
 * Arcam2021 reference; no exact typeface claimed. All glyphs are native curves. */
export function boomChicagoSignage(b:BuildingTools,cx:number,front:(x:number)=>number,angle:number){
 const emit=(s:T.Shape,x:number,y:number,scale:number)=>{const g=new T.ExtrudeGeometry(s,{depth:.012,bevelEnabled:false,curveSegments:10});g.scale(scale,scale,1);g.rotateY(angle);g.userData.role='boom-real-sign';b.add(g,'red',x,y,front(x)+.416);};
 const ring=(rx:number,ry:number,t:number,start=0,end=Math.PI*2)=>{const s=new T.Shape();s.absellipse(0,0,rx,ry,start,end,false,0);if(end-start>6){const p=new T.Path();p.absellipse(0,0,rx-t,ry-t,0,Math.PI*2,true,0);s.holes.push(p);}else{s.lineTo((rx-t)*Math.cos(end),(ry-t)*Math.sin(end));s.absellipse(0,0,rx-t,ry-t,end,start,true,0);s.closePath();}return s;};
 const polygon=(p:number[][])=>{const s=new T.Shape();p.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;};
 const rect=(x:number,y:number,w:number,h:number)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 const baseline=4.15;
 // Each oversized circular O, rounded B lobes and compact M follows the logo's
 // observed silhouette. Separate counter holes preserve the heavy rounded feel.
 const bx=cx-3.69;
 const B=new T.Shape();B.moveTo(0,0);B.lineTo(.24,0);B.bezierCurveTo(.66,0,.67,.47,.38,.49);B.bezierCurveTo(.67,.52,.63,.94,.24,.94);B.lineTo(0,.94);B.closePath();for(const yy of [.22,.65]){const p=new T.Path();p.absellipse(.24,yy,.09,.1,0,Math.PI*2,true,0);B.holes.push(p);}emit(B,bx,baseline,.4);
 emit(ring(.48,.47,.22),bx+.49,baseline+.188,.4);emit(ring(.48,.47,.22),bx+.89,baseline+.188,.4);
 emit(polygon([[0,0],[0,.94],[.23,.94],[.49,.54],[.75,.94],[.98,.94],[.98,0],[.73,0],[.73,.49],[.49,.16],[.25,.49],[.25,0]]),bx+1.11,baseline,.4);
 // CHICAGO glyphs use continuous broad strokes, rounded C/G/O curves and
 // triangular A counter; no square pixel matrix.
 const glyph=(ch:string,x:number)=>{const scale=.33,put=(s:T.Shape)=>emit(s,x,baseline+.02,scale);
  if(ch==='C'||ch==='G'){const s=ring(.34,.43,.11,.26*Math.PI,1.74*Math.PI);emit(s,x+.35*scale,baseline+.02+.43*scale,scale);if(ch==='G'){put(rect(.35,.31,.34,.11));put(rect(.58,.31,.11,.25));}}
  if(ch==='O'){const s=ring(.34,.43,.11);emit(s,x+.35*scale,baseline+.02+.43*scale,scale);}
  if(ch==='I')put(rect(.04,0,.12,.86));
  if(ch==='H'){put(rect(0,0,.12,.86));put(rect(.51,0,.12,.86));put(rect(.1,.36,.45,.12));}
  if(ch==='A'){const s=polygon([[0,0],[.27,.86],[.43,.86],[.7,0],[.56,0],[.49,.24],[.21,.24],[.14,0]]),hole=new T.Path();hole.moveTo(.27,.36);hole.lineTo(.43,.36);hole.lineTo(.35,.64);hole.closePath();s.holes.push(hole);put(s);}
 };
 let x=cx+1.52;for(const ch of 'CHICAGO'){glyph(ch,x);x+=(ch==='I'?.23:.74)*.33;}
}
