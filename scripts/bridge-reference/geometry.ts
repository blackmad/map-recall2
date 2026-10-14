// Bridge faces in RD New + NAP for the bridge reference feed (lane bridge-fidelity 2026-10-14).
//
// A measured deck (elevation-v1/bridges.json `measured`) gives its spine: the
// stations' centre line, the deck and water station ranges, the hump above
// the approach baseline (endpointNAP). A fallback footprint gives its ring and
// the crossing axis (the long axis, or a hand bearing where the bridge is
// wider than long). The face is the vertical plane along the deck axis at the
// half-width, on either side: what a boat on the canal sees.
import { readFileSync } from 'node:fs';
import { localToLngLat, type BridgeExtract, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

export type Rd = { x: number; y: number };
export type RegisterRow = { number: string; name: string; type: string; material: string; year: number; modality: string; street: string; ring: [number, number][] };

export interface BridgeFace {
  id: string;
  name: string;
  register: RegisterRow | null;
  measured: boolean;
  /** Deck midpoint (RD) and the unit deck axis u (along the road), unit normal n = left of u (along the water). */
  mid: Rd; u: Rd; n: Rd;
  halfWidth: number;
  /** Deck span along u, metres from `mid` (negative before). */
  deck: [number, number];
  /** Water span along u from `mid`, or null. */
  water: [number, number] | null;
  /** Deck top NAP along u: stations (along, NAP). Flat footprints: two stations at the approach level. */
  top: [number, number][];
  crownNAP: number;
  waterNAP: number;
  /** Footprint ring (RD). */
  ring: Rd[];
}

const EX = 'public/data/extracts/amsterdam/elevation-v1';
let cache: { index: ElevationIndex; extract: BridgeExtract; register: Map<string, RegisterRow> } | null = null;
export function sources() {
  if (cache) return cache;
  const index = JSON.parse(readFileSync(`${EX}/index.json`, 'utf8')) as ElevationIndex;
  const extract = JSON.parse(readFileSync(`${EX}/bridges.json`, 'utf8')) as BridgeExtract;
  const raw = JSON.parse(readFileSync('scripts/data/amsterdam-bridge-register.json', 'utf8')) as { fields: string[]; bridges: unknown[][] };
  const register = new Map<string, RegisterRow>();
  for (const b of raw.bridges) { const r = Object.fromEntries(raw.fields.map((f, i) => [f, b[i]])) as RegisterRow; if (r.number) register.set(r.number, r); }
  cache = { index, extract, register };
  return cache;
}

const rdOf = (index: ElevationIndex, x: number, y: number): Rd => { const q = index.quantization.xy; return lngLatToRd(localToLngLat(index, x * q, y * q)); };

/** Fallback footprints whose crossing is across their long axis: the crossing bearing (degrees from north), as in the own-ground bridges e2e. */
export const BEARING_OVERRIDE: Record<string, number> = { BRU0165: 96, BRU0009: 104 };

export function bridgeFace(id: string): BridgeFace | null {
  const { index, extract, register } = sources();
  const reg = register.get(id) ?? null, waterNAP = (index as any).waterLevelNAP ?? -0.4;
  const m = extract.measured.find(b => b.id === id);
  if (m) {
    const n = m.p.length / 4, st: { p: Rd; s: number; h: number }[] = [];
    for (let i = 0; i < n; i++) st.push({ p: rdOf(index, m.p[i * 4], m.p[i * 4 + 1]), s: m.p[i * 4 + 2] / 100, h: m.p[i * 4 + 3] / 100 });
    const sMid = (m.deck[0] + m.deck[1]) / 2;
    const at = (s: number): Rd => { let k = 1; while (k < n - 1 && st[k].s < s) k++; const a = st[k - 1], b = st[k], t = (s - a.s) / ((b.s - a.s) || 1); return { x: a.p.x + (b.p.x - a.p.x) * t, y: a.p.y + (b.p.y - a.p.y) * t }; };
    const mid = at(sMid), a = at(m.deck[0]), b = at(m.deck[1]), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }, nn = { x: -u.y, y: u.x };
    const total = st[n - 1].s;
    const top: [number, number][] = st.filter(q => q.s >= m.deck[0] - 3 && q.s <= m.deck[1] + 3).map(q => [q.s - sMid, m.endpointNAP[0] + (m.endpointNAP[1] - m.endpointNAP[0]) * q.s / total + q.h]);
    const ring: Rd[] = [];
    for (let i = 0; i < m.outline.length; i += 2) ring.push(rdOf(index, m.outline[i], m.outline[i + 1]));
    return { id, name: m.name || reg?.name || id, register: reg, measured: true, mid, u, n: nn, halfWidth: m.width / 2, deck: [m.deck[0] - sMid, m.deck[1] - sMid], water: m.water ? [m.water[0] - sMid, m.water[1] - sMid] : null, top, crownNAP: Math.max(...top.map(t => t[1])), waterNAP, ring };
  }
  const f = extract.fallback.find(b => b.id === id);
  if (!f) return null;
  const ring: Rd[] = [];
  for (let i = 0; i < f.ring.length; i += 2) ring.push(rdOf(index, f.ring[i], f.ring[i + 1]));
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length, cy = ring.reduce((s, p) => s + p.y, 0) / ring.length;
  let u: Rd;
  if (BEARING_OVERRIDE[id] !== undefined) { const b = BEARING_OVERRIDE[id] * Math.PI / 180; u = { x: Math.sin(b), y: Math.cos(b) }; }
  else {
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of ring) { sxx += (p.x - cx) ** 2; syy += (p.y - cy) ** 2; sxy += (p.x - cx) * (p.y - cy); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); u = { x: Math.cos(th), y: Math.sin(th) };
  }
  const nn = { x: -u.y, y: u.x };
  const al = ring.map(p => (p.x - cx) * u.x + (p.y - cy) * u.y), ac = ring.map(p => (p.x - cx) * nn.x + (p.y - cy) * nn.y);
  const a0 = Math.min(...al), a1 = Math.max(...al), c0 = Math.min(...ac), c1 = Math.max(...ac);
  const mid = { x: cx + nn.x * (c0 + c1) / 2 + u.x * (a0 + a1) / 2, y: cy + nn.y * (c0 + c1) / 2 + u.y * (a0 + a1) / 2 };
  const half = (a1 - a0) / 2, quay = waterNAP + 1.77;
  return { id, name: f.name || reg?.name || id, register: reg, measured: false, mid, u, n: nn, halfWidth: (c1 - c0) / 2, deck: [-half, half], water: [-half + 1, half - 1], top: [[-half - 3, quay], [half + 3, quay]], crownNAP: quay, waterNAP, ring };
}

/** Deck top NAP at `along` (metres from mid), linear between stations. */
export function topAt(face: BridgeFace, along: number): number {
  const t = face.top;
  if (along <= t[0][0]) return t[0][1];
  for (let k = 1; k < t.length; k++) if (t[k][0] >= along) { const r = (along - t[k - 1][0]) / ((t[k][0] - t[k - 1][0]) || 1); return t[k - 1][1] + (t[k][1] - t[k - 1][1]) * r; }
  return t[t.length - 1][1];
}
