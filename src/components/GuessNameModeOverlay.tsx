import React, { useEffect, useMemo } from 'react';
import { WikipediaCard } from './WikipediaCard';
import { LookAroundLink } from './LookAroundLink';
import { StreetFeature } from '../types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface GuessNameModeOverlayProps {
  currentFeature: StreetFeature;
  onSelectGuess: (selectedName: string) => void;
  onNoIdea: () => void;
  wasSkipped: boolean;
  selectedGuessName: string | null;
  isRoundComplete: boolean;
  onNextRound: () => void;
  isLastRound: boolean;
  roundNumber: number;
  totalRounds: number;
  factSeed: number;
}

// One chip style for every kind; see PinpointModeOverlay for why.
function getFeatureTypeBadge(type: string) {
  switch (type) {
    case 'canal':
    case 'water':
      return { label: 'Canal / Waterway', icon: '≈' };
    case 'bridge':
      return { label: 'Bridge', icon: '⌁' };
    case 'square':
      return { label: 'Square / Plaza', icon: '□' };
    case 'park':
      return { label: 'Park / Greenway', icon: '♧' };
    case 'museum':
    case 'landmark':
    case 'monument':
      return { label: 'Landmark', icon: '◆' };
    case 'avenue':
    case 'boulevard':
    case 'street':
    default:
      return { label: 'Street', icon: '╱' };
  }
}

export const GuessNameModeOverlay: React.FC<GuessNameModeOverlayProps> = ({
  currentFeature,
  onSelectGuess,
  onNoIdea,
  wasSkipped,
  selectedGuessName,
  isRoundComplete,
  onNextRound,
  isLastRound,
  roundNumber,
  totalRounds,
  factSeed,
}) => {
  // Generate randomized 4 options: 1 correct + 3 distractors
  const options = useMemo(() => {
    const pool = [currentFeature.name, ...currentFeature.distractors.slice(0, 3)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }, [currentFeature.id]);

  const isCorrect = selectedGuessName === currentFeature.name;
  const badge = getFeatureTypeBadge(currentFeature.type);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRoundComplete && event.key === 'Enter') return onNextRound();
      const index = Number(event.key) - 1;
      if (!isRoundComplete && index >= 0 && index < options.length) onSelectGuess(options[index]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRoundComplete, onNextRound, onSelectGuess, options]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 pb-4 sm:p-4 z-20">
      {/* UNIFIED BOTTOM CARD: QUESTION + MULTIPLE CHOICE OPTIONS */}
      <div className="pointer-events-auto w-full max-w-xl mx-auto">
        {!isRoundComplete ? (
          /* ACTIVE QUESTION & 4 MULTIPLE CHOICE OPTIONS */
          <div
            id="guess-bottom-card"
            className="quiz-card w-full min-w-0 p-3.5 sm:p-4 space-y-3 animate-slideUp"
          >
            {/* Top Prompt Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="enamel-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="text-[#c4a35a]">{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                  <span className="text-xs text-white/70 font-semibold uppercase tracking-wider">
                    Highlighted on the map
                  </span>
                </div>

                <h1 className="enamel-brand text-base sm:text-xl text-white leading-snug">
                  Which {badge.label.toLowerCase()} is this?
                </h1>
              </div>

              {/* Round counter */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <span className="enamel-chip px-2.5 py-1 text-xs font-bold font-mono whitespace-nowrap">
                  {roundNumber}/{totalRounds}
                </span>
              </div>
            </div>

            {/* 2x2 Multiple Choice Option Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {options.map((option, idx) => (
                <button
                  key={option}
                  id={`guess-option-${idx}`}
                  onClick={() => onSelectGuess(option)}
                  className="enamel-tile px-3 py-2.5 sm:py-3 font-bold text-xs sm:text-sm text-left flex items-center gap-2.5 transition cursor-pointer group"
                >
                  <span className="w-6 h-6 rounded-md bg-white/15 text-white/80 group-hover:bg-[#c4a35a] group-hover:text-[#071430] text-xs font-mono font-bold flex items-center justify-center flex-shrink-0 transition-colors">
                    {idx + 1}
                  </span>
                  <span className="truncate leading-tight">{option}</span>
                </button>
              ))}
            </div>
            <button
              onClick={onNoIdea}
              className="button-secondary w-full py-2 text-xs font-semibold transition cursor-pointer"
            >
              No idea — reveal the answer
            </button>
          </div>
        ) : (
          /* COMPLETED ROUND FEEDBACK CARD */
          <div
            id="guess-feedback-card"
            className="quiz-result-card w-full min-w-0 p-4 sm:p-5 space-y-3 animate-slideUp"
          >
            {/* Top Result Row */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/15">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                    isCorrect
                      ? 'bg-[#c4a35a] border-[#e2c98a] text-[#071430]'
                      : 'bg-white/10 border-white/25 text-white'
                  }`}
                >
                  {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className={`enamel-brand text-base sm:text-lg truncate ${isCorrect ? 'text-[#e2c98a]' : 'text-white'}`}>
                      {wasSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Not quite'}
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-white/80 font-bold truncate">
                    It's <span className="text-white underline">{currentFeature.name}</span>
                  </p>
                </div>
              </div>

              {/* Score & Next Round CTA */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm sm:text-base font-black text-[#c4a35a] tracking-tight">
                    {isCorrect ? '+5,000' : '+0'}{' '}
                    <span className="text-xs font-normal text-white/70">PTS</span>
                  </div>
                </div>

                <button
                  id="guess-next-round-btn"
                  onClick={onNextRound}
                  className="button-primary px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>{isLastRound ? 'See score' : 'Next'}</span>
                </button>
              </div>
            </div>
            <WikipediaCard feature={currentFeature} factSeed={factSeed} roundIndex={roundNumber - 1} />
            <LookAroundLink feature={currentFeature} />
          </div>
        )}
      </div>
    </div>
  );
};
