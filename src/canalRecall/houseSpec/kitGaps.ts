// The kit-gap queue (house line H6, docs/house-line.md §5): every `schemaLimits` entry on a house spec or a block-face
// type, counted per pand and per gap, weighted by ride priority, sorted for the weekly kit session. Pure: the script
// `scripts/house-specs/kit-gaps.ts` reads the extracts and passes sightings in.
import type { SpecLimit } from './spec.ts';

/** A gap at or over this weighted count goes to a kit lane (the horizon rule, docs/house-line.md §5). */
export const KIT_GAP_THRESHOLD = 50;
/** A pand inside a ride-priority gebied weighs this much; every other pand weighs 1. */
export const RIDE_PRIORITY_WEIGHT = 3;
/** The generated table lists at least this many entries (more, when more are over the threshold). */
export const QUEUE_TABLE_ROWS = 30;
/** Example pands per gap. */
export const EXAMPLES_PER_GAP = 3;

/** Where a limit came from: a spec record (`house-specs/14`, which already merges face limits), or a block-face type
 *  that a house uses (types are not per pand, so they reach the queue through the face's house list). */
export type GapSource = 'spec' | 'type';

export interface GapSighting {
  pandId: string;
  limit: SpecLimit;
  source: GapSource;
  /** The record that states the limit: the face intent, or the spec tile. */
  intentPath: string;
  /** The photo the house was read from (the face strip), or null when no photo stands behind the limit. */
  cropPath: string | null;
  /** YYYY-MM-DD evidence date of the photo, or null. */
  date: string | null;
}

export interface QueueExample { pandId: string; cropPath: string | null; intentPath: string }

export interface QueueEntry {
  /** Normalised limit text (lower-case, trimmed, synonyms folded). */
  gap: string;
  /** The most common kit component filed under this gap (`facade` for an unstructured line). */
  component: string;
  /** Sum of pand weights (RIDE_PRIORITY_WEIGHT inside a ride-priority gebied, else 1). */
  weightedCount: number;
  pandCount: number;
  priorityPandCount: number;
  pands: string[];
  examples: QueueExample[];
  firstSeen: string | null;
  lastSeen: string | null;
}

/** The ten most common wordings of one gap, folded onto one canonical wording. Keys and values are normalised text
 *  (see normalizeGap); a line not listed keeps its own wording. */
export const GAP_SYNONYMS: ReadonlyMap<string, string> = new Map([
  ['iron wall anchors between the windows', 'iron wall anchors'],
  ['iron wall anchors between the windows (in the gap between two springers) are not drawn', 'iron wall anchors'],
  ['the two halves of a window across the party wall keep a 4 cm pier between them (one window on the photo)', 'the two halves of a party-wall window keep a 4 cm brick pier between them (one window on the photo)'],
  ['the balcony depth is assumed (0.5 m)', 'the balcony depth (0.5 m) is not measurable on the ortho strip'],
  ["the dormer's carved ears and side cheeks are plain", 'pediment dormer cheeks are plain (no scrolls); the frieze consoles and panels are a plain frieze'],
  ["the dormer's low side cheeks are not drawn", 'pediment dormer cheeks are plain (no scrolls); the frieze consoles and panels are a plain frieze'],
  ['narrow centre french windows (the kit widens balcony windows)', 'the narrow centre french window is drawn as wide as the side windows (+15 %)'],
  ['yellow brick courses of the 1902 balcony row', 'the yellow brick courses of 44 and 48 are not drawn'],
  ['decorated tympana over some window heads are not modelled', 'brick-relief tympana (carved brick fans) drawn as plain band-brick fills'],
  ['signs on the glass-block band are not drawn', 'signs on the glass-block band'],
]);

/** Lower-case, collapse whitespace, drop trailing full stops and spaces, then fold the synonym table. */
export function normalizeGap(what: string): string {
  const t = what.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim();
  return GAP_SYNONYMS.get(t) ?? t;
}

const byCountThenName = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/**
 * Aggregate sightings into queue entries. A pand counts once per gap however many sources state the limit; its weight
 * is RIDE_PRIORITY_WEIGHT when `isPriority(pandId)`, else 1. Sorted by weightedCount, then pandCount, then gap.
 */
