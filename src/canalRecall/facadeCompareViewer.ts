// Side-by-side of three ways to draw a landmark: the plain OSM prism, the prism with a
// panorama facade photo on its street wall, and a low-poly modelled kit.
// `?name=waag` or `?name=bijenkorf`; the photo comes from public/data/landmark-facades.
import { kitGeometry, type Kit, type PartInput } from './landmarkKits.js';
import { buildKitChunk } from './threeBuildingMesh.js';

type Setup = { centre: [number, number]; ids: string[]; kit: Kit; roofHosts: { id: string; riseM: number }[] };
const SETUPS: Record<string, Setup> = {
  waag: {
    centre: [4.9003, 52.37264],
    ids: 'w749066938,w749066939,w749066940,w749066942,w749066943,w749066944,w749066945,w749066946,w749066947,w749066948,w749066949,w749066950'.split(','),
    // Two round corner towers with conical roofs, two turrets, and steep roofs on the main body.
    kit: {
      name: 'Waag',
      tiers: ['w749066949', 'w749066950', 'w749066946', 'w749066947'].map(id => ({ id, shape: 'octagon' as const, mat: 'brick' as const })),
      stacks: [
        ...['w749066949', 'w749066950'].map(onId => ({ onId, stages: [{ shape: 'octagon' as const, w0: 9, w1: 0.8, h: 10, mat: 'slate' as const }] })),
        ...['w749066946', 'w749066947'].map(onId => ({ onId, stages: [{ shape: 'octagon' as const, w0: 5.2, w1: 0.5, h: 5.5, mat: 'slate' as const }] })),
      ],
      roofs: ['w749066938', 'w749066939', 'w749066942', 'w749066948', 'w749066940'].map(id => ({ id, riseM: 6, mat: 'slate' as const })),
    },
    roofHosts: ['w749066938', 'w749066939', 'w749066942', 'w749066948', 'w749066940'].map(id => ({ id, riseM: 6 })),
  },
  bijenkorf: {
    centre: [4.8939, 52.37335],
    ids: 'w751128384,w751235773,w751235774,w751235775,w751235776,w751128373,NL.IMBAG.Pand.0363100012179183'.split(','),
    // A stone-faced block: the parts become stone prisms with a cornice ledge at the roofline.
    kit: {
      name: 'Bijenkorf',
      tiers: 'w751128384,w751235773,w751235774,w751235775,w751235776,w751128373,NL.IMBAG.Pand.0363100012179183'.split(',').map(id => ({ id, shape: 'square' as const, mat: 'stone' as const })),
      stacks: [], roofs: [],
    },
    roofHosts: [],
  },
};

const BEURS_IDS = 'w749918639,w749918641,w749918651,w749918653,w749918637,w749918638,w749931382,w749931383,w749918652'.split(',');
SETUPS.beurs = {
  centre: [4.8961, 52.37527],
  ids: BEURS_IDS,
  // Berlage's Beurs: a brick clock tower with a pyramid cap, and long steep-roofed halls.
  kit: {
    name: 'Beurs',
    tiers: [{ id: 'w749918639', shape: 'square', mat: 'brick' }],
    stacks: [{ onId: 'w749918639', stages: [{ shape: 'square', w0: 12.5, w1: 0.6, h: 11, mat: 'slate' }] }],
    roofs: ['w749918641', 'w749918651', 'w749918653', 'w749918637', 'w749918638'].map(id => ({ id, riseM: 7, mat: 'slate' as const })),
  },
  roofHosts: ['w749918641', 'w749918651', 'w749918653', 'w749918637', 'w749918638'].map(id => ({ id, riseM: 7 })),
};

const q = new URLSearchParams(location.search), name = q.get('name') ?? 'waag', setup = SETUPS[name];
const [clng, clat] = setup.centre, kx = 111_320 * Math.cos(clat * Math.PI / 180), ky = 110_540;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)]; };
async function loadTile(x: number, y: number): Promise<any[]> {
  const response = await fetch(`/data/extracts/amsterdam/building-tiles/14/${x}/${y}.geojson.gz`);
  if (!response.ok) return [];
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
  return JSON.parse(text).features ?? [];
}

