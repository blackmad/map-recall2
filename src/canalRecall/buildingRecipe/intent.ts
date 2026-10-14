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
import type {LargeGround, LargeSystemName, LargeWindow} from '../blockBuilding/systems.ts';
import type {ArchKind} from '../blockBuilding/arch.ts';

export const GABLES = ['spout', 'neck', 'raised-neck', 'bell', 'step', 'point', 'cornice', 'flat'] as const;
export type GableIntent = typeof GABLES[number];
export const CORNICES = ['none', 'simple', 'bracketed', 'heavy'] as const;
export const CROWN_CAPS = ['flat', 'rounded', 'pediment'] as const;
export const CROWN_CAP_RISES = ['low', 'normal'] as const;
export const CROWN_CAP_SPANS = ['narrow', 'medium', 'wide'] as const;
export const SHOP_ENTRANCES = ['none', 'centre-recessed', 'centre', 'left', 'right', 'left-recessed', 'right-recessed'] as const;
export const SHOP_GLAZING = ['single', 'split', 'transom'] as const;
export const STALLRISERS = ['none', 'low', 'medium', 'high'] as const;
export const BASEMENTS = ['none', 'windows', 'stoop', 'stoop-and-windows'] as const;
/**
 * Window joinery. `ladder` (Amsterdam School, 1915-1935): a tall narrow light 0.55-0.75 m wide and about 0.7 of the
 * storey high, with 4-6 horizontal glazing bars (one per ~0.5 m of height) and no vertical bar. A bay whose cell is wide
 * enough for two such lights and a 0.16 m brick pier (cells of about 1.6 m and more) holds a PAIR of ladder lights, a
 * narrower bay one: the pairing follows the bay widths (`bayWidths`: wide entries pair, narrow ones stay single).
 */
export const WINDOWS = ['sash', 'sash-small-panes', 'cross', 'plain', 'arched', 'shop', 'two-light', 'ladder'] as const;
export const WINDOW_PROPORTIONS = ['standard', 'tall'] as const;
export const ATTIC_SHAPES = ['rectangular', 'round'] as const;
export const ROOF_MATERIALS = ['slate', 'black-tile', 'red-tile', 'bitumen', 'zinc', 'copper'] as const;
export const WINDOW_SURROUNDS = ['none', 'stone-lintel', 'full-frame', 'keystone'] as const;
export const QUOINS = ['none', 'stone'] as const;
/**
 * Shop canopy. `fabric-straight`/`fabric-dutch`: a sloped fabric awning. `rigid` (Amsterdam School luifel): a horizontal
 * slab 1.2 m deep and 0.16 m thick whose underside sits 2 cm over the shop-glass head (over the fascia board when the
 * shop has one), with a 0.3 m vertical fascia on its nose (6 cm thick, top flush with the slab, hanging 0.14 m below it).
 * It covers `extent` (default the whole front, 5 cm short of each end). A block face's `continuity.canopy` group sets one
 * height for its members and runs each member's slab to the shared party plane, so the row reads as one slab while each
 * pand keeps its own piece (blockFace/intent.ts).
 */
export const AWNING_STYLES = ['none', 'fabric-straight', 'fabric-dutch', 'rigid'] as const;
export const SOURCE_KINDS = ['street-panorama', 'archive-photo', 'monument-record', 'human-review'] as const;
/** Historic (17th/18th-c.) canal-house vocabulary, see `HistoricFrontIntent`. */
export const GABLE_WINGS = ['volutes', 'scrolls'] as const;
export const GABLE_FINIALS = ['crab', 'vase', 'ball'] as const;
export const ROOF_GABLETS = ['crest', 'pediment'] as const;
export const GROUND_FRONT_KINDS = ['arcade', 'pui', 'wall'] as const;
export const GROUND_BAYS = ['door', 'glazed-door', 'window', 'shutter', 'panel'] as const;
export type GroundBay = typeof GROUND_BAYS[number];
export const DORMER_STYLES = ['plain', 'pediment', 'pointed'] as const;
/** Tower caps: a pyramid, a flat slab, or `stepped` (Amsterdam School: two receding brick tiers under a flat slab). */
export const TOWER_CAPS = ['pyramid', 'flat', 'stepped'] as const;
/** Cap on the top storey of a multi-bay erker (`bayWindows.bays`): a hipped lean-to roof, a flat slab, or none (a plain closure). */
export const ERKER_CAPS = ['hip', 'flat', 'none'] as const;
/** Largest forward lean a front may declare (degrees); real Amsterdam fronts lean up to ~2 degrees ("op vlucht"). */
export const MAX_LEAN_DEGREES = 3;

/** Named swatches keep colour a classification; `#rrggbb` is accepted when a
 * photo sample is available (it is a colour, not a coordinate). */
