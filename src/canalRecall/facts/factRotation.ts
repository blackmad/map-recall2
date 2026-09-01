// Which fact the player sees this time.
//
// Before this module a landmark had exactly one thing to say, so the second
// time you drove past the Magere Brug the game repeated itself, and the
// twentieth time it was wallpaper. With several facts per feature the
// interesting question becomes *ordering*, and ordering is a learning decision
// rather than a rendering one: it belongs here, tested, next to the rest of
// the recall model.
//
// Three rules, in order of how much they matter:
//
//   1. Something you have not been told beats something you have. A repeat
//      teaches nothing and reads as a bug.
//   2. Vary the kind. Three construction dates in a row down one canal is
//      technically four facts and feels like one; a naming story, then a
//      person, then an oddity, is the same information and stays awake.
//   3. When everything has been seen, come back to the oldest. That is the
//      same spacing principle the street recall uses, applied to prose.

import type { Fact, FactKind } from './factTypes';

/** What the player has already been told, persisted between sessions. */
export interface FactHistory {
  /** `factKey` -> the drive number on which it was last shown. */
  [factKey: string]: number;
}

export interface RotationState {
  history: FactHistory;
  /** Monotonic counter, incremented once per fact shown. Cheaper and more
   *  stable than wall-clock time, which sorts oddly across time zones and
   *  makes fixtures untestable. */
  shown: number;
  /** Kinds of the last few facts shown, newest first, for the variety rule. */
  recentKinds: FactKind[];
}

export function emptyRotationState(): RotationState {
  return { history: {}, shown: 0, recentKinds: [] };
}

/** How many recent kinds the variety rule looks back over. Two is enough to
 *  break a run without starving a feature that only has `history` facts. */
const RECENT_KIND_MEMORY = 3;

/**
 * A stable identity for a fact that survives regeneration.
 *
 * Keying on array index would silently re-show everything whenever the
 * generator reorders a feature's facts, and keying on the whole sentence would
 * bloat saved state. A short hash of the normalised text does neither: an
 * edited fact is correctly treated as new, and an unchanged one keeps its
 * place in history.
 */
export function factKey(featureId: string, fact: Pick<Fact, 'text'>): string {
  const normalised = fact.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalised.length; index++) {
    hash ^= normalised.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${featureId}:${(hash >>> 0).toString(36)}`;
}

/**
 * Kinds a player tends to remember, highest first. This only breaks ties among
 * equally-unseen facts — it is a nudge towards the memorable, not a filter, so
 * a feature whose only fact is a dimension still gets to say it.
 */
const KIND_APPEAL: Readonly<Record<FactKind, number>> = {
  surprise: 5,
  naming: 4,
  culture: 3,
  people: 3,
  history: 2,
  design: 1,
};

export interface FactChoice {
  fact: Fact;
  key: string;
  /** True when every fact for this feature had already been shown and the
   *  oldest is being repeated, so the card can say "again". */
  repeat: boolean;
}

/**
 * Pick the fact to show for `featureId`, or `null` when there are none.
 *
 * Pure: the caller commits the choice with `recordShown`. Keeping the two
 * apart means a card that is chosen and then suppressed — by a quiz prompt, or
 * because the player drove out of range before it opened — does not burn the
 * fact.
 */
export function chooseFact(
  featureId: string,
  facts: readonly Fact[],
  state: RotationState,
): FactChoice | null {
  if (!facts.length) return null;
  const scored = facts.map((fact) => {
    const key = factKey(featureId, fact);
    const lastShown = state.history[key];
    const seen = lastShown !== undefined;
    // A kind shown two facts ago is penalised less than the one shown last.
    const recency = state.recentKinds.indexOf(fact.kind);
    const kindPenalty = recency < 0 ? 0 : (RECENT_KIND_MEMORY - recency) * 2;
    return {
      fact,
      key,
      seen,
      lastShown: lastShown ?? -1,
      score: (seen ? 0 : 100) + KIND_APPEAL[fact.kind] - kindPenalty,
    };
  });
  scored.sort((a, b) =>
    // Unseen first; then among seen, the one shown longest ago; then appeal.
    Number(b.score > 0 && !b.seen) - Number(a.score > 0 && !a.seen)
    || (a.seen && b.seen ? a.lastShown - b.lastShown : 0)
    || b.score - a.score);
  const best = scored[0];
  return { fact: best.fact, key: best.key, repeat: best.seen };
}

/** Commit a shown fact to the rotation state, returning a new state. */
export function recordShown(state: RotationState, choice: FactChoice): RotationState {
  const shown = state.shown + 1;
  return {
    history: { ...state.history, [choice.key]: shown },
    shown,
    recentKinds: [choice.fact.kind, ...state.recentKinds].slice(0, RECENT_KIND_MEMORY),
  };
}

/**
 * The facts to put on the expanded card, best first, without repeating the one
 * already on the collapsed card. Ordered by appeal rather than by rotation,
 * because the expanded card is a deliberate read rather than a glance.
 */
export function expandedFacts(
  facts: readonly Fact[],
  shownText: string,
  limit = 3,
): Fact[] {
  return facts
    .filter((fact) => fact.text !== shownText)
    .slice()
    .sort((a, b) => KIND_APPEAL[b.kind] - KIND_APPEAL[a.kind])
    .slice(0, limit);
}

/** Trim saved state so it cannot grow without bound across hundreds of drives.
 *  Keeps the most recently shown entries, which are the ones the spacing rule
 *  actually reads. */
export function pruneHistory(state: RotationState, maxEntries = 4000): RotationState {
  const entries = Object.entries(state.history);
  if (entries.length <= maxEntries) return state;
  const kept = entries.sort((a, b) => b[1] - a[1]).slice(0, maxEntries);
  return { ...state, history: Object.fromEntries(kept) };
}
