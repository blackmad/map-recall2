/**
 * What a mapped place (a click-POI row) may put on a card (lane D1, issue
 * #321, user 2026-11-09: "why are so many things being reported as 'an
 * artwork'?").
 *
 * A row whose only content is its kind ("Brettensuite 11/20 is an artwork")
 * is a label, not a card: the tap falls through to the building under it, or
 * to nothing. A street-art record for the same OSM id (artist, year, series,
 * Wikipedia lede) is the enrichment that makes an artwork worth a card.
 */
import type { ClickPoiRow } from './clickPoiInfo';
import type { StreetArtPoint } from './streetArt';

/** Row: id, name, lng, lat, category, kind phrase, address, website, English description. */
export const isLabelOnly = (row: Readonly<ClickPoiRow>): boolean => !row[6] && !row[7] && !row[8];

/** A street-art record that says something beyond the mapped name and kind. */
export const artHasSubstance = (art: Readonly<StreetArtPoint> | null | undefined): boolean =>
  !!art && !!(art.e || art.a || art.y || art.s);

/** The row has something to put on a card, on its own or through street art. */
export const hasCardSubstance = (row: Readonly<ClickPoiRow>, art?: Readonly<StreetArtPoint> | null): boolean =>
  !isLabelOnly(row) || (row[4] === 'art' && artHasSubstance(art));

/** English chip words for a category when the kind phrase is no use. */
const CATEGORY_CHIP: Readonly<Record<string, string>> = {
  art: 'artwork', food: 'food and drink', shop: 'shop', lodging: 'lodging', culture: 'culture', education: 'education',
  civic: 'public service', bike: 'cycling', worship: 'place of worship', leisure: 'leisure', health: 'health', market: 'market',
};

/** i18n key (src/i18n/messages) for the chip of a category. */
export const poiChipKey = (category: string): string => `poi.chip.${CATEGORY_CHIP[category] ? category : 'place'}`;

/** English fallback for the chip: the kind phrase without its article ("café"),
 *  else the category's words. Never "building" for a mapped node. */
export function poiChipEnglish(row: Readonly<ClickPoiRow>): string {
  const phrase = (row[5] || '').replace(/^(a|an|the)\s+/i, '').trim();
  return (phrase || CATEGORY_CHIP[row[4]] || 'place').toUpperCase();
}
