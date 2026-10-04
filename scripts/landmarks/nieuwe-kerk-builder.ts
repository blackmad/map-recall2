import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './nieuwe-kerk-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Gothic Nieuwe Kerk: exact current roof parts and native facade. */
export function buildNieuweKerk(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 // Explicit roof panels own the top surface. Retain extrusion walls/bottoms,
 // omitting upward caps that otherwise flicker against the gray flat roofs.
 function body(polys:number[][][][],base:number,h:number){for(const p of polys){const g=new T.ExtrudeGeometry(shape(p),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<positions.count;i+=3){if(normals.getY(i)>.9&&normals.getY(i+1)>.9&&normals.getY(i+2)>.9)continue;for(let j=0;j<3;j++)v.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));}g.dispose();mesh(v,'brick');}}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:5}),c,x,y,z,a);}
 function pairedWindow(x:number,y:number,z:number,a:number,w=2.1,h=2.4){const nx=Math.sin(a),nz=Math.cos(a);box(x,y,z,w+.28,h+.2,.11,'stone',a);box(x+nx*.1,y+.08,z+nz*.1,w,h,.09,'glass',a);box(x+nx*.2,y+.05,z+nz*.2,.12,h,.12,'stone',a);box(x+nx*.2,y+h*.52,z+nz*.2,w,.1,.12,'stone',a);box(x,y+h+.1,z,w+.42,.22,.35,'stone',a);}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1];box((p[0]+q[0])/2,y,(p[1]+q[1])/2,Math.hypot(q[0]-p[0],q[1]-p[1]),h,d,c,-Math.atan2(q[1]-p[1],q[0]-p[0]));}}
 body(source.residualParentPolygons,0,13);
 for(const p of source.residualParentPolygons){const g=new T.ShapeGeometry(shape(p));g.rotateX(Math.PI/2);add(g,'slate',0,13,0);}
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),rise=Number(tags['roof:height']||0),eaves=top-rise,glass=tags['roof:material']==='glass';
  if(!glass)body(part.localPolygons,base,eaves-base);
  const roofHeight=(x:number,z:number)=>{
   if(tags['roof:shape']==='hipped'){const [x0,z0,x1,z1]=part.bounds,r=part.ridge,nx=r.normal[0],nz=r.normal[1],ux=-nz,uz=nx,dots=part.localPolygons[0][0].map(p=>p[0]*ux+p[1]*uz),lo=Math.min(...dots),hi=Math.max(...dots),edge=Math.min(x*ux+z*uz-lo,hi-x*ux-z*uz);return eaves+rise*Math.max(0,Math.min(1,1-Math.abs(x*nx+z*nz-r.mid)/r.halfSpan,edge/r.halfSpan));}
   if(tags['roof:shape']==='gabled'){const r=part.ridge;return eaves+rise*Math.max(0,1-Math.abs(x*r.normal[0]+z*r.normal[1]-r.mid)/r.halfSpan);}
   if(tags['roof:shape']==='skillion'){const r=(part as typeof part & {skillion:{downhill:number[];min:number;max:number}}).skillion;return eaves+rise*(1-(x*r.downhill[0]+z*r.downhill[1]-r.min)/(r.max-r.min));}
   return top;
  };
  if(tags['roof:shape']==='pyramidal'){
   const [x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
   for(const p of part.localPolygons){const v:number[]=[];for(let i=0;i<p[0].length-1;i++)v.push(p[0][i][0],eaves,p[0][i][1],p[0][i+1][0],eaves,p[0][i+1][1],cx,top,cz);mesh(v,'slate');}
  }else{
   for(const p of part.roofPolygons){const g=new T.ShapeGeometry(shape(p)),pos=g.getAttribute('position'),idx=g.index!;if(tags['roof:shape']==='hipped'){const values:number[]=[];function tri(a:number[],b:number[],c:number[],level:number){if(level){const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];tri(a,ab,ca,level-1);tri(ab,b,bc,level-1);tri(ca,bc,c,level-1);tri(ab,bc,ca,level-1);}else for(const p of [a,b,c])values.push(p[0],roofHeight(p[0],p[1]),p[1]);}for(let i=0;i<idx.count;i+=3){const points=[0,1,2].map(j=>[pos.getX(idx.getX(i+j)),pos.getY(idx.getX(i+j))]);tri(points[0],points[1],points[2],2);}g.dispose();mesh(values,'slate');}else{for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,roofHeight(x,z),z);}g.computeVertexNormals();add(g,glass?'glass':'slate');}}

  }
  // Every sloping roof receives its exact end-wall infill, split at the ridge.
  if(rise&&!glass&&tags['roof:shape']!=='pyramidal'){
   const v:number[]=[];for(const p of part.localPolygons)for(const ring of p)for(let i=0;i<ring.length-1;i++){
    const a=ring[i],q=ring[i+1],segments=[a];if(tags['roof:shape']==='gabled'){const r=part.ridge,d0=a[0]*r.normal[0]+a[1]*r.normal[1]-r.mid,d1=q[0]*r.normal[0]+q[1]*r.normal[1]-r.mid;if(d0*d1<0){const t=d0/(d0-d1);segments.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}}if(tags['roof:shape']==='hipped')for(let k=1;k<4;k++)segments.push([a[0]+(q[0]-a[0])*k/4,a[1]+(q[1]-a[1])*k/4]);segments.push(q);
    for(let j=0;j<segments.length-1;j++){const p=segments[j],r=segments[j+1],h0=roofHeight(...p as [number,number]),h1=roofHeight(...r as [number,number]);if(h1>eaves+.001)v.push(p[0],eaves,p[1],r[0],eaves,r[1],r[0],h1,r[1]);if(h0>eaves+.001)v.push(p[0],eaves,p[1],r[0],h1,r[1],p[0],h0,p[1]);}
   }mesh(v,'brick');
  }
  if(base>=15)for(const p of part.localPolygons)band(p[0],eaves-.2,.25,.35,'stone');
 }
 function inside(x:number,z:number,r:number[][]){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],q=r[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])c=!c;}return c;}
 function pointed(x:number,y:number,z:number,width:number,h:number,a:number){
  const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,h-width*.65);s.quadraticCurveTo(width*.28,h-.1,0,h);s.quadraticCurveTo(-width*.28,h-.1,-width/2,h-width*.65);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.1,bevelEnabled:false,curveSegments:5}),'stone',x,y,z,a);
  const inner=s.clone();const g=new T.ExtrudeGeometry(inner,{depth:.1,bevelEnabled:false,curveSegments:5});g.scale(.9,.96,1);add(g,'dark',x+Math.sin(a)*.13,y+.16,z+Math.cos(a)*.13,a);
  for(let u of [-width*.25,0,width*.25])box(x+Math.cos(a)*u+Math.sin(a)*.25,y+.2,z-Math.sin(a)*u+Math.cos(a)*.25,.12,h-width*.7,.14,'stone',a);
  for(const k of [.36,.64])box(x+Math.sin(a)*.26,y+h*k,z+Math.cos(a)*.26,width*.87,.12,.12,'stone',a);
  for(const u of [-width*.18,width*.18])add(new T.TorusGeometry(width*.16,.065,3,8),'stone',x+Math.cos(a)*u+Math.sin(a)*.28,y+h-width*.7,z-Math.sin(a)*u+Math.cos(a)*.28,a);
 }
 for(const part of source.parts){const tags=part.properties as Record<string,string>,eave=Number(tags.height)-Number(tags['roof:height']||0),rings=part.localPolygons;for(const poly of rings){const r=poly[0],winding=Math.sign(r.slice(0,-1).reduce((s,p,i)=>s+p[0]*r[i+1][1]-r[i+1][0]*p[1],0))||1;for(let i=0;i<r.length-1;i++){const p=r[i],q=r[i+1],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<3)continue;const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a),count=Math.max(1,Math.floor(length/5.7));for(let j=0;j<count;j++){const t=(j+.5)/count,x=p[0]+dx*t+nx*.12,z=p[1]+dz*t+nz*.12,other=source.parts.filter(o=>o!==part&&o.localPolygons.some(poly=>inside(x+nx*.8,z+nz*.8,poly[0]))),covered=Math.max(0,...other.map(o=>Number(o.properties.height)-Number((o.properties as Record<string,string>)['roof:height']||0))),y=Math.max(eave>20?14:2.3,covered+.6),h=Math.min(eave-y-1,9.2);if(h<3)continue;pointed(x,y,z,Math.min(3.5,length/count*.62),h,a);for(let side of [-1,1]){const xx=x+Math.cos(a)*side*2.1,zz=z-Math.sin(a)*side*2.1;box(xx,Math.max(0,covered),zz,.55,eave-Math.max(0,covered),.9,'stone',a);add(new T.ConeGeometry(.38,1.7,4),'stone',xx,eave+.85,zz);}}}}
 }
 const facadePart=source.parts.find(p=>p.osmId==='w747911441')!,r=facadePart.ridge;let vx=-r.normal[1],vz=r.normal[0];if(vx>0){vx=-vx;vz=-vz;}const points=facadePart.localPolygons[0][0],dots=points.map(p=>p[0]*vx+p[1]*vz),end=Math.max(...dots),cx=(facadePart.bounds[0]+facadePart.bounds[2])/2,cz=(facadePart.bounds[1]+facadePart.bounds[3])/2,shift=end-cx*vx-cz*vz,fx=cx+vx*shift,fz=cz+vz*shift,a=Math.atan2(vx,vz),ux=Math.cos(a),uz=-Math.sin(a);
 // The mapped west nave end between the two actual tourelles carries the
 // signature facade seen in the official church exterior photograph.
 pointed(fx+vx*.18,13.6,fz+vz*.18,7.2,10.1,a);
 const [ex,ez]=source.westEntrance.point;for(let i=-1;i<=1;i++)pointed(ex+ux*i*4+vx*.2,.3,ez+uz*i*4+vz*.2,3.1,5.8,a);
 for(let y=1.8;y<26;y+=1.45)box((y<13?ex:fx)+vx*.09,y,(y<13?ez:fz)+vz*.09,14.2,.16,.15,'stone',a);
 for(let y=26;y<33;y+=1.45){const width=14.2*(34-y)/10;box(fx+vx*.09,y,fz+vz*.09,width,.14,.15,'stone',a);}
 add(new T.CylinderGeometry(1.2,1.2,.14,16).rotateX(Math.PI/2),'stone',fx+vx*.3,28.1,fz+vz*.3,a);add(new T.CylinderGeometry(.95,.95,.15,16).rotateX(Math.PI/2),'dark',fx+vx*.4,28.1,fz+vz*.4,a);for(let k=0;k<6;k++){const t=k*Math.PI/3;add(new T.TorusGeometry(.27,.065,4,10),'stone',fx+vx*.5+ux*.55*Math.sin(t),28.1+.55*Math.cos(t),fz+vz*.5+uz*.55*Math.sin(t),a);}
 // An open Gothic balustrade sits on the source gable front, with restrained
 // faceted pinnacles. It does not create an invented tower or ground apron.
 box(fx+vx*.3,23.6,fz+vz*.3,14.5,.2,.2,'stone',a);box(fx+vx*.3,25,fz+vz*.3,14.5,.18,.2,'stone',a);for(let i=-10;i<=10;i++)box(fx+ux*i*.65+vx*.3,23.8,fz+uz*i*.65+vz*.3,.1,1.2,.12,'stone',a);
 for(let side of [-1,1]){const x=fx+ux*side*7,z=fz+uz*side*7;box(x,25,z,.35,1.6,.35,'stone');add(new T.ConeGeometry(.4,1.4,4),'stone',x,27.3,z);}
 // Crossing point comes from the two mapped nave ridge lines.
 const transept=source.parts.find(p=>p.osmId==='w747911439')!,n=transept.ridge,det=r.normal[0]*n.normal[1]-r.normal[1]*n.normal[0],x=(r.mid*n.normal[1]-r.normal[1]*n.mid)/det,z=(r.normal[0]*n.mid-r.mid*n.normal[0])/det;
 add(new T.CylinderGeometry(1.15,1.45,3.2,8),'slate',x,35.6,z);add(new T.ConeGeometry(1.45,7.6,8),'slate',x,41,z);box(x,44.8,z,.1,.65,.1,'dark');add(new T.SphereGeometry(.25,8,4),'gold',x,45.25,z);box(x,45.5,z,.07,.5,.07,'gold');box(x,45.75,z,.55,.07,.07,'gold');
}
