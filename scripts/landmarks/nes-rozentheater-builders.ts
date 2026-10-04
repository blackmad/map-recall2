import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './nes-rozentheater-specs.json';
import sources from './nes-rozentheater-footprints.json';
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
  body(ring,11.75,'brick');plane(ring,11.79,'slate');
  const front=21.4,left=-4.15,right=9.0,cx=(left+right)/2,w=right-left;
  // Three stone entrance arches below the tall original stained-glass theater windows.
  box(cx,0,front,w,3.6,.22,'stone');for(const x of [cx-2.6,cx,cx+2.6]){arch(x,.05,front+.18,2.35,3.2,'white');arch(x,.09,front+.23,2.05,2.95,'dark');box(x,.1,front+.3,.07,2.5,.08,'gold');}
  for(const x of [left+.75,right-.75]){box(x,4.25,front+.07,1.0,6.65,.18,'white');box(x,4.37,front+.2,.78,6.4,.08,'glass');box(x,4.37,front+.26,.055,6.4,.05,'frame');for(let yy=4.4;yy<10.8;yy+=1.1)box(x,yy,front+.26,.8,.055,.05,'frame');}
  for(let i=0;i<5;i++){const x=cx-3.0+i*1.5;sash(x,4.65,front+.13,1.22,6.7);for(let j=0;j<6;j++){const c:C=(i+j)%3===0?'gold':(i+j)%3===1?'red':'blue';box(x+(j%2?-.28:.27),5.2+j*.86,front+.34,.28,.25,.04,c);}}
  box(cx,3.65,front+.4,8.1,.35,.85,'slate');box(cx,4.0,front+.4,8.0,.85,.23,'dark');sign('BOOM CHICAGO',cx,4.1,front+.55,.14,'red',7.6);
  for(const y of [3.8,11.3,11.65])box(cx,y,front+.09,w+.2,.22,.3,'stone');
  // Lead-covered barrel across central foyer, with the taller sloping side roof masses behind the facade.
  for(const [lo,hi] of [[left,cx-3.9],[cx+3.9,right]])roof(region(lo,hi,11,21.2),11.75,3.3,'x','slate');
  // Build directly in native X/Y/Z. Rotating a unit cylinder and then
  // scaling its world axes distorted the old barrel into intersecting arcs.
  const barrelRegion=region(cx-3.9,cx+3.9,11,21.2),steps=20;
  for(let i=0;i<steps;i++){
   const x0=cx-3.9+i*7.8/steps,x1=cx-3.9+(i+1)*7.8/steps;
   const strip=clip(clip(barrelRegion,'x',x0,true),'x',x1,false);if(strip.length<3)continue;
   const roof=new T.ShapeGeometry(new T.Shape(strip)),p=roof.getAttribute('position');
   for(let j=0;j<p.count;j++){const x=p.getX(j),z=p.getY(j),u=(x-cx)/3.9;p.setXYZ(j,x,11.79+2.3*Math.sqrt(Math.max(0,1-u*u)),z)}
   if(roof.index)for(let j=0;j<roof.index.count;j+=3){const k=roof.index.getX(j);roof.index.setX(j,roof.index.getX(j+2));roof.index.setX(j+2,k)}roof.computeVertexNormals();roof.userData.role='boom-foyer-barrel';add(roof,'slate');
  }
  // Rear auditorium volume follows the narrow irregular mapped plot and remains below mapped max15.1m.
  const auditorium=region(-10,10,-22,11);body(auditorium,12.6,'brick');roof(auditorium,12.6,2.45,'x','slate');
 }else throw new Error(`No Nes/Rozentheater builder for ${id}`);
}
