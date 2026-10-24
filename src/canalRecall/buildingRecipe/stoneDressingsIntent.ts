/**
 * Validation of a large-tier wall group's `dressings` (stone bands, speklagen, heads, surrounds, quoins, oriels, banded
 * arches, brick piers; geometry in blockBuilding/dressings.ts). Kept out of largeIntent.ts so that file does not grow.
 * Counts, storeys, bays and fractions only: no metres, no coordinates.
 */
import {DRESSING_BAND_AT, DRESSING_HEADS, type StoneDressings} from '../blockBuilding/dressings.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const KEYS = ['colour', 'bands', 'stripes', 'heads', 'surrounds', 'quoins', 'oriels', 'voussoirs', 'piers'];
const SUB: Record<string, string[]> = {
  bands: ['at', 'storeys', 'double'], stripes: ['storeys', 'count'], heads: ['kind', 'storeys'], surrounds: ['storeys', 'eared'],
  quoins: ['ends', 'joints'], oriels: ['bays', 'from', 'to', 'deep', 'canted'], voussoirs: ['storeys', 'jambs'], piers: ['w', 'from'],
};

/** Problems with `walls[i].dressings`; `storeys` is the group's storey count when the intent gives it. */
export function stoneDressingsProblems(input: unknown, at: string, storeys?: number): string[] {
  if (input === undefined) return [];
  const p: string[] = [], d = input as Record<string, unknown>;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return [`${at}.dressings: an object {${KEYS.join(', ')}}`];
  for (const k of Object.keys(d)) if (!KEYS.includes(k)) p.push(`${at}.dressings.${k}: unknown field (${KEYS.join(', ')})`);
  if (!KEYS.some(k => k !== 'colour' && d[k] !== undefined)) p.push(`${at}.dressings: name at least one dressing`);
  const max = storeys ? storeys - 1 : 39;
  const storeyList = (v: unknown, where: string, min = 0) => {
    if (!Array.isArray(v) || !v.length || v.some(s => !Number.isInteger(s) || s < min || s > max)) p.push(`${where}: list of storeys ${min}..${max}`);
  };
  const obj = (k: string): Record<string, unknown> | null => {
    const o = d[k];
    if (o === undefined) return null;
    if (!o || typeof o !== 'object' || Array.isArray(o)) { p.push(`${at}.dressings.${k}: an object {${SUB[k].join(', ')}}`); return null; }
    for (const x of Object.keys(o)) if (!SUB[k].includes(x)) p.push(`${at}.dressings.${k}.${x}: unknown field (${SUB[k].join(', ')})`);
    return o as Record<string, unknown>;
  };
  const bool = (v: unknown, where: string) => { if (v !== undefined && typeof v !== 'boolean') p.push(`${where}: true or false`); };
  if (d.colour !== undefined && (typeof d.colour !== 'string' || !HEX.test(d.colour))) p.push(`${at}.dressings.colour: a #rrggbb colour`);
  const b = obj('bands');
  if (b) {
    if (!Array.isArray(b.at) || !b.at.length || b.at.some(x => !(DRESSING_BAND_AT as readonly string[]).includes(x as string)) || new Set(b.at).size !== b.at.length) p.push(`${at}.dressings.bands.at: some of ${DRESSING_BAND_AT.join(', ')}`);
    if (b.storeys !== undefined) storeyList(b.storeys, `${at}.dressings.bands.storeys`);
    bool(b.double, `${at}.dressings.bands.double`);
  }
  const s = obj('stripes');
  if (s) {
    storeyList(s.storeys, `${at}.dressings.stripes.storeys`);
    if (s.count !== undefined && !(Number.isInteger(s.count) && (s.count as number) >= 1 && (s.count as number) <= 8)) p.push(`${at}.dressings.stripes.count: 1..8 stone courses per storey`);
  }
  const h = obj('heads');
  if (h) {
    if (!(DRESSING_HEADS as readonly string[]).includes(h.kind as string)) p.push(`${at}.dressings.heads.kind: one of ${DRESSING_HEADS.join(', ')}`);
    if (h.storeys !== undefined) storeyList(h.storeys, `${at}.dressings.heads.storeys`);
  }
  const sr = obj('surrounds');
  if (sr) { if (sr.storeys !== undefined) storeyList(sr.storeys, `${at}.dressings.surrounds.storeys`); bool(sr.eared, `${at}.dressings.surrounds.eared`); }
  if (h && sr && h.kind !== 'keystone') p.push(`${at}.dressings.heads: only "keystone" together with surrounds (the surround has its own head)`);
  const q = obj('quoins');
  if (q) {
    bool(q.ends, `${at}.dressings.quoins.ends`);
    if (q.joints !== undefined && (!Array.isArray(q.joints) || !q.joints.length || q.joints.some(j => !Number.isInteger(j) || j < 1 || j > 99))) p.push(`${at}.dressings.quoins.joints: list of bays 1..99 (the joint left of that bay)`);
    if (!q.ends && !q.joints) p.push(`${at}.dressings.quoins: ends and/or joints`);
  }
  const o = obj('oriels');
  if (o) {
    if (!Array.isArray(o.bays) || !o.bays.length || o.bays.some(x => !Number.isInteger(x) || x < 0 || x > 99)) p.push(`${at}.dressings.oriels.bays: list of bays 0..99 (from the viewer's left on the widest panel)`);
    const from = o.from as number, to = o.to as number;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > max) p.push(`${at}.dressings.oriels: 1 <= from <= to <= ${max} (storeys; the ground keeps its own row)`);
    if (o.deep !== undefined && !(typeof o.deep === 'number' && o.deep >= 0.1 && o.deep <= 0.6)) p.push(`${at}.dressings.oriels.deep: 0.1..0.6 of the oriel's width`);
    bool(o.canted, `${at}.dressings.oriels.canted`);
  }
  const v = obj('voussoirs');
  if (v) { if (v.storeys !== undefined) storeyList(v.storeys, `${at}.dressings.voussoirs.storeys`); bool(v.jambs, `${at}.dressings.voussoirs.jambs`); }
  const pr = obj('piers');
  if (pr) {
    if (pr.w !== undefined && !(typeof pr.w === 'number' && pr.w >= 0.08 && pr.w <= 0.5)) p.push(`${at}.dressings.piers.w: 0.08..0.5 of the bay`);
    if (pr.from !== undefined && !(Number.isInteger(pr.from) && (pr.from as number) >= 0 && (pr.from as number) <= max)) p.push(`${at}.dressings.piers.from: a storey 0..${max}`);
  }
  return p;
}

export type {StoneDressings};
