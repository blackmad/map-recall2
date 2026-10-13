/**
 * Signature-ornament inventory of a bespoke landmark: per exposed wall, every feature a rider would notice at 1.7 m eye
 * height or on a gallery card (relief, sculpture, crest, lettering, sign, clock, canopy, ...), each with the plan
 * `modelled`, `simplified` (how) or `skipped` (a coded reason), and the photo it was seen in.
 *
 * Why (2026-10-13): the Hoofdbureau van Politie shipped without the Amsterdam-arms relief on its Marnixstraat end wall.
 * The brief was written from memory, the panorama tool's default `--min-len=14` dropped that 13.9 m wall, and nothing
 * in the process asked what makes the building recognisable. The inventory is written from
 * `scripts/landmarks/landmark-brief.ts` crops before any geometry and gates the export (docs/buildings-pipeline.md,
 * "Bespoke landmark lane: photo first, inventory before geometry").
 *
 * Files: `scripts/landmarks/<id>-inventory.json` (one landmark, gated) and `scripts/landmarks/ornament-inventory.json`
 * (`{landmarks: {[id]: LandmarkInventory}}`, the retro-fit survey of existing landmarks, lenient).
 */

export const ORNAMENT_KINDS = [
  'relief', 'sculpture', 'crest', 'gable-stone', 'lettering', 'sign', 'clock', 'canopy', 'balcony-ironwork', 'lamp',
  'tower', 'dome', 'colonnade', 'window-shape', 'other',
] as const;
export type OrnamentKind = typeof ORNAMENT_KINDS[number];

export const PLANS = ['modelled', 'simplified', 'skipped', 'open'] as const;
/** `open` = seen, not yet decided; never allowed at export. */
export type Plan = typeof PLANS[number];

/**
 * Coded skip reasons. "No component" and "the facade systems cannot express it" are deliberately absent: a bespoke
 * builder exists for exactly those parts. `needs-modeller` (a figure group beyond hand boxes; feeds the splat/impostor
 * track) is accepted only in the retro-fit survey, never for a gated (new) landmark, which simplifies it by hand instead.
 */
export const SKIP_REASONS = ['not-visible', 'too-small', 'temporary', 'gone', 'needs-modeller'] as const;
export type SkipReason = typeof SKIP_REASONS[number];

/** Free-text excuses that the process rejects in any note of a skipped item. */
export const FORBIDDEN_SKIP_TEXT = /\bno (?:component|kit|system)\b|can(?:not|'t) (?:be )?express|could not (?:be )?express|not expressible|facade systems? (?:can(?:not|'t)|could not)/i;

export interface InventoryItem {
  /** Unique within the landmark, e.g. `n-arms-relief`. */
  id: string;
  kind: OrnamentKind;
  /** Where on the wall, in words a reviewer can find: "upper centre, over the six round windows". */
  where: string;
  /** Approximate width x height in metres. */
  approxSizeM: [number, number];
  plan: Plan;
  /** How it is modelled or simplified (required for `simplified`; builder function for `modelled` is welcome). */
  how?: string;
  skip?: {reason: SkipReason; note: string};
  /** Panorama id (or another source id) the item was seen in. */
  seenIn: string;
  note?: string;
  /** Optional box in the review sheet's camera-matched photo tile, fractions [x0, y0, x1, y1] (review-sheet --inventory). */
  sheetBox?: [number, number, number, number];
}

export interface InventoryWall {
  /** all-walls / brief tag, e.g. `w16-337`. */
  tag: string;
  bearing: number;
  lengthM: number;
  /** Wall midpoint [lng, lat] (from the brief), used to match review-sheet walls of equal bearing. */
  centre?: [number, number];
  evidence: 'photo' | 'inferred';
  panoId?: string | null;
  capturedAt?: string | null;
  /** Someone looked at this wall's crop and listed what is there (an empty list is then a statement: nothing notable). */
  checked: boolean;
  note?: string;
  items: InventoryItem[];
}

export interface LandmarkInventory {
  schemaVersion: 1;
  id: string;
  pand?: string;
  /** Brief this inventory was written from (scripts/landmarks/<id>-brief.md). */
  brief?: string;
  /**
   * What makes the building recognisable: item ids, most recognisable first. At least one; every signature item must be
   * modelled or simplified, never skipped.
   */
  signature: string[];
  walls: InventoryWall[];
  sources?: {name: string; url: string; licence: string}[];
}

export interface InventoryIssue {severity: 'error' | 'gate'; path: string; message: string}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Schema validation (`error`) plus, with `gate: true`, the export rules for a new landmark (`gate`): no `open` item, no
 * `needs-modeller`, every photographed wall checked, a non-empty signature whose items are all modelled or simplified.
 */
