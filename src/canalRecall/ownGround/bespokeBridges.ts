// Bridges drawn by a bespoke landmark model (lane landmarks-bridges-20261101, #175): the own-ground cell keeps
// their deck top (the ride surface, at the road graph's height) and skips the bridge kit's body (arches, piers,
// parapets, lamps, bascule frames), which the landmark GLB draws instead. Register id → manual catalogue id.
// bespokeBridges.test.ts holds every entry to a catalogue model that is placed (not held) and exported, so a
// held or missing model never leaves a bare deck over the water.
export const BESPOKE_BRIDGES: Readonly<Record<string, string>> = {
  BRU0236: 'blauwbrug',
  BRU0242: 'magere-brug',
};

/** The catalogue id of the landmark that draws this bridge's body, or null when the kit draws it. */
export const bespokeBridge = (id: string | null | undefined): string | null => (id && Object.prototype.hasOwnProperty.call(BESPOKE_BRIDGES, id) ? BESPOKE_BRIDGES[id] : null);
