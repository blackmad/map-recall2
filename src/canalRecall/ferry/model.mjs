import * as THREE from 'three';

/** Original texture-free double-ended IJ ferry, guided by IJveer 60 photos.
 * Metres, Y up, longitudinal axis X. Both ends have boarding ramps. */
export function createFerryModel() {
  const root = new THREE.Group(); root.name = 'GVB-style-IJ-ferry';
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .75 });
  const blue = mat(0x008bce), navy = mat(0x092b56), white = mat(0xf2f0e7);
  const glass = mat(0x284856), deck = mat(0x6b7174), yellow = mat(0xe8bd35), black = mat(0x1c2428);
  function box(name, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name; mesh.position.set(...position); root.add(mesh); return mesh;
  }
  // Chamfered plan hull, with broad flat ends rather than a pointed sloep bow.
  const outline = new THREE.Shape();
  [[-16.5,-3.1],[-14,-4.5],[14,-4.5],[16.5,-3.1],[16.5,3.1],[14,4.5],[-14,4.5],[-16.5,3.1]].forEach(([x,z],i)=>i?outline.lineTo(x,z):outline.moveTo(x,z));
  const hullGeo = new THREE.ExtrudeGeometry(outline,{ depth:1.6, bevelEnabled:false });
  hullGeo.rotateX(Math.PI/2); hullGeo.translate(0,1.6,0);
  const hull = new THREE.Mesh(hullGeo,navy); hull.name='chamfered-double-ended-hull'; root.add(hull);
  box('passenger-deck',[30,.22,8.3],[0,1.72,0],deck);
  for(const side of [-1,1]) {
    box('blue-side-band',[27,1.25,.25],[0,2.2,side*4.2],blue);
    box('rubber-fender',[30,.3,.3],[0,1.48,side*4.3],black);
    // White side silhouette rises towards the central upper bridge.
    const profile = new THREE.Shape();
    profile.moveTo(-14,2.8); profile.lineTo(-8,5.6); profile.lineTo(8,5.6); profile.lineTo(14,2.8); profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile,{depth:.18,bevelEnabled:false});
    const wall = new THREE.Mesh(geometry,white); wall.name='sloping-white-superstructure'; wall.position.z=side*4.1; root.add(wall);
    for(let x=-10;x<=10;x+=2.5) {
      const height=Math.min(1.75, .7+(12-Math.abs(x))*.16);
      box('lower-deck-window',[1.9,height,.06],[x,3.05+height/2,side*4.22],glass);
    }
    // Open balconies either side of the elevated bridge.
    box('upper-balcony-deck',[16,.2,8.2],[0,5.6,0],white);
    for(let x=-7.5;x<=7.5;x+=1.5) box('balcony-post',[.07,1,.07],[x,6.2,side*4],white);
    for(const y of [5.9,6.3,6.65]) box('balcony-rail',[16,.06,.06],[0,y,side*4],white);
    for(const x of [-5.7,5.7]) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.38,.095,6,16),mat(0xe6532c));
      ring.position.set(x,6.22,side*4.08);ring.name='lifebuoy';root.add(ring);
    }
  }
  box('wheelhouse-sill',[7.8,.35,7.1],[0,6.2,0],white);
  box('wheelhouse-glazing',[7.6,1.6,6.9],[0,7.15,0],glass);
  for(const side of [-1,1]) for(let x=-3.7;x<=3.8;x+=1.5) box('window-mullion',[.12,1.7,.13],[x,7.2,side*3.5],white);
  for(const end of [-1,1]) for(const z of [-3.4,-1.15,1.15,3.4]) box('end-window-mullion',[.13,1.7,.13],[end*3.8,7.2,z],white);
  box('blue-wheelhouse-roof',[9,.25,8.1],[0,8.08,0],blue);
  box('mast',[.12,2.5,.12],[0,9.4,0],white);
  box('radar',[1.5,.16,.18],[0,9.4,0],white);
  for(const end of [-1,1]) {
    const ramp=box('boarding-ramp',[2.6,.18,5.8],[end*15.1,1.9,0],navy);
    ramp.rotation.z=end*.12;
    box('yellow-ramp-edge',[.16,.18,5.8],[end*16.3,2.05,0],yellow);
    for(const side of [-1,1]) {
      box('ramp-guard',[2.5,1,.13],[end*15,2.35,side*3.05],navy);
      box('ramp-top-rail',[2.6,.09,.16],[end*15,2.92,side*3.05],yellow);
      box('mooring-bollard',[.28,.5,.28],[end*12.8,2,side*3.6],black);
    }
  }
  return root;
}
