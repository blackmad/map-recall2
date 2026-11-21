/**
 * Belt review render wiring (2026-11-21, after lane C's photo read: "the read fills every field, but likeness barely moved;
 * roof is the top difference on 41 of 42"). The renderer drew the description's storeys, bays, gable and colour family and
 * nothing else. This maps a house's drawn fields plus its per-house photo read (`photoRead` extras on the description entry,
 * houseRead.ts readExtras) onto the design-unit plot facts (designUnits/plotPlan.ts PlotFacts), which the generic renderer
 * already draws through kit parts: the roof behind the cornice (slate or tile, on the measured eaves), dormers with their
 * kind, count and hoist, white heads, string courses, speklagen, stone plinth or stucco ground storey, pilasters, white or
 * dark frames, the read cornice and the read door place. house preview stamps it as a one-plot `designUnit` (`solo`).
 *
 * Pure and browser-safe. Absent read: null (the design is drawn as before, byte for byte).
 */
import { ERA_GROUND_M, SOUTERRAIN_M, type PlotDormer, type PlotFacts, type PlotRoof } from '../designUnits/plotPlan.ts';

/** The photo read's extras as describe.ts stores them per pand (houseRead.ts readExtras). */
export interface PhotoReadExtras {
  wallHex?: string;
  dormerStyle?: string;
  roofMaterial?: string;
  whiteHeads?: string;
  stringCourses?: boolean;
  speklagen?: string;
  stoopFlight?: string;
  balconies?: string;
  ornaments?: string[];
  kitCannotSay?: string[];
  notes?: string;
}

/** What design.ts hands house preview (`design.plot`): the plot facts and the measures the stamp needs. */
export interface BeltPlot {
  facts: PlotFacts;
  /** The survey eaves (the cornice, m over the ground); null when absent or implausible (then the tile height). */
  eavesM: number | null;
  /** The front's width (m), for the dormer places. */
  widthM: number;
  /** The described gable (roofMesh.ts GableShape) or null for a cornice / flat front; absent: no crown stated. */
  gable?: string | null;
  year?: number;
}

/** A dark window frame (the read says not white): the canal belt's dark green-black. */
export const DARK_FRAME_HEX = '#2b302c';
/** An eaves under this many metres per stated storey is a rear or annex reading (3DBAG eaves 2.4 m on Herengracht 54). */
export const MIN_STOREY_M = 2.6;
/** A souterrain raises the ground storey only where the uppers keep at least this pitch (m) under the measured eaves. */
export const SOUTERRAIN_UPPER_MIN_M = 3;

const GABLE_CROWNS = new Set(['spout', 'neck', 'raised-neck', 'bell', 'step', 'point']);
/** Description crowns (buildingRecipe/intent.ts GABLES) -> the roof planner's gable shapes (roofMesh.ts GABLE_SHAPES). */
const GABLE_SHAPE: Record<string, string> = { spout: 'spout', neck: 'neck', 'raised-neck': 'raisedNeck', bell: 'bell', step: 'step', point: 'plain' };
const DORMER_KIND: Record<string, PlotDormer> = { plain: 'plain', pediment: 'pediment', pointed: 'gabled', arched: 'pediment', box: 'plain', flat: 'plain' };
const CORNICES = new Set(['simple', 'bracketed', 'heavy', 'frieze', 'attic-frieze']);

/** Words in the read's free text (ornaments, kitCannotSay, notes) that name a kit part the enum fields do not carry. */
const textOf = (r: PhotoReadExtras) => [...(r.ornaments ?? []), ...(r.kitCannotSay ?? []), r.notes ?? ''].join(' | ').toLowerCase();
export const TEXT_CUES = {
  hoist: /hoist|hijs/,
  stuccoGround: /(stucco|stuccoed|plaster(ed)?|rendered|white[- ]painted|cream)[^|]{0,40}ground|ground[^|]{0,40}(stucco|stuccoed|plaster|rendered)/,
  plinth: /plinth|stone base|bluestone|hardstone|grey stone (base|ground)/,
  pilasters: /pilaster/,
  anchors: /wall anchor|iron anchor|muurank/,
} as const;

/**
 * The plot facts of one house: `fields` are its drawn description values (description + edits + links), `read` its own
 * photo read. Returns null with no read (nothing changes).
 */
