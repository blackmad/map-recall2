/**
 * The industrial kit (lane industrial-kit 2026-11-10): what a building the industrial table names (industrialClass.ts)
 * draws instead of the house grammar. Pure, no DOM; runs in the chunk worker.
 *
 *   tank    a windowless cylinder in painted or bare steel, a darker rim band, a thin handrail ring above the roof edge,
 *           a shallow cone roof and one caged ladder strip on the side facing the street.
 *   silo    a windowless concrete block with a rim band.
 *   shed    profiled metal cladding (the flat-roof surface cell's 2 m seams, laid at `SHED_SEAM_M` along the wall so
 *           they read as the ribs of trapezoidal sheet), a concrete plinth, a coping band, and on the street side
 *           roller doors or raised loading docks, a personnel door and, on some, a short ribbon window. No shopfront,
 *           no punched windows, no facade extras.
 *   office  keeps the grammar's windows; only the guessed shopfront goes (meshBuildingFor).
 *
 * Colours are measured from data.amsterdam.nl panoramas of the classified buildings (docs/reports/industrial-kit-
 * 20261110.md): picked per building by hash from the kind's palette. `?industrialKit=0|1` (passed to the chunk
 * worker) decides; without the `industrial` stamp nothing here runs, so every other building is byte-identical.
 */
import type { IndustrialKind } from './industrialClass.js';

/** The kinds the kit draws ('office' keeps the grammar; 'works' is a shed with an office front). */
export type KitKind = Exclude<IndustrialKind, 'office'>;

/** Default for `?industrialKit` (the integrator flips it after the strips). */
export const INDUSTRIAL_KIT_DEFAULT = true;

export function industrialKitEnabled(): boolean {
  const g = globalThis as { __canalRecallIndustrialKit?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallIndustrialKit === 'boolean') return g.__canalRecallIndustrialKit;
  try {
    const v = new URLSearchParams(g.location?.search ?? '').get('industrialKit');
    return v === null ? INDUSTRIAL_KIT_DEFAULT : v !== '0';
  } catch { return INDUSTRIAL_KIT_DEFAULT; }
}

/**
 * Measured palettes (panorama medians of the wall in shade-corrected light, see the report). Tanks: bare aluminium and
 * stainless (Isarweg, Petroleumhaven), white and pale-grey paint. Sheds: blue-grey and anthracite trapezoidal sheet,
 * pale grey and white sandwich panels, a few in green or beige. Silos: concrete.
 */
export const INDUSTRIAL_PALETTES: Record<'tank' | 'silo' | 'shed', readonly string[]> = {
  tank: ['#e2e4e0', '#d4d7d6', '#c6cbcd', '#e2e4e0', '#b9bec0'],
  silo: ['#a9a69e', '#b8b4aa', '#9d9a93'],
  // Weighted by what the strip panoramas show: mostly pale grey and white sandwich panels (Minervahaven 1978
  // #a3a4a0, Hornweg 1991 and Buiksloterham 1968 white/pale grey), some blue-grey trapezoidal sheet (Westpoort 1967
  // warehouse #30495d, Westpoort 2007 hall #445967), one anthracite and one green. 7 of 10 light: the first strips
  // drew 6 of 10 dark and read dour next to the photos (and the 2026-10-16 brighter-palette priority).
  shed: ['#a3a4a0', '#b4b6b3', '#c9cccb', '#d6d7d3', '#dfe0dc', '#bfc3c2', '#aeb3b4', '#3e5665', '#4d6575', '#6d7378', '#6f7f72'],
};
/** Trim: the plinth (concrete), door leaves, dock shelters and glass. */
export const INDUSTRIAL_TRIM = { office: '#e3e3de', plinth: '#8f8c85', door: '#c3c5c4', doorDark: '#5c6266', dock: '#26292b', glass: '#3a4650', personnel: '#7a2e26', rail: '#b8473a', ladder: '#4a4f52' } as const;

/** Rib spacing of the cladding: the surface cell's seam every 2 m of a 4 m cell, laid so one seam falls every this many metres. */
export const SHED_SEAM_M = 0.6;
/** The tank's wall cell (m): a bare-steel tank wall reads as plates, not ribs. */
export const TANK_CELL_M = 5;

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

export const industrialWallHex = (id: string, kind: KitKind): string => {
  const p = INDUSTRIAL_PALETTES[kind === 'works' ? 'shed' : kind];
  return p[Math.floor(hash01(`${id}:industrial-wall`) * p.length)];
};

