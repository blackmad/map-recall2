import { useState, useMemo, useCallback, useEffect } from 'react';
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
} from './types';
import { CITIES } from './data/cities';
import { calculateShortestDistanceToFeature, calculatePinpointScore, findNearestCity } from './utils/geo';
import { reverseGeocodeLocation, fetchLocalOSMFeatures, fetchCategorySpecificOSMFeatures } from './utils/osm';
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

export default function App() {
  // Config state - Label-less base map by default
  const [currentCityId, setCurrentCityId] = useState<string>('my_location');
  const [customLocationCity, setCustomLocationCity] = useState<City | null>(null);
  const [locationScope, setLocationScope] = useState<LocationScope>('city');
  const [gameMode, setGameMode] = useState<GameMode>('pinpoint');
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory>('all');
  const [roundsPerGame, setRoundsPerGame] = useState<number>(5);
  const [blindMapMode, setBlindMapMode] = useState<boolean>(true); // Label-less by default
  const [tileStyle, setTileStyle] = useState<TileStyle>('light_nolabels'); // Clean label-less
  const [unit, setUnit] = useState<DistanceUnit>('metric');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDebugPlacesOpen, setIsDebugPlacesOpen] = useState<boolean>(false);
  const [showSearchBoundary, setShowSearchBoundary] = useState<boolean>(false);

  // User Geolocation & Loading state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [locationToast, setLocationToast] = useState<string | null>(null);
  const [cityOverpassFeatures, setCityOverpassFeatures] = useState<Record<string, StreetFeature[]>>({});

  // Combine custom location city with predefined cities, applying dynamically fetched OSM features
  const allCities: City[] = useMemo(() => {
    const baseList = customLocationCity ? [customLocationCity, ...CITIES] : CITIES;
    return baseList.map((city) => {
      const dynamicFeats = cityOverpassFeatures[city.id];
      if (dynamicFeats && dynamicFeats.length > 0) {
        return {
          ...city,
          features: dynamicFeats,
        };
      }
      return city;
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
    const radiusMeters = locationScope === 'neighborhood' ? 2200 : 4500;
    const placeName = currentCityId === 'my_location' ? (customLocationCity?.name || 'My Location') : currentCity.name;
    return {
      center: coords,
      radiusMeters,
      label: `${placeName}`,
      scope: locationScope,
    };
  }, [userLocation, currentCity, customLocationCity, currentCityId, locationScope]);

  const fetchingBoundary = useMemo(() => {
    if (!isLocating && !loadingProgress) return null;
    return searchBoundary;
  }, [isLocating, loadingProgress, searchBoundary]);

  // Round & Gameplay state
  const [gameSeed, setGameSeed] = useState<number>(1);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [userPinnedLocation, setUserPinnedLocation] = useState<[number, number] | null>(null);
  const [selectedGuessName, setSelectedGuessName] = useState<string | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [timeRoundStarted, setTimeRoundStarted] = useState<number>(() => Date.now());

  // Filter features based on selectedCategory for current city
  const filteredCityFeatures = useMemo(() => {
    if (selectedCategory === 'all') return currentCity.features;
    const cat = FEATURE_CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat) return currentCity.features;
    const matches = currentCity.features.filter((f) => cat.types.includes(f.type));
    // If no matching items in this specific city, fallback gracefully to all features
    return matches.length > 0 ? matches : currentCity.features;
  }, [currentCity, selectedCategory]);

  // Features selected for current game session
  const featuresForGame: StreetFeature[] = useMemo(() => {
    const pool = [...filteredCityFeatures];
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(roundsPerGame, shuffled.length));
  }, [filteredCityFeatures, roundsPerGame, gameSeed]);

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

            // Check if user is near one of our handcrafted cities
            const nearest = findNearestCity(coords, CITIES);
            const isNearCuratedCity = nearest.distanceMeters <= (targetScope === 'neighborhood' ? 12000 : 35000);

            // 2. Fetch real local streets, canals, bridges and landmarks from OSM
            const localFeatures = await fetchLocalOSMFeatures(
              lat,
              lon,
              placeName,
              targetScope,
              (progress) => setLoadingProgress(progress)
            );

            // Combine with nearest curated city if close, avoiding duplicates
            let combinedFeatures = [...localFeatures];
            if (isNearCuratedCity && nearest.city.features) {
              const existingNames = new Set(combinedFeatures.map((f) => f.name.toLowerCase()));
              const curatedToAdd = nearest.city.features.filter(
                (f) => !existingNames.has(f.name.toLowerCase())
              );
              combinedFeatures = [...combinedFeatures, ...curatedToAdd.slice(0, 15)];
              if (!placeName.toLowerCase().includes(nearest.city.name.toLowerCase())) {
                placeName = `${nearest.city.name} (${placeName})`;
              }
            }

            const myCity: City = {
              id: 'my_location',
              name: `📍 ${placeName}`,
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
            setIsGameOver(false);
            setTimeRoundStarted(Date.now());

            setLocationToast(`📍 Loaded ${combinedFeatures.length} places for ${placeName}`);
            setTimeout(() => setLocationToast(null), 4500);
          } catch (err) {
            console.warn('Error configuring local location city:', err);
            setIsLocating(false);
            setLoadingProgress(null);

            const fallbackCity: City = {
              id: 'my_location',
              name: '📍 My Location',
              country: 'Current Area',
              countryCode: 'LOC',
              center: coords,
              defaultZoom: targetScope === 'neighborhood' ? 15 : 13,
              minZoom: 10,
              maxZoom: 18,
              description: 'Map centered on your current coordinates.',
              features: [
                {
                  id: 'local_feat_1',
                  name: 'District Center',
                  type: 'street',
                  cityId: 'my_location',
                  center: coords,
                  funFact: 'Centered directly on your geographic coordinates.',
                  clues: ['Located right near your current position.'],
                  distractors: ['North Road', 'West Avenue', 'South Street'],
                  difficulty: 'easy',
                },
              ],
            };

            setCustomLocationCity(fallbackCity);
            setCurrentCityId('my_location');
            setLocationToast('📍 Centered on your exact coordinates!');
            setTimeout(() => setLocationToast(null), 4000);
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
    [locationScope]
  );

  // Scope change handler (Neighborhood vs City)
  const handleChangeLocationScope = (newScope: LocationScope) => {
    setLocationScope(newScope);
    sounds.playPinDrop();
    setLocationToast(`Switched scope to: ${newScope === 'neighborhood' ? '🏘️ Neighborhood' : '🏙️ Whole City'}`);
    setTimeout(() => setLocationToast(null), 3000);
    detectUserLocation(true, newScope);
  };

  // Default to current location on initial app load
  useEffect(() => {
    detectUserLocation(false, 'city');
  }, [detectUserLocation]);

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
      setCurrentRoundIndex(0);
      setRoundResults([]);
      setUserPinnedLocation(null);
      setSelectedGuessName(null);
      setIsRoundComplete(false);
      setIsGameOver(false);
      setTimeRoundStarted(Date.now());
    },
    []
  );

  // Handle direct category refetch from Overpass OSM API
  const handleRefetchCategory = useCallback(
    async (targetCategory: FeatureCategory, forceRefresh = false) => {
      const coords = (currentCityId === 'my_location' && userLocation) ? userLocation : currentCity.center;
      if (!coords) return;
      const lat = coords[0];
      const lon = coords[1];

      setIsLocating(true);
      const catInfo = FEATURE_CATEGORIES.find((c) => c.id === targetCategory) || FEATURE_CATEGORIES[0];
      const placeName = currentCityId === 'my_location' ? (customLocationCity?.name || 'My Location') : currentCity.name;

      setLoadingProgress({
        percent: 25,
        message: forceRefresh ? `Live querying Overpass for ${catInfo.label}...` : `Loading ${catInfo.label}...`,
        subMessage: `Searching local features in ${placeName}...`,
      });

      try {
        const newFeatures = await fetchCategorySpecificOSMFeatures(
          lat,
          lon,
          placeName,
          targetCategory,
          locationScope,
          (prog) => setLoadingProgress(prog),
          forceRefresh
        );

        if (newFeatures.length > 0) {
          const curatedCity = CITIES.find((c) => c.id === currentCityId);
          let finalFeatures = [...newFeatures];

          if (curatedCity && curatedCity.features) {
            const curatedMatching =
              targetCategory === 'all'
                ? curatedCity.features
                : curatedCity.features.filter((f) => catInfo.types.includes(f.type));

            const curatedNameSet = new Set(curatedMatching.map((f) => f.name.toLowerCase().trim()));
            const nonDuplicatesFromOSM = newFeatures.filter(
              (f) => !curatedNameSet.has(f.name.toLowerCase().trim())
            );
            finalFeatures = [...curatedMatching, ...nonDuplicatesFromOSM];
          }

          setCityOverpassFeatures((prev) => ({
            ...prev,
            [currentCityId]: finalFeatures,
          }));

          if (currentCityId === 'my_location' && customLocationCity) {
            setCustomLocationCity((prev) => (prev ? { ...prev, features: finalFeatures } : null));
          }

          setSelectedCategory(targetCategory);
          resetGame(currentCityId, gameMode, targetCategory);
          setLocationToast(`🎯 Loaded ${finalFeatures.length} ${catInfo.label} places in ${placeName}!`);
          setTimeout(() => setLocationToast(null), 4000);
        }
      } catch (err) {
        console.error('Error refetching category features:', err);
      } finally {
        setIsLocating(false);
        setLoadingProgress(null);
      }
    },
    [userLocation, currentCity, customLocationCity, currentCityId, locationScope, gameMode, resetGame]
  );

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
      if (gameMode !== 'pinpoint' || isRoundComplete || isGameOver) return;
      sounds.playPinDrop();
      setUserPinnedLocation(latlng);
    },
    [gameMode, isRoundComplete, isGameOver]
  );

  // Current round distance error (for Pinpoint Mode)
  const currentDistanceError = useMemo(() => {
    if (!currentFeature || !userPinnedLocation) return undefined;
    return calculateShortestDistanceToFeature(
      userPinnedLocation,
      currentFeature.center,
      currentFeature.path
    );
  }, [currentFeature, userPinnedLocation]);

  // Confirm guess in Pinpoint Mode
  const handleConfirmPinpoint = () => {
    if (!currentFeature || !userPinnedLocation || isRoundComplete) return;

    const distMeters = calculateShortestDistanceToFeature(
      userPinnedLocation,
      currentFeature.center,
      currentFeature.path
    );
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
      gameMode: 'pinpoint',
      userCoordinates: userPinnedLocation,
      distanceErrorMeters: distMeters,
      accuracyPercentage: scoreResult.accuracyPercentage,
      pointsEarned: scoreResult.score,
      timeSpentMs: timeSpent,
    };

    setRoundResults((prev) => [...prev, result]);
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
      setTimeRoundStarted(Date.now());
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top App Header (Strict Single Line) */}
      <GameHeader
        cities={allCities}
        currentCity={currentCity}
        onSelectCity={handleSelectCity}
        gameMode={gameMode}
        onChangeMode={handleChangeMode}
        selectedCategory={selectedCategory}
        onChangeCategory={handleSelectCategory}
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
      />

      {/* Main Map Viewport & Overlays */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
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
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-slate-900/95 text-slate-100 text-xs sm:text-sm font-medium border border-blue-500/40 shadow-xl shadow-blue-500/10 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none"
          >
            <span>{locationToast}</span>
          </div>
        )}

        {/* Pinpoint Mode Overlay (Prompt + Feedback) */}
        {!isGameOver && gameMode === 'pinpoint' && currentFeature && (
          <PinpointModeOverlay
            currentFeature={currentFeature}
            userPinnedLocation={userPinnedLocation}
            onConfirmGuess={handleConfirmPinpoint}
            isRoundComplete={isRoundComplete}
            distanceErrorMeters={currentDistanceError}
            onNextRound={handleNextRound}
            isLastRound={currentRoundIndex + 1 >= featuresForGame.length}
            unit={unit}
            roundNumber={currentRoundIndex + 1}
            totalRounds={featuresForGame.length}
          />
        )}

        {/* Guess the Name Mode Overlay */}
        {!isGameOver && gameMode === 'guess_name' && currentFeature && (
          <GuessNameModeOverlay
            currentFeature={currentFeature}
            onSelectGuess={handleSelectGuessName}
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
    </div>
  );
}
