import React, { useEffect, useMemo, useState } from 'react';
import { StreetFeature, DistanceUnit } from '../types';
import { calculateHaversineDistanceMeters, calculatePinpointScore, formatDistance } from '../utils/geo';
import {
  MapPin,
  HelpCircle,
  ArrowRight,
  Award,
  Target,
  Sparkles,
} from 'lucide-react';
import { WikipediaCard } from './WikipediaCard';
import { LookAroundLink } from './LookAroundLink';

interface PinpointModeOverlayProps {
  currentFeature: StreetFeature;
  userPinnedLocation: [number, number] | null;
  onConfirmGuess: () => void;
  onNoIdea: () => void;
  wasSkipped: boolean;
  isRoundComplete: boolean;
  distanceErrorMeters?: number;
  onNextRound: () => void;
  isLastRound: boolean;
  unit: DistanceUnit;
  roundNumber: number;
  totalRounds: number;
  factSeed: number;
  searchCenter: [number, number];
}

function getFeatureTypeBadge(type: string) {
  switch (type) {
    case 'canal':
    case 'water':
      return { label: 'Canal / Waterway', icon: '≈', bg: 'bg-sky-500/20', text: 'text-sky-700', border: 'border-sky-500/30' };
    case 'bridge':
      return { label: 'Bridge', icon: '⌁', bg: 'bg-amber-500/20', text: 'text-amber-800', border: 'border-amber-500/30' };
    case 'square':
      return { label: 'Square / Plaza', icon: '□', bg: 'bg-purple-500/20', text: 'text-purple-800', border: 'border-purple-500/30' };
    case 'park':
      return { label: 'Park / Greenway', icon: '♧', bg: 'bg-emerald-500/20', text: 'text-emerald-800', border: 'border-emerald-500/30' };
    case 'museum':
    case 'landmark':
    case 'monument':
      return { label: 'Landmark', icon: '◆', bg: 'bg-indigo-500/20', text: 'text-indigo-800', border: 'border-indigo-500/30' };
    case 'neighborhood':
      return { label: 'Neighborhood', icon: '▱', bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };
    case 'avenue':
    case 'boulevard':
    case 'street':
    default:
      return { label: 'Street', icon: '╱', bg: 'bg-blue-500/20', text: 'text-blue-800', border: 'border-blue-500/30' };
  }
}

