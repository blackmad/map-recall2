import { TilesRenderer } from '3d-tiles-renderer';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';

// three.js is shared across the 3D bundles — see three-runtime-source.js.
const { THREE, MeshoptDecoder } = window.CanalRecallThree;

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
  constructor(map, maplibregl, onReady = () => {}) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.enabled = false;
    this.ready = false;
    this.loading = false;
    this.onReady = onReady;
    this.activeLandmark = null;
    this._highlightedMesh = null;
    // `?sharedFrame=1`: tiles draw in the page's one three.js frame, lit by its
    // rig (no private ambient light), instead of in their own custom layer.
    this.sharedFrame = map._canalSharedFrame || null;
    this._sharedAttached = false;
    this.layer = this.sharedFrame ? null : this._makeLayer();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.sharedFrame) {
      if (this.enabled && !this._sharedAttached) this._attachShared();
      this.map.triggerRepaint();
      return;
    }
    if (this.enabled && !this.map.getLayer(this.layer.id) && !this.loading) {
      this.loading = true;
      this.map.addLayer(this.layer);
    }
    this.map.triggerRepaint();
  }

  setActiveLandmark(landmark) {
    // A landmark resolved to no building (a tree, a statue) has nothing to
    // raycast for: straight down from its point, the ray could only find the
    // building beside it (landmark-buildings.json, 2026-09-30).
    const noBuilding = landmark && Array.isArray(landmark.buildingIds) && !landmark.buildingIds.length;
    this.activeLandmark = landmark && landmark.lngLat && !noBuilding ? landmark : null;
    this._clearHighlight();
    this.map.triggerRepaint();
  }

  _clearHighlight() {
    const mesh = this._highlightedMesh;
    if (!mesh) return;
    if (mesh.userData.canalRecallFeatureHighlight) {
      window.CanalRecallThree.detachHighlightPasses(mesh);
      delete mesh.userData.canalRecallFeatureHighlight;
      this._highlightedMesh = null;
      return;
    }
    const highlighted = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mesh.userData.canalRecallOriginalMaterial;
    for (const material of highlighted) material.dispose();
    delete mesh.userData.canalRecallOriginalMaterial;
    this._highlightedMesh = null;
  }

  /**
   * `fromMercator` maps a Mercator point into the space `tiles.group`'s matrixWorld is expressed in:
   * the tiles' local frame for the legacy layer (default), the frame's world in the shared frame.
   */
  _highlightLandmark(tiles, localTransform, fromMercator = null) {
    if (!this.activeLandmark || this._highlightedMesh || !localTransform) return;
    const [lng, lat] = this.activeLandmark.lngLat;
    const inverse = fromMercator || localTransform.clone().invert();
    const toLocal = altitude => {
      const point = this.maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
      return new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(inverse);
    };
    const origin = toLocal(300);
    const direction = toLocal(-50).sub(origin).normalize();
    const hits = new THREE.Raycaster(origin, direction, 0, 500).intersectObject(tiles.group, true);
    const hit = hits.find(candidate => candidate.object.userData && candidate.object.userData.meshFeatures);
    if (!hit || hit.faceIndex == null) return;

    const mesh = hit.object;
    const meshFeatures = mesh.userData.meshFeatures;
    const infos = meshFeatures.getFeatureInfo();
    const featureIndex = infos.findIndex(info => Number.isInteger(info.attribute));
    if (featureIndex < 0) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    const triangleOffset = hit.faceIndex * 3;
    const vertexIndex = offset => index ? index.getX(triangleOffset + offset) : triangleOffset + offset;
    const a = new THREE.Vector3().fromBufferAttribute(position, vertexIndex(0));
    const b = new THREE.Vector3().fromBufferAttribute(position, vertexIndex(1));
    const c = new THREE.Vector3().fromBufferAttribute(position, vertexIndex(2));
    const localPoint = mesh.worldToLocal(hit.point.clone());
    const barycoord = THREE.Triangle.getBarycoord(localPoint, a, b, c, new THREE.Vector3());
    const featureId = meshFeatures.getFeatures(hit.faceIndex, barycoord)[featureIndex];
    if (featureId == null) return;

    const attributeName = `_feature_id_${infos[featureIndex].attribute}`;
    if (!geometry.getAttribute(attributeName)) return;
    // The default highlight (look/highlight.ts, style a): the building keeps its 3DBAG faces and gets the accent
    // outline, restricted to this feature of the batched tile; `?highlight=yellow` keeps the yellow tint below.
    const { highlightFeature } = window.CanalRecallThree;
    if (highlightFeature && highlightFeature(THREE, mesh, { attribute: attributeName, id: featureId })) {
      mesh.userData.canalRecallFeatureHighlight = true;
      this._highlightedMesh = mesh;
      if (typeof this.onLandmarkHighlighted === 'function') this.onLandmarkHighlighted(this.activeLandmark);
      return;
    }
    const tint = material => {
      const highlighted = material.clone();
      highlighted.onBeforeCompile = shader => {
        shader.uniforms.canalRecallFeatureId = { value: featureId };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nattribute float ${attributeName};\nvarying float canalRecallFeatureIdVarying;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\ncanalRecallFeatureIdVarying = ${attributeName};`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float canalRecallFeatureId;\nvarying float canalRecallFeatureIdVarying;')
          .replace('#include <color_fragment>', '#include <color_fragment>\nif (abs(canalRecallFeatureIdVarying - canalRecallFeatureId) < 0.5) diffuseColor.rgb = vec3(1.0, 0.824, 0.122);');
      };
      highlighted.customProgramCacheKey = () => `canal-recall-highlight-${attributeName}`;
      highlighted.needsUpdate = true;
      return highlighted;
    };
    mesh.userData.canalRecallOriginalMaterial = mesh.material;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
    this._highlightedMesh = mesh;
    // The map drops its locator dot once the building itself is lit (user
    // report 2026-09-29, "both the yellow dot and the yellow building").
    if (typeof this.onLandmarkHighlighted === 'function') this.onLandmarkHighlighted(this.activeLandmark);
  }

  /** Loader and tileset for either path; calls `onRoot(localTransform)` once the tileset is placed. */
  _createTiles(onPlaced) {
    const owner = this;
    const tiles = new TilesRenderer(TILESET_URL);
    tiles.registerPlugin(new GLTFExtensionsPlugin({ meshoptDecoder: MeshoptDecoder }));
    tiles.group.name = '3DBAG LoD2.2';
    let handled = false;
    tiles.addEventListener('load-tileset', () => {
      if (handled) return;
      handled = true;
      const sphere = new THREE.Sphere();
      tiles.getBoundingSphere(sphere);
      const center = sphere.center.clone();
      const rootTransform = tiles.root && tiles.root.transform || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const origin = ecefToLngLatAlt(center.x, center.y, center.z);
      const coordinate = owner.maplibregl.MercatorCoordinate.fromLngLat([origin.lng, origin.lat], origin.alt);
      const localTransform = new THREE.Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new THREE.Vector3(coordinate.meterInMercatorCoordinateUnits(), -coordinate.meterInMercatorCoordinateUnits(), coordinate.meterInMercatorCoordinateUnits()))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      const rotation = new THREE.Matrix3().set(rootTransform[0], rootTransform[1], rootTransform[2], rootTransform[8], rootTransform[9], rootTransform[10], -rootTransform[4], -rootTransform[5], -rootTransform[6]);
      tiles.group.matrix.copy(new THREE.Matrix4().setFromMatrix3(rotation).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)));
      tiles.group.matrixAutoUpdate = false;
      tiles.group.updateMatrixWorld(true);
      onPlaced(localTransform);
      owner.ready = true;
      owner.loading = false;
      owner.setEnabled(owner.enabled);
      owner.onReady();
    });
    tiles.addEventListener('load-error', event => {
      owner.loading = false;
      owner.ready = false;
      console.warn('Detailed 3D BAG buildings unavailable; retaining OSM extrusions.', event.error || event);
    });
    return tiles;
  }

  /**
   * Shared-frame participant: the tileset's local frame is placed in Mercator
   * by `localTransform`, the frame maps that to its eye-relative world, and the
   * rig lights and shadows the tiles like every other layer. The LOD camera
   * lives in that world: the eye is the origin and the view is folded into the
   * projection (`ctx.clipFromWorld`), as the frame's own camera does.
   */
  _attachShared() {
    this._sharedAttached = true;
    this.loading = true;
    const owner = this, tilesCamera = new THREE.PerspectiveCamera();
    tilesCamera.matrixAutoUpdate = false;
    tilesCamera.matrixWorldAutoUpdate = false;
    let localTransform = null;
    const tiles = this._createTiles(transform => { localTransform = transform; });
    tiles.setCamera(tilesCamera);
    tiles.addEventListener('load-model', ({ scene }) => this.sharedFrame.constructor.setShadows(scene, true, true));
    const root = new THREE.Group();
    root.name = 'detailed-buildings-3dbag';
    root.add(tiles.group);
    const fromMercator = new THREE.Matrix4();
    this.sharedFrame.register('detailed-buildings', {
      root,
      onAttach: frame => tiles.setResolutionFromRenderer(tilesCamera, frame.renderer),
      mercatorFromLocal: () => localTransform ? localTransform.elements : null,
      beforeRender: ctx => {
        if (!owner.enabled) return false;
        tilesCamera.projectionMatrix.copy(ctx.clipFromWorld);
        tilesCamera.projectionMatrixInverse.copy(ctx.clipFromWorld).invert();
        tilesCamera.matrixWorld.identity();
        tilesCamera.matrixWorldInverse.identity();
        // 3d-tiles-renderer 0.5 fetches the root tileset on the first update(), so
        // it must run before the tileset is placed (the legacy layer's render()
        // returns before update() until ready, and so never loads).
        tiles.update();
        if (!owner.ready || !localTransform) return false;
        owner._highlightLandmark(tiles, localTransform, fromMercator.copy(ctx.worldFromMercator));
        owner.map.triggerRepaint();
        return true;
      },
    }, { order: 25 });
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
        tiles = new TilesRenderer(TILESET_URL);
        tiles.registerPlugin(new GLTFExtensionsPlugin({ meshoptDecoder: MeshoptDecoder }));
        tiles.group.name = '3DBAG LoD2.2';
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
          owner.setEnabled(owner.enabled);
          owner.onReady();
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
        owner._highlightLandmark(tiles, localTransform);
        owner.map.triggerRepaint();
      }
    };
  }
}
