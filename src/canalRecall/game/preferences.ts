/**
 * Canal Recall player preferences: parse, defaults, difficulty presets, storage.
 *
 * The setup form, live settings panel and keyboard toggles all used to invent
 * their own reading of `canalRecall.preferences.v1`. Stored values outlive the
 * option lists that produced them, so every union goes through `parseMode` and
 * every boolean through an explicit default rule. The React overlay and
 * `game-route.js` call into this module; it has no `document`.
 */

export {
  ANSWER_MODES,
  CONTROL_MODES,
  parseMode,
  ROUTE_DIFFICULTIES,
  ROUTE_PATTERNS,
  THEME_MODES,
  TRAVEL_MODES,
  VIEW_MODES,
  BUILDING_LOOKS,
  BUILDING_LOOK_LABELS,
  nextBuildingLook,
  isBoat,
  isCar,
  isTransit,
  isPitchedView,
  type AnswerMode,
  type ControlMode,
  type RouteDifficulty,
  type RoutePattern,
  type ThemeMode,
  type TravelMode,
  type ViewMode,
  type BuildingLookMode,
} from './modes.ts';
import {
  ANSWER_MODES,
  CONTROL_MODES,
  parseMode,
  ROUTE_DIFFICULTIES,
  ROUTE_PATTERNS,
  THEME_MODES,
  TRAVEL_MODES,
  VIEW_MODES,
  BUILDING_LOOKS,
  BUILDING_LOOK_LABELS,
  nextBuildingLook,
  type AnswerMode,
  type ControlMode,
  type RouteDifficulty,
  type RoutePattern,
  type ThemeMode,
  type TravelMode,
  type ViewMode,
  type BuildingLookMode,
} from './modes.ts';
export {
  travelProfile,
  usesRoadConstraint,
  usesWaterTest,
  type TravelProfile,
  type LearnedKind,
  type MotionKind,
  type VehicleKind,
} from './travelProfile.ts';
import type { KeyValueStore } from './progressStore.ts';
import {
  DEFAULT_CITY_ID,
  parseCityId,
  type CanalCityId,
} from './cities.ts';

export {
  CANAL_CITIES,
  CANAL_CITY_IDS,
  DEFAULT_CITY_ID,
  cityById,
  extractPath,
  extractUrl,
  parseCityId,
  playableCities,
  type CanalCity,
  type CanalCityId,
} from './cities.ts';

export const PREFERENCES_STORAGE_KEY = 'canalRecall.preferences.v1';
/**
 * v4 (2026-09-29): every saved zoom resets once to the 65% default. At 50%
 * a chase ride opened framing the whole route ("start is way too zoomed out").
 * v3 (2026-09-28): every saved zoom resets once to the 50% default. The Da
 * Costa study choice silently saved 0.8, and the broken pinch saved 0.1 or
 * 1.5, so a chase ride on the web opened far from 50% (user request).
 */
export const ZOOM_DEFAULT_VERSION = 4 as const;
/**
 * Highest pitch the basemap draws (MapLibre's default `maxPitch`); a larger
 * request is clamped to it.
 */
export const MAP_MAX_PITCH = 60;
/**
 * Chase pitch with the tilt slider at its default 0. MapLibre pitch is the
 * camera's angle from straight down: 0 is plan view, 60 the lowest camera.
 * 2026-10-23 (user): "make the angle of chase lower; whatever the minimum in
 * the game is now" was read as pitch 12, flatter than the 14° 2D views, so
 * Chase looked top-down (issue #25). On 2026-10-01 "lower" meant a larger
 * pitch (42° -> 48°), and the lowest camera the game could reach was 60°.
 */
export const CHASE_PITCH_DEGREES = MAP_MAX_PITCH;
/**
 * Degrees of extra pitch the live tilt slider may add or subtract. The range
 * spans exactly what the map can show from Chase (12°..60°): with ±36 around
 * a 12° base, the left half of the slider clamped to 0° and did nothing.
 */
export const CAMERA_TILT_MIN = -48;
export const CAMERA_TILT_MAX = 0;
/** Degrees moved by each keyboard tilt nudge. */
export const CAMERA_TILT_KEY_STEP = 6;
/** Degrees moved by each Shift+[ / Shift+] orbit nudge. */
export const CAMERA_BEARING_KEY_STEP = 15;
/** Pre-v2 default; saved `0.65` without a version flag is migrated to the new default. */
export const LEGACY_ZOOM_DEFAULT = 0.65;

/** Route questions per minute the rider can choose; 0 is off. */
export const ASK_BUDGETS = [1, 2, 3, 5, 0] as const;
export type AskBudget = (typeof ASK_BUDGETS)[number];
/** Mirrors `DEFAULT_MAX_ASKS_PER_MINUTE` in game/questionBudget.ts. */
export const DEFAULT_ASK_BUDGET: AskBudget = 5;

function parseAskBudget(value: unknown, fallback: AskBudget): AskBudget {
  return ASK_BUDGETS.find(budget => budget === value) ?? fallback;
}

