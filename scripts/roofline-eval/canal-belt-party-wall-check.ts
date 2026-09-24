/**
 * Test B (canal-belt `below` follow-up): a 3DBAG-only check for the
 * party-wall-inheritance mechanism the Oud-Zuid diagnosis suspected —
 * no photos, no point cloud, just the cached LoD2.2 geometry for the 90
 * canal-belt panden in `3dbag-strips.json`.
 *
 * For every street-facing WallSurface of every pand: compare its top height
 * with (i) that pand's own RoofSurface maximum, and (ii) the roof maxima of
 * its neighbours *within this same 90-building cache* (a real limitation:
 * many true geometric neighbours of these panden were never fetched, so this
 * undercounts case (c) — it can only catch inheritance from a neighbour that
 * happens to also be in the strip set).
 *
 * Relation classes per wall:
 *   (a) normal    — wall top within 0.3 m of its own pand's roof max.
 *   (b) self-rise — wall top > 0.3 m above its own pand's roof max. 3DBAG's
 *                   canal-belt pilot claims this is 0 of 895 walls, so any
 *                   hit here is worth a second look regardless of (c).
 *   (c) inherited — wall top > 0.5 m above its own roof max AND within
 *                   0.3 m of a *taller* neighbour's roof max — the
 *                   party-wall-inheritance signature.
 *
 * Usage: npx tsx scripts/roofline-eval/canal-belt-party-wall-check.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFacadeWallPlanes, extractRoofPlanes, type FacadeWallPlane, type RoofPlane } from '../../src/canalRecall/building/facadePointCloud.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const BAG_CACHE_PATH = path.join(ROOFLINE_CACHE, 'roofline-eval', '3dbag', '3dbag-strips.json');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1/g1/canal-belt');

const OWN_ROOF_TOLERANCE_M = 0.3;
const SELF_RISE_TOLERANCE_M = 0.3;
const INHERITED_ABOVE_OWN_M = 0.5;
const INHERITED_NEIGHBOUR_TOLERANCE_M = 0.3;
const NEIGHBOUR_EDGE_DISTANCE_M = 0.5;
const NEIGHBOUR_CENTROID_DISTANCE_M = 15;

type Point2 = { x: number; y: number };
const dist2 = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);

type BuildingGeom = {
  buildingId: string;
  pandId: string;
  walls: FacadeWallPlane[];
  roofs: RoofPlane[];
  ownRoofMax: number | null;
  centroid: Point2;
  footprintVertices: Point2[]; // every wall vertex's XY, for edge-distance neighbour test
  maaiveld: number | null; // b3_h_maaiveld: ground level, NAP
  bouwlagen: number | null; // b3_bouwlagen: storey count — an independent height reference, from BAG registration, not from 3DBAG's own roof reconstruction
  expectedRoofMax: number | null; // maaiveld + bouwlagen * FLOOR_HEIGHT_M + ATTIC_ALLOWANCE_M
};

/** Typical Amsterdam canal-house floor-to-floor height. Coarse on purpose — this is a plausibility check, not a measurement. */
const FLOOR_HEIGHT_M = 3.0;
/** Roof pitch / attic allowance above the top storey's own ceiling. */
const ATTIC_ALLOWANCE_M = 2.5;
/** How far above the bouwlagen-based expectation counts as "the roof looks taller than its own storey count explains". */
const EXPECTED_HEIGHT_EXCESS_M = 2.0;

function buildingAttributes(response: any): { maaiveld: number | null; bouwlagen: number | null } {
  const cityObjects = response?.feature?.CityObjects ?? {};
  for (const object of Object.values(cityObjects) as any[]) {
    if (object?.type === 'Building') {
      const attrs = object.attributes ?? {};
      const maaiveld = typeof attrs.b3_h_maaiveld === 'number' ? attrs.b3_h_maaiveld : null;
      const bouwlagen = typeof attrs.b3_bouwlagen === 'number' ? attrs.b3_bouwlagen : null;
      return { maaiveld, bouwlagen };
    }
  }
  return { maaiveld: null, bouwlagen: null };
}

