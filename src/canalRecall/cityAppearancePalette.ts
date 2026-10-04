/** Deterministic display priors shared by the Three study and MapLibre game.
 * These colours are contextual visualization, never observed facade evidence. */
export const CONTEXTUAL_BUILDING_COLOURS = {
  // Deliberately sit far enough below the clean theme's cream ground to keep
  // whole blocks legible after MapLibre's directional light is applied. V1's
  // plaster/light values bleached into the basemap in overview and mobile
  // captures, making otherwise decorated buildings look uncoloured.
  // V3 (user report 2026-09-29, "these fake colors are too drab"): V2's
  // grey-browns and grey flat caps read as one dun mass from the chase. Brick
  // is redder and richer, buff is ochre, grey is a blue slate, a rare canal
  // green joins, and flat caps mix bitumen, terracotta, slate and gravel.
  priorBrickRed:'#a4523b',priorBrickBrown:'#84503a',priorBrickDark:'#6a3b2e',priorBrickBuff:'#c49a5c',
  priorPlaster:'#d3c3a0',priorModernLight:'#c2bdb2',priorModernGrey:'#7a8a94',priorCanalGreen:'#557260',
  roof:'#7c8080',priorRoofWarm:'#9a5e48',priorRoofDark:'#56606a',priorRoofGravel:'#a59e8f',
} as const;

export type ContextualBuildingColour=keyof typeof CONTEXTUAL_BUILDING_COLOURS;
function stableVariant(id:string,values:ContextualBuildingColour[]):ContextualBuildingColour{let hash=2166136261;for(const char of id){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return values[(hash>>>0)%values.length];}

/** City-scale fallback when the delivery tile has neither an observed OSM
 * material/colour nor a source-bound area prior. Identity gives adjacent BAG
 * buildings stable restrained variation without pretending an unknown build
 * year or facade material was observed. */
export function citywideBuildingWallPrior(id:string):string{return CONTEXTUAL_BUILDING_COLOURS[stableVariant(id,['priorBrickRed','priorBrickRed','priorBrickBrown','priorBrickDark','priorBrickBuff','priorPlaster','priorModernLight','priorModernGrey','priorCanalGreen'])];}
export function citywideBuildingRoofPrior(id:string):string{return CONTEXTUAL_BUILDING_COLOURS[stableVariant(`${id}:roof`,['roof','priorRoofWarm','priorRoofDark','priorRoofGravel'])];}
/** Without ground-floor evidence, continue the wall colour to street level. */
export function citywideBuildingGroundPrior(id:string):string{return citywideBuildingWallPrior(id);}

export function contextualBuildingPalette(id:string,constructionYear?:number|null){
  const year=Number(constructionYear),wall=Number.isFinite(year)&&year<1925
    ?stableVariant(id,['priorBrickRed','priorBrickBrown','priorBrickDark','priorBrickBuff','priorPlaster','priorCanalGreen'])
    :Number.isFinite(year)&&year<1965
      ?stableVariant(id,['priorBrickRed','priorBrickBrown','priorBrickBuff','priorModernGrey'])
      :stableVariant(id,['priorBrickBuff','priorModernLight','priorModernGrey','priorPlaster']);
  const roof=stableVariant(id,['roof','priorRoofWarm','priorRoofDark','priorRoofGravel']);
  // A separate base colour would invent a material change without evidence.
  const ground=wall;
  return{wallKey:wall,roofKey:roof,groundKey:ground,wall:CONTEXTUAL_BUILDING_COLOURS[wall],roof:CONTEXTUAL_BUILDING_COLOURS[roof],ground:CONTEXTUAL_BUILDING_COLOURS[ground]};
}

/** A material family suggests a display hue, never a measured wall color. */
export function materialWallDisplayPrior(material: unknown): string | null {
  if (typeof material !== 'string') return null;
  const colours: Record<string, string> = { brick: '#9a5846', stone: '#bcb5a6', concrete: '#b9b8b2', plaster: '#ded8cb', stucco: '#ded8cb', wood: '#8c6f55', metal: '#999c9e', glass: '#8d9a9e' };
  const key = material.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(colours, key) ? colours[key] : null;
}
