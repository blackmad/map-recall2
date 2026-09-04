/**
 * Browser adapter for the façade twin's massing layer.
 *
 * Thin on purpose: the geometry and colour rules are typed and tested in
 * src/canalRecall/facade/facadeLayer.ts, and this file does only the things that
 * need a live map — sharing the game's WebGL context, keeping the local frame
 * aligned with MapLibre's mercator, and telling the 3DBAG tile layer to stop
 * drawing the buildings this layer now owns.
 */
import { BEAM_COLOUR, buildingGeometry, colourFor, DOOR_COLOUR, FRAME_COLOUR, GLASS_COLOUR, openingGeometry, ownedPandIds, SILL_COLOUR, WATER_COLOUR, waterGeometry } from '../../../src/canalRecall/facade/facadeLayer.ts';
import { RD_NEW } from '../../../src/canalRecall/facade/sources/netherlands.ts';

const { THREE } = window.CanalRecallThree;

export class FacadeTwin {
  constructor(map, maplibregl, options = {}) {
    this.map = map;
    this.maplibregl = maplibregl;
    this.extractUrl = options.extractUrl
      || '/data/extracts/amsterdam/staging/facade-twin/amsterdam-grachtengordel-west/lod22.json';
    this.textureUrl = options.textureUrl || '/canal-drive/facade-textures/manifest.json';
    this.textured = options.textured !== false;
    this.enabled = false;
    this.ready = false;
    this.colourMode = options.colourMode || 'massing';
    this.opacity = 1;
    this.extract = null;
    this.onReady = options.onReady || (() => {});
    this._meshes = [];
    this.layer = this._makeLayer();
  }

