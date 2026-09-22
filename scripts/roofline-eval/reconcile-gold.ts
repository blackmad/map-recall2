/**
 * G1: run the roofline reconciler over every R1 gold elevation, using the
 * **scan** profiles (no photo methods are needed — G1 starts on scan data
 * per plan §7). Each elevation is fit with G2 (`classifyGable` +
 * `fitGableTemplate`, falling back to `fitGable`'s polyline per the author's
 * note in `gableFit.ts`: trust the template only when the classified type
 * isn't `unknown`), then reconciled against the cached 3DBAG LoD2.2 geometry
 * for that building.
 *
 * Reports relation-class counts and patch triangle counts per elevation, and
 * writes one elevation-view SVG per elevation plus a contact sheet to
 * `review-data/roofline-gold/v1/g1/`.
 *
 * Usage: npx tsx scripts/roofline-eval/reconcile-gold.ts
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFacadeWallPlanes, extractRoofPlanes, type FacadeWallPlane, type RoofPlane } from '../../src/canalRecall/building/facadePointCloud.ts';
import { classifyGable, gableFeatures, type GableType } from '../../src/canalRecall/facade/gable.ts';
import { fitGable, fitGableTemplate, type GableProfileSample } from '../../src/canalRecall/facade/gableFit.ts';
import {
  reconcile,
  fittedGableFrom,
  fittedGableFromTemplate,
  FACADE_TOP_DEPTH_M,
  SLAB_DEPTH_M,
  type BuildingPartSurface,
  type ProfileSample,
  type Relation,
  type RoofReconcileResult,
  type FittedGable,
} from '../../src/canalRecall/facade/roofReconcile.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const POINTCLOUD_DIR = path.join(ROOFLINE_CACHE, 'pointcloud');
const GOLD_PATH = path.resolve('review-data/roofline-gold/v1/measured.json');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1/g1');

type GoldPoint = { x: number; y: number };
type GoldElevation = {
  id: string;
  tile: string;
  buildingId: string;
  widthM: number;
  plane: { start: GoldPoint; end: GoldPoint; baseZ: number; topZ: number };
  surfaceIds: string[];
  profile: Array<{ along: number; up: number | null }>;
  shape: string;
};
type GoldFile = { schemaVersion: number; sampleM: number; elevations: GoldElevation[] };

// --- load gold ---------------------------------------------------------------
const gold = JSON.parse(await readFile(GOLD_PATH, 'utf8')) as GoldFile;
if (!Array.isArray(gold.elevations) || gold.elevations.length === 0) {
  throw new Error(`${GOLD_PATH}: no elevations[] — premise false, stopping`);
}
process.stdout.write(`G1 reconcile — ${gold.elevations.length} gold elevations from ${GOLD_PATH}\n`);

// --- load the Oud-Zuid 3DBAG scan-tile caches ---------------------------------
type CityJsonResponse = { metadata?: { transform?: { scale?: number[]; translate?: number[] } }; feature?: unknown };
const cacheFiles = (await readdir(POINTCLOUD_DIR)).filter((f) => /^3dbag-.*\.json$/.test(f));
if (cacheFiles.length === 0) throw new Error(`${POINTCLOUD_DIR}: no 3dbag-*.json caches — premise false, stopping`);

const responsesByBuildingId = new Map<string, CityJsonResponse>();
for (const file of cacheFiles) {
  const parsed = JSON.parse(await readFile(path.join(POINTCLOUD_DIR, file), 'utf8')) as { features?: Array<CityJsonResponse & { response?: CityJsonResponse }> };
  for (const entry of parsed.features ?? []) {
    const response = entry.response ?? entry;
    const walls = extractFacadeWallPlanes(response as any);
    const id = walls[0]?.buildingId ?? null;
    if (id) responsesByBuildingId.set(id, response);
  }
}
process.stdout.write(`  loaded ${responsesByBuildingId.size} buildings from ${cacheFiles.length} cache file(s) in ${POINTCLOUD_DIR}\n`);

// --- gable fit adapter (G2): classify, then trust the template only for a known type ---
function fillNullsLinear(profile: readonly (number | null)[]): number[] {
  const filled = [...profile];
  const firstIndex = filled.findIndex((v) => v != null);
  const lastIndex = filled.length - 1 - [...filled].reverse().findIndex((v) => v != null);
  if (firstIndex === -1) return filled.map(() => 0);
  for (let i = 0; i < firstIndex; i += 1) filled[i] = filled[firstIndex];
  for (let i = lastIndex + 1; i < filled.length; i += 1) filled[i] = filled[lastIndex];
  let i = firstIndex;
  while (i < lastIndex) {
    if (filled[i] != null) {
      i += 1;
      continue;
    }
    let j = i;
    while (filled[j] == null) j += 1;
    const left = filled[i - 1] as number;
    const right = filled[j] as number;
    for (let k = i; k < j; k += 1) filled[k] = left + ((right - left) * (k - (i - 1))) / (j - (i - 1));
    i = j;
  }
  return filled as number[];
}

/**
 * A template is only worth trusting when it actually tracks the measured
 * profile. `fitGableTemplate`/`fitGable`'s own 30%-margin check (in
 * `gableFit.ts`) only asks "does the template beat a polyline, adjusted for
 * vertex count" — it says nothing about the *absolute* error, so a template
 * can "win" that contest while still being a poor fit in metres (case in
 * point: `0pc8wr2`'s halsgevel, 2.14 m RMS error, visibly wrong on the
 * contact sheet). This is G1's own gate on top of G2's: reject a template
 * fit whose absolute error exceeds this and fall back to the profile
 * polyline instead.
 */
