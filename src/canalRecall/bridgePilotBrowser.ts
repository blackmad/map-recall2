import { buildBridgeReviewContext } from './bridgeReviewContext.ts';
import { buildBridgeGeometry } from './bridgeGeometry.ts';
import { bridgeProfileAt, validateBridgeSurfaceFile, type BridgeSurface } from './bridgeSurface.ts';
const { THREE }=window.CanalRecallThree;
const host=document.getElementById('viewport')!,select=document.getElementById('bridge') as HTMLSelectElement;
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8e0df');
scene.add(new THREE.HemisphereLight(0xfff7e9,0x596052,2));
const light=new THREE.DirectionalLight(0xffeed7,1.8);light.position.set(-30,-30,60);scene.add(light);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,1,.1,500);camera.up.set(0,0,1);
let bridge:BridgeSurface,bridges:BridgeSurface[]=[],meshes:any[]=[],target=new THREE.Vector3(),yaw=0,pitch=.25,radius=55,view='canal';
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();render();}
function render(){camera.position.set(target.x+radius*Math.cos(yaw)*Math.cos(pitch),target.y+radius*Math.sin(yaw)*Math.cos(pitch),target.z+radius*Math.sin(pitch));camera.lookAt(target);renderer.render(scene,camera);}
function plane(width:number,length:number,colour:string,position:number[],rotation=0){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.MeshStandardMaterial({color:colour,roughness:.95,side:THREE.DoubleSide}));mesh.position.set(...position);mesh.rotation.z=rotation;scene.add(mesh);meshes.push(mesh);}
function setView(value:string){view=value;if(!bridge)return;const angle=Math.atan2(bridge.deckAxis[1],bridge.deckAxis[0]);
  const length=bridge.deckRangeM[1]-bridge.deckRangeM[0],span=Math.max(length,bridge.widthM);
  yaw=value==='road'?angle+Math.PI:value==='opposite'?angle+Math.PI/2+.15:angle-Math.PI/2+.15;
  pitch=value==='above'?1.2:value==='road'?.15:value==='low'?.015:.22;
  radius=Math.min(100,value==='above'?Math.max(30,span*1.5+20):value==='road'?Math.max(24,span+15):Math.max(18,span*1.2+12));
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.view===value));render();}
function show(index:number){bridge=bridges[index];for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}meshes=[];
  const triangulate=(ring:[number,number][])=>THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]);
  const batches=[...buildBridgeGeometry(bridge,triangulate),...buildBridgeReviewContext(bridge)];
  for(const batch of batches){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));geometry.setIndex(batch.indices);if(batch.normals)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));else geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:batch.colour,roughness:.9,metalness:batch.kind==='railings'?.2:0,side:THREE.DoubleSide}));scene.add(mesh);meshes.push(mesh);}
  const[start,end]=bridge.deckRangeM,center=(start+end)/2-24,axis=bridge.deckAxis;
  target.set(axis[0]*center,axis[1]*center,.7);
  const angle=Math.atan2(axis[1],axis[0]),length=end-start;
  // Water extends beneath the banks: no background gaps at irregular caps.
  plane(400,400,'#8dabb5',[target.x,target.y,-.85],angle);
  document.getElementById('facts')!.innerHTML=`<dt>Municipal number</dt><dd>${bridge.id.replace('BRU','')}</dd><dt>Deck length</dt><dd>${length.toFixed(1)} m</dd><dt>Average width</dt><dd>${bridge.widthM.toFixed(1)} m</dd><dt>Rise above approaches</dt><dd>${Math.max(...bridge.samples.map(p=>p.heightM)).toFixed(2)} m</dd><dt>Peak road grade</dt><dd>${Math.max(...bridge.samples.map(p=>Math.abs(bridgeProfileAt(bridge,p.s).grade)))*100|0}%</dd><dt>Structure family</dt><dd>${bridge.family.replaceAll('-',' ')}</dd><dt>Missing stations filled</dt><dd>${bridge.provenance.elevation.interpolatedStations}</dd>`;
  const total=bridge.samples.at(-1)!.s,x=(s:number)=>10+s/total*240,y=(h:number)=>95-h/2.5*75;
  const points=bridge.samples.map(p=>`${x(p.s)},${y(p.heightM)}`).join(' ');
  document.getElementById('profile')!.innerHTML=`<line x1="10" y1="95" x2="250" y2="95" stroke="#a9b4aa"/><polygon points="10,95 ${points} 250,95" fill="#d9e4d8"/><polyline points="${points}" fill="none" stroke="#425e51" stroke-width="2"/><text x="10" y="115" fill="#56615a" font-size="11">Approach</text><text x="205" y="115" fill="#56615a" font-size="11">Approach</text>`;
  document.getElementById('status')!.textContent='Native scale · measured deck profile';setView(view);
}
select.addEventListener('change',()=>show(Number(select.value)));
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>setView((el as HTMLElement).dataset.view!)));
let drag:{x:number;y:number}|null=null;
host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};host.setPointerCapture(e.pointerId);});
host.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.008;pitch=Math.max(.04,Math.min(1.5,pitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY};render();});
host.addEventListener('pointerup',()=>drag=null);host.addEventListener('pointercancel',()=>drag=null);
host.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(15,Math.min(120,radius*Math.exp(e.deltaY*.001)));render();},{passive:false});
new ResizeObserver(resize).observe(host);resize();
function populate(query='') {
  const current=select.value;select.replaceChildren();
  for(const[index,b]of bridges.entries())if(`${b.name} ${b.id}`.toLowerCase().includes(query.toLowerCase())) {
    const option=document.createElement('option');option.value=String(index);option.textContent=`${b.name} · ${b.id.replace('BRU','')}`;select.append(option);
  }
  if([...select.options].some(o=>o.value===current))select.value=current;
  else if(select.options.length)show(Number(select.value));
}
document.getElementById('search')!.addEventListener('input',e=>populate((e.target as HTMLInputElement).value));
fetch('../data/extracts/amsterdam/bridge-surfaces.json').then(async response=>{
  if(!response.ok)throw Error('Survey HTTP '+response.status);
  const data=await response.json();validateBridgeSurfaceFile(data);bridges=data.bridges;populate();const initial=Math.max(0,bridges.findIndex(b=>b.id===location.hash.slice(1)));select.value=String(initial);show(initial);
  document.getElementById('coverage')!.textContent=`${bridges.length} bridges generated with measured profiles. Automated checks passed; structural details are illustrative.`;
  const reportResponse=await fetch('../data/extracts/amsterdam/bridge-surface-review.json');
  if(reportResponse.ok){const report=await reportResponse.json(),deferred=report.entries.filter((e:any)=>e.status!=='ready');
    document.getElementById('review-summary')!.textContent=`${deferred.length} crossings needing review`;
    for(const entry of deferred){const item=document.createElement('li'),link=document.createElement('a');
      link.textContent=`${entry.name} (${entry.id})`;link.href=`https://www.openstreetmap.org/?mlat=${entry.center[1]}&mlon=${entry.center[0]}#map=19/${entry.center[1]}/${entry.center[0]}`;link.target='_blank';link.rel='noopener';
      item.append(link,document.createTextNode(` — ${entry.reasons.join('; ')}`));item.style.marginBottom='12px';document.getElementById('review-list')!.append(item);
    }
  }
  (window as any).bridgePilotReady=true;
  window.addEventListener('hashchange',()=>{const index=bridges.findIndex(b=>b.id===location.hash.slice(1));if(index>=0){select.value=String(index);show(index);}});
  (window as any).bridgePilotReview={bridges,hideColour:(colour:string)=>{for(const mesh of meshes)if('#'+mesh.material.color.getHexString()===colour)mesh.visible=false;render();},show:(id:string,viewName='low')=>{const index=bridges.findIndex(b=>b.id===id);if(index<0)throw Error('Unknown bridge '+id);select.value=String(index);show(index);setView(viewName);}};
}).catch(e=>{document.getElementById('status')!.textContent=String(e);});
