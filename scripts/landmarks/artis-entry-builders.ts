import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './artis-entry-specs.json';
import sources from './artis-entry-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** The restored Ledenlokalen and its separate historic zoo gate: no zoo-wide ground slab. */
export function buildArtisEntryLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,s=specs.find(s=>s.id===id)!,source=sources.find(s=>s.id===id)!,a=s.surveyed.anchor,h=209*Math.PI/180;
 const coord=([lng,lat]:number[])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));};
 const rings=source.parts.map(p=>(id==='micropia-ledenlokalen'?p.currentBagGeometry.coordinates[0]:p.polygons[0][0]).map(coord));
 const body=(r:T.Vector2[],height:number,c:C)=>{const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,c);};
 const clip=(r:T.Vector2[],value:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ai=more?a.x>=value:a.x<=value,qi=more?q.x>=value:q.x<=value;if(ai)out.push(a.clone());if(ai!==qi)out.push(a.clone().lerp(q,(value-a.x)/(q.x-a.x)));}return out;};
 const roof=(x:number,z:number,w:number,d:number,y:number,rise:number,c:C)=>{const turn=d>w;if(turn)[w,d]=[d,w];const v=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],ridge=Math.max(0,(w-d)/2),pos:number[]=[];const pt=(xx:number,yy:number,zz:number)=>[x+(turn?zz:xx),yy,z+(turn?xx:zz)];const tri=(a:number[],b:number[],c:number[])=>{const upward=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);pos.push(...a,...(upward<0?c:b),...(upward<0?b:c));};const p=v.map(([xx,zz])=>pt(xx,y,zz)),l=pt(-ridge,y+rise,0),r=pt(ridge,y+rise,0);tri(p[0],p[1],r);tri(p[0],r,l);tri(p[1],p[2],r);tri(p[2],p[3],l);tri(p[2],l,r);tri(p[3],p[0],l);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();add(g,c);};
 const sash=(x:number,y:number,z:number,w:number,hh:number)=>{box(x,y,z,w+.25,hh+.2,.2,'stone');box(x,y+.12,z+.12,w,hh,.08,'glass');box(x,y+.12,z+.19,.06,hh,.05,'gold');box(x,y+hh*.55,z+.19,w,.065,.05,'gold');box(x,y+hh+.19,z+.1,w+.55,.13,.3,'stone');};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh),c,x,y,z);};
 if(id==='micropia-ledenlokalen'){
  const ring=rings[0],xmin=Math.min(...ring.map(p=>p.x)),xmax=Math.max(...ring.map(p=>p.x)),front=Math.max(...ring.map(p=>p.y)),rear=Math.min(...ring.map(p=>p.y)),end=12.5;
  // Current BAG adds both end pavilions omitted by the stale 2014 OSM hall outline.
  // The rear projecting rectangle is a built glazed conservatory, verified in restoration photographs.
  body(ring,5.5,'brick');
  // Intersect the surveyed perimeter at the aperture coordinate. The native
  // fronts/rears are slightly oblique and have shallow masonry projections;
  // a whole-building extremum is not a pavilion facade plane.
  const facade=(axis:'x'|'y',value:number,sign:number)=>{
   const hits:{p:T.Vector2,t:T.Vector2,n:T.Vector2}[]=[];
   for(let i=0;i<ring.length-1;i++){
    const a=ring[i],q=ring[i+1],delta=q[axis]-a[axis];
    if(Math.abs(delta)<1e-7)continue;
    const u=(value-a[axis])/delta;if(u<0||u>1)continue;
    const p=a.clone().lerp(q,u),t=q.clone().sub(a).normalize();
    let n=new T.Vector2(-t.y,t.x);
    const outwardAxis=axis==='x'?'y':'x';if(n[outwardAxis]*sign<0)n.negate();
    hits.push({p,t,n});
   }
   const other=axis==='x'?'y':'x';hits.sort((a,b)=>sign*(b.p[other]-a.p[other]));
   if(!hits.length)throw new Error(`Missing native pavilion facade at ${axis}=${value}`);
   return hits[0];
  };
  const wallBox=(f:ReturnType<typeof facade>,along:number,y:number,out:number,w:number,hh:number,d:number,c:C)=>{
   const p=f.p.clone().addScaledVector(f.t,along).addScaledVector(f.n,out);
   // Local +Z is the outward wall normal, local +X follows its tangent.
   box(p.x,y,p.y,w,hh,d,c,Math.atan2(f.n.x,f.n.y));
  };
  const pavilionSash=(f:ReturnType<typeof facade>,y:number,w=1.65,hh=4.1)=>{
   wallBox(f,0,y,.03,w+.25,hh+.2,.2,'stone');
   wallBox(f,0,y+.12,.18,w,hh,.08,'glass');
   wallBox(f,0,y+.12,.25,.06,hh,.05,'gold');
   wallBox(f,0,y+hh*.55,.25,w,.065,.05,'gold');
   wallBox(f,0,y+hh+.19,.1,w+.55,.13,.3,'stone');
  };
  // Historic end pavilions retain three bays on their short ends and five along the street.
  for(const [lo,hi] of [[xmin,xmin+end],[xmax-end,xmax]]){
   const r=clip(clip(ring,lo,true),hi,false);body(r,11.8,'brick');const cx=(lo+hi)/2,rz=Math.min(...r.map(p=>p.y)),fz=Math.max(...r.map(p=>p.y)),cz=(fz+rz)/2,d=fz-rz;
   roof(cx,cz,end,d,12.1,2.35,'slate');
   // Split courses at the native changes of plane instead of stretching a
   // straight band across the shallow BAG corner/pier reliefs.
   for(let i=0;i<ring.length-1;i++){
    const a=ring[i],q=ring[i+1];if(Math.abs(q.x-a.x)<.4||Math.abs(q.y-a.y)>.1*Math.abs(q.x-a.x))continue;
    const left=Math.max(lo,Math.min(a.x,q.x)),right=Math.min(hi,Math.max(a.x,q.x));if(right<=left)continue;
    const f=facade('x',(left+right)/2,1);
    // Only the actual front edge (not the rear edge with the same x range).
    if(Math.abs(f.p.y-(a.y+(q.y-a.y)*(f.p.x-a.x)/(q.x-a.x)))>.05)continue;
    for(const yy of [.3,1.0,6.0,6.3,11.5,11.85])wallBox(f,0,yy,.06,(right-left)/Math.abs(f.t.x),.22,.4,'stone');
   }
   for(const xx of [lo+.4,hi-.4]){const f=facade('x',xx,1);wallBox(f,0,0,.08,.65,11.9,.55,'stone');for(let yy=1;yy<6;yy+=.6)wallBox(f,0,yy,.39,.76,.1,.1,'white');}
   for(let i=0;i<3;i++)for(const y of [1.4,6.8])pavilionSash(facade('x',lo+1.8+i*(end-3.6)/2,1),y);
   // Conservatory-facing pavilion windows, matching the visible restored garden facades.
   for(let i=0;i<3;i++)for(const y of [1.4,6.8])pavilionSash(facade('x',lo+1.8+i*(end-3.6)/2,-1),y);
   const back=facade('x',cx,-1);for(const yy of [.3,1,6,6.3,11.5])wallBox(back,0,yy,.06,end,.22,.2,'stone');
   const outerSign=lo===xmin?-1:1;
   for(let i=0;i<5;i++){
    const z=rz+2+i*(d-4)/4;
    for(const yy of [1.4,6.8])pavilionSash(facade('y',z,outerSign),yy);
    // The clipped inner edge is a modeled pavilion/hall join, not a BAG
    // exterior wall: no lower apertures through the adjoining 5.5 m hall.
    const inner={p:new T.Vector2(outerSign<0?hi:lo,z),t:new T.Vector2(0,1),n:new T.Vector2(-outerSign,0)};
    pavilionSash(inner,6.8);
   }
   const dormer=facade('x',cx,1);wallBox(dormer,0,12.15,-.15,1.8,1.15,.5,'stone');wallBox(dormer,0,12.3,.17,1.3,.8,.08,'glass');
   for(const xx of [lo+.4,hi-.4]){const f=facade('x',xx,1);add(new T.ConeGeometry(.22,.65,6),'stone',f.p.x-f.n.x*.55,12.5,f.p.y-f.n.y*.55);}
  }
  const l=xmin+end,r=xmax-end,cx=(l+r)/2,w=r-l;
  // Low restored street gallery. The street photo has a level entrance header;
  // the raised garden conservatory feature does not support a street pediment.
  box(cx,0,front-.75,w,6.05,.35,'brick');box(cx,5.9,front-.65,w,.5,.4,'stone');box(cx,6.45,front-.7,w,.3,.4,'white');
  // Photo-supported assembly, approximately dimensioned: 3.7 m opening, 0.55 m
  // piers, 2.1 m double doors and 0.8 m side lights. Hall centre is a placement
  // approximation; front remains the preexisting pavilion-derived facade plane.
  const entranceHalf=2.4,entranceLeft=cx-entranceHalf,entranceRight=cx+entranceHalf;
  for(let x=l+2.2;x<r-1;x+=4.4){
   // Replace intersecting generic glass AND its backing/cap rather than burying
   // the entrance under an existing sash. Retain each nonintersecting outer bay.
   const sashHalf=3.75/2+.275;
   if(x+sashHalf<=entranceLeft||x-sashHalf>=entranceRight)sash(x,1.0,front-.4,3.75,4.45);
   else for(const [lo,hi] of [[x-3.75/2,Math.min(x+3.75/2,entranceLeft-.275)],[Math.max(x-3.75/2,entranceRight+.275),x+3.75/2]])if(hi-lo>.6)sash((lo+hi)/2,1.0,front-.4,hi-lo,4.45);
   const pier=x+2.1;
   if(pier+.25<=entranceLeft||pier-.25>=entranceRight){box(pier,.45,front-.4,.32,5.4,.4,'stone');box(pier,5.75,front-.23,.5,.35,.5,'stone');}
  }
  for(const x of [cx-2.125,cx+2.125]){box(x,.3,front-.32,.55,5.35,.4,'stone');box(x,5.65,front-.23,.72,.25,.5,'stone');}
  box(cx,.3,front-.28,3.7,.12,.2,'stone');
  // Two door leaves and two narrow fixed sidelights share the lower frame;
  // their rectangular transom stays below the header and separate clerestory.
  for(const x of [cx-.525,cx+.525]){box(x,.42,front-.28,1.05,.28,.08,'dark');box(x,.7,front-.28,1.05,3.45,.08,'glass');}
  for(const x of [cx-1.45,cx+1.45])box(x,.42,front-.28,.8,3.73,.08,'glass');
  box(cx,4.25,front-.28,3.7,1.3,.08,'glass');
  for(const x of [cx-1.85,cx-1.05,cx+1.05,cx+1.85])box(x,.42,front-.18,.08,5.13,.07,'gold');
  box(cx,.42,front-.18,.08,3.73,.07,'gold');
  for(const y of [.42,4.15,5.55])box(cx,y,front-.18,3.7,.1,.07,'gold');
  for(const x of [cx-.12,cx+.12])box(x,1.7,front-.12,.045,.48,.055,'gold');
  box(cx,5.65,front-.32,4.8,.25,.44,'stone');
  box(cx,6.8,front-.7,w,1.0,.13,'glass');for(let x=l+.15;x<r;x+=1.35)box(x,6.8,front-.58,.08,1.0,.1,'frame');box(cx,7.85,front-.7,w,.2,.35,'stone');
  // Micropia's contemporary dark exhibit box rises behind the lower hall, never replacing its pavilions.
  const bw=40.2,bz=-1.0;box(cx,7.8,bz,bw,3.55,13.2,'dark');box(cx,11.35,bz,bw+.2,.15,13.4,'slate');
  for(let x=cx-bw/2+.2;x<cx+bw/2;x+=.5)for(const z of [-7.64,5.64])box(x,7.9,z,.055,3.4,.09,'slate');
  // Garden-facing glazed conservatory and fine gold columns within the mapped parent footprint.
  const cw=40.5;box(cx,0,rear+5.0,cw,4.9,10.0,'glass');for(let x=cx-cw/2+.1;x<cx+cw/2;x+=2.6){box(x,.2,rear-.22,.15,5.0,.15,'gold');for(let yy=1.2;yy<4.8;yy+=1.1)box(x+1.25,yy,rear-.12,2.5,.08,.08,'gold');}
  box(cx,5.57,rear+4.7,cw,.17,10.1,'glass');box(cx,5.65,rear-.35,cw,.2,.22,'stone');for(let x=cx-cw/2;x<cx+cw/2;x+=1.3)box(x,5.77,rear+4.7,.07,.08,10.1,'gold');
 }else if(id==='artis-entrance'){
  const centres=rings.map(r=>{const xs=r.map(p=>p.x),zs=r.map(p=>p.y);return {x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs)};}).sort((a,b)=>a.x-b.x);
  for(let i=0;i<rings.length;i++){const r=rings[i],xs=r.map(p=>p.x),zs=r.map(p=>p.y),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);body(r,4.25,'white');roof(x,z,w+.25,d+.25,4.4,.45,'slate');for(const y of [.08,.65,3.95,4.15])box(x,y,z+d/2,w+.15,.13,.24,'stone');arch(x,.8,z+d/2+.08,w*.62,2.75,'dark');box(x,.75,z+d/2+.14,w*.66,.13,.18,'stone');}
  const l=centres[0],r=centres[1],z=(l.z+r.z)/2+1.6,pl=l.x+l.w/2+1.0,pr=r.x-r.w/2-1.0;
  // Open iron gate: slender bars and leaf panels leave the entrance axis permeable.
  for(const x of [pl,pr]){box(x,0,z,.65,4.55,.65,'dark');box(x,4.4,z,.95,.2,.95,'stone');
   add(new T.IcosahedronGeometry(.25,0),'gold',x,5.05,z);add(new T.ConeGeometry(.26,.55,6),'gold',x,4.8,z);
   const wing=new T.BufferGeometry();wing.setAttribute('position',new T.Float32BufferAttribute([x,5.2,z,x-.9,5.55,z,x-.6,4.85,z,x,5.2,z,x+.9,5.55,z,x+.6,4.85,z],3));wing.computeVertexNormals();add(wing,'gold');add(new T.IcosahedronGeometry(.12,0),'gold',x,5.37,z+.15);
   for(let y=.7;y<3.7;y+=.55)add(new T.IcosahedronGeometry(.12,0),'gold',x,y,z+.36);
  }
  const gate=(left:number,right:number)=>{for(let x=left;x<=right;x+=.24){box(x,0,z,.045,2.85,.045,'dark');add(new T.ConeGeometry(.075,.25,5),'gold',x,3.0,z);}for(const y of [.55,1.85,2.7])box((left+right)/2,y,z,right-left,.075,.075,'dark');};
  gate(pl,pl+2.2);gate(pr-2.2,pr);for(const side of [-1,1])gate(side<0?l.x-l.w/2-3.5:r.x+r.w/2,side<0?l.x-l.w/2:r.x+r.w/2+3.5);
 }else throw new Error(`No ARTIS entry builder for ${id}`);
}
