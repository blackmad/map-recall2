/**
 * Galleries (intent `gallery`): an open veranda stacked in front of a span of bays, one deck per listed storey, its
 * front carried on posts with an arch between each pair under a beam, and a balustrade along each deck. The 1905
 * apartment villas on the south edge of the Vondelpark (Koninginneweg 1 / Van Eeghenstraat 222-230, panoramas
 * 2022-03-22 w02-245w and 2023-01-10 w07-160/w08-160): white timber verandas of round arches on slender posts with
 * turned balustrades, three decks high across the Van Eeghenstraat front, and a two-deck loggia over a stone arcade on
 * the Koninginneweg front. Balconies (a slab and a rail per bay), loggias (cut into the wall) and arcade piers (a pier
 * band without decks) cannot say it.
 *
 * Measures are fractions (the intent contract has no metric fields): the projection of the storey height, the post of
 * the arch pitch, the arch rise of half its span. Geometry, all closed solids in one part per gallery that touches the
 * wall through its decks and its back posts:
 * - a deck slab per storey above the ground (or over the top storey: the roof deck), from the wall to the front;
 * - front posts at both ends and between the arches, back posts against the wall at both ends;
 * - a beam under the next deck across the front, recessed 5 cm behind the post faces, and a side beam at each end;
 * - per arch, the spandrel between the arch curve and the beam as `ARCH_STRIPS` closed strips, 5 cm behind the beam face;
 * - the balustrade between the posts, 4 cm behind their faces: a bottom and a top rail and balusters (or one iron sheet).
 * The posts, beam and spandrels stand on separate planes (5 cm apart), so no two faces are coplanar.
 */
import {solid, type PanelCtx} from './compose.ts';
import {fitsPanel, rectPoly} from './panels.ts';
import type {V3} from './mesh.ts';

export const GALLERY_ARCHES = ['round', 'segmental', 'flat'] as const;
export const GALLERY_RAILS = ['balusters', 'bars', 'none'] as const;

/** Intent (`walls[i].gallery`): one gallery, or several (a stone arcade under a timber loggia). */
export interface GalleryIntent {
  /** contiguous storeys, one deck each (0 = ground: the gallery stands on the ground, no deck under it) */
  storeys: number[];
  /** [first, last] bay of the span on the main panel (of `baysPerStorey`; default the whole panel) */
  bays?: [number, number];
  /** arches across the span per storey (default one per bay of the span) */
  arches?: number;
  /** arch head: `round` (default), `segmental` (a third of a round arch's rise) or `flat` (posts and beam only) */
  arch?: typeof GALLERY_ARCHES[number];
  /** projection as a fraction of the gallery's lowest storey height (0.15..0.7; default 0.45, about 1.9 m on a 4.2 m storey) */
  deep?: number;
  /** post width as a fraction of the arch pitch (0.03..0.35; default 0.06, a slender timber post; stone piers 0.15-0.25) */
  post?: number;
  /** balustrade along each deck: turned `balusters` (default), an iron sheet (`bars`) or `none` */
  rail?: typeof GALLERY_RAILS[number];
  /** a deck over the top storey (default true) */
  roof?: boolean;
  /** `stone`: drawn in the group's stone (a masonry arcade); default the gallery colour */
  stone?: boolean;
  /** the timber colour (#rrggbb; default the group's frame colour) */
  colour?: string;
  /** the balustrade's own colour (#rrggbb: black iron railings on a white loggia; default the gallery's) */
  railColour?: string;
}

/** Fitted (LargeGroupFit `gallery`): one entry per gallery with the defaults applied and its slot. */
export interface GalleryFit { /** the balustrade's slot when it has its own colour */ railSlot?: string; from: number; to: number; bays?: [number, number]; arches?: number; arch: typeof GALLERY_ARCHES[number]; deep: number; post: number; rail: typeof GALLERY_RAILS[number]; roof: boolean; slot: string }

