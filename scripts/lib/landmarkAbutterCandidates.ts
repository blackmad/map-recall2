/**
 * Landmark models and their abutter candidates from the city tiles, shared by
 * scripts/landmarks/survey-landmark-abutters.ts (the survey) and
 * scripts/check-landmark-abutters.ts (the gate). Footprints are the same as
 * check-osm-under-models: the model outline (placedFootprints.footprintOf) plus
 * the tile polygons of the buildings it already suppresses.
 */
import fs from 'node:fs';
import {ROOT, readJson, allSpecs, footprintOf, kindOf, buildingTypesPlaced, indexAround, byIdIndex, buildingsIn} from './placedFootprints';
import {ringsFootprint, unionFootprint, type Footprint, type LngLat, type Ring, type TileBuilding} from '../../src/canalRecall/landmarks/osmUnderModels';
import {abutterGeometry, footprintHull, MAX_PARTIAL_OVERLAP, scoreAbutter, type AbutterGeometry, type AbutterIdentity, type ScoreTerm} from '../../src/canalRecall/landmarks/landmarkAbutters';
import {PAND_PREFIX} from '../../src/canalRecall/bagTiles';

/** Placed-model kinds the survey covers: landmarks (churches, museums, theatres, monuments), not ordinary blocks or street houses. */
export const LANDMARK_KINDS = new Set(['manual-landmark', 'surveyed-3dw', 'other']);
/** Candidates are looked for this far (m) outside the model's bounds. */
export const SEARCH_MARGIN_M = 4;

export const FACTS = `${ROOT}/scripts/landmarks/landmark-abutters-facts.json`;
export const ALLOWLIST = `${ROOT}/scripts/landmarks/landmark-abutters-allowlist.json`;

export interface LandmarkModel {
  id: string; name: string; kind: string; source: string; suppress: Set<string>;
  footprint: Footprint; hull: Ring; centre: LngLat;
}

export async function landmarkModels(only: readonly string[] = []): Promise<{models: LandmarkModel[]; skipped: string[]}> {
  const models: LandmarkModel[] = [], skipped: string[] = [];
  for (const spec of allSpecs()) {
    if (only.length ? !only.includes(spec.id) : !LANDMARK_KINDS.has(kindOf(spec))) continue;
    const {fp, source} = await footprintOf(spec);
    const centre = (spec.surveyed?.anchor ?? spec.footprint?.centre ?? [0, 0]) as LngLat;
    const suppress = new Set(spec.suppressOsmIds.map(String));
    indexAround(centre);
    const own = [...suppress].map(id => byIdIndex.get(id)).filter((b): b is TileBuilding => !!b).flatMap(b => b.rings);
    const parts = [...(fp ? [fp] : []), ...(own.length ? [ringsFootprint(own)] : [])];
    if (!parts.length) { skipped.push(spec.id); continue; }
    const footprint = unionFootprint(parts);
    models.push({id: spec.id, name: spec.name ?? spec.id, kind: kindOf(spec), source, suppress, footprint, hull: footprintHull(footprint), centre});
  }
  return {models, skipped};
}

/** Every id hidden by some placed model (or building-type instance), with its owner. */
export function claimedIds(): Map<string, string> {
  const claimed = new Map<string, string>();
  for (const spec of allSpecs()) for (const id of spec.suppressOsmIds) if (!claimed.has(String(id))) claimed.set(String(id), spec.id);
  for (const p of buildingTypesPlaced()) for (const id of p.suppress) if (!claimed.has(id)) claimed.set(id, p.id);
  return claimed;
}

const grow = (b: {w: number; s: number; e: number; n: number}, m: number) => {
  const dx = m / (111_320 * Math.cos((b.s * Math.PI) / 180)), dy = m / 111_320;
  return {w: b.w - dx, s: b.s - dy, e: b.e + dx, n: b.n + dy};
};

export interface Candidate { tile: TileBuilding; geometry: AbutterGeometry }

/** Unsuppressed city buildings around a model in at least one abutter category (overlap >= 50% is osm-under-models' job). */
export function candidatesFor(model: LandmarkModel, claimed: ReadonlyMap<string, string>): Candidate[] {
  const out: Candidate[] = [];
  for (const tile of buildingsIn(grow(model.footprint.bounds, SEARCH_MARGIN_M))) {
    if (model.suppress.has(tile.id)) continue;
    const owner = claimed.get(tile.id);
    if (owner && owner !== model.id) continue;
    const geometry = abutterGeometry(tile.rings, model.footprint, model.hull);
    if (geometry.overlap >= MAX_PARTIAL_OVERLAP || !geometry.categories.length) continue;
    out.push({tile, geometry});
  }
  return out;
}

