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
import type {BoxBalconyIntent} from '../blockBuilding/boxBalcony.ts';
import type {StackedBlocksIntent} from '../blockBuilding/stackedBlocks.ts';
import type {RoofLevelIntent} from './roofLevel.ts';
import type {LargeGround, LargeSystemName, LargeWindow} from '../blockBuilding/systems.ts';
import {brickStripeProblems, type BrickStripeZone} from './brickStripes.ts';
import {stairLightProblems, type StairLightIntent} from './stairLight.ts';
import {friezeVentProblems} from './friezeVents.ts';
import {wallAnchorProblems} from './wallAnchors.ts';
import {entablatureProblems} from './entablature.ts';
import {jambBlockProblems} from './jambBlocks.ts';
import type {ArchKind} from '../blockBuilding/arch.ts';
import type {StoneDressings} from '../blockBuilding/dressings.ts';
import {awningProblems, deBaarsjesProblems} from './deBaarsjesIntent.ts';
import {eavesOverhangProblems, type EavesOverhangIntent} from './eavesOverhangIntent.ts';
import {groundCanopyProblems, type GroundCanopyIntent} from './groundCanopyIntent.ts';
import type {ArcadePiersIntent} from '../blockBuilding/arcadePiers.ts';
import type {WindowBoxIntent} from '../blockBuilding/windowBox.ts';
import type {GalleryIntent} from '../blockBuilding/gallery.ts';
import type {SignBoardIntent} from '../blockBuilding/signBoards.ts';

export const GABLES = ['spout', 'neck', 'raised-neck', 'bell', 'step', 'point', 'cornice', 'flat'] as const;
export type GableIntent = typeof GABLES[number];
/** `frieze`: a tall (1.6 m) plain attic frieze with its cornice, in the cornice colour (18th-c. fronts; oculi in it are not drawn). */
export const CORNICES = ['none', 'simple', 'bracketed', 'heavy', 'frieze'] as const;
/** `segmental`: a low circular arc (meets the head at an angle); `rounded` is a half ellipse with upright ends. */
export const CROWN_CAPS = ['flat', 'rounded', 'pediment', 'segmental'] as const;
export const CROWN_CAP_RISES = ['low', 'normal'] as const;
export const CROWN_CAP_SPANS = ['narrow', 'medium', 'wide'] as const;
/**
 * Flank curve of a neck/bell crown, from the foot at the eaves to the neck (both flanks, mirrored). `concave`: the hollow
 * sweep of a neck gable's claw pieces and a bell's flared flanks, low at the foot and rising steeply into the neck (the
 * default: every bell/neck flank measured on the 2026-10-16 faces was concave or ogee); `ogee`: concave at the foot,
 * convex into the neck (an S); `straight`: a plain slant (Utrechtsestraat 62a, 169207); `convex`: the flank bulges out (a
 * quarter dome, the legacy sine shoulder).
 */
export const CROWN_SHOULDERS = ['concave', 'ogee', 'straight', 'convex'] as const;
export const SHOP_ENTRANCES = ['none', 'centre-recessed', 'centre', 'left', 'right', 'left-recessed', 'right-recessed'] as const;
export const SHOP_GLAZING = ['single', 'split', 'transom'] as const;
export const STALLRISERS = ['none', 'low', 'medium', 'high'] as const;
export const BASEMENTS = ['none', 'windows', 'stoop', 'stoop-and-windows'] as const;
/**
 * Window kinds (pane layout drawn as glazing bars). Canal-belt survey 2026-10-14 (docs/canal-house-windows-and-accents-20261014.md):
 * `sash-6-over-6` the 18th-c. sliding sash, three panes across and two up in each sash, thin bars and a heavier meeting
 * rail at half height; `sash-8-over-8` the wide sash, four across and two up per sash; `sash-9-over-9` the tall bel-etage
 * sash, three across and three up per sash; `six-pane` two across and three up (the 19th-c. replacement of small panes);
 * `t-window` the 19th-c. T-venster: an undivided transom light over a pair of casements (a transom at 0.76 of the height,
 * the mullion below it only); `small-over-one` the c.1900 window: a small-paned top sash (three across, two up) over large
 * lower panes; `cross-transom` the 17th-c. kruiskozijn: a heavy mullion and a transom at 0.6 of the height with small
 * panes in the four lights.
 * `ladder` (Amsterdam School, 1915-1935): a tall narrow light 0.55-0.75 m wide and about 0.7 of the storey high, with
 * 4-6 horizontal glazing bars and no vertical bar; a bay wide enough for two lights and a 0.16 m pier holds a PAIR
 * (the pairing follows `bayWidths`).
 * De Baarsjes (Jan Evertsenstraat 1925-1927, docs/de-baarsjes-types-20261014.md): `casement-toplight` two side-hung
 * casements under a fixed top light (a thin transom at 0.8 of the height, the mullion running through both);
 * `casement-gridded-toplight` the same with the top light in small panes (three bars across it); `casement-triple` a
 * fixed centre light between two narrow side-hung casements (mullions at 0.27 and 0.73, no transom);
 * `casement-toplight-double` two casement pairs side by side under one top light (a 3 m window of four lights, the
 * end house of a hood-lisene row); `casement-gridded-toplight-double` the same with a small-pane top light (two bars over
 * each light: J.F. Staal's 2.6 m windows on 68-92); `casement-pair` two side-hung casements with no top light (a mullion only);
 * `casement-small-panes` two casements glazed in small panes all over (bars at thirds across, a transom row under a top
 * light: Jan Evertsenstraat 45-53). `casement-sidelights-toplight` a wide fixed light between two narrow side lights under a
 * top light across all three (bars at 0.14 and 0.86, a transom at 0.86: Polanenstraat 229-311, 1935).
 */
export const WINDOWS = ['sash', 'sash-small-panes', 'cross', 'plain', 'arched', 'shop', 'two-light', 'ladder', 'sash-6-over-6', 'sash-8-over-8', 'sash-9-over-9', 'six-pane', 't-window', 'small-over-one', 'cross-transom', 'casement-toplight', 'casement-gridded-toplight', 'casement-triple', 'casement-toplight-double', 'casement-gridded-toplight-double', 'casement-pair', 'casement-small-panes', 'casement-sidelights-toplight'] as const;
export type WindowKind = typeof WINDOWS[number];
/** `relieving`: a flat-headed window under a segmental relieving arch (brick tympanum), the 17th-c. canal front. */
export const WINDOW_HEADS = ['flat', 'segmental', 'round', 'relieving'] as const;
/**
 * `solid`: a continuous ring; `blocks`: five radiating stone blocks with brick between (the 17th-c. block arch); `none`: no
 * ring, only the keystone (19th-c. carved keystones over plain brick heads). `springers` (Oud-West 1888-1900: Kinkerstraat
 * 18-4, Nassaukade 150 and 147): no ring, a springer block at each foot of the arch, standing on the springing line and
 * running `springerSize[0]` metres outward from the arch, `springerSize[1]` high (the dotted white impost row of Kinkerstraat, where the
 * springers of neighbouring windows almost meet over the pier), with the keystone when `keystone` is set.
 */
export const ARCH_RING_STYLES = ['solid', 'blocks', 'none', 'springers'] as const;
/** `dark` (Nassaukade 150, 147): the arch field in the wall brick in shadow (`palette.band`, else the wall colour x DARK_TYMPANUM_K), a blind relieving arch's recessed brick tympanum; also under a relieving arch. */
export const TYMPANUM_FILLS = ['stone', 'band', 'dark'] as const;
/**
 * Darkening of the wall colour for a `dark` tympanum without `palette.band` (the recessed field in shadow): tympanum over
 * wall luma on the 2024-11-21 Nassaukade strip, 0.67 and 0.68 on 150, 0.73 and 0.80 on 147; the mean.
 */
export const DARK_TYMPANUM_K = 0.72;
/** Arch ring colour: the palette's `stone` (white-painted or natural sandstone), `band` brick, or the `frame` paint. */
export const ARCH_RING_COLOURS = ['stone', 'band', 'frame'] as const;
/** Window height as a share of its storey height, ground storey first: medians of the canal-belt survey (`windowHeights: "diminishing"`). */
export const DIMINISHING_WINDOW_HEIGHTS = [0.73, 0.76, 0.72, 0.72, 0.7, 0.68] as const;
export const WINDOW_PROPORTIONS = ['standard', 'tall'] as const;
export const ATTIC_SHAPES = ['rectangular', 'round'] as const;
export const ROOF_MATERIALS = ['slate', 'black-tile', 'red-tile', 'bitumen', 'zinc', 'copper'] as const;
/**
 * `sill`: a projecting stone sill alone (no lintel), the commonest 18th/19th-c. canal-belt dressing.
 * `eared-keystone` (Nassaukade 145-150): a painted stucco head over each window, the head band running 0.12 m past both
 * jambs, with raised ear blocks at both ends and keystone blocks between them (one per ~0.45 m of window width).
 */
export const WINDOW_SURROUNDS = ['none', 'stone-lintel', 'full-frame', 'keystone', 'sill', 'eared-keystone'] as const;
/**
 * `consoles`: a painted sill slab under each surround-storey window, carried on two small console blocks. A separate key
 * from `windowSurround` so it combines with a head surround (`eared-keystone`); a sill alone is the canal-windows lane's
 * `windowSurround: "sill"`.
 */
export const WINDOW_SILLS = ['consoles'] as const;
/**
 * Balcony construction: the default iron/stone guard of the library, a timber platform on carved brackets
 * (`timber-bracketed`), or `slab-hood` (Jan Evertsenstraat 59-87): a stacked balconette per storey (a thin concrete slab
 * with an iron rail, the library's projecting balcony at the measured depth) and a hood slab over the top storey's door.
 */
export const BALCONY_STYLES = ['guard', 'timber-bracketed', 'slab-hood'] as const;
/** Guard of a timber balcony: white turned balusters under a handrail, or a wrought-iron grille. */
export const BALCONY_RAILS = ['turned', 'iron'] as const;
/** Guard of a front-wide balcony (`balconyRun`): iron bars or a solid brick front. */
export const BALCONY_RUN_GUARDS = ['iron', 'brick'] as const;
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
export const SOURCE_KINDS = ['street-panorama', 'archive-photo', 'monument-record', 'human-review', 'orthophoto'] as const;
/**
 * A timber oriel stack (`bayWindows.oriel`, Bellamybuurt 1915: Hasebroekstraat 53-67 and 56-70, measured on the
 * 2024-12-11 strip at 40 px/m): a three-face projecting bay `span` metres wide centred on the spanned axes (not the whole
 * bay span: the 2.2 m oriel stands in a 4.4 m bay), `projection` deep with `returns` angled sides, one module per listed
 * storey. Each module: a lower panel `stallriser` (the brick between the storeys), a front light of `frontLights` lights
 * with a transom bar at `transom` of the light height (from the sill), one light per side, a head panel `head`.
 * `panels` overrides stallriser/head per storey (the top storey of Hasebroekstraat: a tall solid panel under a 0.7 m band of
 * lights). `paintedStoreys`: those modules' panels and closures in the trim colour (painted timber); the others keep
 * the wall brick. `console`: a white slab (trim colour, 0.15 m, 6 cm past the plan) under the stack's foot.
 */
export interface OrielIntent {
  /** Metres (measured; intents name no `...M` keys): span across the front, projection from the wall, angled side run. */
  span: number; projection?: number; returns?: number;
  /** Metres: the lower (stallriser) and head panels of every module, `panels` per storey. */
  stallriser?: number; head?: number; frontLights?: number; transom?: number;
  panels?: Record<string, {stallriser?: number; head?: number}>;
  paintedStoreys?: number[];
  /** Metres over a painted module's foot where the paint starts: the stallriser under it stays brick (Hasebroekstraat 56-70: 0.75). */
  paintFrom?: number;
  console?: boolean;
}
export const ORIEL = {projection: 0.5, returns: 0.3, stallriser: 0.4, head: 0.35, frontLights: 3, consoleM: 0.15, consoleOverM: 0.06} as const;

/**
 * A hoist cap over dormers (`dormerCap`, Hasebroekstraat 53-67 and 56-70: the flared hood over the dormer of the oriel
 * axis that shelters the hoist beam). On the listed dormers (index into the front's dormers, left to right as drawn): a
 * trapezoid hood standing on the dormer, `rise` metres high (measured 1.2 m), as wide as the dormer at its foot and
 * `flare` metres wider on each side at its top (measured 0.25 m), 0.9 m deep from the dormer front, in `colour` (a measured tint;
 * default the weathered zinc grey of the 2024-12-11 strip, #adad9d).
 */
export interface DormerCapIntent { kind: 'hoist'; dormers: number[]; rise?: number; flare?: number; colour?: string }
export const DORMER_CAP = {rise: 1.2, flare: 0.25, depthM: 0.9, colour: '#adad9d'} as const;

/** Historic (17th/18th-c.) canal-house vocabulary, see `HistoricFrontIntent`. */
export const GABLE_WINGS = ['volutes', 'scrolls'] as const;
export const GABLE_FINIALS = ['crab', 'vase', 'ball'] as const;
export const ROOF_GABLETS = ['crest', 'pediment'] as const;
export const GROUND_FRONT_KINDS = ['arcade', 'pui', 'wall'] as const;
/** `blank`: a bay of plain wall with no opening (Jan Evertsenstraat 143: brick between the house door and the cafe window). */
export const GROUND_BAYS = ['door', 'glazed-door', 'window', 'shutter', 'panel', 'blank'] as const;
export type GroundBay = typeof GROUND_BAYS[number];
/** `box` (1976-1992 infill, Kinkerstraat 109-161): a flat-topped dormer whose cheeks and back are in the wall material (a brick roof box), roof covering on its flat top. */
/** `flat` (Jan Evertsenstraat 151-160, 1939): a timber dormer 1.8 m high (151: 13.3-15.3 m with its roof edge) at the plain dormer's setback, under a flat roof (no pitched top). */
export const DORMER_STYLES = ['plain', 'pediment', 'pointed', 'box', 'flat'] as const;
/** Dormer body materials (`FrontIntent.dormerBody`); absent = the trim slot. */
export const DORMER_BODIES = ['stone', 'brick'] as const;
/**
 * Tower caps: a pyramid, a flat slab, or `stepped` (Amsterdam School: two receding brick tiers under a flat slab).
 * `merlons` (Helmersbuurt 1899-1900 wall dormers, Derde Helmersstraat 54-66): a flat brick top with three square brick
 * merlons (one at each end, one centred) TOWER_MERLONS.riseM high and wide, flush with the tower front.
 */
