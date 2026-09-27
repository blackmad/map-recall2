/** Isolated 3DBAG facade texture experiment. Does not mutate game data. */
// @ts-expect-error Three runtime is installed without its declaration package.
import * as THREE from 'three';
// @ts-expect-error Three runtime is installed without its declaration package.
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
type MeshData={id:string;positions:number[];indices?:number[];uvs?:number[];kind:string;textured?:boolean;colour?:string;cleanup?:{bbox:number[];colour:string}[]};
type Row={id:string;textureId?:string;label:string;sourceImage:string;generatedImage:string;meshes:MeshData[];camera?:{position:number[];target:number[]};frontCamera?:{position:number[];target:number[]};roofRepair?:{meshes:MeshData[]};notes?:string[];focusBounds?:{min:number[];max:number[]}};
const $=(id:string)=>document.getElementById(id)!;
const base='/data/facade-review-galleries/head-on-3d-v1/';
const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e5dd');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
$('viewport').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,1,.05,5000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=2;controls.autoRotateSpeed=.45;
const ambient=new THREE.AmbientLight('#ffffff',2.5);scene.add(ambient);
const sun=new THREE.DirectionalLight('#fff6e9',1);scene.add(sun);
let group=new THREE.Group(),edges=new THREE.Group(),frames=new THREE.Group();scene.add(group,edges,frames);
let rows:Row[]=[],current:Row,mode='texture',photo=false,wire=false,roofFit=true;
let centre=new THREE.Vector3(),radius=30,frontDirection=new THREE.Vector3(0,0,1),ground:any;
let texture:any,sourceTexture:any,bump:any;let generation=0;
const resources:any[]=[];const loader=new THREE.TextureLoader();
const url=(value:string)=>value.startsWith('/')?value:base+value;
async function loadTexture(value:string,colour=true){const t=await loader.loadAsync(url(value));t.colorSpace=colour?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;}
function clear(){for(const g of [group,edges,frames]){for(const child of [...g.children]){child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach((m:any)=>m.dispose());else child.material?.dispose();g.remove(child);}}for(const t of resources)t.dispose();resources.length=0;if(ground){scene.remove(ground);ground.geometry.dispose();ground.material.dispose();}}
function setView(view:string){const d=frontDirection.clone();if(view==='oblique')d.applyAxisAngle(new THREE.Vector3(0,1,0),.36);const elevation=view==='roof'?.85:view==='front'?.025:.22;camera.position.copy(centre).addScaledVector(d,radius*(view==='roof'?1.6:1.85)*Math.max(1,1.25/camera.aspect));camera.position.y=centre.y+radius*elevation;controls.target.copy(centre);camera.near=Math.max(.05,radius/1000);camera.far=radius*30;camera.updateProjectionMatrix();controls.update();for(const id of ['front','oblique','roof'])$(id).classList.toggle('active',id===view);}
function lighting(){const a=Number(($('light')as HTMLInputElement).value)*Math.PI/180;sun.position.set(centre.x+Math.sin(a)*radius*3,centre.y+radius*2,centre.z+Math.cos(a)*radius*3);sun.target.position.copy(centre);sun.target.updateMatrixWorld();}
function mappedMaterial(relief:boolean,map:any,data:MeshData){
 const cleanup=(data.cleanup??[]).map(f=>{const [x0,y0,x1,y1]=f.bbox;const c=new THREE.Color(f.colour);return `if(vMapUv.x>=${x0.toFixed(6)}&&vMapUv.x<=${x1.toFixed(6)}&&vMapUv.y>=${(1-y1).toFixed(6)}&&vMapUv.y<=${(1-y0).toFixed(6)}) sampledDiffuseColor=vec4(${c.r.toFixed(6)},${c.g.toFixed(6)},${c.b.toFixed(6)},1.0);`;}).join('\n');
 const m=new THREE.MeshStandardMaterial({bumpMap:relief&&!photo?bump:null,bumpScale:Number(($('depth')as HTMLInputElement).value)/100,roughness:.95,metalness:0,side:THREE.DoubleSide});
 m.map=map;m.color.set('#ffffff');
 m.onBeforeCompile=(shader:any)=>{shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replace('vec2 dHdxy_fwd() {','vec2 dHdxy_fwd() { if (any(lessThan(vBumpMapUv,vec2(0.0))) || any(greaterThan(vBumpMapUv,vec2(1.0)))) return vec2(0.0);'));shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec4 sampledDiffuseColor=texture2D(map,vMapUv);
 ${photo?'':cleanup}
 float covered=step(0.0,vMapUv.x)*step(vMapUv.x,1.0)*step(0.0,vMapUv.y)*step(vMapUv.y,1.0)*sampledDiffuseColor.a;
 diffuseColor.rgb*=mix(vec3(0.43,0.35,0.28),sampledDiffuseColor.rgb,covered);
 #endif`);};m.customProgramCacheKey=()=> 'facade-bounded-alpha-v2'+(photo?'photo':cleanup);return m;
}
function materials(){if(!current)return;const map=photo?sourceTexture:texture;for(const mesh of group.children){const data=mesh.userData.data as MeshData;mesh.material.dispose();if(data.textured&&mode!=='bare')mesh.material=mappedMaterial(mode!=='texture',map,data);else mesh.material=new THREE.MeshStandardMaterial({color:data.colour??(data.kind==='roof'?'#8a8175':'#c4b9a4'),roughness:1,side:THREE.DoubleSide});}
 frames.visible=mode==='frames'&&!photo;edges.visible=wire;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.classList.toggle('active',b.dataset.mode===mode);}
