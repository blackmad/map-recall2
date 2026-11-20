// Who is behind which opening (lane retail-fit-20261120). Two sources, strongest first:
//   1. HAND_FITS: an opening read on a dated panorama, one tenant and its own expression per arch (the Hirschgebouw).
//   2. TENANT_NODES: an OSM shop node (ODbL, Overpass 2026-11-14 cache) on a placed model; each ground opening within
//      NODE_REACH_M goes to its nearest node (a Voronoi split along the front), the node's chain style dresses it, and
//      the opening nearest the node carries the name.
// Both draw only inside openings the model already has (openings.ts); a tenant with no opening near it draws nothing.
import type { FitLayer, HostOpening, TenantFit } from './types.js';
import { openingAt } from './openings.js';

const FRAME = '#1e2124';
const APPLE: FitLayer[] = [{ k: 'interior', hex: '#565a5c' }, { k: 'goods', kind: 'tables', hexes: ['#c8a678', '#6b5a45', '#dfe8f0'] }, { k: 'lamps', hex: '#f2efe6' }, { k: 'frame', hex: FRAME, transom: true }];
const APPLE_DOOR: FitLayer[] = [{ k: 'interior', hex: '#4e5355' }, { k: 'frame', hex: FRAME, transom: true }, { k: 'door', hex: FRAME, leaves: 2 }];
const AH_SHELVES = ['#cfcac0', '#5f86a8', '#a8695f', '#bfae70', '#7b9a6a', '#b9b4aa', '#8a8d90'];
const AH_GOODS: FitLayer[] = [{ k: 'interior', hex: '#63676a' }, { k: 'goods', kind: 'shelves', hexes: AH_SHELVES }];

/** Leidseplein 25, the Hirschgebouw arcade (pand 0363100012165488, model `hirschgebouw`). Points are the arch centres on
 *  the BAG facade lines (hirschgebouw-builder.ts bays). Read on the rectified 2025-07-14 panoramas
 *  (recording_2025-07-14_05-25-22_01947..02002), b_20250129_0912_Track04_Sphere_00044-00048 and David's 2025-08 shot. */
