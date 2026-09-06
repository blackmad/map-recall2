/**
 * Doorplates: what a house number looks like as pixels, and how to read one.
 *
 * Extracted from `check-number-anchors.ts` unchanged, so that the block-shift fit
 * reads plates by exactly the rule the identity check grades them by. Two tools
 * disagreeing about what counts as a doorplate would make their numbers
 * incomparable, and the whole point of the block fit is that it is measured
 * against the same 85% the anchor check reports.
 */
/**
 * Digits of one doorplate, put back together into the number they spell.
 *
 * The recogniser returns 220 of its 330 readings as a single character. A
 * doorplate reading "242" comes back as '2', '4', '2' at three positions, and a
 * matcher that only ever compares whole strings throws all three away — which is
 * why 21 of 30 panden read as `unread` while the tiles plainly contain numbers.
 * Correcting the camera's vertical datum put the doors in frame and did almost
 * nothing to that count, because fragmentation, not aim, is what binds.
 *
 * Two facts about type make regrouping possible without guessing. `heightM` is
 * the glyph's height in metres, not its position, so digits of one plate share a
 * size; and a digit's advance is roughly 0.5–0.9 of its height, so digits of one
 * plate sit an advance apart while separate plates sit metres apart. A run that
 * satisfies both is a number; anything else is left as the single digit it was.
 *
 * The obvious danger is that this manufactures its own evidence: concatenating
 * scattered digits can spell anything, and with enough candidates something will
 * match. `decoyNumbers` below is the guard — the same assembled readings are
 * scored a second time against a house two doors along, and if assembly were
 * inventing matches it would invent them for the decoy just as readily.
 */
export const MIN_ADVANCE = 0.35, MAX_ADVANCE = 1.4, MIN_SIZE_RATIO = 0.55;
export const MAX_ANCHOR_OFFSET_M = 9;
/** How far inside both party walls a plate must sit before it counts either way. */
export const CONVICTING_MARGIN_M = 0.5;
/**
 * A doorplate digit is 8-25 cm, and glyph height tells you what you are reading.
 *
 * Every reading that confirmed came in at 9.8, 15.3 or 20.8 cm. Every reading
 * that conflicted came in at 43.1, 44.7 or 54.9 cm -- half-metre characters,
 * which is painted shopfront signage or a gable stone, not a number beside a
 * door. The separation is total on the sample there is, so the two are recorded
 * as different instruments rather than averaged into one rate.
 *
 * Signage is not discarded: a metre-wide "176" painted on a frontage is real
 * evidence about that frontage, and on a corner site it may be the only number
 * facing this way. It is just not a doorplate, and a business sign can name an
 * address that is not the building it hangs on, so it does not get to certify
 * identity on its own.
 */
export const DOORPLATE_MIN_M = 0.06, DOORPLATE_MAX_M = 0.28;

export function assemble<T extends { text: string; confidence: number; alongM: number; heightM: number }>(
  readings: readonly T[],
): Array<{ text: string; confidence: number; alongM: number; heightM: number; digits: number }> {
  const glyphs = readings
    .filter(r => /^\d$/.test(r.text.trim()) && r.heightM > 0)
    .sort((a, b) => a.alongM - b.alongM);
  const out = readings.map(r => ({
    text: r.text.trim(), confidence: r.confidence, alongM: r.alongM, heightM: r.heightM, digits: 1,
  }));
  for (let i = 0; i < glyphs.length; i++) {
    let text = glyphs[i].text.trim(), confidence = glyphs[i].confidence;
    let alongSum = glyphs[i].alongM, heightSum = glyphs[i].heightM;
    for (let j = i + 1; j < glyphs.length && j - i < 4; j++) {
      const previous = glyphs[j - 1], next = glyphs[j];
      const size = Math.min(previous.heightM, next.heightM) / Math.max(previous.heightM, next.heightM);
      const advance = (next.alongM - previous.alongM) / ((previous.heightM + next.heightM) / 2);
      if (size < MIN_SIZE_RATIO || advance < MIN_ADVANCE || advance > MAX_ADVANCE) break;
      text += next.text.trim();
      confidence = Math.min(confidence, next.confidence);
      alongSum += next.alongM; heightSum += next.heightM;
      const digits = j - i + 1;
      out.push({ text, confidence, alongM: alongSum / digits, heightM: heightSum / digits, digits });
    }
  }
  return out;
}