export const TOWER_CAPS = ['pyramid', 'flat', 'stepped', 'merlons'] as const;
export const TOWER_MERLONS = {riseM: 0.55, widthM: 0.5, depthM: 0.45} as const;
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
  /**
   * Local reference image (repo-relative), e.g. the facts-step panorama crop, or an archived crop in the source-data
   * repo: `source-data://pand-reference-walls/<pand>/<file>`, resolved under `$MAP_RECALL_SOURCE_DATA` (sourceData.ts).
   */
  image?: string;
  /** sha256 of `image` (required for `source-data://` images; resolution fails loudly when the bytes differ). */
  sha256?: string;
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
  /** Neck/bell flank curve (CROWN_SHOULDERS); read from the strip skyline (`flankCurvature`), default `concave`. */
  crownShoulder?: typeof CROWN_SHOULDERS[number];
  /** Neck/bell: the neck's width as a share of the crown width, measured on the photo (default 0.5 neck, 0.46 bell). */
  crownNeckWidth?: number;
  /**
   * Neck/bell: an entablature under the cap, measured on the photo, every part a share of the neck width (intents carry
   * no metres): a cornice `ledge` tall projecting `projection` past each side of the neck, over a `frieze` (painted with
   * the cap in the stone colour). Absent: the cap sits straight on the brick neck (unchanged).
   */
  crownCapCornice?: {ledge: number; projection: number; frieze?: number};
  /** Neck/bell: cap rise as a share of the neck width, measured (absent: the stock share of the crown rise). */
  crownCapRatio?: number;
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
  /**
   * With `bayWidths` (Jan Evertsenstraat 1925-27 rows): the window of each axis as a share of its bay (one per axis,
   * 0.3..1), centred in the bay, instead of the default 58 %. A share near 1 lets two windows touch across a thin pier
   * (a box frame beside its flat neighbour) or brings a window against the party wall, where the neighbour's mirrored
   * half completes it (a window straddling the party wall). A box frame (`bayWindows.hood`) then wraps the windows of its
   * axes exactly. Absent = the default widths, byte-identical.
   */
  bayFill?: number[];
  /**
   * Window kind per axis where it differs from `windows` (key = axis index on the front's grid, left to right as seen;
   * every window storey above the ground): the wide four-light window of a row's end house beside its box frame. A box
   * frame (`bayWindows.hood`) takes the kind of its first axis. Wins over `storeyWindows`. Absent = byte-identical.
   */
  axisWindows?: Record<string, WindowKind>;
  /**
   * Window head per axis where it differs from the front's (key = axis index on the shared grid, left to right as seen):
   * `kind` on the listed `storeys` (Eerste Helmersstraat 233-239, 1899: the top storey's centre window is round-arched
   * over segmental neighbours). Arch rings, keystones and tympana follow the front's `windowHead`. Absent = byte-identical.
   */
  axisHeads?: Record<string, {kind: 'round' | 'segmental' | 'flat'; storeys: number[]}>;
  /**
   * One front of a pand with several fronts on the street, raised over its lower neighbour with a full-depth body behind
   * it: its flat roof band keeps its own eaves (a stepped flat roof) instead of being read as a tower bay that takes the
   * neighbour's roof (a front-plane wall with nothing behind it). Jan Evertsenstraat 52-56 (the row house beside the low
   * end) and 89A-91 (the 15.9 m step). Absent = the tower-bay rule, byte-identical.
   */
  stepBody?: boolean;
  /** A storey whose windows do not sit on the shared bays gives its own weights (one per window of that storey; key = storey index from the ground, or "last"), e.g. `{"4": [1, 0.6, 0.6]}` for one far-left and a close pair. */
  storeyBayWidths?: Record<string, number[]>;
  /**
   * A window ribbon (Rivierenbuurt 1934, Boterdiepstraat 3-59: the top storey's band of three or four lights over the
   * two-axis body): the storey's windows stand side by side between `from` and `to` (shares of the front, left to
   * right as seen), equal, their frames meeting in one post; key = storey index or last. Off the body's axes, so not
   * together with `storeyAxes`/`storeyBayWidths` for that storey. Absent = byte-identical. `pier` (m, 0.02-2.5; a row of small attic lights spaced 1.4 m apart): brick
   * between neighbouring windows instead of the touching frames (Boterdiepstraat 17: three two-light windows, 0.38 m
   * apart), the first and last window then standing on `from` and `to`.
   */
  storeyRibbons?: Record<string, {from: number; to: number; pier?: number}>;
  /**
   * Window width per storey, in metres (Indische Buurt 1925-26 rows, Molukkenstraat 7-29: three 0.75 m square attic
   * lights over three 1.17 m windows, on the same axes): each window of the listed storey keeps its axis centre and
   * takes this width instead of the grid's. Key = storey index from the ground, or "last". Only on the shared axes (not
   * with `storeyRibbons` or `storeyBayWidths` for that storey). Absent = byte-identical.
   */
  storeyWindowWidths?: Record<string, number>;
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
  /**
   * The house door is a round-arched portiek opening (Amsterdam School, Polanenstraat 229-311, Spaarndammerdijk 247-299):
   * `span` m wide (0.8..2.6), its semicircular head's crown `apex` m over the ground storey floor (1.8..4, at least
   * span / 2 + 1.2), a dark leaf with no transom. Absent = the square door with its transom, byte-identical.
   */
  doorArch?: {span: number; apex: number};
  /** Ground storey noticeably taller than upper storeys (bel-etage / shop level). */
  tallGround?: boolean;
  basement: typeof BASEMENTS[number];
  /** The basement is a souterrain: a full storey (half below the street) under a bel-etage reached by the stoop, with storey-sized windows, instead of a 0.7-1.2 m plinth. Needs a basement. */
  souterrain?: boolean;
  cornice: typeof CORNICES[number];
  windows: typeof WINDOWS[number];
  /** Window kind per storey where it differs from `windows` (key = storey index from the ground, or "last"): a cross-transom ground storey under sashes, 6-over-6 sashes under 8-over-8 bel-etage ones. */
  storeyWindows?: Record<string, WindowKind>;
  /**
   * Window heads on the window storeys (`storeys`, default every storey above the ground): `segmental` = a shallow arc
   * (rise 0.08 x the window width, the survey median of 0.03-0.10), `round` = a semicircle, `flat` = square (the default). `archRing`
   * lays a ring of `colour` round the head (`widthCourses` brick courses deep, default 3 = about 0.17 m; `style: "blocks"`
   * = five radiating blocks with brick between) with an optional keystone block at the crown; without it the head stays
   * plain brick. `relieving` = a square-headed window under a segmental relieving arch (rise 0.25 x its span) springing
   * just above the head over a brick tympanum: it needs an archRing. Not together with `archedStoreys`.
   */
  windowHead?: {kind: typeof WINDOW_HEADS[number]; storeys?: number[]; archRing?: {colour: typeof ARCH_RING_COLOURS[number]; style?: typeof ARCH_RING_STYLES[number]; keystone?: boolean; widthCourses?: number;
      /** `style: springers`: [length outward from the arch foot, height] in metres (default [0.14, 0.18]). */
      springerSize?: [number, number];
      /** Relieving arches only: `round` = a semicircle over the span (rise = half the span) instead of the segmental 0.25. */
      shape?: 'segmental' | 'round';
      /** Relieving arches only: the springing line's height over the window head in metres (default 0.04), a painted band or a plain lintel course between them (Nassaukade 147: 0.2, 150: 0.55). */
      springGap?: number};
    /**
     * Tympanum (Kinkerstraat 1886-1897: 49-53, 288, 298): the arched part of a segmental or round head is a solid painted
     * fill (`stone`, or the palette's band brick) instead of glass. The glazing stops square at the springing line (the
     * head minus the arch rise); the fill is the arch segment over it, 2 cm proud, under the ring. A keystone stays at the
     * arch crown. Under a `relieving` arch the fill is the arch field over the square head (`dark`, or `band`: the palette's
     * band brick, the ochre moulded-brick tympana of Eerste Helmersstraat 209-213).
     */
    tympanum?: typeof TYMPANUM_FILLS[number]};
  /** Window width as a share of the front (all windows of a full storey together, 0.3..0.8; survey median 0.66). Default: the legacy 58 % of an equal-pier bay. Only on the shared equal-pier grid (not with bayWidths). */
  windowShare?: number;
  /**
   * Window height per storey as a share of the storey height (ground storey first; one entry per storey, 0.15..0.9: a row of small attic lights reads 0.17), or
   * `diminishing` for the survey medians (`DIMINISHING_WINDOW_HEIGHTS`: bel-etage tallest, the attic storey smallest).
   * The window head keeps a fixed share of wall above it; the sill moves. Default: the legacy 0.62 / 0.6 - 0.02 per storey.
   */
  windowHeights?: 'diminishing' | number[];
  /**
   * Window head line per storey (ground first, one per storey, 0.4..0.98): the top of the window head as a share of its
   * storey height, measured on the strip, instead of the common 0.86 (`HEAD_LINE`). Needs a `windowHeights` list; the sill
   * follows from the window height.
   */
  headLines?: number[];
  /** Speklagen: stone courses (`palette.band`, else `stone`) every `spacing` brick courses, each `courses` deep (default 2), from the plinth to the eaves. With `bands: "speklagen"`. */
  speklagen?: {spacing: number; courses?: number};
  /**
   * Relative storey heights, ground storey first (one weight per storey, 0.4..3; metres work too: they are normalised to
   * the wall). Canal-belt survey medians: bel-etage 1.45, first 1, second 0.97, top 0.85 of the first floor. Replaces the
   * default rule (ground 1.1 or 1.32 with `tallGround`, uppers diminishing 4 % per storey). A low basement is unaffected; a
   * souterrain weighs one unit unless the list has one more entry than `storeys`, the souterrain's weight first.
   */
  storeyHeights?: number[];
  /** `low`: a 0.45 m stone plinth with the basement wall in brick above it (default `full`: stone over the whole basement height). */
  plinth?: 'full' | 'low';
  /** Vertical iron bars in the basement lights (traliewerk). */
  basementBars?: boolean;
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
  balconies?: { storeys: number[]; bays: number[]; projecting?: boolean;
    /**
     * `timber-bracketed` (Nassaukade 145-150): a timber platform per storey over the listed bays (neighbouring bays join
     * into one balcony), 0.75 m deep and 0.14 m thick, its front 0.25 m wider than the window run on both sides, on carved
     * brackets (one per 1.1 m of width, at least two), with a 1.0 m guard on the front and both returns: white turned
     * balusters at ~0.13 m under a handrail (`rail: turned`, default) or a wrought-iron grille (`rail: iron`). Platform and
     * brackets take the trim colour (painted white), an iron rail the door colour.
     */
    style?: typeof BALCONY_STYLES[number]; rail?: typeof BALCONY_RAILS[number];
    /** Storeys (of `storeys`) built in `style`; the others keep the library guard (a balconette over a timber balcony, Nassaukade 148). Default every storey. */
    styleStoreys?: number[];
    /** Bays per storey where they differ from `bays` (key = storey index): a full-width balcony on storey 1 under centre ones (Nassaukade 147). */
    storeyBays?: Record<string, number[]> };
  /**
   * Glazed bay windows (erkers). `bay`: the windows of these upper storeys in that bay become one projecting three-face
   * bay each. `bays` instead of `bay` (Amsterdam School multi-bay erker): ONE bay projecting 0.55 m over the span of the
   * inclusive axes `{from, to}` (8 cm in from the span's bay edges), rising through the listed consecutive storeys as one
   * stack. Each storey: a solid stallriser panel 0.85 m high (wall brick) under a front light divided into two lights per
   * spanned axis, one light in each angled side (0.25 m return), a 0.2 m head panel; closed at its foot and top. `cap` on
   * the top storey: `hip` (a lean-to hipped roof rising 0.45 m to the wall, roof colour), `flat` (a 0.12 m slab overhanging
   * 6 cm, trim colour) or `none` (default: the closure only). An `oriel` stack may list the ground storey (0) when the
   * front has no shopfront or ground front: the canted bay then stands on the pavement and its `console` sits under the
   * first upper storey's module instead (Boterdiepstraat 9-33, Hoendiepstraat 5-35: the white slab at 2.95 m).
   */
  bayWindows?: { bay?: number; bays?: {from: number; to: number}; storeys: number[]; cap?: typeof ERKER_CAPS[number];
    /** `painted` (a timber erker, Nassaukade 146): its panels, closures and cap in the trim colour instead of wall brick and roof. Multi-bay erkers only. */
    finish?: 'painted';
    /**
     * `hood: true` with `bays` (Jan Evertsenstraat hood-lisene rows): instead of the storey-high erker, a shallow box
     * frame round the window of the spanned axes on each listed storey (0.25 m deep, square returns, no stallriser,
     * white timber: the trim colour) with a hood slab over every box (0.12 m, 0.1 m past the box front and sides, in
     * `palette.band`, else the wall). The box takes the window's sill and head; `cap` does not apply.
     */
    hood?: boolean;
    /**
     * A painted timber oriel (Hasebroekstraat 53-67 and 56-70, 1915) instead of the storey-high erker: see `OrielIntent`.
     * With `bays` only; not together with `hood` or `finish`.
     */
    oriel?: OrielIntent };
  /**
   * Horizontal masonry courses: a stone sill line at every upper storey and/or lintel bands (stripes of a different brick).
   * `courses` (Amsterdam School brick banding, needs `palette.band`): the storeys in `courseStoreys` are laid whole in the
   * band brick (a 4 cm facing, cut around the openings), and every storey above the ground carries thin raised courses
   * at its lintel line in the band brick: 3 courses (2 on storeys under 2.8 m), 5 cm high, 11 cm apart, 7 cm proud,
   * starting 5 cm over the storey's window heads. A multi-bay erker interrupts both.
   */
  bands?: 'none' | 'storey' | 'lintel' | 'both' | 'courses' | 'speklagen' | 'painted';
  /**
   * `bands: painted` (Nassaukade 145-150): continuous painted stucco bands across the whole front (stone colour), cut
   * around the openings, 4 cm proud, at the `bandLines` of every band storey: `sill` (its top on the window sills),
   * `transom` (centred on the transom line, 0.78 of the window height: the impost band of T-windows) and/or `head` (its
   * foot on the window heads); default sill + head. Band heights in metres (`bandHeights`, defaults sill 0.14, transom
   * 0.10, head 0.17), measured on the strip.
   */
  bandHeights?: {sill?: number; transom?: number; head?: number};
  /** `bands: painted`: the centre of the transom band as a share of the window height from the sill (0.3..0.95, default 0.78), measured on the strip (Kinkerstraat 18-4: 0.65). */
  bandTransomAt?: number;
  bandLines?: ('sill' | 'transom' | 'head')[];
  /**
   * `bands: painted`: a painted ledge `courses` brick courses high (0.055 m each) on the floor line of each listed storey (0-based), the stone colour,
   * the bands' depth (Jan Evertsenstraat 139-160: the white ledge at 9.7 m under the white window band, brick between it
   * and the band's sill). Absent = none.
   */
  bandFloors?: {storeys: number[]; courses: number};
  /** 0-based storeys carrying the painted bands (default every storey above the ground, and the ground when it has no shopfront). */
  bandStoreys?: number[];
  /** Sills under the surround-storey windows: `consoles` = a painted sill slab on two console blocks. */
  windowSills?: typeof WINDOW_SILLS[number];
  /** `bands: courses`: 0-based storeys laid whole in the band brick (ground = 0 only without a shopfront/ground front). */
  courseStoreys?: number[];
  /**
   * Storeys painted in a second colour over the brick (Kinkerstraat 21 and 23: a later shop insert left the first storey
   * white-painted over the whole width): each listed 0-based storey (the ground only without a shopfront/ground front) is
   * laid as a 4 cm facing from its floor to the next floor (the top storey to 2 cm under the eaves), cut around the
   * openings, in the wall material and `colour`, exported as a measured tint (the paint is drawn as measured, not lifted
   * into the city brick range). Absent = byte-identical. `from` (m, 0.05..4): the paint starts that far over each listed
   * storey's floor, brick below it (Gorontalostraat 25-45, 1926: the white top storey begins at its window sills, 0.45 m
   * over the floor; Zaanhof 1919: the render starts over the first-floor window heads, 3.3 m up a tall top storey; absent = from the floor).
   */
  paintedStoreys?: {storeys: number[]; colour: string; from?: number};
  /**
   * Brick lisenes (Amsterdam School pilasters) at the front's viewer-left (`leftEnd`) / right (`rightEnd`) end, from the top of the ground storey
   * to 0.3 m under the eaves, 0.1 m proud, with a 0.15 m corbel cap 0.16 m proud. `half` (0.25 m wide) is the house's half
   * of a lisene shared across the party wall (its outer face follows the party plane); `full` is a whole 0.45 m lisene.
   */
  lisenes?: { leftEnd?: 'half' | 'full'; rightEnd?: 'half' | 'full';
    /**
     * Lisenes standing on bay boundaries inside the front (Hembrugstraat 100-232, 1925: two brick pilasters flank the
     * portiek's staircase axis): indices into the shared grid's bay edges (1 .. grid - 1, `1` = between the first and
     * second bay), each a whole lisene centred on that edge, `breadth` m wide (0.2..0.8, default 0.45). Absent = none.
     */
    at?: number[]; breadth?: number;
    /** The lisenes stop 0.05 m under this storey's floor (0-based; a white attic storey over them), not 0.3 m under the eaves. */
    stopStorey?: number };
  /**
   * Horizontal brick stripes (buildingRecipe/brickStripes.ts): zones where courses of the band brick alternate with the
   * wall brick (Hembrugstraat 2-32's striped ground storey, the striped portiek bay of Hembrugstraat 100-232). Absent = byte-identical.
   */
  /** A staircase light through the storeys on one axis of the shared grid (stairLight.ts). Absent = byte-identical. */
  stairLight?: StairLightIntent;
  /**
   * A rendered gable (Zaanhof 1919, Walenkamp): the crown face in the render `colour` (#rrggbb, a measured tint; the
   * storeys under it keep their brick or take `paintedStoreys`) and a painted board `bargeboard` metres deep inside each
   * raking edge in the trim colour (0.08..0.4; bargeboards.ts). Only on a gabled crown (point, step, neck, raised-neck,
   * bell, spout). Absent = byte-identical.
   */
  renderedGable?: {bargeboard: number; colour: string};
  brickStripes?: BrickStripeZone[];
  /**
   * Projecting brick hoods (Jan Evertsenstraat): over every upper-storey window, or over a ladder pair as one, a ledge in
   * the wall material 0.12 m high and 0.22 m proud, 2 cm over the head, 0.1 m wider than the window on each side.
   * `{colour}` (Ferdinand Bolstraat 40-54, 1875-77): the same ledge in the palette's band brick (`band`: the cream
   * moulded-brick hood friezes of the polychrome fronts; needs `palette.band`) or the stone colour (`stone`).
   */
  windowHoods?: boolean | {colour: 'band' | 'stone'};
  /**
   * Iron wall anchors (De Pijp 1882-1893 rows; buildingRecipe/wallAnchors.ts): a dark cross `size` m tall (default 0.36)
   * on every pier and end pier, `over` m (default 0.35) over the window heads of the listed upper `storeys` (default
   * every storey above the ground). Absent = byte-identical.
   */
  wallAnchors?: {storeys?: number[]; size?: number; over?: number};
  /**
   * One balcony along the whole front at the floor of `storey` (Jan Evertsenstraat 139-160, over the ground storey): a
   * slab `slab` m thick (default 0.25) and `projection` m deep, its top on the storey floor, in `slabColour` (default the stone
   * colour), under a guard `guardRise` m high (default 1.0) on its nose and both returns: `iron` bars (the door colour) or a
   * solid `brick` front in the wall material, 0.1 m thick. Neighbours' runs meet on the party plane. Evidence = the strip
   * rows of slab and guard.
   */
  balconyRun?: {storey: number; projection: number; slab?: number; guard: typeof BALCONY_RUN_GUARDS[number]; guardRise?: number; slabColour?: string; evidence: string};
  /**
   * Glazed tile panels (Bellamybuurt 1915 rows, Hasebroekstraat 56-70; buildingRecipe/tileAccents.ts): on every pier of
   * the listed storeys (0-based, >= 1), at the windows' mid-height, a row of tile diamonds in `colour` (a measured tint)
   * between two patterned brick courses in `courses` (default the palette's band brick, else the wall). Absent =
   * byte-identical.
   */
  tilePanels?: {storeys: number[]; colour: string; courses?: string | false;
    /** `piers` (default): diamonds between two courses on every pier at the windows' mid-height (Hasebroekstraat 56-70).
     * `sills`: a row of `count` (default 3) small square tiles 0.25 m under the sill of the windows on the listed `axes`
     * (default every axis), no courses (Hasebroekstraat 90-114, green tiles under the narrow window). */
    place?: 'piers' | 'sills'; axes?: number[]; count?: number};
  /**
   * Frieze vents (Helmersbuurt 1893-1901 rows, Eerste Helmersstraat 209-229; buildingRecipe/friezeVents.ts): one white
   * cast panel over each top-storey window axis in the frieze under the cornice, `span` x `rise` metres, its top `drop`
   * metres under the cornice foot (measured), in the stone colour; `slot` = a dark grille slot across its middle third;
   * `axes` = only those axes. Needs a cornice. Absent = byte-identical.
   */
  friezeVents?: {span: number; rise: number; drop: number; slot?: boolean; axes?: number[]};
  /**
   * Entablature (Helmersbuurt 1893-1900 rows, Eerste Helmersstraat 116-122 and 42-56; buildingRecipe/entablature.ts): the
   * measured deep white crown band in place of the cornice style's fixed height: `rise` metres in all, a projecting
   * `cap` (`capDepth`, default 0.4 m), a `frieze` that is a flush white band (`trim`) or brick between consoles
   * (`wall`), an `architrave` fillet at its foot, and `consoles` console brackets end to end. Needs a cornice.
   * Absent = the style's cornice, byte-identical.
   */
  entablature?: {rise: number; cap: number; frieze: 'trim' | 'wall'; capDepth?: number; architrave?: number; consoles?: number};
  /**
   * Jamb blocks (Eerste Helmersstraat 116-122, 1893; buildingRecipe/jambBlocks.ts): `count` white stone blocks on each
   * jamb of every window of the listed `storeys` (default all), evenly spaced up the opening, `rise` m high, reaching
   * `reach` m out from the jamb, in the stone colour. Absent = byte-identical.
   */
  jambBlocks?: {count: number; rise: number; reach: number; storeys?: number[]};
  /**
   * Tall plain parapet (Jan Evertsenstraat): the full storeys end `courses` brick courses (0.055 m each) under the eaves
   * and the wall above them is plain; `coping: true` lays a thin coping (0.1 m, 4 cm proud, the cornice colour) on its
   * top. A crown field; needs `cornice: "none"` and a `flat` or `cornice` gable.
   */
  parapet?: {courses: number; coping?: boolean};
  /**
   * Flat roof run out over the front as a deep eaves overhang (Plan Zuid rows of 1930-1936, Rivierenbuurt): a slab
   * `fascia` metres thick hanging from the eaves, `projection` metres out, its ends on the party planes so a row reads as
   * one line; fascia `colour` and `soffit` are measured tints (default the trim). A crown field; needs `cornice: "none"`
   * and a `flat` or `cornice` gable (buildingRecipe/eavesOverhang.ts). Absent = byte-identical.
   */
  eavesOverhang?: EavesOverhangIntent;
  /**
   * Slab canopies (luifels) over the ground-storey door and windows of the Plan Zuid portiek rows
   * (buildingRecipe/groundCanopy.ts). Absent = byte-identical.
   */
  groundCanopy?: GroundCanopyIntent;
  /**
   * `bands: painted` (Jan Evertsenstraat 9-33): the window zone of every band storey, from the top of its sill band to
   * the foot of its head band, is faced in `palette.band` (a second brick: the yellow piers between the windows under
   * red spandrels), 2 cm proud, cut round the openings; the painted bands stay 2 cm in front of it.
   */
  bandPiers?: boolean;
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
  /**
   * Dormer body material (Helmersbuurt white timber dormers, issue #81): `stone` draws the cheeks, back and pediment in the
   * stone colour (painted white) instead of the trim slot, which exports as an opening (frame) material: a frame-class
   * body sunk into the roof slope read as a window piercing the roof and left its own pane with no wall. The window
   * frame, bars and pane stay trim and glass. Not for `box` dormers (brick). Absent = trim, byte-identical.
   * `brick` (Kinkerstraat 60-62, 1893 Neo-Renaissance): a brick wall dormer, its cheeks, back and front gable (the
   * pediment or pointed front) in the wall colour; the frame, bars and pane stay trim and glass.
   */
  dormerBody?: typeof DORMER_BODIES[number];
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
  tower?: {bays?: {from: number; to: number}; corner?: boolean; rise: number; cap: typeof TOWER_CAPS[number];
    /**
     * `per-axis` (a wall dormer over several axes, Derde Helmersstraat 54-66: two lights over the two right axes): one
     * light per spanned axis on the body's axis centres, as wide as the body's top-storey windows, `lightRise` upper-storey
     * heights tall (0.2..0.9, default 0.5), its sill `lightSill` upper-storey heights over the eaves (0..0.6, default 0.3),
     * instead of one centred light per storey of rise. With `bays` only. Absent = byte-identical.
     */
    lights?: 'per-axis'; lightRise?: number; lightSill?: number};
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
  /**
   * Measured dormer size and place on the slope: the sill `sill` (m, 0.05..2) over the eaves line, the dormer's height `rise`
   * (0.6..2.5) and its front's `setback` (0.05..2) behind the facade, instead of the style default (sill 0.05 m, setback
   * 0.35 m, height 1.45 m; flat 1.8 m). On a low-pitched roof the default sill sits under the roof plane at the setback and
   * the roof cuts through the dormer frame; a raised sill needs the front set back to where the slope reaches it
   * (Gorontalostraat 25-45: dormers 13.7-15.2 m over a 12.7 m eaves; Molukkenstraat 35-53: 13.05-13.9 m over 12.8 m).
   * Not on a mansard. Absent = byte-identical.
   */
  dormerSize?: {sill: number; rise: number; setback: number};
  /**
   * A hoist beam out of every dormer (De Pijp 1875-1893 shop rows: Ferdinand Bolstraat 12-54, Albert Cuypstraat 138-162,
   * Van Woustraat 32-72): a timber beam painted with the dormer (the stone colour with `dormerBody: "stone"`, else the
   * trim), centred on the dormer just over its window frame (in the pediment), running from inside the dormer
   * to `reach` metres (0.3..1.5, default 0.8) in front of the dormer's front, rising 0.1 m to its tip. Needs dormers
   * (not `box`/`flat`). Not with `hoist` (the facade beam). Absent = byte-identical.
   */
  dormerHoist?: {reach?: number};
  /** A hoist cap on some dormers (`DormerCapIntent`). */
  dormerCap?: DormerCapIntent;
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
export interface ShopAwningIntent { style: typeof AWNING_STYLES[number]; colour: string; extent?: { from: number; to: number }; fasciaColour?: string;
  /**
   * `{rows}` (Jan Evertsenstraat 43-135): the band is `rows` glass blocks tall (0.2 m each) instead of filling up to the
   * sills, and the canopy and the shop-glass head drop to sit under it (with `wallCourses` of brick between the band and
   * the first-storey sills). With `palette.glassBlock` the band is its own measured material. `panel` (Jan Evertsenstraat
   * 75-87): the band is a flat painted sign panel of that measured colour instead of glass block (no mortar grid).
   */
  glassBlocks?: boolean | {rows: number; panel?: string};
  /**
   * Rigid canopy only: brick courses (0.055 m) of wall between the canopy (or its glass-block band) and the first-storey
   * window sills, measured on the strip; the canopy and the shop-glass head drop to keep it (Jan Evertsenstraat 9-33: the
   * sign band over the canopy). Default: the canopy sits 2 cm over the glass head the ground storey gives.
   */
  wallCourses?: number }

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
  /**
   * `painted` (Oud-West 1888-1900): the stone dressings (painted bands, arch rings and springers, keystones, eared heads,
   * console sills, quoins) are painted white stucco: their measured `stone` colour is exported as a measured tint, so the
   * look draws it as measured instead of mixing it into the city's pale sandstone (`cityStoneTint`, which greys a white
   * paint to ~#a5a395 on the sheet). House palette only.
   */
  stoneMaterial?: 'painted';
  /**
   * `measured` (Kinkerstraat 47, 63, 87): the wall colour `brick` is a measured strip colour and is drawn as measured
   * (the wall materials export `tintSource: measured`), instead of being lifted and saturated into the city brick range
   * (`cityWallTint` clamps L to 0.3-0.6 and floors S at 0.12: a sunlit light brick darkened, a grey-brown one saturated).
   * The brick texture stays; `painted-brick` implies it. House palette only.
   */
  wallTint?: 'measured';
  /**
   * Exposure record of a measured wall colour (`wallTint: measured` or `painted-brick`): the light-trim white point of the
   * strip crop the colour was read on (palette-from-strip `frame`, the median of the white frames). The panoramas are
   * mostly overcast; with this a look can normalise the wall to a sunlit white point (tint x white / whitePoint) instead
   * of drawing the overcast reading. Exported with the tint as `tintWhitePoint`. House palette only.
   */
  whitePoint?: string;
  /** Large tier only: the glazing colour (default the kit's dark glass `#2a3a42`); measured from the photo by `measure.ts`. */
  glass?: string;
  /** Glass-block band colour measured on the strip (`awning.glassBlocks`): the band is exported as its own measured glass material. */
  glassBlock?: string;
}
/**
 * `painted-brick` (Nassaukade 147, 149, 150): brick painted over; the brick texture keeps its joints, but the wall colour
 * is the measured paint colour (exported as a measured tint, so a near-black or dark grey paint is not lifted into the
 * city brick range).
 */
