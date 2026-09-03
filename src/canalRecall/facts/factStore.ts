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
import { FACT_KIND_LABELS, type Fact, type FactsFile } from './factTypes';

/** Facts by feature id, as the runtime holds them. */
export type FactIndex = Map<string, Fact[]>;

export function buildFactIndex(file: FactsFile | null | undefined): FactIndex {
  const index: FactIndex = new Map();
  for (const feature of file?.features || []) {
    if (feature?.id && feature.facts?.length) index.set(feature.id, feature.facts);
  }
  return index;
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
 * The collapsed card gets the chosen fact and nothing else — one sentence is
 * the whole point of the rotation, and appending the lede to it would put the
 * sentence the player has already read underneath the one they have not. The
 * expanded card gets the rest, which is what makes `+ MORE` worth opening.
 */
export function factCardText(
  featureId: string,
  index: FactIndex,
  state: RotationState,
): { text: FactCardText; choice: FactChoice } | null {
  const facts = index.get(featureId);
  if (!facts?.length) return null;
  const choice = chooseFact(featureId, facts, state);
  if (!choice) return null;
  const others = expandedFacts(facts, choice.fact.text);
  const all = [choice.fact.text, ...others.map((fact) => fact.text)];
  return {
    choice,
    text: {
      detail: choice.fact.text,
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
