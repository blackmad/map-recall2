import { bayLookFor, bayLayer, BAY_STYLES } from './bayLook.js';
import { STYLE_DIMS, CELL_LAYER_COUNT } from './facadeCells.js';
import { recipeForWall, type ArchitecturalRecipe, type StreetAppearanceProfile } from './streetAppearance.js';
import type { MeshBuilding, Origin } from './threeBuildingMesh.js';

export const PROCEDURAL_RECIPE_LAYER_OFFSET = CELL_LAYER_COUNT + 4;
export type StreetFacadeContext = {
  profiles: readonly StreetAppearanceProfile[];
  look: 'photo' | 'storybook' | 'cartoon' | 'procedural';
  year: number | null;
  /** Native total height, separate from the roof-adjusted wall top. */
  sourceHeightM?: number;
  streetCorner?: boolean;
  mappedWallHex?: string;
  shopfront?: Parameters<typeof bayLookFor>[4];
};

const boundsCache = new WeakMap<object, Array<{ profile: StreetAppearanceProfile; west: number; east: number; south: number; north: number }>>();
/** Cull unrelated street evidence before doing wall-level matching in a city tile. */
export function profilesNearBuilding(profiles: readonly StreetAppearanceProfile[], polygons: number[][][][]): StreetAppearanceProfile[] {
  let bounds = boundsCache.get(profiles);
  if (!bounds) {
    bounds = profiles.map(profile => {
      const [a, b] = profile.segment, latPad = profile.reachM / 110540;
      const lngPad = profile.reachM / (111320 * Math.cos(a[1] * Math.PI / 180));
      return { profile, west: Math.min(a[0], b[0]) - lngPad, east: Math.max(a[0], b[0]) + lngPad, south: Math.min(a[1], b[1]) - latPad, north: Math.max(a[1], b[1]) + latPad };
    });
    boundsCache.set(profiles, bounds);
  }
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const polygon of polygons) for (const [lng, lat] of polygon[0] ?? []) {
    west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return bounds.filter(b => b.west <= east && b.east >= west && b.south <= north && b.north >= south).map(b => b.profile);
}

/** Resolve only exposed, street-facing runs. Geometry and building identity stay unchanged. */
export function streetWallBuilding(building: MeshBuilding, wall: {
  x0: number; y0: number; x1: number; y1: number; nx: number; ny: number; hole: boolean;
}, origin: Origin, streetSide: boolean): MeshBuilding {
  const context = building.streetAppearance;
  if (!context || wall.hole || building.bare || building.plainWalls) return building;
  const inheritedReturn=shortBakedFrontReturn(building,wall,origin);
  if(inheritedReturn)return inheritedReturn;
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180);
  const recipe = streetSide ? recipeForWall(context.profiles, {
    start: [origin.lng + wall.x0 / kx, origin.lat + wall.y0 / 110_540],
    end: [origin.lng + wall.x1 / kx, origin.lat + wall.y1 / 110_540],
    normal: [wall.nx, wall.ny],
    frontage: { start: [origin.lng + wall.x0 / kx, origin.lat + wall.y0 / 110_540], end: [origin.lng + wall.x1 / kx, origin.lat + wall.y1 / 110_540], widthM: Math.hypot(wall.x1 - wall.x0, wall.y1 - wall.y0) },
  }, { id: building.id, year: context.year, heightM: context.sourceHeightM ?? building.heightM, streetCorner: context.streetCorner }) : undefined;
  if (!recipe) return building;
  const bay = bayLookFor(building.id, context.year, building.heightM,
    context.look === 'procedural' ? 'photo' : context.look, context.shopfront, recipe);
  const offset = context.look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET : 0;
  return {
    ...building, style: bay.layout, period: recipe.period,
    wallHex: context.mappedWallHex ?? bay.wallHex,
    accentHex: recipe.openingGroup ? bay.accentHex : building.shopfront ? building.accentHex : bay.accentHex,
    layers: { upper: bay.layers.upper + offset, ground: bay.layers.ground + offset, door: bay.layers.door + offset },
    plainLayer: bay.plain + offset, groundHex: recipe.groundWallHex && !context.mappedWallHex ? bay.groundHex : building.groundHex ?? bay.groundHex,
    recipe,
    ...((recipe.facadeAssembly === 'stacked-open-balcony' || recipe.entranceAssembly || recipe.openingGroup) && !building.shopfront ? { shop: false } : {}),
  };
}

