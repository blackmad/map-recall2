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
const { THREE, GLTFLoader, MeshoptDecoder } = window.CanalRecallThree;
const { SIGNATURE_MODELS, placementFor } = window.CanalRecallSignatureLandmarks;

const assetUrl = path => new URL(path, window.location.href).href;

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
   */
  constructor(map, maplibregl, options = {}) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.onModelShown = options.onModelShown || (() => {});
    /** Which specs to draw. Defaults to the whole curated list; the demo passes
     *  a single candidate so an asset can be judged before it is committed. */
    this.models = options.models || SIGNATURE_MODELS;
    this.enabled = true;
    this.suppressing = true;
    /** Specs whose model has loaded and is in the scene. */
    this.shown = new Set();
    this.activeLandmarkId = null;
    this.layer = this._makeLayer();
    map.addLayer(this.layer);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    // A hidden model must give its extrusion back, or the Dam has a hole in it.
    this._applySuppression();
    this.map.triggerRepaint();
  }

  /** Turns footprint suppression on or off without unloading anything. */
  setSuppressing(suppressing) {
    this.suppressing = !!suppressing;
    this._applySuppression();
    this.map.triggerRepaint();
  }

  /** Mirrors the extrusion layer's highlight onto the models, so a landmark
   *  question looks the same whichever representation is on screen. */
  setActiveLandmark(landmark) {
    this.activeLandmarkId = landmark && landmark.id ? landmark.id : null;
    for (const entry of this._entries || []) {
      const highlighted = entry.spec.landmarkId === this.activeLandmarkId;
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
   * Makes the model win against the extrusion it replaces, rather than
   * deleting that extrusion.
   *
   * Removing the grey box is what this should do, and it cannot be done. The
   * three obvious routes are all closed on this basemap:
   *
   *  - Filtering by feature id. OpenMapTiles batches buildings by height: one
   *    feature on the Dam carries 498 separate rings and shares its id with
   *    buildings a kilometre away. Excluding that id deletes half the centre.
   *  - Filtering by geometry with `within`. That expression only evaluates
   *    point and line features, so against building polygons it matches
   *    nothing and silently suppresses nothing — it fails green.
   *  - A `clip` layer. MapLibre GL JS 5.24 has no such layer type; it is a
   *    Mapbox GL feature. `addLayer` accepts it and then reports the error
   *    asynchronously, which is why it looked like it worked.
   *
   * So the model is biased towards the camera instead. The extrusion's front
   * wall and the model's facade are very nearly coplanar — the model is
   * deliberately pushed forward onto the same footprint edge — and a depth tie
   * is what put the grey in front. A polygon offset settles the tie in the
   * model's favour without disabling the depth test, so a building genuinely
   * between the player and the Palace still occludes it properly.
   *
   * This turns out to suit this particular asset. The model is only 24.5 m
   * deep against a 65.5 m footprint, so a real suppression would leave a 41 m
   * notch in the block behind it. Leaving the extrusion standing fills that in
   * with the grey mass the rest of the city already uses.
   */
  _applySuppression() {
    const bias = this.enabled && this.suppressing ? -1 : 0;
    for (const entry of this._entries || []) {
      if (entry.depthBias === bias) continue;
      entry.depthBias = bias;
      entry.group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.polygonOffset = bias !== 0;
          material.polygonOffsetFactor = bias * 32;
          material.polygonOffsetUnits = bias * 4096;
          material.needsUpdate = true;
        }
      });
    }
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
        // Flat daylight. A directional key from the south-west matches the
        // basemap's own baked shading closely enough that a model does not
        // read as lit from a different sun than the street it stands on.
        scene.add(new THREE.HemisphereLight(0xffffff, 0x59636a, 2.6));
        const sun = new THREE.DirectionalLight(0xffffff, 2.6);
        sun.position.set(-0.6, -1, 1.4);
        scene.add(sun);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;

        const loader = new GLTFLoader();
        // The runtime GLBs are EXT_meshopt_compression; without this the load
        // fails and every landmark silently falls back to its grey box.
        if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);

        for (const spec of owner.models) {
          loader.load(
            assetUrl(spec.modelUrl),
            gltf => owner._add(scene, spec, gltf.scene, map),
            undefined,
            error => console.warn(
              `Signature model for ${spec.name} unavailable; keeping the OSM extrusion.`,
              error,
            ),
          );
        }
      },
      render(_gl, args) {
        if (!owner.enabled || !owner._entries.length) return;
        for (const entry of owner._entries) {
          camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(entry.transform);
          renderer.resetState();
          renderer.render(entry.scene, camera);
        }
      },
    };
  }

  /** Normalises a loaded model onto its anchor and builds its fixed transform.
   *  Buildings do not move, so the matrix is computed once here rather than
   *  every frame. */
  _add(scene, spec, imported, map) {
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

    // Each model gets its own scene: the transform below is baked into the
    // camera rather than the object, because MapLibre hands us a projection
    // matrix per frame and Mercator units differ with latitude.
    const modelScene = new THREE.Scene();
    for (const light of scene.children.filter(child => child.isLight)) modelScene.add(light.clone());
    modelScene.add(group);

    const coordinate = this.maplibregl.MercatorCoordinate.fromLngLat(
      placement.anchor,
      placement.altitudeMetres,
    );
    const units = coordinate.meterInMercatorCoordinateUnits();
    const transform = new THREE.Matrix4()
      .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
      .scale(new THREE.Vector3(units, -units, units))
      .multiply(new THREE.Matrix4().makeRotationZ(rotationForBearing(placement.modelRotationDegrees)))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

    this._entries.push({ spec, group, scene: modelScene, transform, highlighted: false, placement });
    this.shown.add(spec.id);
    // Only now is it safe to take the grey box away.
    this._applySuppression();
    this.onModelShown(spec, placement);
    map.triggerRepaint();
  }

  /** What is actually on screen, for tests and for the demo readout. */
  describe() {
    return (this._entries || []).map(entry => ({
      id: entry.spec.id,
      name: entry.spec.name,
      placement: entry.placement,
      attribution: entry.spec.attribution,
    }));
  }
}
