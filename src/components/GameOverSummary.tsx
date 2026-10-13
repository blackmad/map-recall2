import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameMode, RoundResult, City, DistanceUnit, FeatureCategory, FEATURE_CATEGORIES } from '../types';
import { formatDistance } from '../utils/geo';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  Target,
  CheckCircle2,
  XCircle,
  MapPin,
  Map,
  Layers,
} from 'lucide-react';
import { sounds } from '../utils/audio';
import type { ReviewState } from '../spacedRepetition';
import { loadLocalReviewStates } from '../progressRepository';
import { newlyEarned, sessionGroups } from '../mapRecall/progress';
import { PostcardHeader } from './PostcardHeader';
import { postcardCityName, postcardPhotosFor } from '../mapRecall/postcardPhotos';

interface GameOverSummaryProps {
  currentCity: City;
  gameMode: GameMode;
  selectedCategory?: FeatureCategory;
  roundResults: RoundResult[];
  totalScore: number;
  maxPossibleScore: number;
  unit: DistanceUnit;
  onPlayAgain: () => void;
  onSwitchMode: (newMode: GameMode) => void;
  onChangeCity: (cityId: string) => void;
  allCities: City[];
  /** Review states as they were when the session started (App's `reviewStates`, loaded by resetGame). */
  reviewStatesBefore?: ReviewState[];
  /** After the session; defaults to the local store, which recordReview has updated. */
  reviewStatesAfter?: ReviewState[];
  /** Clock for "today"/"tomorrow" (Storybook). */
  now?: number;
}

const GROUPS = [
  { id: 'known', title: 'Known', hint: 'answered well again' },
  { id: 'shaky', title: 'Still shaky', hint: 'back soon' },
  { id: 'fresh', title: 'New', hint: 'first time right' },
] as const;

