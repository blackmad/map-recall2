import type {BuildingTools} from './cultural-builders';
import {surveyShell,facadeFrame} from './museums2-shared';
import data from './pathe-de-munt-footprints.json';
/** Pathé de Munt multiplex (opened 2000), BAG pand 0363100012179384 with 3DBAG LoD2.2 roof faces
 * (the notched pitched volumes are survey data). Grey-brick walls with lighter bed-joint bands;
 * the Vijzelstraat (west) frontage gets recessed entrance bays, poster cases and the tall
 * vertical Pathé sign as seen in 2025 panoramas. Opening positions are approximate. */
export function buildPatheDeMunt(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'greyBrick','slate');
 const ring=data.ring[0],f=facadeFrame(b,ring[1],ring[2]),W=f.len,{box}=f;
 // lighter horizontal bands every ~2.2 m, the dotted brick courses of the real wall
 for(let y=2.6;y<20.5;y+=2.2)box(0,y,.03,W,.1,.05,'stone');
 // ground-floor entrance bays: aluminium doors with glazed sidelights
 for(const u of [-W*.32,W*.12]){
  box(u,0,.06,2.6,3.3,.1,'dark');box(u,0,.1,2.2,3.0,.06,'glass');box(u,0,.14,.07,3.0,.06,'stone');
  box(u,3.3,.12,2.8,.18,.3,'stone');
 }
 // poster cases
 for(const u of [-W*.46,-W*.2,W*.34,W*.44])for(const y of [.9,2.1]){box(u,y,.07,.9,1.1,.08,'dark');box(u,y+.08,.12,.75,.94,.04,'gold')}
 // slit windows high on the wall
 for(const u of [-W*.25,W*.05,W*.3])box(u,9,.04,.9,6,.05,'glass');
 // vertical sign blade on the frontage, white with gold lettering block
 box(W*.5-.4,5,.35,.5,6.8,1.2,'white');box(W*.5-.4,7.2,.97,.4,2.2,.05,'gold');box(W*.5-.4,4.2,.97,.4,1.2,.05,'dark');
}
