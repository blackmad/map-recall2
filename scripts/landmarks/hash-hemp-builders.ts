import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './hash-hemp-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Two independently surveyed museum houses, with their actual low rear rooms. */
export function buildHashHempLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=data.sites.find(s=>s.id===id)!,a=s.authorHeadingDegrees*Math.PI/180;
 const point=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const r=s.buildings[0].geometry.coordinates[0].slice(0,-1).map(point);
 function clip(r:T.Vector2[],value:number,less:boolean,axis:'x'|'y'='x'){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pin=less?p[axis]<=value:p[axis]>=value,qin=less?q[axis]<=value:q[axis]>=value;if(pin)out.push(p);if(pin!==qin)out.push(p.clone().lerp(q,(value-p[axis])/(q[axis]-p[axis])));}return out;}
 function region(bounds:number[]){let out=r;for(const [axis,value,less]of [['x',bounds[0],false],['x',bounds[1],true],['y',bounds[2],false],['y',bounds[3],true]]as const)out=clip(out,value,less,axis);return out;}
 function shell(p:T.Vector2[],height:number){if(p.length<3)return;const g=new T.ExtrudeGeometry(new T.Shape(p),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,'brick');}
 function roof(p:T.Vector2[],y:number,high:number,ridge:number,halfwidth:number){if(p.length<3)return;const verts:number[]=[],height=(p:T.Vector2)=>y+(high-y)*Math.max(0,1-Math.abs(p.x-ridge)/halfwidth);for(const left of [true,false]){const part=clip(p,ridge,left);if(part.length<3)continue;const g=new T.ShapeGeometry(new T.Shape(part)),pos=g.getAttribute('position'),ix=g.index!;for(let i=0;i<ix.count;i++){const k=ix.getX(i),q=new T.Vector2(pos.getX(k),pos.getY(k));verts.push(q.x,height(q),q.y);}g.dispose();}for(let i=0;i<p.length;i++){const q=p[i],t=p[(i+1)%p.length];verts.push(q.x,y,q.y,t.x,y,t.y,t.x,height(t),t.y,q.x,y,q.y,t.x,height(t),t.y,q.x,height(q),q.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,'slate');}
 function mass(bounds:number[],h:number,rise=.15){const p=region(bounds);shell(p,h);const xs=p.map(p=>p.x),lo=Math.min(...xs),hi=Math.max(...xs);roof(p,h,h+rise,(lo+hi)/2,(hi-lo)/2);return p;}
 function pane(x:number,y:number,z:number,w:number,h:number,angle=0){const nx=Math.sin(angle),nz=Math.cos(angle);add(new T.PlaneGeometry(w+.20,h+.20),'white',x,y+h/2,z,angle);add(new T.PlaneGeometry(w,h),'glass',x+nx*.035,y+h/2,z+nz*.035,angle);add(new T.PlaneGeometry(w,.075),'white',x+nx*.07,y+h*.70,z+nz*.07,angle);add(new T.PlaneGeometry(.06,h),'white',x+nx*.065,y+h/2,z+nz*.065,angle);box(x+nx*.08,y-.14,z+nz*.08,w+.32,.15,.30,'stone',angle);}
 function arc(x:number,y:number,z:number,w:number,colour:Colour='stone'){add(new T.TorusGeometry(w/2,.095,4,14,Math.PI),colour,x,y,z);box(x,y+w/2-.08,z,.22,.30,.25,colour);}
 function pediment(x:number,y:number,z:number,w:number,h:number){const pts=[[-w/2,0],[w/2,0],[0,h]],g=new T.ShapeGeometry(new T.Shape(pts.map(p=>new T.Vector2(...p as [number,number]))));add(g,'stone',x,y,z);const cut=new T.ShapeGeometry(new T.Shape([new T.Vector2(-w/2+.24,.12),new T.Vector2(w/2-.24,.12),new T.Vector2(0,h-.18)]));add(cut,'brick',x,y,z+.035);}
 function cornice(x:number,y:number,z:number,w:number){for(const [dy,h,d]of [[0,.15,.25],[.15,.22,.42],[.37,.19,.63]])box(x,y+dy,z,w,h,d,'stone');for(let xx=x-w/2+.25;xx<x+w/2;xx+=.47)box(xx,y-.25,z,.16,.30,.32,'stone');}
 function exterior(bounds:number[],h:number,skipFront=false){const p=region(bounds);let area=0;for(let i=0;i<p.length;i++)area+=p[i].x*p[(i+1)%p.length].y-p[(i+1)%p.length].x*p[i].y;for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],d=v.clone().sub(u),len=d.length();if(len<3.8)continue;const t=d.clone().normalize(),n=new T.Vector2(t.y,-t.x).multiplyScalar(area>0?1:-1);if(skipFront&&n.y>.7)continue;const angle=Math.atan2(n.x,n.y),count=Math.round(len/3.4);for(let j=0;j<count;j++){const pt=u.clone().addScaledVector(t,len*(j+.5)/count).addScaledVector(n,.06);for(let y=1.2;y+2.1<h;y+=3.6)pane(pt.x,y,pt.y,1.10,2.0,angle);}}}
 if(id==='hash-marihuana-hemp-museum'){
  const main=region([-10,10,-2.91,20]);shell(main,13.28);roof(main,13.28,16.78,0,2.65);
  // Actual mapped rear recess houses much lower rooms, not a stretched tower.
  mass([-10,10,-6.09,-2.91],4.55,.15);mass([-10,1.15,-20,-6.09],6.65,.22);mass([1.15,10,-20,-6.09],8.56,.10);exterior([-10,10,-2.91,20],13.28,true);exterior([-10,10,-20,-2.91],6.65);
  const z=10.13,w=4.85,cx=0;
  box(cx,0,z,w,3.58,.24,'bronze');for(const x of [-2.24,-.72,.79,2.20])box(x,.07,z+.18,.19,3.42,.24,'bronze');for(const x of [-1.47,.02,1.49]){add(new T.PlaneGeometry(1.15,2.35),'glass',x,1.56,z+.22);box(x,.40,z+.29,1.14,.06,.1,'gold');box(x,2.60,z+.29,1.14,.08,.1,'gold');}box(.02,.05,z+.29,.08,2.75,.10,'bronze');
  for(const y of [3.60,6.88,10.14,13.20])box(cx,y,z+.12,w,.18,.28,'stone');for(let k=0;k<3;k++){const x=(k-1)*1.54;for(const y of [3.94,7.19,10.46]){pane(x,y,z+.20,1.06,2.62);arc(x,y+2.66,z+.27,1.25,'brick');for(const side of [-1,1]){const g=new T.BoxGeometry(.12,.36,.18);g.rotateZ(side*.5);add(g,'white',x+side*.46,y+2.96,z+.31);}box(x,y+3.15,z+.23,.21,.23,.22,'white');}}
  // Original triangular brick gable with white raking trim and lattice bands.
  const triangle=new T.Shape();triangle.moveTo(-w/2,0);triangle.lineTo(w/2,0);triangle.lineTo(0,3.55);triangle.closePath();add(new T.ShapeGeometry(triangle),'brick',0,13.17,z+.12);for(const side of [-1,1]){const v=new T.Vector3(side*w/2,-3.55,0),g=new T.BoxGeometry(.17,v.length(),.26);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));add(g,'white',side*w/4,14.945,z+.26);}pane(0,13.63,z+.29,1.52,1.52);for(const y of [13.30,15.58,16.01]){const width=w*(1-(y-13.17)/3.55);box(0,y,z+.22,width,.06,.10,'white');}for(const x of [-1.62,-1.22,-.9,.9,1.22,1.62]){const top=16.72-Math.abs(x)*3.55/(w/2);if(top>13.35)box(x,13.35,z+.24,.055,top-13.35,.09,'white');}box(0,15.25,z+.49,.1,.2,.86,'dark');box(0,16.74,z+.05,.08,.60,.08,'dark');
  // Museum wording is actual venue signage on its own148 frontage only.
  box(0,3.03,z+.32,4.78,.48,.13,'bronze');sign('HASH MARIHUANA HEMP',0,3.10,z+.41,.040,'gold');box(0,2.73,z+.33,2.01,.30,.12,'bronze');sign('MUSEUM',0,2.79,z+.42,.055,'gold');
 }else{
  // Broad five-bay historical front block and lower service rooms behind it.
  const main=mass([-10,10,-3.50,20],18.52,.66);mass([-10,-1.2,-20,-3.50],11.28,.15);mass([-1.2,3.50,-20,-3.50],4.92,.10);mass([3.50,10,-20,-3.50],8.43,.20);exterior([-10,10,-3.50,20],18.52,true);exterior([-10,10,-20,-3.50],8.4);
  const z=9.02,w=12.40,cx=-.02;box(cx,0,z,w,3.8,.31,'dark');
  // Rusticated ground floor blockwork remains recognisable in the flat palette.
  for(let y=.28;y<3.8;y+=.49){box(cx,y,z+.22,w,.052,.055,'stone');for(let k=0;k<10;k++){const x=-6.12+(k+.5+(Math.round(y/.49)%2)*.5)*1.25;if(x<6.12)box(x,y,z+.22,.045,.47,.055,'stone');}}
  const cols=[-4.95,-2.47,0,2.47,4.95];for(const x of cols){const hh=x===0?2.6:2.23,ww=x===0?1.80:1.38;box(x,.23,z+.30,ww,hh,.09,x===0?'bronze':'glass');arc(x,2.53,z+.37,ww,'stone');for(const side of [-1,1])box(x+side*(ww/2+.13),.18,z+.32,.25,2.40,.26,'stone');if(x===0){box(x,.28,z+.40,.075,2.25,.07,'gold');for(const u of [-.42,.42])for(const yy of [.66,1.66])box(x+u,yy,z+.43,.68,.62,.08,'brick');}else{for(const u of [-.4,0,.4])box(x+u,.29,z+.42,.046,2.26,.07,'dark');}}
  for(const y of [3.82,7.85,11.83,15.69])cornice(cx,y,z+.15,w+.13);
  for(let row=0;row<3;row++)for(const x of cols){const y=4.30+row*3.96;pane(x,y,z+.23,1.40,2.88);for(const side of [-1,1])box(x+side*.85,y-.08,z+.21,.23,3.08,.25,'white');box(x,y+3.06,z+.22,1.95,.20,.32,'white');if(row===0){if(Math.abs(x)>4)pediment(x,y+3.25,z+.27,2.15,.38);else arc(x,y+3.26,z+.29,1.97);}else if(row===2&&x===0)pediment(x,y+3.23,z+.29,2.15,.41);else{arc(x,y+3.09,z+.29,1.90);add(new T.SphereGeometry(.18,6,4),'stone',x,y+3.30,z+.42);}}
  // Two-storey Corinthian pilasters define the three-bay middle risalit.
  for(const x of [-3.76,3.76]){box(x,8.13,z+.27,.39,7.59,.37,'white');box(x,8.13,z+.31,.66,.29,.44,'stone');box(x,15.12,z+.31,.64,.42,.48,'stone');for(const side of [-1,1])add(new T.TorusGeometry(.16,.07,4,8,Math.PI),'stone',x+side*.23,15.26,z+.58);}
  for(const x of cols){pane(x,16.57,z+.23,1.44,1.63);arc(x,18.18,z+.31,1.55);}
  for(const x of [-6.08,-3.74,3.74,6.08])box(x,16.20,z+.27,.32,2.14,.32,'white');cornice(cx,18.52,z+.24,w+.45);
  sign('HEMP GALLERY',2.48,3.20,z+.47,.067,'gold');
 }
}
