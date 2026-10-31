// The city's other 3D participants under `?engine=own`: signature landmarks,
// inventory trees, detailed (photogrammetry) buildings, pyramidal roofs and the
// ARTIS animals. They are the same legacy classes vector-map.js builds
// (signature-landmarks-source.js, inventory-trees-source.js,
// detailed-buildings-source.js, pyramidal-roofs-source.js, artis-animals.js), handed the engine's
// MapLibre-shaped CameraMap and the shared frame instead of a map, so they draw
// in the one three.js frame. The wiring mirrors vector-map.js:
//
//  - landmarks start suspended and resume when the start flight lands
//    (introFlat 0), like the streamed city; the residency budget is the
//    landmarks' own (landmarks/landmarkResidency.ts, read in the constructor);
//  - a shown model hides the streamed prisms it replaces (`setHidden('signature')`,
//    vector-map.js _refreshColoredBuildingFilter) and cuts host wall openings;
//  - picking asks the landmarks first and keeps the nearer surface
//    (vector-map.js inspectBuilding);
//  - detailed buildings, when on, replace the landmarks (vector-map.js
//    _syncDetailedBuildingLayers); off by default as in vector-map.js.

const W = () => globalThis as any;

/** Minimum interval between landmark ground re-bases (ms). */
export const LANDMARK_REBASE_MS = 1500;

export interface CityExtrasHost {
  readonly cameraMap: any;
  readonly sharedFrame: any;
  readonly mercator: unknown;
  extractPath(): string;
  threeBuildings(): any;
  completeCity(): any;
  measuredColoursOnly(): boolean;
  trees3d: boolean;
  repaint(): void;
  /** A model landed or a detailed tile set got ready: re-apply the card's landmark. */
  relight(): void;
  fail(what: string, error: unknown): void;
}

export interface ScreenHit { depth: number; [k: string]: unknown }

export class CityExtras {
  signature: any = null;
  trees: any = null;
  detailed: any = null;
  roofs: any = null;
  artis: any = null;
  private roofFeatures: any[] = [];
  private treesVisible = false;
  private detailedVisible = false;
  private bagCovers: unknown = null;
  private hookedGround: unknown = null;

  constructor(private readonly host: CityExtrasHost) {}

  start(): void {
    const h = this.host;
    // Detailed buildings find the frame on `map._canalSharedFrame` (no options argument).
    h.cameraMap._canalSharedFrame = h.sharedFrame;
    const detailed = W().CanalRecallDetailed3D;
    if (detailed?.DetailedBuildings) {
      try {
        this.detailed = new detailed.DetailedBuildings(h.cameraMap, h.mercator, () => { this.syncEnabled(); h.relight(); });
        this.detailed.onLandmarkHighlighted = () => h.relight();
      } catch (error) { h.fail('detailed buildings', error); }
    }
    const signature = W().CanalRecallSignature3D;
    const lib = W().CanalRecallSignatureLandmarks;
    const models = lib?.GAME_BUILDING_MODELS || lib?.MANUAL_LANDMARKS;
    if (signature?.SignatureLandmarks && models) {
      try {
        this.signature = new signature.SignatureLandmarks(h.cameraMap, h.mercator, {
          sharedFrame: h.sharedFrame,
          models,
          streetChunks: true,
          buildingTypes: true,
          loadVisibleOnly: true,
          suspended: true,
          // The streamed city always draws here (no basemap extrusion to bias against).
          depthBiasEnabled: false,
          manageBasemapFilter: false,
          onSuppressionChanged: () => this.refreshSuppression(),
          onHostWallOpeningsChanged: () => this.syncHostWallOpenings(),
          canShowModel: (spec: any) => !spec.hostWallOpenings?.length
            || (this.hostOpeningsActive() && !!h.threeBuildings()?.hostWallOpeningsVisible?.(spec.hostWallOpenings)),
          onModelShown: () => { this.syncHostWallOpenings(); h.relight(); },
        });
      } catch (error) { h.fail('signature landmarks', error); }
    }
    const artis = W().CanalRecallArtisAnimals;
    if (artis?.ArtisAnimals) {
      try { this.artis = new artis.ArtisAnimals(h.cameraMap, h.mercator, h.extractPath(), { sharedFrame: h.sharedFrame }); } catch (error) { h.fail('artis', error); }
    }
    const trees = W().CanalRecallInventoryTrees;
    if (trees?.InventoryTrees && h.trees3d) {
      try {
        this.trees = new trees.InventoryTrees(h.cameraMap, h.mercator, () => {}, { sharedFrame: h.sharedFrame });
        this.trees.setEnabled(this.treesVisible);
        this.trees.load(h.extractPath());
      } catch (error) { h.fail('trees', error); }
    }
    this.syncEnabled();
  }

  /**
   * Hipped/pyramidal roofs over the streamed buildings (vector-map.js _syncPyramidalRoofs): fed each tile
   * update, minus the landmark kits that draw their own cones, and hidden under shown models.
   */
  setBuildingFeatures(features: any[]): void {
    const api = W().CanalRecallPyramidalRoofs;
    if (!api?.PyramidalRoofs) return;
    try {
      if (!this.roofs) this.roofs = new api.PyramidalRoofs(this.host.cameraMap, this.host.mercator, { sharedFrame: this.host.sharedFrame });
      this.roofFeatures = features || [];
      const kit = W().CanalRecallThreeBuildings?.KIT_HIDE_IDS;
      const kitIds = kit ? new Set(kit.map(String)) : null;
      this.roofs.setFeatures(kitIds ? this.roofFeatures.filter(f => !kitIds.has(String(f?.properties?.id))) : this.roofFeatures);
      this.roofs.setHidden(this.suppressedIds());
    } catch (error) { this.host.fail('pyramidal roofs', error); }
  }

