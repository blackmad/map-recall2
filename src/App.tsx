import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  GameMode,
  StreetFeature,
  RoundResult,
  TileStyle,
  DistanceUnit,
  City,
  FeatureCategory,
  FEATURE_CATEGORIES,
  LocationScope,
  LoadingProgress,
  AdministrativeArea,
} from './types';
import { CITIES } from './data/cities';
import { calculateShortestDistanceToFeature, calculatePinpointScore } from './utils/geo';
import { reverseGeocodeLocation, fetchContainingAdministrativeAreas, geocodeLocationSearch } from './utils/osm';
import { fetchQuizAreas, fetchQuizFeatures } from './dataSources/featureProvider';
import { sounds } from './utils/audio';
import confetti from 'canvas-confetti';

import { GameHeader } from './components/GameHeader';
import { MapComponent } from './components/MapComponent';
import { PinpointModeOverlay } from './components/PinpointModeOverlay';
import { GuessNameModeOverlay } from './components/GuessNameModeOverlay';
import { GameOverSummary } from './components/GameOverSummary';
import { SettingsModal } from './components/SettingsModal';
import { LoadingProgressModal } from './components/LoadingProgressModal';
import { DebugPlacesModal } from './components/DebugPlacesModal';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './AuthContext';
import { loadLocalReviewStates, recordReview, syncProgress } from './progressRepository';
import { ReviewState, selectReviewFeatures } from './spacedRepetition';

const urlParams = new URLSearchParams(window.location.search);
const validValue = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
  value && options.includes(value as T) ? (value as T) : fallback;
const numberParam = (name: string, fallback: number, minimum: number, maximum: number) => {
  const value = Number(urlParams.get(name));
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
};
const bookmarkedLatitude = Number(urlParams.get('lat'));
const bookmarkedLongitude = Number(urlParams.get('lon'));
const hasBookmarkedCoordinates = Number.isFinite(bookmarkedLatitude) && Number.isFinite(bookmarkedLongitude)
  && bookmarkedLatitude >= -90 && bookmarkedLatitude <= 90
  && bookmarkedLongitude >= -180 && bookmarkedLongitude <= 180;
const bookmarkedAreaId = numberParam('area', 0, 1, Number.MAX_SAFE_INTEGER) || null;

const pointInAreaGeometry = (point: [number, number], geometry?: [number, number][][][]) => {
  const inRing = ([lat, lon]: [number, number], ring: [number, number][]) => {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [currentLat, currentLon] = ring[index];
      const [previousLat, previousLon] = ring[previous];
      if ((currentLat > lat) !== (previousLat > lat)
        && lon < ((previousLon - currentLon) * (lat - currentLat)) / (previousLat - currentLat) + currentLon) inside = !inside;
    }
    return inside;
  };
  return geometry?.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole))) || false;
};

const distanceToQuizFeature = (point: [number, number], feature: StreetFeature) =>
  pointInAreaGeometry(point, feature.areaGeometry)
    ? 0
    : calculateShortestDistanceToFeature(point, feature.center, feature.path, feature.paths);

