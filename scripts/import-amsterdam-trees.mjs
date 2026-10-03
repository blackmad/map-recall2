/** Municipal inventory behind maps.amsterdam.nl/bomen; cached, paginated import. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import proj4 from 'proj4';
import {buildOsmSupplement,sourceFiles} from './osm-tree-supplement.mjs';

const cache = '.cache/municipal-trees';
const output = 'public/data/extracts/amsterdam/municipal-trees';
fs.mkdirSync(cache,{recursive:true});
fs.mkdirSync(`${output}/tiles`,{recursive:true});
const RD = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
const fields = 'id,geometrie,soortnaam,soortnaamKort,boomhoogteklasseActueel,jaarVanAanleg,standplaats,typeObject';
const endpoint = `https://api.data.amsterdam.nl/v1/bomen/stamgegevens/?_pageSize=5000&_fields=${fields}`;
export function heightProxy(value) {
  const numbers = String(value || '').match(/\d+(?:[.,]\d+)?/g)?.map(n=>Number(n.replace(',','.'))) || [];
  if (!numbers.length) return null;
  if (numbers.length > 1) return (numbers[0] + numbers[1]) / 2;
  return /tot|</i.test(value) ? numbers[0] : numbers[0] + 3;
}
const tiles = new Map(), ids = new Set();
let page = 1, next = endpoint, rejected = 0, stumps = 0;
while (next) {
  if (page > 100) throw Error('Municipal inventory exceeded expected pagination budget.');
  const file = `${cache}/page-${page}.json`;
  if (!fs.existsSync(file)) execFileSync('curl',['--fail','--location','--retry','3','--max-time','60','--silent','--show-error',next,'-o',file],{stdio:'inherit'});
  const data = JSON.parse(fs.readFileSync(file,'utf8'));
  const records = data._embedded?.stamgegevens;
  if (!Array.isArray(records)) throw Error(`Unexpected tree response on page ${page}`);
  for (const t of records) {
    if (ids.has(t.id)) continue;
    ids.add(t.id);
    if (/^stobbe$/i.test(t.typeObject || '')) {stumps++; continue;}
    if (t.geometrie?.type !== 'Point' || !t.geometrie.coordinates.every(Number.isFinite)) {rejected++; continue;}
    const projected = proj4(RD,'EPSG:4326',t.geometrie.coordinates);
    // Tile identity must use the same rounded coordinates stored in the payload.
    const [lng,lat] = projected.map(value => +value.toFixed(7));
    if (lng < 4.5 || lng > 5.4 || lat < 52.1 || lat > 52.6) {rejected++; continue;}
    const z=15,n=2**z,x=Math.floor((lng+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
    const key=`${z}/${x}/${y}`, tree={id:`ams-${t.id}`,lng:+lng.toFixed(7),lat:+lat.toFixed(7),species:t.soortnaam || '',
      height:heightProxy(t.boomhoogteklasseActueel),heightClass:t.boomhoogteklasseActueel || null,type:t.typeObject || null,
      planted:t.jaarVanAanleg || null,setting:t.standplaats || null};
    if (!tiles.has(key)) tiles.set(key,[]);
    tiles.get(key).push(tree);
  }
  console.log(`Municipal trees: page ${page}, ${ids.size} unique records`);
  next = data._links?.next?.href || null;
  if (next && !next.startsWith('https://api.data.amsterdam.nl/v1/bomen/stamgegevens/')) throw Error('Unexpected pagination host.');
  page++;
}
const municipalTrees=[...tiles.values()].flat();
const supplement=buildOsmSupplement(municipalTrees,sourceFiles());
for(const tree of supplement.trees){
  const x=Math.floor((tree.lng+180)/360*32768),y=Math.floor((1-Math.asinh(Math.tan(tree.lat*Math.PI/180))/Math.PI)/2*32768),key=`15/${x}/${y}`;
  if(!tiles.has(key))tiles.set(key,[]);
  tiles.get(key).push(tree);
}
const list = [];
for (const [key,trees] of tiles) {
  const file = `${key.replaceAll('/','-')}.json.gz`, bytes = gzipSync(JSON.stringify({version:1,key,trees}));
  fs.writeFileSync(path.join(output,'tiles',file),bytes);
  list.push({key,url:`tiles/${file}`,trees:trees.length,bytes:bytes.length});
}
const index={version:1,zoom:15,source:'Gemeente Amsterdam, GISIB municipal tree inventory',sourceUrl:'https://maps.amsterdam.nl/bomen/',
  apiUrl:endpoint,documentationUrl:'https://api.data.amsterdam.nl/v1/docs/datasets/bomen.html',
  licence:'Openbaar, tenzij anders aangegeven / behoudens uitzonderingen',retrievedAt:new Date().toISOString(),
  heightMeaning:'Midpoint of recorded height class; open-ended classes use threshold + 3 m. Crown shape is an authored species prior, not a surveyed crown.',
  sources:{municipal:{trees:municipalTrees.length,licence:'Openbaar, tenzij anders aangegeven / behoudens uitzonderingen',idPrefix:'ams-'},
    osm:{trees:supplement.trees.length,licence:'ODbL',sourceUrl:'https://www.openstreetmap.org/copyright',idPrefix:'osm-n',positionMeaning:'Explicit natural=tree nodes only; no sampled tree rows',heightMeaning:'Recorded OSM height in metres, when parseable; otherwise authored height fallback',...supplement.report}},
  trees:list.reduce((s,t)=>s+t.trees,0),rejected,stumps,tiles:list.sort((a,b)=>a.key.localeCompare(b.key))};
fs.writeFileSync(`${output}/index.json`,JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({trees:index.trees,tiles:list.length,rejected,stumps,bytes:list.reduce((s,t)=>s+t.bytes,0)},null,2));
