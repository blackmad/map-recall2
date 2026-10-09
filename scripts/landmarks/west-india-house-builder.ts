import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {wallTop,edgeFrame,windowRows,panel,windowPane} from './historic-shared';
import data from './west-india-house-footprints.json';
/** West-Indisch Huis, Herenmarkt 99: BAG pand 0363100012167535 (built 1617, enlarged by the West India
 * Company around a courtyard) with 3DBAG LoD2.2 roofs, which supply the ring of ranges, the open
 * courtyard and the hipped roofs. The Herenmarkt front follows a 2025 panorama: brown brick walls,
 * white sash windows under flat brick arches, a white doorcase with a segmental pediment and
 * black lattice doors, and the dark awning. Window positions are approximate. */
export function buildWestIndiaHouse(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0];
 const sills=[1.0,4.2,7.4];
 for(let i=0;i<ring.length;i++){
  const f=edgeFrame(b,ring,i);if(f.len<4)continue;
  const skip:[number,number][]|undefined=i===18?[[.9,3.1]]:undefined;
  windowRows(b,f,{top:wallTop(data.roofs),from:.9,to:f.len-.9,pitch:2.7,w:1.15,h:2.2,sills,skip});
 }
 // Entrance on the Herenmarkt front (ring edge 18->19), near the start of the edge.
 const f=edgeFrame(b,ring,18),t=2.0;
 panel(b,f,t,0,.04,1.9,3.5,'dark');                     // lattice doors
 panel(b,f,t,3.5,.04,1.9,.55,'glass');                   // fanlight
 f.box(f.s(t-1.15),0,.12,.28,4.1,.22,'white');f.box(f.s(t+1.15),0,.12,.28,4.1,.22,'white'); // jambs
 f.box(f.s(t),4.0,.14,2.9,.3,.34,'white');               // entablature
 f.box(f.s(t),4.3,.1,2.2,1.5,.22,'white');               // overlight panel
 windowPane(b,f,t,4.5,1.0,.95,{frame:'white'});
 f.box(f.s(t),5.8,.12,3.1,.2,.4,'white');                 // pediment base
 f.box(f.s(t),6.0,.1,2.2,.25,.3,'white');f.box(f.s(t),6.25,.1,1.4,.25,.26,'white'); // stepped cap
 f.box(f.s(t),2.9,.34,2.1,.55,.6,'dark');                 // awning
}
