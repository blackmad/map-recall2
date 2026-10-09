import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './fire-station-dirk-footprints.json';
import letters from './fire-station-dirk-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
/** Native ground shell, original photo-guided facade/roof geometry. */
export function buildFireStationDirk(_w:number,_d:number,b:BuildingTools){
 const ang=source.localRotationRadians,c=Math.cos(ang),s=Math.sin(ang),[lng0,lat0]=source.anchor;
 const world=(x:number,z:number)=>new T.Vector2(c*x+s*z,-s*x+c*z);
 const local=(p:number[])=>{const x=(p[0]-lng0)*111320*Math.cos(lat0*Math.PI/180),z=-(p[1]-lat0)*110540;return new T.Vector2(c*x-s*z,s*x+c*z)};
 const ring=source.bag.geometry.coordinates[0].slice(0,-1).map(local);
 const add=(g:T.BufferGeometry,col:C)=>{g.rotateY(ang);b.add(g,col)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,a=0)=>{const p=world(x,z);b.box(p.x,y,p.y,w,h,d,col,ang+a)};
 const shape=(ps:T.Vector2[])=>new T.Shape(ps.map(p=>world(p.x,p.y)));
 b.add(openTopPrism(shape(ring),0,.6),'white');b.add(openTopPrism(shape(ring),.6,5.6),'brick');
 // Upper shell omits the side bay projections, whose stone-coped tops remain lower.
 function clip(ps:T.Vector2[],x:number,less:boolean){const out:T.Vector2[]=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],a=less?p.x<=x:p.x>=x,z=less?q.x<=x:q.x>=x;if(a)out.push(p);if(a!==z)out.push(p.clone().lerp(q,(x-p.x)/(q.x-p.x)));}return out;}
 const upper=clip(clip(ring,16.4,true),-17.45,false);b.add(openTopPrism(shape(upper),5.6,10.3),'brick');
 const apron=new T.Shape(ring.map(p=>world(p.x,p.y)));apron.holes.push(new T.Path([...upper].reverse().map(p=>world(p.x,p.y))));b.add(upwardRoofPlane(apron,5.62),'stone');
 // Boundary trims and dark brick bands follow each surveyed segment and preserve all setbacks.
 for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(p),len=d.length(),a=-Math.atan2(d.y,d.x),m=p.clone().add(q).multiplyScalar(.5);if(len<1)continue;for(const y of[1.7,3.05,4.35,5.5])box(m.x,y,m.y,len,.14,.14,'stone',a);}
 for(let i=0;i<upper.length;i++){const p=upper[i],q=upper[(i+1)%upper.length],d=q.clone().sub(p),len=d.length(),a=-Math.atan2(d.y,d.x),m=p.clone().add(q).multiplyScalar(.5);if(len<1)continue;for(const y of[6.25,8.95])box(m.x,y,m.y,len,.14,.14,'stone',a);box(m.x,10.22,m.y,len,.22,.28,'white',a);}
 function poly3(points:number[][],faces:number[][],col:C,tag=''){const vals=faces.flatMap(f=>f.flatMap(i=>points[i]));const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vals,3));g.computeVertexNormals();g.userData.tag=tag;add(g,col);}
 function roof(x0:number,x1:number,z0:number,z1:number,e:number,r:number,hip=false){const zm=(z0+z1)/2;const inset=hip?Math.min((x1-x0)*.23,2.9):0;const ps=[[x0,e,z0],[x1,e,z0],[x1,e,z1],[x0,e,z1],[x0+inset,r,zm],[x1-inset,r,zm]];poly3(ps,[[0,4,5],[0,5,1],[1,5,2],[2,5,4],[2,4,3],[3,4,0]],'slate','roof');if(!hip){poly3([[x0,e,z0],[x0,e,z1],[x0,r,zm],[x1,e,z0],[x1,e,z1],[x1,r,zm]],[[0,1,2],[3,5,4]],'brick');}box((x0+x1)/2,r-.05,zm,x1-x0-inset*2,.12,.18,'slate');}
 roof(-10.48,9.49,-9,8.3,10.3,13.8);
 function wingRoof(x0:number,x1:number){const xm=(x0+x1)/2,z0=-9.92,z1=9.21,k=3.0;poly3([[x0,10.3,z0],[x1,10.3,z0],[x1,10.3,z1],[x0,10.3,z1],[xm,14.3,z0+k],[xm,14.3,z1-k]],[[0,4,1],[1,4,5],[1,5,2],[2,5,3],[3,5,4],[3,4,0]],'slate','roof');box(xm,14.25,(z0+z1)/2,.18,.12,z1-z0-2*k,'slate');}
 wingRoof(-17.45,-10.48);wingRoof(9.49,16.4);
 function window(x:number,y:number,z:number,w:number,h:number,a=0,surround:C='stone'){const nx=Math.sin(a),nz=Math.cos(a);const f=(dx:number,yy:number,dz:number,ww:number,hh:number,dd:number,col:C)=>box(x+Math.cos(a)*dx+nx*dz,yy,z-Math.sin(a)*dx+nz*dz,ww,hh,dd,col,a);f(0,y,0,w+.25,h+.23,.1,surround);const pane=new T.BoxGeometry(w,h,.07);pane.userData={tag:'pane',local:{x:x+nx*.095,y,z:z+nz*.095,w,h,a}};const p=world(x+nx*.095,z+nz*.095);pane.rotateY(ang+a);pane.translate(p.x,y+h/2,p.y);b.add(pane,'glass');f(0,y-.12,.1,w+.5,.16,.3,'stone');for(const dx of[-w/2,0,w/2])f(dx,y,.15,.055,h,.08,'frame');for(const yy of[0,h*.36,h*.66,h])f(0,y+yy,.15,w,.055,.09,'frame');}
 // Front: eight tall upper windows; paired wing openings and three arched doors.
 for(const x of[-8.3,-5.9,-3.5,-1.1,1.3,3.7,6.1,8.35])window(x,6.0,8.39,1.55,3.45);
 for(const x of[-15.2,-12.65,11.7,14.25]){window(x,1.35,9.3,1.6,3.65);window(x,6,9.3,1.65,3.45);}
 // Front side windows beside vehicle doors; observed2025.
 for(const x of[-8.35,8.1])window(x,1.4,8.38,1.45,3.4);
 function arch(x:number,z:number,w:number,h:number){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:.085,bevelEnabled:false,curveSegments:12});g.translate(x,.12,z);g.userData.tag='vehicle-door';add(g,'dark');for(const dx of[-w/2-.15,w/2+.15])box(x+dx,.2,z+.06,.18,h-w/2,.17,'stone');
  // Alternating dark voussoirs trace actual round arches, entirely outside the door face.
  for(let i=0;i<18;i++){const a=i*Math.PI/18,aa=(i+1)*Math.PI/18,r=w/2+.09,rr=r+.26,cy=.12+h-w/2;poly3([[x+r*Math.cos(a),cy+r*Math.sin(a),z+.11],[x+rr*Math.cos(a),cy+rr*Math.sin(a),z+.11],[x+rr*Math.cos(aa),cy+rr*Math.sin(aa),z+.11],[x+r*Math.cos(aa),cy+r*Math.sin(aa),z+.11]],[[0,1,2],[0,2,3]],i%4===0?'stone':'brick');}
  for(const dx of[-w*.25,0,w*.25])box(x+dx,.15,z+.11,.045,h-.25,.05,'frame');for(let yy=.65;yy<h-w/2;yy+=.78)box(x,yy,z+.12,w,.055,.05,'frame');for(const dx of[-w*.25,w*.25])window(x+dx,3.55,z+.13,w*.36,.63);}
 for(const x of[-4.65,-.55,3.55])arch(x,8.42,3.2,5.15);
 // Side/rear elevations remain fitted to surveyed perimeter, no floating fixed-world windows.
 for(const side of[-1,1])for(const z of[-7.25,-3.8,0,3.8,7.0]){const xx=side<0?-17.52:16.48;window(xx,6,z,1.5,3.3,side*Math.PI/2);if(Math.abs(z)>4)window(xx,1.45,z,1.45,3.45,side*Math.PI/2);}
 for(const x of[-14.3,-11.9,-8.4,-5.6,-2.8,0,2.8,5.6,8.1,11.8,14.3]){const z=Math.abs(x)>10?-10.0:(x>=-4.09&&x<=2.96?-11.04:-9.1);window(x,6,z,1.35,3.25,Math.PI);window(x,1.6,z,1.35,3.1,Math.PI);}
 // Small projecting ground-side bay, upper masonry rises behind its stone coping.
 for(const z of[-5.25,-1.3,2.6])window(18.06,1.45,z,1.5,3.1,Math.PI/2);
 function gable(x:number,z:number,w:number,start:number,top:number){const steps=4,ps=[new T.Vector2(x-w/2,start),new T.Vector2(x+w/2,start)];for(let i=0;i<steps;i++){const xx=x+w/2-(i+1)*w/(2*steps),yy=start+(i+1)*(top-start)/steps;ps.push(new T.Vector2(xx+w/(2*steps),yy),new T.Vector2(xx,yy));}for(let i=steps-1;i>=0;i--){const xx=x-w/2+i*w/(2*steps),yy=start+(i+1)*(top-start)/steps;ps.push(new T.Vector2(xx,yy),new T.Vector2(xx,start+i*(top-start)/steps));}const sh=new T.Shape(ps);const g=new T.ExtrudeGeometry(sh,{depth:.3,bevelEnabled:false});g.translate(0,0,z-.2);add(g,'brick');for(let i=0;i<steps;i++)for(const side of[-1,1]){const xx=x+side*(w/2-(i+.5)*w/(2*steps)),yy=start+(i+1)*(top-start)/steps;box(xx,yy,z+.12,w/(2*steps)+.14,.16,.38,'stone');box(xx,yy+.16,z+.11,.1,.3,.1,'copper');add(new T.SphereGeometry(.14,6,4).translate(xx,yy+.48,z+.1),'copper');}window(x,start+.75,z+.16,w*.25,2.4);box(x,top+.05,z,.95,.18,.8,'stone');add(new T.SphereGeometry(.2,8,6).translate(x,top+.55,z+.05),'copper');
  // Small source-backed Amsterdam shield, crosses remain subordinate to masonry.
  box(x,start+.05,z+.2,.55,.65,.1,'bronze');for(const y of[start+.2,start+.42,start+.64])for(const a of[-Math.PI/4,Math.PI/4]){const g=new T.BoxGeometry(.035,.19,.06);g.rotateZ(a);g.translate(x,y,z+.28);add(g,'white');}}
 gable(-13.96,9.26,6.95,10.3,15.35);gable(12.94,9.26,6.85,10.3,15.35);gable(-.6,8.4,3.6,10.3,13.75);
 // Two front hipped dormers with pale columns/pointed roofs, clear in2025.
 for(const x of[-7.4,6.65]){box(x,10.65,6.5,1.65,2.0,1.5,'white');window(x,10.82,7.31,1.14,1.83,0,'white');poly3([[x-1.03,12.65,7.4],[x+1.03,12.65,7.4],[x,13.24,7.4]],[[0,1,2]],'white');poly3([[x-1.08,12.65,5.5],[x+1.08,12.65,5.5],[x+1.08,12.65,7.55],[x-1.08,12.65,7.55],[x,14.0,6.5]],[[0,4,1],[1,4,2],[2,4,3],[3,4,0]],'greyBrick','roof');box(x,13.9,6.5,.06,.38,.06,'greyBrick');}
 // Current AHN5 plane131/132 and canal-side photograph show a raised rear stair tower,
 // not a10.3m whole-building cap. Original supported box/coped roof within surveyed bounds.
 const rearShape=new T.Shape([world(-4.09,-10.96),world(2.96,-10.96),world(2.96,-8.67),world(-4.09,-8.67)]);b.add(openTopPrism(rearShape,10.3,15.55),'brick');b.add(upwardRoofPlane(rearShape,15.55),'stone');for(const z of[-10.96,-8.67])box(-.565,15.55,z,7.3,.28,.27,'white');for(const x of[-4.09,2.96])box(x,15.55,-9.815,.27,.28,2.52,'white');
 for(const x of[-2.8,1.65])window(x,11.15,-11.04,.87,2.18,Math.PI);

 // Real engraved BRANDWEER plaque uses source-guided thin Roman serif outlines.
 box(-.55,5.63,8.62,4.2,.63,.16,'white');box(-.55,5.55,8.66,4.55,.1,.23,'stone');
 const textPath=new T.ShapePath();for(const cmd of letters.commands as any[]){if(cmd.type==='M')textPath.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')textPath.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')textPath.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')textPath.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')textPath.currentPath?.closePath();}const text=new T.ExtrudeGeometry(textPath.toShapes(),{depth:.012,bevelEnabled:false,curveSegments:3});text.computeBoundingBox();const bb=text.boundingBox!,size=bb.getSize(new T.Vector3());text.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);text.scale(3.8/size.x,.32/size.y,1);text.translate(-.55,5.79,8.708);add(text,'stone');
 for(const x of[-4.9,3.9]){box(x,4.95,8.8,.09,.8,.1,'dark');box(x,5.46,9.01,.36,.48,.3,'dark');box(x,5.43,9.19,.23,.32,.05,'glass');box(x,5.96,9.02,.5,.09,.44,'dark');}
}
