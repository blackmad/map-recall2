/** Diagnostic-only transport. All source plans and callbacks are created locally,
 * after the structured-clone boundary; no runtime source admission is implied. */
import {adaptSurveyedBuildingEnvelope,type SurveyedBuildingEnvelope,type EnvelopeFootprint} from './surveyedBuildingEnvelope.js';
import {bindSurveyedEnvelopeToMesh} from './surveyedEnvelopeMeshBinding.js';
import {buildFeatureChunk,ORIGIN,type Feature,type BuildingLook} from './threeBuildingFeatures.js';
import type {StreetAppearanceProfile} from './streetAppearance.js';
import type {ChunkHostOpeningConfig} from './hostWallOpenings.js';
export type DiagnosticEnvelopePayload={schemaVersion:1;diagnosticOnly:true;envelopes:SurveyedBuildingEnvelope[]};
export type EnvelopeTransport={revision:string;envelopes:readonly SurveyedBuildingEnvelope[]};
export const EMPTY_ENVELOPE_TRANSPORT:EnvelopeTransport={revision:'[]',envelopes:[]};
function plain(value:unknown,ancestors=new Set<object>()):boolean {
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||ancestors.has(value))return false;
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)return false;
 ancestors.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);
 const ok=Reflect.ownKeys(descriptors).every(key=>typeof key==='string'&&('value'in descriptors[key])&&plain(descriptors[key].value,ancestors));ancestors.delete(value);return ok;
}
/** Reject a malformed batch atomically, including non-cloneable callbacks. */
export function diagnosticEnvelopeTransport(input:unknown):EnvelopeTransport|undefined {
 try{
  if(!plain(input))return;const p=input as DiagnosticEnvelopePayload;
  if(p.schemaVersion!==1||p.diagnosticOnly!==true||!Array.isArray(p.envelopes)||p.envelopes.length>32)return;
  const ids=new Set<string>();for(const e of p.envelopes){if(e.schemaVersion!==1||typeof e.nativeParentId!=='string'||!e.nativeParentId||ids.has(e.nativeParentId))return;ids.add(e.nativeParentId);}
  const json=JSON.stringify(p.envelopes);if(json.length>2_000_000)return;
  return {revision:json,envelopes:JSON.parse(json)};
 }catch{return;}
}
export type EnvelopeBuildOptions={look:BuildingLook;mode?:'walls'|'extras'|'coarse';streets?:Float32Array;profiles?:readonly StreetAppearanceProfile[];contextFeatures?:readonly Feature[];hostOpenings?:readonly ChunkHostOpeningConfig[];surveyedEnvelopeData?:readonly SurveyedBuildingEnvelope[]};
/** Called inside the worker, or inline after worker failure. Native inputs are
 * authoritative; rejected sources never acquire roof ownership. */
export function buildTransportedEnvelopeChunk(features:readonly Feature[],options:EnvelopeBuildOptions,now?:string){
 const bindings=new Map();const seen=new Set<string>();const data=diagnosticEnvelopeTransport({schemaVersion:1,diagnosticOnly:true,envelopes:options.surveyedEnvelopeData??[]})?.envelopes??[];
 for(const f of [...features,...options.contextFeatures??[]]){
  const id=String(f.properties.id??'');if(seen.has(id))continue;seen.add(id);
  const candidate=data.find(e=>e.nativeParentId===id);if(!candidate)continue;
  try{const plan=adaptSurveyedBuildingEnvelope(candidate,{nativeParentId:id,footprint:f.geometry as EnvelopeFootprint,aggregateHeightM:Number(f.properties.height),constructionYear:Number(f.properties.constructionYear),now});
   if(plan){const bound=bindSurveyedEnvelopeToMesh(plan,f.geometry as EnvelopeFootprint,ORIGIN);
    // Source tolerances do not confer runtime roof ownership: the chunk builder
    // requires exact installed metadata and otherwise emits the stock roof.
    if(bound&&bound.nativeMetadata.aggregateHeightM===Number(f.properties.height)
      &&bound.nativeMetadata.constructionYear===Number(f.properties.constructionYear))bindings.set(id,bound);}
  }catch{/* malformed diagnostics retain stock geometry */}
 }
 const chunk=buildFeatureChunk(features,options.look,options.mode??'walls',options.streets,options.profiles,options.contextFeatures,options.hostOpenings,bindings);
 const sourceIds=new Set(features.map(f=>String(f.properties.id??'')));
 const boundParentIds=options.mode==='extras'?[]:[...bindings.keys()].filter(id=>sourceIds.has(id)&&chunk.ranges.some(r=>r.id===id&&r.count>0));
 return {chunk,boundParentIds};
}
