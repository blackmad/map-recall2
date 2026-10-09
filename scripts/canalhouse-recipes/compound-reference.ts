/** Multiple observed facades reuse one physical Pand's native shell and roof. */
import fs from 'node:fs/promises';
import type {assembleReference,ReferenceInput} from './assemble-reference.ts';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {canalhouseGroundFront} from '../../src/canalRecall/canalhouseGroundFront.ts';

export interface CompoundReferenceInput {schemaVersion:1;id:string;name:string;facades:string[];sourceArchive?:{path:string;commit:string|null;localCommit?:string;syncStatus?:string}}
export async function assembleCompoundReference(input:CompoundReferenceInput,assemblePart:typeof assembleReference){
 if(input.schemaVersion!==1||!input.id||!input.name||!Array.isArray(input.facades)||input.facades.length<2)throw Error('Compound requires at least two explicit facade inputs');
 const parts=await Promise.all(input.facades.map(async path=>assemblePart(JSON.parse(await fs.readFile(path,'utf8')) as ReferenceInput)));
 const first=parts[0].entry,recipe=structuredClone(first.recipe),occupied=new Set<string>();
 for(const part of parts){
  const entry=part.entry,r=entry.recipe;
  if(r.house.pandId!==recipe.house.pandId)throw Error('Compound facades must share one physical Pand');
  for(const key of ['footprint','roof','shellTopM'] as const)if(JSON.stringify(r[key]?.value)!==JSON.stringify(recipe[key]?.value))throw Error(`Compound has inconsistent native ${key}`);
  if(JSON.stringify(entry.anchorRD)!==JSON.stringify(first.anchorRD))throw Error('Compound native anchors differ');
  for(const elevation of r.elevations){
   const ring=r.footprint.value[elevation.polygonIndex].outer,end=elevation.endEdgeIndex??(elevation.edgeIndex+1)%ring.length;
   for(let i=elevation.edgeIndex;i!==end;i=(i+1)%ring.length){
    const key=`${elevation.polygonIndex}/${i}`;
    if(occupied.has(key))throw Error('Compound facade ranges overlap');occupied.add(key);
   }
  }
 }
 recipe.id=input.id;
 recipe.house=structuredClone(parts.reduce((a,b)=>a.entry.recipe.house.eavesHeightM.value>=b.entry.recipe.house.eavesHeightM.value?a:b).entry.recipe.house);
 recipe.observations=parts.flatMap(p=>p.entry.recipe.observations);
 recipe.elevations=parts.flatMap(part=>part.entry.recipe.elevations.map(original=>{
  const elevation=structuredClone(original),prefix=part.entry.recipe.id+'-';
  elevation.id=prefix+elevation.id;elevation.bodyEavesM=structuredClone(part.entry.recipe.house.eavesHeightM);elevation.palette=structuredClone(part.entry.recipe.palette);
  for(const o of elevation.openings.value)o.id=prefix+o.id;
  for(const rail of elevation.balconies?.value??[])rail.openingId=prefix+rail.openingId;
  const renameOcclusions=(value:{occludedOpeningIds?:string[]})=>{if(value.occludedOpeningIds)value.occludedOpeningIds=value.occludedOpeningIds.map(id=>prefix+id)};
  if(elevation.approach)renameOcclusions(elevation.approach.value);
  for(const flight of elevation.approaches??[])renameOcclusions(flight.assembly.value);
  // A thin aperture-aware facing selects this front's masonry color. Native
  // occupied rings, courtyard holes and roof partition remain untouched.
  const facing=canalhouseGroundFront({id:'front-facing',leftM:0,bottomM:0,widthM:part.entry.frontWidthM,heightM:elevation.bodyEavesM.value,depthM:.025,surface:'wall',openingIds:elevation.openings.value.map(o=>o.id)},elevation.openings.value);
  elevation.blocks=elevation.blocks?{...elevation.blocks,value:[...facing,...elevation.blocks.value.filter(b=>b.id!=='observed-front-body')]}:{...elevation.openings,value:facing};
  return elevation;
 }));
 recipe.simplifications=[...new Set(parts.flatMap(p=>p.entry.recipe.simplifications)),'Separate source-selected facades share one exact native shell and roof owner; front-facing fields use the existing aperture-aware component.'];
 const width=parts.reduce((sum,p)=>sum+p.entry.frontWidthM,0);
 recipe.house.plotWidthM={...first.recipe.house.plotWidthM,value:width};
 const compiled=compileCanalHouseRecipe(recipe);
 const frontTarget=first.frontTarget.map((_,axis)=>parts.reduce((sum,p)=>sum+p.entry.frontTarget[axis]*p.entry.frontWidthM,0)/width);
 return {entry:{...first,name:input.name,frontTarget,frontWidthM:width,sourceArchive:input.sourceArchive??{path:`models/${input.id}/manifest.json`,commit:null},assemblyInput:{schemaVersion:1,id:input.id,sourceIdentity:{pandId:recipe.house.pandId},facades:parts.map(p=>p.entry.assemblyInput)},sourceArchives:parts.map(p=>p.entry.sourceArchive),references:parts.flatMap(p=>p.entry.references),recipe},stats:compiled.stats};
}
