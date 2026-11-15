// G4 (#369): the far tier (a vertex-coloured 50 m grid, farRing.ts) drawn near the view centre reads as a blurry
// texture under the rider. The ground reports it after it has stood for NEAR_FAR_MS: a `canal-near-far` window event
// that monitoring.ts turns into a Sentry breadcrumb, and a dev-overlay line (`?nearFar=1`). Pure timing logic.

/** How long a far part may stand near the rider before it is reported, ms. */
export const NEAR_FAR_MS = 2000;

export interface NearFarPart { key: string; distM: number; resident: boolean; fading: boolean; pending: boolean; lod: number | null }
export interface NearFarReport { keys: string[]; minDistM: number; ms: number; residentKeys: string[]; pendingKeys: string[] }

/** Tracks when each near far part first showed; `step` returns a report once a part has stood > NEAR_FAR_MS, then again only after it cleared. */
export class NearFarWatch {
  private since = new Map<string, number>();
  private reported = new Set<string>();
  step(now: number, parts: readonly NearFarPart[]): NearFarReport | null {
    const live = new Set(parts.map(p => p.key));
    for (const k of [...this.since.keys()]) if (!live.has(k)) { this.since.delete(k); this.reported.delete(k); }
    const due: NearFarPart[] = [];
    for (const p of parts) {
      const t = this.since.get(p.key) ?? (this.since.set(p.key, now), now);
      if (now - t > NEAR_FAR_MS && !this.reported.has(p.key)) { due.push(p); this.reported.add(p.key); }
    }
    if (!due.length) return null;
    return { keys: due.map(p => p.key), minDistM: Math.min(...due.map(p => p.distM)), ms: Math.max(...due.map(p => now - (this.since.get(p.key) ?? now))), residentKeys: due.filter(p => p.resident).map(p => p.key), pendingKeys: due.filter(p => p.pending).map(p => p.key) };
  }
}

/** `?nearFar=0` turns the check off (it is on by default: a cheap scan of the far parts twice a second). */
export function nearFarFlag(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  try { return new URLSearchParams(search).get('nearFar') !== '0'; } catch { return true; }
}

/** Metres from the view centre within which a touch device builds a cell at `full` detail, not only the rider's own cell. */
export const TOUCH_FINE_M = 200;

/**
 * `?touchFine=<m>`: cells whose nearest edge is within m of the view centre stay `full` on a touch device (default
 * TOUCH_FINE_M; `0` restores the own-cell-only rule). The rider standing near a cell edge (Cornelis Lelylaan, G4 #369:
 * the neighbour 58 m away stayed `touch` for good, 3 cells of 9 within 260 m) drew the coarse level under the wheels.
 */
export function touchFineFlag(search: string = typeof location !== 'undefined' ? location.search : ''): number {
  try {
    const v = new URLSearchParams(search).get('touchFine');
    if (v !== null && Number.isFinite(Number(v)) && Number(v) >= 0) return Number(v);
  } catch { /* no location */ }
  return TOUCH_FINE_M;
}

/** Whether a touch device builds this wanted cell at full detail (pure; wantedCells). */
export function touchFine(groundNear: 'block' | 'cell' | 'all', own: boolean, beside: boolean, distM: number, fineM: number): boolean {
  if (groundNear === 'all') return false;
  return own || (groundNear === 'block' && beside) || distM <= fineM;
}
