/** Builds a source-space, multi-date architecture composite for case 17.
 * It never upgrades cached crop planes to metric registration certificates. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fuseStableFacadeEvidence } from '../../src/canalRecall/facadeTemporalEvidence.js';

const FORBIDDEN_TEMPORAL_FIELDS=new Set(['colour','frameColour','surroundColour','doorStyle','doorFurniture','material','region','awningProfile','stripeColour','stripeCount','valance','installation','state','text','physicalSignId']);
const STABLE_FIELDS=['kind','bounds','head','lintelHead','lintelRise','row','bay','paired','archRise','topCornerRadius','transom','mullions','thresholdHeightM'] as const;
const CASE17_BINDING={
  full:{sha256:'8d9f53bba028ea885efa5ed8cd3b2e85184a8912bcedabf03d4067f1fa2d2fe5',captureDate:'2023-01-10T10:44:05.176090Z',width:377,height:893},
  ground:{sha256:'844bcc9aff1b0b876646f3ea4bf5b2825b3cf581cf01e9a1d6b83f5d6fb40071',captureDate:'2024-12-11T11:16:00Z',width:922,height:539},
} as const;
type Point={x:number;y:number};
type Plane={start:Point;end:Point;baseZ:number;topZ:number};
type Image={sha256:string;date?:string;capturedAt?:string;width:number;height:number;plane:Plane};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const transformPoint=(h:number[],x:number,y:number)=>[h[0]*x+h[1]*y+h[2],h[3]*x+h[4]*y+h[5]] as [number,number];
const mapBounds=(h:number[],bounds:number[])=>{
  const points=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]].map(([x,y])=>transformPoint(h,x,y));
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))].map(v=>Math.round(v*1000)/1000);
};
const stableFeature=(feature:any,id=feature.id,reviewed=false)=>{
  const output:any={id,disposition:reviewed?'agent-inspected':feature.disposition};
  for(const field of STABLE_FIELDS)if(feature[field]!==undefined)output[field]=Array.isArray(feature[field])?[...feature[field]]:feature[field];
  return output;
};
const imageFor=(caseRecord:any,tier:'full'|'ground'):Image=>{
  const source=caseRecord.source?.[tier];
  for(const observation of caseRecord.owner?.observations??[]){const image=observation.payload?.images?.[tier];if(image?.sha256===source?.sha256)return image;}
  throw new Error(`case17-${tier}-image-plane-unavailable`);
};
/** Derives ground-pixel -> full-pixel coordinates through the crops' common
 * physical plane. Horizontal coordinates project RD points onto the full crop;
 * vertical coordinates preserve the crops' shared NAP height. */
export function deriveGroundToFullTransform(full:Image,ground:Image){
  for(const image of [full,ground])if(!image.plane||![image.width,image.height,image.plane.baseZ,image.plane.topZ,image.plane.start.x,image.plane.start.y,image.plane.end.x,image.plane.end.y].every(finite)||image.width<=0||image.height<=0||image.plane.topZ<=image.plane.baseZ)throw new Error('invalid-crop-plane');
  const f=full.plane,g=ground.plane,fx=f.end.x-f.start.x,fy=f.end.y-f.start.y,gx=g.end.x-g.start.x,gy=g.end.y-g.start.y,length2=fx*fx+fy*fy;
  if(length2<=0)throw new Error('degenerate-full-plane');
  const directionDot=(fx*gx+fy*gy)/(Math.sqrt(length2)*Math.hypot(gx,gy));
  if(directionDot<.9999)throw new Error('crops-do-not-share-coordinate-direction');
  const unit=[fx/Math.sqrt(length2),fy/Math.sqrt(length2)],normal=[-unit[1],unit[0]];
  const perpendicular=(point:Point)=>Math.abs((point.x-f.start.x)*normal[0]+(point.y-f.start.y)*normal[1]);
  const maxPerpendicularSeparationM=Math.max(perpendicular(g.start),perpendicular(g.end));
  const alongScale=(gx*fx+gy*fy)/length2*full.width/ground.width;
  const alongOffset=((g.start.x-f.start.x)*fx+(g.start.y-f.start.y)*fy)/length2*full.width;
  const verticalScale=(g.topZ-g.baseZ)/ground.height*full.height/(f.topZ-f.baseZ);
  const verticalOffset=(f.topZ-g.topZ)*full.height/(f.topZ-f.baseZ);
  return {matrix:[alongScale,0,alongOffset,0,verticalScale,verticalOffset,0,0,1],directionDot,maxPerpendicularSeparationM};
}
const CASE17_LANDMARKS=[
  {id:'left-window-lower-right',ground:[144,60],full:[59,696]},
  {id:'middle-window-lower-right',ground:[331,60],full:[134,696]},
  {id:'broad-bay-lower-left',ground:[456,60],full:[187,696]},
  {id:'brick-to-fascia-seam',ground:[461,70],full:[188,703]},
] as const;

