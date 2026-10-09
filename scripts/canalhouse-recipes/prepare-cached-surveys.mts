/** Cached survey/crop/camera preparation; recipes remain source-authored. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {extractRoofPlanes,extractFacadeWallPlanes,type RoofPlane} from '../../src/canalRecall/building/facadePointCloud.ts';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {discoverCompleteFrontage} from './complete-frontage.ts';
const option=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const root=process.cwd(), inventoryFile=option('inventory'), out=option('stage'), mode=option('mode')??'survey';
const frontageMaxJogM=Number(option('frontage-max-jog-m')??'.35');
if(!Number.isFinite(frontageMaxJogM)||frontageMaxJogM<=0||frontageMaxJogM>1)throw Error('--frontage-max-jog-m must be greater than zero and at most 1m');
if(!inventoryFile||!out||!['survey','crop','camera'].includes(mode))throw Error('Use --inventory=... --stage=... --mode=survey|crop|camera');
const D=path.join(root,'docs/references/canalhouse-recipes');
await fs.mkdir(out,{recursive:true});
interface CachedImage {tier:string;manifestPath:string;originalPath:string}
interface Entry {address:string;cachedOwnerId:string;selectedFacade:string;orderedFrontageRD:{x:number;y:number}[];images:CachedImage[];nativeRawSource:{path:string}}
interface NativeGeometry {lod:string|number;boundaries:number[][][][];semantics:{surfaces:{type:string}[];values:number[][]}}
interface NativeObject {type:string;attributes:Record<string,number>;geometry?:NativeGeometry[]}
interface NativeFeature {id:string;vertices:number[][];CityObjects:Record<string,NativeObject>}
interface NativeCollection {features:NativeFeature[];metadata:{transform:{scale:number[];translate:number[]}}}
interface CachedRecord {id:string;images:Record<string,{pose:{x:number;y:number};projection?:{pitchDeg?:number;fovDeg?:number}}>} 
const modelId=(e:Entry)=>e.address.toLowerCase().replace(/\s+/g,'-');
const inventory: {entries:Entry[]}=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
if(mode==='survey'){
for(const e of inventory.entries){const n=e.address.split(' ').at(-1),id=modelId(e),d:NativeCollection=JSON.parse(await fs.readFile(root+'/'+e.nativeRawSource.path,'utf8')),feature=d.features.find(f=>f.id==='NL.IMBAG.Pand.'+e.cachedOwnerId),raw={feature,metadata:d.metadata};if(!feature)throw Error('Missing exact owner');const t=d.metadata.transform,verts=feature.vertices.map(v=>v.map((x,i)=>x*t.scale[i]+t.translate[i]));const roofs:(RoofPlane&{ringsRD?:number[][][]})[]=extractRoofPlanes(raw),walls=extractFacadeWallPlanes(raw);let polys:number[][][][]=[];
for(const [objectId,o]of Object.entries(feature.CityObjects))for(const g of o.geometry??[])if(String(g.lod)==='2.2')for(let si=0;si<g.boundaries.length;si++)for(let j=0;j<g.boundaries[si].length;j++){const sem=g.semantics.surfaces[g.semantics.values[si][j]],rings=g.boundaries[si][j].map(r=>r.map(k=>verts[k]));if(sem.type==='GroundSurface')polys.push(rings.map(r=>r.map(p=>p.slice(0,2))));if(sem.type==='RoofSurface'){const match=roofs.find(r=>r.surfaceId===`${objectId}:lod22:roof:${j}`);if(match)match.ringsRD=rings;}}
const exact=e.orderedFrontageRD.map(p=>{const candidates=polys.flatMap(poly=>poly[0]).map(v=>({v,d:Math.hypot(v[0]-p.x,v[1]-p.y)})).sort((a,b)=>a.d-b.d);if(candidates[0].d>.1)throw Error('Cachedfront foreign to exact survey '+n);return candidates[0].v;});const attrs=Object.values(feature.CityObjects).find(o=>o.type==='Building')?.attributes;if(!attrs)throw Error('Missing native Building attributes');
const frontageDiscovery=discoverCompleteFrontage(polys,exact,{maxJogM:frontageMaxJogM});
const survey={id,bagId:e.cachedOwnerId,attributes:attrs,roofsRD:roofs,facadeWallsRD:walls,surveyFootprintPolygonsRD:polys,frontageDiscovery};await fs.writeFile(D+`/${id}-survey.json`,JSON.stringify(survey,null,2)+'\n');
const dx=exact[1][0]-exact[0][0],dy=exact[1][1]-exact[0][1],len=Math.hypot(dx,dy);const frontWalls=walls.filter(w=>w.vertices.every(v=>Math.abs((v[0]-exact[0][0])*dy-(v[1]-exact[0][1])*dx)/len<.07));const endpointHeights=exact.map(p=>roofs.flatMap(r=>r.vertices).filter(v=>Math.hypot(v[0]-p[0],v[1]-p[1])<.04).map(v=>v[2]-attrs.b3_h_maaiveld));
const result={n,exact,width:len,frontageDiscovery,ground:attrs.b3_h_maaiveld,endpointHeights,frontWallTopHeights:frontWalls.map(w=>[w.surfaceId,Math.max(...w.vertices.map(v=>v[2]-attrs.b3_h_maaiveld))]),roofSurfaceSummary:roofs.map(r=>({surfaceId:r.surfaceId,heightM:[Math.min(...r.vertices.map(v=>v[2]-attrs.b3_h_maaiveld)),Math.max(...r.vertices.map(v=>v[2]-attrs.b3_h_maaiveld))],depthM:[Math.min(...r.vertices.map(v=>((v[0]-exact[0][0])*(-dy)+(v[1]-exact[0][1])*dx)/len)),Math.max(...r.vertices.map(v=>((v[0]-exact[0][0])*(-dy)+(v[1]-exact[0][1])*dx)/len))]})),source:e.nativeRawSource};await fs.writeFile(out+`/${n}-native-screen.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
}
if(mode==='crop'){
for(const e of inventory.entries){const evidence=JSON.parse(await fs.readFile(D+`/${modelId(e)}-source-admission.json`,'utf8').catch(()=>'{"houses":[{"sources":{}}]}'));const lowerTier=evidence.houses[0].sources.lowerReferenceTier??'ground';const source=e.images.find(i=>i.tier===lowerTier);if(!source)throw Error('Missing lower facade source');const manifest=JSON.parse(await fs.readFile(path.resolve(root,source.manifestPath),'utf8'));const record=manifest.records.find((r:CachedRecord)=>r.id===e.selectedFacade.replace(':e:', '_e_'));const image=record?.images[lowerTier];if(!image)throw Error('Missing source record');const a=e.orderedFrontageRD[0],b=e.orderedFrontageRD[1],heading=Math.atan2((a.x+b.x)/2-image.pose.x,(a.y+b.y)/2-image.pose.y)*180/Math.PI;
const n=e.address.split(' ').at(-1);await fs.writeFile(`${out}/${n}-near-perspective.jpg`,perspectiveCrop(await fs.readFile(source.originalPath),heading,1000,1400,95,35));}
}
if(mode==='camera'){
for(const e of inventory.entries){const n=e.address.split(' ').at(-1);const p=D+`/${modelId(e)}-source-admission.json`,a=JSON.parse(await fs.readFile(p,'utf8')),s=a.houses[0].sources;
 for(const [role,tier] of [['full','full'],['near',s.lowerReferenceTier??'ground']]){const image=e.images.find(i=>i.tier===tier);if(!image)throw Error('Missing camera tier '+tier);const m=JSON.parse(await fs.readFile(path.resolve(root,image.manifestPath),'utf8')),r=m.records.find((r:CachedRecord)=>r.id===e.selectedFacade.replace(':e:','_e_')),rec=r.images[tier],cam=role==='full'?s.projection.camera:s.nearCamera;cam.geometry={type:'Point',coordinates:[...rdToLngLat(rec.pose),0]};cam.poseFromCache=rec.pose;if(role==='full'){const [pa,pb]=a.principalFront.orientedLeftToRightAsSeenFromCanal;s.projection.headingDeg=Math.atan2((pa[0]+pb[0])/2-rec.pose.x,(pa[1]+pb[1])/2-rec.pose.y)*180/Math.PI;s.projection.pitchDeg=rec.projection?.pitchDeg??12;s.projection.fovDeg=rec.projection?.fovDeg??65;}}
 s.rights='Gemeente Amsterdam · CC BY 4.0';await fs.writeFile(p,JSON.stringify(a,null,2)+'\n');}
}
