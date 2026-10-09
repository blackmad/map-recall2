/** Native-anchor neighbor probes complement isolated-owner visibility checks. */
import fs from 'node:fs/promises';
import * as T from 'three';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';

const opt=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const input=opt('input'),rowId=opt('row'),output=opt('output');
if(!input||!rowId||!output)throw Error('Use --input=book.json --row=explicit-row --output=new-report.json');
try {await fs.access(output);throw Error('Preserve existing evidence: choose a new output');}
catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const book=JSON.parse(await fs.readFile(input,'utf8'));
const rows=book.reviewRows?.filter((r:any)=>r.id===rowId)??[];
if(rows.length!==1||!rows[0].houseIds?.length)throw Error('Missing/ambiguous native row');
const row=rows[0],entries=row.houseIds.map((id:string)=>{
 const matches=book.entries.filter((e:any)=>e.recipe.id===id);
 if(matches.length!==1)throw Error('Missing/ambiguous native owner');
 return matches[0];
});
if(new Set(row.houseIds).size!==entries.length)throw Error('Duplicate native row owner');
const scene=new T.Group(),origin=entries[0].anchorRD;
const owners=entries.map((entry:any)=>{
 if(!entry.anchorRD?.every(Number.isFinite)||entry.anchorRD.length!==2)throw Error('Invalid native anchor');
 const {group}=compileCanalHouseRecipe(entry.recipe);
 group.userData.reviewOwner=entry.recipe.id;
 group.position.set(entry.anchorRD[0]-origin[0],0,origin[1]-entry.anchorRD[1]);
 scene.add(group);return {entry,group};
});
scene.updateMatrixWorld(true);
const ownerOf=(object:T.Object3D|undefined):string|null=>{
 while(object){if(object.userData.reviewOwner)return object.userData.reviewOwner;object=object.parent??undefined;}
 return null;
};
const reference=entries.find((e:any)=>e.recipe.id===row.referenceHouseId);
if(!reference?.frontNormal?.every(Number.isFinite))throw Error('Missing row reference direction');
const rowDirection=new T.Vector3(reference.frontNormal[0],0,reference.frontNormal[1]).normalize();
const renderDirection=new T.Vector3(entries[0].frontNormal[0],0,entries[0].frontNormal[1]).normalize();
const checks:any[]=[];
for(const {entry,group} of owners)for(const elevation of entry.recipe.elevations){
 const facade=group.children.find(g=>g.name===`elevation/${elevation.id}`);
 if(!facade)throw Error('Missing compiled facade');
 const ownerDirection=new T.Vector3(0,0,1).transformDirection(facade.matrixWorld);
 for(const opening of elevation.openings.value)for(const x of [.15,.5,.85])for(const y of [.2,.5,.8]){
  const target=new T.Vector3(opening.leftM+opening.widthM*x,opening.bottomM+opening.heightM*y,0).applyMatrix4(facade.matrixWorld);
  for(const [view,direction] of [['owner-normal',ownerDirection],['row-reference-normal',rowDirection],['row-render-normal',renderDirection]] as const){
   const ray=new T.Raycaster(target.clone().addScaledVector(direction,10),direction.clone().negate());
   const isolated=ray.intersectObject(group,true)[0],hit=ray.intersectObject(scene,true)[0];
   const isolatedOpeningVisible=!!isolated?.object.name.startsWith(`opening/${opening.id}/`);
   const hitOwner=ownerOf(hit?.object);
   checks.push({houseId:entry.recipe.id,openingId:opening.id,x,y,view,isolatedOpeningVisible,firstOwner:hitOwner,firstName:hit?.object.name??null,neighborBlocksVisibleOpening:isolatedOpeningVisible&&hitOwner!==entry.recipe.id});
  }
 }
}
const failures=checks.filter(c=>c.neighborBlocksVisibleOpening);
const report={status:failures.length?'neighbor-opening-probes-failed':'neighbor-opening-probes-pass',row:rowId,generatedAt:new Date().toISOString(),scope:'Nine points per opening, three horizontal directions including orthographic row render, ten-metre rays on native-anchor row. Isolated occlusions remain separately held. Not full aperture, source-camera, game or architectural acceptance.',checks,failures};
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,failures:failures.length,affectedOwners:[...new Set(failures.map(c=>c.houseId))]}));
if(failures.length)process.exitCode=1;
