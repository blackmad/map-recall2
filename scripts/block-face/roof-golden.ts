/**
 * Identity guard for block-face roofs: for every committed face, the facts each pand is compiled from
 * (`prepareFaceFacts`: roofsRD, heights, measuredEavesM) hashed per pand with the class of its roof
 * (survey / recipe / front, `+row` when the row rule clamped it), plus a hash of the resolved house intents per face.
 * Recorded on main before the front-roof rules (2026-10-16) so the rules can prove which pands they leave untouched:
 * a pand whose class is still survey or recipe must hash the same; the test lists every pand that changed class.
 *
 *   node --import tsx scripts/block-face/roof-golden.ts [--write] [--face=<id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {prepareFaceFacts} from '../../src/canalRecall/blockFace/compile.ts';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {fileTypeLoader} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
/** scripts/block-face/intake.ts FACES (not imported: intake.ts is a CLI outside the typed program). */
const FACES = 'scripts/block-face/faces';

export const ROOF_GOLDEN = 'scripts/block-face/roof-golden.json';
export interface RoofGoldenEntry { hash: string; class: string }
export interface RoofGolden { faces: Record<string, Record<string, RoofGoldenEntry>>; intents: Record<string, string> }

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** Faces with an intent and pand facts (the compiled set), sorted. */
export function goldenFaces(): string[] {
  return fs.readdirSync(FACES).filter(f => fs.existsSync(path.join(FACES, f, 'intent.json')) && fs.existsSync(path.join(FACES, f, 'pands'))).sort();
}

/** Hash the compiled-from facts of one face's pands (keyed by the last 6 digits) and its resolved intents. */
export function roofHashesOf(faceId: string): {pands: Record<string, RoofGoldenEntry>; intents: string} {
  const dir = path.join(FACES, faceId);
  const members = fs.existsSync(path.join(dir, 'discovery.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members : undefined;
  const face = validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), members, fileTypeLoader());
  const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8'))]));
  let strip: {heightPx: number; pixelsPerMetre: number; groundNAP: number} | undefined;
  if (face.continuity.measuredEaves?.length || face.continuity.crownFromPhoto?.length) { const s = JSON.parse(fs.readFileSync(path.join(dir, 'strip.json'), 'utf8')); strip = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP}; }
  // Photo crowns need the strip image; the golden covers the authored crowns (gables.json readings are a separate lane).
  const photoGables = face.continuity.crownFromPhoto?.length ? new Map() : undefined;
  const p = prepareFaceFacts(face, facts, {strip, photoGables, terrainAt: sharedTerrain()});
  const pands: Record<string, RoofGoldenEntry> = {};
  p.ground.facts.forEach((f, i) => { pands[f.pandId.slice(-6)] = {hash: sha({roofsRD: f.roofsRD, heights: f.heights, measuredEavesM: f.measuredEavesM ?? null}), class: p.roofClasses[i]}; });
  return {pands, intents: sha(houseIntents(face, fileTypeLoader()))};
}

export function roofHashes(faces = goldenFaces()): RoofGolden {
  const out: RoofGolden = {faces: {}, intents: {}};
  for (const id of faces) {
    try { const r = roofHashesOf(id); out.faces[id] = r.pands; out.intents[id] = r.intents; }
    catch (e) { out.faces[id] = {}; out.intents[id] = `error: ${(e as Error).message.slice(0, 100)}`; }
  }
  return out;
}

export const readRoofGolden = (): RoofGolden => JSON.parse(fs.readFileSync(ROOF_GOLDEN, 'utf8'));

/** Compare now vs golden: pands that changed hash while keeping a survey/recipe class (violations), and class changes (listed). */
export function compareRoofGolden(golden: RoofGolden, now: RoofGolden): {violations: string[]; reclassed: string[]; intentsChanged: string[]} {
  const violations: string[] = [], reclassed: string[] = [], intentsChanged: string[] = [];
  for (const face of Object.keys(now.faces)) {
    const was = golden.faces[face];
    if (!was) continue;
    for (const [pand, e] of Object.entries(now.faces[face])) {
      const w = was[pand];
      if (!w) continue;
      const untouchedClass = (e.class === 'survey' || e.class === 'recipe') && e.class === w.class;
      if (e.class !== w.class) reclassed.push(`${face} ${pand}: ${w.class} -> ${e.class}`);
      else if (untouchedClass && e.hash !== w.hash) violations.push(`${face} ${pand} (${e.class}): ${w.hash} -> ${e.hash}`);
      else if (e.hash !== w.hash) reclassed.push(`${face} ${pand}: ${e.class} changed (${w.hash} -> ${e.hash})`);
    }
    if (golden.intents[face] !== undefined && golden.intents[face] !== now.intents[face]) intentsChanged.push(`${face}: ${golden.intents[face]} -> ${now.intents[face]}`);
  }
  return {violations, reclassed, intentsChanged};
}

if (process.argv[1]?.endsWith('roof-golden.ts')) {
  const only = process.argv.find(a => a.startsWith('--face='))?.slice(7);
  const now = roofHashes(only ? [only] : undefined);
  if (process.argv.includes('--write')) {
    const prev = fs.existsSync(ROOF_GOLDEN) ? readRoofGolden() : {faces: {}, intents: {}};
    const merged: RoofGolden = {faces: {...prev.faces, ...now.faces}, intents: {...prev.intents, ...now.intents}};
    fs.writeFileSync(ROOF_GOLDEN, JSON.stringify(merged, null, 1) + '\n');
    console.log(`recorded ${Object.keys(now.faces).length} faces, ${Object.values(now.faces).reduce((s, f) => s + Object.keys(f).length, 0)} pands`);
  } else {
    const {violations, reclassed, intentsChanged} = compareRoofGolden(readRoofGolden(), now);
    for (const v of violations) console.log(`VIOLATION ${v}`);
    for (const r of reclassed) console.log(`reclassed ${r}`);
    for (const i of intentsChanged) console.log(`intents changed ${i}`);
    console.log(`${violations.length} violations, ${reclassed.length} reclassed, ${intentsChanged.length} intent changes`);
    process.exit(violations.length ? 1 : 0);
  }
}
