import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './jewish-quarter-footprints.json';

/** Original surveyed synagogue complexes; the Esnoga's forecourt is open. */
export function buildJewishQuarterLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,sign,prism}=b,site=data.sites.find(s=>s.id===id)!,museum=id==='jewish-museum',heading=site.authorHeadingDegrees*Math.PI/180;
 const point=(p:number[])=>{const e=(p[0]-site.anchor[0])*111320*Math.cos(site.anchor[1]*Math.PI/180),n=(p[1]-site.anchor[1])*110540;return new T.Vector2(e*Math.sin(heading)+n*Math.cos(heading),e*Math.cos(heading)-n*Math.sin(heading));};
 const rings=site.buildings.map(f=>f.geometry.coordinates.map(poly=>poly.map(r=>r.slice(0,-1).map(point))));
 function mesh(vertices:number[],colour:'slate'|'brick'|'stone'){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,colour);}
 function hip(x:number,y:number,z:number,l:number,d:number,h:number,angle=0){const v:number[]=[],ridge=Math.max(0,(l-d)/2),p=(a:number,b:number,c:number)=>[x+a*Math.cos(angle)+c*Math.sin(angle),b,z-a*Math.sin(angle)+c*Math.cos(angle)];for(let s of [-1,1]){v.push(...p(-l/2,y,s*d/2),...p(l/2,y,s*d/2),...p(ridge,y+h,0),...p(-l/2,y,s*d/2),...p(ridge,y+h,0),...p(-ridge,y+h,0),...p(s*l/2,y,-d/2),...p(s*l/2,y,d/2),...p(s*ridge,y+h,0));}mesh(v,'slate');}
 function pane(x:number,y:number,z:number,w:number,h:number,angle=0,arched=false){const nx=Math.sin(angle),nz=Math.cos(angle);if(arched){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh,10),'dark',x,y,z,angle);const arch=new T.TorusGeometry(w/2+.09,.095,4,10,Math.PI);add(arch,'red',x,y+h-w/2,z,angle);}else{add(new T.PlaneGeometry(w+.18,h+.18),'stone',x,y+h/2,z,angle);add(new T.PlaneGeometry(w,h),'dark',x+nx*.04,y+h/2,z+nz*.04,angle);}box(x+nx*.08,y,z+nz*.08,.055,h,.075,'frame',angle);for(let yy=.65;yy<h-(arched?w/2:0);yy+=.75)box(x+nx*.075,y+yy,z+nz*.075,w,.05,.07,'frame',angle);}
 function body(poly:T.Vector2[][],h:number){const sh=new T.Shape(poly[0]);sh.holes=poly.slice(1).map(r=>new T.Path(r));const g=new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);add(g,'brick');}
 // A light triangulated pitched cap follows concave cadastral wings exactly.
 function clippedRoof(poly:T.Vector2[][],y:number,rise:number){const sh=new T.Shape(poly[0]);sh.holes=poly.slice(1).map(r=>new T.Path(r));const g=new T.ShapeGeometry(sh),pos=g.getAttribute('position'),ix=g.index!,v:number[]=[];const distance=(p:T.Vector2)=>Math.min(...poly.flatMap(r=>r.map((a,i)=>{const d=r[(i+1)%r.length].clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(d,t));})));function tri(a:T.Vector2,c:T.Vector2,e:T.Vector2,n:number){if(n){const ac=a.clone().add(c).multiplyScalar(.5),ce=c.clone().add(e).multiplyScalar(.5),ea=e.clone().add(a).multiplyScalar(.5);tri(a,ac,ea,n-1);tri(ac,c,ce,n-1);tri(ea,ce,e,n-1);tri(ac,ce,ea,n-1);}else for(const p of [a,c,e])v.push(p.x,y+.02+Math.min(distance(p)*.8,rise),p.y);}for(let i=0;i<ix.count;i+=3){const q=[0,1,2].map(k=>new T.Vector2(pos.getX(ix.getX(i+k)),pos.getY(ix.getX(i+k))));tri(q[0],q[1],q[2],2);}mesh(v,'slate');}
 function wallDetails(poly:T.Vector2[][],height:number,large=false){for(const r of poly){let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],v=c.clone().sub(a),l=v.length();if(l<3)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar(area>0?1:-1),angle=Math.atan2(n.x,n.y),mid=a.clone().add(c).multiplyScalar(.5);box(mid.x+n.x*.12,height-.5,mid.y+n.y*.12,l,.38,.5,'stone',angle);const count=Math.max(1,Math.round(l/(large?5.4:3.2)));for(let k=0;k<count;k++){const q=a.clone().addScaledVector(v,l*(k+.5)/count).addScaledVector(n,.06);if(large){pane(q.x,5.7,q.y,2.8,7.1,angle,true);pane(q.x,14.5,q.y,2.65,2.55,angle);}else pane(q.x,.7,q.y,1.3,Math.min(2.75,height-1.3),angle);}}}}
 if(museum){
  for(let i=0;i<rings.length;i++)for(const p of rings[i]){body(p,i?5.2:6.0);clippedRoof(p,i?5.2:6,2.0);wallDetails(p,i?5.2:6);}
  // Nieuwe Sjoel and Grote Sjoel read as separate halls above the lower
  // Obbene/Dritt ranges. Their cornice and roof silhouettes differ.
  box(-13.6,0,5.3,19.8,14.6,21.4,'brick',-.113);hip(-13.6,14.9,5.3,21.4,19.8,4.2,Math.PI/2-.113);
  box(10.1,0,5.4,18.0,13.3,27.8,'brick',-.078);hip(10.1,13.55,5.4,27.8,18.0,5.0,Math.PI/2-.078);
  hip(10,6,-12.8,17,13,3.9);hip(-7,6,-10.6,14,14,3.5);
  for(const [cx,z,width,h,count]of [[-14.8,15.95,19.8,14.6,5],[9,19.25,18.0,13.3,4]]){const a=cx<0?-.113:-.078;box(cx,h-.35,z,width+.5,.4,.55,'stone',a);box(cx,h,z,width+.65,.25,.65,'stone',a);for(let i=0;i<count;i++){const x=cx+(i-(count-1)/2)*width/(count+.5);const zz=z-(x-cx)*Math.sin(a)+.04;pane(x,7.0,zz,2.25,h-8.0,a,true);pane(x,1.8,zz,1.9,2.15,a);}for(let sx of [-1,1])box(cx+sx*(width/2-.4),.5,z+.15,.35,h-.7,.22,'red');}
  for(const [cx,cz,width,depth,h,a] of [[-13.6,5.3,19.8,21.4,14.6,-.113],[10.1,5.4,18.0,27.8,13.3,-.078]])for(let side of [-1,1]){const angle=side*Math.PI/2+a,x=cx+side*(width/2+.04)*Math.cos(a),z=cz-side*(width/2+.04)*Math.sin(a);for(let k=0;k<4;k++){const u=(k-1.5)*depth/4.5,px=x+u*Math.sin(a),pz=z+u*Math.cos(a);pane(px,6.8,pz,2.1,h-7.8,angle,true);pane(px,1.6,pz,1.7,2.2,angle);}box(x,h-.3,z,.5,.4,depth,'stone',a);}
  // Classical Ionic doorcase and the newer transparent entrance connector.
  box(-14.5,.3,16.8,3.6,5.5,.35,'stone');pane(-14.5,.6,17.02,2.5,4.4);for(let x of [-16.15,-12.85]){box(x,.3,17.0,.3,5.8,.4,'stone');box(x,5.85,17,.75,.3,.6,'stone');add(new T.TorusGeometry(.23,.065,4,8),'stone',x,6.0,17.2);}
  box(-14.5,6.15,17,4.2,.4,.6,'stone');prism(-14.5,6.55,17,4.4,.65,1.15,'stone');
  box(-2.4,0,13.9,4.0,12.8,8.0,'glass');for(let x of [-4.2,-2.4,-.6])box(x,0,18,.10,12.8,.1,'dark');for(let y=1;y<13;y+=1.1)box(-2.4,y,18,4,.08,.1,'dark');box(-2.4,3.25,18.1,4.1,1.5,.2,'white');sign('JOODS',-2.4,4.1,18.3,.10,'blue');sign('MUSEUM',-2.4,3.4,18.3,.09,'blue');
  // Modest cupola over the New Synagogue and its open stone front balustrade.
  add(new T.CylinderGeometry(1.25,1.25,.85,12),'stone',-14.5,19.35,5.2);add(new T.SphereGeometry(1.45,12,6,0,Math.PI*2,0,Math.PI/2),'frame',-14.5,19.75,5.2);add(new T.CylinderGeometry(.16,.24,.7,8),'stone',-14.5,21.5,5.2);add(new T.IcosahedronGeometry(.25,0),'stone',-14.5,22.05,5.2);
  box(-14.5,14.9,16.6,19.5,1.6,.4,'stone');box(-14.5,15.0,16.84,8.8,1.25,.035,'dark');for(let x=-18.8;x<-10;x+=.58)box(x,15,16.91,.16,1.25,.2,'stone');box(-14.5,16.55,16.65,19.8,.2,.65,'stone');
 }else{
  for(let i=0;i<rings.length;i++)for(const p of rings[i]){const h=i===0?19.1:i===2?5.4:4.5;body(p,h);wallDetails(p,h,i===0);if(i)clippedRoof(p,h,i===2?2.25:2.1);}
  // Main 38.6 × 28.4m sanctuary: concealed low hip roof, enormous classical
  // cornice, alternating solid brick bays and open stone balustrades.
  hip(16.5,19.2,-.35,38.6,28.4,3.15);
  for(let side of [-1,1]){box(16.5,18.4,side===1?14.2:-14.85,39.1,.6,.7,'stone');box(16.5,19.0,side===1?14.2:-14.85,39.6,.32,.9,'stone');for(let k=0;k<7;k++){const x=-1.2+k*5.9,z=side===1?14.2:-14.85;box(x,19.3,z,2.4,1.55,.5,'brick');box(x,20.85,z,2.65,.18,.7,'stone');add(new T.CylinderGeometry(.28,.42,.65,8),'stone',x,21.4,z);if(k<6){for(let dx of [1.7,2.25,2.8,3.35,3.9])box(x+dx,19.3,z,.16,1.55,.21,'stone');box(x+2.8,20.85,z,3.55,.18,.7,'stone');}}}
  for(let x of [-3.0,36.0]){box(x,18.4,-.35,.7,.6,28.8,'stone');box(x,19,-.35,.9,.32,29.2,'stone');box(x,19.3,-.35,.55,1.6,17.5,'brick');box(x,20.9,-.35,.8,.18,28.6,'stone');for(let z of [-11.8,-10.9,-10,-9.1,8.6,9.5,10.4,11.3])box(x,19.3,z,.2,1.6,.16,'stone');add(new T.TorusGeometry(.98,.16,4,14),'stone',x+(x<0?-.33:.33),20.35,-.35,x<0?-Math.PI/2:Math.PI/2);add(new T.CircleGeometry(.85,14),'glass',x+(x<0?-.34:.34),20.35,-.35,x<0?-Math.PI/2:Math.PI/2);}
  // Raised entrance gable sits on the actual diagonal western perimeter,
  // leaving the courtyard in front of the sanctuary entirely uncovered.
  const gx=-29.4,gz=-1.0,a=-2.02;const gate=(u:number,y:number,v:number,w:number,h:number,d:number,c:'brick'|'stone'|'dark')=>box(gx+u*Math.cos(a)+v*Math.sin(a),y,gz-u*Math.sin(a)+v*Math.cos(a),w,h,d,c,a);
  gate(0,0,0,5.6,7.2,.5,'brick');pane(gx+Math.sin(a)*.28,.1,gz+Math.cos(a)*.28,3.4,5.9,a,true);gate(0,7.2,0,5.8,.28,.7,'stone');for(let s of [-1,1]){gate(s*2.65,0,.25,.3,7.1,.3,'stone');add(new T.IcosahedronGeometry(.36,1),'stone',gx+s*2.65*Math.cos(a),7.9,gz-s*2.65*Math.sin(a));}
  for(let side of [-1,1]){const shape=new T.Shape();shape.moveTo(side*2.8,4.45);shape.lineTo(side*6.3,4.45);shape.lineTo(side*6.3,4.8);shape.quadraticCurveTo(side*3.7,4.9,side*2.8,7.2);shape.closePath();add(new T.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:false,curveSegments:6}),'brick',gx,0,gz,a);const curve=new T.QuadraticBezierCurve3(new T.Vector3(side*6.3,4.85,.5),new T.Vector3(side*3.7,4.95,.5),new T.Vector3(side*2.8,7.25,.5));add(new T.TubeGeometry(curve,8,.13,4,false),'stone',gx,0,gz,a);}
  // Dormers punctuate the long low street range without flattening its roof.
  for(let z of [-14,-7,7,14]){const x=-29.4-z*.49;box(x,5.0,z,1.6,1.65,1.3,'stone',a);pane(x+Math.sin(a)*.67,5.1,z+Math.cos(a)*.67,1.0,1.35,a);}
 }
}