/** Profile fields are procedural priors, never registered facade measurements. */
export function recipeLayoutScale(recipe: ArchitecturalRecipe | undefined, fallback: { bay: number; storey: number; ground: number }) {
  return recipe ? {
    bay: (recipe.bayScale ?? 1) * (.98 + (fallback.bay - .88) / .3 * .04),
    storey: (recipe.storeyScale ?? 1) * (.99 + (fallback.storey - .93) / .16 * .02),
    ground: (recipe.groundScale ?? 1) * (recipe.shopCanopy ? 1 : .99 + (fallback.ground - .92) / .2 * .02),
  } : fallback;
}

/** A scoped canal cell represents the complete native frontage, including polygon kinks. */
export function frontageLayoutScale(recipe: ArchitecturalRecipe | undefined, fallback: {bay:number;storey:number;ground:number}, style: MeshBuilding['style'], lengthM:number) {
  const scale=recipeLayoutScale(recipe,fallback);
  return recipe?.openingGroup ? {...scale,bay:lengthM/STYLE_DIMS[style].bay} : scale;
}

/** Carry admitted color onto a shallow exposed return, never a new opening/source class. */
function shortBakedFrontReturn(building:MeshBuilding, wall:{x0:number;y0:number;x1:number;y1:number;hole:boolean},origin:Origin):MeshBuilding|undefined {
  const context=building.streetAppearance!;
  if(Math.hypot(wall.x1-wall.x0,wall.y1-wall.y0)>2 || wall.hole)return;
  const kx=111320*Math.cos(origin.lat*Math.PI/180);
  const xy=(p:readonly number[])=>[(p[0]-origin.lng)*kx,(p[1]-origin.lat)*110540];
  const a=[wall.x0,wall.y0],b=[wall.x1,wall.y1];
  const distance=(p:number[],c:number[],d:number[])=>{const dx=d[0]-c[0],dy=d[1]-c[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-c[0],p[1]-c[1]);const t=Math.max(0,Math.min(1,((p[0]-c[0])*dx+(p[1]-c[1])*dy)/l));return Math.hypot(p[0]-c[0]-t*dx,p[1]-c[1]-t*dy);};
  for(const profile of context.profiles){
    const baked=profile.frontages?.find(f=>f.buildingId===building.id);
    if(!baked?.frontage)continue;
    const c=xy(baked.frontage.start),d=xy(baked.frontage.end);
    if(Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))>1.5)continue;
    const ps=xy(profile.segment[0]),pe=xy(profile.segment[1]),dx=pe[0]-ps[0],dy=pe[1]-ps[1];
    const recipe=recipeForWall([profile],{...baked.frontage,frontage:baked.frontage,normal:[profile.side*dy,-profile.side*dx]},{id:building.id,year:context.year,heightM:context.sourceHeightM??building.heightM,streetCorner:context.streetCorner});
    if(!recipe?.openingGroup)continue;
    const bay=bayLookFor(building.id,context.year,building.heightM,context.look==='procedural'?'photo':context.look,'quiet',recipe);
    const offset=context.look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
    const style=BAY_STYLES.canal.findIndex(v=>v.openingGroup==='canal-return');
    const upper=bayLayer('canal',style,'upper')+offset,ground=bayLayer('canal',style,'ground')+offset;
    return {...building,style:'canal',wallHex:context.mappedWallHex??bay.wallHex,accentHex:bay.accentHex,plainLayer:bay.plain+offset,layers:{upper,ground,door:ground},groundHex:undefined,shop:false,shopfront:false,plainWalls:false,recipe:undefined};
  }
}