export const WALL_MATERIALS = ['brick', 'stucco', 'painted-brick'] as const;
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
  roof: RoofIntent;
  palette: PaletteIntent;
  notes?: string[];
}

export const ROOF_SOURCES = ['front', '3dbag'] as const;
export const ROOF_FORMS = ['saddle', 'flat', 'attic'] as const;
/**
 * The roof mass. Only `material` is required. The rest is opt-in (absent = today's behaviour, byte-identical):
 * `source: front` = the roof follows the street front read off the photo (a gable gets a saddle under its outline,
 * a parapet or measured cornice a flat top, a dormered cornice an attic face) and 3DBAG LoD2.2 is an upper bound only;
 * `3dbag` = keep the LoD2.2 roof whatever the front says (the escape when the survey IS right). A block face derives
 * `front` for every pand whose street front carries a measured crown (blockFace/compile.ts `roofSourceFor`).
 * `form` forces the front form; `pitchDeg` the saddle/attic pitch (15-80); `evidence` what on the photo shows it.
 * For an attic band of a `front` roof (blockFace/recipeRoof.ts): `rise` the measured rise of the main roof over the
 * front eaves in upper-storey heights like `crownRise` (0.2-2.5; replaces the attic storey and the 3DBAG p95 cap, the
 * 3DBAG max still bounds it), `rearPitchDeg`
 * the back slope's own pitch (15-80), and `crossGables: true` makes every pointed crown on part of the front the end of a
 * cross roof whose rakes run back to the attic face (Zaanhof 1919: a long saddle with white cross gables).
 * `hip: "front"` (with `form: "saddle"` and `pitchDeg`, on a cornice or flat front): a saddle whose ridge runs back from
 * the middle of the front, hipped down to the eaves behind the cornice at the same pitch, so the street sees no roof face
 * over the cornice and the air sees one ridge per house (Kinkerstraat 33-47, 1885-1886: red-tiled saddles ridged
 * front to back, hipped behind the dormer, on the 2024 orthophoto; the 70 degree attic drew a slate band the strip
 * never shows). The ridge is the eaves + tan(pitch) x half the front width, capped by the 3DBAG max (a flat top).
 */
