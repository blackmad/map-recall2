/** Published, review-refreshable scene. No extraction or spending happens in this browser. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CityAppearanceStreamer } from './cityAppearanceStreamer.js';
import { createCityAppearanceThreeAdapter, type ThreeAppearanceResource } from './cityAppearanceThree.js';
import { MACHINE_SIGN_PROVENANCE } from './cityAppearanceMachineSigns.js';
import { createAppearanceContext } from './cityAppearanceContext.js';
import { rdToLngLat, lngLatToRd } from './facade/rdNew.js';
// @ts-expect-error Shared source-wall camera module.
import { planFrontageCamera, frontageFraming } from '../../public/canal-drive/da-costa-block/frontage-camera.js';
// @ts-expect-error Shared bounded display extent; canonical source bounds stay unchanged.
import { neighbourhoodDisplayBounds } from '../../public/canal-drive/da-costa-block/neighbourhood-bounds.js';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const pageParams=new URLSearchParams(location.search),expansionMode=pageParams.get('area')==='expansion';
const pinnedRelease=pageParams.get('release');if(pinnedRelease&&!/^[a-f0-9]{64}$/.test(pinnedRelease))throw Error('Invalid immutable release ID');
const releasePointer=pinnedRelease?`/data/${expansionMode?'city-expansion':'city-appearance'}/releases/${pinnedRelease}/manifest.json`:expansionMode?'/data/city-expansion/current.json':'/data/city-appearance/current.json';
const checked=(id:string)=>$<HTMLInputElement>(id).checked;
const canvas=$<HTMLCanvasElement>('scene'),stage=$('stage'),scene=new THREE.Scene();scene.background=new THREE.Color('#e9e9df');scene.fog=new THREE.Fog('#e9e9df',260,850);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}),targetPixelRatio=Math.min(devicePixelRatio,1.5);let adaptivePixelRatio=targetPixelRatio,adaptiveChanges=0,frameSamples:number[]=[],priorFrame=0;
renderer.setPixelRatio(adaptivePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
scene.add(new THREE.HemisphereLight('#fbfff5','#87948b',1.75));const sun=new THREE.DirectionalLight('#fff0d8',3);sun.position.set(-130,240,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-340;sun.shadow.camera.right=340;sun.shadow.camera.top=340;sun.shadow.camera.bottom=-340;sun.shadow.camera.near=40;sun.shadow.camera.far=650;sun.shadow.bias=-.00015;scene.add(sun);
const camera=new THREE.PerspectiveCamera(38,1,.2,9000),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.8;controls.maxDistance=6000;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,5,-8);camera.position.set(160,210,230);controls.update();
function clampCameraParam(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}
function setNavigationMode(mode:'orbit'|'explore'){
 navigationMode=mode;
 $('navigation-orbit')?.setAttribute('aria-pressed',String(mode==='orbit'));
 $('navigation-explore')?.setAttribute('aria-pressed',String(mode==='explore'));
 controls.enableRotate=mode==='orbit' || mode==='explore';
 controls.enablePan=mode==='explore';
}
function pressButtons(group:'source-tier'|'camera-preset',value:string){
 document.querySelectorAll<HTMLButtonElement>(`button[data-${group}]`).forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset[group]===value)));
}
let activeSourceTier:'ground'|'full'='ground';
let activeCameraPreset:'ground'|'front'|'oblique'='ground';
function setSourceTier(value:'ground'|'full'){
 activeSourceTier=value;
 pressButtons('source-tier',value);
}
function setCameraPreset(value:'ground'|'front'|'oblique'){
 activeCameraPreset=value;
 pressButtons('camera-preset',value);
 const selected=selectedId ? records().find((record:any)=>record.id===selectedId) : null;
 if(value==='ground'){camera.fov=38;}
 else if(value==='front'){camera.fov=34;}
 else {camera.fov=48;}
 if(selected&&frameRecord) {
  const framing=frontageFraming(selected,camera.aspect,Math.max(16,camera.position.distanceTo(controls.target)));
  if(Number.isFinite(framing.fov)){camera.fov=framing.fov;}
 }
 camera.updateProjectionMatrix();
 controls.update();
 streamDirty=true;
}
function encodeCameraState(){
 return `cam=${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}|${controls.target.x.toFixed(2)},${controls.target.y.toFixed(2)},${controls.target.z.toFixed(2)}|${camera.fov.toFixed(2)}`;
}
function updateLocationMeta(){
 if(!active?.context?.origin) return;
 const [lng,lat]=rdToLngLat({x:active.context.origin.x+camera.position.x,y:active.context.origin.y-camera.position.z});
 const label=$('location-label');if(label)label.textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
 const map=$('location-map-link');if(map instanceof HTMLAnchorElement&&active?.context?.origin){map.href=`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;}
}
function applySharedCameraFromParams(valueParam?:string){
 const value=valueParam ?? new URLSearchParams(location.search).get('camera');
 if(!value||!active||!value.includes('|')) return;
 const [cameraPart,targetPart,fovPart]=value.split('|');
 const parseVec=(item:string|null)=>item?.split(',').map(Number);
 const cameraVec=parseVec(cameraPart),targetVec=parseVec(targetPart),fov=parseFloat(fovPart||'');
 if(cameraVec&&cameraVec.length===3&&cameraVec.every(v=>Number.isFinite(v))){camera.position.set(cameraVec[0],cameraVec[1],cameraVec[2]);}
 if(targetVec&&targetVec.length===3&&targetVec.every(v=>Number.isFinite(v))){controls.target.set(targetVec[0],targetVec[1],targetVec[2]);}
 if(Number.isFinite(fov)&&fov>1&&fov<120){camera.fov=fov;}
 streamDirty=true;
}
function currentCameraSearchParam(){
 return new URLSearchParams({...Object.fromEntries(pageParams),camera:encodeCameraState(),sourceTier:activeSourceTier,cameraPreset:activeCameraPreset}).toString();
}
let active:any=null,selectedId:string|null=null,selectedBuilding:string|null=null,view='overview',refreshing=false,disposed=false,frameRecord:any=null,quizStreet:string|null=null,quizIndex=0,routePlaying=false,routeDistance=0,lastRouteTime=0;
let generation=0,loadController:AbortController|null=null,lastStream=0,streamDirty=true,lastMetrics=0,latestStatus:any=null;
let pendingStyleRefresh=false;
let navigationMode:'orbit'|'explore'='orbit';
const movement={
 forward:false,
 backward:false,
 left:false,
 right:false,
 turnLeft:false,
 turnRight:false,
 fast:false,
};
let lastFrameTime=0;
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
/** Coarse source-footprint extrusion for the complete overview, without resident detail tiles. */
function createOverviewMassing(items:any[]){
  const positions:number[]=[],colours:number[]=[];
  for(const building of items){
    if(!building.footprint)continue;
    const colour=new THREE.Color(building.colour),height=Math.max(.1,building.height),polygons=building.footprint.type==='Polygon'?[building.footprint.coordinates]:building.footprint.coordinates;
    const triangle=(a:number[],b:number[],c:number[])=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colours.push(colour.r,colour.g,colour.b);};
    for(const polygon of polygons){
      const rings=polygon.map((ring:number[][])=>ring.slice(0,-1).map(p=>new THREE.Vector2(p[0],p[1]))),points=rings.flat();
      for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)))triangle([points[a].x,height,points[a].y],[points[c].x,height,points[c].y],[points[b].x,height,points[b].y]);
      for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];triangle([a.x,0,a.y],[b.x,height,b.y],[b.x,0,b.y]);triangle([a.x,0,a.y],[a.x,height,a.y],[b.x,height,b.y]);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));mesh.name='complete-source-footprint-overview';return mesh;
}
function cameraArea(context:any){
  const [longitude,latitude]=rdToLngLat({x:context.origin.x+camera.position.x,y:context.origin.y-camera.position.z});
  const radius=Math.min(900,Math.max(110,camera.position.distanceTo(controls.target)*1.1));
  const [west,south]=rdToLngLat({x:context.origin.x+controls.target.x-radius,y:context.origin.y-controls.target.z-radius});
  const [east,north]=rdToLngLat({x:context.origin.x+controls.target.x+radius,y:context.origin.y-controls.target.z+radius});
  return {longitude,latitude,bounds:{west,south,east,north}};
}
function records(){return active?[...active.owners.values()].flatMap((owner:any)=>owner.observations.map((o:any)=>o.payload)).sort((a:any,b:any)=>String(a.street??'').localeCompare(String(b.street??''))||a.mid[1]-b.mid[1]||a.id.localeCompare(b.id)):[];}
function buildings(){return active?[...active.owners.values()].map((owner:any)=>owner.geometry.building):[];}
function rebuildStreetLabels(){
  const layer=$('street-labels');layer.replaceChildren();if(!expansionMode||!active)return;
  const groups=new Map<string,{x:number;z:number;n:number}>();for(const building of buildings()){if(!building.street||!Array.isArray(building.center))continue;const value=groups.get(building.street)??{x:0,z:0,n:0};value.x+=building.center[0];value.z+=building.center[1];value.n++;groups.set(building.street,value);}
  const ranked=[...groups].sort((a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0])).slice(0,14);active.streetNames=ranked.map(([name])=>name);active.streetLabels=ranked.map(([name,value])=>{const element=document.createElement('span');element.className='street-label';element.textContent=name;layer.append(element);return{name,element,position:new THREE.Vector3(value.x/value.n,2,value.z/value.n)};});
}
function rebuildBuildingSearchList(){
 if(!active) return;
 const list=$<HTMLDataListElement>('building-options');list.replaceChildren();
 for(const owner of active.owners.values()){
   const item=owner.geometry.building;
   const option=document.createElement('option');
   option.value=owner.id;
   option.label=[item.id,item.street,item.addresses?.[0]].filter(Boolean).join(' · ');
   list.append(option);
 }
}
function frameCameraFromInput(value:string){
 const trimmed=value.trim();if(!trimmed)return;
 const direct=active?.owners.get(trimmed);
 if(direct){
  selectBuilding(direct.id);
  const source=ownerCenterPoint(direct);
  if(source){
    controls.target.set(source[0],source[1],source[2]);
    camera.position.set(source[0]-10,source[1]+8,source[2]+10);
    streamDirty=true;frameRecord=null;view='manual';updateTrees(active);pauseRouteForManualInput();
  }
  return;
 }
 const normalized=trimmed.toLowerCase();
 const match=[...active?.owners.values()??[]].find((owner:any)=>{const building=owner.geometry.building;return String(building.street||'').toLowerCase().includes(normalized)||String(building.id||'').toLowerCase().includes(normalized)||building.addresses?.some((address:string)=>address.toLowerCase().includes(normalized));});
 if(match){
  selectBuilding(match.id);
  const source=ownerCenterPoint(match);
  if(source){controls.target.set(source[0],source[1],source[2]);camera.position.set(source[0]-10,source[1]+8,source[2]+10);streamDirty=true;frameRecord=null;view='manual';updateTrees(active);pauseRouteForManualInput();}
  return;
 }
 $('view-label').textContent=`No building matched ${trimmed}.`;
}
function ownerCenterPoint(owner:any){
 const center=owner.geometry?.building?.center;
 if(Array.isArray(center)&&center.length>=2)return [center[0],1.5,center[1]] as const;
 return null;
}
function positionStreetLabels(){if(!active?.streetLabels)return;const distance=camera.position.distanceTo(controls.target),occupied:{left:number;right:number;top:number;bottom:number}[]=[];for(const label of active.streetLabels){const p=label.position.clone().project(camera),x=(p.x*.5+.5)*stage.clientWidth,y=(-p.y*.5+.5)*stage.clientHeight,width=Math.min(150,32+label.element.textContent.length*5.5),box={left:x-width/2,right:x+width/2,top:y-9,bottom:y+9};let visible=checked('labels')&&label.name!==quizStreet&&p.z>-1&&p.z<1&&Math.abs(p.x)<1.02&&Math.abs(p.y)<1.02&&!occupied.some(other=>box.left<other.right+5&&box.right>other.left-5&&box.top<other.bottom+3&&box.bottom>other.top-3);label.element.hidden=!visible;if(!visible)continue;occupied.push(box);label.element.style.left=`${x}px`;label.element.style.top=`${y}px`;label.element.classList.toggle('far',distance>300);}}
function startStreetQuiz(){if(!active?.streetNames?.length)return;quizStreet=active.streetNames[quizIndex++%active.streetNames.length];$('view-label').textContent=`Find ${quizStreet} · click one of its buildings`;$('street-quiz').textContent='Skip to another street';}
function answerStreetQuiz(buildingId:string){if(!quizStreet)return null;const target=quizStreet,street=active?.owners.get(buildingId)?.geometry.building.street,correct=street===target;if(correct){$('view-label').textContent=`Correct · ${target}`;quizStreet=null;$('street-quiz').textContent='Another street';}else $('view-label').textContent=`That is ${street||'an unnamed building'} · find ${target}`;return{correct,street:street||null,target};}
function updateTrees(contextResource:any){contextResource?.group?.traverse?.((mesh:any)=>{if(mesh.isInstancedMesh)mesh.visible=checked('trees')&&view!=='frontage';});}
function visibleTreeMeshes(){let count=0;active?.group?.traverse?.((mesh:any)=>{if(mesh.isInstancedMesh&&mesh.visible)count++;});return count;}
function residentMachineSigns(){return[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.machineSigns,0);}
function updateMachineSignBadge(){const badge=$('machine-sign-badge');if(!expansionMode){badge.hidden=true;return;}const count=residentMachineSigns(),visible=checked('machine-signs');badge.hidden=!visible||count<1;badge.textContent=MACHINE_SIGN_PROVENANCE;}
function setMachineSignVisibility(visible:boolean){for(const resource of active?.resources||[])resource.setMachineSignsVisible(visible);updateMachineSignBadge();}
function sourceTier(record:any){if(!record)return 'geometry-only';if(record.sourceTier||record.tier)return record.sourceTier||record.tier;const full=record.images?.full,ground=record.images?.ground;if(full&&ground)return 'full + ground';if(ground)return 'ground';if(full)return 'full';return 'source metadata only';}
function sourceCaptureDate(record:any){return record?.images?.ground?.date||record?.images?.full?.date||record?.captureDate||record?.capturedAt||'date unknown';}
function sourceOmissions(record:any){if(!record)return ['facade evidence'];const p=record.machineRoutingProposal||{},omissions:string[]=[];if(!String(p.signText||'').trim())omissions.push('literal sign text');if(p.signTextEligible==='unknown')omissions.push('sign text uncertain');if(record.effectiveProposal?.shopfront==='unknown'||record.effectiveProposal?.shopfront==null)omissions.push('shopfront');if(record.visualReview?.fieldEligibility?.signText===false)omissions.push('sign text withheld');return [...new Set(omissions)];}
function sourceComparisonCopy(record:any){if(!record)return 'No source observation is bound to this building; generated facade details remain omitted.';const ground=record.images?.ground,full=record.images?.full,identity=[record.id,record.evidenceKey,record.derivationKey].filter(Boolean).join(' · ')||'identity unavailable',panorama=ground?.panoramaId||full?.panoramaId||'panorama unavailable',omissions=sourceOmissions(record),date=String(sourceCaptureDate(record));return `Source ${identity} · panorama ${panorama} · captured ${date.slice(0,10)} · tier ${sourceTier(record)}. Render omissions: ${omissions.length?omissions.join(', '):'none recorded'}. Machine text stays unreviewed and is revoked when this source binding changes.`;}
function createRouteOverlay(route:any){const group=new THREE.Group(),positions:number[]=[];for(let i=1;i<route.points.length;i++){const [ax,az]=route.points[i-1],[bx,bz]=route.points[i],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(!length)continue;const nx=-dz/length*.4,nz=dx/length*.4,points=[[ax+nx,.2,az+nz],[bx+nx,.2,bz+nz],[bx-nx,.2,bz-nz],[ax-nx,.2,az-nz]];for(const index of [0,1,2,0,2,3])positions.push(...points[index]);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:'#d7a82f',emissive:'#60440a',emissiveIntensity:.16,roughness:.78,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.name='map-recall-guided-route';mesh.renderOrder=3;group.add(mesh);return{group,dispose(){group.removeFromParent();geometry.dispose();material.dispose();}};}
function routeSample(distance:number){const points=active?.context.guidedRoute?.points;if(!points?.length)return null;let remaining=distance;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=length){const t=length?remaining/length:0;return{point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],ahead:b};}remaining-=length;}return{point:points.at(-1),ahead:points.at(-1)};}
function routeStreet(distance:number){return active?.context.guidedRoute?.legs?.find((leg:any,index:number,legs:any[])=>distance>=leg.fromM&&(distance<leg.toM||index===legs.length-1))?.streetName??null;}
function toggleRoutePlayback(){if(!active?.context.guidedRoute)return;routePlaying=!routePlaying;controls.enabled=!routePlaying;$('follow-route').textContent=routePlaying?'Pause street tour':'Resume street tour';if(routePlaying){setMachineSignVisibility(checked('machine-signs'));quizStreet=null;routeDistance=routeDistance>=active.context.guidedRoute.distanceM?0:routeDistance;lastRouteTime=performance.now();}}
function setRouteCamera(distance:number){if(active?.priorityTiles)active.priorityTiles.length=0;view='route';if(scene.fog instanceof THREE.Fog){scene.fog.near=260;scene.fog.far=850;}const route=active?.context.guidedRoute;if(!route)return;routeDistance=Math.max(0,Math.min(route.distanceM,distance));const sample=routeSample(routeDistance),forward=routeSample(Math.min(route.distanceM,routeDistance+12));if(!sample||!forward)return;const [x,z]=sample.point;let dx=forward.point[0]-x,dz=forward.point[1]-z;if(Math.hypot(dx,dz)<.1){const behind=routeSample(Math.max(0,routeDistance-12));dx=x-(behind?.point[0]??x-1);dz=z-(behind?.point[1]??z);}const length=Math.hypot(dx,dz)||1;camera.position.set(x-dx/length*4,2.35,z-dz/length*4);controls.target.set(x+dx/length*12,1.75,z+dz/length*12);camera.fov=58;camera.updateProjectionMatrix();controls.update();const street=routeStreet(routeDistance);$('view-label').textContent=`Street tour · ${street?`${street} · `:''}${Math.round(routeDistance)} / ${Math.round(route.distanceM)} m · ${Math.round(routeDistance/route.distanceM*100)}%`;streamDirty=true;}
function updateRouteCamera(now:number){if(!routePlaying)return;const route=active?.context.guidedRoute;if(!route){routePlaying=false;return;}const next=routeDistance+Math.min(.1,(now-lastRouteTime)/1000)*9;lastRouteTime=now;if(next>=route.distanceM){routePlaying=false;controls.enabled=true;$('follow-route').textContent='Replay street tour';}setRouteCamera(next);}
async function loadRelease(){
  const load=++generation;loadController?.abort();const controller=new AbortController();loadController=controller;
  const response=await fetch(releasePointer,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('No published scene yet. Run the matching city demo publisher.');
  const manifest=await response.json();if(manifest.version!==1||!manifest.releaseId||!Array.isArray(manifest.tiles)||!manifest.context?.url)throw Error('Unsupported scene release');
  const candidatePreview=!!pinnedRelease&&manifest.developmentCandidate===true;
  if(candidatePreview){const label=$('machine-preview').closest('label')?.querySelector('span');if(label)label.textContent='Photo-derived wall colours (unreviewed)';$('appearance-copy').textContent='Photo-derived façade details are shown where available. Other buildings retain illustrative patterns. Placement is under review; source roofs are preserved.';let badge=document.getElementById('candidate-preview-badge');if(!badge){badge=document.createElement('div');badge.id='candidate-preview-badge';badge.style.cssText='position:fixed;bottom:12px;left:12px;z-index:20;padding:8px 12px;background:#fff3ce;color:#493c20;font:13px sans-serif;pointer-events:none';document.body.append(badge);}badge.textContent='Neighbourhood preview · façade placement under review';}
  const context=await verifiedJson(manifest.context.url,manifest.context.sha256,controller.signal);
  const group=new THREE.Group();let terrain:ReturnType<typeof createAppearanceContext>|null=null,contextStream:CityAppearanceStreamer<any,any>|null=null;
  const owners=new Map<string,any>(),nextResources=new Set<ThreeAppearanceResource>(),nextContextResources=new Set<ReturnType<typeof createAppearanceContext>>(),failures:string[]=[];
  const tiles=new Map<string,any>(manifest.tiles.map((tile:any)=>[tile.key,tile]));
  const create=createCityAppearanceThreeAdapter({parent:group,targetOriginRD:context.origin,targetOffsetNAP:.65,experimentalWallColours:expansionMode?checked('machine-preview'):checked('appearance'),observedFacades:candidatePreview,candidateRegistrationPreview:candidatePreview,proceduralFacades:checked('patterns'),reviewedAwnings:!expansionMode&&checked('appearance'),auditCoverage:expansionMode&&checked('appearance'),contextualPalette:expansionMode,contextualFacades:expansionMode,machineSigns:expansionMode&&checked('machine-signs'),castShadows:!expansionMode} as any);
  const requested=manifest.observationIndex?.find((r:any)=>r.id===(pageParams.get('frontage')||pageParams.get('inspect'))),priorityTiles=requested?.tile?[requested.tile]:[];
  const stream=new CityAppearanceStreamer({index:manifest,priorityTiles,budget:12,concurrency:2,lodDistanceMultiplier:1,
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
    if(requested?.mid){controls.target.set(requested.mid[0],5,requested.mid[1]);camera.position.set(requested.mid[0],45,requested.mid[1]+45);controls.update();}
    const area=cameraArea(context);stream.update(area);contextStream?.update(area);await Promise.all([stream.whenIdle(),contextStream?.whenIdle()]);for(const resource of nextResources)resource.flush();
    if(disposed||load!==generation||controller.signal.aborted)throw new DOMException('Superseded','AbortError');
    if(failures.length)throw Error(failures[0]);
    if(!owners.size)throw Error('No building tiles loaded for this view');
    const displayExtent=neighbourhoodDisplayBounds(context.bounds,[...owners.values()].flatMap(owner=>owner.observations.map((o:any)=>o.payload)));
    terrain=createAppearanceContext({...context,bounds:displayExtent.bounds});group.add(terrain.group);updateTrees(terrain);
    const overviewMassing=context.overviewMassing?.buildings?.length?createOverviewMassing(context.overviewMassing.buildings):null;if(overviewMassing)group.add(overviewMassing);
    const routeOverlay=context.guidedRoute?createRouteOverlay(context.guidedRoute):null;if(routeOverlay){group.add(routeOverlay.group);routeOverlay.group.visible=checked('route');}
    const previous=active;active={manifest,context,displayExtent,group,terrain,overviewMassing,priorityTiles,routeOverlay,owners,stream,contextStream,resources:nextResources,contextResources:nextContextResources};scene.add(group);
    if(previous){previous.stream.dispose();previous.contextStream?.dispose();previous.routeOverlay?.dispose();previous.terrain.dispose();previous.overviewMassing?.geometry.dispose();previous.overviewMassing?.material.dispose();scene.remove(previous.group);}
    const [x0,z0,x1,z1]=displayExtent.bounds;renderer.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-x0),new THREE.Plane(new THREE.Vector3(-1,0,0),x1),new THREE.Plane(new THREE.Vector3(0,0,1),-z0),new THREE.Plane(new THREE.Vector3(0,0,-1),z1)];
    $('coverage').textContent=`${manifest.buildings} buildings · ${manifest.observations} photographed frontages · ${manifest.reviewed??0} reviewed`;
    const ladder=$('provenance-ladder');if(expansionMode&&manifest.appearanceCoverage){const c=manifest.appearanceCoverage;ladder.hidden=false;ladder.innerHTML=`<strong>Coverage ladder</strong><br>Geometry ${c.geometryBuildings}/${manifest.buildings}<br>Contextual display prior ${c.contextualPriorBuildings}/${manifest.buildings}<br>Audited street evidence ${c.auditedFrontages}/${manifest.buildings}<br>Machine-observed (unreviewed) ${c.machinePreviewFrontages}/${manifest.buildings}<br>Human-confirmed appearance ${c.humanConfirmedFrontages}/${manifest.buildings}${candidatePreview?`<br>Candidate façade buildings ${c.candidatePreviewBuildings??0}/${manifest.buildings}`:''}`;}
    updateMachineSignBadge();
    if(context.guidedRoute)$('follow-route').textContent=`Play ${Math.round(context.guidedRoute.distanceM)} m street tour`;
    rebuildStreetLabels();
    rebuildBuildingSearchList();
    setSourceTier((pageParams.get('sourceTier')==='full' ? 'full' : 'ground'));
    setCameraPreset((pageParams.get('cameraPreset')==='front' ? 'front' : pageParams.get('cameraPreset')==='oblique' ? 'oblique' : 'ground'));
    applySharedCameraFromParams();
    updateLocationMeta();
    $('loading').hidden=true;status(`Release ${manifest.releaseId.slice(0,8)} · ${manifest.reviewed??0} reviewed${manifest.followupCount?` · ${manifest.followupCount} follow-up notes`:''}`);
    if(selectedBuilding)selectBuilding(selectedBuilding,selectedId||undefined);streamDirty=true;
  }catch(error){stream.dispose();contextStream?.dispose();terrain?.dispose();if(active?.group!==group)scene.remove(group);throw error;}
}
function setView(name:string){
  if(active?.priorityTiles)active.priorityTiles.length=0;
  frameRecord=null;routePlaying=false;controls.enabled=true;$('follow-route').textContent='Play street tour';view=name;setMachineSignVisibility(expansionMode&&checked('machine-signs'));
  setNavigationMode(navigationMode);
  if(name==='canal'){const rd=expansionMode&&active?lngLatToRd([4.8728,52.3720]):null,x=rd?rd.x-active.context.origin.x:-5,z=rd?active.context.origin.y-rd.y:-30;controls.target.set(x,7,z);camera.position.set(x-70,58,z+55);}
  else if(name==='shops'){const rd=expansionMode&&active?lngLatToRd([4.8730,52.37155]):null,x=rd?rd.x-active.context.origin.x:-22,z=rd?active.context.origin.y-rd.y:70;controls.target.set(x,8,z);camera.position.set(x-26,23,z+38);}
  else{const b=active?.displayExtent.bounds||[-130,-147,130,131],x=(b[0]+b[2])/2,z=(b[1]+b[3])/2,span=Math.max(b[2]-b[0],b[3]-b[1]);controls.target.set(x,5,z);camera.position.set(x+span*.5,span*.74,z+span*.70);}
  if(scene.fog instanceof THREE.Fog){scene.fog.near=name==='overview'?1800:260;scene.fog.far=name==='overview'?6000:850;}
  setCameraPreset(activeCameraPreset);
  updateTrees(active);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));streamDirty=true;
}
function selectBuilding(id:string,frontageId?:string){
  const owner=active?.owners.get(id);if(!owner)return;selectedBuilding=id;
  for(const resource of active?.resources||[])resource.setSelected(id);
  const rs=owner.observations.map((o:any)=>o.payload),r=rs.find((r:any)=>r.id===frontageId)||rs[0];selectedId=r?.id||null;
  const b=owner.geometry.building;$('inspector').hidden=false;$('selection-title').textContent=r?.address||b.addresses?.[0]||'Building without a photographed frontage';
  const placementLabels:Record<string,string>={accepted:'Human-confirmed wall',uncertain:'Human: placement uncertain',rejected:'Human: wrong or unusable', 'crop-repair':'Human: right building, bad crop'};
  const sourceLabel=r?.agentSourceAudit?(r.agentSourceAudit.disposition==='preflight-passed'?'Automated crop preflight · identity unreviewed':`Agent source audit: ${r.agentSourceAudit.disposition}`):placementLabels[r?.review?.placement]||'Not human-reviewed';
  $('selection-tags').replaceChildren();for(const label of [sourceLabel,owner.geometryRevision.slice(0,8)]){const tag=document.createElement('span');tag.className='tag';tag.textContent=label;$('selection-tags').append(tag);}
  const choice=$<HTMLSelectElement>('frontage-choice');choice.replaceChildren(...rs.map((row:any,i:number)=>new Option(`${i+1}. ${row.wallWidthM.toFixed(1)} m wall${['accepted','uncertain','rejected','crop-repair'].includes(row.review?.placement)?' · reviewed':''}`,row.id)));choice.hidden=rs.length<2;if(r)choice.value=r.id;
  const p=r?.effectiveProposal;
  const roofLabels:Record<string,string>={flat:'flat','flat-with-front-pitch':'mostly flat with a sloped front','pitched-gable':'two slopes meeting at a ridge',hipped:'sloped on all sides',mansard:'steep lower slopes and gentler upper slopes',complex:'several connected roof shapes'};
  $('selection-summary').textContent=r?`${r.machineRoutingProposal?`Machine-observed: ${r.machineRoutingProposal.wallColour} ${r.machineRoutingProposal.wallMaterial}, ${r.machineRoutingProposal.family}; ${r.machineRoutingProposal.groundType} ground floor. `:''}Storefront: ${p?.shopfront==='yes'?(r.review?.shopfront==='yes'?'human-confirmed':'machine-observed, unreviewed'):p?.shopfront==='no'?'no storefront observed':'not established'}. Roof: ${roofLabels[p?.roofShape]||'not established'}. The source roof geometry is unchanged.`:'Source geometry only. No facade evidence has been assigned to this building.';
  $('source-comparison').textContent=sourceComparisonCopy(r);
  $('inspector-warning').textContent=r?.agentSourceAudit?.note||r?.review?.notes?`${r?.agentSourceAudit?'Source audit':'Your note'}: ${r?.agentSourceAudit?.note||r.review.notes}`:r?.review?.placement==='crop-repair'?'The building is right, but the crop needs repair. Appearance is withheld.':r?.facadeDescription?'Photo-derived façade details; placement is still under review.':'Window patterns are illustrative, not extracted window counts.';
  const image=$<HTMLImageElement>('evidence-image');image.hidden=true;image.removeAttribute('src');image.onload=()=>{image.hidden=false;};image.onerror=()=>{image.hidden=true;$('evidence-caption').textContent='Evidence image unavailable; use the review link.';};
  if(r?.images.full?.file){image.src=r.images.full.publicUrl||((expansionMode?'/panorama-audit/evidence/':'/evidence/')+encodeURIComponent(r.images.full.file));$('evidence-caption').textContent=`Street evidence · ${r.images.full.date?.slice(0,10)||'date unknown'} · approximate wall crop`;}else $('evidence-caption').textContent='';
  for(const el of ['review-link','frame-frontage','detail-link'])$(el).hidden=!r;
  if(r){$<HTMLAnchorElement>('review-link').href=expansionMode?'./panorama-audit.html#'+encodeURIComponent(r.id):'./neighbourhood-review.html#'+encodeURIComponent(r.id);$<HTMLAnchorElement>('review-link').textContent=expansionMode?'See audit evidence ↗':'Review this wall ↗';$<HTMLAnchorElement>('detail-link').href='./da-costa-block.html?neighbourhood=1&frontage='+encodeURIComponent(r.id);}
  if(r){
    const reviewUrl=$<HTMLAnchorElement>('review-link');
    const base=expansionMode?'./panorama-audit.html':'./neighbourhood-review.html';
    const url=new URL(base + '#'+encodeURIComponent(r.id),location.href);
    url.searchParams.set('sourceTier',activeSourceTier);
    url.searchParams.set('cameraPreset',activeCameraPreset);
    reviewUrl.href=url.href;
  }
}
function frameFrontage(id:string){
  const r=records().find((r:any)=>r.id===id);if(!r)return;
  const corrected=r.review?.placement==='accepted'?records().find((t:any)=>t.id===r.review.targetId)||r:r;
  const plan=planFrontageCamera(corrected,buildings(),camera.aspect);selectBuilding(r.renderBuildingId||r.buildingId,r.id);
  if(!plan.usable){$('inspector-warning').textContent='This wall has no clear initial camera position. Use the photographs to review it.';return;}
  controls.target.set(plan.target[0],plan.target[1],plan.target[2]);camera.position.set(plan.position[0],plan.position[1],plan.position[2]);camera.fov=plan.fov;camera.updateProjectionMatrix();controls.update();frameRecord=corrected;view='frontage';updateTrees(active);
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
for(const id of ['navigation-orbit','navigation-explore']){
  const mode=id==='navigation-orbit'?'orbit':'explore';
  const button=$(id) as HTMLButtonElement|null;
  if(button) button.onclick=()=>setNavigationMode(mode);
}
$('building-search-go').onclick=()=>{frameCameraFromInput(($('building-search') as HTMLInputElement).value);};
($('building-search') as HTMLInputElement).addEventListener('keydown',(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();frameCameraFromInput(($('building-search') as HTMLInputElement).value);}});
$('search-clear').onclick=()=>{($('building-search') as HTMLInputElement).value='';$('view-label').textContent='Search cleared';};
document.querySelectorAll<HTMLButtonElement>('button[data-source-tier]').forEach((button)=>{button.onclick=()=>setSourceTier((button.dataset.sourceTier as 'ground'|'full'));});
document.querySelectorAll<HTMLButtonElement>('button[data-camera-preset]').forEach((button)=>{button.onclick=()=>setCameraPreset((button.dataset.cameraPreset as 'ground'|'front'|'oblique'));});
$('camera-copy').onclick=async ()=>{
  const params=currentCameraSearchParam();
  const url=new URL(location.href);
  url.search=params.toString();
  try{await navigator.clipboard?.writeText(url.toString());}catch{
    const link=document.createElement('a');link.href=url.toString();link.download='';link.click();
  }
  $('view-label').textContent='Camera link copied';
};
$('camera-share').onclick=()=>{applySharedCameraFromParams();streamDirty=true;updateLocationMeta();$('view-label').textContent='Camera restored from URL';};
$('refresh').onclick=()=>void refresh();for(const id of ['appearance','patterns','machine-preview'])$(id).onchange=()=>{if(expansionMode&&id!=='patterns'&&checked(id)){const other=id==='appearance'?'machine-preview':'appearance';$<HTMLInputElement>(other).checked=false;}void refresh(false);};
$('machine-signs').onchange=()=>setMachineSignVisibility(checked('machine-signs'));
$('trees').onchange=()=>{if(active)updateTrees({group:active.group});};
let down:{x:number;y:number}|null=null;const raycaster=new THREE.Raycaster();
function isEditingText(){return ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'');}
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerup',event=>{if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(active?[...active.resources].flatMap((r:any)=>r.group.children):[],false);if(hits.length){for(const resource of active.resources){const hit=resource.pick(hits[0].object,hits[0].faceIndex);if(hit){answerStreetQuiz(hit.buildingId);selectBuilding(hit.buildingId,hit.observationId||undefined);break;}}}});
function pauseRouteForManualInput(){
  if(!routePlaying) return;
  routePlaying=false;
  controls.enabled=true;
  $('follow-route').textContent='Play street tour';
}
function applyManualMove(now:number){
  if(navigationMode==='orbit' || !active){return;}
  if(!lastFrameTime) lastFrameTime=now;
  if(!Object.values(movement).some(Boolean)) return;
  pauseRouteForManualInput();
  frameRecord=null;
  view='manual';
  updateTrees(active);
  const direction=new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y=0;direction.normalize();
  const right=new THREE.Vector3(-direction.z,0,direction.x);
  const turn=0.015*(movement.fast?1.5:1)*Math.min(1,(now-lastFrameTime)/16.7);
  if(movement.turnLeft)controls.rotateLeft(turn);
  if(movement.turnRight)controls.rotateLeft(-turn);
  const move=new THREE.Vector3();
  if(movement.forward)move.add(direction);
  if(movement.backward)move.sub(direction);
  if(movement.left)move.sub(right);
  if(movement.right)move.add(right);
  if(move.lengthSq()>0.0001){
    const speed=movement.fast?1.8:0.75;
    const dt=(now-lastFrameTime)/16.7;
    move.normalize().multiplyScalar(speed*dt*2.4);
    camera.position.add(move);
    controls.target.add(move);
  }
  controls.update();
  streamDirty=true;
  lastFrameTime=now;
  updateLocationMeta();
}
function setMovementFromCode(code:string,on:boolean){
  switch(code){
    case 'ArrowUp':
    case 'KeyW':
      movement.forward=on;return true;
    case 'ArrowDown':
    case 'KeyS':
      movement.backward=on;return true;
    case 'ArrowLeft':
    case 'KeyA':
      movement.left=on;return true;
    case 'ArrowRight':
    case 'KeyD':
      movement.right=on;return true;
    case 'KeyQ':
      movement.turnLeft=on;return true;
    case 'KeyE':
      movement.turnRight=on;return true;
    case 'ShiftLeft':
    case 'ShiftRight':
      movement.fast=on;return true;
  }
  return false;
}
window.addEventListener('keydown',event=>{
  if(isEditingText()) return;
  const previousMode=navigationMode;
  const key=event.key.toLowerCase();
  const handled=setMovementFromCode(event.code,true);
  if(handled){
    event.preventDefault();
    if(previousMode!=='explore'){setNavigationMode('explore');}
    lastFrameTime=performance.now();
    return;
  }
  if(key==='f'){event.preventDefault();selectedId&&frameFrontage(selectedId);}
  if(key==='o'){event.preventDefault();setNavigationMode('orbit');}
  if(key==='x'){event.preventDefault();setNavigationMode('explore');}
});
window.addEventListener('keyup',event=>{
  if(isEditingText()) return;
  setMovementFromCode(event.code,false);
  if(!Object.values(movement).some(Boolean)){lastFrameTime=0;}
});
document.querySelectorAll('#touch-controls button').forEach((button)=>{
  const id=button.id;
  const set=(activeState:boolean)=>{
    if(id==='move-forward')movement.forward=activeState;
    if(id==='move-backward')movement.backward=activeState;
    if(id==='move-left')movement.left=activeState;
    if(id==='move-right')movement.right=activeState;
    if(id==='turn-left')movement.turnLeft=activeState;
    if(id==='turn-right')movement.turnRight=activeState;
    if(id==='speed-toggle')movement.fast=activeState;
    if(activeState)pauseRouteForManualInput();
  };
  button.addEventListener('pointerdown',(event)=>{event.preventDefault();if(navigationMode!=='explore')setNavigationMode('explore');set(true);});
  button.addEventListener('pointerup',()=>{set(false);});
  button.addEventListener('pointerleave',()=>{set(false);});
});
window.addEventListener('pointerup',()=>{
  if(navigationMode!=='explore')return;
  movement.forward=false;movement.backward=false;movement.left=false;movement.right=false;movement.turnLeft=false;movement.turnRight=false;movement.fast=false;
});
function animate(now:number){if(active?.overviewMassing){active.overviewMassing.visible=view==='overview';for(const resource of active.resources)resource.group.visible=view!=='overview';}if(disposed)return;requestAnimationFrame(animate);governQuality(now);applyManualMove(now);updateRouteCamera(now);controls.update();if(active&&streamDirty&&now-lastStream>120){const area=cameraArea(active.context);active.stream.update(area);active.contextStream?.update(area);lastFrameTime=now;lastStream=now;streamDirty=false;}
  renderer.render(scene,camera);positionStreetLabels();if(active&&now-lastMetrics>900){const s=active.stream.status,c=active.contextStream?.status;$('metrics').textContent=`${s.resident}/12 building tiles${c?` · ${c.resident}/16 context tiles`:''} · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles${s.failed.length||c?.failed.length?' · tile load failed':''}${s.budgetConstrained||c?.budgetConstrained?' · detailed extent limited':''}`;lastMetrics=now;}}
