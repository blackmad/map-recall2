/** Recover unnamed bridges and pedestrian approaches from the cached OSM extract. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lngLatToRd} from '../../src/canalRecall/rdCoordinates.ts';
const source='.cache/osm-source/Amsterdam.osm.pbf',stem='.cache/bridge-surfaces/source-paths';
execFileSync('osmium',['tags-filter',source,'w/bridge','w/highway=footway,path,steps,pedestrian','-o',stem+'.osm.pbf','--overwrite']);
execFileSync('osmium',['export',stem+'.osm.pbf','--add-unique-id=type_id','-o',stem+'.geojson','--overwrite']);
const register=JSON.parse(await readFile('scripts/data/amsterdam-bridge-register.json','utf8'));
const cells=new Set<string>();
for(const row of register.bridges){const points=row[7].map((p:[number,number])=>lngLatToRd(...p)),xs=points.map((p:number[])=>p[0]),ys=points.map((p:number[])=>p[1]);
  for(let x=Math.floor((Math.min(...xs)-40)/100);x<=Math.floor((Math.max(...xs)+40)/100);x++)for(let y=Math.floor((Math.min(...ys)-40)/100);y<=Math.floor((Math.max(...ys)+40)/100);y++)cells.add(`${x},${y}`);
}
const raw=JSON.parse(await readFile(stem+'.geojson','utf8'));
const paths=raw.features.filter((f:any)=>f.geometry.type==='LineString'&&f.properties.highway&&f.geometry.coordinates.some((p:[number,number])=>{const rd=lngLatToRd(...p);return cells.has(`${Math.floor(rd[0]/100)},${Math.floor(rd[1]/100)}`);})).map((f:any)=>({
  id:f.id,name:f.properties.name||'',highway:f.properties.highway,bridge:!!f.properties.bridge&&!['no','false','0'].includes(f.properties.bridge),tunnel:!!f.properties.tunnel&&f.properties.tunnel!=='no',
  source:'osm-all-bridge-paths',path:f.geometry.coordinates.map(([lng,lat]:number[])=>[lat,lng]),
}));
await writeFile('scripts/data/amsterdam-bridge-paths.json',JSON.stringify({source,sha256:createHash('sha256').update(await readFile(source)).digest('hex'),method:'osmium bridge and pedestrian ways, municipal footprint neighbourhoods',paths})+'\n');
console.log(`${paths.length} source paths, ${paths.filter((r:any)=>r.bridge).length} bridge ways`);
