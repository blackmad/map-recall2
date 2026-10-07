/** The live POI Destinations gate, with existing model/kit coverage and requested additions. */
import fs from 'node:fs';
import {CANAL_CITIES} from '../../src/canalRecall/game/cities';
import {isTeachableRouteDestination} from '../../src/canalRecall/game/routeSelection';
import {normaliseAnswer} from '../../src/canalRecall/answerPath';
import {SIGNATURE_MODELS} from '../../src/canalRecall/landmarks/signatureModels';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {KITS} from '../../src/canalRecall/landmarkKits';
import {mergeManualPoiFeatures} from '../../src/canalRecall/game/manualPoiCatalog';

const city=CANAL_CITIES.amsterdam;
const extract=mergeManualPoiFeatures(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json','utf8')));
const km=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>Math.hypot((a.lat-b.lat)*111.32,(a.lng-b.lng)*111.32*Math.cos(a.lat*Math.PI/180));
const seen=new Set(city.curatedPois.map(p=>normaliseAnswer(p.name)));
const extras=extract.flatMap((f:any)=>{
  if(!f.center||!f.name||!isTeachableRouteDestination(f))return[];
  const key=normaliseAnswer(f.name),p={id:`lm-${f.id}`,name:f.name,lat:f.center[0],lng:f.center[1],prominence:f.prominenceScore||0,type:f.type||'landmark'};
  if(seen.has(key)||(!f.manualPoi&&km(p,city.center)>4))return[];
  seen.add(key);return[p];
}).sort((a:any,b:any)=>b.prominence-a.prominence);
const requests=['Silodam','Embassy of the Free Mind','OLVG West','OLVG Oost','A’DAM Tower','Pontsteiger','REM-eiland','Paradiso','Melkweg','Amsterdam Centraal station complex','RAI Amsterdam','Amstel Hotel','Rembrandt Tower','Breitner Tower','Mondriaan Tower','De Piramides','Valley','Viñoly','The Rock','Symphony','World Trade Center Amsterdam','Westergasfabriek','Zuiveringshal','Machinegebouw','Transformatorhuis','Westergastheater','Blauwe Theehuis','Groot Melkhuis','VondelCS','Vondeltuin','Kinderkookkafé','Beest Boulders','Monk Amsterdam','Het Lab','Beta Boulders','Klimmuur Centraal','Mountain Network Amsterdam','Klimhal Amsterdam','Beest Boulders Het Lab','Amsterdam Sloterdijk station','HNK Amsterdam Sloterdijk','Amsta De Poort','Podium Mozaïek','Dorus Theus Brug'];
// VondelCS was the AVROTROS-era name of the current IDFA pavilion, not
// another destination. Cached alias proof: docs/references/vondelcs/alias-coverage.json;
// https://www.grachtenfestival.nl/locatie/vondelparkpaviljoen (2014–2021).
// Sports aliases use the existing researched model names and operator identities;
// proof: docs/references/requested-model-aliases-20261007.json.
const requestedModelAliases:Record<string,string>={'vondelcs':'idfa-pavilion','mountain network amsterdam':'mountain-network','het lab':'beest-het-lab'};
const aliases:Record<string,string>={'central':'centraal-station','nemo':'nemo','palace':'palace-on-the-dam','rijksmuseum':'rijksmuseum','mint':'munttoren-amsterdam','westerkerk':'westerkerk'};
const equivalents:Record<string,string>={
  'national maritime museum':'scheepvaartmuseum','the national maritime museum':'scheepvaartmuseum','het scheepvaartmuseum':'scheepvaartmuseum',
  'the shipping house':'scheepvaarthuis','shipping house':'scheepvaarthuis',
  'co kathedrale basiliek van sint nicolaas':'sint nicolaas','sint franciscus xaveriuskerk':'krijtberg',
  'central station':'centraal','amsterdam centraal':'centraal','mint tower':'munttoren',
  'royal palace':'royal palace','palace on the dam':'royal palace','h art museum':'h art museum',
  'westergastheater':'theater de krakeling','zuiveringshal':'fabrique des lumieres',
};
const canon=(n:string)=>{
  const normalized=normaliseAnswer(n),alias=equivalents[normalized]||normalized;
  return alias.replace(/\b(amsterdam|museum|theater|theatre|cinema|koninklijk|national|royal|science)\b/g,'').replace(/\s+/g,' ').trim();
};
const kits=KITS.map(k=>({name:k.name,key:canon(k.name)}));
function coverage(p:any){
  const featureId=p.id.replace(/^lm-/,'');
  // Missing POI identities must not match an ordinary model's empty landmarkId.
  const aliasId=aliases[p.id];
  const model=SIGNATURE_MODELS.find(m=>(aliasId&&m.id===aliasId)||(featureId&&(m.landmarkId===featureId||m.relatedLandmarkIds?.includes(featureId)))||canon(m.name)===canon(p.name));
  if(model)return {status:MANUAL_LANDMARKS.some(m=>m.id===model.id)?'manual-model':'catalogue-model',modelId:model.id};
  const kit=kits.find(k=>k.key&&k.key===canon(p.name));
  if(kit)return{status:'procedural-kit',kitName:kit.name};
  const source=extract.find((f:any)=>f.id===featureId||normaliseAnswer(f.name)===normaliseAnswer(p.name));
  const building=/museum|kerk|church|theat|bioscoop|cinema|synag|station|bibliotheek|library|gebouw|hotel|paleis|palace|school|toren|tower|winkel|store|embassy|silodam|huis|house/.test(normaliseAnswer(p.name));
  return{status:!building&&source?.type==='park'?'landscape':'pending'};
}
const destinations=[...city.curatedPois,...extras].map((p,i)=>({...p,queueRank:i+1,origin:'POI Destinations',...coverage(p)}));
for(const name of requests){
  const aliasModelId=requestedModelAliases[normaliseAnswer(name)];
  if(aliasModelId){
    const match=destinations.find(p=>(p as any).modelId===aliasModelId);
    if(!match)throw new Error(`Requested alias ${name} has no canonical destination ${aliasModelId}`);
    Object.assign(match,{requested:true,requestedAliases:[...((match as any).requestedAliases||[]),name]});
    continue;
  }
  const match=destinations.find(p=>canon(p.name)===canon(name));
  if(match){(match as any).requested=true;continue;}
  const spec=MANUAL_LANDMARKS.find(s=>canon(s.name)===canon(name)||s.id===normaliseAnswer(name).replaceAll(' ','-'));
  destinations.push({id:spec?.id||`requested-${normaliseAnswer(name).replaceAll(' ','-')}`,name,
    lat:spec?.surveyed?.anchor[1]||spec?.footprint?.centre[1]||null,lng:spec?.surveyed?.anchor[0]||spec?.footprint?.centre[0]||null,
    queueRank:destinations.length+1,origin:'User requested',...coverage({id:spec?.landmarkId||'',name}),requested:true} as any);
}
// Keep every completed original asset reviewable even when the teaching gate
// excludes its POI. Its origin distinguishes it from selectable game destinations.
for (const spec of MANUAL_LANDMARKS) {
  if (destinations.some(p => (p as any).modelId === spec.id)) continue;
  destinations.push({id:spec.id,name:spec.name,
    lat:spec.surveyed?.anchor[1]??spec.footprint?.centre[1]??null,
    lng:spec.surveyed?.anchor[0]??spec.footprint?.centre[0]??null,
    queueRank:destinations.length+1,origin:'Landmark catalogue',
    status:'manual-model',modelId:spec.id} as any);
}
// A destination can describe a whole district, a complex or a small memorial.
// Keep its teaching identity while making the asset task explicit for reviewers.
const treatments:Record<string,{kind:string;note:string}>={
  'dorus theus brug':{kind:'bridge',note:'Confirm the official bridge identity; model the deck, abutments and open water passage rather than a building shell.'},
  'red light district':{kind:'area',note:'Treat the streets and canals as an area; individual buildings have their own queue entries.'},
  'canal ring area of amsterdam':{kind:'area',note:'Treat the canal ensemble; there is no single building to replace.'},
  'amsterdam':{kind:'area',note:'City-wide identity; choose a specific mapped place before authoring geometry.'},
  'chinatown':{kind:'area',note:'Street ensemble; He Hua Temple is already modeled separately.'},
  'artis':{kind:'complex',note:'Preserve the zoo grounds, paths and mapped trees; model entrance and museum buildings individually.'},
  'begijnhof':{kind:'complex',note:'Preserve the open court; English Reformed Church is already modeled separately.'},
  'westergasfabriek':{kind:'complex',note:'Preserve the industrial campus; Gashouder is already modeled separately.'},
  'university of amsterdam':{kind:'complex',note:'Identify the represented campus or historic building before replacing its geometry.'},
  'universiteit van amsterdam':{kind:'complex',note:'Identify the represented campus or historic building before replacing its geometry.'},
  'homomonument':{kind:'memorial',note:'Model the three mapped pink granite triangles and waterside steps.'},
  'de schreeuw':{kind:'memorial',note:'Author the sculpture at its mapped position; retain the surrounding park.'},
  'de dokwerker':{kind:'memorial',note:'Author the statue and plinth at the mapped position.'},
  'auschwitz memorial':{kind:'memorial',note:'Preserve the ground-level memorial and surrounding park.'},
  'monument indie nederland':{kind:'memorial',note:'Model the mapped monument and landscaped setting.'},
  'equestrian statue of queen wilhelmina':{kind:'memorial',note:'Author the horse, rider and pedestal at the mapped position.'},
  'plaquette 7 mei 1945':{kind:'memorial',note:'Use a small mapped wall plaque rather than replacing the host building.'},
};
for(const p of destinations){const task=treatments[normaliseAnswer(p.name)];
  if(task)Object.assign(p,{treatment:task.kind,taskNote:task.note});
  else Object.assign(p,{treatment:p.status==='landscape'?'landscape':p.status==='pending'&&!['museum','cinema','library','music venue'].includes((p as any).type)?'review':'building'});
}
const counts=destinations.reduce((a:any,p)=>{a[p.status]=(a[p.status]||0)+1;return a;},{});
fs.writeFileSync('public/canal-drive/landmark-backlog.json',JSON.stringify({version:1,cityId:'amsterdam',
  generatedBy:'scripts/landmarks/build-poi-backlog.ts',rules:'Same teachable-card gate, 4 km city-centre radius, name deduplication and prominence order as game-route.js. Requested additions and completed original assets may lie outside this pool; their origin records this.',
  statusMeaning:{'manual-model':'Original flat-colour GLB placed in the live game','procedural-kit':'Existing authored procedural landmark geometry','catalogue-model':'Imported reference model in the development gallery; review live-game/licence status before calling complete','pending':'Needs a distinctive building or place treatment','landscape':'A park or outdoor place; landscape pass instead of a single building'},
  discoverySources:[{title:'Arcam architecture guide',url:'https://arcam.nl/architectuur-gids/'},{title:'Amsterdam architectural styles',url:'https://www.iamsterdam.com/en/see-and-do/attractions-and-sights/amsterdams-architectural-style'}],counts,destinations},null,2)+'\n');
console.log(JSON.stringify({destinations:destinations.length,counts,next:destinations.filter(p=>p.status==='pending').slice(0,35).map(p=>p.name)},null,2));
