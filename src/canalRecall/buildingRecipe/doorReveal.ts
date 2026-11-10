/**
 * An inset doorway on an ordinary front (#181): most Amsterdam street doors stand back in the wall, not flush with it.
 * The door opening and its fanlight are cut `deep` metres into the wall as one cavity lined with jambs (brick in the
 * wall colour, or stone/plaster where the type says so) and a soffit; the door leaf and the fanlight stand at its back,
 * the threshold or the steps on its floor (the top step reaches the leaf), and a stoop (`basement: stoop`) climbs to the
 * cavity floor at the door's sill, as before.
 *
 * Two forms, measured on the strips and panoramas cited in the types:
 *  - `reveal`: the shallow reveal of the 1880-1915 single-house rows (a few decimetres, a step or none);
 *  - `portiek`: the deeper shared vestibule of the 1900-1935 rows (a metre or more), wider than one door, the stair door
 *    at the back and, with `sideDoors`, a flat's door on each side wall.
 *
 * `FrontIntent.doorReveal` is a ground field (a type's ground variant). It reuses the canal-house recess path
 * (canalhouseOpeningRecess.ts) as the loggia does (frontLoggia.ts): two stacked recessed openings that share one cavity.
 * Absent = byte-identical.
 *
 * Round 2 (#239): the cavity's jambs and soffit are shaded toward the leaf (`DOOR_REVEAL.shade`, measured with
 * scripts/block-face/door-shade.ts on the lit brick jamb of three reveals: Burgerstraat 0.45 m and Eerste Helmersstraat
 * 0.25 m, luma relative to the mouth band 1 / 0.80 / 0.78 in thirds of the depth), and an arched door (`doorArch`) cuts
 * an arched cavity: the leaf at the back keeps its round head, an intrados lining follows the arch, and the wall around
 * the arch stays on the face.
 */
import type {CanalhouseOpening} from '../canalhouseRecipes.ts';

export interface DoorRevealIntent {
  form: 'reveal' | 'portiek';
  /**
   * Metres from the facade to the back of the door frame: reveal 0.15..0.7, portiek 0.5..1.5. The 12 cm frame stands in
   * front of that plane and the leaf ~9 cm in front of it, so a photo's visible jamb return to the frame face is
   * `deep` - 0.135 and to the leaf `deep` - 0.1.
   */
  deep: number;
  /** Steps inside the cavity, 0..5 (default 0: a stone threshold). */
  steps?: number;
  /** Riser height of those steps, 0.12..0.2 m (default 0.17). */
  riser?: number;
  /** Lining of the jambs: the wall's brick (default), a stone jamb, or a plastered one (drawn in the palette's pale stone: a trim-coloured lining is a frame part to the GLB audit, and on a deep portiek it reads as a frame outside its wall). */
  jamb?: 'brick' | 'stone' | 'plaster';
  /** Opening width (m, 0.9..2.6; 0.4..2.6 with `edge`, a half of a shared opening) when the cavity is wider than the kit's door (a portiek before two doors). */
  span?: number;
  /** portiek: a flat's door on each side wall (needs deep >= 0.9). */
  sideDoors?: boolean;
  /** The leaf at the back: a panelled door (default) or a glazed stair door. */
  leaf?: 'door' | 'glazed';
  /**
   * The opening hugs the party wall on the door's side (no 5 cm margin) instead of standing centred in its door bay: with
   * `span` set to half the shared opening, the two fronts of a pair draw one recessed opening straddling their party wall
   * (Djambistraat, Soendastraat 1913: one 1.06 m recess on the wall, a mailbox panel on each jamb, a leaf for the pair).
   * Absent = byte-identical.
   */
  edge?: boolean;
}

const KEYS = ['form', 'deep', 'steps', 'riser', 'jamb', 'span', 'sideDoors', 'leaf', 'edge'];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** The cavity's 4 cm linings stand inside the opening, over the frame's outer edge: the frames are drawn 4 cm wider so
 * the white frame keeps the 8 cm (door) and 6 cm (fanlight) the flush door shows. */
export const DOOR_REVEAL = {riser: 0.17, sideDoorM: 0.9, sideDoorH: 2.3, doorTrim: 0.12, fanTrim: 0.1, edgeTrim: 0.12,
  /** Lining colour per third of the depth, mouth to leaf (door-shade.ts medians, see the module note). */
  shade: [1, 0.8, 0.78] as readonly number[]} as const;

