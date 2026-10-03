import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './hallen-house-footprints.json';
import specs from './hallen-house-specs.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed architecture, including depot courtyard recesses and curved canal frontage. */
export function buildHallenHouseLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,spec=specs.find(s=>s.id===id)!,source=sources.find(s=>s.id===id)!;
 const anchor=spec.footprint.centre,h=(90+spec.surveyed.northOffsetDegrees)*Math.PI/180;
 const coord=([lng,lat]:number[])=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));};
 const roofZ=(x:number,y:number,z:number,w:number,d:number,rise:number,c:C)=>{const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[0,rise,-d/2],[0,rise,d/2]],f=[0,4,5,0,5,2,1,3,5,1,5,4,0,1,4,2,5,3];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(f.flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);};
 const rings=source.parts.flatMap(p=>p.polygons.map(poly=>poly.map(r=>r.map(coord))));
 const body=(rr:T.Vector2[][],height:number,c:C)=>{const shape=new T.Shape(rr[0]);for(const hole of rr.slice(1))shape.holes.push(new T.Path(hole));const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,c);};
 const plane=(r:T.Vector2[],height:(p:T.Vector2)=>number,c:C)=>{if(r.length<3)return;const g=new T.ShapeGeometry(new T.Shape(r));const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const p=new T.Vector2(pos.getX(i),pos.getY(i));pos.setXYZ(i,p.x,height(p),p.y);}g.computeVertexNormals();add(g,c);};
 const clip=(r:T.Vector2[],axis:'x'|'y',value:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ain=more?a[axis]>=value:a[axis]<=value,cin=more?c[axis]>=value:c[axis]<=value;if(ain)out.push(a.clone());if(ain!==cin){const t=(value-a[axis])/(c[axis]-a[axis]);out.push(a.clone().lerp(c,t));}}return out;};
 const region=(r:T.Vector2[],x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(r,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 if(id==='de-hallen'){
  const ring=rings[0][0];body(rings[0],7.2,'brick');plane(ring,()=>7.22,'slate');
  // Six long original depot halls; the first is a broad double-bay shed.
  const edges=[-51.1,-31.6,-22,-12.4,-2.8,6.8,16.4];
  for(let j=0;j<edges.length-1;j++){
   const lo=edges[j],hi=edges[j+1],mid=(lo+hi)/2,half=(hi-lo)/2,height=(p:T.Vector2)=>7.25+3.35*(1-Math.abs(p.y-mid)/half);
   for(const [z0,z1] of [[lo,mid],[mid,hi]])plane(region(ring,-100,52,z0,z1),height,j===0?'slate':'red');
   // Long glazed ridge lights, split into individual panes by steel cross ribs.
   for(const [z0,z1] of [[mid-1.3,mid],[mid,mid+1.3]])plane(region(ring,-100,52,z0,z1),p=>height(p)+.06,'glass');
   const roof=region(ring,-100,52,lo,hi);if(!roof.length)continue;const xmin=Math.min(...roof.map(p=>p.x));
   box((xmin+52)/2,10.57,mid,52-xmin,.12,.1,'frame');
   for(let x=xmin+1;x<51;x+=3)for(const dir of [-1,1]){const g=new T.BoxGeometry(.1,.07,1.43);g.rotateX(dir*Math.atan(3.35/half));add(g,'frame',x,10.15,mid+dir*.68);}
   // Bellamyplein stepped ends are clipped from the surveyed outline.
   const frontx=xmin+.06,cols=j===0?5:3;for(let k=0;k<cols;k++){const z=lo+(k+.5)*(hi-lo)/cols;box(frontx,1.1,z,.18,4.8,(hi-lo)/cols-1.1,'glass');for(let y=2;y<6;y+=1.1)box(frontx-.12,y,z,.08,.09,(hi-lo)/cols-1.1,'frame');box(frontx-.12,1.1,z-(hi-lo)/cols/2+.55,.08,4.8,.1,'frame');}
   // Gable masonry closes each triangular roof end without flattening its silhouette.
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([frontx,7.2,lo,frontx,10.6,mid,frontx,7.2,hi],3));g.computeVertexNormals();add(g,'brick');
  }
  // The historic traverse hall runs across the site, linking both public entrances.
  const centre=60.5,half=8.8,rise=2.8,passHeight=(p:T.Vector2)=>7.25+rise*(1-Math.abs(p.x-centre)/half);
  for(const [x0,x1] of [[centre-half,centre],[centre,centre+half]])plane(region(ring,x0,x1,-100,100),passHeight,'red');
  for(const [x0,x1] of [[centre-1.2,centre],[centre,centre+1.2]])plane(region(ring,x0,x1,-100,100),p=>passHeight(p)+.06,'glass');
  for(let z=-50;z<51;z+=3)box(centre,10.02,z,2.4,.1,.1,'frame');
  // West-side hotel/workshop wings retain the large open courtyard cut-out.
  for(const [z0,z1] of [[16.4,33.7],[33.7,51.1]]){const mid=(z0+z1)/2,hh=(z1-z0)/2;for(const [a,c] of [[z0,mid],[mid,z1]])plane(region(ring,-100,51.7,a,c),p=>7.22+2.6*(1-Math.abs(p.y-mid)/hh),'slate');for(const [a,c] of [[mid-1,mid],[mid,mid+1]])plane(region(ring,-100,51.7,a,c),p=>7.27+2.6*(1-Math.abs(p.y-mid)/hh),'glass');}
  // White acoustic/plant enclosures visible in the architect's aerial.
  for(const [x,z,w,d] of [[20,-10,22,15],[37,-27,18,14],[36,3,13,12]]){box(x,8,z,w,3.1,d,'white');box(x,11.1,z,w+.2,.15,d+.2,'slate');for(const dx of [-w*.25,w*.25]){const g=new T.BoxGeometry(3.4,.12,2.6);g.rotateX(-.22);add(g,'glass',x+dx,11.4,z);}}
  // Tollensstraat and Ten Katestraat entrances, opposite ends of the cross passage.
  for(const [z,dir] of [[-51, -1],[50.9,1]]){const x=60.2;box(x,0,z,12.8,8.2,.35,'brick');box(x,0,z+dir*.23,5.3,4.7,.1,'dark');const a=new T.Shape();a.moveTo(-2.65,0);a.lineTo(2.65,0);a.lineTo(2.65,2.85);a.absarc(0,2.85,2.65,0,Math.PI,false);a.lineTo(-2.65,0);add(new T.ShapeGeometry(a),'glass',x,0,z+dir*.35,dir<0?Math.PI:0);for(const dx of [-3.3,3.3])box(x+dx,0,z+dir*.28,.6,5.5,.3,'stone');box(x,5.5,z+dir*.28,7,.45,.3,'stone');box(x,6.45,z+dir*.28,8,.9,.24,'stone');if(dir>0)sign('DE HALLEN',x,6.58,z+.5,.12,'dark');}
  // Courtyard-facing brick arcade.
  for(let x=-20;x<45;x+=5.5){box(x,1.2,16.45,3.2,3.7,.13,'glass');for(const dx of [-1.7,1.7])box(x+dx,.2,16.5,.3,6.7,.2,'stone');}
 }else if(id==='huis-bartolotti'){
  for(const rr of rings){body(rr,13.1,'brick');plane(rr[0],()=>13.12,'slate');}
  // Broad Renaissance front bends gently with the canal; small wings retain the split house plan.
  const front=(x:number)=>14.6+.014*(x+6)**2,tilt=(x:number)=>-Math.atan(.028*(x+6));
  const fb=(x:number,y:number,w:number,hh:number,c:C,out=0,depth=.2)=>box(x,y,front(x)+out,w,hh,depth,c,tilt(x));
  for(let x=-9.35;x<5.8;x+=.78)fb(x,0,.82,13.3,'brick',0,.3);
  // Pale horizontal stringcourses, Tuscan/Ionic pilasters and individual sash glazing.
  for(const y of [.35,4.45,8.65,12.7])for(let x=-9.35;x<5.8;x+=.78)fb(x,y,.82,.24,'stone',.2);
  const bays=[-8.7,-6.8,-4.9,-3,-1.1,.8,2.7,4.6];
  for(const x of bays){for(const [y,hh] of [[.8,3.15],[5,3.05],[9.25,2.9]]){fb(x,y,1.5,hh+.35,'stone',.2);fb(x,y+.16,1.22,hh,'glass',.34,.09);for(const dx of [-.4,0,.4])fb(x+dx,y+.16,.06,hh,'white',.4,.06);for(let yy=y+.65;yy<y+hh;yy+=.65)fb(x,yy,1.25,.065,'white',.4,.065);}for(const y of [.65,4.8,9.1]){fb(x-.85,y,.24,3.6,'stone',.32);fb(x-.85,y+3.5,.5,.2,'stone',.39);}}
  for(const x of [-1.05,1.8]){fb(x,0,1.2,2.8,'dark',.4);fb(x,2.8,1.55,.32,'stone',.48);}
  // Central stepped scroll gable, contrasting sandstone caps and broken pediment.
  const gx=-1.8,gz=front(gx),steps=[[13.3,11.2,1.9],[15.2,8.8,1.65],[16.85,6.4,1.8],[18.65,3.5,1.55],[20.2,2.6,1.1]];
  for(const [y,ww,hh] of steps){box(gx,y,gz,ww,hh,.48,'brick');box(gx,y+hh-.18,gz+.23,ww+.55,.2,.7,'stone');for(const dx of [-ww/2,ww/2]){box(gx+dx,y,gz+.28,.33,hh,.45,'stone');add(new T.SphereGeometry(.27,8,4),'stone',gx+dx,y+hh+.13,gz+.28);}}
  for(const [y,ww,hh] of [[13.8,1.85,1.9],[17.1,1.1,1.25],[19.1,.85,.95]])for(const x of y===13.8?[gx-2.25,gx,gx+2.25]:[gx]){box(x,y,gz+.3,ww+.28,hh+.25,.25,'stone');box(x,y+.14,gz+.46,ww,hh,.06,'glass');box(x,y+.14,gz+.51,.075,hh,.06,'white');}
  const pedestal=21.3;box(gx,pedestal,gz,.9,.42,.65,'stone');add(new T.SphereGeometry(.29,8,4),'stone',gx,pedestal+.7,gz);box(gx,pedestal+.92,gz,.15,.45,.15,'stone');
  // Two small side dormers, steep long tiled roofs and separate rear house volumes.
  for(const x of [-8.5,4.75]){box(x,13.25,front(x)-1.15,2.45,2.4,2.7,'brick');box(x,13.6,front(x)+.28,1.25,1.55,.08,'glass');roofZ(x,15.65,front(x)-1.15,2.65,3,1.6,'slate');}
  for(const [x,z,w,d] of [[-5.8,0,7.7,28],[2.3,-.1,7.8,29.5]])roofZ(x,13.15,z,w,d,5.3,'slate');
  // The owner's history records a four-storey 1755 rear house; preserve its recessed contour.
  const rear=region(rings[1][0],4,20,-20,-3);if(rear.length>2){body([rear],17.8,'brick');plane(rear,()=>17.85,'slate');}
  // Inscriptions are suggested by stone plaques and geometry rather than raster textures.
  for(const x of [-6,3.3]){fb(x,12.25,2.9,.75,'stone',.34);for(let dx=-1.1;dx<=1.1;dx+=.27)fb(x+dx,12.55,.12,.15,'dark',.48,.05);}
 }else throw new Error(`No Hallen/house builder for ${id}`);
}
