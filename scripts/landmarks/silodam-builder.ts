import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './silodam-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Layers stand >= 4 cm apart (patch .05, window frame .10, glass .15, strip glass .13, bars from .20 up): 2-3 cm bled the white wall through glass at 900 m+.
 * Original native-scale collage, rebuilt from MVRDV exterior photographs and Wikimedia Commons photographs (CC BY 2.0 / CC BY-SA 3.0 / CC0).
 * The imported SketchUp thumbnail is a reference only; no model is imported.
 *
 * Native frame: +x runs SSE along the slab (164.8 deg), +z faces WSW (the dam side), -z ENE (the open IJ).
 * The slab is three BAG panden, one 131 m x 20 m block (2026-11-10; until then only the northern 65 m was modelled and
 * the southern half drew as two plain tile boxes, "half of silodam seems unfinished"):
 *   0363100012149391 (OSM w57864184 + parts)  x -32.7..32.7  north half on white piles, low glazed public wing to the east
 *   0363100012187517 (OSM w274024358)         x  32.7..64.9  on blue raked steel piers, underside 6 m
 *   0363100012187451                          x  64.9..98.1  the land end, orange container base from the ground
 * Materials (spec materialOverrides): gold = the yellow sections, ochre = the orange base and bands, pink = the pale blue
 * cladding, brick = the weathered timber, red = the oxide-red galleries. */
