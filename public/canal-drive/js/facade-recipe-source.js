import { compileRecipe, recipeContainsPoint } from '../../../src/canalRecall/facade/recipe.ts';
import { recipeDevelopmentFixtures } from '../../../src/canalRecall/facade/recipeFixtures.ts';
import { buildElevations } from '../../../src/canalRecall/facade/elevations.ts';
import { rdToLngLat } from '../../../src/canalRecall/facade/rdNew.ts';
import { photoToRecipe } from '../../../src/canalRecall/facade/photoRecipe.ts';

const { THREE } = window.CanalRecallThree;
const triangulate = (outer, holes) => THREE.ShapeUtils.triangulateShape(
  outer.map(p => new THREE.Vector2(...p)), holes.map(h => h.map(p => new THREE.Vector2(...p))));
const compile = recipe => compileRecipe(recipe, triangulate);
const SURFACE_COLOURS = { wall: '#d7b185', roof: '#df5c60', trim: '#f5e7c0', glass: '#399ac2', door: '#769952' };
let brickImage;
export async function loadMaterialAssets() {
  if (brickImage) return;
  const image = new Image(); image.src = 'materials/ambientcg/Bricks057/colour.jpg';
  await image.decode(); brickImage = image;
}
function brickTexture(asset, colour) {
  const ref = asset.materialReference;
  if (!ref) return null;
  let texture;
  if (asset.detailing.wallMaterial === 'ambientcg-Bricks057') {
    if (!brickImage) throw new Error('Brick texture is not loaded');
    texture = new THREE.Texture(brickImage); texture.needsUpdate = true;
  } else {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const c = canvas.getContext('2d'); c.fillStyle = asset.detailing.brickAppearance?.mortarColour ?? '#b6aea0'; c.fillRect(0,0,512,512);
    const rgb = [1,3,5].map(i=>Number.parseInt(colour.slice(i,i+2),16));
    for (let row=0;row<8;row++) for(let col=-1;col<5;col++) {
      const x=(col+(row%2)*0.5)*128, y=row*64, tone=((row*17+(col+2)*13)%11-5)*(asset.detailing.brickAppearance?.variation ?? .06)*50;
      c.fillStyle=`rgb(${rgb.map(v=>Math.max(0,Math.min(255,v+tone))).join(',')})`;
      c.fillRect(x+3,y+4,122,55);
    }
    texture = new THREE.CanvasTexture(canvas);
  }
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1/ref.tileWidthM,1/ref.tileHeightM); texture.anisotropy=4;
  return texture;
}

function meshGroup(asset, mode = 'palette', mapVertex = p => p) {
  const group = new THREE.Group();
  for (const part of asset.meshes) {
    const coordinates = [];
    for (let i = 0; i < part.positions.length; i += 3) coordinates.push(...mapVertex(part.positions.slice(i, i + 3)));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uvMetres, 2));
    if (part.colours) geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.colours, 3));
    geometry.computeVertexNormals();
    const colour = mode === 'surfaces' ? SURFACE_COLOURS[part.surface] : mode === 'identity' ? `#${asset.recipeHash.slice(0, 6)}` : part.colour;
    const material = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, toneMapped: false });
    if (mode === 'palette' && part.colours) { material.vertexColors = true; material.color.set('#ffffff'); }
    if (mode === 'palette' && part.surface === 'wall' && asset.detailing.wallMaterial !== 'flat') {
      material.map = brickTexture(asset, part.colour); material.color.set('#ffffff');
      material.vertexColors = false;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.recipePart = part;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
function disposeGroup(group) {
  group?.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); } });
}

/** The normal MapLibre shared-context path, restricted to explicit diagnostic previews. */
export class RecipeMapLayer {
  constructor(map, maplibre, { onVisibility = () => {}, groundReferenceNapM = 0 } = {}) {
    this.map = map; this.maplibre = maplibre; this.onVisibility = onVisibility;
    this.groundReferenceNapM = groundReferenceNapM;
    this.enabled = true; this.asset = null; this.group = null; this.shown = false;
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
    this.onLost = () => { this.contextLost = true; this.needsRestore = true; this._visibility(false); };
    this.onRestored = () => { this.contextLost = false; this.map.triggerRepaint(); };
    this.restoreLayer = () => {
      if (!this.needsRestore) return;
      this.needsRestore = false; this.contextLost = false;
      this.onVisibility(null);
      if (!map.getLayer(this.layer.id)) map.addLayer(this.layer);
      map.triggerRepaint();
    };
    map.on('style.load', this.restoreLayer);
    this.layer = {
      id: 'facade-recipe-preview', type: 'custom', renderingMode: '3d',
      onAdd: (_map, gl) => {
        this.renderer?.dispose();
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
        map.getCanvas().addEventListener('webglcontextlost', this.onLost, true);
        map.getCanvas().addEventListener('webglcontextrestored', this.onRestored);
      },
      render: (_gl, args) => {
        if (!this.enabled || !this.group || this.contextLost) return;
        try {
          this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(this.transform);
          this.renderer.resetState(); this.renderer.render(this.scene, this.camera);
          this._visibility(true);
        } catch (error) {
          this.lastError = String(error); this.enabled = false; this._visibility(false);
        }
      },
      onRemove: () => {
        if (this.needsRestore) return;
        this.clear();
        map.off('style.load', this.restoreLayer);
        map.getCanvas().removeEventListener('webglcontextlost', this.onLost, true);
        map.getCanvas().removeEventListener('webglcontextrestored', this.onRestored);
        this.renderer?.dispose();
      },
    };
    map.addLayer(this.layer);
  }
  _visibility(value) {
    if (value === this.shown) return;
    this.shown = value;
    this.onVisibility(value ? this.asset : null);
  }
  setAsset(asset, mode = 'palette') {
    if (asset.disposition !== 'diagnostic-only' || !asset.buildingId.startsWith('bag:'))
      throw new Error('The map preview requires a real BAG footprint; synthetic fixtures stay off the map.');
    const anchor = this.maplibre.MercatorCoordinate.fromLngLat(rdToLngLat(asset.origin), asset.origin.groundNapM - this.groundReferenceNapM);
    const scale = anchor.meterInMercatorCoordinateUnits();
    // Transform each RD vertex through the established projection. RD grid north is
    // not assumed to be geographic north; large RD coordinates never enter float32.
    const next = meshGroup(asset, mode, ([x, y, z]) => {
      const p = this.maplibre.MercatorCoordinate.fromLngLat(rdToLngLat({ x: asset.origin.x + x, y: asset.origin.y + y }),
        asset.origin.groundNapM - this.groundReferenceNapM + z);
      return [(p.x - anchor.x) / scale, -(p.y - anchor.y) / scale, (p.z - anchor.z) / scale];
    });
    this._visibility(false);
    this.scene.remove(this.group); disposeGroup(this.group);
    this.group = next; this.asset = asset; this.scene.add(next);
    this.transform = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z).scale(new THREE.Vector3(scale, -scale, scale));
    this.lastError = null; this.map.triggerRepaint();
  }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this._visibility(false); this.map.triggerRepaint(); }
  clear() {
    this._visibility(false); this.scene.remove(this.group); disposeGroup(this.group);
    this.group = null; this.asset = null; this.map.triggerRepaint();
  }
  status() { return { shown: this.shown, enabled: this.enabled, buildingId: this.asset?.buildingId ?? null,
    triangleCount: this.asset?.triangleCount ?? 0, drawCalls: this.asset?.meshes.length ?? 0, error: this.lastError ?? null }; }
}

