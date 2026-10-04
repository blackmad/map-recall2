import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './small-museums-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original measured museum houses, keeping gardens and attached houses open. */
export function buildSmallMuseumLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const s=data.sites.find(p=>p.id===id)!;const{add,box}=b,a=s.authorHeadingDegrees*Math.PI/180;
 const point=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const ring=s.parent.geometry.coordinates[0].slice(0,-1).map(point);
 function clip(r:T.Vector2[],v:number,less:boolean){const o:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],ip=less?p.y<=v:p.y>=v,iq=less?q.y<=v:q.y>=v;if(ip)o.push(p);if(ip!==iq)o.push(p.clone().lerp(q,(v-p.y)/(q.y-p.y)));}return o;}
 function shell(r:T.Vector2[],bottom:number,top:number,c:Colour='brick'){const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:top-bottom,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);add(g,c);}
 function lid(r:T.Vector2[],y:number,c:Colour='slate'){const g=new T.ShapeGeometry(new T.Shape(r));g.rotateX(Math.PI/2);add(g,c,0,y,0);}
 function face(x:number,y:number,z:number,w:number,h:number,c:Colour,angle=0){add(new T.PlaneGeometry(w,h),c,x,y+h/2,z,angle);}
 function window(x:number,y:number,z:number,w:number,h:number,angle=0,frame:Colour='white',small=false){const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle);face(x,y-.08,z,w+.20,h+.16,frame,angle);face(x+nx*.07,y,z+nz*.07,w,h,'glass',angle);for(const u of [-w/2,w/2])box(x+u*tx+nx*.11,y,z+u*tz+nz*.11,.09,h,.14,frame,angle);box(x+nx*.12,y+h*.70,z+nz*.12,w,.075,.14,frame,angle);box(x+nx*.14,y,z+nz*.14,.065,h*.70,.13,frame,angle);box(x+nx*.10,y-.17,z+nz*.10,w+.38,.17,.32,'stone',angle);if(small){for(const u of [-w/3,w/3])box(x+u*tx+nx*.13,y,z+u*tz+nz*.13,.05,h,.10,frame,angle);}}
 function arch(x:number,y:number,z:number,w:number,h:number,c:Colour='dark'){const p=new T.Shape();p.moveTo(-w/2,0);p.lineTo(w/2,0);p.lineTo(w/2,h-w/2);p.absarc(0,h-w/2,w/2,0,Math.PI,false);p.closePath();add(new T.ShapeGeometry(p,10),c,x,y,z);add(new T.TorusGeometry(w/2+.1,.13,4,12,Math.PI),'stone',x,y+h-w/2,z+.12);for(const u of [-w/2-.1,w/2+.1])box(x+u,y,z+.11,.21,h-w/2,.24,'stone');}
 function triangle(x:number,y:number,z:number,w:number,h:number,c:Colour){add(new T.ShapeGeometry(new T.Shape([new T.Vector2(-w/2,0),new T.Vector2(w/2,0),new T.Vector2(0,h)])),c,x,y,z);}
 function line(p:T.Vector3,q:T.Vector3,width:number,c:Colour){const v=q.clone().sub(p),g=new T.BoxGeometry(width,v.length(),width);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));const m=p.clone().add(q).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);}
 function hip(x:number,z:number,w:number,d:number,eave:number,ridge:number,frontInset:number){const xl=x-w/2,xr=x+w/2,zb=z-d/2,zf=z+d/2,rb=zb+frontInset,rf=zf-frontInset;const ps=[[xl,eave,zb],[xr,eave,zb],[xr,eave,zf],[xl,eave,zf],[x,ridge,rb],[x,ridge,rf]],faces=[[0,1,4],[1,2,5],[1,5,4],[2,3,5],[3,0,4],[3,4,5]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(f=>f.flatMap(i=>ps[i])),3));g.computeVertexNormals();add(g,'slate');}
 function dormer(x:number,z:number,y:number,w:number,h:number,rounded=false,angle=0){box(x,y,z,w,h,.95,'stone');window(x,y+.17,z+.50*Math.cos(angle),w-.35,h-.32,angle,'dark');if(rounded){add(new T.TorusGeometry(w/2,.16,4,12,Math.PI),'white',x,y+h-.12,z+.58);add(new T.CircleGeometry(w/2,12,0,Math.PI),'stone',x,y+h-.12,z+.53);box(x,y+h-.18,z,w+.26,.17,1.11,'white');}else{box(x,y+h,z,w+.32,.19,1.13,'white');triangle(x,y+h+.17,z+.55,w+.32,.46,'stone');}}
 if(id==='kattenkabinet'){
  const front=10.384,cx=-.079,width=14.92;
  // The lower mapped rear returns are retained independently of the front house.
  shell(ring,0,9.65);shell(clip(ring,-6.55,false),9.65,13.86);lid(clip(ring,-6.55,true),9.69);
  hip(cx,1.917,width,16.934,13.86,19.53,4.48);
  box(cx,13.69,front+.04,width+.20,.22,.34,'stone');box(cx,13.92,front+.05,width+.39,.25,.49,'white');
  const axes=Array.from({length:6},(_,i)=>cx-width/2+width*(i+.5)/6);
  // Tall beletage, shorter upper T-windows and low basement/storey match the photo.
  for(const x of axes){window(x,3.04,front+.12,1.66,3.32,0,'dark');window(x,7.27,front+.12,1.66,2.75,0,'dark');window(x,10.79,front+.12,1.66,2.35,0,'dark');for(const [y,h]of [[3.04,3.32],[7.27,2.75]]){for(const u of [-.93,.93])box(x+u,y-.10,front+.22,.13,h+.29,.14,'white');box(x,y+h+.08,front+.23,2.02,.15,.25,'white');}}
  for(const x of [axes[0],axes[1],axes[4],axes[5]])window(x,.64,front+.12,1.67,1.59,0,'dark',true);
  box(cx,2.39,front+.14,width,.26,.34,'stone');for(const x of [-width/2+.14,width/2-.14])box(cx+x,0,front+.05,.29,13.67,.13,'stone');
  // Museum entrance is now at pavement level; the1837-removed stoop is absent.
  face(cx,.13,front+.17,2.26,2.04,'dark');for(const x of [cx-.56,cx+.56]){face(x,.32,front+.22,.84,1.29,'glass');box(x,1.75,front+.27,.73,.08,.12,'gold');}box(cx,.12,front+.27,.11,2.04,.13,'stone');for(const x of [cx-1.22,cx+1.22])box(x,.12,front+.22,.16,2.13,.17,'stone');face(cx,2.18,front+.23,3.35,.16,'glass');
  // Central risalit carries the surviving original triangular pediment.
  for(const x of [cx-2.43,cx+2.43])box(x,2.55,front+.17,.16,11.13,.17,'stone');triangle(cx,14.17,front+.27,5.35,1.30,'brick');box(cx,14.10,front+.27,5.56,.17,.28,'white');for(const sign of [-1,1])line(new T.Vector3(cx+sign*2.70,14.22,front+.35),new T.Vector3(cx,15.48,front+.35),.15,'stone');
  add(new T.CircleGeometry(.35,12),'stone',cx,14.66,front+.40);for(const sign of [-1,1])for(let j=0;j<4;j++){const g=new T.SphereGeometry(.11,6,4);add(g,'stone',cx+sign*(.49+j*.20),14.65-j*.07,front+.39);}
  for(const x of [cx-4.92,cx+4.92])dormer(x,8.94,15.60,1.15,1.37);for(const x of [-6.48,6.25]){box(x,14.10,-.84,.83,5.60,.80,'brick');box(x,19.65,-.84,1.04,.20,1.0,'stone');}
  // Source rear facade has three six-bay rows; no garden is fabricated.
  for(const x of axes)for(const [y,h]of [[1.05,3.25],[5.07,2.87],[9.02,2.51]])window(x,y,-6.68,1.55,h,Math.PI,'white',true);
  for(const x of [cx-4.90,cx+4.90])dormer(x,-5.67,14.08,1.30,1.42,false,Math.PI);
  // Small oval cat plaque and paired wall lanterns identify the actual museum.
  const oval=new T.CircleGeometry(.36,16);oval.scale(.74,1,1);add(oval,'white',cx,3.06,front+.46);add(new T.CircleGeometry(.12,10),'dark',cx,3.06,front+.47);triangle(cx-.065,3.13,front+.48,.13,.13,'dark');triangle(cx+.065,3.13,front+.48,.13,.13,'dark');
  for(const x of [cx-2.8,cx+2.8]){box(x,2.93,front+.32,.16,.66,.17,'dark');box(x,3.24,front+.49,.29,.41,.29,'gold');b.hip(x,3.65,front+.49,.45,.45,.22,'dark');}
 }else if(id==='pianola-museum'){
  const front=8.147,cx=.14,width=13.94;
  // Actual rear flat roofs9.2m/12.85m remain below the16.37m front ridge.
  const main=ring.map(p=>p.y>front?new T.Vector2(p.x,front):p.clone());shell(main,0,9.20);shell(clip(main,.35,false),9.20,12.84);lid(clip(main,.35,true),9.25);lid(clip(clip(main,.35,false),2.30,true),12.91);
  const roofPs=[[-6.92,12.84,2.30],[7.0,12.84,2.30],[7.0,12.84,front],[-6.92,12.84,front],[-6.92,16.37,5.56],[7.0,16.37,5.56]],faces=[[0,1,5],[0,5,4],[3,2,5],[3,5,4],[0,4,3],[1,2,5]],rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(f=>f.flatMap(i=>roofPs[i])),3));rg.computeVertexNormals();add(rg,'red');
  for(const y of [3.96,7.57,11.45])box(cx,y,front+.10,width,.18,.23,'red');box(cx,12.42,front+.16,width+.13,.20,.39,'stone');box(cx,12.65,front+.18,width+.27,.19,.53,'white');
  for(const x of [-5.47,-2.52,.37,3.28,5.70]){window(x,8.29,front+.14,1.47,2.82);box(x,11.21,front+.25,1.85,.15,.23,'stone');}
  for(const x of [-5.47,-2.52,.37]){window(x,4.78,front+.14,1.49,2.21);box(x,7.24,front+.25,1.91,.16,.23,'stone');}
  // Segmental ground-window headers and richly framed central double door.
  for(const x of [-5.47,-2.52,3.13,5.82]){window(x,.78,front+.14,1.59,2.01);box(x,2.94,front+.22,1.93,.18,.27,'stone');add(new T.TorusGeometry(1.02,.13,4,12,Math.PI*.48),'stone',x,2.14,front+.27,Math.PI*.26);}
  arch(.35,.12,front+.28,2.09,3.47);for(const u of [-.52,.52]){face(.35+u,.39,front+.35,.83,2.42,'glass');for(let y=.60;y<2.8;y+=.42)box(.35+u,y,front+.42,.78,.045,.07,'stone');for(const q of [-.24,.24])box(.35+u+q,.42,front+.42,.045,2.35,.07,'stone');}box(.35,3.87,front+.32,3.76,.38,.40,'white');b.sign('PIANOLA MUSEUM',.35,3.92,front+.55,.045,'dark');
  for(const x of [-1.31,1.93]){box(x,3.92,front+.18,.20,12.20,.28,'stone');for(const y of [4.31,7.65,11.55,15.94])box(x,y,front+.28,.42,.19,.44,'stone');}
  // Actual central tower sits in front of the ridge, with a six-slot crown.
  box(.17,12.84,6.84,3.34,2.89,2.59,'brick');window(.17,13.17,front+.17,1.12,2.16);box(.17,15.55,front+.14,3.38,.23,.40,'stone');for(const x of [-1.43,1.78]){box(x,15.60,front,.31,.91,.47,'stone');add(new T.SphereGeometry(.19,6,4),'stone',x,16.54,front);}for(let j=0;j<7;j++)box(-1.08+j*.39,15.77,front+.07,.12,.61,.22,'brick');box(.17,16.25,front+.07,3.31,.15,.35,'stone');
  for(const x of [-4.7,4.85])dormer(x,7.46,13.43,1.55,1.43,true);
  // The mapped bay projects only above the ground storey, leaving its door below.
  const oriel=[new T.Vector2(2.2968,front),new T.Vector2(3.0751,9.0177),new T.Vector2(5.6184,9.0239),new T.Vector2(6.3997,front)];shell(oriel,4.61,7.56,'stone');lid(oriel,7.61);for(const [x,z,ang,w]of [[4.35,9.06,0,2.12],[2.67,8.58,-Math.PI/4,.84],[6.03,8.59,Math.PI/4,.84]])window(x,4.99,z,w,2.25,ang);for(const x of [3.34,4.40,5.44]){box(x,4.44,9.07,.15,.21,.41,'dark');box(x,4.03,8.53,.18,.40,.44,'bronze');}box(4.35,4.59,9.08,2.81,.20,.29,'bronze');for(const x of [3.46,4.35,5.24]){add(new T.CircleGeometry(.14,10),'gold',x,4.70,9.25);}
  for(const x of [-6.47,6.56]){box(x,13.0,5.45,.58,3.17,.61,'brick');box(x,16.16,5.45,.82,.20,.82,'stone');box(x,16.37,5.45,.25,.42,.25,'dark');}
  // Quiet rear/side windows preserve the actual lower annexes' scale.
  for(const x of [-5.30,-1.67,1.98,5.55])for(const y of [1.25,4.5,7.25])window(x,y,-9.11,1.37,1.45,Math.PI);for(const side of [-1,1])for(const z of [-6.2,-3.1])for(const y of [1.3,4.6,7.2])window(side*6.94,y,z,1.39,1.45,side*Math.PI/2);
 }
}
