/** Bounded multi-date architectural fusion. Callers bind exact evidence and
 * explicitly verify each relationship. Only structural opening geometry may
 * cross capture dates. */
import type { FacadeFeature } from './facadeDescription.js';

export type VerifiedRegistration={status:'registered'|'ambiguous'|'failed';uncertaintyM:number;verified?:true};
export type MetricObservation={
  id:string;buildingId:string;frontageKey:string;coordinateFrameKey?:string;
  registration:VerifiedRegistration;sourceHash:string;sourceDate:string;revoked?:boolean;
  features:(FacadeFeature&{visible:boolean})[];
};
export type TemporalFusionTarget={
  buildingId:string;frontageKey:string;coordinateFrameKey?:string;captureDate?:string;
  registration?:VerifiedRegistration;revoked?:boolean;revokedFeatureIds?:string[];
};
export type TemporalAssociation={
  targetFeatureId:string;observationId:string;sourceFeatureId:string;
  sourceHash?:string;sourceDate?:string;sameBuildingVerified:true;sameFrontageVerified:true;
  sameCoordinateFrameVerified?:true;targetOcclusionVerified?:true;
  visibilityVerified:true;structuralContinuityVerified:true;
};
type StableOpeningGeometry=Pick<FacadeFeature,'id'|'bounds'|'disposition'|'kind'|'head'|'lintelHead'|'lintelRise'|'row'|'bay'|'paired'|'archRise'|'topCornerRadius'|'transom'|'mullions'|'thresholdHeightM'>;
export type RecoveredTemporalFeature=StableOpeningGeometry&{temporalEvidence:{
  sourceObservationId:string;sourceFeatureId:string;sourceBuildingId:string;sourceFrontageKey:string;
  coordinateFrameKey:string;sourceHash:string;sourceDate:string;registrationUncertaintyM:number;
  targetOcclusionVerified:true;visibilityVerified:true;structuralContinuityVerified:true;
  transferredFields:readonly string[];
}};
export type TemporalFusionResult={recovered:RecoveredTemporalFeature[];unresolved:{targetFeatureId:string;reason:string}[]};

const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const nonempty=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
/** Strict RFC 3339 timestamp with a real calendar date and explicit zone. */
const validDate=(value:unknown):value is string=>{
  if(typeof value!=='string')return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!m)return false;
  const year=+m[1],month=+m[2],day=+m[3],hour=+m[4],minute=+m[5],second=+m[6],zone=m[7];
  if(year<1900||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)return false;
  if(zone!=='Z'&&(+zone.slice(1,3)>23||+zone.slice(4,6)>59))return false;
  const instant=Date.parse(value);
  return Number.isFinite(instant)&&instant<=Date.now()+300_000;
};
const registered=(r:VerifiedRegistration|undefined)=>r?.status==='registered'&&r.verified===true&&Number.isFinite(r.uncertaintyM)&&r.uncertaintyM>=0&&r.uncertaintyM<=.15;
const stableFields=['bounds','disposition','kind','head','lintelHead','lintelRise','row','bay','paired','archRise','topCornerRadius','transom','mullions','thresholdHeightM'] as const;
const fraction=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<1;
const validOpening=(f:FacadeFeature&{visible:boolean})=>{
  if(!f.visible||!['door','window'].includes(f.kind)||!['agent-inspected','human-reviewed'].includes(f.disposition)||!nonempty(f.id))return false;
  if(!Array.isArray(f.bounds)||f.bounds.length!==4||!f.bounds.every(Number.isFinite))return false;
  const [l,t,r,b]=f.bounds;if(l<0||t<0||r<=l||b<=t)return false;
  if(f.head!==undefined&&!['rectangular','segmental','rounded'].includes(f.head))return false;
  if(f.archRise!==undefined&&(!['segmental','rounded'].includes(f.head??'')||!fraction(f.archRise)||f.archRise>.5))return false;
  if(f.lintelHead!==undefined&&!['segmental','rounded'].includes(f.lintelHead))return false;
  if(f.lintelRise!==undefined&&(!f.lintelHead||!fraction(f.lintelRise)||f.lintelRise>.5))return false;
  if(f.topCornerRadius!==undefined&&(f.head!=='rectangular'||!fraction(f.topCornerRadius)||f.topCornerRadius>.25))return false;
  if(f.transom!==undefined&&!fraction(f.transom))return false;
  if(f.mullions!==undefined&&(!Array.isArray(f.mullions)||f.mullions.some(v=>!fraction(v))))return false;
  return f.thresholdHeightM===undefined||(Number.isFinite(f.thresholdHeightM)&&f.thresholdHeightM>=0);
};
const geometry=(f:FacadeFeature&{visible:boolean},id:string):StableOpeningGeometry=>{
  const out:Record<string,unknown>={id};
  for(const field of stableFields){const value=f[field];if(value!==undefined)out[field]=Array.isArray(value)?[...value]:value;}
  return out as unknown as StableOpeningGeometry;
};

