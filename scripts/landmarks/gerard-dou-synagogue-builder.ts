import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import source from './gerard-dou-synagogue-footprints.json';
/** Newell polygon normal: robust when the first ring vertices are collinear (survey walls 10 and 16 start with a vertical run). */
function newell(pts:T.Vector3[]){const n=new T.Vector3();for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];n.x+=(a.y-b.y)*(a.z+b.z);n.y+=(a.z-b.z)*(a.x+b.x);n.z+=(a.x-b.x)*(a.y+b.y);}return n.normalize();}
/** Original flat-colour reconstruction; native east/south metres, no imported meshes or photo pixels. */
export function buildGerardDouSynagogue(_w:number,_d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];
 const ring=source.localRing.map(p=>new T.Vector2(p[0],p[1])),start=ring[0],end=ring[1],u=end.clone().sub(start).normalize(),n=new T.Vector2(-u.y,u.x),w=start.distanceTo(end),mid=start.clone().lerp(end,.5);
 function transform(g:T.BufferGeometry,x=0,y=0,z=0){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=mid.clone().addScaledVector(u,x+p.getX(i)).addScaledVector(n,z+p.getZ(i));p.setXYZ(i,q.x,y+p.getY(i),q.y);}g.computeVertexNormals();return g;}
 function add(g:T.BufferGeometry,col:C,x=0,y=0,z=0,role='detail'){g.userData.role=role;b.add(transform(g,x,y,z),col);}
 function box(x:number,y:number,z:number,ww:number,h:number,d:number,col:C,role='detail'){add(new T.BoxGeometry(ww,h,d),col,x,y+h/2,z,role);}
 function polygon(pts:number[][],col:C,z=.11,depth=.10,role='detail'){add(new T.ExtrudeGeometry(new T.Shape(pts.map(p=>new T.Vector2(p[0],p[1]))),{depth,bevelEnabled:false}),col,0,0,z,role);}
 // Build native original wall surfaces and roof panels from the survey envelope; explicit roofs own all tops.
 const V=source.surveyVertices.map(p=>new T.Vector3(p[0],p[1],p[2]));
 for(const s of source.surveySurfaces){if(s.type==='GroundSurface')continue;const ids=s.rings[0],points=ids.map(i=>V[i]);const normal=newell(points),ax=points.map((p,i)=>points[(i+1)%points.length].clone().sub(p)).sort((a,c)=>c.lengthSq()-a.lengthSq())[0].normalize(),ay=normal.clone().cross(ax),origin=points[0];const p2=points.map(p=>{const q=p.clone().sub(origin);return new T.Vector2(q.dot(ax),q.dot(ay));});const faces=T.ShapeUtils.triangulateShape(p2,[]),positions:number[]=[];for(const face of faces){let inds=face;if(s.type==='RoofSurface'){const q=face.map(i=>points[i]);if(q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0])).y<0)inds=[face[0],face[2],face[1]];}for(const i of inds)positions.push(...points[i].toArray());}let g:T.BufferGeometry;if(s.type==='RoofSurface'&&Math.abs(normal.y)>.97){g=upwardRoofPlane(new T.Shape(points.map(p=>new T.Vector2(p.x,p.z))));const pp=g.getAttribute('position');for(let i=0;i<pp.count;i++)pp.setY(i,origin.y-(normal.x*(pp.getX(i)-origin.x)+normal.z*(pp.getZ(i)-origin.z))/normal.y);}else{g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();}g.userData.role=s.type==='RoofSurface'?'roof':'survey-wall';b.add(g,s.type==='RoofSurface'?(Math.abs(normal.y)>.97?'slate':'bronze'):'brick');}
 // The principal high hall is the street-facing native edge0→1. The small recessed bay is1→3.
 const L=-w/2,R=w/2,shoulder=9.5,top=17.02,crownHalf=1.43;
 polygon([[L,0],[R,0],[R,shoulder],[crownHalf,15.65],[crownHalf,top],[-crownHalf,top],[-crownHalf,15.65],[L,shoulder]],'brick',.015,.10,'principal-gable');
 // White horizontal masonry bands visible in both2005 and2025. Upper bands stop at the arch openings.
 for(const y of [.35,1.25,2.55,3.85,5.12,6.45,7.76,9.13,10.35])box(0,y,.14,w,.13,.15,'white');
 for(const y of [11.6,12.75,14.05]){const half=w/2-(y-shoulder)*(w/2-crownHalf)/(15.65-shoulder);box(0,y,.14,half*2,.12,.14,'white');}
 for(const x of [L+.18,R-.18])for(let y=1.6;y<10;y+=1.18)box(x,y,.19,.40,.23,.17,'stone');
 function archShape(x:number,y:number,ww:number,straight:number,rise=ww/2){const pts=[[x-ww/2,y],[x+ww/2,y],[x+ww/2,y+straight]];for(let i=1;i<=24;i++){const a=i*Math.PI/24;pts.push([x+ww/2*Math.cos(a),y+straight+rise*Math.sin(a)]);}return pts;}
 function archedWindow(x:number,y:number,ww:number,h:number,rise:number,rows:number,role:string){polygon(archShape(x,y,ww+.24,h,rise+.12),'white',.22,.12);polygon(archShape(x,y+.10,ww,h-.10,rise),'glass',.37,.04,role);for(const dx of [-ww/2,ww/2])box(x+dx,y,.43,.065,h,.04,'white');box(x,y,.43,.065,h,.04,'white');for(const dx of [-ww*.29,ww*.29])box(x+dx,y,.43,.044,h,.04,'white');for(let j=1;j<rows;j++)box(x,y+h*j/rows,.43,ww,.055,.04,'white');const apts:number[][]=[];for(let i=0;i<=24;i++){const a=i*Math.PI/24;apts.push([x+(ww/2+.13)*Math.cos(a),y+h+(rise+.13)*Math.sin(a)]);}for(let i=24;i>=0;i--){const a=i*Math.PI/24;apts.push([x+ww/2*Math.cos(a),y+h+rise*Math.sin(a)]);}polygon(apts,'white',.43,.035);// Photo2005: nested concentric arches, with short connecting bars only between the rings.
for(const scale of [.36,.70]){const pts:number[][]=[];for(let i=0;i<=24;i++){const a=i*Math.PI/24;pts.push([x+(ww/2*scale+.028)*Math.cos(a),y+h+(rise*scale+.028)*Math.sin(a)]);}for(let i=24;i>=0;i--){const a=i*Math.PI/24;pts.push([x+(ww/2*scale-.028)*Math.cos(a),y+h+(rise*scale-.028)*Math.sin(a)]);}polygon(pts,'white',.46,.035,'concentric-arch-frame');}
for(const angle of [Math.PI/4,Math.PI*3/4])stroke([x+ww/2*.70*Math.cos(angle),y+h+rise*.70*Math.sin(angle)],[x+ww/2*Math.cos(angle),y+h+rise*Math.sin(angle)],.048,'white',.47);
stroke([x,y+h+rise*.36],[x,y+h+rise],.050,'white',.47);
for(const dx of [-1,1])stroke([x+dx*ww*.18,y+h],[x+dx*ww*.18,y+h-.21],.052,'white',.47);}
 function stroke(a:number[],q:number[],th:number,c:C,z:number){const dx=q[0]-a[0],dy=q[1]-a[1],g=new T.BoxGeometry(Math.hypot(dx,dy),th,.035);g.rotateZ(Math.atan2(dy,dx));add(g,c,(a[0]+q[0])/2,(a[1]+q[1])/2,z);}
 for(const x of [-1.40,1.40]){archedWindow(x,5.22,1.92,4.12,.99,7,'high-arched-glass');for(const a of [Math.PI/4,Math.PI/2,Math.PI*3/4]){const xx=x+1.10*Math.cos(a),yy=9.43+1.12*Math.sin(a);const g=new T.BoxGeometry(.21,.37,.14);g.rotateZ(a-Math.PI/2);add(g,'stone',xx,yy,.45);}}
 // Round high window and six continuous frame strokes, no name lettering.
 const starY=13.38,starR=.71;add(new T.CylinderGeometry(starR+.13,starR+.13,.12,32).rotateX(Math.PI/2),'white',0,starY,.23);add(new T.CircleGeometry(starR,32),'glass',0,starY,.315,'star-glass');for(const offset of [Math.PI/2,-Math.PI/2]){const p=Array.from({length:3},(_,i)=>[starR*.87*Math.cos(offset+i*2*Math.PI/3),starY+starR*.87*Math.sin(offset+i*2*Math.PI/3)]);for(let i=0;i<3;i++)stroke(p[i],p[(i+1)%3],.035,'white',.355);}
 // Sloping dentil trim, broad tuit cornice and side shoulder ornaments.
 for(const s of [-1,1]){stroke([s*(w/2-.08),9.50],[s*crownHalf,15.65],.18,'white',.26);for(let i=1;i<14;i++){const t=i/14,x=s*(w/2+(crownHalf-w/2)*t),y=shoulder+(15.65-shoulder)*t;box(x-s*.12,y,.21,.24,.12,.13,'white');}box(s*(w/2-.20),9.44,.19,.63,.24,.38,'stone');add(new T.ConeGeometry(.24,1.12,4).rotateY(Math.PI/4),'white',s*(w/2-.20),10.33,.10);add(new T.SphereGeometry(.13,8,5),'stone',s*(w/2-.20),10.99,.10);}
 for(const [y,ww,h]of [[15.65,3.12,.14],[16.33,3.15,.16],[16.85,3.35,.22]])box(0,y,.22,ww,h,.35,'white');for(let x=-1.24;x<1.3;x+=.62){box(x,16.42,.33,.07,.31,.10,'stone');box(x+.10,16.42,.33,.04,.31,.10,'stone');}
 // Central black double door and full source-supported aedicula; inscription remains an unlettered dark inset pending accurate Hebrew glyphs.
 polygon(archShape(0,.35,2.04,3.20,.28),'dark',.25,.12,'main-door');box(0,.45,.41,.045,3.35,.05,'frame');for(const x of [-.51,.51])for(const y of [.64,1.43,2.33]){box(x,y,.42,.75,.59,.035,'dark');box(x,y+.04,.445,.65,.035,.025,'frame');}for(const x of [-1.12,1.12]){box(x,.28,.29,.31,4.09,.31,'white');box(x,.25,.28,.58,.56,.37,'stone');box(x,3.86,.36,.49,.33,.34,'stone');for(const dx of [-.065,.065])box(x+dx,3.98,.54,.025,.26,.025,'stone');}box(0,4.24,.28,2.70,.24,.40,'white');box(0,4.53,.24,2.10,.72,.23,'white');box(0,4.64,.38,1.27,.40,.025,'dark','inscription-inset');polygon([[-.68,5.12],[.68,5.12],[0,5.56]],'white',.35,.15);polygon([[-.48,5.18],[.48,5.18],[0,5.43]],'dark',.52,.025);for(const x of [-1.17,1.17,0]){box(x,x===0?5.51:4.49,.27,.21,.20,.25,'stone');add(new T.SphereGeometry(.13,8,6),'stone',x,x===0?5.80:4.83,.28);}
 for(const x of [-2.86,2.86]){
 // Rectangular glaze/grille below a BLIND shallow arched brick spare field, observed2005 and2025.
 box(x,1.36,.28,1.14,2.36,.12,'white','ground-rectangular-frame');
 box(x,1.46,.39,.96,2.16,.04,'glass','ground-glass');
 for(const dx of [-.48,0,.48])box(x+dx,1.44,.445,.045,2.20,.04,'white');
 box(x,3.65,.43,1.10,.09,.12,'white');
 polygon(archShape(x,3.73,1.10,0,.36),'brick',.29,.045,'ground-blind-arched-field');
 // Pale spring blocks and keystone belong to masonry, not an arched glazed head.
 for(const dx of [-.60,.60])box(x+dx,3.70,.33,.20,.17,.12,'stone');
 box(x,4.07,.33,.19,.27,.12,'stone');
 for(let dx=-.39;dx<.45;dx+=.13)box(x+dx,1.49,.49,.018,2.12,.025,'frame');
 box(x,1.16,.28,1.26,.17,.29,'white');
}
 // Right recessed narrow entrance bay uses the surveyed frontage points1→3 and has no borrowed neighbor facade.
 const rightW=ring[1].distanceTo(ring[3]),rightX=w/2+rightW/2,z=-.18;
 for(const y of [1.25,2.55,3.85,5.12,7.66])box(rightX,y,z+.14,rightW,.14,.15,'white');box(rightX,7.79,z+.17,rightW,.23,.37,'white');for(let i=0;i<4;i++)box(rightX-rightW*.39+i*rightW*.26,7.39,z+.25,.12,.38,.20,'stone');
 const shift=(pts:number[][])=>pts.map(p=>[p[0]+rightX,p[1]]);polygon(shift(archShape(0,.28,1.24,3.04,.16)),'dark',z+.27,.12,'side-door');polygon(shift(archShape(0,5.31,1.35,1.62,.23)),'white',z+.23,.12);polygon(shift(archShape(0,5.42,1.10,1.41,.20)),'glass',z+.37,.04,'right-bay-glass');box(rightX,5.42,z+.45,.048,1.53,.04,'white');box(rightX,6.19,z+.45,1.10,.045,.04,'white');
 // Main rear arched window from the register, fitted to actual rear hall edge55→58→59 beneath ridge58.
 const rearStart=V[55],rearEnd=V[59],ru=new T.Vector2(rearEnd.x-rearStart.x,rearEnd.z-rearStart.z).normalize(),rn=new T.Vector2(-ru.y,ru.x),rm=rearStart.clone().lerp(rearEnd,.5);const rear=new T.ExtrudeGeometry(new T.Shape(archShape(0,5.25,2.45,4.55,1.23).map(p=>new T.Vector2(p[0],p[1]))),{depth:.04,bevelEnabled:false});const p=rear.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,rm.x+ru.x*x+rn.x*(.08+z),y,rm.z+ru.y*x+rn.y*(.08+z));}rear.computeVertexNormals();rear.userData.role='rear-glass';b.add(rear,'glass');

}
