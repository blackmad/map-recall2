/**
 * Measured tree silhouettes (lane T-shape #371, `?treeShape=1`, default off).
 *
 * The inventory priors in `public/canal-drive/da-costa-block/tree-typology.js` place three crown lobes per tree with
 * the crown radius a fixed 0.22 of height and the crown base a fixed share of height, identical for every tree of a
 * height class. A row of 27 m poplars therefore drew as one wall of narrow cylinders on 11 m bare trunks (user,
 * 2026-11-10, Piet Kranenbergpad). Behind the flag:
 *
 *  - a few archetype priors are corrected from summer panoramas (SPECIES_ARCHETYPE, each with its measurement);
 *  - crown width follows the measured width/height ratio of the species, or of its archetype (WIDTH_RATIO);
 *  - the crown base follows the inventory height class (CROWN_BASE_BY_CLASS, measured street-tree clearance), scaled
 *    per species where the panoramas measured it, never a fixed share of height;
 *  - each tree gets seeded jitter: height inside its class range, width, crown base, lobe size and placement, and for
 *    the off-axis archetypes a small crown lean, so a row reads as separate trees.
 *
 * The lobe count, geometry and draw groups are unchanged (one silhouette per archetype, rescaled per instance), so the
 * triangle count is the same; lean and placement jitter only move lobes that were already off the trunk axis, so the
 * fork (wood) instance count is unchanged too. With the flag off nothing here runs and the typology is byte-identical.
 *
 * Numbers come from `scripts/trees/tree-silhouette-survey.ts` (docs/reports/trees-silhouette-20261110/survey.json).
 */
import { gameSilhouette, type Lobe } from './gameSilhouette.ts';
import { TREE_SHAPE_MEASURED } from './treeShapeMeasured.ts';

let urlAsked: boolean | null = null;
/** `?treeShape=1`, or `globalThis.__canalRecallTreeShape` (checked on every call, so Node checks can toggle it). */
export function treeShapeFlag(): boolean {
  const g = globalThis as Record<string, unknown> & { location?: { search?: string } };
  const over = g.__canalRecallTreeShape;
  if (over !== undefined && over !== null) return over === true || over === '1' || over === 'on';
  if (urlAsked === null) {
    const v = typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('treeShape') : null;
    urlAsked = v === '1' || v === 'true' || v === 'on';
  }
  return urlAsked;
}

/** Height-class range in metres ("c. 9 tot 12 m." → [9, 12]); open classes take +8 m, unknown → null. */
export function heightClassRange(hc: string | null | undefined): [number, number] | null {
  const s = String(hc ?? '');
  if (s.startsWith('ZZ')) return null;
  let m = s.match(/(\d+) tot (\d+) m/); if (m) return [+m[1], +m[2]];
  if ((m = s.match(/tot (\d+) m/))) return [2, +m[1]];
  if ((m = s.match(/(\d+) m\. en hoger/))) return [+m[1], +m[1] + 8];
  return null;
}

const { speciesArchetype: SPECIES_ARCHETYPE, widthRatio: WIDTH_RATIO, speciesWidthRatio: SPECIES_WIDTH_RATIO,
  crownBaseByClass: CROWN_BASE_BY_CLASS, speciesBaseFactor: SPECIES_BASE_FACTOR } = TREE_SHAPE_MEASURED;

/** The archetype the measurements support for `species` (normalised name), else the inventory prior. */
export function shapedArchetype(species: string, archetype: string): string {
  return SPECIES_ARCHETYPE[species]?.archetype ?? archetype;
}