requestAnimationFrame(animate);const poll=setInterval(()=>void checkStatus(),15000);
window.addEventListener('pagehide',()=>{disposed=true;generation++;loadController?.abort();clearInterval(poll);active?.stream.dispose();active?.contextStream?.dispose();active?.routeOverlay?.dispose();active?.terrain.dispose();controls.dispose();renderer.dispose();});
function intervalPaintedWalls(){const walls=new Set<string>();for(const resource of active?.resources||[])for(const mesh of resource.group.children)for(const item of mesh.userData.triangleIdentities||[])if(item.observationId)walls.add(`${item.buildingId}:${item.sourceSurfaceIndex}:${item.observationId}`);return walls.size;}
(window as any).cityAppearanceDemo={status:()=>({ready:!!active,developmentCandidate:active?.manifest.developmentCandidate===true,releaseId:active?.manifest.releaseId,reviewed:active?.manifest.reviewed,buildings:active?.manifest.buildings,residentBuildings:active?.owners.size,observations:active?.manifest.observations,residentObservations:records().length,stream:active?.stream.status,contextStream:active?.contextStream?.status,displayExtent:active?.displayExtent,facadeWindows:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.windows,0),facadeDoors:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.doors,0),facadeStorefronts:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.storefronts,0),machineSigns:residentMachineSigns(),intervalPaintedWalls:intervalPaintedWalls(),selectionMeshes:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.group.children.filter((mesh:any)=>mesh.userData.runtimeSelection).length,0),contextBridges:[...(active?.contextResources||[])].reduce((n:number,r:ReturnType<typeof createAppearanceContext>)=>n+r.stats.bridges,0),visibleTreeMeshes:visibleTreeMeshes(),residentBuildingGeometryBufferBytes:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.geometryBufferBytes,0),residentBuildingTextureBytes:[...(active?.resources||[])].reduce((n:number,r:ThreeAppearanceResource)=>n+r.stats.textureBytes,0),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuGeometries:renderer.info.memory.geometries,gpuTextures:renderer.info.memory.textures,pixelRatio:adaptivePixelRatio,shadows:renderer.shadowMap.enabled,adaptiveChanges,selectedId,view,refreshing,quizStreet,routePlaying,routeDistance,cameraPosition:camera.position.toArray(),cameraTarget:controls.target.toArray()}),view:setView,frontage:frameFrontage,select:selectBuilding,refresh,quiz:startStreetQuiz,answerQuiz:answerStreetQuiz,buildingStreets:()=>active?[...active.owners].map(([id,owner]:any)=>({id,street:owner.geometry.building.street})):[],route:toggleRoutePlayback,routeAt:setRouteCamera,whenIdle:async()=>{if(active&&streamDirty){const area=cameraArea(active.context);active.stream.update(area);active.contextStream?.update(area);streamDirty=false;}await Promise.all([active?.stream.whenIdle(),active?.contextStream?.whenIdle()]);for(const r of active?.resources||[])r.flush();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));},records,context:()=>active?.context};
if(expansionMode){
  document.title='Da Costa · expansion geometry';document.querySelector('h1')!.innerHTML='A larger piece<br>of Amsterdam.';
  document.querySelector<HTMLElement>('.eyebrow')!.textContent='Amsterdam · source geometry at neighbourhood scale';
  document.querySelector<HTMLElement>('h1 + .muted')!.textContent='Two Amsterdam districts with source buildings, streets, canals and inventory trees.';
  $<HTMLInputElement>('patterns').closest('label')!.hidden=true;
  $('street-quiz').hidden=false;
  $('follow-route').hidden=false;
  $<HTMLInputElement>('machine-preview').checked=false;$<HTMLInputElement>('appearance').checked=false;
  $<HTMLInputElement>('machine-signs').checked=true;$('machine-signs-label').hidden=false;
  $<HTMLInputElement>('appearance').nextElementSibling!.textContent='Audited source-wall coverage';
  $('appearance-copy').textContent='Machine-observed storefronts and shop names are unreviewed. Machine wall colours are optional. The city-wide palette is a deterministic construction-era visualization prior. Switch to audited coverage: green means usable evidence, ochre means partial.';
  for(const id of ['previous-frontage','next-frontage','refresh','review-heading','review-copy'])$(id).hidden=true;
  const evidenceLink=$<HTMLAnchorElement>('evidence-link');evidenceLink.href='./panorama-audit.html';evidenceLink.textContent='See the new street evidence ↗';
  const pipelineLink=$<HTMLAnchorElement>('pipeline-link');pipelineLink.href='./EXPANSION_DEMO_2026-09-10.md';pipelineLink.textContent='What this demo proves';
  $('release-status').textContent='Loading immutable expansion geometry…';$('view-label').textContent='Da Costa expansion · source geometry';
}
else {$<HTMLInputElement>('machine-preview').closest('label')!.hidden=true;$<HTMLInputElement>('labels').closest('label')!.hidden=true;$<HTMLInputElement>('route').closest('label')!.hidden=true;}
void loadRelease().then(()=>{const id=pageParams.get('frontage'),inspect=pageParams.get('inspect');if(id)frameFrontage(id);else{setView('overview');if(inspect){const record=records().find((item:any)=>item.id===inspect);if(record)selectBuilding(record.renderBuildingId||record.buildingId,record.id);}}void checkStatus();}).catch(error=>{$('loading').textContent=String(error);$('loading').classList.add('error');});
