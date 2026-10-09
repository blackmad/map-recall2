import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './uilenburger-synagoge-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original synagogue, native metre scale1. Author +X NE across front, +Z SE to canal.
 * Dimensions are survey-owned: caller width/depth never stretch the asset. */
export function buildUilenburgerSynagoge(_w:number,_d:number,b:BuildingTools){
 const angle=source.authorAngleRadians,co=Math.cos(angle),si=Math.sin(angle),at=(x:number,z:number)=>[co*x+si*z,-si*x+co*z];
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>{const q=at(x,z);b.add(g,c,q[0],y,q[1],angle+a)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,a=0)=>{const q=at(x,z);b.box(q[0],y,q[1],w,h,d,c,angle+a)};
 const shape=new T.Shape(source.ring.map(q=>new T.Vector2(q[0],q[1])));
 const shell=openTopPrism(shape,.63,11.04);shell.userData.role='footprint-shell';add(shell,'brick');
 // AHN5 semantic planes establish a mansard: steep lower and shallow upper slopes.
 for(const roof of source.roofPlanes){
  const r=roof.rings[0],s=new T.Shape(r.map(q=>new T.Vector2(q[0],q[2]))),n=r.length,mean=r.reduce((a,q)=>a.map((v,i)=>v+q[i]/n),[0,0,0]);let xx=0,xz=0,zz=0,xy=0,zy=0;
  for(const q of r){const x=q[0]-mean[0],z=q[2]-mean[2],y=q[1]-mean[1];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y}
  const det=xx*zz-xz*xz,ax=(xy*zz-zy*xz)/det,az=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>mean[1]+ax*(x-mean[0])+az*(z-mean[2]);
  const g=new T.ShapeGeometry(s),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,height(x,z),z)}
  const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(q.sub(a).cross(c.sub(a)).y<0){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k)}}
  g.computeVertexNormals();g.userData.role='roof';g.userData.sourceSurface=roof.sourceSurface;g.userData.residual=Math.max(...r.map(q=>Math.abs(height(q[0],q[2])-q[1])));add(g,'slate');
  const sides:number[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length];sides.push(a[0],11.04,a[2],q[0],11.04,q[2],q[0],q[1],q[2],a[0],11.04,a[2],q[0],q[1],q[2],a[0],a[1],a[2])}
  const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(sides,3));skirt.computeVertexNormals();add(skirt,'brick');
 }
 // All details live on the actual oriented wall, with glazing outside the parent.
 function face(x:number,z:number,a:number){
  const ca=Math.cos(a),sa=Math.sin(a),pos=(u:number,v:number)=>[x+ca*u+sa*v,z-sa*u+ca*v];
  const fb=(u:number,y:number,v:number,w:number,h:number,d:number,c:Colour)=>{const q=pos(u,v);box(q[0],y,q[1],w,h,d,c,a)};
  const fa=(g:T.BufferGeometry,c:Colour,u=0,y=0,v=0)=>{const q=pos(u,v);add(g,c,q[0],y,q[1],a)};
  function arch(u:number,y:number,w:number,h:number,c:Colour,v:number){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.045,bevelEnabled:false,curveSegments:16});g.userData.role=c==='glass'?'glazing':'arch-surround';fa(g,c,u,y,v)}
  function win(u:number,y:number,w:number,h:number,arched=true){
   if(arched){arch(u,y-.08,w+.17,h+.17,'white',.055);arch(u,y,w,h,'glass',.115)}else{fb(u,y-.09,.065,w+.19,h+.18,.07,'white');fb(u,y,.13,w,h,.06,'glass')}
   const straight=arched?h-w/2:h;
   for(let k=1;k<5;k++)fb(u-w/2+k*w/5,y,.20,.04,straight,.045,'white');
   for(let v=.5;v<straight;v+=.55)fb(u,y+v,.20,w,.04,.045,'white');fb(u,y-.14,.1,w+.3,.12,.25,'frame');
   if(arched){for(const theta of [Math.PI/6,Math.PI/3,Math.PI/2,2*Math.PI/3,5*Math.PI/6]){const radius=w/2-.035,du=radius*Math.cos(theta),dy=radius*Math.sin(theta),g=new T.CylinderGeometry(.021,.021,radius,5);g.rotateZ(-Math.atan2(du,dy));fa(g,'white',u+du/2,y+straight+dy/2,.21)}fb(u,y+straight,.20,w,.05,.045,'white')}
  }
  return{fb,fa,arch,win};
 }
 const front=face(-.141,-10.94,Math.PI),rear=face(.23,10.89,0),rearCentre=face(.23,11.44,0);
 // Photo-guided broad Louis XV bell profile, with shallow volute shoulders.
 const profile:number[][]=[[-5.73,12.25],[-5.56,12.55],[-5.40,12.91],[-5,13.23],[-4.52,13.41],[-3.9,13.43],[-3.25,13.47],[-2.64,13.63],[-2.13,13.93],[-1.95,14.25],[-1.50,14.24],[-1.3,14.64],[-.98,15.09],[-.57,15.43],[0,15.55],[.57,15.43],[.98,15.09],[1.3,14.64],[1.5,14.24],[1.95,14.25],[2.13,13.93],[2.64,13.63],[3.25,13.47],[3.9,13.43],[4.52,13.41],[5,13.23],[5.4,12.91],[5.56,12.55],[5.73,12.25]];
 for(const q of profile)q[1]=11.04+(q[1]-11.04)*1.31;
 const gs=new T.Shape();gs.moveTo(-5.73,10.96);for(const q of profile)gs.lineTo(q[0],q[1]);gs.lineTo(5.73,10.96);gs.closePath();front.fa(new T.ExtrudeGeometry(gs,{depth:.15,bevelEnabled:false}),'brick',0,0,-.08);
 for(let i=1;i<profile.length;i++){const a=profile[i-1],q=profile[i],dx=q[0]-a[0],dy=q[1]-a[1],g=new T.BoxGeometry(Math.hypot(dx,dy)+.02,.10,.18);g.rotateZ(Math.atan2(dy,dx));front.fa(g,'stone',(q[0]+a[0])/2,(q[1]+a[1])/2,.18)}
 // Gray plinth owns the lower face, including projecting masonry piers.
 // Split the brick reliefs at the same datum rather than burying the band.
 for(const u of [-5.42,5.42]){front.fb(u,0,.02,.42,.63,.15,'greyBrick');front.fb(u,.63,.02,.42,12.3-.63,.15,'brick');}
 front.fb(0,0,.01,3.92,.63,.09,'greyBrick');front.fb(0,.63,.01,3.92,14.30-.63,.09,'brick');
 for(const u of [-3.62,3.62]){front.win(u,1.27,1.90,3.06,false);front.win(u,5.10,2.03,4.77)}front.win(0,6.4,2.07,5.40);
 // Three oculi retain six-pointed tracery. No building-name lettering.
 for(const[u,y]of [[-3.65,13.16],[0,14.46],[3.65,13.16]]){
  front.fa(new T.CylinderGeometry(.46,.46,.055,24).rotateX(Math.PI/2),'white',u,y,.08);front.fa(new T.CylinderGeometry(.40,.40,.07,24).rotateX(Math.PI/2),'glass',u,y,.145);
  for(const shift of [0,Math.PI])for(let j=0;j<3;j++){const a=shift+j*2*Math.PI/3,q=shift+(j+1)*2*Math.PI/3,ax=.34*Math.sin(a),ay=.34*Math.cos(a),bx=.34*Math.sin(q),by=.34*Math.cos(q),g=new T.BoxGeometry(Math.hypot(bx-ax,by-ay),.027,.028);g.rotateZ(Math.atan2(by-ay,bx-ax));front.fa(g,'white',u+(ax+bx)/2,y+(ay+by)/2,.207)}
 }
 front.fb(0,.52,.12,2.43,3.14,.08,'dark');front.arch(0,3.63,2.43,1.23,'dark',.12);
 for(const u of [-1.40,1.40])front.fb(u,.45,.17,.40,4.55,.32,'stone');front.fb(0,4.98,.17,3.25,.32,.45,'stone');front.fb(0,5.30,.17,3.56,.16,.58,'stone');
 front.fb(0,.66,.28,.07,2.85,.045,'frame');
 for(const u of [-5.03,5.03])front.fa(new T.TorusGeometry(.22,.065,5,18),'stone',u,13.71,.19);
