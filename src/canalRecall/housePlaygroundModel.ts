// House playground model: parameters -> a short terrace of features -> the game's decoration chain
// -> mesh chunks. Pure (no DOM, no three) so the node check can pin it.
//
// What is real: every feature goes through `gameDecorator` (priors, generic facade, monument
// gable, roof decorator, shopfront), then `buildFeatureChunk` for walls and again for facade extras,
// the same calls the streamer and chunk worker make. What is steered: the construction year, size,
// look, shopfront extract and (via a forced `facadeStyle`, `monumentGable` or a roof-shape tag) the
// period, gable and roof kind. The roof planner is deterministic in the building id, so when the
// user asks for a roof kind the model tries ids until the real planner produces it (up to
// MAX_TRIES per house) rather than overriding the plan; if none does, it says so.

import { CONTEXTUAL_BUILDING_COLOURS } from './cityAppearancePalette.js';
import { FACADE_STYLES, FACADE_STYLE_COLOURS, facadeKey, facadeStyleFor, mutedWallHex, type FacadeStyle } from './genericFacades.js';
import { STYLE_DIMS } from './facadeCells.js';
import { GABLE_SHAPES, ROOF_KINDS, roofPlanForFeature, type GableShape, type RoofKind, type RoofPlan } from './roofMesh.js';
import { SHOP_KINDS, type ShopKind } from './bayTextures.js';
import { SUPERMARKET_CHAINS, setShopfronts, businessColour, type ShopfrontExtract } from './shopfronts.js';
import { buildFeatureChunk, ORIGIN, type BuildingLook, type Feature } from './threeBuildingFeatures.js';
import { KITS, KIT_HIDE_IDS, kitGeometry, type KitPartGeometry, type PartInput } from './landmarkKits.js';
import { FRONT_LIST } from './landmarkFrontData.js';
import { frontKitGeometry, lookHex } from './landmarkFronts.js';
import { kitLayersFor } from './galleryLayers.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { fromLocal, gameDecorator, outerRing, ringsFrame, type Vec2 } from './galleryPipeline.js';

export { FACADE_STYLES, GABLE_SHAPES, ROOF_KINDS, SHOP_KINDS, SUPERMARKET_CHAINS };
export type { FacadeStyle, GableShape, RoofKind, ShopKind };

const KIT_HIDE_SET: ReadonlySet<string> = new Set(KIT_HIDE_IDS);

export type PlaygroundParams = {
  style: FacadeStyle | 'auto';
  year: number;
  /** One house's frontage, depth and storeys; `height` is the BAG-style roof height the game sees. */
  width: number; depth: number; storeys: number; height: number;
  houses: number;
  look: BuildingLook;
  gable: GableShape | 'auto';
  roof: RoofKind | 'flat' | 'auto';
  shop: ShopKind | 'none';
  chain: string;
  named: boolean;
  shopsOn: 'all' | 'first' | 'alternate';
  extras: boolean;
  seed: number;
};

/** A typical year per period, used when a style is picked so the bay looks (which read the year) agree. */
export const STYLE_YEAR: Record<FacadeStyle, number> = { canal: 1700, c19: 1890, school: 1925, postwar: 1965, modern: 2005, tower: 1975 };

export const DEFAULT_PARAMS: PlaygroundParams = {
  style: 'auto', year: 1890, width: 5.6, depth: 12, storeys: 4, height: 13.4, houses: 3,
  look: 'photo', gable: 'auto', roof: 'auto', shop: 'none', chain: 'none', named: false, shopsOn: 'first', extras: true, seed: 7,
};

/** The facade style the game would pick for these params (year, height, footprint). */
export const effectiveStyle = (p: PlaygroundParams): FacadeStyle =>
  p.style !== 'auto' ? p.style : facadeStyleFor({ year: p.year, heightM: p.height, minHeightM: 0, footprintM2: p.width * p.depth }) ?? 'c19';

