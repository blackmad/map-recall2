// The runtime half of the fact pipeline: what a card says this time, and
// remembering what it said last time.
//
// `factRotation.ts` decides the order and knows nothing about the game;
// `landmarkRuntime.ts` paints and fetches. This is the seam between them — it
// turns the published `facts.json` into an index, applies a choice to a
// landmark card, and persists what the player has been told so that the
// rotation survives closing the tab. Reads and writes both tolerate storage
// being unavailable, because a browser in private mode throws on
// `localStorage` and a missing rotation is not a reason to lose the card.

import {
  chooseFact,
  emptyRotationState,
  expandedFacts,
  pruneHistory,
  recordShown,
  type FactChoice,
  type RotationState,
} from './factRotation';
import { similarity } from './factQuality';
import { FACT_KIND_LABELS, type Fact, type FactsFile } from './factTypes';

/** Facts and optional article opening, keyed by feature id. */
export interface FeatureFactEntry {
  facts: Fact[];
  /** Same-article framing sentence; see `FeatureFacts.opening`. */
  opening?: string;
}

/** Facts by feature id, as the runtime holds them. */
export type FactIndex = Map<string, FeatureFactEntry>;

export function buildFactIndex(file: FactsFile | null | undefined): FactIndex {
  const index: FactIndex = new Map();
  for (const feature of file?.features || []) {
    if (feature?.id && feature.facts?.length) {
      index.set(feature.id, {
        facts: feature.facts,
        opening: feature.opening?.trim() || undefined,
      });
    }
  }
  return index;
}

/** First sentence of an encyclopedia lede, capped for the collapsed card.
 *
 *  Respects the same abbreviation list the English extract trimmer uses, so
 *  "bridge no. 221" and "St. Antonius" are not cut at the inner period. */
export function openingSentence(text: string | undefined, maxChars = 160): string {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  // Words whose trailing period is not a sentence end — kept in sync with
  // `scripts/lib/translation.ts` ABBREVIATIONS (nl + en encyclopedia prose).
  const abbreviations = new Set([
    'st', 'sint', 'ste', 'mr', 'mrs', 'ms', 'dr', 'prof', 'ir', 'ing', 'drs',
    'jr', 'sr', 'nr', 'no', 'vs', 'ca', 'ong', 'bijv', 'nl', 'oa', 'dwz', 'zgn',
    'etc', 'incl', 'excl', 'eeuw', 'eeuwse',
  ]);
  const isSentenceEnd = (index: number): boolean => {
    if (trimmed[index] !== '.') return true;
    const before = /([\p{L}]+)$/u.exec(trimmed.slice(0, index));
    if (!before) return true;
    const word = before[1];
    if (word.length === 1) return false; // initials: "J. Smit"
    return !abbreviations.has(word.toLocaleLowerCase());
  };

  let end = -1;
  for (const match of trimmed.matchAll(/[.!?](?=\s|$)/g)) {
    if (isSentenceEnd(match.index)) {
      end = match.index + 1;
      break;
    }
  }
  const sentence = (end > 0 ? trimmed.slice(0, end) : trimmed).trim();
  if (sentence.length <= maxChars) return sentence;
  const window = sentence.slice(0, maxChars);
  let boundary = -1;
  for (const match of window.matchAll(/[.!?](?=\s|$)/g)) {
    if (isSentenceEnd(match.index)) boundary = match.index + 1;
  }
  if (boundary > maxChars * 0.5) return window.slice(0, boundary).trim();
  const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf(' '));
  return `${(cut > maxChars * 0.5 ? window.slice(0, cut) : window).trim()}…`;
}

/**
 * Pair an article opening with a rotated trivia sentence when the trivia alone
 * would lack who/what context. Skips the opening when it is empty, already
 * restated by the fact, or near-duplicate of it.
 */
