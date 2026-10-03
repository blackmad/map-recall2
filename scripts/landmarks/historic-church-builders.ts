import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './historic-church-footprints.json';

/** Original Gothic churches: mapped chapel plans, roof ridges and clock lanterns. */
export function buildHistoricChurchLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box}=b,site=data.sites.find(s=>s.id===id)!;
 const scale=111320*Math.cos(site.anchor[1]*Math.PI/180);
 const point=(p:number[])=>new T.Vector2((p[0]-site.anchor[0])*scale,-(p[1]-site.anchor[1])*110540);
 const ring=(p:number[][])=>p.slice(0,-1).map(point);
 const parent=ring(site.parent.geometry.coordinates[0][0]);
 const parts=site.buildings.map(p=>({raw:p,points:ring(p.geometry.coordinates[0][0]),height:Number(p.properties.height),bottom:Number(p.properties.min_height??0),roof:Number(p.properties['roof:height']??0)}));
 function inside(q:T.Vector2,r:T.Vector2[]){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],p=r[j];if((a.y>q.y)!==(p.y>q.y)&&q.x<(p.x-a.x)*(q.y-a.y)/(p.y-a.y)+a.x)c=!c;}return c;}
 function solid(r:T.Vector2[],bottom:number,height:number){const shape=new T.Shape(r),g=new T.ExtrudeGeometry(shape,{depth:height-bottom,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,'brick');}
 function mesh(vertices:number[],colour:'brick'|'slate'|'stone'){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,colour);}
 function pointed(x:number,y:number,z:number,width:number,height:number,angle:number){
  function pane(width:number,height:number,depth:number,c:'stone'|'dark'){const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,height-width*.65);s.quadraticCurveTo(width*.35,height-.1,0,height);s.quadraticCurveTo(-width*.35,height-.1,-width/2,height-width*.65);s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:4}),c,x,y,z,angle);}
  pane(width,height,.15,'stone');pane(width-.36,height-.32,.22,'dark');
  const tx=Math.cos(angle),tz=-Math.sin(angle),nx=Math.sin(angle),nz=Math.cos(angle);
  for(let a of [-width*.22,0,width*.22])box(x+tx*a+nx*.26,y+.15,z+tz*a+nz*.26,.12,height-width*.7,.15,'stone',angle);
  for(let yy of [height*.37,height*.67])box(x+nx*.25,y+yy,z+nz*.25,width-.38,.12,.15,'stone',angle);
  const o=new T.TorusGeometry(width*.16,.075,4,10);add(o,'stone',x+nx*.28,y+height-width*.55,z+nz*.28,angle);
 }
 function exteriorWindows(r:T.Vector2[],bottom:number,top:number,other:typeof parts){
  for(let i=0;i<r.length;i++){const a=r[i],p=r[(i+1)%r.length],v=p.clone().sub(a),length=v.length();if(length<3)continue;v.normalize();let n=new T.Vector2(-v.y,v.x),mid=a.clone().add(p).multiplyScalar(.5);if(inside(mid.clone().addScaledVector(n,.3),r))n.multiplyScalar(-1);const angle=Math.atan2(n.x,n.y),count=Math.max(1,Math.floor(length/5.8));
   for(let k=0;k<count;k++){const q=a.clone().addScaledVector(v,length*(k+.5)/count).addScaledVector(n,.12),test=q.clone().addScaledVector(n,.7);
    if(other.some(o=>o.points!==r&&o.height-o.roof>bottom+4&&inside(test,o.points)))continue;
    const height=Math.min(10,top-bottom-2.5),width=Math.min(3.4,length/count*.58);if(height<3)continue;
    pointed(q.x,bottom+1.2,q.y,width,height,angle);
    for(let side of [-1,1]){const e=q.clone().addScaledVector(v,side*(width/2+.55));box(e.x,bottom,e.y,.7,Math.min(top-bottom-1,height+1),1.1,'stone',angle);box(e.x,top-1,e.y,.9,.35,1.3,'stone',angle);}
   }
  }
 }
 function roof(p:typeof parts[number]){
  const f=p.raw.fit,c=point(f.centre),angle=(90-f.headingDegrees)*Math.PI/180,L=f.lengthMetres+.1,W=f.widthMetres+.1,eave=p.height-p.roof,rise=p.roof;
  const xyz=(x:number,y:number,z:number)=>[c.x+x*Math.cos(angle)+z*Math.sin(angle),y,c.y-x*Math.sin(angle)+z*Math.cos(angle)];
  if(p.raw.properties['roof:shape']==='pyramidal'){
   const vertices:number[]=[];for(let i=0;i<p.points.length;i++){let a=p.points[i],q=p.points[(i+1)%p.points.length];vertices.push(a.x,eave,a.y,q.x,eave,q.y,c.x,p.height,c.y);}mesh(vertices,'slate');
  }else{
   const vertices:number[]=[],walls:number[]=[];
   if(p.raw.properties['roof:shape']==='hipped'){
    // Hip ends retain the rectangular chapel footprint and shortened ridge.
    const r=Math.max(0,(L-W)/2);
    for(let side of [-1,1]){vertices.push(...xyz(-L/2,eave,side*W/2),...xyz(L/2,eave,side*W/2),...xyz(r,eave+rise,0),...xyz(-L/2,eave,side*W/2),...xyz(r,eave+rise,0),...xyz(-r,eave+rise,0));vertices.push(...xyz(side*L/2,eave,-W/2),...xyz(side*L/2,eave,W/2),...xyz(side*r,eave+rise,0));}
   }else{
    for(let s of [-1,1]){vertices.push(...xyz(-L/2,eave,s*W/2),...xyz(L/2,eave,s*W/2),...xyz(L/2,eave+rise,0),...xyz(-L/2,eave,s*W/2),...xyz(L/2,eave+rise,0),...xyz(-L/2,eave+rise,0));walls.push(...xyz(s*L/2,eave,-W/2),...xyz(s*L/2,eave,W/2),...xyz(s*L/2,eave+rise,0));}
    mesh(walls,'brick');
    // Exposed gable ends carry a small rose window and pale verge stones.
    for(let side of [-1,1]){const q=new T.Vector2(...[xyz(side*(L/2+.08),0,0)[0],xyz(side*(L/2+.08),0,0)[2]]),face=angle+side*Math.PI/2;if(!parts.some(o=>o!==p&&o.height>eave+1&&inside(q.clone().add(new T.Vector2(Math.sin(face),Math.cos(face))),o.points))){const g=new T.CylinderGeometry(.8,.8,.16,12);g.rotateX(Math.PI/2);add(g,'stone',q.x,eave+rise*.32,q.y,face);const inset=new T.CylinderGeometry(.57,.57,.22,12);inset.rotateX(Math.PI/2);add(inset,'dark',q.x,eave+rise*.32,q.y,face);}}
   }
   mesh(vertices,'slate');
  }
 }
 // The unpartitioned parent closes any small unmapped connective spaces at
 // aisle height; all upper masses and rooflines are individual mapped parts.
 const base=id==='oude-kerk'?15:13;
 solid(parent,0,base);exteriorWindows(parent,0,base,parts);
 // A triangulated slate roof closes small unmapped sacristies and aisles,
 // using the true concave outline rather than a bounding rectangle.
 const top=new T.ShapeGeometry(new T.Shape(parent)),pos=top.getAttribute('position'),idx=top.index!;
 function distance(q:T.Vector2){let best=Infinity;for(let i=0;i<parent.length;i++){const a=parent[i],v=parent[(i+1)%parent.length].clone().sub(a),t=T.MathUtils.clamp(q.clone().sub(a).dot(v)/v.lengthSq(),0,1);best=Math.min(best,q.distanceTo(a.clone().addScaledVector(v,t)));}return best;}
 const roofVertices:number[]=[];
 function triangle(a:T.Vector2,c:T.Vector2,e:T.Vector2,level:number){if(level){const ac=a.clone().add(c).multiplyScalar(.5),ce=c.clone().add(e).multiplyScalar(.5),ea=e.clone().add(a).multiplyScalar(.5);triangle(a,ac,ea,level-1);triangle(ac,c,ce,level-1);triangle(ea,ce,e,level-1);triangle(ac,ce,ea,level-1);}else for(const p of [a,c,e])roofVertices.push(p.x,base+.03+Math.min(distance(p)*.8,4),p.y);}
 for(let i=0;i<idx.count;i+=3){const points=[0,1,2].map(n=>new T.Vector2(pos.getX(idx.getX(i+n)),pos.getY(idx.getX(i+n))));triangle(points[0],points[1],points[2],2);}mesh(roofVertices,'slate');
 for(const p of parts){if(id==='oude-kerk'&&Number(p.raw.properties['@id'])<=747868971)continue;solid(p.points,p.bottom,p.height-p.roof);if(p.roof)roof(p);exteriorWindows(p.points,p.bottom,p.height-p.roof,parts.filter(o=>o!==p));}
 if(id==='oude-kerk'){
  // OSM omits the middle of the three parallel hall roofs. Its exact ridge
  // lies halfway between the two surveyed outer nave rectangles.
  const a=parts.find(p=>p.raw.properties['@id']===747868974)!,c=parts.find(p=>p.raw.properties['@id']===747868975)!;
  const middle=JSON.parse(JSON.stringify(a)) as typeof a;middle.raw.fit.centre=[(a.raw.fit.centre[0]+c.raw.fit.centre[0])/2,(a.raw.fit.centre[1]+c.raw.fit.centre[1])/2];middle.raw.fit.widthMetres=11.7;roof(middle);
  // The polygonal east choir is absent from the mapped roof parts. Preserve
  // its actual bow-shaped outline and bring its slate cap to nave ridge level.
  const apse:T.Vector2[]=[];for(let i=0;i<parent.length;i++){const a=parent[i],c=parent[(i+1)%parent.length],ia=a.x>=27,ic=c.x>=27;if(ia)apse.push(a);if(ia!==ic)apse.push(new T.Vector2(27,a.y+(c.y-a.y)*(27-a.x)/(c.x-a.x)));}
  const cap:number[]=[];for(let i=0;i<apse.length;i++){const a=apse[i],c=apse[(i+1)%apse.length];cap.push(a.x,15,a.y,c.x,15,c.y,29,23,0);}mesh(cap,'slate');
  const tower=parts.find(p=>p.raw.properties['@id']===747868982)!,centre=point(tower.raw.fit.centre),x=centre.x,z=centre.y,angle=(90-tower.raw.fit.headingDegrees)*Math.PI/180;
  for(let y of [1,15,27.3,29.7])box(x,y,z,10.6,.35,10.6,'stone',angle);
  for(let s=0;s<4;s++){const a=angle+s*Math.PI/2,nx=Math.sin(a),nz=Math.cos(a);pointed(x+nx*5.05,15.5,z+nz*5.05,2.7,10.5,a);}
  add(new T.CylinderGeometry(5.4,7.0,3,4).rotateY(Math.PI/4+angle),'slate',x,31.5,z);
  add(new T.CylinderGeometry(4.5,4.8,8,8),'slate',x,37,z);
  for(let side=0;side<4;side++){
   const a=angle+side*Math.PI/2,nx=Math.sin(a),nz=Math.cos(a),cx=x+nx*4.65,cz=z+nz*4.65;
   const disc=new T.CylinderGeometry(2,2,.16,24);disc.rotateX(Math.PI/2);add(disc,'gold',cx,37,cz,a);const face=new T.CylinderGeometry(1.8,1.8,.22,24);face.rotateX(Math.PI/2);add(face,'dark',cx,37,cz,a);
   for(let k=0;k<12;k++){const theta=k*Math.PI/6,tx=Math.cos(a),tz=-Math.sin(a);box(cx+tx*Math.sin(theta)*1.52+nx*.25,36.82+Math.cos(theta)*1.52,cz+tz*Math.sin(theta)*1.52+nz*.25,.13,.35,.1,'gold',a);}
   box(cx+nx*.32,37,cz+nz*.32,.14,1.2,.12,'gold',a);box(cx+Math.cos(a)*.5+nx*.34,37,cz-Math.sin(a)*.5+nz*.34,1.1,.14,.12,'gold',a);
  }
  add(new T.CylinderGeometry(3.5,5.4,2.8,8),'slate',x,42.4,z);
  for(let k=0;k<8;k++){const a=k*Math.PI/4;box(x+Math.sin(a)*3.35,43.8,z+Math.cos(a)*3.35,.5,9,.5,'stone');}
  add(new T.CylinderGeometry(3.85,3.85,.55,8),'stone',x,44,z);add(new T.CylinderGeometry(3.85,3.85,.5,8),'stone',x,52.8,z);add(new T.CylinderGeometry(2.55,4.1,3,8),'slate',x,54.55,z);
  for(let k=0;k<8;k++){let a=k*Math.PI/4;box(x+Math.sin(a)*2.25,56,z+Math.cos(a)*2.25,.32,4,.32,'stone');}
  add(new T.CylinderGeometry(2.7,2.7,.45,8),'stone',x,60,z);add(new T.ConeGeometry(2.85,5.9,8),'slate',x,63.15,z);box(x,66.1,z,.12,.9,.12,'gold');add(new T.SphereGeometry(.22,8,4),'gold',x,66.8,z);
 }else{
  // The slim crossing flèche is the only spire. The west nave ends without
  // a completed great tower, matching the building seen on the Dam today.
  const a=parts.find(p=>p.raw.properties['@id']===747911439)!,c=parts.find(p=>p.raw.properties['@id']===747911441)!;
  const ac=point(a.raw.fit.centre),cc=point(c.raw.fit.centre),ah=a.raw.fit.headingDegrees*Math.PI/180,ch=c.raw.fit.headingDegrees*Math.PI/180;
  const av=new T.Vector2(Math.sin(ah),-Math.cos(ah)),cv=new T.Vector2(Math.sin(ch),-Math.cos(ch)),delta=cc.clone().sub(ac),cross=(u:T.Vector2,v:T.Vector2)=>u.x*v.y-u.y*v.x;
  const q=ac.addScaledVector(av,cross(delta,cv)/cross(av,cv));
  add(new T.CylinderGeometry(1.15,1.5,3.2,8),'slate',q.x,35.6,q.y);add(new T.ConeGeometry(1.5,8,8),'slate',q.x,41.2,q.y);box(q.x,45.2,q.y,.12,.8,.12,'gold');
 }
}
