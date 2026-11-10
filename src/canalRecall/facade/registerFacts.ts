// Facade facts from a monuments-register description (lane #316, step 2). Pure and typed.
//
// The RCE and municipal descriptions are terse Dutch: "Hoekhuis (XVII) met trapgevel (XIXd) vernieuwd.",
// "Pand met gevel (1662) onder door een dakvenster doorgebroken lijst met consoles (1889).". This reads the facts
// they state and nothing else: a field the text does not name stays undefined (never a default, never a guess).
// Dates keep their precision as a year range plus a confidence; every element keeps the Dutch term it came from.

import { classifyGable } from '../monumentGables.js';
import type { GableShape } from '../roofMesh.js';

export type RegisterDate = { from: number; to: number; confidence: 'exact' | 'approx' | 'period'; term: string };
export type RegisterFinish = 'ornamentalBrick' | 'plaster' | 'stone' | 'painted' | 'brick';
export type RegisterElement = { key: string; term: string };
export type RegisterFacts = {
  sourceNr: string;
  sourceText: string;
  facadeDate?: RegisterDate;
  coreDate?: RegisterDate;
  type?: { key: string; term: string };
  gable?: GableShape;
  style?: string[];
  finish?: RegisterFinish;
  stoneBands?: boolean;
  elements: RegisterElement[];
  storeys?: number;
  basement?: boolean;
  altered?: { what: string[]; when?: RegisterDate };
};

const ORD: Record<string, number> = { twaalfde: 12, dertiende: 13, veertiende: 14, vijftiende: 15, zestiende: 16, zeventiende: 17, achttiende: 18, negentiende: 19, twintigste: 20 };
const ROMAN: Record<string, number> = { XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20 };
const QUARTER: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
const PART: Record<string, [number, number]> = { begin: [0, 25], vroeg: [0, 25], eerste: [0, 25], midden: [40, 60], eind: [75, 100], laat: [75, 100], tweede: [25, 50], derde: [50, 75], vierde: [75, 100] };

const CENTURY = String.raw`(?:(?:1[2-9]|20)e|${Object.keys(ORD).join('|')})[\s-]*eeuw(?:se|s)?`;
const ROMAN_RE = String.raw`(?<![A-Za-z])X(?:VIII|VII|VI|IV|V|IX|III|II|X|I)?(?:\s?[a-dA-D](?:\s*\/\s*[a-dA-D])?)?(?![A-Za-z])`;
const PREFIX = String.raw`(?:(?:begin|vroeg|eerste\s+kwart|tweede\s+kwart|derde\s+kwart|vierde\s+kwart|midden|eind|laat|late)[\s-]+(?:van\s+de\s+)?)?`;
const APPROX = String.raw`(?:(?:ca\.?|circa|plm\.?|plusminus|omstreeks|omtrent)\s*)?`;
/** One dated expression: a year (range), a Roman period with quarters, or a written century with a part. */
export const DATE_RE = new RegExp(String.raw`${APPROX}${PREFIX}(?:1[2-9]\d\d(?:\s*[-–\/]\s*(?:1[2-9])?\d\d)?|${ROMAN_RE}|${CENTURY})(?:\s*[\/-]\s*${PREFIX}(?:${ROMAN_RE}|${CENTURY}))?`, 'gi');

