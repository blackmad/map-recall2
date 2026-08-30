// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const GAME_VERSION = 'canal-prototype-0.1';

// --- Movie Quotes (Smokey and the Bandit, 1977) ---
const BANDIT_QUOTES = [
  { text: "What we're dealing with here is a complete lack of respect for the law.", character: 'Sheriff Buford T. Justice' },
  { text: "For the money, for the glory, and for the fun. Mostly for the money.", character: 'Bandit' },
  { text: "Give me a diablo sandwich, a Dr. Pepper, and make it quick, I'm in a hurry.", character: 'Sheriff Buford T. Justice' },
  { text: "There is no way, no way, that you could come from my loins.", character: 'Sheriff Buford T. Justice' },
  { text: "You must be part coon dog, 'cause you make 'em all look like slow motion.", character: 'Bandit' },
  { text: "Nobody makes Sheriff Buford T. Justice look like a possum's pecker!", character: 'Sheriff Buford T. Justice' },
  { text: "I'm not givin' up! I'm never gonna give up!", character: 'Sheriff Buford T. Justice' },
  { text: "When you tell somebody somethin', it depends on what part of the country you're standin' in.", character: 'Bandit' },
  { text: "You can think about it... but don't do it.", character: 'Bandit' },
  { text: "The goddamn Germans got nothin' to do with it.", character: 'Sheriff Buford T. Justice' },
  { text: "My hat blew off, daddy.", character: 'Junior' },
  { text: "I hope your goddamn head was in it.", character: 'Sheriff Buford T. Justice' },
  { text: "You sumbitches couldn't close an umbrella!", character: 'Sheriff Buford T. Justice' },
  { text: "Hold my hat.", character: 'Sheriff Buford T. Justice' },
  { text: "What do you think they do for excitement in this town? Sit around and watch the cars rust.", character: 'Bandit' },
];

// --- Display ---
const CANVAS_W = 1280, CANVAS_H = 720;        // pixels

// --- Legacy (circuit mode — retained for compatibility) ---
const TOTAL_LAPS = 3;
const TRACK_SAMPLES = 1500;
const TRACK_MODE_CIRCUIT = 'circuit';
const TRACK_MODE_POINT_TO_POINT = 'point-to-point';

// --- Limits ---
const MAX_PARTICLES = 250;
const MAX_SKIDMARKS = 600;
const GRID_CELL = 200;                         // px — collision grid cell size

// --- Car Physics ---
const CAR_WIDTH = 24;                          // px — car width
const CAR_LENGTH = 56;                         // px — car length
const CAR_MAX_SPEED = 205;                     // px/s — fast arcade boat pace
const CAR_ACCEL = 98;                          // px/s² — reach the higher cap promptly
const CAR_BRAKE_FORCE = 75;                    // px/s² / reverse thrust
const CAR_TURN_RATE = 1.45;                    // rad/s
const PLAYER_CAR_TURN_MULT = 1.45;             // tighter street-mode steering
const PLAYER_CAR_DRIFT_FACTOR = 0.12;          // asphalt: the car holds its line
const PLAYER_CAR_SPEED_MULT = 1.35;            // streets are quicker than canals
const PLAYER_CAR_ACCEL_MULT = 1.4;             // and get up to speed sooner
const CAR_MIN_STEER_FACTOR = 0.7;              // steering authority at a standstill
// Stop nearly on a dime so a junction can be taken late. Toy physics: the
// brake is stronger than the engine, and lifting off scrubs speed hard.
const PLAYER_CAR_BRAKE_MULT = 5.5;
const PLAYER_CAR_LIFT_OFF_BRAKING = 6.5;       // 1/s — coasting decays speed this fast
const CAR_GRIP = 1.0;                          // multiplier (1.0 = full grip)
const CAR_DRIFT_FACTOR = 0.84;                 // lateral water slide retention
const CAR_DRAG = 0.0024;                       // quadratic water drag
const CAR_ROLLING_RESIST = 0.12;
const CAR_REVERSE_MAX = -30;
const SPEED_FACTOR_DIVISOR = 16;
const TURN_REDUCTION_AT_SPEED = 0.3;
const HANDBRAKE_TURN_MULT = 1.6;               // steering multiplier during handbrake
const HANDBRAKE_DRIFT = 0.96;                  // grip multiplier during handbrake
const DRIFT_THRESHOLD = 25;                    // lateral speed for isDrifting flag

// --- Surface Physics ---
const CURB_GRIP = 0.85;                        // grip multiplier on curbs
const CURB_DRAG = 10;                          // px/s² drag on curbs
const GRASS_GRIP = 0.45;                       // grip multiplier on grass
const GRASS_DRAG = 80;                         // px/s² drag on grass


