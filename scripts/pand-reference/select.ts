/**
 * Step 1: for a BAG pand pick its street-facing front wall and the best two panoramas.
 *  - wall: longest exposed edge (not inside a neighbour) whose outward normal faces the nearest road/quay centreline.
 *  - panorama: camera 8-25 m from the wall centre (relaxed to 5-35 m, flagged), smallest angle between the
 *    wall normal and the wall-centre->camera ray; the alternate must come from a different mission_year.
 */
import { cachedJson, findPands, loadRoads, neighbourhood, nearestOnSeg, pointInRing, lngLatToRd, rdToLngLat, normId, type Footprint, type Rd } from './core.ts';

export type Wall = { a: Rd; b: Rd; len: number; nx: number; ny: number; mid: Rd; roadDistM: number; facing: number };
export type PanoPick = { panoId: string; timestamp: string; missionYear: number; missionType: string; surface: string; distM: number; obliquityDeg: number; relaxed: boolean; record: any };
export type Selection = {
  pandId: string; footprint: Footprint; wall: Wall | null; wallNote: string; primary: PanoPick | null; alt: PanoPick | null; candidates: number; otherWalls?: Wall[];
};

export const options: { preferBearingDeg?: number } = {};
const ccw = (ring: Rd[]) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j].x * ring[i].y - ring[i].x * ring[j].y; return a > 0 ? ring : [...ring].reverse(); };

export function exposedWalls(fp: Footprint, others: Footprint[]): Wall[] {
  const ring = ccw(fp.ring);
  // Merge consecutive near-collinear edges (a front drawn with tiny jogs) into one wall.
  type E = { a: Rd; b: Rd };
  const edges: E[] = [];
  for (let i = 0; i + 1 < ring.length; i++) if (Math.hypot(ring[i + 1].x - ring[i].x, ring[i + 1].y - ring[i].y) > 0.05) edges.push({ a: ring[i], b: ring[i + 1] });
  const merged: E[] = [];
  for (const e of edges) {
    const last = merged[merged.length - 1];
    if (last) {
      const d1 = Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x), d2 = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
      const off = Math.abs((e.b.x - last.a.x) * Math.sin(d1) - (e.b.y - last.a.y) * Math.cos(d1));
      if (Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1))) < 6 * Math.PI / 180 && off < 0.4) { last.b = e.b; continue; }
    }
    merged.push({ ...e });
  }
  const obstacles = others.filter(o => o.id !== fp.id);
  return merged.flatMap(e => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, len = Math.hypot(dx, dy);
    if (len < 3) return [];
    const nx = dy / len, ny = -dx / len;
    const free = [0.2, 0.5, 0.8].filter(t => {
      const p = { x: e.a.x + dx * t + nx * 0.6, y: e.a.y + dy * t + ny * 0.6 };
      return !obstacles.some(o => pointInRing(p, o.ring));
    }).length;
    if (free < 2) return []; // party wall
    return [{ a: e.a, b: e.b, len, nx, ny, mid: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, roadDistM: Infinity, facing: 0 }];
  });
}