export const PinpointModeOverlay: React.FC<PinpointModeOverlayProps> = ({
  currentFeature,
  userPinnedLocation,
  onConfirmGuess,
  onNoIdea,
  wasSkipped,
  isRoundComplete,
  distanceErrorMeters = 0,
  onNextRound,
  isLastRound,
  unit,
  roundNumber,
  totalRounds,
  factSeed,
  searchCenter,
}) => {
  const [showClues, setShowClues] = useState(false);
  const [revealedClueIndex, setRevealedClueIndex] = useState(1);

  const scoreResult = isRoundComplete ? calculatePinpointScore(distanceErrorMeters) : null;
  const badge = getFeatureTypeBadge(currentFeature.type);
  const spatialHints = useMemo(() => {
    const [centerLat, centerLon] = searchCenter;
    const [targetLat, targetLon] = currentFeature.center;
    const northSouth = targetLat >= centerLat ? 'north' : 'south';
    const eastWest = targetLon >= centerLon ? 'east' : 'west';
    const latDeltaMeters = (targetLat - centerLat) * 111_320;
    const lonDeltaMeters = (targetLon - centerLon) * 111_320 * Math.cos((centerLat * Math.PI) / 180);
    const angle = (Math.atan2(lonDeltaMeters, latDeltaMeters) * 180 / Math.PI + 360) % 360;
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    const direction = directions[Math.round(angle / 45) % 8];
    const distance = calculateHaversineDistanceMeters(searchCenter, currentFeature.center);
    const broadAxis = Math.abs(latDeltaMeters) >= Math.abs(lonDeltaMeters) ? northSouth : eastWest;
    return [
      `Look in the ${broadAxis}ern half of the search area.`,
      `Narrow it down to the ${northSouth}${eastWest} quadrant.`,
      `About ${formatDistance(distance, unit)} ${direction} of the search center.`,
    ];
  }, [currentFeature.center, searchCenter, unit]);

  useEffect(() => {
    setShowClues(false);
    setRevealedClueIndex(1);
  }, [currentFeature.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (isRoundComplete) onNextRound();
      else if (userPinnedLocation) onConfirmGuess();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRoundComplete, onNextRound, onConfirmGuess, userPinnedLocation]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 pb-4 sm:p-4 z-20">
      {/* UNIFIED BOTTOM CARD: QUESTION + CLUES + PIN STATUS + SUBMIT CTA */}
      <div className="pointer-events-auto w-full max-w-xl mx-auto">
        {!isRoundComplete ? (
          /* ACTIVE QUESTION & ACTION CARD */
          <div
            id="pinpoint-bottom-card"
            className="quiz-card w-full min-w-0 p-3.5 sm:p-4 space-y-3 animate-slideUp"
          >
            {/* Top Question Row: Feature Type + Target Name + Clue Trigger + Round Indicator */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text} border ${badge.border} flex items-center gap-1`}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                  <span className="hidden sm:inline text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Locate on Map:
                  </span>
                </div>

                <h1
                  id="target-feature-name"
                  className="text-base sm:text-xl font-black text-white tracking-tight leading-snug drop-shadow-sm truncate"
                  title={currentFeature.name}
                >
                  {currentFeature.name}
                </h1>
              </div>

              {/* Clue button & Round Badge */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                {(
                  <button
                    id="hint-toggle-btn"
                    onClick={() => setShowClues(!showClues)}
                    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl transition cursor-pointer border ${
                      showClues
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border-amber-400/30'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{showClues ? 'Hide Hint' : 'Hint'}</span>
                  </button>
                )}

                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono whitespace-nowrap">
                  {roundNumber}/{totalRounds}
                </span>
              </div>
            </div>

            {/* Expandable Clues Drawer */}
            {showClues && (
              <div className="answer-detail-card p-3 text-xs space-y-2 animate-fadeIn">
                <div className="text-amber-300 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Map hints
                  </span>
                  <button
                    onClick={() => setShowClues(false)}
                    className="text-slate-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {spatialHints.slice(0, revealedClueIndex).map((clue, idx) => (
                    <li
                      key={idx}
                      className="bg-slate-800/90 p-2 rounded-xl text-slate-200 text-xs flex items-start gap-2 border border-slate-700/60"
                    >
                      <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{clue}</span>
                    </li>
                  ))}
                </ul>
                {revealedClueIndex < spatialHints.length && (
                  <button
                    onClick={() => setRevealedClueIndex((prev) => prev + 1)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline block pt-0.5 cursor-pointer"
                  >
                    Reveal a more precise hint ({revealedClueIndex}/{spatialHints.length})
                  </button>
                )}
              </div>
            )}

            {/* Bottom Status & CTA Row */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    userPinnedLocation
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-105'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {userPinnedLocation ? (
                    <MapPin className="w-5 h-5 animate-bounce" />
                  ) : (
                    <Target className="w-5 h-5 animate-pulse text-blue-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {userPinnedLocation ? 'Pin Placed!' : 'Tap map to place pin'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {userPinnedLocation ? 'Tap map to adjust pin position' : 'Click anywhere on map'}
                  </p>
                </div>
              </div>

              <div className="flex w-full sm:w-auto items-center gap-2 flex-shrink-0">
                <button
                  onClick={onNoIdea}
                  className="button-secondary flex-1 sm:flex-none px-3 py-2.5 text-xs font-semibold transition cursor-pointer"
                >
                  No idea
                </button>
                <button
                id="confirm-pinpoint-btn"
                disabled={!userPinnedLocation}
                onClick={onConfirmGuess}
                className={`button-primary flex-1 sm:flex-none justify-center px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  userPinnedLocation
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-2 ring-emerald-400/40 shadow-emerald-500/30 hover:scale-105 active:scale-95'
                    : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <span>Confirm</span>
                <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ROUND COMPLETION / ACCURACY FEEDBACK CARD */
          scoreResult && (
            <div
              id="pinpoint-feedback-card"
              className="quiz-result-card w-full min-w-0 p-4 sm:p-5 space-y-3 animate-slideUp"
            >
              {/* Target & Accuracy Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-sm sm:text-base font-black tracking-tight ${scoreResult.tierColor} truncate`}>
                        {wasSkipped ? 'Skipped' : scoreResult.tierLabel}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-mono font-bold">
                        {wasSkipped ? '0' : scoreResult.accuracyPercentage}%
                      </span>
                    </div>
                    <p className="text-xs text-amber-300 font-mono font-bold">
                      {wasSkipped ? 'Answer revealed' : `Off by ${formatDistance(distanceErrorMeters, unit)}`}
                    </p>
                  </div>
                </div>

                {/* Score & Next Round CTA */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm sm:text-base font-black text-amber-400 tracking-tight">
                      +{wasSkipped ? '0' : scoreResult.score.toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-amber-300/70">PTS</span>
                    </div>
                  </div>

                  <button
                    id="next-round-btn"
                    onClick={onNextRound}
                    className="button-primary px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{isLastRound ? 'See score' : 'Next'}</span>
                  </button>
                </div>
              </div>

              {/* Target Name Reference */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Target: <strong className="text-white">{currentFeature.name}</strong>
                </span>
                <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                  Dashed line shows distance on map
                </span>
              </div>
              <WikipediaCard feature={currentFeature} factSeed={factSeed} roundIndex={roundNumber - 1} />
              <LookAroundLink feature={currentFeature} />
            </div>
          )
        )}
      </div>
    </div>
  );
};
