/**
 * Recover a sign's text by voting across readings of it, rather than trusting one.
 *
 * The reader's failure on Amsterdam shopfronts is fragmentation, not fabrication:
 * partial words from shadow, awnings, parked vans and reflections. Raising
 * resolution does not fix it — the ground tier already renders 110 px/m and the
 * partial words happen there. What does fix it is already present in the data
 * and was being thrown away.
 *
 * Every sign is typically read more than once. Within a single crop the same
 * words appear on the fascia, on a window decal and on an awning valance, and
 * repeated signage along a hoarding gives several physical copies; across
 * campaign years the same frontage is photographed again under different light.
 * The readings differ because the *occlusion* differs, which is exactly the
 * condition under which a vote works: the errors are independent, so they do not
 * survive agreement.
 *
 * Measured examples from `.cache/facade-eval/vision-ocr-*.json`, all real:
 *
 *   one hoarding, four readings   WONDR · MONDR · TONDE · LONDO
 *   one billboard, three readings  "GRATIS SPARE RIBS CLAIM NU OP EERLIJK ETEN.NL"
 *                                  came back as GRAMS/SPAE/GRATIS, CLAIM NU OPI /
 *                                  CLAIM NIP / CLAIM HU OP, EERLIJK ETEN.NL /
 *                                  EERLIJK EMANL / LIJKETEN.NL
 *   one fascia, two readings       Handwork Boutique · Handwork Borfiaue
 *
 * In each case no single reading is right and the majority is.
 *
 * Two operations are deliberately kept apart, because conflating them is the
 * obvious way to get this wrong:
 *
 *   - **Placement** is per rectangle. Two `Hotel` signs at opposite ends of the
 *     same facade are two real signs, not one read twice, and merging them would
 *     lose one.
 *   - **The string** is voted across every similar reading regardless of
 *     rectangle, because repeated copies of one sign are the best evidence
 *     available about what it says.
 *
 * So clustering tests string similarity *and* glyph height — a physical gate,
 * since two signs at very different letter sizes are different signs — and the
 * cluster then reports its rectangles separately from its text.
 *
 * What this does not do: it never writes a character no reading contained, and a
 * reading nothing corroborates comes back marked `uncorroborated` rather than
 * quietly promoted. The caller decides whether one uncorroborated reading is
 * enough to publish; this module's job is to say how much agreement there was.
 */

/** A rectangle on the wall plane, in metres. `up` is metres above the crop base. */
export interface SignBox {
  along: number;
  up: number;
  width: number;
  height: number;
}

export interface SignReading {
  /**
   * Text as the reader returned it. Apple Vision joins the lines of one
   * observation with ' / '; those are separate strings and are split apart,
   * because a fragment of one line should not be matched against another.
   */
  text: string;
  /** Reader confidence, 0..1. */
  confidence: number;
  box: SignBox;
  /**
   * Which view this came from. Readings from one crop share that crop's light
   * and occluders, so they corroborate less than readings from different views;
   * the result reports both counts and leaves the weighting to the caller.
   */
  viewId?: string;
  /** Capture year, carried through for the persistence signal. */
  year?: number | null;
}

export interface ConsensusSign {
  /** The voted string. Every character came from some reading. */
  text: string;
  /** How many readings voted. */
  support: number;
  /** How many distinct views those readings came from. */
  views: number;
  /** Distinct capture years, ascending — the notability signal. */
  years: number[];
  /** Mean share of weight held by the winning character, 0..1. */
  agreement: number;
  /** Per-character agreement, so a caller can mark the uncertain glyphs. */
  charAgreement: number[];
  /** The rectangles this text was read at, one per physical instance. */
  placements: SignBox[];
  /** Every contributing reading, unmodified, for audit. */
  variants: string[];
  /** True when nothing corroborated this reading. */
  uncorroborated: boolean;
}