export async function pickWall(fp: Footprint, others: Footprint[]): Promise<{ wall: Wall | null; note: string; others?: Wall[] }> {
  const walls = exposedWalls(fp, others);
  if (!walls.length) return { wall: null, note: 'no exposed wall' };
  const roads = await loadRoads();
  for (const w of walls) {
    let best = { d: Infinity, q: w.mid };
    const near = roads.filter(s => Math.min(Math.hypot(s.a.x - w.mid.x, s.a.y - w.mid.y), Math.hypot(s.b.x - w.mid.x, s.b.y - w.mid.y)) < 150);
    for (const t of [0.25, 0.5, 0.75]) {
      const p = { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
      for (const s of near) { const r = nearestOnSeg(p, s); if (r.d < best.d) best = { d: r.d, q: r.q }; }
    }
    w.roadDistM = best.d;
    const vx = best.q.x - w.mid.x, vy = best.q.y - w.mid.y, vl = Math.hypot(vx, vy) || 1;
    w.facing = (vx * w.nx + vy * w.ny) / vl;
  }
  const facing = walls.filter(w => w.facing > 0.5 && w.roadDistM < 45);
  if (facing.length) {
    // Front and rear walls both "face a road"; the front is the one on the nearer road. Bucket road distance in 6 m steps, then longest wins.
    // --prefer-bearing=B (+-50 deg) restricts to walls facing roughly B (e.g. the canal side of a row, or a corner house's address front).
    let cands = facing;
    if (options.preferBearingDeg !== undefined) {
      const near = facing.filter(w => { const b = (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360, dd = Math.abs(((b - options.preferBearingDeg! + 540) % 360) - 180); return dd < 50; });
      if (near.length) cands = near;
    }
    cands.sort((p, q) => Math.floor(p.roadDistM / 6) - Math.floor(q.roadDistM / 6) || q.len - p.len);
    const pool = [cands[0]];
    return { wall: pool.sort((p, q) => p.roadDistM - q.roadDistM)[0], note: 'longest wall on the nearest road' + (options.preferBearingDeg !== undefined ? ` (preferred bearing ${options.preferBearingDeg})` : ''), others: walls };
  }
  const fallback = walls.sort((p, q) => q.len * Math.max(0.1, q.facing) - p.len * Math.max(0.1, p.facing))[0];
  return { wall: fallback, note: `fallback: no wall faces a road within 45 m (best facing ${fallback.facing.toFixed(2)})`, others: walls };
}

const listUrl = (c: Rd, radius: number) => { const [lng, lat] = rdToLngLat(c); return `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng.toFixed(6)},${lat.toFixed(6)}&radius=${radius}&srid=4326&page_size=500`; };
export async function listPanos(c: Rd, radius = 35): Promise<any[]> {
  let url: string | null = listUrl(c, radius); const all: any[] = [];
  for (let page = 0; url && page < 10; page++) {
    const json: any = await cachedJson(url);
    all.push(...(json._embedded?.panoramas ?? []));
    url = json._links?.next?.href ?? null;
  }
  return all;
}

export function rankPanos(wall: Wall, panos: any[]): PanoPick[] {
  return panos.flatMap(p => {
    const rd = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
    const vx = rd.x - wall.mid.x, vy = rd.y - wall.mid.y, d = Math.hypot(vx, vy), standoff = vx * wall.nx + vy * wall.ny;
    if (standoff <= 2 || d > 35 || d < 5) return [];
    const obl = Math.acos(Math.min(1, standoff / d)) * 180 / Math.PI;
    const year = Number(p.mission_year ?? String(p.timestamp).slice(0, 4));
    return [{ panoId: p.pano_id, timestamp: p.timestamp, missionYear: year, missionType: p.mission_type, surface: p.surface_type, distM: d, obliquityDeg: obl, relaxed: d < 8 || d > 25, record: p } as PanoPick];
  }).filter(c => c.obliquityDeg <= 55)
    // Strict-range candidates first; within a class, the straightest view wins, newer breaks near-ties.
    .sort((a, b) => Number(a.relaxed) - Number(b.relaxed) || (a.obliquityDeg - b.obliquityDeg) + (b.missionYear - a.missionYear) * 0.3);
}

export async function selectPands(ids: string[]): Promise<Selection[]> {
  const found = await findPands(ids);
  const out: Selection[] = [];
  for (const raw of ids) {
    const id = normId(raw), fp = found.get(id);
    if (!fp) { out.push({ pandId: id, footprint: { id, ring: [], height: 0 }, wall: null, wallNote: 'pand not in building tiles', primary: null, alt: null, candidates: 0 }); continue; }
    const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
    const { wall, note, others } = await pickWall(fp, await neighbourhood(centre));
    if (!wall) { out.push({ pandId: id, footprint: fp, wall, wallNote: note, primary: null, alt: null, candidates: 0 }); continue; }
    const ranked = rankPanos(wall, await listPanos(wall.mid));
    const primary = ranked[0] ?? null;
    const alt = primary ? ranked.find(c => c.missionYear !== primary.missionYear && c.obliquityDeg < 50) ?? null : null;
    out.push({ pandId: id, footprint: fp, wall, wallNote: note, primary, alt, candidates: ranked.length, otherWalls: (others ?? []).filter(w => w !== wall) });
  }
  return out;
}
