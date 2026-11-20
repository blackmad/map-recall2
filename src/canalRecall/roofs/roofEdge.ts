/**
 * Roof edge definition (feedback 8022e3, 2026-11-10, "roof color blends into ground too much", photo look, wide view
 * over Slotervaart / Lelylaan). The pale flat roofs there match the orthophoto (PDOK luchtfoto), so the lids keep
 * their colour; what the aerial shows and the frame lacked is the edge: a coping or parapet line that reads darker
 * than both the membrane and the paving round the building. With `?roofEdge=1`:
 *  - every flat roof of `minAreaM2` and more gets the lip (flatRoofSurface.ts parapetLipTris), not only those of
 *    LIP_MIN_M2 (100 m²): school wings and low blocks read as boxes from the air too;
 *  - the lip is a dark edge band (`copingHex`: the wall colour taken `copingMix` of the way to a weathered aluminium /
 *    concrete grey) `w` 0.9 m wide and `h` 0.15 m proud of the lid, top only (2 triangles an edge): a 0.3 m coping is
 *    under a pixel at the note's zoom, a 0.9 m band reads as the coping plus its shadow on the membrane;
 *  - a flat-roofed kit building (kitWall / kitRoof: the generic school, cinema and worship kits; Kentalis Signis,
 *    pand 0363100012117415, the pale roof in the note's frame) takes the band too (`kitRoofEdge`), nothing else of
 *    the flat-roof surface (its lid keeps the kit's tone);
 *  - a planned parapet (roofMesh.ts kind `parapet`, the flat-roofed periods) draws its coping band in the same dark
 *    coping (`parapetCopingHex`) instead of its pale trim, which on a pale lid over pale paving was a third pale tone;
 *  - the flat-surface triangle budget (flatRoofSurface.ts FLAT_SURFACE_BUDGET, 4 % of a chunk) grows by `budget` of
 *    the chunk's triangles for the lip pass, so the bands reach most flat roofs. Measured on bag-tile 8413/5384 (400
 *    pands, artifacts/fb-placement2/probe-coarse.ts): off 3 lips of 55 candidates, on 214 of 292 placed, chunk vertices
 *    +38 %; all of them (`budget` 0.5, 30 m²) cost +60 %.
 * Flag off: the lip as before (wall colour, 100 m² and up), byte-identical.
 */
export const ROOF_EDGE = { minAreaM2: 60, copingGrey: '#45433f', copingMix: 0.7, h: 0.15, w: 0.9, budget: { detail: 0.25, coarse: 0.25 } } as const;

/** The flag, read at call time (the chunk worker gets it on its job: threeBuildingsWorker.ts). */
export function roofEdgeOn(): boolean {
  const g = globalThis as { __canalRecallRoofEdge?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRoofEdge === 'boolean') return g.__canalRecallRoofEdge;
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('roofEdge');
    if (q !== null) return q === '1';
  } catch { /* no location */ }
  return g.process?.env?.ROOF_EDGE === '1';
}

/** The coping colour for a wall: `copingMix` of the way from the wall to the coping grey, in sRGB. */
export function copingHex(wallHex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(wallHex.trim());
  const g = ROOF_EDGE.copingGrey;
  if (!m) return g;
  const a = parseInt(m[1], 16), b = parseInt(g.slice(1), 16), t = ROOF_EDGE.copingMix;
  const ch = (v: number, s: number) => (v >> s) & 255, mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return `#${[16, 8, 0].map(s => mix(s).toString(16).padStart(2, '0')).join('')}`;
}

/** The lip's minimum roof area (m²): the flag's, else the surface default. */
export function lipMinAreaM2(defaultM2: number): number {
  return roofEdgeOn() ? ROOF_EDGE.minAreaM2 : defaultM2;
}

/** The lip's colour and size: the flag's coping, else the wall-coloured lip at the default size (no options: byte-identical). */
export function lipStyle(wallHex: string): { hex: string; opts: { h?: number; w?: number; innerFace?: boolean } } {
  return roofEdgeOn() ? { hex: copingHex(wallHex), opts: { h: ROOF_EDGE.h, w: ROOF_EDGE.w, innerFace: false } } : { hex: wallHex, opts: {} };
}

/** Extra flat-surface triangles for the copings (`budget` of the chunk's triangles); 0 with the flag off. */
export function lipRoomBonus(baseTris: number, coarse: boolean): number {
  return roofEdgeOn() ? Math.floor(baseTris * (coarse ? ROOF_EDGE.budget.coarse : ROOF_EDGE.budget.detail)) : 0;
}

/** A planned parapet's coping band: the dark coping over its trim colour; the trim itself with the flag off. */
export function parapetCopingHex(trimHex: string): string {
  return roofEdgeOn() ? copingHex(trimHex) : trimHex;
}


/** A flat kit roof's surface with the flag: the edge band only (no box), from `minAreaM2`; null off, or pitched. */
export function kitRoofEdge(flat: boolean, areaM2: number): { lip: boolean; box: boolean; areaM2: number } | null {
  return roofEdgeOn() && flat && areaM2 >= ROOF_EDGE.minAreaM2 ? { lip: true, box: false, areaM2 } : null;
}