const bagCache = JSON.parse(await readFile(BAG_CACHE_PATH, 'utf8')) as { features: Array<{ pandId: string; response: any }> };
const buildings: BuildingGeom[] = [];
for (const feature of bagCache.features) {
  const buildingId = `bag:${feature.pandId}`;
  const walls = extractFacadeWallPlanes(feature.response).filter((w) => w.buildingId === buildingId);
  const roofs = extractRoofPlanes(feature.response).filter((r) => r.buildingId === buildingId);
  if (walls.length === 0) continue;
  const footprintVertices: Point2[] = walls.flatMap((w) => w.vertices.map((v) => ({ x: v[0], y: v[1] })));
  let sx = 0;
  let sy = 0;
  for (const p of footprintVertices) {
    sx += p.x;
    sy += p.y;
  }
  const centroid: Point2 = { x: sx / footprintVertices.length, y: sy / footprintVertices.length };
  const ownRoofMax = roofs.length ? Math.max(...roofs.flatMap((r) => r.vertices.map((v) => v[2]))) : null;
  const { maaiveld, bouwlagen } = buildingAttributes(feature.response);
  const expectedRoofMax = maaiveld != null && bouwlagen != null ? maaiveld + bouwlagen * FLOOR_HEIGHT_M + ATTIC_ALLOWANCE_M : null;
  buildings.push({ buildingId, pandId: feature.pandId, walls, roofs, ownRoofMax, centroid, footprintVertices, maaiveld, bouwlagen, expectedRoofMax });
}
process.stdout.write(`Test B — 3DBAG-only party-wall-inheritance check, ${buildings.length} canal-belt panden from ${BAG_CACHE_PATH}\n`);
const noRoof = buildings.filter((b) => b.ownRoofMax == null).length;
if (noRoof) process.stdout.write(`  ${noRoof} panden have no RoofSurface at all (excluded from own-roof comparisons)\n`);

// --- neighbours: within this same 90-building cache only (stated limitation) ---
function minEdgeDistance(a: BuildingGeom, b: BuildingGeom): number {
  let min = Infinity;
  // Coarse but adequate at this scale: vertex-to-vertex, not full segment
  // distance — footprint corners are where party walls actually meet.
  for (const p of a.footprintVertices) {
    for (const q of b.footprintVertices) {
      const d = dist2(p, q);
      if (d < min) min = d;
    }
  }
  return min;
}
const neighboursOf = new Map<string, BuildingGeom[]>();
for (const a of buildings) {
  const neighbours: BuildingGeom[] = [];
  for (const b of buildings) {
    if (a === b) continue;
    const centroidD = dist2(a.centroid, b.centroid);
    if (centroidD <= NEIGHBOUR_CENTROID_DISTANCE_M || minEdgeDistance(a, b) <= NEIGHBOUR_EDGE_DISTANCE_M) neighbours.push(b);
  }
  neighboursOf.set(a.buildingId, neighbours);
}

type WallRow = {
  buildingId: string;
  pandId: string;
  surfaceId: string;
  wallTop: number;
  ownRoofMax: number | null;
  relation: 'normal' | 'self-rise' | 'inherited' | 'unclassified';
  neighbourPandId: string | null;
  neighbourRoofMax: number | null;
};

