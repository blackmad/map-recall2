import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './keizersgrachtkerk-footprints.json';
/** Original texture-free neo-Venetian church, exact current BAG parent, native scale. */
export function buildKeizersgrachtkerk(_w:number,_d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const {basisAcross:u,basisOut:n,frontMidNative:m}=source;
 function add(g:T.BufferGeometry,c:C,x=0,y=0,z=0){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const xx=x+p.getX(i),zz=z+p.getZ(i);p.setXYZ(i,m[0]+u[0]*xx+n[0]*zz,y+p.getY(i),m[1]+u[1]*xx+n[1]*zz);}if(u[0]*n[1]-u[1]*n[0]<0){if(g.index){for(let i=0;i<g.index.count;i+=3){const j=g.index.getX(i+1);g.index.setX(i+1,g.index.getX(i+2));g.index.setX(i+2,j);}}else{for(let i=0;i<p.count;i+=3){const a=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)];p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,...a as [number,number,number]);}}}g.computeVertexNormals();if(c==='glass')g.userData.facadeFacing=n;b.add(g,c);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:C){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z);}
 function profile(points:number[][],c:C,z=.035,depth=.08){add(new T.ExtrudeGeometry(new T.Shape(points.map(p=>new T.Vector2(p[0],p[1]))),{depth,bevelEnabled:false}),c,0,0,z);}
 function rod(a:number[],q:number[],r:number,c:C){const v=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));const mid=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);add(g,c,mid.x,mid.y,mid.z);}
 function ring(x:number,y:number,z:number,r:number,t:number,c:C){add(new T.TorusGeometry(r,t,5,24),c,x,y,z);}
 // Survey roof regions inform original planar shells; photographs supply facade, not pixels.
 add(openTopPrism(new T.Shape(source.localRing.map(p=>new T.Vector2(p[0],p[1]))),0,15.0),'stone');
 for(const [ri,roof] of source.surveyRoofPlanes.entries()){if([0,4,5,10,11,12,13].includes(ri))continue;const pts=roof.rings[0],shape=new T.Shape(pts.map(p=>new T.Vector2(p[0],p[2]))),base=Math.min(...pts.map(p=>p[1]));for(const hole of roof.rings.slice(1))shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],p[2]))));
  add(openTopPrism(shape,0,base),'stone');const g=new T.ShapeGeometry(shape),p=g.getAttribute('position');
  // Centered least squares uses all plane points, never a rounded near-collinear triple.
  const all=roof.rings.flat(),mean=all.reduce((s,p)=>s.map((v,i)=>v+p[i]/all.length),[0,0,0]);let xx=0,xz=0,zz=0,xy=0,zy=0;for(const v of all){const x=v[0]-mean[0],z=v[2]-mean[2],y=v[1]-mean[1];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,A=(xy*zz-zy*xz)/det,B=(zy*xx-xy*xz)/det;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,mean[1]+A*(x-mean[0])+B*(z-mean[2]),z);}const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<0){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k);}}g.userData.role='roof';add(g,'slate');
  const sides:number[]=[];for(const ps of roof.rings)for(let i=0;i<ps.length;i++){const a=ps[i],q=ps[(i+1)%ps.length];sides.push(a[0],base,a[2],q[0],base,q[2],q[0],q[1],q[2],a[0],base,a[2],q[0],q[1],q[2],a[0],a[1],a[2]);}const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(sides,3));add(skirt,'stone');
 }
 // The rejected survey tower fits owned small irregular junction strips outside
 // the photo-supported square tents. Preserve their exact source plan regions,
 // continuing adjacent hall planes or the bounded tent eave, rather than capping the parent.
 for(const closure of source.roofJunctionClosures){
  const plane=source.surveyRoofPlanes[closure.heightMode==='mainhall-west-plane'?9:14].rings.flat(),mean=plane.reduce((s,p)=>s.map((v,i)=>v+p[i]/plane.length),[0,0,0]);let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of plane){const x=p[0]-mean[0],z=p[2]-mean[2],y=p[1]-mean[1];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,A=(xy*zz-zy*xz)/det,B=(zy*xx-xy*xz)/det;
  const shape=new T.Shape(closure.polygon.map(p=>new T.Vector2(p[0],p[1]))),g=new T.ShapeGeometry(shape),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),y=closure.heightMode==='tent-eave-shoulder'?18.55:mean[1]+A*(x-mean[0])+B*(z-mean[2]);p.setXYZ(i,x,y,z);}const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<0){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k);}}g.userData.role='roof';g.userData.sourcePart=`tower-hall-junction-${closure.sourceRegion}`;add(g,'slate');
 }
 // Photographed roof-light bands: five broad white timber Gothic windows in each slope.
 for(const side of [-1,1])for(let bay=0;bay<5;bay++){const x=side*4.69,z=-5.08-bay*3.89;box(x,15.61,z,.10,2.67,3.53,'white');box(x+side*.075,15.73,z,.06,2.42,3.30,'glass');for(const dz of [-1.08,0,1.08])box(x+side*.12,15.77,z+dz,.05,2.35,.055,'white');for(const y of [16.53,17.25])box(x+side*.12,y,z,.05,.06,3.29,'white');for(let i=0;i<16;i++){const a=Math.PI*i/16,c=Math.PI*(i+1)/16;rod([x+side*.13,16.50+1.61*Math.sin(a),z+1.61*Math.cos(a)],[x+side*.13,16.50+1.61*Math.sin(c),z+1.61*Math.cos(c)],.028,'white');}}
 // Observed square wooden roof ventilator with metal tent cap.
 box(0,21.12,-12.2,.76,.86,.76,'stone');for(const y of [21.4,21.57,21.74])box(0,y,-11.81,.67,.055,.055,'dark');const cap=new T.ConeGeometry(.63,.42,4);cap.rotateY(Math.PI/4);add(cap,'slate',0,22.19,-12.2);
 const width=source.width,half=width/2;
 // Pale stone divisions and brick fields form the observed canal-side wall.
 box(0,0,.06,width,2.45,.10,'stone');box(0,2.45,.08,width,5.55,.10,'stone');
 for(let y=2.8;y<7.4;y+=.83)box(0,y,.15,width,.33,.08,'brick');
 for(const x of [-half+.3,-4.66,4.66,half-.3])box(x,2.45,.21,.47,14.4,.18,'stone');
 for(const y of [2.45,7.35,7.65,11.65,12.0]){box(0,y,.23,width+.07,.18,.36,'stone');}
 function pointed(x:number,y:number,w:number,h:number,c:C,z:number){const shoulder=y+h-w*.58;profile([[x-w/2,y],[x+w/2,y],[x+w/2,shoulder],[x+w*.35,shoulder+w*.25],[x,y+h],[x-w*.35,shoulder+w*.25],[x-w/2,shoulder]],c,z,.055);}
 // The source portal has circular Gothic shoulders and a shallow pointed apex.
 // Two equal circle arcs meet at the apex; their tangent approaches vertical at the jamb.
 function portal(x:number,y:number,w:number,h:number,c:C,z:number){const r=w/2,rise=w*.56,shoulder=y+h-rise,offset=(rise*rise-r*r)/(2*r),radius=r+offset,angle=Math.atan2(rise,offset),points=[[x-r,y],[x+r,y],[x+r,shoulder]];for(let i=1;i<=24;i++){const a=angle*i/24;points.push([x-offset+radius*Math.cos(a),shoulder+radius*Math.sin(a)]);}for(let i=23;i>=0;i--){const a=angle*i/24;points.push([x+offset-radius*Math.cos(a),shoulder+radius*Math.sin(a)]);}profile(points,c,z,.055);}
 // Six lobes share one dark opening. The pale perimeter never crosses its centre.
 function towerSixfoil(x:number,y:number){const points:number[][]=[],centres=.355,lobe=.285;for(let i=0;i<96;i++){const theta=i*Math.PI*2/96;let radius=0;for(let j=0;j<6;j++){const angle=Math.PI/2+j*Math.PI/3,delta=theta-angle,disc=lobe*lobe-centres*centres*Math.sin(delta)**2;if(disc>=0)radius=Math.max(radius,centres*Math.cos(delta)+Math.sqrt(disc));}points.push([Math.cos(theta)*radius,Math.sin(theta)*radius]);}profile(points.map(p=>[x+p[0]*(1+.065/.64),y+p[1]*(1+.065/.64)]),'stone',.39,.055);profile(points.map(p=>[x+p[0],y+p[1]]),'glass',.47,.055);}
 function lancet(x:number,y:number,w:number,h:number){pointed(x,y-.09,w+.19,h+.18,'stone',.30);pointed(x,y,w,h,'glass',.40);box(x,y+.07,.51,.065,h-.37,.06,'stone');box(x,y+h*.45,.51,w,.065,.06,'stone');}
 // Seven gallery lights and paired tower lights. Front glazing is exposed beyond parent walls.
 for(let i=-3;i<=3;i++){const x=i*1.17;lancet(x,8.10,.94,3.05);for(const dx of [-.54,.54]){box(x+dx,7.95,.58,.13,2.67,.17,'stone');add(new T.SphereGeometry(.13,6,4),'stone',x+dx,10.64,.58);}rod([x-.56,11.16,.59],[x,11.70,.59],.065,'stone');rod([x,11.70,.59],[x+.56,11.16,.59],.065,'stone');}
 for(const x of [-5.65,5.65]){for(const dx of [-.48,.48])lancet(x+dx,8.10,.76,2.98);box(x,7.7,.40,2.26,.19,.47,'stone');for(const dx of [-.43,.43])lancet(x+dx,4.65,.78,1.90);box(x,4.42,.40,2.02,.21,.48,'stone');for(const dx of [-.61,0,.61])box(x+dx,4.11,.29,.17,.31,.26,'stone');}
 for(let x=-6.65;x<6.8;x+=.34)box(x,7.9,.58,.025,.37,.025,'bronze');box(0,8.25,.58,13.4,.04,.05,'bronze');
 // Central point and two tower front gables, observed cream embossed tile field.
 profile([[-4.52,12.06],[4.52,12.06],[4.52,15.40],[0,21.25],[-4.52,15.40]],'stone',.12,.12);
 pointed(0,12.23,8.42,5.42,'brick',.30);
 rod([-4.58,15.44,.37],[0,21.43,.37],.12,'slate');rod([0,21.43,.37],[4.58,15.44,.37],.12,'slate');
 // Six petal tracery around the rose's central eye; actual circular window geometry.
 add(new T.CircleGeometry(2.10,40),'glass',0,14.84,.44);ring(0,14.84,.53,2.13,.12,'stone');ring(0,14.84,.56,.78,.09,'stone');for(let i=0;i<6;i++){const a=i*Math.PI/3;ring(Math.sin(a)*1.15,14.84+Math.cos(a)*1.15,.55,.72,.065,'stone');}
 for(const x of [-3.05,3.05]){add(new T.CircleGeometry(.26,14),'glass',x,13.09,.46);ring(x,13.09,.53,.28,.065,'stone');}
 for(const x of [-5.65,5.65]){profile([[x-1.62,12.05],[x+1.62,12.05],[x+1.62,17.56],[x,19.6],[x-1.62,17.56]],'stone',.19,.12);pointed(x,13.05,2.52,2.08,'brick',.37);ring(x,14.08,.49,.55,.09,'stone');for(const dx of [-.70,0,.70])lancet(x+dx,15.37,.40,.72);towerSixfoil(x,17.02);for(const dx of [-1.5,1.5]){box(x+dx,17.56,.34,.18,1.17,.18,'stone');add(new T.ConeGeometry(.14,.55,6),'slate',x+dx,18.99,.34);}rod([x-1.63,17.56,.43],[x,19.65,.43],.09,'slate');rod([x,19.65,.43],[x+1.63,17.56,.43],.09,'slate');}
 for(const x of [-5.65,5.65]){
  const shape=new T.Shape([new T.Vector2(x-1.6,0),new T.Vector2(x+1.6,0),new T.Vector2(x+1.6,-3.2),new T.Vector2(x-1.6,-3.2)]);add(openTopPrism(shape,15,18.55),'stone');
  const vertices:number[]=[];const ring=[[x-1.6,18.55,0],[x+1.6,18.55,0],[x+1.6,18.55,-3.2],[x-1.6,18.55,-3.2]],tip=[x,23.65,-1.6];for(let i=0;i<4;i++){const a=ring[i],q=ring[(i+1)%4];vertices.push(...a,...q,...tip);rod(a,tip,.035,'frame');}const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roof.userData.role='roof';add(roof,'slate');
 }
 for(const x of [-5.65,5.65]){add(new T.SphereGeometry(.12,6,4),'bronze',x,24.1,-1.6);box(x,23.3,-1.6,.085,.72,.085,'bronze');}
 // Nine native steps terminate at recessed glass doors, with a broad Gothic portico.
 portal(0,1.0,5.8,5.65,'stone',.28);portal(0,1.48,5.18,4.87,'dark',.39);portal(0,1.55,4.72,4.45,'glass',.49);for(const x of [-1.57,0,1.57])box(x,1.55,.58,.07,3.45,.07,'frame');for(const y of [3.0,4.63])box(0,y,.58,4.65,.065,.07,'frame');
 for(let i=0;i<9;i++)box(0,i*.165,1.65-i*.145,5.17,.165,.18,'slate');for(const x of [-2.48,2.48])rod([x,.35,1.69],[x,1.94,.37],.035,'dark');
 for(const x of [-3.4,3.4]){ring(x,6.0,.40,.30,.10,'stone');rod([x,5.65,.43],[x,4.87,.72],.035,'bronze');box(x,4.33,.74,.25,.55,.22,'bronze');}
 box(5.72,.12,.38,1.04,1.95,.12,'dark');for(const x of [-6.36,-4.93])box(x,.71,.25,.47,.51,.07,'glass');
 // Fourpass at the gable apex, subordinate geometric tile relief rather than a texture.
 for(const [dx,dy]of [[-.16,0],[.16,0],[0,-.16],[0,.16]]){add(new T.CircleGeometry(.17,12),'dark',dx,19.29+dy,.38);ring(dx,19.29+dy,.45,.18,.04,'stone');}
 for(let y=17.1;y<19.2;y+=.43)for(let x=-1.2;x<1.3;x+=.43){if(Math.abs(x)>(21.2-y)*.68-.55)continue;ring(x,y,.32,.11,.014,'white');}
}
