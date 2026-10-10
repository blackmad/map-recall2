// Browser page script: renders an installed GLB from a street camera matched to a panorama (native east/south metres, as the GLB).
// Build: npx esbuild scripts/landmarks/big-camrender.ts --bundle --format=iife --outfile=public/canal-drive/_nl-cam.bundle.js
// Page public/canal-drive/_nl-cam.html (throwaway): <script src="_nl-cam.bundle.js"></script>
// Query: id, x, z (camera, east/south m), h (heading deg from north), fov (horizontal deg), eye (m), pitch (deg), w, hgt
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const q = new URLSearchParams(location.search);
const id = q.get('id')!, num = (k: string, d: number) => +(q.get(k) ?? d);
const W = num('w', 1600), H = num('hgt', 889);
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(W, H);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd4ea');
scene.add(new THREE.HemisphereLight('#ffffff', '#8a8576', 1.6));
const sun = new THREE.DirectionalLight('#fff4e0', 1.8); sun.position.set(-30, 60, 40); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({color: '#8c9a85'}));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder as never);
loader.load(`./models/${id}.glb`, gltf => {
  scene.add(gltf.scene);
  const hfov = num('fov', 50) * Math.PI / 180, vfov = 2 * Math.atan(Math.tan(hfov / 2) * H / W) * 180 / Math.PI;
  const cam = new THREE.PerspectiveCamera(vfov, W / H, 0.3, 3000);
  cam.position.set(num('x', 0), num('eye', 2.5), num('z', 80));
  const hd = num('h', 0) * Math.PI / 180, p = num('pitch', 0) * Math.PI / 180;
  cam.lookAt(cam.position.x + Math.sin(hd) * Math.cos(p), cam.position.y + Math.sin(p), cam.position.z - Math.cos(hd) * Math.cos(p));
  renderer.render(scene, cam);
  document.title = 'done';
}, undefined, e => { document.title = 'error ' + e; });
