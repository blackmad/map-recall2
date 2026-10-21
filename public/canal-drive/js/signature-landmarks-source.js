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
import { plainBounds, withinView } from '../../../src/canalRecall/rendererShared/residency.ts';
import { normaliseLandmarkMaterials } from '../../../src/canalRecall/landmarks/landmarkShading.ts';
import { cityLookEnabled } from '../../../src/canalRecall/look/cityLook.ts';
import { INFERRED_SLOT_SOURCE } from '../../../src/canalRecall/look/materialSlotInference.ts';
import { landmarkHighlightStates } from '../../../src/canalRecall/look/highlightLandmarks.ts';
import { buildPickBvhs, nearestVisibleHit } from '../../../src/canalRecall/landmarks/pickBvh.ts';
import { freezeStaticMatrices } from '../../../src/canalRecall/landmarks/staticMatrices.ts';
import { LANDMARK_SEQUENCE, anchorWorldFromMercator, bySequence, mercatorFromAnchorWorld, multiplyMat4, needsRebase, painterSortStable, reversePainterSortStable } from '../../../src/canalRecall/landmarks/batchedLegacyFrame.ts';
import { applyMeshHighlight, highlightRecipe, LANDMARK_WORLD_UP } from '../../../src/canalRecall/look/highlight.ts';
import { enuDirectionInLocal, SUN_DIRECTION, sunDirection, DEFAULT_LIGHT_RIG } from '../../../src/canalRecall/rendererShared/lightRig.ts';

// The weak fill faces the sun from the other side, low: shade walls read, never a second sun.
const FILL_DIRECTION = sunDirection((DEFAULT_LIGHT_RIG.sunAzimuthDeg + 180) % 360, 20);
const { THREE, GLTFLoader, MeshoptDecoder } = window.CanalRecallThree;
const { SIGNATURE_MODELS, placementFor, basemapBuildingFilter } = window.CanalRecallSignatureLandmarks;

const lodApi = () => window.CanalRecallSignatureLandmarks;

const assetUrl = (path, id) => {
  const url = new URL(path, window.location.href);
  const version = window.CanalRecallSignatureLandmarks.MODEL_ASSET_VERSIONS?.[id];
  if (version && !url.searchParams.has('asset')) url.searchParams.set('asset', version);
  return url.href;
};

/** URL of one level of a model that has a lod1 sibling. lod1 is versioned by its own fingerprint. */
const levelUrl = (spec, level) => {
  if (level !== 'lod1') return assetUrl(spec.modelUrl, spec.id);
  const url = new URL(lodApi().lod1Url(spec.modelUrl), window.location.href);
  url.searchParams.set('asset', lodApi().MODEL_LODS[spec.id].sourceHash);
  return url.href;
};

/** The highlight the rest of the game already uses for the building being
 *  asked about. Matching it exactly matters more than picking a nicer colour:
 *  a player learns "yellow means this one". */
