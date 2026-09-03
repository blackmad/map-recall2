/**
 * Draw OSM `roof:shape=pyramidal` caps that fill-extrusions cannot.
 *
 * Fed from the same appearance features the wall layer uses. Walls stop at the
 * eaves (`height − roof:height`); this layer draws the cone to the apex. That
 * is what makes the Waag read as the Waag on osmbuildings.org.
 */
import {
  eavesHeightM,
  pyramidalRoofMesh,
  wantsPyramidalRoof,
} from '../../../src/canalRecall/pyramidalRoof.ts';

const { THREE } = window.CanalRecallThree;

function outerRing(geometry) {
  if (!geometry || !geometry.coordinates) return null;
  if (geometry.type === 'Polygon') return geometry.coordinates[0];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0] && geometry.coordinates[0][0];
  return null;
}

function parseColour(hex, fallback = 0x708090) {
  if (typeof hex !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** Mercator transform: local ENU metres → MapLibre world. */
function mercatorTransform(maplibregl, lng, lat) {
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const units = coordinate.meterInMercatorCoordinateUnits();
  return new THREE.Matrix4()
    .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
    .scale(new THREE.Vector3(units, -units, units))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
}

export class PyramidalRoofs {
  constructor(map, maplibregl) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.enabled = true;
    this._entries = [];
    this.layer = this._makeLayer();
    if (!map.getLayer(this.layer.id)) map.addLayer(this.layer);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.map.triggerRepaint();
  }

  /** Replace the roof set from appearance GeoJSON features. */
  setFeatures(features) {
    this._disposeEntries();
    const entries = [];
    for (const feature of features || []) {
      const props = feature.properties || {};
      if (!wantsPyramidalRoof(props)) continue;
      const ring = outerRing(feature.geometry);
      if (!ring) continue;
      const height = Number(props.height);
      const roofHeight = Number(props.roofHeight);
      const eaves = eavesHeightM(height, roofHeight);
      const meshData = pyramidalRoofMesh({
        ring,
        apexHeightM: height,
        eavesHeightM: eaves,
        colour: props.roofColour || props.colour || '#708090',
      });
      if (!meshData) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
      geometry.computeVertexNormals();
      const material = new THREE.MeshLambertMaterial({
        color: parseColour(meshData.colour),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(mercatorTransform(this.maplibregl, meshData.originLng, meshData.originLat));
      mesh.updateMatrixWorld(true);
      entries.push(mesh);
    }
    this._entries = entries;
    this.map.triggerRepaint();
  }

  _disposeEntries() {
    for (const mesh of this._entries) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this._entries = [];
  }

  _makeLayer() {
    const owner = this;
    let scene, camera, renderer;
    return {
      id: 'osm-pyramidal-roofs',
      type: 'custom',
      renderingMode: '3d',
      onAdd(_map, gl) {
        // THREE.Camera, not PerspectiveCamera: MapLibre hands us the full
        // mercator→clip matrix, which we load into projectionMatrix alone.
        camera = new THREE.Camera();
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const sun = new THREE.DirectionalLight(0xfff6e8, 1.6);
        sun.position.set(-0.5, 1.6, 0.9);
        scene.add(sun);
        renderer = new THREE.WebGLRenderer({ canvas: owner.map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
      },
      render(_gl, args) {
        if (!owner.enabled || !scene || !camera || !renderer) return;
        while (scene.children.length > 2) scene.remove(scene.children[scene.children.length - 1]);
        for (const mesh of owner._entries) scene.add(mesh);
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix);
        renderer.resetState();
        renderer.render(scene, camera);
      },
    };
  }
}

window.CanalRecallPyramidalRoofs = { PyramidalRoofs, eavesHeightM, wantsPyramidalRoof };
