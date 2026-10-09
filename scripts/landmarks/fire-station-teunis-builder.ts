import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import src from './fire-station-teunis-footprints.json';
import lettering from './fire-station-teunis-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationTeunis(_w:number,_d:number,b:BuildingTools){
 const a=src.localRotationRadians,c=Math.cos(a),s=Math.sin(a),world=(x:number,z:number)=>new T.Vector2(c*x+s*z,-s*x+c*z);
 const shape=(ps:number[][])=>new T.Shape(ps.map(p=>world(p[0],p[1])));
 const add=(g:T.BufferGeometry,col:C)=>{g.rotateY(a);b.add(g,col)};
 const roofPlane=(ps:number[][],y:number)=>{const g=upwardRoofPlane(shape(ps),y).toNonIndexed(),p=g.getAttribute('position'),out:number[]=[];for(let i=0;i<p.count;i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).length()/2<.01)continue;for(const v of vs)out.push(v.x,v.y,v.z);}const cleaned=new T.BufferGeometry();cleaned.setAttribute('position',new T.Float32BufferAttribute(out,3));cleaned.computeVertexNormals();return cleaned;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,ang=0)=>{const p=world(x,z);b.box(p.x,y,p.y,w,h,d,col,a+ang)};
 // Surveyed segmented lower shell respects vehicle-bay setback and exact rear stepping.
 for(const p of src.roofParts.filter(p=>p.semantic!==9)){
  const top=p.semantic===7?6.87:p.height;
  b.add(openTopPrism(shape(p.ring),0,top),'brick');
  if(p.semantic!==7)b.add(roofPlane(p.ring,top),'copper');
 }
 // Upper accommodation behind an actual open front terrace. Explicit roof owns its top.
 const upper=[[-20.48,-1],[-17.3,-1.5],[-17.3,-4.25],[8.9,-4.25],[8.8,-9.65],[7.33,-9.65],[7.34,-22.50],[1,-22.5],[1,-23.04],[-19.68,-23.32]];
 b.add(openTopPrism(shape(upper),6.87,10.08),'brick');
 const roof=src.roofParts.find(p=>p.semantic===7)!;
 b.add(roofPlane([[-20.5,.12],[9.1222,.12],...roof.ring.slice(4,14)],10.22),'copper');
 // Source roof thin overhang projects west over the whole veranda/garage frontage.
 // The extended frontage is one combined roof contour; no coplanar duplicate canopy plate.
 box(-5.75,10.05,.10,29.6,.17,.24,'stone');box(-5.75,9.91,-1.6,29.6,.1,3.5,'stone');
 // Garage front recess is native BAG geometry, not an invented flat wall.
 box(-10.05,5.98,-1.58,14.55,.88,3.3,'brick');box(-10.05,5.78,-1.60,14.4,.18,3.2,'greyBrick');
 for(const x of[-12.5,-7.7])box(x,0,-1.58,.31,5.81,3.27,'stone');
 function pane(x:number,y:number,z:number,w:number,h:number,ang=0,tag='window-pane'){
  const g=new T.BoxGeometry(w,h,.06);g.rotateY(ang);g.translate(x,y+h/2,z);g.userData={tag,probe:{x,y,z,a:ang}};add(g,'glass');
  const nx=Math.sin(ang),nz=Math.cos(ang),px=Math.cos(ang),pz=-Math.sin(ang);
  for(const dx of[-w/2,w/2])box(x+px*dx+nx*.07,y,z+pz*dx+nz*.07,.07,h,.11,'frame',ang);
  for(const yy of[0,h])box(x+nx*.07,y+yy,z+nz*.07,w,.07,.11,'frame',ang);
 }
 // Three red sectional doors retain glass upper panels and grounded red lower panels.
 for(const x of[-14.87,-10.08,-5.28]){
  box(x,.05,-3.05,4.42,1.85,.11,'greyBrick');pane(x,1.92,-3.01,4.42,3.52,0,'vehicle-pane');
  for(const yy of[1.92,2.78,3.64,4.50,5.36])box(x,yy,-2.92,4.46,.08,.12,'greyBrick');
  for(const dx of[-1.48,0,1.48])box(x+dx,1.91,-2.92,.075,3.53,.12,'greyBrick');
  box(x,.4,-2.94,1.45,.07,.06,'white');box(x,.55,-2.94,.5,.05,.06,'white');
 }
 // Upper full-height glazed terrace wall and slender open railing.
 for(let x=-15.8;x<8.1;x+=2.0){pane(x,7.17,-4.13,1.90,2.62,0,'terrace-pane');box(x,8.21,-4.01,1.93,.065,.09,'greyBrick');}
 for(const y of[7.18,7.92])box(-4.25,y,-.02,26.3,.055,.06,'frame');
 for(let x=-17.2;x<=8.7;x+=1.44)box(x,6.88,-.02,.045,1.08,.07,'frame');
 // Southern pedestrian recess and two broad window ribbons on the lower wing.
 pane(1.67,.08,-1.25,1.62,5.75,0,'entrance-pane');for(const yy of[1.95,3.82])box(1.67,yy,-1.14,1.67,.055,.07,'greyBrick');
 box(1.67,5.9,-.57,1.82,.11,1.2,'greyBrick');
 for(const y of[1.04,4.50]){pane(9.10,y,.11,9.65,1.47);for(let x=5.1;x<13.7;x+=1.62)box(x,y,.23,.055,1.47,.08,'frame');box(9.1,y+.67,.22,9.65,.055,.08,'greyBrick');}
 // North sign pier, pale panel seams and facade reveals.
 for(const x of[-19.45,-18.38])for(const y of[1.32,2.64,3.96,5.28])box(x,y,.1,1.05,.018,.035,'stone');
 for(const y of[.12,2.25,3.75,6.0])box(9.05,y,.06,11.8,.022,.035,'stone');
 for(const x of[3.73,6.17,8.62,11.05,13.47])box(x,.13,.05,.02,6.45,.04,'stone');
 // Source-visible upper north side and restrained rear glazed bands.
 for(const z of[-6.2,-10,-13.8,-17.6]){const x=-20.48-(z+1)*.03584;pane(x-.09,7.24,z,2.6,2.1,-Math.PI/2+.03582,'side-pane');}for(const z of[-11.5,-15.3,-19.1])pane(7.45,7.24,z,2.6,2.1,Math.PI/2,'side-pane');
 for(const x of[-16.9,-12.7,-8.5,-4.3])for(const y of[1.0,4.27])pane(x,y,-23.43,2.82,1.55,Math.PI,'rear-pane');
 // Small surveyed roof equipment has its own scope, not whole-building height.
 box(-4.9,10.22,-6.4,3.8,1.05,2.5,'stone');box(-4.9,11.25,-6.4,3.9,.06,2.6,'dark');
 // Defining real BRANDWEER sign: source-observed bold sans family, approximate Arial Bold outlines.
 const path=new T.ShapePath();for(const v of lettering.commands as any[]){if(v.type==='M')path.moveTo(v.x,-v.y);else if(v.type==='L')path.lineTo(v.x,-v.y);else if(v.type==='Q')path.quadraticCurveTo(v.x1,-v.y1,v.x,-v.y);else if(v.type==='C')path.bezierCurveTo(v.x1,-v.y1,v.x2,-v.y2,v.x,-v.y);else if(v.type==='Z')path.currentPath?.closePath();}
 const letters=new T.ExtrudeGeometry(path.toShapes(),{depth:.026,bevelEnabled:false,curveSegments:3});letters.scale(.0091,.0091,1);letters.translate(-17.1,6.48,.20);add(letters,'greyBrick');
 // Red/gold national fire-service shield on actual sign plane.
 const badge=new T.Shape();badge.moveTo(-.32,.59);badge.quadraticCurveTo(-.5,.22,-.27,-.14);badge.quadraticCurveTo(0,-.44,.27,-.14);badge.quadraticCurveTo(.5,.22,.32,.59);badge.closePath();
 const bg=new T.ExtrudeGeometry(badge,{depth:.055,bevelEnabled:false,curveSegments:8});bg.translate(-18.22,6.19,.16);add(bg,'greyBrick');
 const flame=new T.Shape();flame.moveTo(-.15,-.18);flame.bezierCurveTo(-.42,.14,.08,.21,.02,.59);flame.bezierCurveTo(.39,.4,.23,.06,.11,-.11);flame.bezierCurveTo(.09,.1,-.08,.16,-.04,.3);flame.bezierCurveTo(-.26,.08,.05,-.05,-.15,-.18);const fg=new T.ExtrudeGeometry(flame,{depth:.03,bevelEnabled:false,curveSegments:6});fg.translate(-18.22,6.19,.22);add(fg,'bronze');
 // Corner flagstaff without invented flag pixels.
 box(-19.15,6.88,.3,.055,5.55,.055,'white');
}