export interface ConsensusOptions {
  /**
   * Allowed edit distance between two readings, as a fraction of the longer
   * one, floored — so a five-character reading tolerates one bad glyph and not
   * two.
   *
   * The floor is the deliberate part. Rounding up instead merged `Lotto.` with
   * `TOTO` on a real frontage, two edits apart in five characters, which is the
   * same distance as `WONDR` from `TONDE` on the hoarding where merging is
   * correct. No string test separates those two cases, so the choice is which
   * error to make, and they are not symmetric: over-merging publishes a wrong
   * name on a real building, while under-merging leaves a sign uncorroborated,
   * which is a state this pipeline already handles. `WONDR` still reaches
   * support 2 through `MONDR`, one edit away.
   */
  editFraction?: number;
  /**
   * A fragment matches a longer reading when their longest common substring is
   * at least this many characters and covers this fraction of the shorter one.
   * This is what lets `SELLER` join `BESTSELLER` instead of orphaning.
   *
   * Six characters, not four. At four, a short reading shares enough with
   * almost anything: over the cached corpus `ROTEL` merged into
   * `info@alphotel.nl` on the strength of `OTEL`, and `MOND NEEMT` — from a
   * newspaper slogan — merged into the `WONDR` hoarding on `MOND`. Both
   * published a string belonging to neither sign.
   */
  fragmentMinChars?: number;
  fragmentMinShare?: number;
  /**
   * Two readings can only be the same sign if their glyph heights are within
   * this ratio. A physical gate: letter size is a property of the sign, not of
   * the light, so it separates signs that a string test alone would merge.
   */
  heightRatio?: number;
  /**
   * Glyph height in metres at which a reading carries full weight. At the ground
   * tier's 110 px/m a 0.10 m glyph is 11 px, which is marginal for accurate
   * recognition, while 0.25 m is 27 px and comfortable; below the reference a
   * reading is down-weighted rather than excluded.
   */
  confidentHeightM?: number;
  /** Readings under this confidence never vote. */
  minConfidence?: number;
  /** Strings shorter than this are noise, not signage. */
  minChars?: number;
  /**
   * How many readings must have *seen* a character before it is published, in a
   * cluster large enough to corroborate.
   *
   * This exists because the alignment leaves end gaps free, which is right for a
   * reading cut short by a shadow — it should not vote against letters it never
   * reached — but wrong for one that simply ended. Without the rule the longest
   * reading's spurious tail survives and reports as unanimous, since no shorter
   * reading contradicts it: six readings of a billboard gave `CLAIM NU OPI` at
   * agreement 1.00, where the sign says `CLAIM NU OP`.
   *
   * Stated as a count rather than a share of weight, which is what it was first
   * written as, at 50%. Over the 1,980 cached reader lines that share truncated
   * real text wherever a fragment happened to be read as often as the whole:
   * three readings of `Handwork Boutiqur` against three of `Handwork Bo`
   * published `Handwork Bo`, which is worse than taking one reading and doing
   * nothing. A count keeps the tail whenever a second reading corroborates it
   * and drops it only when the pivot alone claims it, which is the thing that
   * was actually wrong. It applies only to clusters larger than itself, since
   * in a pair no second witness could exist.
   */
  minCharReadings?: number;
}

const DEFAULTS: Required<ConsensusOptions> = {
  editFraction: 0.34,
  fragmentMinChars: 6,
  fragmentMinShare: 0.7,
  heightRatio: 1.8,
  confidentHeightM: 0.25,
  minConfidence: 0.3,
  minChars: 3,
  minCharReadings: 2,
};

/** Split the reader's line joins, and drop what is too short to be a sign. */
function explode(readings: readonly SignReading[], options: Required<ConsensusOptions>): SignReading[] {
  const out: SignReading[] = [];
  for (const reading of readings) {
    if (reading.confidence < options.minConfidence) continue;
    const lines = reading.text.split(' / ').map(line => line.trim()).filter(Boolean);
    // A joined observation covers all its lines, so each line's own height is
    // the observation height divided between them.
    const lineHeight = lines.length > 1 ? reading.box.height / lines.length : reading.box.height;
    for (const line of lines) {
      if (compactOf(line).length < options.minChars) continue;
      out.push({ ...reading, text: line, box: { ...reading.box, height: lineHeight } });
    }
  }
  return out;
}