  /**
   * Which building is under a longitude and latitude.
   *
   * The projection has to do this conversion; a flat metres-per-degree
   * approximation does not work here. RD New's grid north is the Amersfoort
   * meridian at 5.387°E, and this boundary sits at about 4.88°E, so grid north
   * and true north differ by the meridian convergence — roughly 0.4° at this
   * latitude. Over a kilometre that is a seven-metre rotation, and a canal plot
   * is under six metres wide, so the approximation reliably picks the wrong
   * building the further you get from the origin.
   *
   * Picking in 2D rather than by raycasting the meshes: at a high pitch the
   * click lands on the ground in front of a wall rather than on the wall, which
   * a reviewer fixes by tilting down. Cheap and obvious beats accurate and
   * fragile for a tool whose whole job is making other things checkable.
   */
  pick(lngLat) {
    if (!this.extract) return null;
    const origin = this.extract.metadata.localOrigin;
    const point = RD_NEW.fromLngLat([lngLat.lng ?? lngLat[0], lngLat.lat ?? lngLat[1]]);
    const x = point.x - origin.x, y = point.y - origin.y;
    for (const building of this.extract.buildings) {
      const ring = building.ring;
      let inside = false;
      for (let i = 0, j = ring.length / 2 - 1; i < ring.length / 2; j = i++) {
        const xi = ring[i * 2], yi = ring[i * 2 + 1], xj = ring[j * 2], yj = ring[j * 2 + 1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return building;
    }
    return null;
  }

  /** Pand ids this layer owns, so nothing else draws them. */
  ownedIds() {
    return this.extract ? ownedPandIds(this.extract) : new Set();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled && !this.map.getLayer(this.layer.id)) this.map.addLayer(this.layer);
    for (const mesh of this._meshes) mesh.visible = this.enabled;
    this.map.triggerRepaint();
  }

  /** Draw with the extracted wall textures, or with flat measured colour. */
  setTextured(on) {
    this.textured = !!on;
    this._applyMaps();
    this.map.triggerRepaint();
  }

  /**
   * Whose walls carry a texture right now.
   *
   * Massing and façade both show the building as it looks, so both take the
   * texture. Height and evidence are reporting a number per building — a band,
   * a provenance — and a brick bond drawn over a legend colour makes it
   * unreadable without adding anything true, so those two drop it.
   */
  _applyMaps() {
    const appearance = this.colourMode === 'facade' || this.colourMode === 'massing';
    for (const mesh of this._meshes) {
      const map = (this.textured && appearance) ? (mesh.userData.texture || null) : null;
      if (mesh.material.map !== map) {
        mesh.material.map = map;
        mesh.material.needsUpdate = true;
      }
    }
  }

  setColourMode(mode) {
    this.colourMode = mode;
    if (this.extract && this._meshes.length) this._paint();
    this._applyMaps();
    this.map.triggerRepaint();
  }

  /** Fade the massing against a reference photograph. */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity));
    for (const mesh of this._meshes) {
      mesh.material.opacity = this.opacity;
      mesh.material.transparent = this.opacity < 1;
    }
    this.map.triggerRepaint();
  }

  _paint() {
    const colour = new THREE.Color();
    for (const mesh of this._meshes) {
      const colours = mesh.geometry.getAttribute('color');
      for (const span of mesh.userData.spans) {
        // A span is one contiguous run of vertices with one source of colour:
        // a building's massing, a fixed part colour, or the water.
        const hex = span.building
          ? colourFor(span.building, this.colourMode, span.part)
          : span.hex;
        colour.setHex(hex);
        for (let i = span.from; i < span.to; i++) colours.setXYZ(i, colour.r, colour.g, colour.b);
      }
      colours.needsUpdate = true;
    }
  }

  _makeLayer() {
    const owner = this;
    let scene, camera, renderer, localTransform;

    return {
      id: 'facade-twin-massing', type: 'custom', renderingMode: '3d',

      async onAdd(map, gl) {
        camera = new THREE.PerspectiveCamera();
        scene = new THREE.Scene();
        // Lighting.
        //
        // This was an AmbientLight at 1.5 plus one directional, and an ambient
        // that strong is not lighting — it is a flat wash that adds the same
        // value to every surface regardless of which way it faces. It was doing
        // two bad things at once: washing the measured colours toward white,
        // and flattening every normal, so a reveal, a cornice and a roof pitch
        // all came out the same value as the wall. The scene read as dark
        // *because* of it: the wash raised the floor, so the sun had nothing
        // left to lift the lit faces above.
        //
        // A hemisphere replaces it. Sky above and ground bounce below is what
        // an overcast Dutch afternoon actually is, and it still varies with the
        // normal, so a north-facing wall goes cooler and a sill catches light
        // from below the way a real one does.
        scene.add(new THREE.HemisphereLight(0xc9d9e4, 0x4a4238, 1.35));
        // Sun from the south-west, which is where the afternoon light that
        // makes a canal frontage legible comes from. Vector is in the layer's
        // y-up frame, so y is height and z runs south.
        const sun = new THREE.DirectionalLight(0xffeed2, 1.9);
        sun.position.set(-0.62, 0.66, 0.42);
        scene.add(sun);
        // A cool fill from the opposite side, at a fifth of the sun. Without it
        // every shaded elevation crushes to one flat dark value and the terrace
        // loses its depth — which is the other half of why this looked dark.
        const fill = new THREE.DirectionalLight(0x9fb4c6, 0.42);
        fill.position.set(0.55, 0.30, -0.72);
        scene.add(fill);
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

        // Wall textures, one repeating material each.
        //
        // These used to be packed into a single atlas so the boundary stayed one
        // draw call, and the atlas is exactly why the bricks came out the size
        // of doors. An atlas forces UVs into a cell, so a world-space UV has to
        // be wrapped by hand — `fract(east)` — and a wall quad has only two
        // vertices along its length. Between them the rasteriser interpolates,
        // so `fract` at each end does not repeat the tile fifteen times across a
        // 15 m wall: it stretches *one* tile across the whole thing, or runs it
        // backwards when the fractions happen to descend. Wrapping is the GPU's
        // job and it can only do it on an unwrapped UV, which an atlas forbids.
        //
        // So: a mesh per material, RepeatWrapping, and UVs in real metres. Seven
        // draw calls for the whole canal ring is not a cost worth a bug.
        const textures = new Map();
        // Tile size is per material, not global: brick has a module and has to
        // seam on a perpend, paint and render have none and tile larger so the
        // repeat stops reading as banding. The manifest's top-level value is
        // only the fallback.
        const tileMetres = new Map();
        let fallbackTileM = 0.63;
        try {
          const manifest = await (await fetch(owner.textureUrl)).json();
          fallbackTileM = manifest.metadata?.tileMetres || fallbackTileM;
          for (const tile of manifest.textures || []) {
            tileMetres.set(tile.materialId, tile.tileMetres || fallbackTileM);
          }
          await Promise.all((manifest.textures || []).map(tile => new Promise(resolve => {
            const image = new Image();
            image.onload = () => {
              const texture = new THREE.Texture(image);
              texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
              texture.needsUpdate = true;
              textures.set(tile.materialId, texture);
              resolve();
            };
            image.onerror = resolve;
            image.src = owner.textureUrl.replace(/manifest\.json$/, tile.file);
          })));
        } catch (error) {
          // No texture pack is a fine state: the measured colours still draw.
          console.warn('Façade textures unavailable; drawing flat measured colour.', error);
        }
        owner._tileMetres = tileMetres;
        owner._tileM = fallbackTileM;

        // One bucket per wall material, plus one for everything that is not a
        // textured wall — roofs, joinery, glass, water.
        const buckets = new Map();
        const bucketFor = key => {
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { key, positions: [], normals: [], colours: [], uvs: [], spans: [] };
            buckets.set(key, bucket);
          }
          return bucket;
        };
        const UNTEXTURED = '';

        owner._cache = new Map();
        const colour = new THREE.Color();

        // Axis swap, and it is load-bearing. The geometry is RD-native — x east,
        // y north, z up — because that is what the extract holds and what the
        // geometry check can reason about without a GPU. MapLibre's custom-layer
        // transform is the usual three.js one, which rotates about X by 90°, so
        // it expects y to be *up* and z to run south. Feeding it z-up geometry
        // lays every building flat on the water and draws nothing at the
        // camera's pitch.
        const emit = (bucket, src, i, hex, u, v) => {
          bucket.positions.push(src.positions[i * 3], src.positions[i * 3 + 2], -src.positions[i * 3 + 1]);
          bucket.normals.push(src.normals[i * 3], src.normals[i * 3 + 2], -src.normals[i * 3 + 1]);
          colour.setHex(hex);
          bucket.colours.push(colour.r, colour.g, colour.b);
          bucket.uvs.push(u, v);
        };

        for (const building of extract.buildings) {
          const geometry = buildingGeometry(building);
          owner._cache.set(building.id, geometry);
          const material = building.facade?.wallMaterial;
          const texture = textures.get(material);
          // Origin for this building's UVs. Per-building rather than citywide so
          // the bond stays continuous around its own corners without the UV
          // growing to a thousand tiles and losing precision in a float.
          const ox = building.ring[0], oy = building.ring[1];
          const tileM = tileMetres.get(material) ?? fallbackTileM;

          // Runs of one part in a row become one span, so a colour-mode change
          // is a handful of writes per building rather than one per vertex.
          let i = 0;
          const total = geometry.positions.length / 3;
          while (i < total) {
            const part = geometry.part[i];
            let j = i;
            while (j < total && geometry.part[j] === part) j++;
            // A gable is the front wall continued, so it carries the wall's
            // texture; roof and trim never do.
            const textured = texture && (part === 'wall' || part === 'gable');
            const bucket = bucketFor(textured ? material : UNTEXTURED);
            const from = bucket.positions.length / 3;
            const hex = colourFor(building, owner.colourMode, part);
            for (let k = i; k < j; k++) {
              const east = geometry.positions[k * 3], north = geometry.positions[k * 3 + 1];
              const up = geometry.positions[k * 3 + 2];
              if (!textured) { emit(bucket, geometry, k, hex, 0.5, 0.5); continue; }
              // Horizontal UV runs along the face's own direction.
              //
              // This was the radial distance from the building's first ring
              // vertex, which is only the distance along a wall if the wall
              // points away from that vertex. A wall running across the radius
              // barely changes it at all, so the tile smeared sideways into
              // horizontal streaks — visible as brick stretched to the width of
              // a room. The face's horizontal tangent is perpendicular to its
              // normal, so projecting onto it gives true distance along the
              // wall at any bearing. Coplanar faces stay continuous; corners
              // take a seam, which a corner has anyway.
              const nx = geometry.normals[k * 3], ny = geometry.normals[k * 3 + 1];
              const flat = Math.hypot(nx, ny);
              let u;
              if (flat < 1e-6) {
                // Facing straight up: a flat roof or a coping. Project onto
                // east instead, since there is no wall direction to follow.
                u = (east - ox) / tileM;
              } else {
                const tx = -ny / flat, ty = nx / flat;
                u = ((east - ox) * tx + (north - oy) * ty) / tileM;
              }
              emit(bucket, geometry, k, hex, u, up / tileM);
            }
            bucket.spans.push({ from, to: bucket.positions.length / 3, building, part });
            i = j;
          }
        }

        // Measured openings. Glass, joinery and sills each keep a fixed colour
        // in every mode: they are the measurement being reported, not a legend.
        const trim = bucketFor(UNTEXTURED);
        const OPENING_COLOURS = { glass: GLASS_COLOUR, frame: FRAME_COLOUR, sill: SILL_COLOUR,
          door: DOOR_COLOUR, beam: BEAM_COLOUR };
        for (const building of extract.buildings) {
          const opening = openingGeometry(building);
          if (!opening.positions.length) continue;
          let i = 0;
          const total = opening.positions.length / 3;
          while (i < total) {
            const part = opening.part[i];
            let j = i;
            while (j < total && opening.part[j] === part) j++;
            const hex = OPENING_COLOURS[part] ?? GLASS_COLOUR;
            const from = trim.positions.length / 3;
            for (let k = i; k < j; k++) emit(trim, opening, k, hex, 0.5, 0.5);
            trim.spans.push({ from, to: trim.positions.length / 3, hex });
            i = j;
          }
        }

        // Canal water, flat at its published level. The water is context, not a
        // measurement being reported, so it is tinted independently of any mode.
        const water = waterGeometry(extract);
        if (water.positions.length) {
          const from = trim.positions.length / 3;
          for (let i = 0; i < water.positions.length / 3; i++) {
            emit(trim, water, i, WATER_COLOUR, 0.5, 0.5);
          }
          trim.spans.push({ from, to: trim.positions.length / 3, hex: WATER_COLOUR });
        }

        owner._meshes = [];
        for (const bucket of buckets.values()) {
          if (!bucket.positions.length) continue;
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
          geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colours, 3));
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
          const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
          mesh.userData = { spans: bucket.spans, texture: textures.get(bucket.key) || null };
          mesh.visible = owner.enabled;
          owner._meshes.push(mesh);
          scene.add(mesh);
        }
        owner._applyMaps();

        owner.ready = true;
        owner.onReady(owner);
        map.triggerRepaint();
      },

      render(gl, matrix) {
        owner.renderCalls = (owner.renderCalls || 0) + 1;
        if (!owner.enabled || !owner._meshes.length || !localTransform) { owner.lastSkip = { enabled: owner.enabled, meshes: owner._meshes.length, transform: !!localTransform }; return; }
        owner.drawCalls = (owner.drawCalls || 0) + 1;
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(localTransform);
        renderer.resetState();
        renderer.render(scene, camera);
      },

      onRemove() {
        for (const mesh of owner._meshes) {
          mesh.geometry.dispose();
          mesh.material.map?.dispose();
          mesh.material.dispose();
          scene?.remove(mesh);
        }
        owner._meshes = [];
        owner.ready = false;
      },
    };
  }
}

window.CanalRecallFacadeTwin = { FacadeTwin };
