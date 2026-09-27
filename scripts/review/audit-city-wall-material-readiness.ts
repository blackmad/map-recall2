/** Offline inventory. Counts evidence coverage; never assigns missing appearances. */
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const pins:Record<string,string>={};
async function read(file:string){const bytes=await fs.readFile(file);pins[file]=sha(bytes);return JSON.parse(bytes.toString());}
const tileRoot='public/data/extracts/amsterdam/building-tiles';
const index=await read(`${tileRoot}/index-z14.json`);
const owners=new Set<string>(),bagOwners=new Set<string>(),tilePins:string[]=[],prefixes:Record<string,number>={};
let featureInstances=0,withoutStableId=0,compressedBytes=0;
for(const key of [...index.tileList].sort()){
 const bytes=await fs.readFile(`${tileRoot}/${key}.geojson.gz`);compressedBytes+=bytes.length;tilePins.push(`${key}:${sha(bytes)}`);
 const tile=JSON.parse(gunzipSync(bytes).toString());
 for(const f of tile.features){featureInstances++;const id=f.properties?.id;if(typeof id!=='string'||!id){withoutStableId++;continue;}owners.add(id);const match=/^NL\.IMBAG\.Pand\.(\d{16})$/.exec(id);if(match)bagOwners.add(match[1]);}
}
for(const id of bagOwners)prefixes[id.slice(0,4)]=(prefixes[id.slice(0,4)]??0)+1;
const pointer=await read('public/data/city-expansion/current.json');
const measurements=await read('review-data/wall-colour/v1/measurements.json');
const accepted=await read('review-data/wall-colour/v1/accepted.json');
if(accepted.measurementsSha256!==pins['review-data/wall-colour/v1/measurements.json'])throw Error('Accepted colours do not match measurement snapshot');
const assignments=await read('public/data/wall-materials/assignments.json');
const report=await read('public/data/wall-materials/report.json');
if(report.assignmentSha256!==pins['public/data/wall-materials/assignments.json'])throw Error('Rendered review refers to a different assignment snapshot');
const colourTrials=await read('public/data/wall-materials/colour-trials.json');
for(const e of assignments.entries){const bytes=await fs.readFile(`public${e.crop}`);if(sha(bytes)!==e.sourceSha256)throw Error(`Stale material source ${e.index}`);}
const unique=(items:any[])=>new Set<string>(items.map(e=>e.buildingId));
const photoOwners=unique(measurements.measurements),colourOwners=unique(accepted.accepted),materialOwners=unique(assignments.entries),known=assignments.entries.filter((e:any)=>e.materialId!=='unknownneutral');
const joined=(ids:Set<string>)=>[...ids].filter(id=>bagOwners.has(id)).length;
const byMaterial:Record<string,number>={};for(const e of assignments.entries)byMaterial[e.materialId]=(byMaterial[e.materialId]??0)+1;
const pilot=await read('review-data/wall-colour/visual-loop/cheap-vision-pilot.json');
const extrapolate=(n:number)=>({owners:n,tenImageBatches:Math.ceil(n/10),serialHours:Math.ceil(n/10)*pilot.wallTimeSeconds/3600,reportedCostUnits:Math.ceil(n/10)*pilot.reportedCost});
const out={version:1,scope:'Cached game extract, not a municipality-wide coverage claim',sourcePins:pins,tileSetSha256:sha(tilePins.join('\n')),
 geometry:{reportedFeatures:index.features,featureInstances,uniqueStableIds:owners.size,withoutStableId,duplicateInstances:featureInstances-withoutStableId-owners.size,uniqueBagIds:bagOwners.size,bagIdPrefixes:prefixes,tiles:index.tileList.length,compressedBytes,limitation:'BAG ID prefixes and cached extract are not a substitute for a current municipality boundary join.'},
 activeDistrict:{id:pointer.areaId,buildings:pointer.buildings,releaseId:pointer.releaseId},
 evidence:{photographicMeasurements:measurements.measurements.length,photoOwners:photoOwners.size,photoOwnersInCachedGeometry:joined(photoOwners),sourceAcceptedColourOwners:colourOwners.size,sourceAcceptedColourOwnersInCachedGeometry:joined(colourOwners),materialAssessedOwners:materialOwners.size,materialAssessedOwnersInCachedGeometry:joined(materialOwners),cohortOwnersMissingCachedGeometry:assignments.entries.filter((e:any)=>!bagOwners.has(e.buildingId)).map((e:any)=>({index:e.index,buildingId:e.buildingId,address:e.address})),knownMaterialOwners:unique(known).size,unknownMaterialOwners:materialOwners.size-unique(known).size,byMaterial,broadFamilyRenderVerdicts:report.summary,colourVariantTrials:colourTrials.entries.length,exactColourTextureAcceptance:'not established',geometryOwnersWithoutCohortMaterialAssessment:bagOwners.size-joined(materialOwners),amsterdamPrefixOwnersWithoutCohortMaterialAssessment:(prefixes['0363']??0)-[...materialOwners].filter(id=>id.startsWith('0363')&&bagOwners.has(id)).length},
 pilotExtrapolation:{status:'Arithmetic only, not a budget quote or validated throughput forecast',pilot:{model:pilot.model,secondsPerTenImages:pilot.wallTimeSeconds,reportedCostPerTenImages:pilot.reportedCost,currency:pilot.currency},scenarios:[extrapolate(100),extrapolate(pointer.buildings),extrapolate(prefixes['0363']??0),extrapolate(bagOwners.size)],excluded:['panorama acquisition and image decoding','source-to-owner registration','retries, rate limits and independent reviews','higher-resolution per-building prompts','changed provider pricing or model availability'],qualityWarning:pilot.assessment},
 publication:{defaultGameChanged:false,unknownPolicy:'Preserve existing appearance; never count procedural fallback as a photo match'}};
const output=process.argv[2]??'review-data/wall-colour/citywide-readiness.json';await fs.writeFile(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({output,geometry:out.geometry,evidence:out.evidence,pilotExtrapolation:out.pilotExtrapolation.scenarios},null,2));
