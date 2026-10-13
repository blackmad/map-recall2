// Per-polder water levels for the own ground (lane task 1, 2026-10-13).
//
//   npx tsx scripts/own-ground/build-polder-levels.ts
//   # review artifacts/own-ground/staging/polder-levels-v1/report.json, then
//   cp artifacts/own-ground/staging/polder-levels-v1/water-levels.json public/data/extracts/amsterdam/elevation-v1/
//
// Source: Hoogheemraadschap Amstel, Gooi en Vecht (Waternet) "Peilgebieden
// Vigerend" (DAMO beheerregister), ArcGIS FeatureServer
//   https://services-eu1.arcgis.com/nN7Fv7YeT1qPGzBX/arcgis/rest/services/DAMO_BEHEERREGISTER_PEILGEBIEDEN_VIGEREND/FeatureServer/0
// found through the AGV "Legger en Waterschapsverordening" web map (item
// 649a5df8b3224d83bcad07704becd4d4). Open data of the waterschap (Open data
// Waterwet / Wet hergebruik overheidsinformatie; no restriction is stated on
// the service, record as "AGV open data, attribution Hoogheemraadschap AGV").
// Levels sit in `ws_label` ("VP: -2.17", "ZP: -4.45 / WP: -4.65", "FPb/FPo").
//
// Every elevation-v1 water polygon gets the level of the peilgebied under
// most of its area (grid-sampled); every shore the level of the peilgebied
// just on its water side. Output is NAP metres per polygon/shore, per cell,
// collapsed to one number when uniform. Water outside AGV's peilgebieden
// (Amstel/IJ/Rijkswaterstaat waters) keeps the stadsboezem default −0.40.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { localToLngLat, type ElevationIndex, type WaterCell } from '../../src/canalRecall/elevation/elevationData.ts';

const SERVICE = 'https://services-eu1.arcgis.com/nN7Fv7YeT1qPGzBX/arcgis/rest/services/DAMO_BEHEERREGISTER_PEILGEBIEDEN_VIGEREND/FeatureServer/0';
const RAW = 'artifacts/own-ground/raw/peil';
const OUT = 'artifacts/own-ground/staging/polder-levels-v1';
const EXTRACT = 'public/data/extracts/amsterdam/elevation-v1';
const DEFAULT_NAP = -0.40;

type Ring = [number, number][];
interface Peil { code: string; naam: string | null; label: string; nap: number; kind: string; rings: Ring[]; bbox: [number, number, number, number]; area: number }

async function fetchAll(): Promise<any[]> {
  mkdirSync(RAW, { recursive: true });
  const file = `${RAW}/agv-peilgebieden-vigerend.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const features: any[] = [];
  for (let off = 0; ; off += 500) {
    const r = await fetch(`${SERVICE}/query?where=1%3D1&outFields=*&outSR=28992&f=geojson&resultOffset=${off}&resultRecordCount=500`);
    const j: any = await r.json();
    features.push(...j.features);
    if (j.features.length < 500) break;
  }
  writeFileSync(file, JSON.stringify(features));
  return features;
}

/** Managed level from the label: VP; seasonal ZP/WP and flexible FPb/FPo take the band midpoint. */
export function parseLevel(label: string): { nap: number; kind: string } | null {
  const vals: Record<string, number> = {};
  for (const m of label.matchAll(/(VP|ZP|WP|FPb|FPo|Zomer|Winter)\s*:?\s*(-?\d+(?:[.,]\d+)?)/gi)) vals[m[1].toLowerCase()] = Number(m[2].replace(',', '.'));
  const v = (k: string) => vals[k];
  if (v('vp') !== undefined) return { nap: v('vp'), kind: 'vast' };
  const zp = v('zp') ?? v('zomer'), wp = v('wp') ?? v('winter');
  if (zp !== undefined && wp !== undefined) return { nap: (zp + wp) / 2, kind: 'seizoen' };
  if (v('fpb') !== undefined && v('fpo') !== undefined) return { nap: (v('fpb') + v('fpo')) / 2, kind: 'flexibel' };
  const one = v('fpb') ?? v('fpo') ?? zp ?? wp;
  return one !== undefined ? { nap: one, kind: 'enkel' } : null;
}

const ringArea = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };

function loadPeilen(features: any[]): Peil[] {
  const out: Peil[] = [];
  for (const f of features) {
    const lvl = parseLevel(f.properties.ws_label ?? '');
    if (!lvl) continue;
    const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys.flat() as Ring[];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, area = 0;
    for (const poly of polys) poly.forEach((r, i) => { area += (i ? -1 : 1) * Math.abs(ringArea(r)); for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
    out.push({ code: f.properties.code, naam: f.properties.naam, label: f.properties.ws_label, nap: lvl.nap, kind: lvl.kind, rings, bbox: [x0, y0, x1, y1], area });
  }
  return out;
}

class PeilIndex {
  private readonly cells = new Map<string, Peil[]>();
  private static readonly G = 500;
  constructor(peilen: Peil[]) {
    for (const p of peilen) for (let gx = Math.floor(p.bbox[0] / PeilIndex.G); gx <= Math.floor(p.bbox[2] / PeilIndex.G); gx++) for (let gy = Math.floor(p.bbox[1] / PeilIndex.G); gy <= Math.floor(p.bbox[3] / PeilIndex.G); gy++) {
      const k = `${gx}_${gy}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(p);
    }
  }
  /** Smallest peilgebied containing the RD point (even-odd over all its rings). */
  at(x: number, y: number): Peil | null {
    let best: Peil | null = null;
    for (const p of this.cells.get(`${Math.floor(x / PeilIndex.G)}_${Math.floor(y / PeilIndex.G)}`) ?? []) {
      if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
      let inside = false;
      for (const r of p.rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside && (!best || p.area < best.area)) best = p;
    }
    return best;
  }
}

