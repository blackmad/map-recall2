import * as T from 'three';
/** Optional shared gallery material trials. Original asset fallback stays flat. */
export const canalhouseRoofMaterialPresets={
 'grey-ceramic':{source:'https://polyhaven.com/a/grey_roof_tiles',license:'CC0-1.0',widthM:3,colorUrl:'./textures/canalhouse/grey-ceramic-color.jpg',normalUrl:'./textures/canalhouse/grey-ceramic-normal.jpg',normalStrength:.18,roughness:.93,tint:'#cccccc'},
} as const;
export type CanalhouseRoofMaterialPreset=keyof typeof canalhouseRoofMaterialPresets;
/** Metre-scaled eave/down-slope coordinates, continuous across coplanar native
 * triangles and independent of their vertex winding or triangulation. */
export function canalhouseRoofUvs(geometry:T.BufferGeometry,widthM:number):T.BufferAttribute {
 if(!Number.isFinite(widthM)||widthM<=0)throw Error('Invalid roof texture scale');
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
 if(!n||geometry.index)throw Error('Roof UVs require nonindexed positions and normals');
 const uv:number[]=[];
 for(let i=0;i<p.count;i++){
  const normal=new T.Vector3().fromBufferAttribute(n,i);if(normal.y<0)normal.negate();
  let u=new T.Vector3(normal.z,0,-normal.x);if(u.lengthSq()<1e-10)u.set(1,0,0);u.normalize();
  const v=normal.clone().cross(u).normalize(),point=new T.Vector3().fromBufferAttribute(p,i);
  uv.push(point.dot(u)/widthM,point.dot(v)/widthM);
 }
 return new T.Float32BufferAttribute(uv,2);
}
const textureLoader=new T.TextureLoader(),cached=new Map<string,Promise<[T.Texture,T.Texture]>>();
export async function applyCanalhouseRoofMaterial(model:T.Object3D,preset:CanalhouseRoofMaterialPreset){
 const p=canalhouseRoofMaterialPresets[preset];if(!p)throw Error('Unknown roof material preset');
 let pending=cached.get(preset);
 if(!pending){pending=Promise.all([textureLoader.loadAsync(p.colorUrl),textureLoader.loadAsync(p.normalUrl)]);cached.set(preset,pending);pending.catch(()=>cached.delete(preset));}
 const [color,normal]=await pending;color.colorSpace=T.SRGBColorSpace;
 for(const t of [color,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;}
 model.traverse(o=>{if(!(o instanceof T.Mesh)||!o.geometry.getAttribute('uv'))return;
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.userData.canalhouseSurface==='roof'){
   m.map=color;m.normalMap=normal;m.normalScale.setScalar(p.normalStrength);m.roughness=p.roughness;m.color.set(p.tint);m.needsUpdate=true;
  }
 });
}
