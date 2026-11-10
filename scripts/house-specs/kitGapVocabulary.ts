// The kit-gap classifier (house line H6, docs/house-line.md §5): maps a prose schemaLimits line to one kit component
// and a canonical gap wording, `{component, what}`. Deterministic keyword rules, Dutch and English, no model. A line
// no rule names is `other` and keeps its normalised text, so the unmapped list stays visible.
//
// Order matters: the first rule that matches wins. Synonyms fold Dutch and English variants onto one English keyword
// before the rules run, so a rule only has to name English.

/** The kit's own part names (buildingRecipe/intent.ts FrontIntent, the block-face types, the H1 spec `design`). */
export const KIT_COMPONENTS = ['openings', 'pui', 'crown', 'cornice', 'ornament', 'wall', 'balcony', 'dormer', 'roof', 'door', 'other'] as const;
export type KitComponent = (typeof KIT_COMPONENTS)[number];

/** A legacy component filed by an adapter, mapped onto the vocabulary when no rule names the line. */
export const STRUCTURED_ALIASES: Readonly<Record<string, KitComponent>> = { palette: 'wall', facade: 'other' };

/** Dutch and English variants folded onto one English keyword (whole words, lower case). */
export const SYNONYMS: ReadonlyMap<string, string> = new Map([
  ['muurankers', 'anchor'], ['muuranker', 'anchor'], ['ankers', 'anchor'], ['anker', 'anchor'], ['wall ties', 'anchor'], ['wall tie', 'anchor'], ['iron anchors', 'anchor'],
  ['glasblokken', 'glass-block'], ['glasblok', 'glass-block'], ['glass brick', 'glass-block'], ['glass block', 'glass-block'],
  ['speklaagen', 'speklagen'], ['speklaag', 'speklagen'],
  ['kroonlijst', 'cornice'], ['fries', 'frieze'], ['dakkapellen', 'dormer'], ['dakkapel', 'dormer'],
  ['erkers', 'oriel'], ['erker', 'oriel'], ['balkons', 'balcony'], ['balkon', 'balcony'],
  ['deuren', 'door'], ['deur', 'door'], ['portiek', 'portico'], ['luifel', 'canopy'],
  ['ramen', 'window'], ['raam', 'window'], ['venster', 'window'], ['kozijn', 'frame'],
  ['goten', 'gutter'], ['goot', 'gutter'], ['schoorsteen', 'chimney'], ['dakraam', 'roof window'], ['lichtkoepel', 'skylight'],
  ['muren', 'wall'], ['muur', 'wall'], ['baksteen', 'brick'], ['steen', 'stone'], ['stoep', 'stoop'], ['hekwerk', 'railing'],
  ['winkel', 'shop'], ['uithangbord', 'sign'], ['dak', 'roof'], ['gevel', 'facade'], ['rozet', 'rosette'], ['klauwstukken', 'scrolls'], ['klauwstuk', 'scroll'],
  ['tegel', 'tile'], ['zolder', 'attic'], ['speklag', 'speklagen'], ['pinakel', 'pinnacle'], ['sierlijst', 'cornice'],
  ['bay window', 'oriel'], ['box window', 'oriel'], ['canted bay', 'oriel'], ['french window', 'french window'], ['wall dormer', 'dormer'],
]);

/** Dutch and English variants folded in the text, longest first, whole words only. */
const SYNONYM_RE = new RegExp(`\\b(${[...SYNONYMS.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[-\s]/g, m => (m === '-' ? '\\-' : '\\s+'))).join('|')})\\b`, 'g');

/** Lower-case, collapse whitespace, drop trailing stops, fold synonyms. The text the rules see. */
export function foldText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim().replace(SYNONYM_RE, m => SYNONYMS.get(m.replace(/\s+/g, ' ')) ?? m);
}

interface Rule { component: KitComponent; what: string; match: RegExp }
const R = (component: KitComponent, what: string, match: RegExp): Rule => ({ component, what, match });

