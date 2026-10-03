import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './artis-entry-specs.json';
import sources from './artis-entry-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** The restored Ledenlokalen and its separate historic zoo gate: no zoo-wide ground slab. */
export function buildArtisEntryLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=specs.find(s=>s.id===id)!,source=sources.find(s=>s.id===id)!,a=s.surveyed.anchor,h=209*Math.PI/180;
 const coord=([lng,lat]:number[])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));};
 const rings=source.parts.map(p=>(id==='micropia-ledenlokalen'?p.currentBagGeometry.coordinates[0]:p.polygons[0][0]).map(coord));
 const body=(r:T.Vector2[],height:number,c:C)=>{const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,c);};
 const clip=(r:T.Vector2[],value:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ai=more?a.x>=value:a.x<=value,qi=more?q.x>=value:q.x<=value;if(ai)out.push(a.clone());if(ai!==qi)out.push(a.clone().lerp(q,(value-a.x)/(q.x-a.x)));}return out;};
 const roof=(x:number,z:number,w:number,d:number,y:number,rise:number,c:C)=>{const turn=d>w;if(turn)[w,d]=[d,w];const v=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],ridge=Math.max(0,(w-d)/2),pos:number[]=[];const pt=(xx:number,yy:number,zz:number)=>[x+(turn?zz:xx),yy,z+(turn?xx:zz)];const tri=(a:number[],b:number[],c:number[])=>pos.push(...a,...b,...c);const p=v.map(([xx,zz])=>pt(xx,y,zz)),l=pt(-ridge,y+rise,0),r=pt(ridge,y+rise,0);tri(p[0],p[1],r);tri(p[0],r,l);tri(p[1],p[2],r);tri(p[2],p[3],l);tri(p[2],l,r);tri(p[3],p[0],l);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();add(g,c);};
 const sash=(x:number,y:number,z:number,w:number,hh:number)=>{box(x,y,z,w+.25,hh+.2,.2,'stone');box(x,y+.12,z+.12,w,hh,.08,'glass');box(x,y+.12,z+.19,.06,hh,.05,'gold');box(x,y+hh*.55,z+.19,w,.065,.05,'gold');box(x,y+hh+.19,z+.1,w+.55,.13,.3,'stone');};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh),c,x,y,z);};
 if(id==='micropia-ledenlokalen'){
  const ring=rings[0],xmin=Math.min(...ring.map(p=>p.x)),xmax=Math.max(...ring.map(p=>p.x)),front=Math.max(...ring.map(p=>p.y)),rear=Math.min(...ring.map(p=>p.y)),end=12.5;
  // Current BAG adds both end pavilions omitted by the stale 2014 OSM hall outline.
  // The rear projecting rectangle is a built glazed conservatory, verified in restoration photographs.
  body(ring,5.5,'brick');
  // Historic end pavilions retain three bays on their short ends and five along the street.
  for(const [lo,hi] of [[xmin,xmin+end],[xmax-end,xmax]]){
   const r=clip(clip(ring,lo,true),hi,false);body(r,11.8,'brick');const cx=(lo+hi)/2,rz=Math.min(...r.map(p=>p.y)),fz=Math.max(...r.map(p=>p.y)),cz=(fz+rz)/2,d=fz-rz;
   roof(cx,cz,end,d,12.1,2.35,'slate');
   for(const yy of [.3,1.0,6.0,6.3,11.5,11.85])box(cx,yy,front-.7,end+.15,.22,.4,'stone');
   for(const xx of [lo+.15,hi-.15]){box(xx,0,front-.65,.65,11.9,.55,'stone');for(let yy=1;yy<6;yy+=.6)box(xx,yy,front-.29,.76,.1,.1,'white');}
   for(let i=0;i<3;i++)for(const y of [1.4,6.8])sash(lo+1.8+i*(end-3.6)/2,y,front-.35,1.65,4.1);
   // Conservatory-facing pavilion windows, matching the visible restored garden facades.
   for(let i=0;i<3;i++)for(const y of [1.4,6.8]){const xx=lo+1.8+i*(end-3.6)/2;box(xx,y,rz-.09,1.9,4.3,.18,'stone');box(xx,y+.12,rz-.22,1.65,4.1,.08,'glass');box(xx,y+.12,rz-.28,.06,4.1,.05,'gold');box(xx,y+2.2,rz-.28,1.65,.06,.05,'gold');}
   for(const yy of [.3,1,6,6.3,11.5])box(cx,yy,rz-.08,end,.22,.2,'stone');
   for(const xx of [lo-.04,hi+.04])for(let z=rz+1.8;z<fz-1;z+=3.05)for(const yy of [1.4,6.8]){box(xx,yy,z,.14,4.0,1.65,'glass');box(xx,yy+4.03,z,.26,.13,2.05,'stone');box(xx,yy+2.2,z,.2,.07,1.65,'gold');}
   box(cx,12.15,front-.5,1.8,1.15,.5,'stone');box(cx,12.3,front-.18,1.3,.8,.08,'glass');
   for(const xx of [lo+.4,hi-.4])add(new T.ConeGeometry(.22,.65,6),'stone',xx,12.5,front-.9);
  }
  const l=xmin+end,r=xmax-end,cx=(l+r)/2,w=r-l;
  // Low restored street gallery, with pilasters, high glazing and a central entrance pediment.
  box(cx,0,front-.75,w,6.05,.35,'brick');box(cx,5.9,front-.65,w,.5,.4,'stone');box(cx,6.45,front-.7,w,.3,.4,'white');
  for(let x=l+2.2;x<r-1;x+=4.4){sash(x,1.0,front-.4,3.75,4.45);box(x+2.1,.45,front-.4,.32,5.4,.4,'stone');box(x+2.1,5.75,front-.23,.5,.35,.5,'stone');}
  box(cx,6.8,front-.7,w,1.0,.13,'glass');for(let x=l+.15;x<r;x+=1.35)box(x,6.8,front-.58,.08,1.0,.1,'frame');box(cx,7.85,front-.7,w,.2,.35,'stone');
  const ped=new T.BufferGeometry();ped.setAttribute('position',new T.Float32BufferAttribute([cx-2.8,6.3,front-.04,cx+2.8,6.3,front-.04,cx,7.4,front-.04],3));ped.computeVertexNormals();add(ped,'stone');sign('DE PLANTAGE',cx-2.12,5.88,front+.05,.095,'dark');
  // Micropia's contemporary dark exhibit box rises behind the lower hall, never replacing its pavilions.
  const bw=40.2,bz=-1.0;box(cx,7.8,bz,bw,3.55,13.2,'dark');box(cx,11.35,bz,bw+.2,.15,13.4,'slate');
  for(let x=cx-bw/2+.2;x<cx+bw/2;x+=.5)for(const z of [-7.64,5.64])box(x,7.9,z,.055,3.4,.09,'slate');
  // Garden-facing glazed conservatory and fine gold columns within the mapped parent footprint.
  const cw=40.5;box(cx,0,rear+5.0,cw,4.9,10.0,'glass');for(let x=cx-cw/2+.1;x<cx+cw/2;x+=2.6){box(x,.2,rear-.22,.15,5.0,.15,'gold');for(let yy=1.2;yy<4.8;yy+=1.1)box(x+1.25,yy,rear-.12,2.5,.08,.08,'gold');}
  box(cx,5.57,rear+4.7,cw,.17,10.1,'glass');box(cx,5.65,rear-.35,cw,.2,.22,'stone');for(let x=cx-cw/2;x<cx+cw/2;x+=1.3)box(x,5.77,rear+4.7,.07,.08,10.1,'gold');
  sign('MICROPIA',xmax-end+.7,1.1,front-.15,.09,'dark');
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
