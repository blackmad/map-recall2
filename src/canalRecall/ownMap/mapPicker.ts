// The custom-route map picker without live third-party tiles.
//
// It used to be Leaflet (from unpkg) over live `tile.openstreetmap.org`
// rasters, with Nominatim for search (old public/canal-drive/js/map-picker.js:
// 217-250, 243). It now draws our own extracts on a 2D canvas: Amsterdam from
// the own-map overview (water, parks, streets by class, rail), the other
// playable cities from their shipped streets/water/parks extracts. Search is
// a local lookup over the loaded street, water, park and neighbourhood names.
//
// Behaviour kept: three steps (area → START → FINISH) with the
// OSM_FETCH_RADIUS circle, start/finish only inside it, RESET, RACE!,
// CANCEL (calls `onCancel`), quick city buttons (now the game's cities), and
// `show(cb)` → `cb(lat, lng, startLatLng, finishLatLng)`.
//
// Build: npx esbuild src/canalRecall/ownMap/mapPicker.ts --bundle --format=iife --minify \
//          --outfile=public/canal-drive/js/map-picker.js
// (the classic-script global `MapPicker` that game.js constructs.)

import { fromLocal, toLocal, type Vec2 } from './frame';
import { decodeOverview, type OverviewFile } from './overviewFormat';
import { cameraForPoints, metresPerPixel, type CameraState } from './mapCamera';
import { bindGestures, clampCamera, type CameraLimits } from './gestures';
import { PALETTE, STREET_STYLE, interpolateStops } from './style';
import { CANAL_CITIES, CANAL_CITY_IDS, type CanalCity } from '../game/cities';

declare const OSM_FETCH_RADIUS: number | undefined;
const fetchRadius = () => (typeof OSM_FETCH_RADIUS === 'number' ? OSM_FETCH_RADIUS : 5000);

type LatLng = { lat: number; lng: number };

/** One city's drawable layers, as Path2D in own-map local metres. */
interface CityLayers {
  water: Path2D; waterLines: Path2D; parks: Path2D; rail: Path2D;
  streets: Array<{ cls: keyof typeof STREET_STYLE; path: Path2D }>;
  /** name → a point on it, for search. */
  names: Map<string, Vec2>;
  bounds: [number, number, number, number];
  source: string;
}

const LIMITS: CameraLimits = { minZoom: 8, maxZoom: 18, maxPitch: 0 };

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function inflateJson<T>(r: Response): Promise<T> {
  const b = new Uint8Array(await r.arrayBuffer());
  const text = b[0] === 0x1f && b[1] === 0x8b
    ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b);
  return JSON.parse(text) as T;
}

const addLine = (p: Path2D, pts: readonly Vec2[]) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); };
const addRing = (p: Path2D, pts: readonly Vec2[]) => { addLine(p, pts); p.closePath(); };

async function loadAmsterdam(root: string): Promise<CityLayers> {
  const r = await fetch(`${root}/own-map-v1/overview.json.gz`);
  if (!r.ok) throw new Error(`overview ${r.status}`);
  const d = decodeOverview(await inflateJson<OverviewFile>(r));
  const L: CityLayers = { water: new Path2D(), waterLines: new Path2D(), parks: new Path2D(), rail: new Path2D(), streets: [], names: new Map(), bounds: d.bounds, source: 'own-map-v1' };
  for (const poly of d.water) for (const ring of poly) addRing(L.water, ring);
  for (const p of d.parks) for (const ring of p.rings) addRing(L.parks, ring);
  for (const r2 of d.rail) if (!r2.tunnel && r2.kind === 'rail') addLine(L.rail, r2.points);
  const by = new Map<string, Path2D>();
  for (const s of d.streets) {
    if (s.cls === 'path') continue;
    let p = by.get(s.cls); if (!p) by.set(s.cls, p = new Path2D());
    addLine(p, s.points);
    if (s.name && !L.names.has(s.name)) L.names.set(s.name, s.points[s.points.length >> 1]);
  }
  for (const w of d.waterLines) if (!L.names.has(w.name)) L.names.set(w.name, w.points[w.points.length >> 1]);
  for (const h of d.hoods) if (!L.names.has(h.name)) L.names.set(h.name, h.at);
  for (const p of d.parks) if (p.name && p.rings[0] && !L.names.has(p.name)) L.names.set(p.name, p.rings[0][0]);
  L.streets = [...by].map(([cls, path]) => ({ cls: cls as keyof typeof STREET_STYLE, path })).sort((a, b) => STREET_STYLE[a.cls].order - STREET_STYLE[b.cls].order);
  return L;
}