export const SWATCHES: Record<string, string> = {
  'red-brown': '#7a3e2c', 'dark-brown': '#4e3027', 'orange-brick': '#9a5236', 'yellow-brick': '#b39468',
  'grey-brick': '#6d6560', 'black-painted': '#2a2a2a', 'white-painted': '#e6e2d8', 'cream-painted': '#d9ccaa',
  'grey-painted': '#9a9a94', 'sandstone': '#c8bb9c',
  white: '#ece9e0', cream: '#e4dcc4', 'dark-green': '#26392f', black: '#1e1e1e', 'dark-red': '#5a2224',
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
  crownCapSpan?: typeof CROWN_CAP_SPANS[number];
  /** Cap height: `low` = a shallow pointed pediment/segment (about 0.35 m), default `normal`. */
  crownCapRise?: typeof CROWN_CAP_RISES[number];
  /**
   * Window axes. The front has `axisGrid` vertical axes (default: the largest per-storey bay count above the
   * ground storey). Every storey's windows sit on those axes, so they line up between storeys and the piers
   * between them are equal. A storey with fewer windows names the axes it uses (`storeyAxes: {"4": [0,1,3]}`,
   * storey index from the ground = 0; key "last" = the top storey); without a list a storey that is centred on the
   * grid uses the centred axes, any other mismatch warns and falls back to its own even spacing.
   */
  axisGrid?: number;
  storeyAxes?: Record<string, number[]>;
  /** `equal` (default): the outer piers equal the inner ones. `margin`: legacy 9% side margins. */
  piers?: 'equal' | 'margin';
  /**
   * Unequal bays. Relative widths (weights; `[1, 2]` = the right bay twice as wide, metres work too: they are
   * normalised to the front) of the `axisGrid` bays left to right. Every window sits in the middle of its bay and is
   * as wide as the bay allows, so axes, window widths, balconies and the crown/shop spans below follow the bays.
   * Default: the shared equal-pier grid. Needs one entry per axis (`axisGrid`, else the widest upper storey).
   */
  bayWidths?: number[];
  /** A storey whose windows do not sit on the shared bays gives its own weights (one per window of that storey; key = storey index from the ground, or "last"), e.g. `{"4": [1, 0.6, 0.6]}` for one far-left and a close pair. */
  storeyBayWidths?: Record<string, number[]>;
  /**
   * Gable/crown that covers only part of the front: `{from, to}` as fractions of the front width from the viewer's
   * left (`{from: 0.4, to: 1}` = the right 60 %). Gable windows, the hoist and the crown cap follow it. Default: the whole front.
   */
  crownAt?: {from: number; to: number};
  /**
   * Crown height in upper-storey heights above the eaves (`1.1` = a gable about one storey tall: a tall stepped Marnixstraat
   * gable is ~1.1). Default: the fitted proportion (about 0.9 of the crown width, capped by the 3DBAG ridge).
   * Works for gables and for cornice crowns with a cap.
   */
  crownRise?: number;
  /** Number of steps per side of a `step` gable (default from its height, 2..5). */
  crownSteps?: number;
  /** A small finial block on the flat top of a step/neck/bell crown. */
  crownFinial?: boolean;
  /** `round`: the attic window is a round oculus instead of a rectangular light. */
  atticShape?: typeof ATTIC_SHAPES[number];
  /** `tall`: windows about 1.25x as high as the default for their width and set lower in the storey (two-light sashes of the 1870s). */
  windowProportion?: typeof WINDOW_PROPORTIONS[number];
  /** Same as `crownAt`, but as the inclusive range of bay axes the crown stands over (`{from: 2, to: 2}` = the third axis); follows `bayWidths`. Not together with `crownAt`. */
  crownBays?: {from: number; to: number};
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
  /** The basement is a souterrain: a full storey (half below the street) under a bel-etage reached by the stoop, with storey-sized windows, instead of a 0.7-1.2 m plinth. Needs a basement. */
  souterrain?: boolean;
  cornice: typeof CORNICES[number];
  windows: typeof WINDOWS[number];
  /** 0-based storeys whose windows have round-arched heads (often the top storey under a parapet). */
  archedStoreys?: number[];
  /** Relieving arches over arched/segmental windows: stone dressing, the palette's band brick, or none. Default: band brick when the palette has one, else stone. */
  archRings?: 'stone' | 'band' | 'none';
  hoist: boolean;
  shutters?: 'none' | 'ground' | 'all';
  shopfront?: ShopfrontIntent;
  /** Stone dressing around the upper windows (colour: the palette's `stone`): a lintel slab, lintel + sill + jambs, or a keystone block over each head. Default none. */
  windowSurround?: typeof WINDOW_SURROUNDS[number];
  /** 0-based storeys carrying the surround; default every window storey above the shopfront. */
  surroundStoreys?: number[];
  /** Alternating long/short stone corner blocks up both edges of the front. Default none. */
  quoins?: typeof QUOINS[number];
  /** Iron/stone balcony guards on upper-storey windows. `storeys` are 0-based (ground = 0, so >= 1); the window becomes a full-height French window. */
  balconies?: { storeys: number[]; bays: number[]; projecting?: boolean };
  /**
   * Glazed bay windows (erkers). `bay`: the windows of these upper storeys in that bay become one projecting three-face
   * bay each. `bays` instead of `bay` (Amsterdam School multi-bay erker): ONE bay projecting 0.55 m over the span of the
   * inclusive axes `{from, to}` (8 cm in from the span's bay edges), rising through the listed consecutive storeys as one
   * stack. Each storey: a solid stallriser panel 0.85 m high (wall brick) under a front light divided into two lights per
   * spanned axis, one light in each angled side (0.25 m return), a 0.2 m head panel; closed at its foot and top. `cap` on
   * the top storey: `hip` (a lean-to hipped roof rising 0.45 m to the wall, roof colour), `flat` (a 0.12 m slab overhanging
   * 6 cm, trim colour) or `none` (default: the closure only).
   */
  bayWindows?: { bay?: number; bays?: {from: number; to: number}; storeys: number[]; cap?: typeof ERKER_CAPS[number] };
  /**
   * Horizontal masonry courses: a stone sill line at every upper storey and/or lintel bands (stripes of a different brick).
   * `courses` (Amsterdam School brick banding, needs `palette.band`): the storeys in `courseStoreys` are laid whole in the
   * band brick (a 4 cm facing, cut around the openings), and every storey above the ground carries thin raised courses
   * at its lintel line in the band brick: 3 courses (2 on storeys under 2.8 m), 5 cm high, 11 cm apart, 7 cm proud,
   * starting 5 cm over the storey's window heads. A multi-bay erker interrupts both.
   */
  bands?: 'none' | 'storey' | 'lintel' | 'both' | 'courses';
  /** `bands: courses`: 0-based storeys laid whole in the band brick (ground = 0 only without a shopfront/ground front). */
  courseStoreys?: number[];
  /**
   * Brick lisenes (Amsterdam School pilasters) at the front's viewer-left (`leftEnd`) / right (`rightEnd`) end, from the top of the ground storey
   * to 0.3 m under the eaves, 0.1 m proud, with a 0.15 m corbel cap 0.16 m proud. `half` (0.25 m wide) is the house's half
   * of a lisene shared across the party wall (its outer face follows the party plane); `full` is a whole 0.45 m lisene.
   */
  lisenes?: { leftEnd?: 'half' | 'full'; rightEnd?: 'half' | 'full' };
  /**
   * Projecting brick hoods (Jan Evertsenstraat): over every upper-storey window, or over a ladder pair as one, a ledge in
   * the wall material 0.12 m high and 0.22 m proud, 2 cm over the head, 0.1 m wider than the window on each side.
   */
  windowHoods?: boolean;
  /** The same house module repeated along this front (rows built together, double fronts). */
  repeat?: { count: number | 'fit'; mirrorAlternate?: boolean };
  /** Per-front palette when one owner has visibly different fronts. */
  palette?: Partial<PaletteIntent>;
  /** Stone ornament of a historic gable or cornice front (De Wallen, 17th/18th c.); see `GableOrnamentIntent`. */
  gableOrnament?: GableOrnamentIntent;
  /**
   * Forward lean of the front in degrees (0..3), read from the rectified photo: Amsterdam fronts were built "op vlucht"
   * (leaning out). The front and the first metres of its side walls are sheared along the party walls, so party lines
   * stay closed; the ground line does not move.
   */
  leanDegrees?: number;
  /**
   * A ground storey of separate openings instead of one shop glass: `bays` left to right, each a door, a glazed door, a
   * glazed window, a roller-shuttered window or a closed panel. `arcade`: columns (piers) between the bays under a beam
   * (18th/19th-c. pier arcades); `pui`: a timber shopfront frame (thin posts, a heavy beam, panels under the glass);
   * `wall`: openings in the brick wall. `colour` paints the piers/posts/beam (default the frame colour); `shutterColour`
   * the roller shutters. Not together with `shopfront`; `doorBay` is ignored (the bays say where the doors are).
   */
  groundFront?: GroundFrontIntent;
  /** Roof seen from the street: `mansard` = a steep (about 70 degrees) roof face rising behind the cornice, its dormers standing on it. */
  roofFront?: 'mansard';
  /** Dormer design: `pediment` = a triangular pediment in the trim colour over a projecting frame; `pointed` = a tall pointed roof (19th-c. ornate dormers). Default `plain`. */
  dormerStyle?: typeof DORMER_STYLES[number];
  /** Several gables on one front: each `{from, to}` (inclusive bay axes) carries one crown of the front's gable type; eaves line between them. Not together with `crownAt`/`crownBays`. */
  crownGroups?: {from: number; to: number}[];
  /**
   * A brick tower rising over bays `bays` (inclusive axes) `rise` upper-storey heights above the eaves, with a pyramid,
   * flat or stepped cap; one light per storey of rise. `corner: true` instead of `bays` (a multi-front corner pand): the
   * tower stands on the corner where this front meets the pand's other front. Its plan is square (a parallelogram on an
   * oblique corner) with the two front planes as its outer walls and a side of clamp(0.3 x the shorter front, 2.4, 4.2) m
   * along each front from the shared corner; both fronts rise over that end (one light per storey of rise on each), two
   * inner walls and the cap close it. The two fronts must meet in one footprint vertex (within 0.3 m).
   */
  tower?: {bays?: {from: number; to: number}; corner?: boolean; rise: number; cap: typeof TOWER_CAPS[number]};
  /**
   * Clip street-side details (cornice, bands, sills, gable ornament) at oblique party walls so nothing crosses the party
   * plane (trapezoidal plots meet the front up to ~20 degrees off square). Block faces set it for every house with
   * `continuity.partyClip`.
   */
  partyClip?: boolean;
  /**
   * The window grid (axes, piers, balconies, door) spans only `{from, to}` of the front, as fractions from the viewer's
   * left (-0.5..1.5): the visual house module where its party wall (a pilaster, a downpipe) is not where BAG puts it.
   * The rest of the front is plain wall; cornice, bands, crown and dormers still run the whole front. Set by a house-type
   * placement's `visualSpan` (blockFace/houseType.ts).
   */
  gridAt?: {from: number; to: number};
  /** Dormers at these spans (fractions of the front from the viewer's left; one entry per dormer) instead of evenly spaced: a dormer against a party wall is one half of a dormer shared with the neighbour. */
  dormerAt?: {from: number; to: number}[];
}

