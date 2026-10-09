import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import source from './fire-station-anton-footprints.json';
import lettering from './fire-station-anton-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
const groundSamples=source.stationPlot.groundSamples.filter(q=>q.heightNAP!==undefined) as {local:number[],heightNAP:number}[];
/** Native NAP site surface shared by terrain and exposed masonry clipping. */
export function fireStationAntonGroundHeight(x:number,z:number){
 if(x>=-23.4&&x<=-1.2&&z>=21.9&&z<=37.5)return 5-(Math.max(0,z-32)/5.5)*.06;
 if(x>=-23&&x<=-1&&z<=-14)return .06;
 if(x>=-16&&x<=-5&&z>=-14&&z<=-4)return .06+(z+14)/10*4.94;
 const near=groundSamples.map(q=>({q,d:Math.hypot(x-q.local[0],z-q.local[1])})).sort((a,b)=>a.d-b.d).slice(0,3);
 let sum=0,weight=0;for(const {q,d}of near){const w=1/Math.max(.2,d*d);sum+=q.heightNAP*w;weight+=w;}return sum/weight;
}
export function buildFireStationAnton(_w:number,_d:number,b:BuildingTools){
 const a=source.localRotationRadians,c=Math.cos(a),s=Math.sin(a),world=(x:number,z:number)=>new T.Vector2(c*x+s*z,-s*x+c*z);
 const add=(g:T.BufferGeometry,col:C)=>{g.rotateY(a);b.add(g,col)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,aa=0)=>{const p=world(x,z);b.box(p.x,y,p.y,w,h,d,col,a+aa)};
 const ring=source.nativeRing.map(p=>new T.Vector2(p[0],p[1]));
 function clip(ps:T.Vector2[],axis:'x'|'y',v:number,less:boolean){const out:T.Vector2[]=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],u=p[axis],w=q[axis],ip=less?u<=v:u>=v,iq=less?w<=v:w>=v;if(ip)out.push(p);if(ip!==iq)out.push(p.clone().lerp(q,(v-u)/(w-u)));}return out;}
 const main=clip(clip(ring,'x',-6.9,false),'y',-12.6,false),garage=clip(ring,'x',-6.9,true),low=clip(ring,'y',-12.6,true),lower=clip(main,'y',18.2,true);
 const shape=(ps:T.Vector2[])=>new T.Shape(ps.map(p=>world(p.x,p.y)));
 const ground=fireStationAntonGroundHeight;
 function shell(ps:T.Vector2[],bottom:number,top:number){
  // The flat game land does not reliably occlude below-grade mesh. Emit only surveyed
  // exposed wall, retaining the lower rear body without a whole-model datum change.
  const values:number[]=[],area=ps.reduce((sum,p,i)=>sum+p.x*ps[(i+1)%ps.length].y-ps[(i+1)%ps.length].x*p.y,0);
  for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],steps=Math.max(1,Math.ceil(p.distanceTo(q)/.5));for(let k=0;k<steps;k++){
   const u=p.clone().lerp(q,k/steps),v=p.clone().lerp(q,(k+1)/steps),m=u.clone().add(v).multiplyScalar(.5),base=Math.min(top,Math.max(bottom,ground(u.x,u.y),ground(v.x,v.y),ground(m.x,m.y)));
   if(base>=top-.001)continue;const pts=[[u.x,base,u.y],[u.x,top,u.y],[v.x,top,v.y],[v.x,base,v.y]],faces=area>0?[[0,1,2],[0,2,3]]:[[0,2,1],[0,3,2]];
   for(const face of faces)for(const index of face)values.push(...pts[index]);
  }}
  if(values.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.tag='ground-clipped-wall';add(g,'brick');}
 }
 function cap(ps:T.Vector2[],y:number){
  // Survey millimetre jitter along straight sides forms sub-centimetre slivers after quantization.
  // Simplify only roof boundary points within 25mm of their neighboring straight segment.
  const clean=ps.map(p=>p.clone());let changed=true;while(changed&&clean.length>3){changed=false;for(let i=0;i<clean.length;i++){const p=clean[(i+clean.length-1)%clean.length],q=clean[i],r=clean[(i+1)%clean.length],d=r.clone().sub(p),t=q.clone().sub(p).dot(d)/d.lengthSq();if(t>=0&&t<=1&&q.distanceTo(p.clone().addScaledVector(d,t))<.025){clean.splice(i,1);changed=true;break;}}}
  const g=upwardRoofPlane(shape(clean),y);g.userData.tag='roof';b.add(g,'slate');
 }
 shell(ring,0,5);shell(low,5,5.46);cap(low,5.46);shell(garage,5,11.1);cap(garage,11.1);shell(lower,5,8.9);shell(main,8.9,13.95);cap(main,13.95);box(-4.9,5,20.1,4,3.9,3.6,'brick');
 function bands(ps:T.Vector2[],bottom:number,top:number){const colors:C[]=['dark','greyBrick','white','stone','dark','greyBrick','white','greyBrick'];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],d=q.clone().sub(p),len=d.length();if(len<.65)continue;const aa=-Math.atan2(d.y,d.x),steps=Math.max(1,Math.ceil(len/.5));
  const stripe=(y:number,h:number,depth:number,col:C)=>{let start=-1;for(let k=0;k<=steps;k++){const u=p.clone().lerp(q,k/steps),v=p.clone().lerp(q,Math.min(1,(k+1)/steps)),m=u.clone().add(v).multiplyScalar(.5),visible=k<steps&&y>=Math.max(ground(u.x,u.y),ground(v.x,v.y),ground(m.x,m.y));if(visible&&start<0)start=k;if(!visible&&start>=0){const u=p.clone().lerp(q,start/steps),v=p.clone().lerp(q,k/steps),m=u.clone().add(v).multiplyScalar(.5);const g=new T.BoxGeometry(u.distanceTo(v),h,depth);g.rotateY(aa);g.translate(m.x,y+h/2,m.y);g.userData.tag='ground-clipped-band';add(g,col);start=-1;}}};
  for(let y=bottom;y<top-.04;y+=.23)stripe(y,.065,.045,colors[Math.round(y/.23)%colors.length]);stripe(top-.1,.14,.16,'dark');
 }}
 bands(ring,0,5);bands(low,5,5.46);bands(garage,5,11.1);bands(main,8.9,13.95);bands(lower,5,8.9);
 function pane(x:number,y:number,z:number,w:number,h:number,aa=0,col:C='glass',splits=3){const nx=Math.sin(aa),nz=Math.cos(aa),f=(dx:number,yy:number,off:number,ww:number,hh:number,dd:number,cc:C)=>box(x+Math.cos(aa)*dx+nx*off,yy,z-Math.sin(aa)*dx+nz*off,ww,hh,dd,cc,aa);f(0,y-.08,.06,w+.16,h+.16,.1,'dark');const g=new T.BoxGeometry(w,h,.07);g.userData={tag:'pane',local:{x:x+nx*.13,y,z:z+nz*.13,w,h,a:aa}};g.rotateY(aa);g.translate(x+nx*.13,y+h/2,z+nz*.13);add(g,col);for(let k=0;k<=splits;k++)f(-w/2+k*w/splits,y,.19,.07,h,.07,'frame');for(const yy of[y,y+h])f(0,yy,.19,w,.07,.07,'frame');if(h>2.5)f(0,y+h*.78,.19,w,.07,.07,'frame');}
 // Raised front has three white/red apparatus doors; all glazing lies outside masonry.
 for(const x of[-19.9,-15.1,-10.3]){box(x,5,21.96,4.18,4.55,.18,'white');pane(x,5.75,22.07,3.6,3.62,0,'glass',3);box(x,5.12,22.25,3.6,.63,.075,'red');for(let k=0;k<8;k++)box(x,5.12+k*.59,22.3,3.62,.075,.06,'red');for(const dx of[-1.8,0,1.8])box(x+dx,5.12,22.3,.085,4.25,.06,'red');}
 pane(1.85,5.04,21.96,5.7,3.7,0,'glass',4);pane(12.17,5.05,18.95,5.5,3.7,Math.PI/2,'glass',4);
 // White recessed entrance below a genuine cantilever, not an opaque full-height extrusion.
 box(6.7,5,19,7,3.8,.24,'white');pane(6.7,5.12,19.19,2.45,3.45,0,'glass',2);for(const x of[5.43,6.7,7.97])box(x,5.12,19.42,.095,3.45,.09,'red');for(const y of[5.12,8.57])box(6.7,y,19.42,2.64,.09,.09,'red');box(6.7,8.72,20.45,10.8,.14,3,'white');
 // Exact 2025 panorama: the surveyed 1.8m front notch holds the narrow vertical
 // dark/glazed strip. The right office has one broad upper group, not two equal groups.
 box(-2.02,5,21.81,1.8,8.95,.20,'dark');
 pane(-2.02,6.65,21.85,1.5,4.65,0,'glass',1);
 pane(7.22,9.75,21.96,9.65,2.75,0,'glass',4);
 pane(12.17,5.16,3.4,30,2.6,Math.PI/2,'glass',12);for(const z of[-9.4,-6.1,-2.8,.5,3.8,7.1,10.4,13.7,17])pane(12.17,10.2,z,1.2,1.8,Math.PI/2,'glass',1);
 for(const x of[2.2,8.3])pane(x,10.15,-12.68,1.35,1.85,Math.PI,'glass',1);
 pane(5.55,1,-31.53,10.3,3.25,Math.PI,'glass',5);pane(-1.03,1,-23,13.8,3.25,-Math.PI/2,'glass',7);pane(12.17,1,-23,12.8,3,Math.PI/2,'glass',6);
 for(const z of[-8.8,-4.6,-.4])pane(-1.03,10.1,z,1.15,1.8,-Math.PI/2,'glass',1);pane(-1.03,5.13,-4.8,13.6,2.6,-Math.PI/2,'glass',6);pane(-14.6,5.12,1.71,10,2.8,Math.PI,'glass',5);pane(-23.41,5.1,10.7,13.5,3.25,-Math.PI/2,'glass',6);
 function screen(x:number,z:number,w:number,aa:number){for(let y=11.15;y<13.95;y+=.15)box(x,y,z,w,.055,.09,'bronze',aa);for(let xx=-w/2;xx<=w/2+.01;xx+=1.5)box(x+Math.cos(aa)*xx,11.15,z-Math.sin(aa)*xx,.09,2.8,.14,'bronze',aa);}
 screen(-19.42,21.95,7.8,0);screen(-23.38,11.9,19.8,Math.PI/2);screen(-15.2,1.77,16,0);
 // Current 2025 front reference shows a high masonry signage panel beside the slatted end.
 box(-9.22,11.1,21.86,12.6,2.85,.22,'brick');
 for(let y=11.12;y<13.93;y+=.23)box(-9.22,y,22.0,12.6,.065,.05,Math.round(y/.23)%3===0?'white':'greyBrick');
 // Actual operator lettering only, fitted to its real wall plane (approximate Arial Bold).
 const path=new T.ShapePath();for(const cmd of lettering.commands as any[]){if(cmd.type==='M')path.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')path.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')path.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')path.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')path.currentPath?.closePath();}
 const text=new T.ExtrudeGeometry(path.toShapes(),{depth:.025,bevelEnabled:false,curveSegments:3});text.computeBoundingBox();const bb=text.boundingBox!,size=bb.getSize(new T.Vector3());text.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);text.scale(7.8/size.x,.68/size.y,1);text.translate(-9.1,12.45,22.055);add(text,'red');
 for(const z of[3.5,7]){box(3.5,13.95,z,2.7,.85,2.2,'stone');box(3.5,14.8,z,2.85,.12,2.35,'dark');}
 box(2.2,8.6,-13.25,1.9,.18,1.55,'dark');for(let i=0;i<15;i++)box(2.2,5+i*.24,-17+i*.23,1.5,.12,.27,'dark');for(const x of[1.3,3.1])for(let i=0;i<15;i++)box(x,5+i*.24,-17+i*.23,.045,1,.045,'dark');
 // Photo03: separate low-gym exterior stair, at the northwest exposed corner.
 // Twenty-nine approximate treads represent the measured 5.46m roof level; no exact tread claim.
 for(let i=0;i<29;i++)box(-1.95,.05+i*.187,-32.0+i*.29,1.45,.10,.31,'dark');
 box(-1.95,5.46,-23.0,1.65,.14,1.2,'dark');
 for(const x of[-2.73,-1.17])for(let i=0;i<29;i++)box(x,.05+i*.187,-32+i*.29,.045,1.0,.045,'dark');
 // Broad yard stair climbs from the lower court to the raised yard, beside the elbow.
 for(let i=0;i<24;i++)box(-10.8,.05+i*.211,-13.9+i*.41,8.8,.211,.43,'stone');
 for(const x of[-15.2,-6.4])for(let i=0;i<24;i+=3)box(x,.2+i*.211,-13.9+i*.41,.05,1,.05,'dark');
 // Native station grounds, clipped to the genuine OSM amenity plot. AHN DTM constrains
 // the high forecourt/road and the low rear court separately; this is not a five-metre
 // invented driveway rise. The flat game's public-road boundary still requires review.
 const plot=source.stationPlot.ring.slice(0,-1).map(p=>new T.Vector2(p[0],p[1]));
 const terrains=new Map<C,number[]>();
 for(let x=-35;x<24;x+=2)for(let z=-60;z<54;z+=2){let ps=clip(clip(clip(clip(plot,'x',x,false),'x',x+2,true),'y',z,false),'y',z+2,true);if(ps.length<3)continue;
  let dirty=true;while(dirty&&ps.length>3){dirty=false;for(let i=0;i<ps.length;i++){const p=ps[(i+ps.length-1)%ps.length],q=ps[i],r=ps[(i+1)%ps.length],d=r.clone().sub(p),t=q.clone().sub(p).dot(d)/d.lengthSq();if(t>=0&&t<=1&&q.distanceTo(p.clone().addScaledVector(d,t))<.025){ps.splice(i,1);dirty=true;break;}}}
  const triangles=T.ShapeUtils.triangulateShape(ps,[]),paved=(x<-1.2&&z>=21.9&&z<=38)||(x>=-12&&x<=-1.2&&z>38)||(x<-23.4&&z>-18)||(z<-14&&x>-23&&x<17);
  const col:C=paved?'concrete':'green',values=terrains.get(col)??[];for(const t of triangles){const [p,q,r]=t.map(i=>ps[i]);if(Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))/2<.005)continue;let pp=t.map(i=>{const v=ps[i],q=world(v.x,v.y);return new T.Vector3(q.x,ground(v.x,v.y),q.y)});const n=pp[1].clone().sub(pp[0]).cross(pp[2].clone().sub(pp[0]));if(n.y<0)pp=[pp[0],pp[2],pp[1]];for(const p of pp)values.push(p.x,p.y,p.z);}terrains.set(col,values);
 }
 for(const [col,values]of terrains){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.tag='site-ground';b.add(g,col);}
}
