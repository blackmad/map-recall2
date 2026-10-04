/**
 * Stream the complete LoD1 city into a MapLibre GeoJSON source.
 *
 * The decision logic — which tiles a viewport needs, what to evict — is in
 * `buildingTileSource.ts` and is tested without a browser. This is the part
 * that talks to the network and to MapLibre, kept thin on purpose.
 *
 * Load order matters for the first turn: the tile under the camera must win
 * the bandwidth race against its neighbours. Starting every wanted fetch with
 * `Promise.all` shared the pipe evenly, so a fat corner tile often landed
 * before the centre and the player spawned into a hole. Fetches now run with
 * a small concurrency limit, nearest-first, and are aborted when the camera
 * leaves them behind (the Damrak default view must not keep downloading once
 * the route start jumps elsewhere).
 *
 * It is deliberately safe to run before the tiles exist. The complete city is
 * ~16 MB of gzipped tiles published into the versioned extract as a reviewed
 * decision, so until that happens the index is absent, `available` stays false,
 * and the caller keeps whatever source it already had. That is why the probe is
 * a single request for the index rather than an assumption.
 */

import { dropNestedDuplicates } from './buildingNesting.js';
import {
  BuildingTileCache, BUILDING_TILE_ZOOM, buildingForLandmark, planTiles, planSourceDiff, tileUrl,
  type BuildingFeature, type Bounds, type LandmarkBuildingQuery
} from './buildingTileSource.js';
import { tileFor, tileKey, tilesCovering } from './slippyTiles.js';
import { citywideBuildingGroundPrior, citywideBuildingRoofPrior, citywideBuildingWallPrior, materialWallDisplayPrior } from './cityAppearancePalette.js';

type GeoJsonSource = {
  setData(data: unknown): void;
  updateData?(diff: { remove?: string[]; add?: unknown[] }): void;
  on?(type: 'error', listener: (event: unknown) => void): void;
};
export type BuildingAppearancePrior={id:string;sourceId:string;geometryRevision:string;constructionYear:number|null;sideColour:string;sideColourSource?:'measured-accepted'|'procedural-prior-not-measured';sideColourObservationId?:string;sideColourSourceSha256?:string;sideColourReviewOrigin?:'human-visual-review'|'model-visual-review';sideColourReviewer?:string;roofColour:string;groundColour:string;groundFloorHeightM:number;roofShape:string|null;roofEavesHeightM:number|null;roofGeometrySource:string|null};
export type AppearanceStudyRoute={id:string;distanceM:number;source:'guided-route-source-graph';from:{id:string;name:string;lat:number;lng:number};to:{id:string;name:string;lat:number;lng:number}};
export type AppearanceAreaCatalogEntry={id:string;name:string;pointerUrl:string;lesson:boolean;priority:number};
type MapLike = {
  getSource(id: string): GeoJsonSource | undefined;
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  on(event: string, handler: () => void): void;
};

/** How many building tiles may download at once. Two keeps the pipe busy
 *  without starving the camera tile the way an unbounded `Promise.all` did. */
export const BUILDING_TILE_LOAD_CONCURRENCY = 2;