/**
 * Stone ornament of a historic front. `wings`: carved wing pieces (vleugelstukken) filling the shoulders of a neck or bell
 * gable, ending in a volute (`volutes`) or a flat scroll (`scrolls`). `finial`: a crowning piece on the cap (`crab` = the
 * leafy "krab" of Rijksmonument descriptions). `cartouche`: an oval shield on the cap face. `ears`: small outward scrolls
 * where the neck meets the cap. `gablet`: a crowning piece standing on a cornice front (`crest` = a carved crest,
 * `pediment` = a small pointed gablet). Colour = the palette's `stone`.
 */
export interface GableOrnamentIntent {
  wings?: typeof GABLE_WINGS[number];
  finial?: typeof GABLE_FINIALS[number];
  cartouche?: boolean;
  ears?: boolean;
  gablet?: typeof ROOF_GABLETS[number];
}
export interface GroundFrontIntent {
  kind: typeof GROUND_FRONT_KINDS[number];
  bays: GroundBay[];
  colour?: string;
  shutterColour?: string;
  evidence?: string;
}

/**
 * A real local shop. Only what a photo or register supports; every field but `colour`/`fascia` is optional.
 * `evidence` records where it came from (photo id/date, OSM node) so a later pass can audit it.
 * One schema for per-house intents and block-face houses; unknown keys are rejected (no silent misspellings).
 */
export interface ShopfrontIntent {
  colour: string;
  fascia: boolean;
  awning?: ShopAwningIntent;
  /** Business as named by the evidence. */
  name?: string;
  /** The sign as read on the dated photo, drawn as real lettering (signage.ts). `null` in a `sameAs` override removes the base design's sign. */
  sign?: ShopSign | null;
  /** Where the shop entrance is; `centre-recessed` sets the glazed door back in a portal between display windows. */
  entrance?: typeof SHOP_ENTRANCES[number];
  /** Pane division when `displayWindows` is not given: `split` (default) divides by width, `single`/`transom` keep one pane per span. */
  glazing?: typeof SHOP_GLAZING[number];
  /** Separate display-window panes across the shop glass (shared between the spans either side of a door by width). */
  displayWindows?: number;
  /** Stall riser under the shop glass (default `medium`). */
  stallriser?: typeof STALLRISERS[number];
  stallriserColour?: string;
  /** Fascia paint when it differs from the shop joinery (a pale sign board over dark joinery); default the sign background, else the shop colour. */
  fasciaColour?: string;
  /** A separate street door to the dwellings above, beside the shop (`doorBay` then no longer means the shop door). */
  residentialDoor?: {side: 'left' | 'right'; colour?: string};
  /** Share of the front width the shop occupies from the side opposite the residential door (default 1 without a residential door). */
  shopShare?: number;
  /**
   * The shop occupies only these bay axes (inclusive `[first, last]` on the front's grid, see `bayWidths`). The other
   * ground-floor bays stay wall: `doorBay` then is a residential entrance beside the shop with its own door and wall,
   * and the other bays keep their windows. The entrance bay must lie outside the range (the validator rejects an overlap).
   * Not together with `residentialDoor`/`shopShare`.
   */
  bays?: [number, number];
  /** Shop height in storeys: 1 (default) or 2, a double-height display with a mezzanine transom, the fascia at the top; the storey-1 windows in the shop span are dropped. */
  storeys?: 1 | 2;
  evidence?: string;
}

/**
 * Shop sign: `text` (letters, digits, & ' - . and spaces; drawn as capitals), its letter colour, and where it is
 * mounted: on the fascia board (default; needs `fascia: true`), on the wall band above the glass, or on the glass.
 */
