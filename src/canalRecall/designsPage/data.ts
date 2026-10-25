// Building-design gallery (designs.html, GitHub #84): one card per repeated
// "building type" design (src/canalRecall/buildingTypes/types/*.json) with the
// houses the game places from it (public/canal-drive/building-types/instances.json),
// the municipal buurten those houses stand in, its variants, a small map and a
// link that starts the ride beside one of its houses. Pure: the build script
// reads the files and hands them over; template.ts renders the HTML.

import { buildHoods, inHood, rideUrl, type BoundaryInput, type LatLng } from '../buurtPages/data';

export interface DesignSpecInput {
  id: string; label?: string; storeys?: number;
  source?: { bouwjaar?: number[]; panden?: number };
  roof?: { form?: string };
  defaultVariant?: string;
  variants?: Record<string, { label?: string; palette?: { wall?: string | { slot?: string; tint?: string } } }>;
}
export interface DesignInstanceInput { pand: string; unit: string; variant?: string; anchor: [number, number] }
/** A municipal buurt outline (coverage-v1/buurten.json): [lng, lat] rings as GeoJSON stores them. */
export interface BuurtFeatureInput { properties: { code: string; name: string; wijk?: string; stadsdeel?: string }; geometry: { type: string; coordinates: number[][][] } }
export interface DesignImagesInput { photo?: string; photoSource?: string; photoPand?: string; render?: string; renderUnit?: string }

export interface DesignBuurt { code: string; name: string; wijk?: string; stadsdeel?: string; count: number }
export interface DesignVariant { key: string; label: string; wall?: string; count: number }
export interface DesignMap { width: number; height: number; outlines: string[]; dots: [number, number][]; scaleM: number; scalePx: number }
export interface Design {
  id: string; title: string; place: string; label: string;
  years?: [number, number]; storeys?: number; roof?: string;
  count: number;
  buurten: DesignBuurt[];
  stadsdelen: string[];
  /** Postcard neighbourhood pages (buurt/<slug>.html) that list this design. */
  pages: { name: string; slug: string }[];
  variants: DesignVariant[];
  ride?: { href: string; lng: number; lat: number; pand: string };
  images: DesignImagesInput;
  map?: DesignMap;
}
export interface DesignsInputs {
  specs: readonly DesignSpecInput[];
  instances: readonly DesignInstanceInput[];
  buurten: readonly BuurtFeatureInput[];
  boundaries: readonly BoundaryInput[];
  images: Readonly<Record<string, DesignImagesInput>>;
  /** Postcard page slugs that exist on disk; a page is linked only when it does. */
  pageSlugs?: ReadonlySet<string>;
}

const designOf = (unit: string) => unit.split('__')[0];

/** Index just past the parenthesis that opens at `open`, or -1. */
function closeParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')' && --depth === 0) return i + 1; }
  return -1;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function clip(s: string, max = 90): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max).replace(/[\s,;:(]+\S*$/, '');
  return `${cut}…`;
}

/**
 * A spec label ("Tuindorp Oostzaan-Oost (1936-38) two-storey terraced house in dark clinker brick, white eaves …") split into
 * where it was measured ("Tuindorp Oostzaan-Oost") and a short name for the design ("Two-storey terraced house in dark clinker brick").
 */
