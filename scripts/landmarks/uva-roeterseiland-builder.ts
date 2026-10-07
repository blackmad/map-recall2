import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import source from './uva-roeterseiland-footprints.json';
type P = [number, number];
type Colour = Parameters<BuildingTools['add']>[1];
// Surveyed east/south coordinates, scale 1. The campus axes follow the long bar.
const theta = Math.atan2(11.32, 36.13), c = Math.cos(theta), s = Math.sin(theta);
export const campusNative = (u: number, v: number): P => [u*c+v*s, -u*s+v*c];
const uv = (p: number[]): P => [p[0]*c-p[1]*s, p[0]*s+p[1]*c];
export const roeterseilandMassing = { voidNorth: -13.6, voidSouth: 26.4, underside: 15.2, cityroomTop: 23.3, roof: 45.11, axesRadians: theta };
function shape(rings: number[][][]): T.Shape {
 const clean = rings.map(r => r.map(p => new T.Vector2(p[0], p[1])));
 const sh = new T.Shape(clean[0]); for (const ring of clean.slice(1)) sh.holes.push(new T.Path(ring)); return sh;
}
// Half-plane clipping of the observed bar perimeter, preserving its native outline.
function clip(ring: number[][], bound: number, above: boolean): number[][] {
 const out: number[][] = [];
 for(let i=0;i<ring.length;i++) { const a=ring[i], q=ring[(i+1)%ring.length], av=uv(a)[1], qv=uv(q)[1], ai=above?av>=bound:av<=bound, qi=above?qv>=bound:qv<=bound;
  if(ai) out.push(a); if(ai!==qi) {const t=(bound-av)/(qv-av); out.push(a.map((x,j)=>x+t*(q[j]-x)));}
 } return out;
}
/** Opaque facade primitives are backed by surveyed walls. Keep the front and
 * four reliefreturns; omit only the wall-facing back. This removes hidden export
 * faces without changing facade assembly/detail or the source-facing silhouette. */
