import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './sint-jorishof-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original roof zones clipped to the current concave courtyard perimeter. */
export function buildSintJorishof(_w:number,_d:number,b:BuildingTools){
 const s=data.sites[0],a=s.authorHeadingDegrees*Math.PI/180,{add,box}=b;
 const point=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const r=s.building.geometry.coordinates[0][0].slice(0,-1).map(point),tri=T.ShapeUtils.triangulateShape(r,[]);
 const cells=[
  {xl:-40,xh:40,zl:18,zh:40,eave:14.7,ridge:20.05,axis:'y',c:24.15,lo:18,hi:31.8},
  {xl:-40,xh:-18,zl:-19,zh:18,eave:8.8,ridge:12.6,axis:'x',c:-21.25,lo:-24.5,hi:-18},
  {xl:-18,xh:-10,zl:-6,zh:12,eave:7.6,ridge:9.8,axis:'x',c:-14.1,lo:-18,hi:-10},
  {xl:-18,xh:-10,zl:12,zh:18,eave:15.5,ridge:20.05,axis:'x',c:-14.3,lo:-18,hi:-10},
  {xl:-10,xh:40,zl:-19,zh:18,eave:10.94,ridge:17.77,axis:'y',c:-12.55,lo:-17.7,hi:-6.3,frontEave:14.4},
  // The alley-facing gate has a lower transverse roof, separate from the rear wing.
  {xl:-40,xh:-12.9,zl:-19,zh:-11.07,eave:9.06,ridge:11.236,axis:'y',c:-12.55,lo:-14.059,hi:-11.068},
  {xl:-40,xh:-12.9,zl:-11.07,zh:-6,eave:9.05,ridge:12.6,axis:'x',c:-15.98,lo:-18.49,hi:-12.9},
  {xl:-12.9,xh:-10,zl:-19,zh:-6,eave:12.95,ridge:18.01,axis:'x',c:-13.05,lo:-18.5,hi:-8},
  {xl:-40,xh:40,zl:-40,zh:-19,eave:11.45,ridge:17.96,axis:'y',c:-26.1,lo:-32.1,hi:-19},
 ] as const;
 const clip=(p:T.Vector2[],v:number,less:boolean,k:'x'|'y')=>{const out:T.Vector2[]=[];for(let i=0;i<p.length;i++){const x=p[i],y=p[(i+1)%p.length],inside=less?x[k]<=v:x[k]>=v,other=less?y[k]<=v:y[k]>=v;if(inside)out.push(x);if(inside!==other)out.push(x.clone().lerp(y,(v-x[k])/(y[k]-x[k])));}return out;};
 function surface(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 function height(p:T.Vector2,c:typeof cells[number]){const value=p[c.axis],t=value<=c.c?(value-c.lo)/(c.c-c.lo):(c.hi-value)/(c.hi-c.c),base=value>c.c&&'frontEave'in c?c.frontEave:c.eave;return base+(c.ridge-base)*Math.max(0,Math.min(1,t));}
 // Each surveyed-plan triangle is clipped independently: even disconnected
 // intersections retain empty courtyard/reentrant space rather than bridging it.
 for(const c of cells){const roof:number[]=[],walls:number[]=[];for(const t of tri){let p=t.map(i=>r[i]);p=clip(clip(clip(clip(p,c.xl,false,'x'),c.xh,true,'x'),c.zl,false,'y'),c.zh,true,'y');if(p.length<3)continue;for(const half of [true,false]){const poly=clip(p,c.c,half,c.axis);if(poly.length<3)continue;for(let i=1;i<poly.length-1;i++)for(const q of [poly[0],poly[i],poly[i+1]])roof.push(q.x,height(q,c),q.y);}for(let i=0;i<p.length;i++){const x=p[i],y=p[(i+1)%p.length];walls.push(x.x,0,x.y,y.x,0,y.y,y.x,height(y,c),y.y,x.x,0,x.y,y.x,height(y,c),y.y,x.x,height(x,c),x.y);}}surface(walls,'brick');surface(roof,'slate');}
 const region=(p:T.Vector2)=>cells.find(c=>p.x>=c.xl-.001&&p.x<=c.xh+.001&&p.y>=c.zl-.001&&p.y<=c.zh+.001)!;
 let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;
 for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],d=q.clone().sub(p),L=d.length();if(L<1.7)continue;const t=d.clone().normalize(),n=new T.Vector2(t.y,-t.x).multiplyScalar(area>0?1:-1),angle=Math.atan2(n.x,n.y),count=Math.max(1,Math.round(L/3.2));
  for(let j=0;j<count;j++){const m=p.clone().addScaledVector(t,L*(j+.5)/count).addScaledVector(n,.08),c=region(m.clone().addScaledVector(n,-.1)),h=('frontEave'in c&&m.y>c.c?c.frontEave:c.eave),w=Math.min(1.4,L/count*.55),rows=h>14.5?[.95,4.6,8.25,11.9]:h>12?[1.05,5.3,9.55]:h>10?[.8,4.1,7.4]:h>8?[.8,4.1,6.8]:[.85,4.3],wh=h>12?2.85:h>8&&h<=10?1.85:2.5;
   for(const y of rows){if(y+wh>height(m,c)-.2||(y<2&&Math.hypot(m.x+15.8236,m.y+13.9174)<1.3))continue;add(new T.PlaneGeometry(w+.22,wh+.22),'white',m.x,y+wh/2,m.y,angle);add(new T.PlaneGeometry(w,wh),'glass',m.x+n.x*.04,y+wh/2,m.y+n.y*.04,angle);for(const yy of [wh*.45,wh*.72])box(m.x+n.x*.07,y+yy,m.y+n.y*.07,w,.07,.08,'white',angle);box(m.x+n.x*.07,y,m.y+n.y*.07,.07,wh,.08,'white',angle);box(m.x+n.x*.08,y-.15,m.y+n.y*.08,w+.34,.17,.26,'white',angle);}
  }
  // Divide cornices where roof heights change, attaching each short section
  // to the actual perimeter rather than a fitted bounding rectangle.
  for(let u=0;u<L;u+=1.1){const len=Math.min(1.1,L-u),m=p.clone().addScaledVector(t,u+len/2),c=region(m),roof=height(m,c);box(m.x+n.x*.06,Math.min('frontEave'in c&&m.y>c.c?c.frontEave:c.eave,roof)-.20,m.y+n.y*.06,len+.025,.24,.34,'white',angle);}
 }
 // The projected central bay of the courtyard facade carries the dated
 // stone axis shown in the primary detail photograph, within the real wall.
 const cx=3.60,cz=-6.32;
 for(const y of [1.05,5.3]){for(const dx of [-1.02,1.02])box(cx+dx,y-.12,cz+.18,.19,3.22,.16,'white');box(cx,y+2.94,cz+.20,2.38,.20,.28,'white');}
 box(cx,4.18,cz+.19,2.35,.50,.18,'white');b.sign('MDCCXLVII',cx,4.29,cz+.29,.024,'dark');
 for(const dx of [-1.02,1.02])for(const y of [5.70,6.35,7.0])add(new T.SphereGeometry(.13,5,3).scale(.8,1.2,.4),'stone',cx+dx,y,cz+.29);
 // The entrance is the first intersection of the mapped Korte Spinhuissteeg
 // alley axis with this actual parent, not the nearest arbitrary perimeter.
 const px=-15.8236,pz=-13.9174,face=Math.PI;
 box(px,.04,pz-.08,1.65,2.85,.12,'dark',face);
 for(const dx of [-1.02,1.02])box(px+dx,.03,pz-.17,.25,3.05,.28,'white',face);
 box(px,2.97,pz-.20,2.43,.22,.35,'white',face);
 box(px,2.26,pz-.16,1.65,.50,.08,'glass',face);
 for(const dx of [-.55,0,.55])box(px+dx,2.26,pz-.24,.055,.50,.07,'white',face);
 box(px,2.5,pz-.24,1.65,.055,.07,'white',face);
 const crest=new T.Shape();crest.moveTo(-1.12,0);crest.lineTo(1.12,0);crest.quadraticCurveTo(.9,.5,.54,.51);crest.quadraticCurveTo(.44,.89,0,1.0);crest.quadraticCurveTo(-.44,.89,-.54,.51);crest.quadraticCurveTo(-.9,.5,-1.12,0);
 add(new T.ShapeGeometry(crest),'white',px,3.2,pz-.25,face);
 box(px,3.35,pz-.30,1.46,.40,.06,'stone',face);
 for(const dx of [-.65,.65])add(new T.TorusGeometry(.24,.075,4,10,Math.PI*1.5),'white',px+dx,3.63,pz-.31,face);
 // Inferred from the primary cupola photograph and the small elevated AHN5
 // roof at this location. Simplified supports/ornament are not survey vertices.
 const tx=-15.928273,tz=-11.077826;
 box(tx,11.2,tz,1.35,1.25,1.35,'frame');
 box(tx,12.4,tz,1.72,.16,1.72,'white');
 for(const x of [-.65,.65])for(const z of [-.65,.65]){box(tx+x,12.55,tz+z,.15,2.62,.15,'white');box(tx+x,12.5,tz+z,.24,.20,.24,'white');}
 for(let k=0;k<4;k++){const a=k*Math.PI/2,nx=Math.sin(a),nz=Math.cos(a);add(new T.TorusGeometry(.56,.09,4,10,Math.PI),'white',tx+nx*.66,14.44,tz+nz*.66,a);box(tx+nx*.67,12.65,tz+nz*.67,1.32,.09,.12,'white',a);for(const u of [-.4,0,.4])box(tx+nx*.67+u*Math.cos(a),12.65,tz+nz*.67-u*Math.sin(a),.055,.63,.065,'white');}
 box(tx,15.17,tz,1.82,.15,1.82,'white');
 add(new T.SphereGeometry(.78,8,5,0,Math.PI*2,0,Math.PI/2).scale(1,1.9,1),'frame',tx,15.32,tz);
 box(tx,16.8,tz,.06,.50,.06,'gold');add(new T.SphereGeometry(.12,6,4),'gold',tx,17.18,tz);

}