function main() {
  return fetchAll().then(features => {
    const peilen = loadPeilen(features);
    const index = new PeilIndex(peilen);
    const el: ElevationIndex = JSON.parse(readFileSync(`${EXTRACT}/index.json`, 'utf8'));
    const q = el.quantization.xy, S = el.cellSizeM;
    const rd = (sx: number, sy: number) => { const p = lngLatToRd(localToLngLat(el, sx, sy)); return [p.x, p.y] as const; };

    const cells: Record<string, { p: number | number[]; s: number | number[] }> = {};
    const stat = { cells: 0, polygons: 0, polygonsMatched: 0, polygonsMixed: 0, polygonsDefault: 0, shores: 0, shoresMatched: 0, areaByLevel: {} as Record<string, number>, mixedExamples: [] as unknown[] };
    const byCode = new Map<string, { naam: string | null; label: string; nap: number; polygons: number }>();
    for (const [cx, cy] of el.cells) {
      const cell: WaterCell = JSON.parse(readFileSync(`${EXTRACT}/cells/${cx}_${cy}.json`, 'utf8'));
      const ox = cx * S, oy = cy * S;
      const pl: number[] = [];
      for (const poly of cell.water) {
        const ring = poly[0], pts: [number, number][] = [];
        for (let i = 0; i < ring.length; i += 2) pts.push([ox + ring[i] * q, oy + ring[i + 1] * q]);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        const step = Math.max(12, Math.sqrt((x1 - x0) * (y1 - y0) / 400));
        const votes = new Map<Peil | null, number>();
        const inside = (x: number, y: number) => { let c = false; for (const r of poly.map((rg, i) => ({ rg, i }))) { const rg = r.rg; for (let i = 0, j = rg.length - 2; i < rg.length; j = i, i += 2) { const xi = ox + rg[i] * q, yi = oy + rg[i + 1] * q, xj = ox + rg[j] * q, yj = oy + rg[j + 1] * q; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } } return c; };
        let n = 0;
        for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) {
          if (!inside(x, y)) continue;
          const [rx, ry] = rd(x, y);
          const p = index.at(rx, ry); votes.set(p, (votes.get(p) ?? 0) + 1); n++;
        }
        if (!n) { // sliver: use the ring's first vertex
          const [rx, ry] = rd(pts[0][0], pts[0][1]); const p = index.at(rx, ry); votes.set(p, 1); n = 1;
        }
        const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
        // Prefer a matched peilgebied unless the unmatched share is the clear majority.
        const [top, topN] = ranked[0];
        const matched = ranked.filter(([p]) => p);
        const pick = top ?? (matched.length && matched[0][1] > n * 0.25 ? matched[0][0] : null);
        const nap = pick ? pick.nap : DEFAULT_NAP;
        stat.polygons++;
        if (pick) { stat.polygonsMatched++; const e = byCode.get(pick.code) ?? { naam: pick.naam, label: pick.label, nap: pick.nap, polygons: 0 }; e.polygons++; byCode.set(pick.code, e); } else stat.polygonsDefault++;
        const levels = new Set(matched.map(([p]) => p!.nap));
        if (levels.size > 1 && matched.filter(([p]) => p!.nap !== nap).reduce((s, [, c]) => s + c, 0) > 0.15 * n) { stat.polygonsMixed++; if (stat.mixedExamples.length < 8) stat.mixedExamples.push({ cell: `${cx}_${cy}`, votes: ranked.map(([p, c]) => [p?.code ?? null, p?.nap ?? null, c]) }); }
        void topN;
        const key = nap.toFixed(2); stat.areaByLevel[key] = (stat.areaByLevel[key] ?? 0) + n * step * step;
        pl.push(Math.round(nap * 100) / 100);
      }
      const sl: number[] = [];
      for (const line of cell.shore) {
        stat.shores++;
        // Water is on the left of the direction of travel: sample 0.8 m left of the middle segment.
        const m = Math.max(0, Math.floor(line.length / 4) * 2 - 2) , a = [ox + line[m] * q, oy + line[m + 1] * q], b = [ox + line[Math.min(m + 2, line.length - 2)] * q, oy + line[Math.min(m + 3, line.length - 1)] * q];
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const px = (a[0] + b[0]) / 2 - dy / len * 0.8, py = (a[1] + b[1]) / 2 + dx / len * 0.8;
        const [rx, ry] = rd(px, py), p = index.at(rx, ry);
        if (p) stat.shoresMatched++;
        sl.push(Math.round((p ? p.nap : DEFAULT_NAP) * 100) / 100);
      }
      const uni = (a: number[]) => a.length && a.every(v => v === a[0]) ? a[0] : a;
      cells[`${cx}_${cy}`] = { p: uni(pl), s: uni(sl) };
      stat.cells++;
    }

    const out = { version: 1, datum: 'NAP metres', defaultNap: DEFAULT_NAP, polygons: 'per elevation-v1 cell water polygon, in file order; a number when uniform', shores: 'per shore polyline, in file order', cells };
    mkdirSync(OUT, { recursive: true });
    const json = JSON.stringify(out);
    writeFileSync(`${OUT}/water-levels.json`, json);
    const distinct = new Map<string, number>();
    for (const c of Object.values(cells)) for (const v of ([] as number[]).concat(c.p)) distinct.set(v.toFixed(2), (distinct.get(v.toFixed(2)) ?? 0) + 1);
    const report = {
      source: { name: 'AGV/Waternet Peilgebieden Vigerend (DAMO beheerregister)', url: SERVICE, webmap: 'https://waternet.maps.arcgis.com/home/item.html?id=649a5df8b3224d83bcad07704becd4d4', licence: 'Open data of Hoogheemraadschap Amstel, Gooi en Vecht; the service states no restriction. Attribute: Hoogheemraadschap AGV.', features: features.length, withParsedLevel: peilen.length },
      levelRule: 'VP; seasonal ZP/WP and flexible FPb/FPo = midpoint of the band; default −0.40 NAP (stadsboezem) where no peilgebied covers the water',
      ...stat, polygonsMatchedPct: +(100 * stat.polygonsMatched / stat.polygons).toFixed(1), shoresMatchedPct: +(100 * stat.shoresMatched / stat.shores).toFixed(1),
      distinctPolygonLevels: Object.fromEntries([...distinct.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
      peilgebiedenUsed: [...byCode.entries()].map(([code, e]) => ({ code, ...e })).sort((a, b) => b.polygons - a.polygons).slice(0, 40),
      bytes: json.length, gzipBytes: gzipSync(json).length,
    };
    writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ ...report, peilgebiedenUsed: report.peilgebiedenUsed.slice(0, 12) }, null, 1));
  });
}

void main();