/** Comparison form: case and punctuation folded away, spacing collapsed. */
function compactOf(text: string): string {
  return text.toUpperCase().replace(/[^0-9A-ZÀ-ɏ]+/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function longestCommonSubstring(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let best = 0;
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > best) best = current[j];
      }
    }
    previous = current;
  }
  return best;
}

/** Whether two readings are readings of the same words. */
function sameWords(a: string, b: string, options: Required<ConsensusOptions>): boolean {
  if (!a.length || !b.length) return false;
  const longer = Math.max(a.length, b.length);
  const shorter = Math.min(a.length, b.length);
  const allowed = Math.floor(options.editFraction * longer);
  if (levenshtein(a, b) <= allowed) return true;
  // A fragment of a longer reading: a shadow cut the sign in half, so the part
  // that was read is correct as far as it goes.
  const common = longestCommonSubstring(a, b);
  return common >= options.fragmentMinChars && common >= options.fragmentMinShare * shorter;
}

function compatibleHeight(a: SignBox, b: SignBox, ratio: number): boolean {
  const low = Math.min(a.height, b.height);
  const high = Math.max(a.height, b.height);
  if (low <= 0) return true;
  return high / low <= ratio;
}

/**
 * Semi-global alignment of a variant onto the pivot: gaps at either end of the
 * variant are free, so a fragment votes only where it actually covers the pivot
 * and stays silent elsewhere. Returns, per pivot index, the variant character
 * aligned to it, `''` for a deletion inside the covered span, or null outside
 * the span where the variant has nothing to say.
 */
function alignToPivot(pivot: string, variant: string): { aligned: (string | null)[]; inserts: string[] } {
  const n = pivot.length;
  const m = variant.length;
  if (!m) return { aligned: new Array<string | null>(n).fill(null), inserts: Array.from({ length: n + 1 }, () => '') };
  const GAP = 1;
  // score[i][j]: best cost aligning pivot[0..i) with variant[0..j).
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let j = 1; j <= m; j += 1) score[0][j] = score[0][j - 1] + GAP;
  // Leading pivot positions are free: the variant may start anywhere.
  for (let i = 1; i <= n; i += 1) score[i][0] = 0;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const sub = score[i - 1][j - 1] + (pivot[i - 1] === variant[j - 1] ? 0 : 1);
      score[i][j] = Math.min(sub, score[i - 1][j] + GAP, score[i][j - 1] + GAP);
    }
  }
  // Trailing pivot positions are free too: end wherever the variant ran out.
  let endI = n;
  for (let i = 0; i <= n; i += 1) if (score[i][m] < score[endI][m]) endI = i;

  const aligned = new Array<string | null>(n).fill(null);
  /** Characters the variant has that the pivot lacks, keyed by the pivot position they precede. */
  const inserts = Array.from({ length: n + 1 }, () => '');
  let i = endI;
  let j = m;
  while (i > 0 && j > 0) {
    const sub = score[i - 1][j - 1] + (pivot[i - 1] === variant[j - 1] ? 0 : 1);
    if (score[i][j] === sub) {
      aligned[i - 1] = variant[j - 1];
      i -= 1; j -= 1;
    } else if (score[i][j] === score[i - 1][j] + GAP) {
      aligned[i - 1] = '';           // the variant is missing this pivot character
      i -= 1;
    } else {
      inserts[i] = variant[j - 1] + inserts[i];
      j -= 1;                        // the variant has a character the pivot lacks
    }
  }
  return { aligned, inserts };
}

/**
 * Which of two tallies at one position wins.
 *
 * Ties are the whole reason this is a function. Every remaining error over the
 * cached corpus came from resolving them toward absence: four readings of
 * `Voel je thuis bij` against four of `oel je thuis bij` published the latter,
 * and `Exclusieve` — a Dutch word on a real shopfront — became `Exclusive`.
 *
 * So a character beats a deletion at equal weight. The two are not symmetric
 * evidence: a reading that resolved a letter saw something, while one that did
 * not may simply have been cut off there, which is the failure mode this whole
 * module exists for. Between two characters of equal weight the pivot's own
 * wins, because the pivot is the longest confident reading in the cluster.
 */