const rows: WallRow[] = [];
for (const building of buildings) {
  const neighbours = neighboursOf.get(building.buildingId) ?? [];
  for (const wall of building.walls) {
    const wallTop = Math.max(...wall.vertices.map((v) => v[2]));
    let relation: WallRow['relation'] = 'unclassified';
    let neighbourPandId: string | null = null;
    let neighbourRoofMax: number | null = null;

    if (building.ownRoofMax != null) {
      const aboveOwn = wallTop - building.ownRoofMax;
      if (Math.abs(aboveOwn) <= OWN_ROOF_TOLERANCE_M) {
        relation = 'normal';
      } else if (aboveOwn > SELF_RISE_TOLERANCE_M) {
        relation = 'self-rise';
        if (aboveOwn > INHERITED_ABOVE_OWN_M) {
          // Look for a taller neighbour whose own roof max nearly equals this wall's top.
          let best: { pandId: string; roofMax: number; diff: number } | null = null;
          for (const n of neighbours) {
            if (n.ownRoofMax == null) continue;
            if (n.ownRoofMax <= building.ownRoofMax) continue; // must be taller
            const diff = Math.abs(wallTop - n.ownRoofMax);
            if (diff <= INHERITED_NEIGHBOUR_TOLERANCE_M && (!best || diff < best.diff)) {
              best = { pandId: n.pandId, roofMax: n.ownRoofMax, diff };
            }
          }
          if (best) {
            relation = 'inherited';
            neighbourPandId = best.pandId;
            neighbourRoofMax = best.roofMax;
          }
        }
      } else {
        relation = 'normal'; // below own roof by more than tolerance is still "not rising above it" — the plan's own-roof-only concern is the >0.3m-above case.
      }
    }

    rows.push({ buildingId: building.buildingId, pandId: building.pandId, surfaceId: wall.surfaceId, wallTop, ownRoofMax: building.ownRoofMax, relation, neighbourPandId, neighbourRoofMax });
  }
}

const counts = { normal: 0, 'self-rise': 0, inherited: 0, unclassified: 0 };
for (const row of rows) counts[row.relation] += 1;
process.stdout.write(`\n${rows.length} street-facing walls checked:\n`);
process.stdout.write(`  (a) normal (top ~= own roof max, +-${OWN_ROOF_TOLERANCE_M} m):        ${counts.normal}\n`);
process.stdout.write(`  (b) self-rise (top > own roof max + ${SELF_RISE_TOLERANCE_M} m):          ${counts['self-rise']}\n`);
process.stdout.write(`  (c) inherited (self-rise AND matches a taller neighbour's roof, +-${INHERITED_NEIGHBOUR_TOLERANCE_M} m): ${counts.inherited}\n`);
process.stdout.write(`  unclassified (no own RoofSurface to compare against):        ${counts.unclassified}\n`);

const inheritedRows = rows.filter((r) => r.relation === 'inherited').sort((a, b) => b.wallTop - (b.ownRoofMax ?? 0) - (a.wallTop - (a.ownRoofMax ?? 0)));
if (inheritedRows.length) {
  process.stdout.write(`\ninherited (case c) walls, largest excess-above-own-roof first:\n`);
  for (const r of inheritedRows) {
    process.stdout.write(
      `  ${r.pandId} ${r.surfaceId}: wallTop ${r.wallTop.toFixed(2)} m, own roof ${r.ownRoofMax!.toFixed(2)} m (+${(r.wallTop - r.ownRoofMax!).toFixed(2)} m), neighbour ${r.neighbourPandId} roof ${r.neighbourRoofMax!.toFixed(2)} m (diff ${Math.abs(r.wallTop - r.neighbourRoofMax!).toFixed(2)} m)\n`,
    );
  }
}
const selfRiseOnly = rows.filter((r) => r.relation === 'self-rise');
if (selfRiseOnly.length) {
  process.stdout.write(`\nself-rise (case b) walls that did NOT match a cached neighbour (no case-c match found, still notable per 3DBAG's own 0/895 claim):\n`);
  for (const r of selfRiseOnly) {
    process.stdout.write(`  ${r.pandId} ${r.surfaceId}: wallTop ${r.wallTop.toFixed(2)} m, own roof ${r.ownRoofMax!.toFixed(2)} m (+${(r.wallTop - r.ownRoofMax!).toFixed(2)} m)\n`);
  }
}

