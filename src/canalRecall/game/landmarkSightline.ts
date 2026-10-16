/**
 * The chase camera looks up at a tall landmark ahead (ride review 2026-10-14, J3). Riding the Prinsengracht toward
 * the Westerkerk with the Westertoren card open, the 85 m tower stayed out of the frame until ~100 m off: at the chase
 * pitch (48°) the frame's top edge reaches ~120 m of ground ahead, and the tower's base at 210 m stood 55 px above it.
 * Measured at the Leliegracht (4.88437, 52.37641, 182): +4° brought the base to −8 px, +8° to +37 px; MapLibre caps
 * the pitch at 60°, where only the nave shows, so the view also leads forward.
 *
 * Bounded and explainable: only a highlighted landmark at least `minHeightM` tall, within `reachM` and within
 * `enterDeg` of the heading (it stays engaged out to `stayDeg`), lifts the pitch by up to `maxPitchDeg` and leads the
 * view centre by up to `maxLeadM` along the heading. Full from `fullM` down to `nearFullM`, faded out by `nearZeroM`
 * (close by, the default frame shows it) and from `fullM` to `reachM`. Eased (`easeSightline`), so the camera never
 * jumps. Desktop first: the caller passes `enabled` false on a phone.
 */
export const SIGHTLINE = {
  minHeightM: 40, reachM: 300, fullM: 250, nearFullM: 120, nearZeroM: 80,
  enterDeg: 45, stayDeg: 60, maxPitchDeg: 8, maxLeadM: 50,
  /** Easing per 60 Hz frame toward the target view. */
  ease: 0.04,
} as const;

export interface SightlineView { pitchDeg: number; leadM: number }
export const NO_SIGHTLINE: SightlineView = Object.freeze({ pitchDeg: 0, leadM: 0 });

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Weight (0..1) of the lift at a ground distance from the rider to the landmark. */
export function sightlineWeight(distanceM: number): number {
  const s = SIGHTLINE;
  if (!Number.isFinite(distanceM) || distanceM >= s.reachM || distanceM <= s.nearZeroM) return 0;
  if (distanceM > s.fullM) return smooth((s.reachM - distanceM) / (s.reachM - s.fullM));
  if (distanceM < s.nearFullM) return smooth((distanceM - s.nearZeroM) / (s.nearFullM - s.nearZeroM));
  return 1;
}

/**
 * The target view for a landmark `distanceM` away on the ground, `offAxisDeg` off the rider's heading, `heightM` tall.
 * `engaged`: whether it was engaged last frame (hysteresis on the heading cone).
 */
export function landmarkSightline(target: { distanceM: number; offAxisDeg: number; heightM: number } | null, engaged: boolean, enabled = true): { view: SightlineView; engaged: boolean } {
  const s = SIGHTLINE;
  if (!enabled || !target || !(target.heightM >= s.minHeightM)) return { view: NO_SIGHTLINE, engaged: false };
  const off = Math.abs(((target.offAxisDeg % 360) + 540) % 360 - 180);
  const inCone = off <= (engaged ? s.stayDeg : s.enterDeg);
  const w = inCone ? sightlineWeight(target.distanceM) : 0;
  if (!(w > 0)) return { view: NO_SIGHTLINE, engaged: false };
  return { view: { pitchDeg: s.maxPitchDeg * w, leadM: s.maxLeadM * w }, engaged: true };
}

/** One frame of easing from `current` toward `target` (`dt` seconds; reduced motion snaps). */
export function easeSightline(current: SightlineView, target: SightlineView, dt: number, reducedMotion = false): SightlineView {
  if (reducedMotion) return target;
  const k = 1 - Math.pow(1 - SIGHTLINE.ease, Math.max(0, Math.min(dt, 1)) * 60);
  const pitchDeg = current.pitchDeg + (target.pitchDeg - current.pitchDeg) * k, leadM = current.leadM + (target.leadM - current.leadM) * k;
  return { pitchDeg: Math.abs(pitchDeg - target.pitchDeg) < 0.01 ? target.pitchDeg : pitchDeg, leadM: Math.abs(leadM - target.leadM) < 0.05 ? target.leadM : leadM };
}

/** Ground distance (m) and bearing off the heading (degrees) from a rider at `from` heading `headingDeg` (clockwise from north) to `to`, lng/lat. */
export function relativeTo(from: readonly [number, number], headingDeg: number, to: readonly [number, number]): { distanceM: number; offAxisDeg: number } {
  const lat = (from[1] + to[1]) / 2, kx = 111_320 * Math.cos((lat * Math.PI) / 180), ky = 110_540;
  const dx = (to[0] - from[0]) * kx, dy = (to[1] - from[1]) * ky;
  const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  return { distanceM: Math.hypot(dx, dy), offAxisDeg: bearing - headingDeg };
}
