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
 function body(polys:number[][][][],base:number,h:number){for(const p of polys){const g=new T.ExtrudeGeometry(shape(p),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<positions.count;i+=3){if(normals.getY(i)>.9&&normals.getY(i+1)>.9&&normals.getY(i+2)>.9)continue;for(let j=0;j<3;j++)v.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));}g.dispose();mesh(v,'brick');}}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:5}),c,x,y,z,a);}
 function pairedWindow(x:number,y:number,z:number,a:number,w=2.1,h=2.4){const nx=Math.sin(a),nz=Math.cos(a);box(x,y,z,w+.28,h+.2,.11,'stone',a);box(x+nx*.1,y+.08,z+nz*.1,w,h,.09,'glass',a);box(x+nx*.2,y+.05,z+nz*.2,.12,h,.12,'stone',a);box(x+nx*.2,y+h*.52,z+nz*.2,w,.1,.12,'stone',a);box(x,y+h+.1,z,w+.42,.22,.35,'stone',a);}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1];box((p[0]+q[0])/2,y,(p[1]+q[1])/2,Math.hypot(q[0]-p[0],q[1]-p[1]),h,d,c,-Math.atan2(q[1]-p[1],q[0]-p[0]));}}
 body(source.residualParentPolygons,0,14);
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
 function inside(x:number,z:number,ring:number[][]){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const p=ring[i],q=ring[j];if((p[1]>z)!==(q[1]>z)&&x<(q[0]-p[0])*(z-p[1])/(q[1]-p[1])+p[0])yes=!yes;}return yes;}
 const ring=source.parent.localPolygons[0][0],winding=Math.sign(ring.slice(0,-1).reduce((s,p,i)=>s+p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0))||1;
 // Exterior facade only. Source partitions and low interior courts are not
 // decorated or raised to the external wall height.
 for(let i=0;i<ring.length-1;i++){
  const p=ring[i],q=ring[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<2.3)continue;
  const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
  const covering=source.parts.filter(part=>!part.properties.min_height&&part.localPolygons.some(poly=>inside(mx-nx*.25,mz-nz*.25,poly[0])));
  const h=covering.length?Math.max(...covering.map(part=>Number(part.properties.height)-Number(part.properties['roof:height']||0))):14,tower=h>=30;
  band([p,q],.5,.4,.3,'stone');band([p,q],Math.min(h,18)-.4,.32,.3,'stone');
  const n=Math.max(1,Math.floor(len/(tower?4.2:5))),step=len/n;
  for(let j=0;j<n;j++){const t=(j+.5)/n,x=p[0]+dx*t+nx*.12,z=p[1]+dz*t+nz*.12;
   if(tower){for(const y of [5,13,20]){arch(x,y,z,1.35,3.5,a,'stone');arch(x+nx*.1,y+.1,z+nz*.1,1.15,3.3,a,'dark');}continue;}
   for(const y of [2.0,7.1,12.2])if(y+2.6<h)pairedWindow(x,y,z,a,Math.min(2.25,step*.62),2.5);
   if(len>8&&h>=17&&h<30){
    const width=Math.min(3.9,step*.85),y=Math.min(h,18)-.1,ux=Math.cos(a),uz=-Math.sin(a),v=[x-ux*width/2,y,z-uz*width/2,x+ux*width/2,y,z+uz*width/2,x,y+2.25,z];mesh(v,'brick');arch(x+nx*.12,y+.2,z+nz*.12,.92,1.65,a,'stone');
   }
  }
 }
 // Landmark clock tower: tiled blue/white border and red/gold dial are an
 // original flat-colour interpretation of the official restored-clock photo.
 const tower=source.parts.find(p=>p.osmId==='w749918639')!,r=tower.localPolygons[0][0];
 const tw=Math.sign(r.slice(0,-1).reduce((s,p,i)=>s+p[0]*r[i+1][1]-r[i+1][0]*p[1],0))||1;
 for(let i=0;i<r.length-1;i++){
  const p=r[i],q=r[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<5)continue;const a=-Math.atan2(dz,dx)+(tw>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),x=(p[0]+q[0])/2+nx*.14,z=(p[1]+q[1])/2+nz*.14;
  box(x,26.1,z,4.8,4.8,.14,'stone',a);box(x+nx*.12,26.35,z+nz*.12,4.3,4.3,.12,'blue',a);
  add(new T.CylinderGeometry(1.7,1.7,.14,16).rotateX(Math.PI/2),'gold',x+nx*.23,28.5,z+nz*.23,a);add(new T.CylinderGeometry(1.5,1.5,.15,16).rotateX(Math.PI/2),'red',x+nx*.33,28.5,z+nz*.33,a);
  for(let k=0;k<12;k++){const t=k*Math.PI/6,u=1.25*Math.sin(t),v=1.25*Math.cos(t);box(x+nx*.44+Math.cos(a)*u,28.4+v,z+nz*.44-Math.sin(a)*u,.1,.22,.07,'gold',a);}box(x+nx*.46,28.5,z+nz*.46,.12,1.15,.08,'gold',a);
  arch(x,33,z,3.2,5.2,a,'stone');arch(x+nx*.12,33.15,z+nz*.12,2.9,4.95,a,'dark');
  for(let j=0;j<5;j++)box(p[0]+dx*(j+.5)/5,38.8,p[1]+dz*(j+.5)/5,.75,.65,.35,'stone',a);
 }
}
