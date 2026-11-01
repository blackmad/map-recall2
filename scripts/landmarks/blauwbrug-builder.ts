// Blauwbrug (brug 236, 1883, W. Springer / B. de Greef; Rijksmonument) over the Amstel at the Waterlooplein.
// Lane landmarks-bridges-20261101 (#175). Authored in the bridge frame (bridgeFrame.ts): along = bearing 69.1°
// (ENE, Rembrandtplein → Waterlooplein), right = SSE, y = scene z. The deck top stays 6 cm under the game's ride
// surface (blauwbrug-footprints.json rideProfile); the own-ground kit body for BRU0236 is skipped where this
// model stands (src/canalRecall/ownGround/bespokeBridges.ts).
// Evidence: Gemeente Amsterdam boat panoramas TMX7316010203-000355_pano_0001_001567 (north face) and
// -000354_pano_0001_001572 (south face), CC BY 4.0; Wikimedia Commons "Blauwbrug.jpg" (M.Minderhoud, CC BY-SA 3.0)
// and "Blauwbrug amsterdam.jpg" (Jvhertum, CC BY-SA 3.0) for the pier prow and the lantern column.
import type {BuildingTools} from './cultural-builders';
import {bridgeParts,type C,type P2} from './bridge-parts';
import {offsetArc,profileZ,segmentalArc} from '../../src/canalRecall/landmarks/bridgeFrame';
import fp from './blauwbrug-footprints.json';

const W=fp.halfWidthMetres;              // face plane, metres right/left of the axis
const END=24.45;                         // abutment ends (OSM outline)
const PIER=fp.piersAlongMetres[1];       // pier centres at ±8.35
const PIER_HALF=1.5;                     // pier half-length along the axis (photo: 2.9–3 m)
const ABUT=23.1;                         // side arches spring from the abutment face here
const FOOT=-2.4;                         // under the water (−1.77): model minimum, see the catalogue's groundAltitudeMetres
const SPRING=-1.35;                      // side arches spring just above the water
const ride=fp.rideProfile as [number,number][];
/** The game's ride surface (the road is drawn here). */
const zr=(a:number)=>profileZ(ride,a);
/** The parapet line: the ride profile, eased past the deck's measured end step. */
const zs=(a:number)=>{const x=Math.abs(a);return x<=22?zr(a):zr(Math.sign(a)*22)+(1.40-zr(Math.sign(a)*22))*Math.min(1,(x-22)/(END-22));};

