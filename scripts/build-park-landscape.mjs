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
const names = ['Vondelpark', 'Oosterpark', 'Sarphatipark', 'Westerpark', 'Erasmuspark',
  'Rembrandtpark', 'Beatrixpark', 'Flevopark', 'Noorderpark', 'Amstelpark', 'Gaasperpark',
  'Wertheimpark','Park Frankendael','Martin Luther Kingpark',
  'Sloterpark','Nelson Mandelapark','Diemerpark','Museumplein','Gerbrandypark',
  'Bijlmerweide','Gijsbrecht van Aemstelpark',"'t Kleine Loopveld"];
const largeParkIds={'Sloterpark':'a974946116','Nelson Mandelapark':'a253205604','Diemerpark':'a26617920',
  'Museumplein':'a51930778','Gerbrandypark':'a12632708','Bijlmerweide':'a1634686926',
  'Gijsbrecht van Aemstelpark':'a14700737',"'t Kleine Loopveld":'a1625964550'};
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
  const matches = raw.filter(f => f.properties.leisure === 'park' && f.properties.name === name && polygons(f.geometry).length);
  if(largeParkIds[name]){
    const verified=matches.find(f=>f.id===largeParkIds[name]);
    if(!verified)throw Error(`Missing verified Amsterdam park boundary: ${name}`);
    return [verified];
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
const features = [], counts = {}, seenShapes=new Set();let duplicateShapesSkipped=0;
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
  features.push({type:'Feature', id, geometry, properties:{role, park:park.properties.name, ...extra}});
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
result.interiorOnlyParks=parks.filter(f=>largeParkIds[f.properties.name]).map(f=>({id:f.id,name:f.properties.name,baseFill:false}));
const out = 'public/data/extracts/amsterdam/park-landscape.geojson';
fs.writeFileSync(out,JSON.stringify(result));
console.log(JSON.stringify({parks:parks.map(f=>f.properties.name),counts,duplicateShapesSkipped,bytes:fs.statSync(out).size},null,2));