/** Wall height for a storey count in a style: a ground floor, then upper storeys. */
export const heightForStoreys = (style: FacadeStyle, storeys: number) => +(STYLE_DIMS[style].ground + Math.max(0, storeys - 1) * STYLE_DIMS[style].storey).toFixed(1);
export const storeysForHeight = (style: FacadeStyle, height: number) => Math.max(1, Math.round((height - STYLE_DIMS[style].ground) / STYLE_DIMS[style].storey) + 1);

const hash32 = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** OSM `roof:shape` tags that make the planner choose a kind (roofMesh.ts TAGGED). */
export const ROOF_TAG: Partial<Record<RoofKind, string>> = { gable: 'gabled', pitched: 'saltbox', hipped: 'hipped', halfHipped: 'half-hipped', mansard: 'gambrel', mansardHip: 'quadruple_saltbox' };
export const MAX_TRIES = 240;

export type Terrace = {
  /** The features as the decorators left them (what the mesh builder sees). */
  features: Feature[];
  ids: string[];
  plans: Array<RoofPlan | null>;
  styleUsed: FacadeStyle;
  notes: string[];
  /** Street segments (metres from ORIGIN) in front of the terrace, for door placement. */
  streets: Float32Array;
  frame: { cx: number; cy: number; halfDiag: number; top: number };
};

const idFor = (seed: number, house: number, attempt: number) => `NL.IMBAG.Pand.0363100${String(hash32(`${seed}:${house}:${attempt}`) % 1_000_000_000).padStart(9, '0')}`;

export function buildTerrace(p: PlaygroundParams): Terrace {
  const style = effectiveStyle(p), notes: string[] = [];
  const colours = FACADE_STYLE_COLOURS[style];
  const forceStyle = (f: Feature): Feature => {
    if (p.style === 'auto') return f;
    const colour = colours[hash32(String(f.properties.id)) % colours.length], hex = mutedWallHex(CONTEXTUAL_BUILDING_COLOURS[colour]);
    return { ...f, properties: { ...f.properties, facade: facadeKey(style, colour), facadeStyle: style, sideColour: hex, groundColour: hex } };
  };
  const decorate = gameDecorator({ afterFacade: forceStyle });
  const wantKind: RoofKind | 'flat' | 'auto' = p.gable !== 'auto' && (p.roof === 'auto' || p.roof === 'gable') ? 'gable' : p.roof;
  if (p.gable !== 'auto' && p.roof !== 'auto' && p.roof !== 'gable') notes.push('A gable shape belongs to a gable roof; the roof kind you picked wins and the gable is ignored.');
  const gable = wantKind === 'gable' && p.gable !== 'auto' ? p.gable : null;
  const x0 = -(p.houses * p.width) / 2;
  const make = (i: number, id: string): Feature => {
    const xa = x0 + i * p.width, xb = xa + p.width;
    const ring = ([[xa, 0], [xb, 0], [xb, p.depth], [xa, p.depth], [xa, 0]] as Vec2[]).map(([x, y]) => fromLocal(x, y));
    const props: Record<string, unknown> = { id, height: p.height, minHeight: 0, constructionYear: p.year, building: 'yes' };
    const tag = wantKind !== 'auto' && wantKind !== 'flat' ? ROOF_TAG[wantKind] : undefined;
    if (tag) props.roofShape = tag;
    if (gable) props.monumentGable = gable;
    return { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } };
  };
  const accepts = (f: Feature): boolean => {
    if (wantKind === 'auto') return true;
    const plan = f.properties.roofPlanned ? roofPlanForFeature(f) : null;
    return wantKind === 'flat' ? !plan || plan.kind === 'parapet' : plan?.kind === wantKind;
  };
  const ids: string[] = [], plans: Array<RoofPlan | null> = [], raw: Feature[] = [];
  let missed = 0;
  for (let i = 0; i < p.houses; i++) {
    let id = idFor(p.seed, i, 0), f = make(i, id), found = accepts(decorate(f));
    for (let attempt = 1; attempt < MAX_TRIES && !found; attempt++) { id = idFor(p.seed, i, attempt); f = make(i, id); found = accepts(decorate(f)); }
    if (!found) { missed++; id = idFor(p.seed, i, 0); f = make(i, id); }
    ids.push(id); raw.push(f);
  }
  if (missed) notes.push(`No ${wantKind} roof comes out of the roof planner for a ${style} house of this size (${missed} of ${p.houses} houses show the planner's own choice). Try a wider plot or a taller house.`);
  // Shopfronts: the game reads an extract keyed by building id; this one holds only these houses.
  const kind: ShopKind | 'none' = p.chain !== 'none' ? 'groundShop' : p.shop;
  const extract: ShopfrontExtract = { version: 1, kinds: [...SHOP_KINDS], buildings: {}, colours: {}, signatures: {}, chains: {} };
  raw.forEach((f, i) => {
    const has = p.shopsOn === 'all' || (p.shopsOn === 'first' && i === 0) || (p.shopsOn === 'alternate' && i % 2 === 0);
    if (!has || kind === 'none') return;
    const id = ids[i], xm = x0 + (i + 0.5) * p.width, at = fromLocal(xm, -0.4);
    extract.buildings[id] = SHOP_KINDS.indexOf(kind);
    if (p.chain !== 'none' && SUPERMARKET_CHAINS[p.chain]) extract.chains![id] = [p.chain, at[0], at[1]];
    else if (p.named) { extract.signatures![id] = at; extract.colours![id] = businessColour(`${p.seed}:${i}`); }
  });
  setShopfronts(extract);
  const features = raw.map(decorate);
  features.forEach(f => plans.push(f.properties.roofPlanned ? roofPlanForFeature(f) : null));
  const rings = features.map(f => outerRing(f)!);
  const frame = ringsFrame(rings, [p.height])!;
  return { features, ids, plans, styleUsed: style, notes, streets: Float32Array.from([x0 - 400, -8, x0 + p.houses * p.width + 400, -8]), frame };
}