export const ROOF_HIPS = ['front'] as const;
export interface RoofIntent {
  material: typeof ROOF_MATERIALS[number];
  source?: typeof ROOF_SOURCES[number];
  form?: typeof ROOF_FORMS[number];
  pitchDeg?: number;
  rise?: number;
  rearPitchDeg?: number;
  crossGables?: boolean;
  hip?: typeof ROOF_HIPS[number];
  evidence?: string;
}

/**
 * Large buildings (schools, blocks, offices, police stations, most landmarks): keep the 3DBAG LoD2.2 massing as-is and
 * choose a facade SYSTEM per wall group, addressed by 3DBAG LoD2.2 wall-surface index (never coordinates); the fit
 * (`fitLarge`) derives storey lines, bay pitch, entrance and garage bays from the surfaces, and compose.ts cuts the
 * windows into the exact walls. Validated by `validateLargeIntent` (largeIntent.ts); list a house's surfaces with
 * `scripts/building-recipes/walls.ts`.
 */
export interface LargeWindowShape {w: number; h: number; sill: number}
export interface TiltedBaysIntent {every?: number; first?: number; bays?: number[]; storeys?: number[]}
/** Crown of one house of a row split (`LargeWallIntent.houses`): `cornice` = a stone cornice at the house's own eaves;
 *  `flat` = a plain parapet; `gable` = the 3DBAG gable wall over the eaves kept as the crown (no cornice). */
export const LARGE_HOUSE_CROWNS = ['cornice', 'flat', 'gable'] as const;
/**
 * One house of a row split, left to right along the group's main panel. Shares and counts only, no metres: the fit
 * cuts the main panel at the cumulative shares and takes each house's eaves from the 3DBAG wall over its own span.
 */
