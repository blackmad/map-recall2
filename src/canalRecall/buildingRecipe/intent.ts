/**
 * Intent recipe: what a person (or a vision model) decides from a photo.
 *
 * It names components and counts, never coordinates or metres. Everything
 * metric comes from `facts.json` (BAG footprint, 3DBAG LoD2.2 roof planes and
 * the street-facing frontage) and is derived by the deterministic fit step.
 * This follows docs/plans/facade-component-output-contract.md on
 * terra/facade-component-contract: the model selects and classifies, a
 * compiler builds geometry.
 */

export const GABLES = ['spout', 'neck', 'raised-neck', 'bell', 'step', 'point', 'cornice', 'flat'] as const;
export type GableIntent = typeof GABLES[number];
export const CORNICES = ['none', 'simple', 'bracketed', 'heavy'] as const;
export const CROWN_CAPS = ['flat', 'rounded', 'pediment'] as const;
export const BASEMENTS = ['none', 'windows', 'stoop', 'stoop-and-windows'] as const;
export const WINDOWS = ['sash', 'sash-small-panes', 'cross', 'plain', 'arched', 'shop'] as const;
export const ROOF_MATERIALS = ['slate', 'black-tile', 'red-tile', 'bitumen', 'zinc', 'copper'] as const;
export const WINDOW_SURROUNDS = ['none', 'stone-lintel', 'full-frame', 'keystone'] as const;
export const QUOINS = ['none', 'stone'] as const;
export const AWNING_STYLES = ['none', 'fabric-straight', 'fabric-dutch'] as const;
export const SOURCE_KINDS = ['street-panorama', 'archive-photo', 'monument-record', 'human-review'] as const;

/** Named swatches keep colour a classification; `#rrggbb` is accepted when a
 * photo sample is available (it is a colour, not a coordinate). */
export const SWATCHES: Record<string, string> = {
  'red-brown': '#7a3e2c', 'dark-brown': '#4e3027', 'orange-brick': '#9a5236', 'yellow-brick': '#b39468',
  'grey-brick': '#6d6560', 'black-painted': '#2a2a2a', 'white-painted': '#e6e2d8', 'cream-painted': '#d9ccaa',
  'grey-painted': '#9a9a94', 'sandstone': '#c8bb9c',
  white: '#ece9e0', cream: '#e4dcc4', 'dark-green': '#26392f', black: '#1f2121', 'dark-red': '#5a2224',
  'dark-blue': '#23303f', grey: '#7c7f7c', brown: '#4a3426', 'natural-wood': '#7a5a3a',
};

export interface IntentSource {
  id: string;
  kind: typeof SOURCE_KINDS[number];
  /** ISO date of the photo/record. */
  capturedAt: string;
  url?: string;
  license?: string;
  /** Local reference image (repo-relative), e.g. the facts-step panorama crop. */
  image?: string;
}

