/**
 * The generic streamed path reads HouseSpecs (house line H1 step 5, docs/house-line.md §1 "The generic path").
 *
 * Runtime half, pure and light (no intent schema, no fs): the tile enricher stamps each pand's runtime view
 * (`p.houseSpec`, built by scripts/house-specs/build-house-specs.ts from the resolved spec) onto the raw feature, and
 * two decorator steps turn it into properties the chain already honours:
 *   withHouseSpec      (before decorateFacade, right after the register step) constructionYear, registerFinish and one
 *                      new `specRecipe` {period, crownShape, wallHex, bays} that meshBuildingFor carries to the mesher
 *   withHouseSpecCrown (after withMonumentGable) monumentGable, when the spec's gable comes from a stronger source than
 *                      the register text or nothing else named one
 * A feature without `houseSpec` is returned as the same object, so `?houseSpecs=0` (or HOUSE_SPECS=0 in Node, or no
 * extract) is byte-identical to the chain before.
 */
import type { GableShape } from '../roofMesh.js';
import { roofPlanForFeature } from '../roofMesh.js';
import type { ArchitecturalRecipe } from '../streetAppearance.js';
import type { StoopIntent } from '../buildingRecipe/stoop.ts';
import { eraOfYear } from '../facade/registerRecipe.js';
import { SOURCE_STRENGTH } from '../facade/evidence.js';
import { brickLiftOn } from '../look/brickLift.js';
import { heldTakesBrick, hexToOklab, paleWarmHeld, specWallDisplay, specWallSource, specWallsOn, type WallFamily, specWallsForcedOn } from './wallColour.js';

/** Rank on the evidence ladder (spec.ts specStrength without the intent schema import): `author` = `reviewed`. */
const rank = (s: string | undefined) => (SOURCE_STRENGTH as readonly string[]).indexOf(s === 'author' ? 'reviewed' : s ?? '');

/** The runtime view of a resolved spec: only what the generic path reads, each with its winning source. */
export interface HouseSpecView {
  /** Street front crown, intent vocabulary (buildingRecipe/intent.ts GABLES). */
  gable?: string;
  /** The year the street front dates to. */
  year?: number;
  /** palette.wallMaterial. */
  wallMaterial?: 'brick' | 'stucco' | 'painted-brick';
  /** palette.brick as #rrggbb (a swatch name resolved at build time). */
  wallHex?: string;
  /** Window bays across the street front above the ground storey. */
  bays?: number;
  /** 3DBAG ridge minus eaves (m, bag-facts), for pands with a gable or a historic gable: the register gable gate's crown test. */
  crownRiseM?: number;
  /** Full storeys below the crown, ground included (FrontIntent.storeys; lane H9). */
  storeys?: number;
  /** H11: the ground storey's height (m, storeyHeights[0]); only with `storeys`. */
  groundM?: number;
  /** Lane WG: the front stands on a souterrain (fronts/0/souterrain), from a photo or register source; only with `storeys`. */
  souterrain?: true;
  /** Lane WG: a roof storey above the eaves (fronts/0/roofStorey mansard|attic); only with `storeys`. */
  roofStorey?: 'mansard' | 'attic';
  /** Lane WG: 3DBAG's eaves above the ground (m, bag-facts), for pands with `storeys` (houseSpec/storeyPlan.ts). */
  eavesM?: number;
  /** Lane WG: the front's crown is a cornice (fronts/0/gable, from a front-reading source); only with `storeys`. */
  corniceCrown?: true;
  /** facts.wallFamily: a reader's colour family for the wall (H5h hand set), the truth a pixel reading is checked against. */
  wallFamily?: WallFamily;
  /** The street front has a stoop (basement `stoop*`): its measured fields (buildingRecipe/stoop.ts), `{}` when only
   *  its presence is known (register `stoep`, Jev). K-stoep #360. */
  stoop?: StoopIntent;
  /** H11: the window look the front states (view.ts specLook). */
  look?: SpecLook;
  /** H11: a shop ground storey (true) or a quiet one (false). */
  shop?: boolean;
  /** H11: the shopfront's paint (#rrggbb), with `shop`. */
  shopHex?: string;
  /** Winning source per key above. */
  src: Partial<Record<'gable' | 'year' | 'wallMaterial' | 'wallHex' | 'bays' | 'storeys' | 'wallFamily' | 'stoop' | 'look' | 'shop' | 'souterrain' | 'roofStorey', string>>;
}

