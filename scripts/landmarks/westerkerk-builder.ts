import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './westerkerk-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Renaissance church: exact double-cross roofs and stepped bell tower. */
export function buildWesterkerk(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function body(polygons:number[][][][],base:number,height:number,c:Colour){for(const r of polygons){const g=new T.ExtrudeGeometry(shape(r),{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+height,0);add(g,c);}}
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 function segment(a:number[],q:number[],y:number,h:number,d:number,c:Colour){const dx=q[0]-a[0],dz=q[1]-a[1];box((a[0]+q[0])/2,y,(a[1]+q[1])/2,Math.hypot(dx,dz),h,d,c,-Math.atan2(dz,dx));}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour,depth=.12){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:6}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,open=false){
  const nx=Math.sin(a),nz=Math.cos(a);arch(x,y,z,w+.35,h+.3,a,'stone');arch(x+nx*.15,y+.14,z+nz*.15,w,h,a,open?'dark':'glass');
  const px=x+nx*.36,pz=z+nz*.36;box(px,y+.2,pz,.13,h-w*.42,.11,'white',a);
  if(!open){for(const u of [-w*.27,w*.27])box(px+Math.cos(a)*u,y+.2,pz-Math.sin(a)*u,.09,h-w*.53,.11,'white',a);for(let v=y+1.3;v<y+h-w*.55;v+=1.65)box(px,v,pz,w,.09,.12,'white',a);}
 }
 function facade(ring:number[][],base:number,eaves:number,kind:'aisle'|'nave'|'tower'|'upper'){
  const winding=Math.sign(ring.slice(0,-1).reduce((s,a,i)=>{const q=ring[i+1];return s+a[0]*q[1]-q[0]*a[1];},0))||1;
  for(let i=0;i<ring.length-1;i++){
   const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);if(len<2.5)continue;
   const angle=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(angle),nz=Math.cos(angle),tower=kind==='tower',upper=kind==='upper';
   for(const y of tower?[1.3,10,23,eaves-.55]:upper?[base+.25,eaves-.4]:[base+.3,eaves-.45])segment(a,q,y,.35,.45,'stone');
   const count=Math.max(1,Math.floor(len/(tower?4.1:upper?5:7.5))),step=len/count;
   for(let k=0;k<count;k++){
    const t=(k+.5)/count,x=a[0]+dx*t+nx*.15,z=a[1]+dz*t+nz*.15;
    if(tower){window(x,3,z,Math.min(2,step*.55),4.5,angle,true);window(x,13,z,Math.min(1.25,step*.4),7,angle,true);window(x,27,z,Math.min(1.35,step*.42),10.2,angle,true);}
    else if(upper){if(eaves-base>=6)window(x,base+1.7,z,Math.min(2.15,step*.56),eaves-base-3.1,angle,true);}
    else window(x,kind==='aisle'?3.1:15.3,z,Math.min(kind==='aisle'?4.2:5.1,step*.63),kind==='aisle'?8.8:8.5,angle);
   }
   for(const t of [0,1]){const x=a[0]+dx*t+nx*.05,z=a[1]+dz*t+nz*.05;box(x,base+.4,z,upper?.38:.55,eaves-base-.8,upper?.38:.55,'stone');if(!tower&&!upper){box(x,eaves,z,1.2,.6,1.2,'stone');b.hip(x,eaves+.6,z,1.1,1.1,.5,'stone');}}
  }
 }
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),[x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
  const tower=part.osmId.startsWith('w751083'),gable=tags['roof:shape']==='gabled',pyramid=tags['roof:shape']==='pyramidal';
  const rise=Number(tags['roof:height']||0),aisle=part.osmId==='w749268115',eaves=aisle?12.5:top-rise;
  const colour:Colour=tower?(base===0?'brick':base===40?'stone':'white'):'brick';
  body(part.localPolygons,base,eaves-base,colour);
  if(top>5)for(const rings of part.localPolygons)facade(rings[0],base,eaves,tower?(base===0?'tower':'upper'):aisle?'aisle':top>15?'nave':'aisle');
  const height=(x:number,z:number)=>{if(gable){const v=part.roofAxis==='x'?x:z,m=part.roofAxis==='x'?cx:cz,r=part.roofAxis==='x'?(x1-x0)/2:(z1-z0)/2;return eaves+rise*Math.max(0,1-Math.abs(v-m)/r);}if(aisle)return eaves+(top-eaves)*Math.max(0,1-Math.abs(z-cz)/((z1-z0)/2));return top;};
  if(pyramid){const v:number[]=[];for(const rings of part.localPolygons){const r=rings[0];for(let i=0;i<r.length-1;i++)v.push(r[i][0],eaves,r[i][1],r[i+1][0],eaves,r[i+1][1],cx,top,cz);}mesh(v,'slate');}
  else{
   for(const rings of part.roofPolygons){const g=new T.ShapeGeometry(shape(rings)),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,height(x,z),z);}g.computeVertexNormals();add(g,tower?'slate':top===5?'frame':'slate');}
   if(gable||aisle){const v:number[]=[];
    for(const rings of part.localPolygons)for(const r of rings)for(let i=0;i<r.length-1;i++){
     const a=r[i],q=r[i+1],points=[a],axis=gable?part.roofAxis:'z',k=axis==='x'?0:1,m=k===0?cx:cz,t=(m-a[k])/(q[k]-a[k]);if(t>0&&t<1)points.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);points.push(q);
     for(let j=0;j<points.length-1;j++){const a=points[j],q=points[j+1],h0=height(a[0],a[1]),h1=height(q[0],q[1]);if(h1>eaves+.01)v.push(a[0],eaves,a[1],q[0],eaves,q[1],q[0],h1,q[1]);if(h0>eaves+.01)v.push(a[0],eaves,a[1],q[0],h1,q[1],a[0],h0,a[1]);}
    }mesh(v,'brick');
   }
  }
  if(gable){
   // Renaissance gable cornices follow the surveyed ridge end, with restrained scrolls.
   const alongX=part.roofAxis==='z',ends=alongX?[x0,x1]:[z0,z1],half=alongX?(z1-z0)/2:(x1-x0)/2;
   for(const end of ends){const centre=alongX?[end,cz]:[cx,end],a=alongX?[end,cz-half]:[cx-half,end],q=alongX?[end,cz+half]:[cx+half,end];
    segment(a,q,eaves,.4,.55,'stone');box(centre[0],top-.6,centre[1],2.4,.45,1.2,'stone');b.hip(centre[0],top-.15,centre[1],2.5,1.3,.5,'stone');
    const v:number[]=[],line=(p:number[],c:number[])=>{const d=.19;v.push(p[0],p[1]-d,p[2],c[0],c[1]-d,c[2],c[0],c[1]+d,c[2],p[0],p[1]-d,p[2],c[0],c[1]+d,c[2],p[0],p[1]+d,p[2]);};line([a[0],eaves,a[1]],[centre[0],top,centre[1]]);line([centre[0],top,centre[1]],[q[0],eaves,q[1]]);mesh(v,'stone');
   }
  }
  if(tower&&base>0&&top<82){
   // Real projecting cornices/balustrades, not the old imported stray scaffolding.
   for(const rings of part.localPolygons)for(let i=0;i<rings[0].length-1;i++){
    const a=rings[0][i],q=rings[0][i+1];if(Math.hypot(a[0]-q[0],a[1]-q[1])<2.5)continue;segment(a,q,top-.6,.55,.8,'stone');segment(a,q,top+.8,.12,.26,'stone');
    const n=Math.floor(Math.hypot(a[0]-q[0],a[1]-q[1])/.8);for(let j=0;j<=n;j++){const t=j/(n||1);box(a[0]+(q[0]-a[0])*t,top-.1,a[1]+(q[1]-a[1])*t,.12,.95,.12,'stone');}
   }
  }
 }
 // Exact low mapped annex/rim geometry remains below the monumental roofs.
 body(source.residualParentPolygons,0,12,'brick');for(const rings of source.residualParentPolygons){const g=new T.ShapeGeometry(shape(rings));g.rotateX(Math.PI/2);add(g,'slate',0,12,0);}
 const lower=source.parts.find(p=>p.osmId==='w751083598')!,[x0,z0,x1,z1]=lower.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
 for(const [x,z,angle] of [[cx,z0-.18,Math.PI],[cx,z1+.18,0],[x0-.18,cz,-Math.PI/2],[x1+.18,cz,Math.PI/2]]){
  const nx=Math.sin(angle),nz=Math.cos(angle),y=52.3;box(x,y-2.4,z,5.3,4.8,.22,'stone',angle);box(x+nx*.17,y-2.15,z+nz*.17,4.8,4.35,.2,'red',angle);
  const disk=(r:number,d:number,c:Colour,offset:number)=>add(new T.CylinderGeometry(r,r,d,20).rotateX(Math.PI/2),c,x+nx*offset,y,z+nz*offset,angle);
  disk(2.05,.16,'gold',.33);disk(1.83,.18,'red',.44);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,u=1.55*Math.sin(a),v=1.55*Math.cos(a);box(x+nx*.59+Math.cos(angle)*u,y+v-.1,z+nz*.59-Math.sin(angle)*u,.12,.22,.07,'gold',angle);}
  box(x+nx*.65,y-.12,z+nz*.65,.13,1.3,.09,'gold',angle);box(x+nx*.68+Math.cos(angle)*.42,y-.08,z+nz*.68-Math.sin(angle)*.42,1,.13,.09,'gold',angle);
 }
 // Blue imperial crown and gold arches, independently authored in the shared palette.
 const cap=source.parts.find(p=>p.osmId==='w751083595')!,[a,c,d,e]=cap.bounds,tx=(a+d)/2,tz=(c+e)/2;
 add(new T.CylinderGeometry(1.35,1.15,.35,12),'gold',tx,82.15,tz);const dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);dome.scale(1.3,2,1.3);add(dome,'blue',tx,82.3,tz);
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;for(let j=0;j<5;j++){const t=j*Math.PI/10;const r=1.35*Math.cos(t);add(new T.SphereGeometry(.11,5,3),'gold',tx+r*Math.sin(angle),82.3+2.05*Math.sin(t),tz+r*Math.cos(angle));}}
 add(new T.SphereGeometry(.32,8,4),'gold',tx,84.5,tz);box(tx,84.75,tz,.11,.45,.11,'gold');box(tx,85,tz,.52,.09,.11,'gold');box(tx,85.25,tz,.08,1.4,.08,'gold');
 // Small planar weathercock silhouette reaches the church's documented87m.
 mesh([tx-.65,86.15,tz,tx+.35,86.2,tz,tx+.43,86.65,tz,tx-.65,86.15,tz,tx+.43,86.65,tz,tx-.15,86.95,tz,tx-.15,86.95,tz,tx+.43,86.65,tz,tx+.65,87,tz],'gold');
}
