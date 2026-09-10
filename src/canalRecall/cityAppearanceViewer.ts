/** Published, review-refreshable scene. No extraction or spending happens in this browser. */
// @ts-expect-error Installed runtime has no separate Three declarations.
import * as THREE from 'three';
// @ts-expect-error Installed runtime has no separate Three declarations.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CityAppearanceStreamer } from './cityAppearanceStreamer.js';
import { createCityAppearanceThreeAdapter, type ThreeAppearanceResource } from './cityAppearanceThree.js';
import { createAppearanceContext } from './cityAppearanceContext.js';
import { rdToLngLat } from './facade/rdNew.js';
// @ts-expect-error Shared source-wall camera module.
import { planFrontageCamera, frontageFraming } from '../../public/canal-drive/da-costa-block/frontage-camera.js';
// @ts-expect-error Shared bounded display extent; canonical source bounds stay unchanged.
import { neighbourhoodDisplayBounds } from '../../public/canal-drive/da-costa-block/neighbourhood-bounds.js';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const pageParams=new URLSearchParams(location.search),expansionMode=pageParams.get('area')==='expansion';
const releasePointer=expansionMode?'/data/city-expansion/current.json':'/data/city-appearance/current.json';
const checked=(id:string)=>$<HTMLInputElement>(id).checked;
const canvas=$<HTMLCanvasElement>('scene'),stage=$('stage'),scene=new THREE.Scene();scene.background=new THREE.Color('#e9e9df');scene.fog=new THREE.Fog('#e9e9df',260,850);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}),targetPixelRatio=Math.min(devicePixelRatio,1.5);let adaptivePixelRatio=targetPixelRatio,adaptiveChanges=0,frameSamples:number[]=[],priorFrame=0;
renderer.setPixelRatio(adaptivePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
scene.add(new THREE.HemisphereLight('#fbfff5','#87948b',1.75));const sun=new THREE.DirectionalLight('#fff0d8',3);sun.position.set(-130,240,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-340;sun.shadow.camera.right=340;sun.shadow.camera.top=340;sun.shadow.camera.bottom=-340;sun.shadow.camera.near=40;sun.shadow.camera.far=650;sun.shadow.bias=-.00015;scene.add(sun);
const camera=new THREE.PerspectiveCamera(38,1,.2,2500),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.8;controls.maxDistance=1100;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,5,-8);camera.position.set(160,210,230);controls.update();
let active:any=null,selectedId:string|null=null,selectedBuilding:string|null=null,view='overview',refreshing=false,disposed=false,frameRecord:any=null,quizStreet:string|null=null,quizIndex=0,routePlaying=false,routeDistance=0,lastRouteTime=0;
let generation=0,loadController:AbortController|null=null,lastStream=0,streamDirty=true,lastMetrics=0,latestStatus:any=null;
let pendingStyleRefresh=false;
const overviewFov=()=>2*Math.atan(Math.tan(38*Math.PI/360)/Math.min(1,camera.aspect))*180/Math.PI;
const status=(text:string,error=false)=>{$('release-status').textContent=text;$('release-status').classList.toggle('error',error);};
const bytesHash=async(bytes:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function verifiedJson(url:string,hash:string|string[],signal?:AbortSignal){
  const hashes=Array.isArray(hash)?hash:[hash];if(!hashes.length||hashes.some(value=>!/^[a-f0-9]{64}$/.test(value)))throw Error('Missing source hash');
  const resolved=new URL(url,location.href);if(resolved.origin!==location.origin)throw Error('Release data must be same-origin');
  const response=await fetch(resolved,{signal});if(!response.ok)throw Error(`Source HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();if(!hashes.includes(await bytesHash(bytes)))throw Error('Source hash mismatch; previous release retained');
  const raw=new Uint8Array(bytes);if(raw[0]===0x1f&&raw[1]===0x8b){const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());}
  return JSON.parse(new TextDecoder().decode(raw));
}
function cameraArea(context:any){
  const [longitude,latitude]=rdToLngLat({x:context.origin.x+camera.position.x,y:context.origin.y-camera.position.z});
  const radius=Math.min(900,Math.max(110,camera.position.distanceTo(controls.target)*1.1));
  const [west,south]=rdToLngLat({x:context.origin.x+controls.target.x-radius,y:context.origin.y-controls.target.z-radius});
  const [east,north]=rdToLngLat({x:context.origin.x+controls.target.x+radius,y:context.origin.y-controls.target.z+radius});
  return {longitude,latitude,bounds:{west,south,east,north}};
}
function records(){return active?[...active.owners.values()].flatMap((owner:any)=>owner.observations.map((o:any)=>o.payload)).sort((a:any,b:any)=>a.street.localeCompare(b.street)||a.mid[1]-b.mid[1]||a.id.localeCompare(b.id)):[];}
function buildings(){return active?[...active.owners.values()].map((owner:any)=>owner.geometry.building):[];}
function rebuildStreetLabels(){
  const layer=$('street-labels');layer.replaceChildren();if(!expansionMode||!active)return;
  const groups=new Map<string,{x:number;z:number;n:number}>();for(const building of buildings()){if(!building.street||!Array.isArray(building.center))continue;const value=groups.get(building.street)??{x:0,z:0,n:0};value.x+=building.center[0];value.z+=building.center[1];value.n++;groups.set(building.street,value);}
  const ranked=[...groups].sort((a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0])).slice(0,14);active.streetNames=ranked.map(([name])=>name);active.streetLabels=ranked.map(([name,value])=>{const element=document.createElement('span');element.className='street-label';element.textContent=name;layer.append(element);return{name,element,position:new THREE.Vector3(value.x/value.n,2,value.z/value.n)};});
}
function positionStreetLabels(){if(!active?.streetLabels)return;const distance=camera.position.distanceTo(controls.target),occupied:{left:number;right:number;top:number;bottom:number}[]=[];for(const label of active.streetLabels){const p=label.position.clone().project(camera),x=(p.x*.5+.5)*stage.clientWidth,y=(-p.y*.5+.5)*stage.clientHeight,width=Math.min(150,32+label.element.textContent.length*5.5),box={left:x-width/2,right:x+width/2,top:y-9,bottom:y+9};let visible=checked('labels')&&label.name!==quizStreet&&p.z>-1&&p.z<1&&Math.abs(p.x)<1.02&&Math.abs(p.y)<1.02&&!occupied.some(other=>box.left<other.right+5&&box.right>other.left-5&&box.top<other.bottom+3&&box.bottom>other.top-3);label.element.hidden=!visible;if(!visible)continue;occupied.push(box);label.element.style.left=`${x}px`;label.element.style.top=`${y}px`;label.element.classList.toggle('far',distance>300);}}
function startStreetQuiz(){if(!active?.streetNames?.length)return;quizStreet=active.streetNames[quizIndex++%active.streetNames.length];$('view-label').textContent=`Find ${quizStreet} · click one of its buildings`;$('street-quiz').textContent='Skip to another street';}
function answerStreetQuiz(buildingId:string){if(!quizStreet)return null;const target=quizStreet,street=active?.owners.get(buildingId)?.geometry.building.street,correct=street===target;if(correct){$('view-label').textContent=`Correct · ${target}`;quizStreet=null;$('street-quiz').textContent='Another street';}else $('view-label').textContent=`That is ${street||'an unnamed building'} · find ${target}`;return{correct,street:street||null,target};}
function updateTrees(contextResource:any){contextResource?.group?.traverse?.((mesh:any)=>{if(mesh.isInstancedMesh)mesh.visible=checked('trees')&&view!=='frontage';});}
function visibleTreeMeshes(){let count=0;active?.group?.traverse?.((mesh:any)=>{if(mesh.isInstancedMesh&&mesh.visible)count++;});return count;}
function createRouteOverlay(route:any){const group=new THREE.Group(),positions:number[]=[];for(let i=1;i<route.points.length;i++){const [ax,az]=route.points[i-1],[bx,bz]=route.points[i],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(!length)continue;const nx=-dz/length*.4,nz=dx/length*.4,points=[[ax+nx,.2,az+nz],[bx+nx,.2,bz+nz],[bx-nx,.2,bz-nz],[ax-nx,.2,az-nz]];for(const index of [0,1,2,0,2,3])positions.push(...points[index]);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:'#d7a82f',emissive:'#60440a',emissiveIntensity:.16,roughness:.78,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.name='map-recall-guided-route';mesh.renderOrder=3;group.add(mesh);return{group,dispose(){group.removeFromParent();geometry.dispose();material.dispose();}};}
function routeSample(distance:number){const points=active?.context.guidedRoute?.points;if(!points?.length)return null;let remaining=distance;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=length){const t=length?remaining/length:0;return{point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],ahead:b};}remaining-=length;}return{point:points.at(-1),ahead:points.at(-1)};}
function routeStreet(distance:number){return active?.context.guidedRoute?.legs?.find((leg:any,index:number,legs:any[])=>distance>=leg.fromM&&(distance<leg.toM||index===legs.length-1))?.streetName??null;}
function toggleRoutePlayback(){if(!active?.context.guidedRoute)return;routePlaying=!routePlaying;controls.enabled=!routePlaying;$('follow-route').textContent=routePlaying?'Pause street tour':'Resume street tour';if(routePlaying){quizStreet=null;routeDistance=routeDistance>=active.context.guidedRoute.distanceM?0:routeDistance;lastRouteTime=performance.now();}}
function setRouteCamera(distance:number){const route=active?.context.guidedRoute;if(!route)return;routeDistance=Math.max(0,Math.min(route.distanceM,distance));const sample=routeSample(routeDistance),forward=routeSample(Math.min(route.distanceM,routeDistance+12));if(!sample||!forward)return;const [x,z]=sample.point;let dx=forward.point[0]-x,dz=forward.point[1]-z;if(Math.hypot(dx,dz)<.1){const behind=routeSample(Math.max(0,routeDistance-12));dx=x-(behind?.point[0]??x-1);dz=z-(behind?.point[1]??z);}const length=Math.hypot(dx,dz)||1;camera.position.set(x-dx/length*4,2.35,z-dz/length*4);controls.target.set(x+dx/length*12,1.75,z+dz/length*12);camera.fov=58;camera.updateProjectionMatrix();controls.update();const street=routeStreet(routeDistance);$('view-label').textContent=`Street tour · ${street?`${street} · `:''}${Math.round(routeDistance)} / ${Math.round(route.distanceM)} m · ${Math.round(routeDistance/route.distanceM*100)}%`;streamDirty=true;}
function updateRouteCamera(now:number){if(!routePlaying)return;const route=active?.context.guidedRoute;if(!route){routePlaying=false;return;}const next=routeDistance+Math.min(.1,(now-lastRouteTime)/1000)*9;lastRouteTime=now;if(next>=route.distanceM){routePlaying=false;controls.enabled=true;$('follow-route').textContent='Replay street tour';}setRouteCamera(next);}
async function loadRelease(){
  const load=++generation;loadController?.abort();const controller=new AbortController();loadController=controller;
  const response=await fetch(releasePointer,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('No published scene yet. Run the matching city demo publisher.');
  const manifest=await response.json();if(manifest.version!==1||!manifest.releaseId||!Array.isArray(manifest.tiles)||!manifest.context?.url)throw Error('Unsupported scene release');
  const context=await verifiedJson(manifest.context.url,manifest.context.sha256,controller.signal);
  const group=new THREE.Group();let terrain:ReturnType<typeof createAppearanceContext>|null=null,contextStream:CityAppearanceStreamer<any,any>|null=null;
  const owners=new Map<string,any>(),nextResources=new Set<ThreeAppearanceResource>(),nextContextResources=new Set<ReturnType<typeof createAppearanceContext>>(),failures:string[]=[];
  const tiles=new Map<string,any>(manifest.tiles.map((tile:any)=>[tile.key,tile]));
  const create=createCityAppearanceThreeAdapter({parent:group,targetOriginRD:context.origin,targetOffsetNAP:.65,experimentalWallColours:expansionMode?checked('machine-preview'):checked('appearance'),proceduralFacades:checked('patterns'),reviewedAwnings:!expansionMode&&checked('appearance'),auditCoverage:expansionMode&&checked('appearance'),contextualPalette:expansionMode,contextualFacades:expansionMode,castShadows:!expansionMode} as any);
  const stream=new CityAppearanceStreamer({index:manifest,budget:12,concurrency:2,lodDistanceMultiplier:1,
    loadTile:async(key,signal)=>{const tile=tiles.get(key);if(!tile?.url)throw Error('Missing tile in release');return verifiedJson(tile.url,[tile.sha256,tile.contentSha256??tile.sha256],signal);},
    createResource:list=>{for(const owner of list)owners.set(owner.id,owner);const resource=create(list as any);resource.setSelected(selectedBuilding);nextResources.add(resource);return {setLod:(id,lod)=>resource.setLod(id,lod),dispose(){for(const owner of list)owners.delete(owner.id);nextResources.delete(resource);resource.dispose();}};},
    onError:(_key,error)=>failures.push(String(error)),
  });
  try{
    if(manifest.contextTiles){
      const contextTiles=new Map<string,any>(manifest.contextTiles.tiles.map((tile:any)=>[tile.key,tile]));
      contextStream=new CityAppearanceStreamer({index:manifest.contextTiles,budget:16,concurrency:2,
        loadTile:async(key,signal)=>{const tile=contextTiles.get(key);if(!tile?.url)throw Error('Missing context tile in release');return verifiedJson(tile.url,[tile.sha256,tile.contentSha256??tile.sha256],signal);},
        createResource:(items:any[])=>{const layers:any={},trees:any[]=[];for(const item of items){const payload=item.geometry;if(payload.kind==='tree')trees.push(payload.tree);else if(payload.kind==='feature')(layers[payload.layer]??=[]).push(payload.feature);}
          const resource=createAppearanceContext({...context,layers,trees},{includeBase:false});nextContextResources.add(resource);group.add(resource.group);return{setLod(){},dispose(){nextContextResources.delete(resource);resource.dispose();}};},
        onError:(_key,error)=>failures.push(String(error)),
      });
    }
    const area=cameraArea(context);stream.update(area);contextStream?.update(area);await Promise.all([stream.whenIdle(),contextStream?.whenIdle()]);for(const resource of nextResources)resource.flush();
    if(disposed||load!==generation||controller.signal.aborted)throw new DOMException('Superseded','AbortError');
    if(failures.length)throw Error(failures[0]);
    if(!owners.size)throw Error('No building tiles loaded for this view');
    const displayExtent=neighbourhoodDisplayBounds(context.bounds,[...owners.values()].flatMap(owner=>owner.observations.map((o:any)=>o.payload)));
    terrain=createAppearanceContext({...context,bounds:displayExtent.bounds});group.add(terrain.group);updateTrees(terrain);
    const routeOverlay=context.guidedRoute?createRouteOverlay(context.guidedRoute):null;if(routeOverlay){group.add(routeOverlay.group);routeOverlay.group.visible=checked('route');}
    const previous=active;active={manifest,context,displayExtent,group,terrain,routeOverlay,owners,stream,contextStream,resources:nextResources,contextResources:nextContextResources};scene.add(group);
    if(previous){previous.stream.dispose();previous.contextStream?.dispose();previous.routeOverlay?.dispose();previous.terrain.dispose();scene.remove(previous.group);}
    const [x0,z0,x1,z1]=displayExtent.bounds;renderer.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-x0),new THREE.Plane(new THREE.Vector3(-1,0,0),x1),new THREE.Plane(new THREE.Vector3(0,0,1),-z0),new THREE.Plane(new THREE.Vector3(0,0,-1),z1)];
    $('coverage').textContent=`${manifest.buildings} buildings · ${manifest.observations} photographed frontages · ${manifest.reviewed??0} reviewed`;
    const ladder=$('provenance-ladder');if(expansionMode&&manifest.appearanceCoverage){const c=manifest.appearanceCoverage;ladder.hidden=false;ladder.innerHTML=`<strong>Coverage ladder</strong><br>Geometry ${c.geometryBuildings}/${manifest.buildings}<br>Contextual display prior ${c.contextualPriorBuildings}/${manifest.buildings}<br>Audited street evidence ${c.auditedFrontages}/${manifest.buildings}<br>Quarantined machine preview ${c.machinePreviewFrontages}/${manifest.buildings}<br>Human-confirmed appearance ${c.humanConfirmedFrontages}/${manifest.buildings}`;}
    if(context.guidedRoute)$('follow-route').textContent=`Play ${Math.round(context.guidedRoute.distanceM)} m street tour`;
    rebuildStreetLabels();
    $('loading').hidden=true;status(`Release ${manifest.releaseId.slice(0,8)} · ${manifest.reviewed??0} reviewed${manifest.followupCount?` · ${manifest.followupCount} follow-up notes`:''}`);
    if(selectedBuilding)selectBuilding(selectedBuilding,selectedId||undefined);streamDirty=true;
  }catch(error){stream.dispose();contextStream?.dispose();terrain?.dispose();if(active?.group!==group)scene.remove(group);throw error;}
}
function setView(name:string){
  frameRecord=null;routePlaying=false;controls.enabled=true;$('follow-route').textContent='Play street tour';view=name;camera.fov=name==='overview'?overviewFov():38;
  if(name==='canal'){controls.target.set(-5,7,-30);camera.position.set(-75,58,25);}
  else if(name==='shops'){controls.target.set(-22,8,70);camera.position.set(-48,23,108);}
  else{const b=active?.displayExtent.bounds||[-130,-147,130,131],x=(b[0]+b[2])/2,z=(b[1]+b[3])/2,span=Math.max(b[2]-b[0],b[3]-b[1]);controls.target.set(x,5,z);camera.position.set(x+span*.5,span*.74,z+span*.70);}
  camera.updateProjectionMatrix();controls.update();$('view-label').textContent=expansionMode?(name==='shops'?'De Clercqstraat · source geometry':name==='canal'?'Along Da Costakade · source geometry':`Da Costa expansion · ${active?.manifest.buildings??'…'} buildings`):name==='shops'?'De Clercqstraat · proposed appearance':name==='canal'?'Along Da Costakade':'Da Costa · experimental appearance';
  updateTrees(active);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));streamDirty=true;
}
function selectBuilding(id:string,frontageId?:string){
  const owner=active?.owners.get(id);if(!owner)return;selectedBuilding=id;
  for(const resource of active?.resources||[])resource.setSelected(id);
  const rs=owner.observations.map((o:any)=>o.payload),r=rs.find((r:any)=>r.id===frontageId)||rs[0];selectedId=r?.id||null;
  const b=owner.geometry.building;$('inspector').hidden=false;$('selection-title').textContent=r?.address||b.addresses?.[0]||'Building without a photographed frontage';
  const placementLabels:Record<string,string>={accepted:'Human-confirmed wall',uncertain:'Human: placement uncertain',rejected:'Human: wrong or unusable', 'crop-repair':'Human: right building, bad crop'};
  const sourceLabel=r?.agentSourceAudit?`Agent source audit: ${r.agentSourceAudit.disposition}`:placementLabels[r?.review?.placement]||'Not human-reviewed';
  $('selection-tags').replaceChildren();for(const label of [sourceLabel,owner.geometryRevision.slice(0,8)]){const tag=document.createElement('span');tag.className='tag';tag.textContent=label;$('selection-tags').append(tag);}
  const choice=$<HTMLSelectElement>('frontage-choice');choice.replaceChildren(...rs.map((row:any,i:number)=>new Option(`${i+1}. ${row.wallWidthM.toFixed(1)} m wall${row.review?' · reviewed':''}`,row.id)));choice.hidden=rs.length<2;if(r)choice.value=r.id;
  const p=r?.effectiveProposal;
  const roofLabels:Record<string,string>={flat:'flat','flat-with-front-pitch':'mostly flat with a sloped front','pitched-gable':'two slopes meeting at a ridge',hipped:'sloped on all sides',mansard:'steep lower slopes and gentler upper slopes',complex:'several connected roof shapes'};
  $('selection-summary').textContent=r?`${r.machineRoutingProposal?`Machine preview: ${r.machineRoutingProposal.wallColour} ${r.machineRoutingProposal.wallMaterial}, ${r.machineRoutingProposal.family}; ${r.machineRoutingProposal.groundType} ground floor. `:''}Storefront: ${p?.shopfront==='yes'?(r.review?.shopfront==='yes'?'human-confirmed':'suggested'):p?.shopfront==='no'?'no storefront observed':'not established'}. Roof: ${roofLabels[p?.roofShape]||'not established'}. The source roof geometry is unchanged.`:'Source geometry only. No facade evidence has been assigned to this building.';
  $('inspector-warning').textContent=r?.agentSourceAudit?.note||r?.review?.notes?`${r?.agentSourceAudit?'Source audit':'Your note'}: ${r?.agentSourceAudit?.note||r.review.notes}`:r?.review?.placement==='crop-repair'?'The building is right, but the crop needs repair. Appearance is withheld.':'Window patterns are illustrative, not extracted window counts.';
  const image=$<HTMLImageElement>('evidence-image');image.hidden=true;image.removeAttribute('src');image.onload=()=>{image.hidden=false;};image.onerror=()=>{image.hidden=true;$('evidence-caption').textContent='Evidence image unavailable; use the review link.';};
  if(r?.images.full?.file){image.src=(expansionMode?'/panorama-audit/evidence/':'/evidence/')+encodeURIComponent(r.images.full.file);$('evidence-caption').textContent=`Street evidence · ${r.images.full.date?.slice(0,10)||'date unknown'} · approximate wall crop`;}else $('evidence-caption').textContent='';
  for(const el of ['review-link','frame-frontage','detail-link'])$(el).hidden=!r;
  if(r){$<HTMLAnchorElement>('review-link').href=expansionMode?'./panorama-audit.html#'+encodeURIComponent(r.id):'./neighbourhood-review.html#'+encodeURIComponent(r.id);$<HTMLAnchorElement>('review-link').textContent=expansionMode?'See audit evidence ↗':'Review this wall ↗';$<HTMLAnchorElement>('detail-link').href='./da-costa-block.html?neighbourhood=1&frontage='+encodeURIComponent(r.id);}
}
function frameFrontage(id:string){
  const r=records().find((r:any)=>r.id===id);if(!r)return;
  const corrected=r.review?.placement==='accepted'?records().find((t:any)=>t.id===r.review.targetId)||r:r;
  const plan=planFrontageCamera(corrected,buildings(),camera.aspect);selectBuilding(r.renderBuildingId||r.buildingId,r.id);
  if(!plan.usable){$('inspector-warning').textContent='This wall has no clear initial camera position. Use the photographs to review it.';return;}
  controls.target.set(...plan.target);camera.position.set(...plan.position);camera.fov=plan.fov;camera.updateProjectionMatrix();controls.update();frameRecord=corrected;view='frontage';updateTrees(active);
  $('view-label').textContent=r.address;document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));streamDirty=true;
}
function nextFrontage(delta:number){const rs=records();if(!rs.length)return;const i=rs.findIndex((r:any)=>r.id===selectedId);frameFrontage(rs[(i+delta+rs.length)%rs.length].id);}
async function checkStatus(){if(expansionMode)return;try{const r=await fetch('/api/city-appearance/status',{cache:'no-store'});if(r.ok){latestStatus=await r.json();if(latestStatus.stale)status('New saved reviews are available. Load them into this scene.');}}catch{/* Static published scenes remain readable without the local review service. */}}
async function refresh(publish=true){
  if(refreshing){if(!publish)pendingStyleRefresh=true;return;}refreshing=true;$<HTMLButtonElement>('refresh').disabled=true;
  try{status(publish?'Checking saved reviews…':'Updating appearance view…');
    if(publish){await checkStatus();if(latestStatus?.token){const response=await fetch('/api/city-appearance/refresh',{method:'POST',headers:{'content-type':'application/json','x-review-token':latestStatus.token},body:'{}'});if(!response.ok)throw Error((await response.json()).error||'Could not rebuild the scene');}}
    do{pendingStyleRefresh=false;await loadRelease();if(frameRecord)frameFrontage(frameRecord.id);}while(pendingStyleRefresh);
  }catch(error){if((error as Error).name!=='AbortError')status(`${String(error)}. The previous scene is retained.`,true);}
  finally{refreshing=false;$<HTMLButtonElement>('refresh').disabled=false;}
}
function resize(){const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;
  if(frameRecord)camera.fov=frontageFraming(frameRecord,camera.aspect,camera.position.distanceTo(controls.target)).fov;
  else if(view==='overview')camera.fov=overviewFov();
  camera.updateProjectionMatrix();streamDirty=true;
}
function governQuality(now:number){if(priorFrame){const delta=now-priorFrame;if(delta>0&&delta<500)frameSamples.push(delta);}priorFrame=now;if(frameSamples.length<30)return;const sorted=frameSamples.splice(0).sort((a,b)=>a-b),p75=sorted[Math.floor(sorted.length*.75)];if(p75>35&&adaptivePixelRatio>.76){adaptivePixelRatio=Math.max(.75,adaptivePixelRatio*.8);renderer.setPixelRatio(adaptivePixelRatio);resize();adaptiveChanges++;}else if(p75>45&&renderer.shadowMap.enabled){renderer.shadowMap.enabled=false;adaptiveChanges++;}}
new ResizeObserver(resize).observe(stage);resize();controls.addEventListener('change',()=>{streamDirty=true;});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view!));
$('camera-reset').onclick=()=>setView('overview');$('previous-frontage').onclick=()=>nextFrontage(-1);$('next-frontage').onclick=()=>nextFrontage(1);
$('street-quiz').onclick=startStreetQuiz;$('labels').onchange=()=>positionStreetLabels();
$('follow-route').onclick=toggleRoutePlayback;$('route').onchange=()=>{if(active?.routeOverlay)active.routeOverlay.group.visible=checked('route');};
$('inspector-close').onclick=()=>{$('inspector').hidden=true;selectedBuilding=null;selectedId=null;for(const resource of active?.resources||[])resource.setSelected(null);};$('frame-frontage').onclick=()=>selectedId&&frameFrontage(selectedId);
$<HTMLSelectElement>('frontage-choice').onchange=()=>selectedBuilding&&selectBuilding(selectedBuilding,$<HTMLSelectElement>('frontage-choice').value);
$('refresh').onclick=()=>void refresh();for(const id of ['appearance','patterns','machine-preview'])$(id).onchange=()=>{if(expansionMode&&id!=='patterns'&&checked(id)){const other=id==='appearance'?'machine-preview':'appearance';$<HTMLInputElement>(other).checked=false;}void refresh(false);};
$('trees').onchange=()=>{if(active)updateTrees({group:active.group});};
let down:{x:number;y:number}|null=null;const raycaster=new THREE.Raycaster();
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerup',event=>{if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(active?[...active.resources].flatMap((r:any)=>r.group.children):[],false);if(hits.length){for(const resource of active.resources){const hit=resource.pick(hits[0].object,hits[0].faceIndex);if(hit){answerStreetQuiz(hit.buildingId);selectBuilding(hit.buildingId,hit.observationId||undefined);break;}}}});
canvas.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();frameRecord=null;view='manual';updateTrees(active);const direction=new THREE.Vector3();camera.getWorldDirection(direction);direction.y=0;direction.normalize();const right=new THREE.Vector3(-direction.z,0,direction.x);const move=event.key==='ArrowUp'?direction:event.key==='ArrowDown'?direction.negate():event.key==='ArrowRight'?right:right.negate();move.multiplyScalar(event.shiftKey?8:3);camera.position.add(move);controls.target.add(move);controls.update();});
function animate(now:number){if(disposed)return;requestAnimationFrame(animate);governQuality(now);updateRouteCamera(now);controls.update();if(active&&streamDirty&&now-lastStream>120){const area=cameraArea(active.context);active.stream.update(area);active.contextStream?.update(area);lastStream=now;streamDirty=false;}
  renderer.render(scene,camera);positionStreetLabels();if(active&&now-lastMetrics>900){const s=active.stream.status,c=active.contextStream?.status;$('metrics').textContent=`${s.resident}/12 building tiles${c?` · ${c.resident}/16 context tiles`:''} · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles${s.failed.length||c?.failed.length?' · tile load failed':''}${s.budgetConstrained||c?.budgetConstrained?' · detailed extent limited':''}`;lastMetrics=now;}}
requestAnimationFrame(animate);const poll=setInterval(()=>void checkStatus(),15000);
window.addEventListener('pagehide',()=>{disposed=true;generation++;loadController?.abort();clearInterval(poll);active?.stream.dispose();active?.contextStream?.dispose();active?.routeOverlay?.dispose();active?.terrain.dispose();controls.dispose();renderer.dispose();});
(window as any).cityAppearanceDemo={status:()=>({ready:!!active,releaseId:active?.manifest.releaseId,reviewed:active?.manifest.reviewed,buildings:active?.manifest.buildings,residentBuildings:active?.owners.size,observations:active?.manifest.observations,residentObservations:records().length,stream:active?.stream.status,contextStream:active?.contextStream?.status,displayExtent:active?.displayExtent,facadeWindows:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.windows,0),facadeDoors:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.doors,0),selectionMeshes:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.group.children.filter((mesh:any)=>mesh.userData.runtimeSelection).length,0),contextBridges:[...(active?.contextResources||[])].reduce((n:number,r:ReturnType<typeof createAppearanceContext>)=>n+r.stats.bridges,0),visibleTreeMeshes:visibleTreeMeshes(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuGeometries:renderer.info.memory.geometries,gpuTextures:renderer.info.memory.textures,pixelRatio:adaptivePixelRatio,shadows:renderer.shadowMap.enabled,adaptiveChanges,selectedId,view,refreshing,quizStreet,routePlaying,routeDistance,cameraPosition:camera.position.toArray(),cameraTarget:controls.target.toArray()}),view:setView,frontage:frameFrontage,select:selectBuilding,refresh,quiz:startStreetQuiz,answerQuiz:answerStreetQuiz,buildingStreets:()=>active?[...active.owners].map(([id,owner]:any)=>({id,street:owner.geometry.building.street})):[],route:toggleRoutePlayback,routeAt:setRouteCamera,whenIdle:async()=>{await Promise.all([active?.stream.whenIdle(),active?.contextStream?.whenIdle()]);for(const r of active?.resources||[])r.flush();},records,context:()=>active?.context};
if(expansionMode){
  document.title='Da Costa · expansion geometry';document.querySelector('h1')!.innerHTML='A larger piece<br>of Amsterdam.';
  document.querySelector<HTMLElement>('.eyebrow')!.textContent='Amsterdam · source geometry at neighbourhood scale';
  document.querySelector<HTMLElement>('h1 + .muted')!.textContent='825 real building volumes, streets, canals and inventory trees—compiled from a reusable area pipeline and streamed from an immutable release.';
  $<HTMLInputElement>('patterns').closest('label')!.hidden=true;
  $('street-quiz').hidden=false;
  $('follow-route').hidden=false;
  $<HTMLInputElement>('machine-preview').checked=true;$<HTMLInputElement>('appearance').checked=false;
  $<HTMLInputElement>('appearance').nextElementSibling!.textContent='Audited source-wall coverage';
  $('appearance-copy').textContent='The city-wide palette is a deterministic construction-era visualization prior. The colour preview overrides 20 source-bound walls but remains quarantined. Switch to coverage: green means usable evidence, ochre means partial.';
  for(const id of ['previous-frontage','next-frontage','refresh','review-heading','review-copy'])$(id).hidden=true;
  const evidenceLink=$<HTMLAnchorElement>('evidence-link');evidenceLink.href='./panorama-audit.html';evidenceLink.textContent='See the new street evidence ↗';
  const pipelineLink=$<HTMLAnchorElement>('pipeline-link');pipelineLink.href='./EXPANSION_DEMO_2026-09-10.md';pipelineLink.textContent='What this demo proves';
  $('release-status').textContent='Loading immutable expansion geometry…';$('view-label').textContent='Da Costa expansion · source geometry';
}
else {$<HTMLInputElement>('machine-preview').closest('label')!.hidden=true;$<HTMLInputElement>('labels').closest('label')!.hidden=true;$<HTMLInputElement>('route').closest('label')!.hidden=true;}
void loadRelease().then(()=>{const id=pageParams.get('frontage'),inspect=pageParams.get('inspect');if(id)frameFrontage(id);else{setView('overview');if(inspect){const record=records().find((item:any)=>item.id===inspect);if(record)selectBuilding(record.renderBuildingId||record.buildingId,record.id);}}void checkStatus();}).catch(error=>{$('loading').textContent=String(error);$('loading').classList.add('error');});
