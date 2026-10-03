import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import site from './hortus-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];

/** Three surveyed, separated buildings. No garden parcel or paved court fill. */
export function buildHortusLandmark(id:string,w:number,d:number,b:BuildingTools){
 const global=(p:number[])=>new T.Vector2((p[0]-site.anchor[0])*111320*Math.cos(site.anchor[1]*Math.PI/180),-(p[1]-site.anchor[1])*110540);
 for(const f of site.buildings){const centre=global(f.fit.centre),heading=f.fit.headingDegrees*Math.PI/180,angle=Math.PI/2-heading;
  const point=(p:number[])=>{const e=(p[0]-f.fit.centre[0])*111320*Math.cos(f.fit.centre[1]*Math.PI/180),n=(p[1]-f.fit.centre[1])*110540;return new T.Vector2(e*Math.sin(heading)+n*Math.cos(heading),e*Math.cos(heading)-n*Math.sin(heading));};
  const poly=f.geometry.coordinates[0].map(r=>r.slice(0,-1).map(point)),r=poly[0],shape=new T.Shape(r);shape.holes=poly.slice(1).map(r=>new T.Path(r));
  const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,centre.x+x*Math.cos(angle)+z*Math.sin(angle),y,centre.y-x*Math.sin(angle)+z*Math.cos(angle),angle+a);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,a=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(a);g.translate(x,y+h/2,z);add(g,c);};
  const mesh=(v:number[],c:Colour)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);};
  const rod=(a:T.Vector3,c:T.Vector3,width=.08,colour:Colour='white')=>{const delta=c.clone().sub(a),g=new T.CylinderGeometry(width,width,delta.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const p=a.clone().add(c).multiplyScalar(.5);add(g,colour,p.x,p.y,p.z);};
  const body=(h:number,c:Colour)=>{const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);add(g,c);};
  const inside=(q:T.Vector2)=>{let ok=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a.y>q.y)!==(c.y>q.y)&&q.x<(c.x-a.x)*(q.y-a.y)/(c.y-a.y)+a.x)ok=!ok;}return ok;};
  const near=(q:T.Vector2)=>Math.min(...r.map((a,i)=>{const v=r[(i+1)%r.length].clone().sub(a);const t=T.MathUtils.clamp(q.clone().sub(a).dot(v)/v.lengthSq(),0,1);return q.distanceTo(a.clone().addScaledVector(v,t));}));
  function wallGrid(h:number,step:number,solid=false){let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],v=c.clone().sub(a),length=v.length();if(length<.35)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar(area>0?1:-1),wind=Math.atan2(n.x,n.y),mid=a.clone().add(c).multiplyScalar(.5).addScaledVector(n,.035),count=Math.max(1,Math.round(length/step));box(mid.x,h-.2,mid.y,length,.2,.2,'white',wind);box(mid.x,.1,mid.y,length,.2,.2,'stone',wind);if(!solid){for(let y=2;y<h;y+=2)box(mid.x,y,mid.y,length,.07,.09,'white',wind);for(let k=0;k<=count;k++){const q=a.clone().addScaledVector(v,length*k/count).addScaledVector(n,.035);box(q.x,.1,q.y,.09,h-.1,.12,'white',wind);}}else for(let k=0;k<count;k++){const q=a.clone().addScaledVector(v,length*(k+.5)/count).addScaledVector(n,.08),width=Math.min(1.7,length/count-.6);if(width<.65)continue;add(new T.PlaneGeometry(width,4.7),'glass',q.x,3.05,q.y,wind);for(let dx of [-width/2,0,width/2])box(q.x+dx*Math.cos(wind),.7,q.y-dx*Math.sin(wind),.1,4.7,.12,'white',wind);for(let y of [.65,2.2,3.65,5.45])box(q.x,y,q.y,width+.18,.1,.12,'white',wind);}}
  }
  function hip(x:number,y:number,z:number,l:number,d:number,h:number,a=0,c:Colour='glass'){const v:number[]=[],ridge=Math.max(0,(l-d)/2),p=(u:number,y:number,v:number)=>[x+u*Math.cos(a)+v*Math.sin(a),y,z-u*Math.sin(a)+v*Math.cos(a)];for(let s of [-1,1]){v.push(...p(-l/2,y,s*d/2),...p(l/2,y,s*d/2),...p(ridge,y+h,0),...p(-l/2,y,s*d/2),...p(ridge,y+h,0),...p(-ridge,y+h,0),...p(s*l/2,y,-d/2),...p(s*l/2,y,d/2),...p(s*ridge,y+h,0));}mesh(v,c);}
  if(f.properties['@id']===57863706){
   // Van der Mey's 1911 glass dome is at the elbow of two perpendicular
   // houses, not a sphere pasted at the centre of the entire parcel.
   body(.7,'stone');const g=new T.ExtrudeGeometry(shape,{depth:3.5,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,4.2,0);add(g,'glass');wallGrid(4.2,1.2);
   const cx=-10.4,cz=8.15,outer=7.78,inner=3.65;const skirt:number[]=[],dome:number[]=[];
   for(let i=0;i<32;i++){const a=i*Math.PI/16,c=(i+1)*Math.PI/16,p=(r:number,h:number,a:number)=>[cx+r*Math.cos(a),h,cz+r*Math.sin(a)];skirt.push(...p(outer,4.2,a),...p(outer,4.2,c),...p(inner,7.5,c),...p(outer,4.2,a),...p(inner,7.5,c),...p(inner,7.5,a));dome.push(...p(inner,8.4,a),...p(inner,8.4,c),cx,10.8,cz);rod(new T.Vector3(...p(outer,4.25,a)),new T.Vector3(...p(inner,7.56,a)),.06);rod(new T.Vector3(...p(inner,8.42,a)),new T.Vector3(cx,10.85,cz),.055);rod(new T.Vector3(...p(inner,7.5,a)),new T.Vector3(...p(inner,8.4,a)),.06);for(let [radius,y]of [[outer,4.22],[inner,7.53],[inner,8.43],[5.75,5.9]])rod(new T.Vector3(...p(radius,y,a)),new T.Vector3(...p(radius,y,c)),.06);}
   mesh(skirt,'glass');mesh(dome,'glass');const collar=new T.CylinderGeometry(inner,inner,.9,32,1,true);add(collar,'glass',cx,7.95,cz);add(new T.ConeGeometry(.24,.55,8),'stone',cx,11.1,cz);
   // Main wings retain the mapped perpendicular directions and narrow width.
   hip(-10.4,4.2,-7.9,17.0,8.2,3.25,Math.PI/2);hip(3.4,4.2,8.2,12.9,8.2,3.25);hip(13.6,4.2,8.0,8.2,4.2,1.2);
   for(let z=-15.5;z<.4;z+=1.3){rod(new T.Vector3(-14.5,4.27,z),new T.Vector3(-10.4,4.2+3.25*Math.min(1,(8.5-Math.abs(z+7.9))/4.1),z),.055);rod(new T.Vector3(-10.4,4.2+3.25*Math.min(1,(8.5-Math.abs(z+7.9))/4.1),z),new T.Vector3(-6.3,4.27,z),.055);}
   rod(new T.Vector3(-10.4,7.5,-12.3),new T.Vector3(-10.4,7.5,-3.5));for(let x=-2.7;x<9.7;x+=1.3){rod(new T.Vector3(x,4.27,4.1),new T.Vector3(x,4.2+3.25*Math.min(1,(6.45-Math.abs(x-3.4))/4.1),8.2),.055);rod(new T.Vector3(x,4.2+3.25*Math.min(1,(6.45-Math.abs(x-3.4))/4.1),8.2),new T.Vector3(x,4.27,12.3),.055);}rod(new T.Vector3(1.05,7.5,8.2),new T.Vector3(5.75,7.5,8.2));
  }else if(f.properties['@id']===57863916){
   body(5.8,'glass');wallGrid(5.8,1.6);
   // The 2025 roof uses milky ETFE cushions on the retained cable-supported
   // skeleton. Every cell is clipped to the actual six-sided footprint.
   const roof=(p:T.Vector2)=>5.8+Math.min(near(p)*.42,4.75),g=new T.ShapeGeometry(shape),pos=g.getAttribute('position'),ix=g.index!,vertices:number[]=[];
   function tri(a:T.Vector2,c:T.Vector2,e:T.Vector2,n:number){if(n){const ac=a.clone().add(c).multiplyScalar(.5),ce=c.clone().add(e).multiplyScalar(.5),ea=e.clone().add(a).multiplyScalar(.5);tri(a,ac,ea,n-1);tri(ac,c,ce,n-1);tri(ea,ce,e,n-1);tri(ac,ce,ea,n-1);}else{const mid=a.clone().add(c).add(e).multiplyScalar(1/3);for(const [p,q]of [[a,c],[c,e],[e,a]])vertices.push(p.x,roof(p),p.y,q.x,roof(q),q.y,mid.x,roof(mid)+.28,mid.y);}}
   for(let i=0;i<ix.count;i+=3){const q=[0,1,2].map(k=>new T.Vector2(pos.getX(ix.getX(i+k)),pos.getY(ix.getX(i+k))));tri(q[0],q[1],q[2],2);}mesh(vertices,'frame');
   const nodes:{p:T.Vector2;low:T.Vector3;high:T.Vector3}[]=[];
   for(let x=-25.8;x<27;x+=10.5)for(let z=-15.7;z<17;z+=10.5){const p=new T.Vector2(x,z);if(!inside(p))continue;const low=new T.Vector3(x,roof(p)+.1,z),high=new T.Vector3(x,roof(p)+3.4,z);nodes.push({p,low,high});rod(low,high,.09,'dark');add(new T.IcosahedronGeometry(.16,0),'dark',high.x,high.y,high.z);}
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],c=nodes[j],distance=a.p.distanceTo(c.p);if(distance>11.0)continue;rod(a.low,c.low,.1,'white');rod(a.high,c.low,.035,'dark');rod(c.high,a.low,.035,'dark');}
   // Broad structural rods and narrow mullions follow real boundary edges.
   for(let i=0;i<r.length;i++)rod(new T.Vector3(r[i].x,5.85,r[i].y),new T.Vector3(r[(i+1)%r.length].x,5.85,r[(i+1)%r.length].y),.11,'white');
  }else{
   body(6.45,'stone');wallGrid(6.45,2.9,true);hip(0,6.45,0,29,7.8,3.2,0,'slate');
   for(let x of [-10,10]){box(x,8.0,0,.9,2.25,1.1,'brick');box(x,10.25,0,1.25,.2,1.4,'stone');}for(let s of [-1,1])box(0,6.0,s*3.9,29,.4,.4,'white');
  }
 }
}
