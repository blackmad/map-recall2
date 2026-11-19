/**
 * Design-unit join (T1, docs/handoffs/design-units-plan-20261119.md): BAG pands to ordekaart objects by area overlap,
 * units inferred where the layers are silent, members ordered along each street face, and a family key.
 *
 * Rules (each measured in docs/reports/design-units-phase0-20261119.md):
 *   - A pand joins the object holding at least ASSIGN_SHARE of its own footprint area ("most of its footprint").
 *   - It straddles when a second object holds at least STRADDLE_SHARE; it still joins the larger.
 *   - An object holds part of a pand when it has at least PARTIAL_SHARE of a pand it does not get.
 *   - BAG wins over the 2015 layers: a pand built after LAYER_YEAR never joins an object (flag `built-after-layer`).
 *   - Uncovered, non-minor party-wall neighbours with the same BAG year, eaves within INFER_EAVES_M and the same 3DBAG
 *     roof class join one inferred unit; anything else is a single.
 *   - Fronts: buurtGenerator/rows.ts frontEdgeOf (an unshared edge facing a named street), so slices meet the rows the
 *     generator already draws.
 *
 * Deterministic: no hashing; the same inputs in any order give the same units. Pure: no fs, no DOM.
 */
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { frameAt, frontEdgeOf, type FrontEdge, type GenPand } from '../buurtGenerator/rows.ts';
import type { DesignUnit, FamilyKey, LngLat, OrdekaartLayer, OrdekaartObject, PandOverlap, Polygons, Ring, UnitFace, UnitPand } from './types.ts';

export const ASSIGN_SHARE = 0.5;
export const STRADDLE_SHARE = 0.2;
export const PARTIAL_SHARE = 0.1;
/** The Ring layer is dated October 2015; nothing built after it can be in an object. */
export const LAYER_YEAR = 2015;
export const INFER_EAVES_M = 0.3;
/** A party wall: this much of an edge runs within PARTY_M of a neighbour's edge (m). */
export const PARTY_M = 0.35;
export const PARTY_MIN_M = 3;
/** Sheds and annexes (coverage.ts isMinor): never inferred into a unit. */
export const MINOR_HEIGHT_M = 3.5;
export const MINOR_AREA_M2 = 20;
/** Slices further apart than this along one face (m) flag the unit `face-gap`. */
export const FACE_GAP_M = 1.5;

type XY = { x: number; y: number };
const GRID_M = 50;

// --- ordekaart ----------------------------------------------------------------------------------------------------

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Objects of one layer's GeoJSON (property names differ in case between layers). */
export function parseOrdekaart(layer: OrdekaartLayer, fc: { features: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }> }): OrdekaartObject[] {
  const out: OrdekaartObject[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) p[k.toLowerCase()] = v;
    const objectnummer = num(p.objectnummer);
    if (objectnummer === null) continue;
    const polygons: Polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]]
      : f.geometry.type === 'MultiPolygon' ? (f.geometry.coordinates as Ring[][]) : [];
    if (!polygons.length) continue;
    const year = num(p.bouwjaar);
    out.push({
      key: `${layer}:${objectnummer}`, layer, objectnummer, orde: String(p.orde ?? '').trim(),
      architectNr: num(p.architectnr), architect: str(p.architect), year: year && year > 1000 && year < 2100 ? year : null,
      gebied: str(p.gebied), polygons,
    });
  }
  return out;
}

// --- geometry -----------------------------------------------------------------------------------------------------

const openRing = (ring: Ring): LngLat[] => {
  const r = [...ring];
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
};
const ringArea = (r: readonly XY[]) => Math.abs(r.reduce((t, p, i) => { const q = r[(i + 1) % r.length]; return t + p.x * q.y - q.x * p.y; }, 0) / 2);
const pcArea = (mp: MultiPolygon) => mp.reduce((t, poly) => t + poly.reduce((s, ring, i) => {
  const a = ringArea(ring.map(([x, y]) => ({ x, y })));
  return i === 0 ? s + a : s - a;
}, 0), 0);
type Box = [number, number, number, number];
const boxOf = (pts: readonly XY[]): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return [x0, y0, x1, y1];
};
const boxesMeet = (a: Box, b: Box, pad = 0) => a[0] <= b[2] + pad && a[2] >= b[0] - pad && a[1] <= b[3] + pad && a[3] >= b[1] - pad;