export type PlaygroundChunks = { walls: Chunk; extras: Chunk | null; /** Landmark-kit geometry for kits whose parts are in the scene (real buildings only). */ kit?: Chunk | null; triangles: number };
/** The chunk worker's two calls: walls (with roofs and lids) and, near the camera, facade extras. */
export function buildTerraceChunks(t: Terrace, look: BuildingLook, extras: boolean): PlaygroundChunks {
  const walls = buildFeatureChunk(t.features, look, 'walls', t.streets);
  const ex = extras && look !== 'untextured' ? buildFeatureChunk(t.features, look, 'extras', t.streets) : null;
  return { walls, extras: ex?.vertexCount ? ex : null, triangles: walls.indices.length / 3 + (ex ? ex.indices.length / 3 : 0) };
}

/** A short plain-language summary of what the decorators decided for one house. */
export function describeHouse(f: Feature, plan: RoofPlan | null) {
  const p = f.properties;
  return {
    id: String(p.id), year: p.constructionYear ?? null, heightM: Number(p.height), facadeStyle: String(p.facadeStyle ?? 'none'),
    shop: typeof p.shopKind === 'string' ? p.shopKind : p.shopQuiet ? 'none' : 'n/a', chain: Array.isArray(p.shopChain) ? String(p.shopChain[0]) : null,
    roof: plan ? { kind: plan.kind, gable: plan.kind === 'gable' ? plan.gable : null, material: plan.material, riseM: +plan.riseM.toFixed(1), dormers: plan.dormers } : null,
    landmark: !!p.kitRoof || !!p.kitWall, frontCarrier: p.frontCarrier ?? null,
  };
}

// --- Real buildings -----------------------------------------------------------

export type RealBuilding = { id: string; ring: Vec2[]; heightM: number; minHeightM: number; bbox: [number, number, number, number] };
export type RealScene = { features: Feature[]; buildings: RealBuilding[]; chunks: PlaygroundChunks };

