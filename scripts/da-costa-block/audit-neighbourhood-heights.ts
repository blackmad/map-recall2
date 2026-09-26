import fs from 'node:fs/promises';
import path from 'node:path';
import {wallVerticalExtent,VERTICAL_EXTENT_VERSION,sha} from './neighbourhood-core.ts';
const root=process.argv.find(s=>s.startsWith('--out='))?.slice(6)??'.cache/da-costa-height-stage';
if(path.resolve(root)===path.resolve('.cache/da-costa-neighbourhood')||path.resolve(root).startsWith(path.resolve('.cache/da-costa-neighbourhood')+path.sep))throw Error('Height audit must not write to active cache');
const bytes=await fs.readFile('.cache/da-costa-neighbourhood/manifest.json');
const manifest=JSON.parse(bytes.toString('utf8'));
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json','utf8'));
const records=manifest.records.map((r:any)=>{
  const extent=wallVerticalExtent(block.buildings.find((b:any)=>b.id===r.buildingId),r);
  return {id:r.id,buildingId:r.buildingId,address:r.address,derivationKey:r.derivationKey,wallWidthM:r.wallWidthM,currentTopNAP:r.images.full.plane.topZ-1.2,extent,overshootM:Math.max(0,r.images.full.plane.topZ-1.2-extent.topNAP)};
});
const summary={records:records.length,matched:records.filter((r:any)=>r.extent.source==='matched-wall-and-adjacent-roof').length,fallback:records.filter((r:any)=>r.extent.source!=='matched-wall-and-adjacent-roof').length,overshootOver3m:records.filter((r:any)=>r.overshootM>3).length,overshootOver6m:records.filter((r:any)=>r.overshootM>6).length};
await fs.mkdir(root,{recursive:true});
await fs.writeFile(root+'/height-audit.json',JSON.stringify({version:VERTICAL_EXTENT_VERSION,sourceManifestFileHash:sha(bytes),policy:'Conservative wall coverage and actual adjacent-roof contact; unmatched walls retain building maximum. No active evidence changed.',summary,records},null,2));
console.log(JSON.stringify({summary,overshootCases:records.filter((r:any)=>r.overshootM>3).map((r:any)=>({id:r.id,overshootM:r.overshootM,coverage:r.extent.coverageFraction,topNAP:r.extent.topNAP}))},null,2));