export interface LargeHouseIntent {
  /** share of the main panel's width (the list is normalised; measured from the crop's vertical joints/colour changes) */
  w: number;
  /** window bays per upper storey (default: the house width over the group's pitch) */
  bays?: number;
  /** full storeys under the house's own eaves (default: the group's count when its eaves are on the row line, else from the eaves) */
  storeys?: number;
  /** default `cornice` when the group has `cornice`, else `flat` */
  crown?: typeof LARGE_HOUSE_CROWNS[number];
  /** the house's wall colour (default the group's) */
  brick?: string;
  /** the house's window proportions (default the group's `windowShape`) */
  windowShape?: LargeWindowShape;
  /** the photo skyline confirms this house's 3DBAG eaves off the row line: no row-coherence clamp */
  ownEaves?: boolean;
}
export interface LargeWallIntent {
  /** 3DBAG LoD2.2 WallSurface indices (shell boundary index) of this wall group. */
  wallSurfaces: number[];
  /** Optional street the group faces (the facts step fetches a reference crop for it). */
  street?: string;
  /**
   * The 3DBAG wall surface (one of `wallSurfaces`) whose panel is the group's main panel, in place of the widest panel
   * reaching the ground: for a front whose widest 3DBAG plane is an artefact (Haarlemmerweg 285-303, issue #65: the
   * projecting lower storeys of one third of the west wing reconstructed as a 35 m plane sloping from 14 m to 3 m in
   * front of the 32 m wing front). Bay count, storey lines, entrance and the photo pairing follow it. Absent: unchanged.
   */
  mainSurface?: number;
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
  signage?: string | {text: string; colour?: string; mount?: 'fascia' | 'wall' | 'glazing' | 'canopy' | 'cornice';
    /** `wall` mount only: [from, to] fractions of the widest panel's width from the viewer's left that the lettering spans (default centred over 0.6 of the panel; Nieuwpoortkade 2's white-brick "da vinci creatieve ruimtes" runs over the left half, issue #83) */
    along?: [number, number]};
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
  balconies?: {storeys: number[]; rail?: 'glass' | 'bars' | 'solid'; every?: number; first?: number; bays?: number[];
    /** the rails' own colour (black iron balconies; default the frame colour) */ colour?: string;
    /** projection as a fraction of the storey height (0.08..0.45; default 1.2 m): a shallow balcony on consoles */ deep?: number;
    /** stand in front of the storey's own windows (an iron balcony on a window row) instead of one French window */ windows?: boolean;
    /** with `windows`: the balcony runs the full bay pitch, so neighbouring bays join into one front-wide balcony in front of
     *  punched windows (Stadsloket West's continuous galleries); absent: the bay's windows plus 0.2 m, byte-identical */ run?: boolean};
  /**
   * Grouped windows (issue #35): each bay's opening (`windowShape.w` of the bay) is `count` separate windows with `gap`
   * of the bay (default 0.06) of wall between them, on the listed `storeys` (default every upper storey; 0 = ground).
   * Stadhouderskade 111's school pairs and the Hirsch building's three windows per bay. Absent: byte-identical.
   */
  windowGroup?: {count: number; gap?: number; storeys?: number[]};
  /**
   * Window proportions per storey (factory acceptance #45, 2026-10-24): on each entry's upper `storeys` (1 = first floor)
   * the punched windows take `w` of the bay, `h` of that storey and a sill at `sill` of that storey, in place of
   * `windowShape` (which still sets every other storey). A school's tall first-floor windows under a frieze of small
   * square attic windows (Oostpoort), a warehouse's tall glazing under a low top row. brick-bay-grid and
   * plinth-shopfronts only; storeys of the entries must not overlap. Absent: byte-identical.
   */
  storeyShapes?: {storeys: number[]; w: number; h: number; sill: number}[];
  /** Storeys (0 = ground) with no openings (a blank floor over a shop, a plant floor). */
  blankStoreys?: number[];
  /** Upper storeys (1 = first floor) glazed across every bay like a shop ground (a glazed mezzanine over the shops). */
  glazedStoreys?: number[];
  /** Police signature components: blue-and-white striped POLITIE band over the ground floor, blue lamp beside the entrance. */
  police?: {stripe?: boolean; lamp?: boolean};
  /** What this group's wall is made of when it differs from the house (`palette.wallMaterial`); see GROUP_WALL_MATERIALS. */
  wallMaterial?: typeof GROUP_WALL_MATERIALS[number];
  /**
   * Group colours when they differ from the house palette (`brick` = this group's wall, `glass` = its glazing, `arch` = the
   * brick arch rings over arched openings, default a shade darker than the wall).
   */
  palette?: Partial<Pick<PaletteIntent, 'brick' | 'frame' | 'stone' | 'glass'>> & {arch?: string; /** the mesh plinth panel under a layered curtain wall (`ground: "mesh-plinth"`), a matte panel in this colour instead of the door slot (the Rietveld building's white rendered plinth) */ plinth?: string};
  /**
   * Measured window proportions (`measure.ts` from the rectified photo; replaces the `windows` preset's size): `w` window
   * width as a fraction of the bay, `h` height as a fraction of the storey, `sill` sill height as a fraction of the storey.
   * Proportions only, never metres. brick-bay-grid, ribbon-windows and plinth-shopfronts upper rows.
   */
  windowShape?: LargeWindowShape;
  /**
   * Measured window widths per bay, cycling across the bays as fractions of the bay (as `windowShape.w`), 1-8 entries:
   * `[0.8, 0.3]` draws the wide drawing-room window with the narrow slot beside it that the photo shows on one 2-bay
   * pitch (Haarlemmerweg 940's panel fronts; `windowShape.w` then only documents the wide bay). Bays stay on the
   * group's pitch, so the piers between the openings differ per bay. `windowShape` still sets the height and sill.
   */
  windowPattern?: number[];
  /**
   * `panes`: pane-split glazing (block kit `WinParams.paneSplit`): the frame is one sheet at the back of the recess and the
   * glass separate panes in front of it, so frames, mullions and transoms cost no bar boxes (white-framed cross windows on
   * a byte budget). Absent: the kit's frame ring and bar boxes, byte-identical.
   */
  glazing?: 'panes';
  /** Stone courses at the windows' sill line (`sill`, replacing the per-window sills) and head line (`head`) on every upper storey. */
  courses?: ('sill' | 'head')[];
  /** The ground storey is a souterrain: a low raised basement (blockBuilding/systems.ts SOUTERRAIN) with two small windows per bay (`single`: one), arched with `arches.ground`. */
  souterrain?: boolean | 'single';
  /**
   * `glazed-hall` (Apollohal): the brick base rises to `base` (fraction of the eaves height); above it one glass skin to the
   * eaves, divided into `lights` columns per bay (`baysPerStorey` = the structural posts) and `rows` rows by a mullion grid.
   */
  hall?: {base: number; lights: number; rows: number};
  /**
   * `glazed-columns` (Houthavenkade 26): full-height glass stripes over the listed bays (of `baysPerStorey`, adjacent bays
   * join into one stripe) from storey `from` (default 1) up, `share` of the run's width (default 0.9); `slabs`: the stripe
   * is an enclosed balcony bay 0.45 m deep with a slab at every storey line, else a flush glass band with frame transoms;
   * `glass`: the columns' own glazing colour when it differs from the punched windows' (Houthavenkade 26: reflective
   * grey balcony glass beside dark window panes), default the group's glass.
   */
  columns?: {bays: number[]; share?: number; from?: number; slabs?: boolean; glass?: string};
  /** Fields of this group set by hand that `measure.ts --write` must keep (e.g. `["palette.brick", "baysPerStorey"]`). */
  hand?: string[];
  /**
   * Two wall materials side by side on the group's main panel (measured, `measureFacade` `split`): the wall right of `at`
   * (fraction of the main panel width from the viewer's left; snapped to a bay boundary) is `brick`; the left keeps the
   * group's `palette.brick`. Houthavenkade 26: yellow-brown and dark brick on one 3DBAG plane.
   */
  wallSplit?: {at: number; brick: string};
  /**
   * Row split (opt-in): the main panel is a row of separate houses on one BAG pand (Stadhouderskade 101-111, the
   * canal row of pand 165427), each with its own width, eaves (3DBAG wall over its span), storeys, bays, crown and wall
   * colour. Rows are coherent: an unmeasured eaves more than 0.8 m off the row line, between neighbours on the line, is
   * clamped to it unless `ownEaves`. Absent: one grid across the panel, byte-identical.
   */
  houses?: LargeHouseIntent[];
  /**
   * Arched heads: on the upper-storey windows, on the ground openings (with `ground: "portals"` or a windowed ground),
   * and the band around each head: `brick` (a rowlock arch in the wall brick with stone imposts, default), `stone`,
   * `voussoir` (stone with imposts and a keystone) or `none`.
   */
  arches?: {windows?: ArchKind; ground?: ArchKind; band?: 'brick' | 'stone' | 'voussoir' | 'blocks' | 'none'; /** Only these storeys (0 = ground) get arched heads (the rest stay square-headed); default every storey. */ storeys?: number[]};
  /**
   * Stone dressings on the wall (blockBuilding/dressings.ts): white bands at storey/sill/head lines, speklagen stripes,
   * lintels and keystones, window surrounds, quoins and joint chains, oriels, banded arches, brick piers. Absent: byte-identical.
   */
  dressings?: StoneDressings;
  /** Loading-door axis (warehouses): every `every`-th bay from bay `first` (default 0), or the listed `bays` of the widest panel, is a tall door opening on every upper storey and a wide portal on the ground. */
  hoist?: {every?: number; first?: number; bays?: number[]; arch?: ArchKind};
  /** A carriage gateway through the ground storey in the listed bays of the widest panel (dark arched openings 92 % of a bay wide, plain wall between); default none.
   *  `keepRow`: the other ground bays keep the ground row instead of plain wall, and `hallDoors` may take other bays (Haarlemmerweg 315's
   *  arched passage beside its glazed front door, ground windows either side). Absent: byte-identical. */
  gateways?: {bays: number[]; arch?: ArchKind; keepRow?: boolean};
  /**
   * Glazed hall doors in the listed ground bays of the widest panel (De Hallen's tram-hall gables: a wide portal of
   * white-framed glazed leaves between side windows): `h` of the ground storey (default 0.78), `lights` x `rows` panes
   * per leaf (default 2 x 4), square-headed unless `arch`; the other ground bays keep the ground row. brick-bay-grid only.
   */
  hallDoors?: {bays: number[]; arch?: ArchKind; lights?: number; rows?: number; h?: number};
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
  /**
   * Storeys (0 = ground) faced in another brick colour round their openings: two-tone brick by storey (the 1992
   * Haarlemmerweg 91-109 blocks: red-brown ground and top storeys over buff middle storeys). Each entry is drawn in
   * the brick texture in its `brick` colour; a storey is in at most one entry and not also stone. Absent: byte-identical.
   */
  brickStoreys?: {storeys: number[]; brick: string}[];
  /**
   * Storeys that are a mansard's steep face standing in the 3DBAG wall plane (a shell that models the mansard as a
   * vertical wall): faced round their openings, as dormers, in the slate texture in `colour` (default the slate roof's
   * steep colour), not the stone slot that the city lights pale. Van Eeghenstraat 180's two slate storeys. Absent: unchanged.
   */
  mansard?: {storeys: number[]; colour?: string};
  /** Banded stone pilasters at both ends of every panel of the group (two-tone courses). */
  pilasters?: boolean;
  /** A glazed roof lantern on the highest roof point behind the group's widest panel. */
  lantern?: boolean;
  /** Perforated-brick screen (car parks): a concrete lattice of posts and rails over the wall, glass-block perforations in one bay of three; brick-bay-grid only. */
  screen?: boolean;
  /**
   * Layered `curtain-wall` with opaque spandrel panels (the Rietveld building, 1967: every storey is a 2 m vision band
   * between frosted panels over the floor slab and under the ceiling): in every storey above the ground, a panel `sill`
   * of the storey tall over its floor line and one `head` of the storey under the next floor line (fractions of an upper
   * storey; the top storey's head panel runs up to the eaves), in `colour` (measured from the crop; default the group's
   * frame colour). The grid gains transoms at the panel edges. Absent: the plain grid, byte-identical.
   */
  spandrels?: {sill?: number; head?: number; colour?: string};
  /**
   * The ground storey's height as a fraction of an upper storey (0.3..2.5), when the photo shows it differs from the
   * ground system's default (a low raised plinth under the Rietveld building's curtain wall: 1.8 m under 4.2 m floors).
   */
  groundFactor?: number;
  /**
   * Measured storey heights (issue #59, Oude Turfmarkt 139: floors that get lower going up): one relative height per
   * storey, ground first (`storeys` entries; metres read off the photo work as they are), scaled to fill the usable
   * height under the eaves. Each 0.3..8, the tallest at most 3x the lowest; not with groundFactor, souterrain, an arcade
   * ground, alignWith, plinth.factor or houses (they set storey heights too). Absent: byte-identical.
   */
  storeyFactors?: number[];
  /**
   * The 3DBAG shell (1-based, in facts order) whose surfaces `wallSurfaces` names. A pand of two separate solids (the 2006
   * Rietveld Academie: the tower and the low block) numbers each shell's wall surfaces from 1, so a bare index claims a
   * surface in every shell. Absent: every shell, as before.
   */
  shell?: number;
  /**
   * Openings in only some bays of some storeys: on each entry's `storeys` (1 = first floor; 0 = the ground row, on a
   * "system" ground without hoist, gateways, hall doors, souterrain or garage doors; a ground plinth replaces its own bays) only the listed `bays` (of
   * `baysPerStorey`, from the viewer's left on the widest panel) keep the storey's windows; the rest of the storey is plain
   * wall. The 2006 Rietveld Academie tower: ribbon windows across the middle 16 m of a 40 m dimpled-metal front on three
   * floors, blank metal between. Absent: every bay, byte-identical.
   */
  openBays?: {storeys: number[]; bays: number[]}[];
  /**
   * Loggias (recessed balconies) on the listed `storeys` (0 = ground): in every bay, or only the listed `bays` (the other
   * bays keep the storey's row), an opening `w` of the bay wide and `h` of the storey tall from `sill` (fractions) cut
   * `deep` x the storey height into the wall (0.25..0.8; 0.5 is 1.5 m on a 3 m storey), so its floor, soffit and side
   * returns show, with `lights` glazed leaves at the back and a `rail` balustrade (glass, bars, solid or none; never on
   * the ground) in `colour` (default the frame colour). Defaults in systems.ts `LOGGIA` (OBA IJburg, 2019 crops).
   * brick-bay-grid, ribbon-windows or blank groups. Absent: byte-identical.
   */
  loggias?: {storeys: number[]; bays?: number[]; w?: number; h?: number; sill?: number; deep?: number; rail?: 'glass' | 'bars' | 'solid' | 'none'; lights?: number; colour?: string};
  /**
   * A side light in its own frame colour in each punched window (GitHub #86, Nieuwpoortkade 2's south wing, 2025-09-26
   * crop w05-89: white-framed transom windows each holding a blue-framed opening sash in their left third over a vent
   * strip): a glazing bar at `w` of the window width from `side` (default left; `w` 1 rings the whole light), bars at
   * `low` and `high` of its height (default 0 / 1: none), and a ring in `colour` round the light they enclose, on
   * `storeys` (0 = ground; default all). `bayWindows` entries set `light` per bay. brick-bay-grid only. Absent: byte-identical.
   */
  sideLight?: {side?: 'left' | 'right'; w: number; low?: number; high?: number; colour: string; storeys?: number[]};
  /**
   * Per-storey, per-bay windows (GitHub #86): on each entry's `storeys` (0 = ground) the storey's window becomes one
   * window per bay from `pattern`, cycling across the bays: `w` of the bay pitch wide (0 = plain wall; up to 2, reaching
   * into the next bay, whose entry is then 0), centred `at` of the pitch off the bay axis (-1..1: a window grid offset from the bays), `h` of the storey
   * tall from `sill` of the storey (default the storey's window), `light` the side light's width (0 none, 1 whole),
   * `door` true for a door leaf in the door colour (no sill).
   * The offset small sash windows beside wide windows, singles and doubles that change from storey to storey.
   * brick-bay-grid only, not with windowPattern, windowGroup or storeyShapes on the same storeys. Absent: byte-identical.
   */
  bayWindows?: {storeys: number[]; pattern: {w: number; at?: number; h?: number; sill?: number; light?: number; door?: boolean}[]}[];
  /**
   * Recessed loggia bands (GitHub #86, the GWL-terrein blocks, 1997: a gallery storey cut across a run of bays of a
   * punched brick front, the south end's stack of loggias): per band one opening across `bays` [first, last] and
   * `storeys` [first, last] (inclusive), from `sill` of the first storey to `head` of the last (fractions), cut `deep` x
   * the first storey's height into the wall, glazed in `lights` leaves at the back (default one per ~1.2 m), a `rail`
   * (default glass; none on the ground) in `colour` (default the frame). The bays and storeys it covers draw no windows.
   * Defaults in systems.ts `LOGGIA_BAND`. Needs baysPerStorey. Absent: byte-identical.
   */
  loggiaBands?: {storeys: [number, number]; bays: [number, number]; sill?: number; head?: number; deep?: number; lights?: number; rail?: 'glass' | 'bars' | 'solid' | 'none'; colour?: string;
    /** the back a wall in the wall's brick with rows of windows (the flats' doors and windows behind a gallery): per row, from `sill` to `sill + h` of the band's height, one window `w` wide (fraction of the run) in every run of `every` bays; absent = glazed leaves */
    back?: {sill: number; h: number; every: number; w: number}[]}[];
  /**
   * Dark columns in front of the ground storey (GitHub #86, the Da Vinci south wing's steel posts between brick infill
   * panels): on every `every`-th bay edge from edge `first` (0 = the panel's left end), `w` of the bay pitch wide, from the
   * ground to the top of the ground storey, in `colour`; `plinth` a strip `h` of the ground storey tall along the ground
   * in its own `colour` (a vent grille). Needs baysPerStorey. Absent: byte-identical.
   */
  groundPiers?: {every: number; first?: number; w: number; colour: string; plinth?: {h: number; colour: string}};
  /**
   * A glazed plinth under the group's system: on the listed `storeys` (default [0]; 0 = ground) one glazed opening per bay
   * (or the listed `bays`) leaving `pier` of the bay as wall, from `sill` to `sill + h` of the storey, in `lights` equal
   * lights with its own mullion pitch, optionally a transom at `transom` of the glazing height; the plinth storeys are
   * `factor` x an upper storey tall (0.6..2.5; on storey 0 it is `groundFactor`'s alternative). Shop and library grounds
   * under a punched grid or a blank wall (OBA IJburg's library storey, Reigersbos shops, Buitenveldert). Absent: byte-identical.
   */
  plinth?: {storeys?: number[]; bays?: number[]; lights: number; sill?: number; h?: number; pier?: number; transom?: number; factor?: number};
  /**
   * A layered screen of pale panels over the wall on the listed `storeys` (expanded-metal mesh, perforated sheet): one panel
   * per bay, `joint` m apart (default 0.06), from `from` to `to` of the storey's height (defaults 0.15 and 0.92, leaving
   * the slab edges in the wall colour), in `colour`; bays with an opening are left open (the window shows). The 2006
   * Rietveld Academie low block: white expanded-metal panels over its upper storey between white slab edges. Layered kit only.
   */
  meshScreen?: {storeys: number[]; colour: string; from?: number; to?: number; joint?: number};
  /**
   * Facade cladding over the group's wall (blockBuilding/cladding.ts, GitHub #49): `ribs` vertical ribbed metal,
   * `boards` horizontal profiled metal or boarding, `louvres` deep horizontal slats over a dark ground, `panels` flat
   * cassettes with joints, `paint` brick painted over (the brick texture in the paint colour). It covers `from`..`to`
   * of the group's eaves height (fractions; default the whole wall, so a plinth below `from` keeps the wall colour),
   * in `colour` (default the wall's) with lines in `lines` (default a shade darker; louvres: the dark ground). `pitch`
   * is the line spacing in metres (a material property, measured off the crop), `rowPitch` a panel row's height.
   */
  cladding?: {kind: 'ribs' | 'boards' | 'louvres' | 'panels' | 'paint'; colour?: string; lines?: string; pitch?: number; rowPitch?: number; from?: number; to?: number;
    /** with `wallSplit`: clad the `left` (the group's own colour, default) or the `right` (the split colour) side */
    side?: 'left' | 'right'};
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
  /**
   * Ground `arcade` (needs `ground: "arcade"`): the recessed shop arcade's proportions, each optional (blockBuilding
   * ARCADE_DEFAULTS, Mercatorplein): `pier` width as a fraction of the bay, `walk` depth (shopfronts behind the wall face)
   * as a fraction of the ground storey's height, opening `head` as a fraction of the ground storey, the chamfered
   * shoulders' `rise` and `chamfer` as fractions of the opening width, `storeyFactor` the ground storey's height over an
   * upper storey (default 1.6), `facing` false = no rendered lintel band and pier facings.
   */
  arcade?: {pier?: number; walk?: number; head?: number; rise?: number; chamfer?: number; storeyFactor?: number; facing?: boolean};
  /**
   * Free-standing piers in front of a glazed storey band on their own pitch (blockBuilding/arcadePiers.ts; Stadsloket
   * Zuidoost: 8 white piers under a white beam where the windows above run on a 2.4 m sub-bay): `count` piers evenly
   * from end to end of the main panel or of its `bays` [first, last] span, over the contiguous `storeys`, `w` wide,
   * `depth` proud of the wall, under a `beam` (m) at the band's top, in the group's stone. Absent = byte-identical.
   */
  arcadePiers?: ArcadePiersIntent;
  /**
   * A projecting glazed window box across a span of bays on one storey (blockBuilding/windowBox.ts; Stadsloket Zuidoost's
   * 18 m glass band over the arcade): `sill` and `h` of the storey, standing `proud` of its height out of the wall, in the
   * frame and glass slots, `lights` across it and a transom. Leave the bays behind it blind (`openBays`). Absent = byte-identical.
   */
  windowBox?: WindowBoxIntent;
  /**
   * Flat sign boards on the main panel (blockBuilding/signBoards.ts; Haarlemmerweg 337's dark sign band and boards on its
   * sheet front): `along` [from, to] of the panel width from the viewer's left, `up` [from, to] of the panel's top height,
   * in `colour` (default the door colour), standing proud of the wall and any cladding. Absent = byte-identical.
   */
  signBoards?: SignBoardIntent[];
  /**
   * A false front (blockBuilding/signBoards.ts): on every panel of the group whose top rises above its eaves (the gable
   * ends of a sawtooth or pitched hall roof), a flat slab from the eaves to the top in the cladding sheet's colour (else the
   * wall's), hiding the roof profile as the photographed sheet front does. Absent = byte-identical.
   */
  falseFront?: boolean;
  /**
   * Open galleries (verandas) stacked in front of a span of bays of the main panel (blockBuilding/gallery.ts; the 1905
   * villas on the Vondelpark's south edge): a deck per listed storey on posts, an arch between each pair of posts under
   * a beam, a balustrade along each deck; in the group's stone (a masonry arcade) or a timber colour. A list stacks a
   * stone arcade under a timber loggia. Absent = byte-identical.
   */
  gallery?: GalleryIntent | GalleryIntent[];
  /** Closed box balconies on scattered (storey, bay) cells of the main panel (blockBuilding/boxBalcony.ts, Haarlemmerweg 778 "Pepper"). Absent: byte-identical. */
  boxBalconies?: BoxBalconyIntent;
  /**
   * Stacked offset blocks on the main panel, written storey by storey (blockBuilding/stackedBlocks.ts, Blend,
   * Haarlemmerweg 518): `B` a block stepped `deepM` out with its own framed windows, `R` a recessed balcony with a glass
   * balustrade on the block line, `.` the core wall. Absent: byte-identical.
   */
  stackedBlocks?: StackedBlocksIntent;
}

