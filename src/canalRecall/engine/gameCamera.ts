// The game camera → map camera solve (the MapLibre-free part of vector-map.js
// `sync`): world px → lng/lat, the game's zoom → MapLibre zoom, the view
// mode's pitch eased in (and flat during the start flight's overview), the
// chase landmark sightline lead, and the clearance pitch eased down fast and
// back up slowly. Used by the own world view; vector-map.js keeps its copy
// until P5 (freeze rule: fixes there must land here too).

export interface GameCamera {
  x: number; y: number; zoom: number; rotation: number;
  viewMode?: string; introOverview?: number; detached?: boolean; reducedMotion?: boolean;
  targetX?: number; targetY?: number;
}
export interface LoaderFrame { _lastCenterLng: number; _lastCenterLat: number; _lastOffsetX: number; _lastOffsetY: number }

export const PIXELS_PER_METRE = 3;

export function worldToLngLat(x: number, y: number, l: LoaderFrame, ppm = PIXELS_PER_METRE): [number, number] {
  const mLat = 111320, mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180);
  return [l._lastCenterLng + (x - l._lastOffsetX) / (mLng * ppm), l._lastCenterLat - (y - l._lastOffsetY) / (mLat * ppm)];
}
export function lngLatToWorld(lng: number, lat: number, l: LoaderFrame, ppm = PIXELS_PER_METRE): { x: number; y: number } {
  const mLat = 111320, mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180);
  return { x: l._lastOffsetX + (lng - l._lastCenterLng) * mLng * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * mLat * ppm };
}

export interface ViewRequest {
  lngLat: [number, number];
  /** The rider (not the led view centre): residency, clearance and cover follow it. */
  subject: [number, number];
  zoom: number;
  bearing: number;
  /** The eased view-mode pitch before clearance. */
  pitch: number;
  introFlat: number;
  detached: boolean;
  leadM: number;
  /** A clearance check is due (moved 8 m, turned 8°, zoomed, or 1 s old). */
  needsClearance: boolean;
}

export interface SolveDeps {
  pitchForViewMode(mode: string): number;
  zoomOffsetForViewMode(mode: string): number;
  landmarkView: { pitchDeg: number; leadM: number } | null;
  /** CSS px of the game canvas per logical CANVAS_W unit. */
  displayScale: number;
  now: number;
}

export class GameCameraSolver {
  pitchSmoothed: number | null = null;
  clearancePitch: number | null = null;
  clearancePitchRequested: number | null = null;
  safePitch: number | null = null;
  private lastCheck: { center: [number, number]; zoom: number; bearing: number; at: number } | null = null;

  request(camera: GameCamera, loader: LoaderFrame, deps: SolveDeps): ViewRequest {
    const [lon, lat] = worldToLngLat(camera.x, camera.y, loader);
    const mLat = 111320, mLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    const ppm = PIXELS_PER_METRE * camera.zoom * deps.displayScale;
    const zoom = Math.log2(Math.cos(lat * Math.PI / 180) * 156543.03392 * ppm);
    const viewMode = camera.viewMode || 'north';
    const bearing = camera.rotation * 180 / Math.PI;
    const introFlat = Math.max(0, Math.min(1, camera.introOverview || 0));
    const sight = viewMode === 'chase' && !camera.detached ? deps.landmarkView : null;
    const target = Math.min(85, deps.pitchForViewMode(viewMode) + (sight ? sight.pitchDeg : 0)) * (1 - introFlat);
    if (this.pitchSmoothed == null || camera.reducedMotion || introFlat > 0) this.pitchSmoothed = target;
    else {
      this.pitchSmoothed += (target - this.pitchSmoothed) * 0.12;
      if (Math.abs(target - this.pitchSmoothed) < 0.15) this.pitchSmoothed = target;
    }
    const pitch = this.pitchSmoothed;
    const mapZoom = zoom + deps.zoomOffsetForViewMode(viewMode) * (1 - introFlat);
    const prev = this.lastCheck;
    const moved = prev ? Math.hypot((lon - prev.center[0]) * mLng, (lat - prev.center[1]) * mLat) : Infinity;
    const turned = prev ? Math.abs(Math.atan2(Math.sin((bearing - prev.bearing) * Math.PI / 180), Math.cos((bearing - prev.bearing) * Math.PI / 180)) * 180 / Math.PI) : Infinity;
    const detached = !!camera.detached;
    const needsClearance = pitch > 0 && !detached && introFlat === 0 && (!prev || moved > 8 || turned > 8 || Math.abs(mapZoom - prev.zoom) > 0.05 || deps.now - prev.at > 1000);
    if (needsClearance) this.lastCheck = { center: [lon, lat], zoom: mapZoom, bearing, at: deps.now };
    const subject: [number, number] = Number.isFinite(camera.targetX) && Number.isFinite(camera.targetY)
      ? worldToLngLat(camera.targetX!, camera.targetY!, loader) : [lon, lat];
    const leadM = sight ? sight.leadM * (1 - introFlat) : 0;
    const b = bearing * Math.PI / 180;
    return { lngLat: [lon + Math.sin(b) * leadM / mLng, lat + Math.cos(b) * leadM / mLat], subject, zoom: mapZoom, bearing, pitch, introFlat, detached, leadM, needsClearance };
  }

  /** The pitch to draw: the clearance's safe pitch, eased down fast (0.25) and up slowly (0.05). */
  applyClearance(view: ViewRequest, reducedMotion = false): number {
    const { pitch, detached, introFlat } = view;
    const safe = detached || introFlat > 0 ? pitch : Math.min(pitch, this.safePitch ?? pitch);
    const following = safe >= pitch && this.clearancePitch != null && this.clearancePitch >= (this.clearancePitchRequested ?? pitch) - 0.1;
    if (this.clearancePitch == null || detached || introFlat > 0 || reducedMotion || following) this.clearancePitch = safe;
    else {
      const rate = safe < this.clearancePitch ? 0.25 : 0.05;
      this.clearancePitch += (safe - this.clearancePitch) * rate;
      if (Math.abs(safe - this.clearancePitch) < 0.1) this.clearancePitch = safe;
    }
    this.clearancePitchRequested = pitch;
    return Math.min(pitch, this.clearancePitch);
  }
}
