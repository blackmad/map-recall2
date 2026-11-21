/**
 * Belt review stage 2: the readable description fields David checks beside the photo, in lane C's vocabulary
 * (beltReview/description.ts DESC_FIELDS), each with the kit values he may choose from (buildingRecipe/intent.ts enums and
 * the HouseSpec spec-level values). A correction is a choice, never free text; a value the reader gave that is not a kit
 * value is still shown, marked as such. Browser-safe: the page imports this.
 */
import { BASEMENTS, CORNICES, GABLES, WALL_MATERIALS, WINDOWS, WINDOW_HEADS, WINDOW_SURROUNDS } from '../buildingRecipe/intent.ts';

/** The description fields, in the order the page lists them (lane C's DESC_FIELDS). */
export const DESC_FIELDS = [
  'storeys', 'bays', 'crown', 'cornice', 'roofStorey', 'dormers', 'heads', 'windows', 'windowSurround',
  'wallFinish', 'wallColour', 'whiteFrames', 'ground', 'door', 'stoop', 'eavesM', 'facadeYear',
] as const;
export type DescField = typeof DESC_FIELDS[number];

/** Sources counted as "from the library" in the ledger (lane C LIBRARY_SOURCES); anything else is a new read. */
export const LIBRARY_SOURCES = new Set(['reviewed', 'face-intent', 'photo-read', 'own-read', 'register', 'survey', 'based-on']);

export const WALL_FAMILIES = ['white', 'grey', 'buff', 'orange', 'red', 'red-brown', 'brown', 'dark'] as const;

export interface FieldOption { value: unknown; label: string }
export interface FieldSpec {
  field: DescField;
  label: string;
  /** The pin tag a problem with this field files under (stage 4). */
  group: string;
  /** null = read only (measured, not chosen). */
  options: FieldOption[] | null;
  /** Spec path the renderer writes the field to (for the reader; design.ts does the mapping). */
  specPath: string;
}

const opts = (values: readonly unknown[], label = (v: unknown) => String(v)): FieldOption[] => values.map(value => ({ value, label: label(value) }));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const FIELD_SPECS: Record<DescField, FieldSpec> = {
  storeys: { field: 'storeys', label: 'Storeys', group: 'height-roofline', options: opts(range(1, 9)), specPath: 'fronts/0/storeys' },
  bays: { field: 'bays', label: 'Bays', group: 'windows', options: opts(range(1, 12)), specPath: 'fronts/0/bays' },
  crown: { field: 'crown', label: 'Gable / crown', group: 'gable-crown', options: opts([...GABLES, 'pitched-eaves']), specPath: 'fronts/0/gable' },
  cornice: { field: 'cornice', label: 'Cornice', group: 'gable-crown', options: opts([...CORNICES, 'attic-frieze']), specPath: 'fronts/0/cornice' },
  roofStorey: { field: 'roofStorey', label: 'Roof storey', group: 'height-roofline', options: opts(['none', 'mansard', 'attic', 'dormers', 'gable-attic']), specPath: 'fronts/0/roofStorey' },
  dormers: {
    field: 'dormers', label: 'Dormers', group: 'height-roofline',
    options: [{ value: { count: 0 }, label: 'none' }, ...[1, 2, 3].flatMap(count => (['plain', 'gabled'] as const).map(kind => ({ value: { count, kind }, label: `${count} ${kind}` })))],
    specPath: 'fronts/0/readDormers',
  },
  heads: { field: 'heads', label: 'Window head', group: 'windows', options: opts([...WINDOW_HEADS, 'pointed', 'mixed']), specPath: 'fronts/0/windowHead' },
  windows: { field: 'windows', label: 'Windows', group: 'windows', options: opts(WINDOWS), specPath: 'fronts/0/windows' },
  windowSurround: { field: 'windowSurround', label: 'Window surround', group: 'white-accents', options: opts([...WINDOW_SURROUNDS, 'block-dressings']), specPath: 'fronts/0/windowSurround' },
  wallFinish: { field: 'wallFinish', label: 'Wall material', group: 'wall-colour-material', options: opts([...WALL_MATERIALS, 'stone']), specPath: 'palette/wallMaterial' },
  wallColour: { field: 'wallColour', label: 'Wall colour', group: 'wall-colour-material', options: opts(WALL_FAMILIES), specPath: 'palette/brick' },
  whiteFrames: { field: 'whiteFrames', label: 'White frames', group: 'white-accents', options: [{ value: true, label: 'yes' }, { value: false, label: 'no' }], specPath: 'palette/frame' },
  ground: { field: 'ground', label: 'Ground floor', group: 'ground-floor-door-stoop', options: opts(['dwelling', 'shop', 'door-only', 'warehouse']), specPath: 'facts/groundKind' },
  door: {
    field: 'door', label: 'Door', group: 'ground-floor-door-stoop',
    options: [{ value: null, label: 'not drawn' }, ...range(0, 5).flatMap(bay => [{ value: { bay }, label: `bay ${bay + 1}` }, { value: { bay, surround: true }, label: `bay ${bay + 1}, dressed doorcase` }])],
    specPath: 'fronts/0/doorBay',
  },
  stoop: { field: 'stoop', label: 'Stoop / basement', group: 'ground-floor-door-stoop', options: opts(BASEMENTS), specPath: 'fronts/0/basement' },
  eavesM: { field: 'eavesM', label: 'Eaves height (m)', group: 'height-roofline', options: null, specPath: 'fronts/0/storeyHeights' },
  facadeYear: { field: 'facadeYear', label: 'Facade year', group: 'other', options: null, specPath: 'facts/facadeYear' },
};

export const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Display text of a field value. */
export function showValue(field: DescField, v: unknown): string {
  if (v === undefined) return '–';
  if (v === null) return field === 'door' ? 'not drawn' : '–';
  if (field === 'dormers' && typeof v === 'object') { const d = v as { count?: number; kind?: string }; return d.count ? `${d.count} ${d.kind ?? ''}`.trim() : 'none'; }
  if (field === 'door') {
    if (typeof v === 'number') return `bay ${v + 1}`;
    const d = v as { bay?: number; surround?: boolean };
    return [d.bay !== undefined ? `bay ${d.bay + 1}` : 'bay ?', d.surround ? 'dressed doorcase' : ''].filter(Boolean).join(', ');
  }
  if (field === 'whiteFrames') return v ? 'yes' : 'no';
  if (field === 'eavesM' && typeof v === 'number') return `${v.toFixed(1)} m`;
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** True when the value is one of the field's kit options. */
export const isKitValue = (field: DescField, v: unknown) => !FIELD_SPECS[field].options || FIELD_SPECS[field].options!.some(o => same(o.value, v));
