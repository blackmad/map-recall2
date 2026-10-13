// Browser page script for scripts/landmarks/landmark-views.mjs: renders one installed GLB (public/canal-drive/models/<id>.glb)
// from a list of views, in the game's landmark shading (MeshLambertMaterial via normaliseLandmarkMaterials, the game's
// hemisphere/sun/fill lights) or in the landmark gallery's shading (the GLTFLoader standard materials and gallery lights).
// Build: npx esbuild scripts/landmarks/landmark-views.ts --bundle --format=iife --outfile=public/canal-drive/_lv.bundle.js
// Query: id, light (game|gallery), w, hgt, view (JSON, see View). Sets document.title to 'done' or 'error ...'.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {normaliseLandmarkMaterials} from '../../src/canalRecall/landmarks/landmarkShading.js';

/**
 * `street`: a camera at native (x east, z south) metres, eye height, heading (deg from north), horizontal fov, pitch.
 * `orbit`: the gallery camera (theta, phi as in manual-landmarks.html, vertical fov 32, fitted to the bounding sphere).
 */
type View = {kind: 'street'; x: number; z: number; h: number; fov: number; eye?: number; pitch?: number}
  | {kind: 'orbit'; theta: number; phi: number; zoom?: number};

const q = new URLSearchParams(location.search);
const id = q.get('id')!, light = q.get('light') ?? 'game';
const W = +(q.get('w') ?? 1200), H = +(q.get('hgt') ?? 800);
const view = JSON.parse(q.get('view')!) as View;
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(W, H);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
let sun: THREE.DirectionalLight;
if (light === 'gallery') {
  scene.background = new THREE.Color('#ebe7dd');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88806e, 2));
  sun = new THREE.DirectionalLight(0xffefce, 2.2);
  scene.add(sun);
} else {
  scene.background = new THREE.Color('#c9d6e0');
  scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x6b7480, 1.15));
  sun = new THREE.DirectionalLight(0xfff6e8, 2.2); sun.position.set(-0.5, 1.6, 0.9); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9dcea, 0.55); fill.position.set(0.8, 0.4, -1.1); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({color: '#9a9c94'}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
}
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder as never);
loader.load(`./models/${id}.glb?t=${Date.now()}`, gltf => {
  if (light !== 'gallery') normaliseLandmarkMaterials(THREE, gltf.scene);
  scene.add(gltf.scene);
  let cam: THREE.PerspectiveCamera;
  if (view.kind === 'street') {
    const hfov = view.fov * Math.PI / 180, vfov = 2 * Math.atan(Math.tan(hfov / 2) * H / W) * 180 / Math.PI;
    cam = new THREE.PerspectiveCamera(vfov, W / H, 0.3, 3000);
    cam.position.set(view.x, view.eye ?? 2.5, view.z);
    const hd = view.h * Math.PI / 180, p = (view.pitch ?? 0) * Math.PI / 180;
    cam.lookAt(cam.position.x + Math.sin(hd) * Math.cos(p), cam.position.y + Math.sin(p), cam.position.z - Math.cos(hd) * Math.cos(p));
  } else {
    cam = new THREE.PerspectiveCamera(32, W / H, 1, 20000);
    const box = new THREE.Box3().setFromObject(gltf.scene), target = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const hv = 16 * Math.PI / 180, half = Math.min(hv, Math.atan(Math.tan(hv) * W / H));
    const d = size.length() * .5 / Math.sin(half) * 1.05 / (view.zoom ?? 1);
    cam.position.set(target.x + d * Math.sin(view.phi) * Math.sin(view.theta), target.y + d * Math.cos(view.phi), target.z + d * Math.sin(view.phi) * Math.cos(view.theta));
    cam.near = d / 1000; cam.updateProjectionMatrix();
    cam.lookAt(target);
    if (light === 'gallery') sun.position.set(Math.sin(view.theta - .65) * 150, 200, Math.cos(view.theta - .65) * 150);
  }
  renderer.render(scene, cam);
  document.title = 'done';
}, undefined, e => { document.title = 'error ' + e; });
