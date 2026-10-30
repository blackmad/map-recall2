// Rider cover (lifted from vector-map.js `_updateRiderCover`, engine programme
// P0 freeze rule): while a ground-based footprint holds the rider (the
// Cuyperspassage under Centraal's train shed), the building over them goes.
// The decision and its hysteresis are coveredPassage.ts; this is the per-frame
// tracker both world views run, with the 8-a-second query throttle. Where the
// footprints come from (MapLibre's rendered extrusions, the streamer's tiles)
// is the caller's `query`.

import { coveringBuilding, initialCoverState, updateCoverState, type CoverState, type FootprintFeature } from '../coveredPassage';

/** Seconds between footprint queries: plenty against the enter/leave holds. */
export const COVER_QUERY_S = 0.12;

export type CoverUpdate = { covered: boolean; changed: boolean; id: string | null };

export class RiderCoverTracker {
  state: CoverState = initialCoverState();
  /** The covering building's id while covered (or last seen). */
  id: string | null = null;
  private checkedAt: number | null = null;
  private raw = false;

  update(rider: readonly [number, number], active: boolean, nowS: number, query: () => FootprintFeature[]): CoverUpdate {
    let coveredNow = false;
    if (active) {
      if (this.checkedAt != null && nowS - this.checkedAt < COVER_QUERY_S) coveredNow = this.raw;
      else {
        this.checkedAt = nowS;
        try {
          const cover = coveringBuilding(query(), rider);
          coveredNow = !!cover;
          if (cover) {
            const c = cover as FootprintFeature & { id?: unknown };
            this.id = String(c.properties && (c.properties as Record<string, unknown>).id != null ? (c.properties as Record<string, unknown>).id : c.id);
          }
        } catch (_) { coveredNow = false; }
        this.raw = coveredNow;
      }
    }
    const next = updateCoverState(this.state, coveredNow, nowS);
    const changed = next.covered !== this.state.covered;
    this.state = next;
    return { covered: next.covered, changed, id: this.id };
  }
}
