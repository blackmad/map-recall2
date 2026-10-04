import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './munttoren-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Muntgebouw compound, historic round base and open bell lantern. */
export function buildMunttoren(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function body(polys:number[][][][],base:number,h:number,c:Colour){for(const p of polys){const g=new T.ExtrudeGeometry(shape(p),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);add(g,c);}}
 function rod(a:T.Vector3,z:T.Vector3,r:number,c:Colour){const d=z.clone().sub(a),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const p=a.clone().add(z).multiplyScalar(.5);add(g,c,p.x,p.y,p.z);}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:5}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour='dark'){const nx=Math.sin(a),nz=Math.cos(a);arch(x,y,z,w+.16,h+.1,a,'stone');arch(x+nx*.12,y+.05,z+nz*.12,w,h,a,c);box(x+nx*.24,y+.1,z+nz*.24,.07,h-w/2,.1,'white',a);box(x+nx*.24,y+h*.46,z+nz*.24,w,.07,.1,'white',a);}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1];box((a[0]+q[0])/2,y,(a[1]+q[1])/2,Math.hypot(dx,dz)+.025,h,d,c,-Math.atan2(dz,dx));}}
 function roof(part:typeof source.parts[number],eaves:number,top:number,c:Colour){
  const [x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
  if(part.properties['roof:shape']==='gabled'){
   const axis=part.roofAxis==='x'?0:1,mid=axis===0?cx:cz,span=axis===0?(x1-x0)/2:(z1-z0)/2;
   const height=(x:number,z:number)=>eaves+(top-eaves)*Math.max(0,1-Math.abs((axis===0?x:z)-mid)/span);
   for(const p of part.roofPolygons){const g=new T.ShapeGeometry(shape(p));const v=g.getAttribute('position');for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getY(i);v.setXYZ(i,x,height(x,z),z);}g.computeVertexNormals();add(g,c);}
   // Close every sloped end wall up to the exact roof, including ridge crossings.
   for(const poly of part.localPolygons)for(const ring of poly){const v:number[]=[];for(let i=0;i<ring.length-1;i++){const a=ring[i],q=ring[i+1],segments=[a];if((a[axis]-mid)*(q[axis]-mid)<0){const t=(mid-a[axis])/(q[axis]-a[axis]);segments.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}segments.push(q);for(let j=0;j<segments.length-1;j++){const p=segments[j],r=segments[j+1];v.push(p[0],eaves,p[1],r[0],eaves,r[1],r[0],height(...r as [number,number]),r[1],p[0],eaves,p[1],r[0],height(...r as [number,number]),r[1],p[0],height(...p as [number,number]),p[1]);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'brick');}
  }else if(part.properties['roof:shape']==='pyramidal'){
   for(const p of part.localPolygons){const v:number[]=[];for(let i=0;i<p[0].length-1;i++)v.push(p[0][i][0],eaves,p[0][i][1],p[0][i+1][0],eaves,p[0][i+1][1],cx,top,cz);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
  }
 }
 // The compound parent's uncovered residual excludes all parts, particularly
 // the mapped min_height=3 connector; no invented ground slab below it.
 body(source.residualParentPolygons,0,6,'brick');
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,base=Number(tags.min_height||0),top=Number(tags.height),eaves=top-Number(tags['roof:height']||0),stone=base>=13;
  body(part.localPolygons,base,eaves-base,stone?'stone':'brick');
  for(const poly of part.localPolygons){const ring=poly[0];band(ring,eaves-.2,.25,.22,'stone');if(stone)band(ring,base,.25,.25,'stone');
   const winding=Math.sign(ring.slice(0,-1).reduce((sum,a,i)=>sum+a[0]*ring[i+1][1]-ring[i+1][0]*a[1],0))||1;
   for(let i=0;i<ring.length-1;i++){const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);if(len<1.15)continue;const angle=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(angle),nz=Math.cos(angle),n=Math.max(1,Math.floor(len/2.5));
    for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+dx*t+nx*.11,z=a[1]+dz*t+nz*.11;
     if(stone)window(x,base+.55,z,Math.min(1.05,len*.6),eaves-base-1.05,angle,'slate');
     else if(part.osmId==='w751683820'){window(x,1.1,z,1.05,2.65,angle);window(x,4.9,z,.9,2.3,angle);}
     else if(part.osmId==='w751698384')window(x,8.1,z,.8,2.4,angle);
    }
   }
  }
  roof(part,eaves,top,tags['roof:material']==='roof_tiles'?'red':'slate');
 }
 // Original upper timber bell lantern, unsupported by a solid extra extrusion.
 // Its 41 m overall silhouette follows current conservation photographs.
 const cap=source.parts.find(p=>p.osmId==='w751698382')!,[x0,z0,x1,z1]=cap.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2,r=1.43;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=cx+r*Math.sin(a),z=cz+r*Math.cos(a);box(x,24,z,.18,7.4,.18,'stone');box(x,31.3,z,.3,.3,.3,'stone');const q=(i+1)*Math.PI/4;rod(new T.Vector3(x,31.15,z),new T.Vector3(cx+r*Math.sin(q),31.15,cz+r*Math.cos(q)),.1,'stone');}
 for(const [y,size] of [[27.8,.48],[30.1,.37]]){add(new T.CylinderGeometry(size*.4,size,size*.8,10),'bronze',cx,y,cz);add(new T.TorusGeometry(size,.06,5,10).rotateX(Math.PI/2),'gold',cx,y-size*.4,cz);}
 // Four clocks sit outside the octagon faces, with restrained gold markings.
 for(let i=0;i<4;i++){const a=i*Math.PI/2,nx=Math.sin(a),nz=Math.cos(a),x=cx+nx*1.65,z=cz+nz*1.65,y=25.4;
  add(new T.CylinderGeometry(1.1,1.1,.12,16).rotateX(Math.PI/2),'gold',x,y,z,a);add(new T.CylinderGeometry(1.02,1.02,.14,16).rotateX(Math.PI/2),'dark',x+nx*.1,y,z+nz*.1,a);
  for(let k=0;k<12;k++){const t=k*Math.PI/6,u=.83*Math.sin(t),v=.83*Math.cos(t);box(x+nx*.22+Math.cos(a)*u,y+v-.075,z+nz*.22-Math.sin(a)*u,.06,.15,.04,'gold',a);}
  box(x+nx*.25,y-.025,z+nz*.25,.07,.69,.05,'gold',a);box(x+nx*.26+Math.cos(a)*.22,y-.025,z+nz*.26-Math.sin(a)*.22,.53,.07,.05,'gold',a);
 }
 b.hip(cx,31.5,cz,3.7,3.7,2,'slate');
 add(new T.CylinderGeometry(.5,.65,.35,8),'stone',cx,33.7,cz);
 // Open pear-shaped finial; its thin rods are intentional historic structure.
 for(let i=0;i<8;i++){const a=i*Math.PI/4;for(let j=0;j<8;j++){const p=(k:number)=>{const t=k/8,rr=.68*Math.sin(Math.PI*t);return new T.Vector3(cx+rr*Math.sin(a),33.9+t*4.2,cz+rr*Math.cos(a));};rod(p(j),p(j+1),.055,'slate');}}
 add(new T.SphereGeometry(.24,8,4),'gold',cx,38.25,cz);box(cx,38.5,cz,.07,2.5,.07,'gold');box(cx,40.1,cz,1.2,.06,.06,'gold');
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([cx-.42,40.55,cz,cx+.35,40.61,cz,cx+.1,41,cz],3));g.computeVertexNormals();add(g,'gold');
}
