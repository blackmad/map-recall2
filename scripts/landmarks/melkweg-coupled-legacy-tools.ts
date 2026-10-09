import * as T from 'three';
import {fittedSignLayout} from './sign-layout';
import type {BuildingTools} from './cultural-builders';
type Colour=Parameters<BuildingTools['add']>[1];
export function legacyTools(add:BuildingTools['add']):BuildingTools{
function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,angle=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,angle);}
function prism(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){let shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();add(new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1}),c,x,y,z-d/2);}
function gableRoof(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){
 const vertices=[[-w/2,0,-d/2],[w/2,0,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[-w/2,h,0],[w/2,h,0]];
 const faces=[0,4,5,0,5,1,2,3,5,2,5,4,0,2,4,1,5,3,0,1,3,0,3,2];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(i=>vertices[i]),3));g.computeVertexNormals();add(g,c,x,y,z);
}
function hip(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){let g=new T.BufferGeometry();let p=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4,0,3,2,0,2,1].flatMap(i=>p[i]),3));g.computeVertexNormals();add(g,c,x,y,z);}
function arch(x:number,y:number,z:number,w:number,h:number,c:Colour){let s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);add(new T.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false,curveSegments:5}),c,x,y,z);}
function window(x:number,y:number,z:number,w:number,h:number){arch(x,y-.18,z,w+.45,h+.4,'stone');arch(x,y,z+.17,w,h,'dark');box(x,y+.2,z+.36,.13,h-.35,.12,'stone');box(x,y+h*.56,z+.36,w,.14,.12,'stone');box(x,y-.25,z,w+.7,.22,.65,'stone');}
function clock(x:number,y:number,z:number,wind=false){add(new T.CylinderGeometry(2.55,2.55,.2,16).rotateX(Math.PI/2),'gold',x,y,z);add(new T.CylinderGeometry(2.2,2.2,.23,16).rotateX(Math.PI/2),'white',x,y,z+.13);for(let i=0;i<12;i++){let a=i*Math.PI/6;box(x+1.9*Math.sin(a),y+1.9*Math.cos(a)-.13,z+.31,.14,.3,.08,'dark',-a);}box(x,y-.12,z+.4,.2,1.65,.1,'dark');box(x+.5,y-.13,z+.41,1.25,.2,.1,'dark');if(wind)box(x,y-2.3,z+.46,4.8,.12,.12,'gold');}
const letters:Record<string,string[]>={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['111','010','010','010','010','010','111'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001']};
Object.assign(letters,{
 F:['11111','10000','10000','11110','10000','10000','10000'],J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
});
function sign(text:string,x:number,y:number,z:number,pixel:number,c:Colour='white',maxWidth?:number){const layout=fittedSignLayout(text,letters,pixel,maxWidth);pixel=layout.pixel;let u=layout.start;for(let ch of text){let rows=letters[ch];if(rows)for(let j=0;j<7;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')box(x+u+k*pixel,y+(6-j)*pixel,z,pixel*.85,pixel*.85,.08,c);u+=((rows?.[0].length??3)+1)*pixel;}}
return {add,box,prism,hip,gableRoof,window,clock,sign};
}
