import {createHash} from 'node:crypto';
/** Bind an inspectable 2D projection to original source surfaces; no geometry edits. */
export function roofPlan(building,record,components){
  const pitched=new Set(components.pitchedFaces.map(f=>f.surfaceIndex));
  const faces=building.surfaces.flatMap((s,surfaceIndex)=>s.type==='roof'?[{surfaceIndex,pitched:pitched.has(surfaceIndex),rings:s.rings.map(r=>r.map(p=>[p[0],p[2]])),heightRange:[Math.min(...s.rings.flat().map(p=>p[1])),Math.max(...s.rings.flat().map(p=>p[1]))]}]:[]);
  return {version:1,source:components.source,buildingSurfacesSha256:createHash('sha256').update(JSON.stringify(building.surfaces)).digest('hex'),wall:[record.localStart,record.localEnd],faces};
}
