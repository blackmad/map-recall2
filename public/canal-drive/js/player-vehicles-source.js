// three.js is shared across the 3D bundles — see three-runtime-source.js.
import { enuDirectionInLocal, SUN_DIRECTION } from '../../../src/canalRecall/rendererShared/lightRig.ts';
import { multiplyMat4, projectLocalBox } from '../../../src/canalRecall/game/vehicleScreenBox.ts';

const { THREE, GLTFLoader, MeshoptDecoder } = window.CanalRecallThree;

const assetUrl = path => new URL(path, window.location.href).href;

// The chase bicycle is the omafiets, without its optional rear child seat.
// Other bikes (pink city bike, Swapfiets) are kept only for bike-preview.html.
const BIKE_MODEL_URL = assetUrl('./omafiets-runtime.glb');

const BOAT_MODEL_URL = assetUrl('./canal-boat-runtime.glb');
/** Demo chase mesh for transit mode — GVB metro 51 lookalike from mini-amsterdam-3d. */
const TRANSIT_MODEL_URL = assetUrl('./gvb-metro-51-runtime.glb');

/**
 * Chase mode sees the world from tens of metres up. A literal-size bicycle
 * disappears there, so the grounded model is scaled as a world-space game
 * piece rather than reverting to a screen-space icon. The boat is a far bigger
 * object seen over open water, so it needs much less exaggeration.
 */
/** Legacy-layer key light. Was 4.2 while it sat under the model; from above, 4.2 burns the saddle and frame white. */
const VEHICLE_SUN_INTENSITY = 1.6;
const BIKE_GAME_SCALE = 4.5;
/**
 * A world-space piece draws at one CSS size on every screen, so a bike that
 * reads on a phone was 2.7% of a desktop window's short side against 5.4% on
 * the phone (user report 2026-09-28, "the bike is small in the chase view on
 * desktop"). Above this many CSS px of short side the bike grows with the
 * window, up to BIKE_VIEWPORT_MAX_SCALE.
 */
const BIKE_VIEWPORT_REFERENCE_PX = 500;
const BIKE_VIEWPORT_MAX_SCALE = 2;
const BOAT_GAME_SCALE = 1.5;
/** Metro car is ~6 m long; exaggerate more than boat so it reads cartoony at chase altitude. */
const TRANSIT_GAME_SCALE = 3.4;

/**
 * Measured off each model, not assumed. The authored omafiets points its blue
 * front tyre along native +X. The canal sloop's
 * bow is on -X — its transom and motor bracket are the squared-off +X end — so
 * it still takes Math.PI. That boat value is exactly what `boat-model.spec.ts`
 * pins, because a boat sailing stern-first looks very nearly right in a still.
 */
const BIKE_HEADING_OFFSET = 0;
const BOAT_HEADING_OFFSET = Math.PI;
/** Metro-51 source is long on +X; same convention as the bike. Flip to Math.PI if playtests show it reverse. */
const TRANSIT_HEADING_OFFSET = 0;

/** Radians of bar travel at full lock — a bicycle, not a shopping trolley. */
const MAX_STEER = 0.42;
// Omafiets is authored straight: `Lenker` is upright (+Y), wheel axles are +Z.
const AUTHORED_STEER_OFFSET = 0;
const STEER_EASING = 0.18;
const WHEEL_RADIUS_M = 0.35;
/** The world scale the game uses; kept local so the bundle stays standalone. */
const PIXELS_PER_METER_FALLBACK = 3;
/** How far the boat heels into a turn, and how lazily it gets there. */
const MAX_HEEL = 0.16;
const HEEL_EASING = 0.05;

/**
 * Paint a single-primitive boat mesh like a canal sloep. Height is the only
 * reliable cue on this asset: the outer hull sits low, the benches and cockpit
 * rise into the open cockpit, and the gunwale is the thin top rim.
 */