export interface LargeBuildingIntent {
  schemaVersion: 1;
  kind: 'large';
  id: string; pandId: string; address: string;
  sources: IntentSource[];
  walls: LargeWallIntent[];
  /** System for wall surfaces no group lists (default `blank`). */
  otherWalls?: LargeSystemName;
  /**
   * A crown block that overhangs the shell on the named bearings (Salt, Haarlemmerweg 940: the top six storeys
   * cantilever over the canal corner above a recessed glazed base). The crown keeps the dominant front's bay pattern
   * and window shape, gets a coffered soffit under the overhang, new end-wall strips and a hidden roof deck; the base
   * keeps its own facade. `storeys` counts the crown's storeys from the top; `overhang` gives the projection on each
   * bearing in bays of that front's pitch (not metres); `coffers: false` leaves the soffit plain. Opt-in: a house
   * without `crown` compiles exactly as before. The photo evidence for each bearing goes in `notes`.
   */
  crown?: CrownIntent;
  /** Lift overrun and plant boxes on the largest flat roof. */
  roofPlant?: boolean;
  /**
   * Roof material. `material` covers every 3DBAG roof plane by default. From the orthophoto (2026-10-16, Entrepotdok):
   * `flat` re-materials the flat class (< 8°) of the default (a dark membrane under solar panels where the default's
   * flat tone would draw as pale gravel), and `surfaces` re-materials listed 3DBAG roof planes (the trailing number of
   * `roofsRD[].surfaceId`, `roof-dump.ts --surfaces`) with the evidence for it. `flatHex`: the colour of the flat
   * class outside the `surfaces` regions (whichever material it takes) as the PDOK orthophoto reads this pand (roof-facts
   * sidecar, `roofSlotHex`: the colour the city draws the same roof in; `roof-flat.ts`), exported with `tintSource:
   * "measured"` so the look keeps it instead of mapping the material's flat tone onto a flat-roof prior by lightness
   * (Kinkerstraat 89-105, 2026-10-16: the slate flat grey became buff gravel over a buff render, one slab from the
   * street). Absent: unchanged output.
   */
  roof?: LargeRoofIntent;
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
   * when the LoD2.2 ground has drifted from it (IoU < 0.90). `core` (coreFootprint.ts, Blend 2026-10-29): the same on
   * the BAG outline with its shallow outward steps (<= 2.5 m) retracted, for a tower whose stacked offset blocks BAG
   * draws as one top-view union; the blocks come back per storey from `walls[].stackedBlocks`. Default `lod22`: the
   * LoD2.2 shell verbatim.
   */
  footprint?: 'lod22' | 'bag' | 'core';
  /** Lift 3DBAG wall and roof vertices under the ground to it and drop faces left on the ground (opt-in; `largeSurfaceSet`). */
  groundClamp?: boolean;
  /**
   * Triangle budget for this house's large-tier gate, in place of the 12,000 default (the user-approved raised cap is
   * 40,000 for a tall block whose facade rhythm, loggias and crown the 12k kit cannot draw). It only raises the budget:
   * the validator accepts 12,000..40,000, and every house without the field keeps the default and byte-identical output.
   */
  budgetTriangles?: number;
  /**
   * The intent carries values measured from the rectified photos (`measure.ts --write`, the evidence in
   * `houses/<id>/measured.json`): the date of that run and the wall groups it wrote.
   */
  measured?: {date: string; groups: number[]; /** `palette.brick` (the unlisted walls' colour) was measured too, so it is drawn as is */ otherWalls?: boolean};
  /**
   * `factory`: written by the landmark factory's draft (`draftLarge.ts`), so the factory may redraft and measure it
   * (`--write`). Absent: hand-authored, and the factory never writes the intent, its facts or its measured.json.
   */
  draftedBy?: 'factory';
  notes?: string[];
}
export type RoofMaterial = typeof ROOF_MATERIALS[number];
/** A crown that overhangs its own base (LargeBuildingIntent.crown): storeys from the top, projection per bearing in bays. */
export interface CrownIntent {
  /** the crown's storeys, counted from the top (1 .. storeys of the dominant front - 1) */
  storeys: number;
  /** plan projection per bearing, in bays of the dominant front's pitch (only the photographed sides) */
  overhang: Partial<Record<'N' | 'E' | 'S' | 'W', number>>;
  /** false = a plain soffit (default: the coffered soffit the photo shows) */
  coffers?: boolean;
}
export interface LargeRoofIntent {
  material: RoofMaterial;
  flat?: RoofMaterial;
  surfaces?: {roofSurfaces: number[]; material: RoofMaterial; evidence: string}[];
  /** measured flat-roof colour, `#rrggbb` (see `LargeBuildingIntent.roof`) */
  flatHex?: string;
  /**
   * Measured pitched-roof colour, `#rrggbb`: the steep and low classes of the default `material` as the PDOK orthophoto
   * reads this pand (roof-facts sidecar, `pitchedRoofFromFact`; `roof-flat.ts --pitched`), exported with `tintSource:
   * "measured"` so the look keeps it instead of mapping the kit's slate onto the city's darkest slate tone (issue #73).
   * Same meshes, only the colour. Absent: unchanged output.
   */
  pitchedHex?: string;
  /**
   * Replace every 3DBAG roof plane above the photographed fronts (`walls[]`) with one flat level at their area-weighted
   * median height (roofLevel.ts): for a rooftop the LoD2.2 shell reconstructs as dozens of small tilted planes. Absent:
   * unchanged output.
   */
  levelRooftop?: RoofLevelIntent;
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
    if (f.doorArch !== undefined) {
      const d = f.doorArch as unknown as Record<string, unknown>, n = (v: unknown, a: number, b: number) => typeof v === 'number' && v >= a && v <= b;
      if (!d || typeof d !== 'object' || Object.keys(d).some(k => k !== 'span' && k !== 'apex') || !n(d.span, 0.8, 2.6) || !n(d.apex, 1.8, 4) || (d.apex as number) < (d.span as number) / 2 + 1.2) problems.push(`${at}.doorArch: {span 0.8..2.6 m, apex 1.8..4 m and at least span / 2 + 1.2}`);
      if (f.doorBay === null || f.shopfront?.residentialDoor || f.groundFront) problems.push(`${at}.doorArch: needs a doorBay (not a shop's residential door or a ground front)`);
    }
    oneOf(f.basement, BASEMENTS, `${at}.basement`);
    oneOf(f.cornice, CORNICES, `${at}.cornice`);
    oneOf(f.windows, WINDOWS, `${at}.windows`);
    if (typeof f.hoist !== 'boolean') problems.push(`${at}.hoist must be boolean`);
    if (f.shutters !== undefined) oneOf(f.shutters, ['none', 'ground', 'all'], `${at}.shutters`);
    if (f.balconies) {
      f.balconies.storeys.forEach(v => count(v, `${at}.balconies.storeys`, 1, f.storeys - 1)); f.balconies.bays.forEach(v => count(v, `${at}.balconies.bays`, 0, 15));
      if (f.balconies.style !== undefined) oneOf(f.balconies.style, BALCONY_STYLES, `${at}.balconies.style`);
      if (f.balconies.rail !== undefined) { oneOf(f.balconies.rail, BALCONY_RAILS, `${at}.balconies.rail`); if (f.balconies.style !== 'timber-bracketed') problems.push(`${at}.balconies.rail: only a timber-bracketed balcony has a rail choice`); }
      if (f.balconies.style === 'timber-bracketed' && f.balconies.projecting) problems.push(`${at}.balconies: timber-bracketed already projects; drop projecting`);
      if (f.balconies.style === 'timber-bracketed' && f.repeat) problems.push(`${at}.balconies.style: timber-bracketed not on a repeated front`);
      const bs = f.balconies.styleStoreys;
      if (bs !== undefined && (!f.balconies.style || !Array.isArray(bs) || !bs.length || bs.some(v => !f.balconies!.storeys.includes(v)))) problems.push(`${at}.balconies.styleStoreys: a style, and storeys from balconies.storeys`);
      for (const [k, v] of Object.entries(f.balconies.storeyBays ?? {})) {
        if (!f.balconies.storeys.includes(Number(k))) problems.push(`${at}.balconies.storeyBays.${k}: not one of balconies.storeys`);
        if (!Array.isArray(v) || !v.length || v.some(b => !Number.isInteger(b) || b < 0 || b > 15)) problems.push(`${at}.balconies.storeyBays.${k}: bay indices 0..15`);
      }
    }
    if (f.bayWindows) {
      if (f.bayWindows.bays === undefined) count(f.bayWindows.bay, `${at}.bayWindows.bay`, 0, 15);
      else problems.push(...erkerProblems(f, at));
      if (f.bayWindows.finish !== undefined && (f.bayWindows.finish !== 'painted' || f.bayWindows.bays === undefined)) problems.push(`${at}.bayWindows.finish: "painted", on a multi-bay erker (bays)`);
      // A timber oriel may start on the ground storey (Boterdiepstraat 9-33: the canted bay runs down to the pavement under
      // the console) unless the ground is a shopfront or a historic ground front.
      const groundOriel = !!f.bayWindows.oriel && f.bayWindows.bays !== undefined && !f.shopfront && !f.groundFront;
      f.bayWindows.storeys.forEach(v => count(v, `${at}.bayWindows.storeys`, groundOriel ? 0 : 1, f.storeys - 1));
    }
    if (f.bands !== undefined) oneOf(f.bands, ['none', 'storey', 'lintel', 'both', 'courses', 'speklagen', 'painted'], `${at}.bands`);
    problems.push(...paintedProblems(f, at, oneOf));
    if (f.bands === 'courses' || f.courseStoreys !== undefined) problems.push(...courseProblems(f, intent?.palette, at));
    if (f.windowHoods !== undefined && f.windowHoods !== true) {
      const h = f.windowHoods as unknown as Record<string, unknown>;
      if (!h || typeof h !== 'object' || Array.isArray(h) || Object.keys(h).some(k => k !== 'colour') || !['band', 'stone'].includes(h.colour as string)) problems.push(`${at}.windowHoods: true or {colour: band | stone} (or leave it out)`);
      else if (h.colour === 'band' && !(f.palette?.band ?? intent.palette.band)) problems.push(`${at}.windowHoods: colour band needs palette.band`);
    }
    if (f.wallAnchors !== undefined) problems.push(...wallAnchorProblems(f, at));
    if (f.tilePanels !== undefined) problems.push(...tilePanelProblems(f, at));
    if (f.friezeVents !== undefined) problems.push(...friezeVentProblems(f, at));
    if (f.entablature !== undefined) problems.push(...entablatureProblems(f, at));
    if (f.jambBlocks !== undefined) problems.push(...jambBlockProblems(f, at));
    if (f.axisHeads !== undefined) {
      const ah = f.axisHeads as Record<string, {kind?: unknown; storeys?: unknown}>;
      if (!ah || typeof ah !== 'object') problems.push(`${at}.axisHeads: {"<axis>": {kind, storeys}}`);
      else for (const [k, v] of Object.entries(ah)) {
        if (!/^\d+$/.test(k) || Number(k) >= frontGrid(f)) problems.push(`${at}.axisHeads.${k}: an axis index within 0..${frontGrid(f) - 1}`);
        if (!v || !['round', 'segmental', 'flat'].includes(v.kind as string)) problems.push(`${at}.axisHeads.${k}.kind: round, segmental or flat`);
        if (!Array.isArray(v?.storeys) || !v.storeys.length || v.storeys.some(x => !Number.isInteger(x) || x < 1 || x >= f.storeys)) problems.push(`${at}.axisHeads.${k}.storeys: storey indices within 1..${f.storeys - 1}`);
      }
    }
    problems.push(...eavesOverhangProblems(f, at));
    problems.push(...groundCanopyProblems(f, at));
    if (f.lisenes !== undefined) {
      const l = f.lisenes as Record<string, unknown>;
      const ends = typeof l === 'object' && l !== null ? Object.entries(l).filter(([k]) => k === 'leftEnd' || k === 'rightEnd') : [];
      if (typeof l !== 'object' || l === null || Object.keys(l).some(k => !['leftEnd', 'rightEnd', 'at', 'breadth', 'stopStorey'].includes(k)) || ends.some(([, v]) => v !== 'half' && v !== 'full') || !(ends.length || l.at !== undefined)) problems.push(`${at}.lisenes: {leftEnd?, rightEnd?} each "half" or "full", and/or at: [bay edge indices]`);
      else problems.push(...liseneAtProblems(f, at));
      if (f.repeat) problems.push(`${at}.lisenes: not on a repeated front`);
    }
    if (f.renderedGable !== undefined) {
      const r = f.renderedGable as unknown as Record<string, unknown>;
      if (!r || typeof r !== 'object' || Object.keys(r).some(k => k !== 'bargeboard' && k !== 'colour') || !(typeof r.bargeboard === 'number' && r.bargeboard >= 0.08 && r.bargeboard <= 0.4) || typeof r.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(r.colour)) problems.push(`${at}.renderedGable: {bargeboard: 0.08..0.4 m, colour: #rrggbb}`);
      if (f.gable === 'flat' || f.gable === 'cornice') problems.push(`${at}.renderedGable: only on a gabled crown (gable ${f.gable})`);
    }
    if (f.stairLight !== undefined) problems.push(...stairLightProblems(f.stairLight, f.storeys, frontGrid(f), !!f.repeat, at));
    if (f.brickStripes !== undefined) problems.push(...brickStripeProblems(f.brickStripes, f.palette?.band ?? intent?.palette?.band, !!f.repeat, at));
    problems.push(...windowProblems(f, at, oneOf));
    problems.push(...deBaarsjesProblems(f, intent?.palette, at));
    if (f.crownCapSpan !== undefined) oneOf(f.crownCapSpan, CROWN_CAP_SPANS, `${at}.crownCapSpan`);
    if (f.crownCapRise !== undefined) oneOf(f.crownCapRise, CROWN_CAP_RISES, `${at}.crownCapRise`);
    const neckOrBell = ['neck', 'raised-neck', 'bell'].includes(f.gable);
    if (f.crownNeckWidth !== undefined && (!neckOrBell || !(f.crownNeckWidth >= 0.2 && f.crownNeckWidth <= 0.8))) problems.push(`${at}.crownNeckWidth: a neck/bell neck share in [0.2, 0.8] (gable ${f.gable}, ${f.crownNeckWidth})`);
    if (f.crownCapRatio !== undefined && (!neckOrBell || !(f.crownCapRatio >= 0.03 && f.crownCapRatio <= 0.6))) problems.push(`${at}.crownCapRatio: a neck/bell cap rise share of the neck in [0.03, 0.6]`);
    if (f.crownCapCornice !== undefined) {
      const k = f.crownCapCornice;
      if (!neckOrBell) problems.push(`${at}.crownCapCornice: only a neck or bell head carries a cap cornice (gable ${f.gable})`);
      if (!(k && k.ledge >= 0.03 && k.ledge <= 0.3 && k.projection >= 0 && k.projection <= 0.2 && (k.frieze === undefined || (k.frieze >= 0 && k.frieze <= 0.5)))) problems.push(`${at}.crownCapCornice: shares of the neck width: ledge 0.03-0.3, projection 0-0.2, frieze 0-0.5`);
    }
    if (f.crownShoulder !== undefined) {
      oneOf(f.crownShoulder, CROWN_SHOULDERS, `${at}.crownShoulder`);
      if (!['neck', 'raised-neck', 'bell'].includes(f.gable)) problems.push(`${at}.crownShoulder: only a neck or bell crown has curved flanks (gable ${f.gable})`);
    }
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
    for (const [k, v] of Object.entries(f.storeyRibbons ?? {})) {
      const s = Number(k), r = v as unknown as Record<string, unknown>;
      if (k !== 'last' && !(Number.isInteger(s) && s >= 0 && s < f.storeys)) problems.push(`${at}.storeyRibbons.${k}: key must be a storey index or "last"`);
      else if (!r || typeof r !== 'object' || Object.keys(r).some(x => x !== 'from' && x !== 'to' && x !== 'pier') || !(typeof r.from === 'number' && typeof r.to === 'number' && r.from >= 0 && r.to <= 1 && r.to - r.from >= 0.2)) problems.push(`${at}.storeyRibbons.${k}: {from, to} shares of the front, 0 <= from, to <= 1, at least 0.2 apart`);
      else if (r.pier !== undefined && !(typeof r.pier === 'number' && r.pier >= 0.02 && r.pier <= 2.5)) problems.push(`${at}.storeyRibbons.${k}.pier: metres between windows, 0.02-2.5`);
      else if (f.storeyAxes?.[k] || f.storeyBayWidths?.[k]) problems.push(`${at}.storeyRibbons.${k}: not together with storeyAxes or storeyBayWidths for the same storey`);
    }
    for (const [k, v] of Object.entries(f.storeyWindowWidths ?? {})) {
      const s = Number(k);
      if (k !== 'last' && !(Number.isInteger(s) && s >= 0 && s < f.storeys)) problems.push(`${at}.storeyWindowWidths.${k}: key must be a storey index or "last"`);
      else if (!(typeof v === 'number' && v >= 0.3 && v <= 2.5)) problems.push(`${at}.storeyWindowWidths.${k}: a window width in metres, 0.3-2.5`);
      else if (f.storeyRibbons?.[k] || f.storeyBayWidths?.[k]) problems.push(`${at}.storeyWindowWidths.${k}: only on the shared axes (not with storeyRibbons or storeyBayWidths for the same storey)`);
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
      problems.push(...awningProblems(aw, at));
    } else if ((f as {awning?: unknown}).awning !== undefined) problems.push(`${at}.awning: awnings belong under shopfront.awning`);
    for (const [k, v] of Object.entries(f.palette ?? {})) {
      if (k === 'wallMaterial') problems.push(`${at}.palette.wallMaterial: set the wall material on the house palette (one material per house)`);
      else if (k === 'stoneMaterial') problems.push(`${at}.palette.stoneMaterial: set the stone material on the house palette (one material per house)`);
      else if (k === 'whitePoint') problems.push(`${at}.palette.whitePoint: the exposure of the house wall's measurement belongs on the house palette`);
      else if (k === 'wallTint') problems.push(`${at}.palette.wallTint: set the wall tint on the house palette (one wall per house)`);
      else colour(v, `${at}.palette.${k}`);
    }
    problems.push(...historicProblems(f, at, colour, oneOf));
  }
  const corners = Array.isArray(intent?.fronts) ? intent.fronts.filter(f => f?.tower?.corner) : [];
  if (corners.length > 1) problems.push('tower.corner: one corner tower per pand (on one of the two fronts that meet at the corner)');
  if (corners.length && intent.fronts.length < 2) problems.push(`front ${corners[0].id}.tower.corner: a corner tower needs a pand with two fronts`);
  oneOf(intent?.roof?.material, ROOF_MATERIALS, 'roof.material');
  if (intent?.roof?.source !== undefined) oneOf(intent.roof.source, ROOF_SOURCES, 'roof.source');
  if (intent?.roof?.form !== undefined) oneOf(intent.roof.form, ROOF_FORMS, 'roof.form');
  if (intent?.roof?.pitchDeg !== undefined && !(typeof intent.roof.pitchDeg === 'number' && intent.roof.pitchDeg >= 15 && intent.roof.pitchDeg <= 80)) problems.push('roof.pitchDeg: 15..80 degrees');
  if (intent?.roof?.rise !== undefined && !(typeof intent.roof.rise === 'number' && intent.roof.rise >= 0.2 && intent.roof.rise <= 2.5)) problems.push('roof.rise: 0.2..2.5 upper-storey heights');
  if (intent?.roof?.rearPitchDeg !== undefined && !(typeof intent.roof.rearPitchDeg === 'number' && intent.roof.rearPitchDeg >= 15 && intent.roof.rearPitchDeg <= 80)) problems.push('roof.rearPitchDeg: 15..80 degrees');
  if (intent?.roof?.crossGables !== undefined && intent.roof.crossGables !== true) problems.push('roof.crossGables: true or absent');
  if (intent?.roof?.hip !== undefined) {
    oneOf(intent.roof.hip, ROOF_HIPS, 'roof.hip');
    if (intent.roof.form !== 'saddle' || intent.roof.pitchDeg === undefined) problems.push('roof.hip: needs form "saddle" and a measured pitchDeg');
  }
  if (intent?.roof?.evidence !== undefined && typeof intent.roof.evidence !== 'string') problems.push('roof.evidence: a string (what on the photo shows the roof form)');
  if (intent?.roof && Object.keys(intent.roof).some(k => !['material', 'source', 'form', 'pitchDeg', 'rise', 'rearPitchDeg', 'crossGables', 'hip', 'evidence'].includes(k))) problems.push(`roof: unknown field ${Object.keys(intent.roof).filter(k => !['material', 'source', 'form', 'pitchDeg', 'rise', 'rearPitchDeg', 'crossGables', 'hip', 'evidence'].includes(k)).join(', ')}`);
  for (const k of ['brick', 'frame', 'door'] as const) colour(intent?.palette?.[k], `palette.${k}`);
  for (const k of ['shutters', 'stone', 'band', 'cornice', 'glassBlock'] as const) if (intent?.palette?.[k] !== undefined) colour(intent.palette[k], `palette.${k}`);
  if (intent?.palette?.wallMaterial !== undefined) oneOf(intent.palette.wallMaterial, WALL_MATERIALS, 'palette.wallMaterial');
  if (intent?.palette?.stoneMaterial !== undefined) oneOf(intent.palette.stoneMaterial, ['painted'], 'palette.stoneMaterial');
  if (intent?.palette?.wallTint !== undefined) {
    oneOf(intent.palette.wallTint, ['measured'], 'palette.wallTint');
    if (intent.palette.wallMaterial === 'stucco') problems.push('palette.wallTint: a measured brick tint; stucco keeps its own tint');
  }
  if (intent?.palette?.whitePoint !== undefined) {
    colour(intent.palette.whitePoint, 'palette.whitePoint');
    if (intent.palette.wallTint !== 'measured' && intent.palette.wallMaterial !== 'painted-brick') problems.push('palette.whitePoint: the exposure of a measured wall (wallTint measured or painted-brick)');
  }
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
  if (bw.oriel !== undefined) p.push(...orielProblems(f, at));
  return p;
}

