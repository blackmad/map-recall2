/** Measured registration of each Haarlemmerbuurt strip against its BAG splits (metres, + = the photo front stands right of its span). */
export const STRIP_SHIFT_M: Record<string, number> = {'haarlemmerdijk-117-143': -1.2, 'haarlemmerdijk-2-58': 0.6, 'haarlemmerdijk-13-45': -0.9};

/**
 * Per-span exceptions to the face registration (pand id -> metres). Haarlemmerdijk 2-58, spans 0-3 (HD58/56, 54, 52, 50):
 * the 2022-12-15 stitch (mission TMX7316010203-002859) ghosts these fronts and stands them at 0, not +0.6 m. Settled
 * against the 2022-06-22 capture (missions TMX7316010203-002619/002620; its strip geometry in
 * data/front-records/evidence/haarlemmerdijk-2-58-20220622.strip.json), whose strip puts every front of spans 0-4 on its BAG span
 * at 0 (lane 2, 2026-11-13; pinned by 'the 2-58 registration drift' in src/canalRecall/houseLine/frontRecord.test.ts).
 */
export const STRIP_SPAN_SHIFT_M: Record<string, Record<string, number>> = {
  'haarlemmerdijk-2-58': {'0363100012177585': 0, '0363100012177584': 0, '0363100012177590': 0, '0363100012176280': 0},
};

/** The registration of one pand's span on its face's strip. */
export const shiftFor = (face: string, pandId: string): number => STRIP_SPAN_SHIFT_M[face]?.[pandId] ?? STRIP_SHIFT_M[face] ?? 0;