function paintBoatMesh(geometry, hull, seat, gunwale) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const span = Math.max(1e-6, max.y - min.y);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - min.y) / span;
    if (t < 0.42) mixed.copy(hull);
    else if (t < 0.78) mixed.copy(hull).lerp(seat, (t - 0.42) / 0.36);
    else mixed.copy(seat).lerp(gunwale, Math.min(1, (t - 0.78) / 0.22));
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Y-up omafiets: steer about vertical (+Y), roll wheels about the axle (+Z).
const STEER_AXIS = new THREE.Vector3(0, 1, 0);
const WHEEL_AXIS = new THREE.Vector3(0, 0, 1);
const SCRATCH_QUAT = new THREE.Quaternion();

/**
 * The shared MapLibre custom-layer scaffold. Both vehicles load a GLB, ground
 * it, and are drawn in world space with the map's pitch, bearing and depth.
 * They differ in the model, which way its nose points, and what moves — so
 * that is all a subclass supplies.
 */
class Vehicle3D {
  constructor(map, maplibregl, options) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.options = options;
    this.ready = false;
    this.visible = false;
    this.lngLat = null;
    this.angle = 0;
    this.parts = {};
    this._scene = null;
    this._modelRoot = null;
    this.altitudeM = 0.22;
    /** Nose-up pitch (radians) on a bridge ramp; visual only (see elevation/). */
    this.surfacePitch = 0;
    /** Set per frame by the game for the camera zoom; see vehicleZoomScale.ts. */
    this.zoomScale = 1;
    /** CSS-pixel box of the drawn mesh, updated each frame it draws; null otherwise. */
    this.screenBox = null;
    this._localBox = null;
    this.layer = this._makeLayer();
    // `?sharedFrame=1`: draw in the shared frame's overlay pass, which runs
    // last in MapLibre's frame (so the x-ray still sees every building's
    // depth) and is lit by the same rig as the city.
    this.sharedFrame = map._canalSharedFrame || null;
    if (this.sharedFrame) { this._attachShared(); return; }
    map.addLayer(this.layer);
    // Buildings and other 3D layers are added after the vehicles. Keep the
    // vehicle last so their depth is already in the buffer: that is what lets
    // the x-ray pass show the bike through a building instead of the building
    // simply painting over it.
    this._keepOnTop = () => {
      const order = map.style && map.style._order;
      if (!order || !map.getLayer(this.layer.id)) return;
      const vehicleIds = order.filter(id => /^player-.*-3d$/.test(id));
      const tail = order.slice(order.length - vehicleIds.length);
      if (tail.every(id => vehicleIds.includes(id))) return;
      map.moveLayer(this.layer.id);
    };
    map.on('styledata', this._keepOnTop);
  }

  _attachShared() {
    const { id, modelUrl } = this.options;
    this._scene = new THREE.Group();
    this._scene.name = id;
    this._occlusionMaterial = this._makeOcclusionMaterial();
    const order = { 'player-bike-3d': 100, 'player-ferry-3d': 110, 'player-boat-3d': 120, 'player-transit-3d': 130 }[id] ?? 100;
    this.sharedFrame.register(id, {
      root: this._scene,
      onAttach: frame => { this._renderer = frame.renderer; this._loadModel(modelUrl); },
      beforeRender: (ctx) => {
        if (!this.ready || !this.visible || !this.lngLat || !this._modelRoot) { this.screenBox = null; return false; }
        this._modelRoot.scale.setScalar(this.options.gameScale * this.viewportScale() * (this.zoomScale || 1));
        this._pose(this._modelRoot);
        if (ctx && ctx.clipFromWorld && ctx.worldFromMercator) this._updateScreenBox(multiplyMat4(ctx.clipFromWorld.elements, ctx.worldFromMercator.elements));
        this.map.triggerRepaint();
        return true;
      },
      mercatorFromLocal: () => this._transform().elements,
      // The x-ray is drawn by twins in this root (see `addXrayTwins`): the overlay pass is one render. The frame's
      // override pass (one more full render per vehicle) is kept only for the A/B switch `setXrayTwins(false)`.
      xrayMaterial: () => (this._xrayTwins ? null : this._occlusionMaterial),
    }, { pass: 'overlay', order });
  }

  /** A second depth pass paints only model fragments that failed the normal
   *  pass because nearer map geometry covered them. The bike stays
   *  depth-correct in the open, while a building turns it into a restrained
   *  cartoon x-ray instead of making the whole city glassy. */
  _makeOcclusionMaterial() {
    if (this.options.occlusionColor == null) return null;
    return new THREE.MeshBasicMaterial({
      color: this.options.occlusionColor,
      opacity: 0.82,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }

  /** Model → Mercator for this frame's position, heading and ramp pitch. */
  _transform() {
    const coordinate = this.maplibregl.MercatorCoordinate.fromLngLat(
      this.lngLat,
      Number.isFinite(this.altitudeM) ? this.altitudeM : 0.22,
    );
    const units = coordinate.meterInMercatorCoordinateUnits();
    return new THREE.Matrix4()
      .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
      .scale(new THREE.Vector3(units, -units, units))
      .multiply(new THREE.Matrix4().makeRotationZ(this.options.headingOffset - this.angle))
      // In the Z-up map frame, negative Y rotation raises native +X (the bike's nose).
      .multiply(new THREE.Matrix4().makeRotationY(-(this.surfacePitch || 0)))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  }

  /**
   * The mesh's CSS-pixel box this frame (`screenBox`, null while not drawn), from its local bounds, scale and
   * pose transform under the frame's clip-from-Mercator matrix. The START tag keeps off it (vehicleScreenBox.ts).
   */
  _updateScreenBox(clipFromMercator) {
    const box = this._localBox;
    const container = this.map.getContainer && this.map.getContainer();
    if (!box || !container) { this.screenBox = null; return; }
    const clipFromLocal = multiplyMat4(clipFromMercator, this._transform().elements);
    this.screenBox = projectLocalBox(clipFromLocal, box.min, box.max, this._modelRoot.scale.x, container.clientWidth, container.clientHeight);
  }

  setAltitude(metres) {
    const value = Number(metres);
    this.altitudeM = Number.isFinite(value) ? value : 0.22;
  }

  setSurfacePose(metres, pitch) {
    this.setAltitude(metres);
    this.surfacePitch = Number.isFinite(pitch) ? pitch : 0;
  }

  update(lngLat, angle, visible) {
    this.lngLat = lngLat;
    this.angle = angle || 0;
    this.visible = !!visible;
    if (!this.visible) this.screenBox = null;
    this.map.triggerRepaint();
  }

  /** Extra scale for the window size; 1 unless the vehicle opts in. */
  viewportScale() {
    const reference = this.options.viewportReferencePx;
    if (!reference) return 1;
    const container = this.map.getContainer && this.map.getContainer();
    const shortSide = container ? Math.min(container.clientWidth, container.clientHeight) : 0;
    if (!(shortSide > 0)) return 1;
    return Math.max(1, Math.min(this.options.viewportMaxScale || 1, shortSide / reference));
  }

  /** Subclasses pose their moving parts here; a hull has none by default. */
  _pose() {}

  /** Subclasses claim named nodes here, once the model has loaded. */
  _bind() {}

  _mountGltf(gltf) {
    const { gameScale, normaliseTo, widthScale = 1 } = this.options;
    const imported = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(imported);
    const size = bounds.getSize(new THREE.Vector3());
    const uniform = normaliseTo / Math.max(size.x, size.z, 0.001);
    imported.scale.set(uniform, uniform, uniform * widthScale);
    imported.updateMatrixWorld(true);
    const scaledBounds = new THREE.Box3().setFromObject(imported);
    const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
    imported.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z);

    const presentationMeshes = [];
    imported.traverse(child => {
      const materialNames = (Array.isArray(child.material) ? child.material : [child.material])
        .filter(Boolean).map(material => material.name || '').join(' ');
      if (/shadow/i.test(`${child.name || ''} ${materialNames}`)) {
        presentationMeshes.push(child);
        return;
      }
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });
    for (const child of presentationMeshes) child.parent?.remove(child);

    imported.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.side = THREE.DoubleSide;
        mat.transparent = false;
        mat.depthWrite = true;
      }
    });

    if (this._modelRoot && this._scene) {
      this._scene.remove(this._modelRoot);
    }
    // The x-ray as a twin of each mesh in the same scene, so one render draws both (legacy layer and shared frame).
    this._twins = this._occlusionMaterial ? addXrayTwins(imported, this._occlusionMaterial) : [];
    this._xrayTwins = this._twins.length > 0;
    const model = new THREE.Group();
    model.add(imported);
    // Bounds in the model frame (before the per-frame game scale): what `_updateScreenBox` projects.
    model.updateMatrixWorld(true);
    const local = new THREE.Box3().setFromObject(imported);
    this._localBox = { min: [local.min.x, local.min.y, local.min.z], max: [local.max.x, local.max.y, local.max.z] };
    this._bind(imported);
    model.scale.setScalar(gameScale);
    this._scene.add(model);
    this._modelRoot = model;
    this.model = model;
    this._precompile();
    this.ready = true;
    this.map.triggerRepaint();
  }

  /** Compile the model's shaders (and the x-ray's) now, while the ride is
   *  still loading, instead of on the first frame the vehicle is visible. */
  _precompile() {
    if (this.sharedFrame) { this.sharedFrame.compile(this._scene); return; }
    const renderer = this._renderer;
    if (!renderer || !this._scene) return;
    try {
      // The x-ray twins are in the scene: one compile covers both looks.
      renderer.compile(this._scene, new THREE.Camera());
      renderer.resetState();
    } catch (error) {
      this._scene.overrideMaterial = null;
      console.warn('Could not precompile vehicle shaders', error);
    }
  }

  /**
   * Diagnostics (A/B in one page): x-ray twins (default) or, in the shared frame, its override pass as before
   * 2026-10-14 (transparent override material, one more render per vehicle). Returns the mode now in force.
   */
  setXrayTwins(on) {
    const material = this._occlusionMaterial;
    if (!material || !this._twins?.length) return false;
    this._xrayTwins = !!on || !this.sharedFrame;
    for (const twin of this._twins) twin.visible = this._xrayTwins;
    xrayBlending(material, this._xrayTwins);
    this.map.triggerRepaint();
    return this._xrayTwins;
  }

  _loadModel(url) {
    if (!this._scene) return;
    this.ready = false;
    const loader = new GLTFLoader();
    if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    const { label } = this.options;
    loader.load(
      url,
      gltf => this._mountGltf(gltf),
      undefined,
      error => console.warn(`3D ${label} unavailable; retaining canvas marker.`, error),
    );
  }

  _makeLayer() {
    const owner = this;
    const { id, modelUrl, label } = this.options;
    let camera, renderer, occlusionMaterial, sun, sky;
    return {
      id,
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        camera = new THREE.Camera();
        owner._scene = new THREE.Scene();
        // The heading is folded into the camera (`_transform`), so these lights
        // live in the model's frame; `render` re-aims them from the rig's world
        // sun every frame. Before 2026-10-13 they were fixed in model space: the
        // sun turned with the bike ("the sun moves with me"), and sat below it.
        sky = new THREE.HemisphereLight(0xffffff, 0x59636a, 3.2);
        owner._scene.add(sky);
        sun = new THREE.DirectionalLight(0xffffff, VEHICLE_SUN_INTENSITY);
        owner._scene.add(sun);
        occlusionMaterial = owner._makeOcclusionMaterial();
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        owner._renderer = renderer;
        owner._occlusionMaterial = occlusionMaterial;
        owner._loadModel(modelUrl);
      },
      render(_gl, args) {
        if (!owner.ready || !owner.visible || !owner.lngLat || !owner._modelRoot) return;
        owner._modelRoot.scale.setScalar(owner.options.gameScale * owner.viewportScale() * (owner.zoomScale || 1));
        owner._pose(owner._modelRoot);
        const transform = owner._transform();
        owner._updateScreenBox(Array.from(args.defaultProjectionData.mainMatrix));
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(transform);
        sun.position.fromArray(enuDirectionInLocal(transform.elements, SUN_DIRECTION));
        sky.position.fromArray(enuDirectionInLocal(transform.elements, [0, 0, 1]));
        renderer.resetState();
        // One render: the x-ray twins (see `addXrayTwins`) sort ahead of the model and paint, against the
        // map's depth alone, only where nearer map geometry covers it; the model then draws every visible
        // fragment over them. (Two renders, x-ray then normal, until 2026-10-14.)
        renderer.render(owner._scene, camera);
        owner.map.triggerRepaint();
      },
    };
  }
}

