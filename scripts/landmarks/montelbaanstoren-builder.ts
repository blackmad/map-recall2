import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './montelbaanstoren-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original rounded brick base and diminishing white Renaissance lanterns. */
export function buildMontelbaanstoren(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function body(ring:number[][],base:number,h:number,c:Colour){const g=new T.ExtrudeGeometry(new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1]))),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,base+h,0);add(g,c);}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.1,bevelEnabled:false,curveSegments:5}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,open=false){const nx=Math.sin(a),nz=Math.cos(a);arch(x,y,z,w+.22,h+.15,a,'stone');arch(x+nx*.13,y+.07,z+nz*.13,w,h,a,'dark');if(!open){box(x+nx*.28,y+.12,z+nz*.28,.09,h-w/2,.12,'white',a);box(x+nx*.28,y+h*.5,z+nz*.28,w,.1,.12,'white',a);}}
 function band(ring:number[][],y:number,h:number,d:number,c:Colour){for(let i=0;i<ring.length-1;i++){const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1];box((a[0]+q[0])/2,y,(a[1]+q[1])/2,Math.hypot(dx,dz)+.05,h,d,c,-Math.atan2(dz,dx));}}
 function rod(a:T.Vector3,c:T.Vector3,r:number,colour:Colour){const delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const p=a.clone().add(c).multiplyScalar(.5);add(g,colour,p.x,p.y,p.z);}
 // The actual circular parent keeps its tiny entrance projection; neighboring
 // buildings remain independent. Its upper mapped part becomes octagonal.
 body(source.parent.ring,0,11.5,'brick');band(source.parent.ring,.35,.4,.3,'stone');band(source.parent.ring,11.25,.35,.25,'stone');
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4+.12,nx=Math.sin(a),nz=Math.cos(a),hits:number[]=[];
  for(let j=0;j<source.parent.ring.length-1;j++){const p=source.parent.ring[j],q=source.parent.ring[j+1],dx=q[0]-p[0],dz=q[1]-p[1],den=nx*dz-nz*dx;if(Math.abs(den)<1e-8)continue;const r=(p[0]*dz-p[1]*dx)/den,t=(p[0]*nz-p[1]*nx)/den;if(r>0&&t>=0&&t<=1)hits.push(r);}
  const r=Math.min(...hits)+.12,x=nx*r,z=nz*r;
  // The land-side doorway is narrow, other ordinary lower windows recur above.
  window(x,2.3,z,1.05,2.9,a);window(x,7.2,z,1.15,2.7,a);
 }
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),rise=Number(tags['roof:height']||0),eaves=top-rise,ring=part.ring;
  const [x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2,brick=base===0;
  body(ring,base,eaves-base,brick?'brick':'white');band(ring,eaves-.25,.3,.35,'stone');if(base>0)band(ring,base,.3,.45,'stone');
  const winding=Math.sign(ring.slice(0,-1).reduce((sum,a,i)=>{const q=ring[i+1];return sum+a[0]*q[1]-q[0]*a[1];},0))||1;
  for(let i=0;i<ring.length-1;i++){
   const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);if(len<1.1)continue;
   const angle=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(angle),nz=Math.cos(angle),x=(a[0]+q[0])/2+nx*.13,z=(a[1]+q[1])/2+nz*.13;
   if(brick){window(x,13,z,Math.min(1.3,len*.43),2.6,angle);window(x,16.8,z,Math.min(1.3,len*.43),2.5,angle);}
   else if(base>=24)window(x,base+.8,z,Math.min(1.4,len*.62),eaves-base-1.3,angle,true);
   if(base>=24){box(a[0],base+.3,a[1],.22,eaves-base-.4,.22,'white');box(a[0],eaves,a[1],.4,.4,.4,'stone');}
   if(base===20&&len>2.1){
    const y=22.1;add(new T.CylinderGeometry(1.16,1.16,.1,16).rotateX(Math.PI/2),'gold',x+nx*.13,y,z+nz*.13,angle);add(new T.CylinderGeometry(1.03,1.03,.12,16).rotateX(Math.PI/2),'dark',x+nx*.21,y,z+nz*.21,angle);
    for(let k=0;k<12;k++){const t=k*Math.PI/6,u=.85*Math.sin(t),v=.85*Math.cos(t);box(x+nx*.33+Math.cos(angle)*u,y+v-.075,z+nz*.33-Math.sin(angle)*u,.075,.16,.06,'gold',angle);}
    box(x+nx*.39,y-.06,z+nz*.39,.09,.76,.07,'gold',angle);box(x+nx*.41+Math.cos(angle)*.24,y-.05,z+nz*.41-Math.sin(angle)*.24,.6,.1,.07,'gold',angle);
   }
  }
  if(tags['roof:shape']==='pyramidal'){
   const v:number[]=[];for(let i=0;i<ring.length-1;i++)v.push(ring[i][0],eaves,ring[i][1],ring[i+1][0],eaves,ring[i+1][1],cx,top,cz);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'slate');
  }else if(tags['roof:shape']==='dome'){
   const dome=new T.SphereGeometry(1,12,5,0,Math.PI*2,0,Math.PI/2);dome.scale((x1-x0)/2,rise,(z1-z0)/2);add(dome,'white',cx,eaves,cz);
  }else{
   const roof=new T.ShapeGeometry(new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1]))));roof.rotateX(Math.PI/2);add(roof,'slate',0,top,0);
  }
 }
 // Gilded open ornamental finial, not a solid generic triangular needle.
 const cap=source.parts.find(p=>p.osmId==='w751647817')!,[x0,z0,x1,z1]=cap.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
 add(new T.CylinderGeometry(.6,.85,.4,8),'gold',cx,38.2,cz);
 for(let side=0;side<4;side++){
  const a=side*Math.PI/2;for(let j=0;j<8;j++){const p=(k:number)=>{const t=k/8,r=.8*Math.sin(Math.PI*t);return new T.Vector3(cx+r*Math.sin(a),38.45+t*5.5,cz+r*Math.cos(a));};rod(p(j),p(j+1),.07,'gold');}
 }
 add(new T.SphereGeometry(.32,8,4),'gold',cx,44.3,cz);box(cx,44.55,cz,.09,3.05,.09,'gold');box(cx,46.7,cz,1.5,.07,.07,'gold');
 const v=[cx-.55,47.15,cz,cx+.36,47.2,cz,cx+.42,47.65,cz,cx-.55,47.15,cz,cx+.42,47.65,cz,cx-.13,47.91,cz,cx-.13,47.91,cz,cx+.42,47.65,cz,cx+.64,48,cz];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'gold');
}
