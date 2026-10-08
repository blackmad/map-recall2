import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {adaptSurveyedBuildingEnvelope,envelopeFootprintFingerprint,legacyExtractFootprint,type EnvelopePoint,type EnvelopeFootprint,type SurveyedBuildingEnvelope} from '../../src/canalRecall/surveyedBuildingEnvelope.ts';

/** Archived CityJSON polygons are surveyed constraints, not an imported GLB.
 * Preserve each semantic region, its holes and its source index. */
export function compileSurveyedEnvelope(pand:any,cityjson:any,installedFootprint:EnvelopeFootprint,provenance:{archivePath:string;rawSha256:string;bagArchivePath:string;bagRawSha256:string;compiledAt:string}):SurveyedBuildingEnvelope {
 const id=`NL.IMBAG.Pand.${pand.identificatie}`,feature=cityjson.feature,objects=feature?.CityObjects,object=objects?.[id],attrs=object?.attributes,transform=cityjson.metadata?.transform;
 if(!object||cityjson.id!==id||pand.eindGeldigheid||attrs.identificatie!==id||attrs.oorspronkelijkbouwjaar!==pand.oorspronkelijkBouwjaar||!transform||cityjson.metadata?.metadata?.referenceSystem!=='https://www.opengis.net/def/crs/EPSG/0/7415')throw Error('Parent/current BAG/survey datum mismatch');
 const child=Object.values(objects).find((o:any)=>o.parents?.includes(id)&&o.geometry?.some((g:any)=>g.lod==='2.2')) as any;
 const geometry=child?.geometry.find((g:any)=>g.lod==='2.2');if(!geometry||geometry.type!=='Solid'||geometry.boundaries.length!==1)throw Error('Require one LoD2.2 surveyed solid');
 if(pand.geometrie?.type!=='Polygon')throw Error('Require official Polygon footprint');
 const anchorRd=pand.geometrie.coordinates[0][0].slice(0,2)as[number,number],ground=attrs.b3_h_maaiveld;
 if(!Number.isFinite(ground))throw Error('Missing source ground datum');
 const vertices:EnvelopePoint[]=feature.vertices.map((p:number[])=>p.map((v,i)=>v*transform.scale[i]+transform.translate[i]-(i===2?ground:anchorRd[i]))as EnvelopePoint);
 const open=(r:number[][])=>{const ps=r.map(p=>p.slice(0,2));if(ps.length>1&&ps[0][0]===ps.at(-1)![0]&&ps[0][1]===ps.at(-1)![1])ps.pop();return ps;};
 const footprintLocal:number[][][]=pand.geometrie.coordinates.map((r:number[][])=>open(r).map(p=>[p[0]-anchorRd[0],p[1]-anchorRd[1]]));
 const roofSurfaces:SurveyedBuildingEnvelope['roofSurfaces']=[],closureSurfaces:SurveyedBuildingEnvelope['closureSurfaces']=[],exteriorWallTopProfiles:SurveyedBuildingEnvelope['exteriorWallTopProfiles']=[];
 geometry.boundaries[0].forEach((boundary:number[][],index:number)=>{
  const sem=geometry.semantics.surfaces[geometry.semantics.values[0][index]],rings=boundary.map(r=>r.map(v=>vertices[v]));
  if(sem.type==='RoofSurface')roofSurfaces.push({sourceSurfaceIndex:index,rings});
  if(sem.type!=='WallSurface')return;
  if(!sem.on_footprint_edge){closureSurfaces.push({sourceSurfaceIndex:index,rings});return;}
  const points=rings.flat();let a=points[0],b=a,l=0;for(const p of points)for(const q of points){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d>l){l=d;a=p;b=q;}}
  if(l<1e-5)throw Error('Degenerate external wall');const dx=(b[0]-a[0])/l,dy=(b[1]-a[1])/l,toT=(p:EnvelopePoint)=>(p[0]-a[0])*dx+(p[1]-a[1])*dy;
  const ts=[...new Set(points.map(toT))].sort((a,b)=>a-b),top:EnvelopePoint[]=[];
  for(const t of ts){let z=-Infinity;for(const r of rings)for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],s=toT(p),e=toT(q);if(t<Math.min(s,e)-1e-6||t>Math.max(s,e)+1e-6)continue;if(Math.abs(e-s)<1e-8)z=Math.max(z,p[2],q[2]);else z=Math.max(z,p[2]+(q[2]-p[2])*(t-s)/(e-s));}if(!Number.isFinite(z))throw Error('Missing wall top');top.push([a[0]+t*dx,a[1]+t*dy,z]);}
  exteriorWallTopProfiles.push({sourceSurfaceIndex:index,points:top});
 });
 const lod0=object.geometry?.find((g:any)=>g.lod==='0'&&g.type==='MultiSurface');
 const sourceLoD0Local=lod0?.boundaries?.[0]?.map((r:number[])=>r.map(i=>vertices[i].slice(0,2))) as number[][][]|undefined;
 const legacyMatch=sourceLoD0Local&&envelopeFootprintFingerprint(legacyExtractFootprint(anchorRd,sourceLoD0Local))===envelopeFootprintFingerprint(installedFootprint);
 const result:SurveyedBuildingEnvelope={schemaVersion:1,coordinateFrame:legacyMatch?'legacy-extract-rd-no-nsgi':'nsgi-aligned-rd-polynomial',...(legacyMatch?{frameProof:{sourceLoD0Local:sourceLoD0Local!,sourceRawSha256:provenance.rawSha256,legacyTransform:'scripts/build-3dbag-appearance.ts#toWgs' as const,roundingDecimals:6 as const}}:{}),nativeParentId:id,installedFootprintFingerprint:envelopeFootprintFingerprint(installedFootprint),nativeMetadata:{aggregateHeightM:Math.round((attrs.b3_h_dak_70p-ground)*100)/100,constructionYear:pand.oorspronkelijkBouwjaar},source:{coordinateScaleM:[...transform.scale]as[number,number,number],authority:'3DBAG',...provenance,surveyYear:attrs.b3_pw_datum,lod:'2.2',groundNapM:ground,quality:{insufficient:attrs.b3_pw_onvoldoende,validityErrors:attrs.b3_val3dity_lod22,rmseM:attrs.b3_rmse_lod22}},anchorRd,footprintLocal,roofSurfaces,exteriorWallTopProfiles,closureSurfaces};
 if(!adaptSurveyedBuildingEnvelope(result,{nativeParentId:id,footprint:installedFootprint,...result.nativeMetadata,now:provenance.compiledAt}))throw Error('Atomic runtime envelope validation rejected compiled candidate');return result;
}
async function main(){
 const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return[a.slice(2,i),a.slice(i+1)];}));
 if(process.argv.includes('--help')){console.log('compile-surveyed-envelope.ts --pand=archived.json --pand-sha=SHA256 --cityjson=archived.json --cityjson-sha=SHA256 --installed-footprint=geometry.json --bag-archive-path=private/path --archive-path=private/path --output=artifacts/street-appearance/compound-native/candidate.json');return;}
 for(const key of ['pand','pand-sha','cityjson','cityjson-sha','installed-footprint','archive-path','bag-archive-path','output'])if(!args[key])throw Error(`Missing --${key}`);
 if(!path.resolve(args.output).startsWith(path.resolve('artifacts/street-appearance/compound-native')+path.sep))throw Error('Candidate output must be in scoped review artifacts');
 async function archived(file:string,sha:string){const bytes=await fs.readFile(file),actual=crypto.createHash('sha256').update(bytes).digest('hex');if(actual!==sha)throw Error(`Archived checksum mismatch: ${path.basename(file)}`);return JSON.parse(bytes.toString());}
 const [pand,cityjson]=await Promise.all([archived(args.pand,args['pand-sha']),archived(args.cityjson,args['cityjson-sha'])]);const raw=JSON.parse(await fs.readFile(args['installed-footprint'],'utf8')),footprint=raw.geometry??raw;
 const envelope=compileSurveyedEnvelope(pand,cityjson,footprint,{archivePath:args['archive-path'],bagArchivePath:args['bag-archive-path'],rawSha256:args['cityjson-sha'],bagRawSha256:args['pand-sha'],compiledAt:new Date().toISOString()});
 await fs.mkdir(path.dirname(args.output),{recursive:true});await fs.writeFile(args.output,JSON.stringify(envelope)+'\n');console.log(JSON.stringify({candidate:args.output,roofRegions:envelope.roofSurfaces.length,wallProfiles:envelope.exteriorWallTopProfiles.length,closures:envelope.closureSurfaces.length,admitted:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