class Grid<T> {
  private cells = new Map<string, T[]>();
  constructor(private size: number) {}
  add(box: Box, item: T) {
    for (let gx = Math.floor(box[0] / this.size); gx <= Math.floor(box[2] / this.size); gx++)
      for (let gy = Math.floor(box[1] / this.size); gy <= Math.floor(box[3] / this.size); gy++) {
        const k = `${gx},${gy}`; const l = this.cells.get(k); if (l) l.push(item); else this.cells.set(k, [item]);
      }
  }
  near(box: Box, pad = 0): T[] {
    const s = new Set<T>();
    for (let gx = Math.floor((box[0] - pad) / this.size); gx <= Math.floor((box[2] + pad) / this.size); gx++)
      for (let gy = Math.floor((box[1] - pad) / this.size); gy <= Math.floor((box[3] + pad) / this.size); gy++)
        for (const t of this.cells.get(`${gx},${gy}`) ?? []) s.add(t);
    return [...s];
  }
}

/** The local metre frame every function here shares (rows.ts frameAt at Amsterdam's latitude). */
export const FRAME = frameAt(52.37);

// --- overlap ------------------------------------------------------------------------------------------------------

interface ObjXY { obj: OrdekaartObject; pc: MultiPolygon; box: Box }

/** For each pand, the share of its footprint inside each object it touches (largest first). */
export function pandOverlaps(pands: readonly UnitPand[], objects: readonly OrdekaartObject[]): Map<string, PandOverlap> {
  const grid = new Grid<ObjXY>(GRID_M);
  for (const obj of objects) {
    const pc: MultiPolygon = obj.polygons.map(poly => poly.map(ring => openRing(ring).map(c => { const q = FRAME.xy(c); return [q.x, q.y] as [number, number]; })));
    const box = boxOf(pc.flatMap(poly => poly[0].map(([x, y]) => ({ x, y }))));
    grid.add(box, { obj, pc, box });
  }
  const out = new Map<string, PandOverlap>();
  for (const p of pands) {
    const xy = openRing(p.ring).map(FRAME.xy);
    if (xy.length < 3) continue;
    const areaM2 = ringArea(xy), box = boxOf(xy);
    const poly: Polygon = [xy.map(q => [q.x, q.y] as [number, number])];
    const hits: PandOverlap['hits'] = [];
    for (const o of grid.near(box)) {
      if (!boxesMeet(box, o.box)) continue;
      let a = 0;
      try { a = pcArea(polygonClipping.intersection(poly, o.pc)); } catch { a = 0; }
      if (a > 0.01 * areaM2) hits.push({ key: o.obj.key, share: +(a / areaM2).toFixed(3) });
    }
    hits.sort((u, v) => v.share - u.share || (u.key < v.key ? -1 : 1));
    out.set(p.id, { pandId: p.id, areaM2: +areaM2.toFixed(1), hits });
  }
  return out;
}

export const isMinorPand = (p: UnitPand): boolean => {
  const xy = openRing(p.ring).map(FRAME.xy);
  return xy.length >= 3 && ((p.heightM !== null && p.heightM < MINOR_HEIGHT_M) || ringArea(xy) < MINOR_AREA_M2);
};

// --- party walls --------------------------------------------------------------------------------------------------

