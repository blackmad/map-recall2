import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './palace-dam-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Royal Palace, surveyed eighteen parts and two open courtyards. */
export function buildPalaceDam(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 // Explicit roof panels own the top surface. Retain extrusion walls/bottoms,
 // omitting upward caps that otherwise flicker against the gray flat roofs.
 function body(polys:number[][][][],base:number,h:number){for(const p of polys){const g=new T.ExtrudeGeometry(shape(p),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<positions.count;i+=3){if(normals.getY(i)>.9&&normals.getY(i+1)>.9&&normals.getY(i+2)>.9)continue;for(let j=0;j<3;j++)v.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));}g.dispose();mesh(v,'stone');}}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:5}),c,x,y,z,a);}
 function pairedWindow(x:number,y:number,z:number,a:number,w=2.1,h=2.4){const nx=Math.sin(a),nz=Math.cos(a);box(x,y,z,w+.28,h+.2,.11,'stone',a);box(x+nx*.1,y+.08,z+nz*.1,w,h,.09,'glass',a);box(x+nx*.2,y+.05,z+nz*.2,.12,h,.12,'stone',a);box(x+nx*.2,y+h*.52,z+nz*.2,w,.1,.12,'stone',a);box(x,y+h+.1,z,w+.42,.22,.35,'stone',a);}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1];box((p[0]+q[0])/2,y,(p[1]+q[1])/2,Math.hypot(q[0]-p[0],q[1]-p[1]),h,d,c,-Math.atan2(q[1]-p[1],q[0]-p[0]));}}
 body(source.residualParentPolygons,0,25);
 for(const p of source.residualParentPolygons){const g=new T.ShapeGeometry(shape(p));g.rotateX(Math.PI/2);add(g,'slate',0,25,0);}
 for(const part of source.parts){
  if(part.properties['roof:shape']==='dome')continue;
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),rise=Number(tags['roof:height']||0),eaves=top-rise,glass=tags['roof:material']==='glass';
  if(!glass)body(part.localPolygons,base,eaves-base);
  const roofHeight=(x:number,z:number)=>{
   if(tags['roof:shape']==='gabled'){const r=part.ridge;return eaves+rise*Math.max(0,1-Math.abs(x*r.normal[0]+z*r.normal[1]-r.mid)/r.halfSpan);}
   if(tags['roof:shape']==='skillion'){const r=(part as typeof part & {skillion:{downhill:number[];min:number;max:number}}).skillion;return eaves+rise*(1-(x*r.downhill[0]+z*r.downhill[1]-r.min)/(r.max-r.min));}
   return top;
  };
  if(tags['roof:shape']==='pyramidal'){
   const [x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
   for(const p of part.localPolygons){const v:number[]=[];for(let i=0;i<p[0].length-1;i++)v.push(p[0][i][0],eaves,p[0][i][1],p[0][i+1][0],eaves,p[0][i+1][1],cx,top,cz);mesh(v,'slate');}
  }else{
   for(const p of part.roofPolygons){const g=new T.ShapeGeometry(shape(p)),v=g.getAttribute('position');for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getY(i);v.setXYZ(i,x,roofHeight(x,z),z);}g.computeVertexNormals();add(g,glass?'glass':'slate');}
  }
  // Every sloping roof receives its exact end-wall infill, split at the ridge.
  if(rise&&!glass&&tags['roof:shape']!=='pyramidal'){
   const v:number[]=[];for(const p of part.localPolygons)for(const ring of p)for(let i=0;i<ring.length-1;i++){
    const a=ring[i],q=ring[i+1],segments=[a];if(tags['roof:shape']==='gabled'){const r=part.ridge,d0=a[0]*r.normal[0]+a[1]*r.normal[1]-r.mid,d1=q[0]*r.normal[0]+q[1]*r.normal[1]-r.mid;if(d0*d1<0){const t=d0/(d0-d1);segments.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}}segments.push(q);
    for(let j=0;j<segments.length-1;j++){const p=segments[j],r=segments[j+1],h0=roofHeight(...p as [number,number]),h1=roofHeight(...r as [number,number]);if(h1>eaves+.001)v.push(p[0],eaves,p[1],r[0],eaves,r[1],r[0],h1,r[1]);if(h0>eaves+.001)v.push(p[0],eaves,p[1],r[0],h1,r[1],p[0],h0,p[1]);}
   }mesh(v,'stone');
  }
  if(base>=15)for(const p of part.localPolygons)band(p[0],eaves-.2,.25,.35,'stone');
 }

 const outer=source.facadePolygons[0][0],winding=Math.sign(outer.slice(0,-1).reduce((s,p,i)=>s+p[0]*outer[i+1][1]-outer[i+1][0]*p[1],0))||1;
 for(const ring of [outer])for(let i=0;i<ring.length-1;i++){
  const p=ring[i],q=ring[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<3)continue;const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),count=Math.max(1,Math.round(len/4.25));
  // Classical paired-storey pilasters and inset windows; ornaments are
  // original low-poly approximations rather than sampled photograph pixels.
  band([p,q],.3,.5,.25,'stone');band([p,q],6.1,.4,.4,'stone');band([p,q],14,.45,.4,'stone');band([p,q],24.7,.45,.5,'stone');
  for(let j=0;j<count;j++){const t=(j+.5)/count,x=p[0]+dx*t+nx*.1,z=p[1]+dz*t+nz*.1;for(const y of [1.3,7.2,10.8,15.2,19.2])pairedWindow(x,y,z,a,1.4,y<2?2.7:2.9);const u=j/count,px=p[0]+dx*u+nx*.16,pz=p[1]+dz*u+nz*.16;box(px,6.6,pz,.4,7.1,.35,'stone',a);box(px,14.6,pz,.48,9.8,.4,'stone',a);box(px,24.2,pz,.9,.45,.5,'stone',a);}
 }
 // The monumental Dam-facing pediment, with original faceted relief forms.
 const x=32.3,z=1,half=15;mesh([x,25,z-half,x,25,z+half,x,33,z],'stone');
 for(let i=-4;i<=4;i++){box(x+.12,25.8,z+i*2.5,.18,1.3+(4-Math.abs(i))*.55,.48,'stone');}
 // Exact mapped tower footprint; measured/official55m complete upper dome
 // replaces the source's incomplete45m part without fitting the legacy mesh.
 const tower=source.parts.find(p=>p.properties['roof:shape']==='dome')!,[x0,z0,x1,z1]=tower.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2,r=Math.min(x1-x0,z1-z0)/2;
 body(tower.localPolygons,30,10);
 add(new T.CylinderGeometry(r+.35,r+.35,.45,8),'stone',cx,40.2,cz);
 for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4,px=cx+Math.sin(a)*(r-.25),pz=cz+Math.cos(a)*(r-.25);add(new T.CylinderGeometry(.35,.4,8.2,6),'stone',px,44.1,pz);box(px,47.8,pz,.9,.5,.9,'stone');if(i%2===0){add(new T.CylinderGeometry(1.1,1.1,.12,16).rotateX(Math.PI/2),'dark',px+Math.sin(a)*.18,38,pz+Math.cos(a)*.18,a);box(px+Math.sin(a)*.28,38,pz+Math.cos(a)*.28,.1,.8,.1,'gold',a);}}
 add(new T.CylinderGeometry(r+.3,r+.3,.5,8),'stone',cx,48.2,cz);
 const dome=new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);dome.scale(r+.15,4.1,r+.15);add(dome,'bronze',cx,48.45,cz);
 add(new T.CylinderGeometry(.36,.55,1.1,8),'gold',cx,53.1,cz);box(cx,53.65,cz,.12,1.35,.12,'gold');box(cx+.38,54.3,cz,.8,.24,.08,'gold');
}
