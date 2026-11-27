import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab, type Frame} from './nearbar-kit';
import {timberWindow} from './wallen-more-kit';
import {cantedBayFacets, cantedBayOutline, facetOpening, offsetOutline, type BayFacet, type CantedBayPlan, type TO} from '../../src/canalRecall/landmarks/cantedBay';

/**
 * Builder adapter for src/canalRecall/landmarks/cantedBay.ts: a canted (three-sided) oriel on a nearbar-kit wall frame
 * (t along the wall, y up, o out of the wall). The body is one prism whose back is sunk into the wall; windows, colonnettes
 * and bands follow the facets, so a side facet's glazing is cut to its real width and turned with it.
 */
export interface BayWindowRow {y0: number; y1: number; cols: number; rows: number; rowWeights?: number[]; margin?: number; sideCols?: number; /** Frame width (timberWindow `fw`). */ fw?: number}
export interface CantedBayDraw {
  plan: CantedBayPlan;
  /** Body (bay wall) from y0 to y1. */
  body: [number, number];
  /** Window rows on every facet (side facets take `sideCols` panes across, default cols - 1, min 1). */
  windows?: BayWindowRow[];
  /** Bands round the bay: bottom y, height, how far proud of the facets. */
  bands?: {y: number; h: number; d: number; colour?: string}[];
  /** Tapered corbel under the body: from y0 (a `foot` fraction of the plan) up to the body foot. */
  corbel?: {y0: number; foot?: number; colour?: string};
  /** Round shafts at the four facet corners (the two wall corners stand half in the wall), from y0 to y1. */
  colonnettes?: {y0: number; y1: number; r: number; capital?: number}[];
  colours: {wall: string; trim: string; glass: string; frame: string};
}

/** The wall frame of one facet: origin at its left end, t along it, o out of it. */
export function facetFrame(F: Frame, f: BayFacet): Frame {
  const W = (p: TO): [number, number] => [F.origin[0] + F.tangent[0] * p[0] + F.n[0] * p[1], F.origin[1] + F.tangent[1] * p[0] + F.n[1] * p[1]];
  const len = f.width, dt = (f.b[0] - f.a[0]) / len, d = (f.b[1] - f.a[1]) / len;
  return {
    origin: W(f.a),
    tangent: [F.tangent[0] * dt + F.n[0] * d, F.tangent[1] * dt + F.n[1] * d],
    n: [F.tangent[0] * f.normal[0] + F.n[0] * f.normal[1], F.tangent[1] * f.normal[0] + F.n[1] * f.normal[1]],
  };
}

/** A prism on a plan outline (t, o) from y to y + h, its back edge carried `sink` behind the wall plane. */
export function planPrism(b: BuildingTools, F: Frame, outline: TO[], y: number, h: number, colour: string, sink = 0.12) {
  const pts = [[outline[0][0], -sink], ...outline, [outline.at(-1)![0], -sink]] as TO[];
  const s = new T.Shape(pts.map(([t, o]) => new T.Vector2(t, o)));
  put(b, F, new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, y + h, 0), 0, 0, 0, colour);
}

/** A frustum between a plan outline at `y1` (top) and the same outline shrunk towards the wall by `foot` at `y0`. */
export function planCorbel(b: BuildingTools, F: Frame, outline: TO[], y0: number, y1: number, foot: number, colour: string, sink = 0.12) {
  const tc = (outline[0][0] + outline.at(-1)![0]) / 2;
  const top = [[outline[0][0], -sink], ...outline, [outline.at(-1)![0], -sink]] as TO[];
  const bot = top.map(([t, o]) => [tc + (t - tc) * foot, o < 0 ? o : o * foot] as TO);
  const pos: number[] = [], idx: number[] = [], n = top.length;
  for (const [t, o] of top) pos.push(t, y1, o);
  for (const [t, o] of bot) pos.push(t, y0, o);
  // the outline runs clockwise in (t, o) (wall-left, front, wall-right, back), so these windings face outward
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, n + j, j, i, n + i, n + j);
  }
  for (let i = 1; i + 1 < n; i++) { idx.push(n, n + i + 1, n + i); idx.push(0, i, i + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  put(b, F, g.toNonIndexed(), 0, 0, 0, colour);
}

export function cantedBayOn(b: BuildingTools, F: Frame, o: CantedBayDraw) {
  const C = o.colours, P = o.plan, [y0, y1] = o.body;
  const facets = cantedBayFacets(P);
  planPrism(b, F, cantedBayOutline(P), y0, y1 - y0, C.wall);
  for (const band of o.bands ?? []) planPrism(b, F, offsetOutline(P, band.d), band.y, band.h, band.colour ?? C.trim);
  if (o.corbel) planCorbel(b, F, offsetOutline(P, 0.04), o.corbel.y0, y0, o.corbel.foot ?? 0.3, o.corbel.colour ?? C.trim);
  for (const f of facets) {
    const ff = facetFrame(F, f);
    for (const r of o.windows ?? []) {
      const w = facetOpening(f, r.margin ?? 0.12);
      if (w < 0.2) continue;
      const cols = f.index === 1 ? r.cols : (r.sideCols ?? Math.max(1, r.cols - 1));
      timberWindow(b, ff, f.width / 2, r.y0, w, r.y1 - r.y0, {cols, rows: r.rows, frame: C.frame, glass: C.glass, sill: null, ...(r.rowWeights ? {rowWeights: r.rowWeights} : {}), ...(r.fw !== undefined ? {fw: r.fw} : {})});
    }
  }
  // colonnettes: round shafts on the outline's corners
  const corners = cantedBayOutline(P);
  for (const c of o.colonnettes ?? []) for (const [t, oo] of corners) {
    const h = c.y1 - c.y0;
    put(b, F, new T.CylinderGeometry(c.r, c.r, h, 8).translate(0, h / 2, 0), t, c.y0, oo, C.trim);
    if (c.capital) put(b, F, new T.BoxGeometry(c.r * 2.6, c.capital, c.r * 2.6).translate(0, c.capital / 2, 0), t, c.y1 - c.capital, oo, C.trim);
  }
  return {facets};
}

/** A plain slab band across a stretch of wall that stops at the bay sides (convenience for spandrels). */
export function wallBand(b: BuildingTools, F: Frame, t0: number, t1: number, y: number, h: number, d: number, colour: string) {
  slab(b, F, (t0 + t1) / 2, y, t1 - t0, h, d, colour);
}
