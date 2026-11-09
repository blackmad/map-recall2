// Draws the curated landmark models, and hides the extrusions they replace.
//
// The city-wide building layer is honest about where every building is and
// says nothing about what any of them looks like. This layer is the opposite,
// for a handful of buildings, and the two must never be visible at once — a
// textured Palace standing inside a grey box is worse than either alone.
//
// The ordering is deliberate and is the whole reason this is a class rather
// than a style rule: the extrusion is hidden only after the GLB has decoded
// and been added to the scene. A player on a slow connection, or one whose
// download fails, keeps the grey box. There is never a hole on the Dam.
//
// three.js is shared across the 3D bundles — see three-runtime-source.js.
import { createRecipeLook, RECIPE_LOOK_SHARED } from '../../../src/canalRecall/buildingRecipe/recipeLook.ts';
import { plainBounds, withinView } from '../../../src/canalRecall/engine/worldStreamer.ts';
import { normaliseLandmarkMaterials } from '../../../src/canalRecall/landmarks/landmarkShading.ts';
import { depthFadeFlag, depthFadeOptOut } from '../../../src/canalRecall/look/depthFade.ts';
import { countsAsLandmark } from '../../../src/canalRecall/buildingCategory.ts';
import { cityLookEnabled } from '../../../src/canalRecall/look/cityLook.ts';
import { INFERRED_SLOT_SOURCE } from '../../../src/canalRecall/look/materialSlotInference.ts';
import { landmarkHighlightStates } from '../../../src/canalRecall/look/highlightLandmarks.ts';
import { buildPickBvhs, nearestVisibleHit } from '../../../src/canalRecall/landmarks/pickBvh.ts';
import { anchorDistanceM, keepReachM, landmarkReachM, landmarkResidencyBudget, pastMinDwell, pickEvictions, withinReach } from '../../../src/canalRecall/landmarks/landmarkResidency.ts';
import { popFadeFlag } from '../../../src/canalRecall/engine/popFade.ts';
import { freezeStaticMatrices } from '../../../src/canalRecall/landmarks/staticMatrices.ts';
import { hasReleasedVertexData, releaseGeometryOnUpload, releaseVertexDataOnUpload } from '../../../src/canalRecall/landmarks/releaseVertexData.ts';
import { SHADOW_STAND_IN_PENDING, disposeShadowStandIn, shadowStandInFor } from '../../../src/canalRecall/rendererShared/shadowStandIns.ts';
// The page's worker pool (engine/workerPool.ts; started by the building and ground layers) welds the shadow stand-ins off the main thread (#129).
import { existingWorkerPool } from '../../../src/canalRecall/engine/workerPool.ts';
// The view comes from the WorldCamera (engine/worldCameraOf.ts, P5 B6), not the MapLibre-shaped map.
import { onViewChange, worldCameraOf } from '../../../src/canalRecall/engine/worldCameraOf.ts';
import { canSkipWalk, outsideSlack } from '../../../src/canalRecall/engine/viewSlack.ts';
import { applyMeshHighlight, highlightRecipe, LANDMARK_WORLD_UP } from '../../../src/canalRecall/look/highlight.ts';
// Landmarks from the air (lane R4-B #244): lod2 stand-ins and one batched draw for them.
import { CHUNK_LOD2_DOWNGRADE_PX, chooseLandmarkLevel, initialLandmarkLevel, lod2IsCurrent, lod2Url, nearestRadiusPx, ordinaryLod1DowngradePx, projectedRadiusPx } from '../../../src/canalRecall/landmarks/landmarkLod.ts';
import { LandmarkBatch, batchingMaterial, mergeLevelByLook, mergeLevelByMaterial, mergeSiblingsByMaterial } from '../../../src/canalRecall/landmarks/landmarkBatch.ts';
import { isAerialView } from '../../../src/canalRecall/rendererShared/aerialView.ts';
import { lowestPandBase } from '../../../src/canalRecall/streetChunks/mergeRanges.ts';
import { DEPTH_FADE_OPT_OUT } from '../../../src/canalRecall/look/depthFade.ts';
// Lane R4-G (#250): a textured model's images resident at a capped size while they stay finer than the screen.
import { cappedSize, landmarkTexCapFlag, nearestPixelsPerMetre, texelDensity, wantsCap } from '../../../src/canalRecall/landmarks/landmarkTexCap.ts';
const { THREE, GLTFLoader, MeshoptDecoder } = window.CanalRecallThree;
const { SIGNATURE_MODELS, placementFor, basemapBuildingFilter } = window.CanalRecallSignatureLandmarks;

const lodApi = () => window.CanalRecallSignatureLandmarks;

const assetUrl = (path, id) => {
  const url = new URL(path, window.location.href);
  const version = window.CanalRecallSignatureLandmarks.MODEL_ASSET_VERSIONS?.[id];
  if (version && !url.searchParams.has('asset')) url.searchParams.set('asset', version);
  return url.href;
};

/** URL of one level of a model that has a lod1 (or lod2) sibling. Each level is versioned by its own fingerprint. */
const levelUrl = (spec, level) => {
  if (level === 'lod2') {
    const url = new URL(lod2Url(spec.modelUrl), window.location.href);
    // A street chunk's lod2 record rides on its spec (chunks.json row, lane R4-C #245); a landmark's is in modelLods.json.
    const record = spec.chunkLod2 ?? lodApi().MODEL_LODS[spec.id].lod2;
    url.searchParams.set('asset', `${record.sourceHash}-${record.buildVersion}`);
    return url.href;
  }
  if (level !== 'lod1') return assetUrl(spec.modelUrl, spec.id);
  const url = new URL(lodApi().lod1Url(spec.modelUrl), window.location.href);
  url.searchParams.set('asset', lodApi().MODEL_LODS[spec.id].sourceHash);
  return url.href;
};

/** The highlight the rest of the game already uses for the building being
 *  asked about. Matching it exactly matters more than picking a nicer colour:
 *  a player learns "yellow means this one". */
const HIGHLIGHT_COLOUR = 0xffd21f;
/** Main-thread milliseconds one slice of the ground re-base pass may take before yielding to a frame (#129). */
const GROUND_BASE_SLICE_MS = 4;

/** A URL flag: `?name=0` (or `window.__canalRecall<Name>` false) turns a default-on feature off. */
/** Concurrent level loads when the level wanted is lod2 (the others keep two). */
const LOD2_LOADS = 8;
const flagOn = (name, fallback = true) => {
  const global = window[`__canalRecall${name[0].toUpperCase()}${name.slice(1)}`];
  if (typeof global === 'boolean') return global;
  try {
    const value = new URLSearchParams(window.location.search).get(name);
    if (value === '0' || value === 'false') return false;
    if (value === '1' || value === 'true') return true;
  } catch { /* no location */ }
  return fallback;
};
const numberFlag = name => {
  try { const v = Number(new URLSearchParams(window.location.search).get(name)); return Number.isFinite(v) && v > 0 ? v : undefined; } catch { return undefined; }
};

/**
 * Rotation about the vertical axis, in radians, that points the model's wide
 * side along a given compass bearing.
 *
 * The custom-layer transform is `translate · scale(u, −u, u) · rotZ(a) ·
 * rotX(π/2)`. Working a unit vector through it, the model's +X axis comes out
 * at compass bearing `90° − a`, because the negated Y in that scale flips
 * handedness and Mercator's +Y runs south. So the rotation needed for a
 * bearing is its complement, and getting this backwards puts the Palace's
 * facade against Nieuwezijds Voorburgwal instead of the Dam.
 */
function rotationForBearing(bearingDegrees) {
  return ((90 - bearingDegrees) * Math.PI) / 180;
}


export class SignatureLandmarks {
  /**
   * @param map            a MapLibre map
   * @param maplibregl     the MapLibre module, for MercatorCoordinate
   * @param onModelShown   called with a spec once its model is actually drawn,
   *                       so the caller can hide the matching extrusion
   * @param onSuppressionChanged called when the loaded-only replacement mask
   *                       changes, including disable, removal and rollback
   */
  constructor(map, maplibregl, options = {}) {
    this.map = map;
    this.camera = options.camera || worldCameraOf(map);
    this.maplibregl = maplibregl;
    this.onModelShown = options.onModelShown || (() => {});
    this.onSuppressionChanged = options.onSuppressionChanged || (() => {});
    this.onHostWallOpeningsChanged = options.onHostWallOpeningsChanged || (() => {});
    this.canShowModel = options.canShowModel || (spec => !spec.hostWallOpenings?.length);
    /** Which specs to draw. Defaults to the whole curated list; the demo passes
     *  a single candidate so an asset can be judged before it is committed. */
    this.models = options.models || SIGNATURE_MODELS;
    // The demo owns `building-3d` alone. The game already filters that layer for
    // the coloured extract, so it opts out and composes suppression itself.
    this.manageBasemapFilter = options.manageBasemapFilter !== false;
    this.getBasemapBaseFilter = options.getBasemapBaseFilter || null;
    this.loadVisibleOnly = options.loadVisibleOnly === true;
    /** Start with loading held (see setSuspended); the game resumes it when a ride's camera takes over. */
    this._suspended = options.suspended === true;
    this.depthBiasEnabled = options.depthBiasEnabled !== false;
    this.streetChunks = options.streetChunks === true;
    this.buildingTypes = options.buildingTypes !== false;
    /**
     * Bumped by every change to what `_requestModels` reads besides the view (pending, failed, shown, the model list,
     * the generation): a walk that found nothing to load is skipped only while this and the view's margin hold.
     */
    this._requestRev = 0;
    this._pending = this._tracked(new Map());
    this._failed = this._tracked(new Set());
    /** One decoded GLB per shared-mesh URL (recipe-pipeline houses); instances clone it and share geometry and materials. */
    this._sharedAssets = new window.CanalRecallSignatureLandmarks.SharedAssetCache();
    this._generation = 0;
    this._removed = false;
    this._onMove = () => { this._evictFar(); this._requestModels(); this._updateLevels(); };
    /** Resident model budget (landmarks/landmarkResidency.ts): 24 on touch, 72 on desktop; `?landmarkBudget=`. */
    this.residencyBudget = options.residencyBudget ?? landmarkResidencyBudget(window.location?.search ?? '', !!window.matchMedia?.('(pointer: coarse)')?.matches);
    this._lastEvictCheck = 0;
    /**
     * Landmark reach (landmarks/landmarkResidency.ts, lane R1-C #225): metres from the view centre within which a
     * model loads and counts as in view for eviction; a pitched view's bounds reach the horizon. 2000 m desktop,
     * 1000 m touch; `?landmarkReach=0` is the horizon-deep reach before (Infinity).
     */
    this.reachM = options.reachM ?? landmarkReachM(window.location?.search ?? '', !!window.matchMedia?.('(pointer: coarse)')?.matches);
    /**
     * No model loads below this zoom (2026-10-23). The overview raster draws the
     * city to z15.6; below z15 "visible" is every landmark in Amsterdam, which is
     * how the setup screen, route previews and zoomed-out views pulled in dozens
     * of GLBs nobody could see (a Safari session lost its GPU after 30 in 30 s).
     * The start flight also suspends loading (setSuspended); this covers the rest.
     */
    this.minLoadZoom = options.minLoadZoom ?? 15;
    /** Models given back to their extrusion because they were far off-view over budget. */
    this.evictions = 0;
    // The view's bounds, computed once per camera change (see _viewBounds).
    this._viewBoundsCache = null;
    this._dropViewBounds = () => { this._viewBoundsCache = null; };
    this.enabled = true;
    this.suppressing = true;
    /** Specs whose model has loaded and is in the scene. */
    this.shown = this._tracked(new Set());
    this.activeLandmarkId = null;
    /** The page's one three.js frame (no own layer, renderer or lights). */
    this.sharedFrame = options.sharedFrame || null;
    this._entries = [];
    this._sharedRoot = new THREE.Group();
    this._sharedRoot.name = 'signature-landmarks';
    if (this.sharedFrame) this._attachShared(options.sharedOrder ?? 20);
    this._loadStreetChunks();
    this._loadBuildingTypes();
    // No frame (headless checks): load and place as usual into a root nobody draws.
    if (!this.sharedFrame) this._setup(map);
  }

