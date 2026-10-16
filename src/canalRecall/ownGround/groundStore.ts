// Streaming data for the own ground in the game (DOM-free; runs in the ground
// worker and on the main thread). docs/research/own-ground-20261009.md.
//
// Cells are the elevation-v1 1 km cells (axis-aligned rectangles in the game's
// local frame, since both frames are equirectangular about the same origin).
// Per cell the store provides: the relief around it (RD 1 km tiles from
// ground-height-v1), its water polygons and shores (elevation-v1), its
// measured and flat bridge decks (elevation-v1 bridges.json, placed on the
// relief), and its OSM ground (own-ground-osm-v1/cells: a way belongs to the
// cell of its midpoint, an area to the cell of its bbox centre).
//
// One `GroundSurface` serves the whole streamed area: its local → RD map is a
// quadratic fit about the origin over ±9 km (residual < 1 cm, measured), so
// heights agree exactly between the worker and the main thread.

import { lngLatToRd } from '../facade/rdNew.js';
import { cellKey, localToLngLat, validateIndex, type BridgeExtract, type ElevationIndex, type WaterCell } from '../elevation/elevationData.js';
import { decodeFallback, decodeProfile } from '../elevation/bridgeDeck.js';
import { applyLocalToRd, extendTile, fitLocalToRd, GroundField, readGroundTile, tileKey, type GroundIndex } from './heightField.js';
import { GroundSurface, type DeckSurface, type Vec2 } from './surface.js';
import type { OsmGroundExtract } from './osmGround.js';
import type { ParksCell, ParksManifest } from './parks.js';
import { decodeRoadLine, type RoadCell, type RoadsManifest } from './roadCells.js';
import type { CourtyardsCell, CourtyardsManifest } from './courtyards.js';
import { openUnderFootbridges, waterZAt, type OpeningDeck, type WaterGeometry } from './water.js';
import { openUnderHouseboats, type Boat } from './moorings.js';
import type { CellInput } from './groundCell.js';
import { farBlockCells, type FarBlockInput } from './farRing.js';
import { movableApproaches, pointInRing } from './decks.js';
import { prepareWays, isBridgeWay } from './streets.js';
import { WAY_DECK_CLEAR_M, wayDeckGroups, wayDeckHighway, type WayDeckInput } from './wayDecks.js';
import { landedPlatformRings } from './landedPlatforms.js';