const MAX_TEMPLATE_FIT_ERROR_M = 0.3;

function fitGableForElevation(
  e: GoldElevation,
  sampleM: number,
): { type: GableType; method: string; fitErrorM: number | null; fitted: FittedGable; templateRejected: { type: GableType; fitErrorM: number } | null } {
  const heights = fillNullsLinear(e.profile.map((s) => s.up));
  const reading = classifyGable(gableFeatures({ profile: heights, plotWidthM: e.widthM, sampleM }));
  const samples: GableProfileSample[] = e.profile.map((s) => [s.along, s.up]);

  if (reading.type !== 'unknown') {
    const templateFit = fitGableTemplate({ profile: samples, type: reading.type, sampleM });
    if (templateFit) {
      if (templateFit.fitErrorM <= MAX_TEMPLATE_FIT_ERROR_M) {
        return { type: templateFit.type, method: 'template', fitErrorM: templateFit.fitErrorM, fitted: fittedGableFromTemplate(templateFit), templateRejected: null };
      }
      // Fall through to the polyline fallback below, but record the rejection.
      const polyFit = fitGable({ profile: samples, type: reading.type, sampleM });
      return {
        type: polyFit.type,
        method: polyFit.method,
        fitErrorM: polyFit.fitErrorM,
        fitted: fittedGableFrom(polyFit),
        templateRejected: { type: templateFit.type, fitErrorM: templateFit.fitErrorM },
      };
    }
  }
  // Unknown/ambiguous type, or the template fit couldn't be computed: the
  // polyline fallback (fitGable always returns a usable outline).
  const polyFit = fitGable({ profile: samples, type: reading.type, sampleM });
  return { type: polyFit.type, method: polyFit.method, fitErrorM: polyFit.fitErrorM, fitted: fittedGableFrom(polyFit), templateRejected: null };
}

// --- reconcile each elevation --------------------------------------------------
type Row = {
  elevation: GoldElevation;
  gableType: GableType;
  gableMethod: string;
  fitErrorM: number | null;
  fitted: FittedGable;
  templateRejected: { type: GableType; fitErrorM: number } | null;
  result: RoofReconcileResult;
  /** Diagnostic-only: relationSpans/conflicts reclassified against the 1 m slab section instead of facade-top. Not used to build patches. */
  resultSlab: RoofReconcileResult;
};