export default function App() {
  const { user, configured: isCloudConfigured, signOutUser } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [reviewStates, setReviewStates] = useState<ReviewState[]>(loadLocalReviewStates);
  // Config state - Label-less base map by default
  const initialCityId = urlParams.get('city') || (hasBookmarkedCoordinates ? 'my_location' : 'amsterdam');
  const [currentCityId, setCurrentCityId] = useState<string>(initialCityId);
  const [customLocationCity, setCustomLocationCity] = useState<City | null>(() => hasBookmarkedCoordinates ? {
    id: 'my_location',
    name: urlParams.get('place') || 'Bookmarked location',
    country: '',
    countryCode: '',
    center: [bookmarkedLatitude, bookmarkedLongitude],
    defaultZoom: 12,
    minZoom: 3,
    maxZoom: 18,
    description: 'Location restored from this URL.',
    features: [],
  } : null);
  const [locationScope, setLocationScope] = useState<LocationScope>(() => validValue(urlParams.get('scope'), ['neighborhood', 'city', 'region'] as const, 'city'));
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number>(() => numberParam('radius', 4500, 250, 50000));
  const [administrativeAreas, setAdministrativeAreas] = useState<AdministrativeArea[]>([]);
  const [selectedAdministrativeAreaId, setSelectedAdministrativeAreaId] = useState<number | null>(bookmarkedAreaId);
  const [gameMode, setGameMode] = useState<GameMode>(() => validValue(urlParams.get('mode'), ['pinpoint', 'guess_name', 'guess_neighborhood'] as const, 'pinpoint'));
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory>(() => validValue(urlParams.get('category'), FEATURE_CATEGORIES.map(({ id }) => id), 'all'));
  const [linkedFeaturesOnly, setLinkedFeaturesOnly] = useState<boolean>(() => urlParams.get('references') === 'wiki');
  const [roundsPerGame, setRoundsPerGame] = useState<number>(() => Math.round(numberParam('rounds', 5, 1, 50)));
  const [blindMapMode, setBlindMapMode] = useState<boolean>(() => urlParams.get('labels') !== 'on'); // Label-less by default
  const [tileStyle, setTileStyle] = useState<TileStyle>(() => validValue(urlParams.get('map'), ['voyager', 'light_nolabels', 'osm', 'dark'] as const, 'light_nolabels'));
  const [unit, setUnit] = useState<DistanceUnit>(() => validValue(urlParams.get('unit'), ['metric', 'imperial'] as const, 'metric'));
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDebugPlacesOpen, setIsDebugPlacesOpen] = useState<boolean>(false);
  const [showSearchBoundary, setShowSearchBoundary] = useState<boolean>(true);

  // User Geolocation & Loading state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [cityOverpassFeatures, setCityOverpassFeatures] = useState<Record<string, StreetFeature[]>>({});
  const activeSearchRef = useRef<string | null>(null);
  const administrativeLookupRef = useRef<string | null>(null);

  // Keep the complete quiz setup bookmarkable without polluting browser history
  // for every toolbar adjustment. Coordinates make searched/device locations
  // reproducible without requesting geolocation again.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('city', currentCityId);
    params.set('mode', gameMode);
    params.set('category', selectedCategory);
    params.set('references', linkedFeaturesOnly ? 'wiki' : 'all');
    params.set('rounds', String(roundsPerGame));
    params.set('scope', locationScope);
    params.set('radius', String(searchRadiusMeters));
    params.set('map', tileStyle);
    params.set('labels', blindMapMode ? 'off' : 'on');
    params.set('unit', unit);
    if (selectedAdministrativeAreaId) params.set('area', String(selectedAdministrativeAreaId));
    if (currentCityId === 'my_location' && customLocationCity) {
      params.set('lat', customLocationCity.center[0].toFixed(6));
      params.set('lon', customLocationCity.center[1].toFixed(6));
      params.set('place', customLocationCity.name);
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [currentCityId, gameMode, selectedCategory, linkedFeaturesOnly, roundsPerGame, locationScope, searchRadiusMeters, tileStyle, blindMapMode, unit, selectedAdministrativeAreaId, customLocationCity]);

  // Combine custom location city with predefined cities, applying dynamically fetched OSM features
  const allCities: City[] = useMemo(() => {
    const baseList = customLocationCity ? [customLocationCity, ...CITIES] : CITIES;
    return baseList.map((city) => {
      const dynamicFeats = cityOverpassFeatures[city.id];
      if (dynamicFeats && dynamicFeats.length > 0) {
        const osmOnlyFeatures = dynamicFeats.filter((feature) => feature.id.startsWith('osm_') || feature.id.startsWith('extract_'));
        return {
          ...city,
          features: osmOnlyFeatures,
        };
      }
      // Predefined city records provide location metadata only. Quiz geometry
      // must come from OSM/cache; the old hand-authored paths were approximate.
      return city.id === 'my_location' ? city : { ...city, features: [] };
    });
  }, [customLocationCity, cityOverpassFeatures]);

  // Active City
  const currentCity = useMemo(() => {
    return allCities.find((c) => c.id === currentCityId) || allCities[0] || CITIES[0];
  }, [allCities, currentCityId]);

  // Active search boundary during OSM queries or persistent visualization
  const searchBoundary = useMemo(() => {
    const coords = (currentCityId === 'my_location' && userLocation) ? userLocation : currentCity.center;
    if (!coords) return null;
    const radiusMeters = searchRadiusMeters;
    const placeName = currentCityId === 'my_location' ? (customLocationCity?.name || 'My Location') : currentCity.name;
    const selectedArea = administrativeAreas.find((area) => area.id === selectedAdministrativeAreaId);
    return {
      center: coords,
      radiusMeters,
      label: `${placeName} • ${locationScope === 'city' ? 'city search' : 'neighborhood search'} • ${FEATURE_CATEGORIES.find((category) => category.id === selectedCategory)?.shortLabel || 'All Types'}`,
      scope: locationScope,
      category: selectedCategory,
      bounds: selectedArea?.bounds
        ? [[selectedArea.bounds.minlat, selectedArea.bounds.minlon], [selectedArea.bounds.maxlat, selectedArea.bounds.maxlon]] as [[number, number], [number, number]]
        : undefined,
      geometry: selectedArea?.geometry,
    };
  }, [userLocation, currentCity, customLocationCity, currentCityId, locationScope, selectedCategory, searchRadiusMeters, administrativeAreas, selectedAdministrativeAreaId]);

  const fetchingBoundary = useMemo(() => {
    if (!isLocating && !loadingProgress) return null;
    return searchBoundary;
  }, [isLocating, loadingProgress, searchBoundary]);

  // Predefined cities also need political hierarchy discovery. Previously this
  // happened only in the device-geolocation path, leaving Amsterdam on 4.5 km.
  useEffect(() => {
    if (currentCityId === 'my_location') return;
    const [lat, lon] = currentCity.center;
    const lookupKey = `${lat.toFixed(3)}:${lon.toFixed(3)}`;
    if (administrativeLookupRef.current === lookupKey) return;
    administrativeLookupRef.current = lookupKey;

    let cancelled = false;
    (async () => (await fetchQuizAreas(currentCityId, [lat, lon])) ?? fetchContainingAdministrativeAreas(lat, lon))().then(async (areas) => {
      if (cancelled) return;
      setAdministrativeAreas(areas);
      const municipality = [8, 7, 6]
        .map((level) => areas.find((area) => area.adminLevel === level))
        .find(Boolean);
      setSelectedAdministrativeAreaId((current) => current && areas.some((area) => area.id === current)
        ? current
        : municipality?.id || null);
    });

    return () => {
      cancelled = true;
    };
  }, [currentCityId, currentCity.center]);

  // Round & Gameplay state
  const [gameSeed, setGameSeed] = useState<number>(() => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  });
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [userPinnedLocation, setUserPinnedLocation] = useState<[number, number] | null>(null);
  const [selectedGuessName, setSelectedGuessName] = useState<string | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState<boolean>(false);
  const [wasRoundSkipped, setWasRoundSkipped] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [timeRoundStarted, setTimeRoundStarted] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!user) return;
    syncProgress(user).then(setReviewStates).catch((error) => {
      console.warn('Could not synchronize review progress:', error);
      setLocationToast('Progress saved locally; cloud sync will retry later.');
    });
  }, [user]);

  // Filter features based on selectedCategory for current city
  const filteredCityFeatures = useMemo(() => {
    const modeFeatures = gameMode === 'guess_neighborhood'
      ? currentCity.features.filter((feature) => feature.type === 'neighborhood')
      : currentCity.features.filter((feature) => feature.type !== 'neighborhood' && (!linkedFeaturesOnly || feature.wikipedia || feature.wikidata));
    if (gameMode === 'guess_neighborhood') return modeFeatures;
    if (selectedCategory === 'all') return modeFeatures;
    const cat = FEATURE_CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat) return modeFeatures;
    return modeFeatures.filter((feature) => cat.types.includes(feature.type));
  }, [currentCity, selectedCategory, linkedFeaturesOnly, gameMode]);

  // Features selected for current game session
  const featuresForGame: StreetFeature[] = useMemo(() => {
    return selectReviewFeatures(filteredCityFeatures, reviewStates, gameMode, Math.min(roundsPerGame, filteredCityFeatures.length), Date.now(), gameSeed);
  }, [filteredCityFeatures, reviewStates, gameMode, roundsPerGame, gameSeed]);

  const currentFeature: StreetFeature | null =
    featuresForGame[currentRoundIndex] || featuresForGame[0] || null;

  // Detect and center directly on user's exact location with scope
  const detectUserLocation = useCallback(
    (isManualTrigger = false, targetScope: LocationScope = locationScope) => {
      if (!('geolocation' in navigator)) {
        if (isManualTrigger) {
          setLocationToast('Geolocation is not supported by your browser.');
          setTimeout(() => setLocationToast(null), 4000);
        }
        return;
      }

      setIsLocating(true);
      setDataError(null);
      setLoadingProgress({
        percent: 15,
        message: 'Requesting device geolocation...',
        subMessage: 'Pinpointing coordinates...',
      });

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const coords: [number, number] = [lat, lon];
          setUserLocation(coords);

          try {
            setLoadingProgress({
              percent: 30,
              message: 'Reverse geocoding local district...',
              subMessage: `Targeting ${targetScope === 'neighborhood' ? 'neighborhood' : 'city'} area...`,
            });

            // 1. Get user's actual town/city, neighborhood, and country name
            const geoInfo = await reverseGeocodeLocation(lat, lon, targetScope);
            let placeName = geoInfo.name;
            const containingAreas = (await fetchQuizAreas('my_location', coords))
              ?? await fetchContainingAdministrativeAreas(lat, lon);
            setAdministrativeAreas(containingAreas);
            const preferredLevels = targetScope === 'neighborhood' ? [10, 9] : targetScope === 'region' ? [4, 5, 6] : [8, 7, 6];
            const preferredArea = preferredLevels
              .map((level) => containingAreas.find((area) => area.adminLevel === level))
              .find(Boolean);
            setSelectedAdministrativeAreaId(preferredArea?.id || null);
            if (preferredArea) placeName = preferredArea.name;

            // 2. Fetch real local streets, canals, bridges and landmarks from OSM
            const localFeatures = await fetchQuizFeatures({
              cityId: 'my_location',
              center: coords,
              placeName,
              category: selectedCategory,
              scope: targetScope,
              onProgress: setLoadingProgress,
              radiusMeters: targetScope === 'neighborhood' ? 2200 : targetScope === 'region' ? 15000 : searchRadiusMeters,
              areaId: preferredArea?.id,
            });

            const combinedFeatures = [...localFeatures];

            const myCity: City = {
              id: 'my_location',
              name: placeName,
              country: geoInfo.country,
              countryCode: geoInfo.countryCode,
              center: coords,
              defaultZoom: geoInfo.defaultZoom,
              minZoom: 10,
              maxZoom: 18,
              description: `Map and quiz based on ${placeName} (${targetScope}) with ${combinedFeatures.length} features.`,
              features: combinedFeatures,
            };

            setCustomLocationCity(myCity);
            setCurrentCityId('my_location');
            setIsLocating(false);
            setLoadingProgress(null);

            // Reset game rounds for new location
            setGameSeed((prev) => prev + 1);
            setCurrentRoundIndex(0);
            setRoundResults([]);
            setUserPinnedLocation(null);
            setSelectedGuessName(null);
            setIsRoundComplete(false);
            setWasRoundSkipped(false);
            setIsGameOver(false);
            setTimeRoundStarted(Date.now());

            setLocationToast(`Loaded ${combinedFeatures.length} places for ${placeName}`);
            setTimeout(() => setLocationToast(null), 4500);
          } catch (err) {
            console.warn('Error configuring local location city:', err);
            setIsLocating(false);
            setLoadingProgress(null);
            setDataError(err instanceof Error ? err.message : 'Could not load OpenStreetMap features.');
          }
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setIsLocating(false);
          setLoadingProgress(null);
          if (isManualTrigger) {
            setLocationToast('Could not access your location. Please check browser permissions.');
            setTimeout(() => setLocationToast(null), 4000);
          } else {
            setLocationToast(null);
            // If geolocation permission denied on startup, fallback to Amsterdam
            setCurrentCityId('amsterdam');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    },
    [locationScope, searchRadiusMeters, selectedCategory]
  );

  // Scope change handler (Neighborhood vs City)
  const handleChangeLocationScope = (newScope: LocationScope) => {
    if (newScope === locationScope || isLocating) return;
    setLocationScope(newScope);
    setSearchRadiusMeters(newScope === 'neighborhood' ? 2200 : newScope === 'region' ? 15000 : 4500);
    sounds.playPinDrop();
    setLocationToast(`Search area: ${newScope === 'neighborhood' ? 'neighborhood' : newScope === 'region' ? 'region' : 'whole city'}`);
    setTimeout(() => setLocationToast(null), 3000);
    detectUserLocation(true, newScope);
  };

  // Total score
  const totalScore = useMemo(() => {
    return roundResults.reduce((acc, r) => acc + r.pointsEarned, 0);
  }, [roundResults]);

  const maxPossibleScore = featuresForGame.length * 5000;

  // Start fresh game
  const resetGame = useCallback(
    (newCityId?: string, newMode?: GameMode, newCategory?: FeatureCategory) => {
      if (newCityId) setCurrentCityId(newCityId);
      if (newMode) setGameMode(newMode);
      if (newCategory) setSelectedCategory(newCategory);
      setGameSeed((prev) => prev + 1);
      setReviewStates(loadLocalReviewStates());
      setCurrentRoundIndex(0);
      setRoundResults([]);
      setUserPinnedLocation(null);
      setSelectedGuessName(null);
      setIsRoundComplete(false);
      setWasRoundSkipped(false);
      setIsGameOver(false);
      setTimeRoundStarted(Date.now());
    },
    []
  );

  // Handle direct category refetch from Overpass OSM API
  const handleRefetchCategory = useCallback(
    async (targetCategory: FeatureCategory, forceRefresh = false, radiusOverride?: number, areaIdOverride?: number | null) => {
      const coords = (currentCityId === 'my_location' && userLocation) ? userLocation : currentCity.center;
      if (!coords) return;
      const lat = coords[0];
      const lon = coords[1];
      const effectiveRadius = radiusOverride ?? searchRadiusMeters;
      const effectiveAreaId = areaIdOverride === undefined ? selectedAdministrativeAreaId : areaIdOverride;
      const searchKey = `${lat.toFixed(4)}:${lon.toFixed(4)}:${locationScope}:${targetCategory}:${effectiveRadius}:${effectiveAreaId || 'circle'}`;
      if (activeSearchRef.current === searchKey) return;
      activeSearchRef.current = searchKey;

      setIsLocating(true);
      setDataError(null);
      const catInfo = FEATURE_CATEGORIES.find((c) => c.id === targetCategory) || FEATURE_CATEGORIES[0];
      const placeName = currentCityId === 'my_location' ? (customLocationCity?.name || 'My Location') : currentCity.name;

      setLoadingProgress({
        percent: 25,
        message: forceRefresh ? `Live querying Overpass for ${catInfo.label}...` : `Loading ${catInfo.label}...`,
        subMessage: `Searching local features in ${placeName}...`,
      });

      try {
        const newFeatures = await fetchQuizFeatures({
          cityId: currentCityId,
          center: [lat, lon],
          placeName,
          category: targetCategory,
          scope: locationScope,
          onProgress: (prog) => setLoadingProgress(prog),
          forceRefresh,
          radiusMeters: effectiveRadius,
          areaId: effectiveAreaId || undefined,
        });

        if (newFeatures.length > 0) {
          let finalFeatures = [...newFeatures];

          setCityOverpassFeatures((prev) => ({
            ...prev,
            [currentCityId]: finalFeatures,
          }));

          if (currentCityId === 'my_location' && customLocationCity) {
            setCustomLocationCity((prev) => (prev ? { ...prev, features: finalFeatures } : null));
          }

          setSelectedCategory(targetCategory);
          resetGame(currentCityId, gameMode, targetCategory);
          setLocationToast(`Loaded ${finalFeatures.length} ${catInfo.label} places in ${placeName}`);
          setTimeout(() => setLocationToast(null), 4000);
        }
      } catch (err) {
        console.error('Error refetching category features:', err);
        setDataError(err instanceof Error ? err.message : 'Could not load OpenStreetMap features.');
      } finally {
        if (activeSearchRef.current === searchKey) activeSearchRef.current = null;
        setIsLocating(false);
        setLoadingProgress(null);
      }
    },
    [userLocation, currentCity, customLocationCity, currentCityId, locationScope, searchRadiusMeters, selectedAdministrativeAreaId, gameMode, resetGame]
  );

  const restoredQuizLoadedRef = useRef(false);
  useEffect(() => {
    if (restoredQuizLoadedRef.current || !urlParams.has('category') || currentCity.features.length > 0) return;
    restoredQuizLoadedRef.current = true;
    handleRefetchCategory(selectedCategory, false, searchRadiusMeters, selectedAdministrativeAreaId);
  }, [currentCity.features.length, handleRefetchCategory, searchRadiusMeters, selectedAdministrativeAreaId, selectedCategory]);

  const handleChangeSearchRadius = (radiusMeters: number) => {
    if (radiusMeters === searchRadiusMeters || isLocating) return;
    setSearchRadiusMeters(radiusMeters);
    setSelectedAdministrativeAreaId(null);
  };

  const handleSelectAdministrativeArea = (areaId: number | null) => {
    setSelectedAdministrativeAreaId(areaId);
    handleRefetchCategory(selectedCategory, false, searchRadiusMeters, areaId);
  };

  const handleSearchLocation = async (query: string) => {
    if (isLocating) return;
    setIsLocating(true);
    setDataError(null);
    setLoadingProgress({ percent: 15, message: 'Finding location…', subMessage: query });
    try {
      const result = await geocodeLocationSearch(query);
      if (!result) throw new Error('No matching location found');
      const coords: [number, number] = [result.lat, result.lon];
      setUserLocation(coords);
      setSelectedAdministrativeAreaId(null);
      setLoadingProgress({ percent: 30, message: 'Discovering local boundaries…', subMessage: result.name });
      const areas = (await fetchQuizAreas('my_location', coords))
        ?? await fetchContainingAdministrativeAreas(result.lat, result.lon);
      setAdministrativeAreas(areas);

      const features = await fetchQuizFeatures({
        cityId: 'my_location',
        center: coords,
        placeName: result.name,
        category: selectedCategory,
        scope: locationScope,
        onProgress: setLoadingProgress,
        radiusMeters: searchRadiusMeters,
      });
      const city: City = {
        id: 'my_location',
        name: result.name.split(',')[0],
        country: result.name,
        countryCode: '',
        center: coords,
        defaultZoom: searchRadiusMeters <= 2200 ? 14 : searchRadiusMeters <= 8000 ? 12 : 10,
        minZoom: 3,
        maxZoom: 18,
        description: `Search results within ${(searchRadiusMeters / 1000).toFixed(1)} km of ${result.name}.`,
        features,
      };
      setCustomLocationCity(city);
      setCityOverpassFeatures((previous) => ({ ...previous, my_location: features }));
      resetGame('my_location', gameMode, selectedCategory);
      setLocationToast(`Loaded ${features.length} features near ${result.name.split(',')[0]}`);
      setTimeout(() => setLocationToast(null), 4000);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Could not load this location');
      setLocationToast(error instanceof Error ? error.message : 'Could not find that location');
      setTimeout(() => setLocationToast(null), 4000);
    } finally {
      setIsLocating(false);
      setLoadingProgress(null);
    }
  };

  // Keyboard shortcut (Shift+D or ~) to toggle Debug Places
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.shiftKey && (e.key === 'D' || e.key === 'd')) || e.key === '`') {
        e.preventDefault();
        setIsDebugPlacesOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // City change handler
  const handleSelectCity = (cityId: string) => {
    if (cityId === 'my_location' && !customLocationCity) {
      detectUserLocation(true, locationScope);
    } else {
      resetGame(cityId, gameMode, selectedCategory);
    }
  };

  // Mode change handler
  const handleChangeMode = (newMode: GameMode) => {
    resetGame(currentCityId, newMode, selectedCategory);
  };

  // Feature category change handler
  const handleSelectCategory = (newCategory: FeatureCategory) => {
    if (newCategory === selectedCategory) return;
    setSelectedCategory(newCategory);
    const catInfo = FEATURE_CATEGORIES.find((c) => c.id === newCategory);
    if (catInfo && newCategory !== 'all') {
      setLocationToast(`${catInfo.icon} Feature focus: ${catInfo.label}`);
      setTimeout(() => setLocationToast(null), 3000);
    }
    // Perform category fetch for the active city
    handleRefetchCategory(newCategory, false);
  };

  // Map Click handler (for Pinpoint Mode)
  const handleMapClick = useCallback(
    (latlng: [number, number]) => {
      if ((gameMode !== 'pinpoint' && gameMode !== 'guess_neighborhood') || isRoundComplete || isGameOver) return;
      sounds.playPinDrop();
      navigator.vibrate?.(12);
      setUserPinnedLocation(latlng);
    },
    [gameMode, isRoundComplete, isGameOver]
  );

  // Current round distance error (for Pinpoint Mode)
  const currentDistanceError = useMemo(() => {
    if (!currentFeature || !userPinnedLocation) return undefined;
    return distanceToQuizFeature(userPinnedLocation, currentFeature);
  }, [currentFeature, userPinnedLocation]);

  const persistResult = (result: RoundResult) => {
    // Keep the current session's selected features frozen. The latest schedule
    // is loaded by resetGame before the next session is assembled.
    recordReview(result, user).catch((error) => {
      console.warn('Review cloud sync failed; local progress was retained:', error);
    });
  };

  // Confirm guess in Pinpoint Mode
  const handleConfirmPinpoint = () => {
    if (!currentFeature || !userPinnedLocation || isRoundComplete) return;

    const distMeters = distanceToQuizFeature(userPinnedLocation, currentFeature);
    const scoreResult = calculatePinpointScore(distMeters);
    const timeSpent = Date.now() - timeRoundStarted;

    if (distMeters <= 80) {
      sounds.playBullseye();
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {
        // fallback
      }
    } else if (distMeters <= 600) {
      sounds.playSuccess();
    } else {
      sounds.playMiss();
    }

    const result: RoundResult = {
      roundNumber: currentRoundIndex + 1,
      feature: currentFeature,
      gameMode,
      userCoordinates: userPinnedLocation,
      distanceErrorMeters: distMeters,
      accuracyPercentage: scoreResult.accuracyPercentage,
      pointsEarned: scoreResult.score,
      timeSpentMs: timeSpent,
    };

    setRoundResults((prev) => [...prev, result]);
    persistResult(result);
    navigator.vibrate?.(distMeters <= 80 ? [30, 40, 30] : 20);
    setIsRoundComplete(true);
  };

  const handleNoIdea = () => {
    if (!currentFeature || isRoundComplete) return;
    sounds.playMiss();
    const result: RoundResult = {
      roundNumber: currentRoundIndex + 1,
      feature: currentFeature,
      gameMode,
      pointsEarned: 0,
      timeSpentMs: Date.now() - timeRoundStarted,
    };
    setRoundResults((previous) => [...previous, result]);
    persistResult(result);
    setWasRoundSkipped(true);
    setIsRoundComplete(true);
  };

  // Guess Name choice selection
  const handleSelectGuessName = (name: string) => {
    if (!currentFeature || isRoundComplete) return;

    setSelectedGuessName(name);
    const isCorrect = name === currentFeature.name;
    const points = isCorrect ? 5000 : 0;
    const timeSpent = Date.now() - timeRoundStarted;

    if (isCorrect) {
      sounds.playSuccess();
      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch {
        // fallback
      }
    } else {
      sounds.playMiss();
    }

    const result: RoundResult = {
      roundNumber: currentRoundIndex + 1,
      feature: currentFeature,
      gameMode: 'guess_name',
      userSelectedName: name,
      isCorrect,
      pointsEarned: points,
      timeSpentMs: timeSpent,
    };

    setRoundResults((prev) => [...prev, result]);
    persistResult(result);
    navigator.vibrate?.(isCorrect ? [25, 35, 25] : 35);
    setIsRoundComplete(true);
  };

  // Next round or complete game
  const handleNextRound = () => {
    if (currentRoundIndex + 1 >= featuresForGame.length) {
      // Game Over
      setIsGameOver(true);
    } else {
      setCurrentRoundIndex((prev) => prev + 1);
      setUserPinnedLocation(null);
      setSelectedGuessName(null);
      setIsRoundComplete(false);
      setWasRoundSkipped(false);
      setTimeRoundStarted(Date.now());
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-stone-100 text-stone-800 font-sans select-none">
      {/* Top App Header (Strict Single Line) */}
      <GameHeader
        cities={allCities}
        currentCity={currentCity}
        onSelectCity={handleSelectCity}
        gameMode={gameMode}
        onChangeMode={handleChangeMode}
        selectedCategory={selectedCategory}
        onChangeCategory={handleSelectCategory}
        linkedFeaturesOnly={linkedFeaturesOnly}
        onToggleLinkedFeaturesOnly={() => {
          setLinkedFeaturesOnly((current) => !current);
          resetGame();
        }}
        currentRound={currentRoundIndex + 1}
        totalRounds={featuresForGame.length}
        totalScore={totalScore}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDebugPlaces={() => setIsDebugPlacesOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        blindMapMode={blindMapMode}
        onToggleBlindMap={() => setBlindMapMode((prev) => !prev)}
        onLocateUser={() => detectUserLocation(true, locationScope)}
        isLocating={isLocating}
        tileStyle={tileStyle}
        onChangeTileStyle={setTileStyle}
        unit={unit}
        onChangeUnit={setUnit}
        locationScope={locationScope}
        onChangeLocationScope={handleChangeLocationScope}
        searchRadiusMeters={searchBoundary?.radiusMeters}
        showSearchBoundary={showSearchBoundary}
        onToggleSearchBoundary={() => setShowSearchBoundary((visible) => !visible)}
        onChangeSearchRadius={handleChangeSearchRadius}
        administrativeAreas={administrativeAreas}
        selectedAdministrativeAreaId={selectedAdministrativeAreaId}
        onSelectAdministrativeArea={handleSelectAdministrativeArea}
        onSearchLocation={handleSearchLocation}
        accountEmail={user?.email || null}
        isCloudConfigured={isCloudConfigured}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={() => void signOutUser()}
      />

      {/* Main Map Viewport & Overlays */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        <a
          href={`${import.meta.env.BASE_URL}canal-drive/`}
          className="hidden sm:block absolute bottom-4 left-4 z-30 rounded-lg border border-stone-300 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur transition hover:bg-stone-50"
        >
          Canal Recall →
        </a>
        {/* Leaflet Map Canvas */}
        <MapComponent
          cityCenter={currentCity.center}
          defaultZoom={currentCity.defaultZoom}
          minZoom={currentCity.minZoom}
          maxZoom={currentCity.maxZoom}
          gameMode={gameMode}
          currentFeature={currentFeature}
          userPinnedLocation={userPinnedLocation}
          onMapClick={handleMapClick}
          isRoundComplete={isRoundComplete}
          distanceErrorMeters={currentDistanceError}
          blindMapMode={blindMapMode}
          tileStyle={tileStyle}
          allRoundResults={roundResults}
          isGameOver={isGameOver}
          userLocation={userLocation}
          onLocateUser={() => detectUserLocation(true, locationScope)}
          isLocating={isLocating}
          fetchingBoundary={fetchingBoundary}
          searchBoundary={searchBoundary}
          showSearchBoundary={showSearchBoundary}
        />

        {/* Location Detection Toast Notification */}
        {locationToast && (
          <div
            id="location-toast-badge"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-white/95 text-stone-700 text-xs sm:text-sm font-medium border border-stone-300 shadow-md backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none"
          >
            <span>{locationToast}</span>
          </div>
        )}

        {dataError && !isLocating && (
          <div className="absolute inset-x-3 top-3 z-40 mx-auto max-w-xl" role="alert">
            <div className="app-dialog p-4 text-sm">
              <div className="font-bold text-rose-700">Couldn’t load map features</div>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">{dataError}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleRefetchCategory(selectedCategory, true)}
                  className="button-primary px-4 py-2 text-xs"
                >
                  Retry
                </button>
                <button
                  onClick={() => setDataError(null)}
                  className="button-secondary px-4 py-2 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty OSM dataset: require an explicit category before starting. */}
        {!currentFeature && !isLocating && !isGameOver && !dataError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-stone-900/10 backdrop-blur-[1px]">
            <div className="app-dialog w-full max-w-lg p-5">
              <div className="text-center mb-4">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 text-lg text-white">⌖</div>
                <h2 className="text-lg font-bold text-stone-800">What would you like to learn?</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Pick a map layer for {currentCity.name}. We’ll build a short, shuffled quiz from it.
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-800">
                  Search area: {(searchRadiusMeters / 1000).toFixed(1)} km radius
                </p>
                <p className="mt-1 text-[11px] text-stone-500">No account required · progress stays on this device</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FEATURE_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      if (category.id === selectedCategory) {
                        handleRefetchCategory(category.id, false);
                      } else {
                        handleSelectCategory(category.id);
                      }
                    }}
                    className="answer-detail-card flex items-center gap-2 px-3 py-3 text-left text-xs font-semibold transition hover:-translate-y-px hover:shadow-sm cursor-pointer"
                  >
                    <span className="text-base">{category.icon}</span>
                    <span>{category.shortLabel}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => selectedCategory === 'all' ? handleRefetchCategory('all', false) : handleSelectCategory('all')}
                className="button-secondary mt-3 w-full py-2 text-xs font-semibold"
              >
                Or make me a mixed quiz
              </button>
            </div>
          </div>
        )}

        {/* Pinpoint Mode Overlay (Prompt + Feedback) */}
        {!isGameOver && (gameMode === 'pinpoint' || gameMode === 'guess_neighborhood') && currentFeature && (
          <PinpointModeOverlay
            currentFeature={currentFeature}
            userPinnedLocation={userPinnedLocation}
            onConfirmGuess={handleConfirmPinpoint}
            onNoIdea={handleNoIdea}
            wasSkipped={wasRoundSkipped}
            isRoundComplete={isRoundComplete}
            distanceErrorMeters={currentDistanceError}
            onNextRound={handleNextRound}
            isLastRound={currentRoundIndex + 1 >= featuresForGame.length}
            unit={unit}
            roundNumber={currentRoundIndex + 1}
            totalRounds={featuresForGame.length}
            searchCenter={searchBoundary?.center || currentCity.center}
          />
        )}

        {/* Guess the Name Mode Overlay */}
        {!isGameOver && gameMode === 'guess_name' && currentFeature && (
          <GuessNameModeOverlay
            currentFeature={currentFeature}
            onSelectGuess={handleSelectGuessName}
            onNoIdea={handleNoIdea}
            wasSkipped={wasRoundSkipped}
            selectedGuessName={selectedGuessName}
            isRoundComplete={isRoundComplete}
            onNextRound={handleNextRound}
            isLastRound={currentRoundIndex + 1 >= featuresForGame.length}
            roundNumber={currentRoundIndex + 1}
            totalRounds={featuresForGame.length}
          />
        )}

        {/* Game Over Summary Screen */}
        {isGameOver && (
          <GameOverSummary
            currentCity={currentCity}
            gameMode={gameMode}
            selectedCategory={selectedCategory}
            roundResults={roundResults}
            totalScore={totalScore}
            maxPossibleScore={maxPossibleScore}
            unit={unit}
            onPlayAgain={() => resetGame()}
            onSwitchMode={(newMode) => resetGame(undefined, newMode)}
            onChangeCity={(cityId) => resetGame(cityId, gameMode)}
            allCities={CITIES}
          />
        )}

        {/* Blocking Progress Overlay when Loading from Overpass */}
        <LoadingProgressModal
          isOpen={isLocating && loadingProgress !== null}
          progress={loadingProgress}
          scope={locationScope}
          locationName={customLocationCity?.name || 'Local District'}
          onCancel={() => {
            setIsLocating(false);
            setLoadingProgress(null);
          }}
        />
      </main>

      {/* Settings Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentCity={currentCity}
        selectedCategory={selectedCategory}
        onChangeCategory={handleSelectCategory}
        blindMapMode={blindMapMode}
        onToggleBlindMap={() => setBlindMapMode((prev) => !prev)}
        tileStyle={tileStyle}
        onChangeTileStyle={(s) => setTileStyle(s)}
        unit={unit}
        onChangeUnit={(u) => setUnit(u)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        roundsPerGame={roundsPerGame}
        onChangeRounds={(r) => {
          setRoundsPerGame(r);
          resetGame();
        }}
        locationScope={locationScope}
        onChangeLocationScope={handleChangeLocationScope}
        searchRadiusMeters={searchRadiusMeters}
        onChangeSearchRadius={handleChangeSearchRadius}
        administrativeAreas={administrativeAreas}
        selectedAdministrativeAreaId={selectedAdministrativeAreaId}
        onSelectAdministrativeArea={handleSelectAdministrativeArea}
      />

      {/* Debug Loaded Places Modal Dialog */}
      <DebugPlacesModal
        isOpen={isDebugPlacesOpen}
        onClose={() => setIsDebugPlacesOpen(false)}
        currentCity={currentCity}
        selectedCategory={selectedCategory}
        onChangeCategory={handleSelectCategory}
        featuresForGame={featuresForGame}
        totalAvailableInCity={currentCity.features}
        onRefetchCategory={handleRefetchCategory}
        isLocating={isLocating}
        showSearchBoundary={showSearchBoundary}
        onToggleSearchBoundary={() => setShowSearchBoundary((prev) => !prev)}
      />
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
}