type Feature = { name?: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] };
async function loadOtherCity(root: string): Promise<CityLayers> {
  const get = async (f: string) => { try { const r = await fetch(`${root}/${f}`); return r.ok ? await r.json() as Feature[] : []; } catch { return []; } };
  const [streets, water, parks] = await Promise.all([get('streets.json'), get('water.json'), get('parks.json')]);
  const L: CityLayers = { water: new Path2D(), waterLines: new Path2D(), parks: new Path2D(), rail: new Path2D(), streets: [], names: new Map(), bounds: [Infinity, Infinity, -Infinity, -Infinity], source: 'streets/water/parks.json' };
  const paths = (f: Feature) => (f.paths?.length ? f.paths : f.path ? [f.path] : []).map(r => r.map(([lat, lng]) => toLocal(lng, lat)));
  const grow = (pts: Vec2[]) => { for (const [x, y] of pts) { L.bounds[0] = Math.min(L.bounds[0], x); L.bounds[1] = Math.min(L.bounds[1], y); L.bounds[2] = Math.max(L.bounds[2], x); L.bounds[3] = Math.max(L.bounds[3], y); } };
  const minor = new Path2D(), major = new Path2D();
  for (const s of streets) for (const pts of paths(s)) {
    addLine(/^(motorway|trunk|primary|secondary)/.test(s.highway ?? '') ? major : minor, pts); grow(pts);
    if (s.name && !L.names.has(s.name)) L.names.set(s.name, pts[pts.length >> 1]);
  }
  for (const w of water) for (const pts of paths(w)) { addLine(L.waterLines, pts); grow(pts); if (w.name && !L.names.has(w.name)) L.names.set(w.name, pts[pts.length >> 1]); }
  for (const p of parks) for (const pts of paths(p)) { addRing(L.parks, pts); if (p.name && !L.names.has(p.name)) L.names.set(p.name, pts[0]); }
  L.streets = [{ cls: 'minor', path: minor }, { cls: 'secondary', path: major }];
  return L;
}

const BTN = 'background: rgba(0,0,0,0.7); color: #90CAF9; border: 1px solid #90CAF9; padding: 5px 12px; font-family: monospace; font-size: 12px; cursor: pointer; border-radius: 4px; font-weight: bold;';

export class MapPicker {
  container: HTMLDivElement | null = null;
  canvas: HTMLCanvasElement | null = null;
  confirmBtn: HTMLButtonElement | null = null;
  cancelBtn: HTMLButtonElement | null = null;
  instructionEl: HTMLDivElement | null = null;
  searchInput: HTMLInputElement | null = null;
  onSelect: ((lat: number, lng: number, start: LatLng | null, finish: LatLng | null) => void) | null = null;
  onCancel: (() => void) | null = null;
  selectedLat: number | null = null;
  selectedLng: number | null = null;
  startLatLng: LatLng | null = null;
  finishLatLng: LatLng | null = null;
  /** 0 = pick area, 1 = pick start, 2 = pick finish. */
  step = 0;
  city: CanalCity = CANAL_CITIES.amsterdam;
  /** Camera (own-map local metres, plan view). Exposed for tests. */
  cam: CameraState = { center: [0, 0], zoom: 12, bearing: 0, pitch: 0 };
  layers: CityLayers | null = null;
  private _searchWrapper: HTMLDivElement | null = null;
  private _citiesBar: HTMLDivElement | null = null;
  private _unbind: (() => void) | null = null;
  private _raf = 0;
  private _cache = new Map<string, Promise<CityLayers>>();
  private _loadSerial = 0;