/** Decorate (the game's chain) and mesh every building of `features` within `radiusM` of a local point. */
export function buildRealScene(features: readonly Feature[], centre: Vec2, radiusM: number, look: BuildingLook, extras: boolean, decorate: (f: Feature) => Feature): RealScene {
  const near: Feature[] = [], buildings: RealBuilding[] = [];
  for (const f of features) {
    const ring = outerRing(f);
    if (!ring) continue;
    const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    if (Math.hypot(cx - centre[0], cy - centre[1]) > radiusM) continue;
    const dec = decorate(f);
    near.push(dec);
    const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]);
    buildings.push({ id: String(f.properties.id), ring, heightM: Number(f.properties.height) || 0, minHeightM: Number(f.properties.minHeight) || 0, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  // The game skips the footprints a kit replaces (tiers, stacks, hides) and draws the kits as their own chunk.
  const drawn = near.filter(f => !KIT_HIDE_SET.has(String(f.properties.id)));
  const walls = buildFeatureChunk(drawn, look, 'walls');
  const ex = extras && look !== 'untextured' ? buildFeatureChunk(drawn, look, 'extras') : null;
  const kit = kitChunkFor(features.filter(f => buildings.some(b => b.id === String(f.properties.id))), look);
  return { features: near, buildings, chunks: { walls, extras: ex?.vertexCount ? ex : null, kit, triangles: walls.indices.length / 3 + (ex ? ex.indices.length / 3 : 0) + (kit ? kit.indices.length / 3 : 0) } };
}

/** ThreeBuildings.buildKits: every kit (hand and generic worship) with parts in `features`, plus the fronts they carry. */
function kitChunkFor(features: readonly Feature[], look: BuildingLook): Chunk | null {
  const parts = new Map<string, PartInput>();
  for (const f of features) {
    const ring = outerRing(f);
    if (ring) parts.set(String(f.properties.id), { id: String(f.properties.id), ring, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
  }
  const geometry: KitPartGeometry[] = KITS.flatMap(k => kitGeometry(k, parts)).map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
  for (const front of FRONT_LIST) {
    if (!front.ids.some(id => parts.has(id))) continue;
    const g = frontKitGeometry(front, ORIGIN, look), held = geometry.find(x => x.id === g.id);
    if (held) held.tris.push(...g.tris); else geometry.push(g);
  }
  const chunk = buildKitChunk(geometry, kitLayersFor(look));
  return chunk.vertexCount ? chunk : null;
}

const inRing = (ring: readonly Vec2[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** The building a ray (local metres, z up) first enters, marching in small steps; null when it reaches the ground first. */
export function pickBuilding(origin: [number, number, number], dir: [number, number, number], buildings: readonly RealBuilding[], maxM = 800): RealBuilding | null {
  const step = 0.4;
  for (let t = 0; t < maxM; t += step) {
    const x = origin[0] + dir[0] * t, y = origin[1] + dir[1] * t, z = origin[2] + dir[2] * t;
    if (z < 0) return null;
    for (const b of buildings) {
      if (x < b.bbox[0] || x > b.bbox[2] || y < b.bbox[1] || y > b.bbox[3] || z > b.heightM || z < b.minHeightM) continue;
      if (inRing(b.ring, x, y)) return b;
    }
  }
  return null;
}

/** Accept `w123`, `NL.IMBAG.Pand.0363...`, a bare 16-digit BAG number or `P0363...`. */
export function normaliseBuildingId(text: string): string | null {
  const t = text.trim();
  if (/^w\d+$/i.test(t)) return t.toLowerCase();
  if (/^NL\.IMBAG\.Pand\.\d+$/i.test(t)) return `NL.IMBAG.Pand.${t.split('.').pop()}`;
  if (/^P?\d{10,16}$/i.test(t)) return `NL.IMBAG.Pand.${t.replace(/^P/i, '').padStart(16, '0')}`;
  return null;
}