// ---- facts snapshot -------------------------------------------------------------------------------------------

/** pand16 -> [year (0 unknown), roof code 0..3, eaves dm, ridge dm, roof slot or '']. */
export type PandRow = [number, number, number, number, string];
export interface FactsSnapshot {
  version: 1; generatedAt: string; sources: Record<string, string>;
  pands: Record<string, PandRow>;
  /** Candidate tile id -> the pands it draws (mutual footprint share >= 0.5). */
  tilePands: Record<string, string[]>;
  /** Model id -> its own pands (suppressed pand ids plus pands >= 50% inside the footprint). */
  landmarkPands: Record<string, string[]>;
  /** pand16 -> monument keys (`gm:<n>` municipal, `rce:<n>` national). */
  monuments: Record<string, string[]>;
  /** Monument key -> "name, address (years)". */
  monumentNames: Record<string, string>;
  /** pand16 -> verblijfsobject ids (RCE register). */
  vbos: Record<string, string[]>;
  /** OSM way id -> [building value, building:part 0/1, name]. */
  osm: Record<string, [string, number, string]>;
}

export const readFacts = (): FactsSnapshot | null => (fs.existsSync(FACTS) ? readJson(FACTS) : null);

const ROOF_NAMES = ['', 'horizontal', 'multiple horizontal', 'slanted'];
const earliest = (years: number[]) => { const ok = years.filter(y => y >= 1100 && y <= 2100); return ok.length ? Math.min(...ok) : null; };

/** Identity evidence for one candidate, from the snapshot. A tile id the snapshot never saw gets geometry-only evidence. */
export function identityOf(model: LandmarkModel, c: Candidate, facts: FactsSnapshot | null): AbutterIdentity & {pands: string[]; monumentNames: string[]} {
  const tileId = c.tile.id;
  const base: AbutterIdentity & {pands: string[]; monumentNames: string[]} = {tileHeightM: c.tile.height ?? null, tileRoofShape: c.tile.roofShape ?? null, tileIsOsm: !tileId.startsWith(PAND_PREFIX), pands: [], monumentNames: []};
  if (!facts) return base;
  const pands = facts.tilePands[tileId] ?? (tileId.startsWith(PAND_PREFIX) ? [tileId.slice(PAND_PREFIX.length)] : []);
  const own = facts.landmarkPands[model.id] ?? [];
  const ownMon = new Set(own.flatMap(p => facts.monuments[p] ?? [])), ownVbo = new Set(own.flatMap(p => facts.vbos[p] ?? []));
  const shared = [...new Set(pands.flatMap(p => facts.monuments[p] ?? []).filter(m => ownMon.has(m)))].sort();
  const vbos = [...new Set(pands.flatMap(p => facts.vbos[p] ?? []).filter(v => ownVbo.has(v)))].sort();
  const rows = pands.map(p => facts.pands[p]).filter(Boolean);
  const main = rows[0];
  const osm = facts.osm[tileId];
  return {
    ...base, pands,
    monumentNames: [...new Set(pands.flatMap(p => facts.monuments[p] ?? []))].map(m => `${m} ${facts.monumentNames[m] ?? ''}`.trim()),
    year: earliest(rows.map(r => r[0])),
    landmarkYear: earliest(own.map(p => facts.pands[p]?.[0] ?? 0)),
    sharedMonuments: shared, sharedVbos: vbos,
    bagRoof: main ? ROOF_NAMES[main[1]] || null : null,
    bagRidgeM: main ? (main[3] || main[2]) / 10 || null : null,
    osmBuildingPart: osm ? osm[1] === 1 : false,
    osmBuilding: osm?.[0] || null,
  };
}

export interface ScoredCandidate extends Candidate { identity: ReturnType<typeof identityOf>; score: number; terms: ScoreTerm[] }

export function scoreCandidates(model: LandmarkModel, cands: readonly Candidate[], facts: FactsSnapshot | null): ScoredCandidate[] {
  return cands.map(c => { const identity = identityOf(model, c, facts); return {...c, identity, ...scoreAbutter(c.geometry, identity)}; })
    .sort((a, b) => b.score - a.score || a.tile.id.localeCompare(b.tile.id));
}