export interface FrontIntent {
  id: string;
  /** Street (or canal-side street) this elevation faces; resolved against the routing extract. */
  street: string;
  /** Left-to-right share of the discovered frontage when several fronts face one street. */
  share?: number;
  gable: GableIntent;
  /** Crown top shape for neck/bell/cornice crowns. */
  crownCap?: typeof CROWN_CAPS[number];
  /** Cornice crowns: the cap is a narrow centre piece (default) or a wide parapet across the front (1900s Bilderdijkstraat fronts). */
  crownCapSpan?: 'narrow' | 'wide';
  /** Full storeys below the crown, including the ground storey. */
  storeys: number;
  /** Window bays per full storey (one number, or one per storey from the ground up). */
  bays: number | number[];
  /** Windows inside the gable/crown above the top full storey. */
  atticWindows?: number;
  /** Roof dormers standing on the eaves line behind a cornice/flat front. */
  dormers?: number;
  /** 0-based bay (left-to-right, as seen from the street) holding the main door; null = no door. */
  doorBay: number | null;
  /** Ground storey noticeably taller than upper storeys (bel-etage / shop level). */
  tallGround?: boolean;
  basement: typeof BASEMENTS[number];
  cornice: typeof CORNICES[number];
  windows: typeof WINDOWS[number];
  /** 0-based storeys whose windows have round-arched heads (often the top storey under a parapet). */
  archedStoreys?: number[];
  /** Relieving arches over arched/segmental windows: stone dressing, the palette's band brick, or none. Default: band brick when the palette has one, else stone. */
  archRings?: 'stone' | 'band' | 'none';
  hoist: boolean;
  shutters?: 'none' | 'ground' | 'all';
  shopfront?: { colour: string; fascia: boolean; awning?: ShopAwningIntent;
    /** The shop's sign as read on the dated photo: block capitals on the fascia board, on the wall above the glass, or on the glass. */
    sign?: ShopSignIntent;
    /** Separate display-window panes across the shop glass (mullion groups); default by width. */
    displayWindows?: number;
    /** Stall riser under the shop glass: none (glass to the pavement), low, or standard (default). */
    stallRiser?: 'none' | 'low' | 'standard' };
  /** Stone dressing around the upper windows (colour: the palette's `stone`): a lintel slab, lintel + sill + jambs, or a keystone block over each head. Default none. */
  windowSurround?: typeof WINDOW_SURROUNDS[number];
  /** 0-based storeys carrying the surround; default every window storey above the shopfront. */
  surroundStoreys?: number[];
  /** Alternating long/short stone corner blocks up both edges of the front. Default none. */
  quoins?: typeof QUOINS[number];
  /** Iron/stone balcony guards on upper-storey windows. `storeys` are 0-based (ground = 0, so >= 1); the window becomes a full-height French window. */
  balconies?: { storeys: number[]; bays: number[]; projecting?: boolean };
  /** Glazed bay windows (erkers): the windows of these upper storeys in `bay` become one projecting three-face bay each. */
  bayWindows?: { bay: number; storeys: number[] };
  /** Horizontal masonry courses: a stone sill line at every upper storey and/or lintel bands (stripes of a different brick). */
  bands?: 'none' | 'storey' | 'lintel' | 'both';
  /** The same house module repeated along this front (rows built together, double fronts). */
  repeat?: { count: number | 'fit'; mirrorAlternate?: boolean };
  /** Per-front palette when one owner has visibly different fronts. */
  palette?: Partial<PaletteIntent>;
}

/** Fabric awning over the shop glass: `extent` is the covered share of the front width, as fractions from the viewer's left (default the whole shop front). */
export interface ShopAwningIntent { style: typeof AWNING_STYLES[number]; colour: string; extent?: { from: number; to: number } }

