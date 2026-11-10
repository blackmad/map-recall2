// The arrival card's footer line ("★ New personal best · Medium · Bike · Chase").
// On a phone the Dutch line was longer than the card and `wrapText` cut it
// mid-list ("… · Volgcam ·…"). Items are dropped whole, lowest value first,
// until the line fits, so the line never ends in a half-item or an ellipsis.

export interface FooterItem {
  text: string;
  /** Higher survives longer. The personal best should carry the highest rank. */
  rank: number;
}

export const FOOTER_SEPARATOR = ' · ';

/**
 * The footer text for `maxWidth`: every item in order, minus the lowest-ranked
 * ones until `measure` says it fits. The last remaining item is always kept, so
 * a pathologically narrow card still says something.
 */
export function fitFooterItems(items: readonly FooterItem[], maxWidth: number, measure: (text: string) => number): string {
  const kept = items.filter(item => item.text);
  const join = (list: readonly FooterItem[]): string => list.map(item => item.text).join(FOOTER_SEPARATOR);
  while (kept.length > 1 && measure(join(kept)) > maxWidth) {
    let lowest = 0;
    kept.forEach((item, index) => { if (item.rank < kept[lowest].rank) lowest = index; });
    kept.splice(lowest, 1);
  }
  return join(kept);
}
