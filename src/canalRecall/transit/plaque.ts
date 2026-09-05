/**
 * What the HUD plaque shows while riding a transit corridor.
 *
 * After the line is answered (or adopted), keep it on the plaque for the rest
 * of the hop. Stop and street quizzes must not blank it — only a line question
 * (or pre-answer settle) hides the name.
 */

export interface TransitPlaqueInput {
  activeLine: string;
  roadName: string;
  quizPromptName: string;
  quizPromptSubject: string;
  quizCandidateName: string;
  quizCurrentName: string;
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
  } = input;

  const lineUnderPrompt = quizPromptSubject === 'line' && !!quizPromptName;
  const lineSettling = !activeLine
    && !!quizCandidateName
    && quizCandidateName !== quizCurrentName;

  if (lineUnderPrompt || lineSettling) {
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