const rows: Row[] = [];
for (const e of gold.elevations) {
  const response = responsesByBuildingId.get(e.buildingId);
  if (!response) throw new Error(`${e.id}: no cached 3DBAG response for ${e.buildingId} — premise false, stopping`);

  const walls: FacadeWallPlane[] = extractFacadeWallPlanes(response as any).filter((w) => w.buildingId === e.buildingId);
  const roofs: RoofPlane[] = extractRoofPlanes(response as any).filter((r) => r.buildingId === e.buildingId);
  if (walls.length === 0) throw new Error(`${e.id}: 3DBAG cache has no WallSurfaces for ${e.buildingId} — premise false, stopping`);

  const wallIds = new Set(walls.map((w) => w.surfaceId));
  const missingSurfaceIds = e.surfaceIds.filter((id) => !wallIds.has(id));
  if (missingSurfaceIds.length > 0) {
    throw new Error(`${e.id}: gold surfaceIds ${JSON.stringify(missingSurfaceIds)} do not match any cached 3DBAG WallSurface — the gold plane does not lie on a 3DBAG wall; premise false, stopping`);
  }

  const surfaces: BuildingPartSurface[] = [
    ...walls.map((w) => ({ id: w.surfaceId, vertices: w.vertices })),
    ...roofs.map((r) => ({ id: r.surfaceId, vertices: r.vertices })),
  ];

  const { type, method, fitErrorM, fitted, templateRejected } = fitGableForElevation(e, gold.sampleM);
  const profile: ProfileSample[] = e.profile;
  const result = reconcile({
    buildingId: e.buildingId,
    surfaces,
    plane: { start: e.plane.start, end: e.plane.end },
    profile,
    sampleM: gold.sampleM,
    gable: fitted,
    sectionDepthM: FACADE_TOP_DEPTH_M,
  });
  // Diagnostic-only run: classify against the 1 m slab instead, to show how
  // much of the `below`/`rises` split above is really "a pitched roof lifts
  // the slab" rather than "3DBAG has no gable here."
  const resultSlab = reconcile({
    buildingId: e.buildingId,
    surfaces,
    plane: { start: e.plane.start, end: e.plane.end },
    profile,
    sampleM: gold.sampleM,
    gable: fitted,
    sectionDepthM: SLAB_DEPTH_M,
  });
  rows.push({ elevation: e, gableType: type, gableMethod: method, fitErrorM, fitted, templateRejected, result, resultSlab });
  if (templateRejected) {
    process.stdout.write(
      `  ${e.id}: rejected ${templateRejected.type} template (fit ${templateRejected.fitErrorM.toFixed(2)} m > ${MAX_TEMPLATE_FIT_ERROR_M} m gate) — using the polyline fallback instead\n`,
    );
  }
}

// --- report ---------------------------------------------------------------------
const relationOrder: Relation[] = ['agree', 'rises', 'below', 'unknown'];
process.stdout.write(`\nper-elevation relation counts (columns) and patch triangles:\n`);
process.stdout.write(`${'elevation'.padEnd(46)} ${'gable'.padEnd(12)} ${relationOrder.map((r) => r.padStart(7)).join(' ')} ${'triangles'.padStart(10)} ${'conflicts'.padStart(10)}\n`);

const countsByRelation = (result: RoofReconcileResult) => {
  const counts: Record<Relation, number> = { agree: 0, rises: 0, below: 0, unknown: 0 };
  for (const span of result.relationSpans) {
    const columns = Math.round((span.toAlong - span.fromAlong) / gold.sampleM) + 1;
    counts[span.relation] += columns;
  }
  return counts;
};

let totalTriangles = 0;
const totals: Record<Relation, number> = { agree: 0, rises: 0, below: 0, unknown: 0 };
let totalConflicts = 0;
for (const row of rows) {
  const counts = countsByRelation(row.result);
  for (const r of relationOrder) totals[r] += counts[r];
  const triangles = row.result.patch ? row.result.patch.reduce((sum, s) => sum + s.triangles.length, 0) : 0;
  totalTriangles += triangles;
  totalConflicts += row.result.conflicts.length;
  process.stdout.write(
    `${row.elevation.id.padEnd(46)} ${`${row.gableType}/${row.gableMethod}`.padEnd(12)} ${relationOrder.map((r) => String(counts[r]).padStart(7)).join(' ')} ${String(triangles).padStart(10)} ${String(row.result.conflicts.length).padStart(10)}\n`,
  );
}
process.stdout.write(`${'TOTAL'.padEnd(46)} ${''.padEnd(12)} ${relationOrder.map((r) => String(totals[r]).padStart(7)).join(' ')} ${String(totalTriangles).padStart(10)} ${String(totalConflicts).padStart(10)}\n`);

// Diagnostic: the same relation table, but against the 1 m slab section
// instead of the facade-top (0.15 m) section used above.
process.stdout.write(`\ndiagnostic — same relation counts against the ${SLAB_DEPTH_M} m slab section (not used for patches):\n`);
process.stdout.write(`${'elevation'.padEnd(46)} ${relationOrder.map((r) => r.padStart(7)).join(' ')}\n`);
const totalsSlab: Record<Relation, number> = { agree: 0, rises: 0, below: 0, unknown: 0 };
for (const row of rows) {
  const counts = countsByRelation(row.resultSlab);
  for (const r of relationOrder) totalsSlab[r] += counts[r];
  process.stdout.write(`${row.elevation.id.padEnd(46)} ${relationOrder.map((r) => String(counts[r]).padStart(7)).join(' ')}\n`);
}
process.stdout.write(`${'TOTAL'.padEnd(46)} ${relationOrder.map((r) => String(totalsSlab[r]).padStart(7)).join(' ')}\n`);

