import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const assetUrl = path => new URL(path, window.location.href).href;
const BIKE_MODEL_URL = assetUrl('./carbon-frame-bike-runtime.glb');
const GAME_SCALE = 3.6;
/** Radians of bar travel at full lock — a bicycle, not a shopping trolley. */
const MAX_STEER = 0.42;
const STEER_EASING = 0.18;
const WHEEL_RADIUS_M = 0.35;
/** The world scale the game uses; kept local so the bundle stays standalone. */
const PIXELS_PER_METER_FALLBACK = 3;
// Reused so a per-frame pose costs no allocation.
const STEER_AXIS = new THREE.Vector3(0, 0, 1);
const WHEEL_AXIS = new THREE.Vector3(0, 1, 0);
const STEER_AXIS_QUAT = new THREE.Quaternion();
const WHEEL_AXIS_QUAT = new THREE.Quaternion();

export class PlayerBike3D {
  constructor(map, maplibregl) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.ready = false;
    this.visible = false;
    this.lngLat = null;
    this.angle = 0;
    this.steerAngle = 0;
    this.wheelSpin = 0;
    this.layer = this._makeLayer();
    map.addLayer(this.layer);
  }

  update(lngLat, angle, visible, steerInput = 0, distancePx = 0) {
    this.lngLat = lngLat;
    this.angle = angle || 0;
    this.visible = !!visible;
    // Ease toward the held direction so the bars settle instead of snapping;
    // the rider is not a servo.
    const target = Math.max(-1, Math.min(1, steerInput || 0)) * MAX_STEER;
    this.steerAngle += (target - this.steerAngle) * STEER_EASING;
    // Roll the wheels by the distance actually travelled, so they stop when the
    // bike stops and never look like they are driving the movement.
    this.wheelSpin = (distancePx || 0) / (PIXELS_PER_METER_FALLBACK * WHEEL_RADIUS_M);
    this.map.triggerRepaint();
  }

  _makeLayer() {
    const owner = this;
    let camera, scene, renderer, model, steer, frontWheel, rearWheel;
    return {
      id: 'player-bike-3d',
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

        new GLTFLoader().load(BIKE_MODEL_URL, (gltf) => {
          const importedBike = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(importedBike);
          const size = bounds.getSize(new THREE.Vector3());
          const scale = 2.15 / Math.max(size.x, size.z, 0.001);
          importedBike.scale.setScalar(scale);
          importedBike.updateMatrixWorld(true);
          const scaledBounds = new THREE.Box3().setFromObject(importedBike);
          const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
          importedBike.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z);
          const presentationMeshes = [];
          importedBike.traverse(child => {
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
          model.add(importedBike);

          // The asset was authored mid-turn, so the front wheel sat visibly
          // cocked against the frame and never moved. Rather than zero it, give
          // it something to do: `Lenker` carries the whole front assembly (fork,
          // wheel, bars), so steering is that node's rotation, and both wheels
          // are discs whose thin local axis is Y, so rolling is a spin about
          // their own Y. Measured off the source GLB, not assumed.
          steer = importedBike.getObjectByName('Lenker') || null;
          frontWheel = importedBike.getObjectByName('RadVorn') || null;
          rearWheel = importedBike.getObjectByName('RadHinten') || null;
          for (const part of [steer, frontWheel, rearWheel]) {
            if (part) part.userData.restQuaternion = part.quaternion.clone();
          }
          // Exposed so a check can measure the pose rather than eyeball it: the
          // bike is often behind a building, and a screenshot is a bad oracle
          // for whether a wheel actually turned.
          owner.parts = { steer, frontWheel, rearWheel };
          // Chase mode sees the street from tens of metres up. A literal-size
          // bicycle disappears there, so scale the complete grounded model as
          // a world-space game piece (without reverting to a screen-space icon).
          model.scale.setScalar(GAME_SCALE);
          scene.add(model);
          owner.ready = true;
          map.triggerRepaint();
        }, undefined, error => console.warn('3D bicycle model unavailable; retaining canvas marker.', error));
      },
      render(_gl, args) {
        if (!owner.ready || !owner.visible || !owner.lngLat || !model) return;
        if (steer) {
          steer.quaternion.copy(steer.userData.restQuaternion)
            .premultiply(STEER_AXIS_QUAT.setFromAxisAngle(STEER_AXIS, owner.steerAngle));
        }
        for (const wheel of [frontWheel, rearWheel]) {
          if (!wheel) continue;
          wheel.quaternion.copy(wheel.userData.restQuaternion)
            .multiply(WHEEL_AXIS_QUAT.setFromAxisAngle(WHEEL_AXIS, owner.wheelSpin));
        }
        const coordinate = owner.maplibregl.MercatorCoordinate.fromLngLat(owner.lngLat, 0.22);
        const units = coordinate.meterInMercatorCoordinateUnits();
        const transform = new THREE.Matrix4()
          .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
          .scale(new THREE.Vector3(units, -units, units))
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI - owner.angle))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(transform);
        renderer.resetState();
        renderer.render(scene, camera);
        owner.map.triggerRepaint();
      },
    };
  }
}
