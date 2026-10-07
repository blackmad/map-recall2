import * as T from 'three';
import {buildKcriterionNativeScope} from './kriterion-native-scope';
import {addKcriterionFrontLettering} from './kriterion-front-lettering';
import type {BuildingTools} from './cultural-builders';
import footprints from './retail-cinema-footprints.json';
import specs from './retail-cinema-specs.json';
/** Original street facades; narrow Rialto is rotated onto +X, others face +Z. */
export function buildRetailCinemaLandmark(id:string,w:number,d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const turn=id==='rialto'?Math.PI/2:0,fw=id==='rialto'?d:w,dep=id==='rialto'?w:d;
 function add(g:T.BufferGeometry,c:C,x=0,y=0,z=0){g.translate(x,y,z);g.rotateY(turn);b.add(g,c);}
 function box(x:number,y:number,z:number,a:number,h:number,c:number,colour:C){add(new T.BoxGeometry(a,h,c),colour,x,y+h/2,z);}
 function win(x:number,y:number,z:number,a:number,h:number,emit=box){emit(x,y-.15,z,a+.3,h+.3,.18,'stone');emit(x,y,z+.15,a,h,.15,'dark');emit(x,y,z+.28,.09,h,.08,'white');for(let v=h/3;v<h;v+=h/3)emit(x,y+v,z+.28,a,.09,.08,'white');}
 function text(t:string,x:number,y:number,z:number,p:number,c:C){if(!turn){b.sign(t,x,y,z,p,c);return;}const glyph:Record<string,string[]>={R:['110','101','110','101','101'],I:['111','010','010','010','111'],A:['010','101','111','101','101'],L:['100','100','100','100','111'],T:['111','010','010','010','010'],O:['111','101','101','101','111']};let u=x-t.length*4*p/2;for(const ch of t){const rows=glyph[ch];if(rows)for(let j=0;j<5;j++)for(let k=0;k<3;k++)if(rows[j][k]==='1')box(u+k*p,y+(4-j)*p,z,p*.8,p*.8,.08,c);u+=4*p;}}
 if(id==='rialto'){
  // Compact cinema behind the white Art Deco front, five vertical window slots.
  box(0,0,0,fw*.98,13.9,dep*.97,'brick');box(0,13.9,0,fw,.3,dep,'slate');const z=dep/2;
  box(0,0,z-.45,fw,15.9,.9,'white');box(0,15.9,z-.45,fw+.25,.35,1,'white');
  for(const x of [-fw*.46,fw*.46]){box(x,0,z+.12,.42,16.3,.3,'white');for(let y=13;y<16;y+=.8)box(x,y,z+.33,1,.3,.4,'stone');}
  for(let i=0;i<5;i++){let x=(i-2)*fw*.135;box(x,7.25,z+.08,fw*.074,5.1,.2,'dark');for(const y of [8.85,10.55])box(x,y,z+.23,fw*.074,.11,.12,'frame');box(x-fw*.06,7.1,z+.23,.26,5.4,.33,'white');}
  text('RIALTO',0,13.1,z+.33,.33,'red');box(0,3.35,z+.6,fw*.8,3.15,1.15,'glass');box(0,3.45,z+1.2,fw*.82,1.15,.2,'dark');for(let y=3.58;y<4.5;y+=.23)box(0,y,z+1.34,fw*.77,.045,.04,'white');
  box(0,3.25,z+.6,fw*.87,.25,1.35,'stone');for(const x of [-fw*.3,0,fw*.3]){box(x,.15,z+.16,fw*.19,2.9,.2,'dark');box(x,.5,z+.29,fw*.14,1.8,.08,'glass');}for(const x of [-fw*.43,fw*.43])box(x,.5,z+.35,.8,2.4,.3,'stone');
 }else if(id==='kriterion'){
  // Surveyed irregular auditorium outline; the tall Roetersstraat house is a
  // narrow bay at its southern end, rather than a facade stretched across it.
  const s=specs.find(s=>s.id===id)!,f=footprints.find(f=>f.id===id)!,anchor=s.footprint.centre,heading=(s.footprint.headingDegrees+180)*Math.PI/180;
  const coord=([lng,lat]:number[])=>{let e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*111320;return new T.Vector2(e*Math.sin(heading)+n*Math.cos(heading),e*Math.cos(heading)-n*Math.sin(heading));};
  const ring=f.ring.map(coord);buildKcriterionNativeScope(b);
  const a=12.1,x=-w/2+a/2+.5,z=d/2-.5;
  // The source street chain is slightly oblique to the bounding-box axes.
  // Put every tier on that same surveyed plane; the lower panes used to sit
  // inside the auditorium extrusion while their thinner mullions protruded.
  const p=ring[11],q=ring[13],angle=-Math.atan2(q.y-p.y,q.x-p.x),ca=Math.cos(angle),sa=Math.sin(angle);
  const streetZ=p.y+(x-p.x)*(q.y-p.y)/(q.x-p.x);
  function facadeBox(px:number,y:number,pz:number,ww:number,hh:number,dd:number,c:C){
   const u=px-x,v=pz-z,g=new T.BoxGeometry(ww,hh,dd);g.rotateY(angle);
   add(g,c,x+u*ca+v*sa,y+hh/2,streetZ-u*sa+v*ca);
  }
  // Current concrete plinth and asymmetric glazed entrance, rather than a single billboard pane.
  facadeBox(x,0,z+.10,a*.90,5.25,.24,'concrete');
  const shop=x-a*.11,shopWidth=a*.56,door=x+a*.34,doorWidth=a*.15;
  facadeBox(shop,.2,z+.34,shopWidth,3.3,.14,'glass');
  facadeBox(door,0,z+.34,doorWidth,3.55,.14,'glass');
  for(const [center,width] of [[shop,shopWidth],[door,doorWidth]]){
   for(const side of [-1,1])facadeBox(center+side*width/2,0,z+.44,.10,3.55,.10,'white');
   for(const y of [.2,1.45,2.55,3.5])facadeBox(center,y,z+.44,width,.09,.10,'white');
  }
  for(const u of [-shopWidth/6,shopWidth/6])facadeBox(shop+u,.2,z+.44,.08,3.3,.10,'white');
  for(const u of [-a*.24,0,a*.24]){win(x+u,5.4,z+.13,a*.2,3.2,facadeBox);win(x+u,10.2,z+.06,a*.18,3.3,facadeBox);}for(let i=0;i<6;i++)win(x+(i-2.5)*a*.14,14.6,z+.06,a*.1,1.95,facadeBox);
  facadeBox(x,8.8,z+.24,a*.77,.3,.6,'stone');facadeBox(x,16.7,z+.21,a+.15,.35,.7,'stone');
  // Current municipal photo: thin fabricated caps with red fronts/gold relief.
  addKcriterionFrontLettering(b,new T.Vector3(x+.24*sa,3.65,streetZ+.24*ca),angle,6.1,.78);
  for(const u of [-a*.4,a*.4])facadeBox(x+u,15.3,z+.3,.1,5.2,.1,'white');
 }else if(id==='de-bijenkorf'){
  buildBijenkorfNative(b);
 }else throw new Error(`No retail/cinema builder for ${id}`);
}

