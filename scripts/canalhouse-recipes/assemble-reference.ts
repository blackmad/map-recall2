/** Compose source-authored data using shared components; no address branches. */
import fs from 'node:fs/promises';
import {expandBaySets,type ReferenceBay,type ReferenceBaySet} from './bay-authoring.ts';
import type {CanalhouseHoist} from '../../src/canalRecall/canalhouseHoist.ts';
import type {CanalhouseEntranceCheeks} from '../../src/canalRecall/canalhouseEntranceCheeks.ts';
import {pathToFileURL} from 'node:url';
import {assembleCompoundReference} from './compound-reference.ts';
import {selectFrame,expandContour,type FrameSelection,type FrameDefinition,type LinearContour,type PolylineContour} from './compact-authoring.ts';
import type {CanalhouseRoofMaterialPreset} from '../../src/canalRecall/canalhouseRoofMaterials.ts';
import {canalhouseSymmetricRoof,canalhouseRoofAssemblies,type SymmetricRoofSelection} from '../../src/canalRecall/canalhouseSymmetricRoof.ts';
import {canalhouseRoofJunctions,type RoofJunctionSelection} from '../../src/canalRecall/canalhouseRoofJunctions.ts';
import {surveyRecipe,type NativeRecipeSurvey} from './survey-recipe.ts';
import {canalhouseRoofVolume,type CanalhouseRoofVolume} from '../../src/canalRecall/canalhouseRoofVolume.ts';
import {mapStoepProfile,type StoepProfileInput} from './stoep-profile.ts';
import {canalhouseEntryOpenings,canalhouseOpeningBays,canalhouseOpeningGroup,canalhouseWindowGroup,type CanalhouseWindowGroup,type CanalhouseGrillePattern} from '../../src/canalRecall/canalhouseOpeningGroups.ts';
import {canalhouseOpeningTemplate,canalhouseOpeningTemplateDefinitions,type CanalhouseOpeningTemplateSelection} from '../../src/canalRecall/canalhouseOpeningTemplates.ts';
import {canalhouseFacadeGroup} from '../../src/canalRecall/canalhouseFacadeGroups.ts';
import {canalhouseCorniceLayers,type CanalhouseCorniceAssembly,type CanalhouseCorniceSelection} from '../../src/canalRecall/canalhouseCorniceAssembly.ts';
import {canalhouseGroundFront} from '../../src/canalRecall/canalhouseGroundFront.ts';
import {canalhouseAtticFront} from '../../src/canalRecall/canalhouseAtticFront.ts';
import {canalhouseOvalProfile,type CanalhouseOvalProfile} from '../../src/canalRecall/canalhouseOrnamentProfiles.ts';
import {unobservedHouse} from '../../src/canalRecall/facade/houseRecord.ts';
import type {CanalhouseGlazedBay} from '../../src/canalRecall/canalhouseGlazedBay';
import {measured,type Observation} from '../../src/canalRecall/facade/evidence.ts';
import {rdToLngLat,lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {compileCanalHouseRecipe,canalhouseCrownProfile,type CanalhouseBalcony,type CanalhouseCrownOptions,type CanalHouseRecipe,type CanalhouseOpening,type CanalhousePoint,type CanalhouseElevation} from '../../src/canalRecall/canalhouseRecipes.ts';
type FrameInput=FrameSelection;
const resolveFrame=(frame:FrameDefinition)=>'template' in frame?canalhouseOpeningTemplate(frame):structuredClone(frame);
interface FacadeGroupInput {id:string;columns:{id:string;left:number;width:number}[];rows:{id:string;bottom:number;height:number}[];depthM:number;surface:'stone'|'trim'|'wall'}
type ReferenceOpeningGroup={id:string;bays?:ReferenceBay[];baySet?:string;tiers:{id:string;bottom:number;height:number}[];frame:FrameInput;omit?:{bay:string;tier:string}[]};
export interface ReferenceInput {
 schemaVersion:1;admissionFile:string;surveyFile:string;id:string;
 lowerReferenceTier?:'full'|'ground';
 baySets?:Record<string,ReferenceBaySet>;
 hoists?:(Omit<CanalhouseHoist,'centerM'|'heightM'>&{center:number;height:number})[];
 /** Explicit source-reviewed drawing datum when survey envelope includes attic volumes. */
 bodyDatum?:{heightM:number;sourceReview:string};
 frameSets?:Record<string,FrameDefinition>;
 windowGroups:ReferenceOpeningGroup[];
 openingGroups?:(ReferenceOpeningGroup&{kind:'window'|'door';grille?:CanalhouseGrillePattern})[];
 openings:{id:string;kind:'window'|'door';left:number;bottom:number;width:number;height:number;frame:FrameInput;panels?:CanalhouseOpening['panels'];
  transom?:{id?:string;bottom:number;height:number;frame:FrameInput}}[];
 palette:CanalHouseRecipe['palette']['value'];
 frontagePlan?:{maxInsetM:number;maxOutsetM?:number};
 sourceBodyWallId?:string;
 roofAssembly?:SymmetricRoofSelection;
 /** Connected native main volume; profile remains an explicit reference choice. */
 roofVolume?:CanalhouseRoofVolume;
 roofAssemblies?:SymmetricRoofSelection[];
 /** Explicit inferred continuous parts; excluded genuine volume steps remain native. */
 roofJunctions?:RoofJunctionSelection;
 /** Source-selected common roof direction for multiple facades of one owner. */
 roofFrontageRD?:[CanalhousePoint,CanalhousePoint];
 roofMaterial?:{preset:CanalhouseRoofMaterialPreset};
 crown:{depthM:number;trimWidthM:number;surface?:'wall'|'trim'|'stone';wings?:{left:number;width:number;thicknessM:number;segments:number;gapM:number;bulgeM?:number;depthM:number;surface:'trim'|'stone'};capFacing?:{bottom:number;depthM:number;surface:'wall'|'trim'|'stone'};shape?:{
  family:'hals'|'klok'|'lijst';top:number;neckWidth:number;shoulder:number;steps?:number;
  crestWidth?:number;cap?:CanalhouseCrownOptions['cap'];capRise?:number;shoulderCurve?:number;
 }};
 dormers?:{wallSurface?:'wall'|'trim'|'stone';roofSurface?:'roof'|'trim'|'wall';hostAperture?:{depthM:number};setbackM?:number;id:string;left:number;width:number;bottom:number;height:number;depthM:number;roofRiseM:number;frontOverhangM?:number;trimWidthM?:number;verticalBars?:number[];horizontalBars?:number[]}[];
 dormerFront?:{profileNormalized:CanalhousePoint[];depthM:number;surface:'wall'|'roof';trimWidthM:number};
 ornaments:({id:string;depthM:number;fill?:'trim'|'wall';rimWidthM?:number}&({profile:CanalhousePoint[];shape?:never}|{shape:CanalhouseOvalProfile;profile?:never}))[];
 bands:{id:string;left:number;bottom:number;width:number;height:number;depthM:number;surface:'stone'|'trim'|'wall'}[];
 blocks?:ReferenceInput['bands'];
 groundFront?:{id:string;left:number;bottom:number;width:number;height:number;depthM:number;surface:'stone'|'trim'|'wall';openingIds:string[];header?:{bottom:number;height:number;depthM:number;surface?:'stone'|'trim'|'wall'}};
 atticFront?:{id:string;template:'arched-center-with-side-lights';bottom:number;sideTop:number;depthM:number;surface:'trim'|'stone'|'wall';
  center:{left:number;width:number;bottom:number;height:number;headRiseM:number;frame:FrameInput};
  sideLights:{bays:ReferenceBay[];bottom:number;height:number;frame:FrameInput}};
 detailGroups?:(FacadeGroupInput&{target:'bands'|'blocks'})[];
 cornice?:{bottom:number;height:number;depthM:number;brackets:number;assembly?:CanalhouseCorniceAssembly|CanalhouseCorniceSelection;
  spans?:{left:number;width:number}[];
  layers?:{bottom:number;height:number;depthM:number}[];
  accents?:{id:string;left:number;bottom:number;width:number;height:number;depthM:number;surface?:'stone'|'trim'|'wall';profile?:'console'|'triglyph'}[];
  accentGroups?:(Omit<FacadeGroupInput,'surface'>&{profile?:'console'|'triglyph'})[]};
 entrance?:{left:number;width:number;rise:number;runM:number;steps?:number;approximateRiserM?:number;attachToLanding?:boolean;surface?:'trim'|'stone';cheeks?:CanalhouseEntranceCheeks;rails?:{heightM:number;widthM:number;sides:('left'|'right')[]}};
 landing?:{left:number;width:number;top:number;depthM:number;thicknessM:number;supportToGround?:boolean};
 approaches?:{id:string;input:Omit<StoepProfileInput,'topProfile'>&{topProfile:StoepProfileInput['topProfile']|LinearContour|PolylineContour};railWidthM:number;postWidthM:number;occludedOpeningIds:string[]}[];
 balconies?:CanalhouseBalcony[];
 glazedBayGroups?:{id:string;left:number;width:number;frontWidth:number;tiers:{id:string;bottom:number;height:number}[];
  assembly:Omit<CanalhouseGlazedBay,'id'|'leftM'|'bottomM'|'widthM'|'heightM'|'frontWidthM'>}[];
 simplifications:string[];
}
const inputFilePath=(input:ReferenceInput)=>`docs/references/canalhouse-recipes/${input.id}-recipe-input.json`;
export async function assembleReference(input:ReferenceInput) {
 if(input.schemaVersion!==1)throw Error('Unsupported reference input');
 const baySets=expandBaySets(input.baySets??{});
 const admission=JSON.parse(await fs.readFile(input.admissionFile,'utf8'));
 const note=admission.houses.find((h:{id:string})=>h.id===input.id);
 if(!note||note.pandId!==admission.officialIdentity.pandId)throw Error('Source identity mismatch');
 if(note.observedAtticFronts){
  const observed=note.observedAtticFronts,ids=input.dormers?.map(d=>d.id)??[];
  if(!observed.sourceReview||!Array.isArray(observed.ids)||!observed.ids.length||new Set(observed.ids).size!==observed.ids.length)throw Error('Invalid observed attic-front evidence');
  if(ids.length!==observed.ids.length||observed.ids.some((id:string)=>!ids.includes(id)))throw Error('Recipe contradicts observed attic fronts');
 }
 const seenObservedGroups=new Set<string>();
 for(const observation of note.observedWindowGroups??[]){
  if(seenObservedGroups.has(observation.groupId))throw Error('Duplicate observed window group');
  seenObservedGroups.add(observation.groupId);
  if(!observation.sourceReview||![observation.axes,observation.tiers,observation.openings].every((n:number)=>Number.isInteger(n)&&n>0))throw Error('Invalid observed window group evidence');
  const groups=input.windowGroups.filter(g=>g.id===observation.groupId);
  if(groups.length!==1)throw Error('Missing or ambiguous observed window group '+observation.groupId);
  const group=groups[0],bays=canalhouseOpeningBays(group,baySets);
  const openings=canalhouseWindowGroup({id:group.id,bays:bays.map(b=>({id:b.id,leftM:b.left,widthM:b.width})),tiers:group.tiers.map(t=>({id:t.id,bottomM:t.bottom,heightM:t.height})),frame:resolveFrame(selectFrame(group.frame,input.frameSets??{})),omit:group.omit});
  if(bays.length!==observation.axes||group.tiers.length!==observation.tiers||openings.length!==observation.openings)throw Error('Recipe contradicts observed window group '+observation.groupId);
 }
 const survey:NativeRecipeSurvey&{bagId:string;attributes:Record<string,number>}=JSON.parse(await fs.readFile(input.surveyFile,'utf8'));
 if(survey.bagId!==note.pandId)throw Error('Foreign survey');
 const native=surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,admission.principalFront.orientedLeftToRightAsSeenFromCanal);
 if([input.roofAssembly,input.roofAssemblies,input.roofJunctions].filter(x=>x!==undefined).length>1)throw Error('Choose one roof assembly selection or native junction treatment');
 if(input.roofFrontageRD&&!input.roofAssembly&&!input.roofAssemblies)throw Error('Roof frontage requires a selected roof assembly');
 if(input.roofFrontageRD&&(!Array.isArray(input.roofFrontageRD)||input.roofFrontageRD.length!==2||input.roofFrontageRD.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))))throw Error('Roof frontage requires two finite source endpoints');
 const roofFront=input.roofFrontageRD?surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,input.roofFrontageRD).front:native.front;
 if(input.roofVolume&&(!input.roofAssembly||input.roofAssemblies||input.roofJunctions))throw Error('Roof volume requires one explicit roof assembly');
 const roofVolume=input.roofVolume?canalhouseRoofVolume(native.roof,native.roofOwners,roofFront,input.roofVolume):null;
 const selectedRoof=input.roofAssembly?{...input.roofAssembly,...(roofVolume?{surfaceIds:roofVolume.surfaceIds}:{})}:undefined;
 if(input.bodyDatum&&(!Number.isFinite(input.bodyDatum.heightM)||input.bodyDatum.heightM<=0||typeof input.bodyDatum.sourceReview!=='string'||!input.bodyDatum.sourceReview.trim()))throw Error('Explicit body datum requires positive height and source review');
 const width=native.front.widthM,body=input.bodyDatum?.heightM??admission.heights.bodyEavesNominalM;
 const frameFor=(selection:FrameInput)=>resolveFrame(selectFrame(selection,input.frameSets??{}));
 const expandFacadeGroup=(g:FacadeGroupInput)=>canalhouseFacadeGroup({id:g.id,columns:g.columns.map(c=>({id:c.id,leftM:c.left*width,widthM:c.width*width})),rows:g.rows.map(r=>({id:r.id,bottomM:r.bottom*body,heightM:r.height*body})),depthM:g.depthM,surface:g.surface});
 const groupedDetails=(target:'bands'|'blocks')=>(input.detailGroups??[]).flatMap(g=>{
  if(g.target!=='bands'&&g.target!=='blocks')throw Error('Unsupported facade group target');
  return g.target===target?expandFacadeGroup(g):[];
 });
 const registry:Observation={id:input.id+'-bag',pandId:note.pandId,kind:'registry-record',elevation:'front',capturedAt:admission.observedOn,sourceUrl:admission.officialIdentity.vboSource.url,license:'CC0-1.0'};
 const photo:Observation={id:input.id+'-photo',pandId:note.pandId,kind:'human-review',elevation:'front',capturedAt:note.sources.captureDate.slice(0,10),sourceUrl:note.sources.projection.camera._links.equirectangular_medium.href,license:'CC BY 4.0'};
 const lower:Observation={...photo,id:input.id+'-lower',capturedAt:note.sources.nearCaptureDate.slice(0,10),sourceUrl:note.sources.nearCamera._links.equirectangular_medium.href};
 const surveyObservation:Observation={id:input.id+'-survey',pandId:note.pandId,kind:'oblique-aerial',elevation:'roof',capturedAt:`${survey.attributes.b3_pw_datum}-01-01`,sourceUrl:admission.sourceProvenance.raw3DBag.url,license:'CC BY 4.0'};
 const face=<V>(value:V)=>measured(value,'reviewed',.55,photo),roof=<V>(value:V)=>measured(value,'3dbag',.85,surveyObservation);
 const house=unobservedHouse(note.pandId);house.plotWidthM=measured(width,'bag',.95,registry);house.eavesHeightM=face(body);house.gable=face(note.crown.label);
 const openings:CanalhouseOpening[]=input.windowGroups.flatMap(g=>canalhouseWindowGroup({id:g.id,bays:canalhouseOpeningBays(g,baySets).map(b=>({id:b.id,leftM:b.left*width,widthM:b.width*width})),tiers:g.tiers.map(t=>({id:t.id,bottomM:t.bottom*body,heightM:t.height*body})),frame:frameFor(g.frame),omit:g.omit}));
 openings.push(...(input.openingGroups??[]).flatMap(g=>canalhouseOpeningGroup({id:g.id,kind:g.kind,bays:canalhouseOpeningBays(g,baySets).map(b=>({id:b.id,leftM:b.left*width,widthM:b.width*width})),tiers:g.tiers.map(t=>({id:t.id,bottomM:t.bottom*body,heightM:t.height*body})),frame:frameFor(g.frame),grille:g.grille,omit:g.omit})));
 openings.push(...input.openings.flatMap(o=>{
  const opening:CanalhouseOpening={...frameFor(o.frame),id:o.id,kind:o.kind,leftM:o.left*width,bottomM:o.bottom*body,widthM:o.width*width,heightM:o.height*body,...(o.panels?{panels:o.panels}:{})};
  return o.transom?canalhouseEntryOpenings(opening,{...(o.transom.id?{id:o.transom.id}:{}),bottomM:o.transom.bottom*body,heightM:o.transom.height*body,frame:frameFor(o.transom.frame)}):[opening];
 }));
 for(const observed of note.observedOpeningSides??[]){
  if(!observed.sourceReview||!['left','right'].includes(observed.side)||!Array.isArray(observed.ids)||!observed.ids.length)throw Error('Invalid observed opening-side evidence');
  for(const id of observed.ids){
   const matches=openings.filter(o=>o.id===id);
   if(matches.length!==1)throw Error('Missing or ambiguous source-sided opening '+id);
   const center=(matches[0].leftM+matches[0].widthM/2)/width;
   if(observed.side==='left'?center>=.5:center<=.5)throw Error('Recipe contradicts observed opening side '+id);
  }
 }
 if(input.approaches?.length&&!input.landing)throw Error('Observed approaches require their source-selected landing');
 const entrance=input.entrance?{leftM:input.entrance.left*width,widthM:input.entrance.width*width,riseM:input.entrance.rise*body,runM:input.entrance.runM,steps:input.entrance.steps,approximateRiserM:input.entrance.approximateRiserM,attachToLanding:input.entrance.attachToLanding,surface:input.entrance.surface,...(input.entrance.cheeks?{cheeks:structuredClone(input.entrance.cheeks)}:{}),rails:input.entrance.rails}:null;
 const landing=input.landing?{leftM:input.landing.left*width,widthM:input.landing.width*width,topM:input.landing.top*body,depthM:input.landing.depthM,thicknessM:input.landing.thicknessM,...(input.landing.supportToGround?{supportToGround:true}:{})}:null;
 const approaches=(input.approaches??[]).map(a=>{
  const s=mapStoepProfile({...a.input,topProfile:expandContour(a.input.topProfile)},{frontageWidthM:width,thresholdM:landing!.topM,riseM:landing!.topM});
  return{id:a.id,assembly:measured({topProfile:s.topProfile,groundM:s.groundM,backM:s.depth.backM,depthM:s.depth.frontM-s.depth.backM,railProfile:s.railProfile,posts:s.posts,railWidthM:a.railWidthM,postWidthM:a.postWidthM,occludedOpeningIds:a.occludedOpeningIds},'reviewed',.4,lower)};
 });
 const attic=input.atticFront?canalhouseAtticFront({id:input.atticFront.id,template:input.atticFront.template,widthM:width,bottomM:input.atticFront.bottom*body,sideTopM:input.atticFront.sideTop*body,depthM:input.atticFront.depthM,surface:input.atticFront.surface,
  center:{leftM:input.atticFront.center.left*width,widthM:input.atticFront.center.width*width,bottomM:input.atticFront.center.bottom*body,heightM:input.atticFront.center.height*body,headRiseM:input.atticFront.center.headRiseM,frame:frameFor(input.atticFront.center.frame)},
  sideLights:{bays:input.atticFront.sideLights.bays.map(b=>({id:b.id,leftM:b.left*width,widthM:b.width*width})),bottomM:input.atticFront.sideLights.bottom*body,heightM:input.atticFront.sideLights.height*body,frame:frameFor(input.atticFront.sideLights.frame)}}):null;
 if(attic)openings.push(...attic.openings);
 const {shape:crownShape,capFacing,wings,...crownAssembly}=input.crown;
 if(crownShape&&crownShape.family!==note.crown.label)throw Error('Crown selection contradicts observed family');
 const crownProfile=crownShape?canalhouseCrownProfile(crownShape.family,width,body,crownShape.top*body,crownShape.neckWidth*width,crownShape.shoulder*body,crownShape.steps??1,{
  ...(crownShape.crestWidth!==undefined?{crestWidthM:crownShape.crestWidth*width}:{}),
  ...(crownShape.cap!==undefined?{cap:crownShape.cap}:{}),
  ...(crownShape.capRise!==undefined?{capRiseM:crownShape.capRise*body}:{}),
  ...(crownShape.shoulderCurve!==undefined?{shoulderCurve:crownShape.shoulderCurve}:{}),
 }):note.crown.profileNormalized.map(([x,y]:number[])=>[x*width,y*body] as CanalhousePoint);
 const elevation:CanalhouseElevation={id:'principal',polygonIndex:native.front.polygonIndex,edgeIndex:native.front.edgeIndex,endEdgeIndex:native.front.endEdgeIndex,frontageToleranceM:face(admission.principalFront.facadePlaneToleranceM),...(input.frontagePlan?{frontagePlan:face(input.frontagePlan)}:{}),openings:face(openings),crown:face({...crownAssembly,profile:crownProfile,...(capFacing?{capFacing:{bottomM:capFacing.bottom*body,depthM:capFacing.depthM,surface:capFacing.surface}}:{}),...(wings?{wings:{leftM:wings.left*width,widthM:wings.width*width,thicknessM:wings.thicknessM,segments:wings.segments,gapM:wings.gapM,bulgeM:wings.bulgeM,depthM:wings.depthM,surface:wings.surface}}:{})}),
  ...(input.glazedBayGroups?{glazedBays:face(input.glazedBayGroups.flatMap(b=>b.tiers.map(t=>({...b.assembly,id:`glazedBay/${b.id}/${t.id}`,leftM:b.left*width,widthM:b.width*width,frontWidthM:b.frontWidth*width,bottomM:t.bottom*body,heightM:t.height*body}))))}:{}),
  blocks:face([...(body>native.shellTopM?[{id:'observed-front-body',leftM:0,bottomM:Math.max(0,native.shellTopM),widthM:width,heightM:body-Math.max(0,native.shellTopM),depthM:.025,surface:'wall' as const}]:[]),...(input.blocks??[]).map(b=>({id:b.id,leftM:b.left*width,bottomM:b.bottom*body,widthM:b.width*width,heightM:b.height*body,depthM:b.depthM,surface:b.surface})),...groupedDetails('blocks'),...(attic?.blocks??[])]),
  bands:face([...input.bands.map(b=>({id:b.id,leftM:b.left*width,bottomM:b.bottom*body,widthM:b.width*width,heightM:b.height*body,depthM:b.depthM,surface:b.surface})),...groupedDetails('bands')]),
  ...(input.cornice?{cornice:face({bottomM:input.cornice.bottom*body,heightM:input.cornice.height*body,depthM:input.cornice.depthM,brackets:input.cornice.brackets,
   ...(input.cornice.spans?{spans:input.cornice.spans.map(s=>({leftM:s.left*width,widthM:s.width*width}))}:{}),
   ...(input.cornice.assembly?{layers:canalhouseCorniceLayers(input.cornice.bottom*body,input.cornice.height*body,input.cornice.assembly)}:input.cornice.layers?{layers:input.cornice.layers.map(l=>({bottomM:l.bottom*body,heightM:l.height*body,depthM:l.depthM}))}:{}),
   ...(input.cornice.accents||input.cornice.accentGroups?{accents:[...(input.cornice.accents??[]).map(a=>({id:a.id,leftM:a.left*width,bottomM:a.bottom*body,widthM:a.width*width,heightM:a.height*body,depthM:a.depthM,...(a.surface?{surface:a.surface}:{}),...(a.profile?{profile:a.profile}:{})})),...(input.cornice.accentGroups??[]).flatMap(g=>expandFacadeGroup({...g,surface:'trim'}).map(a=>({...a,...(g.profile?{profile:g.profile}:{})})))]}:{})})}:{}),
  ornaments:face(input.ornaments.map(o=>{
   if((o.profile!==undefined)===(o.shape!==undefined))throw Error('Select exactly one explicit ornament profile or reusable shape');
   const {shape,profile,...section}=o;
   const points=shape?canalhouseOvalProfile(shape):profile!;
   return{...(shape?section:o),profile:points.map(([x,y])=>[x*width,y*body] as CanalhousePoint)};
  })),...(entrance?{entrance:measured(entrance,'reviewed',.4,lower)}:{}),...(landing?{landing:measured(landing,'reviewed',.4,lower)}:{}),approaches};
 const recipe:CanalHouseRecipe={schemaVersion:1,id:input.id,house,observations:[registry,photo,lower,surveyObservation],shellTopM:roof(native.shellTopM),footprint:roof(native.polygons),roof:input.roofAssemblies?face(canalhouseRoofAssemblies(native.roof,native.roofOwners,roofFront,input.roofAssemblies)):selectedRoof?face(canalhouseSymmetricRoof(native.roof,native.roofOwners,roofFront,selectedRoof)):input.roofJunctions?measured(canalhouseRoofJunctions(native.roof,native.roofOwners,input.roofJunctions),'reviewed',.4,surveyObservation):roof(native.roof),palette:face(input.palette),elevations:[elevation],simplifications:[...input.simplifications,...(native.roofBoundarySnaps.length?[`${native.roofBoundarySnaps.length} roof boundary points aligned to the exact ground footprint within 0.5mm source rounding; source heights and raw roof rings retained.`]:[]),...(native.omittedRoofFragments.length?[`${native.omittedRoofFragments.length} rounded roof fragments below the compiler area threshold omitted (${native.omittedRoofAreaM2} square metres); exact native ground footprint and raw roof rings retained.`]:[])]};
 // Compile before writing: evidence, apertures, native roof ownership and
 // approach occlusions remain enforced by the shared assembly compiler.
 if(input.groundFront){
  const g=input.groundFront;
  const blocks=canalhouseGroundFront({id:g.id,leftM:g.left*width,bottomM:g.bottom*body,widthM:g.width*width,heightM:g.height*body,depthM:g.depthM,surface:g.surface,openingIds:g.openingIds,...(g.header?{header:{bottomM:g.header.bottom*body,heightM:g.header.height*body,depthM:g.header.depthM,surface:g.header.surface}}:{})},openings);
  elevation.blocks=face([...(elevation.blocks?.value??[]),...blocks]);
 }
 if(input.dormers)elevation.dormers=face(input.dormers.map(({left,width:openingWidth,bottom,height,...d})=>({...d,leftM:left*width,widthM:openingWidth*width,bottomM:bottom*body,heightM:height*body})));
 if(input.hoists)elevation.hoists=face(input.hoists.map(({center,height,...beam})=>({...beam,centerM:center*width,heightM:height*body})));
 if(input.dormerFront)elevation.dormerFront=face({profile:input.dormerFront.profileNormalized.map(([x,y])=>[x*width,y*body]),depthM:input.dormerFront.depthM,surface:input.dormerFront.surface,trimWidthM:input.dormerFront.trimWidthM});
 if(input.balconies)elevation.balconies=face(structuredClone(input.balconies));
 const compiled=compileCanalHouseRecipe(recipe);
 const checkedCameraCoordinates=(camera:any,label:string):[number,number]=>{
  const coordinates=camera?.geometry?.coordinates;
  if(!Array.isArray(coordinates)||coordinates.length<2||!coordinates.slice(0,2).every((v:unknown)=>typeof v==='number'&&Number.isFinite(v))||Math.abs(coordinates[0])>180||Math.abs(coordinates[1])>90)throw Error(label+' requires finite WGS84 camera coordinates; finalize source camera metadata before assembly');
  return [coordinates[0],coordinates[1]];
 };
 const nearCameraRD=lngLatToRd(checkedCameraCoordinates(note.sources.nearCamera,'Lower source'));
 const principalCameraRD=lngLatToRd(checkedCameraCoordinates(note.sources.projection.camera,'Principal source'));
 const targetRD={x:native.anchorRD[0]+(native.front.a[0]+native.front.b[0])/2,y:native.anchorRD[1]-(native.front.a[1]+native.front.b[1])/2};
 const nearHeadingDeg=(Math.atan2(targetRD.x-nearCameraRD.x,targetRD.y-nearCameraRD.y)*180/Math.PI+360)%360;
 const {admissionFile:privateAdmission,surveyFile:privateSurvey,...assemblyInput}=input;
 void privateAdmission;void privateSurvey;
 const frameSelections=[...input.windowGroups,...(input.openingGroups??[])].map(g=>g.frame).concat(input.openings.flatMap(o=>[o.frame,...(o.transom?[o.transom.frame]:[])]));
  const entry={...(input.roofMaterial?{roofMaterial:input.roofMaterial}:{}),name:admission.officialIdentity.address,sample:note.sampleRole,anchorRD:native.anchorRD,anchor:rdToLngLat({x:native.anchorRD[0],y:native.anchorRD[1]}),frontNormal:native.front.normal,frontTarget:[(native.front.a[0]+native.front.b[0])/2,body*.52,(native.front.a[1]+native.front.b[1])/2],frontWidthM:width,suppressOsmIds:[`NL.IMBAG.Pand.${note.pandId}`],sourceUrl:note.sources.registerUrl,sourceArchive:{path:admission.sourceProvenance.archiveModelManifestPath??`models/${input.id}/source-pack-index.json`,commit:admission.sourceProvenance.sourceCommit,...(admission.sourceProvenance.localArchiveCommit?{localCommit:admission.sourceProvenance.localArchiveCommit,syncStatus:admission.sourceProvenance.archiveSync}: {})},
  assemblyInput:{...assemblyInput,openingTemplateDefinitions:canalhouseOpeningTemplateDefinitions(frameSelections.flatMap(selection=>{const frame=selectFrame(selection,input.frameSets??{});return 'template' in frame?[frame.template]:[]})),sourceIdentity:{pandId:note.pandId,sourceAdmission:input.admissionFile,registryUrl:note.sources.registerUrl,surveyUrl:admission.sourceProvenance.raw3DBag.url},normalization:{x:'fraction of principal frontage width',y:'fraction of body/eaves height',frontWidthM:width,bodyEavesM:body}},
  panorama:{cameraRD:[principalCameraRD.x,principalCameraRD.y],cameraHeightM:2.5,cameraHeightNote:'Drawing approximation; recorded GPS altitude is not a pavement eye height',url:photo.sourceUrl,headingDeg:note.sources.projection.headingDeg,pitchDeg:note.sources.projection.pitchDeg,fovDeg:note.sources.projection.fovDeg,capturedAt:note.sources.captureDate,rights:note.sources.rights},
  basementPanorama:{url:lower.sourceUrl,headingDeg:nearHeadingDeg,pitchDeg:-10,fovDeg:95,capturedAt:note.sources.nearCaptureDate,rights:note.sources.rights},references:[{label:'Current full facade',url:photo.sourceUrl},{label:'Current near lower facade',url:lower.sourceUrl}],
  nativeConversion:{...(roofVolume?{roofVolume}:{}),...(native.roofBoundarySnaps.length?{roofBoundarySnaps:native.roofBoundarySnaps}:{}),omittedRoofFragments:native.omittedRoofFragments,omittedRoofAreaM2:native.omittedRoofAreaM2},
  lowerFacadeObservation:{source:input.admissionFile,recipeInputPath:inputFilePath(input),uncertainties:input.simplifications,exactCurrentTreadCount:null,drawingApproximation:true},recipe};
 return {entry,stats:compiled.stats};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const option=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
 const inputFiles=option('inputs',option('input','docs/references/canalhouse-recipes/herengracht-429-recipe-input.json')).split(',');
 const output=option('output','docs/references/canalhouse-recipes/next-chunk-recipes.json');
 const reviewRowsFile=option('review-rows','');
 const results:(Awaited<ReturnType<typeof assembleReference>>|Awaited<ReturnType<typeof assembleCompoundReference>>)[]=[];
 for(const inputFile of inputFiles){
  const input=JSON.parse(await fs.readFile(inputFile,'utf8'));
  if(results.some(r=>r.entry.recipe.id===input.id))throw Error('Duplicate reference candidate');
  results.push(await (input.facades?assembleCompoundReference(input,assembleReference):assembleReference(input)));
 }
 const reviewRows=reviewRowsFile?JSON.parse(await fs.readFile(reviewRowsFile,'utf8')):undefined;
 if(reviewRows&&(!Array.isArray(reviewRows)||reviewRows.some(row=>!row.houseIds?.length||!row.houseIds.includes(row.referenceHouseId)||row.houseIds.some((id:string)=>!results.some(r=>r.entry.recipe.id===id)))))throw Error('Invalid review row membership');
 await fs.writeFile(output,JSON.stringify({schemaVersion:1,id:'canalhouse-reference-candidates',title:'Source-authored reusable canalhouse candidates',sourceArchive:results[0].entry.sourceArchive,sourceArchives:results.map(r=>r.entry.sourceArchive),...(reviewRows?{reviewRows}:{}),acceptance:{individual:false,row:false,heldouts:false,independent:false,game:false,performance:false},entries:results.map(r=>r.entry)},null,2)+'\n');
 console.log(JSON.stringify({output,entries:results.map(r=>({id:r.entry.recipe.id,...r.stats})),acceptance:'pending-visual-review'}));
}
