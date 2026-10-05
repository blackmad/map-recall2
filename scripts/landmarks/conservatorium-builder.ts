import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './conservatorium-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type C=Parameters<BuildingTools['add']>[1];
/** Original bank/hotel architecture; native metre geometry, explicit open courtyard. */
export function buildConservatorium(_w:number,_d:number,b:BuildingTools):void {
 const angle=source.authorHeadingDegrees*Math.PI/180,[lng,lat]=source.anchor;
 const local=(p:number[])=>{const e=(p[0]-lng)*111320*Math.cos(lat*Math.PI/180),n=(p[1]-lat)*110540;return new T.Vector2(e*Math.sin(angle)+n*Math.cos(angle),e*Math.cos(angle)-n*Math.sin(angle))};
 const rings=source.parents.map(f=>f.geometry.coordinates[0].slice(0,-1).map(local));
 const shape=(r:T.Vector2[])=>new T.Shape(r);
 const clip=(r:T.Vector2[],key:'x'|'y',v:number,above:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],inside=(p:T.Vector2)=>above?p[key]>=v:p[key]<=v;if(inside(p))out.push(p.clone());if(inside(p)!==inside(q))out.push(p.clone().lerp(q,(v-p[key])/(q[key]-p[key])))}return out};
 const zone=(r:T.Vector2[],x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(r,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const body=(r:T.Vector2[],top:number)=>{if(r.length<3)return;b.add(openTopPrism(shape(r),0,3.8),'stone');b.add(openTopPrism(shape(r),3.8,top),'brick')};
 const main=rings[0];
 body(zone(main,-100,100,-100,13.3),19.4);
 body(zone(main,-100,-18,13.3,100),13.1);
 body(zone(main,8,16.2,13.3,100),4.2);
 body(zone(main,16.2,100,13.3,100),19.2);
 body(rings[1],16.4);
 // Major AHN roof patches establish eaves/ridges. The raw LoD2 contours
 // contain equipment/fitted fragments and are evidence, never roof geometry.
 // Each primary assembly is clipped to the actual current Pand perimeter.
 function roof(r:T.Vector2[],eave:number,height:(x:number,z:number)=>number,xCuts:number[],zCuts:number[]){
  if(r.length<3)return;
  const cuts=(lo:number,hi:number,v:number[])=>[lo,...v.filter(x=>x>lo+.001&&x<hi-.001),hi];
  const xs=cuts(Math.min(...r.map(p=>p.x)),Math.max(...r.map(p=>p.x)),xCuts),zs=cuts(Math.min(...r.map(p=>p.y)),Math.max(...r.map(p=>p.y)),zCuts);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
   const poly=zone(r,xs[i],xs[i+1],zs[j],zs[j+1]);if(poly.length<3||Math.abs(T.ShapeUtils.area(poly))<.001)continue;
   const g=upwardRoofPlane(shape(poly)),pos=g.getAttribute('position');for(let k=0;k<pos.count;k++)pos.setY(k,height(pos.getX(k),pos.getZ(k)));g.computeVertexNormals();g.userData.conservatoriumPrimaryRoof=true;b.add(g,'slate');
  }
  // Bound the perimeter against the same surveyed shell. This closes gable
  // ends and short parapet notches; no roof remains floating above a wall.
  const walls:number[]=[];
  for(let i=0;i<r.length;i++){
   const a=r[i],c=r[(i+1)%r.length],ts=[0,1];for(const x of xCuts)if((a.x-x)*(c.x-x)<0)ts.push((x-a.x)/(c.x-a.x));for(const z of zCuts)if((a.y-z)*(c.y-z)<0)ts.push((z-a.y)/(c.y-a.y));ts.sort((x,y)=>x-y);
   for(let j=0;j<ts.length-1;j++){const p=a.clone().lerp(c,ts[j]),q=a.clone().lerp(c,ts[j+1]),hp=height(p.x,p.y),hq=height(q.x,q.y);walls.push(p.x,eave,p.y,q.x,eave,q.y,p.x,hp,p.y,q.x,eave,q.y,q.x,hq,q.y,p.x,hp,p.y);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();b.add(g,'slate');
 }
 const triangular=(v:number,ridge:number,half:number,base:number,top:number)=>base+(top-base)*Math.max(0,1-Math.abs(v-ridge)/half);
 const hipHeight=(x:number,z:number,x0:number,x1:number,z0:number,z1:number,base:number,top:number)=>base+(top-base)*Math.max(0,Math.min(1,(x-x0)/((x1-x0)/2),(x1-x)/((x1-x0)/2),(z-z0)/5,(z1-z)/5));
 // Principal street gables have one unbroken dark pitch each, with the
 // entrance pavilion's taller flattened tent between them.
 for(const [x0,x1] of [[-35.3,-7.8],[4.1,30.9]])roof(zone(main,x0,x1,-100,-8.0),19.4,(_x,z)=>triangular(z,-16.5,9.8,19.4,27.3),[],[-16.5]);
 const tent=zone(main,-7.8,4.1,-100,-8.0);
 roof(tent,19.4,(x,z)=>19.4+11.0*Math.max(0,Math.min(1,(x+7.8)/4.2,(4.1-x)/4.2,(z+26.3)/7.3,(-8-z)/6)),[-3.6,-.1],[-19,-14]);
 roof(zone(main,-100,-18,-8,13.3),19.4,(x,_z)=>triangular(x,-26.1,10,19.4,27.3),[-26.1],[]);
 roof(zone(main,-100,-18,13.3,100),13.1,(x,z)=>hipHeight(x,z,-35.5,-18,13.3,23.7,13.1,21.5),[-26.75],[18.3,18.7]);
 roof(zone(main,16.2,100,-8,13.3),19.4,(x,_z)=>triangular(x,23.5,7.5,19.4,26),[23.5],[]);
 roof(zone(main,16.2,100,13.3,100),19.2,(x,z)=>hipHeight(x,z,16.2,30.7,8.3,35.5,19.2,26),[23.45],[13.3,30.5]);
 b.add(upwardRoofPlane(shape(zone(main,8,16.2,13.3,100)),4.2),'slate');
 roof(rings[1],16.4,(x,z)=>hipHeight(x,z,12.9,29.2,34.9,42.5,16.4,21),[21.05],[38.7]);
 const face=(x:number,y:number,z:number,w:number,h:number,c:C,rot=0)=>b.add(new T.PlaneGeometry(w,h),c,x,y+h/2,z,rot);
 function arch(x:number,y:number,z:number,w:number,h:number,rot:number,stone=true){
  const nx=Math.sin(rot),nz=Math.cos(rot),radius=w/2;
  const s=new T.Shape();s.moveTo(-radius,0);s.lineTo(radius,0);s.lineTo(radius,h-radius);for(let i=0;i<=12;i++){const a=i*Math.PI/12;s.lineTo(radius*Math.cos(a),h-radius+radius*Math.sin(a));}s.closePath();
  const outline=s.clone();if(stone){const g=new T.ShapeGeometry(outline);g.scale((w+.35)/w,(h+.25)/h,1);b.add(g,'stone',x,y-.08,z,rot)}
  b.add(new T.ShapeGeometry(s),'dark',x+nx*.025,y,z+nz*.025,rot);
  const inner=new T.ShapeGeometry(s);inner.scale(.88,.96,1);b.add(inner,'glass',x+nx*.045,y+.04,z+nz*.045,rot);
  b.box(x+nx*.075,y+.06,z+nz*.075,.07,h-.2,.08,'ochre',rot);b.box(x+nx*.075,y+h*.7,z+nz*.075,w*.9,.07,.08,'ochre',rot);
  b.box(x+nx*.05,y-.13,z+nz*.05,w+.4,.16,.28,'stone',rot);
 }
 function facade(r:T.Vector2[],isMain:boolean){
  const signed=T.ShapeUtils.area(r);
  for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],dx=q.x-p.x,dz=q.y-p.y,len=Math.hypot(dx,dz);if(len<4)continue;
   const nx=(signed>0?dz:-dz)/len,nz=(signed>0?-dx:dx)/len,rot=Math.atan2(nx,nz),x=(p.x+q.x)/2,z=(p.y+q.y)/2;
   const top=isMain?(z>13.3&&x< -18?13.1:z>13.3&&x<16.2?4.2:19.3):16.4;
   for(const y of [1,3.75,9.35,14.2,18.9].filter(y=>y<top))b.box(x+nx*.08,y,z+nz*.08,len,.18,.22,'stone',-Math.atan2(dz,dx));
   for(let j=0,n=Math.max(1,Math.round(len/3.2));j<n;j++){
    const t=(j+.5)/n,xx=p.x+dx*t,zz=p.y+dz*t;
    // The central pale entrance is authored separately with its fanlight.
    if(zz< -24&&xx> -7.8&&xx<4.1)continue;
    for(const y of [4.45,10.05,14.85].filter(y=>y+3.3<top+.6))arch(xx+nx*.09,y,zz+nz*.09,1.62,y<5?3.75:3.0,rot);
    face(xx+nx*.06,.45,zz+nz*.06,1.35,.7,'dark',rot);
    // Pale triangular roof dormers sit on the streetward lower slope only.
    if(top>18&&((nz<-.7&&zz< -23)||(nx<-.7&&xx< -33)||(nx>.7&&xx>28))){
     const yy=21.0,xx0=xx-nx*.8,zz0=zz-nz*.8;
     b.box(xx0,yy,zz0,1.65,2.2,1.0,'stone',-Math.atan2(dz,dx));arch(xx0+nx*.55,yy+.12,zz0+nz*.55,1.1,1.7,rot,false);
     const g=new T.ShapeGeometry(new T.Shape([new T.Vector2(-.95,0),new T.Vector2(.95,0),new T.Vector2(0,1.05)]));b.add(g,'stone',xx0+nx*.57,yy+2.2,zz0+nz*.57,rot);
    }
   }
   // Cornice console rhythm stays subordinate to the principal roof silhouette.
   for(let t=1;t<len;t+=1.1)b.box(p.x+dx*t/len+nx*.12,top-.5,p.y+dz*t/len+nz*.12,.22,.35,.28,'stone',-Math.atan2(dz,dx));
  }
 }
 facade(main,true);facade(rings[1],false);
 // Van Baerlestraat central stone risalit: three window bays, raised arched
 // entry, broad semicircular fanlight, triangular top and obelisk finials.
 const cx=-1.9,front=-26.24,rot=Math.PI;
 b.box(cx,3.8,front+.35,10.9,15.7,.55,'stone');
 for(const dx of[-3.2,0,3.2]){arch(cx+dx,5,front-.015,2.15,4.0,rot);arch(cx+dx,10.7,front-.015,2.0,4.3,rot);}
 arch(cx,1.0,front-.04,2.45,3.5,rot);
 const fan=new T.Shape();fan.moveTo(-3.75,0);for(let i=0;i<=24;i++){const a=Math.PI-i*Math.PI/24;fan.lineTo(3.75*Math.cos(a),3.75*Math.sin(a));}fan.closePath();
 b.add(new T.ShapeGeometry(fan),'dark',cx,16.2,front-.06,rot);const f2=new T.ShapeGeometry(fan);f2.scale(.92,.90,1);b.add(f2,'glass',cx,16.3,front-.08,rot);
 for(const dx of[-2.5,-1.25,0,1.25,2.5]){const h=Math.sqrt(3.75**2-dx**2)*.88;b.box(cx+dx,16.2,front-.11,.09,h,.09,'stone');}
 const gable=new T.ShapeGeometry(new T.Shape([new T.Vector2(-5.5,0),new T.Vector2(5.5,0),new T.Vector2(0,8.2)]));b.add(gable,'stone',cx,19.2,front-.025,rot);
 for(const dx of[-1.55,0,1.55])arch(cx+dx,21.1,front-.06,1.05,2.7+(dx===0?.6:0),rot);
 for(const dx of[-5.2,0,5.2]){b.box(cx+dx,dx===0?27.1:19.2,front,.5,.6,.5,'stone');b.add(new T.ConeGeometry(.24,1.2,4),'stone',cx+dx,(dx===0?28.3:20.4),front);}
 // Narrow iron rail crest on the flattened tent top leaves visible sky.
 for(const z of[-18.8,-12.2]){b.box(cx,30.65,z,3.6,.08,.08,'frame');for(let x=cx-1.8;x<=cx+1.81;x+=.45)b.box(x,30.0,z,.06,1.1,.06,'frame');}
 // Polygonal southern corner: its open turret remains an open frame, never
 // an opaque tower extruded to the equipment/crest height.
 const tx=-31.0,tz=-21.2;
 for(let i=0;i<3;i++){const a=Math.PI+(i-1)*Math.PI/4,nx=Math.sin(a),nz=Math.cos(a),x=tx+nx*4.2,z=tz+nz*4.2;
  b.box(x,19.4,z,4.0,.25,.55,'stone',a);const g=new T.ShapeGeometry(new T.Shape([new T.Vector2(-2.0,0),new T.Vector2(2,0),new T.Vector2(0,4.2)]));b.add(g,'stone',x,19.65,z,a);
  b.add(new T.CircleGeometry(.6,16),'dark',x+nx*.05,21.7,z+nz*.05,a);b.add(new T.TorusGeometry(.65,.1,4,16),'stone',x+nx*.09,21.7,z+nz*.09,a);
 }
 const oct=(r:number,y:number,h:number,c:C)=>b.add(new T.CylinderGeometry(r,r,h,8),'stone'===c?'stone':c,tx,y+h/2,tz);
 oct(1.75,25.3,.35,'stone');oct(1.65,28.5,.3,'stone');
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=tx+Math.cos(a)*1.5,z=tz+Math.sin(a)*1.5;b.box(x,25.6,z,.17,2.9,.17,'stone');}
 b.add(new T.ConeGeometry(1.85,2.1,8),'slate',tx,29.85,tz);oct(.85,30.9,.22,'stone');
 for(let i=0;i<8;i++){const a=i*Math.PI/4;b.box(tx+Math.cos(a)*.72,31.1,tz+Math.sin(a)*.72,.10,1.6,.10,'stone');}
 b.add(new T.ConeGeometry(.95,4.5,8),'slate',tx,34.95,tz);b.box(tx,37.2,tz,.10,1.6,.10,'frame');
 // Rear historic U remains a real void. The contemporary atrium is supported
 // by slender dark columns and transparent panes with no opaque backing slab.
 const court=[new T.Vector2(-15.4,-5.7),new T.Vector2(8.4,-5.7),new T.Vector2(8.4,13.2),new T.Vector2(-15.4,13.2)];
 b.add(upwardRoofPlane(shape(court),17.2),'glass');
 for(let x=-15.4;x<=8.5;x+=4.75){b.box(x,0,13.15,.16,17.2,.16,'frame');b.box(x,17.15,3.7,.12,.12,19.0,'frame');}
 for(let z=-5.7;z<=13.21;z+=3.8)b.box(-3.5,17.15,z,23.8,.12,.12,'frame');
 b.box(-3.5,0,13.2,23.8,17.2,.08,'glass');
 for(const y of[0,5.5,11.1,17.1])b.box(-3.5,y,13.25,23.8,.16,.16,'frame');
 // Hotel door faces Paulus Potterstraat on the south-facing wing.
 arch(-35.4,1.0,8.4,2.2,3.8,-Math.PI/2);b.box(-35.5,4.5,8.4,2.8,.18,1.2,'frame',Math.PI/2);
}
