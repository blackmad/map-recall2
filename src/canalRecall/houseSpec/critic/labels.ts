/**
 * Hand labels of the facade benchmark (lane F4, #379): what the round-0 pose photo shows for each pand, in the closed
 * vocabulary's fields, so a critic gap ("window kind") can be read against the photo's truth ("T-window") and the kit-gap
 * queue can say what the renderer must learn to draw. Reading convention: scripts/house-line/benchmark/labels.md.
 */
export const LABEL_ENUMS = {
  windowKind: ['sash', 'T-window', 'casement', 'large-pane', 'mixed', 'unknown'],
  windowHead: ['flat', 'segmental', 'round', 'pointed', 'mixed', 'unknown'],
  paneLayout: ['single', 'two-pane', 'multi-pane', 'top-light', 'mixed', 'unknown'],
  doorBay: ['left', 'centre', 'right', 'several', 'none', 'unknown'],
  doorReveal: ['flush', 'inset', 'portiek', 'unknown'],
  shopfrontForm: ['none', 'display-windows', 'full-glass', 'recessed-entrance', 'two-storey', 'closed', 'unknown'],
  crown: ['step', 'neck', 'bell', 'spout', 'point', 'cornice', 'flat', 'mansard', 'pitched-eaves', 'other', 'unknown'],
  cornice: ['none', 'timber', 'stone', 'parapet', 'unknown'],
  roof: ['not-visible', 'dormer', 'pitched', 'mansard', 'unknown'],
  finish: ['brick', 'painted-brick', 'render', 'stone', 'mixed', 'unknown'],
  wallFamily: ['red-brown', 'dark-brown', 'orange-red', 'yellow-buff', 'white-cream', 'grey', 'near-black', 'green', 'other'],
  wallDarkness: ['light', 'mid', 'dark'],
} as const;

type E<K extends keyof typeof LABEL_ENUMS> = typeof LABEL_ENUMS[K][number];

export interface BenchLabels {
  /** Full street-facing storeys: the ground storey once, no souterrain, no attic inside the crown. */
  storeys: number;
  /** Window columns per storey, ground storey first (ground: door + windows/shop bays as separate openings). */
  columns: number[];
  windowKind: E<'windowKind'>;
  windowHead: E<'windowHead'>;
  paneLayout: E<'paneLayout'>;
  whiteAccents: { bands: boolean; surrounds: boolean; keystones: boolean; quoins: boolean; whiteFrames: boolean };
  doorBay: E<'doorBay'>;
  doorReveal: E<'doorReveal'>;
  shopfront: boolean;
  shopfrontForm: E<'shopfrontForm'>;
  crown: E<'crown'>;
  cornice: E<'cornice'>;
  roof: E<'roof'>;
  finish: E<'finish'>;
  wallTone: { family: E<'wallFamily'>; darkness: E<'wallDarkness'> };
  /** The pand's wall is one house front (false: two or more fronts on one pand, or a block). */
  oneFront: boolean;
  confidence: 'low' | 'med' | 'high';
}

/** Problems with one label record (empty = valid). */
export function labelProblems(l: any): string[] {
  const out: string[] = [];
  if (!l || typeof l !== 'object') return ['not an object'];
  if (!Number.isInteger(l.storeys) || l.storeys < 1 || l.storeys > 15) out.push(`storeys ${l.storeys}`);
  if (!Array.isArray(l.columns) || !l.columns.length || l.columns.some((c: unknown) => !Number.isInteger(c) || (c as number) < 0 || (c as number) > 40)) out.push(`columns ${JSON.stringify(l.columns)}`);
  else if (Number.isInteger(l.storeys) && l.columns.length !== l.storeys) out.push(`columns has ${l.columns.length} storeys, storeys is ${l.storeys}`);
  const enumOf: Array<[string, keyof typeof LABEL_ENUMS, unknown]> = [
    ['windowKind', 'windowKind', l.windowKind], ['windowHead', 'windowHead', l.windowHead], ['paneLayout', 'paneLayout', l.paneLayout],
    ['doorBay', 'doorBay', l.doorBay], ['doorReveal', 'doorReveal', l.doorReveal], ['shopfrontForm', 'shopfrontForm', l.shopfrontForm],
    ['crown', 'crown', l.crown], ['cornice', 'cornice', l.cornice], ['roof', 'roof', l.roof], ['finish', 'finish', l.finish],
    ['wallTone.family', 'wallFamily', l.wallTone?.family], ['wallTone.darkness', 'wallDarkness', l.wallTone?.darkness],
  ];
  for (const [name, k, v] of enumOf) if (!(LABEL_ENUMS[k] as readonly unknown[]).includes(v)) out.push(`${name} "${v}"`);
  for (const k of ['bands', 'surrounds', 'keystones', 'quoins', 'whiteFrames']) if (typeof l.whiteAccents?.[k] !== 'boolean') out.push(`whiteAccents.${k}`);
  if (typeof l.shopfront !== 'boolean') out.push('shopfront');
  else if (!l.shopfront && l.shopfrontForm !== 'none') out.push('shopfrontForm without a shopfront');
  else if (l.shopfront && l.shopfrontForm === 'none') out.push('shopfront with form none');
  if (typeof l.oneFront !== 'boolean') out.push('oneFront');
  if (!['low', 'med', 'high'].includes(l.confidence)) out.push(`confidence "${l.confidence}"`);
  return out;
}
