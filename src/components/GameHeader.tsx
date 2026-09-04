import React, { useState, useMemo } from 'react';
import { GameMode, City, TileStyle, DistanceUnit, FeatureCategory, FEATURE_CATEGORIES, LocationScope, AdministrativeArea } from '../types';
import {
  Compass,
  MapPin,
  Eye,
  Settings,
  Volume2,
  VolumeX,
  MoreVertical,
  X,
  EyeOff,
  LocateFixed,
  Ruler,
  Filter,
  Database,
  Search,
  LogIn,
  LogOut,
  Cloud,
} from 'lucide-react';
import { sounds } from '../utils/audio';

interface GameHeaderProps {
  cities: City[];
  currentCity: City;
  onSelectCity: (cityId: string) => void;
  gameMode: GameMode;
  onChangeMode: (mode: GameMode) => void;
  selectedCategory: FeatureCategory;
  onChangeCategory: (category: FeatureCategory) => void;
  linkedFeaturesOnly: boolean;
  onToggleLinkedFeaturesOnly: () => void;
  currentRound: number;
  totalRounds: number;
  totalScore: number;
  onOpenSettings: () => void;
  onOpenDebugPlaces?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  blindMapMode: boolean;
  onToggleBlindMap: () => void;
  onLocateUser?: () => void;
  isLocating?: boolean;
  tileStyle: TileStyle;
  onChangeTileStyle: (style: TileStyle) => void;
  unit: DistanceUnit;
  onChangeUnit: (unit: DistanceUnit) => void;
  locationScope: LocationScope;
  onChangeLocationScope: (scope: LocationScope) => void;
  searchRadiusMeters?: number;
  showSearchBoundary?: boolean;
  onToggleSearchBoundary?: () => void;
  onChangeSearchRadius?: (radiusMeters: number) => void;
  administrativeAreas?: AdministrativeArea[];
  selectedAdministrativeAreaId?: number | null;
  onSelectAdministrativeArea?: (areaId: number | null) => void;
  onSearchLocation?: (query: string) => Promise<void>;
  accountEmail?: string | null;
  isCloudConfigured?: boolean;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  cities,
  currentCity,
  onSelectCity,
  gameMode,
  onChangeMode,
  selectedCategory,
  onChangeCategory,
  linkedFeaturesOnly,
  onToggleLinkedFeaturesOnly,
  currentRound,
  totalRounds,
  totalScore,
  onOpenSettings,
  onOpenDebugPlaces,
  isMuted,
  onToggleMute,
  blindMapMode,
  onToggleBlindMap,
  onLocateUser,
  isLocating,
  tileStyle,
  onChangeTileStyle,
  unit,
  onChangeUnit,
  locationScope,
  onChangeLocationScope,
  accountEmail,
  isCloudConfigured,
  onOpenAuth,
  onSignOut,
  searchRadiusMeters,
  showSearchBoundary,
  onToggleSearchBoundary,
  onChangeSearchRadius,
  administrativeAreas = [],
  selectedAdministrativeAreaId,
  onSelectAdministrativeArea,
  onSearchLocation,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchAreaOpen, setIsSearchAreaOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');

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

  const activeCategoryInfo = FEATURE_CATEGORIES.find((c) => c.id === selectedCategory) || FEATURE_CATEGORIES[0];
  const activeAdministrativeArea = administrativeAreas.find((area) => area.id === selectedAdministrativeAreaId);
  const isCustomLocation = currentCity.id === 'my_location';