/**
 * The bay-look traits a front states (bayLook.ts bayStyleForTraits, the same four a buurt profile draws): white trim
 * around the openings, dark frames, arched heads, tall windows. An absent trait leaves the buurt profile's (or the hash's) pick.
 */
export interface SpecLook { pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean }

/** What the spec adds to the generic mesher: an ArchitecturalRecipe subset plus the bay count, the storey count (H9), and
 *  (H11) the storey fit, the window look and the shop paint. */
export type SpecRecipe = Partial<Pick<ArchitecturalRecipe, 'crownShape' | 'period' | 'wallHex' | 'bays'>> & {
  /** Full storeys, ground included: street runs draw that many (streetFacadeRendering.ts specStoreyFit, H9 exact fit). */
  storeys?: number;
  /** H11: fit every ground-level run, to the nearest count the clamp allows, the ground yielding first (specStoreyFit `nearest`). */
  storeysFit?: true;
  /** H11: the stated ground storey's height (m), with `storeysFit`. */
  groundM?: number;
  /** Lane WG (houseSpec/storeyPlan.ts): a souterrain under the stated storeys, a roof storey above the eaves, 3DBAG's eaves. */
  souterrain?: true;
  roofStorey?: 'mansard' | 'attic';
  eavesM?: number;
  corniceCrown?: true;
  /** H11: the window look (bayLook.ts bayLookFor `spec`). */
  look?: SpecLook;
  /** H11: the shop's ground-storey paint. */
  shopHex?: string;
  /** H9g: the pale-warm guard held this brick pand's wall; the period colour it keeps must be a brick one (wallColour.ts heldBrickWall). */
  heldBrick?: true;
};

/** Default on; `?houseSpecs=0` in the page or HOUSE_SPECS=0 in Node turns the enricher (and so every step) off. */
export const HOUSE_SPECS_DEFAULT = true;
export function houseSpecsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]houseSpecs=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? HOUSE_SPECS_DEFAULT : v === '1';
}

/** Intent gable -> the roof planner's gable (roofMesh GABLE_SHAPES); `flat` and `shouldered` have none. */
export const GABLE_TO_ROOF: Readonly<Record<string, GableShape>> = {
  step: 'step', neck: 'neck', 'raised-neck': 'raisedNeck', bell: 'bell', spout: 'spout', point: 'plain', cornice: 'cornice',
};
/** Intent gable -> ArchitecturalRecipe.crownShape. */
const GABLE_TO_CROWN: Readonly<Record<string, NonNullable<ArchitecturalRecipe['crownShape']>>> = {
  neck: 'neck', 'raised-neck': 'neck', bell: 'bell', cornice: 'cornice', step: 'plain', spout: 'plain', point: 'plain',
};
const ERA_PERIOD = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' } as const;

const PRIOR_SOURCE = 'citywide-identity-palette-v3-not-measured';
type Props = Record<string, unknown>;
const viewOf = (p: Props): HouseSpecView | null => {
  const v = p.houseSpec as HouseSpecView | undefined;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
};
/** The same exclusions as the register step (registerRecipe.ts registerPatch): measured fronts, kits, large tier. */
const excluded = (p: Props) => (p.appearanceStyleSource !== undefined && p.appearanceStyleSource !== PRIOR_SOURCE) || !!p.kitWall || !!p.largeTier;