export function validateInventory(raw: unknown, opts: {gate?: boolean; id?: string} = {}): InventoryIssue[] {
  const issues: InventoryIssue[] = [];
  const err = (p: string, m: string) => issues.push({severity: 'error', path: p, message: m});
  const gate = (p: string, m: string) => { if (opts.gate) issues.push({severity: 'gate', path: p, message: m}); };
  if (!raw || typeof raw !== 'object') { err('', 'not an object'); return issues; }
  const inv = raw as LandmarkInventory;
  if (inv.schemaVersion !== 1) err('schemaVersion', 'must be 1');
  if (!isStr(inv.id)) err('id', 'missing');
  else if (opts.id && inv.id !== opts.id) err('id', `is ${inv.id}, expected ${opts.id}`);
  if (!Array.isArray(inv.walls)) { err('walls', 'must be an array'); return issues; }
  const items = new Map<string, InventoryItem>();
  inv.walls.forEach((w, wi) => {
    const wp = `walls[${wi}]${w && isStr(w.tag) ? `(${w.tag})` : ''}`;
    if (!w || typeof w !== 'object') { err(wp, 'not an object'); return; }
    if (!isStr(w.tag)) err(`${wp}.tag`, 'missing');
    if (!isNum(w.bearing) || w.bearing < 0 || w.bearing >= 360) err(`${wp}.bearing`, 'must be 0-359');
    if (!isNum(w.lengthM) || w.lengthM <= 0) err(`${wp}.lengthM`, 'must be > 0');
    if (w.evidence !== 'photo' && w.evidence !== 'inferred') err(`${wp}.evidence`, 'photo | inferred');
    if (w.evidence === 'photo' && !isStr(w.panoId)) err(`${wp}.panoId`, 'a photographed wall names its panorama');
    if (typeof w.checked !== 'boolean') err(`${wp}.checked`, 'must be true or false');
    else if (!w.checked && w.evidence === 'photo') gate(`${wp}.checked`, 'photographed wall not yet checked for ornaments');
    if (!Array.isArray(w.items)) { err(`${wp}.items`, 'must be an array'); return; }
    w.items.forEach((it, ii) => {
      const ip = `${wp}.items[${ii}]${it && isStr(it.id) ? `(${it.id})` : ''}`;
      if (!it || typeof it !== 'object') { err(ip, 'not an object'); return; }
      if (!isStr(it.id)) err(`${ip}.id`, 'missing');
      else if (items.has(it.id)) err(`${ip}.id`, 'duplicate item id');
      else items.set(it.id, it);
      if (!(ORNAMENT_KINDS as readonly string[]).includes(it.kind)) err(`${ip}.kind`, `unknown kind ${String(it.kind)}`);
      if (!isStr(it.where)) err(`${ip}.where`, 'missing');
      if (!Array.isArray(it.approxSizeM) || it.approxSizeM.length !== 2 || !it.approxSizeM.every(v => isNum(v) && v > 0)) err(`${ip}.approxSizeM`, '[width, height] in metres');
      if (!isStr(it.seenIn)) err(`${ip}.seenIn`, 'name the panorama or source it was seen in');
      if (!(PLANS as readonly string[]).includes(it.plan)) { err(`${ip}.plan`, `unknown plan ${String(it.plan)}`); return; }
      if (it.plan === 'simplified' && !isStr(it.how)) err(`${ip}.how`, 'a simplified item says how');
      if (it.plan === 'open') gate(`${ip}.plan`, 'unresolved (open)');
      if (it.plan === 'skipped') {
        if (!it.skip || !(SKIP_REASONS as readonly string[]).includes(it.skip.reason)) err(`${ip}.skip.reason`, `one of ${SKIP_REASONS.join(', ')}`);
        else if (it.skip.reason === 'needs-modeller') gate(`${ip}.skip.reason`, 'needs-modeller is a retro-fit status; a new landmark simplifies it by hand');
        if (!it.skip || !isStr(it.skip.note)) err(`${ip}.skip.note`, 'say why');
      }
      for (const text of [it.skip?.note, it.note, it.how]) if (text && it.plan !== 'modelled' && FORBIDDEN_SKIP_TEXT.test(text)) err(`${ip}`, `"${text.match(FORBIDDEN_SKIP_TEXT)![0]}" is not a reason: a bespoke builder exists for exactly those parts`);
      if (it.sheetBox && !(it.sheetBox.length === 4 && it.sheetBox.every(v => isNum(v) && v >= 0 && v <= 1) && it.sheetBox[0] < it.sheetBox[2] && it.sheetBox[1] < it.sheetBox[3])) err(`${ip}.sheetBox`, 'fractions [x0, y0, x1, y1] with x0 < x1, y0 < y1');
    });
  });
  if (!Array.isArray(inv.signature)) err('signature', 'list the item ids that make the building recognisable');
  else {
    if (!inv.signature.length) gate('signature', 'empty: what makes this building recognisable?');
    for (const s of inv.signature) {
      const it = items.get(s);
      if (!it) err('signature', `unknown item id ${s}`);
      else if (it.plan === 'skipped' || it.plan === 'open') gate(`signature(${s})`, `signature item is ${it.plan}; it must be modelled or simplified`);
    }
  }
  return issues;
}

