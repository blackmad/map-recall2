// Side-by-side for landmark reconstruction: the plain OSM prism, the low-poly
// reconstruction (kit plus measured front, flat colours), and the rectified street
// panorama it was measured from, shown flat as a reference only.
// `?name=waag|bijenkorf|beurs`; the reference comes from public/data/landmark-facades.
import { KITS, kitGeometry, type Kit, type PartInput } from './landmarkKits.js';
import { buildKitChunk } from './threeBuildingMesh.js';
import { frontTriangles } from './landmarkFronts.js';
import { FRONTS, STOREFRONT_BY_SLUG } from './landmarkFrontData.js';

type Setup = { centre: [number, number]; ids: string[]; kit: Kit };
const SETUPS: Record<string, Setup> = {
  waag: {
    centre: [4.9003, 52.37264],
    ids: 'w749066938,w749066939,w749066940,w749066942,w749066943,w749066944,w749066945,w749066946,w749066947,w749066948,w749066949,w749066950'.split(','),
    // Two round corner towers with conical roofs, two turrets, and steep roofs on the main body.
    kit: KITS.find(k => k.name === 'Waag')!,
  },
  bijenkorf: {
    centre: [4.8939, 52.37335],
    ids: 'w751128384,w751235773,w751235774,w751235775,w751235776,w751128373,NL.IMBAG.Pand.0363100012179183'.split(','),
    // Plain prisms in the front's stone; the front (landmarkFrontData.ts) carries the detail.
    kit: { name: 'Bijenkorf', tiers: [], stacks: [], roofs: [] },
  },
};

const KIT_PART_IDS_OF = (k: Kit) => [...k.tiers.map(t => t.id), ...k.stacks.map(t => t.onId), ...k.roofs.map(r => r.id)];
const BEURS_IDS = 'w749918639,w749918641,w749918651,w749918653,w749918637,w749918638,w749931382,w749931383,w749918652'.split(',');
SETUPS.beurs = {
  centre: [4.8961, 52.37527],
  ids: BEURS_IDS,
  kit: KITS.find(k => k.name === 'Beurs van Berlage')!,
};

