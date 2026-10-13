import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './fire-station-hendrik-footprints.json';
import letters from './fire-station-hendrik-lettering.json';
import {getSink,poly,ringFrame,setSink,slab} from './nearbar-kit';
type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed native-plan station, current2025 renovated front. No imported meshes/textures. */
export function buildFireStationHendrik(_w:number,_d:number,b:BuildingTools){
 const currentRidge=[[-17.6579,15.4585,17.0372],[-14.4161,15.7335,14.5220],[-14.0201,15.7665,14.2150],[-1.6305,15.6955,-2.1700],[-1.0659,15.6905,-2.9174],[.8069,16.0235,-5.3929],[3.7426,15.8635,-19.9221]];
 const ring=source.nativeRing.slice(0,-1),shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 // Each measured roof polygon owns its upper face. Shells use the minimum eave,
 // with a vertical skirt to the measured plane, avoiding wall-coloured top caps.
 const planes:{ring:number[][];at:(x:number,z:number)=>number;sx:number;sz:number;index:number}[]=[];
 for(const part of source.surveyRoofParts){
  const ps=part.rings[0].map(p=>{const ridge=currentRidge.find(q=>Math.hypot(q[0]-p[0],q[2]-p[2])<.015);return ridge&&[117,120,121].includes(part.index)?[p[0],ridge[1]-1.42,p[2]]:p;}),rr=ps.map(p=>[p[0],p[2]]),sh=shape(rr),lo=Math.min(...ps.map(p=>p[1]));
  b.add(openTopPrism(sh,0,lo),'brick');
  const origin=ps.reduce((v,p)=>v.add(new T.Vector3(...p)),new T.Vector3()).multiplyScalar(1/ps.length);
  let xx=0,zz=0,xz=0,xy=0,zy=0;for(const p of ps){const x=p[0]-origin.x,z=p[2]-origin.z,y=p[1]-origin.y;xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,sx=(xy*zz-zy*xz)/det,sz=(zy*xx-xy*xz)/det,at=(x:number,z:number)=>origin.y+sx*(x-origin.x)+sz*(z-origin.z);
  planes.push({ring:rr,at,sx,sz,index:part.index});
  const g=upwardRoofPlane(sh);const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,ps.reduce((best,p)=>Math.hypot(p[0]-pos.getX(i),p[2]-pos.getZ(i))<Math.hypot(best[0]-pos.getX(i),best[2]-pos.getZ(i))?p:best,ps[0])[1]);g.computeVertexNormals();g.userData={role:'source-roof',sourceIndex:part.index};b.add(g,part.index===114?'stone':'slate');
  const skirt:number[]=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length];for(const v of [[p[0],lo,p[2]],[q[0],lo,q[2]],[q[0],q[1],q[2]],[p[0],lo,p[2]],[q[0],q[1],q[2]],[p[0],p[1],p[2]]])skirt.push(...v);}
  const walls=new T.BufferGeometry();walls.setAttribute('position',new T.Float32BufferAttribute(skirt,3));walls.computeVertexNormals();b.add(walls,'brick');
 }
 const front=[...source.frontage,[9.69,-15.95],[10.23,-18.71],[11.21,-18.49],[13.49,-31.07]],segments=front.slice(1).map((p,i)=>({a:front[i],p,len:Math.hypot(p[0]-front[i][0],p[1]-front[i][1])}));
 const length=segments.reduce((n,s)=>n+s.len,0);
 // The front is a surveyed curved chain, SW toward NE. Its right-hand normal faces Rozengracht.
 const frame=(s:number,inset=0)=>{s=Math.max(0,Math.min(length-.001,s));let run=0;for(const e of segments){if(run+e.len>=s){const t=(s-run)/e.len,ux=(e.p[0]-e.a[0])/e.len,uz=(e.p[1]-e.a[1])/e.len,nx=-uz,nz=ux;return {x:e.a[0]+t*(e.p[0]-e.a[0])+nx*inset,z:e.a[1]+t*(e.p[1]-e.a[1])+nz*inset,angle:Math.atan2(-uz,ux),nx,nz};}run+=e.len;}throw Error('front chain');};
 const box=(s:number,y:number,w:number,h:number,d:number,c:C,inset=.10)=>{const q=frame(s,inset);b.box(q.x,y,q.z,w,h,d,c,q.angle);};
 const win=(s:number,y:number,w:number,h:number,cols=3,inset=.16)=>{box(s,y-.08,w+.17,h+.16,.25,'white',inset-.075);   // frame box reaches 15 cm back into the wall (front plane unchanged)
  box(s,y,w,h,.08,'glass',inset+.08);for(let i=1;i<cols;i++){const q=frame(s,inset+.15),u=-w/2+i*w/cols; b.box(q.x+Math.cos(q.angle)*u,y,q.z-Math.sin(q.angle)*u,.07,h,.055,'white',q.angle);}box(s,y,w,.065,.08,'white',inset+.15);};

 // ---- Front facade rhythm (spec from recording_2025-07-03_08-35-58_00368 at heading 292, rays intersected with the
 // surveyed front chain; confirmed by the November 2025 opening photograph and the 2023 Amsterdam photo):
 //  s 0-4.35   brick end bay with the St Victor plaque;
 //  s 4.35-25.9 five IDENTICAL engine bays, 3.30 m doors (0-4.50 m) on 1.26 m brick piers (centres every 4.56 m), each
 //             with its own white lintel (4.50-4.78) and, centred over it, one 4-light cream window 3.40 x 1.85 (7.30 m);
 //             doors are red sectional doors with a two-row, four-column glazed band at 2.2-3.4 m;
 //  s 26.5-36.1 white-framed entrance block: upper storey a brick oriel projecting ~1 m from 4.5 m (white soffit) to
 //             a white top band (9.2-10.2) with three equal windows and the red flame on the spandrel; ground storey
 //             white pilasters around window A, window B on the surveyed 1 m nib and a full-height glazed door C;
 //  s 36.1-50.1 right wing, three storeys, see below; s 51.1-63.9 corner pavilion.
 const bayStep=4.56,bayW=3.30,doorH=4.50,doors=[0,1,2,3,4].map(k=>6.0+k*bayStep);
 for(const s of doors){
  box(s,0,bayW,doorH,.10,'red',.15);
  for(const y of [2.20,2.82]){box(s,y,bayW-.24,.54,.075,'glass',.23);}
  box(s,2.80,bayW-.2,.06,.075,'red',.29);
  for(const u of [-.5,0,.5].map(v=>v*(bayW-.24)/2)){const q=frame(s,.29);b.box(q.x+Math.cos(q.angle)*u,2.20,q.z-Math.sin(q.angle)*u,.065,1.16,.055,'red',q.angle);}
  box(s,doorH,bayW+.40,.28,.45,'white',.03);   // per-bay lintel reaches back into the faceted wall (front plane unchanged)
  win(s,7.30,3.40,1.85,4);
 }
 for(let s=0;s<length-.8;s+=1){box(s,s<49?9.85:11.30,1.04,.25,.38,'concrete',.18);box(s,0,1.03,.34,.16,'stone',.08);}
 // The clerestory occupies the actual vertical step between front and rear roof
 // surfaces121/122and117/119. Use shared surveyed ridge vertices, not a parallel
 // facade inset: that earlier draft floated southwest windows beyond the roof.
 const ridge=currentRidge.map(p=>[p[0],p[1]-1.42,p[2]]);
 for(let i=0;i<ridge.length-1;i++){const p=ridge[i],q=ridge[i+1],dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),count=Math.max(1,Math.round(l/2.1));
  for(let j=0;j<count;j++){const t=(j+.5)/count,x=p[0]+t*dx+nx*.13,z=p[2]+t*dz+nz*.13,y=p[1]+t*(q[1]-p[1])+.08,w=l/count;
   b.box(x,y,z,w+.015,1.20,.18,'white',angle);b.box(x+nx*.11,y+.10,z+nz*.11,w-.13,.96,.08,'glass',angle);b.box(x+nx*.16,y+.10,z+nz*.16,.065,.96,.05,'white',angle);b.box(x,y+1.20,z,w+.025,.28,.23,'white',angle);
  }
 }

 // ---- Entrance block oriel. Planar chord frame from s 26.5 to 36.1 so the projecting box is one straight volume.
 {
  const s0=26.5,s1=36.1,p0=frame(s0),p1=frame(s1),tx0=p1.x-p0.x,tz0=p1.z-p0.z,L=Math.hypot(tx0,tz0),tx=tx0/L,tz=tz0/L,nx=-tz,nz=tx,ang=Math.atan2(-tz,tx);
  let base=0;for(let s=s0;s<=s1;s+=.1){const q=frame(s);base=Math.max(base,(q.x-p0.x)*nx+(q.z-p0.z)*nz);}
  // base includes the surveyed 1 m ground nib (s 29.64-32.30), whose 3DBAG wall rises full height: the oriel front
  // stands 0.12 m proud of it, flush-looking as on the photo.
  const F=base+.12,back=-.35,mid=(F+back)/2,dep=F-back;
  const at=(t:number,out:number)=>[p0.x+tx*t+nx*out,p0.z+tz*t+nz*out];
  const put=(t:number,out:number,y:number,w:number,h:number,d:number,c:C)=>{const [x,z]=at(t,out);b.box(x,y,z,w,h,d,c,ang);};
  put(L/2,mid,4.50,L+.10,.32,dep+.06,'white');            // soffit
  put(L/2,mid,4.82,L,4.38,dep,'brick');                    // oriel body 4.82-9.20
  put(L/2,mid+.02,9.20,L+.10,1.00,dep+.08,'white');        // top band 9.20-10.20
  for(const k of [0,1,2]){const t=L*(2*k+1)/6;put(t,F-.02,6.97,2.62,2.15,.12,'white');put(t,F+.04,7.05,2.46,2.0,.08,'glass');put(t,F+.095,7.05,.07,2.0,.05,'white');put(t,F+.10,8.45,2.46,.07,.03,'white');}   // fronts F+.04 / +.08 / +.12: no coplanar layers
  const side=Math.atan2(-tx,-tz);   // side faces: local x along the outward normal
  for(const [t,sg] of [[-.02,-1],[L+.02,1]] as const){const [x,z]=at(t,F-.55);b.box(x,6.97,z,.62,2.15,.10,'white',side);b.box(x+tx*sg*.06,7.05,z+tz*sg*.06,.48,2.0,.06,'glass',side);}
  // red flame relief centred under the middle window
  const fp=new T.Shape();fp.moveTo(-.32,0);fp.bezierCurveTo(-.94,.55,-.75,1.25,-.25,1.78);fp.bezierCurveTo(-.23,1.05,.37,1.06,.28,2.04);fp.bezierCurveTo(1.11,1.39,.98,.48,.28,.04);fp.lineTo(0,-.26);fp.closePath();
  const fg=new T.ExtrudeGeometry(fp,{depth:.05,bevelEnabled:false,curveSegments:5});fg.scale(.85,.85,1);fg.rotateY(ang);const [fx,fz]=at(L/2,F);fg.translate(fx,5.10,fz);b.add(fg,'red');
 }
 // Ground storey of the entrance block: white pilasters, window A on the main wall, window B on the 1 m surveyed nib
 // (chain s 29.64-32.30), full-height glazed door C. Glass tops meet the soffit at 4.5 m.
 for(const [s,w] of [[26.68,.36],[28.52,.30],[29.80,.30],[32.12,.34],[33.55,.30],[35.80,.60]] as const)box(s,0,w,4.50,.30,'white',.10);
 for(const [s,w] of [[27.60,1.50],[30.96,1.98]] as const){box(s,0,w,2.65,.12,'brick',.12);box(s,2.65,w,1.85,.08,'glass',.12);box(s,3.85,w,.06,.06,'white',.17);}
 box(34.53,0,1.66,4.50,.08,'glass',.21);box(34.53,0,.06,4.50,.06,'white',.27);box(34.53,2.50,1.66,.06,.05,'white',.265);   // glass front clears the stone plinth (front .16)
 // ---- Right wing (s 36.1-50.1), from recording 00368 heading 340 and recording 00364 heading 305:
 //  section A (36.1-40.6): one 4-light window 3.5 m wide at ground (1.25-2.90) and first floor (4.30-5.95), with two
 //   single-light tall windows above its ends on the second floor (7.45-9.05);
 //  section B (40.6-50.1): eight small square lights on a regular 1.086 m grid across the second floor (8.45-9.05);
 //   below the first four, one 4-light window 3.7 m wide at ground and first floor; below the last four, one small
 //   square light each at ground (2.20) and first floor (5.35). Every opening sits on that grid.
 const wingRows=[1.25,4.30];
 for(const y of wingRows){win(38.13,y,3.50,1.65,4);win(42.94,y,3.70,1.65,4);}
 for(const s of [36.95,39.31])win(s,7.45,.65,1.60,1);
 const grid=[0,1,2,3,4,5,6,7].map(k=>41.30+k*1.086);
 for(const s of grid)win(s,8.45,.45,.60,1);
 for(const s of grid.slice(4))for(const y of [2.20,5.35])win(s,y,.45,.55,1);
 // ---- Corner pavilion (s 51.1-63.9, recording 00364): ground white shopfront of six equal units; above, small
 // stair lights at 52.6/54.6 (and 57.05 on the first floor) with one larger 2-light window per floor, offset.
 for(let k=0;k<=6;k++)box(51.25+k*(12.5/6),0,.24,4.15,.26,'white',.10);
 for(let k=0;k<6;k++){const s=51.25+(k+.5)*(12.5/6);box(s,.35,12.5/6-.24,3.55,.08,'glass',.10);}
 box(57.5,4.05,12.66,.32,.30,'white',.10);
 for(const s of [52.6,54.6])win(s,9.65,.45,.52,1);
 win(57.85,8.65,1.70,1.60,2);
 for(const s of [52.6,54.6,57.05])win(s,7.05,.45,.55,1);
 win(60.8,6.0,1.60,1.75,2);

 // Main real fascia sign: source opening photograph red bold sans lettering,
 // not proposed gold rendering. Outlines approximate Arial Narrow Bold, native curves.
 const lettering=(data:typeof letters[number],s:number,y:number,w:number,h:number,c:C)=>{const p=new T.ShapePath();for(const cmd of data.commands as any[]){if(cmd.type==='M')p.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')p.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')p.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')p.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')p.currentPath?.closePath();}const g=new T.ExtrudeGeometry(p.toShapes(),{depth:.026,bevelEnabled:false,curveSegments:3});g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.max.x+bb.min.x)/2,-bb.min.y,0);g.scale(w/size.x,h/size.y,1);const q=frame(s,.075);g.rotateY(q.angle);g.translate(q.x,y,q.z);g.userData={role:'source-sign',text:data.text,fontApproximation:data.fontApproximation};b.add(g,c);};
 lettering(letters[0],17.4,5.42,7.10,1.05,'red');lettering(letters[1],17.4,4.92,5.80,.34,'white');   // over the pier between doors 3 and 4 (opening photo)
 // St.Victor commemorative plaque at southwest end; abstract native relief,
 // no invented lettering or copied pixels. Actual1685 stone retained in current station.
 box(2.2,2.80,1.15,2.7,.10,'stone',.16);box(2.2,3.85,.57,1.08,.05,'red',.24);box(2.2,4.17,.19,.56,.065,'white',.28);
 // Solar arrays lie on whichever surveyed roof plane is under each array (the old single-plane fit left two
 // arrays hovering 0.45 m and 1.30 m above the slope: the audit's two detached parts).
 const inRing=(x:number,z:number,r:number[][])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
 for(const s of [17.5,23.0,28.5,34.0]){const q=frame(s,-2.5),pl=planes.filter(p=>inRing(q.x,q.z,p.ring)).sort((p,r)=>r.at(q.x,q.z)-p.at(q.x,q.z))[0];if(!pl)continue;
  const n=new T.Vector3(-pl.sx,1,-pl.sz).normalize(),g=new T.BoxGeometry(4.2,.08,2.2);g.rotateY(q.angle);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n));g.translate(q.x,pl.at(q.x,q.z)+.08,q.z);b.add(g,'blue');}
 // Current opening photo shows southwest end mostly blank, with only two
 // paired small lights and one low narrow grille. No generic party-wall wrap.
 const a=ring.reduce((best,p)=>Math.abs(p[0]+23.5)+Math.abs(p[1]-10.7)<Math.abs(best[0]+23.5)+Math.abs(best[1]-10.7)?p:best,ring[0]);
 const end=[[-23.5,10.8],[-12.8,22.1]],dx=end[1][0]-end[0][0],dz=end[1][1]-end[0][1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l,angle=Math.atan2(-dz,dx);
 for(const y of [2.4,7.0])for(const t of [.73,.79]){const x=end[0][0]+t*dx+nx*.14,z=end[0][1]+t*dz+nz*.14;b.box(x,y,z,.50,.65,.08,'white',angle);b.box(x+nx*.08,y+.07,z+nz*.08,.37,.51,.07,'glass',angle);}

 // ---- Rear block (Marnixstraat/Singelgracht side). Until 2026-10-10 the north and west walls were blank brick.
 // Spec from panoramas TMX7316010203-002619_pano_0032_000004 (north wall, 9 m, 2022-06-22),
 // TMX7316010203-001967_pano_0000_001086 (north + west from across the Singelgracht, 2021-01-18) and
 // TMX7316010203-001967_pano_0000_001083 (west wall square-on, 2021-01-18):
 //  north wall (24 m, faces ~10 deg): a white concrete frame over the ground storey - seven equal bays between white
 //   pilasters under a beam at ~4.4 m, each bay brick below a band of white-framed lights (~3.3-4.35 m); above it brick,
 //   with a ribbon of seven windows, one per bay, climbing from the east end to the west end under a white raking band.
 //  west wall (12.6 m, faces ~281 deg): blank brick under a white coping; the same concrete frame over the ground storey
 //   with six window units.
 {
  const sink0=getSink();setSink(0.12);
  const inside=(x:number,z:number,r:number[][])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
  /** Wall-top (roof plane) height 0.3 m inside the wall at frame position t. */
  const top=(f:{origin:number[];tangent:number[];n:number[]},t:number)=>{const x=f.origin[0]+f.tangent[0]*t-f.n[0]*.3,z=f.origin[1]+f.tangent[1]*t-f.n[1]*.3;let best=0;for(const p of planes)if(inside(x,z,p.ring))best=Math.max(best,p.at(x,z));return best;};
  const lights=(f:any,t:number,y:number,w:number,h:number,cols:number)=>{slab(b,f,t,y-.06,w+.14,h+.12,.09,'white',-.03);slab(b,f,t,y,w,h,.09,'glass');for(let i=1;i<cols;i++)slab(b,f,t-w/2+w*i/cols,y,.06,h,.12,'white');};
  const frameStorey=(f:any,len:number,bays:number,cols:number,e=.18)=>{
   slab(b,f,len/2,4.4,len,.38,.16,'white');                                   // concrete beam
   for(let k=0;k<=bays;k++)slab(b,f,Math.min(len-e,Math.max(e,len*k/bays)),0,.36,4.4,.16,'white');   // pilasters
   for(let k=0;k<bays;k++)lights(f,len*(k+.5)/bays,3.3,len/bays-.62,1.02,cols);
  };
  // north wall: edges 3 and 4 are collinear within 1 degree; treat as one 24 m run from the NE corner
  const ring2=ring.map(p=>[p[0],p[1]]);
  const e3=ringFrame(ring2,3),e4=ringFrame(ring2,4);
  // The ribbon does not follow the eave: it climbs from ~7.2 m at the east end to ~10.6 m at the west end (panorama 001086),
  // under a white raking band. u runs east -> west (edge 3 then edge 4; frame t is the viewer's right = west).
  const run=e3.len+e4.len,ribbon=(u:number)=>7.2+3.4*u/run;
  for(const [e,bays,u0] of [[e3,1,0],[e4,6,e3.len]] as const){
   frameStorey(e.f,e.len,bays,bays===1?3:4,.22);
   for(let k=0;k<bays;k++){const t=e.len*(k+.5)/bays,y=ribbon(u0+t);if(y+1.6<top(e.f,t))lights(e.f,t,y,Math.min(2.3,e.len/bays-.9),1.15,3);}
   {const y0=Math.min(ribbon(u0)+1.4,top(e.f,.3)-.5),y1=Math.min(ribbon(u0+e.len)+1.4,top(e.f,e.len-.3)-.5),L=e.len/2;poly(b,e.f,L,0,[[-L,y0],[L,y1],[L,y1+.16],[-L,y0+.16]],.17,'white');}
  }
  const w6=ringFrame(ring2,6);
  frameStorey(w6.f,w6.len,6,2);
  for(let t=.5;t<w6.len;t+=1){const y=top(w6.f,t);if(y>5)slab(b,w6.f,t,y-.35,1.02,.35,.12,'white');}
  setSink(sink0);
 }
}