for (const row of rows) {
  for (const conflict of row.result.conflicts) {
    process.stdout.write(`  conflict ${row.elevation.id} [${conflict.fromAlong.toFixed(2)}, ${conflict.toAlong.toFixed(2)}] ${conflict.kind}: ${conflict.note}\n`);
  }
}

// --- SVG rendering -----------------------------------------------------------
function svgElevation(row: Row, width: number, height: number): { body: string; minUp: number; maxUp: number } {
  const { elevation, result } = row;
  const alongs = elevation.profile.map((s) => s.along);
  const alongMax = Math.max(...alongs, 1e-6);
  const allUps = [
    ...elevation.profile.map((s) => s.up).filter((v): v is number => v != null),
    ...result.section.map((s) => s.up).filter((v): v is number => v != null),
    ...row.resultSlab.section.map((s) => s.up).filter((v): v is number => v != null),
  ];
  const minUp = Math.min(...allUps) - 0.3;
  const maxUp = Math.max(...allUps) + 0.3;
  const marginL = 46;
  const marginB = 20;
  const marginT = 10;
  const marginR = 10;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;
  const xOf = (along: number) => marginL + (along / alongMax) * plotW;
  const yOf = (up: number) => marginT + plotH - ((up - minUp) / (maxUp - minUp)) * plotH;

  const polyline = (points: Array<[number, number | null]>, colour: string, strokeWidth: number, dash?: string) => {
    const segments: string[] = [];
    let current: string[] = [];
    for (const [along, up] of points) {
      if (up == null) {
        if (current.length > 1) segments.push(current.join(' '));
        current = [];
        continue;
      }
      current.push(`${xOf(along).toFixed(1)},${yOf(up).toFixed(1)}`);
    }
    if (current.length > 1) segments.push(current.join(' '));
    return segments.map((pts) => `<polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} />`).join('\n');
  };

  const sectionLine = polyline(result.section.map((s) => [s.along, s.up]), '#1f78b4', 2);
  const sectionSlabLine = polyline(row.resultSlab.section.map((s) => [s.along, s.up]), '#a6cee3', 1, '2,2');
  const profileLine = polyline(elevation.profile.map((s) => [s.along, s.up]), '#e31a1c', 1.6, '4,2');
  const outlineLine = polyline(row.fitted.trace.map((p) => [p[0], p[1]] as [number, number | null]), '#33a02c', 1.4);

  // Patch top/bottom curves: front-face vertices (depth == 0, the along-tangent
  // basis vector has y == 0 in the plane frame we build surfaces in) split into
  // the top chain (max z per along) and bottom chain (the screen's floor,
  // which by construction sits exactly on S).
  const patchLines = (result.patch ?? [])
    .map((surface) => {
      const start = elevation.plane.start;
      const tangent = { x: elevation.plane.end.x - start.x, y: elevation.plane.end.y - start.y };
      const tangentLen = Math.hypot(tangent.x, tangent.y) || 1;
      const unitTangent = { x: tangent.x / tangentLen, y: tangent.y / tangentLen };
      const byAlong = new Map<number, { min: number; max: number }>();
      for (const v of surface.vertices) {
        const along = Math.round(((v[0] - start.x) * unitTangent.x + (v[1] - start.y) * unitTangent.y) * 1000) / 1000;
        const entry = byAlong.get(along) ?? { min: v[2], max: v[2] };
        entry.min = Math.min(entry.min, v[2]);
        entry.max = Math.max(entry.max, v[2]);
        byAlong.set(along, entry);
      }
      const sortedAlongs = [...byAlong.keys()].sort((a, b) => a - b);
      const top = polyline(sortedAlongs.map((a) => [a, byAlong.get(a)!.max] as [number, number]), '#ff7f00', 2);
      const bottom = polyline(sortedAlongs.map((a) => [a, byAlong.get(a)!.min] as [number, number]), '#ff7f00', 1, '1,1.5');
      return `${top}\n${bottom}`;
    })
    .join('\n');

  const axisTicks: string[] = [];
  for (let a = 0; a <= alongMax + 1e-9; a += 1) {
    axisTicks.push(`<line x1="${xOf(a).toFixed(1)}" y1="${marginT}" x2="${xOf(a).toFixed(1)}" y2="${marginT + plotH}" stroke="#eee" stroke-width="1" />`);
  }
  const legend = `
    <rect x="${width - 170}" y="4" width="10" height="3" fill="#1f78b4" /><text x="${width - 156}" y="9" font-size="9" fill="#333">3DBAG S (facade-top 0.15m)</text>
    <rect x="${width - 170}" y="14" width="10" height="3" fill="#a6cee3" /><text x="${width - 156}" y="19" font-size="9" fill="#333">3DBAG S (1m slab, diagnostic)</text>
    <rect x="${width - 170}" y="24" width="10" height="3" fill="#e31a1c" /><text x="${width - 156}" y="29" font-size="9" fill="#333">scan profile P</text>
    <rect x="${width - 170}" y="34" width="10" height="3" fill="#33a02c" /><text x="${width - 156}" y="39" font-size="9" fill="#333">fitted outline</text>
    <rect x="${width - 170}" y="44" width="10" height="3" fill="#ff7f00" /><text x="${width - 156}" y="49" font-size="9" fill="#333">patch top/bottom</text>
  `;

  const body = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" stroke="#ccc" />
    ${axisTicks.join('\n')}
    ${outlineLine}
    ${sectionSlabLine}
    ${sectionLine}
    ${profileLine}
    ${patchLines}
    ${legend}
    <text x="${marginL}" y="${height - 4}" font-size="9" fill="#333">along (m), 0..${alongMax.toFixed(1)}</text>
  `;
  return { body, minUp, maxUp };
}

function svgDocument(title: string, body: string, width: number, height: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n<title>${title}</title>\n${body}\n</svg>\n`;
}

