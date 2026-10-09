import type {BuildingTools} from './cultural-builders';
import {surveyShell,facadeFrame} from './museums2-shared';
import data from './theo-thijssen-museum-footprints.json';
/** Eerste Leliedwarsstraat 16: BAG pand 0363100012168755 with 3DBAG LoD2.2 roofs. The east street
 * facade follows a 2025 panorama: dark door with number transom, bowed shop window under a
 * projecting cream cornice, three brick storeys of white-framed windows and the birth plaque.
 * Opening positions are approximate (single frontal photo). */
export function buildTheoThijssenMuseum(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const ring=data.ring[0],f=facadeFrame(b,ring[6],ring[0]),W=f.len,{box}=f;
 // ground floor: stone plinth, door with transom, brick pier, bowed shop window
 box(0,0,.04,W,.35,.1,'stone');
 box(-1.75,.35,.06,1.05,2.75,.1,'dark');box(-1.75,3.1,.06,1.05,.5,.08,'glass');box(-1.75,3.07,.1,1.1,.05,.08,'white');
 box(-.85,.35,.05,.28,3.3,.12,'brick');
 // bow window: three angled glazed facets with white sill and head
 const angs=[-.45,0,.45],ws=[.95,1.15,.95],us=[-.1,1.05,2.15],os=[.08,.28,.08];
 for(let i=0;i<3;i++){
  const [x,z]=f.at(us[i],os[i]);
  b.box(x,.85,z,ws[i],2.2,.06,'glass',f.ang+angs[i]);
  b.box(x,.35,z,ws[i]+.08,.5,.12,'white',f.ang+angs[i]);
  b.box(x,3.0,z,ws[i]+.08,.2,.12,'white',f.ang+angs[i]);
 }
 for(const [u,o] of [[-.62,.12],[.5,.22],[1.6,.22],[2.4,.1]]){const [x,z]=f.at(u,o);b.box(x,.85,z,.07,2.2,.1,'white',f.ang)}
 // projecting cream cornice over the ground floor
 box(0,3.6,.2,W+.3,.35,.5,'stone');
 // upper storeys, three windows each
 for(const sill of [4.45,7.25,10.05]){
  for(const u of [-1.7,0,1.7]){
   box(u,sill,.0,1.3,2.0,.06,'white');
   box(u,sill+.12,.04,1.06,1.76,.05,'glass');
   box(u,sill+.12,.08,.06,1.76,.05,'white');box(u,sill+.95,.08,1.06,.06,.05,'white');
   box(u,sill-.1,.1,1.45,.1,.18,'stone');
  }
 }
 // birth plaque between the first-floor windows
 box(-.85,5.2,.04,.65,.4,.05,'stone');
 // eaves line
 box(0,11.95,.1,W+.1,.22,.3,'stone');
}
