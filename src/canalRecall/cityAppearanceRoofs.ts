/** Conservative extraction of game-compatible LoD2.2 roof components.
 * Every returned polygon is still source geometry; the policy only withholds
 * components that do not fit the game's current single-height wall volume.
 */
export const SOURCE_ROOF_SELECTION_POLICY='per-source-surface-compatible-v2' as const;
export const SOURCE_ROOF_MIN_EAVE_RATIO=.6;
export const SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M=3;
export const SOURCE_ROOF_MIN_RELIEF_M=.25;

type Point=[number,number,number];
type Surface={type:string;rings:Point[][]};
export type SourceRoofBuilding={roofType?:string|null;groundNAP?:number|null;height?:number|null;surfaces?:Surface[]};
export type CompatibleSourceRoof={surfaces:Point[][][];eaves:number};

export function selectCompatibleSourceRoof(building:SourceRoofBuilding):CompatibleSourceRoof|null{
  if(building.roofType!=='slanted'||!Number.isFinite(building.groundNAP)||!(Number(building.height)>0))return null;
  const ground=Number(building.groundNAP),height=Number(building.height);
  const components=(building.surfaces??[]).filter(surface=>surface.type==='roof').map(surface=>{
    const geometry=surface.rings.map(ring=>ring.map(([east,up,south])=>[east,-south,Math.max(0,up-ground)] as Point));
    const heights=geometry.flat().map(point=>point[2]),eaves=Math.min(...heights),ridge=Math.max(...heights);
    return{geometry,eaves,ridge};
  }).filter(component=>component.eaves>=height*SOURCE_ROOF_MIN_EAVE_RATIO
    &&component.ridge<=height+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M
    &&component.ridge>component.eaves+SOURCE_ROOF_MIN_RELIEF_M);
  return components.length?{surfaces:components.map(component=>component.geometry),eaves:Math.min(...components.map(component=>component.eaves))}:null;
}