await mkdir(OUT_DIR, { recursive: true });

const ELEV_W = 640;
const ELEV_H = 260;
const perElevationSvgPaths: string[] = [];
for (const row of rows) {
  const { body } = svgElevation(row, ELEV_W, ELEV_H);
  const svg = svgDocument(row.elevation.id, body, ELEV_W, ELEV_H);
  const file = path.join(OUT_DIR, `${row.elevation.id.replace(/[:]/g, '_')}.svg`);
  await writeFile(file, svg);
  perElevationSvgPaths.push(file);
}

// Contact sheet: tile every elevation's plot into one big SVG.
const COLS = 2;
const sheetRows = Math.ceil(rows.length / COLS);
const cellW = ELEV_W;
const cellH = ELEV_H + 24;
const sheetW = COLS * cellW;
const sheetH = sheetRows * cellH;
const groups = rows
  .map((row, i) => {
    const col = i % COLS;
    const line = Math.floor(i / COLS);
    const { body } = svgElevation(row, ELEV_W, ELEV_H);
    const x = col * cellW;
    const y = line * cellH;
    return `<g transform="translate(${x}, ${y + 20})">${body}</g><text x="${x + 4}" y="${y + 14}" font-size="12" font-weight="bold" fill="#111">${row.elevation.id} — ${row.gableType}/${row.gableMethod}${row.fitErrorM != null ? ` (fit ${row.fitErrorM.toFixed(2)} m)` : ''}</text>`;
  })
  .join('\n');
const contactSheet = svgDocument('G1 reconciliation contact sheet', groups, sheetW, sheetH);
const contactSheetPath = path.join(OUT_DIR, 'contact-sheet.svg');
await writeFile(contactSheetPath, contactSheet);

// --- write patch JSON ------------------------------------------------------------
const patchesJson = rows.map((row) => ({
  id: row.elevation.id,
  buildingId: row.elevation.buildingId,
  gable: { type: row.gableType, method: row.gableMethod, fitErrorM: row.fitErrorM },
  relationSpans: row.result.relationSpans,
  conflicts: row.result.conflicts,
  provenance: row.result.provenance,
  patch: row.result.patch,
}));
const patchesPath = path.join(OUT_DIR, 'patches.json');
await writeFile(patchesPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: GOLD_PATH, elevations: patchesJson }, null, 2)}\n`);

process.stdout.write(`\nwrote ${rows.length} elevation SVGs, ${contactSheetPath}, ${patchesPath}\n`);
