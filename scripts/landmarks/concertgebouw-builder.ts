import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import spec from './concertgebouw-spec.json';
import source from './concertgebouw-footprints.json';
/** Original classical facade and glass promenade against surveyed roof planes. */
export function buildConcertgebouw(_w:number,_d:number,b:BuildingTools):void{
 type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
 const [lng,lat]=spec.surveyed.anchor,h=337.3*Math.PI/180;
 const local=([x,y]:number[]):P=>{const e=(x-lng)*111320*Math.cos(lat*Math.PI/180),n=(y-lat)*110540;return[e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h)]};
 const rings=source.geometry.coordinates.map(r=>r.map(local));
 // Clip the historical body at the actual glass promenade: no opaque box
 // behind the added glazing. The two real small interior courts remain holes.
 function clip(r:P[],axis:0|1,value:number,positive:boolean):P[]{const out:P[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],inside=(p:P)=>positive?p[axis]>=value:p[axis]<=value,aa=inside(a),qq=inside(q);if(aa)out.push(a);if(aa!==qq){const t=(value-a[axis])/(q[axis]-a[axis]);out.push([a[0]+t*(q[0]-a[0]),a[1]+t*(q[1]-a[1])])}}return out}
 function layer(rs:P[][],base:number,top:number,c:C){const shape=new T.Shape(rs[0].map(p=>new T.Vector2(...p)));for(const r of rs.slice(1))if(r.length>=3)shape.holes.push(new T.Path(r.map(p=>new T.Vector2(...p))));const g=new T.ExtrudeGeometry(shape,{depth:top-base,bevelEnabled:false});g.rotateX(Math.PI/2);b.add(g,c,0,top,0)}
 const core=rings.map(r=>clip(clip(r.slice(0,-1),0,-10.3,true),1,36.2,false));layer(rings.map(r=>r.slice(0,-1)),0,.45,'stone');layer(core,.45,6.2,'stone');layer(core,6.2,13.4,'brick');
 // Main hall is separate from the oval Small Hall at the rear; neither
 // volume crosses the surveyed courts around z=-18m.
 b.box(8.1,13.4,10.3,31.0,5.4,45.0,'brick');
 b.box(6.2,13.4,-28.9,20.2,7.5,15.2,'brick');
 for(const z of[-12.2,32.8]){const g=new T.ExtrudeGeometry(new T.Shape([new T.Vector2(-15.5,0),new T.Vector2(15.5,0),new T.Vector2(0,6.75)]),{depth:.16,bevelEnabled:false});b.add(g,'brick',8.1,18.8,z)}
 // Roof surfaces use measured planar contours rebuilt here as original
 // triangle fans/triangulations, not a downloaded render mesh.
 // AHN resolves the four thin iron crowns as horizontal contours at 21.6m.
 // The official photograph shows open cresting here, not a solid roof slab.
 const crownPlane=(p:number[][])=>p.every(q=>q[1]>21.5&&q[1]<21.7)&&p.every(q=>q[0]<-10||q[0]>26);
 for(const p of source.roofPlanes){
  if(crownPlane(p))continue;
  const clean=p.filter((q,i)=>!i||Math.hypot(q[0]-p[i-1][0],q[2]-p[i-1][2])>.005);if(clean.length<3)continue;
  const g=new T.ShapeGeometry(new T.Shape(clean.map(q=>new T.Vector2(q[0],q[2])))),pos=g.getAttribute('position');
  // Earcut retains the contour vertices. Preserve their measured heights,
  // avoiding an unstable plane fit across centimetric sliver faces.
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i),q=clean.reduce((best,q)=>Math.hypot(q[0]-x,q[2]-z)<Math.hypot(best[0]-x,best[2]-z)?q:best);pos.setXYZ(i,x,q[1],z)}
  if(g.index)for(let i=0;i<g.index.count;i+=3){const v=g.index.getX(i+1);g.index.setX(i+1,g.index.getX(i+2));g.index.setX(i+2,v)}g.computeVertexNormals();
  const x=clean.reduce((s,q)=>s+q[0]/clean.length,0),z=clean.reduce((s,q)=>s+q[2]/clean.length,0);b.add(g,x<-10&&z>-27&&z<29?'glass':'slate');
 }
 // Four pavilions follow the surveyed crown centers. Their slate mansards
 // support the roof silhouette, while fine iron cresting remains genuinely open.
 const towers=[[-12.55,33.906],[-12.781,-12.316],[29.026,32.545],[28.395,-13.061]];
 for(const [x,z] of towers){
  b.box(x,0,z,8.5,14.8,8.5,'brick');
  for(const side of[-1,1]){for(const zz of[z-4.25,z+4.25])for(let y=.7;y<14.8;y+=.85)b.box(x+side*4.1,y,zz,.55,.44,.25,'stone');b.box(x,6.15,z+side*4.3,8.8,.42,.4,'stone');b.box(x,14.8,z+side*4.3,9.0,.45,.45,'stone');}
  // Tapered mansard shell, with its visible roof supported at the cornice.
  const lower=4.25,upper=2.2,verts:number[]=[];
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let i=0;i<4;i++){const [ax,az]=corners[i],[bx,bz]=corners[(i+1)%4];const A=[x+ax*lower,15.25,z+az*lower],B=[x+bx*lower,15.25,z+bz*lower],C=[x+bx*upper,19.8,z+bz*upper],D=[x+ax*upper,19.8,z+az*upper];verts.push(...A,...C,...B,...A,...D,...C)}
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(verts,3));roof.computeVertexNormals();b.add(roof,'slate');b.box(x,19.76,z,4.4,.04,4.4,'slate');
  // Pale arched dormers project through the slate, rather than hide behind it.
  for(const side of[-1,1]){b.box(x,15.25,z+side*3.55,2.35,3.25,1.1,'stone');b.box(x,15.7,z+side*4.13,1.6,2.1,.08,'dark');for(let y=15.7;y<17.8;y+=.22)b.box(x,y,z+side*4.2,1.7,.075,.12,'frame');const g=new T.ExtrudeGeometry(new T.Shape([new T.Vector2(-1.35,0),new T.Vector2(1.35,0),new T.Vector2(0,1.0)]),{depth:.2,bevelEnabled:false});b.add(g,'stone',x,18.5,z+side*4.03);}
  // Rails and spindles leave sky visible through the surveyed 21.6m crown.
  for(const side of[-1,1]){for(const y of[20.0,20.8]){b.box(x,y,z+side*2.2,4.4,.085,.085,'frame');b.box(x+side*2.2,y,z,.085,.085,4.4,'frame');}for(let t=-2.2;t<=2.21;t+=.55){b.box(x+t,19.8,z+side*2.2,.07,1.15,.07,'frame');b.box(x+side*2.2,19.8,z+t,.07,1.15,.07,'frame');}}
  for(const xx of[-2.2,2.2])for(const zz of[-2.2,2.2]){b.box(x+xx,19.8,z+zz,.1,1.8,.1,'frame');b.add(new T.ConeGeometry(.15,.35,5),'frame',x+xx,21.45,z+zz);}
 }
 // Facade bands and windows follow each actual outer wall, omitting the
 // west promenade where the transparent structural frame replaces masonry.
 const outer=core[0],area=outer.reduce((s,p,i)=>s+p[0]*outer[(i+1)%outer.length][1]-outer[(i+1)%outer.length][0]*p[1],0);
 for(let i=0;i<outer.length;i++){const a=outer[i],q=outer[(i+1)%outer.length],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);if(length<2||Math.abs(a[0]+10.3)<.05&&Math.abs(q[0]+10.3)<.05)continue;const nx=(area>0?dz:-dz)/length,nz=(area>0?-dx:dx)/length,angle=-Math.atan2(dz,dx);for(const y of[.8,5.7,6.15,13.25])b.box((a[0]+q[0])/2+nx*.12,y,(a[1]+q[1])/2+nz*.12,length+.12,.22,.32,'stone',angle);const count=Math.floor(length/4.6);for(let j=0;j<count;j++){const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;for(const y of[1.2,8.0]){b.box(x+nx*.1,y,z+nz*.1,1.8,y>7?4.1:3.6,.16,'stone',angle);b.box(x+nx*.2,y+.16,z+nz*.2,1.45,y>7?3.74:3.24,.1,'glass',angle);}}}
 // Northeast portico. Tall columns are above the ground entrance canopy;
 // the embossed pediment sits below the much taller nave roof behind it.
 const cx=6.0,front=40.05,width=17.2;
 b.box(cx,0,front-2,width,6.0,4.0,'stone');b.box(cx,6.0,front-3.2,width,10.2,1.4,'stone');
 for(const x of[cx-8,cx-5.8,cx-1.95,cx+1.95,cx+5.8,cx+8]){
  const g=new T.CylinderGeometry(.36,.43,9.7,10);b.add(g,'stone',x,11.25,front+.18);b.box(x,6.0,front+.18,1.0,.4,1.0,'stone');b.box(x,15.9,front+.18,1.05,.45,1.05,'stone');
 }
 // Three central tall bays and the two outer bays sit on the recessed
 // loggia wall. Columns stay proud of it, rather than inside a footprint prism.
 for(const dx of[-7,-3.9,0,3.9,7]){const x=cx+dx;
  b.box(x,6.6,37.68,1.7,6.55,.13,'glass');b.box(x,6.65,37.82,.12,6.5,.1,'stone');b.box(x,9.6,37.82,1.7,.12,.1,'stone');
  b.box(x,13.65,37.68,1.75,1.65,.13,'glass');b.box(x,13.65,37.82,.12,1.65,.10,'stone');
 }
 b.box(cx,16.35,front,width+1.1,1.0,1.6,'stone');b.sign('CONCERTGEBOUW',cx,16.6,front+.86,.15,'dark');
 const ped=new T.Shape([new T.Vector2(-9.3,0),new T.Vector2(9.3,0),new T.Vector2(0,4.9)]),pg=new T.ExtrudeGeometry(ped,{depth:.55,bevelEnabled:false});b.add(pg,'stone',cx,17.4,front-.05);
 // Small faceted figures suggest the relief rather than a texture decal.
 for(let i=-3;i<=3;i++){const x=cx+i*1.85,y=18.0+(.9-Math.abs(i)*.13);b.box(x,y,front+.56,.48,.72,.12,'white');b.add(new T.IcosahedronGeometry(.22,0),'stone',x,y+.95,front+.63)}
 b.box(cx,5.55,front+1.0,19.2,.25,3.6,'frame');// Three round-arched entrance doors (photo: arches at about -4, 0, +4 m under the canopy).
 const archGeo=(w:number,h:number)=>{const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();return new T.ShapeGeometry(sh,8);};
 for(const dx of[-4,0,4]){const x=cx+dx;b.add(archGeo(3.2,4.5),'stone',x,.7,front+.02);b.add(archGeo(2.5,3.8),'dark',x,.7,front+.04);b.add(archGeo(2.2,3.5),'glass',x,.7,front+.06);b.box(x,.7,front+.09,.08,2.2,.06,'frame');b.box(x,2.2,front+.09,2.2,.07,.06,'frame');}
 // Golden open lyre, readable as an outline above the central hall gable.
 const lx=8.1,lz=32.1,ly=25.65;b.box(lx,ly,lz,1.55,.22,.32,'gold');
 for(const side of[-1,1]){b.box(lx+side*.8,ly+.18,lz,.16,1.4,.18,'gold');b.box(lx+side*1.0,ly+1.48,lz,.5,.16,.18,'gold');b.add(new T.TorusGeometry(.28,.075,5,10,Math.PI*1.6),'gold',lx+side*.93,ly+1.62,lz);}
 for(const x of[-.4,0,.4])b.box(lx+x,ly+.28,lz,.055,1.4,.07,'gold');b.box(lx,ly+1.62,lz,1.65,.13,.18,'gold');
 // Pi de Bruijn's added promenade remains glass with slender columns,
 // including the lower hospitality level; no backing opaque prism.
 for(let z=-27;z<=28;z+=3.9){b.box(-20.3,.55,z,.12,12.5,.12,'frame');b.box(-10.3,.55,z,.14,12.5,.14,'white');}
 for(const x of[-20.3,-10.3]){b.box(x,.55,.5,.09,12.8,55,'glass');for(const y of[.55,6.2,13.0])b.box(x,y,.5,.22,.2,55,'frame');}
}
