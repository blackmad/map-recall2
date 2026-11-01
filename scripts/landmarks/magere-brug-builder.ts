// Magere Brug (brug 242, current form 1934; Rijksmonument 518383): the white timber double bascule over the Amstel
// at the Kerkstraat. Lane landmarks-bridges-20261101 (#175). Authored in the bridge frame (bridgeFrame.ts): along =
// bearing 73° (ENE), right = SSE, y = scene z. The deck stays 6 cm under the game's ride surface
// (magere-brug-footprints.json rideProfile); the own-ground kit body and bascule frames for BRU0242 are skipped
// (src/canalRecall/ownGround/bespokeBridges.ts).
// The ride surface over this unmeasured footprint is the relief, about 1 m under the real deck: the model follows
// the game, so the fixed-span arches stand about 1 m lower over the water than the photographs show.
// Evidence: Gemeente Amsterdam boat panoramas TMX7316010203-000355_pano_0000_000633 (south face) and
// -000355_pano_0000_000625 (north face), CC BY 4.0; Wikimedia Commons "Magere brug amsterdam.jpg" (Jvhertum,
// CC BY-SA 3.0) and "Magerebrug.jpg" (CC BY-SA 3.0) for the portals and the balance-beam frames.
import type {BuildingTools} from './cultural-builders';
import {bridgeParts,type P2,type P3} from './bridge-parts';
import {profileZ,segmentalArc} from '../../src/canalRecall/landmarks/bridgeFrame';
import fp from './magere-brug-footprints.json';

const W=fp.fixedHalfWidth;               // fixed spans' face planes
const WB=fp.basculeHalfWidth;            // the narrow bascule section
const END=36.95;                         // abutment ends (register outline)
const FOOT=-2.3;                         // under the water (−1.77): model minimum, see groundAltitudeMetres
const SPRING=-1.95;                      // the arches spring under the waterline (photos)
const POST=4.7;                          // portal posts along ±4.7 (panorama: −5.3..−4.2 and 3.7..5.0)
const HEEL=4.4, TIP=0.03;                // leaves from the heel at the post to the meeting line
const ride=fp.rideProfile as [number,number][];
const zr=(a:number)=>profileZ(ride,a);
// Four arches each side between the abutment (±36.4) and the bascule pier face (±5.4): 6.4 m openings, 1.8 m piers.
const ARCH=6.4,PIER=1.8,ABUT=36.4,BPIER=5.4;
const archSpans=(e:1|-1)=>[0,1,2,3].map(i=>{const a0=ABUT-i*(ARCH+PIER),a1=a0-ARCH;return e>0?[a1,a0]:[-a0,-a1];}) as [number,number][];

