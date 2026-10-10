// Pan / zoom / rotate / pitch for the overview camera. The maths is pure
// (state in, state out) so it is tested without a DOM; `bindGestures` is the
// thin pointer/wheel adapter. Behaviour follows MapLibre's handlers: drag
// grabs the ground point, wheel and pinch zoom about the cursor/midpoint,
// right-drag (or ctrl/⌘-drag) rotates and pitches, two-finger twist rotates,
// two fingers moving vertically together pitch.

import { cameraFrame, unproject, MAX_PITCH_DEG, type CameraState, type Viewport } from './mapCamera';
import type { Vec2 } from './frame';

export interface CameraLimits { minZoom: number; maxZoom: number; maxPitch: number; bounds?: [number, number, number, number] }
export const DEFAULT_LIMITS: CameraLimits = { minZoom: 9, maxZoom: 20, maxPitch: 70 };

export function clampCamera(cam: CameraState, limits: CameraLimits = DEFAULT_LIMITS): CameraState {
  let [x, y] = cam.center;
  if (limits.bounds) {
    x = Math.max(limits.bounds[0], Math.min(limits.bounds[2], x));
    y = Math.max(limits.bounds[1], Math.min(limits.bounds[3], y));
  }
  return {
    ...cam,
    center: [x, y],
    zoom: Math.max(limits.minZoom, Math.min(limits.maxZoom, cam.zoom)),
    pitch: Math.max(0, Math.min(Math.min(limits.maxPitch, MAX_PITCH_DEG), cam.pitch)),
    bearing: ((cam.bearing % 360) + 540) % 360 - 180,
  };
}

/** Drag: the ground point under `from` ends up under `to`. */
export function panBy(cam: CameraState, viewport: Viewport, from: { x: number; y: number }, to: { x: number; y: number }): CameraState {
  const f = cameraFrame(cam, viewport);
  const a = unproject(f, from.x, from.y), b = unproject(f, to.x, to.y);
  if (!a || !b) return cam;
  return { ...cam, center: [cam.center[0] - (b[0] - a[0]), cam.center[1] - (b[1] - a[1])] };
}

/** Zoom by `delta` (zoom levels) keeping the ground point under `at` fixed. */
export function zoomAround(cam: CameraState, viewport: Viewport, delta: number, at: { x: number; y: number }, limits: CameraLimits = DEFAULT_LIMITS): CameraState {
  const before = unproject(cameraFrame(cam, viewport), at.x, at.y);
  const next = clampCamera({ ...cam, zoom: cam.zoom + delta }, limits);
  const after = unproject(cameraFrame(next, viewport), at.x, at.y);
  if (!before || !after) return next;
  return { ...next, center: [next.center[0] + before[0] - after[0], next.center[1] + before[1] - after[1]] };
}

/** Rotate by `degrees` about the ground point under `at` (the screen centre by default). */
export function rotateAround(cam: CameraState, viewport: Viewport, degrees: number, at?: { x: number; y: number }): CameraState {
  const p = at ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const before = unproject(cameraFrame(cam, viewport), p.x, p.y);
  const next = { ...cam, bearing: cam.bearing + degrees };
  const after = unproject(cameraFrame(next, viewport), p.x, p.y);
  if (!before || !after) return next;
  return { ...next, center: [next.center[0] + before[0] - after[0], next.center[1] + before[1] - after[1]] };
}

export function pitchBy(cam: CameraState, degrees: number, limits: CameraLimits = DEFAULT_LIMITS): CameraState {
  return clampCamera({ ...cam, pitch: cam.pitch + degrees }, limits);
}

/** One pinch step from two pointers' previous and current positions. */
export function pinch(cam: CameraState, viewport: Viewport, prev: [Vec2, Vec2], next: [Vec2, Vec2], limits: CameraLimits = DEFAULT_LIMITS): CameraState {
  const mid = (p: [Vec2, Vec2]) => ({ x: (p[0][0] + p[1][0]) / 2, y: (p[0][1] + p[1][1]) / 2 });
  const span = (p: [Vec2, Vec2]) => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) || 1;
  const angle = (p: [Vec2, Vec2]) => Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]);
  const m0 = mid(prev), m1 = mid(next);
  const dy0 = next[0][1] - prev[0][1], dy1 = next[1][1] - prev[1][1];
  // Both fingers moving vertically the same way with little spread change: pitch.
  if (Math.sign(dy0) === Math.sign(dy1) && Math.abs(dy0) > 2 && Math.abs(dy1) > 2 && Math.abs(span(next) - span(prev)) < 4
    && Math.abs(next[0][0] - prev[0][0]) < Math.abs(dy0) * 0.5) {
    return pitchBy(cam, -(dy0 + dy1) / 2 * 0.4, limits);
  }
  let out = panBy(cam, viewport, m0, m1);
  out = zoomAround(out, viewport, Math.log2(span(next) / span(prev)), m1, limits);
  let turn = (angle(next) - angle(prev)) * 180 / Math.PI;
  turn = ((turn + 540) % 360) - 180;
  if (Math.abs(turn) > 0.3) out = rotateAround(out, viewport, -turn, m1);
  return out;
}

/** Wheel delta (px, as `WheelEvent.deltaY` in pixel mode) → zoom levels, MapLibre-like. */
export const wheelZoomDelta = (deltaY: number, deltaMode = 0) => -(deltaMode === 1 ? deltaY * 40 : deltaY) / 450;

/** Browser adapter. Returns an unbind function. */
export function bindGestures(el: HTMLElement, get: () => CameraState, set: (cam: CameraState) => void, limits: CameraLimits = DEFAULT_LIMITS): () => void {
  const pointers = new Map<number, Vec2>();
  let mode: 'pan' | 'rotate' | null = null;
  const vp = (): Viewport => ({ width: el.clientWidth, height: el.clientHeight });
  const pos = (e: PointerEvent | WheelEvent): Vec2 => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, pos(e));
    mode = e.button === 2 || e.ctrlKey || e.metaKey ? 'rotate' : 'pan';
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const now = pos(e);
    if (pointers.size >= 2) {
      const ids = [...pointers.keys()].slice(0, 2);
      const before: [Vec2, Vec2] = [pointers.get(ids[0])!, pointers.get(ids[1])!];
      pointers.set(e.pointerId, now);
      const after: [Vec2, Vec2] = [pointers.get(ids[0])!, pointers.get(ids[1])!];
      set(clampCamera(pinch(get(), vp(), before, after, limits), limits));
      return;
    }
    pointers.set(e.pointerId, now);
    if (mode === 'rotate') {
      let cam = rotateAround(get(), vp(), (now[0] - prev[0]) * 0.4);
      cam = pitchBy(cam, -(now[1] - prev[1]) * 0.3, limits);
      set(clampCamera(cam, limits));
    } else {
      set(clampCamera(panBy(get(), vp(), { x: prev[0], y: prev[1] }, { x: now[0], y: now[1] }), limits));
    }
  };
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); if (!pointers.size) mode = null; };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const [x, y] = pos(e);
    set(zoomAround(get(), vp(), wheelZoomDelta(e.deltaY, e.deltaMode), { x, y }, limits));
  };
  const menu = (e: Event) => e.preventDefault();
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('contextmenu', menu);
  el.style.touchAction = 'none';
  return () => {
    el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', menu);
  };
}
