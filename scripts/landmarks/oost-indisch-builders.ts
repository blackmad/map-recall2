import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './oost-indisch-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original reconstruction; measured roof heights are references, never imported faces. */
export function buildOostIndischLandmark(_id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,s=data.sites[0],a=s.authorHeadingDegrees*Math.PI/180;
 const project=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const rings=s.buildings[0].geometry.coordinates[0].map(r=>r.slice(0,-1).map(project));
 const shape=new T.Shape(rings[0]);for(const r of rings.slice(1))shape.holes.push(new T.Path(r));
 const shell=new T.ExtrudeGeometry(shape,{depth:11.25,bevelEnabled:false});shell.rotateX(Math.PI/2);shell.translate(0,11.25,0);add(shell,'brick');
 const triangulation=new T.ShapeGeometry(shape),pos=triangulation.getAttribute('position'),ix=triangulation.index!;
 const triangles:T.Vector2[][]=[];for(let i=0;i<ix.count;i+=3)triangles.push([0,1,2].map(j=>new T.Vector2(pos.getX(ix.getX(i+j)),pos.getY(ix.getX(i+j)))));triangulation.dispose();
 const half=(r:T.Vector2[],f:(p:T.Vector2)=>number)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],fp=f(p),fq=f(q);if(fp>=-1e-8)out.push(p);if((fp>=0)!==(fq>=0))out.push(p.clone().lerp(q,fp/(fp-fq)));}return out;};
 const region=(r:T.Vector2[],bounds:number[])=>{const [xl,xh,zl,zh]=bounds;for(const f of [(p:T.Vector2)=>p.x-xl,(p:T.Vector2)=>xh-p.x,(p:T.Vector2)=>p.y-zl,(p:T.Vector2)=>zh-p.y])r=half(r,f);return r;};
 function roof(bounds:number[],axis:'x'|'y',breaks:number[],height:(p:T.Vector2)=>number){
  // Each source-plan triangle is clipped independently. The actual courtyard
  // and deeply concave western outline cannot be bridged by a roof rectangle.
  const vv:number[]=[];for(const t of triangles)for(let k=0;k<breaks.length-1;k++){let r=region(t,bounds);r=half(r,p=>p[axis]-breaks[k]);r=half(r,p=>breaks[k+1]-p[axis]);if(r.length<3)continue;for(let j=1;j<r.length-1;j++)for(const p of [r[0],r[j],r[j+1]])vv.push(p.x,height(p),p.y);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vv,3));g.computeVertexNormals();add(g,'slate');
  // Upper masonry skirts follow only true perimeter edges, not internal seams.
  const walls:number[]=[];for(const r of rings)for(let i=0;i<r.length;i++){let p=r[i],q=r[(i+1)%r.length];let low=0,high=1;for(const [axis0,lo,hi]of [['x',bounds[0],bounds[1]],['y',bounds[2],bounds[3]]]as const){const d=q[axis0]-p[axis0];if(Math.abs(d)<1e-9){if(p[axis0]<lo||p[axis0]>hi){high=-1;break;}}else{const t1=(lo-p[axis0])/d,t2=(hi-p[axis0])/d;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}}if(low>=high)continue;const u=p.clone().lerp(q,low),v=p.clone().lerp(q,high),cuts=[0,1];for(const z of breaks){const d=v[axis]-u[axis];if(Math.abs(d)>.001){const t=(z-u[axis])/d;if(t>0&&t<1)cuts.push(t);}}cuts.sort((a,b)=>a-b);for(let k=0;k<cuts.length-1;k++){const c=u.clone().lerp(v,cuts[k]),d=u.clone().lerp(v,cuts[k+1]),hc=Math.max(11.25,height(c)),hd=Math.max(11.25,height(d));walls.push(c.x,11.25,c.y,d.x,11.25,d.y,d.x,hd,d.y,c.x,11.25,c.y,d.x,hd,d.y,c.x,hc,c.y);}}
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(walls,3));wg.computeVertexNormals();add(wg,'brick');
 }
 // Peters' 1890/1891 Bushuis: a tall asymmetric slate roof above the canal.
 roof([-40,40,10.85,30],'y',[10.85,18.6,30],p=>p.y<=18.6?11.25+(p.y-10.85)*10.15/7.75:21.4-(p.y-18.6)*7.2/6.6);
 // Separate 1633 north wing, historical west wing and the lower 1606 south wing.
 roof([22.9,40,-30,10.85],'x',[22.9,26.5,40],p=>15.8-Math.abs(p.x-26.5)*1.16);
 roof([2.98,22.9,-30,-1.65],'y',[-30,-14,-11,-1.65],p=>p.y<-14?16.65-( -14-p.y)*.31:p.y>-11?16.65-(p.y+11)*.55:16.65);
 roof([-15,2.98,-30,10.85],'x',[-15,-5.5,2.98],p=>p.x>-5.5?16.3-(p.x+5.5)*.59:16.3+(p.x+5.5)*.11);
 roof([-40,-15,-30,10.85],'x',[-40,-15],()=>15.4);
 // A small triangular strip below the skew west courtyard edge stays a roof,
 // never a cap across the court itself.
 roof([2.98,22.9,-1.65,10.85],'y',[-1.65,10.85],()=>11.3);
 function plane(x:number,y:number,z:number,w:number,h:number,c:Colour,angle=0){add(new T.PlaneGeometry(w,h),c,x,y+h/2,z,angle);}
 function pane(x:number,y:number,z:number,w:number,h:number,angle=0){const nx=Math.sin(angle),nz=Math.cos(angle);plane(x,y-.1,z,w+.25,h+.2,'stone',angle);plane(x+nx*.035,y,z+nz*.035,w,h,'glass',angle);plane(x+nx*.07,y,z+nz*.07,.075,h,'white',angle);for(const yy of [h*.45,h*.73])plane(x+nx*.075,y+yy,z+nz*.075,w,.07,'white',angle);box(x+nx*.08,y-.2,z+nz*.08,w+.42,.16,.30,'stone',angle);}
 function band(p:T.Vector2,q:T.Vector2,y:number,h=.18,c:Colour='stone'){const v=q.clone().sub(p),m=p.clone().add(q).multiplyScalar(.5);box(m.x,y,m.y,v.length(),h,.28,c,-Math.atan2(v.y,v.x));}
 function arc(x:number,y:number,z:number,w:number,angle=0){add(new T.TorusGeometry(w/2,.10,4,12,Math.PI),'stone',x,y,z,angle);box(x,y+w/2-.13,z,.22,.32,.21,'stone',angle);}
 function stepped(x:number,y:number,z:number,w:number,h:number){const pts=[[-w/2,0],[w/2,0]];for(let k=0;k<5;k++){const ww=w/2*(1-k/5),yy=h*(k+1)/5;pts.push([ww,yy],[ww-w/10,yy]);}pts.push([0,h+.32]);for(let k=4;k>=0;k--){const ww=w/2*(1-k/5),yy=h*(k+1)/5;pts.push([-ww+w/10,yy],[-ww,yy]);}add(new T.ShapeGeometry(new T.Shape(pts.map(p=>new T.Vector2(...p as [number,number])))),'brick',x,y,z);for(let i=1;i<pts.length-1;i++)if(pts[i][1]===pts[i+1][1])box(x+(pts[i][0]+pts[i+1][0])/2,y+pts[i][1]-.04,z+.06,Math.abs(pts[i][0]-pts[i+1][0])+.24,.18,.33,'stone');box(x,y+h+.2,z,.26,.85,.35,'stone');}
 // 23 actual window axes across the separate Peters canal facade.
 const frontZ=25.54,spacing=2.81,cx=.12;for(const y of [.45,4.65,8.95,13.25,14.12])box(cx,y,frontZ,65.0,.18,.34,'stone');
 for(let k=0;k<23;k++){const x=cx+(k-11)*spacing;for(const y of [1.05,5.23,9.49]){pane(x,y,frontZ+.10,1.58,2.77);arc(x,y+2.82,frontZ+.18,1.72);}for(const y of [4.27,8.56,12.82])box(x,y,frontZ+.14,.4,.3,.28,'stone');}
 for(const x of [-28.05,-1.06,29.13]){stepped(x,13.85,frontZ+.07,8.25,7.05);for(const u of [-2.1,0,2.1])pane(x+u,14.52,frontZ+.18,1.29,2.65);pane(x,18.03,frontZ+.20,1.12,1.32);for(const u of [-3.6,3.6])box(x+u,13.75,frontZ+.18,.24,2.3,.32,'stone');}
 // Main entrance is the recorded canal-side door, not a footprint midpoint.
 box(-1.06,.0,frontZ+.26,2.0,3.1,.11,'dark');for(const x of [-2.24,.12])box(x,.0,frontZ+.28,.27,3.4,.3,'stone');arc(-1.06,2.8,frontZ+.36,2.24);box(-1.06,4.00,frontZ+.23,1.95,1.18,.27,'stone');add(new T.SphereGeometry(.35,6,4),'gold',-1.06,4.6,frontZ+.47);
 for(const x of [-21.4,-15.5,-9.7,7.2,13.1,19.0]){box(x,16.0,23.38,1.75,1.9,1.75,'brick');b.gableRoof(x,17.9,23.38,2.05,2.0,1.1,'slate');pane(x,16.2,24.29,1.07,1.2);}
 // Court windows and sandstone bands follow the actual inward-facing walls.
 const hole=rings[1];let signed=0;for(let i=0;i<hole.length;i++)signed+=hole[i].x*hole[(i+1)%hole.length].y-hole[(i+1)%hole.length].x*hole[i].y;
 for(let i=0;i<hole.length;i++){const p=hole[i],q=hole[(i+1)%hole.length],v=q.clone().sub(p),len=v.length();for(const y of [.55,4.65,9.2,10.96])band(p,q,y,.17);if(len<7)continue;const t=v.clone().normalize(),n=new T.Vector2(-t.y,t.x).multiplyScalar(signed>0?1:-1),angle=Math.atan2(n.x,n.y),count=Math.round(len/2.65);for(let j=0;j<count;j++){const pt=p.clone().addScaledVector(t,len*(j+.5)/count).addScaledVector(n,.07);for(const y of [1.05,5.24]){pane(pt.x,y,pt.y,1.40,2.97,angle);arc(pt.x+n.x*.10,y+3.02,pt.y+n.y*.10,1.57,angle);}}}
 // The south court edge has mapped entrance vertices splitting it into short
 // collinear segments; retain its whole facade rhythm rather than treating
 // each segment as a separate blank wall.
 for(const z of [1.45,3.60,5.45,8.94])for(const y of [1.05,5.24]){pane(3.14,y,z,1.40,2.97,Math.PI/2);arc(3.24,y+3.02,z,1.57,Math.PI/2);}
 // Renaissance scroll-neck gable on the historical south court facade.
 const entry=project([4.8979651,52.3708978]),angle=Math.PI/2,gx=3.17,gz=6.8;
 const outline=[[-3.6,0],[3.6,0],[3.25,.55],[2.8,1.2],[2.15,2.05],[1.85,3.4],[1.85,4.4],[.75,4.4],[.75,5.45],[0,5.72],[-.75,5.45],[-.75,4.4],[-1.85,4.4],[-1.85,3.4],[-2.15,2.05],[-2.8,1.2],[-3.25,.55]];
 add(new T.ShapeGeometry(new T.Shape(outline.map(p=>new T.Vector2(...p as [number,number])))),'brick',gx,11.0,gz,angle);pane(gx+.07,11.7,gz,2.15,1.95,angle);for(const u of [-3.1,3.1]){pane(gx+.07,11.60,gz-u,1.27,1.3,angle);add(new T.TorusGeometry(.58,.18,4,12,Math.PI),'stone',gx+.13,12.4,gz-u,angle);}for(const y of [11.15,14.45,15.32])box(gx+.10,y,gz,y===11.15?7.4:3.9,.24,.30,'stone',angle);for(const u of [-1.66,1.66])box(gx+.12,13.75,gz-u,.22,1.6,.22,'stone',angle);box(gx+.10,15.45,gz,1.60,1.05,.28,'brick',angle);for(const u of [-.7,0,.7])box(gx+.22,16.35,gz-u,.12,.54,.12,'stone');box(gx+.15,16.88,gz,1.7,.17,.28,'stone',angle);
 box(entry.x+.12,.2,entry.y,1.56,2.67,.12,'dark',angle);for(const u of [-.95,.95])box(entry.x+.2,.0,entry.y-u,.28,3.08,.28,'stone',angle);arc(entry.x+.24,2.68,entry.y,1.90,angle);add(new T.TorusGeometry(.30,.11,4,12),'stone',entry.x+.25,3.75,entry.y,angle);for(let k=0;k<4;k++)box(entry.x+.3+k*.19,.30-k*.075,entry.y,2.55,.09,.30,'stone',angle);
 // Exterior historical wings retain their street/window rhythm and notches.
 const r=rings[0];let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;
 for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],v=q.clone().sub(p),len=v.length();if(len<4||p.y>24&&q.y>24)continue;const t=v.clone().normalize(),n=new T.Vector2(t.y,-t.x).multiplyScalar(area>0?1:-1),angle=Math.atan2(n.x,n.y),count=Math.round(len/3.3);for(const y of [.7,4.65,9.2,11.1])band(p,q,y);for(let j=0;j<count;j++){const pt=p.clone().addScaledVector(t,len*(j+.5)/count).addScaledVector(n,.06);for(const y of [1.1,5.3])pane(pt.x,y,pt.y,1.45,2.75,angle);}}
}