  /**
   * Street surveys (hosts opt in with `options.streetChunks`, so review pages that pass a single candidate model are
   * untouched; ordinaryChunks.ts `streetSurveyMode`). Chunks by default since 2026-10-16 (`?streetChunks=retired`: the block-face chunks and the
   * per-house recipe models leave the model list, so their pands draw as generic extrusions (or recipe tiles) like
   * their neighbours. `?streetChunks=0` keeps the per-house models. `?streetChunks=1` draws each block face as ONE
   * chunk model (one mesh, per-pand ranges in glTF extras; see streetChunks/manifest.ts) instead of its houses: the
   * houses a chunk replaces leave the model list, and any already drawn are dropped, so nothing is drawn twice.
   */
  _loadStreetChunks() {
    const { streetChunksEnabled, heldStreetChunks, streetSurveyMode, withoutStreetSurveys, applyStreetChunks } = window.CanalRecallSignatureLandmarks;
    if (this.streetChunks !== true) return;
    if (streetSurveyMode?.(window.location.search) === 'retired') {
      this.models = withoutStreetSurveys(this.models);
      this._dropEntries(new Set((this._entries || []).filter(e => e.spec.buildingCategory === 'street-survey').map(e => e.spec.id)));
      return;
    }
    if (!streetChunksEnabled?.(window.location.search)) return;
    fetch(new URL('./ordinary-buildings-data/chunks.json', window.location.href), { cache: 'no-cache' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`chunks.json ${response.status}`)))
      .then(manifest => {
        if (this._removed) return;
        const { models, replaced } = applyStreetChunks(this.models, manifest, heldStreetChunks?.(window.location.search));
        this.models = models;
        this._dropEntries(replaced);
        this._requestModels();
      })
      .catch(error => console.warn('Street chunks unavailable; keeping per-house models.', error));
  }

  /**
   * Building types (default ON since 2026-10-16; game host only): shared unit meshes drawn with THREE.InstancedMesh
   * for the Nieuw-West areas (src/canalRecall/buildingTypes/runtime.ts, bundled as js/building-types.bundle.js).
   * One spec per area; its scene is built by `spec.sceneFactory`, and its `suppressOsmIds` are the BAG panden it
   * replaces, so the OSM/BAG extrusion is suppressed exactly like a street chunk's. `?buildingTypes=0` keeps the
   * generic extrusions (building-types-runtime.spec BT=0); the host passes `buildingTypes: false` under
   * `?recipeTiles=1`, whose tiles carry the types.
   */
  _loadBuildingTypes() {
    let on = true;
    try { on = new URLSearchParams(window.location.search).get('buildingTypes') !== '0'; } catch { /* no location */ }
    if (!on || this.streetChunks !== true || !this.buildingTypes) return;
    const script = document.createElement('script');
    script.src = new URL('./js/building-types.bundle.js', window.location.href).href;
    const loaded = new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('building-types.bundle.js')); });
    document.head.appendChild(script);
    Promise.all([loaded, fetch(new URL('./building-types/instances.json', window.location.href), { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`instances.json ${r.status}`)))])
      .then(([, instances]) => {
        if (this._removed) return;
        const api = window.CanalRecallBuildingTypes, specs = [];
        for (const [area, list] of api.groupByArea(instances)) {
          const anchor = api.areaAnchor(list), radius = api.areaRadiusMetres(list);
          let built = null;
          specs.push({
            id: `building-types-${area}`, assetKind: 'ordinary-building', buildingCategory: 'street-survey', name: `Building types: ${area}`, landmarkId: '',
            modelUrl: '', suppressOsmIds: api.suppressionIds(list), spatialSuppression: false, heightMetres: 17, heightToleranceMetres: 1, groundAltitudeMetres: 0, facingOffsetDegrees: 0,
            footprint: { centre: anchor, headingDegrees: 90, lengthMetres: radius * 2, widthMetres: radius * 2 },
            surveyed: { anchor, northOffsetDegrees: 0, source: 'Building types: one shared unit mesh per design, instance list from BAG footprints and 3DBAG roofs.' },
            attribution: { title: `Building types: ${area}`, author: 'Ride Amsterdam', sourceUrl: 'https://data.amsterdam.nl/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Parametric facade types fitted to BAG footprints; photo-confirmed per building.' },
            sceneFactory: async () => {
              const loader = this._loader;
              const loadUnit = async unit => {
                const gltf = await loader.loadAsync(new URL(`./building-types/${unit}.glb`, window.location.href).href);
                const dressed = await (this._dress(gltf) ?? gltf);
                return this._shade(dressed).scene;
              };
              built = await api.createBuildingTypes({ THREE, loadUnit, getCentre: () => this.camera.center() }, list);
              built.group.userData.recipeLook = true;
              window.__canalRecallBuildingTypes = Object.assign(window.__canalRecallBuildingTypes || {}, { [area]: built });
              return built.group;
            },
            pandForHit: (object, instanceId) => built?.pandForHit(object, instanceId) ?? null,
          });
        }
        this.models = [...this.models, ...specs];
        this._requestModels();
      })
      .catch(error => console.warn('Building types unavailable; keeping the OSM/BAG extrusions.', error));
  }

  /** Remove drawn models by spec id, freeing their resources and giving back their extrusions. */
  _dropEntries(ids) {
    const dropped = (this._entries || []).filter(entry => ids.has(entry.spec.id));
    if (!dropped.length) return;
    this._entries = this._entries.filter(entry => !ids.has(entry.spec.id));
    for (const entry of dropped) { this.shown.delete(entry.spec.id); this._unbatch(entry); entry.holder?.parent?.remove(entry.holder); this._disposeModel(entry.group, entry.spec, entry.url); this._disposeSpare(entry); }
    this._applySuppression();
    this.map.triggerRepaint();
  }

  /**
   * Shared-frame registration. Each model keeps the Mercator transform it was
   * placed with, as a holder matrix under a root whose local space *is*
   * Mercator; the frame maps that to its world, lights it with the one rig
   * and draws every landmark in one render instead of one per model.
   */
  _attachShared(order) {
    this._unregister = this.sharedFrame.register('landmarks', {
      root: this._sharedRoot,
      onAttach: () => this._setup(this.map),
      // A context loss empties MapLibre's style until the restored one loads; models that landed in that gap
      // failed on its calls (`getLayer` of a null style) and would keep their extrusions for the session.
      // Models whose vertex arrays were freed after upload (_releaseVertexData) cannot be uploaded again: drop them
      // before the restored renderer draws, and load them afresh below.
      onContextRestored: () => {
        this._dropEntries(new Set((this._entries || []).filter(e => hasReleasedVertexData(e.imported) || hasReleasedVertexData(e.spare)).map(e => e.spec.id)));
        this._rebuildShadowStandIns(); this._failed.clear(); this._applyBasemapFilter(); this._requestModels();
      },
      beforeRender: ctx => {
        if (this._removed || !this.enabled || !this._entries.length) return false;
        let any = false;
        for (const entry of this._entries) {
          const show = this._nearby(entry.spec, entry.placement.anchor, ctx.bounds()) && this.canShowModel(entry.spec);
          entry.holder.visible = show;
          if (entry.batched) for (const id of entry.batchIds) this._batch.setVisible(id, show);
          // Picking: world-space ray, against matrixWorld (which now includes the frame).
          entry.pickProjection = show ? ctx.clipFromWorld : null;
          if (show) any = true;
        }
        // The camera as last drawn: the street chunks' lod2 choice measures their size on screen through it.
        this._clipFromWorld = ctx.clipFromWorld;
        if (this._texCapSide()) this._updateTexCaps(ctx.clipFromWorld);
        // The frame's world is already east/north/up metres.
        if (any && this._recipeLook) this._recipeLook.enuFromWorld.value.identity();
        return any;
      },
    }, { order });
  }

  /** Leave the frame and give every model back to its extrusion (what the legacy layer's onRemove did). */
  remove() {
    this._unregister?.();
    this._unregister = null;
    this._removed = true;
    this._generation++;
    this._hostOpeningRevision = '[]';
    this.onHostWallOpeningsChanged();
    this._offView?.(); this._offView = null;
    this._pending.clear();
    for (const entry of this._entries) { entry.holder?.parent?.remove(entry.holder); this._disposeModel(entry.group, entry.spec, entry.url); this._disposeSpare(entry); }
    this._batch?.dispose(); this._batch = null;
    this._entries = [];
    this.shown.clear();
    this._loader = null;
    this._applySuppression();
  }

  /** Loader set-up, once the frame attaches. */
  _setup(map) {
    this._removed = false;
    this._generation++;
    const loader = new GLTFLoader();
    // The runtime GLBs are EXT_meshopt_compression; without this the load
    // fails and every landmark silently falls back to its grey box.
    if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    this._loader = loader;
    // moveend on WorldCamera; the view-bounds cache also lasts one frame (it is keyed by the view besides).
    this._offView?.();
    const offMove = onViewChange(this.camera, this._onMove), offFrame = this.camera.onFrame(this._dropViewBounds);
    this._offView = () => { offMove(); offFrame(); };
    this._requestModels();
  }

  /**
   * Hold model loading while the camera sweeps (the start-of-ride flight).
   * Its overview frames the whole city, so "visible" became every landmark in
   * Amsterdam: ~70 GLBs parsed and placed during the overview and flight on
   * the measured route, each one also restyling the map. Models already shown
   * stay; loading resumes for wherever the camera lands.
   */
  setSuspended(suspended) {
    if (this._suspended === !!suspended) return;
    this._suspended = !!suspended;
    if (!this._suspended && this._reveal) { this._reveal = null; this._requestIdle = null; }
    if (!this._suspended) this._requestModels();
  }

  /**
   * Reveal hand-over (engine/revealLandmarks.ts, #268): while loading is suspended under the loading screen, the models
   * nearest the first racing frame load at that frame's pose (`camera`, a read-only pose camera) and pick their level
   * there, at most `budget` of them. Resuming drops it; null clears it. Never called with `?revealSwap=0`.
   */
  setRevealPose(camera, budget = 0) {
    this._reveal = camera && budget > 0 ? { camera, left: budget } : null;
    this._requestIdle = null;
    if (this._reveal && this._suspended) this._requestModels();
  }

  /** Runs `fn` with the reveal pose as the camera (the walk, the level choice and the view bounds read it). */
  _atRevealPose(fn) {
    const camera = this.camera;
    this.camera = this._reveal.camera;
    this._viewBoundsCache = null;
    try { return fn(); } finally { this.camera = camera; this._viewBoundsCache = null; }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    // A hidden model must give its extrusion back, or the Dam has a hole in it.
    this._applySuppression();
    if (this.enabled) this._requestModels();
    this.map.triggerRepaint();
  }

  /** Pick the actual visible surface, using the same projection as drawing.
   * Ground-centroid proximity cannot identify a roof or facade at pitch. */
  inspectAtScreen(x, y, width, height) {
    if (!this.enabled || !width || !height) return null;
    const nx = x / width * 2 - 1, ny = 1 - y / height * 2;
    let result = null;
    const local = new THREE.Ray(), toLocal = new THREE.Matrix4(), view = this._viewBounds();
    for (const entry of this._entries || []) {
      if (!this.canShowModel(entry.spec) || !entry.pickProjection || !this._nearby(entry.spec, entry.placement.anchor, view)) continue;
      const inverse = entry.pickProjection.clone().invert();
      const near = new THREE.Vector3(nx, ny, -1).applyMatrix4(inverse);
      const far = new THREE.Vector3(nx, ny, 1).applyMatrix4(inverse);
      // Bounding-box pre-test in the group's own space (matrixWorld as last drawn, like pickProjection):
      // a model the ray misses costs one box test instead of a matrix walk and a mesh-by-mesh raycast.
      const box = this._pickBox(entry);
      if (box) {
        local.origin.copy(near); local.direction.copy(far).sub(near);
        local.applyMatrix4(toLocal.copy(entry.group.matrixWorld).invert());
        if (!local.intersectsBox(box)) continue;
      }
      entry.group.updateWorldMatrix(true, true);
      const ray = new THREE.Raycaster(near, far.sub(near).normalize());
      // Same hit as `ray.intersectObject(entry.group, true).find(hit => hit.object.visible)`, through a per-mesh
      // BVH once one is built; the first pick that reaches a model queues its build for idle time.
      const unbuilt = { count: 0 };
      // A batched lod2 model's own mesh is hidden (the batch draws it); it is what is on screen, so it is picked.
      if (entry.batched) for (const mesh of entry.batched) mesh.visible = true;
      let hit;
      try { hit = nearestVisibleHit(entry.group, ray, unbuilt); } finally { if (entry.batched) for (const mesh of entry.batched) mesh.visible = false; }
      if (unbuilt.count) this._queuePickBvh(entry);
      if (!hit) continue;
      const depth = hit.point.clone().applyMatrix4(entry.pickProjection).z;
      if (depth < -1 || depth > 1 || result && depth >= result.depth) continue;
      // A street chunk is one mesh for several panden: the face under the cursor says which one.
      const pand = entry.spec.chunkPands?.[window.CanalRecallSignatureLandmarks.pandIndexForFace(hit.object.geometry?.userData?.pandRanges, hit.faceIndex)];
      const typePand = entry.spec.pandForHit?.(hit.object, hit.instanceId);
      result = { id: pand?.buildingId || (typePand ? `NL.IMBAG.Pand.${typePand}` : entry.spec.suppressOsmIds?.[0]) || entry.spec.landmarkId,
        landmarkId: entry.spec.landmarkId, name: pand?.address || entry.spec.name,
        lngLat: entry.placement.anchor, depth, featureTarget: null,
        ...(pand?.footprint ? { footprint: { type: 'Polygon', coordinates: pand.footprint }, height: entry.spec.heightMetres }
          : entry.spec.buildingFootprint ? { footprint: entry.spec.buildingFootprint, height: entry.spec.heightMetres } : {}) };
    }
    return result;
  }

  /** Build the pick BVHs of a model that picks reach, in idle time, a mesh at a time. */
  _queuePickBvh(entry) {
    (this._pickBvhQueue ||= new Set()).add(entry);
    if (this._pickBvhIdle) return;
    const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 4, didTimeout: false }), 100));
    // Idle time when there is some; an uncapped or busy frame loop leaves none, so after 250 ms a
    // callback runs anyway and builds for up to 3 ms (a mesh is built whole: ~1-2 ms per 5k triangles).
    const step = deadline => {
      this._pickBvhIdle = null;
      const start = performance.now();
      const left = () => deadline.didTimeout ? 3 - (performance.now() - start) : deadline.timeRemaining() - 2;
      for (const queued of this._pickBvhQueue) {
        if (this._removed || !this._entries.includes(queued)) { this._pickBvhQueue.delete(queued); continue; }
        if (buildPickBvhs(queued.group, Math.max(0, left()))) this._pickBvhQueue.delete(queued);
        if (left() <= 0) break;
      }
      if (this._pickBvhQueue.size) this._pickBvhIdle = idle(step, { timeout: 250 });
    };
    this._pickBvhIdle = idle(step, { timeout: 250 });
  }

  /** The drawn level's bounds in `entry.group`'s own space, padded; cached until the level or its geometry changes. */
  _pickBox(entry) {
    if (entry.pickBox !== undefined && entry.pickBox !== null) return entry.pickBox || null;
    const group = entry.group, box = new THREE.Box3(), part = new THREE.Box3(), m = new THREE.Matrix4();
    group.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
    // Lines, points and sprites are picked with a distance threshold, not their bounds: no pre-test then.
    let thresholded = false;
    group.traverse(object => {
      if (object.isLine || object.isPoints || object.isSprite) thresholded = true;
      if (!object.isMesh || !object.geometry) return;
      let bounds;
      if (object.isInstancedMesh) { if (!object.boundingBox) object.computeBoundingBox(); bounds = object.boundingBox; }
      else { if (!object.geometry.boundingBox) object.geometry.computeBoundingBox(); bounds = object.geometry.boundingBox; }
      if (bounds && !bounds.isEmpty()) box.union(part.copy(bounds).applyMatrix4(m.multiplyMatrices(inverse, object.matrixWorld)));
    });
    if (thresholded || box.isEmpty()) { entry.pickBox = false; return null; }
    // Pad by 1 % of the diagonal plus a hair: the pre-test must never reject what the raycast would hit.
    return (entry.pickBox = box.expandByScalar(box.getSize(part.min).length() * 0.01 + 1e-6));
  }

  /** Hosts drawing the complete city already remove basemap geometry. The
   * legacy offset otherwise pulls intersecting roof faces through one another. */
  setDepthBiasEnabled(enabled) {
    const next = !!enabled;
    if (this.depthBiasEnabled === next) return;
    this.depthBiasEnabled = next;
    this._applySuppression();
    this.map.triggerRepaint();
  }

  /** Turns footprint suppression on or off without unloading anything. */
  setSuppressing(suppressing) {
    this.suppressing = !!suppressing;
    this._applySuppression();
    this.map.triggerRepaint();
  }

  /** Whether a loaded, visible model lights up for this landmark — in which
   *  case the map needs no locator dot beside it (user report 2026-09-29,
   *  "why do I get both the yellow dot and the yellow building?"). */
  highlights(landmark) {
    if (!this.enabled || !landmark || !landmark.id) return false;
    return (this._entries || []).some(entry => (entry.spec.landmarkId === landmark.id || (entry.spec.relatedLandmarkIds || []).includes(landmark.id)));
  }

  /** Mirrors the extrusion layer's highlight onto the models, so a landmark
   *  question looks the same whichever representation is on screen. */
  setActiveLandmark(landmark) {
    this.activeLandmarkId = landmark && landmark.id ? landmark.id : null;
    this._highlightLandmark = landmark || null;
    // `?highlight=a|b|c` (look/highlight.ts): materials kept, passes, dimmed neighbours, building types per pand.
    if (highlightRecipe().keepMaterials) return this._applyHighlightStyle(landmark);
    for (const entry of this._entries || []) {
      const highlighted = (entry.spec.landmarkId === this.activeLandmarkId || (entry.spec.relatedLandmarkIds || []).includes(this.activeLandmarkId));
      if (entry.highlighted === highlighted) continue;
      entry.highlighted = highlighted;
      entry.group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        // City look (`?cityLook=1`): one material per variant is shared by every building; swap to its highlight variant.
        if (!Array.isArray(child.material) && child.material.userData?.cityLook && this._recipeLook?.city) {
          child.material = this._recipeLook.city.highlighted(child.material, highlighted);
          return;
        }
        for (const material of materials) {
          // Recipe-look materials are shared by every house with that slot and tint; tinting one would light them all.
          if (!material.emissive || material.userData?.[RECIPE_LOOK_SHARED]) continue;
          if (!material.userData.canalRecallBaseEmissive) {
            material.userData.canalRecallBaseEmissive = material.emissive.clone();
          }
          if (highlighted) material.emissive.setHex(HIGHLIGHT_COLOUR).multiplyScalar(0.5);
          else material.emissive.copy(material.userData.canalRecallBaseEmissive);
          material.needsUpdate = true;
        }
      });
      // A lit landmark leaves the batch (its own lod2 mesh carries the highlight) and climbs to its own level.
      this._syncBatch(entry);
    }
    if (this._lod2On()) this._updateLevels();
    this.map.triggerRepaint();
  }

  _applyHighlightStyle(landmark) {
    const city = this._recipeLook?.city;
    const { states, ids, focus } = landmarkHighlightStates(this._entries || [], landmark);
    for (const entry of this._entries || []) {
      const state = states.get(entry) || 'plain';
      if (entry.highlightState === state) continue;
      entry.highlightState = state;
      entry.highlighted = state === 'highlight';
      this._syncBatch(entry);
      applyMeshHighlight(THREE, entry.group, state, { cityVariant: (m, s) => city ? city.dimmed(m, s === 'dim') : m, up: this.sharedFrame ? LANDMARK_WORLD_UP.shared : LANDMARK_WORLD_UP.legacy });
      // Highlight passes are new children: give them world matrices (legacy scenes no longer auto-update).
    }
    if (this._lod2On()) this._updateLevels();
    for (const area of Object.values(window.__canalRecallBuildingTypes || {})) area.setHighlighted?.(ids, focus);
    this.map.triggerRepaint();
  }

  /**
   * Removes the extrusion a model replaces, and biases the model forward for
   * whatever the removal cannot catch.
   *
   * Two mechanisms, because neither is sufficient alone.
   *
   * The id filter is `basemapBuildingFilter`, the same one `vector-map.js`
   * uses to stop the basemap redrawing buildings the game draws itself. I had
   * concluded this was impossible — the tiles batch buildings and expose no
   * OSM id in their properties — and was wrong: the vector-tile *feature id*
   * encodes it as `osmId * 10 + type`, which `encodeBasemapBuildingId` undoes.
   * It does not catch everything, and main's own note records why: pairing the
   * extract against the basemap leaves a remainder no id can match.
   *
   * So the depth bias stays for that remainder. The extrusion's front wall and
   * the model's facade are near-coplanar, and a depth tie is what put the grey
   * in front; a polygon offset settles it in the model's favour without
   * disabling the depth test, so a building genuinely between the player and
   * the Palace still occludes it properly.
   */
  _applySuppression() {
    this._applyBasemapFilter();
    const openingRevision = JSON.stringify(this.shownHostWallOpenings());
    if (openingRevision !== this._hostOpeningRevision) {
      this._hostOpeningRevision = openingRevision;
      this.onHostWallOpeningsChanged();
    }
    const bias = this.enabled && this.suppressing && this.depthBiasEnabled ? -1 : 0;
    this._depthBias = bias;
    this._batch?.setDepthBias(bias);
    for (const entry of this._entries || []) {
      if (entry.depthBias === bias) continue;
      entry.depthBias = bias;
      entry.group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.polygonOffset = bias !== 0;
          // Constant offset only: a slope-scaled factor reorders the model's own faces at grazing angles
          // (striped slab tops through the Rijksmuseum entrance and H'ART portico, 2026-10-10 audit).
          material.polygonOffsetFactor = 0;
          material.polygonOffsetUnits = bias * 4096;
          material.needsUpdate = true;
        }
      });
    }
    // Hosts also draw ordinary shells/roofs outside the basemap. Notify on
    // disable, rollback and removal as well as successful insertion, so an
    // unavailable replacement immediately restores every fallback layer.
    const suppressionRevision = JSON.stringify(this.shownSuppressOsmIds());
    if (suppressionRevision !== this._suppressionRevision) {
      this._suppressionRevision = suppressionRevision;
      this.onSuppressionChanged();
    }
  }

  /** Optional explicit attachment metadata, available only for loaded/shown models.
   * Missing, failed, removed or disabled models never carve their host shell. */
  shownHostWallOpenings() {
    if (!this.enabled || this._removed) return [];
    return (this._entries || []).filter(entry => this.shown.has(entry.spec.id))
      .flatMap(entry => (entry.spec.hostWallOpenings || []).map(config => ({
        ...config, enabled: config.enabled !== false, additiveModelAvailable: true,
      })));
  }

  /** OSM ids of every footprint a currently drawn model replaces. */
  shownSuppressOsmIds() {
    if (!this.enabled || !this.suppressing) return [];
    return (this._entries || []).flatMap(entry => [...entry.spec.suppressOsmIds]);
  }

  /** The same models as shownSuppressOsmIds, with their ids: `?bagTiles=1` swaps each
   *  model's suppress list for the pands covers.json says it stands on. */
  shownSuppressModels() {
    if (!this.enabled || !this.suppressing) return [];
    return (this._entries || []).map(entry => ({ id: entry.spec.id, suppressOsmIds: [...entry.spec.suppressOsmIds] }));
  }

  /** Footprints of every currently drawn model, for spatial suppression of the
   *  coloured extract (which names buildings the landmark id does not). */
  shownFootprints() {
    if (!this.enabled || !this.suppressing) return [];
    return (this._entries || [])
      .filter(entry => entry.spec.spatialSuppression !== false)
      .map(entry => entry.spec.footprint)
      .filter(Boolean);
  }

  /** Hides the basemap's own copy of every building a shown model replaces. */
  _applyBasemapFilter() {
    if (!this.manageBasemapFilter) return;
    if (!basemapBuildingFilter || !this.map.getLayer('building-3d')) return;
    const active = this.enabled && this.suppressing;
    // Prefer a live base filter from the host (the game's extract-wide hide)
    // so we compose with it. Fall back to capturing whatever the style had.
    let base;
    if (this.getBasemapBaseFilter) {
      base = this.getBasemapBaseFilter();
    } else {
      if (this._baseBuildingFilter === undefined) {
        this._baseBuildingFilter = this.map.getFilter('building-3d') || null;
      }
      base = this._baseBuildingFilter;
    }
    const osmIds = active
      ? (this._entries || []).flatMap(entry => [...entry.spec.suppressOsmIds])
      : [];
    this.map.setFilter('building-3d', basemapBuildingFilter(osmIds, base));
  }

  /** `collection` with its add/set/delete/clear bumping `_requestRev` (see the request gate in `_requestModels`). */
  _tracked(collection) {
    for (const name of ['add', 'set', 'delete', 'clear']) {
      const f = collection[name];
      if (typeof f === 'function') collection[name] = (...args) => { this._requestRev++; return f.apply(collection, args); };
    }
    return collection;
  }

  /** A model's half-diagonal, metres (what `_nearby` pads the view by). */
  _radiusM(spec) { return Math.hypot(spec.footprint?.lengthMetres || 0, spec.footprint?.widthMetres || 0) / 2; }

  /** Keep loading and render culling aligned, including large footprint edges. */
  _nearby(spec, anchor = spec.surveyed?.anchor || spec.footprint?.centre, bounds = null) {
    if (!anchor) return !this.loadVisibleOnly;
    const radius = Math.hypot(spec.footprint?.lengthMetres || 0, spec.footprint?.widthMetres || 0) / 2;
    return withinView(bounds || this._viewBounds(), anchor, radius);
  }

  /**
   * `map.getBounds()` unprojects the four screen corners; `_nearby` asked for
   * it once per model on every `moveend` (each frame of a ride: the game jumps
   * the camera every frame) and once per entry in render, levels and picking.
   * Kept until the camera moves, the map resizes or a frame has drawn.
   */
  _viewBounds() {
    // Kept while the view (camera and window size) is the one it was measured for, and at most until a frame has drawn.
    // Compared as numbers: this runs once per model per frame, and formatting a key string cost 1.5 s a minute at 4x.
    const cam = this.camera, c = cam.center(), k = this._viewBoundsKey ??= new Float64Array(7);
    const z = cam.zoom(), b = cam.bearing(), p = cam.pitch(), w = window.innerWidth, h = window.innerHeight;
    if (this._viewBoundsCache && k[0] === z && k[1] === c.lng && k[2] === c.lat && k[3] === b && k[4] === p && k[5] === w && k[6] === h) return this._viewBoundsCache;
    k[0] = z; k[1] = c.lng; k[2] = c.lat; k[3] = b; k[4] = p; k[5] = w; k[6] = h;
    return this._viewBoundsCache = plainBounds(cam.bounds());
  }

  /**
   * Give back far, off-view models once more than `residencyBudget` are drawn
   * (at most twice a second). Without it residency grew with the ride until
   * the GPU gave up (landmarks/landmarkResidency.ts). Only with
   * `loadVisibleOnly`: the demo pages draw their whole list on purpose.
   */
  _evictFar() {
    if (!this.loadVisibleOnly || this._removed || !this._entries || this._entries.length <= this.residencyBudget) return;
    const now = performance.now();
    if (now - this._lastEvictCheck < 500) return;
    this._lastEvictCheck = now;
    const center = this.camera.center(), cos = Math.cos(center.lat * Math.PI / 180);
    const view = this._viewBounds();
    // Lane P2 (#325, `?popFade`): kept while within 1.25 x the reach, and never given back in its first 10 s.
    const hysteresis = this._popFade ??= popFadeFlag(), keepReach = keepReachM(this.reachM, hysteresis);
    const models = this._entries.map(entry => {
      const anchor = entry.placement?.anchor || entry.spec.surveyed?.anchor || entry.spec.footprint?.centre;
      const highlighted = entry.highlighted || (this.activeLandmarkId && entry.spec.landmarkId === this.activeLandmarkId);
      return {
        id: entry.spec.id,
        distanceSq: anchor ? ((anchor[0] - center.lng) * cos) ** 2 + (anchor[1] - center.lat) ** 2 : 0,
        inView: !anchor || (this._nearby(entry.spec, anchor, view) && withinReach(anchor, center, keepReach, this._radiusM(entry.spec))),
        // Procedural building types rebuild a whole instanced scene; a level swap in flight owns its entry.
        evictable: !!anchor && !entry.spec.sceneFactory && !entry.levelLoading && !highlighted && pastMinDwell(this._arrivedAt?.get(entry.spec.id), now, hysteresis),
      };
    });
    const ids = new Set(pickEvictions(models, { budget: this.residencyBudget }));
    if (!ids.size) return;
    this.evictions += ids.size;
    this._dropEntries(ids);
  }

  /**
   * The smallest outsideSlack (engine/viewSlack.ts) over the models a walk could request, all outside `view` or beyond
   * the reach. A model needs both shortfalls covered to load, so its slack is the larger; the reach's is in degrees of
   * latitude (the smaller unit, so the skip stays conservative when the centre moves east-west).
   */
  _loadableSlack(view) {
    let slack = Infinity;
    const reach = Number.isFinite(this.reachM) ? this.reachM : null, centre = reach != null ? this.camera.center() : null;
    for (const spec of this.models) {
      if (this.shown.has(spec.id) || this._pending.has(spec.id) || this._failed.has(spec.id)) continue;
      const anchor = spec.surveyed?.anchor || spec.footprint?.centre, radius = this._radiusM(spec);
      let s = outsideSlack(view, anchor, radius);
      if (centre && anchor) s = Math.max(s, (anchorDistanceM(anchor, centre) - radius - reach) / 111_320);
      if (s < slack) slack = s;
    }
    return slack;
  }

  _gateOn() {
    if (this._gateFlag === undefined) { try { this._gateFlag = new URLSearchParams(window.location?.search ?? '').get('landmarkGate') !== '0'; } catch { this._gateFlag = true; } }
    return this._gateFlag;
  }

  /**
   * The gate's pin, on the page only when asked (`window.__canalRecallLandmarkGateCheck = {}`): each skipped walk is
   * run anyway, and any model it would have requested is recorded (`misses`; must stay empty).
   */
  _gateCheck(view) {
    const check = window.__canalRecallLandmarkGateCheck;
    if (!check) return;
    check.skips = (check.skips || 0) + 1;
    const centre = Number.isFinite(this.reachM) ? this.camera.center() : null;
    const found = this.models.filter(spec => !this.shown.has(spec.id) && !this._pending.has(spec.id) && !this._failed.has(spec.id) && this._nearby(spec, undefined, view)
      && (!centre || withinReach(spec.surveyed?.anchor || spec.footprint?.centre, centre, this.reachM, this._radiusM(spec))));
    if (found.length) (check.misses ||= []).push({ t: performance.now(), ids: found.map(spec => spec.id) });
  }

  /** Requests in order, when asked (`window.__canalRecallLandmarkRequests = []`): id and time (the gate's A/B). */
  _logRequest(spec) {
    const log = window.__canalRecallLandmarkRequests;
    if (Array.isArray(log)) log.push({ id: spec.id, t: performance.now() });
  }

  _requestModels() {
    if (this._suspended && this._reveal) { this._atRevealPose(() => this._requestModelsPass(this._reveal)); return; }
    this._requestModelsPass(null);
  }

  /** One request walk; `reveal` (the reveal hand-over) lets it run while suspended, for its remaining budget. */
  _requestModelsPass(reveal) {
    if (this._removed || !this.enabled || (this._suspended && !reveal) || !this._loader || this._pending.size >= 2) return;
    if (reveal && reveal.left <= 0) return;
    if (this.loadVisibleOnly && this.camera.zoom() < this.minLoadZoom) return;
    // One view for the whole list (the camera cannot move inside this loop).
    const view = this.loadVisibleOnly ? this._viewBounds() : null;
    // The request gate (#129): the last walk found nothing to load, nothing it read has changed since, and the view's
    // edges have moved less than half the margin of the nearest loadable model outside it, so this walk would find
    // nothing too. A walk ran on every frame that moved the view, ~0.8 s a minute at 4x. `?landmarkGate=0` walks always.
    const idle = this._requestIdle;
    if (view && idle && !reveal && this._gateOn() && idle.rev === this._requestRev && idle.models === this.models && idle.generation === this._generation && canSkipWalk(idle.view, view, idle.slack)) {
      this._gateCheck(view);
      return;
    }
    const reachFrom = this.loadVisibleOnly && Number.isFinite(this.reachM) ? this.camera.center() : null;
    const candidates = this.models.filter(spec => !this.shown.has(spec.id) && !this._pending.has(spec.id) &&
      !this._failed.has(spec.id) && (!this.loadVisibleOnly || (this._nearby(spec, undefined, view)
        && (!reachFrom || withinReach(spec.surveyed?.anchor || spec.footprint?.centre, reachFrom, this.reachM, this._radiusM(spec))))));
    this._requestIdle = view && !reveal && !candidates.length ? { rev: this._requestRev, models: this.models, generation: this._generation, view: { ...view }, slack: this._loadableSlack(view) } : null;
    const center = this.camera.center();
    const distance = spec => {
      const anchor = spec.surveyed?.anchor || spec.footprint?.centre;
      return anchor ? ((anchor[0] - center.lng) * Math.cos(center.lat * Math.PI / 180)) ** 2 + (anchor[1] - center.lat) ** 2 : Infinity;
    };
    if (this.loadVisibleOnly) candidates.sort((a, b) => distance(a) - distance(b));
    while (this._pending.size < 2 && candidates.length && (!reveal || reveal.left > 0)) {
      const spec = candidates.shift(), generation = this._generation;
      if (this._pending.has(spec.id) || this.shown.has(spec.id)) continue;
      this._pending.set(spec.id, generation);
      if (reveal) reveal.left--;
      this._logRequest(spec);
      const finish = () => {
        if (this._removed || generation !== this._generation) return;
        this._pending.delete(spec.id);
        this._requestModels();
      };
      const level = spec.sceneFactory ? 'full' : this._startLevel(spec);
      const url = spec.sceneFactory ? spec.id : levelUrl(spec, level), loader = this._loader;
      const onLoaded = gltf => {
        if (level === 'lod1' && gltf.scene) this._mergeLevel(gltf.scene);
        if (this._removed || generation !== this._generation) {
          this._disposeModel(gltf.scene, spec, url);
          return;
        }
        // Replaced by a street chunk while it was loading.
        if (!this.models.includes(spec)) { this._disposeModel(gltf.scene, spec, url); finish(); return; }
        const place = () => {
          try { this._add(spec, gltf.scene, this.map, url, level); }
          catch (error) {
            this._failed.add(spec.id);
            // Placement or the host callback can fail after insertion. Give the
            // extrusion back before freeing its model so no hidden shell remains.
            for (const entry of this._entries) if (entry.spec.id === spec.id) entry.holder?.parent?.remove(entry.holder);
            this._entries = this._entries.filter(entry => entry.spec.id !== spec.id);
            this.shown.delete(spec.id);
            this._applySuppression();
            this._disposeModel(gltf.scene, spec, url);
            console.warn(`Signature model for ${spec.name} could not be placed; keeping the OSM extrusion.`, error);
          }
          finally { finish(); }
        };
        // Compile its programs before it joins the scene (off the frame where the driver allows): a landmark
        // that streams in mid-ride no longer links its shaders inside a draw.
        this._fadeOptOut(spec, gltf.scene);
        if (level === 'lod2' && gltf.scene) this._prepareLod2(gltf.scene);
        else if (gltf.scene) this._mergeShared(spec, gltf.scene);
        (this._texCapSide() ? Promise.all([this._precompile(gltf.scene), this._texCapPrepare(spec, gltf.scene)]) : this._precompile(gltf.scene)).then(() => {
          if (this._removed || generation !== this._generation) { this._disposeModel(gltf.scene, spec, url); return; }
          if (!this.models.includes(spec)) { this._disposeModel(gltf.scene, spec, url); finish(); return; }
          place();
        });
      };
      const onError = error => {
        if (this._removed || generation !== this._generation) return;
        this._failed.add(spec.id);
        console.warn(`Signature model for ${spec.name} unavailable; keeping the OSM extrusion.`, error);
        finish();
      };
      if (spec.sceneFactory) {
        // Building types: the spec builds its own instanced scene (see _loadBuildingTypes).
        spec.sceneFactory().then(scene => onLoaded({ scene }), onError);
      } else if (spec.sharedModel) {
        // Shared mesh: decode once, then clone per instance (geometry and materials stay shared).
        this._sharedAssets.acquire(url, () => loader.loadAsync(url).then(gltf => this._dress(gltf, spec) ?? gltf).then(gltf => this._mergeSharedMaster(this._shade(gltf))))
          .then(gltf => onLoaded({ scene: gltf.scene.clone(true) }), onError);
      } else loader.load(url, gltf => { const dressing = this._dress(gltf, spec); if (dressing) dressing.then(dressed => onLoaded(this._shade(dressed)), onError); else onLoaded(this._shade(gltf)); }, undefined, onError);
    }
  }

  /** `?landmarkTexCap=1024|512` (lane R4-G #250): the capped side, shared frame only; null when off. */
  _texCapSide() {
    if (this._texCapValue === undefined) this._texCapValue = this.sharedFrame ? landmarkTexCapFlag() : null;
    return this._texCapValue;
  }

  /**
   * Before a decoded model is placed (cap on): each image larger than the cap gets a downscaled ImageBitmap and the
   * texture's least dense texels per metre over the triangles that sample it (landmarks/landmarkTexCap.ts). Shared
   * meshes and scene factories are left alone (their textures are shared between instances). Never fails the load.
   */
  async _texCapPrepare(spec, scene) {
    if (!scene || spec.sharedModel || spec.sceneFactory || typeof createImageBitmap !== 'function') return;
    const cap = this._texCapSide(), uses = new Map();
    try {
      scene.updateMatrixWorld(true);
      scene.traverse(mesh => {
        if (!mesh.isMesh || !mesh.geometry?.attributes?.position || !mesh.geometry.attributes.uv) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material || {})) {
            if (!value?.isTexture || !value.image || value.isDataTexture || value.isCompressedTexture) continue;
            const size = cappedSize(value.image.width, value.image.height, cap);
            if (!size) continue;
            const use = uses.get(value) || { size, meshes: new Set() };
            use.meshes.add(mesh); uses.set(value, use);
          }
        }
      });
      const records = [];
      for (const [texture, { size, meshes }] of uses) {
        let density = Infinity;
        for (const mesh of meshes) {
          const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, world = new Float32Array(pos.count * 3), v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z; }
          const uvs = new Float32Array(uv.count * 2);
          for (let i = 0; i < uv.count; i++) { uvs[i * 2] = uv.getX(i); uvs[i * 2 + 1] = uv.getY(i); }
          const d = texelDensity(world, uvs, g.index ? g.index.array : null, texture.image.width, texture.image.height);
          if (d != null) density = Math.min(density, d);
        }
        if (!Number.isFinite(density)) continue;
        const small = await createImageBitmap(texture.image, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        records.push({ texture, full: texture.image, small, factor: size.factor, density, capped: false });
      }
      if (records.length) {
        const anchor = spec.surveyed?.anchor || spec.footprint?.centre, height = spec.heightMetres || 20;
        const radius = Math.hypot(spec.footprint?.lengthMetres || 0, spec.footprint?.widthMetres || 0) / 2;
        scene.userData.texCap = { id: spec.id, records, anchor, height, radius: Math.hypot(radius, height / 2), checked: 0 };
        // Decided now, before the first draw uploads anything: from the air the full images never go up.
        if (this._clipFromWorld) this._applyTexCap(scene.userData.texCap, this._clipFromWorld);
      }
    } catch (error) { console.warn(`Texture cap for ${spec.name} skipped`, error); }
  }

  /** Every resident capped-capable model, at most every 250 ms (models not yet decided: every frame). */
  _updateTexCaps(clip) {
    const now = performance.now(), sweep = now - (this._texCapAt || 0) >= 250;
    if (sweep) this._texCapAt = now;
    for (const entry of this._entries) {
      const state = entry.imported?.userData?.texCap;
      if (state && (sweep || !state.checked)) this._applyTexCap(state, clip);
    }
  }

  /** One model: each texture to its capped or full image as `wantsCap` says (hysteresis), re-uploaded on change. */
  _applyTexCap(state, clip) {
    const canvas = this.map?.getCanvas?.();
    if (!clip || !canvas || !this._sharedRoot || !state.anchor) return;
    state.checked = performance.now();
    const m = this.maplibregl.MercatorCoordinate.fromLngLat(state.anchor, state.height / 2);
    const p = new THREE.Vector3(m.x, m.y, m.z).applyMatrix4(this._sharedRoot.matrixWorld);
    // Device pixels: the canvas backing store over its CSS size.
    const ratio = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
    const cssPpm = nearestPixelsPerMetre(clip.elements, [p.x, p.y, p.z], state.radius, canvas.clientWidth, canvas.clientHeight);
    const pixelsPerMetre = cssPpm * ratio;
    state.pixelsPerMetre = pixelsPerMetre;
    for (const r of state.records) {
      const want = wantsCap({ density: r.density, pixelsPerMetre, factor: r.factor, capped: r.capped });
      if (want === r.capped) continue;
      r.capped = want;
      r.texture.image = want ? r.small : r.full;
      // A new size needs new storage: free the old one; the next draw uploads the other image.
      r.texture.dispose();
      r.texture.needsUpdate = true;
      this._texCapSwaps = (this._texCapSwaps || 0) + 1;
    }
  }

  /** Probe: textures under the cap now and what they hold (harness / specs). */
  texCapStats(detail = false) {
    let textures = 0, capped = 0, fullMB = 0, residentMB = 0;
    const rows = [];
    for (const entry of this._entries || []) for (const r of entry.imported?.userData?.texCap?.records || []) {
      const state = entry.imported.userData.texCap;
      if (detail) rows.push({ id: state.id, size: `${r.full.width}x${r.full.height}`, factor: r.factor, density: Math.round(r.density * 10) / 10, texelsPerPx: Math.round(r.density / state.pixelsPerMetre * 100) / 100, capped: r.capped });
      const full = r.full.width * r.full.height * 4 * 4 / 3 / 1048576, small = r.small.width * r.small.height * 4 * 4 / 3 / 1048576;
      textures++; fullMB += full; if (r.capped) { capped++; residentMB += small; } else residentMB += full;
    }
    return { side: this._texCapSide(), textures, capped, fullMB: Math.round(fullMB * 10) / 10, residentMB: Math.round(residentMB * 10) / 10, swaps: this._texCapSwaps || 0, ...(detail ? { rows } : {}) };
  }

  /** Shared frame: compile a decoded model's programs (as it will draw: receiving shadows) before it is placed. */
  _precompile(scene) {
    if (!this.sharedFrame?.compileAsync) return Promise.resolve();
    this.sharedFrame.constructor.setShadows(scene, true, true);
    return this.sharedFrame.compileAsync(scene);
  }

  /**
   * Shared frame with the depth fade on (look/depthFade.ts): a catalogue landmark's materials draw without the fade,
   * so the towers and bridges players steer by stay crisp against the faded field. Keyed on the landmark path, not
   * on model kind: shared models (kiosks, street furniture), building types and street chunks fade like the city.
   */
  _fadeOptOut(spec, scene) {
    if (!this.sharedFrame || !scene || spec.sharedModel || spec.sceneFactory || spec.chunkPands || !countsAsLandmark(spec)) return;
    const city = this._recipeLook?.city;
    if (depthFadeFlag()) depthFadeOptOut(scene, city ? m => city.material({ ...m.userData.cityVariant, noFade: true }) : undefined);
  }

  /**
   * Diffuse-only shading for every landmark (see landmarks/landmarkShading.ts):
   * the legacy layer's camera sits at the model origin, so any specular term
   * was a hotspot computed for an eye inside the building. Runs once per
   * decoded GLB (a shared mesh's master, before it is cloned).
   * `?landmarkSpecular=1` keeps the GLB's own materials, for A/B shots.
   */
  _shade(gltf) {
    let keep = window.__canalRecallLandmarkSpecular === true;
    try { keep ||= new URLSearchParams(window.location.search).get('landmarkSpecular') === '1'; } catch { /* no location */ }
    if (!keep) normaliseLandmarkMaterials(THREE, gltf.scene);
    return gltf;
  }

  /**
   * Recipe-pipeline GLBs tag materials with a `materialSlot`; they get the
   * city's look (shared brick/glass/roof textures, palette mapping, fixed-light
   * shade; see buildingRecipe/recipeLook.ts) so they sit with the procedural
   * facades around them. In the shared frame the same slots are lit by its
   * one rig instead of the baked shade. Other models pass through untouched (returns null:
   * they keep the synchronous load path).
   */
  _dress(gltf, spec = null) {
    // `?cityLook=1`: every model takes the city look (look/cityLook.ts); untagged landmark materials take the slot
    // their name and colour say. Flag off, slots inferred into a GLB (`materialSlotSource: 'inferred'`) are ignored.
    const city = cityLookEnabled();
    let tagged = false;
    gltf.scene.traverse(child => { if (child.isMesh && child.material?.userData?.materialSlot && (city || child.material.userData.materialSlotSource !== INFERRED_SLOT_SOURCE)) tagged = true; });
    if (!tagged && !city) return null;
    if (!this._recipeLookReady) {
      const image = new Image();
      image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
      this._recipeLookReady = image.decode().then(() => image, () => null)
        // `?sharedFrame=1`: lit by the one rig like the facades and landmarks around them (docs/LOOK.md); otherwise the baked city shade.
        .then(brick => { this._recipeLook = createRecipeLook(THREE, { brick, anisotropy: window.matchMedia?.('(pointer: coarse)').matches ? 1 : 4, lit: !!this.sharedFrame, cityLook: city, inferSlots: city }); return this._recipeLook; })
        .then(look => (look.ready ? look.ready.then(() => look) : look));
    }
    // `bagYear` (BAG construction year, published into the placement catalogue from scripts/landmarks/landmark-bag-years.ts)
    // picks the city look's era brick; without it the model keeps the canal brick.
    // `wallExposure` (street chunks, look/chunkWallExposure.ts): the walls were matched to a photo strip; the sunny look
    // draws them at that colour normalised to sunlight.
    return this._recipeLookReady.then(look => { look.apply(gltf.scene, { year: spec?.bagYear ?? null, wallExposure: spec?.wallExposure ?? null }); gltf.scene.userData.recipeLook = true; return gltf; });
  }

  /** LOD levels load synchronously into place: dress them too once the city look exists (`?cityLook=1` only). */
  _dressLevel(gltf, spec = null) {
    if (this._recipeLook?.city) { this._recipeLook.apply(gltf.scene, { year: spec?.bagYear ?? null, wallExposure: spec?.wallExposure ?? null }); gltf.scene.userData.recipeLook = true; }
    return gltf;
  }

  /** Free a model's GPU resources. A shared-mesh clone only drops its reference; the master is freed with the last instance. */
  _disposeModel(group, spec, url) {
    if (spec?.sharedModel) {
      const master = this._sharedAssets.release(url);
      if (master) this._disposeResources(master.scene);
      return;
    }
    this._disposeResources(group);
  }

  _disposeResources(group) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(child => {
      if (child.userData?.shadowStandIn) { disposeShadowStandIn(child.userData.shadowStandIn); child.userData.shadowStandIn = null; }
      if (child.userData?.[SHADOW_STAND_IN_PENDING]) delete child.userData[SHADOW_STAND_IN_PENDING];
      if (!child.isMesh) return;
      if (child.geometry) geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        // The recipe look's materials and textures are shared by every recipe house.
        if (!material || material.userData?.[RECIPE_LOOK_SHARED]) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
  }

  /**
   * Own ground (`?ownGround=1`, shared frame only): stand each model on the
   * relief — the lowest ground in a 6 m square round its anchor (the
   * prototype's rule). `fn(anchor, halfM)` → metres, undefined while that
   * relief is not resident; models wait at street level until it is.
   */
  setGroundBase(fn) {
    this._groundBase = fn || null;
    this.refreshGroundBases();
  }

  /**
   * Re-stand every model on the relief, a few milliseconds per task (#129 stutter: street chunks sample the relief
   * under every ground vertex, and one pass over all of them ran 80-130 ms in a single task while riding). A new
   * call restarts the pass. Returns the models moved in its first slice.
   */
  refreshGroundBases() {
    this._groundPass = { list: [...(this._entries || [])], i: 0 };
    return this._continueGroundBases(this._groundPass);
  }

  _continueGroundBases(pass) {
    if (this._groundPass !== pass || this._removed) return 0;
    const end = performance.now() + GROUND_BASE_SLICE_MS;
    let changed = 0;
    while (pass.i < pass.list.length) {
      if (this._applyGroundBase(pass.list[pass.i++])) changed++;
      if (pass.i < pass.list.length && performance.now() > end) { setTimeout(() => this._continueGroundBases(pass), 0); break; }
    }
    if (pass.i >= pass.list.length) this._groundPass = null;
    if (changed) this.map.triggerRepaint();
    return changed;
  }

  _applyGroundBase(entry) {
    // Own ground is a shared-frame feature; a legacy holder maps Mercator to the anchor world instead.
    if (!entry.holder || !entry.units) return false;
    // Street chunks: each pand on its own relief (own-ground bundle helpers, src/canalRecall/ownGround/chunkBases.ts).
    if (entry.spec.chunkPands && this._groundBase && window.CanalRecallOwnGround?.separatePands) return this._applyChunkPandBases(entry);
    const base = this._groundBase ? this._groundBase(entry.placement.anchor, 3) : 0;
    if (base === undefined || base === entry.groundBase) return false;
    entry.groundBase = base;
    entry.holder.matrix.makeTranslation(0, 0, base * entry.units).multiply(entry.transform);
    entry.holder.matrixWorldNeedsUpdate = true;
    if (entry.batched) entry.batched.forEach((mesh, i) => this._batch.setMatrix(entry.batchIds[i], this._batchMatrix(entry, mesh)));
    return true;
  }

  /**
   * A street chunk on the own ground: the holder stays at street level and
   * every pand's triangle range is lifted to the lowest relief under its own
   * ground-level vertices. Returns true when anything moved; waits (false)
   * until the relief under every pand is resident.
   */
  _applyChunkPandBases(entry) {
    const api = window.CanalRecallOwnGround;
    // A chunk drawn at its lod2 (lane R4-C #245) is not split: it measures its pands (from the full level once that has
    // been separated, else from its own geometry, read only) and the holder takes the lowest pand base, one matrix.
    const lod2 = entry.level === 'lod2';
    if (!lod2 && !entry.chunkPands) entry.chunkPands = { meshes: this._chunkPandMeshes(entry, api, true), bases: null };
    let state = entry.chunkPands;
    if (lod2 && !state) {
      if (entry.chunkPandsLod2?.level !== entry.imported) entry.chunkPandsLod2 = { level: entry.imported, meshes: this._chunkPandMeshes(entry, api, false), bases: null };
      state = entry.chunkPandsLod2;
    }
    // Lowest relief under each pand's ground-level vertices, across all its primitives.
    const bases = new Map();
    const v = new THREE.Vector3();
    for (const m of state.meshes) {
      // Each pand's ground-level points as lng/lat, once per mesh (the unlifted positions never change) and without
      // repeats: the primitives share their footprint corners, and every re-base used to redo the projections (#129).
      if (!m.groundPoints) {
        const p = m.base, seen = new Set();
        m.groundPoints = [];
        const ground = api.groundVertices(m.owner, i => v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(m.toMercator).z / entry.units);
        for (const [pand, list] of ground) for (const i of list) {
          v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(m.toMercator);
          const lngLat = new this.maplibregl.MercatorCoordinate(v.x, v.y, 0).toLngLat();
          const key = `${pand}|${lngLat.lng.toFixed(7)}|${lngLat.lat.toFixed(7)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          m.groundPoints.push([pand, [lngLat.lng, lngLat.lat]]);
        }
      }
      for (const [pand, lngLat] of m.groundPoints) {
        const z = this._groundBase(lngLat, 0);
        if (z === undefined) return false;
        bases.set(pand, Math.min(bases.has(pand) ? bases.get(pand) : Infinity, z ?? 0));
      }
    }
    let changed = false;
    const key = [...bases].map(([k, z]) => `${k}:${z.toFixed(3)}`).join(',');
    if (key !== state.bases) {
      state.bases = key;
      if (state === entry.chunkPands) for (const m of state.meshes) {
        m.geometry.attributes.position.array.set(api.liftPands(m.base, m.owner, m.dir, pand => bases.get(pand) ?? 0));
        m.geometry.attributes.position.needsUpdate = true;
        m.geometry.computeBoundingSphere();
        m.geometry.computeBoundingBox();
      }
      entry.pandBases = Object.fromEntries(bases);
      entry.pickBox = null;
      changed = true;
    }
    // The holder: street level under the per-pand lifted full level, the lowest pand base under the lod2.
    const lift = lod2 ? lowestPandBase(bases) : 0;
    if (lift !== entry.groundBase) {
      entry.groundBase = lift;
      if (lift) entry.holder.matrix.makeTranslation(0, 0, lift * entry.units).multiply(entry.transform);
      else entry.holder.matrix.copy(entry.transform);
      entry.holder.matrixWorldNeedsUpdate = true;
      if (entry.batched) entry.batched.forEach((mesh, i) => this._batch.setMatrix(entry.batchIds[i], this._batchMatrix(entry, mesh)));
      entry.pickBox = null;
      changed = true;
    }
    return changed;
  }

  /**
   * A chunk level's meshes with pand ranges, each as { geometry, owner, base, toMercator, dir }. `separate`: give every
   * pand its own vertices in the geometry (the full level, lifted per pand); otherwise only measure (geometry null).
   */
  _chunkPandMeshes(entry, api, separate) {
    const meshes = [];
    entry.group.updateMatrixWorld(true);
    const groupInverse = new THREE.Matrix4().copy(entry.group.matrixWorld).invert();
    entry.group.traverse(object => {
      const ranges = object.isMesh && object.geometry?.userData?.pandRanges;
      if (!ranges || !object.geometry.index) return;
      const g = object.geometry, sep = api.separatePands(g.index.array, g.attributes.position.count, ranges);
      if (!separate) {
        // Measure only (a lod2, lane R4-C #245): the unlifted positions per separated vertex, the geometry untouched.
        const p = g.attributes.position, base = new Float32Array(sep.source.length * 3);
        for (let v = 0; v < sep.source.length; v++) { base[v * 3] = p.getX(sep.source[v]); base[v * 3 + 1] = p.getY(sep.source[v]); base[v * 3 + 2] = p.getZ(sep.source[v]); }
        const toMercator = new THREE.Matrix4().copy(entry.transform).multiply(entry.group.matrix).multiply(groupInverse).multiply(object.matrixWorld);
        const up = new THREE.Vector3(0, 0, entry.units).applyMatrix4(new THREE.Matrix4().copy(toMercator).invert().setPosition(0, 0, 0));
        meshes.push({ geometry: null, owner: sep.owner, base, toMercator, dir: [up.x, up.y, up.z] });
        return;
      }
      // Position through the accessors as plain floats (the lift writes floats into it; glTF positions may be
      // interleaved or quantized). Every other attribute keeps its stored type and normalized flag when the
      // bundle has the strided remap (compactIndex ships with it): a Uint8 tint widened to float was 4x the
      // bytes, 16 MB of CPU copies on a 60 s desktop ride (heap gate, #130). Same values through the accessors.
      const getters = ['getX', 'getY', 'getZ', 'getW'], typed = typeof api.compactIndex === 'function';
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name], size = a.itemSize;
        if (typed && name !== 'position') {
          const array = a.isInterleavedBufferAttribute ? a.data.array : a.array;
          const out = api.remapAttribute(array, size, sep.source, a.isInterleavedBufferAttribute ? a.data.stride : size, a.isInterleavedBufferAttribute ? a.offset : 0);
          g.setAttribute(name, new THREE.BufferAttribute(out, size, a.normalized));
          continue;
        }
        const out = new Float32Array(sep.source.length * size);
        for (let v = 0; v < sep.source.length; v++) for (let c = 0; c < size; c++) out[v * size + c] = a[getters[c]](sep.source[v]);
        g.setAttribute(name, new THREE.BufferAttribute(out, size, false));
      }
      g.setIndex(new THREE.BufferAttribute(typed ? api.compactIndex(sep.index, sep.source.length) : sep.index, 1));
      // The split attributes are final now: free their CPU copies once uploaded (position stays for the lift).
      if (this._releaseOn()) releaseGeometryOnUpload(g);
      // mesh-local → Mercator (holder space = Mercator; the holder's own lift stays 0 for chunks).
      const toMercator = new THREE.Matrix4().copy(entry.transform).multiply(entry.group.matrix).multiply(groupInverse).multiply(object.matrixWorld);
      const up = new THREE.Vector3(0, 0, entry.units).applyMatrix4(new THREE.Matrix4().copy(toMercator).invert().setPosition(0, 0, 0));
      meshes.push({ geometry: g, owner: sep.owner, base: g.attributes.position.array.slice(), toMercator, dir: [up.x, up.y, up.z] });
    });
    return meshes;
  }

  /** Normalises a loaded model onto its anchor and builds its fixed transform.
   *  Buildings do not move, so the matrix is computed once here rather than
   *  every frame. */
  _add(spec, imported, map, url, level = 'full') {
    (this._arrivedAt ??= new Map()).set(spec.id, performance.now());
    const bounds = new THREE.Box3().setFromObject(imported);
    const min = bounds.min;
    const max = bounds.max;
    const placement = placementFor(spec, {
      min: [min.x, min.y, min.z],
      max: [max.x, max.y, max.z],
    });

    if (spec.surveyed) {
      // A surveyed model's own origin *is* the anchor, so moving it sideways is
      // the one thing that would break it. Only the vertical is touched, and
      // only to sit it on the basemap's flat ground rather than its own datum.
      imported.position.set(0, -min.y, 0);
    } else {
      const centre = bounds.getCenter(new THREE.Vector3());
      // Centre on the anchor horizontally and stand it on the ground plane.
      imported.position.set(-centre.x, -min.y, -centre.z);
    }
    const group = new THREE.Group();
    group.add(imported);
    group.scale.setScalar(placement.scale);
    // Mirrored shared-mesh instance: negating X gives the group a negative determinant, which three.js answers by flipping the front face, so winding stays correct.
    if (placement.mirror) group.scale.x = -group.scale.x;

    // The transform is the matrix of a holder in a Mercator-space root, and the frame's one light rig lights it.
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.add(group);
    this.sharedFrame?.constructor.setShadows(group, true, true);

    const coordinate = this.maplibregl.MercatorCoordinate.fromLngLat(
      placement.anchor,
      placement.altitudeMetres,
    );
    const units = coordinate.meterInMercatorCoordinateUnits();
    let transform;
    if (placement.horizontalBasis) {
      // glTF +X is facade tangent; glTF -Z is Blender +Y into the owner.
      // Only horizontal coordinates use the projected RD basis. Vertical
      // altitude and metre scale remain independent and unchanged.
      const { x, y } = placement.horizontalBasis;
      transform = new THREE.Matrix4().set(
        units*x[0], 0, -units*y[0], coordinate.x,
        units*x[1], 0, -units*y[1], coordinate.y,
        0, units, 0, coordinate.z,
        0, 0, 0, 1,
      );
    } else {
      transform = new THREE.Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new THREE.Vector3(units, -units, units))
        .multiply(new THREE.Matrix4().makeRotationZ(rotationForBearing(placement.modelRotationDegrees)))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    }

    // Recipe look: world → east/north/up for its fixed-light shade. Mercator +Y runs south.
    let enuFromWorld = null;
    if (imported.userData.recipeLook) {
      enuFromWorld = new THREE.Matrix3().setFromMatrix4(transform);
      enuFromWorld.premultiply(new THREE.Matrix3().set(1, 0, 0, 0, -1, 0, 0, 0, 1)).multiplyScalar(1 / units);
    }
    holder.matrix.copy(transform);
    holder.matrixWorldNeedsUpdate = true;
    this._sharedRoot.add(holder);
    // Placed models never move: compose their local matrices once instead of every frame.
    freezeStaticMatrices(group);
    const size = bounds.getSize(new THREE.Vector3());
    const entry = { spec, group, holder, transform, units, groundBase: 0, highlighted: false, placement, url, enuFromWorld,
      // Level of detail: `level` is what `group` holds now; `spare` is the other level once loaded (detached, kept for reuse).
      level, imported, spare: null, spareLevel: null, levelLoading: false,
      radiusMetres: Math.hypot(size.x, size.z) / 2 * placement.scale };
    this._entries.push(entry);
    this._releaseVertexData(spec, imported);
    this._syncBatch(entry);
    this._attachShadowStandIn(entry);
    if (this._groundBase) this._applyGroundBase(entry);
    this.shown.add(spec.id);
    // Only now is it safe to take the grey box away.
    this._applySuppression();
    this.onModelShown(spec, placement);
    map.triggerRepaint();
  }

  /** `?landmarkRelease=0` keeps every landmark vertex array on the CPU (A/B for the heap row). */
  _releaseOn() {
    if (this._releaseFlag === undefined) {
      let off = false;
      try { off = new URLSearchParams(window.location.search).get('landmarkRelease') === '0'; } catch { /* no location */ }
      this._releaseFlag = !off;
    }
    return this._releaseFlag;
  }

  /**
   * Frees a placed level's non-position vertex arrays once the GPU has them (landmarks/releaseVertexData.ts).
   * Shared-mesh masters (one GLB behind many clones, refcounted across loads) and building-type scenes (kit
   * geometry other layers may hold) keep theirs; street-chunk pands are split after placement and are released
   * in _applyChunkPandBases instead.
   */
  _releaseVertexData(spec, level) {
    // lod2 keeps its arrays: the batch copies them in whenever the model (re)joins it.
    if (!this._releaseOn() || spec.sharedModel || spec.sceneFactory || level?.userData?.landmarkLod2) return;
    releaseVertexDataOnUpload(level, geometry => !!geometry.userData?.pandRanges);
  }

  /** Whether this spec has a lod1 sibling the loader may use. */
  _hasLod(spec) {
    const api = lodApi();
    if (this._ordinaryLod(spec) && !this._ordinaryLodOn()) return false;
    // Only a lod1 built from the GLB that is deployed now; a stale one would show old geometry.
    return !spec.sharedModel && api.lod1IsCurrent(api.MODEL_LODS?.[spec.id], api.MODEL_ASSET_VERSIONS?.[spec.id]);
  }

  /**
   * An ordinary install with lod records (lane R4-H #252, modelLods.json rows marked `ordinary`): its level follows
   * the camera at the model itself, from the air only, and lod1 only while its atlas stays finer than the screen
   * (landmarkLod.ts ordinaryLod1DowngradePx). `?ordinaryLod=0` keeps every install at its full GLB.
   */
  _ordinaryLod(spec) {
    const row = lodApi().MODEL_LODS?.[spec.id];
    return !!(row?.ordinary || row?.lod2?.ordinary);
  }

  _ordinaryLodOn() {
    if (this._ordinaryLodFlag === undefined) this._ordinaryLodFlag = flagOn('ordinaryLod');
    return this._ordinaryLodFlag;
  }

  /**
   * lod2 in play (lane R4-B #244; `?landmarkLod2=0` restores the lod1/full choice): the shared frame only, landmark
   * GLBs only (not shared meshes, building types or street chunks), and only a lod2 built from the GLB deployed now.
   * Under the city look a lod2 keeps its source materials' slots (one primitive per material), so the look dresses it.
   */
  _lod2On() {
    if (this._lod2Flag === undefined) this._lod2Flag = !!this.sharedFrame && flagOn('landmarkLod2');
    return this._lod2Flag;
  }

  _hasLod2(spec) {
    // Street chunks (lane R4-C #245, `?chunkLod2=0` restores): a lod2 built from the GLB drawn now (chunkSpecFor checks the hash).
    if (spec.chunkPands) return this._chunkLod2On() && !!spec.chunkLod2;
    if (!this._lod2On() || spec.sharedModel || spec.sceneFactory) return false;
    if (this._ordinaryLod(spec) && !this._ordinaryLodOn()) return false;
    const api = lodApi();
    return lod2IsCurrent(api.MODEL_LODS?.[spec.id]?.lod2, api.MODEL_ASSET_VERSIONS?.[spec.id]);
  }

  /** `?chunkLod2=0` (lane R4-C #245): street chunks keep their full GLB from the air (no stand-in, no batch). */
  _chunkLod2On() {
    if (this._chunkLod2Flag === undefined) this._chunkLod2Flag = this._lod2On() && flagOn('chunkLod2');
    return this._chunkLod2Flag;
  }

  /** `?landmarkBatch=0`: lod2 models draw as their own mesh (one draw each) instead of joining the batch. */
  _batchOn() {
    if (this._batchFlag === undefined) this._batchFlag = this._lod2On() && flagOn('landmarkBatch');
    return this._batchFlag;
  }

  /** The view facts the level choice needs, once per pass: the centre while the view is aerial, else null. */
  _levelView() {
    const cam = this.camera, zoom = cam.zoom(), centre = cam.center();
    const aerial = this._lod2On() && isAerialView(zoom, cam.pitch(), centre.lat);
    if (this._lod2Px === undefined) { this._lod2Px = numberFlag('landmarkLod2Px'); this._lod2M = numberFlag('landmarkLod2M'); }
    return { aerialCentre: aerial ? centre : null };
  }

  _levelInputs(spec, radiusMetres, anchor, view, highlighted = false) {
    // A street chunk (lane R4-C #245): lod2 only from the air and only while small on screen through the camera, at
    // the chunk itself (landmarkLod.ts CHUNK_LOD2_DOWNGRADE_PX); no view-centre distance rule. Null: not measurable.
    if (spec.chunkPands) {
      if (!view.aerialCentre) return { radiusPixels: Infinity, hasLod1: false, hasLod2: false, aerialDistanceM: null, highlighted };
      // Behind the camera (or before the first frame) counts as small: nothing of it is on screen.
      const px = this._chunkRadiusPx(anchor, radiusMetres) ?? 0;
      if (this._chunkLod2Px === undefined) this._chunkLod2Px = numberFlag('chunkLod2Px') ?? CHUNK_LOD2_DOWNGRADE_PX;
      return { radiusPixels: px, hasLod1: false, hasLod2: this._hasLod2(spec), aerialDistanceM: null, highlighted, lod2DowngradePx: this._chunkLod2Px };
    }
    // An ordinary install (lane R4-H #252): the same through-the-camera size from the air (street views stay full),
    // lod2 under the chunks' radius, lod1 while the lod1 atlas gives ORDINARY_LOD1_TEXELS_PER_DEVICE_PX at the model.
    if (this._ordinaryLod(spec)) {
      const hasLod1 = this._hasLod(spec), hasLod2 = this._hasLod2(spec);
      if (!view?.aerialCentre) return { radiusPixels: Infinity, hasLod1, hasLod2: false, aerialDistanceM: null, highlighted };
      // Before the first frame: stay full rather than guess small. Behind the camera counts as small (as a chunk).
      if (!this._clipFromWorld || !this._sharedRoot) return { radiusPixels: Infinity, hasLod1, hasLod2: false, aerialDistanceM: null, highlighted };
      const centrePx = this._chunkRadiusPx(anchor, radiusMetres) ?? 0;
      if (this._chunkLod2Px === undefined) this._chunkLod2Px = numberFlag('chunkLod2Px') ?? CHUNK_LOD2_DOWNGRADE_PX;
      const canvas = this.map?.getCanvas?.(), dpr = canvas?.clientWidth ? canvas.width / canvas.clientWidth : (window.devicePixelRatio || 1);
      const texels = lodApi().MODEL_LODS[spec.id]?.texelsPerMetre ?? 0;
      // Judged at the model's nearest point (the camera's focal length in CSS px from the projection's y scale).
      const focal = this._clipFromWorld.elements[5] * (canvas?.clientHeight || 0) / 2;
      const px = focal > 0 ? nearestRadiusPx(centrePx, focal) : centrePx;
      return {
        radiusPixels: px, hasLod1, hasLod2, aerialDistanceM: null, highlighted, lod2DowngradePx: this._chunkLod2Px,
        lod1DowngradePx: ordinaryLod1DowngradePx(radiusMetres, texels, dpr),
      };
    }
    return {
      radiusPixels: this._radiusPixels(radiusMetres, anchor),
      hasLod1: this._hasLod(spec), hasLod2: this._hasLod2(spec),
      aerialDistanceM: view.aerialCentre ? anchorDistanceM(anchor, view.aerialCentre) : null,
      highlighted, lod2DowngradePx: this._lod2Px, lod2AerialM: this._lod2M,
    };
  }

  /** A footprint radius at `anchor` in CSS pixels through the last drawn camera (null before a frame or behind it). */
  _chunkRadiusPx(anchor, radiusMetres) {
    const clip = this._clipFromWorld, canvas = this.map?.getCanvas?.();
    if (!clip || !canvas || !this._sharedRoot) return null;
    const m = this.maplibregl.MercatorCoordinate.fromLngLat(anchor, 0);
    // Mercator (the landmark root) to the frame's world (east/north/up metres): the root's matrix as last drawn.
    const p = new THREE.Vector3(m.x, m.y, m.z).applyMatrix4(this._sharedRoot.matrixWorld);
    return projectedRadiusPx(clip.elements, [p.x, p.y, p.z], radiusMetres, canvas.clientWidth, canvas.clientHeight);
  }

  /** Footprint radius of a model in screen pixels at the current zoom. */
  _radiusPixels(radiusMetres, anchor) {
    return lodApi().footprintRadiusPixels(radiusMetres, this.camera.zoom(), anchor[1]);
  }

  /** Level to load first: lod1 for models that are small on screen (lod2 from the air). Unknown size or no lower level means full. */
  _startLevel(spec) {
    const lod2 = this._hasLod2(spec);
    if (!this._hasLod(spec) && !lod2) return 'full';
    const anchor = spec.surveyed?.anchor || spec.footprint?.centre;
    const radius = Math.hypot(spec.footprint?.lengthMetres || 0, spec.footprint?.widthMetres || 0) / 2;
    if (!anchor || !radius) return 'full';
    if (!lod2 && !this._ordinaryLod(spec)) return lodApi().initialLevel(this._radiusPixels(radius, anchor));
    const highlighted = !!this.activeLandmarkId && (spec.landmarkId === this.activeLandmarkId || (spec.relatedLandmarkIds || []).includes(this.activeLandmarkId));
    return initialLandmarkLevel(this._levelInputs(spec, radius, anchor, this._lod2On() ? this._levelView() : null, highlighted));
  }

  /**
   * Swaps drawn models between lod1 and the full GLB as their on-screen size
   * crosses the (hysteretic) thresholds, and to lod2 when tiny or far off from
   * the air. The other level is loaded first and only then swapped in, in one
   * step, so a model is never missing or doubled.
   */
  _updateLevels() {
    if (this._removed || !this.enabled || !this._loader || this._updatingLevels) return;
    // A swap re-applies the highlight, which asks for levels again: one pass at a time.
    this._updatingLevels = true;
    // Under the reveal hand-over the levels are judged at the first racing frame's pose, not the hold's (#268).
    try { if (this._suspended && this._reveal) this._atRevealPose(() => this._updateLevelsPass()); else this._updateLevelsPass(); } finally { this._updatingLevels = false; }
  }

  _updateLevelsPass() {
    const view = this._viewBounds(), levelView = this._lod2On() ? this._levelView() : null;
    for (const entry of this._entries) {
      if (entry.levelLoading || entry.lodFailed) continue;
      const lod2 = this._hasLod2(entry.spec);
      if (!lod2 && !this._hasLod(entry.spec)) continue;
      if (!this._nearby(entry.spec, entry.placement.anchor, view)) continue;
      const wanted = lod2 || this._ordinaryLod(entry.spec)
        ? chooseLandmarkLevel(entry.level, this._levelInputs(entry.spec, entry.radiusMetres, entry.placement.anchor, levelView, this._isLit(entry)))
        : lodApi().chooseLevel(entry.level, this._radiusPixels(entry.radiusMetres, entry.placement.anchor));
      if (wanted === entry.level) continue;
      if (entry.spare && entry.spareLevel === wanted) { this._swapLevel(entry, entry.spare, wanted); continue; }
      // A lod2 is ~10 kB: from the air the pan outruns two loads at a time and models it left behind stay at full
      // (measured: the west leg peaked at 1,059 landmark draws). lod2 downgrades take their own, wider limit.
      if (wanted === 'lod2' ? this._lodLoads >= LOD2_LOADS : this._lodLoads >= 2) continue;
      this._loadLevel(entry, wanted);
    }
  }

  /** Whether the card's highlight lights this model (it then keeps off lod2 and out of the batch). */
  _isLit(entry) {
    return !!entry.highlighted || entry.highlightState === 'highlight'
      || (!!this.activeLandmarkId && (entry.spec.landmarkId === this.activeLandmarkId || (entry.spec.relatedLandmarkIds || []).includes(this.activeLandmarkId)));
  }

  /** `?landmarkMergeLod1=1` (prototype, off by default): a lod1's meshes merged into one per look (landmarkBatch.ts mergeLevelByLook). */
  _mergeLevel(scene) {
    if (this._mergeLod1Flag === undefined) this._mergeLod1Flag = !!this.sharedFrame && flagOn('landmarkMergeLod1', false) && !cityLookEnabled();
    if (this._mergeLod1Flag && !scene.userData.recipeLook) mergeLevelByLook(THREE, scene);
  }

  /**
   * A lod2 after the look, shading and fade opt-out: its per-material meshes merged into one mesh per drawn material
   * (city look: per shared city material, mergeLevelByMaterial; GLB look: one vertex-coloured Lambert, mergeLevelByLook).
   */
  _prepareLod2(scene) {
    scene.userData.landmarkLod2 = true;
    // Materials the look left alone (a translucent pane, a sign) are plain Lambert: those merge by look, vertex-coloured.
    mergeLevelByLook(THREE, scene, { single: true });
    if (scene.userData.recipeLook) mergeLevelByMaterial(THREE, scene);
  }

  /**
   * Full and lod1 under the city look: sibling meshes sharing a city material merge into one draw
   * (landmarkBatch.ts mergeSiblingsByMaterial: same vertices, matrix and program, so the same pixels).
   * Catalogue landmark GLBs in the shared frame only; `?landmarkMergeShared=0` restores a draw per primitive.
   */
  _mergeShared(spec, scene) {
    if (this._mergeSharedFlag === undefined) this._mergeSharedFlag = !!this.sharedFrame && flagOn('landmarkMergeShared');
    if (!this._mergeSharedFlag || !scene.userData.recipeLook || spec.sharedModel || spec.sceneFactory) return;
    // Street chunks (lane R4-C #245, `?chunkMerge=0` restores a draw per primitive): ~20 primitives share 2-4 city
    // materials; the merge carries their pand ranges, so the per-pand lift and the hover pick read the merged mesh.
    if (spec.chunkPands && !this._chunkMergeOn()) return;
    mergeSiblingsByMaterial(scene, THREE);
  }

  _chunkMergeOn() {
    if (this._chunkMergeFlag === undefined) this._chunkMergeFlag = flagOn('chunkMerge');
    return this._chunkMergeFlag;
  }

  /** A shared mesh's master (decoded once, cloned per instance): the same sibling merge, before any clone exists. */
  _mergeSharedMaster(gltf) {
    if (this._mergeSharedFlag === undefined) this._mergeSharedFlag = !!this.sharedFrame && flagOn('landmarkMergeShared');
    if (this._mergeSharedFlag && gltf.scene?.userData.recipeLook) mergeSiblingsByMaterial(gltf.scene, THREE);
    return gltf;
  }

  /** The drawn lod2's meshes (one per material; empty at other levels). */
  _lod2Meshes(entry) {
    if (entry.level !== 'lod2') return [];
    const meshes = [];
    entry.imported.traverse(child => { if (child.isMesh && child.geometry && !Array.isArray(child.material)) meshes.push(child); });
    return meshes;
  }

  /** `mesh`'s matrix in the landmark root's (Mercator) space, composed from the frozen local matrices, in float64. */
  _batchMatrix(entry, mesh) {
    const m = new THREE.Matrix4();
    for (let object = mesh; object && object !== this._sharedRoot; object = object.parent) m.premultiply(object.matrix);
    return m;
  }

  /**
   * The batch key of a lod2 mesh's material: a shared city-look material is its own key (the batch draws a
   * batching-aware copy of it); a GLB-look lod2 is vertex-coloured Lambert, with or without the depth fade.
   */
  _batchKey(material) {
    if (material.userData?.cityLook) {
      const key = `city ${material.name}`;
      (this._batchSources ||= new Map()).set(key, material);
      return key;
    }
    if (!material.vertexColors || material.type !== 'MeshLambertMaterial' || material.map) return null;
    return material.fog === false ? 'noFade' : 'fade';
  }

  _landmarkBatch(entry) {
    if (this._batch) return this._batch;
    const t = entry.transform.elements, api = lodApi();
    // Reserve for the aerial resident cap at the mean lod2 size (vertices ~1.6 per triangle after the flat-normal weld).
    const lod2s = Object.values(api.MODEL_LODS || {}).map(e => e.lod2?.triangles).filter(Boolean);
    const mean = lod2s.length ? lod2s.reduce((a, b) => a + b, 0) / lod2s.length : 1000;
    const cap = 128;
    this._batch = new LandmarkBatch(THREE, {
      parent: this._sharedRoot,
      origin: [t[12], t[13], t[14]],
      initialInstances: cap, initialVertices: Math.ceil(mean * 1.6 * cap), initialIndices: Math.ceil(mean * 3 * cap),
      material: key => {
        const source = this._batchSources?.get(key);
        if (source) return batchingMaterial(THREE, source);
        // The per-model path's material after _shade, _fadeOptOut and the merge: Lambert, double-sided GLB faces, colour per vertex.
        const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
        material.name = `landmark-batch ${key}`;
        if (key === 'noFade') { material.fog = false; material.userData[DEPTH_FADE_OPT_OUT] = true; }
        return material;
      },
      configure: mesh => {
        this.sharedFrame.constructor.setShadows(mesh, true, true);
        this.sharedFrame.compileAsync?.(mesh);
      },
    });
    this._batch.setDepthBias(this._depthBias ?? 0);
    return this._batch;
  }

  /**
   * Puts a model drawn at lod2 into the batch, a batch entry per mesh (its own meshes are hidden; inspectAtScreen
   * picks them all the same), or takes it out: another level, a lit landmark, a mirrored placement, or `?landmarkBatch=0`.
   */
  _syncBatch(entry) {
    const meshes = this._lod2Meshes(entry);
    // A dimmed neighbour (`?highlight=c`) keeps its level but draws its own dimmed meshes.
    const want = meshes.length > 0 && this._batchOn() && !this._isLit(entry) && (!entry.highlightState || entry.highlightState === 'plain') && !entry.placement.mirror;
    if (want) {
      const keys = meshes.map(mesh => this._batchKey(mesh.material));
      if (keys.every(Boolean)) {
        const batch = this._landmarkBatch(entry), ids = meshes.map((_, i) => `${entry.spec.id}#${i}`);
        const added = meshes.every((mesh, i) => batch.add(ids[i], keys[i], mesh.geometry, this._batchMatrix(entry, mesh)));
        if (added) {
          for (const id of entry.batchIds || []) if (!ids.includes(id)) batch.remove(id);
          for (const mesh of entry.batched || []) if (!meshes.includes(mesh)) mesh.visible = true;
          for (const mesh of meshes) mesh.visible = false;
          entry.batched = meshes; entry.batchIds = ids;
          for (const id of ids) batch.setVisible(id, entry.holder.visible);
          return;
        }
        for (const id of ids) batch.remove(id);
      }
    }
    this._unbatch(entry);
  }

  /** Out of the batch: its own meshes draw again. */
  _unbatch(entry) {
    for (const mesh of entry.batched || []) mesh.visible = true;
    for (const id of entry.batchIds || []) this._batch?.remove(id);
    entry.batched = null; entry.batchIds = null;
  }

  _loadLevel(entry, level) {
    entry.levelLoading = true;
    this._lodLoads = (this._lodLoads || 0) + 1;
    const generation = this._generation, spec = entry.spec, url = levelUrl(spec, level);
    const done = () => { if (generation === this._generation) { entry.levelLoading = false; this._lodLoads--; } };
    this._loader.load(url, gltf => {
      if (this._removed || generation !== this._generation || !this._entries.includes(entry)) { this._disposeResources(gltf.scene); done(); return; }
      const scene = this._shade(this._dressLevel(gltf, spec)).scene;
      if (level === 'lod1') this._mergeLevel(scene);
      this._fadeOptOut(spec, scene);
      if (level === 'lod2') this._prepareLod2(scene);
      else this._mergeShared(spec, scene);
      // As for a first load: its programs compile before the swap, not inside the frame that shows it.
      this._precompile(scene).then(() => {
        if (this._removed || generation !== this._generation || !this._entries.includes(entry)) { this._disposeResources(scene); done(); return; }
        this._swapLevel(entry, scene, level);
        done();
        this._updateLevels();
      });
    }, undefined, error => {
      // Keep what is drawn; never retry a level that will not load.
      entry.lodFailed = true; done();
      console.warn(`LOD ${level} for ${spec.name} unavailable; keeping ${entry.level}.`, error);
    });
  }

  /** Puts `incoming` (already loaded) in place of the drawn level in one step, aligned with it. */
  _swapLevel(entry, incoming, level) {
    const outgoing = entry.imported;
    // Same normalisation as the first level, so the two overlay exactly.
    incoming.position.copy(outgoing.position);
    // A spare level was frozen when it was first drawn: recompose it at its (re)placed position.
    incoming.updateMatrix();
    freezeStaticMatrices(incoming);
    entry.group.add(incoming);
    entry.group.remove(outgoing);
    this._releaseVertexData(entry.spec, incoming);
    entry.imported = incoming;
    entry.pickBox = null;
    // Three levels: a spare that is neither level of this swap would be dropped on the floor; free it.
    if (entry.spare && entry.spare !== incoming) this._disposeResources(entry.spare);
    entry.spare = outgoing; entry.spareLevel = entry.level;
    entry.level = level;
    // Highlight, depth bias and shadows are per material: reapply to the new level.
    const active = entry.highlighted || !!entry.highlightState;
    entry.highlighted = false; entry.highlightState = null; entry.depthBias = null;
    this._applySuppression();
    if (active) this.setActiveLandmark(this._highlightLandmark || { id: this.activeLandmarkId });
    if (this.sharedFrame) this.sharedFrame.constructor.setShadows(entry.group, true, true);
    // A street chunk changes how it stands on the relief with its level (lane R4-C #245): per pand at full, one lift at lod2.
    if (entry.spec.chunkPands && this._groundBase && window.CanalRecallOwnGround?.separatePands) this._applyChunkPandBases(entry);
    this._syncBatch(entry);
    this._attachShadowStandIn(entry);
    this.map.triggerRepaint();
  }

  /**
   * Shared frame: the drawn level casts its shadow through one merged,
   * position-only stand-in (rendererShared/shadowStandIns.ts) instead of a draw
   * per mesh. Built once per level and kept with it (a spare level keeps its
   * own). Shared-mesh clones and street chunks (whose pands are lifted in
   * place) keep casting per mesh.
   */
  _attachShadowStandIn(entry) {
    if (entry.standIn) { entry.holder.remove(entry.standIn.object); entry.standIn = null; }
    if (!this.sharedFrame || this.sharedFrame.shadowStandIns === false || entry.spec.sharedModel || entry.spec.chunkPands) return;
    // lod2 is one mesh already (and in the batch, the batch casts): a stand-in would save nothing.
    if (entry.level === 'lod2') return;
    const imported = entry.imported;
    // Welded in the worker pool: until it arrives the level's meshes cast their own (same) shadow.
    const standIn = shadowStandInFor(THREE, imported, existingWorkerPool(), () => {
      if (this._removed || entry.imported !== imported || !this._entries?.includes(entry)) return;
      this._attachShadowStandIn(entry);
      this.map.triggerRepaint();
    });
    if (!standIn) return;
    standIn.object.matrix.multiplyMatrices(entry.group.matrix, imported.matrix);
    standIn.object.matrixWorldNeedsUpdate = true;
    entry.holder.add(standIn.object);
    entry.standIn = standIn;
  }

  /** After a context restore: stand-in buffers were freed from the CPU on upload, so build them again from their sources. */
  _rebuildShadowStandIns() {
    for (const entry of this._entries || []) {
      for (const level of [entry.imported, entry.spare]) {
        const standIn = level?.userData.shadowStandIn;
        if (standIn) disposeShadowStandIn(standIn, true);
        if (level) { delete level.userData.shadowStandIn; delete level.userData[SHADOW_STAND_IN_PENDING]; }
      }
      entry.standIn = null;
      if (this.sharedFrame) this.sharedFrame.constructor.setShadows(entry.group, true, true);
      this._attachShadowStandIn(entry);
    }
  }

  _disposeSpare(entry) {
    if (entry.spare) { this._disposeResources(entry.spare); entry.spare = null; }
  }

  /** What is actually on screen, for tests and for the demo readout. */
  describe() {
    return (this._entries || []).map(entry => ({
      id: entry.spec.id,
      name: entry.spec.name,
      placement: entry.placement,
      level: entry.level,
      attribution: entry.spec.attribution,
    }));
  }
}
