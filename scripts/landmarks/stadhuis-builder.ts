import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './stadhuis-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native Stopera. Recorded part footprints own all roofs and raised volumes. */
export function buildStadhuis(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 const parts=source.parts;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function mesh(v:number[],colour:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,colour);}
 function inside(x:number,z:number,r:number[][]){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const p=r[i],q=r[j];if((p[1]>z)!==(q[1]>z)&&x<(q[0]-p[0])*(z-p[1])/(q[1]-p[1])+p[0])c=!c;}return c;}
 function occupies(part:typeof parts[number],x:number,z:number,y:number){const p=part.properties as Record<string,string>;return p['building:part']!=='roof'&&y>=Number(p.min_height||0)&&y<Number(p.height)&&part.localPolygons.some(poly=>inside(x,z,poly[0])&&!poly.slice(1).some(r=>inside(x,z,r)));}
 function solid(polys:number[][][][],base:number,top:number,colour:Colour){for(const poly of polys)add(openTopPrism(shape(poly),base,top),colour);}
 function flat(polys:number[][][][],top:number,colour:Colour){for(const poly of polys)add(upwardRoofPlane(shape(poly),top),colour);}
 function edges(r:number[][],fn:(x:number,z:number,length:number,a:number,nx:number,nz:number,p:number[],q:number[])=>void){const winding=Math.sign(r.slice(0,-1).reduce((s,p,i)=>s+p[0]*r[i+1][1]-r[i+1][0]*p[1],0));for(let i=0;i<r.length-1;i++){const p=r[i],q=r[i+1],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.06)continue;const a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0);fn((p[0]+q[0])/2,(p[1]+q[1])/2,length,a,Math.sin(a),Math.cos(a),p,q);}}
 function band(r:number[][],y:number,h:number,depth:number,c:Colour){edges(r,(x,z,l,a)=>box(x,y,z,l,h,depth,c,a));}
 for(const part of parts){const p=part.properties as Record<string,string>,top=Number(p.height),base=Number(p.min_height||0),roofOnly=p['building:part']==='roof';
  const colour:Colour=p['building:material']==='glass'?'glass':['w751559664','w751573304','w751559663','w751567320','w751559654'].includes(part.osmId)?'stone':'brick';
  if(!roofOnly){solid(part.localPolygons,base,top,colour);flat(part.localPolygons,top,'slate');}
  else if(p['roof:shape']==='gabled'){
   // The narrow surveyed glazed internal street is a canopy, never a solid wall.
   const roof=source.glazedStreetRoof;const height=(x:number,z:number)=>5+2*Math.max(0,1-Math.abs(x*roof.normal[0]+z*roof.normal[1]-roof.mid)/roof.halfSpan);
   for(const poly of roof.splitPolygons){const g=upwardRoofPlane(shape(poly)),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setXYZ(i,x,height(x,z),z);}g.computeVertexNormals();add(g,'glass');}
   for(const poly of part.localPolygons)band(poly[0],4.85,.125,.18,'frame');
  }else {flat(part.localPolygons,top,'glass');for(const poly of part.localPolygons)band(poly[0],top-.15,.125,.18,'frame');}
  if(roofOnly)continue;
  for(const poly of part.localPolygons){const ring=poly[0];
   // On elevated parts, the source min-height is retained: no infill to ground.
   band(ring,top-.22,.195,.28,colour==='glass'?'frame':'stone');
   edges(ring,(x,z,length,a,nx,nz,p0,p1)=>{
    if(length<1.2)return;
    const count=Math.max(1,Math.floor(length/(part.osmId==='w751573304'?3.2:3.6)));
    for(let j=0;j<count;j++){const t=(j+.5)/count,xx=p0[0]+(p1[0]-p0[0])*t,zz=p0[1]+(p1[1]-p0[1])*t;
     for(let y=Math.max(base+.8,1.2);y<top-1.6;y+=3.4){if(parts.some(o=>o!==part&&occupies(o,xx+nx*.5,zz+nz*.5,y+1)))continue;
      const foyer=part.osmId==='w751573304',h=foyer&&y<6?Math.min(4.8,top-y-1):1.9,w=Math.min(foyer?length/count*.77:2,length/count*.74),paneX=xx+nx*.16,paneZ=zz+nz*.16;
      box(paneX,y,paneZ,w,h,.13,'glass',a);if(foyer||colour==='glass'){box(xx+nx*.27,y,zz+nz*.27,.09,h,.12,'frame',a);box(xx+nx*.27,y+h*.55,zz+nz*.27,w,.09,.12,'frame',a);}
      if(foyer){box(xx+nx*.1,y-.15,zz+nz*.1,length/count*.94,.24,.2,'stone',a);}
     }
    }
    if(part.osmId==='w751573304'&&nz>.1&&!parts.some(o=>o!==part&&occupies(o,x+nx*.5,z+nz*.5,3))){box(x+nx*.1,0,z+nz*.1,Math.min(.7,length),top,.45,'stone',a);}
   });
  }
 }
 // Brick auditorium's actual curved parapet stays on its own recorded footprint.
 const auditorium=parts.find(p=>p.osmId==='w751559659')!;for(const poly of auditorium.localPolygons){band(poly[0],14.1,.16,.25,'stone');}
}
