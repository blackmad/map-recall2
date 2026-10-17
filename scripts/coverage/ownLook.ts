/**
 * IO half of the "own look" tier (src/canalRecall/coverage/ownLook.ts): which house type, design family or measured
 * face draws each chunk / building-type pand, assigned to buurten through the units build-coverage.ts located, plus a
 * ride past one example of each.
 *
 * Sources: ordinary-buildings-data/chunks.json (installed block-face chunks and their pands), each chunk's
 * scripts/block-face/faces/<face>/intent.json (houses[].type.type names the house type), building-types/instances.json
 * (design unit per pand), scripts/block-face/types/<district>/*.json (district of each type id).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fullPandId } from '../../src/canalRecall/bagTiles';
import { ringAreaM2, type BuurtContent, type PandRecord, type TierId } from '../../src/canalRecall/coverage/coverage';
import { chunkRide, ownLookOf, pandRide, type OwnLook, type Ride } from '../../src/canalRecall/coverage/ownLook';
import type { LookItems, LookThumb } from '../../src/canalRecall/coverage/contents';

export type Chunk = {
  id: string; modelUrl: string; instance: { anchor: [number, number]; northOffsetDegrees: number }; bounds: { min: number[]; max: number[] };
  pands: { pandId: string; frontage?: { x0: number; x1: number }; bounds?: { min: number[]; max: number[] } }[];
};

export type OwnLookSources = {
  /** type id → district folder. */
  typeDistrict: Map<string, string>;
  /** chunk id → face id, pand → type id (absent: a measured one-off). */
  chunkFace: Map<string, string>;
  pandType: Map<string, string>;
  chunks: Chunk[];
};