export interface ShopSign {
  text: string;
  textColour: string;
  mount?: typeof SIGN_MOUNTS[number];
  /** Fascia colour; default the shop colour. */
  background?: string;
  /** Share of the sign band the text may span, 0.3..0.95 (default 0.8). */
  span?: number;
  align?: 'left' | 'centre' | 'right';
}
export const SIGN_MOUNTS = ['fascia', 'wall', 'glazing'] as const;
/** Characters the sign lettering can draw (signage.ts GLYPHS, case-folded). */
export const SIGN_TEXT = /^[A-Za-z0-9&'.\- ]{1,40}$/;
const SHOPFRONT_KEYS = ['colour', 'fascia', 'awning', 'name', 'sign', 'entrance', 'glazing', 'displayWindows', 'stallriser', 'stallriserColour', 'fasciaColour', 'residentialDoor', 'shopShare', 'bays', 'storeys', 'evidence'];
const SIGN_KEYS = ['text', 'textColour', 'mount', 'background', 'span', 'align'];

/** Fabric awning over the shop glass: `extent` is the covered share of the front width, as fractions from the viewer's left (default the whole shop front). */
/**
 * `rigid`: a slab canopy (see AWNING_STYLES); `fasciaColour` paints its nose fascia (default the canopy colour).
 * `glassBlocks` (rigid only; Jan Evertsenstraat): a glass-block band in the wall over the canopy, from 2 cm over the slab
 * to 8 cm under the first-storey sills (at most 1.1 m, at least 0.4 m), 1.5 cm proud, with a 0.2 m mortar grid 3 cm
 * wide; brick piers 0.25 m wide stay at party-wall ends, 0.05 m at free ends.
 */
export interface ShopAwningIntent { style: typeof AWNING_STYLES[number]; colour: string; extent?: { from: number; to: number }; fasciaColour?: string; glassBlocks?: boolean }

/** `band`: a second brick colour for banding and relieving arches (lintel bands become brick stripes). */
export interface PaletteIntent {
  brick: string; frame: string; door: string; shutters?: string; stone?: string; band?: string;
  /** Cornice paint when it differs from the window frames (a cream cornice over dark or red frames); default the frame colour. */
  cornice?: string;
  /**
   * What `brick` (the wall colour) is made of: `brick` (default; the brick texture) or `stucco` (rendered/painted plaster:
   * a fine-grain plaster texture that keeps white, cream or grey light, see recipeLook `stucco` slot). House palette only
   * (a front's palette cannot change the material).
   */
  wallMaterial?: typeof WALL_MATERIALS[number];
}
export const WALL_MATERIALS = ['brick', 'stucco'] as const;
/**
 * Large-tier wall group material (`walls[].wallMaterial`): the recipe material slot its wall (and flush arch bands)
 * export with, tinted by the group's `palette.brick`: `brick`, `stucco` (plaster), `stone` (ashlar, granite) or
 * `render` (smooth white render: the stucco slot, white unless the group's palette says otherwise).
 */
export const GROUP_WALL_MATERIALS = ['brick', 'stucco', 'stone', 'render'] as const;

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
 * Large buildings (schools, blocks, offices, police stations, most landmarks): keep the 3DBAG LoD2.2 massing as-is and
 * choose a facade SYSTEM per wall group, addressed by 3DBAG LoD2.2 wall-surface index (never coordinates); the fit
 * (`fitLarge`) derives storey lines, bay pitch, entrance and garage bays from the surfaces, and compose.ts cuts the
 * windows into the exact walls. Validated by `validateLargeIntent` (largeIntent.ts); list a house's surfaces with
 * `scripts/building-recipes/walls.ts`.
 */
export interface TiltedBaysIntent {every?: number; first?: number; bays?: number[]; storeys?: number[]}
export interface LargeWallIntent {
  /** 3DBAG LoD2.2 WallSurface indices (shell boundary index) of this wall group. */
  wallSurfaces: number[];
  /** Optional street the group faces (the facts step fetches a reference crop for it). */
  street?: string;
  system: LargeSystemName;
  /** Full storeys incl. ground on this wall (default: civic storey height, 4.2 m before 1945, 3.6 m after). */
  storeys?: number;
  /** Share the storey lines of an earlier group (index into `walls`), so wings' windows line up with the main block. Replaces `storeys`. */
  alignWith?: number;
  /** Bays per storey on the group's widest panel (default: the system's pitch). */
  baysPerStorey?: number;
  /** Ground-floor system: `system` (the upper rows), shop windows, a glazed plinth, or blank. */
  ground?: LargeGround;
  windows?: LargeWindow;
  /** Recessed entrance on the widest panel: `bay` from the viewer's left (default the middle), `storeys` > 1 = a glazed entrance hall that tall, `canopy` = a cantilevered slab over it. */
  entrance?: boolean | {bay?: number; storeys?: number; canopy?: boolean; /** carved stone portal: jambs, entablature, a pediment block with a crest (single-storey entrances) */ portal?: boolean};
  /** Stroke-font lettering: over the entrance (`fascia`, default; on the frieze of a portal), on the wall above the ground floor (`wall`), on the entrance-hall glass (`glazing`), the canopy edge (`canopy`) or a name band under the cornice (`cornice`, on the widest panel). */
  signage?: string | {text: string; colour?: string; mount?: 'fascia' | 'wall' | 'glazing' | 'canopy' | 'cornice'};
  /** Recessed sectional garage doors in the ground storey, from the right end of the widest panel. */
  garageDoors?: number;
  /** Recessed sectional garage doors in exactly these ground-storey bays of the widest panel (needs `baysPerStorey`); an alternative to `garageDoors`. */
  garageBays?: number[];
  stringCourses?: boolean;
  /** Projecting cornice along the wall top. */
  cornice?: boolean;
  /** Projecting piers at the bay joints. */
  piers?: boolean;
  /** Storeys (0 = ground) with a balcony in every bay, or only in every `every`-th bay from `first`, or the listed `bays`
   *  (of `baysPerStorey`, e.g. a balcony over the entrance); neighbouring balcony bays join into one balcony in the layered kit. */
  balconies?: {storeys: number[]; rail?: 'glass' | 'bars' | 'solid'; every?: number; first?: number; bays?: number[]};
  /** Storeys (0 = ground) with no openings (a blank floor over a shop, a plant floor). */
  blankStoreys?: number[];
  /** Police signature components: blue-and-white striped POLITIE band over the ground floor, blue lamp beside the entrance. */
  police?: {stripe?: boolean; lamp?: boolean};
  /** What this group's wall is made of when it differs from the house (`palette.wallMaterial`); see GROUP_WALL_MATERIALS. */
  wallMaterial?: typeof GROUP_WALL_MATERIALS[number];
  /** Group colours when they differ from the house palette (`brick` = this group's wall). */
  palette?: Partial<Pick<PaletteIntent, 'brick' | 'frame' | 'stone'>>;
  /**
   * Arched heads: on the upper-storey windows, on the ground openings (with `ground: "portals"` or a windowed ground),
   * and the band around each head: `brick` (a rowlock arch in the wall brick with stone imposts, default), `stone`,
   * `voussoir` (stone with imposts and a keystone) or `none`.
   */
  arches?: {windows?: ArchKind; ground?: ArchKind; band?: 'brick' | 'stone' | 'voussoir' | 'none'; /** Only these storeys (0 = ground) get arched heads (the rest stay square-headed); default every storey. */ storeys?: number[]};
  /** Loading-door axis (warehouses): every `every`-th bay from bay `first` (default 0), or the listed `bays` of the widest panel, is a tall door opening on every upper storey and a wide portal on the ground. */
  hoist?: {every?: number; first?: number; bays?: number[]; arch?: ArchKind};
  /** A carriage gateway through the ground storey in the listed bays of the widest panel (dark arched openings 92 % of a bay wide, plain wall between); default none. */
  gateways?: {bays: number[]; arch?: ArchKind};
  /** false = no projecting stone sills under the punched windows (brick sills, flush heads). */
  sills?: boolean;
  /** false = no frame ring round the glass (dark frames that read as glass); glazing bars stay. */
  frames?: boolean;
  /** true = glazing bars 3.5 cm proud of the glass (large tier; ribbons with a mullion otherwise sit in the audit's z-fight band) */
  deepBars?: boolean;
  /**
   * Tilted bay (box) windows: a projecting stone frame leaning out towards the sill round the windows of every `every`-th
   * bay from `first`, or the listed `bays` of the widest panel, on the listed `storeys` (0 = ground; default every upper storey).
   * A list gives each storey its own pattern (the storeys of the entries must not overlap).
   */
  tiltedBays?: TiltedBaysIntent | TiltedBaysIntent[];
  /** Storeys (0 = ground) faced in the group's stone over the wall (a granite base, an ashlar attic), round their openings. */
  stoneStoreys?: number[];
  /** Banded stone pilasters at both ends of every panel of the group (two-tone courses). */
  pilasters?: boolean;
  /** A glazed roof lantern on the highest roof point behind the group's widest panel. */
  lantern?: boolean;
  /** Perforated-brick screen (car parks): a concrete lattice of posts and rails over the wall, glass-block perforations in one bay of three; brick-bay-grid only. */
  screen?: boolean;
  /**
   * true = the group's 3DBAG facets that link end to end (a curved front kept as a chain of narrow planes) carry one
   * bay rhythm along their arc length, `baysPerStorey`'s pitch continuing round the curve (curve.ts); default: each
   * facet restarts its own grid.
   */
  curve?: boolean;
  /** Name boards (white plates, lettered) over the ground portals of the hoist bays on the widest panel, left to right; "" leaves a hoist bay without a board. */
  nameBoards?: string[];
  /**
   * St Andrew's crosses (the three-cross city emblem, as on Amsterdam municipal buildings) stacked down the top corner
   * of the widest panel: `count` crosses of `size` (small 1.4 m, medium 2.2 m default, large 3.2 m), in `colour`, at the `left` (default) or `right` end.
   */
  crosses?: {count: number; size?: 'small' | 'medium' | 'large'; colour?: string; side?: 'left' | 'right'};
}

export interface LargeBuildingIntent {
  schemaVersion: 1;
  kind: 'large';
  id: string; pandId: string; address: string;
  sources: IntentSource[];
  walls: LargeWallIntent[];
  /** System for wall surfaces no group lists (default `blank`). */
  otherWalls?: LargeSystemName;
  /** Lift overrun and plant boxes on the largest flat roof. */
  roofPlant?: boolean;
  roof?: {material: typeof ROOF_MATERIALS[number]};
  palette: PaletteIntent;
  /** Close string courses, cornices and fascias (back face and end caps): for walls whose 3DBAG faces stand a few cm out of one plane (opt-in; earlier recipes stay byte-identical). */
  closedBands?: boolean;
  /**
   * Layered kit (2026-10-14; the default since the second pass, `false` keeps the legacy kit): garage doors, portals,
   * arched heads, curtain walls and balconies built on distinct sheet layers as closed boxes (door leaf, ribs and frame;
   * glazing and arch bars off the glass and thin arch bands as closed rings; a glass skin with a mullion grid, or a dark
   * plinth panel under it with ground `mesh-plinth`; one slab and rail per balcony storey; lettering as closed strokes),
   * and every part laid off the 3DBAG wall's own plan profile where it leans or bends more than 1.5 cm off the panel
   * plane (compose `wallProfileOf`), so none leaves coplanar overlap.
   */
  layeredKit?: boolean;
  /**
   * Shell repair (opt-in, 2026-10-14, shellRepair.ts): close the open edges of a defective 3DBAG LoD2.2 shell with
   * caps, wall strips and seams before the fit. Patches are wall surfaces from 90000 up (`walls.ts` lists them).
   */
  shellRepair?: boolean;
  /**
   * `bag`: build the massing on the BAG LoD0 outline (LoD2.2 roof planes clipped to it, walls from the repair strips)
   * when the LoD2.2 ground has drifted from it (IoU < 0.90). Default `lod22`: the LoD2.2 shell verbatim.
   */
  footprint?: 'lod22' | 'bag';
  notes?: string[];
}

export type BuildingIntent = CanalHouseIntent | LargeBuildingIntent;

const COORDINATE_KEYS = /^(x|y|z|left|right|top|bottom|width|height|depth|offset|position|coordinates|ring|vertices|plane)(M)?$|M$/;

/** Validate a parsed intent JSON. Throws one error listing every problem. */
export function validateIntent(input: unknown): CanalHouseIntent {
  const problems: string[] = [];
  const intent = input as CanalHouseIntent;
  if ((input as {kind?: string})?.kind === 'large') throw new Error(`Intent ${intent?.id}: kind "large" is validated by validateLargeIntent / validateBuildingIntent (largeIntent.ts)`);
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
    if (f.bayWindows) {
      if (f.bayWindows.bays === undefined) count(f.bayWindows.bay, `${at}.bayWindows.bay`, 0, 15);
      else problems.push(...erkerProblems(f, at));
      f.bayWindows.storeys.forEach(v => count(v, `${at}.bayWindows.storeys`, 1, f.storeys - 1));
    }
    if (f.bands !== undefined) oneOf(f.bands, ['none', 'storey', 'lintel', 'both', 'courses'], `${at}.bands`);
    if (f.bands === 'courses' || f.courseStoreys !== undefined) problems.push(...courseProblems(f, intent?.palette, at));
    if (f.windowHoods !== undefined && f.windowHoods !== true) problems.push(`${at}.windowHoods: true (or leave it out)`);
    if (f.lisenes !== undefined) {
      const l = f.lisenes as Record<string, unknown>;
      if (typeof l !== 'object' || l === null || Object.keys(l).some(k => !['leftEnd', 'rightEnd'].includes(k)) || Object.values(l).some(v => v !== 'half' && v !== 'full') || !Object.keys(l).length) problems.push(`${at}.lisenes: {leftEnd?, rightEnd?} each "half" or "full"`);
      if (f.repeat) problems.push(`${at}.lisenes: not on a repeated front`);
    }
    if (f.crownCapSpan !== undefined) oneOf(f.crownCapSpan, CROWN_CAP_SPANS, `${at}.crownCapSpan`);
    if (f.crownCapRise !== undefined) oneOf(f.crownCapRise, CROWN_CAP_RISES, `${at}.crownCapRise`);
    if (f.piers !== undefined) oneOf(f.piers, ['equal', 'margin'], `${at}.piers`);
    if (f.axisGrid !== undefined) count(f.axisGrid, `${at}.axisGrid`, 1, 16);
    for (const [k, v] of Object.entries(f.storeyAxes ?? {})) {
      const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays]));
      if (k !== 'last' && !(Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) < f.storeys)) problems.push(`${at}.storeyAxes.${k}: key must be a storey index or "last"`);
      if (!Array.isArray(v) || !v.length || v.some((a, i) => !Number.isInteger(a) || a < 0 || a >= grid || (i > 0 && a <= v[i - 1]))) problems.push(`${at}.storeyAxes.${k}: ascending axes within 0..${grid - 1}`);
      else if (Array.isArray(f.bays) && f.bays[k === 'last' ? f.storeys - 1 : Number(k)] !== v.length) problems.push(`${at}.storeyAxes.${k}: ${v.length} axes but bays says ${f.bays[k === 'last' ? f.storeys - 1 : Number(k)]}`);
    }
    if (f.bayWidths !== undefined) {
      const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays]));
      if (!Array.isArray(f.bayWidths) || f.bayWidths.length !== grid || f.bayWidths.some(w => !(w >= 0.15 && w <= 8))) problems.push(`${at}.bayWidths: ${grid} relative widths (one per axis), each 0.15..8`);
      else if (Math.max(...f.bayWidths) / Math.min(...f.bayWidths) > 8) problems.push(`${at}.bayWidths: widest bay more than 8x the narrowest`);
    }
    for (const [k, v] of Object.entries(f.storeyBayWidths ?? {})) {
      const s = k === 'last' ? f.storeys - 1 : Number(k), per = Array.isArray(f.bays) ? f.bays[s] : f.bays;
      if (k !== 'last' && !(Number.isInteger(s) && s >= 0 && s < f.storeys)) problems.push(`${at}.storeyBayWidths.${k}: key must be a storey index or "last"`);
      else if (!Array.isArray(v) || v.length !== per || v.some(w => !(w >= 0.15 && w <= 8))) problems.push(`${at}.storeyBayWidths.${k}: ${per} relative widths (one per window of that storey), each 0.15..8`);
      else if (f.storeyAxes?.[k] || (s === f.storeys - 1 && f.storeyAxes?.last)) problems.push(`${at}.storeyBayWidths.${k}: not together with storeyAxes for the same storey`);
    }
    if (f.crownRise !== undefined && !(f.crownRise >= 0.3 && f.crownRise <= 3)) problems.push(`${at}.crownRise: 0.3..3 upper-storey heights`);
    if (f.crownSteps !== undefined) { count(f.crownSteps, `${at}.crownSteps`, 1, 6); if (f.gable !== 'step') problems.push(`${at}.crownSteps: only a step gable has steps`); }
    if (f.crownFinial !== undefined && typeof f.crownFinial !== 'boolean') problems.push(`${at}.crownFinial must be boolean`);
    if (f.crownFinial && !['step', 'neck', 'raised-neck', 'bell'].includes(f.gable)) problems.push(`${at}.crownFinial: needs a step, neck or bell gable (a flat top to stand on)`);
    if (f.atticShape !== undefined) oneOf(f.atticShape, ATTIC_SHAPES, `${at}.atticShape`);
    if (f.atticShape === 'round' && !f.atticWindows) problems.push(`${at}.atticShape: round needs atticWindows >= 1`);
    if (f.windowProportion !== undefined) oneOf(f.windowProportion, WINDOW_PROPORTIONS, `${at}.windowProportion`);
    if (f.crownAt !== undefined && f.crownBays !== undefined) problems.push(`${at}: crownAt and crownBays are alternatives`);
    if (f.crownAt !== undefined || f.crownBays !== undefined) {
      if (f.gable === 'flat' || (f.gable === 'cornice' && (!f.crownCap || f.crownCap === 'flat'))) problems.push(`${at}.crownAt/crownBays: the front has no crown to place (gable ${f.gable}${f.gable === 'cornice' ? ' needs a crownCap' : ''})`);
    }
    if (f.crownAt !== undefined) {
      const c = f.crownAt;
      if (!c || !(c.from >= 0 && c.to <= 1 && c.to - c.from >= 0.2)) problems.push(`${at}.crownAt: {from, to} fractions with 0 <= from < to <= 1 covering at least 0.2`);
    }
    if (f.crownBays !== undefined) {
      const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays])), c = f.crownBays;
      if (!c || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 0 || c.to >= grid || c.from > c.to) problems.push(`${at}.crownBays: {from, to} bay axes with 0 <= from <= to < ${grid}`);
    }
    if (f.archedStoreys !== undefined) { if (!Array.isArray(f.archedStoreys)) problems.push(`${at}.archedStoreys must be a list`); else f.archedStoreys.forEach(v => count(v, `${at}.archedStoreys`, 0, f.storeys - 1)); }
    if (f.archRings !== undefined) oneOf(f.archRings, ['stone', 'band', 'none'], `${at}.archRings`);
    if (f.repeat) { if (f.repeat.count !== 'fit') count(f.repeat.count, `${at}.repeat.count`, 1, 20); }
    if (f.share !== undefined && !(f.share > 0 && f.share <= 1)) problems.push(`${at}.share must be in (0,1]`);
    if (f.shopfront) {
      const sf = f.shopfront;
      colour(sf.colour, `${at}.shopfront.colour`);
      for (const k of Object.keys(sf)) if (!SHOPFRONT_KEYS.includes(k)) problems.push(`${at}.shopfront.${k}: unknown field (one of ${SHOPFRONT_KEYS.join(', ')})`);
      if (typeof sf.fascia !== 'boolean') problems.push(`${at}.shopfront.fascia must be true or false`);
      const sign = sf.sign;
      if (sign) {
        for (const k of Object.keys(sign)) if (!SIGN_KEYS.includes(k)) problems.push(`${at}.shopfront.sign.${k}: unknown field (one of ${SIGN_KEYS.join(', ')})`);
        if (typeof sign.text !== 'string' || !sign.text.trim() || !SIGN_TEXT.test(sign.text)) problems.push(`${at}.shopfront.sign.text: 1..40 of A-Z a-z 0-9 & ' - . space`);
        colour(sign.textColour, `${at}.shopfront.sign.textColour`);
        if (sign.background) colour(sign.background, `${at}.shopfront.sign.background`);
        if (sign.span !== undefined && !(sign.span >= 0.3 && sign.span <= 0.95)) problems.push(`${at}.shopfront.sign.span: 0.3..0.95`);
        if (sign.align !== undefined) oneOf(sign.align, ['left', 'centre', 'right'], `${at}.shopfront.sign.align`);
        if (sign.mount !== undefined) oneOf(sign.mount, SIGN_MOUNTS, `${at}.shopfront.sign.mount`);
        if ((sign.mount ?? 'fascia') === 'fascia' && !sf.fascia) problems.push(`${at}.shopfront.sign: a fascia-mounted sign needs fascia: true`);
        if (sign.mount && sign.mount !== 'fascia' && sf.fascia) problems.push(`${at}.shopfront.sign: a ${sign.mount}-mounted sign with a fascia board; mount it on the fascia or drop the board`);
      } else if (sign !== undefined && sign !== null) problems.push(`${at}.shopfront.sign must be an object (or null in an override)`);
      if (sf.displayWindows !== undefined) count(sf.displayWindows, `${at}.shopfront.displayWindows`, 1, 8);
      if (sf.entrance !== undefined) oneOf(sf.entrance, SHOP_ENTRANCES, `${at}.shopfront.entrance`);
      if (sf.glazing !== undefined) oneOf(sf.glazing, SHOP_GLAZING, `${at}.shopfront.glazing`);
      if (sf.stallriser !== undefined) oneOf(sf.stallriser, STALLRISERS, `${at}.shopfront.stallriser`);
      if (sf.fasciaColour) colour(sf.fasciaColour, `${at}.shopfront.fasciaColour`);
      if (sf.stallriserColour) colour(sf.stallriserColour, `${at}.shopfront.stallriserColour`);
      if (sf.residentialDoor) { oneOf(sf.residentialDoor.side, ['left', 'right'], `${at}.shopfront.residentialDoor.side`); if (sf.residentialDoor.colour) colour(sf.residentialDoor.colour, `${at}.shopfront.residentialDoor.colour`); }
      if (sf.storeys !== undefined && sf.storeys !== 1 && sf.storeys !== 2) problems.push(`${at}.shopfront.storeys: 1 or 2`);
      if (sf.storeys === 2 && f.storeys < 3) problems.push(`${at}.shopfront.storeys: a two-storey shop needs at least 3 storeys on the front`);
      if (sf.bays !== undefined) {
        const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays])), [a, b] = Array.isArray(sf.bays) ? sf.bays : [NaN, NaN];
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b >= grid || a > b) problems.push(`${at}.shopfront.bays: [first, last] bay axes with 0 <= first <= last < ${grid}`);
        else {
          if (sf.residentialDoor || sf.shopShare !== undefined) problems.push(`${at}.shopfront.bays: not together with residentialDoor/shopShare (the bays say where the shop is)`);
          if (a === 0 && b === grid - 1 && f.doorBay !== null) problems.push(`${at}.shopfront.bays: the shop covers every bay, so doorBay ${f.doorBay} has no wall of its own; narrow the shop span or drop bays`);
          if (f.doorBay !== null) {
            const axes = storeyAxesOf(f, 0), axis = axes ? axes[f.doorBay] : undefined;
            if (axis === undefined) problems.push(`${at}.shopfront.bays: doorBay ${f.doorBay} is not on the shared grid (give the ground storey storeyAxes) so its overlap with the shop cannot be checked`);
            else if (axis >= a && axis <= b) problems.push(`${at}.shopfront.bays: shop bays ${a}..${b} cover the entrance bay (doorBay ${f.doorBay} = axis ${axis}); the residential entrance keeps its own door and wall`);
          }
        }
      }
      if (sf.shopShare !== undefined && !(sf.shopShare >= 0.4 && sf.shopShare <= 1)) problems.push(`${at}.shopfront.shopShare: 0.4..1`);
      // fit.ts reads shopShare only beside a residentialDoor; alone it was silently dropped (a Bilderdijkstraat face drew a full-width shop).
      if (sf.shopShare !== undefined && !sf.residentialDoor) problems.push(`${at}.shopfront.shopShare: only with residentialDoor (it is ignored alone); give the shop its bays instead`);
    }
    if (f.windowSurround !== undefined) oneOf(f.windowSurround, WINDOW_SURROUNDS, `${at}.windowSurround`);
    if (f.surroundStoreys !== undefined) { if (!Array.isArray(f.surroundStoreys)) problems.push(`${at}.surroundStoreys must be a list`); else f.surroundStoreys.forEach(v => count(v, `${at}.surroundStoreys`, 0, f.storeys - 1)); }
    if (f.quoins !== undefined) oneOf(f.quoins, QUOINS, `${at}.quoins`);
    const aw = f.shopfront?.awning;
    if (aw) {
      oneOf(aw.style, AWNING_STYLES, `${at}.shopfront.awning.style`);
      colour(aw.colour, `${at}.shopfront.awning.colour`);
      if (aw.extent && !(aw.extent.from >= 0 && aw.extent.to <= 1 && aw.extent.to - aw.extent.from >= 0.15)) problems.push(`${at}.shopfront.awning.extent: need 0 <= from < to <= 1 covering at least 0.15`);
      if (aw.fasciaColour !== undefined) { colour(aw.fasciaColour, `${at}.shopfront.awning.fasciaColour`); if (aw.style !== 'rigid') problems.push(`${at}.shopfront.awning.fasciaColour: only a rigid canopy has a fascia`); }
      if (aw.glassBlocks !== undefined && (aw.glassBlocks !== true || aw.style !== 'rigid')) problems.push(`${at}.shopfront.awning.glassBlocks: true, and only over a rigid canopy`);
    } else if ((f as {awning?: unknown}).awning !== undefined) problems.push(`${at}.awning: awnings belong under shopfront.awning`);
    for (const [k, v] of Object.entries(f.palette ?? {})) {
      if (k === 'wallMaterial') problems.push(`${at}.palette.wallMaterial: set the wall material on the house palette (one material per house)`);
      else colour(v, `${at}.palette.${k}`);
    }
    problems.push(...historicProblems(f, at, colour, oneOf));
  }
  const corners = Array.isArray(intent?.fronts) ? intent.fronts.filter(f => f?.tower?.corner) : [];
  if (corners.length > 1) problems.push('tower.corner: one corner tower per pand (on one of the two fronts that meet at the corner)');
  if (corners.length && intent.fronts.length < 2) problems.push(`front ${corners[0].id}.tower.corner: a corner tower needs a pand with two fronts`);
  oneOf(intent?.roof?.material, ROOF_MATERIALS, 'roof.material');
  for (const k of ['brick', 'frame', 'door'] as const) colour(intent?.palette?.[k], `palette.${k}`);
  for (const k of ['shutters', 'stone', 'band', 'cornice'] as const) if (intent?.palette?.[k] !== undefined) colour(intent.palette[k], `palette.${k}`);
  if (intent?.palette?.wallMaterial !== undefined) oneOf(intent.palette.wallMaterial, WALL_MATERIALS, 'palette.wallMaterial');
  if (problems.length) throw new Error(`Invalid intent ${intent?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return intent;
}

/** Bay axes of a front's shared grid: `axisGrid`, else the widest upper storey. */
export function frontGrid(f: FrontIntent): number {
  const bays = Array.isArray(f.bays) ? f.bays : Array(f.storeys).fill(f.bays);
  return f.axisGrid ?? Math.max(...bays.slice(f.storeys > 1 ? 1 : 0));
}
/** The shared-grid axes storey `s` (0 = ground) uses, or null when its windows are spaced on their own (see `storeyAxes`). */
export function storeyAxesOf(f: FrontIntent, s: number): number[] | null {
  const bays = Array.isArray(f.bays) ? f.bays : Array(f.storeys).fill(f.bays), count = bays[s], grid = frontGrid(f);
  const named = f.storeyAxes?.[String(s)] ?? (s === f.storeys - 1 ? f.storeyAxes?.last : undefined);
  if (named) return named;
  if (count === grid) return Array.from({length: count}, (_, k) => k);
  if (count > 0 && count < grid && (grid - count) % 2 === 0) { const k0 = (grid - count) / 2; return Array.from({length: count}, (_, k) => k0 + k); }
  return null;
}

export const swatch = (value: string): string => SWATCHES[value] ?? value;

/** Problems with a multi-bay erker (`bayWindows.bays`): axes on the grid, consecutive storeys, cap. */
function erkerProblems(f: FrontIntent, at: string): string[] {
  const p: string[] = [], bw = f.bayWindows!, b = bw.bays!, grid = frontGrid(f);
  if (bw.bay !== undefined) p.push(`${at}.bayWindows: bay and bays are alternatives`);
  if (!b || !Number.isInteger(b.from) || !Number.isInteger(b.to) || b.from < 0 || b.to >= grid || b.from > b.to) p.push(`${at}.bayWindows.bays: {from, to} bay axes within 0..${grid - 1}`);
  const st = Array.isArray(bw.storeys) ? bw.storeys : [];
  if (!st.length || st.some((s, i) => i > 0 && s !== st[i - 1] + 1)) p.push(`${at}.bayWindows.storeys: one or more consecutive storeys, ascending (the erker is one stack)`);
  if (bw.cap !== undefined && !ERKER_CAPS.includes(bw.cap)) p.push(`${at}.bayWindows.cap: ${JSON.stringify(bw.cap)} not in ${ERKER_CAPS.join('|')}`);
  if (f.repeat) p.push(`${at}.bayWindows.bays: not on a repeated front`);
  return p;
}

/** Problems with brick course banding (`bands: courses`, `courseStoreys`). */
function courseProblems(f: FrontIntent, palette: PaletteIntent | undefined, at: string): string[] {
  const p: string[] = [];
  if (f.bands !== 'courses') return [`${at}.courseStoreys: only with bands "courses"`];
  if (!(f.palette?.band ?? palette?.band)) p.push(`${at}.bands: courses are laid in the band brick; give palette.band`);
  const list = f.courseStoreys;
  if (list !== undefined && (!Array.isArray(list) || list.some((s, i) => !Number.isInteger(s) || s < 0 || s >= f.storeys || (i > 0 && s <= list[i - 1])))) p.push(`${at}.courseStoreys: ascending storey indices within 0..${f.storeys - 1}`);
  if (Array.isArray(list) && list.includes(0) && (f.shopfront || f.groundFront)) p.push(`${at}.courseStoreys: the ground storey holds a shop/ground front; band the upper storeys`);
  return p;
}

const GABLE_ORNAMENT_KEYS = ['wings', 'finial', 'cartouche', 'ears', 'gablet'];
const GROUND_FRONT_KEYS = ['kind', 'bays', 'colour', 'shutterColour', 'evidence'];
/** Problems with the historic-front fields of one front (all optional; absent fields are never checked). */
function historicProblems(f: FrontIntent, at: string, colour: (v: unknown, where: string) => void, oneOf: (v: unknown, allowed: readonly string[], where: string) => void): string[] {
  const problems: string[] = [];
  const grid = frontGrid(f), shoulders = ['neck', 'raised-neck', 'bell'].includes(f.gable);
  const o = f.gableOrnament;
  if (o !== undefined) {
    if (!o || typeof o !== 'object') problems.push(`${at}.gableOrnament must be an object`);
    else {
      for (const k of Object.keys(o)) if (!GABLE_ORNAMENT_KEYS.includes(k)) problems.push(`${at}.gableOrnament.${k}: unknown field (one of ${GABLE_ORNAMENT_KEYS.join(', ')})`);
      if (o.wings !== undefined) { oneOf(o.wings, GABLE_WINGS, `${at}.gableOrnament.wings`); if (!shoulders) problems.push(`${at}.gableOrnament.wings: wing pieces fill the shoulders of a neck or bell gable (gable ${f.gable})`); }
      if (o.ears !== undefined && typeof o.ears !== 'boolean') problems.push(`${at}.gableOrnament.ears must be boolean`);
      if (o.ears && !shoulders) problems.push(`${at}.gableOrnament.ears: ears sit where a neck/bell meets its cap (gable ${f.gable})`);
      if (o.cartouche !== undefined && typeof o.cartouche !== 'boolean') problems.push(`${at}.gableOrnament.cartouche must be boolean`);
      if (o.cartouche && !shoulders) problems.push(`${at}.gableOrnament.cartouche: a cartouche sits on the cap of a neck or bell gable (gable ${f.gable})`);
      if (o.finial !== undefined) { oneOf(o.finial, GABLE_FINIALS, `${at}.gableOrnament.finial`); if (!shoulders && f.gable !== 'step' && f.gable !== 'point' && f.gable !== 'spout') problems.push(`${at}.gableOrnament.finial: needs a gable top to stand on (gable ${f.gable})`); }
      if (o.gablet !== undefined) { oneOf(o.gablet, ROOF_GABLETS, `${at}.gableOrnament.gablet`); if (f.gable !== 'cornice' && f.gable !== 'flat') problems.push(`${at}.gableOrnament.gablet: a rooftop gablet stands on a cornice/flat front (gable ${f.gable})`); }
    }
  }
  if (f.leanDegrees !== undefined && !(typeof f.leanDegrees === 'number' && f.leanDegrees >= 0 && f.leanDegrees <= MAX_LEAN_DEGREES)) problems.push(`${at}.leanDegrees: 0..${MAX_LEAN_DEGREES} degrees forward`);
  const g = f.groundFront;
  if (g !== undefined) {
    for (const k of Object.keys(g ?? {})) if (!GROUND_FRONT_KEYS.includes(k)) problems.push(`${at}.groundFront.${k}: unknown field (one of ${GROUND_FRONT_KEYS.join(', ')})`);
    oneOf(g?.kind, GROUND_FRONT_KINDS, `${at}.groundFront.kind`);
    if (!Array.isArray(g?.bays) || g.bays.length < 1 || g.bays.length > 8) problems.push(`${at}.groundFront.bays: 1..8 bays left to right`);
    else g.bays.forEach((b, i) => oneOf(b, GROUND_BAYS, `${at}.groundFront.bays[${i}]`));
    if (g?.colour !== undefined) colour(g.colour, `${at}.groundFront.colour`);
    if (g?.shutterColour !== undefined) colour(g.shutterColour, `${at}.groundFront.shutterColour`);
    if (f.shopfront) problems.push(`${at}.groundFront: not together with shopfront (one ground storey)`);
    if (f.basement !== 'none') problems.push(`${at}.groundFront: a ground front stands on the street; use basement "none"`);
  }
  if (f.roofFront !== undefined && f.roofFront !== 'mansard') problems.push(`${at}.roofFront: "mansard"`);
  if (f.roofFront === 'mansard' && f.gable !== 'cornice' && f.gable !== 'flat') problems.push(`${at}.roofFront: a mansard rises behind a cornice/flat front (gable ${f.gable})`);
  if (f.dormerStyle !== undefined) { oneOf(f.dormerStyle, DORMER_STYLES, `${at}.dormerStyle`); if (!f.dormers) problems.push(`${at}.dormerStyle: needs dormers >= 1`); }
  if (f.crownGroups !== undefined) {
    if (f.crownAt !== undefined || f.crownBays !== undefined) problems.push(`${at}.crownGroups: not together with crownAt/crownBays`);
    if (f.gable === 'flat' || (f.gable === 'cornice' && (!f.crownCap || f.crownCap === 'flat'))) problems.push(`${at}.crownGroups: the front has no crown to repeat (gable ${f.gable})`);
    const list = Array.isArray(f.crownGroups) ? f.crownGroups : [];
    if (list.length < 2 || list.length > 4) problems.push(`${at}.crownGroups: 2..4 gables (one gable is crownBays)`);
    list.forEach((c, i) => { if (!c || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 0 || c.to >= grid || c.from > c.to || (i > 0 && c.from <= list[i - 1].to)) problems.push(`${at}.crownGroups[${i}]: {from, to} ascending, non-overlapping bay axes within 0..${grid - 1}`); });
  }
  if (f.tower !== undefined) {
    const t = f.tower;
    if (t?.corner !== undefined && t.corner !== true) problems.push(`${at}.tower.corner: true (or leave it out)`);
    if (t?.corner) { if (t.bays !== undefined) problems.push(`${at}.tower: corner and bays are alternatives`); if (f.repeat) problems.push(`${at}.tower.corner: not on a repeated front`); }
    else if (!t?.bays ||!Number.isInteger(t.bays.from) || !Number.isInteger(t.bays.to) || t.bays.from < 0 || t.bays.to >= grid || t.bays.from > t.bays.to) problems.push(`${at}.tower.bays: {from, to} bay axes within 0..${grid - 1}`);
    if (!(t?.rise >= 0.5 && t.rise <= 3)) problems.push(`${at}.tower.rise: 0.5..3 upper-storey heights above the eaves`);
    oneOf(t?.cap, TOWER_CAPS, `${at}.tower.cap`);
  }
  if (f.partyClip !== undefined && typeof f.partyClip !== 'boolean') problems.push(`${at}.partyClip must be boolean`);
  if (f.souterrain !== undefined && (typeof f.souterrain !== 'boolean' || (f.souterrain && f.basement === 'none'))) problems.push(`${at}.souterrain: boolean, and needs a basement`);
  if (f.gridAt !== undefined && !(f.gridAt && f.gridAt.from >= -0.5 && f.gridAt.to <= 1.5 && f.gridAt.to - f.gridAt.from >= 0.5)) problems.push(`${at}.gridAt: {from, to} fractions of the front, -0.5 <= from, to <= 1.5, at least 0.5 wide`);
  if (f.dormerAt !== undefined) {
    const list = Array.isArray(f.dormerAt) ? f.dormerAt : [];
    if (list.length !== (f.dormers ?? 0)) problems.push(`${at}.dormerAt: one span per dormer (dormers ${f.dormers ?? 0})`);
    list.forEach((d, i) => { if (!d || !(d.from >= 0 && d.to <= 1 && d.to - d.from >= 0.1 && (i === 0 || d.from >= list[i - 1].to))) problems.push(`${at}.dormerAt[${i}]: {from, to} ascending, non-overlapping fractions of the front within 0..1, at least 0.1 wide`); });
  }
  return problems;
}
