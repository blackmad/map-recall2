import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './this-is-holland-footprints.json';
import lettering from './this-is-holland-signs.json';
type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
const ring=source.outline[0].slice(0,-1) as P[];
export const hollandHeights={foyer:6,skinBottom:6.4,roof:25.0,rim:25.15,solarMax:25.25};
export function hollandBoundary(angle:number,inset=0):P{
 const d:[number,number]=[Math.sin(angle),Math.cos(angle)];let best=Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],e=[q[0]-a[0],q[1]-a[1]],cross=d[0]*e[1]-d[1]*e[0];if(Math.abs(cross)<1e-10)continue;const t=(a[0]*e[1]-a[1]*e[0])/cross,u=(a[0]*d[1]-a[1]*d[0])/cross;if(t>0&&u>=-1e-6&&u<=1+1e-6)best=Math.min(best,t);}
 if(!Number.isFinite(best))throw Error('No surveyed perimeter intersection');return[d[0]*(best-inset),d[1]*(best-inset)];
}
const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
/** Original faceted pavilion, surveyed east/south axes and metre scale1. */
export function buildThisIsHolland(_w:number,_d:number,b:BuildingTools):void{
 const panelFaces:T.Mesh[]=[];
 const add=(g:T.BufferGeometry,c:C,role:string)=>{g.userData.role=role;b.add(g,c)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,role:string,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y+h/2,z);add(g,c,role)};
 function surface(points:number[][],c:C,role:string,up=false){const vs=points.map(p=>new T.Vector3(...p)),normal=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])),mid=vs.reduce((p,v)=>p.add(v),new T.Vector3()).divideScalar(vs.length);if(up?normal.y<0:normal.x*mid.x+normal.z*mid.z<0)vs.reverse();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>vs[i].toArray()),3));g.computeVertexNormals();if(role==='silver-panel')panelFaces.push(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));add(g,c,role)}
 // No opaque ground-to-roof drum. Foyer is the detailed current OSM sawtooth perimeter.
 const foyer=source.glazedFoyer.slice(0,-1);add(openTopPrism(shape(foyer),.12,6),'glass','foyer-glazing');
 const inner=ring.map(p=>p.map(v=>v*.965));add(openTopPrism(shape(inner),6.4,25.0),'dark','skin-joint-backing');
 // Eight rows of silver rhomboids. Actual source seam direction is slanted, not a box grid.
 const rows=8,cols=24,step=2*Math.PI/cols,dy=(25.15-6.4)/rows;
 for(let row=0;row<rows;row++)for(let i=0;i<cols;i++){
  const a=i*step+row*.055,q=(i+1)*step+row*.055,bot=6.4+row*dy+.014,top=6.4+(row+1)*dy-.014,eps=.0012;
  const p0=hollandBoundary(a+eps),p1=hollandBoundary(q-eps),p2=hollandBoundary(q+.055-eps),p3=hollandBoundary(a+.055+eps);
  surface([[p0[0],bot,p0[1]],[p1[0],bot,p1[1]],[p2[0],top,p2[1]],[p3[0],top,p3[1]]],'concrete','silver-panel');
 }
 // Bevelled underside occupies only the overhead annulus. Ground perimeter stays inset.
 for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],f=.91;surface([[a[0]*f,6,a[1]*f],[q[0]*f,6,q[1]*f],[q[0],6.4,q[1]],[a[0],6.4,a[1]]],'frame','overhang-soffit');}
 // Separate top owns the roof. AHN equipment-fitted slopes are deliberately not wall heights.
 add(upwardRoofPlane(shape(ring),25.0),'slate','supported-roof');
 const parapet=shape(ring);parapet.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0]*.984,p[1]*.984))));const rimWalls=openTopPrism(parapet,25.0,25.15),rp=rimWalls.getAttribute('position'),rn=rimWalls.getAttribute('normal'),rimValues:number[]=[];for(let i=0;i<rp.count;i+=3){if([0,1,2].every(k=>rn.getY(i+k)<-.9))continue;for(let k=0;k<3;k++)rimValues.push(rp.getX(i+k),rp.getY(i+k),rp.getZ(i+k));}rimWalls.dispose();const cleanRim=new T.BufferGeometry();cleanRim.setAttribute('position',new T.Float32BufferAttribute(rimValues,3));cleanRim.computeVertexNormals();add(cleanRim,'concrete','roof-rim');add(upwardRoofPlane(parapet,25.15),'concrete','roof-rim-top');
 // The original transparent glass folds and narrow dark mullions remain visible around all sides.
 for(let i=0;i<foyer.length;i++){const a=foyer[i],q=foyer[(i+1)%foyer.length],len=Math.hypot(q[0]-a[0],q[1]-a[1]);if(len<.16)continue;box(a[0],.12,a[1],.052,5.9,.052,'dark','foyer-mullion');if(len>.6){const angle=-Math.atan2(q[1]-a[1],q[0]-a[0]);box((a[0]+q[0])/2,.03,(a[1]+q[1])/2,len,.13,.055,'dark','foyer-sill',angle);box((a[0]+q[0])/2,5.9,(a[1]+q[1])/2,len,.1,.065,'dark','foyer-head',angle);}}
 // Photo-supported concrete mushroom columns, represented without inventing solid facade walls.
 for(const angle of [.45,2.55,4.65]){const x=7.5*Math.sin(angle),z=7.5*Math.cos(angle);const shaft=new T.CylinderGeometry(.4,.4,4.6,12);shaft.translate(x,2.3,z);add(shaft,'white','foyer-column');const cap=new T.CylinderGeometry(1.8,.4,1.4,12);cap.translate(x,5.3,z);add(cap,'white','mushroom-cap');}
 // Interior service core and an open stair seen through the foyer; not an opaque enclosing base.
 box(-2,.12,-1,5,5.8,4.2,'dark','service-core');
 for(let i=0;i<20;i++)box(-5+i*.32,.25+i*.27,3, .38,.1,1.5,'dark','visible-stair');
 // Main public doors at the mapped southeast entrance, not at the supplied destination centroid.
 const [ex,ez]=source.entrance.local,normal=new T.Vector2(ex,ez).normalize(),angle=Math.atan2(normal.x,normal.y);box(ex+normal.x*.075,.13,ez+normal.y*.075,1.75,2.6,.055,'glass','entrance-door',angle);
 for(const dx of[-.89,0,.89])box(ex+Math.cos(angle)*dx+normal.x*.11,.13,ez-Math.sin(angle)*dx+normal.y*.11,.055,2.6,.09,'dark','entrance-door-frame',angle);
 box(ex+normal.x*.11,2.73,ez+normal.y*.11,1.83,.06,.09,'dark','entrance-door-head',angle);
 // Dense roof photovoltaic field is observed in the current PDOK aerial. Grid/pitch is approximate.
 const pvAngle=.62,cos=Math.cos(pvAngle),sin=Math.sin(pvAngle);
 for(let u=-10.7;u<=10.7;u+=1.77)for(let v=-10.8;v<=10.8;v+=1.14){if(Math.hypot(u,v)>11.15)continue;const x=u*cos+v*sin,z=-u*sin+v*cos;const frame=new T.BoxGeometry(1.67,.05,1.04);frame.rotateX(-.14);frame.rotateY(pvAngle);frame.translate(x,25.10,z);add(frame,'frame','solar-frame');const panel=new T.BoxGeometry(1.59,.04,.96);panel.rotateX(-.14);panel.rotateY(pvAngle);panel.translate(x,25.135,z);add(panel,'blue','solar-module');}
 // Two real source-visible facade signs; smooth native font outlines, never shared pixel lettering.
 for(const [theta,base] of [[.80,19.65],[-2.30,15.0]])for(let line=0;line<lettering.length;line++){
  const s=lettering[line],path=new T.ShapePath(),bb=s.bounds;
  for(const cmd of s.commands){const a=cmd as {type:string;x?:number;y?:number;x1?:number;y1?:number;x2?:number;y2?:number};const x=(v:number)=>(v-(bb.x1+bb.x2)/2)*s.width/(bb.x2-bb.x1),y=(v:number)=>(bb.y2-v)*s.height/(bb.y2-bb.y1);
   if(a.type==='M')path.moveTo(x(a.x!),y(a.y!));else if(a.type==='L')path.lineTo(x(a.x!),y(a.y!));else if(a.type==='Q')path.quadraticCurveTo(x(a.x1!),y(a.y1!),x(a.x!),y(a.y!));else if(a.type==='C')path.bezierCurveTo(x(a.x1!),y(a.y1!),x(a.x2!),y(a.y2!),x(a.x!),y(a.y!));else if(a.type==='Z')path.currentPath?.closePath();
  }
  let g:T.BufferGeometry;
  if(line===0)g=new T.ExtrudeGeometry(path.toShapes(),{depth:.03,bevelEnabled:false,curveSegments:5});
  else {
   // Current2023 close reference shows open-faced outline channel letters below solid THIS IS.
   const values:number[]=[];for(const contour of path.subPaths){const pts=contour.getPoints(5);for(let i=0;i<pts.length-1;i++){const a=pts[i],q=pts[i+1],dx=q.x-a.x,dy=q.y-a.y,l=Math.hypot(dx,dy);if(l<1e-8)continue;const nx=-dy/l*.016,ny=dx/l*.016,sh=new T.Shape([new T.Vector2(a.x+nx,a.y+ny),new T.Vector2(q.x+nx,q.y+ny),new T.Vector2(q.x-nx,q.y-ny),new T.Vector2(a.x-nx,a.y-ny)]),part=new T.ExtrudeGeometry(sh,{depth:.03,bevelEnabled:false});values.push(...Array.from(part.getAttribute('position').array));part.dispose();}}
   g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));
  }
  const p=g.getAttribute('position');
  for(let k=0;k<p.count;k++){const thetaAt=theta+p.getX(k)/14.4,y=base+(line===0?1.12:0)+p.getY(k),[x,z]=hollandBoundary(thetaAt,-1),normal=new T.Vector3(Math.sin(thetaAt),0,Math.cos(thetaAt)),hit=new T.Raycaster(new T.Vector3(x,y,z),normal.clone().negate()).intersectObjects(panelFaces)[0],r=hit?Math.hypot(hit.point.x,hit.point.z):Math.hypot(x,z)-1-.08,depth=.035+p.getZ(k);p.setXYZ(k,normal.x*(r+depth),y,normal.z*(r+depth));}g.computeVertexNormals();add(g,'white','source-sign-'+s.text);
 }
}
