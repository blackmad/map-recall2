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
import { applyLocalToRd, decodeTile, fitLocalToRd, GroundField, tileKey, type GroundIndex } from './heightField.js';
import { GroundSurface, type DeckSurface, type Vec2 } from './surface.js';
import type { OsmGroundExtract } from './osmGround.js';
import type { WaterGeometry } from './water.js';
import type { CellInput } from './groundCell.js';

/** The game's local frame (galleryPipeline.toLocal), duplicated so the worker bundle stays small. */
export const GAME_ORIGIN = { lng: 4.9, lat: 52.37 } as const;
const KX = 111_320 * Math.cos(GAME_ORIGIN.lat * Math.PI / 180), KY = 110_540;
export const toLocal = (lng: number, lat: number): Vec2 => [(lng - GAME_ORIGIN.lng) * KX, (lat - GAME_ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): Vec2 => [GAME_ORIGIN.lng + x / KX, GAME_ORIGIN.lat + y / KY];

export const EXTRACTS = { relief: 'ground-height-v1', osm: 'own-ground-osm-v1', water: 'elevation-v1' } as const;
/** Water surface, scene z (canal level −0.40 NAP below the +1.37 NAP datum). */
export const WATER_Z = -1.77;
/** Relief loaded this far around a cell before it is built (decks and streets reach past its edge). */
export const CELL_RELIEF_PAD_M = 350;

/** Fetch an extract file (path relative to the extract root), gunzipped. */
export type FetchBytes = (path: string) => Promise<Uint8Array>;

export interface OsmCellsManifest { version: 1; area: string; cellSizeM: number; cells: string[]; fetched?: string; attribution?: string }

export type Rect = [number, number, number, number];

export class GroundStore {
  relief!: GroundIndex;
  elevation!: ElevationIndex;
  osmCells = new Set<string>();
  field!: GroundField;
  surface!: GroundSurface;
  private bridges: BridgeExtract | null = null;
  private readonly reliefTiles = new Set<string>();
  private readonly reliefLoading = new Map<string, Promise<void>>();
  private readonly water = new Map<string, Promise<WaterGeometry | null>>();
  private readonly osm = new Map<string, Promise<OsmGroundExtract | null>>();
  /** Measured deck surfaces per cell (placed once the cell's relief is resident). */
  private readonly decksByCell = new Map<string, DeckSurface[]>();
  private readonly flatByCell = new Map<string, Vec2[][]>();
  private measuredByCell = new Map<string, BridgeExtract['measured']>();
  private fallbackByCell = new Map<string, BridgeExtract['fallback']>();
  readonly loadedBytes = { relief: 0, water: 0, osm: 0 };

  constructor(private readonly fetchBytes: FetchBytes) {}

  private async json<T>(path: string): Promise<T> {
    return JSON.parse(new TextDecoder().decode(await this.fetchBytes(path))) as T;
  }

  async init(): Promise<void> {
    const [relief, elevation, bridges, manifest] = await Promise.all([
      this.json<GroundIndex>(`${EXTRACTS.relief}/index.json`),
      this.json<unknown>(`${EXTRACTS.water}/index.json`).then(validateIndex),
      this.json<BridgeExtract>(`${EXTRACTS.water}/bridges.json`),
      this.json<OsmCellsManifest>(`${EXTRACTS.osm}/cells.json`).catch(() => null),
    ]);
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

  /** Does the ground have data for this cell (relief tile and OSM cell)? */
  covers(key: string): boolean {
    if (!this.osmCells.has(key)) return false;
    const [x0, y0, x1, y1] = this.cellRect(key);
    return this.rdTilesFor([x0 + 1, y0 + 1, x1 - 1, y1 - 1]).every(k => this.hasReliefTile(k));
  }

  private tileSet: Set<string> | null = null;
  private hasReliefTile(k: string): boolean { return (this.tileSet ??= new Set(this.relief.tiles.map(([tx, ty]) => tileKey(tx, ty)))).has(k); }

  /** Does the extract have relief at this game-frame point at all (resident or not)? */
  reliefCovered(x: number, y: number): boolean {
    const p = lngLatToRd(fromLocal(x, y)), T = this.relief.tileSizeM;
    return this.hasReliefTile(tileKey(Math.floor(p.x / T), Math.floor(p.y / T)));
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
    const n = this.relief.samples;
    await Promise.all(this.rdTilesFor(rect).filter(k => this.hasReliefTile(k)).map(k => {
      if (this.reliefTiles.has(k)) return undefined;
      let p = this.reliefLoading.get(k);
      if (!p) {
        p = this.fetchBytes(`${EXTRACTS.relief}/tiles/${k}.bin`).then(bytes => {
          this.loadedBytes.relief += bytes.byteLength;
          const [tx, ty] = k.split('_').map(Number);
          this.field.addTile(tx, ty, decodeTile(bytes, n));
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
        return { polygons: cell.water.map(poly => poly.map(ring)), shores: cell.shore.map(ring) };
      }).catch(() => null);
      this.water.set(key, p);
    }
    return p;
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

  /** Forget cached water/OSM data for cells far away (relief is evicted separately). */
  forgetCells(keep: ReadonlySet<string>): void {
    for (const map of [this.water, this.osm] as Map<string, unknown>[]) for (const k of [...map.keys()]) if (!keep.has(k)) map.delete(k);
  }

  /**
   * Everything a cell build needs, loaded: its relief and decks, the water and
   * OSM of its 3×3 neighbourhood, and the deck footprints near it.
   */
  async cellInput(key: string, lod: 0 | 1): Promise<CellInput> {
    await this.prepareCell(key);
    const around = GroundStore.neighbours(key);
    const [water, waterAround, osm, osmAround] = await Promise.all([
      this.waterCell(key),
      Promise.all(around.map(k => this.waterCell(k))),
      this.osmCell(key),
      Promise.all(around.filter(k => k !== key).map(k => this.osmCell(k))),
    ]);
    const rect = this.cellRect(key), pad = 200;
    const near = (b: [number, number, number, number]) => !(b[2] < rect[0] - pad || b[0] > rect[2] + pad || b[3] < rect[1] - pad || b[1] > rect[3] + pad);
    const deckRingsAround: Vec2[][] = [
      ...this.surface.decks.filter(d => near(d.profile.bbox)).map(d => GroundSurface.footprint(d)),
      ...around.flatMap(k => this.flatDecks(k)),
    ];
    return {
      key, lod, rect, surface: this.surface, water,
      waterAround: waterAround.filter((g): g is WaterGeometry => !!g),
      decks: this.decks(key), deckRingsAround, flatDecks: this.flatDecks(key),
      osm, osmAround: osmAround.filter((o): o is OsmGroundExtract => !!o),
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