export const GameOverSummary: React.FC<GameOverSummaryProps> = ({
  currentCity,
  gameMode,
  selectedCategory = 'all',
  roundResults,
  totalScore,
  maxPossibleScore,
  unit,
  onPlayAgain,
  onSwitchMode,
  reviewStatesBefore = [],
  reviewStatesAfter,
  now,
}) => {
  const [sessionNow] = useState(() => now ?? Date.now());
  const [statesAfter] = useState(() => reviewStatesAfter ?? loadLocalReviewStates());
  const groups = useMemo(
    () => sessionGroups(roundResults, reviewStatesBefore, statesAfter, sessionNow),
    [roundResults, reviewStatesBefore, statesAfter, sessionNow],
  );
  const earnedThisSession = useMemo(() => newlyEarned(roundResults, reviewStatesBefore), [roundResults, reviewStatesBefore]);
  const hero = earnedThisSession[0];
  const roundIndex = useMemo(() => new globalThis.Map(roundResults.map((result, index) => [result, index + 1])), [roundResults]);
  const [isMapInspectMode, setIsMapInspectMode] = useState(false);
  useEffect(() => {
    const restart = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button, a, [role="button"]'))) return;
      event.preventDefault();
      onPlayAgain();
    };
    window.addEventListener('keydown', restart);
    return () => window.removeEventListener('keydown', restart);
  }, [onPlayAgain]);
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);

  const activeCategoryInfo =
    FEATURE_CATEGORIES.find((c) => c.id === selectedCategory) || FEATURE_CATEGORIES[0];
  const subtitle = [
    `${roundResults.length} ${roundResults.length === 1 ? 'round' : 'rounds'}`,
    currentCity.name,
    selectedCategory === 'all' ? 'Mixed' : activeCategoryInfo.shortLabel,
  ].join(' · ');

  // Trigger celebration confetti. The ref keeps the fanfare to one play per
  // summary: this effect is re-invoked on every remount, and React StrictMode
  // remounts every component once in development.
  const hasCelebratedRef = useRef(false);
  useEffect(() => {
    if (hasCelebratedRef.current) return;
    hasCelebratedRef.current = true;
    if (percentage >= 70) sounds.playBullseye();
    else sounds.playSuccess();
    if (percentage < 70) return;
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // Confetti fallback
    }
  }, []);

  // Title / Rank
  let rankTitle = 'A useful first pass';
  let rankColor = 'text-white/75';

  if (percentage >= 90) {
    rankTitle = 'You know this map';
    rankColor = 'text-[#8a4a18]';
  } else if (percentage >= 70) {
    rankTitle = 'Strong sense of place';
    rankColor = 'text-[#8a4a18]';
  } else if (percentage >= 45) {
    rankTitle = 'Getting your bearings';
    rankColor = 'text-white/85';
  }

  // Average distance off (for pinpoint mode)
  const averageDistanceError =
    gameMode !== 'guess_name'
      ? Math.round(
          roundResults.reduce((acc, r) => acc + (r.distanceErrorMeters || 0), 0) /
            (roundResults.length || 1)
        )
      : null;

  return (
    <>
      {/* While inspecting the map, a floating pill returns to the summary. */}
      {isMapInspectMode && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
          <button
            id="show-summary-btn"
            onClick={() => setIsMapInspectMode(false)}
            className="enamel-float px-4 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[#8a4a18]" />
            <span>Show Results Summary</span>
          </button>
        </div>
      )}

      {/* Floating Top Banner when Inspecting Map */}
      {isMapInspectMode && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="enamel-float rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-[#b4682c] animate-ping" />
            <span>Map Review: Explore your pins & correct street lines</span>
          </div>
        </div>
      )}

      {/* Full Modal (hidden when inspecting map) */}
      {!isMapInspectMode && (
        <div
          id="game-over-backdrop"
          className="fixed inset-0 bg-[rgba(28,24,18,0.38)] backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-30 overflow-y-auto animate-fadeIn"
        >
          <div
            id="game-over-modal"
            className="app-dialog w-full max-w-lg p-4 sm:p-6 my-auto space-y-4 max-h-[88dvh] overflow-y-auto"
          >
            {/* Header: the session's new postcard, or the trophy. */}
            {hero ? (
              <div className="relative" data-testid="game-over-postcard">
                <div className="relative w-full overflow-hidden rounded-lg bg-[#efe7d8]" style={{ aspectRatio: '640 / 400' }}>
                  <div className="absolute inset-0">
                    <PostcardHeader
                      name={hero.feature.name}
                      cityName={postcardCityName(hero.feature.cityId) ?? currentCity.name}
                      photos={postcardPhotosFor(hero.feature)}
                      className="h-full w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
                <span className="button-primary absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-xs font-bold shadow">
                  New postcard{earnedThisSession.length > 1 ? ` · ${earnedThisSession.length}` : ''}
                </span>
              </div>
            ) : null}
            <div className="text-center space-y-1">
              {!hero && (
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-white/40 bg-white/10 text-[#8a4a18] mb-1">
                  <Trophy className="w-6 h-6" />
                </div>
              )}
              <h2 className="enamel-brand text-2xl sm:text-3xl text-white">Session complete</h2>
              <p className="text-xs sm:text-sm text-white/60" data-testid="game-over-subtitle">{subtitle}</p>
              <div className={`text-sm sm:text-base font-bold ${rankColor}`}>{rankTitle}</div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="enamel-chip p-2.5 text-center">
                <div className="text-xs text-white/60 font-medium">Final Score</div>
                <div className="text-lg sm:text-xl font-black text-[#8a4a18] tracking-tight">
                  {totalScore.toLocaleString()}
                </div>
                <div className="text-xs text-white/50">of {maxPossibleScore.toLocaleString()}</div>
              </div>

              <div className="enamel-chip p-2.5 text-center">
                <div className="text-xs text-white/60 font-medium">Accuracy</div>
                <div className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {percentage}%
                </div>
                <div className="text-xs text-white/50">Overall</div>
              </div>

              <div className="enamel-chip p-2.5 text-center">
                <div className="text-xs text-white/60 font-medium">
                  {gameMode !== 'guess_name' ? 'Avg. Error' : 'City'}
                </div>
                <div className="text-xs sm:text-sm font-black text-white tracking-tight truncate pt-1">
                  {gameMode !== 'guess_name' && averageDistanceError !== null
                    ? formatDistance(averageDistanceError, unit)
                    : currentCity.name}
                </div>
                <div className="text-xs text-white/50 capitalize">
                  {gameMode !== 'guess_name' ? 'Average distance' : 'Guess mode'}
                </div>
              </div>
            </div>

            {/* Session groups: what is known, what is still shaky, what is new. */}
            <div className="space-y-3" data-testid="session-groups">
              {GROUPS.map(({ id, title, hint }) => groups[id].length > 0 && (
                <section key={id} className="space-y-1.5" data-testid={`session-group-${id}`}>
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                      {title} <span className="text-white/45">{groups[id].length}</span>
                    </h3>
                    <span className="text-xs text-white/45">{hint}</span>
                  </div>
                  <ul className="enamel-chip divide-y divide-white/10 overflow-hidden">
                    {groups[id].map((item) => (
                      <li key={`${item.featureKey}-${item.result.roundNumber}`} className="flex items-center justify-between gap-2 p-2 text-xs sm:px-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-white">{item.name}</div>
                          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-white/60">
                            <span className="capitalize">{item.type}</span>
                            <span aria-hidden="true">·</span>
                            <span>Round {roundIndex.get(item.result) ?? item.result.roundNumber}</span>
                            <span aria-hidden="true">·</span>
                            {item.result.distanceErrorMeters !== undefined ? (
                              <span className="font-mono">{formatDistance(item.result.distanceErrorMeters, unit)}</span>
                            ) : item.result.isCorrect ? (
                              <span className="flex items-center gap-0.5 font-semibold text-[#8a4a18]"><CheckCircle2 className="h-3 w-3" /> Correct</span>
                            ) : (
                              <span className="flex items-center gap-0.5 font-semibold"><XCircle className="h-3 w-3" /> Missed</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono font-bold text-[#8a4a18]">+{item.result.pointsEarned.toLocaleString()}</div>
                          <div className="text-xs text-white/60">next <span className="font-semibold text-white">{item.nextReview}</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                id="play-again-btn"
                onClick={onPlayAgain}
                className="button-primary w-full sm:flex-1 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              <button
                id="switch-mode-btn"
                onClick={() => onSwitchMode(gameMode === 'pinpoint' ? 'guess_name' : 'pinpoint')}
                className="button-secondary w-full sm:flex-1 py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {gameMode === 'pinpoint' ? <Target className="w-3.5 h-3.5 text-[#8a4a18]" /> : <MapPin className="w-3.5 h-3.5 text-[#8a4a18]" />}
                <span>Try {gameMode === 'pinpoint' ? 'Guess Name' : 'Pinpoint'}</span>
              </button>

              <button
                id="toggle-map-inspect-btn"
                onClick={() => setIsMapInspectMode(true)}
                className="button-secondary w-full sm:flex-1 py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Map className="w-3.5 h-3.5 text-[#8a4a18]" />
                <span>Review on map</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