/** Defaults and fixed sizes (m): deck slab, beam, rail heights, baluster pitch and size, minimum clear height under an arch. */
export const GALLERY = {deep: 0.45, post: 0.06, minPostM: 0.12, minDeepM: 0.8, maxDeepM: 2.6, slabM: 0.2, beamM: 0.22, railM: 0.95, railBarM: 0.08,
  balusterPitchM: 0.3, balusterM: 0.07, clearM: 2.0, segmental: 0.35, step: 0.05} as const;
/** Strips per arch spandrel (the curve's polyline segments). */
export const ARCH_STRIPS = 6;

const FIELDS = ['storeys', 'bays', 'arches', 'arch', 'deep', 'post', 'rail', 'roof', 'stone', 'colour', 'railColour'];

export function galleryProblems(gl: unknown, at: string, baysPerStorey: number | undefined, storeys: number | undefined): string[] {
  const list = Array.isArray(gl) ? gl : [gl];
  if (!list.length) return [`${at}: a gallery or a list of galleries`];
  return list.flatMap((g, i) => oneGalleryProblems(g, Array.isArray(gl) ? `${at}[${i}]` : at, baysPerStorey, storeys));
}

function oneGalleryProblems(g: unknown, at: string, baysPerStorey: number | undefined, storeys: number | undefined): string[] {
  const out: string[] = [];
  if (!g || typeof g !== 'object' || Array.isArray(g)) return [`${at}: object {${FIELDS.join(', ')}}`];
  const a = g as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!FIELDS.includes(k)) out.push(`${at}.${k}: unknown field (${FIELDS.join(', ')})`);
  const st = a.storeys;
  if (!Array.isArray(st) || !st.length || st.some(s => !Number.isInteger(s) || s < 0 || s > 39)) out.push(`${at}.storeys: list of storeys (0 = ground)`);
  else {
    if (st.some((s, i) => i > 0 && s !== st[i - 1] + 1)) out.push(`${at}.storeys: contiguous and ascending`);
    if (storeys !== undefined && st.some(s => s >= storeys)) out.push(`${at}.storeys: under storeys ${storeys}`);
  }
  if (a.bays !== undefined) {
    const b = a.bays;
    if (!Array.isArray(b) || b.length !== 2 || !b.every(x => Number.isInteger(x) && x >= 0) || b[1] < b[0]) out.push(`${at}.bays: [first, last] bay`);
    else if (baysPerStorey === undefined) out.push(`${at}.bays needs baysPerStorey`);
    else if (b[1] >= baysPerStorey) out.push(`${at}.bays: last bay under baysPerStorey ${baysPerStorey}`);
  }
  if (a.arches !== undefined && !(Number.isInteger(a.arches) && (a.arches as number) >= 1 && (a.arches as number) <= 40)) out.push(`${at}.arches: integer 1..40`);
  if (a.arch !== undefined && !GALLERY_ARCHES.includes(a.arch as never)) out.push(`${at}.arch: ${JSON.stringify(a.arch)} not in ${GALLERY_ARCHES.join('|')}`);
  if (a.rail !== undefined && !GALLERY_RAILS.includes(a.rail as never)) out.push(`${at}.rail: ${JSON.stringify(a.rail)} not in ${GALLERY_RAILS.join('|')}`);
  const num = (v: unknown, k: string, lo: number, hi: number) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) out.push(`${at}.${k}: number ${lo}..${hi}`); };
  num(a.deep, 'deep', 0.15, 0.7); num(a.post, 'post', 0.03, 0.35);
  for (const k of ['roof', 'stone']) if (a[k] !== undefined && typeof a[k] !== 'boolean') out.push(`${at}.${k}: boolean`);
  for (const k of ['colour', 'railColour']) if (a[k] !== undefined && !(typeof a[k] === 'string' && /^#[0-9a-f]{6}$/i.test(a[k] as string))) out.push(`${at}.${k}: #rrggbb`);
  if (a.colour !== undefined && a.stone === true) out.push(`${at}: colour and stone are alternatives`);
  return out;
}

/** Fit each gallery: storey range, the intent's fractions with defaults, and its slot (`stone`, else the timber slot). */
export function fitGallery(gl: GalleryIntent | GalleryIntent[], slots: {stone: string; timber: (k: number, colour: string | undefined) => string; rail?: (k: number, colour: string) => string}): GalleryFit[] {
  return (Array.isArray(gl) ? gl : [gl]).map((g, k) => ({...(g.railColour && slots.rail ? {railSlot: slots.rail(k, g.railColour)} : {}),from: g.storeys[0], to: g.storeys[g.storeys.length - 1], ...(g.bays ? {bays: [g.bays[0], g.bays[1]] as [number, number]} : {}),
    ...(g.arches !== undefined ? {arches: g.arches} : {}), arch: g.arch ?? 'round', deep: g.deep ?? GALLERY.deep, post: g.post ?? GALLERY.post, rail: g.rail ?? 'balusters',
    roof: g.roof !== false, slot: g.stone ? slots.stone : slots.timber(k, g.colour)}));
}

/** The arch curve over a clear span [l, r] springing at `vs` with rise `rise`, left to right, `ARCH_STRIPS` + 1 points (an elliptical arc). */
export function archCurve(l: number, r: number, vs: number, rise: number): [number, number][] {
  const uc = (l + r) / 2, half = (r - l) / 2;
  return Array.from({length: ARCH_STRIPS + 1}, (_, k) => { const t = Math.PI * (1 - k / ARCH_STRIPS); return [uc + half * Math.cos(t), vs + rise * Math.sin(t)] as [number, number]; });
}

/** Baluster centres along [a, b] at about `pitch`, at least one, inset half a pitch from both ends. */
export function balusterCentres(a: number, b: number, pitch: number = GALLERY.balusterPitchM): number[] {
  const n = Math.floor((b - a) / pitch);
  if (n < 1) return [];
  const step = (b - a) / n;
  return Array.from({length: n}, (_, k) => a + step * (k + 0.5));
}

/**
 * Draws one gallery on the main panel across its bay span (of the panel's even `bays`-way division), from the storey
 * line `from` to the line over `to` (clipped to the panel and `topM`). Returns the decks drawn (0 when it does not fit).
 */
export function drawGallery(c: PanelCtx, levels: number[], gf: GalleryFit, bays: number, topM: number): number {
  const p = c.p, W = p.uMax - p.uMin, a = gf.bays ? p.uMin + (gf.bays[0] * W) / bays : p.uMin, b = gf.bays ? p.uMin + ((gf.bays[1] + 1) * W) / bays : p.uMax;
  const base = Math.max(0, p.vMin), G = GALLERY, slot = gf.slot;
  const lo = Math.max(base, levels[gf.from] ?? base), hiRaw = Math.min(topM, levels[gf.to + 1] ?? topM);
  const firstH = Math.min(topM, levels[gf.from + 1] ?? topM) - lo;
  if (b - a < 1.5 || hiRaw - lo < 2.4 || !(firstH > 0)) return 0;
  const n = gf.arches ?? Math.max(1, (gf.bays ? gf.bays[1] - gf.bays[0] + 1 : bays)), pitch = (b - a) / n;
  const D = Math.min(G.maxDeepM, Math.max(G.minDeepM, gf.deep * firstH)), pw = Math.max(G.minPostM, gf.post * pitch);
  // the roof deck is the top of the last storey (its slab under the storey line)
  const roof = gf.roof ? hiRaw : null;
  if (!fitsPanel(p, rectPoly(a, b, lo, hiRaw - 0.02))) return 0;
  const part = c.part();
  const box = (u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) => solid(c, slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? d1 : d0) as V3, part);
  // post centres: flush with the span ends, evenly between
  const posts = Array.from({length: n + 1}, (_, k) => Math.min(b - pw / 2, Math.max(a + pw / 2, a + k * pitch)));
  // planes (d, m off the wall): deck front, post faces 4 cm behind it, beam and arch spandrels a step behind those, the balustrade 3 cm behind the posts
  const front = D, pf = D - 0.04, pb = pf - pw, beamFace = pf - G.step, archFace = pf - 2 * G.step, railFace = pf - 0.03;
  let decks = 0;
  for (let s = gf.from; s <= gf.to; s++) {
    const v0 = s === gf.from ? lo : Math.max(base, levels[s]), v1 = s === gf.to ? hiRaw : Math.min(topM, levels[s + 1] ?? topM);
    if (v1 - v0 < 2.4) continue;
    // deck: on the storey line (none on the ground)
    const onGround = v0 <= base + 0.3, floor = onGround ? v0 : v0 + 0.02;
    if (!onGround) box(a, b, v0 - G.slabM + 0.02, v0 + 0.02, 0, front);
    // under the next deck (or the roof deck): the posts run up into it by 2 cm
    const ceil = s < gf.to || roof !== null ? v1 - G.slabM + 0.02 : v1 - 0.02;
    for (const u of posts) box(u - pw / 2, u + pw / 2, floor - 0.02, ceil + 0.02, pb, pf);
    // back posts against the wall at both ends, and a side beam joining them to the front posts
    for (const u of [posts[0], posts[n]]) box(u - pw / 2, u + pw / 2, floor - 0.02, ceil + 0.02, 0, pw);
    const beam0 = ceil - G.beamM;
    if (beam0 - floor < G.clearM) { decks++; continue; }
    box(a + 0.02, b - 0.02, beam0, ceil + 0.01, pb + 0.02, beamFace);
    for (const u of [posts[0], posts[n]]) box(u - pw / 2 + 0.02, u + pw / 2 - 0.02, beam0, ceil + 0.01, pw - 0.02, pb + 0.04);
    // arch spandrels between the posts, under the beam
    if (gf.arch !== 'flat') for (let k = 0; k < n; k++) {
      const l = posts[k] + pw / 2 - 0.02, r = posts[k + 1] - pw / 2 + 0.02, half = (r - l) / 2;
      const want = gf.arch === 'round' ? half : half * G.segmental, rise = Math.min(want, beam0 - floor - G.clearM);
      if (rise < 0.15 || r - l < 0.6) continue;
      const pts = archCurve(l, r, beam0 - rise, rise);
      for (let q = 0; q < ARCH_STRIPS; q++) {
        const [u0, w0] = pts[q], [u1, w1] = pts[q + 1];
        if (Math.max(w0, w1) > beam0 - 0.03) continue;
        solid(c, slot, (i, j, kk) => c.P(i ? u1 : u0, j ? beam0 + 0.02 : (i ? w1 : w0), kk ? archFace : Math.max(pb + 0.01, archFace - 0.1)) as V3, part);
      }
    }
    // balustrade between the posts
    const rs = gf.railSlot ?? slot, rbox = (u0: number, u1: number, w0: number, w1: number, d0: number, d1: number) => solid(c, rs, (i, j, k) => c.P(i ? u1 : u0, j ? w1 : w0, k ? d1 : d0) as V3, part);
    if (gf.rail !== 'none' && ceil - floor > G.railM + 0.6) for (let k = 0; k < n; k++) {
      const l = posts[k] + pw / 2 - 0.02, r = posts[k + 1] - pw / 2 + 0.02;
      if (r - l < 0.3) continue;
      const top = floor + G.railM;
      const back = Math.max(pb + 0.01, railFace - 0.1);
      if (gf.rail === 'bars') { rbox(l, r, floor, top, Math.max(pb + 0.01, railFace - 0.03), railFace); continue; }
      rbox(l, r, floor, floor + G.railBarM, back, railFace);
      rbox(l, r, top - G.railBarM, top, back, railFace);
      for (const u of balusterCentres(l + 0.02, r - 0.02)) rbox(u - G.balusterM / 2, u + G.balusterM / 2, floor + G.railBarM - 0.02, top - G.railBarM + 0.02, back + 0.01, railFace - 0.02);
    }
    decks++;
  }
  if (roof !== null && decks) box(a, b, roof - G.slabM + 0.02, roof + 0.02, 0, front);
  return decks;
}