(async () => {
  const THREE = (window as any).CanalRecallThree.THREE;
  const meta = await (await fetch(`/data/landmark-facades/${name}.json`)).json();
  const [tx, ty] = tileOf(clng, clat);
  const features = (await Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => loadTile(tx + dx, ty + dy))))).flat();
  const local = (ring: number[][]) => ring.map(([lng, lat]) => [(lng - clng) * kx, (lat - clat) * ky] as [number, number]);
  const mine = new Set(setup.ids), parts = new Map<string, PartInput>(), context: any[] = [];
  for (const f of features) {
    const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0], id = String(f.properties.id), pts = local(ring);
    if (mine.has(id)) parts.set(id, { id, ring: pts, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
    else if (Math.hypot(pts[0][0], pts[0][1]) < 80) context.push({ pts, h: Number(f.properties.height) || 8, min: Number(f.properties.minHeight) || 0 });
  }
  const prism = (pts: [number, number][], z0: number, z1: number, color: string) => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, z1 - z0), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, z0, 0);
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  };
  const lights = (scene: any) => {
    scene.background = new THREE.Color('#e9e4d4');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x998f80, 1.6));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8); sun.position.set(-40, 80, 60); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ddd7c6' }));
    ground.position.y = -0.05; scene.add(ground);
    for (const c of context) scene.add(prism(c.pts, c.min, Math.max(c.min + 1, c.h), '#b9b2a4'));
  };
  const sceneFor = (variant: 'plain' | 'photo' | 'kit', texture: any) => {
    const scene = new THREE.Scene(); lights(scene);
    if (variant === 'plain') for (const p of parts.values()) scene.add(prism(p.ring, p.minHeightM, p.heightM, '#d9c24a'));
    if (variant === 'photo') {
      for (const p of parts.values()) scene.add(prism(p.ring, p.minHeightM, p.heightM, '#9a8a78'));
      const [ax, ay] = local([meta.wall.startLngLat])[0], [bx, by] = local([meta.wall.endLngLat])[0];
      const bearing = meta.wall.outwardBearingDeg * Math.PI / 180, nx = Math.sin(bearing) * 0.06, ny = Math.cos(bearing) * 0.06;
      const buildingH = meta.wall.heightM - 1.5, visible = buildingH / meta.wall.heightM;
      const quad = new THREE.BufferGeometry();
      // three: x east, y up, z south = -north.
      const pos = [ax + nx, 0, -(ay + ny), bx + nx, 0, -(by + ny), bx + nx, buildingH, -(by + ny), ax + nx, buildingH, -(ay + ny)];
      quad.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, visible, 0, visible], 2));
      quad.setIndex([0, 1, 2, 0, 2, 3]); quad.computeVertexNormals();
      scene.add(new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })));
    }
    if (variant === 'kit') {
      for (const h of setup.roofHosts) { const p = parts.get(h.id); if (p) scene.add(prism(p.ring, p.minHeightM, p.heightM - h.riseM, '#9a5240')); }
      const unused = [...parts.values()].filter(p => !setup.kit.tiers.some(t => t.id === p.id) && !setup.roofHosts.some(h => h.id === p.id));
      for (const p of unused) scene.add(prism(p.ring, p.minHeightM, p.heightM, '#9a5240'));
      const chunk = buildKitChunk(kitGeometry(setup.kit, parts), { plain: 0, flat: 0, slope: 0 });
      const geometry = new THREE.BufferGeometry(), pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
      for (let i = 0; i < chunk.vertexCount; i++) {
        pos[i * 3] = chunk.positions[i * 3]; pos[i * 3 + 1] = chunk.positions[i * 3 + 2]; pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
        const s = chunk.tints[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) col[i * 3 + c] = (chunk.tints[i * 4 + c] / 255) * s;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }
    return scene;
  };
  const texture = await new Promise<any>(resolve => new THREE.TextureLoader().load(`/data/landmark-facades/${meta.image}`, (t: any) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }));
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  const W = innerWidth, H = innerHeight; renderer.setSize(W, H); renderer.setScissorTest(true);
  document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
  const [ax, ay] = local([meta.wall.startLngLat])[0], [bx, by] = local([meta.wall.endLngLat])[0];
  const mid = [(ax + bx) / 2, (ay + by) / 2], bearing = meta.wall.outwardBearingDeg * Math.PI / 180, buildingH = meta.wall.heightM - 1.5;
  const dist = Number(q.get('r') ?? 0) || Math.max(55, buildingH * 2.2), az = Number(q.get('az') ?? 0) * Math.PI / 180, el = Number(q.get('el') ?? 12) * Math.PI / 180;
  const cam = new THREE.PerspectiveCamera(32, (W / 3) / H, 1, 2000), a = bearing + az, focusY = buildingH * 0.42;
  cam.position.set(mid[0] + Math.sin(a) * Math.cos(el) * dist, focusY + Math.sin(el) * dist, -(mid[1] + Math.cos(a) * Math.cos(el) * dist));
  cam.lookAt(mid[0], focusY, -mid[1]);
  (['plain', 'photo', 'kit'] as const).forEach((variant, i) => {
    renderer.setViewport(i * W / 3, 0, W / 3, H); renderer.setScissor(i * W / 3, 0, W / 3, H);
    renderer.render(sceneFor(variant, texture), cam);
  });
  (window as any).__info = { parts: parts.size };
  document.title = 'ready';
})();
