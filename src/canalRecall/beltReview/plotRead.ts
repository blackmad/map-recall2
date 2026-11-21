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
import { ERA_GROUND_M, SOUTERRAIN_M, type PlotDormer, type PlotFacts, type PlotGableForm, type PlotRoof } from '../designUnits/plotPlan.ts';
import type { CrownForm } from './houseRead.ts';

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
  /** Each full storey's share of the wall under the cornice, ground first (measured on the crop by the self-check). */
  storeyShares?: number[];
  /** A gable's rise over the cornice / eaves line (m), measured on the crop by the self-check. */
  crownRiseM?: number;
  /** Ground window height over a first-upper window's, measured on the crop by the self-check. */
  groundWindowRatio?: number;
  /** Street door height (fanlight included) over the ground storey's, measured on the crop by the self-check. */
  doorRatio?: number;
  /** A basement band's height over the ground storey's, measured on the crop by the self-check. */
  basementRatio?: number;
  /** The crown read (houseRead.ts CrownForm): the gable's or the cornice's form and its pixel landmarks. */
  crownForm?: CrownForm & { px: CrownForm['px'] & { w?: number; h?: number; ppm?: number } };
}

/** The crown read's measures (m), from its pixel landmarks at the crop's pixels per metre. */
export interface CrownMeasures {
  /** The crown's foot over the ground: the gable's foot, or the cornice's top. */
  footM: number;
  /** The crown's top over its foot (a centre piece's top on a cornice front). */
  riseM: number;
  /** The neck's (a step's top tread's, a centre piece's) width as a share of the front. */
  neckShare?: number;
  /** An elevated neck's full-width rise over the foot. */
  raiseM?: number;
  /** Where the shoulders end, as a share of the crown over the shoulders' foot. */
  shoulderRise?: number;
  /** The cap's rise. */
  capM?: number;
}
export function crownMeasures(cf: PhotoReadExtras['crownForm']): CrownMeasures | null {
  const px = cf?.px, ppm = Number(px?.ppm);
  if (!px || !(ppm > 5)) return null;
  const m = (y: number) => (px.ground - y) / ppm, fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const out: CrownMeasures = { footM: +m(px.foot).toFixed(2), riseM: +((px.foot - px.apex) / ppm).toFixed(2) };
  const front = px.right - px.left;
  if (fin(px.neckLeft) && fin(px.neckRight) && px.neckRight > px.neckLeft && front > 0) out.neckShare = +((px.neckRight - px.neckLeft) / front).toFixed(3);
  const elevated = cf!.kind === 'elevated-neck' && fin(px.raise) && px.raise < px.foot && px.raise > px.apex;
  if (elevated) out.raiseM = +((px.foot - px.raise!) / ppm).toFixed(2);
  const base = elevated ? px.raise! : px.foot;
  if (fin(px.shoulder) && px.shoulder < base && px.shoulder > px.apex) out.shoulderRise = +((base - px.shoulder) / (base - px.apex)).toFixed(3);
  if (fin(px.capBase) && px.capBase > px.apex && px.capBase < px.foot) out.capM = +((px.capBase - px.apex) / ppm).toFixed(2);
  return out;
}
/** Crown read kinds -> the roof planner's gable (roofMesh.ts GABLE_SHAPES) and the kit's crown (RowCrown shape). */
const FORM_GABLE: Record<string, [string, NonNullable<PlotGableForm['shape']>]> = {
  neck: ['neck', 'neck'], 'elevated-neck': ['raisedNeck', 'neck'], bell: ['bell', 'bell'], curved: ['bell', 'bell'], step: ['step', 'step'], spout: ['spout', 'spout'], point: ['plain', 'point'],
};
/** A photo foot this far off the survey eaves (as a share) is a misread landmark: the survey stands. 3DBAG's eaves on a
 *  gabled house is the saddle's foot behind the gable, 1.5-2.7 m over the gable's foot on Herengracht 16, 28, 80, 84. */
export const CROWN_FOOT_SHARE = [0.65, 1.2] as const;

