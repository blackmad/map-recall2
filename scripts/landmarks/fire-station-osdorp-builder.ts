import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import src from './fire-station-osdorp-footprints.json';
import lettering from './fire-station-osdorp-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationOsdorp(_w:number,_d:number,b:BuildingTools){
 const angle=src.localRotationRadians,c=Math.cos(angle),s=Math.sin(angle);
 const world=(x:number,z:number)=>new T.Vector2(c*x+s*z,-s*x+c*z);
 const shape=(ps:number[][])=>new T.Shape(ps.map(p=>world(p[0],p[1])));
 const add=(g:T.BufferGeometry,col:C)=>{g.rotateY(angle);b.add(g,col)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,a=0)=>{const p=world(x,z);b.box(p.x,y,p.y,w,h,d,col,angle+a)};
 const brickRing=src.nativeRing.slice(0,4).concat([src.nativeRing[12]],src.nativeRing.slice(13,15));
 // Exact east masonry footprint and connector retain the native narrow neck/open exterior.
 const brickShape=shape(brickRing);b.add(openTopPrism(brickShape,0,10.8),'brick');
 // Rear/side upper walls; the front terrace is genuinely open behind two large framed openings.
 box(11.77,10.8,-.89,19.55,3.08,.28,'brick');box(2.12,10.8,5.75,.28,3.08,13.3,'brick');box(21.43,10.8,5.75,.28,3.08,13.3,'brick');
 for(const [x,w]of[[3.45,2.9],[11.03,.48],[18.64,5.82]])box(x,10.8,12.34,w,3.08,.28,'brick');
 box(11.77,13.03,12.34,19.55,.85,.28,'brick');
 // Main roof stops at the terrace surveyed lowered plane; no wall-colored top cap.
 const roofShape=shape([[2.1,-.9],[21.5,-.9],[21.5,12.4],[15.92,12.4],[14.52,7.87],[5.59,8.56],[6.02,12.4],[2.1,12.4]]);
 b.add(upwardRoofPlane(roofShape,13.88),'slate');
 const terrace=shape([[6.02,12.4],[5.59,8.56],[14.52,7.87],[15.92,12.4]]);b.add(upwardRoofPlane(terrace,10.8),'stone');
 for(const z of[-.9,12.4])box(11.77,13.87,z,19.7,.1,.19,'dark');for(const x of[2.05,21.52])box(x,13.87,5.75,.19,.1,13.5,'dark');
 for(const yy of[10.93,11.15])box(10.97,yy,12.46,10.6,.06,.08,'white');for(let x=6;x<=16;x+=.72)box(x,10.8,12.46,.035,.43,.07,'white');
 // Tall hall: curved longitudinal profile guided by source views and AHN5 sampled heights.
 const roofHeight=(z:number)=>8.85+1.55*Math.cos((z+8)/43.7*Math.PI*2);
 const x0=-18.11,x1=-3.12,z0=-24.85,z1=18.8;
 // Exposed hall glazing owns the perimeter. Western lower brick wall is source-visible.
 box((x0+x1)/2,0,(z0+z1)/2,x1-x0,.2,z1-z0,'stone');
 box(x0+.05,.2,(z0+11.5)/2,.17,4.05,11.5-z0,'brick');
 function quad(ps:number[][],col:C,tag=''){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([ps[0],ps[1],ps[2],ps[0],ps[2],ps[3]].flat(),3));g.computeVertexNormals();g.userData.tag=tag;add(g,col);}
 // Wave roof constructed with upward winding; golden timber soffit below and grey curved fascia.
 const N=44;
 for(let i=0;i<N;i++){const a=z0-1.5+(z1-z0+3)*i/N,bb=z0-1.5+(z1-z0+3)*(i+1)/N,ha=roofHeight(a),hb=roofHeight(bb);
  quad([[x0-1.45,ha,a],[x0-1.45,hb,bb],[x1+1.45,hb,bb],[x1+1.45,ha,a]],'copper','roof');
  quad([[x0-1.45,ha-.42,a],[x1+1.45,ha-.42,a],[x1+1.45,hb-.42,bb],[x0-1.45,hb-.42,bb]],'bronze','soffit');
  for(const x of[x0-1.45,x1+1.45]){const ps=[[x,ha,a],[x,hb,bb],[x,hb-.42,bb],[x,ha-.42,a]];if(x===x0-1.45)ps.reverse();quad(ps,'stone','fascia');}
 }
 for(const z of[z0-1.5,z1+1.5]){const h=roofHeight(z),ps=[[x0-1.45,h,z],[x1+1.45,h,z],[x1+1.45,h-.42,z],[x0-1.45,h-.42,z]];if(z>0)ps.reverse();quad(ps,'stone');}
 function glazing(x:number,z:number,w:number,h:number,y=0,a=0,tag='pane'){
  const nx=Math.sin(a),nz=Math.cos(a),f=(dx:number,yy:number,ww:number,hh:number,col:C,depth=.13)=>box(x+Math.cos(a)*dx+nx*.08,y+yy,z-Math.sin(a)*dx+nz*.08,ww,hh,depth,col,a);
  const pane=new T.BoxGeometry(w,h,.075);pane.rotateY(a);pane.translate(x,y+h/2,z);pane.userData={tag,probe:{x,y:y+h*.5,z,a}};add(pane,'glass');
  if(tag==='window-pane'){for(const dx of[-w/2,w/2])f(dx,0,.065,h,'white');for(const yy of[0,h])f(0,yy,w,.065,'white');}
 }
 for(const side of[-1,1]){
  const x=side<0?x0-.04:x1+.04,a=side*Math.PI/2;
  for(let z=z0+.7;z<z1;z+=1.45){const base=side<0&&z<11.5?4.26:.23,h=roofHeight(z)-.44;for(let y=base;y<h-.2;y+=.93)glazing(x,z,Math.min(1.4,2*(z1-z)),Math.min(.88,h-y),y,a);}
  for(let z=z0;z<=z1;z+=1.45)box(x+side*.07,.23,z,.09,roofHeight(z)-.67,.07,'white');
  box(x+side*.07,.23,z1,.09,roofHeight(z1)-.67,.07,'white');
  for(let y=.23;y<10.4;y+=.93)for(let z=z0;z<z1;z+=1.45){const end=Math.min(z+1.45,z1),base=side<0&&z<11.5?4.25:.2;if(y>=base&&y<roofHeight(z)-.44)box(x+side*.07,y,(z+end)/2,.08,.065,end-z,'white');}
 }
 for(const z of[z0-.03,z1+.03]){
  const a=z>0?0:Math.PI,h=roofHeight(z)-.42;
  for(let x=x0+.76;x<x1;x+=1.5)for(let y=.2;y<h-.1;y+=.91)glazing(x,z,1.43,Math.min(.86,h-y),y,a,z>0?'vehicle-pane':'pane');
  for(let x=x0;x<=x1;x+=1.5)box(x,.2,z+(z>0?.1:-.1),.065,h-.2,.1,'white');for(let y=.2;y<h;y+=.91)box((x0+x1)/2,y,z+(z>0?.1:-.1),x1-x0,.065,.1,'white');
  // Source-backed sectional door divisions and red lower safety trim on vehicle frontage.
  if(z>0){for(const x of[x0+.1,x0+5,x0+10,x1-.1])box(x,.18,z+.1,.16,h-.2,.18,'white');box((x0+x1)/2,.2,z+.09,x1-x0,.12,.13,'brick');}
 }
 // Exposed glulam roof beams extend under the overhang and support the curved shell.
 for(let z=z0;z<=z1;z+=7.25)box((x0+x1)/2,roofHeight(z)-.75,z,x1-x0+2.4,.31,.2,'bronze');
 // Exact connector native polygon, fully glazed and low flat roof.
 const connector=[src.nativeRing[3],src.nativeRing[4],src.nativeRing[11],src.nativeRing[12]];
 b.add(upwardRoofPlane(shape(connector),6.72),'stone');
 for(const z of[5.59,8.18])for(let x=-2.7;x<2;x+=.85)glazing(x,z,.8,6.35,.18,z>7?0:Math.PI);
 for(const x of[-3.07,1.96])box(x,0,6.88,.16,6.7,.16,'white');
 // Source-visible main masonry front: ground openings, first-floor double door/balcony, four upper pairs.
 function window(x:number,y:number,z:number,w:number,h:number,a=0){
  const nx=Math.sin(a),nz=Math.cos(a);box(x+nx*.09,y-.09,z+nz*.09,w+.18,h+.18,.13,'bronze',a);glazing(x+nx*.18,z+nz*.18,w,h,y,a,'window-pane');
  box(x+nx*.23,y+h-.15,z+nz*.23,w,.14,.1,'white',a);box(x+nx*.21,y-.13,z+nz*.21,w+.28,.14,.25,'white',a);
 }
 for(const x of[7.4,16.35])window(x,.5,12.46,3.75,1.75);
 window(7.4,4.7,12.46,3.65,2.3);window(13.13,4.62,12.46,4.65,2.95);window(13.13,.2,12.46,4.5,3.45);
 for(const x of[6.14,7.87,10.49,12.15,15.0,16.66,18.27,19.91])window(x,8.44,12.46,1.02,1.94);
 box(13.1,4.55,13.5,5.2,.2,1.9,'stone');for(const x of[10.7,13.12,15.45])box(x,4.8,14.23,.06,1.05,.06,'frame');for(const y of[5.05,5.55])box(13.12,y,14.23,4.8,.055,.07,'frame');for(let x=10.7;x<15.5;x+=.25)box(x,4.77,14.23,.03,.81,.03,'frame');
 box(13.12,3.64,13.38,5.2,.16,1.45,'stone');for(const x of[10.75,15.47]){const g=new T.CylinderGeometry(.045,.045,1.48,6);g.rotateX(-.8);g.translate(x,4.1,13.4);add(g,'frame');}
 // East stair slot and flanking windows verified in ARCAM photograph.
 window(21.55,3.5,5.75,1.55,8.7,Math.PI/2);for(let y=4;y<12;y+=1.15)box(21.86,y,5.75,.11,.065,1.53,'white');
 for(const z of[1.5,10.3]){window(21.56,4.1,z,2.5,1.6,Math.PI/2);window(21.56,.65,z,2.1,1.9,Math.PI/2);}
 // Opposite/rear opening pattern kept restrained pending obscured current views.
 for(const x of[5.4,9.1,12.8,16.5,19.2])for(const y of[.6,4.5,8.45])window(x,y,-.96,1.25,1.8,Math.PI);
 for(const z of[1,4,9.5])for(const y of[.6,4.5,8.45])window(1.93,y,z,1.25,1.8,-Math.PI/2);
 // Defining source-supported red/gold fire-service shield; original geometry, no photo pixels.
 const badge=new T.Shape();badge.moveTo(-.7,1.8);badge.quadraticCurveTo(-1.1,.8,-.67,.28);badge.quadraticCurveTo(0,-.43,.67,.28);badge.quadraticCurveTo(1.1,.8,.7,1.8);badge.quadraticCurveTo(0,1.55,-.7,1.8);
 const bg=new T.ExtrudeGeometry(badge,{depth:.1,bevelEnabled:false,curveSegments:10});bg.translate(18.52,11.1,12.56);add(bg,'greyBrick');
 const flame=new T.Shape();flame.moveTo(-.36,.25);flame.bezierCurveTo(-.9,.9,.15,1.1,-.05,2.2);flame.bezierCurveTo(.78,1.76,.65,1.03,.27,.67);flame.bezierCurveTo(.35,1.25,.02,1.33,.03,1.58);flame.bezierCurveTo(-.38,.84,.23,.65,-.36,.25);const fg=new T.ExtrudeGeometry(flame,{depth:.025,bevelEnabled:false,curveSegments:8});fg.translate(18.52,11.15,12.68);add(fg,'bronze');
 // The real Fanny Blankers-Koen name and running figure occupy their observed wall plane.
 for(let i=0;i<lettering.lines.length;i++){
  const path=new T.ShapePath();for(const v of lettering.lines[i].commands as any[]){if(v.type==='M')path.moveTo(v.x,-v.y);else if(v.type==='L')path.lineTo(v.x,-v.y);else if(v.type==='Q')path.quadraticCurveTo(v.x1,-v.y1,v.x,-v.y);else if(v.type==='C')path.bezierCurveTo(v.x1,-v.y1,v.x2,-v.y2,v.x,-v.y);else if(v.type==='Z')path.currentPath?.closePath();}
  const g=new T.ExtrudeGeometry(path.toShapes(),{depth:.012,bevelEnabled:false,curveSegments:2});g.scale(.0045,.0045,1);g.translate(17,5.83-i*.46,12.61);add(g,'white');
 }
 const runner=new T.Shape();runner.moveTo(-.12,2.0);runner.lineTo(.14,1.99);runner.lineTo(.2,1.28);runner.lineTo(.54,1.5);runner.lineTo(.68,1.28);runner.lineTo(.25,1.0);runner.lineTo(.12,.69);runner.lineTo(.49,.26);runner.lineTo(.61,-.02);runner.lineTo(.4,-.11);runner.lineTo(.22,.18);runner.lineTo(-.1,.45);runner.lineTo(-.44,-.2);runner.lineTo(-.68,-.17);runner.lineTo(-.47,.4);runner.lineTo(-.19,.89);runner.lineTo(-.35,1.24);runner.lineTo(-.62,1.1);runner.lineTo(-.65,1.36);runner.lineTo(-.22,1.63);runner.closePath();
 const rg=new T.ExtrudeGeometry(runner,{depth:.035,bevelEnabled:false});rg.translate(16.35,4.7,12.61);add(rg,'white');const head=new T.SphereGeometry(.18,8,6);head.scale(1,1,.3);head.translate(16.35,6.86,12.64);add(head,'white');

}