export function composeFactWithOpening(
  factText: string,
  opening: string | undefined,
): { detail: string; opening?: string } {
  const lead = openingSentence(opening);
  if (!lead) return { detail: factText };
  if (similarity(lead, factText) >= 0.55) return { detail: factText };
  const leadStem = lead.replace(/[.!?…]+$/, '').toLowerCase();
  if (leadStem.length >= 24 && factText.toLowerCase().includes(leadStem.slice(0, Math.min(48, leadStem.length)))) {
    return { detail: factText };
  }
  return { detail: `${lead} ${factText}`, opening: lead };
}

/** Anything with the two `localStorage` methods used here. */
export interface FactStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ROTATION_STORAGE_KEY = 'canalRecall.factRotation.v1';

export function loadRotationState(storage: FactStorage | null | undefined): RotationState {
  try {
    const raw = storage?.getItem(ROTATION_STORAGE_KEY);
    if (!raw) return emptyRotationState();
    const parsed = JSON.parse(raw) as Partial<RotationState>;
    // Every field is validated rather than trusted: this is player-editable
    // storage, and a malformed `history` would break every card rather than
    // one rotation.
    return {
      history: parsed.history && typeof parsed.history === 'object' ? parsed.history : {},
      shown: Number.isFinite(parsed.shown) ? Number(parsed.shown) : 0,
      recentKinds: Array.isArray(parsed.recentKinds) ? parsed.recentKinds.slice(0, 3) : [],
    };
  } catch {
    return emptyRotationState();
  }
}

export function saveRotationState(storage: FactStorage | null | undefined, state: RotationState): void {
  try {
    storage?.setItem(ROTATION_STORAGE_KEY, JSON.stringify(pruneHistory(state)));
  } catch {
    /* private mode, or a full quota. The rotation is a nicety, not the game. */
  }
}

/** The parts of a landmark card a fact replaces. */
export interface FactCardText {
  detail: string;
  longDetail: string;
  /** Chosen fact first, then the rest. For the expanded panel, which can show
   *  them as separate paragraphs where the canvas card cannot. */
  factTexts: string[];
  /** `Name`, `History`, `Curiosity` — the badge that tells the player this is
   *  a different kind of thing from the one they were told last time. */
  factKind: string;
}

/**
 * What a card should say for a feature, or `null` when there are no facts for
 * it and the Wikipedia lede should stand.
 *
 * The collapsed card gets the article opening (who / what) plus the chosen
 * trivia sentence from the same Wikipedia article, so a namesake or history
 * punchline is not orphaned. Pass `fallbackOpening` when the catalog entry
 * has no `opening` yet — typically the feature's published encyclopedia lede
 * already on the notice before rotation overwrites it. The expanded card then
 * lists opening + chosen fact + further facts as separate paragraphs.
 */
export function factCardText(
  featureId: string,
  index: FactIndex,
  state: RotationState,
  fallbackOpening?: string,
): { text: FactCardText; choice: FactChoice } | null {
  const entry = index.get(featureId);
  if (!entry?.facts?.length) return null;
  const choice = chooseFact(featureId, entry.facts, state);
  if (!choice) return null;
  const composed = composeFactWithOpening(
    choice.fact.text,
    entry.opening || fallbackOpening,
  );
  const others = expandedFacts(entry.facts, choice.fact.text);
  const all = composed.opening
    ? [composed.opening, choice.fact.text, ...others.map((fact) => fact.text)]
    : [choice.fact.text, ...others.map((fact) => fact.text)];
  return {
    choice,
    text: {
      detail: composed.detail,
      longDetail: all.join(' '),
      factTexts: all,
      factKind: FACT_KIND_LABELS[choice.fact.kind],
    },
  };
}

/** Commit a shown fact and persist the result in one step. */
export function commitShownFact(
  storage: FactStorage | null | undefined,
  state: RotationState,
  choice: FactChoice,
): RotationState {
  const next = recordShown(state, choice);
  saveRotationState(storage, next);
  return next;
}
