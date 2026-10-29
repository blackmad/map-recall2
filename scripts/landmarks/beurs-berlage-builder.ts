import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './beurs-berlage-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Berlage exchange, built from forty current mapped roof/tower parts. */
export function buildBeursBerlage(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 // Explicit roof panels own the top surface. Retain extrusion walls/bottoms,
 // omitting upward caps that otherwise flicker against the gray flat roofs.
 function body(polys:number[][][][],base:number,h:number,cover?:(x:number,z:number)=>number){for(const p of polys){const g=new T.ExtrudeGeometry(shape(p),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<positions.count;i+=3){if(normals.getY(i)>.9&&normals.getY(i+1)>.9&&normals.getY(i+2)>.9)continue;const tri=[0,1,2].map(j=>[positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j)]);
   // A wall face standing against a mapped part is hidden up to that part's eaves: drop it, or keep only the part above.
   if(cover&&Math.abs(normals.getY(i))<.1){const nx=normals.getX(i),nz=normals.getZ(i),c=cover((tri[0][0]+tri[1][0]+tri[2][0])/3+nx*.05,(tri[0][2]+tri[1][2]+tri[2][2])/3+nz*.05);if(c>=base+h)continue;if(c>base)for(const q of tri)q[1]=Math.max(q[1],c);}
   for(const q of tri)v.push(q[0],q[1],q[2]);}g.dispose();mesh(v,'brick');}}
 // `back` extends the arch behind its face into what it is set on (the wall,
 // or the stone ring of an opening), so no arch hangs off its wall (audit
 // "detached ... hovering", feedback 58f97b44). The face stays where it was.
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour,back=0){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.08+back,bevelEnabled:false,curveSegments:5});g.translate(0,0,-back);add(g,c,x,y,z,a);}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1];box((p[0]+q[0])/2,y,(p[1]+q[1])/2,Math.hypot(q[0]-p[0],q[1]-p[1]),h,d,c,-Math.atan2(q[1]-p[1],q[0]-p[0]));}}
 // The 14 m residual is a thin strip in front of taller mapped parts on the water side: its back faces stand in the
 // parts' own walls (hidden, and read by the audit as a second wall facing inward behind the windows), so they go.
 body(source.residualParentPolygons,0,14,partEaves);
 for(const p of source.residualParentPolygons){const g=new T.ShapeGeometry(shape(p));g.rotateX(Math.PI/2);add(g,'frame',0,14,0);}
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),rise=Number(tags['roof:height']||0),eaves=top-rise,glass=tags['roof:material']==='glass';
  if(!glass)body(part.localPolygons,base,eaves-base);
  const roofHeight=(x:number,z:number)=>{
   if(tags['roof:shape']==='gabled'){const r=part.ridge;return eaves+rise*Math.max(0,1-Math.abs(x*r.normal[0]+z*r.normal[1]-r.mid)/r.halfSpan);}
   if(tags['roof:shape']==='skillion'){const r=(part as typeof part & {skillion:{downhill:number[];min:number;max:number}}).skillion;return eaves+rise*(1-(x*r.downhill[0]+z*r.downhill[1]-r.min)/(r.max-r.min));}
   return top;
  };
  if(tags['roof:shape']==='pyramidal'){
   const [x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
   for(const p of part.localPolygons){const v:number[]=[];for(let i=0;i<p[0].length-1;i++)v.push(p[0][i][0],eaves,p[0][i][1],p[0][i+1][0],eaves,p[0][i+1][1],cx,top,cz);mesh(v,tags['roof:material']==='metal'?'frame':'red');}
  }else{
   for(const p of part.roofPolygons){const g=new T.ShapeGeometry(shape(p)),v=g.getAttribute('position');for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getY(i);v.setXYZ(i,x,roofHeight(x,z),z);}g.computeVertexNormals();add(g,glass?'glass':tags['roof:material']==='roof_tiles'?'red':'frame');}
  }
  // Every sloping roof receives its exact end-wall infill, split at the ridge.
  if(rise&&!glass&&tags['roof:shape']!=='pyramidal'){
   const v:number[]=[];for(const p of part.localPolygons)for(const ring of p)for(let i=0;i<ring.length-1;i++){
    const a=ring[i],q=ring[i+1],segments=[a];if(tags['roof:shape']==='gabled'){const r=part.ridge,d0=a[0]*r.normal[0]+a[1]*r.normal[1]-r.mid,d1=q[0]*r.normal[0]+q[1]*r.normal[1]-r.mid;if(d0*d1<0){const t=d0/(d0-d1);segments.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}}segments.push(q);
    for(let j=0;j<segments.length-1;j++){const p=segments[j],r=segments[j+1],h0=roofHeight(...p as [number,number]),h1=roofHeight(...r as [number,number]);if(h1>eaves+.001)v.push(p[0],eaves,p[1],r[0],eaves,r[1],r[0],h1,r[1]);if(h0>eaves+.001)v.push(p[0],eaves,p[1],r[0],h1,r[1],p[0],h0,p[1]);}
   }mesh(v,'brick');
  }
  if(base>=15)for(const p of part.localPolygons)band(p[0],eaves-.2,.25,.35,'stone');
 }

 /**
  * Berlage's bay rhythm (Damrak panoramas recording_2025-07-03_03-29-47_02525-02550, 2025-07-03): bays of about
  * 7.2 m between brick pilaster strips, two low basement lights in stone surrounds, four storeys of paired
  * windows under stone lintels on stone sills, and a shallow segmental crest with a small light over every bay.
  * The north half of the Damrak front has a ground-floor arcade of round-arched windows; the two Damrak
  * entrances are deep round arches: one under the central tower, one per bay under the south tower.
  */
 function facadeBays(edge:number,p:number[],q:number[],a:number,h:number){
  const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz),nx=Math.sin(a),nz=Math.cos(a),ux=dx/len,uz=dz/len;
  // Trim reaches from 3-7 cm behind the parent ring to 15-25 cm in front of it: the mapped parts' walls stand up to 10 cm
  // proud of the ring in places, so nothing hovers where the wall is on the ring and nothing is buried where it is not.
  const at=(t:number,off:number):[number,number]=>[p[0]+ux*t+nx*off,p[1]+uz*t+nz*off];
  const top=Math.min(h,18),bearing=(Math.atan2(nx,-nz)*180/Math.PI+360)%360,damrak=Math.abs(bearing-307)<8;
  const mz=(p[1]+q[1])/2,arcade=damrak&&mz>-47&&mz<-14,centralEntrance=damrak&&edge===110,southEntrance=damrak&&edge===162;
  const nb=Math.max(1,Math.round(len/7.2)),bw=len/nb;
  // pilaster strips at the bay joints and the ends, rising 0.5 m past the eaves
  for(let k=0;k<=nb;k++){const t=Math.min(Math.max(k*bw,.25),len-.25),[x,z]=at(t,.07),local=wallTop(x-nx*.4,z-nz*.4);if(local<4)continue;box(x+nx*.13,0,z+nz*.13,.5,Math.min(local,top)+.5,.34,'brick',a);} // to 30 cm proud: past the bands (15) and lintels (25)
  for(let k=0;k<nb;k++){
   const c=(k+.5)*bw,[cx,cz]=at(c,0),local=Math.min(top,wallTop(cx-nx*.4,cz-nz*.4));if(local<4)continue;
   const ww=1.75,single=bw<4.5,gap=Math.min(1.5,bw/2-1.35); // one size per row on every bay (photo-spec rhythm)
   const entrance=(centralEntrance&&Math.abs(c-len/2)<bw*.6)||(southEntrance);
   for(const s of single?[0]:[-1,1]){
    const t=c+s*gap,[x,z]=at(t,0);
    if(!entrance)basement(x,z,a);
    const rows:[number,number][]=[[2.2,2.5],[6.0,2.3],[9.3,2.2],[12.4,1.6]];
    rows.forEach(([y,hh],r)=>{if(y+hh+.4>local)return;if(r===0&&(arcade||entrance))return;bayWindow(x,y,z,a,ww,hh);});
    // arcade lights share the ground row's sill and head lines within 0.35 m (one row in the photo)
    if(arcade&&!entrance){const [ax,az]=at(t,.0);arch(ax+nx*.1,1.82,az+nz*.1,2.45,3.25,a,'stone',.25);arch(ax+nx*.24,1.9,az+nz*.24,2.15,3.1,a,'glass',.06);}
   }
   if(entrance){ // deep porches, shaded slate: not windows
    const arches=southEntrance?[[c,3.6,4.8]]:[[c,4.4,5.6]];
    for(const [t,w2,h2] of arches){const [x,z]=at(t,0);arch(x+nx*.1,0,z+nz*.1,w2+.7,h2+.35,a,'stone',.25);arch(x+nx*.24,0,z+nz*.24,w2,h2,a,'slate',.06);} // deep porch, shaded: not a window
    const [sx,sz]=at(c,.9);if(!southEntrance)box(sx,0,sz,4.6,.45,1.6,'stone',a); // entrance steps
   }
   if(local>=13.5&&local<=18.5){ // segmental crest over the bay
    const cw=Math.min(3.4,bw*.5),shape=new T.Shape();shape.moveTo(-cw/2,0);shape.lineTo(cw/2,0);shape.lineTo(cw/2,.45);shape.absellipse(0,.45,cw/2,1.05,0,Math.PI,false);shape.lineTo(-cw/2,0);
    const g=new T.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:false,curveSegments:8});g.translate(0,0,-.35);add(g,'brick',cx,local-.05,cz,a);
    box(cx+nx*.16,local+.55,cz+nz*.16,.5,.6,.08,'slate',a);box(cx+nx*.12,local+.47,cz+nz*.12,.7,.08,.16,'stone',a);
   }
  }
 }
 function basement(x:number,z:number,a:number){const nx=Math.sin(a),nz=Math.cos(a);box(x+nx*.06,.18,z+nz*.06,1.05,.75,.2,'stone',a);box(x+nx*.16,.28,z+nz*.16,.75,.55,.1,'dark',a);}
 /** Window under a stone lintel on a stone sill: glass to 15 cm proud of the ring line, a white mullion to 20 cm. */
 function bayWindow(x:number,y:number,z:number,a:number,w:number,h:number){
  const nx=Math.sin(a),nz=Math.cos(a);
  box(x+nx*.06,y,z+nz*.06,w,h,.18,'glass',a);
  box(x+nx*.17,y,z+nz*.17,.07,h,.06,'white',a);
  box(x+nx*.1,y+h,z+nz*.1,w+.3,.28,.3,'stone',a);box(x+nx*.09,y-.14,z+nz*.09,w+.24,.14,.26,'stone',a);
 }
 function inside(x:number,z:number,ring:number[][]){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const p=ring[i],q=ring[j];if((p[1]>z)!==(q[1]>z)&&x<(q[0]-p[0])*(z-p[1])/(q[1]-p[1])+p[0])yes=!yes;}return yes;}
 function partEaves(x:number,z:number){let top=0;for(const part of source.parts){const tags=part.properties as Record<string,string>;if(tags.min_height||tags['roof:material']==='glass')continue;if(part.localPolygons.some(poly=>inside(x,z,poly[0])))top=Math.max(top,Number(tags.height)-Number(tags['roof:height']||0));}return top;}
 /** Eaves of the tallest ground-standing mass at a point: a mapped part, else the 14 m parent residual, else none. */
 function wallTop(x:number,z:number){
  let top=0;
  for(const part of source.parts){const tags=part.properties as Record<string,string>;if(tags.min_height||tags['roof:material']==='glass')continue;if(part.localPolygons.some(poly=>inside(x,z,poly[0])))top=Math.max(top,Number(tags.height)-Number(tags['roof:height']||0));}
  if(!top&&source.residualParentPolygons.some(poly=>inside(x,z,poly[0])))top=14;
  return top;
 }
 const ring=source.parent.localPolygons[0][0],winding=Math.sign(ring.slice(0,-1).reduce((s,p,i)=>s+p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0))||1;
 // Exterior facade only. Source partitions and low interior courts are not
 // decorated or raised to the external wall height.
 for(let i=0;i<ring.length-1;i++){
  const p=ring[i],q=ring[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<2.3)continue;
  const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
  const covering=source.parts.filter(part=>!part.properties.min_height&&part.localPolygons.some(poly=>inside(mx-nx*.25,mz-nz*.25,poly[0])));
  const h=covering.length?Math.max(...covering.map(part=>Number(part.properties.height)-Number(part.properties['roof:height']||0))):14,tower=h>=30;
  // plinth band: under the tower arches as before, above the basement lights on the bays
  band([p,q],tower?.5:1.05,tower?.4:.25,.3,'stone');band([p,q],Math.min(h,18)-.4,.32,.3,'stone');
  if(tower){
   const n=Math.max(1,Math.floor(len/4.2));
   for(let j=0;j<n;j++){const t=(j+.5)/n,x=p[0]+dx*t+nx*.12,z=p[1]+dz*t+nz*.12;
    // The wall behind this window, not the segment's midpoint: a segment that
    // runs past the clock tower onto the 14 m block hung tower arches in the
    // air above its roof (feedback 58f97b44, "floating windows on berlage").
    const local=Math.min(h,wallTop(x-nx*.37,z-nz*.37));
    for(const y of [5,13,20]){if(y+3.5>local)continue;arch(x,y,z,1.35,3.5,a,'stone',.15);arch(x+nx*.1,y+.1,z+nz*.1,1.15,3.3,a,'dark',.03);}
   }
   continue;
  }
  facadeBays(i,p,q,a,h);
 }
 // Landmark clock tower: tiled blue/white border and red/gold dial are an
 // original flat-colour interpretation of the official restored-clock photo.
 const tower=source.parts.find(p=>p.osmId==='w749918639')!,r=tower.localPolygons[0][0];
 const tw=Math.sign(r.slice(0,-1).reduce((s,p,i)=>s+p[0]*r[i+1][1]-r[i+1][0]*p[1],0))||1;
 for(let i=0;i<r.length-1;i++){
  const p=r[i],q=r[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<5)continue;const a=-Math.atan2(dz,dx)+(tw>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),x=(p[0]+q[0])/2+nx*.14,z=(p[1]+q[1])/2+nz*.14;
  box(x-nx*.08,26.1,z-nz*.08,4.8,4.8,.30,'stone',a);box(x+nx*.12,26.35,z+nz*.12,4.3,4.3,.12,'blue',a);
  add(new T.CylinderGeometry(1.7,1.7,.14,16).rotateX(Math.PI/2),'gold',x+nx*.23,28.5,z+nz*.23,a);add(new T.CylinderGeometry(1.5,1.5,.15,16).rotateX(Math.PI/2),'red',x+nx*.33,28.5,z+nz*.33,a);
  for(let k=0;k<12;k++){const t=k*Math.PI/6,u=1.25*Math.sin(t),v=1.25*Math.cos(t);box(x+nx*.44+Math.cos(a)*u,28.4+v,z+nz*.44-Math.sin(a)*u,.1,.22,.07,'gold',a);}box(x+nx*.46,28.5,z+nz*.46,.12,1.15,.08,'gold',a);
  arch(x,33,z,3.2,5.2,a,'stone',.17);arch(x+nx*.12,33.15,z+nz*.12,2.9,4.95,a,'dark',.05);
  for(let j=0;j<5;j++)box(p[0]+dx*(j+.5)/5,38.8,p[1]+dz*(j+.5)/5,.75,.65,.35,'stone',a);
 }
}
