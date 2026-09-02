/**
 * Spike: Google Photorealistic 3D Tiles at cycling eye height.
 *
 * The question this exists to answer is narrow and visual: Google's mesh is
 * authored for oblique aerial viewing, and Canal Recall's camera lives ~1.7 m
 * above an Amsterdam canal quay. Bridges over water are the worst case for
 * photogrammetric reconstruction, so the decision needs screenshots at both
 * heights of the same junction rather than an argument.
 *
 * Deliberately standalone. It bundles its own three.js instead of sharing the
 * game's `three.bundle.js` global, so nothing here can perturb the shipping
 * renderer, and the whole spike can be deleted in one commit.
 */
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, TileCompressionPlugin } from '3d-tiles-renderer/plugins';
import { WGS84_ELLIPSOID, CAMERA_FRAME } from '3d-tiles-renderer/three';
import { Scheduler } from '3d-tiles-renderer/core';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const DEG = Math.PI / 180;

// Named regression locations, per the CLAUDE.md rule that geographic failures
// become pinned places. Each is a canal-side view a player would actually ride.
export const PLACES = {
  prinsengracht: { label: 'Prinsengracht / Westerkerk', lat: 52.37475, lon: 4.88365, az: 20 },
  magerebrug: { label: 'Magere Brug (bridge over water)', lat: 52.36540, lon: 4.90260, az: 285 },
  brouwersgracht: { label: 'Brouwersgracht', lat: 52.38060, lon: 4.88950, az: 95 },
  reguliersgracht: { label: 'Reguliersgracht seven bridges', lat: 52.36420, lon: 4.89600, az: 0 },
  damrak: { label: 'Damrak / Centraal', lat: 52.37680, lon: 4.89830, az: 190 },
};

const BIKE_HEIGHT = 1.7;
const AERIAL_HEIGHT = 150;

