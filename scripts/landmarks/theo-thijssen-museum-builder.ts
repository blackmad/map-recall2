import type {BuildingTools} from './cultural-builders';
import {surveyShell,wallFrame} from './museums2-shared';
import data from './theo-thijssen-museum-footprints.json';
/** Eerste Leliedwarsstraat 16: BAG pand 0363100012168755 with 3DBAG LoD2.2 roofs. The street facade
 * (the 5 m east gable wall) is laid on the surveyed 3DBAG wall with wallFrame, so o=0 IS the brick.
 * It follows the 2025 panorama: a gently bowed ground floor (two black doors, numbers 18 and 16, and
 * a big two-light shop window) under a curved cream cornice, the birth plaque on the wall above it,
 * and sash windows in white frames on the upper storeys. u runs south to north from the wall's
 * middle. Everything is built as boxes that start inside the wall or inside the bowed body, so each
 * part is attached (scripts/check-facade-attachment.ts). Proportions are read from one frontal photo. */
export function buildTheoThijssenMuseum(_w:number,_d:number,b:BuildingTools){
 surveyShell(b,data,'brick','slate');
 const f=wallFrame(b,data,6),W=f.len,{box}=f;
 type C=Parameters<typeof box>[6];
 const back=-.04;
 // flat parts on the wall plane
 const slab=(u:number,y:number,w:number,h:number,out:number,colour:C)=>box(u,y,(out+back)/2,w,h,out-back,colour);

 // ---- bowed ground floor: a shallow parabolic bay across the whole width ----
 const half=W/2-.05,sag=.3,bow=(u:number)=>sag*Math.max(0,1-(u/half)**2),slope=(u:number)=>-2*sag*u/(half*half);
 /** Box on the bay surface at u: front face `out` m proud of the arc, `depth` m thick (back inside the body). */
 const bay=(u:number,y:number,w:number,h:number,out:number,depth:number,colour:C)=>{
  const k=slope(u),th=Math.atan(k),m=Math.hypot(1,k),r=out-depth/2;   // normal = (-k,1)/m in (u,o)
  const [x,z]=f.at(u-k/m*r,bow(u)+r/m);
  b.box(x,y,z,w/Math.cos(th)*1.03,h,depth,colour,f.ang-th);
 };
 const N=10,facets=Array.from({length:N},(_,i)=>-half+(i+.5)*(2*half/N)),fw=2*half/N;
 const inRange=(u:number,a:number,c:number)=>u>=a-1e-6&&u<=c+1e-6;
 const strip=(a:number,c:number,y:number,h:number,out:number,depth:number,colour:C)=>{for(const u of facets)if(inRange(u,a,c))bay(u,y,fw,h,out,depth,colour)};
 const post=(u:number,y:number,w:number,h:number,out:number,colour:C)=>bay(u,y,w,h,out,.12+out,colour);

 strip(-half,half,0,2.8,0,.5,'brick');                    // solid brick body of the bay
 strip(-half,half,0,.3,.07,.5,'stone');                   // plinth
 // cream cornice following the curve: sill moulding, frieze, projecting cap
 strip(-half,half,2.8,.14,.16,.5,'stone');
 strip(-half,half,2.94,.2,.08,.5,'stone');
 strip(-half,half,3.14,.16,.34,.6,'stone');
 // doors 18 and 16 (black, cream frames, glazed transoms)
 for(const [u,wd,glassDoor] of [[-1.91,.62,false],[-1.0,.62,true]] as const){
  post(u-wd/2-.06,.3,.1,2.4,.1,'white');post(u+wd/2+.06,.3,.1,2.4,.1,'white');   // door jambs
  post(u,2.12,wd+.22,.1,.1,'white');post(u,2.7,wd+.22,.1,.1,'white');               // transom bars
  post(u,2.22,wd+.04,.48,.05,'glass');                                             // transom light
  post(u,.3,wd,1.82,.07,'dark');                                                   // door leaf
  if(glassDoor)post(u,.95,wd-.24,1.0,.1,'glass');                                  // glazed upper door
  else{post(u,.5,wd-.22,.65,.11,'dark');post(u,1.35,wd-.22,.65,.11,'dark')}        // panelled door
  post(u+wd/2-.1,1.0,.05,.08,.14,'gold');                                          // handle
 }
 post(-1.46,.1,.12,2.6,.12,'white');                       // pilaster between the doors
 // big shop window: lower panes, upper transom lights, cream frame
 const sa=-.34,sc=2.04,mid=.95;
 strip(sa,sc,.28,.22,.16,.5,'stone');                      // projecting stone sill
 strip(sa+.03,mid-.05,.5,1.5,.04,.4,'glass');strip(mid+.05,sc-.03,.5,1.5,.04,.4,'glass');
 strip(sa+.03,mid-.05,2.1,.6,.04,.4,'glass');strip(mid+.05,sc-.03,2.1,.6,.04,.4,'glass');
 strip(sa,sc,2.0,.1,.1,.4,'white');                        // transom bar
 strip(sa,sc,2.7,.1,.1,.4,'white');                        // head
 for(const u of [sa,mid,sc])post(u,.4,.1,2.4,.1,'white'); // jambs and central mullion
 post(.3,.5,.05,1.5,.07,'dark');post(1.5,.5,.05,1.5,.07,'dark');   // thin glazing bars

 // ---- upper storeys on the wall plane: sash windows, plaque, stone sills ----
 // [sill, height, columns]; the third row is only the gable window under the ridge.
 const colsAll=[-1.6,-.15,1.35],rows:[number,number,number[]][]=[[3.7,1.85,colsAll],[6.4,1.85,colsAll],[9.1,1.8,[-.35]]];
 for(const [sill,h,cols] of rows)for(const u of cols){
  const w=1.1,t=.08;
  slab(u,sill,w+.16,h+.16,.02,'glass');
  slab(u-w/2-t/2,sill,t,h+.16,.08,'white');slab(u+w/2+t/2,sill,t,h+.16,.08,'white');
  slab(u,sill-.08,w+.16,t,.08,'white');slab(u,sill+h,w+.16,t,.08,'white');
  slab(u,sill,.05,h,.06,'white');                                    // central glazing bar
  for(const k of [.33,.66])slab(u,sill+h*k,w,.045,.06,'white');       // sash bars
  slab(u,sill-.2,w+.4,.12,.17,'stone');                              // projecting sill
 }
 slab(-.2,3.32,.95,.26,.06,'stone');                                  // birth plaque
 slab(-.2,3.4,.7,.04,.075,'dark');slab(-.2,3.49,.5,.03,.075,'dark');   // plaque lettering lines
 // eaves/gable edge: a thin stone coping line under the roof edge
 slab(0,10.05,W,.12,.1,'stone');
}
