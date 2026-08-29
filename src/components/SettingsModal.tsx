import React, { useMemo, useState, useEffect } from 'react';
import { TileStyle, DistanceUnit, FeatureCategory, FEATURE_CATEGORIES, City, LocationScope, AdministrativeArea } from '../types';
import { X, Map, EyeOff, Ruler, Volume2, Layers, Filter, Compass, HardDrive, Trash2 } from 'lucide-react';
import { getCacheStorageStats, clearAllFeatureCache } from '../utils/featureCache';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCity: City;
  selectedCategory: FeatureCategory;
  onChangeCategory: (category: FeatureCategory) => void;
  blindMapMode: boolean;
  onToggleBlindMap: () => void;
  tileStyle: TileStyle;
  onChangeTileStyle: (style: TileStyle) => void;
  unit: DistanceUnit;
  onChangeUnit: (unit: DistanceUnit) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  roundsPerGame: number;
  onChangeRounds: (rounds: number) => void;
  locationScope: LocationScope;
  onChangeLocationScope: (scope: LocationScope) => void;
  searchRadiusMeters: number;
  onChangeSearchRadius: (radiusMeters: number) => void;
  administrativeAreas: AdministrativeArea[];
  selectedAdministrativeAreaId: number | null;
  onSelectAdministrativeArea: (areaId: number | null) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentCity,
  selectedCategory,
  onChangeCategory,
  blindMapMode,
  onToggleBlindMap,
  tileStyle,
  onChangeTileStyle,
  unit,
  onChangeUnit,
  isMuted,
  onToggleMute,
  roundsPerGame,
  onChangeRounds,
  locationScope,
  onChangeLocationScope,
  searchRadiusMeters,
  onChangeSearchRadius,
  administrativeAreas,
  selectedAdministrativeAreaId,
  onSelectAdministrativeArea,
}) => {
  const [cacheStats, setCacheStats] = useState(() => getCacheStorageStats());

  useEffect(() => {
    if (isOpen) {
      setCacheStats(getCacheStorageStats());
    }
  }, [isOpen]);

  const handleClearCache = () => {
    if (window.confirm('Clear all cached map features? Locations will be re-fetched on demand.')) {
      clearAllFeatureCache();
      setCacheStats(getCacheStorageStats());
    }
  };
  // Compute feature counts per category for the current city
  const categoryCounts = useMemo(() => {
    const counts: Record<FeatureCategory, number> = {
      all: currentCity.features.filter((feature) => feature.type !== 'neighborhood').length,
      water: 0,
      streets: 0,
      bridges: 0,
      squares: 0,
      parks: 0,
      landmarks: 0,
    };

    currentCity.features.forEach((feat) => {
      FEATURE_CATEGORIES.forEach((cat) => {
        if (cat.id !== 'all' && cat.types.includes(feat.type)) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
        }
      });
    });

    return counts;
  }, [currentCity]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div
        id="settings-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="app-dialog w-full max-w-lg p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
            <h3 id="settings-modal-title" className="text-lg font-bold text-white">Quiz & Map Configuration</h3>
          </div>

          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setting Items */}
        <div className="space-y-4 text-sm">
          {/* Location Scope (Neighborhood vs Whole City) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span>Location Quiz Scope</span>
              </div>
              <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
                {locationScope === 'neighborhood' ? '🏘️ Neighborhood' : locationScope === 'region' ? '🗺️ Region' : '🏙️ City'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Choose whether "My Location" targets your immediate local neighborhood or the entire metropolitan area.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => onChangeLocationScope('neighborhood')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  locationScope === 'neighborhood'
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-400'
                    : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>🏘️</span>
                  <span>Neighborhood (~2.2 km)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Focuses on streets and places right around your immediate vicinity.
                </span>
              </button>

              <button
                onClick={() => onChangeLocationScope('region')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  locationScope === 'region'
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-400'
                    : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5"><span>🗺️</span><span>Region (~15 km)</span></div>
                <span className="text-[11px] text-slate-400">Uses the county or province returned for your position.</span>
              </button>

              <button
                onClick={() => onChangeLocationScope('city')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  locationScope === 'city'
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-400'
                    : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>🏙️</span>
                  <span>Whole City (~4.5 km)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Encompasses major city canals, bridges, plazas, and citywide landmarks.
                </span>
              </button>
            </div>
          </div>

          {administrativeAreas.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Map className="w-4 h-4 text-violet-400" />
                <span>Administrative Boundary</span>
              </div>
              <p className="text-xs text-slate-400">
                Use an exact OpenStreetMap political boundary, or switch back to the custom radius.
              </p>
              <select
                value={selectedAdministrativeAreaId ?? ''}
                onChange={(event) => onSelectAdministrativeArea(event.target.value ? Number(event.target.value) : null)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 focus:border-violet-500 focus:outline-none cursor-pointer"
              >
                <option value="">Custom radius circle</option>
                {administrativeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} — admin level {area.adminLevel}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-cyan-400" />
                <span>Search Radius</span>
              </div>
              <span className="text-xs text-cyan-300 font-semibold">
                {(searchRadiusMeters / 1000).toFixed(1)} km
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Administrative scope chooses the place name; radius controls the actual circular OSM query independently.
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1000, 2200, 4500, 8000, 15000].map((radius) => (
                <button
                  key={radius}
                  onClick={() => onChangeSearchRadius(radius)}
                  className={`py-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                    searchRadiusMeters === radius
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {radius < 1000 ? `${radius} m` : `${radius / 1000} km`}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Type Focus (Canals, Streets, Bridges, etc.) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400" />
                <span>Feature Type Focus ({currentCity.name})</span>
              </div>
              <span className="text-xs text-blue-300 font-medium">
                {categoryCounts[selectedCategory] || 0} features available
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Filter the quiz to focus on specific types of landmarks, canals/waterways, streets, or bridges.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {FEATURE_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const isAvailable = true;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    disabled={!isAvailable}
                    onClick={() => onChangeCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm ring-1 ring-blue-400'
                        : isAvailable
                        ? 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-700/80 hover:text-white cursor-pointer'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span className="text-base">{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      {cat.id !== 'all' && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-blue-500 text-white' : 'bg-slate-750 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 line-clamp-1">
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Blind Map Mode (Label-less Basemap) */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="space-y-0.5 pr-3">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-amber-400" />
                <span>Label-less Base Map (Default)</span>
              </div>
              <p className="text-xs text-slate-400">
                Hides road names and place text labels on map tiles for a pure visual quiz.
              </p>
            </div>
            <button
              id="toggle-blind-map-switch"
              onClick={onToggleBlindMap}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer flex-shrink-0 ${
                blindMapMode ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  blindMapMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Map Tile Theme */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="font-semibold text-slate-100 flex items-center gap-2">
              <Map className="w-4 h-4 text-blue-400" />
              <span>Map Style Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'light_nolabels', label: 'CARTO Positron' },
                  { id: 'voyager', label: 'CARTO Voyager' },
                  { id: 'dark', label: 'CARTO Dark Matter' },
                  { id: 'osm', label: 'OpenStreetMap' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onChangeTileStyle(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition cursor-pointer ${
                    tileStyle === t.id
                      ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Measurement Unit */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-emerald-400" />
                <span>Distance Units</span>
              </div>
              <p className="text-xs text-slate-400">Metric (m / km) or Imperial (ft / mi)</p>
            </div>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => onChangeUnit('metric')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  unit === 'metric' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Metric
              </button>
              <button
                onClick={() => onChangeUnit('imperial')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  unit === 'imperial' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Imperial
              </button>
            </div>
          </div>

          {/* Sound FX */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>Sound Effects</span>
              </div>
              <p className="text-xs text-slate-400">Audio chimes on bullseyes & placements</p>
            </div>
            <button
              onClick={onToggleMute}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer flex-shrink-0 ${
                !isMuted ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  !isMuted ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Rounds per Game */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">Rounds per Quiz</div>
              <p className="text-xs text-slate-400">Number of street features per session</p>
            </div>
            <div className="flex gap-1.5">
              {[3, 5, 8].map((r) => (
                <button
                  key={r}
                  onClick={() => onChangeRounds(r)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roundsPerGame === r
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Offline & Feature Storage Cache */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Offline Feature Cache</span>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/50">
                {cacheStats.formattedSize}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Caches queried neighborhoods, street geometry, and clues locally to provide instant load times and reduce network requests.
            </p>
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400">
                <strong className="text-white font-mono">{cacheStats.totalFeatures}</strong> cached places across{' '}
                <strong className="text-white font-mono">{cacheStats.totalEntries}</strong> area queries
              </span>
              {cacheStats.totalEntries > 0 && (
                <button
                  onClick={handleClearCache}
                  className="px-2.5 py-1 text-xs rounded-lg bg-rose-950/50 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Cache</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Done Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30"
          >
            Apply & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
