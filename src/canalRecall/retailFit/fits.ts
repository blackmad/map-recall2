// Who is behind which opening (lane retail-fit-20261120). Two sources, strongest first:
//   1. Staged photo reads (retail-fits.json, photoRead.ts): one record per opening read on a dated panorama. A model
//      whose blind A/B was won is 'published' and draws by default; 'staged' models draw only with `?retailFit=1`.
//   2. TENANT_NODES: an OSM shop node (ODbL, Overpass 2026-11-14 cache) on a placed model; each ground opening within
//      NODE_REACH_M goes to its nearest node and a chain style dresses it. OFF (NODE_FILLS_ENABLED): it lost its blind.
// Both draw only inside openings the model already has (openings.ts); a tenant with no opening near it draws nothing.
import type { FitLayer, HostOpening, TenantFit } from './types.js';
import { openingAt } from './openings.js';
import { layersOfRead, type StagedModel } from './photoRead.js';
import { retailFitMode, type RetailFitMode } from './flag.js';
import staged from './retail-fits.json';

export const STAGED_MODELS = (staged as unknown as { models: Record<string, StagedModel> }).models;

/** Every staged read as a fit (both statuses); `fitsForModel` filters by the mode. */
export const HAND_FITS: readonly (TenantFit & { status: StagedModel['status'] })[] = Object.entries(STAGED_MODELS).flatMap(([model, m]) =>
  m.fits.map(f => ({ model, at: f.at, tenant: f.tenant, source: f.source, layers: layersOfRead(f.read), status: m.status })));

/** Does `model` draw a fit in this mode? */
export const modelDraws = (model: string, mode: RetailFitMode): boolean =>
  mode !== 'off' && !!STAGED_MODELS[model] && (mode === 'all' || STAGED_MODELS[model].status === 'published');

/** A chain's in-opening look: what fills every opening it holds, and how its name is shown in one of them. */
export type ChainStyle = { fill: FitLayer[]; name: string; ink: string; mark?: string; bg?: string };
export const CHAIN_STYLES: Readonly<Record<string, ChainStyle>> = {
  ah: { fill: [{ k: 'interior', hex: '#303c41' }, { k: 'goods', kind: 'shelves', hexes: ['#8c897f', '#43607a', '#7a4c45', '#857a50', '#566d4b', '#7f7b74', '#5f6265'] }], name: 'ALBERT HEIJN', ink: '#00a0e2' },
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
/** Models that draw in `mode` (the default mode draws only published reads). */
export const modelsFor = (mode: RetailFitMode = retailFitMode()): Set<string> => new Set([...RETAIL_FIT_MODELS].filter(m => modelDraws(m, mode) || (NODE_FILLS_ENABLED && mode !== 'off' && TENANT_NODES.some(n => n.model === m))));

/** The layers for each opening of `model`: hand fits first (each claims the opening nearest its point), then the node
 *  split over the rest. `toNative` maps (lng, lat) to the model's plan (x, z). */
export function fitsForModel(model: string, openings: readonly HostOpening[], toNative: (lng: number, lat: number) => [number, number], nodeFills = false, mode: RetailFitMode = retailFitMode()): Array<{ op: HostOpening; tenant: string; layers: FitLayer[]; source: string }> {
  const out: Array<{ op: HostOpening; tenant: string; layers: FitLayer[]; source: string }> = [];
  const taken = new Set<string>();
  for (const f of HAND_FITS) {
    if (f.model !== model || !modelDraws(model, mode)) continue;
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
