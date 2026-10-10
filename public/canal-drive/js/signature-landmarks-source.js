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
    this._pending = new Map();
    this._failed = new Set();
    /** One decoded GLB per shared-mesh URL (recipe-pipeline houses); instances clone it and share geometry and materials. */
    this._sharedAssets = new window.CanalRecallSignatureLandmarks.SharedAssetCache();
    this._generation = 0;
    this._removed = false;
    this._onMove = () => { this._requestModels(); this._updateLevels(); };
    this.enabled = true;
    this.suppressing = true;
    /** Specs whose model has loaded and is in the scene. */
    this.shown = new Set();
    this.activeLandmarkId = null;
    /** `?sharedFrame=1`: draw in the page's one three.js frame (no own layer, renderer or lights). */
    this.sharedFrame = options.sharedFrame || null;
    this.layer = this._makeLayer();
    if (this.sharedFrame) this._attachShared(options.sharedOrder ?? 20);
    else map.addLayer(this.layer);
    this._loadStreetChunks();
    this._loadBuildingTypes();
  }

  /**
   * Default on (`?streetChunks=0` disables; hosts opt in with `options.streetChunks`, so review
   * pages that pass a single candidate model are untouched): draw each block face as ONE chunk model (one mesh,
   * per-pand ranges in glTF extras; see streetChunks/manifest.ts) instead of its
   * houses. The houses a chunk replaces leave the model list, and any already
   * drawn are dropped, so nothing is drawn twice. No flag or no manifest: no change.
   */
  _loadStreetChunks() {
    const { streetChunksEnabled, applyStreetChunks } = window.CanalRecallSignatureLandmarks;
    if (this.streetChunks !== true) return;
    if (!streetChunksEnabled?.(window.location.search)) return;
    fetch(new URL('./ordinary-buildings-data/chunks.json', window.location.href), { cache: 'no-cache' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`chunks.json ${response.status}`)))
      .then(manifest => {
        if (this._removed) return;
        const { models, replaced } = applyStreetChunks(this.models, manifest);
        this.models = models;
        this._dropEntries(replaced);
        this._requestModels();
      })
      .catch(error => console.warn('Street chunks unavailable; keeping per-house models.', error));
  }

  /**
   * `?buildingTypes=1` (default OFF; game host only): shared unit meshes drawn with THREE.InstancedMesh for the
   * Nieuw-West pilot areas (src/canalRecall/buildingTypes/runtime.ts, bundled as js/building-types.bundle.js).
   * One spec per area; its scene is built by `spec.sceneFactory`, and its `suppressOsmIds` are the BAG panden it
   * replaces, so the OSM/BAG extrusion is suppressed exactly like a street chunk's. No flag, no data: no change.
   */
  _loadBuildingTypes() {
    let on = false;
    try { on = new URLSearchParams(window.location.search).get('buildingTypes') === '1'; } catch { /* no location */ }
    if (!on || this.streetChunks !== true) return;
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
            attribution: { title: `Building types: ${area}`, author: 'Map Recall', sourceUrl: 'https://data.amsterdam.nl/', licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Parametric facade types fitted to BAG footprints; photo-confirmed per building.' },
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
    for (const entry of this._entries || []) {
      if (!this.canShowModel(entry.spec) || !entry.pickProjection || !this._nearby(entry.spec, entry.placement.anchor)) continue;
      const inverse = entry.pickProjection.clone().invert();
      const near = new THREE.Vector3(nx, ny, -1).applyMatrix4(inverse);
      const far = new THREE.Vector3(nx, ny, 1).applyMatrix4(inverse);
      entry.group.updateWorldMatrix(true, true);
      const ray = new THREE.Raycaster(near, far.sub(near).normalize());
      const hit = ray.intersectObject(entry.group, true).find(hit => hit.object.visible);
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
    for (const entry of this._entries || []) {
      const highlighted = (entry.spec.landmarkId === this.activeLandmarkId || (entry.spec.relatedLandmarkIds || []).includes(this.activeLandmarkId));
      if (entry.highlighted === highlighted) continue;
      entry.highlighted = highlighted;
      entry.group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!material.emissive) continue;
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
    return withinView(bounds || plainBounds(this.map.getBounds()), anchor, radius);
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
        this._sharedAssets.acquire(url, () => loader.loadAsync(url).then(gltf => this._dress(gltf) ?? gltf).then(gltf => this._shade(gltf)))
          .then(gltf => onLoaded({ scene: gltf.scene.clone(true) }), onError);
      } else loader.load(url, gltf => { const dressing = this._dress(gltf); if (dressing) dressing.then(dressed => onLoaded(this._shade(dressed)), onError); else onLoaded(this._shade(gltf)); }, undefined, onError);
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
   * facades around them. Other models pass through untouched (returns null:
   * they keep the synchronous load path).
   */
  _dress(gltf) {
    let tagged = false;
    gltf.scene.traverse(child => { if (child.isMesh && child.material?.userData?.materialSlot) tagged = true; });
    if (!tagged) return null;
    if (!this._recipeLookReady) {
      const image = new Image();
      image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
      this._recipeLookReady = image.decode().then(() => image, () => null)
        .then(brick => { this._recipeLook = createRecipeLook(THREE, { brick, anisotropy: window.matchMedia?.('(pointer: coarse)').matches ? 1 : 4 }); return this._recipeLook; });
    }
    return this._recipeLookReady.then(look => { look.apply(gltf.scene); gltf.scene.userData.recipeLook = true; return gltf; });
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
        scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x6b7480, 1.15));
        const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
        sun.position.set(-0.5, 1.6, 0.9);
        scene.add(sun);
        // A weak opposite fill so north-facing walls are readable rather than
        // silhouettes; buildings here are seen from every side while riding.
        const fill = new THREE.DirectionalLight(0xc9dcea, 0.55);
        fill.position.set(0.8, 0.4, -1.1);
        scene.add(fill);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        owner._setup(map, scene);
      },
      onRemove(map) {
        owner._removed = true;
        owner._generation++;
        owner._hostOpeningRevision = '[]';
        owner.onHostWallOpeningsChanged();
        map.off('moveend', owner._onMove);
        owner._pending.clear();
        for (const entry of owner._entries) { owner._disposeModel(entry.group, entry.spec, entry.url); owner._disposeSpare(entry); }
        owner._entries = [];
        owner.shown.clear();
        owner._loader = null;
        owner._lightScene = null;
        owner._applySuppression();
        // This renderer borrows MapLibre's context: release resources, never lose it.
        renderer?.dispose();
      },
      render(_gl, args) {
        if (owner._removed || !owner.enabled || !owner._entries.length) return;
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
    if (!entry.holder || !entry.units) return false;
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
    if (holder) {
      holder.matrix.copy(transform);
      holder.matrixWorldNeedsUpdate = true;
      this._sharedRoot.add(holder);
    }
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
    if (!this._hasLod(spec) || window.__canalRecallLandmarkLod === false) return 'full';
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
    if (this._removed || !this.enabled || !this._loader || window.__canalRecallLandmarkLod === false) return;
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
      this._swapLevel(entry, this._shade(gltf).scene, level);
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
    entry.group.add(incoming);
    entry.group.remove(outgoing);
    entry.imported = incoming;
    entry.spare = outgoing; entry.spareLevel = entry.level;
    entry.level = level;
    // Highlight, depth bias and shadows are per material: reapply to the new level.
    const active = entry.highlighted;
    entry.highlighted = false; entry.depthBias = null;
    this._applySuppression();
    if (active) this.setActiveLandmark({ id: this.activeLandmarkId });
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
