// Orbit camera for the gallery pages (landmark gallery, house playground).
// The maths is pure and z-up (x east, y north, z up, like the building chunks); the DOM
// handler turns drag, wheel and pinch into orbit, zoom and (two fingers / right button) pan.

export type Orbit = {
  /** Degrees: 0 looks north from the south side, 90 looks west from the east side. */
  yaw: number;
  /** Degrees above the horizon. */
  pitch: number;
  dist: number;
  target: [number, number, number];
  minDist: number;
  maxDist: number;
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function orbitPosition(o: Orbit): [number, number, number] {
  const yaw = o.yaw * Math.PI / 180, pitch = o.pitch * Math.PI / 180;
  return [
    o.target[0] + Math.sin(yaw) * Math.cos(pitch) * o.dist,
    o.target[1] - Math.cos(yaw) * Math.cos(pitch) * o.dist,
    o.target[2] + Math.sin(pitch) * o.dist,
  ];
}

/** Zoom by a factor (>1 moves away), clamped to the orbit's range. */
export function zoomOrbit(o: Orbit, factor: number): void { o.dist = clamp(o.dist * factor, o.minDist, o.maxDist); }

/** Drag by pixels: the scene follows the pointer. */
export function rotateOrbit(o: Orbit, dxPx: number, dyPx: number): void {
  o.yaw = (o.yaw - dxPx * 0.4) % 360;
  o.pitch = clamp(o.pitch + dyPx * 0.3, 2, 88);
}

/** Pan the target along the ground, relative to the view direction. */
export function panOrbit(o: Orbit, dxPx: number, dyPx: number, viewHeightPx: number): void {
  const yaw = o.yaw * Math.PI / 180, scale = o.dist * 0.7 / Math.max(1, viewHeightPx);
  const rx = Math.cos(yaw), ry = Math.sin(yaw); // screen right on the ground
  const fx = Math.sin(yaw) * -1, fy = Math.cos(yaw); // screen up on the ground (away from the camera)
  o.target[0] += (-dxPx * rx + dyPx * fx) * scale;
  o.target[1] += (-dxPx * ry + dyPx * fy) * scale;
}

/**
 * Wire pointer input to an orbit. One pointer drags, two pinch (and pan), the wheel zooms.
 * `touchAction` stays `pan-y` unless the view is `captured` (expanded), so a phone can still
 * scroll past a card.
 */
export function attachOrbit(el: HTMLElement, orbit: Orbit, onChange: () => void, onFirstTouch?: () => void, wheelActive: () => boolean = () => true): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0, lastMid: { x: number; y: number } | null = null;
  const mid = () => { const p = [...pointers.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };
  const spread = () => { const p = [...pointers.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const down = (e: PointerEvent) => {
    onFirstTouch?.();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    if (pointers.size === 2) { lastPinch = spread(); lastMid = mid(); }
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (e.buttons & 2 || e.shiftKey) panOrbit(orbit, dx, dy, el.clientHeight); else rotateOrbit(orbit, dx, dy);
    } else if (pointers.size === 2) {
      const s = spread(), m = mid();
      if (lastPinch > 0 && s > 0) zoomOrbit(orbit, lastPinch / s);
      if (lastMid) panOrbit(orbit, m.x - lastMid.x, m.y - lastMid.y, el.clientHeight);
      lastPinch = s; lastMid = m;
    }
    onChange();
  };
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); lastPinch = 0; lastMid = null; if (pointers.size === 2) { lastPinch = spread(); lastMid = mid(); } };
  const wheel = (e: WheelEvent) => { if (!wheelActive()) return; e.preventDefault(); onFirstTouch?.(); zoomOrbit(orbit, Math.exp(e.deltaY * 0.0012)); onChange(); };
  const menu = (e: Event) => e.preventDefault();
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('contextmenu', menu);
  return () => {
    el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', menu);
  };
}