// --- Test B2 (supplementary, not literally asked for): why (b)/(c) came back
// 0/1767 is structural, not necessarily evidence against inheritance — LoD2.2
// defines a WallSurface's top edge from the roof surfaces immediately above
// it, so wallTop == ownRoofMax holds close to by construction; "does the wall
// disagree with its own roof" can never see a case where the *whole* roof
// (wall included) was reconstructed too tall. What CAN be tested with 3DBAG
// attributes alone, independent of any neighbour: b3_bouwlagen (BAG-recorded
// storey count, not derived from 3DBAG's own roof reconstruction) plus
// b3_h_maaiveld gives a rough expected roof height per building. A building
// whose own roof sits well above that expectation, AND whose roof height
// closely matches a neighbour's, is a genuine (if coarse) candidate for the
// party-wall-inheritance mechanism — this is what supplies the diagrams
// below when (c) itself is empty.
type B2Candidate = {
  pandId: string;
  ownRoofMax: number;
  expectedRoofMax: number;
  excessM: number;
  bouwlagen: number | null;
  neighbourPandId: string | null;
  neighbourRoofMax: number | null;
  neighbourDiffM: number | null;
};
const b2Candidates: B2Candidate[] = [];
for (const building of buildings) {
  if (building.ownRoofMax == null || building.expectedRoofMax == null) continue;
  const excessM = building.ownRoofMax - building.expectedRoofMax;
  if (excessM <= EXPECTED_HEIGHT_EXCESS_M) continue;
  const neighbours = neighboursOf.get(building.buildingId) ?? [];
  let best: { pandId: string; roofMax: number; diff: number } | null = null;
  for (const n of neighbours) {
    if (n.ownRoofMax == null) continue;
    const diff = Math.abs(building.ownRoofMax - n.ownRoofMax);
    if (diff <= INHERITED_NEIGHBOUR_TOLERANCE_M && (!best || diff < best.diff)) best = { pandId: n.pandId, roofMax: n.ownRoofMax, diff };
  }
  b2Candidates.push({
    pandId: building.pandId,
    ownRoofMax: building.ownRoofMax,
    expectedRoofMax: building.expectedRoofMax,
    excessM,
    bouwlagen: building.bouwlagen,
    neighbourPandId: best?.pandId ?? null,
    neighbourRoofMax: best?.roofMax ?? null,
    neighbourDiffM: best?.diff ?? null,
  });
}
b2Candidates.sort((a, b) => (b.neighbourPandId ? 1 : 0) - (a.neighbourPandId ? 1 : 0) || b.excessM - a.excessM);
process.stdout.write(
  `\nTest B2 (supplementary) — own roof vs. b3_bouwlagen-expected height (+${EXPECTED_HEIGHT_EXCESS_M} m excess threshold, floor height ${FLOOR_HEIGHT_M} m, attic allowance ${ATTIC_ALLOWANCE_M} m):\n`,
);
process.stdout.write(`  ${b2Candidates.length} of ${buildings.length} panden have a roof more than ${EXPECTED_HEIGHT_EXCESS_M} m above their bouwlagen-expected height\n`);
const b2WithNeighbourMatch = b2Candidates.filter((c) => c.neighbourPandId);
process.stdout.write(`  ${b2WithNeighbourMatch.length} of those also match a neighbour's own roof height within ${INHERITED_NEIGHBOUR_TOLERANCE_M} m (the inheritance candidate signature)\n`);
for (const c of b2Candidates.slice(0, 15)) {
  process.stdout.write(
    `    ${c.pandId}: roof ${c.ownRoofMax.toFixed(2)} m vs expected ${c.expectedRoofMax.toFixed(2)} m (bouwlagen ${c.bouwlagen ?? 'n/a'}), excess +${c.excessM.toFixed(2)} m` +
      (c.neighbourPandId ? `, matches neighbour ${c.neighbourPandId} roof ${c.neighbourRoofMax!.toFixed(2)} m (diff ${c.neighbourDiffM!.toFixed(2)} m)\n` : `, no neighbour match\n`),
  );
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, 'test-b-party-wall-check.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: BAG_CACHE_PATH,
      thresholds: { OWN_ROOF_TOLERANCE_M, SELF_RISE_TOLERANCE_M, INHERITED_ABOVE_OWN_M, INHERITED_NEIGHBOUR_TOLERANCE_M, NEIGHBOUR_EDGE_DISTANCE_M, NEIGHBOUR_CENTROID_DISTANCE_M, EXPECTED_HEIGHT_EXCESS_M, FLOOR_HEIGHT_M, ATTIC_ALLOWANCE_M },
      limitation: 'neighbours are drawn only from the 90 cached canal-belt panden, not the full canal-belt context; case (c) undercounts inheritance from an uncached neighbour. Test B2 is supplementary (not literally requested): it substitutes b3_bouwlagen for "own expected height" because wallTop==ownRoofMax holds structurally in LoD2.2, so the literal wall-vs-own-roof test cannot see a uniformly-too-tall roof.',
      buildingCount: buildings.length,
      wallCount: rows.length,
      counts,
      inherited: inheritedRows,
      selfRiseOnly,
      b2Candidates,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`\nwrote ${path.join(OUT_DIR, 'test-b-party-wall-check.json')}\n`);

