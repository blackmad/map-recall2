import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sites from './amsterdam-school-footprints.json';

/** Polygon-based original meshes, in survey metres with +X east / +Z south.
 * Shared apartment party walls are excluded from façade decoration, retaining
 * both the triangular block and its genuine open courtyards at Het Schip. */
export function buildAmsterdamSchoolLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,hip}=b,site=sites.sites.find(s=>s.id===id)!;
 const shipping=id==='scheepvaarthuis',longitude=111320*Math.cos(site.anchor[1]*Math.PI/180);
 const coord=(p:number[])=>new T.Vector2((p[0]-site.anchor[0])*longitude,-(p[1]-site.anchor[1])*110540);
 const polygons=site.buildings.flatMap(f=>f.geometry.coordinates.map(poly=>({f,rings:poly.map(r=>r.slice(0,-1).map(coord))})));
 function contains(p:T.Vector2,ring:T.Vector2[]){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a.y>p.y)!==(c.y>p.y)&&p.x<(c.x-a.x)*(p.y-a.y)/(c.y-a.y)+a.x)hit=!hit;}return hit;}
 function panel(x:number,y:number,z:number,w:number,h:number,angle:number){
  box(x,y,z,w,h,.17,'glass',angle);
  box(x,y,z,.11,h,.26,shipping?'gold':'white',angle);
  for(let v of [0,h*.5,h])box(x,y+v,z,w+.18,.11,.26,shipping?'gold':'white',angle);
 }
 function mapped(poly:typeof polygons[number],height:number,colour:'brick'|'red'|'slate'|'dark'){
  const shape=new T.Shape(poly.rings[0]);shape.holes=poly.rings.slice(1).map(r=>new T.Path(r));
  const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,colour);
  const roof=new T.ShapeGeometry(shape);roof.rotateX(Math.PI/2);add(roof,shipping?'slate':'red',0,height+.025,0);
 }
 for(const poly of polygons){
  const f=poly.f,p=f.properties as Record<string,unknown>,tagHeight=Number(p.height),isShed=!p.height;
  const total=shipping?27:(tagHeight||2.8),body=shipping?23.2:Math.max(2.4,total-(isShed?0:3.1));
  mapped(poly,body,'brick');
  const ring=poly.rings[0];let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length];area+=a.x*c.y-c.x*a.y;}
  for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],dx=c.x-a.x,dz=c.y-a.y,L=Math.hypot(dx,dz);if(L<2.5)continue;
   const sign=area<0?-1:1,nx=sign*dz/L,nz=-sign*dx/L,mid=new T.Vector2((a.x+c.x)/2+nx*.4,(a.y+c.y)/2+nz*.4);
   if(polygons.some(other=>other!==poly&&contains(mid,other.rings[0])&&!other.rings.slice(1).some(h=>contains(mid,h))))continue;
   const angle=-Math.atan2(dz,dx),step=shipping?4.1:4.6;
   for(let u=step*.52;u<L-.9;u+=step){
    const x=a.x+u*dx/L+nx*.2,z=a.y+u*dz/L+nz*.2;
    for(let y=shipping?1.2:1.7;y<body-1;y+=shipping?5:3.3)panel(x,y,z,shipping?1.45:1.6,shipping?3.65:1.95,angle);
    if(shipping){box(x-step*.44,0,z, .28,24,.45,'stone',angle);box(x,22.7,z,2.2,.24,.5,'stone',angle);}
    else if(body>8){box(x,body-.6,z,2,.2,.4,'white',angle);}
   }
   if(!isShed&&L>6){
    // Roof strips follow the polygon walls instead of capping the whole block.
    const roof=new T.BufferGeometry(),depth=shipping?7.2:6,height=shipping?4.5:3.1;
    const v=[[-L/2,0,-depth/2],[L/2,0,-depth/2],[-L/2,0,depth/2],[L/2,0,depth/2],[-L/2,height,0],[L/2,height,0]];
    roof.setAttribute('position',new T.Float32BufferAttribute([0,4,5,0,5,1,2,3,5,2,5,4,0,2,4,1,5,3].flatMap(i=>v[i]),3));roof.computeVertexNormals();
    add(roof,shipping?'slate':'red',(a.x+c.x)/2-nx*depth*.43,body-.15,(a.y+c.y)/2-nz*depth*.43,angle);
    if(shipping)for(let u=4;u<L-3;u+=7.3){const x=a.x+u*dx/L-nx*.8,z=a.y+u*dz/L-nz*.8;box(x,24,z,2.3,2.5,1.2,'slate',angle);panel(x+nx*.67,24.2,z+nz*.67,1.6,1.6,angle);}
   }
   if(!isShed){box((a.x+c.x)/2+nx*.1,.55,(a.y+c.y)/2+nz*.1,L,.65,.3,'dark',angle);}
  }
 }
 if(shipping){
  const corner=coord([4.903829,52.374708]);
  // High, faceted prow at the confluence of the two long façades.
  add(new T.CylinderGeometry(4.2,5.1,31.2,8),'brick',corner.x,15.6,corner.y);
  for(let y of [1.5,7,12.5,18,23.5])for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=corner.x+4.9*Math.sin(a),z=corner.y+4.9*Math.cos(a);
   panel(x,y,z,1.45,3.7,a);box(x,y-1,z,1.8,.3,.7,'stone',a);
  }
  add(new T.CylinderGeometry(4.8,4.8,.65,8),'stone',corner.x,31.2,corner.y);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=corner.x+4.1*Math.sin(a),z=corner.y+4.1*Math.cos(a);box(x,30.1,z,.7,2.4,.7,'stone');}
  hip(corner.x,31.6,corner.y,8.5,8.5,2.3,'slate');
  // Three flag masts and geometric stone maritime figure reliefs.
  for(let i of [-1,0,1]){box(corner.x+i*2.6,33.4,corner.y,.13,5.5,.13,'frame');box(corner.x+i*2.6+.65,37.6,corner.y,1.3,.7,.1,i===0?'white':'red');}
  const entrance=coord([4.904237,52.374539]);
  box(entrance.x,0,entrance.y,4.2,4.4,.35,'gold',-.85);box(entrance.x,4.4,entrance.y,5.4,.55,1.7,'stone',-.85);
  for(let s of [-1,1]){const x=entrance.x+s*2.3,z=entrance.y+s*2;box(x,0,z,.75,6.6,.7,'stone');add(new T.IcosahedronGeometry(.6,0),'stone',x,7.1,z);box(x,5.2,z,1.3,.5,.7,'stone');}
 }else{
  // Hembrugstraat's ornamental sword-like tile spire is deliberately nonfunctional.
  const tower=coord([4.87316,52.390558]);
  box(tower.x,5.5,tower.y,3.8,5.6,4,'red');box(tower.x,10.4,tower.y,4.7,1.4,4.9,'red');
  hip(tower.x,11.8,tower.y,4.6,4.8,14.4,'red');box(tower.x,26.2,tower.y,.09,2.5,.09,'frame');
  for(let y=6;y<11.7;y+=.4)for(let s of [-1,1])box(tower.x,y,tower.y+s*2.12,4.2,.065,.12,'brick');
  // Rounded tiled corner bay at the narrow southeastern ship's bow.
  const bow=coord([4.874248,52.389911]);
  add(new T.CylinderGeometry(2.3,2.7,9.5,12),'brick',bow.x,4.75,bow.y);
  for(let y of [1.8,5])for(let i=0;i<8;i++){const a=i*Math.PI/4,x=bow.x+2.45*Math.sin(a),z=bow.y+2.45*Math.cos(a);panel(x,y,z,1.1,1.8,a);}
  add(new T.ConeGeometry(2.8,2.2,12),'red',bow.x,10.6,bow.y);
  // Curved oriel windows at the western rounded housing corner.
  const oriel=coord([4.872823,52.390461]);
  add(new T.CylinderGeometry(1.7,1.7,13.1,12),'brick',oriel.x,6.55,oriel.y);
  for(let y of [2.0,5.4,8.8])for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=oriel.x+1.76*Math.sin(a),z=oriel.y+1.76*Math.cos(a);
   panel(x,y,z,1.05,2.3,a);box(x,y-.17,z,1.2,.22,.27,'white',a);
  }
  add(new T.CylinderGeometry(2,2,.25,12),'red',oriel.x,13.2,oriel.y);
  // Sculptural raised chimneys punctuate the low tiled roofline.
  for(const point of [[4.87288,52.39049],[4.87348,52.39074],[4.87375,52.39007]]){const p=coord(point);box(p.x,12,p.y,2,5.2,2.3,'brick');box(p.x,17.2,p.y,2.2,.25,2.5,'stone');}
 }
}