/**
 * Was held (2026-11-10, H1 frames): a strip-measured wall colour is the overcast panorama reading and drew Kinkerstraat
 * 244-332 darker than the generic palette, against the user's brighter-palette priority (2026-10-16). Released by lane
 * H9 (2026-11-10) through the wall-colour rule (wallColour.ts specWallDisplay: measured hue and chroma, one lightness
 * lift), behind `?specWalls=0` / SPEC_WALLS=0. `false` = the rule is live. Held again 2026-11-10 by the judgement
 * ruling on H9 r3, flipped by the H9 un-hold commit after the frame read 2026-11-10 with the pale-warm guard
 * (wallColour.ts paleWarmHeld); `?specWalls=1` / SPEC_WALLS=1 still draws the rule if it is ever held again.
 */
export const SPEC_WALLS_HELD = false;
/**
 * Per-pand wall holds (the judgement session's ruling on #345: a pand whose drawn wall is still the wrong family after the
 * trim-misread rule keeps its period colour). Bare pand numbers (the NL.IMBAG.Pand. suffix). Empty = no pand held.
 */
export const SPEC_WALL_HOLD: ReadonlySet<string> = new Set<string>();
const pandNumber = (id: unknown) => String(id ?? '').replace(/^NL\.IMBAG\.Pand\./, '');

/**
 * Released 2026-11-10 (H1c #350): odd stated counts on two-window cells draw as half-cell axis units
 * (streetFacadeRendering.ts axisUnitPlan), and the #348 gate passes (closer on 12 of 19 scorable pands, further on none).
 * Auto-placed type bays the strip did not confirm are a 'default' and never written. Roll back by holding it again (a
 * world-v1 recompile carries it). docs/house-line.md §1 "Odd bays".
 */
export const SPEC_BAYS_HELD = false;

/**
 * Released with K-stoep (#360): a spec stoop reaches the generic path as `specStoop` (stoopExtra.ts draws it). The
 * published extract carries no `stoop` until build-house-specs.ts reruns, so the world is byte-identical until then.
 * Roll back by holding it (a world-v1 recompile carries it).
 */
export const SPEC_STOOPS_HELD = false;

/**
 * Lane H11 (#361): the design fields the generic path draws from a spec beyond H9's storey count. **Held** on the
 * integrator's ruling (2026-11-10): released after the H10 house:frames pairs are read. Each releases on its own (a
 * world-v1 recompile carries it); in Node HOUSE_SPEC_DESIGN=1 releases all three, HOUSE_SPEC_DESIGN=storeys,look only
 * those, HOUSE_SPEC_DESIGN=0 holds all (the world compile, house:preview and scripts/house-specs/design-gate.ts).
 *   storeys  storeyHeights[0] and the nearest-count fit on every ground-level run (H9's exact street-run fit stays live)
 *   look     windowSurround, speklagen, palette.frame, windowHead, windows, windowProportion -> the bay-look preset
 *   shop     fronts/0/shopfront (or facts.pui) -> specShop and the shop paint
 * docs/house-line.md §1 "Design fields on the generic path (H11)".
 */
export const SPEC_DESIGN_HELD = { storeys: false, look: true, shop: true };
/** Whether one H11 field reaches the mesher: its hold, or in Node HOUSE_SPEC_DESIGN=1 (all) / =0 (none) / =storeys,look (those). */
export function specDesignOn(field: keyof typeof SPEC_DESIGN_HELD, env: string | undefined = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.HOUSE_SPEC_DESIGN): boolean {
  if (env === undefined || env === '') return !SPEC_DESIGN_HELD[field];
  if (env === '1') return true;
  return env.split(',').map(v => v.trim()).includes(field);
}
/** The shop cell a spec'd shop draws: the plain shop window (the recipe route's dark display glazing), not a themed café or florist. */
export const SPEC_SHOP_KIND = 'shopWindow' as const;

