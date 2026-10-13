/**
 * Builder-time attachment pass for windows, doors and trim.
 *
 * Landmark builders place window assemblies (surround + pane + mullions) a few centimetres off the wall they belong to, or sink them in
 * behind its surface; `geometryAudit.auditOpenings` reports both. This pass takes a builder's own geometry (never the exported GLB),
 * audits it, and moves each offending assembly rigidly along the wall normal so that it touches its wall:
 *
 *  - floating (gap above the touch tolerance, up to `maxFloat`): translate towards the closest host point, a hair further so the back of
 *    the assembly is embedded rather than kissing the wall;
 *  - buried (face hidden behind solid wall): translate outward along the wall normal by the distance to the covering surface plus a margin,
 *    up to `maxBuried` (a window sunk deeper than that needs a real reveal in the builder, so it is reported, not moved);
 *  - overhang and anything larger than the caps are left alone and counted as skipped.
 *
 * The audit is re-run after each pass because moving one assembly can expose another (two layers of cover). The input soup's `positions`
 * are mutated in place; triangles must own their vertices (a non-indexed soup) or at least not share them across assemblies.
 */
import {auditOpenings, GEOMETRY_THRESHOLDS, type GeometryAuditThresholds, type OpeningIssue} from './geometryAudit';
import {analyseSoup, DEFAULT_THRESHOLDS} from './glbQuality';
import type {MaterialSoup} from './facadeCompare';

export interface SnapOptions {
  /** Largest float (m) that is closed by moving the assembly (beyond 0.6 m the audit treats glazing as free-standing anyway). */
  maxFloat?: number;
  /** Largest outward move (m) used to lift a buried assembly clear of its wall. */
  maxBuried?: number;
  /** How far past the wall surface a snapped assembly's back is pushed (m): embedded, never kissing. */
  embed?: number;
  /** Margin (m) a lifted assembly clears the covering surface by. */
  clearMargin?: number;
  /** An assembly thinner than this (m) along the move is a sheet; it rests `sheetRest` (m) in front of the wall instead of embedding. */
  sheetThickness?: number;
  sheetRest?: number;
  /**
   * Opt-in: once everything else is snapped, an assembly still standing mostly (`minOutside` of its face) past the end of its wall, and
   * smaller than `maxExtent` m, is a window the builder placed across a wall step or corner: it is dropped (its triangles are listed in
   * `SnapReport.dropped` for the caller to remove) rather than left hanging in the air.
   */
  dropOverhang?: {minOutside: number; maxExtent: number};
  /**
   * Keep a lift of a buried assembly even when it then overhangs its wall (the default undoes it). For models whose recorded baseline
   * already carries overhang warnings and whose window is partly sunk in a wall that ends beside it: a window 40% visible and overhanging
   * reads better than a window half inside the masonry.
   */
  keepLiftOverhang?: boolean;
  /**
   * Opt-in: an assembly that is still `minHidden` (fraction of its face) or more behind solid wall after the lifts, and no larger than
   * `maxExtent` m, is invisible anyway (a window row left inside a roof mass or a thick parapet): it is dropped, like `dropOverhang`.
   */
  dropBuried?: {minHidden: number; maxExtent: number};
  passes?: number;
  th?: GeometryAuditThresholds;
}

export interface SnapReport {
  passes: number;
  floatingMoved: number;
  buriedMoved: number;
  /** Moves undone because the assembly ended up overhanging its wall or sunk into it. */
  reverted: number;
  /** Issues beyond the caps or of kinds this pass does not move (overhang), in the last pass. */
  skipped: {floating: number; buried: number; overhang: number};
  /** Triangles of assemblies dropped by `dropOverhang` (soup indices); the caller removes them from its geometry. */
  dropped: number[];
  /** Centres of the dropped assemblies, for the build log. */
  droppedAt: [number, number, number][];
}

