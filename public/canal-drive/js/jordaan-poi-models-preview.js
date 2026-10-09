const { THREE, GLTFLoader } = window.CanalRecallThree;
const stage = document.querySelector('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9dbd2');
scene.add(new THREE.HemisphereLight(0xfff9eb, 0x748476, 2.5));
const sun = new THREE.DirectionalLight(0xfff1d7, 3.0);
sun.position.set(-10, 25, 20); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 1.3);
fill.position.set(12, 15, -15); scene.add(fill);
const camera = new THREE.PerspectiveCamera(35, 1, .05, 500);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#c4c6ba', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; scene.add(floor);
let model, bounds, frontageWidth = 0, target = new THREE.Vector3(), radius = 30, theta = .5, phi = 1.35, currentView = 'orbit', wire = false, sequence = 0;
const setCamera = () => {
  camera.position.set(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(target);
};
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); setCamera();
}
new ResizeObserver(resize).observe(stage);
function view(mode) {
  currentView = mode;
  if (!bounds) return;
  const size = bounds.getSize(new THREE.Vector3());
  target.copy(bounds.getCenter(new THREE.Vector3()));
  radius = Math.max(size.y, size.z, size.x) * 2.1;
  if (mode === 'front') { theta = 0; phi = Math.PI / 2; target.x = frontageWidth / 2; target.z = 0; radius = size.y * 1.9; }
  else if (mode === 'roof') { theta = .45; phi = .35; radius = size.length() * 2.0 / Math.min(camera.aspect, 1); }
  else { theta = .52; phi = 1.3; }
  setCamera();
}
function dispose(group) {
  const materials = new Set(), textures = new Set();
  group.traverse(o => { if (!o.isMesh) return; o.geometry.dispose(); for (const m of [].concat(o.material)) materials.add(m); });
  for (const m of materials) { for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); m.dispose(); }
  for (const t of textures) t.dispose();
}
const manifest = await fetch('./models/jordaan-pois/manifest.json').then(r => { if (!r.ok) throw Error('Manifest failed to load'); return r.json(); });
const select = document.querySelector('#building');
for (const entry of manifest.models) { const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name + ' · ' + entry.address; select.append(option); }
async function load(id) {
  const token = ++sequence;
  const entry = manifest.models.find(e => e.id === id);
  document.querySelector('#error').textContent = '';
  try {
    const imported = await new GLTFLoader().loadAsync(entry.modelUrl);
    if (token !== sequence) { dispose(imported.scene); return; }
    if (model) { scene.remove(model); dispose(model); }
    model = imported.scene; scene.add(model);
    frontageWidth = entry.widthMetres;
    model.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) m.wireframe = wire; });
    bounds = new THREE.Box3().setFromObject(model);
    view(currentView);
    document.querySelector('#name').textContent = entry.name;
    document.querySelector('#address').textContent = entry.address;
    let triangles = 0, drawCalls = 0;
    model.traverse(o => { if (o.isMesh) { triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; drawCalls += o.geometry.groups.length || 1; } });
    document.querySelector('#metrics').textContent = `${entry.widthMetres.toFixed(1)} m frontage · ${entry.depthMetres.toFixed(1)} m depth · ${bounds.getSize(new THREE.Vector3()).y.toFixed(1)} m high · ${Math.round(triangles).toLocaleString()} triangles · ${drawCalls} draw calls · ${Math.round(entry.bytes / 1024)} KB`;
    const download = document.querySelector('#download'); download.href = entry.modelUrl; download.download = entry.id + '.glb';
    for (const tier of ['full', 'ground']) { document.querySelector('#' + tier).src = entry.sourcePhotos[tier].url; document.querySelector('#' + tier + '-link').href = entry.sourcePhotos[tier].url; }
    document.querySelector('#dates').textContent = `References: full building ${entry.sourcePhotos.full.captureDate.slice(0,10)}, storefront ${entry.sourcePhotos.ground.captureDate.slice(0,10)}.`;
    history.replaceState(null, '', '?building=' + encodeURIComponent(id));
    window.jordaanPreview = { id, triangles, drawCalls, bounds: bounds.getSize(new THREE.Vector3()).toArray(), loaded: true };
  } catch (e) { document.querySelector('#error').textContent = e.message; }
}
select.onchange = () => load(select.value);
for (const mode of ['front', 'orbit', 'roof']) document.querySelector('#' + mode).onclick = () => view(mode);
document.querySelector('#wire').onclick = e => { wire = !wire; e.target.setAttribute('aria-pressed', String(wire)); model?.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) m.wireframe = wire; }); };
let pointer;
stage.onpointerdown = e => { pointer = [e.clientX, e.clientY]; stage.setPointerCapture(e.pointerId); };
stage.onpointermove = e => { if (!pointer) return; theta -= (e.clientX - pointer[0]) * .006; phi = Math.max(.06, Math.min(Math.PI * .94, phi + (e.clientY - pointer[1]) * .006)); pointer = [e.clientX, e.clientY]; setCamera(); };
stage.onpointerup = stage.onpointercancel = () => { pointer = null; };
stage.addEventListener('wheel', e => { e.preventDefault(); radius = Math.max(3, Math.min(150, radius * Math.exp(e.deltaY * .001))); setCamera(); }, { passive: false });
const requested = new URLSearchParams(location.search).get('building');
select.value = manifest.models.some(m => m.id === requested) ? requested : manifest.models[0].id;
await load(select.value);
renderer.setAnimationLoop(() => renderer.render(scene, camera));
