/** Deterministic display priors shared by the Three study and MapLibre game.
 * These colours are contextual visualization, never observed facade evidence. */
export const CONTEXTUAL_BUILDING_COLOURS = {
  // Deliberately sit far enough below the clean theme's cream ground to keep
  // whole blocks legible after MapLibre's directional light is applied. V1's
  // plaster/light values bleached into the basemap in overview and mobile
  // captures, making otherwise decorated buildings look uncoloured.
  priorBrickRed:'#94553f',priorBrickBrown:'#73513f',priorBrickBuff:'#aa8d62',
  priorPlaster:'#c3b99e',priorModernLight:'#b6b8b0',priorModernGrey:'#858b87',
  roof:'#777b7b',priorRoofWarm:'#756b66',priorRoofDark:'#5f6565',
} as const;

export type ContextualBuildingColour=keyof typeof CONTEXTUAL_BUILDING_COLOURS;
function stableVariant(id:string,values:ContextualBuildingColour[]):ContextualBuildingColour{let hash=2166136261;for(const char of id){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return values[(hash>>>0)%values.length];}

/** City-scale fallback when the delivery tile has neither an observed OSM
 * material/colour nor a source-bound area prior. Identity gives adjacent BAG
 * buildings stable restrained variation without pretending an unknown build
 * year or facade material was observed. */
export function citywideBuildingWallPrior(id:string):string{return CONTEXTUAL_BUILDING_COLOURS[stableVariant(id,['priorBrickRed','priorBrickBrown','priorBrickBrown','priorBrickBuff','priorPlaster','priorModernLight','priorModernGrey'])];}
export function citywideBuildingRoofPrior(id:string):string{return CONTEXTUAL_BUILDING_COLOURS[stableVariant(`${id}:roof`,['roof','priorRoofWarm','priorRoofDark'])];}
/** Without ground-floor evidence, continue the wall colour to street level. */
export function citywideBuildingGroundPrior(id:string):string{return citywideBuildingWallPrior(id);}

export function contextualBuildingPalette(id:string,constructionYear?:number|null){
  const year=Number(constructionYear),wall=Number.isFinite(year)&&year<1925
    ?stableVariant(id,['priorBrickRed','priorBrickBrown','priorBrickBrown','priorBrickBuff','priorPlaster'])
    :Number.isFinite(year)&&year<1965
      ?stableVariant(id,['priorBrickRed','priorBrickBrown','priorBrickBuff','priorModernGrey'])
      :stableVariant(id,['priorBrickBuff','priorModernLight','priorModernGrey','priorPlaster']);
  const roof=stableVariant(id,['roof','priorRoofWarm','priorRoofDark']);
  // A separate base colour would invent a material change without evidence.
  const ground=wall;
  return{wallKey:wall,roofKey:roof,groundKey:ground,wall:CONTEXTUAL_BUILDING_COLOURS[wall],roof:CONTEXTUAL_BUILDING_COLOURS[roof],ground:CONTEXTUAL_BUILDING_COLOURS[ground]};
}
