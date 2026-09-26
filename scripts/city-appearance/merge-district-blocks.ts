/** Deterministic source-frame merge. No downloads, model calls or publication. */
import {sha256} from './compile-block-tiles.js';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.js';
const round=(n:number)=>Math.round(n*1000)/1000;
export function mergeDistrictBlocks(entries:any[],district:any){
  if(!entries.length)throw Error('No district geometry to merge');
  const sorted=[...entries].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const origin=sorted[0].block.origin, buildings=new Map(), trees=new Map(), layers=new Map<string,Map<string,any>>();
  const memberships=new Map<string,Set<string>>();let duplicates=0;
  const inside=(p:number[],ring:number[][])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  const boundaryAreas=sorted.map(e=>({...e,polygons:e.boundaryPolygons?.map((polygon:number[][][])=>polygon.map(ring=>ring.map(p=>{const rd=lngLatToRd(p as [number,number]);return[rd.x-origin.x,origin.y-rd.y];})))}));
  const inPolygon=(p:number[],polygon:number[][][])=>inside(p,polygon[0])&&!polygon.slice(1).some(h=>inside(p,h));
  const cross=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const touches=(a:number[],b:number[],c:number[],d:number[])=>Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.max(c[0],d[0])>=Math.min(a[0],b[0])&&Math.max(a[1],b[1])>=Math.min(c[1],d[1])&&Math.max(c[1],d[1])>=Math.min(a[1],b[1])&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
  const intersects=(a:number[][][],b:number[][][])=>a[0].some(p=>inPolygon(p,b))||b[0].some(p=>inPolygon(p,a))||a[0].some((p,i)=>i>0&&b[0].some((q,j)=>j>0&&touches(a[0][i-1],p,b[0][j-1],q)));
  const geometryPoints=(v:any):number[][]=>typeof v[0]==='number'?[v]:v.flatMap(geometryPoints);
  const memberAreas=(points:number[][],polygons?:number[][][][])=>boundaryAreas.filter(e=>!e.polygons||e.polygons.some((polygon:number[][][])=>polygons?polygons.some(p=>intersects(p,polygon)):points.some(p=>inPolygon(p,polygon))));

  for(const entry of sorted){
    const b=entry.block;if(JSON.stringify(b.verticalDatum)!==JSON.stringify(sorted[0].block.verticalDatum))throw Error('District height datum mismatch');
    const dx=b.origin.x-origin.x,dz=origin.y-b.origin.y;
    const point=(p:number[])=>p.length===3?[round(p[0]+dx),p[1],round(p[2]+dz)]:[round(p[0]+dx),round(p[1]+dz)];
    const coordinates=(v:any):any=>typeof v[0]==='number'?point(v):v.map(coordinates);
    const provenance={sourceAreaId:entry.id,sourceOriginRD:b.origin,originRD:origin,axes:'x=east,y=up,z=south',heightDatum:b.verticalDatum};
    for(const value of b.buildings){
      const transformed=coordinates(value.footprint.coordinates),polygons=value.footprint.type==='Polygon'?[transformed]:transformed,points=polygons.flat(2);const matches=memberAreas(points,polygons),membership=matches.map(e=>e.district??e.id);
      const member=memberships.get(value.id)??new Set<string>();for(const name of (entry.boundaryPolygons?membership:[entry.district??entry.id]))member.add(name);memberships.set(value.id,member);const owner=matches[0]??entry;
      if(buildings.has(value.id)){duplicates++;continue;}
      buildings.set(value.id,{...value,ownerAreaId:owner.id,ownerDistrict:membership.length?owner.district:'acquisition-halo',acquisitionHalo:entry.boundaryPolygons?!membership.length:false,coordinateFrame:provenance,footprint:{...value.footprint,coordinates:coordinates(value.footprint.coordinates)},center:point(value.center),surfaces:value.surfaces.map((s:any)=>({...s,rings:coordinates(s.rings)}))});
    }
    for(const [layer,features] of Object.entries(b.layers??{})){
      const target=layers.get(layer)??new Map();layers.set(layer,target);
      for(const value of features as any[]){if(!value.id)throw Error(`Context feature lacks stable ID: ${layer}`);if(!target.has(value.id))target.set(value.id,{...value,ownerAreaId:entry.id,ownerDistrict:entry.district,districtMembership:memberAreas(geometryPoints(coordinates(value.geometry.coordinates)),value.geometry.type==='Polygon'?[coordinates(value.geometry.coordinates)]:value.geometry.type==='MultiPolygon'?coordinates(value.geometry.coordinates):undefined).map(e=>e.district),coordinateFrame:provenance,geometry:{...value.geometry,coordinates:coordinates(value.geometry.coordinates)}});}
    }
    for(const value of b.trees??[]){if(value.id===undefined)throw Error('Tree lacks inventory ID');if(!trees.has(value.id))trees.set(value.id,{...value,ownerAreaId:entry.id,ownerDistrict:entry.district,districtMembership:memberAreas([point(value.position)]).map(e=>e.district),coordinateFrame:provenance,position:point(value.position)});}
  }
  const bbox=district.combinedArea?.bbox??[Math.min(...sorted.map(e=>e.area.bbox[0])),Math.min(...sorted.map(e=>e.area.bbox[1])),Math.max(...sorted.map(e=>e.area.bbox[2])),Math.max(...sorted.map(e=>e.area.bbox[3]))];
  const sw=lngLatToRd([bbox[0],bbox[1]]),ne=lngLatToRd([bbox[2],bbox[3]]);
  const block={...sorted[0].block,stats:{buildings:buildings.size,focusBuildings:[...buildings.values()].filter(b=>b.focus).length,measuredBuildings:[...buildings.values()].filter(b=>b.surfaces?.length).length,trees:trees.size,moorings:0,sourceOmissionsByArea:sorted.map(e=>({areaId:e.id,stumpsExcluded:e.block.stats?.stumpsExcluded??null,historicBgtExcluded:e.block.stats?.historicBgtExcluded??null,unrenderedMoorings:e.block.moorings?.length??0}))},study:district.id,title:district.name,areaConfigHash:district.configHash,origin,bounds:[round(sw.x-origin.x),round(origin.y-ne.y),round(ne.x-origin.x),round(origin.y-sw.y)],buildings:[...buildings.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(b=>({...b,districtMembership:[...memberships.get(b.id)!].sort()})),layers:Object.fromEntries([...layers].sort(([a],[b])=>a.localeCompare(b)).map(([name,values])=>[name,[...values.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)))])),trees:[...trees.values()].sort((a,b)=>a.id-b.id),anchors:[],references:[],focusRing:[],moorings:[],sources:sorted.map(e=>({areaId:e.id,district:e.district,blockSha256:sha256(JSON.stringify(e.block)),sources:e.block.sources})),district:{id:district.id,boundaryHash:sha256(JSON.stringify(district.boundary)),boundarySource:{...district.boundarySource,snapshotFile:undefined},duplicateBuildingsAssignedOnce:duplicates}};
  return block;
}
