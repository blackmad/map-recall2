import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './heineken-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original facade-led reconstruction of the three surviving brewery fronts. */
export function buildHeinekenExperience(_id:string,_w:number,_d:number,b:BuildingTools){
 const ring=data.ring.map(p=>new T.Vector2(p[0],p[1]));
 function clip(poly:T.Vector2[],axis:'x'|'y',value:number,above:boolean){const out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=above?p[axis]>=value:p[axis]<=value,c=above?q[axis]>=value:q[axis]<=value;if(a)out.push(p.clone());if(a!==c)out.push(p.clone().lerp(q,(value-p[axis])/(q[axis]-p[axis])));}return out;}
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(ring,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 function body(poly:T.Vector2[],h:number,c:Colour){if(poly.length<3)return;const g=new T.ExtrudeGeometry(new T.Shape(poly),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);b.add(g,c);}
 body(region(-60,-29.2,2.5,25),21.08,'brick');body(region(-29.2,-9.1,2.5,25),20.82,'brick');body(region(-9.1,60,1.50,25),22.04,'brick');body(region(-60,60,-30,2.5),3.80,'brick');
 // Surveyed planar patches retain low rear wings and supported independent rooftop volumes.
 // Build the roof shapes anew from the measured plan/ridge points rather than import a mesh.
 for(const patch of data.roofZones){
  const rings=[patch.plan,...patch.holes],outer=rings[0].map(p=>new T.Vector2(p[0],p[1])),holes=rings.slice(1).map(r=>r.map(p=>new T.Vector2(p[0],p[1]))),faces=T.ShapeUtils.triangulateShape(outer,holes),all=rings.flat(),positions:number[]=[];
  for(const face of faces){const ps=face.map(i=>all[i]),v=ps.map(p=>new T.Vector3(p[0],p[2],p[1]));if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).y<0)ps.reverse();for(const p of ps)positions.push(p[0],p[2]+.018,p[1]);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();b.add(geo,'slate');
  // A wall shell below each raised roof prevents unsupported floating planes.
  const wall:number[]=[];
  for(const r of rings){const area=T.ShapeUtils.area(r.map(p=>new T.Vector2(p[0],p[1])));for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];const base=(x:number,z:number)=>z<1.5?3.8:x<-29.2?21.08:x<-9.1?20.82:22.04;const pp=[p[0],Math.min(base(p[0],p[1]),p[2]),p[1]],qq=[q[0],Math.min(base(q[0],q[1]),q[2]),q[1]],pt=[p[0],p[2],p[1]],qt=[q[0],q[2],q[1]];const order=area<0?[pp,qt,pt,pp,qq,qt]:[pp,pt,qt,pp,qt,qq];order.forEach(v=>wall.push(...v));}}
  const walls=new T.BufferGeometry();walls.setAttribute('position',new T.Float32BufferAttribute(wall,3));walls.computeVertexNormals();b.add(walls,patch.plan.some(p=>p[2]>24)?'frame':'brick');
 }
 function frontZ(x:number){const hits:number[]=[];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];if(Math.abs(q.x-p.x)>.0001&&x>=Math.min(p.x,q.x)&&x<=Math.max(p.x,q.x))hits.push(p.y+(q.y-p.y)*(x-p.x)/(q.x-p.x));}return Math.max(...hits);}
 function pane(x:number,y:number,z:number,w:number,h:number,c:Colour='glass',rot=0){b.add(new T.PlaneGeometry(w,h),c,x,y+h/2,z,rot);}
 function arch(x:number,y:number,z:number,w:number,h:number,c:Colour){const radius=w/2,shape=new T.Shape();shape.moveTo(-radius,0);shape.lineTo(radius,0);shape.lineTo(radius,h-radius);for(let i=0;i<=10;i++){const a=i*Math.PI/10;shape.lineTo(radius*Math.cos(a),h-radius+radius*Math.sin(a));}shape.closePath();b.add(new T.ShapeGeometry(shape),c,x,y,z);}
 function opening(x:number,y:number,w:number,h:number,arched=false){const z=frontZ(x)+.11; if(arched){arch(x,y-.10,z,w+.26,h+.20,'red');arch(x,y,z+.025,w,h,'dark');arch(x,y+.07,z+.05,w-.16,h-.14,'glass');}else{pane(x,y-.10,z,w+.22,h+.2,'stone');pane(x,y,z+.03,w,h,'dark');pane(x,y+.06,z+.055,w-.15,h-.12);}
  b.box(x,y,z+.08,.07,h-.15,.07,'frame');for(const f of [.35,.7])b.box(x,y+h*f,z+.08,w-.10,.065,.07,'frame');b.box(x,y-.16,z,w+.3,.17,.3,'stone');
 }
 // Brew house: four paired bays, tall lower arches/oculi and two upper window rows.
 for(let bay=0;bay<4;bay++){const cx=-26.8+bay*5.1,z=frontZ(cx)+.12;
  for(const dx of [-.91,.91]){opening(cx+dx,1.05,1.37,2.8);opening(cx+dx,6.1,1.46,4.95,true);opening(cx+dx,13.0,1.32,2.33);opening(cx+dx,16.35,1.32,2.25);}
  const circle=new T.CircleGeometry(.55,14);b.add(circle,'dark',cx,11.72,z+.05);b.add(new T.CircleGeometry(.41,14),'glass',cx,11.72,z+.08);
  // Relief arch around each paired main window; an open band preserves its glass.
  const rr=2.13,g=new T.RingGeometry(rr-.16,rr,18,1,0,Math.PI);b.add(g,'red',cx,10.24,z+.025);b.box(cx,12.22,z,.39,.48,.24,'stone');
  if(bay===0||bay===3){for(const dx of [-.91,.91])opening(cx+dx,20.65,1.25,2.8,true);for(let i=0;i<6;i++)arch(cx-1.67+i*.67,24.14,z,.44,1.22,'red');}
  else for(const dx of [-.78,0,.78])opening(cx+dx,20.80,.53,1.35,true);
 }
 const bz=frontZ(-19)+.09; b.box(-19.15,19.25,bz,20.15,1.13,.24,'stone');b.sign('HEINEKEN BROUWERIJ',-19.15,19.42,bz+.15,.125,'dark');
 // Two raised end facade panels; narrow stones do not conceal the measured roof.
 for(const x of [-27.0,-11.5]){const z=frontZ(x);b.box(x,22.1,z-.13,4.7,3.75,.30,'brick');b.box(x,25.85,z,4.95,.22,.38,'stone');for(const dx of [-2.2,2.2])b.box(x+dx,1,z+.03,.31,24.8,.22,'brick');}
 // Current glass rooftop lantern above the brew house, under the measured hip roof.
 const tx=-19.4,tz=11.25;
 for(const side of [-1,1]){pane(tx,23.15,tz+side*2.85,4.45,4.48,'glass',side<0?Math.PI:0);for(const dx of [-2.22,0,2.22])b.box(tx+dx,23.15,tz+side*2.90,.09,4.48,.10,'frame');for(const y of [23.15,25.4,27.63])b.box(tx,y,tz+side*2.90,4.55,.09,.10,'frame');}
 for(const side of [-1,1]){pane(tx+side*2.35,23.15,tz,5.6,4.48,'glass',side*Math.PI/2);for(const dz of [-2.75,0,2.75])b.box(tx+side*2.4,23.15,tz+dz,.10,4.48,.09,'frame');}
 // Six-bay malt silo: deliberately blank panels with projecting masonry/stone accents.
 for(let i=0;i<6;i++){const x=-45.7+i*2.83,z=frontZ(x)+.08;b.box(x,4.7,z,.22,15.1,.24,'brick');b.box(x,5.0,z,2.15,.15,.22,'stone');b.box(x,19.6,z,2.15,.16,.22,'stone');if(i<4)opening(x+1.13,1.35,1.25,2.55);}
 b.box(-38.2,21.08,frontZ(-38.2),18.35,.22,.30,'stone');
 // Cooling/storage hall remains mostly windowless, as built to hold a constant temperature.
 for(let x=-.1;x<48;x+=3.5){const z=frontZ(x)+.07;b.box(x,0,z,3.38,.95,.18,'dark');b.box(x,1,z,3.38,3.0,.14,'stone');}
 b.box(22.5,4.08,frontZ(22.5)+.05,51.8,.25,.30,'stone');b.box(22.5,22.12,frontZ(22.5)+.02,51.8,.25,.32,'stone');
 b.sign('HEINEKEN BROUWERIJ',24.0,14.70,frontZ(24)+.14,.26,'gold');
 // Current Mijksenaar entrance occupies the transition beside the brew house.
 const ex=-5.0,ez=frontZ(ex)+.13;pane(ex,.45,ez,7.35,12.4,'dark');pane(ex,.55,ez+.035,7.05,12.1);for(let x=ex-3.4;x<=ex+3.5;x+=1.18)b.box(x,.45,ez+.07,.095,12.3,.095,'frame');for(const y of [3.0,7.5,12.82])b.box(ex,y,ez+.07,7.35,.095,.10,'frame');b.box(ex,.4,ez+.13,.70,11.6,.13,'green');
 // Original cooling-hall clerestory: 37 opening lights per long side (RCE527811).
 // These sit below, and outside, the measured roof eaves rather than on its slope.
 for(const side of [-1,1])for(let i=0;i<37;i++){const x=.75+i*1.285,z=side>0?15.04:6.48,rot=side>0?0:Math.PI;pane(x,22.87,z,1.08,1.42,'dark',rot);pane(x,22.92,z+side*.025,.91,1.31,'glass',rot);b.box(x,22.88,z+side*.045,.055,1.42,.06,'frame');b.box(x,23.58,z+side*.045,1.08,.05,.06,'frame');}
 // West corner clock accents and restrained long cooling-hall side relief.
 const wx=49.42;b.box(wx,1,10.5,.24,22.7,1.7,'brick');b.box(wx,23.7,10.5,.42,.20,2.0,'stone');
 b.clock(46.8,19.2,frontZ(46.8)+.19);
 for(let y=4;y<19;y+=3)b.box(49.42,y,9.8,.12,.09,16.3,'stone');
 for(const z of [6.5,8.2,9.9,11.6,13.3]){pane(49.46,5.2,z,1.0,11.0,'dark',Math.PI/2);b.box(49.48,5.1,z,.16,11.2,.12,'brick');}
 // Rear low workshop/stable elevations retain the mapped stepped depth, not tall brewery mass.
 for(const edge of [[-39,-10.1,-1],[-23,-9.15,-1],[12,-24.95,-1]] as const){const[x,z]=edge;for(let i=-5;i<=5;i+=2.5){pane(x+i,1.05,z-.07,1.35,1.9,'dark',Math.PI);pane(x+i,1.13,z-.1,1.16,1.73,'glass',Math.PI);}}
}
