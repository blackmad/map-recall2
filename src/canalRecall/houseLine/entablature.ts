/**
 * Belt kit, the deep cornice (cornice lane 2026-11-21, Herengracht 2-90: "a deep cornice draws as a flat plain grey frieze
 * slab"; 10's photo shows a projecting corona on a row of modillions over a dentil bed, a frieze and an architrave).
 *
 * A deep stucco or stone cornice as measured parts, top down, each a share of the measured cornice zone (its foot over the
 * top storey to its top): an attic band over the corona (60), the corona with its cymatium, the course that carries it as
 * seen from the street (the soffit's modillions, brackets or consoles against its shadow, with coffers between), the bed
 * moulding (dentils on it), the frieze, the architrave. The shares are read off the crop on a pixel grid; the pieces'
 * count across the front is counted on it.
 *
 * Pure. facadeOrnaments.ts rowDeepCornice draws it (RowCorniceDress.profile); absent, the timber cornice is drawn as before.
 */

/** The parts of a deep cornice, top down. */
export const ENTABLATURE_PARTS = ['attic', 'corona', 'course', 'bed', 'frieze', 'architrave'] as const;
export type EntablaturePart = (typeof ENTABLATURE_PARTS)[number];

/** A deep cornice as measured (RowCorniceDress.profile). Shares need not sum to 1: they are normalised over the depth. */
export interface CorniceProfile {
  /** The zone's depth (m), its top to its foot; the wall's top storey stops under it. */
  depthM: number;
  /** A plain parapet band standing over the corona (Herengracht 60's stucco attic band). */
  attic?: number;
  /** The corona with its cymatium. */
  corona: number;
  /** What carries the corona, as seen from the street: the soffit with its pieces. */
  course?: number;
  /** The bed moulding under the course (with `dentils`). */
  bed?: number;
  frieze?: number;
  architrave?: number;
  /** The course's pieces: short `modillions` (blocks), tall scrolled `brackets` (40's), `consoles` over the piers only. */
  carry?: 'modillions' | 'brackets' | 'consoles';
  /** The pieces across the front, counted on the crop; absent: one per ENTABLATURE_PITCH_M. Consoles stand over the piers. */
  count?: number;
  /** Sunk coffers between the pieces (a rosette in each on a modillion course; a dark panel between consoles, 12's). */
  coffers?: boolean;
  /** Dentils on the bed moulding (10, 40). */
  dentils?: boolean;
  /** The frieze is the wall's own brick (42's attic storey) rather than the cornice's paint. */
  friezeBody?: 'paint' | 'wall';
  /** Low attic lights in the frieze: one over each window axis, or one on the front's centre (42). */
  friezeLights?: 'axes' | 'centre';
  /** The frieze lights' head: `round` a round-headed light under a moulded hood (60's lunette); absent square. */
  lightHead?: 'round';
  /** Raised blocks in the frieze over the piers (Herengracht 14 over its giant pilasters). */
  friezeBlocks?: boolean;
}

/** Stock sizes (m) where the profile does not measure them. */
export const ENTABLATURE = {
  /** A modillion pitch where the pieces are not counted (10: 19 on 8.6 m, 40: 14 on 13.2 m, 48: 8 on 8.5 m). */
  pitchM: 0.55,
  /** A piece's width as a share of its pitch: modillions, brackets, consoles. */
  pieceShare: { modillions: 0.42, brackets: 0.36, consoles: 0.3 },
  /** A piece's widest (m): 54's modillions stand 0.3 m wide at a 1.27 m pitch; 12's consoles 0.6 m. */
  pieceMaxM: { modillions: 0.3, brackets: 0.42, consoles: 0.6 },
  /** The soffit's shade between the pieces and a coffer's, as the street sees a deep cornice's underside. */
  soffit: 0.78, coffer: 0.7,
  /** Dentils: width and pitch. */
  dentil: { w: 0.07, pitch: 0.13 },
  /** The corona's drip line (the shadow under its front edge) as a share of the corona. */
  drip: 0.18,
  /** A band thinner than this (m) is not drawn. */
  minBandM: 0.04,
} as const;