// Barycentric inversion finds a point on the actual mapped wall, not a proxy box.
function uvPoint(mesh:any,u:number,v:number){const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,idx=mesh.geometry.index;if(!uv)return null;const n=idx?idx.count:p.count;for(let j=0;j<n;j+=3){const ids=[0,1,2].map(k=>idx?idx.getX(j+k):j+k);const [a,b,c]=ids;const ax=uv.getX(a),ay=uv.getY(a),bx=uv.getX(b),by=uv.getY(b),cx=uv.getX(c),cy=uv.getY(c);const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-10)continue;const w1=((by-cy)*(u-cx)+(cx-bx)*(v-cy))/det,w2=((cy-ay)*(u-cx)+(ax-cx)*(v-cy))/det,w3=1-w1-w2;if(Math.min(w1,w2,w3)<-1e-5)continue;const pa=new THREE.Vector3().fromBufferAttribute(p,a),pb=new THREE.Vector3().fromBufferAttribute(p,b),pc=new THREE.Vector3().fromBufferAttribute(p,c);const normal=pb.clone().sub(pa).cross(pc.clone().sub(pa)).normalize();return {position:pa.multiplyScalar(w1).addScaledVector(pb,w2).addScaledVector(pc,w3),normal};}return null;}
async function addFrames(row:Row,token:number){
 let data:any;try{const response=await fetch(base+row.id+'-features.json');if(!response.ok)return;data=await response.json();}catch{return;}
 if(token!==generation)return;
 const candidates=data.features??data.candidates??[];let count=0;
 for(const f of candidates){const b=f.normalizedBounds??f.boundsNormalized??f.bboxNormalized;if(!b||b.length!==4)continue;const [x0,y0,x1,y1]=b;if(x1-x0<.003||y1-y0<.005)continue;
  for(const wall of group.children){if(!wall.userData.data.textured)continue;const points=[[x0,1-y1],[x1,1-y1],[x1,1-y0],[x0,1-y0]].map(([u,v])=>uvPoint(wall,u,v));if(points.some(p=>!p))continue;const ps=points as any[];if(ps.some(p=>Math.abs(p.normal.dot(ps[0].normal))<.98))continue;
   const n=ps[0].normal;const mid=ps[0].position.clone().add(ps[2].position).multiplyScalar(.5);if(n.dot(camera.position.clone().sub(mid))<0)n.negate();const width=ps[0].position.distanceTo(ps[1].position),height=ps[0].position.distanceTo(ps[3].position);if(width<.15||height<.25||width>4||height>5)continue;
   const offset=n.clone().multiplyScalar(.055);for(let k=0;k<4;k++){const a=ps[k].position.clone().add(offset),b=ps[(k+1)%4].position.clone().add(offset),dir=b.clone().sub(a),length=dir.length();const bar=new THREE.Mesh(new THREE.BoxGeometry(.055,length,.08),new THREE.MeshStandardMaterial({color:'#e2d8be',roughness:.9}));bar.position.copy(a.add(b).multiplyScalar(.5));bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());frames.add(bar);}count++;break;
  }
 }
 frames.userData.count=count;materials();status();
}
function status(){if(current.id==='recipe'){$('status').textContent='Blender recipe · agent-authored geometry with inferred dimensions and depths. Real balcony projections and recessed openings; simplified roof and trim. Not registered to a BAG building.';return;}const count=current.meshes.filter(m=>m.textured).length;$('status').textContent=`${current.label} · ${current.meshes.length} mesh parts · ${count} textured wall parts · ${frames.userData.count??0} candidate window frames. ${current.notes?.join(' ')??`Experimental image registration; inferred facade details. ${roofFit?'Illustrated roofline with a joined 2 m apron.':'Original BAG roofline.'}`}`;}
async function show(index:number,preserveView=false){const oldPosition=camera.position.clone(),oldTarget=controls.target.clone();($('row')as HTMLSelectElement).disabled=true;const token=++generation;$('loading').classList.remove('hidden');current=rows[index];clear();frames.userData.count=0;
 const recipe=current.id==='recipe',components=current.id==='components';
 if(recipe)mode='bare';else if(components)mode='texture';else if(mode==='bare'&&!preserveView)mode='texture';
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.disabled=(recipe&&b.dataset.mode!=='bare')||(components&&['frames','relief'].includes(b.dataset.mode!));
 for(const id of ['photo','depth'])($(id)as HTMLInputElement).disabled=recipe||components;
 ($('roof-fit')as HTMLButtonElement).disabled=!current.roofRepair;
 $('data-link').setAttribute('href',base+(recipe?'blender-facade.glb':components?'component-stats.json':'scene.json'));$('data-link').textContent=recipe?'Download Blender model (GLB)':components?'Automatic extraction and geometry results':'Geometry and registration record';
 texture=null;sourceTexture=null;bump=null;
 if(!recipe){[texture,sourceTexture]=await Promise.all([loadTexture((current.textureId??current.id)+'-texture.png'),loadTexture(current.sourceImage)]);resources.push(texture,sourceTexture);bump=null;
 try{bump=await loadTexture((current.textureId??current.id)+'-bump.png',false);resources.push(bump);}catch{/* Relief assets can be regenerated independently. */}}
 if(token!==generation)return;
 for(const data of roofFit&&current.roofRepair?current.roofRepair.meshes:current.meshes){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));if(data.indices)geometry.setIndex(data.indices);if(data.uvs)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.data=data;group.add(mesh);const line=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,25),new THREE.LineBasicMaterial({color:'#283f35',transparent:true,opacity:.4}));edges.add(line);}
 const fullBounds=new THREE.Box3().setFromObject(group);const bounds=new THREE.Box3();for(const m of group.children)if(m.userData.data.textured)bounds.expandByObject(m);if(current.focusBounds)bounds.set(new THREE.Vector3(...current.focusBounds.min),new THREE.Vector3(...current.focusBounds.max));else if(bounds.isEmpty())bounds.copy(fullBounds);bounds.getCenter(centre);const size=bounds.getSize(new THREE.Vector3());radius=Math.max(size.x,size.z,size.y*1.6)*.7;
 if(current.camera){const p=new THREE.Vector3(...current.camera.position),t=new THREE.Vector3(...current.camera.target);frontDirection.copy(p.sub(t));frontDirection.y=0;frontDirection.normalize();centre.copy(t);}
 ground=new THREE.Mesh(new THREE.PlaneGeometry(radius*8,radius*8),new THREE.MeshStandardMaterial({color:'#dad7ca',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(centre.x,bounds.min.y-.08,centre.z);scene.add(ground);
 $('source').setAttribute('src',url(current.sourceImage));$('generated').setAttribute('src',url(current.generatedImage));if(preserveView){camera.position.copy(oldPosition);controls.target.copy(oldTarget);controls.update();}else setView('oblique');lighting();materials();status();$('loading').classList.add('hidden');($('row')as HTMLSelectElement).disabled=false;if(!recipe&&current.id!=='components')void addFrames(current,token);
}
function resize(){const box=$('viewport').getBoundingClientRect();renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe($('viewport'));
for(const id of ['front','oblique','roof'])$(id).onclick=()=>setView(id);
$('roof-fit').onclick=()=>{roofFit=!roofFit;$('roof-fit').classList.toggle('active',roofFit);void show(Number(($('row')as HTMLSelectElement).value),true).catch(fail);};
$('rotate').onclick=()=>{$('rotate').classList.toggle('active');controls.autoRotate=!controls.autoRotate;};$('wire').onclick=()=>{wire=!wire;$('wire').classList.toggle('active',wire);materials();};
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode!;materials();};
$('light').oninput=lighting;$('depth').oninput=materials;$('photo').onchange=()=>{photo=($('photo')as HTMLInputElement).checked;materials();};
$('row').onchange=()=>{void show(Number(($('row')as HTMLSelectElement).value)).catch(fail);};
for(const id of ['source','generated'])$(id).onclick=()=>{const dialog=$('zoom')as HTMLDialogElement;dialog.querySelector('img')!.src=($(id)as HTMLImageElement).src;dialog.showModal();};$('close').onclick=()=>($('zoom')as HTMLDialogElement).close();
function fail(error:unknown){$('loading').classList.remove('hidden');$('error').textContent=String(error);console.error(error);}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
fetch(base+'scene.json').then(async response=>{if(!response.ok)throw Error('Build the local scene assets first.');const data=await response.json();rows=data.rows;const recipeResponse=await fetch(base+'blender-recipe-scene.json');if(!recipeResponse.ok)throw Error('Build the Blender recipe assets first.');rows.push(await recipeResponse.json());const componentResponse=await fetch(base+'component-scene.json');if(!componentResponse.ok)throw Error('Build component scene assets first.');rows.push(await componentResponse.json());if(!rows?.length)throw Error('No scene rows');for(const [i,row]of rows.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=({strip1:'Bilderdijkkade · brick & balconies',strip2:'Bilderdijkstraat · shops',strip3:'Westerstraat · gables'} as Record<string,string>)[row.id]??row.label;($('row')as HTMLSelectElement).append(o);}const requested=new URLSearchParams(location.search).get('study');const selected=Math.max(0,rows.findIndex(r=>r.id===requested));($('row')as HTMLSelectElement).value=String(selected);await show(selected);}).catch(fail);
(window as any).facadeTextureDemo={scene,renderer,camera,controls,get row(){return current;},get mode(){return mode;},get roofFit(){return roofFit;},setView,show,get frames(){return frames.children.length/4;}};
