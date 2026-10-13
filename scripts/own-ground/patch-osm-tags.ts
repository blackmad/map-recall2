// Patch the published own-ground OSM cells with the tags the first fetch dropped from
// area ways, without refetching the whole city (staging path first, then review and copy):
//
//   npx tsx scripts/own-ground/patch-osm-tags.ts            # fetch + write artifacts/own-ground/staging/own-ground-osm-v1-patched/
//   npx tsx scripts/own-ground/patch-osm-tags.ts --offline  # re-use the cached Overpass responses
//   # review report.json, then
//   cp artifacts/own-ground/staging/own-ground-osm-v1-patched/cells/* public/data/extracts/amsterdam/own-ground-osm-v1/cells/
//
// Adds to `paved` areas `hw`, the `area:highway` value (or the `highway` of an `area=yes`
// way) and `surface`, so a carriageway area draws as asphalt and a cycleway area as red
// asphalt, not square paving (own-ground defects lane, 2026-10-13).
//
// Source: Overpass API (build time only). © OpenStreetMap contributors, ODbL.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

const SRC = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1-patched';
const CACHE = 'artifacts/own-ground/raw/overpass-patch';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const offline = process.argv.includes('--offline');

type Element = { type: 'way' | 'relation'; id: number; tags?: Record<string, string> };

async function overpass(label: string, query: string): Promise<Element[]> {
  const cached = join(CACHE, `${label}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')).elements;
  if (offline) throw new Error(`${label}: no cached response`);
  for (let attempt = 0; attempt < 24; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    let status = 0, text = '';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      status = res.status; text = await res.text();
      if (res.ok && text.startsWith('{')) {
        const body = JSON.parse(text) as { elements: Element[]; remark?: string };
        if (!body.remark || !/error/i.test(body.remark)) { mkdirSync(CACHE, { recursive: true }); writeFileSync(cached, text); return body.elements; }
        text = body.remark;
      }
    } catch (error) { text = String(error); }
    console.warn(`${label} @ ${new URL(endpoint).host}: ${status} ${text.slice(0, 80).replace(/\s+/g, ' ')}, retrying`);
    await new Promise(r => setTimeout(r, 6_000));
  }
  throw new Error(`overpass ${label} failed`);
}

const BBOX = '52.27,4.70,52.44,5.11';

async function main(): Promise<void> {
  const els = await overpass('area-highway', `[out:json][timeout:240];(way["area:highway"](${BBOX});way[highway][area=yes](${BBOX}););out tags;`);
  const hwOf = new Map<string, { hw: string; surface?: string }>();
  for (const e of els) {
    const t = e.tags ?? {}, hw = t['area:highway'] ?? t.highway;
    if (hw) hwOf.set(`w${e.id}`, { hw, surface: t.surface });
  }
  console.log(JSON.stringify({ areaHighway: hwOf.size }));
  mkdirSync(join(OUT, 'cells'), { recursive: true });
  const report = { areasPatched: 0, areaHw: {} as Record<string, number>, cellsChanged: [] as string[] };
  for (const f of readdirSync(join(SRC, 'cells'))) {
    const j = JSON.parse(gunzipSync(readFileSync(join(SRC, 'cells', f)))) as OsmGroundExtract;
    let changed = false;
    for (const a of j.areas) {
      const hit = hwOf.get(a.id);
      if (hit && a.kind === 'paved' && (a.hw !== hit.hw || a.surface !== hit.surface)) {
        a.hw = hit.hw; if (hit.surface) a.surface = hit.surface;
        report.areasPatched++; report.areaHw[hit.hw] = (report.areaHw[hit.hw] ?? 0) + 1; changed = true;
      }
    }
    if (changed) { writeFileSync(join(OUT, 'cells', f), gzipSync(Buffer.from(JSON.stringify(j)))); report.cellsChanged.push(f); }
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
}

main().catch(e => { console.error(e); process.exit(1); });
