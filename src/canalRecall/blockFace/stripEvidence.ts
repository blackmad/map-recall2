/**
 * Strip evidence gate (#120, 2026-10-30): does a pand's span of the rectified panorama strip show its front at all, before
 * the type match, the palette and the likeness score are allowed to read it?
 *
 * The Jordaan Bloemgrachtbuurt batch installed 8 runs whose edge NCC passed (0.155-0.218) although 4 had no usable front:
 * a close two-storey crop (Bloemstraat 128-206 r2), close oblique wall crops (Akoleienstraat 2-10 r1, Nieuwe Leliestraat
 * 150-194 r1) and a fence under a tree (Bloemgracht 53-95 r1). Edge NCC rewards any brick-and-window texture, so it cannot
 * tell a front from a magnified crop of the wrong wall. The strip is rectified onto the BAG front plane up to a few metres
 * over the 3DBAG roof; when that plane is really the front, the band over the roof is open sky in (nearly) every column.
 * When the camera saw a nearer wall, a fence or a tree, that wall is magnified past the strip top and the band is facade.
 *
 * Measured per span (scripts/block-face/evidence-gate.ts prints them all):
 *   skyCols   share of the span's columns whose band over the roof (roofMax + 0.7 m .. strip top) is at least
 *             COLUMN_SKY open sky (GATE: EVIDENCE.minSkyColumns);
 *   open      share of open-sky pixels in that band (reported; trees over the roofline pull it down on good fronts);
 *   aboveM    that band's height (GATE: a band under EVIDENCE.minBandM cannot show the sky);
 *   sky       `measureSkyline` confidence (reported; its fixed sky colour misses grey overcast: 0 on good De Pijp strips);
 *   reach     skyline cornice / 3DBAG eaves (reported; unread wherever `sky` is);
 *   distanceM, obliquityDeg  the nearest panorama against the BAG front normal (reported; the planner already caps the
 *             obliquity at 45 deg, and inside it the bad and good runs overlap: akoleien/lelie 22-29 m at 36-43 deg,
 *             helst-51-67 18-26 m at 40-44 deg);
 *   foliage, placeholder  body-band shares (reported; `decidePand` and the likeness abstain already gate them).
 */
import {measureSkyline} from './stripSkyline.ts';
import {classifyPixel} from './stripPalette.ts';
import {isLeaf} from '../buildingRecipe/measureFacade.ts';

export const EVIDENCE = {
  /** Luma gradient (|dx| + |dy|, 0..255) under which a lighter-than-facade pixel reads as overcast sky. */
  smoothGrad: 10,
  /** Overcast sky is this much lighter than the facade body's median luma (or over `whiteLuma`). */
  skyOverBody: 30,
  whiteLuma: 215,
  /** A column of the band over the roof sees sky when at least this share of its pixels is open sky (bare branches
   * over a roof leave 30-90 % sky per column; a magnified wall's white frames leave under 15 %). */
  columnSky: 0.25,
  /** Calibration (2026-10-30, scripts/block-face/evidence-gate.ts --calibrate): the 4 reviewed no-front runs' spans read
   * 0.03-0.59 (the fence-and-tree span of Bloemgracht 53-95 is the highest, 0.59); the 24 reviewed installs' 62 spans
   * read 0.95-1.00. The limit sits at the middle of that gap. */
  minSkyColumns: 0.75,
  /** The band over the roof must be tall enough to hold sky (every staged strip has >= 1.3 m). */
  minBandM: 0.5,
} as const;

export interface PanoramaUse {distanceM: number; obliquityDeg: number}

export interface SpanEvidence {
  skyCols: number;
  open: number;
  aboveM: number;
  sky: number;
  reach: number;
  distanceM: number | null;
  obliquityDeg: number | null;
  foliage: number;
  placeholder: number;
}

export interface EvidenceVerdict {pass: boolean; reasons: string[]}

const r2 = (v: number) => +v.toFixed(2);
const luma = (rgb: Uint8Array, i: number) => 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];

/** Open sky: blue-dominant and not dark (clear sky, cloud edges included), or smooth and clearly lighter than the facade
 * body (overcast), or smooth near-white. */
export function openSky(r: number, g: number, b: number, l: number, smooth: boolean, bodyLuma: number): boolean {
  if (b > r + 15 && b >= g - 5 && l > 80) return true;
  return smooth && (l > bodyLuma + EVIDENCE.skyOverBody || l > EVIDENCE.whiteLuma);
}

/** Body band (4.4 m .. eaves - 1 m) rows, top and bottom (strip y runs down). */
function bodyRows(height: number, ppm: number, eavesM: number): [number, number] {
  return [Math.max(0, Math.round(height - (eavesM - 1) * ppm)), Math.min(height, Math.round(height - 4.4 * ppm))];
}