  show(onLocationSelected: MapPicker['onSelect']): void {
    this.onSelect = onLocationSelected;
    this.step = 0;
    this.startLatLng = null; this.finishLatLng = null; this.selectedLat = null; this.selectedLng = null;
    this._createContainer();
    const g = (window as unknown as { canalRecallGame?: { city?: { id?: string } } }).canalRecallGame;
    const id = g?.city?.id && (CANAL_CITY_IDS as readonly string[]).includes(g.city.id) ? g.city.id as CanalCity['id'] : 'amsterdam';
    void this.setCity(CANAL_CITIES[id]);
  }

  hide(): void {
    cancelAnimationFrame(this._raf);
    this._unbind?.(); this._unbind = null;
    for (const el of [this.container, this.instructionEl, this._searchWrapper, this._citiesBar, this.cancelBtn, this.confirmBtn, document.getElementById('map-reset-btn')]) el?.parentNode?.removeChild(el);
    this.container = null; this.canvas = null; this.confirmBtn = null; this.cancelBtn = null; this.instructionEl = null;
    this.searchInput = null; this._searchWrapper = null; this._citiesBar = null;
  }

  /** Switch city: load (cached) its layers and frame it. */
  async setCity(city: CanalCity): Promise<void> {
    this.city = city;
    const serial = ++this._loadSerial;
    this.cam = { center: toLocal(city.center.lng, city.center.lat), zoom: 12, bearing: 0, pitch: 0 };
    this.layers = null;
    this._draw();
    // extractPath is relative to public/canal-drive/ (cities.ts), as the game resolves it.
    const root = new URL(city.extractPath, location.href).href.replace(/\/$/, '');
    let p = this._cache.get(city.id);
    if (!p) { p = city.id === 'amsterdam' ? loadAmsterdam(root).catch(() => loadOtherCity(root)) : loadOtherCity(root); this._cache.set(city.id, p); }
    const layers = await p;
    if (serial !== this._loadSerial || !this.canvas) return;
    this.layers = layers;
    const [x0, y0, x1, y1] = layers.bounds;
    const c = toLocal(city.center.lng, city.center.lat);
    // Frame ~12 km round the centre, not the whole extract box.
    const half = 6000;
    const box: Vec2[] = [[Math.max(x0, c[0] - half), Math.max(y0, c[1] - half)], [Math.min(x1, c[0] + half), Math.min(y1, c[1] + half)]];
    this.cam = cameraForPoints(box, this._vp(), { padding: { top: 130, bottom: 30, left: 20, right: 20 } });
    this._draw();
  }

  private _vp() { return { width: this.canvas?.clientWidth || innerWidth, height: this.canvas?.clientHeight || innerHeight }; }

  /** Screen px ↔ lng/lat (plan view). */
  project(lng: number, lat: number): { x: number; y: number } {
    const [x, y] = toLocal(lng, lat), vp = this._vp(), mpp = this._mpp();
    return { x: vp.width / 2 + (x - this.cam.center[0]) / mpp, y: vp.height / 2 - (y - this.cam.center[1]) / mpp };
  }
  unproject(px: number, py: number): LatLng {
    const vp = this._vp(), mpp = this._mpp();
    const [lng, lat] = fromLocal(this.cam.center[0] + (px - vp.width / 2) * mpp, this.cam.center[1] - (py - vp.height / 2) * mpp);
    return { lat, lng };
  }
  private _mpp() { return metresPerPixel(this.cam.zoom, fromLocal(this.cam.center[0], this.cam.center[1])[1]); }

