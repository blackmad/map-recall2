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

// One chip style for every kind. Per-type pastel tints (sky-700 on cobalt,
// indigo-800 on cobalt) were unreadable on the enamel card; the glyph and the
// word already tell the kinds apart.
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
    case 'neighborhood':
      return { label: 'Neighborhood', icon: '▱' };
    case 'avenue':
    case 'boulevard':
    case 'street':
    default:
      return { label: 'Street', icon: '╱' };
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
                  <span className="enamel-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="text-[#c4a35a]">{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                  <span className="hidden sm:inline text-xs text-white/70 font-semibold uppercase tracking-wider">
                    Locate on map
                  </span>
                </div>

                <h1
                  id="target-feature-name"
                  className="enamel-brand text-lg sm:text-2xl text-white leading-snug truncate"
                  title={currentFeature.name}
                >
                  {currentFeature.name}
                </h1>
              </div>

              {/* Clue button & Round Badge */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <button
                  id="hint-toggle-btn"
                  onClick={() => setShowClues(!showClues)}
                  className={`enamel-chip ${showClues ? 'active' : ''} flex items-center gap-1 text-xs font-bold px-2.5 py-1 transition cursor-pointer`}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#c4a35a]" />
                  <span>{showClues ? 'Hide hint' : 'Hint'}</span>
                </button>

                <span className="enamel-chip px-2.5 py-1 text-xs font-bold font-mono whitespace-nowrap">
                  {roundNumber}/{totalRounds}
                </span>
              </div>
            </div>

            {/* Expandable Clues Drawer */}
            {showClues && (
              <div className="answer-detail-card p-3 text-xs space-y-2 animate-fadeIn">
                <div className="text-[#c4a35a] font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5" /> Map hints
                  </span>
                  <button
                    onClick={() => setShowClues(false)}
                    className="text-white/70 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {spatialHints.slice(0, revealedClueIndex).map((clue, idx) => (
                    <li
                      key={idx}
                      className="enamel-tile p-2 text-white text-xs flex items-start gap-2"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#c4a35a]/25 text-[#e2c98a] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{clue}</span>
                    </li>
                  ))}
                </ul>
                {revealedClueIndex < spatialHints.length && (
                  <button
                    onClick={() => setRevealedClueIndex((prev) => prev + 1)}
                    className="text-xs text-[#e2c98a] hover:text-white font-semibold underline block pt-0.5 cursor-pointer"
                  >
                    Reveal a more precise hint ({revealedClueIndex}/{spatialHints.length})
                  </button>
                )}
              </div>
            )}

            {/* Bottom Status & CTA Row */}
            <div className="pt-2 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all border ${
                    userPinnedLocation
                      ? 'bg-[#b87333] border-[#d08a4a] text-white scale-105'
                      : 'bg-white/10 border-white/25 text-[#c4a35a]'
                  }`}
                >
                  {userPinnedLocation ? (
                    <MapPin className="w-5 h-5" />
                  ) : (
                    <Target className="w-5 h-5 animate-pulse" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {userPinnedLocation ? 'Pin placed' : 'Tap the map to place a pin'}
                  </p>
                  <p className="text-xs text-white/75 truncate">
                    {userPinnedLocation ? 'Tap again to move it' : 'Anywhere you think it is'}
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
                  className={`button-primary flex-1 sm:flex-none justify-center px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
                    userPinnedLocation ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-not-allowed'
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
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/15">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center text-[#c4a35a] flex-shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="enamel-brand text-base sm:text-lg text-white truncate">
                        {wasSkipped ? 'Skipped' : scoreResult.tierLabel}
                      </h2>
                      <span className="enamel-chip text-xs px-2 py-0.5 font-mono font-bold">
                        {wasSkipped ? '0' : scoreResult.accuracyPercentage}%
                      </span>
                    </div>
                    <p className="text-xs text-[#e2c98a] font-mono font-bold">
                      {wasSkipped ? 'Answer revealed' : `Off by ${formatDistance(distanceErrorMeters, unit)}`}
                    </p>
                  </div>
                </div>

                {/* Score & Next Round CTA */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm sm:text-base font-black text-[#c4a35a] tracking-tight">
                      +{wasSkipped ? '0' : scoreResult.score.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-white/70">PTS</span>
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
              <div className="flex items-center justify-between text-xs text-white/75">
                <span>
                  Target: <strong className="text-white">{currentFeature.name}</strong>
                </span>
                <span className="text-xs text-white/60 italic hidden sm:inline">
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