/** The most of a neck's rise its brick shoulders take (the claws stand above them). */
export const NECK_SHOULDER_MAX = 0.3;
/** A curved gable's top as a share of the front, unread. */
export const CURVED_NECK_SHARE = 0.75;
/** The gable form of a crown read (the RowCrown parts it states). */
export function gableForm(cf: CrownForm, m: CrownMeasures | null, widthM: number): PlotGableForm {
  const f: PlotGableForm = { shape: FORM_GABLE[cf.kind][1] };
  const necked = f.shape === 'neck' || f.shape === 'bell';
  if (m?.neckShare && m.neckShare > 0.12 && m.neckShare < 0.95 && (necked || f.shape === 'step' || f.shape === 'spout')) f.neckW = +(m.neckShare * widthM).toFixed(2);
  // A neck's read shoulder landmark is the claw pieces' top (0.54-0.64 on Herengracht 16, 28, 38, 44, 64, 80): the brick
  // shoulder under them is low and the claws stand on it (self-check kg-pass1: "wide bell without a neck" on all six), so
  // the outline keeps at most NECK_SHOULDER_MAX. A bell's sweep is the outline itself.
  if (necked && m?.shoulderRise !== undefined) f.shoulderRise = +Math.min(f.shape === 'neck' ? NECK_SHOULDER_MAX : 0.85, Math.max(0.12, m.shoulderRise)).toFixed(3);
  // A curved (Jugendstil) gable is a bell nearly the front's width when its neck is not read (Herengracht 74).
  if (cf.kind === 'curved' && !f.neckW) f.neckW = +(CURVED_NECK_SHARE * widthM).toFixed(2);
  if (necked && m?.raiseM && m.raiseM > 0.8) f.raiseM = m.raiseM;
  if (necked && m?.capM && m.capM > 0.2) f.capM = m.capM;
  const cap = ({ pediment: 'pediment', segmental: 'segmental', rounded: 'rounded', flat: 'flat', carved: 'rounded', shell: 'segmental' } as const)[cf.cap as 'pediment'];
  if (necked && cap) f.cap = cap;
  const stone: NonNullable<PlotGableForm['stone']> = {};
  if (necked) stone.claws = cf.claws === 'carved' ? 'carved' : cf.claws !== 'none';
  if (cf.crest) stone.crest = 'crest';
  else if ((f.shape === 'step' || f.shape === 'spout') && (cf.cap === 'pediment' || cf.cap === 'segmental')) stone.crest = cf.cap;
  if (necked && (cf.cap === 'carved' || cf.cap === 'shell')) stone.cap = cf.cap;
  if (necked && cf.shoulderOvals) stone.shoulders = 'oval';
  if (Object.keys(stone).length) f.stone = stone;
  f.neckLights = cf.neckLights;
  f.lowerLights = cf.lowerLights;
  if (cf.lightHead === 'round' || cf.lightHead === 'segmental') f.lightHead = cf.lightHead;
  if (cf.footLedge) f.footLedge = true;
  if (f.shape === 'step' && Number.isInteger(cf.steps) && cf.steps! >= 1 && cf.steps! <= 8) f.steps = cf.steps;
  return f;
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
  fanlight: /fanlight|transom light|bovenlicht|oval light over (the )?door/,
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
  // The measured storey profile, when it counts the stated storeys.
  const shares = read.storeyShares;
  if (facts.storeys && Array.isArray(shares) && shares.length === facts.storeys && shares.every(x => typeof x === 'number' && x > 0 && x < 1)) facts.storeyShares = [...shares];
  const ground = fields.ground;
  if (ground === 'shop') facts.ground = 'shop';
  else if (ground === 'dwelling' || ground === 'door-only') facts.ground = 'dwelling';

  // The roof element: a gable crown keeps the stated gable (house preview's monumentGable); a cornice or flat front takes
  // its roof storey: dormers or a mansard on the cornice, a covering in view, else a flat top behind it.
  // The crown read (crownForm), where there is one, says what kind of crown the front has: a gable kind (its form drawn by
  // the kit's row crown), or a cornice where the first read said a gable or a shouldered roof (Herengracht 30, 74).
  const cf = read.crownForm && read.crownForm.kind in FORM_GABLE || read.crownForm?.kind === 'cornice' || read.crownForm?.kind === 'flat' ? read.crownForm : undefined;
  const cm = cf ? crownMeasures(cf) : null;
  const crown = cf && !(cf.kind in FORM_GABLE) ? cf.kind : String(fields.crown ?? ''), rs = String(fields.roofStorey ?? '');
  const isGable = cf ? cf.kind in FORM_GABLE : GABLE_CROWNS.has(crown);
  const dorm = fields.dormers as { count?: number; kind?: string } | undefined;
  const count = dorm && Number.isInteger(dorm.count) ? dorm.count! : undefined;
  const covering = read.roofMaterial && read.roofMaterial !== 'not-visible' ? read.roofMaterial : null;
  let roof: PlotRoof | undefined;
  if (isGable) roof = undefined;
  else if (rs === 'mansard') roof = 'mansard';
  else if (rs === 'dormers' || (count ?? 0) > 0 || crown === 'pitched-eaves' || crown === 'shouldered' || (covering && !(cf && rs === 'gable-attic'))) roof = 'dormers';
  else if (crown) roof = 'flat';
  if (roof) facts.roof = roof;
  // An attic storey over the top floor on a cornice front: low lights in the frieze under the cornice.
  if (rs === 'attic' && !isGable) facts.attic = true;
  // A gable front: the kit's row crown in the canal belt's dress, its attic light as read, its rise as measured (else the
  // roof planner's).
  if (isGable) {
    const rise = Number(read.crownRiseM);
    facts.gable = { window: rs === 'gable-attic' ? 'square' : 'none', belt: true, ...(Number.isFinite(rise) && rise > 0.8 && rise < 12 ? { riseM: +rise.toFixed(2) } : {}) };
    if (cf) facts.gable.form = gableForm(cf, cm, opts.widthM && opts.widthM > 0 ? opts.widthM : 6);
  }
  // A cornice front's read form: what carries the cornice, its frieze, and what stands on it over the centre.
  if (cf && !isGable && cf.kind === 'cornice') {
    const cform: NonNullable<PlotFacts['corniceForm']> = {};
    if (cf.consoles === 'even' || cf.consoles === 'ends') cform.supports = 'consoles';
    else if (cf.consoles === 'dense') cform.supports = 'modillions';
    if (cf.consoles === 'ends') cform.supportsAt = 'ends';
    const fr = ({ windows: 'attic-lights', oculi: 'oculi', panels: 'panels', plain: 'plain' } as const)[cf.frieze as 'plain'];
    if (fr) cform.frieze = fr;
    if (cf.centre !== 'none') {
      cform.centre = cf.centre;
      if (cm?.neckShare && cm.neckShare > 0.12 && cm.neckShare <= 1) cform.centreShare = cm.neckShare;
      if (cm && cm.riseM > 0.25 && cm.riseM < 5 && cf.centre !== 'balustrade') cform.centreRiseM = cm.riseM;
      if (cf.centre === 'attic') { const cap = ({ pediment: 'pediment', segmental: 'segmental', rounded: 'segmental', carved: 'segmental', shell: 'segmental' } as const)[cf.cap as 'pediment']; cform.centreCap = cap ?? 'flat'; }
      if (cf.centreLight !== 'none') cform.centreLight = cf.centreLight;
    }
    if (Object.keys(cform).length) facts.corniceForm = cform;
  }
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
  if ((TEXT_CUES.hoist.test(text) || cf?.hoistBeam) && !hoistDormer) parts.push('hoist-beam');
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
  if (typeof fields.cornice === 'string' && CORNICES.has(fields.cornice) && !isGable) facts.cornice = fields.cornice as PlotFacts['cornice'];
  // The door: its place among the ground-storey openings (the read counts doors and windows from the left).
  const door = fields.door as { bay?: number; surround?: boolean } | number | null | undefined;
  const at = typeof door === 'number' ? door : door && Number.isInteger(door.bay) ? door.bay! : undefined;
  if (at !== undefined && at >= 0) facts.door = { index: at, of: Math.max(at + 1, facts.bays ?? 1), ...(typeof door === 'object' && door?.surround ? { surround: true } : {}), ...(TEXT_CUES.fanlight.test(text) ? { fanlight: true } : {}) };
  // The ground openings as measured (a dwelling ground: the shop keeps its shopfront).
  const wr = Number(read.groundWindowRatio), dr = Number(read.doorRatio);
  const br = Number(read.basementRatio), stoopUp = fields.stoop === 'stoop' || fields.stoop === 'stoop-and-windows';
  if (facts.ground === 'dwelling' && wr > 0.3 && wr < 3 && dr > 0.4 && dr <= 1) facts.groundOpenings = { windowRatio: +wr.toFixed(2), doorRatio: +dr.toFixed(2),
    // A measured basement band: pavement-level windows under the ground windows, the door up the stoop when one is read.
    ...(br >= 0.12 && br <= 0.5 ? { basementRatio: +br.toFixed(2), ...(stoopUp ? { raisedDoor: true } : {}) } : {}) };

  const eaves = Number(fields.eavesM), widthM = opts.widthM && opts.widthM > 0 ? opts.widthM : 6;
  let eavesM = Number.isFinite(eaves) && eaves > 4 && eaves >= MIN_STOREY_M * (facts.storeys ?? 2) ? +eaves.toFixed(2) : null;
  // A gable front's crown read: the gable stands on its photo foot (3DBAG's eaves on a gabled house is the saddle's foot
  // behind it), its rise as measured from that foot, where the foot agrees with the survey.
  if (isGable && cm && facts.gable && eavesM !== null && cm.footM >= eavesM * CROWN_FOOT_SHARE[0] && cm.footM <= eavesM * CROWN_FOOT_SHARE[1] && cm.footM >= MIN_STOREY_M * (facts.storeys ?? 2)) {
    eavesM = cm.footM;
    if (cm.riseM > 0.8 && cm.riseM < 12) facts.gable.riseM = cm.riseM;
  }
  // A raised ground storey over a souterrain (stoop and basement windows), where the measured front has room for it.
  if ((fields.stoop === 'stoop-and-windows' || fields.stoop === 'windows') && eavesM !== null && eavesM - ERA_GROUND_M - SOUTERRAIN_M >= ((facts.storeys ?? 3) - 1) * SOUTERRAIN_UPPER_MIN_M) facts.souterrain = true;
  const year = Number(fields.facadeYear);
  const gable = cf ? (isGable ? FORM_GABLE[cf.kind][0] : null) : crown ? (GABLE_CROWNS.has(crown) ? GABLE_SHAPE[crown] : null) : undefined;
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