// Any other front: centred on its wall, its carrying parts, and the kit of the same name if there is one.
for (const [key, f] of Object.entries(FRONTS)) if (!SETUPS[key]) SETUPS[key] = {
  centre: [(f.start[0] + f.end[0]) / 2, (f.start[1] + f.end[1]) / 2], ids: [...f.ids, ...(KITS.find(k => k.name === f.name) ? KIT_PART_IDS_OF(KITS.find(k => k.name === f.name)!) : [])],
  kit: KITS.find(k => k.name === f.name) ?? { name: f.name, tiers: [], stacks: [], roofs: [] },
};
// `?storefront=<slug>`: a spec-built storefront, its reference crop served from tmp/storefronts/refs.
const q = new URLSearchParams(location.search), storefront = q.get('storefront');
if (storefront) { const f = STOREFRONT_BY_SLUG.get(storefront)!; SETUPS[storefront] = { centre: [(f.start[0] + f.end[0]) / 2, (f.start[1] + f.end[1]) / 2], ids: f.ids, kit: { name: f.name, tiers: [], stacks: [], roofs: [] } }; }
const name = storefront ?? q.get('name') ?? 'waag', setup = SETUPS[name], front = storefront ? STOREFRONT_BY_SLUG.get(storefront) : FRONTS[name];
const refBase = storefront ? '/tmp/storefronts/refs' : '/data/landmark-facades';
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
  const meta = await (await fetch(`${refBase}/${name}.json`)).json();
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
  // Buildings across the street from the photographed wall stand between it and the camera; leave them out.
  {
    const [ax, ay] = local([meta.wall.startLngLat])[0], [bx, by] = local([meta.wall.endLngLat])[0];
    const b = meta.wall.outwardBearingDeg * Math.PI / 180, ox = Math.sin(b), oy = Math.cos(b), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay) || 1, half = len / 2 + 25, ux = (bx - ax) / len, uy = (by - ay) / len;
    const inFront = (pts: [number, number][]) => pts.some(([x, y]) => { const out = (x - mx) * ox + (y - my) * oy, along = (x - mx) * ux + (y - my) * uy; return out > 1 && out < 70 && Math.abs(along) < half; });
    for (let i = context.length - 1; i >= 0; i--) if (inFront(context[i].pts)) context.splice(i, 1);
  }
  // Footprint parts that carry the front stop at the front's own body height.
  if (front?.bodyTopM != null) {
    const [ax, ay] = local([front.start])[0], [bx, by] = local([front.end])[0], len = Math.hypot(bx - ax, by - ay);
    const offLine = ([x, y]: [number, number]) => Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / len;
    for (const p of parts.values()) if (p.ring.filter(pt => offLine(pt) < 0.5).length >= 2) p.heightM = Math.min(p.heightM, front.bodyTopM);
  }
  const lights = (scene: any) => {
    scene.background = new THREE.Color('#e9e4d4');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x998f80, 1.6));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8); sun.position.set(-40, 80, 60); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ddd7c6' }));
    ground.position.y = -0.05; scene.add(ground);
    for (const c of context) scene.add(prism(c.pts, c.min, Math.max(c.min + 1, c.h), '#b9b2a4'));
  };
  const sceneFor = (variant: 'plain' | 'kit') => {
    const scene = new THREE.Scene(); lights(scene);
    if (variant === 'plain') for (const p of parts.values()) scene.add(prism(p.ring, p.minHeightM, p.heightM, '#d9c24a'));
    if (variant === 'kit') {
      for (const h of setup.kit.roofs) { const p = parts.get(h.id); if (p) scene.add(prism(p.ring, p.minHeightM, p.heightM - h.riseM, '#9a5240')); }
      const unused = [...parts.values()].filter(p => !setup.kit.tiers.some(t => t.id === p.id) && !setup.kit.roofs.some(h => h.id === p.id));
      for (const p of unused) scene.add(prism(p.ring, p.minHeightM, p.heightM, front?.hex ?? '#9a5240'));
      const chunk = buildKitChunk(kitGeometry(setup.kit, parts), { plain: 0, flat: 0, slope: 0 });
      const geometry = new THREE.BufferGeometry(), pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
      for (let i = 0; i < chunk.vertexCount; i++) {
        pos[i * 3] = chunk.positions[i * 3]; pos[i * 3 + 1] = chunk.positions[i * 3 + 2]; pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
        const s = chunk.tints[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) col[i * 3 + c] = (chunk.tints[i * 4 + c] / 255) * s;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      if (front) {
        // Wall frame to three: along the wall, up, and out along its outward normal (three z is south).
        const [fax, fay] = local([front.start])[0], [fbx, fby] = local([front.end])[0], len = Math.hypot(fbx - fax, fby - fay);
        const ux = (fbx - fax) / len, uy = (fby - fay) / len, ox = uy, oy = -ux;
        const tris = frontTriangles(front, (along, up, out) => [fax + ux * along + ox * out, fay + uy * along + oy * out, up]);
        const fp = new Float32Array(tris.length * 9), fc = new Float32Array(tris.length * 9), c = new THREE.Color();
        tris.forEach((t, i) => t.p.forEach(([x, y, z], k) => {
          fp.set([x, z, -y], i * 9 + k * 3); c.set(t.hex); fc.set([c.r, c.g, c.b], i * 9 + k * 3);
        }));
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3)); fg.computeVertexNormals();
        scene.add(new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      }
    }
    return scene;
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  const W = innerWidth, H = innerHeight; renderer.setSize(W, H); renderer.setScissorTest(true);
  document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
  const [ax, ay] = local([meta.wall.startLngLat])[0], [bx, by] = local([meta.wall.endLngLat])[0];
  const mid = [(ax + bx) / 2, (ay + by) / 2], bearing = meta.wall.outwardBearingDeg * Math.PI / 180, buildingH = meta.wall.heightM - 1.5;
  const dist = Number(q.get('r') ?? 0) || Math.max(55, buildingH * 2.2), az = Number(q.get('az') ?? 0) * Math.PI / 180, el = Number(q.get('el') ?? 12) * Math.PI / 180;
  const cam = new THREE.PerspectiveCamera(32, (W / 3) / H, 1, 2000), a = bearing + az, focusY = buildingH * 0.42;
  cam.position.set(mid[0] + Math.sin(a) * Math.cos(el) * dist, focusY + Math.sin(el) * dist, -(mid[1] + Math.cos(a) * Math.cos(el) * dist));
  cam.lookAt(mid[0], focusY, -mid[1]);
  (['plain', 'kit'] as const).forEach((variant, i) => {
    renderer.setViewport(i * W / 3, 0, W / 3, H); renderer.setScissor(i * W / 3, 0, W / 3, H);
    renderer.render(sceneFor(variant), cam);
  });
  // The panorama crop the front was measured from, shown flat as a reference, never as a texture.
  const ref = document.createElement('img');
  Object.assign(ref.style, { position: 'fixed', left: `${(2 * W) / 3}px`, top: '0', width: `${W / 3}px`, height: `${H}px`, objectFit: 'contain', background: '#e9e4d4' });
  ref.src = `${refBase}/${meta.image}`; document.body.appendChild(ref);
  await ref.decode().catch(() => {});
  (window as any).__info = { parts: parts.size };
  document.title = 'ready';
})();
