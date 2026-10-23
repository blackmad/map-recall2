// Where each ground triangle came from (diagnostics only; lane roads-diagnose 2026-10-23).
//
// User 2026-10-23: "our roads still look like shit: too many weird gaps and strange paints and multiple lanes where
// people don't expect". The built cell keeps one mesh per palette layer, so a red pixel does not say whether it is a
// BGT fietspad, a fietsstraat section, an OSM cycle-lane ribbon or a fallback band. With tracing on, the builders mark
// each mesh as they write to it (`traceMark`: from this triangle on, source S) and buildCell returns, per layer, one
// source code per triangle (BuiltCell.sources). Off (the default, and always in the game) every call is a no-op and
// the build is byte-identical: scripts/own-ground/render-road-sources.ts is the only caller of `setSourceTracing`.

import type { MeshArrays } from './drape.js';

/** Sources, in the order of their codes (code = index + 1; 0 = untraced). */
export const GROUND_SOURCES = [
  'land', // the relief grid: bare land
  'osmArea', // OSM area fills (squares, parking, area:highway, green fills)
  'park', // BGT parks-v1 surfaces and courtyards-v1
  'bgtCarriage', 'bgtParking', 'bgtFoot', 'bgtPedestrian', 'bgtCycle', 'bgtDriveway', // roads-v1 wegdeel polygons by class
  'bgtIsland', 'bgtBerm', 'bgtVerge', 'bgtSquare', // roads-v1 ondersteunendwegdeel islands and berms, verhard squares (roadCells ancillaryClass)
  'fietsstraat', // a roads-v1 rijbaan section the extract paints red (roadCells fietsstraatSection)
  'bgtKerb', // roads-v1 kerb faces, lines and their bollards
  'band', // OSM street bands (ways the survey does not cover, the far ring, cells without the extract), their kerbs
  'junctionFill', // OSM junction polygons and kerb corner patches (nodes off the survey)
  'laneRibbon', // red cycleway=lane ribbons of covered carriageways (streets.ts laneRibbon)
  'cyclePaint', // red band pieces of part-covered ways on a rijbaan / parkeervlak (none since R2 2026-10-23: such ways yield there)
  'cycleCross', // cycle crossings: red strips and their blocks (surveyMarkings, streets cyclePathCrossings)
  'nodePaint', // survey paint placed from mapped evidence: crossing nodes / crossing ways, signal, stop and give-way nodes
  'graphPaint', // survey paint inferred from the graph: junction-mouth teeth, centre dashes
  'bandPaint', // streets.ts paint: lane lines from the way's section, junction stop lines / teeth, lane links
  'rails', // tram rails
  'pocket', // pockets.ts fills (junction pockets and survey-gap discs)
  'water', 'quay', 'deck', // water surface, quay walls, deck tops and bodies
  'other',
  'photoPaint', // survey paint the orthophoto backs (photoEvidence.ts: centre dashes on the photo's line); appended, codes stay
] as const;
export type GroundSource = (typeof GROUND_SOURCES)[number];
export const sourceCode = (s: GroundSource): number => GROUND_SOURCES.indexOf(s) + 1;
export const sourceOfCode = (c: number): GroundSource | null => (c > 0 ? GROUND_SOURCES[c - 1] ?? null : null);

let marks: WeakMap<MeshArrays, { tri: number; code: number }[]> | null = null;

/** Turn tracing on or off (off drops every mark). */
export function setSourceTracing(on: boolean): void { marks = on ? new WeakMap() : null; }
export const sourceTracing = (): boolean => marks !== null;

/** From the next triangle written to `m` on, the source is `s` (no-op unless tracing). */
export function traceMark(m: MeshArrays, s: GroundSource): void {
  if (!marks) return;
  const list = marks.get(m) ?? (marks.set(m, []), marks.get(m)!);
  list.push({ tri: m.indices.length / 3, code: sourceCode(s) });
}

/**
 * One source code per triangle of `merge(list)`: each mesh's marks, and before its first mark (or with none) the
 * source it was added with (`fallback[i]`).
 */
export function triangleSources(list: readonly MeshArrays[], fallback: readonly GroundSource[]): Uint8Array {
  const total = list.reduce((n, m) => n + m.indices.length / 3, 0), out = new Uint8Array(total);
  let at = 0;
  list.forEach((m, i) => {
    const n = m.indices.length / 3, ms = marks?.get(m) ?? [];
    out.fill(sourceCode(fallback[i] ?? 'other'), at, at + n);
    ms.forEach((mk, j) => out.fill(mk.code, at + Math.min(n, mk.tri), at + Math.min(n, ms[j + 1]?.tri ?? n)));
    at += n;
  });
  return out;
}