/** Problems with a timber oriel (`bayWindows.oriel`). */
export function orielProblems(f: FrontIntent, at: string): string[] {
  const p: string[] = [], o = f.bayWindows!.oriel as OrielIntent, bw = f.bayWindows!;
  const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (!o || typeof o !== 'object') return [`${at}.bayWindows.oriel: an object`];
  if (bw.hood || bw.finish) p.push(`${at}.bayWindows.oriel: not together with hood or finish`);
  if (!num(o.span, 0.8, 6)) p.push(`${at}.bayWindows.oriel.span: 0.8..6 m`);
  if (o.projection !== undefined && !num(o.projection, 0.15, 1.2)) p.push(`${at}.bayWindows.oriel.projection: 0.15..1.2 m`);
  if (o.returns !== undefined && !num(o.returns, 0, (o.span ?? 0) / 3)) p.push(`${at}.bayWindows.oriel.returns: 0..span/3 m`);
  for (const k of ['stallriser', 'head'] as const) if (o[k] !== undefined && !num(o[k], 0.08, 2.5)) p.push(`${at}.bayWindows.oriel.${k}: 0.08..2.5 m`);
  if (o.frontLights !== undefined && !(Number.isInteger(o.frontLights) && o.frontLights >= 1 && o.frontLights <= 6)) p.push(`${at}.bayWindows.oriel.frontLights: 1..6`);
  if (o.transom !== undefined && !num(o.transom, 0.3, 0.95)) p.push(`${at}.bayWindows.oriel.transom: 0.3..0.95 of the light height`);
  for (const [k, v] of Object.entries(o.panels ?? {})) {
    if (!bw.storeys.includes(Number(k))) p.push(`${at}.bayWindows.oriel.panels.${k}: not one of bayWindows.storeys`);
    if (!v || typeof v !== 'object' || Object.keys(v).some(x => !['stallriser', 'head'].includes(x)) || Object.values(v).some(x => !num(x, 0.08, 2.5))) p.push(`${at}.bayWindows.oriel.panels.${k}: {stallriser?, head?} 0.08..2.5 m`);
  }
  if (o.paintedStoreys !== undefined && (!Array.isArray(o.paintedStoreys) || o.paintedStoreys.some(s => !bw.storeys.includes(s)))) p.push(`${at}.bayWindows.oriel.paintedStoreys: storeys of bayWindows.storeys`);
  if (o.paintFrom !== undefined && (!num(o.paintFrom, 0.05, 2.4) || !o.paintedStoreys?.length)) p.push(`${at}.bayWindows.oriel.paintFrom: 0.05..2.4 m, with paintedStoreys`);
  if (o.console !== undefined && typeof o.console !== 'boolean') p.push(`${at}.bayWindows.oriel.console: boolean`);
  if (bw.cap !== undefined && bw.cap !== 'none') p.push(`${at}.bayWindows.oriel: cap is not drawn on an oriel (it stops under the cornice)`);
  return p;
}

