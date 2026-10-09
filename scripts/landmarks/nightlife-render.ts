// Browser page script for contact sheets: renders one installed GLB from a compass azimuth.
// Build: npx esbuild scripts/landmarks/nightlife-render.ts --bundle --format=iife --outfile=public/canal-drive/_nl-render.bundle.js
// Page public/canal-drive/_nl-render.html is a throwaway (not committed): <script src="_nl-render.bundle.js"></script>
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const q = new URLSearchParams(location.search);
const id = q.get('id')!, az = +(q.get('az') ?? 0) * Math.PI / 180, el = +(q.get('el') ?? 20) * Math.PI / 180, zoom = +(q.get('zoom') ?? 1);
const ground = q.get('ground') ?? '#9aa7a8';
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(600, 450);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfdbe3');
scene.add(new THREE.HemisphereLight('#ffffff', '#8a8576', 1.5));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(-30, 60, 40); scene.add(sun);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder as never);
loader.load(`./models/${id}.glb`, gltf => {
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const floor = new THREE.Mesh(new THREE.CircleGeometry(Math.max(s.x, s.z) * 1.6, 48), new THREE.MeshBasicMaterial({color: ground}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(c.x, box.min.y > -0.5 ? box.min.y - 0.02 : -0.02, c.z); scene.add(floor);
  const r = Math.max(s.x, s.z, s.y * 1.4) * 1.15 / zoom;
  const cam = new THREE.PerspectiveCamera(35, 600 / 450, 0.5, 2000);
  const d = r / Math.tan(THREE.MathUtils.degToRad(17.5)) * 0.62;
  cam.position.set(c.x + d * Math.sin(az) * Math.cos(el), c.y + d * Math.sin(el), c.z - d * Math.cos(az) * Math.cos(el));
  cam.lookAt(c.x, c.y - s.y * 0.05, c.z);
  renderer.render(scene, cam);
  document.title = `done ${JSON.stringify(s.toArray().map(n => +n.toFixed(1)))}`;
}, undefined, e => { document.title = `error ${e}`; });