/** Invalid, duplicate, revoked, or incompletely verified evidence abstains. */
export function fuseStableFacadeEvidence(target:TemporalFusionTarget,observations:MetricObservation[],associations:TemporalAssociation[]):TemporalFusionResult{
  const recovered:RecoveredTemporalFeature[]=[],unresolved:{targetFeatureId:string;reason:string}[]=[];
  const observationCounts=new Map<string,number>(),targetCounts=new Map<string,number>(),sourceAssociationCounts=new Map<string,number>();
  for(const o of observations)observationCounts.set(o.id,(observationCounts.get(o.id)??0)+1);
  for(const a of associations){
    targetCounts.set(a.targetFeatureId,(targetCounts.get(a.targetFeatureId)??0)+1);
    const key=`${a.observationId}\0${a.sourceFeatureId}`;
    sourceAssociationCounts.set(key,(sourceAssociationCounts.get(key)??0)+1);
  }
  for(const link of associations){
    if((targetCounts.get(link.targetFeatureId)??0)>1){if(!unresolved.some(x=>x.targetFeatureId===link.targetFeatureId))unresolved.push({targetFeatureId:link.targetFeatureId,reason:'duplicate-association'});continue;}
    const fail=(reason:string)=>{unresolved.push({targetFeatureId:link.targetFeatureId,reason});};
    if(!nonempty(link.targetFeatureId)||!nonempty(link.observationId)||!nonempty(link.sourceFeatureId)){fail('invalid-association-identity');continue;}
    if((sourceAssociationCounts.get(`${link.observationId}\0${link.sourceFeatureId}`)??0)>1){fail('duplicate-source-association');continue;}
    if(target.revoked||target.revokedFeatureIds?.includes(link.targetFeatureId)){fail('target-revoked');continue;}
    if(!registered(target.registration)||!validDate(target.captureDate)){fail('target-registration-or-date-unavailable');continue;}
    if((observationCounts.get(link.observationId)??0)!==1){fail('duplicate-observation-id');continue;}
    const observation=observations.find(o=>o.id===link.observationId);
    if(!observation||observation.buildingId!==target.buildingId||observation.frontageKey!==target.frontageKey||link.sameBuildingVerified!==true||link.sameFrontageVerified!==true){fail('building-or-frontage-unverified');continue;}
    if(!nonempty(target.coordinateFrameKey)||observation.coordinateFrameKey!==target.coordinateFrameKey||link.sameCoordinateFrameVerified!==true){fail('coordinate-frame-unverified');continue;}
    if(link.targetOcclusionVerified!==true){fail('target-occlusion-unverified');continue;}
    if(observation.revoked){fail('source-observation-revoked');continue;}
    if(!registered(observation.registration)||!hash(observation.sourceHash)||!validDate(observation.sourceDate)){fail('metric-source-unavailable');continue;}
    if(link.sourceHash!==observation.sourceHash||link.sourceDate!==observation.sourceDate){fail('source-evidence-binding-mismatch');continue;}
    if(new Set(observation.features.map(feature=>feature.id)).size!==observation.features.length){fail('duplicate-source-feature-id');continue;}
    const features=observation.features.filter(f=>f.id===link.sourceFeatureId);
    if(features.length!==1){fail(features.length?'duplicate-source-feature-id':'stable-visible-opening-unavailable');continue;}
    const feature=features[0];
    if(!validOpening(feature)){fail(feature.disposition==='revoked'?'source-feature-revoked':'stable-visible-opening-unavailable');continue;}
    if(link.visibilityVerified!==true||link.structuralContinuityVerified!==true){fail('association-continuity-unverified');continue;}
    recovered.push({...geometry(feature,link.targetFeatureId),temporalEvidence:{
      sourceObservationId:observation.id,sourceFeatureId:feature.id,sourceBuildingId:observation.buildingId,
      sourceFrontageKey:observation.frontageKey,coordinateFrameKey:observation.coordinateFrameKey!,
      sourceHash:observation.sourceHash,sourceDate:observation.sourceDate,registrationUncertaintyM:observation.registration.uncertaintyM,
      targetOcclusionVerified:true,visibilityVerified:true,structuralContinuityVerified:true,
      transferredFields:stableFields.filter(field=>feature[field]!==undefined),
    }});
  }
  return {recovered,unresolved};
}
