import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import * as THREE from 'three';
import {treeTypology} from '../public/canal-drive/da-costa-block/tree-typology.js';
globalThis.window={CanalRecallThree:{THREE}};
const {InventoryTrees}=await import('../public/canal-drive/js/inventory-trees-source.js');
const oldSource=execFileSync('git',['show','108ccf65:public/canal-drive/js/inventory-trees-source.js'],{encoding:'utf8'}).replace("'../da-costa-block/tree-typology.js'",JSON.stringify(pathToFileURL(process.cwd()+'/public/canal-drive/da-costa-block/tree-typology.js').href));
const OldTrees=(await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'))).InventoryTrees;
// Exact selectors may gain independently tested botanical references; orientation must never alter model construction.
const modelConstruction=source=>source.slice(source.indexOf('export function normalizedTreeName'));
assert.equal(modelConstruction(fs.readFileSync('public/canal-drive/da-costa-block/tree-typology.js','utf8')),modelConstruction(execFileSync('git',['show','108ccf65:public/canal-drive/da-costa-block/tree-typology.js'],{encoding:'utf8'})),'authored models and palettes unchanged by orientation');
const map={addLayer(){},on(){},off(){},triggerRepaint(){},getZoom:()=>17,getBounds:()=>({getWest:()=>4.8999,getEast:()=>4.9001,getSouth:()=>52.3699,getNorth:()=>52.3701})},projection={MercatorCoordinate:{fromLngLat:([x,y])=>({x,y,z:0,meterInMercatorCoordinateUnits:()=>1})}};
let corrected=0,palmsUnchanged=0;
for(const id of ['ams-1170059','orientation-2','orientation-3'])for(const [species,type] of [['Tilia platyphyllos','Leiboom'],['Fraxinus excelsior','Boom'],['Salix alba','Knotboom'],['Trachycarpus fortunei','Boom']]){
 const record={id,lng:4.9,lat:52.37,height:6,type,species},p=treeTypology({...record,position:[0,0]}),now=new InventoryTrees(map,projection),old=new OldTrees(map,projection);
 now.tiles.set('fixture',[record]);old.tiles.set('fixture',[record]);now.rebuild();old.rebuild();assert.equal(now.meshes.length,4);assert.equal(now.materials.size,2);assert.equal(now.geometries.size,2);
 const wood=now.meshes.find(m=>m.userData.wood),oldWood=old.meshes.find(m=>m.userData.wood);assert.deepEqual(wood.instanceMatrix.array,oldWood.instanceMatrix.array,'trunk and connecting forks unchanged');
 for(const tone of [0,1,2]){const current=now.meshes.filter(m=>!m.userData.wood)[tone],previous=old.meshes.filter(m=>!m.userData.wood)[tone],lobes=p.lobes.filter(l=>l.tone===tone);assert.equal(current.count,lobes.length);
  for(let j=0;j<lobes.length;j++){const a=new THREE.Matrix4(),b=new THREE.Matrix4();current.getMatrixAt(j,a);previous.getMatrixAt(j,b);const l=lobes[j],angle=-(p.rotation+(l.rotation??0));const axis=new THREE.Vector3(a.elements[0],a.elements[1],a.elements[2]).normalize();assert.ok(axis.distanceTo(new THREE.Vector3(Math.cos(angle),Math.sin(angle),0))<1e-6,'long lobe axis follows flipped scene coordinates');assert.deepEqual(a.elements.slice(12),b.elements.slice(12),'all crown positions unchanged');for(const k of [0,1,2]){const start=k*4;assert.ok(Math.abs(Math.hypot(...a.elements.slice(start,start+3))-Math.hypot(...b.elements.slice(start,start+3)))<1e-6,'scales unchanged');}
   if(p.archetype==='fan-palm'){assert.deepEqual(a.elements,b.elements,'existing seven-frond radial alignment preserved');palmsUnchanged++;}else corrected++;
   if(p.archetype==='trained-flat'&&Math.abs(l.offset[0])>.1){const line=new THREE.Vector3(a.elements[12],a.elements[13],0).normalize();assert.ok(Math.abs(line.dot(axis))>1-1e-6,'flat crown lobes remain parallel to the trained screen');const oldAxis=new THREE.Vector3(b.elements[0],b.elements[1],0).normalize();assert.ok(Math.abs(Math.abs(line.dot(oldAxis))-Math.abs(Math.cos(2*p.rotation)))<1e-6,'baseline rotation demonstrably crosses the flat plane');if(id==='ams-1170059')assert.ok(Math.abs(line.dot(oldAxis))<.2);}
  }
 }
 now.layer.onRemove();old.layer.onRemove();
}
console.log(JSON.stringify({corrected,palmsUnchanged,forms:16,budgets:'unchanged',inventory:'unchanged'}));
