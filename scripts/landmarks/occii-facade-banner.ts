import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Restored 2014 operator photo: white banner, narrow red Gothic capitals.
 * Original angular outlines approximate the unidentified blackletter sign face;
 * neither copied pixels nor the generic BuildingTools bitmap font is used. */
export function buildOcciiBanner(b:BuildingTools,cx:number,f:(x:number)=>number,angle:number){
 const y=3.38,w=2.25,h=.76;
 b.box(cx,y,f(cx)+.46,w,h,.07,'white',angle);
 const polygon=(points:number[][])=>{const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;};
 const draw=(s:T.Shape,x:number)=>b.add(new T.ShapeGeometry(s),'red',x,3.54,f(x)+.51,angle);
 const outer=[[.04,0],[0,.07],[0,.39],[.07,.48],[.22,.48],[.28,.41],[.28,.07],[.22,0]];
 const inner=[[.075,.09],[.075,.36],[.11,.40],[.19,.40],[.205,.36],[.205,.10],[.18,.08],[.11,.08]];
 const glyphs=['O','C','C','I','I'],widths=[.28,.28,.28,.14,.14],tracking=.10;
 let x=cx-(widths.reduce((a,c)=>a+c,0)+tracking*4)/2;
 for(let i=0;i<glyphs.length;i++){
  const letter=glyphs[i];
  if(letter==='O'){const s=polygon(outer),hole=new T.Path();inner.forEach(([xx,yy],j)=>j?hole.lineTo(xx,yy):hole.moveTo(xx,yy));hole.closePath();s.holes.push(hole);draw(s,x);}
  else if(letter==='C')draw(polygon([[.27,.41],[.21,.48],[.07,.48],[0,.39],[0,.07],[.04,0],[.22,0],[.28,.07],[.22,.14],[.18,.08],[.11,.08],[.075,.11],[.075,.36],[.11,.40],[.18,.40],[.22,.34]]),x);
  else draw(polygon([[0,.04],[.045,0],[.14,.06],[.10,.10],[.10,.38],[.14,.43],[.095,.48],[0,.42],[.04,.37],[.04,.10]]),x);
  x+=widths[i]+tracking;
 }
 // Shallow scalloped hem is part of the banner, bounded below the cornice.
 for(let i=0;i<16;i++)b.add(new T.CircleGeometry(.055,8),'red',cx-w/2+.08+i*(w-.16)/15,y+.035,f(cx-w/2+.08+i*(w-.16)/15)+.51,angle);
}
