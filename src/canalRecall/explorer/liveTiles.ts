/**
 * The explorer's "live recipe tiles" stage: a small MapLibre map with the ride's own shared frame
 * (window.CanalRecallThree.SharedFrame: one renderer, the sunny light rig and sun shadow) and the ride's own near tier
 * (window.CanalRecallTileBuildings.mountRecipeTiles, js/tile-buildings.bundle.js): the published recipe tiles drawn
 * with the shared city-look material, exactly as `index.html?recipeTiles=1` draws them. Nothing here builds geometry;
 * both bundles are the ride's, loaded on first use.
 *
 * What the ride draws besides (generic facades for pands without a recipe, own ground, trees) is not here: the stage
 * shows only what the recipe tiles carry, over the flat basemap.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LngLat } from './types';

export type LiveCamera = { centre: LngLat; zoom: number; pitch: number; bearing: number };
/** Desktop/phone opening view of a buurt's recipe tiles: close enough that the façades read, pitched like the ride. */
export const liveCamera = (centre: LngLat, phone: boolean): LiveCamera => ({ centre, zoom: phone ? 16.4 : 16.8, pitch: 62, bearing: -18 });

/**
 * A ride past a point with the recipe tiles on: start 90 m west, finish 90 m east (the game snaps both to the road
 * graph), the `#race=` hash of coverage/ownLook.ts `rideHref`.
 */
export function liveRideHref([lng, lat]: LngLat): string {
  const d = 90 / (111320 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => v.toFixed(6);
  return `./index.html?travel=car&recipeTiles=1#race=${[lat, lng, lat, lng - d, lat, lng + d].map(r).join(',')}`;
}

export interface LivePick { id: string; name: string; lngLat: [number, number]; recipeTile: string }

export class LiveRecipeTiles {
  readonly map: any;
  private tiles: any = null;
  private frame: any = null;
  private disposed = false;
  onPick: ((pick: LivePick | null) => void) | null = null;

  private constructor(map: any) { this.map = map; }

  /** Creates the stage map in `container` and mounts the ride's recipe-tile tier on it. */
  static async create(container: HTMLElement, opts: { maplibregl: any; style: string; camera: LiveCamera; loadScript: (src: string) => Promise<void> }): Promise<LiveRecipeTiles> {
    await opts.loadScript('js/three.bundle.js');
    await opts.loadScript('js/tile-buildings.bundle.js');
    const w = window as any, api = w.CanalRecallThree, rt = w.CanalRecallTileBuildings;
    if (!api?.SharedFrame || !rt?.mountRecipeTiles) throw Error('recipe-tile runtime unavailable');
    const c = opts.camera;
    const map = new opts.maplibregl.Map({
      container, style: opts.style, center: c.centre, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing, maxPitch: 75,
      attributionControl: { compact: true }, minZoom: 14, canvasContextAttributes: { antialias: true },
    });
    const live = new LiveRecipeTiles(map);
    await new Promise<void>((resolve, reject) => { map.once('load', () => resolve()); map.once('error', (e: any) => { if (!map.loaded()) reject(e?.error ?? e); }); });
    // Labels and POI icons would sit on top of the buildings; the ride draws its own.
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    live.frame = new api.SharedFrame(api.THREE, map, {
      shadows: true, shadowMapSize: matchMedia('(pointer: coarse)').matches ? 1024 : 2048,
      shadowRamp: api.blendAtZoom ? (zoom: number) => api.blendAtZoom(zoom) : undefined,
    });
    live.frame.attach();
    // The same host the ride builds (tileBuildings/browser.ts mountRecipeTiles); no facade layer to hide covers in.
    const vm = { map, _sharedFrame: live.frame, _threeBuildings: { setHidden: () => {} } };
    live.tiles = await rt.mountRecipeTiles(vm);
    if (live.disposed) { live.dispose(); throw Error('superseded'); }
    map.on('click', (e: any) => {
      const canvas = map.getCanvas();
      const hit = live.tiles?.inspectAtScreen(e.point.x, e.point.y, canvas.clientWidth, canvas.clientHeight);
      live.onPick?.(hit ? { id: hit.id, name: hit.name, lngLat: hit.lngLat, recipeTile: hit.recipeTile } : null);
    });
    map.on('mousemove', (e: any) => {
      const canvas = map.getCanvas();
      canvas.style.cursor = live.tiles?.inspectAtScreen(e.point.x, e.point.y, canvas.clientWidth, canvas.clientHeight) ? 'pointer' : '';
    });
    return live;
  }

  /** Resolves once every resident tile (and its units) is drawn. */
  async ready(timeoutMs = 30_000): Promise<{ tiles: string[]; ready: number; draws: number; triangles: number; instances: number; errors: string[] }> {
    const t0 = performance.now();
    for (;;) {
      const s = this.tiles?.stats();
      if (s && s.tiles.length && !s.loading && s.ready === s.tiles.length) return s;
      if (performance.now() - t0 > timeoutMs || this.disposed) return s;
      await new Promise(r => setTimeout(r, 150));
      this.map.triggerRepaint();
    }
  }

  stats() { return this.tiles?.stats(); }

  /** Highlights pands by id (16-digit or full BAG id), through the ride's own highlight. */
  highlight(ids: Iterable<string>): void { this.tiles?.setHighlighted([...ids]); }

  flyTo(lngLat: LngLat, zoom?: number): void { this.map.easeTo({ center: lngLat, ...(zoom ? { zoom } : {}), duration: 600 }); }

  dispose(): void {
    this.disposed = true;
    try { this.tiles?.dispose(); } catch { /* already gone */ }
    this.tiles = null;
    try { this.map.remove(); } catch { /* already removed */ }
  }
}
