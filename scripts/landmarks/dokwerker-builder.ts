import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './dokwerker-source.json';

/** Original faceted silhouette: reference pose, no photographic/model pixels. */
export function buildDokwerker(_w:number,_d:number,b:BuildingTools){
  const stone=source.pedestalMetres;
  b.box(0,0,0,stone.width,stone.height,stone.depth,'stone');
  b.box(0,stone.height,0,1.12,.075,1.04,'dark');
  const floor=stone.height;
  // Feet apart, sturdy trousers and a loose work shirt. Body components are
  // approximate sculptural divisions within the documented2.60m statue height.
  function ellipsoid(x:number,y:number,z:number,w:number,h:number,d:number){const g=new T.IcosahedronGeometry(1,1);g.scale(w/2,h/2,d/2);b.add(g,'bronze',x,floor+y,z);}
  function limb(a:number[],z:number[],r1:number,r2:number){const from=new T.Vector3(a[0],floor+a[1],a[2]),to=new T.Vector3(z[0],floor+z[1],z[2]),v=to.clone().sub(from),g=new T.CylinderGeometry(r2,r1,v.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));const c=from.add(to).multiplyScalar(.5);b.add(g,'bronze',c.x,c.y,c.z);}
  for(const s of [-1,1]){
    ellipsoid(s*.265,.10,.08,.29,.20,.53);
    limb([s*.255,.20,0],[s*.19,1.13,-.02],.15,.21);
    ellipsoid(s*.23,.49,0,.29,.76,.32);
  }
  ellipsoid(0,1.21,0,.78,.43,.49);
  ellipsoid(0,1.63,-.015,.98,.87,.59);
  ellipsoid(0,1.82,-.03,1.10,.44,.53);
  for(const s of [-1,1]){
    limb([s*.47,1.91,-.015],[s*.62,1.51,.065],.21,.17);
    limb([s*.62,1.51,.065],[s*.75,1.25,.24],.155,.105);
    ellipsoid(s*.75,1.23,.25,.20,.22,.22);
    ellipsoid(s*.70,1.30,.34,.09,.09,.10);
  }
  limb([0,1.98,0],[0,2.20,.015],.15,.13);
  ellipsoid(0,2.31,.025,.36,.43,.35);
  ellipsoid(0,2.28,.20,.09,.13,.095); // blunt nose, no painted facial texture
  // Low worker's cap, projecting brim and shirt collar.
  const cap=new T.CylinderGeometry(.17,.19,.075,10);b.add(cap,'bronze',0,floor+2.5625,.015);
  b.box(0,floor+2.51,.16,.30,.035,.20,'bronze');
  for(const s of [-1,1])b.box(s*.10,floor+1.975,.24,.14,.095,.075,'bronze',s*.4);
}