export function beltPlotFacts(fields: Record<string, unknown>, read: PhotoReadExtras | null | undefined, opts: { widthM?: number } = {}): BeltPlot | null {
  if (!read) return null;
  const facts: PlotFacts = { src: 'photo' };
  const storeys = fields.storeys, bays = fields.bays;
  if (Number.isInteger(storeys) && (storeys as number) >= 1) facts.storeys = storeys as number;
  if (Number.isInteger(bays) && (bays as number) >= 1) facts.bays = bays as number;
  const ground = fields.ground;
  if (ground === 'shop') facts.ground = 'shop';
  else if (ground === 'dwelling' || ground === 'door-only') facts.ground = 'dwelling';

  // The roof element: a gable crown keeps the stated gable (house preview's monumentGable); a cornice or flat front takes
  // its roof storey: dormers or a mansard on the cornice, a covering in view, else a flat top behind it.
  const crown = String(fields.crown ?? ''), rs = String(fields.roofStorey ?? '');
  const dorm = fields.dormers as { count?: number; kind?: string } | undefined;
  const count = dorm && Number.isInteger(dorm.count) ? dorm.count! : undefined;
  const covering = read.roofMaterial && read.roofMaterial !== 'not-visible' ? read.roofMaterial : null;
  let roof: PlotRoof | undefined;
  if (GABLE_CROWNS.has(crown)) roof = undefined;
  else if (rs === 'mansard') roof = 'mansard';
  else if (rs === 'dormers' || (count ?? 0) > 0 || crown === 'pitched-eaves' || crown === 'shouldered' || covering) roof = 'dormers';
  else if (crown) roof = 'flat';
  if (roof) facts.roof = roof;
  if (roof === 'dormers' || roof === 'mansard') {
    facts.dormers = crown === 'shouldered' ? Math.max(1, count ?? 1) : count ?? 0;
    const kind = DORMER_KIND[read.dormerStyle ?? ''] ?? (dorm?.kind === 'gabled' ? 'gabled' : undefined);
    if (kind) facts.dormer = crown === 'shouldered' && kind === 'plain' ? 'pediment' : kind;
  }
  if (covering) facts.roofMaterial = covering === 'red-tile' ? 'tile' : 'slate';
  const text = textOf(read);
  // A hoist: on the lead dormer where the roof has dormers, else the front's own beam at the top (gable or cornice).
  const hoistDormer = (roof === 'dormers' || roof === 'mansard') && (facts.dormers ?? 0) > 0;
  if (TEXT_CUES.hoist.test(text) && hoistDormer) facts.hoist = true;
  const parts: NonNullable<PlotFacts['parts']> = [];
  if (TEXT_CUES.hoist.test(text) && !hoistDormer) parts.push('hoist-beam');
  if (TEXT_CUES.anchors.test(text)) parts.push('wall-anchors');
  if (parts.length) facts.parts = parts;

  // White parts and stone, each a kit part (designUnits/draw.ts withPlotPlan).
  if (read.whiteHeads === 'keystone' || read.whiteHeads === 'blocks' || read.whiteHeads === 'band' || read.whiteHeads === 'none') facts.whiteHeads = read.whiteHeads;
  if (read.stringCourses === true) facts.stringCourses = true;
  if (read.speklagen === 'ground' || read.speklagen === 'all') facts.bands = read.speklagen;
  const heads = fields.heads;
  if (heads === 'segmental' || heads === 'round') facts.headShape = heads;
  else if (heads === 'flat') facts.headShape = 'flat';
  if (typeof fields.whiteFrames === 'boolean') facts.whiteFrames = fields.whiteFrames;
  if (TEXT_CUES.stuccoGround.test(text)) facts.stone = 'ground';
  else if (TEXT_CUES.plinth.test(text)) facts.stone = 'plinth';
  if (TEXT_CUES.pilasters.test(text)) facts.pilasters = 'corners';
  if (typeof read.wallHex === 'string' && /^#[0-9a-f]{6}$/i.test(read.wallHex)) facts.wallHex = read.wallHex.toLowerCase();
  if (typeof fields.cornice === 'string' && CORNICES.has(fields.cornice) && !GABLE_CROWNS.has(crown)) facts.cornice = fields.cornice as PlotFacts['cornice'];
  // The door: its place among the ground-storey openings (the read counts doors and windows from the left).
  const door = fields.door as { bay?: number; surround?: boolean } | number | null | undefined;
  const at = typeof door === 'number' ? door : door && Number.isInteger(door.bay) ? door.bay! : undefined;
  if (at !== undefined && at >= 0) facts.door = { index: at, of: Math.max(at + 1, facts.bays ?? 1), ...(typeof door === 'object' && door?.surround ? { surround: true } : {}) };

  const eaves = Number(fields.eavesM), widthM = opts.widthM && opts.widthM > 0 ? opts.widthM : 6;
  const eavesM = Number.isFinite(eaves) && eaves > 4 && eaves >= MIN_STOREY_M * (facts.storeys ?? 2) ? +eaves.toFixed(2) : null;
  // A raised ground storey over a souterrain (stoop and basement windows), where the measured front has room for it.
  if ((fields.stoop === 'stoop-and-windows' || fields.stoop === 'windows') && eavesM !== null && eavesM - ERA_GROUND_M - SOUTERRAIN_M >= ((facts.storeys ?? 3) - 1) * SOUTERRAIN_UPPER_MIN_M) facts.souterrain = true;
  const year = Number(fields.facadeYear);
  const gable = crown ? (GABLE_CROWNS.has(crown) ? GABLE_SHAPE[crown] : null) : undefined;
  return { facts, eavesM, widthM: +widthM.toFixed(2), ...(gable !== undefined ? { gable } : {}), ...(Number.isInteger(year) ? { year } : {}) };
}

/** The one-plot `designUnit` stamp house preview puts on the pand (designUnits/drawProps.ts DesignUnitDraw, `solo`). */
export function beltDesignUnit(pandId: string, plot: BeltPlot): Record<string, unknown> {
  const seed = `belt:${pandId}`;
  return {
    seed, segment: seed, plotSeed: `${seed}:plot`, eavesM: plot.eavesM, street: '', fromM: 0, toM: plot.widthM, moduleM: plot.widthM, k: 0, n: 1, solo: true,
    ...(plot.facts.bays ? { bays: plot.facts.bays } : {}), plot: plot.facts, ...(plot.gable !== undefined ? { gable: plot.gable } : {}), ...(plot.year ? { year: plot.year } : {}),
  };
}