for(let i=0;i<5;i++)front.fb(0,i*.105,.57+(4-i)*.20,3.15,.105,.45,'stone');
 for(let j=0;j<9;j++){const theta=j*Math.PI/8,r=1.12,dx=r*Math.cos(theta),dy=r*Math.sin(theta),g=new T.BoxGeometry(Math.hypot(dx,dy),.035,.04);g.rotateZ(theta);front.fa(g,'white',dx/2,3.66+dy/2,.215)}
 // Canal rear differs: rendered stepped silhouette, blind outer upper arches.
 rear.fb(0,0,.015,11.45,11.70,.15,'stone');
 const rp=new T.Shape();rp.moveTo(-5.72,11.68);for(const q of [[-5.72,12.2],[-4.8,12.2],[-4.8,13.1],[-3.6,13.1],[-3.6,14.25],[-2.45,14.25],[-2.45,15.2],[0,15.60],[2.45,15.2],[2.45,14.25],[3.6,14.25],[3.6,13.1],[4.8,13.1],[4.8,12.2],[5.72,12.2],[5.72,11.68]])rp.lineTo(q[0],q[1]);rp.closePath();rear.fa(new T.ExtrudeGeometry(rp,{depth:.18,bevelEnabled:false}),'stone',0,0,0);
 rearCentre.fb(0,0,-.05,4.68,15.18,.16,'stone');rearCentre.win(0,9.14,1.75,3.05);for(const u of [-3.65,3.65]){rear.arch(u,8.20,1.85,3.10,'greyBrick',.115);rear.arch(u,8.26,1.65,2.89,'stone',.18);rear.win(u,2.25,1.65,2.24,false)}
 for(const u of [-1.26,1.26]){for(let i=0;i<3;i++)rearCentre.fb(u,i*.14,.46+(2-i)*.26,1.1,.14,.4,'stone');rearCentre.fb(u,.42,.2,1.04,2.54,.1,'dark');rearCentre.fb(u,.54,.27,.75,2.19,.05,'glass')}
 for(const u of [-3.5,3.5])rear.arch(u,13.68,.34,.65,'dark',.2);rearCentre.arch(0,13.68,.34,.65,'dark',.2);
 for(const u of [-2.37,2.37])rear.fb(u,4.93,.15,.40,10.25,.18,'stone');
 for(let y=1.1;y<11.1;y+=.68)rear.fb(0,y,.185,11.35,.018,.02,'greyBrick');
 // Long wall windows use measured edge tangents, including the slight native taper.
 for(const side of [-1,1]){
  const a=side<0?source.ring[0]:source.ring[7],q=side<0?source.ring[1]:source.ring[6],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz),orient=Math.atan2(dz,-dx)+(side<0?Math.PI:0);
  for(const t of [.12,.31,.5,.69,.88]){const f=face(a[0]+dx*t,a[1]+dz*t,orient);f.win(0,5.15,1.74,4.60);f.win(0,1.38,1.58,2.97,false)}
  const f=face((a[0]+q[0])/2,(a[1]+q[1])/2,orient);for(const[y,h,v]of [[10.99,.15,.04],[11.19,.19,.1],[11.40,.13,.16]])f.fb(0,y,v,length,h,.24,'stone');
 }
 const base=openTopPrism(shape,0,.63);add(base,'greyBrick');
}