  /** ?bagTiles=1: shown models hide the pands covers.json lists (vector-map.js _signatureSuppressOsmIds). */
  async loadBagCovers(): Promise<void> {
    const runtime = W().CanalRecallBuildingTiles;
    if (!this.host.completeCity()?.usingBagTiles || !runtime?.loadBagCovers) return;
    try { this.bagCovers = await runtime.loadBagCovers('./models/covers.json'); this.refreshSuppression(); } catch (error) { this.host.fail('bag covers', error); }
  }

  /** The start flight holds what the driving view loaded; landing resumes (vector-map.js sync). */
  setSuspended(suspended: boolean): void {
    for (const s of [this.signature, this.trees]) s?.setSuspended?.(suspended);
  }

  /** Own ground: models and trees stand on the relief / decks (vector-map.js _syncOwnGroundConsumers). */
  hookGround(ground: any): void {
    if (!ground?.ready || this.hookedGround === ground) return;
    this.hookedGround = ground;
    this.trees?.setGroundBase?.((lngLat: [number, number]) => ground.pointBase(lngLat));
    this.signature?.setGroundBase?.((anchor: [number, number], halfM: number) => ground.pointBase(anchor, halfM));
  }
  /**
   * New relief or decks arrived. Trees re-base at once (cheap: one height per tree). Landmarks re-base at most every
   * LANDMARK_REBASE_MS, with a trailing pass from `tick`: a street chunk samples the relief under every ground-level
   * vertex of every pand (signature-landmarks-source.js _applyChunkPandBases), 0.38 ms a frame in the fair A/B when
   * it ran on each ground revision (60 calls in 12 s against MapLibre's 10).
   */
  refreshGroundBases(now = performance.now()): void {
    this.trees?.refreshGroundBases?.();
    this.landmarkRebaseDue = true;
    this.tick(now);
  }
  /** Per frame: runs a due landmark re-base once the throttle allows. */
  tick(now = performance.now()): void {
    if (!this.landmarkRebaseDue || now - this.landmarkRebasedAt < LANDMARK_REBASE_MS) return;
    this.landmarkRebaseDue = false;
    this.landmarkRebasedAt = now;
    this.signature?.refreshGroundBases?.();
    this.landmarkRebases++;
  }
  private landmarkRebaseDue = false;
  private landmarkRebasedAt = -Infinity;
  /** Landmark re-bases run (perf probe). */
  landmarkRebases = 0;

  setTreesVisible(visible: boolean): void {
    this.treesVisible = !!visible;
    this.trees?.setEnabled(this.treesVisible);
    this.host.repaint();
  }
  setDetailedVisible(visible: boolean): void {
    this.detailedVisible = !!visible;
    this.syncEnabled();
  }
  setTheme(theme: string): void { this.trees?.setTheme?.(theme); }

  /** Detailed buildings replace the landmarks; measured-colours mode shows neither (vector-map.js 2169–2188). */
  syncEnabled(): void {
    const measured = this.host.measuredColoursOnly();
    this.detailed?.setEnabled(this.detailedVisible && !measured);
    const detailed = this.detailedActive();
    this.signature?.setEnabled(!detailed && !measured);
    this.refreshSuppression();
    this.host.repaint();
  }
  detailedActive(): boolean { return !this.host.measuredColoursOnly() && !!(this.detailedVisible && this.detailed?.ready); }

  private hostOpeningsActive(): boolean {
    return !!this.host.threeBuildings()?.setHostWallOpenings && !this.host.measuredColoursOnly();
  }
  syncHostWallOpenings(): void {
    const tb = this.host.threeBuildings();
    if (!tb?.setHostWallOpenings) return;
    tb.setHostWallOpenings(this.hostOpeningsActive() ? this.signature?.shownHostWallOpenings?.() || [] : []);
  }

  /** The streamed prisms a shown model replaces. */
  suppressedIds(): string[] {
    const s = this.signature;
    if (!s || this.host.measuredColoursOnly()) return [];
    const tiles = W().CanalRecallBuildingTiles;
    const ids = this.bagCovers && tiles?.hiddenIdsFor && s.shownSuppressModels
      ? tiles.hiddenIdsFor(this.bagCovers, s.shownSuppressModels())
      : s.shownSuppressOsmIds?.() || [];
    return [...new Set<string>(ids)];
  }
  refreshSuppression(): void {
    this.syncHostWallOpenings();
    const hide = this.suppressedIds();
    this.host.threeBuildings()?.setHidden?.('signature', hide);
    this.roofs?.setHidden?.(hide);
    this.host.repaint();
  }

  /** The card's landmark on the models / detailed tiles; true when a model lights it (no marker hull needed). */
  setActiveLandmark(landmark: any): { modelLit: boolean; detailed: boolean } {
    const detailed = this.detailedActive();
    this.detailed?.setActiveLandmark(detailed ? landmark : null);
    this.signature?.setActiveLandmark(detailed ? null : landmark);
    const modelLit = !detailed && !!(landmark && this.signature?.highlights?.(landmark));
    return { modelLit, detailed };
  }

  /** The nearer of a landmark model's surface and `generic` under the pixel. */
  pick(x: number, y: number, width: number, height: number, generic: ScreenHit | null): ScreenHit | null {
    const hit = this.signature?.inspectAtScreen?.(x, y, width, height) as ScreenHit | null | undefined;
    return hit && (!generic || hit.depth < generic.depth) ? hit : generic;
  }
}
