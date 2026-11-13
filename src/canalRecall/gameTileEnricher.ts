// The game's building-tile enricher, in one place (#129 round 23): construction years (building-facts), measured roofs
// (roof-facts, unless ?roofFacts=0) and then the rail infrastructure table (railInfraBuildings.ts: viaduct and deck
// pands dropped, platform canopies cut to the platforms). The own engine's live tile path (ownWorldView) and the world
// compiler (scripts/world/pipeline.ts, whose cells the runtime adopts without enriching) both call this, so the two
// paths cannot drift: world-v1 cells baked without the rail table drew the viaducts as houses on the default world.
// The facts library is passed in: the browser reads it from the facades bundle's global, the compiler imports it.
import { composeTileEnrichers, railInfraEnricher } from './railInfraBuildings.js';
import { industrialEnricher } from './industrial/industrialTable.js';
import { ridgeAxesEnabled, ridgeAxesEnricher } from './roofs/ridgeFacts.js';
import { houseSpecEnricher, houseSpecsEnabled } from './houseSpec/decorate.js';

type Tile = { z: number; x: number; y: number };
type Enricher = (tile: Tile, signal: AbortSignal) => Promise<((features: any[]) => void) | undefined | void>;

/** The genericFacades / roofFacts functions the enricher composes (CanalRecallBuildings.Facades in the browser). */
export interface TileFactsLib {
  constructionYearEnricher(baseUrl: string, fetchImpl?: typeof fetch): Enricher | ((tile: Tile, signal?: AbortSignal) => Promise<unknown>);
  roofFactsEnricher?(baseUrl: string, fetchImpl?: typeof fetch): Enricher | ((tile: Tile, signal?: AbortSignal) => Promise<unknown>);
  composeEnrichers?(...enrichers: unknown[]): unknown;
  roofFactsEnabled?(search?: string): boolean;
}

export interface GameTileEnricherOptions {
  /** Fetch for the side files (the compiler reads the extract directory through one); default the global fetch. */
  fetch?: typeof fetch;
  /** The query `?roofFacts=0` / `?houseSpecs=0` is read from; default the page's (the compiler passes ''). */
  search?: string;
  /** HouseSpecs on/off (houseSpec/decorate.ts houseSpecsEnabled); default from `search` (the compiler passes HOUSE_SPECS). */
  houseSpecs?: boolean;
  /** Extract directory of the spec tiles (default `house-specs`; the lane's verification reads `staging/house-specs`). */
  houseSpecsDir?: string;
  /** Extract directory of the ridge-axes tiles (default `ridge-axes`; a staged compile reads `staging/ridge-axes`). */
  ridgeAxesDir?: string;
}

/** Years, then roof facts, then the rail infrastructure table, then the industrial table (industrial/industrialTable.ts),
 *  then HouseSpecs (houseSpec/decorate.ts, `?houseSpecs=0` off), for tiles under `extractPath`. */
export function gameTileEnricher(lib: TileFactsLib, extractPath: string, options: GameTileEnricherOptions = {}): Enricher {
  const { fetch: fetchImpl } = options;
  const years = lib.constructionYearEnricher(extractPath, fetchImpl) as Enricher;
  const roofs = lib.composeEnrichers && lib.roofFactsEnricher && (lib.roofFactsEnabled ? lib.roofFactsEnabled(options.search) : true);
  const facts = roofs ? lib.composeEnrichers!(years, lib.roofFactsEnricher!(extractPath, fetchImpl)) as Enricher : years;
  const json = fetchImpl ? (url: string) => fetchImpl(url).then(r => (r.ok ? r.json() : null)) : undefined;
  const tables0 = composeTileEnrichers(composeTileEnrichers(facts as any, railInfraEnricher(extractPath, json)), industrialEnricher(extractPath, json) as any) as Enricher;
  // 3DBAG's measured ridge direction (roofs/ridgeFacts.ts; `?ridgeAxes=0` off): the roof planner draws the saddle along it.
  const tables = (options.search === undefined ? ridgeAxesEnabled() : ridgeAxesEnabled(options.search)) ? composeTileEnrichers(tables0 as any, ridgeAxesEnricher(extractPath, fetchImpl, options.ridgeAxesDir) as any) as Enricher : tables0;
  // HouseSpecs last: they stamp `p.houseSpec` on the pands that survive the rail table (house line H1).
  const page = options.search ?? (typeof location !== 'undefined' ? location.search : '');
  const specs = options.houseSpecs ?? houseSpecsEnabled(page);
  return specs ? composeTileEnrichers(tables as any, houseSpecEnricher(extractPath, fetchImpl, options.houseSpecsDir) as any) as Enricher : tables;
}
