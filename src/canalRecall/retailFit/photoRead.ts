// The typed per-opening photo read (lane retail-fit-20261120): what a reader measured or saw in ONE opening of a
// modelled host on a dated city panorama, and the in-opening layers it becomes. Reads are staged in retail-fits.json,
// one record per opening, with the panorama it was read on; a model's reads draw by default only once its blind A/B
// has been won (`status: 'published'`), staged reads draw under `?retailFit=1` for review.
import type { FitLayer, HostOpening } from './types.js';

/** A measured opening staged with its model (stage-openings.ts, from the GLB): the runtime draws in it without finding
 *  glass, so a city-look material swap or a merged chunk cannot hide it. `pand`: a street chunk's pand index (its range in
 *  the GLB's pandRanges), so the fit lifts with that pand's own ground base. */
export type StoredOpening = HostOpening & { pand?: number };

export type ReadLetters =
  /** Letters in the arch head (lunette), optional dark ground behind them. */
  | { where: 'head'; text: string; ink: string; bg?: string }
  /** Letters on the glass `v` m above the sill, optional square mark. */
  | { where: 'glass'; text: string; ink: string; v: number; heightM?: number; mark?: string }
  /** A lettered band (vinyl strip or small board) from `v0` to `v1` m above the sill. */
  | { where: 'band'; text?: string; ink?: string; hex: string; v0: number; v1: number; inset?: number };

export interface OpeningRead {
  /** Median sRGB of the glass on the panorama crop (glass-tone.ts): the room seen through it. */
  glass: string;
  /** Only part of the height reads as that tone (metres above the sill). */
  glassV?: [number, number];
  goods?: { kind: 'tables' | 'shelves' | 'rails' | 'seats' | 'curtains' | 'sleeves'; hexes: string[] };
  lamps?: { hex: string; n?: number };
  vinyl?: Omit<Extract<FitLayer, { k: 'vinyl' }>, 'k'>;
  posters?: { hex: string; n: number };
  panel?: Omit<Extract<FitLayer, { k: 'panel' }>, 'k'>;
  letters?: ReadLetters[];
  frame?: { hex: string; transom?: boolean; mullions?: number };
  door?: { hex: string; leaves: 1 | 2 };
}

export interface StagedFit {
  /** The opening's point on the facade line (lng, lat): the fit claims the nearest found opening within 2.5 m. */
  at: [number, number];
  /** Or a staged opening's id (a street chunk has no surveyed frame: its fits name the opening directly). */
  opening?: string;
  tenant: string;
  /** OSM node and the panorama(s) it was read on. */
  source: string;
  read: OpeningRead;
}

export interface StagedModel {
  /** 'published': drawn by default; 'staged': drawn only with `?retailFit=1`, awaiting its blind A/B. */
  status: 'published' | 'staged';
  /** The blind A/B that published it (date, tally, judge), or why it is held. */
  review: string;
  fits: StagedFit[];
  /** Openings measured offline from the GLB (GLB frame, metres); absent = found on the model's glass at run time. */
  openings?: StoredOpening[];
}

/** The layers of one read, in drawing order (back to front). */
export function layersOfRead(r: OpeningRead): FitLayer[] {
  const out: FitLayer[] = [];
  if (r.panel) { out.push({ k: 'panel', ...r.panel }); }
  else {
    out.push(r.glassV ? { k: 'interior', hex: r.glass, v0: r.glassV[0], v1: r.glassV[1] } : { k: 'interior', hex: r.glass });
    if (r.goods) out.push({ k: 'goods', ...r.goods });
    if (r.lamps) out.push({ k: 'lamps', ...r.lamps });
    if (r.vinyl) out.push({ k: 'vinyl', ...r.vinyl });
    if (r.posters) out.push({ k: 'posters', ...r.posters });
  }
  for (const L of r.letters ?? []) {
    if (L.where === 'head') out.push({ k: 'head-letters', text: L.text, ink: L.ink, ...(L.bg ? { bg: L.bg } : {}) });
    else if (L.where === 'glass') out.push({ k: 'glass-letters', text: L.text, ink: L.ink, v: L.v, ...(L.heightM ? { heightM: L.heightM } : {}), ...(L.mark ? { mark: L.mark } : {}) });
    else { const { where: _w, ...band } = L; out.push({ k: 'band', ...band }); }
  }
  if (r.frame) out.push({ k: 'frame', ...r.frame });
  if (r.door) out.push({ k: 'door', ...r.door });
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Problems with a staged file (empty when sound): hex colours, points, a source and a glass tone on every read. */
export function checkStaged(models: Record<string, StagedModel>): string[] {
  const bad: string[] = [];
  const hexes = (v: unknown, path: string): void => {
    if (typeof v === 'string') { if (v.startsWith('#') && !HEX.test(v)) bad.push(`${path}: ${v}`); }
    else if (Array.isArray(v)) v.forEach((x, i) => hexes(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) hexes(x, `${path}.${k}`);
  };
  for (const [id, m] of Object.entries(models)) {
    if (m.status !== 'published' && m.status !== 'staged') bad.push(`${id}: status ${m.status}`);
    if (!m.review) bad.push(`${id}: no review note`);
    m.fits.forEach((f, i) => {
      const p = `${id}[${i}] ${f.tenant}`;
      if (f.opening) { if (!m.openings?.some(o => o.id === f.opening)) bad.push(`${p}: no staged opening ${f.opening}`); }
      else if (!(f.at[0] > 4.7 && f.at[0] < 5.1 && f.at[1] > 52.27 && f.at[1] < 52.45)) bad.push(`${p}: point outside Amsterdam`);
      if (!f.source) bad.push(`${p}: no source`);
      if (!HEX.test(f.read.glass)) bad.push(`${p}: glass tone`);
      hexes(f.read, p);
    });
  }
  return bad;
}