/** Shares of placeholder grey and foliage in the body band of a span (6 % inset each side), and its median luma. */
export function bodyShares(rgb: Uint8Array, width: number, height: number, px: [number, number], ppm: number, eavesM: number): {foliage: number; placeholder: number; luma: number} {
  const inset = Math.round((px[1] - px[0]) * 0.06), [y0, y1] = bodyRows(height, ppm, eavesM);
  let n = 0, v = 0, leaf = 0; const ls: number[] = [];
  for (let y = y0; y < y1; y++) for (let x = px[0] + inset; x < px[1] - inset; x++) {
    const i = (y * width + x) * 3, p: [number, number, number] = [rgb[i], rgb[i + 1], rgb[i + 2]];
    n++; if (classifyPixel(p) === 'void') { v++; continue; }
    if (isLeaf(p[0], p[1], p[2])) leaf++;
    ls.push(luma(rgb, i));
  }
  ls.sort((a, b) => a - b);
  return {foliage: n ? r2(leaf / n) : 0, placeholder: n ? r2(v / n) : 1, luma: ls.length ? ls[ls.length >> 1] : 100};
}

/** The band over the roof (roofM + 0.7 m .. strip top): open-sky pixel share, share of columns that see sky, band height. */
export function bandOverRoof(rgb: Uint8Array, width: number, height: number, px: [number, number], ppm: number, roofM: number, bodyLuma: number): {open: number; skyCols: number; aboveM: number} {
  const inset = Math.round((px[1] - px[0]) * 0.06), y1 = Math.min(height, Math.round(height - (roofM + 0.7) * ppm));
  let n = 0, open = 0, cols = 0, skyCols = 0;
  for (let x = px[0] + inset; x < px[1] - inset - 1; x++) {
    let cn = 0, co = 0;
    for (let y = 1; y < y1; y++) {
      const i = (y * width + x) * 3, l = luma(rgb, i);
      const smooth = Math.abs(luma(rgb, i + 3) - l) + Math.abs(l - luma(rgb, i - width * 3)) < EVIDENCE.smoothGrad;
      cn++; if (openSky(rgb[i], rgb[i + 1], rgb[i + 2], l, smooth, bodyLuma)) co++;
    }
    n += cn; open += co;
    if (cn) { cols++; if (co / cn >= EVIDENCE.columnSky) skyCols++; }
  }
  return {open: n ? r2(open / n) : 0, skyCols: cols ? r2(skyCols / cols) : 0, aboveM: r2(Math.max(0, y1) / ppm)};
}

export function measureSpanEvidence(a: {rgb: Uint8Array; width: number; height: number; px: [number, number]; pixelsPerMetre: number; eavesM: number; roofM: number; panoramas?: PanoramaUse[]}): SpanEvidence {
  const ppm = a.pixelsPerMetre;
  const sk = measureSkyline({rgb: a.rgb, width: a.width, height: a.height, x0: a.px[0], x1: a.px[1], pixelsPerMetre: ppm});
  const near = a.panoramas?.length ? a.panoramas.reduce((p, q) => (q.distanceM < p.distanceM ? q : p)) : null;
  const body = bodyShares(a.rgb, a.width, a.height, a.px, ppm, a.eavesM);
  const band = bandOverRoof(a.rgb, a.width, a.height, a.px, ppm, a.roofM, body.luma);
  const skyEavesM = sk && sk.eavesM > 0 ? sk.eavesM : 0;
  return {...band, sky: sk?.confidence ?? 0, reach: skyEavesM && a.eavesM > 0 ? r2(skyEavesM / a.eavesM) : 0,
    distanceM: near ? near.distanceM : null, obliquityDeg: near ? near.obliquityDeg : null, foliage: body.foliage, placeholder: body.placeholder};
}

/** A span shows its front when the band over its roof is tall enough and open sky in most columns. */
export function evidenceVerdict(e: Pick<SpanEvidence, 'skyCols' | 'aboveM'>): EvidenceVerdict {
  const reasons: string[] = [];
  if (e.aboveM < EVIDENCE.minBandM) reasons.push(`strip ends ${e.aboveM} m over the roof (< ${EVIDENCE.minBandM} m): no sky to read`);
  else if (e.skyCols < EVIDENCE.minSkyColumns) reasons.push(`sky over the roof in ${Math.round(e.skyCols * 100)} % of columns (< ${Math.round(EVIDENCE.minSkyColumns * 100)} %): the strip shows a nearer wall, fence or tree, not the front`);
  return {pass: !reasons.length, reasons};
}

/** A run passes only when every span shows its front (a held span leaves a gap the run rule would hold anyway). */
export function runVerdict(spans: {pandId: string; pass: boolean; reasons: string[]}[]): EvidenceVerdict {
  const bad = spans.filter(s => !s.pass);
  return {pass: !bad.length, reasons: bad.map(s => `${s.pandId.slice(-6)}: ${s.reasons.join(', ')}`)};
}
