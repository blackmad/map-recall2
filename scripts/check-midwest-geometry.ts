import * as T from 'three';import assert from 'node:assert/strict';
import {buildMidwest} from './landmarks/midwest-builder';import type {BuildingTools} from './landmarks/cultural-builders';import spec from './landmarks/midwest-spec.json';import source from './landmarks/midwest-footprints.json';
const group=new T.Group();let triangles=0;const b={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=a;group.add(m);triangles+=(g.index?.count??g.attributes.position.count)/3;}} as unknown as BuildingTools;
buildMidwest(1,1,b);group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);assert(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));assert(bounds.max.y>22&&bounds.max.y<24);assert(bounds.max.x-bounds.min.x<48);assert(bounds.max.z-bounds.min.z<32);assert(triangles<40000);
const rot=new T.Matrix4().makeRotationY(.28),p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(rot);function hit(x:number,y:number,z:number,dx:number,dz:number){return new T.Raycaster(p(x,y,z),new T.Vector3(dx,0,dz).transformDirection(rot)).intersectObjects(group.children)[0];}
for(let i=0;i<5;i++)for(const y of [1.05,5.75,10.5])for(const f of [-.49,-.35,-.15,.15,.35,.49]){const h=hit(-14.6+i*7.35+f*5.2,y+.5,15,0,-1);assert.equal(h?.object.name,'glass',`South classroom first-hit pane bay${i} y${y} fraction${f}`);}
for(let i=0;i<19;i++)assert.equal(hit(-9.25+i*1.3,11.2,-12,0,1)?.object.name,'glass','Upper courtyard corridor glazing');
for(const f of [-.32,.32])assert.equal(hit(-26,4.1,1.25+f*1.8,1,0)?.object.name,'glass','Cabral ladder panes clear curved entrance dams');assert.equal(hit(-26,1.3,1.7,1,0)?.object.name,'bronze','Public entry leaf exposed');
// Real west sign: first-hit strokes, open D counter, physical rail/brick backing,
// finite non-coplanar relief and no invented duplicate on the east entrance.
const signs=group.children.filter(m=>(m as T.Mesh).geometry.userData.midwestSign) as T.Mesh[];
assert.equal(signs.map(m=>m.geometry.userData.midwestSign.letter).join(''),'MIDWEST');
const signWidths=[.96,.30,.79,.96,.65,.80,.75],signScale=4.05/(signWidths.reduce((sum,w)=>sum+w,0)+.15*6),strokeU=[.14,.15,.09,.14,.14,.46,.375];
let signCursor=-2.025;
for(let i=0;i<signs.length;i++){
 const z=1.25+signCursor+strokeU[i]*signScale,y=7.735,h=hit(-26,y,z,1,0);
 assert.equal(h?.object,signs[i],`Cabral real ${'MIDWEST'[i]} stroke is first-hit, not buried`);
 const face=h!.point.clone().applyMatrix4(rot.clone().invert());assert(Math.abs(face.x-(-20.695))<.002,'Sign letters remain on actual west fascia relief plane');
 const support=new T.Raycaster(p(-26,y,z),new T.Vector3(1,0,0).transformDirection(rot)).intersectObjects(group.children.filter(m=>!signs.includes(m as T.Mesh)))[0];
 assert.equal(support?.object.name,'brick','Every letter has source brick fascia behind it');
 const backing=support!.point.clone().applyMatrix4(rot.clone().invert());assert(Math.abs(face.x-backing.x)<.14,'No floating or distant sign board');
 const vertices=signs[i].geometry.attributes.position,localBounds=new T.Box3();for(let j=0;j<vertices.count;j++)localBounds.expandByPoint(new T.Vector3().fromBufferAttribute(vertices,j).applyMatrix4(rot.clone().invert()));
 assert(localBounds.min.y>=7.489&&localBounds.max.y<=7.981&&localBounds.min.z>=-.776&&localBounds.max.z<=3.276,'Original glyphs fit photographed native fascia');
 if(i===2)assert.equal(hit(-26,7.735,1.25+signCursor+.37*signScale,1,0)?.object.name,'brick','D counter remains open and reveals physical brick backing');
 signCursor+=(signWidths[i]+.15)*signScale;
}
for(const y of [7.59,7.81])assert.equal(hit(-26,y,-.90,1,0)?.object.name,'dark','Source dark sign rails are visible at their exposed ends');
// Independent ref-0 photo landmarks: upper fascia481, glyph522–544, curved
// head589. Approximate same-plane clearances are 41/22 and45/22 glyph heights.
// Probe the actual mesh cap/band and letter bounds, not just metadata values.
assert.equal(hit(-26,8.90,1.25,1,0)?.object.name,'slate','Source-calibrated west fascia cap exposed near8.88m');
assert.equal(hit(-26,8.80,1.25,1,0)?.object.name,'brick','Blank brick band reaches below calibrated fascia cap');
const letterBounds=new T.Box3().setFromObject(new T.Group().add(...signs.map(m=>m.clone()))),letterHeight=letterBounds.max.y-letterBounds.min.y;
const upperGap=(8.88-letterBounds.max.y)/letterHeight,lowerGap=(letterBounds.min.y-6.5)/letterHeight;
assert(upperGap>1.65&&upperGap<2.10,'Upper fascia clearance follows source approximately1.86 glyph heights');
assert(lowerGap>1.80&&lowerGap<2.30,'Lower fascia clearance follows source approximately2.05 glyph heights');
// Eastern apertures were buried in the first export. Probe the independently recorded
// survey edge, each source-supported column and tier, and outward first-hit visibility.
const east=source.surveyRoofParts.find(q=>q.index===4)!.localRing.map(([x,z])=>new T.Vector2(Math.cos(.28)*x-Math.sin(.28)*z,Math.sin(.28)*x+Math.cos(.28)*z));
const ea=east[8],eb=east[9],tangent=eb.clone().sub(ea).normalize(),outward=new T.Vector2(-tangent.y,tangent.x),centre=new T.Vector2(ea.x+(1.25-ea.y)*(eb.x-ea.x)/(eb.y-ea.y),1.25);
let eastPaneProbes=0;
for(const y of [3.3,4.1,5.5,6.2])for(let col=0;col<3;col++)for(const fraction of [.2,.5,.8]){
 const u=-.9+(col+fraction)*.6,q=centre.clone().addScaledVector(tangent,u),o=q.clone().addScaledVector(outward,3);
 assert.equal(hit(o.x,y,o.y,-outward.x,-outward.y)?.object.name,'glass',`Marco Polo first-hit glazing tier ${y} column ${col} fraction ${fraction}`);eastPaneProbes++;
}
for(const u of [-.6,-.3,.3,.6]){const q=centre.clone().addScaledVector(tangent,u),o=q.clone().addScaledVector(outward,3);assert.equal(hit(o.x,1.3,o.y,-outward.x,-outward.y)?.object.name,'bronze','Marco Polo door leaves face actual survey edge');}
for(const z of [.674,1.826])for(const y of [1.3,4.1,5.5])assert.equal(hit(27,y,z,-1,0)?.object.name,y<2.5?'bronze':'glass',`Original independent east burial regression z${z} height${y}`);
// The source classroom piers project beyond the window plane through all three tiers.
for(let bay=0;bay<5;bay++)for(const side of [-1,1])for(const y of [2.2,7.0,12.1]){const x=-14.6+bay*7.35+side*3.04;const h=hit(x,y,13,0,-1);assert.equal(h?.object.name,'ochre','Rounded classroom end pier remains full-height masonry');const v=h!.point.clone().applyMatrix4(rot.clone().invert());assert(v.z>9.85,'Source classroom pier projects beyond glazing');}
// Shared dividers must have one uninterrupted projecting face, without paired lobes/grooves.
for(let bay=0;bay<4;bay++)for(const f of [-.25,0,.25])for(const y of [2.2,7.0,12.1]){const x=-14.6+(bay+.5)*7.35+f*1.95,h=hit(x,y,13,0,-1);assert.equal(h?.object.name,'ochre','Broad shared classroom divider remains masonry');const v=h!.point.clone().applyMatrix4(rot.clone().invert());assert(v.z>9.97,'Broad shared classroom divider has no recessed center groove');}
for(const z of [-6.6,9.15]){const base=hit(-26,1.5,z,1,0),upper=hit(-26,14.2,z,1,0);assert.equal(base?.object.name,'brick','Curved plinth remains red masonry');const lo=base!.point.clone().applyMatrix4(rot.clone().invert()),hi=upper!.point.clone().applyMatrix4(rot.clone().invert());assert(Math.abs(lo.x-hi.x)<.075,'Red plinth follows actual primary rounded corner without unsupported flap');}
// Curved Cabral profiles must change primary masonry, not just add narrow surface cylinders.
// Near the two exterior ends and inward turns, the upper wall recedes from its middle.
for(const z of [-6.6,9.15,.02,2.6]){const h=hit(-26,14.2,z,1,0);assert(h&&h.object.name==='ochre','Rounded upper shoulder remains masonry');const v=h.point.clone().applyMatrix4(rot.clone().invert());assert(v.x>-20.30,`Primary shoulder visibly turns inward at z${z}`);}
for(const q of source.openSpaceProbes){const h=new T.Raycaster(p(q.localUV[0],30,q.localUV[1]),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert(!h,`${q.name} must remain open`);}
for(const [u,v,height] of [[0,-4,5.486],[0,0,13.210],[0,3,14.954],[-20,1.2,13.21]]){const h=new T.Raycaster(p(u,30,v),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert.equal(h?.object.name,'slate','Terrace roof owns its top');assert(Math.abs(h!.point.y-height)<.06,'Stepped roof remains at surveyed level');}
for(const child of group.children){const m=child as T.Mesh;const g=m.geometry,v=g.attributes.position,n=g.attributes.normal;if(!g.userData.explicitRoof)continue;for(let i=0;i<(g.index?.count??v.count);i++){const j=g.index?g.index.getX(i):i;assert(n.getY(j)>.95,'Explicit roof normals upward');}}
assert.deepEqual(spec.suppressOsmIds,['w119042875','NL.IMBAG.Pand.0363100012081251']);for(const n of source.retainedContextCandidates)assert(!spec.suppressOsmIds.includes(n.properties.id));
console.log(JSON.stringify({model:'midwest',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['native scale','fractional first-hit classroom panes all tiers','courtyard corridor glazing','west entrance ladder glazing/door exposed','real west MIDWEST seven first-hit strokes, open counter, attached supports and fascia bounds','36 east glazing fractional/source-column probes and door leaves','original independent east burial regression','primary rounded Cabral wall profiles','continuous broad classroom dividers without grooves','plinth follows rounded western corners','four open gardens/recesses','upward owned terrace roofs','exact BAG/OSM replacement and retained neighbors'],visualAcceptance:'pending root gallery/live/independent review'}));