/**
 * The x-ray look as part of the scene instead of a second render with an
 * override material. Each mesh gets a twin sharing its geometry and the
 * occlusion material, made opaque-list: same colour, opacity, depth test
 * (GreaterDepth, no depth write) and both sides, blended with the same
 * factors as three's NormalBlending (straight alpha) through CustomBlending,
 * which three still blends on an opaque material and does not force to
 * alpha 1. Being opaque, the twins sort by renderOrder ahead of every model
 * mesh (all opaque: `_mountGltf` sets `transparent = false`), so the depth
 * buffer they test holds only the map's depth, as in the old first pass.
 * Children of their mesh: they follow its pose and its visibility.
 */
function addXrayTwins(root, material) {
  // In place: nothing else uses it, and tests toggle it (bike-xray.spec colorWrite).
  xrayBlending(material, true);
  const twins = [];
  const meshes = [];
  root.traverse(child => { if (child.isMesh && !child.isSkinnedMesh) meshes.push(child); });
  for (const mesh of meshes) {
    const twin = new THREE.Mesh(mesh.geometry, material);
    twin.name = `${mesh.name || 'mesh'}/xray`;
    twin.renderOrder = -1e6;
    twin.frustumCulled = mesh.frustumCulled;
    twin.castShadow = twin.receiveShadow = false;
    twin.raycast = () => {};
    mesh.add(twin);
    twins.push(twin);
  }
  return twins;
}

