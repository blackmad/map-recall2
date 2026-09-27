/** Whole-strip compiler. Never reads the hand-traced regression fixture or review boxes. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {applyBalconyAssemblies} from '../../src/canalRecall/facade/balconyAssembly';
import {applyEntranceAssembly} from '../../src/canalRecall/facade/componentGeometry';
const base='public/data/facade-review-galleries/head-on-3d-v1/';
const root='.cache/facade-assessment/block-assemblies-v1';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const report:any={version:1,status:'partial-experimental',manualCoordinatesUsed:false,depths:'inferred, not measured',strips:[]};
const scene=await read(base+'scene.json');
const rows=[];
let visualReview:any=null;try{visualReview=await read('review-data/facade-vector-pilot/block-assemblies-v1/final-review.json');}catch{}
for(const id of ['strip1','strip2']){
 const ext=await read(`.cache/facade-assessment/banana-head-on-v1/auto-components-${id}/components.json`);
 const entrances=await read(`${root}/${id}/entrances.json`);
 const image=await fs.readFile(base+id+'-generated.png');
 if(sha(image)!==ext.source.imageSha256||sha(image)!==entrances.sourceHash)throw Error('Source identity mismatch '+id);
 const row=scene.rows.find((r:any)=>r.id===id);
 const ground=entrances.analysis.groundBandTop;
 // Ground openings are whole-assembly proposals; do not cut arbitrary glass boxes there.
 const features=ext.features.map((f:any)=>({...f,bbox:f.bounds??f.bbox}));
 let cleanupFit:any=null;if(id==='strip1'){try{cleanupFit=await read(root+'/balcony-cleanup/balcony-cleanup.json');}catch{}}
 if(cleanupFit&&(cleanupFit.sourceSha256!==sha(image)||cleanupFit.featuresSha256!==sha(await fs.readFile(`.cache/facade-assessment/banana-head-on-v1/auto-components-${id}/components.json`))))throw Error('Stale cleanup fit');
 const withheldPairs=cleanupFit?.proposals.filter((p:any)=>!p.verified)??[];
 const balconies=features.filter((f:any)=>f.kind==='balcony'&&!withheldPairs.some((p:any)=>p.id===f.id));
 const openings=features.filter((f:any)=>f.kind==='window'&&f.bbox[3]<ground&&!withheldPairs.some((p:any)=>p.linkedOpeningId===f.id));
 const result=applyBalconyAssemblies(row.roofRepair.meshes,balconies,openings);
 result.stats.skippedBalconies.push(...withheldPairs.map((p:any)=>({id:p.id,reason:'paint-cleanup-unverified:'+p.reasons.join(',')})));
 let meshes=result.meshes;
 let classification:any=null;try{classification=await read(`${root}/classification/${id}.json`);}catch{}
 if(classification&&classification.inputs.candidates.sha256!==sha(await fs.readFile(`${root}/${id}/entrances.json`)))throw Error('Stale classification '+id);
 const decisions=[];
 // Geometry preview remains explicitly inferred until independent visual QA passes.
 for(const candidate of entrances.candidates){
  if(id==='strip1'&&visualReview?.rejectedAssemblyIds?.includes(candidate.id)){decisions.push({id:candidate.id,status:'withheld',reason:'independent-visual-review-rejected',bbox:candidate.bbox});continue;}
  const verdict=classification?.classifications?.find((v:any)=>v.id===candidate.id);
  if(verdict&&verdict.role!=='door'){decisions.push({id:candidate.id,status:'withheld',reason:'classifier:'+verdict.role,bbox:candidate.bbox,classification:verdict});continue;}
  if(candidate.role!=='entrance'||!candidate.geometryReady) {decisions.push({id:candidate.id,status:'withheld',reason:candidate.role!=='entrance'?candidate.role:'outer-mouth-edge-unresolved', bbox:candidate.bbox});continue;}
  const applied=applyEntranceAssembly(meshes,{id:candidate.id,outline:candidate.outline,depth:.65,wallColour:candidate.colours.surroundingWall});
  decisions.push({id:candidate.id,status:applied.stats.accepted?'geometry-preview':'withheld',reason:applied.stats.reason??'automatic outline; visual acceptance pending',bbox:candidate.bbox,classification:verdict,focus:applied.stats.focus});
  if(applied.stats.accepted)meshes=applied.meshes;
 }
 let cleaned=false;try{const cleanup=await read(root+'/cleanup-composite.json');cleaned=id==='strip1'&&cleanup.generatedSourceSha256===sha(image)&&cleanup.outsideMaskUnchanged&&cleanup.sourceTextureSha256===sha(await fs.readFile(base+'strip1-texture.png'))&&cleanup.outputTextureSha256===sha(await fs.readFile(base+'block-auto-texture.png'));}catch{}
 meshes=meshes.map((m:any)=>({...m,...(m.textured&&!cleaned?{cleanup:result.paintRemovalMasks}: {})}));
 const balconyViews=result.stats.acceptedBalconies.map(bid=>{const parts=meshes.filter((m:any)=>m.id.includes(bid));const points=parts.flatMap((m:any)=>Array.from({length:m.positions.length/3},(_,i)=>m.positions.slice(i*3,i*3+3)));const min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));const slab=parts.find((m:any)=>m.id.endsWith(':slab'));const outward=slab?[slab.positions[9]-slab.positions[0],0,slab.positions[11]-slab.positions[2]]:[0,0,1];return {id:bid,focus:{center:min.map((v,k)=>(v+max[k])/2),widthM:Math.hypot(max[0]-min[0],max[2]-min[2]),heightM:Math.max(2,max[1]-min[1]),outward}};});
 const stats={id,balconyViews,sourceHash:sha(image),balconies:result.stats,entrances:decisions,qa:id==='strip1'?'Nine balcony assemblies individually visually reviewed; rejected entrances retain original. Whole block incomplete.':'Holdout geometry provisional; no full visual acceptance',paintCleanup:cleaned?'Verified bounded clean-layer composite; outside-mask pixels unchanged':'Sampled rectangle provisional; no accepted clean layer'};
 report.strips.push(stats);
 rows.push({...row,id:'block-auto'+(id==='strip1'?'':'-holdout'),textureId:cleaned?'block-auto':id,label:id==='strip1'?'Whole block · automatic assembly preview':'Holdout · same automatic pipeline',roofRepair:undefined,meshes:row.roofRepair.meshes,entranceRepair:{meshes,stats:{...stats,focus:decisions.find(d=>d.focus)?.focus}},notes:['Automatic extraction, inferred depths. Uncertain ground candidates withheld. Not approved for game publication.']});
}
await fs.writeFile(base+'block-assemblies-scene.json',JSON.stringify({rows}));
await fs.writeFile(base+'block-assemblies-report.json',JSON.stringify(report,null,2));
await fs.writeFile(root+'/geometry-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.strips.map((s:any)=>({id:s.id,balconies:s.balconies.acceptedBalconies.length,entrances:s.entrances.filter((x:any)=>x.status==='geometry-preview').length,withheld:s.entrances.filter((x:any)=>x.status==='withheld').length}))));