// --- Camera ---
const CAMERA_SMOOTHING = 0.07;                 // exponential smoothing (0 = snap, 1 = frozen)
const CAMERA_ZOOM_INITIAL = 0.50;
const CAMERA_ZOOM_MIN = 0.2;
const CAMERA_ZOOM_MAX = 1.5;
const CAMERA_ZOOM_STEP = 0.15;                 // per key press
const CAMERA_LOOKAHEAD = 60;                   // px — camera leads player by this much
// The lookahead used to track speed instantly, so the view surged forward on
// every acceleration and fell back on every brake. Easing it removes the pump.
const CAMERA_LOOKAHEAD_SMOOTHING = 0.02;
const CAMERA_ROTATION_SMOOTHING = 0.9;         // multiple of camera smoothing
const CAMERA_REDUCED_ROTATION_SMOOTHING = 0.45;

// --- Game ---
const COUNTDOWN_TIME = 3.5;                    // seconds
const OFF_ROAD_CORRECTION = 0.08;              // rad — angle correction per frame
const COLLISION_PUSH_FACTOR = 0.4;             // push strength multiplier
const COLLISION_PUSH_MAX = 20;                 // px — max push per frame
const COLLISION_SPEED_DECAY = 0.93;            // speed multiplier on grass collision
const OFF_ROAD_PUSH_SPEED = 1.5;              // px — curb correction push
const OFF_ROAD_SPEED_DECAY = 0.98;             // speed multiplier on curb
const CAR_ROAD_EDGE_TOLERANCE = 12;            // px beyond mapped road width before rollback
const MIN_START_FINISH_DIST = 200;             // px — minimum distance between start and finish
const MAX_SNAP_DIST = 800;                     // px — POIs may sit a short walk from the water
const HOME_MAX_SNAP_DIST = 240;                // px (~80 m) — never teleport a home launch across the neighborhood
const LEADERBOARD_MAX_ENTRIES = 50;             // max stored best times (LRU eviction)
const LEADERBOARD_STORAGE_KEY = 'satb_bestTimes'; // localStorage key
const EXPLORATION_STORAGE_KEY = 'canalRecall.exploration.v1';

// --- Particles ---
const SKID_FADE_RATE = 0.08;                   // alpha/s
const PARTICLE_DRAG = 0.97;                    // velocity multiplier per frame

// --- Rendering ---
const MAX_CANVAS_DIM = 10000;                  // px — cap off-screen canvas size
const GRASS_STRIPE_HEIGHT = 40;                // px
const CURB_SEGMENT_STEP = 8;                   // points per curb stripe
const CURB_VISUAL_WIDTH = 8;                   // px
const TILE_OPACITY = 0.7;                      // OSM background tile transparency

// --- Sound ---
const ENGINE_BASE_FREQ = 80;                   // Hz — idle engine frequency
const ENGINE_FILTER_FREQ = 400;                // Hz — lowpass cutoff
const ENGINE_RPM_BASE = 800;                   // RPM at idle
const ENGINE_RPM_RANGE = 4500;                 // RPM added at full speed

// --- Network / OSM ---
const OSM_FETCH_TIMEOUT = 45000;               // ms
const TILE_FETCH_TIMEOUT = 15000;              // ms
const MAX_TILES = 250;
const OSM_FETCH_RADIUS = 5000;                 // meters — area fetched around selected point
const PIXELS_PER_METER = 3;                    // world scale
const SIMPLIFICATION_TOLERANCE = 0.00003;      // degrees (~3m) — Douglas-Peucker tolerance
const ROAD_GRID_CELL = 100;                    // px — spatial grid cell size for road queries
// px (~3 m) — how far a way's endpoint may sit from another centreline and
// still count as a junction. Matched to the 3 m Douglas-Peucker tolerance the
// extract builder uses, which is what displaces these endpoints in the first place.
const JUNCTION_STITCH_RADIUS = 10;
// Seconds between bridge questions. Amsterdam has a bridge every hundred
// metres; asking about each one buries the street recall the route is there to
// teach, so crossings stay an occasional highlight.
const BRIDGE_QUIZ_COOLDOWN = 90;
// "Brug 117" is a municipal asset number rather than a name anyone learns.
const GENERIC_BRIDGE_NAME = /^\s*(brug\s*)?\d+\s*$/i;
// px — a learned-bridge label closer than this to the vehicle is hidden, and
// it fades in over the same distance again.
const BRIDGE_LABEL_CLEARANCE = 70;
// Which mapped areas count as a neighborhood, finest first. A point inside De
// Pijp should be reported as De Pijp rather than as Zuid, and the districts
// exist so that the rest of the city is not simply nameless.
const NEIGHBORHOOD_KIND_RANK = {
  city_block: 5, neighbourhood: 4, neighborhood: 4, quarter: 3, locality: 2, suburb: 1,
};
const NEIGHBORHOOD_NOTICE_SECONDS = 5.5;   // how long a postcard stays up
const NEIGHBORHOOD_NOTICE_GRACE = 1.5;     // seconds before the first one can fire
// ms the answer card stays up after an answer. A correction has a name in it
// that the player has just proved they do not know, so it lingers.
const ANSWER_HOLD_CORRECT = 900;
const ANSWER_HOLD_WRONG = 3200;
// Seconds on a new street before its question opens — long enough that
// clipping a corner of a side street does not count as a turn.
const QUIZ_CANDIDATE_DELAY = 0.65;
// Shorter for a name already revealed: coming back to it is a quick check.
const QUIZ_RETEST_DELAY = 0.3;
// Start fetching a landmark photo while it is still ahead. The trivia card
// opens at 300 px, which is a second or two of driving — not enough to fetch an
// image, so the card would open text-only and then reflow taller underneath the
// player as the photo landed.
const LANDMARK_IMAGE_PREFETCH_RADIUS = 900;   // ~300 m at the current world scale

