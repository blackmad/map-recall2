/**
 * Google Photorealistic 3D Tiles, for the overview camera only.
 *
 * Measured before it was built (see HISTORY.md): Google's mesh is excellent
 * from ~25 m up and unusable at cycling height, where trees collapse to blobs
 * and the quay melts. It also returns anonymous triangle soup, so nothing in it
 * can be highlighted as a correct answer or carry a fact card. Both limits push
 * the same way, so this layer deliberately only exists above ACTIVATION_METERS
 * and hands back to 3DBAG below it, where the player actually rides.
 *
 * ESM rather than IIFE, unlike its sibling 3D bundles: three's DRACOLoader
 * resolves decoder paths at module top level via `new URL(..., import.meta.url)`,
 * which esbuild stubs out of an IIFE and throws "Invalid URL" before any of our
 * code runs. It still shares the one `three.bundle.js` copy via the global.
 */
import { TilesRenderer } from '3d-tiles-renderer';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const { THREE, MeshoptDecoder } = window.CanalRecallThree;

// Browser key, restricted at Google's end to the Map Tiles API and to this
// game's own origins, so publishing it here grants nothing off-origin. Rotate
// it in the Cloud console rather than by editing a copy into some other file.
const API_KEY = 'AIzaSyBURh1hjGzFqELADfruqrDPhEpl1lRnrPk';

// Below this camera altitude the mesh stops being worth its cost. 25 m is where
// the measured screenshots still read cleanly; 10 m was already smearing.
export const ACTIVATION_METERS = 25;

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

function ecefToLngLatAlt(x, y, z) {
  const a = 6378137.0, e2 = 6.69437999014e-3;
  const b = a * Math.sqrt(1 - e2), ep2 = (a * a - b * b) / (b * b);
  const p = Math.sqrt(x * x + y * y), th = Math.atan2(a * z, b * p);
  const lon = Math.atan2(y, x);
  const lat = Math.atan2(z + ep2 * b * Math.sin(th) ** 3, p - e2 * a * Math.cos(th) ** 3);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return { lng: lon * 180 / Math.PI, lat: lat * 180 / Math.PI, alt: p / Math.cos(lat) - n };
}

export class GooglePhotorealTiles {
  constructor(map, maplibregl, onAttribution = () => {}) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.enabled = false;
    this.ready = false;
    this.loading = false;
    this.failed = false;
    this.onAttribution = onAttribution;
    this._attribution = '';
    this.layer = this._makeLayer();
  }

  setEnabled(enabled) {
    const next = !!enabled && !this.failed;
    if (next === this.enabled) return;
    this.enabled = next;
    if (this.enabled && !this.map.getLayer(this.layer.id) && !this.loading) {
      this.loading = true;
      this.map.addLayer(this.layer);
    }
    this.map.triggerRepaint();
  }

  /** Google's terms require visible attribution whenever its imagery is shown. */
  _publishAttribution(tiles) {
    if (!tiles.getAttributions) return;
    const parts = tiles.getAttributions().map(a => a.value).filter(Boolean);
    const next = parts.join(' · ');
    if (next === this._attribution) return;
    this._attribution = next;
    this.onAttribution(next);
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
      id: 'google-photoreal-tiles', type: 'custom', renderingMode: '3d',
      onAdd(map, gl) {
        camera = new THREE.PerspectiveCamera();
        tilesCamera = new THREE.PerspectiveCamera();
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 2.4));
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;

        const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
        tiles = new TilesRenderer();
        tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: API_KEY, autoRefreshToken: true }));
        tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, meshoptDecoder: MeshoptDecoder }));
        tiles.group.name = 'Google Photorealistic 3D Tiles';
        tiles.setCamera(tilesCamera);
        tiles.setResolutionFromRenderer(tilesCamera, renderer);
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
        });
        tiles.addEventListener('load-error', event => {
          owner.loading = false;
          owner.ready = false;
          // One failure is enough to stop asking: a bad key or a referrer block
          // fails identically for every tile, and retrying bills for nothing.
          owner.failed = true;
          owner.enabled = false;
          console.warn('Google photorealistic tiles unavailable; keeping 3DBAG buildings.', event.error || event);
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
        owner._publishAttribution(tiles);
        owner.map.triggerRepaint();
      }
    };
  }
}

window.CanalRecallGoogleTiles = { GooglePhotorealTiles, ACTIVATION_METERS };
