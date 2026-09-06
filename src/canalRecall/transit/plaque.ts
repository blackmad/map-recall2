/**
 * What the HUD plaque shows while riding a transit corridor.
 *
 * After the line is answered (or adopted), keep it on the plaque for the rest
 * of the hop. Stop and street quizzes must not blank it — only a line question
 * (or pre-answer settle) hides the name.
 *
 * After a hub change (leg index ≥ 1), the previous line must not linger: the
 * plaque stays clear until the player answers or adopts the new corridor.
 */

export interface TransitPlaqueInput {
  activeLine: string;
  roadName: string;
  quizPromptName: string;
  quizPromptSubject: string;
  quizCandidateName: string;
  quizCurrentName: string;
  /** 0 = first ride, 1 = boarded the connecting line. */
  transitLegIndex?: number;
}

export interface TransitPlaqueResult {
  routeName: string;
  answerHidden: boolean;
}

export function transitPlaqueRouteName(input: TransitPlaqueInput): TransitPlaqueResult {
  const {
    activeLine,
    quizPromptName,
    quizPromptSubject,
    quizCandidateName,
    quizCurrentName,
    transitLegIndex = 0,
  } = input;

  const lineUnderPrompt = quizPromptSubject === 'line' && !!quizPromptName;
  const lineSettling = !activeLine
    && !!quizCandidateName
    && quizCandidateName !== quizCurrentName;
  // Second leg: never show a stale first-leg name while the new corridor is unset.
  const awaitingSecondLeg = transitLegIndex >= 1 && !activeLine;

  if (lineUnderPrompt || lineSettling || awaitingSecondLeg) {
    return { routeName: '', answerHidden: true };
  }

  // Never fall back to getRoadName before the first line answer — that would
  // leak "Tram 2" while a stop/street question is open, or on every frame of
  // the hop before the line is asked.
  if (!activeLine) {
    return { routeName: '', answerHidden: true };
  }

  return { routeName: activeLine, answerHidden: false };
}