/** Pure integration interface. Existing full/ground studies remain untouched;
 * the returned feature set is a separate architecture-composite proposal. */
export function buildTemporalCandidate(caseRecord:any){
  if(caseRecord?.caseId!=='case-17')throw new Error('only-case17-correspondence-is-reviewed');
  for(const tier of ['full','ground'] as const){
    const source=caseRecord.source?.[tier],expected=CASE17_BINDING[tier];
    if(source?.sha256!==expected.sha256||source?.captureDate!==expected.captureDate||source?.width!==expected.width||source?.height!==expected.height)throw new Error(`case17-${tier}-correspondence-source-binding-mismatch`);
  }
  const full=imageFor(caseRecord,'full'),ground=imageFor(caseRecord,'ground');
  if(full.sha256!==caseRecord.source.full.sha256||ground.sha256!==caseRecord.source.ground.sha256)throw new Error('source-identity-mismatch');
  for(const [tier,image] of [['full',full],['ground',ground]] as const){const expected=CASE17_BINDING[tier];if((image.date??image.capturedAt)!==expected.captureDate||image.width!==expected.width||image.height!==expected.height)throw new Error(`case17-${tier}-image-binding-mismatch`);}
  const {matrix,directionDot,maxPerpendicularSeparationM}=deriveGroundToFullTransform(full,ground);
  const landmarkResiduals=CASE17_LANDMARKS.map(item=>{
    const projected=transformPoint(matrix,item.ground[0],item.ground[1]);
    return {...item,projectedFull:projected.map(v=>Math.round(v*1000)/1000),residualPx:Math.round(Math.hypot(projected[0]-item.full[0],projected[1]-item.full[1])*1000)/1000};
  });
  const maxLandmarkResidualPx=Math.max(...landmarkResiduals.map(item=>item.residualPx));
  const fullFeatures=(caseRecord.shapeFeatures?.full?.features??[]).filter((feature:any)=>['door','window'].includes(feature.kind)).map((feature:any)=>({...stableFeature(feature),sourceEvidence:{tier:'full',sourceFeatureId:feature.id,sourceHash:full.sha256,sourceDate:full.date,transfer:'same-date'}}));
  const wanted=new Map([['ground:window-01','full:temporal:ground-display'],['ground:review:rear-right-door','full:temporal:rear-right-door']]);
  const proposed=(caseRecord.shapeFeatures?.ground?.features??[]).filter((feature:any)=>wanted.has(feature.id)).map((feature:any)=>({...stableFeature(feature,wanted.get(feature.id),true),bounds:mapBounds(matrix,feature.bounds),temporalEvidence:{sourceTier:'ground',sourceFeatureId:feature.id,sourceHash:ground.sha256,sourceDate:ground.date,targetTier:'full',targetHash:full.sha256,targetDate:full.date,coordinateMapping:'shared-crop-plane-plus-inspected-landmarks',structuralOnly:true}}));
  if(proposed.length!==wanted.size)throw new Error('reviewed-ground-architecture-missing');
  for(const feature of proposed)for(const field of FORBIDDEN_TEMPORAL_FIELDS)if(field in feature)throw new Error(`dated-field-leak:${field}`);
  const boundsFit=proposed.every((feature:any)=>feature.bounds.length===4&&feature.bounds.every(finite)&&feature.bounds[0]>=0&&feature.bounds[1]>=0&&feature.bounds[2]<=full.width&&feature.bounds[3]<=full.height&&feature.bounds[2]>feature.bounds[0]&&feature.bounds[3]>feature.bounds[1]);
  const sourceSpaceTransferAccepted=maxLandmarkResidualPx<=3&&maxPerpendicularSeparationM<=.02&&boundsFit;
  const transferred=sourceSpaceTransferAccepted?proposed:[];
  const observation=caseRecord.owner.observations.find((item:any)=>item.payload?.images?.full?.sha256===full.sha256);
  const wall=observation?.payload?.wall;if(!wall)throw new Error('authoritative-wall-unavailable');
  const cropEndpointMarginM=Math.max(distance(full.plane.start,wall.start),distance(full.plane.end,wall.end));
  const sourceSpaceAssembly=sourceSpaceTransferAccepted?{id:'full:temporal:side-rear-recess',featureId:'full:temporal:rear-right-door',bounds:mapBounds(matrix,[568,226,806,474]),backDoorBounds:mapBounds(matrix,[657,242,758,456]),sidePlanes:['left-flat-return','right-angled-return'],sourceEvidence:{sourceHash:ground.sha256,sourceDate:ground.date,disposition:'agent-inspected-development-visible'},metricDepth:'omitted-unregistered'}:null;
  const transferReason=!boundsFit?'transformed feature bounds do not fit the exact full image':maxPerpendicularSeparationM>.02?'crop planes no longer describe the same wall line':maxLandmarkResidualPx>3?'inspected landmark residual exceeds 3 pixels':'exact source identities, crop planes and inspected landmarks agree';
  return {
    features:[...fullFeatures,...transferred],width:full.width,height:full.height,cropSha256:full.sha256,captureDate:full.date,
    provenance:{version:1,caseId:'case-17',buildingId:caseRecord.owner.id,sourceGround:{cropSha256:ground.sha256,captureDate:ground.date,width:ground.width,height:ground.height},targetFull:{cropSha256:full.sha256,captureDate:full.date,width:full.width,height:full.height},groundToFull:{kind:'shared-crop-plane-affine',matrix,directionDot,maxPerpendicularSeparationM,landmarks:landmarkResiduals,maxLandmarkResidualPx,maximumAcceptedLandmarkResidualPx:3,landmarkDisposition:'agent-inspected approximate pixel edges'},sourceSpaceTransferGate:{accepted:sourceSpaceTransferAccepted,boundsFit,reason:transferReason},sourceSpaceAssemblies:sourceSpaceAssembly?[sourceSpaceAssembly]:[],cropEndpointMarginM,cropEndpointMarginNote:'Intentional native crop margin beyond authoritative wall endpoints; this is not registration uncertainty.',metricGate:{accepted:false,maximumUncertaintyM:.15,checks:{sourceRegistrationCertificate:false,targetRegistrationCertificate:false,canonicalDatumVerified:false,cameraHeightResolved:false},reason:'registration certificates, canonical datum verification and resolved camera height are absent'},excludedDatedFields:[...FORBIDDEN_TEMPORAL_FIELDS]},
    omissions:['tenant identity, sign text, fascia appearance, materials, colours, furniture and awning state are not transferred','metric placement and recess depth omitted until a verified registration is available',...(!sourceSpaceTransferAccepted?[`temporal source-space transfer abstained: ${transferReason}`]:[])],previewOnly:true,
  };
}

