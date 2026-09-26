/* A deliberately small, local scene. Source geometry is compiled separately;
 * window rhythms and furniture are authored and stay independently switchable. */
import { roofPalette } from './evidence.js';
import { wallObservationIntervals,clipWallTriangles,intervalFaceFrame } from './wall-intervals.js';
import { rectangleFitsFace } from './face-containment.js';
import { facadeOpeningLayout,overlapsOpening } from '../js/facade-opening-layout.bundle.js';
import { treeTypology } from './tree-typology.js';
import { machineSignCandidate,MACHINE_SIGN_PROVENANCE } from './machine-signs.js';
import { mayRenderReviewedAwning,awningEvidenceSummary } from './awning-evidence.js';
import { planFrontageCamera,frontageFraming } from './frontage-camera.js';
import { neighbourhoodDisplayBounds } from './neighbourhood-bounds.js';
const eland = new URLSearchParams(location.search).get('study') === 'elandsgracht';
const neighbourhoodMode = !eland && new URLSearchParams(location.search).get('neighbourhood') === '1';
const inventoryTreeMode=neighbourhoodMode&&new URLSearchParams(location.search).get('trees')!=='legacy';
const machineSignMode=neighbourhoodMode&&new URLSearchParams(location.search).get('machineSigns')==='1';
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
let neighbourhood;
const observedPalette={brown:'#876650',red:'#945c48',buff:'#bba681',grey:'#96938a',white:'#d8d4c3',black:'#57544e'};
const THREE = window.CanalRecallThree.THREE;
const $ = s => document.querySelector(s);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas = $('#scene'), stage = $('.stage');
const state = { street: true, anchors: true, facades: true, view: 'overview', ready: false, selected: null };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9e9df');
const camera = new THREE.PerspectiveCamera(38, 1, .2, 1600);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight('#f7f8ed', '#abb5a2', 2));
const sun = new THREE.DirectionalLight('#fff5df', 2.5);
sun.position.set(-100, 200, 100); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left = -185; sun.shadow.camera.right = 185;
sun.shadow.camera.top = 185; sun.shadow.camera.bottom = -185; sun.shadow.camera.near = 20; sun.shadow.camera.far = 500;
sun.shadow.bias = -.001; sun.shadow.normalBias = .4; scene.add(sun);
const groups = Object.fromEntries(['base','buildings','facades','street','anchors'].map(k => { const g = new THREE.Group(); scene.add(g); return [k,g]; }));
const machineSignPreviews=[],machineSignSkips=[],wallPatches=[],openingLayouts=[];
const materialCache = new Map(), batches = new Map(), buildingMeshes = [], labelEntries = [], facadeFaces = new Map();
const triangleBatches = new Map(), lineBatches = new Map();
const boxGeo = new THREE.BoxGeometry(1,1,1), sphereGeo = new THREE.IcosahedronGeometry(1,1);
const dummy = new THREE.Object3D();
let data, selectedOutline, transition, frontageFrameRecord, reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const orbit = { target: new THREE.Vector3(0, 0, -6), radius: 340, theta: .62, phi: .72 };
const buildingMaterials = [], surfaceMaterials = [];
let brickTexture;
function brickMap(){
  if(brickTexture)return brickTexture;
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle='#c4c2b8';ctx.fillRect(0,0,512,256);
  for(let row=0;row<12;row++)for(let col=-1;col<9;col++){
    const g=224+Math.floor(hash(`${row}:${col}`)*28);ctx.fillStyle=`rgb(${g},${g},${g})`;
    ctx.fillRect(col*64+(row%2)*32+1,row*256/12+1,62,256/12-2);
  }
  brickTexture=new THREE.CanvasTexture(c);brickTexture.colorSpace=THREE.SRGBColorSpace;
  brickTexture.wrapS=brickTexture.wrapT=THREE.RepeatWrapping;brickTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return brickTexture;
}
function material(colour, roughness = .85, variant = '') {
  const key = `${colour}:${roughness}:${variant}`;
  if (!materialCache.has(key)) { const m = new THREE.MeshStandardMaterial({ color: colour, roughness, side: THREE.DoubleSide }); m.shadowSide=THREE.BackSide; materialCache.set(key,m); }
  return materialCache.get(key);
}
function instance(group, kind, colour, position, scale, yaw = 0) {
  const key = `${group}:${kind}:${colour}`;
  if (!batches.has(key)) batches.set(key, { group, kind, colour, items: [] });
  batches.get(key).items.push({ position, scale, yaw });
}
function box(group, colour, p, size, yaw = 0) { instance(group,'box',colour,p,size,yaw); }
function foliage(colour,p,size) { instance('street','sphere',colour,p,size); }
function flushInstances() {
  for (const b of batches.values()) {
    const mesh = new THREE.InstancedMesh(b.kind === 'sphere' ? sphereGeo : boxGeo, material(b.colour), b.items.length);
    b.items.forEach((item,i) => { dummy.position.set(...item.position); dummy.rotation.set(0,item.yaw,0); dummy.scale.set(...item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true;
    groups[b.group].add(mesh);
  }
}
function line(group, points, colour, opacity = 1) {
  if (points.length < 2) return;
  const key=`${group}:${colour}:${opacity}`;
  if(!lineBatches.has(key))lineBatches.set(key,{group,colour,opacity,points:[]});
  const batch=lineBatches.get(key);for(let i=0;i<points.length-1;i++)batch.points.push(...points[i],...points[i+1]);
}
function ringsTriangles(rings) {
  const clean = rings.map(r => r.length > 2 && r[0].every((x,i) => Math.abs(x-r.at(-1)[i]) < .005) ? r.slice(0,-1) : r).filter(r=>r.length>=3);
  if (!clean.length) return [];
  const a = new THREE.Vector3(...clean[0][0]);
  let normal = new THREE.Vector3();
  for(let i=1;i<clean[0].length-1;i++) {
    normal.crossVectors(new THREE.Vector3(...clean[0][i]).sub(a),new THREE.Vector3(...clean[0][i+1]).sub(a));
    if (normal.lengthSq() > .00001) break;
  }
  if(normal.lengthSq()<.00001) return [];
  const n=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)],drop=n.indexOf(Math.max(...n));
  const project=p=>new THREE.Vector2(...p.filter((_,i)=>i!==drop));
  const flat=clean.flat(),indices=THREE.ShapeUtils.triangulateShape(clean[0].map(project),clean.slice(1).map(r=>r.map(project)));
  return indices.flatMap(tri=>{
    // Earcut's 2D winding changes when projecting away Y. Restore the source
    // surface's 3D normal, otherwise roof backs self-shadow with moiré stripes.
    const p=new THREE.Vector3(...flat[tri[0]]),q=new THREE.Vector3(...flat[tri[1]]),r=new THREE.Vector3(...flat[tri[2]]);
    const dot=q.sub(p).cross(r.sub(p)).dot(normal);
    return(dot<0?[tri[0],tri[2],tri[1]]:tri).flatMap(i=>flat[i]);
  });
}
function meshTriangles(group, triangles, mat, id) {
  if (!triangles.length) return;
  const key=`${group}:${mat.uuid}`;
  if(!triangleBatches.has(key))triangleBatches.set(key,{group,mat,triangles:[],owners:[]});
  const b=triangleBatches.get(key);for(const v of triangles)b.triangles.push(v);for(let i=0;i<triangles.length/9;i++)b.owners.push(id||null);
  return b;
}
function flushTriangles(){
  for(const b of triangleBatches.values()){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.triangles,3));g.computeVertexNormals();
    if(b.mat.map){
      const uv=[],p=g.getAttribute('position'),n=g.getAttribute('normal');
      for(let i=0;i<p.count;i++)uv.push((-p.getX(i)*n.getZ(i)+p.getZ(i)*n.getX(i))/2,p.getY(i));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    }
    // Small reconstructed roof slivers are below the shadow-map texel size.
    // Cast their silhouette onto the street; use diffuse shading on buildings.
    const mesh=new THREE.Mesh(g,b.mat);mesh.receiveShadow=b.group!=='buildings';mesh.castShadow=b.group==='buildings';groups[b.group].add(mesh);
    if(b.group==='buildings'){mesh.userData.owners=b.owners;buildingMeshes.push(mesh);}
  }
  for(const b of lineBatches.values()){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.points,3));
    groups[b.group].add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:b.colour,transparent:b.opacity<1,opacity:b.opacity})));
  }
}
function surface(group,geometry,y,colour) {
  if(geometry?.type!=='MultiPolygon')return;
  const triangles=geometry.coordinates.flatMap(p=>ringsTriangles(p.map(r=>r.map(q=>[q[0],y,q[1]]))));
  return meshTriangles(group,triangles,material(colour));
}
function inside(p,ring) {
  let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;
}
function inGeometry(p,g) {return g?.type==='MultiPolygon'&&g.coordinates.some(poly=>inside(p,poly[0])&&!poly.slice(1).some(r=>inside(p,r)));}
function mean(r){return r.reduce((a,p)=>[a[0]+p[0]/r.length,a[1]+p[1]/r.length],[0,0]);}
function hash(s){let n=0;for(const c of String(s))n=(Math.imul(n,31)+c.charCodeAt(0))|0;return(n>>>0)/4294967295;}
function ground() {
  const [x0,z0,x1,z1]=data.bounds;
  box('base','#c8c8b7',[(x0+x1)/2,-2.7,(z0+z1)/2],[x1-x0,3.8,z1-z0]);
  box('base','#dedccc',[(x0+x1)/2,-.67,(z0+z1)/2],[x1-x0,.28,z1-z0]);
  for(const f of data.layers.onbegroeidterreindeel) surface('base',f.geometry,-.47,f.kind==='erf'?'#cbcbb8':'#d3d1bf');
  for(const f of data.layers.begroeidterreindeel) surface('base',f.geometry,-.4,'#a6b38b');
  for(const f of data.layers.waterdeel) {
    surface('base',f.geometry,-.32,'#709e9a');
    for(const p of f.geometry.coordinates) for(const r of p) {
      line('street',r.map(p=>[p[0],-.1,p[1]]),'#9c9e88');
      // Quay faces share the measured water boundary. Heights are stylised.
      const t=[];for(let i=0;i<r.length-1;i++){const a=r[i],b=r[i+1];t.push(...[a[0],-.3,a[1],b[0],-.3,b[1],b[0],.05,b[1],a[0],-.3,a[1],b[0],.05,b[1],a[0],.05,a[1]]);}
      meshTriangles('street',t,material('#887e64'));
    }
  }
  for(const f of data.layers.overbruggingsdeel) surface('base',f.geometry,-.15,'#b9b7a5');
  for(const f of [...data.layers.ondersteunendwegdeel,...data.layers.wegdeel]) {
    const kind=f.kind||'',isFoot=kind.includes('voet'),isCycle=kind==='fietspad',isPark=kind==='parkeervlak';
    const colour=isCycle?'#a67664':isFoot?'#c8c5b6':isPark?'#969a91':f.surface==='open verharding'?'#a58d7d':'#939991';
    const mesh=surface('base',f.geometry,isFoot?.10:.035,colour);
    if(mesh&&!surfaceMaterials.some(s=>s.m===mesh.mat))surfaceMaterials.push({m:mesh.mat,colour});
    if(isFoot)for(const p of f.geometry.coordinates??[])line('street',p[0].map(q=>[q[0],.15,q[1]]),'#ece8d8');
    if(isPark&&hash(f.id)>.57){
      const r=f.geometry.coordinates[0]?.[0];if(!r)continue;const c=mean(r);
      if(c[0]<x0+7||c[0]>x1-7||c[1]<z0+7||c[1]>z1-7)continue;
      let best=[r[0],r[1]],len=0;for(let i=0;i<r.length-1;i++){const d=Math.hypot(r[i+1][0]-r[i][0],r[i+1][1]-r[i][1]);if(d>len){len=d;best=[r[i],r[i+1]];}}
      const yaw=Math.atan2(best[1][0]-best[0][0],best[1][1]-best[0][1]);
      const colour=['#e5e0ce','#5c6c69','#8a9389','#b5aa90','#66655e'][Math.floor(hash(f.id+'car')*5)];
      box('street',colour,[c[0],.65,c[1]],[1.7,.85,3.85],yaw);
      box('street','#344d50',[c[0],1.22,c[1]],[1.48,.62,2.1],yaw);
      box('street',colour,[c[0],1.57,c[1]],[1.50,.08,2],yaw);
    }
  }
  for(const f of data.layers.spoor){
    const paths=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const p of paths) {
      // BGT spoor gives track axes; two 1.435 m gauge rails are illustrative.
      for(const side of [-.7175,.7175]){
        const points=p.map((a,i)=>{const b=p[Math.min(i+1,p.length-1)],c=p[Math.max(i-1,0)],dx=b[0]-c[0],dz=b[1]-c[1],d=Math.hypot(dx,dz)||1;return[a[0]-dz/d*side,.11,a[1]+dx/d*side];});
        line('street',points,'#6c7168');
      }
    }
  }
  for(const f of data.layers.paal){const p=f.geometry.coordinates;if(f.geometry.type==='Point')box('street','#596554',[p[0],.55,p[1]],[.17,1.1,.17]);}
  for(const t of data.trees){
    if(t.type==='Stobbe')continue;
    const[x,z]=t.position;if(x<x0+4||x>x1-4||z<z0+4||z>z1-4)continue;
    if(inventoryTreeMode){
      const proxy=treeTypology(t);if(!proxy)continue;t.renderedTree=proxy;
      const tones=[hash(t.id)>.5?'#7e9b61':'#8ca66a','#9eb37b','#769361'];
      box('street','#766c51',[x,proxy.trunkHeight/2,z],[proxy.trunkWidth,proxy.trunkHeight,proxy.trunkWidth]);
      for(const p of proxy.lobes)foliage(tones[p.tone],[x+p.offset[0],p.offset[1],z+p.offset[2]],p.scale);
      box('street','#a2997d',[x,.075,z],[1.2,.15,1.2]);continue;
    }
    const h=Math.max(4,Math.min(23,t.height)),r=Math.max(1.3,h*.22),shade=hash(t.id);
    box('street','#766c51',[x,h*.30,z],[.35,h*.6,.35]);
    foliage(shade>.5?'#7e9b61':'#8ca66a',[x,h*.73,z],[r,h*.25,r*.88]);
    foliage('#9eb37b',[x-r*.48,h*.68,z+r*.25],[r*.65,h*.18,r*.67]);
    foliage('#769361',[x+r*.44,h*.64,z-r*.23],[r*.66,h*.22,r*.65]);
    box('street','#a2997d',[x,.075,z],[1.2,.15,1.2]);
  }
  for(const berth of data.moorings||[]){
    const r=berth.geometry.coordinates[0][0].slice(0,-1),c=mean(r);
    if(c[0]<x0+8||c[0]>x1-8||c[1]<z0+8||c[1]>z1-8)continue;
    let axis=[1,0],long=0;
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>long){long=len;axis=[(b[0]-a[0])/len,(b[1]-a[1])/len];}}
    const across=r.map(p=>-axis[1]*p[0]+axis[0]*p[1]),width=Math.min(5.5,Math.max(...across)-Math.min(...across))*.85;
    const length=Math.min(22,long*.9),yaw=Math.atan2(axis[0],axis[1]);
    if(length<4||width<1.2)continue;
    box('street','#586763',[c[0],.12,c[1]],[width,.65,length],yaw);
    box('street','#e0ddc8',[c[0],1.2,c[1]],[width*.87,1.65,length*.75],yaw);
    box('street','#7b8471',[c[0],2.1,c[1]],[width*.93,.18,length*.79],yaw);
    for(let i=-2;i<=2;i++)for(const side of [-1,1]){
      const along=i*length*.12,p=[c[0]+axis[0]*along-axis[1]*width*.441*side,1.35,c[1]+axis[1]*along+axis[0]*width*.441*side];
      box('street','#658581',p,[.06,.72,Math.max(.8,length*.085)],yaw);
    }
  }
}
function faceFrame(surface,b) {
  const r=surface.rings[0];let a,bp,len=0;
  for(const p of r)for(const q of r){const d=Math.hypot(p[0]-q[0],p[2]-q[2]);if(d>len){len=d;a=p;bp=q;}}
  if(len<(b.family==='institutional-bands'?2:2.4))return null;
  const bottom=Math.min(...r.map(p=>p[1])),top=Math.max(...r.map(p=>p[1]));if(top-bottom<(b.family==='institutional-bands'?2:5.5))return null;
  const u=[(bp[0]-a[0])/len,(bp[2]-a[2])/len];let n=[-u[1],u[0]],mid=[(a[0]+bp[0])/2,(a[2]+bp[2])/2];
  if(b.family==='institutional-bands'){if(n[0]*(mid[0]-b.center[0])+n[1]*(mid[1]-b.center[1])<0)n=n.map(v=>-v);}
  else if(inGeometry([mid[0]+n[0]*.3,mid[1]+n[1]*.3],b.footprint))n=n.map(v=>-v);
  const front=[mid[0]+n[0]*.7,mid[1]+n[1]*.7];
  if(data.buildings.some(other=>other.id!==b.id&&inGeometry(front,other.footprint)))return null;
  const publicFace=[1.5,3.5,6].some(d=>data.layers.wegdeel.some(f=>/voet|woon|rijbaan/.test(f.kind)&&inGeometry([mid[0]+n[0]*d,mid[1]+n[1]*d],f.geometry)));
  const yaw=Math.atan2(n[0],n[1]);
  const project=p=>[(p[0]-a[0])*u[0]+(p[2]-a[2])*u[1],p[1]];
  return{a:[a[0],a[2]],u,n,mid,width:len,bottom,top,publicFace,yaw,polygon:r.map(project),holes:surface.rings.slice(1).map(r=>r.map(project))};
}
function onFace(f,t,y,depth=0){return[f.a[0]+f.u[0]*t+f.n[0]*depth,y,f.a[1]+f.u[1]*t+f.n[1]*depth];}
function faceBox(group,f,colour,t,y,w,h,depth=.12,offset=.07){
  if(f.intervalBounded){const left=Math.max(0,t-w/2),right=Math.min(f.width,t+w/2);if(right-left<.01)return;t=(left+right)/2;w=right-left;if(!fitsFace(f,t,y,w,h))return;}
  box(group,colour,onFace(f,t,y,offset),[w,h,depth],f.yaw);
}
// Stable avalanche seed: nearby BAG identifiers still produce distinct choices.
function variation(id,field){let h=2166136261;for(const c of `${id}:${field}`)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return(h>>>0)/4294967296;}
function fitsFace(f,t,y,w,h){return neighbourhoodMode?rectangleFitsFace(f,t,y,w,h):[-1,1].every(dx=>[-1,1].every(dy=>inside([t+dx*w/2,y+dy*h/2],f.polygon)));}
function institution(f){
  // The visible canal elevation is observed; the rear complex is left restrained.
  if(f.n[1]<.65||f.mid[1]<-125)return;
  const bays=Math.max(1,Math.round(f.width/2.8)),bw=f.width/bays;
  for(const y of [2.0,5.0,8.1,11.15,14.2,17.25,20.3,25.25]){
    const h=y<6?2.2:2.0;
    for(let i=0;i<bays;i++){
      const t=(i+.5)*bw,w=bw-.16;if(!fitsFace(f,t,y,w+.12,h+.18))continue;
      faceBox('facades',f,'#d7d5c4',t,y,w+.12,h+.18,.1,.14);
      faceBox('facades',f,'#647d7b',t,y,w,h,.06,.22);
      faceBox('facades',f,'#93a39b',t-w*.21,y,w*.43,h-.12,.025,.26);
      faceBox('facades',f,'#d7d5c4',t,y,.07,h,.04,.29);
      faceBox('facades',f,'#d7d5c4',t,y+.5,w,.07,.04,.29);
      if(y>6&&fitsFace(f,t,y-1.2,w,.3))faceBox('facades',f,'#c3ad64',t,y-1.2,w,.3,.07,.16);
    }
    if(fitsFace(f,f.width/2,y+h/2+.22,f.width-.15,.18))faceBox('facades',f,'#ded9c4',f.width/2,y+h/2+.22,f.width-.15,.18,.25,.16);
  }
}
function makeBuildings(){
  for(const b of data.buildings){
    const detail=b.focus||b.anchorIds?.length||neighbourhoodMode&&neighbourhood?.records.some(r=>r.buildingId===b.id);
    const palette=eland?['#795e50','#927561','#655b50','#aa8870','#a3907b','#574f45']:b.family==='later-infill'?['#b8aa91','#c5bba5']:b.family==='shopping-row'?['#806356','#7e6255','#876e5d']:['#98785f','#876754','#94715b','#987b63'];
    const wallColour=b.appearance?.wallColour||(detail?palette[Math.floor((eland?variation(b.id,'brick'):hash(b.id))*palette.length)]:'#d4d2c4');
    const roofColour=roofPalette(neighbourhood?.records.find(r=>r.buildingId===b.id)?.images.aerial?.roofColour)||(detail?'#77776c':'#c2c3b7');
    const textured=detail&&b.appearance?.brick!==false;
    const wallMat=material(wallColour,.85,textured?'wall-brick':'wall-plain'),roofMat=material(roofColour,.85,'roof');
    if(textured){wallMat.map=brickMap();wallMat.needsUpdate=true;}
    if(!buildingMaterials.some(m=>m.wallMat===wallMat&&m.roofMat===roofMat))buildingMaterials.push({wallMat,roofMat,wallColour,textured,roofColour});
    const frames=[];
    if(b.surfaces.length){
      for(const [surfaceIndex,s] of b.surfaces.entries()){
        const triangles=ringsTriangles(s.rings),frame=s.type==='wall'&&detail?faceFrame(s,b):null;
        const partition=neighbourhoodMode&&s.type==='wall'?wallObservationIntervals(s,surfaceIndex,b.id,neighbourhood.records):null;
        const intervals=partition?.axis?partition.intervals:[{observation:null,status:'baseline'}];
        for(const interval of intervals){
          const r=interval.observation;let mat=s.type==='wall'?wallMat:roofMat;
          const colour=r&&observedPalette[r.effectiveProposal?.wallColour];
          if(colour){const texture=r.effectiveProposal.wallMaterial==='brick';mat=material(colour,.85,texture?'wall-brick':'wall-plain');if(texture){mat.map=brickMap();mat.needsUpdate=true;}
            if(!buildingMaterials.some(m=>m.wallMat===mat))buildingMaterials.push({wallMat:mat,roofMat,wallColour:colour,textured:texture,roofColour});}
          const patchTriangles=partition?.axis?clipWallTriangles(triangles,partition.axis,interval.startM,interval.endM):triangles;
          meshTriangles('buildings',patchTriangles,mat,b.id);
          if(s.type==='wall')wallPatches.push({buildingId:b.id,sourceSurfaceIndex:surfaceIndex,startM:interval.startM,endM:interval.endM,observationId:r?.id||null,status:interval.status,candidateIds:interval.candidateIds||[],colour:colour||wallColour,triangles:patchTriangles.length/9});
          if(frame&&interval.status!=='conflict'){
            const patchFrame=partition?.axis?intervalFaceFrame(frame,partition.axis,interval):frame;
            if(patchFrame)frames.push({...patchFrame,sourceSurfaceIndex:surfaceIndex});
          }
        }
      }
    }else{
      for(const poly of b.footprint.coordinates){const r=poly[0],triangles=[];for(let i=0;i<r.length-1;i++){const a=r[i],c=r[i+1];triangles.push(...ringsTriangles([[[a[0],0,a[1]],[c[0],0,c[1]],[c[0],b.height,c[1]],[a[0],b.height,a[1]]]]));}meshTriangles('buildings',triangles,wallMat,b.id);meshTriangles('buildings',ringsTriangles(poly.map(r=>r.map(p=>[p[0],b.height,p[1]]))),roofMat,b.id);}
    }
    if(!detail)continue;
    facadeFaces.set(b.id,frames);
    for(const f of frames){
      if(b.family==='institutional-bands'){institution(f);continue;}
      if(!f.publicFace||f.width<(eland?1.8:3)||f.bottom>2)continue;
      const floors=Math.max(2,Math.min(5,Math.round((f.top-f.bottom)/3.65))),fh=(f.top-Math.max(.2,f.bottom))/floors;
      const bays=Math.max(1,Math.round(f.width/(eland?2.15+variation(b.id,'bays')*.8:2.55))),bw=f.width/bays;
      // Keep details below the lowest wall top where the roof forms a gable.
      const windowWidth=Math.min(eland?1.15+variation(b.id,'window-width')*.4:1.3,bw*.57),winHeight=Math.min(2.05,fh*.64);
      const observedShop=f.observation?.effectiveProposal?.shopfront;
      const shopping=neighbourhoodMode?observedShop==='yes':observedShop==='yes'?true:observedShop==='no'?false:eland?b.street==='Elandsgracht'&&Math.abs(f.n[1])>.65:b.street==='De Clercqstraat'&&f.n[1]>.45;
      const layout=facadeOpeningLayout(f,{floors,bays,windowWidth,windowHeight:winHeight});
      openingLayouts.push({buildingId:b.id,sourceSurfaceIndex:f.sourceSurfaceIndex,observationId:f.observation?.id||null,...layout});
      faceBox('facades',f,'#b9b19b',f.width/2,layout.base+.35,f.width,.7,.10);
      if(layout.belt)faceBox('facades',f,'#ded6bd',layout.belt.t,layout.belt.y,layout.belt.width,layout.belt.height,.24);
      const cornice={t:f.width/2,y:f.top-.25,width:f.width-.2,height:.22};
      if(!overlapsOpening(cornice,layout.openings)&&fitsFace(f,cornice.t,cornice.y,cornice.width,cornice.height))faceBox('facades',f,'#e2dcc7',cornice.t,cornice.y,cornice.width,cornice.height,.30);
      if(shopping)faceBox('facades',f,'#354744',f.width/2,layout.base+1.4,f.width-.1,2.75,.10);
      // Generic commercial glazing can remain provisional. Distinctive canopies need placement review.
      if(shopping&&f.observation){
        // Ground glazing is emitted per opening below; a second full-width pane
        // and fixed-height fascia would cover the doors and cut through windows.
        if(mayRenderReviewedAwning(f.observation)){
          const canopyY=layout.belt?.y??layout.base+3.1;
          faceBox('facades',f,'#807765',f.width/2,canopyY+.14,f.width-.3,.12,1.1,.67);
          faceBox('facades',f,'#807765',f.width/2,canopyY,f.width-.3,.23,.09,1.23);
        }
      }
      for(const {floor,bay,t,isDoor,width:ww,height:hh,y:wy} of layout.openings){
        faceBox('facades',f,'#d9d8c5',t,wy,ww+.20,hh+.19,.13,.10);
        faceBox('facades',f,isDoor?'#4a5447':'#516867',t,wy,ww,hh,.09,.18);
        if(!isDoor){
          faceBox('facades',f,'#96a5a0',t-ww*.25,wy+.08,ww*.4,hh*.82,.025,.24);
          faceBox('facades',f,'#e4e0cd',t,wy+hh*.18,ww,.075,.04,.25);
          faceBox('facades',f,'#e3dcc5',t,wy-hh/2-.12,ww+.35,.13,.3,.17);
        }else{faceBox('facades',f,'#bea77b',t+ww*.3,layout.base+1.2,.045,.18,.05,.25);}
        if(!eland&&!shopping&&floors>=4&&floor>=1&&floor<=2&&bay===Math.floor(bays/2)&&b.family!=='later-infill'){
          faceBox('facades',f,'#c6c1ae',t,wy-hh/2-.18,ww+.65,.18,1.05,.5);
          faceBox('facades',f,'#4c5b4d',t,wy-hh/2+.65,ww+.7,.065,.06,1.0);
          for(let k=-3;k<=3;k++)faceBox('facades',f,'#52624f',t+k*(ww+.65)/7,wy-hh/2+.27,.04,.75,.05,1.0);
        }
      }
    }
  }
}
function signTexture(text,bg,fg,style){
  const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
  if(style==='rainbow'){['#c64038','#eb9140','#e7d94d','#429660','#3999bd','#355b94'].forEach((colour,i)=>{ctx.fillStyle=colour;ctx.fillRect(0,i*c.height/6,c.width,c.height/6+1);});}
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';let size=style==='rainbow'?105:style==='machine'?96:66;
  const font=['rainbow','machine'].includes(style)?'Arial':'Georgia',weight=style==='machine'?700:600;
  ctx.font=`${weight} ${size}px ${font}`;while(ctx.measureText(text).width>940){size-=2;ctx.font=`${weight} ${size}px ${font}`;}
  ctx.fillText(text,512,68);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex;
}
function makeMachineSigns(){
  if(!machineSignMode)return;
  for(const r of neighbourhood.records){
    const candidate=machineSignCandidate(r,data.anchors);
    if(!candidate.eligible){if(r.effectiveProposal?.visibleSignText)machineSignSkips.push(candidate);continue;}
    // Only this record's supported wall interval may receive its text.
    const faces=(facadeFaces.get(r.renderBuildingId)||[]).filter(f=>f.observation?.id===r.id&&f.publicFace&&f.bottom<2).sort((a,b)=>b.width-a.width);
    const f=faces.find(f=>fitsFace(f,f.width/2,3.22,Math.min(f.width-.3,7.4),.58));
    if(!f){machineSignSkips.push({...candidate,eligible:false,reason:'no-matched-ground-wall-for-band'});continue;}
    const width=Math.min(f.width-.3,7.4),texture=signTexture(candidate.text,'#e7e5d9','#25372e','machine');
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.58),new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide}));
    mesh.position.set(...onFace(f,f.width/2,3.22,.57));mesh.rotation.y=f.yaw;groups.anchors.add(mesh);
    machineSignPreviews.push({...candidate,width,position:mesh.position.toArray(),wallMid:f.mid,wallNormal:f.n});
  }
  const warning=document.createElement('small');warning.id='machine-sign-provenance';warning.textContent=MACHINE_SIGN_PROVENANCE;
  warning.style.cssText='position:absolute;top:49px;left:14px;max-width:calc(100% - 28px);padding:6px 8px;background:#f8f7eff2;color:#435449;border:1px solid #ccd2c2;font-size:10px;line-height:1.4;pointer-events:none';stage.append(warning);
}
function addSign(f,anchor){
  const w=Math.min(f.width-.3,anchor.signStyle==='rainbow'?10:anchor.id==='groot'?6.5:7.4),h=anchor.signStyle==='rainbow'?.66:.58;
  faceBox('anchors',f,anchor.colour,f.width/2,1.55,f.width-.14,2.9,.16,.32);
  // Broad glazing and a continuous fascia give the shop a readable ground floor.
  faceBox('anchors',f,'#5b7370',f.width*.53,1.44,f.width*.65,1.85,.05,.44);
  const tex=signTexture(anchor.sign,anchor.colour,anchor.trim,anchor.signStyle),m=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(...onFace(f,f.width/2,3.22,.52));mesh.rotation.y=f.yaw;if(anchor.sign)groups.anchors.add(mesh);
  for(const t of [f.width*.17,f.width*.87])faceBox('anchors',f,anchor.trim,t,1.55,.1,2.6,.14,.48);
  if(anchor.signStyle==='rainbow'){
    // Abstract shelves/paint tins are illustrative; the fascia is the observed cue.
    for(const y of [.8,1.35,1.9]){
      faceBox('anchors',f,'#c5b79a',f.width*.53,y,f.width*.6,.055,.035,.50);
      for(let i=0;i<5;i++){
        const t=f.width*(.29+i*.11),colour=['#bca36b','#a36552','#829ba0','#d0c8ad','#6e8871'][i];
        faceBox('anchors',f,colour,t,y+.17,.23,.27,.025,.51);
        faceBox('anchors',f,'#e1dac8',t,y+.22,.2,.07,.015,.53);
      }
    }
    for(const y of [.5,2.43])faceBox('anchors',f,anchor.trim,f.width*.53,y,f.width*.67,.09,.09,.52);
  }
  if(anchor.awning){
    if(!eland){
    faceBox('anchors',f,anchor.colour,f.width/2,2.94,w,.12,1.1,.67);
    faceBox('anchors',f,anchor.colour,f.width/2,2.8,w,.23,.09,1.23);
    }else{
    const colour=anchor.awningColour||anchor.colour,sections=anchor.awningSections||1;
    for(let i=0;i<sections;i++){
      const aw=w/sections-.08,t=(f.width-w)/2+(i+.5)*w/sections;
      // Sloped fabric plane and a hanging valance; reusable across shop types.
      meshTriangles('anchors',ringsTriangles([[onFace(f,t-aw/2,3.03,.45),onFace(f,t+aw/2,3.03,.45),onFace(f,t+aw/2,2.68,1.6),onFace(f,t-aw/2,2.68,1.6)]]),material(colour));
      faceBox('anchors',f,colour,t,2.58,aw,.2,.07,1.6);
    }
    }
  }
  if(anchor.terrace){
    for(const t of [f.width*.32,f.width*.70]){
      const p=onFace(f,t,.78,1.18);box('anchors','#a58a60',p,[.64,.075,.58],f.yaw);box('anchors','#555b49',[p[0],.4,p[2]],[.07,.78,.07]);
      for(const offset of [-.6,.6]){const q=onFace(f,t+offset,.43,1.1);box('anchors','#57624b',q,[.4,.06,.42],f.yaw);box('anchors','#57624b',[q[0],.62,q[2]+.19],[.4,.42,.05],f.yaw);}
    }
  }
  if(anchor.id==='scooter')for(let i=0;i<3;i++){
    const p=onFace(f,f.width*.24+i*1.1,.45,1.5);box('anchors','#a9afa0',p,[.5,.48,1.15],f.yaw);box('anchors','#34463d',[p[0],.77,p[2]],[.43,.13,.57],f.yaw);
  }
  anchor.face=f;
  anchor.labelPosition=onFace(f,f.width/2,5.0,1);
}
function makeAnchors(){for(const a of data.anchors){
  a.renderedFrontages=[];
  for(const segment of a.frontages||[{buildingId:a.buildingId,position:a.position}]){
    const faces=facadeFaces.get(segment.buildingId)||[];
    const ranked=faces.filter(f=>(a.kind==='institution'?f.n[1]>.65&&f.mid[1]>-125:f.publicFace)&&f.bottom<2&&f.width>2.5).sort((f,g)=>{
      const score=h=>{
        if(a.kind==='institution')return h.width;
        if(a.street==='De Clercqstraat')return h.n[1]*(a.id==='sterk'?-8:8)+h.width*.1;
        if(a.street==='Elandsgracht')return h.n[1]*(a.number%2?-12:12)-Math.hypot(h.mid[0]-segment.position[0],h.mid[1]-segment.position[1])*.1;
        const reference=data.references.find(r=>r.name===a.view)?.positionLocal||a.position;
        const dx=reference[0]-h.mid[0],dz=reference[1]-h.mid[1],dist=Math.hypot(dx,dz)||1;
        return(h.n[0]*dx+h.n[1]*dz)/dist*10-dist*.03;
      };
      return score(g)-score(f);
    });
    if(!ranked[0])throw new Error(`No street-facing wall for ${a.id}/${segment.buildingId}`);
    let f=ranked[0];
    if(a.kind==='institution'){
      a.face=f;a.labelPosition=onFace(f,f.width/2,17,1);
    }else{
      // Limit a small shop to an interval inside a wide BAG building.
      const width=Math.min(f.width,a.width|| (eland?10:Infinity));
      if(width<f.width){const projected=(segment.position[0]-f.a[0])*f.u[0]+(segment.position[1]-f.a[1])*f.u[1],start=Math.max(0,Math.min(f.width-width,projected-width/2));f={...f,a:[f.a[0]+f.u[0]*start,f.a[1]+f.u[1]*start],mid:[f.a[0]+f.u[0]*(start+width/2),f.a[1]+f.u[1]*(start+width/2)],width};}
      addSign(f,a);
    }
    a.renderedFrontages.push({buildingId:segment.buildingId,face:f});
  }
}}
function label(text,pos,type='street',id){const el=document.createElement(id?'button':'span');el.className=`map-label ${type}`;el.innerHTML=id?`<i></i>${escapeHtml(text)}`:escapeHtml(text);$('#labels').append(el);if(id)el.onclick=()=>selectBuilding(data.anchors.find(a=>a.id===id).buildingId);labelEntries.push({el,pos:new THREE.Vector3(...pos),type,id});}
function makeLabels(){
  if(eland){label('Elandsgracht',[0,1,0]);for(const a of data.anchors)label(a.name,a.labelPosition,'anchor',a.id);return;}
  label('Da Costagracht',[-64,1,16],'water');label('Hugo de Grootgracht',[12,1,-108],'water');label('Singelgracht',[93,1,-16],'water');
  label('De Clercqstraat',[-28,.8,82]);label('Nassaukade',[46,.8,-18]);label('Da Costakade',[-33,.8,-14]);
  for(const a of data.anchors)label(a.name,a.labelPosition,'anchor',a.id);
}
const views=eland?{
  overview:{target:[0,0,0],radius:540,theta:.25,phi:.62,label:'ELANDSGRACHT'},
  engels:{target:[-84,4,61],radius:20,theta:-2.65,phi:1.66,fov:55,label:'ENGELS VERF',title:'One shop across 93–97',text:'Rainbow stripes and white lettering repeat across Elandsgracht 93–97.',photo:'engels'},
  coffee:{target:[-8,4,21],radius:20,theta:-2.65,phi:1.66,fov:55,label:'THE CENTRAL SHOPS',title:'Two dark shopfronts',text:'Koffiespot and Baskèts have different lettering and display widths within the same restrained palette.',photo:'eland-middle'},
  antiek:{target:[-124.5,4,82.5],radius:20,theta:-2.65,phi:1.66,fov:55,label:'ANTIEKCENTRUM',title:'A burgundy entrance',text:'Pale lettering and a broad burgundy shop base stand out at the western end.',photo:'front-113'},
  awnings:{target:[-91,4,32],radius:38,theta:1.7,phi:1.4,label:'THE AWNING ROW',title:'Colour at street level',text:'Green butcher awnings and a dark bakery canopy make breaks in the brick-and-pale-trim row.',photo:'front-122'},
  west:{target:[-146,4,63],radius:22,theta:.5,phi:1.65,fov:55,label:'THE WESTERN END',title:'The street mouth',text:'A taupe canopy and a grey-painted corner building mark the western street mouth.',photo:'eland-west'},
  east:{target:[36,4,-34],radius:23,theta:.5,phi:1.65,fov:55,label:'THE EASTERN ROW',title:'Small shops, different bases',text:'Dark and blue awnings, broad glazing and narrow house fronts continue toward Prinsengracht.',photo:'front-64'},
}: {
  overview:{target:[0,0,-7],radius:340,theta:.62,phi:.72,label:'THE WHOLE BLOCK'},
  canal:{target:[-13,6,-7],radius:75,theta:-1.7,phi:1.31,label:'DA COSTAKADE',title:'The quiet quay',text:'Brick paving, residential entrances, balconies and a narrow canal. The tree row belongs to this side of the street.',photo:'da-costa-2023'},
  shops:{target:[-20,7,63],radius:42,theta:-.65,phi:1.3,label:'DE CLERCQSTRAAT',title:'The everyday landmarks',text:'A red awning, a scooter shop and a café on the corner. Small details give the commercial frontage its rhythm.',photo:'shopping'},
  nassau:{target:[15,7,-12],radius:90,theta:1.58,phi:1.27,label:'NASSAUKADE',title:'The broad quay',text:'Pale window frames and projecting balconies meet a wider road and the open water of the Singelgracht.',photo:'nassau'},
  amsta:{target:[1,13,-109],radius:92,theta:.28,phi:1.22,label:'AMSTA · DE POORT',title:'A different kind of building',text:'Long bands of glazing, pale frames and ochre panels give the care building its own rhythm across the canal.',photo:'amsta'},
  north:{target:[44,8.5,-61],radius:46,theta:.8,phi:1.25,label:'THE NORTHERN CORNER',title:'A corner worth remembering',text:'The pale Groot Amsterdam frontage sits at the turn beside Hugo de Grootgracht.',photo:'north'},
};
function setView(name,animate=true){
  const v=views[name];if(!v)return;
  camera.fov=v.fov||38;camera.updateProjectionMatrix();
  state.view=name;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));$('#view-label').textContent=v.label;
  $('#view-note').hidden=!v.text;
  if(v.text){$('#view-note').innerHTML=`<strong>${v.title}</strong><br>${v.text}<br><button id="view-photo">See the real street ↗</button>`;$('#view-photo').onclick=()=>showPhoto(v.photo);}
  const to={target:new THREE.Vector3(...v.target),radius:v.radius*Math.max(1,(name==='overview'?1.12:.8)/camera.aspect),theta:v.theta,phi:v.phi};
  if(animate&&!reducedMotion)transition={start:performance.now(),from:{...orbit,target:orbit.target.clone()},to};
  else{Object.assign(orbit,to);transition=null;}
}
function showPhoto(name){const r=data.references.find(v=>v.name===name);if(!r)return;$('#photo-title').textContent=r.label;$('#photo').src=r.url;$('#photo-original').href=r.url;$('#photo-caption').textContent=`© Gemeente Amsterdam · ${r.timestamp.slice(0,10)} · Full 360° reference; image orientation is not registered to the model. Captures from 2025 report zero heading/height and are used only for visual reference.`;$('#photo-dialog').showModal();}
function selectBuilding(id){
  const b=data.buildings.find(b=>b.id===id);if(!b)return;state.selected=id;
  if(selectedOutline){scene.remove(selectedOutline);selectedOutline.geometry.dispose();selectedOutline.material.dispose();}
  const pts=[];for(const p of b.footprint.coordinates)for(let i=0;i<p[0].length-1;i++){const a=p[0][i],c=p[0][i+1];pts.push(a[0],.35,a[1],c[0],.35,c[1]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));selectedOutline=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#ce8547',depthTest:false}));selectedOutline.renderOrder=20;scene.add(selectedOutline);
  const anchor=data.anchors.find(a=>a.frontages?.some(f=>f.buildingId===id)||a.buildingId===id);
  $('#selection').hidden=false;
  $('#selection-body').innerHTML=`<div class="eyebrow">${anchor?.kind==='institution'?'INSTITUTIONAL BUILDING':anchor?'EVERYDAY LANDMARK':b.focus?'INSIDE THE BLOCK':'NEIGHBOURING CONTEXT'}</div><h2>${escapeHtml(anchor?.name||b.addresses[0]||'Courtyard building')}</h2>${anchor?`<p>${escapeHtml(anchor.description)}</p>`:''}<div class="meta">${escapeHtml(anchor?`${anchor.street} ${anchor.number}`:b.addresses.join(' · ')||'BAG building')}<br>Built ${b.year} · ${b.height.toFixed(1)} m<br>${b.heightSource}<br>${escapeHtml(b.family.replaceAll('-',' '))} · approximate façade</div>${anchor?`<p>${escapeHtml(anchor.evidence)}</p><button class="photo-button" id="anchor-photo">View street reference ↗</button><p>${anchor.sources.map((s,i)=>`<a href="${escapeHtml(s)}" target="_blank" rel="noopener">Source ${i+1} ↗</a>`).join(' · ')}</p>`:'<p>Footprint, year and roof geometry come from the registers. Window spacing, balcony rhythm and material palette are authored approximations.</p>'}`;
  if(anchor)$('#anchor-photo').onclick=()=>showPhoto(anchor.view);
  const evidence=neighbourhood?.records.filter(r=>r.renderBuildingId===id)||[];
  if(evidence.length){
    $('#selection-body').insertAdjacentHTML('beforeend',`<div class="neighbourhood-evidence"><h3>Street evidence</h3>${evidence.map(r=>{
      const placement={accepted:'Placement reviewed',rejected:'Placement rejected · appearance not applied',uncertain:'Placement uncertain · appearance not applied','crop-repair':'Building confirmed · crop needs repair; appearance not applied'}[r.review?.placement]||'Suggested appearance · unreviewed';
      const oracle=r.roofOracleProposal,shape=oracle?.roofShape||oracle?.shape,gpt=r.roofGptProposal;
      const reviewedLabels=r.review?.placement==='accepted'?`<br>Reviewed labels: roof ${escapeHtml(r.effectiveProposal?.roofShape||r.review.roofShape||'unknown')}; facade top ${escapeHtml(r.effectiveProposal?.facadeTop||r.review.facadeTop||'unknown')}.`:'';
      let visualLabels=r.visualReview?`<br>Direct source-image review (${escapeHtml(r.visualReview.cropQuality)} crop): ${escapeHtml(r.visualReview.evidence)}<br>Current roof proposal: ${escapeHtml(r.effectiveProposal?.roofShape||'unknown')}; facade top: ${escapeHtml(r.effectiveProposal?.facadeTop||'unknown')}. Machine proposals, not human labels.`:'';
      if(r.roofAssessment)visualLabels+=`<br>${escapeHtml(r.roofAssessment.summary)}`;
      if(r.awningEvidence)visualLabels+=`<br>${escapeHtml(awningEvidenceSummary(r))}`;
      return `<p>${escapeHtml(placement)}${r.agentReview?.suppressAppearance?'<br>Appearance withheld after agent image review':r.agentReview?.needsReview?'<br>Agent image review flagged this frontage':''}${visualLabels}<br>Roof geometry hypothesis: ${escapeHtml(r.roofEvidence.shape)}<br>Street-image hypothesis: ${escapeHtml(r.proposal?.roofShape||'unknown')}${shape?`<br>Focused roof-image hypothesis: ${escapeHtml(shape)}${oracle.evidence?`<br><small>${escapeHtml(oracle.evidence)}</small>`:''}`:''}${gpt?.roofShape?`<br>GPT alternative hypothesis: ${escapeHtml(gpt.roofShape)}${gpt.evidence?`<br><small>${escapeHtml(gpt.evidence)}</small>`:''}`:''}${r.roofOracleConflict?'<br>Roof interpretations disagree across views; review needed.':''}<br>Roof mesh unchanged.${reviewedLabels}<br>Shopfront: ${escapeHtml(r.effectiveProposal?.shopfront||'unknown')}${r.effectiveProposal?.visibleSignText?`<br>Suggested sign reading: “${escapeHtml(r.effectiveProposal.visibleSignText)}”`:''}<br><a href="./neighbourhood-review.html#${encodeURIComponent(r.id)}">Inspect photos and correct ↗</a></p>`;
    }).join('')}</div>`);
  }
}
function updateLayers(){
  groups.facades.visible=state.facades;groups.street.visible=state.street;groups.anchors.visible=state.anchors;
  if($('#machine-sign-provenance'))$('#machine-sign-provenance').hidden=!state.anchors;
  for(const b of buildingMaterials){b.wallMat.color.set(state.facades?b.wallColour:'#c4c3b8');b.roofMat.color.set(state.facades?b.roofColour:'#aaa99f');const map=state.facades&&b.textured?brickMap():null;if(b.wallMat.map!==map){b.wallMat.map=map;b.wallMat.needsUpdate=true;}}
  for(const s of surfaceMaterials)s.m.color.set(state.street?s.colour:'#c5c3b5');
  for(const name of ['street','anchors','facades'])$(`#${name}`).checked=state[name];
  const plain=!state.street&&!state.anchors&&!state.facades;$('#compare').setAttribute('aria-pressed',String(plain));$('#compare').innerHTML=plain?'Restore the street details <span>⇄</span>':'Compare with plain buildings <span>⇄</span>';
}
function frame(time){
  if(transition){const t=Math.min(1,(time-transition.start)/1000),e=t*t*(3-2*t);for(const k of ['radius','theta','phi'])orbit[k]=THREE.MathUtils.lerp(transition.from[k],transition.to[k],e);orbit.target.lerpVectors(transition.from.target,transition.to.target,e);if(t===1)transition=null;}
  camera.position.set(orbit.target.x+orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta),Math.max(1.2,orbit.target.y+orbit.radius*Math.cos(orbit.phi)),orbit.target.z+orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta));camera.lookAt(orbit.target);camera.updateMatrixWorld();
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const occupied=[];
  for(const l of labelEntries){
    const p=l.pos.clone().project(camera),x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
    let visible=p.z>-1&&p.z<1&&Math.abs(p.x)<.92&&Math.abs(p.y)<.88&&(l.type!=='anchor'||state.anchors)&&(state.view==='overview'||l.type==='anchor');
    if(l.type==='anchor'&&visible){
      const a=data.anchors.find(a=>a.id===l.id),dot=(camera.position.x-a.face.mid[0])*a.face.n[0]+(camera.position.z-a.face.mid[1])*a.face.n[1];
      if(dot<0)visible=false;
      if(state.view!=='overview'&&l.pos.distanceTo(orbit.target)>55)visible=false;
      const width=l.el.textContent.length*6.1+22,rect={x:x-width/2,y:y-13,w:width,h:26};
      if(occupied.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y))visible=false;
      if(visible)occupied.push(rect);
    }
    l.el.hidden=!visible;if(visible){l.el.style.left=`${x}px`;l.el.style.top=`${y}px`;}
  }
  $('.north').style.transform=`rotate(${-orbit.theta*180/Math.PI}deg)`;
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
function resize(){const r=stage.getBoundingClientRect();if(r.width<=0||r.height<=0)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;if(frontageFrameRecord&&state.view==='frontage'){
  const framing=frontageFraming(frontageFrameRecord,camera.aspect,orbit.radius);camera.fov=framing.fov;$('#view-note').hidden=framing.wholeFacadeFits;
  if(!framing.wholeFacadeFits)$('#view-note').textContent='Close frontage view: the whole facade cannot fit from this unobstructed street position. Drag to inspect its edges.';
}camera.updateProjectionMatrix();}
const pointers=new Map();let dragged=false,lastPointer=null,pinchDistance=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);lastPointer=[e.clientX,e.clientY];dragged=false;transition=null;});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const old=pointers.get(e.pointerId),dx=e.clientX-old[0],dy=e.clientY-old[1];pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(Math.abs(e.clientX-lastPointer[0])+Math.abs(e.clientY-lastPointer[1])>4)dragged=true;
  if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinchDistance)orbit.radius=THREE.MathUtils.clamp(orbit.radius*pinchDistance/d,state.view==='frontage'?.8:18,900);pinchDistance=d;return;}
  if(e.buttons===2||e.shiftKey){const speed=orbit.radius*.0015;orbit.target.x-=Math.cos(orbit.theta)*dx*speed;orbit.target.z+=Math.sin(orbit.theta)*dx*speed;orbit.target.x+=Math.sin(orbit.theta)*dy*speed;orbit.target.z+=Math.cos(orbit.theta)*dy*speed;}
  else{orbit.theta-=dx*.006;orbit.phi=THREE.MathUtils.clamp(orbit.phi+dy*.005,.18,1.7);}
});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);pinchDistance=null;if(!dragged&&e.button===0&&state.ready){const r=canvas.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(buildingMeshes,false)[0];if(hit)selectBuilding(hit.object.userData.owners[hit.faceIndex]);}});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pinchDistance=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();transition=null;orbit.radius=THREE.MathUtils.clamp(orbit.radius*Math.exp(e.deltaY*.001),state.view==='frontage'?.8:18,900);},{passive:false});
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')orbit.theta-=.08;else if(e.key==='ArrowRight')orbit.theta+=.08;else if(e.key==='ArrowUp')orbit.radius=Math.max(state.view==='frontage'?.8:18,orbit.radius*.92);else if(e.key==='ArrowDown')orbit.radius=Math.min(900,orbit.radius*1.08);else return;e.preventDefault();transition=null;});
for(const name of ['street','anchors','facades'])$(`#${name}`).onchange=e=>{state[name]=e.target.checked;updateLayers();};
let comparisonState=null;
$('#compare').onclick=()=>{if(!state.street&&!state.anchors&&!state.facades){Object.assign(state,comparisonState||{street:true,anchors:true,facades:true});comparisonState=null;}else{comparisonState={street:state.street,anchors:state.anchors,facades:state.facades};Object.assign(state,{street:false,anchors:false,facades:false});}updateLayers();};
if(eland){
  document.title='Elandsgracht storefronts · Canal Recall';
  $('.sidebar > .eyebrow').textContent='ELANDSGRACHT / JORDAAN';
  $('h1').innerHTML='A street <br>of shopfronts<span>.</span>';
  $('.intro').textContent='Rainbow paint-shop signs, projecting awnings and a long street of everyday places.';
  $('.edition').textContent='AMSTERDAM · FIELD STUDY 02';
  $('.places-title').textContent='WALK THE SHOPPING STREET';
  $('#places').innerHTML=Object.entries(views).map(([id,v],i)=>`<button data-view="${id}"><span>${i||'↗'}</span> ${({overview:'The whole street',engels:'Engels Verf',awnings:'The awning row',west:'The western end',east:'The eastern row',coffee:'The central shops',antiek:'Antiekcentrum'})[id]}</button>`).join('');
  $('.stage').setAttribute('aria-label','Interactive 3D study of Elandsgracht storefronts');
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#reset').onclick=()=>setView('overview');
$('#selection-close').onclick=()=>{$('#selection').hidden=true;state.selected=null;if(selectedOutline){scene.remove(selectedOutline);selectedOutline.geometry.dispose();selectedOutline.material.dispose();selectedOutline=null;}};
$('#sources-open').onclick=()=>$('#sources-dialog').showModal();
document.querySelectorAll('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
new ResizeObserver(resize).observe(stage);
try{
  const response=await fetch(eland?'../data/elandsgracht/block.json':'../data/da-costa-block/block.json');if(!response.ok)throw new Error(`Block data: HTTP ${response.status}`);data=await response.json();
  if(neighbourhoodMode){
    const r=await fetch('../data/da-costa-block/neighbourhood.json');if(!r.ok)throw Error('Neighbourhood evidence is not compiled');neighbourhood=await r.json();
    data.displayExtent=neighbourhoodDisplayBounds(data.bounds,neighbourhood.records);data.bounds=data.displayExtent.bounds;
    $('.intro').textContent=`${neighbourhood.stats.frontages} photographed frontages around Da Costakade. Suggested materials and shopfronts, with reconstructed roofs.`;
    if(inventoryTreeMode){const note=document.createElement('small');note.id='tree-provenance';note.textContent='Trees: inventory positions and height classes; loose species/cultivar crown priors, not measured crowns.';note.style.cssText='display:block;margin-top:9px;line-height:1.5';$('.intro').append(note);}
    $('.study-links').insertAdjacentHTML('afterbegin','<a href="./neighbourhood-review.html">Review street and roof evidence ↗</a><br><a href="./da-costa-block.html">Compare original study ↗</a><br>');
  }
  // Clip neighbouring geometry at the exact extent of the miniature's plinth.
  const[x0,z0,x1,z1]=data.bounds;renderer.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-x0),new THREE.Plane(new THREE.Vector3(-1,0,0),x1),new THREE.Plane(new THREE.Vector3(0,0,1),-z0),new THREE.Plane(new THREE.Vector3(0,0,-1),z1)];
  ground();makeBuildings();makeAnchors();makeMachineSigns();flushTriangles();flushInstances();makeLabels();updateLayers();resize();setView(new URLSearchParams(location.search).get('view') in views?new URLSearchParams(location.search).get('view'):'overview',false);
  $('#source-stats').innerHTML=`<span><b>${data.stats.focusBuildings}</b>${eland?'buildings on Elandsgracht':'buildings in the block'}</span><span><b>${data.stats.measuredBuildings}</b>3DBAG buildings incl. context</span><span><b>${data.stats.trees}</b>tree records</span>`;
  $('#source-list').innerHTML=data.sources.map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.name)} ↗<small>${escapeHtml(s.license)}</small></a>`).join('');
  $('#loading').style.display='none';state.ready=true;
  window.daCostaDemo={status:()=>({...state,stats:data.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,anchorFaces:data.anchors.flatMap(a=>a.renderedFrontages.map(f=>({id:a.id,buildingId:f.buildingId,mid:f.face.mid,normal:f.face.n,width:f.face.width}))),camera:camera.position.toArray()}),view:name=>setView(name,false),select:selectBuilding,data:()=>data,shadows:enabled=>{renderer.shadowMap.enabled=enabled;}};
  window.daCostaDemo.materials=()=>buildingMaterials.map(b=>({id:b.wallMat.id,colour:b.wallColour,brick:b.textured,hasTexture:!!b.wallMat.map,renderColour:'#'+b.wallMat.color.getHexString()}));
  window.daCostaDemo.machineSigns=()=>({enabled:machineSignMode,visible:machineSignMode&&state.anchors,previews:machineSignPreviews,skipped:machineSignSkips});
  window.daCostaDemo.wallPatches=()=>wallPatches;
  window.daCostaDemo.openingLayouts=()=>openingLayouts;
  window.daCostaDemo.frontageFraming=()=>({recordId:frontageFrameRecord?.id,aspect:camera.aspect,radius:orbit.radius,fov:camera.fov});
  if(neighbourhoodMode){
    window.daCostaDemo.evidence=()=>neighbourhood;const selected=new URLSearchParams(location.search).get('building');if(selected)selectBuilding(selected);
    const frontage=neighbourhood.records.find(r=>r.id===new URLSearchParams(location.search).get('frontage'));
    if(frontage){
      const plan=planFrontageCamera(frontage,data.buildings,camera.aspect);window.daCostaDemo.initialFrontageCamera=()=>plan;
      if(plan.usable){
        frontageFrameRecord=frontage;
        orbit.target.set(...plan.target);orbit.radius=plan.radius;orbit.theta=plan.theta;orbit.phi=plan.phi;
        camera.fov=plan.fov;camera.updateProjectionMatrix();state.view='frontage';$('#view-label').textContent=frontage.address;
        document.querySelectorAll('[data-view]').forEach(el=>el.classList.remove('active'));
        $('#view-note').hidden=plan.wholeFacadeFits;
        if(!plan.wholeFacadeFits)$('#view-note').textContent='Close frontage view: the whole facade cannot fit from this unobstructed street position. Drag to inspect its edges.';
      }else{$('#view-note').hidden=false;$('#view-note').textContent='No clear initial street camera was found for this wall. The overview is retained; inspect the source photos for placement.';}
    }
  }
  requestAnimationFrame(frame);
}catch(error){$('#loading').textContent=`The block could not load: ${error.message}`;console.error(error);}