/** Twin (opaque list, straight-alpha CustomBlending) or override (transparent, NormalBlending) blending of the x-ray. */
function xrayBlending(material, twin) {
  material.transparent = !twin;
  material.blending = twin ? THREE.CustomBlending : THREE.NormalBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendEquationAlpha = twin ? THREE.AddEquation : null;
  material.blendSrcAlpha = twin ? THREE.OneFactor : null;
  material.blendDstAlpha = twin ? THREE.OneMinusSrcAlphaFactor : null;
  material.needsUpdate = true;
}

export class PlayerBike3D extends Vehicle3D {
  constructor(map, maplibregl) {
    super(map, maplibregl, {
      id: 'player-bike-3d',
      modelUrl: BIKE_MODEL_URL,
      label: 'bicycle',
      gameScale: BIKE_GAME_SCALE,
      viewportReferencePx: BIKE_VIEWPORT_REFERENCE_PX,
      viewportMaxScale: BIKE_VIEWPORT_MAX_SCALE,
      headingOffset: BIKE_HEADING_OFFSET,
      normaliseTo: 2.15,
      widthScale: 1.35,
      occlusionColor: 0xffd21f,
    });
    this.steerAngle = 0;
    this.wheelSpin = 0;
  }

  // Named `Lenker` / `RadVorn` / `RadHinten` empties. Missing parts must not
  // throw — chase mode still needs the grounded bicycle if a rebuild drops a node.
  _bind(imported) {
    this.parts = {
      steer: imported.getObjectByName('Lenker') || null,
      frontWheel: imported.getObjectByName('RadVorn') || null,
      rearWheel: imported.getObjectByName('RadHinten') || null,
      babySeat: imported.getObjectByName('BabySeat') || null,
    };
    for (const part of Object.values(this.parts)) {
      if (part && part.quaternion) part.userData.restQuaternion = part.quaternion.clone();
    }
    if (this.parts.steer && AUTHORED_STEER_OFFSET) {
      this.parts.steer.userData.restQuaternion
        .multiply(SCRATCH_QUAT.setFromAxisAngle(STEER_AXIS, AUTHORED_STEER_OFFSET));
    }
    // The omafiets GLB carries an optional child seat; the game never shows it.
    if (this.parts.babySeat) this.parts.babySeat.visible = false;
  }