/** Exercised by tests and available to a future certified caller. */
export const buildVerifiedFusion=(target:any,observations:any[],associations:any[])=>fuseStableFacadeEvidence(target,observations,associations);

async function sha256(path:string){return createHash('sha256').update(await fs.readFile(path)).digest('hex');}
async function main(){
  const inputPath='public/data/facade-repair-preview/cases.json',outputPath='scripts/review/next-stage-temporal.json';
  const input=JSON.parse(await fs.readFile(inputPath,'utf8')),caseRecord=input.cases.find((item:any)=>item.caseId==='case-17');
  if(!caseRecord)throw new Error('case17-missing');
  for(const tier of ['full','ground']){const source=caseRecord.source[tier];if(await sha256(source.path)!==source.sha256)throw new Error(`${tier}-source-file-hash-mismatch`);}
  const candidate=buildTemporalCandidate(caseRecord);
  const ledger=JSON.parse(await fs.readFile('.cache/city-appearance/fidelity-extraction/phase-budget.json','utf8')),entries=ledger.entries??[];
  const settled=entries.filter((e:any)=>e.status==='settled').reduce((sum:number,e:any)=>sum+(e.actualUsd??0),0);
  const budget={ledgerPath:'.cache/city-appearance/fidelity-extraction/phase-budget.json',settledUsd:Math.round(settled*1e12)/1e12,unresolvedReservations:entries.filter((e:any)=>!['settled','released','rejected'].includes(e.status)).length,additionalSpendUsd:0};
  await fs.writeFile(outputPath,`${JSON.stringify({version:1,kind:'case17-source-space-temporal-architecture-composite',generatedBy:'scripts/review/next-stage-temporal.ts',candidate,budget},null,2)}\n`);
  console.log(JSON.stringify({outputPath,features:candidate.features.length,sourceSpaceTransferGate:candidate.provenance.sourceSpaceTransferGate,metricGate:candidate.provenance.metricGate,budget}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