function beats(key: string, weight: number, bestKey: string, bestWeight: number, pivotChar: string): boolean {
  const EPSILON = 1e-9;
  if (weight > bestWeight + EPSILON) return true;
  if (weight < bestWeight - EPSILON) return false;
  if ((key !== '') !== (bestKey !== '')) return key !== '';
  if (key === '') return false;
  return key === pivotChar && bestKey !== pivotChar;
}

function weightOf(reading: SignReading, options: Required<ConsensusOptions>): number {
  const height = Math.min(1, Math.max(0.2, reading.box.height / options.confidentHeightM));
  return reading.confidence * height;
}

function medianBox(boxes: readonly SignBox[]): SignBox {
  const pick = (get: (b: SignBox) => number) => {
    const values = boxes.map(get).sort((a, b) => a - b);
    const mid = values.length >> 1;
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  };
  return { along: pick(b => b.along), up: pick(b => b.up), width: pick(b => b.width), height: pick(b => b.height) };
}

/** Group readings that sit on one physical sign, so placements stay distinct. */
function placementsOf(readings: readonly SignReading[]): SignBox[] {
  const groups: SignReading[][] = [];
  for (const reading of readings) {
    const group = groups.find(g => g.some(other => overlaps(other.box, reading.box)));
    if (group) group.push(reading);
    else groups.push([reading]);
  }
  return groups.map(group => medianBox(group.map(r => r.box)));
}

function overlaps(a: SignBox, b: SignBox): boolean {
  // Generous vertically, because a fascia and its valance sit a little apart and
  // are one sign; strict horizontally, because that is what separates two
  // signs on one frontage.
  const alongGap = Math.max(a.along - (b.along + b.width), b.along - (a.along + a.width));
  const upGap = Math.max(a.up - (b.up + b.height), b.up - (a.up + a.height));
  return alongGap < 0.3 && upGap < 0.6;
}

/**
 * Vote a cluster's readings into one string.
 *
 * The pivot is the longest reading, on the argument that it is the one least
 * eaten by occlusion. Every other reading is aligned onto it and votes per
 * position; a position the majority of covering readings leave empty is
 * dropped, which is how a spurious tail comes off, and characters a majority
 * has that the pivot lacks are voted back in.
 */
