/**
 * Source adapters for façade reconnaissance.
 *
 * The first cut of this pipeline hardcoded Amsterdam: the BAG endpoint, the
 * 3DBAG endpoint, the RCE monument register and a ring of five named canals
 * were all wired straight into the scripts. That was the wrong shape, and not
 * only for tidiness — BAG, 3DBAG and the Rijksmonumenten register are
 * *national* registers. A pipeline welded to one city throws away the fact that
 * Utrecht, Rotterdam and Den Haag are already covered by exactly the same
 * sources, and it has no way to say what a city outside the Netherlands would
 * need instead.
 *
 * So reconnaissance is written against these interfaces, and a city supplies an
 * implementation of each. What varies by city is which register answers, not
 * how the pipeline works.
 *
 * The interfaces are deliberately narrow. Each one answers a single question a
 * façade reconstruction has to ask of the world:
 *
 *   BuildingRegistry   which buildings are here, and what is each one called?
 *   MassingSource      how tall is it, what shape is its roof, and how much do
 *                      you trust your own answer?
 *   HeritageSource     has anyone described this building's façade in words?
 *
 * Nothing here knows about gables, and nothing here returns a value without
 * saying where it came from.
 */

export type LngLat = [longitude: number, latitude: number];
export type BboxLngLat = readonly [west: number, south: number, east: number, north: number];

/** A point in a projected, metre-based coordinate system. */
export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * The metre-based CRS a city measures in.
 *
 * Façade measurement is metric work — plot widths, storey heights, bay
 * spacing — and doing it in degrees accumulates error and distorts distance
 * with latitude. Every city therefore declares the projected CRS its own
 * registers are published in, and the pipeline reprojects once at its edges.
 */
export interface ProjectedCrs {
  /** EPSG-style identifier, e.g. 'EPSG:28992'. */
  readonly id: string;
  readonly name: string;
  toLngLat(point: ProjectedPoint): LngLat;
  fromLngLat(lngLat: LngLat): ProjectedPoint;
  /** Vertical datum heights are expressed against, e.g. 'NAP'. */
  readonly verticalDatum: string;
}

/** A building as its authoritative register describes it. */
export interface RegistryBuilding {
  /** The register's own stable identity. A building without one is a bug. */
  buildingId: string;
  /** Year the register carries, or null. Sentinels are normalised away. */
  constructionYear: number | null;
  status: string;
  /** Whether the register considers this building to exist and be in use. */
  active: boolean;
  uses: string[];
  dwellings: number;
  /** Outer ring, closed or not, in WGS84. */
  footprintLngLat: LngLat[];
}

export interface BuildingRegistry {
  readonly id: string;
  readonly name: string;
  readonly license: string;
  /** True when this register covers the given point at all. */
  covers(lngLat: LngLat): boolean;
  fetchBuildings(bbox: BboxLngLat): Promise<RegistryBuilding[]>;
}

/** Massing and roof form, with the source's own opinion of its quality. */
export interface MassingRecord {
  buildingId: string;
  storeys: number | null;
  /** Normalised roof form. 'pitched' and 'flat' are the two that matter. */
  roofForm: 'pitched' | 'flat' | 'mixed' | 'unknown';
  /** Native roof-type string, kept because normalisation loses detail. */
  roofFormRaw: string | null;
  groundLevel: number | null;
  eavesHeight: number | null;
  ridgeHeight: number | null;
  /**
   * The source's reconstruction error against its own input, in metres.
   *
   * Read this with care. Measured across Amsterdam's canal ring it tracks roof
   * *complexity* rather than reconstruction failure — 0.60 m median on pitched
   * roofs against 0.11 m on flat, and flat across plot width and century. A
   * single global threshold on it rejects buildings for being interesting.
   */
  reconstructionError: number | null;
  geometryValid: boolean | null;
  sourceQualityFlag: boolean | null;
  /** Which survey campaign and year the heights came from. */
  surveyCampaign: string | null;
  surveyYear: number | null;
  insufficientInput: boolean | null;
  groundArea: number | null;
  exteriorWallArea: number | null;
  partyWallArea: number | null;
}

export interface MassingSource {
  readonly id: string;
  readonly name: string;
  readonly license: string;
  /** Native collection/vintage string, so two vintages never silently merge. */
  readonly vintage: string;
  fetchMassing(bbox: BboxLngLat, crs: ProjectedCrs): Promise<MassingRecord[]>;
}

/**
 * A heritage listing, and any prose description of the building it protects.
 *
 * The description is the valuable part and the reason this is its own source
 * rather than a column on the registry: a conservator's sentence about a façade
 * is an *observation* of that façade, independent of any photograph, and it has
 * to carry its own provenance and its own original language.
 */
export interface HeritageRecord {
  heritageId: string;
  /** Building this listing was resolved to, when it could be resolved. */
  buildingId: string | null;
  lngLat: LngLat;
  designation: string | null;
  category: string | null;
  subcategory: string | null;
  /** The register's own words, verbatim, never translated in place. */
  description: string | null;
  descriptionLanguage: string;
  recordUrl: string | null;
}

export interface HeritageSource {
  readonly id: string;
  readonly name: string;
  readonly license: string;
  fetchHeritage(bbox: BboxLngLat): Promise<HeritageRecord[]>;
}

/**
 * Hand-mapped semantics for a building: what people have deliberately said
 * about it, as distinct from what a register measured.
 *
 * This is a source in its own right because of a rule in `LOD.md` that is easy
 * to violate: manual geometry must be consulted *before* any fidelity tier is
 * chosen, and an automated reconstruction must never silently flatten a
 * carefully mapped tower, wing, passage or courtyard. To honour that, the
 * pipeline has to know which of these facts a human actually authored — a
 * bulk-imported copy of the same register is not independent evidence, and
 * treating it as such is how a pipeline ends up confirming itself.
 */
export interface SemanticsRecord {
  buildingId: string;
  /** Native id of the feature carrying these tags, e.g. 'way/12345'. */
  featureId: string;
  name: string | null;
  levels: number | null;
  roofLevels: number | null;
  roofShape: string | null;
  height: number | null;
  material: string | null;
  colour: string | null;
  startDate: string | null;
  /**
   * Sub-volumes mapped by hand: towers, wings, podiums, stacked masses.
   * More than one means a BAG-only pipeline would flatten a real composition.
   */
  partCount: number;
  /** True when the tags came from a bulk import rather than a person. */
  imported: boolean;
  importSource: string | null;
  /** Tags a person added on top of any import — the part worth preserving. */
  manualTags: string[];
}

export interface SemanticsSource {
  readonly id: string;
  readonly name: string;
  readonly license: string;
  fetchSemantics(bbox: BboxLngLat): Promise<SemanticsRecord[]>;
}

/** Everything reconnaissance needs to know about where it is working. */
export interface CitySources {
  readonly cityId: string;
  readonly crs: ProjectedCrs;
  readonly registry: BuildingRegistry;
  readonly massing: MassingSource | null;
  readonly heritage: HeritageSource | null;
  readonly semantics: SemanticsSource | null;
}