// The chip at the top of a recall prompt: what kind of thing the answer is.
// `kind` also picks the chip's colour in the stylesheet.
// Street/water use Lucide's ISC-licensed Route/Waves SVGs. Bridge uses Font
// Awesome Free's CC BY 4.0 bridge glyph; attribution lives in NOTICE.md.
const QUIZ_ICONS = {
  street: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
  water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
  bridge: '<svg class="filled" viewBox="0 0 576 512" aria-hidden="true"><path d="M32 32C14.3 32 0 46.3 0 64S14.3 96 32 96h40v64H0v128c53 0 96 43 96 96v64c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32v-64c0-53 43-96 96-96s96 43 96 96v64c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32v-64c0-53 43-96 96-96V160h-72V96h40c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zm424 64v64h-80V96h80zm-128 0v64h-80V96h80zm-128 0v64h-80V96h80z"/></svg>',
};
const QUIZ_SUBJECTS = {
  street:   { kind: 'street', icon: QUIZ_ICONS.street, label: 'Street',   placeholder: 'Street name' },
  waterway: { kind: 'water',  icon: QUIZ_ICONS.water,  label: 'Waterway', placeholder: 'Waterway name' },
  water:    { kind: 'water',  icon: QUIZ_ICONS.water,  label: 'Water',    placeholder: 'Canal or river name' },
  bridge:   { kind: 'bridge', icon: QUIZ_ICONS.bridge, label: 'Bridge',   placeholder: 'Bridge name' },
};
// Degrees of tilt in the 2D views. Enough for buildings to show a face and for
// the city to read as a city; not enough to lose the plan-view legibility the
// map quiz depends on.
const TOPDOWN_TILT_DEGREES = 14;
const FINISH_RADIUS = 80;                      // px — proximity to finish point to complete race

// --- Road Widths (px) ---
const ROAD_WIDTHS = {
  canal: 32,
  river: 46,
  dock: 50,
  motorway: 55, motorway_link: 45,
  trunk: 50, trunk_link: 40,
  primary: 45, primary_link: 35,
  secondary: 40, secondary_link: 32,
  tertiary: 35, tertiary_link: 28,
  residential: 30,
  unclassified: 28
};
const DEFAULT_ROAD_WIDTH = 32;

// --- Colors ---
const COLORS = {
  player: '#FFD700',
  ai: ['#E53935', '#1E88E5', '#43A047', '#8E24AA'],
  grass: '#d9d2c3',
  grassDark: '#d2c9b7',
  road: '#087ca7',
  roadLight: '#1597c5',
  curb1: '#E53935',
  curb2: '#FFFFFF',
  line: '#FFFFFF',
  startFinish: '#FFFFFF'
};

// Road surface colors by type (main roads slightly lighter to stand out)
const ROAD_COLORS = {
  canal: { fill: '#087ca7', light: '#1597c5' },
  river: { fill: '#066b91', light: '#128ab8' },
  dock: { fill: '#075f83', light: '#107ba4' },
  motorway: { fill: '#4A4A4A', light: '#555555' },
  motorway_link: { fill: '#484848', light: '#535353' },
  trunk: { fill: '#474747', light: '#525252' },
  trunk_link: { fill: '#454545', light: '#505050' },
  primary: { fill: '#434343', light: '#4E4E4E' },
  primary_link: { fill: '#414141', light: '#4C4C4C' },
  secondary: { fill: '#3F3F3F', light: '#4A4A4A' },
  secondary_link: { fill: '#3E3E3E', light: '#494949' },
  tertiary: { fill: '#3C3C3C', light: '#474747' },
  tertiary_link: { fill: '#3B3B3B', light: '#464646' },
  residential: { fill: '#383838', light: '#434343' },
  unclassified: { fill: '#363636', light: '#414141' }
};