function vote(cluster: readonly SignReading[], options: Required<ConsensusOptions>): { text: string; charAgreement: number[] } {
  // The longest reading wins, and weight only breaks ties between equal
  // lengths. Length leads because recovering a character the pivot lacks is the
  // lossy direction — it has to survive an alignment and a majority — while a
  // character the pivot wrongly carries is cheaply dropped by the rule below.
  // Scoring weight x length instead picked `oel je thuis bij` over four equally
  // numerous readings of `Voel je thuis bij`, and lost the V for good.
  let pivot = cluster[0];
  let bestLength = -1;
  let bestWeight = -1;
  for (const reading of cluster) {
    const length = compactOf(reading.text).length;
    const weight = weightOf(reading, options);
    if (length > bestLength || (length === bestLength && weight > bestWeight)) {
      bestLength = length; bestWeight = weight; pivot = reading;
    }
  }
  const pivotText = pivot.text.trim();
  const pivotCompact = compactOf(pivotText);
  if (cluster.length === 1) return { text: pivotText, charAgreement: new Array<number>(pivotCompact.length).fill(1) };

  // Vote over the compact form, then put the pivot's own spacing and
  // punctuation back, since a majority over punctuation is meaningless.
  const tallies: Map<string, { weight: number; char: string; charWeight: number }>[] =
    Array.from({ length: pivotCompact.length }, () => new Map());
  const covering = new Array<number>(pivotCompact.length).fill(0);
  /** How many readings reached each position, as against how much weight did. */
  const sawIt = new Array<number>(pivotCompact.length).fill(0);

  /** Votes for characters the pivot lacks, one tally per gap between positions. */
  const gapTallies: Map<string, { weight: number; cased: string }>[] =
    Array.from({ length: pivotCompact.length + 1 }, () => new Map());
  const gapCovering = new Array<number>(pivotCompact.length + 1).fill(0);

  for (const reading of cluster) {
    const weight = weightOf(reading, options);
    const { aligned, inserts } = alignToPivot(pivotCompact, compactOf(reading.text));
    // Track case from the reading's own text, so the output is not shouted.
    const original = reading.text.replace(/[^0-9A-Za-zÀ-ɏ]+/g, '');
    let seen = 0;
    for (let i = 0; i < pivotCompact.length; i += 1) {
      const char = aligned[i];
      if (char === null) continue;
      covering[i] += weight;
      sawIt[i] += 1;
      const key = char;                       // '' means "this reading omits it"
      const entry = tallies[i].get(key) ?? { weight: 0, char: original[seen] ?? char, charWeight: 0 };
      entry.weight += weight;
      if (char !== '' && weight > entry.charWeight) { entry.char = original[seen] ?? char; entry.charWeight = weight; }
      tallies[i].set(key, entry);
      if (char !== '') seen += 1;
    }

    // A reading only has an opinion about a gap it actually spanned, so gaps
    // outside its aligned span are left alone rather than counted as "nothing
    // here". Within the span, an empty insert is a real vote against one.
    let cased = 0;
    for (let g = 0; g <= pivotCompact.length; g += 1) {
      const inside = (g > 0 && aligned[g - 1] !== null) || (g < pivotCompact.length && aligned[g] !== null);
      if (inside) {
        gapCovering[g] += weight;
        const entry = gapTallies[g].get(inserts[g]) ?? { weight: 0, cased: inserts[g] };
        entry.weight += weight;
        if (inserts[g]) entry.cased = original.slice(cased, cased + inserts[g].length) || inserts[g];
        gapTallies[g].set(inserts[g], entry);
      }
      cased += inserts[g].length;
      if (g < pivotCompact.length && aligned[g]) cased += 1;
    }
  }

  const total = cluster.reduce((sum, reading) => sum + weightOf(reading, options), 0);
  const chars: string[] = [];
  const charAgreement: number[] = [];
  /** Pivot positions that survived, so the pivot's spacing can be put back. */
  const kept: number[] = [];
  /** The winning insertion before each pivot position, '' for none. */
  const insertAt = (g: number): string => {
    let bestKey = '';
    let bestWeight = -1;
    for (const [key, entry] of gapTallies[g]) {
      // Ties go to the insertion, for the same reason a character beats a
      // deletion: a reading that resolved a letter saw something, while one
      // that did not may have been cut off there.
      if (beats(key, entry.weight, bestKey, bestWeight, key)) { bestWeight = entry.weight; bestKey = key; }
    }
    if (!bestKey) return '';
    // Only where a majority of the weight that spanned the gap saw it. At
    // exactly half, three readings of `Reparah.` wrote an h into three readings
    // of `Fiets Reparatie`; the pivot rule above is the right place to keep a
    // longer reading whole, not this one.
    return bestWeight > gapCovering[g] / 2 + 1e-9 ? (gapTallies[g].get(bestKey)?.cased ?? bestKey) : '';
  };

  for (let i = 0; i <= pivotCompact.length; i += 1) {
    const inserted = insertAt(i);
    for (const char of inserted) { chars.push(char); kept.push(-1); charAgreement.push(gapCovering[i] > 0 ? 1 : 0); }
    if (i === pivotCompact.length) break;
    let winner: { weight: number; char: string } | null = null;
    let winnerKey = '';
    for (const [key, entry] of tallies[i]) {
      if (!winner || beats(key, entry.weight, winnerKey, winner.weight, pivotCompact[i])) {
        winner = entry; winnerKey = key;
      }
    }
    if (!winner || covering[i] <= 0) continue;
    if (winnerKey === '') continue;                  // the majority sees no character here
    // A character only the pivot reached is the pivot's own artefact — but only
    // where a second witness could have existed. In a pair there is no one to
    // corroborate the longer reading's tail, and demanding one would publish
    // just the intersection, turning `BESTSELLER` and `SELLER` into `SELLER`.
    if (cluster.length > options.minCharReadings && sawIt[i] < options.minCharReadings) continue;
    chars.push(winner.char);
    kept.push(i);
    // Measured against the whole cluster, not only the readings that reached
    // this far, so a character one reading invented cannot report unanimity.
    charAgreement.push(total > 0 ? winner.weight / total : 0);
  }

  return { text: restoreSpacing(pivotText, chars, kept), charAgreement };
}