/** Problems with a dormer cap (`dormerCap`). */
export function dormerCapProblems(f: FrontIntent, at: string): string[] {
  const p: string[] = [], c = f.dormerCap as DormerCapIntent, n = f.dormers ?? 0;
  if (!c || c.kind !== 'hoist') return [`${at}.dormerCap.kind: "hoist"`];
  if (!Array.isArray(c.dormers) || !c.dormers.length || c.dormers.some(i => !Number.isInteger(i) || i < 0 || i >= n)) p.push(`${at}.dormerCap.dormers: dormer indices 0..${n - 1}`);
  if (c.rise !== undefined && !(c.rise >= 0.4 && c.rise <= 2.5)) p.push(`${at}.dormerCap.rise: 0.4..2.5 m`);
  if (c.flare !== undefined && !(c.flare >= 0 && c.flare <= 0.6)) p.push(`${at}.dormerCap.flare: 0..0.6 m`);
  if (c.colour !== undefined && !/^#[0-9a-f]{6}$/i.test(c.colour)) p.push(`${at}.dormerCap.colour: #rrggbb`);
  return p;
}

/** Problems with the Oud-West 1900 set: painted bands and console sills (all optional). */
function paintedProblems(f: FrontIntent, at: string, oneOf: (v: unknown, allowed: readonly string[], where: string) => void): string[] {
  const p: string[] = [];
  const frac = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
  if (f.bandHeights !== undefined) {
    const b = f.bandHeights as Record<string, unknown>;
    if (f.bands !== 'painted') p.push(`${at}.bandHeights: only with bands "painted"`);
    if (!b || typeof b !== 'object' || Object.keys(b).some(k => !['sill', 'transom', 'head'].includes(k)) || Object.values(b).some(v => !frac(v, 0.04, 0.4))) p.push(`${at}.bandHeights: {sill?, transom?, head?} metres, 0.04..0.4`);
  }
  if (f.bandLines !== undefined) {
    const l = f.bandLines;
    if (f.bands !== 'painted') p.push(`${at}.bandLines: only with bands "painted"`);
    if (!Array.isArray(l) || !l.length || l.some(v => !['sill', 'transom', 'head'].includes(v)) || new Set(l).size !== l.length) p.push(`${at}.bandLines: distinct "sill" | "transom" | "head"`);
  }
  if (f.bandStoreys !== undefined) {
    const l = f.bandStoreys;
    if (f.bands !== 'painted') p.push(`${at}.bandStoreys: only with bands "painted"`);
    if (!Array.isArray(l) || !l.length || l.some((s, i) => !Number.isInteger(s) || s < 0 || s >= f.storeys || (i > 0 && s <= l[i - 1]))) p.push(`${at}.bandStoreys: ascending storey indices within 0..${f.storeys - 1}`);
  }
  if (f.bandTransomAt !== undefined) {
    // A house may drop the transom line from its type's lines; the share is then unused.
    if (f.bands !== 'painted') p.push(`${at}.bandTransomAt: only with bands "painted"`);
    if (!frac(f.bandTransomAt, 0.3, 0.95)) p.push(`${at}.bandTransomAt: share of the window height, 0.3..0.95`);
  }
  if (f.windowSills !== undefined) oneOf(f.windowSills, WINDOW_SILLS, `${at}.windowSills`);
  if (f.paintedStoreys !== undefined) p.push(...paintedStoreyProblems(f, at));
  return p;
}

/** Problems with `tilePanels` (glazed tile diamonds on the piers of upper storeys). */
export function tilePanelProblems(f: FrontIntent, at: string): string[] {
  const t = f.tilePanels as {storeys?: unknown; colour?: unknown; courses?: unknown; place?: unknown; axes?: unknown; count?: unknown} | undefined, p: string[] = [];
  if (!t || typeof t !== 'object' || Object.keys(t).some(k => !['storeys', 'colour', 'courses', 'place', 'axes', 'count'].includes(k))) return [`${at}.tilePanels: {storeys, colour, courses?, place?, axes?, count?}`];
  if (t.place !== undefined && t.place !== 'piers' && t.place !== 'sills') p.push(`${at}.tilePanels.place: "piers" or "sills"`);
  if (t.axes !== undefined && (!Array.isArray(t.axes) || !t.axes.length || t.axes.some(a => !Number.isInteger(a) || a < 0 || a > 15))) p.push(`${at}.tilePanels.axes: window axis indices`);
  if (t.count !== undefined && !(Number.isInteger(t.count) && (t.count as number) >= 1 && (t.count as number) <= 6)) p.push(`${at}.tilePanels.count: 1..6`);
  const l = t.storeys as number[];
  if (!Array.isArray(l) || !l.length || l.some((s, i) => !Number.isInteger(s) || s < 1 || s >= f.storeys || (i > 0 && s <= l[i - 1]))) p.push(`${at}.tilePanels.storeys: ascending storey indices within 1..${f.storeys - 1}`);
  for (const k of ['colour', 'courses'] as const) if ((k === 'colour' || (t[k] !== undefined && t[k] !== false)) && (typeof t[k] !== 'string' || !/^#[0-9a-f]{6}$/i.test(t[k] as string))) p.push(`${at}.tilePanels.${k}: a #rrggbb colour`);
  return p;
}

/** Problems with `paintedStoreys` (one or more storeys painted in a second colour). */
export function paintedStoreyProblems(f: FrontIntent, at: string): string[] {
  const p: string[] = [], ps = f.paintedStoreys as {storeys?: unknown; colour?: unknown; from?: unknown} | undefined;
  if (!ps || typeof ps !== 'object' || Object.keys(ps).some(k => !['storeys', 'colour', 'from'].includes(k))) return [`${at}.paintedStoreys: {storeys, colour, from?}`];
  if (ps.from !== undefined && !(typeof ps.from === 'number' && ps.from >= 0.05 && ps.from <= 4)) p.push(`${at}.paintedStoreys.from: 0.05..4 m over the storey floor`);
  const l = ps.storeys as number[];
  if (!Array.isArray(l) || !l.length || l.some((s, i) => !Number.isInteger(s) || s < 0 || s >= f.storeys || (i > 0 && s <= l[i - 1]))) p.push(`${at}.paintedStoreys.storeys: ascending storey indices within 0..${f.storeys - 1}`);
  else if (l.includes(0) && (f.shopfront || f.groundFront)) p.push(`${at}.paintedStoreys.storeys: the ground storey holds a shop/ground front; paint the upper storeys`);
  if (typeof ps.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(ps.colour)) p.push(`${at}.paintedStoreys.colour: a #rrggbb paint colour`);
  if (f.bands === 'courses' && (f.courseStoreys ?? []).some(s => (l ?? []).includes(s))) p.push(`${at}.paintedStoreys: a storey is either laid in band brick (courseStoreys) or painted`);
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

/** Problems with the canal-belt window/accent fields (2026-10-14); all optional and never checked when absent. */
function windowProblems(f: FrontIntent, at: string, oneOf: (v: unknown, allowed: readonly string[], where: string) => void): string[] {
  const p: string[] = [], storeyKey = (k: string) => k === 'last' || (Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) < f.storeys);
  for (const [k, v] of Object.entries(f.storeyWindows ?? {})) {
    if (!storeyKey(k)) p.push(`${at}.storeyWindows.${k}: key must be a storey index or "last"`);
    oneOf(v, WINDOWS.filter(w => w !== 'shop'), `${at}.storeyWindows.${k}`);
  }
  const h = f.windowHead;
  if (h !== undefined) {
    for (const k of Object.keys(h ?? {})) if (!['kind', 'storeys', 'archRing', 'tympanum'].includes(k)) p.push(`${at}.windowHead.${k}: unknown field (kind, storeys, archRing, tympanum)`);
    if (h?.tympanum !== undefined) {
      oneOf(h.tympanum, TYMPANUM_FILLS, `${at}.windowHead.tympanum`);
      if (h.kind === 'relieving' ? h.tympanum === 'stone' : h.kind !== 'segmental' && h.kind !== 'round') p.push(`${at}.windowHead.tympanum: only under a segmental or round head, or "dark" or "band" under a relieving arch`);
    }
    oneOf(h?.kind, WINDOW_HEADS, `${at}.windowHead.kind`);
    if (h?.storeys !== undefined && (!Array.isArray(h.storeys) || h.storeys.some(s => !Number.isInteger(s) || s < 0 || s >= f.storeys))) p.push(`${at}.windowHead.storeys: storey indices 0..${f.storeys - 1}`);
    if (f.archedStoreys !== undefined) p.push(`${at}.windowHead: not together with archedStoreys`);
    if (f.windows === 'arched') p.push(`${at}.windowHead: windows "arched" already sets a head; pick a pane layout`);
    const r = h?.archRing;
    if (r !== undefined) {
      for (const k of Object.keys(r ?? {})) if (!['colour', 'style', 'keystone', 'widthCourses', 'springerSize', 'shape', 'springGap'].includes(k)) p.push(`${at}.windowHead.archRing.${k}: unknown field (colour, style, keystone, widthCourses, springerSize, shape, springGap)`);
      const sz = r?.springerSize;
      if (sz !== undefined && (r.style !== 'springers' || !Array.isArray(sz) || sz.length !== 2 || sz.some(v => !(typeof v === 'number' && v >= 0.06 && v <= 0.6)))) p.push(`${at}.windowHead.archRing.springerSize: [length, height] metres 0.06..0.6, with style "springers"`);
      if (r?.springGap !== undefined && (h?.kind !== 'relieving' || !(typeof r.springGap === 'number' && r.springGap >= 0 && r.springGap <= 1.2))) p.push(`${at}.windowHead.archRing.springGap: metres 0..1.2, only on a relieving arch`);
      if (r?.shape !== undefined) { oneOf(r.shape, ['segmental', 'round'], `${at}.windowHead.archRing.shape`); if (h?.kind !== 'relieving') p.push(`${at}.windowHead.archRing.shape: only on a relieving arch`); }
      if (r?.style !== undefined) oneOf(r.style, ARCH_RING_STYLES, `${at}.windowHead.archRing.style`);
      if (r?.style === 'none' && !r.keystone) p.push(`${at}.windowHead.archRing: style "none" draws only the keystone; set keystone: true`);
      oneOf(r?.colour, ARCH_RING_COLOURS, `${at}.windowHead.archRing.colour`);
      if (r?.keystone !== undefined && typeof r.keystone !== 'boolean') p.push(`${at}.windowHead.archRing.keystone must be boolean`);
      if (r?.widthCourses !== undefined && !(Number.isInteger(r.widthCourses) && r.widthCourses >= 1 && r.widthCourses <= 6)) p.push(`${at}.windowHead.archRing.widthCourses: integer 1..6`);
      if (h?.kind === 'flat' && !r?.keystone) p.push(`${at}.windowHead.archRing: a flat head has no arch; only a keystone (keystone: true) stands on it`);
    } else if (h?.kind === 'relieving') p.push(`${at}.windowHead: a relieving arch needs archRing {colour}`);
  }
  const wh = f.windowHeights;
  if (wh !== undefined && wh !== 'diminishing' && (!Array.isArray(wh) || wh.length !== f.storeys || wh.some(v => !(typeof v === 'number' && v >= 0.15 && v <= 0.9)))) p.push(`${at}.windowHeights: "diminishing" or one share 0.15..0.9 per storey (${f.storeys})`);
  const hl = f.headLines;
  if (hl !== undefined) {
    if (!Array.isArray(wh)) p.push(`${at}.headLines: needs a windowHeights list`);
    if (!Array.isArray(hl) || hl.length !== f.storeys || hl.some(v => !(typeof v === 'number' && v >= 0.4 && v <= 0.98))) p.push(`${at}.headLines: one share 0.4..0.98 per storey (${f.storeys})`);
    else if (Array.isArray(wh) && hl.some((v, s) => v - wh[s] < 0.04)) p.push(`${at}.headLines: each head line must stand at least 0.04 of the storey above the floor plus its window height`);
  }
  if (f.windowShare !== undefined && (typeof f.windowShare !== 'number' || !(f.windowShare >= 0.3 && f.windowShare <= 0.8) || f.bayWidths !== undefined || f.piers === 'margin')) p.push(`${at}.windowShare: 0.3..0.8 of the front, on the equal-pier grid (not with bayWidths or piers "margin")`);
  if (f.speklagen !== undefined) {
    const s = f.speklagen;
    if (f.bands !== 'speklagen') p.push(`${at}.speklagen: needs bands "speklagen"`);
    if (!s || !Number.isInteger(s.spacing) || s.spacing < 4 || s.spacing > 30) p.push(`${at}.speklagen.spacing: integer 4..30 brick courses`);
    if (s?.courses !== undefined && !(Number.isInteger(s.courses) && s.courses >= 1 && s.courses <= 5 && s.courses < s.spacing)) p.push(`${at}.speklagen.courses: integer 1..5, less than spacing`);
  } else if (f.bands === 'speklagen') p.push(`${at}.bands: "speklagen" needs speklagen {spacing}`);
  if (f.storeyHeights !== undefined && (!Array.isArray(f.storeyHeights) || (f.storeyHeights.length !== f.storeys && !(f.souterrain && f.storeyHeights.length === f.storeys + 1)) || f.storeyHeights.some(v => !(typeof v === 'number' && v >= 0.4 && v <= 6)))) p.push(`${at}.storeyHeights: one relative height per storey (${f.storeys}; with a souterrain optionally one more, the souterrain first), each 0.4..6`);
  else if (f.storeyHeights && Math.max(...f.storeyHeights) / Math.min(...f.storeyHeights) > 3) p.push(`${at}.storeyHeights: tallest storey more than 3x the lowest`);
  if (f.plinth !== undefined) oneOf(f.plinth, ['full', 'low'], `${at}.plinth`);
  if (f.basementBars !== undefined && (typeof f.basementBars !== 'boolean' || (f.basementBars && f.basement !== 'windows' && f.basement !== 'stoop-and-windows'))) p.push(`${at}.basementBars: boolean, and needs basement windows`);
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
  if (f.dormerCap !== undefined) problems.push(...dormerCapProblems(f, at));
  if (f.dormerStyle !== undefined) { oneOf(f.dormerStyle, DORMER_STYLES, `${at}.dormerStyle`); if (!f.dormers) problems.push(`${at}.dormerStyle: needs dormers >= 1`); }
  if (f.dormerBody !== undefined) {
    if (!(DORMER_BODIES as readonly unknown[]).includes(f.dormerBody)) problems.push(`${at}.dormerBody: one of ${DORMER_BODIES.join(', ')} (or leave it out)`);
    if (!f.dormers) problems.push(`${at}.dormerBody: needs dormers >= 1`);
    if (f.dormerStyle === 'box') problems.push(`${at}.dormerBody: a box dormer is brick`);
  }
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
    if (t?.cap === 'merlons' && t.corner) problems.push(`${at}.tower.cap: merlons on a tower over bays (not a corner tower)`);
    if (t?.lights !== undefined && (t.lights !== 'per-axis' || !t.bays)) problems.push(`${at}.tower.lights: "per-axis", on a tower over bays`);
    if (t?.lightRise !== undefined && !(t.lights && t.lightRise >= 0.2 && t.lightRise <= 0.9)) problems.push(`${at}.tower.lightRise: 0.2..0.9 upper-storey heights, with lights: per-axis`);
    if (t?.lightSill !== undefined && !(t.lights && t.lightSill >= 0 && t.lightSill <= 0.6)) problems.push(`${at}.tower.lightSill: 0..0.6 upper-storey heights over the eaves, with lights: per-axis`);
  }
  if (f.partyClip !== undefined && typeof f.partyClip !== 'boolean') problems.push(`${at}.partyClip must be boolean`);
  if (f.souterrain !== undefined && (typeof f.souterrain !== 'boolean' || (f.souterrain && f.basement === 'none'))) problems.push(`${at}.souterrain: boolean, and needs a basement`);
  if (f.gridAt !== undefined && !(f.gridAt && f.gridAt.from >= -0.5 && f.gridAt.to <= 1.5 && f.gridAt.to - f.gridAt.from >= 0.5)) problems.push(`${at}.gridAt: {from, to} fractions of the front, -0.5 <= from, to <= 1.5, at least 0.5 wide`);
  if (f.dormerAt !== undefined) {
    const list = Array.isArray(f.dormerAt) ? f.dormerAt : [];
    if (list.length !== (f.dormers ?? 0)) problems.push(`${at}.dormerAt: one span per dormer (dormers ${f.dormers ?? 0})`);
    list.forEach((d, i) => { if (!d || !(d.from >= 0 && d.to <= 1 && d.to - d.from >= 0.1 && (i === 0 || d.from >= list[i - 1].to))) problems.push(`${at}.dormerAt[${i}]: {from, to} ascending, non-overlapping fractions of the front within 0..1, at least 0.1 wide`); });
  }
  if (f.dormerHoist !== undefined) {
    const z = f.dormerHoist as {reach?: unknown};
    if (!z || typeof z !== 'object' || Array.isArray(z) || Object.keys(z).some(k => k !== 'reach') || (z.reach !== undefined && !(typeof z.reach === 'number' && z.reach >= 0.3 && z.reach <= 1.5))) problems.push(`${at}.dormerHoist: {reach?: 0.3..1.5 m in front of the dormer}`);
    if (!f.dormers || f.dormerStyle === 'box' || f.dormerStyle === 'flat') problems.push(`${at}.dormerHoist: needs plain, pediment or pointed dormers`);
    if (f.hoist) problems.push(`${at}.dormerHoist: not with hoist (one beam per dormer replaces the facade beam)`);
  }
  if (f.dormerSize !== undefined) {
    const z = f.dormerSize as {sill?: unknown; rise?: unknown; setback?: unknown};
    if (!f.dormers) problems.push(`${at}.dormerSize: only with dormers`);
    else if (f.roofFront === 'mansard') problems.push(`${at}.dormerSize: not on a mansard (its dormers stand on the roof face)`);
    else if (!z || typeof z !== 'object' || Object.keys(z).some(k => !['sill', 'rise', 'setback'].includes(k)) || !(typeof z.sill === 'number' && z.sill >= 0.05 && z.sill <= 2) || !(typeof z.rise === 'number' && z.rise >= 0.6 && z.rise <= 2.5) || !(typeof z.setback === 'number' && z.setback >= 0.05 && z.setback <= 2)) problems.push(`${at}.dormerSize: {sill 0.05..2 m over the eaves, rise (dormer height) 0.6..2.5 m, setback 0.05..2 m behind the facade}`);
  }
  return problems;
}

/** Problems with `lisenes.at` / `width` / `stopStorey` (lisenes on bay boundaries inside the front). */
function liseneAtProblems(f: FrontIntent, at: string): string[] {
  const l = f.lisenes!, p: string[] = [], grid = frontGrid(f);
  if (l.at !== undefined && (!Array.isArray(l.at) || !l.at.length || l.at.some((k, i) => !Number.isInteger(k) || k < 1 || k > grid - 1 || (i > 0 && k <= l.at![i - 1]))))
    p.push(`${at}.lisenes.at: ascending bay edge indices within 1..${grid - 1}`);
  if (l.breadth !== undefined && !(typeof l.breadth === 'number' && l.breadth >= 0.2 && l.breadth <= 0.8)) p.push(`${at}.lisenes.breadth: 0.2..0.8 m`);
  if (l.breadth !== undefined && l.at === undefined) p.push(`${at}.lisenes.breadth: only with at (the end lisenes keep half/full)`);
  if (l.stopStorey !== undefined && !(Number.isInteger(l.stopStorey) && l.stopStorey >= 2 && l.stopStorey < f.storeys)) p.push(`${at}.lisenes.stopStorey: a storey index within 2..${f.storeys - 1}`);
  return p;
}
