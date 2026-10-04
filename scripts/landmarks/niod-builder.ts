import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import data from './niod-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-plan reconstruction. Drawing1315BT900084 supplies assemblies,
 * not current-state authority: obsolete ridge-end statues are deliberately absent. */
export function buildNiod(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,ring=data.localRing.map(p=>new T.Vector2(p[0],p[1]));
 const F=27.26945,cx=-.38;
 const clip=(p:T.Vector2[],v:number,less:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],inside=less?a.y<=v:a.y>=v,other=less?c.y<=v:c.y>=v;if(inside)out.push(a);if(inside!==other)out.push(a.clone().lerp(c,(v-a.y)/(c.y-a.y)));}return out;};
 const region=(lo:number,hi:number)=>clip(clip(ring,lo,false),hi,true);
 const shape=(p:T.Vector2[])=>new T.Shape(p.map(q=>new T.Vector2(q.x,q.y)));
 // openTopPrism maps Shape(x,z) into the surveyed glTF X/Z perimeter.
 const surface=(p:T.Vector2[],height:(q:T.Vector2)=>number,c:Colour)=>{const values:number[]=[],tri=T.ShapeUtils.triangulateShape(p,[]);for(const t of tri){const q=t.map(i=>p[i]);const normal=new T.Vector3(q[1].x-q[0].x,height(q[1])-height(q[0]),q[1].y-q[0].y).cross(new T.Vector3(q[2].x-q[0].x,height(q[2])-height(q[0]),q[2].y-q[0].y));if(normal.y<0)[q[1],q[2]]=[q[2],q[1]];for(const v of q)values.push(v.x,height(v),v.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,c);};
 function volume(lo:number,hi:number,eave:number,roof:(q:T.Vector2)=>number,c:Colour){const p=region(lo,hi);add(openTopPrism(shape(p),0,eave),c);const v:number[]=[];for(let i=0;i<p.length;i++){const a=p[i],d=p[(i+1)%p.length];for(const q of [[a.x,eave,a.y],[d.x,eave,d.y],[d.x,roof(d),d.y],[a.x,eave,a.y],[d.x,roof(d),d.y],[a.x,roof(a),a.y]])v.push(...q);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);surface(p,roof,'slate');}
 volume(-10.65,5.74,4.33,()=>4.33,'brick');
 // Far rear is a separate low pitched volume; clip each roof half to the
 // exact irregular perimeter rather than spreading a rectangle over neighbors.
 const rear=(q:T.Vector2)=>5.35+4.17*Math.max(0,1-Math.abs(q.x-.1)/8.6);
 const rp=region(-28,-10.65);add(openTopPrism(shape(rp),0,5.35),'brick');
 const splitX=(p:T.Vector2[],less:boolean)=>{const swap=p.map(q=>new T.Vector2(q.y,q.x));return clip(swap,.1,less).map(q=>new T.Vector2(q.y,q.x));};
 for(const half of [true,false])surface(splitX(rp,half),rear,'slate');
 for(let i=0;i<rp.length;i++){const p=rp[i],q=rp[(i+1)%rp.length];if(Math.abs(p.y-q.y)>1)continue;const v=[p.x,5.35,p.y,q.x,5.35,q.y,q.x,rear(q),q.y,p.x,5.35,p.y,q.x,rear(q),q.y,p.x,rear(p),p.y],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'brick');}
 volume(5.74,14.8,18.58,()=>18.58,'brick');
 // Main front roof: steep front slope, short crest and gentler rear return.
 const profile=(z:number)=>z>=20.5?15.1+(22.44-15.1)*(F-z)/(F-20.5):z>=18.4?22.44:18.58+(22.44-18.58)*(z-14.8)/(18.4-14.8);
 for(const [lo,hi] of [[14.8,18.4],[18.4,20.5],[20.5,F]])volume(lo,hi,14.1,q=>profile(q.y),'stone');
 // Hall lightcap: glazed original abstraction on supported flat rear roof.
 box(cx,18.58,10.3,3.8,.12,4.2,'frame');
 const skylight=new T.Shape([new T.Vector2(-1.8,-2),new T.Vector2(1.8,-2),new T.Vector2(1.8,2),new T.Vector2(-1.8,2)]);
 const sk=new T.ShapeGeometry(skylight);sk.rotateX(-Math.PI/2);add(sk,'glass',cx,18.73,10.3);
 for(const x of [-1.8,-.9,0,.9,1.8])box(cx+x,18.75,10.3,.06,.065,4,'frame');
 // Principal sandstone front. Rows carry carved belt courses and profiled
 // pilasters, with glazing proud of the body for first-hit visibility.
 for(const y of [.10,3.85,4.30,8.28,8.78,13.20,13.65])box(cx,y,F+.08,16.62,y>12?.24:.18,.40,'stone');
 for(let y=.45;y<13.2;y+=.51){for(const x of [-7.8,-3.6,3.1,7.1])box(x,y,F+.075,1.12,.025,.09,'white');}
 const frontWindow=(x:number,y:number,w:number,h:number,panels:number,z=F+.21)=>{
  box(x,y-.10,z,w+.32,h+.20,.14,'frame');box(x,y,z+.09,w,h,.06,'glass');
  for(let k=0;k<=panels;k++)box(x-w/2+w*k/panels,y-.02,z+.15,.095,h+.04,.10,'stone');
  for(const yy of [0,h*.68,h])box(x,y+yy-.055,z+.15,w+.16,.11,.1,'stone');
  for(const dx of [-w/2-.20,w/2+.20]){box(x+dx,y-.22,z+.01,.17,h+.45,.19,'stone');box(x+dx,y+h-.08,z+.12,.31,.22,.21,'stone');}
  box(x,y-.26,z+.15,w+.68,.19,.36,'stone');box(x,y+h+.12,z+.12,w+.60,.17,.28,'stone');
 };
 for(const [x,w,n] of [[-5.60,2.75,2],[cx,3.8,3],[4.83,2.75,2]])for(const [y,h] of [[4.7,3.13],[9.05,3.05]])frontWindow(x,y,w,h,n);
 // Middle first-floor bay's shallow bow/balcony apron.
 box(cx,4.08,F+.26,4.2,.26,.64,'stone');
 for(const y of [4.32,8.42])for(let x=-7.85;x<7.75;x+=.68){box(x,y,F+.25,.54,.32,.14,'stone');add(new T.TorusGeometry(.12,.036,4,8).scale(1,.7,.5),'white',x,y+.15,F+.34);}
 for(let x=-8;x<8;x+=.40){box(x,13.31,F+.31,.16,.28,.37,'stone');add(new T.SphereGeometry(.12,5,3).scale(1,.8,1),'stone',x,13.08,F+.18);}
 // Ground asymmetry: a left window group, three narrow central windows, and
 // the defining right carriage opening. It is a dark entry recess, not a
 // fabricated through-passage: no mapped underpass exists in this footprint.
 frontWindow(-5.55,.9,2.70,2.25,3);
 for(const x of [cx-.96,cx,cx+.96])frontWindow(x,.95,.69,2.23,1);
 const entry=new T.Shape();entry.moveTo(-1.22,0);entry.lineTo(1.22,0);entry.lineTo(1.22,2.82);entry.quadraticCurveTo(1.15,3.47,0,3.54);entry.quadraticCurveTo(-1.15,3.47,-1.22,2.82);entry.closePath();
 add(new T.ShapeGeometry(entry),'dark',4.85,.25,F+.30);
 for(const x of [3.45,6.25])box(x,.08,F+.24,.30,3.31,.36,'stone');
 const arch=new T.TorusGeometry(1.30,.13,5,18,Math.PI);arch.scale(1,.47,1);add(arch,'stone',4.85,3.08,F+.36);
 for(const x of [3.2,6.5]){box(x,1.78,F+.46,.10,.60,.10,'frame');add(new T.SphereGeometry(.13,6,4).scale(1,1.3,1),'gold',x,2.45,F+.46);box(x,2.17,F+.46,.19,.24,.19,'dark');}
 // Street railing and paired lanterns from RCE; kept subordinate and narrow.
 for(let x=-8.15;x<7.95;x+=.32)box(x,.12,F+.71,.034,.80,.034,'frame');
 box(cx,.85,F+.71,16.4,.055,.065,'frame');
 for(const x of [-2.58,1.83]){box(x,.13,F+.83,.08,1.18,.08,'frame');box(x,1.22,F+.83,.24,.39,.24,'dark');box(x,1.30,F+.83,.19,.23,.19,'glass');add(new T.ConeGeometry(.21,.25,5),'frame',x,1.76,F+.83);}
 // Attic balustrade follows the cornice, with three dominant projecting bays.
 for(const y of [14.08,14.77])box(cx,y,F+.28,16.7,.13,.38,'stone');
 for(let x=-8.2;x<7.9;x+=.25)box(x,14.20,F+.33,.07,.55,.13,'stone');
 function crest(x:number,y:number,w:number,z:number){
  const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w*.41,.23);s.quadraticCurveTo(w*.18,.44,w*.17,.78);s.lineTo(w*.12,1.00);s.lineTo(0,1.32);s.lineTo(-w*.12,1);s.lineTo(-w*.17,.78);s.quadraticCurveTo(-w*.18,.44,-w*.41,.23);s.closePath();
  add(new T.ShapeGeometry(s),'stone',x,y,z);box(x,y+.22,z+.04,w*.45,.35,.12,'frame');
  add(new T.TorusGeometry(w*.15,.07,4,12,Math.PI),'stone',x,y+.56,z+.14);
  for(const dx of [-w*.4,w*.4]){box(x+dx,y-.04,z,.13,.52,.16,'stone');add(new T.ConeGeometry(.13,.44,5),'stone',x+dx,y+.60,z);}
 }
 function dormer(x:number,central:boolean){
  const w=central?4.20:2.8,h=central?3.55:2.62,base=14.75,z=F+.23;
  box(x,base,z-.54,w+.24,h,.96,'stone');frontWindow(x,base+.13,w-.54,h-.30,central?3:2,z+.05);
  box(x,base+h,z+.13,w+.50,.25,.40,'stone');
  for(const dx of [-w/2-.07,w/2+.07]){box(x+dx,base-.05,z+.02,.22,h+.27,.21,'stone');box(x+dx,base+h-.33,z+.1,.43,.33,.32,'stone');}
  // Narrow upper dormer and scroll shoulders form one continuous assembly.
  const upper=base+h+.42,uw=central?1.55:1.02,uh=central?2.6:1.25;
  box(x,upper,z-.43,uw+.49,uh,.90,'stone');frontWindow(x,upper+.13,uw,uh-.3,1,z+.1);
  for(const sign of [-1,1]){const sx=x+sign*(uw/2+.55);add(new T.TorusGeometry(.36,.11,5,12,Math.PI*1.6),'stone',sx,upper+.23,z+.20);add(new T.SphereGeometry(.21,6,4).scale(.75,1.5,.7),'stone',sx,upper+.85,z+.15);}
  crest(x,upper+uh,uw+1.15,z+.18);
  if(central){box(x,upper+uh+1.20,z+.18,.14,.64,.20,'stone');add(new T.SphereGeometry(.14,5,4),'stone',x,upper+uh+1.94,z+.18);}
  // Stone urn/pinnacle silhouettes are visible2016; no tall ridge statues.
  for(const dx of [-w/2+.12,w/2-.12]){box(x+dx,base+h+.14,z,.13,.40,.15,'stone');add(new T.SphereGeometry(.14,5,4),'stone',x+dx,base+h+.62,z);add(new T.ConeGeometry(.12,.37,5),'stone',x+dx,base+h+.92,z);}
 }
 dormer(cx,true);dormer(-5.60,false);dormer(4.83,false);
 // Two plain small slope windows replace the elaborate historical proposals.
 for(const x of [-3.05,2.35]){const z=22.02,y=profile(z);box(x,y+.04,z,.74,.1,.95,'stone');const pane=new T.PlaneGeometry(.47,.63);pane.rotateX(-.58);add(pane,'dark',x,y+.25,z+.05);}
 // Only small roof-edge caps observed in2016, not1888standing figures.
 for(const x of [-7.95,7.20]){box(x,22.44,19.85,.20,.35,.27,'stone');box(x,22.79,19.85,.38,.11,.34,'stone');}
 // Quiet exposed rear windows, physically attached to surveyed wall edges.
 let signed=0;for(let i=0;i<ring.length;i++)signed+=ring[i].x*ring[(i+1)%ring.length].y-ring[(i+1)%ring.length].x*ring[i].y;
 for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(p),L=d.length();if(L<3||(p.y>26&&q.y>26))continue;const t=d.clone().normalize(),n=new T.Vector2(t.y,-t.x).multiplyScalar(signed>0?1:-1),angle=Math.atan2(n.x,n.y),count=Math.floor(L/3.0);
  for(let k=0;k<count;k++){const m=p.clone().addScaledVector(t,L*(k+.5)/count).addScaledVector(n,.10),height=m.y< -10.65?5.35:m.y<5.74?4.33:m.y<14.8?18.58:14.1;for(let y=1.1;y<height-2.2;y+=3.9){add(new T.PlaneGeometry(1.28,2.2),'stone',m.x,y+1.1,m.y,angle);add(new T.PlaneGeometry(1.05,1.94),'glass',m.x+n.x*.04,y+1.1,m.y+n.y*.04,angle);box(m.x+n.x*.08,y,m.y+n.y*.08,.065,2.2,.07,'stone',angle);box(m.x+n.x*.08,y+1.5,m.y+n.y*.08,1.25,.065,.07,'stone',angle);}}
 }
}
