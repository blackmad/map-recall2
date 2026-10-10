/**
 * Facade strip planning: which municipal panoramas rectify each pand's
 * frontage, so the whole block face becomes ONE continuous elevation at one
 * scale, one ground line and (as far as coverage allows) one capture date.
 *
 * One date matters: shops change, scaffolding comes and goes, trees leaf out.
 * The plan picks the capture day that sees the most frontages squarely (leaf-off
 * months and recency break ties) and only falls back to another day for a pand
 * that day does not cover; each span records the date it actually shows.
 */
import type {RD} from '../buildingRecipe/facts.ts';

export interface PanoRecord { panoId: string; timestamp: string; rd: RD; record: unknown }
export interface FrontSpan { pandId: string; a: RD; b: RD; normal: RD }
export interface PanoChoice { panoId: string; timestamp: string; distanceM: number; obliquityDeg: number }
export interface SpanPlan { pandId: string; date: string; fallback: boolean; panos: PanoChoice[] }
export interface StripPlan { date: string; spans: SpanPlan[]; coverage: number; candidatesByDate: Record<string, number> }

const day = (t: string) => t.slice(0, 10);
const leafOff = (t: string) => { const m = Number(t.slice(5, 7)); return m <= 4 || m >= 11; };

/** Panoramas that see a frontage (camera in front, 5-30 m from its midpoint, obliquity <= maxObliquity). */
export function panoCandidates(span: FrontSpan, panos: PanoRecord[], maxObliquityDeg = 45): (PanoChoice & {rd: RD})[] {
  const mid: RD = [(span.a[0] + span.b[0]) / 2, (span.a[1] + span.b[1]) / 2];
  return panos.flatMap(p => {
    const v = [p.rd[0] - mid[0], p.rd[1] - mid[1]], d = Math.hypot(v[0], v[1]), standoff = v[0] * span.normal[0] + v[1] * span.normal[1];
    if (standoff < 3 || d < 5 || d > 30) return [];
    const obl = Math.acos(Math.min(1, standoff / d)) * 180 / Math.PI;
    return obl <= maxObliquityDeg ? [{panoId: p.panoId, timestamp: p.timestamp, distanceM: +d.toFixed(1), obliquityDeg: +obl.toFixed(1), rd: p.rd}] : [];
  }).sort((x, y) => x.obliquityDeg - y.obliquityDeg);
}

/** Up to `perSpan` panoramas from one day, spread >= 2.5 m apart (occluders differ, so a median removes them). */
function pickFrom(cands: (PanoChoice & {rd: RD})[], date: string, perSpan: number): PanoChoice[] {
  const out: (PanoChoice & {rd: RD})[] = [];
  for (const c of cands) if (day(c.timestamp) === date && out.length < perSpan && out.every(o => Math.hypot(o.rd[0] - c.rd[0], o.rd[1] - c.rd[1]) > 2.5)) out.push(c);
  return out.map(({rd: _rd, ...rest}) => rest);
}

export function planStrip(spans: FrontSpan[], panos: PanoRecord[], options: {perSpan?: number; date?: string} = {}): StripPlan {
  const perSpan = options.perSpan ?? 3;
  const cands = spans.map(s => panoCandidates(s, panos));
  const dates = [...new Set(panos.map(p => day(p.timestamp)))];
  const covered = (date: string) => cands.filter(c => c.some(x => day(x.timestamp) === date && x.obliquityDeg <= 35)).length;
  const candidatesByDate = Object.fromEntries(dates.map(d => [d, covered(d)]));
  const ranked = [...dates].sort((a, b) => covered(b) - covered(a) || Number(leafOff(b)) - Number(leafOff(a)) || b.localeCompare(a));
  const date = options.date ?? ranked[0];
  const plans = spans.map((s, i) => {
    let picks = pickFrom(cands[i], date, perSpan), used = date;
    if (!picks.length) {
      const alt = ranked.find(d => d !== date && pickFrom(cands[i], d, 1).length);
      if (alt) { picks = pickFrom(cands[i], alt, perSpan); used = alt; }
    }
    return {pandId: s.pandId, date: used, fallback: used !== date, panos: picks};
  });
  return {date, spans: plans, coverage: plans.filter(p => p.panos.length && !p.fallback).length / Math.max(1, plans.length), candidatesByDate};
}

/** Per-channel median of RGBA crops (alpha 255 = valid sample); alpha 0 where no crop saw the pixel. */
export function medianFuse(crops: Uint8ClampedArray[], width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4), s: number[][] = [[], [], []];
  for (let i = 0; i < width * height; i++) {
    s.forEach(a => (a.length = 0));
    for (const c of crops) if (c[i * 4 + 3] === 255) for (let k = 0; k < 3; k++) s[k].push(c[i * 4 + k]);
    if (!s[0].length) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 128; continue; }
    for (let k = 0; k < 3; k++) { s[k].sort((a, b) => a - b); out[i * 4 + k] = s[k][s[k].length >> 1]; }
    out[i * 4 + 3] = 255;
  }
  return out;
}
