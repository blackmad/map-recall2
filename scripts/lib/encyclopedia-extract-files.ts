/**
 * Partition files that carry encyclopedia blurbs through the enrich /
 * translate pipeline. Keep the three scripts on one list so a new surface
 * (or `all.json`) cannot be enriched in one pass and skipped in another.
 */
export const ENCYCLOPEDIA_PARTITION_FILES = [
  'water.json',
  'streets.json',
  'bridges.json',
  'squares.json',
  'parks.json',
  'landmarks.json',
  'all.json',
] as const;

/**
 * Files the game may put on a card. `all.json` is a mixed quiz pool, not a
 * card source; `street-knowledge.json` is generated from streets+water after
 * extracts land.
 */
export const ENCYCLOPEDIA_CARD_FILES = [
  'water.json',
  'streets.json',
  'bridges.json',
  'squares.json',
  'parks.json',
  'landmarks.json',
  'street-knowledge.json',
] as const;

export type EncyclopediaPartitionFile = (typeof ENCYCLOPEDIA_PARTITION_FILES)[number];
export type EncyclopediaCardFile = (typeof ENCYCLOPEDIA_CARD_FILES)[number];
