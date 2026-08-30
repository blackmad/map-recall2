import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const assetUrl = path => new URL(path, window.location.href).href;
const BIKE_MODEL_URL = assetUrl('./carbon-frame-bike-runtime.glb');
const GAME_SCALE = 3.6;

export class PlayerBike3D {
  constructor(map, maplibregl) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.ready = false;
    this.visible = false;
    this.lngLat = null;
    this.angle = 0;
    this.layer = this._makeLayer();
    map.addLayer(this.layer);
  }

  update(lngLat, angle, visible) {
    this.lngLat = lngLat;
    this.angle = angle || 0;
    this.visible = !!visible;
    this.map.triggerRepaint();
  }

  _makeLayer() {
    const owner = this;
    let camera, scene, renderer, model;
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
