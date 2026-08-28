import React, { useMemo } from 'react';
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
}

function getFeatureTypeBadge(type: string) {
  switch (type) {
    case 'canal':
    case 'water':
      return { label: 'Canal / Waterway', icon: '🌊', bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' };
    case 'bridge':
      return { label: 'Bridge', icon: '🌉', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'square':
      return { label: 'Square / Plaza', icon: '🏛️', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' };
    case 'park':
      return { label: 'Park / Greenway', icon: '🌳', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'museum':
    case 'landmark':
    case 'monument':
      return { label: 'Landmark', icon: '🏰', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' };
    case 'avenue':
    case 'boulevard':
    case 'street':
    default:
      return { label: 'Street', icon: '🛣️', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
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

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 sm:p-4 z-20">
      {/* UNIFIED BOTTOM CARD: QUESTION + MULTIPLE CHOICE OPTIONS */}
      <div className="pointer-events-auto w-full max-w-xl mx-auto">
        {!isRoundComplete ? (
          /* ACTIVE QUESTION & 4 MULTIPLE CHOICE OPTIONS */
          <div
            id="guess-bottom-card"
            className="bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xl border border-slate-700/80 space-y-3 animate-slideUp"
          >
            {/* Top Prompt Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text} border ${badge.border} flex items-center gap-1`}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Glowing on Map
                  </span>
                </div>

                <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                  What is the name of this {badge.label.toLowerCase()}?
                </h1>
              </div>

              {/* Round counter */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono whitespace-nowrap">
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
                  className="px-3 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-left border bg-slate-800/90 hover:bg-blue-600/30 text-slate-100 border-slate-700/80 hover:border-blue-400 flex items-center gap-2.5 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98] shadow-md group"
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-950/70 text-slate-300 group-hover:bg-blue-500 group-hover:text-white text-xs font-mono font-bold flex items-center justify-center border border-slate-700/60 flex-shrink-0 transition-colors">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="truncate leading-tight">{option}</span>
                </button>
              ))}
            </div>
            <button
              onClick={onNoIdea}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl border border-slate-700/70 transition cursor-pointer"
            >
              No idea — reveal the answer
            </button>
          </div>
        ) : (
          /* COMPLETED ROUND FEEDBACK CARD */
          <div
            id="guess-feedback-card"
            className="bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-700/80 space-y-3 animate-slideUp"
          >
            {/* Top Result Row */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isCorrect
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2
                      className={`text-sm sm:text-base font-black tracking-tight truncate ${
                        isCorrect ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {wasSkipped ? 'Skipped' : isCorrect ? 'Correct!' : 'Incorrect!'}
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 font-bold truncate">
                    It's <span className="text-white underline">{currentFeature.name}</span>
                  </p>
                </div>
              </div>

              {/* Score & Next Round CTA */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm sm:text-base font-black text-amber-400 tracking-tight">
                    {isCorrect ? '+5,000' : '+0'}{' '}
                    <span className="text-[10px] font-normal text-amber-300/70">PTS</span>
                  </div>
                </div>

                <button
                  id="guess-next-round-btn"
                  onClick={onNextRound}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-1.5 transition cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span>{isLastRound ? 'See Final Score 🏆' : 'Next ➔'}</span>
                </button>
              </div>
            </div>
            <WikipediaCard feature={currentFeature} />
            <LookAroundLink feature={currentFeature} />
          </div>
        )}
      </div>
    </div>
  );
};
