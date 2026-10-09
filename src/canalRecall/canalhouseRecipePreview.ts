import {applyCanalhouseRoofMaterial} from './canalhouseRoofMaterials';
import {canalhousePreviewRowForMembers} from './landmarks/canalhousePreviewSelection';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {CanalhousePanorama} from './canalhousePanorama';
import {canalhouseReferenceCamera} from './canalhouseReferenceCamera';
import {frameCanalhouseRowFromStreet} from './canalhousePreviewFraming';
import {CanalhousePreviewModelCache} from './canalhousePreviewModelCache';

const root=document.getElementById('stage')!,status=document.getElementById('status')!,selector=document.getElementById('house') as HTMLSelectElement;
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));root.append(renderer.domElement);
renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#cadce2');
const camera=new T.PerspectiveCamera(45,1,.1,2000),controls=new OrbitControls(camera,renderer.domElement);
// Match the actual signature-landmarks game layer's daylight and fill.
scene.add(new T.HemisphereLight(0xdfeaf2,0x6b7480,1.15));const sun=new T.DirectionalLight(0xfff6e8,2.2);sun.position.set(-.5,1.6,.9);scene.add(sun);
const fill=new T.DirectionalLight(0xc9dcea,.55);fill.position.set(.8,.4,-1.1);scene.add(fill);
const panorama=new CanalhousePanorama(document.getElementById('panorama')!,document.getElementById('panorama-caption')!);
const group=new T.Group();scene.add(group);
const libraryMode=new URLSearchParams(location.search).get('library')==='components';
const chunk=new URLSearchParams(location.search).get('chunk')??'';
const previewPacks:Record<string,string>={
 'bloemgracht-94-trial':'canalhouse-bloemgracht-94-trial',
 'bloemgracht-78-90':'canalhouse-bloemgracht-78-90',
 'bloemgracht-78':'canalhouse-bloemgracht-78-repaired',
 'bloemgracht-80-90':'canalhouse-bloemgracht-80-90',
 'bloemgracht-84-90':'canalhouse-bloemgracht-84-90',
 'bloemgracht-86-90':'canalhouse-bloemgracht-86-90',
 'bloemgracht-102-116':'canalhouse-bloemgracht-102-116',
 'hoist-transfer':'canalhouse-hoist-trial',
 'bloemgracht-102':'canalhouse-bloemgracht-102',
 'bloemgracht-odd':'canalhouse-bloemgracht-odd',
 'bloemgracht-next':'canalhouse-bloemgracht-next',
 'bloemgracht':'canalhouse-bloemgracht-trial',
 'bloemgracht-132':'canalhouse-bloemgracht-132',
 'bloemgracht-140':'canalhouse-bloemgracht-140',
 'bloemgracht-row-next':'canalhouse-bloemgracht-row-next',
 'bloemgracht-row-four':'canalhouse-bloemgracht-row-four',
 'bloemgracht-row-five':'canalhouse-bloemgracht-row-five',
 'bloemgracht-row-six':'canalhouse-bloemgracht-row-six',
 'bloemgracht-row-seven':'canalhouse-bloemgracht-row-seven',
 'bloemgracht-row-eight':'canalhouse-bloemgracht-row-eight',
 'bloemgracht-row-nine':'canalhouse-bloemgracht-row-nine',
 'bloemgracht-row-ten':'canalhouse-bloemgracht-row-ten',
 'bloemgracht-row-eleven':'canalhouse-bloemgracht-row-eleven',
 'bloemgracht-row-twelve':'canalhouse-bloemgracht-row-twelve',
 'bloemgracht-row-thirteen':'canalhouse-bloemgracht-row-thirteen',
 'bloemgracht-row-fourteen':'canalhouse-bloemgracht-row-fourteen',
 'bloemgracht-row-fifteen':'canalhouse-bloemgracht-row-fifteen',
 'bloemgracht-row-sixteen':'canalhouse-bloemgracht-row-sixteen',
 'bloemgracht-row-seventeen':'canalhouse-bloemgracht-row-seventeen',
 'bloemgracht-row-nineteen':'canalhouse-bloemgracht-row-nineteen',
};
const galleryOnlyPacks=new Set(['bloemgracht-94-trial','bloemgracht-78','bloemgracht-odd','bloemgracht-132','bloemgracht-140','bloemgracht-row-four','bloemgracht-row-five','bloemgracht-row-six','bloemgracht-row-seven','bloemgracht-row-eight','bloemgracht-row-nine','bloemgracht-row-eleven']);
const gameReviewRowByPack:Record<string,string>={'bloemgracht-78-90':'row-bloemgracht-78-90','bloemgracht-80-90':'row-bloemgracht-80-90','bloemgracht-84-90':'row-bloemgracht-84-90','bloemgracht-86-90':'row-bloemgracht-86-90','bloemgracht-102-116':'row-bloemgracht-102-116','bloemgracht-row-ten':'row-bloemgracht-138-162','bloemgracht-row-twelve':'row-bloemgracht-138-166','bloemgracht-row-thirteen':'row-bloemgracht-138-168','bloemgracht-row-fourteen':'row-bloemgracht-138-170','bloemgracht-row-fifteen':'row-bloemgracht-138-172','bloemgracht-row-sixteen':'row-bloemgracht-138-174','bloemgracht-row-seventeen':'row-bloemgracht-138-176','bloemgracht-row-nineteen':'row-bloemgracht-130-176'};
const loader=new GLTFLoader(),manifestUrl=libraryMode?'./models/canalhouse-components/pilot.json':previewPacks[chunk]?`./models/${previewPacks[chunk]}/pilot.json`:chunk==='next'?'./models/canalhouse-recipes/with-next.json':'./models/canalhouse-recipes/pilot.json';
function resize(){renderer.setSize(root.clientWidth,root.clientHeight);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',()=>{resize();if(manifest&&(selector.value.startsWith('row')||currentView==='reference'))frame(selector.value);});resize();
let manifest:any,referenceIndex=0,panoramaSelection='',currentView='front';
const candidateStatus=()=>manifest?.reviewFailure?`Failed source review — ${manifest.reviewFailure}`:'Candidate review — visual and game acceptance required';
const models=new Map<string,T.Object3D>();
const modelCache=new CanalhousePreviewModelCache(async(id:string)=>{
 const entry=manifest.entries.find((e:any)=>e.id===id),origin=manifest.entries[0].anchorRD;
 const model=(await loader.loadAsync(entry.modelUrl)).scene;
 if(entry.roofMaterial)try{await applyCanalhouseRoofMaterial(model,entry.roofMaterial.preset);}catch(error){console.warn('Roof material unavailable; using flat fallback',error);}
 model.position.set(entry.anchorRD[0]-origin[0],0,origin[1]-entry.anchorRD[1]);
 model.visible=false;models.set(id,model);group.add(model);return model;
});
const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:'#b1b0a0'}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
let frameRevision=0;
let assemblyRevision=0;
const assemblyInputs=new Map<string,Promise<any>>();
async function showAssembly(entry:any,id:string){
 const revision=++assemblyRevision,host=document.getElementById('assembly-summary')!;
 host.replaceChildren();host.hidden=id.startsWith('row')||!entry.assemblyUrl&&!entry.openingTemplateChoices?.length&&!entry.groundFrontChoice&&!entry.corniceAssemblyChoice;if(host.hidden)return;
 if(!entry.assemblyUrl){
  const title=document.createElement('h3');title.textContent='Recipe components';host.append(title);
  const list=document.createElement('ul');
  for(const choice of entry.openingTemplateChoices??[]){
   const item=document.createElement('li');item.textContent=`${choice.openingIds.length} windows · ${choice.selection.template}${choice.selection.overrides?' with observed exceptions':''}`;list.append(item);
  }
  if(entry.groundFrontChoice){const g=entry.groundFrontChoice,item=document.createElement('li');item.textContent=`${g.id}: ${g.openingIds.length} connected openings · ${g.surface} ground front${g.header?' + header':''}`;list.append(item);}
  if(entry.corniceAssemblyChoice){const item=document.createElement('li');item.textContent=`Cornice: ${entry.corniceAssemblyChoice.template??'explicit layered section'}`;list.append(item);}
  host.append(list);return;
 }
 try{
  let input=assemblyInputs.get(entry.assemblyUrl);
  if(!input){input=fetch(entry.assemblyUrl).then(response=>{if(!response.ok)throw Error(`Assembly HTTP ${response.status}`);return response.json();});assemblyInputs.set(entry.assemblyUrl,input);}
  const assembly=await input;if(revision!==assemblyRevision)return;
  const title=document.createElement('h3');title.textContent='Recipe components';host.append(title);
  if(assembly.facades){const note=document.createElement('p');note.textContent=`One building · ${assembly.facades.length} facade recipes`;host.append(note);}
  for(const facade of assembly.facades??[assembly]){
  const assembly=facade;
  if(facade.id&&facade.id!==entry.id){const label=document.createElement('h4');label.textContent=facade.id;host.append(label);}
  const list=document.createElement('ul');
  for(const opening of [...(assembly.windowGroups??[]),...(assembly.openingGroups??[]),...(assembly.openings??[])]){
   const bays=opening.bays??(opening.baySet?assembly.baySets?.[opening.baySet]:undefined);
   const item=document.createElement('li'),count=bays&&opening.tiers?bays.length*opening.tiers.length-(opening.omit?.length??0):1;
   const selected=opening.frame.use?assembly.frameSets?.[opening.frame.use]:opening.frame;
   item.textContent=`${opening.id}: ${count} ${opening.kind==='door'?'door':'window'}${count===1?'':'s'} · ${selected?.template??'explicit joinery'}${selected?.overrides?' with observed exceptions':''}${opening.frame.use?` · shared frame: ${opening.frame.use}`:''}${opening.baySet?` · shared axes: ${opening.baySet}`:''}`;list.append(item);
   if(opening.transom){
    const transom=document.createElement('li');
    const frame=opening.transom.frame.use?assembly.frameSets?.[opening.transom.frame.use]:opening.transom.frame;
    transom.textContent=`${opening.transom.id??`${opening.id}-transom`}: aligned entrance transom · ${frame?.template??'explicit joinery'}`;list.append(transom);
   }
  }
  for(const detail of assembly.detailGroups??[]){const item=document.createElement('li');item.textContent=`${detail.id}: ${detail.columns.length} columns × ${detail.rows.length} courses`;list.append(item);}
  for(const detail of assembly.cornice?.accentGroups??[]){const item=document.createElement('li');item.textContent=`${detail.id}: ${detail.columns.length*detail.rows.length} ${detail.profile??'pendant'} components`;list.append(item);}
  for(const [key,label]of [['landing','Landing'],['approaches','Flight / rail assemblies'],['balconies','Window-sill balcony rails'],['cornice','Cornice'],['crown','Gable'],['groundFront','Ground-front assembly'],['dormers','Attic windows'],['dormerFront','Connected attic front'],['bands','Facade bands'],['blocks','Masonry blocks'],['ornaments','Ornaments']]){
   const value=assembly[key];if(!value||Array.isArray(value)&&!value.length)continue;
   const item=document.createElement('li');item.textContent=Array.isArray(value)?`${label}: ${value.length}`:label;list.append(item);
  }
  host.append(list);
  }
 }catch(error){if(revision===assemblyRevision){host.textContent=`Could not load recipe components: ${String(error)}`;assemblyInputs.delete(entry.assemblyUrl);}}
}
async function frame(id:string,view=currentView):Promise<void>{
 const revision=++frameRevision;currentView=view;
 const row=manifest.reviewRows?.find((r:any)=>r.id===id);
 const ids=id==='row'?manifest.entries.map((e:any)=>e.id):row?.houseIds??[id];
 status.textContent=`Loading ${ids.length} selected ${ids.length===1?'building':'buildings'}…`;
 try{
  await Promise.all(ids.map((key:string)=>modelCache.get(key)));
  if(revision!==frameRevision)return;
  frameLoaded(id,view);
  if(revision===frameRevision)status.textContent=libraryMode?'Reusable component examples · synthetic dimensions':candidateStatus();
 }catch(error){if(revision===frameRevision){status.textContent=`Could not load selection: ${String(error)}`;console.error(error);}}
}
function frameLoaded(id:string,view=currentView):void{
 currentView=view;camera.fov=45;camera.updateProjectionMatrix();
 const reviewRow=manifest.reviewRows?.find((r:any)=>r.id===id),isRow=id==='row'||!!reviewRow;
 const rowEntries=reviewRow?reviewRow.houseIds.map((key:string)=>manifest.entries.find((e:any)=>e.id===key)):manifest.entries;
 if(!libraryMode)for(const [key,model]of models)model.visible=isRow?(!reviewRow||reviewRow.houseIds.includes(key)):key===id;
 if(libraryMode){if(isRow)id=manifest.entries[0].id;selector.value=id;for(const [key,model]of models)model.visible=key===id;}
 if(isRow&&view==='basement'){selector.value=reviewRow?.referenceHouseId??'herengracht-417';void frame(selector.value,view);return;}
 if(isRow&&view==='cornice'){const candidate=rowEntries.find((e:any)=>e.corniceTarget);if(candidate){selector.value=candidate.id;void frame(candidate.id,view);return;}view='front';currentView=view;}
 const object=isRow?group:models.get(id);if(!object)return;
 const bounds=isRow?rowEntries.reduce((box:T.Box3,e:any)=>box.expandByObject(models.get(e.id)!),new T.Box3()):new T.Box3().setFromObject(object),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 ground.scale.set(size.x+120,size.z+120,1);ground.position.set(center.x,-.05,center.z);
 // Camera uses the selected building's researched outward wall normal, if provided.
 const entry=manifest.entries.find((e:any)=>e.id===(reviewRow?.referenceHouseId??id))??manifest.entries[0],normal=entry.frontNormal??[0,1];
 const corniceButton=document.querySelector<HTMLButtonElement>('[data-view="cornice"]');if(corniceButton)corniceButton.disabled=!isRow&&!entry.corniceTarget;
 if(view==='cornice'&&!entry.corniceTarget){view='front';currentView=view;}
 if(entry.frontTarget){const origin=manifest.entries[0].anchorRD;center.set(entry.frontTarget[0]+entry.anchorRD[0]-origin[0],entry.frontTarget[1],entry.frontTarget[2]+origin[1]-entry.anchorRD[1]);
  if(isRow){const targets=rowEntries.filter((e:any)=>e.frontTarget).map((e:any)=>[e.frontTarget[0]+e.anchorRD[0]-origin[0],e.frontTarget[1],e.frontTarget[2]+origin[1]-e.anchorRD[1]]);center.set(...targets.reduce((sum:number[],p:number[])=>sum.map((v,i)=>v+p[i]/targets.length),[0,0,0]) as [number,number,number]);}}
 if(view==='basement')center.y=Math.max(1.7,size.y*.12);
 if(view==='cornice'){const origin=manifest.entries[0].anchorRD;center.set(entry.corniceTarget[0]+entry.anchorRD[0]-origin[0],entry.corniceTarget[1],entry.corniceTarget[2]+origin[1]-entry.anchorRD[1]);}
 controls.target.copy(center);const distance=view==='basement'||view==='cornice'?((entry.frontWidthM*(view==='cornice'?.28:1))+.8)/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect)*1.12:(isRow?Math.max(size.x,size.z):Math.max(entry.frontWidthM??size.x,size.y))*1.7;
 const tangent=[normal[1],-normal[0]],oblique=view==='oblique'?0.6:view==='reverse'?-0.6:0;
 camera.position.set(center.x+(normal[0]+tangent[0]*oblique)*distance,view==='roof'?center.y+distance:view==='cornice'?Math.max(2.5,center.y-1.5):Math.max(2.5,center.y*.7),center.z+(normal[1]+tangent[1]*oblique)*distance);
 if(isRow&&view!=='roof'){
  const fitted=frameCanalhouseRowFromStreet(bounds,new T.Vector3(normal[0]+tangent[0]*oblique,0,normal[1]+tangent[1]*oblique),camera.fov,camera.aspect);
  center.copy(fitted.target);controls.target.copy(center);camera.position.copy(fitted.position);
 }
 camera.lookAt(center);controls.update();
 const references=entry.references??[],host=document.getElementById('reference')!,link=document.getElementById('reference-link') as HTMLAnchorElement;
 const selected=references[referenceIndex%Math.max(1,references.length)];host.replaceChildren();
 const panoramaEntry=reviewRow?entry:isRow?manifest.entries[Math.floor((manifest.entries.length-1)/2)]:entry;
 let source=view==='basement'?panoramaEntry.basementPanorama??(panoramaEntry.panorama?{...panoramaEntry.panorama,pitchDeg:0,fovDeg:25}:null):panoramaEntry.panorama;
 if(source&&reviewRow)source={...source,fovDeg:reviewRow.panoramaFovDeg};
 const referenceButton=document.querySelector<HTMLButtonElement>('[data-view="reference"]');if(referenceButton)referenceButton.disabled=!source?.cameraRD;
 if(view==='reference'&&!source?.cameraRD){view='front';currentView=view;}
 if(view==='reference'&&source?.cameraRD){
  const aligned=canalhouseReferenceCamera({...source,cameraHeightM:source.cameraHeightM??2.5,fovDeg:source.fovDeg??(isRow?95:65)},manifest.entries[0].anchorRD,camera.aspect);
  camera.position.copy(aligned.position);controls.target.copy(aligned.target);camera.fov=aligned.fovDeg;camera.updateProjectionMatrix();camera.lookAt(aligned.target);controls.update();
 }
 const sourceSelection=id+(view==='basement'?'-basement':'-whole');
 if(panoramaSelection!==sourceSelection){panoramaSelection=sourceSelection;if(source)void panorama.show(source,isRow);else panorama.clear();}
 if(selected?.previewUrl){const image=document.createElement('img');image.src=selected.previewUrl;image.alt=selected.label??'Archived source reference';host.append(image);}link.href=source?.url??selected?.url??entry.sourceUrl;link.textContent='Open original municipal panorama';
 document.getElementById('notes')!.textContent=isRow?`${rowEntries.length} individually authored houses · ${manifest.status}`:`${entry.name} · ${entry.triangles} triangles · ${(entry.bytes/1024).toFixed(1)} KB. ${(entry.simplifications??[]).join(' ')}`;
 if(manifest.reviewNotes?.length)document.getElementById('notes')!.textContent+=` Review ${manifest.reviewStatus}: ${manifest.reviewNotes.join(' ')}`;
 if(view==='reference')document.getElementById('notes')!.textContent+=' Reference viewpoint uses the recorded panorama position; camera height is approximated at 2.5 m.';
 const recipeLink=document.getElementById('recipe-link') as HTMLAnchorElement;
 recipeLink.href=isRow?manifestUrl:entry.recipeUrl??manifestUrl;
 recipeLink.textContent=isRow?'Open recipe index':'Open this house’s recipe JSON';
 const assemblyLink=document.getElementById('assembly-link') as HTMLAnchorElement;
 assemblyLink.hidden=isRow||!entry.assemblyUrl;if(entry.assemblyUrl)assemblyLink.href=entry.assemblyUrl;
 const gameLink=document.getElementById('game-review-link') as HTMLAnchorElement;
 const gameRow=reviewRow??(isRow?canalhousePreviewRowForMembers(rowEntries.map((e:any)=>e.id),manifest.reviewRows??[]):manifest.reviewRows?.find((r:any)=>r.houseIds.includes(entry.id)));
 gameLink.hidden=libraryMode||galleryOnlyPacks.has(chunk)||!gameRow||(gameReviewRowByPack[chunk]!==undefined&&gameRow.id!==gameReviewRowByPack[chunk]);
 if(gameRow)gameLink.href=`./index.html?canalhouseRecipes=${encodeURIComponent(gameRow.id)}`;
 void showAssembly(entry,isRow?'row':id);
}
async function start(){
 manifest=await(await fetch(manifestUrl,{cache:'no-store'})).json();if(!manifest.entries?.length)throw Error('No authored pilot assets yet');
 for(const row of manifest.reviewRows??[]){
  if(!row.houseIds?.length||!row.houseIds.includes(row.referenceHouseId)||row.houseIds.some((key:string)=>!manifest.entries.some((e:any)=>e.id===key)))throw Error('Invalid street review section');
  const option=document.createElement('option');option.value=row.id;option.textContent=row.label;selector.append(option);
 }
 for(const entry of manifest.entries){
  const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.name} · ${entry.sample??'development'}`;selector.append(option);}
 selector.onchange=()=>{referenceIndex=0;frame(selector.value);};for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.onclick=()=>frame(selector.value,button.dataset.view);
 status.textContent=libraryMode?'Reusable component examples · synthetic dimensions · no real building fidelity claim':candidateStatus();
 if(libraryMode){selector.querySelector('option[value="row"]')?.remove();document.querySelector('aside h2')!.textContent='Reusable assemblies';document.getElementById('reference-link')!.hidden=true;document.querySelector('aside .notice')!.textContent='Each example uses the same window-group, landing, flight, rail and crown components. Open its recipe to inspect dimensions and assembly choices. Geometry diagnostics have been reviewed; this WebGL view remains unverified.';}
 const query=new URLSearchParams(location.search),initial=query.get('house')??'row',view=query.get('view')??'front';selector.value=manifest.entries.some((e:any)=>e.id===initial)||manifest.reviewRows?.some((r:any)=>r.id===initial)?initial:libraryMode?manifest.entries[0].id:'row';await frame(selector.value,['front','oblique','reverse','roof','basement','cornice','reference'].includes(view)?view:'front');
 (window as any).canalhousePreview={manifest,models,group,renderer,camera,controls,frame,ready:true};
}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});start().catch(error=>{status.textContent=error.message;console.error(error);});
