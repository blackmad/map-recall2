import React, { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AnswerDetails, usePreparePostcard } from './AnswerDetails';
import { SeenBeforeChip } from './SeenBeforeChip';
import type { RelationQuestion } from '../mapRecall/relationQuestions';
import { offsetMetres } from '../mapRecall/relationQuestions';
import { formatDistance } from '../utils/geo';
import type { DistanceUnit } from '../types';
import { useT } from '../i18n/useT';

interface RelationQuestionOverlayProps {
  question: RelationQuestion;
  selectedName: string | null;
  wasSkipped: boolean;
  isRoundComplete: boolean;
  onSelect: (name: string) => void;
  onNoIdea: () => void;
  onNextRound: () => void;
  isLastRound: boolean;
  roundNumber: number;
  totalRounds: number;
  factSeed: number;
  unit: DistanceUnit;
  seenBefore?: string | null;
  nextNearby?: boolean;
  /** The bonus pin row (BonusPinPanel), shown on the answer card. */
  bonusSlot?: React.ReactNode;
}

/** Why the answer is right, in one line: "Chris Lebeaustraat is 680 m further west." */
function explanation(question: RelationQuestion, unit: DistanceUnit): string {
  const { target, other } = question;
  if (question.kind === 'neighbourhood') {
    return other.neighborhood
      ? `${target.name} is in ${question.neighbourhood}; ${other.name} is in ${other.neighborhood}.`
      : `${target.name} is in ${question.neighbourhood}.`;
  }
  const { east, north } = offsetMetres(target.center, other.center);
  const metres = question.direction === 'east' || question.direction === 'west' ? Math.abs(east) : Math.abs(north);
  return `${question.answer} is ${formatDistance(Math.round(metres / 10) * 10, unit)} further ${question.direction}.`;
}

/**
 * The two-choice Guess Name form for obscure places (src/mapRecall/relationQuestions.ts).
 * Both candidates are highlighted, unnamed, on the map; keys 1 and 2 answer.
 */
export const RelationQuestionOverlay: React.FC<RelationQuestionOverlayProps> = ({
  question, selectedName, wasSkipped, isRoundComplete, onSelect, onNoIdea, onNextRound, isLastRound,
  roundNumber, totalRounds, factSeed, unit, seenBefore, nextNearby, bonusSlot,
}) => {
  const t = useT();
  const isCorrect = selectedName === question.answer;
  usePreparePostcard(question.target);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRoundComplete && event.key === 'Enter') return onNextRound();
      const index = Number(event.key) - 1;
      if (!isRoundComplete && (index === 0 || index === 1)) onSelect(question.choices[index]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRoundComplete, onNextRound, onSelect, question]);

  return (
    <div data-question-form="relation" className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 pb-3 sm:p-4 z-20">
      <div className={`pointer-events-auto w-full max-w-xl mx-auto max-h-[42dvh] ${isRoundComplete ? 'sm:max-h-[55dvh]' : 'sm:max-h-full'} overflow-y-auto overscroll-contain`}>
        {!isRoundComplete ? (
          <div id="guess-bottom-card" data-testid="relation-question" className="quiz-card w-full min-w-0 p-2.5 sm:p-4 space-y-2 sm:space-y-3 animate-slideUp">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 sm:space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="enamel-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="text-[#8a4a18]">⇄</span>
                    <span>{t('quiz.twoPlaces')}</span>
                  </span>
                  <span className="hidden sm:inline text-xs text-white/70 font-semibold uppercase tracking-wider">{t('quiz.bothHighlighted')}</span>
                  <SeenBeforeChip label={seenBefore} />
                </div>
                <h1 className="enamel-brand text-base sm:text-xl text-white leading-snug">{question.prompt}</h1>
              </div>
              <span className="enamel-chip px-2 py-1 text-xs font-bold font-mono whitespace-nowrap sm:px-2.5 flex-shrink-0">
                {roundNumber}/{totalRounds}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
              {question.choices.map((choice, index) => (
                <button
                  key={choice}
                  id={`relation-option-${index}`}
                  onClick={() => onSelect(choice)}
                  className="qf-relation-choice enamel-tile px-2.5 py-2 sm:px-3 sm:py-3 font-bold text-xs sm:text-sm text-left flex items-center gap-2 sm:gap-2.5 transition cursor-pointer group"
                >
                  <span className="w-6 h-6 rounded-md bg-white/15 text-white/80 group-hover:bg-[#b4682c] group-hover:text-[#fbf8f2] text-xs font-mono font-bold flex items-center justify-center flex-shrink-0 transition-colors">
                    {index + 1}
                  </span>
                  <span className="leading-tight break-words min-w-0">{choice}</span>
                </button>
              ))}
            </div>
            <button onClick={onNoIdea} className="button-secondary w-full py-2 text-xs font-semibold transition cursor-pointer">
              No idea — reveal the answer
            </button>
          </div>
        ) : (
          <div id="guess-feedback-card" data-result-card data-testid="relation-result" className="quiz-result-card w-full min-w-0 p-3 sm:p-4 space-y-2.5 animate-slideUp">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/15">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${isCorrect ? 'bg-[#b4682c] border-[#8a4a18] text-[#fbf8f2]' : 'bg-white/10 border-white/25 text-white'}`}>
                  {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className={`enamel-brand text-base sm:text-lg truncate ${isCorrect ? 'text-[#8a4a18]' : 'text-white'}`}>
                    {wasSkipped ? t('quiz.skipped') : isCorrect ? t('quiz.correct') : t('quiz.notQuite')}
                  </h2>
                  <p data-testid="relation-explanation" className="text-xs sm:text-sm text-white/80 font-semibold">{explanation(question, unit)}</p>
                  {bonusSlot}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-sm sm:text-base font-black text-[#8a4a18] tracking-tight text-right">
                  {isCorrect ? '+5,000' : '+0'} <span className="text-xs font-normal text-white/70">{t('quiz.pts')}</span>
                </div>
                <button id="guess-next-round-btn" onClick={onNextRound} className="button-primary px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap">
                  <span>{isLastRound ? t('quiz.seeScore') : nextNearby ? t('quiz.nextNearby') : t('quiz.next')}</span>
                </button>
              </div>
            </div>
            <AnswerDetails feature={question.target} factSeed={factSeed} roundIndex={roundNumber - 1} />
          </div>
        )}
      </div>
    </div>
  );
};