export interface InventoryRow {wall: string; item: string; kind: OrnamentKind; sizeM: string; plan: Plan; detail: string; signature: boolean}

/** Flat rows for printing (audit:glb, check-landmark-inventory) and the retro-fit miss table. */
export function inventoryRows(inv: LandmarkInventory): InventoryRow[] {
  const sig = new Set(inv.signature ?? []);
  return inv.walls.flatMap(w => w.items.map(it => ({
    wall: w.tag, item: it.id, kind: it.kind, sizeM: `${it.approxSizeM[0]}x${it.approxSizeM[1]}`, plan: it.plan,
    detail: it.plan === 'skipped' ? `${it.skip?.reason}: ${it.skip?.note}` : it.how ?? it.note ?? '', signature: sig.has(it.id),
  })));
}

export function formatRows(rows: InventoryRow[]): string[] {
  return rows.map(r => `${r.signature ? '*' : ' '} ${r.wall.padEnd(8)} ${r.plan.padEnd(10)} ${r.kind.padEnd(16)} ${r.sizeM.padEnd(9)} ${r.item}${r.detail ? ` - ${r.detail}` : ''}`.slice(0, 220));
}

/**
 * Visibility score of an unmodelled item, for ranking misses: area at rider eye level weighted by kind (figurative and
 * readable things first) and doubled for a signature item.
 */
export function missScore(it: InventoryItem, signature: boolean): number {
  const weight: Partial<Record<OrnamentKind, number>> = {relief: 1.5, sculpture: 1.5, crest: 1.4, lettering: 1.3, clock: 1.3, tower: 1.2, 'gable-stone': 1.1, sign: 1, canopy: 0.8, lamp: 0.6, 'balcony-ironwork': 0.7};
  const area = Math.max(0.1, it.approxSizeM[0] * it.approxSizeM[1]);
  return Math.round(Math.sqrt(area) * (weight[it.kind] ?? 0.8) * (signature ? 2 : 1) * 10) / 10;
}

/** Landmarks first exported after this instant must carry a resolved inventory (the process was adopted 2026-10-13). */
export const INVENTORY_REQUIRED_AFTER = '2026-10-14T00:00:00+02:00';
/**
 * Older landmarks held to the gate anyway, once their retro-fitted inventory is resolved. The Hoofdbureau (first exported
 * 2026-10-13 15:31, before the cutoff) belongs here as soon as its builder lane resolves the `open` items of
 * scripts/landmarks/hoofdbureau-elandsgracht-inventory.json; adding it earlier would block that lane's own rebuild.
 */
export const INVENTORY_REQUIRED_IDS: readonly string[] = [];

/** Whether a landmark's export needs a resolved inventory. `firstExported` = first commit of its GLB, undefined = never committed. */
export function inventoryRequired(id: string, firstExported: string | undefined): boolean {
  if (INVENTORY_REQUIRED_IDS.includes(id)) return true;
  if (!firstExported) return true;
  return Date.parse(firstExported) >= Date.parse(INVENTORY_REQUIRED_AFTER);
}

/** Inventory wall for a review-sheet wall: same bearing within 15 deg, then the nearest centre within `maxDistM`. */
export function matchWall(walls: InventoryWall[], bearing: number, centre?: [number, number], maxDistM = 20): InventoryWall | undefined {
  const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const cands = walls.filter(w => diff(w.bearing, bearing) <= 15);
  if (!centre) return cands[0];
  const d = (w: InventoryWall) => w.centre ? Math.hypot((w.centre[0] - centre[0]) * 68000, (w.centre[1] - centre[1]) * 111000) : 1e9;
  const best = cands.sort((a, b) => d(a) - d(b))[0];
  return best && (!best.centre || d(best) <= maxDistM) ? best : undefined;
}