const HIGHLIGHT_COLOUR = 0xffd21f;

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
    this.depthBiasEnabled = options.depthBiasEnabled !== false;
    this.streetChunks = options.streetChunks === true;
    this.buildingTypes = options.buildingTypes !== false;
    this._pending = new Map();
    this._failed = new Set();
    /** One decoded GLB per shared-mesh URL (recipe-pipeline houses); instances clone it and share geometry and materials. */
    this._sharedAssets = new window.CanalRecallSignatureLandmarks.SharedAssetCache();
    this._generation = 0;
    this._removed = false;
    this._onMove = () => { this._requestModels(); this._updateLevels(); };
    // The view's bounds, computed once per camera change (see _viewBounds).
    this._viewBoundsCache = null;
    this._dropViewBounds = () => { this._viewBoundsCache = null; };
    this.enabled = true;
    this.suppressing = true;
    /** Specs whose model has loaded and is in the scene. */
    this.shown = new Set();
    this.activeLandmarkId = null;
    /** `?sharedFrame=1`: draw in the page's one three.js frame (no own layer, renderer or lights). */
    this.sharedFrame = options.sharedFrame || null;
    // Legacy layer: every model in one scene, one render per frame (landmarks/batchedLegacyFrame.ts).
    // Not under `?cityLook=1`, whose tier distance is measured from the model origin the per-model camera
    // put the eye at.
    this._batchLegacy = !this.sharedFrame && !cityLookEnabled();
    this._batchSequence = 0;
    this._batchAnchor = null;
    this.layer = this._makeLayer();
    if (this.sharedFrame) this._attachShared(options.sharedOrder ?? 20);
    else map.addLayer(this.layer);
    this._loadStreetChunks();
    this._loadBuildingTypes();
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
            attribution: { title: `Building types: ${area}`, author: 'Ride Amsterdam', sourceUrl: 'https://data.amsterdam.nl/', licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Parametric facade types fitted to BAG footprints; photo-confirmed per building.' },
            sceneFactory: async () => {
              const loader = this._loader;
              const loadUnit = async unit => {
                const gltf = await loader.loadAsync(new URL(`./building-types/${unit}.glb`, window.location.href).href);
                const dressed = await (this._dress(gltf) ?? gltf);
                return this._shade(dressed).scene;
              };
              built = await api.createBuildingTypes({ THREE, loadUnit, getCentre: () => this.map.getCenter?.() }, list);
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
    for (const entry of dropped) { this.shown.delete(entry.spec.id); entry.holder?.parent?.remove(entry.holder); this._disposeModel(entry.group, entry.spec, entry.url); this._disposeSpare(entry); }
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
    const root = new THREE.Group();
    root.name = 'signature-landmarks';
    this._sharedRoot = root;
    this.sharedFrame.register('landmarks', {
      root,
      onAttach: () => this._setup(this.map, null),
      beforeRender: ctx => {
        if (this._removed || !this.enabled || !this._entries.length) return false;
        let any = false;
        for (const entry of this._entries) {
          const show = this._nearby(entry.spec, entry.placement.anchor, ctx.bounds()) && this.canShowModel(entry.spec);
          entry.holder.visible = show;
          // Picking: world-space ray, against matrixWorld (which now includes the frame).
          entry.pickProjection = show ? ctx.clipFromWorld : null;
          if (show) any = true;
        }
        // The frame's world is already east/north/up metres.
        if (any && this._recipeLook) this._recipeLook.enuFromWorld.value.identity();
        return any;
      },
    }, { order });
  }

  /** Loader and light set-up shared by the legacy layer and the shared frame. */
  _setup(map, lightScene) {
    this._removed = false;
    this._generation++;
    const loader = new GLTFLoader();
    // The runtime GLBs are EXT_meshopt_compression; without this the load
    // fails and every landmark silently falls back to its grey box.
    if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    this._loader = loader;
    this._lightScene = lightScene;
    map.on('moveend', this._onMove);
    for (const type of ['move', 'resize', 'render']) map.on(type, this._dropViewBounds);
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
    if (!this._suspended) this._requestModels();
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
    const local = new THREE.Ray(), toLocal = new THREE.Matrix4();
    for (const entry of this._entries || []) {
      if (!this.canShowModel(entry.spec) || !entry.pickProjection || !this._nearby(entry.spec, entry.placement.anchor)) continue;
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
      const hit = nearestVisibleHit(entry.group, ray, unbuilt);
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

  /** A legacy model scene skips three's per-render matrix walk; refresh it after its contents change. */
  _refreshSceneMatrices(entry) {
    if (entry.scene) entry.scene.updateMatrixWorld();
    else if (this._batchLegacy) entry.holder?.updateMatrixWorld(true);
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
    }
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
      applyMeshHighlight(THREE, entry.group, state, { cityVariant: (m, s) => city ? city.dimmed(m, s === 'dim') : m, up: this.sharedFrame ? LANDMARK_WORLD_UP.shared : LANDMARK_WORLD_UP.legacy });
      // Highlight passes are new children: give them world matrices (legacy scenes no longer auto-update).
      this._refreshSceneMatrices(entry);
    }
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
    return this._viewBoundsCache ??= plainBounds(this.map.getBounds());
  }

  _requestModels() {
    if (this._removed || !this.enabled || this._suspended || !this._loader || this._pending.size >= 2) return;
    const candidates = this.models.filter(spec => !this.shown.has(spec.id) && !this._pending.has(spec.id) &&
      !this._failed.has(spec.id) && (!this.loadVisibleOnly || this._nearby(spec)));
    const bounds = this.map.getBounds();
    const center = this.map.getCenter?.() || {lng: (bounds.getWest() + bounds.getEast()) / 2, lat: (bounds.getSouth() + bounds.getNorth()) / 2};
    const distance = spec => {
      const anchor = spec.surveyed?.anchor || spec.footprint?.centre;
      return anchor ? ((anchor[0] - center.lng) * Math.cos(center.lat * Math.PI / 180)) ** 2 + (anchor[1] - center.lat) ** 2 : Infinity;
    };
    if (this.loadVisibleOnly) candidates.sort((a, b) => distance(a) - distance(b));
    while (this._pending.size < 2 && candidates.length) {
      const spec = candidates.shift(), generation = this._generation;
      if (this._pending.has(spec.id) || this.shown.has(spec.id)) continue;
      this._pending.set(spec.id, generation);
      const finish = () => {
        if (this._removed || generation !== this._generation) return;
        this._pending.delete(spec.id);
        this._requestModels();
      };
      const level = spec.sceneFactory ? 'full' : this._startLevel(spec);
      const url = spec.sceneFactory ? spec.id : levelUrl(spec, level), loader = this._loader;
      const onLoaded = gltf => {
        if (this._removed || generation !== this._generation) {
          this._disposeModel(gltf.scene, spec, url);
          return;
        }
        // Replaced by a street chunk while it was loading.
        if (!this.models.includes(spec)) { this._disposeModel(gltf.scene, spec, url); finish(); return; }
        try { this._add(this._lightScene, spec, gltf.scene, this.map, url, level); }
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
        this._sharedAssets.acquire(url, () => loader.loadAsync(url).then(gltf => this._dress(gltf, spec) ?? gltf).then(gltf => this._shade(gltf)))
          .then(gltf => onLoaded({ scene: gltf.scene.clone(true) }), onError);
      } else loader.load(url, gltf => { const dressing = this._dress(gltf, spec); if (dressing) dressing.then(dressed => onLoaded(this._shade(dressed)), onError); else onLoaded(this._shade(gltf)); }, undefined, onError);
    }
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

  _makeLayer() {
    const owner = this;
    let camera, scene, renderer;
    owner._entries = [];
    return {
      id: 'signature-landmarks',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        camera = new THREE.Camera();
        scene = new THREE.Scene();
        // Daylight, and note the sign of the sun's Y.
        //
        // These models are Y-up in their own scene, and the first version of
        // this put the sun at y = -1: underneath the building, lighting its
        // undersides. Roofs then took their entire illumination from the
        // hemisphere light's white sky at full strength and blew out to flat
        // white, which read as broken normals and is why the Palace's roof
        // looked like a sheet of paper.
        //
        // So: a key from above and to the south-west, and a hemisphere dialled
        // back to fill rather than to light. The ground colour is the muted
        // grey-blue the basemap uses, so a model bounces the same light back as
        // the street it stands on.
        //
        // The positions below are placeholders: each model's copy of these
        // lights is re-aimed in `_add` from the rig's world sun through that
        // model's placement, because the placement rotation is folded into the
        // camera and a model-space light turned with every model (2026-10-13).
        const sky = new THREE.HemisphereLight(0xdfeaf2, 0x6b7480, 1.15);
        sky.name = 'landmark-sky';
        scene.add(sky);
        const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
        sun.position.set(-0.5, 1.6, 0.9);
        sun.name = 'landmark-sun';
        scene.add(sun);
        // A weak opposite fill so north-facing walls are readable rather than
        // silhouettes; buildings here are seen from every side while riding.
        const fill = new THREE.DirectionalLight(0xc9dcea, 0.55);
        fill.position.set(0.8, 0.4, -1.1);
        fill.name = 'landmark-fill';
        scene.add(fill);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        // One scene for every model (`_batchLegacy`): its matrices are refreshed where they change (placement,
        // re-base, level swap, highlight passes), and draws keep the old model-by-model order. Inside one model
        // (one render per model) the sequence is constant and the sort is three's own.
        scene.matrixWorldAutoUpdate = false;
        renderer.setOpaqueSort(bySequence(painterSortStable));
        renderer.setTransparentSort(bySequence(reversePainterSortStable));
        owner._batchScene = scene;
        owner._setup(map, scene);
      },
      onRemove(map) {
        owner._removed = true;
        owner._generation++;
        owner._hostOpeningRevision = '[]';
        owner.onHostWallOpeningsChanged();
        map.off('moveend', owner._onMove);
        for (const type of ['move', 'resize', 'render']) map.off(type, owner._dropViewBounds);
        owner._pending.clear();
        for (const entry of owner._entries) { entry.holder?.parent?.remove(entry.holder); owner._disposeModel(entry.group, entry.spec, entry.url); owner._disposeSpare(entry); }
        owner._entries = [];
        owner._batchAnchor = null;
        owner._batchScene = null;
        owner.shown.clear();
        owner._loader = null;
        owner._lightScene = null;
        owner._applySuppression();
        // This renderer borrows MapLibre's context: release resources, never lose it.
        renderer?.dispose();
      },
      render(_gl, args) {
        if (owner._removed || !owner.enabled || !owner._entries.length) return;
        if (owner._batchLegacy) {
          let any = false;
          for (const entry of owner._entries) {
            // Shared WebGL canvas: distant landmarks should cost no draw calls.
            const show = owner._nearby(entry.spec, entry.placement.anchor) && owner.canShowModel(entry.spec);
            entry.holder.visible = show;
            entry.pickProjection = null;
            if (show) any = true;
          }
          if (!any) return;
          owner._rebaseIfFar();
          camera.projectionMatrix.fromArray(multiplyMat4(args.defaultProjectionData.mainMatrix, owner._mercatorFromWorld, owner._clipFromWorld));
          const pickProjection = camera.projectionMatrix.clone();
          for (const entry of owner._entries) if (entry.holder.visible) entry.pickProjection = pickProjection;
          if (owner._recipeLook) owner._recipeLook.enuFromWorld.value.copy(owner._batchEnuFromWorld);
          renderer.resetState();
          renderer.render(scene, camera);
          return;
        }
        for (const entry of owner._entries) {
          // Shared WebGL canvas: distant landmarks should cost no render calls.
          if (!owner._nearby(entry.spec, entry.placement.anchor) || !owner.canShowModel(entry.spec)) { entry.pickProjection = null; continue; }
          camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(entry.transform);
          entry.pickProjection = camera.projectionMatrix.clone();
          if (entry.enuFromWorld && owner._recipeLook) owner._recipeLook.enuFromWorld.value.copy(entry.enuFromWorld);
          renderer.resetState();
          renderer.render(entry.scene, camera);
        }
      },
    };
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

  refreshGroundBases() {
    let changed = 0;
    for (const entry of this._entries || []) if (this._applyGroundBase(entry)) changed++;
    if (changed) this.map.triggerRepaint();
    return changed;
  }

  _applyGroundBase(entry) {
    // Own ground is a shared-frame feature; a legacy holder maps Mercator to the anchor world instead.
    if (!entry.holder || !entry.units || this._batchLegacy) return false;
    // Street chunks: each pand on its own relief (own-ground bundle helpers, src/canalRecall/ownGround/chunkBases.ts).
    if (entry.spec.chunkPands && this._groundBase && window.CanalRecallOwnGround?.separatePands) return this._applyChunkPandBases(entry);
    const base = this._groundBase ? this._groundBase(entry.placement.anchor, 3) : 0;
    if (base === undefined || base === entry.groundBase) return false;
    entry.groundBase = base;
    entry.holder.matrix.makeTranslation(0, 0, base * entry.units).multiply(entry.transform);
    entry.holder.matrixWorldNeedsUpdate = true;
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
    if (!entry.chunkPands) {
      // Once: give every pand its own vertices and remember the unlifted positions.
      const meshes = [];
      entry.group.updateMatrixWorld(true);
      const groupInverse = new THREE.Matrix4().copy(entry.group.matrixWorld).invert();
      entry.group.traverse(object => {
        const ranges = object.isMesh && object.geometry?.userData?.pandRanges;
        if (!ranges || !object.geometry.index) return;
        const g = object.geometry, sep = api.separatePands(g.index.array, g.attributes.position.count, ranges);
        // Through the accessors (glTF attributes may be interleaved or quantized): plain float copies.
        const getters = ['getX', 'getY', 'getZ', 'getW'];
        for (const name of Object.keys(g.attributes)) {
          const a = g.attributes[name], size = a.itemSize, out = new Float32Array(sep.source.length * size);
          for (let v = 0; v < sep.source.length; v++) for (let c = 0; c < size; c++) out[v * size + c] = a[getters[c]](sep.source[v]);
          g.setAttribute(name, new THREE.BufferAttribute(out, size, false));
        }
        g.setIndex(new THREE.BufferAttribute(sep.index, 1));
        // mesh-local → Mercator (holder space = Mercator; the holder's own lift stays 0 for chunks).
        const toMercator = new THREE.Matrix4().copy(entry.transform).multiply(entry.group.matrix).multiply(groupInverse).multiply(object.matrixWorld);
        const up = new THREE.Vector3(0, 0, entry.units).applyMatrix4(new THREE.Matrix4().copy(toMercator).invert().setPosition(0, 0, 0));
        meshes.push({ geometry: g, owner: sep.owner, base: g.attributes.position.array.slice(), toMercator, dir: [up.x, up.y, up.z] });
      });
      entry.chunkPands = { meshes, bases: null };
      if (entry.groundBase) { entry.groundBase = 0; entry.holder.matrix.copy(entry.transform); entry.holder.matrixWorldNeedsUpdate = true; }
    }
    // Lowest relief under each pand's ground-level vertices, across all its primitives.
    const bases = new Map();
    const v = new THREE.Vector3();
    for (const m of entry.chunkPands.meshes) {
      const p = m.base;
      const ground = api.groundVertices(m.owner, i => v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(m.toMercator).z / entry.units);
      for (const [pand, list] of ground) for (const i of list) {
        v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(m.toMercator);
        const lngLat = new this.maplibregl.MercatorCoordinate(v.x, v.y, 0).toLngLat();
        const z = this._groundBase([lngLat.lng, lngLat.lat], 0);
        if (z === undefined) return false;
        bases.set(pand, Math.min(bases.has(pand) ? bases.get(pand) : Infinity, z ?? 0));
      }
    }
    const key = [...bases].map(([k, z]) => `${k}:${z.toFixed(3)}`).join(',');
    if (key === entry.chunkPands.bases) return false;
    entry.chunkPands.bases = key;
    for (const m of entry.chunkPands.meshes) {
      m.geometry.attributes.position.array.set(api.liftPands(m.base, m.owner, m.dir, pand => bases.get(pand) ?? 0));
      m.geometry.attributes.position.needsUpdate = true;
      m.geometry.computeBoundingSphere();
      m.geometry.computeBoundingBox();
    }
    entry.pandBases = Object.fromEntries(bases);
    entry.pickBox = null;
    return true;
  }

  /** Normalises a loaded model onto its anchor and builds its fixed transform.
   *  Buildings do not move, so the matrix is computed once here rather than
   *  every frame. */
  _add(scene, spec, imported, map, url, level = 'full') {
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

    // Legacy layer: each model gets its own scene, and the transform below is
    // baked into the camera rather than the object, because MapLibre hands us
    // a projection matrix per frame and Mercator units differ with latitude.
    // Shared frame: the transform is the matrix of a holder in a Mercator-space
    // root, and the frame's one light rig lights it.
    let modelScene = null, holder = null;
    if (this.sharedFrame) {
      holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder.add(group);
      this.sharedFrame.constructor.setShadows(group, true, true);
    } else if (this._batchLegacy) {
      // One scene: the holder maps Mercator to the anchor's world, its sequence keeps the old draw order.
      holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder[LANDMARK_SEQUENCE] = ++this._batchSequence;
      holder.add(group);
    } else {
      modelScene = new THREE.Scene();
      for (const light of scene.children.filter(child => child.isLight)) modelScene.add(light.clone());
      modelScene.add(group);
    }

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
    // World-fixed lights: the rig's sun, its opposite fill and the sky's up, in this model's frame.
    if (modelScene) this._aimLights(modelScene, transform.elements);
    if (holder && this._batchLegacy) {
      if (!this._batchAnchor) this._rebase(coordinate.x, coordinate.y);
      holder.matrix.fromArray(multiplyMat4(this._worldFromMercator, transform.elements));
      scene.add(holder);
    } else if (holder) {
      holder.matrix.copy(transform);
      holder.matrixWorldNeedsUpdate = true;
      this._sharedRoot.add(holder);
    }
    // Placed models never move: compose their local matrices once instead of every frame (lights included).
    // A legacy model scene also stops walking itself per render; whatever later adds to or moves inside it
    // (a level swap, highlight passes) updates it there (`_refreshSceneMatrices`).
    freezeStaticMatrices(modelScene || group);
    if (modelScene) { modelScene.updateMatrixWorld(true); modelScene.matrixWorldAutoUpdate = false; }
    if (holder && this._batchLegacy) holder.updateMatrixWorld(true);
    const size = bounds.getSize(new THREE.Vector3());
    const entry = { spec, group, scene: modelScene, holder, transform, units, groundBase: 0, highlighted: false, placement, url, enuFromWorld,
      // Level of detail: `level` is what `group` holds now; `spare` is the other level once loaded (detached, kept for reuse).
      level, imported, spare: null, spareLevel: null, levelLoading: false,
      radiusMetres: Math.hypot(size.x, size.z) / 2 * placement.scale };
    this._entries.push(entry);
    if (this._groundBase) this._applyGroundBase(entry);
    this.shown.add(spec.id);
    // Only now is it safe to take the grey box away.
    this._applySuppression();
    this.onModelShown(spec, placement);
    map.triggerRepaint();
  }

  /** Aim a legacy scene's lights (world-fixed: sun, opposite fill, sky up) for a scene whose local → Mercator is `mercatorFromLocal`. */
  _aimLights(scene, mercatorFromLocal) {
    for (const light of scene.children) {
      const enu = light.name === 'landmark-sun' ? SUN_DIRECTION : light.name === 'landmark-fill' ? FILL_DIRECTION : light.name === 'landmark-sky' ? [0, 0, 1] : null;
      if (enu) light.position.fromArray(enuDirectionInLocal(mercatorFromLocal, enu));
    }
  }

  /**
   * Diagnostics (A/B in one page, the same frame): switch the legacy layer between one scene for every model
   * (default) and one scene and render per model. Returns the mode now in force.
   */
  setLegacyBatch(on) {
    const scene = this._batchScene;
    if (this.sharedFrame || !scene) return false;
    on = !!on;
    if (on === this._batchLegacy) return on;
    this._batchLegacy = on;
    for (const entry of this._entries) {
      if (on) {
        entry.scene = null;
        if (!entry.holder) { entry.holder = new THREE.Group(); entry.holder.matrixAutoUpdate = false; entry.holder[LANDMARK_SEQUENCE] = ++this._batchSequence; }
        entry.holder.add(entry.group);
        if (!this._batchAnchor) this._rebase(entry.transform.elements[12], entry.transform.elements[13]);
        entry.holder.matrix.fromArray(multiplyMat4(this._worldFromMercator, entry.transform.elements));
        scene.add(entry.holder);
        entry.holder.updateMatrixWorld(true);
      } else {
        entry.holder?.parent?.remove(entry.holder);
        const modelScene = new THREE.Scene();
        for (const light of scene.children.filter(child => child.isLight)) modelScene.add(light.clone());
        modelScene.add(entry.group);
        this._aimLights(modelScene, entry.transform.elements);
        modelScene.updateMatrixWorld(true);
        modelScene.matrixWorldAutoUpdate = false;
        entry.scene = modelScene;
      }
    }
    this.map.triggerRepaint();
    return on;
  }

  /** Legacy one-scene frame: re-base the anchor world when the view centre is far from it (float32 on the GPU). */
  _rebaseIfFar() {
    const centre = this.map.getCenter();
    const c = this.maplibregl.MercatorCoordinate.fromLngLat([centre.lng, centre.lat], 0);
    if (needsRebase(this._batchAnchor, [c.x, c.y], c.meterInMercatorCoordinateUnits())) this._rebase(c.x, c.y);
  }

  /** Anchor the legacy scene's world at Mercator (x, y): holders, lights and the recipe look's ENU follow. */
  _rebase(x, y) {
    const scene = this._batchScene;
    if (!scene) return;
    const units = this.maplibregl.MercatorCoordinate.fromLngLat(new this.maplibregl.MercatorCoordinate(x, y, 0).toLngLat(), 0).meterInMercatorCoordinateUnits();
    this._batchAnchor = [x, y];
    this._mercatorFromWorld = mercatorFromAnchorWorld(x, y, units);
    this._worldFromMercator = anchorWorldFromMercator(x, y, units);
    this._clipFromWorld ||= new Array(16);
    for (const entry of this._entries || []) {
      if (entry.holder && entry.holder.parent === scene) entry.holder.matrix.fromArray(multiplyMat4(this._worldFromMercator, entry.transform.elements));
    }
    // The rig's sun, its opposite fill and the sky's up, in the anchor world (as each model's copy was aimed in its own).
    this._aimLights(scene, this._mercatorFromWorld);
    // Recipe look: world → east/north/up, the same construction as a model's own `enuFromWorld`.
    this._batchEnuFromWorld = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().fromArray(this._mercatorFromWorld))
      .premultiply(new THREE.Matrix3().set(1, 0, 0, 0, -1, 0, 0, 0, 1)).multiplyScalar(1 / units);
    scene.updateMatrixWorld(true);
  }

  /** Whether this spec has a lod1 sibling the loader may use. */
  _hasLod(spec) {
    const api = lodApi();
    // Only a lod1 built from the GLB that is deployed now; a stale one would show old geometry.
    return !spec.sharedModel && api.lod1IsCurrent(api.MODEL_LODS?.[spec.id], api.MODEL_ASSET_VERSIONS?.[spec.id]);
  }

  /** Footprint radius of a model in screen pixels at the current zoom. */
  _radiusPixels(radiusMetres, anchor) {
    return lodApi().footprintRadiusPixels(radiusMetres, this.map.getZoom(), anchor[1]);
  }

  /** Level to load first: lod1 for models that are small on screen. Unknown size or no lod1 means full. */
  _startLevel(spec) {
    if (!this._hasLod(spec)) return 'full';
    const anchor = spec.surveyed?.anchor || spec.footprint?.centre;
    const radius = Math.hypot(spec.footprint?.lengthMetres || 0, spec.footprint?.widthMetres || 0) / 2;
    if (!anchor || !radius) return 'full';
    return lodApi().initialLevel(this._radiusPixels(radius, anchor));
  }

  /**
   * Swaps drawn models between lod1 and the full GLB as their on-screen size
   * crosses the (hysteretic) thresholds. The other level is loaded first and
   * only then swapped in, in one step, so a model is never missing or doubled.
   */
  _updateLevels() {
    if (this._removed || !this.enabled || !this._loader) return;
    for (const entry of this._entries) {
      if (!this._hasLod(entry.spec) || entry.levelLoading || entry.lodFailed) continue;
      if (!this._nearby(entry.spec, entry.placement.anchor)) continue;
      const wanted = lodApi().chooseLevel(entry.level, this._radiusPixels(entry.radiusMetres, entry.placement.anchor));
      if (wanted === entry.level) continue;
      if (entry.spare && entry.spareLevel === wanted) { this._swapLevel(entry, entry.spare, wanted); continue; }
      if (this._lodLoads >= 2) continue;
      this._loadLevel(entry, wanted);
    }
  }

  _loadLevel(entry, level) {
    entry.levelLoading = true;
    this._lodLoads = (this._lodLoads || 0) + 1;
    const generation = this._generation, spec = entry.spec, url = levelUrl(spec, level);
    const done = () => { if (generation === this._generation) { entry.levelLoading = false; this._lodLoads--; } };
    this._loader.load(url, gltf => {
      if (this._removed || generation !== this._generation || !this._entries.includes(entry)) { this._disposeResources(gltf.scene); done(); return; }
      this._swapLevel(entry, this._shade(this._dressLevel(gltf, spec)).scene, level);
      done();
      this._updateLevels();
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
    this._refreshSceneMatrices(entry);
    entry.imported = incoming;
    entry.pickBox = null;
    entry.spare = outgoing; entry.spareLevel = entry.level;
    entry.level = level;
    // Highlight, depth bias and shadows are per material: reapply to the new level.
    const active = entry.highlighted || !!entry.highlightState;
    entry.highlighted = false; entry.highlightState = null; entry.depthBias = null;
    this._applySuppression();
    if (active) this.setActiveLandmark(this._highlightLandmark || { id: this.activeLandmarkId });
    if (this.sharedFrame) this.sharedFrame.constructor.setShadows(entry.group, true, true);
    this.map.triggerRepaint();
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
