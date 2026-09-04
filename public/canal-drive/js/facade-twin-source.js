/**
 * Browser adapter for the façade twin's massing layer.
 *
 * Thin on purpose: the geometry and colour rules are typed and tested in
 * src/canalRecall/facade/facadeLayer.ts, and this file does only the things that
 * need a live map — sharing the game's WebGL context, keeping the local frame
 * aligned with MapLibre's mercator, and telling the 3DBAG tile layer to stop
 * drawing the buildings this layer now owns.
 */
import { buildingGeometry, colourFor, GLASS_COLOUR, openingGeometry, ownedPandIds } from '../../../src/canalRecall/facade/facadeLayer.ts';

const { THREE } = window.CanalRecallThree;

export class FacadeTwin {
  constructor(map, maplibregl, options = {}) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.extractUrl = options.extractUrl
      || '/data/extracts/amsterdam/staging/facade-twin/amsterdam-grachtengordel-west/lod22.json';
    this.enabled = false;
    this.ready = false;
    this.colourMode = options.colourMode || 'massing';
    this.opacity = 1;
    this.extract = null;
    this.onReady = options.onReady || (() => {});
    this._mesh = null;
    this.layer = this._makeLayer();
  }

  /** Pand ids this layer owns, so nothing else draws them. */
  ownedIds() {
    return this.extract ? ownedPandIds(this.extract) : new Set();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled && !this.map.getLayer(this.layer.id)) this.map.addLayer(this.layer);
    if (this._mesh) this._mesh.visible = this.enabled;
    this.map.triggerRepaint();
  }

  setColourMode(mode) {
    this.colourMode = mode;
    if (this.extract && this._mesh) this._paint();
    this.map.triggerRepaint();
  }

  /** Fade the massing against a reference photograph. */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity));
    if (this._mesh) {
      this._mesh.material.opacity = this.opacity;
      this._mesh.material.transparent = this.opacity < 1;
    }
    this.map.triggerRepaint();
  }

  _paint() {
    const colours = this._mesh.geometry.getAttribute('color');
    let vertex = 0;
    const colour = new THREE.Color();
    for (const building of this.extract.buildings) {
      const { positions, isRoof } = this._cache.get(building.id);
      for (let i = 0; i < positions.length / 3; i++) {
        colour.setHex(colourFor(building, this.colourMode, isRoof[i] ? 'roof' : 'wall'));
        colours.setXYZ(vertex++, colour.r, colour.g, colour.b);
      }
    }
    // Openings stay glass in every mode: they are the measurement, not a legend.
    colour.setHex(GLASS_COLOUR);
    for (const [from, to] of this._openingRanges || []) {
      for (let i = from; i < to; i++) colours.setXYZ(i, colour.r, colour.g, colour.b);
    }
    colours.needsUpdate = true;
  }

  _makeLayer() {
    const owner = this;
    let scene, camera, renderer, localTransform;

    return {
      id: 'facade-twin-massing', type: 'custom', renderingMode: '3d',

      async onAdd(map, gl) {
        camera = new THREE.PerspectiveCamera();
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
        const sun = new THREE.DirectionalLight(0xfff4e6, 1.4);
        sun.position.set(-0.5, -1, 1.2);
        scene.add(sun);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;

        let extract;
        try {
          const response = await fetch(owner.extractUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          extract = await response.json();
        } catch (error) {
          // A missing extract must leave the existing city alone, never blank it.
          console.warn('Façade twin massing unavailable; keeping the existing buildings.', error);
          return;
        }
        owner.extract = extract;

        // The extract is metres from a fixed RD origin; MapLibre wants mercator.
        // Anchoring once at that origin keeps every building in one buffer.
        const [lng, lat] = extract.metadata.localOriginLngLat;
        const anchor = owner.maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
        const scale = anchor.meterInMercatorCoordinateUnits();
        localTransform = new THREE.Matrix4()
          .makeTranslation(anchor.x, anchor.y, anchor.z)
          .scale(new THREE.Vector3(scale, -scale, scale))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

        owner._cache = new Map();
        const positions = [], normals = [], colours = [];
        const colour = new THREE.Color();
        for (const building of extract.buildings) {
          const geometry = buildingGeometry(building);
          owner._cache.set(building.id, geometry);
          for (let i = 0; i < geometry.positions.length / 3; i++) {
            // Axis swap, and it is load-bearing. The geometry is RD-native —
            // x east, y north, z up — because that is what the extract holds and
            // what the geometry check can reason about without a GPU. MapLibre's
            // custom-layer transform is the usual three.js one, which rotates
            // about X by 90°, so it expects y to be *up* and z to run south.
            // Feeding it z-up geometry lays every building flat on the water and
            // draws nothing at the camera's pitch.
            const east = geometry.positions[i * 3];
            const north = geometry.positions[i * 3 + 1];
            const up = geometry.positions[i * 3 + 2];
            positions.push(east, up, -north);
            normals.push(geometry.normals[i * 3], geometry.normals[i * 3 + 2], -geometry.normals[i * 3 + 1]);
            colour.setHex(colourFor(building, owner.colourMode, geometry.isRoof[i] ? 'roof' : 'wall'));
            colours.push(colour.r, colour.g, colour.b);
          }
        }

        // Measured openings, appended to the same buffers. Tagged so a colour
        // mode change repaints walls and roofs without turning glass into brick.
        owner._openingRanges = [];
        for (const building of extract.buildings) {
          const opening = openingGeometry(building);
          if (!opening.positions.length) continue;
          const from = positions.length / 3;
          for (let i = 0; i < opening.positions.length / 3; i++) {
            positions.push(opening.positions[i * 3], opening.positions[i * 3 + 2], -opening.positions[i * 3 + 1]);
            normals.push(opening.normals[i * 3], opening.normals[i * 3 + 2], -opening.normals[i * 3 + 1]);
            colour.setHex(GLASS_COLOUR);
            colours.push(colour.r, colour.g, colour.b);
          }
          owner._openingRanges.push([from, positions.length / 3]);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
        owner._mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
        owner._mesh.visible = owner.enabled;
        scene.add(owner._mesh);

        owner.ready = true;
        owner.onReady(owner);
        map.triggerRepaint();
      },

      render(gl, matrix) {
        owner.renderCalls = (owner.renderCalls || 0) + 1;
        if (!owner.enabled || !owner._mesh || !localTransform) { owner.lastSkip = { enabled: owner.enabled, mesh: !!owner._mesh, transform: !!localTransform }; return; }
        owner.drawCalls = (owner.drawCalls || 0) + 1;
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(localTransform);
        renderer.resetState();
        renderer.render(scene, camera);
      },

      onRemove() {
        if (owner._mesh) {
          owner._mesh.geometry.dispose();
          owner._mesh.material.dispose();
          owner._mesh = null;
        }
        owner.ready = false;
      },
    };
  }
}

window.CanalRecallFacadeTwin = { FacadeTwin };
