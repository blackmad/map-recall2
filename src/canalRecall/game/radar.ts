// The riding radar: a small heading-up map centred on the rider, GTA style.
//
// The always-on minimap used to be the whole city (cityOverview.ts), faint at
// 260×200, where the rider is a dot and the next turn is invisible. This one
// shows a few hundred metres around the rider in the main view's orientation,
// with streets, canals and parks from our own extract
// (`own-map-v1/overview.json.gz`, OSM + OpenFreeMap shorelines), the route as
// a bold line, and the destination as a pin that clamps to the rim as an
// arrow when it is off the radar. The old city sheet stays as the M-key map.
//
// It never draws a name: the street or canal under question must not be
// revealed by the HUD before it is answered (CLAUDE.md), and a radar has no
// room for labels anyway.
//
// Cost: the extract is fetched, inflated, parsed and decoded in a worker, once
// per session. Geometry is rasterised into 160 m tiles (a few per frame at
// most, once each), the tiles around the rider are composed axis-aligned into
// one sheet when the rider crosses a tile, and a frame is one rotated
// drawImage of that sheet plus the route, two markers and the rim.

import { ORIGIN, KX, KY, type Vec2 } from '../ownMap/frame';
import { GROUND_LOOK_TONES } from '../ownGround/groundLook';
import { GROUND_TONES, HIGHLIGHT_CORAL } from '../look/palette';

// ---- Pure helpers (tested in radar.test.ts) ----------------------------------

export const RADAR_TILE_M = 160;

/** Radius shown at rest and at full speed. Measured on the 1440×900 desktop
 *  radar (180 px): at 220 m a residential block is ~20 px and every side street
 *  reads; at 320 m the next two junctions are on the radar ~30 s ahead at bike
 *  speed. The phone radar is half the size, so it shows a little less. */
export const RADAR_RADIUS_M = { desktop: [220, 320], compact: [170, 240] } as const;

/** Radius for a speed ratio (0..1), eased so it opens up gently. */
export function radarRadiusForSpeed(speedRatio: number, range: readonly [number, number]): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(speedRatio) ? speedRatio : 0));
  const eased = t * t * (3 - 2 * t);
  return range[0] + (range[1] - range[0]) * eased;
}

/**
 * Screen offset (CSS px from the radar centre) of a point `d` metres away in
 * the local frame (x east, y north), for a view rotated like the game camera
 * (`rotation` applies to the game's y-south world: screen = R(-rotation)·world).
 */
export function radarOffset(d: Vec2, rotation: number, pxPerMetre: number): Vec2 {
  const dx = d[0], dyS = -d[1];
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [(dx * c + dyS * s) * pxPerMetre, (-dx * s + dyS * c) * pxPerMetre];
}

/** A marker inside the radar, or clamped to the rim (`clamped`) when it is off it. */
export function clampToRim(offset: Vec2, rimPx: number): { at: Vec2; clamped: boolean; angle: number } {
  const len = Math.hypot(offset[0], offset[1]);
  const angle = Math.atan2(offset[1], offset[0]);
  if (len <= rimPx) return { at: offset, clamped: false, angle };
  return { at: [Math.cos(angle) * rimPx, Math.sin(angle) * rimPx], clamped: true, angle };
}

/** Tiles (inclusive index range) covering a square of half-size `r` around `at`. */
export function tileRange(at: Vec2, r: number, tile = RADAR_TILE_M): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.floor((at[0] - r) / tile), y0: Math.floor((at[1] - r) / tile),
    x1: Math.floor((at[0] + r) / tile), y1: Math.floor((at[1] + r) / tile),
  };
}

/** lng/lat to the radar's local metres (the own-map frame). */
export const radarLocal = (lng: number, lat: number): Vec2 => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];

