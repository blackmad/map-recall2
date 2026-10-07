import {boomChicagoSignage} from './boom-chicago-signage';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './nes-rozentheater-specs.json';
import sources from './nes-rozentheater-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import {boomChicagoSignage} from './boom-chicago-signage';
type C=Parameters<BuildingTools['add']>[1];
/** Venue-specific architecture, built on individual current BAG plans and never a block-wide slab. */
export function buildNesRozentheaterLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=specs.find(s=>s.id===id)!,source=sources.find(s=>s.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const coord=([lng,lat]:number[])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));};
 const rings=source.parts[0].polygons[0].map(r=>r.map(coord)),ring=rings[0];
 const shape=(rs:T.Vector2[][])=>{const sh=new T.Shape(rs[0]);for(const r of rs.slice(1))sh.holes.push(new T.Path(r));return sh;};
 const body=(r:T.Vector2[],height:number,c:C)=>{if(r.length<3)return;const g=new T.ExtrudeGeometry(shape([r]),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,c);};
 const plane=(r:T.Vector2[],y:number,c:C)=>{if(r.length<3)return;const g=new T.ShapeGeometry(new T.Shape(r));g.rotateX(Math.PI/2);add(g,c,0,y,0);};
 const clip=(r:T.Vector2[],axis:'x'|'y',value:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ai=more?a[axis]>=value:a[axis]<=value,qi=more?q[axis]>=value:q[axis]<=value;if(ai)out.push(a.clone());if(ai!==qi)out.push(a.clone().lerp(q,(value-a[axis])/(q[axis]-a[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(ring,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C,back=false)=>{const rr=w/2,sh=new T.Shape();sh.moveTo(-rr,0);sh.lineTo(rr,0);sh.lineTo(rr,hh-rr);sh.absarc(0,hh-rr,rr,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);if(back)g.rotateY(Math.PI);add(g,c,x,y,z);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,back=false)=>{const dir=back?-1:1;box(x,y,z,w+.22,hh+.2,.16,'white');box(x,y+.11,z+dir*.12,w,hh,.08,'glass');box(x,y+.11,z+dir*.17,.06,hh,.06,'frame');box(x,y+hh*.72,z+dir*.17,w,.06,.06,'frame');box(x,y+hh+.12,z,w+.38,.14,.25,'stone');};
 const triangle=(x:number,y:number,z:number,w:number,rise:number,c:C,back=false)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x-w/2,y,z,x+w/2,y,z,x,y+rise,z],3));if(back)g.setIndex([2,1,0]);g.computeVertexNormals();add(g,c);};
 const roof=(r:T.Vector2[],base:number,rise:number,axis:'x'|'y',c:C)=>{if(r.length<3)return;const vals=r.map(p=>p[axis]),lo=Math.min(...vals),hi=Math.max(...vals),mid=(lo+hi)/2;for(const [min,max,more] of [[lo,mid,false],[mid,hi,true]] as const){const clipped=clip(r,axis,mid,more),geo=new T.ShapeGeometry(new T.Shape(clipped)),p=geo.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),v=axis==='x'?x:z,yy=base+rise*(1-Math.abs(v-mid)/((hi-lo)/2));p.setXYZ(i,x,yy,z);}const idx=geo.getIndex()!;for(let k=0;k<idx.count;k+=3){const t=idx.getX(k);idx.setX(k,idx.getX(k+2));idx.setX(k+2,t);}geo.computeVertexNormals();add(geo,c);} };
 if(id==='brakke-grond'){
  // This concave parent leaves the Nesplein entirely open, between cafe and main entrance.
  body(ring,7.3,'brick');plane(ring,7.34,'slate');
  const cafe=region(-41,20,9.5,30);body(cafe,11.8,'brick');roof(cafe,11.8,4.3,'y','slate');
  const modern=region(15,42,-31,10.7);body(modern,12.8,'brick');plane(modern,12.84,'slate');
  const rear=region(-16,15,-30,8);body(rear,13.2,'brick');roof(rear,13.2,4.45,'x','slate');
  // The cafe's eight-bay facade faces west onto the square, at the short end of the northern wing.
  // Its long north boundary is a rear elevation, not the square frontage.
  const cafeFace=(z:number)=>20.94-z*.177;
  for(const z of [11.2,13.45,15.7,17.95,20.2,22.45,24.7,26.95])for(const yy of [.3,4.1,8.0]){
   const x=cafeFace(z),hh=yy<1?3.2:2.8,ww=yy<1?1.8:1.2;
   box(x+.06,yy,z,.16,hh+.2,ww+.2,'white');box(x+.19,yy+.1,z,.08,hh,ww,'glass');box(x+.25,yy+.1,z,.05,hh,.045,'frame');box(x+.25,yy+hh*.7,z,.05,.065,ww,'frame');box(x+.07,yy+hh+.16,z,.28,.14,ww+.3,'stone');
  }
  for(const yy of [.2,3.7,7.65,11.4,11.8])box(cafeFace(19),yy,19,.3,.22,18.5,'white',-Math.atan(.177));
  for(let z=10.3;z<28;z+=.85)box(cafeFace(z)+.15,11.55,z,.4,.24,.23,'stone');
  for(const z of [13.5,19,24.5]){const x=cafeFace(z);box(x-.4,12.3,z,1.0,1.65,1.45,'white');box(x+.18,12.45,z,.08,1.1,1.0,'glass');b.gableRoof(x-.4,13.95,z,1.2,1.7,.55,'slate');}
  // The long rear elevation follows the diagonal legal contour.
  for(let x=-34;x<10;x+=4.75)for(const yy of [4.1,8.0])sash(x,yy,25.77+x*.185+.14,2.2,2.8);
  // Arthur Staal's entry on the right of the square: long canopy, glass foyer and discrete upper windows.
  const entryFace=(x:number)=>10.1-(x-19)*.052,fz=entryFace(28.5),cx=28.5,w=25;box(cx,0,fz+.1,w,3.3,.14,'glass',Math.atan(.052));for(let x=17;x<41;x+=3.05)box(x,0,entryFace(x)+.18,.11,3.3,.12,'dark');box(cx,3.45,fz+.45,w,.38,1.2,'dark',Math.atan(.052));
  for(const y of [4.7,8.5])for(const x of [21.0,27.5,34.0,39.2])sash(x,y,entryFace(x)+.18,2.65,2.9);
  // Small octagonal window is a characteristic surviving feature of the square facade.
  add(new T.CircleGeometry(1.0,8),'stone',16.5,5.9,fz+.18);const oct=new T.CircleGeometry(.8,8);add(oct,'glass',16.5,5.9,fz+.26);
  // Windows on the west Nes frontage are separate from the inward-facing entrance wing.
  // Project each Nes window onto the actual surveyed outer edge. This wall
  // recedes by almost8m along the street; a fixed x40 left windows in midair.
  const signedArea=ring.reduce((s,p,i)=>s+p.x*ring[(i+1)%ring.length].y-ring[(i+1)%ring.length].x*p.y,0);
  for(let z=-27;z<7;z+=4.6){
   const candidates=ring.flatMap((a,i)=>{const q=ring[(i+1)%ring.length],dz=q.y-a.y;if(Math.abs(dz)<.001)return[];const t=(z-a.y)/dz;if(t<0||t>1)return[];return[{a,q,x:a.x+t*(q.x-a.x)}]}).filter(p=>p.x>30).sort((a,q)=>q.x-a.x);
   const p=candidates[0];if(!p)continue;const dx=p.q.x-p.a.x,dz=p.q.y-p.a.y,L=Math.hypot(dx,dz),nx=(signedArea>0?dz:-dz)/L,nz=(signedArea>0?-dx:dx)/L,angle=-Math.atan2(dz,dx)+(signedArea>0?Math.PI:0);
   for(const y of[1.1,5.1,9.1]){
    box(p.x+nx*.035,y,z+nz*.035,2.65,2.8,.18,'white',angle);
    const pane=new T.BoxGeometry(2.4,2.6,.08);pane.userData.role='brakke-nes-window';pane.userData.wallPoint=[p.x,z];pane.userData.outward=[nx,nz];add(pane,'glass',p.x+nx*.145,y+1.4,z+nz*.145,angle);
    box(p.x+nx*.19,y+2.8,z+nz*.19,2.85,.15,.28,'white',angle);
   }
  }
 }else if(id==='frascati'){
  body(ring,9.4,'brick');plane(ring,9.44,'slate');
  const street=region(-20,21,17,28);body(street,14.2,'brick');plane(street,14.23,'slate');
  const hall=region(-17,17,-7.5,17);body(hall,14.2,'brick');roof(hall,14.2,5.25,'y','slate');
  // The north-facing rooflight strip belongs to the hall, not a fabricated courtyard roof.
  box(-2.2,17.0,4.75,26,.15,3.1,'glass');for(let x=-14;x<11;x+=2.3)box(x,17.11,4.75,.08,.09,3.1,'frame');
  const f=(x:number)=>25.1+x*.065,frontAngle=-Math.atan(.065);
  // Main Nes frontage: tall arched windows, pale pilasters and a dense classical cornice.
  for(const yy of [.15,3.8,8.0,11.85,13.9])box(.5,yy,f(.5),38,.2,.3,'stone',frontAngle);
  for(let x=-15.5;x<18;x+=4.2){const z=f(x);box(x,.25,z+.1,3.0,3.15,.13,'glass');box(x+1.85,.1,z+.18,.5,8.1,.35,'white');
   arch(x,4.1,z+.19,2.85,3.75,'white');arch(x,4.23,z+.24,2.55,3.5,'glass');box(x,4.25,z+.3,.07,3.45,.06,'frame');box(x,5.2,z+.3,2.55,.07,.06,'frame');
   sash(x,8.6,z+.19,2.65,2.55);sash(x,12.05,z+.19,2.3,1.3);
  }
  for(let x=-17;x<19;x+=.6)box(x,13.65,f(x)+.25,.25,.25,.3,'white');
  // Foyer entrance and projecting red FRASCATI sign, visible from the narrow street.
  box(8.7,0,f(8.7)+.22,3.8,3.75,.18,'dark');box(8.7,3.65,f(8.7)+.48,4.4,.2,.9,'dark');box(6.4,5.0,f(6.4)+.7,.95,4.25,.38,'red');
  for(let i=0;i<8;i++)sign('FRASCATI'[i],6.12,8.75-i*.43,f(6.4)+.94,.095,'white');
  // Canal-facing 19th-century plastered neo-Renaissance end, clipped to the actual through-building.
  const canal=region(4,19,-28,-14);body(canal,15.4,'stone');plane(canal,15.45,'slate');const cz=-27.3,ccx=8.25,cw=6.2;
  for(const yy of [0.4,3.9,7.4,11.0,14.7])box(ccx,yy,cz,cw,.21,.25,'white');
  for(const x of [6.8,9.7])for(const yy of [.9,4.3,7.8,11.3])sash(x,yy,cz-.12,1.65,2.5,true);
  triangle(ccx,15.35,cz-.2,5.3,2.65,'stone',true);for(const x of [5.7,ccx,10.8])add(new T.SphereGeometry(.24,6,4),'stone',x,x===ccx?18.15:15.65,cz-.2);
 }else if(id==='boom-chicago'){
  // Current PDOK aerial + 3DBAG (2026-10-06): long metal auditorium gable,
  // short front lead roofs, low western rear annex. RCE518326 describes the
  // original flat hall roof; do not use that historical state over current evidence.
  const shell=(r:T.Vector2[],height:number)=>{if(r.length>2)add(openTopPrism(shape([r]),0,height),'brick');};
  const flat=(r:T.Vector2[],y:number)=>{if(r.length>2)add(upwardRoofPlane(shape([r]),y),'slate');};
  const rearLow=region(-20,-3.4,-30,-9.95),rearMain=region(-3.4,7.55,-17.7,-9.95),rearEnd=region(-3.4,7.55,-30,-17.7);
  const eastLow=region(7.55,20,-30,-11.1),eastLink=region(7.55,20,-11.1,-9.95);
  for(const [r,y] of [[rearLow,3.22],[rearMain,12.98],[rearEnd,10.3],[eastLow,3.85],[eastLink,10.65]] as const){shell(r,y);flat(r,y);}
  const hall=region(-5.6,20,-9.95,18.5);shell(hall,10.72);roof(hall,10.72,3.75,'x','frame');
  // Close the hall's gable ends below the separate roof, including the rear
  // height transition. The roof is lighter standing-seam metal in the aerial.
  for(const z of [-9.95,18.5]){const section=hall.filter(p=>Math.abs(p.y-z)<.01),lo=Math.min(...section.map(p=>p.x)),hi=Math.max(...section.map(p=>p.x));triangle((lo+hi)/2,10.72,z,hi-lo,3.75,'brick',z<0);}
  const left=-4.3,right=9.12,cx=2.41,front=(x:number)=>21.4+x*.0278,angle=-Math.atan(.0278);
  const frontPart=region(-20,20,18.5,30);shell(frontPart,10.9);
  const facadeBox=(x:number,y:number,w:number,hh:number,depth:number,c:C,offset=.09)=>box(x,y,front(x)+offset,w,hh,depth,c,angle);
  facadeBox(cx,0,right-left,1.55,.2,'stone');
  // Three entrance arches in their continuous natural-stone surround.
  facadeBox(cx,0,8.0,4.8,.23,'stone');
  for(const x of [cx-2.6,cx,cx+2.6]){arch(x,.06,front(x)+.24,2.35,3.2,'white');arch(x,.1,front(x)+.29,2.07,2.96,'dark');facadeBox(x,.12,.06,2.48,.06,'frame',.34);facadeBox(x,2.33,2.07,.06,.06,'frame',.34);}
  // Tower entrances and long paired lights have slender stone central mullions.
  for(const x of [-2.83,7.67]){
   facadeBox(x,.15,1.65,2.45,.18,'stone');facadeBox(x,.25,1.39,2.27,.07,'dark',.22);
   facadeBox(x,4.22,1.22,5.78,.14,'stone');
   for(const dx of [-.31,.31]){facadeBox(x+dx,4.3,.48,5.59,.07,'glass',.23);for(const yy of [5.4,6.65,7.9,9.1])facadeBox(x+dx,yy,.48,.045,.05,'frame',.29);}
   facadeBox(x,4.22,.1,5.78,.17,'stone',.2);facadeBox(x,4.13,1.62,.16,.22,'stone');
   for(const dx of [-.71,.71])facadeBox(x+dx,9.6,.43,.43,.22,'stone');
  }
  // RCE's three paired stained-glass bays, rather than five generic sashes.
  for(const pair of [cx-2.7,cx,cx+2.7]){
   for(const dx of [-.59,.59]){const x=pair+dx;facadeBox(x,4.94,1.05,5.18,.12,'stone');
    const pane=new T.BoxGeometry(.91,5.04,.065);pane.userData.role='boom-stained-pane';add(pane,'glass',x,7.53,front(x)+.23,angle);
    for(const yy of [5.55,6.7,7.85,9.0])facadeBox(x,yy,.92,.035,.045,'frame',.28);
    // Muted flower-like leaded accents; current glass is dark, not bright checkerboard.
    for(const yy of [5.7,7.2,8.7]){const flower=new T.CircleGeometry(.095,6);flower.rotateY(angle);add(flower,'gold',x,yy,front(x)+.275);}
   }
   facadeBox(pair,4.93,.14,5.23,.2,'stone',.18);
  }
  for(const x of [cx-4.0,cx-1.35,cx+1.35,cx+4.0]){facadeBox(x,4.78,.3,5.55,.19,'brick');facadeBox(x,9.93,.45,.4,.23,'stone');}
  facadeBox(cx,3.8,8.12,.87,.23,'stone',.22);
  // Current real signs occupy two separate black panels. Native letter geometry
  // is added below; lettering backs clear the panels by5mm.
  for(const x of [cx-2.6,cx+2.6])facadeBox(x,4.04,2.55,.55,.12,'dark',.35);
  boomChicagoSignage(b,cx,front,angle);
  // Broad curved garland frieze is the defining cap of the middle volume.
  const frieze=new T.Shape();frieze.moveTo(-4.05,10.15);frieze.lineTo(4.05,10.15);frieze.lineTo(4.0,10.9);for(let i=19;i>=0;i--){const x=-4+i*.4;frieze.lineTo(x,10.9+1.65*Math.sqrt(Math.max(0,1-(x/4)**2)));}frieze.lineTo(-4.05,10.15);frieze.closePath();
  const fg=new T.ExtrudeGeometry(frieze,{depth:.2,bevelEnabled:false,curveSegments:16});fg.rotateY(angle);add(fg,'stone',cx,0,front(cx)+.08);
  for(let i=0;i<13;i++){const x=cx-3.65+i*.61;const yy=10.8+.38*(1-((x-cx)/4)**2);const relief=new T.TorusGeometry(.17,.035,4,8,Math.PI);relief.rotateZ(Math.PI);relief.rotateY(angle);add(relief,'white',x,yy,front(x)+.31);}
  for(const x of [-2.8,7.6])facadeBox(x,10.63,3.05,.27,.34,'stone');
  // Two four-sided hips, not narrow gables. Each footprint stays inside the
  // native surveyed parent, and the fronts slope away from the street.
  const hip=(r:T.Vector2[],x:number,z:number)=>{const vertices:number[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];if(p.distanceTo(q)<.001)continue;vertices.push(p.x,10.9,p.y,q.x,10.9,q.y,x,12.43,z);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));for(let i=0;i<vertices.length;i+=9){const p=new T.Vector3(...vertices.slice(i,i+3)),q=new T.Vector3(...vertices.slice(i+3,i+6)),r=new T.Vector3(...vertices.slice(i+6,i+9));if(q.sub(p).cross(r.sub(p)).y<0){for(let k=0;k<3;k++){const v=vertices[i+3+k];vertices[i+3+k]=vertices[i+6+k];vertices[i+6+k]=v;}}}g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.userData.role='boom-tower-hip';add(g,'slate');};
  hip(region(-20,cx-4,18.5,30),-2.75,19.88);hip(region(cx+4,20,18.5,30),7.68,20.17);
  const barrelRegion=region(cx-4,cx+4,18.5,30),steps=20;
  for(let i=0;i<steps;i++){
   const strip=clip(clip(barrelRegion,'x',cx-4+i*8/steps,true),'x',cx-4+(i+1)*8/steps,false);if(strip.length<3)continue;
   const g=upwardRoofPlane(shape([strip])),p=g.getAttribute('position');
   for(let j=0;j<p.count;j++){const x=p.getX(j),u=(x-cx)/4;p.setY(j,10.9+1.65*Math.sqrt(Math.max(0,1-u*u)));}g.computeVertexNormals();g.userData.role='boom-foyer-barrel';add(g,'slate');
  }
 }else throw new Error(`No Nes/Rozentheater builder for ${id}`);
}
