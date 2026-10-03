/** The live POI Destinations gate, with existing model/kit coverage and requested additions. */
import fs from 'node:fs';
import {CANAL_CITIES} from '../../src/canalRecall/game/cities';
import {isTeachableRouteDestination} from '../../src/canalRecall/game/routeSelection';
import {normaliseAnswer} from '../../src/canalRecall/answerPath';
import {SIGNATURE_MODELS} from '../../src/canalRecall/landmarks/signatureModels';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {KITS} from '../../src/canalRecall/landmarkKits';

const city=CANAL_CITIES.amsterdam;
const extract=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json','utf8'));
const km=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>Math.hypot((a.lat-b.lat)*111.32,(a.lng-b.lng)*111.32*Math.cos(a.lat*Math.PI/180));
const seen=new Set(city.curatedPois.map(p=>normaliseAnswer(p.name)));
const extras=extract.flatMap((f:any)=>{
  if(!f.center||!f.name||!isTeachableRouteDestination(f))return[];
  const key=normaliseAnswer(f.name),p={id:`lm-${f.id}`,name:f.name,lat:f.center[0],lng:f.center[1],prominence:f.prominenceScore||0,type:f.type||'landmark'};
  if(seen.has(key)||km(p,city.center)>4)return[];
  seen.add(key);return[p];
}).sort((a:any,b:any)=>b.prominence-a.prominence);
const requests=['Silodam','Embassy of the Free Mind','OLVG West','OLVG Oost','A’DAM Tower','Pontsteiger','REM-eiland','Paradiso','Melkweg'];
const aliases:Record<string,string>={'central':'centraal-station','nemo':'nemo','palace':'palace-on-the-dam','rijksmuseum':'rijksmuseum','mint':'munttoren-amsterdam','westerkerk':'westerkerk'};
const equivalents:Record<string,string>={
  'national maritime museum':'scheepvaartmuseum','het scheepvaartmuseum':'scheepvaartmuseum',
  'co kathedrale basiliek van sint nicolaas':'sint nicolaas','sint franciscus xaveriuskerk':'krijtberg',
  'central station':'centraal','amsterdam centraal':'centraal','mint tower':'munttoren',
  'royal palace':'royal palace','palace on the dam':'royal palace','h art museum':'h art museum',
};
const canon=(n:string)=>{
  const normalized=normaliseAnswer(n),alias=equivalents[normalized]||normalized;
  return alias.replace(/\b(amsterdam|museum|theater|theatre|cinema|koninklijk|national|royal|science)\b/g,'').replace(/\s+/g,' ').trim();
};
const kits=KITS.map(k=>({name:k.name,key:canon(k.name)}));
function coverage(p:any){
  const featureId=p.id.replace(/^lm-/,'');
  const model=SIGNATURE_MODELS.find(m=>m.id===aliases[p.id]||m.landmarkId===featureId||m.relatedLandmarkIds?.includes(featureId)||canon(m.name)===canon(p.name));
  if(model)return {status:MANUAL_LANDMARKS.some(m=>m.id===model.id)?'manual-model':'catalogue-model',modelId:model.id};
  const kit=kits.find(k=>k.key&&k.key===canon(p.name));
  if(kit)return{status:'procedural-kit',kitName:kit.name};
  const source=extract.find((f:any)=>f.id===featureId||normaliseAnswer(f.name)===normaliseAnswer(p.name));
  const building=/museum|kerk|church|theat|bioscoop|cinema|synag|station|bibliotheek|library|gebouw|hotel|paleis|palace|school|toren|tower|winkel|store|embassy|silodam|huis|house/.test(normaliseAnswer(p.name));
  return{status:!building&&source?.type==='park'?'landscape':'pending'};
}
const destinations=[...city.curatedPois,...extras].map((p,i)=>({...p,queueRank:i+1,origin:'POI Destinations',...coverage(p)}));
for(const name of requests){
  const match=destinations.find(p=>canon(p.name)===canon(name));
  if(match){(match as any).requested=true;continue;}
  const spec=MANUAL_LANDMARKS.find(s=>canon(s.name)===canon(name)||s.id===normaliseAnswer(name).replaceAll(' ','-'));
  destinations.push({id:spec?.id||`requested-${normaliseAnswer(name).replaceAll(' ','-')}`,name,
    lat:spec?.surveyed?.anchor[1]||spec?.footprint?.centre[1]||null,lng:spec?.surveyed?.anchor[0]||spec?.footprint?.centre[0]||null,
    queueRank:destinations.length+1,origin:'User requested',...coverage({id:spec?.landmarkId||'',name}),requested:true} as any);
}
const counts=destinations.reduce((a:any,p)=>{a[p.status]=(a[p.status]||0)+1;return a;},{});
fs.writeFileSync('public/canal-drive/landmark-backlog.json',JSON.stringify({version:1,cityId:'amsterdam',
  generatedBy:'scripts/landmarks/build-poi-backlog.ts',rules:'Same teachable-card gate, 4 km city-centre radius, name deduplication and prominence order as game-route.js. Requested additions may lie outside this pool.',
  statusMeaning:{'manual-model':'Original flat-colour GLB placed in the live game','procedural-kit':'Existing authored procedural landmark geometry','catalogue-model':'Imported reference model in the development gallery; review live-game/licence status before calling complete','pending':'Needs a distinctive building or place treatment','landscape':'A park or outdoor place; landscape pass instead of a single building'},
  discoverySources:[{title:'Arcam architecture guide',url:'https://arcam.nl/architectuur-gids/'},{title:'Amsterdam architectural styles',url:'https://www.iamsterdam.com/en/see-and-do/attractions-and-sights/amsterdams-architectural-style'}],counts,destinations},null,2)+'\n');
console.log(JSON.stringify({destinations:destinations.length,counts,next:destinations.filter(p=>p.status==='pending').slice(0,35).map(p=>p.name)},null,2));
