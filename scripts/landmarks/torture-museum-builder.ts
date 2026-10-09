import type {BuildingTools} from './cultural-builders';
import {surveyShell,facadeFrame} from './museums2-shared';
import data from './torture-museum-footprints.json';
/** Singel 449: BAG pand 0363100012175875 (3DBAG LoD2.2 roof faces) with the south street facade
 * read from the 2025 Amsterdam panorama: dark steel-and-glass shopfront at ground level, three
 * upper storeys of brick with white-framed windows, a stone cornice and a blade sign. Window
 * positions are measured from a single frontal photo (approximate); the shell is survey data. */
export function buildTortureMuseum(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0],f=facadeFrame(b,ring[2],ring[3]),W=f.len,{box}=f;
 // stone plinth and dark steel shopfront frame
 box(0,0,.05,W,.45,.1,'stone');
 box(-2.24,.45,.08,.3,3.75,.14,'dark');box(2.45,.45,.08,.28,3.75,.14,'dark');
 box(0,4.0,.09,W,.32,.16,'dark');
 // left: dark door under a glazed transom with the house number
 box(-1.52,.45,.06,1.1,2.65,.1,'dark');box(-1.52,3.1,.06,1.1,.9,.06,'glass');box(-1.52,3.08,.1,1.14,.05,.08,'dark');
 // right: big shop window over a low stone sill, split by a mullion at the door pair
 box(.85,.45,.04,3.0,.55,.08,'stone');box(.85,1.0,.03,3.0,3.0,.05,'glass');box(-.65,.45,.08,.1,3.55,.12,'dark');
 box(.45,1.0,.08,.07,3.0,.1,'dark');box(1.65,1.0,.08,.07,3.0,.1,'dark');
 // upper storeys: three window bays whose positions follow the photographed facade
 const bays=[[-1.47,1.4],[.41,1.18],[1.92,.92]];
 for(const sill of [4.73,7.83,10.93]){
  for(const [u,w] of bays){
   const h=2.1;
   box(u,sill,.0,w+.2,h+.2,.06,'white');
   box(u,sill+.1,.03,w,h,.05,'glass');
   box(u,sill+.1,.07,.06,h,.05,'white');box(u,sill+h*.5+.05,.07,w,.06,.05,'white');
   box(u,sill-.12,.1,w+.3,.1,.16,'stone');
  }
 }
 // cornice and parapet line along the top of the facade
 box(0,13.95,.1,W+.1,.28,.3,'stone');
 // projecting blade sign by the entrance (text not reproduced)
 box(2.62,3.2,.55,.1,.95,.8,'dark');box(2.62,3.45,.55,.12,.4,.62,'red');
}
