/**
 * The Raadhuisstraat gallery's street front as one smooth curve (src/canalRecall/landmarks/curvedFront.ts) through the
 * BAG chord junctions of its 13-pand union outline (raadhuisstraat-galerij-footprints.json), from the Keizersgracht
 * corner tower (s = 0) to the Herengracht corner. Outward normal: the street (north-east) side.
 */
import fp from './raadhuisstraat-galerij-footprints.json' with {type: 'json'};
import {chordJunctions, curvedFront, type CurvedFront, type XZ} from '../../src/canalRecall/landmarks/curvedFront.ts';

const ring = fp.nativeRing as XZ[];
/** Index range of the street run: from the tower's northernmost vertex east to the Herengracht corner. */
export function frontPolyline(): XZ[] {
  const n = ring.length;
  let iT = 0, iH = 0;
  ring.forEach((p, i) => { if (p[1] < ring[iT][1]) iT = i; if (p[0] > ring[iH][0] && p[1] < 16) iH = i; });
  const walk = (step: number) => { const out: number[] = []; for (let i = iT; ; i = (i + step + n) % n) { out.push(i); if (i === iH) break; } return out; };
  const a = walk(1), b = walk(-1), mz = (w: number[]) => w.reduce((t, i) => t + ring[i][1], 0) / w.length;
  return (mz(a) < mz(b) ? a : b).map(i => ring[i]);
}
/**
 * Junctions with a short segment on both sides go: nr 23-27 (s 105-109) and the Herengracht cut corner draw shop bays and
 * door recesses as 0.1-1 m steps that are longer than a pier jog, and a curve through them swung the normal by up to
 * 90 degrees inside one house (windows and the serre glazing hung off the wall). The bays are trimmed, not the line.
 */
export function dropJags(js: XZ[], short = 1.5): XZ[] {
  const d = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  return js.filter((p, i) => i === 0 || i === js.length - 1 || d(js[i - 1], p) >= short || d(p, js[i + 1]) >= short);
}
let cached: CurvedFront | null = null;
export function front(): CurvedFront {
  // travel west -> east with the street to the north: outward (tz, -tx) is side +1
  // the curve stops at the Herengracht corner's 1 m cut (41.93, 15.91)-(42.99, 15.84): bending the front into it turned
  // nr 21's shop and entresol windows across two wall facets; the cut is its own wall (CUT_CORNER below)
  return cached ??= curvedFront(dropJags(chordJunctions(frontPolyline(), 3, 1)).slice(0, -1), {side: 1});
}
/** The facade chords (one per house / gallery bay) between consecutive junctions, with their arc-length range. */
export function frontChords(minLen = 2.5): {s0: number; s1: number; a: XZ; b: XZ}[] {
  const f = front(), js = f.junctionS, out = [];
  for (let i = 0; i + 1 < js.length; i++) if (js[i + 1] - js[i] >= minLen) out.push({s0: js[i], s1: js[i + 1], a: f.at(js[i]).p, b: f.at(js[i + 1]).p});
  return out;
}
/** The Herengracht corner's cut (nr 21): its BAG edge and the diagonal the corner pier and beasts face (street and canal). */
export const CUT_CORNER = {a: [41.931, 15.909] as XZ, b: [42.987, 15.838] as XZ, mid: [42.459, 15.874] as XZ, n: [0.759, -0.652] as XZ};
