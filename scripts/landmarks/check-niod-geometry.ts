import * as T from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildNiod} from './niod-builder';
import type {BuildingTools} from './cultural-builders';
import data from './niod-footprints.json';
import spec from './niod-spec.json';
const group=new T.Group(),materials=new Map<string,T.MeshBasicMaterial>();
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,angle=0)=>{let m=materials.get(c);if(!m){m=new T.MeshBasicMaterial({color:c==='glass'?0x486776:0xc2b69b,side:T.DoubleSide});m.name=c;materials.set(c,m);}const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.y=angle;group.add(mesh);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('Unexpected unsupported primitive');};
const tools={add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused} as BuildingTools;
buildNiod(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const child of group.children){const mesh=child as T.Mesh,p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite),'Finite geometry');triangles+=(mesh.geometry.index?.count??p.count)/3;}
const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3());assert(size.x<18.7&&size.z<56&&size.y>22&&size.y<25,'Native width/depth and roof silhouette budget');assert(triangles<40000,'Triangle budget');
const ray=(p:T.Vector3,d:T.Vector3)=>new T.Raycaster(p,d).intersectObjects(group.children,false);
const F=27.26945;
// Actual first-hit material probes sit inside panes, away from stone transoms.
for(const [x,y] of [[-6.2,5.8],[-.8,10.3],[4.3,10.3],[-5.99,15.5]]){const h=ray(new T.Vector3(x,y,F+8),new T.Vector3(0,0,-1))[0];assert(h&&((h.object as T.Mesh).material as T.Material).name==='glass',`Exposed front pane ${x},${y}`);}
// Glazed hall sits above its supported rear roof, not buried by a wall cap.
assert(((ray(new T.Vector3(-.75,25,10),new T.Vector3(0,-1,0))[0].object as T.Mesh).material as T.Material).name==='glass','Exposed hall lightcap');
// The huge low rear plan must not inherit the tall front house roof.
const low=ray(new T.Vector3(0,30,-4),new T.Vector3(0,-1,0))[0];assert(low&&Math.abs(low.point.y-4.33)<.05,'Low middle roof remains independently low');
const roof=ray(new T.Vector3(0,30,19.2),new T.Vector3(0,-1,0))[0];assert(roof&&Math.abs(roof.point.y-22.44)<.05,'Main ridge supported');assert(roof.face!.normal.y>.9,'Main roof faces upward');
// Probe outside actual side perimeter: the reconstruction may not fill neighbors.
for(const x of [-11,11])assert(!ray(new T.Vector3(x,30,0),new T.Vector3(0,-1,0)).length,'Neighbor retention / no padded shell');
assert.deepEqual(spec.suppressOsmIds,['NL.IMBAG.Pand.0363100012169506']);assert(data.neighborsToRetain.every(n=>!spec.suppressOsmIds.includes(`NL.IMBAG.Pand.${n.properties.identificatie}`)),'Neighbors excluded from replacement');
const result={passed:true,triangles,meshes:group.children.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['finite native geometry','visible front glazing','exposed glazed hall','independently low rear roof','upward supported ridge','no padded neighbor filling','exact genuine BAG replacement']};
const path=new URL('./niod-review.json',import.meta.url);const review=JSON.parse(readFileSync(path,'utf8'));review.geometryChecks=result;writeFileSync(path,JSON.stringify(review,null,2)+'\n');console.log(JSON.stringify(result));
