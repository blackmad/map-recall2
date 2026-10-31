/**
 * The card's landmark, lit once per value (#129). The game and the engine re-send the same landmark: relight() after
 * every landmark model shown or detailed-tile swap, a fresh notice object for the same place. Each send used to re-run
 * the facades' setHighlighted (a desaturation scan over every chunk) and the footprint scan for the marker.
 *
 * `apply` sends `setHighlighted` only when the lit ids or the card's point change, and the marker only when they change
 * or the footprint, which loads later than the card, has not been found yet. A new facades instance starts over.
 */
export type HighlightLngLat = [number, number];
export interface HighlightFocusLike { lngLat: HighlightLngLat; ids: string[]; [key: string]: unknown }

export interface HighlightTargets {
  /** The facades instance; a different one has not lit anything yet. */
  owner: unknown;
  setHighlighted(ids: string[], focus: HighlightFocusLike | null): void;
  /** The building footprint for the marker, or null while its chunk is not in. */
  footprint(ids: string[]): HighlightFocusLike | null;
  marker(focus: HighlightFocusLike | null): void;
}

export class LandmarkHighlight {
  private key: string | null = null;
  private owner: unknown = undefined;
  private footprintFound = false;

  /** Light `ids` for a card at `lngLat` (null: no card); true when anything was sent. */
  apply(ids: string[], lngLat: HighlightLngLat | null, t: HighlightTargets): boolean {
    const key = JSON.stringify([ids, lngLat]);
    const same = key === this.key && t.owner === this.owner;
    const focus = lngLat ? { lngLat, ids } : null;
    if (same && this.footprintFound) return false;
    if (!same) t.setHighlighted(ids, focus);
    this.key = key;
    this.owner = t.owner;
    const footprint = focus && ids.length ? t.footprint(ids) : null;
    // Nothing to find for a card without buildings (a statue's point) or with none open.
    this.footprintFound = !!footprint || !focus || !ids.length;
    t.marker(focus ? (footprint || focus) : null);
    return true;
  }
}
