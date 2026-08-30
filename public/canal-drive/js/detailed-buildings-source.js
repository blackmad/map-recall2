import { TilesRenderer } from '3d-tiles-renderer';

// three.js is shared across the 3D bundles — see three-runtime-source.js.
const { THREE, GLTFLoader, MeshoptDecoder } = window.CanalRecallThree;

const TILESET_URL = 'https://data.3dbag.nl/v20250903/cesium3dtiles/lod22/tileset.json';

function ecefToLngLatAlt(x, y, z) {
  const a = 6378137.0, e2 = 6.69437999014e-3;
  const b = a * Math.sqrt(1 - e2), ep2 = (a * a - b * b) / (b * b);
  const p = Math.sqrt(x * x + y * y), th = Math.atan2(a * z, b * p);
  const lon = Math.atan2(y, x);
  const lat = Math.atan2(z + ep2 * b * Math.sin(th) ** 3, p - e2 * a * Math.cos(th) ** 3);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return { lng: lon * 180 / Math.PI, lat: lat * 180 / Math.PI, alt: p / Math.cos(lat) - n };
}

export class DetailedBuildings {
  constructor(map, maplibregl) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.enabled = false;
    this.ready = false;
    this.loading = false;
    this.layer = this._makeLayer();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled && !this.map.getLayer(this.layer.id) && !this.loading) {
      this.loading = true;
      this.map.addLayer(this.layer);
    }
    if (this.map.getLayer('building-3d')) {
      this.map.setLayoutProperty('building-3d', 'visibility', this.enabled && this.ready ? 'none' : 'visible');
    }
    this.map.triggerRepaint();
  }

  _makeLayer() {
    const owner = this;
    let scene, camera, tilesCamera, renderer, tiles, localTransform;
    const updateLocalTransform = ([lng, lat, altitude]) => {
      const coordinate = owner.maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
      localTransform = new THREE.Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new THREE.Vector3(coordinate.meterInMercatorCoordinateUnits(), -coordinate.meterInMercatorCoordinateUnits(), coordinate.meterInMercatorCoordinateUnits()))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    };
    return {
      id: 'detailed-buildings-3dbag', type: 'custom', renderingMode: '3d',
      onAdd(map, gl) {
        camera = new THREE.PerspectiveCamera();
        tilesCamera = new THREE.PerspectiveCamera();
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 2.4));
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
        tiles = new TilesRenderer(TILESET_URL);
        tiles.group.name = '3DBAG LoD2.2';
        tiles.setCamera(tilesCamera);
        tiles.setResolutionFromRenderer(tilesCamera, renderer);
        tiles.manager.addHandler(/\.(gltf|glb)$/i, gltfLoader);
        scene.add(tiles.group);
        let handled = false;
        tiles.addEventListener('load-tileset', () => {
          if (handled) return;
          handled = true;
          const sphere = new THREE.Sphere();
          tiles.getBoundingSphere(sphere);
          const center = sphere.center.clone();
          const rootTransform = tiles.root && tiles.root.transform || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
          const origin = ecefToLngLatAlt(center.x, center.y, center.z);
          updateLocalTransform([origin.lng, origin.lat, origin.alt]);
          const rotation = new THREE.Matrix3().set(rootTransform[0], rootTransform[1], rootTransform[2], rootTransform[8], rootTransform[9], rootTransform[10], -rootTransform[4], -rootTransform[5], -rootTransform[6]);
          tiles.group.matrix.copy(new THREE.Matrix4().setFromMatrix3(rotation).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)));
          tiles.group.matrixAutoUpdate = false;
          tiles.group.updateMatrixWorld(true);
          owner.ready = true;
          owner.loading = false;
          owner.setEnabled(owner.enabled);
        });
        tiles.addEventListener('load-error', event => {
          owner.loading = false;
          owner.ready = false;
          console.warn('Detailed 3D BAG buildings unavailable; retaining OSM extrusions.', event.error || event);
        });
      },
      render(_gl, args) {
        if (!owner.enabled || !owner.ready || !localTransform) return;
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(localTransform);
        const projection = new THREE.Matrix4().fromArray(args.projectionMatrix);
        const view = projection.clone().invert().multiply(camera.projectionMatrix);
        tilesCamera.projectionMatrix.copy(projection);
        tilesCamera.matrixWorldInverse.copy(view);
        tilesCamera.matrixWorld.copy(view).invert();
        renderer.resetState();
        renderer.render(scene, camera);
        tiles.update();
        owner.map.triggerRepaint();
      }
    };
  }
}
