const { THREE, GLTFLoader } = window.CanalRecallThree;
const stage = document.getElementById('stage');
const select = document.getElementById('building');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4e5df');
scene.add(new THREE.HemisphereLight(0xf6f8ff, 0xa7aa98, 2.0));
const sun = new THREE.DirectionalLight(0xffedcf, 2.5);
sun.position.set(-22, 38, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 40, bottom: -40, near: 1, far: 150 });
sun.shadow.normalBias = 0.10;
sun.shadow.bias = -0.0003;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdde9ff, 0.8);
fill.position.set(30, 15, -10);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: '#c7c9bc', roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.025;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 500);
let model, bounds, manifest, focusBounds, view = 'oblique';
let azimuth = 0.35, elevation = 0.22, zoom = 1, moving = false, previousTime = 0;
const target = new THREE.Vector3();
function updateCamera() {
  if (!focusBounds) return;
  const size = focusBounds.getSize(new THREE.Vector3());
  focusBounds.getCenter(target);
  const aspect = stage.clientWidth / stage.clientHeight;
  const extentX = Math.abs(Math.cos(azimuth)) * size.x + Math.abs(Math.sin(azimuth)) * size.z;
  const horizontalDepth = Math.abs(Math.sin(azimuth)) * size.x + Math.abs(Math.cos(azimuth)) * size.z;
  const extentY = Math.cos(elevation) * size.y + Math.sin(elevation) * horizontalDepth;
  const halfHeight = Math.max(extentY / 2, extentX / (2 * aspect)) * 1.13 * zoom;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.position.set(target.x + 110 * Math.sin(azimuth) * Math.cos(elevation), target.y + 110 * Math.sin(elevation), target.z + 110 * Math.cos(azimuth) * Math.cos(elevation));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
function setFocus() {
  if (!bounds) return;
  const b = manifest.buildings.find(row => row.id === select.value);
  focusBounds = b ? new THREE.Box3(new THREE.Vector3(b.x - 0.25, 0, -b.depth - 0.3), new THREE.Vector3(b.x + b.width + 0.25, b.height + 0.5, 0.7)) : bounds.clone();
  document.getElementById('description').textContent = b ? `${b.label} · ${b.family}` : `${manifest.buildings.length} buildings · distinct roof and gable families`;
  zoom = 1;
  updateCamera();
  window.gableBlockPreview = { loaded: true, id: select.value, buildings: manifest.buildings.length, view };
}
function setView(value) {
  view = value;
  [azimuth, elevation] = value === 'front' ? [0, 0] : value === 'roof' ? [0.3, 0.78] : [0.35, 0.22];
  zoom = 1;
  updateCamera();
  if (window.gableBlockPreview) window.gableBlockPreview.view = view;
}
new ResizeObserver(() => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  updateCamera();
}).observe(stage);
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
select.onchange = setFocus;
document.getElementById('orbit').onclick = event => {
  moving = !moving;
  event.target.setAttribute('aria-pressed', String(moving));
};
let pointer;
stage.onpointerdown = event => { pointer = [event.clientX, event.clientY]; stage.setPointerCapture(event.pointerId); };
stage.onpointermove = event => {
  if (!pointer) return;
  azimuth -= (event.clientX - pointer[0]) * 0.005;
  elevation = Math.max(0.01, Math.min(1.45, elevation + (event.clientY - pointer[1]) * 0.005));
  pointer = [event.clientX, event.clientY];
  updateCamera();
};
stage.onpointerup = stage.onpointercancel = () => { pointer = null; };
stage.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = Math.max(0.3, Math.min(3, zoom * Math.exp(event.deltaY * 0.001)));
  updateCamera();
}, { passive: false });
try {
  const response = await fetch('./models/gable-block/manifest.json');
  if (!response.ok) throw new Error(`Manifest: HTTP ${response.status}`);
  manifest = await response.json();
  const gltf = await new GLTFLoader().loadAsync('./models/gable-block/block.glb');
  model = gltf.scene;
  model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  scene.add(model);
  bounds = new THREE.Box3().setFromObject(model);
  sun.target.position.copy(bounds.getCenter(new THREE.Vector3()));
  sun.position.add(sun.target.position);
  manifest.buildings.forEach(building => {
    const option = document.createElement('option');
    option.value = building.id;
    option.textContent = building.label;
    select.append(option);
  });
  setFocus();
} catch (error) {
  document.getElementById('error').textContent = error.message;
  throw error;
}
renderer.setAnimationLoop(time => {
  if (moving && previousTime) { azimuth += Math.min(50, time - previousTime) * 0.00007; updateCamera(); }
  previousTime = time;
  renderer.render(scene, camera);
});
