import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import footprint from './rijksmuseum-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Cuypers reconstruction. Source parts define walls/roofs; the main
 * parent is never filled, so atria and the mapped ground passage remain hollow. */
export function buildRijksmuseum(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,opening=footprint.passage.clearanceHeightMetres;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(...p)));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(...p))));return s;}
 function body(polygons:number[][][][],base:number,height:number,colour:Colour='brick'){
  if(height<=0)return;for(const rings of polygons){const g=new T.ExtrudeGeometry(shape(rings),{depth:height,bevelEnabled:false,steps:1});g.rotateX(Math.PI/2);g.translate(0,base+height,0);add(g,colour);}
 }
 function mesh(vertices:number[],colour:Colour){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,colour);}
 function line(a:number[],c:number[],height:number,width:number,colour:Colour){const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);box((a[0]+c[0])/2,height,(a[1]+c[1])/2,length,.22,width,colour,-Math.atan2(dz,dx));}
 function rod(a:T.Vector3,c:T.Vector3,r=.075,colour:Colour='white'){const delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=a.clone().add(c).multiplyScalar(.5);add(g,colour,mid.x,mid.y,mid.z);}
 function windowAt(x:number,y:number,z:number,width:number,height:number,angle:number){
  box(x,y,z,width+.32,height+.35,.16,'stone',angle);box(x,y+.12,z,width,height,.25,'dark',angle);
  box(x,y+.12,z,.13,height,.31,'stone',angle);box(x,y+height*.52,z,width,.13,.32,'stone',angle);
 }
 function facade(ring:number[][],height:number,tower:boolean){
  const winding=Math.sign(ring.slice(0,-1).reduce((area,a,i)=>{const c=ring[i+1];return area+a[0]*c[1]-c[0]*a[1];},0))||1;
  for(let i=0;i<ring.length-1;i++){
   const a=ring[i],c=ring[i+1],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);if(len<(tower?2:3.5))continue;
   const angle=-Math.atan2(dz,dx),nx=winding*dz/len,nz=-winding*dx/len;
   for(const y of [1.2,5.2,9.7,15.5,height-.3])if(y>opening||Math.abs((a[0]+c[0])/2)>11)line(a,c,y,.36,'stone');
   if(tower)line(a,c,height-1.3,.55,'stone');
   const count=Math.max(1,Math.floor(len/(tower?3.2:6.5))),step=len/count;
   for(let k=0;k<count;k++){
    const u=(k+.5)/count,x=a[0]+dx*u+nx*.14,z=a[1]+dz*u+nz*.14;
    // Lower decoration never closes the surveyed passage corridor.
    const passage=x>=footprint.passage.localBounds[0]&&x<=footprint.passage.localBounds[2]
      &&z>=footprint.passage.localBounds[1]&&z<=footprint.passage.localBounds[3];
    for(const y of tower?[10.8,20.0,height-7]:[2.3,10.7]){
     if(y+4>height||passage&&y<opening)continue;
     windowAt(x,y,z,Math.min(step*.62,tower?1.45:2.7),tower&&y>17?5.8:4.1,angle);
     // A restrained pale lintel keeps the repeated window bays readable.
     if(!tower)box(x,y+4.3,z,Math.min(step*.7,3),.25,.37,'stone',angle);
    }
    if(!passage){const px=a[0]+dx*(k/count),pz=a[1]+dz*(k/count);box(px,1,pz,.4,height-1,.4,'stone');}
   }
  }
 }
 for(const part of footprint.parts){
  const [minx,minz,maxx,maxz]=part.bounds,cx=(minx+maxx)/2,cz=(minz+maxz)/2;
  const tags=part.tags as Record<string,string>,height=Number(tags.height),rise=Number(tags['roof:height']||0),eaves=height-rise;
  const glass=tags['roof:material']==='glass',tower=tags['roof:shape']==='pyramidal';
  if(!glass){body(part.lowerPolygons,0,Math.min(opening,eaves));body(part.localPolygons,opening,eaves-opening);if(tower)for(const rings of part.localPolygons)facade(rings[0],eaves,true);}
  const roofHeight=(x:number,z:number)=>{
   if(tags['roof:shape']==='gabled'){const axis=part.roofAxis==='x'?x:z,center=part.roofAxis==='x'?cx:cz,half=part.roofAxis==='x'?(maxx-minx)/2:(maxz-minz)/2;return eaves+rise*Math.max(0,1-Math.abs(axis-center)/half);}
   if(tags['roof:shape']==='skillion'){const t=tags['roof:direction']==='219.4'?(z-minz)/(maxz-minz):(maxz-z)/(maxz-minz);return eaves+rise*t;}
   return height;
  };
  if(tower){
   for(const rings of part.localPolygons){const ring=rings[0],v:number[]=[];for(let i=0;i<ring.length-1;i++)v.push(ring[i][0],eaves,ring[i][1],ring[i+1][0],eaves,ring[i+1][1],cx,height,cz);mesh(v,'slate');}
   // Gothic steep tower roofs, small dormer windows and slender original finials.
   for(const side of [-1,1]){const z=cz+side*(maxz-minz)*.28,y=eaves+rise*.40;box(cx,y,z,1.05,1.55,.7,'stone');box(cx,y+.15,z+side*.39,.62,1.1,.12,'dark');b.hip(cx,y+1.55,z,1.2,.95,.9,'slate');}
   box(cx,height,cz,.13,1.6,.13,'gold');for(const x of [minx+.45,maxx-.45])for(const z of [minz+.45,maxz-.45])box(x,eaves,z,.14,2.2,.14,'stone');
  }else{
   for(const rings of part.roofPolygons){const g=new T.ShapeGeometry(shape(rings)),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,roofHeight(x,z),z);}g.computeVertexNormals();add(g,glass?'glass':tags['roof:material']==='metal'?'frame':'slate');}
  }
  if(!glass&&!tower&&rise>0){
   // Exact outer-source edges close the masonry gable/skillion ends beneath
   // their roof planes. Split at the ridge; do not cap glass courtyard roofs.
   const v:number[]=[];
   for(const rings of part.localPolygons)for(const ring of rings)for(let i=0;i<ring.length-1;i++){
    const a=ring[i],c=ring[i+1],points=[a];
    if(tags['roof:shape']==='gabled'){
     const k=part.roofAxis==='x'?0:1,m=k===0?cx:cz,t=(m-a[k])/(c[k]-a[k]);
     if(t>0&&t<1)points.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);
    }
    points.push(c);
    for(let j=0;j<points.length-1;j++){
     const u=points[j],w=points[j+1],h0=roofHeight(...u as [number,number]),h1=roofHeight(...w as [number,number]);
     if(h1>eaves+.001)v.push(u[0],eaves,u[1],w[0],eaves,w[1],w[0],h1,w[1]);
     if(h0>eaves+.001)v.push(u[0],eaves,u[1],w[0],h1,w[1],u[0],h0,u[1]);
    }
   }
   if(v.length)mesh(v,'brick');
  }
  if(glass){
   // Explicit mapped glass atria: roofing only, no solid courtyard volume/slab.
   for(let x=minx+.7;x<maxx;x+=3.2){const z=cz;rod(new T.Vector3(x,eaves+.06,minz),new T.Vector3(x,roofHeight(x,z)+.06,z));rod(new T.Vector3(x,roofHeight(x,z)+.06,z),new T.Vector3(x,eaves+.06,maxz));}
   for(const z of [minz,cz,maxz])rod(new T.Vector3(minx,roofHeight(minx,z)+.08,z),new T.Vector3(maxx,roofHeight(maxx,z)+.08,z),.09);
  }
 }
 // Exact uncovered pieces of the mapped parent, mainly the Philips-wing tail.
 // Height is an explicit authored fallback, never a fabricated source height.
 body(footprint.residualLowerPolygons,0,opening);body(footprint.residualParentPolygons,opening,19-opening);
 for(const rings of footprint.residualParentPolygons){const s=shape(rings),g=new T.ShapeGeometry(s);g.rotateX(Math.PI/2);add(g,'slate',0,19.1,0);}
 // Outer facade decoration only; internal source partition edges remain undecorated.
 facade(footprint.decorativeExterior,19,false);
 // Pale stone arched portal frames on both ends of the genuinely open passage.
 const [left,z0,right,z1]=footprint.passage.localBounds,px=(left+right)/2,r=(right-left)/2;
 for(const z of [z0+.65,z1-.8]){
  const v:number[]=[];for(let i=0;i<18;i++){const a=i*Math.PI/18,c=(i+1)*Math.PI/18,p=(t:number,o:number)=>[px+(r+o)*Math.cos(t),5.7+(2.8+o)*Math.sin(t),z];v.push(...p(a,0),...p(c,0),...p(c,.55),...p(a,0),...p(c,.55),...p(a,.55));}mesh(v,'stone');
  for(const x of [left-.23,right+.23])box(x,0,z,.55,5.8,.5,'stone');
 }
}