export interface EntablatureBand { part: EntablaturePart; /** Metres under the cornice's top (z1 > z0, both >= 0). */ z0: number; z1: number }

/** The profile's bands, top down, as depths under the cornice's top (m): each share of the summed shares, over depthM. */
export function entablatureBands(p: CorniceProfile): EntablatureBand[] {
  const parts = ENTABLATURE_PARTS.map(part => [part, Math.max(0, Number(p[part] ?? 0))] as const).filter(([, v]) => Number.isFinite(v) && v > 0);
  const sum = parts.reduce((t, [, v]) => t + v, 0);
  if (!(sum > 0) || !(p.depthM > 0)) return [];
  const out: EntablatureBand[] = [];
  let at = 0;
  for (const [part, v] of parts) {
    const h = p.depthM * v / sum;
    if (h >= ENTABLATURE.minBandM) out.push({ part, z0: +at.toFixed(4), z1: +(at + h).toFixed(4) });
    at += h;
  }
  return out;
}

/** The course's piece centres along a front `L` long: `count` evenly (half a pitch in from each end), else the stock pitch. */
export function pieceCentres(L: number, p: Pick<CorniceProfile, 'count'>): number[] {
  if (!(L > 0)) return [];
  const n = Number.isInteger(p.count) && p.count! >= 2 ? p.count! : Math.max(3, Math.round(L / ENTABLATURE.pitchM));
  return Array.from({ length: n }, (_, i) => +((i + 0.5) * L / n).toFixed(4));
}

/** A piece's width at a pitch. */
export function pieceWidth(pitch: number, carry: NonNullable<CorniceProfile['carry']>): number {
  return +Math.min(ENTABLATURE.pieceMaxM[carry], pitch * ENTABLATURE.pieceShare[carry]).toFixed(4);
}

/** A read profile, validated (the read's shares and flags); null when it states no corona or no positive share. */
export function profileOf(v: unknown, depthM: number): CorniceProfile | null {
  if (!v || typeof v !== 'object' || !(depthM > 0)) return null;
  const r = v as Record<string, unknown>, share = (k: string) => (typeof r[k] === 'number' && (r[k] as number) > 0 && (r[k] as number) < 1 ? { [k]: r[k] as number } : {});
  if (!(typeof r.corona === 'number' && r.corona > 0 && r.corona < 1)) return null;
  const out: CorniceProfile = { depthM: +depthM.toFixed(3), corona: r.corona, ...share('attic'), ...share('course'), ...share('bed'), ...share('frieze'), ...share('architrave') };
  if (r.carry === 'modillions' || r.carry === 'brackets' || r.carry === 'consoles') out.carry = r.carry;
  if (Number.isInteger(r.count) && (r.count as number) >= 2 && (r.count as number) <= 60) out.count = r.count as number;
  if (r.coffers === true) out.coffers = true;
  if (r.dentils === true) out.dentils = true;
  if (r.friezeBody === 'wall' || r.friezeBody === 'paint') out.friezeBody = r.friezeBody;
  if (r.friezeLights === 'axes' || r.friezeLights === 'centre') out.friezeLights = r.friezeLights;
  if (r.friezeBlocks === true) out.friezeBlocks = true;
  if (r.lightHead === 'round') out.lightHead = 'round';
  return out;
}

/**
 * Where the cornice zone stands (bar-fixes follow-up, Herengracht 10: "the upper storeys squashed once the cornice got
 * deeper"). The survey eaves is either the cornice's top (the zone stands inside it, off the top storey) or the wall's top
 * (the zone stands on it). The photo decides: its wall from the pavement to the zone's foot, at the crop's pixels per
 * metre, against the two walls the survey allows. On top when the survey eaves is the nearer.
 */
export function corniceOnTop(eavesM: number, depthM: number, photoWallM: number): boolean {
  if (!(eavesM > 0 && depthM > 0 && photoWallM > 0)) return false;
  return Math.abs(eavesM - photoWallM) < Math.abs(eavesM - depthM - photoWallM);
}