/**
 * Put the pivot's spaces and punctuation back around the voted characters.
 *
 * The vote runs over letters and digits only, since a majority over punctuation
 * is meaningless, so the layout has to come from somewhere: it comes from the
 * pivot. Each voted character carries the pivot position it came from, or -1
 * when the cluster voted in a character the pivot lacks, and the separators
 * standing before a pivot position travel with it. A dropped character takes
 * its separators with it, so `CLAIM NU OPI` losing its invented tail reads
 * `CLAIM NU OP` rather than `CLAIMNUOP`.
 */
function restoreSpacing(pivotText: string, chars: readonly string[], kept: readonly number[]): string {
  // Separators standing immediately before each pivot letter, and after the last.
  const before: string[] = [];
  let pending = '';
  for (const char of pivotText) {
    if (/[0-9A-Za-z\u00C0-\u024F]/.test(char)) { before.push(pending); pending = ''; }
    else pending += char;
  }
  const trailing = pending;

  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const position = kept[i];
    if (position >= 0) out += before[position] ?? '';
    out += chars[i];
  }
  out += trailing;
  return out.replace(/\s+/g, ' ').replace(/^[\s.,&/-]+|[\s,&/-]+$/g, '').trim();
}

/**
 * Vote a set of readings into the signs they are readings of.
 *
 * Readings may come from one crop or from every campaign year that saw the
 * frontage; the algorithm does not distinguish them, and the result reports
 * view and year counts so the caller can weigh cross-year agreement higher.
 */
export function consensusSigns(
  readings: readonly SignReading[],
  options: ConsensusOptions = {},
): ConsensusSign[] {
  const settings = { ...DEFAULTS, ...options };
  const candidates = explode(readings, settings);
  if (!candidates.length) return [];

  // Strongest readings first, so a cluster forms around good evidence rather
  // than around whichever fragment happened to come first.
  const ordered = [...candidates].sort((a, b) =>
    weightOf(b, settings) * compactOf(b.text).length - weightOf(a, settings) * compactOf(a.text).length);

  const clusters: SignReading[][] = [];
  for (const reading of ordered) {
    const compact = compactOf(reading.text);
    const cluster = clusters.find(group => group.some(other =>
      compatibleHeight(other.box, reading.box, settings.heightRatio)
      && sameWords(compactOf(other.text), compact, settings)));
    if (cluster) cluster.push(reading);
    else clusters.push([reading]);
  }

  const signs = clusters.map((cluster): ConsensusSign => {
    const { text, charAgreement } = vote(cluster, settings);
    const views = new Set(cluster.map(r => r.viewId ?? ''));
    const years = [...new Set(cluster.map(r => r.year).filter((y): y is number => typeof y === 'number'))]
      .sort((a, b) => a - b);
    const agreement = charAgreement.length
      ? charAgreement.reduce((sum, value) => sum + value, 0) / charAgreement.length
      : 0;
    return {
      text,
      support: cluster.length,
      views: views.size,
      years,
      agreement,
      charAgreement,
      placements: placementsOf(cluster),
      variants: cluster.map(r => r.text),
      uncorroborated: cluster.length === 1,
    };
  });

  return signs
    .filter(sign => compactOf(sign.text).length >= settings.minChars)
    .sort((a, b) => b.support - a.support || b.agreement - a.agreement);
}
