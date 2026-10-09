import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {edgeFrame,panel,windowPane,windowRows,frameText} from './historic-shared';
import data from './theater-bellevue-footprints.json';
/** Theater Bellevue, Leidsekade 90 on the corner of Marnixstraat: BAG pand 0363100012169852 with 3DBAG
 * LoD2.2 roofs (survey massing: low rounded corner block, taller auditorium and fly tower behind, the
 * mansarded 19th-century block at the east end). The 1938 corner treatment follows a 2025 panorama:
 * white-tiled ground floor with dark glazed doors, a sweeping white canopy around the curve, the
 * 'THEATER BELLEVUE' lettering above it and a cream tile-brick upper floor with a long window band.
 * Window and door positions are approximate (one frontal photo). */
export function buildTheaterBellevue(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0];
 // Corner curve (ring edges 2..13) plus the Leidsekade front (14->15, 16->17, 18->19).
 const curve=[1,2,3,4,5,6,7,8,9,10,11,12,13],south=[14,16,18];
 for(const i of [...curve,...south]){
  const f=edgeFrame(b,ring,i),L=f.len;if(L<.35)continue;
  const pad=L>3?.5:0;
  panel(b,f,L/2,0,.03,L,3.4,'white');                       // white-tile ground floor
  if(L>1.2){
   panel(b,f,L/2,.25,.05,Math.max(L-pad*2,.6),2.9,'glass');   // glazed doors and shop windows
   for(let t=pad+1.6;t<L-pad-.8;t+=3.2)panel(b,f,t,.25,.07,.1,2.9,'dark');
   panel(b,f,L/2,3.0,.07,Math.max(L-pad*2,.6),.12,'dark');
  }
  f.box(0,3.5,.7,L+.02,.2,1.4,'white');                     // sweeping canopy
  f.box(0,3.35,1.34,L+.02,.35,.1,'white');
 }
 // Lettering above the canopy on the longest south return.
 const sf=edgeFrame(b,ring,14);
 frameText(b,sf,'THEATER BELLEVUE',sf.len/2,3.95,.1,.13,'white');
 // First-floor window band: wide sashes on the curve, regular pairs along the front.
 for(const i of curve){
  const f=edgeFrame(b,ring,i),L=f.len;if(L<1)continue;
  windowPane(b,f,L/2,5.4,Math.min(L*.8,3.2),2.3,{frame:'white',mullion:true});
 }
 for(const i of south){const f=edgeFrame(b,ring,i);if(f.len>4)windowRows(b,f,{from:.8,to:f.len-.8,pitch:2.6,w:1.5,h:2.1,sills:[5.5]});}
 // West flank on Marnixstraat (edge 1->2) and the mansarded east block.
 const west=edgeFrame(b,ring,1);windowRows(b,west,{from:1,to:west.len-.5,pitch:2.4,w:1.2,h:1.8,sills:[1.2,5.4]});
 const east=edgeFrame(b,ring,19);
 windowRows(b,east,{from:1,to:east.len-1,pitch:3.1,w:1.4,h:2.2,sills:[1.4,5.0,8.6,12.2]});
 east.box(0,13.9,.18,east.len,.25,.4,'stone');
}
