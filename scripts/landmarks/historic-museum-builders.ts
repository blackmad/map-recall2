import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './historic-museum-footprints.json';

/** Original Amstelhof and Burgerweeshuis meshes with their real open courts. */
export function buildHistoricMuseumLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,prism,sign}=b,site=data.sites.find(s=>s.id===id)!,hart=id==='hart-museum',heading=162.7*Math.PI/180;
 const lngScale=111320*Math.cos(site.anchor[1]*Math.PI/180);
 const point=(p:number[])=>{const e=(p[0]-site.anchor[0])*lngScale,n=(p[1]-site.anchor[1])*110540;return new T.Vector2(e*Math.sin(heading)+n*Math.cos(heading),e*Math.cos(heading)-n*Math.sin(heading));};
 const polygons=site.buildings[0].geometry.coordinates.map(poly=>poly.map(r=>r.slice(0,-1).map(point)));
 const rings=polygons.flat(),height=hart?10:10.6;
 function geometry(vertices:number[],colour:'slate'|'stone'|'brick'){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,colour);}
 function panel(x:number,y:number,z:number,width:number,h:number,angle:number,blind=false){const nx=Math.sin(angle),nz=Math.cos(angle);if(hart){box(x,y,z,width+.22,h+.22,.16,'stone',angle);box(x+nx*.13,y+.12,z+nz*.13,width,h,.2,blind?'dark':'glass',angle);}else{add(new T.PlaneGeometry(width+.22,h+.22),'stone',x,y+(h+.22)/2,z,angle);add(new T.PlaneGeometry(width,h),blind?'dark':'glass',x+nx*.035,y+.12+h/2,z+nz*.035,angle);}if(!blind){box(x+nx*.26,y+.13,z+nz*.26,.09,h,.12,'white',angle);for(let yy of [h*.33,h*.66])box(x+nx*.25,y+.12+yy,z+nz*.25,width,.08,.12,'white',angle);}}
 /** Rewinds roof triangles so every face normal points up (the hip slopes were half downward-facing). */
 function upward(v:number[]){for(let i=0;i<v.length;i+=9){const ax=v[i+3]-v[i],az=v[i+5]-v[i+2],bx=v[i+6]-v[i],bz=v[i+8]-v[i+2];if(az*bx-ax*bz<0)for(let k=0;k<3;k++){const t=v[i+3+k];v[i+3+k]=v[i+6+k];v[i+6+k]=t;}}return v;}
 /** Gabled roof with its ridge along z (x centre xc, z0..z1; eave heights ea at -x, ec at +x), slate slopes and ends. */
 function gableRoofZ(xc:number,z0:number,z1:number,width:number,ea:number,ec:number,ridge:number){const a=xc-width/2,c=xc+width/2,v=[a,ea,z0, xc,ridge,z0, xc,ridge,z1, a,ea,z0, xc,ridge,z1, a,ea,z1, c,ec,z0, c,ec,z1, xc,ridge,z1, c,ec,z0, xc,ridge,z1, xc,ridge,z0, a,ea,z0, c,ec,z0, xc,ridge,z0, a,ea,z1, xc,ridge,z1, c,ec,z1];geometry(upward(v),'slate');}
 function hip(x:number,y:number,z:number,length:number,width:number,rise:number,angle=0){const vertices:number[]=[],ridge=Math.max(0,(length-width)/2);const xyz=(a:number,h:number,c:number)=>[x+a*Math.cos(angle)+c*Math.sin(angle),h,z-a*Math.sin(angle)+c*Math.cos(angle)];for(let side of [-1,1]){vertices.push(...xyz(-length/2,y,side*width/2),...xyz(length/2,y,side*width/2),...xyz(ridge,y+rise,0),...xyz(-length/2,y,side*width/2),...xyz(ridge,y+rise,0),...xyz(-ridge,y+rise,0));vertices.push(...xyz(side*length/2,y,-width/2),...xyz(side*length/2,y,width/2),...xyz(side*ridge,y+rise,0));}geometry(upward(vertices),'slate');}
 for(const poly of polygons){const shape=new T.Shape(poly[0]);shape.holes=poly.slice(1).map(r=>new T.Path(r));const body=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});body.rotateX(Math.PI/2);body.translate(0,height,0);add(body,'brick');
  // H'ART: no slate cap. It lay 1 cm over the brick body's own top face across the whole footprint (4,700 m2 of
  // brick/slate z-fighting wherever a viewer looked down past the hip eaves) and is fully covered by the hip roofs.
  if(!hart){const floor=new T.ShapeGeometry(shape);floor.rotateX(Math.PI/2);add(floor,'slate',0,height+.01,0);}
  // The normal follows each real exterior/courtyard edge. Small cadastral
  // offsets are left undecorated so windows stay on genuine wall planes.
  for(let ri=0;ri<poly.length;ri++){const r=poly[ri];let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;
   for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],v=c.clone().sub(a),length=v.length();if(length<3.1)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar((area>0?1:-1)*(ri? -1:1)),angle=Math.atan2(n.x,n.y),count=Math.max(1,Math.round(length/(hart?3.05:3.5)));
    const mid=a.clone().add(c).multiplyScalar(.5);for(let y of [0.45,height-.55])box(mid.x+n.x*.12,y,mid.y+n.y*.12,length,.24,.25,'stone',angle);
    for(let k=0;k<count;k++){const q=a.clone().addScaledVector(v,length*(k+.5)/count).addScaledVector(n,.12);for(let y of hart?[1.0,4.1,7.2]:[1.25,5.8])panel(q.x,y,q.y,hart?1.3:1.6,hart?2.05:2.6,angle,hart&&ri===0&&Math.abs(q.x)<5&&q.y>37);}
   }
  }
 }
 if(hart){
  // Four piles enclose a real 56 × 50m garden. The deeper side ranges have
  // paired parallel roofs rather than one pyramid stretched across the wing.
  for(let z of [34.4,-25.0])hip(0,10,z,102.2,9.6,4.5);
  // Side wings: paired gabled roofs running between the two range ridges, so their gable ends are buried in the
  // range roofs. Until 2026-10-10 they were 68.5 m hips overlapping the ranges' corners: their +z/-z hip ends lay
  // within centimetres of the long range slopes at the shared front/rear eaves, and the outer slopes within
  // centimetres of the range end hips - a z-fighting band along the long Amstel roof seen from above.
  // The outer pair sits 0.08 m lower at the street eave only, so the range end hips stay clearly above it.
  for(const [x,ea,ec] of [[-45.45,9.92,10],[-34.05,10,10],[34.1,10,10],[45.5,10,9.92]] as const)gableRoofZ(x,-25.0,34.4,11.4,ea,ec,14.5);
  // Lower service/entrance annex on the eastern garden side.
  hip(0,10,-33.8,38.8,8.3,3.0);box(0,10,-38.6,9,1.6,3.5,'brick');hip(0,11.6,-38.6,9,3.6,2.0);
  const front=40.55;
  box(0,0,front,12,10.0,2.7,'brick');for(let x of [-5.1,5.1])box(x,.2,front+1.38,.55,10.2,.28,'stone');
  box(0,10,front+.3,14,.4,3.7,'stone');prism(0,10.4,front+1.8,14,.4,5,'stone');prism(0,10.65,front+2.03,12.7,.12,4.1,'brick');
  box(0,0,front+1.43,3.7,2.8,.2,'dark');box(0,3.35,front+1.46,2.8,3.4,.18,'stone');box(0,3.52,front+1.64,2.3,3.1,.16,'dark');
  box(0,7.6,front+1.48,4.1,.35,.3,'stone');sign('HART',0,8.25,front+1.65,.17,'stone');
  // Twin sweeping stair ramps leave the lower entrance visible between them.
  for(let side of [-1,1]){for(let k=0;k<12;k++)box(side*(2.3+(11-k)*.33),k*.265,front+3.3, .42,.27,3.2,'stone');box(side*2.4,3.18,front+2.8,1.0,.2,3.0,'stone');for(let k=0;k<12;k++)box(side*(2.3+(11-k)*.33),k*.265+.65,front+4.65,.075,.85,.075,'dark');}
  for(let x of [-6,6])box(x,4.2,front+1.6,1.15,2.5,.15,'red');
  // Brick chimneys and evenly spaced dormers break the long Amstel roofline.
  for(let x of [-41,-25,-10,10,25,41]){box(x,12.1,35.0,1.25,3.2,1.3,'brick');box(x,15.3,35,1.55,.25,1.55,'stone');}
  for(let x of [-34,-17,17,34]){box(x,11.4,37.8,2.0,2.0,1.5,'stone');box(x,11.65,38.6,1.3,1.35,.2,'glass');prism(x,13.4,38.6,2.1,1.9,.8,'slate');}
  // The original courtyard's low planting beds remain inside its hole.
  for(let z of [-13,20])for(let x of [-18,18])box(x,.05,z,11,.35,5,'stone');
 }else{
  // The irregular historic piles enclose a genuine courtyard and retain the
  // street openings. A clipped roof follows every wing, never filling its
  // court or stretching neighbouring houses into the museum.
  function nearest(q:T.Vector2){let best=Infinity;for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],v=r[(i+1)%r.length].clone().sub(a),t=T.MathUtils.clamp(q.clone().sub(a).dot(v)/v.lengthSq(),0,1);best=Math.min(best,q.distanceTo(a.clone().addScaledVector(v,t)));}return best;}
  for(const poly of polygons){const shape=new T.Shape(poly[0]);shape.holes=poly.slice(1).map(r=>new T.Path(r));const g=new T.ShapeGeometry(shape),pos=g.getAttribute('position'),idx=g.index!,vertices:number[]=[];
   function tri(a:T.Vector2,c:T.Vector2,e:T.Vector2,n:number){if(n){let ac=a.clone().add(c).multiplyScalar(.5),ce=c.clone().add(e).multiplyScalar(.5),ea=e.clone().add(a).multiplyScalar(.5);tri(a,ac,ea,n-1);tri(ac,c,ce,n-1);tri(ea,ce,e,n-1);tri(ac,ce,ea,n-1);}else for(let p of [a,c,e])vertices.push(p.x,height+.04+Math.min(nearest(p)*1.05,4.8),p.y);}
   for(let i=0;i<idx.count;i+=3){const a=[0,1,2].map(k=>new T.Vector2(pos.getX(idx.getX(i+k)),pos.getY(idx.getX(i+k))));tri(a[0],a[1],a[2],3);}geometry(vertices,'slate');
  }
  const hole=polygons[0][1];
  // The Boys' Gallery has pale columns and semicircular masonry arches.
  let wall=hole.map((p,i)=>({a:p,c:hole[(i+1)%hole.length]})).sort((a,c)=>c.a.distanceTo(c.c)-a.a.distanceTo(a.c))[0];let v=wall.c.clone().sub(wall.a),length=v.length();v.normalize();let n=new T.Vector2(-v.y,v.x),angle=Math.atan2(n.x,n.y);
  for(let k=0;k<Math.floor(length/3.3);k++){let q=wall.a.clone().addScaledVector(v,(k+.5)*length/Math.floor(length/3.3)).addScaledVector(n,.35);box(q.x,0,q.y,.35,4.4,.35,'stone');const arch=new T.TorusGeometry(1.4,.18,4,10,Math.PI);add(arch,'stone',q.x+v.x*1.6,3.05,q.y+v.y*1.6,angle);}
  // Surveyed boundary-derived dormers and chimney pots on the broad piles.
  for(const r of polygons.map(p=>p[0]))for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],v=c.clone().sub(a),length=v.length();if(length<11)continue;v.normalize();const n=new T.Vector2(v.y,-v.x),angle=Math.atan2(-n.x,-n.y);for(let k=0;k<Math.floor(length/12);k++){let q=a.clone().addScaledVector(v,length*(k+.5)/Math.floor(length/12)).addScaledVector(n,2.5);box(q.x,12.4,q.y,1.9,1.55,1.7,'stone',angle);panel(q.x-n.x*.88,12.55,q.y-n.y*.88,1.2,1.2,angle);const cap=new T.ConeGeometry(1.4,.85,4);cap.rotateY(angle+Math.PI/4);add(cap,'slate',q.x,14.38,q.y);}}
  for(let [x,z]of [[-27,1],[-17,-40],[15,47],[15,-46]]){box(x,12.3,z,1.3,4.0,1.5,'brick');box(x,16.3,z,1.7,.3,1.9,'stone');for(let dx of [-.35,.35])box(x+dx,16.6,z,.27,.55,.32,'dark');}
  // A small classic gate inside the northern access court, with the museum's
  // name in real geometric lettering and an ornamental stone crest.
  const q=point(site.entrance.coordinates),face=(162.7+90-site.entrance.facingDegrees)*Math.PI/180;
  // Its position is the Kalverstraat endpoint of mapped museum passage
  // w266904065, not the footprint's bounding-box front.
  const gate=(u:number,y:number,v:number,width:number,h:number,depth:number,c:'stone'|'dark')=>box(q.x+u*Math.cos(face)+v*Math.sin(face),y,q.y-u*Math.sin(face)+v*Math.cos(face),width,h,depth,c,face);
  gate(0,0,0,6.6,5.2,.65,'stone');gate(0,.1,.38,3.6,3.5,.18,'dark');gate(0,5.2,0,7.0,.35,.85,'stone');
  const crest=new T.Shape();crest.moveTo(-2.9,0);crest.lineTo(2.9,0);crest.lineTo(0,1.7);crest.closePath();add(new T.ExtrudeGeometry(crest,{depth:.4,bevelEnabled:false}),'stone',q.x+Math.sin(face)*.2,5.55,q.y+Math.cos(face)*.2,face);
  for(let u of [-2.5,2.5]){gate(u,.4,.42,.32,4.7,.26,'stone');gate(u,4.85,.45,.7,.3,.36,'stone');}
  for(let u of [-1.25,0,1.25]){gate(u,5.55,.45,.35,.9,.3,'stone');add(new T.IcosahedronGeometry(.26,0),'stone',q.x+u*Math.cos(face)+Math.sin(face)*.5,6.75,q.y-u*Math.sin(face)+Math.cos(face)*.5);}
  const letters=['10001/11011/10101/10101/10001/10001/10001','10001/10001/10001/10001/10001/10001/01110','01111/10000/10000/01110/00001/00001/11110','11111/10000/10000/11110/10000/10000/11111','10001/10001/10001/10001/10001/10001/01110','10001/11011/10101/10101/10001/10001/10001'];
  for(let i=0;i<letters.length;i++)for(let [r,row]of letters[i].split('/').entries())for(let c=0;c<row.length;c++)if(row[c]==='1')gate((i*6+c-17.5)*.105,4.3+(6-r)*.105,.5,.105,.105,.1,'dark');
 }
}
