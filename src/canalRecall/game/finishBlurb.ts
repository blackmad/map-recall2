/**
 * What the ARRIVED card says about the destination.
 *
 * It used to read the landmark's own `longDetail` (the encyclopedia lede) and never the reviewed trivia in
 * `facts.json`, which only drive-by and clicked cards rotate through. Huis Bartolotti's arrival showed "… is a canal
 * house at Herengracht 170-172" while three published facts (the 1968-71 restoration, the 1617 inheritance) went
 * unused (user report 2026-10-16). Arrival is the moment the player is looking at the place, so it gets the next
 * fact in the same rotation, paired with its opening, and the lede only when the place has no facts.
 */
import { factCardText, type FactIndex } from '../facts/factStore';
import type { FactChoice, RotationState } from '../facts/factRotation';

export interface FinishBlurb {
  text: string;
  /** The fact chosen from the rotation; commit it once (commitShownFact) so the next card tells another. */
  choice: FactChoice | null;
}

export function finishBlurb(
  landmark: { id: string; detail?: string; longDetail?: string },
  facts: FactIndex | null | undefined,
  rotation: RotationState,
  fallback: string,
): FinishBlurb {
  const lede = landmark.longDetail || landmark.detail || '';
  const chosen = facts && facts.size ? factCardText(landmark.id, facts, rotation, landmark.detail || landmark.longDetail) : null;
  if (chosen?.text.detail) return { text: chosen.text.detail, choice: chosen.choice };
  return { text: lede || fallback, choice: null };
}
