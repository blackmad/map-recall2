/** Opt-in laboratory. No default-game appearance or source measurements change. */
import {WALL_MATERIALS,createWallMaterialSprite,type WallMaterialId} from './wallMaterialLibrary.js';
declare global { interface Window { wallMaterialDemo:any; maplibregl:any } }
const $=(id:string)=>document.getElementById(id)!;
const iframe=$('game') as HTMLIFrameElement;
const light={anchor:'map',color:'#ffffff',intensity:.18,position:[1.25,210,42]};
const spriteRatio=32; // Experimental scale, validated at gameplay zooms before acceptance.
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const material=(id:string)=>WALL_MATERIALS.find(m=>m.id===id)!;
async function main(){
 const response=await fetch('/data/wall-materials/assignments.json');if(!response.ok)throw Error('Material assignments unavailable');const data=await response.json();
 const colourResponse=await fetch('/data/wall-materials/colour-trials.json');if(!colourResponse.ok)throw Error('Colour trial assignments unavailable');const colourTrials=await colourResponse.json();
 for(const trial of colourTrials.entries){const e=data.entries[trial.index];if(!e||e.buildingId!==trial.buildingId||e.sourceSha256!==trial.sourceSha256||e.materialId!==trial.baseMaterialId||!data.gate.includes(e.index)||material(e.materialId).materialFamily!==material(trial.renderMaterialId)?.materialFamily)throw Error('Invalid colour trial source binding');e.renderMaterialId=trial.renderMaterialId;e.colourTrial=trial;}
 const entries=data.entries;let selected=0,mode='preview',oblique=false,isolated=false,v:any,m:any,originalLight:any,libraryMap:any;
 const eligible=entries.filter((e:any)=>data.gate.includes(e.index)&&e.materialId!=='unknownneutral');
 const ids=eligible.map((e:any)=>`NL.IMBAG.Pand.${e.buildingId}`);
 const selector=$('owner') as HTMLSelectElement;for(const e of entries){const o=document.createElement('option');o.value=String(e.index);o.textContent=`${e.index+1}. ${e.address}${data.gate.includes(e.index)?' · trial':''}`;selector.append(o);}
 const addSprites=(map:any)=>{for(const p of WALL_MATERIALS){const id=`wall-trial-${p.id}`;if(!map.hasImage(id))map.addImage(id,createWallMaterialSprite(p.id),{pixelRatio:spriteRatio});}};
 const buildingLayers=['osm-colored-buildings','osm-colored-building-ground-floors','osm-colored-building-roofs'];
 const baseFilters=new Map<string,any>();
 const selectedId=()=>`NL.IMBAG.Pand.${entries[selected].buildingId}`;
 const rememberBaseFilters=()=>{for(const layer of buildingLayers)baseFilters.set(layer,m.getFilter(layer));};
 const composeFilter=(base:any,clauses:any[])=>clauses.length?['all',...(base?[base]:[]),...clauses]:base;
 // The vector-map refresh owns the normal filters.  Capture its fresh result
 // first, then add this demo's reversible trial/isolation clauses once.
 const applyFilters=()=>{for(const layer of buildingLayers){const clauses:any[]=[];
   // In preview the trial layer is the only selected owner.  The original
   // extrusion layers get the exact-owner clause too, followed by their normal
   // trial exclusion, leaving no neighbouring building extrusion behind it.
   if(isolated)clauses.push(['==',['get','id'],selectedId()]);
   if(mode==='preview')clauses.push(['!', ['in',['get','id'],['literal',ids]]]);
   m.setFilter(layer,composeFilter(baseFilters.get(layer),clauses));
  }
  const eligibleFilter=['in',['get','id'],['literal',ids]];
  const trialFilter=isolated?['all',eligibleFilter,['==',['get','id'],selectedId()]]:eligibleFilter;
  m.setFilter('wall-material-trial',trialFilter);m.setFilter('wall-material-trial-caps',trialFilter);
 };
 const studyRenderers=()=>['_studyRoofAreas','_studyFacadeAreas','_studyTreeAreas','_studyPublicRealmAreas'].flatMap(key=>Array.isArray(v?.[key])?v[key]:[]);
 const setStudyRenderers=(enabled:boolean)=>{for(const renderer of studyRenderers())if(renderer?.enabled!==enabled)renderer.setEnabled(enabled);};
 const apply=()=>{if(!m)return;const on=mode==='preview';v._refreshColoredBuildingFilter();
  m.setLayoutProperty('wall-material-trial','visibility',on?'visible':'none');m.setLayoutProperty('wall-material-trial-caps','visibility',on?'visible':'none');m.setLight(on?light:originalLight);
  $('current').setAttribute('aria-pressed',String(!on));$('preview').setAttribute('aria-pressed',String(on));
  $('isolate').setAttribute('aria-pressed',String(isolated));$('isolate').textContent=isolated?'Exit isolated owner':'Isolate selected owner';
 };
 const show=async(index:number,angle=oblique,preserveCamera=false)=>{
  selected=index;oblique=angle;selector.value=String(index);const e=entries[index],p=material(e.renderMaterialId??e.materialId);
  ($('reference') as HTMLImageElement).src=e.crop;($('source') as HTMLAnchorElement).href=e.crop;$('address').textContent=e.address;
  $('material').textContent=`${p.label} · ${e.assessment.confidence} confidence · ${e.assessment.texture.pattern}`;
  $('reason').textContent=e.assessment.reason+(e.colourTrial?' Colour variant trial: '+e.colourTrial.reason:'');$('uncertainty').textContent=e.assessment.uncertainty??e.assessment.texture.notes;
  $('badge').textContent=e.materialId==='unknownneutral'?'Material unresolved — existing appearance retained':data.gate.includes(index)?'Rendering trial — visual acceptance pending':'Reference assessed — renderer trial not yet expanded';
  if(!v)return;
  const view=preserveCamera?{center:m.getCenter().toArray(),zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing()}:{center:e.center,zoom:Math.max(18,Math.min(19.35,19.35-Math.log2(Math.max(1,e.height/18,e.width/15))))-(angle?.25:0),pitch:55,bearing:e.bearing+(angle?30:0)};
  if(!preserveCamera)m.jumpTo(view);v._completeCity.followCamera();apply();
  const deadline=performance.now()+20000;while(performance.now()<deadline){const f=v._completeCity.sampleFeatures(10000).find((f:any)=>f.properties.id===`NL.IMBAG.Pand.${e.buildingId}`);if(f&&m.isSourceLoaded('osm-building-appearance'))break;await sleep(100);}
  await sleep(500);apply();m.triggerRepaint();await new Promise<void>(resolve=>m.once('render',()=>resolve()));
  $('status').textContent=`${isolated?'Diagnostic isolation — exact BAG owner only; custom detail streams disabled':'Normal district view'} · ${mode==='preview'?'Shared materials + neutral diffuse light':'Current game materials + original light'} · ${e.address} · ${angle?'oblique':'front'} · source ${e.sourceSha256.slice(0,10)}`;
  return{index,mode,isolated,view,material:e.materialId,renderMaterial:e.renderMaterialId??e.materialId,rendered:eligible.some((x:any)=>x.index===index),sourceSha256:e.sourceSha256};
 };
 selector.onchange=()=>void show(Number(selector.value),oblique);$('previous').onclick=()=>void show((selected+99)%100,oblique);$('next').onclick=()=>void show((selected+1)%100,oblique);
 $('current').onclick=()=>{mode='current';void show(selected,oblique);};$('preview').onclick=()=>{mode='preview';void show(selected,oblique);};$('angle').onclick=()=>void show(selected,!oblique);
 $('gallery').onclick=()=>{const open=$('library').classList.toggle('open');if(!open)return;if(libraryMap){libraryMap.resize();return;}
  const features=WALL_MATERIALS.map((p,i)=>{const x=4.873+(i%4)*.0003,y=52.372-Math.floor(i/4)*.00023;return{type:'Feature',properties:{material:p.id},geometry:{type:'Polygon',coordinates:[[[x,y],[x+.00017,y],[x+.00017,y+.0001],[x,y+.0001],[x,y]]]}};});
  libraryMap=new window.maplibregl.Map({container:'library-map',style:{version:8,sources:{blocks:{type:'geojson',data:{type:'FeatureCollection',features}}},layers:[{id:'background',type:'background',paint:{'background-color':'#e7e7dd'}}]},center:[4.8735,52.37185],zoom:18.9,pitch:55,bearing:-20,attributionControl:false});
  libraryMap.on('load',()=>{addSprites(libraryMap);libraryMap.setLight(light);libraryMap.addLayer({id:'materials',source:'blocks',type:'fill-extrusion',paint:{'fill-extrusion-height':12,'fill-extrusion-base':0,'fill-extrusion-pattern':['concat','wall-trial-',['get','material']],'fill-extrusion-vertical-gradient':false}});});
  for(const p of WALL_MATERIALS){const figure=document.createElement('figure'),canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!,sprite=createWallMaterialSprite(p.id);const pixels=ctx.createImageData(128,128);pixels.data.set(sprite.data);ctx.putImageData(pixels,0,0);const label=document.createElement('figcaption');label.textContent=p.label;figure.append(canvas,label);$('swatches').append(figure);}
 };
 await show(0);
 const deadline=performance.now()+120000;while(performance.now()<deadline){const w=iframe.contentWindow as any;const form=w?.document?.querySelector('#route-card');if(form&&w.canalRecallGame){w.document.querySelector('[data-choice="route:study"]').click();form.requestSubmit();break;}await sleep(200);}
 while(performance.now()<deadline){const w=iframe.contentWindow as any;v=w?.canalRecallGame?.vectorMap;if(v?.map?.getLayer('osm-colored-buildings')&&w.canalRecallGame.state===w.eval('GameState.RACING'))break;await sleep(200);}
 if(!v?.map?.getLayer('osm-colored-buildings'))throw Error('Game failed to boot');m=v.map;v.sync=()=>{};originalLight=m.getLight();addSprites(m);
 m.addLayer({id:'wall-material-trial',source:'osm-building-appearance',type:'fill-extrusion',minzoom:14,filter:['in',['get','id'],['literal',ids]],paint:{'fill-extrusion-height':m.getPaintProperty('osm-colored-buildings','fill-extrusion-height'),'fill-extrusion-base':['coalesce',['get','minHeight'],0],'fill-extrusion-pattern':['match',['get','id'],...eligible.flatMap((e:any)=>[`NL.IMBAG.Pand.${e.buildingId}`,`wall-trial-${e.renderMaterialId??e.materialId}`]),'wall-trial-unknownneutral'],'fill-extrusion-vertical-gradient':false}},'osm-colored-building-roofs');
 const top=m.getPaintProperty('osm-colored-buildings','fill-extrusion-height');
 m.addLayer({id:'wall-material-trial-caps',source:'osm-building-appearance',type:'fill-extrusion',minzoom:14,filter:['in',['get','id'],['literal',ids]],paint:{'fill-extrusion-base':['+',top,.025],'fill-extrusion-height':['+',top,.05],'fill-extrusion-color':['to-color',['get','roofColour'],'#77736c'],'fill-extrusion-vertical-gradient':false}},'osm-colored-building-roofs');
 const highlight=new Uint8Array(16*16*4);for(let i=0;i<highlight.length;i+=4){highlight[i]=255;highlight[i+2]=255;highlight[i+3]=255;}m.addImage('wall-trial-identity',{width:16,height:16,data:highlight});
 const trialPattern=m.getPaintProperty('wall-material-trial','fill-extrusion-pattern'),wallPaint=m.getPaintProperty('osm-colored-buildings','fill-extrusion-color');
 const identity=async(on:boolean)=>{const id=`NL.IMBAG.Pand.${entries[selected].buildingId}`;m.setPaintProperty('wall-material-trial','fill-extrusion-pattern',on?['case',['==',['get','id'],id],'wall-trial-identity',trialPattern]:trialPattern);m.setPaintProperty('osm-colored-buildings','fill-extrusion-color',on?['case',['==',['get','id'],id],'#ff00ff',wallPaint]:wallPaint);m.triggerRepaint();await sleep(350);};
 const refresh=v._refreshColoredBuildingFilter.bind(v);v._refreshColoredBuildingFilter=()=>{refresh();rememberBaseFilters();applyFilters();};
 const updateResidency=v._updateStudyAreaResidency.bind(v);v._updateStudyAreaResidency=()=>{if(isolated){setStudyRenderers(false);return;}updateResidency();};
 const setIsolation=async(value:boolean)=>{isolated=Boolean(value);if(isolated)setStudyRenderers(false);else v._updateStudyAreaResidency();return show(selected,oblique,true);};
 $('isolate').onclick=()=>void setIsolation(!isolated);
 window.wallMaterialDemo={identity,data,colourTrials,ready:false,map:m,vectorMap:v,show,setIsolation,setMode:async(value:string)=>{mode=value;return show(selected,oblique);},state:()=>({selected,mode,oblique,isolated,eligible:ids.length,spriteRatio}),light};
 const params=new URLSearchParams(location.search),requested=Number(params.get('owner')??0);await show(Number.isInteger(requested)&&requested>=0&&requested<entries.length?requested:0);if(params.get('isolated')==='1')await setIsolation(true);window.wallMaterialDemo.ready=true;
}
main().catch(error=>{$('status').textContent=`Preview unavailable: ${String(error)}`;console.error(error);});