// --- diagrams for the 3 clearest (c) cases ------------------------------------
// Literal (c) came back empty (see above) — draw from the B2 neighbour-matched
// candidates instead, reusing the same wall-vs-roof diagram shape but with the
// pand's tallest street-facing wall standing in for "the anomalous wall" and
// its own expected height added as a fourth reference line.
const clearest: WallRow[] =
  inheritedRows.length > 0
    ? inheritedRows.slice(0, 3)
    : b2WithNeighbourMatch.slice(0, 3).map((c) => {
        const building = buildings.find((b) => b.pandId === c.pandId)!;
        const tallestWall = building.walls.reduce((a, b) => (Math.max(...a.vertices.map((v) => v[2])) >= Math.max(...b.vertices.map((v) => v[2])) ? a : b));
        return {
          buildingId: building.buildingId,
          pandId: c.pandId,
          surfaceId: tallestWall.surfaceId,
          wallTop: Math.max(...tallestWall.vertices.map((v) => v[2])),
          ownRoofMax: c.ownRoofMax,
          relation: 'inherited',
          neighbourPandId: c.neighbourPandId,
          neighbourRoofMax: c.neighbourRoofMax,
        };
      });
function svgDiagram(row: WallRow, building: BuildingGeom, neighbour: BuildingGeom, wall: FacadeWallPlane): string {
  const width = 640;
  const height = 320;
  const planW = 300;
  const planH = height - 20;
  const allPts = [...building.footprintVertices, ...neighbour.footprintVertices];
  const minX = Math.min(...allPts.map((p) => p.x));
  const maxX = Math.max(...allPts.map((p) => p.x));
  const minY = Math.min(...allPts.map((p) => p.y));
  const maxY = Math.max(...allPts.map((p) => p.y));
  const pad = 4;
  const scale = Math.min((planW - 2 * pad) / Math.max(1e-6, maxX - minX), (planH - 2 * pad) / Math.max(1e-6, maxY - minY));
  const toPx = (p: Point2) => ({ x: pad + (p.x - minX) * scale, y: planH - pad - (p.y - minY) * scale });
  const ring = (verts: Point2[], colour: string, fill: string) => {
    // Convex hull is overkill at this scale; draw each wall's own 2-point edge as a thick line instead of trying to close a ring from scattered wall polygons.
    return verts.map((p) => `<circle cx="${toPx(p).x.toFixed(1)}" cy="${toPx(p).y.toFixed(1)}" r="1.5" fill="${colour}" />`).join('');
  };
  // The anomalous wall's own footprint edge: the two distinct XY corners of its polygon.
  const wallXY = [...new Map(wall.vertices.map((v) => [`${v[0].toFixed(2)},${v[1].toFixed(2)}`, { x: v[0], y: v[1] }])).values()];
  const wallA = toPx(wallXY[0]);
  const wallB = toPx(wallXY[wallXY.length - 1]);

  const planBody = `
    <text x="4" y="12" font-size="10" fill="#333">plan (XY, RD)</text>
    ${ring(building.footprintVertices, '#1f78b4', '')}
    ${ring(neighbour.footprintVertices, '#e31a1c', '')}
    <line x1="${wallA.x.toFixed(1)}" y1="${wallA.y.toFixed(1)}" x2="${wallB.x.toFixed(1)}" y2="${wallB.y.toFixed(1)}" stroke="#ff7f00" stroke-width="3" />
    <circle cx="${toPx(building.centroid).x.toFixed(1)}" cy="${toPx(building.centroid).y.toFixed(1)}" r="3" fill="#1f78b4" />
    <text x="${toPx(building.centroid).x.toFixed(1)}" y="${(toPx(building.centroid).y - 6).toFixed(1)}" font-size="8" fill="#1f78b4">${building.pandId.slice(-4)}</text>
    <circle cx="${toPx(neighbour.centroid).x.toFixed(1)}" cy="${toPx(neighbour.centroid).y.toFixed(1)}" r="3" fill="#e31a1c" />
    <text x="${toPx(neighbour.centroid).x.toFixed(1)}" y="${(toPx(neighbour.centroid).y - 6).toFixed(1)}" font-size="8" fill="#e31a1c">${neighbour.pandId.slice(-4)} (neighbour)</text>
  `;

  const elevX = planW + 20;
  const elevW = width - elevX - 10;
  const values = [building.ownRoofMax ?? 0, row.wallTop, row.neighbourRoofMax ?? 0, building.expectedRoofMax ?? building.ownRoofMax ?? 0];
  const minUp = Math.min(...values) - 1;
  const maxUp = Math.max(...values) + 1;
  const yOf = (up: number) => 20 + (height - 40) * (1 - (up - minUp) / (maxUp - minUp));
  const barLine = (up: number, colour: string, label: string, dy: number) => `
    <line x1="${elevX}" y1="${yOf(up).toFixed(1)}" x2="${elevX + elevW}" y2="${yOf(up).toFixed(1)}" stroke="${colour}" stroke-width="2" />
    <text x="${elevX + elevW - 4}" y="${(yOf(up) + dy).toFixed(1)}" font-size="9" fill="${colour}" text-anchor="end">${label} ${up.toFixed(2)} m</text>
  `;
  const elevBody = `
    <text x="${elevX}" y="12" font-size="10" fill="#333">elevation (NAP)</text>
    ${barLine(building.ownRoofMax ?? 0, '#1f78b4', "own roof max", -4)}
    ${barLine(row.wallTop, '#ff7f00', 'wall top', 14)}
    ${barLine(row.neighbourRoofMax ?? 0, '#e31a1c', "neighbour's own roof max", 14)}
    ${building.expectedRoofMax != null ? barLine(building.expectedRoofMax, '#33a02c', `expected (bouwlagen=${building.bouwlagen ?? 'n/a'})`, -4) : ''}
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n<title>${building.pandId} ${wall.surfaceId}</title>\n<rect width="${width}" height="${height}" fill="#fff" stroke="#ccc" />\n<line x1="${planW}" y1="0" x2="${planW}" y2="${height}" stroke="#eee" />\n${planBody}\n${elevBody}\n</svg>\n`;
}

const diagramPaths: string[] = [];
for (const row of clearest) {
  const building = buildings.find((b) => b.pandId === row.pandId)!;
  const neighbour = buildings.find((b) => b.pandId === row.neighbourPandId)!;
  const wall = building.walls.find((w) => w.surfaceId === row.surfaceId)!;
  const svg = svgDiagram(row, building, neighbour, wall);
  const file = path.join(OUT_DIR, `test-b-case-c-${row.pandId}.svg`);
  await writeFile(file, svg);
  diagramPaths.push(file);
}
if (diagramPaths.length) {
  process.stdout.write(`\nwrote ${diagramPaths.length} case-(c) diagrams:\n${diagramPaths.map((p) => `  ${p}`).join('\n')}\n`);
} else {
  process.stdout.write(`\nno case-(c) walls found — no diagrams to draw.\n`);
}
