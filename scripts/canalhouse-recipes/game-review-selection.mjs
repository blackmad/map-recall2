import path from 'node:path';

/** Select exact review membership; gallery subrows do not imply game admission. */
export function gameReviewSelection(manifest,{row='pilot',position,angle=-.7}={}){
 if(!Array.isArray(manifest.entries)||!manifest.entries.length)throw Error('Missing review entries');
 const matches=(manifest.reviewRows??[]).filter(r=>r.id===row);
 if(row!=='pilot'&&matches.length!==1)throw Error('Missing or ambiguous review row');
 const ids=row==='pilot'?manifest.entries.map(e=>e.id):matches[0].houseIds;
 if(!ids?.length||new Set(ids).size!==ids.length)throw Error('Invalid review membership');
 const entries=ids.map(id=>{
  const entries=manifest.entries.filter(e=>e.id===id);if(entries.length!==1)throw Error('Missing or duplicate review asset');return entries[0];
 });
 const owners=entries.flatMap(e=>e.suppressOsmIds??[]);
 if(!owners.length||new Set(owners).size!==owners.length||entries.some(e=>!e.suppressOsmIds?.length))throw Error('Missing or overlapping native owners');
 const station=position??(row==='pilot'?[4.88710,52.36760]:null);
 if(!Array.isArray(station)||station.length!==2||!station.every(Number.isFinite)||Math.abs(station[0])>180||Math.abs(station[1])>90||!Number.isFinite(angle))throw Error('Explicit finite --position=longitude,latitude required for a non-pilot row');
 const publicRoot=path.resolve('public'),modelPaths=new Set();
 const assets=entries.map(e=>{
  const url=new URL(e.modelUrl,'http://local/canal-drive/');
  if(url.origin!=='http://local'||!url.pathname.startsWith('/canal-drive/models/'))throw Error('Review models must be local exported assets');
  const file=path.resolve(publicRoot,decodeURIComponent(url.pathname).slice(1));
  if(!file.startsWith(publicRoot+path.sep)||modelPaths.has(url.pathname))throw Error('Unsafe or duplicate review model path');
  modelPaths.add(url.pathname);return{id:e.id,url:e.modelUrl,pathname:url.pathname,file,fingerprint:url.searchParams.get('asset')};
 });
 return{row,entries,owners,station,angle,assets};
}