export function snapOpenings(soup: MaterialSoup, opts: SnapOptions = {}): SnapReport {
  const {maxFloat = 0.6, maxBuried = 0.6, embed = 0.02, clearMargin = 0.03, dropOverhang, dropBuried, keepLiftOverhang = false, passes = 4, sheetThickness = 0.02, sheetRest = 0.02, th: thOpt = GEOMETRY_THRESHOLDS} = opts;
  const th = thOpt;
  const P = soup.positions, I = soup.indices;
  const report: SnapReport = {passes: 0, floatingMoved: 0, buriedMoved: 0, reverted: 0, skipped: {floating: 0, buried: 0, overhang: 0}, dropped: [], droppedAt: []};
  type Move = {tris: number[]; d: [number, number, number]; kind: 'floating' | 'buried'};
  const translate = (tris: number[], d: [number, number, number], sign: number) => {
    const seen = new Set<number>();
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      if (seen.has(v)) continue;
      seen.add(v);
      P[v * 3] += sign * d[0]; P[v * 3 + 1] += sign * d[1]; P[v * 3 + 2] += sign * d[2];
    }
  };
  /** Assemblies whose move turned them into something worse (sliding past their wall's end, sinking into it) go back where they were and stay put. */
  const frozen = new Set<number>();
  let last: Move[] = [];
  const verify = (issues: OpeningIssue[]) => {
    if (!last.length) return;
    const byTri = new Map<number, Move>();
    for (const m of last) for (const t of m.tris) byTri.set(t, m);
    const undo = new Set<Move>();
    for (const i of issues) {
      const m = byTri.get(i.triangles[0]);
      if (m && ((i.kind === 'overhang' && !(keepLiftOverhang && m.kind === 'buried')) || (i.kind === 'buried' && m.kind === 'floating'))) undo.add(m);
    }
    for (const m of undo) { translate(m.tris, m.d, -1); frozen.add(m.tris[0]); report.reverted++; if (m.kind === 'floating') report.floatingMoved--; else report.buriedMoved--; }
    last = [];
  };
  for (let pass = 0; pass <= passes; pass++) {
    const {issues} = auditOpenings(soup, th);
    verify(issues);
    if (pass === passes) break;
    report.skipped = {floating: 0, buried: 0, overhang: 0};
    const moves: Move[] = [];
    for (const i of issues) {
      if (frozen.has(i.triangles[0])) { report.skipped[i.kind]++; continue; }
      if (i.kind === 'floating' && i.towardHost && i.gap > th.touchTol && i.gap <= maxFloat) {
        // A sheet (zero-thickness quad: a glass plane, a flat fascia) cannot be embedded, it would vanish inside the wall; it comes to rest just in
        // front of the surface instead (inside the 3 cm touch tolerance, outside the 1 cm coplanar band).
        const dir = [i.towardHost[0] / i.gap, i.towardHost[1] / i.gap, i.towardHost[2] / i.gap];
        let lo = Infinity, hi = -Infinity;
        for (const t of i.triangles) for (let k2 = 0; k2 < 3; k2++) {
          const v = I[t * 3 + k2], d = P[v * 3] * dir[0] + P[v * 3 + 1] * dir[1] + P[v * 3 + 2] * dir[2];
          if (d < lo) lo = d; if (d > hi) hi = d;
        }
        const k = hi - lo < sheetThickness ? (i.gap - sheetRest) / i.gap : (i.gap + embed) / i.gap;
        // Closest points of two corners can lie off to the side; when the wall is known and the pull is mostly along its normal, move purely
        // along the normal so the assembly never slides sideways past its wall's end.
        let d: [number, number, number] = [i.towardHost[0] * k, i.towardHost[1] * k, i.towardHost[2] * k];
        if (i.wallNormal) {
          const along = i.towardHost[0] * i.wallNormal[0] + i.towardHost[2] * i.wallNormal[1];
          if (Math.abs(along) >= 0.7 * i.gap) d = [i.wallNormal[0] * along * k, 0, i.wallNormal[1] * along * k];
        }
        moves.push({tris: i.triangles, d, kind: 'floating'});
        report.floatingMoved++;
      } else if (i.kind === 'buried' && i.wallNormal && i.clearance !== undefined && i.clearance + clearMargin <= maxBuried) {
        const m = i.clearance + clearMargin;
        moves.push({tris: i.triangles, d: [i.wallNormal[0] * m, 0, i.wallNormal[1] * m], kind: 'buried'});
        report.buriedMoved++;
      } else report.skipped[i.kind]++;
    }
    report.passes = pass + 1;
    if (!moves.length) break;
    for (const m of moves) translate(m.tris, m.d, 1);
    last = moves;
  }
  if (dropOverhang || dropBuried) {
    for (const i of auditOpenings(soup, th).issues) {
      if (dropBuried && i.kind === 'buried' && i.buried >= dropBuried.minHidden && Math.max(i.max[0] - i.min[0], i.max[1] - i.min[1], i.max[2] - i.min[2]) <= dropBuried.maxExtent) { report.dropped.push(...i.triangles); report.droppedAt.push(i.centre); continue; }
      if (process.env.SNAPDBG && i.kind === 'overhang') console.log('overhang', i.centre.map(c => +c.toFixed(1)), 'outside', +i.outside.toFixed(2), 'extent', +Math.max(i.max[0] - i.min[0], i.max[1] - i.min[1], i.max[2] - i.min[2]).toFixed(1), i.materials.join('+'));
      if (!dropOverhang) continue;
      const extent = Math.max(i.max[0] - i.min[0], i.max[1] - i.min[1], i.max[2] - i.min[2]);
      if (i.kind === 'overhang' && i.outside >= dropOverhang.minOutside && extent <= dropOverhang.maxExtent) { report.dropped.push(...i.triangles); report.droppedAt.push(i.centre); }
    }
  }
  return report;
}

