/**
 * Read a heritage register's prose as an observation of a façade.
 *
 * `AMSTERDAM_FACADE_TWIN.md` calls the monument register "the highest-value and
 * most overlooked source for this project", and measured against the pilot
 * boundary it is: 695 of 3,025 buildings have a description that names a
 * specific gable type, which is 23% of the pilot and the *only* façade evidence
 * available before street-level imagery exists. A conservator's sentence about
 * a façade is a real observation of that façade, independent of any photograph.
 *
 * It is also prose, so this module is deliberately narrow. It answers one
 * question — what gable does the *front* of this building have — and refuses
 * rather than guesses. Three things make that refusal meaningful:
 *
 * 1. **A clause about another elevation is not about the front.** The register
 *    routinely writes "Huis met halsgevel …; achtergevel aan de Tuinstraat:
 *    eenvoudige klokgevel". Two gables, one building, no contradiction. Reading
 *    that as ambiguous throws away a good front-elevation measurement; reading
 *    it by first match happens to work here and fails the moment the order
 *    reverses. So rear and side clauses are removed before anything is read.
 * 2. **An alteration names the current gable, not the original.** "Pand met tot
 *    puntgevel gewijzigde trapgevel" is a puntgevel today. The building has
 *    both words in it and only one of them is what a rider would see.
 * 3. **What is left over, if it still names two gables, is genuinely
 *    ambiguous** and gets no value at all. One building in the pilot lands
 *    here: a 1935 office block whose long description mentions gable forms
 *    discursively.
 *
 * Everything this produces is `monument-text`-sourced at moderate confidence,
 * which means `fieldVerdict` will not auto-accept it until it has been scored
 * against hand-verified buildings. That is the intended path: this is a
 * measurement to be calibrated, not an answer to be trusted.
 */

import type { GableType } from './houseRecord.ts';

/**
 * Gable terms as the register actually writes them, measured over 1,568
 * descriptions inside the pilot boundary.
 *
 * `verhoogde-hals` is absent on purpose: the phrase never occurs, in any
 * spelling, in any description in the boundary. A vocabulary entry with no
 * textual support would only ever produce false positives.
 */
const GABLE_TERMS: ReadonlyArray<readonly [RegExp, GableType]> = [
  [/trapgevel/i, 'trap'],
  [/halsgevel/i, 'hals'],
  [/klokgevel/i, 'klok'],
  [/tuitgevel/i, 'tuit'],
  [/puntgevel/i, 'punt'],
  [/lijstgevel/i, 'lijst'],
];

/**
 * The register's standard formula for a lijstgevel.
 *
 * "Pand met gevel onder rechte lijst" — a façade closed by a straight cornice
 * rather than a shaped gable — is exactly what a lijstgevel is, and it is how
 * the register says so: 502 descriptions use this construction against 12 that
 * write "lijstgevel". Ignoring it would discard the single largest block of
 * gable evidence in the boundary.
 *
 * It is matched only in that construction, tied to a `gevel`, or in the
 * "the top was replaced by a straight cornice" form. A bare "rechte lijst"
 * elsewhere in a sentence may be describing a doorcase or a shopfront.
 *
 * The cornice terms are an explicit allowlist rather than a `\w+lijst`
 * wildcard, and the reason is measured. Inside the boundary, "gevel onder …"
 * also introduces `deuromlijst` (6), `vensteromlijst` (4), `omlijst` (1) and
 * `puilijst` (1) — a door surround, a window surround and a shopfront cornice,
 * none of them a statement about how the façade terminates. A wildcard would
 * turn all twelve into confident lijstgevels. The terms kept here —
 * `triglyfenlijst` (28 with its variant spelling), `klossenlijst` (3) and
 * `toplijst` (1) — are cornices *of the façade*, structurally identical to
 * "rechte lijst".
 */
const CORNICE_TERM = String.raw`(?:\brechte\s+lijst\b|\btriglyfenlijst\b|\btrigliefenlijst\b|\bklossenlijst\b|\btoplijst\b)`;

const STRAIGHT_CORNICE_GABLE = new RegExp(
  `gevel[^.;]{0,60}?(?:onder|met)\\s+(?:een\\s+)?${CORNICE_TERM}` +
  `|top[^.;]{0,80}?${CORNICE_TERM}[^.;]{0,40}?vervangen`,
  'i',
);

/**
 * Markers introducing a clause about an elevation that is not the front.
 *
 * A canal house's rear often carries a different and older gable than its
 * front, so this is the difference between a measurement and a wrong one.
 */
const OTHER_ELEVATION = /\b(achtergevel|achterzijde|achterhuis|zijgevel|zijgevels|zijmuur|linkergevel|rechtergevel)\b/i;

/**
 * "…tot een klokgevel … is gewijzigd": the gable it was changed *into*.
 *
 * Bounded to a single clause so it cannot reach across a sentence and capture
 * an unrelated gable further along the description.
 */
const ALTERED_INTO = /\btot\s+(?:een\s+)?(trap|hals|klok|tuit|punt|lijst)gevel\b[^.;]{0,90}?\bgewijzigd/i;

/** How a gable type was arrived at, which is what sets its confidence. */
export type GableEvidenceKind =
  /** A single gable term, stated plainly. */
  | 'stated'
  /** The register's "gevel onder rechte lijst" formula for a lijstgevel. */
  | 'straight-cornice'
  /** Resolved by discarding a clause about the rear or a side elevation. */
  | 'front-clause'
  /** Resolved from an explicit alteration: the gable it was changed into. */
  | 'altered-into';