export function designTitle(label: string, fallback: string): { place: string; title: string } {
  const text = label.replace(/\s+/g, ' ').trim();
  if (!text) return { place: '', title: fallback };
  const firstSep = text.search(/ \(|:|,/);
  if (firstSep < 0) return { place: '', title: clip(cap(text)) };
  const place = text.slice(0, firstSep).trim();
  let rest: string;
  if (text[firstSep] === ',') {
    // "Nieuw-West terraced house, brick, cream garage door + …": the clauses themselves are the name.
    const clauses = text.split(', ');
    let t = clauses[0];
    for (let i = 1; i < clauses.length && t.length < 45; i++) t += `, ${clauses[i]}`;
    return { place: '', title: clip(cap(t.replace(/\s*\(.*$/, ''))) };
  }
  if (text[firstSep] === ':') rest = text.slice(firstSep + 1);
  else {
    const end = closeParen(text, firstSep + 1);
    rest = end > 0 ? text.slice(end) : text.slice(firstSep);
  }
  rest = rest.replace(/^[\s:,;.-]+/, '');
  const colon = rest.search(/[:;]/);
  let head = colon >= 0 ? rest.slice(0, colon) : rest;
  if (colon >= 0 && head.split(' ').length < 4) {
    const after = rest.slice(colon + 1).split(/[,;(]/)[0].trim();
    head = `${head}: ${after}`;
  } else head = head.split(/,|\s\(/)[0];
  return { place, title: clip(cap(head.trim())) || fallback };
}
const RAD = Math.PI / 180, R = 6371008.8;

export interface Outline { f: BuurtFeatureInput; bbox: [number, number, number, number] }
export function outlines(buurten: readonly BuurtFeatureInput[]): Outline[] {
  return buurten.filter(f => f.geometry?.type === 'Polygon' && f.geometry.coordinates[0]?.length > 2).map(f => {
    const ring = f.geometry.coordinates[0];
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    return { f, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}
function inRingLngLat([lng, lat]: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function buurtAt(o: readonly Outline[], p: [number, number]): BuurtFeatureInput | undefined {
  return o.find(({ f, bbox }) => p[0] >= bbox[0] && p[0] <= bbox[2] && p[1] >= bbox[1] && p[1] <= bbox[3]
    && inRingLngLat(p, f.geometry.coordinates[0]) && !f.geometry.coordinates.slice(1).some(h => inRingLngLat(p, h)))?.f;
}

function wallColour(v: { palette?: { wall?: string | { tint?: string } } }): string | undefined {
  const w = v.palette?.wall;
  const c = typeof w === 'string' ? w : w?.tint;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : undefined;
}

/** "slab-red" → "Slab red": the variant key, readable, when the spec gives no label. */
const keyLabel = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/-/g, ' ');

/**
 * The house to start the ride beside: the one nearest the middle of the design's biggest buurt, so the link lands among
 * many of its houses rather than on an outlier.
 */
export function rideHouse(houses: readonly DesignInstanceInput[], inBiggest: readonly DesignInstanceInput[]): DesignInstanceInput | undefined {
  const pool = inBiggest.length ? inBiggest : houses;
  if (!pool.length) return undefined;
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const c = [med(pool.map(h => h.anchor[0])), med(pool.map(h => h.anchor[1]))];
  const k = Math.cos(c[1] * RAD);
  let best = pool[0], bestD = Infinity;
  for (const h of pool) {
    const d = ((h.anchor[0] - c[0]) * k) ** 2 + (h.anchor[1] - c[1]) ** 2;
    if (d < bestD || (d === bestD && h.pand < best.pand)) { bestD = d; best = h; }
  }
  return best;
}

/** A small map: the houses as dots over the buurt outlines around them, framed on the houses (at least `minSpanM` across). */
export function designMap(houses: readonly DesignInstanceInput[], o: readonly Outline[], width = 320, height = 240, minSpanM = 900): DesignMap | undefined {
  if (!houses.length) return undefined;
  const lngs = houses.map(h => h.anchor[0]), lats = houses.map(h => h.anchor[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const mx = (lng: number) => lng * RAD * Math.cos(lat0 * RAD) * R, my = (lat: number) => lat * RAD * R;
  let x0 = mx(Math.min(...lngs)), x1 = mx(Math.max(...lngs)), y0 = my(Math.min(...lats)), y1 = my(Math.max(...lats));
  const pad = 0.12;
  let w = Math.max((x1 - x0) * (1 + 2 * pad), minSpanM), h = Math.max((y1 - y0) * (1 + 2 * pad), minSpanM * height / width);
  if (w / h > width / height) h = w * height / width; else w = h * width / height;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - w / 2; x1 = cx + w / 2; y0 = cy - h / 2; y1 = cy + h / 2;
  const px = (lng: number) => Math.round((mx(lng) - x0) / w * width * 2) / 2;
  const py = (lat: number) => Math.round((y1 - my(lat)) / h * height * 2) / 2;
  const lngMin = x0 / (RAD * Math.cos(lat0 * RAD) * R), lngMax = x1 / (RAD * Math.cos(lat0 * RAD) * R), latMin = y0 / (RAD * R), latMax = y1 / (RAD * R);
  const paths: string[] = [];
  for (const { f, bbox } of o) {
    if (bbox[2] < lngMin || bbox[0] > lngMax || bbox[3] < latMin || bbox[1] > latMax) continue;
    for (const ring of f.geometry.coordinates) {
      const pts: string[] = [];
      let last = '';
      for (const [lng, lat] of ring) {
        const s = `${Math.round(px(lng))},${Math.round(py(lat))}`;
        if (s !== last) pts.push(s);
        last = s;
      }
      if (pts.length > 2) paths.push(`M${pts.join('L')}Z`);
    }
  }
  const seen = new Set<string>();
  const dots: [number, number][] = [];
  for (const hh of houses) {
    const d: [number, number] = [px(hh.anchor[0]), py(hh.anchor[1])];
    const key = `${Math.round(d[0])},${Math.round(d[1])}`;
    if (seen.has(key)) continue;
    seen.add(key); dots.push(d);
  }
  dots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  // A round scale bar about a fifth of the width.
  const target = w / 5, steps = [100, 200, 250, 500, 1000, 2000, 2500, 5000];
  const scaleM = steps.reduce((b, s) => (Math.abs(s - target) < Math.abs(b - target) ? s : b), steps[0]);
  return { width, height, outlines: paths, dots, scaleM, scalePx: Math.round(scaleM / w * width) };
}

export function buildDesigns(input: DesignsInputs): Design[] {
  const o = outlines(input.buurten);
  const hoods = buildHoods(input.boundaries);
  const byDesign = new Map<string, DesignInstanceInput[]>();
  for (const i of input.instances) { const id = designOf(i.unit); (byDesign.get(id) ?? byDesign.set(id, []).get(id)!).push(i); }
  const designs = input.specs.map((spec): Design => {
    const houses = byDesign.get(spec.id) ?? [];
    const buurtCount = new Map<string, DesignBuurt>();
    const inBuurt = new Map<string, DesignInstanceInput[]>();
    for (const h of houses) {
      const b = buurtAt(o, h.anchor);
      if (!b) continue;
      const p = b.properties;
      const s = buurtCount.get(p.code) ?? { code: p.code, name: p.name, wijk: p.wijk, stadsdeel: p.stadsdeel, count: 0 };
      s.count++; buurtCount.set(p.code, s);
      (inBuurt.get(p.code) ?? inBuurt.set(p.code, []).get(p.code)!).push(h);
    }
    const buurten = [...buurtCount.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'));
    const stadsdelen = [...new Set(buurten.map(b => b.stadsdeel).filter((x): x is string => !!x))];
    const pageHits = new Map<string, { name: string; slug: string; n: number }>();
    for (const h of houses) for (const hood of hoods) if (inHood(hood, [h.anchor[1], h.anchor[0]] as LatLng)) {
      const e = pageHits.get(hood.slug) ?? { name: hood.name, slug: hood.slug, n: 0 }; e.n++; pageHits.set(hood.slug, e);
    }
    const pages = [...pageHits.values()].filter(p => !input.pageSlugs || input.pageSlugs.has(p.slug))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'nl')).map(({ name, slug }) => ({ name, slug }));
    const variantCount = new Map<string, number>();
    for (const h of houses) if (h.variant) variantCount.set(h.variant, (variantCount.get(h.variant) ?? 0) + 1);
    const variants: DesignVariant[] = Object.entries(spec.variants ?? {}).map(([key, v]) => ({ key, label: v.label?.trim() || keyLabel(key), wall: wallColour(v), count: variantCount.get(key) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    const house = rideHouse(houses, buurten[0] ? inBuurt.get(buurten[0].code) ?? [] : []);
    const y = spec.source?.bouwjaar?.filter(n => Number.isFinite(n) && n > 1000);
    return {
      id: spec.id, ...designTitle(spec.label ?? '', spec.id), label: spec.label ?? spec.id,
      years: y?.length ? [Math.min(...y), Math.max(...y)] : undefined,
      storeys: spec.storeys, roof: spec.roof?.form,
      count: houses.length, buurten, stadsdelen, pages, variants,
      ride: house ? { href: rideUrl(house.anchor[0], house.anchor[1], ''), lng: house.anchor[0], lat: house.anchor[1], pand: house.pand } : undefined,
      images: input.images[spec.id] ?? {},
      map: designMap(houses, o),
    };
  });
  return designs.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export interface DesignTotals { designs: number; placed: number; houses: number; buurten: number; stadsdelen: string[] }
export function totals(designs: readonly Design[]): DesignTotals {
  const placed = designs.filter(d => d.count > 0);
  const st = new Map<string, number>();
  for (const d of placed) for (const b of d.buurten) if (b.stadsdeel) st.set(b.stadsdeel, (st.get(b.stadsdeel) ?? 0) + b.count);
  return {
    designs: designs.length, placed: placed.length,
    houses: designs.reduce((s, d) => s + d.count, 0),
    buurten: new Set(designs.flatMap(d => d.buurten.map(b => b.code))).size,
    stadsdelen: [...st].sort((a, b) => b[1] - a[1]).map(([n]) => n),
  };
}