/** The cornice lane's read fields (measured by eye on the crop where the photo read has no field for them). */
export interface CorniceReadExtras {
  /** The deep cornice's parts as shares of its zone, its pieces and their count (CorniceProfile without the depth). */
  corniceProfile?: Omit<CorniceProfile, 'depthM'>;
  /** The cornice's paint where it is not white: the stone or stucco's colour (Herengracht 14, 40: the front's grey stone). */
  cornicePaint?: string;
  /** The photo's wall from the pavement to the cornice zone's foot (m at the crop's pixels per metre): corniceOnTop. */
  photoWallM?: number;
  /** The cornice centre as seen, over the crown read's: its kind, body, shoulders, arc, cap, rise, width share, light. */
  centreDress?: {
    centre?: 'pediment' | 'segmental' | 'balustrade' | 'attic' | 'none';
    body?: 'paint' | 'wall'; shoulders?: 'scrolls' | 'steps'; arc?: { tympanum: 'wall' | 'paint'; springM?: number };
    cap?: 'pediment' | 'segmental' | 'flat' | 'stepped'; riseM?: number; share?: number; light?: 'square' | 'round' | 'oculus' | 'none';
    /** Belt windows lane: an attic body running down through the cornice (m under its top), and its light's foot and top
     *  over the cornice's top (m). */
    dropM?: number; lightM?: [number, number];
  };
}
/** What the cornice lane's read fields set on the plot's cornice form (RowCorniceDress parts); the profile at `depthM`. */
export function corniceReadParts(r: CorniceReadExtras, depthM: number | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const prof = r.corniceProfile ? profileOf(r.corniceProfile, depthM && depthM > 0 ? depthM : 1) : null;
  // Unmeasured depth: soloDressAtDepth sets the timber band's (depthM 0 is filled there).
  if (prof) out.profile = depthM && depthM > 0 ? prof : { ...prof, depthM: 0 };
  if (typeof r.cornicePaint === 'string' && /^#[0-9a-f]{6}$/i.test(r.cornicePaint)) out.paint = r.cornicePaint.toLowerCase();
  const c = r.centreDress;
  if (c && typeof c === 'object') {
    if (c.centre === 'none') out.centre = undefined;
    else if (c.centre === 'pediment' || c.centre === 'segmental' || c.centre === 'balustrade' || c.centre === 'attic') out.centre = c.centre;
    if (c.body === 'paint' || c.body === 'wall') out.centreBody = c.body;
    if (c.shoulders === 'scrolls' || c.shoulders === 'steps') out.centreShoulders = c.shoulders;
    if (c.arc && (c.arc.tympanum === 'wall' || c.arc.tympanum === 'paint')) out.centreArc = { tympanum: c.arc.tympanum, ...(typeof c.arc.springM === 'number' && c.arc.springM > 0 && c.arc.springM < 5 ? { springM: c.arc.springM } : {}) };
    if (c.cap === 'pediment' || c.cap === 'segmental' || c.cap === 'flat' || c.cap === 'stepped') out.centreCap = c.cap;
    if (typeof c.riseM === 'number' && c.riseM > 0.2 && c.riseM < 5) out.centreRiseM = c.riseM;
    if (typeof c.share === 'number' && c.share > 0.1 && c.share <= 1) out.centreShare = c.share;
    if (c.light === 'none') out.centreLight = undefined;
    else if (c.light === 'square' || c.light === 'round' || c.light === 'oculus') out.centreLight = c.light;
    if (typeof c.dropM === 'number' && c.dropM > 0.1 && c.dropM < 4) out.centreDropM = c.dropM;
    if (Array.isArray(c.lightM) && c.lightM.length === 2 && c.lightM.every(v => typeof v === 'number' && Math.abs(v) < 5) && c.lightM[1] > c.lightM[0] + 0.2) out.centreLightM = [c.lightM[0], c.lightM[1]];
  }
  return out;
}