/** What the mesh builder needs for a kit building (threeBuildingMesh.ts MeshBuilding.industrial). */
export interface IndustrialMeshSpec {
  kind: 'tank' | 'silo' | 'shed';
  /** Metres of wall one texture cell spans along the wall (bare quads; the default bare wall is 5). */
  wallCellM: number;
  /** Shed street fronts: roller doors at grade, or loading docks raised to truck-bed height. */
  doors?: 'roller' | 'dock';
  /** A short ribbon window on the street front. */
  ribbon?: boolean;
  /** A 'works' hall: an office block with ribbon windows at one end of the street front. */
  officeFront?: boolean;
  /** The trim colours in the building's look (INDUSTRIAL_TRIM through the look's tone). */
  trim: Record<keyof typeof INDUSTRIAL_TRIM, string>;
}

export function industrialMeshSpec(id: string, kind: KitKind, heightM: number, areaM2: number, tone: (hex: string) => string = h => h): IndustrialMeshSpec {
  const trim = Object.fromEntries(Object.entries(INDUSTRIAL_TRIM).map(([k, v]) => [k, tone(v)])) as IndustrialMeshSpec['trim'];
  if (kind === 'tank') return { kind, wallCellM: TANK_CELL_M, trim };
  if (kind === 'silo') return { kind, wallCellM: 5, trim };
  // Distribution halls (large footprints) have dock doors; smaller workshops roller doors at grade.
  const doors = areaM2 >= 2500 ? (hash01(`${id}:doors`) < 0.75 ? 'dock' : 'roller') : hash01(`${id}:doors`) < 0.2 ? 'dock' : 'roller';
  return { kind: 'shed', wallCellM: SHED_SEAM_M * 2, doors, ribbon: heightM >= 6 && hash01(`${id}:ribbon`) < 0.3, ...(kind === 'works' ? { officeFront: true } : {}), trim };
}

// ---------------------------------------------------------------------------------------------- geometry

type V3 = [number, number, number];
/** A flat-colour triangle as the chunk builder's sign list takes it. */
export type KitTri = { p: V3[]; hex: string; n: V3 };
/** A wall edge in chunk metres, outward normal on the right of travel (threeBuildingMesh.ts ringEdges). */
export type KitEdge = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number; hole: boolean };

function face(q: V3[], n: V3, hex: string, out: KitTri[]) {
  const [A, B, C, D] = q;
  const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
  out.push({ p: flip ? [A, C, B] : [A, B, C], hex, n }, { p: flip ? [A, D, C] : [A, C, D], hex, n });
}

/** A panel on the wall: `a0..a1` along the edge, `z0..z1`, standing `off` metres proud. */
function panel(e: KitEdge, a0: number, a1: number, z0: number, z1: number, off: number, hex: string, out: KitTri[]) {
  const ux = (e.x1 - e.x0) / e.len, uy = (e.y1 - e.y0) / e.len;
  const P = (a: number, z: number): V3 => [e.x0 + ux * a + e.nx * off, e.y0 + uy * a + e.ny * off, z];
  face([P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)], [e.nx, e.ny, 0], hex, out);
}

const scaleHex = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');

export interface KitTriInput {
  id: string;
  spec: IndustrialMeshSpec;
  wallHex: string;
  /** Every outer wall edge of the building, and the ones the builder found facing a street (door walls). */
  edges: readonly KitEdge[];
  street: ReadonlySet<KitEdge>;
  /** Edges hidden by a neighbour (party walls): no trim. */
  hidden: (e: KitEdge) => boolean;
  base: number;
  top: number;
}

