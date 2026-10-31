// "Settled" for the own engine: what `WorldCamera.whenIdle()` waits for under `?engine=own` (MapLibre's is its
// `idle` event). game-route.js `_waitForMapSettle` holds the loading screen on it, bounded by its own timeout.
// Each check answers true while its loader still has work for the current view; a loader that never started (a
// failed bundle, a city without the extract) is not waited on.

import { toLocal } from '../ownMap/frame';

/** The parts of the own world view the checks read (OwnWorldView's fields). */
export interface SettleSources {
  /** The view centre (WorldCamera.center). */
  camera?: { center(): { lng: number; lat: number } };
  _overview: unknown;
  status: Record<string, unknown>;
  _ownGround: { ready?: boolean; loadingCells?: number; coversRect?(x0: number, y0: number, x1: number, y1: number): boolean } | null;
  _threeBuildings: { loadingCount?: number } | null;
  _completeCity?: { status?(): { inFlight: number; queued: number } } | null;
  _signatureLandmarks?: { _pending?: { size: number } } | null;
}

/**
 * The ground counts as settled once the cells round the view centre are in, not the whole ring: the ring keeps
 * building a cell or two a second after landing (measured 2026-10-31: 10 cells pending at the hand-off, 2 left 6 s
 * later), and the loading screen should not wait for the far edge.
 */
export const SETTLE_GROUND_RADIUS_M = 300;

const failed = (v: SettleSources, what: string) => Array.isArray(v.status.failed) && (v.status.failed as string[]).some(f => f.startsWith(`${what}:`));

export function settleChecks(v: SettleSources): Array<[string, () => boolean]> {
  return [
    ['overview', () => !v._overview && !failed(v, 'overview')],
    ['ownGround', () => {
      const g = v._ownGround;
      if (!g) return false;
      if (!g.ready) return true;
      if ((g.loadingCells ?? 0) === 0) return false;
      const c = v.camera?.center();
      if (!c || !g.coversRect) return true;
      const [x, y] = toLocal(c.lng, c.lat), r = SETTLE_GROUND_RADIUS_M;
      return !g.coversRect(x - r, y - r, x + r, y + r);
    }],
    ['buildingTiles', () => { const s = v._completeCity?.status?.(); return !!s && s.inFlight + s.queued > 0; }],
    ['facades', () => (v._threeBuildings?.loadingCount ?? 0) > 0],
    ['landmarks', () => (v._signatureLandmarks?._pending?.size ?? 0) > 0],
  ];
}

/** Names of the checks still loading. */
export function settlePending(v: SettleSources): string[] {
  return settleChecks(v).filter(([, busy]) => busy()).map(([name]) => name);
}