function centuryOf(s: string): number | null {
  const n = /(1[2-9]|20)e/i.exec(s);
  if (n) return Number(n[1]);
  for (const [w, c] of Object.entries(ORD)) if (s.toLowerCase().includes(w)) return c;
  const r = /X(?:VIII|VII|VI|IV|V|IX|III|II|X|I)?/.exec(s);
  return r && ROMAN[r[0]] ? ROMAN[r[0]] : null;
}
function partOf(s: string): [number, number] {
  const k = /(begin|vroeg|eerste|tweede|derde|vierde|midden|eind|laat)/i.exec(s);
  return k ? PART[k[1].toLowerCase()] : [0, 100];
}
/** One side of a period ("XVIIc", "eind XVIII", "18e eeuw") as years. */
function periodSide(s: string): [number, number] | null {
  const c = centuryOf(s);
  if (!c) return null;
  const base = (c - 1) * 100;
  const q = /X[IVX]*\s?([a-dA-D])(?:\s*\/\s*([a-dA-D]))?(?![A-Za-z])/.exec(s);
  if (q) return [base + QUARTER[q[1].toLowerCase()] * 25, base + (QUARTER[(q[2] ?? q[1]).toLowerCase()] + 1) * 25 - 1];
  const [a, b] = partOf(s);
  return [base + a, base + b - 1];
}
/** A date expression as a year range, or null when it is not one. */
export function parseDate(term: string): RegisterDate | null {
  const t = term.trim();
  const approx = /^(ca|circa|plm|plusminus|omstreeks|omtrent)/i.test(t);
  const y = /(1[2-9]\d\d)(?:\s*[-–\/]\s*((?:1[2-9])?\d\d))?/.exec(t);
  if (y) {
    const from = Number(y[1]);
    const to = y[2] ? Number(y[2].length === 2 ? y[1].slice(0, 2) + y[2] : y[2]) : from;
    return { from, to: Math.max(from, to), confidence: approx ? 'approx' : 'exact', term: t };
  }
  const sides = t.split(/\s*[\/-]\s*(?=[a-z]*\s*(?:X|\d|[a-z]+de\b|begin|eind|midden|vroeg|laat))/i);
  const first = periodSide(sides[0]);
  if (!first) return null;
  const last = sides.length > 1 ? periodSide(sides[sides.length - 1]) ?? first : first;
  return { from: first[0], to: last[1], confidence: 'period', term: t };
}
type Hit = { at: number; end: number; date: RegisterDate };
function datesIn(text: string): Hit[] {
  const out: Hit[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const date = parseDate(m[0]);
    // A bare Roman X/V/I inside a name ("Lodewijk XIV") is a style, not a date.
    if (date && !/(?:Lodewijk|Louis)\s*$/i.test(text.slice(Math.max(0, m.index! - 9), m.index!))) out.push({ at: m.index!, end: m.index! + m[0].length, date });
  }
  return out;
}

const TYPES: Array<[string, RegExp]> = [
  ['coachHouse', /koetshuis/i], ['warehouse', /pakhuis|pakhuizen/i], ['shopHouse', /winkel-?\s*woonhuis|winkelpand/i],
  ['mansion', /herenhuis|grachtenhuis/i], ['almshouse', /hofje/i], ['church', /\bkerk\b|kerkgebouw/i], ['school', /(?<!Amsterdamse\s)\bschool/i],
  ['workshop', /werkplaats|bedrijfspand|fabriek/i], ['house', /woonhuis|\bhuis\b|\bpand\b|hoekhuis|hoekpand/i],
];
const STYLES: Array<[string, RegExp]> = [
  ['Lodewijk XIV', /(?:Lodewijk|Louis)\s*XIV\b/i], ['Lodewijk XV', /(?:Lodewijk|Louis)\s*XV\b/i], ['Lodewijk XVI', /(?:Lodewijk|Louis)\s*XVI\b/i],
  ['classicist', /classicis/i], ['Amsterdamse School', /Amsterdamse\s+School/i], ['eclectic', /eclectisch/i],
  ['renaissance', /(?<!neo-?)renaissance/i], ['jugendstil', /jugendstil|art\s+nouveau/i], ['art deco', /art\s+deco/i],
  ['empire', /\bempire/i], ['rococo', /rococo/i], ['baroque', /\bbarok/i], ['neo-gothic', /neo-?gotisch|neogotiek/i],
  ['neo-renaissance', /neo-?renaissance/i], ['neo-classicist', /neo-?classicis/i], ['zakelijk', /zakelijk/i],
];
const ELEMENTS: Array<[string, RegExp]> = [
  ['hoistBeam', /hijsbalk/i], ['stoop', /\bstoep(?:en)?\b/i], ['cellarEntrance', /kelderingang|kelderdeur|kelderpui/i],
  ['shopfront', /onderpui|winkelpui|\bpui\b/i], ['pediment', /fronton/i], ['corniceConsoles', /consoles?\b|klossen/i],
  ['crownCornice', /kroonlijst/i], ['dormer', /dakkapel|dakvenster/i], ['attic', /attiek/i], ['festoons', /festoen/i],
  ['oeilDeBoeuf', /oeil-de-boeuf|ovaal\s+venster|œil/i], ['claws', /klauwstuk|vleugelstuk/i], ['sashWindows', /schuiframen|schuifvensters/i],
  ['glazingBars', /roedenverdeling|roeden/i], ['shutters', /luiken/i], ['doorSurround', /deuromlijsting|ingangspartij/i],
  ['balcony', /balkon/i], ['bayWindow', /erker/i], ['twinGable', /tweeling/i], ['sculpture', /beeldhouwwerk|gebeeldhouwd|beeld\b/i],
  ['gablestone', /gevelsteen/i], ['anchors', /muurankers|sierankers/i], ['balustrade', /balustrade|balusters/i],
];
const COUNT: Record<string, number> = { een: 1, 'één': 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7 };
const ALTER = /(verbouwd|gewijzigd|gerestaureerd|vernieuwd|veranderd|gemoderniseerd|aangepast)/i;
const ALTER_WHAT = /(onderpui|\bpui\b|gevel|lijst|top|dakkapel|ramen|vensters|interieur|kap|achtergevel|zijgevel|ingang|stoep)/gi;