const hex=async(bytes:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
/** Load the current experimental appearance map only after validating its
 * immutable release binding and exact bytes. Failure is intentionally left to
 * the caller: neutral complete-city styling remains the safe fallback. */
export async function loadVerifiedAppearanceRelease(pointerUrl:string,fetcher:typeof fetch=fetch):Promise<{releaseId:string;areaId:string;priors:Map<string,BuildingAppearancePrior>;studyRoute:AppearanceStudyRoute}>{
  const pointerResponse=await fetcher(pointerUrl,{cache:'no-store'});if(!pointerResponse.ok)throw Error('Appearance release pointer unavailable');const pointer=await pointerResponse.json(),artifact=pointer?.maplibreAppearance;if(pointer?.version!==1||!pointer.releaseId||!artifact?.url||!/^[a-f0-9]{64}$/.test(artifact.sha256))throw Error('Unsupported appearance release pointer');
  const response=await fetcher(artifact.url);if(!response.ok)throw Error('Appearance sidecar unavailable');const bytes=await response.arrayBuffer();if(await hex(bytes)!==artifact.sha256)throw Error('Appearance sidecar hash mismatch');const value=JSON.parse(new TextDecoder().decode(bytes));if(value.version!==1||value.releaseId!==pointer.releaseId||value.areaId!==pointer.areaId||!['procedural-prior-not-measured','per-building-wall-colour-provenance-v1'].includes(value.styleSource)||value.sourceBlockSha256!==pointer.sourceHashes?.block||!Array.isArray(value.buildings)||value.buildings.length!==artifact.buildings)throw Error('Appearance sidecar release binding mismatch');
  const priors=new Map<string,BuildingAppearancePrior>();for(const item of value.buildings){if(!/^NL\.IMBAG\.Pand\.\d+$/.test(item?.id)||!/^[a-f0-9]{64}$/.test(item.geometryRevision)||!/^#[a-f0-9]{6}$/i.test(item.sideColour)||!/^#[a-f0-9]{6}$/i.test(item.roofColour)||!/^#[a-f0-9]{6}$/i.test(item.groundColour)||!Number.isFinite(item.groundFloorHeightM)||item.groundFloorHeightM<2.5||item.groundFloorHeightM>5||!['source-slanted','flat',null].includes(item.roofShape)||item.roofEavesHeightM!==null&&(!Number.isFinite(item.roofEavesHeightM)||item.roofEavesHeightM<0||item.roofEavesHeightM>100)||item.roofGeometrySource!==null&&item.roofGeometrySource!=='3dbag-lod22-roof-surfaces'||priors.has(item.id)||value.styleSource==='per-building-wall-colour-provenance-v1'&&!['measured-accepted','procedural-prior-not-measured'].includes(item.sideColourSource)||value.styleSource==='procedural-prior-not-measured'&&item.sideColourSource==='measured-accepted'||item.sideColourSource==='measured-accepted'&&(!item.sideColourObservationId||!/^[a-f0-9]{64}$/.test(item.sideColourSourceSha256??'')||!['human-visual-review','model-visual-review'].includes(item.sideColourReviewOrigin)||typeof item.sideColourReviewer!=='string'||!item.sideColourReviewer.trim())||item.sideColourSource!=='measured-accepted'&&(item.sideColourObservationId!==undefined||item.sideColourSourceSha256!==undefined||item.sideColourReviewOrigin!==undefined||item.sideColourReviewer!==undefined))throw Error('Invalid appearance sidecar building');priors.set(item.id,{...item,sideColourSource:item.sideColourSource??'procedural-prior-not-measured'});}const route=value.studyRoute;if(route?.source!=='guided-route-source-graph'||!Number.isFinite(route.distanceM)||route.distanceM<100||![route.from,route.to].every(poi=>poi&&typeof poi.name==='string'&&[poi.lat,poi.lng].every(Number.isFinite)))throw Error('Invalid appearance sidecar study route');return{releaseId:value.releaseId,areaId:value.areaId,priors,studyRoute:route};
}
export async function loadVerifiedAppearancePriors(pointerUrl:string,fetcher:typeof fetch=fetch):Promise<Map<string,BuildingAppearancePrior>>{return(await loadVerifiedAppearanceRelease(pointerUrl,fetcher)).priors;}
/** Resolve every published district through one data-driven catalog. Duplicate
 * BAG identities are rejected instead of letting catalog order silently pick
 * which area wins; overlapping areas need an explicit future merge policy. */
export async function loadVerifiedAppearanceCatalog(catalogUrl:string,fetcher:typeof fetch=fetch):Promise<{entries:Array<AppearanceAreaCatalogEntry&{releaseId:string;areaId:string;studyRoute:AppearanceStudyRoute}>;priors:Map<string,BuildingAppearancePrior>;failures:Array<{id:string;message:string}>}>{
  const response=await fetcher(catalogUrl,{cache:'no-store'});if(!response.ok)throw Error('Appearance area catalog unavailable');const catalog=await response.json();if(catalog?.version!==1||!Array.isArray(catalog.areas)||!catalog.areas.length)throw Error('Unsupported appearance area catalog');
  const ids=new Set<string>(),pointers=new Set<string>();for(const entry of catalog.areas){if(!/^[a-z0-9][a-z0-9-]+$/.test(entry?.id)||typeof entry.name!=='string'||!entry.name.trim()||typeof entry.pointerUrl!=='string'||!entry.pointerUrl.startsWith('/')||typeof entry.lesson!=='boolean'||!Number.isInteger(entry.priority)||ids.has(entry.id)||pointers.has(entry.pointerUrl))throw Error('Invalid appearance area catalog entry');ids.add(entry.id);pointers.add(entry.pointerUrl);}
  const settled=await Promise.allSettled(catalog.areas.map(async(entry:AppearanceAreaCatalogEntry)=>{const release=await loadVerifiedAppearanceRelease(entry.pointerUrl,fetcher);if(release.areaId!==entry.id)throw Error('Appearance catalog area binding mismatch');return{...entry,release};})),failures=[] as Array<{id:string;message:string}>,loaded=[] as any[];settled.forEach((result,index)=>{if(result.status==='fulfilled')loaded.push(result.value);else failures.push({id:catalog.areas[index].id,message:String(result.reason instanceof Error?result.reason.message:result.reason)});});if(!loaded.length)throw Error(`No verified appearance catalog areas: ${failures.map(item=>item.id).join(', ')}`);const priors=new Map<string,BuildingAppearancePrior>(),entries=[] as Array<AppearanceAreaCatalogEntry&{releaseId:string;areaId:string;studyRoute:AppearanceStudyRoute}>;for(const item of loaded.sort((a:any,b:any)=>b.priority-a.priority||a.id.localeCompare(b.id))){for(const [id,prior]of item.release.priors){if(priors.has(id))throw Error(`Overlapping appearance catalog building: ${id}`);priors.set(id,prior);}entries.push({id:item.id,name:item.name,pointerUrl:item.pointerUrl,lesson:item.lesson,priority:item.priority,releaseId:item.release.releaseId,areaId:item.release.areaId,studyRoute:item.release.studyRoute});}return{entries,priors,failures};
}
const present=(value:unknown)=>value!==undefined&&value!==null&&value!=='';
export function decorateBuildingFeature(feature:BuildingFeature,priors:ReadonlyMap<string,BuildingAppearancePrior>):BuildingFeature{
  const properties=feature.properties??{},id=String(properties.id??''),prior=priors.get(id);
  if(prior)return{...feature,properties:{...properties,sideColour:prior.sideColour,sideColourSource:prior.sideColourSource??'procedural-prior-not-measured',sideColourObservationId:prior.sideColourObservationId,sideColourSourceSha256:prior.sideColourSourceSha256,sideColourReviewOrigin:prior.sideColourReviewOrigin,sideColourReviewer:prior.sideColourReviewer,roofColour:prior.roofColour,groundColour:prior.sideColour,groundAppearanceStyleSource:'wall-inherited-not-independently-measured',groundFloorHeightM:prior.groundFloorHeightM,roofShape:prior.roofShape,roofEavesHeightM:prior.roofEavesHeightM,roofGeometrySource:prior.roofGeometrySource,constructionYear:prior.constructionYear,appearanceStyleSource:prior.sideColourSource??'procedural-prior-not-measured',appearanceGeometryRevision:prior.geometryRevision}};
  // The complete-city tiles also retain OSM outlines where BAG has no equivalent.
  // They need the same display prior; source identity does not imply mapped appearance.
  if(!/^(?:NL\.IMBAG\.Pand\.\d+|[wr]\d+)$/.test(id))return feature;
  const additions:Record<string,unknown>={};
  if(!['sideColour','colour','color'].some(key=>typeof properties[key]==='string'&&/^#[a-f0-9]{6}$/i.test(String(properties[key]).trim()))&&!materialWallDisplayPrior(properties.material)){additions.sideColour=citywideBuildingWallPrior(id);additions.groundColour=citywideBuildingGroundPrior(id);additions.groundFloorHeightM=3.2;additions.appearanceStyleSource='citywide-identity-palette-v3-not-measured';additions.wallAppearanceStyleSource='citywide-identity-palette-v3-not-measured';additions.groundAppearanceStyleSource='wall-inherited-not-independently-measured';}
  if(!present(properties.roofColour)&&(!present(properties.roofShape)||properties.roofShape==='flat')){additions.roofColour=citywideBuildingRoofPrior(id);additions.roofAppearanceStyleSource='citywide-flat-cap-palette-v3-not-measured';}
  return Object.keys(additions).length?{...feature,properties:{...properties,...additions}}:feature;
}

/** Decompress a published `.geojson.gz` tile into a FeatureCollection. */
async function readGzippedGeoJson(response: Response): Promise<{ features?: BuildingFeature[] }> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzipped) {
    return JSON.parse(new TextDecoder().decode(bytes)) as { features?: BuildingFeature[] };
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip building tiles need DecompressionStream');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as { features?: BuildingFeature[] };
}

/** See `BuildingTileStreamer.setTileEnricher`. */
export type TileEnricher = (tile: { z: number; x: number; y: number }, signal: AbortSignal) => Promise<((features: BuildingFeature[]) => void) | undefined | void>;

/** A tile that has not arrived by now is retried rather than waited on. */
const BUILDING_TILE_TIMEOUT_MS = 20_000;
const BUILDING_TILE_MAX_RETRIES = 4;

export class BuildingTileStreamer {
  private readonly cache = new BuildingTileCache();
  /** Tiles that returned nothing. Remembered so a gap is not refetched forever. */
  private readonly empty = new Set<string>();
  /** Transient failures per tile (network, 5xx, timeout), retried with backoff. */
  private readonly failures = new Map<string, number>();
  /** In-flight fetches, keyed so a camera jump can abort the ones we no longer want. */
  private readonly controllers = new Map<string, AbortController>();
  /** Nearest-first remaining work for the current plan. */
  private queue: ReturnType<typeof planTiles>['load'] = [];
  private inFlight = 0;
  private onFirstBuildings?: () => void;
  private onFeatures?: (features: BuildingFeature[]) => void;
  private available = false;
  private attached = false;
  private disposed = false;
  private appearancePriors=new Map<string,BuildingAppearancePrior>();
  private styledFeatures=0;
  private contextualFeatures=0;
  private contextualGrounds=0;
  private contextualRoofs=0;
  /** Last camera signature we planned for — avoids re-planning every jumpTo frame. */
  private lastFollowSignature = '';
  /** Coalesce adopts into one setData per animation frame. Two tiles finishing
   *  in the same frame used to each deep-clone the resident set and hitch. */
  private flushDirty = false;
  private flushScheduled = false;
  /** Keep the pipe to one tile until the camera tile has landed, then open up. */
  private firstTileLanded = false;

  constructor(
    private readonly map: MapLike,
    private readonly sourceId: string,
    private readonly baseUrl: string,
    private readonly zoom = BUILDING_TILE_ZOOM
  ) {}

  /**
   * Is the complete city published? Resolves false when it is not, and the
   * caller should leave its existing source alone.
   *
   * This reads the index and checks that it *is* the index, rather than
   * trusting the status code. Both this project's dev server and most static
   * hosts answer an unknown path with the app's own `index.html` and a 200, so
   * `response.ok` on a HEAD request is true whether or not the city exists.
   * Believing it is not a cosmetic mistake: the caller would hide the basemap's
   * extrusion, every tile fetch would return HTML, every parse would fail, and
   * the player would drive through a city with no buildings in it at all.
   */
  async probe(): Promise<boolean> {
    this.available = false;
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/building-tiles/index-z${this.zoom}.json`);
      if (!response.ok) return false;
      const index = (await response.json()) as { zoom?: number; tileList?: unknown };
      this.available = index.zoom === this.zoom && Array.isArray(index.tileList) && index.tileList.length > 0;
    } catch {
      // A JSON parse error here is the expected shape of "not published":
      // the host handed back a page instead of the index.
      this.available = false;
    }
    return this.available;
  }

  /**
   * Follow the camera. Safe to call on every `moveend` and from the game
   * `sync` loop when the centre tile or zoom bucket changes.
   *
   * Does **not** load on attach by itself: the MapLibre style boots centred on
   * Damrak, and fetching that neighbourhood before the route start is known
   * steals the pipe from the tile under the player.
   *
   * `onFirstBuildings` fires once, when a tile has actually been parsed and
   * carried buildings. The caller uses it to hide the basemap's own extrusion,
   * which must not happen a moment earlier: hiding it on the strength of a
   * successful probe alone would leave an empty map if the tiles turned out to
   * be unreadable.
   *
   * `onFeatures` fires whenever the resident set changes, so procedural roofs
   * can track the same working set as the extrusions.
   */
  attach(onFirstBuildings?: () => void, onFeatures?: (features: BuildingFeature[]) => void): void {
    if (!this.available) return;
    this.attached = true;
    this.onFirstBuildings = onFirstBuildings;
    this.onFeatures = onFeatures;
    this.map.on('moveend', () => this.followCamera());
  }

  setAppearancePriors(priors:ReadonlyMap<string,BuildingAppearancePrior>):void{this.appearancePriors=new Map(priors);this.decorated=new WeakMap();this.published=null;if(this.cache.size)this.flush();}

  /** Per-tile side data (e.g. construction years) fetched alongside each
   *  building tile; the returned function stamps it onto that tile's copies
   *  before they are adopted. Set before the first tile loads. */
  private tileEnricher?: TileEnricher;
  setTileEnricher(enricher: TileEnricher | undefined): void { this.tileEnricher = enricher; }

  /** A presentation step after `decorateBuildingFeature` (generic facades).
   *  Changing it restyles and resends the resident set once. */
  private featureDecorator?: (feature: BuildingFeature) => BuildingFeature;
  setFeatureDecorator(decorator: ((feature: BuildingFeature) => BuildingFeature) | undefined): void {
    this.featureDecorator = decorator;
    this.decorated = new WeakMap();
    this.published = null;
    if (this.cache.size) this.flush();
  }

  /** Tile → feature array MapLibre currently holds; null forces a full send. */
  private published: Map<string, BuildingFeature[]> | null = null;
  private countsDirty = true;

  /**
   * Styled copy of a resident feature, made once per feature per priors set.
   * Both the flush and the camera-clearance sample used to re-style every
   * resident building (up to 20 000) on every call; the clearance check runs
   * every 8 m of travel. Stable objects also let callers cache per feature.
   */
  private decorated = new WeakMap<BuildingFeature, BuildingFeature>();

  private styled(feature: BuildingFeature): BuildingFeature {
    let out = this.decorated.get(feature);
    if (!out) {
      out = decorateBuildingFeature(feature, this.appearancePriors);
      if (this.featureDecorator) out = this.featureDecorator(out);
      this.decorated.set(feature, out);
    }
    return out;
  }

  /**
   * Re-plan when the camera's centre tile or half-step zoom changes.
   * Called from `vector-map.sync` so the first driving frame targets the
   * start point, not the style's default centre.
   */
  /**
   * Hold tile planning while the camera sweeps (the start-of-ride flight),
   * then plan once for wherever it settled. `jumpTo` fires `moveend` every
   * frame, so gating the game's own call alone was not enough.
   */
  setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    if (!suspended) {
      this.preloadBounds = null;
      this.preloadSignature = '';
      this.lastFollowSignature = '';
      if (this.flushDirty) this.scheduleFlush();
      this.followCamera();
    }
  }

  private suspended = false;
  private preloadBounds: Bounds | null = null;
  private preloadSignature = '';

  /** Warm a fixed landing neighbourhood during the intro, without chasing its wide camera. */
  preloadAt(lng: number, lat: number): void {
    const signature = `${lng.toFixed(5)}/${lat.toFixed(5)}`;
    if (!this.available || !this.attached || this.disposed || signature === this.preloadSignature) return;
    this.preloadSignature = signature;
    const radiusM = 600, dy = radiusM / 111320, dx = dy / Math.cos(lat * Math.PI / 180);
    this.preloadBounds = { west: lng - dx, east: lng + dx, south: lat - dy, north: lat + dy };
    this.update();
  }

  followCamera(): void {
    if (this.suspended) return;
    // The caller replaces its GeoJSON source after probing and loading priors.
    // Loading before attach would populate the old source, then leave the new
    // source empty while the cache/signature incorrectly say it is current.
    if (!this.available || !this.attached || this.disposed) return;
    const centre = this.map.getCenter();
    const tile = tileFor(centre.lng, centre.lat, this.zoom);
    const zoomBucket = Math.round(this.map.getZoom() * 2) / 2;
    // The tiles the view needs, not just the centre: tilting or turning the
    // camera widens the visible ground without moving the centre tile or the
    // zoom bucket, and those tiles used to stay unrequested (bare patches).
    const needed = tilesCovering(this.bounds(), this.zoom, 0).map(tileKey).join(',');
    const signature = `${tileKey(tile)}@${zoomBucket}|${needed}`;
    if (signature === this.lastFollowSignature) return;
    this.lastFollowSignature = signature;
    this.update();
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.queue = [];
  }

  private bounds(): Bounds {
    const bounds = this.map.getBounds();
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }

  private update(): void {
    if (!this.available || this.disposed) return;
    // The LoD1 city is the gap-free fallback beneath optional detail. At game
    // zoom the viewport itself covers every required z14 tile; a neighbour
    // ring only multiplies residency during low-pitch clearance adjustments.
    const plan = planTiles(this.preloadBounds ?? this.bounds(), this.cache.heldKeys, { zoom: this.zoom, margin: 0, budget: 12 });
    const wantedKeys = new Set(plan.wanted);

    let changed = false;
    for (const key of plan.evict) {
      this.cache.drop(key);
      changed = true;
    }

    // Drop in-flight work the camera no longer needs so a Damrak prefetch
    // cannot keep eating bandwidth after the start jump.
    for (const [key, controller] of this.controllers) {
      if (wantedKeys.has(key)) continue;
      controller.abort();
      this.controllers.delete(key);
    }

    const inFlightKeys = new Set(this.controllers.keys());
    this.queue = plan.load.filter((tile) => {
      const key = tileKey(tile);
      return !this.empty.has(key) && !this.cache.has(key) && !inFlightKeys.has(key);
    });

    if (changed) this.scheduleFlush();
    this.pump();
  }

  private pump(): void {
    const limit = this.firstTileLanded ? BUILDING_TILE_LOAD_CONCURRENCY : 1;
    while (
      !this.disposed
      && this.inFlight < limit
      && this.queue.length > 0
    ) {
      const tile = this.queue.shift();
      if (!tile) break;
      void this.fetchTile(tile);
    }
  }

  private async fetchTile(tile: ReturnType<typeof planTiles>['load'][number]): Promise<void> {
    const key = tileKey(tile);
    if (this.cache.has(key) || this.empty.has(key) || this.controllers.has(key)) return;

    const controller = new AbortController();
    this.controllers.set(key, controller);
    this.inFlight++;
    // A stalled request must not hold the single-slot pipe forever.
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, BUILDING_TILE_TIMEOUT_MS);
    // Side data starts in parallel with the tile; its failure is swallowed so
    // a missing facts tile never costs the buildings themselves.
    const enrichment = this.tileEnricher
      ? this.tileEnricher(tile, controller.signal).catch(() => undefined)
      : undefined;
    let retry = false;
    try {
      const response = await fetch(tileUrl(tile, this.baseUrl), { signal: controller.signal });
      if (!response.ok) {
        // 404 is ordinary: most of the 382 tiles cover water, parks or the edge
        // of the region. Server trouble is not, and must not blank a city tile.
        if (response.status >= 500 || response.status === 429 || response.status === 408) retry = true;
        else this.empty.add(key);
        return;
      }
      const collection = await readGzippedGeoJson(response);
      if (controller.signal.aborted || this.disposed) return;
      // MapLibre's GeoJSON source tiles and may rewrite rings in place.
      // Pyramidal roofs need the original closed footprint, so keep our own
      // copy of coordinates before `setData`.
      const copies: BuildingFeature[] = (collection.features ?? []).map((feature) => ({
        type: 'Feature',
        properties: { ...(feature.properties || {}) },
        geometry: feature.geometry && JSON.parse(JSON.stringify(feature.geometry)),
      }));
      // Redundant nested copies (OSM outline + parts, BAG pand under an OSM way)
      // share walls and z-fight, so they are dropped; see `buildingNesting.ts`.
      const features = dropNestedDuplicates(copies);
      if (enrichment) {
        const apply = await enrichment;
        if (controller.signal.aborted || this.disposed) return;
        // Side data is optional: a bad enricher must not cost the buildings.
        try { if (apply) apply(features); } catch (error) { console.warn('Building tile enrichment failed', key, error); }
      }
      this.cache.adopt(key, features);
      this.failures.delete(key);
      this.firstTileLanded = true;
      if (!this.disposed) this.scheduleFlush();
    } catch (error) {
      // Our own abort (camera moved on) is not a failure, whatever name the
      // browser gives it; a timeout is, and is retried.
      if (this.disposed) return;
      if (controller.signal.aborted && !timedOut) return;
      // A fetch that rejects is the network; a parse error is the host handing
      // back a page for a tile that does not exist.
      if (timedOut || error instanceof TypeError) retry = true;
      else this.empty.add(key);
    } finally {
      clearTimeout(timeout);
      // Only remove our own controller: an aborted fetch's cleanup must not
      // unregister the replacement fetch for the same tile.
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
      this.inFlight = Math.max(0, this.inFlight - 1);
      if (retry) this.scheduleRetry(key);
      this.pump();
    }
  }

  private scheduleRetry(key: string): void {
    const attempts = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, attempts);
    if (attempts > BUILDING_TILE_MAX_RETRIES) { this.empty.add(key); return; }
    setTimeout(() => { if (!this.disposed) this.update(); }, 1000 * 2 ** (attempts - 1));
  }

  /** Ask for a flush on the next animation frame; repeated calls coalesce. */
  private scheduleFlush(): void {
    this.flushDirty = true;
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const run = () => {
      this.flushScheduled = false;
      // Ordinary camera-driven arrivals wait during a flight. A fixed landing
      // preload may publish now so geometry is ready before the player arrives.
      if (!this.flushDirty || this.disposed || this.suspended && !this.preloadBounds) return;
      this.flushDirty = false;
      this.flush();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  private flush(): void {
    const collection = this.cache.collection();
    const features = collection.features.map(feature => this.styled(feature));
    this.countsDirty = true;
    this.onFeatures?.(features);
    const source = this.map.getSource(this.sourceId);
    if (source) this.sendToSource(source, features);
    if (features.length > 0 && this.onFirstBuildings) {
      const announce = this.onFirstBuildings;
      this.onFirstBuildings = undefined;
      announce();
    }
  }

  /**
   * Send MapLibre only what changed since the last flush: remove the ids of
   * tiles that left, add clones of tiles that arrived. Re-sending (and deep-
   * cloning) every resident building on each tile arrival was the ~130 ms
   * spike a throttled phone showed while riding. Any failure falls back to a
   * full `setData`, the previous behaviour. `updateData` only queues the diff:
   * MapLibre reports a rejected diff (say, a missing or duplicate id) later as
   * the source's `error` event, not as a throw, so that event resets the
   * published snapshot and resends everything.
   */
  private sendToSource(source: GeoJsonSource, features: BuildingFeature[]): void {
    const resident = this.cache.entries();
    const snapshot = new Map(resident);
    const full = () => {
      // Deep-clone for MapLibre: the GeoJSON source may rewrite rings in place.
      source.setData(JSON.parse(JSON.stringify({ type: 'FeatureCollection', features })));
      this.published = snapshot;
    };
    if (!this.published || typeof source.updateData !== 'function') { full(); return; }
    this.watchForDiffErrors(source);
    const plan = planSourceDiff(this.published, resident, feature => String(feature.properties?.id ?? ''));
    if (!plan.removeIds.length && !plan.addTiles.length) return;
    try {
      const add: BuildingFeature[] = [];
      for (const key of plan.addTiles) for (const feature of resident.get(key) ?? []) add.push(this.styled(feature));
      source.updateData({ remove: plan.removeIds, add: JSON.parse(JSON.stringify(add)) });
      this.published = snapshot;
    } catch (error) {
      console.warn('Building source diff failed; resending the whole set', error);
      full();
    }
  }

  private watchedSources = new WeakSet<GeoJsonSource>();
  private watchForDiffErrors(source: GeoJsonSource): void {
    if (this.watchedSources.has(source) || typeof source.on !== 'function') return;
    this.watchedSources.add(source);
    source.on('error', error => {
      if (!this.published) return;
      console.warn('Building source diff failed; resending the whole set', error);
      this.published = null;
      this.flush();
    });
  }

  private refreshCounts(): void {
    if (!this.countsDirty) return;
    this.countsDirty = false;
    let styled = 0, contextual = 0, grounds = 0, roofs = 0;
    for (const raw of this.cache.collection().features) {
      const properties = this.styled(raw).properties;
      if (properties.appearanceStyleSource === 'procedural-prior-not-measured') styled++;
      if (properties.appearanceStyleSource === 'citywide-identity-palette-v3-not-measured') contextual++;
      if (properties.groundAppearanceStyleSource === 'wall-inherited-not-independently-measured') grounds++;
      if (properties.roofAppearanceStyleSource === 'citywide-flat-cap-palette-v3-not-measured') roofs++;
    }
    this.styledFeatures = styled; this.contextualFeatures = contextual;
    this.contextualGrounds = grounds; this.contextualRoofs = roofs;
  }

  /** The resident building a landmark card is about; see `buildingForLandmark`. */
  buildingForLandmark(query: LandmarkBuildingQuery): string | null {
    return buildingForLandmark(this.cache.collection().features, query, feature => String(feature.properties?.id ?? ''));
  }

  /** For diagnostics: how much of the city is resident right now. */
  sampleFeatures(limit=400):BuildingFeature[]{return this.cache.collection().features.slice(0,Math.max(0,limit)).map(feature=>this.styled(feature));}

  status(): { tiles: number; features: number; styledFeatures:number; contextualFeatures:number; contextualGrounds:number; contextualRoofs:number; inFlight: number; available: boolean; queued: number } {
    this.refreshCounts();
    return {
      tiles: this.cache.size,
      features: this.cache.collection().features.length,
      styledFeatures:this.styledFeatures,contextualFeatures:this.contextualFeatures,contextualGrounds:this.contextualGrounds,contextualRoofs:this.contextualRoofs,
      inFlight: this.inFlight,
      available: this.available,
      queued: this.queue.length,
    };
  }
}
