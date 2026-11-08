/**
 * The first frame after the loading screen lifts draws the camera at its resting elevation (issue #267).
 *
 * The own world view places the camera's centre on the rider's ground height (`riderSurfaceM`), eased 35 % per call
 * of `easeRiderSurface`. The game calls that from `setPlayerBike` (and the boat/tram twins) *after* `sync` placed the
 * camera, and never while the loading screen is up. So the first visible frame drew the camera at elevation 0 and the
 * next ~8 frames slid it to the ground (e.g. -1.77 m NAP): the whole picture shifted, 9.8 / 6.7 / 4.8 / 3.3 % of the
 * pixels per frame (headed Chrome, 1512x982 @2, 2026-11-08). That slide was the "lighting step" at the reveal: with
 * `?shadows=0`, `?chunkFade=0`, `?swapFade=0` or `?transition=0` it stayed, and each frame's change tracked the
 * elevation step.
 *
 * The rule (pure): while covered, the hold is armed. The first uncovered `sync` primes the eased surface to the ground
 * height under the rider (no ease), unless the start flies the intro (`introFlat > 0`: the camera's elevation is 0
 * there anyway and the intro's own landing keeps today's ease) or the camera is panned off the rider, or the ground cannot answer yet. Either way the
 * first uncovered sync disarms it; the ease runs as before from then on. `?revealLight=0` (or
 * `window.__canalRecallRevealLight = false`) never primes: today's reveal.
 */

export interface RevealSyncState {
  /** The game's loading screen covers the world (GameState.LOADING). */
  covered: boolean;
  /** The start flight's overview share (gameCamera.ts ViewRequest.introFlat). */
  introFlat: number;
  /** Panned off the rider. */
  detached: boolean;
  /** The ground can answer a height (OwnGround ready). */
  surfaceReady: boolean;
}

export function revealLightEnabled(value: unknown): boolean {
  if (value === false) return false;
  if (value === true || value == null) return true;
  return !/^(0|false|off)$/i.test(String(value));
}

export class RevealSurface {
  /** Armed from construction (the page opens on the loading screen) and again whenever the world is covered. */
  private armed = true;
  /** Primes made (diagnostics / specs). */
  primes = 0;
  constructor(readonly enabled: boolean) {}

  /**
   * One call per `sync`, before the camera's elevation is read. Returns true when this sync must take the ground height
   * directly (the caller sets its eased surface to the target and draws the camera there).
   */
  shouldPrime(s: RevealSyncState): boolean {
    if (s.covered) { this.armed = true; return false; }
    if (!this.armed) return false;
    this.armed = false;
    // A ground that cannot answer yet draws the camera at 0 today; priming it later, mid-ride, would be a one-frame jump
    // where today eases, so the first uncovered sync is the only one that may prime.
    if (!this.enabled || !s.surfaceReady || s.introFlat > 0 || s.detached) return false;
    this.primes++;
    return true;
  }
}
