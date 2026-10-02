// The closed sets the game actually has. Each of these was a bare `string`
// while the runtime was JavaScript, which is how "boat"/"car" could be compared
// against a typo forever without anything noticing.
//
// The value lists are the single source of truth for both the type and the
// runtime parse, and they match the `<option value>` sets in `index.html` —
// every one of these arrives from a `<select>`, so the page and these unions
// must agree or a preference silently stops applying.

export const TRAVEL_MODES = ['boat', 'car', 'transit'] as const;
export type TravelMode = typeof TRAVEL_MODES[number];

export const ANSWER_MODES = ['multiple', 'typing'] as const;
export type AnswerMode = typeof ANSWER_MODES[number];

export const CONTROL_MODES = ['relative', 'absolute'] as const;
export type ControlMode = typeof CONTROL_MODES[number];

export const VIEW_MODES = ['north', 'heading', 'chase', 'cockpit'] as const;
export type ViewMode = typeof VIEW_MODES[number];

// Photo is the default; Untextured is the plain, cheapest look. The old MapLibre pattern layer
// ('default') is no longer offered (user request 2026-10-02); a saved 'default' reads as Photo.
export const BUILDING_LOOKS = ['photo', 'procedural', 'storybook', 'cartoon', 'untextured'] as const;
export type BuildingLookMode = typeof BUILDING_LOOKS[number];

/** Names as the settings panel shows them. */
export const BUILDING_LOOK_LABELS: Record<BuildingLookMode, string> = {
  photo: 'Photo', procedural: 'Painted', storybook: 'Storybook', cartoon: 'Cartoon', untextured: 'Untextured',
};

/** The look after `current` in settings order, wrapping round; anything unknown starts again at Photo. */
export function nextBuildingLook(current: string | null | undefined): BuildingLookMode {
  const index = BUILDING_LOOKS.indexOf(current as BuildingLookMode);
  return BUILDING_LOOKS[(index + 1) % BUILDING_LOOKS.length];
}

export const THEME_MODES = ['clean', '8bit', '16bit', 'psx', 'cyberpunk'] as const;
export type ThemeMode = typeof THEME_MODES[number];

export const ROUTE_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'custom'] as const;
export type RouteDifficulty = typeof ROUTE_DIFFICULTIES[number];

export const ROUTE_PATTERNS = ['surprise', 'home', 'here'] as const;
export type RoutePattern = typeof ROUTE_PATTERNS[number];

/** Which leg of a there-and-back home route is being driven. */
export const HOME_LEGS = ['outbound', 'return'] as const;
export type HomeLeg = typeof HOME_LEGS[number];

/** What a recall question is asking about. Drives the chip at the top of the
 *  prompt card. */
export const QUIZ_SUBJECT_NAMES = ['street', 'waterway', 'water', 'bridge', 'line', 'stop'] as const;
export type QuizSubject = typeof QUIZ_SUBJECT_NAMES[number];

/** Why a recall question was opened. `route` is the way under the vehicle;
 *  the other two belong to a bridge crossing and are filed against the
 *  crossing rather than against wherever the vehicle rolled to a stop. */
export const QUIZ_PROMPT_KINDS = ['route', 'crossing-water', 'bridge'] as const;
export type QuizPromptKind = typeof QUIZ_PROMPT_KINDS[number];

/**
 * Read one of these unions off a value that came from the page — a `<select>`,
 * a saved preference, or a share link — falling back rather than trusting it.
 * Stored preferences outlive the option lists that produced them, so a
 * removed or renamed mode must degrade to a working default instead of putting
 * an unhandled string into game state.
 */
export function parseMode<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : fallback;
}

/** Amsterdam street mode is cycling in the presentation, even while it reuses
 *  the proven road-routing physics internally. Transit is neither. */
export function isCar(mode: TravelMode): boolean {
  return mode === 'car';
}

export function isTransit(mode: TravelMode): boolean {
  return mode === 'transit';
}

export function isBoat(mode: TravelMode): boolean {
  return mode === 'boat';
}
