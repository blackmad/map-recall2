/**
 * Draw OSM `roof:shape=pyramidal` caps that fill-extrusions cannot.
 *
 * Walls stop at the eaves; this layer draws the cone to the apex. Placement
 * matches the photoreal custom layer: local metres as east/north/up, then
 * translate × scale(s, −s, s) into mercator. GLTF landmarks still use
 * rotateX(π/2) because those assets are Y-up; applying that here stood the
 * Waag cones on edge.
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

/** Local metres relative to the footprint centroid: [east, north, up]. */
function localPositions(vertices, originLng, originLat) {
  const metresPerDegLat = 111320;
  const metresPerDegLng = 111320 * Math.cos(originLat * Math.PI / 180);
  const positions = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    const { lng, lat, altM } = vertices[i];
    const o = i * 3;
    positions[o] = (lng - originLng) * metresPerDegLng;
    positions[o + 1] = (lat - originLat) * metresPerDegLat;
    positions[o + 2] = altM;
  }
  return positions;
}

/**
 * East/north/up metres → mercator.
 *
 * Same as the Google photoreal layer: x is east, z is altitude, and the
 * negative Y scale is the north-to-south mercator flip. `rotateX(π/2)` is for
 * Y-up GLTF, not for this mesh — it swapped north and up and stood the cones
 * on edge (the shards through the Waag's turrets).
 */
function mercatorTransform(maplibregl, lng, lat) {
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const units = coordinate.meterInMercatorCoordinateUnits();
  return new THREE.Matrix4()
    .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
    .scale(new THREE.Vector3(units, -units, units));
}

export class PyramidalRoofs {
  constructor(map, maplibregl) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.enabled = true;
    this._entries = [];
    this.layer = this._makeLayer();
    if (!map.getLayer(this.layer.id)) map.addLayer(this.layer);
    map._pyramidalRoofs = this;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.map.triggerRepaint();
  }

  setFeatures(features) {
    this._disposeEntries();
    const entries = [];
    for (const feature of features || []) {
      const props = feature.properties || {};
      if (!wantsPyramidalRoof(props)) continue;
      const ring = outerRing(feature.geometry)?.map(point => [Number(point[0]), Number(point[1])]);
      if (!ring || ring.length < 4) continue;
      // Skip clipped tile leftovers: a real turret is a few metres across.
      // A tile-boundary slice is a long sliver whose centroid fan looks like
      // a shard through the Waag.
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of ring) {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      }
      const widthM = (maxLng - minLng) * 111320 * Math.cos(minLat * Math.PI / 180);
      const heightM = (maxLat - minLat) * 111320;
      if (!(widthM > 0.5) || !(heightM > 0.5) || widthM > 40 || heightM > 40) continue;
      const height = Number(props.height);
      const roofHeight = Number(props.roofHeight);
      const eaves = eavesHeightM(height, roofHeight);
      const meshData = pyramidalRoofMesh({
        ring,
        apexHeightM: height,
        eavesHeightM: eaves + 0.05,
        colour: props.roofColour || props.colour || '#708090',
      });
      if (!meshData) continue;
      const positions = localPositions(meshData.vertices, meshData.originLng, meshData.originLat);
      let maxRadius = 0;
      for (let i = 1; i < meshData.vertices.length; i++) {
        const o = i * 3;
        maxRadius = Math.max(maxRadius, Math.hypot(positions[o], positions[o + 1]));
      }
      if (maxRadius < 0.4 || maxRadius > 25) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setIndex(new THREE.Uint16BufferAttribute(meshData.indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const material = new THREE.MeshBasicMaterial({
        color: parseColour(meshData.colour),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);
      entries.push({
        mesh,
        scene,
        transform: mercatorTransform(this.maplibregl, meshData.originLng, meshData.originLat),
        id: props.osmId || props.id || null,
        maxRadius,
      });
    }
    this._entries = entries;
    this.debugCount = entries.length;
    this.debugRadii = entries.map(entry => entry.mesh.geometry.boundingSphere?.radius ?? null);
    this.map.triggerRepaint();
  }

  _disposeEntries() {
    for (const entry of this._entries) {
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
    }
    this._entries = [];
  }

  _makeLayer() {
    const owner = this;
    let camera, renderer;
    const mvp = new THREE.Matrix4();
    return {
      id: 'osm-pyramidal-roofs',
      type: 'custom',
      renderingMode: '3d',
      onAdd(_map, gl) {
        camera = new THREE.Camera();
        renderer = new THREE.WebGLRenderer({ canvas: owner.map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
      },
      render(_gl, args) {
        if (!owner.enabled || !camera || !renderer) return;
        const main = args.defaultProjectionData.mainMatrix;
        renderer.resetState();
        for (const entry of owner._entries) {
          mvp.fromArray(main).multiply(entry.transform);
          camera.projectionMatrix.copy(mvp);
          renderer.render(entry.scene, camera);
        }
      },
    };
  }
}

window.CanalRecallPyramidalRoofs = { PyramidalRoofs, eavesHeightM, wantsPyramidalRoof };
