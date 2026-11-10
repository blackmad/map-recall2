/**
 * The user's three bare-block shots (2026-11-08, map-recall2-screenshots engine/2026-11-08-user-shots), lane R5-D #264.
 * `camera`/`zoom`/`bearing`/`pitch` hold the aerial pose of each shot (fitted by eye to the shot); `pands` are the BAG
 * pand numbers the shot is about. tests/e2e/bare-fronts-shots.spec.ts re-takes them; scripts/check-large-tier.ts pins
 * their decoration.
 *  - vob: Van Oldenbarneveldtstraat 48-56 (2006, 23 m, 7 storeys), seen from the south-west over Frederik Hendrikstraat.
 *  - vhs: the U-shaped 2001 block with two round towers at Van Hallstraat / Kattensloot (a 252-vertex ring).
 *  - pmg: the block the user called "behind Plantage Muidergracht": the Rijksakademie courtyard ranges (Sarphatistraat
 *    470) between Mauritskade and the barracks, repointed (R5-D board item) to [4.916, 52.360] from the old pose over Oosterpark; bearing 58 faces the pand (0.5 km ENE), the board's "NNE" was a slip.
 * All three are installed large-recipe GLBs with blank walls (blankInstalls.ts), not bare generic facades.
 */
export const BARE_SPOTS = [
  { name: 'vob', camera: [4.8738, 52.3754], zoom: 17.3, bearing: 105, pitch: 62, pands: ['0363100012137990'] },
  { name: 'vhs', camera: [4.8726, 52.3804], zoom: 17.3, bearing: 15, pitch: 62, pands: ['0363100012120309'] },
  { name: 'pmg', camera: [4.916, 52.360], zoom: 17.3, bearing: 58, pitch: 60, pands: ['0363100012165748'] },
] as const;
