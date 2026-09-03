/**
 * Google Photorealistic 3D Tiles, for the overview camera only.
 *
 * At street zoom the mesh smears and carries no building identity, so the
 * live gate in `photorealGate.ts` keys off game `camera.zoom`, not metres.
 * This module still only exists to draw the tileset once that gate says yes.
 *
 *
 * ESM rather than IIFE, unlike its sibling 3D bundles: three's DRACOLoader
 * resolves decoder paths at module top level via `new URL(..., import.meta.url)`,
 * which esbuild stubs out of an IIFE and throws "Invalid URL" before any of our
 * code runs. It still shares the one `three.bundle.js` copy via the global.
 */
import { TilesRenderer } from '3d-tiles-renderer';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer/three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const { THREE, MeshoptDecoder } = window.CanalRecallThree;

// Browser key, restricted at Google's end to the Map Tiles API and to this
// game's own origins, so publishing it here grants nothing off-origin. Rotate
// it in the Cloud console rather than by editing a copy into some other file.
const API_KEY = 'AIzaSyBURh1hjGzFqELADfruqrDPhEpl1lRnrPk';

// Re-exported so older tests can still find a number on this module; the live
// gate is `CanalRecallPhotorealGate.ACTIVATION_ZOOM`.
export const ACTIVATION_METERS = 25;

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

const DEG = Math.PI / 180;

/**
 * Amsterdam's height above the WGS84 ellipsoid, in metres. Google's mesh is
 * referenced to the ellipsoid; MapLibre's altitude 0 is sea level (NAP here).
 * Skipping this drops the whole city ~43 m through the basemap — the same
 * separation the eye-height spike had to correct for.
 */
const GEOID_SEPARATION_M = 43;

/**
 * How far the camera may wander from the anchor before the flat local frame is
 * rebuilt under it. MapLibre's mercator metres and a tangent-plane ENU frame
 * only agree near the anchor: by 10 km apart, earth curvature and the mercator
 * scale gradient have each pulled the mesh metres off the basemap. Re-anchoring
 * inside a kilometre keeps that under the width of a canal.
 */
const REANCHOR_METERS = 500;

/**
 * The pair of matrices that put Google's ECEF mesh onto MapLibre's basemap at
 * one place, exported so the placement can be checked without the network.
 *
 * `ecefToLocal` brings ECEF into an east/north/up frame at the anchor, and
 * `localTransform` takes that frame into mercator units at the anchor itself.
 * The anchor is lifted by the geoid separation so ground meets ground; a point
 * at Amsterdam's street level should come out at MapLibre altitude 0.
 */
export function localFrameAt(maplibregl, lng, lat) {
  const enuToEcef = new THREE.Matrix4();
  WGS84_ELLIPSOID.getEastNorthUpFrame(lat * DEG, lng * DEG, GEOID_SEPARATION_M, enuToEcef);
  const ecefToLocal = enuToEcef.invert();

  // East, north and up go straight into mercator: x is east, z is altitude, and
  // the negative y is the whole north-to-south flip, because mercator y grows
  // downward. No extra rotation belongs here — one costs a north/up swap that
  // stands the city on edge.
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const scale = coordinate.meterInMercatorCoordinateUnits();
  const localTransform = new THREE.Matrix4()
    .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
    .scale(new THREE.Vector3(scale, -scale, scale));

  return { ecefToLocal, localTransform };
}

/** An ECEF position for a geodetic coordinate, exported for the same reason. */
export function ellipsoidPosition(lng, lat, ellipsoidHeight) {
  const position = new THREE.Vector3();
  WGS84_ELLIPSOID.getCartographicToPosition(lat * DEG, lng * DEG, ellipsoidHeight, position);
  return position;
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
      this._addLayerWhenStyleReady();
    }
    this.map.triggerRepaint();
  }

  /**
   * `addLayer` throws outright while the style is still settling, and the option
   * is reachable from the settings panel long before the basemap has settled.
   *
   * Asking `isStyleLoaded()` first is not enough: it reports every source, so it
   * drops back to false whenever new basemap tiles are in flight, which is most
   * of the time while the player is moving. Attempting the add and retrying on
   * the next map event is what actually gets the layer in.
   */
  _addLayerWhenStyleReady() {
    if (!this.enabled || this.map.getLayer(this.layer.id)) return;
    try {
      this.map.addLayer(this.layer);
    } catch (err) {
      const retry = () => this._addLayerWhenStyleReady();
      this.map.once('styledata', retry);
      this.map.once('idle', retry);
    }
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
    let scene, camera, tilesCamera, renderer, tiles, localTransform, anchor;

    /**
     * Place the tileset in MapLibre's world.
     *
     * Google serves one global tileset in ECEF, so there is no regional root
     * transform to borrow a local frame from: reading one off the root's
     * bounding sphere aims at the centre of the Earth and yields a latitude of
     * several thousand degrees. The frame has to be built from a place we
     * choose instead, and the only sensible place is wherever the player is.
     *
     * The two matrices themselves are `localFrameAt` above, which is where the
     * convention and the geoid correction are explained.
     */
    const anchorAt = (lng, lat) => {
      const frame = localFrameAt(owner.maplibregl, lng, lat);
      localTransform = frame.localTransform;
      tiles.group.matrix.copy(frame.ecefToLocal);
      tiles.group.matrixAutoUpdate = false;
      tiles.group.updateMatrixWorld(true);
      anchor = { lng, lat };
    };

    /** Metres from the anchor, flat-earth — only ever compared against a threshold. */
    const metersFromAnchor = (lng, lat) => {
      const dLat = (lat - anchor.lat) * 111320;
      const dLng = (lng - anchor.lng) * 111320 * Math.cos(lat * DEG);
      return Math.hypot(dLat, dLng);
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
          const center = map.getCenter();
          anchorAt(center.lng, center.lat);
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
        if (!owner.enabled) return;
        // Only draw once the tileset has placed itself, but never gate the
        // traversal below on `ready`: `tiles.update()` is what discovers and
        // fetches the root tileset in the first place, so waiting for `ready`
        // before calling it deadlocks the layer — no request is ever made,
        // `load-tileset` never fires, and `ready` stays false forever.
        if (owner.ready && localTransform) {
          const center = owner.map.getCenter();
          if (metersFromAnchor(center.lng, center.lat) > REANCHOR_METERS) anchorAt(center.lng, center.lat);
          camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(localTransform);
          const projection = new THREE.Matrix4().fromArray(args.projectionMatrix);
          const view = projection.clone().invert().multiply(camera.projectionMatrix);
          tilesCamera.projectionMatrix.copy(projection);
          tilesCamera.matrixWorldInverse.copy(view);
          tilesCamera.matrixWorld.copy(view).invert();
          renderer.resetState();
          renderer.render(scene, camera);
        }
        tiles.update();
        owner._publishAttribution(tiles);
        owner.map.triggerRepaint();
      }
    };
  }
}

window.CanalRecallGoogleTiles = { GooglePhotorealTiles, ACTIVATION_METERS, localFrameAt, ellipsoidPosition };
