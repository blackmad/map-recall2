// node --import tsx scripts/check-museums2-geometry.ts [id...]
// Bounds/height vs 3DBAG roof extent, no floating parts, triangle cap, installed GLB present.
import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildTortureMuseum} from './landmarks/torture-museum-builder';
import {buildTheoThijssenMuseum} from './landmarks/theo-thijssen-museum-builder';
import {buildPatheDeMunt} from './landmarks/pathe-de-munt-builder';
const builders:Record<string,(w:number,d:number,b:BuildingTools)=>void>={'pathe-de-munt':buildPatheDeMunt,'torture-museum':buildTortureMuseum,'theo-thijssen-museum':buildTheoThijssenMuseum};
const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(builders);
for(const id of ids){
 const build=builders[id];assert(build,`no builder for ${id}`);
 const gs:T.BufferGeometry[]=[];
 const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);gs.push(g)};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const unused=()=>{throw Error('unused primitive')};
 build(0,0,{add,box,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused});
 const data=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`));
 const bounds=new T.Box3();let tris=0;
 for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);tris+=(g.index?.count??g.getAttribute('position').count)/3}
 const roofMax=Math.max(...data.roofs.flatMap((r:any)=>r.rings.flat().map((p:number[])=>p[1])));
 assert(tris<25000,`${id}: triangle cap`);assert(bounds.min.y>=-.001,`${id}: nothing below ground`);
 assert(Math.abs(bounds.max.y-roofMax)<1.0,`${id}: height ${bounds.max.y} vs 3DBAG roof max ${roofMax}`);
 // every part must touch or overlap the footprint bounding box (no floating pieces)
 const ring=data.ring[0] as number[][],fx=ring.map(p=>p[0]),fz=ring.map(p=>p[1]),m=3;
 for(const g of gs){const b=g.boundingBox!;assert(b.max.x>Math.min(...fx)-m&&b.min.x<Math.max(...fx)+m&&b.max.z>Math.min(...fz)-m&&b.min.z<Math.max(...fz)+m,`${id}: part outside footprint area`)}
 const glb=`public/canal-drive/models/${id}.glb`;assert(fs.existsSync(glb),`${id}: GLB missing`);
 console.log(JSON.stringify({id,triangles:tris,height:+bounds.max.y.toFixed(2),roofMax:+roofMax.toFixed(2),glbBytes:fs.statSync(glb).size}));
}
