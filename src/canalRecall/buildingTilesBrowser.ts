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

import {
  BuildingTileCache, BUILDING_TILE_ZOOM, planTiles, tileUrl,
  type BuildingFeature, type Bounds
} from './buildingTileSource.js';
import { tileFor, tileKey } from './slippyTiles.js';
import { citywideBuildingGroundPrior, citywideBuildingRoofPrior, citywideBuildingWallPrior } from './cityAppearancePalette.js';

type GeoJsonSource = { setData(data: unknown): void };
export type BuildingAppearancePrior={id:string;sourceId:string;geometryRevision:string;constructionYear:number|null;sideColour:string;roofColour:string;groundColour:string;groundFloorHeightM:number;roofShape:string|null;roofEavesHeightM:number|null;roofGeometrySource:string|null};
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
  const response=await fetcher(artifact.url);if(!response.ok)throw Error('Appearance sidecar unavailable');const bytes=await response.arrayBuffer();if(await hex(bytes)!==artifact.sha256)throw Error('Appearance sidecar hash mismatch');const value=JSON.parse(new TextDecoder().decode(bytes));if(value.version!==1||value.releaseId!==pointer.releaseId||value.areaId!==pointer.areaId||value.styleSource!=='procedural-prior-not-measured'||value.sourceBlockSha256!==pointer.sourceHashes?.block||!Array.isArray(value.buildings)||value.buildings.length!==artifact.buildings)throw Error('Appearance sidecar release binding mismatch');
  const priors=new Map<string,BuildingAppearancePrior>();for(const item of value.buildings){if(!/^NL\.IMBAG\.Pand\.\d+$/.test(item?.id)||!/^[a-f0-9]{64}$/.test(item.geometryRevision)||!/^#[a-f0-9]{6}$/i.test(item.sideColour)||!/^#[a-f0-9]{6}$/i.test(item.roofColour)||!/^#[a-f0-9]{6}$/i.test(item.groundColour)||!Number.isFinite(item.groundFloorHeightM)||item.groundFloorHeightM<2.5||item.groundFloorHeightM>5||!['source-slanted','flat',null].includes(item.roofShape)||item.roofEavesHeightM!==null&&(!Number.isFinite(item.roofEavesHeightM)||item.roofEavesHeightM<0||item.roofEavesHeightM>100)||item.roofGeometrySource!==null&&item.roofGeometrySource!=='3dbag-lod22-roof-surfaces'||priors.has(item.id))throw Error('Invalid appearance sidecar building');priors.set(item.id,item);}const route=value.studyRoute;if(route?.source!=='guided-route-source-graph'||!Number.isFinite(route.distanceM)||route.distanceM<100||![route.from,route.to].every(poi=>poi&&typeof poi.name==='string'&&[poi.lat,poi.lng].every(Number.isFinite)))throw Error('Invalid appearance sidecar study route');return{releaseId:value.releaseId,areaId:value.areaId,priors,studyRoute:route};
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
  if(prior)return{...feature,properties:{...properties,sideColour:prior.sideColour,roofColour:prior.roofColour,groundColour:prior.groundColour,groundFloorHeightM:prior.groundFloorHeightM,roofShape:prior.roofShape,roofEavesHeightM:prior.roofEavesHeightM,roofGeometrySource:prior.roofGeometrySource,constructionYear:prior.constructionYear,appearanceStyleSource:'procedural-prior-not-measured',appearanceGeometryRevision:prior.geometryRevision}};
  if(!/^NL\.IMBAG\.Pand\.\d+$/.test(id))return feature;
  const additions:Record<string,unknown>={};
  if(!['sideColour','colour','color','material'].some(key=>present(properties[key]))){additions.sideColour=citywideBuildingWallPrior(id);additions.groundColour=citywideBuildingGroundPrior(id);additions.groundFloorHeightM=3.2;additions.appearanceStyleSource='citywide-identity-palette-v2-not-measured';additions.wallAppearanceStyleSource='citywide-identity-palette-v2-not-measured';additions.groundAppearanceStyleSource='citywide-ground-storey-palette-v1-not-measured';}
  if(!present(properties.roofColour)&&(!present(properties.roofShape)||properties.roofShape==='flat')){additions.roofColour=citywideBuildingRoofPrior(id);additions.roofAppearanceStyleSource='citywide-flat-cap-palette-v2-not-measured';}
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

export class BuildingTileStreamer {
  private readonly cache = new BuildingTileCache();
  /** Tiles that returned nothing. Remembered so a gap is not refetched forever. */
  private readonly empty = new Set<string>();
  /** In-flight fetches, keyed so a camera jump can abort the ones we no longer want. */
  private readonly controllers = new Map<string, AbortController>();
  /** Nearest-first remaining work for the current plan. */
  private queue: ReturnType<typeof planTiles>['load'] = [];
  private inFlight = 0;
  private onFirstBuildings?: () => void;
  private onFeatures?: (features: BuildingFeature[]) => void;
  private available = false;
  private disposed = false;
  private appearancePriors=new Map<string,BuildingAppearancePrior>();
  private styledFeatures=0;
  private contextualFeatures=0;
  private contextualGrounds=0;
  private contextualRoofs=0;
  /** Last camera signature we planned for — avoids re-planning every jumpTo frame. */
  private lastFollowSignature = '';

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
    this.onFirstBuildings = onFirstBuildings;
    this.onFeatures = onFeatures;
    this.map.on('moveend', () => this.followCamera());
  }

  setAppearancePriors(priors:ReadonlyMap<string,BuildingAppearancePrior>):void{this.appearancePriors=new Map(priors);if(this.cache.size)this.flush();}

  /**
   * Re-plan when the camera's centre tile or half-step zoom changes.
   * Called from `vector-map.sync` so the first driving frame targets the
   * start point, not the style's default centre.
   */
  followCamera(): void {
    if (!this.available || this.disposed) return;
    const centre = this.map.getCenter();
    const tile = tileFor(centre.lng, centre.lat, this.zoom);
    const zoomBucket = Math.round(this.map.getZoom() * 2) / 2;
    const signature = `${tileKey(tile)}@${zoomBucket}`;
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
    const plan = planTiles(this.bounds(), this.cache.heldKeys, { zoom: this.zoom });
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

    if (changed) this.flush();
    this.pump();
  }

  private pump(): void {
    while (
      !this.disposed
      && this.inFlight < BUILDING_TILE_LOAD_CONCURRENCY
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
    try {
      const response = await fetch(tileUrl(tile, this.baseUrl), { signal: controller.signal });
      if (!response.ok) {
        // Most of the 382 tiles cover water, parks or the edge of the
        // region. A missing one is ordinary, not an error worth retrying.
        this.empty.add(key);
        return;
      }
      const collection = await readGzippedGeoJson(response);
      if (controller.signal.aborted || this.disposed) return;
      // MapLibre's GeoJSON source tiles and may rewrite rings in place.
      // Pyramidal roofs need the original closed footprint, so keep our own
      // copy of coordinates before `setData`.
      const features: BuildingFeature[] = (collection.features ?? []).map((feature) => ({
        type: 'Feature',
        properties: { ...(feature.properties || {}) },
        geometry: feature.geometry && JSON.parse(JSON.stringify(feature.geometry)),
      }));
      this.cache.adopt(key, features);
      if (!this.disposed) this.flush();
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      this.empty.add(key);
    } finally {
      this.controllers.delete(key);
      this.inFlight = Math.max(0, this.inFlight - 1);
      this.pump();
    }
  }

  private flush(): void {
    const source = this.cache.collection(),features=source.features.map(feature=>decorateBuildingFeature(feature,this.appearancePriors)),collection={...source,features};this.styledFeatures=features.filter(feature=>feature.properties.appearanceStyleSource==='procedural-prior-not-measured').length;this.contextualFeatures=features.filter(feature=>feature.properties.appearanceStyleSource==='citywide-identity-palette-v2-not-measured').length;this.contextualGrounds=features.filter(feature=>feature.properties.groundAppearanceStyleSource==='citywide-ground-storey-palette-v1-not-measured').length;this.contextualRoofs=features.filter(feature=>feature.properties.roofAppearanceStyleSource==='citywide-flat-cap-palette-v2-not-measured').length;
    this.onFeatures?.(collection.features);
    this.map.getSource(this.sourceId)?.setData(JSON.parse(JSON.stringify(collection)));
    if (collection.features.length > 0 && this.onFirstBuildings) {
      const announce = this.onFirstBuildings;
      this.onFirstBuildings = undefined;
      announce();
    }
  }

  /** For diagnostics: how much of the city is resident right now. */
  sampleFeatures(limit=400):BuildingFeature[]{return this.cache.collection().features.slice(0,Math.max(0,limit)).map(feature=>decorateBuildingFeature(feature,this.appearancePriors));}

  status(): { tiles: number; features: number; styledFeatures:number; contextualFeatures:number; contextualGrounds:number; contextualRoofs:number; inFlight: number; available: boolean; queued: number } {
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
