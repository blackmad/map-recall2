import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {edgeFrame,windowRows,wallTop,band} from './historic-shared';
import data from './royal-tropical-institute-footprints.json';
/** Koninklijk Instituut voor de Tropen (Tropenmuseum), Mauritskade / Linnaeusstraat: BAG pand
 * 0363100012237251 (built 1915-1926, J. van Nieukerken). The whole complex is the 3DBAG LoD2.2
 * survey: the long wings, courtyards, the semicircular low link and the corner bell tower come from
 * measured roof faces. Elevations are deliberately generic: brown brick walls with regular stone-
 * framed window bays on every storey, checked against the local eave height so nothing floats.
 * Individual facade composition, the entrance and the tower stages are not reproduced. */
export function buildRoyalTropicalInstitute(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0],top=wallTop(data.roofs);
 for(let i=0;i<ring.length;i++){
  const f=edgeFrame(b,ring,i);if(f.len<3.6)continue;
  windowRows(b,f,{top,from:.6,to:f.len-.6,pitch:3.4,w:1.4,h:2.3,sills:[1.3,5.0,8.7,12.4,16.1],frame:'stone',mullion:false});
  const [mx,mz]=f.at(0,-.6),h=top(mx,mz);
  if(Number.isFinite(h)&&h>8&&f.len>12)band(b,f,Math.min(h,25)-.5,.35,.3,'stone');
 }
}