/** The kit's extra triangles: bands, doors, docks, ribbon, tank rail, ladder and cone. */
export function industrialTris(i: KitTriInput): KitTri[] {
  const out: KitTri[] = [], t = i.spec.trim, h = i.top - i.base;
  const exposed = i.edges.filter(e => !e.hole && !i.hidden(e));
  if (!exposed.length || h < 2) return out;
  if (i.spec.kind === 'tank') {
    const rim = scaleHex(i.wallHex, 0.82), rail = t.rail;
    for (const e of exposed) {
      panel(e, 0, e.len, i.top - Math.min(0.45, h * 0.05), i.top, 0.04, rim, out);
      // The roof gallery's handrail: a thin band a metre above the rim, read as a rail from the street.
      panel(e, 0, e.len, i.top + 0.95, i.top + 1.05, 0.0, rail, out);
    }
    // One caged ladder on the side facing the street (else the first exposed wall).
    const s = exposed.filter(e => i.street.has(e)), lad = (s.length ? s : exposed).reduce((a, b) => (b.len > a.len ? b : a));
    const mid = lad.len / 2;
    panel(lad, mid - 0.35, mid + 0.35, i.base + 2.2, i.top + 1.05, 0.25, t.ladder, out);
    // A shallow cone over the lid: apex at the outline's mean, a tenth of the radius high.
    const pts = exposed.length === i.edges.filter(e => !e.hole).length ? i.edges.filter(e => !e.hole) : exposed;
    const cx = pts.reduce((s, e) => s + e.x0, 0) / pts.length, cy = pts.reduce((s, e) => s + e.y0, 0) / pts.length;
    const r = pts.reduce((s, e) => s + Math.hypot(e.x0 - cx, e.y0 - cy), 0) / pts.length, apex: V3 = [cx, cy, i.top + Math.max(0.3, r * 0.13)];
    const roof = scaleHex(i.wallHex, 0.95);
    for (const e of i.edges.filter(e => !e.hole)) {
      const A: V3 = [e.x0, e.y0, i.top], B: V3 = [e.x1, e.y1, i.top];
      const u = [B[0] - A[0], B[1] - A[1], 0], w = [apex[0] - A[0], apex[1] - A[1], apex[2] - A[2]];
      const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const l = Math.hypot(...n) || 1, nn: V3 = [n[0] / l, n[1] / l, n[2] / l];
      out.push(nn[2] >= 0 ? { p: [A, B, apex], hex: roof, n: nn } : { p: [A, apex, B], hex: roof, n: [-nn[0], -nn[1], -nn[2]] });
    }
    return out;
  }
  // Silo and shed: a concrete plinth and a coping band on every exposed wall.
  const coping = i.spec.kind === 'silo' ? scaleHex(i.wallHex, 0.85) : scaleHex(i.wallHex, 0.72), plinth = t.plinth;
  for (const e of exposed) {
    if (e.len < 1) continue;
    panel(e, 0, e.len, i.top - 0.5, i.top, 0.05, coping, out);
    if (i.spec.kind === 'shed') panel(e, 0, e.len, i.base, i.base + Math.min(0.6, h * 0.1), 0.03, plinth, out);
  }
  if (i.spec.kind !== 'shed') return out;
  // The street front: the longest street-facing walls (else the longest exposed wall), doors spaced along them.
  const fronts = (exposed.some(e => i.street.has(e)) ? exposed.filter(e => i.street.has(e)) : exposed).filter(e => e.len >= 8).sort((a, b) => b.len - a.len).slice(0, 2);
  const door = hash01(`${i.id}:door`) < 0.5 ? t.door : t.doorDark, dock = t.dock;
  fronts.forEach((e, k) => {
    // An office front (a 'works' hall: the office and canteen along the street) takes one end of the main front: a
    // lighter panel block with a ribbon window per storey and a glazed entrance; the doors take the rest.
    let free0 = 0;
    if (k === 0 && i.spec.officeFront && h >= 5) {
      const len = Math.max(8, Math.min(40, e.len * 0.4)), storeys = Math.max(1, Math.min(3, Math.floor((h - 0.8) / 3.3)));
      panel(e, 0.2, len, i.base + 0.6, i.base + Math.min(h - 0.6, storeys * 3.3 + 0.6), 0.05, t.office, out);
      for (let s = 0; s < storeys; s++) panel(e, 0.8, len - 0.6, i.base + 1.4 + s * 3.3, i.base + 2.8 + s * 3.3, 0.08, t.glass, out);
      panel(e, len - 3.2, len - 1.0, i.base, i.base + 2.6, 0.09, t.glass, out);
      free0 = len + 1;
    }
    const dock2 = i.spec.doors === 'dock', w = dock2 ? 3.0 : 4.0, dh = Math.min(dock2 ? 3.2 : 4.5, h - 1.4), step = dock2 ? 4.5 : 9;
    if (dh < 2.2 || e.len - free0 < 7) return;
    const room = e.len - free0, n = Math.max(1, Math.min(dock2 ? 10 : 5, Math.floor((room - 4) / step)));
    const start = free0 + (room - (n - 1) * step) / 2;
    for (let d = 0; d < n; d++) {
      const c = start + d * step, z0 = i.base + (dock2 ? 1.1 : 0);
      if (dock2) panel(e, c - w / 2 - 0.35, c + w / 2 + 0.35, z0 - 0.1, z0 + dh + 0.4, 0.06, dock, out);
      panel(e, c - w / 2, c + w / 2, z0, z0 + dh, 0.1, door, out);
    }
    if (k === 0) {
      // A personnel door beside the first door.
      const a = start - Math.min(step / 2, 3) - 0.5;
      if (a - 0.5 > free0 && a + 0.5 < e.len - 0.5) panel(e, a - 0.5, a + 0.5, i.base, i.base + 2.2, 0.06, t.personnel, out);
      if (i.spec.ribbon && !i.spec.officeFront && h >= 6) {
        const r0 = free0 + room * 0.15, r1 = free0 + room * (0.45 + hash01(`${i.id}:ribbon-len`) * 0.3), z = i.base + Math.max(dh + 1.6, h * 0.62);
        if (z + 0.9 < i.top - 0.6) panel(e, r0, r1, z, z + 0.9, 0.04, t.glass, out);
      }
    }
  });
  return out;
}