export function start({ canvas, apiToken, place = 'prinsengracht', onStatus = () => {} }) {
  const spot = PLACES[place] || PLACES.prinsengracht;
  const view = { lat: spot.lat, lon: spot.lon, height: BIKE_HEIGHT, az: spot.az, el: -2 };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 8000);

  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const tiles = new TilesRenderer();
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken, autoRefreshToken: true }));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  scene.add(tiles.group);

  tiles.addEventListener('load-error', (e) => onStatus({ error: (e.error && e.error.message) || 'tile load error' }));

  // The camera is placed by geodetic pose rather than by moving through ECEF:
  // at 1.7 m the interesting motion is metres along a quay, and lat/lon deltas
  // stay numerically well-behaved where raw ECEF translation would not.
  // Tile geometry is referenced to the WGS84 ellipsoid, but the Netherlands sits
  // ~43 m above it (geoid separation). Taking "1.7 m" as an ellipsoid height put
  // the camera ~41 m underground. Ground truth comes from raycasting the loaded
  // mesh; NAP_FALLBACK only covers the window before tiles arrive.
  const NAP_FALLBACK = 43;
  const _down = new THREE.Vector3();
  const _from = new THREE.Vector3();
  const _carto = {};

  const groundHeight = (lat, lon) => {
    WGS84_ELLIPSOID.getCartographicToPosition(lat * DEG, lon * DEG, 400, _from);
    WGS84_ELLIPSOID.getCartographicToNormal(lat * DEG, lon * DEG, _down);
    const hits = new THREE.Raycaster(_from, _down.negate(), 0, 900).intersectObject(tiles.group, true);
    if (!hits.length) return null;
    // Deepest hit, not first: the first is a roof, tree canopy or awning, and
    // what a cyclist's camera needs is the surface underneath all of that.
    WGS84_ELLIPSOID.getPositionToCartographic(hits[hits.length - 1].point, _carto);
    return _carto.height;
  };

  // Eye height above the street, which is the number that actually matters here.
  // The ground sample is cached: raycasting hundreds of tile meshes every frame
  // starved the parse queue badly enough that tiles never finished loading.
  let eyeHeight = BIKE_HEIGHT;
  let cached = { lat: NaN, lon: NaN, ground: null, frame: -1 };
  let frameNo = 0;
  const applyEyeHeight = () => {
    frameNo++;
    const moved = Math.abs(view.lat - cached.lat) > 2e-5 || Math.abs(view.lon - cached.lon) > 3e-5;
    // Re-sample on movement, and periodically while tiles are still streaming in.
    if (moved || cached.ground == null && frameNo - cached.frame > 20) {
      cached = { lat: view.lat, lon: view.lon, ground: groundHeight(view.lat, view.lon), frame: frameNo };
    }
    view.height = (cached.ground == null ? NAP_FALLBACK : cached.ground) + eyeHeight;
    view.groundFound = cached.ground != null;
  };

  const placeCamera = () => {
    WGS84_ELLIPSOID.getObjectFrame(
      view.lat * DEG, view.lon * DEG, view.height,
      view.az * DEG, view.el * DEG, 0,
      camera.matrixWorld, CAMERA_FRAME,
    );
    camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    camera.updateMatrixWorld(true);
  };

  const move = (forward, right) => {
    const a = view.az * DEG;
    const north = forward * Math.cos(a) - right * Math.sin(a);
    const east = forward * Math.sin(a) + right * Math.cos(a);
    view.lat += north / 111320;
    view.lon += east / (111320 * Math.cos(view.lat * DEG));
  };

  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', (e) => { dragging = false; canvas.releasePointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    view.az += e.movementX * 0.15;
    view.el = Math.max(-89, Math.min(89, view.el - e.movementY * 0.15));
  });

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    tiles.setResolutionFromRenderer(camera, renderer);
  };
  addEventListener('resize', resize);
  resize();

  // One frame, factored out so it can be driven either by rAF (interactive) or
  // pumped by hand (automation). Headless/background tabs throttle rAF to a
  // standstill, which starves the tile traversal and leaves a black canvas —
  // `step()` below is what makes screenshot regressions possible at all.
  const frame = (dt) => {
    // Shift = survey pace; plain = roughly cycling speed (5 m/s).
    const speed = (keys.has('shift') ? 60 : 5) * dt;
    if (keys.has('w')) move(speed, 0);
    if (keys.has('s')) move(-speed, 0);
    if (keys.has('a')) move(0, -speed);
    if (keys.has('d')) move(0, speed);
    if (keys.has('q')) eyeHeight = Math.max(1.2, eyeHeight - speed);
    if (keys.has('e')) eyeHeight += speed;

    applyEyeHeight();
    placeCamera();
    tiles.update();
    // The download/parse queues schedule their work through requestAnimationFrame,
    // which a background or headless tab throttles to a standstill: traversal
    // still marks tiles `queued`, but nothing downloads and the canvas stays
    // black. Flushing pending callbacks makes a hand-pumped frame self-contained.
    Scheduler.flushPending();
    renderer.render(scene, camera);
    onStatus({ view, downloading: tiles.stats.downloading, parsing: tiles.stats.parsing });
  };

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    frame(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    tiles, camera, view,
    frame,
    /** Pump `count` frames, yielding between each so tile fetches can land. */
    async step(count = 60, delayMs = 60) {
      for (let i = 0; i < count; i++) {
        frame(1 / 60);
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return { loaded: tiles.stats.loaded, visible: tiles.stats.visible, downloading: tiles.stats.downloading };
    },
    goTo(key) {
      const next = PLACES[key];
      if (!next) return;
      view.lat = next.lat; view.lon = next.lon; view.az = next.az;
    },
    setHeight(h) { eyeHeight = h; view.el = h > 40 ? -55 : -2; },
    bikeHeight() { this.setHeight(BIKE_HEIGHT); },
    aerial() { this.setHeight(AERIAL_HEIGHT); },
    groundHeight: (lat = view.lat, lon = view.lon) => groundHeight(lat, lon),
    moveTo(lat, lon, az) { view.lat = lat; view.lon = lon; if (az != null) view.az = az; cached.lat = NaN; },
  };
}
