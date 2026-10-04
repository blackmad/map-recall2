import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './silodam-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-scale collage, rebuilt from MVRDV exterior photographs.
 * The imported SketchUp thumbnail is a reference only; no model is imported. */
export function buildSilodam(_w:number,_d:number,{add,box}:BuildingTools){
 const a=data.authorHeadingDegrees*Math.PI/180;
 const local=(p:number[])=>{const e=(p[0]-data.anchor[0])*111320*Math.cos(data.anchor[1]*Math.PI/180),n=(p[1]-data.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const part=(id:number)=>data.buildings.find(f=>f.properties['@id']===id)!.geometry.coordinates[0][0].slice(0,-1).map(local);
 const housing=part(1038324509),publicWing=part(1038324510);
 function shell(r:T.Vector2[],bottom:number,top:number,c:Colour){const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:top-bottom,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);add(g,c);}
 shell(housing,2,29,'white');shell(publicWing,3,7,'glass');shell(part(1038324511),0,1,'stone');
 function lid(r:T.Vector2[],y:number,c:Colour){const g=new T.ShapeGeometry(new T.Shape(r));g.rotateX(Math.PI/2);add(g,c,0,y,0);}
 lid(housing,29.14,'slate');lid(publicWing,7.12,'slate');
 // All facade routines use horizontal u, vertical y and a plane normal.
 function elevation(x:number,z:number,angle:number){
  const tx=Math.cos(angle),tz=-Math.sin(angle),nx=Math.sin(angle),nz=Math.cos(angle);
  const p=(u:number,off=0)=>({x:x+u*tx+nx*off,z:z+u*tz+nz*off});
  function panel(u:number,y:number,w:number,h:number,c:Colour,off=.07){const q=p(u,off);add(new T.PlaneGeometry(w,h),c,q.x,y+h/2,q.z,angle);}
  function bar(u:number,y:number,w:number,h:number,c:Colour='white',off=.14){const q=p(u,off);box(q.x,y,q.z,w,h,.13,c,angle);}
  function window(u:number,y:number,w:number,h:number,double=false,frame:Colour='white'){panel(u,y-.10,w+.20,h+.20,frame,.12);panel(u,y,w,h,'glass',.15);bar(u,y,.075,h,frame,.22);if(double)bar(u,y+h*.50,w,.075,frame,.23);bar(u,y+.85,w,.045,'frame',.25);}
  function strip(l:number,r:number,y:number,h:number,frame:Colour='dark',railing=false){panel((l+r)/2,y,r-l,h,'glass',.13);bar((l+r)/2,y-.08,r-l,.13,frame,.21);bar((l+r)/2,y+h-.04,r-l,.13,frame,.21);for(let u=l;u<r+.01;u+=1.64)bar(u,y,.085,h,frame,.23);if(railing){bar((l+r)/2,y+.93,r-l,.065,'frame',.44);for(let u=l;u<r;u+=1.64)bar(u,y,.045,.97,'frame',.44);}}
  function patch(l:number,r:number,y:number,h:number,c:Colour,mode:'pair'|'tall'|'gallery'|'grid'|'metal'='pair'){
   panel((l+r)/2,y,r-l,h,c);
   if(mode==='metal'){for(let u=l+.20;u<r;u+=.35)panel(u,y,.035,h,c,.15);return;}
   if(mode==='gallery'){for(let v=y+.33;v<y+h-.8;v+=2.70)strip(l+.08,r-.08,v,1.90,c==='red'?'dark':'frame',true);return;}
   if(mode==='grid'){strip(l+.08,r-.08,y+.12,h-.24,'white');for(let v=y+1.35;v<y+h;v+=1.35)bar((l+r)/2,v,r-l,.08);return;}
   const step=mode==='tall'?4.0:4.25,rows=mode==='tall'?5.40:2.70,winHeight=mode==='tall'?4.52:Math.min(1.76,h-.70);
   for(let v=y+.55;v+winHeight<y+h+.02;v+=rows)for(let u=l+step/2;u<r-step*.30;u+=step)window(u,v,mode==='tall'?3.32:2.48,winHeight,mode==='tall');
   if(c==='frame'||c==='stone')for(let v=y+.20;v<y+h;v+=.31)panel((l+r)/2,v,r-l,.025,'white',.085);
  }
  return{patch,window,strip,bar,panel};
 }
 const west=elevation(0,20.10,0),east=elevation(0,-.25,Math.PI);
 // West: four legible neighbourhoods, with the yellow double-height block
 // and continuous reddish galleries shown in the architect's harbour view.
 west.patch(-32.75,-16.4,2,3.15,'gold','metal');west.strip(-31.8,-17.4,2.62,2.12,'dark');
 west.patch(-32.75,-16.4,5.15,8.15,'white','tall');west.patch(-32.75,-16.4,13.30,3.0,'white','grid');
 west.patch(-32.75,-16.4,16.30,7.65,'red','gallery');west.patch(-32.75,-16.4,23.95,2.20,'dark','gallery');west.patch(-32.75,-16.4,26.15,2.85,'frame');
 west.patch(-16.4,.0,2,5.0,'dark','gallery');west.patch(-16.4,.0,7,5.4,'white','grid');west.patch(-16.4,.0,12.4,5.4,'red','tall');west.patch(-16.4,.0,17.8,5.4,'white','grid');west.patch(-16.4,.0,23.2,5.8,'stone');
 west.patch(0,16.4,2,5.0,'dark','gallery');west.patch(0,16.4,7,5.4,'blue','grid');west.patch(0,16.4,12.4,5.4,'white','tall');west.patch(0,16.4,17.8,8.2,'gold','tall');west.patch(0,16.4,26,3,'dark','gallery');
 west.patch(16.4,32.70,2,3.15,'gold','metal');west.strip(17.2,22.7,2.70,1.85,'dark');west.strip(25.2,31.8,2.70,1.85,'dark');
 west.patch(16.4,32.70,5.15,2.7,'white');west.patch(16.4,32.70,7.85,2.7,'white','grid');west.patch(16.4,32.70,10.55,5.4,'white','tall');west.patch(16.4,32.70,15.95,5.4,'frame');west.patch(16.4,32.70,21.35,5.4,'red','gallery');west.patch(16.4,32.70,26.75,2.25,'stone');
 // Harbour-facing east has its own collage instead of mirroring west.
 east.patch(-32.70,-16.4,2,3.15,'gold','metal');east.strip(-31.8,-17.0,2.60,1.95,'dark');east.patch(-32.70,-16.4,5.15,10.8,'white','tall');east.patch(-32.70,-16.4,15.95,5.4,'frame');east.patch(-32.70,-16.4,21.35,5.4,'red','gallery');east.patch(-32.70,-16.4,26.75,2.25,'stone');
 east.patch(-16.4,0,2,5.4,'dark','gallery');east.patch(-16.4,0,7.4,5.4,'red','tall');east.patch(-16.4,0,12.8,5.4,'white','grid');east.patch(-16.4,0,18.2,7.5,'blue','tall');east.patch(-16.4,0,25.7,3.3,'frame');
 east.patch(0,16.4,2,5.4,'dark','gallery');east.patch(0,16.4,7.4,5.4,'frame');east.patch(0,16.4,12.8,5.4,'red','tall');east.patch(0,16.4,18.2,5.4,'white','grid');east.patch(0,16.4,23.6,5.4,'stone');
 east.patch(16.4,32.75,2,3.15,'gold','metal');east.strip(17.2,31.8,2.65,1.90,'dark');east.patch(16.4,32.75,5.15,8.15,'white','grid');east.patch(16.4,32.75,13.3,8.05,'red','gallery');east.patch(16.4,32.75,21.35,5.4,'dark','gallery');east.patch(16.4,32.75,26.75,2.25,'frame');
 // Both short ends retain the characteristic orange base, white lower glass,
 // corrugated middle and two red continuous window bands (not random floors).
 for(const [x,angle]of [[32.72,Math.PI/2],[-32.80,-Math.PI/2]]){const f=elevation(x,10.0,angle);f.patch(-10.0,10.0,2,3.15,'gold','metal');for(const u of [-5.5,5.5])f.window(u,2.65,4.2,1.9,false,'dark');f.patch(-10,10,5.15,2.7,'white');f.patch(-10,10,7.85,2.7,'white','grid');f.patch(-10,10,10.55,5.4,'white','tall');f.patch(-10,10,15.95,5.4,'frame');f.patch(-10,10,21.35,5.4,'red','gallery');f.patch(-10,10,26.75,2.25,'stone');}
 // Original piles and public office/balcony stand within their mapped parts.
 for(let x=-31.8;x<32.8;x+=5.4)for(const z of [1.0,19.0])box(x,0,z,.62,2,.62,'stone');
 for(let x=1.3;x<32.8;x+=5.5)for(const z of [-19.2,-1.0])box(x,0,z,.46,3,.46,'frame');
 const office=elevation(16.45,-20.18,Math.PI);office.strip(-15.7,15.7,3.15,3.58,'white');
 const side=elevation(32.76,-10.10,Math.PI/2);side.strip(-9.2,9.2,3.15,3.58,'white');
 for(const z of [-20.10,-.50]){box(16.45,7.85,z,32.3,.085,.12,'frame');for(let x=.8;x<32.4;x+=1.9)box(x,7.14,z,.075,.78,.075,'frame');}box(32.6,7.85,-10.1,.12,.085,19.7,'frame');
 // Slender rooftop parapet and small service boxes stay below the29.4m cap.
 for(const z of [.05,19.93])box(-.1,29.15,z,65.5,.18,.13,'frame');for(const x of [-32.7,32.55])box(x,29.15,9.95,.13,.18,19.8,'frame');
}
