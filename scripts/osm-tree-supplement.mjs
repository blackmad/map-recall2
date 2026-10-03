/** Explicit OSM node supplement. No row sampling or invented tree positions. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

export const DEDUP_METRES=12;
// Local equirectangular metric used by the coverage audit; longitude scale
// approximates Amsterdam at 52.37°N; a conservative 12 m cutoff absorbs
// the small local projection variation and source georeferencing differences.
export const treeMetres=([lng,lat])=>[lng*67900,lat*111320];
export function municipalGrid(trees){
  const grid=new Map();
  for(const t of trees){const p=treeMetres([t.lng,t.lat]),key=`${Math.floor(p[0]/20)},${Math.floor(p[1]/20)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
  return grid;
}
export function nearMunicipal(coords,grid){
  const p=treeMetres(coords),cx=Math.floor(p[0]/20),cy=Math.floor(p[1]/20);
  for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const q of grid.get(`${x},${y}`)||[])if(Math.hypot(q[0]-p[0],q[1]-p[1])<=DEDUP_METRES)return true;
  return false;
}
const inRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
export const inBoundary=(p,g)=>g.coordinates.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(r=>inRing(p,r)));
export function osmHeight(value){
  const match=String(value??'').trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:m)?$/i);
  const h=match?Number(match[1].replace(',','.')):NaN;
  return h>0&&h<=60?h:null;
}
export function sourceFiles(){
  const cache='.cache/municipal-trees';
  for(const [stem,filters]of [['osm-explicit-trees',['n/natural=tree']],['osm-amsterdam-boundary',['r/boundary=administrative']]]){
    const file=`${cache}/${stem}.geojson`;
    if(!fs.existsSync(file)){
      execFileSync('osmium',['tags-filter','.cache/osm-source/Amsterdam.osm.pbf',...filters,'-o',`${cache}/${stem}.osm.pbf`,'--overwrite']);
      execFileSync('osmium',['export',`${cache}/${stem}.osm.pbf`,'--add-unique-id=type_id','-o',file,'--overwrite']);
    }
  }
  return {nodes:JSON.parse(fs.readFileSync(`${cache}/osm-explicit-trees.geojson`)).features,
    boundary:JSON.parse(fs.readFileSync(`${cache}/osm-amsterdam-boundary.geojson`)).features.find(f=>f.id==='a95623'&&f.properties.name==='Amsterdam'&&f.properties.admin_level==='8'&&f.geometry.type==='MultiPolygon')};
}
export function buildOsmSupplement(municipal,{nodes,boundary}){
  if(!boundary)throw Error('Verified Amsterdam municipality boundary r47811 missing');
  const grid=municipalGrid(municipal),trees=[],seen=new Set();let inside=0,duplicates=0;
  for(const f of nodes){
    if(f.geometry?.type!=='Point'||f.properties?.natural!=='tree'||!/^n\d+$/.test(f.id)||seen.has(f.id))continue;
    seen.add(f.id);const [lng,lat]=f.geometry.coordinates.map(n=>+n.toFixed(7));
    if(!inBoundary([lng,lat],boundary.geometry))continue;
    inside++;
    if(nearMunicipal([lng,lat],grid)){duplicates++;continue;}
    const p=f.properties,height=osmHeight(p.height);
    trees.push({id:`osm-${f.id}`,lng,lat,source:'osm',species:String(p.species||p['species:en']||p.genus||''),height,
      heightClass:null,heightTag:p.height??null,type:null,planted:null,setting:null});
  }
  return {trees,report:{boundary:'r47811',boundaryArea:boundary.id,explicitNodesInside:inside,nearMunicipal:duplicates,
    added:trees.length,dedupMetres:DEDUP_METRES,treeRowsAdded:0,species:trees.filter(t=>t.species).length,recordedHeights:trees.filter(t=>t.height!==null).length}};
}
