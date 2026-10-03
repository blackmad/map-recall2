"use strict";
var CanalRecallInventoryTrees = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // public/canal-drive/js/inventory-trees-source.js
  var inventory_trees_source_exports = {};
  __export(inventory_trees_source_exports, {
    InventoryTrees: () => InventoryTrees
  });

  // public/canal-drive/da-costa-block/tree-typology.js
  var TREE_TYPOLOGY_VERSION = "inventory-crown-priors/v2";
  var nursery = (name) => "https://www.vdberk.com/trees/" + name + "/";
  var rules = [
    [/^betula pubescens$/, "upright-oval", "species-prior", nursery("betula-pubescens")],
    [/^alnus cordata$/, "pyramidal", "species-prior", nursery("alnus-cordata")],
    [/^quercus palustris$/, "pyramidal", "species-prior", nursery("quercus-palustris")],
    [/^populus canescens$/, "irregular-spreading", "species-prior", nursery("populus-canescens")],
    [/^populus canadensis 'robusta'$/, "pyramidal", "cultivar-prior", nursery("populus-canadensis-robusta")],
    [/^fraxinus excelsior 'westhof's glorie'$/, "airy-oval", "cultivar-prior", nursery("fraxinus-excelsior-westhof-s-glorie")],
    [/^tilia europaea 'pallida'$/, "pyramidal", "cultivar-prior", nursery("tilia-europaea-pallida")],
    [/^tilia europaea 'euchlora'$/, "domed", "cultivar-prior", nursery("tilia-europaea-euchlora")],
    [/^tilia tomentosa 'brabant'$/, "pyramidal", "cultivar-prior", nursery("tilia-tomentosa-brabant")],
    [/^carpinus betulus 'fastigiata'$/, "pyramidal", "cultivar-prior", nursery("carpinus-betulus-fastigiata")],
    [/^carpinus betulus 'frans fontaine'$/, "columnar", "cultivar-prior", nursery("carpinus-betulus-frans-fontaine")],
    [/^ulmus 'lobel'$/, "pyramidal", "cultivar-prior", nursery("ulmus-lobel")],
    [/^liquidambar styraciflua$/, "pyramidal", "species-prior", nursery("liquidambar-styraciflua")],
    [/^pinus sylvestris$/, "irregular-spreading", "species-prior", nursery("pinus-sylvestris")],
    [/^quercus robur$/, "irregular-spreading", "species-prior", nursery("quercus-robur")],
    [/^fraxinus excelsior$/, "airy-oval", "species-prior", nursery("fraxinus-excelsior")],
    [/^salix alba$/, "upright-oval", "species-prior", nursery("salix-alba")],
    [/^acer campestre$/, "rounded", "species-prior", nursery("acer-campestre")],
    [/^alnus glutinosa$/, "pyramidal", "species-prior", nursery("alnus-glutinosa")],
    [/^ulmus minor$/, "upright-oval", "species-prior", nursery("ulmus-minor")],
    [/^tilia europaea$/, "domed", "species-prior", nursery("tilia-europaea")],
    [/^tilia cordata$/, "domed", "species-prior", nursery("tilia-cordata")],
    [/^tilia americana$/, "domed", "species-prior", nursery("tilia-americana")],
    [/^tilia platyphyllos$/, "domed", "species-prior", nursery("tilia-platyphyllos")],
    [/^acer pseudoplatanus$/, "domed", "species-prior", nursery("acer-pseudoplatanus")],
    [/^carpinus betulus$/, "domed", "species-prior", nursery("carpinus-betulus")],
    [/^crataegus monogyna$/, "rounded", "species-prior", nursery("crataegus-monogyna")],
    [/^fagus sylvatica$/, "domed", "species-prior", nursery("fagus-sylvatica")],
    [/^metasequoia glyptostroboides$/, "conical-deciduous", "species-prior", nursery("metasequoia-glyptostroboides")],
    [/^pterocarya fraxinifolia$/, "irregular-spreading", "species-prior", nursery("pterocarya-fraxinifolia")],
    [/^aesculus hippocastanum$/, "domed", "species-prior", nursery("aesculus-hippocastanum")],
    [/^aesculus hippocastanum 'baumannii'$/, "domed", "cultivar-prior", nursery("aesculus-hippocastanum-baumannii")],
    [/^ulmus 'columella'$/, "columnar", "cultivar-prior", nursery("ulmus-columella")],
    [/^pyrus calleryana 'chanticleer'$/, "pyramidal", "cultivar-prior", nursery("pyrus-calleryana-chanticleer")],
    [/^robinia pseudoacacia 'bessoniana'$/, "airy-oval", "cultivar-prior", nursery("robinia-pseudoacacia-bessoniana")],
    [/^robinia pseudoacacia$/, "airy-oval", "species-prior", nursery("robinia-pseudoacacia")],
    [/^platanus (?:hispanica|acerifolia) 'tremonia'$/, "pyramidal", "cultivar-prior", nursery("platanus-hispanica-tremonia")],
    [/^platanus (?:hispanica|acerifolia)$/, "rounded", "species-prior", nursery("platanus-hispanica")],
    [/^ulmus 'new horizon'$/, "pyramidal", "cultivar-prior", nursery("ulmus-new-horizon")],
    [/^ulmus 'dodoens'$/, "pyramidal", "cultivar-prior", "https://www.vdberk.nl/bomen/Ulmus-Dodoens/"],
    [/^ulmus hollandica 'vegeta'$/, "pyramidal", "cultivar-prior", nursery("ulmus-hollandica-vegeta")],
    [/^ulmus 'clusius'$/, "upright-oval", "cultivar-prior", nursery("ulmus-clusius")],
    [/^ulmus glabra$/, "upright-oval", "species-prior", nursery("ulmus-glabra")],
    [/^ginkgo biloba$/, "upright-oval", "species-prior", "https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details"],
    [/^(?:cupressocyparis|cuprocyparis|cupressus) leylandii$/, "conical-evergreen", "species-prior", "https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details"],
    [/^prunus serrulata 'kanzan'$/, "vase", "cultivar-prior", nursery("prunus-serrulata-kanzan")],
    [/^betula pendula$/, "upright-oval", "species-prior", nursery("betula-pendula")],
    [/^populus nigra 'italica'$/, "columnar", "cultivar-prior", nursery("populus-nigra-italica")],
    [/^picea abies$/, "conical-evergreen", "species-prior", nursery("picea-abies")],
    [/^salix sepulcralis 'chrysocoma'$/, "weeping", "cultivar-prior", nursery("salix-sepulcralis-chrysocoma")]
  ];
  function normalizedTreeName(value) {
    return String(value || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/×/g, " ").replace(/\bx\s+/g, "").replace(/\s+/g, " ").trim();
  }
  function numberSeed(id) {
    let n = 2166136261;
    for (const c of String(id ?? "")) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return (n >>> 0) / 4294967296;
  }
  function treeTypology(tree) {
    const type = String(tree.type || "").trim().toLowerCase();
    if (type === "stobbe") return null;
    const species = normalizedTreeName(tree.species), rule = rules.find(([pattern]) => pattern.test(species));
    const management = { "gekandelaberde boom": "candelabra-pruned", "knotboom": "pollarded", "leiboom": "trained-flat" }[type];
    const managed = !!management;
    const archetype = management || rule?.[1] || "rounded";
    const validHeight = Number.isFinite(tree.height) && tree.height > 0 && tree.height <= 60;
    const height = validHeight ? tree.height : 9;
    const heightClassKnown = /\d/.test(String(tree.heightClass || ""));
    const heightSource = validHeight && heightClassKnown ? "inventory-height-class-proxy" : "authored-height-fallback";
    const h = height, baseRadius = Math.max(1.3, h * 0.22), variation = 0.96 + numberSeed(tree.id) * 0.04;
    const r = baseRadius * variation;
    const lobe = (dx, y, dz, sx, sy, sz, tone) => ({ offset: [dx, y, dz], scale: [sx, sy, sz], tone });
    let lobes;
    if (archetype === "pyramidal") lobes = [lobe(0, h * 0.65, 0, r * 0.84, h * 0.19, r * 0.78, 2), lobe(0, h * 0.8, 0, r * 0.62, h * 0.16, r * 0.59, 0), lobe(0, h * 0.9, 0, r * 0.34, h * 0.1, r * 0.34, 1)];
    else if (archetype === "upright-oval") lobes = [lobe(0, h * 0.73, 0, r * 0.8, h * 0.27, r * 0.72, 0), lobe(-r * 0.28, h * 0.68, r * 0.14, r * 0.51, h * 0.22, r * 0.48, 1), lobe(r * 0.25, h * 0.65, -r * 0.12, r * 0.5, h * 0.23, r * 0.48, 2)];
    else if (archetype === "conical-evergreen" || archetype === "conical-deciduous") lobes = [lobe(0, h * 0.55, 0, r * 0.7, h * 0.24, r * 0.7, 2), lobe(0, h * 0.74, 0, r * 0.49, h * 0.19, r * 0.49, 0), lobe(0, h * 0.9, 0, r * 0.25, h * 0.1, r * 0.25, 1)];
    else if (archetype === "vase") lobes = [lobe(0, h * 0.65, 0, r * 0.6, h * 0.19, r * 0.58, 2), lobe(-r * 0.4, h * 0.84, 0, r * 0.7, h * 0.16, r * 0.75, 0), lobe(r * 0.4, h * 0.84, 0, r * 0.7, h * 0.16, r * 0.75, 1)];
    else if (archetype === "candelabra-pruned") lobes = [lobe(0, h * 0.85, 0, r * 0.43, h * 0.15, r * 0.5, 0), lobe(-r * 0.5, h * 0.82, 0, r * 0.36, h * 0.14, r * 0.4, 1), lobe(r * 0.5, h * 0.82, 0, r * 0.36, h * 0.14, r * 0.4, 2)];
    else if (archetype === "pollarded") lobes = [lobe(0, h * 0.83, 0, r * 0.62, h * 0.17, r * 0.6, 0), lobe(-r * 0.35, h * 0.79, 0, r * 0.44, h * 0.17, r * 0.44, 1), lobe(r * 0.35, h * 0.79, 0, r * 0.44, h * 0.17, r * 0.44, 2)];
    else if (archetype === "trained-flat") lobes = [lobe(0, h * 0.8, 0, r * 0.55, h * 0.2, r * 0.18, 0), lobe(-r * 0.52, h * 0.76, 0, r * 0.4, h * 0.18, r * 0.18, 1), lobe(r * 0.52, h * 0.76, 0, r * 0.4, h * 0.18, r * 0.18, 2)];
    else if (archetype === "columnar") lobes = [lobe(0, h * 0.59, 0, r * 0.39, h * 0.3, r * 0.36, 2), lobe(0, h * 0.77, 0, r * 0.32, h * 0.23, r * 0.31, 0), lobe(0, h * 0.91, 0, r * 0.18, h * 0.09, r * 0.18, 1)];
    else if (archetype === "weeping") lobes = [lobe(0, h * 0.75, 0, r * 0.7, h * 0.25, r * 0.7, 0), lobe(-r * 0.36, h * 0.57, 0, r * 0.62, h * 0.35, r * 0.63, 1), lobe(r * 0.36, h * 0.57, 0, r * 0.62, h * 0.35, r * 0.63, 2)];
    else if (archetype === "domed") lobes = [lobe(0, h * 0.75, 0, r * 0.9, h * 0.25, r * 0.88, 0), lobe(-r * 0.42, h * 0.66, r * 0.12, r * 0.64, h * 0.22, r * 0.64, 1), lobe(r * 0.42, h * 0.66, -r * 0.14, r * 0.64, h * 0.22, r * 0.64, 2)];
    else if (archetype === "irregular-spreading") lobes = [lobe(-r * 0.2, h * 0.76, 0, r * 0.78, h * 0.24, r * 0.85, 0), lobe(-r * 0.43, h * 0.61, r * 0.21, r * 0.64, h * 0.2, r * 0.7, 1), lobe(r * 0.43, h * 0.67, -r * 0.18, r * 0.64, h * 0.23, r * 0.64, 2)];
    else if (archetype === "airy-oval") lobes = [lobe(0, h * 0.79, 0, r * 0.66, h * 0.21, r * 0.64, 0), lobe(-r * 0.48, h * 0.61, r * 0.2, r * 0.52, h * 0.19, r * 0.48, 1), lobe(r * 0.47, h * 0.64, -r * 0.23, r * 0.53, h * 0.2, r * 0.5, 2)];
    else lobes = [lobe(0, h * 0.76, 0, r, h * 0.24, r * 0.88, 0), lobe(-r * 0.48, h * 0.72, r * 0.25, r * 0.65, h * 0.18, r * 0.67, 1), lobe(r * 0.44, h * 0.7, -r * 0.23, r * 0.66, h * 0.22, r * 0.65, 2)];
    const foliage = archetype === "conical-evergreen" ? "#496955" : species.startsWith("salix") ? "#88a06c" : species.startsWith("betula") ? "#91ad6e" : species.startsWith("fagus") ? "#587b51" : species.startsWith("quercus") ? "#648357" : species.startsWith("robinia") ? "#94a965" : species.startsWith("tilia") ? "#789655" : "#78945a";
    const bark = species.startsWith("betula") ? "#d8d9c5" : species.startsWith("platanus") ? "#aaa68a" : species.startsWith("fagus") ? "#8a8b80" : species.startsWith("metasequoia") ? "#935d47" : "#665741";
    return {
      version: TREE_TYPOLOGY_VERSION,
      id: tree.id,
      position: [...tree.position],
      height,
      archetype,
      lobes,
      trunkHeight: h * (managed ? 0.78 : 0.6),
      trunkWidth: Math.min(0.52, Math.max(0.14, h * 0.023)),
      foliage,
      bark,
      crownGeometry: archetype.startsWith("conical-") ? "cone" : "faceted",
      rotation: numberSeed(tree.id) * Math.PI * 2,
      provenance: {
        position: "municipal inventory",
        height: heightSource,
        heightClass: tree.heightClass ?? null,
        crownBasis: managed ? "explicit-inventory-management" : rule?.[2] || "authored-fallback",
        reference: managed ? null : rule?.[3] || null,
        species: tree.species ?? null,
        type: tree.type ?? null,
        measuredCrown: false,
        note: "Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified."
      }
    };
  }

  // public/canal-drive/js/inventory-trees-source.js
  var { THREE } = window.CanalRecallThree;
  var MIN_ZOOM = 15.5;
  var BUDGET = 12;
  var InventoryTrees = class {
    constructor(map, maplibregl, onReady = () => {
    }) {
      this.map = map;
      this.maplibregl = maplibregl;
      this.onReady = onReady;
      this.enabled = false;
      this.ready = false;
      this.generation = 0;
      this.tiles = /* @__PURE__ */ new Map();
      this.pending = /* @__PURE__ */ new Map();
      this.meshes = [];
      this.theme = "clean";
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(16777215, 5398600, 2.15));
      const sun = new THREE.DirectionalLight(16773333, 1.7);
      sun.position.set(-2, -1, 4);
      this.scene.add(sun);
      this.origin = maplibregl.MercatorCoordinate.fromLngLat([4.9, 52.37], 0);
      this.scale = this.origin.meterInMercatorCoordinateUnits();
      this.layer = {
        id: "municipal-inventory-trees",
        type: "custom",
        renderingMode: "3d",
        onAdd: (_map, gl) => {
          this.camera = new THREE.Camera();
          this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
          this.renderer.autoClear = false;
        },
        render: (_gl, args) => {
          if (!this.enabled || !this.ready || map.getZoom() < MIN_ZOOM || !this.meshes.length) return;
          const transform = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, this.origin.z).scale(new THREE.Vector3(this.scale, -this.scale, this.scale));
          this.camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix || args).multiply(transform);
          this.renderer.resetState();
          this.renderer.render(this.scene, this.camera);
        }
      };
      map.addLayer(this.layer);
      this.move = () => this.update();
      map.on("moveend", this.move);
    }
    async load(root) {
      const generation = ++this.generation;
      this.clear();
      this.ready = false;
      this.index = null;
      this.onReady(false);
      if (!root.endsWith("/amsterdam")) return;
      this.root = new URL(`${root}/municipal-trees/`, location.href);
      try {
        const response = await fetch(new URL("index.json", this.root));
        if (!response.ok) return;
        const index = await response.json();
        if (generation !== this.generation) return;
        if (index.version !== 1 || index.zoom !== 15 || !Array.isArray(index.tiles) || !index.sourceUrl?.startsWith("https://maps.amsterdam.nl/")) throw Error("Invalid municipal tree index");
        this.index = index;
        this.meta = new Map(index.tiles.map((t) => [t.key, t]));
        this.ready = true;
        this.onReady(true);
        this.update();
      } catch (error) {
        console.warn("Municipal trees unavailable; retaining OSM trees.", error);
      }
    }
    setEnabled(value) {
      this.enabled = !!value;
      if (this.enabled) this.update();
      else this.clear();
      this.map.triggerRepaint();
    }
    setTheme(value) {
      this.theme = value;
      for (const mesh of this.meshes) {
        mesh.material.color.set(value === "cyberpunk" ? mesh.userData.wood ? "#a066bd" : "#cf86ed" : "#ffffff");
      }
      this.map.triggerRepaint();
    }
    clear() {
      for (const c of this.pending.values()) c.abort();
      this.pending.clear();
      this.tiles.clear();
      this.queue = [];
      this.disposeMeshes();
    }
    disposeMeshes() {
      for (const m of this.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        m.dispose?.();
      }
      this.meshes = [];
      this.debugTrees = 0;
    }
    update() {
      if (!this.enabled || !this.ready) return;
      if (this.map.getZoom() < MIN_ZOOM) {
        this.clear();
        return;
      }
      const b = this.map.getBounds(), c = this.map.getCenter();
      const tile = (lng, lat) => [Math.floor((lng + 180) / 360 * 32768), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 32768)];
      const [x0, y1] = tile(b.getWest(), b.getSouth()), [x1, y0] = tile(b.getEast(), b.getNorth()), [cx, cy] = tile(c.lng, c.lat);
      const wanted = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = `15/${x}/${y}`;
        if (this.meta.has(key)) wanted.push({ key, d: (x - cx) ** 2 + (y - cy) ** 2 });
      }
      wanted.sort((a, b2) => a.d - b2.d);
      const keys = new Set(wanted.slice(0, BUDGET).map((t) => t.key));
      for (const key of this.tiles.keys()) if (!keys.has(key)) this.tiles.delete(key);
      for (const [key, c2] of this.pending) if (!keys.has(key)) {
        c2.abort();
        this.pending.delete(key);
      }
      this.queue = [...keys].filter((k) => !this.tiles.has(k) && !this.pending.has(k));
      this.rebuild();
      this.pump();
    }
    pump() {
      while (this.pending.size < 2 && this.queue?.length) {
        const key = this.queue.shift();
        void this.fetchTile(key);
      }
    }
    async fetchTile(key) {
      const controller = new AbortController(), generation = this.generation;
      this.pending.set(key, controller);
      try {
        const response = await fetch(new URL(this.meta.get(key).url, this.root), { signal: controller.signal });
        if (!response.ok) throw Error("Missing municipal tree tile");
        const bytes = new Uint8Array(await response.arrayBuffer());
        const text = bytes[0] === 31 && bytes[1] === 139 ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(bytes);
        const data = JSON.parse(text);
        if (data.version !== 1 || data.key !== key || !Array.isArray(data.trees)) throw Error("Invalid municipal tree tile");
        if (!controller.signal.aborted && generation === this.generation) {
          this.tiles.set(key, data.trees);
          this.rebuild();
        }
      } catch (error) {
        if (error.name !== "AbortError") console.warn(`Tree tile ${key} unavailable`, error);
      } finally {
        if (this.pending.get(key) === controller) this.pending.delete(key);
        this.pump();
      }
    }
    rebuild() {
      this.disposeMeshes();
      const b = this.map.getBounds(), groups = /* @__PURE__ */ new Map();
      let trees = 0;
      const archetypes = /* @__PURE__ */ new Set(), color = new THREE.Color();
      const append = (key, item) => {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      };
      for (const tile of this.tiles.values()) for (const tree of tile) {
        if (!Number.isFinite(tree.lng) || !Number.isFinite(tree.lat) || tree.lng < b.getWest() || tree.lng > b.getEast() || tree.lat < b.getSouth() || tree.lat > b.getNorth()) continue;
        const point = this.maplibregl.MercatorCoordinate.fromLngLat([tree.lng, tree.lat], 0);
        const x = (point.x - this.origin.x) / this.scale, south = (point.y - this.origin.y) / this.scale;
        const t = treeTypology({ ...tree, position: [x, south] });
        if (!t) continue;
        trees++;
        archetypes.add(t.archetype);
        append("wood", { p: [x, -south, t.trunkHeight / 2], s: [t.trunkWidth * 2, t.trunkWidth * 2, t.trunkHeight], color: t.bark });
        const co = Math.cos(t.rotation), si = Math.sin(t.rotation);
        for (const l of t.lobes) {
          const dx = l.offset[0] * co - l.offset[2] * si, dz = l.offset[0] * si + l.offset[2] * co;
          color.set(t.foliage).multiplyScalar([1, 1.1, 0.86][l.tone]);
          append(`${t.crownGeometry}-${l.tone}`, { p: [x + dx, -(south + dz), l.offset[1]], s: [l.scale[0], l.scale[2], l.scale[1]], rotation: t.rotation, color: color.clone() });
          if (t.crownGeometry === "faceted" && Math.hypot(dx, dz) > 0.1) {
            const from = new THREE.Vector3(x, -south, t.trunkHeight * 0.72);
            const to = new THREE.Vector3(x + dx * 0.75, -(south + dz * 0.75), l.offset[1]);
            const delta = to.clone().sub(from), length = delta.length();
            append("wood", { p: from.add(to).multiplyScalar(0.5).toArray(), s: [t.trunkWidth, t.trunkWidth, length], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.divideScalar(length)), color: t.bark });
          }
        }
      }
      const dummy = new THREE.Object3D();
      for (const [key, items] of groups) {
        const wood = key === "wood", cone = key.startsWith("cone-");
        const g = wood ? new THREE.CylinderGeometry(0.22, 0.28, 1, 7).rotateX(Math.PI / 2) : cone ? new THREE.ConeGeometry(1, 2, 8).rotateX(Math.PI / 2) : new THREE.IcosahedronGeometry(1, this.map.getZoom() >= 18 ? 1 : 0);
        const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.93, flatShading: true }), items.length);
        m.userData.wood = wood;
        items.forEach((v, j) => {
          dummy.position.set(...v.p);
          dummy.scale.set(...v.s);
          dummy.quaternion.identity();
          if (v.q) dummy.quaternion.copy(v.q);
          else if (v.rotation) dummy.rotation.z = v.rotation;
          dummy.updateMatrix();
          m.setMatrixAt(j, dummy.matrix);
          m.setColorAt(j, new THREE.Color(v.color));
        });
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
        m.frustumCulled = false;
        this.scene.add(m);
        this.meshes.push(m);
      }
      this.debugTrees = trees;
      this.debugTiles = this.tiles.size;
      this.debugArchetypes = [...archetypes];
      this.debugDraws = this.meshes.length;
      this.setTheme(this.theme);
    }
  };
  return __toCommonJS(inventory_trees_source_exports);
})();