const sub = (p: XY, q: XY): XY => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: XY, q: XY) => p.x * q.x + p.y * q.y;
function segDist(p: XY, a: XY, b: XY): number {
  const d = sub(b, a), l2 = dot(d, d) || 1, t = Math.max(0, Math.min(1, dot(sub(p, a), d) / l2));
  return Math.hypot(p.x - (a.x + d.x * t), p.y - (a.y + d.y * t));
}
/** Length (m) of ring `r` that runs within PARTY_M of ring `o`, sampled every ~0.5 m. */
export function partyLength(r: readonly XY[], o: readonly XY[]): number {
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b.x - a.x, b.y - a.y), N = Math.max(2, Math.ceil(L / 0.5));
    let hit = 0;
    for (let k = 0; k <= N; k++) {
      const s = { x: a.x + (b.x - a.x) * k / N, y: a.y + (b.y - a.y) * k / N };
      for (let j = 0; j < o.length; j++) if (segDist(s, o[j], o[(j + 1) % o.length]) <= PARTY_M) { hit++; break; }
    }
    total += hit / (N + 1) * L;
  }
  return total;
}

// --- streets ------------------------------------------------------------------------------------------------------

export interface NamedStreet { name: string; path: readonly LngLat[] }

// --- units --------------------------------------------------------------------------------------------------------

export interface JoinResult {
  units: DesignUnit[];
  overlaps: Map<string, PandOverlap>;
  /** Pand → unit id. */
  unitOf: Map<string, string>;
  straddles: Array<{ pandId: string; hits: PandOverlap['hits'] }>;
  /** Objects holding part of a pand they do not get. */
  partial: Array<{ key: string; pandId: string; share: number; pandUnit: string }>;
  /** Pands kept out of an object by BAG (built after the layer). */
  afterLayer: string[];
}

const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

export function familyKeyOf(f: FamilyKey): string {
  return `${f.architectNr ?? '?'}/${f.year ?? '?'}/${f.moduleM ?? '?'}`;
}

/** Order a unit's members along each street they front: metres from the unit's left end as seen from the street. */
export function unitFaces(members: readonly string[], fronts: ReadonlyMap<string, FrontEdge>): { faces: UnitFace[]; unfronted: string[] } {
  const byStreet = new Map<string, Array<{ id: string; e: FrontEdge }>>();
  const unfronted: string[] = [];
  for (const id of members) {
    const e = fronts.get(id);
    if (!e) { unfronted.push(id); continue; }
    const l = byStreet.get(e.street); if (l) l.push({ id, e }); else byStreet.set(e.street, [{ id, e }]);
  }
  const faces: UnitFace[] = [];
  for (const [street, list] of [...byStreet].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // Axis: the summed left-to-right directions of the members' fronts on this street.
    let ux = 0, uy = 0;
    for (const { e } of list) { const L = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1; ux += (e.b.x - e.a.x) / L; uy += (e.b.y - e.a.y) / L; }
    const U = Math.hypot(ux, uy) || 1; ux /= U; uy /= U;
    const r7 = (c: LngLat): LngLat => [+c[0].toFixed(7), +c[1].toFixed(7)];
    const proj = list.map(({ id, e }) => { const ta = e.a.x * ux + e.a.y * uy, tb = e.b.x * ux + e.b.y * uy; return { id, t0: Math.min(ta, tb), t1: Math.max(ta, tb), line: [r7(e.aLngLat), r7(e.bLngLat)] as [LngLat, LngLat] }; });
    const origin = Math.min(...proj.map(p => p.t0));
    const slices = proj.map(p => ({ pandId: p.id, fromM: +(p.t0 - origin).toFixed(2), toM: +(p.t1 - origin).toFixed(2), line: p.line }))
      .sort((a, b) => a.fromM - b.fromM || (a.pandId < b.pandId ? -1 : 1));
    faces.push({ street, lengthM: Math.max(...slices.map(s => s.toM)), slices });
  }
  // Longest face first: the unit's main front.
  faces.sort((a, b) => b.lengthM - a.lengthM || (a.street < b.street ? -1 : 1));
  return { faces, unfronted: unfronted.sort() };
}