export interface DifficultyPreset {
  answerMode: AnswerMode;
  line: boolean;
  arrow: boolean;
  minimap: boolean;
}

export const DIFFICULTY_PRESETS: Record<Exclude<RouteDifficulty, 'custom'>, DifficultyPreset> = {
  easy: { answerMode: 'multiple', line: true, arrow: true, minimap: true },
  medium: { answerMode: 'multiple', line: false, arrow: true, minimap: true },
  hard: { answerMode: 'typing', line: false, arrow: true, minimap: false },
  expert: { answerMode: 'typing', line: false, arrow: false, minimap: false },
};

export interface CanalPreferences {
  cityId: CanalCityId;
  difficulty: RouteDifficulty;
  answerMode: AnswerMode;
  travelMode: TravelMode;
  controlMode: ControlMode;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  /** Wall look for the streamed city: `default` is the stock pattern layer. */
  buildingLook: BuildingLookMode;
  routePattern: RoutePattern;
  homeAddress: string;
  line: boolean;
  arrow: boolean;
  minimap: boolean;
  trees: boolean;
  measuredColoursOnly: boolean;
  detailed3d: boolean;
  googleTiles: boolean;
  reducedMotion: boolean;
  skipMastered: boolean;
  /** Route questions asked per minute while riding; 0 turns them off. */
  maxAsksPerMinute: AskBudget;
  gamey: boolean;
  sound: boolean;
  zoom: number;
  zoomDefaultVersion: typeof ZOOM_DEFAULT_VERSION;
  /**
   * Extra MapLibre pitch (degrees) on top of the view-mode default.
   * The 3D views use this as a live tilt control; 2D modes ignore it.
   */
  cameraTilt: number;
  /** Orbit angle around the vehicle in a 3D view, in degrees. */
  cameraBearing: number;
}

export interface ZoomClamp {
  min: number;
  max: number;
  /** Current `CAMERA_ZOOM_INITIAL`; also the post-migration default. */
  defaultZoom: number;
}