const HIRSCH = 'hirschgebouw';
const H_PANO = 'Gemeente Amsterdam panoramas 2025-07-14 (recording_2025-07-14_05-25-22_*) and 2025-01-29 (b_20250129_0912_Track04_*)';
export const HAND_FITS: readonly TenantFit[] = [
  // Leidseplein front, corner to SW (nw bays 0-7).
  { model: HIRSCH, at: [4.882457, 52.363596], tenant: 'Apple Store (door)', layers: APPLE_DOOR, source: `OSM n1660329431; ${H_PANO}` },
  { model: HIRSCH, at: [4.882388, 52.363564], tenant: 'Apple Store', layers: APPLE, source: `OSM n1660329431; ${H_PANO}` },
  { model: HIRSCH, at: [4.88232, 52.363532], tenant: 'Apple Store', layers: APPLE, source: `OSM n1660329431; ${H_PANO}` },
  { model: HIRSCH, at: [4.882252, 52.3635], tenant: 'Shop at Rijksmuseum', source: `${H_PANO}; David's photo 2025-08 (no OSM node yet)`,
    layers: [{ k: 'interior', hex: '#6c7176' }, { k: 'vinyl', base: '#dfe6ef', ink: '#2b4a8f', pattern: 'delft', window: [0.3, 0.72, 0.8, 2.3] }, { k: 'band', hex: '#1d2c5a', v0: 0.15, v1: 0.72, text: 'RIJKS MUSEUM', ink: '#ffffff' }, { k: 'frame', hex: FRAME }] },
  { model: HIRSCH, at: [4.882183, 52.363467], tenant: 'entrance (glass doors)', source: H_PANO,
    layers: [{ k: 'interior', hex: '#5a5e60' }, { k: 'frame', hex: FRAME, transom: true }, { k: 'door', hex: FRAME, leaves: 2 }] },
  { model: HIRSCH, at: [4.882115, 52.363435], tenant: 'Albert Heijn (door)', source: `OSM n2730036379; ${H_PANO}`,
    layers: [...AH_GOODS, { k: 'frame', hex: FRAME, transom: true }, { k: 'door', hex: FRAME, leaves: 2 }] },
  { model: HIRSCH, at: [4.882047, 52.363403], tenant: 'Albert Heijn', source: `OSM n2730036379; ${H_PANO}`,
    layers: [...AH_GOODS, { k: 'posters', hex: '#00a0e2', n: 1 }, { k: 'frame', hex: FRAME, transom: true }] },
  { model: HIRSCH, at: [4.881977, 52.363371], tenant: 'Albert Heijn (entrance)', source: `OSM n2730036379; b_20250129_0912_Track04_Sphere_00044`,
    layers: [...AH_GOODS, { k: 'posters', hex: '#00a0e2', n: 2 }, { k: 'head-letters', text: 'ALBERT HEIJN', ink: '#7cc6ee', bg: '#22313d' }, { k: 'frame', hex: FRAME, transom: true }, { k: 'door', hex: FRAME, leaves: 2 }] },
  // Kleine-Gartmanplantsoen front, corner to SE (ne bays 0-6).
  { model: HIRSCH, at: [4.882653, 52.363579], tenant: 'Apple Store (door)', layers: APPLE_DOOR, source: H_PANO },
  { model: HIRSCH, at: [4.882705, 52.363537], tenant: 'Apple Store', layers: APPLE, source: H_PANO },
  { model: HIRSCH, at: [4.882756, 52.363496], tenant: 'Apple Store', layers: APPLE, source: 'TMX7316010203-001900_pano_0004_000052 (2020) and 2025-07-14 w02-52' },
  { model: HIRSCH, at: [4.882807, 52.363455], tenant: 'Apple Store (inferred: occluded)', layers: APPLE, source: 'inferred from the risalit pair' },
  { model: HIRSCH, at: [4.882859, 52.363413], tenant: 'Geldmaat', source: H_PANO,
    layers: [{ k: 'panel', hex: '#d3d0c8', atms: 3, text: 'GELDMAAT', ink: '#59626b' }, { k: 'frame', hex: '#6b6e70' }] },
  { model: HIRSCH, at: [4.882913, 52.363369], tenant: 'ABN AMRO (door)', source: `OSM n2730036232; ${H_PANO}`,
    layers: [{ k: 'interior', hex: '#a3a7a2' }, { k: 'frame', hex: '#55595b', transom: true }, { k: 'door', hex: '#55595b', leaves: 2 }] },
  { model: HIRSCH, at: [4.882965, 52.363327], tenant: 'ABN AMRO', source: `OSM n2730036232; ${H_PANO}`,
    layers: [{ k: 'interior', hex: '#b9bdb8' }, { k: 'goods', kind: 'seats', hexes: ['#3d6f72', '#2f5a5d'] }, { k: 'glass-letters', text: 'ABN AMRO', ink: '#ffffff', v: 3.35, heightM: 0.3, mark: '#00857a' }, { k: 'frame', hex: '#55595b', transom: true }] },
  // The round corner: four glass facets, Apple.
  ...[[4.88254, 52.363626], [4.882555, 52.363626], [4.882569, 52.363625], [4.882584, 52.363622]].map(at => ({ model: HIRSCH, at: at as [number, number], tenant: 'Apple Store (corner)', layers: [{ k: 'interior', hex: '#565a5c' } as FitLayer], source: H_PANO })),
];

/** A chain's in-opening look: what fills every opening it holds, and how its name is shown in one of them. */
export type ChainStyle = { fill: FitLayer[]; name: string; ink: string; mark?: string; bg?: string };
export const CHAIN_STYLES: Readonly<Record<string, ChainStyle>> = {
  ah: { fill: AH_GOODS, name: 'ALBERT HEIJN', ink: '#00a0e2' },
  tkmaxx: { fill: [{ k: 'interior', hex: '#c4bfb5' }, { k: 'goods', kind: 'rails', hexes: ['#2b2b2b', '#b0303a', '#d8d2c8', '#3a5a8a', '#6f6a60'] }], name: 'TK MAXX', ink: '#c8102e' },
  primark: { fill: [{ k: 'interior', hex: '#c9c6bf' }, { k: 'goods', kind: 'rails', hexes: ['#2b2b2b', '#e8e2d6', '#8a2f3c', '#3d5f8f'] }], name: 'PRIMARK', ink: '#0daadd' },
  uniqlo: { fill: [{ k: 'interior', hex: '#d0ccc4' }, { k: 'goods', kind: 'rails', hexes: ['#2b2b2b', '#e8e2d6', '#c23b32', '#2f4f7a', '#8a8378'] }], name: 'UNIQLO', ink: '#e60012', mark: '#e60012' },
};