export function buildKitGapQueue(sightings: readonly GapSighting[], isPriority: (pandId: string) => boolean): QueueEntry[] {
  type Group = { components: Map<string, number>; pands: Map<string, GapSighting>; dates: string[] };
  const groups = new Map<string, Group>();
  for (const s of sightings) {
    const gap = normalizeGap(s.limit.what);
    if (!gap) continue;
    const g: Group = groups.get(gap) ?? { components: new Map<string, number>(), pands: new Map<string, GapSighting>(), dates: [] };
    groups.set(gap, g);
    if (!g.pands.has(s.pandId)) {
      g.pands.set(s.pandId, s);
      g.components.set(s.limit.component, (g.components.get(s.limit.component) ?? 0) + 1);
    }
    if (s.date) g.dates.push(s.date);
  }
  const entries: QueueEntry[] = [];
  for (const [gap, g] of groups) {
    const pandIds = [...g.pands.keys()].sort();
    const priority = pandIds.filter(isPriority);
    const component = [...g.components].sort(byCountThenName)[0][0];
    const ranked = [...g.pands.values()].sort((a, b) =>
      Number(isPriority(b.pandId)) - Number(isPriority(a.pandId)) || Number(!!b.cropPath) - Number(!!a.cropPath) || (a.pandId < b.pandId ? -1 : 1));
    const dates = [...g.dates].sort();
    entries.push({
      gap,
      component,
      weightedCount: pandIds.length + (RIDE_PRIORITY_WEIGHT - 1) * priority.length,
      pandCount: pandIds.length,
      priorityPandCount: priority.length,
      pands: pandIds,
      examples: ranked.slice(0, EXAMPLES_PER_GAP).map(s => ({ pandId: s.pandId, cropPath: s.cropPath, intentPath: s.intentPath })),
      firstSeen: dates[0] ?? null,
      lastSeen: dates[dates.length - 1] ?? null,
    });
  }
  return entries.sort((a, b) => b.weightedCount - a.weightedCount || b.pandCount - a.pandCount || (a.gap < b.gap ? -1 : a.gap > b.gap ? 1 : 0));
}

/** The entries the generated doc's table lists: the top QUEUE_TABLE_ROWS, plus every entry at the threshold. */
export function tableEntries(queue: readonly QueueEntry[]): QueueEntry[] {
  return queue.filter((e, i) => i < QUEUE_TABLE_ROWS || e.weightedCount >= KIT_GAP_THRESHOLD);
}

export const NOTES_HEADING = '## Notes';
/** The header line every generated kit-gaps.md carries (the script refuses to overwrite a hand-written doc). */
export const GENERATED_MARK = 'Generated by `npm run house:kit-gaps`';

/** The hand-kept Notes section of an existing kit-gaps.md (from its `## Notes` heading to the end), or '' when none. */
export function notesOf(doc: string): string {
  const i = doc.search(/^## Notes$/m);
  return i < 0 ? '' : doc.slice(i);
}

const cell = (s: string) => s.replace(/\|/g, '\\|');

/** kit-gaps.md: a generated header, the horizon rule, the table, then the preserved Notes section. */
export function renderKitGapsDoc(queue: readonly QueueEntry[], opts: { generated: string; notes: string }): string {
  const rows = tableEntries(queue);
  const over = queue.filter(e => e.weightedCount >= KIT_GAP_THRESHOLD).length;
  const lines = [
    '# Kit gaps',
    '',
    `> ${GENERATED_MARK} (${opts.generated}) from \`artifacts/kit-gaps/queue.json\`. Only the Notes section below is kept by hand; the rest is rewritten on every run.`,
    '',
    'What the kit cannot yet say. Each entry is a \`schemaLimits\` line on a house spec (docs/house-line.md §1) or on a block-face type,',
    `counted once per pand: ${queue.length} gaps, ${over} at or over the threshold of ${KIT_GAP_THRESHOLD}. A pand inside a ride-priority gebied weighs ${RIDE_PRIORITY_WEIGHT}.`,
    '',
    '## The horizon rule',
    '',
    `- A gap goes to a kit lane when its weighted count reaches ${KIT_GAP_THRESHOLD}, or when one landmark needs it.`,
    '- Below that, the house ships with the nearest kit option and the limit stays on its spec. A house lane never fits the nearest option silently.',
    '- The weekly kit session takes the top two entries of the queue.',
    '- House lanes stop extending the kit themselves: they record the limit in `schemaLimits` and let the queue carry it.',
    '',
    `## Queue (${rows.length} of ${queue.length} gaps)`,
    '',
    'Examples are pand ids; the crop is the face strip the house was read from, and the intent is the record that states the limit.',
    '',
    '| # | Gap | Component | Weighted | Pands | Ride-priority | Examples | Last seen |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((e, i) => `| ${i + 1} | ${cell(e.gap)} | ${cell(e.component)} | ${e.weightedCount} | ${e.pandCount} | ${e.priorityPandCount} | ${e.examples.map(x => x.pandId).join(', ')} | ${e.lastSeen ?? '-'} |`),
    '',
    opts.notes.trim() ? opts.notes.trim() : `${NOTES_HEADING}\n\n_No notes yet._`,
    '',
  ];
  return lines.join('\n');
}