/** Native surveyed reconstruction; the historic front occupies the ENTIRE
 * Damrak frontage, while the 1937/1979 additions sit behind it. Current AHN
 * roof envelope calibrates heights, not a mesh source. All geometry is original. */
function buildBijenkorfNative(b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];type P=[number,number];
 const f=footprints.find(f=>f.id==='de-bijenkorf')!,s=specs.find(s=>s.id==='de-bijenkorf')!;
 const anchor=s.surveyed!.anchor,h=(s.surveyed!.northOffsetDegrees+90)*Math.PI/180;
 const coord=([lng,lat]:number[]):P=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*110540;return [e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h)];};
 // Simplify the survey's sub-centimetre ornamental curves; retain every real
 // corner/recess of the physical parent. No street or neighbouring house fill.
 const raw=f.currentBag.geometry.coordinates[0].map(coord),ring:P[]=[];
 for(let i=0;i<raw.length-1;i++){const a=raw[(i+raw.length-2)%(raw.length-1)],p=raw[i],q=raw[(i+1)%(raw.length-1)];if(Math.hypot(q[0]-a[0],q[1]-a[1])<.2||Math.abs((p[0]-a[0])*(q[1]-a[1])-(p[1]-a[1])*(q[0]-a[0]))>.018)ring.push(p);}
 const clip=(poly:P[],axis:0|1,value:number,above:boolean)=>{const out:P[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],q=poly[(i+1)%poly.length],ia=above?a[axis]>=value:a[axis]<=value,iq=above?q[axis]>=value:q[axis]<=value;if(ia)out.push(a);if(ia!==iq){const t=(value-a[axis])/(q[axis]-a[axis]);out.push([a[0]+t*(q[0]-a[0]),a[1]+t*(q[1]-a[1])]);}}return out;};
 const region=(xmin:number,xmax:number,zmin:number,zmax:number)=>clip(clip(clip(clip(ring,0,xmin,true),0,xmax,false),1,zmin,true),1,zmax,false);
 function mass(poly:P[],base:number,top:number,c:C){if(poly.length<3)return;const shape=new T.Shape(poly.map(p=>new T.Vector2(...p))),g=new T.ExtrudeGeometry(shape,{depth:top-base,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);b.add(g,c);}
 function surface(poly:P[],y:number,c:C){if(poly.length<3)return;const g=new T.ShapeGeometry(new T.Shape(poly.map(p=>new T.Vector2(...p))));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const ix=g.getIndex()!;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i);ix.setX(i,ix.getX(i+2));ix.setX(i+2,a);}g.computeVertexNormals();b.add(g,c,0,y,0);}
 function quad(points:number[][],c:C){const a=new T.Vector3(...points[0]),q=new T.Vector3(...points[1]),r=new T.Vector3(...points[2]);if(q.clone().sub(a).cross(r.clone().sub(a)).y<0)points.reverse();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));g.computeVertexNormals();b.add(g,c);}
 // Raised hipped corner pavilions and shallower connecting mansards. Their
 // roof tops follow the measured envelope; the smaller dormers remain an
 // original approximation from RCE and the owner's historic photographs.
 function mansard(x0:number,x1:number,z0:number,z1:number,y:number,top:number,inset:number){const p=[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],q=[[x0+inset,top,z0+inset],[x1-inset,top,z0+inset],[x1-inset,top,z1-inset],[x0+inset,top,z1-inset]];for(let i=0;i<4;i++)quad([p[i],p[(i+1)%4],q[(i+1)%4],q[i]],'slate');quad(q,'slate');}
 const box=b.box.bind(b);
 mass(region(-60,65,-7.35,25),0,21.6,'brick');
 mass(region(-60,65,-30,-7.35),0,21.6,'stone');
 surface(region(-60,65,-30,-7.35),21.64,'slate');
 mansard(-52.15,-27.2,-7.15,16.0,21.6,35.45,8.3);
 mansard(-27.2,-7.2,-7.15,15.5,21.6,29.15,5.2);
 mansard(-7.2,13.1,-7.15,16.1,21.6,33.3,6.2);
 mansard(13.1,34.9,-7.15,16.0,21.6,29.1,5.4);
 mansard(34.9,58.0,-7.15,16.9,21.6,35.33,8.4);
 // Covered inner light hall and rear office/service roof occupy this current
 // parent; the separately mapped parking garage is deliberately not included.
 mass(region(-26.5,-12.4,-22,-7.35),21.6,26.75,'stone');surface(region(-26.5,-12.4,-22,-7.35),26.8,'slate');
 box(-8.7,21.6,-14.6,7.0,4.7,12.4,'stone');
 mansard(-12.2,-5.2,-20.8,-8.4,26.3,27.0,1.35);
 quad([[-11.9,26.4,-20.6],[-5.5,26.4,-20.6],[-6.65,27.1,-9.6],[-10.75,27.1,-9.6]],'glass');
 for(let z=-19.8;z<-9;z+=1.6)box(-8.7,26.86,z,5.8,.09,.09,'frame');
 // Local facade coordinates support all THREE historic fronts (+Z Damrak,
 // +X Dam and -X Beursplein), including identical five-axis end elevations.
 function front(cx:number,cz:number,angle:number,width:number,count:number,raised:boolean){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const local=(x:number,z:number):P=>angle===0?[cx+x,frontZ(cx+x)+.03+z]:[cx+x*ca+z*sa,cz-x*sa+z*ca];
  const fb=(x:number,y:number,z:number,w:number,hh:number,dd:number,c:C)=>{const p=local(x,z);box(p[0],y,p[1],w,hh,dd,c,angle);};
  const glyph=(text:string,x:number,y:number,z:number,pixel:number,c:C)=>{if(angle===0){b.sign(text,cx+x,y,cz+z,pixel,c);return;} // Sign letters are authored in the same local plane, never image textures.
   const alphabet:Record<string,string[]>={D:['110','101','101','101','110'],E:['111','100','110','100','111'],B:['110','101','110','101','110'],I:['111','010','010','010','111'],J:['001','001','001','101','010'],N:['101','111','111','111','101'],K:['101','101','110','101','101'],O:['010','101','101','101','010'],R:['110','101','110','101','101'],F:['111','100','110','100','100']};let u=x-text.length*4*pixel/2;for(const ch of text){const rows=alphabet[ch];if(rows)for(let j=0;j<5;j++)for(let k=0;k<3;k++)if(rows[j][k]==='1')fb(u+k*pixel,y+(4-j)*pixel,z,pixel*.8,pixel*.8,.06,c);u+=4*pixel;}
  };
  function paired(x:number,y:number,ww:number,hh:number,z=.24){fb(x,y-.13,z-.08,ww+.26,hh+.26,.12,'stone');fb(x,y,z,ww,hh,.12,'dark');fb(x,y,z+.095,.19,hh,.12,'stone');fb(x,y+hh*.70,z+.1,ww,.10,.10,'frame');for(const dx of [-ww*.25,ww*.25])fb(x+dx,y,z+.1,.06,hh,.08,'frame');}
  const pitch=width/count;
  fb(0,0,.04,width,1.2,.28,'slate');fb(0,4.75,.08,width,.36,.43,'stone');
  fb(0,20.55,.12,width,1.05,.65,'stone');fb(0,21.6,.17,width+.25,.27,.83,'stone');
  for(let i=0;i<count;i++){const x=-width/2+pitch*(i+.5);paired(x,1.15,pitch*.76,3.42);for(const y of [6.0,11.05,16.05])paired(x,y,pitch*.69,3.62);fb(x-pitch/2,4.9,.17,.6,15.65,.57,'stone');fb(x-pitch/2,4.62,.30,.85,.35,.72,'stone');for(const y of [10.1,15.12])fb(x,y,.16,pitch*.85,.2,.27,'stone');}
  // The projecting attic and great curved cartouche distinguish pavilions
  // from the ordinary roof windows. Their walls begin above the main body.
  if(raised){
   fb(0,21.6,-.8,width,4.2,1.8,'stone');for(let i=0;i<count;i++){const x=-width/2+pitch*(i+.5);paired(x,22.15,pitch*.65,2.7,.34);fb(x-pitch/2,21.6,.37,.67,4.3,.57,'stone');}
   fb(0,25.65,.45,width+.45,.36,1.22,'stone');
   const shape=new T.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.quadraticCurveTo(width*.38,3.95,0,4.2);shape.quadraticCurveTo(-width*.38,3.95,-width/2,0);shape.closePath();
   const g=new T.ExtrudeGeometry(shape,{depth:1.05,bevelEnabled:false,curveSegments:10});g.rotateY(angle);const p=local(0,.18);b.add(g,'stone',p[0],25.9,p[1]);
   const oval=new T.CylinderGeometry(1,1,.14,18);oval.rotateX(Math.PI/2);oval.scale(1.0,1.35,1);oval.rotateY(angle);const o=local(0,1.31);b.add(oval,'white',o[0],28.0,o[1]);
   const inset=new T.CylinderGeometry(1,1,.15,18);inset.rotateX(Math.PI/2);inset.scale(.64,.9,1);inset.rotateY(angle);const oo=local(0,1.42);b.add(inset,'dark',oo[0],28.0,oo[1]);
   for(const side of [-1,1]){fb(side*2.15,27.0,1.32,1.4,.35,.18,'white');fb(side*3.18,26.55,1.32,.38,1.2,.18,'white');fb(side*(width/2-.35),25.85,.95,.56,.62,.5,'white');}
   glyph('DE BIJENKORF',0,24.9,1.36,.24,'white');
   for(const y of [10.0,15.0]){const bw=width*.34;fb(0,y,.75,bw,.25,1.7,'stone');fb(0,y+1.05,1.57,bw,.11,.13,'frame');for(let x=-bw/2;x<=bw/2;x+=.5)fb(x,y+.22,1.57,.065,.8,.1,'frame');}
  }
 }
 // Intersections with the actual front ring align ornamental skins with
 // curved/recessed survey corners rather than a single bounding rectangle.
 const frontZ=(x:number)=>{const hits:number[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length];if((a[0]<=x&&q[0]>=x)||(a[0]>=x&&q[0]<=x)){if(Math.abs(q[0]-a[0])>.001)hits.push(a[1]+(x-a[0])*(q[1]-a[1])/(q[0]-a[0]));}}return Math.max(...hits);};
 // Twenty-five paired-window bays, grouped 4/7/3/7/4 as the owner's detailed
 // original facade description; tiny carvings are deliberately simplified.
 const groups:[number,number,number,boolean][]=[[-52.15,-34.35,4,true],[-34.35,-7.4,7,false],[-7.4,13.1,3,true],[13.1,40.3,7,false],[40.3,58,4,true]];
 for(const [a,q,count,raised] of groups){const centre=(a+q)/2;front(centre,frontZ(centre)+.03,0,q-a,count,raised);}
 front(58.25,4.25,Math.PI/2,24.9,5,true);
 front(-52.35,4.0,-Math.PI/2,23.1,5,true);
 // Three curved-front mansard dormers in each long roof wing, plus small
 // round lead-clad attic lights above; no rectangular fake skylight boxes.
 function dormer(x:number,z:number){box(x,24.25,z-1.05,3.65,3.2,2.4,'stone');box(x,24.5,z+.21,2.62,2.55,.16,'dark');box(x,24.5,z+.34,.15,2.55,.13,'white');box(x,26.25,z+.34,2.6,.08,.12,'frame');
  const sh=new T.Shape();sh.moveTo(-2.12,0);sh.lineTo(2.12,0);sh.quadraticCurveTo(1.4,1.65,0,1.75);sh.quadraticCurveTo(-1.4,1.65,-2.12,0);sh.closePath();b.add(new T.ExtrudeGeometry(sh,{depth:.48,bevelEnabled:false,curveSegments:7}),'stone',x,27.4,z+.1);mansard(x-1.85,x+1.85,z-2.35,z+.18,27.45,28.7,.95);
 }
 for(const x of [-28,-20.5,-13.0,20.0,27.0,34.0])dormer(x,11.25);
 for(const x of [-39,-20,3,27,46]){const g=new T.CylinderGeometry(.62,.62,.18,12);g.rotateX(Math.PI/2);b.add(g,'stone',x,x===-39||x===46?32.25:28.25,10.2);}
 // Current measured tower heights replace obsolete 48m/39m OSM tags. The
 // central lead lantern remains the landmark's highest architectural point.
 box(3.0,29.15,10.35,6,6.75,6,'stone');box(3.0,35.9,10.35,6.5,.75,6.5,'slate');
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const ca=Math.cos(angle),sa=Math.sin(angle);for(const x of [-2.0,0,2.0]){box(3+x*ca+3.05*sa,30.05,10.35-x*sa+3.05*ca,1.28,4.7,.13,'dark',angle);box(3+x*ca+3.18*sa,31.65,10.35-x*sa+3.18*ca,1.3,.12,.15,'stone',angle);}}
 box(3,36.65,10.35,3.1,5.65,3.1,'stone');box(3,42.3,10.35,3.6,.35,3.6,'slate');
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){box(3+1.6*Math.sin(angle),37.3,10.35+1.6*Math.cos(angle),1.45,4.4,.14,'dark',angle);for(const x of [-1.3,1.3])box(3+x*Math.cos(angle)+1.7*Math.sin(angle),36.7,10.35-x*Math.sin(angle)+1.7*Math.cos(angle),.24,5.55,.24,'slate',angle);}
 const dome=new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);dome.scale(1.85,2.78,1.85);b.add(dome,'slate',3,42.65,10.35);
 for(const x of [-48,-31,39,54]){box(x,30.3,3.6,1.3,6.3,1.3,'slate');box(x,36.6,3.6,1.6,.55,1.6,'stone');}
 // Rear service elevations are restrained, distinct from the historic
 // storefront and clipped to the actual parent boundary.
 for(let x=-49;x<56;x+=5.6){const z=-20.35;for(const y of [5.8,11.05,16.1]){if(region(x-1.2,x+1.2,z-.1,z+.1).length>=3)box(x,y,z-.09,2.5,2.75,.17,'dark');}}
}
