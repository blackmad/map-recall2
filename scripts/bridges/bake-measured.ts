/** Selective port from feat/measured-bridges. Never activates a bridge on geometry checks alone. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {terrainPackKey} from '../../src/canalRecall/terrainArchive.ts';
import {resolve,basename} from 'node:path';
import sharp from 'sharp';
import earcut from 'earcut';
import {buildBridgeGeometry,type BridgeBatch} from '../../src/canalRecall/bridgeGeometry.ts';
import {bridgeLngLat,bridgeLocalPoint,bridgeRoadSections,bridgeHeightAtLocal,insideBridgeOutline,validateBridgeSurfaceFile,type BridgeSurface} from '../../src/canalRecall/bridgeSurface.ts';
import {elevationTile,sampleElevationPixels,type ElevationPixels} from '../../src/canalRecall/groundElevation.ts';
const arg=(name:string,fallback='')=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const archive=arg('archive');if(!archive)throw Error('--archive=private/source/pack required');
const input=arg('input',resolve(archive,'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json'));
const cache=arg('source-cache',resolve(archive,'bridges/amsterdam-measured/raw'));
const ids=arg('ids','BRU0057,BRU0059,BRU0065').split(',');
const root='public/data/extracts/amsterdam',terrain=`${root}/terrain`;
const metadata=JSON.parse(await readFile(`${terrain}/tilejson.json`,'utf8'));
const original=await readFile(input),legacy=JSON.parse(original.toString());
const previousIndex=JSON.parse(await readFile(`${root}/measured-bridges/index.json`,'utf8').catch(()=>'{}'));
const privateDir=resolve(archive,'bridges/amsterdam-measured');await mkdir(`${privateDir}/raw`,{recursive:true});await writeFile(`${privateDir}/raw/bridge-surfaces-v1.json`,original);
const rasters:any[]=[];
const waterClearances=JSON.parse(await readFile(`${privateDir}/processed/water-clearance.json`,'utf8'));
const pixels=new Map<string,ElevationPixels>();
const packCache=new Map<string,Buffer>();
async function terrainPNG(z:number,x:number,y:number,quality=false) {
 try{return await readFile(`${terrain}/${z}/${x}/${y}${quality?'.quality':''}.png`);}catch{
  const pack=terrainPackKey(z,x,y),index=JSON.parse(await readFile(`${terrain}/packs/${pack}.json`,'utf8'));
  if(!packCache.has(pack))packCache.set(pack,await readFile(`${terrain}/packs/${pack}.bin`));
  const [offset,length]=index.tiles[`${z}/${x}/${y}${quality?':quality':''}`];return packCache.get(pack)!.subarray(offset,offset+length);
 }
}

async function ground(lngLat:readonly [number,number]) {
 const t=elevationTile(...lngLat),key=`${t.x}/${t.y}`;
 if(!pixels.has(key)) {const rgb=await sharp(await terrainPNG(16,t.x,t.y)).ensureAlpha().raw().toBuffer();const quality=await sharp(await terrainPNG(16,t.x,t.y,true)).ensureAlpha().raw().toBuffer();pixels.set(key,{rgb:new Uint8ClampedArray(rgb),quality:new Uint8ClampedArray(quality)});}
 const value=sampleElevationPixels(pixels.get(key)!,t.u,t.v);if(value.quality==='unknown')throw Error(`Missing approach ground at ${lngLat}`);return value.heightM;
}
const bridges:any[]=[];const deferred:any[]=[];const approvedIds:string[]=[];
for(const id of ids) {
 try {
 const old=legacy.bridges.find((b:any)=>b.id===id);if(!old)throw Error('No measured profile');
 const bridge:BridgeSurface=structuredClone(old);
 for(const raster of bridge.provenance.elevation.rasters){const f=`${cache}/${id}-${raster.coverage}.tif`;const bytes=await readFile(f);const sha=createHash('sha256').update(bytes).digest('hex');if(sha!==raster.sha256)throw Error('Raster hash mismatch');if(resolve(f)!==resolve(`${privateDir}/raw/${basename(f)}`)){await copyFile(f,`${privateDir}/raw/${basename(f)}`);await copyFile(f+'.json',`${privateDir}/raw/${basename(f)}.json`);}rasters.push({bridgeId:id,file:`raw/${basename(f)}`,sha256:sha,url:raster.url});}
 // Preserve deck NAP; let the outer 8m of each connected road meet the installed terrain.
 for(const sample of bridge.samples) {
  const terrainHeight=await ground(bridgeLngLat(bridge,sample.point));
  const distance=Math.min(sample.s-bridge.samples[0].s,bridge.samples.at(-1)!.s-sample.s);
  const t=Math.max(0,Math.min(1,distance/8)),blend=t*t*(3-2*t);
  sample.heightM=terrainHeight*(1-blend)+sample.surfaceNAP*blend;
 }
 bridge.provenance.renderDatum={method:'absolute-NAP-deck-connected-road-8m-terrain-join',terrainFingerprint:metadata.fingerprint};
 validateBridgeSurfaceFile({version:2,renderHeightDatum:'NAP',bridges:[bridge]});
 const triangulate=(ring:[number,number][])=>{const indices=earcut(ring.flat());return Array.from({length:indices.length/3},(_,i)=>indices.slice(i*3,i*3+3));};
 const batches=buildBridgeGeometry(bridge,triangulate);
 // Thin road ribbons follow the recovered connected approach, without bank scenery or shoulder aprons.
 const approachTriangles:number[][][]=[];
 const sections=bridgeRoadSections(bridge),ramp:BridgeBatch={kind:'approach',colour:'#817b70',positions:[],indices:[]};
 for(let i=1;i<sections.length;i++) {
  const center=bridge.samples[i].point;
  if(insideBridgeOutline(center,bridge.outline)||insideBridgeOutline(bridge.samples[i-1].point,bridge.outline))continue;
  const points=[sections[i-1].left,sections[i-1].right,sections[i].right,sections[i].left];
  // Edge heights blend down to the terrain at the ribbon boundary; centre stays on the measured profile.
  const centers=[bridge.samples[i-1].point,bridge.samples[i].point];
  const vertices=[...points,centers[0],centers[1]];
  const start=ramp.positions.length/3;
  for(let j=0;j<vertices.length;j++){const p=vertices[j];const h=j<4?await ground(bridgeLngLat(bridge,p)):bridge.samples[i-1+(j-4)].heightM;ramp.positions.push(...p,h+.035);}
  for(const tri of [[0,1,4],[1,2,5],[1,5,4],[2,3,5],[3,0,4],[3,4,5]]) {ramp.indices.push(...tri.map(v=>start+v));approachTriangles.push(tri.map(v=>ramp.positions.slice((start+v)*3,(start+v)*3+3).map((n,i)=>i===2?n-.035:n)));}
 }
 // AHN terrain already owns the approaches. Do not draw road aprons over the basemap.
 approachTriangles.length=0;
 let triangles=0,bytes=0;const descriptors:any[]=[];const parts:Buffer[]=[];
 for(const batch of batches){
  const pos=new Float32Array(batch.positions),idx=new Uint32Array(batch.indices);
  const originLL:[number,number]=[4.9,52.37],circumference=2*Math.PI*6371008.8,scale=1/(circumference*Math.cos(originLL[1]*Math.PI/180));
  const originX=(originLL[0]+180)/360,originY=(1-Math.asinh(Math.tan(originLL[1]*Math.PI/180))/Math.PI)/2;
  for(let i=0;i<pos.length;i+=3){const ll=bridgeLngLat(bridge,[pos[i],pos[i+1]]),x=(ll[0]+180)/360,y=(1-Math.asinh(Math.tan(ll[1]*Math.PI/180))/Math.PI)/2;pos[i]=(x-originX)/scale;pos[i+1]=-(y-originY)/scale;pos[i+2]=pos[i+2]*Math.cos(originLL[1]*Math.PI/180)/Math.cos(ll[1]*Math.PI/180);}
  const normals=new Float32Array(pos.length);
  for(let i=0;i<idx.length;i+=3){const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3;const ax=pos[ib]-pos[ia],ay=pos[ib+1]-pos[ia+1],az=pos[ib+2]-pos[ia+2],bx=pos[ic]-pos[ia],by=pos[ic+1]-pos[ia+1],bz=pos[ic+2]-pos[ia+2];const n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];for(const at of [ia,ib,ic])for(let j=0;j<3;j++)normals[at+j]+=n[j];}
  for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length;}
  descriptors.push({kind:batch.kind,colour:batch.colour,positionsOffset:bytes,positionsCount:pos.length,indicesOffset:bytes+pos.byteLength,indicesCount:idx.length,normalsOffset:bytes+pos.byteLength+idx.byteLength,normalsCount:normals.length});parts.push(Buffer.from(pos.buffer),Buffer.from(idx.buffer),Buffer.from(normals.buffer));bytes+=pos.byteLength+idx.byteLength+normals.byteLength;triangles+=idx.length/3;
 }
 if(triangles>50000)throw Error(`Excessive triangles ${triangles}`);
 const payload=Buffer.concat(parts),sha=createHash('sha256').update(payload).digest('hex').slice(0,16),mesh=`${id}-${sha}.bin`;
 await mkdir(`${root}/measured-bridges`,{recursive:true});await writeFile(`${root}/measured-bridges/${mesh}`,payload);
 const previous=previousIndex.bridges?.find((b:any)=>b.id===id);
 const accepted=previousIndex.terrainFingerprint===metadata.fingerprint&&previousIndex.approvedIds?.includes(id)&&previous?.mesh.sha256===createHash('sha256').update(payload).digest('hex')&&JSON.stringify(previous?.waterFootprint)===JSON.stringify(waterClearances.bridges[id]);
 if(accepted)approvedIds.push(id);
 bridges.push({...bridge,waterFootprint:waterClearances.bridges[id],approachTriangles,review:accepted?previous.review:{status:'pending-visual',structure:'procedural',triangles,geometryBytes:bytes},mesh:{url:mesh,batches:descriptors,sha256:createHash('sha256').update(payload).digest('hex')}});
 console.log(id,triangles,'triangles',bytes,'bytes');
 }catch(error){deferred.push({id,error:String(error)});console.error(id,String(error));}
}
await writeFile(`${root}/measured-bridges/index.json`,JSON.stringify({version:2,renderHeightDatum:'NAP',coordinateSpace:'east-north-up-metres@4.9,52.37',terrainFingerprint:metadata.fingerprint,approvedIds,bridges,deferred},null,2)+'\n');
await writeFile(`${privateDir}/manifest.json`,JSON.stringify({sourceBranch:'feat/measured-bridges',sourceCommit:'799f82b4',originalProfileSha256:createHash('sha256').update(original).digest('hex'),rasters,notes:'Raw measured sources retained. Procedural support/railing appearance is not exact historical survey.'},null,2)+'\n');
if(deferred.length)process.exitCode=1;
