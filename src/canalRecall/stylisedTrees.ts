// Stylised 3D trees at OSM tree positions (experiment, 2026-10-01).
//
// `trees.json` (natural=tree nodes and sampled tree_rows, one per ~8 m cell)
// was drawn only as flat circles, and nothing loaded it. Here each tree is
// three small fill-extrusions in the same flat-coloured idiom as the
// buildings: a four-sided trunk, a wide hexagonal crown and a narrower cap.
// Fill-extrusion is the cheapest thing that stands up at the chase (48°) and
// cockpit (84°) pitches: no models, no textures, one draw per layer, and it
// depth-sorts against the buildings for free. Trees are presentation only —
// nothing here reaches routing or physics.
//
// The crown sits high (base ≥ 2.6 m) and is modest (≤ 2.6 m radius) so the
// road surface under it stays visible from the chase camera, and any tree
// whose crown would overhang the route corridor is dropped
// (`thinTreesNearRoute`).

export type OsmTree = { id: string; lat: number; lng: number; species?: string };
export type TreePart = 'trunk' | 'crown' | 'cap';

type Polygon = { type: 'Polygon'; coordinates: number[][][] };
export type TreeFeature = {
  type: 'Feature';
  properties: { id: string; part: TreePart; base: number; height: number; shade: number };
  geometry: Polygon;
};

function hash(id: string): number {
  let h = 2166136261;
  for (const char of id) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A regular polygon of `sides` around a point, radius in metres. */
export function ringAround(lng: number, lat: number, radiusM: number, sides: number, rotation = 0): number[][] {
  const kx = 111_320 * Math.cos(lat * Math.PI / 180), ky = 110_540;
  const ring: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    ring.push([lng + (Math.cos(a) * radiusM) / kx, lat + (Math.sin(a) * radiusM) / ky]);
  }
  ring.push(ring[0]);
  return ring;
}

/** Deterministic size for one tree: crowns 1.9–2.6 m wide, 6–9 m tall. */
export function treeShape(id: string): { crownR: number; crownBase: number; crownTop: number; capR: number; capTop: number; shade: number; rotation: number } {
  const h = hash(id);
  const u = (shift: number) => ((h >>> shift) & 0xff) / 255;
  const crownR = 1.9 + 0.7 * u(0);
  const crownBase = 2.6 + 0.6 * u(8);
  const crownTop = crownBase + 2.6 + 1.6 * u(16);
  return {
    crownR, crownBase, crownTop,
    capR: crownR * 0.62,
    capTop: crownTop + 1.0 + 0.8 * u(24),
    shade: h % 3,
    rotation: u(4) * Math.PI,
  };
}

export const TREE_TRUNK_RADIUS_M = 0.28;
export const TREE_TRUNK_TOP_M = 3.0;

/** Three extrusion features per tree. */
export function treeFeatures(trees: readonly OsmTree[]): TreeFeature[] {
  const out: TreeFeature[] = [];
  for (const tree of trees) {
    if (!Number.isFinite(tree.lat) || !Number.isFinite(tree.lng)) continue;
    const s = treeShape(tree.id);
    out.push({ type: 'Feature', properties: { id: tree.id, part: 'trunk', base: 0, height: TREE_TRUNK_TOP_M, shade: s.shade },
      geometry: { type: 'Polygon', coordinates: [ringAround(tree.lng, tree.lat, TREE_TRUNK_RADIUS_M, 4, s.rotation)] } });
    out.push({ type: 'Feature', properties: { id: tree.id, part: 'crown', base: s.crownBase, height: s.crownTop, shade: s.shade },
      geometry: { type: 'Polygon', coordinates: [ringAround(tree.lng, tree.lat, s.crownR, 6, s.rotation)] } });
    out.push({ type: 'Feature', properties: { id: tree.id, part: 'cap', base: s.crownTop, height: s.capTop, shade: s.shade },
      geometry: { type: 'Polygon', coordinates: [ringAround(tree.lng, tree.lat, s.capR, 6, s.rotation + Math.PI / 6)] } });
  }
  return out;
}

