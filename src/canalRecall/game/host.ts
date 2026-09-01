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

import type {
  Camera, Hud, InputManager, LoadingScreen, OsmLoader, ParticleSystem, Renderer, Track, VectorMap,
} from './collaborators';
import type { StreetKnowledgeEntry } from './extracts';
import type {
  AnswerMode, QuizPromptKind, RouteDifficulty, TravelMode, ViewMode,
} from './modes';
import type { Exploration } from './progressStore';
import type { RibbonAid, RouteRibbon } from './routeRibbon';
import type { AnswerRecallStore } from '../answerPath';
import type { RecallFeature } from '../recallStore';
import type { NoticeHold, NoticeState } from './landmarkNotice';
import type { FactIndex } from '../facts/factStore';
import type { RotationState } from '../facts/factRotation';
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
  /** The expanded landmark card. Owned by the route/DOM half of the game. */
  _landmarkPanel: HTMLElement | null;
  _toggleUtilityPanel(panel: HTMLElement): void;
  _closeUtilityPanels(): void;
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
  /** Why the current card is up, and how far through its life it is. */
  _landmarkNoticeHold: NoticeHold;
  _landmarkNoticeState: NoticeState;
  /** Recomputed each frame by `_updateLandmarks`, so the renderer does not have
   *  to know the fade rules. */
  _landmarkNoticeAlpha: number;
  /** Where the card was last drawn, so a click on it can open the expanded
   *  panel. Null whenever no card is on screen. */
  _landmarkCardBounds: LinkBounds | null;
  _landmarkImages: Map<string, HTMLImageElement>;
  _landmarkImageRequests: Set<string>;
  /** Landmarks whose English summary has already been requested this session,
   *  so a failed fetch is not retried every frame. */
  _summaryRequests?: Set<string>;
  _seenLandmarks: Set<string>;
  _seenLandmarkNames: Set<string>;

  /** Generated trivia by feature id, from the published `facts.json`. Empty
   *  when the file is absent, in which case cards fall back to the lede. */
  _facts: FactIndex;
  /** What the player has already been told, carried between sessions. */
  _factRotation: RotationState;

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
  routeMastery(cityId: string): Record<string, number>;
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
  _routeMastery: Record<string, number>;

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

/** Frame composition, the menu, the pause overlay and the finish card. */
export interface PresentationHost extends GameCoreHost {
  _routeLearningPlan: { expectedNovelty: number } | null;
  state: number;
  track: Track;
  hud: Hud;
  particles: ParticleSystem;
  loadingScreen: LoadingScreen;

  loadingMessage: string;
  loadingProgress: number;
  showMiniMap: boolean;
  gameyFeatures: boolean;
  viewMode: ViewMode;
  routeDifficulty: RouteDifficulty;
  routeOptions: { answerMode: AnswerMode; line: boolean; arrow: boolean; minimap: boolean };

  routeFrom: { id: string; name: string };
  routeTo: { id: string; name: string };
  routePath: WorldPoint[] | null;
  _liveRoutePath: WorldPoint[] | null;
  /** Length of the route planned at the start — the efficiency reference,
   *  because the live line is consumed as the player advances. */
  _plannedRouteLengthPx: number;

  landmarks: Landmark[];
  _landmarkImages: Map<string, HTMLImageElement>;

  quizCorrect: number;
  quizAttempts: number;
  quizPoints: number;
  quizStreak: number;
  quizBestStreak: number;
  quizFeedback: string;
  quizCurrentName: string;
  quizCandidateName: string;
  quizPromptSegmentIndex: number;
  quizPromptPointIndex: number;

  learnedNames: Set<string>;
  _mapLabelNames: Set<string>;
  _visitedNeighborhoods: Set<string>;
  _seenLandmarkNames: Set<string>;

  _ribbon: RouteRibbon | null;
  _explorationSnapshot: Exploration | null;
  _assistUsage: Partial<Record<RibbonAid, boolean>>;

  _raceKey: string | null;
  _shareUrl: string | null;
  _copiedTimer: number;
  _menuQuote: { text: string; character: string } | null;
  _debugMode: boolean;
  _lastZoomShown: number | null;

  /** Canvas hit targets, recomputed as they are drawn. */
  _alanLinkBounds: LinkBounds | null;
  _githubLinkBounds: LinkBounds | null;
  _recenterBtnBounds: LinkBounds | null;

  /** Owned by other subsystems. */
  _renderBridgeLabels(): void;
  _renderLandmarkNotice(): void;
  _renderNeighborhoodNotice(): void;
  _renderDebug(): void;
  _isPlaceKnown(name: string, x: number, y: number): boolean;
}

export interface LinkBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
