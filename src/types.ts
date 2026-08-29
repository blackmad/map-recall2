export type GameMode = 'pinpoint' | 'guess_name' | 'guess_neighborhood';

export type LocationScope = 'neighborhood' | 'city' | 'region';

export interface LoadingProgress {
  percent: number;
  message: string;
  subMessage?: string;
}

export type FeatureType =
  | 'street'
  | 'boulevard'
  | 'avenue'
  | 'square'
  | 'landmark'
  | 'bridge'
  | 'park'
  | 'canal'
  | 'water'
  | 'museum'
  | 'monument'
  | 'neighborhood';

export type FeatureCategory =
  | 'all'
  | 'water'      // canals, rivers, waterways ('canal', 'water')
  | 'streets'    // streets, avenues, boulevards ('street', 'avenue', 'boulevard')
  | 'bridges'    // bridges ('bridge')
  | 'squares'    // squares, plazas ('square')
  | 'parks'      // parks, gardens ('park')
  | 'landmarks';  // monuments, museums, landmarks ('landmark', 'museum', 'monument')

export interface CategoryInfo {
  id: FeatureCategory;
  label: string;
  shortLabel: string;
  icon: string;
  types: FeatureType[];
  description: string;
}

export const FEATURE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'all',
    label: 'All Features',
    shortLabel: 'All Types',
    icon: '◎',
    types: ['street', 'avenue', 'boulevard', 'square', 'landmark', 'bridge', 'park', 'canal', 'water', 'museum', 'monument'],
    description: 'A rich mix of streets, waterways, bridges, squares & landmarks',
  },
  {
    id: 'water',
    label: 'Canals & Waterways',
    shortLabel: 'Canals & Water',
    icon: '≈',
    types: ['canal', 'water'],
    description: 'Historic canals, rivers, and water bodies (e.g., Amsterdam Canals)',
  },
  {
    id: 'streets',
    label: 'Streets & Avenues',
    shortLabel: 'Streets',
    icon: '╱',
    types: ['street', 'avenue', 'boulevard'],
    description: 'Famous streets, avenues, boulevards & pedestrian paths',
  },
  {
    id: 'bridges',
    label: 'Bridges & Crossings',
    shortLabel: 'Bridges',
    icon: '⌁',
    types: ['bridge'],
    description: 'Iconic bridges and historic river crossings',
  },
  {
    id: 'squares',
    label: 'Squares & Piazzas',
    shortLabel: 'Squares',
    icon: '□',
    types: ['square'],
    description: 'Historic city squares, plazas & civic meeting grounds',
  },
  {
    id: 'parks',
    label: 'Parks & Greenways',
    shortLabel: 'Parks',
    icon: '♧',
    types: ['park'],
    description: 'Prominent city parks, botanical gardens & urban greenways',
  },
  {
    id: 'landmarks',
    label: 'Landmarks & Museums',
    shortLabel: 'Landmarks',
    icon: '◆',
    types: ['landmark', 'museum', 'monument'],
    description: 'Famous monuments, museums & cultural attractions',
  },
];

export type TileStyle = 'voyager' | 'light_nolabels' | 'osm' | 'dark';

export type DistanceUnit = 'metric' | 'imperial';

export interface SearchBoundary {
  center: [number, number];
  radiusMeters: number;
  label: string;
  scope: LocationScope;
  category?: FeatureCategory;
  bounds?: [[number, number], [number, number]];
  geometry?: [number, number][][][];
}

export interface AdministrativeArea {
  id: number;
  name: string;
  adminLevel: number;
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
  kind?: string;
  geometry?: [number, number][][][];
}

export interface SearchHistoryEntry {
  id: string;
  timestamp: number;
  placeName: string;
  lat: number;
  lon: number;
  scope: LocationScope;
  category: FeatureCategory;
  radiusMeters: number;
  status: 'success' | 'cache_hit' | 'fallback' | 'error';
  featuresCount: number;
  endpointUsed?: string;
  executionTimeMs?: number;
  overpassQuery: string;
  errorMessage?: string;
}

export interface StreetFeature {
  id: string;
  name: string;
  type: FeatureType;
  cityId: string;
  center: [number, number]; // [lat, lng]
  path?: [number, number][]; // coordinates for single continuous polyline
  paths?: [number, number][][]; // multiple disconnected polylines for segmented streets/waterways
  radius?: number; // approximate radius in meters for point features / squares
  funFact: string;
  clues: string[];
  distractors: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  wikidata?: string;
  wikipedia?: string;
  prominenceScore?: number;
  wikipediaPageviews60d?: number;
  wikidataSitelinks?: number;
  encyclopediaScore?: number;
  wikipediaExtract?: string;
  wikipediaUrl?: string;
  wikipediaImageUrl?: string;
  highway?: string;
  neighborhood?: string;
  neighborhoodDistractors?: string[];
  areaGeometry?: [number, number][][][];
}

export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  center: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  description: string;
  features: StreetFeature[];
}

export interface RoundResult {
  roundNumber: number;
  feature: StreetFeature;
  gameMode: GameMode;
  userCoordinates?: [number, number]; // for pinpoint mode
  distanceErrorMeters?: number; // in meters
  accuracyPercentage?: number; // 0 - 100%
  userSelectedName?: string; // for guess_name mode
  isCorrect?: boolean; // for guess_name mode
  pointsEarned: number;
  timeSpentMs: number;
}

export interface GameState {
  currentCityId: string;
  gameMode: GameMode;
  selectedCategory: FeatureCategory;
  roundsPerGame: number;
  currentRoundIndex: number;
  featuresForGame: StreetFeature[];
  roundResults: RoundResult[];
  totalScore: number;
  isRoundActive: boolean;
  isRoundComplete: boolean;
  isGameOver: boolean;
  selectedGuessName: string | null;
  userPinnedLocation: [number, number] | null;
  blindMapMode: boolean; // Hide street name labels on tiles
  tileStyle: TileStyle;
  unit: DistanceUnit;
  timeStartedRound: number;
}
