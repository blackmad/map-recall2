/**
 * Canal Recall player preferences: parse, defaults, difficulty presets, storage.
 *
 * The setup form, live settings panel and keyboard toggles all used to invent
 * their own reading of `canalRecall.preferences.v1`. Stored values outlive the
 * option lists that produced them, so every union goes through `parseMode` and
 * every boolean through an explicit default rule. The React overlay and
 * `game-route.js` call into this module; it has no `document`.
 */

import {
  ANSWER_MODES,
  CONTROL_MODES,
  parseMode,
  ROUTE_DIFFICULTIES,
  ROUTE_PATTERNS,
  THEME_MODES,
  TRAVEL_MODES,
  VIEW_MODES,
  type AnswerMode,
  type ControlMode,
  type RouteDifficulty,
  type RoutePattern,
  type ThemeMode,
  type TravelMode,
  type ViewMode,
} from './modes.ts';
import type { KeyValueStore } from './progressStore.ts';
import {
  BIKE_SKIN_IDS,
  DEFAULT_BIKE_SKIN,
  parseBikeSkin,
  type BikeSkinId,
} from './bikeSkins.ts';
import {
  DEFAULT_CITY_ID,
  parseCityId,
  type CanalCityId,
} from './cities.ts';

export {
  BIKE_SKIN_IDS,
  BIKE_SKINS,
  DEFAULT_BIKE_SKIN,
  bikeSkinById,
  parseBikeSkin,
  type BikeSkin,
  type BikeSkinId,
} from './bikeSkins.ts';

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
export const ZOOM_DEFAULT_VERSION = 2 as const;
/** Pre-v2 default; saved `0.65` without a version flag is migrated to the new default. */
export const LEGACY_ZOOM_DEFAULT = 0.65;

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
  routePattern: RoutePattern;
  homeAddress: string;
  line: boolean;
  arrow: boolean;
  minimap: boolean;
  trees: boolean;
  detailed3d: boolean;
  googleTiles: boolean;
  reducedMotion: boolean;
  skipMastered: boolean;
  gamey: boolean;
  sound: boolean;
  bikeSkin: BikeSkinId;
  /** Show rear child seat when the active skin has a `BabySeat` node. */
  bikeBabySeat: boolean;
  zoom: number;
  zoomDefaultVersion: typeof ZOOM_DEFAULT_VERSION;
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
    travelMode: 'boat',
    controlMode: 'relative',
    viewMode: 'north',
    themeMode: 'clean',
    routePattern: 'surprise',
    homeAddress: '',
    trees: true,
    detailed3d: false,
    googleTiles: false,
    reducedMotion: false,
    skipMastered: true,
    gamey: true,
    sound: false,
    bikeSkin: DEFAULT_BIKE_SKIN,
    bikeBabySeat: false,
    zoom: zoom.defaultZoom,
    zoomDefaultVersion: ZOOM_DEFAULT_VERSION,
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

function parseZoom(raw: Record<string, unknown>, zoom: ZoomClamp): number {
  const value = raw.zoom;
  if (typeof value !== 'number' || !Number.isFinite(value)) return zoom.defaultZoom;
  const version = raw.zoomDefaultVersion;
  const migrated = version !== ZOOM_DEFAULT_VERSION && value === LEGACY_ZOOM_DEFAULT
    ? zoom.defaultZoom
    : value;
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
    themeMode: parseMode(THEME_MODES, source.themeMode, base.themeMode),
    routePattern: parseMode(ROUTE_PATTERNS, source.routePattern, base.routePattern),
    homeAddress: typeof source.homeAddress === 'string' ? source.homeAddress : base.homeAddress,
    line: parseBoolean(source.line, base.line),
    arrow: parseBoolean(source.arrow, base.arrow),
    minimap: parseBoolean(source.minimap, base.minimap),
    trees: parseBoolean(source.trees, base.trees),
    detailed3d: parseBoolean(source.detailed3d, base.detailed3d),
    googleTiles: parseBoolean(source.googleTiles, base.googleTiles),
    reducedMotion: parseBoolean(source.reducedMotion, base.reducedMotion),
    skipMastered: parseBoolean(source.skipMastered, base.skipMastered),
    gamey: parseBoolean(source.gamey, base.gamey),
    sound: parseBoolean(source.sound, base.sound),
    bikeSkin: parseBikeSkin(source.bikeSkin, base.bikeSkin),
    bikeBabySeat: parseBoolean(source.bikeBabySeat, base.bikeBabySeat),
    zoom: parseZoom(source, zoom),
    zoomDefaultVersion: ZOOM_DEFAULT_VERSION,
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