function hash(id: unknown, salt: number): number {
  let n = 2166136261 ^ salt;
  for (const c of String(id ?? '')) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Crown base in metres for a tree of height `h` in class `hc`: street clearance by class, per-species factor. */
export function crownBase(h: number, hc: string | null | undefined, species: string): number {
  const range = heightClassRange(hc);
  const key = range ? String(range[0]) : null;
  const byClass = key && CROWN_BASE_BY_CLASS[key] !== undefined ? CROWN_BASE_BY_CLASS[key] : Math.min(4, 0.28 * h);
  return Math.min(0.55 * h, Math.max(0.6, byClass * (SPECIES_BASE_FACTOR[species] ?? 1)));
}

export function widthRatio(species: string, archetype: string): number {
  return SPECIES_WIDTH_RATIO[species] ?? WIDTH_RATIO[archetype] ?? 0.55;
}

// Lobes are horizontal ∝ r and vertical ∝ h in tree-typology.js, so an archetype's crown width is c·r for one c.
const unitWidth = new Map<string, number>();
function templateWidth(archetype: string, lobes: Lobe[], r: number, crownGeometry: string): number {
  let c = unitWidth.get(archetype);
  if (c === undefined) {
    c = gameSilhouette({ height: 1, rotation: 0, crownGeometry, lobes: lobes.map(l => ({ ...l, offset: [l.offset[0] / r, l.offset[1], l.offset[2] / r], scale: [l.scale[0] / r, l.scale[1], l.scale[2] / r] })) }).width;
    unitWidth.set(archetype, c);
  }
  return c * r;
}

/** Archetypes whose lobes all sit on the trunk axis: no lean or lateral jitter (it would add fork instances). */
const ON_AXIS = new Set(['pyramidal', 'columnar', 'conical-evergreen', 'conical-deciduous']);

export interface ShapedTypology {
  height: number; archetype: string; lobes: Array<Lobe & { tone: number }>; trunkHeight: number; crownGeometry: string; id: unknown;
  provenance: Record<string, unknown>;
}

/**
 * Rescale a typology's lobes to the measured silhouette of its species, with seeded per-tree jitter.
 * `r` is the crown radius tree-typology.js built the lobes with; `heightClass` the inventory class.
 */
export function reshapeTree<T extends ShapedTypology>(t: T, species: string, heightClass: string | null | undefined, r: number, heightKnown: boolean): T {
  if (t.archetype === 'fan-palm') return t;
  const id = t.id, range = heightClassRange(heightClass);
  // Height inside the class range: the inventory stores the class midpoint, so a row of one class drew one height.
  let h = t.height;
  if (heightKnown && range) h = Math.min(range[1], Math.max(range[0], h + (hash(id, 1) - 0.5) * 0.7 * (range[1] - range[0])));
  const old = { top: -Infinity, base: Infinity };
  for (const l of t.lobes) { old.top = Math.max(old.top, l.offset[1] + l.scale[1]); old.base = Math.min(old.base, l.offset[1] - l.scale[1]); }
  const w0 = templateWidth(t.archetype, t.lobes, r, t.crownGeometry);
  const width = widthRatio(species, t.archetype) * h * (0.88 + 0.24 * hash(id, 2));
  const base = Math.max(0.5, Math.min(0.6 * h, crownBase(h, heightClass, species) + (hash(id, 3) - 0.5) * 1.0));
  const top = h, vk = (top - base) / Math.max(0.1, old.top - old.base), hk = width / Math.max(0.1, w0);
  const leanOk = !ON_AXIS.has(t.archetype);
  const leanA = hash(id, 4) * Math.PI * 2, lean = leanOk ? hash(id, 5) * 0.035 * h : 0;
  const lobes = t.lobes.map((l, i) => {
    const y = base + (l.offset[1] - old.base) * vk, up = (y - base) / Math.max(0.1, top - base);
    const size = 0.92 + 0.16 * hash(id, 10 + i);
    const off = Math.hypot(l.offset[0], l.offset[2]) > 0.1;
    const jx = off ? (hash(id, 20 + i) - 0.5) * 0.14 * width : 0, jz = off ? (hash(id, 30 + i) - 0.5) * 0.14 * width : 0;
    const lx = off ? Math.cos(leanA) * lean * up : 0, lz = off ? Math.sin(leanA) * lean * up : 0;
    // Lobe height jitter stays inside the crown: the top and base lobes keep their ends.
    const sy = l.scale[1] * vk;
    return { ...l, offset: [l.offset[0] * hk + jx + lx, y, l.offset[2] * hk + jz + lz] as [number, number, number], scale: [l.scale[0] * hk * size, sy, l.scale[2] * hk * size] as [number, number, number] };
  });
  // The trunk instance runs into the crown, a third of the way up it.
  const trunkHeight = base + (top - base) * 0.35;
  return { ...t, height: +h.toFixed(2), lobes, trunkHeight,
    provenance: { ...t.provenance, crownShape: 'treeShape/v1 measured silhouette (scripts/trees/tree-silhouette-survey.ts)', crownBasis: SPECIES_ARCHETYPE[species] ? 'panorama-measured' : t.provenance.crownBasis } };
}

/** What tree-typology.js's `setTreeShaper` takes: registered by the bundled callers (inventory trees, checks). */
export const treeShaper = { active: treeShapeFlag, archetype: shapedArchetype, reshape: reshapeTree };