/**
 * The wall colour a spec view draws, or null when it keeps the period colour: the trim-misread rule and the lift, then the
 * pale-warm guard on the drawn colour (wallColour.ts paleWarmHeld; render/light finishes and light reader families pass).
 */
/**
 * Whether a spec view's wall counts as brick for the trim-misread rule: its stated material, else the register's finish.
 * Under brickLift v2 (the default; `?brickLift=v1` restores the old rule) a pand that states neither (no spec material, no register finish) counts as brick: 83 % of the
 * unstated c19 1875-1910 pands of Oud-West / De Baarsjes read brick in the photos (docs/house-line.md §9). Under v1: unchanged.
 */
export function specWallIsBrick(view: Pick<HouseSpecView, 'wallMaterial'>, p: Props): boolean {
  if (view.wallMaterial) return view.wallMaterial === 'brick';
  if (p.registerFinish === 'brick') return true;
  return brickLiftOn() && (p.registerFinish === undefined || p.registerFinish === null || p.registerFinish === '');
}
export function specWallColour(view: HouseSpecView, p: Props): string | null {
  if (!view.wallHex || !/^#[0-9a-f]{6}$/i.test(view.wallHex)) return null;
  const reading = view.wallHex.toLowerCase(), brick = specWallIsBrick(view, p);
  const src = specWallSource(reading, { family: view.wallFamily ?? null, brick });
  const drawn = specWallDisplay(src.hex, { fromPixel: src.fromPixel });
  const held = paleWarmHeld(drawn, { family: view.wallFamily ?? null, render: view.wallMaterial === 'stucco' || p.registerFinish === 'light', readingL: hexToOklab(reading)[0] });
  return held ? null : drawn;
}
/** True when the pale-warm guard holds this view's wall at the period colour. */
export const specWallGuarded = (view: HouseSpecView, p: Props): boolean =>
  !!view.wallHex && /^#[0-9a-f]{6}$/i.test(view.wallHex) && specWallColour(view, p) === null;

/** The property patch a spec view makes before decorateFacade; empty when nothing changes. */
export function houseSpecPatch(view: HouseSpecView, p: Props): Props {
  const patch: Props = {};
  if (Number.isInteger(view.year)) {
    const year = view.year!, current = p.constructionYear === null || p.constructionYear === undefined ? NaN : Number(p.constructionYear);
    // As the register step: only an era change moves the year (the palette and layout key on the era, not the year).
    if (!Number.isFinite(current) || eraOfYear(year) !== eraOfYear(current)) {
      patch.constructionYear = year;
      if (p.bagConstructionYear === undefined) patch.bagConstructionYear = Number.isFinite(current) ? current : null;
    }
  }
  if (view.wallMaterial) {
    // Painted brick with a measured wall colour keeps the brick cells (its courses show; the colour is the measured
    // paint, lane H9): a near-black painted front drawn in plaster cells read as render. Without a measured colour the
    // register's rule stands (painted = a light finish).
    const measuredPaint = view.wallMaterial === 'painted-brick' && !!view.wallHex && specWallsOn() && !specWallGuarded(view, p);
    const finish = view.wallMaterial === 'brick' || measuredPaint ? 'brick' : 'light';
    if (p.registerFinish !== finish) patch.registerFinish = finish;
  }
  if (!SPEC_STOOPS_HELD && view.stoop && typeof view.stoop === 'object' && !Array.isArray(view.stoop)) patch.specStoop = view.stoop;
  const recipe: SpecRecipe = {};
  if (!SPEC_BAYS_HELD && view.bays && view.bays > 0 && view.src?.bays !== 'default') recipe.bays = view.bays;
  // The measured wall, through the wall-colour rule (lifted lightness, measured hue); `?specWalls=0` keeps the period colour.
  // A reading lighter than its family's usual tone on a brick front, or against a reader's family, is a trim misread and
  // draws the family tone (wallColour.ts specWallSource).
  if ((SPEC_WALLS_HELD ? specWallsForcedOn() : specWallsOn()) && view.wallHex && /^#[0-9a-f]{6}$/i.test(view.wallHex) && !SPEC_WALL_HOLD.has(pandNumber(p.id))) {
    const drawn = specWallColour(view, p);
    if (drawn) recipe.wallHex = drawn;
    else if (heldTakesBrick({ wallMaterial: view.wallMaterial, registerFinish: String(p.registerFinish ?? '') })) recipe.heldBrick = true;
  }
  // The storey count (H9) on street runs; H11 (held) adds the nearest-count fit on every ground-level run and the ground height.
  if (view.storeys && view.storeys >= 2) {
    recipe.storeys = view.storeys;
    // Lane WG: the storey plan's inputs (storeyPlan.ts); absent keys leave the fit as before.
    if (view.souterrain === true) recipe.souterrain = true;
    if (view.roofStorey === 'mansard' || view.roofStorey === 'attic') recipe.roofStorey = view.roofStorey;
    if (typeof view.eavesM === 'number' && Number.isFinite(view.eavesM) && view.eavesM > 0) recipe.eavesM = view.eavesM;
    if (view.corniceCrown === true) recipe.corniceCrown = true;
    if (specDesignOn('storeys')) {
      recipe.storeysFit = true;
      if (typeof view.groundM === 'number' && Number.isFinite(view.groundM)) recipe.groundM = view.groundM;
    }
  }
  if (specDesignOn('look') && view.look && Object.keys(view.look).length) recipe.look = view.look;
  if (specDesignOn('shop') && typeof view.shop === 'boolean') {
    // `specShop` beside the shopfront extract's stamp (threeBuildingFeatures shopfrontOf): a stated shop keeps the extract's
    // kind (a named café stays a café) or draws the plain shop window; a stated quiet front drops the extract's (OSM) shop.
    if (p.specShop !== view.shop) patch.specShop = view.shop;
    if (view.shop && view.shopHex && /^#[0-9a-f]{6}$/i.test(view.shopHex)) recipe.shopHex = view.shopHex.toLowerCase();
  }
  // A spec recipe only when it carries something the mesher reads; crown and period ride along.
  if (recipe.bays || recipe.wallHex || recipe.heldBrick || recipe.storeys || recipe.look || recipe.shopHex) {
    const year = Number.isInteger(view.year) ? view.year! : Number(patch.constructionYear ?? p.constructionYear);
    if (Number.isFinite(year)) recipe.period = ERA_PERIOD[eraOfYear(year)];
    if (view.gable && GABLE_TO_CROWN[view.gable]) recipe.crownShape = GABLE_TO_CROWN[view.gable];
    patch.specRecipe = recipe;
  }
  return patch;
}

/** Decorator step (after the register step, before decorateFacade). Same object back when nothing applies. */
export function withHouseSpec<T extends { properties: Props }>(feature: T): T {
  const view = viewOf(feature.properties);
  if (!view || excluded(feature.properties)) return feature;
  const patch = houseSpecPatch(view, feature.properties);
  return Object.keys(patch).length ? { ...feature, properties: { ...feature.properties, ...patch } } : feature;
}

/**
 * Register gable gate (H5h round 4, judgement ruling on #351). On the hand set the register's gable type agreed with the street
 * front on 36 of 60 (docs/house-line.md §4c): it names the monument's historic gable, and many such fronts are a cornice today.
 *  - Trust order for the crown: a photo reading (PHOTO_GABLE_SOURCES: a Jev crop judgement, a street-measured or hand front)
 *    outranks the register; a photo front with no planner gable (flat, shouldered) drops the register's.
 *  - With no photo reading, a raised register gable (anything but `cornice`) is drawn only when 3DBAG shows a crown above the
 *    eaves (`crownInGeometry`: ridge - eaves >= CROWN_RISE_M) or, with no ridge in the tile, when the roof planner on its own
 *    would plan a pitched crown (`gable` or `pitched`). Otherwise it is held: `monumentGable` is removed (the chain draws the
 *    front as it would without the register) and the shape is kept as `historicGable` for cards and trivia.
 * `?registerGable=drawn|gated|hint` (REGISTER_GABLE in Node) picks the mode (registerGableMode); the trust order stays.
 */
/** How the register's gable reaches the crown: `drawn` (before H5h round 4), `gated` (only over a 3DBAG crown; a cornice
 *  always) or `hint` (never drawn, kept as historicGable). A photo reading outranks the register in every mode. */
export type RegisterGableMode = 'drawn' | 'gated' | 'hint';
export const REGISTER_GABLE_MODES: readonly RegisterGableMode[] = ['drawn', 'gated', 'hint'];
export const REGISTER_GABLE_MODE_DEFAULT: RegisterGableMode = 'gated';
/** `?registerGable=drawn|gated|hint` in the page, REGISTER_GABLE=... in Node; the query wins. */
export function registerGableMode(search?: string | null, env?: string | null): RegisterGableMode {
  const q = search ? /[?&]registerGable=(drawn|gated|hint)\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env && (REGISTER_GABLE_MODES as readonly string[]).includes(env) ? env : undefined);
  return (v as RegisterGableMode | undefined) ?? REGISTER_GABLE_MODE_DEFAULT;
}
const G = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
let modeNow: RegisterGableMode = registerGableMode(G.location?.search ?? null, G.process?.env?.REGISTER_GABLE ?? null);
/** A Node harness (or a review page) switches the mode; the decorator reads it per feature. */
export function setRegisterGableMode(mode: RegisterGableMode): void { modeNow = mode; }
export const currentRegisterGableMode = (): RegisterGableMode => modeNow;
export const PHOTO_GABLE_SOURCES: ReadonlySet<string> = new Set(['vision-judge', 'streetlevel-measured', 'reviewed', 'author']);
export const CROWN_RISE_M = 2;
/** 3DBAG's crown above the eaves: true (ridge - eaves >= 2 m), false (a flat top), null (no eaves or ridge in the tile). */
export function crownInGeometry(p: Props): boolean | null {
  const eaves = Number(p.eaves), ridge = Number(p.ridge);
  if (p.eaves !== undefined && p.ridge !== undefined && Number.isFinite(eaves) && Number.isFinite(ridge)) return ridge - eaves >= CROWN_RISE_M;
  // the live building tiles carry no eaves or ridge: the spec view carries 3DBAG's rise (build-house-specs.ts)
  const rise = viewOf(p)?.crownRiseM;
  return typeof rise === 'number' && Number.isFinite(rise) ? rise >= CROWN_RISE_M : null;
}
const PITCHED_CROWNS = new Set(['gable', 'pitched']);
/** The roof planner's own crown kind for a feature without a register gable (roofMesh roofPlanForFeature), or null. */
const plannedKind = (feature: { properties: Props }): string | null => {
  try { return roofPlanForFeature(feature as unknown as Parameters<typeof roofPlanForFeature>[0])?.kind ?? null; } catch { return null; }
};

/** Decorator step after withMonumentGable: the crown in trust order (photo, then register, then weaker spec sources),
 *  then the register gable gate. Same object back when nothing changes. */
export function withHouseSpecCrown<T extends { properties: Props }>(feature: T, mode: RegisterGableMode = modeNow): T {
  const p = feature.properties, view = viewOf(p);
  const photo = !!view?.gable && PHOTO_GABLE_SOURCES.has(view.src.gable ?? '') && !excluded(p);
  if (photo) {
    // An author's flat front over a register gable takes the cornice crown (lane H9, the Raadhuisstraat arcade
    // 0363100012176346), the register gable kept as historicGable. A photo reading of a flat front instead drops the
    // register gable (below; H5h round 4). Over no register gable nothing changes, so a flat front never gains a pitched
    // roof (H1: cornice words gave 681 flat 1890s pands a canal roof).
    if (view!.gable === 'flat') {
      if (p.monumentGable === undefined || p.monumentGable === 'cornice') return feature;
      if (view!.src.gable === 'author') return { ...feature, properties: { ...p, monumentGable: 'cornice', historicGable: p.monumentGable } };
    }
    const shape = GABLE_TO_ROOF[view!.gable!];
    if (shape) return p.monumentGable === shape ? feature : { ...feature, properties: { ...p, monumentGable: shape } };
    if (p.monumentGable === undefined) return feature;
    const { monumentGable, ...rest } = p;
    return { ...feature, properties: { ...rest, historicGable: monumentGable } };
  }
  let out = feature;
  if (view?.gable && !excluded(p)) {
    const shape = GABLE_TO_ROOF[view.gable];
    if (shape && p.monumentGable !== shape) {
      const stronger = rank(view.src.gable) > rank('monument-text');
      if (p.monumentGable === undefined || stronger) out = { ...feature, properties: { ...p, monumentGable: shape } };
    }
  }
  if (mode === 'drawn') return out;
  const q = out.properties, g = q.monumentGable;
  if (typeof g !== 'string') return out;
  const { monumentGable: _held, ...rest } = q;
  if (mode === 'hint') return { ...out, properties: { ...rest, historicGable: g } };
  if (g === 'cornice') return out;
  const geo = crownInGeometry(q);
  if (geo === true) return out;
  if (geo === null) { const k = plannedKind({ ...out, properties: rest }); if (k && PITCHED_CROWNS.has(k)) return out; }
  return { ...out, properties: { ...rest, historicGable: g } };
}

// --- the tile enricher -------------------------------------------------------------------------------------------
/** One tile of the extract (`house-specs/14/<x>/<y>.json.gz`), keyed by feature id (`NL.IMBAG.Pand.<16>`). */
export interface HouseSpecTile {
  version: 1;
  buildings: Record<string, HouseSpecTileRecord>;
}
/** One pand: the resolved design and facts, the winning source per field, limits, route, and the runtime view. */
export interface HouseSpecTileRecord {
  /** Resolved design (DeepPartial<HouseDesign>). */
  d: Record<string, unknown>;
  /** Resolved facts (SpecFacts). */
  x?: Record<string, unknown>;
  /** Winning source per field path. */
  s: Record<string, string>;
  /** Kit limits (spec.ts SpecLimit). */
  l?: { component: string; what: string }[];
  r: 'generic' | 'recipe';
  /** The runtime view the enricher stamps as `p.houseSpec`. */
  v: HouseSpecView;
}
export const HOUSE_SPECS_ZOOM = 14;
/** Published extract directory, relative to the extract root. */
export const HOUSE_SPECS_DIR = 'house-specs';

async function readJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Stamps `p.houseSpec` (the runtime view) on each pand of a z14 tile the extract has; a missing tile is no specs. */
export function houseSpecEnricher(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args), dir: string = HOUSE_SPECS_DIR) {
  const root = baseUrl.replace(/\/$/, '');
  return async (tile: { z: number; x: number; y: number }, signal?: AbortSignal) => {
    if (tile.z !== HOUSE_SPECS_ZOOM) return undefined;
    let specs: HouseSpecTile['buildings'] | null = null;
    try {
      const response = await fetchImpl(`${root}/${dir}/${tile.z}/${tile.x}/${tile.y}.json.gz`, { signal });
      if (response.ok) specs = ((await readJson(response)) as HouseSpecTile)?.buildings ?? null;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    if (!specs) return undefined;
    return (features: Array<{ properties?: Props }>) => {
      for (const f of features) {
        const record = f.properties ? specs![String(f.properties.id ?? '')] : undefined;
        if (record?.v) f.properties!.houseSpec = record.v;
      }
    };
  };
}