/** Medium difficulty plus the product defaults for everything else. */
export function defaultPreferences(zoom: ZoomClamp): CanalPreferences {
  return {
    cityId: DEFAULT_CITY_ID,
    difficulty: 'medium',
    ...DIFFICULTY_PRESETS.medium,
    // Boat and Chase are the product start (2026-10-22, user's call; cockpit
    // is retired and the setup View row offers the 2D and 3D views).
    travelMode: 'boat',
    controlMode: 'relative',
    viewMode: 'chase',
    themeMode: 'clean',
    buildingLook: 'photo',
    routePattern: 'surprise',
    homeAddress: '',
    trees: true,
    measuredColoursOnly: false,
    detailed3d: false,
    googleTiles: false,
    reducedMotion: false,
    skipMastered: true,
    maxAsksPerMinute: DEFAULT_ASK_BUDGET,
    gamey: true,
    sound: false,
    zoom: zoom.defaultZoom,
    zoomDefaultVersion: ZOOM_DEFAULT_VERSION,
    cameraTilt: 0,
    cameraBearing: 0,
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampZoom(value: number, zoom: ZoomClamp): number {
  return Math.min(zoom.max, Math.max(zoom.min, value));
}

function clampTilt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(CAMERA_TILT_MAX, Math.max(CAMERA_TILT_MIN, value));
}

/**
 * The pitch Chase asks the map for: base plus the clamped tilt, inside what
 * the map can draw. Every tilt in [CAMERA_TILT_MIN, CAMERA_TILT_MAX] gives a
 * different pitch, so the slider never has a dead zone.
 */
export function chasePitch(tilt: unknown): number {
  const value = clampTilt(tilt, 0);
  return Math.max(0, Math.min(MAP_MAX_PITCH, CHASE_PITCH_DEGREES + value));
}

function wrapBearing(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function parseZoom(raw: Record<string, unknown>, zoom: ZoomClamp): number {
  const value = raw.zoom;
  if (typeof value !== 'number' || !Number.isFinite(value)) return zoom.defaultZoom;
  const version = raw.zoomDefaultVersion;
  const migrated = version !== ZOOM_DEFAULT_VERSION ? zoom.defaultZoom : value;
  return clampZoom(migrated, zoom);
}

function fillPreferences(
  source: Record<string, unknown>,
  base: CanalPreferences,
  zoom: ZoomClamp,
): CanalPreferences {
  return {
    ...base,
    cityId: parseCityId(source.cityId, base.cityId),
    answerMode: parseMode(ANSWER_MODES, source.answerMode, base.answerMode),
    travelMode: parseMode(TRAVEL_MODES, source.travelMode, base.travelMode),
    controlMode: parseMode(CONTROL_MODES, source.controlMode, base.controlMode),
    viewMode: parseMode(VIEW_MODES, source.viewMode, base.viewMode),
    // Map style, Detailed 3D and Photoreal were retired from settings
    // (2026-09-28); a value stored before then is ignored.
    themeMode: base.themeMode,
    buildingLook: parseMode(BUILDING_LOOKS, source.buildingLook, base.buildingLook),
    routePattern: parseMode(ROUTE_PATTERNS, source.routePattern, base.routePattern),
    homeAddress: typeof source.homeAddress === 'string' ? source.homeAddress : base.homeAddress,
    line: parseBoolean(source.line, base.line),
    arrow: parseBoolean(source.arrow, base.arrow),
    minimap: parseBoolean(source.minimap, base.minimap),
    trees: parseBoolean(source.trees, base.trees),
    measuredColoursOnly: parseBoolean(source.measuredColoursOnly, base.measuredColoursOnly),
    detailed3d: base.detailed3d,
    googleTiles: base.googleTiles,
    reducedMotion: parseBoolean(source.reducedMotion, base.reducedMotion),
    skipMastered: parseBoolean(source.skipMastered, base.skipMastered),
    maxAsksPerMinute: parseAskBudget(source.maxAsksPerMinute, base.maxAsksPerMinute),
    gamey: parseBoolean(source.gamey, base.gamey),
    sound: false, // sound is permanently disabled
    zoom: parseZoom(source, zoom),
    zoomDefaultVersion: ZOOM_DEFAULT_VERSION,
    cameraTilt: clampTilt(source.cameraTilt, base.cameraTilt),
    cameraBearing: wrapBearing(source.cameraBearing, base.cameraBearing),
  };
}

/**
 * Turn a stored blob into a complete preferences object. Named difficulties
 * re-expand their assist preset, then any saved field overlays that — so an
 * old save that only stored `difficulty: "easy"` still gets the route line.
 */
export function parsePreferences(raw: unknown, zoom: ZoomClamp): CanalPreferences {
  const source = asRecord(raw);
  const base = defaultPreferences(zoom);
  const difficulty = parseMode(ROUTE_DIFFICULTIES, source.difficulty, base.difficulty);
  const withDifficulty: CanalPreferences = difficulty === 'custom'
    ? { ...base, difficulty }
    : { ...base, difficulty, ...DIFFICULTY_PRESETS[difficulty] };
  // A save from before 2026-10-01 may hold the retired 'study' pattern;
  // parseMode rejects it and the default pattern applies.
  return fillPreferences(source, withDifficulty, zoom);
}

/**
 * Validate a live form/runtime snapshot without re-applying difficulty
 * presets. Save must keep whatever the player currently has on the controls.
 */
export function coercePreferences(raw: unknown, zoom: ZoomClamp): CanalPreferences {
  const source = asRecord(raw);
  const base = defaultPreferences(zoom);
  const difficulty = parseMode(ROUTE_DIFFICULTIES, source.difficulty, base.difficulty);
  return fillPreferences(source, { ...base, difficulty }, zoom);
}

export function readPreferences(store: KeyValueStore, zoom: ZoomClamp): CanalPreferences {
  try {
    const raw = store.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return defaultPreferences(zoom);
    return parsePreferences(JSON.parse(raw), zoom);
  } catch {
    return defaultPreferences(zoom);
  }
}

export function writePreferences(store: KeyValueStore, prefs: CanalPreferences): void {
  try {
    store.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
      ...prefs,
      zoomDefaultVersion: ZOOM_DEFAULT_VERSION,
    }));
  } catch {
    /* private mode */
  }
}

/** Remove stored preferences and return a fresh default snapshot for the UI. */
export function clearPreferences(store: KeyValueStore, zoom: ZoomClamp): CanalPreferences {
  try {
    if (store.removeItem) store.removeItem(PREFERENCES_STORAGE_KEY);
    else store.setItem(PREFERENCES_STORAGE_KEY, '');
  } catch {
    /* private mode */
  }
  return defaultPreferences(zoom);
}

/** Overlay a named difficulty onto a preferences object. `custom` is a no-op. */
export function applyDifficulty(
  prefs: CanalPreferences,
  level: RouteDifficulty,
): CanalPreferences {
  if (level === 'custom') return { ...prefs, difficulty: 'custom' };
  const preset = DIFFICULTY_PRESETS[level];
  return { ...prefs, difficulty: level, ...preset };
}

const ASSIST_KEYS = ['answerMode', 'line', 'arrow', 'minimap'] as const;

/**
 * Apply a form or live-settings patch. Choosing a named difficulty expands its
 * preset; changing an assist while a named difficulty is selected flips to custom.
 */
export function patchLivePreferences(
  current: CanalPreferences,
  patch: Partial<CanalPreferences>,
  zoom: ZoomClamp,
): CanalPreferences {
  if (patch.difficulty && patch.difficulty !== 'custom') {
    return coercePreferences({
      ...applyDifficulty(current, patch.difficulty),
      ...patch,
      difficulty: patch.difficulty,
    }, zoom);
  }
  const next: CanalPreferences = { ...current, ...patch };
  const assistChanged = ASSIST_KEYS.some(key => key in patch && patch[key] !== current[key]);
  if (assistChanged && next.difficulty !== 'custom') next.difficulty = 'custom';
  return coercePreferences(next, zoom);
}
