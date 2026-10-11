import * as T from 'three';
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
 // Every upper window has a segmental head (rise .2 m) in a thin white surround, dark steel sashes (2 lights wide, one transom),
 // a projecting stone sill and an arc of white lintel ticks (panoramas 0, 2, 3: 2025).
 const seg=(w:number,h:number,rise:number)=>{const sh=new T.Shape(),r=(w*w/4+rise*rise)/(2*rise);
  sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h);
  for(let i=1;i<=10;i++){const x=w/2-w*i/10;sh.lineTo(x,h+Math.sqrt(r*r-x*x)-(r-rise))}
  sh.lineTo(-w/2,0);return sh};
 const ext=(sh:T.Shape,d:number)=>new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false,curveSegments:6});
 for(const [sill,h] of rows)for(const [u,w] of cols){
  const rise=.2,fr=.07;
  f.geo(ext(seg(w+.28,h+.1,rise),.06+.04),'white',u,sill-.06,-.04);                  // white surround (4 cm sunk into the brick)
  f.geo(ext(seg(w,h-.02,rise),.05+.04),'glass',u,sill+.0,-.01);                        // pane, set in the reveal
  slab(u-w/2+fr/2-.02,sill,fr,h,.1,'dark');slab(u+w/2-fr/2+.02,sill,fr,h,.1,'dark');   // sash stiles (outer edge 2 cm past the pane)
  slab(u,sill+.02,w-2*fr+.03,fr,.1,'dark');                                            // bottom rail
  slab(u,sill+h*.58,w-2*fr+.03,fr,.11,'dark');slab(u,sill+h*.26,w-2*fr+.03,fr*.8,.105,'dark');   // transom and lower bar
  slab(u,sill+.03,fr*.8,h*.57,.105,'dark');                                            // mullion below the transom
  slab(u,sill+h*.58+fr*.5,fr*.8,h*.42-.08,.105,'dark');                                // mullion above
  slab(u,sill-.2,w+.4,.12,.16,'stone');                                                // projecting sill stone
  for(let k=-3;k<=3;k++){const x=k*(w+.22)/7,y=sill+h+.12+rise*(1-Math.pow(2*x/(w+.2),2));slab(u+x,y,.1,.2,.05,'white')}
 }
 // ---- cream cornice: frieze, moulding and cap ----
 slab(0,13.1,W+.1,.35,.14,'stone');
 slab(0,13.45,W,.7,.06,'stone');
 slab(0,14.0,W+.1,.18,.3,'stone');
 // ---- shopfront extras (panorama 0, 2): door furniture, push bars, spotlights, the carved wooden monk beside the east jamb ----
 slab(-1.86,1.02,.03,.22,.2,'stone');                 // door pull
 slab(-1.52,1.0,.12,.18,.12,'stone');                 // intercom box
 for(const u of [-.02,.12])slab(u+.6,.5,.03,1.9,.22,'stone');   // twin chrome push bars on the glazed door
 for(const u of [-.5,1.4])slab(u+.5,3.18,.18,.12,.42,'dark');   // two black spotlights under the steel lintel
 slab(W/2-.5,0,.7,.4,.8,'stone');                      // stone pedestal against the east pier
 slab(W/2-.5,.4,.42,1.35,.5,'ochre');                  // carved monk: robe
 slab(W/2-.5,1.75,.3,.3,.4,'ochre');                   // hooded head
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
