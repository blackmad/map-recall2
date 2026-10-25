/**
 * Entablature (`entablature`, Helmersbuurt 1893-1900 rows: Eerste Helmersstraat 116-122 and 42-56; issue #81): the
 * deep white band that crowns a late-19th-c. brick front, measured as one `rise` instead of a cornice style's fixed
 * 0.35-1.6 m. From the top: a projecting `cap` (moulded underside), a `frieze` (a flush white band, `trim`, or open
 * brick between consoles, `wall`), an `architrave` fillet at its foot, and `consoles`: console brackets hanging from
 * the cap through the frieze, evenly from end to end. Drawn through the recipe cornice's `layers` and `console`
 * accents (canalhouseRecipes.ts); the band replaces the style's cornice height in the storey layout. Absent = the
 * style's cornice, byte-identical.
 *
 * Measured on the 2023-01-12 strips at 40 px/m: Eerste 120 white band 11.4-12.6 m (1.2 m), cap about 0.35 m; Eerste
 * 54-56 a 0.3 m cap over a brick frieze with white consoles at the piers, about 1.1 m in all.
 */
import type {FrontIntent} from './intent.ts';

export const ENTABLATURE = {
  minHeightM: 0.4, maxHeightM: 2.4, minCapM: 0.15, maxCapM: 0.7, capDepthM: 0.4, maxCapDepthM: 0.8,
  friezeDepthM: 0.04, architraveDepthM: 0.08, maxArchitraveM: 0.4, consoleWidthM: 0.18, consoleInsetM: 0.08, maxConsoles: 24,
} as const;

export type EntablatureIntent = NonNullable<FrontIntent['entablature']>;
type Cornice = {bottomM: number; heightM: number; depthM: number; brackets: number;
  layers: {bottomM: number; heightM: number; depthM: number; underside?: {riseM: number; insetM: number}}[];
  accents?: {id: string; kind: 'slab'; leftM: number; bottomM: number; widthM: number; heightM: number; depthM: number; surface: 'stone'; profile: 'console'}[]};

const r = (v: number) => Math.round(v * 1000) / 1000;

export function entablatureProblems(f: FrontIntent, at: string): string[] {
  const e = f.entablature as Record<string, unknown> | undefined, p: string[] = [];
  const keys = ['rise', 'cap', 'capDepth', 'frieze', 'architrave', 'consoles'];
  if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some(k => !keys.includes(k))) return [`${at}.entablature: {rise, cap, frieze, capDepth?, architrave?, consoles?}`];
  const num = (k: string, lo: number, hi: number, optional = false) => {
    if (optional && e[k] === undefined) return;
    if (!(typeof e[k] === 'number' && (e[k] as number) >= lo && (e[k] as number) <= hi)) p.push(`${at}.entablature.${k}: ${lo}..${hi}`);
  };
  num('rise', ENTABLATURE.minHeightM, ENTABLATURE.maxHeightM);
  num('cap', ENTABLATURE.minCapM, ENTABLATURE.maxCapM);
  num('capDepth', 0.1, ENTABLATURE.maxCapDepthM, true);
  num('architrave', 0, ENTABLATURE.maxArchitraveM, true);
  if (e.consoles !== undefined && !(Number.isInteger(e.consoles) && (e.consoles as number) >= 2 && (e.consoles as number) <= ENTABLATURE.maxConsoles)) p.push(`${at}.entablature.consoles: an integer 2..${ENTABLATURE.maxConsoles}`);
  if (e.frieze !== 'trim' && e.frieze !== 'wall') p.push(`${at}.entablature.frieze: "trim" (a white band) or "wall" (brick between consoles)`);
  if (typeof e.rise === 'number' && typeof e.cap === 'number' && e.cap + ((e.architrave as number | undefined) ?? 0) > e.rise - 0.1) p.push(`${at}.entablature: cap + architrave leave no frieze under ${e.rise} m`);
  if (f.cornice === undefined || f.cornice === 'none') p.push(`${at}.entablature: needs a cornice (it replaces the style's band)`);
  if (f.parapet) p.push(`${at}.entablature: a parapet front has no cornice band`);
  return p;
}

/** The recipe cornice of a front with an entablature, its top at `eaves` across `width` metres. */
export function entablatureCornice(e: EntablatureIntent, eaves: number, width: number): Cornice {
  const capDepth = e.capDepth ?? ENTABLATURE.capDepthM, arch = e.architrave ?? 0, bottom = r(eaves - e.rise);
  const friezeBottom = r(bottom + arch), friezeH = r(eaves - e.cap - friezeBottom);
  const layers: Cornice['layers'] = [{bottomM: r(eaves - e.cap), heightM: e.cap, depthM: capDepth, underside: {riseM: r(e.cap * 0.4), insetM: r(capDepth * 0.5)}}];
  if (e.frieze === 'trim') layers.push({bottomM: friezeBottom, heightM: friezeH, depthM: ENTABLATURE.friezeDepthM});
  if (arch > 0) layers.push({bottomM: bottom, heightM: arch, depthM: ENTABLATURE.architraveDepthM});
  const cornice: Cornice = {bottomM: bottom, heightM: e.rise, depthM: capDepth, brackets: 0, layers};
  const n = e.consoles ?? 0, w = ENTABLATURE.consoleWidthM, span = width - 2 * ENTABLATURE.consoleInsetM - w;
  if (n >= 2 && span > 0) cornice.accents = Array.from({length: n}, (_, k) => ({id: `entablature-console-${k}`, kind: 'slab' as const,
    leftM: r(ENTABLATURE.consoleInsetM + span * k / (n - 1)), bottomM: friezeBottom, widthM: w, heightM: friezeH,
    depthM: r(capDepth * 0.8), surface: 'stone' as const, profile: 'console' as const}));
  return cornice;
}