  update(lngLat, angle, visible, steerInput = 0, distancePx = 0) {
    super.update(lngLat, angle, visible);
    // Keyboard/right-pad: +1 = turn right. With the bike facing +X and steer
    // about +Y, a positive angle yaws the fork toward +Z (the bike's left).
    // Negate so the bars and front wheel follow the turn the rider asked for.
    const target = -Math.max(-1, Math.min(1, steerInput || 0)) * MAX_STEER;
    this.steerAngle += (target - this.steerAngle) * STEER_EASING;
    this.wheelSpin = (distancePx || 0) / (PIXELS_PER_METER_FALLBACK * WHEEL_RADIUS_M);
  }

  _pose() {
    const { steer, frontWheel, rearWheel } = this.parts;
    if (steer) {
      steer.quaternion.copy(steer.userData.restQuaternion)
        .multiply(SCRATCH_QUAT.setFromAxisAngle(STEER_AXIS, this.steerAngle));
    }
    for (const wheel of [frontWheel, rearWheel]) {
      if (!wheel) continue;
      wheel.quaternion.copy(wheel.userData.restQuaternion)
        .multiply(SCRATCH_QUAT.setFromAxisAngle(WHEEL_AXIS, this.wheelSpin));
    }
  }
}

export class PlayerBoat3D extends Vehicle3D {
  constructor(map, maplibregl) {
    super(map, maplibregl, {
      id: 'player-boat-3d', modelUrl: BOAT_MODEL_URL, label: 'boat model',
      gameScale: BOAT_GAME_SCALE, headingOffset: BOAT_HEADING_OFFSET, normaliseTo: 6,
    });
    this.heel = 0;
  }