/** Trees inside a lng/lat box (the extract spans the whole region). */
export function treesInBounds(trees: readonly OsmTree[], west: number, south: number, east: number, north: number): OsmTree[] {
  return trees.filter(t => t.lng >= west && t.lng <= east && t.lat >= south && t.lat <= north);
}

/**
 * Drop trees whose crown would overhang the route line, so the corridor the
 * rider follows is never roofed over. `route` is a lng/lat polyline;
 * `clearanceM` is measured from the trunk to the nearest route segment.
 * A coarse grid keeps it linear in trees + segments.
 */
export function thinTreesNearRoute(trees: readonly OsmTree[], route: readonly number[][], clearanceM = 3.2): OsmTree[] {
  if (!route || route.length < 2) return [...trees];
  const lat0 = route[0][1];
  const kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 110_540;
  const cell = 50;
  const grid = new Map<string, Array<[number, number, number, number]>>();
  for (let i = 1; i < route.length; i++) {
    const ax = route[i - 1][0] * kx, ay = route[i - 1][1] * ky, bx = route[i][0] * kx, by = route[i][1] * ky;
    const minX = Math.floor((Math.min(ax, bx) - clearanceM) / cell), maxX = Math.floor((Math.max(ax, bx) + clearanceM) / cell);
    const minY = Math.floor((Math.min(ay, by) - clearanceM) / cell), maxY = Math.floor((Math.max(ay, by) + clearanceM) / cell);
    for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
      const key = `${gx},${gy}`;
      let list = grid.get(key);
      if (!list) grid.set(key, list = []);
      list.push([ax, ay, bx, by]);
    }
  }
  return trees.filter(tree => {
    const px = tree.lng * kx, py = tree.lat * ky;
    const segments = grid.get(`${Math.floor(px / cell)},${Math.floor(py / cell)}`);
    if (!segments) return true;
    for (const [ax, ay, bx, by] of segments) {
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < clearanceM) return false;
    }
    return true;
  });
}

/** Theme tones: [trunk, crown shades ×3]. */
export function treePalette(theme: string): { trunk: string; crowns: [string, string, string] } {
  if (theme === 'cyberpunk') return { trunk: '#3a1446', crowns: ['#6A167A', '#8a1f8f', '#FF2DAA'] };
  if (theme === 'psx') return { trunk: '#4A4335', crowns: ['#5a6340', '#646B45', '#6f7550'] };
  return { trunk: '#6b4c34', crowns: ['#4f8a48', '#5c9a4f', '#447a43'] };
}

/** MapLibre layer specs for the two tree layers (trunks; crowns + caps). */
export function treeLayers(sourceId: string, theme = 'clean', visible = true): Array<Record<string, unknown>> {
  const palette = treePalette(theme);
  const layout = { visibility: visible ? 'visible' : 'none' };
  // Trees fade in with the city (buildings do from zoom 15).
  const opacity = ['interpolate', ['linear'], ['zoom'], 15.4, 0, 16, 1];
  return [
    {
      id: 'tree-trunks', type: 'fill-extrusion', source: sourceId, minzoom: 15.4,
      filter: ['==', ['get', 'part'], 'trunk'], layout,
      paint: { 'fill-extrusion-color': palette.trunk, 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': opacity },
    },
    {
      id: 'tree-crowns', type: 'fill-extrusion', source: sourceId, minzoom: 15.4,
      filter: ['!=', ['get', 'part'], 'trunk'], layout,
      paint: {
        'fill-extrusion-color': treeCrownColour(theme),
        'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': opacity,
      },
    },
  ];
}

export function treeCrownColour(theme: string): unknown[] {
  const palette = treePalette(theme);
  return ['match', ['get', 'shade'], 0, palette.crowns[0], 1, palette.crowns[1], palette.crowns[2]];
}
