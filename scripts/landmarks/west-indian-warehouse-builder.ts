import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {backstopWalls,wallTop,edgeFrame,windowRows,panel,windowPane,band} from './historic-shared';
import data from './west-indian-warehouse-footprints.json';
/** West-Indisch Pakhuis, Oudeschans / Rapenburg: BAG pand 0363100012170626 (1640s) with 3DBAG LoD2.2
 * roofs, which give the tall five-storey block and the lower stepped end. The long water-side front
 * follows a 2025 panorama: cream-stone ground floor with tall board doors and barred openings, brick
 * upper floors with cream window surrounds, blue shutters and a balcony bay. Positions are approximate. */
export function buildWestIndianWarehouse(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0],top=wallTop(data.roofs);
 backstopWalls(b,ring,data.roofs,'brick');
 for(const i of [2,6]){
  const f=edgeFrame(b,ring,i),L=f.len;
  panel(b,f,L/2,0,.025,L,4.0,'stone');                         // cream ground floor
  for(let t=2.4;t<L-1.2;t+=4.8){
   panel(b,f,t,0,.05,2.3,3.4,'dark');                           // board doors
   panel(b,f,t,1.7,.07,.08,1.7,'stone');
   if(t+2.4<L-1.2){for(let k=-1;k<=1;k++)panel(b,f,t+2.4+k*.45,.9,.06,.07,2.4,'dark');panel(b,f,t+2.4,.9,.05,1.5,2.4,'glass')} // barred window
  }
  band(b,f,3.95,.2,.25,'stone');
  windowRows(b,f,{top:wallTop(data.roofs),from:1.1,to:L-1.1,pitch:2.8,w:1.0,h:1.9,sills:[4.7,7.5,10.3],frame:'stone'});
  for(let t=1.1+1.4;t<L-1.1;t+=5.6)for(const row of [7.5,10.3])for(const s of [-1,1])if(top(...f.at(f.s(t),-.6))>row+2.5)panel(b,f,t+s*.85,row,.09,.5,1.9,'blue'); // shutters
  for(let t=1;t<L;t+=2)if(top(...f.at(f.s(t),-.6))>13.4)f.box(f.s(t),12.9,.17,2.02,.3,.35,'stone'); // eaves cornice where the block is tall
 }
 // end gable face (ring edge 3->4 and the stepped lower end)
 const e=edgeFrame(b,ring,3);windowRows(b,e,{top:wallTop(data.roofs),from:.8,to:e.len-.8,pitch:2.4,w:1.0,h:1.8,sills:[1.0,3.6],frame:'stone'});
}