/** Shop sign text (letters A-Z, 0-9, & ' - . and spaces; drawn as 5x7 block capitals) and letter colour. */
export interface ShopSignIntent { text: string; colour: string; mount?: 'fascia' | 'wall' | 'glazing' }
export const SIGN_TEXT = /^[A-Za-z0-9&'.\- ]{1,28}$/;

/** `band`: a second brick colour for banding and relieving arches (lintel bands become brick stripes). */
export interface PaletteIntent { brick: string; frame: string; door: string; shutters?: string; stone?: string; band?: string }

/** Ordinary canal house: crown/gable family plus a regular bay grid per front. */
export interface CanalHouseIntent {
  schemaVersion: 1;
  kind: 'canal-house';
  /** Slug used for file names. */
  id: string;
  /** BAG Pand identificatie, 16 digits. */
  pandId: string;
  address: string;
  sources: IntentSource[];
  fronts: FrontIntent[];
  roof: { material: typeof ROOF_MATERIALS[number] };
  palette: PaletteIntent;
  notes?: string[];
}

/**
 * Planned tier for large buildings (schools, blocks, warehouses, most
 * landmarks): keep 3DBAG LoD2.2 massing as-is and choose a facade SYSTEM per
 * wall, addressed by 3DBAG wall surface index (never coordinates). Typed here
 * so the union and compiler dispatch exist; the compiler rejects it until built.
 */
export interface LargeBuildingIntent {
  schemaVersion: 1;
  kind: 'large';
  id: string; pandId: string; address: string;
  sources: IntentSource[];
  walls: {wallSurfaces: number[]; system: 'brick-bay-grid' | 'ribbon-windows' | 'curtain-wall' | 'plinth-shopfronts' | 'blank'; storeys?: number; baysPerStorey?: number; entrance?: boolean; signage?: string}[];
  roofPlant?: boolean;
  palette: PaletteIntent;
  notes?: string[];
}

export type BuildingIntent = CanalHouseIntent | LargeBuildingIntent;

const COORDINATE_KEYS = /^(x|y|z|left|right|top|bottom|width|height|depth|offset|position|coordinates|ring|vertices|plane)(M)?$|M$/;

/** Validate a parsed intent JSON. Throws one error listing every problem. */
export function validateIntent(input: unknown): CanalHouseIntent {
  const problems: string[] = [];
  const intent = input as CanalHouseIntent;
  if ((input as {kind?: string})?.kind === 'large') throw new Error(`Intent ${intent?.id}: kind "large" is planned but not implemented yet`);
  if (intent?.kind !== 'canal-house') problems.push('kind must be "canal-house"');
  const oneOf = (value: unknown, allowed: readonly string[], where: string) => {
    if (!allowed.includes(value as string)) problems.push(`${where}: ${JSON.stringify(value)} not in ${allowed.join('|')}`);
  };
  const count = (value: unknown, where: string, min = 0, max = 30) => {
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) problems.push(`${where}: expected integer ${min}..${max}`);
  };
  const colour = (value: unknown, where: string) => {
    if (typeof value !== 'string' || !(value in SWATCHES || /^#[0-9a-f]{6}$/i.test(value))) problems.push(`${where}: unknown colour ${JSON.stringify(value)}`);
  };
  // The contract: no metric or coordinate fields anywhere in an intent.
  const scan = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
      if (COORDINATE_KEYS.test(k)) problems.push(`${path}.${k}: coordinate/metric field not allowed in an intent recipe`);
      scan(v, `${path}.${k}`);
    }
  };
  scan(input, 'intent');
  if (!intent || intent.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (!/^[a-z0-9-]+$/.test(intent?.id ?? '')) problems.push('id must be a lowercase slug');
  if (!/^\d{16}$/.test(intent?.pandId ?? '')) problems.push('pandId must be 16 digits');
  if (!Array.isArray(intent?.sources) || !intent.sources.length) problems.push('at least one source is required');
  else for (const s of intent.sources) {
    oneOf(s.kind, SOURCE_KINDS, `source ${s.id}.kind`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.capturedAt ?? '')) problems.push(`source ${s.id}.capturedAt must be YYYY-MM-DD`);
  }
  if (!Array.isArray(intent?.fronts) || !intent.fronts.length) problems.push('at least one front is required');
  else for (const f of intent.fronts) {
    const at = `front ${f.id}`;
    if (!f.street) problems.push(`${at}.street required`);
    oneOf(f.gable, GABLES, `${at}.gable`);
    if (f.crownCap !== undefined) oneOf(f.crownCap, CROWN_CAPS, `${at}.crownCap`);
    count(f.storeys, `${at}.storeys`, 1, 12);
    const bays = Array.isArray(f.bays) ? f.bays : [f.bays];
    bays.forEach((b, i) => count(b, `${at}.bays[${i}]`, 0, 16));
    if (Array.isArray(f.bays) && f.bays.length !== f.storeys) problems.push(`${at}.bays: one entry per storey (${f.storeys})`);
    if (f.atticWindows !== undefined) count(f.atticWindows, `${at}.atticWindows`, 0, 6);
    if (f.dormers !== undefined) count(f.dormers, `${at}.dormers`, 0, 8);
    if (f.doorBay !== null) count(f.doorBay, `${at}.doorBay`, 0, Math.max(0, bays[0] - 1));
    oneOf(f.basement, BASEMENTS, `${at}.basement`);
    oneOf(f.cornice, CORNICES, `${at}.cornice`);
    oneOf(f.windows, WINDOWS, `${at}.windows`);
    if (typeof f.hoist !== 'boolean') problems.push(`${at}.hoist must be boolean`);
    if (f.shutters !== undefined) oneOf(f.shutters, ['none', 'ground', 'all'], `${at}.shutters`);
    if (f.balconies) { f.balconies.storeys.forEach(v => count(v, `${at}.balconies.storeys`, 1, f.storeys - 1)); f.balconies.bays.forEach(v => count(v, `${at}.balconies.bays`, 0, 15)); }
    if (f.bayWindows) { count(f.bayWindows.bay, `${at}.bayWindows.bay`, 0, 15); f.bayWindows.storeys.forEach(v => count(v, `${at}.bayWindows.storeys`, 1, f.storeys - 1)); }
    if (f.bands !== undefined) oneOf(f.bands, ['none', 'storey', 'lintel', 'both'], `${at}.bands`);
    if (f.crownCapSpan !== undefined) oneOf(f.crownCapSpan, ['narrow', 'wide'], `${at}.crownCapSpan`);
    if (f.archedStoreys !== undefined) { if (!Array.isArray(f.archedStoreys)) problems.push(`${at}.archedStoreys must be a list`); else f.archedStoreys.forEach(v => count(v, `${at}.archedStoreys`, 0, f.storeys - 1)); }
    if (f.archRings !== undefined) oneOf(f.archRings, ['stone', 'band', 'none'], `${at}.archRings`);
    if (f.repeat) { if (f.repeat.count !== 'fit') count(f.repeat.count, `${at}.repeat.count`, 1, 20); }
    if (f.share !== undefined && !(f.share > 0 && f.share <= 1)) problems.push(`${at}.share must be in (0,1]`);
    if (f.shopfront) colour(f.shopfront.colour, `${at}.shopfront.colour`);
    if (f.windowSurround !== undefined) oneOf(f.windowSurround, WINDOW_SURROUNDS, `${at}.windowSurround`);
    if (f.surroundStoreys !== undefined) { if (!Array.isArray(f.surroundStoreys)) problems.push(`${at}.surroundStoreys must be a list`); else f.surroundStoreys.forEach(v => count(v, `${at}.surroundStoreys`, 0, f.storeys - 1)); }
    if (f.quoins !== undefined) oneOf(f.quoins, QUOINS, `${at}.quoins`);
    const sign = f.shopfront?.sign;
    if (sign) {
      if (typeof sign.text !== 'string' || !SIGN_TEXT.test(sign.text)) problems.push(`${at}.shopfront.sign.text: 1-28 of A-Z 0-9 & ' - . space`);
      colour(sign.colour, `${at}.shopfront.sign.colour`);
      if (sign.mount !== undefined) oneOf(sign.mount, ['fascia', 'wall', 'glazing'], `${at}.shopfront.sign.mount`);
      if ((sign.mount ?? 'fascia') === 'fascia' && !f.shopfront!.fascia) problems.push(`${at}.shopfront.sign: a fascia-mounted sign needs fascia: true`);
    }
    if (f.shopfront?.displayWindows !== undefined) count(f.shopfront.displayWindows, `${at}.shopfront.displayWindows`, 1, 8);
    if (f.shopfront?.stallRiser !== undefined) oneOf(f.shopfront.stallRiser, ['none', 'low', 'standard'], `${at}.shopfront.stallRiser`);
    const aw = f.shopfront?.awning;
    if (aw) {
      oneOf(aw.style, AWNING_STYLES, `${at}.shopfront.awning.style`);
      colour(aw.colour, `${at}.shopfront.awning.colour`);
      if (aw.extent && !(aw.extent.from >= 0 && aw.extent.to <= 1 && aw.extent.to - aw.extent.from >= 0.15)) problems.push(`${at}.shopfront.awning.extent: need 0 <= from < to <= 1 covering at least 0.15`);
    } else if ((f as {awning?: unknown}).awning !== undefined) problems.push(`${at}.awning: awnings belong under shopfront.awning`);
    for (const [k, v] of Object.entries(f.palette ?? {})) colour(v, `${at}.palette.${k}`);
  }
  oneOf(intent?.roof?.material, ROOF_MATERIALS, 'roof.material');
  for (const k of ['brick', 'frame', 'door'] as const) colour(intent?.palette?.[k], `palette.${k}`);
  for (const k of ['shutters', 'stone', 'band'] as const) if (intent?.palette?.[k] !== undefined) colour(intent.palette[k], `palette.${k}`);
  if (problems.length) throw new Error(`Invalid intent ${intent?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return intent;
}

export const swatch = (value: string): string => SWATCHES[value] ?? value;