  // A hull has no steering geometry to turn, so the turn has to be legible in
  // the whole boat: it leans out of the corner and rights itself slowly, which
  // is what reads as "on the water" rather than "sliding on ice".
  update(lngLat, angle, visible, steerInput = 0) {
    super.update(lngLat, angle, visible);
    const target = Math.max(-1, Math.min(1, steerInput || 0)) * MAX_HEEL;
    this.heel += (target - this.heel) * HEEL_EASING;
  }

  // The model is raw geometry: no normals, no materials, no textures — one
  // mesh, one primitive. Without normals glTF requires flat shading; without
  // a material every face is default white. Both are cheaper to supply here
  // than to ship. Colour is painted by height so the same mesh reads as a
  // classic Amsterdam rental sloep (dark green hull, cream seats) instead of
  // bare aluminium. A multi-material swap would need a new GLB.
  _bind(imported) {
    const hull = new THREE.Color(0x1a3d34);
    const seat = new THREE.Color(0xe8dcc4);
    const gunwale = new THREE.Color(0xf4efe4);
    const paint = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.48, metalness: 0.08, vertexColors: true,
    });
    imported.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
      paintBoatMesh(child.geometry, hull, seat, gunwale);
      child.material = paint;
    });
  }

  _pose(model) {
    model.rotation.set(0, 0, 0);
    model.rotateX(this.heel);
  }
}

/**
 * Transit chase vehicle. Rigid hull (no bellows animation) — demo stand-in
 * using the GVB metro 51 mesh. Look-only; no wheel spin yet.
 */
export class PlayerTransit3D extends Vehicle3D {
  constructor(map, maplibregl) {
    super(map, maplibregl, {
      id: 'player-transit-3d',
      modelUrl: TRANSIT_MODEL_URL,
      label: 'transit model',
      gameScale: TRANSIT_GAME_SCALE,
      headingOffset: TRANSIT_HEADING_OFFSET,
      normaliseTo: 6.1,
    });
  }
}

/** Double-ended IJ ferry at its real street-scene scale. */
export class PlayerFerry3D extends Vehicle3D {
  constructor(map, maplibregl) {
    super(map, maplibregl, {
      id: 'player-ferry-3d', modelUrl: assetUrl('./gvb-ferry-runtime.glb'),
      label: 'IJ ferry', gameScale: 1, headingOffset: 0, normaliseTo: 33,
    });
  }
}
