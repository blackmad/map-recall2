/**
 * One teaching surface at a time.
 *
 * The corridor is the lesson. A quiz, lingering answer feedback, or a utility
 * overlay owns the bottom band; landmark and neighbourhood cards wait. Without
 * this mutex the screen fills with a waterway question, a stale correction,
 * and a museum card at once.
 */

export interface TeachingGateInput {
  /** A multiple-choice / typing prompt owns the question (`quizPromptName`). */
  quizOpen: boolean;
  /** Canvas HUD still shows "Not quite — …" / "Correct — …". */
  feedbackVisible: boolean;
  /** DOM `#canal-prompt` is up, including the post-answer hold window. */
  promptVisible: boolean;
  /** Settings, help, or the expanded landmark article. */
  utilityOpen: boolean;
}

/** Quiz and feedback own teaching attention; cards must not stack under them. */
export function teachingOwnsBottom(input: TeachingGateInput): boolean {
  return input.quizOpen || input.feedbackVisible || input.promptVisible || input.utilityOpen;
}

export function canShowTeachingCard(input: TeachingGateInput): boolean {
  return !teachingOwnsBottom(input);
}

/**
 * The city overview stays up during a quiz. It draws no names, so it does not
 * answer the question, and orientation is most useful exactly when you are
 * stopped and thinking. Utility panels still own the screen; hide under those.
 */
export function canShowMiniMap(enabled: boolean, input: TeachingGateInput): boolean {
  return enabled && !input.utilityOpen;
}

/** Dense POI names answer “where am I?” for free during a place quiz. */
export function canShowPoiLabels(labelsWanted: boolean, input: TeachingGateInput): boolean {
  return labelsWanted && !input.quizOpen && !input.promptVisible;
}
