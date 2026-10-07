import assert from 'node:assert/strict';
import * as T from 'three';
import {buildBrouwerijHetIj} from './landmarks/brouwerij-het-ij-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import data from './landmarks/brouwerij-het-ij-footprints.json';
import spec from './landmarks/brouwerij-het-ij-spec.json';
const geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;geometries.push(g)};
const unused=()=>{throw Error('unexpected primitive')};buildBrouwerijHetIj(0,0,{add,box:unused,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused});
const bounds=new T.Box3();let triangles=0;const meshes=geometries.map(g=>{g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));triangles+=(g.index?.count??g.getAttribute('position').count)/3;return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const ray=(p:T.Vector3,d:T.Vector3)=>new T.Raycaster(p,d).intersectObjects(meshes)[0] as T.Intersection<T.Mesh>|undefined;
const a=new T.Vector2(...data.outline[0][12] as [number,number]),b=new T.Vector2(...data.outline[0][13] as [number,number]),t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),at=(u:number,v:number)=>a.clone().addScaledVector(t,u).addScaledVector(n,v);
const front=(u:number,y:number)=>{const p=at(u,8);return ray(new T.Vector3(p.x,y,p.y),new T.Vector3(-n.x,0,-n.y))};
// Fractional full-height samples seek buried glazing, including pane edges.
for(const u of [.8,2.15,3.7,5.03,6.36,7.69,9.02,10.55,11.9])for(const f of[-.42,0,.42])for(const y of[5.02,5.8,6.55,6.9])assert.equal(front(u+f*.79,y)?.object.geometry.userData.assembly,'upper-window-glass',`exposed upper pane${u}/${f}/${y}`);
for(const u of[4.15,7.45,10.75,15.7])for(const f of[-.3,.3])assert.equal(front(u+f,1.3)?.object.geometry.userData.palette,'glass','current street doorway exposed');
assert.equal(front(.75,1.4)?.object.geometry.userData.assembly,'left-utility-door');
for(const g of geometries.filter(g=>g.userData.assembly==='pavilion-pitched-roof')){const q=g.index?g.toNonIndexed():g,p=q.getAttribute('position');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert(b.sub(a).cross(c.sub(a)).y>0,'pavilion roofs face upward');}}
// Dark annex side is only its8m surveyed upper edge, not the entire16m
// parent boundary; the latter produced floating strips above a low wing.
const wing=data.surveyRoofRegions.find(r=>r.index===86)!,wa=new T.Vector2(wing.rings[0][8][0],wing.rings[0][8][2]),wb=new T.Vector2(wing.rings[0][9][0],wing.rings[0][9][2]),wt=wb.clone().sub(wa).normalize(),wn=new T.Vector2(-wt.y,wt.x),wl=wa.distanceTo(wb);
for(const f of[-.4,-.2,0,.2,.4]){const p=wa.clone().addScaledVector(wt,wl/2+f*4.3).addScaledVector(wn,4),hit=ray(new T.Vector3(p.x,5.6,p.y),new T.Vector3(-wn.x,0,-wn.y));assert.equal(hit?.object.geometry.userData.assembly,'annex-side-window-glass','annex side pane attached to actual upper wall');}
for(const g of geometries.filter(g=>g.userData.assembly==='annex-side-cladding'))for(let i=0;i<g.getAttribute('position').count;i++){const p=g.getAttribute('position'),u=(p.getX(i)-wa.x)*wt.x+(p.getZ(i)-wa.y)*wt.y;assert(u>-.01&&u<wl+.01,'cladding bounded to surveyed upper edge');}
// Terrace doors remain visible across leaf widths before their actual shell.
const ea=new T.Vector2(...data.outline[0][3] as [number,number]),eb=new T.Vector2(...data.outline[0][5] as [number,number]),et=eb.clone().sub(ea).normalize(),en=new T.Vector2(-et.y,et.x),el=ea.distanceTo(eb);
for(let i=0;i<3;i++)for(const fraction of[-.25,.25]){const p=ea.clone().addScaledVector(et,el*(i+.5)/3+fraction*(el/3-.38)).addScaledVector(en,5),hit=ray(new T.Vector3(p.x,1.7,p.y),new T.Vector3(-en.x,0,-en.y));assert.equal(hit?.object.geometry.userData.assembly,'terrace-door-glass','current terrace door glazing exposed');}
// Tall thin AHN/sail fin must not become an18m slab, and no low-wing cap may
// hide the actual first-hit pavilion or dark-annex roof.
assert(bounds.max.y>10.5&&bounds.max.y<11.2);
for(const u of[1.725,b.distanceTo(a)-1.725]){const p=at(u,-2.56),hit=ray(new T.Vector3(p.x,25,p.y),new T.Vector3(0,-1,0));assert(hit&&hit.point.y>10.4,'pavilion ridge owns top');}
const low=data.surveyRoofRegions.find(r=>r.index===90)!.rings[0];assert(low.every(p=>p[1]>18));
// Terrace, mill center and side neighboring parent exterior probes stay open.
for(const p of[new T.Vector3(-22,25,-16),new T.Vector3(-14,25,-7),new T.Vector3(15,25,-13)])assert.equal(ray(p,new T.Vector3(0,-1,0)),undefined,'independent mill/terrace/neighbor outside scope');
assert.deepEqual(spec.suppressOsmIds,['w269052426','NL.IMBAG.Pand.0363100012169757']);assert.equal(spec.spatialSuppression,false);assert(triangles<40000);
const lettering=geometries.find(g=>g.userData.assembly==='source-supported-real-sign-lettering')!;assert.equal(lettering.userData.fontApproximation,'Archivo Black');
const realPanel=geometries.find(g=>g.userData.assembly==='real-sign-panel')!;
const faceBounds=(g:T.BufferGeometry)=>{const p=g.getAttribute('position'),along:number[]=[],y:number[]=[];for(let i=0;i<p.count;i++){along.push(p.getX(i)*t.x+p.getZ(i)*t.y);y.push(p.getY(i));}return{width:Math.max(...along)-Math.min(...along),height:Math.max(...y)-Math.min(...y)};};
const textSize=faceBounds(lettering),panelSize=faceBounds(realPanel),signWidthFraction=textSize.width/panelSize.width,signHeightFraction=textSize.height/panelSize.height;
assert(signWidthFraction>.60&&signWidthFraction<.66,'current photographed word fills about63%red panel, avoiding failed tiny sign');assert(signHeightFraction>.69&&signHeightFraction<.80,'current photographed word fills about3/4panel height');

console.log(JSON.stringify({id:spec.id,triangles,upperWindows:9,signWidthFraction,signHeightFraction,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'native geometry/first-hit glazing/roof/open-space pass; visual/publication status recorded separately in brewery-review.json'}));