export function buildSilodam(_w:number,_d:number,{add,box}:BuildingTools){
 const a=data.authorHeadingDegrees*Math.PI/180;
 const local=(p:number[])=>{const e=(p[0]-data.anchor[0])*111320*Math.cos(data.anchor[1]*Math.PI/180),n=(p[1]-data.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const part=(id:number)=>data.buildings.find(f=>f.properties['@id']===id)!.geometry.coordinates[0][0].slice(0,-1).map(local);
 const housing=part(1038324509),publicWing=part(1038324510);
 function shell(r:T.Vector2[],bottom:number,top:number,c:Colour){const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:top-bottom,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);add(g,c);}
 shell(housing,2,29,'white');shell(publicWing,3,7,'glass');shell(part(1038324511),0,1,'stone');
 // Southern panden (BAG lod0 in this frame: z -0.1..19.9). Pier-borne middle from 6 m, land end from the ground.
 box(48.8,6,9.9,32.3,23,20.0,'white');box(81.5,0,9.9,33.1,29,20.0,'white');
 function lid(r:T.Vector2[],y:number,c:Colour){const g=new T.ShapeGeometry(new T.Shape(r));g.rotateX(Math.PI/2);add(g,c,0,y,0);}
 lid(housing,29.14,'slate');lid(publicWing,7.12,'slate');box(65.5,29.0,9.9,65.2,.14,19.9,'slate');
 // All facade routines use horizontal u, vertical y and a plane normal.
 function elevation(x:number,z:number,angle:number){
  const tx=Math.cos(angle),tz=-Math.sin(angle),nx=Math.sin(angle),nz=Math.cos(angle);
  const p=(u:number,off=0)=>({x:x+u*tx+nx*off,z:z+u*tz+nz*off});
  function panel(u:number,y:number,w:number,h:number,c:Colour,off=.05){const q=p(u,off);add(new T.PlaneGeometry(w,h),c,q.x,y+h/2,q.z,angle);}
  function bar(u:number,y:number,w:number,h:number,c:Colour='white',off=.14){const q=p(u,off);box(q.x,y,q.z,w,h,.13,c,angle);}
  function window(u:number,y:number,w:number,h:number,double=false,frame:Colour='white'){panel(u,y-.10,w+.20,h+.20,frame,.10);panel(u,y,w,h,'glass',.15);bar(u,y,.075,h,frame,.22);if(double)bar(u,y+h*.50,w,.075,frame,.27);bar(u,y+.85,w,.045,'frame',.25);}
  function strip(l:number,r:number,y:number,h:number,frame:Colour='dark',railing=false){panel((l+r)/2,y,r-l,h,'glass',.13);bar((l+r)/2,y-.08,r-l,.13,frame,.21);bar((l+r)/2,y+h-.04,r-l,.13,frame,.21);for(let u=l;u<r+.01;u+=1.64)bar(u,y,.085,h,frame,.27);if(railing){bar((l+r)/2,y+.93,r-l,.065,'frame',.44);for(let u=l;u<r;u+=1.64)bar(u,y,.045,.97,'frame',.44);}}
  function patch(l:number,r:number,y:number,h:number,c:Colour,mode:'pair'|'tall'|'gallery'|'grid'|'metal'|'band'='pair',frame?:Colour){
   panel((l+r)/2,y,r-l,h,c);
   if(mode==='metal'){for(let u=l+.20;u<r;u+=.35)panel(u,y,.035,h,c,.15);return;}
   if(mode==='gallery'){for(let v=y+.33;v+1.9<y+h+.02;v+=2.70)strip(l+.08,r-.08,v,1.90,frame??(c==='red'?'dark':'frame'),true);return;}
   if(mode==='grid'){strip(l+.08,r-.08,y+.12,h-.24,frame??'white');for(let v=y+1.35;v<y+h;v+=1.35)bar((l+r)/2,v,r-l,.08,frame??'white');return;}
   // One continuous ribbon of windows per storey in a coloured spandrel band (the orange, red and blue bands of the IJ elevation).
   if(mode==='band'){for(let v=y+.45;v+1.5<y+h;v+=2.70)strip(l+.25,r-.25,v,1.5,frame??'white');return;}
   const step=mode==='tall'?4.0:4.25,rows=mode==='tall'?5.40:2.70,winHeight=mode==='tall'?4.52:Math.min(1.76,h-.70);
   for(let v=y+.55;v+winHeight<y+h+.02;v+=rows)for(let u=l+step/2;u<r-step*.30;u+=step)window(u,v,mode==='tall'?3.32:2.48,winHeight,mode==='tall',frame??(c==='gold'?'gold':'white'));
   if(c==='frame'||c==='stone')for(let v=y+.20;v<y+h;v+=.31)panel((l+r)/2,v,r-l,.025,'white',.10);
  }
  return{patch,window,strip,bar,panel};
 }
 const west=elevation(0,20.10,0),east=elevation(0,-.25,Math.PI);
 // West (dam side), northern pand: four legible neighbourhoods, with the yellow double-height block
 // and continuous reddish galleries shown in the architect's harbour view.
 west.patch(-32.75,-16.4,2,3.15,'ochre','metal');west.strip(-31.8,-17.4,2.62,2.12,'dark');
 west.patch(-32.75,-16.4,5.15,8.15,'white','tall');west.patch(-32.75,-16.4,13.30,3.0,'white','grid');
 west.patch(-32.5,-16.4,16.30,7.65,'red','gallery');west.patch(-32.5,-16.4,23.95,2.20,'dark','gallery');west.patch(-32.75,-16.4,26.15,2.85,'frame','band');
 west.patch(-16.4,.0,2,5.0,'dark','gallery');west.patch(-16.4,.0,7,5.4,'white','grid');west.patch(-16.4,.0,12.4,5.4,'red','tall');west.patch(-16.4,.0,17.8,5.4,'white','grid');west.patch(-16.4,.0,23.2,5.8,'stone');
 west.patch(0,16.4,2,5.0,'dark','gallery');west.patch(0,16.4,7,5.4,'pink','grid');west.patch(0,16.4,12.4,5.4,'white','tall');west.patch(0,16.4,17.8,8.2,'gold','tall');west.patch(0,16.4,26,3,'dark','gallery');
 // The pale-blue section with its oxide-red balcony storey and timber base (Commons 30300083435, 30300084485).
 west.patch(16.4,32.70,2,3.15,'brick','metal');west.strip(17.2,22.7,2.70,1.85,'dark');west.strip(25.2,31.8,2.70,1.85,'dark');
 west.patch(16.4,32.70,5.15,2.7,'brick');west.patch(16.4,32.70,7.85,5.4,'red','pair','white');west.patch(16.4,32.70,13.25,13.5,'pink','pair');west.patch(16.4,32.70,26.75,2.25,'stone');
 // West, southern panden (Commons 29669349363, 30300085505 deck views): grey and timber over the blue piers, then the
 // timber-clad land end with the yellow-framed glass box above it.
 west.patch(32.7,64.9,6,5.4,'white','grid');west.patch(32.7,64.9,11.4,5.4,'brick','pair');west.patch(32.7,48.8,16.8,8.1,'gold','tall');west.patch(48.8,64.9,16.8,8.1,'frame','pair');west.patch(32.7,64.9,24.9,4.1,'red','gallery');
 west.patch(64.9,98.1,0,3.2,'ochre','metal');west.strip(66,97,.6,1.9,'dark');
 west.patch(64.9,98.1,3.2,5.4,'white','grid');west.patch(64.9,98.1,8.6,8.1,'brick','pair');west.patch(64.9,81.5,16.7,8.1,'gold','tall');west.patch(81.5,98.1,16.7,8.1,'frame','pair');west.patch(64.9,98.1,24.8,4.2,'stone','pair');
 // East (open IJ), from the long elevation in Commons 'Silodam Amsterdam (15224999649)': u = -x on this face.
 // North pand, north quarter: white grid storeys, red-orange band, white, oxide band, glass with blue squares, timber top.
 east.patch(0,16.4,2,5,'white','grid');east.patch(0,16.4,7,3,'white','grid');east.patch(0,16.4,10,4,'ochre','band');east.patch(0,16.4,14,5,'white','pair');east.patch(0,16.4,19,3,'red','band');east.patch(0,16.4,22,4,'pink','grid','dark');east.patch(0,16.4,26,3,'brick','pair');
 east.patch(16.4,32.75,2,5,'white','grid');east.patch(16.4,32.75,7,3,'white','grid');east.patch(16.4,32.75,10,4,'red','band');east.patch(16.4,32.75,14,5,'white','pair');east.patch(16.4,32.75,19,3,'red','band');east.patch(16.4,32.75,22,4,'dark','gallery');east.patch(16.4,32.75,26,3,'brick','pair');
 // North pand, south quarter: white with windows, a pale blue band, the orange band continuing south, yellow top.
 east.patch(-16.4,0,7,3,'white','grid');east.patch(-16.4,0,10,2,'dark','gallery');east.patch(-16.4,0,12,3,'ochre','band');east.patch(-16.4,0,15,2,'white','grid');east.patch(-16.4,0,17,2,'pink','band');east.patch(-16.4,0,19,7,'white','pair');east.patch(-16.4,0,26,3,'gold','pair','white');
 east.patch(-32.7,-16.4,7,3,'white','grid');east.patch(-32.7,-16.4,10,2,'dark','gallery');east.patch(-32.7,-16.4,12,3,'ochre','band');east.patch(-32.7,-16.4,15,4,'pink','band');east.patch(-32.7,-16.4,19,7,'white','pair');east.patch(-32.7,-16.4,26,3,'gold','pair','white');
 // Middle pand: open under the slab, white/dark grid storeys, orange band, white, two storeys of yellow-framed glass, grey glazed roof storey.
 east.patch(-64.9,-32.7,6,4,'white','grid','dark');east.patch(-64.9,-32.7,10,2,'dark','gallery');east.patch(-64.9,-32.7,12,3,'ochre','band');east.patch(-64.9,-32.7,15,3,'white','grid');east.patch(-64.9,-32.7,18,6,'gold','grid','gold');east.patch(-64.9,-32.7,24,5,'frame','grid','frame');
 // Land end: orange container base, white grid, grey cladding with windows, oxide-red bands, grey, yellow top storey.
 east.patch(-98.1,-64.9,0,3.2,'ochre','metal');east.strip(-97,-66,.6,1.9,'dark');
 east.patch(-98.1,-64.9,3.2,5.4,'white','grid');east.patch(-98.1,-64.9,8.6,10.8,'frame','pair');east.patch(-98.1,-64.9,19.4,4.6,'red','band');east.patch(-98.1,-64.9,24,2.4,'frame','pair');east.patch(-98.1,-64.9,26.4,2.6,'gold','pair','white');
 // Short ends. The south (land) end keeps the orange base, grid, the green-blue glass grid, timber bands and yellow top
 // (Commons 'Mvrdv silodam.jpg', 29669318103); the north end stands on its white piles over the IJ.
 {const f=elevation(98.15,10.0,Math.PI/2);f.patch(-10,10,0,3.2,'ochre','metal');for(const u of [-5.5,5.5])f.window(u,.65,4.2,1.9,false,'dark');f.patch(-10,10,3.2,2.7,'white','grid');f.patch(-10,10,5.9,5.4,'frame','pair');f.patch(-10,10,11.3,5.4,'pink','grid','white');f.patch(-10,10,16.7,5.4,'white','pair');f.patch(-10,10,22.1,4.3,'brick','band');f.patch(-10,10,26.4,2.6,'gold','pair','white');}
 {const f=elevation(-33.05,10.0,-Math.PI/2);f.patch(-9.8,9.8,2,2.7,'white','grid');f.patch(-9.8,9.8,4.7,5.4,'white','grid');f.patch(-9.8,9.8,10.1,5.4,'white','tall');f.patch(-9.8,9.8,15.5,5.4,'frame');f.patch(-9.8,9.8,20.9,5.4,'red','gallery');f.patch(-9.8,9.8,26.3,2.7,'stone');}
 // Original piles and public office/balcony stand within their mapped parts.
 for(let x=-31.8;x<32.8;x+=5.4)for(const z of [1.0,19.0])box(x,0,z,.62,2,.62,'white');
 for(let x=1.3;x<32.8;x+=5.5)for(const z of [-19.2,-1.0])box(x,0,z,.46,3,.46,'frame');
 // Middle pand: raked blue steel tube piers in V pairs under concrete pier caps (Commons 30153585085).
 function tube(ax:number,ay:number,az:number,bx:number,by:number,bz:number,r:number,c:Colour){const v=new T.Vector3(bx-ax,by-ay,bz-az),g=new T.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));add(g,c,(ax+bx)/2,(ay+by)/2,(az+bz)/2);}
 for(let x=35.4;x<64;x+=5.4)for(const z of [1.6,18.2]){box(x,4.9,z,2.8,1.1,1.6,'concrete');for(const s of [-1,1])tube(x+s*1.3,.02,z,x+s*.45,4.9,z,.34,'blue');}
 const office=elevation(16.45,-20.18,Math.PI);office.strip(-15.7,15.7,3.15,3.58,'white');
 const side=elevation(32.76,-10.10,Math.PI/2);side.strip(-9.2,9.2,3.15,3.58,'white');
 for(const z of [-20.10,-.50]){box(16.45,7.85,z,32.3,.085,.12,'frame');for(let x=.8;x<32.4;x+=1.9)box(x,7.14,z,.075,.78,.075,'frame');}box(32.6,7.85,-10.1,.12,.085,19.7,'frame');
 // Slender rooftop parapet stays below the 29.4 m cap, now along the whole 131 m slab.
 for(const z of [.05,19.93])box(32.7,29.15,z,131.0,.18,.13,'frame');for(const x of [-32.7,98.05])box(x,29.15,9.95,.13,.18,19.8,'frame');
}
