import assert from 'node:assert/strict';
import * as T from 'three';
import {buildHeinekenExperience} from './landmarks/heineken-builder';
import spec from './landmarks/heineken-spec.json';
import data from './landmarks/heineken-footprints.json';
const triangles:{colour:string;v:T.Vector3[]}[]=[];
const add=(g:T.BufferGeometry,colour:string,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const flat=g.index?g.toNonIndexed():g,p=flat.getAttribute('position');for(let i=0;i<p.count;i+=3)triangles.push({colour,v:[0,1,2].map(j=>new T.Vector3(p.getX(i+j),p.getY(i+j),p.getZ(i+j)))});};
const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildHeinekenExperience(spec.id,1,1,{add,box,clock:()=>{},sign:()=>{}} as any);
assert.equal(spec.id,'heineken-experience-amsterdam');assert.equal(spec.landmarkId,'extract_landmarks_914627337');assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w44451454','NL.IMBAG.Pand.0363100012166152']);
assert.equal(data.parent.bagId,spec.suppressOsmIds[1]);assert.ok(triangles.length<32000,'detail budget leaves room for generated glyphs/clock');assert.ok(triangles.every(t=>t.v.every(p=>[p.x,p.y,p.z].every(Number.isFinite))));
const hit=new T.Vector3();function first(origin:T.Vector3,direction:T.Vector3,filter=(t:{colour:string})=>true){const ray=new T.Ray(origin,direction);return triangles.filter(filter).flatMap(t=>ray.intersectTriangle(t.v[0],t.v[1],t.v[2],false,hit)?[{distance:origin.distanceTo(hit),point:hit.clone(),colour:t.colour}]:[]).sort((a,b)=>a.distance-b.distance)[0];}
function roof(x:number,z:number){return first(new T.Vector3(x,50,z),new T.Vector3(0,-1,0));}
// Exterior first-hit rays fail if a facade ornament is swallowed by the exact body/roof envelope.
for(const x of [-27.71,-17.51,-12.41])for(const y of [2.4,8.1,14.1,17.5]){const r=first(new T.Vector3(x,y,30),new T.Vector3(0,0,-1));assert.ok(r&&['glass','dark','frame'].includes(r.colour),`brew-house window actually exposed at ${x},${y}: ${r?.colour}`);assert.ok(r.point.z>19.6);}
for(const x of [-7.2,-2.9]){const r=first(new T.Vector3(x,8.0,30),new T.Vector3(0,0,-1));assert.ok(r&&['glass','frame','dark'].includes(r.colour),'modern entrance glazing visible from the street');}
const coolingLight=first(new T.Vector3(21.31,23.20,30),new T.Vector3(0,0,-1));assert.ok(coolingLight&&['glass','dark','frame'].includes(coolingLight.colour)&&coolingLight.point.z>15,'cooling clerestory is externally exposed below the roof, never buried inside its supporting body');
assert.equal(first(new T.Vector3(24,10,30),new T.Vector3(0,0,-1))?.colour,'brick','cooling hall is genuinely blank, not a generic window grid');
assert.equal(first(new T.Vector3(-39,12,30),new T.Vector3(0,0,-1))?.colour,'brick','malt silo keeps blank main upper wall');
assert.ok((roof(20,11)?.point.y??0)>28&&(roof(20,11)?.point.y??50)<30.6,'cooling ridge stays within measured roof heights');
assert.ok((roof(-39,11)?.point.y??0)>27&&(roof(-39,11)?.point.y??50)<31.3,'silo rooftop plant remains supported at its actual height');
assert.ok((roof(12,-19)?.point.y??0)<4.5,'low rear stable remains low');assert.ok((roof(-20,-5)?.point.y??0)>7&&(roof(-20,-5)?.point.y??50)<8,'rear workshop roof is independent of tall street front');
assert.equal(roof(-12,-15),undefined,'open exterior rear notch stays open');assert.equal(roof(35,-12),undefined,'adjacent residential/retail footprint is never filled');
for(const t of triangles.filter(t=>t.colour==='slate')){const n=t.v[1].clone().sub(t.v[0]).cross(t.v[2].clone().sub(t.v[0]));assert.ok(n.y>=-.00001,'surveyed roof lids point upward');}
// Every sampled top facade cap is supported by masonry immediately beneath it.
for(const x of [-27,-11.5]){const top=first(new T.Vector3(x,40,19.7),new T.Vector3(0,-1,0));assert.ok(top&&top.colour==='stone');const support=first(new T.Vector3(x,top.point.y-.10,19.58),new T.Vector3(0,-1,0),t=>t.colour==='brick');assert.ok(support&&top.point.y-support.point.y<.7,'corner facade cap supported, no floating roof slab');}
console.log('Heineken:',triangles.length,'triangles; actual exposed facade hits, surveyed supported roofs, low wings and untouched rear notches verified.');