/** The facts a register description states, by monument number. */
export function parseRegisterFacts(sourceNr: string, text: string): RegisterFacts {
  const facts: RegisterFacts = { sourceNr, sourceText: text, elements: [] };
  const dates = datesIn(text);
  // Core date: "in de kern X", or a date right after the opening noun ("Hoekhuis (XVII) met trapgevel (XIXd)").
  const kern = /in\s+de\s+kern\s*/i.exec(text);
  const kernDate = kern ? dates.find(d => d.at >= kern.index && d.at <= kern.index + kern[0].length + 2) : undefined;
  const opener = /^\s*(?:[A-Z][\w-]*\s+){0,2}?[\w-]*(?:huis|pand|pakhuis|koetshuis|gebouw|huizen|panden)\s*\(?/i.exec(text);
  const openerDate = opener ? dates.find(d => d.at <= opener[0].length + 1) : undefined;
  // Facade date: the first date after the first "gevel" word (a gable word counts), within its sentence.
  const gevel = /gevel|punttop|klokvormige\s+top|halsvormige\s+top/i.exec(text);
  const sentenceEnd = gevel ? (text.slice(gevel.index).search(/\.\s|\.$/) + gevel.index) : -1;
  // "Laat 19e eeuwse gevel": a period adjective right before the word dates the front too.
  const before = gevel ? dates.find(d => d.end <= gevel.index && /^[\s-]*$/.test(text.slice(d.end, gevel.index))) : undefined;
  const facadeHit = before ?? (gevel ? dates.find(d => d.at > gevel.index && (sentenceEnd < gevel.index || d.at < sentenceEnd) && d !== kernDate) : undefined);
  if (facadeHit) facts.facadeDate = facadeHit.date;
  const core = kernDate ?? (openerDate && openerDate !== facadeHit ? openerDate : undefined);
  if (core) facts.coreDate = core.date;
  const t = TYPES.find(([, re]) => re.test(text));
  if (t) facts.type = { key: t[0], term: (t[1].exec(text) as RegExpExecArray)[0] };
  const g = classifyGable(text);
  if (g) facts.gable = g;
  const st = STYLES.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (st.length) facts.style = st;
  // Finish: the wall itself, not a stone top or stone ornaments on a brick front.
  const fin: Array<[RegisterFinish, RegExp]> = [
    ['ornamentalBrick', /siermetselwerk/i], ['plaster', /(?:ge|be)pleisterd|pleisterwerk/i],
    ['stone', /(?:natuur|zand|hard)stenen\s+(?:gevel|front)|gevel\s+(?:van|in|met\s+bekleding\s+van)\s+(?:natuur|zand|hard)steen/i],
    ['painted', /geschilderde\s+(?:gevel|voorgevel|baksteen)|gevel\s+(?:is\s+)?(?:geschilderd|gesausd)|gesausde\s+gevel/i], ['brick', /bakstenen\s+gevel|gevel\s+(?:van|in)\s+baksteen|\bbaksteen/i],
  ];
  const f = fin.find(([, re]) => re.test(text));
  if (f) facts.finish = f[0];
  if (/\bbanden\b|speklagen|speklaag/i.test(text)) facts.stoneBands = true;
  for (const [key, re] of ELEMENTS) { const m = re.exec(text); if (m) facts.elements.push({ key, term: m[0] }); }
  const s = /\b(een|één|twee|drie|vier|vijf|zes|zeven|\d)\s+(?:verdiepingen|bouwlagen|bouwlaag|verdieping|woonlagen|lagen)\b/i.exec(text);
  if (s) facts.storeys = COUNT[s[1].toLowerCase()] ?? Number(s[1]);
  if (/souterrain|kelder/i.test(text)) facts.basement = true;
  // Alterations: each sentence that names one, the parts it names, and its date.
  const what = new Set<string>(); let when: RegisterDate | undefined;
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    const m = ALTER.exec(sentence);
    if (!m) continue;
    for (const w of sentence.matchAll(ALTER_WHAT)) what.add(w[0].toLowerCase());
    // The date nearest the verb ("trapgevel (XIXd) vernieuwd", "in de 19e eeuw zeer verbouwd").
    const d = datesIn(sentence).sort((a, b) => Math.min(Math.abs(a.end - m.index), Math.abs(a.at - m.index - m[0].length)) - Math.min(Math.abs(b.end - m.index), Math.abs(b.at - m.index - m[0].length)))[0];
    if (d && !when) when = d.date;
  }
  if (ALTER.test(text)) facts.altered = when ? { what: [...what], when } : { what: [...what] };
  return facts;
}
