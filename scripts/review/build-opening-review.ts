/** Build a local, read-only review gallery for the pinned Oud-Zuid R0 lanes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {adjudicateOpeningProposals, type OpeningCandidate, type OpeningProposal} from '../../src/canalRecall/facade/openingProposalAdjudication.ts';

type PredictionBox={kind:'window'|'door'|'other';score?:number;along:number;up:number;widthM:number;heightM:number;modelClass?:string};
type PredictionRecord={buildingId:string;elevationId:string;surfaceId:string;wallWidthM:number;wallHeightM:number;
 cropFile:string;cropWidthPx:number;cropHeightPx:number;boxes:PredictionBox[]};
type PredictionFile={schemaVersion:number;lane:string;model:string;setting:string;records:PredictionRecord[]};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const argument=(args:string[],name:string,fallback:string)=>args.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const inside=(file:string,root:string)=>path.resolve(file).startsWith(path.resolve(root)+path.sep);

const intersection=(a:OpeningCandidate,b:OpeningCandidate)=>Math.max(0,Math.min(a.along+a.width,b.along+b.width)-Math.max(a.along,b.along)) *
 Math.max(0,Math.min(a.up+a.height,b.up+b.height)-Math.max(a.up,b.up));
const iou=(a:OpeningCandidate,b:OpeningCandidate)=>{
 const overlap=intersection(a,b);return overlap/(a.width*a.height+b.width*b.height-overlap);
};

/** A broad detector box may connect two separate windows into one component. */
export function flagBridgeClusters(proposals:OpeningProposal[]):OpeningProposal[]{
 return proposals.map(proposal=>{
  const sources=proposal.sources;
  const bridged=sources.some((a,index)=>sources.slice(index+1).some(b=>a.lane===b.lane&&a.kind===b.kind&&iou(a,b)<.5));
  if(!bridged)return proposal;
  return {...proposal,status:'needs-review',reasons:[...new Set([...proposal.reasons,'multi-overlap-bridge'])]};
 });
}

export function validateWallPair(a:PredictionRecord,b:PredictionRecord){
 if(a.elevationId!==b.elevationId||a.buildingId!==b.buildingId||a.cropFile!==b.cropFile||
   a.cropWidthPx!==b.cropWidthPx||a.cropHeightPx!==b.cropHeightPx||
   ![a.wallWidthM,a.wallHeightM,b.wallWidthM,b.wallHeightM,a.cropWidthPx,a.cropHeightPx].every(Number.isFinite)||
   a.wallWidthM<=0||a.wallHeightM<=0||a.cropWidthPx<=0||a.cropHeightPx<=0||
   Math.abs(a.wallWidthM-b.wallWidthM)>.02||Math.abs(a.wallHeightM-b.wallHeightM)>.02)
  throw Error(`Prediction lanes disagree on wall/crop geometry: ${a.elevationId}`);
}