/** Why no gable was extracted. Reported, so the queue knows what to look at. */
export type GableRefusal =
  /** No gable vocabulary at all. */
  | 'not-stated'
  /** Two or more gable types attributed to the front, with no way to choose. */
  | 'ambiguous';

export interface GableReading {
  gable: GableType | null;
  kind: GableEvidenceKind | null;
  refusal: GableRefusal | null;
  /** Calibrated later; these are priors ordered by how direct the reading was. */
  confidence: number;
  /** Every gable type the description mentions anywhere, for review. */
  mentioned: GableType[];
  /** The clause the reading came from, so a reviewer can check it in one glance. */
  evidenceText: string | null;
}

const NOT_STATED: GableReading = {
  gable: null, kind: null, refusal: 'not-stated', confidence: 0, mentioned: [], evidenceText: null,
};

/**
 * Confidence priors by how direct the reading was.
 *
 * Ordered rather than tuned. A plainly stated gable outranks one recovered by
 * dropping a rear clause, which outranks one inferred from an alteration
 * phrase — and all of them stay well below the 0.95 that auto-accept would
 * need, because none has been scored against a hand-verified building yet.
 */
export const GABLE_CONFIDENCE: Readonly<Record<GableEvidenceKind, number>> = {
  stated: 0.85,
  'front-clause': 0.8,
  'straight-cornice': 0.75,
  'altered-into': 0.7,
};

/** Remove clauses that describe the rear or a side, keeping the front-facing text. */
export function frontElevationText(description: string): string {
  return description
    .split(/(?<=[.;])\s+/)
    .flatMap(sentence => {
      // A marker mid-sentence splits it: everything from the marker onward is
      // about the other elevation.
      const match = OTHER_ELEVATION.exec(sentence);
      if (!match) return [sentence];
      const head = sentence.slice(0, match.index).trim();
      return head ? [head] : [];
    })
    .join(' ')
    .trim();
}

const mentionedIn = (text: string): GableType[] => {
  const found = new Set<GableType>();
  for (const [pattern, gable] of GABLE_TERMS) if (pattern.test(text)) found.add(gable);
  return [...found];
};

const clauseAround = (text: string, pattern: RegExp): string | null => {
  const match = pattern.exec(text);
  if (!match) return null;
  const before = text.lastIndexOf('.', match.index) + 1;
  const semicolon = text.lastIndexOf(';', match.index) + 1;
  const start = Math.max(before, semicolon);
  const endPeriod = text.indexOf('.', match.index + match[0].length);
  const endSemicolon = text.indexOf(';', match.index + match[0].length);
  const ends = [endPeriod, endSemicolon].filter(index => index >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).trim();
};

/**
 * Read the front elevation's gable out of a heritage description.
 *
 * Returns a refusal rather than a guess whenever the text does not settle it.
 */
export function readGable(description: string | null | undefined): GableReading {
  if (!description || !description.trim()) return NOT_STATED;

  const mentioned = mentionedIn(description);
  const front = frontElevationText(description);

  // An explicit alteration is the strongest signal about the *current* gable,
  // and it is checked first because the sentence necessarily also contains the
  // superseded one.
  const altered = ALTERED_INTO.exec(front);
  if (altered) {
    const gable = altered[1].toLowerCase() as GableType;
    return {
      gable, kind: 'altered-into', refusal: null,
      confidence: GABLE_CONFIDENCE['altered-into'], mentioned,
      evidenceText: clauseAround(front, ALTERED_INTO),
    };
  }

  const frontGables = mentionedIn(front);
  if (frontGables.length === 1) {
    const [gable] = frontGables;
    const kind: GableEvidenceKind = frontGables.length === mentioned.length ? 'stated' : 'front-clause';
    const pattern = GABLE_TERMS.find(([, type]) => type === gable)?.[0];
    return {
      gable, kind, refusal: null, confidence: GABLE_CONFIDENCE[kind], mentioned,
      evidenceText: pattern ? clauseAround(front, pattern) : null,
    };
  }

  if (frontGables.length > 1) {
    return { gable: null, kind: null, refusal: 'ambiguous', confidence: 0, mentioned, evidenceText: null };
  }

  // No shaped gable on the front. The register's straight-cornice formula is
  // then a positive statement that there is no shaped gable — which is what a
  // lijstgevel is.
  if (STRAIGHT_CORNICE_GABLE.test(front)) {
    return {
      gable: 'lijst', kind: 'straight-cornice', refusal: null,
      confidence: GABLE_CONFIDENCE['straight-cornice'], mentioned,
      evidenceText: clauseAround(front, STRAIGHT_CORNICE_GABLE),
    };
  }

  // Nothing on the front. Any gable term left in `mentioned` was on the rear or
  // a side, so the front's gable is *unstated*, not disputed — "Pand met
  // voorgevel onder triglyfenlijst, achtergevel … trapgevel" states no front
  // gable and contradicts nothing. Calling that ambiguous would file a clean
  // gap as a conflict and send a reviewer looking for a disagreement that is
  // not there. The rear gable stays in `mentioned` either way.
  return { ...NOT_STATED, mentioned, refusal: 'not-stated' };
}

/**
 * Whether the description states a hoisting beam.
 *
 * Presence only, and never absence. Almost every canal house has a *hijsbalk*;
 * only 24 descriptions in the boundary mention one, because the register
 * records what is notable rather than what is ordinary. So a description
 * without the word is not evidence that the building lacks one, and this
 * returns `true` or `null` — never `false`.
 */
export function readHoistBeam(description: string | null | undefined): true | null {
  if (!description) return null;
  return /\b(hijsbalk|hijsbalken|hijsluik)\b/i.test(description) ? true : null;
}