/** Front edges for the given pands (rows.ts frontEdgeOf), with neighbours from `all` and streets within reach. */
export function frontsOf(targets: readonly UnitPand[], all: readonly UnitPand[], streets: readonly NamedStreet[]): Map<string, FrontEdge> {
  const ringXY = new Map<string, XY[]>(), boxes = new Map<string, Box>();
  const pgrid = new Grid<string>(25);
  for (const p of all) {
    const r = openRing(p.ring).map(FRAME.xy); if (r.length < 3) continue;
    ringXY.set(p.id, r); const b = boxOf(r); boxes.set(p.id, b); pgrid.add(b, p.id);
  }
  const sgrid = new Grid<{ name: string; path: XY[] }>(GRID_M);
  for (const s of streets) {
    if (!s.name || s.path.length < 2) continue;
    for (let k = 0; k + 1 < s.path.length; k++) {
      const seg = { name: s.name, path: [FRAME.xy(s.path[k]), FRAME.xy(s.path[k + 1])] };
      sgrid.add(boxOf(seg.path), seg);
    }
  }
  const out = new Map<string, FrontEdge>();
  for (const p of [...targets].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const r = ringXY.get(p.id); if (!r) continue;
    const b = boxes.get(p.id)!;
    const nb = pgrid.near(b, 1).filter(o => o !== p.id && boxesMeet(b, boxes.get(o)!, 1)).sort().map(o => ringXY.get(o)!);
    const st = sgrid.near(b, 30);
    const gp: GenPand = { id: p.id, ring: p.ring, year: p.year, eavesM: p.eavesM, ridgeM: null, heightM: p.heightM };
    const e = frontEdgeOf(gp, r, nb, st, FRAME);
    if (e) out.set(p.id, e);
  }
  return out;
}

export interface JoinInput {
  pands: readonly UnitPand[];
  objects: readonly OrdekaartObject[];
  streets: readonly NamedStreet[];
  /** Pands outside the study area that still count as neighbours (party walls, fronts). Default: none. */
  context?: readonly UnitPand[];
}

