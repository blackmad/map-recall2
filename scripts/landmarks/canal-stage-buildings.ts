import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './canal-stage-buildings-specs.json';
import sources from './canal-stage-buildings-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];

/** Original venue architecture on surveyed parents; no neighboring houses or park slab. */
export function buildCanalStageLandmark(id: string, _width: number, _depth: number, b: BuildingTools) {
  const {add, box, sign} = b;
  const spec = specs.find(s => s.id === id)!;
  const source = sources.find(s => s.id === id)!;
  const anchor = spec.surveyed.anchor;
  const heading = (90 + spec.surveyed.northOffsetDegrees) * Math.PI / 180;
  const rings = source.parts[0].polygons[0].map(r => r.map(([lng, lat]) => {
    const east = (lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180);
    const north = (lat - anchor[1]) * 110540;
    return new T.Vector2(east * Math.sin(heading) + north * Math.cos(heading), east * Math.cos(heading) - north * Math.sin(heading));
  }));
  const clip = (ring: T.Vector2[], axis: 'x' | 'y', value: number, greater: boolean) => {
    const out: T.Vector2[] = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const insideP = greater ? p[axis] >= value : p[axis] <= value;
      const insideQ = greater ? q[axis] >= value : q[axis] <= value;
      if (insideP) out.push(p.clone());
      if (insideP !== insideQ) out.push(p.clone().lerp(q, (value - p[axis]) / (q[axis] - p[axis])));
    }
    return out;
  };
  const region = (x0: number, x1: number, z0: number, z1: number) =>
    clip(clip(clip(clip(rings[0], 'x', x0, true), 'x', x1, false), 'y', z0, true), 'y', z1, false);
  const shape = (rs: T.Vector2[][]) => {
    const s = new T.Shape(rs[0]);
    for (const r of rs.slice(1)) s.holes.push(new T.Path(r));
    return s;
  };
  const body = (rs: T.Vector2[][], height: number, colour: Colour = 'brick') => {
    if (rs[0].length < 3) return;
    const g = new T.ExtrudeGeometry(shape(rs), {depth: height, bevelEnabled: false});
    g.rotateX(Math.PI / 2); g.translate(0, height, 0); add(g, colour);
  };
  const plane = (rs: T.Vector2[][], y: number, colour: Colour = 'slate') => {
    if (rs[0].length < 3) return;
    const g = new T.ShapeGeometry(shape(rs));
    g.rotateX(-Math.PI / 2); g.scale(1, 1, -1);
    const index = g.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
    }
    g.computeVertexNormals(); add(g, colour, 0, y, 0);
  };
  const roofZ = (x0: number, x1: number, z0: number, z1: number, y: number, rise: number) => {
    const mid = (x0 + x1) / 2, g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([
      x0,y,z0, x1,y,z0, x1,y,z1, x0,y,z1, mid,y+rise,z0, mid,y+rise,z1,
    ], 3));
    g.setIndex([0,3,5, 0,5,4, 1,4,5, 1,5,2, 0,4,1, 3,2,5]);
    g.computeVertexNormals(); add(g, 'slate');
  };
  const gable = (x: number, y: number, z: number, width: number, rise: number, colour: Colour = 'brick') => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-width/2,0,0, width/2,0,0, 0,rise,0], 3));
    g.computeVertexNormals(); add(g, colour, x, y, z);
  };
  const sash = (x: number, y: number, z: number, width: number, height: number, angle = 0) => {
    const dx = Math.sin(angle), dz = Math.cos(angle);
    box(x,y,z,width+.18,height+.18,.14,'white',angle);
    box(x+dx*.10,y+.09,z+dz*.10,width,height,.06,'glass',angle);
    box(x+dx*.15,y+.09,z+dz*.15,.055,height,.05,'frame',angle);
    box(x+dx*.15,y+height*.53,z+dz*.15,width,.055,.05,'frame',angle);
  };
  const arch = (x: number, y: number, z: number, width: number, height: number, colour: Colour, angle = 0) => {
    const r = width/2, sh = new T.Shape();
    sh.moveTo(-r,0); sh.lineTo(r,0); sh.lineTo(r,height-r); sh.absarc(0,height-r,r,0,Math.PI,false); sh.closePath();
    const g = new T.ShapeGeometry(sh); g.rotateY(angle); add(g,colour,x,y,z);
  };
  const beam = (p: number[], q: number[], radius: number, colour: Colour) => {
    const start = new T.Vector3(...p), end = new T.Vector3(...q), delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius,radius,delta.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));
    const mid = start.add(end).multiplyScalar(.5); add(g,colour,mid.x,mid.y,mid.z);
  };

  if (id === 'rode-hoed') {
    // The individual parent includes three unequal canal houses and the transverse rear church.
    body(rings,2.65); plane(rings,2.69);
    const left = region(-9.2,-3.18,-12.1,.04), central = region(-3.18,3.8,-11.7,.04), right = region(3.8,9.2,-12.25,.1);
    body([left],8.6); roofZ(-9.15,-3.18,-12.15,.12,8.6,4.2); gable(-6.165,8.6,.14,5.97,4.2);
    body([central],12.58); roofZ(-3.18,3.8,-11.7,.12,12.58,2.7); gable(.31,12.58,.14,6.98,2.7);
    body([right],10.75); roofZ(3.8,9.12,-12.25,.14,10.75,3.63);
    const spine = region(-3.2,3.8,-27.7,-11.5);
    body([spine],12.2); roofZ(-3.2,3.8,-25.35,-11.5,12.2,2.65);
    const church = region(-17.2,3.7,-42.65,-22.45);
    body([church],11.72); plane([church],11.76);
    b.gableRoof(-6.77,11.84,-34.02,20.86,7.3,4.82,'slate');
    const service = region(-19.7,-17.15,-43.5,-22.7); body([service],3.25); plane([service],3.29);
    const end = region(-19.6,-14.85,-50.3,-44.3); body([end],4.2); plane([end],4.25);
    const rightAnnex = region(3.7,9.2,-22.8,-13.5); body([rightAnnex],6.8); plane([rightAnnex],6.85);
    // Primary current facade: paired round portals, large upper arches, white name band and masonry piers.
    for (const x of [-1.43,1.98]) {
      arch(x,.08,.17,2.85,3.52,'stone'); arch(x,.23,.21,2.54,3.22,'dark');
      box(x,.25,.28,.06,3.12,.05,'gold'); box(x,1.12,.28,2.54,.055,.05,'gold');
      sash(x,4.33,.18,2.79,3.57);
      arch(x,8.94,.18,3.1,3.69,'stone'); arch(x,9.12,.24,2.78,3.35,'glass');
      box(x,9.14,.30,.07,3.10,.05,'frame'); box(x,10.91,.30,2.78,.06,.05,'frame');
      for (const dx of [-.9,.9]) box(x+dx,9.15,.30,.05,2.65,.05,'frame');
    }
    box(.30,8.13,.27,7.02,.76,.16,'white'); sign('RODE HOED',.30,8.28,.40,.083,'red');
    for (const x of [-3.18,.27,3.76]) {
      box(x,3.63,.24,.30,9.14,.20,'stone'); box(x,8.05,.29,.64,.92,.25,'white');
      box(x,12.49,.25,.63,.40,.26,'stone');
    }
    for (const x of [-2.4,-1.4,-.4,.6,1.6,2.6]) {
      const top = 15.10 - Math.abs(x-.31)*.77;
      arch(x,top-.66,.20,.48,.60,'dark');
    }
    for (const y of [3.84,8.7]) box(.28,y,.25,7.0,.12,.24,'stone');
    for (const x of [-7.65,-4.62]) {
      sash(x,.16,.18,2.19,2.58); sash(x,3.7,.18,2.19,2.92); arch(x,7.13,.18,2.29,2.53,'stone'); arch(x,7.27,.25,2.01,2.23,'glass');
    }
    box(-6.14,3.34,.21,6.0,.23,.23,'white'); box(-6.14,6.94,.23,6.0,.20,.24,'white');
    for (const x of [4.68,6.51,8.30]) for (const y of [.23,3.71,7.14]) sash(x,y,.21,1.3,2.46);
    box(6.46,10.65,.21,5.8,.45,.45,'white'); box(6.46,11.1,.27,6.0,.16,.56,'stone');
    // Rear church windows and buttresses follow its own long axis; small legal notches are unfilled.
    for (let x=-15.8;x<3.3;x+=3.4) {
      arch(x,4.15,-42.7,2.15,5.8,'stone',Math.PI); arch(x,4.29,-42.76,1.89,5.49,'glass',Math.PI);
      box(x,4.3,-42.81,.05,5.25,.05,'frame'); box(x,7.75,-42.81,1.89,.055,.05,'frame');
      box(x-1.6,0,-42.85,.34,11.7,.4,'brick');
    }
    for (let z=-39.3;z< -24;z+=3.7) {arch(-17.25,4.1,z,2.15,5.85,'stone',-Math.PI/2);arch(-17.31,4.25,z,1.9,5.54,'glass',-Math.PI/2);}
    box(-16.66,11.9,-23.2,.33,4.75,.45,'brick'); box(-16.66,16.65,-23.2,.52,.15,.62,'stone');
  } else if (id === 'theater-amsterdam') {
    // Glazing forms the actual foyer envelope rather than covering an opaque hall extrusion.
    const hall = region(-24,48,-84,-22.4), foyer = region(-21.6,21.6,-22.4,.12);
    body([hall],16.1,'dark'); plane([hall],16.15);
    body([foyer],.22,'stone'); plane([foyer],.24,'stone');
    box(0,.23,.17,43.0,15.84,.11,'glass');
    for (const x of [-21.5,21.5]) box(x,.23,-11.05,.11,15.84,22.43,'glass');
    for (let x=-21.1;x<21.3;x+=3.25) box(x,.0,.29,.14,16.27,.17,'frame');
    for (const y of [.14,5.22,10.31,14.4,16.1]) box(0,y,.28,43.3,.15,.2,'frame');
    for (const x of [-21.62,21.62]) {
      for (let z=-21.9;z<.2;z+=3.25) box(x,0,z,.16,16.27,.14,'frame');
      for (const y of [.14,5.22,10.31,14.4,16.1]) box(x,y,-11.1,.2,.15,22.8,'frame');
    }
    for (const y of [5.18,10.27,14.34]) box(0,y,-11.04,42.8,.11,22.0,'stone');
    // The original roof cantilevers over the glass and open pavement.
    box(0,16.34,-9.7,47.2,.36,26.6,'slate'); box(0,16.29,3.54,47.2,.08,.14,'stone');
    for (let x=-20.8;x<21.1;x+=3.25) {
      box(x,16.11,-9.65,.12,.21,26.2,'frame');
      add(new T.CylinderGeometry(.13,.13,.07,8),'gold',x,16.07,2.5);
    }
    sign('THEATER AMSTERDAM',0,8.86,.4,.18,'red');
    box(0,.05,1.6,4.88,3.02,3.0,'glass');
    for (const x of [-2.36,0,2.36]) box(x,0,3.16,.11,3.08,.1,'frame');
    box(0,3.08,3.14,4.9,.12,.18,'frame');
    // Corrugated metal rhythm is concentrated on visible sides, avoiding expensive tiny full meshes.
    for (let z=-81.5;z< -23.0;z+=1.4) {
      box(46.9,0,z,.12,16.18,.095,'slate'); box(-23.35,0,z,.12,16.18,.095,'slate');
    }
    for (let x=-22.7;x<46.8;x+=1.4) box(x,0,-83.07,.095,16.18,.12,'slate');
    box(10.45,16.7,-18.6,8.05,2.44,12.15,'slate'); box(10.45,19.14,-18.6,8.15,.11,12.25,'stone');
    box(.1,16.7,-13.0,8.6,2.1,2.0,'slate'); box(1.45,16.7,-20.3,3.8,1.99,2.0,'slate');
    // A low shallow raised strip follows the long hall roof, with taller rooftop services kept local.
    box(11.75,16.15,-52.5,56.8,.35,52.0,'slate');
  } else if (id === 'vondelpark-open-air-theater') {
    // Operator drawing: measured 13.3→5m platform,10.5m deep,1.2m high.
    const platform = [[new T.Vector2(-6.65,5.85),new T.Vector2(6.65,5.85),new T.Vector2(2.5,-4.65),new T.Vector2(-2.5,-4.65)]];
    body(platform,1.2,'dark'); plane(platform,1.23,'slate');
    // Roof arch and steel legs are original approximations of the primary overview photo.
    const count = 10;
    const front: number[][] = [], rear: number[][] = [];
    for (let i=0;i<=count;i++) {
      const t=i/count, archHeight=Math.sin(t*Math.PI);
      front.push([-6.9+13.8*t,5.7+2.5*archHeight,6.60]);
      rear.push([-2.8+5.6*t,4.3+1.95*archHeight,-6.64]);
    }
    for (let i=0;i<count;i++) {
      const p=[front[i],rear[i],rear[i+1],front[i+1]], g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(p.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();add(g,'slate');
      beam(front[i],front[i+1],.12,'stone'); beam(rear[i],rear[i+1],.10,'frame');
      beam(front[i],rear[i],.085,'gold');
    }
    beam(front[count],rear[count],.085,'gold');
    for (const s of [-1,1]) {
      beam([s*7.55,.03,8.15],[s*6.35,5.86,5.90],.19,'stone');
      beam([s*2.91,.03,-6.15],[s*2.75,4.57,-6.44],.16,'stone');
      beam([s*6.35,5.86,5.90],[s*2.75,4.57,-6.44],.12,'frame');
      // Permanent light side panels are open at the front and remain below the roof spring.
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute([s*5.65,1.2,3.3,s*2.5,1.2,-4.65,s*2.5,4.10,-4.65,s*5.65,4.35,3.3],3));
      g.setIndex(s===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();add(g,'stone');
      beam([s*5.65,1.2,3.3],[s*5.65,4.35,3.3],.045,'white');
      beam([s*2.5,4.10,-4.65],[s*5.65,4.35,3.3],.045,'white');
    }
    box(0,1.2,-4.70,5.04,3.72,.09,'dark');
    // Current lighting-grid clearance is independently measured; the roof envelope remains approximate.
    for (const z of [-3.6,3.2]) {
      const y=z>0?6.0:5.3;
      beam([-3,y,z],[3,y,z],.055,'frame'); beam([-3,y+.25,z],[3,y+.25,z],.055,'frame');
      for(let x=-3;x<2.8;x+=.6) beam([x,y,z],[x+.6,y+.25,z],.035,'frame');
      for (const x of [-2.4,-1.7,1.7,2.4]) box(x,y-.35,z,.28,.3,.36,'dark');
    }
    for (let i=0;i<4;i++) box(-5.15,i*.3,8.08-i*.44,2.1,.3,.47,'stone');
  } else throw new Error(`No canal/stage builder for ${id}`);
}
