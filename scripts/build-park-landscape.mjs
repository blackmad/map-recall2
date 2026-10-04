/** Rebuild from the cached OSM extract: node scripts/build-park-landscape.mjs. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source = process.argv[2] || '.cache/osm-source/Amsterdam.osm.pbf';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'amsterdam-parks-'));
const run = args => execFileSync('osmium', args, {stdio: 'inherit'});
run(['extract', source, '-b', '4.75,52.28,5.03,52.44', '-o', `${work}/area.pbf`]);
run(['tags-filter', `${work}/area.pbf`, 'wr/leisure=park', 'wr/landuse=grass,forest,meadow',
  'wr/natural=wood,water,scrub,grassland,shrubbery', 'wr/landuse=flowerbed',
  'wr/leisure=garden,playground', 'wr/tourism=zoo', 'wr/place=square',
  'wr/highway=footway,path,pedestrian,cycleway', 'n/amenity=bench', '-o', `${work}/detail.pbf`]);
run(['export', `${work}/detail.pbf`, '-u', 'type_id', '-o', `${work}/detail.geojson`]);
const raw = JSON.parse(fs.readFileSync(`${work}/detail.geojson`, 'utf8')).features;
// Extract only the verified existing public reserve, preserving the earlier export's feature order.
run(['getid', `${work}/area.pbf`, 'w545039403', '-r', '-o', `${work}/selected-reserve.pbf`]);
run(['export', `${work}/selected-reserve.pbf`, '-u', 'type_id', '-o', `${work}/selected-reserve.geojson`]);
const reserve=JSON.parse(fs.readFileSync(`${work}/selected-reserve.geojson`)).features.find(f=>f.id==='a1090078806');
if(!reserve)throw Error('Missing verified Lange Bretten reserve boundary');
raw.push(reserve);
const names = ['Vondelpark', 'Oosterpark', 'Sarphatipark', 'Westerpark', 'Erasmuspark',
  'Rembrandtpark', 'Beatrixpark', 'Flevopark', 'Noorderpark', 'Amstelpark', 'Gaasperpark',
  'Wertheimpark','Park Frankendael','Martin Luther Kingpark',
  'Sloterpark','Nelson Mandelapark','Diemerpark','Museumplein','Gerbrandypark',
  'Bijlmerweide','Gijsbrecht van Aemstelpark',"'t Kleine Loopveld",'Amsterdamse Bos','Professor Joop van Stigtpark','Baanakkerspark','W.H. Vliegenbos',
  'Rietlandpark','Darwinplantsoen','Piet Wiedijkpark',
  'Houthavenpark','Bella Vistapark','Park Somerlust','Siegerpark','Eendrachtspark','Schellingwouderpark','Brasapark-Noord','Brasapark-Zuid','Natuurpark Vrije Geer','Park de Schinkeleilanden','De Oeverlanden','Lange Bretten','Spoorpark Noord','Spoorpark Zuid','Oeverpark','Frederik Hendrikplantsoen','Eerste Weteringplantsoen','Bilderdijkpark','Wibautpark'];
const largeParkIds={'Sloterpark':'a974946116','Nelson Mandelapark':'a253205604','Diemerpark':'a26617920',
  'Museumplein':'a51930778','Gerbrandypark':'a12632708','Bijlmerweide':'a1634686926',
  'Gijsbrecht van Aemstelpark':'a14700737',"'t Kleine Loopveld":'a1625964550','Amsterdamse Bos':'a53034066','Professor Joop van Stigtpark':'a1634686930',
  'Baanakkerspark':'a338346296','W.H. Vliegenbos':'a438320562','Rietlandpark':'a1474761438',
  'Darwinplantsoen':'a1090059682','Piet Wiedijkpark':'a1073574284',
  'Houthavenpark':'a1342528732','Bella Vistapark':'a1794310586','Park Somerlust':'a2688775192',
  'Siegerpark':'a560654378','Eendrachtspark':'a870243156','Schellingwouderpark':'a320368258','Brasapark-Noord':'a1992743354','Brasapark-Zuid':'a2765075828','Natuurpark Vrije Geer':'a2076574184','Park de Schinkeleilanden':'a677298638','De Oeverlanden':'a36700791','Lange Bretten':'a1090078806','Spoorpark Noord':'a2590769720','Spoorpark Zuid':'a2617292602','Oeverpark':'a2410062728','Frederik Hendrikplantsoen':['a442057328','a442202462','a442348528'],'Eerste Weteringplantsoen':'a20424078','Bilderdijkpark':'a441772170','Wibautpark':'a19861794'};
// Current municipal public-park pages verify these mapped grounds.
// Spoorpark Midden and the redeveloping Tweede Weteringplantsoen remain excluded; reserve selection is only the exact Lange Bretten ID.
const publicParkIds=new Set(['a1992743354','a2765075828','a2076574184','a677298638','a36700791','a1090078806','a2590769720','a2617292602','a2410062728','a442057328','a442202462','a442348528','a20424078','a441772170','a19861794']);
const polygons = g => g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
function ringArea(r) {
  return Math.abs(r.reduce((a, p, i) => {const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1];}, 0));
}
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const parks = names.flatMap(name => {
  const matches = raw.filter(f => (f.properties.leisure === 'park'||(name==='Lange Bretten'&&f.id==='a1090078806'&&f.properties.leisure==='nature_reserve')) && f.properties.name === name && polygons(f.geometry).length);
  if(largeParkIds[name]){
    const ids=Array.isArray(largeParkIds[name])?largeParkIds[name]:[largeParkIds[name]];
    return ids.map(id=>{const verified=matches.find(f=>f.id===id);
      if(!verified)throw Error(`Missing verified Amsterdam park boundary: ${name} ${id}`);
      return verified;});
  }
  // Several parks have duplicate relation/way boundaries. Keep the largest boundary.
  matches.sort((a,b) => polygons(b.geometry).reduce((s,p)=>s+ringArea(p[0]),0) - polygons(a.geometry).reduce((s,p)=>s+ringArea(p[0]),0));
  // MLKpark has two distinct mapped grounds, separated by the Utrechtsebrug.
  return name==='Martin Luther Kingpark'?matches:matches.slice(0,1);
});
const botanicalNames=['Hortus Botanicus','Artis'];
for(const name of botanicalNames){
  const boundary=raw.find(f=>f.properties.name===name&&polygons(f.geometry).length
    &&(name==='Artis'?f.properties.tourism==='zoo':f.properties['garden:type']==='botanical'));
  if(!boundary)throw Error(`Missing mapped botanical/zoo boundary: ${name}`);
  parks.push(boundary);
}
const square=raw.find(f=>f.properties.name==='Rembrandtplein'&&f.properties.place==='square'&&polygons(f.geometry).length);
if(!square)throw Error('Missing mapped Rembrandtplein square boundary');
parks.push(square);
const contains = (park, p) => polygons(park.geometry).some(poly => inRing(p, poly[0]) && !poly.slice(1).some(h => inRing(p,h)));
const features = [], optionalFeatures = [], counts = {}, seenShapes=new Set();let duplicateShapesSkipped=0;
function emit(id, geometry, role, park, extra = {}) {
  const key=g=>`${role}:${JSON.stringify(g)}`;
  if(largeParkIds[park.properties.name]){
    if(geometry.type==='MultiPolygon'){
      const unique=geometry.coordinates.filter(poly=>!seenShapes.has(key({type:'Polygon',coordinates:poly})));
      duplicateShapesSkipped+=geometry.coordinates.length-unique.length;
      if(!unique.length)return;
      geometry={type:'MultiPolygon',coordinates:unique};
    }else if(seenShapes.has(key(geometry))){duplicateShapesSkipped++;return;}
  }
  if(geometry.type==='MultiPolygon')for(const poly of geometry.coordinates)seenShapes.add(key({type:'Polygon',coordinates:poly}));
  else seenShapes.add(key(geometry));
  (park.properties.name==='Amsterdamse Bos'?optionalFeatures:features).push({type:'Feature', id, geometry, properties:{role, park:park.properties.name, ...extra}});
  counts[role] = (counts[role] || 0) + 1;
}
for (const park of parks) {
  const botanical=botanicalNames.includes(park.properties.name)||park===square;
  // A zoo/garden boundary includes halls, enclosures and paved courts. Keep
  // their existing basemap surfaces; colour only explicitly mapped interiors.
  if(largeParkIds[park.properties.name])emit(park.id,park.geometry,'park-boundary',park);
  else if(!botanical)emit(park.id, park.geometry, 'park', park);
  for (const f of raw) {
    const p = f.properties, g = f.geometry;
    if (f === park || p.leisure === 'park') continue;
    // Preserve private access and allotment interiors instead of repainting them as public park.
    if(publicParkIds.has(park.id)&&(p.landuse==='allotments'||['private','no'].includes(p.access)))continue;
    const role = p.natural === 'water' ? 'water' : p.natural === 'wood' || p.landuse === 'forest' ? 'wood'
      : p.natural === 'scrub' ? 'scrub' : p.leisure === 'garden' ? 'garden'
      : botanical&&p.natural==='shrubbery'?'scrub':botanical&&p.landuse==='flowerbed'?'garden'
      : p.leisure === 'playground' ? 'playground' : ['grass','meadow'].includes(p.landuse) || p.natural === 'grassland' ? 'lawn' : null;
    if (role && polygons(g).length) {
      const inside = polygons(g).filter(poly => poly[0].every(v => contains(park,v)));
      if (inside.length) emit(`${park.id}-${f.id}`, {type:'MultiPolygon', coordinates:inside}, role, park);
    }
    if (g.type === 'LineString' && ['footway','path','pedestrian','cycleway'].includes(p.highway) && p.area !== 'yes' && !p.tunnel) {
      let segment = [], n = 0;
      const flush = () => {if (segment.length > 1) emit(`${park.id}-${f.id}-${n++}`, {type:'LineString',coordinates:segment}, 'path', park,
        {width: Math.min(6, Math.max(1, Number.parseFloat(p.width) || (p.highway === 'cycleway' ? 3 : 2.2))), paved:['asphalt','paving_stones','concrete'].includes(p.surface)}); segment = [];};
      for (const v of g.coordinates) {if (contains(park,v)) segment.push(v); else flush();} flush();
    }
    if (g.type === 'Point' && p.amenity === 'bench' && contains(park,g.coordinates)) {
      const [lng,lat] = g.coordinates, bearing = Number.parseFloat(p.direction);
      const angle = (Number.isFinite(bearing) ? bearing : 0) * Math.PI / 180;
      const ring = (depth, offset) => [...[[-.85,-depth/2],[.85,-depth/2],[.85,depth/2],[-.85,depth/2],[-.85,-depth/2]]].map(([x,y]) => {
        y += offset;
        return [lng + (x*Math.cos(angle)-y*Math.sin(angle))/(111320*Math.cos(lat*Math.PI/180)),lat+(x*Math.sin(angle)+y*Math.cos(angle))/111320];
      });
      emit(`${park.id}-${f.id}-seat`, {type:'Polygon',coordinates:[ring(.5,0)]}, 'bench', park, {base:.4,height:.54});
      emit(`${park.id}-${f.id}-back`, {type:'Polygon',coordinates:[ring(.12,-.24)]}, 'bench', park, {base:.45,height:.95});
    }
  }
}
// Exact mapped pedestrian paving, including all five source exclusion holes.
// Its concave outer boundary leaves Westerkerk and surrounding roads outside.
const paved=raw.find(f=>f.id==='a26263809'&&f.properties.highway==='pedestrian'
  &&f.properties.surface==='sett'&&polygons(f.geometry).length);
if(!paved)throw Error('Missing mapped Westermarkt paving relation r13131904');
emit(paved.id,paved.geometry,'paved-area',paved,{surface:'sett',sourceOsmId:'r13131904'});
const result = {type:'FeatureCollection', attribution:'© OpenStreetMap contributors, ODbL',
  source:'Cached Amsterdam OSM extract; mapped geometry only. No synthetic water, paths or trees.',
  botanicalGrounds:parks.filter(f=>botanicalNames.includes(f.properties.name)).map(f=>({id:f.id,name:f.properties.name,baseFill:false})),features};
result.squares=[{id:square.id,name:square.properties.name,baseFill:false}];
result.pavedSquares=[{id:paved.id,name:paved.properties.name,sourceOsmId:'r13131904',surface:'sett'}];
result.interiorOnlyParks=parks.filter(f=>largeParkIds[f.properties.name]&&f.properties.name!=='Amsterdamse Bos').map(f=>({id:f.id,name:f.properties.name,baseFill:false}));
const compactParkSources={"Oeverpark": "https://assets.amsterdam.nl/publish/pages/1081786/locatieprofielen_evenementen_1_.pdf", "Frederik Hendrikplantsoen": "https://www.santenco.nl/portfolio_page/fredrik-hendrikplantsoen-amsterdam/", "Eerste Weteringplantsoen": "https://www.amsterdam.nl/projecten/weteringpark/", "Bilderdijkpark": "https://www.amsterdam.nl/nieuws/achtergrond/amsterdams-parkgenot/", "Wibautpark": "https://www.wibautpark.nl/onewebmedia/FACTSHEET%20VERENIGING%20VRIENDEN%20VAN%20HET%20WIBAUTPLANTSOEN.pdf"};
result.publicParkGrounds=parks.filter(p=>publicParkIds.has(p.id)).map(p=>({id:p.id,name:p.properties.name,baseFill:false,sourceUrl:compactParkSources[p.properties.name]?compactParkSources[p.properties.name]:p.properties.name.startsWith('Brasapark')?'https://www.amsterdam.nl/leefomgeving/parken-recreatiegebieden/brasapark/':p.properties.name.startsWith('Spoorpark')?'https://www.amsterdam.nl/projecten/overtoomse-veld/':p.properties.name==='Lange Bretten'?'https://www.amsterdam.nl/projecten/bretten/':`https://www.amsterdam.nl/leefomgeving/parken-recreatiegebieden/${({'Natuurpark Vrije Geer':'vrije-geer','Park de Schinkeleilanden':'park-schinkeleilanden','De Oeverlanden':'oeverlanden'})[p.properties.name]}/`}));
const out = 'public/data/extracts/amsterdam/park-landscape.geojson';
const bos=parks.find(f=>f.properties.name==='Amsterdamse Bos');
const points=polygons(bos.geometry).flat(2);
const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
result.optionalChunks=[{id:'amsterdamse-bos',url:'park-landscape-bos.geojson',bounds,minzoom:15,features:optionalFeatures.length}];
const optional={type:'FeatureCollection',attribution:result.attribution,source:result.source,interiorOnlyParks:[{id:bos.id,name:bos.properties.name,baseFill:false}],features:optionalFeatures};
fs.writeFileSync('public/data/extracts/amsterdam/park-landscape-bos.geojson',JSON.stringify(optional));
fs.writeFileSync(out,JSON.stringify(result));
console.log(JSON.stringify({parks:parks.map(f=>f.properties.name),counts,duplicateShapesSkipped,bytes:fs.statSync(out).size},null,2));
