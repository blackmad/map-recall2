/** Offline comparison crops from checksum-verified archived panoramas. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {perspectiveCrop} from '../street-appearance/perspective.ts';

const options=new Map<string,string>();
for(const arg of process.argv.slice(2)){
 const match=/^--(output|recipes|inventory|archive|aspect)=(.+)$/.exec(arg);
 if(!match||options.has(match[1]))throw Error('Use required --output=<unique artifacts directory>, optional --recipes, --inventory, --archive, --aspect');
 options.set(match[1],match[2]);
}
if(!options.has('output'))throw Error('A unique --output is required to preserve earlier evidence');
const output=path.resolve(options.get('output')!),artifactRoot=await fs.realpath('artifacts');
const relative=path.relative(artifactRoot,output);
if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Source crops must remain in local artifacts');
try{await fs.access(output);throw Error('Output exists; preserve earlier evidence');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const archive=await fs.realpath(options.get('archive')??'../map-recall2-source-data/streets/canalhouse-recipes-pilot');
const pack=JSON.parse(await fs.readFile(options.get('recipes')??'docs/references/canalhouse-recipes/recipes.json','utf8'));
const inventory=JSON.parse(await fs.readFile(options.get('inventory')??'docs/references/canalhouse-recipes/pilot-inventory.json','utf8'));
const aspect=Number(options.get('aspect')??'1.5');if(!Number.isFinite(aspect)||aspect<=0||aspect>4)throw Error('Invalid crop aspect');
await fs.mkdir(output,{recursive:true});
const realOutput=await fs.realpath(output);if(path.relative(artifactRoot,realOutput).startsWith('..'))throw Error('Source output escapes local artifacts through a symlink');
const records=[];
for(const row of pack.reviewRows??[]){
 const house=inventory.houses.find((h:any)=>h.id===row.referenceHouseId),entry=pack.entries.find((e:any)=>e.recipe.id===row.referenceHouseId),source=house?.currentFacade?.rawSource;
 if(!source||!entry?.panorama||!/^row-[a-z0-9-]+$/.test(row.id))throw Error('Missing source or invalid review row');
 const file=await fs.realpath(path.resolve(archive,source.rawPath));if(path.relative(archive,file).startsWith('..'))throw Error('Raw source escapes selected archive');
 const bytes=await fs.readFile(file),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==source.sha256)throw Error('Raw source checksum mismatch');
 const width=Math.round(900*aspect),height=900,projection={headingDeg:entry.panorama.headingDeg,pitchDeg:entry.panorama.pitchDeg,horizontalFovDeg:row.panoramaFovDeg,width,height};
 const projected=perspectiveCrop(bytes,projection.headingDeg,width,height,projection.horizontalFovDeg,projection.pitchDeg);
 await fs.writeFile(path.join(output,row.id+'.jpg'),projected);
 records.push({row:row.id,houseIds:row.houseIds,referenceHouseId:row.referenceHouseId,source,projection,sha256:createHash('sha256').update(projected).digest('hex'),cameraRD:entry.panorama.cameraRD,eyeHeightM:entry.panorama.cameraHeightM,limit:'Same recorded horizontal station and projected rays as reference view. Eye height is a drawing approximation; no surveyed photo control-point calibration.'});
}
if(!records.length)throw Error('No review rows selected');
await fs.writeFile(path.join(output,'sources.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({output,rows:records.length,rawArchiveMutation:false}));
