import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './plantage-museum-footprints.json';
import specs from './plantage-museum-specs.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original 2024 museum and memorial architecture, aligned to current BAG outlines. */
export function buildPlantageMuseumLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=specs.find(s=>s.id===id)!,source=sources.find(s=>s.id===id)!,anchor=s.footprint.centre,h=(s.surveyed.northOffsetDegrees+90)*Math.PI/180;
 const coord=([lng,lat]:number[])=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));};
 const polys=source.parts.map(p=>p.polygons[0].map(r=>r.map(coord)));
 const shape=(rings:T.Vector2[][])=>{let sh=new T.Shape(rings[0]);for(const r of rings.slice(1))sh.holes.push(new T.Path(r));return sh;};
 const body=(rings:T.Vector2[][],height:number,c:C)=>{if(rings[0].length<3)return;let g=new T.ExtrudeGeometry(shape(rings),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,c);};
 const plane=(rings:T.Vector2[][],height:number,c:C)=>{let g=new T.ShapeGeometry(shape(rings));g.rotateX(Math.PI/2);add(g,c,0,height,0);};
 const clip=(r:T.Vector2[],axis:'x'|'y',value:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ai=more?a[axis]>=value:a[axis]<=value,qi=more?q[axis]>=value:q[axis]<=value;if(ai)out.push(a.clone());if(ai!==qi)out.push(a.clone().lerp(q,(value-a[axis])/(q[axis]-a[axis])));}return out;};
 const region=(r:T.Vector2[],x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(r,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const sash=(x:number,y:number,z:number,w:number,hh:number)=>{box(x,y,z,w+.22,hh+.22,.18,'white');box(x,y+.11,z+.12,w,hh,.08,'glass');for(const dx of [-w*.33,0,w*.33])box(x+dx,y+.11,z+.18,.055,hh,.05,'frame');for(let yy=y+.6;yy<y+hh;yy+=.55)box(x,yy,z+.18,w,.055,.05,'frame');};
 const triangle=(x:number,y:number,z:number,w:number,rise:number,c:C)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x-w/2,y,z,x+w/2,y,z,x,y+rise,z],3));g.computeVertexNormals();add(g,c);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh),c,x,y,z);};
 if(id==='national-holocaust-museum'){
  const ring=polys[0][0],museumFront=region(ring,-100,100,6.7,24),frontHoles=polys[0].slice(1).map(r=>region(r,-100,100,6.7,24)).filter(r=>r.length>2);
  // BAG's legal rear contour includes the open garden: never extrude it into a roofed block.
  body([museumFront,...frontHoles],9.5,'white');plane([museumFront,...frontHoles],9.52,'slate');
  // Winhov's as-built plan retains approximately sixteen metres of school depth at the street.
  const garden=region(ring,-100,100,-100,6.65);plane([garden],.025,'stone');
  // Low perimeter walls, paths, benches and the long reflective garden element.
  for(let i=0;i<ring.length-1;i++){const a=ring[i],q=ring[i+1];if(a.y>6.7||q.y>6.7)continue;const dx=q.x-a.x,dz=q.y-a.y,len=Math.hypot(dx,dz);if(len>.3)box((a.x+q.x)/2,0,(a.y+q.y)/2,len,1.35,.2,'stone',-Math.atan2(dz,dx));}
  box(-11.5,.02,-7.8,1.1,.08,28.5,'white');box(-11.5,.02,-8.2,18.5,.08,1.05,'white');
  for(const z of [-4,-17])box(-3.8,.05,z,1.7,.08,8.2,'slate');
  for(const z of [-3.5,-15.7]){box(-20.3,.12,z,1.0,.42,3.7,'slate');box(-20.3,.54,z,1.3,.12,3.9,'stone');}
  const front=23.05,oldLeft=-22.25,oldRight=-4.4,oldMid=(oldLeft+oldRight)/2;
  box(oldMid,0,front,oldRight-oldLeft,9.5,.2,'brick');for(const y of [.2,3.55,4.85,9.15])box(oldMid,y,front+.18,oldRight-oldLeft,.24,.2,'stone');
  for(let x=oldLeft+.8;x<oldRight;x+=2.4)for(const y of [1.0,5.2]){const wide=x>oldRight-4?2.0:1.6;sash(x,y,front+.22,wide,y>4?2.8:2.15);for(let yy=y;yy<y+2.8;yy+=.56)for(const dx of [-wide/2-.23,wide/2+.23])box(x+dx,yy,front+.24,.24,.18,.1,'stone');}
  // The school's two unequal brick gables stand in front of a renewed zinc mansard.
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute([oldLeft,9.5,front,oldRight,9.5,front,oldLeft,14.8,6.7,oldRight,9.5,front,oldRight,14.8,6.7,oldLeft,14.8,6.7],3));roof.computeVertexNormals();add(roof,'slate');
  box(oldMid,9.5,6.82,oldRight-oldLeft,5.3,.23,'slate');
  for(const [x,w,rise] of [[-13.7,4.3,3.9],[-6.9,5.0,5.4]]){triangle(x,9.5,front+.32,w,rise,'brick');for(let dy=.6;dy<rise;dy+=.6)box(x,9.5+dy,front+.34,w*(1-dy/rise),.12,.16,'red');}
  arch(-6.9,5.3,front+.47,3.7,4.1,'dark');sash(-6.9,5.3,front+.48,3.2,2.9);box(-13.7,0,front+.3,2.0,3.4,.14,'dark');arch(-13.7,2.3,front+.47,1.75,1.3,'glass');
  // Current 2024 entrance wing: pale stepped masonry and a perforated brick screen.
  const entrance=region(ring,-4.35,4.4,6.7,23.15);body([entrance],16.4,'stone');plane([entrance],16.43,'stone');const upper=region(ring,-4.35,4.4,6.7,11.5);body([upper],18.3,'stone');plane([upper],18.33,'stone');
  const ex=.95,doorWidth=4.7;box(ex,0,front+.15,doorWidth,3.65,.22,'dark');box(ex,.1,front+.32,doorWidth-.18,3.38,.08,'glass');for(const dx of [-2.22,0,2.22])box(ex+dx,.1,front+.4,.1,3.45,.08,'gold');box(ex,2.55,front+.4,doorWidth,.1,.08,'gold');
  box(ex,5.25,front+.17,4.7,9.6,.08,'dark');
  // Openings are actual gaps in an added lattice, backed by the recessed dark cavity.
  const col=.43,row=.25;for(let j=0;j<38;j++){const yy=5.25+j*row;box(ex,yy,front+.39,4.9,.13,.2,'stone');for(let k=0;k<11;k++){const xx=ex-2.2+k*col+(j%2?col*.2:0);box(xx,yy+.13,front+.39,.24,.12,.2,'stone');}}
  for(let y=.5;y<16.3;y+=.5)box(-3.93,y,front+.21,.13,.13,.08,'white');
  sign('HOLOCAUST',-3.05,2.8,front+.4,.042,'dark');sign('MUSEUM',-3.05,2.35,front+.4,.06,'dark');
  // Explicit adjoining nursery context, retained because the old OSM parent joined both buildings.
  body(polys[1],13.95,'blue');plane(polys[1],14.0,'slate');const nb=region(polys[1][0],4.3,13.25,15,24),nfront=23.0;
  if(nb.length){for(const yy of [1.1,4.15,7.2,10.25]){box(8.75,yy,nfront+.1,8.7,1.8,.15,'glass');for(let x=4.6;x<13;x+=1.45)box(x,yy,nfront+.21,.09,1.8,.08,'white');box(8.75,yy+1.75,nfront+.22,8.9,.12,.1,'white');}box(8.75,13.55,nfront+.2,9,.25,.35,'white');}
 }else if(id==='hollandsche-schouwburg'){
  const ring=polys[0][0],front=Math.max(...ring.map(p=>p.y)),xmin=Math.min(...ring.map(p=>p.x)),xmax=Math.max(...ring.map(p=>p.x)),w=xmax-xmin,cx=(xmin+xmax)/2;
  // The former auditorium is an open memorial courtyard, surrounded by low arcades.
  body(polys[0],3.1,'white');plane(polys[0],3.13,'slate');const foyer=region(ring,-100,100,front-8.7,front+.1);body([foyer],13.4,'stone');plane([foyer],13.43,'slate');
  box(cx,0,front+.12,w,3.6,.2,'stone');for(let y=.35;y<3.5;y+=.45)box(cx,y,front+.27,w,.055,.1,'dark');
  for(const x of [cx-w*.33,cx-w*.165,cx,cx+w*.165,cx+w*.33])arch(x,.15,front+.34,x===cx?2.1:1.7,3.2,x===cx?'glass':'dark');
  for(const y of [3.7,4.0,8.35,12.55,13.15])box(cx,y,front+.3,w+.2,.25,.4,'white');
  for(const x of [cx-w*.36,cx-w*.18,cx+w*.18,cx+w*.36]){
   box(x,4.15,front+.48,.85,.65,.65,'white');add(new T.CylinderGeometry(.23,.33,7.1,12),'stone',x,8.35,front+.57);box(x,11.95,front+.57,.85,.42,.65,'white');
   for(let k=0;k<10;k++){const a=k*Math.PI/5;box(x+.25*Math.sin(a),4.8,front+.57+.25*Math.cos(a),.06,6.75,.06,'white');}
   for(const dx of [-.3,.3])add(new T.SphereGeometry(.18,8,4),'stone',x+dx,12.3,front+.65);
  }
  for(let x=cx-w*.42;x<cx+w*.44;x+=w*.14){sash(x,4.8,front+.32,w*.09,3.0);sash(x,9.0,front+.32,w*.095,2.55);}
  box(cx,3.95,front+.63,w*.96,.23,.8,'white');for(let x=xmin+.55;x<xmax-.5;x+=.42)add(new T.CylinderGeometry(.1,.14,.7,6),'stone',x,4.48,front+.78);box(cx,4.82,front+.7,w*.96,.18,.35,'white');
  // Large triangular pediment with low-poly figurative relief, dentils and raking cornices.
  const pw=w*.68,rise=2.8;triangle(cx,13.4,front+.32,pw,rise,'stone');for(const dir of [-1,1]){const g=new T.BoxGeometry(Math.hypot(pw/2,rise),.21,.45);g.rotateZ(dir*Math.atan(rise/(pw/2)));add(g,'white',cx-dir*pw/4,14.8,front+.36);}
  for(let x=xmin+.4;x<xmax-.2;x+=.55)box(x,12.96,front+.54,.27,.22,.35,'white');
  for(const [dx,yy] of [[0,14.45],[-1.2,14],[1.3,13.9],[-2.5,13.75],[2.55,13.75]]){add(new T.IcosahedronGeometry(.19,0),'white',cx+dx,yy+.54,front+.58);add(new T.CylinderGeometry(.2,.32,.6,6),'white',cx+dx,yy+.1,front+.6);}
  // Roof at the foyer only; no roof fills the open court behind it.
  box(cx,13.45,front-4.4,w*.8,.25,8.4,'slate');
  const back=Math.min(...ring.map(p=>p.y));for(const xx of [xmin+.7,xmax-.7])for(let z=back+1;z<front-9;z+=3.1){box(xx,.05,z,.15,3,.15,'white');box(xx,2.9,z,1.25,.2,2.7,'white');}
  // Restrained central memorial obelisk and pedestal, located within the open courtyard.
  box(cx,0,back+4.3,2.3,.35,2.3,'slate');add(new T.CylinderGeometry(.18,.3,3.6,6),'slate',cx,2.15,back+4.3);add(new T.ConeGeometry(.2,.55,6),'slate',cx,4.22,back+4.3);
 }else throw new Error(`No Plantage museum builder for ${id}`);
}