  return (
    <>
      {/* STRICT SINGLE-LINE HEADER */}
      <header
        id="app-game-header"
        className="w-full h-12 sm:h-14 border-b z-30 flex items-center px-3 sm:px-4"
      >
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Compact Logo, City Selector, Scope Toggle & Feature Type Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md border border-white/40 bg-white/10 flex items-center justify-center">
                <Compass className="w-4 h-4 text-white" />
              </div>
              <span className="enamel-brand text-base sm:text-lg text-white hidden md:inline">
                Map Recall
              </span>
            </div>

            {/* Compact City Dropdown Pill */}
            <div className="relative flex items-center min-w-0 max-w-[105px] sm:max-w-[170px]">
              <select
                id="city-select-dropdown"
                value={currentCity.id}
                onChange={(e) => onSelectCity(e.target.value)}
                className="enamel-chip w-full pl-2 pr-5 py-1 text-xs font-semibold focus:outline-none cursor-pointer appearance-none truncate"
                title={`Current Location: ${currentCity.name}`}
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} {city.countryCode ? `(${city.countryCode})` : ''}
                  </option>
                ))}
              </select>
              <span className="absolute right-1.5 pointer-events-none text-[9px] text-white/60">▼</span>
            </div>

            {searchRadiusMeters && (
              <button
                onClick={() => setIsSearchAreaOpen((open) => !open)}
                className={`enamel-chip flex items-center gap-1 px-2 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer${showSearchBoundary ? ' active' : ''}`}
                title="Adjust search radius or administrative boundary"
              >
                <Ruler className="w-3 h-3" />
                <span className="hidden sm:block max-w-28 truncate">{activeAdministrativeArea ? activeAdministrativeArea.name : `${(searchRadiusMeters / 1000).toFixed(1)} km radius`}</span>
              </button>
            )}

            {/* If on custom location, quick Hood vs City Scope Toggle button */}
            {isCustomLocation && (
              <button
                onClick={() => {
                  sounds.playPinDrop();
                  onChangeLocationScope(locationScope === 'neighborhood' ? 'city' : locationScope === 'city' ? 'region' : 'neighborhood');
                }}
                title="Cycle administrative scope"
                className="enamel-chip flex items-center gap-1 px-2 py-1 text-xs font-bold flex-shrink-0 cursor-pointer"
              >
                <span>{locationScope === 'neighborhood' ? '🏘️ Hood' : locationScope === 'region' ? '🗺️ Region' : '🏙️ City'}</span>
              </button>
            )}

            {/* Feature Type Quick Filter Badge / Dropdown */}
            {gameMode !== 'guess_neighborhood' && <div className="relative flex items-center min-w-0 max-w-[105px] sm:max-w-[145px]">
              <select
                id="feature-category-dropdown"
                value={selectedCategory}
                onChange={(e) => onChangeCategory(e.target.value as FeatureCategory)}
                className={`enamel-chip w-full pl-2 pr-5 py-1 text-xs font-semibold focus:outline-none cursor-pointer appearance-none truncate${selectedCategory !== 'all' ? ' active' : ''}`}
                title={`Feature Type Filter: ${activeCategoryInfo.label}`}
              >
                {FEATURE_CATEGORIES.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.shortLabel} {cat.id !== 'all' ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
              <span className="absolute right-1.5 pointer-events-none text-[9px] text-white/60">▼</span>
            </div>}
            {gameMode !== 'guess_neighborhood' && <button
              onClick={onToggleLinkedFeaturesOnly}
              className={`enamel-chip hidden sm:block px-2 py-1 text-[11px] font-bold cursor-pointer${linkedFeaturesOnly ? ' active' : ''}`}
              title="Only quiz features linked to Wikipedia or Wikidata"
            >
              Wiki
            </button>}
          </div>

          {/* Center/Right: Inline Mode (Desktop only) + Score & Round + Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Desktop Mode Toggle Pills */}
            <div id="game-mode-switcher" className="enamel-segment hidden lg:flex items-center gap-0.5">
              <button
                onClick={() => {
                  if (gameMode !== 'pinpoint') {
                    sounds.playPinDrop();
                    onChangeMode('pinpoint');
                  }
                }}
                aria-pressed={gameMode === 'pinpoint'}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                <span>Pinpoint</span>
              </button>

              <button
                onClick={() => {
                  if (gameMode !== 'guess_name') {
                    sounds.playPinDrop();
                    onChangeMode('guess_name');
                  }
                }}
                aria-pressed={gameMode === 'guess_name'}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>Guess Name</span>
              </button>
              <button
                onClick={() => gameMode !== 'guess_neighborhood' && onChangeMode('guess_neighborhood')}
                aria-pressed={gameMode === 'guess_neighborhood'}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                title="Place neighborhood boundaries on the map"
              >
                <Compass className="w-3 h-3" />
                <span>Neighborhood</span>
              </button>
            </div>

            {/* Score & Round Badge */}
            <div
              id="header-score-badge"
              className="hidden sm:flex items-center gap-1.5 px-1 text-xs"
              title={`Round ${currentRound} of ${totalRounds}`}
            >
              <span className="text-white font-bold whitespace-nowrap font-mono">
                {totalScore.toLocaleString()} <span className="text-[9px] font-normal text-[#c4a35a]">pts</span>
              </span>
            </div>

            {/* Blind Map indicator badge */}
            {blindMapMode && (
              <button
                onClick={onToggleBlindMap}
                title="Blind Map Mode active (labels hidden). Click to toggle."
                className="enamel-chip active hidden sm:flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                <EyeOff className="w-3 h-3" />
                <span>No Labels</span>
              </button>
            )}

            {/* Quick Mute Toggle */}
            <button
              id="header-sound-btn"
              onClick={onToggleMute}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="enamel-chip hidden sm:block p-1.5 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-white/60" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
            </button>

            {/* All Options Overflow Menu Button */}
            <button
              id="header-menu-btn"
              onClick={() => setIsMenuOpen(true)}
              title="Open Menu & Settings"
              className="enamel-chip p-1.5 flex items-center justify-center cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {isSearchAreaOpen && searchRadiusMeters && (
        <div className="app-dialog fixed top-14 sm:top-16 left-2 sm:left-1/2 sm:-translate-x-1/2 z-50 w-[calc(100%-1rem)] sm:w-80 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2"><Ruler className="w-4 h-4 text-[#c4a35a]" />Search area</span>
            <button onClick={() => setIsSearchAreaOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!locationQuery.trim() || !onSearchLocation) return;
              await onSearchLocation(locationQuery.trim());
              setIsSearchAreaOpen(false);
            }}
            className="flex gap-1.5"
          >
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="City, address, or postcode"
              aria-label="Search location"
              className="enamel-chip min-w-0 flex-1 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!locationQuery.trim() || isLocating}
              className="button-primary px-3 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              title="Find this location using the selected radius"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
          <div className="grid grid-cols-5 gap-1">
            {[1000, 2200, 4500, 8000, 15000].map((radius) => (
              <button
                key={radius}
                onClick={() => onChangeSearchRadius?.(radius)}
                className={`enamel-chip py-2 text-[10px] font-semibold cursor-pointer${!selectedAdministrativeAreaId && searchRadiusMeters === radius ? ' active' : ''}`}
              >
                {radius / 1000} km
              </button>
            ))}
          </div>
          {administrativeAreas.length > 0 && (
            <select
              value={selectedAdministrativeAreaId ?? ''}
              onChange={(event) => onSelectAdministrativeArea?.(event.target.value ? Number(event.target.value) : null)}
              className="enamel-chip w-full px-3 py-2 text-xs cursor-pointer"
            >
              <option value="">Custom radius circle</option>
              {administrativeAreas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.kind || `level ${area.adminLevel}`}</option>)}
            </select>
          )}
          <button
            onClick={onToggleSearchBoundary}
            className="enamel-chip w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer"
          >
            <span>Show boundary on map</span><span className={showSearchBoundary ? 'text-[#c4a35a] font-bold' : 'text-white/50'}>{showSearchBoundary ? 'On' : 'Off'}</span>
          </button>
        </div>
      )}

      {/* OVERFLOW DRAWER / MODAL */}
      {isMenuOpen && (
        <div
          id="header-overflow-backdrop"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-end p-2 sm:p-4 animate-fadeIn"
        >
          <div
            id="header-overflow-panel"
            className="app-dialog w-full max-w-sm p-4 sm:p-5 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md border border-white/40 bg-white/10 flex items-center justify-center text-white">
                  <Compass className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-slate-100">Map Recall Options</h3>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account and cloud progress */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/70 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Cloud className={`h-4 w-4 ${accountEmail ? 'text-[#c4a35a]' : 'text-white/60'}`} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-100">{accountEmail || 'Guest progress'}</div>
                  <div className="text-[11px] text-slate-400">{accountEmail ? 'Progress sync is active' : 'Reviews are saved on this device'}</div>
                </div>
              </div>
              {accountEmail ? (
                <button onClick={() => { onSignOut?.(); setIsMenuOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              ) : (
                <button disabled={!isCloudConfigured} onClick={() => { onOpenAuth?.(); setIsMenuOpen(false); }} className="button-primary flex w-full items-center justify-center gap-2 py-2 text-xs disabled:cursor-not-allowed" title={isCloudConfigured ? 'Sign in to sync progress' : 'Add Firebase environment variables to enable cloud sync'}>
                  <LogIn className="h-3.5 w-3.5" /> {isCloudConfigured ? 'Sign in to sync' : 'Cloud sync not configured'}
                </button>
              )}
            </div>

            {/* Location Scope Selector (Neighborhood vs Whole City) */}
            <div className="hidden">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Compass className="w-3 h-3 text-blue-400" />
                  <span>Location Scope</span>
                </label>
                <span className="text-[11px] text-blue-400 font-semibold uppercase">
                  {locationScope === 'neighborhood' ? 'Neighborhood' : locationScope === 'region' ? 'Region' : 'City'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeLocationScope('neighborhood');
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer${locationScope === 'neighborhood' ? ' active' : ''}`}
                >
                  <span className="text-sm">🏘️</span>
                  <span>Neighborhood</span>
                  <span className="text-[10px] text-slate-300 font-normal">~2.2 km radius</span>
                </button>

                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeLocationScope('city');
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer${locationScope === 'city' ? ' active' : ''}`}
                >
                  <span className="text-sm">🏙️</span>
                  <span>Whole City</span>
                  <span className="text-[10px] text-slate-300 font-normal">~4.5 km radius</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeLocationScope('region');
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer${locationScope === 'region' ? ' active' : ''}`}
                >
                  <span className="text-sm">🗺️</span>
                  <span>Region</span>
                  <span className="text-[10px] text-slate-300 font-normal">~15 km</span>
                </button>
              </div>
            </div>

            {/* Feature Type Category Filter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-[#c4a35a]" />
                  <span>Question pool</span>
                </label>
                <span className="text-[11px] text-white/70 font-medium">
                  {categoryCounts[selectedCategory] || 0} features
                </span>
              </div>
              <button
                onClick={onToggleLinkedFeaturesOnly}
                className={`enamel-tile w-full p-2.5 text-left text-xs cursor-pointer${linkedFeaturesOnly ? ' active' : ''}`}
              >
                <span className="font-bold">Wikipedia / Wikidata only</span>
                <span className="mt-0.5 block text-[10px] opacity-75">Use OSM features linked to an encyclopedia record</span>
              </button>
              <div className="hidden">
                {FEATURE_CATEGORIES.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  // Zero means "not loaded yet", not "unavailable". Selecting it
                  // initiates the category-specific OSM search.
                  const isAvailable = true;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      disabled={!isAvailable}
                      onClick={() => {
                        sounds.playPinDrop();
                        onChangeCategory(cat.id);
                        setIsMenuOpen(false);
                      }}
                      className={`p-2 rounded-xl border text-xs text-left transition flex items-center justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : isAvailable
                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700 cursor-pointer'
                          : 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{cat.icon}</span>
                        <span className="font-semibold truncate">{cat.shortLabel}</span>
                      </span>
                      {cat.id !== 'all' && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="hidden">
                {activeCategoryInfo.description}
              </p>
            </div>

            {/* Game Mode Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Game Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeMode('pinpoint');
                    setIsMenuOpen(false);
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer${gameMode === 'pinpoint' ? ' active' : ''}`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Pinpoint Location</span>
                </button>

                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeMode('guess_name');
                    setIsMenuOpen(false);
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer${gameMode === 'guess_name' ? ' active' : ''}`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Guess the Name</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playPinDrop();
                    onChangeMode('guess_neighborhood');
                    setIsMenuOpen(false);
                  }}
                  className={`enamel-tile p-2.5 text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer${gameMode === 'guess_neighborhood' ? ' active' : ''}`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Guess Neighborhood</span>
                </button>
              </div>
            </div>

            {/* City Selector & Geolocation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">City / Location</label>
                {onLocateUser && (
                  <button
                    onClick={() => {
                      onLocateUser();
                      setIsMenuOpen(false);
                    }}
                    className="text-[11px] text-[#c4a35a] hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>{isLocating ? 'Locating...' : 'Use My Location'}</span>
                  </button>
                )}
              </div>
              <select
                value={currentCity.id}
                onChange={(e) => {
                  onSelectCity(e.target.value);
                  setIsMenuOpen(false);
                }}
                className="enamel-chip w-full p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} {city.countryCode ? `(${city.countryCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Label-less Base Map Toggle */}
            <div className="hidden">
              <div className="space-y-0.5 pr-2">
                <div className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Label-less Base Map</span>
                </div>
                <p className="text-[11px] text-slate-400">Hides text labels on map tiles (Default: Active)</p>
              </div>
              <button
                onClick={onToggleBlindMap}
                className={`w-11 h-5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
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

            {/* Tile Style Theme */}
            <div className="hidden">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Map Style</label>
              <div className="grid grid-cols-2 gap-1.5">
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
                    className={`p-2 rounded-lg text-[11px] font-semibold border text-left transition cursor-pointer ${
                      tileStyle === t.id
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Unit Toggle */}
            <div className="hidden">
              <div className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span>Units</span>
              </div>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => onChangeUnit('metric')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    unit === 'metric' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Metric (m/km)
                </button>
                <button
                  onClick={() => onChangeUnit('imperial')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    unit === 'imperial' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Imperial (ft/mi)
                </button>
              </div>
            </div>

            {/* Debug Loaded Places Button */}
            {onOpenDebugPlaces && (
              <button
                id="header-debug-places-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenDebugPlaces();
                }}
                className="hidden"
              >
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>Debug Loaded Places ({categoryCounts['all'] || currentCity.features.length})</span>
              </button>
            )}

            {/* More Settings Full Modal */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onOpenSettings();
              }}
              className="button-secondary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Quiz and map settings</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
