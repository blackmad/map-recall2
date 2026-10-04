import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './park-pavilion-specs.json';
import sources from './park-pavilion-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];

/** Open cast-iron pavilion; its island and bridge remain existing park geometry. */
export function buildParkPavilionLandmark(id: string, _w: number, _d: number, b: BuildingTools) {
  if (id !== 'vondelpark-bandstand') throw new Error(`No park pavilion builder for ${id}`);
  const {add, box} = b, s = specs[0], a = s.surveyed.anchor;
  const h = (90 + s.surveyed.northOffsetDegrees) * Math.PI / 180;
  const outline = sources[0].parts[0].polygons[0][0].slice(0,-1).map(([lng,lat]) => {
    const east = (lng-a[0])*111320*Math.cos(a[1]*Math.PI/180), north = (lat-a[1])*110540;
    return new T.Vector2(east*Math.sin(h)+north*Math.cos(h),east*Math.cos(h)-north*Math.sin(h));
  });
  const beam = (p: number[], q: number[], radius: number, colour: Colour) => {
    const start = new T.Vector3(...p), end = new T.Vector3(...q), delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius,radius,delta.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));
    const mid = start.add(end).multiplyScalar(.5); add(g,colour,mid.x,mid.y,mid.z);
  };
  const cylinder = (radius: number, y: number, height: number, colour: Colour, x=0, z=0, segments=10) =>
    add(new T.CylinderGeometry(radius,radius,height,segments),colour,x,y+height/2,z,Math.PI/10);
  const floorHeight = 1.48, roofEaves = 6.10, roofPeak = 7.02;
  // Render the raised plastered basement only; the space above it is genuinely open.
  cylinder(3.72,0,floorHeight,'white'); cylinder(3.87,floorHeight,.12,'stone');
  cylinder(3.75,0,.17,'stone');
  const cols = Array.from({length:10},(_,i) => {
    const angle = (18+i*36)*Math.PI/180;
    return {x:Math.sin(angle)*3.67,z:Math.cos(angle)*3.67};
  });
  for (const p of cols) {
    box(p.x,floorHeight,p.z,.40,.19,.40,'dark');
    cylinder(.21,1.67,.42,'dark',p.x,p.z,8); cylinder(.26,2.09,.12,'frame',p.x,p.z,10);
    add(new T.CylinderGeometry(.12,.165,3.19,12),'dark',p.x,3.805,p.z);
    for(let k=0;k<8;k++) {
      const theta=k*Math.PI/4;
      cylinder(.018,2.29,3.00,'frame',p.x+Math.sin(theta)*.141,p.z+Math.cos(theta)*.141,4);
    }
    cylinder(.195,5.35,.12,'frame',p.x,p.z); cylinder(.24,5.47,.13,'dark',p.x,p.z);
    box(p.x,5.60,p.z,.48,.15,.48,'dark');
    // Composite-capital leaves read as a few small corner volumes at game distance.
    for(const dx of [-.18,.18]) for(const dz of [-.18,.18])
      add(new T.ConeGeometry(.08,.22,4),'frame',p.x+dx,5.52,p.z+dz);
  }
  for(let i=0;i<10;i++) {
    const p=cols[i],q=cols[(i+1)%10],mid={x:(p.x+q.x)/2,z:(p.z+q.z)/2};
    const normal=Math.atan2(mid.x,mid.z);
    // Ornamental open segmental frieze under the eaves, without any filled wall.
    beam([p.x,5.78,p.z],[q.x,5.78,q.z],.075,'dark');
    beam([p.x,6.0,p.z],[q.x,6.0,q.z],.055,'dark');
    for(let j=0;j<8;j++) {
      const t=j/8,u=(j+1)/8;
      beam([p.x+(q.x-p.x)*t,5.77-.40*Math.sin(t*Math.PI),p.z+(q.z-p.z)*t],
        [p.x+(q.x-p.x)*u,5.77-.40*Math.sin(u*Math.PI),p.z+(q.z-p.z)*u],.04,'dark');
    }
    for(const t of [.18,.37,.63,.82]) {
      const x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;
      add(new T.TorusGeometry(.115,.021,4,8),'dark',x,5.80,z,normal);
    }
    if(i===9) continue; // The entrance bay aligns with the actual private bridge.
    beam([p.x,2.48,p.z],[q.x,2.48,q.z],.055,'dark');
    beam([p.x,1.71,p.z],[q.x,1.71,q.z],.038,'dark');
    for(let j=1;j<9;j++) {
      const t=j/9,x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;
      cylinder(.023,1.72,.76,'dark',x,z,4);
      if(j%2===0) add(new T.TorusGeometry(.115,.022,4,8),'dark',x,2.05,z,normal);
    }
  }
  // The exact mapped overhang is triangulated around a modest tent-roof peak.
  const vertices:number[]=[];
  for(let i=0;i<outline.length;i++) {
    const p=outline[i],q=outline[(i+1)%outline.length];
    vertices.push(q.x,roofEaves,q.y, 0,roofPeak,0, p.x,roofEaves,p.y);
    beam([p.x,6.03,p.y],[q.x,6.03,q.y],.105,'white');
    beam([0,5.94,0],[p.x,5.94,p.y],.042,'stone');
    // Dark scalloped edge below the white cornice is a low-poly version of the primary photo.
    for(let j=1;j<6;j++) {
      const t=j/6,x=p.x+(q.x-p.x)*t,z=p.y+(q.y-p.y)*t;
      const outward=Math.atan2((p.x+q.x)/2,(p.y+q.y)/2);
      const g=new T.CircleGeometry(.095,8);g.rotateY(outward);add(g,'dark',x,5.995,z);
    }
  }
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roof.computeVertexNormals();add(roof,'slate');
  const underside=new T.ShapeGeometry(new T.Shape(outline));underside.rotateX(Math.PI/2);add(underside,'white',0,5.95,0);
  // AHN roof max is7.78m above nearby ground; the thin finial can be undersampled.
  cylinder(.17,7.02,.14,'dark');
  const bulb=new T.SphereGeometry(.29,10,6);bulb.scale(1,1.25,1);add(bulb,'dark',0,7.45,0);
  add(new T.ConeGeometry(.14,.37,8),'dark',0,7.77,0); cylinder(.027,7.94,.06,'dark');
  // Nine measured-by-description stone treads, facing the existing bridge, with open iron handrails.
  for(let i=0;i<9;i++) {
    const y=i*floorHeight/9,z=6.48-i*.35;
    box(0,y,z,1.90,floorHeight/9,.38,'stone');
    for(const x of [-1.04,1.04]) cylinder(.028,y+.16,.90,'dark',x,z,6);
  }
  for(const x of [-1.04,1.04]) {
    beam([x,1.1,6.48],[x,2.40,3.68],.045,'dark');
    beam([x,.61,6.48],[x,1.91,3.68],.025,'dark');
  }
}