export function buildBlauwbrug(_w:number,_d:number,b:BuildingTools):void{
 const p=bridgeParts(b,fp.bearingDegrees,-FOOT);
 const sides=[1,-1] as const;
 const stations=(a0:number,a1:number,step=1)=>{const out:number[]=[];for(let a=a0;a<a1-1e-6;a+=step)out.push(a);out.push(a1);return out;};

 // Deck slab under the game's road surface (6 cm below the ride profile) and the central girder's soffit.
 p.sweep(-END+0.05,END-0.05,-W+0.7,W-0.7,a=>zr(a)-0.06,0.4,'concrete');
 p.sweep(-PIER+PIER_HALF,PIER-PIER_HALF,-W+0.7,W-0.7,a=>zs(a)-0.9,0.12,'slate');

 // Side arches: segmental, rise 2.35 m, stone ring with a mask keystone, the barrel soffit under them.
 const arches:[number,number][]=[[-ABUT,-PIER-PIER_HALF],[PIER+PIER_HALF,ABUT]];
 for(const [a0,a1] of arches){
  const mid=(a0+a1)/2,crown=zs(mid)-0.85,arc=segmentalArc(a0,a1,SPRING,crown,18),outer=offsetArc(a0,a1,SPRING,crown,18,0.45);
  p.soffit(arc,-W+0.7,W-0.7,'slate');
  for(const s of sides){
   const r0=s>0?W-0.7:-W,r1=s>0?W:-W+0.7;
   // Spandrel wall: open under the arch, its top under the cornice.
   const top=stations(a0,a1).reverse().map(a=>[a,zs(a)-0.05] as P2);
   p.wall([...arc,...top],r0,r1,'stone');
   // Arch ring (voussoirs) 7 cm proud of the face.
   const ringR0=s>0?W-0.02:-W-0.07,ringR1=s>0?W+0.07:-W+0.02;
   p.wall([...arc,...[...outer].reverse()],ringR0,ringR1,'stone');
   // Keystone with a sculpted head (the photos show a mask at each crown).
   p.box(mid,crown-0.1,s*(W+0.06),0.75,0.95,0.3,'stone');
   p.blob(mid,crown+0.32,s*(W+0.24),0.2,0.24,0.1,'stone',8,5);
   // The bridge is symmetric about its centre in the photos; the game's deck profile is not quite, so the spandrel
   // ornaments are placed under the lower of the two mirrored parapet heights.
   const zm=(a:number)=>Math.min(zs(a),zs(-a));
   // Spandrel openings beside each springing: three round-headed slots, then two roundels (dark, 6 cm proud).
   for(const [from,dir] of [[a0,1],[a1,-1]] as [number,number][]){
    // Extrados height: the ring's outer circle (radius R + 0.45 about the arch centre), the springing past it.
    const half=(a1-a0)/2,rise=crown-SPRING,R=(half*half+rise*rise)/(2*rise),cy=crown-R;
    const ext=(a:number)=>{const dx=a-mid,q=(R+0.45)**2-dx*dx;return q>0?Math.max(SPRING,cy+Math.sqrt(q)):SPRING;};
    for(const k of [0,1,2]){const a=from+dir*(0.55+k*0.6),lo=Math.max(ext(a),ext(a+dir*0.2))+0.3,hi=zm(a)-0.6;if(hi-lo<0.5)continue;
     p.box(a,lo,s*(W+0.03),0.34,hi-lo-0.17,0.12,'dark');p.blob(a,hi-0.17,s*(W+0.03),0.17,0.17,0.06,'dark',8,4);}
    for(const k of [0,1]){const a=from+dir*(2.4+k*0.75),lo=Math.max(ext(a),ext(a-dir*0.25))+0.15,hi=zm(a)-0.4;if(hi-lo<0.44)continue;const y=(lo+hi)/2,rad=Math.min(0.22,(hi-lo)/2-0.02);
     p.ring(a,y,s*(W+0.04),rad,0.045,'stone');p.blob(a,y,s*(W+0.02),rad-0.03,rad-0.03,0.07,'dark',8,4);}
   }
  }
 }

 // Central span: the flat girder face (concrete since 1938–39), a recessed band and four Amsterdam shields.
 for(const s of sides){
  const a0=-PIER+PIER_HALF,a1=PIER-PIER_HALF,r0=s>0?W-0.7:-W,r1=s>0?W:-W+0.7;
  const bottom=stations(a0,a1).map(a=>[a,zs(a)-1.0] as P2),top=stations(a0,a1).reverse().map(a=>[a,zs(a)-0.05] as P2);
  p.wall([...bottom,...top],r0,r1,'stone');
  p.sweep(a0+0.6,a1-0.6,s>0?W-0.02:-W-0.06,s>0?W+0.06:-W+0.02,a=>zs(a)-0.45,0.4,'stone',1);
  for(const a of [-4.6,-1.5,1.5,4.6]){p.box(a,zs(a)-0.98,s*(W+0.08),0.42,0.5,0.1,'red');p.box(a,zs(a)-0.92,s*(W+0.14),0.12,0.4,0.04,'frame');}
 }

 // Cornice band along both faces, proud 15 cm.
 for(const s of sides)p.sweep(-END,END,s>0?W-0.02:-W-0.15,s>0?W+0.15:-W+0.02,a=>zs(a)-0.1,0.3,'stone',1);

 // Piers with ship-prow cutwaters both sides (bow, figurehead, fasces of oars, volute, mooring ring).
 for(const pa of [-PIER,PIER]){
  p.box(pa,FOOT,0,PIER_HALF*2,zs(pa)-0.5-FOOT,W*2,'stone');
  for(const s of sides){
   const pl=(pts:P2[])=>pts.map(([a,r])=>[a,s*r] as P2);
   p.plan(pl([[pa-PIER_HALF,W-0.1],[pa+PIER_HALF,W-0.1],[pa+PIER_HALF,W+1.0],[pa,W+1.9],[pa-PIER_HALF,W+1.0]]),FOOT,0.05,'stone');
   p.plan(pl([[pa-1.3,W-0.1],[pa+1.3,W-0.1],[pa+1.3,W+0.85],[pa,W+1.65],[pa-1.3,W+0.85]]),0.05,1.15,'stone');
   p.plan(pl([[pa-1.45,W-0.1],[pa+1.45,W-0.1],[pa+1.45,W+0.95],[pa,W+1.8],[pa-1.45,W+0.95]]),1.15,1.32,'stone');
   p.blob(pa,0.85,s*(W+1.72),0.17,0.24,0.17,'stone',8,5);                       // figurehead
   p.blob(pa+0.35,0.25,s*(W+1.35),0.55,0.18,0.16,'stone',8,4);                  // dolphin under the bow
   for(const k of [0,1,2])p.beam([pa-1.25+k*0.12,0.15,s*(W+0.75)],[pa-0.55+k*0.12,1.05,s*(W+0.95)],0.06,'stone'); // fasces of oars
   p.ring(pa+1.0,1.7,s*(W+0.55),0.22,0.08,'stone','along');                    // stern volute
   p.ring(pa,-0.85,s*(W+1.92),0.26,0.045,'frame');                              // mooring ring
  }
 }

 // Abutments: brick with stone quoins where the side arches spring.
 for(const e of [-1,1]){
  const a=e*(ABUT+(END-ABUT)/2);
  p.box(a,FOOT,0,END-ABUT,zr(e*(ABUT+0.2))-0.5-FOOT,W*2,'brick');
  for(const s of sides)for(let y=-1.6;y<zs(e*ABUT)-0.4;y+=0.6)p.box(e*(ABUT+0.3),y,s*(W-0.25),0.66,0.3,0.62,'stone');
 }

 // Eight granite pylons (Wikipedia: "acht granieten pylonen … afgewerkt met keizerskronen"): a stepped stone
 // pedestal, the red granite columna rostrata with a ship-prow bracket carrying two lanterns, a capital and the
 // gilded imperial crown. Four stand on the piers' prows, four on the abutment ends.
 const pylon=(a:number,s:1|-1,from:number)=>{
  const r=s*(W+0.55),d=zs(a);
  p.box(a,from,r,1.6,d+1.3-from,1.6,'stone');
  p.box(a,d+1.3,r,1.85,0.2,1.85,'stone');
  p.box(a,d+1.5,r,1.25,0.45,1.25,'stone');
  const y0=d+1.95;
  p.lathe([[0,0],[0.42,0],[0.42,0.12],[0.35,0.22],[0.31,0.32],[0.27,3.3],[0.34,3.36],[0.34,3.45],[0,3.45]],a,y0,r,10,'red');
  p.lathe([[0,0],[0.29,0],[0.5,0.42],[0.5,0.55],[0,0.55]],a,y0+3.45,r,10,'stone');
  p.lathe([[0,0],[0.3,0],[0.3,0.14],[0.35,0.2],[0.28,0.42],[0.12,0.58],[0,0.66]],a,y0+4.0,r,8,'gold');
  p.blob(a,y0+4.72,r,0.09,0.09,0.09,'gold',6,4);p.box(a,y0+4.78,r,0.05,0.22,0.05,'gold');p.box(a,y0+4.88,r,0.16,0.05,0.05,'gold');
  p.blob(a,y0+1.45,r,0.95,0.2,0.42,'stone',10,5);                                   // the rostral boat
  for(const e of [-1,1]){p.beam([a+e*0.7,y0+1.45,r],[a+e*1.05,y0+1.75,r],0.06,'stone');
   p.beam([a+e*0.25,y0+1.6,r],[a+e*0.62,y0+2.05,r],0.04,'frame');
   p.box(a+e*0.62,y0+2.0,r,0.24,0.08,0.24,'frame');p.box(a+e*0.62,y0+2.08,r,0.22,0.42,0.22,'ochre');
   p.lathe([[0.17,0],[0,0.24]],a+e*0.62,y0+2.5,r,4,'frame');p.blob(a+e*0.62,y0+2.78,r,0.05,0.07,0.05,'gold',5,3);}
 };
 for(const pa of [-PIER,PIER])for(const s of sides)pylon(pa,s,1.32);
 for(const e of [-1,1])for(const s of sides){p.box(e*23.75,FOOT,s*(W+0.55),1.7,1.0-FOOT,1.7,'stone');pylon(e*23.75,s,1.0);}

 // Balustrades: a plinth, turned limestone balusters between dados, a handrail; broken by the pylons.
 const runs:[number,number][]=[[-23.0,-PIER-0.85],[-PIER+0.85,PIER-0.85],[PIER+0.85,23.0]];
 for(const s of sides){
  const r=s*(W-0.22),r0=s>0?W-0.45:-W,r1=s>0?W:-W+0.45,h0=s>0?W-0.48:-W-0.03,h1=s>0?W+0.03:-W+0.48;
  for(const [a0,a1] of runs){
   p.sweep(a0,a1,r0,r1,a=>zs(a)+0.22,0.3,'stone',1);
   p.sweep(a0,a1,h0,h1,a=>zs(a)+1.05,0.17,'stone',1);
   const n=Math.ceil((a1-a0)/3.2),dados=Array.from({length:n+1},(_,i)=>a0+(a1-a0)*i/n);
   for(const d of dados)p.box(d,zs(d)+0.2,r,0.42,0.7,0.46,'stone');
   for(let i=1;i<dados.length;i++){const span=dados[i]-dados[i-1]-0.42,m=Math.max(1,Math.round(span/0.33));
    for(let k=0;k<m;k++){const a=dados[i-1]+0.21+span*(k+0.5)/m;
     p.lathe([[0,0],[0.075,0],[0.045,0.12],[0.085,0.33],[0.045,0.58],[0.075,0.66],[0,0.66]],a,zs(a)+0.22,r,5,'white');}}
  }
 }
}
