/**
 * The blind critic's closed vocabulary (lane F4, #379; docs/plans/facade-programme-20261112.md, F4).
 *
 * The critic names the single biggest gap between a photo and the game at the same pose with exactly one of these terms,
 * severity 1-3. The hand labels of the benchmark (benchmark-v1.json) use the same field names, so a gap term points at
 * the label that says what the photo shows. `owner` is the facade-programme lane whose renderer feature closes the gap
 * (kit-gaps.ts ranks the queue by it); `label` is the hand-label field the term is read against, when there is one.
 */
export const GAP_TERMS = [
  { id: 'wall-colour', text: 'wall colour/tone', owner: 'F1 record: wall colour', label: 'wallTone' },
  { id: 'brick-vs-render', text: 'brick vs render', owner: 'F1 shader: material', label: 'finish' },
  { id: 'storey-count', text: 'storey count', owner: 'F1 record: storeys', label: 'storeys' },
  { id: 'storey-heights', text: 'storey heights', owner: 'F1 record: storey heights', label: null },
  { id: 'window-columns', text: 'window columns', owner: 'F1 record: bays per storey', label: 'columns' },
  { id: 'window-kind', text: 'window kind', owner: 'F1 shader: window kind/head', label: 'windowKind' },
  { id: 'pane-layout', text: 'pane layout', owner: 'F1 shader: pane layout', label: 'paneLayout' },
  { id: 'white-accents', text: 'white surrounds/bands', owner: 'F1 shader: white accents', label: 'whiteAccents' },
  { id: 'door-bay', text: 'door bay/reveal', owner: 'F1 shader: door bay + reveal', label: 'doorBay' },
  { id: 'shopfront-present', text: 'shopfront present', owner: 'F2 ground band: where shops are', label: 'shopfront' },
  { id: 'shopfront-form', text: 'shopfront form', owner: 'F2 ground band: shopfront form', label: 'shopfrontForm' },
  { id: 'crown-gable', text: 'crown/gable type', owner: 'F1 crowns (instanced)', label: 'crown' },
  { id: 'eaves-cornice', text: 'eaves/cornice height', owner: 'F1 crowns: eaves from the measured crown', label: 'cornice' },
  { id: 'roof-dormer', text: 'roof/dormer', owner: 'F1 crowns: roof and dormers', label: 'roof' },
  { id: 'blank-wall', text: 'blank/missing wall', owner: 'world: missing or blank front', label: null },
  { id: 'wrong-building', text: 'wrong building/outline', owner: 'world: footprint/outline', label: null },
  { id: 'none', text: "none: can't tell", owner: null, label: null },
] as const;

export type GapId = typeof GAP_TERMS[number]['id'];
export type Severity = 1 | 2 | 3;
export type Side = 'A' | 'B';

/** One parsed critic answer for one pair. `game` is the half the critic names as the game. */
export interface CriticAnswer {
  pair: string;
  game: Side;
  gap: GapId;
  severity: Severity | null;
  confidence: 'low' | 'med' | 'high' | null;
  note: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' /:-]+/g, ' ').replace(/\s+/g, ' ').trim();
const ALIASES: Record<string, GapId> = Object.fromEntries([
  ...GAP_TERMS.flatMap(t => [[norm(t.text), t.id], [norm(t.id), t.id]]),
  [norm('wall colour'), 'wall-colour'], [norm('wall color'), 'wall-colour'], [norm('wall color/tone'), 'wall-colour'], [norm('colour/tone'), 'wall-colour'],
  [norm('brick vs. render'), 'brick-vs-render'], [norm('white surrounds'), 'white-accents'], [norm('white bands'), 'white-accents'],
  [norm('door bay'), 'door-bay'], [norm('door reveal'), 'door-bay'], [norm('crown/gable'), 'crown-gable'], [norm('gable type'), 'crown-gable'],
  [norm('eaves/cornice'), 'eaves-cornice'], [norm('cornice height'), 'eaves-cornice'], [norm('roof/dormers'), 'roof-dormer'],
  [norm('blank wall'), 'blank-wall'], [norm('missing wall'), 'blank-wall'], [norm('wrong building'), 'wrong-building'], [norm('wrong outline'), 'wrong-building'],
  [norm('none'), 'none'], [norm("can't tell"), 'none'], [norm('none: cant tell'), 'none'],
]);

/** The vocabulary term a critic wrote, or null when it is not one of the closed terms (the answer is then rejected, not guessed). */
export function gapIdOf(text: string): GapId | null {
  return ALIASES[norm(text)] ?? null;
}

/** The vocabulary as the critic prompt lists it (one term per line, exact spelling). */
export function vocabularyLines(): string[] {
  return GAP_TERMS.map(t => `- ${t.text}`);
}
