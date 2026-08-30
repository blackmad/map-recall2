// The Game instance as its runtime subsystems see it.
//
// Each subsystem is authored as a standalone class whose methods are copied
// onto `Game.prototype` at load, so `this` inside them is the Game instance,
// not the subsystem. Declaration-merging each subsystem class with the host
// interface it needs is what gives those methods a typed `this` without
// pretending the legacy constructor is itself typed.
//
// Split by subsystem rather than kept as one giant interface, so a module
// declares the state it actually touches and the compiler can say when a
// subsystem starts reaching into a neighbour's state.

import type { Camera, InputManager, OsmLoader, Renderer, Track, VectorMap } from './collaborators';
import type { StreetKnowledgeEntry } from './extracts';
import type {
  AnswerMode, QuizPromptKind, RouteDifficulty, TravelMode,
} from './modes';
import type { AnswerRecallStore } from '../answerPath';
import type { RecallFeature } from '../recallStore';
import type { LatLon } from './recallRules';

export type { RecallFeature };
import type { Bridge, BridgeCrossing, Landmark, LandmarkNotice, Neighborhood, WorldPoint } from './worldTypes';

/** The player's boat or car. */
export interface Vehicle extends WorldPoint {
  angle: number;
  speed: number;
  vx: number;
  vy: number;
}

/** Construction, canvas and per-frame state that every subsystem uses. */
export interface GameCoreHost {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  renderer: Renderer;
  input: InputManager;
  vectorMap: VectorMap;
  osmLoader: OsmLoader;

  player: Vehicle | null;
  raceTime: number;
  currentNeighborhood: string;
  travelMode: TravelMode;

  /** Non-empty while a recall question is open. The HUD must not cover it, and
   *  nothing may reveal a name while it is up. */
  quizPromptName: string;
  /** True while a settings or debug panel is open over the canvas. */
  _utilityOpen: boolean;
  _zoomBadgeTimer: number;

  /** Owned by the recall subsystem; landmarks needs it to join street names to
   *  the knowledge extract by the same normalisation the quiz uses. */
  _normaliseCanalName(value: string): string;
}

/** Landmarks, neighborhood postcards and the encyclopedia cards. */
export interface LandmarkHost extends GameCoreHost {
  landmarks: Landmark[];
  neighborhoods: Neighborhood[];
  bridges: Bridge[];
  streetKnowledge: Map<string, StreetKnowledgeEntry>;

  _landmarkNotice: LandmarkNotice | null;
  _landmarkNoticeTimer: number;
  _landmarkNoticeDuration: number;
  _landmarkImages: Map<string, HTMLImageElement>;
  _landmarkImageRequests: Set<string>;
  /** Landmarks whose English summary has already been requested this session,
   *  so a failed fetch is not retried every frame. */
  _summaryRequests?: Set<string>;
  _seenLandmarks: Set<string>;
  _seenLandmarkNames: Set<string>;

  _neighborhoodNotice: { name: string; kind?: string; imageArea?: string } | null;
  _neighborhoodNoticeTimer: number;
  _neighborhoodCandidate: string;
  _neighborhoodCandidateTimer: number;
  _previousNeighborhood: string;
  _visitedNeighborhoods: Set<string>;
  _neighborhoodImages: Map<string, HTMLImageElement>;
  _neighborhoodLetterArt: Map<string, unknown>;
  _neighborhoodImageRequests: Set<string>;
}

/** The bundled spaced-repetition store, shared with the main Map Recall app so
 *  progress is one body of knowledge rather than two. `AnswerRecallStore` is
 *  the slice `answerPath` files answers through; this adds what the game needs
 *  to ask *whether* to pose a question at all. */
export interface RecallStore extends AnswerRecallStore {
  enabled: boolean;
  readonly available: boolean;
  readonly signedIn: boolean;
  readonly masteredCount: number;
  init(): Promise<unknown>;
  signIn(): Promise<unknown>;
  signOut(): Promise<unknown>;
  onUserChange(listener: (user: { label: string } | null) => void): void;
  knownPlaces(): Array<{ name: string; center: LatLon }>;
  isKnownHere(feature: RecallFeature): boolean;
  isSuppressedHere(feature: RecallFeature): boolean;
}

/** The crossing a prompt is currently about, held between opening the question
 *  and filing its answer. */
export interface PendingCrossing {
  bridge: Bridge;
  crossing: BridgeCrossing & { labelPoint?: WorldPoint };
  key: string;
  water: RecallFeature | null;
}

/** Quiz prompts, crossings, scoring and the spaced-repetition store. */
export interface RecallHost extends GameCoreHost {
  track: Track;
  bridges: Bridge[];
  recall: RecallStore | null;

  routeOptions: { answerMode: AnswerMode };
  routeDifficulty: RouteDifficulty;
  gameyFeatures: boolean;

  quizCurrentName: string;
  quizCandidateName: string;
  quizCandidateTimer: number;
  quizPromptKind: QuizPromptKind;
  quizPromptSegmentIndex: number;
  quizPromptPointIndex: number;
  quizCorrect: number;
  quizAttempts: number;
  quizPoints: number;
  quizStreak: number;
  quizBestStreak: number;
  quizFeedback: string;

  learnedNames: Set<string>;
  revealedNames: Set<string>;
  _mapLabelNames: Set<string>;
  /** name -> world points where the store says this name is already known.
   *  Rebuilt per race so the label test stays a short local loop. */
  _knownPlaces: Map<string, WorldPoint[]>;

  /** Keyed per crossing, not per bridge: one OSM feature named "Zuiderzeeweg"
   *  is four separate bridges over three different waters. */
  _quizzedCrossings: Map<string, 'water' | 'bridge'>;
  _learnedBridges: Map<string, { name: string; labelPoint?: WorldPoint }>;
  _pendingCrossing: PendingCrossing | null;
  _lastBridgeQuizAt: number;
  _choiceOrder?: string[];

  _prompt: HTMLElement;
  _promptInput: HTMLInputElement;
  _promptFeedback: HTMLElement;
  _promptChoices: HTMLElement;
  _promptKind: HTMLElement;
  _promptKindLabel: HTMLElement;
  _promptHeading: HTMLElement;
  _promptQuestion: HTMLElement;
  _routeError: HTMLElement;
  _skipMastered: HTMLInputElement;

  /** Owned by other subsystems. */
  _savePreferences(): void;
  _showStreetKnowledge(name: string): void;
}
