import './check-boom-chicago-geometry';
import assert from 'node:assert/strict';import * as T from 'three';
import {buildNesRozentheaterLandmark} from './landmarks/nes-rozentheater-builders';import {fittedSignLayout} from './landmarks/sign-layout';import type {BuildingTools} from './landmarks/cultural-builders';
const glyphs=Object.fromEntries([...new Set('BOOMCHICAGO')].map(c=>[c,Array(7).fill('1'.repeat(c==='I'?3:5))]));
for(const id of['brakke-grond']){
 const gs:T.BufferGeometry[]=[],signs:{text:string,x:number,width:number}[]=[];
 const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const sign:BuildingTools['sign']=(text,x,y,z,pixel,c='white',maxWidth)=>{const layout=fittedSignLayout(text,glyphs,pixel,maxWidth);signs.push({text,x,width:layout.width});let u=layout.start;for(const ch of text){const rows=glyphs[ch];if(rows)for(let j=0;j<7;j++)for(let k=0;k<rows[j].length;k++)box(x+u+k*layout.pixel,y+(6-j)*layout.pixel,z,layout.pixel*.85,layout.pixel*.85,.08,c);u+=((rows?.[0].length??3)+1)*layout.pixel}};
 const b:BuildingTools={add,box,sign,prism:()=>{},gableRoof:(x,y,z,w,d,h,c)=>{const g=new T.ConeGeometry(1,h,4);g.scale(w/2,1,d/2);add(g,c,x,y+h/2,z)},hip:()=>{},window:()=>{},clock:()=>{}};
 buildNesRozentheaterLandmark(id,0,0,b);let triangles=0;for(const g of gs){triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox()}
 assert(triangles<40000);const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material));
 {
  assert.equal(signs.length,0,'no invented cultural-house lettering');const panes=meshes.filter(m=>m.geometry.userData.role==='brakke-nes-window');assert.equal(panes.length,24);
  const masonry=meshes.filter(m=>m.geometry.userData.palette==='brick');for(const pane of panes){const [x,z]=pane.geometry.userData.wallPoint,[nx,nz]=pane.geometry.userData.outward,center=pane.geometry.boundingBox!.getCenter(new T.Vector3());
   const eye=center.clone().add(new T.Vector3(nx*.6,0,nz*.6)),ray=new T.Raycaster(eye,new T.Vector3(-nx,0,-nz));const visible=ray.intersectObjects(meshes)[0];assert.equal(visible?.object.geometry.userData.role,'brakke-nes-window','pane is visible on actual outward side');
   const backing=ray.intersectObjects(masonry)[0];assert(backing&&Math.hypot(backing.point.x-x,backing.point.z-z)<.025,'window directly backed by surveyed masonry, not detached in space');
  }
 }
 console.log(JSON.stringify({id,triangles,checks:'roof/sign/wall-support'}));gs.forEach(g=>g.dispose());material.dispose();
}