export function buildMagereBrug(_w:number,_d:number,b:BuildingTools):void{
 const p=bridgeParts(b,fp.bearingDegrees,-FOOT);
 const sides=[1,-1] as const;
 const stations=(a0:number,a1:number,step=1)=>{const out:number[]=[];for(let a=a0;a<a1-1e-6;a+=step)out.push(a);out.push(a1);return out;};

 for(const e of [-1,1] as const){
  const inner=e*BPIER,outer=e*END,lo=Math.min(inner,outer),hi=Math.max(inner,outer);
  // Fixed span: deck slab, face walls with four segmental arches, pilaster piers, soffits, cornice, dark iron railing.
  p.sweep(lo,hi,-W+0.5,W-0.5,a=>zr(a)-0.06,0.35,'concrete');
  const spans=archSpans(e).sort((x,y)=>x[0]-y[0]);
  for(const [a0,a1] of spans){
   const crown=zr((a0+a1)/2)-0.55,arc=segmentalArc(a0,a1,SPRING,crown,12);
   p.soffit(arc,-W+0.5,W-0.5,'slate');
   for(const s of sides){const r0=s>0?W-0.5:-W,r1=s>0?W:-W+0.5;
    p.wall([...arc,...stations(a0,a1).reverse().map(a=>[a,zr(a)-0.05] as P2)],r0,r1,'stone');
    // Arch ring band, 6 cm proud.
    const ring=segmentalArc(a0,a1,SPRING+0.25,crown+0.25,12);
    p.wall([...arc,...[...ring].reverse()],s>0?W-0.02:-W-0.06,s>0?W+0.06:-W+0.02,'stone');}
  }
  // Piers between the arches and at the abutment/bascule ends, as pilasters 15 cm proud of both faces.
  const piers:number[]=[];for(let i=0;i<spans.length-1;i++)piers.push((spans[i][1]+spans[i+1][0])/2);
  for(const a of piers){p.box(a,FOOT,0,PIER,zr(a)-0.45-FOOT,W*2,'stone');for(const s of sides)p.box(a,FOOT,s*(W+0.05),PIER-0.2,zr(a)-0.2-FOOT,0.2,'stone');}
  const abut=e*(ABUT+(END-ABUT)/2);p.box(abut,FOOT,0,END-ABUT+0.2,zr(abut)-0.45-FOOT,W*2,'stone');
  for(const s of sides)p.sweep(lo,hi,s>0?W-0.05:-W-0.12,s>0?W+0.12:-W+0.05,a=>zr(a)+0.12,0.32,'stone',1);
  // Railing: dark iron, posts every 1.8 m, three rails, slender bars.
  for(const s of sides){const r=s*(W-0.12),from=lo+0.3,to=hi-0.3;
   for(const y of [0.2,0.55,1.0])p.sweep(from,to,r-0.03,r+0.03,a=>zr(a)+y,0.05,'copper',2);
   for(let a=from;a<=to+1e-6;a+=1.8)p.box(a,zr(a)+0.12,r,0.09,0.9,0.09,'copper');
   for(let a=from+0.15;a<to;a+=0.3)p.box(a,zr(a)+0.12,r,0.03,0.85,0.03,'copper');}
  // Van der Heyden replica lantern posts near the banks.
  for(const s of sides){const a=e*33.2,r=s*(W-0.1),z=zr(a);
   p.lathe([[0,0],[0.14,0],[0.1,0.4],[0.06,0.5],[0.05,4.0],[0,4.0]],a,z,r,6,'copper');
   p.box(a,z+3.86,r,1.1,0.12,0.08,'copper');
   for(const k of [-1,1]){p.box(a+k*0.5,z+3.6,r,0.24,0.08,0.24,'copper');p.box(a+k*0.5,z+3.68,r,0.22,0.36,0.22,'ochre');p.lathe([[0.17,0],[0,0.22]],a+k*0.5,z+4.04,r,4,'copper');}}

  // Bascule pier: dark (tarred timber and concrete) under the heel, fender piles in front of it.
  p.box(e*(BPIER-1.05),FOOT,0,2.1,zr(e*4.35)-0.12-FOOT,W*2,'bronze');
  for(const s of sides)for(const k of [0,1,2])p.lathe([[0,0],[0.16,0],[0.16,zr(0)-0.15-FOOT],[0,zr(0)-0.15-FOOT]],e*(3.15),FOOT,s*(WB+0.4+k*0.85),6,'bronze');
  // The narrow deck between the bascule pier and the leaf heel.
  p.sweep(Math.min(e*HEEL,e*BPIER),Math.max(e*HEEL,e*BPIER),-WB-0.05,WB+0.05,a=>zr(a)-0.06,0.5,'green');

  // Leaf: white timber deck with side girders and a white lattice railing.
  const l0=Math.min(e*TIP,e*HEEL),l1=Math.max(e*TIP,e*HEEL);
  p.sweep(l0,l1,-WB+0.2,WB-0.2,a=>zr(a)-0.06,0.3,'green');
  for(const s of sides){const r=s*(WB-0.1);
   p.sweep(l0,l1,r-0.1,r+0.1,a=>zr(a)+0.05,0.65,'green');
   p.sweep(l0,l1,r-0.04,r+0.04,a=>zr(a)+1.05,0.08,'green');
   for(let a=l0;a<=l1+1e-6;a+=(l1-l0)/4)p.box(a,zr(a),r,0.1,1.05,0.1,'green');
   for(let a=l0;a<l1-0.5;a+=(l1-l0)/4){const q=a+(l1-l0)/4;p.beam([a,zr(a)+0.12,r],[q,zr(q)+0.95,r],0.025,'green');p.beam([a,zr(a)+0.95,r],[q,zr(q)+0.12,r],0.025,'green');}}

  // Portal: two white posts beside the narrow deck, an arched crossbeam, a top beam; diagonal struts out to the fixed span.
  const z=zr(e*POST),pc=WB+0.35,top=z+6.3;
  for(const s of sides){p.box(e*POST,z-0.1,s*pc,0.45,6.4,0.45,'green');
   p.beam([e*POST,z+4.0,s*pc],[e*(POST+3.6),zr(e*(POST+3.6))+0.1,s*(pc+0.3)],0.05,'copper');}
  const arch=segmentalArc(-pc,pc,z+4.1,z+5.0,8);
  for(let i=1;i<arch.length;i++)p.beam([e*POST,arch[i-1][1],arch[i-1][0]],[e*POST,arch[i][1],arch[i][0]],0.14,'green');
  p.box(e*POST,z+5.25,0,0.4,0.4,pc*2+0.45,'green');
  for(const s of sides)p.box(e*POST,z+5.0,s*(pc-0.12),0.4,0.25,0.25,'green');

  // Balance beams (hameien): one each side on the post tops, sloping up to the inner end over the leaf tip, joined
  // into a frame by cross beams (the two frames' inner tips meet ~1.1 m apart over the gap, per the panoramas);
  // the counterweight hangs at the outer end over the fixed span.
  const inA=e*0.55,outA=e*(POST+6.3),pivotY=top+0.2,inY=pivotY+0.55,outY=pivotY-0.45;
  const beamY=(a:number)=>pivotY+(a-e*POST)/(inA-e*POST)*(inY-pivotY);
  for(const s of sides){const r=s*pc;
   p.beam([outA,outY,r],[inA,beamY(inA),r],0.2,'green');
   p.beam([outA,outY+0.22,r],[inA,beamY(inA)+0.22,r],0.06,'copper');}
  for(const a of [inA,e*POST,(e*POST+outA)/2,outA]){const y=a===outA?outY:beamY(a);p.box(a,y-0.18,0,0.3,0.36,pc*2,'green');}
  p.box(outA-e*0.8,outY-1.0,0,1.5,0.85,pc*2-0.4,'bronze');
  // Hanging rods from the beams to the leaf tip and its middle (dark iron).
  for(const s of sides){
   p.beam([inA,beamY(inA)-0.2,s*pc],[e*(TIP+0.3),zr(e*0.3)+0.5,s*(WB-0.1)],0.03,'copper');
   p.beam([e*2.4,beamY(e*2.4)-0.2,s*pc],[e*2.2,zr(e*2.2)+0.5,s*(WB-0.1)],0.03,'copper');
   p.beam([e*POST,top-0.4,s*pc],[e*1.2,zr(e*1.2)+0.5,s*(WB-0.1)],0.03,'copper');}
  // Bridge signals and barrier boxes at the leaf ends.
  for(const s of sides){const a=e*(POST+0.9),r=s*(WB+0.15);p.box(a,zr(a),r,0.12,1.5,0.12,'copper');p.blob(a,zr(a)+1.35,s*(WB+0.28),0.1,0.1,0.06,'red',6,4);
   p.box(e*(POST+1.6),zr(e*(POST+1.6)),s*(W-0.55),0.45,1.05,0.4,'bronze');}
 }
}
