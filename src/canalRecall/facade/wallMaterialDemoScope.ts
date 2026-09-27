/** Source-assessed materials are an opt-in rendering experiment, not acceptance. */
import {WALL_MATERIALS} from './wallMaterialLibrary.js';
export type MaterialDemoScope='ten'|'cohort';
export interface DemoMaterialEntry {
  index:number;
  buildingId:string;
  sourceSha256:string;
  materialId:string;
  assessment?:{visiblySupported?:boolean};
}
export interface DemoMaterialAssignments {entries:DemoMaterialEntry[];gate:number[]}

export function selectMaterialDemoEntries(data:DemoMaterialAssignments,scope:MaterialDemoScope):DemoMaterialEntry[]{
  if(!Array.isArray(data?.entries)||!Array.isArray(data?.gate))throw Error('Material demo assignments are invalid');
  const indices=new Set<number>(),owners=new Set<string>(),materialIds=new Set<string>(WALL_MATERIALS.map(preset=>preset.id));
  for(const entry of data.entries){
    if(!Number.isInteger(entry.index)||indices.has(entry.index)||!entry.buildingId||owners.has(entry.buildingId)||
      !/^[a-f0-9]{64}$/.test(entry.sourceSha256)||!materialIds.has(entry.materialId))
      throw Error('Material demo owner/source/material binding is invalid or duplicated');
    indices.add(entry.index);owners.add(entry.buildingId);
  }
  for(const index of data.gate)if(!indices.has(index))throw Error('Material demo gate references a missing entry');
  const gate=new Set(data.gate);
  return data.entries.filter(entry=>entry.materialId!=='unknownneutral'&&entry.assessment?.visiblySupported!==false&&
    (scope==='cohort'||gate.has(entry.index)));
}
