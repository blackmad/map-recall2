// The game's building decoration chain, assembled for the gallery pages.
// vector-map.js `_applyFeatureDecorator` + the tile streamer do, per feature:
//   decorateBuildingFeature (citywide priors) -> exceptLandmarks(decorateRoof(withMonumentGable(decorateFacade)))
//   -> decorateKitRoof -> decorateFront -> decorateShopfront
// then the chunk worker calls buildFeatureChunk. This module repeats that order from the same
// functions, so a gallery render is the game's code path, not a look-alike. Pure (no DOM, no three);
// the fetch helpers at the bottom use only `fetch` and DecompressionStream.

import { decorateBuildingFeature } from './buildingTilesBrowser.js';
import { constructionYearEnricher, decorateFacade } from './genericFacades.js';
import { decorateRoof, exceptLandmarks } from './roofMesh.js';
import { withMonumentGable, type MonumentGables } from './monumentGables.js';
import { KIT_MODELLED_IDS, decorateKitRoof } from './landmarkKits.js';
import { decorateFront } from './landmarkFrontData.js';
import { decorateShopfront } from './shopfronts.js';
import { ORIGIN, asPolygons, type Feature } from './threeBuildingFeatures.js';

export { ORIGIN };
export type { Feature };
export type Vec2 = [number, number];

const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
/** Metres east / north of the game's single origin (the frame every chunk is built in). */
export const toLocal = (lng: number, lat: number): Vec2 => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): Vec2 => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY];

export type DecoratorOptions = {
  gables?: MonumentGables;
  /** Resolved landmark building ids (landmark-buildings.json) and the register's listed ones. */
  landmarkIds?: ReadonlySet<string>;
  listed?: ReadonlySet<string>;
  /** A hook between the facade decorator and the roof decorator (the playground forces a period style here). */
  afterFacade?: (feature: Feature) => Feature;
};

/** The streamer's decoration chain, in the game's order. */
export function gameDecorator(options: DecoratorOptions = {}): (feature: Feature) => Feature {
  const { gables, landmarkIds = new Set<string>(), listed, afterFacade } = options;
  const named = gables && gables.size ? (f: Feature) => withMonumentGable(f, gables) : (f: Feature) => f;
  const decorate = (f: Feature) => decorateRoof(named((afterFacade ?? ((x: Feature) => x))(decorateFacade(f))));
  const base = exceptLandmarks(decorate, landmarkIds, KIT_MODELLED_IDS, listed);
  const priors = new Map();
  return (f: Feature) => decorateShopfront(decorateFront(decorateKitRoof(base(decorateBuildingFeature(f, priors)))));
}

/** The centre and size of a set of footprint rings (metres), for framing a camera. */
export function ringsFrame(rings: ReadonlyArray<readonly Vec2[]>, tops: readonly number[]): { cx: number; cy: number; halfDiag: number; top: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (!(x0 <= x1)) return null;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, halfDiag: Math.hypot(x1 - x0, y1 - y0) / 2, top: tops.reduce((m, h) => Math.max(m, Number.isFinite(h) ? h : 0), 0) };
}

/** Camera distance that fits a kit: its footprint and its height (a spire sets the size, not the plot). */
export function fitDistance(halfDiag: number, top: number, fovDeg = 35): number {
  const reach = Math.hypot(halfDiag, top * 0.6);
  return Math.max(30, reach / Math.sin(fovDeg * Math.PI / 360) * 0.78);
}

export const outerRing = (feature: Feature): Vec2[] | null => {
  const ring = asPolygons(feature.geometry)[0]?.[0];
  return ring ? ring.map(([lng, lat]) => toLocal(lng, lat)) : null;
};

/** z14 slippy tile (`x/y`) of a point. */
export function tileKeyAt(lng: number, lat: number, zoom = 14): string {
  const n = 2 ** zoom, rad = lat * Math.PI / 180;
  return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
}

/** Every z14 tile a square of `radiusM` around a local point touches. */
export function tilesAround(cx: number, cy: number, radiusM: number): string[] {
  const out = new Set<string>();
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const [lng, lat] = fromLocal(cx + dx * radiusM, cy + dy * radiusM); out.add(tileKeyAt(lng, lat)); }
  return [...out];
}

// --- Fetching (browser) -----------------------------------------------------

const EXTRACT = '../data/extracts/amsterdam';
export type Fetcher = typeof fetch;

async function readGz(response: Response): Promise<any> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

const tileCache = new Map<string, Promise<Feature[]>>();
/** One z14 building tile with construction years stamped on, as the streamer's enricher does. Cached. */
export function loadTile(key: string, base = EXTRACT, fetchImpl: Fetcher = (...a) => fetch(...a)): Promise<Feature[]> {
  let hit = tileCache.get(key);
  if (!hit) {
    const [x, y] = key.split('/').map(Number);
    hit = (async () => {
      const response = await fetchImpl(`${base}/building-tiles/14/${x}/${y}.geojson.gz`);
      if (!response.ok) return [];
      const features: Feature[] = (await readGz(response)).features ?? [];
      try { (await constructionYearEnricher(base, fetchImpl)({ z: 14, x, y }))?.(features); } catch { /* yearless */ }
      return features;
    })();
    tileCache.set(key, hit);
  }
  return hit;
}

export type GameData = { gables: MonumentGables; listed: ReadonlySet<string>; landmarkIds: ReadonlySet<string>; shopfronts: any };
let dataPromise: Promise<GameData> | null = null;
/** The extracts the decorators read: monument gables, landmark ids, the shopfront extract. */
export function loadGameData(base = EXTRACT, fetchImpl: Fetcher = (...a) => fetch(...a)): Promise<GameData> {
  const json = async (name: string) => { try { const r = await fetchImpl(`${base}/${name}`); return r.ok ? await r.json() : null; } catch { return null; } };
  return dataPromise ??= (async () => {
    const [gables, landmarks, shops] = await Promise.all([json('monument-gables.json'), json('landmark-buildings.json'), json('shopfronts.json')]);
    const ids = new Set<string>();
    for (const list of Object.values((landmarks?.buildings ?? {}) as Record<string, string[]>)) for (const id of list) ids.add(String(id));
    return { gables: new Map(Object.entries(gables?.buildings ?? {})) as MonumentGables, listed: new Set<string>(gables?.listedLandmarks ?? []), landmarkIds: ids, shopfronts: shops };
  })();
}
