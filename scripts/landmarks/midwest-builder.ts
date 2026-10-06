import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './midwest-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original reconstruction from native BAG/3DBAG terraces and archived current facade photos.
 * Not an imported survey mesh: horizontal storey shells, original rounded relief and glazing. */
export function buildMidwest(_w:number,_d:number,b:BuildingTools){
 const turn=.28,c=Math.cos(turn),s=Math.sin(turn);
 const add=(g:T.BufferGeometry,col:C,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(turn);b.add(g,col);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,a=0)=>add(new T.BoxGeometry(w,h,d),col,x,y+h/2,z,a);
 const local=(p:number[])=>new T.Vector2(c*p[0]-s*p[1],s*p[0]+c*p[1]);
 const shape=(ps:number[][])=>new T.Shape(ps.map(local));
 const clip=(poly:T.Vector2[],axis:'x'|'y',limit:number,less:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],inside=(p[axis]<=limit)===less,next=(q[axis]<=limit)===less;if(inside)out.push(p.clone());if(inside!==next){const k=(limit-p[axis])/(q[axis]-p[axis]);out.push(p.clone().lerp(q,k));}}return out;};
 const roof=(sh:T.Shape,h:number)=>{const g=upwardRoofPlane(sh,h),flat=g.toNonIndexed(),p=flat.attributes.position,out:number[]=[];for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),z=new T.Vector3().fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(z.clone().sub(a)).lengthSq()<1e-10)continue;out.push(...a.toArray(),...b.toArray(),...z.toArray());}const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(out,3));clean.computeVertexNormals();clean.userData.explicitRoof=true;g.dispose();flat.dispose();return clean;};
 const terrace=(sh:T.Shape,h:number)=>{add(openTopPrism(sh,0,h),'ochre');add(roof(sh,h),'slate');};
 // Fillets alter the primary masonry perimeter; each coping follows the same profile.
 // Coordinates remain within the native surveyed rings. Photo-guided radii are not survey measurements.
 const rounded=(poly:T.Vector2[],select:(p:T.Vector2)=>number)=>{
  const points=poly.filter((p,i)=>p.distanceTo(poly[(i+1)%poly.length])>.015),sh=new T.Shape();
  const corners=points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],r=Math.min(select(p),p.distanceTo(prev)*.46,p.distanceTo(next)*.46);return {p,entry:p.clone().lerp(prev,r/p.distanceTo(prev)),exit:p.clone().lerp(next,r/p.distanceTo(next))};});
  sh.moveTo(corners[0].entry.x,corners[0].entry.y);for(const {p,entry,exit} of corners){sh.lineTo(entry.x,entry.y);sh.quadraticCurveTo(p.x,p.y,exit.x,exit.y);}sh.closePath();return sh;
 };
 const cappedTerrace=(sh:T.Shape,h:number)=>{terrace(sh,h);const ps=sh.getPoints(18);for(let i=0;i<ps.length-1;i++){const a=ps[i],z=ps[i+1],d=z.clone().sub(a),m=a.clone().add(z).multiplyScalar(.5);if(d.length()>.01)box(m.x,h-.10,m.y,d.length()+.015,.20,.18,'stone',Math.atan2(-d.y,d.x));}};
 // South wing and west ribbon share a roof level (survey difference 24 mm): join their
 // touching outlines so the broad Cabral inward turn belongs to one solid wing.
 const south=source.surveyRoofParts.find(p=>p.index===4)!.localRing.map(local),ribbon=source.surveyRoofParts.find(p=>p.index===6)!.localRing.map(local);
 const southJoined=[...south.slice(0,2),ribbon[5],ribbon[0],ribbon[1],ribbon[2],...south.slice(4)];
 terrace(new T.Shape(clip(clip(ribbon,'y',.1,false),'y',2.5,true)),13.21);
 for(const p of source.surveyRoofParts){if([1,7,6].includes(p.index))continue;const poly=p.localRing.map(local);
  if(p.index===4){const upper=clip(southJoined,'y',2.5,false),lower=clip(poly,'y',2.5,true);cappedTerrace(rounded(upper,q=>q.x<-19?2.15:0),p.height);terrace(new T.Shape(lower),p.height);continue;}
  if(p.index===10){for(const [lo,hi,height] of [[-100,.1,p.height],[.1,2.5,13.21],[2.5,100,p.height]]){const clipped=clip(clip(poly,'y',lo,false),'y',hi,true);if(clipped.length>=3){const sh=rounded(clipped,q=>q.x<-19?(q.y>-.2?2.15:1.25):0);if(height>14)cappedTerrace(sh,height);else terrace(sh,height);}}continue;}
  terrace(new T.Shape(poly),p.height);
  for(let i=0;i<poly.length;i++){const a=poly[i],z=poly[(i+1)%poly.length],d=z.clone().sub(a),mid=a.clone().add(z).multiplyScalar(.5);box(mid.x,p.height-.04,mid.y,d.length(),.17,.14,'stone',Math.atan2(-d.y,d.x));}
 }
 // Towers have genuinely open heads, not black panes painted over full solid shafts.
 for(const index of [1,7]){const p=source.surveyRoofParts[index],v=p.localRing.map(local),bounds=new T.Box2().setFromPoints(v),mid=bounds.getCenter(new T.Vector2()),dim=bounds.getSize(new T.Vector2());const w=dim.x,d=dim.y,top=p.height;
  const shaft=new T.Shape(v);add(openTopPrism(shaft,0,top-1.65),'greyBrick');add(roof(shaft,top-1.65),'stone');
  for(const x of [-1,1])for(const z of [-1,1])box(mid.x+x*(w/2-.23),top-1.65,mid.y+z*(d/2-.23),.46,1.26,.46,'greyBrick');
  box(mid.x,top-.39,mid.y,w+.09,.39,d+.09,'stone');box(mid.x,top-1.73,mid.y,w+.08,.19,d+.08,'stone');}
 const off=(x:number,z:number,a:number,n:number,u=0)=>[x+Math.sin(a)*n+Math.cos(a)*u,z+Math.cos(a)*n-Math.sin(a)*u];
 function win(x:number,y:number,z:number,w:number,h:number,a:number,cols=1,rows=1,fine=false){
  box(x,y,z,w+.16,h+.16,.08,'white',a);let q=off(x,z,a,.065);box(q[0],y+.07,q[1],w,h,.07,'glass',a);q=off(x,z,a,.12);
  for(let i=1;i<cols;i++){let q2=off(q[0],q[1],a,0,-w/2+i*w/cols);box(q2[0],y+.05,q2[1],.075,h,.055,'white',a);}
  for(let j=1;j<rows;j++)box(q[0],y+.07+j*h/rows,q[1],w,.07,.055,'white',a);
  if(fine){for(let i=0;i<cols;i++){let q2=off(q[0],q[1],a,0,-w/2+(i+.5)*w/cols);box(q2[0],y+h/3,q2[1],.035,h*2/3,.04,'frame',a);}for(let j=3;j<9;j++)if(j%3!==0)box(q[0],y+.07+j*h/9,q[1],w,.035,.04,'frame',a);}}
 // Five broad nine-pane classroom bays over three storeys; only upper panes subdivided.
 for(let i=0;i<5;i++){const x=-14.6+i*7.35;for(const y of [1.05,5.75,10.5])win(x,y,9.47,5.2,2.70,0,3,3,true);}
 // Six continuous boundary/divider groups for five bays. Interior dividers span the
 // whole masonry gap, with a flat broad face and one rounded return at each window edge.
 const pier=(lo:number,hi:number)=>{const sh=new T.Shape(),r=Math.min(.42,(hi-lo)/2);sh.moveTo(lo,9.31);sh.lineTo(hi,9.31);sh.lineTo(hi,9.57);sh.quadraticCurveTo(hi,9.99,hi-r,9.99);sh.lineTo(lo+r,9.99);sh.quadraticCurveTo(lo,9.99,lo,9.57);sh.closePath();add(openTopPrism(sh,0,14.954),'ochre');add(openTopPrism(sh,14.854,15.054),'stone');add(roof(sh,15.054),'stone');};
 pier(-18.12,-17.30);
 for(let i=0;i<4;i++)pier(-14.6+i*7.35+2.70,-14.6+(i+1)*7.35-2.70);
 pier(17.50,18.32);
 // Courtyard corridor glazing is small, unlike the classroom frontage.
 for(let i=0;i<19;i++)win(-9.25+i*1.30,10.90,-2.55,.69,.72,Math.PI);
 for(const [lo,hi] of [[-9.3,-4.45],[5.55,10.9]])for(let x=lo;x<hi;x+=1.27){win(x,6.9,-2.55,.69,.72,Math.PI);win(x,2.3,-2.55,.69,.72,Math.PI);}
 // Former gym's broad ladder glazing sits on its actual projecting north wall.
 for(let i=0;i<5;i++)win(-2.92+i*1.68,.65,-6.90,1.48,3.92,Math.PI,1,5);
 for(const x of [-12.7,13.4]){win(x,5.7,-6.89,2.45,1.85,Math.PI,2,3);box(x,.05,-6.92,1.45,2.5,.10,'dark',Math.PI);}
 // Blind street ends: red plinth, two curved wall dams and elongated white entrance ladder.
 const eastRing=source.surveyRoofParts.find(p=>p.index===4)!.localRing.map(local),ea=eastRing[8],eb=eastRing[9],ed=eb.clone().sub(ea).normalize();
 const eastZ=1.25,eastX=ea.x+(eastZ-ea.y)*(eb.x-ea.x)/(eb.y-ea.y),eastAngle=Math.atan2(-ed.y,ed.x);
 // Entry and plinth use the actual native east wall tangent, rather than a guessed bounding-box plane.
 for(const [x,a,centre] of [[-20.47,-Math.PI/2,1.25],[eastX,eastAngle,eastZ]]){
  if(x<0){
   // The former rectangular plinth continued beyond the rounded shoulders as thin
   // unsupported red flaps. Follow the actual primary outer-corner profiles instead.
   const northPoly=clip(source.surveyRoofParts.find(p=>p.index===10)!.localRing.map(local),'y',.1,true),southPoly=clip(southJoined,'y',2.5,false);
   const profiles=[rounded(northPoly,q=>q.x<-19?(q.y>-.2?2.15:1.25):0).getPoints(12),rounded(southPoly,q=>q.x<-19?2.15:0).getPoints(12)];
   const front:T.Vector2[]=[];
   for(let i=0;i<=100;i++){const z=-6.80+i*16.15/100;let u=-20.47;
    if(z< -5.55||z>7.22){const ps=profiles[z<0?0:1],xs:number[]=[];for(let j=0;j<ps.length-1;j++){const p=ps[j],q=ps[j+1];if((p.y<=z&&q.y>=z)||(q.y<=z&&p.y>=z)){if(Math.abs(q.y-p.y)>.00001)xs.push(p.x+(z-p.y)*(q.x-p.x)/(q.y-p.y));}}if(xs.length)u=Math.min(...xs)-.045;}
    front.push(new T.Vector2(u,z));
   }
   const sh=new T.Shape([...front,...front.slice().reverse().map(q=>new T.Vector2(q.x+.09,q.y))]);add(openTopPrism(sh,0,2.85),'brick');add(openTopPrism(sh,2.78,2.98),'stone');add(roof(sh,2.98),'stone');
  }else{box(x,0,centre,16.1,2.85,.09,'brick',a);box(x,2.78,centre,16.0,.20,.16,'stone',a);}
  box(x,2.82,centre,7.3,4.65,.18,'brick',a);box(x,7.43,centre,7.5,.13,.23,'slate',a);
  let q=off(x,centre,a,.15);win(q[0],2.5,q[1],1.8,3.95,a,3,10);q=off(x,centre,a,.26);box(q[0],.03,q[1],1.76,2.45,.10,'bronze',a);let q2=off(q[0],q[1],a,.08);box(q2[0],.18,q2[1],.07,2.25,.06,'white',a);
  // Sinuous red masonry on both sides of the doorway, compressed photo-guided depth.
  for(const side of [-1,1]){const pts:number[][]=[];for(let i=0;i<=12;i++){const u=1.0+i*2.4/12,depth=.2+.52*Math.sin(i*Math.PI/12);const p=off(x,centre,a,depth,side*u);pts.push(p);}for(let i=12;i>=0;i--){const p=off(x,centre,a,.04,side*(1+i*2.4/12));pts.push(p);}const sh=new T.Shape(pts.map(p=>new T.Vector2(p[0],p[1])));add(openTopPrism(sh,0,6.5),'brick');add(roof(sh,6.5),'stone');}
 }
 // Real solar roof installation simplified as low relief strips; no oversized equipment maximum.
 for(let x=-6;x<15;x+=2.4)for(const z of [4.2,6.8])box(x,15.00,z,2.12,.075,2.0,'blue');
}