/** Ordered keyword rules over folded text. A `what` is the canonical gap wording the queue groups by. */
export const RULES: readonly Rule[] = [
  // shopfronts and signs (before the generic wall, door and window words)
  R('wall', 'ground storey brick', /ground[- ]storey[^.;]*(brick|colour|paint|dark)|darker brick|dark brick/),
  R('pui', 'signs on the glass-block band', /(sign|lettering|logo|board|subline)[^.;]*glass|glass[^.;]*(sign|lettering|board)/),
  R('pui', 'shop signs', /\bsigns?\b|lettering|\blogo\b|subline|sign text/),
  R('pui', 'shopfront and arcade', /shop|arcade|storefront|mezzanine|ground[- ]floor|ground window|glass-block/),
  R('ornament', 'wall anchors', /anchor/),
  // doors and canopies
  R('door', 'door canopies', /canopy|canopies|awning/),
  R('door', 'arched door heads', /(arch|arched|round-arched|stair-door)[^.;]*\bdoor|\bdoor[^.;]*(arch|head)/),
  R('door', 'paired doors', /(pair|paired|two|double|four|shared|portico)\b[^.;]*\bdoors?\b|\bdoor pair|\bone door|as one door/),
  R('door', 'door side lights', /side ?lights?|mailbox/),
  R('door', 'door position', /door[^.;]*(axis|party wall|stand|position)|stand on the (first|last)/),
  R('door', 'door detail', /\bdoors?\b|stoop/),
  // front gardens and street furniture: not the building
  R('other', 'front gardens and stalls', /garden|hedge|fence|market stall|flower|plant box/),
  // balconies
  R('balcony', 'balcony depth', /balcony depth|balcony platforms|platforms are|0\.75 m deep|depth is (assumed|not measurable)|balcon[^.;]*\bdeep/),
  R('balcony', 'balcony brackets', /balcon[^.;]*(bracket|corbel|slab|cast)|(bracket|corbel)[^.;]*balcon/),
  R('balcony', 'loggia and recessed balconies', /loggia/),
  R('balcony', 'balcony railings', /balcon(?!y (row|windows?))|balustrad|bellied|balconette|juliet|iron rails?|guard|railing/),
  // oriels and bays (before the dormer words: "erker ... cap")
  R('openings', 'oriels and bay windows', /oriel|canted|bay window|box window|box frame|bayWindows/),
  // dormers
  R('dormer', 'dormer cheeks and ears', /cheek|\bears?\b/),
  R('dormer', 'dormer caps and pediments', /pediment|dormer[^.;]*\bbell\b|\bbell\b[^.;]*dormer|cap\b[^.;]*dormer|dormer[^.;]*\bcaps?\b|finial|hoist|shell hood|crest|stepped stone/),
  R('dormer', 'dormer count and placement', /dormer[^.;]*(per pand|count|fifth|off the|beside|small|placement|per house|stair|axis|pitch|balcony)|(small|fifth|box|zinc|roof|attic|three-light|wall|narrow-axis) dormers?|dormers? (are )?not drawn|dormers? and roof windows/),
  R('dormer', 'dormer lights', /dormer[^.;]*lights?|lights of the dormer|three-light dormer/),
  R('dormer', 'dormer detail', /dormer/),
  // cornices and friezes
  R('cornice', 'cornice frieze panels', /frieze[^.;]*panel|panel[^.;]*frieze/),
  R('cornice', 'frieze and dentils', /frieze|entablature|dentil|zigzag|fascia/),
  R('cornice', 'corbel course', /corbel/),
  R('cornice', 'cornice detail', /cornice/),
  // roofs and parapets
  R('roof', 'overhang and soffit', /overhang|soffit|flat-ended|eaves/),
  R('roof', 'gutters and downpipes', /gutter|downpipe|rainwater/),
  R('roof', 'parapet and coping', /parapet|coping|crow-?step/),
  R('roof', 'roof lights and terraces', /skylight|roof light|roof window|roof-terrace|roof terrace|roof boxes?|tile face|setback|set-back|roof storey|roof-light/),
  R('roof', 'roof form', /roof|mansard|pitched|chimney|ridge|3dbag|\bhip\b/),
  // crowns and gables
  R('ornament', 'keystones and cartouches', /keystone|cartouche/),
  R('crown', 'gable scrollwork and volutes', /scroll|volute|pinnacle/),
  R('crown', 'gable and crown form', /gable|crown|\bneck\b|\bbell\b|pointed/),
  R('wall', 'corner and massing', /corner|\bdrum\b|tower|massing|\bmass\b|\bmodules?\b/),
  // brackets and ornament
  R('ornament', 'brackets and consoles', /bracket|console|sconce/),
  // openings: narrow lights, stairs, heights, heads, sashes, sills, frames
  R('openings', 'slot and narrow lights', /slot lights?|slot windows?|stair slots?|\bslots\b|narrow (centre|side|window|light|french|slit)/),
  R('openings', 'stair windows off the storey line', /stair[^.;]*(window|light|slit|panel)|half a storey|half storey|landings|climb|stair axis/),
  R('openings', 'window heights and axes', /height|head line|\bpitch\b|\baxes\b|\baxis\b|bay width|\bwidths?\b|wide window|ratio|storey lines?|sill height|equal axis|drawn [^.;]* wide/),
  R('openings', 'brick flat arches', /flat[- ]arch|flat (window )?heads?|flat lintel|\blintels?\b/),
  R('wall', 'brick courses and bands', /band|course|stripe|ladder|speklag|soldier|header|brickstripes/),
  R('openings', 'window heads and arches', /tympan|arch ring|\barch(es)?\b|voussoir|springer|relieving|\bheads?\b|\bhood/),
  R('openings', 'window sash bars and panes', /sash|pane|glazing|\bbars?\b|casement|two[- ]over[- ]two|top ?light|transom|\blights?\b|mullion/),
  R('openings', 'window sills', /sill/),
  R('openings', 'window surrounds and frames', /surround|architrave|dressing|eared|\bframes?\b/),
  R('openings', 'party-wall window split', /halves|across the party wall|party-wall window|window[^.;]*party wall|party wall[^.;]*window|one opening/),
  // ornament
  R('ornament', 'carved and cast ornament', /carv|\bcast\b|ornament|sculpt|rosette|iron finial|ironwork|wrought|moulded|molded|sunburst|diamond-brick|lozenge|cream panels/),
  R('ornament', 'iron details', /\biron\b/),
  // walls and finishes
  R('wall', 'brick pattern and diaper', /diaper|lattice|checker|chequer|diamond|pattern|mosaic|\bfan\b/),
  R('wall', 'pilasters and piers', /pilaster|lisene|\bpiers?\b/),
  R('wall', 'wall colour and finish', /colou?r|palette|finish|stucco|render|plaster|paint|grain|\bmean\b|grey|gray|red|orange|yellow|ochre|cream|white|stone|brown|\bdark\b|darker|lighter|brick|\bwall|\btile|timber|ribbed|boarded|panel/),
  // a window word with nothing finer
  R('openings', 'window detail', /window|opening|french|\blight/),
];

/** The kit component and canonical wording of one prose line; `other` when no rule names it. */
export function classifyLimit(text: string, structured?: string): { component: KitComponent; what: string } {
  const folded = foldText(text);
  const rule = RULES.find(r => r.match.test(folded));
  if (rule) return { component: rule.component, what: rule.what };
  const alias = structured ? STRUCTURED_ALIASES[structured] : undefined;
  if (alias && alias !== 'other') return { component: alias, what: folded };
  return { component: 'other', what: folded };
}
