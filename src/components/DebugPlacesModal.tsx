import React, { useState, useEffect } from 'react';
import { City, StreetFeature, FeatureCategory, FEATURE_CATEGORIES, SearchHistoryEntry } from '../types';
import {
  X,
  Search,
  Database,
  Layers,
  CheckCircle2,
  Navigation,
  RefreshCw,
  HardDrive,
  Trash2,
  History,
  Play,
  Copy,
  Check,
  Terminal,
  AlertCircle,
  Clock,
  MapPin,
  Radar,
  Radio,
} from 'lucide-react';
import { getCacheStorageStats, clearAllFeatureCache, getCachedOSMFeatures, getSearchHistory, clearSearchHistory } from '../utils/featureCache';
import { executeCustomOverpassQuery, buildOverpassQuery } from '../utils/osm';

interface DebugPlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCity: City;
  selectedCategory: FeatureCategory;
  onChangeCategory: (category: FeatureCategory) => void;
  featuresForGame: StreetFeature[];
  totalAvailableInCity: StreetFeature[];
  onRefetchCategory?: (cat: FeatureCategory, forceRefresh?: boolean) => void;
  isLocating?: boolean;
  showSearchBoundary?: boolean;
  onToggleSearchBoundary?: () => void;
}

export const DebugPlacesModal: React.FC<DebugPlacesModalProps> = ({
  isOpen,
  onClose,
  currentCity,
  selectedCategory,
  onChangeCategory,
  featuresForGame,
  totalAvailableInCity,
  onRefetchCategory,
  isLocating,
  showSearchBoundary = false,
  onToggleSearchBoundary,
}) => {
  const [activeTab, setActiveTab] = useState<'places' | 'history' | 'custom_query'>('places');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [cacheStats, setCacheStats] = useState(() => getCacheStorageStats());
  const [historyEntries, setHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom live query runner state
  const [customQueryText, setCustomQueryText] = useState<string>('');
  const [isRunningCustomQuery, setIsRunningCustomQuery] = useState<boolean>(false);
  const [customQueryResult, setCustomQueryResult] = useState<{
    elementsCount: number;
    featuresCount: number;
    durationMs: number;
    endpoint: string;
    features: StreetFeature[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCacheStats(getCacheStorageStats());
      setHistoryEntries(getSearchHistory());
      if (!customQueryText && currentCity.center) {
        setCustomQueryText(buildOverpassQuery(currentCity.center[0], currentCity.center[1], 4500, selectedCategory));
      }
    }
  }, [isOpen, totalAvailableInCity, currentCity, selectedCategory]);

  useEffect(() => {
    setFilterType('all');
    if (currentCity.center) {
      setCustomQueryText(buildOverpassQuery(currentCity.center[0], currentCity.center[1], 4500, selectedCategory));
    }
  }, [selectedCategory, currentCity]);

  if (!isOpen) return null;

  const filteredFeatures = totalAvailableInCity.filter((feat) => {
    const matchesSearch =
      feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.clues.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const catConfig = FEATURE_CATEGORIES.find((c) => c.id === selectedCategory);
    const matchesCategory =
      selectedCategory === 'all' || (catConfig ? catConfig.types.includes(feat.type) : true);

    const matchesType = filterType === 'all' || feat.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  // Calculate counts per category
  const categoryCounts: Record<string, number> = {};
  FEATURE_CATEGORIES.forEach((cat) => {
    if (cat.id === 'all') {
      categoryCounts[cat.id] = totalAvailableInCity.length;
    } else {
      categoryCounts[cat.id] = totalAvailableInCity.filter((f) => cat.types.includes(f.type)).length;
    }
  });

  const isCustomOSMLocation = currentCity.id === 'my_location';
  const cachedCurrent = currentCity.center
    ? getCachedOSMFeatures(currentCity.center[0], currentCity.center[1], 'city', selectedCategory, 4500)
    : null;

  const handleClearCache = () => {
    if (window.confirm('Clear all locally cached map features and geocoding? Future queries will re-fetch live.')) {
      clearAllFeatureCache();
      setCacheStats(getCacheStorageStats());
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all search history logs?')) {
      clearSearchHistory();
      setHistoryEntries([]);
    }
  };

  const handleCopyQuery = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunReplay = async (queryText: string) => {
    setIsRunningCustomQuery(true);
    setCustomQueryResult(null);
    setActiveTab('custom_query');
    setCustomQueryText(queryText);

    try {
      const lat = currentCity.center ? currentCity.center[0] : 52.3676;
      const lon = currentCity.center ? currentCity.center[1] : 4.9041;
      const result = await executeCustomOverpassQuery(queryText, currentCity.name, lat, lon);

      setCustomQueryResult({
        elementsCount: result.elementsCount,
        featuresCount: result.features.length,
        durationMs: result.durationMs,
        endpoint: result.endpoint,
        features: result.features,
      });
      // Refresh history list
      setHistoryEntries(getSearchHistory());
    } catch (err: any) {
      setCustomQueryResult({
        elementsCount: 0,
        featuresCount: 0,
        durationMs: 0,
        endpoint: 'failed',
        features: [],
        error: err.message || 'Overpass query failed',
      });
    } finally {
      setIsRunningCustomQuery(false);
    }
  };

  return (
    <div
      id="debug-places-modal-backdrop"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="debug-places-modal-dialog"
        className="w-full max-w-5xl bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Debug & Overpass Inspector</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentCity.name}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect loaded features, search boundaries, Overpass history logs, and replay live queries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search boundary visual toggle */}
            {onToggleSearchBoundary && (
              <button
                id="toggle-search-boundary-btn"
                onClick={onToggleSearchBoundary}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                  showSearchBoundary
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Toggle search area radius circle on the main map"
              >
                <Radar className="w-3.5 h-3.5" />
                <span>Search Area on Map: {showSearchBoundary ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 bg-slate-950/80 border-b border-slate-800 gap-2 text-xs">
          <button
            id="tab-places-pool"
            onClick={() => setActiveTab('places')}
            className={`py-2.5 px-3 border-b-2 font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'places'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Places Pool ({totalAvailableInCity.length})</span>
          </button>

          <button
            id="tab-search-history"
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 border-b-2 font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Search History ({historyEntries.length})</span>
          </button>

          <button
            id="tab-custom-query"
            onClick={() => setActiveTab('custom_query')}
            className={`py-2.5 px-3 border-b-2 font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'custom_query'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Overpass Query Replayer</span>
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="p-3 bg-slate-950/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px] font-medium">City Pool</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {totalAvailableInCity.length}{' '}
                <span className="text-[10px] font-normal text-slate-400">places</span>
              </div>
            </div>
            <Layers className="w-4 h-4 text-blue-400/60" />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px] font-medium">Game Pool</div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {featuresForGame.length}{' '}
                <span className="text-[10px] font-normal text-slate-400">active</span>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400/60" />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px] font-medium">Data Origin</div>
              <div className="text-xs font-semibold text-amber-300 mt-0.5 truncate">
                {cachedCurrent
                  ? 'Local Cache (Instant)'
                  : isCustomOSMLocation
                  ? 'OpenStreetMap Live'
                  : 'Curated + OSM Live'}
              </div>
            </div>
            <Navigation className="w-4 h-4 text-amber-400/60" />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px] font-medium">Local Cache</div>
              <div className="text-xs font-bold text-indigo-300 font-mono mt-0.5 flex items-center gap-1">
                <span>{cacheStats.formattedSize}</span>
                <span className="text-[10px] text-slate-400 font-normal">({cacheStats.totalFeatures} items)</span>
              </div>
            </div>
            <HardDrive className="w-4 h-4 text-indigo-400/60" />
          </div>
        </div>

        {/* TAB 1: PLACES LIST */}
        {activeTab === 'places' && (
          <>
            {/* Quick Category Focus Buttons */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Focus Category & Refetch:
                </span>
                <div className="flex items-center gap-2">
                  {cacheStats.totalEntries > 0 && (
                    <button
                      onClick={handleClearCache}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/40 transition cursor-pointer"
                      title="Clear all stored feature cache"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Cache</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {FEATURE_CATEGORIES.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onChangeCategory(cat.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : count > 0
                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                          isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                {onRefetchCategory && (
                  <button
                    disabled={isLocating}
                    onClick={() => onRefetchCategory(selectedCategory, true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-900 transition cursor-pointer disabled:opacity-50 ml-auto"
                    title="Force-refetches from OpenStreetMap Overpass API bypassing local cache"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>{isLocating ? 'Fetching OSM...' : 'Force Refresh Live'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-3 sm:px-4 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search places by name, clues, or fun fact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800/90 text-slate-100 rounded-lg border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="canal">Canals</option>
                <option value="water">Waterways / Rivers</option>
                <option value="bridge">Bridges</option>
                <option value="square">Squares</option>
                <option value="street">Streets</option>
                <option value="avenue">Avenues</option>
                <option value="park">Parks</option>
                <option value="landmark">Landmarks</option>
              </select>
            </div>

            {/* Places List Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredFeatures.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No places found matching your filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredFeatures.map((feat, idx) => {
                    const isInCurrentGame = featuresForGame.some((g) => g.id === feat.id);
                    const hasMultiPaths = feat.paths && feat.paths.length > 0;
                    const hasPath = (feat.path && feat.path.length > 1) || hasMultiPaths;
                    const totalPoints = hasMultiPaths
                      ? feat.paths!.reduce((acc, p) => acc + p.length, 0)
                      : feat.path?.length || 0;

                    return (
                      <div
                        key={feat.id || idx}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                          isInCurrentGame
                            ? 'bg-slate-900/90 border-blue-500/40 shadow-sm'
                            : 'bg-slate-900/40 border-slate-800/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{feat.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                  feat.type === 'canal' || feat.type === 'water'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                                    : feat.type === 'bridge'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                    : feat.type === 'square'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                    : feat.type === 'park'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {feat.type}
                              </span>
                            </div>

                            {isInCurrentGame && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                                In Game Pool
                              </span>
                            )}
                          </div>

                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
                          <span>
                            📍 [{feat.center[0].toFixed(4)}, {feat.center[1].toFixed(4)}]
                          </span>
                          <span>
                            {hasMultiPaths
                              ? `📐 Multi-Path (${feat.paths!.length} segments, ${totalPoints} pts)`
                              : hasPath
                              ? `📐 Polyline (${feat.path?.length} pts)`
                              : `⭕ Point (${feat.radius || 75}m)`}
                          </span>
                          <span className="capitalize text-slate-400">{feat.difficulty || 'medium'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: OVERPASS SEARCH HISTORY */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="text-xs text-slate-300">
                Log of recent Overpass API queries, cache retrievals, execution latencies, and yields:
              </div>
              {historyEntries.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/40 border border-rose-800/40 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {historyEntries.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No search queries recorded yet. Select a city or category to initiate an Overpass search.
              </div>
            ) : (
              <div className="space-y-3">
                {historyEntries.map((entry) => {
                  const dateStr = new Date(entry.timestamp).toLocaleTimeString();
                  const isSuccess = entry.status === 'success';
                  const isCacheHit = entry.status === 'cache_hit';
                  const isFallback = entry.status === 'fallback';

                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{entry.placeName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-500/30">
                            Category: {entry.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              isCacheHit
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : isSuccess
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                                : isFallback
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {isCacheHit ? '⚡ Cache Hit' : isSuccess ? '🌐 Live Overpass' : isFallback ? '⚠️ Fallback' : '❌ Error'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRunReplay(entry.overpassQuery)}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            title="Replay this query in the live replayer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Replay</span>
                          </button>

                          <button
                            onClick={() => handleCopyQuery(entry.id, entry.overpassQuery)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                            title="Copy raw Overpass QL query"
                          >
                            {copiedId === entry.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === entry.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Meta Stats Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{dateStr} ({entry.executionTimeMs}ms)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>Radius: {(entry.radiusMeters / 1000).toFixed(1)} km</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-500" />
                          <span>Found: <strong className="text-slate-200">{entry.featuresCount}</strong> features</span>
                        </div>
                        <div className="truncate" title={entry.endpointUsed || 'Local Cache'}>
                          <span>Server: {entry.endpointUsed ? new URL(entry.endpointUsed).hostname : 'Local Storage'}</span>
                        </div>
                      </div>

                      {/* Overpass Query Snippet */}
                      <div className="relative">
                        <pre className="p-2.5 rounded-lg bg-slate-950 text-[11px] font-mono text-cyan-300/90 border border-slate-800/80 overflow-x-auto max-h-28 scrollbar-thin">
                          {entry.overpassQuery}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OVERPASS LIVE QUERY REPLAYER */}
        {activeTab === 'custom_query' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Execute Raw Overpass QL Query</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Edit or test any Overpass QL query live against OSM servers to inspect raw geometry and feature yields.
                </p>
              </div>

              <button
                disabled={isRunningCustomQuery || !customQueryText.trim()}
                onClick={() => handleRunReplay(customQueryText)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md"
              >
                {isRunningCustomQuery ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isRunningCustomQuery ? 'Executing Overpass Query...' : 'Run Query Live'}</span>
              </button>
            </div>

            {/* Editor Area */}
            <div className="relative">
              <textarea
                value={customQueryText}
                onChange={(e) => setCustomQueryText(e.target.value)}
                rows={7}
                placeholder="[out:json][timeout:30];\n(\n  way[\x22waterway\x22](around:4500, 52.3676, 4.9041);\n);\nout body geom;"
                className="w-full p-3 bg-slate-950 text-cyan-300 font-mono text-xs rounded-xl border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed resize-y"
              />
            </div>

            {/* Quick Templates */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 text-[11px]">Query Presets:</span>
              <button
                onClick={() => {
                  const lat = currentCity.center ? currentCity.center[0] : 52.3676;
                  const lon = currentCity.center ? currentCity.center[1] : 4.9041;
                  setCustomQueryText(buildOverpassQuery(lat, lon, 4500, 'water'));
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
              >
                🌊 Canals & Waterways (4.5km)
              </button>
              <button
                onClick={() => {
                  const lat = currentCity.center ? currentCity.center[0] : 52.3676;
                  const lon = currentCity.center ? currentCity.center[1] : 4.9041;
                  setCustomQueryText(buildOverpassQuery(lat, lon, 4500, 'bridges'));
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
              >
                🌉 Bridges (4.5km)
              </button>
              <button
                onClick={() => {
                  const lat = currentCity.center ? currentCity.center[0] : 52.3676;
                  const lon = currentCity.center ? currentCity.center[1] : 4.9041;
                  setCustomQueryText(buildOverpassQuery(lat, lon, 4500, 'squares'));
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
              >
                🏛️ Squares (4.5km)
              </button>
            </div>

            {/* Query Results Box */}
            {customQueryResult && (
              <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Live Query Output</span>
                    {customQueryResult.error ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Query Failed</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Success ({customQueryResult.durationMs}ms)</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Endpoint: {customQueryResult.endpoint}
                  </span>
                </div>

                {customQueryResult.error ? (
                  <div className="p-3 bg-rose-950/40 text-rose-300 rounded-lg text-xs font-mono border border-rose-900/60">
                    {customQueryResult.error}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Raw OSM Elements</div>
                        <div className="text-base font-bold text-cyan-400">{customQueryResult.elementsCount}</div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Parsed Street Features</div>
                        <div className="text-base font-bold text-emerald-400">{customQueryResult.featuresCount}</div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Execution Time</div>
                        <div className="text-base font-bold text-amber-300">{customQueryResult.durationMs} ms</div>
                      </div>
                    </div>

                    {/* Preview of Parsed Features */}
                    {customQueryResult.features.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                        <div className="text-[11px] font-bold uppercase text-slate-400">
                          Parsed Features Sample:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {customQueryResult.features.map((f, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{f.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-800 text-slate-300">
                                  {f.type}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                                <span>[{f.center[0].toFixed(4)}, {f.center[1].toFixed(4)}]</span>
                                <span>{f.paths ? `${f.paths.length} segments` : f.path ? `${f.path.length} pts` : 'point'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-white">{filteredFeatures.length}</strong> of{' '}
              <strong className="text-white">{totalAvailableInCity.length}</strong> places in pool
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition cursor-pointer"
          >
            Close Debug View
          </button>
        </div>
      </div>
    </div>
  );
};