/** Index of the route point nearest `at`, searching near `hint` first (the rider moves a little per frame). */
export function nearestRouteIndex(route: Float32Array, at: Vec2, hint: number): number {
  const n = route.length / 2;
  if (n === 0) return 0;
  const scan = (from: number, to: number) => {
    let best = -1, bestD = Infinity;
    for (let i = Math.max(0, from); i < Math.min(n, to); i++) {
      const d = (route[i * 2] - at[0]) ** 2 + (route[i * 2 + 1] - at[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { best, bestD };
  };
  const near = scan(hint - 30, hint + 60);
  // Close enough to the hinted stretch: keep it (also stops a loop route jumping ahead).
  if (near.best >= 0 && near.bestD < 60 * 60) return near.best;
  return scan(0, n).best;
}

// ---- Palette -----------------------------------------------------------------

const rgb = (c: readonly number[], a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const BRIGHT = GROUND_LOOK_TONES.bright;

/** The radar's colours: the bright ground look (water [79,134,163], land
 *  [185,174,156] a touch towards paper), streets white on an asphalt casing so
 *  they read against the land at a glance (the first pass, land lifted 35%
 *  towards paper, left cream streets on cream). */
export const RADAR_COLORS = {
  land: rgb(mix(BRIGHT.land!, [251, 248, 242], 0.12)),
  park: rgb(mix(GROUND_TONES.park, BRIGHT.land!, 0.3)),
  water: rgb(BRIGHT.water),
  street: '#ffffff',
  streetCasing: rgb(BRIGHT.asphalt),
  major: '#fff1c9',
  cycle: rgb(BRIGHT.cycle),
  route: '#38BDF8',
  routeCasing: 'rgba(3,18,28,0.78)',
  routePassed: 'rgba(56,189,248,0.38)',
  rim: 'rgba(251,248,242,0.97)',
  rimLine: 'rgba(31,28,23,0.28)',
  rider: '#1f1c17',
} as const;

/** Stroke widths in CSS px per class index (major, secondary, tertiary, minor, service, cycle). */
const CLASS_WIDTH = [3.4, 3, 2.5, 1.9, 1.1, 1.1];
const CLASS_ORDER = [5, 4, 3, 2, 1, 0];
const PATH_CLASS = 6;

// ---- Data --------------------------------------------------------------------

/** Polygons: points in `coords`, ring boundaries in `ringStart` (points), polygon boundaries in `polyRing` (rings). */
export interface RadarPolys { coords: Float32Array; ringStart: Uint32Array; polyRing: Uint32Array; bbox: Float32Array }
/** Lines: points in `coords`, line boundaries in `start` (points), class per line. */
export interface RadarLines { coords: Float32Array; start: Uint32Array; cls: Uint8Array; bbox: Float32Array }
export interface RadarData { water: RadarPolys; parks: RadarPolys; streets: RadarLines }

/**
 * The worker body. Self-contained (no imports, no closures): it is shipped to a
 * Worker as source text. Fetches the overview, inflates and parses it, and
 * packs water, parks and streets (paths dropped) into transferable arrays.
 */
function radarWorkerMain(): void {
  const scope = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };
  scope.onmessage = async (event: MessageEvent) => {
    try {
      const response = await fetch(event.data.url);
      if (!response.ok) throw new Error(`overview ${response.status}`);
      let bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      const file = JSON.parse(new TextDecoder().decode(bytes));
      const unit: number = file.unit;
      const packPolys = (polys: number[][][]) => {
        let points = 0, rings = 0;
        for (const poly of polys) for (const ring of poly) { points += ring.length >> 1; rings++; }
        const coords = new Float32Array(points * 2), ringStart = new Uint32Array(rings + 1), polyRing = new Uint32Array(polys.length + 1);
        const bbox = new Float32Array(polys.length * 4);
        let p = 0, r = 0;
        polys.forEach((poly, i) => {
          polyRing[i] = r;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const ring of poly) {
            ringStart[r++] = p;
            let x = 0, y = 0;
            for (let k = 0; k + 1 < ring.length; k += 2) {
              x += ring[k]; y += ring[k + 1];
              const X = x * unit, Y = y * unit;
              coords[p * 2] = X; coords[p * 2 + 1] = Y; p++;
              if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
            }
          }
          bbox.set([x0, y0, x1, y1], i * 4);
        });
        ringStart[r] = p; polyRing[polys.length] = r;
        return { coords, ringStart, polyRing, bbox };
      };
      const streetsIn: number[][] = (file.streets as number[][]).filter(row => row[0] !== 6);
      let points = 0;
      for (const row of streetsIn) points += (row.length - 2) >> 1;
      const coords = new Float32Array(points * 2), start = new Uint32Array(streetsIn.length + 1), cls = new Uint8Array(streetsIn.length);
      const bbox = new Float32Array(streetsIn.length * 4);
      let p = 0;
      streetsIn.forEach((row, i) => {
        start[i] = p; cls[i] = row[0];
        let x = 0, y = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let k = 2; k + 1 < row.length; k += 2) {
          x += row[k]; y += row[k + 1];
          const X = x * unit, Y = y * unit;
          coords[p * 2] = X; coords[p * 2 + 1] = Y; p++;
          if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
        }
        bbox.set([x0, y0, x1, y1], i * 4);
      });
      start[streetsIn.length] = p;
      const water = packPolys(file.water);
      const parks = packPolys((file.parks as Array<[number, ...number[][]]>).map(([, ...rings]) => rings));
      const streets = { coords, start, cls, bbox };
      const buffers = [water, parks].flatMap(l => [l.coords.buffer, l.ringStart.buffer, l.polyRing.buffer, l.bbox.buffer])
        .concat([coords.buffer, start.buffer, cls.buffer, bbox.buffer]);
      scope.postMessage({ data: { water, parks, streets } }, buffers as Transferable[]);
    } catch (error) {
      scope.postMessage({ error: String((error as Error)?.message || error) });
    }
  };
}

/** Load the overview extract off the main thread. Resolves null when it cannot. */
export function loadRadarData(url: string): Promise<RadarData | null> {
  return new Promise(resolve => {
    try {
      const source = `(${radarWorkerMain.toString()})();`;
      const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(blobUrl);
      const done = (value: RadarData | null) => { worker.terminate(); URL.revokeObjectURL(blobUrl); resolve(value); };
      worker.onmessage = (event: MessageEvent) => {
        if (event.data?.data) done(event.data.data as RadarData);
        else { console.warn('radar: overview not loaded', event.data?.error); done(null); }
      };
      worker.onerror = event => { console.warn('radar: worker failed', event.message); done(null); };
      worker.postMessage({ url: new URL(url, location.href).href });
    } catch (error) {
      console.warn('radar: no worker', error);
      resolve(null);
    }
  });
}

// ---- Drawing -----------------------------------------------------------------

export interface RadarView {
  /** Rider, local metres (x east, y north). */
  at: Vec2;
  /** The main camera's rotation (radians), so the radar turns with the view. */
  rotation: number;
  /** Rider heading in the game's convention (radians; 0 = east, +π/2 = south). */
  angle: number;
  /** Metres from the centre to the rim. */
  radiusM: number;
  /** Destination, local metres. */
  destination: Vec2 | null;
  /** Route, local metres, flat [x0, y0, x1, y1, …]; null when the route line is off. */
  route: Float32Array | null;
  /** Index of the route point nearest the rider (what lies before it is drawn faint). */
  routeIndex: number;
}

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

const TILE_CACHE = 96;
/** Tile rasterisation budget per frame (ms); at least one tile always renders. */
const TILE_BUDGET_MS = 2;

export class RadarMap {
  data: RadarData | null = null;
  private loading: Promise<RadarData | null> | null = null;
  private tiles = new Map<string, Canvas>();
  /** Device px per metre the tiles are rasterised at. */
  private ppm = 0;
  private sheet: { canvas: Canvas; x0: number; y0: number; x1: number; y1: number; complete: boolean } | null = null;
  stats = { frames: 0, drawMs: 0, maxMs: 0, tilesRendered: 0 };

  /** Start loading (once). */
  load(url: string): Promise<RadarData | null> {
    if (!this.loading) this.loading = loadRadarData(url).then(data => { this.data = data; this.sheet = null; return data; });
    return this.loading;
  }

  get ready(): boolean { return !!this.data; }

  private renderTile(tx: number, ty: number): Canvas {
    const T = RADAR_TILE_M, ppm = this.ppm, size = Math.ceil(T * ppm);
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d') as Ctx2D;
    const data = this.data;
    if (!data) return canvas;
    const x0 = tx * T, y0 = ty * T, x1 = x0 + T, y1 = y0 + T;
    // Local metres → tile pixels, north up.
    ctx.setTransform(size / T, 0, 0, -size / T, -x0 * size / T, y1 * size / T);
    const hits = (bbox: Float32Array, i: number, pad: number) =>
      bbox[i * 4] <= x1 + pad && bbox[i * 4 + 2] >= x0 - pad && bbox[i * 4 + 1] <= y1 + pad && bbox[i * 4 + 3] >= y0 - pad;
    const fillPolys = (layer: RadarPolys, colour: string) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      const n = layer.polyRing.length - 1;
      for (let i = 0; i < n; i++) {
        if (!hits(layer.bbox, i, 0)) continue;
        for (let r = layer.polyRing[i]; r < layer.polyRing[i + 1]; r++) {
          const a = layer.ringStart[r], b = layer.ringStart[r + 1];
          if (b - a < 3) continue;
          ctx.moveTo(layer.coords[a * 2], layer.coords[a * 2 + 1]);
          for (let k = a + 1; k < b; k++) ctx.lineTo(layer.coords[k * 2], layer.coords[k * 2 + 1]);
          ctx.closePath();
        }
      }
      ctx.fill('evenodd');
    };
    fillPolys(data.parks, RADAR_COLORS.park);
    fillPolys(data.water, RADAR_COLORS.water);
    const streets = data.streets;
    const n = streets.cls.length;
    const pad = 6;
    const inTile: number[][] = CLASS_ORDER.map(() => []);
    for (let i = 0; i < n; i++) {
      const cls = streets.cls[i];
      if (cls >= PATH_CLASS || !hits(streets.bbox, i, pad)) continue;
      inTile[CLASS_ORDER.indexOf(cls)].push(i);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (list: number[], width: number, colour: string) => {
      if (!list.length) return;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width / (size / T);
      ctx.beginPath();
      for (const i of list) {
        const a = streets.start[i], b = streets.start[i + 1];
        ctx.moveTo(streets.coords[a * 2], streets.coords[a * 2 + 1]);
        for (let k = a + 1; k < b; k++) ctx.lineTo(streets.coords[k * 2], streets.coords[k * 2 + 1]);
      }
      ctx.stroke();
    };
    const dpr = this.ppm / this.cssPpm;
    // Casings for the road classes first (one pass), then fills from minor to major.
    const roads = inTile.slice(1);
    roads.forEach((list, k) => stroke(list, (CLASS_WIDTH[CLASS_ORDER[k + 1]] + 1.4) * dpr, RADAR_COLORS.streetCasing));
    stroke(inTile[0], CLASS_WIDTH[5] * dpr, RADAR_COLORS.cycle);
    roads.forEach((list, k) => {
      const cls = CLASS_ORDER[k + 1];
      stroke(list, CLASS_WIDTH[cls] * dpr, cls <= 1 ? RADAR_COLORS.major : RADAR_COLORS.street);
    });
    this.stats.tilesRendered++;
    return canvas;
  }

  /** CSS px per metre at the sharpest (smallest) radius. */
  private cssPpm = 0;

  private ensureScale(cssPpm: number, dpr: number): void {
    const ppm = cssPpm * dpr;
    if (Math.abs(ppm - this.ppm) / Math.max(ppm, 1e-6) < 0.01) return;
    this.ppm = ppm;
    this.cssPpm = cssPpm;
    this.tiles.clear();
    this.sheet = null;
  }

  /** Make the tiles in range; returns whether all of them exist. */
  private ensureTiles(range: { x0: number; y0: number; x1: number; y1: number }, at: Vec2): boolean {
    if (!this.data) return false;
    const missing: Array<[number, number, number]> = [];
    for (let ty = range.y0; ty <= range.y1; ty++) for (let tx = range.x0; tx <= range.x1; tx++) {
      const key = `${tx},${ty}`;
      const tile = this.tiles.get(key);
      if (tile) { this.tiles.delete(key); this.tiles.set(key, tile); continue; }
      const cx = (tx + 0.5) * RADAR_TILE_M - at[0], cy = (ty + 0.5) * RADAR_TILE_M - at[1];
      missing.push([tx, ty, cx * cx + cy * cy]);
    }
    if (!missing.length) return true;
    missing.sort((a, b) => a[2] - b[2]);
    const started = performance.now();
    for (const [tx, ty] of missing) {
      this.tiles.set(`${tx},${ty}`, this.renderTile(tx, ty));
      if (performance.now() - started > TILE_BUDGET_MS) break;
    }
    while (this.tiles.size > TILE_CACHE) this.tiles.delete(this.tiles.keys().next().value as string);
    return missing.every(([tx, ty]) => this.tiles.has(`${tx},${ty}`));
  }

  private ensureSheet(range: { x0: number; y0: number; x1: number; y1: number }, complete: boolean, grew: boolean): void {
    const s = this.sheet;
    if (s && s.x0 === range.x0 && s.y0 === range.y0 && s.x1 === range.x1 && s.y1 === range.y1 && (s.complete || !grew)) return;
    const size = Math.ceil(RADAR_TILE_M * this.ppm);
    const w = (range.x1 - range.x0 + 1) * size, h = (range.y1 - range.y0 + 1) * size;
    const canvas = s && s.canvas.width === w && s.canvas.height === h ? s.canvas : makeCanvas(w, h);
    const ctx = canvas.getContext('2d') as Ctx2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let ty = range.y0; ty <= range.y1; ty++) for (let tx = range.x0; tx <= range.x1; tx++) {
      const tile = this.tiles.get(`${tx},${ty}`);
      // Row 0 of the sheet is the northmost tile row.
      if (tile) ctx.drawImage(tile as CanvasImageSource, (tx - range.x0) * size, (range.y1 - ty) * size);
    }
    this.sheet = { canvas, ...range, complete };
  }

  /**
   * Draw the radar into `rect` (CSS px of the HUD canvas; the caller's
   * transform carries the device pixel ratio). The rect's shorter side is the
   * diameter; the radar is centred in it.
   */
  draw(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }, view: RadarView, minRadiusM: number): void {
    const started = performance.now();
    const dpr = ctx.getTransform().a || 1;
    const diameter = Math.min(rect.width, rect.height);
    const R = diameter / 2;
    const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
    const inner = R - 3;
    const scale = inner / view.radiusM; // CSS px per metre now
    this.ensureScale(inner / minRadiusM, dpr);

    ctx.save();
    // Card: paper rim with the HUD's shadow.
    ctx.shadowColor = 'rgba(31,28,23,0.22)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = RADAR_COLORS.rim;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = RADAR_COLORS.rimLine; ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = RADAR_COLORS.land;
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2);

    // Map sheet. Tiles cover the square circumscribing the rim at this radius.
    if (this.data) {
      const range = tileRange(view.at, view.radiusM + 4);
      const before = this.tiles.size;
      const complete = this.ensureTiles(range, view.at);
      this.ensureSheet(range, complete, this.tiles.size !== before);
      const s = this.sheet!;
      const tilePx = Math.ceil(RADAR_TILE_M * this.ppm);
      const k = scale * RADAR_TILE_M / tilePx; // CSS px per sheet pixel
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-view.rotation);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.canvas as CanvasImageSource,
        scale * (s.x0 * RADAR_TILE_M - view.at[0]),
        scale * (view.at[1] - (s.y1 + 1) * RADAR_TILE_M),
        s.canvas.width * k, s.canvas.height * k);
      ctx.restore();
    }

    // Route: what is passed faint, what is ahead bold.
    const route = view.route;
    if (route && route.length >= 4) {
      const reach = view.radiusM * 1.5;
      const pathOf = (from: number, to: number) => {
        ctx.beginPath();
        let pen = false;
        for (let i = from; i < to; i++) {
          const x = route[i * 2], y = route[i * 2 + 1];
          if (Math.abs(x - view.at[0]) > reach || Math.abs(y - view.at[1]) > reach) { pen = false; continue; }
          const o = radarOffset([x - view.at[0], y - view.at[1]], view.rotation, scale);
          if (pen) ctx.lineTo(cx + o[0], cy + o[1]); else ctx.moveTo(cx + o[0], cy + o[1]);
          pen = true;
        }
      };
      const n = route.length / 2;
      const split = Math.max(0, Math.min(n - 1, view.routeIndex));
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (split > 0) {
        pathOf(0, split + 1);
        ctx.strokeStyle = RADAR_COLORS.routePassed; ctx.lineWidth = 3; ctx.stroke();
      }
      pathOf(split, n);
      ctx.strokeStyle = RADAR_COLORS.routeCasing; ctx.lineWidth = 6.5; ctx.stroke();
      ctx.strokeStyle = RADAR_COLORS.route; ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    // North tick on the rim.
    const north = radarOffset([0, 1], view.rotation, 1);
    ctx.fillStyle = 'rgba(31,28,23,0.72)';
    ctx.font = `700 ${diameter < 120 ? 8 : 9}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nr = R - (diameter < 120 ? 7 : 8);
    ctx.fillStyle = RADAR_COLORS.rim;
    ctx.beginPath(); ctx.arc(cx + north[0] * nr, cy + north[1] * nr, diameter < 120 ? 6 : 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(31,28,23,0.8)';
    ctx.fillText('N', cx + north[0] * nr, cy + north[1] * nr + 0.5);

    // Destination: a pin inside, an arrow on the rim when off the radar.
    if (view.destination) {
      const o = radarOffset([view.destination[0] - view.at[0], view.destination[1] - view.at[1]], view.rotation, scale);
      const pinRim = inner - 9;
      const placed = clampToRim(o, pinRim);
      ctx.translate(cx + placed.at[0], cy + placed.at[1]);
      ctx.fillStyle = HIGHLIGHT_CORAL;
      ctx.strokeStyle = '#fbf8f2';
      ctx.lineWidth = 2;
      if (placed.clamped) {
        ctx.rotate(placed.angle);
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, 6.5); ctx.closePath();
        ctx.stroke(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
        ctx.fillStyle = '#071E2B';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // The rider, always at the centre, pointing where the bike points on screen.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(view.angle - view.rotation + Math.PI / 2);
    const k = diameter < 120 ? 0.8 : 1;
    ctx.fillStyle = RADAR_COLORS.rider; ctx.strokeStyle = '#fbf8f2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8 * k); ctx.lineTo(6 * k, 6.5 * k); ctx.lineTo(0, 3.5 * k); ctx.lineTo(-6 * k, 6.5 * k); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();

    const ms = performance.now() - started;
    this.stats.frames++; this.stats.drawMs += ms; if (ms > this.stats.maxMs) this.stats.maxMs = ms;
  }
}