export function readOwnLookSources(ROOT: string): OwnLookSources {
  const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const typeDistrict = new Map<string, string>();
  const typesDir = path.join(ROOT, 'scripts/block-face/types');
  for (const district of fs.readdirSync(typesDir).filter(d => fs.statSync(path.join(typesDir, d)).isDirectory())) {
    for (const file of fs.readdirSync(path.join(typesDir, district)).filter(f => f.endsWith('.json'))) {
      typeDistrict.set(String(readJson(path.join(typesDir, district, file)).id ?? file.replace(/\.json$/, '')), district);
    }
  }
  const chunks = (readJson(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/chunks.json')).chunks as Chunk[]).filter(c => c.id.startsWith('chunk-face-'));
  const chunkFace = new Map<string, string>(), pandType = new Map<string, string>();
  for (const c of chunks) {
    const face = c.id.replace(/^chunk-face-/, '');
    chunkFace.set(c.id, face);
    const intentFile = path.join(ROOT, 'scripts/block-face/faces', face, 'intent.json');
    if (!fs.existsSync(intentFile)) continue;
    for (const h of (readJson(intentFile).houses ?? []) as { pandId?: string; type?: { type?: string } }[]) {
      if (h.pandId && h.type?.type) pandType.set(fullPandId(h.pandId), h.type.type);
    }
  }
  return { typeDistrict, chunkFace, pandType, chunks };
}

type Input = {
  sources: OwnLookSources;
  rows: readonly { code: string; pands: number; tiers: Record<TierId, number> }[];
  tierOf: ReadonlyMap<string, TierId>;
  unitBuurt: ReadonlyMap<string, string>;
  pands: ReadonlyMap<string, PandRecord>;
  instances: readonly { pand: string; unit: string }[];
  content: ReadonlyMap<string, BuurtContent>;
};

export function buildOwnLook({ sources, rows, tierOf, unitBuurt, pands, instances, content }: Input): Map<string, OwnLook> {
  type Acc = { types: Map<string, number>; designs: Map<string, number>; faces: Map<string, number>; rides: Record<string, Ride>; best: Map<string, number> };
  const acc = new Map<string, Acc>();
  const at = (code: string) => { let a = acc.get(code); if (!a) acc.set(code, a = { types: new Map(), designs: new Map(), faces: new Map(), rides: {}, best: new Map() }); return a; };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  // Block-face chunks: per pand the house type (or the face, for a measured one-off).
  for (const c of sources.chunks) {
    const face = sources.chunkFace.get(c.id)!;
    const ride = chunkRide(c.instance.anchor, c.instance.northOffsetDegrees, c.bounds.min[0], c.bounds.max[0]);
    const perBuurt = new Map<string, Map<string, number>>();
    for (const p of c.pands) {
      const id = fullPandId(p.pandId);
      if (tierOf.get(id) !== 'chunk') continue;
      const code = unitBuurt.get(id);
      if (!code) continue;
      const a = at(code), type = sources.pandType.get(id);
      const key = type ? `type:${type}` : `face:${face}`;
      bump(type ? a.types : a.faces, type ?? face);
      const m = perBuurt.get(code) ?? new Map<string, number>(); perBuurt.set(code, m); bump(m, key);
    }
    // The ride for a type or face is the chunk in this buurt that draws most of it.
    for (const [code, m] of perBuurt) for (const [key, n] of m) {
      const a = at(code);
      if (n > (a.best.get(key) ?? 0)) { a.best.set(key, n); a.rides[key] = ride; }
    }
  }
  // Building-type designs: per family; the ride passes the family's largest instance pand in the buurt.
  const biggest = new Map<string, number>();
  for (const i of instances) {
    const id = fullPandId(i.pand);
    if (tierOf.get(id) !== 'buildingType') continue;
    const code = unitBuurt.get(id), p = pands.get(id);
    if (!code || !p) continue;
    const family = i.unit.split('__')[0], a = at(code), key = `design:${family}`;
    bump(a.designs, family);
    const size = p.ring.length >= 3 ? ringAreaM2(p.ring) : 0;
    if (size > (biggest.get(`${code}|${key}`) ?? 0)) { biggest.set(`${code}|${key}`, size); a.rides[key] = pandRide(p.centroid, p.ring); }
  }
  const out = new Map<string, OwnLook>();
  for (const r of rows) {
    const a = acc.get(r.code), c = content.get(r.code);
    const authored = !!(c && (c.types.length || c.faces.length || c.designs.length));
    if (!a && !authored) continue;
    out.set(r.code, ownLookOf({
      pands: r.pands, chunk: r.tiers.chunk, buildingType: r.tiers.buildingType,
      types: a?.types ?? new Map(), designs: a?.designs ?? new Map(), faces: a?.faces ?? new Map(),
      typeDistrict: id => sources.typeDistrict.get(id), authored, rides: a?.rides,
    }));
  }
  return out;
}

/** The staged thumbnail manifest (build-look-thumbs.ts) as the page's catalogue; `files` lists the images to publish. */
export function lookItems(stagingDir: string, publishedPrefix: string, chunkIds: ReadonlySet<string>): { items: LookItems; files: string[]; missing: string[] } {
  const manifestFile = path.join(stagingDir, 'look.json');
  const items: LookItems = { types: {}, designs: {}, families: {} };
  if (!fs.existsSync(manifestFile)) return { items, files: [], missing: ['look.json (run scripts/coverage/build-look-thumbs.ts)'] };
  const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as {
    types: Record<string, { render?: ManifestThumb; photo?: ManifestThumb; chunk?: string }>;
    designs: Record<string, { render?: ManifestThumb; unit: string }>;
    families: Record<string, { photo?: ManifestThumb }>;
    missing: string[];
  };
  const files: string[] = [];
  const thumb = (t: ManifestThumb | undefined): LookThumb | undefined => {
    if (!t || !fs.existsSync(path.join(stagingDir, 'look', t.file))) return undefined;
    files.push(t.file);
    return { src: `${publishedPrefix}${t.file}`, label: t.label, ...(t.credit ? { credit: t.credit } : {}) };
  };
  for (const [id, t] of Object.entries(m.types)) {
    const render = thumb(t.render), photo = thumb(t.photo), chunk = t.chunk && chunkIds.has(t.chunk) ? t.chunk : undefined;
    items.types[id] = { ...(render ? { render } : {}), ...(photo ? { photo } : {}), ...(chunk ? { chunk } : {}), links: chunk ? [{ label: 'Chunk in 3D', href: `street-chunks.html?only=${encodeURIComponent(chunk)}` }] : [] };
  }
  for (const [key, d] of Object.entries(m.designs)) { const render = thumb(d.render); items.designs[key] = { unit: d.unit, ...(render ? { render } : {}) }; }
  for (const [family, f] of Object.entries(m.families)) { const photo = thumb(f.photo); items.families[family] = photo ? { photo } : {}; }
  return { items, files, missing: m.missing ?? [] };
}
type ManifestThumb = { file: string; label: string; credit?: string };
