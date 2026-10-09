import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {wallTop,edgeFrame,windowRows,panel,archedPane,pediment,eaveNear,frameText} from './historic-shared';
import data from './rijksakademie-footprints.json';
/** Rijksakademie van beeldende kunsten, Sarphatistraat 470: the former Kavallerie-Kazerne, BAG pand
 * 0363100012165748 (the 3DBAG roof faces give the four ranges round the courtyard, the end
 * pavilions and the low annexes). The north gate front follows a 2025 panorama: brown brick, two
 * floors of round-headed windows, stone quoins flanking a slightly projecting centre bay with a
 * low pediment, an arched carriage gate and the 'KAVALLERIE KAZERNE' plaque. Window positions are
 * approximate. */
export function buildRijksakademie(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0];
 for(let i=0;i<ring.length;i++){
  const f=edgeFrame(b,ring,i);if(f.len<8)continue;
  const gate=i===76;
  windowRows(b,f,{top:wallTop(data.roofs),from:1.2,to:f.len-1.2,pitch:2.9,w:1.1,h:2.3,sills:[1.0,4.3],arch:true,frame:'white',skip:gate?[[f.len/2-3.2,f.len/2+3.2]]:undefined});
 }
 // Centre gate bay on the north range (ring edge 76->77).
 const g=edgeFrame(b,ring,76),mid=g.len/2;
 const mx=(ring[76][0]+ring[77][0])/2,mz=(ring[76][1]+ring[77][1])/2;
 const eave=eaveNear(data.roofs,mx,mz,4);
 const top=Math.max(eave,7.5);
 for(const s of [-1,1])g.box(g.s(mid+s*(g.len/2-.35)),0,.12,.7,top,.2,'stone');   // quoin pilasters
 g.box(g.s(mid),top-.5,.12,g.len,.3,.3,'stone');                                   // cornice
 pediment(b,g,mid,top-.2,g.len+.8,2.2,.5,'brick',0);
 // carriage gate, upper arched windows and plaque
 archedPane(b,g,mid,0,2.6,3.6,{frame:'stone',glass:'dark'});
 panel(b,g,mid-2.1,1.0,.05,1.0,2.2,'glass');panel(b,g,mid+2.1,1.0,.05,1.0,2.2,'glass');
 for(const du of [-2.1,0,2.1])archedPane(b,g,mid+du,4.3,1.1,2.3,{frame:'white'});
 g.box(g.s(mid),3.9,.1,3.2,.35,.1,'dark');
 frameText(b,g,'KAVALLERIE KAZERNE',mid,3.95,.17,.029,'white');
}
