import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const base='/data/facade-review-galleries/chatgpt-mask-3d-v1/';
const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9df');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
document.querySelector('#viewport').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(38,1,.05,300);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#ffffff','#887b66',2));
const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(-20,30,35);scene.add(light);
const loader=new THREE.TextureLoader();
const data=await (await fetch(base+'scene.json')).json();
const [texture,original]=await Promise.all(['texture.png','original-texture.png'].map(async name=>{
 const t=await loader.loadAsync(base+name);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
}));
let group=new THREE.Group(),textGroup=new THREE.Group();scene.add(group,textGroup);
let sculpted=true,paint=true,wire=false;
function geometry(m){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.positions,3));g.setIndex(m.indices);if(m.uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(m.uvs,2));g.computeVertexNormals();return g;}
function rebuild(){for(const mesh of [...group.children]){mesh.geometry.dispose();mesh.material.dispose();group.remove(mesh);}
 const buckets=new Map();for(const m of sculpted?data.meshes:data.baseline){const key=m.textured?'texture':m.colour??'#aaa18e';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(geometry(m));}
 for(const [key,geometries]of buckets){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const material=new THREE.MeshStandardMaterial({map:paint&&key==='texture'?(sculpted?texture:original):null,color:key==='texture'?'#ffffff':key,roughness:.95,side:THREE.DoubleSide,wireframe:wire});group.add(new THREE.Mesh(merged,material));}
 document.querySelector('#geometry').textContent=sculpted?'3D details on':'Flat facade';
 document.querySelector('#texture').textContent=paint?'Texture on':'Plain materials';
}
for(const t of data.texts){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
 const ctx=canvas.getContext('2d');ctx.font=`600 ${t.id==='shop'?75:83}px ${t.id==='shop'?'Arial':'Georgia'}`;ctx.fillStyle=t.colour;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.text,512,64,1010);
 const map=t.texture?await loader.loadAsync(base+t.texture):new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const [l,top,r,bottom]=t.pixels,s=data.scale;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry((r-l)*s,(bottom-top)*s),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));
 mesh.position.set(((l+r)/2-data.textureDimensions[0]/2)*s,(data.groundPixel-(top+bottom)/2)*s,.06);
 mesh.userData.tentative=t.tentative;textGroup.add(mesh);
}
function updateText(){textGroup.visible=document.querySelector('#text').checked;for(const mesh of textGroup.children)mesh.visible=!mesh.userData.tentative||document.querySelector('#tentative').checked;}
function view(name){const aspect=camera.aspect,dist=Math.max(55,60/aspect);
 const pos=name==='front'?[0,10,dist]:name==='roof'?[19,31,dist*.72]:name==='detail'?[-7,9,10]:[18,15,dist*.9];
 camera.position.set(...pos);controls.target.set(name==='detail'?-7:0,name==='detail'?9:10,0);controls.update();
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#d9d0bb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);
document.querySelector('#geometry').onclick=()=>{sculpted=!sculpted;rebuild();};
document.querySelector('#texture').onclick=()=>{paint=!paint;rebuild();};
document.querySelector('#wire').onclick=()=>{wire=!wire;rebuild();};
for(const name of ['front','oblique','roof','detail'])document.querySelector('#'+name).onclick=()=>view(name);
for(const name of ['text','tentative'])document.querySelector('#'+name).onchange=updateText;
document.querySelector('#light').oninput=e=>{const a=Number(e.target.value)*Math.PI/180;light.position.set(Math.sin(a)*30,30,Math.cos(a)*30);};
function resize(){const r=document.querySelector('#viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(document.querySelector('#viewport'));resize();rebuild();updateText();view('oblique');
document.querySelector('#status').textContent=`${data.stats.apertures} recessed opening candidates · ${data.features.filter(f=>f.kind==='balcony').length} balcony assemblies. Dimensions and depths estimated; source registration pending.`;
document.querySelector('#loading').hidden=true;
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
window.imageMask3d={scene,camera,controls,data,renderer,view};