  private _createContainer(): void {
    document.getElementById('map-container')?.remove();
    this.container = document.createElement('div');
    this.container.id = 'map-container';
    this.container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1000; border-radius: 0; background: ' + PALETTE.land + ';';
    this.canvas = document.createElement('canvas');
    this.canvas.dataset.testid = 'map-picker-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;';
    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);

    this.instructionEl = document.createElement('div');
    this.instructionEl.dataset.testid = 'map-picker-instruction';
    this.instructionEl.style.cssText = 'position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1001; background: rgba(0,0,0,0.85); color: #FFD700; padding: 10px 24px; border-radius: 6px; font-family: monospace; font-size: 14px; pointer-events: none; white-space: nowrap; max-width: calc(100vw - 120px); overflow: hidden; text-overflow: ellipsis;';
    this.instructionEl.textContent = 'Step 1: Click to select your race area';
    document.body.appendChild(this.instructionEl);

    this._searchWrapper = document.createElement('div');
    this._searchWrapper.style.cssText = 'position: fixed; top: 54px; left: 50%; transform: translateX(-50%); z-index: 1001; display: flex; gap: 4px;';
    document.body.appendChild(this._searchWrapper);
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search a street, canal or area…';
    this.searchInput.style.cssText = 'width: min(260px, 60vw); padding: 8px 12px; border: 2px solid #FFD700; border-radius: 4px; background: rgba(0,0,0,0.8); color: #FFF; font-family: monospace; font-size: 13px; outline: none;';
    this.searchInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this._doSearch(); });
    this._searchWrapper.appendChild(this.searchInput);
    const searchBtn = document.createElement('button');
    searchBtn.textContent = 'GO';
    searchBtn.style.cssText = 'padding: 8px 14px; background: #FFD700; color: #111; border: none; font-family: monospace; font-size: 13px; font-weight: bold; cursor: pointer; border-radius: 4px;';
    searchBtn.addEventListener('click', () => this._doSearch());
    this._searchWrapper.appendChild(searchBtn);

    // Quick links: the game's playable cities (each has a shipped extract).
    this._citiesBar = document.createElement('div');
    this._citiesBar.style.cssText = 'position: fixed; top: 98px; left: 50%; transform: translateX(-50%); z-index: 1001; display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; width: max-content; max-width: calc(100vw - 24px);';
    for (const id of CANAL_CITY_IDS) {
      const city = CANAL_CITIES[id];
      const btn = document.createElement('button');
      btn.textContent = city.name;
      btn.dataset.city = id;
      btn.style.cssText = BTN;
      btn.addEventListener('mouseenter', () => { btn.style.background = '#90CAF9'; btn.style.color = '#111'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,0,0,0.7)'; btn.style.color = '#90CAF9'; });
      btn.addEventListener('click', e => { e.stopPropagation(); this._resetSelection(); void this.setCity(city); });
      this._citiesBar.appendChild(btn);
    }
    document.body.appendChild(this._citiesBar);

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.textContent = 'CANCEL';
    this.cancelBtn.style.cssText = 'position: fixed; top: 12px; right: 12px; z-index: 1001; background: #444; color: #FFF; border: none; padding: 8px 18px; font-family: monospace; font-size: 13px; font-weight: bold; cursor: pointer; border-radius: 4px;';
    this.cancelBtn.addEventListener('click', () => { this.hide(); this.onCancel?.(); });
    document.body.appendChild(this.cancelBtn);

    // Pan / wheel / pinch zoom (plan view only), and a tap that is not a drag picks.
    const canvas = this.canvas;
    this._unbind = bindGestures(canvas, () => this.cam, c => { this.cam = clampCamera({ ...c, bearing: 0, pitch: 0 }, LIMITS); this._draw(); }, LIMITS);
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('click', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = canvas.getBoundingClientRect();
      this._onMapClick(this.unproject(e.clientX - r.left, e.clientY - r.top));
    });
    addEventListener('resize', () => this._draw());
  }

  private _doSearch(): void {
    const query = this.searchInput?.value.trim().toLowerCase();
    if (!query || !this.layers) return;
    let hit: Vec2 | null = null;
    for (const [name, at] of this.layers.names) { if (name.toLowerCase() === query) { hit = at; break; } }
    if (!hit) for (const [name, at] of this.layers.names) { if (name.toLowerCase().includes(query)) { hit = at; break; } }
    if (hit) {
      this._resetSelection();
      this.cam = { center: hit, zoom: 14.5, bearing: 0, pitch: 0 };
      this._draw();
    } else if (this.instructionEl) this._flashError('Location not found. Try again.');
  }

  private _onMapClick(ll: LatLng): void {
    if (this.step === 0) {
      this.selectedLat = ll.lat; this.selectedLng = ll.lng;
      this.step = 1;
      this._updateInstruction();
      this._removeConfirmButton();
    } else if (this.step === 1) {
      if (!this._isWithinRadius(ll.lat, ll.lng)) { this._flashError('Start must be within the yellow circle!'); return; }
      this.startLatLng = ll;
      this.step = 2;
      this._updateInstruction();
    } else if (this.step === 2) {
      if (!this._isWithinRadius(ll.lat, ll.lng)) { this._flashError('Finish must be within the yellow circle!'); return; }
      this.finishLatLng = ll;
      this._updateInstruction();
      this._showConfirmButton();
    }
    this._draw();
  }

  _isWithinRadius(lat: number, lng: number): boolean {
    if (this.selectedLat == null || this.selectedLng == null) return false;
    return haversine({ lat: this.selectedLat, lng: this.selectedLng }, { lat, lng }) <= fetchRadius();
  }

  private _flashError(msg: string): void {
    if (!this.instructionEl) return;
    this.instructionEl.textContent = msg;
    this.instructionEl.style.color = '#F44336';
    setTimeout(() => { if (!this.instructionEl) return; this.instructionEl.style.color = '#FFD700'; this._updateInstruction(); }, 2000);
  }

  private _updateInstruction(): void {
    const el = this.instructionEl;
    if (!el) return;
    if (this.step === 0) el.textContent = 'Step 1: Click to select your race area';
    else if (this.step === 1) { el.textContent = 'Step 2: Click to place START point'; el.style.color = '#4CAF50'; }
    else if (this.finishLatLng) { el.textContent = 'Ready to race!'; el.style.color = '#FFD700'; }
    else { el.textContent = 'Step 3: Click to place FINISH point'; el.style.color = '#FFD700'; }
  }

  private _removeConfirmButton(): void {
    this.confirmBtn?.parentNode?.removeChild(this.confirmBtn);
    this.confirmBtn = null;
    document.getElementById('map-reset-btn')?.remove();
  }

  private _showConfirmButton(): void {
    this._removeConfirmButton();
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'RESET';
    resetBtn.id = 'map-reset-btn';
    resetBtn.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateX(-100px); z-index: 1001; background: #666; color: #FFF; border: none; padding: 14px 28px; font-family: monospace; font-size: 16px; font-weight: bold; cursor: pointer; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);';
    resetBtn.addEventListener('click', () => this._resetSelection());
    document.body.appendChild(resetBtn);
    this.confirmBtn = document.createElement('button');
    this.confirmBtn.textContent = 'RACE!';
    this.confirmBtn.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateX(60px); z-index: 1001; background: #FFD700; color: #111; border: none; padding: 14px 36px; font-family: monospace; font-size: 18px; font-weight: bold; cursor: pointer; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);';
    this.confirmBtn.addEventListener('click', () => {
      const lat = this.selectedLat!, lng = this.selectedLng!, s = this.startLatLng, f = this.finishLatLng;
      this.hide();
      this.onSelect?.(lat, lng, s, f);
    });
    document.body.appendChild(this.confirmBtn);
  }

  _resetSelection(): void {
    this.startLatLng = null; this.finishLatLng = null; this.selectedLat = null; this.selectedLng = null;
    this.step = 0;
    this._removeConfirmButton();
    if (this.instructionEl) this.instructionEl.style.color = '#FFD700';
    this._updateInstruction();
    this._draw();
  }

  private _draw(): void {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._paint());
  }

  private _paint(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const vp = this._vp(), dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(vp.width * dpr) || canvas.height !== Math.round(vp.height * dpr)) { canvas.width = Math.round(vp.width * dpr); canvas.height = Math.round(vp.height * dpr); }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PALETTE.land; g.fillRect(0, 0, vp.width, vp.height);
    const mpp = this._mpp(), L = this.layers;
    if (L) {
      // Local metres → CSS px (plan view: bearing 0, pitch 0).
      g.save();
      g.translate(vp.width / 2, vp.height / 2);
      g.scale(1 / mpp, -1 / mpp);
      g.translate(-this.cam.center[0], -this.cam.center[1]);
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.fillStyle = PALETTE.park; g.fill(L.parks, 'evenodd');
      g.fillStyle = PALETTE.water; g.fill(L.water, 'evenodd');
      g.strokeStyle = PALETTE.water; g.lineWidth = interpolateStops([[11, 1.5], [14, 4], [16, 10]], this.cam.zoom) * mpp; g.stroke(L.waterLines);
      g.strokeStyle = '#a9a6a2'; g.lineWidth = interpolateStops([[10, 0.5], [16, 1.8]], this.cam.zoom) * mpp; g.stroke(L.rail);
      for (const s of L.streets) {
        const st = STREET_STYLE[s.cls], px = interpolateStops(st.width, this.cam.zoom);
        if (px < 0.35) continue;
        if (st.casing && px > 1.2) { g.strokeStyle = st.casing; g.lineWidth = (px + st.casingExtra) * mpp; g.stroke(s.path); }
      }
      // Cities without an own-map overview carry only their quiz streets: draw
      // them as plain grey lines (white on cream vanished at city zoom).
      const sparse = L.source !== 'own-map-v1';
      for (const s of L.streets) {
        const st = STREET_STYLE[s.cls], px = interpolateStops(st.width, this.cam.zoom);
        if (!sparse && px < 0.35) continue;
        g.strokeStyle = sparse ? (s.cls === 'minor' ? '#a39888' : '#d9a861') : st.fill;
        g.lineWidth = (sparse ? Math.max(1.2, px) : px) * mpp; g.stroke(s.path);
      }
      g.restore();
    } else {
      g.fillStyle = '#334155'; g.font = '600 14px monospace'; g.textAlign = 'center'; g.fillText(`Loading ${this.city.name}…`, vp.width / 2, vp.height / 2);
    }
    // Race area circle (OSM_FETCH_RADIUS), START and FINISH markers.
    if (this.selectedLat != null && this.selectedLng != null) {
      const c = this.project(this.selectedLng, this.selectedLat), r = fetchRadius() / mpp;
      g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,215,0,0.08)'; g.fill(); g.strokeStyle = '#FFD700'; g.lineWidth = 2; g.stroke();
    }
    const marker = (ll: LatLng | null, colour: string, label: string) => {
      if (!ll) return;
      const p = this.project(ll.lng, ll.lat);
      g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2);
      g.fillStyle = colour; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; g.strokeStyle = colour; g.lineWidth = 3; g.stroke();
      g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const w = g.measureText(label).width + 12;
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(p.x - w / 2, p.y - 36, w, 20);
      g.fillStyle = '#111'; g.fillText(label, p.x, p.y - 19);
    };
    marker(this.startLatLng, '#4CAF50', 'START');
    marker(this.finishLatLng, '#FFD700', 'FINISH');
    g.font = '10px sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(30,41,59,.75)';
    g.fillText(`© OpenStreetMap contributors · own map (${L?.source ?? '…'})`, vp.width - 6, vp.height - 4);
  }
}

(window as unknown as { MapPicker: typeof MapPicker }).MapPicker = MapPicker;