export interface SnapDetachedReport {
  moved: number;
  /** Detached parts left where they are: farther than `maxGap`, or nothing found to attach to. */
  skipped: number;
}

/**
 * Closes small gaps between a model's loose parts and the rest of it: window rows, bay cladding, rooflight frames and chimney stacks that
 * the builder placed a few centimetres off the wall or roof they belong to (the shell audit's `detached` fail). Every part (a cluster of
 * triangles touching within 5 cm) whose gap to the rest of the model is above the touch distance and at most `maxGap` is translated
 * towards its closest point on the rest of the model, `embed` metres past contact. Parts beyond `maxGap` are reported, not moved.
 * Mutates `soup.positions`; the soup's triangles must own their vertices.
 */
export function snapDetachedParts(soup: MaterialSoup, opts: {maxGap?: number; embed?: number; passes?: number} = {}): SnapDetachedReport {
  const {maxGap = 0.6, embed = 0.015, passes = 4} = opts;
  const report: SnapDetachedReport = {moved: 0, skipped: 0};
  for (let pass = 0; pass < passes; pass++) {
    const tri = {positions: Float32Array.from(soup.positions), indices: Uint32Array.from(soup.indices)};
    const parts = analyseSoup(tri, {keepDetachedTriangles: true}).detached.parts;
    report.skipped = 0;
    let movedNow = 0;
    for (const part of parts) {
      // Only the parts the shell audit fails (large and clear of the model): small loose pieces are window assemblies, the openings pass
      // owns those, and moving a lone glass pane towards the nearest surface would sink it behind its own frame.
      if (!part.towardOther || !part.triangleIds || !(part.gap > DEFAULT_THRESHOLDS.failGap) || part.area < DEFAULT_THRESHOLDS.failArea) continue;
      if (part.gap > maxGap) { report.skipped++; continue; }
      // A sheet (a glass quad) rests in front of what it meets: embedded, it would sink behind a frame slab and render as the frame.
      const dir = [part.towardOther[0] / part.gap, part.towardOther[1] / part.gap, part.towardOther[2] / part.gap];
      let lo = Infinity, hi = -Infinity;
      for (const t of part.triangleIds) for (let c = 0; c < 3; c++) {
        const v = soup.indices[t * 3 + c], dd = soup.positions[v * 3] * dir[0] + soup.positions[v * 3 + 1] * dir[1] + soup.positions[v * 3 + 2] * dir[2];
        if (dd < lo) lo = dd; if (dd > hi) hi = dd;
      }
      const k = (hi - lo < 0.02 ? part.gap - 0.025 : part.gap + embed) / part.gap, d = [part.towardOther[0] * k, part.towardOther[1] * k, part.towardOther[2] * k];
      // Never sink a part below the ground it stands on.
      let minY = Infinity;
      for (const t of part.triangleIds) for (let c = 0; c < 3; c++) minY = Math.min(minY, soup.positions[soup.indices[t * 3 + c] * 3 + 1]);
      if (minY + d[1] < -0.02 && minY > -0.02) { report.skipped++; continue; }
      const seen = new Set<number>();
      for (const t of part.triangleIds) for (let c = 0; c < 3; c++) {
        const v = soup.indices[t * 3 + c];
        if (seen.has(v)) continue;
        seen.add(v);
        soup.positions[v * 3] += d[0]; soup.positions[v * 3 + 1] += d[1]; soup.positions[v * 3 + 2] += d[2];
      }
      movedNow++;
    }
    report.moved += movedNow;
    if (!movedNow) break;
  }
  return report;
}