/** Problems with `doorReveal` on one front (`door`: the front has a door it can recess). */
export function doorRevealProblems(d: unknown, front: {doorBay: number | null; doorArch?: unknown; groundFront?: unknown; shopfront?: {residentialDoor?: unknown}}, at: string): string[] {
  const a = `${at}.doorReveal`;
  if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(k => !KEYS.includes(k))) return [`${a}: {form, deep, steps?, riser?, jamb?, span?, sideDoors?, leaf?, edge?}`];
  const o = d as Record<string, unknown>, p: string[] = [];
  if (o.form !== 'reveal' && o.form !== 'portiek') p.push(`${a}.form: reveal | portiek`);
  const [lo, hi] = o.form === 'portiek' ? [0.5, 1.5] : [0.15, 0.7];
  if (!num(o.deep, lo, hi)) p.push(`${a}.deep: ${lo}..${hi} m for a ${o.form}`);
  if (o.steps !== undefined && !(Number.isInteger(o.steps) && (o.steps as number) >= 0 && (o.steps as number) <= 5)) p.push(`${a}.steps: 0..5`);
  if (o.riser !== undefined && !num(o.riser, 0.12, 0.2)) p.push(`${a}.riser: 0.12..0.2 m`);
  if (o.jamb !== undefined && !['brick', 'stone', 'plaster'].includes(o.jamb as string)) p.push(`${a}.jamb: brick | stone | plaster`);
  if (o.span !== undefined && !num(o.span, o.edge === true ? 0.4 : 0.9, 2.6)) p.push(`${a}.span: ${o.edge === true ? 0.4 : 0.9}..2.6 m`);
  if (o.sideDoors !== undefined && (typeof o.sideDoors !== 'boolean' || (o.sideDoors && (o.form !== 'portiek' || !num(o.deep, 0.9, 1.5))))) p.push(`${a}.sideDoors: a portiek at least 0.9 m deep`);
  if (o.leaf !== undefined && o.leaf !== 'door' && o.leaf !== 'glazed') p.push(`${a}.leaf: door | glazed`);
  if (o.edge !== undefined && o.edge !== true) p.push(`${a}.edge: true or absent`);
  if (front.groundFront !== undefined) p.push(`${a}: a groundFront draws its own doors`);
  if (front.doorBay === null && !front.shopfront?.residentialDoor) p.push(`${a}: needs a door (doorBay or a shop's residentialDoor)`);
  return p;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The door (and fanlight, when `transomH` > 0) of a front with a reveal: the same leaf and fanlight as the flush door,
 * the fanlight moved down onto the door's head so the two cut one cavity (top unchanged), both `deep` behind the wall.
 */
export function doorRevealOpenings(d: DoorRevealIntent, left: number, bottom: number, width: number, doorH: number, transomH: number, arch?: {rise: number; segments: number}): CanalhouseOpening[] {
  const jambSurface = d.jamb === 'stone' || d.jamb === 'plaster' ? 'stone' as const : 'wall' as const;
  const fan = !arch && transomH > 0.2, steps = d.steps ?? 0, riseM = d.riser ?? DOOR_REVEAL.riser;
  const landing = steps * riseM;
  const sideDoors = d.sideDoors ? {widthM: r3(Math.min(DOOR_REVEAL.sideDoorM, d.deep - 0.3)), heightM: r3(Math.min(DOOR_REVEAL.sideDoorH, doorH - (arch?.rise ?? 0) - landing - 0.05))} : undefined;
  const shade = [...DOOR_REVEAL.shade];
  const door: CanalhouseOpening = {id: 'door', kind: 'door', leftM: left, bottomM: bottom, widthM: width, heightM: doorH, ...(arch ? {head: 'segmental' as const, headRiseM: arch.rise, headSegments: arch.segments} : {}), trimWidthM: d.edge ? DOOR_REVEAL.edgeTrim : DOOR_REVEAL.doorTrim, ...(arch || d.edge ? {} : {verticalBars: [.5]}),
    paneSurface: d.leaf === 'glazed' ? 'glass' : 'door', frameSurface: d.edge ? 'door' : 'trim', barSurface: d.edge ? 'door' : 'trim', recessM: d.deep,
    recessReturns: {glazedSides: [], ...(fan ? {omit: ['soffit' as const]} : {}), jambSurface, sillSurface: 'stone', ...(steps ? {steps: {count: steps, riseM}} : {}), ...(sideDoors ? {sideDoors} : {}), shade, ...(fan ? {jambsM: r3(doorH + transomH + 0.06)} : {})}};
  if (!fan) return [door];
  return [door, {id: 'door-transom', kind: 'window', leftM: left, bottomM: r3(bottom + doorH), widthM: width, heightM: r3(transomH + 0.06), trimWidthM: DOOR_REVEAL.fanTrim, frameSurface: 'trim', barSurface: 'trim',
    recessM: d.deep, recessReturns: {glazedSides: [], omit: ['sill', 'jambs'], jambSurface, shade}}];
}
