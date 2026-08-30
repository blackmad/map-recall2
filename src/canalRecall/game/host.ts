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

import type { Camera, InputManager, OsmLoader, Renderer, VectorMap } from './collaborators';
import type { StreetKnowledgeEntry } from './extracts';
import type { Bridge, Landmark, LandmarkNotice, Neighborhood } from './worldTypes';

/** Construction, canvas and per-frame state that every subsystem uses. */
export interface GameCoreHost {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  renderer: Renderer;
  input: InputManager;
  vectorMap: VectorMap;
  osmLoader: OsmLoader;

  player: { x: number; y: number } | null;
  raceTime: number;
  currentNeighborhood: string;

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
