import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {wallTop,edgeFrame,windowRows,panel,band} from './historic-shared';
import data from './compagnietheater-footprints.json';
/** Compagnietheater, Kloveniersburgwal 50: the 1792-93 Lutheran church by Abraham van der Hart, BAG
 * pand 0363100012171200 with 3DBAG LoD2.2 roofs (long gabled nave, lower end bays). The canal
 * flank follows a 2025 panorama: rusticated pale-stone ground floor with large white sash windows,
 * tall round-headed windows above in brick reveals, and a heavy cornice. The sculpture group on the
 * entrance front is not modelled (no usable photo). Window positions are approximate. */
export function buildCompagnietheater(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'stone','slate');
 const ring=data.ring[0];
 // Canal flank (ring edges 14->15, 16->17, 18->19) and the south end (13->14).
 for(const i of [13,14,16,18,11,12]){
  const f=edgeFrame(b,ring,i);if(f.len<5)continue;
  // rusticated ground floor: horizontal joints plus shallow base
  for(let y=.95;y<5.4;y+=.95)panel(b,f,f.len/2,y,.02,f.len,.07,'brick');
  f.box(0,0,.05,f.len,.5,.1,'brick');
  // ground-floor sashes and tall arched upper windows
  windowRows(b,f,{top:wallTop(data.roofs),from:1.2,to:f.len-1.2,pitch:3.3,w:1.5,h:3.0,sills:[1.4],frame:'white'});
  windowRows(b,f,{top:wallTop(data.roofs),from:1.2,to:f.len-1.2,pitch:3.3,w:1.5,h:4.2,sills:[7.0],arch:true,frame:'white',glass:'glass'});
  // arched brick reveals
  for(let t=1.2+1.65;t<f.len-1.2;t+=3.3)panel(b,f,t,6.85,.01,1.95,4.7,'brick');
  band(b,f,5.6,.3,.25,'white');          // impost / floor band
  band(b,f,15.0,.55,.55,'white');        // main cornice
 }
}