async function atomic(file:string,bytes:Buffer|string){
 await fs.mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.${randomUUID()}.tmp`;
 try{await fs.writeFile(temporary,bytes);await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}
}

export async function buildOpeningReview(args:string[]=process.argv.slice(2)){
 const rfFile=path.resolve(argument(args,'rfdetr','public/data/facade-model-eval/v1/predictions/rfdetr-R0.json'));
 const rsFile=path.resolve(argument(args,'rsjek','public/data/facade-model-eval/v1/predictions/rsjek-R0.json'));
 const cropRoot=path.resolve(argument(args,'crop-root','.cache/facade-eval/oudzuid-eval/images'));
 const out=path.resolve(argument(args,'out','public/data/facade-review-galleries/openings'));
 if(!inside(out,path.resolve('public')))throw Error('Review gallery output must remain under public/');
 const rfBytes=await fs.readFile(rfFile),rsBytes=await fs.readFile(rsFile);
 const rf=JSON.parse(rfBytes.toString()) as PredictionFile,rs=JSON.parse(rsBytes.toString()) as PredictionFile;
 if(rf.schemaVersion!==1||rs.schemaVersion!==1||rf.lane!=='rfdetr'||rs.lane!=='facade-rsjek'||
    rf.setting!==rs.setting||!Array.isArray(rf.records)||!Array.isArray(rs.records))throw Error('Unexpected prediction lane contract');
 const byId=new Map(rs.records.map(record=>[record.elevationId,record]));
 if(byId.size!==rs.records.length||rf.records.length!==rs.records.length)throw Error('Prediction wall inventory mismatch');
 const entries=[];
 for(const a of rf.records){
  const b=byId.get(a.elevationId);if(!b)throw Error(`Missing rsjek wall: ${a.elevationId}`);
  validateWallPair(a,b);
  const source=path.resolve(a.cropFile);
  if(!inside(source,cropRoot))throw Error(`Crop outside declared --crop-root: ${source}`);
  const image=await fs.readFile(source),cropSha256Now=sha(image),metadata=await sharp(image).metadata();
  if(metadata.width!==a.cropWidthPx||metadata.height!==a.cropHeightPx)throw Error(`Crop dimensions changed: ${source}`);
  const destination=path.join(out,'images',`${cropSha256Now}.jpg`);
  let existing:Buffer|null=null;try{existing=await fs.readFile(destination);}catch(error:any){if(error.code!=='ENOENT')throw error;}
  if(!existing||sha(existing)!==cropSha256Now)await atomic(destination,image);
  const lane=(record:PredictionRecord,name:string)=>({name,candidates:record.boxes.map((box,index):OpeningCandidate=>({
   id:`${name}-${index+1}`,kind:box.kind,along:box.along,up:box.up,width:box.widthM,height:box.heightM,
   score:box.score,evidence:'model-proposal',
   // The original prediction files record a crop path but no crop SHA. The
   // current hash is not backdated onto those model detections.
  }))});
  const lanes=[lane(a,'rfdetr'),lane(b,'rsjek')];
  const result=adjudicateOpeningProposals({widthM:a.wallWidthM,heightM:a.wallHeightM},lanes,{mode:'evidence-aware'});
  const legacy=adjudicateOpeningProposals({widthM:a.wallWidthM,heightM:a.wallHeightM},lanes);
  entries.push({id:a.elevationId,buildingId:a.buildingId,elevationId:a.elevationId,wall:{widthM:a.wallWidthM,heightM:a.wallHeightM},
   crop:{url:`images/${cropSha256Now}.jpg`,widthPx:a.cropWidthPx,heightPx:a.cropHeightPx,sha256Now:cropSha256Now,
    recordedAtPredictionSha256:null,binding:'current-file-hash-only; original prediction crop identity unverified'},
   lanes:lanes.map((item,index)=>({name:item.name,model:index?rs.model:rf.model,boxes:item.candidates})),
   legacyUnion:legacy.legacyUnion,proposals:flagBridgeClusters(result.proposals),rejected:result.rejected,conflicts:result.conflicts});
 }
 if(entries.length!==byId.size)throw Error('Prediction lane inventory was not one-to-one');
 const summary={walls:entries.length,rawCandidates:entries.reduce((sum,entry)=>sum+entry.lanes.reduce((n,lane)=>n+lane.boxes.length,0),0),
  legacyOpenings:entries.reduce((sum,entry)=>sum+(entry.legacyUnion??[]).filter(box=>box.kind!=='other').length,0),
  proposals:entries.reduce((sum,entry)=>sum+entry.proposals.length,0),
  conflicts:entries.reduce((sum,entry)=>sum+entry.conflicts.length,0),
  bridgeAmbiguities:entries.reduce((sum,entry)=>sum+entry.proposals.filter(proposal=>proposal.reasons.includes('multi-overlap-bridge')).length,0),
  rejected:Object.fromEntries([...new Set(entries.flatMap(entry=>entry.rejected.map(item=>item.reason)))].map(reason=>[
   reason,entries.reduce((sum,entry)=>sum+entry.rejected.filter(item=>item.reason===reason).length,0)]))};
 const report={version:1,kind:'opening-proposal-review',generatedAt:new Date().toISOString(),summary,
  sources:{rfdetr:{path:rfFile,sha256:sha(rfBytes),model:rf.model,setting:rf.setting},
   rsjek:{path:rsFile,sha256:sha(rsBytes),model:rs.model,setting:rs.setting}},
  policy:'Diagnostic proposals only. Current source crop bytes are hashed; original model runs did not record crop SHA, so historical crop binding remains unverified. No opening accepted or game data published.',
  entries};
 await atomic(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 return {output:path.join(out,'report.json'),summary};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 buildOpeningReview().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.stack??error);process.exitCode=1;});