/** OSM shop nodes standing on placed models, by model (cache .cache/retail-ground/overpass.json, 2026-11-14). */
export type TenantNode = { model: string; osm: string; name: string; style: keyof typeof CHAIN_STYLES; at: [number, number] };
export const TENANT_NODES: readonly TenantNode[] = [
  { model: 'kinkerstraat-89', osm: 'n494157341', name: 'Albert Heijn, Kinkerstraat 89', style: 'ah', at: [4.8703682, 52.366607] },
  { model: 'brand-bij-ca', osm: 'n2721723259', name: 'TK Maxx, Damrak 79', style: 'tkmaxx', at: [4.8944059, 52.374496] },
  { model: 'brand-bij-ca', osm: 'n4476492417', name: 'Primark, Damrak 77', style: 'primark', at: [4.8946536, 52.3745699] },
  { model: 'nieuw-engeland', osm: 'n11160879679', name: 'Uniqlo', style: 'uniqlo', at: [4.8892337, 52.3672249] },
  { model: 'nieuw-engeland', osm: 'n11160879680', name: 'Albert Heijn', style: 'ah', at: [4.8889015, 52.3671122] },
];
/** An opening further than this from every node of its model is nobody's (m). */
export const NODE_REACH_M = 12;

/** Node-only fills (a chain style spread over the openings nearest an OSM node, no photo read) LOST the 2026-11-20
 *  blind A/B (Damrak and Nieuw Engeland to plain glass, Kinkerstraat a tie: too bright, invented rails and signs), so
 *  the pilot ships only photo-read hand fits. Kept for a later photo-read pass; flip only after a new blind win. */
export const NODE_FILLS_ENABLED = false;
export const RETAIL_FIT_MODELS: ReadonlySet<string> = new Set([...HAND_FITS.map(f => f.model), ...(NODE_FILLS_ENABLED ? TENANT_NODES.map(n => n.model) : [])]);

/** The layers for each opening of `model`: hand fits first (each claims the opening nearest its point), then the node
 *  split over the rest. `toNative` maps (lng, lat) to the model's plan (x, z). */
export function fitsForModel(model: string, openings: readonly HostOpening[], toNative: (lng: number, lat: number) => [number, number], nodeFills = false): Array<{ op: HostOpening; tenant: string; layers: FitLayer[]; source: string }> {
  const out: Array<{ op: HostOpening; tenant: string; layers: FitLayer[]; source: string }> = [];
  const taken = new Set<string>();
  for (const f of HAND_FITS) {
    if (f.model !== model) continue;
    const [x, z] = toNative(f.at[0], f.at[1]), op = openingAt(openings.filter(o => !taken.has(o.id)), x, z, 2.5);
    if (!op) continue;
    taken.add(op.id); out.push({ op, tenant: f.tenant, layers: f.layers, source: f.source });
  }
  const nodes = TENANT_NODES.filter(n => (NODE_FILLS_ENABLED || nodeFills) && n.model === model).map(n => ({ n, p: toNative(n.at[0], n.at[1]) }));
  if (!nodes.length) return out;
  const cells = new Map<TenantNode, Array<{ op: HostOpening; d: number }>>();
  for (const op of openings) {
    if (taken.has(op.id)) continue;
    let best: (typeof nodes)[number] | null = null, bd = NODE_REACH_M;
    for (const q of nodes) { const d = Math.hypot(q.p[0] - op.base[0], q.p[1] - op.base[2]); if (d < bd) { bd = d; best = q; } }
    if (!best) continue;
    let l = cells.get(best.n); if (!l) cells.set(best.n, l = []); l.push({ op, d: bd });
  }
  for (const [n, list] of cells) {
    const style = CHAIN_STYLES[n.style], named = list.reduce((a, b) => (b.d < a.d ? b : a)).op;
    for (const { op } of list) {
      const sign: FitLayer[] = op !== named ? [] : op.head === 'round' ? [{ k: 'head-letters', text: style.name, ink: style.ink, ...(style.bg ? { bg: style.bg } : {}) }]
        : [{ k: 'glass-letters', text: style.name, ink: style.ink, v: Math.max(1.9, op.crownM - op.sillM - 0.55), heightM: 0.32, ...(style.mark ? { mark: style.mark } : {}) }];
      out.push({ op, tenant: n.name, layers: [...style.fill, ...sign, { k: 'frame', hex: '#2a2d30' }], source: `OSM ${n.osm}` });
    }
  }
  return out;
}
