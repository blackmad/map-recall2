/** Promote only complete expanded tiles; preserve old evidence files and all labels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.slice(key.length+3)||fallback;
const root=path.resolve(arg('root','.cache/da-costa-neighbourhood'));
const stage=path.resolve(arg('stage','.cache/da-costa-neighbourhood/aerial-expanded-2026-09-09'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const before=await fs.readFile(path.join(root,'aerial.json')),active=JSON.parse(before),staged=JSON.parse(await fs.readFile(path.join(stage,'aerial.json')));
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
if(hash(before)!==staged.activeManifestSha256)throw Error('Active aerial metadata differs from staged source; restage before promotion');
const seen=new Set(),copies=[];
for(const row of staged.records){
  if(seen.has(row.buildingId))throw Error('Duplicate staged building');seen.add(row.buildingId);
  const old=active.records.find(r=>r.buildingId===row.buildingId);
  if(!old||old.sha256!==row.before?.sha256||old.coverageComplete!==false)throw Error('Replacement is not the expected clipped source');
  if(!row.coverageComplete||!row.contextCoverageComplete||row.scalePxPerM!==8||row.contextMarginM<18)throw Error('Incomplete or unexpected expanded coverage');
  const building=block.buildings.find(b=>b.id===row.buildingId);
  if(!building||hash(JSON.stringify(building.footprint))!==row.footprintSha256)throw Error('Target footprint changed');
  const points=building.footprint.coordinates.flat(2).map(p=>[block.origin.x+p[0],block.origin.y-p[1]]);
  if(points.some(([x,y])=>Math.min(x-row.bbox[0],y-row.bbox[1],row.bbox[2]-x,row.bbox[3]-y)<row.contextMarginM-.001))throw Error('Target or context lies outside expanded source');
  if(row.roofColour!==null)throw Error('Coverage repair cannot introduce roof painting');
  if(Math.abs((row.bbox[2]-row.bbox[0])*8-row.sourceWidth)>.001||Math.abs((row.bbox[3]-row.bbox[1])*8-row.sourceHeight)>.001)throw Error('Inconsistent source georeference');
  if(!path.resolve(row.sourceFile).startsWith(stage+path.sep)||hash(await fs.readFile(row.sourceFile))!==row.sourceSha256)throw Error('Expanded tile source mismatch');
  const dimensions=await sharp(row.sourceFile).metadata();if(dimensions.width!==row.sourceWidth||dimensions.height!==row.sourceHeight)throw Error('Source dimensions differ from georeference');
  for(const image of [row,row.context]){
    if(path.basename(image.file)!==image.file)throw Error('Invalid image path');
    const bytes=await fs.readFile(path.join(stage,'images',image.file));if(hash(bytes)!==image.sha256)throw Error('Staged crop pixels changed');
    const destination=path.join(root,'images',image.file);
    try{if(hash(await fs.readFile(destination))!==image.sha256)throw Error('Refusing to overwrite different evidence '+destination);}catch(error){if(error.code!=='ENOENT')throw error;}
    copies.push({destination,bytes});
  }
}
const summary={buildings:staged.records.length,images:copies.length,beforeClipped:active.records.filter(r=>!r.coverageComplete).length,afterClipped:active.records.filter(r=>!r.coverageComplete&&!seen.has(r.buildingId)).length,paidLedgerModified:false,humanReviewsModified:false};
if(!process.argv.includes('--apply')){console.log(JSON.stringify({dryRun:true,...summary},null,2));process.exit(0);}
const backup=await fs.mkdtemp(path.join(root,'before-aerial-'));await fs.writeFile(path.join(backup,'aerial.json'),before);
for(const copy of copies)await fs.writeFile(copy.destination,copy.bytes);
if(hash(await fs.readFile(path.join(root,'aerial.json')))!==hash(before))throw Error('Active aerial metadata changed during copy; old metadata retained');
for(const row of staged.records){const published={...row};delete published.sourceFile;active.records[active.records.findIndex(r=>r.buildingId===row.buildingId)]=published;}
active.expansion={at:new Date().toISOString(),previousManifestSha256:hash(before),policy:'Complete footprint plus context; no inferred roof painting',...summary};
await fs.writeFile(path.join(root,'aerial.json.tmp'),JSON.stringify(active,null,2));await fs.rename(path.join(root,'aerial.json.tmp'),path.join(root,'aerial.json'));
await fs.writeFile(path.join(backup,'promotion.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({applied:true,backup,...summary},null,2));
