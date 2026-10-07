import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './rasphuispoort-footprints.json';

/** Additive portal only. Host shell needs the separately documented passage cutout. */
export function buildRasphuispoort(_w:number,_d:number,b:BuildingTools){
 const a=source.authorAngleRadians;
 type Colour=Parameters<BuildingTools['add']>[1];
 const at=(x:number,z:number)=>[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,role=''){const q=at(x,z);g.userData.role=role;b.add(g,c,q[0],y,q[1],a);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,role=''){const g=new T.BoxGeometry(w,h,d);add(g,c,x,y+h/2,z,role);}
 function ball(x:number,y:number,z:number,rx:number,ry:number,rz:number,c:Colour,role=''){const g=new T.SphereGeometry(1,10,6);g.scale(rx,ry,rz);add(g,c,x,y,z,role);}
 function rod(p:number[],q:number[],r:number,c:Colour,role=''){const delta=new T.Vector3(...q as [number,number,number]).sub(new T.Vector3(...p as [number,number,number]));const g=new T.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));add(g,c,(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2,role);}
 // 2.14m clear width; spring/crown estimated from the 2020 principal photo.
 const r=1.07,spring=2.63,outer=1.43;
 for(const x of [-1.58,1.58])box(x,0,.06,1.02,4.08,.34,'stone','pier');
 const arch=new T.Shape();arch.moveTo(-outer,4.08);arch.lineTo(-outer,spring);arch.lineTo(-r,spring);arch.absarc(0,spring,r,Math.PI,0,true);arch.lineTo(outer,spring);arch.lineTo(outer,4.08);arch.closePath();
 add(new T.ExtrudeGeometry(arch,{depth:.34,bevelEnabled:false,curveSegments:20}),'stone',0,0,-.11,'open-arch');
 // Arch ring/voussoir blocks expose the curve without filling the clear opening.
 for(let i=0;i<18;i++){
  const lo=i*Math.PI/18+.008,hi=(i+1)*Math.PI/18-.008,s=new T.Shape();
  s.moveTo(r*Math.cos(lo),spring+r*Math.sin(lo));s.lineTo((r+.18)*Math.cos(lo),spring+(r+.18)*Math.sin(lo));s.lineTo((r+.18)*Math.cos(hi),spring+(r+.18)*Math.sin(hi));s.lineTo(r*Math.cos(hi),spring+r*Math.sin(hi));s.closePath();
  add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false}),'stone',0,0,.25,'arch-rim');
 }
 box(0,3.55,.34,.36,.45,.28,'stone','keystone');
 for(const x of [-1.6,1.6]){
  box(x,0,.30,.68,.40,.68,'slate','column-plinth');
  add(new T.CylinderGeometry(.28,.30,2.9,14),'stone',x,1.86,.31,'half-column');
  for(const y of [.4,3.23]){add(new T.CylinderGeometry(.35,.35,.11,14),'stone',x,y,.31,'column-ring');box(x,y+.08,.3,.72,.16,.60,'stone','capital');}
  // Small scroll brackets: original simple curved geometry based on visible profiles.
  for(const y of [.83,3.63]){
   const g=new T.TorusGeometry(.21,.065,6,14);g.scale(.65,1,1);add(g,'stone',x+Math.sign(x)*.4,y,.23,'scroll');
  }
 }
 box(0,3.98,.15,4.12,.17,.65,'stone','relief-sill');
 box(0,4.15,.06,3.97,.82,.36,'stone','relief-surround');
 box(0,4.20,.30,2.62,.65,.07,'green','relief-panel');
 // Source-supported colored cart / keeper / animals, original abstract relief.
 const reliefZ=.40;
 box(-.67,4.46,reliefZ,1.05,.13,.10,'bronze','cart');
 for(const x of [-1.06,-.52]){
  const wheel=new T.TorusGeometry(.19,.035,5,14);add(wheel,'gold',x,4.31,reliefZ+.025,'cart-wheel');
  for(let k=0;k<6;k++){const ang=k*Math.PI/3;rod([x,4.31,reliefZ+.025],[x+.17*Math.cos(ang),4.31+.17*Math.sin(ang),reliefZ+.025],.014,'gold','wheel-spoke');}
 }
 rod([-.32,4.52,reliefZ],[-.2,4.74,reliefZ],.07,'red','keeper');ball(-.16,4.80,reliefZ,.075,.075,.04,'stone','keeper-head');
 for(const x of [.34,.81,1.13]){ball(x,4.32,reliefZ,.20,.10,.045,'bronze','animal');ball(x+.10,4.50,reliefZ,.10,.12,.045,'bronze','animal-head');rod([x-.10,4.3,reliefZ],[x-.17,4.22,reliefZ],.023,'bronze','animal-leg');}
 for(const x of [-1.65,1.65]){box(x,4.13,.34,.4,.74,.35,'stone','relief-console');for(const dx of [-.1,0,.1])ball(x+dx,4.49,.49,.065,.24,.05,'stone','console-flute');}
 box(0,4.93,.2,3.92,.18,.62,'stone','relief-lintel');
 box(0,5.11,.10,4.0,.47,.34,'stone','frieze');
 for(const x of [-1.6,-.55,.55,1.6])box(x,5.12,.33,.15,.43,.12,'stone','frieze-pilaster');
 for(const x of [-1.08,1.08])for(const dx of [-.2,-.1,0,.1,.2])ball(x+dx,5.35,.35,.06,.07,.04,'stone','frieze-relief');
 box(0,5.57,.12,4.46,.19,.78,'stone','cornice');box(0,5.76,.12,4.34,.055,.80,'slate','cornice-cap');
 // Later three-figure crowning group. No invented name lettering.
 box(0,5.81,.16,.92,.42,.54,'stone','statue-plinth');
 box(0,6.0,-.06,.70,.74,.40,'stone','throne');
 ball(0,6.41,.17,.30,.51,.24,'stone','seated-figure');ball(0,7.02,.15,.16,.21,.15,'stone','central-head');
 rod([-.18,6.58,.2],[-.32,6.38,.36],.08,'stone','central-arm');
 rod([.08,6.35,.25],[.20,6.06,.4],.10,'stone','central-leg');rod([-.08,6.35,.25],[-.10,6.03,.39],.10,'stone','central-leg');
 ball(.38,6.68,.42,.16,.25,.055,'red','city-shield');
 box(.38,6.47,.485,.06,.43,.03,'white','shield-bar');
 for(const y of [6.52,6.65,6.78]){const cross=new T.BoxGeometry(.18,.035,.035);cross.rotateZ(.65);add(cross,'white',.38,y,.51,'shield-cross');const cross2=new T.BoxGeometry(.18,.035,.035);cross2.rotateZ(-.65);add(cross2,'white',.38,y,.51,'shield-cross');}
 for(const s of [-1,1]){
  const x=s*1.25;
  ball(x,6.16,.20,.34,.23,.22,'stone','captive-hips');
  rod([x,6.2,.19],[x-s*.15,6.62,.10],.16,'stone','captive-torso');ball(x-s*.14,6.80,.1,.14,.18,.14,'stone','captive-head');
  rod([x,6.2,.21],[x+s*.22,6.03,.4],.105,'stone','captive-leg');rod([x+s*.22,6.03,.4],[x+s*.3,5.84,.38],.09,'stone','captive-leg');
  rod([x-s*.16,6.48,.18],[x-s*.30,6.17,.33],.065,'stone','captive-arm');
  const chain=new T.TorusGeometry(.06,.018,4,8);for(let k=0;k<4;k++)add(chain.clone(),'frame',x-s*(.3+k*.14),6.14-k*.045,.36,'chain');chain.dispose();
 }
}
