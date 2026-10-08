import envelopeFixture from './fixtures/compoundSurveyEnvelope.json';
import installedFootprintFixture from './fixtures/compoundInstalledFootprint.json';
const fixtureReviewClock='2026-10-06T23:59:59Z';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileSurveyedEnvelope} from '../../scripts/street-appearance/compile-surveyed-envelope.ts';
import {adaptSurveyedBuildingEnvelope,envelopeFootprintFingerprint,legacyExtractFootprint,surveyedEnvelopeRdToLngLat,type EnvelopeContext,type EnvelopeFootprint} from './surveyedBuildingEnvelope.ts';
import {rdToLngLat,lngLatToRd} from './facade/rdNew.ts';
function fixture(){
 const parent='NL.IMBAG.Pand.0363100012178298',anchor=[121715,487420],ground=1,outer=[[0,0],[10,0],[10,10],[0,10]],hole=[[3,3],[7,3],[7,7],[3,7]],vertices:number[][]=[],surfaces:number[][][]=[],values:number[]=[];
 const add=(rings:number[][][],semantic:number)=>{surfaces.push(rings.map(r=>r.map(p=>{vertices.push([p[0]+anchor[0],p[1]+anchor[1],p[2]+ground]);return vertices.length-1;})));values.push(semantic);};
 const roof=(p:number[])=>[...p,10+p[1]*.4];add([outer.map(roof),hole.map(roof)],0);add([hole.map(p=>[...p,12])],0);
 outer.forEach((a,i)=>{const b=outer[(i+1)%4];add([[[...a,0],[...b,0],roof(b),roof(a)]],1);});
 hole.forEach((a,i)=>{const b=hole[(i+1)%4];add([[roof(a),roof(b),[...b,12],[...a,12]]],2);});
 const rdRing=outer.map(p=>[p[0]+anchor[0],p[1]+anchor[1]]);rdRing.push(rdRing[0]);
 const footprint:EnvelopeFootprint={type:'Polygon',coordinates:[rdRing.map(p=>rdToLngLat({x:p[0],y:p[1]}))]};
 const pand={identificatie:'0363100012178298',oorspronkelijkBouwjaar:1650,geometrie:{type:'Polygon',coordinates:[rdRing]},eindGeldigheid:null};
 const cityjson={id:parent,metadata:{metadata:{referenceSystem:'https://www.opengis.net/def/crs/EPSG/0/7415'},transform:{scale:[1,1,1],translate:[0,0,0]}},feature:{vertices,CityObjects:{[parent]:{attributes:{identificatie:parent,oorspronkelijkbouwjaar:1650,b3_h_maaiveld:ground,b3_h_dak_70p:13,b3_pw_datum:2023,b3_pw_onvoldoende:false,b3_val3dity_lod22:'[]',b3_rmse_lod22:.2}},[parent+'-0']:{parents:[parent],geometry:[{lod:'2.2',type:'Solid',boundaries:[surfaces],semantics:{surfaces:[{type:'RoofSurface'},{type:'WallSurface',on_footprint_edge:true},{type:'WallSurface',on_footprint_edge:false}],values:[values]}}]}}}};
 const source={archivePath:'streets/test/raw/survey.json',bagArchivePath:'streets/test/raw/pand.json',rawSha256:'a'.repeat(64),bagRawSha256:'b'.repeat(64),compiledAt:'2026-10-06T00:00:00Z'};
 const envelope=compileSurveyedEnvelope(pand,cityjson,footprint,source),context:EnvelopeContext={nativeParentId:parent,footprint,aggregateHeightM:12,constructionYear:1650,now:'2026-10-06T01:00:00Z'};return{envelope,context,pand,cityjson,source};
}
const area=(p:number[][])=>Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))/2;
const contains=(tri:number[][],p:number[])=>tri.every((a,i)=>{const b=tri[(i+1)%3];return(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-8;});
test('surveyed slope, roof insertion and local junctions preserve original metadata and hole topology',()=>{
 const {envelope,context}=fixture(),plan=adaptSurveyedBuildingEnvelope(envelope,context);assert(plan);assert.deepEqual(plan.nativeMetadata,{aggregateHeightM:12,constructionYear:1650});assert.equal(envelope.roofSurfaces[0].rings.length,2);
 assert(plan.roofTriangles.every(t=>t.n[2]>0));assert(plan.closureTriangles.length>0);
 assert(!plan.roofTriangles.filter(t=>t.sourceSurfaceIndex===0).some(t=>contains(t.p,[5,5])));assert(plan.roofTriangles.filter(t=>t.sourceSurfaceIndex===1).some(t=>contains(t.p,[5,5])));
 assert(Math.abs(plan.roofTriangles.reduce((a,t)=>a+area(t.p),0)-100)<.01);assert.equal(plan.wallTopAt(5,0),10);assert.equal(plan.wallTopAt(5,10),14);assert.deepEqual(plan.wallTopSegments([10,0],[10,10]),[[10,0,10],[10,10,14]]);assert.equal(plan.wallTopSegments([3,2],[8,2]),undefined);
 assert.equal(plan.coarseRoofTriangles,plan.roofTriangles); // caller retains cheap source silhouette, not an aggregate lid
});
test('atomic rejection on identity, installed footprint, original year, source time/quality and incomplete wall/roof evidence',()=>{
 const {envelope,context}=fixture();const copy=()=>structuredClone(envelope);
 for(const ctx of [{...context,nativeParentId:'neighbor'},{...context,aggregateHeightM:14},{...context,constructionYear:1920},{...context,now:'2020-01-01'},{...context,now:'2040-01-01'}])assert.equal(adaptSurveyedBuildingEnvelope(envelope,ctx),undefined);
 for(const mutate of [(e:typeof envelope)=>e.source.quality.insufficient=true,(e:typeof envelope)=>e.source.rawSha256='bad',(e:typeof envelope)=>e.exteriorWallTopProfiles.pop(),(e:typeof envelope)=>e.roofSurfaces.shift(),(e:typeof envelope)=>e.footprintLocal[0][0][0]+=1]){const e=copy();mutate(e);assert.equal(adaptSurveyedBuildingEnvelope(e,context),undefined);}
 const footprint=structuredClone(context.footprint);footprint.coordinates[0][0][0]+=.001;const e=copy();e.installedFootprintFingerprint=envelopeFootprintFingerprint(footprint);assert.equal(adaptSurveyedBuildingEnvelope(e,{...context,footprint}),undefined);
});
test('native courtyard clips roof triangles without converting a roof insertion into a ground hole',()=>{
 const {envelope,context}=fixture();const e=structuredClone(envelope),footprint=structuredClone(context.footprint),hole=[[3,3],[7,3],[7,7],[3,7]];e.footprintLocal.push(hole);footprint.coordinates.push(hole.map(p=>rdToLngLat({x:e.anchorRd[0]+p[0],y:e.anchorRd[1]+p[1]})));e.installedFootprintFingerprint=envelopeFootprintFingerprint(footprint);
 e.exteriorWallTopProfiles.push(...hole.map((p,i)=>({sourceSurfaceIndex:100+i,points:[[...p,12],[...hole[(i+1)%4],12]] as [number,number,number][]})));
 const plan=adaptSurveyedBuildingEnvelope(e,{...context,footprint});assert(plan);assert(!plan.roofTriangles.some(t=>contains(t.p,[5,5])));assert(Math.abs(plan.roofTriangles.reduce((a,t)=>a+area(t.p),0)-84)<.01);assert.equal(envelope.footprintLocal.length,1);assert.equal(context.footprint.coordinates.length,1);
});

test('wall top segments split at overlapping surveyed profile crossings rather than drawing through the upper envelope',()=>{
 const {envelope,context}=fixture();envelope.exteriorWallTopProfiles.push({sourceSurfaceIndex:100,points:[[0,0,12],[10,0,8]]});const plan=adaptSurveyedBuildingEnvelope(envelope,context);assert(plan);assert.deepEqual(plan.wallTopSegments([0,0],[10,0]),[[0,0,12],[5,0,10],[10,0,10]]);
});

test('legacy extraction frame requires exact LoD0/round6 proof and is not interchangeable with corrected BAG WGS84',()=>{
 const {envelope,context,pand,cityjson,source}=fixture();(cityjson.feature.CityObjects[context.nativeParentId]as any).geometry=[{type:'MultiSurface',lod:'0',boundaries:[[[0,1,2,3]]]}];
 const footprint=legacyExtractFootprint(envelope.anchorRd,envelope.footprintLocal),legacy=compileSurveyedEnvelope(pand,cityjson,footprint,source),legacyContext={...context,footprint};
 assert.equal(legacy.coordinateFrame,'legacy-extract-rd-no-nsgi');const plan=adaptSurveyedBuildingEnvelope(legacy,legacyContext);assert(plan);assert.deepEqual(plan.originLngLat,surveyedEnvelopeRdToLngLat(legacy,{x:legacy.anchorRd[0],y:legacy.anchorRd[1]}));
 const inverse=plan.installedLngLatToRd(plan.originLngLat);assert(Math.hypot(inverse.x-legacy.anchorRd[0],inverse.y-legacy.anchorRd[1])<.001);
 assert.equal(adaptSurveyedBuildingEnvelope(legacy,context),undefined);assert.equal(adaptSurveyedBuildingEnvelope(envelope,legacyContext),undefined);
 for(const mutate of [(e:typeof legacy)=>e.frameProof!.sourceLoD0Local[0][0][0]+=.1,(e:typeof legacy)=>e.frameProof!.sourceRawSha256='c'.repeat(64),(e:typeof legacy)=>e.coordinateFrame='nsgi-aligned-rd-polynomial']){const e=structuredClone(legacy);mutate(e);assert.equal(adaptSurveyedBuildingEnvelope(e,legacyContext),undefined);}
 assert.deepEqual(legacy.nativeMetadata,envelope.nativeMetadata);assert.deepEqual(legacy.roofSurfaces,envelope.roofSurfaces);
});

test('validated legacy inverse reverses the actual candidate frame without applying the NSGI offset twice',()=>{
 const envelope=JSON.parse(JSON.stringify(envelopeFixture)),footprint=JSON.parse(JSON.stringify(installedFootprintFixture));
 const plan=adaptSurveyedBuildingEnvelope(envelope,{nativeParentId:envelope.nativeParentId,footprint,...envelope.nativeMetadata,now:fixtureReviewClock});assert(plan);assert.equal(plan.coordinateFrame,'legacy-extract-rd-no-nsgi');
 for(const local of envelope.roofSurfaces.flatMap((s:any)=>s.rings.flat())){const rd={x:envelope.anchorRd[0]+local[0],y:envelope.anchorRd[1]+local[1]},wgs=plan.rdToInstalledLngLat(rd),back=plan.installedLngLatToRd(wgs);assert(Math.hypot(back.x-rd.x,back.y-rd.y)<.001);const wrong=lngLatToRd(wgs);assert(Math.hypot(wrong.x-rd.x,wrong.y-rd.y)>.25);}
 const source=envelope.frameProof.sourceLoD0Local[0][0],first=plan.installedLngLatToRd(footprint.coordinates[0][0]);assert(Math.hypot(first.x-envelope.anchorRd[0]-source[0],first.y-envelope.anchorRd[1]-source[1])<.07); // six-decimal footprint rounding, not a survey height/position tolerance
});
