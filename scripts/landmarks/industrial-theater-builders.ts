import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './industrial-theater-footprints.json';
import specs from './industrial-theater-specs.json';

/** Original industrial and neo-Renaissance venue meshes in surveyed metres. */
export function buildIndustrialTheaterLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,prism,hip,window,sign}=b,site=data.sites.find(s=>s.id===id)!,spec=specs.find(s=>s.id===id)!;
 const lngScale=111320*Math.cos(site.anchor[1]*Math.PI/180);
 function ring(points:number[][]){return points.slice(0,-1).map(p=>new T.Vector2((p[0]-site.anchor[0])*lngScale,-(p[1]-site.anchor[1])*110540));}
 function arch(x:number,y:number,z:number,width:number,height:number,angle:number,c:'brick'|'red'|'dark'){
  const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,height-width/2);s.absarc(0,height-width/2,width/2,0,Math.PI,false);s.lineTo(-width/2,0);
  add(new T.ExtrudeGeometry(s,{depth:.16,curveSegments:5,bevelEnabled:false}),c,x,y,z,angle);
 }
 if(id==='gashouder'){
  const {x,z,r}=site.circle!;
  // The masonry plinth preserves its two projecting pipe-house annexes.
  for(const poly of site.buildings[0].geometry.coordinates){const shape=new T.Shape(ring(poly[0]));shape.holes=poly.slice(1).map(h=>new T.Path(ring(h)));const g=new T.ExtrudeGeometry(shape,{depth:5,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,5,0);add(g,'brick');}
  add(new T.CylinderGeometry(r,r,8,48),'frame',x,9,z);
  const dome=new T.SphereGeometry(1,48,8,0,Math.PI*2,0,Math.PI/2);dome.scale(r,3.2,r);add(dome,'slate',x,13,z);
  for(let y of [5.05,7.05,9.05,11.05,12.95]){const ring=new T.TorusGeometry(r+.06,.075,4,48);ring.rotateX(Math.PI/2);add(ring,'dark',x,y,z);}
  for(let i=0;i<36;i++){
   const a=i*Math.PI*2/36,cx=x+(r+.12)*Math.sin(a),cz=z+(r+.12)*Math.cos(a);
   arch(cx,.2,cz,4.2,4.5,a,'red');if(i%3===0)arch(cx+Math.sin(a)*.04,.35,cz+Math.cos(a)*.04,2.25,3.8,a,'dark');
   if(i%3===0){for(let y of [1.1,2.15,3.2])box(cx+Math.sin(a)*.28,y,cz+Math.cos(a)*.28,2.2,.09,.2,'frame',a);box(cx+Math.sin(a)*.28,.4,cz+Math.cos(a)*.28,.09,3.4,.2,'frame',a);}
   box(x+(r+.15)*Math.sin(a),5,z+(r+.15)*Math.cos(a),.15,8,.18,'dark',a);
   box(x+(r+.45)*Math.sin(a),12.8,z+(r+.45)*Math.cos(a),.095,1.6,.095,'dark');
  }
  for(let y of [13.1,14.3]){const rail=new T.TorusGeometry(r+.5,.065,4,48);rail.rotateX(Math.PI/2);add(rail,'dark',x,y,z);}
  // Shallow conical lids on the two side annexes. Positions come from the
  // actual outward lobes of the building ring rather than invented wings.
  const raw=ring(site.buildings[0].geometry.coordinates[0][0]);
  const lobes=raw.filter(p=>Math.hypot(p.x-x,p.y-z)>r+1.4);
  const groups:T.Vector2[][]=[];
  for(const p of lobes){const group=groups.find(g=>g.some(a=>a.distanceTo(p)<8));if(group)group.push(p);else groups.push([p]);}
  for(const group of groups.filter(g=>g.length>3)){const cx=group.reduce((s,p)=>s+p.x,0)/group.length,cz=group.reduce((s,p)=>s+p.y,0)/group.length;add(new T.ConeGeometry(5.2,3,16),'slate',cx,6.4,cz);}
  box(x,0,z+r+.32,5,4.8,.4,'stone');arch(x,.2,z+r+.56,3.5,4.3,0,'dark');box(x,4.8,z+r+.4,5.8,.35,.8,'stone');
  sign('GASHOUDER',x,5.3,z+r+.68,.16,'dark');
 }else if(id==='stadsschouwburg'){
  const heading=spec.footprint.headingDegrees*Math.PI/180;
  const local=(p:T.Vector2)=>new T.Vector2(p.x*Math.sin(heading)-p.y*Math.cos(heading),p.x*Math.cos(heading)+p.y*Math.sin(heading));
  const polygons=site.buildings[0].geometry.coordinates.map(poly=>poly.map(r=>ring(r).map(local)));
  // Clip historic frontage and rear stage volumes along the local depth axis.
  function clip(r:T.Vector2[],side:number){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ia=a.y*side>=0,ic=c.y*side>=0;if(ia)out.push(a);if(ia!==ic)out.push(new T.Vector2(a.x+(c.x-a.x)*(-a.y)/(c.y-a.y),0));}return out;}
  for(const poly of polygons)for(const side of [-1,1]){const r=clip(poly[0],side);if(r.length<3)continue;const height=side>0?17.5:22.5,shape=new T.Shape(r);for(const hole of poly.slice(1)){const h=clip(hole,side);if(h.length>2)shape.holes.push(new T.Path(h));}const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);
   // The separate slate lid owns the upper face. The old brick cap remained
   // visible because the rotated ShapeGeometry lid had downward winding.
   const flat=g.index?g.toNonIndexed():g,p=flat.getAttribute('position'),n=flat.getAttribute('normal'),walls:number[]=[];
   for(let i=0;i<p.count;i+=3){if([0,1,2].every(k=>n.getY(i+k)>.9))continue;for(let k=0;k<3;k++)walls.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));}
   const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(walls,3));shell.computeVertexNormals();add(shell,side>0?'brick':'dark');g.dispose();if(flat!==g)flat.dispose();
   const roof=new T.ShapeGeometry(shape);roof.rotateX(Math.PI/2);const ix=roof.index!;for(let i=0;i<ix.count;i+=3){const tmp=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,tmp);}roof.computeVertexNormals();add(roof,'slate',0,height+.03,0);
  }
  const front=d/2-.4,main=w*.64;
  box(0,0,front-6,main,18.8,12,'brick');
  // Three tall round-arched foyer windows establish the central facade.
  for(let x of [-main*.28,0,main*.28]){
   window(x,7.4,front+.25,5.2,8);
   for(let dx of [-3.4,3.4]){box(x+dx,6.6,front+.3,.65,8.8,.7,'stone');box(x+dx,15.3,front+.3,.95,.45,.95,'stone');}
   box(x,6.8,front+.55,5.4,.32,1,'stone');
   for(let u=-2.5;u<=2.5;u+=.6)box(x+u,6.1,front+.6,.15,.8,.22,'stone');
  }
  for(let y of [1.0,4.4,6.7,15.7,17.2,18.5])box(0,y,front+.25,main,.32,.6,'stone');
  // A mansard behind the stone attic, with two circular dormers.
  box(0,18.8,front-6,main,3.3,10,'slate');hip(0,22.1,front-6,main,10,1.4,'slate');
  for(let x of [-main*.23,main*.23]){add(new T.CylinderGeometry(1.0,1.0,.4,12).rotateX(Math.PI/2),'frame',x,20.4,front-.7);add(new T.CylinderGeometry(.7,.7,.45,12).rotateX(Math.PI/2),'glass',x,20.4,front-.4);}
  function tower(x:number,z:number,size:number,height:number,roofHeight:number){
   box(x,0,z,size,height,size,'brick');
   for(let y of [1,4.4,6.7,15.7,height-.3])box(x,y,z,size+.5,.33,size+.5,'stone');
   for(let dx of [-size/2+.3,size/2-.3]){box(x+dx,0,z+size/2,.38,height,.4,'stone');for(let y=1.6;y<height;y+=1.4)box(x+dx,y,z+size/2,.75,.27,.42,'stone');}
   window(x,height-5.4,z+size/2+.15,size*.38,4.5);
   hip(x,height,z,size+.6,size+.6,roofHeight,'slate');
   const top=height+roofHeight;
   box(x,top,z,size*.45,.3,size*.45,'stone');
   for(let dx of [-size*.18,size*.18])for(let dz of [-size*.18,size*.18])box(x+dx,top+.3,z+dz,.3,2.8,.3,'stone');
   box(x,top+3.1,z,size*.52,.3,size*.52,'stone');hip(x,top+3.4,z,size*.47,size*.47,2,'slate');box(x,top+5.4,z,.095,2.1,.095,'frame');
  }
  for(let x of [-main*.54,main*.54])tower(x,front-3.8,6.8,22.6,7.1);
  for(let x of [-w*.43,w*.43])tower(x,front-7.2,5.1,16.8,4.2);
  box(0,0,front+.45,main*.79,4.4,.25,'glass');box(0,4.4,front+1.3,main*.91,.4,3.4,'dark');
  sign('STADSSCHOUWBURG',0,4.95,front+2.2,.18,'white');
  // A geometric central sculptural crest and roof balustrade.
  box(0,17.7,front+.45,3.8,2.2,.65,'stone');for(let x of [-1,0,1]){box(x,20,front+.5,.45,1.15,.5,'stone');add(new T.IcosahedronGeometry(.3,0),'stone',x,21.5,front+.5);}
  for(let x=-main/2;x<=main/2;x+=1.3){box(x,17.2,front+.5,.14,1.4,.25,'stone');}box(0,18.6,front+.5,main,.22,.4,'stone');
  // Rear stage house retains its industrial scale, with a glazed connector.
  box(0,22.5,-d*.25,w*.46,5,d*.27,'dark');box(0,27.5,-d*.25,w*.47,.35,d*.28,'slate');
  for(let x of [-w*.42,w*.42])box(x,8.2,-d*.14,1.0,4.8,d*.43,'glass');
 }else throw Error(`Unknown industrial theatre ${id}`);
}
