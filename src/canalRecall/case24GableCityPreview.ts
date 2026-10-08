/** Isolated inspection page using the same CityAppearanceThree adapter as the city. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCityAppearanceThreeAdapter } from './cityAppearanceThree.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('scene');
const stage = $<HTMLElement>('stage');
const sourceOverlay = $<HTMLImageElement>('source-overlay');
// Both the historical case-24 page and the source-to-owner review page use
// this renderer. The page selects only a packet; no address-specific renderer
// branch exists here.
const defaultPacketUrl = document.documentElement.dataset.previewPacket
  ?? './data/case24-gable-city-preview.json';
// The preview is reusable for isolated audit packets, but it must not turn a
// query parameter into an arbitrary fetch. Keep the historical page default
// and accept only a local packet below this page's data directory.
const requestedPacket = new URLSearchParams(location.search).get('packet');
const packetUrl = (() => {
  if (!requestedPacket) return defaultPacketUrl;
  const packet = new URL(requestedPacket, location.href);
  const dataRoot = new URL('./data/', location.href);
  return packet.origin === location.origin
    && packet.pathname.startsWith(dataRoot.pathname)
    && packet.pathname.endsWith('.json')
    ? `${packet.pathname}${packet.search}`
    : defaultPacketUrl;
})();
const reviewCss = document.createElement('style');
reviewCss.textContent = '#source-overlay{position:absolute!important;inset:0;opacity:0;pointer-events:none}.source-frame #source-overlay.active{opacity:var(--source-opacity)!important}.hud{position:fixed!important;top:12px!important;left:12px!important;z-index:20}';
document.head.append(reviewCss);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e9df'); scene.fog = new THREE.Fog('#e9e9df', 38, 118);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(39, 1, .1, 300);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.target.set(0, 7, 0);
camera.position.set(-11, 9, 20); controls.update();
scene.add(new THREE.HemisphereLight('#fff9ed', '#66766d', 2.25));
const sun = new THREE.DirectionalLight('#fff0d5', 2.7); sun.position.set(-24, 42, 18); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: '#d8ddd1', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground);

let active: any = null, contextVisible = false, sourceFraming = false, cameraMode: 'free' | 'source' | 'wide-street' = 'free';
function targetCentre(owner: any) {
  const points = owner.geometry.building.surfaces.flatMap((surface: any) => surface.rings.flat());
  const minX = Math.min(...points.map((point: number[]) => point[0])), maxX = Math.max(...points.map((point: number[]) => point[0]));
  const minY = Math.min(...points.map((point: number[]) => point[1])), maxY = Math.max(...points.map((point: number[]) => point[1]));
  const minZ = Math.min(...points.map((point: number[]) => point[2])), maxZ = Math.max(...points.map((point: number[]) => point[2]));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
}
function frameTarget(owner: any, angle: 'front' | 'oblique') {
  cameraMode = 'free';
  document.body.classList.remove('wide-street-frame'); document.body.classList.remove('source-frame');
  const source = active?.packet?.provenance?.source, framing = active?.packet?.provenance?.streetContextFraming;
  const ownerCentre = targetCentre(owner);
  const sourceMidY = source?.samplingPlane ? (source.samplingPlane.baseZ + source.samplingPlane.topZ) / 2 - source.localToNAPOffsetM : ownerCentre.y;
  const observedFront = framing?.frontWallTargetLocal;
  const centre = observedFront ? { x: observedFront.x, y: sourceMidY, z: observedFront.z } : ownerCentre;
  // A full portrait source wall needs a wider free frame than the historical
  // case24 roof diagnostic. Use the packet's observed-front target when it is
  // available, while retaining case24's previous framing fallback.
  const distance = observedFront ? (angle === 'front' ? 36 : 42) : (angle === 'front' ? 24 : 27);
  const sourceEye = active?.packet?.provenance?.sourceCameraLocal;
  const rawX = (sourceEye?.x ?? centre.x - 1) - centre.x, rawZ = (sourceEye?.z ?? centre.z + 1) - centre.z;
  const scale = distance / Math.max(.001, Math.hypot(rawX, rawZ));
  controls.target.set(centre.x, centre.y, centre.z);
  camera.position.set(centre.x + rawX * scale + (angle === 'oblique' ? -7 : 0), centre.y + (angle === 'front' ? 1.2 : 5), centre.z + rawZ * scale + (angle === 'oblique' ? 5 : 0)); controls.update();
}
function frameSourceCamera(owner: any) {
  const source = active?.packet?.provenance?.sourceCameraLocal;
  const rawPlane = active?.packet?.provenance?.source?.samplingPlane;
  const origin = owner?.geometry?.frame?.originRD;
  // Older case24 packets persist local coordinates. Generic packets retain the
  // world sampling plane with their owner binding, so convert it at the viewer
  // boundary without changing a source record.
  const plane = active?.packet?.provenance?.source?.samplingPlaneLocal ?? (rawPlane && origin ? {
    start: { x: rawPlane.start.x - origin.x, y: rawPlane.baseZ - active.packet.provenance.source.localToNAPOffsetM, z: origin.y - rawPlane.start.y },
    end: { x: rawPlane.end.x - origin.x, y: rawPlane.baseZ - active.packet.provenance.source.localToNAPOffsetM, z: origin.y - rawPlane.end.y },
    topY: rawPlane.topZ - active.packet.provenance.source.localToNAPOffsetM,
  } : null);
  if (!source || !plane || ![source.x, source.y, source.z, plane.start.x, plane.start.y, plane.start.z, plane.end.x, plane.end.y, plane.end.z, plane.topY].every(Number.isFinite)) return;
  const eye = new THREE.Vector3(source.x, source.y, source.z), start = new THREE.Vector3(plane.start.x, plane.start.y, plane.start.z), end = new THREE.Vector3(plane.end.x, plane.end.y, plane.end.z);
  const right = end.clone().sub(start).normalize(), up = new THREE.Vector3(0, 1, 0), back = right.clone().cross(up).normalize();
  if (eye.clone().sub(start).dot(back) < 0) back.negate();
  const distance = eye.clone().sub(start).dot(back), near = .1;
  if (!(distance > near)) return;
  const scale = near / distance, left = start.clone().sub(eye).dot(right) * scale, rightExtent = end.clone().sub(eye).dot(right) * scale;
  const bottom = (plane.start.y - eye.y) * scale, top = (plane.topY - eye.y) * scale;
  camera.position.copy(eye); camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, back));
  camera.projectionMatrix.makePerspective(left, rightExtent, top, bottom, near, 300); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); controls.enabled = false;
  sourceFraming = true; cameraMode = 'source'; document.body.classList.remove('wide-street-frame'); document.body.classList.add('source-frame');
  stage.dataset.cameraState = JSON.stringify({ kind: 'source-camera-side', position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projectionMatrix: camera.projectionMatrix.elements, viewport: { width: stage.clientWidth, height: stage.clientHeight } });
  resize();
}
function frameWideStreet() {
  // The source supplies an eye position, not a calibrated lens. This normal
  // perspective is therefore an explicitly assumed context framing.
  const source = active?.packet?.provenance?.streetContextFraming?.inferredInspectionEyeLocal;
  const framing = active?.packet?.provenance?.streetContextFraming;
  const reference = active?.packet?.target?.baseline;
  if (!source || !reference || !Number.isFinite(framing?.assumedVerticalFovDeg)) return;
  const centre = targetCentre(reference);
  const observedFront = framing.frontWallTargetLocal;
  const target = { x: observedFront?.x ?? centre.x, y: framing.targetY, z: observedFront?.z ?? centre.z };
  sourceFraming = false; cameraMode = 'wide-street'; document.body.classList.remove('source-frame'); document.body.classList.add('wide-street-frame'); resize(); controls.enabled = false;
  camera.fov = framing.assumedVerticalFovDeg; camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.position.set(source.x, source.y, source.z); camera.lookAt(target.x, target.y, target.z); camera.updateProjectionMatrix();
  recordWideCameraState();
  $<HTMLElement>('mode').textContent = `Wide inspection context · inferred ${framing.inferredHorizontalDistanceM.toFixed(1)} m source-side eye at y ${source.y.toFixed(3)} m · assumed ${framing.assumedVerticalFovDeg}° vertical FOV`;
}
function recordWideCameraState() {
  // Read-only actual camera state makes the fixed-eye contract auditable
  // without giving page scripts a mutable Three camera handle.
  stage.dataset.cameraState = JSON.stringify({ kind: 'wide-street-eye', position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projectionMatrix: camera.projectionMatrix.elements, verticalFovDeg: camera.fov, aspect: camera.aspect, viewport: { width: stage.clientWidth, height: stage.clientHeight } });
}
function setSourceOverlay(opacity: number) {
  const source = active?.packet?.provenance?.source;
  if (!source) return;
  sourceOverlay.src = source.publicCropUrl;
  sourceOverlay.style.setProperty('--source-opacity', String(opacity / 100));
  sourceOverlay.classList.toggle('active', opacity > 0);
  document.querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.overlay) === opacity)));
  $<HTMLElement>('mode').textContent = opacity === 0 ? 'Model only · source 0%' : opacity === 100 ? 'Dated source only · source 100%' : `Shared source viewport · source ${opacity}% overlay`;
}
function setView(name: 'baseline' | 'candidate') {
  if (!active) return;
  const priorCameraMode = cameraMode;
  active.group?.removeFromParent(); active.resource?.dispose();
  const selected = name === 'candidate' ? active.packet.target.candidate : active.packet.target.baseline;
  const group = new THREE.Group(); scene.add(group);
  const resource = createCityAppearanceThreeAdapter({ parent: group, targetOriginRD: selected.geometry.frame.originRD, targetOffsetNAP: .65,
    // Candidate-only cloned observation contract remains ambiguous and preview-only.
    observedFacades: name === 'candidate', candidateRegistrationPreview: name === 'candidate', proceduralFacades: false, contextualFacades: false, contextualPalette: true })([selected]);
  resource.setLod(selected.id, 'detail'); resource.flush();
  const contextResource = contextVisible ? createCityAppearanceThreeAdapter({ parent: group, targetOriginRD: selected.geometry.frame.originRD, targetOffsetNAP: .65, observedFacades: false, candidateRegistrationPreview: false, proceduralFacades: false, contextualFacades: false, contextualPalette: true })(active.packet.contextOwners) : null;
  contextResource?.flush(); active.group = group; active.resource = { dispose: () => { resource.dispose(); contextResource?.dispose(); } };
  stage.dataset.runtimeStats = JSON.stringify({
    kind: 'source-to-owner-preview', view: name, contextVisible,
    target: resource.stats, context: contextResource?.stats ?? null,
    viewport: { width: stage.clientWidth, height: stage.clientHeight },
  });
  sourceFraming = false; document.body.classList.remove('source-frame');
  controls.enabled = true; camera.fov = 39; camera.updateProjectionMatrix(); frameTarget(selected, 'oblique');
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  $<HTMLButtonElement>('context').setAttribute('aria-pressed', String(contextVisible));
  $<HTMLElement>('mode').textContent = name === 'candidate' ? (active.packet.target.candidateLabel ?? 'Approximate source-to-owner candidate') : 'Baseline LoD2.2 building';
  if (priorCameraMode === 'wide-street') frameWideStreet();
  if (priorCameraMode === 'source') frameSourceCamera(selected);
}
function resize() { if (!sourceFraming) { camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); if (cameraMode === 'wide-street') recordWideCameraState(); } renderer.setSize(stage.clientWidth, stage.clientHeight, false); }
new ResizeObserver(resize).observe(stage); resize();
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view as 'baseline' | 'candidate'));
$<HTMLButtonElement>('context').onclick = () => { contextVisible = !contextVisible; setView(document.querySelector<HTMLButtonElement>('[data-view][aria-pressed=true]')?.dataset.view as 'baseline' | 'candidate'); };
$<HTMLButtonElement>('street').onclick = () => active && frameSourceCamera(active.packet.target[document.querySelector<HTMLButtonElement>('[data-view][aria-pressed=true]')?.dataset.view as 'baseline' | 'candidate']);
$<HTMLButtonElement>('wide-street').onclick = () => active && frameWideStreet();
$<HTMLButtonElement>('front').onclick = () => { if (!active) return; sourceFraming = false; controls.enabled = true; camera.fov = 39; camera.updateProjectionMatrix(); setSourceOverlay(0); resize(); frameTarget(active.packet.target[document.querySelector<HTMLButtonElement>('[data-view][aria-pressed=true]')?.dataset.view as 'baseline' | 'candidate'], 'front'); };
$<HTMLButtonElement>('oblique').onclick = () => { if (!active) return; sourceFraming = false; controls.enabled = true; camera.fov = 39; camera.updateProjectionMatrix(); setSourceOverlay(0); resize(); frameTarget(active.packet.target[document.querySelector<HTMLButtonElement>('[data-view][aria-pressed=true]')?.dataset.view as 'baseline' | 'candidate'], 'oblique'); };
document.querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach(button => button.onclick = () => setSourceOverlay(Number(button.dataset.overlay)));
fetch(packetUrl, { cache: 'no-store' }).then(response => { if (!response.ok) throw Error(`Preview packet unavailable (${response.status})`); return response.json(); }).then(packet => {
  active = { packet }; sourceOverlay.src = packet.provenance.source.publicCropUrl;
  document.title = `${packet.target.caseId} · source-to-owner city preview`;
  document.documentElement.style.setProperty('--source-width', String(packet.provenance.source.dimensions.width));
  document.documentElement.style.setProperty('--source-height', String(packet.provenance.source.dimensions.height));
  $<HTMLElement>('preview-address').textContent = packet.target.address;
  $<HTMLElement>('candidate-label').textContent = packet.target.candidateLabel ?? 'Candidate';
  const scope = document.getElementById('candidate-scope');
  if (scope && packet.target.scopeNote) scope.textContent = packet.target.scopeNote;
  sourceOverlay.alt = `Dated ${packet.target.caseId} full-facade source, shown only as an unregistered review overlay`;
  $<HTMLElement>('status').textContent = `${packet.contextOwners.length} active-release neighbours · target remains a separate preview`;
  $<HTMLElement>('details').textContent = JSON.stringify({ provenance: packet.provenance, baselineGeometryRevision: packet.target.baseline.geometryRevision, candidateGeometryRevision: packet.target.candidate.geometryRevision }, null, 2);
  setView('candidate'); setSourceOverlay(0);
}).catch(error => { $<HTMLElement>('status').textContent = String(error); });
function frame() {
  requestAnimationFrame(frame); if (controls.enabled) controls.update(); renderer.render(scene, camera);
  const existing = JSON.parse(stage.dataset.runtimeStats ?? '{}');
  stage.dataset.runtimeStats = JSON.stringify({ ...existing, renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, cameraMode, contextVisible, viewport: { width: stage.clientWidth, height: stage.clientHeight } });
}
frame();
