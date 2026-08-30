// three.js is shared across the 3D bundles — see three-runtime-source.js.
const { THREE, GLTFLoader } = window.CanalRecallThree;

const assetUrl = path => new URL(path, window.location.href).href;
const BIKE_MODEL_URL = assetUrl('./carbon-frame-bike-runtime.glb');
const BOAT_MODEL_URL = assetUrl('./motor-boat-runtime.glb');

/**
 * Chase mode sees the world from tens of metres up. A literal-size bicycle
 * disappears there, so the grounded model is scaled as a world-space game
 * piece rather than reverting to a screen-space icon. The boat is a far bigger
 * object seen over open water, so it needs much less exaggeration.
 */
const BIKE_GAME_SCALE = 3.6;
const BOAT_GAME_SCALE = 1.5;

/**
 * Measured off each model, not assumed: the bicycle's named front wheel is on
 * its native -X, and the motor boat's bow is on +X (its outboard motor is the
 * narrow, tall end at -X). So the two need opposite heading offsets.
 */
const BIKE_HEADING_OFFSET = Math.PI;
const BOAT_HEADING_OFFSET = 0;

/** Radians of bar travel at full lock — a bicycle, not a shopping trolley. */
const MAX_STEER = 0.42;
const STEER_EASING = 0.18;
const WHEEL_RADIUS_M = 0.35;
/** The world scale the game uses; kept local so the bundle stays standalone. */
const PIXELS_PER_METER_FALLBACK = 3;
/** How far the boat heels into a turn, and how lazily it gets there. */
const MAX_HEEL = 0.16;
const HEEL_EASING = 0.05;

// Reused so a per-frame pose costs no allocation.
const STEER_AXIS = new THREE.Vector3(0, 0, 1);
const WHEEL_AXIS = new THREE.Vector3(0, 1, 0);
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
    this.layer = this._makeLayer();
    map.addLayer(this.layer);
  }

  update(lngLat, angle, visible) {
    this.lngLat = lngLat;
    this.angle = angle || 0;
    this.visible = !!visible;
    this.map.triggerRepaint();
  }

  /** Subclasses pose their moving parts here; a hull has none by default. */
  _pose() {}

  /** Subclasses claim named nodes here, once the model has loaded. */
  _bind() {}

  _makeLayer() {
    const owner = this;
    const { id, modelUrl, gameScale, headingOffset, normaliseTo, label } = this.options;
    let camera, scene, renderer, model;
    return {
      id,
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        camera = new THREE.Camera();
        scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x59636a, 3.2));
        const sun = new THREE.DirectionalLight(0xffffff, 4.2);
        sun.position.set(-3, -4, 8);
        scene.add(sun);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;

        new GLTFLoader().load(modelUrl, (gltf) => {
          const imported = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(imported);
          const size = bounds.getSize(new THREE.Vector3());
          imported.scale.setScalar(normaliseTo / Math.max(size.x, size.z, 0.001));
          imported.updateMatrixWorld(true);
          const scaledBounds = new THREE.Box3().setFromObject(imported);
          const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
          // Centre horizontally and sit the model on the ground plane.
          imported.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z);

          // Baked shadow quads are presentation for a lit studio render; here
          // they read as a dark slab following the vehicle around.
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

          model = new THREE.Group();
          model.add(imported);
          owner._bind(imported);
          model.scale.setScalar(gameScale);
          scene.add(model);
          owner.model = model;
          owner.ready = true;
          map.triggerRepaint();
        }, undefined, error => console.warn(`3D ${label} unavailable; retaining canvas marker.`, error));
      },
      render(_gl, args) {
        if (!owner.ready || !owner.visible || !owner.lngLat || !model) return;
        owner._pose(model);
        const coordinate = owner.maplibregl.MercatorCoordinate.fromLngLat(owner.lngLat, 0.22);
        const units = coordinate.meterInMercatorCoordinateUnits();
        const transform = new THREE.Matrix4()
          .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
          .scale(new THREE.Vector3(units, -units, units))
          .multiply(new THREE.Matrix4().makeRotationZ(headingOffset - owner.angle))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(transform);
        renderer.resetState();
        renderer.render(scene, camera);
        owner.map.triggerRepaint();
      },
    };
  }
}

export class PlayerBike3D extends Vehicle3D {
  constructor(map, maplibregl) {
    super(map, maplibregl, {
      id: 'player-bike-3d', modelUrl: BIKE_MODEL_URL, label: 'bicycle model',
      gameScale: BIKE_GAME_SCALE, headingOffset: BIKE_HEADING_OFFSET, normaliseTo: 2.15,
    });
    this.steerAngle = 0;
    this.wheelSpin = 0;
  }

  // The asset was authored mid-turn, so the front wheel sat visibly cocked
  // against the frame and never moved. Rather than zero it, give it something
  // to do: `Lenker` carries the whole front assembly (fork, wheel, bars), so
  // steering is that node's rotation, and both wheels are discs whose thin
  // local axis is Y, so rolling is a spin about their own Y.
  _bind(imported) {
    this.parts = {
      steer: imported.getObjectByName('Lenker') || null,
      frontWheel: imported.getObjectByName('RadVorn') || null,
      rearWheel: imported.getObjectByName('RadHinten') || null,
    };
    for (const part of Object.values(this.parts)) {
      if (part) part.userData.restQuaternion = part.quaternion.clone();
    }
  }

  update(lngLat, angle, visible, steerInput = 0, distancePx = 0) {
    super.update(lngLat, angle, visible);
    // Ease toward the held direction so the bars settle instead of snapping;
    // the rider is not a servo.
    const target = Math.max(-1, Math.min(1, steerInput || 0)) * MAX_STEER;
    this.steerAngle += (target - this.steerAngle) * STEER_EASING;
    // Roll the wheels by the distance actually travelled, so they stop when the
    // bike stops and never look like they are driving the movement.
    this.wheelSpin = (distancePx || 0) / (PIXELS_PER_METER_FALLBACK * WHEEL_RADIUS_M);
  }

  _pose() {
    const { steer, frontWheel, rearWheel } = this.parts;
    if (steer) {
      steer.quaternion.copy(steer.userData.restQuaternion)
        .premultiply(SCRATCH_QUAT.setFromAxisAngle(STEER_AXIS, this.steerAngle));
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
      gameScale: BOAT_GAME_SCALE, headingOffset: BOAT_HEADING_OFFSET, normaliseTo: 9.5,
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

  _pose(model) {
    model.rotation.set(0, 0, 0);
    model.rotateX(this.heel);
  }
}