/** The whole T1 join. */
export function joinDesignUnits(input: JoinInput): JoinResult {
  const { pands, objects, streets } = input;
  const all = [...pands, ...(input.context ?? [])];
  const byId = new Map(pands.map(p => [p.id, p]));
  const objByKey = new Map(objects.map(o => [o.key, o]));
  const overlaps = pandOverlaps(pands, objects);

  // 1. Assign by majority area.
  const assigned = new Map<string, string>();
  const straddles: JoinResult['straddles'] = [];
  const afterLayer: string[] = [];
  for (const p of pands) {
    const ov = overlaps.get(p.id);
    const top = ov?.hits[0];
    if (!ov || !top || top.share < ASSIGN_SHARE) continue;
    if (p.year !== null && p.year > LAYER_YEAR) { afterLayer.push(p.id); continue; }
    assigned.set(p.id, top.key);
    if ((ov.hits[1]?.share ?? 0) >= STRADDLE_SHARE) straddles.push({ pandId: p.id, hits: ov.hits });
  }

  // 2. Inferred units over uncovered, non-minor party-wall neighbours.
  const uncovered = pands.filter(p => !assigned.has(p.id) && !isMinorPand(p));
  const parent = new Map(uncovered.map(p => [p.id, p.id]));
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; let y = x; while (parent.get(y) !== r) { const n = parent.get(y)!; parent.set(y, r); y = n; } return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); };
  {
    const ringXY = new Map(uncovered.map(p => [p.id, openRing(p.ring).map(FRAME.xy)]));
    const grid = new Grid<string>(25), boxes = new Map<string, Box>();
    for (const [id, r] of ringXY) { const b = boxOf(r); boxes.set(id, b); grid.add(b, id); }
    const sameDesign = (a: UnitPand, b: UnitPand) => a.year !== null && a.year === b.year && a.eavesM !== null && b.eavesM !== null
      && Math.abs(a.eavesM - b.eavesM) <= INFER_EAVES_M && (a.roofCode ?? null) === (b.roofCode ?? null);
    for (const p of [...uncovered].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const b = boxes.get(p.id)!;
      for (const o of grid.near(b, 1)) {
        if (o <= p.id || !boxesMeet(b, boxes.get(o)!, 1)) continue;
        const q = byId.get(o)!;
        if (!sameDesign(p, q)) continue;
        if (partyLength(ringXY.get(p.id)!, ringXY.get(o)!) >= PARTY_MIN_M) union(p.id, o);
      }
    }
  }

  // 3. Groups.
  const groups = new Map<string, { source: 'ordekaart' | 'inferred'; members: string[] }>();
  for (const [pid, key] of assigned) { const g = groups.get(`o:${key}`); if (g) g.members.push(pid); else groups.set(`o:${key}`, { source: 'ordekaart', members: [pid] }); }
  for (const p of uncovered) { const r = find(p.id), g = groups.get(`i:${r}`); if (g) g.members.push(p.id); else groups.set(`i:${r}`, { source: 'inferred', members: [p.id] }); }
  for (const p of pands) if (!assigned.has(p.id) && !parent.has(p.id)) groups.set(`s:${p.id}`, { source: 'inferred', members: [p.id] });

  // 4. Fronts for every non-minor pand (family module) and members of multi-pand units.
  const frontTargets = pands.filter(p => !isMinorPand(p) || assigned.has(p.id));
  const fronts = frontsOf(frontTargets, all, streets);

  const units: DesignUnit[] = [];
  const unitOf = new Map<string, string>();
  for (const [gk, g] of groups) {
    const members = [...g.members].sort();
    const single = members.length === 1;
    const obj = g.source === 'ordekaart' ? objByKey.get(gk.slice(2)) : undefined;
    const id = single ? members[0] : obj ? `du:${obj.key}` : `du:inf:${members[0]}`;
    const source = single && g.source === 'inferred' ? 'single' : g.source;
    const { faces, unfronted } = unitFaces(members, fronts);
    const widths = members.map(m => fronts.get(m)?.lengthM).filter((w): w is number => typeof w === 'number' && w > 0);
    const years = members.map(m => byId.get(m)!.year).filter((y): y is number => y !== null);
    const family: FamilyKey = {
      architectNr: obj?.architectNr ?? null,
      year: obj?.year ?? (years.length ? median(years) : null),
      moduleM: widths.length ? Math.round(median(widths) * 2) / 2 : null,
    };
    const flags: string[] = [];
    if (obj && obj.year !== null) {
      const off = years.filter(y => Math.abs(y - obj.year!) > 15);
      if (off.length) flags.push(`bag-year-differs:${off.length}`);
    }
    if (faces.length > 1) flags.push('corner');
    // A face whose slices leave a gap: another building stands inside the unit's run (or the object is in two parts).
    if (faces.some(f => f.slices.some((x, i) => i > 0 && x.fromM - Math.max(...f.slices.slice(0, i).map(y => y.toM)) > FACE_GAP_M))) flags.push('face-gap');
    units.push({
      id, seed: single ? members[0] : id, source, members,
      ...(obj ? { object: { key: obj.key, orde: obj.orde, year: obj.year, architectNr: obj.architectNr, architect: obj.architect } } : {}),
      faces, unfronted, family, familyKey: familyKeyOf(family), flags,
    });
    for (const m of members) unitOf.set(m, id);
  }
  units.sort((a, b) => (a.id < b.id ? -1 : 1));

  const partial: JoinResult['partial'] = [];
  for (const [pid, ov] of overlaps) for (const h of ov.hits) {
    if (h.share < PARTIAL_SHARE || assigned.get(pid) === h.key) continue;
    partial.push({ key: h.key, pandId: pid, share: h.share, pandUnit: unitOf.get(pid) ?? pid });
  }
  partial.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.pandId < b.pandId ? -1 : 1));
  return { units, overlaps, unitOf, straddles, partial, afterLayer: afterLayer.sort() };
}
