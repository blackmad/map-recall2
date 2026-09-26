/** Source-derived street context for a published appearance area. Geometry is illustrative in height only. */
// @ts-expect-error Three runtime is installed without its separate declaration package.
import * as THREE from 'three';
// @ts-expect-error Shared inventory typology is a browser JS module.
import { treeTypology } from '../../public/canal-drive/da-costa-block/tree-typology.js';
import { triangulateAppearanceSurface } from './cityAppearanceThree.js';

export function createAppearanceContext(data: any,options:{includeBase?:boolean}={}) {
  if (!Array.isArray(data.bounds)||data.bounds.length!==4||!data.bounds.every(Number.isFinite))throw Error('Missing area display bounds');
  const group=new THREE.Group(),materials=new Map<string,any>(),batches=new Map<string,number[]>();
  const mat=(colour:string)=>{if(!materials.has(colour))materials.set(colour,colour==='#709d98'
    ?new THREE.MeshPhysicalMaterial({color:colour,roughness:.24,metalness:.04,clearcoat:.72,clearcoatRoughness:.2,side:THREE.DoubleSide})
    :new THREE.MeshStandardMaterial({color:colour,roughness:.95,side:THREE.DoubleSide}));return materials.get(colour);};
  const add=(colour:string,triangles:number[])=>{const bucket=batches.get(colour)||[];for(const v of triangles)bucket.push(v);batches.set(colour,bucket);};
  const polygon=(feature:any,y:number,colour:string)=>{
    const g=feature.geometry;if(!g||!['MultiPolygon','Polygon'].includes(g.type))return;
    for(const p of g.type==='Polygon'?[g.coordinates]:g.coordinates)add(colour,triangulateAppearanceSurface(p.map((r:number[][])=>r.map(q=>[q[0],y,q[1]]))));
  };
  let bridges=0,boundaries=0;
  const boundary=(feature:any)=>{const geometry=feature.geometry;if(!geometry||!['LineString','MultiLineString'].includes(geometry.type))return;boundaries++;const lines=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;for(const line of lines)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];add('#817a6b',[a[0],.02,a[1],b[0],.02,b[1],b[0],.55,b[1],a[0],.02,a[1],b[0],.55,b[1],a[0],.55,a[1]]);}};
  const bridge=(feature:any)=>{const g=feature.geometry;if(!g||!['MultiPolygon','Polygon'].includes(g.type))return;bridges++;for(const p of g.type==='Polygon'?[g.coordinates]:g.coordinates){add('#bcbdb0',triangulateAppearanceSurface(p.map((r:number[][])=>r.map(q=>[q[0],.12,q[1]]))));for(const ring of p)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];add('#8f9188',[a[0],.12,a[1],b[0],.12,b[1],b[0],-.18,b[1],a[0],.12,a[1],b[0],-.18,b[1],a[0],-.18,a[1]]);}}};
  const [x0,z0,x1,z1]=data.bounds;
  if(options.includeBase!==false)add('#d5d4c6',triangulateAppearanceSurface([[[x0,-.6,z0],[x0,-.6,z1],[x1,-.6,z1],[x1,-.6,z0]]]));
  for(const f of data.layers?.onbegroeidterreindeel||[])polygon(f,-.35,f.kind==='erf'?'#c4c7b1':'#d5d3c2');
  for(const f of data.layers?.begroeidterreindeel||[])polygon(f,-.25,'#a5b68d');
  for(const f of data.layers?.waterdeel||[])polygon(f,-.2,'#709d98');
  for(const f of data.layers?.overbruggingsdeel||[])bridge(f);
  for(const f of data.layers?.scheiding_lijn||[])if(['kademuur','walbescherming'].includes(f.kind))boundary(f);
  for(const f of [...(data.layers?.ondersteunendwegdeel||[]),...(data.layers?.wegdeel||[])]){
    const foot=/voet/.test(f.kind),cycle=f.kind==='fietspad';
    polygon(f,foot?.14:.06,foot?'#d1cbbb':cycle?'#aa7c66':f.surface==='open verharding'?'#ab9780':'#9a9f95');
  }
  for(const [colour,positions]of batches){if(!positions.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,mat(colour));mesh.receiveShadow=true;group.add(mesh);}
  const trunks:any[]=[],crowns:any[][]=[[],[],[]],dummy=new THREE.Object3D();let trees=0;
  for(const tree of data.trees||[]){
    const t=treeTypology(tree);if(!t)continue;trees++;
    trunks.push({position:[t.position[0],t.trunkHeight/2+.1,t.position[1]],scale:[t.trunkWidth,t.trunkHeight,t.trunkWidth]});
    for(const lobe of t.lobes)crowns[lobe.tone].push({position:[t.position[0]+lobe.offset[0],lobe.offset[1]+.1,t.position[1]+lobe.offset[2]],scale:lobe.scale});
  }
  function instances(items:any[],geometry:any,colour:string){if(!items.length){geometry.dispose();return;}const mesh=new THREE.InstancedMesh(geometry,mat(colour),items.length);items.forEach((item,i)=>{dummy.position.set(...item.position);dummy.scale.set(...item.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;group.add(mesh);}
  instances(trunks,new THREE.CylinderGeometry(.5,.5,1,6),'#827c61');
  for(let i=0;i<3;i++)instances(crowns[i],new THREE.IcosahedronGeometry(1,1),['#9dab78','#acb989','#899b68'][i]);
  let disposed=false;
  return {group,stats:{trees,bridges,boundaries,meshes:group.children.length},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const child of [...group.children]){if(child.isInstancedMesh)child.dispose();child.geometry.dispose();group.remove(child);}for(const m of materials.values())m.dispose();materials.clear();}};
}
