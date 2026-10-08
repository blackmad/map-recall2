import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import candidate from './fixtures/compoundSurveyEnvelope.json';
import {compoundSourceFeature as feature} from './compoundSourceCandidate.fixture.ts';
import {buildFeatureChunk} from './threeBuildingFeatures.ts';
import {ThreeBuildings} from './threeBuildingsBrowser.ts';
import {buildTransportedEnvelopeChunk,diagnosticEnvelopeTransport} from './surveyedEnvelopeTransport.ts';
const clock='2026-10-06T23:59:59Z';
const payload=()=>({schemaVersion:1,diagnosticOnly:true,envelopes:[structuredClone(candidate)]});
function same(a:any,b:any){for(const k of ['positions','uvs','layers','tints','accents','indices','ranges'])assert.deepEqual(a[k],b[k],k);}
test('diagnostic JSON clone carries no callback and worker builds sourced roofs in each look/coarse mode',()=>{
 const snapshot=diagnosticEnvelopeTransport(payload());assert(snapshot);
 const job=structuredClone({look:'photo' as const,surveyedEnvelopeData:snapshot.envelopes});
 assert.deepEqual(job.surveyedEnvelopeData,[candidate]);
 for(const look of ['photo','storybook','procedural']as const)for(const mode of ['walls','coarse']as const){const result=buildTransportedEnvelopeChunk([feature],{...job,look,mode},clock);assert.deepEqual(result.boundParentIds,[candidate.nativeParentId]);assert(Array.from(result.chunk.positions).some((v,i)=>i%3===2&&v>25.5));}
 assert.deepEqual(buildTransportedEnvelopeChunk([feature],{...job,mode:'extras'},clock).boundParentIds,[]);
});
test('invalid transport, changed native metadata/outline, stale source and absent data preserve exact stock fallback',()=>{
 const callback:any=payload();callback.envelopes[0].callback=()=>{};assert.equal(diagnosticEnvelopeTransport(callback),undefined);
 assert.equal(diagnosticEnvelopeTransport({...payload(),diagnosticOnly:false}),undefined);
 assert.equal(diagnosticEnvelopeTransport({...payload(),envelopes:[candidate,candidate]}),undefined);
 const p=payload();const snap=diagnosticEnvelopeTransport(p)!;p.envelopes[0].nativeParentId='mutated';assert.equal(snap.envelopes[0].nativeParentId,candidate.nativeParentId);
 const changed=structuredClone(feature);changed.properties.height=22.98;
 const conflict=buildTransportedEnvelopeChunk([changed],{look:'photo',surveyedEnvelopeData:[candidate] as any,contextFeatures:[feature]},clock);assert.deepEqual(conflict.boundParentIds,[]);
 const outline=structuredClone(feature);(outline.geometry as any).coordinates[0][0][0]+=.000001;
 for(const f of [feature,changed,outline])for(const mode of ['walls','coarse']as const){const data=f===feature?[]:[candidate];const built=buildTransportedEnvelopeChunk([f],{look:'photo',mode,surveyedEnvelopeData:data as any},clock);assert.deepEqual(built.boundParentIds,[]);same(built.chunk,buildFeatureChunk([f],'photo',mode));}
 for(const data of [[{...candidate,nativeParentId:'wrong'}],[candidate,candidate],[{...candidate,roofSurfaces:[]}]]){const result=buildTransportedEnvelopeChunk([feature],{look:'photo',surveyedEnvelopeData:data as any},clock);same(result.chunk,buildFeatureChunk([feature],'photo'));assert.deepEqual(result.boundParentIds,[]);}
 const expired=buildTransportedEnvelopeChunk([feature],{look:'photo',surveyedEnvelopeData:[candidate] as any},'2040-01-01T00:00:00Z');same(expired.chunk,buildFeatureChunk([feature],'photo'));assert.deepEqual(expired.boundParentIds,[]);
});
test('source height tolerance never suppresses a stock roof rejected by exact runtime metadata',()=>{
 const changed=structuredClone(feature);changed.properties.height=Number(feature.properties.height)+1e-7;
 for(const look of ['photo','storybook','cartoon','procedural']as const)for(const mode of ['walls','coarse']as const){
  const result=buildTransportedEnvelopeChunk([changed],{look,mode,surveyedEnvelopeData:[candidate]as any},clock);
  same(result.chunk,buildFeatureChunk([changed],look,mode));assert.deepEqual(result.boundParentIds,[]);
 }
});
test('roof ownership requires installed chunks, survives another owner, and restores on disable/visibility/removal',()=>{
 const calls:string[][]=[];const map:any={getZoom:()=>17,triggerRepaint(){},_pyramidalRoofs:{setHiddenReason(reason:string,ids:Iterable<string>){assert.equal(reason,'surveyed-envelope');calls.push([...ids]);}}};
 const browser:any=new ThreeBuildings(map,{}as any);browser.ready=true;assert(browser.setDiagnosticSurveyedEnvelopes(payload()));assert.deepEqual(map._surveyedEnvelopeRoofIds,[]);
 const entry=()=>({mesh:{userData:{boundParentIds:[candidate.nativeParentId]},geometry:{dispose(){}}},source:[],ranges:new Map()});
 browser.chunks.set('near:a',entry());browser.chunks.set('coarse:b',entry());browser.refreshSurveyedRoofOwnership();assert.deepEqual(map._surveyedEnvelopeRoofIds,[candidate.nativeParentId]);
 browser.dropChunk('near:a');assert.deepEqual(map._surveyedEnvelopeRoofIds,[candidate.nativeParentId]);browser.setVisible(false);assert.deepEqual(map._surveyedEnvelopeRoofIds,[]);browser.setVisible(true);assert.deepEqual(map._surveyedEnvelopeRoofIds,[candidate.nativeParentId]);
 assert.equal(browser.setDiagnosticSurveyedEnvelopes({}),false);assert.deepEqual(map._surveyedEnvelopeRoofIds,[]);assert.equal(browser.chunks.size,0);assert(calls.length>0);
});
test('render zoom and readiness changes restore fallback while source chunks remain resident',()=>{
 let zoom=17;const map:any={getZoom:()=>zoom,triggerRepaint(){}};const browser:any=new ThreeBuildings(map,{}as any);
 browser.ready=true;browser.chunks.set('coarse:a',{mesh:{userData:{boundParentIds:[candidate.nativeParentId]}}});
 const layer=browser.makeLayer();layer.render(null,{});assert.deepEqual(map._surveyedEnvelopeRoofIds,[candidate.nativeParentId]);
 for(const z of [14,13]){zoom=z;layer.render(null,{});assert.deepEqual(map._surveyedEnvelopeRoofIds,[]);}
 zoom=17;layer.render(null,{});assert.deepEqual(map._surveyedEnvelopeRoofIds,[candidate.nativeParentId]);
 browser.ready=false;layer.render(null,{});assert.deepEqual(map._surveyedEnvelopeRoofIds,[]);
});
test('pyramid reason union preserves landmark hiding and supports late renderer attachment',()=>{
 const raw=readFileSync(new URL('../../public/canal-drive/js/pyramidal-roofs-source.js',import.meta.url),'utf8');
 const source=raw.replace(/import \{[\s\S]*?\} from [^;]+;/,'').replace('export class PyramidalRoofs','class PyramidalRoofs');
 const window:any={CanalRecallThree:{THREE:{Matrix4:class{}}}};runInNewContext(source,{window,eavesHeightM(){},effectiveRoofHeightM(){},wantsPyramidalRoof(){}});
 const map:any={_surveyedEnvelopeRoofIds:['surveyed'],getLayer:()=>true,triggerRepaint(){}};
 const roofs=new window.CanalRecallPyramidalRoofs.PyramidalRoofs(map,{});roofs._entries=[{ids:['surveyed'],mesh:{}},{ids:['landmark'],mesh:{}}];
 roofs.setHidden(['landmark']);assert.equal(roofs._entries[0].mesh.visible,false);assert.equal(roofs._entries[1].mesh.visible,false);
 roofs.setHiddenReason('surveyed-envelope',[]);assert.equal(roofs._entries[0].mesh.visible,true);assert.equal(roofs._entries[1].mesh.visible,false);
});
test('failed diagnostic loads restore fallback and stale load replies cannot re-enable an old envelope',async()=>{
 const map:any={getZoom:()=>17,triggerRepaint(){}};const browser:any=new ThreeBuildings(map,{}as any);
 const original=globalThis.fetch;
 try{
  browser.setDiagnosticSurveyedEnvelopes(payload());
  globalThis.fetch=(async()=>{throw Error('bounded access failure');})as any;
  assert.equal(await browser.loadDiagnosticSurveyedEnvelopes('/diagnostic.json'),false);assert.equal(browser.surveyedEnvelopeTransport.envelopes.length,0);
  let finish:(response:any)=>void=()=>{};globalThis.fetch=(()=>new Promise(resolve=>{finish=resolve;}))as any;
  const pending=browser.loadDiagnosticSurveyedEnvelopes('/old.json');browser.setDiagnosticSurveyedEnvelopes({schemaVersion:1,diagnosticOnly:true,envelopes:[]});
  finish({ok:true,json:async()=>payload()});assert.equal(await pending,false);assert.equal(browser.surveyedEnvelopeTransport.envelopes.length,0);
  const removed=browser.loadDiagnosticSurveyedEnvelopes('/removed.json');browser.dispose();
  finish({ok:true,json:async()=>payload()});assert.equal(await removed,false);assert.equal(browser.surveyedEnvelopeTransport.envelopes.length,0);
 }finally{globalThis.fetch=original;}
});
test('stale envelope chunk cannot install or acquire independent roof ownership',()=>{
 const map:any={getZoom:()=>17,triggerRepaint(){}};const browser:any=new ThreeBuildings(map,{}as any);browser.THREE={};browser.currentSource=()=>true;
 const source=[feature];const options:any={look:'procedural',appearanceRevision:'',hostOpeningRevision:'[]',surveyedEnvelopeRevision:'old'};
 browser.install('near:a',source,{vertexCount:1},0,options,[candidate.nativeParentId]);assert.equal(browser.chunks.size,0);assert.equal(map._surveyedEnvelopeRoofIds,undefined);
});