/** The game's local frame (galleryPipeline.toLocal), duplicated so the worker bundle stays small. */
export const GAME_ORIGIN = { lng: 4.9, lat: 52.37 } as const;
const KX = 111_320 * Math.cos(GAME_ORIGIN.lat * Math.PI / 180), KY = 110_540;
export const toLocal = (lng: number, lat: number): Vec2 => [(lng - GAME_ORIGIN.lng) * KX, (lat - GAME_ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): Vec2 => [GAME_ORIGIN.lng + x / KX, GAME_ORIGIN.lat + y / KY];

export const EXTRACTS = { relief: 'ground-height-v1', osm: 'own-ground-osm-v1', water: 'elevation-v1', parks: 'parks-v1', roads: 'roads-v1', courtyards: 'courtyards-v1' } as const;
/** Water surface, scene z (canal level −0.40 NAP below the +1.37 NAP datum). */
export const WATER_Z = -1.77;
/** Relief loaded this far around a cell before it is built (decks and streets reach past its edge). */
export const CELL_RELIEF_PAD_M = 350;

/** Fetch an extract file (path relative to the extract root), gunzipped. */
export type FetchBytes = (path: string) => Promise<Uint8Array>;

/** elevation-v1/water-levels.json (scripts/own-ground/build-polder-levels.ts): NAP metres per cell polygon / shore, a number when uniform. */
export interface WaterLevels { version: 1; defaultNap: number; cells: Record<string, { p: number | number[]; s: number | number[] }> }

export interface OsmCellsManifest { version: 1; area: string; cellSizeM: number; cells: string[]; fetched?: string; attribution?: string }

export type Rect = [number, number, number, number];

export class GroundStore {
  relief!: GroundIndex;
  elevation!: ElevationIndex;
  osmCells = new Set<string>();
  /** Cells of the parks-v1 extract (empty when parks are off or the extract is missing). */
  parkCells = new Set<string>();
  /** Cells of the roads-v1 extract (empty when roads are off or the extract is missing); other cells keep the OSM bands. */
  roadCells = new Set<string>();
  /** Cells of the courtyards-v1 extract (BGT block interiors, courtyards.ts; empty when off or missing). */
  courtyardCells = new Set<string>();
  field!: GroundField;
  surface!: GroundSurface;
  private bridges: BridgeExtract | null = null;
  private readonly reliefTiles = new Set<string>();
  private readonly reliefLoading = new Map<string, Promise<void>>();
  private readonly water = new Map<string, Promise<WaterGeometry | null>>();
  private readonly osm = new Map<string, Promise<OsmGroundExtract | null>>();
  private readonly parks = new Map<string, Promise<ParksCell | null>>();
  private readonly roads = new Map<string, Promise<RoadCell | null>>();
  private readonly courtyards = new Map<string, Promise<CourtyardsCell | null>>();
  /** Polder water levels (null: the extract has none, every polygon sits at WATER_Z). */
  waterLevels: WaterLevels | null = null;
  /** Resident cells' water, for `waterZAt`. */
  private readonly waterResident = new Map<string, WaterGeometry>();
  /** Measured deck surfaces per cell (placed once the cell's relief is resident). */
  private readonly decksByCell = new Map<string, DeckSurface[]>();
  private readonly flatByCell = new Map<string, Vec2[][]>();
  private measuredByCell = new Map<string, BridgeExtract['measured']>();
  private fallbackByCell = new Map<string, BridgeExtract['fallback']>();
  readonly loadedBytes = { relief: 0, water: 0, osm: 0, parks: 0, roads: 0, courtyards: 0 };

  /** `parks`: load the parks-v1 extract (BGT park surfaces and furniture, parks.ts); off with `?parks=0`. */
  /** `courtyards`: load the courtyards-v1 extract (BGT courtyard and back-garden cover); off for the regression's before. */
  /** `moorings`: open the water under houseboats the generalised water cuts (moorings.ts); off for the regression's before. */
  /** `roads`: load the roads-v1 extract (BGT road partition, roadSurfaces.ts); phase 1 is opt-in (`?roads=bgt`), so the default is off. */
  /**
   * `reliefTile`: fetch and decode one relief tile elsewhere (the game passes a worker, so the gunzip and
   * the predictor decode of every tile under the rider's ring leave the main thread; the motion profile had
   * them in 100–200 ms bursts, docs/perf-motion-stutter-20261016.md). Same decode, same heights.
   */
  constructor(private readonly fetchBytes: FetchBytes, private readonly options: { parks?: boolean; courtyards?: boolean; openings?: boolean; moorings?: boolean; approaches?: boolean; clipDecks?: boolean; roads?: boolean; reliefTile?: ReliefTileLoader; /** Decks for OSM bridge ways the extract does not carry (wayDecks.ts); default on. */ wayDecks?: boolean } = {}) {}
  /** Houseboat footprints (houseboats.json, game frame), by elevation cell of their centroid. */
  private boatsByCell = new Map<string, Boat[]>();
  /** Boats whose berth was opened, per cell (named regressions, the lane report). */
  readonly openedBerths = new Map<string, string[]>();

  private async json<T>(path: string): Promise<T> {
    return JSON.parse(new TextDecoder().decode(await this.fetchBytes(path))) as T;
  }

  async init(): Promise<void> {
    const [relief, elevation, bridges, manifest, levels] = await Promise.all([
      this.json<GroundIndex>(`${EXTRACTS.relief}/index.json`),
      this.json<unknown>(`${EXTRACTS.water}/index.json`).then(validateIndex),
      this.json<BridgeExtract>(`${EXTRACTS.water}/bridges.json`),
      this.json<OsmCellsManifest>(`${EXTRACTS.osm}/cells.json`).catch(() => null),
      this.json<WaterLevels>(`${EXTRACTS.water}/water-levels.json`).catch(() => null),
    ]);
    const boats = this.options.moorings === false ? null : await this.json<{ boats: { id: string; ring: [number, number][] }[] }>('houseboats.json').catch(() => null);
    const parks = this.options.parks === false ? null : await this.json<ParksManifest>(`${EXTRACTS.parks}/cells.json`).catch(() => null);
    this.parkCells = new Set(parks?.version === 1 ? parks.cells : []);
    const roads = this.options.roads === true ? await this.json<RoadsManifest>(`${EXTRACTS.roads}/cells.json`).catch(() => null) : null;
    this.roadCells = new Set(roads?.version === 1 ? roads.cells : []);
    const courtyards = this.options.courtyards === false ? null : await this.json<CourtyardsManifest>(`${EXTRACTS.courtyards}/cells.json`).catch(() => null);
    this.courtyardCells = new Set(courtyards?.version === 1 ? courtyards.cells : []);
    this.waterLevels = levels?.version === 1 ? levels : null;
    this.relief = relief;
    this.elevation = elevation;
    this.bridges = bridges;
    this.osmCells = new Set(manifest?.cells ?? []);
    this.field = new GroundField(relief.stepM, relief.tileSizeM);
    const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
    const { map } = fitLocalToRd(toRd, 0, 0, 9000);
    this.surface = new GroundSurface(this.field, map, relief.sceneDatumNAP);
    const quant = elevation.quantization.xy, size = elevation.cellSizeM;
    const cellOf = (x: number, y: number) => cellKey(Math.floor(x * quant / size), Math.floor(y * quant / size));
    this.measuredByCell = new Map();
    for (const b of bridges.measured) { const k = cellOf(b.p[0], b.p[1]); (this.measuredByCell.get(k) ?? this.measuredByCell.set(k, []).get(k)!).push(b); }
    this.fallbackByCell = new Map();
    for (const b of bridges.fallback) { const k = cellOf(b.ring[0], b.ring[1]); (this.fallbackByCell.get(k) ?? this.fallbackByCell.set(k, []).get(k)!).push(b); }
    this.boatsByCell = new Map();
    for (const b of boats?.boats ?? []) {
      if (b.ring.length < 4) continue;
      const ring = b.ring.map(([lng, lat]) => toLocal(lng, lat));
      const k = this.cellAt(ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length);
      (this.boatsByCell.get(k) ?? this.boatsByCell.set(k, []).get(k)!).push({ id: b.id, ring });
    }
  }

  /** elevation-v1 storage metres → game local metres. */
  toScene = (x: number, y: number): Vec2 => { const [lng, lat] = localToLngLat(this.elevation, x, y); return toLocal(lng, lat); };

  /** A cell's rectangle in the game frame. */
  cellRect(key: string): Rect {
    const [cx, cy] = key.split('_').map(Number), s = this.elevation.cellSizeM;
    const [x0, y0] = this.toScene(cx * s, cy * s), [x1, y1] = this.toScene((cx + 1) * s, (cy + 1) * s);
    return [x0, y0, x1, y1];
  }

  /** Cell key containing a game-frame point. */
  cellAt(x: number, y: number): string {
    const [lng, lat] = fromLocal(x, y), s = this.elevation.cellSizeM;
    const ex = (lng - this.elevation.origin[0]) * this.elevation.metresPerDegree[0], ey = (lat - this.elevation.origin[1]) * this.elevation.metresPerDegree[1];
    return cellKey(Math.floor(ex / s), Math.floor(ey / s));
  }

  /**
   * Does the ground draw this cell? It needs its OSM cell and relief under at
   * least part of it: a partly covered edge cell is drawn whole, its missing
   * relief tiles extended from their neighbours (`synthesiseTile`), so the
   * basemap no longer shows through at the streaming area's edge.
   */
  covers(key: string): boolean {
    if (!this.osmCells.has(key)) return false;
    const [x0, y0, x1, y1] = this.cellRect(key);
    return this.rdTilesFor([x0 + 1, y0 + 1, x1 - 1, y1 - 1]).some(k => this.hasReliefTile(k));
  }

  /** Is the cell's relief all measured (no extended tiles)? Diagnostics. */
  fullyCovered(key: string): boolean {
    if (!this.osmCells.has(key)) return false;
    const [x0, y0, x1, y1] = this.cellRect(key);
    return this.rdTilesFor([x0 + 1, y0 + 1, x1 - 1, y1 - 1]).every(k => this.hasReliefTile(k));
  }

  private tileSet: Map<string, readonly number[]> | null = null;
  private tileEntry(k: string): readonly number[] | undefined { return (this.tileSet ??= new Map(this.relief.tiles.map(t => [tileKey(t[0], t[1]), t]))).get(k); }
  private hasReliefTile(k: string): boolean { return !!this.tileEntry(k); }
  /** Extract tiles among the 8 neighbours of a tile key. */
  private reliefNeighbours(k: string): string[] {
    const [tx, ty] = k.split('_').map(Number), out: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.hasReliefTile(tileKey(tx + dx, ty + dy))) out.push(tileKey(tx + dx, ty + dy));
    return out;
  }
  /** Relief is available for a tile: in the extract, or extendable from an extract neighbour. */
  private reliefAvailable(k: string): boolean { return this.hasReliefTile(k) || this.reliefNeighbours(k).length > 0; }

  /** Does the extract have relief at this game-frame point at all (resident or not, measured or extended)? */
  reliefCovered(x: number, y: number): boolean {
    const p = lngLatToRd(fromLocal(x, y)), T = this.relief.tileSizeM;
    return this.reliefAvailable(tileKey(Math.floor(p.x / T), Math.floor(p.y / T)));
  }

  /** Tiles extended from their neighbours (not in the extract), resident now. */
  readonly synthesised = new Set<string>();

  /**
   * A tile the extract lacks, next to tiles it has: the neighbours' samples
   * on a 3×3-tile canvas, pull-push filled (heightField.ts), centre kept. The
   * relief continues smoothly past the extract's edge and flattens toward
   * the neighbours' mean instead of dropping to the flat fallback in a step.
   * Deterministic from the extract, so worker and main thread agree.
   */
  private synthesiseTile(k: string): void {
    const [tx, ty] = k.split('_').map(Number);
    // Extract tiles only (never another extended tile): deterministic.
    this.field.addTile(tx, ty, extendTile(this.field, tx, ty, (a, b) => this.hasReliefTile(tileKey(a, b))));
    this.reliefTiles.add(k);
    this.synthesised.add(k);
  }

  private rdTilesFor([x0, y0, x1, y1]: Rect): string[] {
    const T = this.relief.tileSizeM, keys = new Set<string>();
    const toRd = (x: number, y: number) => lngLatToRd(fromLocal(x, y));
    const cs = [toRd(x0, y0), toRd(x1, y0), toRd(x0, y1), toRd(x1, y1)];
    for (let tx = Math.floor(Math.min(...cs.map(c => c.x)) / T); tx <= Math.floor(Math.max(...cs.map(c => c.x)) / T); tx++)
      for (let ty = Math.floor(Math.min(...cs.map(c => c.y)) / T); ty <= Math.floor(Math.max(...cs.map(c => c.y)) / T); ty++) keys.add(tileKey(tx, ty));
    return [...keys];
  }

  /** Load the relief tiles under a game-frame rectangle (missing tiles are simply absent: flat fallback). */
  async ensureRelief(rect: Rect): Promise<void> {
    const keys = this.rdTilesFor(rect);
    // Tiles to extend need all their extract neighbours resident first.
    const extend = keys.filter(k => !this.hasReliefTile(k) && !this.reliefTiles.has(k) && this.reliefNeighbours(k).length);
    const load = new Set([...keys.filter(k => this.hasReliefTile(k)), ...extend.flatMap(k => this.reliefNeighbours(k))]);
    await this.loadTiles([...load]);
    for (const k of extend) if (!this.reliefTiles.has(k)) this.synthesiseTile(k);
  }

  private async loadTiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => {
      if (this.reliefTiles.has(k)) return undefined;
      let p = this.reliefLoading.get(k);
      if (!p) {
        const path = `${EXTRACTS.relief}/tiles/${k}.bin`, entry = this.tileEntry(k)!;
        const load = this.options.reliefTile
          ? this.options.reliefTile(path, this.relief, entry)
          : this.fetchBytes(path).then(bytes => ({ heights: readGroundTile(this.relief, entry, bytes), bytes: bytes.byteLength }));
        p = load.then(({ heights, bytes }) => {
          this.loadedBytes.relief += bytes;
          const [tx, ty] = k.split('_').map(Number);
          this.field.addTile(tx, ty, heights);
          this.reliefTiles.add(k);
        }).finally(() => this.reliefLoading.delete(k));
        this.reliefLoading.set(k, p);
      }
      return p;
    }));
  }

  get reliefTileCount(): number { return this.reliefTiles.size; }

  /** Is measured (or filled) relief resident under this game-frame point? */
  hasRelief(x: number, y: number): boolean {
    if (!this.surface) return false;
    const [rx, ry] = applyLocalToRd(this.surface.localToRd, x, y);
    return this.field.heightRd(rx, ry) === this.field.heightRd(rx, ry);
  }

  /** Drop relief tiles whose centre is farther than `keepM` from a game-frame point. */
  evictRelief(x: number, y: number, keepM: number): number {
    const T = this.relief.tileSizeM, [rx, ry] = (() => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; })();
    let n = 0;
    for (const k of [...this.reliefTiles]) {
      const [tx, ty] = k.split('_').map(Number);
      if (Math.hypot((tx + 0.5) * T - rx, (ty + 0.5) * T - ry) <= keepM) continue;
      this.field.removeTile(tx, ty);
      this.reliefTiles.delete(k);
      this.synthesised.delete(k);
      n++;
    }
    return n;
  }

  /**
   * Make a cell ready to build or sample: its relief (plus pad) and its
   * measured decks placed on it. Decks are placed once and kept (a few
   * hundred at most city-wide; their heights are fixed at placement).
   */
  async prepareCell(key: string): Promise<void> {
    const [x0, y0, x1, y1] = this.cellRect(key), pad = CELL_RELIEF_PAD_M;
    await this.ensureRelief([x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
    this.placeDecks(key);
    // A bridge belongs to the cell of its first station but may reach into
    // this one: place neighbours' decks too, so streets and the rider here
    // see the hump (their approach ends lie within the relief pad).
    for (const n of GroundStore.neighbours(key)) if (n !== key) this.placeDecks(n, [x0 - 60, y0 - 60, x1 + 60, y1 + 60]);
    if (this.options.wayDecks !== false) await this.placeWayDecks(key);
  }

  /** OSM bridge ways given a deck (wayDecks.ts), by way id. */
  private wayDeckIds = new Set<number>();
  /**
   * Decks for the OSM bridge ways of this cell and its neighbours that no measured deck or flat footprint carries
   * (wayDecks.ts, user 2026-10-16: the Jan Evertsenstraat over the Erasmusgracht drew no bridge). Each is placed once,
   * owned by the cell of its first point, when its box lies within this cell's relief pad.
   */
  private async placeWayDecks(key: string): Promise<void> {
    const [x0, y0, x1, y1] = this.cellRect(key), pad = CELL_RELIEF_PAD_M - 50;
    const around = GroundStore.neighbours(key);
    const [osms, waters] = await Promise.all([Promise.all(around.map(k => this.osmCell(k))), Promise.all(around.map(k => this.waterCell(k)))]);
    // Each polygon with its box: a station tests only the polygons around it.
    const polys = waters.flatMap(w => w?.polygons ?? []).map(poly => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [px, py] of poly[0] ?? []) { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); d = Math.max(d, py); } return { poly, box: [a, b, c, d] }; });
    const wet = (x: number, y: number) => polys.some(({ poly, box }) => { if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false; let inside = false; for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; });
    const flats = around.flatMap(k => this.flatDecks(k));
    // Every measured bridge around, placed or not (a deck is placed only near the cell being prepared).
    const quant = this.elevation.quantization.xy;
    const measuredProfiles = around.flatMap(k => this.measuredByCell.get(k) ?? []).map(b => decodeProfile(b, quant, this.toScene));
    const nearRing = (ring: Vec2[], x: number, y: number) => pointInRing(ring, x, y) || ring.some((a, i) => { const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1e-9))); return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) < WAY_DECK_CLEAR_M; });
    const claimed = (x: number, y: number) => measuredProfiles.some(p => {
      const [a0, b0, a1, b1] = p.bbox;
      if (x < a0 - 30 || x > a1 + 30 || y < b0 - 30 || y > b1 + 30) return false;
      let best = Infinity, at = 0;
      for (let i = 0; i + 1 < p.x.length; i++) { const dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], t = Math.max(0, Math.min(1, ((x - p.x[i]) * dx + (y - p.y[i]) * dy) / (dx * dx + dy * dy || 1e-9))), d = Math.hypot(p.x[i] + dx * t - x, p.y[i] + dy * t - y); if (d < best) { best = d; at = i; } }
      const half = Math.max(p.halfWidth[at], ...(p.sides ?? []));
      return p.s[at] >= p.deck[0] - 1 && p.s[at] <= p.deck[1] + 1 && best <= half + WAY_DECK_CLEAR_M;
    })
      || flats.some(r => nearRing(r, x, y));
    const ways: WayDeckInput[] = [];
    // Only the bridge ways go through prepareWays (the cell's whole street graph is the costly part).
    for (const osm of osms) for (const w of osm ? prepareWays(osm.ways.filter(q => q.tags.bridge && q.tags.bridge !== 'no' && wayDeckHighway(q.tags.highway) && !this.wayDeckIds.has(q.id)), p => toLocal(p[0], p[1])) : []) {
      if (this.wayDeckIds.has(w.id) || ways.some(q => q.id === w.id) || !isBridgeWay(w) || !wayDeckHighway(w.tags.highway)) continue;
      const xs = w.points.map(p => p[0]), ys = w.points.map(p => p[1]);
      if (Math.min(...xs) < x0 - pad || Math.max(...xs) > x1 + pad || Math.min(...ys) < y0 - pad || Math.max(...ys) > y1 + pad) continue;
      ways.push({ id: w.id, name: w.tags.name ?? '', points: w.points, halfWidth: w.section.halfWidth });
    }
    const { profiles } = wayDeckGroups(ways, wet, claimed);
    for (const w of ways) this.wayDeckIds.add(w.id);
    for (const profile of profiles) {
      const owner = this.cellAt(profile.x[0], profile.y[0]);
      (this.decksByCell.get(owner) ?? this.decksByCell.set(owner, []).get(owner)!).push(this.surface.addDeck(profile));
    }
  }

  /** Measured decks assigned to `key` (optionally only those whose bbox meets `within`), each placed once. */
  private placeDecks(key: string, within?: Rect): void {
    const quant = this.elevation.quantization.xy;
    let placed = this.decksByCell.get(key);
    if (!placed) { placed = []; this.decksByCell.set(key, placed); }
    const done = new Set(placed.map(d => d.profile.id));
    for (const b of this.measuredByCell.get(key) ?? []) {
      if (done.has(b.id)) continue;
      const profile = decodeProfile(b, quant, this.toScene);
      if (within) {
        const [a0, b0, a1, b1] = profile.bbox;
        if (a1 < within[0] || a0 > within[2] || b1 < within[1] || b0 > within[3]) continue;
      }
      placed.push(this.surface.addDeck(profile));
    }
  }

  decks(key: string): DeckSurface[] { return this.decksByCell.get(key) ?? []; }

  /** Unmeasured (flat) deck footprints whose first vertex lies in the cell, game frame. */
  flatDecks(key: string): Vec2[][] {
    let rings = this.flatByCell.get(key);
    if (!rings) {
      const quant = this.elevation.quantization.xy;
      rings = (this.fallbackByCell.get(key) ?? []).map(b => {
        const ring = decodeFallback(b, quant, this.toScene).ring, pts: Vec2[] = [];
        for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
        return pts;
      });
      this.flatByCell.set(key, rings);
    }
    return rings;
  }
  /** Register id and movable flag of each flat deck of `flatDecks(key)`, same order. */
  flatDeckMeta(key: string): { id: string; movable: boolean }[] {
    return (this.fallbackByCell.get(key) ?? []).map(b => ({ id: b.id, movable: b.type === 'Beweegbare brug' }));
  }

  /** Measured bridge ids per cell, for diagnostics and named regressions. */
  deckIds(key: string): string[] { return this.decks(key).map(d => d.profile.id); }

  /** A cell's water polygons and shores in the game frame (null: no water cell). */
  waterCell(key: string): Promise<WaterGeometry | null> {
    let p = this.water.get(key);
    if (!p) {
      const [ex, ey] = key.split('_').map(Number);
      if (!this.elevation.cells.some(([cx, cy]) => cx === ex && cy === ey)) p = Promise.resolve(null);
      else p = this.fetchBytes(`${EXTRACTS.water}/cells/${key}.json`).then(bytes => {
        this.loadedBytes.water += bytes.byteLength;
        const cell = JSON.parse(new TextDecoder().decode(bytes)) as WaterCell;
        const quant = this.elevation.quantization.xy, ox = cell.cell[0] * this.elevation.cellSizeM, oy = cell.cell[1] * this.elevation.cellSizeM;
        const ring = (r: number[]) => { const out: Vec2[] = []; for (let i = 0; i < r.length; i += 2) out.push(this.toScene(ox + r[i] * quant, oy + r[i + 1] * quant)); return out; };
        const geo: WaterGeometry = { polygons: cell.water.map(poly => poly.map(ring)), shores: cell.shore.map(ring) };
        this.attachLevels(key, geo);
        const out = this.options.openings === false ? geo : this.withOpenings(key, geo);
        this.waterResident.set(key, out);
        return out;
      }).catch(() => null);
      this.water.set(key, p);
    }
    return p;
  }

  /** Measured deck profiles decoded for the openings rule (not placed on the surface), by register id. */
  private readonly openingProfiles = new Map<string, OpeningDeck & { bbox: [number, number, number, number] }>();
  /** Water ids opened per cell (named regressions, the lane report). */
  readonly openedDecks = new Map<string, string[]>();

  /** Open the water under footbridges whose water polygon stops at the bridge (water.ts openUnderFootbridges). */
  private withOpenings(key: string, geo: WaterGeometry): WaterGeometry {
    const rect = this.cellRect(key), quant = this.elevation.quantization.xy, decks: OpeningDeck[] = [];
    for (const k of GroundStore.neighbours(key)) for (const b of this.measuredByCell.get(k) ?? []) {
      let p = this.openingProfiles.get(b.id);
      if (!p) { p = decodeProfile(b, quant, this.toScene); this.openingProfiles.set(b.id, p); }
      const [a0, b0, a1, b1] = p.bbox;
      if (!(a1 < rect[0] || a0 > rect[2] || b1 < rect[1] || b0 > rect[3])) decks.push(p);
    }
    const r = openUnderFootbridges(geo, decks, rect, WATER_Z);
    if (r.opened.length) this.openedDecks.set(key, r.opened);
    const boats = this.boatsByCell.get(key);
    if (!boats?.length) return r.geo;
    const m = openUnderHouseboats(r.geo, boats, rect, WATER_Z);
    if (m.opened.length) this.openedBerths.set(key, m.opened);
    return m.geo;
  }

  /** Scene z of a NAP level under this extract's datum. */
  sceneZ(nap: number): number { return +(nap - this.relief.sceneDatumNAP).toFixed(3); }

  /** Per-polygon / per-shore water surface from water-levels.json (ignored when its counts do not match the cell). */
  private attachLevels(key: string, geo: WaterGeometry): void {
    const e = this.waterLevels?.cells[key];
    if (!e) return;
    const expand = (v: number | number[], n: number) => Array.isArray(v) ? (v.length === n ? v : null) : Array.from({ length: n }, () => v);
    const p = expand(e.p, geo.polygons.length), s = expand(e.s, geo.shores.length);
    if (p) geo.levels = p.map(v => this.sceneZ(v));
    if (s) geo.shoreLevels = s.map(v => this.sceneZ(v));
  }

  /** Water surface (scene z) at a game-frame point if it lies on resident water, else the canal level. */
  waterZ(x: number, y: number): number {
    return waterZAt([...this.waterResident.values()], x, y, WATER_Z);
  }

  /** A cell's OSM ground (null: outside the fetched area). */
  osmCell(key: string): Promise<OsmGroundExtract | null> {
    let p = this.osm.get(key);
    if (!p) {
      p = this.osmCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.osm}/cells/${key}.json.gz`).then(bytes => { this.loadedBytes.osm += bytes.byteLength; return JSON.parse(new TextDecoder().decode(bytes)) as OsmGroundExtract; }).catch(() => null)
        : Promise.resolve(null);
      this.osm.set(key, p);
    }
    return p;
  }

  /** A cell's parks (null: no park in it, or parks off). */
  parkCell(key: string): Promise<ParksCell | null> {
    let p = this.parks.get(key);
    if (!p) {
      p = this.parkCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.parks}/cells/${key}.json.gz`).then(bytes => { this.loadedBytes.parks += bytes.byteLength; return JSON.parse(new TextDecoder().decode(bytes)) as ParksCell; }).catch(() => null)
        : Promise.resolve(null);
      this.parks.set(key, p);
    }
    return p;
  }

  /** A cell's road partition (null: no roads-v1 cell for it, or roads off). */
  roadCell(key: string): Promise<RoadCell | null> {
    let p = this.roads.get(key);
    if (!p) {
      p = this.roadCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.roads}/cells/${key}.json.gz`).then(bytes => { this.loadedBytes.roads += bytes.byteLength; const c = JSON.parse(new TextDecoder().decode(bytes)) as RoadCell; return c.version === 1 ? c : null; }).catch(() => null)
        : Promise.resolve(null);
      this.roads.set(key, p);
    }
    return p;
  }

  /** A cell's BGT courtyards (null: none, or courtyards off). */
  courtyardCell(key: string): Promise<CourtyardsCell | null> {
    let p = this.courtyards.get(key);
    if (!p) {
      p = this.courtyardCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.courtyards}/cells/${key}.json.gz`).then(bytes => { this.loadedBytes.courtyards += bytes.byteLength; return JSON.parse(new TextDecoder().decode(bytes)) as CourtyardsCell; }).catch(() => null)
        : Promise.resolve(null);
      this.courtyards.set(key, p);
    }
    return p;
  }

  /** Forget cached water/OSM data for cells far away (relief is evicted separately). */
  forgetCells(keep: ReadonlySet<string>): void {
    for (const map of [this.water, this.osm, this.parks, this.roads, this.courtyards, this.waterResident] as Map<string, unknown>[]) for (const k of [...map.keys()]) if (!keep.has(k)) map.delete(k);
  }

  /**
   * Everything a cell build needs, loaded: its relief and decks, the water and
   * OSM of its 3×3 neighbourhood, and the deck footprints near it.
   */
  async cellInput(key: string, lod: 0 | 1): Promise<CellInput> {
    await this.prepareCell(key);
    const around = GroundStore.neighbours(key);
    const [water, waterAround, osm, osmAround, parksAround, roadsAround, courtyardsAround] = await Promise.all([
      this.waterCell(key),
      Promise.all(around.map(k => this.waterCell(k))),
      this.osmCell(key),
      Promise.all(around.filter(k => k !== key).map(k => this.osmCell(k))),
      Promise.all(around.map(k => this.parkCell(k))),
      Promise.all(around.map(k => this.roadCell(k))),
      Promise.all(around.map(k => this.courtyardCell(k))),
    ]);
    // Path ways a park's BGT path polygons replace may run into the neighbours' junction graph: drop them everywhere.
    const dropWays = parksAround.flatMap(p => p?.dropWays ?? []);
    // Ways the road polygons cover (roads-v1) likewise: a covered way's bands are gone wherever it is drawn.
    const coverWays = [...new Set(roadsAround.flatMap(r => r?.coverWays ?? []))];
    const hasRoads = roadsAround.some(r => !!r);
    const rect = this.cellRect(key), pad = 200;
    const near = (b: [number, number, number, number]) => !(b[2] < rect[0] - pad || b[0] > rect[2] + pad || b[3] < rect[1] - pad || b[1] > rect[3] + pad);
    // Movable leaves get the fixed spans to the quays their bridge way crosses (decks.ts movableApproaches).
    const bridgeLines = this.options.approaches === false ? [] : [osm, ...osmAround].flatMap(o => o?.ways ?? [])
      .filter(w => w.tags.bridge && w.tags.bridge !== 'no').map(w => w.g.map(p => toLocal(p[0], p[1])));
    const approaches = (k: string) => {
      const meta = this.flatDeckMeta(k);
      return this.flatDecks(k).flatMap((ring, i) => meta[i]?.movable && bridgeLines.length ? movableApproaches(ring, bridgeLines).map(r => ({ ring: r, id: `${meta[i].id}-approach` })) : []);
    };
    const own = approaches(key);
    const deckRingsAround: Vec2[][] = [
      ...this.surface.decks.filter(d => near(d.profile.bbox)).map(d => GroundSurface.footprint(d)),
      ...around.flatMap(k => [...this.flatDecks(k), ...(k === key ? own : approaches(k)).map(a => a.ring)]),
      // roads-v1 deck polygons (h ≥ 1): the water mask never cuts a surveyed bridge surface (or the bands over it).
      ...roadsAround.flatMap(r => (r ? r.surfaces.filter(s => s.h >= 1).map(s => decodeRoadLine(s.r[0])).filter(ring => ring.length >= 3 && near([Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))])) : [])),
    ];
    return {
      key, lod, rect, surface: this.surface, water,
      waterAround: waterAround.filter((g): g is WaterGeometry => !!g),
      decks: this.decks(key), deckRingsAround,
      flatDecks: [...this.flatDecks(key), ...own.map(a => a.ring)],
      flatDeckMeta: [...this.flatDeckMeta(key), ...own.map(a => ({ id: a.id, movable: false }))],
      // Landed platforms near the cell (landedPlatforms.ts): the quay wall leaves them out, their own stone walls meet it.
      landedPlatforms: landedPlatformRings(toLocal).filter(r => near(r.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]))),
      osm, osmAround: osmAround.filter((o): o is OsmGroundExtract => !!o),
      parks: parksAround[around.indexOf(key)] ?? null, parksAround, dropWays, ...(this.options.clipDecks === false ? { clipDecks: false } : {}),
      ...(hasRoads ? { roads: roadsAround[around.indexOf(key)] ?? null, roadsAround, coverWays } : {}),
      courtyards: courtyardsAround[around.indexOf(key)] ?? null, courtyardsAround,
      project: p => toLocal(p[0], p[1]),
    };
  }

  /**
   * A far block's input (farRing.ts): its streamed cells that the OSM extract and the relief cover, their water and
   * OSM ground, and the relief over the block (loaded here; the next eviction drops it again). Null: nothing to draw.
   */
  async farInput(blockKey: string): Promise<FarBlockInput | null> {
    const keys = farBlockCells(blockKey).filter(k => this.osmCells.has(k) && this.covers(k));
    if (!keys.length) return null;
    const rects = keys.map(k => this.cellRect(k));
    const rect: Rect = [Math.min(...rects.map(r => r[0])), Math.min(...rects.map(r => r[1])), Math.max(...rects.map(r => r[2])), Math.max(...rects.map(r => r[3]))];
    await this.ensureRelief(rect);
    const [water, osm] = await Promise.all([Promise.all(keys.map(k => this.waterCell(k))), Promise.all(keys.map(k => this.osmCell(k)))]);
    return {
      key: blockKey, rect,
      cells: keys.map((k, i) => ({ key: k, rect: rects[i], water: water[i], osm: osm[i] })),
      ground: (x, y) => { const z = this.surface.ground(x, y); return z === z ? z : 0; },
      project: p => toLocal(p[0], p[1]),
    };
  }

  /** The 3×3 neighbourhood of a cell. */
  static neighbours(key: string): string[] {
    const [cx, cy] = key.split('_').map(Number), out: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(cellKey(cx + dx, cy + dy));
    return out;
  }
}

/** Fetches and decodes one relief tile (extract-relative path, the relief index, the tile's index entry). */
export type ReliefTileLoader = (path: string, index: GroundIndex, entry: readonly number[]) => Promise<{ heights: Float32Array; bytes: number }>;

/** Gunzip if the bytes are gzip (the dev server may or may not decode .gz for us). */
export async function maybeGunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A FetchBytes over HTTP for an extract root URL. */
export function httpFetchBytes(root: string): FetchBytes {
  return async path => {
    const r = await fetch(`${root}/${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return maybeGunzip(new Uint8Array(await r.arrayBuffer()));
  };
}