/** One orthographic diagnostic view; facade direction comes from an explicit elevation. */
export class RecipeDiagnosticView {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor('#e9e6dd', 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 1000);
    this.camera.up.set(0, 0, 1);
    this.canvas = canvas; this.raycaster = new THREE.Raycaster();
    this.resize = new ResizeObserver(() => this.render()); this.resize.observe(canvas);
  }
  setAsset(asset, recipe, view = 'facade', mode = 'palette') {
    this.scene.remove(this.group); disposeGroup(this.group);
    this.asset = asset; this.recipe = recipe; this.view = view;
    this.group = meshGroup(asset, mode); this.scene.add(this.group);
    this.render();
  }
  setComparisonFrame(frame) { this.comparisonFrame = frame; }
  render() {
    if (!this.asset) return;
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const a = this.asset, r = this.recipe;
    const center = new THREE.Vector3(...a.bounds.min.map((v, i) => (v + a.bounds.max[i]) / 2));
    const elevation = r.elevations[0];
    const wall = buildElevations(r.footprint.value[elevation.polygonIndex].outer, { pandId: r.buildingId.replace(/^bag:/, '') })
      .find(w => w.elevationId === elevation.elevationId);
    let span;
    if (this.view === 'facade') {
      center.set(wall.midpoint.x - a.origin.x, wall.midpoint.y - a.origin.y, a.bounds.max[2] / 2);
      this.camera.position.set(center.x + wall.normal.x * 120, center.y + wall.normal.y * 120, center.z);
      span = Math.max(a.bounds.max[2] * 1.2, wall.lengthM / (width / height) * 1.2);
      if (this.comparisonFrame) {
        const f = this.comparisonFrame;
        center.z = f.centerZM;
        this.camera.position.z = f.centerZM;
        span = Math.max(f.heightM, f.widthM / (width / height));
      }
    } else {
      const size = new THREE.Vector3(...a.bounds.max.map((v, i) => v - a.bounds.min[i]));
      this.camera.position.copy(center).add(new THREE.Vector3(50, -70, this.view === 'roof' ? 260 : 85));
      span = Math.max(size.length() * 0.9, size.length() * 0.9 / (width / height));
    }
    this.camera.up.set(0, 0, 1); this.camera.lookAt(center);
    if (this.view !== 'facade') {
      this.camera.updateMatrixWorld(true);
      const corners = [];
      for (const x of [a.bounds.min[0], a.bounds.max[0]]) for (const y of [a.bounds.min[1], a.bounds.max[1]]) for (const z of [a.bounds.min[2], a.bounds.max[2]])
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
      const extent = axis => Math.max(...corners.map(v => v[axis])) - Math.min(...corners.map(v => v[axis]));
      span = Math.max(extent('y'), extent('x') / (width / height)) * 1.12;
    }
    this.camera.left = -span * width / height / 2; this.camera.right = -this.camera.left;
    this.camera.top = span / 2; this.camera.bottom = -span / 2; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  pick(clientX, clientY) {
    const box = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - box.left) / box.width * 2 - 1, 1 - (clientY - box.top) / box.height * 2), this.camera);
    const hit = this.raycaster.intersectObjects(this.group?.children ?? [])[0];
    if (!hit) return null;
    const part = hit.object.userData.recipePart;
    return { buildingId: part.buildingId, meshId: part.meshId, surface: part.surface, ...part.triangles[hit.faceIndex] };
  }
  dispose() { this.resize.disconnect(); disposeGroup(this.group); this.renderer.dispose(); }
}

export { compile, recipeDevelopmentFixtures, buildElevations, rdToLngLat, recipeContainsPoint, photoToRecipe };