function omitWallBack(g:T.BoxGeometry,face:number):T.BoxGeometry {
 const indices=Array.from(g.index!.array);g.setIndex(indices.filter((_v,i)=>Math.floor(i/6)!==face));g.clearGroups();return g;
}
/** First source/photo-informed native massing cycle; not a suppression-ready asset. */
export function buildUvaRoeterseiland(_w: number, _d: number, b: BuildingTools): void {
 function shell(rings: number[][][], bottom: number, top: number, colour: Colour, role: string) {
  if(!rings[0]?.length || top<=bottom) return;
  const sh=shape(rings), wall=openTopPrism(sh,bottom,top); wall.userData.role=role; b.add(wall,colour);
  const roof=upwardRoofPlane(sh,top); roof.userData.role=role+'-roof'; b.add(roof,'slate');
 }
 function boundaryAt(ring:number[][],v:number,side:number):number {
  const us:number[]=[]; for(let i=0;i<ring.length;i++){const a=uv(ring[i]),q=uv(ring[(i+1)%ring.length]);if((a[1]<=v&&q[1]>v)||(q[1]<=v&&a[1]>v))us.push(a[0]+(q[0]-a[0])*(v-a[1])/(q[1]-a[1]));}return side<0?Math.min(...us):Math.max(...us);
 }
 function box(u:number,y:number,v:number,w:number,h:number,d:number,colour:Colour,role:string) {
  const [x,z]=campusNative(u,v),g=new T.BoxGeometry(w,h,d);
  // BoxGeometryface indices:+X,-X,+Y,-Y,+Z,-Z before nativeaxisrotation.
  let back:number|undefined;
  if(role.startsWith('a-north-')||role.startsWith('north-low-')||role.startsWith('entry-pavilion-north-')||role.startsWith('entry-glazing'))back=4;
  // A side-ribbon backs retained at surveyedcorner/setback transitions.
  // B/C pane backs retained: native perimeter setbacks expose some under obliqueviews.
  else if(role.startsWith('entry-pavilion-east-'))back=1;
  else if(role.startsWith('entry-pavilion-west-'))back=0;
  else if(role==='b-south-end-office-glazing')back=5;
  if(back!==undefined)omitWallBack(g,back);
  g.userData.role=role;b.add(g,colour,x,y+h/2,z,theta);
 }
 const main=source.roofs.find(r=>r.index===722)!;
 // Roof survey does not see the underside. Architect's four-storey/40m cut controls
 // this bounded estimate. Only the crossing segment is raised; bank-side towers remain.
 const north=clip(main.rings[0],roeterseilandMassing.voidNorth,false);
 const span=clip(clip(main.rings[0],roeterseilandMassing.voidNorth,true),roeterseilandMassing.voidSouth,false);
 const south=clip(main.rings[0],roeterseilandMassing.voidSouth,true);
 // Equipment holes in the 3DBAG top are not open shafts through the building.
 shell([north],0,roeterseilandMassing.roof,'bronze','bar-north');
 shell([span],roeterseilandMassing.underside,roeterseilandMassing.roof,'dark','raised-cityroom');
 shell([south],0,roeterseilandMassing.roof,'dark','bar-south');
 // Source3438 shows the set-back A rooftop enclosure as opaque charcoal.
 // The height and footprint remain surveyed; camera perspective does not supply
 // an alternative measured plant height. Full physical parent's measured roof islands. Small fitted plant tops start on
 // surrounding roofs; none becomes a tall ground-to-equipment extrusion.
 for(const r of source.roofs) {
  if(r.index===722 || r.area<.5 || r.minHeight>55) continue;
  const top=(r.minHeight+r.maxHeight)/2;
  if(r.index===728) {
   // Ground-up survey top does not encode the deep entrance recess seen in3437.
   shell([clip(r.rings[0],39,false)],11.55,top,'dark','entry-roof-slab');
   shell([clip(r.rings[0],39,true)],0,top,'concrete','entry-rear');
   continue;
  }
  const bottom=r.index===681?43.58:r.minHeight>46?43.58:r.area<80?(r.minHeight>35?39.0:r.minHeight>23?26.6:r.minHeight>10?12.1:7.9):0;
  if(top<=bottom) continue;
  const colour:Colour=r.index===734?'stone':r.index===756?'concrete':r.index===748?'dark':r.index===681?'dark':top>25?'bronze':'concrete';
  shell(r.rings,bottom,top,colour,'survey-'+r.index);
 }
 // Current municipal source resolves734 streetfront (Krater/REC E ancillary
 // within the samephysicalBAGparent). Warmmasonry, broadwindowtiers,glassblock
 // panel,clerestory andstraightdarkroofcap; the apparentpanorama arch is distortion.
 // Actual63.98m surveyedge ownspositions/tangent. Bay/paneldimensions approximate.
 const streetAnnex=source.roofs.find(r=>r.index===734)!;
 const fa=streetAnnex.rings[0][11],fb=streetAnnex.rings[0][12];
 const fl=Math.hypot(fb[0]-fa[0],fb[1]-fa[1]),fx=(fb[0]-fa[0])/fl,fz=(fb[1]-fa[1])/fl,fnx=-fz,fnz=fx,angle=Math.atan2(-fz,fx);
 function annexFace(at:number,y:number,w:number,h:number,d:number,col:Colour,role:string,outset=.22){
  const g=omitWallBack(new T.BoxGeometry(w,h,d),5);g.userData.role=role;b.add(g,col,fa[0]+at*fx+outset*fnx,y+h/2,fa[1]+at*fz+outset*fnz,angle);
 }
 for(let at=3.5;at<fl-2;at+=4.5){
  for(const [y,h] of [[.45,2.65],[4.05,3.15],[8.20,3.15]]){
   if(y>3&&at>17&&at<28)continue; // observedtwo-storeyglassblock assembly
   annexFace(at,y,3.15,h,.16,'glass','north-annex-west-window');
   for(const offset of [-1.63,1.63])annexFace(at+offset,y,.075,h,.12,'dark','north-annex-west-window-jamb',.34);
   annexFace(at,y+h,3.32,.085,.12,'dark','north-annex-west-window-head',.34);
   // Source broaduppergroups have a principalvertical mullion and shallow
   // headvents. Groundglazing uses tall doubleleaf/entrance framing instead.
   annexFace(at,y,.080,h,.12,'dark',y>3?'north-annex-upper-vertical-mullion':'north-annex-ground-door-stile',.34);
   if(y>3)for(const f of [.72,.88])annexFace(at,y+h*f,3.15,.055,.12,'dark','north-annex-upper-head-transom',.34);
   else annexFace(at,y+h*.87,3.15,.075,.12,'dark','north-annex-ground-door-head',.34);
  }
  annexFace(at,12.9,4.35,1.1,.16,'glass','north-annex-west-clerestory');
  annexFace(at,12.9,.07,1.1,.12,'dark','north-annex-west-clerestory-jamb',.34);
 }
 // Paleglassblockface is originalflat geometry; no sampledphotographtexture.
 annexFace(22.5,4.05,7.80,7.30,.16,'frame','north-annex-west-glassblock');
 for(let q=-3.9;q<=3.91;q+=.45)annexFace(22.5+q,4.05,.035,7.3,.10,'concrete','north-annex-glassblock-grid',.33);
 for(let y=4.05;y<=11.35;y+=.45)annexFace(22.5,y,7.8,.035,.10,'concrete','north-annex-glassblock-grid',.33);
 // Principal2x2 frames visibly dominate the fineblockjoints in current source.
 // Approximate framing widths; retain the acceptednativepanelplace/tierheights.
 annexFace(22.5,4.05,.16,7.3,.13,'dark','north-annex-glassblock-central-mullion',.41);
 annexFace(22.5,7.61,7.8,.18,.13,'dark','north-annex-glassblock-storey-divider',.41);
 for(const q of [-3.90,3.90])annexFace(22.5+q,4.05,.13,7.3,.13,'dark','north-annex-glassblock-outer-frame',.41);
 for(const y of [4.05,11.22])annexFace(22.5,y,7.8,.13,.13,'dark','north-annex-glassblock-outer-frame',.41);
 annexFace(fl/2,14.15,fl,1.0,.55,'dark','north-annex-straight-roof-fascia',.25);
 // Current municipal735 east source00061 (20Jan2025): only surveyededge30.
 // Broad nearhalf is opaque darkbrick; narrow upper openings/ground doors
 // cluster toward farreturn. Metricdimensions/counts are photo approximations.
 // This shallow facing leaves unseen735 faces/CREA untouched and surveyroof intact.
 // Per-model spec overrides use previouslyunused brick/blue slots only here.
 // Warmblack wall/dark openings are sourcecolour approximations; frames reuse dark.
 const lowEast=source.roofs.find(r=>r.index===735)!;
 const ea=lowEast.rings[0][30],eb=lowEast.rings[0][31];
 const el=Math.hypot(eb[0]-ea[0],eb[1]-ea[1]),ex=(eb[0]-ea[0])/el,ez=(eb[1]-ea[1])/el;
 function eastFace(at:number,y:number,w:number,h:number,d:number,col:Colour,role:string,outset=.13){
  const g=omitWallBack(new T.BoxGeometry(w,h,d),5);g.userData.role=role;
  b.add(g,col,ea[0]+at*ex-outset*ez,y+h/2,ea[1]+at*ez+outset*ex,Math.atan2(-ez,ex));
 }
 const eastTop=(lowEast.minHeight+lowEast.maxHeight)/2;
 eastFace(el/2,0,el,eastTop,.06,'brick','east-low-735-edge30-dark-brick',.035);
 // Flat parapetline is the walltop, not an added unsupportedroof plate.
 // Six clear upper slots represent the visible group, not a measuredcount.
 for(const at of [11.5,12.9,14.3,15.7,17.1,18.5]){
  eastFace(at,4.15,.68,2.65,.08,'blue','east-low-735-upper-slot');
  for(const q of [-.38,.38])eastFace(at+q,4.1,.08,2.75,.07,'dark','east-low-735-upper-jamb',.20);
  for(const y of [4.05,6.80])eastFace(at,y,.84,.08,.07,'dark','east-low-735-upper-head-sill',.20);
 }
 eastFace(9.4,.12,1.55,2.95,.08,'blue','east-low-735-service-door',.16);
 eastFace(11.7,.12,1.30,2.95,.08,'blue','east-low-735-ground-entry');
 for(const at of [14.0,15.5,17.0])eastFace(at,.12,.62,2.95,.08,'blue','east-low-735-ground-slot');
 for(const [at,w] of [[9.4,1.55],[11.7,1.30],[14.0,.62],[15.5,.62],[17.0,.62]]){
  for(const q of [-w/2-.045,w/2+.045])eastFace(at+q,.08,.09,3.07,.07,'dark','east-low-735-ground-jamb',.22);
  eastFace(at,3.08,w+.18,.09,.07,'dark','east-low-735-ground-head',.22);
 }
 // Critical glazing: office rhythm over the wide double-height glazed lintel.
 // Native planes lie just proud of the solid shell, with recess represented by frame.
 for(const side of [-1,1]) {
  for(let v=-31;v<69;v+=2.5) {
   const u=boundaryAt(main.rings[0],v,side);
   if(v<-13.6||v>26.4)for(let y=.9;y<23;y+=4.0)box(u+side*.22,y,v,.16,3.12,1.25,'glass','bar-bank-office-glazing');
   for(let y=24.2;y<43.5;y+=4.0) box(u+side*.22,y,v,.16,3.12,1.25,'glass','bar-office-glazing');
   if(v>-12.7&&v<25.5) box(u+side*.24,15.6,v,.18,7.3,2.33,'glass','cityroom-glazing');
  }
  // Double-height curtain wall has a single intermediate transom, not office slots.
  const u=boundaryAt(main.rings[0],6.4,side);
  box(u+side*.34,19.3,6.4,.12,.10,39.2,'frame','cityroom-transom');
 }
 // Operator facade-restoration drawing/pilotphoto: B's exposed southern end
 // repeats narrow vertical office panes above the foreground8m annex. Position
 // each on the actual terminal boundary, retaining survey735 and its unknown faces.
 for(let u=-14;u<3.5;u+=2.5) {
  const ring=main.rings[0].map(uv),vs:number[]=[];
  for(let j=0;j<ring.length;j++){const a=ring[j],q=ring[(j+1)%ring.length];if((a[0]<=u&&q[0]>u)||(q[0]<=u&&a[0]>u))vs.push(a[1]+(q[1]-a[1])*(u-a[0])/(q[0]-a[0]));}
  const v=Math.max(...vs);if(!Number.isFinite(v))continue;
  for(let y=8.9;y<43;y+=4)box(u,y,v+.23,1.25,3.12,.16,'glass','b-south-end-office-glazing');
 }
 // Current architect exterior399/401: west-facing bank-end stair zones
 // interrupt the narrow office slots with broad vertically stacked curtain panes.
 // Their8m allocations are photo/plan approximations; do not mirror onto the east
 // facade without a matching built reference. Native face remains survey-bounded.
 // Southern lower faces are occluded by genuine survey689/entrance volumes;
 // no claim of exposed glazing below12m and those bank assemblies remainpending.
 for(const v of [-28,-25.6,-23.2,28,30.4,32.8]) {
  const u=boundaryAt(main.rings[0],v,-1);
  for(let y=v>0?12.65:.65;y<43;y+=4.0){
   box(u-.40,y,v,.18,3.40,2.28,'glass','west-bank-stair-glazing');
   box(u-.53,y,v,.10,3.40,.08,'frame','west-bank-stair-mullion');
   box(u-.53,y+3.40,v,.10,.10,2.38,'frame','west-bank-stair-transom');
  }
 }
 // Pale exposed underside rails convey the source's ribbed soffit without pixels.
 for(let v=-12.8;v<25.8;v+=1.4)box(-5.8,15.08,v,18.9,.12,.09,'frame','soffit-rib');
 // A tower: horizontal ribbons, distinct from B/C's vertical office slots.
 // The exact native roof perimeter controls walls; trim remains bounded to long faces.
 const tower=source.roofs.find(r=>r.index===748)!;
 // Source3437 north-facing A ribbons at the entrance; actual surveyed front edge.
 const northV=(u:number)=>{const vs:number[]=[];const ring=tower.rings[0].map(uv);for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length];if((a[0]<=u&&q[0]>u)||(q[0]<=u&&a[0]>u))vs.push(a[1]+(q[1]-a[1])*(u-a[0])/(q[0]-a[0]));}return Math.min(...vs);};
 for(let u=-71;u<-36;u+=3.4)for(let y=12.65;y<40;y+=3.85){const v=northV(u);box(u,y,v-.23,3.2,1.6,.14,'glass','a-north-ribbon');box(u,y+1.6,v-.34,3.35,.14,.15,'frame','a-north-ribbon-trim');box(u,y+2.75,v-.23,3.2,.48,.14,'glass','a-north-clerestory');box(u,y+3.23,v-.34,3.35,.10,.15,'frame','a-north-clerestory-trim');}
 for(const side of [-1,1]) for(let v=30;v<60;v+=3.4) {
  const u=boundaryAt(tower.rings[0],v,side);
  for(let y=12.65;y<40;y+=3.85) {
   box(u+side*.25,y,v,.14,1.6,3.2,'glass','a-ribbon');
   box(u+side*.36,y+1.6,v,.15,.14,3.35,'frame','a-ribbon-trim');
   box(u+side*.25,y+2.75,v,.14,.48,3.2,'glass','a-clerestory');
   box(u+side*.36,y+3.23,v,.15,.10,3.35,'frame','a-clerestory-trim');
  }
 }
 // Source3439 northern lower block: pale masonry, long narrow paired-floor
 // slots and a glazed roof-level ribbon. Facade-family allocation to patch756
 // is a plan/photo inference pending independent native context confirmation.
 const northBlock=source.roofs.find(r=>r.index===756)!;
 for(let u=-25.5;u<7;u+=2.8) {
  const ring=northBlock.rings[0].map(uv),vs:number[]=[];
  for(let j=0;j<ring.length;j++){const a=ring[j],q=ring[(j+1)%ring.length];if((a[0]<=u&&q[0]>u)||(q[0]<=u&&a[0]>u))vs.push(a[1]+(q[1]-a[1])*(u-a[0])/(q[0]-a[0]));}
  const v=Math.min(...vs);if(!Number.isFinite(v))continue;
  for(const y of [5,15]){box(u,y,v-.18,.90,7.4,.15,'glass','north-low-paired-slot');box(u,y+3.2,v-.28,.9,1.2,.13,'dark','north-low-spandrel');}
  box(u,24.0,v-.2,2.65,1.7,.15,'glass','north-low-roof-ribbon');
  box(u,25.7,v-.3,2.8,.14,.15,'frame','north-low-roof-trim');
 }
 // Photo3437/siteplan: curtain-glazed low pavilion immediately west/right of
 // the entrance. Source3438 independently exposes its full canal-facing frontage,
 // so this cycle extends glazing to its actual surveyed north boundary. Unpictured
 // rear/side perimeter remains unresolved. Three glazing tiers are photo-guided.
 const pavilion=source.roofs.find(r=>r.index===708)!;
 for(let u=-85.6;u<-36;u+=2.8) {
  const ring=pavilion.rings[0].map(uv),vs:number[]=[];
  for(let j=0;j<ring.length;j++){const a=ring[j],q=ring[(j+1)%ring.length];if((a[0]<=u&&q[0]>u)||(q[0]<=u&&a[0]>u))vs.push(a[1]+(q[1]-a[1])*(u-a[0])/(q[0]-a[0]));}
  const v=Math.min(...vs);if(!Number.isFinite(v))continue;
  for(const [y,h] of [[.4,2.35],[3.0,4.25],[7.5,4.15]]){
   box(u,y,v-.22,2.60,h,.15,'glass','entry-pavilion-north-glazing');
   box(u,y,v-.34,.075,h,.12,'frame','entry-pavilion-north-mullion');
   box(u,y+h,v-.34,2.8,.10,.12,'frame','entry-pavilion-north-transom');
  }
 }
 for(const v of [20.3,23.1,26.5]) {
  const u=boundaryAt(pavilion.rings[0],v,1);
  for(const [y,h] of [[.4,2.35],[3.0,4.25],[7.5,4.15]]){
   box(u+.22,y,v,.15,h,2.50,'glass','entry-pavilion-east-glazing');
   box(u+.34,y,v,.12,h,.075,'frame','entry-pavilion-east-mullion');
   box(u+.34,y+h,v,.12,.10,2.70,'frame','entry-pavilion-east-transom');
  }
 }
 // Current municipal Dec2024 west-street capture and source3440 expose
 // the long708 west pavilion return. Detail follows each actual survey edge;
 // no glass is added to the courtyard or unseen rear faces by symmetry.
 for(let v=20.3;v<82;v+=2.8) {
  const u=boundaryAt(pavilion.rings[0],v,-1);
  for(const [y,h] of [[.4,2.35],[3.0,4.25],[7.5,4.15]]) {
   box(u-.22,y,v,.15,h,2.50,'glass','entry-pavilion-west-glazing');
   box(u-.34,y,v,.12,h,.075,'frame','entry-pavilion-west-mullion');
   box(u-.34,y+h,v,.12,.10,2.70,'frame','entry-pavilion-west-transom');
  }
 }
 // Photo3437: deep pale portal, inset back glazing and two exposed supports.
 // Survey roof728 supplies the native hall outline; photo-based8m reveal depth
 // and bridge dimensions remain bounded approximations, not inspected measures.
 box(-24.2,.55,38.76,17.8,10.9,.16,'glass','entry-glazing');
 for(let u=-32.6;u<-15.7;u+=2.45)box(u,.55,38.60,.085,10.9,.10,'frame','entry-glazing-mullion');
 box(-24.2,4.25,38.59,17.8,.095,.10,'frame','entry-glazing-transom');
 box(-24.2,11.38,32.7,18.8,.17,12.55,'concrete','entry-pale-soffit');
 for(const u of [-33.1,-14.75])box(u,.55,32.7,.40,11.0,12.55,'concrete','entry-pale-reveal');
 box(-24.2,11.55,26.08,19.1,.78,.45,'dark','entry-lintel');
 for(const u of [-29.6,-19.1])box(u,.55,29.2,.22,10.9,.22,'concrete','entry-support');
 // Final photo shows a broad timber ramp beside a central stepped arrival.
 // Sketch options support widened bank ends; they are proposals, not dimensions
 // of the final built bridge.7m neck /17m landing approximate its observed ratio.
 const deckUV:P[]=[[-27.7,-2],[-20.7,-2],[-20.7,15],[-15.7,26.1],[-15.7,29],[-32.7,29],[-32.7,26.1],[-27.7,15]];
 const deck=shape([deckUV.map(p=>campusNative(...p))]);
 const timber=openTopPrism(deck,.5,.78);timber.userData.role='pedestrian-widened-deck';b.add(timber,'bronze');
 const top=upwardRoofPlane(deck,.78);top.userData.role='pedestrian-widened-deck-roof';b.add(top,'bronze');
 // A ramp gains the entry landing height along the western branch.
 const rampUV:P[]=[[-32.55,17],[-27.55,17],[-27.55,28.7],[-32.55,28.7]];
 const rampG=new T.BufferGeometry();const rampPts=rampUV.map(([u,v])=>{const[x,z]=campusNative(u,v);return[x,.78+(v-17)/11.7*.82,z]});
 rampG.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>rampPts[i]),3));rampG.computeVertexNormals();rampG.userData.role='pedestrian-ramp';b.add(rampG,'bronze');
 // Bounded six-rise approximation conveys the photographed split staircase.
 for(let i=0;i<6;i++)box(-23.2,.78,23.4+i*.8,5.6,(i+1)*.14,.82,'concrete','pedestrian-stair');
 box(-24.2,1.48,29.7,17.0,.18,2.0,'concrete','entry-landing');
 for(const u of [-27.7,-20.7]) {
  box(u,1.72,6.5,.08,.08,17,'dark','bridge-handrail');
  for(let v=-1.7;v<15;v+=.7)box(u,.78,v,.045,.94,.045,'dark','bridge-baluster');
 }
 for(const u of [-32.55,-27.55]) {
  for(let v=17.2;v<28.5;v+=.7)box(u,.78+(v-17)/11.7*.82,v,.045,.94,.045,'dark','ramp-baluster');
 }
}
