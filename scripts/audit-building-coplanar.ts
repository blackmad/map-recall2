// Scan renderer output, not just nested footprints. Usage:
// node --import tsx scripts/audit-building-coplanar.ts [--all] [--out=path]
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildFeatureChunk,ORIGIN} from '../src/canalRecall/threeBuildingFeatures.ts';
import type {Chunk} from '../src/canalRecall/threeBuildingMesh.ts';
import {dropNestedDuplicates} from '../src/canalRecall/buildingNesting.ts';
import {polygonArea,subtractConvex,type Point2} from '../src/canalRecall/coplanarSurfaces.ts';
export function auditChunk(chunk:Chunk){
 type Face={id:string;normal:number[];d:number;poly:Point2[];box:number[];kind:string};
 const grid=new Map<string,Face[]>(),conflicts=new Map<string,{ids:string[];kind:string;areaM2:number;trianglePairs:number}>();
 const owner=new Array<string>(chunk.vertexCount);for(const r of chunk.ranges)owner.fill(r.id,r.start,r.start+r.count);
 for(let i=0;i<chunk.indices.length;i+=3){
  const ids=[chunk.indices[i],chunk.indices[i+1],chunk.indices[i+2]],p=ids.map(v=>Array.from(chunk.positions.slice(v*3,v*3+3)));
  const u=p[1].map((v,k)=>v-p[0][k]),v=p[2].map((v,k)=>v-p[0][k]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);if(len<1e-6)continue;n=n.map(v=>v/len);
  const axis=n.reduce((best,c,k)=>Math.abs(c)>Math.abs(n[best])?k:best,0);if(n[axis]<0)n=n.map(v=>-v);
  const d=n.reduce((s,c,k)=>s+c*p[0][k],0),axes=[0,1,2].filter(k=>k!==axis);
  let poly=p.map(q=>[q[axes[0]],q[axes[1]]] as Point2);
  if((poly[1][0]-poly[0][0])*(poly[2][1]-poly[0][1])-(poly[1][1]-poly[0][1])*(poly[2][0]-poly[0][0])<0)poly=poly.toReversed();
  const box=[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
  const kind=Math.abs(n[2])>.99999?'horizontal':Math.abs(n[2])<.00001?'wall':'sloped';
  const plane=`${n.map(v=>Math.round(v*10000)).join(',')}:${Math.round(d*100)}`;
  const keys:string[]=[];for(let x=Math.floor(box[0]/25);x<=Math.floor(box[2]/25);x++)for(let y=Math.floor(box[1]/25);y<=Math.floor(box[3]/25);y++)keys.push(`${plane}:${x},${y}`);
  for(const f of new Set(keys.flatMap(key=>grid.get(key)??[]))){
   if(box[0]>=f.box[2]||box[2]<=f.box[0]||box[1]>=f.box[3]||box[3]<=f.box[1])continue;
   if(p.some(p=>Math.abs(f.normal.reduce((s,c,k)=>s+c*p[k],0)-f.d)>.002))continue;
   const overlap=(polygonArea(poly)-subtractConvex(poly,f.poly).reduce((s,p)=>s+polygonArea(p),0))/Math.abs(n[axis]);if(overlap<.01)continue;
   const pair=[owner[ids[0]],f.id].sort(),key=pair.join('|')+'|'+kind;
   const hit=conflicts.get(key)??{ids:pair,kind,areaM2:0,trianglePairs:0};hit.areaM2+=overlap;hit.trianglePairs++;conflicts.set(key,hit);
  }
  const face={id:owner[ids[0]],normal:n,d,poly,box,kind};for(const key of keys){const bucket=grid.get(key)??[];bucket.push(face);grid.set(key,bucket);}
 }
 return [...conflicts.values()].sort((a,b)=>b.areaM2-a.areaM2);
}
if(process.argv[1]?.endsWith('audit-building-coplanar.ts')){
 const root='public/data/extracts/amsterdam/building-tiles/14';
 const tiles=process.argv.includes('--all')?fs.readdirSync(root).flatMap(x=>fs.readdirSync(`${root}/${x}`).filter(y=>y.endsWith('.gz')).map(y=>`${x}/${y}`)):['8412/5382.geojson.gz','8415/5383.geojson.gz'];
 const report={scope:'Generated ordinary building meshes; excludes custom GLBs and separate kit meshes. Plane grouping may miss near-coplanar planes on quantization boundaries.',origin:ORIGIN,tiles:[] as any[],conflicts:0};
 for(const tile of tiles){
  const source=JSON.parse(gunzipSync(fs.readFileSync(`${root}/${tile}`)).toString());const features=dropNestedDuplicates(source.features);
  const start=performance.now(),chunk=buildFeatureChunk(features,'photo','coarse'),ms=performance.now()-start;const hits=auditChunk(chunk);
  report.conflicts+=hits.length;report.tiles.push({tile,features:features.length,buildMs:Math.round(ms),conflicts:hits});
 }
 const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'artifacts/sloterdijk-zfight/audit.json';fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify({tiles:tiles.length,conflicts:report.conflicts,out,largest:report.tiles.flatMap(t=>t.conflicts.map((c:any)=>({tile:t.tile,...c}))).sort((a,b)=>b.areaM2-a.areaM2).slice(0,10)}));
}
