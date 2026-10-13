/** Convert individually inspected facade annotations and surveyed roof evidence to recipes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as T from 'three';
import {reconcileHerengracht423Survey} from './frontage-423.ts';
import {rebaseFacadeDatum} from './facade-datum.ts';
import {inferPrincipalFrontReturn} from './front-return.ts';
import {mapStoepProfile,stoepApertureOverlap} from './stoep-profile.ts';
import {canalhouseCorniceLayers} from '../../src/canalRecall/canalhouseCorniceAssembly.ts';
import {canalhouseGroundFront} from '../../src/canalRecall/canalhouseGroundFront.ts';
import {canalhouseOpeningTemplate} from '../../src/canalRecall/canalhouseOpeningTemplates.ts';
import {unobservedHouse} from '../../src/canalRecall/facade/houseRecord.ts';
import {measured, type Observation} from '../../src/canalRecall/facade/evidence.ts';
import {rdToLngLat,lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import type {CanalHouseRecipe,CanalhousePoint,CanalhousePolygon} from '../../src/canalRecall/canalhouseRecipes.ts';

const root='docs/references/canalhouse-recipes';
const inventory=JSON.parse(await fs.readFile(`${root}/pilot-inventory.json`,'utf8'));
const annotations=JSON.parse(await fs.readFile(`${root}/facade-observations.json`,'utf8'));
const lowerFacades=JSON.parse(await fs.readFile(`${root}/souterrain-observations.json`,'utf8'));
const lowerViews=JSON.parse(await fs.readFile(`${root}/lower-source-projections.json`,'utf8'));
const frontReturns=JSON.parse(await fs.readFile(`${root}/front-return-inference.json`,'utf8'));
const archive=path.resolve('../map-recall2-source-data');
const area=(ring:number[][])=>ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2;
const clockwise=(ring:CanalhousePoint[])=>area(ring)>0?[...ring].reverse():ring;
const entries=[];
for(const h of inventory.houses){
 let note=annotations.houses.find((a:any)=>a.id===h.id);if(!note||note.pandId!==h.bagId)throw Error(`Missing individual observation ${h.id}`);
 let lower=lowerFacades.houses.find((a:any)=>a.id===h.id);if(!lower||lower.pandId!==h.bagId)throw Error(`Missing lower-facade observation ${h.id}`);
 const preferredLowerStation=({'herengracht-417':'herengracht-415','herengracht-425':'herengracht-425','herengracht-427':'herengracht-425'} as Record<string,string>)[h.id];
 const lowerView=lowerViews.find((v:any)=>v.target===h.id&&v.station===preferredLowerStation);
 const basementPanorama=lower.comparisonPanorama??(lowerView?{url:lowerView.rawSource.url.replace('panorama_8000.jpg','panorama_4000.jpg'),headingDeg:lowerView.projection.headingDeg,pitchDeg:0,fovDeg:18,capturedAt:lowerView.captureDate,rights:lowerView.rights}:null);
 const datum=lower.datumCorrection?rebaseFacadeDatum(note,lower,lower.datumCorrection.newGroundPixel):null;
 if(datum){note=datum.note;lower=datum.lower;}
 const approachSource=lower.approachSource?JSON.parse(await fs.readFile(`${root}/${lower.approachSource}`,'utf8')):null;
 if(approachSource&&(approachSource.houseId!==h.id||approachSource.pandId!==h.bagId))throw Error(`Foreign approach source ${h.id}`);
 const sourceSurvey=JSON.parse(await fs.readFile(h.height.surveyFile,'utf8'));
 const correction=h.id==='herengracht-423'?reconcileHerengracht423Survey(sourceSurvey,h,{inferFrontReturn:true}):null;
 const survey=correction?.survey??sourceSurvey;
 const ground=survey.attributes.b3_h_maaiveld;
 const allGround=survey.surveyFootprintPolygonsRD.flatMap((p:number[][][])=>p[0]);
 const anchorRD=[allGround.reduce((s:number,p:number[])=>s+p[0],0)/allGround.length,allGround.reduce((s:number,p:number[])=>s+p[1],0)/allGround.length];
 const local=(p:number[]):CanalhousePoint=>[p[0]-anchorRD[0],anchorRD[1]-p[1]];
 const polygons:CanalhousePolygon[]=survey.surveyFootprintPolygonsRD.map((rings:number[][][])=>({outer:clockwise(rings[0].map(local)),holes:rings.slice(1).map(r=>r.map(local))}));
 // Select only southwest-facing outer walls at the observed principal frontage.
 const candidates=polygons.flatMap((polygon,polygonIndex)=>polygon.outer.map((a,edgeIndex)=>{
  const b=polygon.outer[(edgeIndex+1)%polygon.outer.length],dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz);
  return {polygonIndex,edgeIndex,a,b,width,n:[-dz/width,dx/width],score:(a[0]+b[0]-a[1]-b[1])/2};
 })).filter(e=>e.width>.5&&e.n[0]<-.3&&e.n[1]>.3);
 if(!candidates.length)throw Error(`No source frontage ${h.id}`);
 const ref=h.native.frontEdgeRD.map((p:any)=>local([p.x,p.y])),rx=ref[1][0]-ref[0][0],rz=ref[1][1]-ref[0][1],rw=Math.hypot(rx,rz);
 const refDistance=(p:number[])=>Math.abs((p[0]-ref[0][0])*rz-(p[1]-ref[0][1])*rx)/rw;
 const eligible=candidates.filter(e=>Math.max(refDistance(e.a),refDistance(e.b))<.6);
 const polygonIndex=eligible[0].polygonIndex,ring=polygons[polygonIndex].outer;
 const indices=new Set(eligible.filter(e=>e.polygonIndex===polygonIndex).map(e=>e.edgeIndex));
 // Short surveyed frontage jogs are connectors, not separate house fronts.
 // Only bridge bounded segments between already selected principal edges.
 for(const index of [...indices]){
  let next=(index+1)%ring.length;const bridge:number[]=[];
  while(!indices.has(next)&&bridge.length<4){
   const a=ring[next],b=ring[(next+1)%ring.length];
   const lineDistance=(p:number[])=>Math.abs((p[0]-ref[0][0])*rz-(p[1]-ref[0][1])*rx)/rw;
   if(Math.hypot(b[0]-a[0],b[1]-a[1])>.5||Math.max(lineDistance(a),lineDistance(b))>.3)break;
   bridge.push(next);next=(next+1)%ring.length;
  }
  if(indices.has(next))for(const edge of bridge)indices.add(edge);
 }
 const starts=[...indices].filter(i=>!indices.has((i+ring.length-1)%ring.length));
 const fronts=starts.map(start=>{
  let end=(start+1)%ring.length;while(indices.has(end))end=(end+1)%ring.length;
  const a=ring[start],b=ring[end],dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz);
  return {polygonIndex,edgeIndex:start,endEdgeIndex:end,a,b,width,n:[-dz/width,dx/width]};
 }).sort((a,b)=>(a.a[0]+a.a[1])-(b.a[0]+b.a[1]));
 if(!fronts.length)throw Error(`No bounded frontage ${h.id}`);
 const front=fronts[0],width=fronts.reduce((sum,f)=>sum+f.width,0);
 const dist=(p:number[])=>Math.abs((p[0]-anchorRD[0]-front.a[0])*(front.b[1]-front.a[1])-(anchorRD[1]-p[1]-front.a[1])*(front.b[0]-front.a[0]))/width;
 const near=survey.roofsRD.flatMap((r:any)=>r.vertices).filter((p:number[])=>dist(p)<.35);
 if(!near.length)throw Error(`No roof boundary for ${h.id}`);
 const frontRoofTop=Math.max(...near.map((p:number[])=>p[2]-ground));
 const crownRatio=Math.max(...note.crown.profileNormalized.map((p:number[])=>p[1]));
 const derivedBody=note.crown.label==='lijst'?frontRoofTop:Math.max(frontRoofTop/crownRatio,Math.min(...near.map((p:number[])=>p[2]-ground)));
 const body=correction?.provenance.frontBodyM??derivedBody;
 const shellTop=Math.min(...survey.roofsRD.flatMap((r:any)=>r.vertices.map((p:number[])=>p[2]-ground)))-.001;
 const registry:Observation={id:`${h.id}-bag`,pandId:h.bagId,kind:'registry-record',elevation:'front',capturedAt:inventory.retrieved.slice(0,10),sourceUrl:h.officialAddressLinks[0].vboSource.url,license:'CC0-1.0'};
 const photoHouse=inventory.houses.find((other:any)=>other.id===note.sources.principalImageHouseId)??h;
 const photo:Observation={id:`${h.id}-photo-observation`,pandId:h.bagId,kind:'human-review',elevation:'front',capturedAt:note.sources.captureDate.slice(0,10),sourceUrl:photoHouse.currentFacade.rawSource.url,license:'CC BY 4.0'};
 const lowerPhoto:Observation=basementPanorama?{id:`${h.id}-lower-photo-observation`,pandId:h.bagId,kind:'human-review',elevation:'front',capturedAt:basementPanorama.capturedAt.slice(0,10),sourceUrl:basementPanorama.url,license:'CC BY 4.0'}:photo;
 const roofObservation:Observation={id:`${h.id}-roof-survey`,pandId:h.bagId,kind:'oblique-aerial',elevation:'roof',capturedAt:`${survey.attributes.b3_pw_datum}-01-01`,sourceUrl:survey.sourceUrl,license:'CC BY 4.0'};
 const face=<V>(v:V)=>measured(v,'reviewed',correction?.provenance.frontBodyEvidence?.confidence??(datum?.35:.65),photo),roofValue=<V>(v:V)=>measured(v,correction?'reviewed':'3dbag',correction?.provenance.frontReturn?.confidence??correction?.provenance.frontBodyEvidence?.confidence??.85,roofObservation);
 const roof:any[]=[],roofOwners:string[]=[];
 // Semantic surfaces may contain non-planar survey vertices. Re-triangulate
 // their original rings rather than amplify rounded triples into giant planes.
 for(const surface of survey.roofsRD){
  const rings=surface.ringsRD??[surface.vertices],vertices=rings.flat();
  const mapped=rings.map((ring:number[][])=>ring.map(p=>new T.Vector2(...local(p))));
  for(const triangle of T.ShapeUtils.triangulateShape(mapped[0],mapped.slice(1))){
   const points=triangle.map(i=>{const p=vertices[i];const q=local(p);return[q[0],p[2]-ground,q[1]]});
   const [a,b,c]=points,x1=b[0]-a[0],z1=b[2]-a[2],x2=c[0]-a[0],z2=c[2]-a[2],den=x1*z2-x2*z1;
   if(Math.abs(den)<1e-9)continue; // Collinear source snap vertices do not define a roof surface.
   const slopeX=((b[1]-a[1])*z2-(c[1]-a[1])*z1)/den,slopeZ=(x1*(c[1]-a[1])-x2*(b[1]-a[1]))/den;
   roof.push({polygon:{outer:clockwise(points.map(p=>[p[0],p[2]] as CanalhousePoint)),holes:[]},plane:{heightM:a[1]-a[0]*slopeX-a[2]*slopeZ,slopeX,slopeZ}});
   roofOwners.push(surface.surfaceId);
  }
 }
 const returnCandidate=frontReturns.candidates.find((c:any)=>c.id===h.id&&c.pandId===h.bagId);
 const frontReturn=returnCandidate?inferPrincipalFrontReturn(roof,{principalFront:[front.a,front.b],inwardNormal:[-front.n[0],-front.n[1]],bodyHeightM:body,transitionDepthM:returnCandidate.parameters.transitionDepthM,slopeInward:returnCandidate.parameters.slopeInward,confidence:returnCandidate.confidence,frontageToleranceM:.3,sourceSurfaceIds:roofOwners}):null;
 const house=unobservedHouse(h.bagId);house.eavesHeightM=face(body);house.gable=face(note.crown.label);
 house.plotWidthM=measured(width,'bag',.95,registry);
 // A visible fragment is not a measured complete opening. Keep those records
 // in the inventory until an adjacent view establishes the aperture extent.
 const admittedLower=lower.openings.filter((o:any)=>['observed-approximate','inferred-complete-aperture'].includes(o.admission));
 const deferredLower=lower.openings.filter((o:any)=>!admittedLower.includes(o));
 const authoredOpenings=[...note.openings,...admittedLower].flatMap((o:any)=>o.assembly==='paired-segmental'?[0,1].map(i=>({...o,id:o.id+'-leaf-'+i,left:o.left+i*o.width/2,width:o.width/2,head:'segmental',vertical:[]})):[o]);
 const openingChoice=(o:any)=>o.frameTemplate??(o.kind==='window'&&!o.id.startsWith('souterrain')?note.windowFrame:null);
 const openingFrame=(o:any)=>{const choice=openingChoice(o);return choice?canalhouseOpeningTemplate(choice):{};};
 const frameChoices=new Map<string,{selection:any;openingIds:string[];resolvedFrame:ReturnType<typeof canalhouseOpeningTemplate>}>();
 for(const o of authoredOpenings.filter((o:any)=>o.assembly!=='roof-dormer')){
  const choice=openingChoice(o);if(!choice)continue;const key=JSON.stringify(choice);
  const group=frameChoices.get(key)??{selection:choice,openingIds:[],resolvedFrame:canalhouseOpeningTemplate(choice)};
  group.openingIds.push(`${h.id}-${o.id}`);frameChoices.set(key,group);
 }
 const openings=authoredOpenings.filter((o:any)=>o.assembly!=='roof-dormer').map((o:any)=>({id:`${h.id}-${o.id}`,kind:o.kind,leftM:o.left*width,bottomM:o.bottom*body,widthM:o.width*width,heightM:o.height*body,trimWidthM:Math.min(.075,o.width*width*.12,...(o.id.startsWith('souterrain')?[o.height*body*.08]:[])),frameDepthM:o.id.startsWith('souterrain')?.08:.12,...(o.id.startsWith('souterrain')?{paneOffsetM:.03}:{}),...openingFrame(o),verticalBars:o.vertical??[],horizontalBars:o.horizontal??[],...(o.mullionWidthM?{mullionWidthM:o.mullionWidthM}:{}),...(o.panels?{panels:o.panels}:{}),...(o.diagonals?{diagonalBars:o.diagonals}:{}),...(o.projectionM!==undefined?{projectionM:o.projectionM}:{}),...(o.head?{head:o.head,headRiseM:o.headRise*body}:{})}));
 const approachDefinition=approachSource?(lower.approachVariant?approachSource[lower.approachVariant]:approachSource):null;
 if(approachSource&&!approachDefinition)throw Error(`Missing selected approach candidate ${h.id}`);
 const approach=approachDefinition?mapStoepProfile(approachDefinition.input,{frontageWidthM:width,thresholdM:approachDefinition.frame?.thresholdM??note.door.bottom*body,riseM:approachDefinition.frame?.riseM??note.door.bottom*body}):null;
 const landingLeft=(lower.landingAdmission?.leftNormalized??note.door.left)*width;
 const landingWidth=(lower.landingAdmission?.widthNormalized??note.door.width)*width;
 const landingTop=lower.landingAdmission?.topM??note.door.bottom*body;
 const approachOverlap=approach?stoepApertureOverlap(approach.sideOutline,openings.map(o=>({id:o.id,left:o.leftM,bottom:o.bottomM,width:o.widthM,height:o.heightM}))):[];
 const sourceOcclusions=(lower.approachOccludedOpeningIds??[]).map((id:string)=>`${h.id}-${id}`);
 if(approachOverlap.some(o=>!sourceOcclusions.includes(o.id)))throw Error(`Unobserved approach occlusion ${h.id}`);
 const topBand=note.horizontalBands.find((b:any)=>b.bottom+b.height>.999&&b.bottom>.94);
 const bands=note.horizontalBands.filter((b:any)=>b!==topBand).map((b:any,i:number)=>({id:`band-${i}`,leftM:0,bottomM:b.bottom*body,widthM:width,heightM:b.height*body,depthM:.06,surface:(/basement|plinth/.test(b.label)&&lower.baseMasonryColorApproximate?'stone':'trim') as 'stone'|'trim'}));
 const dormerOpenings=note.openings.filter((o:any)=>o.assembly==='roof-dormer');
 const dormers=dormerOpenings.map((o:any)=>({id:o.id,leftM:o.left*width-.025,widthM:o.width*width+.05,bottomM:o.bottom*body,heightM:o.height*body,depthM:.65,roofRiseM:0,trimWidthM:.055,verticalBars:o.vertical??[],horizontalBars:o.horizontal??[]}));
 const ornaments=(note.ornamentsNormalized??[]).map((o:any)=>({...o,profile:o.profile.map((p:number[])=>[p[0]*width,p[1]*body])}));
 const groundFront=note.groundFront?{id:note.groundFront.id,leftM:note.groundFront.left*width,bottomM:note.groundFront.bottom*body,widthM:note.groundFront.width*width,heightM:note.groundFront.height*body,depthM:note.groundFront.depthM,surface:note.groundFront.surface,openingIds:note.groundFront.openingIds.map((id:string)=>`${h.id}-${id}`),...(note.groundFront.header?{header:{bottomM:note.groundFront.header.bottom*body,heightM:note.groundFront.header.height*body,depthM:note.groundFront.header.depthM,...(note.groundFront.header.surface?{surface:note.groundFront.header.surface}:{})}}:{})}:null;
 const groundFrontBlocks=groundFront?canalhouseGroundFront(groundFront,openings):[];
 const blocks=[...groundFrontBlocks,{id:'observed-front-body',leftM:0,bottomM:shellTop,widthM:width,heightM:body-shellTop,depthM:.025,surface:'wall' as const},...(note.facadeBlocksNormalized??[]).map((b:any)=>({id:b.id,leftM:b.left*width,bottomM:b.bottom*body,widthM:b.width*width,heightM:b.height*body,depthM:b.depthM,surface:b.surface}))];
 const recipe:CanalHouseRecipe={schemaVersion:1,id:h.id,house,observations:[registry,photo,roofObservation,...(lowerPhoto!==photo?[lowerPhoto]:[])],shellTopM:roofValue(shellTop),footprint:correction?measured(polygons,'bag',.95,registry):roofValue(polygons),palette:face({...note.paletteApproximate,roof:'#514d49'}),roof:frontReturn?measured(frontReturn.roofs,'reviewed',returnCandidate.confidence,roofObservation):roofValue(roof),elevations:fronts.map((f,index)=>{
    const start=fronts.slice(0,index).reduce((sum,v)=>sum+v.width,0);
    const select=(items:any[])=>items.filter(o=>o.leftM+o.widthM/2>=start&&o.leftM+o.widthM/2<start+f.width).map(o=>({...o,leftM:o.leftM-start}));
    const approachX=approach?[...(approach.topProfile??[]),...approach.railProfile,...approach.posts.map(p=>[p.xM,p.bottomM])].map(p=>p[0]):[];
    const approachOnFace=approach&&Math.min(...approachX)>=start&&Math.max(...approachX)<=start+f.width;
    const outline=note.crown.profileNormalized;
    const at=(fraction:number)=>{for(let i=1;i<outline.length;i++){const a=outline[i-1],b=outline[i];if(b[0]>a[0]&&fraction>=a[0]&&fraction<=b[0])return a[1]+(b[1]-a[1])*(fraction-a[0])/(b[0]-a[0]);}return 1;};
    const profile=[[0,at(start/width)*body],...outline.filter((p:number[])=>p[0]*width>start&&p[0]*width<start+f.width).map((p:number[])=>[p[0]*width-start,p[1]*body]),[f.width,at((start+f.width)/width)*body]];
    return {id:`principal-${index}`,polygonIndex:f.polygonIndex,edgeIndex:f.edgeIndex,endEdgeIndex:f.endEdgeIndex,frontageToleranceM:face(.3),openings:measured(select(openings),'reviewed',admittedLower.some((o:any)=>o.admission==='inferred-complete-aperture')?.35:admittedLower.length?.55:.65,photo),crown:face({profile:profile as CanalhousePoint[],depthM:.18,trimWidthM:.08}),bands:face(bands.map((b:any)=>({...b,widthM:f.width}))),blocks:face(blocks.filter(b=>b.leftM+b.widthM>start&&b.leftM<start+f.width).map(b=>({...b,leftM:Math.max(b.leftM,start)-start,widthM:Math.min(b.leftM+b.widthM,start+f.width)-Math.max(b.leftM,start)}))),...(ornaments.length?{ornaments:face(ornaments)}:{}),...(topBand?{cornice:face({bottomM:topBand.bottom*body,heightM:topBand.height*body,depthM:.2,brackets:0,...(note.corniceFragmentsNormalized?{accents:select(note.corniceFragmentsNormalized.map((c:any,i:number)=>({id:'visible-console-'+i,leftM:(c.centerX-c.width/2)*width,widthM:c.width*width,bottomM:c.bottom*body,heightM:c.height*body,depthM:.23,profile:'console'})))}:{}),...(note.cornice.assembly?{layers:canalhouseCorniceLayers(topBand.bottom*body,topBand.height*body,note.cornice.assembly)}:note.cornice.profileLayers?{layers:note.cornice.profileLayers.map((l:any)=>({bottomM:(topBand.bottom+l.bottom*topBand.height)*body,heightM:l.height*topBand.height*body,depthM:l.depthM}))}:{})})}:{}),...(dormers.length?{dormers:face(select(dormers))}:{}),...(note.dormerFront?{dormerFront:face({profile:note.dormerFront.profileNormalized.map(([x,y]:number[])=>[x*width,y*body]),depthM:note.dormerFront.depthM,surface:note.dormerFront.surface,trimWidthM:note.dormerFront.trimWidthM})}:{}),...(approachOnFace?{approach:measured({topProfile:approach.topProfile?.map(([x,y])=>[x-start,y])??null,groundM:approach.groundM,backM:approach.depth.backM,depthM:approach.depth.frontM-approach.depth.backM,railProfile:approach.railProfile.map(([x,y])=>[x-start,y]),posts:approach.posts.map(p=>({...p,xM:p.xM-start})),railWidthM:approachSource.drawingRegistration.railDiameterDrawingM,postWidthM:approachSource.drawingRegistration.postWidthDrawingM,occludedOpeningIds:sourceOcclusions},'reviewed',.45,lowerPhoto)}:{}),...(lower.landingAdmission&&landingLeft>=start&&landingLeft+landingWidth<=start+f.width?{landing:measured({leftM:landingLeft-start,widthM:landingWidth,topM:landingTop,depthM:lower.landingAdmission.depthM??.5,thicknessM:.04,...(lower.landingAdmission.supportToGround?{supportToGround:true}:{}),...(lower.landingAdmission.thresholdConnector?{thresholdConnector:{riseM:note.door.bottom*body-landingTop,depthM:lower.landingAdmission.thresholdConnector.depthM}}:{})},'reviewed',lower.landingAdmission.confidence??.45,lowerPhoto)}:{})};
   }),
  simplifications:['Facade proportions are individually observed unrectified-photo approximations, not surveyed millimetres.','Body height combines the observed crown/body ratio with front-near surveyed roof height; source reconstruction may omit a parapet or dormer.','Native3DBAG ground/roof regions retain lower rear parts; current BAG identity and footprint are archived separately.','Frame thickness, shallow relief and dormer depth are explicit drawing approximations.','Hidden entrance steps, rear/party-wall openings and fine carving remain unresolved.','Facade detail planes may straighten surveyed frontage steps by up to0.3m; exact shell and replacement identities remain unchanged.',...(correction?['BAG/3DBAG discrepancy reconciled using bounded source-derived roof-plane continuation; front cornice and photo-constrained front roof return are explicit low-confidence inferences, not exact surveyed geometry.']:[]),...(note.capabilityGaps??[]),...(frontReturn?['Principal front roof return is a reversible, explicitly low-confidence inference. Native footprint and rear source roof retained; exact hidden section unresolved.']:[]),...(datum?['Pavement datum corrected from vehicle-obscured source line using bounded adjacent-view inference; full basement apertures and occluded bottoms are provisional.']:[]),...(deferredLower.length?['Lower opening fragments remain unmodeled until aperture extent is supported: '+deferredLower.map((o:any)=>o.id).join(', ')]:[])]};
 if(approach&&!recipe.elevations.some(e=>e.approach))throw Error(`Approach cannot silently cross unsupported source frontage ${h.id}`);
 // Palette notes are provenance, not rendering fields.
 recipe.palette.value={wall:note.paletteApproximate.wall,roof:'#514d49',trim:note.paletteApproximate.trim,glass:note.paletteApproximate.glass,door:note.paletteApproximate.door,...(lower.baseMasonryColorApproximate?{stone:lower.baseMasonryColorApproximate}:{})};
 entries.push({name:h.address,sample:note.sampleRole,anchorRD,anchor:rdToLngLat({x:anchorRD[0],y:anchorRD[1]}),frontNormal:front.n,frontTarget:[(front.a[0]+fronts.at(-1)!.b[0])/2,body*.52,(front.a[1]+fronts.at(-1)!.b[1])/2],frontWidthM:width,suppressOsmIds:[h.buildingId],sourceUrl:h.register.rceUrl,
  lowerFacadeObservation:{approach:approach?{source:lower.approachSource,variant:lower.approachVariant,selectedFrame:approachDefinition.frame,overlaps:approachOverlap,maxContourVerticalJumpM:approach.maxContourVerticalJumpM,exactCurrentTreadCount:null,datumAudit:approachSource.datumAudit}:null,assemblyInterpretations:admittedLower.filter((o:any)=>o.panelAdmission).map((o:any)=>({id:o.id,panelAdmission:o.panelAdmission})),closeSourceEvidence:lower.closeSourceEvidence,deferredAssemblies:lower.deferredAssemblies,datum:datum?.provenance,reconstruction:admittedLower.filter((o:any)=>o.reconstruction).map((o:any)=>({id:o.id,...o.reconstruction})),path:root+'/souterrain-observations.json',admitted:admittedLower.map((o:any)=>o.id),deferred:deferredLower.map((o:any)=>({id:o.id,admission:o.admission,confidence:o.confidence})),exactStepCount:lower.exactStepCount,drawingApproximation:lower.drawingApproximation,landingAdmission:lower.landingAdmission,entranceRelation:lower.entranceRelation},...(correction?{sourceReconciliation:correction.provenance}:frontReturn?{sourceReconciliation:{...frontReturn.provenance,investigation:root+'/front-return-inference.json'}}:{}),sourceArchive:{path:`models/${h.id}/source-pack-index.json`,sharedPack:inventory.privateSourcePack,commit:inventory.sourceArchiveCommit??null},...(basementPanorama?{basementPanorama}:{}),panorama:{cameraRD:Object.values(lngLatToRd([h.currentFacade.camera.geometry.coordinates[0],h.currentFacade.camera.geometry.coordinates[1]])),cameraHeightM:2.5,cameraHeightNote:'Drawing approximation; GPS altitude zero is not pavement eye height',url:h.currentFacade.camera._links.equirectangular_medium.href,headingDeg:h.currentFacade.perspective.headingDeg,pitchDeg:12,capturedAt:h.currentFacade.camera.timestamp,rights:h.currentFacade.rights},references:[{label:'Observed municipal facade ·2024-12-03',url:photo.sourceUrl,privatePath:path.relative(archive,note.sources.principalImage)}],openingTemplateChoices:[...frameChoices.values()],...(groundFront?{groundFrontChoice:note.groundFront}:{}),...(note.cornice.assembly?{corniceAssemblyChoice:note.cornice.assembly}:{}),timings:{researchMinutes:null,authoringMinutes:null,reviewMinutes:null},recipe});
 console.log(h.id,'front',width.toFixed(2),'body',body.toFixed(2),'shell',shellTop.toFixed(2),'openings',openings.length,'dormers',dormers.length);
}
await fs.writeFile(`${root}/recipes.json`,JSON.stringify({schemaVersion:1,id:inventory.id,title:'Herengracht405–427 · individually observed component recipes',sourceArchive:{path:inventory.privateSourcePack,commit:inventory.sourceArchiveCommit??null},reviewRows:JSON.parse(await fs.readFile(`${root}/review-rows.json`,'utf8')),entries},null,2)+'\n');
