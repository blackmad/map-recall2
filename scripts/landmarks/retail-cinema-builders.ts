import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import footprints from './retail-cinema-footprints.json';
import specs from './retail-cinema-specs.json';
/** Original street facades; narrow Rialto is rotated onto +X, others face +Z. */
export function buildRetailCinemaLandmark(id:string,w:number,d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const turn=id==='rialto'?Math.PI/2:0,fw=id==='rialto'?d:w,dep=id==='rialto'?w:d;
 function add(g:T.BufferGeometry,c:C,x=0,y=0,z=0){g.translate(x,y,z);g.rotateY(turn);b.add(g,c);}
 function box(x:number,y:number,z:number,a:number,h:number,c:number,colour:C){add(new T.BoxGeometry(a,h,c),colour,x,y+h/2,z);}
 function win(x:number,y:number,z:number,a:number,h:number){box(x,y-.15,z,a+.3,h+.3,.18,'stone');box(x,y,z+.15,a,h,.15,'dark');box(x,y,z+.28,.09,h,.08,'white');for(let v=h/3;v<h;v+=h/3)box(x,y+v,z+.28,a,.09,.08,'white');}
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
  const ring=f.ring.map(coord),shape=new T.Shape(ring);const g=new T.ExtrudeGeometry(shape,{depth:9.2,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,9.2,0);add(g,'brick');const roof=new T.ShapeGeometry(shape);roof.rotateX(Math.PI/2);add(roof,'slate',0,9.25,0);
  const a=12.1,x=-w/2+a/2+.5,z=d/2-.5;box(x,0,z-3,a,17.8,6,'brick');box(x,17.8,z-3,a+.2,.45,6.3,'slate');box(x,0,z+.1,a*.84,4.4,.4,'slate');box(x,0,z+.36,a*.71,3.4,.2,'glass');
  for(const u of [-a*.24,0,a*.24]){win(x+u,5.4,z+.13,a*.2,3.2);win(x+u,10.2,z+.06,a*.18,3.3);}for(let i=0;i<6;i++)win(x+(i-2.5)*a*.14,14.6,z+.06,a*.1,1.95);
  box(x,8.8,z+.24,a*.77,.3,.6,'stone');box(x,16.7,z+.21,a+.15,.35,.7,'stone');text('KRITERION',x,3.65,z+.57,.16,'red');for(const u of [-a*.4,a*.4])box(x+u,15.3,z+.3,.1,5.2,.1,'white');
 }else if(id==='de-bijenkorf'){
  // The long surveyed block includes the northern extension. Historic Dam /
  // Damrak fronts occupy its southern end, with pilasters and a steep roof.
  const old=w*.61,cx=w*.195,z=d/2;box(cx,0,0,old,22.5,d*.97,'stone');box(-w*.31,0,0,w*.37,24.5,d*.96,'stone');box(-w*.31,24.5,0,w*.38,.45,d*.98,'slate');
  const v=[[-old/2,0,-d/2],[old/2,0,-d/2],[old/2,0,d/2],[-old/2,0,d/2],[-old*.38,9.5,-d*.17],[old*.38,9.5,-d*.17],[old*.38,9.5,d*.17],[-old*.38,9.5,d*.17]],f=[0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5];const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(f.flatMap(i=>v[i]),3));roof.computeVertexNormals();add(roof,'slate',cx,22.5,0);
  for(const side of [-1,1]){const zz=side*z;for(const y of [.5,4.8,9.1,13.4,17.7,22])box(cx,y,zz,old+.2,.38,.5,'stone');for(let x=cx-old/2+2.7;x<cx+old/2;x+=5.4){box(x,.4,zz+.01,4.25,21.8,.12,'brick');box(x-2.4,.4,zz,.55,22,.55,'stone');for(const y of [.6,4.9,9.2,13.5,17.8])win(x,y,zz+.08,3.65,3.65);}}

  for(const x of [-w*.46,-w*.36,-w*.26,-w*.16])for(const y of [1,6,11,16,21])win(x,y,z+.05,6.4,3.7);
  // Broad central cartouche and curved pediment on the long Damrak elevation.
  const px=w*.22;box(px,0,z+.4,18.5,22.5,1.1,'stone');for(const x of [px-5.9,px,px+5.9])for(const y of [.6,4.9,9.2,13.5,17.8])win(x,y,z+1.03,4.2,3.65);
  let s=new T.Shape();s.moveTo(-10,0);s.lineTo(10,0);s.quadraticCurveTo(0,8,-10,0);s.closePath();add(new T.ExtrudeGeometry(s,{depth:1.1,bevelEnabled:false,curveSegments:10}),'stone',px,22.5,z+.1);add(new T.CylinderGeometry(1.4,1.4,.2,20).rotateX(Math.PI/2),'white',px,25.1,z+1.3);text('DE BIJENKORF',px,20,z+1.33,.42,'white');
  // Mapped roof towers: w751128381 reaches 48m, w751128382 reaches39m.
  const source=footprints.find(f=>f.id===id)!,anchor=specs.find(s=>s.id===id)!.footprint.centre,theta=(specs.find(s=>s.id===id)!.footprint.headingDegrees+180)*Math.PI/180;
  for(const part of source.parts??[]){let height=Number(part.tags.height);if(height<39)continue;const points=part.ring.map(([lng,lat])=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*111320;return [e*Math.sin(theta)+n*Math.cos(theta),e*Math.cos(theta)-n*Math.sin(theta)];}),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),tx=(Math.min(...xs)+Math.max(...xs))/2,tz=(Math.min(...zs)+Math.max(...zs))/2,tw=Math.max(...xs)-Math.min(...xs),td=Math.max(...zs)-Math.min(...zs),base=height>=48?39:32;
   box(tx,base,tz,tw,height-3-base,td,'stone');if(height>=48){let dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);dome.scale(tw/2,3,td/2);add(dome,'slate',tx,height-3,tz);for(const zz of [-td/2,td/2])win(tx,40,tz+zz,tw*.45,3.8);}else{box(tx,38.7,tz,tw+.4,.3,td+.4,'stone');for(const xx of [-tw/2,tw/2])for(let zz=-td/2;zz<=td/2;zz+=1.1)box(tx+xx,37.6,tz+zz,.16,1.1,.16,'stone');}
  }

  // Historic mansard dormers, pale coping and the green iron balcony rhythm.
  for(let x=cx-old*.36;x<=cx+old*.36;x+=old*.15){box(x,25.2,z-2.5,2.8,2.7,2.4,'stone');win(x,25.4,z-1.22,1.8,2.2);b.hip(x,27.9,z-2.5,3,2.7,1.1,'slate');}
  for(const y of [8.9,13.2]){box(px,y,z+1.35,5.8,.28,1.5,'stone');box(px,y+.85,z+2.05,5.8,.13,.13,'frame');for(let x=px-2.7;x<=px+2.7;x+=.38)box(x,y+.25,z+2.05,.07,.6,.07,'frame');}

  // Retail glazing on the Dam short frontage and curved balcony rails.
  for(let u=-d*.4;u<d*.42;u+=5.4){for(const y of [.6,4.9,9.2,13.5,17.8]){box(w/2+.06,y,u,.2,3.8,3.7,'dark');box(w/2+.2,y+2,u,.13,.1,3.7,'stone');}}
 }else throw new Error(`No retail/cinema builder for ${id}`);
}
