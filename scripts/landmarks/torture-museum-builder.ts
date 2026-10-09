import type {BuildingTools} from './cultural-builders';
import {surveyShell,wallFrame} from './museums2-shared';
import data from './torture-museum-footprints.json';
/** Singel 449: BAG pand 0363100012175875 (3DBAG LoD2.2 roof faces). The south street facade is
 * laid on the surveyed 3DBAG wall (wallFrame: o=0 IS the brick) and its openings are read from the
 * rectified 2017 panorama elevation (pand-reference) plus the 2025 street view: dark steel-and-glass
 * shopfront with a canted glazed upper bay and a black door, three storeys of dark-brown brick with
 * white-framed windows under white lintel ticks, a cream cornice and the hanging lantern sign.
 * Every facade part reaches back into the wall (check-facade-attachment). u is metres along the
 * wall from its middle (west to east), o is metres out of the wall. */
export function buildTortureMuseum(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const f=wallFrame(b,data,2),W=f.len,{box}=f;
 const back=-.04; // every part starts this far inside the wall so it can never float
 const slab=(u:number,y:number,w:number,h:number,out:number,colour:Parameters<typeof box>[6])=>box(u,y,(out+back)/2,w,h,out-back,colour);
 // ---- ground floor: dark steel shopfront (pand-reference + 2025 panorama) ----
 slab(0,0,W,.3,.1,'stone');                       // plinth
 slab(-W/2+.09,.3,.18,3.35,.16,'dark');           // west steel jamb
 slab(W/2-.09,.3,.18,3.35,.16,'dark');            // east steel jamb
 slab(0,3.4,W,.3,.2,'dark');                      // steel lintel over the shopfront
 // black door with transom glazing carrying the house number
 slab(-1.86,.3,.95,2.55,.1,'dark');
 slab(-1.86,2.9,.95,.5,.07,'glass');slab(-1.86,2.85,.99,.06,.1,'dark');
 slab(-1.33,.3,.07,3.1,.14,'dark');               // door-side mullion
 // big shop glass: low stall riser, tall glass, and a canted glazed bay on top
 slab(.6,.3,3.8,.5,.09,'dark');
 slab(.6,.8,3.8,1.95,.05,'glass');
 for(const u of [-.45,.55,1.55])slab(u,.8,.06,2.55,.1,'dark');
 // canted upper glass: leans out at the top (a sloped pane, hinged on the transom bar)
 slab(.6,2.75,3.8,.08,.12,'dark');
 slab(.6,2.83,3.8,.5,.24,'glass');
 slab(.6,3.3,3.8,.1,.3,'dark');
 // ---- upper storeys: windows measured on the rectified elevation ----
 // [sill height, window height] per storey; columns are [u, width].
 const rows=[[4.16,2.1],[7.44,2.16],[10.84,1.76]],cols=[[-1.95,1.14],[-.25,1.14],[1.49,1.14]];
 for(const [sill,h] of rows)for(const [u,w] of cols){
  const t=.08,fr=.07;
  slab(u,sill,w+.16,h+.16,.02,'glass');                                   // pane sits in the reveal
  slab(u-w/2-t/2,sill,t,h+.16,.07,'white');slab(u+w/2+t/2,sill,t,h+.16,.07,'white');   // jambs
  slab(u,sill-.08,w+.16,t,.07,'white');slab(u,sill+h,w+.16,t,.07,'white');             // sill+head
  slab(u,sill,fr,h,.05,'white');slab(u,sill+h*.55,w,fr,.05,'white');                  // mullion + transom
  slab(u,sill-.2,w+.4,.12,.16,'stone');                                       // projecting sill stone
  for(let k=-2;k<=2;k++)slab(u+k*(w+.1)/4.4,sill+h+.1,.1,.2,.05,'white');   // white lintel ticks
 }
 // ---- cream cornice: frieze, moulding and cap ----
 slab(0,13.1,W+.1,.35,.14,'stone');
 slab(0,13.45,W,.7,.06,'stone');
 slab(0,14.0,W+.1,.18,.3,'stone');
 // ---- hanging lantern sign on an iron bracket at the east edge ----
 const bx=W/2-.25;
 slab(bx,4.15,.07,.07,1.1,'dark');                 // arm, reaches into the wall
 box(bx,4.1,.95,.04,.5,.05,'dark',f.ang);          // hanger
 box(bx,3.55,.55,.05,.55,.95,'dark',f.ang);        // blade sign: black board, red border
 box(bx,3.58,.55,.07,.5,.9,'red',f.ang);
 box(bx,3.6,.55,.09,.4,.8,'dark',f.ang);
 box(bx,3.05,.55,.05,.4,.7,'white',f.ang);         // OPEN board
 box(bx,4.25,.95,.3,.5,.3,'glass',f.ang);          // lantern glass
 box(bx,4.75,.95,.36,.1,.36,'red',f.ang);          // lantern cap
}
