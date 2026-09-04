import React, { useEffect, useRef, useState } from 'react';
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
  Filter,
} from 'lucide-react';
import { sounds } from '../utils/audio';

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
}

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
  onChangeCity,
  allCities,
}) => {
  const [isMapInspectMode, setIsMapInspectMode] = useState(false);
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);

  const activeCategoryInfo =
    FEATURE_CATEGORIES.find((c) => c.id === selectedCategory) || FEATURE_CATEGORIES[0];

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
    rankColor = 'text-[#c4a35a]';
  } else if (percentage >= 70) {
    rankTitle = 'Strong sense of place';
    rankColor = 'text-[#c4a35a]';
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
      {/* Floating Toggle to Switch Between Full Modal and Map Inspection */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
        <button
          id="toggle-map-inspect-btn"
          onClick={() => setIsMapInspectMode(!isMapInspectMode)}
          className="enamel-float px-4 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          {isMapInspectMode ? (
            <>
              <Layers className="w-4 h-4 text-[#c4a35a]" />
              <span>Show Results Summary</span>
            </>
          ) : (
            <>
              <Map className="w-4 h-4 text-[#c4a35a]" />
              <span>Review guesses on map</span>
            </>
          )}
        </button>
      </div>

      {/* Floating Top Banner when Inspecting Map */}
      {isMapInspectMode && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="enamel-float rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-[#c4a35a] animate-ping" />
            <span>Map Review: Explore your pins & correct street lines</span>
          </div>
        </div>
      )}

      {/* Full Modal (hidden when inspecting map) */}
      {!isMapInspectMode && (
        <div
          id="game-over-backdrop"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-30 overflow-y-auto animate-fadeIn"
        >
          <div
            id="game-over-modal"
            className="app-dialog w-full max-w-lg p-4 sm:p-6 my-auto space-y-4 max-h-[88vh] overflow-y-auto"
          >
            {/* Header Ribbon */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-white/40 bg-white/10 text-[#c4a35a] mb-1">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="enamel-brand text-2xl sm:text-3xl text-white">Round complete</h2>
              <div className={`text-sm sm:text-base font-bold ${rankColor}`}>{rankTitle}</div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                  📍 {currentCity.name}
                </span>
                {selectedCategory !== 'all' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-xs font-semibold border border-blue-600/40 flex items-center gap-1">
                    <span>{activeCategoryInfo.icon}</span>
                    <span>{activeCategoryInfo.label}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 text-center">
                <div className="text-[10px] text-slate-400 font-medium">Final Score</div>
                <div className="text-lg sm:text-xl font-black text-amber-400 tracking-tight">
                  {totalScore.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500">of {maxPossibleScore.toLocaleString()}</div>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 text-center">
                <div className="text-[10px] text-slate-400 font-medium">Accuracy</div>
                <div className="text-lg sm:text-xl font-black text-emerald-400 tracking-tight">
                  {percentage}%
                </div>
                <div className="text-[9px] text-slate-500">Overall</div>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 text-center">
                <div className="text-[10px] text-slate-400 font-medium">
                  {gameMode !== 'guess_name' ? 'Avg. Error' : 'City'}
                </div>
                <div className="text-xs sm:text-sm font-black text-blue-400 tracking-tight truncate pt-1">
                  {gameMode !== 'guess_name' && averageDistanceError !== null
                    ? formatDistance(averageDistanceError, unit)
                    : currentCity.name}
                </div>
                <div className="text-[9px] text-slate-500 capitalize">
                  {gameMode !== 'guess_name' ? 'Average distance' : 'Guess mode'}
                </div>
              </div>
            </div>

            {/* Round by Round Breakdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                <span>Round Breakdown</span>
                <button
                  onClick={() => setIsMapInspectMode(true)}
                  className="text-blue-400 hover:text-blue-300 capitalize text-[10px] underline flex items-center gap-1 cursor-pointer"
                >
                  <Map className="w-3 h-3" />
                  <span>View Map</span>
                </button>
              </div>
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/40 max-h-48 overflow-y-auto">
                {roundResults.map((result, idx) => (
                  <div key={idx} className="p-2 sm:px-3 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-slate-200 truncate">{result.feature.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{result.feature.type}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right flex-shrink-0">
                      {result.gameMode === 'pinpoint' ? (
                        <div className="text-[11px] font-mono text-slate-300">
                          {result.distanceErrorMeters !== undefined
                            ? formatDistance(result.distanceErrorMeters, unit)
                            : '-'}
                        </div>
                      ) : (
                        <div>
                          {result.isCorrect ? (
                            <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Correct
                            </span>
                          ) : (
                            <span className="text-rose-400 text-[11px] font-semibold flex items-center gap-0.5">
                              <XCircle className="w-3 h-3" /> Missed
                            </span>
                          )}
                        </div>
                      )}

                      <div className="font-mono font-bold text-amber-400 min-w-[55px] text-right text-xs">
                        +{result.pointsEarned.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                {gameMode === 'pinpoint' ? <Target className="w-3.5 h-3.5 text-blue-400" /> : <MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Try {gameMode === 'pinpoint' ? 'Guess Name' : 'Pinpoint'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
