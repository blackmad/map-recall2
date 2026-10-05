import assert from 'node:assert/strict';
import * as T from 'three';
import {buildOurLordAttic,ourLordPoint} from './landmarks/our-lord-attic-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/our-lord-attic-spec.json';
import source from './landmarks/our-lord-attic-footprints.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};
const b:BuildingTools={add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('no facade names')}};
buildOurLordAttic(0,0,b);
const bounds=new T.Box3(),material=new T.MeshBasicMaterial({side:T.DoubleSide});let triangles=0;
const meshes=gs.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const x of g.getAttribute('position').array)assert(Number.isFinite(x));g.computeBoundingBox();bounds.union(g.boundingBox!);return new T.Mesh(g,material)});
const hit=(x:number,y:number,z:number,dir:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),dir).intersectObjects(meshes,false)[0];
assert(triangles<40000);assert(bounds.max.y>19.7&&bounds.max.y<20.1);assert(bounds.max.x-bounds.min.x<22.5);assert.equal(spec.spatialSuppression,false);
for(const x of [1.9,2.5])for(const z of [-3,0,5,9])assert(!hit(x,30,z,new T.Vector3(0,-1,0)),'public Heintje Hoekssteeg must be open above ground');
for(const [x,z,min,max] of [[-2.2,0,19.7,19.9],[-8.1,-8,18.1,18.3],[7.14,4,17.5,17.7]]){const h=hit(x,30,z,new T.Vector3(0,-1,0));assert(h&&h.point.y>min&&h.point.y<max,'native main/rear/modern ridge');assert.equal(h.object.geometry.userData.palette,x===7.14?'red':'slate');}
// First-hit pane checks in photographs' canal facade bays. Probe away from mullions.
for(const [building,u,y] of [[0,-2.1,5.03],[0,.95,8.38],[1,-1.95,4.53],[1,.25,8.08]]){
 const ring=source.buildings[building].geometry.coordinates[0][0].slice(0,-1).map(ourLordPoint),p=ring[5],q=ring[building?8:6],v=q.clone().sub(p).normalize(),n=new T.Vector2(-v.y,v.x),c=p.clone().lerp(q,.5).addScaledVector(v,u).addScaledVector(n,3);
 const first=hit(c.x,y,c.y,new T.Vector3(-n.x,0,-n.y));assert(first);assert.equal(first.object.geometry.userData.palette,'glass','facade pane must be physically exposed');
}
// Generic street-side rows must never decorate the neighboring party wall,
// principal bespoke facade, or the historic pitched-roof band.
const glasses=gs.filter(g=>g.userData.palette==='glass');
for(const g of glasses){const centre=g.boundingBox!.getCenter(new T.Vector3()),top=g.boundingBox!.max.y;
 if(centre.x<1&&centre.z<11.3)assert(top<14,'unsupported historic side/roof-band opening');
 if(centre.x>10&&centre.z<11.3)assert.fail('modern neighboring party wall must not get generic windows');
 if(centre.x<-5.5)assert.fail('historic neighboring party wall must not get generic windows');
}
// Check glass-to-frame depth continuity; first-hit exposure alone also passes
// for a pane floating several centimetres in front of its frame.
let attachedPanes=0;
for(const g of glasses){const centre=g.boundingBox!.getCenter(new T.Vector3());if((g as T.BoxGeometry).parameters.depth>.1||centre.y>14)continue;
 const normals=g.getAttribute('normal'),normal=new T.Vector3(normals.getX(16),normals.getY(16),normals.getZ(16)).normalize();
 // BoxGeometry's +Z face follows the facade outward normal after rotation.
 const tangent=new T.Vector3(normal.z,0,-normal.x),width=(g as T.BoxGeometry).parameters.width;
 const from=centre.clone().addScaledVector(tangent,width*.23).addScaledVector(normal,.022);from.y+=.13;const others=meshes.filter(m=>m.geometry!==g),first=new T.Raycaster(from,normal.clone().negate(),0,.045).intersectObjects(others,false)[0];
 assert(first,'facade glass must meet frame backing with no air gap');attachedPanes++;
}
assert(attachedPanes>=30,'pane attachment checks must cover both facades and alley rows');
// The current entrance has a straight top coping and a roof set back behind
// it, rather than a facade window floating against the earlier tile gable.
const modernFront=new T.Vector2(7.14,11.81),frontTop=hit(modernFront.x,30,modernFront.y,new T.Vector3(0,-1,0));
assert(frontTop&&frontTop.point.y<15,'current entrance front must end at straight coping');
// The current roof dormer must remain attached and visible above its hip.
for(const y of [14.4,15.1,15.6])assert.equal(hit(7.35,y,16,new T.Vector3(0,0,-1))?.object.geometry.userData.palette,'glass','most of source lantern pane must remain first-hit visible above coping');
// Elevated diagonal view must also encounter glass rather than an opaque cap or hip.
assert.equal(hit(7.35,17.1,14.5,new T.Vector3(0,-.5,-1).normalize())?.object.geometry.userData.palette,'glass','elevated lantern view must preserve its defining glass face');
// Source photo top row has a shorter aperture and substantial black side reveals.
assert.equal(hit(7.5,13.40,16,new T.Vector3(0,0,-1))?.object.geometry.userData.palette,'greyBrick','top aperture must leave masonry above its source-sized opening');
// Every authored roof surface has upward normals, independent of rendering DoubleSide.
for(const g of gs.filter(g=>['slate','red'].includes(g.userData.palette)&&!g.index)){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>=-1e-5,'downward roof face');}
assert.equal(spec.landmarkId,'extract_landmarks_1791250152');assert(spec.relatedLandmarkIds.includes('extract_landmarks_769225968'));
for(const f of source.buildings){assert(spec.suppressOsmIds.includes('w'+f.properties['@id']));assert(spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+f.properties['ref:bag']));}
console.log(JSON.stringify({id:spec.id,triangles,height:bounds.max.y,width:bounds.max.x-bounds.min.x,depth:bounds.max.z-bounds.min.z,openAlley:true,firstHitPanes:4,attachedPanes}));
gs.forEach(g=>g.dispose());material.dispose();
